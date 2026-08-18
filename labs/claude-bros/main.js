/* Claude Bros — plataforma 2D em canvas puro.
 *
 * Sem PixiJS e sem CDN: tudo é desenhado com Canvas 2D, então o lab não depende
 * de rede externa para abrir (a versão anterior mostrava tela preta se o CDN
 * falhasse) e segue a regra vanilla do repositório.
 *
 * --- Simulação --------------------------------------------------------------
 * Passo fixo de 1/120s com acumulador: a física não muda com o refresh rate do
 * monitor (60Hz, 120Hz ou um frame perdido dão o mesmo salto).
 *
 * Unidades: 1 tile = 32px de mundo. Velocidades em px/s, acelerações em px/s².
 *
 *   GRAVITY        1900 px/s²   queda com peso, sem virar pedra
 *   JUMP_VELOCITY  -560 px/s    ~2.6 tiles de altura, passa por cima do inimigo
 *   RUN_SPEED       210 px/s    ~6.5 tiles/s
 *
 * --- Sensação de controle ---------------------------------------------------
 * Três perdões que todo plataforma bom tem e o anterior não tinha:
 *   · coyote time (90ms) — pular logo depois de sair da plataforma ainda vale
 *   · jump buffer (120ms) — apertar pulo pouco antes de pousar ainda vale
 *   · pulo variável — soltar o botão corta a subida pela metade
 */

const TILE = 32;
const GRAVITY = 1900;
const JUMP_VELOCITY = -560;
const JUMP_CUT = 0.45;      // fator aplicado à subida quando o botão é solto
const RUN_SPEED = 210;
const RUN_ACCEL = 1500;
const RUN_FRICTION = 1900;
const MAX_FALL = 780;
const COYOTE_TIME = 0.09;
const JUMP_BUFFER = 0.12;
const ENEMY_SPEED = 52;
const STOMP_BOUNCE = -380;
const FIXED_STEP = 1 / 120;

/* Mapa. Cada caractere é um tile de 32px.
 *   #  chão            =  plataforma
 *   ?  bloco de bônus  o  estrela (Gemini)
 *   e  inimigo (ChatGPT)   ^  espinho
 *   P  nascimento do jogador   F  bandeira final                */
const LEVEL = [
    '                                                                                        ',
    '                                                                                        ',
    '                                                                                        ',
    '                                                    o o o                               ',
    '                                        o          =======                              ',
    '                              o o      ===                                   o o o      ',
    '                    ?        =====                        o  o              =======     ',
    '            o o                                 ?        ======                         ',
    '           =====        e              e                              e                F',
    '                                                     o                          ?      =',
    '     o                       ?    o o                                  o o             =',
    '   =====        e                =====        e            ^^        =======       e   =',
    '###########   ############   #############   ########   ########   ##############   #####',
    '###########   ############   #############   ########   ########   ##############   #####',
];

const COLS = Math.max(...LEVEL.map(row => row.length));
const ROWS = LEVEL.length;
const WORLD_WIDTH = COLS * TILE;
const WORLD_HEIGHT = ROWS * TILE;

/* A câmera enquadra ~24 tiles de largura. Menos que isso e o jogador não vê o
   inimigo a tempo de reagir; mais e os sprites viram formigas no celular. */
const VIEW_TILES_X = 24;
const VIEW_WIDTH = VIEW_TILES_X * TILE;

const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');
const hud = {
    score: document.getElementById('scoreValue'),
    coins: document.getElementById('coinValue'),
    lives: document.getElementById('lifeValue'),
    time: document.getElementById('timeValue'),
};
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlayText = document.getElementById('overlayText');
const overlayButton = document.getElementById('overlayButton');
const statusLive = document.getElementById('gameStatus');
const touchLayer = document.getElementById('touchControls');

const audio = window.LabAudio;

/* ---------------------------------------------------------------- estado --- */

const solids = [];   // tiles com colisão
const decor = [];    // tiles sem colisão (topo de grama etc.)
let coins = [];
let enemies = [];
let spikes = [];
let particles = [];
let goal = null;
let spawn = { x: TILE * 2, y: TILE * 8 };

const player = {
    x: 0, y: 0, w: 24, h: 28,
    vx: 0, vy: 0,
    facing: 1,
    grounded: false,
    coyote: 0,
    buffer: 0,
    jumpHeld: false,
    invuln: 0,
    walkPhase: 0,
    squash: 0,
};

let state = 'ready';   // ready | playing | paused | dead | over | won
let score = 0;
let coinsTaken = 0;
let lives = 3;
let elapsed = 0;
let camera = { x: 0, y: 0 };
let shake = 0;
let scale = 1;
let viewHeight = 0;

