/**
 * Modelos 3D e Sprites 2D para Honor Front (hyper-realistic).
 * Removemos as formas geométricas em favor de modelos GLB e planos PBR.
 */

export async function loadAssets(BABYLON, scene) {
    const assets = {};

    // 1. Carregar Xbot como Soldado Inimigo
    const soldierRes = await BABYLON.SceneLoader.ImportMeshAsync("", "assets/", "soldier.glb", scene);
    assets.soldier = soldierRes.meshes[0];
    assets.soldier.scaling.set(0.9, 0.9, 0.9);
    assets.soldier.position.y = -100; // Esconder original
    
    // Deixar a farda verde (feldgrau) no Xbot
    assets.soldier.getChildMeshes().forEach(m => {
        if (m.material && m.material.albedoColor) {
            m.material.albedoColor = new BABYLON.Color3(0.25, 0.35, 0.25);
            m.material.roughness = 0.8;
            m.material.metallic = 0.1;
        }
    });

    // 2. Carregar Barril como Obstáculo
    const barrelRes = await BABYLON.SceneLoader.ImportMeshAsync("", "assets/", "barrel.glb", scene);
    assets.barrel = barrelRes.meshes[0];
    assets.barrel.scaling.set(0.015, 0.015, 0.015); // Barrel costuma ser gigante no Babylon
    assets.barrel.position.y = -100;

    // 3. Carregar Casa como Bunker/Defesa
    const houseRes = await BABYLON.SceneLoader.ImportMeshAsync("", "assets/", "house.glb", scene);
    assets.house = houseRes.meshes[0];
    assets.house.scaling.set(1.5, 1.5, 1.5);
    assets.house.position.y = -100;
    
    // 4. Armas como Billboards na Câmera (estilo Doom hyper-realista)
    const garandTex = new BABYLON.Texture("assets/garand.jpg", scene);
    garandTex.hasAlpha = true;
    
    const thompsonTex = new BABYLON.Texture("assets/thompson.jpg", scene);
    thompsonTex.hasAlpha = true;
    
    const garandMat = new BABYLON.StandardMaterial("garandMat", scene);
    garandMat.diffuseTexture = garandTex;
    garandMat.emissiveTexture = garandTex;
    garandMat.useAlphaFromDiffuseTexture = false;
    // O Jpeg tem fundo branco. Usar multiply torna o branco transparente.
    garandMat.alphaMode = BABYLON.Engine.ALPHA_MULTIPLY;
    garandMat.disableLighting = true;
    
    const thompsonMat = new BABYLON.StandardMaterial("thompsonMat", scene);
    thompsonMat.diffuseTexture = thompsonTex;
    thompsonMat.emissiveTexture = thompsonTex;
    thompsonMat.alphaMode = BABYLON.Engine.ALPHA_MULTIPLY;
    thompsonMat.disableLighting = true;

    const garandPlane = BABYLON.MeshBuilder.CreatePlane("garand_view", {width: 0.6, height: 0.6}, scene);
    garandPlane.material = garandMat;
    garandPlane.position.set(0.18, -0.15, 0.5);
    garandPlane.setEnabled(false);
    assets.garandView = garandPlane;

    const thompsonPlane = BABYLON.MeshBuilder.CreatePlane("thompson_view", {width: 0.7, height: 0.7}, scene);
    thompsonPlane.material = thompsonMat;
    thompsonPlane.position.set(0.15, -0.18, 0.6);
    thompsonPlane.setEnabled(false);
    assets.thompsonView = thompsonPlane;

    return assets;
}
