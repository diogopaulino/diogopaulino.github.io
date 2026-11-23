const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('startScreen');
const pauseScreen = document.getElementById('pauseScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const finalScoreSpan = document.getElementById('finalScore');
const hudScore = document.getElementById('hudScore');
const hudBest = document.getElementById('hudBest');
const hudLevel = document.getElementById('hudLevel');
const muteBtn = document.getElementById('btnMute');
const screenPlay = document.querySelector('.screen-play');
const statusLive = document.getElementById('gameStatus');
const powerLed = document.querySelector('.power-led');

// Game Constants
const GRID_SIZE = 20;
// O tabuleiro é retangular (20x17) porque a tela do aparelho é retangular:
// um grid quadrado esticado para caber no LCD deixaria as células ovais.
// Tamanho lógico do tabuleiro em px. O buffer real do canvas é redimensionado
// para o tamanho exibido × devicePixelRatio (nítido no Retina) e o desenho usa
// estas unidades via setTransform.
const BOARD_W = canvas.width;
const BOARD_H = canvas.height;
const TILE_COUNT_X = BOARD_W / GRID_SIZE;
const TILE_COUNT_Y = BOARD_H / GRID_SIZE;
/* Regras ---------------------------------------------------------------------
   · A cobra anda uma casa a cada `stepInterval` ms. Cada maçã vale 10 pontos,
     faz a cobra crescer 1 casa e encurta o passo em `SPEED_STEP` ms, até o
     teto de velocidade do modo: stepInterval = max(min, base − (pontos/10)·step).
   · A lógica anda em passos inteiros (timestep fixo = stepInterval); o desenho
     interpola a cabeça e a cauda entre os passos (fração = acumulador/passo),
     então a cobra desliza em vez de pular de casa em casa.
   · Buffer de direções: até 3 curvas antecipadas, uma por passo. Cada curva é
     validada contra a ÚLTIMA da fila (não contra a direção atual), então dois
     toques rápidos (↑ e ←) viram uma curva em U sem a cobra se morder.
   · Normal: bater na parede ou no próprio corpo encerra a partida.
   · Fácil (padrão, pensado para crianças): a cobra atravessa as paredes e
     reaparece do outro lado, anda mais devagar e acelera mais suave. Só bater
     no próprio corpo encerra.
   · Encher o tabuleiro inteiro é vitória. */
const MODES = {
    easy: { base: 175, min: 100, step: 2, wrap: true },
    normal: { base: 130, min: 65, step: 3, wrap: false }
};
const MODE_KEY = 'snakeMode';
let mode = readMode();
let BASE_SPEED = MODES[mode].base; // ms per step at score 0
let MIN_SPEED = MODES[mode].min;   // fastest step interval
const STORAGE_KEY = 'snakeHighScore';

// Game State
let snake = [];
let food = null; // nasce em initGame: antes disso não há maçã no LCD
let dx = 0;
let dy = 0;
const turns = []; // Até três curvas antecipadas, aplicadas em passos consecutivos.
const MAX_TURNS = 3;
let score = 0;
let highScore = readHighScore();
let stepInterval = BASE_SPEED;
let accumulator = 0;
let lastFrame = 0;
let rafId = null;
let isGameRunning = false;
let isPaused = false;
// A cobra só anda depois do primeiro comando — senão, no meio do tabuleiro
// indo para a direita, morre na parede em ~1s sem o jogador ter jogado.
let awaitingFirstMove = false;

// Colors are pulled from the CSS custom properties so the LCD follows the theme.
const COLORS = { bg: '#9bbc0f', snake: '#0f380f', food: '#0f380f' };

function readCssColor(name, fallback) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
}

function syncColors() {
    COLORS.bg = readCssColor('--gb-screen-bg', '#9bbc0f');
    COLORS.snake = readCssColor('--gb-pixel-dark', '#0f380f');
    COLORS.food = COLORS.snake;
}

/* --- Áudio 8-bit -----------------------------------------------------------
   Ondas quadradas curtas via LabAudio: nenhum asset, mesmo timbre do console
   que o aparelho imita. O contexto só nasce no primeiro gesto do usuário. */
const audio = window.LabAudio;

function sfxEat() {
    if (!audio) return;
    audio.tone({ freq: 660, duration: 0.06, gain: 0.05 });
    audio.tone({ freq: 990, duration: 0.07, gain: 0.05, delay: 0.055 });
}

