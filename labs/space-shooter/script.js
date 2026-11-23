/* setPointerCapture lança InvalidStateError se o ponteiro já foi solto (toque
   muito curto, evento sintético). A captura é um bônus: sem ela o gesto segue. */
function capturePointer(element, pointerId) {
    try {
        element.setPointerCapture(pointerId);
    } catch (err) {
        /* segue sem captura */
    }
}

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

/* Regras ---------------------------------------------------------------------
   · Formação de 4×8 invasores (3×8 em tela baixa) anda de lado e desce
     `stepDown` px ao bater na borda. Pontos por fileira, como no fliperama:
     fileira de cima 30, do meio 20, de baixo 10. Limpar = nova onda (nível+1).
   · Velocidade da formação (px/s), acelerando conforme ela encolhe:
       v = (50 + nível·10) · modo.enemySpeed · (1 + 1,6 · (1 − vivos/total))
   · Tiro inimigo: só quem está na base de cada coluna atira (não há tiro
     "atravessando" a própria formação). Antes de atirar o invasor CARREGA por
     0,45 s (brilho crescente) — o aviso que deixa o padrão legível.
     Intervalo entre disparos: max(0,38, 1,55 − nível·0,12) · (0,75..1,25) · modo.enemyFire s.
     Tipos: mira (magenta, aponta para a nave, ±35°), queda (verde, reta) e
     leque (ciano, 3 tiros a −18°/0°/+18°, a partir da onda 3).
   · Hitbox da nave: círculo de 4 px no cockpit (o ponto brilhante), como nos
     shmups modernos — o desenho da nave é bem maior que a área que leva dano.
     Tiros inimigos são círculos de 4,5 px. Colisão = distância < soma dos raios.
   · Power-ups (cápsulas que caem a 110 px/s): 6% de chance por invasor e
     100% na nave-mãe. W = laser +1 (máx. III; depois vale 500 pts),
     S = escudo (absorve 1 tiro), R = turbo (cadência 0,14 → 0,08 s por 10 s),
     ♥ = vida extra (até vidas iniciais + 2).
   · Nave-mãe: cruza o topo a cada 16–26 s, vale 150 ou 300 pontos.
   · Levar tiro tira 1 vida, apaga tiros num raio de 90 px e dá 1,6 s de
     invencibilidade; no Normal o laser também cai 1 nível. Se a formação
     chega à altura da nave, ela "passa": −1 vida e a onda recomeça do topo.
     Sem vidas = fim de jogo.
   · Nave: aceleração exponencial até 330 px/s (resposta k = 14/s), então ela
     tem um pouco de inércia sem ficar escorregadia. No toque o movimento é
     RELATIVO (o dedo arrasta a nave de onde ela está, ×1,2): o dedo não cobre
     a nave.
   · Simulação em passos de no máximo 1/120 s (um quadro longo vira vários
     passos curtos; acima de 1/20 s o tempo é descartado). Nada atravessa nada.
   · Fácil (padrão, pensado para crianças): 5 vidas, tiro automático, formação
     e tiros inimigos mais lentos. Normal: 3 vidas, arcade clássico. */
const MODES = {
    easy: { lives: 5, autoFire: true, enemySpeed: 0.7, enemyFire: 1.6, enemyBulletSpeed: 0.75, keepWeapon: true },
    normal: { lives: 3, autoFire: false, enemySpeed: 1, enemyFire: 1, enemyBulletSpeed: 1, keepWeapon: false }
};
const MODE_KEY = 'neonInvaders:mode';
let mode = (() => {
    try {
        const saved = localStorage.getItem(MODE_KEY);
        return saved in MODES ? saved : 'easy';
    } catch (err) {
        return 'easy';
    }
})();

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// Game State
let gameRunning = false;
let paused = false;
// Faixa “ONDA 2!” / “-1 VIDA” desenhada no canvas; some sozinha.
const banner = { text: '', color: '#59f3ff', time: 0 };
let score = 0;
let lives = 3;
let level = 1;
let bulletLevel = 1;
let animationId = 0;
let lastTime = 0;
let simTime = 0;
let gameWidth = 0;
let gameHeight = 0;
let soundEnabled = true;
let shake = 0;
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
const RAPID_INTERVAL = 0.085;
const firingPointers = new Set();
let fireCooldown = 0;
let enemyFireCooldown = 1.4;
let ufoTimer = 18;

// Entities
const player = {
    x: 0,
    y: 0,
    width: 40,
    height: 40,
    maxSpeed: 330, // px/s
    response: 14,  // 1/s — quão rápido a velocidade alcança o alvo
    vx: 0,
    invuln: 0,
    shield: false,
    rapid: 0
};
const HIT_RADIUS = 4;
const PICKUP_RADIUS = 26;
const ENEMY_BULLET_RADIUS = 4.5;

let bullets = [];
let enemyBullets = [];
let enemies = [];
let powerUps = [];
let stars = [];
let ufo = null;
let formationTotal = 1;

/* Partículas num pool fixo: explosões não alocam objetos novos por quadro. */
const PARTICLE_MAX = 320;
const particles = Array.from({ length: PARTICLE_MAX }, () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, color: '#fff' }));
let particleCursor = 0;

// Inputs
const keys = {
    ArrowLeft: false,
    ArrowRight: false,
    a: false,
    d: false,
    Space: false
};
let drag = null; // { id, x } — arraste relativo (toque/caneta/mouse)

