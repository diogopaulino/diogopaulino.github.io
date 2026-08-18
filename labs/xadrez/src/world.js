/**
 * Atelier — tabuleiro laqueado, mesa de mogno, piso de mármore com reflexo em Babylon.js.
 *
 * Casa = 1 u. Origem no centro. Brancas em z positivo.
 * Destaques: disco de lance legal, anel de captura, brilho de seleção e xeque.
 */

import { fileOf, rankOf } from './engine.js';

export const SQUARE = 1;
const ORIGIN = 3.5;

export function squareToWorld(index, flip = false) {
    let f = fileOf(index);
    let r = rankOf(index);
    if (flip) {
        f = 7 - f;
        r = 7 - r;
    }
    return {
        x: f - ORIGIN,
        z: ORIGIN - r
    };
}

export function worldToSquare(x, z, flip = false) {
    let f = Math.round(x + ORIGIN);
    let r = Math.round(ORIGIN - z);
    if (flip) {
        f = 7 - f;
        r = 7 - r;
    }
    if (f < 0 || f > 7 || r < 0 || r > 7) return -1;
    return r * 8 + f;
}

function makePhysMat(BABYLON, name, scene, texMap, extra = {}) {
    const mat = new BABYLON.PBRMaterial(name, scene);
    if (texMap) {
        if (texMap.map) mat.albedoTexture = texMap.map;
        if (texMap.normalMap) mat.bumpTexture = texMap.normalMap;
    }
    mat.roughness = extra.roughness !== undefined ? extra.roughness : 0.35;
    mat.metallic = extra.metallic !== undefined ? extra.metallic : 0.04;
    mat.clearCoat.isEnabled = true;
    mat.clearCoat.intensity = extra.clearcoat !== undefined ? extra.clearcoat : 0.6;
    mat.clearCoat.roughness = 0.2;
    if (extra.color) {
        mat.albedoColor = extra.color;
    }
    return mat;
}

