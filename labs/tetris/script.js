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

// Game Boy Palette
const colors = [
    null,
    '#0f380f', // Darkest (Block fill)
    '#306230', // Dark (Block border)
    '#8bac0f', // Light (Empty space/bg)
    '#9bbc0f', // Lightest (Highlight)
];

// Tetromino definitions
const pieces = 'ILJOTSZ';
const piecesMap = {
    'I': [
        [0, 1, 0, 0],
        [0, 1, 0, 0],
        [0, 1, 0, 0],
        [0, 1, 0, 0],
    ],
    'L': [
        [0, 1, 0],
        [0, 1, 0],
        [0, 1, 1],
    ],
    'J': [
        [0, 1, 0],
        [0, 1, 0],
        [1, 1, 0],
    ],
    'O': [
        [1, 1],
        [1, 1],
    ],
    'Z': [
        [1, 1, 0],
        [0, 1, 1],
        [0, 0, 0],
    ],
    'S': [
        [0, 1, 1],
        [1, 1, 0],
        [0, 0, 0],
    ],
    'T': [
        [0, 1, 0],
        [1, 1, 1],
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
        player.lines += cleared;
        player.score += LINE_SCORE[cleared] * player.level;
        player.level = Math.floor(player.lines / 10) + 1;
        updateScore();
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

function drawMatrix(matrix, offset, ctx = context) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                // Draw block
                ctx.fillStyle = colors[1]; // Darkest
                ctx.fillRect(x + offset.x, y + offset.y, 1, 1);

                // Draw inner detail for "retro" look
                ctx.fillStyle = colors[2];
                ctx.fillRect(x + offset.x + 0.1, y + offset.y + 0.1, 0.8, 0.8);

                ctx.fillStyle = colors[1];
                ctx.fillRect(x + offset.x + 0.3, y + offset.y + 0.3, 0.4, 0.4);
            }
        });
    });
}

function draw() {
    // Clear screen with "screen bg" color
    context.fillStyle = colors[3];
    context.fillRect(0, 0, COLS, ROWS);

    drawMatrix(arena, { x: 0, y: 0 });
    if (player.matrix) {
        drawGhost();
        drawMatrix(player.matrix, player.pos);
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

    context.fillStyle = colors[2];
    player.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                context.fillRect(x + player.pos.x + 0.35, y + ghostY + 0.35, 0.3, 0.3);
            }
        });
    });
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
}

let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;
let state = 'ready'; // ready | playing | paused | over

function update(time = 0) {
    const deltaTime = Math.min(time - lastTime, 250);
    lastTime = time;

    if (state === 'playing') {
        dropCounter += deltaTime;
        if (dropCounter > dropInterval) {
            playerDrop();
        }
        handleAutoRepeat(deltaTime);
    }

    draw();
    requestAnimationFrame(update);
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
    setState('playing');
}

function gameOver() {
    player.matrix = null;
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

document.querySelector('.btn-start').addEventListener('click', toggleStartPause);
document.querySelector('.btn-select').addEventListener('click', startGame);

/* Depois de um clique/toque o botão devolve o foco: senão a próxima tecla
   Espaço ativaria o botão focado em vez de soltar a peça. */
document.querySelectorAll('.controls button').forEach(button => {
    button.addEventListener('click', event => {
        if (event.detail > 0) button.blur();
    });
});

/* Sair da aba durante a partida pausa em vez de deixar a peça cair sozinha. */
document.addEventListener('visibilitychange', () => {
    if (document.hidden && state === 'playing') setState('paused');
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

document.getElementById('highscore').innerText = highScore;
resetGame();
fitConsole();
update();