// Configuration
const ENEMY_ROWS = 4;
const ENEMY_COLS = 8;
const ENEMY_WIDTH = 30;
const ENEMY_PADDING = 20;
const BULLET_SPEED = 560;
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
    switch (type) {
        case 'shoot':
            labAudio.tone({ freq: 880, slideTo: 110, duration: 0.08, type: 'square', gain: 0.06 });
            break;
        case 'explosion':
            labAudio.tone({ freq: 100, slideTo: 40, duration: 0.24, type: 'sawtooth', gain: 0.14 });
            labAudio.noise({ duration: 0.16, gain: 0.08, filter: 1400 });
            break;
        case 'playerHit':
            labAudio.tone({ freq: 220, slideTo: 55, duration: 0.42, type: 'sawtooth', gain: 0.22 });
            labAudio.noise({ duration: 0.35, gain: 0.16, filter: 700 });
            break;
        case 'shieldHit':
            labAudio.tone({ freq: 660, slideTo: 220, duration: 0.25, type: 'triangle', gain: 0.16 });
            break;
        case 'power':
            labAudio.sequence([660, 880, 1320], { step: 0.05, duration: 0.09, gain: 0.1, type: 'triangle' });
            break;
        case 'ufo':
            labAudio.sequence([440, 560, 440, 560], { step: 0.09, duration: 0.08, gain: 0.06, type: 'sine' });
            break;
        case 'wave':
            labAudio.sequence([523, 659, 784, 1047], { step: 0.07, duration: 0.1, gain: 0.09 });
            break;
    }
}

function buzz(pattern) {
    try {
        navigator.vibrate?.(pattern);
    } catch (err) {
        /* alguns navegadores expõem vibrate mas recusam a chamada */
    }
}

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

    /* No toque, a nave fica acima dos botões na base da tela: sem isso, nas
       bordas ela sumia embaixo do direcional e do ATIRAR. */
    const pads = document.querySelector('.touch-controls');
    const padsHeight = pads && pads.offsetParent ? pads.offsetHeight + 20 : 0;
    player.y = gameHeight - player.height - Math.max(26, padsHeight);
    // Topo livre para a formação: abaixo do HUD e da barra de recorde (celular),
    // senão a primeira fileira nascia escondida atrás dela.
    const hud = document.querySelector('.ui-layer');
    const bar = document.getElementById('mobileMissionBar');
    const barBottom = bar && getComputedStyle(bar).display !== 'none' ? bar.offsetTop + bar.offsetHeight : 0;
    topSafe = Math.max(hud ? hud.offsetHeight : 0, barBottom) + 10;
    buildBackdrop();
    player.x = previousWidth
        ? Math.min(gameWidth - player.width, Math.max(0, player.x * (gameWidth / previousWidth)))
        : gameWidth / 2 - player.width / 2;
}

function initStars() {
    stars = [];
    for (let i = 0; i < 110; i++) {
        const depth = Math.random();
        stars.push({
            x: Math.random() * gameWidth,
            y: Math.random() * gameHeight,
            // Paralaxe: estrela "perto" é maior, mais clara e mais rápida.
            size: 0.4 + depth * 1.6,
            speed: 8 + depth * 46,
            phase: Math.random() * Math.PI * 2,
            twinkle: 0.8 + Math.random() * 1.4
        });
    }
}

/* Fundo estático (gradiente + grade em perspectiva) num canvas fora da tela:
   refeito só no resize, em vez de um gradiente e 40 strokes por frame. */
const backdrop = document.createElement('canvas');

function buildBackdrop() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    backdrop.width = Math.max(1, Math.floor(gameWidth * dpr));
    backdrop.height = Math.max(1, Math.floor(gameHeight * dpr));
    const b = backdrop.getContext('2d');
    b.setTransform(dpr, 0, 0, dpr, 0, 0);
    const spaceGradient = b.createLinearGradient(0, 0, 0, gameHeight);
    spaceGradient.addColorStop(0, '#060714');
    spaceGradient.addColorStop(.55, '#03040a');
    spaceGradient.addColorStop(1, '#080510');
    b.fillStyle = spaceGradient;
    b.fillRect(0, 0, gameWidth, gameHeight);

    // Nebulosa discreta: profundidade sem competir com os tiros.
    const neb = b.createRadialGradient(gameWidth * 0.72, gameHeight * 0.22, 0, gameWidth * 0.72, gameHeight * 0.22, gameWidth * 0.6);
    neb.addColorStop(0, 'rgba(255, 42, 230, 0.07)');
    neb.addColorStop(1, 'rgba(255, 42, 230, 0)');
    b.fillStyle = neb;
    b.fillRect(0, 0, gameWidth, gameHeight);

    b.strokeStyle = 'rgba(89, 243, 255, .045)';
    b.lineWidth = 1;
    const horizon = gameHeight * .64;
    b.beginPath();
    for (let y = horizon; y < gameHeight; y += 28) {
        b.moveTo(0, y);
        b.lineTo(gameWidth, y);
    }
    for (let x = -gameWidth; x < gameWidth * 2; x += 56) {
        b.moveTo(gameWidth / 2, horizon);
        b.lineTo(x, gameHeight);
    }
    b.stroke();
}

/* Passo de descida da formação: proporcional à altura, para a tela deitada
   (300px de altura) não ser invadida em três batidas na borda. */
let stepDown = 20;
let topSafe = 64; // medido no resize (HUD + barra de recorde)

const ROW_POINTS = [30, 20, 20, 10];

