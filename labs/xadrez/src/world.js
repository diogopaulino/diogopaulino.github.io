/**
 * Atelier — marchetaria envernizada, mesa de nogueira e lounge em HDRI (Babylon.js).
 *
 * Casa = 1 u (≈ 5,5 cm). Origem no centro. Brancas em z positivo.
 * Luz: IBL do HDRI + uma luz-chave com sombra de penumbra variável (PCSS).
 * Verniz: reflexão planar só das peças, somada ao tabuleiro por Fresnel.
 * Destaques: marcas finas em textura (ponto, colchetes, moldura), sem cobrir a madeira.
 */

import { fileOf, rankOf } from './engine.js?v=5';
import { buildRoom } from './room.js?v=4';

export const BOARD_Y = 0.07;
export const TABLE_Y = -0.35;

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
    mat.environmentIntensity = extra.environmentIntensity ?? 1;
    mat.albedoColor = extra.color || B.Color3.White();
    // Verniz: uma camada dielétrica lisa sobre a madeira (clear coat). A madeira
    // por baixo continua acetinada; o brilho vem só da película.
    mat.clearCoat.isEnabled = (extra.coat ?? 0) > 0;
    mat.clearCoat.intensity = extra.coat ?? 0;
    mat.clearCoat.roughness = extra.coatRoughness ?? 0.15;
    mat.enableSpecularAntiAliasing = true;
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

/**
 * Casas capturadas: duas bandejas forradas de feltro, uma de cada lado.
 * As pretas tomadas ficam à direita das brancas (x > 0) e as brancas tomadas à
 * esquerda; 2 colunas × 8 fileiras, preenchidas a partir do lado de quem capturou.
 */
const TRAY_X = 5.86;
export const TRAY_Y = TABLE_Y + 0.115;
export function traySlot(color, n) {
    const side = color === 'b' ? 1 : -1;
    const col = n % 2, row = Math.floor(n / 2);
    return {
        x: side * (TRAY_X + (col ? 0.36 : -0.36)),
        y: TRAY_Y,
        z: side * (2.59 - row * 0.74)
    };
}

function buildTrays(B, scene, tex, woodMat) {
    const feltMat = new B.PBRMaterial('tray_felt', scene);
    feltMat.albedoColor = new B.Color3(0.06, 0.2, 0.12);
    feltMat.albedoTexture = tex.felt.map; feltMat.bumpTexture = tex.felt.normalMap;
    feltMat.metallic = 0; feltMat.roughness = 1;
    feltMat.sheen.isEnabled = true; feltMat.sheen.intensity = 0.5;
    feltMat.sheen.color = new B.Color3(0.3, 0.62, 0.4);
    const parts = [];
    for (const side of [-1, 1]) {
        const x = side * TRAY_X;
        const base = bevelBox(B, 'tray_base', 1.74, 0.09, 6.3, 0.035, scene);
        base.position.set(x, TABLE_Y + 0.045, 0); base.material = woodMat; base.receiveShadows = true;
        const felt = B.MeshBuilder.CreateBox('tray_felt', { width: 1.5, height: 0.02, depth: 6.06 }, scene);
        felt.position.set(x, TABLE_Y + 0.1, 0); felt.material = feltMat; felt.receiveShadows = true;
        for (const [w, d, dx, dz] of [[1.74, 0.12, 0, 3.09], [1.74, 0.12, 0, -3.09], [0.12, 6.3, 0.81, 0], [0.12, 6.3, -0.81, 0]]) {
            const rim = bevelBox(B, 'tray_rim', w, 0.2, d, 0.045, scene);
            rim.position.set(x + dx, TABLE_Y + 0.1, dz); rim.material = woodMat; rim.receiveShadows = true;
            parts.push(rim);
        }
        parts.push(base, felt);
    }
    return parts;
}

/**
 * Reflexo do verniz. Um MirrorTexture desenha só as peças espelhadas no plano
 * y = BOARD_Y (alfa 0 no vazio); um plano fino sobre as casas soma esse reflexo
 * com peso de Fresnel:  F = 0.08 + 0.92·(1 − cosθ)³  — quase nada visto de cima,
 * forte em ângulo rasante, como numa mesa envernizada de verdade.
 */
