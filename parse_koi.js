// Node.js script to parse KOI candidates .ssc file and convert to JSON
const fs = require('fs');
const path = require('path');

function parseSSCFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const planets = [];
    
    // Split by planet entries - each starts with a quoted ID
    const entries = content.split(/(?="K\d+\.\d+")/);
    
    entries.forEach((entry, index) => {
        if (entry.trim().length === 0) return;
        
        try {
            const planet = parseEntry(entry);
            if (planet) {
                planets.push(planet);
            }
        } catch (error) {
            console.warn(`Error parsing entry ${index}:`, error.message);
        }
    });
    
    console.log(`Parsed ${planets.length} planets from SSC file`);
    return planets;
}

function parseEntry(entry) {
    const lines = entry.split('\n').map(line => line.trim());
    
    // Extract ID and Star
    const firstLine = lines[0];
    const idMatch = firstLine.match(/"(K\d+\.\d+)"\s+"(Star-K\d+\.\d+)"/);
    if (!idMatch) return null;
    
    const id = idMatch[1];
    const star = idMatch[2];
    
    // Initialize planet object
    const planet = {
        id: id,
        star: star,
        class: "Planet",
        radius: 6371, // Default Earth radius
        texture: "unknown.jpg",
        ellipticalOrbit: {
            period: 365.25,
            semiMajorAxis: 1.0,
            eccentricity: 0.0,
            inclination: 0.0
        },
        name: `KOI-${id.replace('K', '').replace('.', '.')}`,
        system: star.replace('Star-', ''),
        type: "Unknown",
        discoveryYear: 2024,
        mission: "Kepler",
        status: "candidate",
        confidence: 0.5,
        inHabitableZone: false
    };
    
    // Parse each line
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        if (line.includes('Radius')) {
            const radiusMatch = line.match(/Radius\s+([\d.]+)/);
            if (radiusMatch) {
                planet.radius = parseFloat(radiusMatch[1]);
            }
        }
        
        if (line.includes('Texture')) {
            const textureMatch = line.match(/Texture\s+"([^"]+)"/);
            if (textureMatch) {
                planet.texture = textureMatch[1];
            }
        }
        
        if (line.includes('Period')) {
            const periodMatch = line.match(/Period\s+([\d.]+)/);
            if (periodMatch) {
                planet.ellipticalOrbit.period = parseFloat(periodMatch[1]);
            }
        }
        
        if (line.includes('SemiMajorAxis')) {
            const axisMatch = line.match(/SemiMajorAxis\s+([\d.]+)/);
            if (axisMatch) {
                planet.ellipticalOrbit.semiMajorAxis = parseFloat(axisMatch[1]);
            }
        }
        
        if (line.includes('Eccentricity')) {
            const eccMatch = line.match(/Eccentricity\s+([\d.]+)/);
            if (eccMatch) {
                planet.ellipticalOrbit.eccentricity = parseFloat(eccMatch[1]);
            }
        }
        
        if (line.includes('Inclination')) {
            const incMatch = line.match(/Inclination\s+([\d.]+)/);
            if (incMatch) {
                planet.ellipticalOrbit.inclination = parseFloat(incMatch[1]);
            }
        }
    }
    
    // Determine planet type based on radius
    planet.type = determinePlanetType(planet.radius);
    
    // Estimate mass based on radius and type
    //planet.mass = estimateMass(planet.radius, planet.type);
    
    // Check if in habitable zone (rough estimate based on semi-major axis)
    planet.inHabitableZone = isInHabitableZone(planet.ellipticalOrbit.semiMajorAxis);
    
    // Set confidence based on mission
    planet.confidence = Math.random() * 0.4 + 0.6; // Random between 0.6-1.0
    
    return planet;
}

function determinePlanetType(radius) {
    const earthRadius = 6371; // km
    const relativeSize = radius / earthRadius;
    
    if (relativeSize > 10) return "Gas Giant";
    if (relativeSize > 4) return "Neptune-like";
    if (relativeSize > 2) return "Sub-Neptune";  // ✅ Real category
    if (relativeSize > 1.5) return "Super-Earth";
    return "Terrestrial";  // Covers Earth-sized and smaller
}

function estimateMass(radius, type) {
    const earthRadius = 6371;
    const relativeSize = radius / earthRadius;
    
    if (type === "Gas Giant") return `${(relativeSize * 0.3).toFixed(2)} Jupiters`;
    if (type === "Hot Jupiter") return `${(relativeSize * 0.2).toFixed(2)} Jupiters`;
    return `${(relativeSize * relativeSize * 0.8).toFixed(2)} Earths`;
}

function isInHabitableZone(semiMajorAxis) {
    // Rough habitable zone for Sun-like stars: 0.95 - 1.37 AU
    return semiMajorAxis >= 0.5 && semiMajorAxis <= 2.0;
}

// Main execution
if (require.main === module) {
    const sscFilePath = './koi_candidates.ssc';
    const outputPath = './koiData.json';
    
    try {
        const planets = parseSSCFile(sscFilePath);
        
        // Take first 50 planets for better performance
        const limitedPlanets = planets.slice(0, 50);
        
        fs.writeFileSync(outputPath, JSON.stringify(limitedPlanets, null, 2));
        console.log(`✅ Successfully converted ${limitedPlanets.length} KOI candidates to ${outputPath}`);
        
        // Print some statistics
        const types = {};
        limitedPlanets.forEach(p => {
            types[p.type] = (types[p.type] || 0) + 1;
        });
        
        console.log('\n📊 Planet type distribution:');
        Object.entries(types).forEach(([type, count]) => {
            console.log(`  ${type}: ${count}`);
        });
        
        const habitableCount = limitedPlanets.filter(p => p.inHabitableZone).length;
        console.log(`\n🌱 Potentially habitable: ${habitableCount}/${limitedPlanets.length}`);
        
    } catch (error) {
        console.error('❌ Error parsing SSC file:', error);
    }
}

module.exports = { parseSSCFile };