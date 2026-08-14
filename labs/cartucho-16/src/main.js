/**
 * Cartucho 16 — cenas (boot, título, seletor, jogo, ending) e loop a 60 Hz.
 */

import {
    VIEW_W, VIEW_H, TILE, WORLDS, PLAYER, loadSave, writeSave, PALETTES,
} from './config.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createSim } from './game.js';
import {
    p, text, centerText, drawSky, drawTile, drawLeo, drawWalker, drawFlyer,
    drawArmored, drawPiranha, drawBoss, drawItem, drawHud, drawParticles, drawScan,
} from './gfx.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
ctx.imageSmoothingEnabled = false;

const shell = document.getElementById('crt');
const audio = createAudio();
const input = createInput(document);
const save = loadSave();

const persist = {
    lives: PLAYER.START_LIVES,
    score: 0,
    rings: 0,
    hasSword: false,
    hasBuster: false,
    hasWhip: false,
    hasSpin: false,
};

let scene = 'boot';
let sceneT = 0;
let fade = 0;
let fadeDir = 0;
let nextScene = null;
let simApi = null;
let selected = 0;
let selectHold = 0;
let continueT = 10;
let muted = save.muted;
let crtOn = save.crt !== false;
let lastTs = 0;
let acc = 0;
const STEP = 1000 / 60;

function wireHud() {
    const muteBtn = document.getElementById('muteBtn');
    const crtBtn = document.getElementById('crtBtn');
    if (!muteBtn || muteBtn.dataset.wired === '1') return muteBtn;
    muteBtn.dataset.wired = '1';
    muteBtn.addEventListener('click', () => {
        audio.unlock();
        muted = !muted;
        audio.setMuted(muted);
        save.muted = muted;
        writeSave(save);
        syncChrome();
    });
    crtBtn?.addEventListener('click', () => {
        crtOn = !crtOn;
        save.crt = crtOn;
        writeSave(save);
        syncChrome();
    });
    return muteBtn;
}

audio.setMuted(muted);
wireHud();
syncChrome();
document.addEventListener('DOMContentLoaded', () => { wireHud(); syncChrome(); });

function syncChrome() {
    document.documentElement.style.setProperty('--crt-opacity', crtOn ? '1' : '0');
    const muteBtn = document.getElementById('muteBtn');
    const crtBtn = document.getElementById('crtBtn');
    if (muteBtn) {
        muteBtn.setAttribute('aria-pressed', muted ? 'true' : 'false');
        muteBtn.textContent = muted ? 'SOM OFF' : 'SOM ON';
    }
    if (crtBtn) {
        crtBtn.setAttribute('aria-pressed', crtOn ? 'true' : 'false');
        crtBtn.textContent = crtOn ? 'CRT ON' : 'CRT OFF';
    }
    shell?.classList.toggle('no-crt', !crtOn);
}

function go(name, withFade = true) {
    if (!withFade) {
        scene = name;
        sceneT = 0;
        return;
    }
    fadeDir = 1;
    nextScene = name;
}

function startWorld(index) {
    persist.hp = PLAYER.MAX_HP;
    simApi = createSim(index, audio, persist);
    audio.playSong(WORLDS[index].music);
    scene = 'play';
    sceneT = 0;
    fade = 0;
    fadeDir = 0;
}

function unlocked(i) {
    if (i < 5) return true;
    return save.crystals.every(Boolean);
}

function drawBoot() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    if (sceneT < 40) return;
    if (sceneT < 160) {
        centerText(ctx, 'PIXELSOFT', 88, '#f8f8f8', 2);
        centerText(ctx, 'PRESENTS', 112, '#80d0f8', 1);
        p(ctx, 78, 132, 100, 3, '#f83058');
        p(ctx, 78, 132, Math.min(100, (sceneT - 40) * 1.4), 3, '#f8d030');
    } else {
        centerText(ctx, 'INSERT CARTUCHO', 96, '#f8d030', 1);
        centerText(ctx, 'LICENCIADO PELA PIXEL CORP', 120, '#808890', 1);
    }
}

