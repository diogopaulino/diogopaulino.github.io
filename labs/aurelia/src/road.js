/**
 * Costa Aurélia — loop costeiro fechado, estilo estrada de festival.
 *
 * Autoria em "turtle path" (retas + arcos). O loop é fechado com correção de
 * heading e regra da bússola, depois reamostrado em espaçamento uniforme.
 */

import { TAU, DEG, clamp, wrapAngle } from './utils.js';

const s = (length) => ({ kind: 'straight', length });
const t = (radius, deg, name) => ({ kind: 'arc', radius, deg, name });

/** Percurso cénico: festival → descida → praia → farol → túnel → serra → vinhedo. */
export const ROUTE = {
    name: 'Costa Aurélia',
    short: 'AURÉLIA',
    location: 'Festival Horizon',
    tagline: 'Do palco à falésia, sem sair da hora dourada',
    width: 10.4,
    surface: 0x3a3c42,
    segments: [
        s(340),
        t(62, 68, 'Praça do Festival'),
        s(90),
        t(36, -102, 'Descida da Costa'),
        s(160),
        t(210, -48, 'Varanda do Mar'),
        s(520),
        t(95, -38, 'Praia do Speed Trap'),
        s(80),
        t(26, 118, 'Hairpin do Farol'),
        s(70),
        t(170, 32, 'Falésia'),
        s(210),
        t(44, -82, 'Boca do Túnel'),
        s(140),
        t(50, 78, 'Saída do Túnel'),
        s(110),
        t(68, -46, 'Vinhedo 1'),
        s(150),
        t(40, 92, 'Serra'),
        s(100),
        t(38, -78, 'S da Serra'),
        s(90),
        t(46, 88, 'Mirante'),
        s(220),
        t(160, 42, 'Retorno'),
        s(260)
    ],
    elevation: [
        [0.00, 26],
        [0.08, 22],
        [0.16, 12],
        [0.24, 6],
        [0.32, 5],
        [0.40, 8],
        [0.48, 14],
        [0.56, 22],
        [0.64, 48],
        [0.72, 58],
        [0.80, 42],
        [0.88, 32],
        [0.96, 27]
    ],
    tunnels: [
        { start: 0.48, end: 0.545 }
    ]
};

function walk(segments, step = 3.2) {
    const pts = [];
    const corners = [];
    let x = 0, z = 0, heading = 0, dist = 0;
    pts.push({ x, z, heading, dist });

    for (const seg of segments) {
        if (seg.kind === 'straight') {
            const n = Math.max(1, Math.round(seg.length / step));
            const ds = seg.length / n;
            for (let i = 0; i < n; i++) {
                x += Math.sin(heading) * ds;
                z += Math.cos(heading) * ds;
                dist += ds;
                pts.push({ x, z, heading, dist });
            }
        } else {
            const total = seg.deg * DEG;
            const arcLen = Math.abs(total) * seg.radius;
            const n = Math.max(2, Math.round(arcLen / step));
            const dTheta = total / n;
            const ds = arcLen / n;
            if (seg.name) corners.push({ dist, name: seg.name, radius: seg.radius });
            for (let i = 0; i < n; i++) {
                heading += dTheta * 0.5;
                x += Math.sin(heading) * ds;
                z += Math.cos(heading) * ds;
                heading += dTheta * 0.5;
                dist += ds;
                pts.push({ x, z, heading, dist });
            }
        }
    }
    return { pts, corners, length: dist, totalTurn: heading };
}

function closeLoop(walked) {
    const { pts, length, totalTurn } = walked;
    const turns = Math.round(totalTurn / TAU) || (totalTurn >= 0 ? 1 : -1);
    const headingError = totalTurn - turns * TAU;

    let x = 0, z = 0;
    const fixed = [{ x: 0, z: 0, heading: 0, dist: 0 }];
    for (let i = 1; i < pts.length; i++) {
        const ds = pts[i].dist - pts[i - 1].dist;
        const mid = (pts[i].dist + pts[i - 1].dist) * 0.5;
        const raw = (pts[i].heading + pts[i - 1].heading) * 0.5;
        const heading = raw - headingError * (mid / length);
        x += Math.sin(heading) * ds;
        z += Math.cos(heading) * ds;
        fixed.push({ x, z, heading, dist: pts[i].dist });
    }

    const gapX = fixed[fixed.length - 1].x;
    const gapZ = fixed[fixed.length - 1].z;
    for (const p of fixed) {
        const f = p.dist / length;
        p.x -= gapX * f;
        p.z -= gapZ * f;
    }
    fixed.pop();
    return fixed;
}

