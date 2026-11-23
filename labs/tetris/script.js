/* ==========================================================================
   TETRIS 90s — regras (Tetris Guideline com a cara do Game Boy)
   --------------------------------------------------------------------------
   Tabuleiro: 10 colunas × 22 linhas, das quais as 2 de cima são ocultas
   (área de nascimento). As peças nascem centralizadas nas linhas ocultas e
   descem 1 linha na hora, como nos Tetris modernos.

   Sorteio: saco de 7 — cada sequência de 7 peças traz as 7 formas uma vez,
   em ordem aleatória. Fila de 3 próximas peças visível.

   Rotação: SRS (Super Rotation System). Cada peça gira em torno do centro da
   própria caixa (3×3, ou 4×4 para o I; o O não gira). Se a posição girada
   colide, testam-se 4 deslocamentos alternativos ("wall kicks") da tabela
   oficial, na ordem; o primeiro livre vence. Sem nenhum livre, não gira.

   Guarda (hold): troca a peça da vez pela guardada (ou pela próxima, se a
   guarda está vazia). Uma vez por peça: libera de novo quando a peça trava.

   Gravidade (Guideline): segundos por linha no nível n
       t(n) = (0,8 − (n − 1) · 0,007)^(n − 1)      → n1 = 1 s, n5 ≈ 0,36 s,
                                                    n10 ≈ 0,064 s, n15 ≈ 0,007 s
   · Normal: a curva acima. Fácil: t(1 + (n − 1)·0,5) · 1,25 (começa em 1,25 s
     e acelera na metade do ritmo). Nível sobe a cada 10 linhas.
   · Queda suave: gravidade × SDF (padrão 20×, ajustável; 0 = instantânea).
   · Queda rápida: desce até o fim e trava na hora.

   Trava (lock delay): ao encostar, a peça espera 0,5 s (0,7 s no Fácil).
   Mover ou girar com sucesso reinicia a espera, no máximo 15 vezes por peça
   (move reset); descer para uma linha nova zera esse contador.

   Movimento lateral: DAS/ARR. Ao segurar ← ou →, a peça anda 1 casa, espera
   DAS ms e então anda 1 casa a cada ARR ms (ARR 0 = vai direto à parede).
   A última direção apertada tem prioridade.

   Pontuação (× nível):
     Linhas:       simples 100 · dupla 300 · tripla 500 · Tetris 800
     T-spin:       sem linha 400 · simples 800 · dupla 1200 · tripla 1600
     T-spin mini:  sem linha 100 · simples 200 · dupla 400
     Back-to-back: Tetris ou T-spin com linha logo após outro "difícil" × 1,5
     Combo:        + 50 × combo × nível (linhas em travas seguidas)
     Tudo limpo:   + 800/1200/1800/2000 (1–4 linhas)
     Queda suave 1 por linha; queda rápida 2 por linha.
   T-spin (regra dos 3 cantos): a última ação foi girar o T e ao menos 3 das
   4 casas diagonais ao centro dele estão ocupadas (parede conta). É "cheio"
   se os 2 cantos da frente (para onde o T aponta) estão ocupados ou se o
   giro usou o último kick; senão é "mini".

   Fim de jogo: a peça nova nasce sobre blocos (block out) ou uma peça trava
   inteira acima da área visível (lock out).
   ========================================================================== */

/* setPointerCapture lança InvalidStateError se o ponteiro já foi solto (toque
   muito curto, evento sintético). A captura é um bônus: sem ela o gesto segue. */
function capturePointer(element, pointerId) {
    try {
        element.setPointerCapture(pointerId);
    } catch (err) {
        /* segue sem captura */
    }
}

const canvas = document.getElementById('tetris');
const context = canvas.getContext('2d');
const nextCanvas = document.getElementById('next');
const nextContext = nextCanvas.getContext('2d');
const holdCanvas = document.getElementById('hold');
const holdContext = holdCanvas.getContext('2d');

const COLS = 10;
const VISIBLE_ROWS = 20;
const HIDDEN_ROWS = 2;
const ROWS = VISIBLE_ROWS + HIDDEN_ROWS;
const NEXT_COUNT = 3;

// Game Boy Palette (synchronized with theme)
const PALETTES = {
    light: [
        null,
        '#0f380f', // 1: Darkest (ink)
        '#306230', // 2: Dark (mid-dark)
        '#8bac0f', // 3: Light (screen bg)
        '#9bbc0f', // 4: Lightest (highlight)
    ],
    dark: [
        null,
        '#072207', // 1: Deepest LCD ink
        '#245224', // 2: Mid-dark olive
        '#6e8c0b', // 3: Dimmed backlit LCD bg
        '#88ab14', // 4: Backlit highlight
    ]
};

let colors = PALETTES.light.slice();

function syncPalette() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const nextPalette = isDark ? PALETTES.dark : PALETTES.light;
    for (let i = 1; i <= 4; i++) colors[i] = nextPalette[i];
}
syncPalette();

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

/* --- Som -------------------------------------------------------------------
   Timbre de chip: quadrada curta para os controles, arpejo para as linhas.
   O motor vem do LabAudio (labs/shared.js), então o mudo é persistido e
   compartilhado com os outros labs. */
const audio = window.LabAudio;

function sfx(name, extra = 0) {
    if (!audio) return;
    switch (name) {
        case 'move':
            audio.tone({ freq: 220, duration: 0.03, gain: 0.05 });
            break;
        case 'rotate':
            audio.tone({ freq: 440, duration: 0.05, gain: 0.07 });
            break;
        case 'kick':
            audio.tone({ freq: 520, duration: 0.06, gain: 0.07, slideTo: 640 });
            break;
        case 'hold':
            audio.tone({ freq: 330, duration: 0.08, gain: 0.08, slideTo: 495, type: 'triangle' });
            break;
        case 'lock':
            audio.noise({ duration: 0.07, gain: 0.09, filter: 900 });
            break;
        case 'drop':
            audio.tone({ freq: 520, duration: 0.12, gain: 0.1, slideTo: 120, type: 'square' });
            audio.noise({ duration: 0.09, gain: 0.08, filter: 600 });
            break;
        case 'line':
            audio.sequence([523, 659, 784], { step: 0.05, duration: 0.09, gain: 0.12 });
            break;
        case 'tetris':
            // Quatro linhas de uma vez merecem a fanfarra completa.
            audio.sequence([523, 659, 784, 1047, 1319], { step: 0.06, duration: 0.14, gain: 0.14 });
            break;
        case 'tspin':
            audio.sequence([392, 587, 784, 1175], { step: 0.05, duration: 0.12, gain: 0.13, type: 'triangle' });
            break;
        case 'combo':
            // O combo sobe meio tom a cada trava seguida: dá para "ouvir" a sequência.
            audio.tone({ freq: 660 * Math.pow(2, Math.min(extra, 12) / 12), duration: 0.08, gain: 0.08, delay: 0.12 });
            break;
        case 'level':
            audio.sequence([784, 988, 1175], { step: 0.05, duration: 0.1, gain: 0.11 });
            break;
        case 'over':
            audio.tone({ freq: 330, duration: 0.9, gain: 0.14, slideTo: 60, type: 'sawtooth' });
            break;
        case 'start':
            audio.sequence([392, 523, 659, 784], { step: 0.08, duration: 0.12, gain: 0.13 });
            break;
    }
}