export function buildWorld(BABYLON, scene, tex, quality) {
    const lightMat = makePhysMat(BABYLON, 'mat_sq_light', scene, tex.maple, {
        color: new BABYLON.Color3(0.96, 0.87, 0.73),
        clearcoat: 0.8,
        roughness: 0.3
    });
    const darkMat = makePhysMat(BABYLON, 'mat_sq_dark', scene, tex.walnut, {
        color: new BABYLON.Color3(0.32, 0.16, 0.08),
        clearcoat: 0.8,
        roughness: 0.35
    });

    const squares = [];
    for (let r = 0; r < 8; r++) {
        for (let f = 0; f < 8; f++) {
            const dark = (f + r) % 2 === 0;
            const sq = BABYLON.MeshBuilder.CreateBox(`sq_${r}_${f}`, {
                width: SQUARE * 0.985,
                height: 0.07,
                depth: SQUARE * 0.985
            }, scene);
            sq.position.set(f - ORIGIN, 0.035, ORIGIN - r);
            sq.material = dark ? darkMat : lightMat;
            sq.receiveShadows = true;
            sq.metadata = { kind: 'square', index: r * 8 + f };
            sq.isPickable = true;
            squares.push(sq);
        }
    }

    // Moldura do tabuleiro (Mogno laqueado)
    const frameMat = makePhysMat(BABYLON, 'mat_frame', scene, tex.mahogany, {
        color: new BABYLON.Color3(0.30, 0.14, 0.08),
        clearcoat: 0.85,
        roughness: 0.25
    });
    const frame = BABYLON.MeshBuilder.CreateBox('board_frame', {
        width: 9.25,
        height: 0.16,
        depth: 9.25
    }, scene);
    frame.position.y = -0.06;
    frame.material = frameMat;
    frame.receiveShadows = true;
    frame.isPickable = false;

    // Feltro sob as casas
    const feltMat = new BABYLON.PBRMaterial('mat_felt', scene);
    feltMat.albedoColor = new BABYLON.Color3(0.08, 0.28, 0.16);
    feltMat.roughness = 0.95;
    feltMat.metallic = 0.0;
    const felt = BABYLON.MeshBuilder.CreateBox('board_felt', {
        width: 8.04,
        height: 0.02,
        depth: 8.04
    }, scene);
    felt.position.y = 0.0;
    felt.material = feltMat;
    felt.isPickable = false;

    // Mesa de mogno
    const tableMat = makePhysMat(BABYLON, 'mat_table', scene, tex.mahogany, {
        color: new BABYLON.Color3(0.24, 0.10, 0.06),
        roughness: 0.16,
        clearcoat: 0.95
    });
    const table = BABYLON.MeshBuilder.CreateBox('table_top', {
        width: 16,
        height: 0.28,
        depth: 12
    }, scene);
    table.position.y = -0.28;
    table.material = tableMat;
    table.receiveShadows = true;
    table.isPickable = false;

    // Pés da mesa
    const legMat = makePhysMat(BABYLON, 'mat_leg', scene, tex.mahogany, {
        color: new BABYLON.Color3(0.18, 0.08, 0.04),
        roughness: 0.3
    });
    for (const [x, z] of [[-6.8, -4.6], [6.8, -4.6], [-6.8, 4.6], [6.8, 4.6]]) {
        const leg = BABYLON.MeshBuilder.CreateCylinder(`leg_${x}_${z}`, {
            height: 2.4,
            diameterTop: 0.44,
            diameterBottom: 0.56,
            tessellation: 16
        }, scene);
        leg.position.set(x, -1.62, z);
        leg.material = legMat;
        leg.isPickable = false;
    }

    // Tapete de veludo bordô sob a mesa
    const rugMat = new BABYLON.PBRMaterial('mat_rug', scene);
    rugMat.albedoColor = new BABYLON.Color3(0.42, 0.10, 0.10);
    rugMat.roughness = 0.92;
    rugMat.metallic = 0.0;
    const rug = BABYLON.MeshBuilder.CreateDisc('rug', {
        radius: 7.5,
        tessellation: 48
    }, scene);
    rug.rotation.x = Math.PI / 2;
    rug.position.y = -2.83;
    rug.material = rugMat;
    rug.receiveShadows = true;
    rug.isPickable = false;

    // Piso de mármore do salão
    const floorMat = makePhysMat(BABYLON, 'mat_floor', scene, tex.marble, {
        color: new BABYLON.Color3(0.85, 0.82, 0.78),
        roughness: 0.14,
        clearcoat: 0.9,
        metallic: 0.05
    });
    const floor = BABYLON.MeshBuilder.CreateDisc('floor', {
        radius: 18,
        tessellation: 64
    }, scene);
    floor.rotation.x = Math.PI / 2;
    floor.position.y = -2.85;
    floor.material = floorMat;
    floor.receiveShadows = true;
    floor.isPickable = false;

    const marks = buildMarks(BABYLON, scene);

    return { squares, frame, table, floor, marks };
}

