/* Claude Bros — plataforma 2.5D em WebGL (three.js).
 *
 * A lógica (game.js) continua a do jogo original em tiles de 32px, simulada em
 * passo fixo de 1/120s com acumulador; este arquivo liga a lógica ao palco 3D:
 * carrega os assets, monta o mundo, traduz eventos do jogo em som, partículas e
 * câmera, e cuida de HUD, menus, teclado e toque.
 */
import * as THREE from 'three';
import { updateWind } from '../../shared/gfx/flora.js';
import { FIXED_STEP, RUN_SPEED, STORAGE_QUALITY, WATER_LEVEL, WORLD_WIDTH, toX, toY, U } from './config.js';
import { createGame } from './game.js';
import { createStage } from './stage.js';
import { buildTerrain, decorate, grassWind } from './terrain.js';
import { buildBackdrop } from './backdrop.js';
import { createMascot } from './mascot.js';
import { createCritters } from './critters.js';
import { createItems } from './items.js';
import { createFx } from './fx.js';

const canvas = document.getElementById('stage');
const hud = {
    score: document.getElementById('scoreValue'),
    coins: document.getElementById('coinValue'),
    lives: document.getElementById('lifeValue'),
    time: document.getElementById('timeValue')
};
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlayText = document.getElementById('overlayText');
const overlayButton = document.getElementById('overlayButton');
const overlayEmoji = document.getElementById('overlayEmoji');
const overlayHowto = document.getElementById('overlayHowto');
const progressFill = document.getElementById('progressFill');
const loadBar = document.getElementById('loadBar');
const loadFill = document.getElementById('loadFill');
const qualitySelect = document.getElementById('qualitySelect');
const statusLive = document.getElementById('gameStatus');
const touchLayer = document.getElementById('touchControls');
const audio = window.LabAudio;
const params = new URLSearchParams(location.search);
const INTRO_TEXT = 'Leve o Claude até a bandeira 🚩 no fim da fase!';

let stage = null;
let mascot = null;
let critters = null;
let items = null;
let fx = null;
let backdrop = null;
let ready = false;

/* ------------------------------------------------------------------- som --- */

