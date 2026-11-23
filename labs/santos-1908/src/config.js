/**
 * Santos, 1908 — configuração da cena e do filme.
 * Escala: 1 unidade = 1 metro.
 *
 * Eixos (research.md G04): o cais corre ao longo de Z e olha para −X.
 *   −X = nordeste (água do estuário, margem oposta, Serra do Mar)
 *   +X = sudoeste (armazéns, cidade, morros da ilha)
 *   +Z = noroeste (Valongo, fundo do estuário)   −Z = sudeste (barra, mar aberto)
 * O Kasato Maru vem de −Z e atraca com o bordo de bombordo no cais (x = 0), em z ≈ 0,
 * diante do armazém 14 (D06). Às 9h30 de 18/jun o sol está a NE, baixo (~27°),
 * iluminando de frente o cais e a cidade.
 */

export const FILM_DURATION = 180; // s — loop cinematográfico

/** Contagens por tier (o pós-processamento segue os tiers do kit gfx). */
export const QUALITY = {
    low: { id: 'low', pr: 1, shadows: false, shadowMap: 1024, passengers: 14, workers: 8, walkers: 6, carts: 2, gulls: 8, sacks: 220, cityRows: 3, trees: 14, smoke: 50 },
    medium: { id: 'medium', pr: 1.25, shadows: true, shadowMap: 2048, passengers: 26, workers: 14, walkers: 10, carts: 3, gulls: 14, sacks: 420, cityRows: 5, trees: 26, smoke: 80 },
    high: { id: 'high', pr: 1.5, shadows: true, shadowMap: 2048, passengers: 40, workers: 20, walkers: 14, carts: 4, gulls: 20, sacks: 640, cityRows: 6, trees: 40, smoke: 110 }
};

export const LAYOUT = {
    quayY: 2.3,            // cota do cais acima da maré
    quayZ0: -470,          // extremo SE do cais
    quayZ1: 420,           // extremo NW
    apron: 24,             // largura da faixa do cais (x 0 → 24)
    whX0: 24,              // armazéns: x 24 → 46
    whX1: 46,
    whLen: 62,
    whGap: 12,
    streetX: 55,           // eixo da rua de trás (trilho do Valongo)
    cityX: 66,             // primeira fachada da cidade
    farBank: -430,         // margem oposta (mangue)
    berthX: -8.6,          // linha de centro do Kasato atracado
    valongoZ: 300,
    kasatoLength: 123.4,   // K02
    kasatoBeam: 15.4
};

export const CHAPTERS = [
    { id: 'sea', t: 0, label: 'Mar aberto' },
    { id: 'estuary', t: 28, label: 'Estuário' },
    { id: 'port', t: 55, label: 'Porto do café' },
    { id: 'dock', t: 95, label: 'Atracação · 9h30' },
    { id: 'deck', t: 125, label: 'Olhar dos passageiros' },
    { id: 'rail', t: 148, label: 'Valongo' },
    { id: 'rise', t: 162, label: 'Porto e cidade' }
];

export function chapterAt(t) {
    let cur = CHAPTERS[0];
    for (const c of CHAPTERS) if (t >= c.t) cur = c;
    return cur;
}

/** Legendas por capítulo, cada uma ancorada num ID do dossiê (research.md). */
export const CAPTIONS = {
    sea: 'Kasato Maru · 123 m, ~6.000 t de arqueação · 50 dias desde Kōbe (K02, D03)',
    estuary: 'Canal do estuário em marcha de manobra, ~7 nós, desacelerando (N01, N02)',
    port: 'Café: ~96% do que o porto exportava · sacas de 60 kg no ombro (P02, P03)',
    dock: 'Rebocador encosta o navio no armazém 14 · cabos passados às 9h30 (D05, D06, K07)',
    deck: '781 pessoas, 165 famílias — a noite ainda seria a bordo (D02, D07)',
    rail: 'Valongo: no dia 19, o trem da SPR levaria todos à Hospedaria do Brás (V01, V02)',
    rise: 'Companhia Docas de Santos, concessionária do porto desde 1890 (P01)'
};

