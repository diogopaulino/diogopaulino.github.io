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
        if (texMap.roughnessMap && extra.useRoughnessMap !== false) {
            mat.metallicTexture = texMap.roughnessMap;
            mat.useRoughnessFromMetallicTextureAlpha = false;
            mat.useRoughnessFromMetallicTextureGreen = true;
            mat.useMetallnessFromMetallicTextureBlue = false;
        }
    }
    mat.roughness = extra.roughness !== undefined ? extra.roughness : 0.35;
    mat.metallic = extra.metallic !== undefined ? extra.metallic : 0.04;
    if (extra.environmentIntensity !== undefined) mat.environmentIntensity = extra.environmentIntensity;
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
        color: new BABYLON.Color3(1.0, 0.94, 0.84),
        clearcoat: 0.18,
        roughness: 0.44,
        environmentIntensity: 0.62
    });
    const darkMat = makePhysMat(BABYLON, 'mat_sq_dark', scene, tex.walnut, {
        color: new BABYLON.Color3(0.92, 0.86, 0.78),
        clearcoat: 0.16,
        roughness: 0.5,
        environmentIntensity: 0.62
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

    // As casas não precisam ser meshes individuais: a seleção usa o plano
    // matemático do tabuleiro como fallback. Duas malhas estáticas reduzem
    // drasticamente o custo de desenho sem perder precisão no toque.
    const lightSquares = BABYLON.Mesh.MergeMeshes(
        squares.filter((_, i) => {
            const f = i % 8;
            const r = Math.floor(i / 8);
            return (f + r) % 2 !== 0;
        }), true, true, undefined, false, false
    );
    const darkSquares = BABYLON.Mesh.MergeMeshes(
        squares.filter((_, i) => {
            const f = i % 8;
            const r = Math.floor(i / 8);
            return (f + r) % 2 === 0;
        }), true, true, undefined, false, false
    );
    for (const batch of [lightSquares, darkSquares]) {
        if (!batch) continue;
        batch.isPickable = false;
        batch.receiveShadows = true;
        batch.metadata = { kind: 'board-surface' };
    }

    // Moldura do tabuleiro (mogno laqueado). A base rebaixada deixa uma
    // sombra física entre a moldura, o feltro e o tampo — é ela que dá escala
    // ao conjunto em vez de fazer as casas parecerem uma textura plana.
    const frameMat = makePhysMat(BABYLON, 'mat_frame', scene, tex.mahogany, {
        color: new BABYLON.Color3(0.92, 0.78, 0.62),
        clearcoat: 0.52,
        roughness: 0.22,
        environmentIntensity: 0.45
    });
    const frame = BABYLON.MeshBuilder.CreateBox('board_frame', {
        width: 9.35,
        height: 0.2,
        depth: 9.35
    }, scene);
    frame.position.y = -0.08;
    frame.material = frameMat;
    frame.receiveShadows = true;
    frame.isPickable = false;

    const plinth = BABYLON.MeshBuilder.CreateBox('board_plinth', {
        width: 10.15,
        height: 0.16,
        depth: 10.15
    }, scene);
    plinth.position.y = -0.22;
    plinth.material = tableMatPlaceholder(BABYLON, scene, tex.mahogany);
    plinth.receiveShadows = true;
    plinth.isPickable = false;

    // Feltro sob as casas
    const feltMat = new BABYLON.PBRMaterial('mat_felt', scene);
    feltMat.albedoColor = new BABYLON.Color3(0.42, 0.72, 0.52);
    feltMat.albedoTexture = tex.felt?.map || null;
    feltMat.bumpTexture = tex.felt?.normalMap || null;
    feltMat.roughness = 0.94;
    feltMat.useAlphaFromAlbedoTexture = false;
    feltMat.metallic = 0.0;
    const felt = BABYLON.MeshBuilder.CreateBox('board_felt', {
        width: 8.04,
        height: 0.02,
        depth: 8.04
    }, scene);
    felt.position.y = 0.0;
    felt.material = feltMat;
    felt.isPickable = false;

    // Mesa de mogno: tampo, saia e travessas. O enquadramento costuma mostrar
    // mais mesa do que tabuleiro; esses volumes evitam que o entorno pareça
    // um plano infinito sem espessura.
    const tableMat = makePhysMat(BABYLON, 'mat_table', scene, tex.mahogany, {
        color: new BABYLON.Color3(0.78, 0.64, 0.49),
        roughness: 0.54,
        clearcoat: 0.14,
        environmentIntensity: 0.28,
        useRoughnessMap: false
    });
    const table = BABYLON.MeshBuilder.CreateBox('table_top', {
        width: 16,
        height: 0.34,
        depth: 12
    }, scene);
    table.position.y = -0.38;
    table.material = tableMat;
    table.receiveShadows = true;
    table.isPickable = false;

    // A prancha elevada lê melhor a luz de recorte e separa o objeto jogável
    // do tampo sem precisar de um contorno artificial.
    const tableLip = BABYLON.MeshBuilder.CreateBox('table_lip', {
        width: 15.7,
        height: 0.18,
        depth: 11.7
    }, scene);
    tableLip.position.y = -0.17;
    tableLip.material = tableMat;
    tableLip.receiveShadows = true;
    tableLip.isPickable = false;

    const apron = [
        { name: 'apron_front', width: 15.6, height: 1.05, depth: 0.24, x: 0, z: 5.72 },
        { name: 'apron_back', width: 15.6, height: 1.05, depth: 0.24, x: 0, z: -5.72 },
        { name: 'apron_left', width: 0.24, height: 1.05, depth: 11.2, x: -7.72, z: 0 },
        { name: 'apron_right', width: 0.24, height: 1.05, depth: 11.2, x: 7.72, z: 0 }
    ];
    apron.forEach(({ name, width, height, depth, x, z }) => {
        const rail = BABYLON.MeshBuilder.CreateBox(name, { width, height, depth }, scene);
        rail.position.set(x, -1.02, z);
        rail.material = tableMat;
        rail.receiveShadows = true;
        rail.isPickable = false;
    });

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

    // Tapete de veludo sob a mesa. A textura de feltro também evita o aspecto
    // de círculo sólido quando a câmera desce para o detalhe.
    const rugMat = new BABYLON.PBRMaterial('mat_rug', scene);
    rugMat.albedoColor = new BABYLON.Color3(0.46, 0.18, 0.12);
    rugMat.albedoTexture = tex.felt?.map || null;
    rugMat.bumpTexture = tex.felt?.normalMap || null;
    rugMat.roughness = 0.9;
    rugMat.metallic = 0.0;
    const rug = BABYLON.MeshBuilder.CreateDisc('rug', {
        radius: 8.5,
        tessellation: quality.id === 'low' ? 40 : 64
    }, scene);
    rug.rotation.x = Math.PI / 2;
    rug.position.y = -2.83;
    rug.material = rugMat;
    rug.receiveShadows = true;
    rug.isPickable = false;

    // Piso de mármore do salão. Antes o mapa gerado era imediatamente
    // removido abaixo, deixando um disco cinza chapado no fundo.
    const floorMat = makePhysMat(BABYLON, 'mat_floor', scene, tex.marble, {
        color: new BABYLON.Color3(0.46, 0.49, 0.50),
        roughness: 0.5,
        clearcoat: 0.35,
        metallic: 0.02
    });
    floorMat.albedoTexture.uScale = 3;
    floorMat.albedoTexture.vScale = 3;
    floorMat.bumpTexture.uScale = 3;
    floorMat.bumpTexture.vScale = 3;
    const floor = BABYLON.MeshBuilder.CreateBox('floor', {
        width: 44,
        height: 0.22,
        depth: 36
    }, scene);
    floor.position.y = -2.85;
    floor.material = floorMat;
    floor.receiveShadows = true;
    floor.isPickable = false;

    const brass = makePhysMat(BABYLON, 'brass_inlay', scene, null, {
        color: new BABYLON.Color3(0.65, 0.48, 0.23), metallic: 0.8, roughness: 0.32
    });
    for (const axis of ['x', 'z']) for (const sign of [-1, 1]) {
        const rail = BABYLON.MeshBuilder.CreateBox('inlay', {width: axis === 'z' ? 8.8 : 0.025, depth: axis === 'x' ? 8.8 : 0.025, height: 0.012}, scene);
        rail.position[axis] = sign * 4.4; rail.position.y = 0.09; rail.material = brass; rail.isPickable = false;
    }
    for (let i = 0; i < 8; i++) for (const edge of ['file', 'rank']) {
        const texture = new BABYLON.DynamicTexture(`coord_${edge}_${i}`, 128, scene, false);
        texture.hasAlpha = true;
        texture.drawText(edge === 'file' ? 'abcdefgh'[i] : String(i + 1), null, 88, '64px Georgia', '#d9c398', 'transparent', true);
        const mat = new BABYLON.StandardMaterial(`label_${edge}_${i}`, scene);
        mat.diffuseTexture = texture; mat.emissiveColor.set(0.4, 0.36, 0.28); mat.specularColor.set(0,0,0); mat.useAlphaFromDiffuseTexture = true;
        const label = BABYLON.MeshBuilder.CreateGround(`label_${edge}_${i}`, {width:0.23,height:0.23}, scene);
        label.position.set(edge === 'file' ? i - 3.5 : -4.19, 0.095, edge === 'file' ? 4.19 : 3.5 - i);
        label.material = mat; label.isPickable = false;
    }
    for (const mesh of scene.meshes) if (!mesh.name.startsWith('label')) mesh.freezeWorldMatrix();

    const marks = buildMarks(BABYLON, scene);

    return { squares: [lightSquares, darkSquares], frame, table, floor, marks };
}

function tableMatPlaceholder(BABYLON, scene, tex) {
    return makePhysMat(BABYLON, 'mat_plinth', scene, tex.mahogany, {
        color: new BABYLON.Color3(0.72, 0.54, 0.39),
        roughness: 0.29,
        clearcoat: 0.42,
        environmentIntensity: 0.34,
        useRoughnessMap: false
    });
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

    const hoverMat = new BABYLON.StandardMaterial('mat_mark_hover', scene);
    hoverMat.diffuseColor = new BABYLON.Color3(0.75, 0.88, 0.98);
    hoverMat.emissiveColor = new BABYLON.Color3(0.26, 0.56, 0.82);
    hoverMat.alpha = 0.34;

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

    const hover = BABYLON.MeshBuilder.CreateTorus('mark_hover', { diameter: 0.94, thickness: 0.035, tessellation: 32 }, scene);
    hover.material = hoverMat;
    hover.isVisible = false;
    hover.isPickable = false;

    return { dots, caps, select, lastFrom, lastTo, check, hint, hover };
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
    hemi.diffuse = new BABYLON.Color3(0.82, 0.78, 0.70);
    hemi.groundColor = new BABYLON.Color3(0.22, 0.15, 0.12);
    hemi.intensity = 0.72;

    // Sol / Luz direcionada com sombras
    const sun = new BABYLON.DirectionalLight('sun_light', new BABYLON.Vector3(-4, -10, 6).normalize(), scene);
    sun.position = new BABYLON.Vector3(8, 18, -12);
    sun.diffuse = new BABYLON.Color3(1.0, 0.95, 0.88);
    sun.intensity = 1.05;
    sun.specular = new BABYLON.Color3(0.48, 0.42, 0.34);

    let shadowGen = null;
    if (quality.shadows) {
        shadowGen = new BABYLON.ShadowGenerator(quality.shadowMap || 2048, sun);
        shadowGen.usePercentageCloserFiltering = true;
        shadowGen.filteringQuality = quality.id === 'high'
            ? BABYLON.ShadowGenerator.QUALITY_HIGH
            : BABYLON.ShadowGenerator.QUALITY_MEDIUM;
        shadowGen.bias = 0.001;
        shadowGen.normalBias = 0.002;
        shadowGen.darkness = 0.35;
    }

    // Luz de preenchimento fria, do lado oposto ao sol — sem ela o lado
    // sombreado das peças (sobretudo as de ébano) desaparecia em preto puro.
    const fill = new BABYLON.DirectionalLight('fill_light', new BABYLON.Vector3(5, -6, -8).normalize(), scene);
    fill.diffuse = new BABYLON.Color3(0.48, 0.56, 0.68);
    fill.specular = new BABYLON.Color3(0.2, 0.2, 0.24);
    fill.intensity = 0.72;

    // Ponto de luz quente sobre a mesa
    const warmLamp = new BABYLON.PointLight('warm_lamp', new BABYLON.Vector3(0, 5, 0), scene);
    warmLamp.diffuse = new BABYLON.Color3(1.0, 0.85, 0.65);
    warmLamp.specular = new BABYLON.Color3(0.12, 0.08, 0.04);
    warmLamp.intensity = 0.03;
    warmLamp.range = 14;

    return { hemi, sun, fill, shadowGen, warmLamp };
}

/**
 * Ambiente de reflexo procedural (sem HDR externo): um "cubemap" simples,
 * claro em cima e escuro embaixo, só para o PBR (clearcoat/sheen) ter algo
 * para refletir. Sem isso, materiais escuros como o ébano ficam achatados.
 */
export function setupEnvironment(BABYLON, scene) {
    const size = 256;
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
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = '#d3ddeb';
        ctx.fillRect(40, 24, 65, 108);
        ctx.fillStyle = '#f5e5c8';
        ctx.fillRect(116, 24, 65, 108);
        ctx.globalAlpha = 1;
        return el.toDataURL('image/png');
    };
    const side = face('#8c7c68', '#171310');
    const top = face('#e4d3ac', '#8c7c68');
    const bottom = face('#171310', '#050403');
    const env = BABYLON.CubeTexture.CreateFromImages([side, side, top, bottom, side, side], scene);
    scene.environmentTexture = env;
    scene.environmentIntensity = 0.28;
    return env;
}

export function setupPostProcess(BABYLON, scene, quality) {
    const pipe = new BABYLON.DefaultRenderingPipeline('pipeline', true, scene, [scene.activeCamera]);
    pipe.samples = quality.pr > 1 ? 4 : 1;
    pipe.fxaaEnabled = true;

    // Bloom elegante para destaques e reflexos
    pipe.bloomEnabled = quality.id === 'high';
    pipe.bloomThreshold = 0.78;
    pipe.bloomWeight = 0.08;
    pipe.bloomKernel = 64;

    // Tonemapping e contraste
    pipe.imageProcessing.toneMappingEnabled = true;
    pipe.imageProcessing.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
    pipe.imageProcessing.contrast = 1.15;
    pipe.imageProcessing.exposure = 1.05;

    // Glow Layer para anéis e discos de lance legal
    const glow = new BABYLON.GlowLayer('glow', scene);
    glow.intensity = 0.15;

    return { pipe, glow };
}
