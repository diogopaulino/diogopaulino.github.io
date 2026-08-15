/**
 * Cartucho 16 — regras, física e paletas.
 *
 * Resolução interna: 256×224 (SNES). Tiles 16×16 → 16 colunas × 14 linhas visíveis.
 * Loop a 60 Hz com timestep fixo. Pixel-aligned (posições desenhadas com |0).
 *
 * Física (unidades: pixels / frame a 60 fps):
 *   GRAVITY        0.28     queda padrão
 *   HOLD_GRAVITY   0.16     gravidade enquanto o salto é segurado (pulo variável)
 *   JUMP_VEL      -5.05     impulso inicial do pulo
 *   STOMP_BOUNCE  -3.35     recuo ao pisar inimigo
 *   MAX_FALL       5.40     terminal
 *   ACCEL          0.22     aceleração no chão
 *   AIR_ACCEL      0.16     aceleração no ar
 *   FRICTION       0.78     atrito no chão (vx *= FRICTION)
 *   AIR_DRAG       0.97     arrasto aéreo
 *   MAX_WALK       1.45
 *   MAX_RUN        2.35     (mundo sônico ou dash)
 *   COYOTE_FRAMES  7        pulo ainda válido após sair da borda
 *   JUMP_BUFFER    9        pulo apertado pouco antes de aterrissar
 *   INVULN_FRAMES  90       pisca após dano
 *
 * Combate:
 *   stomp se vy > 0.35 e o pé está acima do centro do inimigo
 *   combo de stomp: 100 → 200 → 400 → 800 → 1000
 *   melee: 14 px, 12 frames, 18 frames de cooldown
 *   buster: projétil 3.2 px/frame, 1 dano (2 se carregado ≥ 28 frames)
 *
 * Anéis (Colinas Sônicas): dano gasta os anéis em vez de HP, como no Sonic.
 * Tempo: 300 s por fase; 50 pts × segundos restantes ao pegar o cristal.
 * Código Konami: +30 vidas e estrela.
 */

export const VIEW_W = 256;
export const VIEW_H = 224;
export const TILE = 16;
export const ROWS = VIEW_H / TILE; // 14
export const COLS = VIEW_W / TILE; // 16
export const FPS = 60;
export const DT = 1 / FPS;

export const PHYS = {
    GRAVITY: 0.28,
    HOLD_GRAVITY: 0.16,
    JUMP_VEL: -5.05,
    STOMP_BOUNCE: -3.35,
    MAX_FALL: 5.4,
    ACCEL: 0.22,
    AIR_ACCEL: 0.16,
    FRICTION: 0.78,
    AIR_DRAG: 0.97,
    MAX_WALK: 1.45,
    MAX_RUN: 2.35,
    COYOTE: 7,
    JUMP_BUFFER: 9,
    INVULN: 90,
    HURT_KNOCK_X: 2.1,
    HURT_KNOCK_Y: -2.8,
    DASH_VEL: 3.4,
    DASH_FRAMES: 10,
};

export const PLAYER = {
    W: 10,
    H: 14,
    MAX_HP: 3,
    START_LIVES: 5,
    MELEE_W: 14,
    MELEE_H: 12,
    MELEE_FRAMES: 12,
    MELEE_CD: 18,
    CHARGE_NEED: 28,
};

export const STOMP_SCORE = [100, 200, 400, 800, 1000];

export const SAVE_KEY = 'cartucho16';

export const WORLDS = [
    {
        id: 'pradaria',
        short: 'W1',
        name: 'SUPER PRADARIA',
        homage: 'Super Mario World · 1990',
        hint: 'Pise nos cogumelos. Bata os blocos por baixo.',
        time: 300,
        music: 'pradaria',
    },
    {
        id: 'loop',
        short: 'W2',
        name: 'COLINAS SONICAS',
        homage: 'Sonic the Hedgehog · 1991',
        hint: 'Anéis protegem. Molas e setas dão velocidade.',
        time: 280,
        music: 'loop',
    },
    {
        id: 'templo',
        short: 'W3',
        name: 'TEMPLO CREPUSCULO',
        homage: 'Zelda: A Link to the Past · 1991',
        hint: 'É perigoso ir só. Ataque os cavaleiros.',
        time: 300,
        music: 'templo',
    },
    {
        id: 'cidadela',
        short: 'W4',
        name: 'CIDADELA X',
        homage: 'Mega Man X · 1993',
        hint: 'Segure ATK para carregar. Dash com Shift.',
        time: 260,
        music: 'cidadela',
    },
    {
        id: 'castelo',
        short: 'W5',
        name: 'CASTELO SINFONIA',
        homage: 'Castlevania · 1991–97',
        hint: 'Chicote longo. Suba as escadas. Cuidado com as cabeças.',
        time: 280,
        music: 'castelo',
    },
    {
        id: 'nucleo',
        short: 'W6',
        name: 'NUCLEO GLITCH',
        homage: 'O cartucho sem etiqueta',
        hint: 'O Rei Glitch mistura todos os mundos.',
        time: 240,
        music: 'boss',
        boss: true,
    },
];