/**
 * Composição dos planos: onde o Kasato Maru está em cada corte do filme.
 * Tabela (t, x, z) interpolada por Catmull-Rom escalar — define a GEOMETRIA da rota
 * (canal → cais) e a posição do navio no começo de cada plano. NÃO define a
 * velocidade: esta vem da dinâmica abaixo.
 */
const TRACK = [
    // t,    x,     z
    [0, -150, -700],
    [28, -128, -505],
    [55, -100, -300],
    [80, -52, -105],
    [98, -15, -14],
    [112, -8.6, 0],
    [180, -8.6, 0]
];

function cr(p0, p1, p2, p3, u) {
    const u2 = u * u;
    const u3 = u2 * u;
    return 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3);
}

function trackAt(time, out) {
    let i = 0;
    while (i < TRACK.length - 2 && TRACK[i + 1][0] <= time) i++;
    const a = TRACK[Math.max(0, i - 1)];
    const b = TRACK[i];
    const c = TRACK[i + 1];
    const d = TRACK[Math.min(TRACK.length - 1, i + 2)];
    const u = (time - b[0]) / (c[0] - b[0]);
    out.x = Math.min(cr(a[1], b[1], c[1], d[1], u), LAYOUT.berthX);
    out.z = Math.min(cr(a[2], b[2], c[2], d[2], u), 0);
    if (time >= 112) { out.x = LAYOUT.berthX; out.z = 0; }
    return out;
}

/**
 * Dinâmica do navio (N01–N02 no dossiê) — tempo REAL de história, em segundos.
 *
 * Um vapor de 123 m e ~9.000 t de deslocamento não freia nem vira na hora:
 *   cruzeiro no canal  v_max = 3,6 m/s (7 nós, "devagar avante")
 *   desaceleração      a = 0,012 m/s² (máquina parada/a ré + resistência do casco:
 *                      F ≈ m·a ≈ 9·10⁶ kg × 0,012 ≈ 110 kN)
 *   perfil             v(d) = min(v_max, √(2·a·d)), d = distância que falta até o berço
 *     → para exatamente no armazém 14; leva v_max/a = 300 s só freando (~540 m).
 *   rumo               tangente da rota; nos últimos 45 m o rebocador empurra a popa e
 *                      o navio gira até ficar paralelo ao cais (~0,3 °/s).
 *
 * Montagem com elipses: dentro de cada plano o tempo do filme corre 1:1 com o da
 * história (velocidades reais na tela); nos cortes o filme salta à frente, como num
 * documentário. Cada plano começa com o navio no ponto de composição da TRACK, então
 * a decupagem da câmera continua valendo. O relógio diegético mostra a hora da
 * história: as amarras ficam passadas às 9h30 (D05).
 */
export const SHIP_DYN = { vmax: 3.6, decel: 0.012, turnIn: 45 };
export const KNOT = 0.514444; // m/s
const BERTH_SECONDS = 9 * 3600 + 30 * 60;
/** Cortes do filme (início de cada plano da câmera, camera.js). */
export const CUTS = [0, 13, 28, 42, 55, 69, 82, 95, 110, 125, 138, 148, 162];

// Rota amostrada (polilinha) e comprimento de arco acumulado — calculado uma vez.
const SAMPLE_DT = 0.25;
const N = Math.round(112 / SAMPLE_DT) + 1;
const PX = new Float64Array(N);
const PZ = new Float64Array(N);
const PS = new Float64Array(N);
{
    const p = {};
    for (let i = 0; i < N; i++) {
        trackAt(i * SAMPLE_DT, p);
        PX[i] = p.x;
        PZ[i] = p.z;
        PS[i] = i ? PS[i - 1] + Math.hypot(PX[i] - PX[i - 1], PZ[i] - PZ[i - 1]) : 0;
    }
}
const ROUTE = PS[N - 1];

// Perfil de velocidade fechado: cruzeiro até faltar v²/2a, depois freada constante.
const V_PEAK = Math.min(SHIP_DYN.vmax, Math.sqrt(2 * SHIP_DYN.decel * ROUTE));
const T_CRUISE = Math.max(0, (ROUTE - (V_PEAK * V_PEAK) / (2 * SHIP_DYN.decel)) / V_PEAK);
const T_STOP = T_CRUISE + V_PEAK / SHIP_DYN.decel;

