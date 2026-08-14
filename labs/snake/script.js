const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('startScreen');
const pauseScreen = document.getElementById('pauseScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const finalScoreSpan = document.getElementById('finalScore');
const hudScore = document.getElementById('hudScore');
const hudBest = document.getElementById('hudBest');
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

function updateHud() {
    hudScore.textContent = pad(score);
    hudBest.textContent = pad(highScore);
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
    updateHud();
    announce('Partida iniciada.');

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
        updateHud();
    } else {
        snake.pop();
    }
}

function draw() {
    // Clear Screen
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Snake
    ctx.fillStyle = COLORS.snake;
    snake.forEach((segment, index) => {
        // Draw slightly smaller rect for segment effect
        ctx.fillRect(
            segment.x * GRID_SIZE + 1,
            segment.y * GRID_SIZE + 1,
            GRID_SIZE - 2,
            GRID_SIZE - 2
        );

        // Draw eyes on head
        if (index === 0) {
            ctx.fillStyle = COLORS.bg;
            const eyeSize = 4;
            // Position eyes based on direction
            let ex1, ey1, ex2, ey2;

            if (dx === 1) { // Right
                ex1 = (segment.x + 1) * GRID_SIZE - 6; ey1 = segment.y * GRID_SIZE + 4;
                ex2 = (segment.x + 1) * GRID_SIZE - 6; ey2 = (segment.y + 1) * GRID_SIZE - 8;
            } else if (dx === -1) { // Left
                ex1 = segment.x * GRID_SIZE + 2; ey1 = segment.y * GRID_SIZE + 4;
                ex2 = segment.x * GRID_SIZE + 2; ey2 = (segment.y + 1) * GRID_SIZE - 8;
            } else if (dy === -1) { // Up
                ex1 = segment.x * GRID_SIZE + 4; ey1 = segment.y * GRID_SIZE + 2;
                ex2 = (segment.x + 1) * GRID_SIZE - 8; ey2 = segment.y * GRID_SIZE + 2;
            } else { // Down
                ex1 = segment.x * GRID_SIZE + 4; ey1 = (segment.y + 1) * GRID_SIZE - 6;
                ex2 = (segment.x + 1) * GRID_SIZE - 8; ey2 = (segment.y + 1) * GRID_SIZE - 6;
            }

            ctx.fillRect(ex1, ey1, eyeSize, eyeSize);
            ctx.fillRect(ex2, ey2, eyeSize, eyeSize);
            ctx.fillStyle = COLORS.snake; // Reset color
        }
    });

    // Draw Food
    ctx.fillStyle = COLORS.food;
    // Draw pixelated apple/food
    const fx = food.x * GRID_SIZE;
    const fy = food.y * GRID_SIZE;
    const p = GRID_SIZE / 4;

    // Simple cross shape for food
    ctx.fillRect(fx + p, fy, p * 2, GRID_SIZE);
    ctx.fillRect(fx, fy + p, GRID_SIZE, p * 2);
}

function gameOver() {
    isGameRunning = false;
    isPaused = false;
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
updateHud();
fitDevice();
draw();
