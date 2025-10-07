let scene, camera, renderer, controls;
let exoplanets = [];
let exoplanetData = [];
let raycaster, mouse;
let habitableZoneVisible = true;
let habitableZoneObjects = [];
let currentSystem = 'overview';
let starSystems = {};
let currentStar = null;
let cameraAnimating = false;
let animationId = null;
let followingPlanet = null;
let cameraOffset = null;

async function init() {
    cameraOffset = new THREE.Vector3();

    await loadExoplanetData();

    groupPlanetsBySystem();

    setupScene();
    setupCamera();
    setupRenderer();
    setupControls();
    setupInteraction();

    populateSystemSelector();

    showSystem('overview');
    animate();
}

async function loadExoplanetData() {
    try {
        const response = await fetch('exoplanetData.json');
        exoplanetData = await response.json();
    } catch (error) {
        console.error('Error loading exoplanet data:', error);
    }
}

function groupPlanetsBySystem() {
    starSystems = {};
    
    exoplanetData.forEach(planet => {
        const systemName = planet.system;
        if (!starSystems[systemName]) {
            starSystems[systemName] = {
                name: systemName,
                planets: [],
                distance: planet.distance
            };
        }
        starSystems[systemName].planets.push(planet);
    });
    
    console.log('Star systems:', starSystems);
}

function populateSystemSelector() {
    const selector = document.getElementById('system-select');
    
    selector.innerHTML = '<option value="overview">🌌 Galaxy Overview</option>';
    
    Object.keys(starSystems).forEach(systemName => {
        const option = document.createElement('option');
        option.value = systemName;
        option.textContent = `⭐ ${systemName} (${starSystems[systemName].planets.length} planets)`;
        selector.appendChild(option);
    });
    
    selector.addEventListener('change', (e) => {
        showSystem(e.target.value);
    });
}

function setupScene() {
    scene = new THREE.Scene();
    
    const starGeometry = new THREE.BufferGeometry();
    const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 2 });
    
    const starVertices = [];
    for (let i = 0; i < 10000; i++) {
        const x = (Math.random() - 0.5) * 2000;
        const y = (Math.random() - 0.5) * 2000;
        const z = (Math.random() - 0.5) * 2000;
        starVertices.push(x, y, z);
    }
    
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);
}

function setupCamera() {
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 50, 100);
}

function setupRenderer() {
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000011);
    document.getElementById('scene-container').appendChild(renderer.domElement);
    
    window.addEventListener('resize', onWindowResize, false);
}

function setupLighting() {
    const ambientLight = new THREE.AmbientLight(0x404040, 0.3);
    scene.add(ambientLight);
    
    const pointLight = new THREE.PointLight(0xffffff, 1, 0);
    pointLight.position.set(0, 0, 0);
    scene.add(pointLight);
}

function createHabitableZone() {
    const innerRadius = 45;
    const outerRadius = 85;
    const habitableZoneGeometry = new THREE.RingGeometry(innerRadius, outerRadius, 64);
    const habitableZoneMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x00ff88,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.15
    });
    
    const habitableZone = new THREE.Mesh(habitableZoneGeometry, habitableZoneMaterial);
    habitableZone.rotation.x = Math.PI / 2;
    scene.add(habitableZone);
    habitableZoneObjects.push(habitableZone);
    
    const innerBoundary = new THREE.RingGeometry(innerRadius - 1, innerRadius + 1, 64);
    const outerBoundary = new THREE.RingGeometry(outerRadius - 1, outerRadius + 1, 64);
    
    const boundaryMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x00ff88,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.6
    });
    
    const innerRing = new THREE.Mesh(innerBoundary, boundaryMaterial);
    const outerRing = new THREE.Mesh(outerBoundary, boundaryMaterial);
    
    innerRing.rotation.x = Math.PI / 2;
    outerRing.rotation.x = Math.PI / 2;
    
    scene.add(innerRing);
    scene.add(outerRing);
    habitableZoneObjects.push(innerRing, outerRing);
}

function createAtmosphere(planetRadius, planetType) {
    const atmosphereRadius = planetRadius * 1.2;
    const atmosphereGeometry = new THREE.SphereGeometry(atmosphereRadius, 32, 32);
    
    let atmosphereColor, opacity;
    
    switch(planetType) {
        case 'Super-Earth':
        case 'Rocky':
            atmosphereColor = 0x87ceeb; 
            opacity = 0.3;
            break;
        case 'Ocean World':
            atmosphereColor = 0x4169e1;
            opacity = 0.4;
            break;
        case 'Hot Jupiter':
        case 'Gas Giant':
            atmosphereColor = 0xffa500;
            opacity = 0.5;
            break;
        case 'Sub-Neptune':
        case 'Ice Giant':
            atmosphereColor = 0x00ffff; 
            opacity = 0.3;
            break;
        default:
            atmosphereColor = 0xffffff; 
            opacity = 0.2;
    }
    
    const atmosphereMaterial = new THREE.MeshLambertMaterial({
        color: atmosphereColor,
        transparent: true,
        opacity: opacity,
        side: THREE.BackSide
    });
    
    const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    return atmosphere;
}

