/**
 * Peças modeladas do vale: celeiro, ninho do piquenique, toalha, cogumelos,
 * amoras, corações, borboletas, arco-íris e orvalho.
 *
 * Tudo é geometria de verdade (paredes com espessura e vãos recortados, telhado
 * com beiral, perfis torneados, relevo esculpido por vértice) com materiais PBR
 * de gfx/assets e UV em metros (applyWorldUV). Geometrias estáticas de um mesmo
 * material são fundidas: o celeiro inteiro custa 6 draw calls.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { applyWorldUV, fbm2, seeded, smoothstep } from '../../shared/gfx/core.js';
import { pbrMaterial } from '../../shared/gfx/assets.js';

const TAU = Math.PI * 2;

/** Junta geometrias por material e devolve um Group com uma malha por chave. */
class Batch {
    constructor() {
        this.parts = new Map();
    }

    /** geometria já na posição final (espaço local do conjunto); `uv` = metros por repetição. */
    add(key, geometry, uv = 1.5) {
        let g = geometry.index ? geometry.toNonIndexed() : geometry;
        g.computeVertexNormals();
        applyWorldUV(g, uv);
        for (const name of Object.keys(g.attributes)) {
            if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
        }
        if (!this.parts.has(key)) this.parts.set(key, []);
        this.parts.get(key).push(g);
        return g;
    }

    build(materials, { castShadow = true, receiveShadow = true } = {}) {
        const group = new THREE.Group();
        for (const [key, list] of this.parts) {
            const merged = mergeGeometries(list, false);
            list.forEach((g) => g.dispose());
            const mesh = new THREE.Mesh(merged, materials[key]);
            mesh.name = key;
            mesh.castShadow = castShadow;
            mesh.receiveShadow = receiveShadow;
            group.add(mesh);
        }
        return group;
    }
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _eYZX = new THREE.Euler(0, 0, 0, 'YZX');
const _p = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);
/** Caixa chanfrada (w, h, d) posicionada e girada. */
function board(w, h, d, x, y, z, rx = 0, ry = 0, rz = 0, r = 0.018) {
    const g = new RoundedBoxGeometry(w, h, d, 1, Math.min(r, w * 0.45, h * 0.45, d * 0.45));
    _e.set(rx, ry, rz);
    g.applyMatrix4(_m.compose(_p.set(x, y, z), _q.setFromEuler(_e), _s));
    return g;
}
function moved(g, x, y, z, ry = 0) {
    _e.set(0, ry, 0);
    g.applyMatrix4(_m.compose(_p.set(x, y, z), _q.setFromEuler(_e), _s));
    return g;
}

// ═══════════════════════════════════════════════════════════════════════════
// Celeiro
// ═══════════════════════════════════════════════════════════════════════════

/** Medidas do celeiro (m). Frente (porta) = +Z local. */
export const BARN_SIZE = { w: 5.6, d: 4.6, wall: 2.5, knee: 3.75, ridge: 4.6 };

/**
 * Celeiro de tábuas vermelhas com telhado de mansarda em palha.
 * Paredes = perfis extrudados com 14 cm de espessura; o vão da porta faz parte do
 * contorno e as janelas são furos de verdade. Telhado = 4 águas com 22 cm de
 * espessura e 40 cm de beiral. Portas duplas abertas, com travessas em Z.
 */