function drawTitle(pad) {
    drawSky(ctx, 'pradaria', sceneT * 0.4, sceneT);
    p(ctx, 0, 168, VIEW_W, 56, PALETTES.pradaria.ground);
    p(ctx, 0, 168, VIEW_W, 6, PALETTES.pradaria.groundTop);

    const pulse = 1 + Math.sin(sceneT * 0.08) * 0.04;
    ctx.save();
    ctx.translate(VIEW_W / 2, 70);
    ctx.scale(pulse, pulse);
    ctx.translate(-VIEW_W / 2, -70);
    centerText(ctx, 'CARTUCHO', 40, '#f8e038', 2);
    centerText(ctx, '16', 58, '#f83058', 3);
    ctx.restore();

    centerText(ctx, 'A LENDA DO PIXEL DOURADO', 92, '#f0f0ff', 1);
    centerText(ctx, '1994  DIOGO SOFT', 108, '#90a0c0', 1);

    if (((sceneT / 24) | 0) % 2 === 0) centerText(ctx, 'PRESSIONE START', 140, '#fff8c0', 1);

    text(ctx, 'Z PULO  X ATK  SHIFT DASH', 28, 186, '#d8e0f0', 1);
    text(ctx, 'BEST ' + String(save.best).padStart(6, '0'), 8, 210, '#f8d030', 1);
    const n = save.crystals.filter(Boolean).length;
    text(ctx, 'CRISTAIS ' + n + '/5', 160, 210, '#40e0f8', 1);

    drawLeo(ctx, 118, 148, {
        facing: 1, frame: sceneT, grounded: true, running: true, blink: false,
        attack: 0, star: 0, spin: 0, dash: 0, hurt: false,
    });

    if (pad.startPressed || pad.jumpPressed || pad.attackPressed) {
        audio.unlock();
        audio.playSfx('start');
        audio.playSong('title');
        go('select');
    }
}

function drawSelect(pad) {
    drawSky(ctx, 'cidadela', 40, sceneT);
    p(ctx, 8, 8, VIEW_W - 16, 16, 'rgba(8,8,24,0.7)');
    centerText(ctx, 'STAGE SELECT', 12, '#40e8f8', 1);
    centerText(ctx, 'ESCOLHA O CARTUCHO', 28, '#f8e0a0', 1);

    if (selectHold > 0) selectHold -= 1;
    else {
        if (pad.left) { selected = (selected + 5) % 6; selectHold = 12; audio.playSfx('select'); }
        if (pad.right) { selected = (selected + 1) % 6; selectHold = 12; audio.playSfx('select'); }
        if (pad.up) { selected = (selected + 4) % 6; selectHold = 12; audio.playSfx('select'); }
        if (pad.down) { selected = (selected + 2) % 6; selectHold = 12; audio.playSfx('select'); }
    }

    const slots = [
        { i: 0, x: 16, y: 48 },
        { i: 1, x: 96, y: 48 },
        { i: 2, x: 176, y: 48 },
        { i: 3, x: 16, y: 118 },
        { i: 4, x: 96, y: 118 },
        { i: 5, x: 176, y: 118 },
    ];

    for (const s of slots) {
        const w = WORLDS[s.i];
        const on = selected === s.i;
        const lock = !unlocked(s.i);
        const pal = PALETTES[w.id];
        p(ctx, s.x, s.y, 64, 56, on ? '#f8e038' : '#101828');
        p(ctx, s.x + 2, s.y + 2, 60, 52, lock ? '#182030' : pal.skyTop);
        p(ctx, s.x + 6, s.y + 18, 52, 22, pal.ground);
        p(ctx, s.x + 6, s.y + 18, 52, 4, pal.groundTop);
        text(ctx, w.short, s.x + 6, s.y + 6, on ? '#fff' : '#c0c8d8', 1);
        if (s.i < 5 && save.crystals[s.i]) text(ctx, '*', s.x + 48, s.y + 6, '#40e8f8', 1);
        if (lock) text(ctx, 'LOCK', s.x + 18, s.y + 36, '#f83058', 1);
        if (on) p(ctx, s.x, s.y, 64, 2, '#fff');
    }

    const cur = WORLDS[selected];
    p(ctx, 8, 182, VIEW_W - 16, 34, 'rgba(8,8,24,0.75)');
    text(ctx, cur.name, 14, 188, '#f8e038', 1);
    text(ctx, cur.homage, 14, 200, '#90b0d0', 1);

    if ((pad.startPressed || pad.jumpPressed) && unlocked(selected)) {
        audio.playSfx('insert');
        persist.lives = Math.max(persist.lives, 1);
        startWorld(selected);
        return;
    }
    if (pad.pausePressed) go('title');
}