function setupControls() {
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 10;
    controls.maxDistance = 500;
}

function setupInteraction() {
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    
    renderer.domElement.addEventListener('click', onMouseClick, false);
    
    document.getElementById('close-info').addEventListener('click', () => {
        document.getElementById('info-panel').classList.add('hidden');
    });
    
    document.getElementById('add-planet-btn').addEventListener('click', addRandomPlanet);
    document.getElementById('comparison-mode-btn').addEventListener('click', showSizeComparison);
    document.getElementById('close-comparison').addEventListener('click', () => {
        document.getElementById('comparison-panel').classList.add('hidden');
    });
    
    document.getElementById('habitable-zone-btn').addEventListener('click', toggleHabitableZone);
    
    document.getElementById('timeline-btn').addEventListener('click', showTimeline);
    document.getElementById('close-timeline').addEventListener('click', () => {
        document.getElementById('timeline-panel').classList.add('hidden');
    });
    document.getElementById('planet-filter').addEventListener('change', filterPlanets);
    
    document.getElementById('mission-filter').addEventListener('change', filterPlanets);
    document.getElementById('status-filter').addEventListener('change', filterPlanets);
    
    document.getElementById('reset-view-btn').addEventListener('click', resetSystemView);
    
    document.getElementById('education-mode-btn').addEventListener('click', showEducationMode);
    document.getElementById('close-education').addEventListener('click', () => {
        document.getElementById('education-panel').classList.add('hidden');
    });
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            switchEducationTab(e.target.dataset.tab);
        });
    });
}

function generateRandomTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext('2d');
    
    const baseHue = Math.random() * 360;
    const baseColor = `hsl(${baseHue}, 70%, 50%)`;
    const accentColor = `hsl(${(baseHue + 60) % 360}, 60%, 40%)`;
    
    context.fillStyle = baseColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    context.fillStyle = accentColor;
    context.globalAlpha = 0.3;
    
    for (let i = 0; i < 15; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const radius = Math.random() * 20 + 5;
        
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
    }
    
    if (Math.random() > 0.6) {
        context.globalAlpha = 0.2;
        for (let i = 0; i < canvas.height; i += 8) {
            context.fillRect(0, i, canvas.width, 4);
        }
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.needsUpdate = true;
    return texture;
}

function showSystem(systemName) {
    clearScene();
    
    currentSystem = systemName;
    
    if (systemName === 'overview') {
        createGalaxyOverview();
    } else {
        createStarSystem(systemName);
    }
    
    resetCamera();
    updateUIContext();
}

function clearScene() {
    followingPlanet = null;
    
    exoplanets.forEach(planet => {
        scene.remove(planet);
        if (planet.userData.atmosphere) {
            scene.remove(planet.userData.atmosphere);
        }
    });
    exoplanets = [];
    
    habitableZoneObjects.forEach(obj => {
        scene.remove(obj);
    });
    habitableZoneObjects = [];
    
    if (currentStar) {
        scene.remove(currentStar);
        currentStar = null;
    }
}

function createGalaxyOverview() {
    Object.keys(starSystems).forEach((systemName, index) => {
        const system = starSystems[systemName];
        
        const angle = (index / Object.keys(starSystems).length) * Math.PI * 2;
        const distance = 100 + (index * 50);
        const x = Math.cos(angle) * distance;
        const z = Math.sin(angle) * distance;
        const y = (Math.random() - 0.5) * 50;
        
        const starGeometry = new THREE.SphereGeometry(3, 16, 16);
        const starMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xffaa44,
            emissive: 0xffaa44,
            emissiveIntensity: 0.3
        });
        
        const systemStar = new THREE.Mesh(starGeometry, starMaterial);
        systemStar.position.set(x, y, z);
        systemStar.userData = { 
            type: 'system',
            systemName: systemName,
            planetCount: system.planets.length,
            distance: system.distance
        };
        
        scene.add(systemStar);
        exoplanets.push(systemStar); 
        
        createSystemLabel(systemName, x, y + 10, z);
    });
}

function createStarSystem(systemName) {
    const system = starSystems[systemName];
    if (!system) return;
    
    createCentralStar();
    
    createHabitableZone();
    
    system.planets.forEach((planet, index) => {
        createPlanetInSystem(planet, index, system.planets.length);
    });
}