/* Vibração curta no celular. Opcional (ajuste) e silenciosa onde não existe. */
function buzz(pattern) {
    if (!settings.haptics) return;
    try {
        navigator.vibrate?.(pattern);
    } catch (err) {
        /* alguns navegadores expõem vibrate mas recusam a chamada */
    }
}

/* --- Peças (SRS) -----------------------------------------------------------
   Orientação de nascimento oficial. O número de cada célula escolhe a
   textura no LCD (1..7), já que o Game Boy só tem 4 tons. */
const TYPES = 'IJLOSTZ';
const TYPE_ID = { I: 1, L: 2, J: 3, O: 4, Z: 5, S: 6, T: 7 };
const SHAPES = {
    I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
    L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
    O: [[1, 1], [1, 1]],
    S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
    T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
    Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
};

/* As 4 rotações de cada peça, pré-calculadas como listas de células [x, y]
   dentro da caixa. Girar no sentido horário: novo[y][x] = velho[n−1−x][y]. */
const ROTATIONS = {};
for (const type of TYPES) {
    let matrix = SHAPES[type];
    const states = [];
    for (let r = 0; r < 4; r++) {
        const cells = [];
        matrix.forEach((row, y) => row.forEach((v, x) => { if (v) cells.push([x, y]); }));
        states.push(cells);
        const n = matrix.length;
        matrix = matrix.map((row, y) => row.map((_, x) => matrix[n - 1 - x][y]));
    }
    ROTATIONS[type] = states;
}

/* Tabelas de wall kick do SRS, no formato (x, y) com y PARA CIMA, como na
   especificação. Na aplicação o y é invertido (o tabuleiro cresce para baixo).
   Chave: "de>para", com 0 = nascimento, 1 = R, 2 = 180°, 3 = L. */
const KICKS_JLSTZ = {
    '0>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '1>0': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    '1>2': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    '2>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '2>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    '3>2': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '3>0': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '0>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
};
const KICKS_I = {
    '0>1': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
    '1>0': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
    '1>2': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
    '2>1': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
    '2>3': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
    '3>2': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
    '3>0': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
    '0>3': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
};

/* Pontuação e regras de velocidade -------------------------------------- */
const LINE_SCORE = [0, 100, 300, 500, 800];
const TSPIN_SCORE = [400, 800, 1200, 1600];
const TSPIN_MINI_SCORE = [100, 200, 400, 400];
const PERFECT_CLEAR = [0, 800, 1200, 1800, 2000];
const HIGHSCORE_KEY = 'tetris90s:highscore';
const MODE_KEY = 'tetris90s:mode';
const SETTINGS_KEY = 'tetris90s:settings';

const MODES = {
    easy: { lockDelay: 700, hint: 'Peças caem devagar' },
    normal: { lockDelay: 500, hint: 'Velocidade oficial' }
};
const LOCK_RESETS = 15;
const CLEAR_DELAY = 220; // ms de animação das linhas antes de recolher

function gravitySeconds(level) {
    if (mode === 'easy') {
        const eased = 1 + (level - 1) * 0.5;
        return Math.pow(0.8 - (eased - 1) * 0.007, eased - 1) * 1.25;
    }
    const n = Math.min(level, 15);
    return Math.pow(0.8 - (n - 1) * 0.007, n - 1);
}

/* --- Ajustes persistidos ---------------------------------------------------
   Padrões da Guideline: DAS 167 ms (10 quadros), ARR 33 ms (2 quadros),
   queda suave 20×. */
const DEFAULT_SETTINGS = { das: 167, arr: 33, sdf: 20, ghost: true, haptics: true };

function readSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
        const merged = { ...DEFAULT_SETTINGS, ...saved };
        merged.das = clampNumber(merged.das, 50, 300, DEFAULT_SETTINGS.das);
        merged.arr = clampNumber(merged.arr, 0, 100, DEFAULT_SETTINGS.arr);
        merged.sdf = [0, 5, 10, 20, 40].includes(Number(merged.sdf)) ? Number(merged.sdf) : DEFAULT_SETTINGS.sdf;
        merged.ghost = merged.ghost !== false;
        merged.haptics = merged.haptics !== false;
        return merged;
    } catch (err) {
        return { ...DEFAULT_SETTINGS };
    }
}

function clampNumber(value, min, max, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
}

function saveSettings() {
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (err) {
        /* Sem storage os ajustes valem só nesta visita. */
    }
}

const settings = readSettings();

function readMode() {
    try {
        const saved = localStorage.getItem(MODE_KEY);
        return saved in MODES ? saved : 'easy';
    } catch (err) {
        return 'easy';
    }
}

let mode = readMode();

/* --- Estado ---------------------------------------------------------------- */
const arena = Array.from({ length: ROWS }, () => new Array(COLS).fill(0));

const player = {
    type: null,
    rot: 0,
    x: 0,
    y: 0,
    score: 0,
    lines: 0,
    level: 1,
};

let queue = [];
let bag = [];
let holdType = null;
let holdUsed = false;
let combo = -1;
let backToBack = false;
let lastAction = '';  // 'rotate' | 'move' | 'drop' — para detectar T-spin
let lastKick = 0;     // índice do kick usado no último giro bem-sucedido
let lockTimer = 0;
let lockResets = 0;
let lowestY = 0;
let gravityTimer = 0;
let clearing = null;  // { rows: [y…], timer } durante a animação de linha
let state = 'ready';  // ready | playing | paused | over
let boardDirty = true;
let highScore = loadHighScore();
let highScoreAtStart = 0;

/* Efeitos visuais: decaem por tempo real e nunca mudam a simulação. */
const fx = {
    lockCells: [],     // células da última trava, piscam claras
    lockFlash: 0,
    trail: null,       // rastro vertical da queda rápida
    shake: 0,
};

function refillBag() {
    const fresh = TYPES.split('');
    for (let i = fresh.length - 1; i > 0; i--) {
        const j = Math.random() * (i + 1) | 0;
        [fresh[i], fresh[j]] = [fresh[j], fresh[i]];
    }
    bag.push(...fresh);
}

function takeFromBag() {
    if (!bag.length) refillBag();
    return bag.shift();
}

function fillQueue() {
    while (queue.length < NEXT_COUNT) queue.push(takeFromBag());
}

function cellsOf(type, rot) {
    return ROTATIONS[type][rot];
}

function collides(type, rot, x, y) {
    const cells = ROTATIONS[type][rot];
    for (let i = 0; i < cells.length; i++) {
        const ax = x + cells[i][0];
        const ay = y + cells[i][1];
        if (ax < 0 || ax >= COLS || ay >= ROWS) return true;
        if (ay >= 0 && arena[ay][ax] !== 0) return true;
    }
    return false;
}

function spawnX(type) {
    return type === 'O' ? 4 : 3;
}

