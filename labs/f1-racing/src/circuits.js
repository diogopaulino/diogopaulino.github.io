/**
 * Circuit geometry engine.
 *
 * Circuits are authored as a "turtle path": a sequence of straights and arcs with
 * real-world radii, which is the way real tracks are surveyed. The walker integrates
 * the path, applies a traverse adjustment (heading first, then a compass-rule
 * translation) so the loop closes perfectly, then resamples everything at a uniform
 * arc-length spacing.
 *
 * From the centreline we derive curvature, elevation, banking, a relaxed racing line
 * and the speed profile the AI drives to. No three.js in here on purpose: the module
 * is pure data so it can be reasoned about (and tested) in isolation.
 */

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

/** Straight segment. */
const s = (length) => ({ kind: 'straight', length });
/** Arc segment. `deg` > 0 turns right, `deg` < 0 turns left. */
const t = (radius, deg, name) => ({ kind: 'arc', radius, deg, name });

export const CIRCUITS = {
    monza: {
        name: 'Autodromo Nazionale Monza',
        short: 'MONZA',
        location: 'Itália',
        flag: '🇮🇹',
        tagline: 'O Templo da Velocidade',
        blurb: 'Retas gigantescas, freadas de 350 para 80 km/h e a Parabolica sem fim.',
        laps: 4,
        width: 14.5,
        surface: 0x3a3d44,
        scenery: 'forest',
        sun: { elevation: 46, azimuth: 145 },
        gripBias: 1.0,
        segments: [
            s(640),
            t(26, 62, 'Variante del Rettifilo'), s(38), t(26, -60),
            s(180),
            t(300, 75, 'Curva Grande'),
            s(520),
            t(30, -55, 'Variante della Roggia'), s(42), t(32, 50),
            s(380),
            t(70, 85, 'Curva di Lesmo 1'),
            s(150),
            t(62, 60, 'Curva di Lesmo 2'),
            s(900),
            t(60, -50, 'Variante Ascari'), s(55), t(48, 85), s(45), t(65, -55),
            s(1150),
            t(105, 163, 'Curva Parabolica'),
            s(500)
        ],
        elevation: [[0, 0], [0.25, 3], [0.45, 6], [0.62, 4], [0.8, 1], [0.92, 0]],
        drs: [
            { detect: 0.885, start: 0.93, end: 0.085 },
            { detect: 0.40, start: 0.455, end: 0.575 }
        ]
    },

    spa: {
        name: 'Circuit de Spa-Francorchamps',
        short: 'SPA',
        location: 'Bélgica',
        flag: '🇧🇪',
        tagline: 'Eau Rouge, o teste de coragem',
        blurb: 'Sete quilômetros nas Ardenas, 100 metros de desnível e a subida mais famosa do mundo.',
        laps: 3,
        width: 13.5,
        surface: 0x35383f,
        scenery: 'forest',
        sun: { elevation: 33, azimuth: 210 },
        gripBias: 0.99,
        segments: [
            s(550),
            t(24, 150, 'La Source'),
            s(300),
            t(95, -45, 'Eau Rouge'), t(105, 65, 'Raidillon'), t(220, -35),
            s(1100),
            t(46, 85, 'Les Combes'), s(40), t(44, -75, 'Malmedy'),
            s(220),
            t(64, -45, 'Rivage'),
            s(180),
            t(28, 155, 'Bruxelles'),
            s(260),
            t(92, -105, 'Pouhon'),
            s(280),
            t(52, 70, 'Fagnes'), s(35), t(46, -65),
            s(260),
            t(72, 75, 'Campus'),
            t(88, 130, 'Stavelot'),
            s(1250),
            t(420, -25, 'Blanchimont'),
            s(850),
            t(24, 70, 'Bus Stop'), s(30), t(24, -45),
            s(220)
        ],
        elevation: [
            [0, 0], [0.04, 4], [0.08, -6], [0.13, 34], [0.2, 46], [0.3, 40],
            [0.42, 22], [0.52, 12], [0.62, 4], [0.72, 0], [0.84, 14], [0.94, 6]
        ],
        drs: [
            { detect: 0.075, start: 0.12, end: 0.245 },
            { detect: 0.86, start: 0.905, end: 0.985 }
        ]
    },

    silverstone: {
        name: 'Silverstone Circuit',
        short: 'SILVERSTONE',
        location: 'Reino Unido',
        flag: '🇬🇧',
        tagline: 'Maggotts-Becketts em quinta marcha',
        blurb: 'O berco da F1: curvas rapidas encadeadas onde o carro quase nunca fica reto.',
        laps: 3,
        width: 15,
        surface: 0x383b41,
        scenery: 'stadium',
        sun: { elevation: 28, azimuth: 190 },
        gripBias: 1.0,
        segments: [
            s(400),
            t(150, 55, 'Abbey'),
            s(200),
            t(120, 45, 'Farm Curve'),
            s(350),
            t(38, 75, 'Village'),
            s(90),
            t(30, -175, 'The Loop'),
            s(150),
            t(90, -35, 'Aintree'),
            s(700),
            t(45, 75, 'Brooklands'),
            s(60),
            t(55, 120, 'Luffield'),
            s(80),
            t(180, 25, 'Woodcote'),
            s(540),
            t(190, 65, 'Copse'),
            s(380),
            t(90, -45, 'Maggotts'),
            s(60),
            t(70, 75, 'Becketts'),
            s(60),
            t(65, -70),
            s(60),
            t(110, 35, 'Chapel'),
            s(720),
            t(95, 65, 'Stowe'),
            s(240),
            t(35, -60, 'Vale'),
            s(120),
            t(60, 110, 'Club'),
            s(330)
        ],
        elevation: [
            [0, 0], [0.12, 3], [0.26, 6], [0.4, 4], [0.55, 2], [0.7, 5], [0.85, 3], [0.94, 1]
        ],
        drs: [
            { detect: 0.955, start: 0.985, end: 0.075 },
            { detect: 0.24, start: 0.285, end: 0.395 },
            { detect: 0.65, start: 0.69, end: 0.79 }
        ]
    },

    interlagos: {
        name: 'Autódromo José Carlos Pace',
        short: 'INTERLAGOS',
        location: 'Brasil',
        flag: '🇧🇷',
        tagline: 'Anti-horário e sempre imprevisível',
        blurb: 'A descida do S do Senna, a Ferradura e a subida da Junção que decide corridas.',
        laps: 4,
        width: 13,
        surface: 0x383b42,
        scenery: 'stadium',
        sun: { elevation: 40, azimuth: 265 },
        gripBias: 1.01,
        segments: [
            s(420),
            t(42, -64, 'S do Senna'), s(30), t(40, 68),
            s(230),
            t(150, -52, 'Curva do Sol'),
            s(800),
            t(62, -64, 'Descida do Lago'), s(40), t(58, 66),
            s(350),
            t(78, -84, 'Ferradura'),
            s(200),
            t(96, -42, 'Laranja'),
            s(230),
            t(36, -70, 'Pinheirinho'),
            s(200),
            t(44, 90, 'Bico de Pato'),
            t(52, -70),
            s(280),
            t(180, -30, 'Mergulho'),
            s(190),
            t(40, -70, 'Junção'),
            s(300),
            t(200, -24, 'Subida dos Boxes'),
            t(300, -14),
            s(380)
        ],
        elevation: [
            [0, 0], [0.06, -12], [0.14, -22], [0.26, -28], [0.38, -24],
            [0.5, -30], [0.62, -34], [0.74, -26], [0.86, -10], [0.94, -2]
        ],
        drs: [
            { detect: 0.905, start: 0.955, end: 0.075 },
            { detect: 0.185, start: 0.235, end: 0.345 }
        ]
    }
};