function createCentralStar() {
    const starGeometry = new THREE.SphereGeometry(8, 32, 32);
    const starMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffff00,
        emissive: 0xffff00,
        emissiveIntensity: 0.6
    });
    
    currentStar = new THREE.Mesh(starGeometry, starMaterial);
    currentStar.position.set(0, 0, 0);
    scene.add(currentStar);
}

function createPlanetInSystem(planet, index, totalPlanets) {
    const angle = (index / totalPlanets) * Math.PI * 2;
    
    let baseDistance = 20;
    let distanceIncrement = totalPlanets > 5 ? 15 : 20;
    if (totalPlanets > 7) {
        baseDistance = 15;
        distanceIncrement = 12;
    }
    
    const distance = baseDistance + (index * distanceIncrement);
    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance;
    const y = (Math.random() - 0.5) * 3; 
    
    let radius = 1;
    if (planet.type.includes('Jupiter')) radius = 4;
    else if (planet.type.includes('Super-Earth')) radius = 1.8;
    else if (planet.type.includes('Sub-Neptune')) radius = 2.5;
    else if (planet.type === 'Ocean World') radius = 1.3;
    
    const geometry = new THREE.SphereGeometry(radius, 32, 32);
    const texture = generateRandomTexture();
    const material = new THREE.MeshLambertMaterial({ map: texture });
    
    const exoplanet = new THREE.Mesh(geometry, material);
    exoplanet.position.set(x, y, z);
    exoplanet.userData = planet;
    
    if (planet.type.includes('Earth') || planet.type === 'Ocean World' || planet.type.includes('Jupiter')) {
        const atmosphere = createAtmosphere(radius, planet.type);
        atmosphere.position.set(x, y, z);
        scene.add(atmosphere);
        exoplanet.userData.atmosphere = atmosphere;
    }
    
    scene.add(exoplanet);
    exoplanets.push(exoplanet);
    
    const orbitGeometry = new THREE.RingGeometry(distance - 0.5, distance + 0.5, 64);
    const orbitMaterial = new THREE.MeshBasicMaterial({ 
        color: planet.inHabitableZone ? 0x00ff88 : 0x444444,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: planet.inHabitableZone ? 0.4 : 0.2
    });
    const orbit = new THREE.Mesh(orbitGeometry, orbitMaterial);
    orbit.rotation.x = Math.PI / 2;
    scene.add(orbit);
}

function resetCamera() {
    if (currentSystem === 'overview') {
        camera.position.set(0, 100, 200);
        controls.target.set(0, 0, 0);
    } else {
        camera.position.set(0, 30, 80);
        controls.target.set(0, 0, 0);
    }
    controls.update();
}

function createExoplanets() {
    exoplanetData.forEach((planet, index) => {
        const angle = (index / exoplanetData.length) * Math.PI * 2;
        const distance = 20 + (index * 15);
        const x = Math.cos(angle) * distance;
        const z = Math.sin(angle) * distance;
        const y = (Math.random() - 0.5) * 10; 

        let radius = 1;
        if (planet.type.includes('Jupiter')) radius = 3;
        else if (planet.type.includes('Super-Earth')) radius = 1.5;
        else if (planet.type.includes('Sub-Neptune')) radius = 2;
        
        const geometry = new THREE.SphereGeometry(radius, 32, 32);
        const texture = generateRandomTexture();
        const material = new THREE.MeshLambertMaterial({ map: texture });
        
        const exoplanet = new THREE.Mesh(geometry, material);
        exoplanet.position.set(x, y, z);
        exoplanet.userData = planet; 
        
        if (planet.type.includes('Earth') || planet.type === 'Ocean World' || planet.type.includes('Jupiter')) {
            const atmosphere = createAtmosphere(radius, planet.type);
            atmosphere.position.set(x, y, z);
            scene.add(atmosphere);
            exoplanet.userData.atmosphere = atmosphere;
        }
        
        scene.add(exoplanet);
        exoplanets.push(exoplanet);
        
        const orbitGeometry = new THREE.RingGeometry(distance - 0.5, distance + 0.5, 64);
        const orbitMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x444444, 
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.2
        });
        const orbit = new THREE.Mesh(orbitGeometry, orbitMaterial);
        orbit.rotation.x = Math.PI / 2;
        scene.add(orbit);
    });
}

