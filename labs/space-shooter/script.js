const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game State
let gameRunning = false;
let score = 0;
let lives = 3;
let level = 1;
let bulletLevel = 1;
let animationId;
let lastTime = 0;
let gameWidth = 0;
let gameHeight = 0;
let soundEnabled = true;
let highScore = Number(localStorage.getItem('neonInvadersHighScore') || 0);

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
let audioCtx;

function playSound(type) {
    if (!soundEnabled) return;
    if (!audioCtx) audioCtx = new AudioContext();
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
    const parent = canvas.parentElement;
    const previousWidth = gameWidth;
    gameWidth = parent.clientWidth;
    gameHeight = parent.clientHeight;

    const dpr = window.devicePixelRatio || 1;

    canvas.style.width = `${gameWidth}px`;
    canvas.style.height = `${gameHeight}px`;

    canvas.width = Math.floor(gameWidth * dpr);
    canvas.height = Math.floor(gameHeight * dpr);

    ctx.scale(dpr, dpr);

    player.y = gameHeight - player.height - 26;
    player.x = previousWidth
        ? Math.min(gameWidth - player.width, Math.max(0, player.x * (gameWidth / previousWidth)))
        : gameWidth / 2 - player.width / 2;
}

function initStars() {
    stars = [];
    for (let i = 0; i < 100; i++) {
        stars.push({
            x: Math.random() * gameWidth,
            y: Math.random() * gameHeight,
            size: Math.random() * 2,
            speed: Math.random() * 0.5 + 0.1
        });
    }
}

function initEnemies() {
    enemies = [];
    const enemyPadding = Math.max(6, Math.min(ENEMY_PADDING, gameWidth * 0.025));
    const enemyWidth = Math.max(18, Math.min(ENEMY_WIDTH, (gameWidth - 28 - (ENEMY_COLS - 1) * enemyPadding) / ENEMY_COLS));
    const enemyHeight = enemyWidth;
    const formationWidth = ENEMY_COLS * enemyWidth + (ENEMY_COLS - 1) * enemyPadding;
    const startX = Math.max(10, (gameWidth - formationWidth) / 2);
    const startY = Math.max(64, gameHeight * .1);

    for (let row = 0; row < ENEMY_ROWS; row++) {
        for (let col = 0; col < ENEMY_COLS; col++) {
            enemies.push({
                x: startX + col * (enemyWidth + enemyPadding),
                y: startY + row * (enemyHeight + enemyPadding),
                width: enemyWidth,
                height: enemyHeight,
                row: row,
                col: col,
                color: row === 0 ? '#ff00ff' : (row === 1 ? '#00ff00' : '#00f3ff')
            });
        }
    }
    enemySpeed = ENEMY_SPEED_BASE + (level * 10) + (score / 200);
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
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
    }
    if (e.key === 'Enter' && !gameRunning) {
        if (document.activeElement?.tagName !== 'BUTTON') startGame();
        return;
    }
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

canvas.addEventListener('pointermove', e => {
    if (!gameRunning || e.pointerType === 'mouse') return;
    const rect = canvas.getBoundingClientRect();
    player.x = Math.max(0, Math.min(gameWidth - player.width, e.clientX - rect.left - player.width / 2));
});

