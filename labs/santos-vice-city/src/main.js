// src/main.js — boot, canvas setup, fixed-step loop, scene stack, input/theme observers.

import { W, H, PixelSurface } from './core/pixel.js';
import { InputManager } from './core/input.js';
import { createFont } from './core/font.js';
import { Store } from './core/store.js';
import { makeRng } from './core/util.js';
import { buildAtlas } from './art/atlas.js';
import { createAudio } from './core/audio.js';
import { GameShell } from './game/shell.js';
import { HUD } from './game/hud.js';
import { titleScene, hubScene, briefingScene, playScene, resultScene, podiumScene, pauseScene, optionsScene } from './game/scenes.js';

// Check for file:// protocol
if (location.protocol === 'file:') {
    alert('Santos Vice City requires HTTP/HTTPS.\nRun: python3 -m http.server 8000\nThen visit: http://localhost:8000/labs/santos-vice-city/');
    throw new Error('file:// not supported');
}

// Globals
let px = null, input = null, font = null, sprites = null, store = null, shell = null, hud = null, rng = null, audio = null;
const sceneStack = [];
let isRunning = false;
let acc = 0, lastTime = 0;
const STEP = 1 / 60;
const MAX_STEPS = 5;

function getCurrentScene() {
    return sceneStack.length > 0 ? sceneStack[sceneStack.length - 1] : null;
}

function appCtx() {
    return {
        px, input, sprites, font, store, shell, hud, rng, audio,
        goto: gotoScene,
        pushScene: pushScene,
        popScene: popScene
    };
}

const SCENE_ANNOUNCE = {
    title: 'Tela de título.',
    hub: 'Mapa de Santos. Escolha um evento.',
    briefing: 'Briefing do evento.',
    play: 'Jogo em andamento.',
    result: 'Resultado do evento.',
    podium: 'Pódio do campeonato.'
};

function announce(sceneId) {
    const el = document.getElementById('svcAnnouncer');
    if (el && SCENE_ANNOUNCE[sceneId]) el.textContent = SCENE_ANNOUNCE[sceneId];
}

function gotoScene(newScene, params = {}) {
    while (sceneStack.length > 0) {
        const s = sceneStack.pop();
        if (s.exit) s.exit();
    }
    sceneStack.push(newScene);
    announce(newScene.id);
    if (newScene.enter) newScene.enter(appCtx(), params);
}

function pushScene(scene, params = {}) {
    sceneStack.push(scene);
    if (scene.enter) scene.enter(appCtx(), params);
}

function popScene() {
    if (sceneStack.length > 0) {
        const scene = sceneStack.pop();
        if (scene.exit) scene.exit();
    }
}

function update(dtMs) {
    const scene = getCurrentScene();
    if (!scene) return;
    input.update(dtMs);
    px.tickShake(dtMs);
    if (scene.update) scene.update(STEP, input, appCtx());
}

function draw() {
    if (sceneStack.length === 0) return;
    px.clearStage('#0d0a1a');
    // Desenha a pilha inteira de baixo pra cima — permite overlays (pause/opções)
    // compor sobre o último frame da cena de baixo sem precisar redesenhá-la.
    for (const scene of sceneStack) {
        if (scene.draw) scene.draw(px, appCtx());
    }
    px.present();
}

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

// Boot
document.addEventListener('DOMContentLoaded', () => {
    const wrap = document.getElementById('svcWrap');
    const stageCanvas = document.getElementById('svcStage');
    const screenCanvas = document.getElementById('svcScreen');
    const touchOverlay = document.getElementById('svcTouch');
    const soundBtn = document.getElementById('svcSoundToggle');
    const resetBtn = document.getElementById('svcResetBtn');

    if (!wrap || !stageCanvas || !screenCanvas) {
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
        rng = makeRng(Date.now());
        shell = new GameShell(store, rng);
        hud = new HUD(font, sprites);
        audio = createAudio();
        console.log('✓ Engine initialized');
    } catch (e) {
        console.error('Boot error:', e);
        const g = stageCanvas.getContext('2d');
        g.fillStyle = '#f00';
        g.fillText('Error: ' + e.message, 10, 20);
        return;
    }

    // Wire input
    input.attachTouch(touchOverlay, 'FULL');
    input.onPause(() => {
        const top = getCurrentScene();
        if (!top) return;
        if (top.id === 'pause') {
            popScene();
        } else if (top.id !== 'title' && top.id !== 'pause') {
            pushScene(pauseScene);
        }
    });
    const toggleMute = () => {
        const muted = !store.getOpts().mute;
        store.setOpt('mute', muted);
        audio.setMute(muted);
        soundBtn.setAttribute('aria-pressed', String(!muted));
        soundBtn.textContent = muted ? '◌ Som desativado' : '◉ Som ativado';
    };
    input.onMute(toggleMute);

    // Áudio precisa de gesto real do usuário (política de autoplay) — primeiro
    // input de qualquer tipo destrava o AudioContext, igual a tela PRESS START sugere.
    const unlockAudio = () => {
        audio.unlock();
        audio.setMute(store.getOpts().mute);
        audio.setVolume(store.getOpts().vol);
    };
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });

    if (store.getOpts().mute) {
        soundBtn.setAttribute('aria-pressed', 'false');
        soundBtn.textContent = '◌ Som desativado';
    }

    soundBtn.addEventListener('click', toggleMute);

    resetBtn.addEventListener('click', () => {
        if (confirm('Apagar todos os recordes?')) {
            if (confirm('Tem certeza?')) {
                store.reset();
                resetBtn.textContent = '✓ Recordes apagados';
                setTimeout(() => { resetBtn.textContent = 'Apagar recordes'; }, 2000);
            }
        }
    });

    // Theme observer
    const observer = new MutationObserver((mutations) => {
        mutations.forEach(m => {
            if (m.attributeName === 'data-theme') {
                const theme = document.documentElement.getAttribute('data-theme') || 'light';
                px.setTheme(theme);
            }
        });
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    // Start
    isRunning = true;
    gotoScene(titleScene);
    requestAnimationFrame(loop);
    lastTime = performance.now();

    window.__svc = { px, input, font, sprites, store, shell, hud, audio, sceneStack, gotoScene, pushScene, popScene };
});