function sfx(name) {
    if (!audio) return;
    switch (name) {
        case 'jump':
            audio.tone({ freq: 320, duration: 0.14, gain: 0.13, slideTo: 620, type: 'square' });
            break;
        case 'land':
            audio.noise({ duration: 0.06, gain: 0.05, filter: 500 });
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
        case 'bonk':
            audio.tone({ freq: 140, duration: 0.07, gain: 0.1, type: 'triangle' });
            break;
        case 'splash':
            audio.noise({ duration: 0.35, gain: 0.12, filter: 900 });
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

/* ---------------------------------------------------------------- eventos --- */

const px = () => toX(game.player.x + game.player.w / 2);
const feet = () => toY(game.player.y + game.player.h);

const game = createGame((name, data) => {
    switch (name) {
        case 'hud':
            updateHud();
            break;
        case 'reset':
            if (!ready) break;
            items.sync();
            critters.sync(game.enemies);
            fx.clear();
            mascot.snap();
            break;
        case 'jump':
            sfx('jump');
            mascot.impulse(3.2);
            fx.dust(px(), feet(), 3, 0, 0.7);
            break;
        case 'land': {
            // pouso: achata proporcional à velocidade de queda e levanta poeira
            const hard = Math.min(1, data.speed / 700);
            mascot.impulse(-2.2 - hard * 4.5);
            fx.dust(px(), feet(), 3 + Math.round(hard * 6), 0, 0.6 + hard);
            if (data.speed > 260) sfx('land');
            break;
        }
        case 'coin':
            sfx(data.gem ? 'bonus' : 'coin');
            if (data.gem) fx.sparkle(toX(data.x), toY(data.y), 14, 3.2, 1.5, 0.35, 3.4);
            else fx.sparkle(toX(data.x), toY(data.y), 8);
            break;
        case 'bonus':
            sfx('bonus');
            stage.view.shake = Math.max(stage.view.shake, 0.12);
            fx.sparkle(toX(data.x) + 0.5, toY(data.y) + 0.1, 10, 3.0, 1.6, 0.4, 3);
            fx.dust(toX(data.x) + 0.5, toY(data.y) - 1, 4, 0, 0.5);
            break;
        case 'bonk':
            sfx('bonk');
            break;
        case 'stomp': {
            sfx('stomp');
            stage.view.shake = 0.22;
            mascot.impulse(2.5);
            const ex = toX(data.x + data.w / 2);
            const ey = toY(data.y + data.h);
            fx.chips(ex, ey + 0.4, 9, 0.5, 0.56, 0.36, 3.4);
            fx.dust(ex, ey, 7, 0, 1.2);
            break;
        }
        case 'hurt':
            stage.view.shake = 0.5;
            sfx(data.last ? 'over' : 'hurt');
            if (!data.fell) fx.chips(px(), feet() + 0.4, 12, 0.85, 0.44, 0.31, 3.6);
            announce(data.last ? `Acabaram as vidas. ${game.score} pontos.` : `Ops! Restam ${game.lives} vidas.`);
            break;
        case 'splash':
            sfx('splash');
            fx.splash(toX(data.x), WATER_LEVEL);
            break;
        case 'respawn':
            mascot.snap();
            snapCamera = true;
            break;
        case 'over':
            showOverlay('Quase lá!', `Acabaram as vidas. Você fez ${game.score} pontos e pegou ${game.coinsTaken} faíscas.`, 'Jogar de novo', '💪');
            break;
        case 'win':
            sfx('win');
            items.celebrate();
            fx.sparkle(toX(game.goal.x), toY(game.goal.y) + 2.4, 22, 3.2, 2.2, 0.6, 5);
            fx.sparkle(px(), feet() + 0.8, 12);
            announce(`Você venceu com ${game.score} pontos.`);
            break;
        case 'wonOverlay':
            showOverlay('Você chegou à bandeira!', `${game.score} pontos · ${game.coinsTaken} faíscas · bônus de tempo ${game.bonus}`, 'Jogar de novo', '🏆');
            break;
    }
});

/* -------------------------------------------------------------------- ui --- */

function updateHud() {
    hud.score.textContent = String(game.score);
    hud.coins.textContent = String(game.coinsTaken);
    hud.lives.textContent = '❤️'.repeat(Math.max(0, game.lives)) || '—';
    hud.lives.parentElement.setAttribute('aria-label', `${game.lives} vidas`);
}

/* Barra de progresso até a bandeira: só escreve no DOM quando muda 1%. */
let shownProgress = -1;
function updateProgress() {
    if (!progressFill || !game.goal) return;
    const k = Math.round(Math.max(0, Math.min(1, (game.player.x + game.player.w) / game.goal.tileX)) * 100);
    if (k === shownProgress) return;
    shownProgress = k;
    progressFill.style.transform = `scaleX(${k / 100})`;
}

let shownSecond = -1;
function updateTime() {
    const total = Math.floor(game.elapsed);
    if (total === shownSecond) return;
    shownSecond = total;
    hud.time.textContent = `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function announce(message) {
    if (statusLive) statusLive.textContent = message;
}

function showOverlay(title, text, button, emoji = '✦', howto = false) {
    overlayTitle.textContent = title;
    overlayText.textContent = text;
    overlayButton.textContent = button;
    if (overlayEmoji) overlayEmoji.textContent = emoji;
    if (overlayHowto) overlayHowto.hidden = !howto;
    overlay.dataset.mode = game.state;
    overlay.hidden = false;
    // foco no botão grande: Enter/Espaço/toque continuam a partida sem caçar o mouse
    requestAnimationFrame(() => overlayButton.focus({ preventScroll: true }));
}

function hideOverlay() {
    overlay.hidden = true;
}

function setLoading(fraction, text) {
    if (loadFill) loadFill.style.transform = `scaleX(${Math.max(0.02, Math.min(1, fraction))})`;
    if (text) overlayText.textContent = text;
}

function startGame() {
    if (!ready) return;
    game.reset();
    hideOverlay();
    game.state = 'playing';
    shownSecond = -1;
    updateTime();
    updateProgress();
    snapCamera = true;
    sfx('start');
    announce('Partida iniciada.');
}

function togglePause() {
    if (game.state === 'playing') {
        game.state = 'paused';
        showOverlay('Pausa', 'A fase espera por você.', 'Continuar', '⏸', true);
        announce('Jogo pausado.');
    } else if (game.state === 'paused') {
        hideOverlay();
        game.state = 'playing';
        announce('Jogo retomado.');
    }
}

overlayButton.addEventListener('click', () => {
    if (game.state === 'paused') togglePause();
    else startGame();
});

/* ----------------------------------------------------------------- input --- */

const KEY_MAP = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right'
};

window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    if (event.target instanceof HTMLSelectElement) return;

    if (KEY_MAP[event.code]) {
        event.preventDefault();
        game.keys[KEY_MAP[event.code]] = true;
        return;
    }
    if (event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'KeyW') {
        event.preventDefault();
        if (game.state === 'playing') game.pressJump();
        // Pausado: o preventDefault acima impede o Espaço de "clicar" o botão Continuar
        // focado, então o próprio atalho retoma (antes o Espaço não fazia nada na pausa).
        else if (game.state === 'paused') togglePause();
        else if (game.state === 'ready' || game.state === 'over') startGame();
        else if (game.state === 'won' && !overlay.hidden) startGame();
        return;
    }
    if (event.code === 'Enter') {
        if (game.state === 'paused') { event.preventDefault(); togglePause(); }
        else if (game.state !== 'playing' && !overlay.hidden) { event.preventDefault(); startGame(); }
        return;
    }
    if (event.code === 'KeyP' || event.code === 'Escape') {
        event.preventDefault();
        togglePause();
    }
});

window.addEventListener('keyup', (event) => {
    if (KEY_MAP[event.code]) game.keys[KEY_MAP[event.code]] = false;
    if (event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'KeyW') game.releaseJump();
});

// Perdeu o foco com tecla presa: solta tudo para o personagem não correr sozinho.
window.addEventListener('blur', () => {
    game.keys.left = false;
    game.keys.right = false;
    game.releaseJump();
});

/* Botões de toque em pointer events: um só caminho cobre dedo, caneta e mouse.
   `setPointerCapture` mantém o botão pressionado mesmo se o dedo escorregar. */
function bindHold(id, onPress, onRelease) {
    const el = document.getElementById(id);
    if (!el) return;
    const release = (event) => {
        if (event) el.releasePointerCapture?.(event.pointerId);
        el.classList.remove('is-active');
        onRelease?.();
    };
    el.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        el.setPointerCapture?.(event.pointerId);
        el.classList.add('is-active');
        onPress();
    });
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('contextmenu', (event) => event.preventDefault());
}

bindHold('btnLeft', () => { game.keys.left = true; }, () => { game.keys.left = false; });
bindHold('btnRight', () => { game.keys.right = true; }, () => { game.keys.right = false; });
bindHold('btnJump', () => {
    if (game.state === 'playing') game.pressJump();
    else if (game.state === 'ready' || game.state === 'over' || (game.state === 'won' && !overlay.hidden)) startGame();
}, () => game.releaseJump());

document.getElementById('btnPause')?.addEventListener('click', togglePause);

/* ------------------------------------------------------------------ loop --- */

const timer = new THREE.Timer();
let accumulator = 0;
let rafId = 0;
let time = 0;
let snapCamera = true;
let stepDust = 0;
let leafClock = 0;
let moteClock = 0;
const mascotState = { x: 0, y: 0, vx: 0, vy: 0, grounded: true, facing: 1, skid: false, mode: 'menu', visible: true };

function frame(now) {
    rafId = document.hidden ? 0 : requestAnimationFrame(frame);
    timer.update(now);
    // Trava a 250ms: uma aba que voltou do background não replica meio segundo
    // de física de uma vez.
    const delta = Math.min(timer.getDelta(), 0.25);
    accumulator += delta;
    let guard = 0;
    while (accumulator >= FIXED_STEP && guard++ < 240) {
        game.step(FIXED_STEP);
        accumulator -= FIXED_STEP;
    }
    if (game.state === 'playing') {
        updateTime();
        updateProgress();
    }
    draw(delta);
}

function draw(dt) {
    const frozen = game.state === 'paused';
    const vdt = frozen ? 0 : dt;
    time += vdt;
    const p = game.player;
    const x = px();
    const y = feet();

    const st = mascotState;
    st.x = x;
    st.y = y;
    st.vx = game.state === 'playing' ? p.vx : 0;
    st.vy = game.state === 'ready' ? 0 : p.vy;
    st.grounded = game.state === 'ready' ? true : p.grounded;
    st.facing = p.facing;
    st.skid = p.skid;
    st.mode = game.state === 'dead' || game.state === 'over' ? 'hurt' : game.state === 'won' ? 'win' : game.state === 'ready' ? 'menu' : 'play';
    // pisca enquanto está invulnerável; some depois de afundar
    st.visible = !(p.invuln > 0 && Math.floor(p.invuln * 14) % 2 === 0) && y > WATER_LEVEL - 1.2 && !(game.state === 'over' && y < WATER_LEVEL);
    mascot.update(vdt, st);

    if (game.state === 'playing' && p.grounded) {
        const speed = Math.abs(p.vx);
        stepDust -= vdt * (p.skid ? 5 : speed / RUN_SPEED);
        if (stepDust <= 0 && (p.skid || speed > RUN_SPEED * 0.7)) {
            stepDust = p.skid ? 0.2 : 0.26;
            fx.dust(x - p.facing * 0.2, y, p.skid ? 2 : 1, p.skid ? Math.sign(p.vx) : -p.facing, p.skid ? 1.1 : 0.55);
        }
    }

    critters.update(vdt, game.enemies, time);
    items.update(vdt, time);

    // ambiente: folhas e pólen passando pelo enquadramento
    const view = stage.view;
    leafClock -= vdt;
    if (leafClock <= 0) {
        leafClock = 0.4;
        fx.leaf(view.cx + view.w * (0.1 + Math.random() * 0.6), view.cy + view.h * (0.1 + Math.random() * 0.5), -2.5 + Math.random() * 4);
    }
    moteClock -= vdt;
    if (moteClock <= 0) {
        moteClock = 0.3;
        fx.mote(view.cx + (Math.random() - 0.4) * view.w, view.cy + (Math.random() - 0.5) * view.h * 0.8, -3 + Math.random() * 4.5);
    }
    fx.update(vdt);
    backdrop.update(time);
    grassWind.value = time;
    updateWind(time, 0.8);

    const camY = game.state === 'dead' || game.state === 'over' ? Math.max(y, 0) : y;
    stage.follow(vdt, x, camY, p.facing, st.vx * U, snapCamera);
    snapCamera = false;
    stage.render(time, vdt);
}

// Sair da aba pausa em vez de deixar o jogador morrer sozinho; cancela o rAF.
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        if (game.state === 'playing') togglePause();
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = 0;
        }
    } else if (!rafId && ready) {
        timer.update(performance.now());
        rafId = requestAnimationFrame(frame);
    }
});

/* ------------------------------------------------------------------ boot --- */

if (audio) audio.configure({ storageKey: 'claude-bros:muted', volume: 0.4 });

function mountAudioToggle() {
    const host = document.querySelector('[data-lab-header] .header-actions');
    if (host && audio) audio.mountToggle(host);
    else if (audio) setTimeout(mountAudioToggle, 60);
}
mountAudioToggle();

// Mostra os controles de toque só em ponteiro grosso (celular/tablet).
// Default CSS já esconde; isto sincroniza o atributo `hidden` e reage a mudanças.
function syncTouchPads() {
    if (!touchLayer) return;
    touchLayer.hidden = !window.matchMedia('(pointer: coarse)').matches;
}
syncTouchPads();
window.matchMedia('(pointer: coarse)').addEventListener?.('change', syncTouchPads);

function storedQuality() {
    const fromUrl = params.get('q');
    if (['low', 'medium', 'high'].includes(fromUrl)) return fromUrl;
    try {
        const saved = localStorage.getItem(STORAGE_QUALITY);
        if (['low', 'medium', 'high'].includes(saved)) return saved;
    } catch { /* armazenamento indisponível: fica no automático */ }
    return 'auto';
}

if (qualitySelect) {
    qualitySelect.value = storedQuality();
    qualitySelect.addEventListener('change', () => {
        try { localStorage.setItem(STORAGE_QUALITY, qualitySelect.value); } catch { /* sem persistência */ }
        // O tier define resolução de malhas e de sombra na construção do mundo: recarrega.
        location.reload();
    });
}

async function boot() {
    overlayButton.disabled = true;
    overlayButton.textContent = 'Carregando…';
    setLoading(0.03, 'Preparando o mundo…');

    const manager = new THREE.LoadingManager();
    let assetsDone;
    const assets = new Promise((resolve) => { assetsDone = resolve; });
    manager.onProgress = (url, loaded, total) => setLoading(0.1 + 0.8 * (loaded / total), 'Carregando texturas e modelos…');
    manager.onLoad = () => assetsDone();

    try {
        stage = createStage(canvas, { quality: storedQuality(), loadingManager: manager });
    } catch (err) {
        console.error(err);
        overlayText.textContent = 'Não foi possível iniciar o WebGL. Ative a aceleração de hardware do navegador e recarregue a página.';
        overlayButton.hidden = true;
        if (loadBar) loadBar.hidden = true;
        return;
    }
    const { scene, quality } = stage;
    const themeApi = window.LabTheme;
    const themeReady = stage.setTheme(themeApi ? themeApi.current() : 'light');

    const stageEl = canvas.parentElement;
    const resize = () => {
        const rect = stageEl.getBoundingClientRect();
        stage.resize(rect.width, rect.height);
        if (ready && !rafId && !document.hidden) rafId = requestAnimationFrame(frame);
    };
    new ResizeObserver(resize).observe(stageEl);
    window.addEventListener('orientationchange', () => setTimeout(resize, 120));
    resize();

    const terrain = buildTerrain(scene, quality);
    backdrop = buildBackdrop(scene, stage.sky, terrain, quality);
    mascot = createMascot({ cell: quality.sculpt });
    scene.add(mascot.group, mascot.ribbon);
    critters = createCritters(scene, { cell: quality.sculpt * 2 });
    items = createItems(scene, game, quality);
    fx = createFx(scene);

    const decor = decorate(scene, terrain, quality);
    // Se algum asset travar, o jogo abre mesmo assim depois de 20 s (os loaders têm fallback).
    await Promise.race([Promise.all([decor, themeReady, assets]), new Promise((resolve) => setTimeout(resolve, 20000))]);

    const applyLook = () => {
        const dark = stage.theme === 'dark';
        fx.uniforms.uLight.value.setRGB(dark ? 0.7 : 1, dark ? 0.52 : 0.98, dark ? 0.42 : 0.94);
        backdrop.tint(stage.sky.horizonColor);
    };
    applyLook();
    themeApi?.onChange((name) => {
        stage.setTheme(name).then(applyLook);
        applyLook();
    });

    ready = true;
    game.reset();
    snapCamera = true;
    setLoading(0.96, 'Compilando shaders…');
    draw(0);
    await stage.renderer.compileAsync(scene, stage.camera).catch(() => {});

    setLoading(1, INTRO_TEXT);
    if (loadBar) loadBar.hidden = true;
    overlayButton.disabled = false;
    overlayButton.textContent = 'Começar';
    timer.update(performance.now());
    rafId = requestAnimationFrame(frame);

    if (params.has('debug')) {
        /* Depuração (?debug=1): teleporte, vitória/dano forçados e contadores do renderer. */
        window.__lab = {
            game, stage, mascot,
            /** Aproxima a câmera: largura visível em tiles (0 volta ao normal). */
            zoom(w) { stage.view.force = w; window.dispatchEvent(new Event('orientationchange')); },
            /** Trava a câmera num ponto (m); sem argumentos, volta a seguir o personagem. */
            cam(x, y) { stage.view.lock = x === undefined ? null : { x, y }; },
            start: () => startGame(),
            teleport(col, row = 11) {
                game.player.x = col * 32 + 4;
                game.player.y = row * 32 + 4;
                game.player.vx = 0;
                game.player.vy = 0;
                snapCamera = true;
                mascot.snap();
            },
            keys: (left, right) => { game.keys.left = left; game.keys.right = right; },
            jump: (hold = 300) => { game.pressJump(); setTimeout(() => game.releaseJump(), hold); },
            stats() {
                const info = stage.renderer.info;
                return { tier: stage.tier, tris: info.render.triangles, calls: info.render.calls, geometries: info.memory.geometries, textures: info.memory.textures };
            },
            fps: (ms = 2000) => new Promise((resolve) => {
                let n = 0;
                const t0 = performance.now();
                const tick = () => {
                    n++;
                    if (performance.now() - t0 >= ms) resolve(Math.round((n * 1000) / (performance.now() - t0)));
                    else requestAnimationFrame(tick);
                };
                requestAnimationFrame(tick);
            })
        };
    }
}

updateHud();
boot();
