/**
 * Atelier — marchetaria acetinada, mesa de nogueira e sala de leitura em Babylon.js.
 *
 * Casa = 1 u. Origem no centro. Brancas em z positivo.
 * Destaques: disco de lance legal, anel de captura, brilho de seleção e xeque.
 */

import { fileOf, rankOf } from './engine.js';
import { buildRoom } from './room.js';

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

function makePhysMat(B, name, scene, tex, extra = {}) {
    const mat = new B.PBRMaterial(name, scene);
    mat.albedoTexture = tex?.map || null;
    mat.bumpTexture = tex?.normalMap || null;
    mat.roughness = extra.roughness ?? 0.72;
    mat.metallic = extra.metallic ?? 0;
    mat.environmentIntensity = extra.environmentIntensity ?? 0.3;
    mat.albedoColor = extra.color || B.Color3.White();
    mat.clearCoat.isEnabled = false;
    mat.enableSpecularAntiAliasing = true;
    // A rugosidade deve permanecer acetinada. Multiplicar uma base baixa pelo
    // mapa de rugosidade tornava as casas e a mesa quase espelhos.
    return mat;
}

/** Caixa com bordas boleadas, inclusive na silhueta, sem CSG em tempo de execução. */
function bevelBox(B, name, width, height, depth, bevel, scene) {
    const positions = [], indices = [], normals = [], uvs = [];
    const rings = [[-height / 2, bevel], [-height / 2 + bevel, 0],
        [height / 2 - bevel, 0], [height / 2, bevel]];
    const segments = 8, count = segments * 4;
    for (const [y, inset] of rings) {
        for (let corner = 0; corner < 4; corner++) for (let i = 0; i < segments; i++) {
            const angle = (corner + i / (segments - 1)) * Math.PI / 2;
            const radius = Math.max(0.001, bevel - inset * 0.7);
            const x = Math.cos(angle) * radius + (corner === 0 || corner === 3 ? 1 : -1) * (width / 2 - bevel);
            const z = Math.sin(angle) * radius + (corner < 2 ? 1 : -1) * (depth / 2 - bevel);
            positions.push(x, y, z);
            uvs.push(x / width + 0.5, z / depth + 0.5);
        }
    }
    for (let r = 0; r < 3; r++) for (let i = 0; i < count; i++) {
        const a = r * count + i, b = r * count + (i + 1) % count;
        indices.push(a, b, a + count, b, b + count, a + count);
    }
    // B's procedural meshes use clockwise fronts; keep winding consistent.
    for (let i = 1; i < count - 1; i++) {
        indices.push(0, i + 1, i);
        indices.push(count * 3, count * 3 + i, count * 3 + i + 1);
    }
    B.VertexData.ComputeNormals(positions, indices, normals);
    const mesh = new B.Mesh(name, scene), data = new B.VertexData();
    Object.assign(data, { positions, indices, normals, uvs });
    data.applyToMesh(mesh);
    mesh.isPickable = false;
    return mesh;
}

