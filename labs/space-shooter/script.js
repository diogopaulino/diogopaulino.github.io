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
/* Modo privado do Safari estoura ao gravar; o recorde é bônus, não pode
   interromper a tela de fim de jogo. */
function readHighScore() {
    try { return Number(localStorage.getItem('neonInvadersHighScore') || 0); } catch (err) { return 0; }
}

function saveHighScore(value) {
    try { localStorage.setItem('neonInvadersHighScore', String(value)); } catch (err) { /* armazenamento indisponível */ }
}

let highScore = readHighScore();
// Tiro contínuo: segurar espaço ou o botão dispara em cadência fixa, em vez de
// exigir um toque por tiro (no celular isso virava tapinha frenético).
const FIRE_INTERVAL = 0.14; // segundos entre disparos com o gatilho preso
let fireHeld = false;
let fireCooldown = 0;
let frameCount = 0;
let enemyFireCooldown = 1.4;

// Entities
const player = {
    x: 0,
    y: 0,
    width: 40,
    height: 40,
    speed: 300, // pixels per second
    color: '#00f3ff',
    dx: 0,
    vx: 0,
    invuln: 0
};

let bullets = [];
let enemyBullets = [];
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

/* Áudio via LabAudio — mudo persistido e mesmo motor dos outros labs. */
const labAudio = window.LabAudio || null;
if (labAudio) {
    labAudio.configure({ storageKey: 'neonInvaders:muted', volume: 0.45 });
    soundEnabled = !labAudio.isMuted();
}

function playSound(type) {
    if (!soundEnabled || !labAudio) return;
    if (type === 'shoot') {
        labAudio.tone({
            freq: 880,
            slideTo: 110,
            duration: 0.1,
            type: 'square',
            gain: 0.1
        });
    } else if (type === 'explosion') {
        labAudio.tone({
            freq: 100,
            slideTo: 40,
            duration: 0.28,
            type: 'sawtooth',
            gain: 0.18
        });
    } else if (type === 'playerHit') {
        labAudio.tone({
            freq: 220,
            slideTo: 55,
            duration: 0.42,
            type: 'sawtooth',
            gain: 0.22
        });
    }
}

const AudioFX = { play: playSound };

// Initialization
function resize() {
    const parent = canvas.parentElement;
    const previousWidth = gameWidth;
    gameWidth = parent.clientWidth;
    gameHeight = parent.clientHeight;

    /* Cap em 2: acima disso o ganho visual some e o fill-rate no celular dobra. */
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.style.width = `${gameWidth}px`;
    canvas.style.height = `${gameHeight}px`;

    canvas.width = Math.floor(gameWidth * dpr);
    canvas.height = Math.floor(gameHeight * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

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
            speed: Math.random() * 0.5 + 0.1,
            phase: Math.random() * Math.PI * 2,
            twinkle: 0.8 + Math.random() * 1.4
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
                color: row % 3 === 0 ? '#ff2ae6' : (row % 3 === 1 ? '#00ff88' : '#00f3ff')
            });
        }
    }
    enemySpeed = ENEMY_SPEED_BASE + (level * 10) + (score / 200);
}

function createParticles(x, y, color) {
    for (let i = 0; i < 12; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 140,
            vy: (Math.random() - 0.5) * 140,
            life: 1.0,
            color: color
        });
    }
}

// A/D usam e.code para Caps Lock e Shift não inverterem o key em 'A'/'D'.
function moveKey(e) {
    if (e.code === 'KeyA') return 'a';
    if (e.code === 'KeyD') return 'd';
    if (e.code === 'Space' || e.key === ' ') return 'Space';
    if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') return e.code;
    return null;
}

// Input Handling
window.addEventListener('keydown', e => {
    const flag = moveKey(e);
    if (flag || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
    }
    if (e.key === 'Enter' && !gameRunning) {
        if (document.activeElement?.tagName !== 'BUTTON') startGame();
        return;
    }
    if (flag) keys[flag] = true;
    if (flag === 'Space' && gameRunning && !e.repeat) {
        fireCooldown = 0;
    }
});

window.addEventListener('keyup', e => {
    const flag = moveKey(e);
    if (flag) keys[flag] = false;
});