function sfxTurn() {
    if (!audio) return;
    audio.tone({ freq: 320, duration: 0.03, type: 'square', gain: 0.022 });
}

function sfxStart() {
    if (!audio) return;
    audio.sequence([523, 659, 784, 1047], { step: 0.07, duration: 0.09, gain: 0.05 });
}

function sfxDeath() {
    if (!audio) return;
    audio.sequence([440, 349, 262, 175], {
        step: 0.11,
        duration: 0.16,
        type: 'sawtooth',
        gain: 0.045
    });
}

/* Vibração curta no celular (comer, morrer). Silenciosa onde não existe. */
function buzz(pattern) {
    try {
        navigator.vibrate?.(pattern);
    } catch (err) {
        /* alguns navegadores expõem vibrate mas recusam a chamada */
    }
}

function syncMuteButton() {
    if (!muteBtn || !audio) return;
    const muted = audio.isMuted();
    muteBtn.setAttribute('aria-pressed', String(muted));
    muteBtn.setAttribute('aria-label', muted ? 'Ativar som' : 'Desativar som');
    muteBtn.textContent = muted ? '🔇' : '🔊';
}

function readMode() {
    try {
        const saved = localStorage.getItem(MODE_KEY);
        return saved in MODES ? saved : 'easy';
    } catch (err) {
        return 'easy';
    }
}

function setMode(next) {
    if (!(next in MODES)) return;
    mode = next;
    BASE_SPEED = MODES[mode].base;
    MIN_SPEED = MODES[mode].min;
    try {
        localStorage.setItem(MODE_KEY, mode);
    } catch (err) {
        /* Sem storage o modo vale só nesta visita. */
    }
    syncModeButtons();
}

function syncModeButtons() {
    document.querySelectorAll('[data-mode]').forEach((btn) => {
        btn.setAttribute('aria-pressed', String(btn.dataset.mode === mode));
    });
    const hint = document.getElementById('modeHint');
    if (hint) hint.textContent = MODES[mode].wrap ? 'Atravessa as paredes' : 'Parede = fim de jogo';
}

function readHighScore() {
    try {
        return Number(localStorage.getItem(STORAGE_KEY)) || 0;
    } catch (err) {
        return 0;
    }
}

function saveHighScore(value) {
    try {
        localStorage.setItem(STORAGE_KEY, String(value));
    } catch (err) {
        /* Storage can be unavailable in private browsing contexts. */
    }
}

function pad(value) {
    return String(value).padStart(3, '0');
}

// O nível é derivado da velocidade: quanto menor o intervalo entre passos,
// mais alto o nível. Assim o HUD conta a mesma história que o jogo sente.
function currentLevel() {
    const ramp = (BASE_SPEED - stepInterval) / (BASE_SPEED - MIN_SPEED);
    return 1 + Math.round(ramp * 9);
}

function updateHud() {
    hudScore.textContent = pad(score);
    hudBest.textContent = pad(highScore);
    if (hudLevel) hudLevel.textContent = String(currentLevel());
}

function announce(message) {
    statusLive.textContent = message;
}

// Initialize Game
function initGame() {
    const startY = Math.floor(TILE_COUNT_Y / 2);
    // Começa mais à esquerda para dar margem quando o primeiro comando for “direita”.
    snake = [
        { x: 6, y: startY },
        { x: 5, y: startY },
        { x: 4, y: startY }
    ];
    dx = 1;
    dy = 0;
    turns.length = 0;
    awaitingFirstMove = true;
    score = 0;
    stepInterval = BASE_SPEED;
    accumulator = 0;
    placeFood();
    isGameRunning = true;
    isPaused = false;

    startScreen.classList.add('hidden');
    pauseScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    powerLed.classList.add('on');
    eatPulse = 0;
    deathFlash = 0;
    digestPulses = [];
    updateHud();
    announce('Partida iniciada. Escolha uma direção.');
    sfxStart();

    startLoop();
}

function startLoop() {
    if (rafId !== null) return;
    lastFrame = 0;
    rafId = requestAnimationFrame(gameLoop);
}

function stopLoop() {
    if (rafId === null) return;
    cancelAnimationFrame(rafId);
    rafId = null;
}

function placeFood() {
    const occupied = new Set(snake.map(({ x, y }) => y * TILE_COUNT_X + x));
    const cells = TILE_COUNT_X * TILE_COUNT_Y;
    // Sorteia a posição entre as casas livres, com a mesma chance para cada casa.
    let remaining = Math.floor(Math.random() * (cells - occupied.size));
    for (let i = 0; i < cells; i++) {
        if (!occupied.has(i) && remaining-- === 0) {
            food = { x: i % TILE_COUNT_X, y: Math.floor(i / TILE_COUNT_X) };
            return;
        }
    }
    food = null;
}

