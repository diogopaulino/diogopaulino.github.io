/**
 * Céu procedural (gradiente em domo) e sistema de iluminação/sombras no Babylon.js.
 */

const B = window.BABYLON;

export function hexToColor3(hex) {
    if (typeof hex === 'string') {
        return B.Color3.FromHexString(hex.startsWith('#') ? hex : `#${hex}`);
    }
    const r = ((hex >> 16) & 255) / 255;
    const g = ((hex >> 8) & 255) / 255;
    const b = (hex & 255) / 255;
    return new B.Color3(r, g, b);
}

export function hexToColor4(hex, alpha = 1) {
    const c = hexToColor3(hex);
    return new B.Color4(c.r, c.g, c.b, alpha);
}

export function createSky(scene) {
    const dome = B.MeshBuilder.CreateSphere('skyDome', { diameter: 700, segments: 16, sideOrientation: B.Mesh.BACKSIDE }, scene);
    dome.isPickable = false;
    dome.infiniteDistance = true;

    const skyMat = new B.StandardMaterial('skyMat', scene);
    skyMat.disableLighting = true;
    skyMat.backFaceCulling = false;
    skyMat.specularColor = new B.Color3(0, 0, 0);

    const dynamicTex = new B.DynamicTexture('skyTex', { width: 128, height: 256 }, scene, false);
    skyMat.emissiveTexture = dynamicTex;
    dome.material = skyMat;

    return {
        mesh: dome,
        texture: dynamicTex,
        material: skyMat
    };
}

export function applyChapterSky(sky, chapter, scene) {
    const topCol = hexToColor3(chapter.clear);
    const midCol = hexToColor3(chapter.fog.color);
    const botCol = hexToColor3(chapter.hemi.ground);

    const ctx = sky.texture.getContext();
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, topCol.toHexString());
    grad.addColorStop(0.5, midCol.toHexString());
    grad.addColorStop(1, botCol.toHexString());

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 256);
    sky.texture.update(false);

    if (scene) {
        scene.clearColor = hexToColor4(chapter.clear, 1);
        scene.fogMode = B.Scene.FOGMODE_LINEAR;
        scene.fogStart = chapter.fog.near;
        scene.fogEnd = chapter.fog.far;
        scene.fogColor = hexToColor3(chapter.fog.color);

        if (scene.imageProcessingConfiguration) {
            scene.imageProcessingConfiguration.toneMappingEnabled = true;
            scene.imageProcessingConfiguration.toneMappingType = B.ImageProcessingConfiguration.TONEMAPPING_ACES;
            scene.imageProcessingConfiguration.exposure = chapter.exposure ?? 1.15;
            scene.imageProcessingConfiguration.contrast = 1.1;
        }
    }
}

export function createLights(scene, chapter, quality) {
    const hemi = new B.HemisphericLight('hemiLight', new B.Vector3(0, 1, 0), scene);
    hemi.diffuse = hexToColor3(chapter.hemi.sky);
    hemi.groundColor = hexToColor3(chapter.hemi.ground);
    hemi.intensity = chapter.hemi.intensity ?? 0.85;

    const sunDir = new B.Vector3(
        -chapter.sun.dir[0],
        -chapter.sun.dir[1],
        -chapter.sun.dir[2]
    ).normalize();

    const dir = new B.DirectionalLight('sunLight', sunDir, scene);
    dir.position = new B.Vector3(
        chapter.sun.dir[0] * 70,
        chapter.sun.dir[1] * 70,
        chapter.sun.dir[2] * 70
    );
    dir.diffuse = hexToColor3(chapter.sun.color);
    dir.intensity = chapter.sun.intensity ?? 2.0;

    let shadow = null;
    if (quality.shadows) {
        shadow = new B.ShadowGenerator(quality.shadowSize, dir);
        shadow.useBlurExponentialShadowMap = true;
        shadow.blurKernel = quality.shadowSize >= 2048 ? 24 : 14;
        shadow.bias = 0.0006;
        shadow.normalBias = 0.03;
        shadow.darkness = 0.35;
    }

    return {
        dir,
        hemi,
        shadow,
        addShadow(mesh, receive = true) {
            if (!mesh) return mesh;
            if (shadow) shadow.addShadowCaster(mesh);
            mesh.receiveShadows = Boolean(receive && quality.shadows);
            return mesh;
        },
        dispose() {
            if (shadow) shadow.dispose();
            dir.dispose();
            hemi.dispose();
        }
    };
}

