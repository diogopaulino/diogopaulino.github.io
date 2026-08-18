/**
 * Modelos 3D realistas e importados em Babylon.js para Safari Dourado:
 * Jipe 4x4 e árvores (Acácia e Baobá).
 */

export async function buildJeep(BABYLON, scene) {
    const root = new BABYLON.TransformNode('jeep_root', scene);
    root.position.y = 0;
    
    // Load realistic car model from BabylonJS meshes library
    const result = await BABYLON.SceneLoader.ImportMeshAsync("", "https://models.babylonjs.com/", "car.glb", scene);
    
    const car = result.meshes[0];
    car.parent = root;
    car.scaling.set(0.02, 0.02, 0.02); // Adjust scaling as needed
    car.position.y = 0;
    car.rotation.y = Math.PI; // Face forward
    
    return { root, chassis: car, wheels: {} }; // Return a mock wheels object since we won't animate them for now
}

export async function buildAcacia(BABYLON, scene) {
    const root = new BABYLON.TransformNode('acacia_root', scene);
    
    // Load a realistic tree model
    const result = await BABYLON.SceneLoader.ImportMeshAsync("", "https://models.babylonjs.com/villagePack/tree1/", "tree1.glb", scene);
    
    const tree = result.meshes[0];
    tree.parent = root;
    tree.scaling.set(0.015, 0.015, 0.015);
    
    return root;
}
