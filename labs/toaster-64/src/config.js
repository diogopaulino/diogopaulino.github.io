/** Constantes de Torradeira 64 — arena, física, ondas e persistência. */

export const STORAGE_KEY = 'toaster-64:v1';

export const ARENA = {
    half: 34,
    wall: 36
};

export const PLAYER = {
    accel: 38,
    brake: 46,
    maxSpeed: 19,
    reverseMax: 8,
    turn: 2.55,
    friction: 5.5,
    drag: 0.42,
    radius: 1.15,
    height: 1.05,
    jump: 11.2,
    gravity: 32,
    hover: 0.02
};

export const COMBAT = {
    toastSpeed: 32,
    toastLife: 1.35,
    toastRadius: 0.55,
    toastCooldown: 0.22,
    invuln: 1.85,
    hitKnockback: 14
};

export const QUEST = {
    disksToBoss: 8,
    lives: 3,
    floppyScore: 250,
    hitScore: 80,
    bossScore: 2000
};

export const WAVES = [
    { time: 0, ghosts: 2, invaders: 0, clippy: 0, tetris: 0 },
    { time: 18, ghosts: 3, invaders: 4, clippy: 0, tetris: 1 },
    { time: 38, ghosts: 4, invaders: 6, clippy: 1, tetris: 1 },
    { time: 58, ghosts: 5, invaders: 8, clippy: 1, tetris: 2 },
    { time: 82, ghosts: 6, invaders: 10, clippy: 2, tetris: 2 }
];

export const CLIPPY_QUOTES = [
    'Parece que você quer jogar um jogo!',
    'Encontrei 404 erros. Mostrar?',
    'Dica: pão combina com evasão.',
    'Você quis dizer: GAME OVER?',
    'Posso ajudar a não ser tostado?',
    'A torrada está pronta. Você, nem tanto.',
    'Ctrl+Z não desfaz o cachorro rindo.',
    'Salvar em disquete antes de morrer?',
    'It looks like you\'re trying to survive!',
    'O Assistente Office recomenda pular.'
];

export const HIT_QUOTES = [
    'ERROR 404: SKILL NOT FOUND',
    'O cachorro do Duck Hunt riu.',
    'BSOD IMINENTE',
    'INSERT COIN (de verdade)',
    'A torrada queimou!',
    'WAKA WAKA — você que virou o lanche',
    'PRESS START TO CRY',
    'Clippy anotou isso no Excel.'
];

export const COLLECT_QUOTES = [
    'DISQUETE SALVO',
    'INSERT DISK 2',
    '1.44 MB DE GLÓRIA',
    'WRITE PROTECT: OFF',
    'GOLDEN FLOPPY GET',
    'NINTENDO APROVARIA'
];

export const QUALITY = {
    auto: { pixel: 1, shadows: true, particles: 1, snap: 88 },
    low: { pixel: 0.7, shadows: false, particles: 0.45, snap: 56 },
    medium: { pixel: 1, shadows: true, particles: 0.75, snap: 80 },
    high: { pixel: 1.5, shadows: true, particles: 1.2, snap: 110 }
};
