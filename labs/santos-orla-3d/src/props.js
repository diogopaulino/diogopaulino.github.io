/**
 * Mobiliário da orla: postes (avenida e passeio) com luminárias que acendem à noite e
 * projetam "poças" de luz no chão, bancos de ripas, lixeiras, quiosques com mesas e
 * ombrelones, os 7 postos de salvamento numerados, chuveiros nos acessos, guarda-sóis
 * e cadeiras na areia, traves de futebol e redes de vôlei/futevôlei.
 *
 * Técnica: cada modelo é uma malha fundida com cor por vértice (1 material PBR) e
 * instanciada; partes emissivas ficam em malhas à parte cuja intensidade segue a noite:
 *   emissivo = noite · k   →   o bloom do pós faz o halo; o "chão iluminado" é um disco
 *   aditivo com gradiente radial (custo quase zero, sem luz dinâmica).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { paint, seeded } from '../../shared/gfx/core.js';
import { ZONES, CANALS, LAND_Y, GARDEN_KEEPOUT, PLATFORMS, groundY } from './config.js';
import { X_WEST, X_EAST, gardenPathA } from './terrain.js';

const strip = (g) => {
    const n = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'color'].includes(k)) n.deleteAttribute(k);
    return n;
};
export const P = {
    box(w, h, d, x, y, z, color, ry = 0, rx = 0, rz = 0) {
        const g = new THREE.BoxGeometry(w, h, d);
        if (rx || ry || rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)));
        g.translate(x, y, z);
        return paint(strip(g), color);
    },
    cyl(rt, rb, h, x, y, z, color, seg = 8, rx = 0, rz = 0) {
        const g = new THREE.CylinderGeometry(rt, rb, h, seg);
        if (rx || rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, 0, rz)));
        g.translate(x, y, z);
        return paint(strip(g), color);
    },
    sphere(r, x, y, z, color, sx = 1, sy = 1, sz = 1, ws = 10, hs = 7) {
        const g = new THREE.SphereGeometry(r, ws, hs);
        g.scale(sx, sy, sz);
        g.translate(x, y, z);
        return paint(strip(g), color);
    },
    /** Tubo ao longo de pontos (braço de poste, corrimão curvo). */
    tube(points, r, color, seg = 6) {
        const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
        return paint(strip(new THREE.TubeGeometry(curve, points.length * 4, r, seg, false)), color);
    },
    geo(g, color) {
        return paint(strip(g), color);
    },
    merge(parts) {
        const g = mergeGeometries(parts);
        parts.forEach((p) => p.dispose());
        return g;
    }
};

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

export function instances(geometry, material, list, { cast = true, receive = false, colors = false } = {}) {
    const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, list.length));
    mesh.count = list.length;
    const c = new THREE.Color();
    list.forEach((it, i) => {
        _e.set(it.rx || 0, it.ry || 0, it.rz || 0);
        _q.setFromEuler(_e);
        const sc = it.s ?? 1;
        _m.compose(_p.set(it.x, it.y, it.z), _q, _s.set(it.sx ?? sc, it.sy ?? sc, it.sz ?? sc));
        mesh.setMatrixAt(i, _m);
        if (colors) mesh.setColorAt(i, c.set(it.color ?? 0xffffff));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    mesh.computeBoundingSphere();
    return mesh;
}

let _propMat = null;
export function propMaterial() {
    if (!_propMat) _propMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.68, metalness: 0.08 });
    return _propMat;
}

function signTexture(lines, { w = 256, h = 128, bg = '#1c5fa8', fg = '#ffffff', font = 'bold 54px Arial' } = {}) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.fillStyle = fg;
    g.font = font;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    lines.forEach((t, i) => g.fillText(t, w / 2, (h * (i + 0.5)) / lines.length + 2));
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
}
export { signTexture };

function glowTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 2, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.35, 'rgba(255,255,255,0.42)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

function netTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    g.clearRect(0, 0, 64, 64);
    g.strokeStyle = 'rgba(245,245,240,0.95)';
    g.lineWidth = 3;
    g.strokeRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

