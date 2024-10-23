// State variables
let mode = "draw";
let previousMode = "draw";
let points = [];
let pointMarkers = [];
let completedShapes = [];
let extrudedMesh = null;
let previewLine = null;
let extrusionHeight = 3;
let isDragging = false;
let isVertexEdit = false;
let dragStartPosition = null;
let currentScene = true;
let selectedVertex = null;
let selectedShape = null;


// Getters
export function getMode() { return mode; }
export function getPoints() { return points; }
export function getPointMarkers() { return pointMarkers; }
export function getExtrudedMesh() { return extrudedMesh; }
export function getPreviewLine() { return previewLine; }
export function getExtrusionHeight() { return extrusionHeight; }
export function getIsDragging() { return isDragging; }
export function getIsVertexEdit() { return isVertexEdit; }
export function getDragStartPosition() { return dragStartPosition; }
export function getCurrentScene() { return currentScene; }
export function getCompletedShapes() { return completedShapes; }
export function getSelectedShape() { return selectedShape; }
export function getSelectedVertex() { return selectedVertex; }

// Add getter for previous mode
export function getPreviousMode() { return previousMode; }


// Setters
export function setMode(newMode) {
    previousMode = mode;  // Store the current mode before updating
    mode = newMode;

    updateModeIndicator();

    // If we have access to camera and canvas (passed as optional parameters) to handle camera control
    if (arguments.length > 1) {
        const camera = arguments[1];
        const canvas = arguments[2];

        // Handle camera control when switching modes
        if (previousMode === "editVertex" && newMode !== "editVertex") {
            if (camera && canvas) {
                camera.attachControl(canvas, true); // Re-enable camera controls
            }
            // Reset vertex editing state
            isVertexEdit = false;
            selectedVertex = null;
            if (canvas) {
                canvas.style.cursor = "default";
            }
        }
    }
}
export function setPoints(newPoints) { points = newPoints; }
export function setPointMarkers(newPointMarkers) { pointMarkers = newPointMarkers; }
export function setExtrudedMesh(newExtrudedMesh) { extrudedMesh = newExtrudedMesh; }
export function setPreviewLine(newPreviewLine) { previewLine = newPreviewLine; }
export function setExtrusionHeight(newExtrusionHeight) { extrusionHeight = newExtrusionHeight; }
export function setIsDragging(newIsDragging) { isDragging = newIsDragging; }
export function setIsVertexEdit(newIsVertexEdit) { isVertexEdit = newIsVertexEdit; }
export function setDragStartPosition(newDragStartPosition) { dragStartPosition = newDragStartPosition; }
export function setCurrentScene(newCurrentScene) { currentScene = newCurrentScene; }
export function setCompletedShapes(newShapes) { completedShapes = newShapes; }
export function setSelectedShape(shape) { selectedShape = shape; }
export function setSelectedVertex(vertex) { selectedVertex = vertex; }


// Adders
export function addPoint(point) { points.push(point); }
export function addPointMarker(marker) { pointMarkers.push(marker); }
export function addCompletedShape(shapeMesh, shapePoints) { completedShapes.push({ mesh: shapeMesh, points: shapePoints }); }

// Function to update points for a shape (useful for vertex editing)
export function updateShapePoints(index, newPoints) {
    if (completedShapes[index]) {
        completedShapes[index].points = newPoints;
    }
}
function updateModeIndicator() {
    // Add a space before each uppercase letter, capitalize the first letter
    const formattedMode = mode
        .replace(/([A-Z])/g, ' $1') // Add space before uppercase letters
        .replace(/^./, str => str.toUpperCase()); // Capitalize the first letter

    document.getElementById("modeIndicator").textContent = `Current Mode: ${formattedMode}`;
}
