/**
 * Fauna africana realista em Babylon.js para Safari Dourado usando Billboards.
 */

function createBillboard(BABYLON, scene, name, imageUrl, width, height, yOffset) {
    const root = new BABYLON.TransformNode(name + '_root', scene);
    
    const plane = BABYLON.MeshBuilder.CreatePlane(name + '_plane', { width, height }, scene);
    plane.position.y = height / 2 + yOffset;
    plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_Y;
    
    const mat = new BABYLON.StandardMaterial('mat_' + name, scene);
    const tex = new BABYLON.Texture(imageUrl, scene);
    tex.hasAlpha = true;
    mat.diffuseTexture = tex;
    mat.specularColor = new BABYLON.Color3(0, 0, 0);
    mat.emissiveColor = new BABYLON.Color3(0.1, 0.1, 0.1); // slight ambient
    mat.backFaceCulling = false;
    
    plane.material = mat;
    plane.parent = root;
    
    return { root, plane };
}

export function buildGiraffe(BABYLON, scene) {
    const { root, plane } = createBillboard(BABYLON, scene, 'giraffe', '/labs/safari-dourado/assets/giraffe.png', 4.5, 6.0, 0);
    return { root, body: plane, species: 'giraffe', name: 'Girafa-da-savana' };
}

export function buildElephant(BABYLON, scene) {
    const { root, plane } = createBillboard(BABYLON, scene, 'elephant', '/labs/safari-dourado/assets/elephant.png', 5.5, 4.0, 0);
    return { root, body: plane, species: 'elephant', name: 'Elefante-africano' };
}

export function buildZebra(BABYLON, scene) {
    const { root, plane } = createBillboard(BABYLON, scene, 'zebra', '/labs/safari-dourado/assets/zebra.png', 3.0, 2.5, 0);
    return { root, body: plane, species: 'zebra', name: 'Zebra-da-planície' };
}
