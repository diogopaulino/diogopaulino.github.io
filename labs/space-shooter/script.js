const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game State
let gameRunning = false;
let score = 0;
let lives = 3;
let animationId;
let lastTime = 0;

// Entities
const player = {
    x: 0,
    y: 0,
    width: 40,
    height: 40,
    speed: 300, // pixels per second
    color: '#00f3ff',
    dx: 0
};

let bullets = [];
let enemies = [];
let particles = [];
let stars = [];

// Inputs
const keys = {
    ArrowLeft: false,
    ArrowRight: false,
    a: false,
    d: false,
    Space: false
};

// Configuration
const ENEMY_ROWS = 4;
const ENEMY_COLS = 8;
const ENEMY_WIDTH = 30;
const ENEMY_HEIGHT = 30;
const ENEMY_PADDING = 20;
const BULLET_SPEED = 500;
const ENEMY_SPEED_BASE = 50;
let enemySpeed = ENEMY_SPEED_BASE;
let enemyDirection = 1; // 1 right, -1 left

// Audio Context (Simple synth for beeps)
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'shoot') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(110, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'explosion') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
    }
}

// Initialization
function resize() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
    player.y = canvas.height - player.height - 20;
    player.x = canvas.width / 2 - player.width / 2;
}

function initStars() {
    stars = [];
    for (let i = 0; i < 100; i++) {
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 2,
            speed: Math.random() * 0.5 + 0.1
        });
    }
}

function initEnemies() {
    enemies = [];
    const startX = (canvas.width - (ENEMY_COLS * (ENEMY_WIDTH + ENEMY_PADDING))) / 2;
    const startY = 50;

    for (let row = 0; row < ENEMY_ROWS; row++) {
        for (let col = 0; col < ENEMY_COLS; col++) {
            enemies.push({
                x: startX + col * (ENEMY_WIDTH + ENEMY_PADDING),
                y: startY + row * (ENEMY_HEIGHT + ENEMY_PADDING),
                width: ENEMY_WIDTH,
                height: ENEMY_HEIGHT,
                row: row,
                col: col,
                color: row === 0 ? '#ff00ff' : (row === 1 ? '#00ff00' : '#00f3ff')
            });
        }
    }
    enemySpeed = ENEMY_SPEED_BASE + (score / 100); // Increase speed with score
}

function createParticles(x, y, color) {
    for (let i = 0; i < 10; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 100,
            vy: (Math.random() - 0.5) * 100,
            life: 1.0,
            color: color
        });
    }
}

// Input Handling
window.addEventListener('keydown', e => {
    if (keys.hasOwnProperty(e.key) || e.key === ' ') keys[e.key === ' ' ? 'Space' : e.key] = true;
    if (e.key === ' ' && gameRunning) fireBullet();
});

window.addEventListener('keyup', e => {
    if (keys.hasOwnProperty(e.key) || e.key === ' ') keys[e.key === ' ' ? 'Space' : e.key] = false;
});

// Touch/Mouse support for shooting
canvas.addEventListener('mousedown', () => {
    if (gameRunning) fireBullet();
});

function fireBullet() {
    if (bullets.length < 5) { // Max bullets on screen
        bullets.push({
            x: player.x + player.width / 2 - 2,
            y: player.y,
            width: 4,
            height: 10,
            color: '#fff'
        });
        playSound('shoot');
    }
}