/* Nasce na área oculta e, se houver espaço, desce 1 linha na hora. */
function spawn(type) {
    player.type = type;
    player.rot = 0;
    player.x = spawnX(type);
    player.y = 0;
    lockTimer = 0;
    lockResets = 0;
    gravityTimer = 0;
    lastAction = '';
    lastKick = 0;

    if (collides(type, 0, player.x, player.y)) {
        gameOver();
        return false;
    }
    if (!collides(type, 0, player.x, player.y + 1)) player.y++;
    lowestY = player.y;
    boardDirty = true;
    drawNext();
    return true;
}

function spawnNext() {
    fillQueue();
    const type = queue.shift();
    fillQueue();
    holdUsed = false;
    drawHold();
    return spawn(type);
}

function isGrounded() {
    return collides(player.type, player.rot, player.x, player.y + 1);
}

/* Movimento/giro bem-sucedido no chão devolve o tempo de trava (até 15×). */
function onPieceMoved() {
    boardDirty = true;
    if (player.y > lowestY) {
        lowestY = player.y;
        lockResets = 0;
    }
    if (isGrounded() && lockResets < LOCK_RESETS) {
        lockResets++;
        lockTimer = 0;
    }
}

function tryMove(dx) {
    if (!canAct()) return false;
    if (collides(player.type, player.rot, player.x + dx, player.y)) return false;
    player.x += dx;
    lastAction = 'move';
    onPieceMoved();
    return true;
}

function tryRotate(dir) {
    if (!canAct()) return false;
    if (player.type === 'O') {
        // O não gira, mas o clique responde (e o T-spin não se aplica).
        sfx('rotate');
        return false;
    }
    const from = player.rot;
    const to = (from + dir + 4) % 4;
    const table = player.type === 'I' ? KICKS_I : KICKS_JLSTZ;
    const tests = table[`${from}>${to}`];
    for (let i = 0; i < tests.length; i++) {
        const nx = player.x + tests[i][0];
        const ny = player.y - tests[i][1];
        if (!collides(player.type, to, nx, ny)) {
            player.x = nx;
            player.y = ny;
            player.rot = to;
            lastAction = 'rotate';
            lastKick = i;
            onPieceMoved();
            sfx(i > 0 ? 'kick' : 'rotate');
            return true;
        }
    }
    return false;
}

/* Desce 1 linha. Devolve false se encostou. */
function stepDown() {
    if (collides(player.type, player.rot, player.x, player.y + 1)) return false;
    player.y++;
    lastAction = 'drop';
    boardDirty = true;
    if (player.y > lowestY) {
        lowestY = player.y;
        lockResets = 0;
        lockTimer = 0;
    }
    return true;
}

function hardDrop() {
    if (!canAct()) return;
    const startY = player.y;
    while (stepDown()) { /* desce até encostar */ }
    const distance = player.y - startY;
    if (distance > 0) {
        player.score += distance * 2;
        // stepDown zerou lastAction; a queda rápida não desfaz um T-spin já girado.
    }
    const cells = cellsOf(player.type, player.rot);
    let minX = COLS;
    let maxX = 0;
    for (const [cx] of cells) {
        minX = Math.min(minX, player.x + cx);
        maxX = Math.max(maxX, player.x + cx);
    }
    fx.trail = { x0: minX, x1: maxX + 1, top: startY - HIDDEN_ROWS, bottom: player.y - HIDDEN_ROWS + 1, t: 1 };
    if (!reducedMotion.matches) fx.shake = 1;
    sfx('drop');
    buzz(12);
    lockPiece(distance > 0 ? 'drop' : lastAction);
}

function holdPiece() {
    if (!canAct() || holdUsed) return;
    const current = player.type;
    holdUsed = true;
    sfx('hold');
    if (holdType) {
        const swap = holdType;
        holdType = current;
        spawn(swap);
    } else {
        holdType = current;
        fillQueue();
        const type = queue.shift();
        fillQueue();
        spawn(type);
    }
    drawHold();
}

/* Regra dos 3 cantos. Devolve '', 'mini' ou 'full'. */
function detectTSpin(actionBeforeLock) {
    if (player.type !== 'T' || actionBeforeLock !== 'rotate') return '';
    const cx = player.x + 1;
    const cy = player.y + 1;
    const filled = (x, y) => x < 0 || x >= COLS || y >= ROWS || (y >= 0 && arena[y][x] !== 0);
    const tl = filled(cx - 1, cy - 1);
    const tr = filled(cx + 1, cy - 1);
    const bl = filled(cx - 1, cy + 1);
    const br = filled(cx + 1, cy + 1);
    const count = tl + tr + bl + br;
    if (count < 3) return '';
    const front = [[tl, tr], [tr, br], [bl, br], [tl, bl]][player.rot];
    return (front[0] && front[1]) || lastKick === 4 ? 'full' : 'mini';
}

function lockPiece(actionBeforeLock = lastAction) {
    const id = TYPE_ID[player.type];
    const cells = cellsOf(player.type, player.rot);
    const tspin = detectTSpin(actionBeforeLock);
    let allHidden = true;
    fx.lockCells.length = 0;
    for (const [cx, cy] of cells) {
        const ax = player.x + cx;
        const ay = player.y + cy;
        if (ay >= 0) arena[ay][ax] = id;
        if (ay >= HIDDEN_ROWS) allHidden = false;
        fx.lockCells.push(ax, ay - HIDDEN_ROWS);
    }
    fx.lockFlash = 1;
    player.type = null;
    boardDirty = true;

    // Lock out: travou inteira acima da área visível.
    if (allHidden) {
        gameOver();
        return;
    }

    const full = [];
    for (let y = 0; y < ROWS; y++) {
        if (arena[y].every(v => v !== 0)) full.push(y);
    }
    score(full.length, tspin);

    if (full.length) {
        clearing = { rows: full, timer: CLEAR_DELAY };
        buzz(full.length >= 4 ? [20, 30, 40] : 22);
    } else {
        sfx('lock');
        spawnNext();
    }
    updateScore();
}

function finishClear() {
    const rows = clearing.rows;
    clearing = null;
    // Remove de baixo para cima preservando a ordem das demais.
    for (let i = rows.length - 1; i >= 0; i--) arena.splice(rows[i], 1);
    for (let i = 0; i < rows.length; i++) arena.unshift(new Array(COLS).fill(0));
    boardDirty = true;
    spawnNext();
}

