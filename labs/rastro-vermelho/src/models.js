/**
 * Modelos procedurais do deserto em Babylon.js:
 * Cactos saguaro, rochas de cânion vermelho, cercas de madeira, postes telegráficos.
 */

export function stdMat(BABYLON, name, colorHex, roughness = 0.7, scene) {
    const mat = new BABYLON.PBRMaterial(name, scene);
    mat.albedoColor = BABYLON.Color3.FromHexString(colorHex);
    mat.roughness = roughness;
    mat.metallic = 0.02;
    return mat;
}

export function buildCactus(BABYLON, scene) {
    const root = new BABYLON.TransformNode('cactus_root', scene);
    const mat = stdMat(BABYLON, 'mat_cactus', '#3c6e3b', 0.8, scene);

    const trunk = BABYLON.MeshBuilder.CreateCylinder('c_trunk', { height: 4.5, diameter: 0.6, tessellation: 8 }, scene);
    trunk.position.y = 2.25;
    trunk.material = mat;
    trunk.parent = root;

    // Braço esquerdo
    const armL1 = BABYLON.MeshBuilder.CreateCylinder('c_arm_l1', { height: 1.2, diameter: 0.45, tessellation: 8 }, scene);
    armL1.rotation.z = Math.PI / 2;
    armL1.position.set(-0.8, 2.5, 0);
    armL1.material = mat;
    armL1.parent = root;

    const armL2 = BABYLON.MeshBuilder.CreateCylinder('c_arm_l2', { height: 1.8, diameter: 0.45, tessellation: 8 }, scene);
    armL2.position.set(-1.3, 3.2, 0);
    armL2.material = mat;
    armL2.parent = root;

    // Braço direito
    const armR1 = BABYLON.MeshBuilder.CreateCylinder('c_arm_r1', { height: 1.2, diameter: 0.45, tessellation: 8 }, scene);
    armR1.rotation.z = Math.PI / 2;
    armR1.position.set(0.8, 1.8, 0);
    armR1.material = mat;
    armR1.parent = root;

    const armR2 = BABYLON.MeshBuilder.CreateCylinder('c_arm_r2', { height: 1.5, diameter: 0.45, tessellation: 8 }, scene);
    armR2.position.set(1.3, 2.4, 0);
    armR2.material = mat;
    armR2.parent = root;

    return root;
}

export function buildRock(BABYLON, scene) {
    const mat = stdMat(BABYLON, 'mat_canyon_rock', '#b85438', 0.85, scene);
    const rock = BABYLON.MeshBuilder.CreatePolyhedron('rock_mesh', { type: 1, size: 2.2 }, scene);
    rock.scaling.set(1.4, 0.9, 1.2);
    rock.material = mat;
    return rock;
}

export function buildTelegraph(BABYLON, scene) {
    const root = new BABYLON.TransformNode('tele_root', scene);
    const wood = stdMat(BABYLON, 'mat_tele_wood', '#4a3424', 0.85, scene);

    const pole = BABYLON.MeshBuilder.CreateCylinder('tele_pole', { height: 6.5, diameter: 0.35, tessellation: 6 }, scene);
    pole.position.y = 3.25;
    pole.material = wood;
    pole.parent = root;

    const cross = BABYLON.MeshBuilder.CreateBox('tele_cross', { width: 2.2, height: 0.25, depth: 0.25 }, scene);
    cross.position.set(0, 5.8, 0);
    cross.material = wood;
    cross.parent = root;

    return root;
}
