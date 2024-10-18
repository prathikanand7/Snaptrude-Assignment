const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true);
const scene = new BABYLON.Scene(engine);
scene.clearColor = new BABYLON.Color3(0.9, 0.9, 0.8);

// Camera and Lighting
const camera = new BABYLON.ArcRotateCamera("camera", Math.PI / 4, Math.PI / 3, 20, BABYLON.Vector3.Zero(), scene);
camera.attachControl(canvas, true);
const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, -0.3), scene);

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
// Define the extrusion depth in the Y direction (upwards from the ground)
const extrusionHeight = 3;
let isDragging = false;
let isVertexEdit = false;
let dragStartPosition = null;
let currentScene = false;

// Mini Axis Indicator Dimensions and Offset Position
const axisLength = 1; // Length of each axis line
const axisOffset = new BABYLON.Vector3(-9.5, 0.1, -9.5); // Bottom-left corner offset

// Create Mini Axis Indicator
const xAxis = BABYLON.MeshBuilder.CreateLines("xAxis", {
    points: [BABYLON.Vector3.Zero(), new BABYLON.Vector3(axisLength, 0, 0)]
}, scene);
xAxis.color = new BABYLON.Color3(1, 0, 0); // Red for X-axis
xAxis.position = axisOffset;

const yAxis = BABYLON.MeshBuilder.CreateLines("yAxis", {
    points: [BABYLON.Vector3.Zero(), new BABYLON.Vector3(0, axisLength, 0)]
}, scene);
yAxis.color = new BABYLON.Color3(0, 1, 0); // Green for Y-axis
yAxis.position = axisOffset;

const zAxis = BABYLON.MeshBuilder.CreateLines("zAxis", {
    points: [BABYLON.Vector3.Zero(), new BABYLON.Vector3(0, 0, axisLength)]
}, scene);
zAxis.color = new BABYLON.Color3(0, 0, 1); // Blue for Z-axis
zAxis.position = axisOffset;

// Create labels for each axis
const xLabel = createTextLabel("X", "red", new BABYLON.Vector3(axisLength + 0.3, 0, 0));
const yLabel = createTextLabel("Y", "green", new BABYLON.Vector3(0, axisLength + 0.3, 0));
const zLabel = createTextLabel("Z", "blue", new BABYLON.Vector3(0, 0, axisLength + 0.3));

// Position each label correctly relative to its axis
xLabel.position.addInPlace(axisOffset);
yLabel.position.addInPlace(axisOffset);
zLabel.position.addInPlace(axisOffset);

// Function to create a text label
function createTextLabel(text, color, position) {
    const dynamicTexture = new BABYLON.DynamicTexture("DynamicTexture", { width: 64, height: 64 }, scene, true);
    dynamicTexture.hasAlpha = true;
    dynamicTexture.drawText(text, 5, 40, "bold 24px Arial", color, "transparent");

    const plane = BABYLON.MeshBuilder.CreatePlane("TextPlane", { size: 0.5 }, scene);
    plane.material = new BABYLON.StandardMaterial("TextPlaneMaterial", scene);
    plane.material.backFaceCulling = false;
    plane.material.diffuseTexture = dynamicTexture;
    plane.position = position;
    plane.setParent(xAxis); // Attach to axis for consistent positioning

    return plane;
}

// UI Buttons
document.getElementById("drawMode").onclick = () => setMode("draw");
document.getElementById("extrudeShape").onclick = extrudeShape;
document.getElementById("moveMode").onclick = () => setMode("move");
document.getElementById("vertexEditMode").onclick = () => setMode("editVertex");

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

