/**
 * Mecânica celeste do Orbis — tudo em unidades reais, sem THREE (testável no Node).
 *
 * Referencial: heliocêntrico, eclíptica e equinócio J2000.
 * Tempo: dias desde J2000.0 (JD 2451545.0 = 2000-01-01 12:00 TT).
 * Ignoramos ΔT = TT − UTC (~69 s), invisível nesta escala.
 *
 * Constantes:
 *   GM☉ = 1,32712440018e20 m³/s²   (parâmetro gravitacional do Sol, IAU/JPL DE)
 *   G   = 6,67430e-11 m³/(kg·s²)   (CODATA 2018)
 *   1 UA = 149 597 870 700 m       (IAU 2012, valor exato)
 *   ε   = 23,439281°               (obliquidade da eclíptica em J2000)
 *
 * Período (3ª lei de Kepler, problema de dois corpos):
 *   T = 2π √(a³ / μ),   μ = GM☉ + G·m   (m = massa do planeta; T² ∝ a³)
 * Movimento médio n = 2π / T. Longitude média L(t) = L₀ + n·t.
 * Anomalia média  M(t) = L(t) − ϖ(t)   (ϖ = Ω + ω, longitude do periélio)
 * Equação de Kepler  E − e·sen E = M, resolvida por Newton:
 *   E ← E − (E − e·sen E − M) / (1 − e·cos E)
 * Posição no plano da órbita (foco no Sol):
 *   x' = a (cos E − e),   y' = a √(1 − e²) · sen E,   r = a (1 − e·cos E)
 * Para a eclíptica: r⃗ = x'·P⃗ + y'·Q⃗, onde P⃗/Q⃗ vêm de R_z(Ω)·R_x(i)·R_z(ω):
 *   Px =  cosω cosΩ − senω senΩ cos i     Qx = −senω cosΩ − cosω senΩ cos i
 *   Py =  cosω senΩ + senω cosΩ cos i     Qy = −senω senΩ + cosω cosΩ cos i
 *   Pz =  senω sen i                      Qz =  cosω sen i
 * Velocidade orbital (vis-viva):  v = √(μ (2/r − 1/a)).
 */

export const AU = 149597870700;           // m
export const GM_SUN = 1.32712440018e20;   // m³/s²
export const G = 6.6743e-11;              // m³/(kg·s²)
export const DAY = 86400;                 // s
export const J2000_JD = 2451545.0;
export const UNIX_EPOCH_JD = 2440587.5;
export const OBLIQUITY_J2000 = 23.439281; // graus
export const LIGHT_SPEED = 299792458;     // m/s

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

/** ms Unix (UTC) → dias desde J2000. */
export function daysSinceJ2000(ms) {
    return ms / 86400000 + UNIX_EPOCH_JD - J2000_JD;
}

/** dias desde J2000 → ms Unix (para Date). */
export function msFromDays(days) {
    return (days + J2000_JD - UNIX_EPOCH_JD) * 86400000;
}

/** Ângulo em (−π, π]. */
export function wrapPi(x) {
    x %= TAU;
    if (x > Math.PI) x -= TAU;
    else if (x <= -Math.PI) x += TAU;
    return x;
}

/**
 * Resolve E − e·sen E = M (radianos) por Newton-Raphson.
 * Chute inicial de Danby: E₀ = M + 0,85·e·sinal(M), robusto para todo e < 1
 * (os planetas têm e ≤ 0,21). Converge quadraticamente: 3–5 iterações chegam
 * a 1e-12 rad. Sem alocação.
 */
export function solveKepler(M, e) {
    M = wrapPi(M);
    let E = M + 0.85 * e * (M >= 0 ? 1 : -1);
    for (let k = 0; k < 12; k++) {
        const f = E - e * Math.sin(E) - M;
        const dE = f / (1 - e * Math.cos(E));
        E -= dE;
        if (dE < 1e-12 && dE > -1e-12) break;
    }
    return E;
}

function setBasis(o, node, peri) {
    const w = peri - node;          // argumento do periélio ω = ϖ − Ω
    const cw = Math.cos(w), sw = Math.sin(w);
    const cO = Math.cos(node), sO = Math.sin(node);
    const ci = o.cosI, si = o.sinI;
    o.px = cw * cO - sw * sO * ci;
    o.py = cw * sO + sw * cO * ci;
    o.pz = sw * si;
    o.qx = -sw * cO - cw * sO * ci;
    o.qy = -sw * sO + cw * cO * ci;
    o.qz = cw * si;
}

/**
 * Pré-calcula uma órbita a partir de elementos keplerianos.
 * el: { a, e, i, node (Ω), peri (ϖ = Ω + ω), L (longitude média na época) } — ângulos em graus.
 *     Opcional: nodeRate, periRate (graus/dia) para precessão (usado na Lua),
 *     period (dias) para impor um período medido em vez de Kepler (luas).
 * opts: { unit: metros por unidade de a (UA por padrão), mu: m³/s² do corpo central + corpo }
 */