// Touch/Mouse support for shooting
canvas.addEventListener('pointerdown', () => {
    if (!gameRunning) return;
    fireHeld = true;
    fireCooldown = 0;
});
window.addEventListener('pointerup', () => { fireHeld = false; });
window.addEventListener('pointercancel', () => { fireHeld = false; });

canvas.addEventListener('pointermove', e => {
    if (!gameRunning || e.pointerType === 'mouse') return;
    const rect = canvas.getBoundingClientRect();
    const nextX = Math.max(0, Math.min(gameWidth - player.width, e.clientX - rect.left - player.width / 2));
    player.vx = (nextX - player.x) * 12;
    player.x = nextX;
});

function fireBullet() {
    const maxBullets = 5 + bulletLevel * 2;
    if (bullets.length < maxBullets) {
        if (bulletLevel === 1) {
            bullets.push({
                x: player.x + player.width / 2 - 2.5,
                y: player.y - 4,
                width: 5,
                height: 14,
                color: '#00f3ff',
                vx: 0
            });
        } else if (bulletLevel === 2) {
            bullets.push({
                x: player.x + 5,
                y: player.y,
                width: 5,
                height: 14,
                color: '#00ff88',
                vx: 0
            });
            bullets.push({
                x: player.x + player.width - 10,
                y: player.y,
                width: 5,
                height: 14,
                color: '#00ff88',
                vx: 0
            });
        } else {
            bullets.push({
                x: player.x + player.width / 2 - 2.5,
                y: player.y - 4,
                width: 5,
                height: 15,
                color: '#ff2ae6',
                vx: 0
            });
            bullets.push({
                x: player.x + 2,
                y: player.y + 4,
                width: 5,
                height: 14,
                color: '#ff2ae6',
                vx: -65
            });
            bullets.push({
                x: player.x + player.width - 7,
                y: player.y + 4,
                width: 5,
                height: 14,
                color: '#ff2ae6',
                vx: 65
            });
        }
        playSound('shoot');
    }
}

function handlePlayerHit() {
    if (player.invuln > 0) return;
    lives--;
    player.invuln = 1.5;
    createParticles(player.x + player.width / 2, player.y + player.height / 2, '#ff3366');
    AudioFX.play('playerHit');
    updateHud();
    if (lives <= 0) {
        gameOver();
    }
}

// Game Loop
function update(dt) {
    frameCount++;
    if (player.invuln > 0) {
        player.invuln = Math.max(0, player.invuln - dt);
    }

    // Gatilho preso: dispara na cadência de FIRE_INTERVAL enquanto estiver ativo.
    const fireOn = fireHeld || Boolean(keys.Space);
    fireCooldown -= dt;
    if (fireOn && fireCooldown <= 0) {
        fireBullet();
        fireCooldown = FIRE_INTERVAL;
    }

    // Player Movement + smooth 2.5D banking velocity
    let targetVx = 0;
    if (keys.ArrowLeft || keys.a) targetVx = -player.speed;
    else if (keys.ArrowRight || keys.d) targetVx = player.speed;

    player.dx = targetVx;
    player.vx += (targetVx - player.vx) * Math.min(1, dt * 12);

    player.x += player.dx * dt;
    // Clamp player to screen
    if (player.x < 0) player.x = 0;
    if (player.x + player.width > gameWidth) player.x = gameWidth - player.width;

    // Bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
        bullets[i].y -= BULLET_SPEED * dt;
        if (bullets[i].vx) bullets[i].x += bullets[i].vx * dt;
        if (bullets[i].y < -20) bullets.splice(i, 1);
    }

    // Enemy Plasma Fire (scales with wave/level)
    enemyFireCooldown -= dt;
    if (enemyFireCooldown <= 0 && enemies.length > 0) {
        const shooter = enemies[Math.floor(Math.random() * enemies.length)];
        const aimDx = (player.x + player.width / 2) - (shooter.x + shooter.width / 2);
        const leadVx = Math.max(-75, Math.min(75, aimDx * 0.28));
        enemyBullets.push({
            x: shooter.x + shooter.width / 2 - 3,
            y: shooter.y + shooter.height,
            width: 6,
            height: 14,
            vx: leadVx,
            vy: 210 + Math.min(180, level * 22),
            color: shooter.color || '#ff3b6b'
        });
        enemyFireCooldown = Math.max(0.38, 1.55 - level * 0.12) * (0.75 + Math.random() * 0.5);
    }

    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const eb = enemyBullets[i];
        eb.x += (eb.vx || 0) * dt;
        eb.y += eb.vy * dt;
        if (eb.y > gameHeight + 20) {
            enemyBullets.splice(i, 1);
            continue;
        }
        if (
            player.invuln <= 0 &&
            eb.x < player.x + player.width - 6 &&
            eb.x + eb.width > player.x + 6 &&
            eb.y < player.y + player.height - 4 &&
            eb.y + eb.height > player.y + 6
        ) {
            enemyBullets.splice(i, 1);
            handlePlayerHit();
            if (!gameRunning) return;
        }
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
                    enemyBullets = [];
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

    // Enemy vs Player
    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        if (e.y + e.height >= player.y + 4) {
            enemies.splice(i, 1);
            handlePlayerHit();
            if (!gameRunning) return;
            if (enemies.length === 0) {
                level++;
                updateHud();
                initEnemies();
            }
            break;
        }
    }

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