function buildMarks(BABYLON, scene) {
    const dotMat = new BABYLON.StandardMaterial('mat_mark_dot', scene);
    dotMat.diffuseColor = new BABYLON.Color3(0.15, 0.85, 0.45);
    dotMat.emissiveColor = new BABYLON.Color3(0.2, 0.75, 0.35);
    dotMat.alpha = 0.85;

    const capMat = new BABYLON.StandardMaterial('mat_mark_cap', scene);
    capMat.diffuseColor = new BABYLON.Color3(0.95, 0.25, 0.25);
    capMat.emissiveColor = new BABYLON.Color3(0.85, 0.15, 0.15);
    capMat.alpha = 0.9;

    const selMat = new BABYLON.StandardMaterial('mat_mark_sel', scene);
    selMat.diffuseColor = new BABYLON.Color3(0.95, 0.8, 0.2);
    selMat.emissiveColor = new BABYLON.Color3(0.85, 0.65, 0.1);
    selMat.alpha = 0.85;

    const lastMat = new BABYLON.StandardMaterial('mat_mark_last', scene);
    lastMat.diffuseColor = new BABYLON.Color3(0.85, 0.65, 0.2);
    lastMat.emissiveColor = new BABYLON.Color3(0.5, 0.35, 0.1);
    lastMat.alpha = 0.45;

    const checkMat = new BABYLON.StandardMaterial('mat_mark_check', scene);
    checkMat.diffuseColor = new BABYLON.Color3(1.0, 0.1, 0.1);
    checkMat.emissiveColor = new BABYLON.Color3(0.9, 0.05, 0.05);
    checkMat.alpha = 0.85;

    const hintMat = new BABYLON.StandardMaterial('mat_mark_hint', scene);
    hintMat.diffuseColor = new BABYLON.Color3(0.3, 0.85, 1.0);
    hintMat.emissiveColor = new BABYLON.Color3(0.2, 0.6, 0.9);
    hintMat.alpha = 0.9;

    const dots = [];
    for (let i = 0; i < 28; i++) {
        const d = BABYLON.MeshBuilder.CreateDisc(`dot_${i}`, { radius: 0.16, tessellation: 24 }, scene);
        d.rotation.x = Math.PI / 2;
        d.material = dotMat;
        d.isVisible = false;
        d.isPickable = false;
        dots.push(d);
    }

    const caps = [];
    for (let i = 0; i < 16; i++) {
        const c = BABYLON.MeshBuilder.CreateTorus(`cap_${i}`, { diameter: 0.82, thickness: 0.06, tessellation: 32 }, scene);
        c.material = capMat;
        c.isVisible = false;
        c.isPickable = false;
        caps.push(c);
    }

    const select = BABYLON.MeshBuilder.CreateTorus('mark_select', { diameter: 0.88, thickness: 0.07, tessellation: 32 }, scene);
    select.material = selMat;
    select.isVisible = false;
    select.isPickable = false;

    const lastFrom = BABYLON.MeshBuilder.CreateDisc('mark_last_from', { radius: 0.44, tessellation: 4 }, scene);
    lastFrom.rotation.x = Math.PI / 2;
    lastFrom.rotation.y = Math.PI / 4;
    lastFrom.material = lastMat;
    lastFrom.isVisible = false;
    lastFrom.isPickable = false;

    const lastTo = BABYLON.MeshBuilder.CreateDisc('mark_last_to', { radius: 0.44, tessellation: 4 }, scene);
    lastTo.rotation.x = Math.PI / 2;
    lastTo.rotation.y = Math.PI / 4;
    lastTo.material = lastMat;
    lastTo.isVisible = false;
    lastTo.isPickable = false;

    const check = BABYLON.MeshBuilder.CreateTorus('mark_check', { diameter: 0.92, thickness: 0.08, tessellation: 32 }, scene);
    check.material = checkMat;
    check.isVisible = false;
    check.isPickable = false;

    const hint = BABYLON.MeshBuilder.CreateTorus('mark_hint', { diameter: 0.86, thickness: 0.06, tessellation: 32 }, scene);
    hint.material = hintMat;
    hint.isVisible = false;
    hint.isPickable = false;

    return { dots, caps, select, lastFrom, lastTo, check, hint };
}

export function placeMark(mesh, index, flip = false) {
    if (!mesh || index < 0) return;
    const pos = squareToWorld(index, flip);
    mesh.position.set(pos.x, 0.075, pos.z);
    mesh.isVisible = true;
}