function gameLoop(timestamp) {
    rafId = requestAnimationFrame(gameLoop);

    if (!lastFrame) lastFrame = timestamp;
    // Cap the delta so a backgrounded tab never replays a burst of steps.
    const delta = Math.min(timestamp - lastFrame, 250);
    lastFrame = timestamp;

    // Efeitos decaem em tempo real (independente do passo fixo do jogo).
    foodPhase += delta / 260;
    eatPulse = Math.max(0, eatPulse - delta / 220);
    deathFlash = Math.max(0, deathFlash - delta / 420);

    if (isGameRunning && !isPaused && !awaitingFirstMove) {
        accumulator += delta;
        while (accumulator >= stepInterval) {
            accumulator -= stepInterval;
            update();
            if (!isGameRunning) break;
        }
    }

    draw();
}

function update() {
    if (turns.length) ({ dx, dy } = turns.shift());

    // Move Snake
    const head = { x: snake[0].x + dx, y: snake[0].y + dy };

    // Check Wall Collision (no modo fácil a borda é um portal para o lado oposto)
    if (MODES[mode].wrap) {
        head.x = (head.x + TILE_COUNT_X) % TILE_COUNT_X;
        head.y = (head.y + TILE_COUNT_Y) % TILE_COUNT_Y;
    } else if (head.x < 0 || head.x >= TILE_COUNT_X || head.y < 0 || head.y >= TILE_COUNT_Y) {
        gameOver();
        return;
    }

    const willGrow = Boolean(food) && head.x === food.x && head.y === food.y;

    // Check Self Collision. The tail cell is free unless the snake is growing,
    // so it is skipped to avoid phantom deaths when turning into it.
    const lastIndex = willGrow ? snake.length : snake.length - 1;
    for (let i = 0; i < lastIndex; i++) {
        if (head.x === snake[i].x && head.y === snake[i].y) {
            gameOver();
            return;
        }
    }

    snake.unshift(head);

    // Avança pulsos de digestão pelo corpo da cobra
    for (let i = digestPulses.length - 1; i >= 0; i--) {
        digestPulses[i] += 1;
        if (digestPulses[i] >= snake.length - 1) {
            digestPulses.splice(i, 1);
        }
    }

    // Check Food Collision
    if (willGrow) {
        score += 10;
        // Each fruit shaves a little off the step interval for a difficulty ramp.
        stepInterval = Math.max(MIN_SPEED, BASE_SPEED - Math.floor(score / 10) * MODES[mode].step);
        placeFood();
        eatPulse = 1;
        digestPulses.push(0);
        sfxEat();
        buzz(12);
        updateHud();
        if (!food) gameOver(true);
    } else {
        snake.pop();
    }
}

/* --- Render ----------------------------------------------------------------
   Efeitos de tela guardados fora do estado de jogo: decaem por frame, então
   nunca alteram a simulação (que roda em passos fixos de `stepInterval`). */
let eatPulse = 0;    // 1 → 0 logo depois de comer: brilho na fruta e na cabeça
let deathFlash = 0;  // 1 → 0 na morte: inverte a tela por alguns frames
let foodPhase = 0;   // fase da respiração da fruta
let digestPulses = []; // índices dos segmentos onde passa o pulso de digestão

/* Desenho contínuo da cobra -------------------------------------------------
   O corpo é uma linha grossa com juntas redondas passando pelo centro das
   casas. A cabeça avança `alpha` casa na direção do próximo passo e a cauda
   recolhe `alpha` casa em direção ao penúltimo segmento (a não ser que a
   cobra vá crescer). Atravessar a borda (modo Fácil) quebra a linha em dois
   trechos: um some numa borda e o outro entra pela borda oposta. */
const BODY_WIDTH = GRID_SIZE * 0.76;

function cx(cell) { return cell.x * GRID_SIZE + GRID_SIZE / 2; }
function cy(cell) { return cell.y * GRID_SIZE + GRID_SIZE / 2; }

// Passo de a para b em casas (−1, 0, 1), considerando a volta pela borda.
function stepBetween(a, b) {
    let sx = b.x - a.x;
    let sy = b.y - a.y;
    if (sx > 1) sx = -1; else if (sx < -1) sx = 1;
    if (sy > 1) sy = -1; else if (sy < -1) sy = 1;
    return { sx, sy, wrap: Math.abs(b.x - a.x) > 1 || Math.abs(b.y - a.y) > 1 };
}

