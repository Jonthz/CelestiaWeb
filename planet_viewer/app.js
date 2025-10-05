let scene, camera, renderer, controls;
let currentPlanet;
let planets = [];
let currentPlanetIndex = 0;
let star;
let showStar = true;
let autoRotate = true;
let planetMesh;
let rotationAxisLine = null;

const planetSize = 2;
const cameraDistance = 20;

init();

async function init() {
    updateLoadingText("Loading planet data...");
    await loadPlanetData();
    populatePlanetSelect()
    updateLoadingText("Setting up 3D environment...");
    setupScene();
    setupCamera();
    setupRenderer();
    setupControls();
    setupLighting();

    updateLoadingText("Initializing controls...");
    setupEventListeners();

    if (planets.length > 0) {
        updateLoadingText("Generating first planet...");
        showPlanet(0);
    }

    updateUI();
    hideLoadingScreen();

    // Start animation loop
    animate();
}

function updateLoadingText(text) {
    const loadingText = document.getElementById('loading-text');
    if (loadingText) {
        loadingText.textContent = text;
    }
}

function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        setTimeout(() => {
            loadingScreen.classList.add('hidden');
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 500);
        }, 500);
    }
}

async function loadPlanetData() {
    try {
        // Try loading KOI data first (most comprehensive)
        updateLoadingText("Fetching KOI candidate data...");
        const response = await fetch('./koiData.json');
        planets = await response.json();
        console.log(`✅ Loaded ${planets.length} KOI planets`);
        updateLoadingText(`Successfully loaded ${planets.length} KOI candidates!`);
    } catch (error) {
        console.error('Error loading KOI data, trying Kepler data:', error);
        try {
            const response = await fetch('./keplerData.json');
            planets = await response.json();
            console.log(`Loaded ${planets.length} Kepler planets`);
        } catch (keplerError) {
            console.error('Error loading Kepler data, falling back to original:', keplerError);
            // Fallback to original data
            try {
                const fallbackResponse = await fetch('./exoplanetData.json');
                const fallbackData = await fallbackResponse.json();
                // Convert old format to new format
                planets = fallbackData.map((planet, index) => ({
                    id: `FALLBACK_${index}`,
                    star: `Star-${planet.system}`,
                    class: "Planet",
                    radius: planet.type === "Gas Giant" ? 71492 :
                        planet.type === "Hot Jupiter" ? 47898 :
                            planet.type === "Super-Earth" ? 8967 : 6371,
                    texture: `${planet.name}.jpg`,
                    ellipticalOrbit: {
                        period: planet.orbitalPeriod || 365,
                        semiMajorAxis: 1.0,
                        eccentricity: 0.0,
                        inclination: 89.0
                    },
                    name: planet.name,
                    system: planet.system,
                    type: planet.type,
                    discoveryYear: planet.discoveryYear,
                    mission: planet.mission,
                    status: planet.status,
                    confidence: planet.confidence,
                    inHabitableZone: planet.inHabitableZone
                }));
            } catch (fallbackError) {
                console.error('Error loading fallback data:', fallbackError);
                planets = [{
                    id: "EXAMPLE_01",
                    star: "Star-Example",
                    class: "Planet",
                    radius: 6371,
                    texture: "earth.jpg",
                    ellipticalOrbit: {
                        period: 365.25,
                        semiMajorAxis: 1.0,
                        eccentricity: 0.0167,
                        inclination: 0.0
                    },
                    name: "Example Planet",
                    system: "Unknown System",
                    type: "Rocky",
                    mass: "1.0 Earths",
                    discoveryYear: 2024,
                    mission: "Unknown",
                    status: "confirmed",
                    confidence: 1.0,
                    inHabitableZone: false
                }];
            }
        }
    }
}

function setupScene() {
    scene = new THREE.Scene();

    // Create improved starfield background
    createStarfield();

    // Create background star (sun)
    createBackgroundStar();
}