export function setupLights(BABYLON, scene, quality) {
    // Luz ambiente suave — intensidade mais alta e chão mais claro para que o
    // ébano (muito escuro) não vire silhueta pura nas áreas de sombra.
    const hemi = new BABYLON.HemisphericLight('hemi_light', new BABYLON.Vector3(0, 1, 0), scene);
    hemi.diffuse = new BABYLON.Color3(0.78, 0.73, 0.66);
    hemi.groundColor = new BABYLON.Color3(0.38, 0.32, 0.26);
    hemi.intensity = 1.05;

    // Sol / Luz direcionada com sombras
    const sun = new BABYLON.DirectionalLight('sun_light', new BABYLON.Vector3(-4, -10, 6).normalize(), scene);
    sun.position = new BABYLON.Vector3(8, 18, -12);
    sun.diffuse = new BABYLON.Color3(1.0, 0.95, 0.88);
    sun.intensity = 1.5;

    let shadowGen = null;
    if (quality.shadows) {
        shadowGen = new BABYLON.ShadowGenerator(quality.shadowMap || 2048, sun);
        shadowGen.usePoissonSampling = true;
        shadowGen.bias = 0.001;
        shadowGen.normalBias = 0.002;
        shadowGen.darkness = 0.35;
    }

    // Luz de preenchimento fria, do lado oposto ao sol — sem ela o lado
    // sombreado das peças (sobretudo as de ébano) desaparecia em preto puro.
    const fill = new BABYLON.DirectionalLight('fill_light', new BABYLON.Vector3(5, -6, -8).normalize(), scene);
    fill.diffuse = new BABYLON.Color3(0.55, 0.60, 0.68);
    fill.specular = new BABYLON.Color3(0.2, 0.2, 0.24);
    fill.intensity = 0.55;

    // Ponto de luz quente sobre a mesa
    const warmLamp = new BABYLON.PointLight('warm_lamp', new BABYLON.Vector3(0, 5, 0), scene);
    warmLamp.diffuse = new BABYLON.Color3(1.0, 0.85, 0.65);
    warmLamp.intensity = 0.7;
    warmLamp.range = 14;

    return { hemi, sun, fill, shadowGen, warmLamp };
}

/**
 * Ambiente de reflexo procedural (sem HDR externo): um "cubemap" simples,
 * claro em cima e escuro embaixo, só para o PBR (clearcoat/sheen) ter algo
 * para refletir. Sem isso, materiais escuros como o ébano ficam achatados.
 */
export function setupEnvironment(BABYLON, scene) {
    const size = 64;
    const face = (top, bottom) => {
        const el = document.createElement('canvas');
        el.width = size;
        el.height = size;
        const ctx = el.getContext('2d');
        const g = ctx.createLinearGradient(0, 0, 0, size);
        g.addColorStop(0, top);
        g.addColorStop(1, bottom);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, size, size);
        return el.toDataURL('image/png');
    };
    const side = face('#8c7c68', '#171310');
    const top = face('#e4d3ac', '#8c7c68');
    const bottom = face('#171310', '#050403');
    const env = BABYLON.CubeTexture.CreateFromImages([side, side, top, bottom, side, side], scene);
    scene.environmentTexture = env;
    scene.environmentIntensity = 0.65;
    return env;
}

export function setupPostProcess(BABYLON, scene, quality) {
    const pipe = new BABYLON.DefaultRenderingPipeline('pipeline', true, scene, [scene.activeCamera]);
    pipe.samples = quality.pr > 1 ? 4 : 1;
    pipe.fxaaEnabled = true;

    // Bloom elegante para destaques e reflexos
    pipe.bloomEnabled = true;
    pipe.bloomThreshold = 0.78;
    pipe.bloomWeight = 0.25;
    pipe.bloomKernel = 64;

    // Tonemapping e contraste
    pipe.imageProcessing.toneMappingEnabled = true;
    pipe.imageProcessing.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
    pipe.imageProcessing.contrast = 1.15;
    pipe.imageProcessing.exposure = 1.05;

    // Glow Layer para anéis e discos de lance legal
    const glow = new BABYLON.GlowLayer('glow', scene);
    glow.intensity = 0.65;

    return { pipe, glow };
}
