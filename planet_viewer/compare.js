// Global shared data
let planets = [];
let lastFocusedViewer = 'left';

// Viewer objects
const leftViewer = {
    side: 'left',
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    currentPlanetIndex: 0,
    currentPlanet: null,
    planetMesh: null,
    rotationAxisLine: null,
    star: null,
    autoRotate: true,
    showStar: true,
    containerElement: null,
    availablePlanets: []
};

const rightViewer = {
    side: 'right',
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    currentPlanetIndex: 1,
    currentPlanet: null,
    planetMesh: null,
    rotationAxisLine: null,
    star: null,
    autoRotate: true,
    showStar: true,
    containerElement: null,
    availablePlanets: []
};

const planetSize = 2;
const cameraDistance = 20;

// Initialize
init();

async function init() {
    updateLoadingText("Loading planet data...");
    await loadPlanetData();

    updateLoadingText("Setting up viewers...");
    setupViewer(leftViewer, 'left-scene');
    setupViewer(rightViewer, 'right-scene');

    updateLoadingText("Loading planets...");

    // Initialize viewers with default categories
    leftViewer.availablePlanets = getPlanetsForCategory('earth');
    rightViewer.availablePlanets = getPlanetsForCategory('jupiter');

    updateLoadingText("Initializing controls...");
    setupEventListeners();

    // Set dropdown values after initialization
    document.getElementById('left-category').value = 'earth';
    document.getElementById('right-category').value = 'jupiter';

    // Wait a bit for everything to settle, then trigger initial category changes
    setTimeout(() => {
        changePlanetCategory(leftViewer, 'earth');
        changePlanetCategory(rightViewer, 'jupiter');

        // Restore habitability panel states
        restoreHabPanelStates();
    }, 100);

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

// Global datasets
let solarSystemPlanets = [];
let exoplanets = [];

async function loadPlanetData() {
    try {
        // Load Solar System data (Earth & Jupiter)
        updateLoadingText("Loading Solar System data...");
        const solarResponse = await fetch('./solarSystemData.json');
        solarSystemPlanets = await solarResponse.json();
        console.log(`✅ Loaded ${solarSystemPlanets.length} Solar System planets`);

        // Load exoplanet data
        updateLoadingText("Fetching KOI candidate data...");
        const exoResponse = await fetch('./koiData.json');
        exoplanets = await exoResponse.json();
        console.log(`✅ Loaded ${exoplanets.length} exoplanets`);

        // Set default planets array to exoplanets
        planets = exoplanets;
        updateLoadingText(`Successfully loaded all planetary data!`);
    } catch (error) {
        console.error('Error loading planet data:', error);
        // Fallback data
        solarSystemPlanets = [];
        exoplanets = [];
        planets = [];
    }
}

function getPlanetsForCategory(category) {
    switch (category) {
        case 'earth':
            return solarSystemPlanets.filter(p => p.name === 'Earth');
        case 'jupiter':
            return solarSystemPlanets.filter(p => p.name === 'Jupiter');
        case 'exoplanets':
            return exoplanets;
        default:
            return exoplanets;
    }
}

function changePlanetCategory(viewer, category) {
    const categoryPlanets = getPlanetsForCategory(category);
    viewer.availablePlanets = categoryPlanets;
    viewer.currentPlanetIndex = 0;

    // Show search input only for exoplanets
    const searchInput = document.getElementById(`${viewer.side}-search`);
    if (category === 'exoplanets') {
        searchInput.style.display = 'block';
    } else {
        searchInput.style.display = 'none';
    }

    // Show the first planet of the selected category
    if (categoryPlanets.length > 0) {
        showPlanet(viewer, 0);
    }

    updateNavigation(viewer);
}

function setupViewer(viewer, containerId) {
    viewer.containerElement = document.getElementById(containerId);

    // Setup scene
    viewer.scene = new THREE.Scene();
    createStarfield(viewer);
    createBackgroundStar(viewer);

    // Setup camera
    viewer.camera = new THREE.PerspectiveCamera(
        75,
        viewer.containerElement.clientWidth / viewer.containerElement.clientHeight,
        0.1,
        1000
    );
    viewer.camera.position.set(0, 0, cameraDistance);

    // Setup renderer
    viewer.renderer = new THREE.WebGLRenderer({ antialias: true });
    viewer.renderer.setSize(
        viewer.containerElement.clientWidth,
        viewer.containerElement.clientHeight
    );
    viewer.renderer.setPixelRatio(window.devicePixelRatio);
    viewer.renderer.shadowMap.enabled = true;
    viewer.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    viewer.containerElement.appendChild(viewer.renderer.domElement);

    // Setup controls
    viewer.controls = new THREE.OrbitControls(viewer.camera, viewer.renderer.domElement);
    viewer.controls.enableDamping = true;
    viewer.controls.dampingFactor = 0.05;
    viewer.controls.enableZoom = true;
    viewer.controls.enablePan = false;
    viewer.controls.target.set(0, 0, 0);
    viewer.controls.minDistance = 3;
    viewer.controls.maxDistance = 40;

    // Setup lighting (increased brightness)
    const ambientLight = new THREE.AmbientLight(0x606060, 0.6);
    viewer.scene.add(ambientLight);

    const starLight = new THREE.DirectionalLight(0xffffff, 1.5);
    starLight.position.set(-20, 0, 0);
    starLight.castShadow = true;
    starLight.shadow.mapSize.width = 2048;
    starLight.shadow.mapSize.height = 2048;
    viewer.scene.add(starLight);

    const rimLight = new THREE.DirectionalLight(0x4488ff, 0.5);
    rimLight.position.set(20, 10, 10);
    viewer.scene.add(rimLight);
}

function createStarfield(viewer) {
    const starsCount = 800;
    const starsGeometry = new THREE.BufferGeometry();
    const starsPositions = new Float32Array(starsCount * 3);
    const starsSizes = new Float32Array(starsCount);
    const starsColors = new Float32Array(starsCount * 3);

    for (let i = 0; i < starsCount; i++) {
        const i3 = i * 3;
        const radius = 150 + Math.random() * 50;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);

        starsPositions[i3] = radius * Math.sin(phi) * Math.cos(theta);
        starsPositions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        starsPositions[i3 + 2] = radius * Math.cos(phi);
        starsSizes[i] = Math.random() * 2.0 + 2.0;

        const temperature = Math.random();
        if (temperature > 0.8) {
            starsColors[i3] = 0.8 + Math.random() * 0.2;
            starsColors[i3 + 1] = 0.9 + Math.random() * 0.1;
            starsColors[i3 + 2] = 1.0;
        } else if (temperature > 0.6) {
            starsColors[i3] = 1.0;
            starsColors[i3 + 1] = 1.0;
            starsColors[i3 + 2] = 1.0;
        } else if (temperature > 0.3) {
            starsColors[i3] = 1.0;
            starsColors[i3 + 1] = 1.0;
            starsColors[i3 + 2] = 0.8 + Math.random() * 0.2;
        } else {
            starsColors[i3] = 1.0;
            starsColors[i3 + 1] = 0.6 + Math.random() * 0.3;
            starsColors[i3 + 2] = 0.4 + Math.random() * 0.2;
        }
    }

    starsGeometry.setAttribute('position', new THREE.BufferAttribute(starsPositions, 3));
    starsGeometry.setAttribute('size', new THREE.BufferAttribute(starsSizes, 1));
    starsGeometry.setAttribute('color', new THREE.BufferAttribute(starsColors, 3));

    const starsMaterial = new THREE.ShaderMaterial({
        uniforms: { time: { value: 0 } },
        vertexShader: `
            attribute float size;
            attribute vec3 color;
            varying vec3 vColor;
            uniform float time;
            
            void main() {
                vColor = color;
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                float twinkle = sin(time * 2.0 + position.x * 10.0) * 0.1 + 1.0;
                gl_PointSize = size * twinkle * (150.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            varying vec3 vColor;
            
            void main() {
                vec2 center = gl_PointCoord - vec2(0.5);
                float dist = length(center);
                if (dist > 0.5) discard;
                float alpha = smoothstep(0.5, 0.0, dist);
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
    viewer.scene.add(starfield);
    viewer.scene.userData.starfield = starfield;
}

function createBackgroundStar(viewer) {
    const textureLoader = new THREE.TextureLoader();

    // Load sun texture
    const sunTexture = textureLoader.load('../textures/2k_sun.jpg');

    const starGeometry = new THREE.SphereGeometry(3, 32, 32);
    const starMaterial = new THREE.MeshBasicMaterial({
        map: sunTexture,
        transparent: true,
        opacity: 1.0
    });

    const coronaGeometry = new THREE.SphereGeometry(4, 32, 32);
    const coronaMaterial = new THREE.MeshBasicMaterial({
        color: 0xff8844,
        transparent: true,
        opacity: 0.2
    });

    viewer.star = new THREE.Group();
    const starCore = new THREE.Mesh(starGeometry, starMaterial);
    const corona = new THREE.Mesh(coronaGeometry, coronaMaterial);

    viewer.star.add(starCore);
    viewer.star.add(corona);
    viewer.star.position.set(-25, 0, 0);
    viewer.scene.add(viewer.star);
}

// Reuse texture generation from app.js
function generateRealisticTexture(planetData) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext('2d');

    const radius = planetData.radius || 1;
    const earthRadius = 6371;
    const relativeSize = radius / earthRadius;
    let planetType = determinePlanetType(relativeSize);
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

    if (relativeSize > 0.5) {
        addAtmosphericGlow(context);
    }

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
    const types = ['rocky_world', 'ice_world', 'desert_world', 'ocean_world'];
    return types[Math.floor(Math.random() * types.length)];
}

function createGasGiantTexture(context, gradient) {
    const colors = ['#ff7f00', '#ffb366', '#ffd9b3', '#fff2e6', '#e6ccb3'];
    for (let i = 0; i < 256; i += 20) {
        const color = colors[Math.floor(Math.random() * colors.length)];
        context.fillStyle = color;
        context.fillRect(0, i, 256, 20 + Math.random() * 10);
    }
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
    '2k_earth_daymap.jpg',
    '2k_jupiter.jpg',
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
            console.log(`Loading texture: ${texturePath} for planet ${planetData.name}`);
            return textureLoader.load(
                texturePath,
                (texture) => {
                    console.log(`✅ Successfully loaded texture for ${planetData.name}`);
                },
                undefined, // onProgress
                (error) => {
                    console.warn(`Failed to load texture ${texturePath} for ${planetData.name}, using fallback`);
                    return generateRealisticTexture(planetData);
                }
            );
        } else {
            console.warn(`Texture ${planetData.texture} not found in available textures for ${planetData.name}`);
        }
    }

    // If no texture or texture doesn't exist, assign random one from exoplanet textures (excluding Earth/Jupiter)
    const exoplanetTextures = availableTextures.filter(t => !t.includes('2k_'));
    const randomTexture = exoplanetTextures[Math.floor(Math.random() * exoplanetTextures.length)];
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
    const baseSize = planetSize;
    const radius = planetData.radius || 6371;
    const earthRadius = 6371;
    const scaleFactor = Math.min(Math.max(radius / earthRadius, 0.3), 5);
    const actualSize = baseSize * scaleFactor;

    const geometry = new THREE.SphereGeometry(actualSize, 64, 64);
    const texture = loadPlanetTexture(planetData);
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
    const inclinationDegrees = planetData.ellipticalOrbit?.inclination || 0;
    const inclinationRadians = (90 - inclinationDegrees) * (Math.PI / 180);
    const axisLength = planetSize * 1.8;

    const axisGeometry = new THREE.BufferGeometry();
    const axisVertices = new Float32Array([
        0, -axisLength, 0,
        0, axisLength, 0
    ]);
    axisGeometry.setAttribute('position', new THREE.BufferAttribute(axisVertices, 3));

    const axisMaterial = new THREE.LineBasicMaterial({
        color: 0x00ffff,
        linewidth: 3,
        transparent: true,
        opacity: 0.8
    });

    const axisLine = new THREE.Line(axisGeometry, axisMaterial);
    axisLine.rotation.x = inclinationRadians;
    
    const axisGroup = new THREE.Group();
    axisGroup.add(axisLine);
    axisGroup.rotation.x = inclinationRadians;
    axisGroup.userData.inclinationDegrees = inclinationDegrees;

    return axisGroup;
}

function showPlanet(viewer, index) {
    if (index < 0 || index >= viewer.availablePlanets.length) return;

    if (viewer.planetMesh) {
        viewer.scene.remove(viewer.planetMesh);
        viewer.planetMesh.geometry.dispose();
        viewer.planetMesh.material.dispose();
    }

    if (viewer.rotationAxisLine) {
        viewer.scene.remove(viewer.rotationAxisLine);
        viewer.rotationAxisLine.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
        viewer.rotationAxisLine = null;
    }

    viewer.currentPlanetIndex = index;
    viewer.currentPlanet = viewer.availablePlanets[index];

    viewer.planetMesh = createPlanet(viewer.currentPlanet);
    viewer.scene.add(viewer.planetMesh);

    const planetActualSize = viewer.planetMesh.geometry.parameters.radius;
    viewer.rotationAxisLine = createRotationAxis(viewer.currentPlanet, planetActualSize);
    viewer.scene.add(viewer.rotationAxisLine);

    updatePlanetInfo(viewer);
    updateNavigation(viewer);

    // Entrance animation
    viewer.planetMesh.scale.set(0, 0, 0);
    const targetScale = new THREE.Vector3(1, 1, 1);
    function animateEntrance() {
        viewer.planetMesh.scale.lerp(targetScale, 0.1);
        if (viewer.planetMesh.scale.length() < 0.99) {
            requestAnimationFrame(animateEntrance);
        }
    }
    animateEntrance();
}

function updatePlanetInfo(viewer) {
    if (!viewer.currentPlanet) return;

    const side = viewer.side;

    // Safe element update helper
    const safeUpdate = (id, value) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    };

    safeUpdate(`${side}-planet-name`, viewer.currentPlanet.name);
    safeUpdate(`${side}-type`, viewer.currentPlanet.type || 'Unknown');
    safeUpdate(`${side}-system`, viewer.currentPlanet.system || 'Unknown');

    const distance = viewer.currentPlanet.distance ||
        `${(viewer.currentPlanet.ellipticalOrbit.semiMajorAxis * 149.6).toFixed(2)} million km`;
    safeUpdate(`${side}-distance`, distance);

    safeUpdate(`${side}-mission`, viewer.currentPlanet.mission || 'Unknown');
    safeUpdate(`${side}-status`, viewer.currentPlanet.status || 'Unknown');

    const confidenceText = viewer.currentPlanet.confidence ?
        (viewer.currentPlanet.confidence * 100).toFixed(1) + '%' : 'N/A';
    safeUpdate(`${side}-confidence`, confidenceText);

    const periodText = viewer.currentPlanet.ellipticalOrbit.period.toFixed(3) + ' days';
    safeUpdate(`${side}-period`, periodText);

    const radiusKm = viewer.currentPlanet.radius.toLocaleString();
    safeUpdate(`${side}-radius`, `${radiusKm} km`);
    safeUpdate(`${side}-id`, viewer.currentPlanet.id);

    // Update habitability metrics panel
    updateHabitabilityPanel(viewer);
}

function updateHabitabilityPanel(viewer) {
    const side = viewer.side;
    const planet = viewer.currentPlanet;

    // Update planet name in hab panel
    const habNameElement = document.getElementById(`${side}-hab-name`);
    if (habNameElement) {
        habNameElement.textContent = planet.name || '-';
    }

    // Calculate mock values if not present
    let esiValue = planet.esi;
    let hiValue = planet.habitabilityIndex;
    let tempValue = planet.temperature;

    // MOCK DATA: Calculate temporary values based on planet properties
    if (esiValue === undefined || esiValue === null) {
        esiValue = calculateMockESI(planet);
    }
    if (hiValue === undefined || hiValue === null) {
        hiValue = calculateMockHI(planet);
    }
    if (tempValue === undefined || tempValue === null) {
        tempValue = calculateMockTemperature(planet);
    }

    // Update ESI
    const esiValueElement = document.getElementById(`${side}-esi-value`);
    const esiBarElement = document.getElementById(`${side}-esi-bar`);

    if (esiValue !== null) {
        esiValueElement.textContent = (esiValue * 100).toFixed(0) + '%';
        updateProgressBar(esiBarElement, esiValue);
    } else {
        esiValueElement.textContent = 'N/A';
        updateProgressBar(esiBarElement, 0);
    }

    // Update HI (Habitability Index)
    const hiValueElement = document.getElementById(`${side}-hi-value`);
    const hiBarElement = document.getElementById(`${side}-hi-bar`);

    if (hiValue !== null) {
        hiValueElement.textContent = (hiValue * 100).toFixed(0) + '%';
        updateProgressBar(hiBarElement, hiValue);
    } else {
        hiValueElement.textContent = 'N/A';
        updateProgressBar(hiBarElement, 0);
    }

    // Update Temperature
    const tempValueElement = document.getElementById(`${side}-temp-value`);

    if (tempValue !== null) {
        tempValueElement.textContent = `${Math.round(tempValue)} K`;
    } else {
        tempValueElement.textContent = 'N/A';
    }
}

// MOCK DATA FUNCTIONS - Remove these once real data is available
function calculateMockTemperature(planet) {
    // Earth reference values
    if (planet.name === 'Earth') return 288;
    if (planet.name === 'Jupiter') return 165;

    // Calculate based on orbital distance (simplified Stefan-Boltzmann)
    const semiMajorAxis = planet.ellipticalOrbit?.semiMajorAxis || 1.0;
    const temp = 288 * Math.pow(semiMajorAxis, -0.5);
    return Math.round(temp);
}

function calculateMockESI(planet) {
    // Earth reference
    if (planet.name === 'Earth') return 1.0;
    if (planet.name === 'Jupiter') return 0.15;

    // Calculate based on radius and orbital distance
    const earthRadius = 6371;
    const radiusRatio = planet.radius / earthRadius;
    const semiMajorAxis = planet.ellipticalOrbit?.semiMajorAxis || 1.0;
    const period = planet.ellipticalOrbit?.period || 365;

    // Simplified ESI calculation
    const radiusScore = 1 - Math.abs((radiusRatio - 1) / (radiusRatio + 1));
    const distanceScore = 1 - Math.abs((semiMajorAxis - 1) / (semiMajorAxis + 1));
    const periodScore = 1 - Math.abs((period - 365.25) / (period + 365.25));

    const esi = Math.pow(radiusScore * distanceScore * periodScore, 1/3);
    return Math.max(0, Math.min(1, esi));
}

function calculateMockHI(planet) {
    // Earth reference
    if (planet.name === 'Earth') return 1.0;
    if (planet.name === 'Jupiter') return 0.05;

    // Calculate based on radius and temperature
    const earthRadius = 6371;
    const radiusRatio = planet.radius / earthRadius;
    const temp = calculateMockTemperature(planet);

    // Radius score (optimal: 0.5 - 1.5 Earth radii)
    const radiusScore = Math.max(0, 1 - Math.abs(radiusRatio - 1.0) / 0.5);

    // Temperature score (optimal: 228 - 348 K, Earth = 288 K)
    const tempScore = Math.max(0, 1 - Math.abs(temp - 288) / 60);

    // Equal weighting
    const hi = (radiusScore + tempScore) / 2;
    return Math.max(0, Math.min(1, hi));
}

function updateProgressBar(barElement, value) {
    if (!barElement) return;

    // Reset bar first
    barElement.style.width = '0%';
    barElement.className = 'hab-bar';

    // Determine color class based on value (0-1 scale)
    if (value > 0.7) {
        barElement.classList.add('high');
    } else if (value > 0.4) {
        barElement.classList.add('medium');
    } else {
        barElement.classList.add('low');
    }

    // Animate bar width after a short delay
    setTimeout(() => {
        barElement.style.width = (value * 100) + '%';
    }, 50);
}

function updateNavigation(viewer) {
    const side = viewer.side;
    document.getElementById(`${side}-counter`).textContent = viewer.currentPlanetIndex + 1;
    document.getElementById(`${side}-total`).textContent = viewer.availablePlanets.length;

    const prevBtn = document.getElementById(`${side}-prev`);
    const nextBtn = document.getElementById(`${side}-next`);

    prevBtn.disabled = viewer.currentPlanetIndex === 0;
    nextBtn.disabled = viewer.currentPlanetIndex === viewer.availablePlanets.length - 1;
}

function nextPlanet(viewer) {
    if (viewer.currentPlanetIndex < viewer.availablePlanets.length - 1) {
        showPlanet(viewer, viewer.currentPlanetIndex + 1);
    }
}

function previousPlanet(viewer) {
    if (viewer.currentPlanetIndex > 0) {
        showPlanet(viewer, viewer.currentPlanetIndex - 1);
    }
}

function toggleAutoRotate(viewer) {
    viewer.autoRotate = !viewer.autoRotate;
    const button = document.getElementById(`${viewer.side}-auto-rotate`);

    if (viewer.autoRotate) {
        button.classList.add('active');
    } else {
        button.classList.remove('active');
    }
}

function resetCamera(viewer) {
    viewer.camera.position.set(0, 0, cameraDistance);
    viewer.controls.target.set(0, 0, 0);
    viewer.controls.update();
}

function setupEventListeners() {
    // Left viewer controls
    document.getElementById('left-prev').addEventListener('click', () => previousPlanet(leftViewer));
    document.getElementById('left-next').addEventListener('click', () => nextPlanet(leftViewer));
    document.getElementById('left-auto-rotate').addEventListener('click', () => toggleAutoRotate(leftViewer));
    document.getElementById('left-reset').addEventListener('click', () => resetCamera(leftViewer));
    document.getElementById('left-toggle-info').addEventListener('click', () => toggleInfo(leftViewer));

    // Right viewer controls
    document.getElementById('right-prev').addEventListener('click', () => previousPlanet(rightViewer));
    document.getElementById('right-next').addEventListener('click', () => nextPlanet(rightViewer));
    document.getElementById('right-auto-rotate').addEventListener('click', () => toggleAutoRotate(rightViewer));
    document.getElementById('right-reset').addEventListener('click', () => resetCamera(rightViewer));
    document.getElementById('right-toggle-info').addEventListener('click', () => toggleInfo(rightViewer));

    // Category dropdowns
    document.getElementById('left-category').addEventListener('change', (e) => changePlanetCategory(leftViewer, e.target.value));
    document.getElementById('right-category').addEventListener('change', (e) => changePlanetCategory(rightViewer, e.target.value));

    // Shared controls
    document.getElementById('sync-rotation').addEventListener('click', syncRotation);
    document.getElementById('reset-both').addEventListener('click', resetBothCameras);

    // Focus tracking
    document.getElementById('left-viewer').addEventListener('click', () => setFocus('left'));
    document.getElementById('right-viewer').addEventListener('click', () => setFocus('right'));

    // Search functionality
    setupSearch(leftViewer);
    setupSearch(rightViewer);

    // Keyboard navigation
    document.addEventListener('keydown', handleKeyboard);

    // Window resize
    window.addEventListener('resize', onWindowResize);

    // Cleanup on unload
    window.addEventListener('beforeunload', cleanup);

    // Habitability panel toggle buttons
    document.getElementById('left-hab-toggle').addEventListener('click', () => toggleHabPanel('left'));
    document.getElementById('right-hab-toggle').addEventListener('click', () => toggleHabPanel('right'));
}

function toggleHabPanel(side) {
    const panel = document.getElementById(`${side}-hab-panel`);
    if (panel) {
        panel.classList.toggle('hidden');

        // Save state to localStorage
        const isHidden = panel.classList.contains('hidden');
        localStorage.setItem(`${side}-hab-panel-hidden`, isHidden);

        // Update button text
        const button = document.getElementById(`${side}-hab-toggle`);
        if (button) {
            button.textContent = isHidden ? '+' : '×';
        }
    }
}

// Restore hab panel state from localStorage on load
function restoreHabPanelStates() {
    ['left', 'right'].forEach(side => {
        const isHidden = localStorage.getItem(`${side}-hab-panel-hidden`) === 'true';
        if (isHidden) {
            const panel = document.getElementById(`${side}-hab-panel`);
            const button = document.getElementById(`${side}-hab-toggle`);
            if (panel) panel.classList.add('hidden');
            if (button) button.textContent = '+';
        }
    });
}

function toggleInfo(viewer) {
    const infoPanel = document.getElementById(`${viewer.side}-info`);
    infoPanel.classList.toggle('collapsed');

    const button = document.getElementById(`${viewer.side}-toggle-info`);
    if (infoPanel.classList.contains('collapsed')) {
        button.textContent = 'Show Details';
    } else {
        button.textContent = 'Hide Details';
    }
}

function setupSearch(viewer) {
    const searchSelect = document.getElementById(`${viewer.side}-search`);

    // fill dropdown with planets
    function populateSelect() {
        searchSelect.innerHTML = '<option disabled selected style="color: white;">Select a planet...</option>';
        planets.forEach((planet, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = `${planet.name || 'Unnamed'} (${planet.system || 'Unknown'})`;
            searchSelect.appendChild(option);
        });
    }
    populateSelect();

    // When a planet is chosen
    searchSelect.addEventListener('change', (e) => {
        const selectedIndex = parseInt(e.target.value, 10);
        if (!isNaN(selectedIndex)) {
            showPlanet(viewer, selectedIndex);
        }
    });

}


function setFocus(side) {
    lastFocusedViewer = side;
    document.getElementById('left-viewer').classList.remove('focused');
    document.getElementById('right-viewer').classList.remove('focused');
    document.getElementById(`${side}-viewer`).classList.add('focused');
}

function handleKeyboard(event) {
    const viewer = lastFocusedViewer === 'left' ? leftViewer : rightViewer;

    switch (event.code) {
        case 'ArrowLeft':
            event.preventDefault();
            previousPlanet(viewer);
            break;
        case 'ArrowRight':
            event.preventDefault();
            nextPlanet(viewer);
            break;
        case 'Space':
            event.preventDefault();
            toggleAutoRotate(viewer);
            break;
        case 'KeyR':
            event.preventDefault();
            resetCamera(viewer);
            break;
        case 'KeyI':
            event.preventDefault();
            toggleInfo(viewer);
            break;
    }
}

function syncRotation() {
    const button = document.getElementById('sync-rotation');

    // Toggle both to the same state
    const newState = !leftViewer.autoRotate;
    leftViewer.autoRotate = newState;
    rightViewer.autoRotate = newState;

    // Update button states
    const leftBtn = document.getElementById('left-auto-rotate');
    const rightBtn = document.getElementById('right-auto-rotate');

    if (newState) {
        leftBtn.classList.add('active');
        rightBtn.classList.add('active');
        button.classList.add('active');
    } else {
        leftBtn.classList.remove('active');
        rightBtn.classList.remove('active');
        button.classList.remove('active');
    }
}

function resetBothCameras() {
    resetCamera(leftViewer);
    resetCamera(rightViewer);
}

function onWindowResize() {
    // Left viewer
    const leftWidth = leftViewer.containerElement.clientWidth;
    const leftHeight = leftViewer.containerElement.clientHeight;
    leftViewer.camera.aspect = leftWidth / leftHeight;
    leftViewer.camera.updateProjectionMatrix();
    leftViewer.renderer.setSize(leftWidth, leftHeight);

    // Right viewer
    const rightWidth = rightViewer.containerElement.clientWidth;
    const rightHeight = rightViewer.containerElement.clientHeight;
    rightViewer.camera.aspect = rightWidth / rightHeight;
    rightViewer.camera.updateProjectionMatrix();
    rightViewer.renderer.setSize(rightWidth, rightHeight);
}

function cleanup() {
    function cleanupViewer(viewer) {
        viewer.renderer.dispose();
        viewer.scene.traverse((object) => {
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
                if (object.material.map) object.material.map.dispose();
                object.material.dispose();
            }
        });
    }

    cleanupViewer(leftViewer);
    cleanupViewer(rightViewer);
}

function animate() {
    requestAnimationFrame(animate);

    // Animate left viewer
    if (leftViewer.planetMesh && leftViewer.currentPlanet) {
        const orbitalPeriodDays = leftViewer.currentPlanet.ellipticalOrbit?.period || 365;
        const timeAccelerationBase = 3600;
        const radiansPerEarthDay = (2 * Math.PI) / orbitalPeriodDays;
        const framesPerSecond = 60;
        const secondsPerDay = 86400;
        const radiansPerFrame = (radiansPerEarthDay / secondsPerDay) * (timeAccelerationBase / framesPerSecond);
        const autoRotateMultiplier = leftViewer.autoRotate ? 100 : 1;
        const finalRotationSpeed = radiansPerFrame * autoRotateMultiplier;

        leftViewer.planetMesh.rotation.y += finalRotationSpeed;
        if (leftViewer.rotationAxisLine) {
            leftViewer.rotationAxisLine.rotation.y = leftViewer.planetMesh.rotation.y;
        }
    }

    // Animate right viewer
    if (rightViewer.planetMesh && rightViewer.currentPlanet) {
        const orbitalPeriodDays = rightViewer.currentPlanet.ellipticalOrbit?.period || 365;
        const timeAccelerationBase = 3600;
        const radiansPerEarthDay = (2 * Math.PI) / orbitalPeriodDays;
        const framesPerSecond = 60;
        const secondsPerDay = 86400;
        const radiansPerFrame = (radiansPerEarthDay / secondsPerDay) * (timeAccelerationBase / framesPerSecond);
        const autoRotateMultiplier = rightViewer.autoRotate ? 100 : 1;
        const finalRotationSpeed = radiansPerFrame * autoRotateMultiplier;

        rightViewer.planetMesh.rotation.y += finalRotationSpeed;
        if (rightViewer.rotationAxisLine) {
            rightViewer.rotationAxisLine.rotation.y = rightViewer.planetMesh.rotation.y;
        }
    }

    // Animate stars
    if (leftViewer.star) {
        leftViewer.star.children[1].rotation.y += 0.002;
        leftViewer.star.children[1].rotation.x += 0.001;
    }
    if (rightViewer.star) {
        rightViewer.star.children[1].rotation.y += 0.002;
        rightViewer.star.children[1].rotation.x += 0.001;
    }

    // Animate starfields
    const time = Date.now() * 0.001;
    if (leftViewer.scene.userData.starfield) {
        leftViewer.scene.userData.starfield.material.uniforms.time.value = time;
    }
    if (rightViewer.scene.userData.starfield) {
        rightViewer.scene.userData.starfield.material.uniforms.time.value = time;
    }

    // Update controls and render
    leftViewer.controls.update();
    leftViewer.renderer.render(leftViewer.scene, leftViewer.camera);

    rightViewer.controls.update();
    rightViewer.renderer.render(rightViewer.scene, rightViewer.camera);
}