export const CIRCUIT_KEYS = Object.keys(CIRCUITS);

/* ------------------------------------------------------------------ *
 * Path walking + traverse adjustment
 * ------------------------------------------------------------------ */

/**
 * Walks the segment list, emitting dense samples. Heading 0 points along +Z;
 * positive turns increase the heading (clockwise seen from above).
 */
function walk(segments, step = 3) {
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
                // Rotate half a step, advance, rotate the other half: keeps the
                // polyline centred on the true arc instead of chording inside it.
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

/**
 * Traverse adjustment. First the heading error is bled off proportionally to
 * distance travelled (so the loop's tangents match at start/finish), then the
 * residual position gap is closed with the surveyor's compass rule.
 */
function closeLoop(walked) {
    const { pts, length, totalTurn } = walked;
    const turns = Math.round(totalTurn / TAU) || (totalTurn >= 0 ? 1 : -1);
    const headingError = totalTurn - turns * TAU;

    // Re-integrate with corrected headings.
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

    // Compass rule for the leftover translation gap.
    const gapX = fixed[fixed.length - 1].x;
    const gapZ = fixed[fixed.length - 1].z;
    for (const p of fixed) {
        const f = p.dist / length;
        p.x -= gapX * f;
        p.z -= gapZ * f;
    }

    fixed.pop(); // last point duplicates the first
    return fixed;
}

/** Resamples a closed polyline at a uniform arc-length spacing. */
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

/* ------------------------------------------------------------------ *
 * Derived data
 * ------------------------------------------------------------------ */

/** Periodic Catmull-Rom through [normalisedS, value] keyframes. */
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

function wrapAngle(a) {
    while (a > Math.PI) a -= TAU;
    while (a < -Math.PI) a += TAU;
    return a;
}

/**
 * Relaxation that pulls the line towards minimum curvature inside the track
 * corridor — the classic "shortest smooth path" iteration. Produces a believable
 * racing line: wide entry, late apex, wide exit.
 */
function solveRacingLine(cx, cz, nx, nz, limit, iterations = 900) {
    const n = cx.length;
    const offsets = new Float64Array(n);
    const look = 5;

    for (let it = 0; it < iterations; it++) {
        const relax = it < iterations * 0.5 ? 0.28 : 0.12;
        for (let i = 0; i < n; i++) {
            const a = (i - look + n) % n;
            const b = (i + look) % n;
            const ax = cx[a] + nx[a] * offsets[a];
            const az = cz[a] + nz[a] * offsets[a];
            const bx = cx[b] + nx[b] * offsets[b];
            const bz = cz[b] + nz[b] * offsets[b];
            const midX = (ax + bx) * 0.5;
            const midZ = (az + bz) * 0.5;
            const desired = (midX - cx[i]) * nx[i] + (midZ - cz[i]) * nz[i];
            const lim = limit[i];
            const next = Math.max(-lim, Math.min(lim, desired));
            offsets[i] += (next - offsets[i]) * relax;
        }
    }
    return offsets;
}

/**
 * Downforce grows with the square of speed, so the grip available in a slow hairpin
 * is a fraction of what a fast sweeper has. `AERO_REFERENCE` is the speed at which
 * downforce equals the car's weight.
 */
export const AERO_REFERENCE = 2778;   // v² / this = downforce / weight

/** Forward/backward pass speed profile: cornering limit, then braking, then traction. */
function solveSpeedProfile(curvature, spacing, opts) {
    const n = curvature.length;
    const { mu = 1.62, accelG = 1.7, vMax = 92 } = opts;
    const g = 9.81;
    const v = new Float64Array(n);
    const aeroAt = (speed) => 1 + Math.min(3.2, (speed * speed) / AERO_REFERENCE);

    for (let i = 0; i < n; i++) {
        const k = Math.abs(curvature[i]);
        // Grip depends on speed and speed depends on grip: a few fixed-point steps
        // converge far faster than solving the quartic.
        let speed = vMax;
        for (let it = 0; it < 6; it++) {
            speed = k < 1e-5 ? vMax : Math.min(vMax, Math.sqrt((mu * aeroAt(speed) * g) / k));
        }
        v[i] = speed;
    }

    for (let pass = 0; pass < 3; pass++) {
        for (let i = n - 1; i >= 0; i--) {
            const next = v[(i + 1) % n];
            const decel = Math.min(mu * aeroAt(next) * g * 0.95, 58);
            v[i] = Math.min(v[i], Math.sqrt(next * next + 2 * decel * spacing));
        }
        for (let i = 0; i < n; i++) {
            const prev = v[(i - 1 + n) % n];
            const power = accelG * g * Math.max(0.3, 1 - prev / (vMax * 1.22));
            v[i] = Math.min(v[i], Math.sqrt(prev * prev + 2 * power * spacing));
        }
    }
    return v;
}

/* ------------------------------------------------------------------ *
 * Circuit object
 * ------------------------------------------------------------------ */

export class Circuit {
    constructor(key, def, data) {
        Object.assign(this, data);
        this.key = key;
        this.def = def;
        this.name = def.name;
        this.short = def.short;
        this.laps = def.laps;
        this.width = def.width;
        this.halfWidth = def.width / 2;
    }

    /** Sample index for a distance along the centreline. */
    indexAt(distance) {
        const n = this.count;
        const i = Math.floor((((distance % this.length) + this.length) % this.length) / this.spacing);
        return i % n;
    }

    /** Nearest centreline sample to a world position; `hint` makes it O(1) while driving. */
    nearest(x, z, hint = -1) {
        const n = this.count;
        if (hint >= 0) {
            const window = 40;
            let best = -1, bestDist = Infinity;
            for (let k = -window; k <= window; k++) {
                const i = (hint + k + n * 2) % n;
                const dx = x - this.cx[i];
                const dz = z - this.cz[i];
                const d = dx * dx + dz * dz;
                if (d < bestDist) { bestDist = d; best = i; }
            }
            if (bestDist < (window * this.spacing) ** 2 * 0.35) return best;
        }

        // Grid-accelerated global search.
        const gx = Math.floor((x - this.minX) / this.cell);
        const gz = Math.floor((z - this.minZ) / this.cell);
        let best = 0, bestDist = Infinity;
        for (let r = 0; r < 6; r++) {
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

    /**
     * Frenet-ish frame for a world position: distance along the lap, signed lateral
     * offset from the centreline, surface height and slope.
     */
    locate(x, z, hint = -1) {
        const i = this.nearest(x, z, hint);
        const n = this.count;
        const j = (i + 1) % n;
        const tx = this.tx[i], tz = this.tz[i];
        const dx = x - this.cx[i];
        const dz = z - this.cz[i];
        const along = dx * tx + dz * tz;
        const lateral = dx * this.nx[i] + dz * this.nz[i];
        const distance = (this.s[i] + along + this.length) % this.length;
        return { index: i, next: j, distance, lateral, progress: distance / this.length };
    }

    /** Ground height under a point, including banking. */
    heightAt(index, lateral) {
        return this.y[index] + lateral * Math.tan(this.bank[index]);
    }

    /** 0 asphalt · 1 kerb · 2 paved run-off · 3 gravel trap · 4 grass and beyond. */
    surfaceAt(lateral, index) {
        const half = this.halfWidth * this.widthScale[index];
        const abs = Math.abs(lateral);
        if (abs <= half) return 0;
        if (abs <= half + 1.6) return 1;
        if (abs <= half + 6.5) return 2;
        if (abs <= half + 13.5) return 3;
        return 4;
    }

    cornerAt(distance) {
        let best = null;
        for (const c of this.corners) {
            const delta = ((distance - c.dist) + this.length) % this.length;
            if (delta < 120 || delta > this.length - 60) {
                if (!best) best = c;
            }
        }
        return best;
    }

    /** DRS zone containing this progress value, if any. */
    drsZoneAt(progress) {
        for (const zone of this.drs) {
            if (zone.start < zone.end) {
                if (progress >= zone.start && progress <= zone.end) return zone;
            } else if (progress >= zone.start || progress <= zone.end) return zone;
        }
        return null;
    }
}

/** Builds (and caches) the full geometry for a circuit key. */
const cache = new Map();

export function buildCircuit(key, { spacing = 4, fresh = false } = {}) {
    if (!fresh && cache.has(key)) return cache.get(key);

    const def = CIRCUITS[key] || CIRCUITS.monza;
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

    // Tangents / normals (normal points to the driver's right).
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

    // Signed curvature, smoothed to remove resampling noise.
    const rawCurv = new Float64Array(n);
    for (let i = 0; i < n; i++) {
        const b = (i + 1) % n;
        rawCurv[i] = wrapAngle(heading[b] - heading[i]) / realSpacing;
    }
    const curvature = smoothCircular(rawCurv, 3);

    // Elevation + banking.
    const y = new Float64Array(n);
    const slope = new Float64Array(n);
    const elevationKeys = (def.elevation || [[0, 0]]).slice().sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < n; i++) y[i] = periodicSpline(elevationKeys, sArr[i] / length);
    const smoothY = smoothCircular(y, 6);
    for (let i = 0; i < n; i++) y[i] = smoothY[i];
    for (let i = 0; i < n; i++) {
        const b = (i + 1) % n;
        const a = (i - 1 + n) % n;
        slope[i] = (y[b] - y[a]) / (realSpacing * 2);
    }

    const bank = new Float64Array(n);
    for (let i = 0; i < n; i++) bank[i] = Math.max(-0.075, Math.min(0.075, curvature[i] * 3.2));

    // Slightly wider on fast sections, tighter through the twisty bits.
    const widthScale = new Float64Array(n);
    for (let i = 0; i < n; i++) {
        const k = Math.abs(curvature[i]);
        widthScale[i] = 1 + Math.max(-0.12, Math.min(0.1, 0.06 - k * 6));
    }

    // Racing line + AI speed profile.
    const limit = new Float64Array(n);
    for (let i = 0; i < n; i++) limit[i] = (def.width / 2) * widthScale[i] - 1.5;
    const offsets = solveRacingLine(cx, cz, nx, nz, limit);
    const lineX = new Float64Array(n);
    const lineZ = new Float64Array(n);
    for (let i = 0; i < n; i++) {
        lineX[i] = cx[i] + nx[i] * offsets[i];
        lineZ[i] = cz[i] + nz[i] * offsets[i];
    }
    // Curvature of the racing line, measured over a single step so tight chicanes are
    // not smoothed into straights — the AI brakes off this number.
    const lineCurv = new Float64Array(n);
    for (let i = 0; i < n; i++) {
        const a = (i - 1 + n) % n;
        const b = (i + 1) % n;
        const h1 = Math.atan2(lineX[i] - lineX[a], lineZ[i] - lineZ[a]);
        const h2 = Math.atan2(lineX[b] - lineX[i], lineZ[b] - lineZ[i]);
        const step = Math.hypot(lineX[b] - lineX[a], lineZ[b] - lineZ[a]) * 0.5 || realSpacing;
        lineCurv[i] = wrapAngle(h2 - h1) / step;
    }
    const smoothLineCurv = smoothCircular(lineCurv, 2);

    // Never let the line profile promise more than the track itself allows.
    const centreLimited = new Float64Array(n);
    for (let i = 0; i < n; i++) {
        centreLimited[i] = Math.max(Math.abs(smoothLineCurv[i]), Math.abs(curvature[i]) * 0.72);
    }
    const speedProfile = solveSpeedProfile(centreLimited, realSpacing, {
        mu: 1.62 * (def.gripBias || 1),
        vMax: 93
    });

    // Bounds + spatial grid for global nearest-point queries.
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < n; i++) {
        minX = Math.min(minX, cx[i]); maxX = Math.max(maxX, cx[i]);
        minZ = Math.min(minZ, cz[i]); maxZ = Math.max(maxZ, cz[i]);
    }
    const cell = 40;
    const gridW = Math.ceil((maxX - minX) / cell) + 4;
    const grid = new Map();
    for (let i = 0; i < n; i++) {
        const gx = Math.floor((cx[i] - minX) / cell);
        const gz = Math.floor((cz[i] - minZ) / cell);
        const key2 = gz * gridW + gx;
        let bucket = grid.get(key2);
        if (!bucket) grid.set(key2, (bucket = []));
        bucket.push(i);
    }

    const corners = walked.corners.map((c) => ({
        ...c,
        dist: (c.dist / walked.length) * length,
        index: Math.floor(((c.dist / walked.length) * length) / realSpacing) % n
    }));

    const circuit = new Circuit(key, def, {
        count: n,
        length,
        spacing: realSpacing,
        cx, cz, s: sArr, tx, tz, nx, nz, heading, curvature,
        y, slope, bank, widthScale,
        lineOffset: offsets, lineX, lineZ, lineCurvature: smoothLineCurv, speedProfile,
        corners,
        drs: def.drs || [],
        minX, maxX, minZ, maxZ, cell, gridW, grid
    });

    cache.set(key, circuit);
    return circuit;
}