function score(lines, tspin) {
    const level = player.level;
    let points = 0;
    let label = '';
    const difficult = lines === 4 || (tspin && lines > 0);

    if (tspin === 'full') {
        points = TSPIN_SCORE[lines];
        label = ['T-SPIN', 'T-SPIN SIMPLES', 'T-SPIN DUPLO', 'T-SPIN TRIPLO'][lines];
    } else if (tspin === 'mini') {
        points = TSPIN_MINI_SCORE[lines];
        label = lines ? 'T-SPIN MINI' : '';
    } else {
        points = LINE_SCORE[lines];
        label = lines === 4 ? 'TETRIS!' : '';
    }

    let b2b = false;
    if (difficult) {
        if (backToBack) {
            points = Math.floor(points * 1.5);
            b2b = true;
        }
        backToBack = true;
    } else if (lines > 0) {
        backToBack = false;
    }

    points *= level;

    if (lines > 0) {
        combo++;
        if (combo > 0) points += 50 * combo * level;
    } else {
        combo = -1;
    }

    // Tudo limpo: o tabuleiro fica vazio depois de recolher as linhas.
    let perfect = false;
    if (lines > 0) {
        const filledCells = arena.reduce((total, row) => total + row.reduce((t, v) => t + (v ? 1 : 0), 0), 0);
        perfect = filledCells === lines * COLS;
        if (perfect) points += PERFECT_CLEAR[lines] * level;
    }

    player.score += points;

    if (lines > 0) {
        const previousLevel = player.level;
        player.lines += lines;
        player.level = Math.floor(player.lines / 10) + 1;
        if (tspin === 'full') sfx('tspin');
        else sfx(lines === 4 ? 'tetris' : 'line');
        if (combo > 0) sfx('combo', combo);
        if (player.level > previousLevel) {
            sfx('level');
            announce(`Nível ${player.level}.`);
        }
    } else if (tspin === 'full') {
        sfx('tspin');
    }

    const parts = [];
    if (perfect) parts.push('TUDO LIMPO!');
    if (label) parts.push(label);
    if (b2b) parts.push('B2B');
    if (combo > 0) parts.push(`COMBO ${combo}`);
    if (parts.length) showAction(parts.join('\n'));
}

/* --- Texto de jogada (TETRIS!, T-SPIN, COMBO) ------------------------------ */
const actionText = document.getElementById('actionText');
let actionTimer = 0;

function showAction(text) {
    actionText.textContent = text;
    actionText.classList.remove('show');
    void actionText.offsetWidth; // reinicia a animação CSS
    actionText.classList.add('show');
    clearTimeout(actionTimer);
    actionTimer = setTimeout(() => actionText.classList.remove('show'), 1300);
}

/* --- Render ----------------------------------------------------------------
   O canvas do tabuleiro tem o buffer no tamanho real em pixels da tela
   (tamanho exibido × devicePixelRatio, teto 2) e desenha em "unidades de
   célula" via setTransform — nítido no Retina e sem frações entre blocos. */
let boardCell = 20;

function sizeCanvas(target, ctx, unitsW, unitsH) {
    const rect = target.getBoundingClientRect();
    if (!rect.width || !rect.height) return 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const unit = Math.max(4, Math.round(Math.min(rect.width / unitsW, rect.height / unitsH) * dpr));
    const w = unit * unitsW;
    const h = unit * unitsH;
    if (target.width !== w || target.height !== h) {
        target.width = w;
        target.height = h;
    }
    ctx.setTransform(unit, 0, 0, unit, 0, 0);
    return unit;
}

function resizeCanvases() {
    boardCell = sizeCanvas(canvas, context, COLS, VISIBLE_ROWS) || boardCell;
    sizeCanvas(nextCanvas, nextContext, 4, 10);
    sizeCanvas(holdCanvas, holdContext, 4, 2.4);
    boardDirty = true;
    draw();
    drawNext();
    drawHold();
}

function drawBlock(ctx, bx, by, value) {
    // Sombra projetada sutil no cristal líquido
    ctx.fillStyle = 'rgba(15, 56, 15, 0.22)';
    ctx.fillRect(bx + 0.08, by + 0.08, 0.96, 0.96);

    // Base escura (contorno 1px em escala 20x)
    ctx.fillStyle = colors[1];
    ctx.fillRect(bx, by, 0.95, 0.95);

    switch (value) {
        case 1: // I: chanfro 3D iluminado + rebite central
            ctx.fillStyle = colors[4];
            ctx.fillRect(bx + 0.05, by + 0.05, 0.85, 0.12);
            ctx.fillRect(bx + 0.05, by + 0.05, 0.12, 0.85);
            ctx.fillStyle = colors[2];
            ctx.fillRect(bx + 0.15, by + 0.15, 0.65, 0.65);
            ctx.fillStyle = colors[4];
            ctx.fillRect(bx + 0.38, by + 0.38, 0.2, 0.2);
            break;
        case 2: // L: moldura escura com miolo claro e ponto interno
            ctx.fillStyle = colors[4];
            ctx.fillRect(bx + 0.12, by + 0.12, 0.71, 0.71);
            ctx.fillStyle = colors[2];
            ctx.fillRect(bx + 0.25, by + 0.25, 0.45, 0.45);
            ctx.fillStyle = colors[1];
            ctx.fillRect(bx + 0.38, by + 0.38, 0.2, 0.2);
            break;
        case 3: // J: moldura dupla concêntrica escura
            ctx.fillStyle = colors[2];
            ctx.fillRect(bx + 0.1, by + 0.1, 0.75, 0.75);
            ctx.fillStyle = colors[1];
            ctx.fillRect(bx + 0.22, by + 0.22, 0.51, 0.51);
            ctx.fillStyle = colors[4];
            ctx.fillRect(bx + 0.35, by + 0.35, 0.25, 0.25);
            break;
        case 4: // O: bloco solar claro com quadrado sólido central
            ctx.fillStyle = colors[4];
            ctx.fillRect(bx + 0.1, by + 0.1, 0.75, 0.75);
            ctx.fillStyle = colors[1];
            ctx.fillRect(bx + 0.3, by + 0.3, 0.35, 0.35);
            break;
        case 5: // Z: hachura cruzada (xadrez 2x2 Game Boy)
            ctx.fillStyle = colors[2];
            ctx.fillRect(bx + 0.1, by + 0.1, 0.75, 0.75);
            ctx.fillStyle = colors[4];
            ctx.fillRect(bx + 0.15, by + 0.15, 0.3, 0.3);
            ctx.fillRect(bx + 0.5, by + 0.5, 0.3, 0.3);
            ctx.fillStyle = colors[1];
            ctx.fillRect(bx + 0.5, by + 0.15, 0.25, 0.25);
            ctx.fillRect(bx + 0.15, by + 0.5, 0.25, 0.25);
            break;
        case 6: // S: chanfro escuro com quatro rebites nos cantos
            ctx.fillStyle = colors[3];
            ctx.fillRect(bx + 0.1, by + 0.1, 0.75, 0.75);
            ctx.fillStyle = colors[1];
            ctx.fillRect(bx + 0.18, by + 0.18, 0.16, 0.16);
            ctx.fillRect(bx + 0.6, by + 0.18, 0.16, 0.16);
            ctx.fillRect(bx + 0.18, by + 0.6, 0.16, 0.16);
            ctx.fillRect(bx + 0.6, by + 0.6, 0.16, 0.16);
            break;
        default: // 7 (T): chanfro elevado clássico com brilho superior esquerdo
            ctx.fillStyle = colors[2];
            ctx.fillRect(bx + 0.08, by + 0.08, 0.79, 0.79);
            ctx.fillStyle = colors[4];
            ctx.fillRect(bx + 0.12, by + 0.12, 0.65, 0.14);
            ctx.fillRect(bx + 0.12, by + 0.12, 0.14, 0.65);
            ctx.fillStyle = colors[1];
            ctx.fillRect(bx + 0.35, by + 0.35, 0.26, 0.26);
            break;
    }
}

