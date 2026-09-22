/**
 * Anatomia procedural — fórmulas usadas pelos labs 3D.
 *
 * Membro (t = 0 na articulação proximal, t = 1 na distal):
 *   r(t) = lerp(r0, r1, t)
 *        + bulge * exp(-((t - bulgeAt)^2) / 0.018)
 *        - pinch * exp(-((t - 0.52)^2) / 0.004)
 *
 * Cabeça (nx, ny, nz normalizados, +Z = frente, +Y = cima):
 *   R_local = R * headRadiusMul(nx, ny, nz, estilo)
 *   estilo chibi: crânio maior, nariz curto, órbitas largas
 *   estilo child: meio-termo
 *   estilo human: arcada, mandíbula, ponte nasal e queixo
 */

export function gauss(x, mu, sigma) {
    const d = (x - mu) / Math.max(0.0001, sigma);
    return Math.exp(-d * d);
}

export function limbRadius(t, r0, r1, bulge = 0.02, bulgeAt = 0.35, pinch = 0.35) {
    const base = r0 + (r1 - r0) * t;
    const muscle = Math.exp(-((t - bulgeAt) ** 2) / 0.018) * bulge;
    const knee = Math.exp(-((t - 0.52) ** 2) / 0.004) * bulge * pinch;
    return Math.max(0.008, base + muscle - knee);
}

/**
 * Multiplicador do raio da cabeça. Mantém a costura da esfera
 * porque só depende da direção, não do índice do vértice.
 */
export function headRadiusMul(nx, ny, nz, style = 'human') {
    const chibi = style === 'chibi';
    const child = style === 'child' || chibi;
    const front = Math.max(0, nz) ** 1.15;
    const side = Math.abs(nx);
    let m = 1;

    const nose = gauss(nx, 0, chibi ? 0.12 : 0.085) * gauss(ny, chibi ? -0.02 : -0.06, chibi ? 0.14 : 0.1) * front;
    m += nose * (chibi ? 0.16 : child ? 0.22 : 0.3);

    const bridge = gauss(nx, 0, 0.04) * gauss(ny, 0.14, 0.1) * front;
    m += bridge * (chibi ? 0.05 : 0.12);

    const socket = (gauss(nx, -0.32, 0.1) + gauss(nx, 0.32, 0.1)) * gauss(ny, chibi ? 0.1 : 0.08, 0.085) * front;
    m -= socket * (chibi ? 0.18 : 0.22);

    const cheek = gauss(side, chibi ? 0.34 : 0.4, 0.15) * gauss(ny, -0.05, 0.16) * Math.max(0, nz);
    m += cheek * (chibi ? 0.07 : 0.045);

    const chin = gauss(nx, 0, 0.15) * gauss(ny, chibi ? -0.48 : -0.62, 0.11) * front;
    m += chin * (chibi ? 0.025 : child ? 0.045 : 0.075);

    if (!chibi) {
        const jaw = gauss(side, 0.45, 0.16) * gauss(ny, -0.4, 0.14) * Math.max(0, nz * 0.5 + 0.5);
        m += jaw * (child ? 0.03 : 0.055);
        const brow = gauss(side, 0.28, 0.18) * gauss(ny, 0.28, 0.07) * front;
        m += brow * 0.05;
    } else {
        m += Math.max(0, ny) * 0.09;
    }

    const mouth = gauss(nx, 0, 0.14) * gauss(ny, chibi ? -0.28 : -0.36, 0.045) * front;
    m -= mouth * 0.045;

    const canine = style === 'fox' || style === 'dog' || style === 'cat';
    if (canine) {
        const snout = gauss(nx, 0, style === 'cat' ? 0.28 : 0.2) * gauss(ny, style === 'fox' ? -0.02 : -0.08, 0.18) * front;
        m += snout * (style === 'fox' ? 0.62 : style === 'cat' ? 0.28 : 0.48);
        m += Math.max(0, ny) * 0.06 * Math.max(0, 0.4 - nz);
    }

    return Math.max(0.68, m);
}

export function torsoKeys(style) {
    if (style === 'chibi') {
        return [[0, 0.92], [0.2, 1], [0.5, 0.96], [0.78, 0.84], [1, 0.42]];
    }
    if (style === 'child') {
        return [[0, 0.95], [0.18, 0.9], [0.4, 0.72], [0.68, 0.88], [0.88, 0.7], [1, 0.4]];
    }
    return [[0, 1], [0.14, 0.96], [0.34, 0.7], [0.58, 0.86], [0.78, 1], [0.92, 0.74], [1, 0.42]];
}

export function sampleKeys(keys, t) {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
        if (t <= keys[i][0]) {
            const [t0, v0] = keys[i - 1];
            const [t1, v1] = keys[i];
            const u = (t - t0) / Math.max(0.0001, t1 - t0);
            const s = u * u * (3 - 2 * u);
            return v0 + (v1 - v0) * s;
        }
    }
    return keys[keys.length - 1][1];
}
