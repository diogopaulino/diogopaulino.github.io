// main.js — boot do gabinete: canvas, loop de passo fixo, pilha de cenas e as pontes com a
// página (tema, toque, som, acessibilidade).
//
// O loop separa update de render: a simulação roda sempre em passos de 1/60s, independente da
// taxa de atualização do monitor, então a física do bowl e a cadência da canoa se comportam
// igual em 60, 120 ou 144 Hz. Frames atrasados são recuperados até um teto, para que uma aba
// que voltou do background não "teleporte" o jogo.

import { W, H, PixelSurface } from './core/pixel.js';
import { InputManager } from './core/input.js';
import { createFont } from './core/font.js';
import { Store } from './core/store.js';
import { makeRng, on } from './core/util.js';
import { createAudio } from './core/audio.js';
import { buildAtlas } from './art/atlas.js';
import { buildScenery } from './art/scenery.js';
import { SVC } from './core/palette.js';
import { titleScene, menuScene, briefingScene, pauseScene } from './game/scenes.js';
import { EVENT_ORDER, SPONSORS } from './game/config.js';
import { Championship } from './game/championship.js';

if (location.protocol === 'file:') {
    document.body.innerHTML =
        '<p style="font:16px system-ui;padding:2rem">Este laboratório usa ES Modules e precisa ser servido por HTTP.<br>' +
        'Rode <code>python3 -m http.server 8000</code> na raiz do repositório e abra ' +
        '<code>http://localhost:8000/labs/santos-games/</code>.</p>';
    throw new Error('file:// não suportado');
}

const STEP_MS = 1000 / 60;
const MAX_CATCHUP = 5;

const state = {
    px: null, input: null, font: null, sprites: null, scenery: null,
    store: null, audio: null, rng: null,
    sponsor: null, champ: null,
    sceneStack: [],
    running: false,
    acc: 0,
    last: 0,
    rafId: 0,
    scanlines: false
};

const SCENE_ANNOUNCE = {
    title: 'Tela de título. Toque na tela ou aperte Enter para começar.',
    menu: 'Menu principal.',
    sponsor: 'Escolha de patrocinador.',
    eventSelect: 'Escolha de prova.',
    briefing: 'Briefing da prova.',
    play: 'Prova em andamento.',
    result: 'Resultado da prova.',
    podium: 'Cerimônia de pódio.',
    records: 'Tela de recordes.',
    options: 'Opções.',
    pause: 'Jogo pausado.'
};

function announce(id) {
    const el = document.getElementById('svcAnnouncer');
    if (el && SCENE_ANNOUNCE[id]) el.textContent = SCENE_ANNOUNCE[id];
}

// ---------------------------------------------------------------------------
// Pilha de cenas
// ---------------------------------------------------------------------------

function currentScene() {
    return state.sceneStack[state.sceneStack.length - 1] || null;
}

function appCtx() {
    return {
        px: state.px,
        input: state.input,
        font: state.font,
        sprites: state.sprites,
        scenery: state.scenery,
        store: state.store,
        audio: state.audio,
        rng: state.rng,
        get sponsor() { return state.sponsor; },
        get champ() { return state.champ; },
        set champ(v) { state.champ = v; },
        setSponsor,
        applyOptions,
        setTouchLayout,
        restartEvent,
        goto: gotoScene,
        pushScene,
        popScene
    };
}

// Toda troca de cena descarta o buffer de entrada: o toque que confirmou a transição não
// pode ser lido de novo pela cena que acabou de entrar.
function gotoScene(scene, params = {}) {
    while (state.sceneStack.length) {
        const s = state.sceneStack.pop();
        if (s.exit) s.exit();
    }
    state.sceneStack.push(scene);
    state.input.flushBuffer();
    announce(scene.id);
    if (scene.enter) scene.enter(appCtx(), params);
}

function pushScene(scene, params = {}) {
    state.sceneStack.push(scene);
    state.input.flushBuffer();
    announce(scene.id);
    if (scene.enter) scene.enter(appCtx(), params);
}

function popScene() {
    const scene = state.sceneStack.pop();
    if (scene && scene.exit) scene.exit();
    state.input.flushBuffer();
    const back = currentScene();
    if (back) announce(back.id);
}

/** Recomeça a prova atual do zero — usado pelo menu de pausa. */
function restartEvent() {
    const play = state.sceneStack.find((s) => s.id === 'play');
    if (!play) { gotoScene(menuScene); return; }
    const eventId = play.eventId;
    const champ = play.champ;
    gotoScene(briefingScene, { eventId, champ });
}

// ---------------------------------------------------------------------------
// Patrocinador, opções, toque
// ---------------------------------------------------------------------------

/** Trocar de patrocinador reconstrói o atlas: o uniforme do atleta muda de cor. */
function setSponsor(sponsor) {
    state.sponsor = sponsor;
    state.sprites = buildAtlas({ ...sponsor.kit, skin: 'u', hair: '0' });
}

function applyOptions() {
    const opts = state.store.getOpts();
    state.audio.setMute(!!opts.mute);
    state.scanlines = !!opts.scanlines;
    state.px.shakeEnabled = opts.shake !== false;
    updateSoundButton();
}

function setTouchLayout(layout) {
    const overlay = document.getElementById('svcTouch');
    if (!overlay) return;
    const touchy = matchMedia('(pointer: coarse), (hover: none)').matches;
    overlay.classList.toggle('tp--kids', layout === 'PLAY' || layout === 'FULL');
    overlay.classList.toggle('tp--coarse', touchy);
    state.input.attachTouch(overlay, layout ? 'FULL' : null);
}