// Game Loop
function update(dt) {
    // Player Movement
    if (keys.ArrowLeft || keys.a) player.dx = -player.speed;
    else if (keys.ArrowRight || keys.d) player.dx = player.speed;
    else player.dx = 0;

    player.x += player.dx * dt;
    // Clamp player to screen
    if (player.x < 0) player.x = 0;
    if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;

    // Bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
        bullets[i].y -= BULLET_SPEED * dt;
        if (bullets[i].y < 0) bullets.splice(i, 1);
    }

    // Enemies
    let hitWall = false;
    enemies.forEach(enemy => {
        enemy.x += enemySpeed * enemyDirection * dt;
        if (enemy.x <= 0 || enemy.x + enemy.width >= canvas.width) {
            hitWall = true;
        }
    });

    if (hitWall) {
        enemyDirection *= -1;
        enemies.forEach(enemy => {
            enemy.y += 20; // Move down
        });
    }

    // Collision Detection
    // Bullet vs Enemy
    for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i];
        for (let j = enemies.length - 1; j >= 0; j--) {
            let e = enemies[j];
            if (
                b.x < e.x + e.width &&
                b.x + b.width > e.x &&
                b.y < e.y + e.height &&
                b.y + b.height > e.y
            ) {
                // Hit!
                createParticles(e.x + e.width / 2, e.y + e.height / 2, e.color);
                playSound('explosion');
                enemies.splice(j, 1);
                bullets.splice(i, 1);
                score += 10;
                document.getElementById('score').innerText = score;

                // Check win/respawn
                if (enemies.length === 0) {
                    initEnemies();
                    enemySpeed += 20;
                }
                break;
            }
        }
    }

    // Enemy vs Player (Game Over)
    enemies.forEach(e => {
        if (e.y + e.height >= player.y) {
            gameOver();
        }
    });

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt * 2;
        if (p.life <= 0) particles.splice(i, 1);
    }

    // Stars
    stars.forEach(star => {
        star.y += star.speed;
        if (star.y > canvas.height) star.y = 0;
    });
}

function draw() {
    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Stars
    ctx.fillStyle = '#ffffff';
    stars.forEach(star => {
        ctx.globalAlpha = Math.random() * 0.5 + 0.3;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Draw Player
    ctx.shadowBlur = 20;
    ctx.shadowColor = player.color;
    ctx.fillStyle = player.color;
    // Simple ship shape
    ctx.beginPath();
    ctx.moveTo(player.x + player.width / 2, player.y);
    ctx.lineTo(player.x + player.width, player.y + player.height);
    ctx.lineTo(player.x + player.width / 2, player.y + player.height - 10);
    ctx.lineTo(player.x, player.y + player.height);
    ctx.closePath();
    ctx.fill();

    // Draw Bullets
    ctx.shadowColor = '#fff';
    ctx.fillStyle = '#fff';
    bullets.forEach(b => {
        ctx.fillRect(b.x, b.y, b.width, b.height);
    });

    // Draw Enemies
    enemies.forEach(e => {
        ctx.shadowColor = e.color;
        ctx.fillStyle = e.color;
        // Alien shape (simple invader)
        const w = e.width;
        const h = e.height;
        const x = e.x;
        const y = e.y;

        ctx.fillRect(x + w * 0.2, y, w * 0.6, h * 0.2);
        ctx.fillRect(x, y + h * 0.2, w, h * 0.4);
        ctx.fillRect(x + w * 0.1, y + h * 0.6, w * 0.15, h * 0.3);
        ctx.fillRect(x + w * 0.75, y + h * 0.6, w * 0.15, h * 0.3);
    });

    // Draw Particles
    particles.forEach(p => {
        ctx.shadowBlur = 10;
        ctx.shadowColor = p.color;
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.fillRect(p.x, p.y, 3, 3);
    });
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
}

function loop(timestamp) {
    if (!gameRunning) return;
    const dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    update(dt);
    draw();
    animationId = requestAnimationFrame(loop);
}

function startGame() {
    gameRunning = true;
    score = 0;
    lives = 3;
    document.getElementById('score').innerText = score;
    document.getElementById('lives').innerText = lives;
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('gameOverScreen').classList.add('hidden');

    resize();
    initStars();
    initEnemies();
    lastTime = performance.now();
    loop(lastTime);
}

function gameOver() {
    gameRunning = false;
    cancelAnimationFrame(animationId);
    document.getElementById('finalScore').innerText = score;
    document.getElementById('gameOverScreen').classList.remove('hidden');
}

// Event Listeners for UI
document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', startGame);

// Initial Resize
window.addEventListener('resize', () => {
    resize();
    if (!gameRunning) {
        initStars();
        draw(); // Draw one frame of stars
    }
});

resize();
initStars();
draw(); // Initial draw