function drawPiece(ctx, type, rot, ox, oy) {
    const id = TYPE_ID[type];
    for (const [cx, cy] of cellsOf(type, rot)) drawBlock(ctx, ox + cx, oy + cy, id);
}

function ghostY() {
    let y = player.y;
    while (!collides(player.type, player.rot, player.x, y + 1)) y++;
    return y;
}

function draw() {
    context.save();
    if (fx.shake > 0) context.translate(0, fx.shake * 0.12);

    // Clear screen with "screen bg" color
    context.fillStyle = colors[3];
    context.fillRect(0, -1, COLS, VISIBLE_ROWS + 2);

    // Grade sutil da matriz LCD
    context.fillStyle = 'rgba(15, 56, 15, 0.065)';
    for (let y = 0; y < VISIBLE_ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            context.fillRect(x + 0.04, y + 0.04, 0.9, 0.9);
        }
    }

    // Rastro da queda rápida: colunas que a peça atravessou, sumindo.
    if (fx.trail && fx.trail.t > 0) {
        const t = fx.trail;
        context.globalAlpha = 0.28 * t.t;
        context.fillStyle = colors[2];
        const top = Math.max(0, t.top);
        context.fillRect(t.x0 + 0.1, top, t.x1 - t.x0 - 0.2, Math.max(0, t.bottom - top));
        context.globalAlpha = 1;
    }

    for (let y = HIDDEN_ROWS; y < ROWS; y++) {
        const row = arena[y];
        for (let x = 0; x < COLS; x++) {
            if (row[x] !== 0) drawBlock(context, x, y - HIDDEN_ROWS, row[x]);
        }
    }

    // Brilho curto nas células que acabaram de travar.
    if (fx.lockFlash > 0) {
        context.globalAlpha = 0.45 * fx.lockFlash;
        context.fillStyle = colors[4];
        for (let i = 0; i < fx.lockCells.length; i += 2) {
            context.fillRect(fx.lockCells[i], fx.lockCells[i + 1], 0.95, 0.95);
        }
        context.globalAlpha = 1;
    }

    // Linhas completas: varredura do centro para as bordas antes de recolher.
    if (clearing) {
        const progress = 1 - clearing.timer / CLEAR_DELAY;
        const half = (COLS / 2) * Math.min(1, progress * 1.4);
        for (const y of clearing.rows) {
            const vy = y - HIDDEN_ROWS;
            context.fillStyle = colors[4];
            context.fillRect(0, vy, COLS, 1);
            context.fillStyle = colors[3];
            context.fillRect(COLS / 2 - half, vy + 0.1, half * 2, 0.8);
        }
    }

    if (player.type) {
        if (settings.ghost) drawGhost();
        drawPiece(context, player.type, player.rot, player.x, player.y - HIDDEN_ROWS);
    }
    context.restore();
}

/* Sombra da peça na posição de pouso: reduz o erro de encaixe, sobretudo
   no toque, sem sair da paleta de 4 tons do Game Boy. */
function drawGhost() {
    const gy = ghostY();
    if (gy === player.y) return;
    const cells = cellsOf(player.type, player.rot);
    const oy = gy - HIDDEN_ROWS;

    // Ghost pontilhado estilo LCD clássico
    context.globalAlpha = 0.2;
    context.fillStyle = colors[2];
    for (const [cx, cy] of cells) context.fillRect(player.x + cx + 0.1, oy + cy + 0.1, 0.78, 0.78);
    context.globalAlpha = 0.85;
    context.strokeStyle = colors[1];
    context.lineWidth = 0.07;
    context.setLineDash([0.16, 0.12]);
    for (const [cx, cy] of cells) context.strokeRect(player.x + cx + 0.1, oy + cy + 0.1, 0.78, 0.78);
    context.setLineDash([]);
    context.globalAlpha = 1;
}