function nextDirection() {
    return turns.length ? turns[0] : { dx, dy };
}

function willGrowNext(dir) {
    if (!food || !snake.length) return false;
    let nx = snake[0].x + dir.dx;
    let ny = snake[0].y + dir.dy;
    if (MODES[mode].wrap) {
        nx = (nx + TILE_COUNT_X) % TILE_COUNT_X;
        ny = (ny + TILE_COUNT_Y) % TILE_COUNT_Y;
    }
    return nx === food.x && ny === food.y;
}

// Traça o corpo inteiro como caminho; `ox/oy` desloca (passe de sombra).
function traceSnake(alpha, dir, growing, ox = 0, oy = 0) {
    const n = snake.length;
    const head = snake[0];
    const hx = cx(head) + dir.dx * alpha * GRID_SIZE;
    const hy = cy(head) + dir.dy * alpha * GRID_SIZE;

    ctx.beginPath();
    ctx.moveTo(hx + ox, hy + oy);
    ctx.lineTo(cx(head) + ox, cy(head) + oy);

    for (let i = 1; i < n; i++) {
        const a = snake[i - 1];
        const b = snake[i];
        const isTail = i === n - 1 && !growing;
        const step = stepBetween(a, b);
        // Cauda recolhendo: fica `alpha` casa mais perto do segmento anterior.
        const tx = cx(b) - (isTail ? step.sx * alpha * GRID_SIZE : 0);
        const ty = cy(b) - (isTail ? step.sy * alpha * GRID_SIZE : 0);
        if (step.wrap) {
            const reach = isTail ? Math.max(0, 1 - alpha) : 1;
            ctx.lineTo(cx(a) + step.sx * reach * GRID_SIZE + ox, cy(a) + step.sy * reach * GRID_SIZE + oy);
            if (!isTail || alpha < 1) {
                ctx.moveTo(cx(b) - step.sx * GRID_SIZE + ox, cy(b) - step.sy * GRID_SIZE + oy);
                ctx.lineTo(tx + ox, ty + oy);
            }
        } else {
            ctx.lineTo(tx + ox, ty + oy);
        }
    }

    // A cabeça cruzando a borda reaparece do outro lado ao mesmo tempo.
    const nextX = head.x + dir.dx;
    const nextY = head.y + dir.dy;
    if (alpha > 0 && (nextX < 0 || nextX >= TILE_COUNT_X || nextY < 0 || nextY >= TILE_COUNT_Y)) {
        const offX = dir.dx * BOARD_W;
        const offY = dir.dy * BOARD_H;
        ctx.moveTo(cx(head) - offX + ox, cy(head) - offY + oy);
        ctx.lineTo(hx - offX + ox, hy - offY + oy);
    }
    return { hx, hy };
}