function buildReflection(B, scene) {
    const engine = scene.getEngine();
    B.Effect.ShadersStore.varnishVertexShader = `
        precision highp float;
        attribute vec3 position;
        uniform mat4 world; uniform mat4 viewProjection;
        varying vec3 vPos;
        void main() { vec4 p = world * vec4(position, 1.0); vPos = p.xyz; gl_Position = viewProjection * p; }`;
    B.Effect.ShadersStore.varnishFragmentShader = `
        precision highp float;
        uniform sampler2D mirrorSampler;
        uniform vec2 screenSize; uniform vec3 cameraPosition; uniform float strength;
        varying vec3 vPos;
        void main() {
            vec2 uv = gl_FragCoord.xy / screenSize;
            vec4 r = texture2D(mirrorSampler, uv);
            vec3 v = normalize(cameraPosition - vPos);
            float f = 0.08 + 0.92 * pow(1.0 - clamp(v.y, 0.0, 1.0), 3.0);
            // Borda do tabuleiro: o reflexo morre antes da moldura.
            vec2 e = smoothstep(vec2(4.0), vec2(3.86), abs(vPos.xz));
            float k = f * strength * e.x * e.y;
            gl_FragColor = vec4(r.rgb * k, r.a * k);
        }`;
    const mirror = new B.MirrorTexture('board_reflection', { ratio: 0.5 }, scene, false,
        B.Constants.TEXTURETYPE_HALF_FLOAT, B.Texture.BILINEAR_SAMPLINGMODE, true);
    mirror.mirrorPlane = new B.Plane(0, -1, 0, BOARD_Y);
    mirror.clearColor = new B.Color4(0, 0, 0, 0);
    mirror.renderList = null;
    mirror.renderListPredicate = mesh => !!mesh.metadata?.kind && !mesh.metadata.tray && mesh.isEnabled() && mesh.isVisible;
    mirror.blurKernel = 10;
    mirror.ignoreCameraViewport = true;
    const mat = new B.ShaderMaterial('varnish_reflection', scene, 'varnish', {
        attributes: ['position'],
        uniforms: ['world', 'viewProjection', 'screenSize', 'cameraPosition', 'strength'],
        samplers: ['mirrorSampler'],
        needAlphaBlending: true
    });
    mat.alphaMode = B.Constants.ALPHA_PREMULTIPLIED;
    mat.setTexture('mirrorSampler', mirror);
    mat.setFloat('strength', 0.9);
    mat.disableDepthWrite = true;
    mat.onBindObservable.add(() => {
        const rt = engine._currentRenderTarget;
        mat.getEffect().setFloat2('screenSize', rt ? rt.width : engine.getRenderWidth(), rt ? rt.height : engine.getRenderHeight());
        mat.getEffect().setVector3('cameraPosition', scene.activeCamera.globalPosition);
    });
    const plane = B.MeshBuilder.CreateGround('varnish_plane', { width: 8, height: 8 }, scene);
    plane.position.y = BOARD_Y + 0.0012; plane.material = mat; plane.isPickable = false; plane.alphaIndex = 0;
    let enabled = false;
    return {
        mirror, plane,
        setEnabled(on) {
            if (on === enabled) return;
            enabled = on;
            const list = scene.customRenderTargets, at = list.indexOf(mirror);
            if (on && at < 0) list.push(mirror);
            if (!on && at >= 0) list.splice(at, 1);
            plane.setEnabled(on);
        }
    };
}