function fireBullet() {
    const maxBullets = 5 + bulletLevel * 2;
    if (bullets.length < maxBullets) {
        if (bulletLevel === 1) {
            bullets.push({
                x: player.x + player.width / 2 - 2,
                y: player.y,
                width: 4,
                height: 10,
                color: '#fff',
                vx: 0
            });
        } else if (bulletLevel === 2) {
            bullets.push({
                x: player.x + 5,
                y: player.y,
                width: 4,
                height: 10,
                color: '#00ff00',
                vx: 0
            });
            bullets.push({
                x: player.x + player.width - 9,
                y: player.y,
                width: 4,
                height: 10,
                color: '#00ff00',
                vx: 0
            });
        } else {
            bullets.push({
                x: player.x + player.width / 2 - 2,
                y: player.y,
                width: 4,
                height: 10,
                color: '#ff00ff',
                vx: 0
            });
            bullets.push({
                x: player.x,
                y: player.y + 5,
                width: 4,
                height: 10,
                color: '#ff00ff',
                vx: -50
            });
            bullets.push({
                x: player.x + player.width - 4,
                y: player.y + 5,
                width: 4,
                height: 10,
                color: '#ff00ff',
                vx: 50
            });
        }
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
    if (player.x + player.width > gameWidth) player.x = gameWidth - player.width;

    // Bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
        bullets[i].y -= BULLET_SPEED * dt;
        if (bullets[i].vx) bullets[i].x += bullets[i].vx * dt;
        if (bullets[i].y < 0) bullets.splice(i, 1);
    }

    // Enemies
    let hitRight = false;
    let hitLeft = false;

    enemies.forEach(enemy => {
        enemy.x += enemySpeed * enemyDirection * dt;
        if (enemy.x <= 0) hitLeft = true;
        if (enemy.x + enemy.width >= gameWidth) hitRight = true;
    });

    if (hitLeft && enemyDirection === -1) {
        enemyDirection = 1;
        enemies.forEach(enemy => {
            enemy.y += 20;
            enemy.x += 5; // Push away from wall
        });
    } else if (hitRight && enemyDirection === 1) {
        enemyDirection = -1;
        enemies.forEach(enemy => {
            enemy.y += 20;
            enemy.x -= 5; // Push away from wall
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
                updateHud();

                // Check win/respawn
                if (enemies.length === 0) {
                    level++;
                    updateHud();
                    initEnemies();
                }

                // Level up bullets
                if (score >= 500 && bulletLevel < 2) {
                    bulletLevel = 2;
                    updateHud();
                }
                if (score >= 1500 && bulletLevel < 3) {
                    bulletLevel = 3;
                    updateHud();
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
        if (star.y > gameHeight) star.y = 0;
    });
}

function draw() {
    const spaceGradient = ctx.createLinearGradient(0, 0, 0, gameHeight);
    spaceGradient.addColorStop(0, '#060714');
    spaceGradient.addColorStop(.55, '#03040a');
    spaceGradient.addColorStop(1, '#080510');
    ctx.fillStyle = spaceGradient;
    ctx.fillRect(0, 0, gameWidth, gameHeight);

    ctx.strokeStyle = 'rgba(89, 243, 255, .045)';
    ctx.lineWidth = 1;
    const horizon = gameHeight * .64;
    for (let y = horizon; y < gameHeight; y += 28) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(gameWidth, y);
        ctx.stroke();
    }
    for (let x = -gameWidth; x < gameWidth * 2; x += 56) {
        ctx.beginPath();
        ctx.moveTo(gameWidth / 2, horizon);
        ctx.lineTo(x, gameHeight);
        ctx.stroke();
    }

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
    level = 1;
    bulletLevel = 1;
    updateHud();
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
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('neonInvadersHighScore', String(highScore));
    }
    updateHud();
    document.getElementById('finalScore').innerText = formatScore(score);
    document.getElementById('gameOverScreen').classList.remove('hidden');
}

// Event Listeners for UI
document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', startGame);

function formatScore(value) {
    return String(value).padStart(6, '0');
}

function updateHud() {
    document.getElementById('score').innerText = formatScore(score);
    document.getElementById('level').innerText = String(level).padStart(2, '0');
    document.getElementById('lives').innerText = Array(lives).fill('♥').join(' ');
    document.getElementById('highScore').innerText = formatScore(Math.max(highScore, score));
    document.getElementById('weaponLevel').innerText = `LASER ${['I', 'II', 'III'][bulletLevel - 1]}`;
}

function bindHoldControl(element, keyName) {
    const activate = e => {
        e.preventDefault();
        keys[keyName] = true;
    };
    const deactivate = e => {
        e.preventDefault();
        keys[keyName] = false;
    };
    element.addEventListener('pointerdown', activate);
    element.addEventListener('pointerup', deactivate);
    element.addEventListener('pointercancel', deactivate);
    element.addEventListener('pointerleave', deactivate);
}

bindHoldControl(document.getElementById('moveLeft'), 'ArrowLeft');
bindHoldControl(document.getElementById('moveRight'), 'ArrowRight');

document.getElementById('shootBtn').addEventListener('pointerdown', e => {
    e.preventDefault();
    if (gameRunning) fireBullet();
});

document.getElementById('soundToggle').addEventListener('click', e => {
    soundEnabled = !soundEnabled;
    e.currentTarget.setAttribute('aria-pressed', String(soundEnabled));
    e.currentTarget.lastElementChild.textContent = soundEnabled ? 'Som ativado' : 'Som desativado';
});

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
updateHud();
draw(); // Initial draw