function drawPlasmaCapsule(b, isEnemy = false) {
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    const color = b.color || (isEnemy ? '#ff3b6b' : '#00f3ff');

    ctx.save();
    // Halo colorido externo da cápsula de plasma
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(cx, cy, b.width * 1.15, b.height * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cápsula intermediária saturada
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(cx, cy, b.width * 0.65, b.height * 0.52, 0, 0, Math.PI * 2);
    ctx.fill();

    // Núcleo incandescente branco
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(cx, cy, b.width * 0.32, b.height * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function drawShip(starT, fireOn) {
    if (player.invuln > 0 && Math.floor(player.invuln * 14) % 2 === 0) return;

    const cx = player.x + player.width / 2;
    const cy = player.y + player.height / 2;
    const pw = player.width;
    const ph = player.height;
    const bank = Math.max(-0.28, Math.min(0.28, (player.vx || 0) / player.speed * 0.25));

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(bank * 0.45);
    ctx.scale(1 - Math.abs(bank) * 0.22, 1);

    // Pós-combustor animado duplo / central
    const flick = (fireOn ? 0.82 : 0.48) + 0.22 * Math.sin(starT * 36);
    const reach = (fireOn ? 14 : 8) + Math.sin(starT * 45) * 3;
    ctx.save();
    ctx.globalAlpha = flick;
    const flameGrad = ctx.createLinearGradient(0, ph * 0.36, 0, ph * 0.5 + reach);
    flameGrad.addColorStop(0, '#ffffff');
    flameGrad.addColorStop(0.35, '#00f3ff');
    flameGrad.addColorStop(0.75, '#ff2ae6');
    flameGrad.addColorStop(1, 'rgba(255, 42, 230, 0)');
    ctx.fillStyle = flameGrad;
    ctx.beginPath();
    ctx.moveTo(-pw * 0.16, ph * 0.36);
    ctx.lineTo(0, ph * 0.5 + reach);
    ctx.lineTo(pw * 0.16, ph * 0.36);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Canhões duplos de plasma nas asas
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(-pw * 0.38, -ph * 0.26, 3.2, ph * 0.38);
    ctx.fillRect(pw * 0.38 - 3.2, -ph * 0.26, 3.2, ph * 0.38);
    ctx.fillStyle = fireOn ? '#ff2ae6' : '#00f3ff';
    ctx.fillRect(-pw * 0.38, -ph * 0.30, 3.2, 4);
    ctx.fillRect(pw * 0.38 - 3.2, -ph * 0.30, 3.2, 4);

    // Asas metálicas sombreadas em 2.5D (lado esquerdo / direito reage ao banking)
    const leftWingLight = bank > 0 ? '#38bdf8' : '#0284c7';
    const rightWingLight = bank < 0 ? '#38bdf8' : '#0369a1';

    ctx.fillStyle = leftWingLight;
    ctx.beginPath();
    ctx.moveTo(0, -ph * 0.42);
    ctx.lineTo(-pw * 0.52, ph * 0.28);
    ctx.lineTo(-pw * 0.18, ph * 0.18);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = rightWingLight;
    ctx.beginPath();
    ctx.moveTo(0, -ph * 0.42);
    ctx.lineTo(pw * 0.52, ph * 0.28);
    ctx.lineTo(pw * 0.18, ph * 0.18);
    ctx.closePath();
    ctx.fill();

    // Fuselagem central facetada metálica
    const hullGrad = ctx.createLinearGradient(-pw * 0.22, -ph * 0.5, pw * 0.22, ph * 0.5);
    hullGrad.addColorStop(0, '#e0f2fe');
    hullGrad.addColorStop(0.45, '#00f3ff');
    hullGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = hullGrad;
    ctx.beginPath();
    ctx.moveTo(0, -ph * 0.5);
    ctx.lineTo(pw * 0.22, ph * 0.15);
    ctx.lineTo(pw * 0.12, ph * 0.44);
    ctx.lineTo(-pw * 0.12, ph * 0.44);
    ctx.lineTo(-pw * 0.22, ph * 0.15);
    ctx.closePath();
    ctx.fill();

    // Cockpit de cristal com reflexo especular
    ctx.fillStyle = '#082f49';
    ctx.beginPath();
    ctx.ellipse(0, -ph * 0.08, pw * 0.1, ph * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#bae6fd';
    ctx.beginPath();
    ctx.ellipse(-pw * 0.03, -ph * 0.13, pw * 0.04, ph * 0.08, -0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

function drawEnemy(e) {
    const w = e.width;
    const h = e.height;
    const cx = e.x + w * 0.5;
    const cy = e.y + h * 0.5;
    const species = e.row % 3;
    const phase = frameCount * 0.12 + e.col * 0.7 + e.row * 0.5;
    const pulse = Math.sin(phase);

    ctx.save();
    ctx.translate(cx, cy);

    if (species === 0) {
        // Espécie 0: Cefalópode biomecânico imperial com tentáculos oscilantes e coroa neural
        ctx.fillStyle = e.color;
        for (let t = -2; t <= 2; t++) {
            const sway = Math.sin(phase + t * 0.8) * (w * 0.08);
            ctx.beginPath();
            ctx.moveTo(t * w * 0.12, h * 0.05);
            ctx.quadraticCurveTo(t * w * 0.16 + sway, h * 0.28, t * w * 0.14 - sway * 0.6, h * 0.46);
            ctx.lineTo(t * w * 0.14 - sway * 0.6 + 2.5, h * 0.46);
            ctx.quadraticCurveTo(t * w * 0.18 + sway, h * 0.26, t * w * 0.12 + 3, h * 0.05);
            ctx.fill();
        }
        // Domo craniano blindado
        ctx.beginPath();
        ctx.ellipse(0, -h * 0.1, w * 0.38, h * 0.3, 0, Math.PI, 0);
        ctx.lineTo(w * 0.32, h * 0.12);
        ctx.lineTo(-w * 0.32, h * 0.12);
        ctx.closePath();
        ctx.fill();
    } else if (species === 1) {
        // Espécie 1: Invasor aracnídeo com asas bio-plasma batendo
        const wingFlap = pulse * h * 0.14;
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.moveTo(-w * 0.15, -h * 0.1);
        ctx.lineTo(-w * 0.48, -h * 0.25 + wingFlap);
        ctx.lineTo(-w * 0.38, h * 0.28 - wingFlap * 0.5);
        ctx.lineTo(-w * 0.12, h * 0.16);
        ctx.moveTo(w * 0.15, -h * 0.1);
        ctx.lineTo(w * 0.48, -h * 0.25 + wingFlap);
        ctx.lineTo(w * 0.38, h * 0.28 - wingFlap * 0.5);
        ctx.lineTo(w * 0.12, h * 0.16);
        ctx.fill();

        // Carapaça central hexagonal
        ctx.beginPath();
        ctx.ellipse(0, 0, w * 0.26, h * 0.32, 0, 0, Math.PI * 2);
        ctx.fill();
    } else {
        // Espécie 2:Manta cibernética com mandíbulas articuladas
        const jaw = Math.abs(pulse) * w * 0.08;
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.moveTo(0, -h * 0.42);
        ctx.quadraticCurveTo(w * 0.48, -h * 0.08, w * 0.36, h * 0.28);
        ctx.lineTo(w * 0.14 + jaw, h * 0.44);
        ctx.lineTo(0, h * 0.18);
        ctx.lineTo(-w * 0.14 - jaw, h * 0.44);
        ctx.lineTo(-w * 0.36, h * 0.28);
        ctx.quadraticCurveTo(-w * 0.48, -h * 0.08, 0, -h * 0.42);
        ctx.fill();
    }

    // Olhos bioluminescentes comuns às 3 espécies
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(-w * 0.13, -h * 0.06, w * 0.07, h * 0.08, 0, 0, Math.PI * 2);
    ctx.ellipse(w * 0.13, -h * 0.06, w * 0.07, h * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#090d16';
    ctx.beginPath();
    ctx.arc(-w * 0.13, -h * 0.05, w * 0.032, 0, Math.PI * 2);
    ctx.arc(w * 0.13, -h * 0.05, w * 0.032, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
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

    // Draw Stars — twinkle estável (seno), não noise por frame
    const starT = performance.now() / 1000;
    ctx.fillStyle = '#ffffff';
    stars.forEach(star => {
        const tw = 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(starT * star.twinkle + star.phase));
        ctx.globalAlpha = tw;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;

    ctx.shadowBlur = 0;
    const fireOn = fireHeld || Boolean(keys.Space);
    drawShip(starT, fireOn);

    // Draw Player & Enemy Plasma Bullets
    bullets.forEach(b => drawPlasmaCapsule(b, false));
    enemyBullets.forEach(eb => drawPlasmaCapsule(eb, true));

    // Draw Enemies
    enemies.forEach(e => drawEnemy(e));

    // Draw Particles
    particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.fillRect(p.x, p.y, 3, 3);
    });
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
}

function loop(timestamp) {
    if (!gameRunning) return;
    // Teto de 1/30s: sem ele, um frame longo (troca de aba, GC) fazia os
    // inimigos pularem várias linhas e os tiros atravessarem a nave.
    const dt = Math.min((timestamp - lastTime) / 1000, 1 / 30);
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
    bullets = [];
    enemyBullets = [];
    player.invuln = 0;
    player.vx = 0;
    enemyFireCooldown = 1.2;
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
        saveHighScore(highScore);
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
    const hsText = formatScore(Math.max(highScore, score));
    const weaponText = `LASER ${['I', 'II', 'III'][bulletLevel - 1]}`;
    document.getElementById('highScore').innerText = hsText;
    document.getElementById('weaponLevel').innerText = weaponText;
    const mobileHs = document.getElementById('mobileHighScore');
    const mobileWeapon = document.getElementById('mobileWeapon');
    if (mobileHs) mobileHs.innerText = hsText;
    if (mobileWeapon) mobileWeapon.innerText = weaponText;
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

const shootBtn = document.getElementById('shootBtn');
shootBtn.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (!gameRunning) return;
    fireHeld = true;
    fireCooldown = 0;
});
['pointerup', 'pointercancel', 'pointerleave'].forEach(evt => {
    shootBtn.addEventListener(evt, e => {
        e.preventDefault();
        fireHeld = false;
    });
});

function syncSoundToggle() {
    const btn = document.getElementById('soundToggle');
    if (!btn) return;
    btn.setAttribute('aria-pressed', String(soundEnabled));
    btn.lastElementChild.textContent = soundEnabled ? 'Som ativado' : 'Som desativado';
}

document.getElementById('soundToggle').addEventListener('click', () => {
    if (labAudio) {
        labAudio.setMuted(!labAudio.isMuted());
        soundEnabled = !labAudio.isMuted();
    } else {
        soundEnabled = !soundEnabled;
    }
    syncSoundToggle();
});

if (labAudio) {
    labAudio.onChange((muted) => {
        soundEnabled = !muted;
        syncSoundToggle();
    });
}
syncSoundToggle();

// Aba escondida: congela o jogo em vez de deixar a horda avançar sozinha.
function onVisibility(hidden) {
    if (!gameRunning) return;
    if (hidden) {
        cancelAnimationFrame(animationId);
        fireHeld = false;
        keys.ArrowLeft = keys.ArrowRight = keys.a = keys.d = false;
    } else {
        lastTime = performance.now();
        animationId = requestAnimationFrame(loop);
    }
}

if (window.LabVisibility) {
    LabVisibility.onChange(onVisibility);
} else {
    document.addEventListener('visibilitychange', () => onVisibility(document.hidden));
}

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