export function buildWorld(B, scene, tex, quality) {
    // Verniz acetinado (rugosidade 0,24): liso o bastante para brilhar, áspero o
    // bastante para espalhar o abajur do teto — visto de cima ele virava um
    // ponto estourado no centro. O reflexo nítido das peças vem do plano espelhado.
    const inlay = { roughness: 0.5, coat: 0.8, coatRoughness: 0.24, environmentIntensity: 0.75 };
    const lightMat = makePhysMat(B, 'maple_inlay', scene, tex.maple, inlay);
    const darkMat = makePhysMat(B, 'walnut_inlay', scene, tex.walnut, inlay);
    const squares = [];
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
        const dark = (f + r) % 2 === 0;
        // 0,992: sobra uma junta de 8 milésimos de casa, por onde aparece a base escura.
        const sq = B.MeshBuilder.CreateBox(`sq_${r}_${f}`, {
            width: 0.992, height: 0.07, depth: 0.992
        }, scene);
        sq.position.set(f - ORIGIN, 0.035, ORIGIN - r);
        sq.material = dark ? darkMat : lightMat;
        // Cada casa é uma lâmina cortada de um ponto diferente da prancha (janela
        // de 28% da textura). O veio das escuras corre perpendicular ao das claras.
        const uv = sq.getVerticesData(B.VertexBuffer.UVKind);
        const ou = ((f * 13 + r * 7) % 19) / 19 * 0.7, ov = ((r * 11 + f * 3) % 17) / 17 * 0.7;
        const turn = ((f * 5 + r * 3) % 4 < 2) ? 1 : -1;
        for (let i = 0; i < uv.length; i += 2) {
            const u = (uv[i] - 0.5) * turn, v = uv[i + 1] - 0.5;
            uv[i] = (dark ? v : u) * 0.28 + 0.14 + ou;
            uv[i + 1] = (dark ? u : v) * 0.28 + 0.14 + ov;
        }
        sq.setVerticesData(B.VertexBuffer.UVKind, uv);
        squares.push(sq);
    }
    const batches = [lightMat, darkMat].map(mat => {
        const batch = B.Mesh.MergeMeshes(squares.filter(m => m.material === mat), true, true, undefined, false, false);
        batch.isPickable = false; batch.receiveShadows = true;
        return batch;
    });
    const jointMat = makePhysMat(B, 'board_joint', scene, null, { roughness: 0.9, color: new B.Color3(0.03, 0.02, 0.015) });
    const joint = B.MeshBuilder.CreateBox('board_joint', { width: 8.02, height: 0.06, depth: 8.02 }, scene);
    joint.position.y = 0.03; joint.material = jointMat;

    const frameMat = makePhysMat(B, 'board_walnut', scene, tex.mahogany, {
        roughness: 0.55, color: new B.Color3(0.62, 0.5, 0.4), coat: 0.75, coatRoughness: 0.14
    });
    const tableTex = { map: tex.mahogany.map.clone(), normalMap: tex.mahogany.normalMap.clone() };
    for (const t of Object.values(tableTex)) { t.uScale = 2.2; t.vScale = 1.9; }
    tableTex.normalMap.level = 0.6;
    const tableMat = makePhysMat(B, 'table_satin', scene, tableTex, {
        roughness: 0.62, color: new B.Color3(0.42, 0.33, 0.27), coat: 0.5, coatRoughness: 0.3
    });
    const frame = bevelBox(B, 'board_frame', 9.12, 0.24, 9.12, 0.065, scene);
    frame.position.y = -0.08; frame.material = frameMat; frame.receiveShadows = true;
    const plinth = bevelBox(B, 'board_plinth', 9.35, 0.18, 9.35, 0.06, scene);
    plinth.position.y = -0.26; plinth.material = frameMat; plinth.receiveShadows = true;
    const table = bevelBox(B, 'table_top', 15.6, 0.5, 12.6, 0.16, scene);
    table.position.y = -0.6; table.material = tableMat; table.receiveShadows = true;
    const apron = bevelBox(B, 'table_apron', 15, 1.2, 12, 0.1, scene);
    apron.position.y = -1.35; apron.material = frameMat;
    for (const x of [-6.7, 6.7]) for (const z of [-5.1, 5.1]) {
        const leg = B.MeshBuilder.CreateCylinder('table_leg', {
            height: 12.2, diameterTop: 0.65, diameterBottom: 0.38, tessellation: 20
        }, scene);
        leg.position.set(x, -7.4, z); leg.material = frameMat; leg.isPickable = false;
    }
    const trays = buildTrays(B, scene, tex, frameMat);

    // Piso e tapete sob a mesa: dão chão às pernas e escurecem a parte de baixo
    // do quadro. A borda do piso se dissolve (alfa radial) no chão do HDRI.
    const floorTex = { map: tex.mahogany.map.clone(), normalMap: tex.mahogany.normalMap.clone() };
    for (const t of Object.values(floorTex)) { t.uScale = 9; t.vScale = 9; }
    const floorMat = makePhysMat(B, 'lounge_floor', scene, floorTex, {
        roughness: 0.5, color: new B.Color3(0.2, 0.15, 0.12), coat: 0.35, coatRoughness: 0.25
    });
    const fade = new B.DynamicTexture('floor_fade', { width: 256, height: 256 }, scene, true);
    const fctx = fade.getContext();
    const fg = fctx.createRadialGradient(128, 128, 60, 128, 128, 128);
    fg.addColorStop(0, 'rgba(255,255,255,1)'); fg.addColorStop(1, 'rgba(255,255,255,0)');
    fctx.fillStyle = fg; fctx.fillRect(0, 0, 256, 256);
    fade.hasAlpha = true; fade.update();
    floorMat.opacityTexture = fade;
    const floor = B.MeshBuilder.CreateGround('floor', { width: 150, height: 150 }, scene);
    floor.position.y = -13.5; floor.material = floorMat;
    const rugMat = makePhysMat(B, 'woven_rug', scene, tex.felt, { roughness: 1, color: new B.Color3(0.15, 0.035, 0.035) });
    rugMat.sheen.isEnabled = true; rugMat.sheen.intensity = 0.4; rugMat.sheen.color = new B.Color3(0.7, 0.3, 0.25);
    const rug = bevelBox(B, 'rug', 27, 0.08, 24, 0.03, scene);
    rug.position.y = -13.44; rug.material = rugMat;
    const rugBorder = makePhysMat(B, 'rug_border', scene, tex.felt, { roughness: 1, color: new B.Color3(0.16, 0.12, 0.07) });
    const border = bevelBox(B, 'rug_border', 28.6, 0.05, 25.6, 0.02, scene);
    border.position.y = -13.47; border.material = rugBorder;

    const brass = makePhysMat(B, 'brass_inlay', scene, null, {
        color: new B.Color3(0.83, 0.62, 0.3), metallic: 1, roughness: 0.28
    });
    const inlays = [];
    for (const axis of ['x', 'z']) for (const sign of [-1, 1]) {
        const rail = B.MeshBuilder.CreateBox('inlay', { width: axis === 'z' ? 8.36 : 0.03, depth: axis === 'x' ? 8.36 : 0.03, height: 0.008 }, scene);
        rail.position[axis] = sign * 4.165; rail.position.y = 0.043; rail.material = brass;
        inlays.push(rail);
    }
    const rails = B.Mesh.MergeMeshes(inlays, true, true); rails.isPickable = false; rails.receiveShadows = true;

    // Um atlas + uma malha para as 32 coordenadas, legíveis dos dois lados.
    // Folha de latão embutida: o atlas é só a máscara de opacidade do metal.
    const atlas = new B.DynamicTexture('coordinates', { width: 2048, height: 128 }, scene, true);
    const ctx = atlas.getContext();
    ctx.font = '600 76px Georgia'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffffff';
    [...'abcdefgh12345678'].forEach((char, i) => ctx.fillText(char, i * 128 + 64, 66));
    atlas.hasAlpha = true; atlas.update();
    const labelMat = makePhysMat(B, 'coordinate_brass', scene, null, {
        color: new B.Color3(0.86, 0.68, 0.36), metallic: 1, roughness: 0.34
    });
    labelMat.albedoTexture = atlas;
    labelMat.useAlphaFromAlbedoTexture = true;
    labelMat.transparencyMode = B.PBRMaterial.PBRMATERIAL_ALPHABLEND;
    labelMat.zOffset = -1;
    const labels = [];
    for (let i = 0; i < 8; i++) for (const edge of ['file', 'rank']) for (const sign of [-1, 1]) {
        const label = B.MeshBuilder.CreateGround('coord', { width: 0.3, height: 0.3 }, scene);
        label.position.set(edge === 'file' ? i - 3.5 : sign * 4.36, 0.0405, edge === 'file' ? sign * 4.36 : 3.5 - i);
        // Sem rotação o texto fica de pé para quem senta do lado das brancas (+z).
        if (sign < 0) label.rotation.y = Math.PI;
        const uv = label.getVerticesData(B.VertexBuffer.UVKind), cell = edge === 'file' ? i : i + 8;
        // V invertido: na cena destra o plano nasce com a textura espelhada.
        for (let j = 0; j < uv.length; j += 2) { uv[j] = (uv[j] + cell) / 16; uv[j + 1] = 1 - uv[j + 1]; }
        label.setVerticesData(B.VertexBuffer.UVKind, uv); label.material = labelMat; labels.push(label);
    }
    const labelBatch = B.Mesh.MergeMeshes(labels, true, true); labelBatch.isPickable = false;
    for (const mesh of scene.meshes) { mesh.isPickable = false; mesh.freezeWorldMatrix(); }
    const room = buildRoom(B, scene, [floor, rug, border]);
    const reflection = buildReflection(B, scene);
    reflection.plane.freezeWorldMatrix();
    reflection.setEnabled(!!quality.reflections);
    const marks = buildMarks(B, scene);
    return { squares: batches, frame, table, trays, marks, room, reflection };
}