export function buildWorld(B, scene, tex, quality) {
    const lightMat = makePhysMat(B, 'maple_inlay', scene, tex.maple, { roughness: 0.72 });
    const darkMat = makePhysMat(B, 'walnut_inlay', scene, tex.walnut, { roughness: 0.76 });
    const squares = [];
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
        const sq = B.MeshBuilder.CreateBox(`sq_${r}_${f}`, {
            width: 0.998, height: 0.07, depth: 0.998
        }, scene);
        sq.position.set(f - ORIGIN, 0.035, ORIGIN - r);
        sq.material = (f + r) % 2 === 0 ? darkMat : lightMat;
        // Offset estável de UV por casa: lâminas cortadas de partes distintas da madeira.
        const uv = sq.getVerticesData(B.VertexBuffer.UVKind);
        for (let i = 0; i < uv.length; i += 2) {
            uv[i] = uv[i] * 0.6 + ((f * 13 + r * 7) % 19) / 19;
            uv[i + 1] = uv[i + 1] * 0.6 + ((r * 11 + f * 3) % 17) / 17;
        }
        sq.setVerticesData(B.VertexBuffer.UVKind, uv);
        squares.push(sq);
    }
    const batches = [lightMat, darkMat].map(mat => {
        const batch = B.Mesh.MergeMeshes(squares.filter(m => m.material === mat), true, true, undefined, false, false);
        batch.isPickable = false; batch.receiveShadows = true;
        return batch;
    });
    const frameMat = makePhysMat(B, 'board_walnut', scene, tex.mahogany, {
        roughness: 0.67, color: new B.Color3(0.84, 0.76, 0.64), environmentIntensity: 0.16
    });
    const tableMat = makePhysMat(B, 'table_satin', scene, tex.mahogany, {
        roughness: 0.88, color: new B.Color3(0.65, 0.69, 0.72), environmentIntensity: 0.08
    });
    // Nenhum lóbulo especular no tampo: elimina a mancha branca inclusive ao orbitar.
    tableMat.directIntensity = 1;
    tableMat.specularIntensity = 0;
    const frame = bevelBox(B, 'board_frame', 9.12, 0.24, 9.12, 0.065, scene);
    frame.position.y = -0.08; frame.material = frameMat; frame.receiveShadows = true;
    const plinth = bevelBox(B, 'board_plinth', 9.35, 0.18, 9.35, 0.06, scene);
    plinth.position.y = -0.26; plinth.material = frameMat; plinth.receiveShadows = true;
    const table = bevelBox(B, 'table_top', 12.8, 0.5, 12, 0.16, scene);
    table.position.y = -0.6; table.material = tableMat; table.receiveShadows = true;
    const apron = bevelBox(B, 'table_apron', 12.2, 1.2, 11.4, 0.1, scene);
    apron.position.y = -1.35; apron.material = frameMat;
    for (const x of [-5.3, 5.3]) for (const z of [-4.8, 4.8]) {
        const leg = B.MeshBuilder.CreateCylinder('table_leg', {
            height: 12.2, diameterTop: 0.65, diameterBottom: 0.38, tessellation: 20
        }, scene);
        leg.position.set(x, -7.4, z); leg.material = frameMat; leg.isPickable = false;
    }
    const floorMat = makePhysMat(B, 'oak_floor', scene, tex.mahogany, {
        roughness: 0.95, color: new B.Color3(0.6, 0.59, 0.56), environmentIntensity: 0.08
    });
    floorMat.albedoTexture = tex.mahogany.map.clone();
    floorMat.albedoTexture.uScale = 5; floorMat.albedoTexture.vScale = 5;
    const floor = B.MeshBuilder.CreateGround('floor', { width: 48, height: 48 }, scene);
    floor.position.y = -13.6; floor.material = floorMat; floor.receiveShadows = true; floor.isPickable = false;
    const rugMat = makePhysMat(B, 'woven_rug', scene, tex.felt, { roughness: 1, color: new B.Color3(0.5, 0.28, 0.2) });
    const rug = bevelBox(B, 'rug', 21, 0.05, 24, 0.02, scene);
    rug.position.y = -13.5; rug.material = rugMat;
    const rugBorder = makePhysMat(B, 'rug_border', scene, tex.felt, { roughness: 1, color: new B.Color3(0.29, 0.24, 0.18) });
    const border = bevelBox(B, 'rug_border', 22, 0.04, 25, 0.01, scene);
    border.position.y = -13.54; border.material = rugBorder;

    const brass = makePhysMat(B, 'brass_inlay', scene, null, {
        color: new B.Color3(0.54, 0.43, 0.26), metallic: 0.65, roughness: 0.53
    });
    const inlays = [];
    for (const axis of ['x', 'z']) for (const sign of [-1, 1]) {
        const rail = B.MeshBuilder.CreateBox('inlay', { width: axis === 'z' ? 8.7 : 0.016, depth: axis === 'x' ? 8.7 : 0.016, height: 0.008 }, scene);
        rail.position[axis] = sign * 4.35; rail.position.y = 0.044; rail.material = brass;
        inlays.push(rail);
    }
    const inlay = B.Mesh.MergeMeshes(inlays, true, true); inlay.isPickable = false;

    // Um atlas + uma malha para as 32 coordenadas, legíveis dos dois lados.
    const atlas = new B.DynamicTexture('coordinates', { width: 1024, height: 64 }, scene, true);
    const ctx = atlas.getContext();
    ctx.font = '34px Georgia'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#c7b389';
    [...'abcdefgh12345678'].forEach((char, i) => ctx.fillText(char, i * 64 + 32, 34));
    atlas.hasAlpha = true; atlas.update();
    const labelMat = new B.StandardMaterial('coordinate_ink', scene);
    labelMat.diffuseTexture = atlas; labelMat.useAlphaFromDiffuseTexture = true;
    labelMat.specularColor.set(0, 0, 0); labelMat.emissiveColor.set(0.2, 0.18, 0.13);
    const labels = [];
    for (let i = 0; i < 8; i++) for (const edge of ['file', 'rank']) for (const sign of [-1, 1]) {
        const label = B.MeshBuilder.CreateGround('coord', { width: 0.3, height: 0.3 }, scene);
        label.position.set(edge === 'file' ? i - 3.5 : sign * 4.16, 0.047, edge === 'file' ? sign * 4.16 : 3.5 - i);
        if (sign > 0) label.rotation.y = Math.PI;
        const uv = label.getVerticesData(B.VertexBuffer.UVKind), cell = edge === 'file' ? i : i + 8;
        for (let j = 0; j < uv.length; j += 2) uv[j] = (uv[j] + cell) / 16;
        label.setVerticesData(B.VertexBuffer.UVKind, uv); label.material = labelMat; labels.push(label);
    }
    const labelBatch = B.Mesh.MergeMeshes(labels, true, true); labelBatch.isPickable = false;
    const room = buildRoom(B, scene, tex, [floor, rug, border]);
    for (const mesh of scene.meshes) { mesh.isPickable = false; mesh.freezeWorldMatrix(); }
    const marks = buildMarks(B, scene);
    return { squares: batches, frame, table, floor, marks, room };
}