const keys = { left: false, right: false, jump: false };

/* ------------------------------------------------------------------ nível --- */

function buildLevel() {
    solids.length = 0;
    decor.length = 0;
    coins = [];
    enemies = [];
    spikes = [];
    particles = [];
    goal = null;

    for (let row = 0; row < ROWS; row++) {
        const line = LEVEL[row];
        for (let col = 0; col < COLS; col++) {
            const char = line[col] || ' ';
            const x = col * TILE;
            const y = row * TILE;

            switch (char) {
                case '#':
                    // Só o tile mais alto de uma coluna de terra ganha grama.
                    solids.push({ x, y, w: TILE, h: TILE, kind: (LEVEL[row - 1] || '')[col] === '#' ? 'dirt' : 'grass' });
                    break;
                case '=':
                    solids.push({ x, y, w: TILE, h: TILE, kind: 'platform' });
                    break;
                case '?':
                    solids.push({ x, y, w: TILE, h: TILE, kind: 'bonus', bumped: false, bump: 0 });
                    break;
                case 'o':
                    coins.push({ x: x + TILE / 2, y: y + TILE / 2, phase: Math.random() * Math.PI * 2, taken: false });
                    break;
                case 'e':
                    enemies.push({ x: x + 3, y: y + 4, w: 26, h: 28, vx: -ENEMY_SPEED, vy: 0, alive: true, squash: 0, blink: Math.random() * 3 });
                    break;
                case '^':
                    spikes.push({ x, y: y + TILE / 2, w: TILE, h: TILE / 2 });
                    break;
                case 'F':
                    goal = { x: x + TILE / 2, y: y - TILE * 3, h: TILE * 4 };
                    break;
                case 'P':
                    spawn = { x, y };
                    break;
            }
        }
    }

    // Sem 'P' no mapa, nasce no primeiro chão à esquerda.
    if (!LEVEL.some(row => row.includes('P'))) {
        spawn = { x: TILE * 2, y: (ROWS - 3) * TILE };
    }
}

function respawn() {
    player.x = spawn.x;
    player.y = spawn.y;
    player.vx = 0;
    player.vy = 0;
    player.facing = 1;
    player.invuln = 1.4;
    player.squash = 0;
    camera.x = 0;
}

function resetGame() {
    buildLevel();
    score = 0;
    coinsTaken = 0;
    lives = 3;
    elapsed = 0;
    shake = 0;
    respawn();
    player.invuln = 0;
    updateHud();
}

/* --------------------------------------------------------------- colisão --- */

function overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/* Movimento resolvido eixo a eixo: primeiro X (e empurra para fora), depois Y.
   Fazer os dois juntos faria o jogador "escalar" paredes ao correr contra elas. */
function moveAxis(entity, dx, dy) {
    let landed = false;

    entity.x += dx;
    for (const tile of solids) {
        if (!overlaps(entity, tile)) continue;
        if (dx > 0) entity.x = tile.x - entity.w;
        else if (dx < 0) entity.x = tile.x + tile.w;
        entity.vx = 0;
    }

    entity.y += dy;
    for (const tile of solids) {
        if (!overlaps(entity, tile)) continue;
        if (dy > 0) {
            entity.y = tile.y - entity.h;
            landed = true;
        } else if (dy < 0) {
            entity.y = tile.y + tile.h;
            // Cabeçada em bloco de bônus: solta uma estrela e vira bloco usado.
            if (tile.kind === 'bonus' && !tile.bumped) {
                tile.bumped = true;
                tile.bump = 1;
                coins.push({ x: tile.x + TILE / 2, y: tile.y - TILE * 0.6, phase: 0, taken: false, popped: true });
                sfx('bonus');
            }
        }
        entity.vy = 0;
    }

    return landed;
}

/* ------------------------------------------------------------------- som --- */