/** Paletas 16-bit por mundo (céu, horizonte, grama/chão, terra, accent, sombra). */
export const PALETTES = {
    pradaria: {
        skyTop: '#3c78dc',
        skyBot: '#a4d4fc',
        hill: '#3cac54',
        hillDark: '#247c38',
        ground: '#c87828',
        groundTop: '#58c040',
        brick: '#d07838',
        brickDark: '#884018',
        pipe: '#28a030',
        pipeDark: '#186820',
        coin: '#f8d848',
        water: '#3890d8',
        cloud: '#f0f4ff',
        accent: '#f83030',
    },
    loop: {
        skyTop: '#1890f0',
        skyBot: '#70d8f8',
        hill: '#20c040',
        hillDark: '#108028',
        ground: '#d8a038',
        groundTop: '#40e050',
        brick: '#e8c040',
        brickDark: '#a07010',
        pipe: '#f0c010',
        pipeDark: '#a07808',
        coin: '#ffe848',
        water: '#20b0e0',
        cloud: '#ffffff',
        accent: '#1860e8',
    },
    templo: {
        skyTop: '#241848',
        skyBot: '#684878',
        hill: '#2c6034',
        hillDark: '#183c20',
        ground: '#6c684c',
        groundTop: '#8c8860',
        brick: '#887848',
        brickDark: '#504828',
        pipe: '#486040',
        pipeDark: '#283820',
        coin: '#40e070',
        water: '#285878',
        cloud: '#d8c090',
        accent: '#e0c040',
    },
    cidadela: {
        skyTop: '#102040',
        skyBot: '#204878',
        hill: '#3c5068',
        hillDark: '#243044',
        ground: '#687080',
        groundTop: '#90a0b0',
        brick: '#7890a8',
        brickDark: '#405060',
        pipe: '#e06020',
        pipeDark: '#883010',
        coin: '#40e8f8',
        water: '#1860a0',
        cloud: '#6080a8',
        accent: '#f8d020',
    },
    castelo: {
        skyTop: '#100818',
        skyBot: '#301828',
        hill: '#3c1828',
        hillDark: '#200c18',
        ground: '#582028',
        groundTop: '#783040',
        brick: '#6c2430',
        brickDark: '#3c1018',
        pipe: '#886028',
        pipeDark: '#503818',
        coin: '#f0c040',
        water: '#201838',
        cloud: '#c0a878',
        accent: '#e82838',
    },
    nucleo: {
        skyTop: '#080810',
        skyBot: '#281848',
        hill: '#481878',
        hillDark: '#200830',
        ground: '#303040',
        groundTop: '#f838a0',
        brick: '#6030c0',
        brickDark: '#280860',
        pipe: '#20e0a0',
        pipeDark: '#087050',
        coin: '#f8f838',
        water: '#f01070',
        cloud: '#e0a0ff',
        accent: '#38f8f8',
    },
};

export const SOLID = new Set(['#', '?', 'B', 'E', 'p', 'i', 'H']);
export const ONE_WAY = new Set(['=']);
export const HAZARD = new Set(['!']);
export const CLIMB = new Set(['|']);
export const BOOST = new Set(['>']);

export const ENTITY_CHARS = {
    c: 'coin',
    o: 'ring',
    u: 'rupee',
    h: 'heart',
    '*': 'star',
    '1': 'oneup',
    e: 'walker',
    f: 'flyer',
    k: 'armored',
    g: 'piranha',
    s: 'spawn',
    x: 'crystal',
    '@': 'sign',
    '^': 'spring',
    n: 'npc',
    m: 'mover',
    d: 'boss',
    v: 'candle',
    q: 'pot',
};

export function loadSave() {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return defaultSave();
        const data = JSON.parse(raw);
        return { ...defaultSave(), ...data };
    } catch {
        return defaultSave();
    }
}

export function defaultSave() {
    return {
        best: 0,
        crystals: [false, false, false, false, false],
        bossClear: false,
        muted: false,
        crt: true,
    };
}

export function writeSave(save) {
    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch {
        /* private mode */
    }
}