function resample(points, spacing) {
    const n = points.length;
    const cum = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) {
        const a = points[i];
        const b = points[(i + 1) % n];
        cum[i + 1] = cum[i] + Math.hypot(b.x - a.x, b.z - a.z);
    }
    const total = cum[n];
    const count = Math.max(64, Math.round(total / spacing));
    const step = total / count;
    const out = [];
    let seg = 0;
    for (let i = 0; i < count; i++) {
        const target = i * step;
        while (seg < n - 1 && cum[seg + 1] < target) seg++;
        const spanStart = cum[seg];
        const spanLen = cum[seg + 1] - spanStart || 1;
        const f = (target - spanStart) / spanLen;
        const a = points[seg];
        const b = points[(seg + 1) % n];
        out.push({ x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f, s: target });
    }
    return { points: out, length: total, spacing: step };
}

function periodicSpline(keys, u) {
    const n = keys.length;
    const wrapped = ((u % 1) + 1) % 1;
    let i = 0;
    while (i < n && keys[i][0] <= wrapped) i++;
    const i1 = (i - 1 + n) % n;
    const i2 = i % n;
    const i0 = (i1 - 1 + n) % n;
    const i3 = (i2 + 1) % n;
    let span = keys[i2][0] - keys[i1][0];
    if (span <= 0) span += 1;
    let local = wrapped - keys[i1][0];
    if (local < 0) local += 1;
    const f = span === 0 ? 0 : local / span;
    const p0 = keys[i0][1], p1 = keys[i1][1], p2 = keys[i2][1], p3 = keys[i3][1];
    const f2 = f * f, f3 = f2 * f;
    return 0.5 * ((2 * p1) + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f2 + (-p0 + 3 * p1 - 3 * p2 + p3) * f3);
}

function smoothCircular(values, radius) {
    const n = values.length;
    const out = new Float64Array(n);
    const span = radius * 2 + 1;
    for (let i = 0; i < n; i++) {
        let sum = 0;
        for (let k = -radius; k <= radius; k++) sum += values[(i + k + n * 2) % n];
        out[i] = sum / span;
    }
    return out;
}

export class Road {
    constructor(data) {
        Object.assign(this, data);
        this.halfWidth = this.width / 2;
    }

    indexAt(distance) {
        const n = this.count;
        const i = Math.floor((((distance % this.length) + this.length) % this.length) / this.spacing);
        return i % n;
    }

    nearest(x, z, hint = -1) {
        const n = this.count;
        if (hint >= 0) {
            const window = 48;
            let best = -1, bestDist = Infinity;
            for (let k = -window; k <= window; k++) {
                const i = (hint + k + n * 2) % n;
                const dx = x - this.cx[i];
                const dz = z - this.cz[i];
                const d = dx * dx + dz * dz;
                if (d < bestDist) { bestDist = d; best = i; }
            }
            if (bestDist < (window * this.spacing) ** 2 * 0.4) return best;
        }
        const gx = Math.floor((x - this.minX) / this.cell);
        const gz = Math.floor((z - this.minZ) / this.cell);
        let best = 0, bestDist = Infinity;
        for (let r = 0; r < 7; r++) {
            for (let ox = -r; ox <= r; ox++) {
                for (let oz = -r; oz <= r; oz++) {
                    if (r > 0 && Math.abs(ox) !== r && Math.abs(oz) !== r) continue;
                    const bucket = this.grid.get((gz + oz) * this.gridW + (gx + ox));
                    if (!bucket) continue;
                    for (const i of bucket) {
                        const dx = x - this.cx[i];
                        const dz = z - this.cz[i];
                        const d = dx * dx + dz * dz;
                        if (d < bestDist) { bestDist = d; best = i; }
                    }
                }
            }
            if (bestDist < Infinity && r >= 1) break;
        }
        return best;
    }

