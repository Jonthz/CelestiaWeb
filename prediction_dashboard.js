const channel = new BroadcastChannel('celestia_ai_channel');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');

// Elements
const domName = document.getElementById('p-name');
const domSystem = document.getElementById('p-system');
const domRadius = document.getElementById('p-radius');
const domDist = document.getElementById('p-distance');
const domYear = document.getElementById('p-year');

const panelWelcome = document.getElementById('welcome-message');
const panelAnalysis = document.getElementById('analysis-content');

const domScore = document.getElementById('ai-score');
const domVerdict = document.getElementById('ai-verdict');

const domFeatInsol = document.getElementById('feat-insol');
const domFeatPrad = document.getElementById('feat-prad');
const domFeatTeq = document.getElementById('feat-teq');
const domFeatPeriod = document.getElementById('feat-period');

// Chart Setup
let chartInstance = null;
const ctx = document.getElementById('confidenceChart').getContext('2d');

function initChart() {
    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Habitable (Confirmed)', 'Non-Habitable (False Positive)'],
            datasets: [{
                label: 'Model Confidence',
                data: [0, 0],
                backgroundColor: [
                    'rgba(0, 255, 136, 0.6)',
                    'rgba(255, 77, 77, 0.6)'
                ],
                borderColor: [
                    'rgba(0, 255, 136, 1)',
                    'rgba(255, 77, 77, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, max: 1 }
            }
        }
    });
}

initChart();

// Connection Handler
statusText.textContent = "Listening for Main App...";
statusDot.classList.add('connected'); // Always "connected" to channel loosely

channel.onmessage = async (event) => {
    console.log("📥 Dashboard received message:", event.data);
    const { type, data } = event.data;

    if (type === 'planet_selected') {
        console.log("🎯 Planet selected:", data.name);
        updatePlanetInfo(data);
        await getPrediction(data);
    }
};

function updatePlanetInfo(data) {
    statusText.textContent = "Receiving Data";

    domName.textContent = data.name;
    domSystem.textContent = data.system || 'Unknown';
    domRadius.textContent = data.radius || '?'; // Might need converting
    domDist.textContent = data.distance || '?';
    domYear.textContent = data.discoveryYear || '?';

    panelWelcome.style.display = 'none';
    panelAnalysis.style.display = 'block';
}

async function getPrediction(planetData) {
    domVerdict.textContent = "COMPUTING...";
    domVerdict.style.color = "#888";
    domScore.textContent = "...";

    try {
        // Prepare ID. 
        // The visualization uses names like "Kepler-22b". 
        // We might need to send the internal ID if available, or name.
        // Assuming 'name' is the best identifier we have from the viewer for now.
        // Or if the viewer sends the 'id' field from koiData.json (e.g. K00753.01)

        const payload = {
            planet_id: planetData.id || planetData.name // Fallback to name if ID missing
        };

        const response = await fetch('http://localhost:8093/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Server Error: ${response.status}`);
        }

        const result = await response.json();
        renderResult(result);

    } catch (err) {
        console.error(err);
        domVerdict.textContent = "ERROR";
        domVerdict.style.color = "red";
        domScore.textContent = "ERR";
    }
}

function renderResult(result) {
    const score = result.habitability_score;
    const percentage = (score * 100).toFixed(1) + '%';
    const isHabitable = result.is_habitable_candidate;

    domScore.textContent = percentage;
    domVerdict.textContent = isHabitable ? "POTENTIALLY HABITABLE" : "NON-HABITABLE";
    domVerdict.style.color = isHabitable ? "#00ff88" : "#ff4d4d";
    domScore.style.color = isHabitable ? "#00ff88" : "#ff4d4d";

    // Update Features
    domFeatInsol.textContent = result.features.koi_insol ? result.features.koi_insol.toFixed(2) : 'N/A';
    domFeatPrad.textContent = result.features.koi_prad ? result.features.koi_prad.toFixed(2) : 'N/A';
    domFeatTeq.textContent = result.features.koi_teq ? result.features.koi_teq.toFixed(0) + ' K' : 'N/A';
    domFeatPeriod.textContent = result.features.koi_period ? result.features.koi_period.toFixed(1) + ' days' : 'N/A';

    // Update Chart
    chartInstance.data.datasets[0].data = [score, 1 - score];
    chartInstance.update();
}
