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

/**
 * Trajetória do Kasato Maru: tabela (t, x, z) interpolada por Catmull-Rom escalar.
 * O navio desacelera de ~7 m/s (barra) até parar em t = 112 s; depois fica atracado.
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

const _n = {};
export function kasatoPose(t, out = {}) {
    const time = Math.max(0, Math.min(FILM_DURATION, t));
    trackAt(time, out);
    // rumo: derivada numérica; ao parar alinha com o cais (0 = +Z)
    const e = 0.3;
    trackAt(Math.min(FILM_DURATION, time + e), _n);
    const dx = _n.x - out.x;
    const dz = _n.z - out.z;
    out.speed = Math.hypot(dx, dz) / e;
    out.heading = Math.atan2(dx, Math.max(dz, 1e-4)) * Math.min(1, out.speed / 1.5);
    return out;
}