function buildMarks(BABYLON, scene) {
    const dotMat = new BABYLON.StandardMaterial('mat_mark_dot', scene);
    dotMat.diffuseColor = new BABYLON.Color3(0.48, 0.68, 0.53);
    dotMat.emissiveColor = new BABYLON.Color3(0.2, 0.32, 0.22);
    dotMat.alpha = 0.85;

    const capMat = new BABYLON.StandardMaterial('mat_mark_cap', scene);
    capMat.diffuseColor = new BABYLON.Color3(0.95, 0.25, 0.25);
    capMat.emissiveColor = new BABYLON.Color3(0.85, 0.15, 0.15);
    capMat.alpha = 0.9;

    const selMat = new BABYLON.StandardMaterial('mat_mark_sel', scene);
    selMat.diffuseColor = new BABYLON.Color3(0.83, 0.70, 0.45);
    selMat.emissiveColor = new BABYLON.Color3(0.4, 0.3, 0.14);
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

export function setupLights(B, scene, quality) {
    const hemi = new B.HemisphericLight('ambient_bounce', new B.Vector3(0, 1, 0), scene);
    hemi.diffuse = new B.Color3(0.9, 0.94, 1);
    hemi.groundColor = new B.Color3(0.32, 0.27, 0.22);
    hemi.specular = B.Color3.Black();
    hemi.intensity = 0.6;
    const sun = new B.DirectionalLight('window_key', new B.Vector3(5, -9, 4).normalize(), scene);
    sun.position.set(-10, 18, -8);
    sun.diffuse = new B.Color3(1, 0.94, 0.84);
    sun.specular = new B.Color3(0.15, 0.14, 0.12);
    sun.intensity = 2.1;
    sun.shadowMinZ = 1; sun.shadowMaxZ = 45;
    sun.autoCalcShadowZBounds = false;
    sun.shadowFrustumSize = 16;
    // O gerador existe em todos os níveis para que trocar de Leve para Alta
    // restaure sombras sem recarregar a página.
    const shadowGen = new B.ShadowGenerator(quality.shadowMap, sun);
    shadowGen.usePercentageCloserFiltering = true;
    shadowGen.filteringQuality = B.ShadowGenerator.QUALITY_MEDIUM;
    shadowGen.bias = 0.0003; shadowGen.normalBias = 0.012;
    shadowGen.darkness = 0.22;
    shadowGen.getShadowMap().refreshRate = B.RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
    const fill = new B.DirectionalLight('soft_fill', new B.Vector3(-4, -5, -3).normalize(), scene);
    fill.diffuse = new B.Color3(0.72, 0.82, 1);
    fill.specular = new B.Color3(0.08, 0.09, 0.1);
    fill.intensity = 0.5;
    scene.shadowsEnabled = quality.shadows;
    return { hemi, sun, fill, shadowGen };
}

/** A mesma sala fornece a luz ambiente e as reflexões discretas das peças.
 * Cubo de 128 px e irradiância de 32 px: calculados uma vez, sem reflexos de cena.
 */
export function setupEnvironment(B, scene) {
    const env = new B.EquiRectangularCubeTexture(
        new URL('../assets/reading-room.webp', import.meta.url).href,
        scene, 128, false, true, null, null, false, 32
    );
    env.rotationY = Math.PI * 0.65;
    scene.environmentTexture = env;
    scene.environmentIntensity = 0.55;
    return env;
}

export function setupPostProcess(B, scene, quality) {
    let ao = null;
    if (quality.id !== 'low' && B.SSAO2RenderingPipeline.IsSupported) {
        ao = new B.SSAO2RenderingPipeline('contact_occlusion', scene,
            { ssaoRatio: 0.5, blurRatio: 0.5 }, [scene.activeCamera]);
        ao.radius = 0.32;
        ao.totalStrength = 0.9;
        ao.samples = quality.id === 'high' ? 16 : 8;
        ao.expensiveBlur = false;
        ao.textureSamples = 1;
    }
    const pipe = new B.DefaultRenderingPipeline('pipeline', true, scene, [scene.activeCamera]);
    pipe.samples = 1;
    pipe.fxaaEnabled = true;
    pipe.bloomEnabled = false;
    pipe.imageProcessing.toneMappingEnabled = true;
    pipe.imageProcessing.toneMappingType = B.ImageProcessingConfiguration.TONEMAPPING_ACES;
    pipe.imageProcessing.contrast = 1.06;
    pipe.imageProcessing.exposure = 1.14;
    // A câmera de jogo permanece nítida. Desfoque óptico apenas em Detalhe,
    // com foco acompanhando a distância real da câmera ao centro das peças.
    pipe.depthOfFieldBlurLevel = B.DepthOfFieldEffectBlurLevel.Low;
    pipe.depthOfField.focalLength = 180;
    pipe.depthOfField.fStop = 2.8;
    pipe.depthOfFieldEnabled = false;
    return { pipe, ao };
}