function sfx(name) {
    if (!audio) return;
    switch (name) {
        case 'jump':
            audio.tone({ freq: 320, duration: 0.14, gain: 0.13, slideTo: 620, type: 'square' });
            break;
        case 'coin':
            audio.tone({ freq: 988, duration: 0.07, gain: 0.12 });
            audio.tone({ freq: 1319, duration: 0.11, gain: 0.11, delay: 0.06 });
            break;
        case 'stomp':
            audio.tone({ freq: 220, duration: 0.1, gain: 0.14, slideTo: 90, type: 'triangle' });
            audio.noise({ duration: 0.1, gain: 0.1, filter: 1400 });
            break;
        case 'bonus':
            audio.sequence([523, 784, 1047], { step: 0.05, duration: 0.1, gain: 0.13 });
            break;
        case 'hurt':
            audio.tone({ freq: 420, duration: 0.5, gain: 0.16, slideTo: 90, type: 'sawtooth' });
            break;
        case 'win':
            audio.sequence([523, 659, 784, 1047, 1319, 1568], { step: 0.11, duration: 0.2, gain: 0.14, type: 'triangle' });
            break;
        case 'over':
            audio.sequence([392, 330, 262, 196], { step: 0.16, duration: 0.3, gain: 0.15, type: 'sawtooth' });
            break;
        case 'start':
            audio.sequence([392, 523, 659], { step: 0.08, duration: 0.12, gain: 0.13 });
            break;
    }
}

/* ------------------------------------------------------------- partículas --- */

function burst(x, y, color, count = 10, speed = 160) {
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
        particles.push({
            x, y,
            vx: Math.cos(angle) * speed * (0.4 + Math.random() * 0.8),
            vy: Math.sin(angle) * speed * (0.4 + Math.random() * 0.8) - 60,
            life: 0.5 + Math.random() * 0.35,
            maxLife: 0.85,
            color,
            size: 2 + Math.random() * 3,
        });
    }
}

/* ---------------------------------------------------------------- update --- */

function step(dt) {
    if (state !== 'playing') return;

    elapsed += dt;

    /* --- jogador --- */
    const wantsLeft = keys.left;
    const wantsRight = keys.right;
    const target = (wantsRight ? RUN_SPEED : 0) - (wantsLeft ? RUN_SPEED : 0);

    if (target !== 0) {
        player.vx += Math.sign(target - player.vx) * RUN_ACCEL * dt;
        // Não deixa a aceleração passar do alvo em um frame gordo.
        if ((target > 0 && player.vx > target) || (target < 0 && player.vx < target)) player.vx = target;
        player.facing = target > 0 ? 1 : -1;
    } else {
        const drop = RUN_FRICTION * dt;
        player.vx = Math.abs(player.vx) <= drop ? 0 : player.vx - Math.sign(player.vx) * drop;
    }

    player.vy = Math.min(MAX_FALL, player.vy + GRAVITY * dt);

    // Coyote time e jump buffer decaem em tempo real.
    player.coyote = player.grounded ? COYOTE_TIME : Math.max(0, player.coyote - dt);
    player.buffer = Math.max(0, player.buffer - dt);

    if (player.buffer > 0 && player.coyote > 0) {
        player.vy = JUMP_VELOCITY;
        player.buffer = 0;
        player.coyote = 0;
        player.grounded = false;
        player.squash = -0.35;
        sfx('jump');
    }

    // Pulo variável: soltar o botão na subida corta o impulso.
    if (!player.jumpHeld && player.vy < 0) {
        player.vy += (1 - JUMP_CUT) * -JUMP_VELOCITY * dt * 3;
        if (player.vy > 0) player.vy = 0;
    }

    const wasAirborne = !player.grounded;
    player.grounded = moveAxis(player, player.vx * dt, player.vy * dt);
    if (player.grounded && wasAirborne && player.vy >= 0) {
        player.squash = 0.35;
        burst(player.x + player.w / 2, player.y + player.h, 'rgba(255,255,255,0.7)', 5, 70);
    }

    player.squash *= Math.pow(0.0015, dt);
    player.walkPhase += Math.abs(player.vx) * dt * 0.06;
    player.invuln = Math.max(0, player.invuln - dt);

    // Bordas do mundo: para no início, cai no vazio no fim de uma fossa.
    if (player.x < 0) { player.x = 0; player.vx = 0; }
    if (player.x + player.w > WORLD_WIDTH) { player.x = WORLD_WIDTH - player.w; player.vx = 0; }
    if (player.y > WORLD_HEIGHT + TILE * 2) loseLife();

    /* --- moedas --- */
    for (const coin of coins) {
        if (coin.taken) continue;
        coin.phase += dt * 3.4;
        if (coin.popped) {
            // A estrela do bloco sobe um pouco e para.
            coin.y -= 40 * dt;
            if (coin.y < coin.yStop ?? -Infinity) coin.popped = false;
        }
        const box = { x: coin.x - 11, y: coin.y - 11, w: 22, h: 22 };
        if (overlaps(player, box)) {
            coin.taken = true;
            coinsTaken++;
            score += 50;
            burst(coin.x, coin.y, '#8ab4f8', 8, 130);
            sfx('coin');
            updateHud();
        }
    }

    /* --- inimigos --- */
    for (const enemy of enemies) {
        if (!enemy.alive) {
            enemy.squash = Math.max(0, enemy.squash - dt * 3);
            continue;
        }

        enemy.blink += dt;
        enemy.vy = Math.min(MAX_FALL, enemy.vy + GRAVITY * dt);

        const beforeX = enemy.x;
        const landed = moveAxis(enemy, enemy.vx * dt, enemy.vy * dt);
        enemy.grounded = landed;

        // Bateu em parede: o eixo X não andou o que devia.
        if (Math.abs(enemy.x - beforeX) < Math.abs(enemy.vx * dt) - 0.01) {
            enemy.vx *= -1;
        }

        /* Não anda para fora da plataforma: sonda o chão logo à frente do pé
           que está avançando. Sem isso o inimigo se joga em todo buraco. */
        if (landed) {
            const probeX = enemy.vx > 0 ? enemy.x + enemy.w + 2 : enemy.x - 2;
            const probe = { x: probeX, y: enemy.y + enemy.h + 2, w: 2, h: 4 };
            if (!solids.some(tile => overlaps(probe, tile))) enemy.vx *= -1;
        }

        if (player.invuln <= 0 && overlaps(player, enemy)) {
            // Pisar em cima só conta caindo e vindo de cima do inimigo.
            const fromAbove = player.vy > 0 && (player.y + player.h) - enemy.y < enemy.h * 0.6;
            if (fromAbove) {
                enemy.alive = false;
                enemy.squash = 1;
                player.vy = STOMP_BOUNCE;
                player.buffer = 0;
                score += 100;
                shake = 0.22;
                burst(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, '#10a37f', 12, 170);
                sfx('stomp');
                updateHud();
            } else {
                loseLife();
            }
        }
    }

    /* --- espinhos --- */
    if (player.invuln <= 0) {
        for (const spike of spikes) {
            if (overlaps(player, spike)) { loseLife(); break; }
        }
    }

    /* --- bandeira --- */
    if (goal && player.x + player.w > goal.x - 12 && player.y < goal.y + goal.h) {
        win();
    }

    /* --- partículas e blocos --- */
    particles = particles.filter(p => {
        p.life -= dt;
        p.vy += GRAVITY * 0.35 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        return p.life > 0;
    });

    for (const tile of solids) {
        if (tile.bump > 0) tile.bump = Math.max(0, tile.bump - dt * 5);
    }

    shake = Math.max(0, shake - dt * 1.6);

    /* --- câmera: segue com folga e nunca mostra fora do mundo --- */
    const targetX = player.x + player.w / 2 - VIEW_WIDTH / 2;
    camera.x += (targetX - camera.x) * Math.min(1, dt * 7);
    camera.x = Math.max(0, Math.min(WORLD_WIDTH - VIEW_WIDTH, camera.x));

    const targetY = player.y + player.h / 2 - viewHeight / 2;
    camera.y += (targetY - camera.y) * Math.min(1, dt * 4);
    camera.y = Math.max(0, Math.min(Math.max(0, WORLD_HEIGHT - viewHeight), camera.y));

    updateTime();
}