export function makeOrbit(el, opts = {}) {
    const unit = opts.unit ?? AU;
    const mu = opts.mu ?? GM_SUN;
    const aMeters = el.a * unit;
    // T = 2π √(a³/μ) em segundos → dias; luas usam o período sideral medido.
    const periodDays = el.period ?? (TAU * Math.sqrt((aMeters * aMeters * aMeters) / mu)) / DAY;
    const o = {
        a: el.a,
        e: el.e,
        b: el.a * Math.sqrt(1 - el.e * el.e),
        iDeg: el.i,
        cosI: Math.cos(el.i * DEG),
        sinI: Math.sin(el.i * DEG),
        node0: el.node * DEG,
        peri0: el.peri * DEG,
        L0: el.L * DEG,
        nodeRate: (el.nodeRate ?? 0) * DEG,
        periRate: (el.periRate ?? 0) * DEG,
        n: TAU / periodDays,       // rad/dia
        periodDays,
        mu,
        aMeters,
        px: 0, py: 0, pz: 0, qx: 0, qy: 0, qz: 0
    };
    setBasis(o, o.node0, o.peri0);
    return o;
}

/**
 * Posição no instante `d` (dias desde J2000), em unidades de `a`, no referencial
 * dos elementos (eclíptica J2000 para planetas). Escreve em `out` e o devolve.
 * out recebe: x, y, z, r, E, M, nu (anomalia verdadeira).
 */
export function orbitPosition(o, d, out) {
    let peri = o.peri0;
    if (o.nodeRate !== 0 || o.periRate !== 0) {
        peri = o.peri0 + o.periRate * d;
        setBasis(o, o.node0 + o.nodeRate * d, peri);
    }
    const M = wrapPi(o.L0 + o.n * d - peri);
    const E = solveKepler(M, o.e);
    const cE = Math.cos(E), sE = Math.sin(E);
    const xp = o.a * (cE - o.e);
    const yp = o.b * sE;
    out.x = xp * o.px + yp * o.qx;
    out.y = xp * o.py + yp * o.qy;
    out.z = xp * o.pz + yp * o.qz;
    out.r = o.a * (1 - o.e * cE);
    out.E = E;
    out.M = M;
    out.nu = Math.atan2(Math.sqrt(1 - o.e * o.e) * sE, cE - o.e);
    return out;
}

/** Velocidade orbital (m/s) pela vis-viva, dado r na unidade de `a`. */
export function orbitSpeed(o, r) {
    const rm = (r / o.a) * o.aMeters;
    return Math.sqrt(o.mu * (2 / rm - 1 / o.aMeters));
}

/** Ponto da elipse para o ângulo excêntrico E (desenho da órbita). */
export function orbitPointAtE(o, E, out) {
    const xp = o.a * (Math.cos(E) - o.e);
    const yp = o.b * Math.sin(E);
    out.x = xp * o.px + yp * o.qx;
    out.y = xp * o.py + yp * o.qy;
    out.z = xp * o.pz + yp * o.qz;
    return out;
}

/** Normal do plano orbital (eclíptica): h = (sen i sen Ω, −sen i cos Ω, cos i). */
export function orbitNormal(o, out) {
    out.x = o.sinI * Math.sin(o.node0);
    out.y = -o.sinI * Math.cos(o.node0);
    out.z = o.cosI;
    return out;
}

/**
 * Polo norte IAU (ascensão reta α₀, declinação δ₀, equatoriais J2000) → vetor
 * unitário na eclíptica J2000:
 *   x = cosδ cosα;  y = cosε·cosδ senα + senε·senδ;  z = −senε·cosδ senα + cosε·senδ
 */
export function poleToEcliptic(raDeg, decDeg, out) {
    const a = raDeg * DEG, dd = decDeg * DEG, eps = OBLIQUITY_J2000 * DEG;
    const xe = Math.cos(dd) * Math.cos(a);
    const ye = Math.cos(dd) * Math.sin(a);
    const ze = Math.sin(dd);
    out.x = xe;
    out.y = Math.cos(eps) * ye + Math.sin(eps) * ze;
    out.z = -Math.sin(eps) * ye + Math.cos(eps) * ze;
    return out;
}

/**
 * Nodo ascendente do equador do planeta sobre o equador terrestre (α₀ + 90°),
 * a origem do meridiano W da IAU, levado para a eclíptica.
 */
export function primeNodeToEcliptic(raDeg, out) {
    const a = (raDeg + 90) * DEG, eps = OBLIQUITY_J2000 * DEG;
    const xe = Math.cos(a), ye = Math.sin(a);
    out.x = xe;
    out.y = Math.cos(eps) * ye;
    out.z = -Math.sin(eps) * ye;
    return out;
}

/**
 * Inclinação axial (obliquidade) em graus = ângulo entre o eixo de rotação e a
 * normal da órbita. O polo "norte" da IAU fica do lado norte do plano invariável;
 * para rotação retrógrada (Ẇ < 0) o momento angular aponta para −polo, daí
 * Vênus = 177,4° e Urano = 97,8° (convenção da mão direita).
 */
export function axialTilt(pole, orbit, Wdot = 1) {
    const h = orbitNormal(orbit, { x: 0, y: 0, z: 0 });
    const c = (pole.x * h.x + pole.y * h.y + pole.z * h.z) * (Wdot < 0 ? -1 : 1);
    return Math.acos(Math.max(-1, Math.min(1, c))) / DEG;
}

/** Ângulo do meridiano principal (IAU): W = W₀ + Ẇ·d, em radianos. */
export function rotationAngle(W0deg, Wdot, d) {
    return wrapPi((W0deg + Wdot * d) * DEG);
}

/** Eclíptica (x, y, z) → cena THREE (Y para cima, destro): (x, z, −y). */
export function eclToScene(x, y, z, out) {
    out.x = x;
    out.y = z;
    out.z = -y;
    return out;
}