function drawWorld(api) {
    const sim = api.sim;
    const cam = sim.camX + (sim.shake ? (Math.random() - 0.5) * sim.shake : 0);
    drawSky(ctx, sim.world.id, cam, sim.tick);

    const x0 = Math.max(0, Math.floor(cam / TILE) - 1);
    const x1 = Math.min(sim.level.width, x0 + 18);
    for (let ty = 0; ty < sim.level.height; ty++) {
        for (let tx = x0; tx < x1; tx++) {
            const ch = sim.level.solids[ty][tx];
            if (!ch || ch === '.') continue;
            const bounce = sim.level.blocks[`${tx},${ty}`] || 0;
            if (bounce) sim.level.blocks[`${tx},${ty}`] = bounce - 1;
            drawTile(ctx, ch, tx * TILE - cam, ty * TILE, sim.world.id, sim.tick, { bounce });
        }
    }

    for (const ent of sim.entities) {
        const x = ent.x - cam;
        if (x < -40 || x > VIEW_W + 40) continue;
        if (ent.type === 'sign') {
            p(ctx, x + 4, ent.y + 4, 8, 12, '#c8a050');
            p(ctx, x + 2, ent.y + 2, 12, 8, '#e8d080');
            text(ctx, '!', x + 5, ent.y + 4, '#803010', 1, null);
        } else if (ent.type === 'mover') {
            p(ctx, x, ent.y, ent.w, 8, PALETTES[sim.world.id].brick);
            p(ctx, x, ent.y, ent.w, 2, PALETTES[sim.world.id].groundTop);
        } else if (ent.type === 'walker' || (!ent.alive && ent.squish)) {
            drawWalker(ctx, x, ent.y, sim.world.id, sim.tick, ent.squish);
        } else if (ent.type === 'flyer') {
            drawFlyer(ctx, x, ent.y, sim.world.id, sim.tick);
        } else if (ent.type === 'armored') {
            drawArmored(ctx, x, ent.y, sim.tick);
        } else if (ent.type === 'piranha') {
            drawPiranha(ctx, x, ent.y, sim.tick);
        } else if (ent.type === 'boss') {
            drawBoss(ctx, x, ent.y, ent.hp, sim.tick, ent.phase);
        } else {
            drawItem(ctx, ent.type, x, ent.y, sim.tick);
        }
    }

    for (const sh of sim.shots) {
        p(ctx, sh.x - cam, sh.y, sh.w, sh.h, sh.enemy ? '#f030a0' : '#40f0ff');
    }

    const pl = sim.player;
    drawLeo(ctx, pl.x - cam - 1, pl.y - 2, {
        facing: pl.facing,
        frame: sim.tick,
        grounded: pl.grounded,
        running: pl.running,
        blink: false,
        attack: pl.attack,
        star: pl.star,
        spin: pl.spin,
        dash: pl.dash,
        hurt: pl.invuln > 0,
    });

    drawParticles(ctx, sim.particles, cam);
    for (const m of sim.messages) {
        text(ctx, m.text, m.x - cam, m.y, '#fff8c0', 1);
    }
    drawScan(ctx, sim.tick, sim.world.id);
    drawHud(ctx, sim);
}

function drawPause(pad) {
    p(ctx, 48, 64, 160, 96, 'rgba(8,8,24,0.88)');
    p(ctx, 50, 66, 156, 92, '#101830');
    centerText(ctx, 'PAUSE', 84, '#f8e038', 2);
    centerText(ctx, 'ESC CONTINUA', 112, '#d0d8f0', 1);
    centerText(ctx, 'START = SELETOR', 128, '#90a0c0', 1);
    if (pad.startPressed) {
        audio.playSong('title');
        scene = 'select';
        sceneT = 0;
        fade = 0;
        fadeDir = 0;
        return;
    }
    if (pad.pausePressed || pad.jumpPressed) {
        scene = 'play';
        sceneT = 0;
    }
}

function drawDied(pad) {
    p(ctx, 0, 0, VIEW_W, VIEW_H, 'rgba(0,0,0,0.45)');
    centerText(ctx, 'LEO CAIU', 80, '#f83058', 2);
    centerText(ctx, 'VIDAS x' + Math.max(0, simApi.sim.lives), 108, '#f8f8f8', 1);
    centerText(ctx, 'START PARA RETRY', 140, '#f8e038', 1);
    if (pad.startPressed || pad.jumpPressed) {
        const idx = simApi.sim.worldIndex;
        Object.assign(persist, simApi.snapshot());
        persist.lives = Math.max(0, persist.lives);
        startWorld(idx);
    }
}

function drawClear() {
    const sim = simApi.sim;
    p(ctx, 0, 0, VIEW_W, VIEW_H, 'rgba(8,16,40,0.5)');
    centerText(ctx, 'STAGE CLEAR', 70, '#f8e038', 2);
    centerText(ctx, sim.world.name, 96, '#40e8f8', 1);
    centerText(ctx, 'SCORE ' + sim.score, 120, '#fff', 1);
    if (sceneT === 1) {
        if (sim.worldIndex < 5) save.crystals[sim.worldIndex] = true;
        else save.bossClear = true;
        if (sim.score > save.best) save.best = sim.score;
        writeSave(save);
    }
}

