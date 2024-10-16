const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true);
const scene = new BABYLON.Scene(engine);
scene.clearColor = new BABYLON.Color3(0.8, 0.8, 0.8);

// Camera and Lighting
const camera = new BABYLON.ArcRotateCamera("camera", Math.PI / 4, Math.PI / 3, 20, BABYLON.Vector3.Zero(), scene);
camera.attachControl(canvas, true);
const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);

// Ground Plane
const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 20, height: 20 }, scene);

// Modes and State
let mode = "draw";
let points = [];
let pointsVector = [];
let shapeMesh = null;
let extrudedMesh = null;
let selectedVertex = null;
let pointMarkers = [];
let previewLine = null;
const extrusionHeight = 3;
let isDragging = false;
let isVertexEdit = false;
let dragStartPosition = null;
let currentScene = false;

// UI Buttons
document.getElementById("drawMode").onclick = () => setMode("draw");
document.getElementById("extrudeShape").onclick = extrudeShape;
document.getElementById("moveMode").onclick = () => setMode("move");
document.getElementById("vertexEditMode").onclick = () => setMode("editVertex");

function setMode(newMode) {
    mode = newMode;
    document.getElementById("modeIndicator").textContent = `Current Mode: ${mode.charAt(0).toUpperCase() + mode.slice(1)}`;
}

// Drawing Points and Shape
canvas.addEventListener("pointerdown", (evt) => {
    const pickInfo = scene.pick(scene.pointerX, scene.pointerY);
    if (pickInfo.hit && pickInfo.pickedMesh === ground) {
        if (mode === "move" && (evt.button === 0 || evt.button === 2)) {
            return;
        }
        if (mode === "extrudeShape" && (evt.button === 0 || evt.button === 2)) {
            return;
        }
        if (mode === "editVertex" && (evt.button === 0 || evt.button === 2)) {
            return;
        }
        if (currentScene === false && points.length > 0) {
            resetScene();
        }
        if (mode === "draw") {
            currentScene = true;
            if (evt.button === 0) { // Left-click
                addPoint(pickInfo.pickedPoint);
            } else if (evt.button === 2) { // Right-click
                closeShape();
            }
        }
    }
    if (mode === "move" && pickInfo.hit && pickInfo.pickedMesh === extrudedMesh) {
        isDragging = true; // Start dragging
        dragStartPosition = pickInfo.pickedPoint; // Record starting point of drag
        camera.detachControl(canvas);
        canvas.style.cursor = "grabbing";
    }
    if (mode === "editVertex" && pickInfo.hit && pickInfo.pickedMesh.name.startsWith("vertexSphere")) {
        isVertexEdit = true;
        selectedVertex = pickInfo.pickedMesh;
        camera.detachControl(canvas); // Disable camera control during drag
        canvas.style.cursor = "grabbing";
    }
});

// Function to Add Points and Preview Line
function addPoint(point) {
    currentScene = true;
    const newPoint = new BABYLON.Vector3(point.x, 0.01, point.z);
    points.push(newPoint);

    // Add point marker for visual feedback
    const marker = BABYLON.MeshBuilder.CreateSphere("marker", { diameter: 0.1 }, scene);
    marker.position = newPoint;
    pointMarkers.push(marker);

    // Update the preview line as points are added
    if (points.length > 1) {
        if (previewLine) previewLine.dispose();
        previewLine = BABYLON.MeshBuilder.CreateLines("previewLine", { points: points.concat([newPoint]) }, scene);
        previewLine.color = new BABYLON.Color3(0, 0, 1);
    }
}

function closeShape() {
    currentScene = true;
    if (points.length > 2) {
        // Ensure the shape is closed by adding the first point at the end
        const closedPoints = [...points, points[0]];

        // Dispose of any existing shapeMesh and create a new one with a closed loop
        if (shapeMesh) shapeMesh.dispose();
        shapeMesh = BABYLON.MeshBuilder.CreateLines("shape", { points: closedPoints }, scene);
        shapeMesh.color = new BABYLON.Color3(0, 1, 0); // Set color for the final shape (e.g., green)

        // Dispose of the preview line and point markers for a clean drawing interface
        if (previewLine) {
            previewLine.dispose();
            previewLine = null;
        }
        pointMarkers.forEach(marker => marker.dispose());
        pointMarkers = [];

        // Clear the points array to prepare for the next shape
        //points = [];
    }
}

