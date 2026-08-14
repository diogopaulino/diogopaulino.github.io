/**
 * Telas: título, seleção, luta, pausa, continue e encerramento.
 */

import { VW, VH, CHARACTER_ORDER, CHARACTERS } from './config.js';
import { Input } from './input.js';
import { Game } from './game.js';
import { drawPortrait, drawActor } from './sprites.js';
import { drawStage } from './world.js';
import * as audio from './audio.js';
import { STAGES } from './config.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
const input = new Input();

const ui = {
    title: document.getElementById('title-screen'),
    select: document.getElementById('select-screen'),
    play: document.getElementById('play-screen'),
    pause: document.getElementById('pause-overlay'),
    over: document.getElementById('over-overlay'),
    win: document.getElementById('win-overlay'),
    help: document.getElementById('help-overlay'),
    continueCount: document.getElementById('continue-count'),
    scoreLine: document.getElementById('over-score'),
    winScore: document.getElementById('win-score'),
    muteBtn: document.getElementById('mute-btn'),
    pauseBtn: document.getElementById('pause-btn'),
    roster: document.getElementById('roster'),
    touch: document.getElementById('touch-controls')
};

let mode = 'title';
let game = null;
let selected = 'frank';
let acc = 0;
let last = performance.now();
let bgTick = 0;
let continueAcc = 0;
let view = { scale: 1, ox: 0, oy: 0, dpr: 1 };

function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.max(1, w * dpr);
    canvas.height = Math.max(1, h * dpr);
    const scale = Math.min(w / VW, h / VH);
    view = {
        scale,
        ox: (w - VW * scale) / 2,
        oy: (h - VH * scale) / 2,
        dpr
    };
}

function beginDraw() {
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.fillStyle = '#07060a';
    ctx.fillRect(0, 0, canvas.width / view.dpr, canvas.height / view.dpr);
    ctx.save();
    ctx.translate(view.ox, view.oy);
    ctx.scale(view.scale, view.scale);
    ctx.beginPath();
    ctx.rect(0, 0, VW, VH);
    ctx.clip();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
}

function endDraw() {
    ctx.restore();
}

function show(el) {
    for (const node of [ui.title, ui.select, ui.play, ui.pause, ui.over, ui.win, ui.help]) {
        if (!node) continue;
        node.hidden = node !== el;
    }
}

function setMode(next) {
    mode = next;
    document.body.dataset.screen = next;
    if (next === 'title') show(ui.title);
    else if (next === 'select') show(ui.select);
    else if (next === 'play') {
        ui.title.hidden = true;
        ui.select.hidden = true;
        ui.play.hidden = false;
        ui.pause.hidden = true;
        ui.over.hidden = true;
        ui.win.hidden = true;
        ui.help.hidden = true;
    } else if (next === 'pause') ui.pause.hidden = false;
    else if (next === 'over') ui.over.hidden = false;
    else if (next === 'win') ui.win.hidden = false;
    else if (next === 'help') ui.help.hidden = false;
}

function buildRoster() {
    ui.roster.innerHTML = '';
    for (const id of CHARACTER_ORDER) {
        const c = CHARACTERS[id];
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'char-card' + (id === selected ? ' is-on' : '');
        card.dataset.id = id;
        card.innerHTML = `
            <canvas width="220" height="260" aria-hidden="true"></canvas>
            <strong>${c.name}</strong>
            <span>${c.title}</span>
            <p>${c.blurb}</p>
            <em>${c.specialName}</em>`;
        const cv = card.querySelector('canvas');
        drawPortrait(cv.getContext('2d'), id, 220, 260);
        card.addEventListener('click', () => {
            selected = id;
            audio.sfx('ui');
            ui.roster.querySelectorAll('.char-card').forEach((n) => n.classList.toggle('is-on', n.dataset.id === id));
            document.getElementById('select-blurb').textContent = `${c.name} — ${c.blurb}`;
        });
        ui.roster.appendChild(card);
    }
    document.getElementById('select-blurb').textContent = `${CHARACTERS[selected].name} — ${CHARACTERS[selected].blurb}`;
}

function startGame() {
    audio.unlock();
    game = new Game(selected);
    setMode('play');
}

function backToTitle() {
    audio.stopMusic();
    game = null;
    setMode('title');
}

