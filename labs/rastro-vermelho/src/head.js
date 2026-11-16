/**
 * Cabeça esculpida para os humanos do lab (substitui a cabeça-manequim do kit).
 *
 * Unidades e eixos: espaço local do osso `head` do kit (metros para 1,75 m de altura;
 * +Y para cima, +Z para o rosto). O crânio é um elipsoide (raios 74 × 106 × 94 mm,
 * centro 98 mm acima do osso) amostrado numa grade (θ, φ) mais densa na frente:
 *   θ = π · sign(u) · |u|^1,6   com u ∈ [−1, 1]  →  ~3 mm entre vértices no rosto.
 * Sobre ele somam-se relevos gaussianos G(dx, dy) = exp(−dx²/sx² − dy²/sy²):
 * arcada da sobrancelha, órbitas, dorso/ponta/asas do nariz, maçãs, lábios e queixo;
 * a mandíbula afina em x conforme y desce (até −27 % no queixo).
 * A cor de vértice multiplica o tom de pele do material: lábios, sombra das órbitas,
 * narinas, rubor e (opcional) barba por fazer.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const sstep = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const G = (dx, dy, sx, sy) => Math.exp(-(dx * dx) / (sx * sx) - (dy * dy) / (sy * sy));

const C = { x: 0, y: 0.098, z: 0.01 };
const RX = 0.074, RY = 0.106, RZ = 0.094;
export const EYE = { x: 0.031, y: 0.113, z: 0.0745, r: 0.012 };

/** Posição esculpida + cor para a direção (θ, φ). Devolve [x, y, z, r, g, b]. */
function sculpt(theta, phi, stubble) {
    const sp = Math.sin(phi);
    let x = C.x + RX * sp * Math.sin(theta);
    let y = C.y + RY * Math.cos(phi);
    let z = C.z + RZ * sp * Math.cos(theta);
    const front = sstep(0.0, 0.05, z);
    const ax = Math.abs(x);

    // mandíbula afina; nuca levemente mais cheia; têmporas mais estreitas
    const jaw = sstep(0.088, -0.006, y);
    x *= 1 - 0.27 * jaw * (0.55 + 0.45 * front);
    x *= 1 - 0.07 * sstep(0.115, 0.2, y);
    if (z < 0) z *= 1 + 0.06 * sstep(0.06, 0.14, y);
    // pescoço: a base fecha para dentro atrás do queixo
    if (z < 0.03) { const k = sstep(0.05, -0.006, y); x *= 1 - 0.25 * k; z *= 1 - 0.3 * k; }

    let dz = 0;
    dz += 0.0065 * G(ax - 0.03, y - 0.1285, 0.03, 0.0085);          // arcada da sobrancelha
    dz -= 0.0125 * G(ax - EYE.x, y - EYE.y, 0.0165, 0.0105);         // órbitas
    dz += 0.011 * G(x, y - 0.106, 0.0085, 0.024);                    // dorso do nariz
    dz += 0.025 * G(x, y - 0.0805, 0.0105, 0.0115);                  // ponta
    dz += 0.0085 * G(ax - 0.0125, y - 0.0765, 0.0065, 0.0065);       // asas
    dz += 0.0045 * G(ax - 0.043, y - 0.088, 0.02, 0.016);            // maçãs
    dz -= 0.003 * G(ax - 0.026, y - 0.066, 0.008, 0.016);            // sulco nasolabial
    dz += 0.0058 * G(x, y - 0.0565, 0.021, 0.0048);                  // lábio superior
    dz += 0.0062 * G(x, y - 0.0452, 0.018, 0.0052);                  // lábio inferior
    dz -= 0.0042 * G(x, y - 0.0508, 0.025, 0.002);                   // comissura
    dz -= 0.003 * G(x, y - 0.035, 0.016, 0.0045);                    // sulco mentolabial
    dz += 0.0085 * G(x, y - 0.021, 0.02, 0.012);                     // queixo
    z += dz * front;

    // cor (multiplica o tom de pele)
    let r = 1, g = 1, b = 1;
    const mul = (cr, cg, cb, w) => { r *= 1 + (cr - 1) * w; g *= 1 + (cg - 1) * w; b *= 1 + (cb - 1) * w; };
    const lips = Math.max(G(x, y - 0.0565, 0.02, 0.0042), G(x, y - 0.0452, 0.017, 0.0046)) * front;
    mul(0.86, 0.6, 0.58, Math.min(1, lips * 1.25));
    mul(0.35, 0.3, 0.3, G(x, y - 0.0508, 0.022, 0.0016) * front);                    // linha da boca
    mul(0.74, 0.66, 0.64, G(ax - EYE.x, y - EYE.y, 0.017, 0.011) * front);           // sombra da órbita
    mul(0.3, 0.24, 0.22, G(ax - 0.0075, y - 0.0725, 0.0042, 0.003) * front);         // narinas
    mul(1.05, 0.9, 0.88, 0.55 * G(ax - 0.043, y - 0.082, 0.02, 0.016) * front);      // rubor
    mul(1.04, 0.95, 0.93, 0.6 * G(x, y - 0.081, 0.012, 0.012) * front);              // ponta do nariz
    if (stubble) {
        const beard = sstep(0.076, 0.058, y) * sstep(-0.03, 0.02, z) * (1 - Math.min(1, lips * 1.6)) * (0.75 + 0.25 * Math.sin(theta * 91) * Math.sin(phi * 113));
        mul(0.62, 0.62, 0.66, 0.6 * beard);
    }
    return [x, y, z, r, g, b];
}