function loseLife() {
    if (state !== 'playing') return;

    lives--;
    shake = 0.5;
    burst(player.x + player.w / 2, player.y + player.h / 2, '#d97757', 16, 210);
    sfx(lives > 0 ? 'hurt' : 'over');
    updateHud();

    if (lives <= 0) {
        state = 'over';
        showOverlay('Fim de jogo', `${score} pontos · ${coinsTaken} estrelas`, 'Recomeçar');
        announce(`Fim de jogo. ${score} pontos.`);
    } else {
        state = 'dead';
        announce(`Você perdeu uma vida. Restam ${lives}.`);
        setTimeout(() => {
            if (state !== 'dead') return;
            respawn();
            state = 'playing';
        }, 700);
    }
}

function win() {
    if (state !== 'playing') return;
    state = 'won';
    // Bônus de tempo: terminar rápido vale mais.
    const bonus = Math.max(0, Math.round((120 - elapsed) * 10));
    score += bonus;
    burst(goal.x, goal.y + goal.h / 2, '#f5c542', 26, 240);
    sfx('win');
    updateHud();
    showOverlay('Você venceu!', `${score} pontos · bônus de tempo ${bonus}`, 'Jogar de novo');
    announce(`Você venceu com ${score} pontos.`);
}

/* ---------------------------------------------------------------- render --- */

function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

/* Céu + camadas de parallax. Cada camada anda uma fração da câmera: quanto mais
   longe, mais devagar — é o que dá profundidade sem nenhuma textura. */