function sAtTau(tau) {
    if (tau <= 0) return 0;
    if (tau <= T_CRUISE) return V_PEAK * tau;
    if (tau >= T_STOP) return ROUTE;
    const r = T_STOP - tau;
    return ROUTE - 0.5 * SHIP_DYN.decel * r * r;
}

function vAtTau(tau) {
    if (tau <= T_CRUISE) return V_PEAK;
    if (tau >= T_STOP) return 0;
    return SHIP_DYN.decel * (T_STOP - tau);
}

function tauAtS(s) {
    if (s <= V_PEAK * T_CRUISE) return s / V_PEAK;
    const d = Math.max(0, ROUTE - s);
    return T_STOP - Math.sqrt((2 * d) / SHIP_DYN.decel);
}

function sAtFilm(t) {
    const f = Math.max(0, Math.min(N - 1, t / SAMPLE_DT));
    const i = Math.min(N - 2, Math.floor(f));
    return PS[i] + (PS[i + 1] - PS[i]) * (f - i);
}

// Hora da história no começo de cada plano (monótona: nenhum plano volta no tempo).
const TAU0 = new Float64Array(CUTS.length);
for (let i = 0; i < CUTS.length; i++) {
    const min = i ? TAU0[i - 1] + (CUTS[i] - CUTS[i - 1]) : 0;
    TAU0[i] = CUTS[i] < 112 ? Math.max(min, tauAtS(sAtFilm(CUTS[i]))) : min;
}

/** Tempo de história (s desde o início da cena) para o instante t do filme. */
export function storyTime(t) {
    let i = 0;
    while (i < CUTS.length - 1 && t >= CUTS[i + 1]) i++;
    return TAU0[i] + Math.max(0, t - CUTS[i]);
}

/** Hora do dia na história, em segundos desde 0h (9h30 = navio parado no berço). */
export function storyClock(t) {
    return BERTH_SECONDS + (storyTime(t) - T_STOP);
}

function pointAtS(s, out) {
    // busca binária no comprimento de arco
    let lo = 0;
    let hi = N - 1;
    if (s <= 0) { out.x = PX[0]; out.z = PZ[0]; return out; }
    if (s >= ROUTE) { out.x = PX[N - 1]; out.z = PZ[N - 1]; return out; }
    while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (PS[mid] <= s) lo = mid; else hi = mid;
    }
    const seg = PS[hi] - PS[lo] || 1;
    const u = (s - PS[lo]) / seg;
    out.x = PX[lo] + (PX[hi] - PX[lo]) * u;
    out.z = PZ[lo] + (PZ[hi] - PZ[lo]) * u;
    return out;
}

const _a = {};
const _b = {};
/**
 * Pose do Kasato Maru no instante t do filme:
 * { x, z, heading (rad, 0 = +Z), speed (m/s), knots, tau (s de história), docked }.
 */
export function kasatoPose(t, out = {}) {
    const tau = storyTime(Math.max(0, Math.min(FILM_DURATION, t)));
    const s = sAtTau(tau);
    pointAtS(s, out);
    // rumo pela tangente da rota (diferença central de ±3 m de arco)
    pointAtS(Math.max(0, s - 3), _a);
    pointAtS(Math.min(ROUTE, s + 3), _b);
    const d = ROUTE - s;
    const k = smooth01(d / SHIP_DYN.turnIn);
    out.heading = Math.atan2(_b.x - _a.x, Math.max(_b.z - _a.z, 1e-4)) * k;
    out.speed = vAtTau(tau);
    out.knots = out.speed / KNOT;
    out.tau = tau;
    out.docked = tau >= T_STOP;
    return out;
}

function smooth01(x) {
    const u = x < 0 ? 0 : x > 1 ? 1 : x;
    return u * u * (3 - 2 * u);
}

/** Números da dinâmica, para teste e para o HUD. */
export const SHIP_FACTS = { route: ROUTE, tStop: T_STOP, tCruise: T_CRUISE, vPeak: V_PEAK, tau0: TAU0 };