// Extruding the Shape with Volume in the Y direction
function extrudeShape() {
    setMode("extrudeShape"); // Reset mode to draw after extrusion

    // Ensure there are enough points for a valid shape
    if (points.length < 3) {
        console.log("Insufficient points for extrusion.");
        return;
    }

    // Prepare the shape points by omitting any duplicate closing point
    const shapePoints = [];
    for (let i = 0; i < points.length; i++) {
        if (i === points.length - 1 && points[i].equals(points[0])) {
            console.log("Closed shape detected. Skipping duplicate last point.");
            break;
        }
        shapePoints.push(new BABYLON.Vector3(points[i].x, points[i].y, points[i].z)); // Convert to 2D shape in XZ plane
    }

    console.log("Polygon points for extrusion:", shapePoints.map(p => `(${p.x}, ${p.y}, ${p.z})`));

    // Define the extrusion depth in the Y direction (upwards from the ground)
    //extrusionHeight = 5; // Set the desired height of extrusion

    // Dispose of any previous shape preview
    if (shapeMesh) {
        shapeMesh.dispose();
        shapeMesh = null;
    }
    if (extrudedMesh) {
        extrudedMesh.dispose();
        extrudedMesh = null;
    }

    try {
        // Use ExtrudePolygon to create a solid 3D object extruded upwards
        extrudedMesh = BABYLON.MeshBuilder.ExtrudePolygon("extrudedPolygon", {
            shape: shapePoints,
            depth: extrusionHeight,
            sideOrientation: BABYLON.Mesh.DOUBLESIDE, // Make sure both sides are rendered
            cap: BABYLON.Mesh.CAP_ALL // Cap both ends of the extrusion to make it solid
        }, scene);
        extrudedMesh.position.y = extrusionHeight;

        // Apply a material to make the extruded shape visible and shaded
        const extrusionMaterial = new BABYLON.StandardMaterial("extrusionMaterial", scene);
        extrusionMaterial.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.5); // Light gray color for visibility
        extrudedMesh.material = extrusionMaterial;

        // Add edge lines to the extruded mesh
        extrudedMesh.enableEdgesRendering();
        extrudedMesh.edgesWidth = 1.0; // Set edge line width
        extrudedMesh.edgesColor = new BABYLON.Color4(1, 1, 1, 1); // Green color for edge lines (RGBA format)

        // Add vertex spheres for editing without clearing the points array
        addVertexSpheres();
    } catch (error) {
        console.error("Extrusion failed:", error);
    }
    currentScene = false;
}

// Add vertex spheres for editing
function addVertexSpheres() {
    if (!extrudedMesh) return;

    // Retrieve the positions of each vertex in the extruded mesh
    const positions = extrudedMesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    const vertexSpheres = [];

    for (let i = 0; i < positions.length; i += 3) {
        const vertexSphere = BABYLON.MeshBuilder.CreateSphere(`vertexSphere${i}`, { diameter: 0.1 }, scene);
        vertexSphere.position = new BABYLON.Vector3(
            positions[i],
            positions[i + 1] + extrusionHeight,
            positions[i + 2]);
        vertexSphere.setParent(extrudedMesh); // Attach spheres to extruded mesh
        vertexSphere.isPickable = true; // Allow picking in edit mode

        // Store the index of this vertex for reference in editing mode
        vertexSphere.vertexIndex = i;
        vertexSpheres.push(vertexSphere);
    }
}

function resetScene() {
    // Dispose of the extruded mesh, shape preview, and preview line if they exist
    showNotification("Scene has been reset");

    if (extrudedMesh) {
        extrudedMesh.dispose();
        extrudedMesh = null;
    }
    if (shapeMesh) {
        shapeMesh.dispose();
        shapeMesh = null;
    }
    if (previewLine) {
        previewLine.dispose();
        previewLine = null;
    }

    // Dispose of all point markers
    pointMarkers.forEach(marker => marker.dispose());
    pointMarkers = [];

    // Clear points array
    pointsVector = [];
    points = [];
    selectedVertex = null;

    // Call resetScene when entering Draw mode
    document.getElementById("drawMode").onclick = () => {
        setMode("draw"); // Set mode to draw
    }
}