/* Miniaturas centradas na caixa (4 unidades de largura). */
function drawMini(ctx, type, centerY, dim = false) {
    const cells = cellsOf(type, 0);
    let minX = 4, maxX = 0, minY = 4, maxY = 0;
    for (const [x, y] of cells) {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    const scale = 0.8;
    const w = (maxX - minX + 1) * scale;
    const h = (maxY - minY + 1) * scale;
    ctx.save();
    ctx.translate((4 - w) / 2, centerY - h / 2);
    ctx.scale(scale, scale);
    if (dim) ctx.globalAlpha = 0.35;
    for (const [x, y] of cells) drawBlock(ctx, x - minX, y - minY, TYPE_ID[type]);
    ctx.restore();
}

function drawNext() {
    nextContext.fillStyle = colors[3];
    nextContext.fillRect(0, 0, 4, 10);
    for (let i = 0; i < NEXT_COUNT && i < queue.length; i++) {
        drawMini(nextContext, queue[i], 1.6 + i * 3.3);
    }
}

function drawHold() {
    holdContext.fillStyle = colors[3];
    holdContext.fillRect(0, 0, 4, 2.4);
    if (holdType) drawMini(holdContext, holdType, 1.2, holdUsed);
    holdCanvas.setAttribute('aria-label', holdType ? `Peça guardada: ${holdType}` : 'Peça guardada: nenhuma');
}

/* --- Entrada: DAS/ARR e queda suave ---------------------------------------- */
const input = {
    left: false,
    right: false,
    soft: false,
    dir: 0,        // direção ativa (a última apertada)
    dasTimer: 0,
    arrTimer: 0,
    charged: false,
};

function canAct() {
    return state === 'playing' && !clearing && player.type !== null;
}

function pressDir(dir) {
    if (dir < 0) input.left = true; else input.right = true;
    input.dir = dir;
    input.dasTimer = 0;
    input.arrTimer = 0;
    input.charged = false;
    if (tryMove(dir)) sfx('move');
}

function releaseDir(dir) {
    if (dir < 0) input.left = false; else input.right = false;
    if (input.dir !== dir) return;
    const other = dir < 0 ? (input.right ? 1 : 0) : (input.left ? -1 : 0);
    input.dir = other;
    input.dasTimer = 0;
    input.arrTimer = 0;
    input.charged = false;
}

function releaseAllInput() {
    input.left = input.right = input.soft = false;
    input.dir = 0;
    input.dasTimer = input.arrTimer = 0;
    input.charged = false;
}

function updateAutoShift(dt) {
    if (!input.dir) return;
    input.dasTimer += dt;
    if (!input.charged) {
        if (input.dasTimer < settings.das) return;
        input.charged = true;
        input.arrTimer = settings.arr; // primeiro passo assim que o DAS carrega
    }
    if (!canAct()) return;
    if (settings.arr === 0) {
        while (tryMove(input.dir)) { /* ARR 0: direto à parede */ }
        return;
    }
    input.arrTimer += dt;
    let guard = 0;
    while (input.arrTimer >= settings.arr && guard++ < 10) {
        input.arrTimer -= settings.arr;
        if (!tryMove(input.dir)) {
            input.arrTimer = 0;
            break;
        }
    }
}

/* --- Laço ----------------------------------------------------------------- */
let lastTime = 0;

function tick(time) {
    // dt limitado: um quadro longo (GC, aba lenta) não despeja 10 linhas de uma vez.
    const dt = lastTime ? Math.min(time - lastTime, 50) : 16.7;
    lastTime = time;

    if (state === 'playing') simulate(dt);

    // Efeitos decaem em tempo real.
    let animating = false;
    if (fx.lockFlash > 0) { fx.lockFlash = Math.max(0, fx.lockFlash - dt / 140); animating = true; }
    if (fx.trail && fx.trail.t > 0) { fx.trail.t = Math.max(0, fx.trail.t - dt / 180); animating = true; }
    if (fx.shake > 0) { fx.shake = Math.max(0, fx.shake - dt / 110); animating = true; }

    if (boardDirty || animating || clearing) {
        draw();
        boardDirty = false;
    }
}

function simulate(dt) {
    if (clearing) {
        clearing.timer -= dt;
        // O DAS continua carregando durante a animação (como nos jogos modernos).
        if (input.dir) {
            input.dasTimer += dt;
            if (input.dasTimer >= settings.das) input.charged = true;
        }
        if (clearing.timer <= 0) finishClear();
        return;
    }
    if (!player.type) return;

    updateAutoShift(dt);
    if (!player.type || state !== 'playing') return;

    // Gravidade (ou queda suave).
    const gravityMs = gravitySeconds(player.level) * 1000;
    const soft = input.soft;
    if (soft && settings.sdf === 0) {
        // Queda suave instantânea: desce até encostar sem travar.
        const before = player.y;
        while (stepDown()) { /* desce */ }
        player.score += player.y - before;
        if (player.y !== before) updateScore();
    } else {
        const interval = soft ? Math.max(1000 / 120, gravityMs / settings.sdf) : gravityMs;
        gravityTimer += dt;
        let guard = 0;
        while (gravityTimer >= interval && guard++ < 25) {
            gravityTimer -= interval;
            if (!stepDown()) {
                gravityTimer = 0;
                break;
            }
            if (soft) {
                player.score += 1;
                updateScore();
            }
        }
    }

    // Trava com atraso.
    if (isGrounded()) {
        lockTimer += dt;
        if (lockTimer >= MODES[mode].lockDelay) lockPiece();
    } else {
        lockTimer = 0;
    }
}

const labLoop = window.LabRuntime ? LabRuntime.createLoop(tick) : null;
let rafId = 0;

function rafStep(time) {
    tick(time);
    rafId = requestAnimationFrame(rafStep);
}

function startLoop() {
    lastTime = 0;
    if (labLoop) {
        labLoop.start();
        return;
    }
    if (!rafId) rafId = requestAnimationFrame(rafStep);
}

/* --- HUD e recorde --------------------------------------------------------- */
const scoreEl = document.getElementById('score');
const levelEl = document.getElementById('level');
const linesEl = document.getElementById('lines');
const highEl = document.getElementById('highscore');

function updateScore() {
    scoreEl.textContent = player.score;
    levelEl.textContent = player.level;
    linesEl.textContent = player.lines;

    if (player.score > highScore) {
        highScore = player.score;
        highEl.textContent = highScore;
        saveHighScore(highScore);
    }
}

function loadHighScore() {
    try {
        return Number(localStorage.getItem(HIGHSCORE_KEY)) || 0;
    } catch (err) {
        /* localStorage pode estar bloqueado em navegação privada. */
        return 0;
    }
}

function saveHighScore(value) {
    try {
        localStorage.setItem(HIGHSCORE_KEY, String(value));
    } catch (err) {
        /* Sem persistência: o recorde vale só para esta sessão. */
    }
}

/* ---------- Estado e overlay ---------- */

const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlayText = document.getElementById('overlayText');
const overlayModes = document.getElementById('overlayModes');
const overlayHint = document.getElementById('overlayHint');
const overlayGo = document.getElementById('overlayGo');
const overlayMenu = document.getElementById('overlayMenu');
const overlayRestart = document.getElementById('overlayRestart');
const overlaySettings = document.getElementById('overlaySettings');
const gameStatus = document.getElementById('gameStatus');

function announce(message) {
    gameStatus.textContent = message;
}

/* `view`: 'menu' (escolha de modo), 'paused' ou 'over'. Cada uma mostra só os
   botões que fazem sentido ali — um botão grande para a próxima ação. */
function setOverlay(title, text, view = 'menu', hint = '') {
    overlayTitle.textContent = title;
    overlayText.textContent = text;
    overlayModes.hidden = view !== 'menu';
    overlayMenu.hidden = view !== 'over';
    overlayRestart.hidden = view !== 'paused';
    overlaySettings.hidden = view === 'over';
    overlayHint.textContent = view === 'menu' ? MODES[mode].hint : hint;
    overlayHint.hidden = !overlayHint.textContent;
    overlayGo.textContent = view === 'paused' ? '▶ CONTINUAR' : view === 'over' ? '↻ JOGAR DE NOVO' : '▶ JOGAR';
    overlay.hidden = false;
}

function setMode(next) {
    if (!(next in MODES)) return;
    mode = next;
    try {
        localStorage.setItem(MODE_KEY, mode);
    } catch (err) {
        /* Sem storage o modo vale só nesta visita. */
    }
    syncModeButtons();
    if (state === 'ready') overlayHint.textContent = MODES[mode].hint;
}

function syncModeButtons() {
    overlayModes.querySelectorAll('[data-mode]').forEach(btn => {
        btn.setAttribute('aria-pressed', String(btn.dataset.mode === mode));
    });
}

function setState(next) {
    state = next;
    releaseAllInput();
    gesture = null;
    boardDirty = true;
    lastTime = 0;

    if (state === 'ready') {
        setOverlay('TETRIS', 'Encaixe as peças e complete linhas!');
        announce('Escolha o modo e pressione Jogar, Start ou Enter para começar.');
    } else if (state === 'playing') {
        overlay.hidden = true;
        announce('Partida em andamento.');
    } else if (state === 'paused') {
        setOverlay('PAUSA', 'Respire! A peça espera.', 'paused');
        announce('Jogo pausado.');
        overlayGo.focus({ preventScroll: true });
    } else if (state === 'over') {
        const record = player.score > highScoreAtStart && player.score > 0;
        setOverlay('FIM DE JOGO', `${player.score} pontos · ${player.lines} linhas`, 'over',
            record ? '★ NOVO RECORDE! ★' : `Melhor: ${highScore}`);
        announce(`Fim de jogo. ${player.score} pontos em ${player.lines} linhas.`);
        overlayGo.focus({ preventScroll: true });
    }
}

function resetGame() {
    arena.forEach(row => row.fill(0));
    player.score = 0;
    player.lines = 0;
    player.level = 1;
    player.type = null;
    queue = [];
    bag = [];
    holdType = null;
    holdUsed = false;
    combo = -1;
    backToBack = false;
    clearing = null;
    fx.lockFlash = 0;
    fx.trail = null;
    fx.shake = 0;
    actionText.classList.remove('show');
    fillQueue();
    updateScore();
    drawHold();
    drawNext();
}

function startGame() {
    highScoreAtStart = highScore;
    resetGame();
    sfx('start');
    setState('playing');
    spawnNext();
}

function gameOver() {
    player.type = null;
    clearing = null;
    sfx('over');
    buzz([40, 60, 120]);
    setState('over');
    draw();
}

/* Start faz o papel do botão do console: começa, pausa e retoma. */
function toggleStartPause() {
    if (settingsDialog.open) return;
    if (state === 'playing') setState('paused');
    else if (state === 'paused') setState('playing');
    else startGame();
}

/* ---------- Teclado ---------- */

const KEY_ACTIONS = {
    ArrowLeft: 'left',
    KeyA: 'left',
    ArrowRight: 'right',
    KeyD: 'right',
    ArrowDown: 'soft',
    KeyS: 'soft',
    ArrowUp: 'cw',
    KeyX: 'cw',
    KeyW: 'cw',
    KeyZ: 'ccw',
    KeyQ: 'ccw',
    ControlLeft: 'ccw',
    ControlRight: 'ccw',
    Space: 'hard',
    KeyC: 'hold',
    ShiftLeft: 'hold',
    ShiftRight: 'hold',
};

function pressAction(action) {
    if (state !== 'playing') return;
    switch (action) {
        case 'left': pressDir(-1); break;
        case 'right': pressDir(1); break;
        case 'soft':
            // A queda suave responde no mesmo quadro: 1 linha já no aperto.
            input.soft = true;
            gravityTimer = 0;
            if (canAct() && settings.sdf !== 0 && stepDown()) {
                player.score += 1;
                updateScore();
            }
            break;
        case 'cw': tryRotate(1); break;
        case 'ccw': tryRotate(-1); break;
        case 'hard': hardDrop(); break;
        case 'hold': holdPiece(); break;
    }
}

function releaseAction(action) {
    if (action === 'left') releaseDir(-1);
    else if (action === 'right') releaseDir(1);
    else if (action === 'soft') {
        input.soft = false;
        gravityTimer = 0;
    }
}

document.addEventListener('keydown', event => {
    if (settingsDialog.open) return;
    const action = KEY_ACTIONS[event.code];
    const isCtrlKey = event.code === 'ControlLeft' || event.code === 'ControlRight';
    if (!isCtrlKey && (event.ctrlKey || event.metaKey || event.altKey)) return;
    /* Com um botão focado *pelo teclado*, Enter/Espaço continuam ativando o
       botão. Depois de um clique de mouse o foco não conta: ali o jogador
       espera o atalho global (Espaço = queda rápida). */
    const onFocusedControl = event.target instanceof Element
        && event.target.closest('button, a, input, select')?.matches(':focus-visible')
        && (event.code === 'Enter' || event.code === 'Space');
    if (onFocusedControl) return;

    if (event.code === 'Enter' || event.code === 'KeyP' || event.code === 'Escape' || event.code === 'F1') {
        event.preventDefault();
        if (!event.repeat) toggleStartPause();
        return;
    }

    if (event.code === 'KeyR') {
        event.preventDefault();
        if (!event.repeat) startGame();
        return;
    }

    if (!action) return;
    event.preventDefault();
    if (event.repeat) return; // o DAS/ARR do jogo é mais previsível que o do SO
    pressAction(action);
});

document.addEventListener('keyup', event => {
    const action = KEY_ACTIONS[event.code];
    if (action) releaseAction(action);
});

/* ---------- Botões do console (mouse e toque) ---------- */

function bindHold(selector, action) {
    const el = document.querySelector(selector);
    if (!el) return;
    let active = false;

    el.addEventListener('pointerdown', event => {
        event.preventDefault();
        capturePointer(el, event.pointerId);
        active = true;
        pressAction(action);
    });

    const stop = () => {
        if (!active) return;
        active = false;
        releaseAction(action);
    };
    el.addEventListener('pointerup', stop);
    el.addEventListener('pointercancel', stop);
    el.addEventListener('lostpointercapture', stop);
    /* Teclado: o botão continua acionável por Enter/Espaço via clique. */
    el.addEventListener('click', event => {
        if (event.detail === 0) {
            pressAction(action);
            releaseAction(action);
        }
    });
}

bindHold('.d-pad .left', 'left');
bindHold('.d-pad .right', 'right');
bindHold('.d-pad .down', 'soft');
bindHold('.d-pad .up', 'hard');
bindHold('.btn-a', 'cw');
bindHold('.btn-b', 'ccw');
bindHold('.btn-select', 'hold');

/* --- Gestos na tela --------------------------------------------------------
   No celular o polegar cobre metade do console; arrastar na própria tela é o
   controle principal (o mesmo esquema dos Tetris de celular):
     · horizontal         → move coluna a coluna, acompanhando o dedo
     · para baixo devagar → queda suave, 1 linha por célula arrastada
     · para baixo rápido  → queda rápida (flick ≥ 0,9 px/ms)
     · para cima          → guarda a peça
     · toque curto        → gira no sentido horário
   O d-pad continua funcionando para quem prefere (e para o mouse). */
const screenEl = document.querySelector('.screen');
const FLICK_MIN = 42;        // px verticais para valer como deslize
const FLICK_SPEED = 0.9;     // px/ms para a queda rápida
let gesture = null;

function cellCssSize() {
    const rect = canvas.getBoundingClientRect();
    return Math.max(14, rect.width / COLS);
}

if (screenEl) {
    screenEl.addEventListener('pointerdown', event => {
        // Em Safari/iOS o toque às vezes chega com button === -1; só o mouse
        // deve filtrar botão auxiliar.
        if (gesture || (event.pointerType === 'mouse' && event.button !== 0)) return;
        // Botões do overlay (modo, jogar, continuar) cuidam do próprio clique.
        if (event.target.closest('button')) return;
        capturePointer(screenEl, event.pointerId);
        const now = performance.now();
        gesture = {
            pointerId: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            softY: event.clientY,
            t: now,
            lastY: event.clientY,
            lastT: now,
            movedCols: 0,
            done: false,
            acted: false,
        };
    });

    screenEl.addEventListener('pointermove', event => {
        if (gesture?.pointerId !== event.pointerId || state !== 'playing') return;

        const now = performance.now();
        const step = cellCssSize();
        const deltaX = event.clientX - gesture.x;
        const deltaY = event.clientY - gesture.y;
        const speedY = (event.clientY - gesture.lastY) / Math.max(1, now - gesture.lastT);
        gesture.lastY = event.clientY;
        gesture.lastT = now;
        if (gesture.done) return;

        // Colunas ainda não consumidas deste arrasto.
        const wantCols = Math.trunc(deltaX / step);
        if (wantCols !== gesture.movedCols) {
            const steps = wantCols - gesture.movedCols;
            for (let i = 0; i < Math.abs(steps); i++) tryMove(Math.sign(steps));
            gesture.movedCols = wantCols;
            gesture.acted = true;
        }

        const vertical = Math.abs(deltaY) > Math.abs(deltaX) * 1.2;
        if (!vertical) return;

        if (deltaY > FLICK_MIN && speedY > FLICK_SPEED) {
            hardDrop();
            gesture.done = true;
            gesture.acted = true;
        } else if (deltaY < -FLICK_MIN) {
            holdPiece();
            gesture.done = true;
            gesture.acted = true;
        } else if (event.clientY - gesture.softY > step) {
            // Queda suave acompanhando o dedo: uma linha por célula arrastada.
            const rows = Math.floor((event.clientY - gesture.softY) / step);
            for (let i = 0; i < rows; i++) {
                if (!canAct() || !stepDown()) break;
                player.score += 1;
            }
            gesture.softY += rows * step;
            updateScore();
            gesture.acted = true;
        }
    });

    const endGesture = event => {
        if (gesture?.pointerId !== event.pointerId) return;
        const quick = performance.now() - gesture.t < 320;
        if (!gesture.acted) {
            // Toque curto: gira se estiver jogando; no menu/pausa faz o papel do Start.
            if (state === 'playing') {
                if (quick) tryRotate(1);
            } else if (state !== 'over') {
                toggleStartPause();
            }
        }
        gesture = null;
    };

    screenEl.addEventListener('pointerup', endGesture);
    const cancelGesture = event => {
        if (gesture?.pointerId === event.pointerId) gesture = null;
    };
    screenEl.addEventListener('pointercancel', cancelGesture);
    screenEl.addEventListener('lostpointercapture', cancelGesture);
}

if (window.LabAudio) {
    window.LabAudio.configure({ storageKey: 'tetris90s:muted', volume: 0.45 });
    window.LabAudio.mountToggle('[data-lab-header] .header-actions');
}

document.querySelector('.btn-start').addEventListener('click', toggleStartPause);

overlayModes.querySelectorAll('[data-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
        setMode(btn.dataset.mode);
        sfx('rotate');
    });
});
overlayGo.addEventListener('click', toggleStartPause);
overlayRestart.addEventListener('click', startGame);
overlayMenu.addEventListener('click', () => {
    resetGame();
    setState('ready');
});

