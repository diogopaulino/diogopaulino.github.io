/**
 * Peças Staunton em Babylon.js.
 * Malhas escaneadas (rei, dama, torre, bispo, cavalo e peão) com seus mapas
 * originais de normal/ORM; o torno procedural abaixo é apenas a reserva caso o
 * pacote binário não carregue. Materiais PBR: buxo/marfim acetinado, ébano
 * laqueado, guarnições de latão e cristal. Cada peça leva feltro na base e
 * uma sombra de contato que afrouxa quando ela é erguida.
 */

function lathe(BABYLON, name, xy, seg, scene) {
    const shape = xy.map(([x, y]) => new BABYLON.Vector3(x, y, 0));
    const mesh = BABYLON.MeshBuilder.CreateLathe(name, {
        shape,
        tessellation: seg,
        sideOrientation: BABYLON.Mesh.DOUBLESIDE,
        updatable: false
    }, scene);
    return mesh;
}

function box(BABYLON, name, w, h, d, x, y, z, scene) {
    const mesh = BABYLON.MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
    mesh.position.set(x, y, z);
    return mesh;
}

function collar(BABYLON, name, radius, y, tube, seg, scene) {
    const mesh = BABYLON.MeshBuilder.CreateTorus(name, {
        diameter: radius * 2,
        thickness: tube * 2,
        tessellation: Math.max(16, seg)
    }, scene);
    mesh.position.y = y;
    return mesh;
}

function merge(BABYLON, name, list, scene) {
    const meshes = list.filter(Boolean);
    if (meshes.length === 0) return null;
    if (meshes.length === 1) {
        meshes[0].name = name;
        return meshes[0];
    }
    const merged = BABYLON.Mesh.MergeMeshes(meshes, true, true, undefined, false, false);
    if (merged) merged.name = name;
    return merged;
}