function drawGameOver(pad) {
    ctx.fillStyle = '#08040c';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    centerText(ctx, 'GAME OVER', 64, '#f83058', 2);
    centerText(ctx, 'YEAH', 88, '#f8e038', 1);
    centerText(ctx, 'CONTINUE? ' + Math.ceil(continueT), 120, '#fff', 1);
    centerText(ctx, 'START = SIM   ESC = NAO', 148, '#90a0c0', 1);
    if (sceneT > 0 && sceneT % 60 === 0) {
        continueT -= 1;
        audio.playSfx('continue');
    }
    if (pad.startPressed || pad.jumpPressed) {
        persist.lives = PLAYER.START_LIVES;
        continueT = 10;
        startWorld(simApi?.sim.worldIndex || selected);
        return;
    }
    if (continueT <= 0 || pad.pausePressed) {
        persist.lives = PLAYER.START_LIVES;
        persist.score = 0;
        continueT = 10;
        audio.playSong('title');
        go('title');
    }
}

function drawEnding(pad) {
    drawSky(ctx, 'pradaria', sceneT * 0.2, sceneT);
    centerText(ctx, 'THE END', 48, '#f8e038', 2);
    centerText(ctx, 'O CARTUCHO DESCANSA', 80, '#fff', 1);
    centerText(ctx, 'LEO VOLTA PRA LOCADORA', 96, '#d0d8f0', 1);
    centerText(ctx, 'MULTA: 1 CRISTAL', 112, '#80e0a0', 1);
    centerText(ctx, 'DIOGO PAULINO  2026', 148, '#90a0c0', 1);
    centerText(ctx, 'OBRIGADO POR JOGAR', 168, '#f8f8f8', 1);
    if (((sceneT / 24) | 0) % 2 === 0) centerText(ctx, 'START', 196, '#f8e038', 1);
    if (pad.startPressed || pad.jumpPressed) {
        audio.playSong('title');
        go('title');
    }
}

function tick() {
    const pad = input.poll();
    audio.tick(1 / 60);
    sceneT += 1;

    if (fadeDir !== 0) {
        fade += fadeDir * 0.08;
        if (fade >= 1 && fadeDir > 0) {
            scene = nextScene;
            sceneT = 0;
            fadeDir = -1;
            if (scene === 'play' && simApi) {
                /* already created */
            }
        }
        if (fade <= 0 && fadeDir < 0) {
            fade = 0;
            fadeDir = 0;
        }
    }

    if (scene === 'boot') {
        if (sceneT === 2) audio.unlock();
        if (sceneT === 12) audio.playSfx('boot');
        if (sceneT === 170) audio.playSfx('insert');
        drawBoot();
        if (sceneT > 220 || pad.startPressed || pad.jumpPressed) {
            audio.playSong('title');
            go('title', false);
            scene = 'title';
            sceneT = 0;
        }
    } else if (scene === 'title') {
        drawTitle(pad);
    } else if (scene === 'select') {
        drawSelect(pad);
    } else if (scene === 'play') {
        if (pad.pausePressed) {
            audio.playSfx('pause');
            scene = 'pause';
        } else {
            simApi.update(pad);
            drawWorld(simApi);
            const sim = simApi.sim;
            if (sim.exit && sim.exitTimer <= 0) {
                Object.assign(persist, simApi.snapshot());
                if (sim.exit === 'clear') {
                    if (sim.worldIndex === 5) {
                        audio.playSong('ending');
                        go('ending');
                    } else {
                        audio.playSong('title');
                        scene = 'clear';
                        sceneT = 0;
                    }
                } else if (sim.exit === 'gameover' || persist.lives < 0) {
                    continueT = 10;
                    go('gameover', false);
                    scene = 'gameover';
                    sceneT = 0;
                } else if (sim.exit === 'died') {
                    scene = 'died';
                    sceneT = 0;
                }
            }
        }
    } else if (scene === 'pause') {
        drawWorld(simApi);
        drawPause(pad);
    } else if (scene === 'died') {
        drawWorld(simApi);
        drawDied(pad);
    } else if (scene === 'clear') {
        drawWorld(simApi);
        drawClear();
        if (sceneT > 90 && (pad.startPressed || pad.jumpPressed)) go('select', false);
        if (sceneT > 90) {
            scene = 'select';
            sceneT = 0;
        }
    } else if (scene === 'gameover') {
        drawGameOver(pad);
    } else if (scene === 'ending') {
        drawEnding(pad);
    }

    if (fade > 0) {
        ctx.fillStyle = `rgba(0,0,0,${fade})`;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
}

function loop(ts) {
    if (!lastTs) lastTs = ts;
    acc += ts - lastTs;
    lastTs = ts;
    acc = Math.min(acc, 100);
    while (acc >= STEP) {
        tick();
        acc -= STEP;
    }
    requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

document.addEventListener('pointerdown', () => audio.unlock(), { once: true });
document.addEventListener('keydown', () => audio.unlock(), { once: true });