function skullGeometry(stubble, U = 96, V = 100) {
    const pos = new Float32Array((U + 1) * (V + 1) * 3), col = new Float32Array((U + 1) * (V + 1) * 3), idx = [];
    for (let j = 0; j <= V; j++) {
        // φ um pouco mais denso na faixa do rosto (meio da esfera)
        const v = j / V, phi = Math.PI * (v + 0.06 * Math.sin(v * Math.PI * 2));
        for (let i = 0; i <= U; i++) {
            const u = (i / U) * 2 - 1, theta = Math.PI * Math.sign(u) * Math.pow(Math.abs(u), 1.6);
            const s = sculpt(theta, phi, stubble), o = (j * (U + 1) + i) * 3;
            pos[o] = s[0]; pos[o + 1] = s[1]; pos[o + 2] = s[2];
            col[o] = s[3]; col[o + 1] = s[4]; col[o + 2] = s[5];
        }
    }
    for (let j = 0; j < V; j++) for (let i = 0; i < U; i++) {
        const a = j * (U + 1) + i, b = a + 1, c = a + U + 1, d = c + 1;
        idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
}

function tint(g, r, gr = r, b = r) {
    const n = g.attributes.position.count, c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { c[i * 3] = r; c[i * 3 + 1] = gr; c[i * 3 + 2] = b; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    g.deleteAttribute('uv');
    return g;
}
const at = (g, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) =>
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz)));
const tube = (pts, r, seg = 12) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), seg, r, 6, false);

const cache = new Map();
function headGeometry(stubble) {
    const key = stubble ? 's' : 'c';
    if (!cache.has(key)) {
        const parts = [skullGeometry(stubble)];
        for (const s of [-1, 1]) {
            // orelha: concha achatada + lóbulo
            parts.push(tint(at(new THREE.SphereGeometry(1, 12, 10), s * 0.0725, 0.1, -0.006, 0, s * -0.35, s * -0.08, 0.007, 0.027, 0.016), 0.9, 0.8, 0.78));
            // pálpebras: calotas de pele sobre o globo (a superior desce até ~7° acima do centro da íris)
            parts.push(tint(at(new THREE.SphereGeometry(EYE.r * 1.1, 14, 6, 0, Math.PI * 2, 0, Math.PI * 0.3), s * EYE.x, EYE.y, EYE.z, 0.5), 0.9, 0.82, 0.8));
            parts.push(tint(at(new THREE.SphereGeometry(EYE.r * 1.08, 14, 4, 0, Math.PI * 2, Math.PI * 0.78, Math.PI * 0.22), s * EYE.x, EYE.y, EYE.z, -0.5), 0.9, 0.82, 0.8));
        }
        // pescoço (gira com a cabeça; a base some sob o lenço)
        parts.push(tint(at(new THREE.CylinderGeometry(0.057, 0.066, 0.13, 18, 1, true), 0, -0.03, -0.012, 0.1), 0.93, 0.9, 0.88));
        const g = mergeGeometries(parts.map((p) => { const q = p.index ? p.toNonIndexed() : p; for (const n of Object.keys(q.attributes)) if (!['position', 'normal', 'color'].includes(n)) q.deleteAttribute(n); return q; }));
        cache.set(key, g);
    }
    return cache.get(key);
}

