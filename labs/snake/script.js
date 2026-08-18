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
const TILE_COUNT_X = canvas.width / GRID_SIZE;
const TILE_COUNT_Y = canvas.height / GRID_SIZE;
const BASE_SPEED = 130; // ms per step at score 0
const MIN_SPEED = 65;   // fastest step interval
const STORAGE_KEY = 'snakeHighScore';

// Game State
let snake = [];
let food = { x: 0, y: 0 };
let dx = 0;
let dy = 0;
let queuedDirection = null; // buffers one input per step so fast taps never reverse the snake
let score = 0;
let highScore = readHighScore();
let stepInterval = BASE_SPEED;
let accumulator = 0;
let lastFrame = 0;
let rafId = null;
let isGameRunning = false;
let isPaused = false;

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
   Ondas quadradas curtas sintetizadas na hora: nenhum asset, mesmo timbre do
   console que o aparelho imita. O contexto só nasce no primeiro gesto do
   usuário porque navegadores bloqueiam áudio antes disso. */
const SOUND_KEY = 'snakeMuted';
let audioCtx = null;
let muted = readMuted();

function readMuted() {
    try {
        return localStorage.getItem(SOUND_KEY) === '1';
    } catch (err) {
        return false;
    }
}

function saveMuted(value) {
    try {
        localStorage.setItem(SOUND_KEY, value ? '1' : '0');
    } catch (err) {
        /* Storage can be unavailable in private browsing contexts. */
    }
}

function ensureAudio() {
    if (muted) return null;
    if (!audioCtx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return null;
        audioCtx = new Ctx();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
}

function blip(freq, duration = 0.08, type = 'square', gain = 0.05) {
    const ctxAudio = ensureAudio();
    if (!ctxAudio) return;
    const now = ctxAudio.currentTime;
    const osc = ctxAudio.createOscillator();
    const amp = ctxAudio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    amp.gain.setValueAtTime(0, now);
    amp.gain.linearRampToValueAtTime(gain, now + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(amp).connect(ctxAudio.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
}

function sfxEat() {
    blip(660, 0.06);
    setTimeout(() => blip(990, 0.07), 55);
}

function sfxTurn() {
    blip(320, 0.03, 'square', 0.022);
}

function sfxStart() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.09), i * 70));
}

function sfxDeath() {
    [440, 349, 262, 175].forEach((f, i) => setTimeout(() => blip(f, 0.16, 'sawtooth', 0.045), i * 110));
}