function createStarfield() {
    const starsCount = 800; // Reduced count for better performance
    const starsGeometry = new THREE.BufferGeometry();
    const starsPositions = new Float32Array(starsCount * 3);
    const starsSizes = new Float32Array(starsCount);
    const starsColors = new Float32Array(starsCount * 3);

    // Create varied star positions, sizes, and colors
    for (let i = 0; i < starsCount; i++) {
        const i3 = i * 3;

        // Position stars in a sphere around the scene
        const radius = 150 + Math.random() * 50;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);

        starsPositions[i3] = radius * Math.sin(phi) * Math.cos(theta);
        starsPositions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        starsPositions[i3 + 2] = radius * Math.cos(phi);

        // Vary star sizes (small but visible)
        starsSizes[i] = Math.random() * 2.0 + 2.0; // Visible range: 2.0 to 4.0

        // Create varied star colors (blue-white to red)
        const temperature = Math.random();
        if (temperature > 0.8) {
            // Blue-white hot stars
            starsColors[i3] = 0.8 + Math.random() * 0.2;     // R
            starsColors[i3 + 1] = 0.9 + Math.random() * 0.1; // G
            starsColors[i3 + 2] = 1.0;                        // B
        } else if (temperature > 0.6) {
            // White stars
            starsColors[i3] = 1.0;
            starsColors[i3 + 1] = 1.0;
            starsColors[i3 + 2] = 1.0;
        } else if (temperature > 0.3) {
            // Yellow-white stars
            starsColors[i3] = 1.0;
            starsColors[i3 + 1] = 1.0;
            starsColors[i3 + 2] = 0.8 + Math.random() * 0.2;
        } else {
            // Red-orange stars
            starsColors[i3] = 1.0;
            starsColors[i3 + 1] = 0.6 + Math.random() * 0.3;
            starsColors[i3 + 2] = 0.4 + Math.random() * 0.2;
        }
    }

    starsGeometry.setAttribute('position', new THREE.BufferAttribute(starsPositions, 3));
    starsGeometry.setAttribute('size', new THREE.BufferAttribute(starsSizes, 1));
    starsGeometry.setAttribute('color', new THREE.BufferAttribute(starsColors, 3));

    // Create custom star material with vertex shader for size variation
    const starsMaterial = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 }
        },
        vertexShader: `
            attribute float size;
            attribute vec3 color;
            varying vec3 vColor;
            uniform float time;
            
            void main() {
                vColor = color;
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                
                // Add subtle twinkling by varying size
                float twinkle = sin(time * 2.0 + position.x * 10.0) * 0.1 + 1.0;
                gl_PointSize = size * twinkle * (150.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            varying vec3 vColor;
            
            void main() {
                // Create circular stars instead of square points
                vec2 center = gl_PointCoord - vec2(0.5);
                float dist = length(center);
                
                if (dist > 0.5) discard;
                
                // Soft edge falloff for round appearance
                float alpha = smoothstep(0.5, 0.0, dist);
                
                // Add subtle glow
                float glow = smoothstep(0.5, 0.0, dist);
                vec3 finalColor = vColor + (vColor * glow * 0.2);
                
                gl_FragColor = vec4(finalColor, alpha * 0.95);
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    const starfield = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(starfield);

    // Store reference for animation
    scene.userData.starfield = starfield;
}

function setupCamera() {
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, -4.5, cameraDistance);
}

function setupRenderer() {
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const container = document.getElementById('scene-container');
    container.appendChild(renderer.domElement);
}

function setupControls() {
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = true;
    controls.enablePan = false;
    controls.target.set(0, -3, 0);
    controls.minDistance = 3;
    controls.maxDistance = 15;
}

function setupLighting() {
    // Ambient light (increased brightness)
    const ambientLight = new THREE.AmbientLight(0x606060, 0.6);
    scene.add(ambientLight);

    // Star light (main light source - increased intensity)
    const starLight = new THREE.DirectionalLight(0xffffff, 1.5);
    starLight.position.set(-20, 0, 0);
    starLight.castShadow = true;
    starLight.shadow.mapSize.width = 2048;
    starLight.shadow.mapSize.height = 2048;
    scene.add(starLight);

    // Additional rim lighting (increased)
    const rimLight = new THREE.DirectionalLight(0x4488ff, 0.5);
    rimLight.position.set(20, 10, 10);
    scene.add(rimLight);
}

function createBackgroundStar() {
    const textureLoader = new THREE.TextureLoader();

    // Load sun texture
    const sunTexture = textureLoader.load('../textures/2k_sun.jpg');

    const starGeometry = new THREE.SphereGeometry(3, 32, 32);
    const starMaterial = new THREE.MeshBasicMaterial({
        map: sunTexture,
        transparent: true,
        opacity: 1.0
    });

    // Add corona/glow effect
    const coronaGeometry = new THREE.SphereGeometry(4, 32, 32);
    const coronaMaterial = new THREE.MeshBasicMaterial({
        color: 0xff8844,
        transparent: true,
        opacity: 0.2
    });

    star = new THREE.Group();
    const starCore = new THREE.Mesh(starGeometry, starMaterial);
    const corona = new THREE.Mesh(coronaGeometry, coronaMaterial);

    star.add(starCore);
    star.add(corona);
    star.position.set(-25, 0, 0);

    scene.add(star);
}

function generateRealisticTexture(planetData) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext('2d');

    // Determine planet type based on radius and create appropriate texture
    const radius = planetData.radius || 1;
    const earthRadius = 6371; // km
    const relativeSize = radius / earthRadius;

    let planetType = determinePlanetType(relativeSize);

    // Create base gradient
    const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128);

    if (planetType === 'gas_giant') {
        createGasGiantTexture(context, gradient);
    } else if (planetType === 'ice_world') {
        createIceWorldTexture(context, gradient);
    } else if (planetType === 'desert_world') {
        createDesertWorldTexture(context, gradient);
    } else if (planetType === 'ocean_world') {
        createOceanWorldTexture(context, gradient);
    } else {
        createRockyWorldTexture(context, gradient);
    }

    // Add atmospheric effects if large enough
    if (relativeSize > 0.5) {
        addAtmosphericGlow(context);
    }

    // Add surface details
    addSurfaceDetails(context, planetType);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

function determinePlanetType(relativeSize) {
    if (relativeSize > 4) return 'gas_giant';
    if (relativeSize > 1.5) return 'super_earth';
    if (relativeSize < 0.5) return 'small_rocky';

    // Random assignment for variety
    const types = ['rocky_world', 'ice_world', 'desert_world', 'ocean_world'];
    return types[Math.floor(Math.random() * types.length)];
}

function createGasGiantTexture(context, gradient) {
    // Gas giant bands
    const colors = ['#ff7f00', '#ffb366', '#ffd9b3', '#fff2e6', '#e6ccb3'];

    for (let i = 0; i < 256; i += 20) {
        const color = colors[Math.floor(Math.random() * colors.length)];
        context.fillStyle = color;
        context.fillRect(0, i, 256, 20 + Math.random() * 10);
    }

    // Add storm systems
    for (let i = 0; i < 5; i++) {
        context.fillStyle = 'rgba(139, 69, 19, 0.6)';
        context.beginPath();
        context.ellipse(
            Math.random() * 256, Math.random() * 256,
            Math.random() * 30 + 10, Math.random() * 15 + 5,
            Math.random() * Math.PI, 0, Math.PI * 2
        );
        context.fill();
    }
}

function createIceWorldTexture(context, gradient) {
    gradient.addColorStop(0, '#e6f3ff');
    gradient.addColorStop(0.3, '#cce7ff');
    gradient.addColorStop(0.6, '#99d6ff');
    gradient.addColorStop(1, '#66c2ff');

    context.fillStyle = gradient;
    context.fillRect(0, 0, 256, 256);

    // Ice formations
    for (let i = 0; i < 20; i++) {
        context.fillStyle = 'rgba(255, 255, 255, 0.7)';
        context.beginPath();
        context.arc(
            Math.random() * 256, Math.random() * 256,
            Math.random() * 25 + 5, 0, Math.PI * 2
        );
        context.fill();
    }
}

function createDesertWorldTexture(context, gradient) {
    gradient.addColorStop(0, '#f4e4bc');
    gradient.addColorStop(0.3, '#deb887');
    gradient.addColorStop(0.6, '#cd853f');
    gradient.addColorStop(1, '#8b4513');

    context.fillStyle = gradient;
    context.fillRect(0, 0, 256, 256);

    // Sand dunes
    for (let i = 0; i < 15; i++) {
        context.fillStyle = 'rgba(160, 82, 45, 0.4)';
        context.beginPath();
        context.ellipse(
            Math.random() * 256, Math.random() * 256,
            Math.random() * 40 + 20, Math.random() * 20 + 10,
            Math.random() * Math.PI, 0, Math.PI * 2
        );
        context.fill();
    }
}

function createOceanWorldTexture(context, gradient) {
    gradient.addColorStop(0, '#4682b4');
    gradient.addColorStop(0.3, '#5f9ea0');
    gradient.addColorStop(0.6, '#008b8b');
    gradient.addColorStop(1, '#006400');

    context.fillStyle = gradient;
    context.fillRect(0, 0, 256, 256);

    // Continents
    for (let i = 0; i < 8; i++) {
        context.fillStyle = 'rgba(34, 139, 34, 0.8)';
        context.beginPath();
        context.arc(
            Math.random() * 256, Math.random() * 256,
            Math.random() * 30 + 15, 0, Math.PI * 2
        );
        context.fill();
    }
}

function createRockyWorldTexture(context, gradient) {
    gradient.addColorStop(0, '#8b7355');
    gradient.addColorStop(0.3, '#a0522d');
    gradient.addColorStop(0.6, '#696969');
    gradient.addColorStop(1, '#2f4f4f');

    context.fillStyle = gradient;
    context.fillRect(0, 0, 256, 256);

    // Rock formations
    for (let i = 0; i < 25; i++) {
        context.fillStyle = 'rgba(105, 105, 105, 0.5)';
        context.beginPath();
        context.arc(
            Math.random() * 256, Math.random() * 256,
            Math.random() * 15 + 3, 0, Math.PI * 2
        );
        context.fill();
    }
}

function addAtmosphericGlow(context) {
    const glowGradient = context.createRadialGradient(128, 128, 80, 128, 128, 140);
    glowGradient.addColorStop(0, 'rgba(135, 206, 235, 0)');
    glowGradient.addColorStop(0.8, 'rgba(135, 206, 235, 0.1)');
    glowGradient.addColorStop(1, 'rgba(135, 206, 235, 0.3)');

    context.fillStyle = glowGradient;
    context.fillRect(0, 0, 256, 256);
}

function addSurfaceDetails(context, planetType) {
    // Add craters for rocky worlds
    if (planetType.includes('rocky') || planetType === 'small_rocky') {
        for (let i = 0; i < 12; i++) {
            const x = Math.random() * 256;
            const y = Math.random() * 256;
            const radius = Math.random() * 8 + 2;

            context.fillStyle = 'rgba(0, 0, 0, 0.3)';
            context.beginPath();
            context.arc(x, y, radius, 0, Math.PI * 2);
            context.fill();

            context.fillStyle = 'rgba(255, 255, 255, 0.1)';
            context.beginPath();
            context.arc(x - radius * 0.3, y - radius * 0.3, radius * 0.5, 0, Math.PI * 2);
            context.fill();
        }
    }

    // Add noise for all planet types
    const imageData = context.getImageData(0, 0, 256, 256);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 20;
        data[i] = Math.max(0, Math.min(255, data[i] + noise));
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
    }

    context.putImageData(imageData, 0, 0);
}

// Available textures in the textures folder
const availableTextures = [
    'GJ_504_b.jpg',
    'HAT-P-11_b.jpg',
    'HD_189733_b.jpg',
    'Kepler-22_b.jpg',
    'Kepler-452_b.jpg',
    'Kepler-7_b.jpg',
    'OGLE-2005-BLG-390L_b.jpg',
    'Proxima_Cen_b.jpg',
    'YZ_Cet_d.jpg'
];

function loadPlanetTexture(planetData) {
    const textureLoader = new THREE.TextureLoader();

    // Check if planet has a texture field
    if (planetData.texture) {
        const texturePath = `../textures/${planetData.texture}`;

        // Check if the texture exists in our available textures
        if (availableTextures.includes(planetData.texture)) {
            console.log(`Loading texture: ${texturePath}`);
            return textureLoader.load(
                texturePath,
                undefined, // onLoad
                undefined, // onProgress
                (error) => {
                    console.warn(`Failed to load texture ${texturePath}, using fallback`);
                    return generateRealisticTexture(planetData);
                }
            );
        }
    }

    // If no texture or texture doesn't exist, assign random one
    const randomTexture = availableTextures[Math.floor(Math.random() * availableTextures.length)];
    const randomPath = `../textures/${randomTexture}`;
    console.log(`Using random texture: ${randomPath} for planet ${planetData.name}`);

    return textureLoader.load(
        randomPath,
        undefined,
        undefined,
        (error) => {
            console.warn(`Failed to load random texture ${randomPath}, using procedural texture`);
            return generateRealisticTexture(planetData);
        }
    );
}

function createPlanet(planetData) {
    // Scale planet size based on radius
    const baseSize = planetSize;
    const radius = planetData.radius || 6371; // Default to Earth radius
    const earthRadius = 6371;
    const scaleFactor = Math.min(Math.max(radius / earthRadius, 0.3), 5); // Clamp between 0.3 and 5
    const actualSize = baseSize * scaleFactor;

    const geometry = new THREE.SphereGeometry(actualSize, 64, 64);
    const texture = loadPlanetTexture(planetData);

    // Enhanced material with better lighting
    const material = new THREE.MeshPhongMaterial({
        map: texture,
        transparent: false,
        shininess: 10,
        specular: 0x222222
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = planetData;

    return mesh;
}

function createRotationAxis(planetData, planetSize) {
    // Get inclination from orbital data (in degrees)
    const inclinationDegrees = planetData.ellipticalOrbit?.inclination || 0;

    // Convert to radians for rotation
    // Orbital inclination is the tilt of the orbit plane
    // We'll use it to show the planet's rotational axis tilt
    const inclinationRadians = (90 - inclinationDegrees) * (Math.PI / 180);

    // Create the axis line
    const axisLength = planetSize * 1.8; // Extend beyond the planet
    const axisGeometry = new THREE.BufferGeometry();
    const axisVertices = new Float32Array([
        0, -axisLength, 0,  // Bottom point
        0, axisLength, 0    // Top point
    ]);

    axisGeometry.setAttribute('position', new THREE.BufferAttribute(axisVertices, 3));

    // Create gradient material for the axis
    const axisMaterial = new THREE.LineBasicMaterial({
        color: 0x00ffff,
        linewidth: 3,
        transparent: true,
        opacity: 0.8
    });

    const axisLine = new THREE.Line(axisGeometry, axisMaterial);

    // Apply the inclination rotation
    // Rotate around the X axis to tilt the axis
    axisLine.rotation.x = inclinationRadians;

    // Create a group to hold the axis
    const axisGroup = new THREE.Group();
    axisGroup.add(axisLine);

    // Apply the same rotation to the entire group
    axisGroup.rotation.x = inclinationRadians;

    // Store inclination info in userData
    axisGroup.userData.inclinationDegrees = inclinationDegrees;

    return axisGroup;
}

function showPlanet(index) {
    if (index < 0 || index >= planets.length) return;

    // Remove current planet
    if (planetMesh) {
        scene.remove(planetMesh);
        planetMesh.geometry.dispose();
        planetMesh.material.dispose();
    }

    // Remove current rotation axis
    if (rotationAxisLine) {
        scene.remove(rotationAxisLine);
        rotationAxisLine.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
        rotationAxisLine = null;
    }

    currentPlanetIndex = index;
    currentPlanet = planets[index];

    // Create new planet
    planetMesh = createPlanet(currentPlanet);
    scene.add(planetMesh);

    // Get the actual size of the planet for the axis
    const planetActualSize = planetMesh.geometry.parameters.radius;

    // Create and add rotation axis
    rotationAxisLine = createRotationAxis(currentPlanet, planetActualSize);
    scene.add(rotationAxisLine);

    updatePlanetInfo();
    updateNavigation();

    // Add entrance animation
    planetMesh.scale.set(0, 0, 0);
    const targetScale = new THREE.Vector3(1, 1, 1);

    function animateEntrance() {
        planetMesh.scale.lerp(targetScale, 0.1);
        if (planetMesh.scale.length() < 0.99) {
            requestAnimationFrame(animateEntrance);
        }
    }
    animateEntrance();
}

function updatePlanetInfo() {
    if (!currentPlanet) return;

    // Update compact info
    document.getElementById('current-planet-name').textContent = currentPlanet.name;
    document.getElementById('current-planet-system').textContent = `System: ${currentPlanet.system}`;
    document.getElementById('current-planet-type').textContent = `Type: ${currentPlanet.type}`;

    // Update detailed info
    document.getElementById('planet-name-detail').textContent = currentPlanet.name;
    //document.getElementById('planet-mass').textContent = currentPlanet.mass;

    // Use the distance parameter from the data
    const distance = currentPlanet.distance || 'Distance unknown';
    document.getElementById('planet-distance').textContent = distance;

    document.getElementById('planet-system').textContent = currentPlanet.system;
    document.getElementById('planet-discovery').textContent = currentPlanet.discoveryYear;
    document.getElementById('planet-habitable').textContent = currentPlanet.inHabitableZone ? 'Yes' : 'No';

    // Mission data
    document.getElementById('planet-mission').textContent = currentPlanet.mission || 'Unknown';
    document.getElementById('planet-status').textContent = currentPlanet.status || 'Unknown';
    document.getElementById('planet-confidence').textContent = currentPlanet.confidence ?
        (currentPlanet.confidence * 100).toFixed(1) + '%' : 'N/A';

    // Orbital data
    document.getElementById('planet-period').textContent =
        currentPlanet.ellipticalOrbit.period.toFixed(3) + ' days';

    // Additional orbital information
    const depthElement = document.getElementById('planet-depth');
    depthElement.textContent = `${currentPlanet.ellipticalOrbit.semiMajorAxis.toFixed(3)} AU`;

    // Planet radius and ID
    const radiusKm = currentPlanet.radius.toLocaleString();
    document.getElementById('planet-radius').textContent = `${radiusKm} km`;
    document.getElementById('planet-id').textContent = currentPlanet.id;

    // Show inclination info if element exists
    const inclinationElement = document.getElementById('planet-inclination');
    if (inclinationElement && currentPlanet.ellipticalOrbit.inclination !== undefined) {
        inclinationElement.textContent = `${currentPlanet.ellipticalOrbit.inclination.toFixed(2)}°`;
    }

    // Apply status classes
    const statusElement = document.getElementById('planet-status');
    const habitableElement = document.getElementById('planet-habitable');
    const missionElement = document.getElementById('planet-mission');

    statusElement.className = `value status-${currentPlanet.status}`;
    habitableElement.className = `value habitable-${currentPlanet.inHabitableZone ? 'yes' : 'no'}`;
    missionElement.className = `value mission-${currentPlanet.mission?.toLowerCase()}`;
}

function updateNavigation() {
    document.getElementById('current-planet-index').textContent = currentPlanetIndex + 1;
    document.getElementById('total-planets').textContent = planets.length;

    const prevBtn = document.getElementById('prev-planet');
    const nextBtn = document.getElementById('next-planet');

    prevBtn.disabled = currentPlanetIndex === 0;
    nextBtn.disabled = currentPlanetIndex === planets.length - 1;
}

function updateUI() {
    const totalElement = document.getElementById('total-planets');
    if (totalElement) {
        totalElement.textContent = planets.length;
    }
    
    // Update navigation info
    const navInfo = document.getElementById('navigation-info');
    if (navInfo && currentPlanet) {
        navInfo.innerHTML = `
            <strong>Planet ${currentPlanetIndex + 1} of ${planets.length}</strong><br>
            <span style="color: #00d4ff;">${currentPlanet.name}</span> (${currentPlanet.type})
        `;
    }
}

function nextPlanet() {
    if (currentPlanetIndex < planets.length - 1) {
        showPlanet(currentPlanetIndex + 1);
    }
}

function previousPlanet() {
    if (currentPlanetIndex > 0) {
        showPlanet(currentPlanetIndex - 1);
    }
}

function toggleInfo() {
    const panel = document.getElementById('info-panel');
    const details = document.getElementById('planet-details');
    const button = document.getElementById('toggle-info');

    if (details.classList.contains('hidden')) {
        panel.classList.add('visible');
        details.classList.remove('hidden');
        details.classList.add('fade-in');
        button.textContent = 'Hide Details';
    } else {
        details.classList.add('hidden');
        button.textContent = 'Details';
        // Delay hiding the panel to allow fade animation
        setTimeout(() => {
            if (details.classList.contains('hidden')) {
                panel.classList.remove('visible');
            }
        }, 300);
    }
}

function toggleAutoRotate() {
    autoRotate = !autoRotate;
    const button = document.getElementById('auto-rotate-btn');

    if (autoRotate) {
        button.classList.add('active');
        button.textContent = 'Stop Rotate';
    } else {
        button.classList.remove('active');
        button.textContent = 'Auto Rotate';
    }
}

function resetCamera() {
    camera.position.set(0, -4.5, cameraDistance);
    controls.target.set(0, -3, 0);
    controls.update();
}

function toggleStar() {
    showStar = !showStar;
    star.visible = showStar;

    const button = document.getElementById('show-star-btn');
    button.textContent = showStar ? 'Hide Star' : 'Show Star';
}

function setupEventListeners() {
    // Navigation buttons
    document.getElementById('prev-planet').addEventListener('click', previousPlanet);
    document.getElementById('next-planet').addEventListener('click', nextPlanet);

    // Control buttons
    document.getElementById('toggle-info').addEventListener('click', toggleInfo);
    document.getElementById('compare-planets-btn').addEventListener('click', () => {
        window.location.href = 'compare.html';
    });
    document.getElementById('auto-rotate-btn').addEventListener('click', toggleAutoRotate);
    document.getElementById('reset-camera-btn').addEventListener('click', resetCamera);
    document.getElementById('show-star-btn').addEventListener('click', toggleStar);

    // Keyboard navigation
    document.addEventListener('keydown', (event) => {
        switch (event.code) {
            case 'ArrowLeft':
                event.preventDefault();
                previousPlanet();
                break;
            case 'ArrowRight':
                event.preventDefault();
                nextPlanet();
                break;
            case 'Space':
                event.preventDefault();
                toggleAutoRotate();
                break;
            case 'KeyI':
                event.preventDefault();
                toggleInfo();
                break;
            case 'KeyR':
                event.preventDefault();
                resetCamera();
                break;
            case 'KeyS':
                event.preventDefault();
                toggleStar();
                break;
        }
    });

    // Window resize
    window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);

    // Rotate planet on its own axis based on orbital period
    if (planetMesh && currentPlanet) {
        // Get orbital period in Earth days
        const orbitalPeriodDays = currentPlanet.ellipticalOrbit?.period || 365;

        // For tidally locked planets: rotational period = orbital period
        // Calculate rotation per frame (assuming 60 FPS)
        // One full rotation (2π radians) in orbitalPeriodDays Earth days

        // Real-time calculation:
        // - 1 Earth day = 86400 seconds
        // - At 60 FPS, 1 second = 60 frames
        // - So 1 day = 86400 * 60 = 5,184,000 frames
        // - Rotation per frame = (2π) / (orbitalPeriodDays * 5,184,000)

        // But this is TOO slow for visualization, so we speed it up
        // Time acceleration factor for visualization
        const timeAccelerationBase = 3600; // Speed up by 3600x (1 hour = 1 second in real time)

        // Calculate realistic rotation speed
        // radiansPerEarthDay = 2π / orbitalPeriodDays
        // radiansPerFrame = radiansPerEarthDay / (24 * 60 * 60 * 60) [60 FPS]
        // With time acceleration: radiansPerFrame * timeAcceleration

        const radiansPerEarthDay = (2 * Math.PI) / orbitalPeriodDays;
        const framesPerSecond = 60;
        const secondsPerDay = 86400;
        const radiansPerFrame = (radiansPerEarthDay / secondsPerDay) * (timeAccelerationBase / framesPerSecond);

        // If auto-rotate is enabled, use additional acceleration multiplier
        const autoRotateMultiplier = autoRotate ? 100 : 1;
        const finalRotationSpeed = radiansPerFrame * autoRotateMultiplier;

        // Apply rotation
        planetMesh.rotation.y += finalRotationSpeed;

        // Also rotate the axis line to match the planet's rotation
        if (rotationAxisLine) {
            rotationAxisLine.rotation.y = planetMesh.rotation.y;
        }
    }

    // Animate star corona
    if (star) {
        star.children[1].rotation.y += 0.002;
        star.children[1].rotation.x += 0.001;
    }

    // Animate starfield twinkling
    if (scene.userData.starfield) {
        const time = Date.now() * 0.001;
        scene.userData.starfield.material.uniforms.time.value = time;
    }

    controls.update();
    renderer.render(scene, camera);
}

// Pagination variables
let currentPage = 0;
let planetsPerPage = 100;
let filteredPlanets = [];
let currentFilter = 'all';

function populatePlanetSelect() {
    const select = document.getElementById('planet-select');
    if (!select || !planets) return;

    // Initialize filtered planets
    filteredPlanets = [...planets];
    updatePlanetSelect();
    setupPaginationControls();
}

function updatePlanetSelect() {
    const select = document.getElementById('planet-select');
    const startIndex = currentPage * planetsPerPage;
    const endIndex = Math.min(startIndex + planetsPerPage, filteredPlanets.length);
    const currentPagePlanets = filteredPlanets.slice(startIndex, endIndex);
    
    select.innerHTML = `<option value="" disabled selected>Page ${currentPage + 1} - Select a Planet (${startIndex + 1}-${endIndex} of ${filteredPlanets.length})</option>`;
    
    currentPagePlanets.forEach((planet, pageIndex) => {
        const globalIndex = filteredPlanets.indexOf(planet);
        const option = document.createElement('option');
        option.value = globalIndex;
        option.textContent = `${planet.name} (${planet.type}) - ${planet.distance}`;
        select.appendChild(option);
    });

    select.removeEventListener('change', handlePlanetSelect); // Remove old listener
    select.addEventListener('change', handlePlanetSelect);
    
    updatePaginationInfo();
}

function handlePlanetSelect(event) {
    const selectedIndex = parseInt(event.target.value);
    if (!isNaN(selectedIndex)) {
        const planetIndex = planets.indexOf(filteredPlanets[selectedIndex]);
        showPlanet(planetIndex);
    }
}

function setupPaginationControls() {
    // Add pagination controls to the existing UI
    const controlsContainer = document.querySelector('.controls-section');
    if (!controlsContainer) return;
    
    const paginationHTML = `
        <div class="pagination-controls" style="margin: 10px 0; padding: 10px; background: rgba(0,0,0,0.7); border-radius: 10px;">
            <div class="filter-section" style="margin-bottom: 10px;">
                <label style="color: #00d4ff; margin-right: 10px;">Filter by type:</label>
                <select id="planet-type-filter" style="padding: 5px; background: rgba(0,0,0,0.8); color: white; border: 1px solid #00d4ff; border-radius: 5px;">
                    <option value="all">All Types (${planets.length})</option>
                    <option value="Gas Giant">Gas Giant</option>
                    <option value="Neptune-like">Neptune-like</option>
                    <option value="Sub-Neptune">Sub-Neptune</option>
                    <option value="Super-Earth">Super-Earth</option>
                    <option value="Terrestrial">Terrestrial</option>
                </select>
                <select id="planets-per-page" style="margin-left: 10px; padding: 5px; background: rgba(0,0,0,0.8); color: white; border: 1px solid #00d4ff; border-radius: 5px;">
                    <option value="50">50 per page</option>
                    <option value="100" selected>100 per page</option>
                    <option value="200">200 per page</option>
                </select>
            </div>
            <div class="pagination-nav" style="display: flex; align-items: center; justify-content: space-between;">
                <button id="prev-page" class="nav-btn" style="background: linear-gradient(45deg, #00d4ff, #0099cc); color: white; border: none; padding: 8px 16px; border-radius: 20px; cursor: pointer;">◀ Previous</button>
                <div id="pagination-info" style="color: #00d4ff; font-weight: bold;"></div>
                <button id="next-page" class="nav-btn" style="background: linear-gradient(45deg, #00d4ff, #0099cc); color: white; border: none; padding: 8px 16px; border-radius: 20px; cursor: pointer;">Next ▶</button>
            </div>
        </div>
    `;
    
    controlsContainer.insertAdjacentHTML('afterbegin', paginationHTML);
    
    // Setup event listeners
    document.getElementById('prev-page').addEventListener('click', () => {
        if (currentPage > 0) {
            currentPage--;
            updatePlanetSelect();
        }
    });
    
    document.getElementById('next-page').addEventListener('click', () => {
        const maxPages = Math.ceil(filteredPlanets.length / planetsPerPage);
        if (currentPage < maxPages - 1) {
            currentPage++;
            updatePlanetSelect();
        }
    });
    
    document.getElementById('planet-type-filter').addEventListener('change', (e) => {
        currentFilter = e.target.value;
        currentPage = 0; // Reset to first page
        applyFilter();
        updatePlanetSelect();
    });
    
    document.getElementById('planets-per-page').addEventListener('change', (e) => {
        planetsPerPage = parseInt(e.target.value);
        currentPage = 0; // Reset to first page
        updatePlanetSelect();
    });
}

function applyFilter() {
    if (currentFilter === 'all') {
        filteredPlanets = [...planets];
    } else {
        filteredPlanets = planets.filter(planet => planet.type === currentFilter);
    }
    
    // Update filter dropdown with counts
    const filterSelect = document.getElementById('planet-type-filter');
    if (filterSelect) {
        const typeCounts = {};
        planets.forEach(p => {
            typeCounts[p.type] = (typeCounts[p.type] || 0) + 1;
        });
        
        filterSelect.innerHTML = `
            <option value="all">All Types (${planets.length})</option>
            <option value="Gas Giant">Gas Giant (${typeCounts['Gas Giant'] || 0})</option>
            <option value="Neptune-like">Neptune-like (${typeCounts['Neptune-like'] || 0})</option>
            <option value="Sub-Neptune">Sub-Neptune (${typeCounts['Sub-Neptune'] || 0})</option>
            <option value="Super-Earth">Super-Earth (${typeCounts['Super-Earth'] || 0})</option>
            <option value="Terrestrial">Terrestrial (${typeCounts['Terrestrial'] || 0})</option>
        `;
        filterSelect.value = currentFilter;
    }
}

function updatePaginationInfo() {
    const infoElement = document.getElementById('pagination-info');
    if (!infoElement) return;
    
    const totalPages = Math.ceil(filteredPlanets.length / planetsPerPage);
    infoElement.textContent = `Page ${currentPage + 1} of ${totalPages} (${filteredPlanets.length} planets)`;
    
    // Update button states
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    
    if (prevBtn) prevBtn.disabled = currentPage === 0;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages - 1;
}