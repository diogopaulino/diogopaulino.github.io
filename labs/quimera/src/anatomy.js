/**
 * Quimera — medidas do corpo gerado pelo hero.js.
 *
 * As peças rígidas do eixo CORPO (gola, placa do peito, pingente, coldre…) precisam assentar
 * na superfície de um corpo cujas proporções mudam a cada kit. Em vez de números mágicos por
 * corpo, medimos a malha em repouso (posições + ossos dominantes) uma vez por geometria:
 *
 *   J[osso]            posição de repouso de cada osso (inversa da matriz de bind)
 *   frontZ(x, y)       z da frente do tronco naquele ponto (grade de 1 cm, máximo 3×3)
 *   backZ(x, y)        idem para as costas
 *   shell(C)           raio do tronco visto de um centro C em cada direção (48×24 setores,
 *                      interpolado): r(az, polar). É uma "pele estrelada" — vale para o tórax
 *                      e a bacia, que são convexos em volta do centro.
 *   limb(osso, t)      centro e raio de um membro a uma fração t do osso até o filho
 *
 * Tudo em metros do referencial construído (o mesmo dos ossos); `mount` converte uma posição
 * de repouso para o espaço local do osso e prende o objeto nele.
 */
import * as THREE from 'three';

const cache = new WeakMap();
const TORSO = ['hips', 'spine', 'chest', 'neck', 'clavL', 'clavR'];
const CHILD = { armL: 'foreL', armR: 'foreR', foreL: 'handL', foreR: 'handR', thighL: 'shinL', thighR: 'shinR', shinL: 'footL', shinR: 'footR' };

