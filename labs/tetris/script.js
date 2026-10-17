const canvas = document.getElementById('tetris');
const context = canvas.getContext('2d');
const nextCanvas = document.getElementById('next');
const nextContext = nextCanvas.getContext('2d');

const COLS = 10;
const ROWS = 20;
const CELL = canvas.width / COLS; // 20px por célula no buffer do canvas

// Scale everything up
context.scale(CELL, CELL);
nextContext.scale(CELL, CELL);

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

/* --- Som -------------------------------------------------------------------
   Timbre de chip: quadrada curta para os controles, arpejo para as linhas.
   O motor vem do LabAudio (labs/shared.js), então o mudo é persistido e
   compartilhado com os outros labs. */
const audio = window.LabAudio;

function sfx(name) {
    if (!audio) return;
    switch (name) {
        case 'move':
            audio.tone({ freq: 220, duration: 0.03, gain: 0.06 });
            break;
        case 'rotate':
            audio.tone({ freq: 440, duration: 0.05, gain: 0.08 });
            break;
        case 'lock':
            audio.noise({ duration: 0.07, gain: 0.09, filter: 900 });
            break;
        case 'drop':
            audio.tone({ freq: 520, duration: 0.12, gain: 0.1, slideTo: 120, type: 'square' });
            break;
        case 'line':
            audio.sequence([523, 659, 784], { step: 0.05, duration: 0.09, gain: 0.12 });
            break;
        case 'tetris':
            // Quatro linhas de uma vez merecem a fanfarra completa.
            audio.sequence([523, 659, 784, 1047, 1319], { step: 0.06, duration: 0.14, gain: 0.14 });
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

// Tetromino definitions (1..7 para padrões clássicos distintos estilo Game Boy)
const pieces = 'ILJOTSZ';
const piecesMap = {
    'I': [
        [0, 1, 0, 0],
        [0, 1, 0, 0],
        [0, 1, 0, 0],
        [0, 1, 0, 0],
    ],
    'L': [
        [0, 2, 0],
        [0, 2, 0],
        [0, 2, 2],
    ],
    'J': [
        [0, 3, 0],
        [0, 3, 0],
        [3, 3, 0],
    ],
    'O': [
        [4, 4],
        [4, 4],
    ],
    'Z': [
        [5, 5, 0],
        [0, 5, 5],
        [0, 0, 0],
    ],
    'S': [
        [0, 6, 6],
        [6, 6, 0],
        [0, 0, 0],
    ],
    'T': [
        [0, 7, 0],
        [7, 7, 7],
        [0, 0, 0],
    ],
};

/* Pontuação clássica por linhas simultâneas, multiplicada pelo nível. */
const LINE_SCORE = [0, 100, 300, 500, 800];
const HIGHSCORE_KEY = 'tetris90s:highscore';

function createPiece(type) {
    return piecesMap[type].map(row => row.slice());
}

function randomPiece() {
    return createPiece(pieces[pieces.length * Math.random() | 0]);
}

function arenaSweep() {
    let cleared = 0;
    /* Varre da última linha até a primeira (inclusive): a linha 0 também
       precisa ser elegível quando a pilha chega ao topo. */
    outer: for (let y = arena.length - 1; y >= 0; --y) {
        for (let x = 0; x < arena[y].length; ++x) {
            if (arena[y][x] === 0) {
                continue outer;
            }
        }

        const row = arena.splice(y, 1)[0].fill(0);
        arena.unshift(row);
        ++y;
        ++cleared;
    }

    if (cleared > 0) {
        const previousLevel = player.level;
        player.lines += cleared;
        player.score += LINE_SCORE[cleared] * player.level;
        player.level = Math.floor(player.lines / 10) + 1;
        // Flash das linhas: decai por frame em `draw`, fora da simulação.
        clearFlash = 1;
        clearFlashRows = cleared;
        sfx(cleared === 4 ? 'tetris' : 'line');
        if (player.level > previousLevel) sfx('level');
        updateScore();
    } else {
        sfx('lock');
    }
}

function collide(arena, player) {
    const m = player.matrix;
    const o = player.pos;
    for (let y = 0; y < m.length; ++y) {
        for (let x = 0; x < m[y].length; ++x) {
            if (m[y][x] !== 0 &&
                (arena[y + o.y] &&
                    arena[y + o.y][x + o.x]) !== 0) {
                return true;
            }
        }
    }
    return false;
}

function createMatrix(w, h) {
    const matrix = [];
    while (h--) {
        matrix.push(new Array(w).fill(0));
    }
    return matrix;
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

function drawMatrix(matrix, offset, ctx = context) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                drawBlock(ctx, x + offset.x, y + offset.y, value);
            }
        });
    });
}

