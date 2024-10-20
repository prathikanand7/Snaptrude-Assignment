import {
    setMode,
    getPoints,
    addPoint,
    setPoints,
    getExtrudedMesh,
    setExtrudedMesh,
    getPointMarkers,
    setPointMarkers,
    addPointMarker,
    getPreviewLine,
    setPreviewLine,
    setCurrentScene,
    getCurrentScene,
    getExtrusionHeight,
    setSelectedVertex,
    getCompletedShapes,
    addCompletedShape,
    setCompletedShapes,
    setSelectedShape,
} from './stateManager.js';

import { showNotification } from './notificationManager.js';

// Set up the Babylon scene
export function setupScene(canvas, engine) {
    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color3(0.9, 0.9, 0.8);

    // Camera and Lighting
    const camera = new BABYLON.ArcRotateCamera("camera", Math.PI / 4, Math.PI / 3, 20, BABYLON.Vector3.Zero(), scene);
    camera.attachControl(canvas, true);
    new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, -0.3), scene);

    // Ground Plane
    const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 20, height: 20 }, scene);

    // Return the scene, camera, and ground objects
    return { scene, camera, ground };
}

// Add point to the shape
export function addPointToShape(point, scene) {
    const newPoint = new BABYLON.Vector3(point.x, 0, point.z);
    addPoint(newPoint);  // Use state manager to add point

    // Add point marker
    const marker = BABYLON.MeshBuilder.CreateSphere("marker", { diameter: 0.1 }, scene);
    marker.material = new BABYLON.StandardMaterial("extrusionMaterial", scene);
    marker.material.diffuseColor = new BABYLON.Color3(0, 1, 1);
    marker.position = newPoint;
    addPointMarker(marker);  // Add marker using state manager

    // Update the preview line
    let previewLine = getPreviewLine();
    if (getPoints().length >= 1) {
        if (previewLine) previewLine.dispose();
        previewLine = BABYLON.MeshBuilder.CreateLines("previewLine", { points: getPoints().concat([newPoint]) }, scene);
        previewLine.color = new BABYLON.Color3(0, 0, 1);
        setPreviewLine(previewLine);  // Update preview line in state
    }
}

// Close the shape (connect the first and last points)
export function closeShape(scene) {
    const points = getPoints();  // Get the points for the shape

    if (getPoints().length > 2) {
        const closedPoints = [...points, points[0]];

        // Create new shape mesh and set color
        let shapeMesh = BABYLON.MeshBuilder.CreateLines("shape", { points: closedPoints }, scene);
        shapeMesh.color = new BABYLON.Color3(0, 1, 1); // Final shape color

        // Store this completed  (mesh and points) in the state manager
        addCompletedShape(shapeMesh, points);

        // Clean up preview line and markers
        let previewLine = getPreviewLine();
        if (previewLine) {
            previewLine.dispose();
            setPreviewLine(null);  // Clear preview line in state
        }

        getPointMarkers().forEach(marker => marker.dispose());
        setPointMarkers([]);  // Reset point markers in state

        // Clear points to start a new shape
        setPoints([]);
    }
}

// Extrude shape into 3D
export function extrudeShape(scene) {
    if (getCurrentScene() === false) { showNotification("Shapes already exists! Clear them first.", true); return; }
    setMode("extrudeShape");
    if (getCompletedShapes().length === 0) { showNotification("No shapes to extrude!", true); return; }
    const completedShapes = getCompletedShapes();  // Get all completed shapes

    // Loop through each completed shape and extrude it
    try {
        completedShapes.forEach((shape) => {
            const shapePoints = shape.points;
            // Ensure there are enough points for a valid shape
            if (shapePoints.length < 2) {
                showNotification("Insufficient points for extrusion.", true);
                return;
            }

            // Extrude each shape individually
            const extrudedMesh = BABYLON.MeshBuilder.ExtrudePolygon("extrudedPolygon", {
                shape: shapePoints,
                depth: getExtrusionHeight(),
                sideOrientation: BABYLON.Mesh.DOUBLESIDE,
                cap: BABYLON.Mesh.CAP_ALL
            }, scene);
            extrudedMesh.position.y = getExtrusionHeight();

            // Set the extrusion material and color
            const extrusionMaterial = new BABYLON.StandardMaterial("extrusionMaterial", scene);
            extrusionMaterial.diffuseColor = new BABYLON.Color3(0.8, 0.5, 0.5); // Light red color
            extrudedMesh.material = extrusionMaterial;

            // Store the extruded mesh in the shape object
            shape.extrudedMesh = extrudedMesh;

            // Add edge lines for better visibility
            extrudedMesh.enableEdgesRendering();
            extrudedMesh.edgesWidth = 1.0;
            extrudedMesh.edgesColor = new BABYLON.Color4(1, 1, 1, 1);  // White edges

            // Make sure the shape is movable and vertices are editable
            setSelectedShape(shape);  // Set the selected shape for editing
            addVertexSpheres(scene, shape);
            showNotification("Shape(s) extruded successfully!");
        });
    }
    catch (error) {
        showNotification("Extrusion failed!", true);
        console.error("Extrusion failed:", error);
    }
    setCurrentScene(false);
}