function syncMuteButton() {
    if (!muteBtn) return;
    muteBtn.setAttribute('aria-pressed', String(muted));
    muteBtn.setAttribute('aria-label', muted ? 'Ativar som' : 'Desativar som');
    muteBtn.textContent = muted ? '🔇' : '🔊';
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
    return String(Math.min(999, value)).padStart(3, '0');
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
    snake = [
        { x: 10, y: startY },
        { x: 9, y: startY },
        { x: 8, y: startY }
    ];
    dx = 1;
    dy = 0;
    queuedDirection = null;
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
    updateHud();
    announce('Partida iniciada.');
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
    // Collect the free cells first: this avoids the unbounded recursion the
    // previous version could hit once the snake filled most of the board.
    const free = [];
    for (let x = 0; x < TILE_COUNT_X; x++) {
        for (let y = 0; y < TILE_COUNT_Y; y++) {
            if (!snake.some(segment => segment.x === x && segment.y === y)) free.push({ x, y });
        }
    }
    if (!free.length) return;
    const pick = free[Math.floor(Math.random() * free.length)];
    food.x = pick.x;
    food.y = pick.y;
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

    if (isGameRunning && !isPaused) {
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
    if (queuedDirection) {
        dx = queuedDirection.dx;
        dy = queuedDirection.dy;
        queuedDirection = null;
    }

    // Move Snake
    const head = { x: snake[0].x + dx, y: snake[0].y + dy };

    // Check Wall Collision
    if (head.x < 0 || head.x >= TILE_COUNT_X || head.y < 0 || head.y >= TILE_COUNT_Y) {
        gameOver();
        return;
    }

    const willGrow = head.x === food.x && head.y === food.y;

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

    // Check Food Collision
    if (willGrow) {
        score += 10;
        // Each fruit shaves a little off the step interval for a difficulty ramp.
        stepInterval = Math.max(MIN_SPEED, BASE_SPEED - Math.floor(score / 10) * 3);
        placeFood();
        eatPulse = 1;
        sfxEat();
        updateHud();
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

// Um retângulo com cantos arredondados só onde a cobra NÃO continua. É isso que
// transforma quadradinhos soltos em um corpo contínuo — sem sair do look 8-bit,
// porque o raio é 1/4 da célula.
function bodyCell(x, y, prev, next) {
    const px = x * GRID_SIZE;
    const py = y * GRID_SIZE;
    const inset = 1;
    const r = GRID_SIZE / 4;
    const size = GRID_SIZE - inset * 2;

    // Cantos: arredonda o canto quando nenhum vizinho ocupa os dois lados dele.
    const up = (prev && prev.y === y - 1) || (next && next.y === y - 1);
    const down = (prev && prev.y === y + 1) || (next && next.y === y + 1);
    const left = (prev && prev.x === x - 1) || (next && next.x === x - 1);
    const right = (prev && prev.x === x + 1) || (next && next.x === x + 1);

    const tl = up || left ? 0 : r;
    const tr = up || right ? 0 : r;
    const br = down || right ? 0 : r;
    const bl = down || left ? 0 : r;

    ctx.beginPath();
    ctx.moveTo(px + inset + tl, py + inset);
    ctx.lineTo(px + inset + size - tr, py + inset);
    ctx.quadraticCurveTo(px + inset + size, py + inset, px + inset + size, py + inset + tr);
    ctx.lineTo(px + inset + size, py + inset + size - br);
    ctx.quadraticCurveTo(px + inset + size, py + inset + size, px + inset + size - br, py + inset + size);
    ctx.lineTo(px + inset + bl, py + inset + size);
    ctx.quadraticCurveTo(px + inset, py + inset + size, px + inset, py + inset + size - bl);
    ctx.lineTo(px + inset, py + inset + tl);
    ctx.quadraticCurveTo(px + inset, py + inset, px + inset + tl, py + inset);
    ctx.closePath();
    ctx.fill();

    // Preenche a junta com o vizinho: sem isso os cantos arredondados abrem
    // fendas de 2px entre segmentos em linha reta.
    if (right) ctx.fillRect(px + GRID_SIZE - inset - 1, py + inset, inset * 2 + 1, size);
    if (down) ctx.fillRect(px + inset, py + GRID_SIZE - inset - 1, size, inset * 2 + 1);
}

function drawHeadEyes(segment) {
    ctx.fillStyle = COLORS.bg;
    const eye = 4;
    const bx = segment.x * GRID_SIZE;
    const by = segment.y * GRID_SIZE;
    let e1, e2;

    if (dx === 1) {
        e1 = [bx + GRID_SIZE - 6, by + 4];
        e2 = [bx + GRID_SIZE - 6, by + GRID_SIZE - 8];
    } else if (dx === -1) {
        e1 = [bx + 2, by + 4];
        e2 = [bx + 2, by + GRID_SIZE - 8];
    } else if (dy === -1) {
        e1 = [bx + 4, by + 2];
        e2 = [bx + GRID_SIZE - 8, by + 2];
    } else {
        e1 = [bx + 4, by + GRID_SIZE - 6];
        e2 = [bx + GRID_SIZE - 8, by + GRID_SIZE - 6];
    }

    ctx.fillRect(e1[0], e1[1], eye, eye);
    ctx.fillRect(e2[0], e2[1], eye, eye);
}

// Língua bifurcada saindo da cabeça — só quando a cobra está de fato andando.
function drawTongue(head) {
    if (!isGameRunning || isPaused) return;
    const flick = Math.sin(foodPhase * 2.2) > 0.4;
    if (!flick) return;

    const cx = head.x * GRID_SIZE + GRID_SIZE / 2;
    const cy = head.y * GRID_SIZE + GRID_SIZE / 2;
    const reach = GRID_SIZE * 0.55;
    const tipX = cx + dx * reach;
    const tipY = cy + dy * reach;

    ctx.strokeStyle = COLORS.snake;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + dx * (GRID_SIZE / 2 - 1), cy + dy * (GRID_SIZE / 2 - 1));
    ctx.lineTo(tipX, tipY);
    // A forquilha abre perpendicular ao avanço.
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX + dy * 3 - dx * 0, tipY + dx * 3 - dy * 0);
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX - dy * 3, tipY - dx * 3);
    ctx.stroke();
}