export function buildPieceGeometries(BABYLON, scene, seg = 48) {
    // 1. PEÃO (Pawn)
    const pawnLathe = lathe(BABYLON, 'pawn_base', [
        [0, 0], [0.265, 0], [0.293, 0.018], [0.302, 0.042], [0.298, 0.064],
        [0.28, 0.088], [0.255, 0.1], [0.253, 0.135], [0.235, 0.158],
        [0.216, 0.17], [0.19, 0.21], [0.168, 0.26], [0.147, 0.33],
        [0.13, 0.41], [0.126, 0.48], [0.14, 0.52], [0.184, 0.545],
        [0.195, 0.565], [0.193, 0.59], [0.18, 0.61], [0.123, 0.635], [0, 0.65]
    ], seg, scene);
    const pawnHead = BABYLON.MeshBuilder.CreateSphere('pawn_head', {
        diameter: 0.37, segments: Math.max(24, seg)
    }, scene);
    pawnHead.position.y = 0.785;
    const pawn = merge(BABYLON, 'geo_pawn', [pawnLathe, pawnHead], scene);

    // 2. TORRE (Rook)
    const rookLathe = lathe(BABYLON, 'rook_base', [
        [0, 0], [0.36, 0], [0.38, 0.04], [0.32, 0.10],
        [0.28, 0.18], [0.20, 0.26], [0.175, 0.68],
        [0.24, 0.74], [0.26, 0.80], [0.28, 0.90],
        [0.28, 0.96], [0.16, 0.96], [0.16, 0.88],
        [0, 0.88]
    ], seg, scene);
    const rookCollar = collar(BABYLON, 'rook_col', 0.22, 0.74, 0.03, seg, scene);
    // Ameias: 8 blocos assentados exatamente na borda do copo do torno (raio
    // e altura do próprio perfil), em vez de flutuar acima dele.
    const merlons = [];
    const rookR = 0.225;
    const rookY = 0.955;
    const merlonCount = 8;
    for (let i = 0; i < merlonCount; i++) {
        const a = (i / merlonCount) * Math.PI * 2;
        const m = BABYLON.MeshBuilder.CreateBox(`rook_m_${i}`, { width: 0.075, height: 0.10, depth: 0.11 }, scene);
        m.position.set(Math.cos(a) * rookR, rookY, Math.sin(a) * rookR);
        m.rotation.y = -a;
        merlons.push(m);
    }
    const rook = merge(BABYLON, 'geo_rook', [rookLathe, rookCollar, ...merlons], scene);

    // 3. BISPO (Bishop)
    const bishopLathe = lathe(BABYLON, 'bishop_base', [
        [0, 0], [0.34, 0], [0.36, 0.04], [0.30, 0.09],
        [0.26, 0.16], [0.16, 0.24], [0.135, 0.52],
        [0.20, 0.60], [0.14, 0.66], [0.12, 0.78],
        [0.14, 0.94], [0.175, 1.10], [0.14, 1.24],
        [0.08, 1.33], [0.05, 1.35], [0.085, 1.37], [0, 1.38]
    ], seg, scene);
    const bishopCollar = collar(BABYLON, 'bishop_col', 0.175, 0.60, 0.028, seg, scene);
    const bishopBall = BABYLON.MeshBuilder.CreateSphere('bishop_ball', { diameter: 0.14, segments: 16 }, scene);
    bishopBall.position.set(0, 1.40, 0);
    const bishop = merge(BABYLON, 'geo_bishop', [bishopLathe, bishopCollar, bishopBall], scene);

    // 4. DAMA (Queen)
    const queenLathe = lathe(BABYLON, 'queen_base', [
        [0, 0], [0.36, 0], [0.38, 0.045], [0.32, 0.10],
        [0.28, 0.18], [0.175, 0.26], [0.145, 0.60],
        [0.22, 0.68], [0.15, 0.74], [0.125, 0.92],
        [0.12, 1.14], [0.16, 1.30], [0.185, 1.40],
        [0.15, 1.44], [0.07, 1.46], [0, 1.48]
    ], seg, scene);
    const queenCollar = collar(BABYLON, 'queen_col', 0.195, 0.68, 0.03, seg, scene);
    const jewels = [];
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const c = BABYLON.MeshBuilder.CreateCylinder(`queen_j_${i}`, { height: 0.13, diameterTop: 0, diameterBottom: 0.08, tessellation: 8 }, scene);
        c.position.set(Math.cos(a) * 0.155, 1.50, Math.sin(a) * 0.155);
        jewels.push(c);
    }
    const queen = merge(BABYLON, 'geo_queen', [queenLathe, queenCollar, ...jewels], scene);

    // 5. REI (King)
    const kingLathe = lathe(BABYLON, 'king_base', [
        [0, 0], [0.38, 0], [0.40, 0.045], [0.33, 0.11],
        [0.29, 0.20], [0.18, 0.28], [0.15, 0.64],
        [0.24, 0.74], [0.16, 0.80], [0.13, 0.96],
        [0.125, 1.22], [0.175, 1.40], [0.20, 1.50],
        [0.15, 1.54], [0.07, 1.52], [0, 1.52]
    ], seg, scene);
    const kingCollar = collar(BABYLON, 'king_col', 0.21, 0.74, 0.032, seg, scene);
    const crossV = box(BABYLON, 'cross_v', 0.05, 0.26, 0.05, 0, 1.66, 0, scene);
    const crossH = box(BABYLON, 'cross_h', 0.17, 0.045, 0.045, 0, 1.70, 0, scene);
    const king = merge(BABYLON, 'geo_king', [kingLathe, kingCollar, crossV, crossH], scene);

    // 6. CAVALO (Knight) — todo o pescoço/cabeça compartilha um único ângulo de
    // inclinação (A) para que as caixas fiquem alinhadas ao mesmo eixo, em vez
    // de se cruzarem em ângulos diferentes (o que produzia um bloco quebrado).
    const knightBase = lathe(BABYLON, 'knight_base', [
        [0, 0], [0.34, 0], [0.36, 0.045], [0.30, 0.10],
        [0.27, 0.18], [0.21, 0.26], [0.19, 0.40],
        [0.20, 0.48], [0.17, 0.52]
    ], seg, scene);
    const knightRing = collar(BABYLON, 'knight_ring', 0.19, 0.485, 0.028, seg, scene);

    // Pescoço em cilindros afunilados (superfície lisa, sem quinas) e cabeça
    // em elipsoides (esferas escaladas) — o mesmo bloco boxy de antes ficava
    // com as arestas soltas, destoando do acabamento torneado do resto do jogo.
    const A = -0.34;
    const up = [-Math.sin(A), Math.cos(A)];
    const fwd = [Math.cos(A), Math.sin(A)];
    const P0 = [0.02, 0.49];
    const at = (u, f = 0, z = 0) => [P0[0] + up[0] * u + fwd[0] * f, P0[1] + up[1] * u + fwd[1] * f, z];

    const neckCyl = (name, u, h, dBottom, dTop) => {
        const [x, y, z] = at(u);
        const c = BABYLON.MeshBuilder.CreateCylinder(name, { height: h, diameterBottom: dBottom, diameterTop: dTop, tessellation: Math.max(14, Math.round(seg / 2)) }, scene);
        c.position.set(x, y, z);
        c.rotation.z = A;
        return c;
    };
    const headBlob = (name, diam, sx, sy, sz, u, f, z = 0) => {
        const [x, y, zz] = at(u, f, z);
        const s = BABYLON.MeshBuilder.CreateSphere(name, { diameter: diam, segments: 14 }, scene);
        s.scaling.set(sx, sy, sz);
        s.rotation.z = A;
        s.position.set(x, y, zz);
        return s;
    };

    const neckLower = neckCyl('knight_neck_lo', 0.16, 0.32, 0.34, 0.30);
    const neckUpper = neckCyl('knight_neck_hi', 0.46, 0.28, 0.30, 0.26);
    const poll = headBlob('knight_poll', 0.30, 1.0, 0.85, 0.92, 0.60, 0);
    const muzzle = headBlob('knight_muzzle', 0.22, 1.3, 0.85, 0.85, 0.56, 0.20);
    const jaw = headBlob('knight_jaw', 0.15, 1.1, 0.8, 0.85, 0.48, 0.24);

    const mane = BABYLON.MeshBuilder.CreateCylinder('knight_mane', { height: 0.46, diameterBottom: 0.15, diameterTop: 0.10, tessellation: 10 }, scene);
    {
        const [x, y, z] = at(0.40, -0.15);
        mane.position.set(x, y, z);
        mane.rotation.z = A;
        mane.scaling.z = 0.45;
    }

    const [earBx, earBy] = at(0.70, -0.02, 0);
    const earL = BABYLON.MeshBuilder.CreateCylinder('knight_ear_l', { height: 0.15, diameterTop: 0, diameterBottom: 0.085, tessellation: 10 }, scene);
    earL.position.set(earBx, earBy, 0.075);
    earL.rotation.z = A;
    earL.rotation.x = 0.28;
    const earR = BABYLON.MeshBuilder.CreateCylinder('knight_ear_r', { height: 0.15, diameterTop: 0, diameterBottom: 0.085, tessellation: 10 }, scene);
    earR.position.set(earBx, earBy, -0.075);
    earR.rotation.z = A;
    earR.rotation.x = -0.28;

    const [eyeX, eyeY] = at(0.50, 0.15, 0);
    const eyeL = BABYLON.MeshBuilder.CreateSphere('knight_eye_l', { diameter: 0.045, segments: 8 }, scene);
    eyeL.position.set(eyeX, eyeY, 0.085);
    const eyeR = BABYLON.MeshBuilder.CreateSphere('knight_eye_r', { diameter: 0.045, segments: 8 }, scene);
    eyeR.position.set(eyeX, eyeY, -0.085);

    const knight = merge(BABYLON, 'geo_knight', [
        knightBase, knightRing, neckLower, neckUpper, poll, jaw, muzzle, mane, earL, earR, eyeL, eyeR
    ], scene);

    return { p: pawn, r: rook, n: knight, b: bishop, q: queen, k: king };
}