function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    acc += dt;
    bgTick++;
    input.beginFrame();

    if (mode === 'title' && (input.consume('start') || input.consume('attack') || input.consume('jump'))) {
        audio.unlock();
        audio.sfx('ui');
        setMode('select');
    } else if (mode === 'select') {
        if (input.consume('left')) cycleChar(-1);
        if (input.consume('right')) cycleChar(1);
        if (input.consume('start') || input.consume('attack')) {
            audio.sfx('ui');
            startGame();
        }
        if (input.consume('pause')) setMode('title');
    } else if (mode === 'play' && game) {
        if (input.consume('pause') || input.consume('start')) {
            game.paused = true;
            setMode('pause');
        } else if (input.consume('mute')) syncMute(audio.toggleMute());
        else {
            while (acc >= 1 / 60) {
                if (!game.paused) game.update(input);
                acc -= 1 / 60;
            }
            if (game.won) {
                ui.winScore.textContent = `SCORE ${String(game.score).padStart(7, '0')}  ·  ${game.kills} K.O.`;
                setMode('win');
            } else if (game.over) {
                ui.scoreLine.textContent = `SCORE ${String(game.score).padStart(7, '0')}`;
                setMode('over');
                continueAcc = 0;
            }
        }
    } else if (mode === 'pause') {
        if (input.consume('pause') || input.consume('start')) resume();
    } else if (mode === 'over') {
        continueAcc += dt;
        if (continueAcc >= 1 && game) {
            continueAcc = 0;
            game.continueT--;
            ui.continueCount.textContent = String(Math.max(0, game.continueT));
            audio.sfx('continue');
            if (game.continueT < 0) backToTitle();
        }
        if (input.consume('start') || input.consume('attack')) {
            game.continue();
            setMode('play');
        }
    } else if (mode === 'win') {
        if (input.consume('start') || input.consume('attack')) backToTitle();
    } else if (mode === 'help') {
        if (input.consume('pause') || input.consume('start')) setMode('title');
    }

    if (mode !== 'play') acc = 0;
    input.endFrame();

    beginDraw();
    if (game && (mode === 'play' || mode === 'pause' || mode === 'over' || mode === 'win')) {
        game.render(ctx);
    } else {
        drawStage(ctx, STAGES[0], (bgTick * 0.6) % 800, bgTick);
        if (mode === 'title' || mode === 'help') {
            ctx.fillStyle = 'rgba(6,4,10,0.35)';
            ctx.fillRect(0, 0, VW, VH);
            const dummy = { sx: 220, sy: 560, facing: 1, state: 'idle', kind: 'frank', scale: 1.15, y: 0, invuln: 0, flash: 0, charId: 'frank', team: 'hero' };
            drawActor(ctx, dummy, bgTick);
            drawActor(ctx, { ...dummy, sx: 420, kind: 'vlad', charId: 'vlad', scale: 1.05 }, bgTick + 10);
            drawActor(ctx, { ...dummy, sx: 860, kind: 'nekro', charId: 'nekro', facing: -1, scale: 1.08 }, bgTick + 20);
            drawActor(ctx, { ...dummy, sx: 1060, kind: 'lupa', charId: 'lupa', facing: -1, scale: 0.98 }, bgTick + 6);
        }
    }
    endDraw();
    requestAnimationFrame(loop);
}

function cycleChar(dir) {
    const i = CHARACTER_ORDER.indexOf(selected);
    selected = CHARACTER_ORDER[(i + dir + CHARACTER_ORDER.length) % CHARACTER_ORDER.length];
    audio.sfx('ui');
    ui.roster.querySelectorAll('.char-card').forEach((n) => n.classList.toggle('is-on', n.dataset.id === selected));
    const c = CHARACTERS[selected];
    document.getElementById('select-blurb').textContent = `${c.name} — ${c.blurb}`;
}

function resume() {
    if (game) game.paused = false;
    ui.pause.hidden = true;
    setMode('play');
}

function syncMute(muted) {
    ui.muteBtn?.setAttribute('aria-pressed', muted ? 'true' : 'false');
    ui.muteBtn?.classList.toggle('is-muted', muted);
}

document.getElementById('btn-start')?.addEventListener('click', () => {
    audio.unlock();
    audio.sfx('ui');
    setMode('select');
});
document.getElementById('btn-help')?.addEventListener('click', () => {
    audio.unlock();
    setMode('help');
});
document.getElementById('help-close')?.addEventListener('click', () => setMode('title'));
document.getElementById('btn-fight')?.addEventListener('click', startGame);
document.getElementById('btn-back-select')?.addEventListener('click', () => setMode('title'));
document.getElementById('resume-btn')?.addEventListener('click', resume);
document.getElementById('pause-quit')?.addEventListener('click', backToTitle);
document.getElementById('continue-btn')?.addEventListener('click', () => {
    game?.continue();
    setMode('play');
});
document.getElementById('giveup-btn')?.addEventListener('click', backToTitle);
document.getElementById('win-ok')?.addEventListener('click', backToTitle);
ui.pauseBtn?.addEventListener('click', () => {
    if (mode === 'play' && game) {
        game.paused = true;
        setMode('pause');
    }
});
ui.muteBtn?.addEventListener('click', () => syncMute(audio.toggleMute()));

input.bindTouch({
    stick: document.getElementById('stick'),
    knob: document.getElementById('stick-knob'),
    buttons: [...document.querySelectorAll('#touch-controls [data-act]')]
});

window.addEventListener('resize', resize);
resize();
buildRoster();
setMode('title');
requestAnimationFrame(loop);