export function measure(hero) {
    const geo = hero.mesh.geometry;
    let A = cache.get(geo);
    if (A) return A;
    const bones = hero.mesh.skeleton.bones;
    const inv = hero.mesh.skeleton.boneInverses;
    const J = {};
    const index = {};
    const m = new THREE.Matrix4();
    bones.forEach((b, i) => {
        J[b.name] = new THREE.Vector3().setFromMatrixPosition(m.copy(inv[i]).invert());
        index[b.name] = i;
    });
    const pos = geo.attributes.position;
    const si = geo.attributes.skinIndex;
    const sw = geo.attributes.skinWeight;
    const n = pos.count;
    // osso dominante por vértice
    const dom = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
        let best = 0;
        let bw = -1;
        for (let k = 0; k < 4; k++) {
            const w = sw.getComponent(i, k);
            if (w > bw) {
                bw = w;
                best = si.getComponent(i, k);
            }
        }
        dom[i] = best;
    }
    const torso = new Set(TORSO.map((name) => index[name]));
    const CELL = 0.01;
    const front = new Map();
    const back = new Map();
    for (let i = 0; i < n; i++) {
        if (!torso.has(dom[i])) continue;
        const key = `${Math.round(pos.getX(i) / CELL)},${Math.round(pos.getY(i) / CELL)}`;
        const z = pos.getZ(i);
        if (!(front.get(key) >= z)) front.set(key, z);
        if (!(back.get(key) <= z)) back.set(key, z);
    }
    const sample = (map, x, y, pick, fallback) => {
        const ix = Math.round(x / CELL);
        const iy = Math.round(y / CELL);
        let out = null;
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const v = map.get(`${ix + dx},${iy + dy}`);
                if (v !== undefined && (out === null || pick(v, out))) out = v;
            }
        }
        return out === null ? fallback : out;
    };

    const NA = 48;
    const NP = 24;
    function shell(C) {
        const bins = new Float32Array(NA * NP);
        for (let i = 0; i < n; i++) {
            if (!torso.has(dom[i])) continue;
            const x = pos.getX(i) - C[0];
            const y = pos.getY(i) - C[1];
            const z = pos.getZ(i) - C[2];
            const r = Math.hypot(x, y, z);
            if (r < 1e-4) continue;
            const ia = Math.floor(((Math.atan2(x, z) + Math.PI) / (Math.PI * 2)) * NA) % NA;
            const ip = Math.min(NP - 1, Math.floor((Math.acos(y / r) / Math.PI) * NP));
            const k = ip * NA + ia;
            if (r > bins[k]) bins[k] = r;
        }
        // preenche setores vazios com a média dos vizinhos (2 passadas)
        for (let pass = 0; pass < 3; pass++) {
            for (let ip = 0; ip < NP; ip++) {
                for (let ia = 0; ia < NA; ia++) {
                    const k = ip * NA + ia;
                    if (bins[k] > 0) continue;
                    let acc = 0;
                    let cnt = 0;
                    for (const [da, dp] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                        const jp = ip + dp;
                        if (jp < 0 || jp >= NP) continue;
                        const v = bins[jp * NA + ((ia + da + NA) % NA)];
                        if (v > 0) {
                            acc += v;
                            cnt++;
                        }
                    }
                    if (cnt) bins[k] = acc / cnt;
                }
            }
        }
        const at = (ia, ip) => bins[Math.max(0, Math.min(NP - 1, ip)) * NA + ((ia % NA) + NA) % NA];
        /** raio na direção (azimute az: 0 = frente, +π/2 = +X; polar: 0 = para cima). */
        const radius = (az, polar) => {
            const fa = ((az + Math.PI) / (Math.PI * 2)) * NA - 0.5;
            const fp = (polar / Math.PI) * NP - 0.5;
            const ia = Math.floor(fa);
            const ip = Math.floor(fp);
            const ta = fa - ia;
            const tp = fp - ip;
            return (at(ia, ip) * (1 - ta) + at(ia + 1, ip) * ta) * (1 - tp) + (at(ia, ip + 1) * (1 - ta) + at(ia + 1, ip + 1) * ta) * tp;
        };
        /** ponto na casca (com folga) escrito em `out`. */
        const point = (out, az, polar, off = 0) => {
            const r = radius(az, polar) + off;
            const s = Math.sin(polar);
            return out.set(C[0] + Math.sin(az) * s * r, C[1] + Math.cos(polar) * r, C[2] + Math.cos(az) * s * r);
        };
        return { radius, point, center: C };
    }

    /** Centro e raio do membro a uma fração t entre o osso e o filho. */
    function limb(name, t = 0.5) {
        const a = J[name];
        const b = J[CHILD[name]];
        const c = new THREE.Vector3().lerpVectors(a, b, t);
        const axis = new THREE.Vector3().subVectors(b, a).normalize();
        const bi = index[name];
        const half = 0.012;
        let acc = 0;
        let cnt = 0;
        let max = 0;
        const v = new THREE.Vector3();
        for (let i = 0; i < n; i++) {
            if (dom[i] !== bi) continue;
            v.fromBufferAttribute(pos, i).sub(c);
            const along = v.dot(axis);
            if (Math.abs(along) > half) continue;
            const r = v.addScaledVector(axis, -along).length();
            acc += r;
            cnt++;
            if (r > max) max = r;
        }
        return { center: c, axis, radius: cnt ? (acc / cnt) * 0.5 + max * 0.5 : 0.045 };
    }

    A = {
        J,
        frontZ: (x, y) => sample(front, x, y, (v, o) => v > o, 0.1),
        backZ: (x, y) => sample(back, x, y, (v, o) => v < o, -0.1),
        shell,
        limb,
        chest: null,
        hips: null
    };
    // cascas mais usadas: tórax (centro 9 cm abaixo da base do pescoço) e bacia
    A.chest = shell([0, J.neck.y - 0.09, -0.005]);
    A.hips = shell([0, J.hips.y + 0.02, 0]);
    cache.set(geo, A);
    return A;
}

/** Prende `obj` ao osso, na posição de repouso `at` (Vector3 ou [x, y, z]) do referencial construído. */
export function mount(hero, A, bone, obj, at = null) {
    const j = A.J[bone];
    if (at) {
        if (Array.isArray(at)) obj.position.set(at[0] - j.x, at[1] - j.y, at[2] - j.z);
        else obj.position.copy(at).sub(j);
    } else obj.position.set(-j.x, -j.y, -j.z);
    hero.bones[bone].add(obj);
    return obj;
}
