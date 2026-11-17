/* Claude Bros — lógica do jogo (sem nada de renderização).
 *
 * Toda a simulação continua em pixels de mundo (1 tile = 32px), como na versão
 * em Canvas 2D; a cena 3D só lê este estado e converte para metros. O módulo
 * avisa o que aconteceu por `emit(nome, dados)` — som, partículas, câmera e HUD
 * reagem a esses eventos em main.js.
 *
 * Estados: ready | playing | paused | dead | over | won
 *   dead — o personagem levou dano: é arremessado (balístico, sem colisão) por
 *          DEAD_TIME e renasce no último trecho de chão firme que pisou.
 *   won  — tocou a torre do estandarte; o overlay aparece depois da comemoração.
 */
import {
    TILE, GRAVITY, JUMP_VELOCITY, JUMP_CUT, RUN_SPEED, RUN_ACCEL, SKID_ACCEL, AIR_ACCEL, RUN_FRICTION,
    AIR_FRICTION, MAX_FALL, COYOTE_TIME, JUMP_BUFFER, APEX_SPEED, APEX_GRAVITY, CORNER_NUDGE, ENEMY_SPEED,
    STOMP_BOUNCE, LEVEL, COLS, ROWS, WORLD_WIDTH, WORLD_HEIGHT, GROUND_ROW, WATER_LEVEL
} from './config.js';

const DEAD_TIME = 0.9;
const WATER_PY = (GROUND_ROW - WATER_LEVEL) * TILE; // superfície da água dos vãos, em px da lógica

function overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function createGame(emit = () => {}) {
    const solids = [];   // tiles com colisão
    const coins = [];
    const enemies = [];
    const spikes = [];
    const crates = [];   // subconjunto de `solids` (kind 'bonus')
    const keys = { left: false, right: false };
    const probe = { x: 0, y: 0, w: 2, h: 4 };
    const box = { x: 0, y: 0, w: 22, h: 22 };

    const player = {
        x: 0, y: 0, w: 24, h: 28,
        vx: 0, vy: 0,
        facing: 1,
        grounded: false,
        coyote: 0,
        buffer: 0,
        jumpHeld: false,
        invuln: 0,
        skid: false,
        airTime: 0,
        splashed: false
    };

    const game = {
        state: 'ready',
        score: 0,
        coinsTaken: 0,
        lives: 3,
        elapsed: 0,
        deadTimer: 0,
        wonTimer: 0,
        goal: null,
        spawn: { x: TILE * 2, y: 0 },
        checkpoint: { x: 0, y: 0 },
        player, solids, coins, enemies, spikes, crates, keys
    };

    /* ---------------------------------------------------------------- nível --- */

    function buildLevel() {
        solids.length = 0;
        coins.length = 0;
        enemies.length = 0;
        spikes.length = 0;
        crates.length = 0;
        game.goal = null;
        let hasSpawn = false;

        for (let row = 0; row < ROWS; row++) {
            const line = LEVEL[row];
            for (let col = 0; col < COLS; col++) {
                const char = line[col] || ' ';
                const x = col * TILE;
                const y = row * TILE;
                switch (char) {
                    case '#':
                        // Só o tile mais alto de uma coluna de terra é gramado.
                        solids.push({ x, y, w: TILE, h: TILE, col, row, kind: (LEVEL[row - 1] || '')[col] === '#' ? 'dirt' : 'grass' });
                        break;
                    case '=':
                        solids.push({ x, y, w: TILE, h: TILE, col, row, kind: 'platform' });
                        break;
                    case '?': {
                        const crate = { x, y, w: TILE, h: TILE, col, row, kind: 'bonus', bumped: false, bump: 0 };
                        solids.push(crate);
                        crates.push(crate);
                        break;
                    }
                    case 'o':
                        coins.push({ x: x + TILE / 2, y: y + TILE / 2, phase: Math.random() * Math.PI * 2, taken: false, gem: false, rise: 0 });
                        break;
                    case 'e':
                        enemies.push({ x: x + 3, y: y + 4, w: 26, h: 28, vx: -ENEMY_SPEED, vy: 0, alive: true, squash: 0, blink: Math.random() * 3, grounded: false });
                        break;
                    case '^':
                        spikes.push({ x: x + 3, y: y + TILE * 0.45, w: TILE - 6, h: TILE * 0.55, col, row });
                        break;
                    case 'F':
                        // O estandarte fica em cima da torre (coluna de '=' logo abaixo).
                        game.goal = { x: x + TILE / 2, y: y + TILE, col, row, tileX: x };
                        break;
                    case 'P':
                        game.spawn = { x, y };
                        hasSpawn = true;
                        break;
                }
            }
        }
        // Sem 'P' no mapa, nasce no primeiro chão à esquerda.
        if (!hasSpawn) game.spawn = { x: TILE * 2, y: (ROWS - 3) * TILE + (TILE - player.h) };
    }

    function placeAt(point) {
        player.x = point.x;
        player.y = point.y;
        player.vx = 0;
        player.vy = 0;
        player.facing = 1;
        player.grounded = false;
        player.skid = false;
        player.splashed = false;
        player.buffer = 0;
    }

    function reset() {
        buildLevel();
        game.score = 0;
        game.coinsTaken = 0;
        game.lives = 3;
        game.elapsed = 0;
        game.deadTimer = 0;
        game.wonTimer = 0;
        game.checkpoint = { ...game.spawn };
        placeAt(game.spawn);
        player.invuln = 0;
        emit('hud');
        emit('reset');
    }

    /* -------------------------------------------------------------- colisão --- */

    /* Movimento resolvido eixo a eixo: primeiro X (e empurra para fora), depois Y.
       Fazer os dois juntos faria o jogador "escalar" paredes ao correr contra elas. */
    function moveAxis(entity, dx, dy, isPlayer) {
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
                /* Correção de quina: se só uma lasca da cabeça pegou no bloco,
                   desliza para o lado livre e o pulo continua. */
                if (isPlayer) {
                    const fromLeft = entity.x + entity.w - tile.x;       // sobreposição entrando pela esquerda do bloco
                    const fromRight = tile.x + tile.w - entity.x;
                    const nudge = fromLeft <= CORNER_NUDGE ? -fromLeft : fromRight <= CORNER_NUDGE ? fromRight : 0;
                    if (nudge !== 0) {
                        const keepX = entity.x;
                        entity.x += nudge;
                        if (!solids.some((other) => overlaps(entity, other))) continue;
                        entity.x = keepX;
                    }
                }
                entity.y = tile.y + tile.h;
                // Cabeçada em caixa de faísca: solta um cristal e a caixa apaga.
                if (isPlayer && tile.kind === 'bonus' && !tile.bumped) {
                    tile.bumped = true;
                    tile.bump = 1;
                    coins.push({ x: tile.x + TILE / 2, y: tile.y - TILE * 0.2, phase: 0, taken: false, gem: true, rise: TILE * 0.55 });
                    emit('bonus', tile);
                } else if (isPlayer && tile.kind === 'bonus') {
                    emit('bonk', tile);
                }
            }
            entity.vy = 0;
        }
        return landed;
    }

    /* --------------------------------------------------------------- update --- */

    function step(dt) {
        if (game.state === 'dead') {
            // Arremesso balístico do dano; sem colisão, só para a animação.
            player.vy = Math.min(MAX_FALL, player.vy + GRAVITY * dt);
            player.x += player.vx * dt;
            player.y += player.vy * dt;
            if (!player.splashed && player.y + player.h > WATER_PY) {
                player.splashed = true;
                emit('splash', { x: player.x + player.w / 2 });
            }
            game.deadTimer -= dt;
            if (game.deadTimer <= 0) {
                if (game.lives <= 0) {
                    game.state = 'over';
                    emit('over');
                } else {
                    placeAt(game.checkpoint);
                    player.invuln = 1.4;
                    game.state = 'playing';
                    emit('respawn');
                }
            }
            return;
        }
        if (game.state === 'won') {
            // Na vitória o personagem ainda assenta no chão para comemorar.
            player.vx = 0;
            player.vy = Math.min(MAX_FALL, player.vy + GRAVITY * dt);
            player.grounded = moveAxis(player, 0, player.vy * dt, false);
            if (game.wonTimer > 0) {
                game.wonTimer -= dt;
                if (game.wonTimer <= 0) emit('wonOverlay');
            }
            return;
        }
        if (game.state !== 'playing') return;

        game.elapsed += dt;

        /* --- jogador --- */
        const target = (keys.right ? RUN_SPEED : 0) - (keys.left ? RUN_SPEED : 0);
        player.skid = false;

        if (target !== 0) {
            const reversing = player.vx !== 0 && Math.sign(player.vx) !== Math.sign(target);
            let accel = player.grounded ? RUN_ACCEL : AIR_ACCEL;
            if (reversing && player.grounded) {
                accel = SKID_ACCEL;
                player.skid = Math.abs(player.vx) > RUN_SPEED * 0.35;
            }
            player.vx += Math.sign(target - player.vx) * accel * dt;
            // Não deixa a aceleração passar do alvo em um frame gordo.
            if ((target > 0 && player.vx > target) || (target < 0 && player.vx < target)) player.vx = target;
            player.facing = target > 0 ? 1 : -1;
        } else {
            const drop = (player.grounded ? RUN_FRICTION : AIR_FRICTION) * dt;
            player.vx = Math.abs(player.vx) <= drop ? 0 : player.vx - Math.sign(player.vx) * drop;
        }

        // Ápice leve: gravidade reduzida perto do topo enquanto o pulo está preso.
        const apex = player.jumpHeld && !player.grounded && Math.abs(player.vy) < APEX_SPEED;
        player.vy = Math.min(MAX_FALL, player.vy + GRAVITY * (apex ? APEX_GRAVITY : 1) * dt);

        // Coyote time e jump buffer decaem em tempo real.
        player.coyote = player.grounded ? COYOTE_TIME : Math.max(0, player.coyote - dt);
        player.buffer = Math.max(0, player.buffer - dt);

        if (player.buffer > 0 && player.coyote > 0) {
            player.vy = JUMP_VELOCITY;
            player.buffer = 0;
            player.coyote = 0;
            player.grounded = false;
            emit('jump');
        }

        // Pulo variável: soltar o botão na subida corta o impulso.
        if (!player.jumpHeld && player.vy < 0) {
            player.vy += (1 - JUMP_CUT) * -JUMP_VELOCITY * dt * 3;
            if (player.vy > 0) player.vy = 0;
        }

        const wasAirborne = !player.grounded;
        const fallSpeed = player.vy;
        player.grounded = moveAxis(player, player.vx * dt, player.vy * dt, true);
        if (player.grounded) {
            if (wasAirborne && fallSpeed >= 0) emit('land', { speed: fallSpeed, airTime: player.airTime });
            player.airTime = 0;
        } else {
            player.airTime += dt;
        }
        player.invuln = Math.max(0, player.invuln - dt);

        // Checkpoint: início do trecho de chão ('#') em que o jogador está pisando.
        if (player.grounded) {
            const row = Math.round((player.y + player.h) / TILE);
            const col = Math.floor((player.x + player.w / 2) / TILE);
            if ((LEVEL[row] || '')[col] === '#') {
                let start = col;
                while (start > 0 && LEVEL[row][start - 1] === '#') start--;
                game.checkpoint.x = (start + 1) * TILE + (TILE - player.w) / 2;
                game.checkpoint.y = row * TILE - player.h;
            }
        }

        // Bordas do mundo: para no início e no fim; cair num vão custa uma vida.
        if (player.x < 0) { player.x = 0; player.vx = 0; }
        if (player.x + player.w > WORLD_WIDTH) { player.x = WORLD_WIDTH - player.w; player.vx = 0; }
        if (player.y + player.h > WATER_PY) {
            player.splashed = true;
            emit('splash', { x: player.x + player.w / 2 });
            loseLife(true);
            return;
        }

        /* --- faíscas e cristais --- */
        for (const coin of coins) {
            if (coin.taken) continue;
            coin.phase += dt * 3.4;
            if (coin.rise > 0) {
                // O cristal da caixa sobe um pouco (desacelerando) e para.
                const d = Math.min(coin.rise, (40 + coin.rise * 5) * dt);
                coin.y -= d;
                coin.rise -= d;
            }
            box.x = coin.x - 11;
            box.y = coin.y - 11;
            if (overlaps(player, box)) {
                coin.taken = true;
                game.coinsTaken++;
                game.score += coin.gem ? 200 : 50;
                emit('coin', coin);
                emit('hud');
            }
        }

        /* --- rivais --- */
        for (const enemy of enemies) {
            if (!enemy.alive) {
                enemy.squash = Math.max(0, enemy.squash - dt * 1.6);
                continue;
            }
            enemy.blink += dt;
            enemy.vy = Math.min(MAX_FALL, enemy.vy + GRAVITY * dt);

            const beforeX = enemy.x;
            const speed = enemy.vx;
            const landed = moveAxis(enemy, enemy.vx * dt, enemy.vy * dt, false);
            enemy.grounded = landed;
            enemy.vx = speed; // moveAxis zera vx na parede; a direção é decidida aqui

            // Bateu em parede: o eixo X não andou o que devia.
            if (Math.abs(enemy.x - beforeX) < Math.abs(speed * dt) - 0.01) enemy.vx = -speed;

            /* Não anda para fora da plataforma: sonda o chão logo à frente do pé
               que está avançando. Sem isso o rival se joga em todo buraco. */
            if (landed) {
                probe.x = enemy.vx > 0 ? enemy.x + enemy.w + 2 : enemy.x - 4;
                probe.y = enemy.y + enemy.h + 2;
                if (!solids.some((tile) => overlaps(probe, tile))) enemy.vx *= -1;
            }
            if (enemy.y > WORLD_HEIGHT + TILE * 3) enemy.alive = false;

            // Dois rivais que se encontram dão meia-volta em vez de se atravessarem.
            for (const other of enemies) {
                if (other === enemy || !other.alive || !overlaps(enemy, other)) continue;
                const away = Math.sign((enemy.x + enemy.w / 2) - (other.x + other.w / 2)) || 1;
                if (Math.sign(enemy.vx) !== away) enemy.vx = away * Math.abs(enemy.vx);
            }

            if (player.invuln <= 0 && overlaps(player, enemy)) {
                // Pisar em cima só conta caindo e vindo de cima do rival.
                const fromAbove = player.vy > 0 && (player.y + player.h) - enemy.y < enemy.h * 0.6;
                if (fromAbove) {
                    enemy.alive = false;
                    enemy.squash = 1;
                    player.vy = STOMP_BOUNCE;
                    player.buffer = 0;
                    game.score += 100;
                    emit('stomp', enemy);
                    emit('hud');
                } else {
                    loseLife(false, Math.sign((player.x + player.w / 2) - (enemy.x + enemy.w / 2)) || -1);
                    return;
                }
            }
        }

        /* --- estacas --- */
        if (player.invuln <= 0) {
            for (const spike of spikes) {
                if (overlaps(player, spike)) { loseLife(false, -player.facing); return; }
            }
        }

        /* --- estandarte: encostar na torre vence a fase --- */
        const goal = game.goal;
        if (goal && player.x + player.w >= goal.tileX - 1) win();

        for (const crate of crates) {
            if (crate.bump > 0) crate.bump = Math.max(0, crate.bump - dt * 5);
        }
    }

    function loseLife(fell, knock = -1) {
        if (game.state !== 'playing') return;
        game.lives--;
        game.state = 'dead';
        game.deadTimer = DEAD_TIME;
        if (fell) {
            // Caiu na água: o arrasto segura a queda e o corpo afunda devagar.
            player.vx *= 0.3;
            player.vy *= 0.25;
        } else {
            // Dano: pulinho para trás, na direção oposta à do golpe.
            player.vx = knock * 130;
            player.vy = -430;
        }
        player.grounded = false;
        emit('hurt', { fell, last: game.lives <= 0 });
        emit('hud');
    }

    function win() {
        if (game.state !== 'playing') return;
        game.state = 'won';
        game.wonTimer = 2.2;
        // Bônus de tempo: terminar rápido vale mais.
        game.bonus = Math.max(0, Math.round((120 - game.elapsed) * 10));
        game.score += game.bonus;
        player.facing = 1;
        emit('win');
        emit('hud');
    }

    function pressJump() {
        player.buffer = JUMP_BUFFER;
        player.jumpHeld = true;
    }

    function releaseJump() {
        player.jumpHeld = false;
    }

    Object.assign(game, { reset, step, pressJump, releaseJump });
    return game;
}