const KINDS = ['k', 'q', 'r', 'b', 'n', 'p'];
const BOARD_Y = 0.07;

/**
 * Um material por (tipo, cor): cada tipo tem seu próprio atlas UV.
 * Retorna { w: {k..p}, b: {k..p}, theme }.
 */
export function makeMaterials(BABYLON, scene, tex, theme = 'classic', quality = {}) {
    const rich = quality.id !== 'low';
    const build = (kind, color) => {
        const maps = tex.pieces?.[kind];
        const mat = new BABYLON.PBRMaterial(`mat_${theme}_${kind}_${color}`, scene);
        mat.enableSpecularAntiAliasing = true;
        // glTF destro: normal map no padrão OpenGL, como o carregador oficial.
        mat.invertNormalMapX = false;
        mat.invertNormalMapY = true;
        if (theme === 'crystal') {
            // Vidro maciço: refração do ambiente + verniz; o cristal escuro é fumê.
            mat.albedoColor = color === 'w' ? new BABYLON.Color3(0.96, 0.98, 1) : new BABYLON.Color3(0.2, 0.13, 0.1);
            mat.metallic = 0;
            mat.roughness = color === 'w' ? 0.04 : 0.07;
            mat.subSurface.isRefractionEnabled = true;
            mat.subSurface.refractionIntensity = color === 'w' ? 0.92 : 0.8;
            mat.subSurface.indexOfRefraction = 1.52;
            mat.subSurface.tintColor = color === 'w' ? new BABYLON.Color3(0.92, 0.97, 1) : new BABYLON.Color3(0.42, 0.24, 0.16);
            mat.subSurface.tintColorAtDistance = 0.6;
            mat.clearCoat.isEnabled = true;
            mat.clearCoat.intensity = 1;
            mat.clearCoat.roughness = 0.02;
            mat.environmentIntensity = 1.25;
            if (maps?.normal) { mat.bumpTexture = maps.normal; mat.bumpTexture.level = 1; }
            return mat;
        }
        if (maps?.orm && maps.albedo[color]) {
            mat.albedoTexture = maps.albedo[color];
            mat.bumpTexture = maps.normal;
            mat.metallicTexture = maps.orm;
            mat.useRoughnessFromMetallicTextureAlpha = false;
            mat.useRoughnessFromMetallicTextureGreen = true;
            mat.useMetallnessFromMetallicTextureBlue = true;
            mat.useAmbientOcclusionFromMetallicTextureRed = true;
            mat.metallic = 1;
            // Fator sobre a rugosidade escaneada: buxo acetinado, ébano polido.
            mat.roughness = color === 'w' ? 0.92 : 0.62;
        } else {
            mat.albedoColor = color === 'w' ? new BABYLON.Color3(0.82, 0.68, 0.45) : new BABYLON.Color3(0.03, 0.022, 0.018);
            mat.metallic = 0;
            mat.roughness = color === 'w' ? 0.46 : 0.3;
        }
        mat.environmentIntensity = 1;
        mat.clearCoat.isEnabled = true;
        if (color === 'w') {
            // Buxo encerado: verniz fino + sheen quente nas bordas + luz que
            // atravessa de leve as partes finas (translucidez barata, sem pré-passe).
            mat.clearCoat.intensity = 0.35;
            mat.clearCoat.roughness = 0.28;
            if (rich) {
                mat.sheen.isEnabled = true;
                mat.sheen.intensity = 0.22;
                mat.sheen.color = new BABYLON.Color3(1, 0.9, 0.74);
                mat.sheen.roughness = 0.5;
                mat.subSurface.isTranslucencyEnabled = true;
                mat.subSurface.translucencyIntensity = 0.28;
                mat.subSurface.tintColor = new BABYLON.Color3(1, 0.82, 0.6);
                mat.subSurface.minimumThickness = 0.4;
                mat.subSurface.maximumThickness = 2.2;
            }
        } else {
            // Ébano laqueado: camada de verniz espelhada sobre madeira escura.
            mat.clearCoat.intensity = 0.95;
            mat.clearCoat.roughness = 0.08;
            mat.clearCoat.indexOfRefraction = 1.55;
        }
        return mat;
    };
    const out = { w: {}, b: {}, theme };
    for (const kind of KINDS) { out.w[kind] = build(kind, 'w'); out.b[kind] = build(kind, 'b'); }
    return out;
}