/* Feedback visual de linha completa: um clarão que decai por frame. Vive fora
   do estado do jogo, então nunca muda a simulação. */
let clearFlash = 0;
let clearFlashRows = 0;

function draw() {
    // Clear screen with "screen bg" color
    context.fillStyle = colors[3];
    context.fillRect(0, 0, COLS, ROWS);

    // Grade sutil da matriz LCD
    context.fillStyle = 'rgba(15, 56, 15, 0.065)';
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            context.fillRect(x + 0.04, y + 0.04, 0.9, 0.9);
        }
    }

    drawMatrix(arena, { x: 0, y: 0 });
    if (player.matrix) {
        drawGhost();
        drawMatrix(player.matrix, player.pos);
    }

    if (clearFlash > 0) {
        // Quatro linhas piscam mais forte que uma: o clarão conta quanto valeu.
        const intensity = clearFlash * (0.35 + clearFlashRows * 0.12);
        context.globalAlpha = Math.min(0.85, intensity);
        context.fillStyle = colors[4];
        context.fillRect(0, 0, COLS, ROWS);
        context.globalAlpha = 1;
    }
}

/* Sombra da peça na posição de pouso: reduz o erro de encaixe, sobretudo
   no toque, sem sair da paleta de 4 tons do Game Boy. */
function drawGhost() {
    const startY = player.pos.y;
    while (!collide(arena, player)) {
        player.pos.y++;
    }
    player.pos.y--;
    const ghostY = player.pos.y;
    player.pos.y = startY;

    if (ghostY === startY) return;

    // Ghost pontilhado estilo LCD clássico
    context.save();
    context.globalAlpha = 0.2;
    context.fillStyle = colors[2];
    player.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                context.fillRect(x + player.pos.x + 0.1, y + ghostY + 0.1, 0.78, 0.78);
            }
        });
    });
    context.globalAlpha = 0.85;
    context.strokeStyle = colors[1];
    context.lineWidth = 0.07;
    context.setLineDash([0.16, 0.12]);
    player.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                context.strokeRect(x + player.pos.x + 0.1, y + ghostY + 0.1, 0.78, 0.78);
            }
        });
    });
    context.restore();
}

function drawNext() {
    nextContext.fillStyle = colors[3];
    nextContext.fillRect(0, 0, 4, 4);

    if (!player.next) return;

    // Center the next piece
    const matrix = player.next;
    const offset = {
        x: (4 - matrix[0].length) / 2,
        y: (4 - matrix.length) / 2
    };
    drawMatrix(matrix, offset, nextContext);
}

function merge(arena, player) {
    player.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                arena[y + player.pos.y][x + player.pos.x] = value;
            }
        });
    });
}

function rotate(matrix, dir) {
    for (let y = 0; y < matrix.length; ++y) {
        for (let x = 0; x < y; ++x) {
            [
                matrix[x][y],
                matrix[y][x],
            ] = [
                    matrix[y][x],
                    matrix[x][y],
                ];
        }
    }

    if (dir > 0) {
        matrix.forEach(row => row.reverse());
    } else {
        matrix.reverse();
    }
}

function playerDrop(soft = false) {
    if (state !== 'playing') return;

    player.pos.y++;
    if (collide(arena, player)) {
        player.pos.y--;
        lockPiece();
    } else if (soft) {
        player.score += 1;
        updateScore();
    }
    dropCounter = 0;
}

/* Queda rápida: desce até colidir e trava na hora, somando 2 por linha. */
function playerHardDrop() {
    if (state !== 'playing') return;

    let distance = 0;
    while (!collide(arena, player)) {
        player.pos.y++;
        distance++;
    }
    player.pos.y--;
    distance--;

    if (distance > 0) {
        player.score += distance * 2;
        sfx('drop');
    }
    lockPiece();
    dropCounter = 0;
}

function lockPiece() {
    merge(arena, player);
    arenaSweep();
    playerReset();
    updateScore();
}

function playerMove(offset) {
    if (state !== 'playing') return;

    player.pos.x += offset;
    if (collide(arena, player)) {
        player.pos.x -= offset;
    } else {
        sfx('move');
    }
}