function drawSnake(alpha) {
    if (!snake.length) return;
    const dir = alpha > 0 ? nextDirection() : { dx, dy };
    const growing = alpha > 0 && willGrowNext(dir);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = BODY_WIDTH;

    // Sombra projetada no cristal líquido.
    ctx.globalAlpha = 0.16;
    ctx.strokeStyle = COLORS.snake;
    traceSnake(alpha, dir, growing, 2, 2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    const { hx, hy } = traceSnake(alpha, dir, growing);
    ctx.stroke();

    // Escamas: tracejado claro fixo no corpo (o deslocamento acompanha o
    // avanço da cabeça, então o desenho não "escorre" pela cobra).
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = COLORS.bg;
    ctx.lineWidth = BODY_WIDTH * 0.26;
    ctx.lineCap = 'butt';
    ctx.setLineDash([GRID_SIZE * 0.32, GRID_SIZE * 0.68]);
    ctx.lineDashOffset = -alpha * GRID_SIZE - GRID_SIZE * 0.9;
    traceSnake(alpha, dir, growing);
    ctx.stroke();
    ctx.restore();

    // Pulsos de digestão: um caroço que percorre o corpo depois de comer.
    for (const index of digestPulses) {
        const seg = snake[index];
        const nextSeg = snake[index + 1];
        if (!seg) continue;
        let px = cx(seg);
        let py = cy(seg);
        if (nextSeg && !stepBetween(seg, nextSeg).wrap) {
            px += (cx(nextSeg) - px) * alpha;
            py += (cy(nextSeg) - py) * alpha;
        }
        ctx.fillStyle = COLORS.snake;
        ctx.beginPath();
        ctx.arc(px, py, GRID_SIZE * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = COLORS.bg;
        ctx.globalAlpha = 0.5;
        ctx.fillRect(px - 2, py - 2, 4, 4);
        ctx.globalAlpha = 1;
    }

    // Cabeça um pouco mais larga que o corpo.
    ctx.fillStyle = COLORS.snake;
    ctx.beginPath();
    ctx.arc(hx, hy, GRID_SIZE * 0.47, 0, Math.PI * 2);
    ctx.fill();
    drawTongue(hx, hy, dir);
    drawHeadEyes(hx, hy, dir);
}

function drawHeadEyes(hx, hy, dir) {
    // Olhos perpendiculares ao avanço, um pouco à frente do centro.
    const fx = dir.dx;
    const fy = dir.dy;
    const side = GRID_SIZE * 0.22;
    const ahead = GRID_SIZE * 0.12;
    const eye = 4;
    ctx.fillStyle = COLORS.bg;
    for (const s of [-1, 1]) {
        const ex = hx + fx * ahead - fy * side * s;
        const ey = hy + fy * ahead + fx * side * s;
        ctx.fillRect(Math.round(ex - eye / 2), Math.round(ey - eye / 2), eye, eye);
    }
    ctx.fillStyle = COLORS.snake;
    for (const s of [-1, 1]) {
        const ex = hx + fx * (ahead + 1) - fy * side * s;
        const ey = hy + fy * (ahead + 1) + fx * side * s;
        ctx.fillRect(Math.round(ex - 1), Math.round(ey - 1), 2, 2);
    }
}

// Língua bifurcada saindo da cabeça — só quando a cobra está de fato andando.
function drawTongue(hx, hy, dir) {
    if (!isGameRunning || isPaused || awaitingFirstMove) return;
    const flick = Math.sin(foodPhase * 2.2) > 0.4;
    if (!flick) return;

    const reach = GRID_SIZE * 0.85;
    const baseX = hx + dir.dx * (GRID_SIZE * 0.4);
    const baseY = hy + dir.dy * (GRID_SIZE * 0.4);
    const tipX = hx + dir.dx * reach;
    const tipY = hy + dir.dy * reach;

    ctx.strokeStyle = COLORS.snake;
    ctx.lineWidth = 2;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(baseX, baseY);
    ctx.lineTo(tipX, tipY);
    // A forquilha abre perpendicular ao avanço.
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX + dir.dx * 3 + dir.dy * 3, tipY + dir.dy * 3 + dir.dx * 3);
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX + dir.dx * 3 - dir.dy * 3, tipY + dir.dy * 3 - dir.dx * 3);
    ctx.stroke();
}