function updateSoundButton() {
    const btn = document.getElementById('svcSoundToggle');
    if (!btn) return;
    const muted = !!state.store.getOpts().mute;
    btn.setAttribute('aria-pressed', String(!muted));
    const label = btn.querySelector('[data-label]');
    if (label) label.textContent = muted ? 'Som desligado' : 'Som ligado';
    const icon = btn.querySelector('[data-icon]');
    if (icon) icon.textContent = muted ? '🔇' : '🔊';
}

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------

function update(dtMs) {
    const scene = currentScene();
    if (!scene) return;
    state.input.update(dtMs);
    state.px.tickShake(dtMs);
    if (scene.update) scene.update(dtMs);
}

function render() {
    const scene = currentScene();
    if (!scene) return;
    state.px.clearStage(SVC['0']);

    // uma cena empilhada (pausa) desenha por cima da de baixo
    if (state.sceneStack.length > 1) {
        const below = state.sceneStack[state.sceneStack.length - 2];
        if (below.draw) below.draw();
    }
    if (scene.draw) scene.draw();

    if (state.scanlines) drawScanlines();
    state.px.present();
}

/** Scanlines: uma linha escura a cada duas, no canvas de baixa resolução. */
function drawScanlines() {
    const ctx = state.px.ctx;
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#000';
    for (let y = 0; y < H; y += 2) ctx.fillRect(0, y, W, 1);
    ctx.globalAlpha = 1;
}

function frame(now) {
    if (!state.running) return;
    state.rafId = requestAnimationFrame(frame);

    if (!state.last) state.last = now;
    let delta = now - state.last;
    state.last = now;
    // um salto grande (aba em background, GC longo) não deve virar cinco frames de simulação
    if (delta > 250) delta = STEP_MS;
    state.acc += delta;

    let steps = 0;
    while (state.acc >= STEP_MS && steps < MAX_CATCHUP) {
        update(STEP_MS);
        state.acc -= STEP_MS;
        steps++;
    }
    if (steps === MAX_CATCHUP) state.acc = 0;

    render();
}

function startLoop() {
    if (state.running) return;
    state.running = true;
    state.last = 0;
    state.rafId = requestAnimationFrame(frame);
}

function stopLoop() {
    state.running = false;
    if (state.rafId) cancelAnimationFrame(state.rafId);
    state.rafId = 0;
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

function boot() {
    const wrap = document.getElementById('svcWrap');
    const stage = document.getElementById('svcStage');
    const screen = document.getElementById('svcScreen');
    if (!wrap || !stage || !screen) {
        console.error('Santos Games: canvas não encontrado no HTML.');
        return;
    }

    state.px = new PixelSurface(wrap, stage, screen);
    state.input = new InputManager();
    state.input.attachPointer(screen);
    state.font = createFont();
    state.store = new Store();
    state.audio = createAudio();
    state.rng = makeRng(Date.now() & 0xffffffff);
    state.scenery = buildScenery();
    state.sprites = buildAtlas({ shirt: 'c', trim: 'y', skin: 'u', hair: '0' });
    setSponsor(SPONSORS[0]);

    applyOptions();

    // O AudioContext só pode nascer num gesto real do usuário. Qualquer primeira interação
    // serve — tecla, clique ou toque — e depois o listener se remove sozinho.
    const unlock = () => {
        state.audio.unlock();
        state.audio.setMute(!!state.store.getOpts().mute);
        const scene = currentScene();
        if (scene && scene.id === 'title') state.audio.playSong('tema');
    };
    ['pointerdown', 'keydown', 'touchstart'].forEach((ev) => {
        window.addEventListener(ev, unlock, { once: true, passive: true });
    });

    // Esc/P: mesma pausa que o Start, mas acessível de qualquer teclado.
    state.input.onPause(() => {
        const scene = currentScene();
        if (!scene) return;
        if (scene.id === 'play') pushScene(pauseScene, { eventId: scene.eventId });
        else if (scene.id === 'pause') popScene();
    });

    state.input.onMute(() => {
        const opts = state.store.getOpts();
        state.store.setOpt('mute', !opts.mute);
        applyOptions();
    });

    // Pausar o loop quando a aba sai de vista economiza bateria e evita que o acumulador
    // de tempo exploda ao voltar.
    on(document, 'visibilitychange', () => {
        if (document.hidden) stopLoop();
        else startLoop();
    });

    // Botões da página
    const soundBtn = document.getElementById('svcSoundToggle');
    on(soundBtn, 'click', () => {
        const opts = state.store.getOpts();
        state.store.setOpt('mute', !opts.mute);
        applyOptions();
    });

    const resetBtn = document.getElementById('svcResetBtn');
    on(resetBtn, 'click', () => {
        if (!window.confirm('Apagar as estrelas e medalhas?')) return;
        state.store.reset();
        applyOptions();
    });

    // UX Fix: tornar a lista lateral de eventos interativa. Se o usuário clicar
    // num item ali, ele pula direto para o briefing daquela prova no modo "Única".
    const eventItems = document.querySelectorAll('.sg-events li');
    eventItems.forEach((li, i) => {
        li.style.cursor = 'pointer';
        li.title = 'Jogar esta prova';
        on(li, 'click', () => {
            const eventId = EVENT_ORDER[i];
            if (!eventId) return;
            // Se ainda não tiver patrocinador escolhido, pega o primeiro como padrão
            const sponsor = state.sponsor || SPONSORS[0];
            const champ = new Championship('single', sponsor, state.rng, [eventId]);
            state.champ = champ;
            state.audio.unlock(); // Tentar destravar áudio caso seja o primeiro clique
            gotoScene(briefingScene, { eventId, champ });
        });
    });

    gotoScene(titleScene);
    setTouchLayout(null);
    startLoop();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
    boot();
}