function playerReset() {
    if (player.next === null) {
        player.next = randomPiece();
    }
    player.matrix = player.next;
    player.next = randomPiece();

    player.pos.y = 0;
    player.pos.x = (arena[0].length / 2 | 0) -
        (player.matrix[0].length / 2 | 0);

    drawNext();

    /* Peça nova já nascendo em cima da pilha = fim de jogo. */
    if (collide(arena, player)) {
        gameOver();
    }
}

function playerRotate(dir) {
    if (state !== 'playing') return;

    const pos = player.pos.x;
    let offset = 1;
    rotate(player.matrix, dir);
    while (collide(arena, player)) {
        player.pos.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (offset > player.matrix[0].length) {
            rotate(player.matrix, -dir);
            player.pos.x = pos;
            return;
        }
    }
    sfx('rotate');
}

let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;
let state = 'ready'; // ready | playing | paused | over
let rafId = 0;

function tick(time = 0) {
    const deltaTime = Math.min(time - lastTime, 250);
    lastTime = time;

    if (state === 'playing') {
        dropCounter += deltaTime;
        if (dropCounter > dropInterval) {
            playerDrop();
        }
        handleAutoRepeat(deltaTime);
    }

    clearFlash = Math.max(0, clearFlash - deltaTime / 260);

    draw();
}

const labLoop = window.LabRuntime
    ? LabRuntime.createLoop(tick, { autoPause: false })
    : null;

function update(time = 0) {
    tick(time);
    rafId = requestAnimationFrame(update);
}

function startLoop() {
    if (labLoop) {
        labLoop.start();
        return;
    }
    if (rafId) return;
    lastTime = performance.now();
    rafId = requestAnimationFrame(update);
}

function stopLoop() {
    if (labLoop) {
        labLoop.stop();
        return;
    }
    if (!rafId) return;
    const id = rafId;
    rafId = 0;
    cancelAnimationFrame(id);
}