function initEnemies() {
    enemies = [];
    const enemyPadding = Math.max(6, Math.min(ENEMY_PADDING, gameWidth * 0.025));
    // Tela baixa (celular deitado, ~250px): 3 fileiras e o topo logo abaixo do HUD.
    const short = gameHeight < 360;
    const rows = short ? 3 : ENEMY_ROWS;
    const startY = Math.max(topSafe, short ? 0 : gameHeight * .1);
    // A formação ocupa no máximo ~42% do espaço entre o topo e a nave.
    const roomY = Math.max(56, (player.y - startY) * 0.42);
    const fitH = (roomY - (rows - 1) * 4) / rows;
    const enemyWidth = Math.max(16, Math.min(ENEMY_WIDTH, fitH, (gameWidth - 28 - (ENEMY_COLS - 1) * enemyPadding) / ENEMY_COLS));
    const enemyHeight = enemyWidth;
    const padY = Math.max(4, Math.min(enemyPadding, (roomY - rows * enemyHeight) / (rows - 1)));
    const formationWidth = ENEMY_COLS * enemyWidth + (ENEMY_COLS - 1) * enemyPadding;
    const startX = Math.max(10, (gameWidth - formationWidth) / 2);
    stepDown = Math.max(10, Math.min(20, gameHeight * 0.03));

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < ENEMY_COLS; col++) {
            const species = row % 3;
            enemies.push({
                x: startX + col * (enemyWidth + enemyPadding),
                y: startY + row * (enemyHeight + padY),
                width: enemyWidth,
                height: enemyHeight,
                row: row,
                col: col,
                species,
                points: ROW_POINTS[Math.min(row, ROW_POINTS.length - 1)],
                color: species === 0 ? '#ff2ae6' : (species === 1 ? '#00ff88' : '#00f3ff'),
                charge: 0,
                hitFlash: 0
            });
        }
    }
    formationTotal = enemies.length;
    enemySpeed = (ENEMY_SPEED_BASE + level * 10) * MODES[mode].enemySpeed;
    enemyDirection = 1;
}

function showBanner(text, color = '#59f3ff') {
    banner.text = text;
    banner.color = color;
    banner.time = 1.6;
}

