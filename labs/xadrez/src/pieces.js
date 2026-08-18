/**
 * Peças Staunton procedurais de alta definição em Babylon.js.
 * Torno (Lathe) + ornamentos detalhados + materiais PBR (Marfim, Ébano, Cristal).
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
        [0, 0], [0.33, 0], [0.35, 0.035], [0.30, 0.08],
        [0.27, 0.14], [0.16, 0.20], [0.135, 0.46],
        [0.13, 0.54], [0.20, 0.58], [0.13, 0.62],
        [0.12, 0.68], [0.185, 0.74], [0.20, 0.84],
        [0.16, 0.91], [0.08, 0.94], [0, 0.95]
    ], seg, scene);
    const pawnCollar = collar(BABYLON, 'pawn_col', 0.175, 0.58, 0.028, seg, scene);
    const pawn = merge(BABYLON, 'geo_pawn', [pawnLathe, pawnCollar], scene);

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

export function makeMaterials(BABYLON, scene, tex, theme = 'classic') {
    const ivory = new BABYLON.PBRMaterial('mat_ivory', scene);
    ivory.albedoColor = new BABYLON.Color3(0.92, 0.85, 0.74);
    if (tex.ivory) {
        ivory.albedoTexture = tex.ivory.map;
        ivory.bumpTexture = tex.ivory.normalMap;
    }
    ivory.metallic = 0.02;
    ivory.roughness = 0.32;
    ivory.clearCoat.isEnabled = true;
    ivory.clearCoat.intensity = 0.75;
    ivory.clearCoat.roughness = 0.2;
    ivory.sheen.isEnabled = true;
    ivory.sheen.intensity = 0.35;
    ivory.sheen.color = new BABYLON.Color3(0.95, 0.88, 0.78);

    const ebony = new BABYLON.PBRMaterial('mat_ebony', scene);
    ebony.albedoColor = new BABYLON.Color3(0.12, 0.08, 0.06);
    if (tex.ebony) {
        ebony.albedoTexture = tex.ebony.map;
        ebony.bumpTexture = tex.ebony.normalMap;
    }
    ebony.metallic = 0.05;
    ebony.roughness = 0.32;
    ebony.clearCoat.isEnabled = true;
    ebony.clearCoat.intensity = 0.75;
    ebony.clearCoat.roughness = 0.22;
    ebony.sheen.isEnabled = true;
    ebony.sheen.intensity = 0.3;
    ebony.sheen.color = new BABYLON.Color3(0.25, 0.14, 0.09);

    const accentLight = new BABYLON.PBRMaterial('mat_acc_light', scene);
    accentLight.albedoColor = new BABYLON.Color3(0.35, 0.20, 0.12);
    accentLight.metallic = 0.15;
    accentLight.roughness = 0.35;

    const accentDark = new BABYLON.PBRMaterial('mat_acc_dark', scene);
    accentDark.albedoColor = new BABYLON.Color3(0.06, 0.04, 0.03);
    accentDark.metallic = 0.2;
    accentDark.roughness = 0.4;

    if (theme === 'crystal') {
        const glassW = new BABYLON.PBRMaterial('mat_glass_w', scene);
        glassW.albedoColor = new BABYLON.Color3(0.95, 0.98, 1.0);
        glassW.metallic = 0.05;
        glassW.roughness = 0.04;
        glassW.alpha = 0.55;
        glassW.subSurface.isRefractionEnabled = true;
        glassW.subSurface.indexOfRefraction = 1.52;
        glassW.clearCoat.isEnabled = true;
        glassW.clearCoat.intensity = 1.0;

        const glassB = new BABYLON.PBRMaterial('mat_glass_b', scene);
        glassB.albedoColor = new BABYLON.Color3(0.15, 0.08, 0.06);
        glassB.metallic = 0.3;
        glassB.roughness = 0.06;
        glassB.alpha = 0.65;
        glassB.subSurface.isRefractionEnabled = true;
        glassB.subSurface.indexOfRefraction = 1.5;
        glassB.clearCoat.isEnabled = true;
        glassB.clearCoat.intensity = 1.0;

        const gold = new BABYLON.PBRMaterial('mat_gold', scene);
        gold.albedoColor = new BABYLON.Color3(0.85, 0.68, 0.32);
        gold.metallic = 0.95;
        gold.roughness = 0.18;

        return { w: glassW, b: glassB, accentW: gold, accentB: gold, theme: 'crystal' };
    }

    return { w: ivory, b: ebony, accentW: accentLight, accentB: accentDark, theme: 'classic' };
}

export class PieceFactory {
    constructor(scene, tex, quality) {
        this.BABYLON = window.BABYLON;
        this.scene = scene;
        this.tex = tex;
        this.quality = quality;
        this.mats = makeMaterials(this.BABYLON, scene, tex, 'classic');
        this.prototypes = buildPieceGeometries(this.BABYLON, scene, quality.seg || 40);

        // Esconder os protótipos mestres
        for (const key in this.prototypes) {
            const mesh = this.prototypes[key];
            if (mesh) {
                mesh.setEnabled(false);
                mesh.isVisible = false;
            }
        }
    }

    setTheme(theme) {
        this.mats = makeMaterials(this.BABYLON, this.scene, this.tex, theme);
    }

    spawn(type, color) {
        const proto = this.prototypes[type];
        if (!proto) return null;

        const mesh = proto.clone(`piece_${type}_${color}_${Date.now()}_${Math.random()}`);
        mesh.setEnabled(true);
        mesh.isVisible = true;
        mesh.material = color === 'w' ? this.mats.w : this.mats.b;
        mesh.metadata = { kind: type, color };
        mesh.isPickable = true;

        if (type === 'n' && color === 'b') {
            mesh.rotation.y = Math.PI;
        }

        return mesh;
    }
}