function setMode(newMode) {
    mode = newMode;

    // Add a space before each uppercase letter, capitalize the first letter
    const formattedMode = mode
        .replace(/([A-Z])/g, ' $1')  // Add space before uppercase letters
        .replace(/^./, str => str.toUpperCase()); // Capitalize the first letter

    document.getElementById("modeIndicator").textContent = `Current Mode: ${formattedMode}`;
}

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
        shapePoints.push(new BABYLON.Vector3(points[i].x, 0.01, points[i].z)); // Convert to 2D shape in XZ plane
    }

    console.log("Polygon points for extrusion:", shapePoints.map(p => `(${p.x}, ${p.y}, ${p.z})`));

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
            cap: BABYLON.Mesh.CAP_ALL, // Cap both ends of the extrusion to make it solid
        }, scene);
        extrudedMesh.position.y = extrusionHeight;

        // Apply a material to make the extruded shape visible and shaded
        const extrusionMaterial = new BABYLON.StandardMaterial("extrusionMaterial", scene);
        extrusionMaterial.diffuseColor = new BABYLON.Color3(0.8, 0.5, 0.5); // Light gray color for visibility
        extrudedMesh.material = extrusionMaterial;

        // Add edge lines to the extruded mesh
        extrudedMesh.enableEdgesRendering();
        extrudedMesh.edgesWidth = 1.0; // Set edge line width
        extrudedMesh.edgesColor = new BABYLON.Color4(1, 1, 1); // White color for edge lines (RGB format)

        // Add vertex spheres for editing without clearing the points array
        addVertexSpheres();

        showNotification("Shape extruded successfully!");
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

function updateMeshVertices() {
    canvas.style.cursor = "grabbing";
    if (!extrudedMesh) return;

    // Get the world position of the extruded mesh
    const meshWorldPosition = extrudedMesh.position;

    const positions = extrudedMesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);

    extrudedMesh.getChildren().forEach(child => {
        if (child.name.startsWith("vertexSphere")) {
            const index = child.vertexIndex;
            positions[index] = child.position.x + meshWorldPosition.x;
            positions[index + 1] = child.position.y - extrusionHeight;
            positions[index + 2] = child.position.z + meshWorldPosition.z;;
        }
    });

    extrudedMesh.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions);


    // Update the points array based on updated vertices
    points = extrudedMesh.getChildren()
        .filter(child => child.name.startsWith("vertexSphere"))
        .map(child => new BABYLON.Vector3(
            child.position.x + meshWorldPosition.x,
            child.position.y, // Keep Y consistent
            child.position.z + meshWorldPosition.z
        ));
}

// Event Listeners for Mouse Interactions
canvas.addEventListener("pointerdown", (evt) => {
    const pickInfo = scene.pick(scene.pointerX, scene.pointerY);
    if (pickInfo.hit && pickInfo.pickedMesh === ground) {
        if (mode === "move" || mode === "extrudeShape" || mode === "editVertex") {
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

canvas.addEventListener("pointermove", (evt) => {
    const pickInfo = scene.pick(scene.pointerX, scene.pointerY);
    if ((mode === "move" || mode === "extrudeShape") && evt.button === 2) {
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
        // Change the color to indicate the object is being grabbed
        extrudedMesh.material.diffuseColor = new BABYLON.Color3(0.3, 0.5, 0.9); // Change to a blueish color while moving

        // Calculate drag offset
        const dragOffset = pickInfo.pickedPoint.subtract(dragStartPosition);
        canvas.style.cursor = "grabbing";
        // Update the extruded mesh's position with the offset, only in X and Z directions
        extrudedMesh.position.x += dragOffset.x;
        extrudedMesh.position.z += dragOffset.z;

        // Update dragStartPosition for smooth continuous movement
        dragStartPosition = pickInfo.pickedPoint;

        // Update the points array based on updated vertices
        points = points.map(point => new BABYLON.Vector3(
            point.x + dragOffset.x,
            point.y, // Keep Y consistent
            point.z + dragOffset.z
        ));
    }

    if (mode === "editVertex" && selectedVertex) {
        //const pickInfo = scene.pick(scene.pointerX, scene.pointerY);
        if (pickInfo.hit) {
            // Adjust the selected vertex position relative to the mesh's position
            const meshWorldPosition = extrudedMesh.position; // Get the world position of the mesh
            selectedVertex.position = pickInfo.pickedPoint.subtract(meshWorldPosition); // Subtract the mesh's world position for correct local placement
            updateMeshVertices();
        }
    }
});

canvas.addEventListener("pointerup", (evt) => {
    if (isDragging) {
        isDragging = false;
        dragStartPosition = null;

        // Reset the color back to its original state
        extrudedMesh.material.diffuseColor = new BABYLON.Color3(0.8, 0.5, 0.5); // Set to original color

        camera.attachControl(canvas); // Re-enable camera control after drag
        canvas.style.cursor = "default"; // Reset cursor to default after drag
        currentScene = false;
    }
    if (isVertexEdit) {
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


// Run Render Loop
engine.runRenderLoop(() => scene.render());
window.addEventListener("resize", () => engine.resize());
