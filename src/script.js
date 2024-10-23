// Import functions from modules
import {
    setupScene,
    resetScene,
    extrudeShape,
    addPointToShape,
    closeShape,
} from './sceneManager.js';

import {
    setMode,
    getMode,
    getPoints,
    getIsDragging,
    setIsDragging,
    getIsVertexEdit,
    setIsVertexEdit,
    getDragStartPosition,
    setDragStartPosition,
    getCurrentScene,
    setCurrentScene,
    getCompletedShapes,
    setCompletedShapes,
    getSelectedShape,
    setSelectedShape,
    getSelectedVertex,
    setSelectedVertex,
    updateShapePoints,
    //setShapeMesh
} from './stateManager.js';

import { showNotification } from './notificationManager.js';
import { initializeAxis, createAndPositionLabel } from './axisManager.js';

// Canvas and Engine Setup
const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true);
const { scene, camera, ground } = setupScene(canvas, engine); // Destructure to get scene, camera, and ground

// UI Event Listeners
document.getElementById("drawMode").onclick = () => {
    if (getIsVertexEdit()) {
        // Clean up vertex edit state
        setIsVertexEdit(false);
        setSelectedVertex(null);
    }
    setMode("draw", camera, canvas);
};

document.getElementById("extrudeShape").onclick = () => {
    if (getIsVertexEdit()) {
        setIsVertexEdit(false);
        setSelectedVertex(null);
        camera.attachControl(canvas, true);
    }
    extrudeShape(scene);
};

document.getElementById("moveMode").onclick = () => {
    if (getIsVertexEdit()) {
        setIsVertexEdit(false);
        setSelectedVertex(null);
    }
    setMode("move", camera, canvas);
};

document.getElementById("vertexEditMode").onclick = () => {
    setMode("editVertex", camera, canvas);
};

document.getElementById("resetScene").onclick = () => {
    if (getIsVertexEdit()) {
        setIsVertexEdit(false);
        setSelectedVertex(null);
        camera.attachControl(canvas, true);
    }
    resetScene(scene);
};

// Initialize Axis and Labels
initializeAxis(scene);
createAndPositionLabel(scene);

// Pointer events
canvas.addEventListener("click", (evt) => {
    const pickInfo = scene.pick(scene.pointerX, scene.pointerY);
    const currentMode = getMode();

    // Left-click event handling
    if (pickInfo.hit && pickInfo.pickedMesh === ground) {
        if (currentMode === "move" || currentMode === "extrudeShape" || currentMode === "editVertex") {
            return;
        }
        if (evt.button === 0) {
            addPointToShape(pickInfo.pickedPoint, scene);
        }
    }
});

// Right-click event handling
canvas.addEventListener("contextmenu", (evt) => {
    evt.preventDefault(); // Prevent the default right-click context menu
    const pickInfo = scene.pick(scene.pointerX, scene.pointerY);
    const currentMode = getMode();

    if (pickInfo.hit && pickInfo.pickedMesh === ground) {
        if (currentMode === "move" || currentMode === "extrudeShape" || currentMode === "editVertex") {
            return;
        }

        // Right-click (context menu event) to close shape
        closeShape(scene);
    }
});

// Event Listener for Clicking on the Canvas
canvas.addEventListener("click", () => {
    const currentMode = getMode();
    if ((currentMode === "move" || currentMode === "editVertex") && (getCompletedShapes().length === 0)) {
        showNotification("No extruded shape to move or edit.", true);
        return;
    }
});

// Event Listener when the user presses down on the element
canvas.addEventListener("pointerdown", (evt) => {

    const pickInfo = scene.pick(scene.pointerX, scene.pointerY);
    const currentMode = getMode();
    const currentScene = getCurrentScene();
    const points = getPoints();
    const completedShapes = getCompletedShapes();


    // Left-click event handling
    if (pickInfo.hit && pickInfo.pickedMesh === ground) {
        if (currentMode === "move" || currentMode === "extrudeShape" || currentMode === "editVertex") {
            return;
        }
        if (currentMode === "draw") {
            // Reset the scene if some shapes are already extruded
            if (currentScene === false) {
                resetScene(scene);
                showNotification("Scene reset successfully.");
            }
            // Set the current scene to true to indicate that we are going to start a fresh session
            setCurrentScene(true);
            if (evt.button === 0) { // Left-click
                addPointToShape(pickInfo.pickedPoint, scene);
            } else if (evt.button === 2) { // Right-click
                closeShape(scene);
            }
        }
    }
    // Check if we clicked on any of the extruded shapes
    findSelectedShapeForMovement(currentMode, pickInfo, completedShapes);

    // Check if we clicked on any vertex sphere
    findSelectedVertexForEditing(currentMode, pickInfo, completedShapes);

});