function createParticles(x, y, color, count = 12, speed = 140) {
    for (let i = 0; i < count; i++) {
        const p = particles[particleCursor];
        particleCursor = (particleCursor + 1) % PARTICLE_MAX;
        const angle = Math.random() * Math.PI * 2;
        const v = speed * (0.35 + Math.random() * 0.65);
        p.x = x;
        p.y = y;
        p.vx = Math.cos(angle) * v;
        p.vy = Math.sin(angle) * v;
        p.life = 0.7 + Math.random() * 0.3;
        p.color = color;
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
    if ((e.code === 'KeyP' || e.code === 'Escape') && gameRunning && !e.repeat) {
        e.preventDefault();
        setPaused(!paused);
        return;
    }
    if (e.key === 'Enter' && paused && document.activeElement?.tagName !== 'BUTTON') {
        setPaused(false);
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

// Cada dedo mantém o próprio disparo até ser solto, mesmo com o direcional em uso.
function bindFireControl(element) {
    element.addEventListener('pointerdown', event => {
        if (!gameRunning || paused || event.button !== 0) return;
        event.preventDefault();
        capturePointer(element, event.pointerId);
        firingPointers.add(event.pointerId);
        fireCooldown = Math.min(fireCooldown, 0);
    });
    const release = event => firingPointers.delete(event.pointerId);
    element.addEventListener('pointerup', release);
    element.addEventListener('pointercancel', release);
    element.addEventListener('lostpointercapture', release);
}
bindFireControl(canvas);

/* Arraste relativo na tela: a nave anda o quanto o dedo anda (×1,2), a partir
   de onde ela está — o dedo pode ficar abaixo dela, sem cobri-la. */
const DRAG_GAIN = 1.2;
canvas.addEventListener('pointerdown', e => {
    if (!gameRunning || paused || e.button !== 0) return;
    drag = { id: e.pointerId, x: e.clientX, t: performance.now() };
});
canvas.addEventListener('pointermove', e => {
    if (!drag || drag.id !== e.pointerId || !gameRunning || paused) return;
    const now = performance.now();
    const dx = (e.clientX - drag.x) * DRAG_GAIN;
    const dt = Math.max(1 / 240, (now - drag.t) / 1000);
    drag.x = e.clientX;
    drag.t = now;
    player.x = Math.max(0, Math.min(gameWidth - player.width, player.x + dx));
    // Só para a inclinação (banking): a posição já foi aplicada acima.
    player.vx += (Math.max(-player.maxSpeed, Math.min(player.maxSpeed, dx / dt)) - player.vx) * 0.5;
});
['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => {
    canvas.addEventListener(type, e => {
        if (drag && drag.id === e.pointerId) drag = null;
    });
});

function pushBullet(x, y, vx, color, w = 5, h = 14) {
    bullets.push({ x, y, width: w, height: h, color, vx });
}

function fireBullet() {
    const maxBullets = 6 + bulletLevel * 3;
    if (bullets.length >= maxBullets) return;
    const cx = player.x + player.width / 2;
    if (bulletLevel === 1) {
        pushBullet(cx - 2.5, player.y - 4, 0, '#00f3ff');
    } else if (bulletLevel === 2) {
        pushBullet(player.x + 5, player.y, 0, '#00ff88');
        pushBullet(player.x + player.width - 10, player.y, 0, '#00ff88');
    } else {
        pushBullet(cx - 2.5, player.y - 4, 0, '#ff2ae6', 5, 15);
        pushBullet(player.x + 2, player.y + 4, -65, '#ff2ae6');
        pushBullet(player.x + player.width - 7, player.y + 4, 65, '#ff2ae6');
    }
    playSound('shoot');
}

function weaponName() {
    return `LASER ${['I', 'II', 'III'][bulletLevel - 1]}`;
}

function handlePlayerHit() {
    if (player.invuln > 0) return;
    const hx = player.x + player.width / 2;
    const hy = player.y + player.height / 2;
    // Tiros perto da nave somem: ninguém morre duas vezes no mesmo instante.
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const b = enemyBullets[i];
        if (Math.hypot(b.x - hx, b.y - hy) < 90) enemyBullets.splice(i, 1);
    }
    if (player.shield) {
        player.shield = false;
        player.invuln = 1;
        createParticles(hx, hy, '#59f3ff', 18, 160);
        playSound('shieldHit');
        buzz(25);
        showBanner('ESCUDO PERDIDO', '#59f3ff');
        return;
    }
    lives--;
    player.invuln = 1.6;
    if (!reducedMotion.matches) shake = 0.35;
    createParticles(hx, hy, '#ff3366', 26, 200);
    playSound('playerHit');
    buzz([40, 40, 80]);
    if (!MODES[mode].keepWeapon && bulletLevel > 1) {
        bulletLevel--;
        showBanner(`${weaponName()}  ·  −1 VIDA`, '#ff4fd8');
    }
    updateHud();
    if (lives <= 0) {
        gameOver();
    }
}

/* --- Power-ups ------------------------------------------------------------ */
const POWER_TYPES = {
    w: { label: 'W', color: '#b7ff4a', name: 'LASER' },
    s: { label: 'S', color: '#59f3ff', name: 'ESCUDO' },
    r: { label: 'R', color: '#ffd23f', name: 'TURBO' },
    h: { label: '♥', color: '#ff4f8b', name: 'VIDA' }
};

function rollPowerUp() {
    const maxLives = MODES[mode].lives + 2;
    const table = [['w', 40], ['s', 25], ['r', 25]];
    if (lives < maxLives) table.push(['h', 10]);
    const total = table.reduce((t, [, w]) => t + w, 0);
    let pick = Math.random() * total;
    for (const [type, weight] of table) {
        pick -= weight;
        if (pick <= 0) return type;
    }
    return 'w';
}

function dropPowerUp(x, y, guaranteed = false) {
    if (!guaranteed && Math.random() > 0.06) return;
    powerUps.push({ x, y, type: rollPowerUp(), phase: Math.random() * Math.PI * 2 });
}

function collectPowerUp(p) {
    const info = POWER_TYPES[p.type];
    if (p.type === 'w') {
        if (bulletLevel < 3) {
            bulletLevel++;
            showBanner(`${weaponName()}!`, info.color);
        } else {
            score += 500;
            showBanner('LASER MÁX · +500', info.color);
        }
    } else if (p.type === 's') {
        player.shield = true;
        showBanner('ESCUDO ATIVO', info.color);
    } else if (p.type === 'r') {
        player.rapid = 10;
        showBanner('TURBO 10 s', info.color);
    } else if (p.type === 'h') {
        lives = Math.min(MODES[mode].lives + 2, lives + 1);
        showBanner('+1 VIDA', info.color);
    }
    createParticles(p.x, p.y, info.color, 14, 120);
    playSound('power');
    buzz(15);
    updateHud();
}

/* --- Tiro inimigo --------------------------------------------------------- */
function pickShooter() {
    // Só o invasor mais baixo de cada coluna atira.
    const bottom = [];
    for (const e of enemies) {
        if (e.charge > 0) continue;
        const current = bottom[e.col];
        if (!current || e.y > current.y) bottom[e.col] = e;
    }
    const candidates = bottom.filter(Boolean);
    if (!candidates.length) return null;
    // Leve preferência por quem está perto da nave: pressão sem injustiça.
    const px = player.x + player.width / 2;
    candidates.sort((a, b) => Math.abs(a.x - px) - Math.abs(b.x - px));
    const index = Math.min(candidates.length - 1, Math.floor(Math.pow(Math.random(), 1.6) * candidates.length));
    return candidates[index];
}

function enemyFire(shooter) {
    const sx = shooter.x + shooter.width / 2;
    const sy = shooter.y + shooter.height;
    const mul = MODES[mode].enemyBulletSpeed;
    const speed = Math.min(340, 200 + level * 15) * mul;
    const push = (angle, v, color) => {
        enemyBullets.push({ x: sx, y: sy, vx: Math.sin(angle) * v, vy: Math.cos(angle) * v, color });
    };
    if (shooter.species === 0) {
        // Mira: aponta para a nave, limitado a ±35° da vertical.
        const px = player.x + player.width / 2;
        const py = player.y + player.height / 2;
        const angle = Math.max(-0.61, Math.min(0.61, Math.atan2(px - sx, py - sy)));
        push(angle, speed, '#ff4fd8');
    } else if (shooter.species === 2 && level >= 3) {
        // Leque de 3, mais lento — lê-se como um "V" fácil de atravessar pelo meio.
        for (const a of [-0.31, 0, 0.31]) push(a, speed * 0.78, '#59f3ff');
    } else {
        push(0, speed * 0.85, shooter.species === 2 ? '#59f3ff' : '#4dff9a');
    }
}

/* --- Simulação ------------------------------------------------------------ */
const MAX_STEP = 1 / 120;

function update(dt) {
    simTime += dt;
    if (player.invuln > 0) player.invuln = Math.max(0, player.invuln - dt);
    if (player.rapid > 0) player.rapid = Math.max(0, player.rapid - dt);
    if (banner.time > 0) banner.time = Math.max(0, banner.time - dt);
    if (shake > 0) shake = Math.max(0, shake - dt);

    // Gatilho preso: dispara na cadência de FIRE_INTERVAL enquanto estiver ativo.
    // No Fácil o gatilho está sempre preso (tiro automático).
    const fireOn = MODES[mode].autoFire || firingPointers.size || Boolean(keys.Space);
    fireCooldown -= dt;
    if (fireOn && fireCooldown <= 0) {
        fireBullet();
        fireCooldown = player.rapid > 0 ? RAPID_INTERVAL : FIRE_INTERVAL;
    }

    // Movimento com inércia: v → alvo com resposta exponencial (independe do dt).
    let targetVx = 0;
    if (keys.ArrowLeft || keys.a) targetVx -= player.maxSpeed;
    if (keys.ArrowRight || keys.d) targetVx += player.maxSpeed;
    const blend = 1 - Math.exp(-player.response * dt);
    player.vx += (targetVx - player.vx) * blend;
    if (!drag) player.x += player.vx * dt;
    if (player.x < 0) { player.x = 0; if (player.vx < 0) player.vx = 0; }
    if (player.x + player.width > gameWidth) { player.x = gameWidth - player.width; if (player.vx > 0) player.vx = 0; }

    // Bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.y -= BULLET_SPEED * dt;
        if (b.vx) b.x += b.vx * dt;
        if (b.y < -20) bullets.splice(i, 1);
    }

    // Carga e disparo inimigo (o brilho avisa 0,45 s antes).
    enemyFireCooldown -= dt;
    if (enemyFireCooldown <= 0 && enemies.length > 0) {
        const shooter = pickShooter();
        if (shooter) shooter.charge = 0.45;
        enemyFireCooldown = Math.max(0.38, 1.55 - level * 0.12) * (0.75 + Math.random() * 0.5) * MODES[mode].enemyFire;
    }

    const hx = player.x + player.width / 2;
    const hy = player.y + player.height / 2 - 2;
    const hitR = HIT_RADIUS + ENEMY_BULLET_RADIUS;

    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const eb = enemyBullets[i];
        eb.x += eb.vx * dt;
        eb.y += eb.vy * dt;
        if (eb.y > gameHeight + 20 || eb.x < -20 || eb.x > gameWidth + 20) {
            enemyBullets.splice(i, 1);
            continue;
        }
        const ddx = eb.x - hx;
        const ddy = eb.y - hy;
        if (player.invuln <= 0 && ddx * ddx + ddy * ddy < hitR * hitR) {
            enemyBullets.splice(i, 1);
            handlePlayerHit();
            if (!gameRunning) return;
        }
    }

    // Enemies: a formação acelera conforme encolhe (como no fliperama).
    const ramp = 1 + 1.6 * (1 - enemies.length / formationTotal);
    const speedNow = enemySpeed * ramp;
    let hitRight = false;
    let hitLeft = false;
    for (const enemy of enemies) {
        enemy.x += speedNow * enemyDirection * dt;
        if (enemy.x <= 0) hitLeft = true;
        if (enemy.x + enemy.width >= gameWidth) hitRight = true;
        if (enemy.hitFlash > 0) enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
        if (enemy.charge > 0) {
            enemy.charge -= dt;
            if (enemy.charge <= 0) {
                enemy.charge = 0;
                enemyFire(enemy);
            }
        }
    }

    if (hitLeft && enemyDirection === -1) {
        enemyDirection = 1;
        for (const enemy of enemies) {
            enemy.y += stepDown;
            enemy.x += 5; // Push away from wall
        }
    } else if (hitRight && enemyDirection === 1) {
        enemyDirection = -1;
        for (const enemy of enemies) {
            enemy.y += stepDown;
            enemy.x -= 5; // Push away from wall
        }
    }

    // Nave-mãe.
    ufoTimer -= dt;
    if (!ufo && ufoTimer <= 0 && enemies.length > 4) {
        const fromLeft = Math.random() < 0.5;
        ufo = { x: fromLeft ? -54 : gameWidth + 54, y: Math.max(8, topSafe - 4), dir: fromLeft ? 1 : -1, w: 46, h: 20, value: Math.random() < 0.3 ? 300 : 150 };
        playSound('ufo');
    }
    if (ufo) {
        ufo.x += ufo.dir * 120 * dt;
        if (ufo.x < -80 || ufo.x > gameWidth + 80) {
            ufo = null;
            ufoTimer = 16 + Math.random() * 10;
        }
    }

    // Collision Detection
    // Bullet vs Enemy
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        if (ufo && b.x < ufo.x + ufo.w / 2 && b.x + b.width > ufo.x - ufo.w / 2 && b.y < ufo.y + ufo.h && b.y + b.height > ufo.y) {
            createParticles(ufo.x, ufo.y + ufo.h / 2, '#ffd23f', 30, 220);
            dropPowerUp(ufo.x, ufo.y + ufo.h, true);
            score += ufo.value;
            showBanner(`NAVE-MÃE +${ufo.value}`, '#ffd23f');
            playSound('explosion');
            bullets.splice(i, 1);
            ufo = null;
            ufoTimer = 16 + Math.random() * 10;
            updateHud();
            continue;
        }
        for (let j = enemies.length - 1; j >= 0; j--) {
            const e = enemies[j];
            if (
                b.x < e.x + e.width &&
                b.x + b.width > e.x &&
                b.y < e.y + e.height &&
                b.y + b.height > e.y
            ) {
                // Hit!
                createParticles(e.x + e.width / 2, e.y + e.height / 2, e.color);
                dropPowerUp(e.x + e.width / 2, e.y + e.height / 2);
                playSound('explosion');
                enemies.splice(j, 1);
                bullets.splice(i, 1);
                score += e.points;
                updateHud();

                // Check win/respawn
                if (enemies.length === 0) {
                    level++;
                    enemyBullets = [];
                    updateHud();
                    initEnemies();
                    enemyFireCooldown = 1.6; // respiro no começo da onda
                    showBanner(`ONDA ${level}!`, '#b7ff4a');
                    playSound('wave');
                }
                break;
            }
        }
    }

    // Power-ups caindo.
    for (let i = powerUps.length - 1; i >= 0; i--) {
        const p = powerUps[i];
        p.y += 110 * dt;
        p.phase += dt * 3;
        const pdx = p.x - hx;
        const pdy = p.y - hy;
        if (pdx * pdx + pdy * pdy < PICKUP_RADIUS * PICKUP_RADIUS) {
            powerUps.splice(i, 1);
            collectPowerUp(p);
        } else if (p.y > gameHeight + 20) {
            powerUps.splice(i, 1);
        }
    }

    // Enemy vs Player: a formação chegou na altura da nave = ela “passou”.
    // Antes só o invasor que encostava sumia (um por frame) e as vidas evaporavam
    // em sequência; agora custa uma vida e a mesma onda recomeça do topo.
    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        if (e.y + e.height >= player.y + 4) {
            player.invuln = 0;
            player.shield = false;
            handlePlayerHit();
            if (!gameRunning) return;
            enemyBullets = [];
            initEnemies();
            enemyFireCooldown = 1.6;
            showBanner('ELES PASSARAM! −1 VIDA', '#ff4fd8');
            break;
        }
    }

    // Particles
    for (let i = 0; i < PARTICLE_MAX; i++) {
        const p = particles[i];
        if (p.life <= 0) continue;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 1 - 1.8 * dt; // arrasto: a explosão desacelera
        p.vy *= 1 - 1.8 * dt;
        p.life -= dt * 1.6;
    }

    // Stars (paralaxe)
    for (const star of stars) {
        star.y += star.speed * dt;
        if (star.y > gameHeight) {
            star.y -= gameHeight;
            star.x = Math.random() * gameWidth;
        }
    }
}

