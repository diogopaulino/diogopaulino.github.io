import { detectSoftwareGL } from '../../shared/gfx/capabilities.js';
/**
 * Xadrez — atelier 3D em Babylon.js.
 * Cena PBR, seleção por raycast, animações em arco e o mestre comentando.
 */

import { Chess, START_FEN, PIECE_NAME, PIECE_HOW, alg, parseAlg } from './engine.js?v=6';

import { LESSONS, PUZZLES, commentOnMove, loadProgress, saveProgress } from './coach.js?v=6';
import { createTextures } from './textures.js?v=3';
import { PieceFactory } from './pieces.js?v=3';
import {
    buildWorld, setupLights, setupEnvironment, setupPostProcess, applyShadowQuality,
    squareToWorld, worldToSquare, placeMark, traySlot, BOARD_Y, TRAY_Y
} from './world.js?v=4';
import { SalonAudio } from './audio.js?v=2';

const STORAGE = 'xadrez-settings';
// Partida em andamento (cpu, dois jogadores, livre): sobrevive a recarregar a aba.
const SAVE_KEY = 'xadrez-partida';
/**
 * Relógio opcional (ritmo "minutos + incremento", como no xadrez online):
 *   - o tempo de quem tem a vez escorre em tempo real (performance.now);
 *   - quem joga ganha o incremento depois do lance (Fischer);
 *   - o relógio só começa depois do 1º lance das brancas (como no lichess);
 *   - pausa no menu, com a aba oculta e no fim da partida;
 *   - tempo zerado perde — exceto se o adversário não tem material para dar
 *     mate (só rei, ou rei + uma peça menor): aí é empate (FIDE 6.9).
 */
const CLOCKS = {
    off: null,
    '3+2': { base: 3 * 60e3, inc: 2e3 },
    '5+3': { base: 5 * 60e3, inc: 3e3 },
    '10+5': { base: 10 * 60e3, inc: 5e3 },
    '15+10': { base: 15 * 60e3, inc: 10e3 }
};
// Pausa natural antes do lance da máquina: resposta instantânea parece robô.
const THINK_MIN_MS = 520;
const THINK_JITTER_MS = 520;
const LEVEL_LABEL = { facil: 'fácil', iniciante: 'iniciante', praticante: 'praticante', clube: 'clube' };
// Fim de partida em palavras simples (o resultado aparece para crianças também).
const DRAW_WHY = {
    afogamento: 'Afogamento: quem tinha a vez não tinha nenhum lance, mas o rei não estava em xeque.',
    'repetição': 'A mesma posição apareceu três vezes.',
    '50 lances': 'Foram 50 lances de cada lado sem captura nem lance de peão.',
    'material insuficiente': 'Ninguém tem peças suficientes para dar xeque-mate.',
    tempo: 'O tempo acabou, mas quem sobrou no relógio não tem peças para dar xeque-mate.'
};
const GLYPH = {
    w: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕', k: '♔' },
    b: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' }
};

const QUALITY = {
    // pr = teto de pixels por ponto CSS; reflections = reflexo planar do verniz.
    low: { id: 'low', pr: 1, seg: 24, shadows: true, shadowMap: 1024, antialias: false, reflections: false, msaa: 1 },
    medium: { id: 'medium', pr: 1.5, seg: 40, shadows: true, shadowMap: 2048, antialias: true, reflections: true, msaa: 1 },
    high: { id: 'high', pr: 2, seg: 64, shadows: true, shadowMap: 4096, antialias: true, reflections: true, msaa: 4 }
};

function isMobile() {
    // iPadOS 13+ manda UA de Macintosh; maxTouchPoints distingue do Mac real.
    const appleTouch = /iP(hone|ad|od)/i.test(navigator.userAgent)
        || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    return appleTouch
        || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
        || window.innerWidth < 720
        || (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches);
}



function pickQuality(mode) {
    if (detectSoftwareGL()) return QUALITY.low;
    if (QUALITY[mode]) return QUALITY[mode];
    if (isMobile()) return navigator.hardwareConcurrency >= 6 ? QUALITY.medium : QUALITY.low;
    if ((window.devicePixelRatio || 1) >= 2 && window.innerWidth >= 1400) return QUALITY.high;
    return QUALITY.medium;
}

/** Promessa com prazo: carregamento lento nunca deixa a tela de carga eterna. */
function withTimeout(promise, ms) {
    let timer;
    return Promise.race([
        promise,
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), ms); })
    ]).finally(() => clearTimeout(timer));
}

function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
}

class Atelier {
    /**
     * Render sob demanda: marcar "sujo" pede alguns quadros seguidos (materiais
     * e texturas terminam de compilar de forma assíncrona); depois a cena para.
     */
    get renderDirty() { return this._dirtyFrames > 0; }
    set renderDirty(value) { if (value) { this._dirtyFrames = 6; this._verify = true; } }

    constructor() {
        this.canvas = document.getElementById('scene');
        this.settings = this.loadSettings();
        this.audio = new SalonAudio();
        this.game = new Chess();
        this.mode = 'cpu';
        this.level = 'praticante';
        this.player = 'w';
        this.flip = false;
        this.selected = -1;
        this.hover = -1;
        this.legal = [];
        this.history = [];
        this.busy = false;
        this.anims = [];
        this.pieces = new Map();
        this.progress = loadProgress();
        this.lessonIndex = 0;
        this.puzzleIndex = 0;
        this.expect = null;
        this.pendingPromo = null;
        this.drag = { x: 0, y: 0, active: false };
        this.lastHoverAt = 0;
        this.pointerIds = new Set();
        this.view = 'play';
        this.keyboardSquare = 12;
        this.started = false;
        this.renderDirty = true;
        this.adaptiveFrames = 0;
        this.adaptiveTime = 0;
        this.renderScale = 1;
        this.diagnostics = ['localhost', '127.0.0.1'].includes(location.hostname) && new URLSearchParams(location.search).has('diagnostics');
        // Só em localhost com ?diagnostics: expõe a instância para medições.
        if (this.diagnostics) window.__atelier = this;
        this.generation = 0;
        this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
        this.clock = null;
        this.flagged = null;
        this.thinking = false;

        this.bindUi();
        this.boot().catch(err => this.fail(err));
    }

    loadSettings() {
        try {
            return {
                quality: 'auto', theme: 'classic', level: 'facil', clock: 'off',
                muted: false, ...JSON.parse(localStorage.getItem(STORAGE) || '{}')
            };
        } catch {
            return { quality: 'auto', theme: 'classic', level: 'facil', clock: 'off', muted: false };
        }
    }

    saveSettings() {
        try { localStorage.setItem(STORAGE, JSON.stringify(this.settings)); } catch { /* privado */ }
    }

    setLoad(p, text) {
        const fill = document.getElementById('loadingFill');
        const line = document.getElementById('loadingText');
        if (fill) fill.style.width = `${Math.round(p * 100)}%`;
        if (text && line) line.textContent = text;
    }

    fail(err) {
        console.error(err);
        const overlay = document.getElementById('errorOverlay');
        const load = document.getElementById('loadingOverlay');
        if (load) load.hidden = true;
        if (overlay) overlay.hidden = false;
        const t = document.getElementById('errorText');
        if (t && err) t.textContent = `${String(err.message || err)} Tente de novo ou use um navegador com aceleração de hardware ligada.`;
        document.body.dataset.state = 'error';
        document.getElementById('errorRetry')?.focus();
    }