function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, viewHeight);
    sky.addColorStop(0, '#5aa9e6');
    sky.addColorStop(0.55, '#93cdf0');
    sky.addColorStop(1, '#d7eefb');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, VIEW_WIDTH, viewHeight);

    // Sol
    ctx.fillStyle = 'rgba(255, 245, 200, 0.9)';
    ctx.beginPath();
    ctx.arc(VIEW_WIDTH - 90, 70, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 245, 200, 0.22)';
    ctx.beginPath();
    ctx.arc(VIEW_WIDTH - 90, 70, 58, 0, Math.PI * 2);
    ctx.fill();

    // Morros distantes (parallax 0.25)
    const hillOffset = -camera.x * 0.25;
    ctx.fillStyle = '#6fb8a0';
    ctx.beginPath();
    ctx.moveTo(0, viewHeight);
    for (let i = -1; i < 14; i++) {
        const baseX = hillOffset % 260 + i * 260;
        ctx.lineTo(baseX, viewHeight - 90);
        ctx.quadraticCurveTo(baseX + 130, viewHeight - 215, baseX + 260, viewHeight - 90);
    }
    ctx.lineTo(VIEW_WIDTH + 300, viewHeight);
    ctx.closePath();
    ctx.fill();

    // Morros próximos (parallax 0.45)
    const nearOffset = -camera.x * 0.45;
    ctx.fillStyle = '#4f9c86';
    ctx.beginPath();
    ctx.moveTo(0, viewHeight);
    for (let i = -1; i < 16; i++) {
        const baseX = nearOffset % 200 + i * 200;
        ctx.lineTo(baseX, viewHeight - 50);
        ctx.quadraticCurveTo(baseX + 100, viewHeight - 140, baseX + 200, viewHeight - 50);
    }
    ctx.lineTo(VIEW_WIDTH + 300, viewHeight);
    ctx.closePath();
    ctx.fill();

    // Nuvens (parallax 0.15)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    const cloudOffset = -camera.x * 0.15;
    for (let i = 0; i < 9; i++) {
        const cx = ((cloudOffset + i * 310) % (VIEW_WIDTH + 400) + VIEW_WIDTH + 400) % (VIEW_WIDTH + 400) - 200;
        const cy = 48 + (i % 3) * 46;
        const s = 0.75 + (i % 4) * 0.16;
        ctx.beginPath();
        ctx.arc(cx, cy, 20 * s, 0, Math.PI * 2);
        ctx.arc(cx + 22 * s, cy - 8 * s, 26 * s, 0, Math.PI * 2);
        ctx.arc(cx + 48 * s, cy, 19 * s, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawTiles() {
    for (const tile of solids) {
        // Culling: fora do enquadramento não desenha.
        if (tile.x + TILE < camera.x - TILE || tile.x > camera.x + VIEW_WIDTH + TILE) continue;

        const x = tile.x - camera.x;
        const y = tile.y - camera.y - (tile.bump || 0) * 6;

        if (tile.kind === 'grass' || tile.kind === 'dirt') {
            ctx.fillStyle = '#8c5b3e';
            ctx.fillRect(x, y, TILE, TILE);
            ctx.fillStyle = 'rgba(0,0,0,0.12)';
            ctx.fillRect(x, y + TILE - 5, TILE, 5);
            // Pedrinhas: posição derivada do próprio tile, então não tremem.
            ctx.fillStyle = 'rgba(255,255,255,0.10)';
            ctx.fillRect(x + ((tile.x / TILE) % 3) * 8 + 4, y + 14, 5, 4);

            if (tile.kind === 'grass') {
                ctx.fillStyle = '#53a847';
                ctx.fillRect(x, y, TILE, 9);
                ctx.fillStyle = '#67c95a';
                ctx.fillRect(x, y, TILE, 4);
            }
        } else if (tile.kind === 'platform') {
            ctx.fillStyle = '#b8763f';
            roundRect(x + 1, y + 1, TILE - 2, TILE - 2, 5);
            ctx.fill();
            ctx.fillStyle = '#d99a5f';
            roundRect(x + 1, y + 1, TILE - 2, TILE - 8, 5);
            ctx.fill();
            ctx.strokeStyle = 'rgba(120, 70, 30, 0.55)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x + 6, y + 13);
            ctx.lineTo(x + TILE - 6, y + 13);
            ctx.stroke();
        } else if (tile.kind === 'bonus') {
            const used = tile.bumped;
            ctx.fillStyle = used ? '#8a7a63' : '#e8a63c';
            roundRect(x + 1, y + 1, TILE - 2, TILE - 2, 5);
            ctx.fill();
            ctx.fillStyle = used ? '#6f6250' : '#f6c860';
            roundRect(x + 4, y + 4, TILE - 8, TILE - 8, 4);
            ctx.fill();
            if (!used) {
                ctx.fillStyle = '#7a4a15';
                ctx.font = 'bold 17px system-ui, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('?', x + TILE / 2, y + TILE / 2 + 1);
            }
        }
    }

    for (const spike of spikes) {
        if (spike.x + TILE < camera.x - TILE || spike.x > camera.x + VIEW_WIDTH + TILE) continue;
        const x = spike.x - camera.x;
        const y = spike.y - camera.y;
        ctx.fillStyle = '#c2c8d0';
        for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.moveTo(x + i * 8, y + spike.h);
            ctx.lineTo(x + i * 8 + 4, y);
            ctx.lineTo(x + i * 8 + 8, y + spike.h);
            ctx.closePath();
            ctx.fill();
        }
        ctx.fillStyle = '#8a919c';
        ctx.fillRect(x, y + spike.h - 3, TILE, 3);
    }
}

/* Estrela Gemini: quatro pontas, girando devagar e flutuando. */
function drawCoins() {
    for (const coin of coins) {
        if (coin.taken) continue;
        const x = coin.x - camera.x;
        const y = coin.y - camera.y + Math.sin(coin.phase) * 4;
        if (x < -TILE || x > VIEW_WIDTH + TILE) continue;

        ctx.save();
        ctx.translate(x, y);
        // O brilho pulsa junto com a flutuação.
        ctx.fillStyle = 'rgba(138, 180, 248, 0.25)';
        ctx.beginPath();
        ctx.arc(0, 0, 15 + Math.sin(coin.phase) * 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.rotate(coin.phase * 0.35);
        ctx.fillStyle = '#4285f4';
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI / 4) * i;
            const radius = i % 2 === 0 ? 11 : 4;
            const px = Math.cos(angle) * radius;
            const py = Math.sin(angle) * radius;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, 3.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

/* Inimigo ChatGPT: bolha verde com olhos que piscam e sorriso. */
function drawEnemies() {
    for (const enemy of enemies) {
        if (!enemy.alive && enemy.squash <= 0) continue;
        const x = enemy.x - camera.x;
        const y = enemy.y - camera.y;
        if (x < -TILE * 2 || x > VIEW_WIDTH + TILE * 2) continue;

        const flat = enemy.alive ? 0 : 1 - enemy.squash;
        const h = enemy.h * (1 - flat * 0.75);
        const w = enemy.w * (1 + flat * 0.35);
        const cx = x + enemy.w / 2;
        const top = y + enemy.h - h;

        ctx.fillStyle = 'rgba(0,0,0,0.16)';
        ctx.beginPath();
        ctx.ellipse(cx, y + enemy.h + 2, w * 0.45, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#10a37f';
        roundRect(cx - w / 2, top, w, h, Math.min(w, h) / 2.4);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        roundRect(cx - w / 2 + 3, top + 3, w - 6, h * 0.4, Math.min(w, h) / 3);
        ctx.fill();

        if (enemy.alive) {
            // Pisca por ~120ms a cada ~3s.
            const blinking = enemy.blink % 3 < 0.12;
            ctx.fillStyle = '#0b2c24';
            const eyeY = top + h * 0.38;
            const dir = Math.sign(enemy.vx) || 1;
            if (blinking) {
                ctx.fillRect(cx - 8 + dir, eyeY - 1, 5, 2);
                ctx.fillRect(cx + 3 + dir, eyeY - 1, 5, 2);
            } else {
                ctx.beginPath();
                ctx.arc(cx - 5.5 + dir * 1.5, eyeY, 2.8, 0, Math.PI * 2);
                ctx.arc(cx + 5.5 + dir * 1.5, eyeY, 2.8, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.strokeStyle = '#0b2c24';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(cx, top + h * 0.62, 5.5, 0.15 * Math.PI, 0.85 * Math.PI);
            ctx.stroke();
        }
    }
}

/* Claude: quadrado arredondado laranja, com antenas, olhos que olham para onde
   anda e pernas que alternam com a fase da caminhada. */
function drawPlayer() {
    const blink = player.invuln > 0 && Math.floor(player.invuln * 14) % 2 === 0;
    if (blink) return;

    const squash = player.squash;
    const w = player.w * (1 + squash * 0.3);
    const h = player.h * (1 - squash * 0.3);
    const cx = player.x + player.w / 2 - camera.x;
    const bottom = player.y + player.h - camera.y;
    const top = bottom - h;

    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(cx, bottom + 3, w * 0.45, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pernas: no chão alternam; no ar ficam recolhidas.
    ctx.fillStyle = '#9c4a30';
    const stride = player.grounded ? Math.sin(player.walkPhase) * 5 : -3;
    ctx.fillRect(cx - 8, bottom - 4, 6, 6 + stride);
    ctx.fillRect(cx + 2, bottom - 4, 6, 6 - stride);

    // Antenas
    ctx.strokeStyle = '#9c4a30';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 6, top + 3);
    ctx.lineTo(cx - 10, top - 6);
    ctx.moveTo(cx + 6, top + 3);
    ctx.lineTo(cx + 10, top - 6);
    ctx.stroke();

    ctx.fillStyle = '#d97757';
    roundRect(cx - w / 2, top, w, h, 7);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    roundRect(cx - w / 2 + 3, top + 3, w - 6, h * 0.35, 5);
    ctx.fill();

    // Olhos com pupila deslocada na direção do movimento.
    const look = player.facing * 1.6;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx - 5.5, top + h * 0.38, 4.2, 0, Math.PI * 2);
    ctx.arc(cx + 5.5, top + h * 0.38, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a1a10';
    ctx.beginPath();
    ctx.arc(cx - 5.5 + look, top + h * 0.38, 2.1, 0, Math.PI * 2);
    ctx.arc(cx + 5.5 + look, top + h * 0.38, 2.1, 0, Math.PI * 2);
    ctx.fill();

    // Boca
    ctx.fillStyle = '#ffffff';
    roundRect(cx - 5, top + h * 0.66, 10, 3.4, 1.7);
    ctx.fill();
}

function drawGoal() {
    if (!goal) return;
    const x = goal.x - camera.x;
    const y = goal.y - camera.y;
    if (x < -TILE * 3 || x > VIEW_WIDTH + TILE * 3) return;

    ctx.fillStyle = '#c8cdd6';
    ctx.fillRect(x - 2, y, 4, goal.h);
    ctx.fillStyle = '#f5c542';
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();

    // Bandeira ondulando: dois picos de seno ao longo do comprimento.
    const t = performance.now() / 340;
    ctx.fillStyle = '#d97757';
    ctx.beginPath();
    ctx.moveTo(x + 2, y + 6);
    for (let i = 0; i <= 10; i++) {
        const p = i / 10;
        ctx.lineTo(x + 2 + p * 44, y + 6 + Math.sin(t + p * 4) * 4 + p * 2);
    }
    for (let i = 10; i >= 0; i--) {
        const p = i / 10;
        ctx.lineTo(x + 2 + p * 44, y + 30 + Math.sin(t + p * 4) * 4 + p * 2);
    }
    ctx.closePath();
    ctx.fill();
}

function drawParticles() {
    for (const p of particles) {
        const alpha = Math.max(0, p.life / p.maxLife);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - camera.x - p.size / 2, p.y - camera.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
}

function render() {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    // Tremida de tela: deslocamento aleatório que decai junto com `shake`.
    if (shake > 0) {
        ctx.translate((Math.random() - 0.5) * shake * 14, (Math.random() - 0.5) * shake * 14);
    }

    drawBackground();
    drawTiles();
    drawGoal();
    drawCoins();
    drawEnemies();
    if (state !== 'dead' || Math.floor(performance.now() / 90) % 2 === 0) drawPlayer();
    drawParticles();
}

/* ------------------------------------------------------------------ loop --- */

let lastTime = 0;
let accumulator = 0;

function frame(now) {
    requestAnimationFrame(frame);

    if (!lastTime) lastTime = now;
    // Trava a 250ms: uma aba que voltou do background não replica meio segundo
    // de física de uma vez.
    const delta = Math.min((now - lastTime) / 1000, 0.25);
    lastTime = now;

    accumulator += delta;
    let guard = 0;
    while (accumulator >= FIXED_STEP && guard++ < 240) {
        step(FIXED_STEP);
        accumulator -= FIXED_STEP;
    }

    render();
}

/* -------------------------------------------------------------------- ui --- */

function updateHud() {
    hud.score.textContent = String(score);
    hud.coins.textContent = String(coinsTaken);
    hud.lives.textContent = '❤️'.repeat(Math.max(0, lives)) || '—';
}

function updateTime() {
    const total = Math.floor(elapsed);
    hud.time.textContent = `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function announce(message) {
    if (statusLive) statusLive.textContent = message;
}

function showOverlay(title, text, button) {
    overlayTitle.textContent = title;
    overlayText.textContent = text;
    overlayButton.textContent = button;
    overlay.hidden = false;
}

function hideOverlay() {
    overlay.hidden = true;
}

function startGame() {
    resetGame();
    hideOverlay();
    state = 'playing';
    updateTime();
    sfx('start');
    announce('Partida iniciada.');
}

function togglePause() {
    if (state === 'playing') {
        state = 'paused';
        showOverlay('Pausa', 'Respire — o nível espera.', 'Continuar');
        announce('Jogo pausado.');
    } else if (state === 'paused') {
        hideOverlay();
        state = 'playing';
        announce('Jogo retomado.');
    }
}

overlayButton.addEventListener('click', () => {
    if (state === 'paused') togglePause();
    else startGame();
});

/* ---------------------------------------------------------------- input --- */

function pressJump() {
    player.buffer = JUMP_BUFFER;
    player.jumpHeld = true;
}

function releaseJump() {
    player.jumpHeld = false;
}

const KEY_MAP = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
};

window.addEventListener('keydown', event => {
    if (event.repeat) return;

    if (KEY_MAP[event.code]) {
        event.preventDefault();
        keys[KEY_MAP[event.code]] = true;
        return;
    }

    if (event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'KeyW') {
        event.preventDefault();
        if (state === 'playing') pressJump();
        else if (state === 'ready' || state === 'over' || state === 'won') startGame();
        return;
    }

    if (event.code === 'Enter') {
        if (state !== 'playing') { event.preventDefault(); startGame(); }
        return;
    }

    if (event.code === 'KeyP' || event.code === 'Escape') {
        event.preventDefault();
        togglePause();
    }
});

window.addEventListener('keyup', event => {
    if (KEY_MAP[event.code]) keys[KEY_MAP[event.code]] = false;
    if (event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'KeyW') releaseJump();
});

/* Botões de toque em pointer events: um só caminho cobre dedo, caneta e mouse
   (a versão anterior escutava só touchstart, então não funcionava no desktop).
   `setPointerCapture` mantém o botão pressionado mesmo se o dedo escorregar. */
function bindHold(id, onPress, onRelease) {
    const el = document.getElementById(id);
    if (!el) return;

    const release = event => {
        if (event) el.releasePointerCapture?.(event.pointerId);
        el.classList.remove('is-active');
        onRelease?.();
    };

    el.addEventListener('pointerdown', event => {
        event.preventDefault();
        el.setPointerCapture?.(event.pointerId);
        el.classList.add('is-active');
        onPress();
    });
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('contextmenu', event => event.preventDefault());
}

bindHold('btnLeft', () => { keys.left = true; }, () => { keys.left = false; });
bindHold('btnRight', () => { keys.right = true; }, () => { keys.right = false; });
bindHold('btnJump', () => {
    if (state === 'playing') pressJump();
    else if (state !== 'paused') startGame();
}, releaseJump);

document.getElementById('btnPause')?.addEventListener('click', togglePause);

// Sair da aba pausa em vez de deixar o jogador morrer sozinho.
document.addEventListener('visibilitychange', () => {
    if (document.hidden && state === 'playing') togglePause();
});

/* ---------------------------------------------------------------- layout --- */

/* O jogo é desenhado sempre em VIEW_WIDTH px de mundo; o canvas é escalado para
   ocupar o espaço disponível. Assim o enquadramento é o mesmo em todo aparelho
   — o celular não ganha vantagem nem desvantagem de campo de visão. */
function resize() {
    const stage = canvas.parentElement;
    const rect = stage.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const cssWidth = Math.max(240, rect.width);
    const cssHeight = Math.max(180, rect.height);

    scale = cssWidth / VIEW_WIDTH;
    viewHeight = cssHeight / scale;

    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;

    scale *= dpr;
    ctx.imageSmoothingEnabled = true;
}

const resizeObserver = new ResizeObserver(resize);
resizeObserver.observe(canvas.parentElement);
window.addEventListener('orientationchange', () => setTimeout(resize, 120));

/* ------------------------------------------------------------------ boot --- */

if (audio) {
    audio.configure({ storageKey: 'claude-bros:muted', volume: 0.4 });
}

function mountAudioToggle() {
    const host = document.querySelector('[data-lab-header] .header-actions');
    if (host && audio) audio.mountToggle(host);
    else if (audio) setTimeout(mountAudioToggle, 60);
}
mountAudioToggle();

// Mostra os controles de toque só onde eles servem.
if (touchLayer && !window.matchMedia('(pointer: fine)').matches) touchLayer.hidden = false;

resetGame();
resize();
showOverlay('Claude Bros', 'Colete as estrelas, pule nos rivais e chegue à bandeira.', 'Começar');
requestAnimationFrame(frame);