/** Texturas das marcas: formas finas em alfa, desenhadas uma vez em canvas. */
function markTexture(B, scene, name, draw) {
    const tex = new B.DynamicTexture(name, { width: 256, height: 256 }, scene, true);
    const ctx = tex.getContext();
    ctx.clearRect(0, 0, 256, 256);
    draw(ctx);
    tex.hasAlpha = true; tex.update();
    return tex;
}

function buildMarks(BABYLON, scene) {
    const B = BABYLON;
    const frame = (ctx, inset, width, alpha) => {
        ctx.strokeStyle = `rgba(255,255,255,${alpha})`; ctx.lineWidth = width; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.roundRect(inset, inset, 256 - inset * 2, 256 - inset * 2, 10); ctx.stroke();
    };
    const shapes = {
        // Ponto macio: indica a casa sem esconder o veio.
        dot: ctx => {
            const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 44);
            g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.72, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
        },
        // Captura: quatro colchetes nos cantos da casa.
        corners: ctx => {
            ctx.strokeStyle = 'rgba(255,255,255,1)'; ctx.lineWidth = 16; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
                const x = 128 + sx * 104, y = 128 + sy * 104;
                ctx.beginPath(); ctx.moveTo(x - sx * 50, y); ctx.lineTo(x, y); ctx.lineTo(x, y - sy * 50); ctx.stroke();
            }
        },
        frame: ctx => frame(ctx, 12, 12, 1),
        thin: ctx => frame(ctx, 10, 6, 1),
        // Último lance: véu leve, mais denso na borda.
        veil: ctx => {
            ctx.fillStyle = 'rgba(255,255,255,0.62)'; ctx.fillRect(0, 0, 256, 256);
            frame(ctx, 5, 10, 1);
        },
        // Xeque: brilho radial sob o rei.
        glow: ctx => {
            const g = ctx.createRadialGradient(128, 128, 20, 128, 128, 128);
            g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.55, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
        },
        ring: ctx => {
            ctx.strokeStyle = 'rgba(255,255,255,1)'; ctx.lineWidth = 12;
            ctx.beginPath(); ctx.arc(128, 128, 104, 0, Math.PI * 2); ctx.stroke();
        }
    };
    const tex = {};
    for (const [name, draw] of Object.entries(shapes)) tex[name] = markTexture(B, scene, `mark_${name}`, draw);
    const material = (name, shape, hex, alpha) => {
        const mat = new B.StandardMaterial(`mat_mark_${name}`, scene);
        mat.disableLighting = true;
        mat.emissiveColor = B.Color3.FromHexString(hex).toLinearSpace();
        mat.diffuseColor = B.Color3.Black(); mat.specularColor = B.Color3.Black();
        mat.opacityTexture = tex[shape];
        mat.alpha = alpha;
        mat.zOffset = -2;
        return mat;
    };
    let order = 0;
    const plane = (name, mat, size = 0.98) => {
        const m = B.MeshBuilder.CreateGround(name, { width: size, height: size }, scene);
        m.material = mat; m.isVisible = false; m.isPickable = false;
        // Cada marca ganha um degrau próprio de altura: sem z-fighting ao sobrepor.
        m.alphaIndex = 1 + order;
        m.metadata = { lift: 0.0025 + order++ * 0.0004 };
        return m;
    };
    const lastMat = material('last', 'veil', '#ffc35c', 0.6);
    const lastFrom = plane('mark_last_from', lastMat);
    const lastTo = plane('mark_last_to', lastMat);
    const check = plane('mark_check', material('check', 'glow', '#ff2a1a', 0.85));
    const hover = plane('mark_hover', material('hover', 'thin', '#ffffff', 0.4));
    const select = plane('mark_select', material('sel', 'frame', '#ffd27a', 0.95));
    const hint = plane('mark_hint', material('hint', 'ring', '#5cd4ff', 0.95));
    const dotMat = material('dot', 'dot', '#fff3d6', 0.72);
    const dots = Array.from({ length: 28 }, (_, i) => plane(`dot_${i}`, dotMat));
    const capMat = material('cap', 'corners', '#ff5a3c', 0.95);
    const caps = Array.from({ length: 16 }, (_, i) => plane(`cap_${i}`, capMat));
    return { dots, caps, select, lastFrom, lastTo, check, hint, hover };
}

