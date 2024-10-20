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
    getExtrusionHeight,
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
document.getElementById("drawMode").onclick = () => setMode("draw");
document.getElementById("extrudeShape").onclick = () => extrudeShape(scene);
document.getElementById("moveMode").onclick = () => setMode("move");
document.getElementById("vertexEditMode").onclick = () => setMode("editVertex");
document.getElementById("resetScene").onclick = () => resetScene(scene);

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
        if (currentMode === "move" && evt.button === 2) {
            return;
        }
        if (currentMode === "extrudeShape" && evt.button === 2) {
            return;
        }
        setIsVertexEdit(false);
        selectedShape = getSelectedShape();
        selectedVertex = getSelectedVertex();
        if (selectedShape && selectedVertex) {
            // Restore the color of the extruded shape to the original
            selectedShape.extrudedMesh.material.diffuseColor = new BABYLON.Color3(0.8, 0.5, 0.5); // Light red color
        }
        // Find the selected vertex pair (top and bottom spheres)
        const selected = selectedShape.vertexSpheres.find(v => v.bottom === selectedVertex || v.top === selectedVertex);
        if (selected) {
            selected.bottom.material.diffuseColor = new BABYLON.Color3(0, 1, 1); // Change to teal color after moving
            selected.top.material.diffuseColor = new BABYLON.Color3(0, 1, 1); // Change to teal color after moving
        }
        camera.attachControl(canvas); // Re-enable camera control after drag
        canvas.style.cursor = "default"; // Reset cursor to default after drag
        setSelectedVertex(null);
        setCurrentScene(false);
    }
});

// Run Render Loop
engine.runRenderLoop(() => scene.render());
window.addEventListener("resize", () => engine.resize());

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
    if (getIsVertexEdit() && selectedVertex && pickInfo.hit && pickInfo.pickedMesh === ground) {
        // Move the selected vertex to the new position
        selectedVertex.position.x = pickInfo.pickedPoint.x;
        selectedVertex.position.z = pickInfo.pickedPoint.z;

        // Find the shape that this vertex belongs to and update its points
        const completedShapes = getCompletedShapes();

        for (let shape of completedShapes) {
            // Find the corresponding vertex in the shape's vertexSpheres array
            const selected = shape.vertexSpheres.find(v => v.bottom === selectedVertex || v.top === selectedVertex);

            if (selected) {
                // Calculate the index of the vertex sphere in the shape.points array
                const index = shape.vertexSpheres.indexOf(selected);

                // Update the positions of the selected vertex
                updateSelectedVertexPositions(selectedVertex, selected, shape, index);

                // Dispose of the old extruded mesh and re-extrude the shape based on the new vertex positions
                if (shape.extrudedMesh) shape.extrudedMesh.dispose();

                // Re-extrude the shape based on the updated points
                reExtrudeAndRenderShape(shape, scene, completedShapes);
                break;
            }
        }
    }
}

// Function to update the positions of the selected vertex
function updateSelectedVertexPositions(selectedVertex, selected, shape, index) {
    // If we are editing the bottom vertex
    if (selectedVertex === selected.bottom) {
        selected.bottom.material.diffuseColor = new BABYLON.Color3(1, 0.8, 0); // Change to blue color while moving

        // Update the top sphere to match the bottom's X and Z
        selected.top.position.x = selected.bottom.position.x;
        selected.top.position.z = selected.bottom.position.z;
    }


    // If we are editing the top vertex
    else if (selectedVertex === selected.top) {
        // Update the bottom sphere to match the top's X and Z
        selected.top.material.diffuseColor = new BABYLON.Color3(1, 0.8, 0); // Change to blue color while moving
        selected.bottom.position.x = selected.top.position.x;
        selected.bottom.position.z = selected.top.position.z;
    }

    // Update the corresponding points in the shape's points array
    shape.points[index] = new BABYLON.Vector3(
        selected.bottom.position.x,
        0, // Bottom vertex (Y = 0)
        selected.bottom.position.z
    );
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

// Function to re-extrude and render the shape based on the updated points
function reExtrudeAndRenderShape(shape, scene, completedShapes) {
    shape.extrudedMesh = BABYLON.MeshBuilder.ExtrudePolygon("extrudedPolygon", {
        shape: shape.points,
        depth: getExtrusionHeight(),
        sideOrientation: BABYLON.Mesh.DOUBLESIDE,
        cap: BABYLON.Mesh.CAP_ALL
    }, scene);
    shape.extrudedMesh.position.y = getExtrusionHeight(); // Set base Y position for the extruded mesh
    const extrusionMaterial = new BABYLON.StandardMaterial("extrusionMaterial", scene);
    extrusionMaterial.diffuseColor = new BABYLON.Color3(0.3, 0.5, 0.9); // Set the material color to red
    shape.extrudedMesh.material = extrusionMaterial; // Set material for the new extruded shape


    // Add edge lines for better visibility
    shape.extrudedMesh.enableEdgesRendering();
    shape.extrudedMesh.edgesWidth = 1.0;
    shape.extrudedMesh.edgesColor = new BABYLON.Color4(1, 1, 1, 1); // White edges for better visibility

    const indexTwo = completedShapes.indexOf(shape);
    completedShapes[indexTwo].mesh.dispose();
    updateShapePoints(indexTwo, shape.points);
    setCompletedShapes(completedShapes);
    setSelectedShape(shape); // Update the selected shape
}