function updateScore() {
    document.getElementById('score').innerText = player.score;
    document.getElementById('level').innerText = player.level;
    document.getElementById('lines').innerText = player.lines;
    dropInterval = Math.max(100, 1000 - (player.level - 1) * 90);

    if (player.score > highScore) {
        highScore = player.score;
        document.getElementById('highscore').innerText = highScore;
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

const arena = createMatrix(COLS, ROWS);

const player = {
    pos: { x: 0, y: 0 },
    matrix: null,
    next: null,
    score: 0,
    lines: 0,
    level: 1,
};

let highScore = loadHighScore();

/* ---------- Estado e overlay ---------- */

const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlayText = document.getElementById('overlayText');
const gameStatus = document.getElementById('gameStatus');

function setOverlay(title, text, steady = false) {
    overlayTitle.textContent = title;
    overlayText.textContent = text;
    overlayText.classList.toggle('steady', steady);
    overlay.hidden = false;
}

function setState(next) {
    state = next;

    if (state === 'ready') {
        setOverlay('TETRIS', 'START para jogar');
        gameStatus.textContent = 'Pressione Start ou Enter para começar.';
    } else if (state === 'playing') {
        overlay.hidden = true;
        gameStatus.textContent = 'Partida em andamento.';
    } else if (state === 'paused') {
        setOverlay('PAUSA', 'START p/ voltar');
        gameStatus.textContent = 'Jogo pausado.';
    } else if (state === 'over') {
        setOverlay('FIM DE JOGO', `${player.score} PTS · START`, true);
        gameStatus.textContent = `Fim de jogo. ${player.score} pontos em ${player.lines} linhas.`;
    }
}

function resetGame() {
    arena.forEach(row => row.fill(0));
    player.score = 0;
    player.lines = 0;
    player.level = 1;
    player.next = null;
    player.matrix = null;
    dropCounter = 0;
    setState('ready');
    playerReset();
    updateScore();
}

function startGame() {
    resetGame();
    clearFlash = 0;
    sfx('start');
    setState('playing');
}

function gameOver() {
    player.matrix = null;
    sfx('over');
    setState('over');
}

/* Start faz o papel do botão do console: começa, pausa e retoma. */
function toggleStartPause() {
    if (state === 'playing') {
        setState('paused');
    } else if (state === 'paused') {
        setState('playing');
        lastTime = performance.now();
    } else {
        startGame();
    }
}

/* ---------- Teclado ---------- */

/* Repetição automática (DAS/ARR) para as teclas e botões mantidos
   pressionados: 170ms até o primeiro repeat, 55ms entre os seguintes. */
const AUTO_REPEAT_DELAY = 170;
const AUTO_REPEAT_RATE = 55;
const held = { left: 0, right: 0, down: 0 };
const holdTimers = { left: 0, right: 0, down: 0 };

function handleAutoRepeat(delta) {
    for (const action of ['left', 'right', 'down']) {
        if (!held[action]) continue;
        holdTimers[action] += delta;
        const threshold = held[action] === 1 ? AUTO_REPEAT_DELAY : AUTO_REPEAT_RATE;
        if (holdTimers[action] >= threshold) {
            holdTimers[action] = 0;
            held[action] = 2;
            if (action === 'left') playerMove(-1);
            else if (action === 'right') playerMove(1);
            else playerDrop(true);
        }
    }
}

function pressAction(action) {
    if (state !== 'playing' && (action === 'left' || action === 'right' || action === 'down')) return;

    if (action === 'left') playerMove(-1);
    else if (action === 'right') playerMove(1);
    else if (action === 'down') playerDrop(true);
    else if (action === 'rotate') playerRotate(1);
    else if (action === 'rotate-ccw') playerRotate(-1);
    else if (action === 'hard-drop') playerHardDrop();

    if (action in held) {
        held[action] = 1;
        holdTimers[action] = 0;
    }
}

function releaseAction(action) {
    if (action in held) {
        held[action] = 0;
        holdTimers[action] = 0;
    }
}

const KEY_ACTIONS = {
    ArrowLeft: 'left',
    ArrowRight: 'right',
    ArrowDown: 'down',
    ArrowUp: 'rotate',
    KeyW: 'rotate',
    KeyQ: 'rotate-ccw',
    KeyA: 'left',
    KeyD: 'right',
    KeyS: 'down',
    Space: 'hard-drop',
};

document.addEventListener('keydown', event => {
    /* Com um botão do console focado *pelo teclado*, Enter/Espaço continuam
       ativando o botão. Depois de um clique de mouse o foco não conta: ali o
       jogador espera o atalho global (Espaço = queda rápida). */
    const onConsoleButton = event.target instanceof Element
        && event.target.closest('.controls button')?.matches(':focus-visible')
        && (event.code === 'Enter' || event.code === 'Space');
    if (onConsoleButton) return;

    if (event.code === 'Enter' || event.code === 'KeyP' || event.code === 'Escape') {
        event.preventDefault();
        toggleStartPause();
        return;
    }

    if (event.code === 'KeyR') {
        event.preventDefault();
        startGame();
        return;
    }

    const action = KEY_ACTIONS[event.code];
    if (!action) return;

    event.preventDefault();
    if (event.repeat) return; // o repeat próprio do jogo é mais previsível
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

    el.addEventListener('pointerdown', event => {
        event.preventDefault();
        el.setPointerCapture?.(event.pointerId);
        pressAction(action);
    });

    const stop = () => releaseAction(action);
    el.addEventListener('pointerup', stop);
    el.addEventListener('pointercancel', stop);
    el.addEventListener('pointerleave', stop);
    /* Teclado: o botão continua acionável por Enter/Espaço via clique. */
    el.addEventListener('click', event => {
        if (event.detail === 0) pressAction(action);
    });
}

bindHold('.d-pad .left', 'left');
bindHold('.d-pad .right', 'right');
bindHold('.d-pad .down', 'down');
bindHold('.d-pad .up', 'rotate');
bindHold('.btn-a', 'rotate');
bindHold('.btn-b', 'hard-drop');

/* --- Gestos na tela --------------------------------------------------------
   No celular o d-pad desenhado tem ~34px e o polegar cobre metade do console.
   Arrastar na própria tela vira o controle principal:
     · horizontal  → move coluna a coluna, acompanhando o dedo
     · para baixo  → soft drop contínuo
     · para cima   → hard drop
     · toque curto → gira
   O d-pad continua funcionando para quem prefere (e para o mouse). */
const screenEl = document.querySelector('.screen');
const SWIPE_STEP = 22;   // px de arrasto que valem uma coluna
const SWIPE_FLICK = 46;  // px verticais que disparam hard drop / soft drop
let gesture = null;

if (screenEl) {
    screenEl.addEventListener('pointerdown', event => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        screenEl.setPointerCapture?.(event.pointerId);
        gesture = { x: event.clientX, y: event.clientY, movedCols: 0, dropped: false, acted: false };
    });

    screenEl.addEventListener('pointermove', event => {
        if (!gesture || state !== 'playing') return;

        const deltaX = event.clientX - gesture.x;
        const deltaY = event.clientY - gesture.y;

        // Colunas ainda não consumidas deste arrasto.
        const wantCols = Math.trunc(deltaX / SWIPE_STEP);
        if (wantCols !== gesture.movedCols) {
            const steps = wantCols - gesture.movedCols;
            for (let i = 0; i < Math.abs(steps); i++) playerMove(Math.sign(steps));
            gesture.movedCols = wantCols;
            gesture.acted = true;
        }

        // O vertical só age quando é claramente o eixo dominante.
        if (Math.abs(deltaY) > SWIPE_FLICK && Math.abs(deltaY) > Math.abs(deltaX) && !gesture.dropped) {
            if (deltaY < 0) {
                playerHardDrop();
                gesture.dropped = true;
            } else {
                playerDrop(true);
                // Reancora para o próximo passo do soft drop.
                gesture.y = event.clientY;
            }
            gesture.acted = true;
        }
    });

    const endGesture = () => {
        if (gesture && !gesture.acted) {
            // Toque curto: gira se estiver jogando, senão faz o papel do Start.
            if (state === 'playing') playerRotate(1);
            else toggleStartPause();
        }
        gesture = null;
    };

    screenEl.addEventListener('pointerup', endGesture);
    screenEl.addEventListener('pointercancel', () => { gesture = null; });
}

if (window.LabAudio) {
    window.LabAudio.configure({ storageKey: 'tetris90s:muted', volume: 0.45 });
    window.LabAudio.mountToggle('[data-lab-header] .header-actions');
}

document.querySelector('.btn-start').addEventListener('click', toggleStartPause);
document.querySelector('.btn-select').addEventListener('click', startGame);

/* Depois de um clique/toque o botão devolve o foco: senão a próxima tecla
   Espaço ativaria o botão focado em vez de soltar a peça. */
document.querySelectorAll('.controls button').forEach(button => {
    button.addEventListener('click', event => {
        if (event.detail > 0) button.blur();
    });
});

/* Sair da aba: pausa a partida e cancela o rAF (não só o estado). */
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        if (state === 'playing') setState('paused');
        stopLoop();
    } else {
        startLoop();
    }
});

