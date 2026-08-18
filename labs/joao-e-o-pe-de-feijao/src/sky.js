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

    const dynamicTex = new B.DynamicTexture('skyTex', { width: 256, height: 512 }, scene, false);
    skyMat.emissiveTexture = dynamicTex;
    dome.material = skyMat;

    try {
        scene.environmentTexture = B.CubeTexture.CreateFromPrefilteredData(
            'https://assets.babylonjs.com/environments/environmentSpecular.env',
            scene
        );
        scene.environmentIntensity = 0.55;
    } catch (err) {
        /* IBL opcional: o conto segue com o sol direcional. */
    }

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
    const h = 512;
    const w = 256;
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, topCol.toHexString());
    grad.addColorStop(0.42, midCol.toHexString());
    grad.addColorStop(1, botCol.toHexString());
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    const night = chapter.id === 'night';
    if (night) {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        for (let i = 0; i < 80; i++) {
            const x = (Math.sin(i * 12.7) * 0.5 + 0.5) * w;
            const y = (Math.sin(i * 4.3) * 0.5 + 0.5) * h * 0.55;
            ctx.globalAlpha = 0.35 + (i % 5) * 0.12;
            ctx.beginPath();
            ctx.arc(x, y, 0.6 + (i % 3) * 0.4, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#f4f7ff';
        ctx.beginPath();
        ctx.arc(w * 0.28, h * 0.18, 18, 0, Math.PI * 2);
        ctx.fill();
    } else {
        ctx.fillStyle = chapter.id === 'escape' ? '#ffb060' : '#fff6c8';
        ctx.beginPath();
        ctx.arc(w * 0.7, h * 0.16, chapter.id === 'fair' ? 22 : 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.16)';
        for (let i = 0; i < 8; i++) {
            ctx.beginPath();
            ctx.ellipse(30 + i * 28, h * 0.38 + (i % 3) * 12, 28, 10, 0, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    sky.texture.update(false);

    if (scene) {
        scene.clearColor = hexToColor4(chapter.clear, 1);
        scene.fogMode = B.Scene.FOGMODE_LINEAR;
        scene.fogStart = chapter.fog.near;
        scene.fogEnd = chapter.fog.far;
        scene.fogColor = hexToColor3(chapter.fog.color);
        scene.environmentIntensity = night ? 0.16 : Math.max(0.32, (chapter.exposure ?? 1) * 0.4);

        if (scene.imageProcessingConfiguration) {
            scene.imageProcessingConfiguration.toneMappingEnabled = true;
            scene.imageProcessingConfiguration.toneMappingType = B.ImageProcessingConfiguration.TONEMAPPING_ACES;
            scene.imageProcessingConfiguration.exposure = chapter.exposure ?? 1.15;
            scene.imageProcessingConfiguration.contrast = 1.12;
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
        const webgl2 = scene.getEngine()?.webGLVersion >= 2;
        if (webgl2) {
            shadow.usePercentageCloserFiltering = true;
            shadow.filteringQuality = quality.id === 'high'
                ? B.ShadowGenerator.QUALITY_HIGH
                : B.ShadowGenerator.QUALITY_MEDIUM;
        } else {
            shadow.useBlurExponentialShadowMap = true;
            shadow.blurKernel = quality.shadowSize >= 2048 ? 24 : 14;
        }
        shadow.bias = 0.0008;
        shadow.normalBias = 0.04;
        shadow.darkness = 0.38;
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