export function placeMark(mesh, index, flip = false) {
    if (!mesh || index < 0) return;
    const pos = squareToWorld(index, flip);
    mesh.position.set(pos.x, BOARD_Y + (mesh.metadata?.lift ?? 0.003), pos.z);
    mesh.isVisible = true;
}

export function setupLights(B, scene, quality) {
    // Reserva mínima caso o HDRI não carregue; com IBL ela quase não contribui.
    const hemi = new B.HemisphericLight('ambient_bounce', new B.Vector3(0, 1, 0), scene);
    hemi.diffuse = new B.Color3(1, 0.93, 0.84);
    hemi.groundColor = new B.Color3(0.3, 0.22, 0.16);
    hemi.specular = B.Color3.Black();
    hemi.intensity = 0.12;
    // Luz-chave: o abajur grande do lounge, alto e à esquerda das brancas.
    const sun = new B.DirectionalLight('window_key', new B.Vector3(5, -9, 4).normalize(), scene);
    sun.position.set(-10, 18, -8);
    sun.diffuse = new B.Color3(1, 0.9, 0.76);
    // Especular da luz-chave bem baixo: no verniz liso ela virava uma mancha
    // branca estourada no meio do tabuleiro. Os brilhos vêm do HDRI.
    sun.specular = new B.Color3(0.14, 0.125, 0.105);
    sun.intensity = 2.2;
    sun.shadowMinZ = 1; sun.shadowMaxZ = 45;
    sun.autoCalcShadowZBounds = false;
    sun.shadowFrustumSize = 19;
    // O gerador existe em todos os níveis para que trocar de Leve para Alta
    // restaure sombras sem recarregar a página.
    const shadowGen = new B.ShadowGenerator(quality.shadowMap, sun);
    shadowGen.bias = 0.0012; shadowGen.normalBias = 0.02;
    shadowGen.darkness = 0;
    shadowGen.getShadowMap().refreshRate = B.RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
    const fill = new B.DirectionalLight('soft_fill', new B.Vector3(-4, -5, -3).normalize(), scene);
    fill.diffuse = new B.Color3(0.62, 0.74, 1);
    fill.specular = new B.Color3(0.3, 0.36, 0.5);
    fill.intensity = 0.35;
    scene.shadowsEnabled = quality.shadows;
    const lights = { hemi, sun, fill, shadowGen };
    applyShadowQuality(B, lights, quality);
    return lights;
}