export class PieceFactory {
    constructor(scene, tex, quality) {
        this.BABYLON = window.BABYLON;
        this.scene = scene;
        this.tex = tex;
        this.quality = quality;
        this.theme = 'classic';
        this.mats = makeMaterials(this.BABYLON, scene, tex, 'classic', quality);
        this.prototypes = buildPieceGeometries(this.BABYLON, scene, quality.seg || 40);
        this.baseRadius = { k: 0.33, q: 0.31, r: 0.31, b: 0.28, n: 0.3, p: 0.25 };

        // Esconder os protótipos mestres
        for (const key in this.prototypes) {
            const mesh = this.prototypes[key];
            if (mesh) {
                mesh.setEnabled(false);
                mesh.isVisible = false;
            }
        }
        this.buildShared();
    }

    /** Feltro verde da base e disco de sombra de contato, instanciados por peça. */
    buildShared() {
        const B = this.BABYLON, scene = this.scene;
        const feltMat = new B.PBRMaterial('piece_felt', scene);
        feltMat.albedoColor = new B.Color3(0.05, 0.2, 0.11);
        feltMat.albedoTexture = this.tex.felt?.map || null;
        feltMat.bumpTexture = this.tex.felt?.normalMap || null;
        feltMat.metallic = 0; feltMat.roughness = 1;
        feltMat.sheen.isEnabled = true; feltMat.sheen.intensity = 0.6;
        feltMat.sheen.color = new B.Color3(0.35, 0.7, 0.45);
        feltMat.backFaceCulling = false;
        this.felt = B.MeshBuilder.CreateDisc('piece_felt_src', { radius: 1, tessellation: 40 }, scene);
        this.felt.rotation.x = Math.PI / 2;
        this.felt.bakeCurrentTransformIntoVertices();
        this.felt.material = feltMat; this.felt.isPickable = false; this.felt.isVisible = false;

        const contactMat = new B.StandardMaterial('piece_contact', scene);
        contactMat.diffuseColor = B.Color3.Black(); contactMat.specularColor = B.Color3.Black();
        contactMat.emissiveColor = B.Color3.Black(); contactMat.disableLighting = true;
        contactMat.opacityTexture = this.tex.contact; contactMat.backFaceCulling = false;
        contactMat.zOffset = -2;
        this.contact = B.MeshBuilder.CreateDisc('piece_contact_src', { radius: 1, tessellation: 4 }, scene);
        this.contact.rotation.x = Math.PI / 2; this.contact.rotation.y = Math.PI / 4;
        this.contact.scaling.setAll(Math.SQRT2);
        this.contact.bakeCurrentTransformIntoVertices();
        this.contact.material = contactMat; this.contact.isPickable = false; this.contact.isVisible = false;
    }