// Maçã: corpo redondo com talo, folha, sombra LCD e brilho especular animado.
function drawFood() {
    const cx = food.x * GRID_SIZE + GRID_SIZE / 2;
    const cy = food.y * GRID_SIZE + GRID_SIZE / 2;
    const breathe = 1 + Math.sin(foodPhase) * 0.06;
    const scale = breathe * (1 + eatPulse * 0.5);
    const r = (GRID_SIZE / 2 - 2) * scale;

    // Sombra projetada no cristal líquido da tela Nokia
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = COLORS.food;
    ctx.beginPath();
    ctx.arc(cx - r * 0.28 + 2, cy + 3, r * 0.82, 0, Math.PI * 2);
    ctx.arc(cx + r * 0.28 + 2, cy + 3, r * 0.82, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Halo de brilho pulsante ao redor da maçã
    if (Math.sin(foodPhase * 1.6) > -0.2) {
        ctx.save();
        ctx.globalAlpha = 0.22 + 0.12 * Math.sin(foodPhase * 2);
        ctx.strokeStyle = COLORS.food;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.arc(cx, cy + 1, r + 3.2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    ctx.fillStyle = COLORS.food;
    // Dois lobos: silhueta de maçã, ainda 2-tone LCD.
    ctx.beginPath();
    ctx.arc(cx - r * 0.28, cy + 1, r * 0.82, 0, Math.PI * 2);
    ctx.arc(cx + r * 0.28, cy + 1, r * 0.82, 0, Math.PI * 2);
    ctx.fill();

    // Talo e folha.
    ctx.strokeStyle = COLORS.food;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.85);
    ctx.lineTo(cx, cy - r - 3);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx + 4, cy - r - 3, 4, 2.2, -0.5, 0, Math.PI * 2);
    ctx.fill();

    // Brilho especular em L na cor do fundo, do jeito que um sprite 8-bit faria.
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(cx - r * 0.58, cy - r * 0.45, 3, 2);
    ctx.fillRect(cx - r * 0.58, cy - r * 0.45 + 2, 1.8, 2);
}

const gridPath = (() => {
    const grid = new Path2D();
    for (let x = GRID_SIZE; x < BOARD_W; x += GRID_SIZE) {
        grid.moveTo(x + 0.5, 0);
        grid.lineTo(x + 0.5, BOARD_H);
    }
    for (let y = GRID_SIZE; y < BOARD_H; y += GRID_SIZE) {
        grid.moveTo(0, y + 0.5);
        grid.lineTo(BOARD_W, y + 0.5);
    }
    return grid;
})();

/* Fração do passo atual já percorrida (0..1) — só para o desenho. */
function stepAlpha() {
    if (!isGameRunning || isPaused || awaitingFirstMove) return 0;
    return Math.min(1, accumulator / stepInterval);
}

function draw() {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, BOARD_W, BOARD_H);

    // Grade fantasma: dá escala ao tabuleiro sem competir com a cobra.
    ctx.globalAlpha = 0.07;
    ctx.strokeStyle = COLORS.snake;
    ctx.lineWidth = 1;
    ctx.stroke(gridPath);
    ctx.globalAlpha = 1;

    if (food) drawFood();
    drawSnake(stepAlpha());

    // Flash de morte: inverte o LCD por instantes, como um console de verdade.
    if (deathFlash > 0) {
        ctx.globalAlpha = deathFlash * 0.65;
        ctx.fillStyle = COLORS.snake;
        ctx.fillRect(0, 0, BOARD_W, BOARD_H);
        ctx.globalAlpha = 1;
    }
}

/* Buffer do canvas no tamanho real exibido (object-fit: contain) × DPR. */
function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const fitW = Math.min(rect.width, rect.height * BOARD_W / BOARD_H);
    const w = Math.max(BOARD_W / 2, Math.round(fitW * dpr));
    const h = Math.round(w * BOARD_H / BOARD_W);
    if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
    }
    ctx.setTransform(w / BOARD_W, 0, 0, h / BOARD_H, 0, 0);
    draw();
}

function gameOver(won = false) {
    isGameRunning = false;
    isPaused = false;
    deathFlash = won ? 0 : 1;
    if (!won) {
        sfxDeath();
        buzz([40, 50, 90]);
    }
    const result = won ? 'Tabuleiro completo' : 'Fim de jogo';
    const finalNote = document.getElementById('finalNote');
    gameOverScreen.querySelector('h2').textContent = won ? 'VITÓRIA' : 'FIM DE JOGO';
    stopLoop();
    pauseScreen.classList.add('hidden');
    finalScoreSpan.textContent = score;

    if (score > highScore) {
        highScore = score;
        saveHighScore(highScore);
        if (finalNote) finalNote.textContent = '★ NOVO RECORDE! ★';
        announce(`${result}. Novo recorde: ${score} pontos.`);
    } else {
        if (finalNote) finalNote.textContent = `Recorde: ${highScore}`;
        announce(`${result}. ${score} pontos.`);
    }

    updateHud();
    gameOverScreen.classList.remove('hidden');
    powerLed.classList.remove('on');
    draw();
}

function setPaused(paused) {
    if (!isGameRunning) return;
    isPaused = paused;
    pauseScreen.classList.toggle('hidden', !paused);
    powerLed.classList.toggle('on', !paused);
    announce(paused ? 'Jogo pausado.' : 'Jogo retomado.');
    if (paused) {
        stopLoop();
    } else {
        accumulator = 0;
        startLoop();
    }
}

function queueDirection(nextDx, nextDy) {
    const previous = turns.at(-1);
    const currentDx = previous?.dx ?? dx;
    const currentDy = previous?.dy ?? dy;
    // Primeiro comando “para trás” (esquerda, com a cobra virada para a
    // direita): em vez de ignorar — a criança aperta e nada acontece —, a cobra
    // dá meia-volta invertendo o corpo, que ainda está parado em linha reta.
    if (awaitingFirstMove && nextDx === -currentDx && nextDy === -currentDy) {
        snake.reverse();
        dx = nextDx;
        dy = nextDy;
        awaitingFirstMove = false;
        accumulator = 0;
        announce('Partida em andamento.');
        sfxTurn();
        return;
    }
    if (nextDx === -currentDx && nextDy === -currentDy) return;
    if (!awaitingFirstMove && nextDx === currentDx && nextDy === currentDy) return;
    if (turns.length >= MAX_TURNS) return;
    turns.push({ dx: nextDx, dy: nextDy });
    if (awaitingFirstMove) {
        awaitingFirstMove = false;
        accumulator = 0;
        announce('Partida em andamento.');
    }
    sfxTurn();
}

