// Axis Setup
export function initializeAxis(scene) {
    const axisLength = 1;
    const axisOffset = new BABYLON.Vector3(-9.5, 0.1, -9.5);

    createAxis("xAxis", new BABYLON.Vector3(1, 0, 0), new BABYLON.Color3(1, 0, 0), scene, axisOffset);
    createAxis("yAxis", new BABYLON.Vector3(0, 1, 0), new BABYLON.Color3(0, 1, 0), scene, axisOffset);
    createAxis("zAxis", new BABYLON.Vector3(0, 0, 1), new BABYLON.Color3(0, 0, 1), scene, axisOffset);
}
// Function to create an axis
function createAxis(name, direction, color, scene, offset) {
    const axis = BABYLON.MeshBuilder.CreateLines(name, {
        points: [BABYLON.Vector3.Zero(), direction.scale(1)]
    }, scene);
    axis.color = color;
    axis.position = offset;
}

// Create and position labels for axis
export function createAndPositionLabel(scene) {
    createTextLabel("X", "red", new BABYLON.Vector3(-9.5 + 1, 0.1, -9.5), scene);
    createTextLabel("Y", "green", new BABYLON.Vector3(-9.5, 0.1 + 1, -9.5), scene);
    createTextLabel("Z", "blue", new BABYLON.Vector3(-9.5, 0.1, -9.5 + 1), scene);
}

// Function to create a text label
function createTextLabel(text, color, position, scene) {

    const dynamicTexture = new BABYLON.DynamicTexture("DynamicTexture", { width: 64, height: 64 }, scene, true);
    dynamicTexture.hasAlpha = true;
    dynamicTexture.drawText(text, 5, 40, "bold 24px Arial", color, "transparent");

    const plane = BABYLON.MeshBuilder.CreatePlane("TextPlane", { size: 0.5 }, scene);
    plane.material = new BABYLON.StandardMaterial("TextPlaneMaterial", scene);
    plane.material.backFaceCulling = false;
    plane.material.diffuseTexture = dynamicTexture;
    plane.position = position;

}