let eyeGeo = null;
function eyesGeometry() {
    if (!eyeGeo) {
        const white = [], iris = [], pupil = [], glint = [];
        for (const s of [-1, 1]) {
            white.push(at(new THREE.SphereGeometry(EYE.r, 16, 12), s * EYE.x, EYE.y, EYE.z));
            // íris/pupila: calotas na frente do globo, levemente convergentes
            iris.push(at(new THREE.SphereGeometry(EYE.r * 1.012, 16, 4, 0, Math.PI * 2, 0, 0.5), s * EYE.x, EYE.y, EYE.z, Math.PI / 2 + 0.05, 0, 0).applyMatrix4(new THREE.Matrix4()));
            pupil.push(at(new THREE.SphereGeometry(EYE.r * 1.02, 12, 3, 0, Math.PI * 2, 0, 0.22), s * EYE.x, EYE.y, EYE.z, Math.PI / 2 + 0.05, 0, 0));
            glint.push(at(new THREE.SphereGeometry(0.0011, 6, 4), s * EYE.x + 0.003, EYE.y + 0.0035, EYE.z + EYE.r * 1.0));
        }
        eyeGeo = { white: mergeGeometries(white), iris: mergeGeometries(iris), pupil: mergeGeometries(pupil), glint: mergeGeometries(glint) };
    }
    return eyeGeo;
}

let hairGeo = null, browGeo = null, stacheGeo = null;
const eyeWhite = new THREE.MeshStandardMaterial({ color: 0xe9e4da, roughness: 0.22, envMapIntensity: 1.2 });
const pupilMat = new THREE.MeshStandardMaterial({ color: 0x050404, roughness: 0.1 });
const glintMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
const skinMats = new Map(), hairMats = new Map(), irisMats = new Map();
const memo = (map, key, make) => { if (!map.has(key)) map.set(key, make()); return map.get(key); };

/**
 * Cabeça pronta para pendurar no osso `head` (via proxy de escala inversa — ver dress()).
 * @param {{skin:number, hair:number, eyes?:number, stubble?:boolean, mustache?:boolean}} o
 */
export function createHead({ skin, hair, eyes = 0x4a3020, stubble = false, mustache = false }) {
    const root = new THREE.Group();
    // 6 % maior e 12 mm mais baixa que a cabeça do kit: queixo mais perto do lenço, pescoço menos comprido
    root.scale.setScalar(1.06);
    root.position.y = -0.012;
    const skinMat = memo(skinMats, skin, () => new THREE.MeshStandardMaterial({ color: skin, vertexColors: true, roughness: 0.58, envMapIntensity: 0.8 }));
    const hairMat = memo(hairMats, hair, () => new THREE.MeshStandardMaterial({ color: hair, roughness: 0.55, envMapIntensity: 0.6 }));
    const head = new THREE.Mesh(headGeometry(stubble), skinMat);
    head.castShadow = true;
    root.add(head);

    const e = eyesGeometry();
    root.add(new THREE.Mesh(e.white, eyeWhite), new THREE.Mesh(e.iris, memo(irisMats, eyes, () => new THREE.MeshStandardMaterial({ color: eyes, roughness: 0.25 }))), new THREE.Mesh(e.pupil, pupilMat), new THREE.Mesh(e.glint, glintMat));

    if (!hairGeo) {
        // cabelo curto: casca atrás e nas laterais (o topo fica sob o chapéu), costeletas incluídas
        const open = 1.38;
        hairGeo = at(new THREE.SphereGeometry(1, 28, 14, Math.PI / 2 + open, Math.PI * 2 - open * 2, 0, Math.PI * 0.56), C.x, C.y + 0.002, C.z - 0.004, 0, 0, 0, RX * 0.94 + 0.006, RY + 0.004, RZ * 1.03 + 0.005);
        const b = [], m = [];
        for (const s of [-1, 1]) {
            b.push(at(tube([[s * 0.012, 0.1262, 0.1005], [s * 0.026, 0.1318, 0.099], [s * 0.04, 0.1312, 0.0935], [s * 0.052, 0.1255, 0.084]], 0.0036), 0, 0, 0));
            m.push(tube([[0, 0.0635, 0.111], [s * 0.012, 0.0622, 0.1085], [s * 0.024, 0.0575, 0.101], [s * 0.034, 0.05, 0.091]], 0.0052));
        }
        browGeo = mergeGeometries(b);
        stacheGeo = mergeGeometries(m);
    }
    root.add(new THREE.Mesh(hairGeo, hairMat), new THREE.Mesh(browGeo, hairMat));
    if (mustache) root.add(new THREE.Mesh(stacheGeo, hairMat));
    return root;
}