export function createBarn() {
    const { w: W, d: D, wall: WH, knee: KY, ridge: RY } = BARN_SIZE;
    const T = 0.14;
    const KX = W / 2 * 0.6;
    const B = new Batch();

    const gable = (door) => {
        const s = new THREE.Shape();
        s.moveTo(-W / 2, 0);
        if (door) {
            s.lineTo(-1.05, 0);
            s.lineTo(-1.05, 2.02);
            s.lineTo(1.05, 2.02);
            s.lineTo(1.05, 0);
        }
        s.lineTo(W / 2, 0);
        s.lineTo(W / 2, WH);
        s.lineTo(KX, KY);
        s.lineTo(0, RY);
        s.lineTo(-KX, KY);
        s.lineTo(-W / 2, WH);
        s.closePath();
        // janela do sótão (por onde entra o feno)
        const h = new THREE.Path();
        h.moveTo(-0.42, 2.72);
        h.lineTo(0.42, 2.72);
        h.lineTo(0.42, 3.36);
        h.absarc(0, 3.36, 0.42, 0, Math.PI, false);
        h.closePath();
        s.holes.push(h);
        return new THREE.ExtrudeGeometry(s, { depth: T, bevelEnabled: false, curveSegments: 10 });
    };
    B.add('planks', moved(gable(true), 0, 0, D / 2 - T), 1.5);
    B.add('planks', moved(gable(false), 0, 0, -D / 2), 1.5);

    const side = () => {
        const s = new THREE.Shape();
        const L = D - T * 2;
        s.moveTo(-L / 2, 0);
        s.lineTo(L / 2, 0);
        s.lineTo(L / 2, WH);
        s.lineTo(-L / 2, WH);
        s.closePath();
        const h = new THREE.Path();
        h.moveTo(-0.42, 1.2);
        h.lineTo(0.42, 1.2);
        h.lineTo(0.42, 1.85);
        h.lineTo(-0.42, 1.85);
        h.closePath();
        s.holes.push(h);
        return new THREE.ExtrudeGeometry(s, { depth: T, bevelEnabled: false });
    };
    B.add('planks', moved(side(), W / 2 - T, 0, 0, Math.PI / 2), 1.5);
    B.add('planks', moved(side(), -W / 2, 0, 0, Math.PI / 2), 1.5);

    // alicerce de pedra, um palmo mais largo que as paredes
    for (const sx of [-1, 1]) {
        B.add('stone', board(0.34, 0.42, D + 0.24, sx * (W / 2 - 0.05), 0.12, 0, 0, 0, 0, 0.05), 1.1);
        B.add('stone', board(W / 2 - 1.0, 0.42, 0.34, sx * (W / 4 + 0.56), 0.12, D / 2 - 0.05, 0, 0, 0, 0.05), 1.1);
    }
    B.add('stone', board(W + 0.24, 0.42, 0.34, 0, 0.12, -D / 2 + 0.05, 0, 0, 0, 0.05), 1.1);

    // cantoneiras, moldura da porta e das janelas (madeira clara caiada)
    for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) B.add('trim', board(0.17, WH - 0.2, 0.17, sx * (W / 2 - 0.03), WH / 2 + 0.12, sz * (D / 2 - 0.03)), 0.9);
        B.add('trim', board(0.13, 2.1, 0.07, sx * 1.12, 1.05, D / 2 + 0.02), 0.9);
        B.add('trim', board(0.07, 0.75, 0.09, sx * (W / 2 + 0.01), 1.52, 0.47), 0.9);
        B.add('trim', board(0.07, 0.75, 0.09, sx * (W / 2 + 0.01), 1.52, -0.47), 0.9);
        B.add('trim', board(0.07, 0.09, 1.02, sx * (W / 2 + 0.01), 1.9, 0), 0.9);
        B.add('trim', board(0.1, 0.07, 1.1, sx * (W / 2 + 0.03), 1.16, 0), 0.9);
        // cruzeta da janela lateral
        B.add('trim', board(0.04, 0.66, 0.04, sx * (W / 2 - T / 2), 1.52, 0), 0.9);
        B.add('trim', board(0.04, 0.04, 0.84, sx * (W / 2 - T / 2), 1.52, 0), 0.9);
    }
    B.add('trim', board(2.4, 0.14, 0.08, 0, 2.1, D / 2 + 0.02), 0.9);
    for (const sz of [1, -1]) {
        B.add('trim', board(1.0, 0.09, 0.07, 0, 2.68, sz * (D / 2 + 0.01)), 0.9);
        // faixa horizontal na linha do beiral
        B.add('trim', board(W + 0.1, 0.12, 0.06, 0, WH, sz * (D / 2 + 0.01)), 0.9);
    }

    // telhado: 2 águas por lado, com espessura e beiral
    const RT = 0.22;
    const OV = 0.42;
    for (const sx of [-1, 1]) {
        const segs = [
            [[W / 2 + 0.38, WH - 0.36], [KX, KY]],
            [[KX, KY], [0, RY]]
        ];
        segs.forEach(([a, b], i) => {
            const dx = b[0] - a[0];
            const dy = b[1] - a[1];
            const seg = Math.hypot(dx, dy);
            const len = seg + (i === 0 ? 0.06 : 0.1);
            const ang = Math.atan2(dy, dx);
            const mx = (a[0] + b[0]) / 2;
            const my = (a[1] + b[1]) / 2;
            // normal para fora (lado direito): (dy, −dx)/|d|; o lado esquerdo é o espelho em x
            const nx = dy / seg;
            const ny = -dx / seg;
            const rot = sx > 0 ? ang : Math.PI - ang;
            const g = board(len, RT, D + OV * 2, 0, 0, 0, 0, 0, 0, 0.07);
            _e.set(0, 0, rot);
            g.applyMatrix4(_m.compose(_p.set(sx * (mx + nx * RT * 0.5), my + ny * RT * 0.5, 0), _q.setFromEuler(_e), _s));
            B.add('thatch', g, 1.7);
            // caibro aparente sob o beiral, nas duas empenas
            for (const sz of [-1, 1]) {
                const r = board(len - 0.1, 0.11, 0.09, 0, 0, 0, 0, 0, 0, 0.02);
                r.applyMatrix4(_m.compose(_p.set(sx * (mx - nx * 0.05), my - ny * 0.05, sz * (D / 2 + OV - 0.1)), _q.setFromEuler(_e), _s));
                B.add('trim', r, 0.9);
            }
        });
    }
    // cumeeira de palha amarrada
    const ridge = new THREE.CapsuleGeometry(0.2, D + OV * 2 - 0.4, 4, 10);
    ridge.rotateX(Math.PI / 2);
    ridge.scale(1.25, 0.7, 1);
    B.add('thatch', moved(ridge, 0, RY + 0.17, 0), 1.7);

    // viga do sótão com roldana, acima da janela
    B.add('wood', board(0.12, 0.12, 0.9, 0, 3.98, D / 2 + 0.3), 1.2);

    // portas duplas abertas (dobradiça em x = ±1.05)
    for (const sx of [-1, 1]) {
        const open = sx * 1.95;
        const parts = [
            ['planks', board(1.02, 1.96, 0.06, 0.51 * -sx, 1.0, 0), 1.5],
            ['trim', board(1.02, 0.11, 0.035, 0.51 * -sx, 0.16, 0.045), 0.9],
            ['trim', board(1.02, 0.11, 0.035, 0.51 * -sx, 1.84, 0.045), 0.9],
            ['trim', board(0.1, 1.6, 0.035, 0.05 * -sx, 1.0, 0.045), 0.9],
            ['trim', board(0.1, 1.6, 0.035, 0.97 * -sx, 1.0, 0.045), 0.9],
            ['trim', board(1.9, 0.1, 0.035, 0.51 * -sx, 1.0, 0.045, 0, 0, sx * 1.07), 0.9]
        ];
        for (const [key, g, uv] of parts) {
            _e.set(0, open, 0);
            g.applyMatrix4(_m.compose(_p.set(sx * 1.05, 0.03, D / 2 + 0.04), _q.setFromEuler(_e), _s));
            B.add(key, g, uv);
        }
    }

    // fardos de feno lá dentro
    const bale = (x, y, z, ry) => {
        const g = new RoundedBoxGeometry(0.95, 0.46, 0.5, 3, 0.07);
        const pa = g.attributes.position;
        for (let i = 0; i < pa.count; i++) {
            const n = fbm2(pa.getX(i) * 9 + x, pa.getZ(i) * 9 + pa.getY(i) * 7, 2) - 0.5;
            pa.setXYZ(i, pa.getX(i) * (1 + n * 0.06), pa.getY(i) * (1 + n * 0.08), pa.getZ(i) * (1 + n * 0.06));
        }
        return moved(g, x, y, z, ry);
    };
    B.add('hay', bale(-1.5, 0.3, -1.2, 0.2), 0.8);
    B.add('hay', bale(-1.35, 0.76, -1.25, -0.25), 0.8);
    B.add('hay', bale(-1.55, 0.3, -0.5, 1.4), 0.8);
    B.add('hay', bale(1.45, 0.3, -1.35, -0.1), 0.8);

    const materials = {
        planks: pbrMaterial('weathered_brown_planks', { color: 0xd4553f, normalScale: 1.2 }),
        trim: pbrMaterial('oak_wood_planks', { color: 0xf3ead8, normalScale: 0.8 }),
        stone: pbrMaterial('castle_wall_slates', { color: 0xd8d2c6 }),
        thatch: pbrMaterial('thatch_roof_angled', { color: 0xf0dcae, normalScale: 1.4 }),
        wood: pbrMaterial('dark_wooden_planks', { color: 0xc9b79c }),
        hay: pbrMaterial('thatch_roof_angled', { color: 0xf6dc8c, normalScale: 1.2 })
    };
    const group = B.build(materials);
    group.name = 'celeiro';
    return group;
}