// Input Handling
function handleInput(key) {
    if (!isGameRunning) {
        if (key === 'Enter' || key === 'Start' || key === 'Space') {
            initGame();
        }
        return;
    }

    if (isPaused && key !== 'Enter' && key !== 'Start' && key !== 'Space') return;

    switch (key) {
        case 'ArrowUp':
            queueDirection(0, -1);
            break;
        case 'ArrowDown':
            queueDirection(0, 1);
            break;
        case 'ArrowLeft':
            queueDirection(-1, 0);
            break;
        case 'ArrowRight':
            queueDirection(1, 0);
            break;
        case 'Enter':
        case 'Start':
        case 'Space':
            setPaused(!isPaused);
            break;
    }
}

// Keyboard Listeners (Setas + WASD + Space/Enter)
const KEY_MAP = {
    ArrowUp: 'ArrowUp',
    ArrowDown: 'ArrowDown',
    ArrowLeft: 'ArrowLeft',
    ArrowRight: 'ArrowRight',
    w: 'ArrowUp',
    W: 'ArrowUp',
    s: 'ArrowDown',
    S: 'ArrowDown',
    a: 'ArrowLeft',
    A: 'ArrowLeft',
    d: 'ArrowRight',
    D: 'ArrowRight',
};

document.addEventListener('keydown', (e) => {
    const mapped = KEY_MAP[e.key];
    if (mapped) {
        e.preventDefault();
        handleInput(mapped);
        return;
    }
    if ((e.key === 'Enter' || e.key === ' ' || e.code === 'Space') && !e.target.closest('a, button')) {
        e.preventDefault();
        if (!e.repeat) handleInput(e.key === 'Enter' ? 'Enter' : 'Space');
        return;
    }
    // P e Esc só pausam/retomam (não começam partida nova por engano).
    if ((e.code === 'KeyP' || e.key === 'Escape') && isGameRunning && !e.repeat) {
        e.preventDefault();
        setPaused(!isPaused);
    }
});

// Touch/Click Listeners for On-Screen Controls
document.querySelectorAll('.d-pad [data-key]').forEach(btn => {
    // pointerdown fires for mouse, pen and touch, so a single binding covers all
    // inputs without the double-fire the old mousedown + touchstart pair caused.
    btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        handleInput(btn.dataset.key);
    });
    btn.addEventListener('click', (e) => {
        if (e.detail === 0) handleInput(btn.dataset.key);
    });
});

/* Deslizar na tela: no celular o d-pad desenhado tem 30px e o polegar cobre a
   LCD inteira. O swipe é o controle primário no toque; o d-pad continua ali
   para quem prefere (e para o mouse). Um toque simples inicia/pausa.
   Vários deslizes no mesmo arrasto: depois de cada curva reconhecida o ponto
   de partida é reancorado, então "↑ e ←" sem tirar o dedo vira duas curvas
   (vão para o buffer de direções, uma por passo). */
const SWIPE_MIN = 22; // px — abaixo disso é toque, não gesto
let touchStart = null;

if (screenPlay) {
    screenPlay.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        // Botões dos overlays (modo, jogar, continuar) têm o próprio clique.
        if (e.target.closest('button')) return;
        try { screenPlay.setPointerCapture(e.pointerId); } catch (err) { /* segue sem captura */ }
        touchStart = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, lastKey: '' };
    });

    screenPlay.addEventListener('pointermove', (e) => {
        if (!touchStart || touchStart.id !== e.pointerId) return;
        const deltaX = e.clientX - touchStart.x;
        const deltaY = e.clientY - touchStart.y;
        if (Math.hypot(deltaX, deltaY) < SWIPE_MIN) return;

        // O eixo dominante decide: diagonais viram a direção mais forte em vez
        // de serem descartadas.
        const key = Math.abs(deltaX) > Math.abs(deltaY)
            ? (deltaX > 0 ? 'ArrowRight' : 'ArrowLeft')
            : (deltaY > 0 ? 'ArrowDown' : 'ArrowUp');
        touchStart.moved = true;
        touchStart.x = e.clientX;
        touchStart.y = e.clientY;
        if (key === touchStart.lastKey) return;
        touchStart.lastKey = key;
        if (isGameRunning && !isPaused) handleInput(key);
    });

    const endTouch = (e) => {
        if (!touchStart || touchStart.id !== e.pointerId) return;
        if (!touchStart.moved && e.type === 'pointerup') handleInput('Start');
        touchStart = null;
    };
    screenPlay.addEventListener('pointerup', endTouch);
    screenPlay.addEventListener('pointercancel', endTouch);
}