    async loadSculpted() {
        const [layoutResponse, binaryResponse] = await Promise.all([
            fetch(new URL('../assets/staunton.json?v=3', import.meta.url)),
            fetch(new URL('../assets/staunton.bin.gz?v=3', import.meta.url)),
            this.tex.piecesReady
        ]);
        if (!layoutResponse.ok || !binaryResponse.ok) return;
        const layout = await layoutResponse.json();
        const binary = await new Response(binaryResponse.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
        for (const [kind, attributes] of Object.entries(layout.pieces)) {
            const data = new this.BABYLON.VertexData();
            for (const name of ['positions', 'normals', 'uvs', 'indices']) {
                const [offset, length] = attributes[name];
                const packed = name === 'normals' ? new Int16Array(binary, offset, length) : new Uint16Array(binary, offset, length);
                if (name === 'indices') { data.indices = packed; continue; }
                data[name] = new Float32Array(length);
                for (let i = 0; i < length; i++) {
                    data[name][i] = name === 'normals' ? packed[i] / 32767
                        : name === 'positions' ? attributes.min[i % 3] + packed[i] / 65535 * attributes.extent[i % 3]
                        : attributes.uvMin[i % 2] + packed[i] / 65535 * attributes.uvExtent[i % 2];
                }
            }
            const mesh = new this.BABYLON.Mesh(`sculpted_${kind}`, this.scene);
            data.applyToMesh(mesh);
            // O asset é glTF destro, assim como a cena. Inverter os índices
            // expunha o interior do modelo e descartava sua superfície externa.
            mesh.overrideMaterialSideOrientation = this.BABYLON.Material.CounterClockWiseSideOrientation;
            mesh.setEnabled(false); mesh.isVisible = false;
            this.prototypes[kind].dispose(); this.prototypes[kind] = mesh;
            this.baseRadius[kind] = Math.min(attributes.extent[0], attributes.extent[2]) / 2;
        }
        // Os mapas das peças chegaram depois da primeira leva de materiais.
        this.setTheme(this.theme);
    }

    setTheme(theme) {
        const previous = this.mats;
        this.theme = theme;
        this.mats = makeMaterials(this.BABYLON, this.scene, this.tex, theme, this.quality);
        for (const color of ['w', 'b']) for (const mat of Object.values(previous[color])) mat.dispose(false, false);
    }

    materialFor(type, color) {
        return this.mats[color][type];
    }

    spawn(type, color) {
        const proto = this.prototypes[type];
        if (!proto) return null;

        const mesh = proto.clone(`piece_${type}_${color}_${Date.now()}_${Math.random()}`);
        mesh.setEnabled(true);
        mesh.isVisible = true;
        mesh.material = this.materialFor(type, color);
        mesh.metadata = { kind: type, color };
        mesh.isPickable = true;
        mesh.receiveShadows = true;

        // O cavalo escaneado olha para −z (o lado das pretas): o branco já
        // nasce encarando o adversário; o preto gira meia-volta.
        if (type === 'n' && color === 'b') {
            mesh.rotation.y = Math.PI;
        }

        const r = this.baseRadius[type];
        const felt = this.felt.createInstance('felt');
        felt.parent = mesh; felt.position.y = 0.0015; felt.scaling.setAll(r * 0.93);
        felt.isPickable = false;
        // Clone (e não instância): a opacidade é individual por peça.
        const contact = this.contact.clone('contact');
        contact.parent = mesh; contact.isPickable = false; contact.isVisible = true;
        mesh.contact = contact; mesh.contactRadius = r * 1.75;
        this.syncContact(mesh);
        return mesh;
    }

    /**
     * Sombra de contato: fica colada na superfície de apoio enquanto a peça sobe.
     *   elevação h = y − y_apoio;  raio = r·(1 + 0.9·h);  opacidade = 1 / (1 + 5·h)
     */
    syncContact(mesh, restY = BOARD_Y) {
        const contact = mesh.contact;
        if (!contact) return;
        const h = Math.max(0, mesh.position.y - restY);
        const s = mesh.scaling.x || 1;
        contact.position.y = (0.004 - h) / s;
        contact.scaling.setAll(mesh.contactRadius * (1 + h * 0.9));
        contact.visibility = 0.85 / (1 + h * 5);
    }
}