function onMouseClick(event) {
    if (cameraAnimating) return;
    
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    
    const intersects = raycaster.intersectObjects(exoplanets);
    
    if (intersects.length > 0) {
        const selectedObject = intersects[0].object;
        const userData = selectedObject.userData;
        
        if (userData.type === 'system') {
            if (currentSystem === 'overview') {
                document.getElementById('system-select').value = userData.systemName;
                showSystem(userData.systemName);
            }
        } else {
            centerCameraOnPlanet(selectedObject);
            showPlanetInfo(userData);
        }
    }
}

function showPlanetInfo(planetData) {
    document.getElementById('planet-name').textContent = planetData.name;
    document.getElementById('planet-distance').textContent = planetData.distance;
    document.getElementById('planet-type').textContent = planetData.type;
    document.getElementById('planet-system').textContent = planetData.system || 'Unknown';
    
    document.getElementById('planet-mission').textContent = planetData.mission || 'Unknown';
    document.getElementById('planet-status').textContent = getStatusDisplay(planetData.status);
    document.getElementById('planet-confidence').textContent = planetData.confidence ? 
        `${(planetData.confidence * 100).toFixed(1)}%` : 'N/A';
    
    document.getElementById('planet-period').textContent = planetData.orbitalPeriod || 'N/A';
    document.getElementById('planet-depth').textContent = planetData.transitDepth ? 
        planetData.transitDepth.toExponential(2) : 'N/A';
    document.getElementById('planet-duration').textContent = planetData.transitDuration || 'N/A';
    
    const statusSpan = document.getElementById('planet-status');
    const confidenceSpan = document.getElementById('planet-confidence');
    
    switch(planetData.status) {
        case 'confirmed':
            statusSpan.style.color = '#2ecc71';
            break;
        case 'candidate':
            statusSpan.style.color = '#f39c12';
            break;
        case 'false_positive':
            statusSpan.style.color = '#e74c3c';
            break;
        default:
            statusSpan.style.color = '#cccccc';
    }
    
    if (planetData.confidence) {
        if (planetData.confidence > 0.9) {
            confidenceSpan.style.color = '#2ecc71';
        } else if (planetData.confidence > 0.7) {
            confidenceSpan.style.color = '#f39c12';
        } else {
            confidenceSpan.style.color = '#e74c3c';
        }
    }
    
    document.getElementById('info-panel').classList.remove('hidden');
}

function getStatusDisplay(status) {
    switch(status) {
        case 'confirmed': return '✅ Confirmed';
        case 'candidate': return '🤔 Candidate';
        case 'false_positive': return '❌ False Positive';
        default: return 'Unknown';
    }
}

function centerCameraOnPlanet(planet) {
    if (cameraAnimating) return;
    
    cameraAnimating = true;
    
    const planetPosition = planet.position.clone();
    const planetRadius = planet.geometry.parameters.radius;
    
    const distance = Math.max(planetRadius * 8, 15);
    const targetPosition = planetPosition.clone();
    targetPosition.add(new THREE.Vector3(distance, distance * 0.5, distance));
    
    const startPosition = camera.position.clone();
    const startTarget = controls.target.clone();
    
    const duration = 1500; 
    const startTime = Date.now();
    
    function animateCamera() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        const easeProgress = easeInOutCubic(progress);
        
        camera.position.lerpVectors(startPosition, targetPosition, easeProgress);
        
        controls.target.lerpVectors(startTarget, planetPosition, easeProgress);
        controls.update();
        
        if (progress < 1) {
            animationId = requestAnimationFrame(animateCamera);
        } else {
            cameraAnimating = false;
            animationId = null;
            
            followingPlanet = planet;
            cameraOffset.copy(targetPosition).sub(planetPosition);
            
            if (currentSystem !== 'overview') {
                document.getElementById('reset-view-btn').classList.remove('hidden');
            }
        }
    }
    
    animateCamera();
}

function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    
    exoplanets.forEach((planet, index) => {
        planet.rotation.y += 0.01;
        
        if (currentSystem !== 'overview' && planet.userData.type !== 'system') {
            const time = Date.now() * 0.001;
            const systemPlanets = starSystems[currentSystem] ? starSystems[currentSystem].planets : [];
            const planetIndex = systemPlanets.findIndex(p => p.name === planet.userData.name);
            
            if (planetIndex !== -1) {
                let baseDistance = 20;
                let distanceIncrement = systemPlanets.length > 5 ? 15 : 20;
                if (systemPlanets.length > 7) {
                    baseDistance = 15;
                    distanceIncrement = 12;
                }
                
                const distance = baseDistance + (planetIndex * distanceIncrement);
                const speed = 0.3 / (distance * 0.1); 
                const angle = time * speed + (planetIndex / systemPlanets.length) * Math.PI * 2;
                
                planet.position.x = Math.cos(angle) * distance;
                planet.position.z = Math.sin(angle) * distance;
                
                if (planet.userData.atmosphere) {
                    planet.userData.atmosphere.position.copy(planet.position);
                }
            }
        }
    });
    
    if (followingPlanet && !cameraAnimating) {
        const planetPosition = followingPlanet.position.clone();
        const newCameraPosition = planetPosition.clone().add(cameraOffset);
        
        camera.position.copy(newCameraPosition);
        controls.target.copy(planetPosition);
    }
    
    controls.update();
    renderer.render(scene, camera);
}

