const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const finalScoreSpan = document.getElementById('finalScore');
const powerLed = document.querySelector('.power-led');

// Game Constants
const GRID_SIZE = 20;
const TILE_COUNT = canvas.width / GRID_SIZE;
const GAME_SPEED = 100; // ms per frame

// Game State
let snake = [];
let food = { x: 0, y: 0 };
let dx = 0;
let dy = 0;
let score = 0;
let gameLoopId = null;
let isGameRunning = false;
let isPaused = false;

// Colors (match CSS variables)
const COLORS = {
    bg: '#9bbc0f',
    snake: '#0f380f',
    food: '#0f380f'
};

// Initialize Game
function initGame() {
    snake = [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
        { x: 8, y: 10 }
    ];
    dx = 1;
    dy = 0;
    score = 0;
    placeFood();
    isGameRunning = true;
    isPaused = false;

    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    powerLed.classList.add('on');

    if (gameLoopId) clearInterval(gameLoopId);
    gameLoopId = setInterval(gameLoop, GAME_SPEED);
}

function placeFood() {
    food.x = Math.floor(Math.random() * TILE_COUNT);
    food.y = Math.floor(Math.random() * TILE_COUNT);

    // Don't place food on snake
    for (let segment of snake) {
        if (segment.x === food.x && segment.y === food.y) {
            placeFood();
            break;
        }
    }
}

function gameLoop() {
    if (isPaused) return;

    update();
    draw();
}

function update() {
    // Move Snake
    const head = { x: snake[0].x + dx, y: snake[0].y + dy };

    // Check Wall Collision
    if (head.x < 0 || head.x >= TILE_COUNT || head.y < 0 || head.y >= TILE_COUNT) {
        gameOver();
        return;
    }

    // Check Self Collision
    for (let segment of snake) {
        if (head.x === segment.x && head.y === segment.y) {
            gameOver();
            return;
        }
    }

    snake.unshift(head);

    // Check Food Collision
    if (head.x === food.x && head.y === food.y) {
        score += 10;
        placeFood();
        // Maybe speed up slightly?
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
    clearInterval(gameLoopId);
    finalScoreSpan.textContent = score;
    gameOverScreen.classList.remove('hidden');
    powerLed.classList.remove('on');
}

// Input Handling
function handleInput(key) {
    if (!isGameRunning) {
        if (key === 'Enter' || key === 'Start') {
            initGame();
        }
        return;
    }

    // Prevent reversing direction directly
    switch (key) {
        case 'ArrowUp':
            if (dy !== 1) { dx = 0; dy = -1; }
            break;
        case 'ArrowDown':
            if (dy !== -1) { dx = 0; dy = 1; }
            break;
        case 'ArrowLeft':
            if (dx !== 1) { dx = -1; dy = 0; }
            break;
        case 'ArrowRight':
            if (dx !== -1) { dx = 1; dy = 0; }
            break;
        case 'Enter':
        case 'Start':
            isPaused = !isPaused;
            break;
    }
}

// Keyboard Listeners
document.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) {
        e.preventDefault();
        handleInput(e.key);
    }
});

// Touch/Click Listeners for On-Screen Controls
const dpadButtons = document.querySelectorAll('.d-pad > div[data-key]');
dpadButtons.forEach(btn => {
    btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        handleInput(btn.dataset.key);
    });
    btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        handleInput(btn.dataset.key);
    });
});

document.getElementById('btnStart').addEventListener('click', () => handleInput('Start'));
document.getElementById('btnA').addEventListener('click', () => {
    if (!isGameRunning) initGame();
});

// Initial Draw
ctx.fillStyle = COLORS.bg;
ctx.fillRect(0, 0, canvas.width, canvas.height);