    locate(x, z, hint = -1) {
        const i = this.nearest(x, z, hint);
        const tx = this.tx[i], tz = this.tz[i];
        const dx = x - this.cx[i];
        const dz = z - this.cz[i];
        const along = dx * tx + dz * tz;
        const lateral = dx * this.nx[i] + dz * this.nz[i];
        const distance = (this.s[i] + along + this.length) % this.length;
        return { index: i, distance, lateral, progress: distance / this.length };
    }

    heightAt(index, lateral = 0) {
        return this.y[index] + lateral * Math.tan(this.bank[index]);
    }

    /** 0 asfalto · 1 acostamento · 2 terra · 3 grama. */
    surfaceAt(lateral) {
        const abs = Math.abs(lateral);
        const half = this.halfWidth;
        if (abs <= half) return 0;
        if (abs <= half + 2.4) return 1;
        if (abs <= half + 8) return 2;
        return 3;
    }

    inTunnel(progress) {
        for (const t of this.tunnels) {
            if (progress >= t.start && progress <= t.end) return true;
        }
        return false;
    }

    sample(distance) {
        const i = this.indexAt(distance);
        return {
            x: this.cx[i],
            y: this.y[i],
            z: this.cz[i],
            heading: this.heading[i],
            nx: this.nx[i],
            nz: this.nz[i],
            index: i
        };
    }
}

export function buildRoad({ spacing = 3.6 } = {}) {
    const def = ROUTE;
    const walked = walk(def.segments);
    const closed = closeLoop(walked);
    const { points, length, spacing: realSpacing } = resample(closed, spacing);
    const n = points.length;

    const cx = new Float64Array(n);
    const cz = new Float64Array(n);
    const sArr = new Float64Array(n);
    for (let i = 0; i < n; i++) {
        cx[i] = points[i].x;
        cz[i] = points[i].z;
        sArr[i] = points[i].s;
    }

    const tx = new Float64Array(n);
    const tz = new Float64Array(n);
    const nx = new Float64Array(n);
    const nz = new Float64Array(n);
    const heading = new Float64Array(n);
    for (let i = 0; i < n; i++) {
        const a = (i - 1 + n) % n;
        const b = (i + 1) % n;
        let dx = cx[b] - cx[a];
        let dz = cz[b] - cz[a];
        const len = Math.hypot(dx, dz) || 1;
        dx /= len; dz /= len;
        tx[i] = dx; tz[i] = dz;
        nx[i] = dz; nz[i] = -dx;
        heading[i] = Math.atan2(dx, dz);
    }

    const curvature = new Float64Array(n);
    for (let i = 0; i < n; i++) {
        curvature[i] = wrapAngle(heading[(i + 1) % n] - heading[(i - 1 + n) % n]) / (2 * realSpacing);
    }
    const smoothK = smoothCircular(curvature, 4);

    const y = new Float64Array(n);
    for (let i = 0; i < n; i++) y[i] = periodicSpline(def.elevation, i / n);
    const ySmooth = smoothCircular(y, 8);

    const bank = new Float64Array(n);
    for (let i = 0; i < n; i++) {
        bank[i] = clamp(-smoothK[i] * 18, -0.18, 0.18);
    }
    const bankSmooth = smoothCircular(bank, 6);

    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    for (let i = 0; i < n; i++) {
        if (cx[i] < minX) minX = cx[i];
        if (cz[i] < minZ) minZ = cz[i];
        if (cx[i] > maxX) maxX = cx[i];
        if (cz[i] > maxZ) maxZ = cz[i];
    }

    const cell = 48;
    const gridW = Math.ceil((maxX - minX) / cell) + 2;
    const grid = new Map();
    for (let i = 0; i < n; i++) {
        const gx = Math.floor((cx[i] - minX) / cell);
        const gz = Math.floor((cz[i] - minZ) / cell);
        const key = gz * gridW + gx;
        let bucket = grid.get(key);
        if (!bucket) { bucket = []; grid.set(key, bucket); }
        bucket.push(i);
    }

    return new Road({
        def,
        name: def.name,
        short: def.short,
        width: def.width,
        tunnels: def.tunnels,
        corners: walked.corners,
        count: n,
        length,
        spacing: realSpacing,
        cx, cz, y: ySmooth, s: sArr,
        tx, tz, nx, nz, heading,
        curvature: smoothK,
        bank: bankSmooth,
        minX, minZ, maxX, maxZ, cell, grid, gridW
    });
}