/**
 * PCSS (contact hardening): a penumbra cresce com a distância entre o
 * bloqueador e o receptor — nítida no pé da peça, difusa na ponta da sombra.
 * Leve usa PCF simples; a penumbra exige WebGL2.
 */
export function applyShadowQuality(B, lights, quality) {
    const gen = lights.shadowGen;
    const soft = quality.id !== 'low' && gen.getShadowMap().getScene().getEngine().webGLVersion > 1;
    gen.usePercentageCloserFiltering = !soft;
    gen.useContactHardeningShadow = soft;
    gen.contactHardeningLightSizeUVRatio = 0.045;
    // QUALITY_HIGH do PCSS custa ~20 ms por quadro em 2× DPR; o nível médio com
    // mapa de 4096 px fica visualmente igual por uma fração do custo.
    gen.filteringQuality = quality.id === 'low' ? B.ShadowGenerator.QUALITY_LOW : B.ShadowGenerator.QUALITY_MEDIUM;
}

/**
 * O HDRI do lounge é, ao mesmo tempo, a luz ambiente (irradiância em harmônicos
 * esféricos), os reflexos das peças (mapa pré-filtrado por rugosidade) e o
 * fundo desfocado da sala. Um único arquivo, tudo coerente entre si.
 */
export function setupEnvironment(B, scene, quality, onReady) {
    const env = new B.HDRCubeTexture(
        new URL('../assets/wooden-lounge-1k.hdr', import.meta.url).href,
        scene, quality.id === 'low' ? 128 : 256, false, true, false, true, onReady
    );
    env.rotationY = ENV_ROTATION;
    scene.environmentTexture = env;
    scene.environmentIntensity = 1.15;
    return env;
}
export const ENV_ROTATION = Math.PI * 0.2;