function showNotification(message) {
    const notification = document.getElementById("notification");
    notification.textContent = message;
    notification.classList.remove("hidden"); // Show the notification

    // Hide the notification after 3 seconds
    setTimeout(() => {
        notification.classList.add("hidden");
    }, 2000);
}

canvas.addEventListener("pointermove", (evt) => {
    const pickInfo = scene.pick(scene.pointerX, scene.pointerY);
    if (mode === "move" && evt.button === 2) {
        return;
    }
    if (mode === "extrudeShape" && evt.button === 2) {
        return;
    }
    
    // Handle cursor appearance when hovering over the object in move mode
    if (mode === "move" && !isDragging && pickInfo.hit && pickInfo.pickedMesh === extrudedMesh) {
        canvas.style.cursor = "grab"; // Change cursor to grab when hovering over the object
    } else if (mode === "move" && !isDragging) {
        canvas.style.cursor = "default"; // Default cursor when not hovering over the object
    }

    // Handle object movement in move mode
    if (mode === "move" && isDragging && pickInfo.hit && pickInfo.pickedMesh === ground) {
        // Calculate drag offset
        const dragOffset = pickInfo.pickedPoint.subtract(dragStartPosition);
        canvas.style.cursor = "grabbing";
        // Update the extruded mesh's position with the offset, only in X and Z directions
        extrudedMesh.position.x += dragOffset.x;
        extrudedMesh.position.z += dragOffset.z;

        // Update dragStartPosition for smooth continuous movement
        dragStartPosition = pickInfo.pickedPoint;
        pointsVector.push(points);
        // Update points array to reflect the new position
        points = points.map(point => new BABYLON.Vector3(
            point.x + dragOffset.x,
            point.y, // Keep Y the same as we are moving in XZ plane only
            point.z + dragOffset.z
        ));
    }

    if (mode === "editVertex" && selectedVertex) {
        const pickInfo = scene.pick(scene.pointerX, scene.pointerY);
        if (pickInfo.hit) {
            selectedVertex.position = pickInfo.pickedPoint;
            updateMeshVertices();
        }
    }
});

canvas.addEventListener("pointerup", () => {
    if (isDragging) {
        isDragging = false;
        dragStartPosition = null;
        camera.attachControl(canvas); // Re-enable camera control after drag
        canvas.style.cursor = "default"; // Reset cursor to default after drag
        currentScene = false;
    }
    if (isVertexEdit) {
        //extrudeShape();
        isVertexEdit = false;
        selectedVertex = null;
        camera.attachControl(canvas); // Re-enable camera control after drag
        canvas.style.cursor = "default"; // Reset cursor to default after drag
        currentScene = false;
    }
    if (mode === "move" && evt.button === 2) {
        return;
    }
    if (mode === "extrudeShape" && evt.button === 2) {
        return;
    }
    selectedVertex = null;
});

function updateMeshVertices() {
    canvas.style.cursor = "grabbing";
    if (!extrudedMesh) return;
    const positions = extrudedMesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    extrudedMesh.getChildren().forEach(child => {
        if (child.name.startsWith("vertexSphere")) {
            const index = child.vertexIndex;
            positions[index] = child.position.x;
            positions[index + 1] = child.position.y;
            positions[index + 2] = child.position.z;
        }
    });
    extrudedMesh.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions);

    positions = extrudedMesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    // Update points array with new vertex positions for remeshing
    //points = vertexSpheres.map(sphere => new BABYLON.Vector3(sphere.positions.x, 0.01, sphere.positions.z));
    //points = pointMarkers.map(sphere => new BABYLON.Vector3(sphere.position.x, 0.01, sphere.position.z));
    // Update points array to reflect the new position
    points = points.map(point => new BABYLON.Vector3(
        child.position.x,
        child.position.y, // Keep Y the same as we are moving in XZ plane only
        child.position.z
    ));
    // Call extrudeShape to remesh with updated vertices
    //extrudeShape();


    if (extrudedMesh) {
        extrudedMesh.dispose();
    }

     // Remesh the entire extruded shape with updated vertices
}

// Run Render Loop
engine.runRenderLoop(() => scene.render());
window.addEventListener("resize", () => engine.resize());