// ═══════════════════════════════════════════════════════════════════════════
// Ninho do piquenique
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Toalha xadrez redonda estendida sobre o terreno (segue o relevo + rugas):
 *   y = terreno(x, z) + 0,035 + 0,018·fbm(x·2,3, z·2,3) + 0,012·sin(6θ)·(r/R)³   (franja ondulada)
 * UV em metros: 1 repetição do xadrez a cada 0,85 m.
 */
export function createBlanket(terrain, cx, cz, radius = 2.15) {
    const rings = 14;
    const segs = 64;
    const pos = [];
    const uv = [];
    const idx = [];
    for (let j = 0; j <= rings; j++) {
        const k = j / rings;
        for (let i = 0; i < segs; i++) {
            const a = (i / segs) * TAU;
            // contorno de pano: quase redondo, com cantos moles
            const r = radius * k * (1 + 0.035 * Math.sin(a * 4 + 0.7) * k + 0.02 * Math.sin(a * 9) * k * k);
            const x = cx + Math.cos(a) * r;
            const z = cz + Math.sin(a) * r;
            const y = terrain.heightAt(x, z) + 0.035 + 0.018 * fbm2(x * 2.3, z * 2.3, 2) + 0.012 * Math.sin(a * 6) * k * k * k;
            pos.push(x, y, z);
            uv.push(x / 0.85, z / 0.85);
        }
    }
    for (let j = 0; j < rings; j++) {
        for (let i = 0; i < segs; i++) {
            const a = j * segs + i;
            const b = j * segs + ((i + 1) % segs);
            const c = (j + 1) * segs + ((i + 1) % segs);
            const d = (j + 1) * segs + i;
            idx.push(a, c, b, a, d, c);
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, pbrMaterial('fabric_pattern_07', { side: THREE.DoubleSide, normalScale: 1.2, color: 0xfff4ec }));
    mesh.name = 'toalha';
    mesh.receiveShadow = true;
    return mesh;
}

/**
 * Borda do ninho: um rolo de palha trançada em arco de 290° ao redor da toalha,
 * com a abertura virada para `gap` (rad). Seção oval com relevo de fibras:
 *   r(θ, φ) = r0·(1 + 0,16·fbm(θ·7, φ·3)) , mais alto no fundo do ninho que na entrada.
 */
export function createNestRim(terrain, cx, cz, { radius = 2.75, gap = Math.PI / 2, arc = 5.05 } = {}) {
    const along = 120;
    const around = 14;
    const pos = [];
    const idx = [];
    const start = gap + (TAU - arc) / 2;
    for (let j = 0; j <= along; j++) {
        const k = j / along;
        const th = start + arc * k;
        // afina nas pontas, engorda no fundo
        const taper = Math.pow(Math.sin(Math.PI * k), 0.35);
        const R = radius + 0.08 * Math.sin(th * 5.3);
        const bx = cx + Math.cos(th) * R;
        const bz = cz + Math.sin(th) * R;
        const by = terrain.heightAt(bx, bz);
        for (let i = 0; i < around; i++) {
            const ph = (i / around) * TAU;
            const n = fbm2(th * 7 + 3, ph * 3 + j * 0.13, 2);
            const rr = (0.2 + 0.13 * Math.sin(Math.PI * k)) * taper * (0.86 + 0.3 * n);
            const dr = Math.cos(ph) * rr * 1.25;
            const dy = Math.sin(ph) * rr * 0.9 + rr * 0.62;
            pos.push(cx + Math.cos(th) * (R + dr), by + dy - 0.03, cz + Math.sin(th) * (R + dr));
        }
    }
    for (let j = 0; j < along; j++) {
        for (let i = 0; i < around; i++) {
            const a = j * around + i;
            const b = j * around + ((i + 1) % around);
            const c = (j + 1) * around + ((i + 1) % around);
            const d = (j + 1) * around + i;
            idx.push(a, b, c, a, c, d);
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    applyWorldUV(g, 0.9);
    const mesh = new THREE.Mesh(g, pbrMaterial('thatch_roof_angled', { color: 0xfff0c4, normalScale: 1.6 }));
    mesh.name = 'ninho';
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

/** Anel de luz no chão do ninho: acende quando há filhotes na fila (shader aditivo, sem malha de toro). */
export function createHomeGlow(radius = 3.1) {
    const g = new THREE.CircleGeometry(radius, 48);
    g.rotateX(-Math.PI / 2);
    const uniforms = { uOpacity: { value: 0 }, uTime: { value: 0 } };
    const mat = new THREE.ShaderMaterial({
        uniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: /* glsl */ `
            uniform float uOpacity, uTime;
            varying vec2 vUv;
            void main() {
                vec2 c = vUv - 0.5;
                float d = length(c) * 2.0;
                float a = atan(c.y, c.x);
                float ring = smoothstep(0.62, 0.86, d) * (1.0 - smoothstep(0.86, 1.0, d));
                float rays = 0.75 + 0.25 * sin(a * 12.0 + uTime * 1.6);
                float inner = (1.0 - smoothstep(0.0, 0.9, d)) * 0.16;
                gl_FragColor = vec4(vec3(1.0, 0.78, 0.32) * (ring * rays + inner) * uOpacity * 0.55, 1.0);
            }`
    });
    const mesh = new THREE.Mesh(g, mat);
    mesh.name = 'brilhoDoNinho';
    mesh.renderOrder = 3;
    return { mesh, uniforms };
}

// ═══════════════════════════════════════════════════════════════════════════
// Cogumelos e amoras
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Cogumelo de chapéu vermelho: um único perfil torneado (pé bojudo → anel → lamelas
 * → chapéu) com cor por vértice, e pintas brancas como calotas sobre o chapéu.
 * Altura 1 (escala na instância).
 */
export function mushroomGeometry(seed = 1) {
    const rnd = seeded(seed * 17 + 3);
    const prof = [
        [0.0, 0.0], [0.17, 0.0], [0.2, 0.05], [0.17, 0.16], [0.125, 0.32], [0.115, 0.46],
        [0.15, 0.5], [0.13, 0.54], [0.115, 0.58], [0.34, 0.585], [0.52, 0.6], [0.56, 0.635],
        [0.53, 0.72], [0.42, 0.84], [0.26, 0.94], [0.1, 0.99], [0.0, 1.0]
    ];
    const pts = new THREE.SplineCurve(prof.map((p) => new THREE.Vector2(p[0], p[1]))).getPoints(22);
    pts[0].x = 0;
    pts[pts.length - 1].x = 0;
    const g = new THREE.LatheGeometry(pts, 18);
    const pa = g.attributes.position;
    const col = new Float32Array(pa.count * 3);
    const stem = new THREE.Color(0xf4ead6);
    const gill = new THREE.Color(0xe9d2b0);
    const cap = new THREE.Color(0xd8362a);
    const capTop = new THREE.Color(0xf0683a);
    const c = new THREE.Color();
    const bend = (rnd() - 0.5) * 0.3;
    for (let i = 0; i < pa.count; i++) {
        let x = pa.getX(i);
        const y = pa.getY(i);
        let z = pa.getZ(i);
        const r = Math.hypot(x, z);
        const a = Math.atan2(z, x);
        if (y > 0.6) {
            // chapéu levemente irregular
            const n = 1 + 0.06 * Math.sin(a * 3 + seed) + 0.03 * Math.sin(a * 7 + seed * 2);
            x *= n;
            z *= n;
            c.copy(cap).lerp(capTop, smoothstep(0.75, 1, y));
        } else if (y > 0.575 && r > 0.13) {
            // lamelas: ondinhas radiais por baixo
            c.copy(gill).multiplyScalar(0.78 + 0.22 * Math.sin(a * 40));
        } else {
            c.copy(stem).multiplyScalar(0.9 + 0.1 * fbm2(a * 2, y * 9, 2));
            if (y < 0.08) c.multiplyScalar(0.78);
        }
        // pé torto
        x += bend * y * (1 - y) * 0.9;
        pa.setXYZ(i, x, y, z);
        col[i * 3] = c.r;
        col[i * 3 + 1] = c.g;
        col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    // normais suaves calculadas na malha indexada (depois do merge ficariam facetadas)
    g.computeVertexNormals();
    const parts = [g.toNonIndexed()];
    // pintas
    const white = new THREE.Color(0xfff6e6);
    for (let i = 0; i < 7; i++) {
        const a = rnd() * TAU;
        const t = 0.18 + rnd() * 0.7; // 0 = topo, 1 = aba
        const rr = 0.5 * Math.sin(t * Math.PI / 2);
        const y = 0.62 + 0.375 * Math.cos(t * Math.PI / 2);
        const s = 0.035 + rnd() * 0.04;
        const dot = new THREE.SphereGeometry(1, 8, 3, 0, TAU, 0, Math.PI / 2);
        dot.scale(s, s * 0.45, s);
        // deita a pinta na inclinação do chapéu
        _eYZX.set(0, -a, -t * 1.15);
        dot.applyMatrix4(_m.compose(_p.set(Math.cos(a) * rr * 0.97, y - 0.012, Math.sin(a) * rr * 0.97), _q.setFromEuler(_eYZX), _s));
        const dc = new Float32Array(dot.attributes.position.count * 3);
        for (let k = 0; k < dc.length; k += 3) {
            dc[k] = white.r;
            dc[k + 1] = white.g;
            dc[k + 2] = white.b;
        }
        dot.setAttribute('color', new THREE.BufferAttribute(dc, 3));
        const ni = dot.toNonIndexed();
        ni.deleteAttribute('uv');
        parts.push(ni);
    }
    parts[0].deleteAttribute('uv');
    return mergeGeometries(parts, false);
}

/**
 * Amora: fruto agregado esculpido por vértice. Sobre um ovoide, cada drupéola é
 * um bojo ao redor de uma semente de Fibonacci na esfera:
 *   r(p) = r0(p)·(1 + 0,2·max_i(1 − (ângulo(p, s_i)/α)²)₊),  α ≈ 0,34 rad (48 sementes)
 * mais um cálice de 5 sépalas verdes no topo. Raio ≈ 1 (escala na instância).
 */
export function berryGeometry(detail = 1) {
    const g = new THREE.SphereGeometry(1, detail ? 26 : 14, detail ? 18 : 10);
    const N = 48;
    const seeds = [];
    for (let i = 0; i < N; i++) {
        const y = 1 - (i + 0.5) * 2 / N;
        const r = Math.sqrt(1 - y * y);
        const a = i * 2.39996;
        seeds.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
    }
    const pa = g.attributes.position;
    const col = new Float32Array(pa.count * 3);
    const dark = new THREE.Color(0x1c0a2a);
    const lit = new THREE.Color(0x6a2a8c);
    const c = new THREE.Color();
    const v = new THREE.Vector3();
    for (let i = 0; i < pa.count; i++) {
        v.fromBufferAttribute(pa, i).normalize();
        let best = 0;
        for (const s of seeds) {
            const d = Math.acos(Math.min(1, v.dot(s))) / 0.34;
            best = Math.max(best, 1 - d * d);
        }
        // ovoide: mais largo em cima, ponta embaixo
        const body = 0.82 + 0.16 * v.y - 0.1 * v.y * v.y;
        const r = body * (1 + 0.2 * Math.max(0, best));
        pa.setXYZ(i, v.x * r, v.y * r * 1.12, v.z * r);
        c.copy(dark).lerp(lit, Math.pow(Math.max(0, best), 0.7));
        col[i * 3] = c.r;
        col[i * 3 + 1] = c.g;
        col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.deleteAttribute('uv');
    g.computeVertexNormals();
    const parts = [g.toNonIndexed()];
    // cálice: 5 sépalas curvas + cabinho
    const green = new THREE.Color(0x5f9a3a);
    const sepal = (a) => {
        const s = new THREE.SphereGeometry(1, detail ? 6 : 4, detail ? 4 : 2);
        s.scale(0.2, 0.06, 0.46);
        s.translate(0, 0, 0.42);
        s.rotateX(0.32);
        s.rotateY(a);
        s.translate(0, 1.0, 0);
        return s;
    };
    const stalk = new THREE.CylinderGeometry(0.05, 0.07, 0.5, 5, 1);
    stalk.translate(0, 1.26, 0);
    for (const s of [sepal(0), sepal(TAU / 5), sepal(TAU * 2 / 5), sepal(TAU * 3 / 5), sepal(TAU * 4 / 5), stalk]) {
        const n = s.attributes.position.count;
        const sc = new Float32Array(n * 3);
        for (let k = 0; k < n; k++) {
            sc[k * 3] = green.r;
            sc[k * 3 + 1] = green.g;
            sc[k * 3 + 2] = green.b;
        }
        s.setAttribute('color', new THREE.BufferAttribute(sc, 3));
        s.deleteAttribute('uv');
        parts.push(s.toNonIndexed());
    }
    return mergeGeometries(parts, false);
}

// ═══════════════════════════════════════════════════════════════════════════
// Corações, borboletas, arco-íris, orvalho, pólen
// ═══════════════════════════════════════════════════════════════════════════

/** Coração gordinho: contorno de Bézier extrudado com chanfro redondo. Largura ≈ 1. */
export function heartGeometry() {
    const s = new THREE.Shape();
    s.moveTo(0, -0.46);
    s.bezierCurveTo(-0.62, -0.02, -0.56, 0.46, -0.25, 0.46);
    s.bezierCurveTo(-0.1, 0.46, 0, 0.36, 0, 0.24);
    s.bezierCurveTo(0, 0.36, 0.1, 0.46, 0.25, 0.46);
    s.bezierCurveTo(0.56, 0.46, 0.62, -0.02, 0, -0.46);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.13, bevelSize: 0.11, bevelSegments: 6, curveSegments: 18 });
    g.translate(0, 0, -0.05);
    g.computeVertexNormals();
    return g;
}

/**
 * Borboletas: 1 InstancedMesh, duas asas por instância. O bater é no vértice:
 *   ângulo = 0,15 + 1,05·|sin(t·f + fase)|      (asas giram em torno do corpo, eixo Z local)
 * O desenho da asa (contorno, nervuras, borda escura, ocelos) é procedural no fragmento.
 * As posições vêm de órbitas baratas calculadas em CPU (ver world.js).
 */
export function createButterflies(count) {
    // asa direita: quad em x ∈ [0, 1]; aSide = ±1 espelha
    const base = new THREE.PlaneGeometry(1, 1.25, 4, 1);
    base.translate(0.5, 0, 0);
    base.rotateX(-Math.PI / 2);
    const g = new THREE.InstancedBufferGeometry();
    const p = base.attributes.position;
    const n = p.count;
    const pos = new Float32Array(n * 2 * 3);
    const uv = new Float32Array(n * 2 * 2);
    const side = new Float32Array(n * 2);
    for (let s = 0; s < 2; s++) {
        for (let i = 0; i < n; i++) {
            const o = s * n + i;
            pos[o * 3] = p.getX(i);
            pos[o * 3 + 1] = p.getY(i);
            pos[o * 3 + 2] = p.getZ(i);
            uv[o * 2] = base.attributes.uv.getX(i);
            uv[o * 2 + 1] = base.attributes.uv.getY(i);
            side[o] = s ? -1 : 1;
        }
    }
    const index = [];
    for (let s = 0; s < 2; s++) for (let i = 0; i < base.index.count; i++) index.push(base.index.getX(i) + s * n);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
    g.setIndex(index);
    const phase = new Float32Array(count);
    const tint = new Float32Array(count * 3);
    const palette = [0xff8a3c, 0xffd23a, 0x7fb4ff, 0xff7fb0, 0xf5f0e0, 0xb48cf0];
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
        phase[i] = Math.random() * 40;
        c.set(palette[i % palette.length]);
        tint[i * 3] = c.r;
        tint[i * 3 + 1] = c.g;
        tint[i * 3 + 2] = c.b;
    }
    g.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
    g.setAttribute('aTint', new THREE.InstancedBufferAttribute(tint, 3));
    g.instanceCount = count;
    const uniforms = { uTime: { value: 0 }, uLight: { value: new THREE.Color(1, 1, 1) } };
    const mat = new THREE.ShaderMaterial({
        uniforms,
        side: THREE.DoubleSide,
        vertexShader: /* glsl */ `
            attribute float aSide, aPhase;
            attribute vec3 aTint;
            attribute mat4 instanceMatrix;
            uniform float uTime;
            varying vec2 vUv;
            varying vec3 vTint;
            varying float vShade;
            void main() {
                float ang = 0.15 + 1.05 * abs(sin(uTime * 11.0 + aPhase));
                vec3 p = position;
                float c = cos(ang), s = sin(ang);
                p = vec3(p.x * c, p.x * s, p.z);
                p.x *= aSide;
                vUv = uv;
                vTint = aTint;
                vShade = 0.72 + 0.28 * c;
                gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(p, 1.0);
            }`,
        fragmentShader: /* glsl */ `
            uniform vec3 uLight;
            varying vec2 vUv;
            varying vec3 vTint;
            varying float vShade;
            void main() {
                // u: 0 no corpo → 1 na ponta; v: 0 atrás → 1 na frente
                vec2 q = vUv;
                float fore = length((q - vec2(0.34, 0.66)) / vec2(0.62, 0.34));
                float hind = length((q - vec2(0.3, 0.28)) / vec2(0.46, 0.3));
                float d = min(fore, hind);
                if (d > 1.0) discard;
                float edge = smoothstep(0.62, 0.98, d);
                float veins = 0.85 + 0.15 * sin(atan(q.y - 0.5, q.x) * 22.0);
                float eye = 1.0 - smoothstep(0.05, 0.11, length(q - vec2(0.56, 0.7)));
                vec3 col = mix(vTint * veins, vec3(0.05, 0.03, 0.02), edge);
                col = mix(col, vec3(1.0, 0.97, 0.9), eye * 0.8);
                gl_FragColor = vec4(col * uLight * vShade, 1.0);
            }`
    });
    const mesh = new THREE.Mesh(g, mat);
    mesh.name = 'borboletas';
    mesh.frustumCulled = false;
    const matrices = new Float32Array(count * 16);
    g.setAttribute('instanceMatrix', new THREE.InstancedBufferAttribute(matrices, 16));
    return { mesh, uniforms, matrices, attribute: g.attributes.instanceMatrix, count };
}

/**
 * Arco-íris de depois da chuva. Fisicamente ele é um círculo de 42° em torno do
 * ponto antissolar; aqui o eixo é o antissolar em planta, erguido o bastante para
 * o topo do arco passar ~24° acima do horizonte (licença poética: com o sol das
 * 9 h o arco real estaria quase todo abaixo do horizonte).
 *   cor(ρ) = espectro(ρ) para ρ ∈ [40°, 42,4°] (vermelho por fora), + arco secundário fraco a 51°
 */
export function createRainbow(sunDir, distance = 400) {
    const axis = new THREE.Vector3(-sunDir.x, 0, -sunDir.z).normalize();
    // eleva o eixo para −18° (abaixo do horizonte): topo do arco a 42 − 18 = 24°
    const el = -18 * Math.PI / 180;
    axis.multiplyScalar(Math.cos(el)).setY(Math.sin(el));
    const segs = 96;
    const pos = [];
    const uv = [];
    const idx = [];
    const u = new THREE.Vector3().crossVectors(axis, new THREE.Vector3(0, 1, 0)).normalize();
    const w = new THREE.Vector3().crossVectors(u, axis).normalize();
    const ring = (ang, t) => {
        for (let i = 0; i <= segs; i++) {
            const a = (i / segs) * Math.PI * 2;
            const r = Math.sin(ang) * distance;
            const d = Math.cos(ang) * distance;
            pos.push(axis.x * d + (u.x * Math.cos(a) + w.x * Math.sin(a)) * r,
                axis.y * d + (u.y * Math.cos(a) + w.y * Math.sin(a)) * r,
                axis.z * d + (u.z * Math.cos(a) + w.z * Math.sin(a)) * r);
            uv.push(i / segs, t);
        }
    };
    const DEG = Math.PI / 180;
    ring(38.6 * DEG, 0);
    ring(53.5 * DEG, 1);
    for (let i = 0; i < segs; i++) idx.push(i, i + 1, segs + 1 + i + 1, i, segs + 1 + i + 1, segs + 1 + i);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    const uniforms = { uOpacity: { value: 0.5 } };
    const mat = new THREE.ShaderMaterial({
        uniforms,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
            varying vec2 vUv;
            varying float vY;
            void main() {
                vUv = uv;
                vec4 wp = modelMatrix * vec4(position, 1.0);
                vY = normalize(position).y;
                gl_Position = projectionMatrix * viewMatrix * wp;
                gl_Position.z = gl_Position.w * 0.9999;
            }`,
        fragmentShader: /* glsl */ `
            uniform float uOpacity;
            varying vec2 vUv;
            varying float vY;
            vec3 spectrum(float t) {
                // t: 0 violeta (dentro) → 1 vermelho (fora)
                vec3 c = vec3(0.0);
                c += vec3(0.55, 0.1, 0.9) * smoothstep(0.0, 0.1, t) * (1.0 - smoothstep(0.1, 0.3, t));
                c += vec3(0.1, 0.35, 1.0) * smoothstep(0.1, 0.28, t) * (1.0 - smoothstep(0.28, 0.46, t));
                c += vec3(0.1, 0.9, 0.3) * smoothstep(0.28, 0.46, t) * (1.0 - smoothstep(0.46, 0.64, t));
                c += vec3(1.0, 0.9, 0.1) * smoothstep(0.46, 0.62, t) * (1.0 - smoothstep(0.62, 0.78, t));
                c += vec3(1.0, 0.45, 0.05) * smoothstep(0.6, 0.76, t) * (1.0 - smoothstep(0.76, 0.9, t));
                c += vec3(1.0, 0.1, 0.1) * smoothstep(0.74, 0.88, t) * (1.0 - smoothstep(0.9, 1.0, t));
                return c;
            }
            void main() {
                // faixa [38,6°, 53,5°]: primário em 40–42,4°, secundário (invertido) em 50,5–53°
                float deg = mix(38.6, 53.5, vUv.y);
                float t1 = (deg - 40.0) / 2.4;
                float t2 = 1.0 - (deg - 50.4) / 2.8;
                vec3 col = spectrum(clamp(t1, 0.0, 1.0)) * step(0.0, t1) * step(t1, 1.0);
                col += spectrum(clamp(t2, 0.0, 1.0)) * step(0.0, t2) * step(t2, 1.0) * 0.28;
                // brilho leitoso por dentro do arco (banda de Alexandre fica escura entre os dois)
                col += vec3(0.05) * (1.0 - smoothstep(38.6, 40.2, deg));
                float fade = smoothstep(-0.01, 0.1, vY);
                gl_FragColor = vec4(col * uOpacity * fade, 1.0);
            }`
    });
    const mesh = new THREE.Mesh(g, mat);
    mesh.name = 'arcoIris';
    mesh.frustumCulled = false;
    mesh.renderOrder = -5;
    return { mesh, uniforms };
}

/**
 * Gotas de chuva ainda presas na grama: pontos aditivos que cintilam conforme a
 * câmera anda (o brilho de uma gota depende do ângulo entre olho, gota e sol):
 *   faísca = pow(0,5 + 0,5·sin(fase + dot(câmera.xz, k) + t·0,6), 28)
 * Somem depois de 34 m e não custam CPU.
 */
export function createDew(terrain, { count = 1400, radius = 39 } = {}) {
    const rnd = seeded(91);
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    const w5 = [0, 0, 0, 0, 0];
    let n = 0;
    for (let t = 0; t < count * 4 && n < count; t++) {
        const a = rnd() * TAU;
        const r = Math.sqrt(rnd()) * radius;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        terrain.weightsAt(x, z, w5);
        if (w5[0] < 0.6 || w5[4] > 0.2) continue;
        pos[n * 3] = x;
        pos[n * 3 + 1] = terrain.heightAt(x, z) + 0.12 + rnd() * 0.2;
        pos[n * 3 + 2] = z;
        seed[n] = rnd() * 100;
        n++;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, n * 3), 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed.subarray(0, n), 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), radius + 5);
    const uniforms = { uTime: { value: 0 }, uScale: { value: 600 }, uColor: { value: new THREE.Color(1, 0.96, 0.86) } };
    const mat = new THREE.ShaderMaterial({
        uniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
            attribute float aSeed;
            uniform float uTime, uScale;
            varying float vA;
            void main() {
                vec4 mv = modelViewMatrix * vec4(position, 1.0);
                float dist = -mv.z;
                float tw = pow(0.5 + 0.5 * sin(aSeed * 6.3 + dot(cameraPosition.xz, vec2(2.1, 1.7)) * (0.6 + fract(aSeed) * 0.8) + uTime * 0.6), 28.0);
                vA = tw * (1.0 - smoothstep(18.0, 34.0, dist)) * smoothstep(0.6, 2.0, dist);
                gl_PointSize = clamp(uScale * (0.02 + 0.05 * tw) / dist, 0.0, 26.0);
                gl_Position = projectionMatrix * mv;
            }`,
        fragmentShader: /* glsl */ `
            uniform vec3 uColor;
            varying float vA;
            void main() {
                vec2 c = gl_PointCoord - 0.5;
                float d = length(c);
                // estrela de 4 pontas + miolo
                float star = max(0.0, 1.0 - abs(c.x) * 14.0) * max(0.0, 1.0 - abs(c.y) * 3.0) + max(0.0, 1.0 - abs(c.y) * 14.0) * max(0.0, 1.0 - abs(c.x) * 3.0);
                float a = (smoothstep(0.22, 0.0, d) + star * 0.8) * vA;
                if (a < 0.004) discard;
                gl_FragColor = vec4(uColor * a * 2.2, 1.0);
            }`
    });
    const points = new THREE.Points(g, mat);
    points.name = 'orvalho';
    points.renderOrder = 6;
    return { points, uniforms };
}

/**
 * Pólen à contraluz: campo infinito de pontos em volta da câmera, ancorado no
 * mundo (não acompanha a câmera — ela anda por dentro dele):
 *   p = câmera + mod(semente·L + vento·t − câmera, L) − L/2,   L = 18 m
 */
export function createPollen(count = 220) {
    const seed = new Float32Array(count * 3);
    for (let i = 0; i < seed.length; i++) seed[i] = Math.random();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(seed, 3));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    const uniforms = { uTime: { value: 0 }, uScale: { value: 600 }, uColor: { value: new THREE.Color(1, 0.93, 0.7) } };
    const mat = new THREE.ShaderMaterial({
        uniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
            uniform float uTime, uScale;
            varying float vA;
            void main() {
                const vec3 L = vec3(18.0, 5.0, 18.0);
                vec3 drift = vec3(0.22, 0.03, 0.14) * uTime + vec3(sin(uTime * 0.4 + position.y * 20.0), sin(uTime * 0.3 + position.x * 17.0) * 0.5, cos(uTime * 0.35 + position.z * 23.0)) * 0.25;
                vec3 p = cameraPosition + mod(position * L + drift - cameraPosition, L) - L * 0.5;
                p.y += 1.4;
                vec4 mv = viewMatrix * vec4(p, 1.0);
                float dist = -mv.z;
                vA = (1.0 - smoothstep(5.0, 9.0, dist)) * smoothstep(0.5, 1.5, dist) * (0.45 + 0.55 * fract(position.x * 91.7));
                gl_PointSize = clamp(uScale * 0.028 / dist, 0.0, 12.0);
                gl_Position = projectionMatrix * mv;
            }`,
        fragmentShader: /* glsl */ `
            uniform vec3 uColor;
            varying float vA;
            void main() {
                float d = length(gl_PointCoord - 0.5);
                float a = smoothstep(0.5, 0.1, d) * vA;
                if (a < 0.004) discard;
                gl_FragColor = vec4(uColor * a * 0.9, 1.0);
            }`
    });
    const points = new THREE.Points(g, mat);
    points.name = 'polen';
    points.frustumCulled = false;
    points.renderOrder = 7;
    return { points, uniforms };
}

