/**
 * Céu costeiro de amanhecer nublado e iluminação para Honor Front em Babylon.js.
 */

export function setupAtmosphere(BABYLON, scene) {
    // Neblina de praia e fumaça
    scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
    scene.fogDensity = 0.0075;
    scene.fogColor = new BABYLON.Color3(0.55, 0.60, 0.65);

    // Domo do céu
    const skyDome = BABYLON.MeshBuilder.CreateSphere('skyDome', { diameter: 700, segments: 24 }, scene);
    const skyMat = new BABYLON.StandardMaterial('mat_sky', scene);
    skyMat.backFaceCulling = false;
    skyMat.diffuseColor = new BABYLON.Color3(0, 0, 0);
    skyMat.emissiveColor = new BABYLON.Color3(0.48, 0.54, 0.62);
    skyMat.specularColor = new BABYLON.Color3(0, 0, 0);
    skyDome.material = skyMat;

    // Luz hemisférica ambiente
    const hemi = new BABYLON.HemisphericLight('hemi_light', new BABYLON.Vector3(0, 1, 0), scene);
    hemi.diffuse = new BABYLON.Color3(0.65, 0.70, 0.75);
    hemi.groundColor = new BABYLON.Color3(0.35, 0.32, 0.28);
    hemi.intensity = 1.1;

    // Luz solar suave do amanhecer
    const sun = new BABYLON.DirectionalLight('sun_light', new BABYLON.Vector3(0.3, -0.4, 0.8).normalize(), scene);
    sun.position = new BABYLON.Vector3(-40, 80, -120);
    sun.diffuse = new BABYLON.Color3(1.0, 0.88, 0.72);
    sun.intensity = 1.4;

    const shadowGen = new BABYLON.ShadowGenerator(2048, sun);
    shadowGen.usePoissonSampling = true;

    return { hemi, sun, shadowGen };
}