// Event Listener for Moving the Object
canvas.addEventListener("pointermove", (evt) => {

    const pickInfo = scene.pick(scene.pointerX, scene.pointerY);
    const currentMode = getMode();
    const isDragging = getIsDragging();
    let selectedShape = null;
    let selectedVertex = null;
    if (getSelectedShape()) { selectedShape = getSelectedShape(); }
    if (getSelectedVertex()) { selectedVertex = getSelectedVertex(); }

    if ((currentMode === "move" || currentMode === "extrudeShape") && evt.button === 2) {
        return;
    }

    // Handle cursor appearance when hovering over the object in move mode
    setCursorForObjectMovement(currentMode, isDragging, pickInfo);

    // Handle object movement in move mode
    handleObjectMovement(selectedShape, pickInfo);

    // Handle cursor appearance when hovering over the object in move mode
    setCursorForVertexEditing(currentMode, isDragging, pickInfo);

    // Handle vertex editing mode
    updateSelectedVertexPosition(selectedVertex, pickInfo);

});

// Event Listener when the user releases their pointer from the element
canvas.addEventListener("pointerup", (evt) => {
    let selectedShape = null;
    let selectedVertex = null;
    if (getSelectedShape()) { selectedShape = getSelectedShape(); }
    if (getSelectedVertex()) { selectedVertex = getSelectedVertex(); }

    const currentMode = getMode();
    const isDragging = getIsDragging();
    const isVertexEdit = getIsVertexEdit();

    // Check if we are dragging an object
    if (isDragging) {
        handlePointerUpEventForMove(selectedShape, camera, canvas);
    }

    // Check if we are editing a vertex
    if (isVertexEdit) {
        if (selectedVertex) {
            selectedVertex.material.diffuseColor = new BABYLON.Color3(0, 1, 1);  // Reset to teal
        }
        handlePointerUpEventForVertexEdit(selectedShape, selectedVertex, camera, canvas);
    }
});

// Run Render Loop
engine.runRenderLoop(() => scene.render());
window.addEventListener("resize", () => engine.resize());

// Update the vertex picking behavior to include camera handling
export function addVertexPickingBehavior(scene, camera, canvas) {
    // Add pointer observable to handle vertex picking
    scene.onPointerObservable.add((pointerInfo) => {
        if (getMode() === "editVertex") {
            switch (pointerInfo.type) {
                case BABYLON.PointerEventTypes.POINTERDOWN:
                    const pickResult = scene.pick(scene.pointerX, scene.pointerY); // Pick the object at the pointer's location
                    if (pickResult.hit && (pickResult.pickedMesh.name.startsWith("vertexSphere"))) {
                        const prevVertex = getSelectedVertex();
                        if (prevVertex) {
                            prevVertex.material.diffuseColor = new BABYLON.Color3(0, 1, 1); // Reset to teal
                        }
                        setSelectedVertex(pickResult.pickedMesh);
                        setIsVertexEdit(true);
                        if (camera && canvas) {
                            camera.detachControl(canvas); // Disable camera movement during vertex editing
                        }
                        canvas.style.cursor = "grabbing";
                        pickResult.pickedMesh.material.diffuseColor = new BABYLON.Color3(1, 0.8, 0); // Highlight selected vertex with yellow
                    }
                    break;
                // Handle pointer up event for vertex editing
                case BABYLON.PointerEventTypes.POINTERUP:
                    if (getIsVertexEdit()) {
                        handlePointerUpEventForVertexEdit(
                            getSelectedShape(),
                            getSelectedVertex(),
                            camera,
                            canvas
                        );
                    }
                    break;
            }
        }
    });
}