// Maçã: corpo redondo com talo e folha, respirando devagar. O pulso ao comer
// reaproveita a mesma escala para dar o "pop" de coleta.
function drawFood() {
    const cx = food.x * GRID_SIZE + GRID_SIZE / 2;
    const cy = food.y * GRID_SIZE + GRID_SIZE / 2;
    const breathe = 1 + Math.sin(foodPhase) * 0.06;
    const scale = breathe * (1 + eatPulse * 0.5);
    const r = (GRID_SIZE / 2 - 2) * scale;

    ctx.fillStyle = COLORS.food;
    ctx.beginPath();
    ctx.arc(cx, cy + 1, r, 0, Math.PI * 2);
    ctx.fill();

    // Talo e folha.
    ctx.strokeStyle = COLORS.food;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx, cy - r - 3);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx + 3, cy - r - 3, 3, 1.6, -0.5, 0, Math.PI * 2);
    ctx.fill();

    // Brilho: um furinho na cor do fundo, do jeito que um sprite 8-bit faria.
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(cx - r * 0.55, cy - r * 0.5, 2, 2);
}

function draw() {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grade fantasma: dá escala ao tabuleiro sem competir com a cobra.
    ctx.globalAlpha = 0.07;
    ctx.strokeStyle = COLORS.snake;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = GRID_SIZE; x < canvas.width; x += GRID_SIZE) {
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, canvas.height);
    }
    for (let y = GRID_SIZE; y < canvas.height; y += GRID_SIZE) {
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(canvas.width, y + 0.5);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    drawFood();

    ctx.fillStyle = COLORS.snake;
    snake.forEach((segment, index) => {
        const prev = snake[index - 1];
        const next = snake[index + 1];
        // A cauda afina: as três últimas células encolhem progressivamente.
        const fromTail = snake.length - 1 - index;
        if (fromTail < 3 && snake.length > 4) {
            const shrink = (3 - fromTail) * 1.6;
            ctx.fillRect(
                segment.x * GRID_SIZE + 1 + shrink / 2,
                segment.y * GRID_SIZE + 1 + shrink / 2,
                GRID_SIZE - 2 - shrink,
                GRID_SIZE - 2 - shrink
            );
        } else {
            bodyCell(segment.x, segment.y, prev, next);
        }
    });

    if (snake.length) {
        drawTongue(snake[0]);
        ctx.fillStyle = COLORS.snake;
        drawHeadEyes(snake[0]);
        ctx.fillStyle = COLORS.snake;
    }

    // Flash de morte: inverte o LCD por instantes, como um console de verdade.
    if (deathFlash > 0) {
        ctx.globalAlpha = deathFlash * 0.65;
        ctx.fillStyle = COLORS.snake;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1;
    }
}