if (audio) {
    audio.configure({ storageKey: 'snakeMuted', volume: 0.45 });
    if (muteBtn) {
        audio.onChange(syncMuteButton);
        muteBtn.addEventListener('click', () => {
            audio.setMuted(!audio.isMuted());
            if (!audio.isMuted()) audio.tone({ freq: 880, duration: 0.06, gain: 0.14 });
        });
    } else {
        audio.mountToggle('[data-lab-header] .header-actions');
    }
}

document.getElementById('btnStart').addEventListener('click', () => handleInput('Start'));
document.getElementById('btnSelect').addEventListener('click', () => initGame());
document.getElementById('btnA').addEventListener('click', () => {
    if (!isGameRunning) initGame();
});
document.getElementById('btnB').addEventListener('click', () => {
    if (isGameRunning) setPaused(!isPaused);
});

// Aba oculta: pausa de verdade (overlay de PAUSA). Voltar para a aba não
// solta a cobra andando de surpresa — o jogador escolhe quando continuar.
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        if (isGameRunning && !isPaused) setPaused(true);
        stopLoop();
    }
});
// Trocar de janela (alt-tab) também pausa: a cobra não segue sozinha.
window.addEventListener('blur', () => {
    if (isGameRunning && !isPaused && !awaitingFirstMove) setPaused(true);
});

/* Botões dentro do LCD: escolher modo, jogar, continuar, voltar ao menu. */
document.querySelectorAll('[data-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
        setMode(btn.dataset.mode);
        sfxTurn();
    });
});

function showMenu() {
    gameOverScreen.classList.add('hidden');
    pauseScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
    startScreen.querySelector('[data-action="start"]')?.focus({ preventScroll: true });
}

document.querySelectorAll('.ui-overlay [data-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        if (action === 'start') initGame();
        else if (action === 'resume') setPaused(false);
        else if (action === 'menu') showMenu();
    });
});

// Keep the LCD palette in sync with the theme toggle.
if (window.LabTheme) {
    LabTheme.onChange(() => {
        syncColors();
        draw();
    });
} else {
    new MutationObserver(() => {
        syncColors();
        draw();
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}

// O aparelho é desenhado numa base fixa de 320x562px e escalado para caber na
// tela — cresce no desktop, encolhe no celular e em paisagem curta.
const DEVICE_BASE = { portrait: [320, 562], landscape: [560, 300] };
const device = document.querySelector('.handheld-device');

function fitDevice() {
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = window.visualViewport?.height || document.documentElement.clientHeight;
    const shortLandscape = viewportHeight <= 500 && viewportWidth > viewportHeight;
    const [baseWidth, baseHeight] = shortLandscape ? DEVICE_BASE.landscape : DEVICE_BASE.portrait;

    const chrome = ['[data-lab-header]', '.instructions', '[data-lab-footer]']
        .map(selector => document.querySelector(selector))
        .reduce((total, el) => total + (el ? el.getBoundingClientRect().height : 0), 0)
        + (shortLandscape ? 24 : 56);

    const scale = Math.min(
        1.3,
        (viewportWidth - 24) / baseWidth,
        (viewportHeight - chrome) / baseHeight
    );

    device.style.setProperty('--device-scale', Math.max(scale, 0.55).toFixed(3));
    device.style.setProperty('--device-base-height', `${baseHeight}px`);
    requestAnimationFrame(resizeCanvas);
}

window.addEventListener('resize', fitDevice);
window.addEventListener('orientationchange', fitDevice);
window.visualViewport?.addEventListener('resize', fitDevice);

// Initial Draw
syncModeButtons();
syncColors();
syncMuteButton();
updateHud();
fitDevice();
draw();
// A fonte em pixel muda a altura do header ao carregar: refaz a escala.
document.fonts?.ready.then(fitDevice).catch(() => {});