// Function to handle pointer up event for vertex editing
export function handlePointerUpEventForVertexEdit(selectedShape, selectedVertex, camera, canvas) {
    setIsVertexEdit(false);
    // Reset the color of the selected vertex and shape
    if (selectedVertex) {
        selectedVertex.material.diffuseColor = new BABYLON.Color3(0, 1, 1); // Teal
    }
    if (selectedShape && selectedVertex) {
        // Restore the color of the extruded shape
        selectedShape.extrudedMesh.material.diffuseColor = new BABYLON.Color3(0.8, 0.5, 0.5); // Reddish color
        selectedVertex.material.diffuseColor = new BABYLON.Color3(0, 1, 1); // Teal
        console.log("reached here")
    }

    // Always ensure camera is reattached
    if (camera && canvas) {
        camera.attachControl(canvas, true);
    }

    // Reset cursor and clear selected vertex
    canvas.style.cursor = "default";
    setSelectedVertex(null);
    setCurrentScene(false);
}

// Function to handle cursor appearance when hovering over the object in vertex editing mode
function setCursorForVertexEditing(currentMode, isDragging, pickInfo) {
    if (currentMode === "editVertex" && !isDragging && pickInfo.pickedMesh && (pickInfo.pickedMesh.name.startsWith("vertexSphereBottom")
        || pickInfo.pickedMesh.name.startsWith("vertexSphereTop"))) {
        canvas.style.cursor = "grab"; // Change cursor to grab when hovering over the object
    } else if (currentMode === "editVertex" && !isDragging) {
        canvas.style.cursor = "default";
    }
}

// Function to handle cursor appearance when hovering over the object in move mode
function setCursorForObjectMovement(currentMode, isDragging, pickInfo) {
    if (currentMode === "move" && !isDragging && pickInfo.hit && pickInfo.pickedMesh != ground) {
        canvas.style.cursor = "grab"; // Change cursor to grab when hovering over the object
        console.log("Hovering over the object", pickInfo.pickedMesh);
    } else if (currentMode === "move" && !isDragging) {
        canvas.style.cursor = "default";
    }
}

// Function to find the selected vertex for editing
function findSelectedVertexForEditing(currentMode, pickInfo, completedShapes) {
    if (currentMode === "editVertex" && (pickInfo.hit && pickInfo.pickedMesh != ground)) {
        for (let shape of completedShapes) {
            for (let vertexPair of shape.vertexSpheres) {
                if (pickInfo.hit && (pickInfo.pickedMesh === vertexPair.bottom || pickInfo.pickedMesh === vertexPair.top)) {
                    setSelectedVertex(pickInfo.pickedMesh); // Set the selected vertex for dragging
                    setIsVertexEdit(true); // Enable vertex edit mode
                    camera.detachControl(canvas); // Disable camera movement during vertex editing
                    canvas.style.cursor = "grabbing"; // Change cursor to indicate vertex editing
                    break;
                }
            }
        }
    }
}

// Function to find the selected shape for movement
function findSelectedShapeForMovement(currentMode, pickInfo, completedShapes) {
    if (currentMode === "move" && (pickInfo.hit && pickInfo.pickedMesh != ground)) {
        for (let shape of completedShapes) {
            if (pickInfo.hit && pickInfo.pickedMesh === shape.extrudedMesh) {
                setDragStartPosition(pickInfo.pickedPoint); // Store initial drag position
                setSelectedShape(shape); // Mark this shape as selected for movement
                setIsDragging(true); // Enable dragging
                camera.detachControl(canvas); // Disable camera movement during drag
                canvas.style.cursor = "grabbing"; // Change cursor to indicate dragging
                break;
            }
        }
    }
}

// Function to update the position of the selected vertex
function updateSelectedVertexPosition(selectedVertex, pickInfo) {
    if (getIsVertexEdit() && selectedVertex) {
        const camera = scene.activeCamera;

        // Create a ray from the camera through the mouse point, used to determine where in 3D space the vertex should move
        const ray = scene.createPickingRay(scene.pointerX, scene.pointerY, BABYLON.Matrix.Identity(), camera);

        // Calculate new position based on camera ray intersection with movement plane
        const movementPlane = createMovementPlane(selectedVertex, camera);
        const newPosition = calculateNewVertexPosition(ray, movementPlane);

        if (newPosition) {
            const completedShapes = getCompletedShapes();

            // Update the position of the selected vertex
            for (let shape of completedShapes) {
                const selected = shape.vertexSpheres.find(v =>
                    v.bottom === selectedVertex || v.top === selectedVertex
                );

                if (selected) {
                    const index = shape.vertexSpheres.indexOf(selected);

                    // Update the position of only the selected vertex
                    if (selectedVertex === selected.bottom) {
                        selected.bottom.position = newPosition.clone();
                    } else {
                        selected.top.position = newPosition.clone();
                    }

                    // Update the shape's points array with the new bottom vertex position
                    shape.points[index] = selected.bottom.position.clone();

                    // Highlight the active vertex
                    selectedVertex.material.diffuseColor = new BABYLON.Color3(1, 0.8, 0); // Change to yellow color while moving

                    // Reconstruct the shape with the new vertex positions
                    reconstructExtrudedShape(shape, scene, completedShapes);
                    break;
                }
            }
        }
    }
}