function gameOver() {
    isGameRunning = false;
    isPaused = false;
    deathFlash = 1;
    sfxDeath();
    stopLoop();
    pauseScreen.classList.add('hidden');
    finalScoreSpan.textContent = score;

    if (score > highScore) {
        highScore = score;
        saveHighScore(highScore);
        announce(`Fim de jogo. Novo recorde: ${score} pontos.`);
    } else {
        announce(`Fim de jogo. ${score} pontos.`);
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
    // Compare against the direction that will actually be applied next step.
    const currentDx = queuedDirection ? queuedDirection.dx : dx;
    const currentDy = queuedDirection ? queuedDirection.dy : dy;
    if (nextDx === -currentDx && nextDy === -currentDy) return;
    if (nextDx === currentDx && nextDy === currentDy) return;
    queuedDirection = { dx: nextDx, dy: nextDy };
    sfxTurn();
}

// Input Handling
function handleInput(key) {
    if (!isGameRunning) {
        if (key === 'Enter' || key === 'Start') {
            initGame();
        }
        return;
    }

    if (isPaused && key !== 'Enter' && key !== 'Start') return;

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
            setPaused(!isPaused);
            break;
    }
}

// Keyboard Listeners
document.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        handleInput(e.key);
        return;
    }
    if (e.key === 'Enter' && !e.target.closest('a, button')) {
        e.preventDefault();
        handleInput('Enter');
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
    btn.addEventListener('click', (e) => e.preventDefault());
});

/* Deslizar na tela: no celular o d-pad desenhado tem 30px e o polegar cobre a
   LCD inteira. O swipe é o controle primário no toque; o d-pad continua ali
   para quem prefere (e para o mouse). Um toque simples inicia/pausa. */
const SWIPE_MIN = 24; // px — abaixo disso é toque, não gesto
let touchStart = null;

if (screenPlay) {
    screenPlay.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        touchStart = { x: e.clientX, y: e.clientY, moved: false };
    });

    screenPlay.addEventListener('pointermove', (e) => {
        if (!touchStart || touchStart.moved) return;
        const deltaX = e.clientX - touchStart.x;
        const deltaY = e.clientY - touchStart.y;
        if (Math.hypot(deltaX, deltaY) < SWIPE_MIN) return;

        touchStart.moved = true;
        // O eixo dominante decide: diagonais viram a direção mais forte em vez
        // de serem descartadas.
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            handleInput(deltaX > 0 ? 'ArrowRight' : 'ArrowLeft');
        } else {
            handleInput(deltaY > 0 ? 'ArrowDown' : 'ArrowUp');
        }
    });

    screenPlay.addEventListener('pointerup', () => {
        if (touchStart && !touchStart.moved) handleInput('Start');
        touchStart = null;
    });

    screenPlay.addEventListener('pointercancel', () => {
        touchStart = null;
    });
}

if (muteBtn) {
    muteBtn.addEventListener('click', () => {
        muted = !muted;
        saveMuted(muted);
        syncMuteButton();
        if (!muted) blip(880, 0.06);
    });
}

document.getElementById('btnStart').addEventListener('click', () => handleInput('Start'));
document.getElementById('btnSelect').addEventListener('click', () => initGame());
document.getElementById('btnA').addEventListener('click', () => {
    if (!isGameRunning) initGame();
});
document.getElementById('btnB').addEventListener('click', () => {
    if (isGameRunning) setPaused(!isPaused);
});

// Pause the loop while the tab is hidden so we never burn frames in background.
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        stopLoop();
    } else if (isGameRunning && !isPaused) {
        accumulator = 0;
        startLoop();
    }
});

// Keep the LCD palette in sync with the theme toggle.
new MutationObserver(() => {
    syncColors();
    draw();
}).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

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
}

window.addEventListener('resize', fitDevice);
window.addEventListener('orientationchange', fitDevice);
window.visualViewport?.addEventListener('resize', fitDevice);

// Initial Draw
syncColors();
syncMuteButton();
updateHud();
fitDevice();
draw();
