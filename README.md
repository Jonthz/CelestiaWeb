# Celestia Web - Exoplanet Explorer

A 3D interactive web application for visualizing exoplanets using Three.js. Explore exoplanets in 3D space with randomly generated textures and detailed information panels.

## Features

- **3D Visualization**: Interactive 3D scene with exoplanets orbiting around a central star
- **Random Textures**: Each planet has a dynamically generated unique texture
- **Interactive Controls**: Use mouse to orbit, zoom, and explore the scene
- **Click Interactions**: Click on any exoplanet to view detailed information
- **Real Data**: Exoplanet data loaded from JSON file including mass, distance, and type
- **Responsive Design**: Works on desktop and mobile devices

## Project Structure

```
CelestiaWeb/
├── index.html          # Main HTML structure
├── style.css           # CSS styling with space theme
├── app.js             # Three.js application logic
├── exoplanetData.json # Exoplanet data
├── server.py          # Python HTTP server
└── README.md          # This file
```

## How to Run

### Option 1: Using Python Server (Recommended)

1. Open a terminal/command prompt in the project directory
2. Run the Python server:
   ```bash
   python server.py
   ```
3. The application will automatically open in your browser at `http://localhost:8000`

### Option 2: Using Node.js (if you have it installed)

```bash
npx http-server -p 8000 -c-1
```

### Option 3: Using any other HTTP server

You need to serve the files over HTTP (not file://) for the fetch API to work properly.

## Controls

- **Mouse Drag**: Orbit around the scene
- **Mouse Wheel**: Zoom in/out
- **Click**: Select an exoplanet to view information
- **X Button**: Close the information panel

## Exoplanet Data

The application loads exoplanet data from `exoplanetData.json` with the following structure:

```json
[
  {
    "name": "Kepler-22b",
    "mass": "2.4 Earths",
    "distance": "600 light-years",
    "type": "Super-Earth"
  }
]
```

## Technical Details

- **Three.js**: 3D graphics library
- **OrbitControls**: Camera interaction
- **Random Texture Generation**: Canvas-based procedural textures
- **Raycasting**: Click detection on 3D objects
- **Responsive Design**: Adapts to different screen sizes

## Customization

### Adding More Exoplanets

Edit `exoplanetData.json` to add more exoplanets. The application will automatically create 3D representations for all entries.

### Modifying Textures

The `generateRandomTexture()` function in `app.js` creates procedural textures. You can modify this function to:
- Use different color schemes
- Add noise patterns
- Load external texture images

### Changing Orbital Mechanics

Modify the animation loop in `app.js` to change how planets orbit:
- Orbital speed
- Orbital radius
- Inclination angles

## Browser Compatibility

- Chrome/Chromium (recommended)
- Firefox
- Safari
- Edge

Requires WebGL support for 3D rendering.

## NASA Space Apps Challenge

This project was created for the NASA Space Apps Challenge 2025, demonstrating interactive visualization of exoplanet data in a web-based 3D environment.