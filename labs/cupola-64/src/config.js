/**
 * Cúpola 64 — constantes, fórmulas de salto e o mapa da Ilha da Cúpola.
 *
 * Física no espírito Super Mario 64 (documentada, não copiada de ROM):
 *   v'  = v + a·dt                         (aceleração no chão)
 *   v  *= exp(-friction·dt)                (atrito quando o stick solta)
 *   vy -= g·dt                             (gravidade; g maior na descida)
 *   pulo 1  → vy = JUMP
 *   pulo 2  (pouso < 0.28 s) → vy = JUMP_DBL
 *   pulo 3  (pouso < 0.32 s e correndo) → vy = JUMP_TRI
 *   long jump (agachar + velocidade) → vy = JUMP_LONG, |xz| *= 1.45
 *   ground pound (agachar no ar) → vy = -POUND, xz trava
 *   dive (pulo no ar sem combo) → empurrão para frente
 */

export const STORAGE_KEY = 'cupola-64:v1';

export const ISLAND = {
    radius: 50,
    waterY: -0.15,
    fallY: -8
};

export const PLAYER = {
    radius: 0.42,
    height: 1.18,
    walk: 7.2,
    run: 13.4,
    accel: 32,
    airAccel: 14,
    friction: 7.4,
    airDrag: 0.55,
    turn: 14,
    gravity: 38,
    fallGravity: 48,
    jump: 13.2,
    jumpDbl: 15.4,
    jumpTri: 19.2,
    jumpLong: 11.4,
    longBoost: 1.48,
    diveBoost: 11,
    diveY: 5.2,
    poundVy: -34,
    swim: 5.2,
    invuln: 1.55,
    comboWindow: 0.3,
    tripleWindow: 0.34
};

export const CAMERA = {
    distance: 9.2,
    minDistance: 4.6,
    maxDistance: 16,
    phi: 1.18,
    phiMin: 0.42,
    phiMax: 1.42,
    height: 1.35,
    rotate: 1.85,
    lag: 7.2
};

export const QUEST = {
    stars: 7,
    redCoins: 8,
    coinStar: 50,
    lives: 4,
    kingHits: 3
};

export const QUALITY = {
    low: { pr: 1, antialias: false, shadows: false, shadowSize: 512, trees: 0.45, grass: 0.4, clouds: 8, snap: 64 },
    medium: { pr: 1.25, antialias: false, shadows: true, shadowSize: 1024, trees: 0.75, grass: 0.7, clouds: 12, snap: 84 },
    high: { pr: 1.6, antialias: true, shadows: true, shadowSize: 2048, trees: 1, grass: 1, clouds: 16, snap: 110 }
};

export const STAR_META = [
    { id: 'summit', title: 'Cume da montanha', hint: 'Suba a colina até o pico.' },
    { id: 'roof', title: 'Telhado da cúpola', hint: 'O vitral guarda uma estrela.' },
    { id: 'red', title: 'Oito vermelhas', hint: 'Colete as 8 moedas vermelhas.' },
    { id: 'sky', title: 'Ilha no céu', hint: 'Canhão ou pulo triplo.' },
    { id: 'cave', title: 'Gruta do farol', hint: 'Entre pela boca da montanha.' },
    { id: 'king', title: 'Rei da Colina', hint: 'Pule três vezes na bomba-rei.' },
    { id: 'coins', title: 'Cinquenta moedas', hint: 'Junte 50 moedas douradas.' }
];

export const QUOTES = {
    star: [
        'ESTRELA DA CÚPOLA!',
        'A ilha brilha um pouco mais.',
        'Nico pegou uma estrela!',
        'O vitral respondeu.'
    ],
    coin: ['TING!', 'Moeda!', 'Mais uma.'],
    red: ['Vermelha!', 'Falta pouco.', 'Oito no total.'],
    hurt: ['Ai!', 'Nico tropeçou.', 'A ilha é traiçoeira.'],
    king: ['A bomba-rei acordou!', 'Mais um pulo na cabeça!', 'Ela vai explodir de raiva.']
};
