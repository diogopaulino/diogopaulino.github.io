/* Claude Bros — "escultura" procedural: malhas orgânicas a partir de campos de distância.
 *
 * Em vez de montar personagens com esferas e cápsulas soltas, cada personagem é
 * descrito por primitivas de distância (elipsoides, cápsulas cônicas, toros) que
 * são FUNDIDAS com união suave e depois poligonizadas numa malha única e lisa —
 * o mesmo princípio das metaballs do Blender.
 *
 *   união suave (polinomial, Quilez):
 *     h = max(k − |d1 − d2|, 0) / k        smin = min(d1, d2) − h²·k/4
 *   poligonização: surface nets ingênuo — um vértice por célula cortada pela
 *     superfície (média dos cruzamentos de aresta) e um quad por aresta da grade
 *     com troca de sinal. Gera malha indexada, bem distribuída e sem tabelas.
 *   normais: gradiente do campo por diferenças centrais (sombreamento contínuo).
 *   cor e pele: cada primitiva carrega cor e osso; o vértice mistura as
 *     primitivas próximas com peso  w_i = exp(−(d_i − d_min) / s)
 *     (s pequeno para cor, maior para pesos de pele → juntas dobram macias).
 */
import * as THREE from 'three';

const _c = new THREE.Color();

export function createSculpt() {
    const prims = [];
    const paints = [];
    let displace = null;

    const base = (o) => ({ bone: o.bone ?? 0, color: new THREE.Color(o.color ?? 0xffffff), k: o.k ?? 0.04, d: 0 });

    const api = {
        /** Elipsoide (distância aproximada, boa para anisotropia moderada). */
        ellipsoid(c, r, o = {}) {
            prims.push({ ...base(o), type: 0, c, r, m: Math.min(r[0], r[1], r[2]) });
            return api;
        },
        /** Cápsula cônica de `a` (raio ra) até `b` (raio rb). */
        capsule(a, b, ra, rb, o = {}) {
            const ba = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
            prims.push({ ...base(o), type: 1, a, ba, bb: ba[0] * ba[0] + ba[1] * ba[1] + ba[2] * ba[2] || 1e-6, ra, rb });
            return api;
        },
        /** Toro no plano XZ (eixo Y), achatável em Y com `sy`. */
        torus(c, R, r, o = {}) {
            prims.push({ ...base(o), type: 2, c, R, r, sy: o.sy ?? 1 });
            return api;
        },
        /** Região de pintura: não altera a forma, só tinge a superfície dentro do elipsoide. */
        paint(c, r, color, soft = 0.25) {
            paints.push({ c, r, color: new THREE.Color(color), soft });
            return api;
        },
        /** Perturbação somada à distância final: fn(x, y, z) → metros. */
        displace(fn) {
            displace = fn;
            return api;
        },
        build
    };

    function primDist(p, x, y, z) {
        if (p.type === 0) {
            const qx = (x - p.c[0]) / p.r[0];
            const qy = (y - p.c[1]) / p.r[1];
            const qz = (z - p.c[2]) / p.r[2];
            return (Math.sqrt(qx * qx + qy * qy + qz * qz) - 1) * p.m;
        }
        if (p.type === 1) {
            const px = x - p.a[0];
            const py = y - p.a[1];
            const pz = z - p.a[2];
            let h = (px * p.ba[0] + py * p.ba[1] + pz * p.ba[2]) / p.bb;
            h = h < 0 ? 0 : h > 1 ? 1 : h;
            const dx = px - p.ba[0] * h;
            const dy = py - p.ba[1] * h;
            const dz = pz - p.ba[2] * h;
            return Math.sqrt(dx * dx + dy * dy + dz * dz) - (p.ra + (p.rb - p.ra) * h);
        }
        const dx = x - p.c[0];
        const dy = (y - p.c[1]) / p.sy;
        const dz = z - p.c[2];
        const q = Math.sqrt(dx * dx + dz * dz) - p.R;
        return Math.sqrt(q * q + dy * dy) - p.r;
    }

    function field(x, y, z) {
        let d = 1e9;
        for (let i = 0; i < prims.length; i++) {
            const p = prims[i];
            const di = primDist(p, x, y, z);
            p.d = di;
            if (i === 0) { d = di; continue; }
            const h = Math.max(p.k - Math.abs(d - di), 0) / p.k;
            d = Math.min(d, di) - h * h * p.k * 0.25;
        }
        return displace ? d + displace(x, y, z) : d;
    }

    /**
     * @param {object} o
     * @param {number} o.cell      tamanho da célula (m) — menor = malha mais densa
     * @param {number} [o.bones]   se > 0, gera skinIndex/skinWeight
     * @param {number} [o.skinSoft] largura da mistura de pesos de pele (m)
     */
    function build({ cell = 0.02, bones = 0, skinSoft = 0.03, colorSoft = 0.012 } = {}) {
        // caixa envolvente das primitivas
        const lo = [1e9, 1e9, 1e9];
        const hi = [-1e9, -1e9, -1e9];
        const grow = (x, y, z, r) => {
            lo[0] = Math.min(lo[0], x - r); lo[1] = Math.min(lo[1], y - r); lo[2] = Math.min(lo[2], z - r);
            hi[0] = Math.max(hi[0], x + r); hi[1] = Math.max(hi[1], y + r); hi[2] = Math.max(hi[2], z + r);
        };
        for (const p of prims) {
            if (p.type === 0) grow(p.c[0], p.c[1], p.c[2], Math.max(p.r[0], p.r[1], p.r[2]));
            else if (p.type === 1) {
                grow(p.a[0], p.a[1], p.a[2], p.ra);
                grow(p.a[0] + p.ba[0], p.a[1] + p.ba[1], p.a[2] + p.ba[2], p.rb);
            } else grow(p.c[0], p.c[1], p.c[2], p.R + p.r);
        }
        const pad = cell * 3 + 0.03;
        const nx = Math.ceil((hi[0] - lo[0] + pad * 2) / cell) + 1;
        const ny = Math.ceil((hi[1] - lo[1] + pad * 2) / cell) + 1;
        const nz = Math.ceil((hi[2] - lo[2] + pad * 2) / cell) + 1;
        const ox = lo[0] - pad;
        const oy = lo[1] - pad;
        const oz = lo[2] - pad;
        const sxy = nx * ny;
        const val = new Float32Array(sxy * nz);
        for (let k = 0; k < nz; k++) {
            for (let j = 0; j < ny; j++) {
                for (let i = 0; i < nx; i++) val[i + j * nx + k * sxy] = field(ox + i * cell, oy + j * cell, oz + k * cell);
            }
        }

        // 1) um vértice por célula cortada
        const cellVert = new Int32Array(sxy * nz).fill(-1);
        const pos = [];
        const corner = [0, 1, nx, nx + 1, sxy, sxy + 1, sxy + nx, sxy + nx + 1];
        const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
        for (let k = 0; k < nz - 1; k++) {
            for (let j = 0; j < ny - 1; j++) {
                for (let i = 0; i < nx - 1; i++) {
                    const b = i + j * nx + k * sxy;
                    let mask = 0;
                    for (let c = 0; c < 8; c++) if (val[b + corner[c]] < 0) mask |= 1 << c;
                    if (mask === 0 || mask === 255) continue;
                    let sx = 0, sy = 0, sz = 0, n = 0;
                    for (const [a, c] of edges) {
                        const va = val[b + corner[a]];
                        const vc = val[b + corner[c]];
                        if ((va < 0) === (vc < 0)) continue;
                        const t = va / (va - vc);
                        const ax = a & 1, ay = (a >> 1) & 1, az = (a >> 2) & 1;
                        const cx = c & 1, cy = (c >> 1) & 1, cz = (c >> 2) & 1;
                        sx += ax + (cx - ax) * t;
                        sy += ay + (cy - ay) * t;
                        sz += az + (cz - az) * t;
                        n++;
                    }
                    cellVert[b] = pos.length / 3;
                    pos.push(ox + (i + sx / n) * cell, oy + (j + sy / n) * cell, oz + (k + sz / n) * cell);
                }
            }
        }

        // 2) um quad por aresta da grade com troca de sinal
        const index = [];
        const quad = (a, b, c, d, flip) => {
            if (a < 0 || b < 0 || c < 0 || d < 0) return;
            if (flip) index.push(a, c, b, a, d, c);
            else index.push(a, b, c, a, c, d);
        };
        for (let k = 1; k < nz - 1; k++) {
            for (let j = 1; j < ny - 1; j++) {
                for (let i = 1; i < nx - 1; i++) {
                    const b = i + j * nx + k * sxy;
                    const v = val[b] < 0;
                    if (v !== (val[b + 1] < 0)) quad(cellVert[b - nx - sxy], cellVert[b - sxy], cellVert[b], cellVert[b - nx], !v);
                    if (v !== (val[b + nx] < 0)) quad(cellVert[b - 1 - sxy], cellVert[b - 1], cellVert[b], cellVert[b - sxy], !v);
                    if (v !== (val[b + sxy] < 0)) quad(cellVert[b - 1 - nx], cellVert[b - nx], cellVert[b], cellVert[b - 1], !v);
                }
            }
        }

        // 3) atributos por vértice
        const count = pos.length / 3;
        const normal = new Float32Array(count * 3);
        const color = new Float32Array(count * 3);
        const skinIndex = bones ? new Uint16Array(count * 4) : null;
        const skinWeight = bones ? new Float32Array(count * 4) : null;
        const acc = new Float32Array(Math.max(1, bones));
        const e = cell * 0.5;
        for (let v = 0; v < count; v++) {
            const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
            let gx = field(x + e, y, z) - field(x - e, y, z);
            let gy = field(x, y + e, z) - field(x, y - e, z);
            let gz = field(x, y, z + e) - field(x, y, z - e);
            const gl = Math.hypot(gx, gy, gz) || 1;
            normal[v * 3] = gx / gl;
            normal[v * 3 + 1] = gy / gl;
            normal[v * 3 + 2] = gz / gl;

            field(x, y, z); // deixa p.d atualizado para esta posição
            let dmin = 1e9;
            for (const p of prims) dmin = Math.min(dmin, p.d);
            let r = 0, g = 0, bl = 0, wsum = 0;
            acc.fill(0);
            for (const p of prims) {
                const wc = Math.exp(-(p.d - dmin) / colorSoft);
                r += p.color.r * wc; g += p.color.g * wc; bl += p.color.b * wc; wsum += wc;
                if (bones) acc[p.bone] += Math.exp(-(p.d - dmin) / skinSoft);
            }
            _c.setRGB(r / wsum, g / wsum, bl / wsum);
            for (const pt of paints) {
                const qx = (x - pt.c[0]) / pt.r[0];
                const qy = (y - pt.c[1]) / pt.r[1];
                const qz = (z - pt.c[2]) / pt.r[2];
                const q = Math.sqrt(qx * qx + qy * qy + qz * qz);
                const t = Math.min(1, Math.max(0, (1 - q) / pt.soft));
                if (t > 0) _c.lerp(pt.color, t * t * (3 - 2 * t));
            }
            color[v * 3] = _c.r;
            color[v * 3 + 1] = _c.g;
            color[v * 3 + 2] = _c.b;

            if (bones) {
                let total = 0;
                for (let s = 0; s < 4; s++) {
                    let best = -1, bw = 0;
                    for (let bi = 0; bi < bones; bi++) if (acc[bi] > bw) { bw = acc[bi]; best = bi; }
                    if (best < 0) break;
                    skinIndex[v * 4 + s] = best;
                    skinWeight[v * 4 + s] = bw;
                    total += bw;
                    acc[best] = 0;
                }
                for (let s = 0; s < 4; s++) skinWeight[v * 4 + s] /= total || 1;
            }
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geo.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(color, 3));
        if (bones) {
            geo.setAttribute('skinIndex', new THREE.BufferAttribute(skinIndex, 4));
            geo.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeight, 4));
        }
        geo.setIndex(count > 65535 ? new THREE.Uint32BufferAttribute(index, 1) : new THREE.Uint16BufferAttribute(index, 1));
        geo.computeBoundingBox();
        geo.computeBoundingSphere();
        return geo;
    }

    return api;
}

/** Ruído suave 3D barato (soma de senos defasados) para relevo de rocha em campos de distância. */
export function lumps(x, y, z, f = 1) {
    return Math.sin(x * 13.1 * f + 1.3) * Math.sin(y * 11.7 * f + 0.7) * Math.sin(z * 12.3 * f + 2.1)
        + 0.5 * Math.sin(x * 27.3 * f + z * 9.1 * f) * Math.sin(y * 23.9 * f - x * 7.7 * f + 1.9);
}
