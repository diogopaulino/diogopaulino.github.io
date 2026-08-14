/**
 * Simulação da fase: colisão tile-a-tile, inimigos, itens, boss e câmera.
 */

import {
    TILE, VIEW_W, VIEW_H, PHYS, PLAYER, STOMP_SCORE, SOLID, ONE_WAY, HAZARD, CLIMB, BOOST, WORLDS,
} from './config.js';
import { LEVELS } from './levels.js';

function aabb(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function tileAt(level, px, py) {
    const tx = Math.floor(px / TILE);
    const ty = Math.floor(py / TILE);
    if (ty < 0 || ty >= level.height || tx < 0 || tx >= level.width) return '#';
    return level.solids[ty][tx];
}

function setTile(level, tx, ty, ch) {
    if (ty < 0 || ty >= level.height || tx < 0 || tx >= level.width) return;
    level.solids[ty][tx] = ch;
}

export function createSim(worldIndex, audio, persist) {
    const meta = WORLDS[worldIndex];
    const packed = LEVELS[meta.id].build();
    const level = {
        ...packed,
        solids: packed.tiles.map((r) => r.split('')),
        width: packed.width,
        height: packed.height,
        secrets: packed.secrets || {},
        blocks: {},
    };

    const spawn = packed.spawn;
    const player = {
        x: spawn.x,
        y: spawn.y,
        vx: 0,
        vy: 0,
        w: PLAYER.W,
        h: PLAYER.H,
        facing: 1,
        grounded: false,
        climbing: false,
        coyote: 0,
        buffer: 0,
        attack: 0,
        attackCd: 0,
        charge: 0,
        dash: 0,
        invuln: 0,
        star: 0,
        spin: 0,
        running: false,
        dead: false,
        win: false,
    };

    const sim = {
        world: meta,
        worldIndex,
        level,
        player,
        entities: packed.entities.map((e) => ({ ...e, alive: e.alive !== false, frame: 0 })),
        particles: [],
        shots: [],
        hp: PLAYER.MAX_HP,
        lives: persist.lives,
        score: persist.score,
        rings: worldIndex === 1 ? 0 : persist.rings || 0,
        timeLeft: meta.time,
        tick: 0,
        camX: Math.max(0, spawn.x - VIEW_W * 0.35),
        shake: 0,
        banner: meta.name,
        bannerTimer: 140,
        combo: 0,
        hasSword: persist.hasSword || worldIndex >= 2,
        hasBuster: persist.hasBuster || worldIndex >= 3,
        hasWhip: persist.hasWhip || worldIndex >= 4,
        hasSpin: persist.hasSpin || worldIndex >= 1,
        messages: [],
        exit: null,
        continue: false,
    };

    if (worldIndex === 1) sim.rings = 0;
    if (worldIndex >= 2) sim.hasSword = true;
    if (worldIndex >= 3) sim.hasBuster = true;
    if (worldIndex >= 4) sim.hasWhip = true;
    if (worldIndex >= 1) sim.hasSpin = true;

    function spawnParts(x, y, n, colors) {
        for (let i = 0; i < n; i++) {
            sim.particles.push({
                x: x + Math.random() * 8,
                y: y + Math.random() * 8,
                vx: (Math.random() - 0.5) * 2.4,
                vy: -Math.random() * 2.2 - 0.4,
                life: 18 + Math.random() * 12,
                s: 1 + (Math.random() * 2) | 0,
                c: colors[(Math.random() * colors.length) | 0],
            });
        }
    }

    function addScore(n, x, y) {
        sim.score += n;
        sim.messages.push({ text: String(n), x, y, life: 40 });
    }

    function bumpBlock(tx, ty) {
        const ch = level.solids[ty]?.[tx];
        if (ch !== '?' && ch !== 'B') return;
        const key = `${tx},${ty}`;
        level.blocks[key] = 6;
        audio.playSfx('bump');
        if (ch === 'B') {
            setTile(level, tx, ty, '.');
            spawnParts(tx * TILE, ty * TILE, 8, ['#d07838', '#884018', '#f0c090']);
            audio.playSfx('break');
            addScore(50, tx * TILE, ty * TILE);
            return;
        }
        setTile(level, tx, ty, 'E');
        const loot = level.secrets[key] || 'coin';
        const px = tx * TILE;
        const py = (ty - 1) * TILE;
        if (loot === 'star') {
            sim.entities.push({ type: 'star', x: px, y: py, w: 16, h: 16, alive: true });
        } else if (loot === 'heart') {
            sim.entities.push({ type: 'heart', x: px, y: py, w: 16, h: 16, alive: true });
        } else if (loot === '1up' || loot === 'oneup') {
            sim.entities.push({ type: 'oneup', x: px, y: py, w: 16, h: 16, alive: true });
        } else {
            sim.entities.push({ type: 'coin', x: px, y: py, w: 16, h: 16, alive: true, pop: 12 });
        }
    }

    function hurt(fromX) {
        if (player.invuln > 0 || player.star > 0 || player.dead) return;
        if (sim.worldIndex === 1 && sim.rings > 0) {
            const lost = sim.rings;
            sim.rings = 0;
            for (let i = 0; i < Math.min(8, lost); i++) {
                sim.entities.push({
                    type: 'ring',
                    x: player.x + Math.random() * 10,
                    y: player.y,
                    w: 12,
                    h: 12,
                    vx: (Math.random() - 0.5) * 2,
                    vy: -2 - Math.random(),
                    bounce: true,
                    life: 160,
                    alive: true,
                });
            }
            player.invuln = PHYS.INVULN;
            player.vx = Math.sign(player.x - fromX) * PHYS.HURT_KNOCK_X;
            player.vy = PHYS.HURT_KNOCK_Y;
            audio.playSfx('hurt');
            sim.shake = 6;
            return;
        }
        sim.hp -= 1;
        player.invuln = PHYS.INVULN;
        player.vx = Math.sign(player.x - fromX || player.facing) * PHYS.HURT_KNOCK_X;
        player.vy = PHYS.HURT_KNOCK_Y;
        audio.playSfx('hurt');
        sim.shake = 8;
        if (sim.hp <= 0) kill();
    }

    function kill() {
        if (player.dead) return;
        player.dead = true;
        player.vy = -4;
        player.vx = 0;
        sim.lives -= 1;
        audio.playSfx('die');
        spawnParts(player.x, player.y, 16, ['#28b8e0', '#e02838', '#f0c090']);
        sim.exit = sim.lives <= 0 ? 'gameover' : 'died';
        sim.exitTimer = 90;
    }

    function meleeBox() {
        if (player.attack <= 0) return null;
        const reach = sim.hasWhip ? 22 : sim.hasSword ? 16 : PLAYER.MELEE_W;
        const x = player.facing > 0 ? player.x + player.w : player.x - reach;
        return { x, y: player.y + 2, w: reach, h: PLAYER.MELEE_H };
    }

    function stompEnemy(ent) {
        const i = Math.min(sim.combo, STOMP_SCORE.length - 1);
        addScore(STOMP_SCORE[i], ent.x, ent.y);
        sim.combo += 1;
        player.vy = PHYS.STOMP_BOUNCE;
        ent.alive = false;
        ent.squish = 12;
        audio.playSfx('stomp');
        spawnParts(ent.x, ent.y, 6, ['#f8e0a0', '#e03830']);
        sim.shake = 3;
    }

    function hitEnemy(ent, dmg = 1) {
        if (ent.hitCool > 0) return;
        ent.hitCool = 12;
        ent.hp = (ent.hp || 1) - dmg;
        audio.playSfx(ent.type === 'boss' ? 'bossHit' : 'hit');
        spawnParts(ent.x, ent.y, 5, ['#f8f8f8', '#f03050']);
        if (ent.hp <= 0) {
            if (ent.type === 'boss') {
                ent.alive = false;
                addScore(5000, ent.x, ent.y);
                audio.playSfx('crystal');
                sim.entities.push({ type: 'crystal', x: ent.x + 8, y: ent.y, w: 12, h: 16, alive: true });
                spawnParts(ent.x, ent.y, 24, ['#e03090', '#40e0f0', '#f8f838']);
            } else {
                ent.alive = false;
                addScore(200, ent.x, ent.y);
            }
        }
    }

    function collect(ent) {
        ent.alive = false;
        if (ent.type === 'coin') {
            addScore(10, ent.x, ent.y);
            audio.playSfx('coin');
        } else if (ent.type === 'ring') {
            sim.rings += 1;
            addScore(10, ent.x, ent.y);
            audio.playSfx('ring');
        } else if (ent.type === 'rupee') {
            addScore(20, ent.x, ent.y);
            audio.playSfx('rupee');
        } else if (ent.type === 'heart') {
            sim.hp = Math.min(PLAYER.MAX_HP, sim.hp + 1);
            audio.playSfx('power');
        } else if (ent.type === 'star') {
            player.star = 360;
            audio.playSfx('power');
        } else if (ent.type === 'oneup') {
            sim.lives += 1;
            addScore(1000, ent.x, ent.y);
            audio.playSfx('oneup');
        } else if (ent.type === 'crystal') {
            addScore(50 * Math.max(0, Math.ceil(sim.timeLeft)), ent.x, ent.y);
            audio.playSfx('crystal');
            player.win = true;
            sim.exit = 'clear';
            sim.exitTimer = 80;
            sim.banner = 'CRISTAL 16-BIT';
            sim.bannerTimer = 80;
        } else if (ent.type === 'candle') {
            sim.entities.push({ type: Math.random() < 0.5 ? 'heart' : 'coin', x: ent.x, y: ent.y - 8, w: 16, h: 16, alive: true });
            audio.playSfx('break');
        } else if (ent.type === 'pot') {
            sim.entities.push({ type: 'rupee', x: ent.x, y: ent.y - 8, w: 16, h: 16, alive: true });
            audio.playSfx('break');
            spawnParts(ent.x, ent.y, 6, ['#c07040', '#e09058']);
        }
    }

    function resolveX(body) {
        const dir = Math.sign(body.vx) || 1;
        const samples = [body.y + 1, body.y + body.h * 0.5, body.y + body.h - 1];
        const edge = dir > 0 ? body.x + body.w : body.x;
        for (const sy of samples) {
            const ch = tileAt(level, edge, sy);
            if (SOLID.has(ch)) {
                const tx = Math.floor(edge / TILE);
                body.x = dir > 0 ? tx * TILE - body.w : (tx + 1) * TILE;
                body.vx = 0;
                return ch;
            }
        }
        return null;
    }

    function resolveY(body, prevY) {
        const down = body.vy >= 0;
        const samples = [body.x + 1, body.x + body.w * 0.5, body.x + body.w - 1];
        const edge = down ? body.y + body.h : body.y;
        body.grounded = false;
        for (const sx of samples) {
            const ch = tileAt(level, sx, edge);
            if (SOLID.has(ch) || (down && ONE_WAY.has(ch))) {
                if (ONE_WAY.has(ch) && down) {
                    const top = Math.floor(edge / TILE) * TILE;
                    if (prevY + body.h > top + 2) continue;
                }
                const ty = Math.floor(edge / TILE);
                if (down) {
                    body.y = ty * TILE - body.h;
                    body.vy = 0;
                    body.grounded = true;
                    return ch;
                }
                body.y = (ty + 1) * TILE;
                body.vy = 0;
                const tx = Math.floor(sx / TILE);
                bumpBlock(tx, ty);
                return ch;
            }
            if (HAZARD.has(ch) && down) {
                hurt(body.x);
                body.vy = PHYS.STOMP_BOUNCE;
            }
            if (ch === '~') {
                hurt(body.x);
            }
        }
        return null;
    }

    function control(input) {
        const p = player;
        if (p.dead || p.win) return;

        if (input.konami) {
            sim.lives += 30;
            p.star = 480;
            sim.banner = 'KONAMI 30 VIDAS';
            sim.bannerTimer = 120;
            audio.playSfx('oneup');
        }

        const onLadder = CLIMB.has(tileAt(level, p.x + p.w / 2, p.y + p.h / 2))
            || CLIMB.has(tileAt(level, p.x + p.w / 2, p.y + p.h));
        if (onLadder && (input.up || input.down)) {
            p.climbing = true;
            p.vy = input.up ? -1.2 : 1.2;
            p.vx *= 0.5;
        } else if (!onLadder) {
            p.climbing = false;
        }

        const maxV = (sim.worldIndex === 1 || p.dash > 0) ? PHYS.MAX_RUN : PHYS.MAX_WALK;
        const acc = p.grounded ? PHYS.ACCEL : PHYS.AIR_ACCEL;
        if (input.left) {
            p.vx -= acc;
            p.facing = -1;
        } else if (input.right) {
            p.vx += acc;
            p.facing = 1;
        }
        p.vx = Math.max(-maxV, Math.min(maxV, p.vx));
        if (p.grounded && !input.left && !input.right) p.vx *= PHYS.FRICTION;
        else if (!p.grounded) p.vx *= PHYS.AIR_DRAG;
        if (Math.abs(p.vx) < 0.04 && !input.left && !input.right) p.vx = 0;
        p.running = Math.abs(p.vx) > 0.3;

        const boost = BOOST.has(tileAt(level, p.x + p.w / 2, p.y + p.h + 1));
        if (boost) p.vx += p.facing * 0.35;

        if (p.grounded) p.coyote = PHYS.COYOTE;
        else if (p.coyote > 0) p.coyote -= 1;
        if (input.jumpPressed) p.buffer = PHYS.JUMP_BUFFER;
        else if (p.buffer > 0) p.buffer -= 1;

        if (p.buffer > 0 && (p.coyote > 0 || p.climbing) && !p.dead) {
            p.vy = PHYS.JUMP_VEL;
            p.grounded = false;
            p.climbing = false;
            p.coyote = 0;
            p.buffer = 0;
            audio.playSfx('jump');
            if (input.down && sim.hasSpin) p.spin = 22;
        }

        if (!p.climbing) {
            const g = (input.jump && p.vy < 0) ? PHYS.HOLD_GRAVITY : PHYS.GRAVITY;
            p.vy = Math.min(PHYS.MAX_FALL, p.vy + g);
        }

        if (input.dashPressed && (sim.hasBuster || sim.worldIndex === 3) && p.dash <= 0) {
            p.dash = PHYS.DASH_FRAMES;
            p.vx = p.facing * PHYS.DASH_VEL;
            audio.playSfx('dash');
        }
        if (p.dash > 0) {
            p.dash -= 1;
            p.vy = Math.min(p.vy, 0.4);
        }

        if (input.attack) p.charge += 1;
        else p.charge = 0;
        if (p.charge > 8 && p.charge % 10 === 0 && sim.hasBuster) audio.playSfx('charge');

        if (p.attackCd > 0) p.attackCd -= 1;
        if (input.attackPressed && p.attackCd <= 0) {
            p.attack = PLAYER.MELEE_FRAMES;
            p.attackCd = PLAYER.MELEE_CD;
            if (sim.hasBuster || sim.worldIndex === 3) {
                const charged = p.charge >= PLAYER.CHARGE_NEED;
                sim.shots.push({
                    x: p.facing > 0 ? p.x + p.w : p.x - 8,
                    y: p.y + 4,
                    w: charged ? 10 : 6,
                    h: charged ? 6 : 4,
                    vx: p.facing * (charged ? 4.2 : 3.2),
                    dmg: charged ? 2 : 1,
                    life: 50,
                });
                audio.playSfx('shoot');
                p.charge = 0;
            } else {
                audio.playSfx('bump');
            }
        }
        if (p.attack > 0) p.attack -= 1;
        if (p.spin > 0) p.spin -= 1;
        if (p.invuln > 0) p.invuln -= 1;
        if (p.star > 0) p.star -= 1;
        if (p.grounded) sim.combo = 0;
    }

    function updatePlayer() {
        const p = player;
        const prevY = p.y;
        p.x += p.vx;
        resolveX(p);
        p.y += p.vy;
        resolveY(p, prevY);
        if (p.x < 2) { p.x = 2; p.vx = 0; }
        const maxX = level.width * TILE - p.w - 2;
        if (p.x > maxX) { p.x = maxX; p.vx = 0; }
        if (p.y > level.height * TILE + 24 && !p.dead) kill();
    }

    function updateEntities() {
        const p = player;
        const sword = meleeBox();

        for (const sh of sim.shots) {
            sh.x += sh.vx;
            sh.life -= 1;
            const ch = tileAt(level, sh.x + sh.w / 2, sh.y + sh.h / 2);
            if (SOLID.has(ch)) sh.life = 0;
        }
        sim.shots = sim.shots.filter((s) => s.life > 0);

        for (const ent of sim.entities) {
            if (ent.hitCool > 0) ent.hitCool -= 1;
            if (!ent.alive && ent.type !== 'walker') continue;
            ent.frame = sim.tick;

            if (ent.type === 'sign') {
                if (aabb(p, ent) && !ent.shown) {
                    sim.banner = ent.text;
                    sim.bannerTimer = 160;
                    ent.shown = true;
                    if (/ESPADA|ALONE/.test(ent.text)) sim.hasSword = true;
                }
                continue;
            }

            if (ent.type === 'mover') {
                ent.x += ent.vx;
                if (ent.x < ent.minX || ent.x > ent.maxX) ent.vx *= -1;
                const feet = { x: p.x, y: p.y + p.h, w: p.w, h: 4 };
                if (aabb(feet, { x: ent.x, y: ent.y, w: ent.w, h: 8 }) && p.vy >= 0) {
                    p.y = ent.y - p.h;
                    p.vy = 0;
                    p.grounded = true;
                    p.x += ent.vx;
                }
                continue;
            }

            if (ent.type === 'spring') {
                if (aabb(p, ent) && p.vy > 0) {
                    p.vy = -7.2;
                    p.grounded = false;
                    audio.playSfx('spring');
                }
                continue;
            }

            if (['coin', 'ring', 'rupee', 'heart', 'star', 'oneup', 'crystal'].includes(ent.type)) {
                if (ent.pop) {
                    ent.y -= 1.2;
                    ent.pop -= 1;
                    if (ent.pop <= 0 && ent.type === 'coin') collect(ent);
                }
                if (ent.bounce) {
                    ent.vy += 0.18;
                    ent.x += ent.vx || 0;
                    ent.y += ent.vy;
                    ent.life -= 1;
                    if (ent.life <= 0) ent.alive = false;
                }
                if (ent.alive && aabb(p, ent) && !(ent.bounce && ent.life > 145)) collect(ent);
                continue;
            }

            if (ent.type === 'candle' || ent.type === 'pot') {
                if ((sword && aabb(sword, ent)) || sim.shots.some((s) => aabb(s, ent))) {
                    collect(ent);
                }
                continue;
            }

            if (ent.type === 'piranha') {
                ent.timer = (ent.timer || 0) + 1;
                const cycle = ent.timer % 180;
                ent.y = cycle < 70 ? ent.y0 - Math.min(16, cycle * 0.4) : ent.y0;
                if (p.star <= 0 && aabb(p, { x: ent.x + 2, y: ent.y, w: 12, h: 14 })) hurt(ent.x);
                continue;
            }

            if (ent.type === 'flyer') {
                if (!ent.alive) continue;
                ent.x += ent.vx;
                ent.y = ent.y0 + Math.sin(sim.tick * 0.08 + ent.x * 0.02) * 10;
                if (ent.x < 8 || ent.x > level.width * TILE - 24) ent.vx *= -1;
            }

            if ((ent.type === 'walker' || ent.type === 'armored') && ent.alive) {
                ent.x += ent.vx;
                const ahead = ent.x + (ent.vx > 0 ? ent.w + 2 : -2);
                const floor = tileAt(level, ahead, ent.y + ent.h + 2);
                const wall = tileAt(level, ahead, ent.y + ent.h * 0.5);
                        if ((!SOLID.has(floor) && !ONE_WAY.has(floor)) || SOLID.has(wall)) ent.vx *= -1;
            }

            if (ent.type === 'boss' && ent.alive) {
                ent.timer += 1;
                ent.phase = ent.hp > 8 ? 0 : ent.hp > 4 ? 1 : 2;
                ent.x += ent.vx;
                if (ent.x < 32 || ent.x > (level.width - 4) * TILE) ent.vx *= -1;
                if (ent.timer % (ent.phase === 2 ? 50 : 80) === 0) {
                    ent.vy = -3.2;
                    sim.shots.push({
                        x: ent.x + 12,
                        y: ent.y + 12,
                        w: 8,
                        h: 8,
                        vx: Math.sign(p.x - ent.x) * (1.6 + ent.phase * 0.4),
                        vy: 0.4,
                        dmg: 1,
                        life: 90,
                        enemy: true,
                    });
                }
                ent.vy = Math.min(4, (ent.vy || 0) + 0.2);
                ent.y += ent.vy;
                const prev = ent.y - ent.vy;
                const dummy = { x: ent.x, y: ent.y, w: ent.w, h: ent.h, vy: ent.vy, vx: 0 };
                dummy.grounded = false;
                resolveY(dummy, prev);
                ent.y = dummy.y;
                ent.vy = dummy.vy;
            }

            if (!ent.alive) continue;

            const hostile = ['walker', 'armored', 'flyer', 'boss'].includes(ent.type);
            if (!hostile) continue;

            if (p.star > 0 && aabb(p, ent)) {
                hitEnemy(ent, 9);
                continue;
            }
            if (p.spin > 0 && aabb(p, ent)) {
                hitEnemy(ent, 1);
                continue;
            }

            const canStomp = p.vy > 0.2 && (p.y + p.h) <= ent.y + ent.h * 0.68;
            if (canStomp && aabb({ x: p.x, y: p.y + p.h - 4, w: p.w, h: 8 }, ent) && ent.type !== 'armored') {
                stompEnemy(ent);
                continue;
            }
            if (canStomp && ent.type === 'armored' && aabb({ x: p.x, y: p.y + p.h - 4, w: p.w, h: 8 }, ent)) {
                player.vy = PHYS.STOMP_BOUNCE;
                audio.playSfx('bump');
                continue;
            }

            if (sword && aabb(sword, ent)) hitEnemy(ent, sim.hasWhip ? 2 : 1);

            for (const sh of sim.shots) {
                if (sh.enemy) continue;
                if (aabb(sh, ent)) {
                    sh.life = 0;
                    hitEnemy(ent, sh.dmg);
                }
            }

            if (p.invuln <= 0 && aabb(p, ent)) hurt(ent.x);
        }

        for (const sh of sim.shots) {
            if (!sh.enemy) continue;
            sh.y += sh.vy || 0;
            if (p.invuln <= 0 && aabb(p, sh)) {
                hurt(sh.x);
                sh.life = 0;
            }
        }

        sim.entities = sim.entities.filter((e) => e.alive !== false || e.squish > 0);
        for (const e of sim.entities) {
            if (e.squish) {
                e.squish -= 1;
                if (e.squish <= 0) e.alive = false;
            }
        }
    }

    function updateParticles() {
        for (const pt of sim.particles) {
            pt.x += pt.vx;
            pt.y += pt.vy;
            pt.vy += 0.12;
            pt.life -= 1;
        }
        sim.particles = sim.particles.filter((pt) => pt.life > 0);
        for (const m of sim.messages) {
            m.y -= 0.4;
            m.life -= 1;
        }
        sim.messages = sim.messages.filter((m) => m.life > 0);
    }

    function update(input) {
        sim.tick += 1;
        if (sim.bannerTimer > 0) sim.bannerTimer -= 1;
        if (sim.shake > 0) sim.shake -= 1;

        if (!player.dead && !player.win) {
            sim.timeLeft -= 1 / 60;
            if (sim.timeLeft <= 0) {
                sim.timeLeft = 0;
                kill();
            }
        }

        control(input);
        updatePlayer();
        updateEntities();
        updateParticles();

        const look = player.facing * 28;
        const target = player.x - VIEW_W * 0.42 + look;
        sim.camX += (target - sim.camX) * 0.12;
        const maxCam = Math.max(0, level.width * TILE - VIEW_W);
        sim.camX = Math.max(0, Math.min(maxCam, sim.camX));
        if (sim.exitTimer > 0) sim.exitTimer -= 1;

        return sim;
    }

    function snapshot() {
        return {
            lives: Math.max(0, sim.lives),
            score: sim.score,
            rings: sim.rings,
            hasSword: sim.hasSword,
            hasBuster: sim.hasBuster,
            hasWhip: sim.hasWhip,
            hasSpin: sim.hasSpin,
        };
    }

    return { sim, update, snapshot, kill };
}