function generateRandomPlanetData() {
    const planetNames = [
        "Zephyr Prime", "Nova-7", "Titan's Edge", "Stellar Dawn", "Cosmic Ridge",
        "Aurora Beta", "Galaxy's End", "Nebula Point", "Starlight IV", "Vortex Major",
        "Quantum Sphere", "Celestial Harbor", "Binary Dawn", "Photon Valley", "Cosmic Tide",
        "Solar Winds", "Astral Peak", "Gravity Well", "Dark Matter", "Light Speed"
    ];
    
    const planetTypes = ["Rocky", "Super-Earth", "Sub-Neptune", "Hot Jupiter", "Gas Giant", "Ice Giant", "Ocean World"];
    
    const randomName = planetNames[Math.floor(Math.random() * planetNames.length)] + "-" + (Math.floor(Math.random() * 999) + 1);
    const randomType = planetTypes[Math.floor(Math.random() * planetTypes.length)];
    
    let mass;
    if (randomType.includes('Jupiter') || randomType === 'Gas Giant') {
        mass = (Math.random() * 2 + 0.5).toFixed(2) + " Jupiters";
    } else {
        mass = (Math.random() * 8 + 0.5).toFixed(2) + " Earths";
    }
    
    const distance = (Math.random() * 1000 + 10).toFixed(1) + " light-years";
    
    return {
        name: randomName,
        mass: mass,
        distance: distance,
        type: randomType
    };
}

function addRandomPlanet() {
    const newPlanet = generateRandomPlanetData();
    
    const currentPlanetCount = exoplanets.length;
    const angle = Math.random() * Math.PI * 2;
    const distance = 20 + (currentPlanetCount * 15) + Math.random() * 20; 
    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance;
    const y = (Math.random() - 0.5) * 15; 
    
    let radius = 1;
    if (newPlanet.type.includes('Jupiter') || newPlanet.type === 'Gas Giant') radius = 3 + Math.random();
    else if (newPlanet.type.includes('Super-Earth')) radius = 1.5 + Math.random() * 0.5;
    else if (newPlanet.type.includes('Sub-Neptune') || newPlanet.type === 'Ice Giant') radius = 2 + Math.random() * 0.5;
    else if (newPlanet.type === 'Ocean World') radius = 1.2 + Math.random() * 0.3;
    else radius = 0.8 + Math.random() * 0.4; 
    
    const geometry = new THREE.SphereGeometry(radius, 32, 32);
    const texture = generateRandomTexture();
    const material = new THREE.MeshLambertMaterial({ map: texture });
    
    const exoplanet = new THREE.Mesh(geometry, material);
    exoplanet.position.set(x, y, z);
    exoplanet.userData = newPlanet; 
    
    scene.add(exoplanet);
    exoplanets.push(exoplanet);
    
    const orbitGeometry = new THREE.RingGeometry(distance - 0.5, distance + 0.5, 64);
    const orbitMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x444444, 
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.2
    });
    const orbit = new THREE.Mesh(orbitGeometry, orbitMaterial);
    orbit.rotation.x = Math.PI / 2;
    scene.add(orbit);
    
    console.log(`Added new planet: ${newPlanet.name} (${newPlanet.type})`);
    
    const originalEmissive = material.emissive.clone();
    material.emissive.setHex(0x00ff00);
    setTimeout(() => {
        material.emissive.copy(originalEmissive);
    }, 2000);
}

function showSizeComparison() {
    const comparisonDisplay = document.getElementById('comparison-display');
    comparisonDisplay.innerHTML = '';
    
    const earthItem = createComparisonItem('Earth', 1.0, '#4a90e2');
    comparisonDisplay.appendChild(earthItem);
    
    exoplanets.forEach(planet => {
        const planetData = planet.userData;
        let earthRadii = 1.0;
        
        if (planetData.mass.includes('Jupiters')) {
            const mass = parseFloat(planetData.mass);
            earthRadii = mass * 11.2; 
        } else if (planetData.mass.includes('Earths')) {
            const mass = parseFloat(planetData.mass);
            earthRadii = Math.pow(mass, 1/3); 
        }
        
        const item = createComparisonItem(planetData.name, earthRadii, '#00d4ff');
        comparisonDisplay.appendChild(item);
    });
    
    document.getElementById('comparison-panel').classList.remove('hidden');
}