function drawPlasmaCapsule(b) {
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    const color = b.color || '#00f3ff';

    // Halo colorido externo da cápsula de plasma
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(cx, cy, b.width * 1.15, b.height * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cápsula intermediária saturada
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.ellipse(cx, cy, b.width * 0.65, b.height * 0.52, 0, 0, Math.PI * 2);
    ctx.fill();

    // Núcleo incandescente branco
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(cx, cy, b.width * 0.32, b.height * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();
}

/* Tiro inimigo: bola com contorno escuro e núcleo branco — lê-se bem sobre
   qualquer fundo e o tamanho desenhado é o mesmo da área de colisão (+halo). */
function drawEnemyBullet(b) {
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(b.x, b.y, ENEMY_BULLET_RADIUS * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#05060d';
    ctx.beginPath();
    ctx.arc(b.x, b.y, ENEMY_BULLET_RADIUS + 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(b.x, b.y, ENEMY_BULLET_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(b.x, b.y, ENEMY_BULLET_RADIUS * 0.45, 0, Math.PI * 2);
    ctx.fill();
}

function drawShip(starT, fireOn) {
    const cx = player.x + player.width / 2;
    const cy = player.y + player.height / 2;
    const blinking = player.invuln > 0 && Math.floor(player.invuln * 14) % 2 === 0;

    if (!blinking) {
        const pw = player.width;
        const ph = player.height;
        const bank = Math.max(-0.28, Math.min(0.28, (player.vx || 0) / player.maxSpeed * 0.25));

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(bank * 0.45);
        ctx.scale(1 - Math.abs(bank) * 0.22, 1);

        // Pós-combustor animado duplo / central
        const flick = (fireOn ? 0.82 : 0.48) + 0.22 * Math.sin(starT * 36);
        const reach = (fireOn ? 14 : 8) + Math.sin(starT * 45) * 3 + (player.rapid > 0 ? 6 : 0);
        ctx.globalAlpha = flick;
        const flameGrad = ctx.createLinearGradient(0, ph * 0.36, 0, ph * 0.5 + reach);
        flameGrad.addColorStop(0, '#ffffff');
        flameGrad.addColorStop(0.35, player.rapid > 0 ? '#ffd23f' : '#00f3ff');
        flameGrad.addColorStop(0.75, '#ff2ae6');
        flameGrad.addColorStop(1, 'rgba(255, 42, 230, 0)');
        ctx.fillStyle = flameGrad;
        ctx.beginPath();
        ctx.moveTo(-pw * 0.16, ph * 0.36);
        ctx.lineTo(0, ph * 0.5 + reach);
        ctx.lineTo(pw * 0.16, ph * 0.36);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;

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

    if (!gameRunning) return;

    // Hitbox visível: o ponto que realmente leva dano.
    const hy = cy - 2;
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, hy, HIT_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ff2ae6';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Escudo: anel pulsante.
    if (player.shield) {
        ctx.globalAlpha = 0.55 + 0.2 * Math.sin(starT * 6);
        ctx.strokeStyle = '#59f3ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, player.width * 0.72, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    // Turbo: arco que esvazia com o tempo restante.
    if (player.rapid > 0) {
        ctx.strokeStyle = '#ffd23f';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(cx, cy, player.width * 0.86, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (player.rapid / 10));
        ctx.stroke();
    }
}

function drawEnemy(e) {
    const w = e.width;
    const h = e.height;
    const cx = e.x + w * 0.5;
    const cy = e.y + h * 0.5;
    const species = e.species;
    const phase = simTime * 7.2 + e.col * 0.7 + e.row * 0.5;
    const pulse = Math.sin(phase);

    // Carga do tiro: halo que cresce nos 0,45 s antes de disparar.
    if (e.charge > 0) {
        const k = 1 - e.charge / 0.45;
        ctx.globalAlpha = 0.25 + k * 0.5;
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.arc(cx, e.y + h * 0.9, 3 + k * w * 0.28, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }

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

function drawUfo(t) {
    if (!ufo) return;
    const { x, y, w, h } = ufo;
    ctx.save();
    ctx.translate(x, y + h / 2);
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.75, h * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.ellipse(0, 2, w / 2, h * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff6c9';
    ctx.beginPath();
    ctx.ellipse(0, -3, w * 0.22, h * 0.36, 0, Math.PI, 0);
    ctx.fill();
    // Luzes correndo na borda.
    for (let i = 0; i < 5; i++) {
        const on = Math.floor(t * 10 + i) % 2 === 0;
        ctx.fillStyle = on ? '#ff2ae6' : '#2a0f2c';
        ctx.beginPath();
        ctx.arc(-w * 0.34 + i * w * 0.17, 3, 2.2, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

function drawPowerUp(p) {
    const info = POWER_TYPES[p.type];
    const bob = Math.sin(p.phase) * 2;
    const r = 11;
    ctx.save();
    ctx.translate(p.x, p.y + bob);
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = info.color;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // Cápsula hexagonal.
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const a = Math.PI / 6 + i * Math.PI / 3;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = '#0a0b16';
    ctx.fill();
    ctx.strokeStyle = info.color;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = info.color;
    ctx.font = `${p.type === 'h' ? 12 : 10}px 'Press Start 2P', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(info.label, 0.5, 1);
    ctx.restore();
}

function draw() {
    ctx.save();
    if (shake > 0) {
        const k = shake / 0.35;
        ctx.translate(Math.sin(simTime * 90) * 5 * k, Math.cos(simTime * 77) * 4 * k);
    }
    ctx.drawImage(backdrop, 0, 0, gameWidth, gameHeight);

    // Draw Stars — twinkle estável (seno), não noise por frame
    const starT = performance.now() / 1000;
    ctx.fillStyle = '#ffffff';
    for (const star of stars) {
        const tw = 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(starT * star.twinkle + star.phase));
        ctx.globalAlpha = tw * (0.45 + star.size / 3.2);
        ctx.fillRect(star.x, star.y, star.size, star.size);
    }
    ctx.globalAlpha = 1;

    drawUfo(starT);

    // Draw Enemies
    for (const e of enemies) drawEnemy(e);

    for (const p of powerUps) drawPowerUp(p);

    const fireOn = (gameRunning && MODES[mode].autoFire) || firingPointers.size || Boolean(keys.Space);
    drawShip(starT, fireOn);

    // Tiros: os da nave primeiro, os inimigos por cima (são o que mata).
    for (const b of bullets) drawPlasmaCapsule(b);
    for (const eb of enemyBullets) drawEnemyBullet(eb);

    // Draw Particles
    for (let i = 0; i < PARTICLE_MAX; i++) {
        const p = particles[i];
        if (p.life <= 0) continue;
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.min(1, p.life);
        ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    }
    ctx.globalAlpha = 1;

    // Faixa de aviso (onda nova, arsenal, vida perdida).
    if (banner.time > 0) {
        const alpha = Math.min(1, banner.time / 0.4);
        const size = Math.max(11, Math.min(22, gameWidth * 0.04));
        ctx.globalAlpha = alpha;
        ctx.fillStyle = 'rgba(3, 4, 10, 0.72)';
        ctx.fillRect(0, gameHeight * 0.42 - size, gameWidth, size * 2);
        ctx.font = `${size}px 'Press Start 2P', monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = banner.color;
        ctx.fillText(banner.text, gameWidth / 2, gameHeight * 0.42, gameWidth - 24);
        ctx.globalAlpha = 1;
    }
    ctx.restore();
}

function loop(timestamp) {
    if (!gameRunning || paused) return;
    // Quadro longo (troca de aba, GC): no máximo 1/20 s de simulação, dividido
    // em passos de até 1/120 s — os tiros nunca atravessam a nave.
    const frame = Math.min((timestamp - lastTime) / 1000, 1 / 20);
    lastTime = timestamp;
    if (frame > 0) {
        const steps = Math.ceil(frame / MAX_STEP);
        const dt = frame / steps;
        for (let i = 0; i < steps && gameRunning; i++) update(dt);
    }

    draw();
    if (gameRunning && !paused) animationId = requestAnimationFrame(loop);
}

function clearControls() {
    firingPointers.clear();
    drag = null;
    for (const key of Object.keys(keys)) keys[key] = false;
}
window.addEventListener('blur', () => {
    clearControls();
    if (gameRunning && !paused) setPaused(true);
});

let highScoreAtStart = 0;

function startGame() {
    if (gameRunning) return;
    clearControls();
    paused = false;
    highScoreAtStart = highScore;
    document.getElementById('pauseScreen').classList.add('hidden');
    document.getElementById('pauseBtn').hidden = false;
    banner.time = 0;
    fireCooldown = 0;
    enemyDirection = 1;
    for (const p of particles) p.life = 0;
    gameRunning = true;
    score = 0;
    lives = MODES[mode].lives;
    level = 1;
    bulletLevel = 1;
    bullets = [];
    enemyBullets = [];
    powerUps = [];
    ufo = null;
    ufoTimer = 18;
    shake = 0;
    simTime = 0;
    player.invuln = 0;
    player.vx = 0;
    player.shield = false;
    player.rapid = 0;
    enemyFireCooldown = 1.2;
    updateHud();
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('gameOverScreen').classList.add('hidden');

    resize();
    player.x = (gameWidth - player.width) / 2;
    initStars();
    initEnemies();
    lastTime = performance.now();
    showBanner('ONDA 1', '#59f3ff');
    cancelAnimationFrame(animationId);
    animationId = requestAnimationFrame(loop);
}

function gameOver() {
    gameRunning = false;
    paused = false;
    cancelAnimationFrame(animationId);
    clearControls();
    if (score > highScore) {
        highScore = score;
        saveHighScore(highScore);
    }
    updateHud();
    document.getElementById('pauseBtn').hidden = true;
    document.getElementById('finalScore').innerText = formatScore(score);
    document.getElementById('finalNote').textContent = score > highScoreAtStart && score > 0
        ? '★ NOVO RECORDE! ★'
        : `Onda ${level} · recorde ${formatScore(highScore)}`;
    document.getElementById('gameOverScreen').classList.remove('hidden');
    document.getElementById('restartBtn').focus({ preventScroll: true });
    banner.time = 0;
    draw();
}

/* Pausa: congela o loop (nada de rAF rodando) e mostra o overlay. */
function setPaused(next) {
    if (!gameRunning || paused === next) return;
    paused = next;
    clearControls();
    document.getElementById('pauseScreen').classList.toggle('hidden', !paused);
    const pauseBtn = document.getElementById('pauseBtn');
    pauseBtn.setAttribute('aria-label', paused ? 'Continuar' : 'Pausar');
    if (paused) {
        cancelAnimationFrame(animationId);
        document.getElementById('resumeBtn').focus({ preventScroll: true });
    } else {
        lastTime = performance.now();
        animationId = requestAnimationFrame(loop);
    }
}

function showMenu() {
    document.getElementById('gameOverScreen').classList.add('hidden');
    document.getElementById('pauseScreen').classList.add('hidden');
    document.getElementById('startScreen').classList.remove('hidden');
    document.getElementById('startBtn').focus({ preventScroll: true });
}

function syncModeButtons() {
    document.querySelectorAll('[data-mode]').forEach(btn => {
        btn.setAttribute('aria-pressed', String(btn.dataset.mode === mode));
    });
}

// Event Listeners for UI
document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', startGame);
document.getElementById('menuBtn').addEventListener('click', showMenu);
document.getElementById('pauseBtn').addEventListener('click', () => setPaused(!paused));
document.getElementById('resumeBtn').addEventListener('click', () => setPaused(false));
document.getElementById('quitBtn').addEventListener('click', () => {
    gameRunning = false;
    paused = false;
    cancelAnimationFrame(animationId);
    clearControls();
    document.getElementById('pauseBtn').hidden = true;
    showMenu();
});
document.querySelectorAll('[data-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
        mode = btn.dataset.mode;
        try {
            localStorage.setItem(MODE_KEY, mode);
        } catch (err) {
            /* Sem storage o modo vale só nesta visita. */
        }
        syncModeButtons();
    });
});
syncModeButtons();

function formatScore(value) {
    return String(value).padStart(6, '0');
}

function updateHud() {
    document.getElementById('score').innerText = formatScore(score);
    document.getElementById('level').innerText = String(level).padStart(2, '0');
    document.getElementById('lives').innerText = '♥'.repeat(Math.max(0, lives));
    const hsText = formatScore(Math.max(highScore, score));
    const weaponText = weaponName();
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
        capturePointer(element, e.pointerId);
        keys[keyName] = true;
    };
    const deactivate = e => {
        e.preventDefault();
        keys[keyName] = false;
    };
    element.addEventListener('pointerdown', activate);
    element.addEventListener('pointerup', deactivate);
    element.addEventListener('pointercancel', deactivate);
    element.addEventListener('lostpointercapture', deactivate);
}

bindHoldControl(document.getElementById('moveLeft'), 'ArrowLeft');
bindHoldControl(document.getElementById('moveRight'), 'ArrowRight');

bindFireControl(document.getElementById('shootBtn'));

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

// Aba escondida: pausa de verdade (overlay de PAUSA). Ao voltar, o jogador
// decide quando continuar — a horda não avança sozinha nem de surpresa.
function onVisibility(hidden) {
    if (!gameRunning) return;
    if (hidden) {
        setPaused(true);
        cancelAnimationFrame(animationId);
    }
}

if (window.LabVisibility) {
    LabVisibility.onChange(onVisibility);
} else {
    document.addEventListener('visibilitychange', () => onVisibility(document.hidden));
}

// Initial Resize
let resizeTimer = 0;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        resize();
        if (!gameRunning) {
            initStars();
            draw(); // Draw one frame of stars
        } else if (paused) {
            draw();
        }
    }, 80);
});

resize();
initStars();
updateHud();
draw(); // Initial draw