// Add vertex spheres for editing
export function addVertexSpheres(scene, shape) {
    if (!getCompletedShapes()) return;
    const extrudedMesh = shape.extrudedMesh;
    const positions = shape.points;
    const extrusionHeight = getExtrusionHeight();

    // Array to store vertex spheres
    shape.vertexSpheres = [];

    console.log("Positions:", positions);
    // Create a vertex sphere for each point in the shape
    positions.forEach((point, index) => {

        // Bottom vertex sphere (Y = 0)
        const bottomVertexSphere = BABYLON.MeshBuilder.CreateSphere(`vertexSphereBottom${index}`, { diameter: 0.1 }, scene);
        bottomVertexSphere.position = new BABYLON.Vector3(point.x, 0, point.z);  // Bottom vertex position
        bottomVertexSphere.material = new BABYLON.StandardMaterial("vertexMaterial", scene);
        bottomVertexSphere.material.diffuseColor = new BABYLON.Color3(0, 1, 1);  // Teal color for vertices visibility
        bottomVertexSphere.isPickable = true;  // Allow clicking for vertex editing

        // Top vertex sphere (Y = extrusionHeight)
        const topVertexSphere = BABYLON.MeshBuilder.CreateSphere(`vertexSphereTop${index}`, { diameter: 0.1 }, scene);
        topVertexSphere.position = new BABYLON.Vector3(point.x, extrusionHeight, point.z);  // Top vertex position
        topVertexSphere.material = new BABYLON.StandardMaterial("vertexMaterial", scene);
        topVertexSphere.material.diffuseColor = new BABYLON.Color3(0, 1, 1);  // Teal color for vertices visibility
        topVertexSphere.isPickable = true;  // Allow clicking for vertex editing

        // Store reference to both spheres in the shape object
        shape.vertexSpheres.push({ bottom: bottomVertexSphere, top: topVertexSphere });
    });
}

// Reset scene
export function resetScene(scene) {
    if (getExtrudedMesh()) getExtrudedMesh().dispose();
    if (getPreviewLine()) getPreviewLine().dispose();
    if (getPointMarkers()) getPointMarkers().forEach(marker => marker.dispose());

    const completedShapes = getCompletedShapes();  // Get all completed shapes

    // Dispose of all completed shapes, including extruded meshes and vertex spheres
    completedShapes.forEach(shape => {
        // Dispose of the shape mesh
        if (shape.mesh) shape.mesh.dispose();
        // Dispose of the extruded mesh (if it exists)
        if (shape.extrudedMesh) shape.extrudedMesh.dispose();
        // Dispose of any vertex spheres (top and bottom for each vertex)
        if (shape.vertexSpheres) {
            shape.vertexSpheres.forEach(vertexPair => {
                if (vertexPair.bottom) vertexPair.bottom.dispose();  // Dispose bottom sphere
                if (vertexPair.top) vertexPair.top.dispose();        // Dispose top sphere
            });
        }
        // Clear points array associated with this shape
        if (shape.points) {
            shape.points.length = 0;  // Clear points array for the shape
        }
    });
    // Clear all state variables
    setCompletedShapes([])  // Clear the array of completed shapes
    setPoints([]);  // Reset points
    setPointMarkers([]);  // Reset point markers
    setExtrudedMesh(null);  // Clear extruded mesh
    setPreviewLine(null);  // Clear preview line
    setSelectedVertex(null);  // Clear selected vertex
    setCurrentScene(true);  // Set back to current scene
    showNotification("Scene has been reset."); // Show notification to confirm the scene reset
    setMode("draw");     // Set the mode back to "draw" mode
}