function createComparisonItem(name, earthRadii, color) {
    const item = document.createElement('div');
    item.className = 'planet-comparison-item';
    
    const maxSize = 50; 
    const circleSize = Math.min(maxSize, Math.max(8, earthRadii * 15));
    
    item.innerHTML = `
        <h4>${name}</h4>
        <div class="size-indicator">
            <div class="size-circle" style="width: ${circleSize}px; height: ${circleSize}px; background: ${color};"></div>
        </div>
        <div class="size-text">${earthRadii.toFixed(2)}x Earth</div>
    `;
    
    return item;
}

function toggleHabitableZone() {
    habitableZoneVisible = !habitableZoneVisible;
    
    habitableZoneObjects.forEach(obj => {
        obj.visible = habitableZoneVisible;
    });
    
    const button = document.getElementById('habitable-zone-btn');
    button.textContent = habitableZoneVisible ? '🌱 Hide Habitable Zone' : '🌱 Show Habitable Zone';
}

function showTimeline() {
    const timelineDisplay = document.getElementById('timeline-display');
    timelineDisplay.innerHTML = '';
    
    const allPlanets = [...exoplanetData];
    exoplanets.forEach(planet => {
        if (!exoplanetData.find(p => p.name === planet.userData.name)) {
            allPlanets.push(planet.userData);
        }
    });
    
    const sortedPlanets = allPlanets
        .filter(planet => planet.discoveryYear)
        .sort((a, b) => a.discoveryYear - b.discoveryYear);
    
    sortedPlanets.forEach(planet => {
        const timelineItem = document.createElement('div');
        timelineItem.className = 'timeline-item';
        
        timelineItem.innerHTML = `
            <div class="timeline-year">${planet.discoveryYear}</div>
            <div class="timeline-planet">
                <div class="planet-name">${planet.name}</div>
                <div>${planet.type} in ${planet.system}</div>
            </div>
        `;
        
        timelineDisplay.appendChild(timelineItem);
    });
    
    document.getElementById('timeline-panel').classList.remove('hidden');
}

function filterPlanets() {
    const typeFilter = document.getElementById('planet-filter').value;
    const missionFilter = document.getElementById('mission-filter').value;
    const statusFilter = document.getElementById('status-filter').value;
    
    exoplanets.forEach(planet => {
        const planetData = planet.userData;
        let visible = true;
        
        if (planetData.type === 'system') {
            return;
        }
        
        if (typeFilter !== 'all') {
            if (typeFilter === 'habitable') {
                visible = visible && planetData.inHabitableZone === true;
            } else {
                visible = visible && planetData.type === typeFilter;
            }
        }
        
        if (missionFilter !== 'all') {
            visible = visible && planetData.mission === missionFilter;
        }
        
        if (statusFilter !== 'all') {
            visible = visible && planetData.status === statusFilter;
        }
        
        planet.visible = visible;
        
        if (planetData.atmosphere) {
            planetData.atmosphere.visible = visible;
        }
    });
}

function updateUIContext() {
    const navigationText = document.getElementById('navigation-text');
    const habitableZoneBtn = document.getElementById('habitable-zone-btn');
    const addPlanetBtn = document.getElementById('add-planet-btn');
    const systemInfo = document.getElementById('system-info');
    const resetViewBtn = document.getElementById('reset-view-btn');
    
    if (currentSystem === 'overview') {
        navigationText.textContent = 'Click on a star system to explore it in detail';
        habitableZoneBtn.style.display = 'none';
        addPlanetBtn.textContent = '🌟 Add Random System';
        systemInfo.classList.add('hidden');
        resetViewBtn.classList.add('hidden');
    } else {
        navigationText.textContent = `Exploring ${currentSystem} system - Click planets for details`;
        habitableZoneBtn.style.display = 'inline-block';
        addPlanetBtn.textContent = '🪐 Add Random Planet';
        resetViewBtn.classList.add('hidden'); 
        
        const system = starSystems[currentSystem];
        if (system) {
            document.getElementById('current-system-name').textContent = currentSystem;
            document.getElementById('current-system-distance').textContent = system.distance;
            document.getElementById('current-system-planets').textContent = system.planets.length;
            systemInfo.classList.remove('hidden');
        }
    }
    
    document.getElementById('info-panel').classList.add('hidden');
    document.getElementById('comparison-panel').classList.add('hidden');
    document.getElementById('timeline-panel').classList.add('hidden');
}