// Function to create a movement plane for vertex editing
function createMovementPlane(vertex, camera) {
    // Get the camera's view direction and the vertex position by subtracting the camera position from the target
    const viewDirection = camera.getTarget().subtract(camera.position).normalize();
    // Get the vertex position
    const vertexPosition = vertex.position;

    // Create a plane perpendicular to the camera's view direction
    return {
        // Use the view direction as the normal for the plane
        normal: viewDirection,
        // Calculate the distance from the origin to the plane
        d: -BABYLON.Vector3.Dot(viewDirection, vertexPosition)
    };
}

// Function to calculate the new vertex position based on the camera ray and movement plane, Makes sure ray isn't parallel to plane (would cause division by zero)
function calculateNewVertexPosition(ray, plane) {
    const denominator = BABYLON.Vector3.Dot(ray.direction, plane.normal);

    // Calculate intersection between ray and movement plane
    if (Math.abs(denominator) > 0.0001) {
        // Ray intersection formula: P = (A + t * B) where P is the intersection point, A is the ray origin, B is the ray direction, and t is the distance along the ray. 
        // d is the distance from the origin to the plane
        const t = -(BABYLON.Vector3.Dot(ray.origin, plane.normal) + plane.d) / denominator;
        if (t >= 0) {
            // Moves along the ray by a distance of t
            return ray.origin.add(ray.direction.scale(t));
        }
    }
    return null;
}

function reconstructExtrudedShape(shape, scene) {
    if (shape.extrudedMesh) {
        shape.extrudedMesh.dispose();
    }

    // Get all vertex positions for the shape
    const bottomVertices = shape.vertexSpheres.map(v => v.bottom.position);
    const topVertices = shape.vertexSpheres.map(v => v.top.position);

    // Create custom vertex data for the extruded shape
    const vertexData = new BABYLON.VertexData();
    const positions = [];
    const indices = [];
    const normals = [];

    // Add all vertices
    bottomVertices.forEach(v => positions.push(v.x, v.y, v.z));
    topVertices.forEach(v => positions.push(v.x, v.y, v.z));

    // Create indices for all faces
    const vertexCount = bottomVertices.length;

    // Create side faces
    for (let i = 0; i < vertexCount; i++) {
        const nextI = (i + 1) % vertexCount;
        const bottomIndex = i;
        const topIndex = i + vertexCount;
        const nextBottomIndex = nextI;
        const nextTopIndex = nextI + vertexCount;

        // First triangle of the side
        indices.push(bottomIndex, topIndex, nextBottomIndex);
        // Second triangle of the side
        indices.push(nextBottomIndex, topIndex, nextTopIndex);
    }

    // Create top and bottom faces
    for (let i = 1; i < vertexCount - 1; i++) {
        // Bottom face triangles
        indices.push(0, i + 1, i);
        // Top face triangles
        indices.push(vertexCount, vertexCount + i, vertexCount + i + 1);
    }

    // Calculate surface normals for lighting
    BABYLON.VertexData.ComputeNormals(positions, indices, normals);

    // Apply vertex data to mesh
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.normals = normals;

    // Create new 3D mesh
    const extrudedMesh = new BABYLON.Mesh("extrudedShape", scene);
    vertexData.applyToMesh(extrudedMesh);

    // Apply material
    // Create and configure material for consistent coloring
    const material = new BABYLON.StandardMaterial("shapeMaterial", scene);
    material.diffuseColor = new BABYLON.Color3(0.8, 0.5, 0.5); // Set the material color to red
    material.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1); // Reduce specular highlights
    material.ambientColor = new BABYLON.Color3(0.8, 0.5, 0.5); // Add ambient color
    material.emissiveColor = new BABYLON.Color3(0.1, 0.05, 0.05); // Add slight emission
    material.backFaceCulling = false;

    // Adjust material properties for more consistent lighting
    material.roughness = 1; // Reduce glossiness
    material.metallic = 0; // Remove metallic effect
    material.maxSimultaneousLights = 4; // Support multiple lights

    extrudedMesh.material = material;

    // Enable edge rendering for better visibility
    extrudedMesh.enableEdgesRendering();
    extrudedMesh.edgesWidth = 1.0;
    extrudedMesh.edgesColor = new BABYLON.Color4(1, 1, 1);

    // Update shape reference
    shape.extrudedMesh = extrudedMesh;
}