/* Depois de um clique/toque o botão devolve o foco: senão a próxima tecla
   Espaço ativaria o botão focado em vez de soltar a peça. */
document.querySelectorAll('.controls button').forEach(button => {
    button.addEventListener('click', event => {
        if (event.detail > 0) button.blur();
    });
});

/* Sair da aba ou da janela: pausa e solta as teclas (um keyup perdido deixava
   a peça escorregando sozinha para a parede). */
function autoPause() {
    releaseAllInput();
    if (state === 'playing') setState('paused');
}
document.addEventListener('visibilitychange', () => {
    if (document.hidden) autoPause();
});
window.addEventListener('blur', autoPause);

/* ---------- Ajustes ---------- */

const settingsDialog = document.getElementById('settings');
const setDas = document.getElementById('setDas');
const setArr = document.getElementById('setArr');
const setSdf = document.getElementById('setSdf');
const setGhost = document.getElementById('setGhost');
const setHaptics = document.getElementById('setHaptics');
const outDas = document.getElementById('outDas');
const outArr = document.getElementById('outArr');

function syncSettingsForm() {
    setDas.value = settings.das;
    setArr.value = settings.arr;
    setSdf.value = String(settings.sdf);
    setGhost.checked = settings.ghost;
    setHaptics.checked = settings.haptics;
    outDas.textContent = `${settings.das} ms`;
    outArr.textContent = settings.arr === 0 ? 'instantâneo' : `${settings.arr} ms`;
}