function resetSystemView() {
    if (cameraAnimating) return;
    
    followingPlanet = null;
    
    document.getElementById('reset-view-btn').classList.add('hidden');
    
    animateCameraToSystemView();
}

function animateCameraToSystemView() {
    cameraAnimating = true;
    
    const targetPosition = new THREE.Vector3(0, 30, 80);
    const targetLookAt = new THREE.Vector3(0, 0, 0);
    
    const startPosition = camera.position.clone();
    const startTarget = controls.target.clone();
    
    const duration = 1200;
    const startTime = Date.now();
    
    function animateCamera() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        const easeProgress = easeInOutCubic(progress);
        
        camera.position.lerpVectors(startPosition, targetPosition, easeProgress);
        
        controls.target.lerpVectors(startTarget, targetLookAt, easeProgress);
        controls.update();
        
        if (progress < 1) {
            animationId = requestAnimationFrame(animateCamera);
        } else {
            cameraAnimating = false;
            animationId = null;
        }
    }
    
    animateCamera();
}

function addRandomPlanet() {
    if (currentSystem === 'overview') {
        addRandomStarSystem();
    } else {
        addRandomPlanetToCurrentSystem();
    }
}

function addRandomStarSystem() {
    const systemNames = ['Wolf 359', 'Barnard\'s Star', 'Luhman 16', 'WISE 0855', 'Alpha Centauri C'];
    const systemName = systemNames[Math.floor(Math.random() * systemNames.length)] + '-' + Math.floor(Math.random() * 999);
    
    const planetCount = Math.floor(Math.random() * 4) + 1;
    const newSystem = {
        name: systemName,
        planets: [],
        distance: (Math.random() * 100 + 10).toFixed(1) + ' light-years'
    };
    
    for (let i = 0; i < planetCount; i++) {
        const randomPlanet = generateRandomPlanetData();
        randomPlanet.system = systemName;
        newSystem.planets.push(randomPlanet);
    }
    
    starSystems[systemName] = newSystem;
    
    const selector = document.getElementById('system-select');
    const option = document.createElement('option');
    option.value = systemName;
    option.textContent = `⭐ ${systemName} (${newSystem.planets.length} planets)`;
    selector.appendChild(option);
    
    if (currentSystem === 'overview') {
        showSystem('overview');
    }
    
    console.log(`Added new star system: ${systemName} with ${planetCount} planets`);
}

function addRandomPlanetToCurrentSystem() {
    if (currentSystem === 'overview') return;
    
    const newPlanet = generateRandomPlanetData();
    newPlanet.system = currentSystem;
    
    if (starSystems[currentSystem]) {
        starSystems[currentSystem].planets.push(newPlanet);
    }
    
    const planetIndex = exoplanets.length;
    const totalPlanets = starSystems[currentSystem].planets.length;
    createPlanetInSystem(newPlanet, planetIndex, totalPlanets);
    
    console.log(`Added new planet: ${newPlanet.name} to ${currentSystem} system`);
}

function showEducationMode() {
    document.getElementById('education-panel').classList.remove('hidden');
    switchEducationTab('transit');
}

function switchEducationTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
    
    const content = document.getElementById('education-content');
    
    switch(tab) {
        case 'transit':
            content.innerHTML = `
                <h3>🌟 The Transit Method</h3>
                <p>The transit method is the primary technique used by space telescopes to detect exoplanets. Here's how it works:</p>
                
                <h4>How It Works:</h4>
                <ul>
                    <li><strong>Light Monitoring:</strong> Telescopes continuously monitor the brightness of stars</li>
                    <li><strong>Transit Detection:</strong> When a planet passes in front of its star, it blocks a tiny amount of light</li>
                    <li><strong>Periodic Dimming:</strong> This creates a regular, periodic dip in the star's brightness</li>
                    <li><strong>Data Analysis:</strong> Scientists analyze these light curves to identify planetary signals</li>
                </ul>
                
                <h4>Key Measurements:</h4>
                <ul>
                    <li><strong>Transit Depth:</strong> How much light is blocked (tells us planet size)</li>
                    <li><strong>Transit Duration:</strong> How long the planet blocks the star</li>
                    <li><strong>Orbital Period:</strong> Time between transits (tells us orbital distance)</li>
                </ul>
                
                <p><em>💡 Fun Fact: A planet the size of Earth blocking a Sun-like star dims the light by only 0.008%!</em></p>
            `;
            break;
            
        case 'missions':
            content.innerHTML = `
                <h3>🛰️ Space Missions</h3>
                <p>Three major NASA missions have revolutionized exoplanet discovery:</p>
                
                <h4>🔭 Kepler Mission (2009-2013)</h4>
                <ul>
                    <li>First dedicated exoplanet hunting telescope</li>
                    <li>Discovered over 2,600 confirmed exoplanets</li>
                    <li>Stared at 150,000 stars continuously</li>
                    <li>Proved that planets are common in our galaxy</li>
                </ul>
                
                <h4>🔭 K2 Mission (2014-2018)</h4>
                <ul>
                    <li>Extended mission using Kepler spacecraft</li>
                    <li>Observed different star fields every 80 days</li>
                    <li>Discovered planets around smaller, cooler stars</li>
                    <li>Found the famous TRAPPIST-1 system</li>
                </ul>
                
                <h4>🔭 TESS Mission (2018-present)</h4>
                <ul>
                    <li>Transiting Exoplanet Survey Satellite</li>
                    <li>Surveys the entire sky every 2 years</li>
                    <li>Focuses on nearby, bright stars</li>
                    <li>Perfect for follow-up observations</li>
                </ul>
            `;
            break;
            
        case 'ml':
            content.innerHTML = `
                <h3>🤖 AI & Machine Learning in Exoplanet Detection</h3>
                <p>Modern AI techniques are revolutionizing how we find exoplanets:</p>
                
                <h4>Why Use AI?</h4>
                <ul>
                    <li><strong>Big Data:</strong> Missions generate millions of light curves</li>
                    <li><strong>Pattern Recognition:</strong> AI excels at finding subtle patterns</li>
                    <li><strong>False Positives:</strong> AI can distinguish real planets from noise</li>
                    <li><strong>Speed:</strong> Analyze years of data in minutes</li>
                </ul>
                
                <h4>ML Classification Types:</h4>
                <ul>
                    <li><strong>✅ Confirmed:</strong> High confidence, verified by multiple methods</li>
                    <li><strong>🤔 Candidate:</strong> Likely planet, needs more analysis</li>
                    <li><strong>❌ False Positive:</strong> Not a planet (stellar activity, etc.)</li>
                </ul>
                
                <h4>Confidence Scores:</h4>
                <ul>
                    <li><strong>90-100%:</strong> Very high confidence (green)</li>
                    <li><strong>70-90%:</strong> Moderate confidence (orange)</li>
                    <li><strong>Below 70%:</strong> Low confidence (red)</li>
                </ul>
                
                <p><em>🔬 This Celestia Web app shows the results of AI analysis - each planet has a confidence score!</em></p>
            `;
            break;
            
        case 'quiz':
            content.innerHTML = `
                <h3>🧠 Test Your Knowledge!</h3>
                
                <div class="quiz-question">
                    <h4>Question 1: What does the transit method detect?</h4>
                    <div class="quiz-option" onclick="selectAnswer(this, false)">A) Radio signals from planets</div>
                    <div class="quiz-option" onclick="selectAnswer(this, true)">B) Periodic dimming of starlight</div>
                    <div class="quiz-option" onclick="selectAnswer(this, false)">C) Gravitational waves</div>
                    <div class="quiz-option" onclick="selectAnswer(this, false)">D) Planet temperatures</div>
                </div>
                
                <div class="quiz-question">
                    <h4>Question 2: Which mission discovered the TRAPPIST-1 system?</h4>
                    <div class="quiz-option" onclick="selectAnswer(this, false)">A) Kepler</div>
                    <div class="quiz-option" onclick="selectAnswer(this, true)">B) K2</div>
                    <div class="quiz-option" onclick="selectAnswer(this, false)">C) TESS</div>
                    <div class="quiz-option" onclick="selectAnswer(this, false)">D) Hubble</div>
                </div>
                
                <div class="quiz-question">
                    <h4>Question 3: What does a high ML confidence score indicate?</h4>
                    <div class="quiz-option" onclick="selectAnswer(this, false)">A) The planet is very large</div>
                    <div class="quiz-option" onclick="selectAnswer(this, false)">B) The planet is habitable</div>
                    <div class="quiz-option" onclick="selectAnswer(this, true)">C) High probability it's a real planet</div>
                    <div class="quiz-option" onclick="selectAnswer(this, false)">D) The planet is very far away</div>
                </div>
                
                <p><em>💡 Tip: Click on an answer to see if you're correct!</em></p>
            `;
            break;
    }
}

function selectAnswer(element, isCorrect) {
    element.parentNode.querySelectorAll('.quiz-option').forEach(opt => {
        opt.classList.remove('correct', 'incorrect');
    });
    
    if (isCorrect) {
        element.classList.add('correct');
        element.innerHTML += ' ✅ Correct!';
    } else {
        element.classList.add('incorrect');
        element.innerHTML += ' ❌ Try again!';
    }
}

window.addEventListener('load', init);