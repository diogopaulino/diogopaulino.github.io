// src/main.js — boot, canvas setup, fixed-step loop, scene stack, observers. ~240 linhas.
// FASE 0 STUB: wires up the engine, next phase implements actual game logic.

import { W, H, PixelSurface } from './core/pixel.js';
import { InputManager } from './core/input.js';
import { createFont } from './core/font.js';
import { Store } from './core/store.js';
import { makeRng } from './core/util.js';
import { buildAtlas } from './art/atlas.js';

// ===== Check for file:// protocol =====
if (location.protocol === 'file:') {
    alert('Santos Vice City requires HTTP/HTTPS.\nRun: python3 -m http.server 8000\nThen visit: http://localhost:8000/labs/santos-vice-city/');
    throw new Error('file:// not supported');
}

// ===== Globals =====
let px = null, input = null, font = null, sprites = null, store = null;
const sceneStack = [];
let isRunning = false;
let acc = 0, lastTime = 0;
const STEP = 1 / 60;
const MAX_STEPS = 5;

// ===== Scene control =====
function pushScene(scene) {
    sceneStack.push(scene);
    if (scene.enter) scene.enter({ px, input, sprites, font, store });
}

function popScene() {
    if (sceneStack.length > 0) {
        const scene = sceneStack.pop();
        if (scene.exit) scene.exit();
    }
}

function gotoScene(newScene, params = {}) {
    // Fade out current scene
    if (sceneStack.length > 0) popScene();
    pushScene(newScene);
}

// ===== Scene: colorbar test =====
const colorbarScene = {
    id: 'colorbar',
    enter() {},
    exit() {},
    update(dt) {},
    draw(px, app) {
        const colors = [
            '#0d0a1a', '#1b1233', '#2e1b4d', '#5a2a63', '#93316b',
            '#d94f6a', '#f97a4d', '#ffb35c', '#ffe28a', '#0b3d5c',
            '#12607f', '#1a8ba3', '#3fb8c4', '#8fe3dc', '#7a5638'
        ];
        const h = Math.ceil(H / colors.length);
        for (let i = 0; i < colors.length; i++) {
            px.rect(0, i * h, W, h, colors[i]);
        }
        px.ctx.fillStyle = '#fff';
        px.ctx.font = '12px monospace';
        px.ctx.fillText('Phase 0 colorbar test', 10, 20);
    }
};

// ===== Update loop =====
function update(dtMs) {
    if (sceneStack.length === 0) return;
    const scene = sceneStack[sceneStack.length - 1];
    input.update(dtMs);
    px.tickShake(dtMs);
    if (scene.update) scene.update(STEP, {});
}

// ===== Draw loop =====
function draw() {
    if (sceneStack.length === 0) return;
    const scene = sceneStack[sceneStack.length - 1];
    px.clearStage('#0d0a1a');
    if (scene.draw) scene.draw(px, {});
    px.present();
}

// ===== Main animation loop =====
function loop(now) {
    const dtMs = Math.min(50, (now - lastTime) / 1000 * 1000);
    lastTime = now;

    if (isRunning) {
        acc += dtMs / 1000;
        let steps = 0;
        while (acc >= STEP && steps < MAX_STEPS) {
            update(dtMs);
            acc -= STEP;
            steps++;
        }
    }

    draw();
    requestAnimationFrame(loop);
}

// ===== Boot sequence =====
document.addEventListener('DOMContentLoaded', () => {
    // DOM refs
    const wrap = document.getElementById('svcWrap');
    const stageCanvas = document.getElementById('svcStage');
    const screenCanvas = document.getElementById('svcScreen');
    const touchOverlay = document.getElementById('svcTouch');
    const soundBtn = document.getElementById('svcSoundToggle');
    const resetBtn = document.getElementById('svcResetBtn');
    const announcer = document.getElementById('svcAnnouncer');

    if (!wrap || !stageCanvas || !screenCanvas || !touchOverlay) {
        console.error('Santos Vice City: DOM nodes missing');
        return;
    }

    // Engine
    try {
        px = new PixelSurface(wrap, stageCanvas, screenCanvas);
        input = new InputManager();
        font = createFont();
        sprites = buildAtlas();
        store = new Store();
        console.log('✓ Engine initialized');
    } catch (e) {
        console.error('Boot error:', e);
        stageCanvas.width = W;
        stageCanvas.height = H;
        const g = stageCanvas.getContext('2d');
        g.fillStyle = '#f00';
        g.fillText('Error: ' + e.message, 10, 20);
        return;
    }

    // Wire UI
    input.attachTouch(touchOverlay, 'FULL');
    soundBtn.addEventListener('click', () => {
        const muted = store.getOpts().mute;
        store.setOpt('mute', !muted);
        soundBtn.setAttribute('aria-pressed', String(!muted));
        soundBtn.textContent = !muted ? '◉ Som ativado' : '◌ Som desativado';
    });
    if (store.getOpts().mute) {
        soundBtn.setAttribute('aria-pressed', 'false');
        soundBtn.textContent = '◌ Som desativado';
    }

    resetBtn.addEventListener('click', () => {
        if (confirm('Apagar todos os recordes?')) {
            if (confirm('Tem certeza?')) {
                store.reset();
                resetBtn.textContent = '✓ Recordes apagados';
                setTimeout(() => { resetBtn.textContent = 'Apagar recordes'; }, 2000);
            }
        }
    });

    // Start
    isRunning = true;
    pushScene(colorbarScene);
    requestAnimationFrame(loop);
    lastTime = performance.now();
});

// ===== Auto-hide touch on mouse/touch event =====
const hideTouch = () => {
    const to = document.getElementById('svcTouch');
    if (to) to.classList.add('tp--hidden');
};
window.addEventListener('mousemove', hideTouch, { once: true });
window.addEventListener('pointerdown', hideTouch, { once: true });

// Expose for debugging
window.__svc = { px, input, font, sprites, store, sceneStack, gotoScene, pushScene, popScene };
