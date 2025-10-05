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
    containerElement: null
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
    containerElement: null
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
    if (planets.length > 0) {
        showPlanet(leftViewer, 0);
    }
    if (planets.length > 1) {
        showPlanet(rightViewer, 1);
    }
    
    updateLoadingText("Initializing controls...");
    setupEventListeners();
    
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
            try {
                const fallbackResponse = await fetch('./exoplanetData.json');
                const fallbackData = await fallbackResponse.json();
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
                    mass: planet.mass,
                    discoveryYear: planet.discoveryYear,
                    mission: planet.mission,
                    status: planet.status,
                    confidence: planet.confidence,
                    inHabitableZone: planet.inHabitableZone
                }));
            } catch (fallbackError) {
                console.error('Error loading fallback data:', fallbackError);
                planets = [];
            }
        }
    }
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
    
    const poleGeometry = new THREE.SphereGeometry(planetSize * 0.08, 16, 16);
    const poleMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.9
    });
    
    const northPole = new THREE.Mesh(poleGeometry, poleMaterial);
    const southPole = new THREE.Mesh(poleGeometry, poleMaterial.clone());
    northPole.position.set(0, axisLength, 0);
    southPole.position.set(0, -axisLength, 0);
    
    const axisGroup = new THREE.Group();
    axisGroup.add(axisLine);
    axisGroup.add(northPole);
    axisGroup.add(southPole);
    axisGroup.rotation.x = inclinationRadians;
    axisGroup.userData.inclinationDegrees = inclinationDegrees;
    
    return axisGroup;
}

function showPlanet(viewer, index) {
    if (index < 0 || index >= planets.length) return;

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
    viewer.currentPlanet = planets[index];

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
    document.getElementById(`${side}-planet-name`).textContent = viewer.currentPlanet.name;
    document.getElementById(`${side}-type`).textContent = viewer.currentPlanet.type || 'Unknown';
    document.getElementById(`${side}-system`).textContent = viewer.currentPlanet.system || 'Unknown';

    const distance = viewer.currentPlanet.distance ||
        `${(viewer.currentPlanet.ellipticalOrbit.semiMajorAxis * 149.6).toFixed(2)} million km`;
    document.getElementById(`${side}-distance`).textContent = distance;

    document.getElementById(`${side}-mission`).textContent = viewer.currentPlanet.mission || 'Unknown';
    document.getElementById(`${side}-status`).textContent = viewer.currentPlanet.status || 'Unknown';
    document.getElementById(`${side}-confidence`).textContent = viewer.currentPlanet.confidence ?
        (viewer.currentPlanet.confidence * 100).toFixed(1) + '%' : 'N/A';
    document.getElementById(`${side}-period`).textContent =
        viewer.currentPlanet.ellipticalOrbit.period.toFixed(3) + ' days';

    const radiusKm = viewer.currentPlanet.radius.toLocaleString();
    document.getElementById(`${side}-radius`).textContent = `${radiusKm} km`;
    document.getElementById(`${side}-id`).textContent = viewer.currentPlanet.id;
}

function updateNavigation(viewer) {
    const side = viewer.side;
    document.getElementById(`${side}-counter`).textContent = viewer.currentPlanetIndex + 1;
    document.getElementById(`${side}-total`).textContent = planets.length;
    
    const prevBtn = document.getElementById(`${side}-prev`);
    const nextBtn = document.getElementById(`${side}-next`);
    
    prevBtn.disabled = viewer.currentPlanetIndex === 0;
    nextBtn.disabled = viewer.currentPlanetIndex === planets.length - 1;
}

function nextPlanet(viewer) {
    if (viewer.currentPlanetIndex < planets.length - 1) {
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
    const searchInput = document.getElementById(`${viewer.side}-search`);
    
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        if (!query) return;
        
        // Find matching planets
        const matches = planets.filter((planet, index) => {
            return planet.name.toLowerCase().includes(query) || 
                   planet.id.toLowerCase().includes(query) ||
                   planet.system.toLowerCase().includes(query);
        });
        
        // If only one match, show it
        if (matches.length === 1) {
            const index = planets.indexOf(matches[0]);
            showPlanet(viewer, index);
            searchInput.value = '';
        }
    });
    
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const query = e.target.value.toLowerCase();
            const match = planets.find((planet) => {
                return planet.name.toLowerCase().includes(query) || 
                       planet.id.toLowerCase().includes(query);
            });
            
            if (match) {
                const index = planets.indexOf(match);
                showPlanet(viewer, index);
                searchInput.value = '';
            }
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
    
    switch(event.code) {
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