export function setupPostProcess(B, scene, quality) {
    let ao = null;
    if (quality.id !== 'low' && B.SSAO2RenderingPipeline.IsSupported) {
        ao = new B.SSAO2RenderingPipeline('contact_occlusion', scene,
            { ssaoRatio: quality.id === 'high' ? 0.75 : 0.5, blurRatio: 1 }, [scene.activeCamera]);
        ao.radius = 0.55;
        ao.totalStrength = 1.15;
        ao.base = 0.05;
        ao.samples = quality.id === 'high' ? 16 : 8;
        ao.expensiveBlur = false;
        ao.textureSamples = 1;
    }
    const pipe = new B.DefaultRenderingPipeline('pipeline', true, scene, [scene.activeCamera]);
    pipe.samples = 1;
    pipe.fxaaEnabled = true;
    // Bloom só nos especulares fortes (latão, verniz, abajures do fundo).
    pipe.bloomEnabled = quality.id !== 'low';
    pipe.bloomThreshold = 0.92;
    pipe.bloomWeight = 0.16;
    pipe.bloomKernel = 48;
    pipe.bloomScale = 0.5;
    const ip = pipe.imageProcessing;
    ip.toneMappingEnabled = true;
    ip.toneMappingType = B.ImageProcessingConfiguration.TONEMAPPING_ACES;
    ip.contrast = 1.12;
    ip.exposure = 1.22;
    ip.vignetteEnabled = true;
    ip.vignetteWeight = 1.7;
    ip.vignetteStretch = 0.25;
    ip.vignetteColor = new B.Color4(0, 0, 0, 0);
    ip.vignetteBlendMode = B.ImageProcessingConfiguration.VIGNETTEMODE_MULTIPLY;
    // Grão estático (a cena só redesenha quando algo muda).
    pipe.grainEnabled = quality.id !== 'low';
    pipe.grain.intensity = 4.5;
    pipe.grain.animated = false;
    pipe.sharpenEnabled = quality.id === 'high';
    pipe.sharpen.edgeAmount = 0.14;
    // Profundidade de campo: discreta em Jogar, marcada em Detalhe. O foco
    // acompanha a distância real da câmera ao centro do tabuleiro (main.js).
    pipe.depthOfFieldBlurLevel = quality.id === 'high' ? B.DepthOfFieldEffectBlurLevel.Medium : B.DepthOfFieldEffectBlurLevel.Low;
    pipe.depthOfField.focalLength = 120;
    pipe.depthOfField.fStop = 4;
    pipe.depthOfField.lensSize = 50;
    pipe.depthOfFieldEnabled = false;
    return { pipe, ao };
}