    bindUi() {
        document.getElementById('startButton')?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.start();
        });
        document.getElementById('learnButton')?.addEventListener('click', () => { document.getElementById('modeSelect').value = 'academy'; this.start(); });
        document.getElementById('settingsBtn')?.addEventListener('click', () => {
            this.tickClock();
            this.cancelWork();
            this.rebuildPieces();
            document.getElementById('modeSelect').value = this.mode;
            document.getElementById('resumeButton').hidden = false;
            document.getElementById('resumeButton').firstChild.textContent = 'Continuar partida ';
            document.getElementById('startLabel').textContent = 'Nova partida';
            document.getElementById('intro').hidden = false;
            document.body.dataset.state = 'intro';
            document.getElementById('resumeButton').focus();
        });
        document.getElementById('resumeButton')?.addEventListener('click', () => this.start(true));
        document.querySelectorAll('[data-camera]').forEach(btn => btn.addEventListener('click', () => this.cameraView(btn.dataset.camera)));
        document.getElementById('modePlay')?.addEventListener('click', () => this.setMode('cpu'));
        document.getElementById('modeAcademy')?.addEventListener('click', () => this.setMode('academy'));
        document.getElementById('modePuzzles')?.addEventListener('click', () => this.setMode('puzzles'));
        document.getElementById('hintBtn')?.addEventListener('click', () => this.hint());
        document.getElementById('undoBtn')?.addEventListener('click', () => this.undo());
        document.getElementById('flipBtn')?.addEventListener('click', () => this.toggleFlip());
        document.getElementById('newBtn')?.addEventListener('click', () => this.fresh());
        document.getElementById('muteBtn')?.addEventListener('click', () => this.toggleMute());
        document.getElementById('prevLesson')?.addEventListener('click', () => this.shiftLesson(-1));
        document.getElementById('nextLesson')?.addEventListener('click', () => this.shiftLesson(1));
        document.getElementById('coachToggle')?.addEventListener('click', () => {
            const panel = document.getElementById('coach');
            panel.classList.toggle('is-collapsed');
            document.getElementById('coachToggle').setAttribute('aria-expanded', String(!panel.classList.contains('is-collapsed')));
        });
        document.getElementById('resultAgain')?.addEventListener('click', () => {
            document.getElementById('resultOverlay').hidden = true;
            this.fresh();
            this.canvas.focus({ preventScroll: true });
        });
        document.getElementById('resultClose')?.addEventListener('click', () => {
            document.getElementById('resultOverlay').hidden = true;
            this.canvas.focus({ preventScroll: true });
        });
        for (const id of ['promoOverlay', 'resultOverlay']) {
            document.getElementById(id).addEventListener('keydown', e => {
                if (e.key !== 'Tab') return;
                const buttons = [...e.currentTarget.querySelectorAll('button:not([disabled])')];
                const first = buttons[0], last = buttons.at(-1);
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            });
        }
        document.querySelectorAll('.promo-btn').forEach((btn) => {
            btn.addEventListener('click', () => this.finishPromo(btn.dataset.promo));
        });
        ['qualitySelect', 'themeSelect', 'levelSelect', 'modeSelect', 'clockSelect'].forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            if (id === 'qualitySelect') el.value = this.settings.quality;
            if (id === 'themeSelect') el.value = this.settings.theme;
            if (id === 'levelSelect') el.value = this.settings.level;
            if (id === 'clockSelect') el.value = CLOCKS[this.settings.clock] !== undefined ? this.settings.clock : 'off';
            el.addEventListener('change', () => {
                if (id === 'qualitySelect') this.settings.quality = el.value;
                if (id === 'themeSelect') this.settings.theme = el.value;
                if (id === 'levelSelect') this.settings.level = el.value;
                if (id === 'clockSelect') this.settings.clock = el.value;
                this.saveSettings();
            });
        });
        document.getElementById('errorRetry')?.addEventListener('click', () => location.reload());
        // Aba oculta/janela sem foco: relógio para e arraste preso é solto.
        const pauseAll = () => { this.tickClock(); this.cancelDrag?.(); this.pointerIds?.clear(); };
        document.addEventListener('visibilitychange', () => { if (document.hidden) pauseAll(); else this.resumeClock(); });
        window.addEventListener('blur', () => { if (this.drag?.active) this.cancelDrag(); this.pointerIds?.clear(); });
        window.addEventListener('pagehide', () => this.saveGame());
        window.addEventListener('keydown', (e) => {
            if (e.target.closest('select, input, textarea, button') || e.altKey) return;
            if (document.body.dataset.state === 'intro' && (e.code === 'Enter' || e.code === 'Space' || e.code === 'Escape')) {
                e.preventDefault();
                // Com partida salva/em andamento, Enter continua (nunca descarta sem querer).
                const canResume = !document.getElementById('resumeButton').hidden;
                this.start(canResume && (e.code !== 'Escape' || this.started));
                return;
            }
            if (document.body.dataset.state !== 'play' || this.pendingPromo || !document.getElementById('resultOverlay').hidden) return;
            if (e.code === 'KeyM') this.toggleMute();
            if (e.code === 'KeyH') this.hint();
            if (e.code === 'KeyU' || ((e.metaKey || e.ctrlKey) && e.code === 'KeyZ')) { e.preventDefault(); this.undo(); }
            if (e.code === 'KeyF') this.toggleFlip();
            if (e.code === 'Digit1') this.cameraView('play');
            if (e.code === 'Digit2') this.cameraView('top');
            if (e.code === 'Digit3') this.cameraView('detail');
        });
    }

    async boot() {
        const BABYLON = window.BABYLON;
        if (!BABYLON) {
            this.fail(new Error('Babylon.js não foi carregado.'));
            return;
        }

        try {
            this.engine = new BABYLON.Engine(this.canvas, this.quality?.antialias ?? false, {
                preserveDrawingBuffer: false,
                stencil: false,
                // The game controls its own render scale below. Keeping the
                // browser's DPR out of this path prevents 3x mobile screens
                // from silently rendering three times more pixels than needed.
                adaptToDeviceRatio: false
            });
            this.scene = new BABYLON.Scene(this.engine);
            this.scene.useRightHandedSystem = true;
            // A seleção é feita abaixo, uma única vez por gesto. O picking
            // automático repetia a interseção de todas as peças detalhadas.
            this.scene.skipPointerMovePicking = true;
            this.scene.skipPointerDownPicking = true;
            this.scene.skipPointerUpPicking = true;
            this.scene.clearColor = new BABYLON.Color4(0.035, 0.05, 0.065, 1.0);
        } catch (err) {
            this.fail(err);
            return;
        }

        this.quality = pickQuality(this.settings.quality);
        const touchCap = isMobile() ? 1.5 : this.quality.pr;
        this.engine.setHardwareScalingLevel(1 / Math.min(devicePixelRatio || 1, this.quality.pr, touchCap));
        this.canvas.addEventListener('webglcontextlost', (e) => e.preventDefault());

        // Câmera orbital elegante. Radius maior + FOV mais fechado do que o
        // padrão do Babylon (0.8) achatam a perspectiva: sem isso, a casa mais
        // próxima da câmera aparecia enorme e a última fileira, minúscula.
        this.camera = new BABYLON.ArcRotateCamera('camera', Math.PI / 2, 0.9, 21.5, new BABYLON.Vector3(0, 0.25, 0), this.scene);
        this.camera.fov = 0.58;
        this.camera.lowerRadiusLimit = isMobile() ? 11.5 : 12;
        this.camera.upperRadiusLimit = 30;
        this.camera.lowerBetaLimit = 0.02;
        this.camera.upperBetaLimit = 1.34;
        this.camera.minZ = 1; this.camera.maxZ = 900;
        this.camera.wheelDeltaPercentage = 0.015;
        this.camera.pinchDeltaPercentage = 0.015;
        this.camera.inertia = 0.85;
        this.camera.panningSensibility = 0;
        this.camera.angularSensibilityX = isMobile() ? 650 : 900;
        this.camera.angularSensibilityY = isMobile() ? 650 : 900;
        this.camera.useNaturalPinchZoom = true;
        this.camera.allowUpsideDown = false;
        this.camera.useAutoRotationBehavior = false;
        if (this.camera.autoRotationBehavior) {
            this.camera.autoRotationBehavior.idleRotationSpeed = 0.15;
            this.camera.autoRotationBehavior.idleRotationWaitTime = 2000;
        }
        this.camera.attachControl(this.canvas, true);
        this.camera.inputs.attached.keyboard?.detachControl();
        this.fitCameraFov();

        this.setLoad(0.2, 'Preparando as peças…');
        const tex = createTextures(this.scene);

        this.setLoad(0.45, 'Montando o atelier…');
        setupEnvironment(BABYLON, this.scene, this.quality, () => { this.renderDirty = true; });
        this.world = buildWorld(BABYLON, this.scene, tex, this.quality);
        this.lights = setupLights(BABYLON, this.scene, this.quality);
        this.postProcess = setupPostProcess(BABYLON, this.scene, this.quality);

        this.factory = new PieceFactory(this.scene, tex, this.quality);
        // Rede lenta não prende a mesa: 12 s e seguem as peças procedurais.
        try { await withTimeout(this.factory.loadSculpted(), 12000); } catch { /* Geometrias locais procedurais continuam disponíveis. */ }
        if (this.settings.theme === 'crystal') this.factory.setTheme('crystal');

        this.setLoad(0.8, 'Posicionando as peças no tabuleiro…');
        this.rebuildPieces();

        this.canvas.addEventListener('pointerdown', (e) => this.onDown(e));
        this.canvas.addEventListener('pointermove', (e) => this.onMove(e));
        this.canvas.addEventListener('pointerup', (e) => this.onUp(e));
        this.canvas.addEventListener('pointercancel', e => { this.pointerIds.delete(e.pointerId); this.cancelDrag(); });
        this.canvas.addEventListener('lostpointercapture', e => { this.pointerIds.delete(e.pointerId); if (this.drag.active) this.cancelDrag(); });
        this.canvas.addEventListener('keydown', e => this.onBoardKey(e));
        this.canvas.addEventListener('pointerleave', () => { this.hover = -1; this.refreshMarks(); });
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        new ResizeObserver(() => { this.engine.resize(); this.fitCameraFov(); }).observe(this.canvas);

        this.applyQuality();
        // HDR ou shader que nunca termina não deixa a barra de carga eterna.
        try { await withTimeout(this.scene.whenReadyAsync(), 15000); } catch { /* segue: a cena termina de compilar em segundo plano */ }
        this.fillLists();
        this.restoreGame();
        this.setLoad(1, 'O atelier está pronto.');
        document.getElementById('loadingOverlay').hidden = true;
        document.getElementById('intro').hidden = false;
        document.body.dataset.state = 'intro';

        this._renderLoop = () => {
            if (document.hidden) return;
            const now = performance.now();
            // Teto de 60 fps mesmo em monitores 120/144 Hz. Cena parada não
            // redesenha: só o pulso do xeque (20 fps). Depois de cada mudança a
            // cena é conferida (10×/s) até shaders e texturas ficarem prontos;
            // nesse instante saem os quadros finais e o laço volta a dormir.
            const moving = this.anims.length || this.drag.active || this.cameraTransition ||
                Math.abs(this.camera.inertialAlphaOffset) + Math.abs(this.camera.inertialBetaOffset) + Math.abs(this.camera.inertialRadiusOffset) > 0.001;
            // Atrás do card de resultado (ou do menu) o pulso do xeque não aparece: não redesenha.
            const pulsing = !this.reducedMotion && this.world?.marks?.check?.isVisible &&
                document.body.dataset.state === 'play' && document.getElementById('resultOverlay').hidden;
            if (!moving && !this.renderDirty && this._verify && now - (this._verifyAt || 0) > 100) {
                this._verifyAt = now;
                if (this.scene.isReady()) { this._verify = false; this._dirtyFrames = 3; }
            }
            if (!moving && !this.renderDirty && !pulsing) return;
            const interval = moving || this.renderDirty ? 1000 / 60 : 1000 / 20;
            if (now - (this.lastRenderAt || 0) < interval - 1) return;
            const elapsed = now - (this.lastRenderAt || now);
            const dt = Math.min(0.05, Math.max(0, elapsed / 1000));
            this.lastRenderAt = now;
            const start = performance.now();
            this.frame(dt);
            this.scene.render();
            this.frameCount = (this.frameCount || 0) + 1;
            if (this._dirtyFrames > 0) this._dirtyFrames--;
            this.adaptQuality(performance.now() - start, moving, elapsed);
        };
        if (window.LabRuntime) LabRuntime.bindBabylonLoop(this.engine, this._renderLoop);
        else this.engine.runRenderLoop(this._renderLoop);

        const onResize = () => {
            this.engine.resize();
            this.fitCameraFov();
        };
        if (window.LabRuntime) LabRuntime.debounceResize(onResize);
        else window.addEventListener('resize', onResize);
    }

    // Em telas estreitas (retrato), FOV vertical fixo faz o campo de visão
    // horizontal encolher com o aspect ratio e corta as laterais do tabuleiro.
    // Travar o FOV horizontal garante a largura do tabuleiro em qualquer tela.
    fitCameraFov() {
        if (!this.camera || !this.engine) return;
        const aspect = this.engine.getRenderWidth() / this.engine.getRenderHeight();
        const portrait = aspect < 1;
        this.camera.fovMode = portrait
            ? window.BABYLON.Camera.FOVMODE_HORIZONTAL_FIXED
            : window.BABYLON.Camera.FOVMODE_VERTICAL_FIXED;
        // Girou o aparelho: reenquadra a vista atual para a nova proporção.
        if (this.portrait !== undefined && this.portrait !== portrait && this.started) this.cameraView(this.view);
        this.portrait = portrait;
    }

    /**
     * Enquadramento por vista. Em retrato (FOV horizontal fixo de 0,58 rad) a
     * largura visível a uma distância d é 2·d·tan(0,29) ≈ 0,6·d; d ≈ 16
     * mostra ~9,6 casas — o tabuleiro com moldura ocupa a tela toda e as
     * casas ficam com ~44 px num celular de 375 px (antes: ~30 px).
     */
    viewPose(view) {
        const portrait = this.engine.getRenderWidth() < this.engine.getRenderHeight();
        if (view === 'top') return { beta: 0.02, radius: portrait ? 16.2 : 21.5 };
        if (view === 'detail') return { beta: 1.3, radius: 16.5 };
        return portrait ? { beta: 0.54, radius: 16.4 } : { beta: 0.9, radius: 21.5 };
    }

    start(resume = false) {
        if (document.body.dataset.state !== 'intro') return;
        const firstShow = !this.started;
        this.applyQuality();
        this.audio.init();
        this.audio.setEnabled(!this.settings.muted);
        this.syncMute();
        this.level = document.getElementById('levelSelect')?.value || 'facil';
        this.settings.level = this.level;
        const theme = document.getElementById('themeSelect')?.value || 'classic';
        if (theme !== this.factory.mats.theme) {
            this.factory.setTheme(theme);
            this.settings.theme = theme;
            this.rebuildPieces();
        }
        this.saveSettings();
        document.getElementById('intro').hidden = true;
        document.getElementById('hud').hidden = false;
        document.body.dataset.state = 'play';
        if (this.camera.autoRotationBehavior) {
            this.camera.autoRotationBehavior.idleRotationSpeed = 0;
        }
        this.engine.resize();
        this.fitCameraFov();
        // Enquadra depois do resize: o palco muda de tamanho ao trocar o menu pelo HUD.
        if (!resume || firstShow) this.cameraView('play');
        this.started = true;
        const mode = document.getElementById('modeSelect')?.value || 'cpu';
        if (!resume) this.setMode(mode);
        else {
            this.renderHud();
            this.resumeClock();
            if (this.mode === 'cpu' && !this.isHumanTurn() && !this.gameStatus().over) this.queueAi();
        }
        this.started = true;
        this.canvas.focus({ preventScroll: true });
    }

    setMode(mode) {
        if (!this.factory) return;
        this.mode = mode;
        document.getElementById('modePlay')?.setAttribute('aria-pressed', String(mode === 'cpu' || mode === 'local' || mode === 'free'));
        document.getElementById('modeAcademy')?.setAttribute('aria-pressed', String(mode === 'academy'));
        document.getElementById('modePuzzles')?.setAttribute('aria-pressed', String(mode === 'puzzles'));
        const lessonNav = document.getElementById('lessonNav');
        const lessonList = document.getElementById('lessonList');
        const puzzleList = document.getElementById('puzzleList');
        const coach = document.getElementById('coach');
        lessonNav.hidden = mode !== 'academy' && mode !== 'puzzles';
        lessonList.hidden = mode !== 'academy';
        puzzleList.hidden = mode !== 'puzzles';
        coach?.classList.toggle('is-collapsed', mode !== 'academy' && mode !== 'puzzles');
        document.getElementById('coachToggle').setAttribute('aria-expanded', String(!coach.classList.contains('is-collapsed')));
        document.body.dataset.mode = mode;
        if (mode === 'academy') this.loadLesson(this.lessonIndex);
        else if (mode === 'puzzles') this.loadPuzzle(this.puzzleIndex);
        else this.loadGame(START_FEN);
        this.speakMode();
        this.engine.resize(); this.fitCameraFov();
    }

    speakMode() {
        if (this.mode === 'cpu') {
            this.coach('Contra a máquina', 'Você joga com as brancas. Toque numa peça: os pontos mostram para onde ela pode ir. Toque num ponto para mover. Vence quem der xeque-mate no rei.', 'Travou? Toque em Dica. Errou? Desfazer volta o lance.');
        } else if (this.mode === 'local') {
            this.coach('Dois jogadores', 'Passem o aparelho. As brancas começam. Casas legais acendem ao selecionar.', 'Vire o tabuleiro depois do lance, se quiser.');
        } else if (this.mode === 'free') {
            this.coach('Tabuleiro livre', 'Os dois lados se movem. Experimente peças, roque e en passant sem o relógio da partida.', 'Nada é cobrado — só o que o mestre explica.');
        }
    }

    fillLists() {
        const lessonList = document.getElementById('lessonList');
        const puzzleList = document.getElementById('puzzleList');
        lessonList.innerHTML = '';
        puzzleList.innerHTML = '';
        LESSONS.forEach((ls, i) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = `${i + 1}. ${ls.title}`;
            if (this.progress.lessons.includes(ls.id)) b.classList.add('is-done');
            b.addEventListener('click', () => this.loadLesson(i));
            lessonList.appendChild(b);
        });
        PUZZLES.forEach((pz, i) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = pz.title;
            if (this.progress.puzzles.includes(pz.id)) b.classList.add('is-done');
            b.addEventListener('click', () => this.loadPuzzle(i));
            puzzleList.appendChild(b);
        });
    }

    loadGame(fen) {
        this.cancelWork();
        this.game.load(fen);
        this.keyboardSquare = 12;
        this.history = [];
        this.selected = -1;
        this.hover = -1;
        this.expect = null;
        this.busy = false;
        this.pendingPromo = null;
        this.flagged = null;
        this.setupClock();
        this.clearMarks();
        this.rebuildPieces();
        this.renderHud();
        this.saveGame();
    }

    loadLesson(i) {
        this.lessonIndex = (i + LESSONS.length) % LESSONS.length;
        const ls = LESSONS[this.lessonIndex];
        this.mode = 'academy';
        this.loadGame(ls.fen);
        this.expect = ls.expect;
        this.coach(ls.title, ls.text, ls.tip);
        this.markList('lessonList', this.lessonIndex);
        this.flashHint();
        document.getElementById('lessonNav').hidden = false;
        document.getElementById('lessonList').hidden = false;
        document.getElementById('puzzleList').hidden = true;
        this.renderHud();
    }

    loadPuzzle(i) {
        this.puzzleIndex = (i + PUZZLES.length) % PUZZLES.length;
        const pz = PUZZLES[this.puzzleIndex];
        this.mode = 'puzzles';
        this.loadGame(pz.fen);
        this.expect = pz.expect;
        this.coach(pz.title, pz.text, 'Encontre o lance. Dica acende a peça certa.');
        this.markList('puzzleList', this.puzzleIndex);
        document.getElementById('lessonNav').hidden = false;
        document.getElementById('lessonList').hidden = true;
        document.getElementById('puzzleList').hidden = false;
        this.renderHud();
    }

    markList(id, index) {
        const list = document.getElementById(id);
        [...list.children].forEach((el, i) => el.setAttribute('aria-current', String(i === index)));
    }

    shiftLesson(dir) {
        if (this.mode === 'puzzles') this.loadPuzzle(this.puzzleIndex + dir);
        else this.loadLesson(this.lessonIndex + dir);
    }

    coach(title, text, tip = '') {
        document.getElementById('coachTitle').textContent = title;
        document.getElementById('coachText').textContent = text;
        document.getElementById('coachTip').textContent = tip;
    }

    rebuildPieces() {
        const old = new Set(this.pieces.values());
        const next = new Map();
        for (let i = 0; i < 64; i++) {
            const p = this.game.board[i];
            if (!p) continue;
            // Reutiliza as malhas da posição anterior, inclusive a peça movida.
            let mesh = [...old].find(m => m.chessPiece === p && m.metadata.kind === p.t);
            if (mesh) old.delete(mesh);
            else mesh = this.factory.spawn(p.t, p.c);
            if (!mesh) continue;
            mesh.chessPiece = p;
            mesh.material = this.factory.materialFor(p.t, p.c);
            mesh.scaling.setAll(1); mesh.isVisible = true;
            const pos = squareToWorld(i);
            mesh.position.set(pos.x, BOARD_Y, pos.z);
            mesh.metadata = { kind: p.t, color: p.c, index: i };
            if (mesh.contact) mesh.contact.isVisible = true;
            this.factory.syncContact(mesh);
            // Só a peça projeta sombra; feltro e disco de contato ficam de fora.
            this.lights.shadowGen.addShadowCaster(mesh, false);
            next.set(i, mesh);
        }
        for (const mesh of old) { this.lights.shadowGen.removeShadowCaster(mesh); mesh.dispose(); }
        this.pieces = next;
        this.syncTray();
        this.lights.shadowGen.getShadowMap().resetRefreshCounter();
        this.renderDirty = true;
        this.refreshMarks();
    }

    /**
     * Bandejas de capturadas: derivadas do histórico (game.stack), então
     * desfazer, reiniciar e carregar lições mantêm a mesa sempre coerente.
     */
    syncTray() {
        const taken = this.game.stack.filter(u => u.captured).map(u => u.captured);
        const key = this.factory.theme + taken.map(c => c.c + c.t).join('');
        if (key === this.trayKey) return;
        this.trayKey = key;
        for (const mesh of this.trayMeshes || []) { this.lights.shadowGen.removeShadowCaster(mesh); mesh.dispose(); }
        this.trayMeshes = [];
        const count = { w: 0, b: 0 };
        for (const piece of taken) {
            const mesh = this.factory.spawn(piece.t, piece.c);
            if (!mesh) continue;
            const slot = traySlot(piece.c, count[piece.c]++);
            mesh.position.set(slot.x, slot.y, slot.z);
            mesh.metadata = { kind: piece.t, color: piece.c, tray: true };
            mesh.isPickable = false;
            this.factory.syncContact(mesh, TRAY_Y);
            this.lights.shadowGen.addShadowCaster(mesh, false);
            this.trayMeshes.push(mesh);
        }
    }

    pieceAt(index) {
        return this.pieces.get(index) || null;
    }

    pointerPosition(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.pointerX = e.clientX - rect.left;
        this.pointerY = e.clientY - rect.top;
    }

    onDown(e) {
        this.pointerIds.add(e.pointerId);
        if (this.pointerIds.size > 1) { this.cancelDrag(); return; }
        this.pointerPosition(e);
        this.renderDirty = true;
        this.cameraTransition = null;
        // Safari/iOS: toque pode chegar com button === -1.
        if ((e.pointerType === 'mouse' && e.button !== 0) || document.body.dataset.state !== 'play' || this.busy || this.pendingPromo || this.playIsOver()) return;
        this.canvas.focus({ preventScroll: true });
        try { this.canvas.setPointerCapture(e.pointerId); } catch { /* ponteiro já solto */ }
        this.drag = { x: e.clientX, y: e.clientY, active: true, mesh: null, origin: null, square: -1 };
        const hit = this.hit();
        const piece = this.game.board[hit];
        if (piece && piece.c === this.game.side && this.isHumanTurn()) {
            this.drag.square = hit;
            this.drag.mesh = this.pieceAt(hit);
            this.drag.origin = this.drag.mesh.position.clone();
            this.camera.detachControl();
            this.camera.inertialAlphaOffset = this.camera.inertialBetaOffset = 0;
            this.onSquare(hit);
        }
    }

    onMove(e) {
        this.pointerPosition(e);
        this.renderDirty = true;
        if (!this.drag.active) { this.updateHover(); return; }
        if (!this.drag.mesh || Math.hypot(e.clientX - this.drag.x, e.clientY - this.drag.y) < 8) return;
        this.canvas.classList.add('is-dragging');
        const ray = this.scene.createPickingRay(this.pointerX, this.pointerY, window.BABYLON.Matrix.Identity(), this.camera);
        const distance = ray.intersectsPlane(new window.BABYLON.Plane(0, 1, 0, -0.3));
        if (distance !== null && distance >= 0) {
            const pt = ray.origin.add(ray.direction.scale(distance));
            this.drag.mesh.position.set(Math.max(-4.2, Math.min(4.2, pt.x)), 0.3, Math.max(-4.2, Math.min(4.2, pt.z)));
            this.lights.shadowGen.getShadowMap().resetRefreshCounter();
        }
    }

    onUp(e) {
        this.pointerIds.delete(e.pointerId);
        this.pointerPosition(e);
        if (!this.drag.active) return;
        const drag = this.drag;
        const moved = Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 8;
        const hit = this.hit(!!drag.mesh && moved);
        this.drag = { active: false };
        this.camera.attachControl(this.canvas, true);
        this.camera.inputs.attached.keyboard?.detachControl();
        this.canvas.classList.remove('is-dragging');
        if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
        if (drag.mesh) drag.mesh.position.copyFrom(drag.origin);
        if (moved) {
            if (drag.mesh && hit >= 0 && hit !== drag.square) {
                const move = this.game.findMove(drag.square, hit, this.expect?.promo || 'q');
                if (move) this.tryMove(move);
                else this.audio.illegal();
            }
            this.lights.shadowGen.getShadowMap().resetRefreshCounter();
            return;
        }
        if (this.busy || this.pendingPromo) return;
        const square = this.resolveTap(hit);
        if (square < 0) { this.selected = -1; this.legal = []; this.refreshMarks(); return; }
        this.onSquare(square);
        this.updateHover();
    }

    /**
     * Toque com peça selecionada: na câmera inclinada, a cabeça de uma peça
     * alta cobre a casa de trás. Se o dedo caiu numa peça que não é destino,
     * mas a casa do tabuleiro sob o dedo (ignorando peças) é um destino legal,
     * vale o destino — é o ponto dourado que a criança está vendo.
     */
    resolveTap(onPiece) {
        if (this.selected < 0) return onPiece;
        const isTarget = (sq) => sq >= 0 && this.legal.some((m) => m.to === sq);
        if (isTarget(onPiece)) return onPiece;
        const onBoard = this.hit(true);
        return isTarget(onBoard) ? onBoard : onPiece;
    }

    onBoardKey(e) {
        if (document.body.dataset.state !== 'play' || this.busy || this.pendingPromo) return;
        const offset = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: 8, ArrowDown: -8 }[e.key];
        if (offset) {
            e.preventDefault(); e.stopPropagation();
            const dir = this.flip ? -offset : offset;
            const next = this.keyboardSquare + dir;
            if (next >= 0 && next < 64 && (Math.abs(dir) === 8 || (next >> 3) === (this.keyboardSquare >> 3))) this.keyboardSquare = next;
            placeMark(this.world.marks.hover, this.keyboardSquare);
        } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault(); e.stopPropagation(); this.onSquare(this.keyboardSquare);
        } else if (e.key === 'Escape') {
            this.selected = -1; this.legal = []; this.refreshMarks();
        } else return;
        const p = this.game.board[this.keyboardSquare];
        document.getElementById('boardAnnouncement').textContent = `${alg(this.keyboardSquare)}, ${p ? `${PIECE_NAME[p.t]} ${p.c === 'w' ? 'branco' : 'preto'}` : 'vazia'}`;
        this.renderDirty = true;
    }

    updateHover() {
        if (this.busy || this.pendingPromo || !this.scene) return;
        const now = performance.now();
        if (now - this.lastHoverAt < 32) return;
        this.lastHoverAt = now;
        const hit = this.hit();
        if (hit === this.hover) return;
        this.hover = hit;
        const mark = this.world?.marks?.hover;
        if (!mark) return;
        mark.isVisible = false;
        if (hit < 0) return;
        const piece = this.game.board[hit];
        const canSelect = piece && piece.c === this.game.side && (this.mode !== 'cpu' || this.game.side === this.player);
        if (canSelect || this.selected >= 0 && this.game.findMove(this.selected, hit)) {
            placeMark(mark, hit);
        }
    }

    hit(boardOnly = false) {
        const pick = !boardOnly && this.scene.pick(this.pointerX, this.pointerY, (mesh) => {
            if (this.drag && this.drag.mesh && mesh === this.drag.mesh) return false;
            return mesh.isPickable && (mesh.metadata?.index !== undefined || mesh.metadata?.kind === 'square');
        });
        if (pick && pick.hit && pick.pickedMesh) {
            let m = pick.pickedMesh;
            if (m.metadata && m.metadata.index !== undefined) {
                return m.metadata.index;
            }
        }
        const ray = this.scene.createPickingRay(this.pointerX, this.pointerY, window.BABYLON.Matrix.Identity(), this.camera);
        const hit = ray.intersectsPlane(new window.BABYLON.Plane(0, 1, 0, -0.07));
        if (hit !== null && hit !== undefined && hit >= 0) {
            const pt = ray.origin.add(ray.direction.scale(hit));
            return worldToSquare(pt.x, pt.z);
        }
        return -1;
    }

    onSquare(index) {
        if (this.playIsOver() || this.busy) return;
        const piece = this.game.board[index];
        if (this.selected >= 0) {
            const move = this.game.findMove(this.selected, index, this.expect?.promo || 'q');
            if (move) {
                this.tryMove(move);
                return;
            }
        }
        const side = this.game.side;
        const canSelect = this.mode !== 'cpu' || side === this.player;
        if (piece && piece.c === side && canSelect) {
            this.selected = index;
            this.legal = this.game.legalMovesFrom(index);
            this.refreshMarks();
            this.explainPiece(piece, index);
            this.renderHud();
            return;
        }
        const had = this.selected >= 0;
        this.selected = -1;
        this.hover = -1;
        this.legal = [];
        this.refreshMarks();
        if (had) this.renderHud();
    }

    explainPiece(piece, index) {
        const moves = this.game.legalMovesFrom(index);
        const name = PIECE_NAME[piece.t];
        const how = PIECE_HOW[piece.t];
        const n = moves.length;
        const hang = this.game.hanging(index) ? ' Esta peça está desprotegida.' : '';
        this.coach(name, `${how}${hang}`, n ? `${n} lance${n > 1 ? 's' : ''} legal${n > 1 ? 'is' : ''} a partir de ${alg(index)}.` : `Nenhum lance legal em ${alg(index)} — talvez esteja cravada.`);
    }

    tryMove(move) {
        if (this.expect) {
            const okFrom = alg(move.from) === this.expect.from;
            const okTo = alg(move.to) === this.expect.to;
            const okPromo = !this.expect.promo || move.promo === this.expect.promo;
            if (!(okFrom && okTo && okPromo)) {
                this.audio.illegal();
                this.coach('Quase', 'Esse não é o lance da lição. Olhe o destaque do mestre — a peça certa e a casa certa.', this.currentTip());
                this.flashHint();
                return;
            }
        }
        if (this.needsPromoChoice(move)) {
            this.pendingPromo = move;
            document.getElementById('promoOverlay').hidden = false;
            document.querySelector('[data-promo="q"]').focus();
            return;
        }
        this.commit(move);
    }

    needsPromoChoice(move) {
        return !!move.promo && this.isHumanTurn() && !this.expect?.promo;
    }

    isHumanTurn() {
        if (this.mode === 'cpu') return this.game.side === this.player;
        return true;
    }

    playIsOver() {
        // As lições de rei, bispo e cavalo usam material insuficiente de
        // propósito. Continuam interativas mesmo sem possibilidade de mate.
        return !['academy', 'free'].includes(this.mode) && this.gameStatus().over;
    }

    finishPromo(promo) {
        document.getElementById('promoOverlay').hidden = true;
        if (!this.pendingPromo) return;
        const move = this.game.findMove(this.pendingPromo.from, this.pendingPromo.to, promo);
        this.pendingPromo = null;
        this.canvas.focus({ preventScroll: true });
        if (move) this.commit(move);
    }

    currentTip() {
        if (this.mode === 'academy') return LESSONS[this.lessonIndex].tip;
        if (this.mode === 'puzzles') return PUZZLES[this.puzzleIndex].text;
        return '';
    }

    commit(move) {
        const generation = this.generation;
        const san = this.game.san(move);
        const captured = move.captured;
        const from = move.from;
        const to = move.to;
        const mesh = this.pieceAt(from);
        const capMesh = move.flag === 'e' && move.epCap >= 0
            ? this.pieceAt(move.epCap)
            : this.pieceAt(to);
        const rookDest = move.flag === 'k' ? (from === 4 ? 5 : 61) : move.flag === 'q' ? (from === 4 ? 3 : 59) : -1;
        const rookSrc = move.flag === 'k' ? (from === 4 ? 7 : 63) : move.flag === 'q' ? (from === 4 ? 0 : 56) : -1;
        const rookMesh = rookSrc >= 0 ? this.pieceAt(rookSrc) : null;

        this.tickClock();
        if (this.flagged) return; // a bandeira caiu antes do lance chegar
        this.game.play(move);
        const mover = this.game.side === 'w' ? 'b' : 'w';
        this.history.push({ san, color: mover });
        this.pressClock(mover);
        this.saveGame();

        this.selected = -1;
        this.hover = -1;
        this.legal = [];
        this.busy = true;
        this.refreshMarks();
        this.renderHud();

        // O som toca no pouso da peça, não na largada.
        const land = () => {
            if (generation !== this.generation) return;
            if (move.flag === 'k' || move.flag === 'q') this.audio.castle();
            else if (captured) this.audio.capture();
            else if (move.promo) this.audio.promote();
            else this.audio.move();
        };

        const hops = [];
        if (mesh) hops.push(this.hop(mesh, from, to, land)); else land();
        if (rookMesh && rookDest >= 0) hops.push(this.hop(rookMesh, rookSrc, rookDest));
        if (capMesh && captured) {
            const index = this.game.stack.filter(u => u.captured && u.captured.c === captured.c).length - 1;
            hops.push(this.toTray(capMesh, traySlot(captured.c, Math.max(0, index))));
        } else if (capMesh) hops.push(this.fadeOut(capMesh));

        Promise.all(hops).then(() => {
            if (generation !== this.generation) return;
            this.rebuildPieces();
            this.busy = false;
            this.afterMove(san, move, captured);
        });
    }

    /**
     * Lance: a peça levanta, desliza em arco e pousa.
     *   posição xz = lerp(a, b, easeInOut(t))
     *   altura  y  = BOARD_Y + h · sin(π·t)^0.7      (sobe rápido, desce assentando)
     *   h = cavalo: 0.95 + 0.05·dist (salta por cima das peças)
     *       demais: 0.16 + 0.035·dist, até 0.42 (desliza quase rente)
     *   duração = 0.26 s + 0.03 s por casa, até 0.5 s
     */
    hop(mesh, from, to, onLand) {
        const a = squareToWorld(from);
        const b = squareToWorld(to);
        const dist = Math.hypot(b.x - a.x, b.z - a.z);
        const h = mesh.metadata?.kind === 'n' ? 0.95 + dist * 0.05 : Math.min(0.42, 0.16 + dist * 0.035);
        let landed = false;
        return this.tween(Math.min(0.5, 0.26 + dist * 0.03), (t) => {
            const k = easeInOut(t);
            mesh.position.x = a.x + (b.x - a.x) * k;
            mesh.position.z = a.z + (b.z - a.z) * k;
            mesh.position.y = BOARD_Y + Math.pow(Math.sin(t * Math.PI), 0.7) * h;
            if (!landed && t >= 0.9) { landed = true; onLand?.(); }
        });
    }

    /** Captura: a peça tomada sai num arco alto e pousa na bandeja lateral. */
    toTray(mesh, slot) {
        const a = mesh.position.clone();
        if (mesh.contact) mesh.contact.isVisible = false;
        mesh.metadata = { ...mesh.metadata, index: undefined, flying: true };
        mesh.isPickable = false;
        return this.tween(0.62, (t) => {
            const k = easeInOut(t);
            // Sobe antes de andar: libera a casa para quem captura.
            const lift = Math.sin(Math.min(1, t * 1.15) * Math.PI);
            mesh.position.x = a.x + (slot.x - a.x) * k * k;
            mesh.position.z = a.z + (slot.z - a.z) * k * k;
            mesh.position.y = a.y + (slot.y - a.y) * k + Math.max(0, lift) * 1.9;
        });
    }

    fadeOut(mesh) {
        const startY = mesh.position.y;
        return this.tween(0.32, (t) => {
            mesh.position.y = startY - t * 0.4;
            mesh.scaling.setAll(1 - t * 0.85);
        }).then(() => {
            mesh.isVisible = false;
        });
    }

    tween(dur, fn) {
        return new Promise((resolve) => {
            this.anims.push({ t: 0, dur: this.reducedMotion ? 0.01 : dur, fn, resolve });
        });
    }

    afterMove(san, move, captured) {
        const st = this.gameStatus();
        if (st.over) this.stopClock();
        if (st.check) this.audio.check();
        if (st.over && st.reason === 'xeque-mate') this.audio.win();

        const hangingAfter = move && this.game.board[move.to] && this.game.hanging(move.to);
        const text = commentOnMove(san, {
            check: st.check,
            mate: st.reason === 'xeque-mate',
            captured,
            hangingAfter,
            castle: move.flag === 'k' || move.flag === 'q',
            promo: !!move.promo,
            opening: this.history.length <= 6
        });

        if (this.expect) {
            this.completeTask(text);
        } else {
            this.coach(st.check ? 'Xeque' : 'Lance', text, st.over ? this.endLine(st) : '');
        }

        this.renderHud();
        this.refreshMarks();

        if (st.over && this.mode !== 'academy' && this.mode !== 'puzzles') {
            this.showResult(st);
            return;
        }
        if (this.mode === 'cpu' && !st.over && this.game.side !== this.player) {
            this.queueAi();
        }
    }

    completeTask(text) {
        const pack = this.mode === 'puzzles' ? PUZZLES[this.puzzleIndex] : LESSONS[this.lessonIndex];
        const success = pack.success || text;
        this.coach('Isso.', success, this.mode === 'academy' ? 'Toque em Próxima para continuar.' : 'Toque em Próxima para o próximo puzzle.');
        this.expect = null;
        if (this.mode === 'academy') {
            if (!this.progress.lessons.includes(pack.id)) this.progress.lessons.push(pack.id);
        } else if (!this.progress.puzzles.includes(pack.id)) this.progress.puzzles.push(pack.id);
        saveProgress(this.progress);
        this.fillLists();
        if (this.mode === 'academy') this.markList('lessonList', this.lessonIndex);
        else this.markList('puzzleList', this.puzzleIndex);
    }

    cancelDrag() {
        if (this.drag.mesh && this.drag.origin && !this.drag.mesh.isDisposed()) this.drag.mesh.position.copyFrom(this.drag.origin);
        this.drag = { active: false };
        this.canvas.classList.remove('is-dragging');
        this.camera?.attachControl(this.canvas, true);
        this.camera?.inputs.attached.keyboard?.detachControl();
        this.lights?.shadowGen?.getShadowMap().resetRefreshCounter();
    }

    cancelWork() {
        this.generation++;
        this.stopSearch();
        clearTimeout(this.aiDelay);
        this.thinking = false;
        this.cancelDrag();
        this.anims.splice(0).forEach(a => a.resolve());
        this.busy = false;
        this.pendingPromo = null;
        document.getElementById('promoOverlay').hidden = true;
        document.getElementById('resultOverlay').hidden = true;
    }

    /**
     * A busca roda fora da UI (Web Worker). Reiniciar ou trocar a lição
     * invalida a resposta (generation). Se o worker não abrir, morrer ou
     * passar de 8 s, a busca roda aqui mesmo num nível leve (≤ 0,3 s) e, em
     * último caso, sai um lance legal ao acaso: a vez nunca fica presa.
     */
    searchMove(level, callback, minDelay = 0) {
        const generation = this.generation;
        const t0 = performance.now();
        this.stopSearch();
        this.busy = true;
        this.thinking = minDelay > 0; // só o lance da máquina tem pausa; a dica não
        let done = false;
        const finish = (move) => {
            if (done || generation !== this.generation) return;
            done = true;
            this.stopSearch();
            const wait = this.reducedMotion ? 0 : Math.max(0, minDelay - (performance.now() - t0));
            this.aiDelay = setTimeout(() => {
                if (generation !== this.generation) return;
                this.busy = false;
                this.thinking = false;
                if (move) callback(move);
                else this.renderHud();
            }, wait);
        };
        const local = async () => {
            if (done || generation !== this.generation) return;
            this.stopSearch();
            let move = null;
            try {
                const { pickMove } = await import('./ai.js?v=6');
                if (done || generation !== this.generation) return;
                const m = pickMove(new Chess(this.game.fen()), level === 'clube' ? 'praticante' : level, Math.random, { budgetMs: 300 });
                move = m && this.game.findMove(m.from, m.to, m.promo || 'q');
            } catch { /* cai no sorteio abaixo */ }
            if (!move) {
                const all = this.game.legalMoves();
                move = all[Math.floor(Math.random() * all.length)] || null;
            }
            finish(move);
        };
        try {
            const worker = new Worker(new URL('./ai-worker.js?v=6', import.meta.url), { type: 'module' });
            this.worker = worker;
            worker.onerror = (e) => { e.preventDefault?.(); local(); };
            worker.onmessageerror = () => local();
            worker.onmessage = ({ data }) => {
                const m = data?.move && this.game.findMove(data.move.from, data.move.to, data.move.promo || 'q');
                if (m) finish(m); else local();
            };
            this.aiTimeout = setTimeout(local, 8000);
            worker.postMessage({ fen: this.game.fen(), level });
        } catch { local(); }
    }

    stopSearch() {
        clearTimeout(this.aiTimeout);
        this.worker?.terminate();
        this.worker = null;
    }

    queueAi() {
        this.coach('A máquina pensa', 'Analisando a posição…', 'Você pode ajustar a câmera enquanto espera.');
        this.searchMove(this.level, move => this.commit(move), THINK_MIN_MS + Math.random() * THINK_JITTER_MS);
        this.renderHud();
    }

    hint() {
        if (this.busy || this.pendingPromo) return;
        if (this.expect) { this.flashHint(); return; }
        if (this.gameStatus().over) return;
        this.searchMove('praticante', mv => {
            this.selected = mv.from;
            this.legal = this.game.legalMovesFrom(mv.from);
            this.refreshMarks();
            placeMark(this.world.marks.hint, mv.to);
            document.getElementById('coach').classList.remove('is-collapsed');
            document.getElementById('coachToggle').setAttribute('aria-expanded', 'true');
            this.coach('Dica', `Considere ${this.game.san(mv)}.`, `${alg(mv.from)} → ${alg(mv.to)}. Toque a peça e depois a casa destacada.`);
        });
    }

    applyQuality() {
        const previous = this.quality;
        this.quality = pickQuality(this.settings.quality);
        if (previous.id !== this.quality.id) {
            this.postProcess.ao?.dispose();
            this.postProcess.pipe.dispose();
            this.postProcess = setupPostProcess(window.BABYLON, this.scene, this.quality);
            // Materiais das peças dependem do nível (sheen/translucidez).
            this.factory.quality = this.quality;
            this.factory.setTheme(this.factory.theme);
            this.trayKey = null;
            this.rebuildPieces();
        }
        applyShadowQuality(window.BABYLON, this.lights, this.quality);
        this.world.reflection.setEnabled(this.quality.reflections);
        this.renderScale = Math.min(devicePixelRatio || 1, this.quality.pr, isMobile() ? 1.5 : this.quality.pr);
        this.engine.setHardwareScalingLevel(1 / this.renderScale);
        this.scene.shadowsEnabled = this.quality.shadows;
        this.lights.shadowGen.mapSize = this.quality.shadowMap;
        // Trocar filtro ou tamanho recria o mapa: a sombra volta a ser desenhada
        // uma vez só e reaproveitada até alguma peça se mover.
        this.lights.shadowGen.getShadowMap().refreshRate = window.BABYLON.RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
        this.lights.shadowGen.getShadowMap().resetRefreshCounter();
        this.postProcess.pipe.samples = Math.min(this.quality.msaa, this.engine.getCaps().maxMSAASamples || 1);
        this.updateDepthOfField();
        this.adaptiveFrames = this.adaptiveTime = 0;
        document.getElementById('qualityLabel').textContent = this.settings.quality === 'auto' ? 'Automática' : { low: 'Leve', medium: 'Equilibrada', high: 'Alta' }[this.quality.id];
        this.renderDirty = true;
    }

    adaptQuality(ms, moving, elapsed) {
        // Intervalos reais durante interação incluem pressão da GPU. Em repouso
        // o limite voluntário de 24 fps não deve rebaixar a qualidade.
        this.adaptiveFrames++;
        this.adaptiveTime += moving ? Math.max(ms, Math.min(elapsed, 100)) : ms;
        if (this.adaptiveFrames < 120) return;
        if (this.diagnostics) {
            this.canvas.dataset.renderStats = JSON.stringify({
                cpuSubmitMs: Math.round(ms * 100) / 100,
                activeMeshes: this.scene.getActiveMeshes().length,
                triangles: this.scene.getActiveIndices() / 3,
                width: this.engine.getRenderWidth(), height: this.engine.getRenderHeight(),
                scale: this.renderScale, shadows: this.scene.shadowsEnabled,
                pieces: this.pieces.size, quality: this.quality.id
            });
        }
        // Histerese: só reduz resolução após 120 quadros caros. A UI conserva
        // sua resolução nativa; modelos e regras nunca perdem qualidade.
        if (this.settings.quality === 'auto' && this.adaptiveTime / this.adaptiveFrames > 23 && this.renderScale > 0.8) {
            this.renderScale = Math.max(0.8, this.renderScale - 0.15);
            this.engine.setHardwareScalingLevel(1 / this.renderScale);
            this.dofDisabled = true;
            this.updateDepthOfField();
            this.renderDirty = true;
        }
        this.adaptiveFrames = this.adaptiveTime = 0;
    }

    updateDepthOfField() {
        const pipe = this.postProcess.pipe;
        // Jogar: abertura fechada (só o fundo e a última fileira amaciam).
        // Detalhe: lente aberta, foco no centro do tabuleiro. Superior: sem desfoque.
        pipe.depthOfFieldEnabled = this.quality.id !== 'low' && this.view !== 'top' && !this.dofDisabled;
        pipe.depthOfField.fStop = this.view === 'detail' ? 2.2 : 7;
        pipe.depthOfField.focusDistance = this.camera.radius * 1000;
        // Sem desfoque não há por que redesenhar as peças num passe de profundidade.
        if (!pipe.depthOfFieldEnabled) this.scene.disableDepthRenderer(this.camera);
    }

    cameraView(view) {
        if (!this.camera) return;
        this.view = view;
        const alpha = (this.flip ? -Math.PI / 2 : Math.PI / 2) + (view === 'detail' ? -0.42 : 0);
        const { beta, radius } = this.viewPose(view);
        this.moveCamera(alpha, beta, radius);
        this.updateDepthOfField();
        document.querySelectorAll('[data-camera]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.camera === view)));
    }

    moveCamera(alpha, beta, radius) {
        this.scene.stopAnimation(this.camera);
        this.camera.inertialAlphaOffset = this.camera.inertialBetaOffset = this.camera.inertialRadiusOffset = 0;
        const delta = Math.atan2(Math.sin(alpha - this.camera.alpha), Math.cos(alpha - this.camera.alpha));
        this.cameraTransition = { t: 0, from: [this.camera.alpha, this.camera.beta, this.camera.radius], to: [this.camera.alpha + delta, beta, radius] };
        this.renderDirty = true;
    }

    flashHint() {
        if (!this.expect) return;
        const from = parseAlg(this.expect.from);
        const to = parseAlg(this.expect.to);
        this.selected = from;
        this.keyboardSquare = from;
        this.legal = this.game.legalMovesFrom(from);
        this.refreshMarks();
        placeMark(this.world.marks.hint, to);
    }

    undo() {
        if (this.game.stack.length === 0 || this.pendingPromo) return;
        this.cancelWork();
        this.game.undo();
        this.history.pop();
        if (this.mode === 'cpu' && this.game.side !== this.player && this.game.stack.length) {
            this.game.undo();
            this.history.pop();
        }
        this.selected = -1;
        this.hover = -1;
        this.legal = [];
        this.flagged = null;
        if (this.clock) { this.clock.started = this.game.stack.length > 0; this.clock.last = performance.now(); }
        this.rebuildPieces();
        this.renderHud();
        this.saveGame();
        this.coach('Desfeito', 'O último lance voltou. O tabuleiro não guarda rancor.', '');
    }

    toggleFlip() {
        if (!this.camera || this.drag.active) return;
        this.flip = !this.flip;
        // Parte do destino da transição em curso (se houver): dois toques
        // rápidos voltam ao lado original em vez de parar no meio do giro.
        const from = this.cameraTransition ? this.cameraTransition.to[0] : this.camera.alpha;
        this.moveCamera(from + Math.PI, this.camera.beta, this.camera.radius);
        document.getElementById('flipBtn').setAttribute('aria-pressed', String(this.flip));
    }

    fresh() {
        document.getElementById('resultOverlay').hidden = true;
        if (this.mode === 'academy') this.loadLesson(this.lessonIndex);
        else if (this.mode === 'puzzles') this.loadPuzzle(this.puzzleIndex);
        else this.loadGame(START_FEN);
        this.speakMode();
    }

    toggleMute() {
        this.settings.muted = !this.settings.muted;
        this.saveSettings();
        this.audio.init();
        this.audio.setEnabled(!this.settings.muted);
        this.syncMute();
    }

    syncMute() {
        const btn = document.getElementById('muteBtn');
        if (!btn) return;
        btn.setAttribute('aria-pressed', String(!this.settings.muted));
        btn.textContent = this.settings.muted ? 'Mudo' : 'Som';
    }

    clearMarks() {
        const m = this.world.marks;
        m.dots.forEach((d) => { d.isVisible = false; });
        m.caps.forEach((c) => { c.isVisible = false; });
        m.select.isVisible = false;
        m.lastFrom.isVisible = false;
        m.lastTo.isVisible = false;
        m.check.isVisible = false;
        m.hint.isVisible = false;
        if (m.hover) m.hover.isVisible = false;
    }

    refreshMarks() {
        this.renderDirty = true;
        this.clearMarks();
        const m = this.world.marks;
        if (this.selected >= 0) placeMark(m.select, this.selected);
        if (this.hover >= 0) {
            const hovered = this.game.board[this.hover];
            const canSelect = hovered && hovered.c === this.game.side && (this.mode !== 'cpu' || this.game.side === this.player);
            if (canSelect || this.selected >= 0 && this.game.findMove(this.selected, this.hover)) placeMark(m.hover, this.hover);
        }
        let di = 0;
        let ci = 0;
        for (const mv of this.legal) {
            if (mv.captured || mv.flag === 'e') {
                if (ci < m.caps.length) placeMark(m.caps[ci++], mv.to);
            } else if (di < m.dots.length) {
                placeMark(m.dots[di++], mv.to);
            }
        }
        const last = this.game.stack[this.game.stack.length - 1];
        if (last) {
            placeMark(m.lastFrom, last.from);
            placeMark(m.lastTo, last.to);
        }
        if (this.game.inCheck()) {
            const k = this.game.kingIndex(this.game.side);
            if (k >= 0) placeMark(m.check, k);
        }
    }

    renderHud() {
        const st = this.gameStatus();
        if (['academy', 'free'].includes(this.mode) && st.moves.length) st.over = false;
        document.getElementById('opponentName').textContent = this.mode === 'cpu' ? `Máquina · ${LEVEL_LABEL[this.level] || this.level}` : this.mode === 'academy' ? `Lição ${this.lessonIndex + 1} de ${LESSONS.length}` : this.mode === 'puzzles' ? `Desafio ${this.puzzleIndex + 1} de ${PUZZLES.length}` : this.mode === 'free' ? 'Tabuleiro livre' : 'Dois jogadores';
        const line = document.getElementById('statusLine');
        if (this.mode === 'academy' || this.mode === 'puzzles') {
            line.textContent = this.expect ? 'Encontre o lance' : 'Concluído · próxima lição';
            line.classList.remove('is-check');
        } else if (st.over) {
            line.textContent = st.reason === 'xeque-mate'
                ? `Xeque-mate · ${this.winnerLabel()}`
                : st.reason === 'tempo' && st.result !== '½-½'
                    ? `Tempo esgotado · ${this.winnerLabel()}`
                    : `Empate · ${st.reason}`;
            line.classList.toggle('is-check', st.reason === 'xeque-mate');
        } else if (this.mode === 'cpu' && this.game.side === this.player) {
            // Frases curtas para quem está aprendendo: o que fazer agora.
            line.textContent = st.check
                ? 'Xeque! Salve o seu rei'
                : this.selected >= 0 ? 'Toque num ponto dourado' : 'Sua vez · toque numa peça';
            line.classList.toggle('is-check', st.check);
        } else {
            line.textContent = st.check
                ? `Xeque · ${this.game.side === 'w' ? 'brancas' : 'pretas'}`
                : `${this.game.side === 'w' ? 'Brancas' : 'Pretas'} jogam`;
            line.classList.toggle('is-check', st.check);
        }
        if (this.thinking && this.mode === 'cpu' && !st.over) line.textContent = 'A máquina pensa…';
        document.getElementById('undoBtn').disabled = !this.game.stack.length || !!this.pendingPromo;
        document.getElementById('hintBtn').disabled = this.busy || st.over || !!this.pendingPromo;
        this.renderCaptured();
        this.renderMoves();
        this.renderClock();
    }

    renderCaptured() {
        const taken = { w: { q: 0, r: 0, b: 0, n: 0, p: 0 }, b: { q: 0, r: 0, b: 0, n: 0, p: 0 } };
        for (const u of this.game.stack) {
            if (u.captured) taken[u.captured.c][u.captured.t] += 1;
        }
        let html = '';
        for (const c of ['w', 'b']) {
            for (const t of ['q', 'r', 'b', 'n', 'p']) {
                for (let i = 0; i < taken[c][t]; i++) html += GLYPH[c][t];
            }
            if (c === 'w') html += '  ';
        }
        document.getElementById('captured').textContent = html.trim() || '—';
    }

    renderMoves() {
        const ol = document.getElementById('moves');
        ol.innerHTML = '';
        for (let i = 0; i < this.history.length; i += 2) {
            const li = document.createElement('li');
            const n = document.createElement('span');
            n.className = 'n';
            n.textContent = `${(i / 2) + 1}.`;
            const a = document.createElement('span');
            a.textContent = this.history[i].san;
            const b = document.createElement('span');
            b.textContent = this.history[i + 1]?.san || '';
            li.append(n, a, b);
            ol.appendChild(li);
        }
        ol.scrollTop = ol.scrollHeight;
    }

    /** Quem venceu, do ponto de vista de quem está jogando. */
    winnerLabel() {
        const winner = this.flagged ? (this.flagged === 'w' ? 'b' : 'w') : this.game.side === 'w' ? 'b' : 'w';
        if (this.mode === 'cpu') return winner === this.player ? 'você venceu' : 'a máquina venceu';
        return winner === 'w' ? 'brancas vencem' : 'pretas vencem';
    }

    endLine(st) {
        if (st.reason === 'xeque-mate') {
            return this.game.side === 'b' ? 'As brancas venceram.' : 'As pretas venceram.';
        }
        return `Empate por ${st.reason}.`;
    }

    showResult(st) {
        if (st.reason === 'tempo' && st.result !== '½-½') {
            const won = this.mode === 'cpu' && this.flagged !== this.player;
            const lost = this.mode === 'cpu' && this.flagged === this.player;
            const ov = document.getElementById('resultOverlay');
            ov.hidden = false;
            ov.dataset.outcome = won ? 'win' : lost ? 'loss' : 'mate';
            document.getElementById('resultKicker').innerHTML = '<i></i> Tempo esgotado';
            document.getElementById('resultTitle').textContent = won ? 'Você venceu!' : lost ? 'Seu tempo acabou' : (this.flagged === 'w' ? 'Pretas vencem' : 'Brancas vencem');
            document.getElementById('resultText').textContent = lost
                ? 'O relógio zerou antes do lance. Tente um ritmo mais longo nos Ajustes — ou jogue sem relógio.'
                : `O relógio ${this.flagged === 'w' ? 'das brancas' : 'das pretas'} chegou a zero.`;
            document.getElementById('resultAgain').focus();
            return;
        }
        const mate = st.reason === 'xeque-mate';
        const won = mate && this.mode === 'cpu' && this.game.side !== this.player;
        const lost = mate && this.mode === 'cpu' && this.game.side === this.player;
        document.getElementById('resultOverlay').hidden = false;
        document.getElementById('resultOverlay').dataset.outcome = won ? 'win' : lost ? 'loss' : mate ? 'mate' : 'draw';
        document.getElementById('resultKicker').innerHTML = `<i></i> ${mate ? 'Xeque-mate' : 'Empate'}`;
        document.getElementById('resultTitle').textContent = won ? 'Você venceu!' : lost ? 'A máquina venceu' : mate ? (this.game.side === 'b' ? 'Brancas vencem' : 'Pretas vencem') : 'Empate';
        document.getElementById('resultText').textContent = mate
            ? `${won ? 'O rei preto' : lost ? 'Seu rei' : 'O rei'} ficou em xeque sem ter para onde fugir.${lost ? ' Tente o nível fácil ou peça uma Dica.' : ''}`
            : DRAW_WHY[st.reason] || this.endLine(st);
        document.getElementById('resultAgain').focus();
    }

    /** Estado da partida, incluindo queda de bandeira (tempo). */
    gameStatus() {
        if (this.flagged) {
            const other = this.flagged === 'w' ? 'b' : 'w';
            const draw = !this.canMate(other);
            return {
                over: true,
                result: draw ? '½-½' : (other === 'w' ? '1-0' : '0-1'),
                reason: 'tempo', check: false, moves: []
            };
        }
        return this.game.status();
    }

    /** Material com que ainda é possível dar mate (FIDE 6.9, simplificado). */
    canMate(color) {
        let minors = 0;
        for (const p of this.game.board) {
            if (!p || p.c !== color || p.t === 'k') continue;
            if (p.t === 'n' || p.t === 'b') minors += 1;
            else return true;
        }
        return minors >= 2;
    }

    clockApplies() {
        return this.mode === 'cpu' || this.mode === 'local';
    }

    setupClock() {
        const cfg = this.clockApplies() ? CLOCKS[this.settings.clock] : null;
        clearInterval(this.clockTimer);
        this.clockTimer = null;
        this.clock = cfg ? { w: cfg.base, b: cfg.base, inc: cfg.inc, base: cfg.base, started: false, last: performance.now() } : null;
        document.body.dataset.clock = this.clock ? 'on' : 'off';
        this.renderClock();
    }

    /** Desconta o tempo corrido de quem tem a vez (chamado antes de mudar de estado). */
    tickClock() {
        const c = this.clock;
        if (!c) return;
        const t = performance.now();
        const running = c.started && !this.flagged && document.body.dataset.state === 'play' && !document.hidden && !this.game.status().over;
        if (running) {
            const side = this.game.side;
            c[side] = Math.max(0, c[side] - (t - c.last));
            if (c[side] <= 0) this.flag(side);
        }
        c.last = t;
    }

    resumeClock() {
        if (!this.clock) return;
        this.clock.last = performance.now();
        if (!this.clockTimer) {
            this.clockTimer = setInterval(() => { this.tickClock(); this.renderClock(); }, 200);
        }
        this.renderClock();
    }

    stopClock() {
        this.tickClock();
        clearInterval(this.clockTimer);
        this.clockTimer = null;
        this.renderClock();
    }

    /** Depois do lance: incremento para quem jogou; o 1º lance das brancas liga o relógio. */
    pressClock(mover) {
        const c = this.clock;
        if (!c || this.flagged) return;
        if (c.started) c[mover] += c.inc;
        c.started = true;
        c.last = performance.now();
        this.resumeClock();
    }

    flag(side) {
        if (this.flagged) return;
        this.flagged = side;
        clearInterval(this.clockTimer);
        this.clockTimer = null;
        this.cancelWork();
        this.selected = -1;
        this.legal = [];
        this.refreshMarks();
        this.audio.check();
        this.renderHud();
        this.saveGame();
        this.showResult(this.gameStatus());
    }

    renderClock() {
        const box = document.getElementById('clocks');
        if (!box) return;
        box.hidden = !this.clock;
        if (!this.clock) return;
        const fmt = (ms) => {
            const s = Math.ceil(ms / 1000);
            if (ms < 10e3) return (Math.max(0, ms) / 1000).toFixed(1);
            return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
        };
        const over = this.flagged || this.game.status().over;
        for (const side of ['w', 'b']) {
            const el = box.querySelector(`[data-side="${side}"]`);
            if (!el) continue;
            const ms = this.clock[side];
            el.querySelector('b').textContent = fmt(ms);
            el.classList.toggle('is-active', !over && this.game.side === side && this.clock.started);
            el.classList.toggle('is-low', ms < 20e3);
            el.querySelector('span').textContent = this.mode === 'cpu'
                ? (side === this.player ? 'Você' : 'Máquina')
                : (side === 'w' ? 'Brancas' : 'Pretas');
        }
    }

    /** Guarda a partida (só modos de partida). Falha de storage é ignorada. */
    saveGame() {
        if (!this.started || !['cpu', 'local', 'free'].includes(this.mode)) return;
        try {
            if (!this.game.stack.length) { localStorage.removeItem(SAVE_KEY); return; }
            const moves = this.game.stack.map((u) => [u.from, u.to, u.promo || '']);
            this.tickClock();
            localStorage.setItem(SAVE_KEY, JSON.stringify({
                v: 1, mode: this.mode, level: this.level, moves,
                clock: this.clock ? { w: this.clock.w, b: this.clock.b, inc: this.clock.inc, base: this.clock.base, started: this.clock.started } : null,
                flagged: this.flagged, at: Date.now()
            }));
        } catch { /* modo privado ou cota cheia: segue sem salvar */ }
    }

    /** Reconstrói a partida salva lance a lance (só lances legais entram). */
    restoreGame() {
        let data;
        try { data = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch { data = null; }
        if (!data || data.v !== 1 || !Array.isArray(data.moves) || !data.moves.length) return;
        if (!['cpu', 'local', 'free'].includes(data.mode)) return;
        const g = new Chess();
        const history = [];
        for (const [from, to, promo] of data.moves) {
            const m = g.findMove(from, to, promo || 'q');
            if (!m) break;
            history.push({ san: g.san(m), color: g.side });
            g.play(m);
        }
        if (!history.length) return;
        this.mode = data.mode;
        this.level = LEVEL_LABEL[data.level] ? data.level : this.level;
        this.game = g;
        this.history = history;
        this.flagged = data.flagged === 'w' || data.flagged === 'b' ? data.flagged : null;
        this.clock = data.clock && Number.isFinite(data.clock.w) && Number.isFinite(data.clock.b)
            ? { ...data.clock, last: performance.now() } : null;
        document.body.dataset.clock = this.clock ? 'on' : 'off';
        document.body.dataset.mode = this.mode;
        ['modePlay', 'modeAcademy', 'modePuzzles'].forEach((id) => document.getElementById(id)?.setAttribute('aria-pressed', String(id === 'modePlay')));
        const modeSelect = document.getElementById('modeSelect');
        if (modeSelect) modeSelect.value = this.mode;
        const levelSelect = document.getElementById('levelSelect');
        if (levelSelect) levelSelect.value = this.level;
        this.rebuildPieces();
        this.renderHud();
        this.speakMode();
        const resume = document.getElementById('resumeButton');
        resume.hidden = false;
        resume.firstChild.textContent = `Continuar partida (${Math.ceil(history.length / 2)}º lance) `;
        document.getElementById('startLabel').textContent = 'Nova partida';
    }

    frame(dt) {
        if (this.cameraTransition) {
            const c = this.cameraTransition;
            c.t += dt;
            const t = this.reducedMotion ? 1 : Math.min(1, c.t / 0.55);
            const k = easeInOut(t);
            [this.camera.alpha, this.camera.beta, this.camera.radius] = c.from.map((v, i) => v + (c.to[i] - v) * k);
            if (t === 1) this.cameraTransition = null;
        }
        if (this.postProcess.pipe.depthOfFieldEnabled) this.postProcess.pipe.depthOfField.focusDistance = this.camera.radius * 1000;
        if (this.anims.length) this.lights.shadowGen.getShadowMap().resetRefreshCounter();
        for (let i = this.anims.length - 1; i >= 0; i--) {
            const a = this.anims[i];
            a.t += dt;
            const k = Math.min(1, a.t / a.dur);
            a.fn(k);
            if (k >= 1) {
                a.resolve();
                this.anims.splice(i, 1);
            }
        }
        // Sombra de contato acompanha a altura de cada peça (lance, arraste).
        for (const mesh of this.pieces.values()) this.factory.syncContact(mesh);
        if (!this.reducedMotion && this.world?.marks?.check?.isVisible) {
            const mat = this.world.marks.check.material;
            if (mat) mat.alpha = 0.55 + Math.sin(Date.now() * 0.006) * 0.35;
        }
    }
}

try {
    new Atelier();
} catch (err) {
    console.error(err);
    const overlay = document.getElementById('errorOverlay');
    const load = document.getElementById('loadingOverlay');
    if (load) load.hidden = true;
    if (overlay) overlay.hidden = false;
}