// Function to handle object movement
function handleObjectMovement(selectedShape, pickInfo) {
    if (getIsDragging() && selectedShape && pickInfo.hit && pickInfo.pickedMesh === ground) {

        // Change the color to indicate the object is being grabbed
        selectedShape.extrudedMesh.material.diffuseColor = new BABYLON.Color3(0.3, 0.5, 0.9); // Change to a bluish color while moving
        const dragStart = getDragStartPosition();
        const dragOffset = pickInfo.pickedPoint.subtract(dragStart);
        canvas.style.cursor = "grabbing";

        // Update the extruded mesh's position with the offset, only in X and Z directions
        selectedShape.extrudedMesh.position.x += dragOffset.x;
        selectedShape.extrudedMesh.position.z += dragOffset.z;


        // Update the points array based on updated vertices
        let points = selectedShape.points;
        points = points.map(point => new BABYLON.Vector3(
            point.x + dragOffset.x,
            point.y, // Keep Y consistent
            point.z + dragOffset.z
        ));
        // Update drag start position for continuous movement
        setDragStartPosition(pickInfo.pickedPoint);

        // Move the vertex spheres as well
        selectedShape.vertexSpheres.forEach((vertexPair) => {
            // Move both top and bottom vertex spheres
            vertexPair.bottom.position.x += dragOffset.x;
            vertexPair.bottom.position.z += dragOffset.z;

            vertexPair.top.position.x += dragOffset.x;
            vertexPair.top.position.z += dragOffset.z;
        });
        setSelectedShape(selectedShape); // Update the selected shape
        let completedShapes = getCompletedShapes();
        for (let shape of completedShapes) {
            if (shape === selectedShape) {
                const index = completedShapes.indexOf(shape);
                completedShapes[index].mesh.dispose();
                updateShapePoints(index, points);
                setCompletedShapes(completedShapes);
                console.log("aaaaasdcdUpdated completedShapes at index:", index);
                break;
            }
        }

    }
}

// Function to handle pointer up event for object movement
function handlePointerUpEventForMove(selectedShape, camera, canvas) {
    setIsDragging(false);
    setDragStartPosition(null);
    // Make sure selectedShape is defined before updating its material
    if (selectedShape.extrudedMesh && selectedShape.extrudedMesh.material) {
        // Reset the color back to its original state
        selectedShape.extrudedMesh.material.diffuseColor = new BABYLON.Color3(0.8, 0.5, 0.5);  // Set to original color
    }

    camera.attachControl(canvas); // Re-enable camera control after drag
    canvas.style.cursor = "default"; // Reset cursor to default after drag

    if (selectedShape.points && selectedShape.points.length > 0) {
        const closedPoints = [...selectedShape.points, selectedShape.points[0]];  // Closing the loop

        // Check if points are valid before creating the shape
        if (closedPoints.some(point => !point || point.x === undefined || point.z === undefined)) {
            console.error("Invalid point found in closedPoints:", closedPoints);
            return;  // Exit the function to avoid errors
        }
        // Update the completedShapes[] array with the new shape details
        let completedShapes = getCompletedShapes();
        const shapeIndex = completedShapes.findIndex(shape => shape === selectedShape);

        if (shapeIndex !== -1) {
            // Update the points and shapeMesh in completedShapes[] array
            completedShapes[shapeIndex] = selectedShape;
            setCompletedShapes(completedShapes);  // Save the updated `completedShapes[]` array
        }
    } else {
        console.warn("No valid points available to create a closed shape.");
    }

    setIsDragging(false);
    setSelectedShape(null); // Deselect the shape
    setCurrentScene(false);
}