function readSettingsForm() {
    settings.das = clampNumber(setDas.value, 50, 300, DEFAULT_SETTINGS.das);
    settings.arr = clampNumber(setArr.value, 0, 100, DEFAULT_SETTINGS.arr);
    settings.sdf = Number(setSdf.value);
    settings.ghost = setGhost.checked;
    settings.haptics = setHaptics.checked;
    saveSettings();
    syncSettingsForm();
    boardDirty = true;
    draw();
}

[setDas, setArr, setSdf, setGhost, setHaptics].forEach(el => {
    el.addEventListener('input', readSettingsForm);
    el.addEventListener('change', readSettingsForm);
});
document.getElementById('setReset').addEventListener('click', () => {
    Object.assign(settings, DEFAULT_SETTINGS);
    saveSettings();
    syncSettingsForm();
    boardDirty = true;
});

overlaySettings.addEventListener('click', () => {
    if (state === 'playing') setState('paused');
    syncSettingsForm();
    try {
        settingsDialog.showModal();
    } catch (err) {
        settingsDialog.setAttribute('open', '');
    }
});
settingsDialog.addEventListener('close', () => {
    (state === 'paused' || state === 'ready' ? overlayGo : document.body).focus?.({ preventScroll: true });
});
// Clique fora do cartão fecha (o <dialog> ocupa a tela inteira no backdrop).
settingsDialog.addEventListener('click', event => {
    if (event.target === settingsDialog) settingsDialog.close();
});

/* ---------- Escala do console ---------- */

/* O console é desenhado numa base fixa (retrato 360×640, paisagem 640×330).
   A escala é calculada aqui (e não em CSS) porque `calc()` não divide
   comprimento por comprimento para produzir o fator sem unidade de `scale()`.
   Cabe na largura e na altura que sobra abaixo do header; as instruções e o
   rodapé ficam logo abaixo (rolam, se faltar espaço). */
const CONSOLE_BASE = { portrait: [360, 640], landscape: [640, 330] };
const gameBoy = document.querySelector('.game-boy');

function fitConsole() {
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = window.visualViewport?.height || document.documentElement.clientHeight;

    /* Em paisagem curta o CSS troca o console para o formato widescreen; a
       base usada no cálculo precisa acompanhar. */
    const shortLandscape = viewportHeight <= 520 && viewportWidth > viewportHeight;
    const [baseWidth, baseHeight] = shortLandscape ? CONSOLE_BASE.landscape : CONSOLE_BASE.portrait;

    const top = gameBoy.getBoundingClientRect().top + window.scrollY;
    // No desktop sobra espaço para a linha de atalhos logo abaixo do console.
    const reserve = shortLandscape ? 8 : viewportHeight > 760 ? 56 : 14;

    const scale = Math.min(
        1.2,
        (viewportWidth - 20) / baseWidth,
        (viewportHeight - top - reserve) / baseHeight
    );

    gameBoy.style.setProperty('--device-scale', Math.max(scale, 0.5).toFixed(3));
    gameBoy.style.setProperty('--device-base-height', `${baseHeight}px`);
    requestAnimationFrame(resizeCanvases);
}

let fitTimer = 0;
function scheduleFit() {
    clearTimeout(fitTimer);
    fitTimer = setTimeout(fitConsole, 60);
}
window.addEventListener('resize', scheduleFit);
window.addEventListener('orientationchange', scheduleFit);
window.visualViewport?.addEventListener('resize', scheduleFit);

if (window.LabTheme) {
    LabTheme.onChange(() => {
        syncPalette();
        boardDirty = true;
        draw();
        drawNext();
        drawHold();
    });
} else {
    new MutationObserver(() => {
        syncPalette();
        boardDirty = true;
        draw();
        drawNext();
        drawHold();
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}

highEl.textContent = highScore;
syncModeButtons();
syncSettingsForm();
resetGame();
setState('ready');
fitConsole();
startLoop();
// A fonte em pixel muda a altura do header ao carregar: refaz a escala.
document.fonts?.ready.then(fitConsole).catch(() => {});