/** Postos de salvamento: na borda do jardim, sem obstruir o passeio da praia. */
export function postoSpots() {
    // o posto 7 fica a oeste do canal para não tapar a entrada do Aquário
    return CANALS.map((c) => ({ x: c.x + (c.id === 7 ? -17 : 17), z: 36.8, id: c.id }));
}

export const KIOSK_Z = 33.4;
/** Posições X dos quiosques (determinísticas — os jardins desviam delas). */
export function kioskSpots(openings = []) {
    const inCanal = (x, m) => CANALS.some((c) => Math.abs(x - c.x) < c.width / 2 + m);
    const out = [];
    for (let x = -330; x < X_EAST - 20; x += 49) {
        let kx = x;
        if (inCanal(kx, 10) || openings.some((o) => Math.abs(o - kx) < 5)) kx += 13;
        if (inCanal(kx, 10)) continue;
        if (GARDEN_KEEPOUT.some((k) => (k.r ? Math.abs(kx - k.x) < k.r + 9 : kx > k.x0 - 9 && kx < k.x1 + 9))) continue;
        out.push(kx);
    }
    return out;
}

export function createProps(quality, terrain) {
    const root = new THREE.Group();
    root.name = 'props';
    const rnd = seeded(0xb0a7);
    const mat = propMaterial();
    const inCanal = (x, m = 2) => CANALS.some((c) => Math.abs(x - c.x) < c.width / 2 + m);
    const openings = terrain?.openings || [];
    const nearOpening = (x, m = 3) => openings.some((o) => Math.abs(o - x) < m);

    const DARK = 0x2a2e33;
    const WOOD = 0x8a5a34;
    const WHITE = 0xf1eee6;

    // ---------- postes ----------
    const avenuePole = P.merge([
        P.cyl(0.09, 0.15, 9.2, 0, 4.6, 0, DARK, 8),
        P.cyl(0.2, 0.24, 0.5, 0, 0.25, 0, DARK, 8),
        P.tube([[0, 8.6, 0], [0, 9.4, 0.5], [0, 9.6, 1.8], [0, 9.5, 3.0]], 0.055, DARK),
        P.tube([[0, 8.6, 0], [0, 9.4, -0.5], [0, 9.6, -1.8], [0, 9.5, -3.0]], 0.055, DARK),
        P.box(0.34, 0.12, 0.85, 0, 9.44, 3.25, 0x3a3f45),
        P.box(0.34, 0.12, 0.85, 0, 9.44, -3.25, 0x3a3f45)
    ]);
    const walkPole = P.merge([
        P.cyl(0.055, 0.085, 4.1, 0, 2.05, 0, DARK, 8),
        P.cyl(0.13, 0.16, 0.45, 0, 0.22, 0, DARK, 8),
        P.cyl(0.2, 0.06, 0.16, 0, 4.16, 0, DARK, 10),
        P.cyl(0.02, 0.26, 0.14, 0, 4.66, 0, DARK, 10)
    ]);
    const avenue = [];
    const walk = [];
    const bulbs = [];
    const pools = [];
    for (let x = X_WEST + 10; x < X_EAST - 4; x += 30) {
        const z = (ZONES.median[0] + ZONES.median[1]) / 2;
        avenue.push({ x, y: LAND_Y, z });
        for (const s of [-1, 1]) {
            bulbs.push({ x, y: LAND_Y + 9.34, z: z + s * 3.25, sx: 0.3, sy: 0.07, sz: 0.74 });
            pools.push({ x, y: LAND_Y - 0.1, z: z + s * 5.2, s: 13 });
        }
    }
    const walkStep = quality.id === 'low' ? 30 : 21;
    for (let x = X_WEST + 6; x < X_EAST - 3; x += walkStep) {
        for (const z of [ZONES.bike[1] + 0.2, ZONES.promenade[1] - 0.6]) {
            if (inCanal(x, 1.2)) continue;
            const px = x + (z > 20 ? walkStep / 2 : 0);
            if (px > X_EAST - 3 || inCanal(px, 1.2)) continue;
            walk.push({ x: px, y: LAND_Y, z });
            bulbs.push({ x: px, y: LAND_Y + 4.42, z, sx: 0.19, sy: 0.19, sz: 0.19 });
            pools.push({ x: px, y: LAND_Y + 0.06, z, s: 8.5 });
        }
    }
    root.add(instances(avenuePole, mat, avenue), instances(walkPole, mat, walk));
    const bulbMat = new THREE.MeshStandardMaterial({ color: 0xfff4dc, emissive: 0xffd9a0, emissiveIntensity: 0.05, roughness: 0.4 });
    root.add(instances(new THREE.SphereGeometry(1, 10, 8), bulbMat, bulbs, { cast: false }));
    const poolGeo = new THREE.PlaneGeometry(1, 1);
    poolGeo.rotateX(-Math.PI / 2);
    const poolMat = new THREE.MeshBasicMaterial({
        map: glowTexture(), color: 0xffb060, transparent: true, opacity: 0, depthWrite: false,
        blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4
    });
    const poolMesh = instances(poolGeo, poolMat, pools, { cast: false });
    poolMesh.renderOrder = 3;
    poolMesh.visible = false;
    root.add(poolMesh);

    // ---------- bancos e lixeiras ----------
    const benchParts = [];
    for (const s of [-0.75, 0.75]) {
        benchParts.push(P.box(0.07, 0.44, 0.5, s, 0.22, 0, DARK), P.box(0.07, 0.5, 0.06, s, 0.66, -0.24, DARK, 0, -0.2));
    }
    for (let k = 0; k < 4; k++) benchParts.push(P.box(1.8, 0.035, 0.1, 0, 0.46, -0.17 + k * 0.125, WOOD));
    for (let k = 0; k < 3; k++) benchParts.push(P.box(1.8, 0.1, 0.035, 0, 0.6 + k * 0.13, -0.25 - k * 0.026, WOOD));
    const benchGeo = P.merge(benchParts);
    const benches = [];
    const bins = [];
    for (let x = X_WEST + 9; x < X_EAST - 4; x += 14) {
        if (inCanal(x, 3)) continue;
        // calçadão: de costas para a avenida, olhando o mar
        benches.push({ x, y: LAND_Y, z: ZONES.walk[0] + 0.7, ry: 0 });
        // passeio da praia: de frente para o mar
        if (!nearOpening(x + 7, 3)) benches.push({ x: x + 7, y: LAND_Y, z: ZONES.promenade[0] + 0.8, ry: 0 });
        if (Math.floor(x / 14) % 3 === 0) {
            const bx = x + 3.5;
            benches.push({ x: bx, y: LAND_Y, z: gardenPathA(bx) - 1.9, ry: 0 });
        }
        if (Math.floor(x / 14) % 2 === 0) bins.push({ x: x + 1.6, y: LAND_Y, z: ZONES.walk[0] + 0.6 });
    }
    root.add(instances(benchGeo, mat, benches, { receive: true }));
    const binGeo = P.merge([P.cyl(0.24, 0.2, 0.7, 0, 0.55, 0, 0x2f6e4a, 10), P.cyl(0.04, 0.04, 0.5, 0, 0.25, 0, DARK, 6), P.cyl(0.26, 0.26, 0.04, 0, 0.91, 0, DARK, 10)]);
    root.add(instances(binGeo, mat, bins));

    // ---------- quiosques ----------
    const kioskParts = [];
    const hex = (r, h, y, color, seg = 6) => {
        const g = new THREE.CylinderGeometry(r, r, h, seg);
        g.rotateY(Math.PI / 6);
        g.translate(0, y, 0);
        return paint(strip(g), color);
    };
    kioskParts.push(hex(7.4, 0.07, 0.04, 0xd6d0c2, 12));      // piso do quiosque
    kioskParts.push(hex(2.5, 1.05, 0.525, WHITE));            // balcão
    kioskParts.push(hex(2.56, 0.07, 1.08, 0x6a4a2e));         // tampo de madeira
    kioskParts.push(hex(2.2, 1.35, 1.75, 0x1b2228));          // vão aberto (interior escuro)
    kioskParts.push(hex(2.5, 0.55, 2.7, 0xd9742a));           // testeira colorida
    kioskParts.push(hex(4.3, 0.14, 3.05, WHITE));             // cobertura em balanço
    kioskParts.push(hex(4.34, 0.1, 2.93, 0x4a5258));
    kioskParts.push(hex(1.2, 0.5, 3.35, 0xcfd2d4));           // caixa d'água/exaustor
    for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        kioskParts.push(P.cyl(0.07, 0.07, 3.0, Math.cos(a) * 2.5, 1.5, Math.sin(a) * 2.5, 0x4a5258, 6));
    }
    // mesas com ombrelone e cadeiras
    const tableSet = (tx, tz, color) => {
        const parts = [
            P.cyl(0.45, 0.45, 0.04, tx, 0.74, tz, 0xe9e6e0, 12), P.cyl(0.04, 0.04, 0.74, tx, 0.37, tz, DARK, 6),
            P.cyl(0.025, 0.025, 2.5, tx, 1.25, tz, 0xd8d8d8, 6), P.cyl(0.05, 1.55, 0.5, tx, 2.42, tz, color, 10)
        ];
        for (let c = 0; c < 4; c++) {
            const a = (c / 4) * Math.PI * 2 + 0.6;
            const cx = tx + Math.cos(a) * 0.8;
            const cz = tz + Math.sin(a) * 0.8;
            parts.push(P.box(0.4, 0.04, 0.4, cx, 0.45, cz, 0xf4f1ea, -a), P.box(0.4, 0.42, 0.04, cx + Math.cos(a) * 0.19, 0.68, cz + Math.sin(a) * 0.19, 0xf4f1ea, -a + Math.PI / 2));
            parts.push(P.cyl(0.02, 0.02, 0.45, cx, 0.225, cz, 0xd0d0d0, 5));
        }
        return parts;
    };
    kioskParts.push(...tableSet(4.4, 2.6, 0xe6c84a), ...tableSet(-4.4, 2.4, 0xd8483a), ...tableSet(4.6, -1.2, 0x2f7fb8), ...tableSet(-4.5, -1.4, 0xe6c84a));
    const kioskGeo = P.merge(kioskParts);
    const kiosks = kioskSpots(openings).map((kx) => ({ x: kx, y: LAND_Y, z: KIOSK_Z, ry: rnd() * 0.4 }));
    root.add(instances(kioskGeo, mat, kiosks, { receive: true }));
    const kioskGlow = new THREE.MeshStandardMaterial({ color: 0x2a2018, emissive: 0xffc878, emissiveIntensity: 0, roughness: 0.6 });
    const glowGeo = new THREE.CylinderGeometry(2.25, 2.25, 0.25, 6);
    glowGeo.rotateY(Math.PI / 6);
    root.add(instances(glowGeo, kioskGlow, kiosks.map((k) => ({ ...k, y: LAND_Y + 2.32 })), { cast: false }));
    for (const k of kiosks) pools.push({ x: k.x, y: LAND_Y + 0.06, z: k.z, s: 15 });

    // ---------- postos de salvamento (1–7) ----------
    const postoGeo = P.merge([
        P.box(7.5, 2.9, 4.6, 0, 1.45, 0, WHITE),
        P.box(7.9, 0.22, 5.0, 0, 3.0, 0, 0x1c5fa8),
        P.box(3.2, 2.5, 3.0, -1.4, 4.35, 0, WHITE),
        P.box(3.8, 0.2, 3.6, -1.4, 5.7, 0, 0x1c5fa8),
        P.box(2.2, 1.1, 0.08, -1.4, 4.6, 1.52, 0x1b2a36),          // janelão de observação
        P.box(1.0, 2.0, 0.08, 2.2, 1.0, 2.31, 0x1b2a36),           // porta
        P.box(1.6, 0.9, 0.08, -1.6, 1.7, 2.31, 0x1b2a36),          // janela
        P.cyl(0.05, 0.05, 3.2, 3.3, 4.6, 1.9, 0xd8d8d8, 6),        // mastro da bandeira
        P.box(0.9, 0.55, 0.03, 3.78, 5.85, 1.9, 0xd8281e),         // bandeira de sinalização
        ...[-3.6, -1.2, 1.2, 3.6].map((px) => P.cyl(0.035, 0.035, 1.0, px, 3.6, 2.4, 0xd8d8d8, 5)),
        P.box(7.6, 0.05, 0.05, 0, 4.1, 2.4, 0xd8d8d8), P.box(7.6, 0.05, 0.05, 0, 3.6, 2.4, 0xd8d8d8)
    ]);
    const postos = postoSpots().map((p) => ({ ...p, y: LAND_Y, ry: 0 }));
    root.add(instances(postoGeo, mat, postos, { receive: true }));
    for (const p of postos) {
        const sign = new THREE.Mesh(
            new THREE.PlaneGeometry(2.6, 1.0),
            new THREE.MeshStandardMaterial({ map: signTexture([`POSTO ${p.id}`], { font: 'bold 56px Arial' }), roughness: 0.6 })
        );
        sign.position.set(p.x + 1.9, LAND_Y + 4.4, p.z + 1.53);
        root.add(sign);
    }

    // ---------- chuveiros nos acessos ----------
    const showerGeo = P.merge([
        P.cyl(0.05, 0.05, 2.4, 0, 1.2, 0, 0xc8cdd0, 6),
        P.tube([[0, 2.3, 0], [0, 2.5, 0.2], [0, 2.4, 0.45]], 0.03, 0xc8cdd0),
        P.cyl(0.09, 0.05, 0.06, 0, 2.36, 0.47, 0xc8cdd0, 8),
        P.cyl(0.55, 0.6, 0.06, 0, 0.03, 0.2, 0x9a9c98, 12)
    ]);
    root.add(instances(showerGeo, mat, openings.map((x) => ({ x: x + 2.5, y: groundY(x, ZONES.sandTop + 1), z: ZONES.sandTop + 1, ry: Math.PI }))));

    // ---------- areia: guarda-sóis + cadeiras ----------
    const canopy = new THREE.ConeGeometry(1.25, 0.42, 10, 1, true);
    canopy.translate(0, 2.02, 0);
    const umbrellaGeo = P.merge([P.geo(canopy, 0xffffff), P.cyl(0.02, 0.02, 2.1, 0, 1.05, 0, 0xffffff, 5)]);
    const chairGeo = P.merge([
        P.box(0.5, 0.03, 0.5, 0, 0.26, 0, 0xffffff, 0, -0.12),
        P.box(0.5, 0.6, 0.03, 0, 0.55, -0.3, 0xffffff, 0, -0.42),
        P.box(0.03, 0.3, 0.03, -0.24, 0.13, 0.2, 0x9aa0a4), P.box(0.03, 0.3, 0.03, 0.24, 0.13, 0.2, 0x9aa0a4),
        P.box(0.03, 0.3, 0.03, -0.24, 0.13, -0.2, 0x9aa0a4), P.box(0.03, 0.3, 0.03, 0.24, 0.13, -0.2, 0x9aa0a4)
    ]);
    const UMB = [0xe23a3a, 0xf2c230, 0x2a7fd0, 0x2aa870, 0xf07a22, 0xf4f1ea, 0xd84a9a, 0x1f5fa8];
    const umbrellas = [];
    const chairs = [];
    const beachSpots = [];
    let guard = 0;
    while (umbrellas.length < quality.beachSets && guard++ < quality.beachSets * 8) {
        const x = -335 + rnd() * 670;
        const z = 58 + Math.pow(rnd(), 0.8) * 42;
        if (inCanal(x, 5) || PLATFORMS.some((pl) => x > pl.x0 - 3 && x < pl.x1 + 3)) continue;
        if (beachSpots.some((b) => Math.hypot(b.x - x, b.z - z) < 4.2)) continue;
        const y = groundY(x, z);
        const color = rnd.pick(UMB);
        beachSpots.push({ x, z });
        umbrellas.push({ x, y, z, ry: rnd() * 6, rz: (rnd() - 0.5) * 0.2, color, s: 0.95 + rnd() * 0.2 });
        const n = 1 + Math.floor(rnd() * 3);
        for (let k = 0; k < n; k++) {
            const a = Math.PI / 2 + (k - (n - 1) / 2) * 0.75;
            chairs.push({ x: x + Math.cos(a) * 1.1 * (k - (n - 1) / 2), y, z: z + 0.9 + rnd() * 0.3, ry: (rnd() - 0.5) * 0.5, color: rnd.pick(UMB) });
        }
    }
    const tintMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide });
    root.add(instances(umbrellaGeo, tintMat, umbrellas, { colors: true }), instances(chairGeo, tintMat, chairs, { colors: true }));

    // ---------- traves e redes ----------
    const goalGeo = P.merge([
        P.cyl(0.05, 0.05, 2.2, -2.5, 1.1, 0, WHITE, 6), P.cyl(0.05, 0.05, 2.2, 2.5, 1.1, 0, WHITE, 6),
        P.cyl(0.05, 0.05, 5.1, 0, 2.2, 0, WHITE, 6, 0, Math.PI / 2)
    ]);
    const goals = [];
    const nets = [];
    for (let x = -300; x < 330; x += 62) {
        if (inCanal(x, 34)) continue;
        const z = 74 + rnd() * 8;
        goals.push({ x: x - 16, y: groundY(x, z), z, ry: Math.PI / 2 }, { x: x + 16, y: groundY(x, z), z, ry: Math.PI / 2 });
        nets.push({ x: x + 6 + rnd() * 10, z: 60 + rnd() * 4 });
    }
    root.add(instances(goalGeo, mat, goals));
    const netTex = netTexture();
    netTex.repeat.set(40, 5);
    const netMat = new THREE.MeshStandardMaterial({ map: netTex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.9 });
    for (const n of nets) {
        const y = groundY(n.x, n.z);
        const net = new THREE.Mesh(new THREE.PlaneGeometry(9, 1), netMat);
        net.position.set(n.x, y + 1.95, n.z);
        net.rotation.y = Math.PI / 2;
        root.add(net);
    }
    root.add(instances(P.cyl(0.05, 0.05, 2.5, 0, 1.25, 0, 0xf2d24a, 6), mat,
        nets.flatMap((n) => [{ x: n.x, y: groundY(n.x, n.z), z: n.z - 4.5 }, { x: n.x, y: groundY(n.x, n.z), z: n.z + 4.5 }])));

    // ---------- pontos de ônibus ----------
    const stopGeo = P.merge([
        P.box(4.2, 0.1, 1.6, 0, 2.5, 0, 0x2f3a44),
        P.box(4.0, 1.9, 0.05, 0, 1.45, -0.7, 0x7fa0aa),
        P.cyl(0.05, 0.05, 2.5, -2.0, 1.25, -0.7, DARK, 6), P.cyl(0.05, 0.05, 2.5, 2.0, 1.25, -0.7, DARK, 6),
        P.box(3.0, 0.06, 0.4, 0, 0.5, -0.4, WOOD)
    ]);
    const stops = [];
    for (let x = -300; x < 330; x += 96) if (!inCanal(x, 16)) stops.push({ x, y: LAND_Y, z: ZONES.cityWalk[1] - 0.9, ry: 0 }, { x: x + 40, y: LAND_Y, z: ZONES.walk[0] + 0.3, ry: Math.PI });
    root.add(instances(stopGeo, mat, stops.filter((s) => !inCanal(s.x, 14))));

    // poças de luz (adiciona as dos quiosques)
    poolMesh.dispose?.();
    root.remove(poolMesh);
    const poolFinal = instances(poolGeo, poolMat, pools, { cast: false });
    poolFinal.renderOrder = 3;
    poolFinal.visible = false;
    root.add(poolFinal);

    return {
        root,
        benches,
        chairs,
        kiosks,
        postos,
        beachSpots,
        update() {},
        setNight(k) {
            bulbMat.emissiveIntensity = 0.05 + k * 9;
            kioskGlow.emissiveIntensity = k * 3.2;
            poolMat.opacity = k * 0.5;
            poolFinal.visible = k > 0.03;
        }
    };
}