/* ---------- Escala do console ---------- */

/* O console é desenhado numa base fixa de 320x540px. A escala é calculada aqui
   (e não em CSS) porque `calc()` não divide comprimento por comprimento para
   produzir o fator sem unidade que `scale()` precisa. */
const CONSOLE_BASE = { portrait: [320, 540], landscape: [560, 300] };
const gameBoy = document.querySelector('.game-boy');

function fitConsole() {
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = window.visualViewport?.height || document.documentElement.clientHeight;

    /* Em paisagem curta o CSS troca o console para o formato widescreen; a
       base usada no cálculo precisa acompanhar. */
    const shortLandscape = viewportHeight <= 520 && viewportWidth > viewportHeight;
    const [baseWidth, baseHeight] = shortLandscape ? CONSOLE_BASE.landscape : CONSOLE_BASE.portrait;

    /* Altura ocupada por header, instruções e footer compartilhados. */
    const chrome = ['[data-lab-header]', '.instructions', '[data-lab-footer]']
        .map(sel => document.querySelector(sel))
        .reduce((total, el) => total + (el ? el.getBoundingClientRect().height : 0), 0)
        + (shortLandscape ? 24 : 56);

    const scale = Math.min(
        1.35,
        (viewportWidth - 24) / baseWidth,
        (viewportHeight - chrome) / baseHeight
    );

    gameBoy.style.setProperty('--device-scale', Math.max(scale, 0.55).toFixed(3));
    gameBoy.style.setProperty('--device-base-height', `${baseHeight}px`);
}

window.addEventListener('resize', fitConsole);
window.addEventListener('orientationchange', fitConsole);
window.visualViewport?.addEventListener('resize', fitConsole);

if (window.LabTheme) {
    LabTheme.onChange(() => {
        syncPalette();
        draw();
        drawNext();
    });
} else {
    new MutationObserver(() => {
        syncPalette();
        draw();
        drawNext();
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}

document.getElementById('highscore').innerText = highScore;
resetGame();
fitConsole();
startLoop();
