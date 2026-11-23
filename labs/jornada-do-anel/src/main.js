/**
 * A Jornada do Anel — laço principal, capítulos e câmera de terceira pessoa.
 *
 * O palco (`gfx/stage.js`) cuida de renderer, céu físico, sol com sombra, pós
 * (AO, bloom, névoa de altura, raios, grade de cor) e resolução dinâmica; cada
 * capítulo troca a atmosfera com `stage.setPreset` e monta o próprio mundo.
 *
 * Câmera: `camera.js` (pivô suavizado, recentralização, colisão com chão,
 * colisores e a caixa das minas). Movimento e pulo: `player.js` + config.js.
 *
 * Nunca prender (regras de saída):
 *   carregamento     cada espera (texturas, modelos, impostores, aquecimento)
 *                    tem prazo (LOAD_TIMEOUT); falha ao montar → volta ao mapa
 *   queda/fora       −1 coração e volta ao último chão firme (trilha de 8 pontos)
 *   preso            pedindo movimento sem sair do lugar por 4 s → aviso;
 *                    8 s → volta ao caminho sozinho (também na pausa)
 *   pausa            Continuar · Recomeçar capítulo · Voltar ao caminho ·
 *                    Pular capítulo · Voltar ao mapa
 *   aba oculta/blur  pausa e solta todas as teclas
 *   progresso        salvo ao entrar em cada capítulo; o menu oferece "Continuar"
 *
 * Modo infantil (regras de perdão):
 *   vida            5 corações (invulnerável 1,4 s depois de cada golpe)
 *   cavaleiros      ao alcançar o portador perdem o rastro por 4 s (actors.js)
 *   queda na fenda  −1 coração e volta ao último chão firme (só derrota sem corações)
 *   derrota         "Tentar de novo" recomeça o capítulo com as páginas e a glória
 *                   que o portador tinha ao entrar nele
 *   dica            30 s sem progresso → repete a dica do capítulo
 *   bússola         seta no HUD aponta para o objetivo do capítulo (guide.js)
 */

import * as THREE from 'three';
import { createStage, PRESETS } from '../../shared/gfx/stage.js?v=18';
import { pickTier } from '../../shared/gfx/core.js';
import { preload } from '../../shared/gfx/assets.js';
import { CHAPTERS, ATMOSPHERES, STORAGE_KEY, CAMERA, LOAD_TIMEOUT } from './config.js?v=32';
import { clamp, lerp, formatTime, wait, withTimeout } from './utils.js?v=32';
import { CameraRig } from './camera.js?v=32';
import { Input } from './input.js?v=32';
import { GameAudio } from './audio.js?v=32';
import { Hud, statsBlock } from './hud.js?v=32';
import { Player } from './player.js?v=32';
import { nearestInteractable } from './actors.js?v=32';
import { buildChapter } from './chapters.js?v=32';
import { Guide } from '../../shared/gfx/guide.js?v=1';

Object.assign(PRESETS, ATMOSPHERES);

const LOOK = new THREE.Vector3();
const CAM = new THREE.Vector3();
const TMP = new THREE.Vector3();
const DEBUG = new URLSearchParams(location.search).has('debug');

class Game {
    constructor() {
        this.hud = new Hud();
        this.canvas = document.getElementById('scene');
        this.settings = this.loadSettings();
        this.state = 'loading';
        this.chapterIndex = 0;
        this.time = 0;
        this.elapsed = 0;
        this.pages = 0;
        this.score = 0;
        this.caught = 0;
        this.kills = 0;
        this.introT = 0;
        this.fade = 1;
        this.fadeDir = -1;
        this.dialogue = null;
        this.hudAccum = 0;
        this.fpsAccum = 0;
        this.orbit = 0.6;
        this.pendingChapter = 0;
        this.loadToken = 0;
        /** trilha de chão firme (mais recente no fim) para respawn de queda/preso */
        this.trail = [];
        this.stuck = { x: 0, z: 0, t: 0, warned: false };
        this.loopError = false;
        this.fadeEl = document.getElementById('fade');
        this.lastFade = -1;
        this.guide = new Guide(document.getElementById('guide'));
        this.skipEl = document.getElementById('skipButton');
        this.hintT = 0;
        /** Último chão firme (para a queda na fenda não ser derrota direta). */
        this.safe = { x: 0, z: 0, t: 0 };
        /** Progresso ao entrar no capítulo (o "Tentar de novo" volta para cá). */
        this.checkpoint = { pages: 0, score: 0, kills: 0, caught: 0, elapsed: 0 };
    }

    loadSettings() {
        const fallback = {
            quality: 'auto',
            volume: 70,
            muted: false,
            best: 0,
            unlocked: 0,
            /** progresso ao entrar no último capítulo jogado (menu → "Continuar") */
            saved: null
        };
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
        } catch (err) {
            return fallback;
        }
    }

    saveSettings() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
        } catch (err) { /* privado */ }
    }


    /** Tier pedido no menu ('auto' deixa o kit decidir pelo aparelho). */
    wantedTier() {
        return pickTier(this.settings.quality);
    }

    async init() {
        this.hud.setLoading(0.06, 'Acendendo as lanternas…');
        const manager = new THREE.LoadingManager();
        manager.onProgress = (url, done, total) => {
            if (this.state === 'loading') this.hud.setLoading(0.1 + 0.8 * (done / Math.max(1, total)));
        };
        const stage = createStage({
            canvas: this.canvas, tier: this.settings.quality, preset: CHAPTERS[0].atmosphere, fov: 52, near: 0.15,
            loadingManager: manager
        });
        if (!stage) {
            this.hud.showError('Não foi possível criar o contexto WebGL 2.');
            return;
        }
        this.stage = stage;
        this.scene = stage.scene;
        this.camera = stage.camera;
        this.renderer = stage.renderer;
        this.mobile = matchMedia('(pointer: coarse)').matches;
        this.hud.setTouch(this.mobile);
        stage.pipeline.params.fade = 1;
        // o palco rebaixou o tier por desempenho: alivia a grama do capítulo atual
        stage.onTier((tier) => this.world?.grass?.setDensity(tier === 'low' ? 0.45 : 0.75));

        this.input = new Input(this.canvas);
        this.audio = new GameAudio();
        this.player = new Player(this.scene);
        this.player.root.visible = false;
        this.rig = new CameraRig(this.camera);
        this._bindUi();

        preload({ models: ['antique_estoc', 'wooden_lantern_01'] });
        stage.start((dt) => this._safeUpdate(dt));
        await withTimeout(this.player.equip({ drawn: false }), 8000);
        const ok = await this._loadChapter(0, { menu: true });
        if (ok === null) {
            this.hud.showError('O cenário não pôde ser montado. Recarregue a página.');
            return;
        }
        this.hud.setLoading(1, 'A estrada espera.');
        this.hud.hideLoading();
        // menu já aponta para onde a jornada parou
        const saved = this.settings.saved;
        if (saved && saved.chapter > 0 && saved.chapter <= this.settings.unlocked) this.pendingChapter = saved.chapter;

        this.hud.el.qualitySelect.value = this.settings.quality;
        this.hud.el.volumeSlider.value = String(this.settings.volume);
        this.hud.setVolumeLabel(this.settings.volume);
        this.hud.setBest(this.settings.best);
        this.hud.setMuted(this.settings.muted);
        this._refreshChapterList();
        this.hud.showMenu(true);
        this.state = 'menu';
        this.hud.setState('menu');
        if (DEBUG) this._debugHooks();
    }

    _refreshChapterList() {
        this.hud.fillChapters(this.settings.unlocked, CHAPTERS[this.pendingChapter].id, (i) => {
            this.pendingChapter = i;
            this._refreshChapterList();
        });
        this.hud.setStartLabel(this._canContinue() ? `Continuar · ${CHAPTERS[this.pendingChapter].roman}` : 'Jogar');
    }

    /** O capítulo escolhido é o salvo (e não o primeiro)? Então "Continuar" restaura o progresso. */
    _canContinue() {
        const s = this.settings.saved;
        return Boolean(s && s.chapter > 0 && s.chapter === this.pendingChapter);
    }

    _bindUi() {
        this.hud.el.qualitySelect.addEventListener('change', () => {
            this.settings.quality = this.hud.el.qualitySelect.value;
            this.saveSettings();
        });
        this.hud.el.volumeSlider.addEventListener('input', () => {
            this.settings.volume = Number(this.hud.el.volumeSlider.value);
            this.hud.setVolumeLabel(this.settings.volume);
            this.audio.setVolume(this.settings.volume / 100);
            this.saveSettings();
        });
        document.getElementById('startButton').addEventListener('click', () => this.start(this.pendingChapter, { resume: this._canContinue() }));
        document.getElementById('resumeButton').addEventListener('click', () => this.resume());
        document.getElementById('restartButton')?.addEventListener('click', () => this.restartChapter());
        document.getElementById('unstuckButton')?.addEventListener('click', () => {
            this.resume();
            this._unstick('Você voltou para o caminho.');
        });
        document.getElementById('skipChapterButton')?.addEventListener('click', () => this.skipChapter());
        document.getElementById('errorReload')?.addEventListener('click', () => location.reload());
        document.getElementById('pauseMenuButton').addEventListener('click', () => this.toMenu());
        document.getElementById('retryButton').addEventListener('click', () => this.retry());
        document.getElementById('defeatMenuButton').addEventListener('click', () => this.toMenu());
        document.getElementById('replayButton').addEventListener('click', () => this.start(0));
        document.getElementById('victoryMenuButton').addEventListener('click', () => this.toMenu());
        document.getElementById('dialogueContinue').addEventListener('click', (e) => {
            e.stopPropagation();
            this._advanceDialogue();
        });
        // tocar em qualquer lugar do diálogo também avança (criança não acha o botão)
        this.hud.el.dialogue.addEventListener('click', () => this._advanceDialogue());
        // o aviso "E …" é um botão: tocar nele interage
        this.hud.el.prompt.addEventListener('click', () => {
            if (this.state === 'playing') this.input.interactPressed = true;
        });
        this.skipEl?.addEventListener('click', () => this._skip());
        // aba oculta: o palco já para de desenhar; o jogo pausa para não voltar no meio de um perigo
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.input.release();
                if (this.state === 'playing') this.pause();
            }
        });
        // janela perdeu o foco (alt-tab, notificação): pausa e solta teclas presas
        window.addEventListener('blur', () => {
            this.input.release();
            if (this.state === 'playing') this.pause();
        });
        // Esc solta o mouse sem chegar como tecla: soltar o mouse jogando abre a pausa
        document.addEventListener('pointerlockchange', () => {
            if (!document.pointerLockElement && this.state === 'playing' && !this.mobile) this.pause();
        });
        this.hud.el.soundButton.addEventListener('click', () => this.toggleMute());
        this.hud.el.pauseButton.addEventListener('click', () => this.pause());

        this.input.on('pause', () => {
            if (this.state === 'playing') this.pause();
            else if (this.state === 'pause') this.resume();
        });
        this.input.on('camera', () => {
            const dists = CAMERA.presets;
            const i = dists.findIndex((d) => Math.abs(this.player.camDist - d) < 0.3);
            this.player.camDist = dists[(i + 1) % dists.length];
        });
        this.input.on('mute', () => this.toggleMute());
        this.input.on('confirm', () => {
            if (this.state === 'dialogue') this._advanceDialogue();
        });
        this.input.on('pointerdown', () => {
            if (this.state === 'playing') this.input.requestLock();
            if (this.state === 'dialogue') this._advanceDialogue();
        });

        this._bindTouch();
    }

    _bindTouch() {
        const stick = document.getElementById('moveStick');
        const knob = document.getElementById('moveKnob');
        if (!stick) return;
        const setFrom = (clientX, clientY) => {
            const r = stick.getBoundingClientRect();
            const cx = r.left + r.width / 2;
            const cy = r.top + r.height / 2;
            let dx = (clientX - cx) / (r.width * 0.42);
            let dy = (clientY - cy) / (r.height * 0.42);
            const len = Math.hypot(dx, dy) || 1;
            if (len > 1) {
                dx /= len;
                dy /= len;
            }
            this.input.touchMove.x = dx;
            this.input.touchMove.y = -dy;
            knob.style.transform = `translate(${dx * 22}px, ${dy * 22}px)`;
        };
        const capturePointer = (el, pointerId) => {
            try {
                el.setPointerCapture(pointerId);
            } catch (err) {
                /* Ponteiro encerrado antes do handler: segue sem captura. */
            }
        };

        /* A captura de ponteiro é best-effort: setPointerCapture lança
           InvalidStateError quando o ponteiro já terminou, e a exceção
           derrubava o gesto. O id guardado mantém o arrasto funcionando. */
        let stickId = null;

        const end = () => {
            stickId = null;
            this.input.touchMove.x = 0;
            this.input.touchMove.y = 0;
            knob.style.transform = 'translate(0,0)';
        };
        stick.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            stickId = e.pointerId;
            capturePointer(stick, e.pointerId);
            setFrom(e.clientX, e.clientY);
        }, { passive: false });
        stick.addEventListener('pointermove', (e) => {
            if (stickId === e.pointerId) setFrom(e.clientX, e.clientY);
        });
        stick.addEventListener('pointerup', end);
        stick.addEventListener('pointercancel', end);
        stick.addEventListener('lostpointercapture', end);
        // pausa/blur soltam tudo: o pino volta ao centro
        this.input.on('released', end);

        const lookZone = document.getElementById('lookZone');
        let lookId = null;
        let lx = 0;
        let ly = 0;
        lookZone?.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            lookId = e.pointerId;
            capturePointer(lookZone, e.pointerId);
            lx = e.clientX;
            ly = e.clientY;
        }, { passive: false });
        lookZone?.addEventListener('pointermove', (e) => {
            if (lookId !== e.pointerId) return;
            // o toque gira mais por pixel que o mouse travado (tela pequena)
            const k = CAMERA.touchSens / CAMERA.mouseSens;
            this.input.lookX += (e.clientX - lx) * k;
            this.input.lookY += (e.clientY - ly) * k;
            lx = e.clientX;
            ly = e.clientY;
        });
        const endLook = () => {
            lookId = null;
        };
        lookZone?.addEventListener('pointerup', endLook);
        lookZone?.addEventListener('pointercancel', endLook);

        // pular: segurar = pulo alto, toque rápido = pulinho (pointer, não click: resposta imediata)
        const jump = document.getElementById('btnJump');
        const jumpUp = () => {
            this.input.touchJump = false;
            jump?.classList.remove('is-down');
        };
        jump?.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            capturePointer(jump, e.pointerId);
            jump.classList.add('is-down');
            if (this.state === 'dialogue') {
                this._advanceDialogue();
                return;
            }
            this.input.touchJump = true;
            this.input.jumpPressed = true;
        }, { passive: false });
        jump?.addEventListener('pointerup', jumpUp);
        jump?.addEventListener('pointercancel', jumpUp);
        jump?.addEventListener('lostpointercapture', jumpUp);
        this.input.on('released', jumpUp);

        document.getElementById('btnInteract')?.addEventListener('click', () => {
            if (this.state === 'dialogue') this._advanceDialogue();
            else this.input.interactPressed = true;
        });
        document.getElementById('btnAttack')?.addEventListener('click', () => {
            this.input.attackPressed = true;
        });
        const sprint = document.getElementById('btnSprint');
        const setSprint = (v) => {
            this.input.touchSprint = v;
            sprint?.setAttribute('aria-pressed', v ? 'true' : 'false');
        };
        // alterna: no toque é difícil segurar o botão e mexer o analógico ao mesmo tempo
        sprint?.addEventListener('click', () => setSprint(!this.input.touchSprint));
    }

    /**
     * Troca o mundo: descarta o capítulo anterior, monta o novo, aplica a
     * atmosfera e espera texturas, modelos e impostores (o laço segue rodando,
     * então a floresta assa os impostores enquanto a tela está em fade).
     * Cada espera tem prazo: o capítulo abre com o que chegou (o resto aparece
     * depois). Devolve true (pronto), false (carga obsoleta) ou null (falhou).
     */
    async _loadChapter(index, { menu = false } = {}) {
        const token = ++this.loadToken;
        const ch = CHAPTERS[index];
        this.chapterIndex = index;
        this.chapter = ch;
        const stage = this.stage;

        if (this.world) {
            const old = this.world;
            this.world = null;
            try {
                old.dispose();
            } catch (err) { console.warn('[jornada] descarte do capítulo', err); }
        }
        let world;
        try {
            if (stage.tier !== this.wantedTier() && !stage.software) stage.setTier(this.wantedTier());
            stage.setPreset(ch.atmosphere);
            stage.sun.castShadow = PRESETS[ch.atmosphere].sun > 0;
            world = buildChapter(ch.id, { stage, tier: stage.tier });
            world.tramplers.push(this.player.trample);
            this.scene.add(world.group);
            stage.follow(world.terrain || { heightAt: world.heightAt, bounds: { minY: world.fogBase ?? 0 } });
            world.applyAtmosphere?.(stage);
        } catch (err) {
            console.error('[jornada] falha ao montar', ch.id, err);
            return null;
        }
        this.audio.setTheme(ch.music);
        // câmera já no lugar para a grama e a floresta gerarem o que vai aparecer
        if (menu) {
            this.player.root.visible = false;
            this._menuCam(world);
        } else {
            const s = world.spawn;
            this.player.spawn(s.x, s.z, s.yaw, world.heightAt);
            this.player.setHasRing(index > 0);
            this.world = world;
            this.rig.snap(this.player);
            this.rig.update(1 / 60, this.player, world);
        }
        this.world = world;
        this.trail.length = 0;
        await withTimeout(Promise.all([world.ready(), this.player.equip(world.gear || {})]), LOAD_TIMEOUT);
        if (token !== this.loadToken) return false;
        await withTimeout(stage.warmup(), 6000);
        return true;
    }

    /**
     * Começa a jornada num capítulo. `resume`: restaura páginas/glória/tempo
     * salvos ao entrar nele (menu "Continuar"); senão começa do zero.
     */
    async start(index = 0, { resume = false } = {}) {
        if (this.busy) return;
        this.busy = true;
        try {
            await withTimeout(this.audio.unlock(), 1500);
            this.audio.setVolume(this.settings.volume / 100);
            this.audio.setMuted(this.settings.muted);

            this.pendingChapter = index;
            const saved = resume ? this.settings.saved : null;
            this.elapsed = saved?.elapsed ?? 0;
            this.pages = saved?.pages ?? 0;
            this.score = saved?.score ?? 0;
            this.caught = saved?.caught ?? 0;
            this.kills = saved?.kills ?? 0;
            this.player.hasRing = index > 0;
            this.player.maxHealth = 5;
            this.hud.hideDefeat();
            this.hud.hideVictory();
            this.hud.showMenu(false);
            this.hud.hideDialogue();
            this.hud.showPause(false);
            this.hud.showHud(false);

            await this._travel(index);
        } finally {
            this.busy = false;
        }
    }

    /** Derrota → recomeça o capítulo atual com o progresso que havia ao entrar nele. */
    async retry() {
        if (this.busy) return;
        this.busy = true;
        try {
            Object.assign(this, this.checkpoint);
            this.hud.hideDefeat();
            this.hud.showHud(false);
            await this._travel(this.chapterIndex);
        } finally {
            this.busy = false;
        }
    }

    /** Pausa → "Recomeçar capítulo": mesmo efeito do "Tentar de novo". */
    restartChapter() {
        if (this.state !== 'pause') return;
        this.hud.showPause(false);
        this.state = 'transition';
        this.retry();
    }

    /**
     * Pausa → "Pular capítulo": válvula de escape para quem empacou. Abre o
     * próximo capítulo (sem a glória de concluir); no último, encerra a jornada.
     */
    skipChapter() {
        if (this.state !== 'pause') return;
        this.hud.showPause(false);
        this.state = 'playing';
        this._completeChapter(200, { skipped: true });
    }

    /** Botão "Pular": encerra a abertura do capítulo. */
    _skip() {
        if (this.state === 'intro') this.introT = 99;
    }

    /** Fade para preto → carrega → abertura do capítulo. Falha ao montar → volta ao mapa. */
    async _travel(index) {
        this.state = 'transition';
        this.hud.setState('transition');
        this.input.enabled = false;
        this.input.release();
        this.input.exitLock();
        this.guide.hide();
        this.fadeDir = 1;
        this.hud.setTravel(CHAPTERS[index]);
        await wait(Math.max(60, (1 - this.fade) * 900));
        this.fade = 1;
        const ok = await this._loadChapter(index);
        this.hud.setTravel(null);
        if (ok === false) return; // outra carga assumiu
        if (ok === null) {
            this.busy = false;
            await this.toMenu(`Não foi possível abrir “${CHAPTERS[index].title}”. Tente de novo ou escolha outro capítulo.`);
            return;
        }
        this._beginIntro();
    }

    _beginIntro() {
        this.state = 'intro';
        this.hud.setState('intro');
        this.introT = 0;
        this.checkpoint = { pages: this.pages, score: this.score, kills: this.kills, caught: this.caught, elapsed: this.elapsed };
        // salva onde a jornada está: o menu oferece "Continuar" daqui
        this.settings.saved = { chapter: this.chapterIndex, ...this.checkpoint };
        this.settings.unlocked = Math.max(this.settings.unlocked, this.chapterIndex);
        this.saveSettings();
        this.hintT = 0;
        this.trail.length = 0;
        this._markSafe(true);
        this.stuck.t = 0;
        this.stuck.warned = false;
        if (this.skipEl) this.skipEl.hidden = false;
        this.player.root.visible = true;
        this.hud.showHud(true);
        this.hud.setTouchVisible(this.mobile);
        this.hud.setChapter(this.chapter);
        this.hud.setHearts(this.player.health, this.player.maxHealth);
        this.hud.setRing(this.player.hasRing);
        this.hud.setPages(this.pages, CHAPTERS.length);
        this.hud.setStealth(0);
        this.hud.setPrompt('');
        this.hud.showChapterCard(this.chapter);
        this.hud.say(this.chapter.objective, 5);
        this.input.enabled = false;
        this.fade = 1;
        this.fadeDir = -1;
    }

    pause() {
        if (this.state !== 'playing') return;
        this.guide.hide();
        this.state = 'pause';
        this.hud.setState('pause');
        this.hud.showPause(true);
        this.input.release();
        this.input.exitLock();
        // o teclado segue ligado para P/Esc tirarem da pausa (o mundo não anda em 'pause')
    }

    resume() {
        if (this.state !== 'pause') return;
        this.state = 'playing';
        this.hud.setState('playing');
        this.hud.showPause(false);
        this.input.enabled = true;
        this.input.release();
        if (!this.mobile) this.input.requestLock();
    }

    /** Volta ao menu (opcional: aviso no rodapé do cartão do menu). */
    async toMenu(notice = '') {
        if (this.busy) return;
        this.busy = true;
        try {
            this.hud.showPause(false);
            this.hud.hideDefeat();
            this.hud.hideVictory();
            this.hud.hideDialogue();
            this.hud.showHud(false);
            this.hud.setTravel(null);
            this.input.exitLock();
            this.input.release();
            this.dialogue = null;
            this.state = 'transition';
            this.hud.setState('transition');
            this.fadeDir = 1;
            await wait(700);
            this.fade = 1;
            this.player.root.visible = false;
            const ok = await this._loadChapter(0, { menu: true });
            if (ok === null && !this.world) {
                this.hud.showError('O cenário não pôde ser montado. Recarregue a página.');
                return;
            }
            this.input.enabled = true;
            const saved = this.settings.saved;
            this.pendingChapter = saved && saved.chapter <= this.settings.unlocked ? saved.chapter : Math.min(this.pendingChapter, this.settings.unlocked);
            this._refreshChapterList();
            this.hud.showMenu(true);
            if (notice) this.hud.setMenuNotice(notice);
            this.state = 'menu';
            this.hud.setState('menu');
            this.fadeDir = -1;
        } finally {
            this.busy = false;
        }
    }

    toggleMute() {
        this.settings.muted = !this.settings.muted;
        this.audio.setMuted(this.settings.muted);
        this.hud.setMuted(this.settings.muted);
        this.saveSettings();
    }

    /** Laço protegido: um erro num quadro não derruba o jogo — pausa e deixa recomeçar. */
    _safeUpdate(dt) {
        try {
            this._update(dt);
        } catch (err) {
            if (!this.loopError) {
                this.loopError = true;
                console.error('[jornada] erro no quadro', err);
            }
            if (this.state === 'playing') this.pause();
        }
    }

    _update(dt) {
        // dt já vem limitado pelo palco; o jogo limita de novo a 1/20 s (física estável)
        dt = Math.min(dt, 0.05);
        this.time += dt;
        this.hud.tick(dt);
        this.audio.update(dt);

        this.fade = clamp(this.fade + this.fadeDir * dt * 1.1, 0, 1);
        if (this.fade !== this.lastFade) {
            this.lastFade = this.fade;
            this.fadeEl.style.opacity = String(this.fade);
        }
        this.fpsAccum += dt;
        if (this.fpsAccum >= 0.5) {
            this.fpsAccum = 0;
            this.hud.setFps(Math.round(this.stage.fps));
        }

        const world = this.world;
        if (!world) return;
        const frozen = this.state === 'pause';
        if (!frozen) world.tick(dt, this.time, this.camera, this.player);

        if (this.state === 'menu' || this.state === 'loading') {
            this.orbit += dt * 0.05;
            this._menuCam(world);
            return;
        }
        if (this.state === 'intro') {
            this.player.animate(dt, 0);
            this._updateIntro(dt);
            return;
        }
        if (this.state === 'transition') {
            if (this.player.root.visible) {
                this.player.animate(dt, 0);
                this._followCamera(dt);
            } else this._menuCam(world);
            return;
        }
        if (this.state === 'dialogue') {
            // E, Espaço, J ou clique avançam a fala
            if (this.input.consumeInteract() | this.input.consumeAttack() | this.input.consumeJump()) this._advanceDialogue();
        }
        if (this.state === 'dialogue' || this.state === 'defeat' || this.state === 'victory' || this.state === 'scene') {
            this.player.animate(dt, 0);
            if (this.state === 'scene' || this.state === 'victory') this.player.camYaw += dt * 0.22;
            this._followCamera(dt);
            return;
        }
        if (frozen) return;
        if (this.state !== 'playing') return;

        this.elapsed += dt;
        this.hudAccum += dt;
        if (this.hudAccum > 0.2) {
            this.hud.setTime(this.elapsed);
            this.hudAccum = 0;
        }

        this.rig.look(this.player, this.input, this.time);
        const info = this.player.update(dt, this.input, world);
        if (info.footstep || info.land) this.audio.footstep();
        if (info.strike) {
            const hits = this.player.attackHit(world.goblins);
            for (const g of hits) {
                this.audio.hit();
                if (g.hit(this.player.x, this.player.z)) {
                    this.kills += 1;
                    this.score += 40;
                }
            }
        }
        this.rig.recenter(this.player, dt, this.time);

        this._updateNpcs(dt);
        if (this.state !== 'playing') return; // derrota neste quadro
        this._updateInteract();
        this._checkHazards(dt);
        this._followCamera(dt);
        this._updateGuide(dt);
    }

    /**
     * Bússola + dica: a seta aponta para o objetivo do capítulo (some quando o aviso "E" aparece).
     * Sem chegar perto do objetivo por 30 s, a dica do capítulo volta à tela.
     */
    _updateGuide(dt) {
        // 10 Hz bastam (a seta tem transição no CSS) e poupam a busca do alvo a cada quadro
        this.guideAcc = (this.guideAcc || 0) + dt;
        if (this.guideAcc < 0.1) return;
        dt = this.guideAcc;
        this.guideAcc = 0;
        const world = this.world;
        const goal = world.goalItem || (world.goalItem = world.interactables.find((i) => i.id === world.goal));
        const target = goal && !goal.done ? goal : null;
        this.guide.update(this.camera, this.player.x, this.player.z, target ? { x: target.x, z: target.z, name: this.chapter.goalName, near: target.r + 0.4 } : null);
        if (!target) return;
        const d = Math.hypot(target.x - this.player.x, target.z - this.player.z);
        if (this.bestGoalD === undefined || d < this.bestGoalD - 3) {
            this.bestGoalD = d;
            this.hintT = 0;
        }
        this.hintT += dt;
        if (this.hintT > 30) {
            this.hintT = 0;
            this.hud.say(this.chapter.hint, 5);
        }
    }

    /** Câmera do menu: órbita lenta em volta do ponto de interesse do capítulo, sem entrar no relevo. */
    _menuCam(world) {
        const o = world.overview;
        const l = world.overviewLook;
        const r = Math.hypot(o.x, o.z);
        const a = this.orbit + Math.atan2(o.x, o.z);
        const x = l.x + Math.sin(a) * r;
        const z = l.z + Math.cos(a) * r;
        this.camera.position.set(x, Math.max(l.y + o.y, world.heightAt(x, z) + 2.4), z);
        this.camera.lookAt(l);
    }

    /** Abertura: voo da vista do capítulo até a câmera de jogo (3,6 s, suavizado). */
    _updateIntro(dt) {
        this.introT += dt;
        const world = this.world;
        const t = clamp(this.introT / 3.6, 0, 1);
        const e = t * t * (3 - 2 * t);
        const o = world.overview;
        const l = world.overviewLook;
        // posição final = câmera de jogo já com colisão
        this.rig.snap(this.player);
        this.rig.update(dt, this.player, world);
        CAM.copy(this.camera.position);
        LOOK.copy(this.rig.pivot);
        const ox = l.x + o.x;
        const oz = l.z + o.z;
        const oy = Math.max(l.y + o.y, world.heightAt(ox, oz) + 2.4);
        this.camera.position.set(lerp(ox, CAM.x, e), lerp(oy, CAM.y, e), lerp(oz, CAM.z, e));
        TMP.set(lerp(l.x, LOOK.x, e), lerp(l.y, LOOK.y, e), lerp(l.z, LOOK.z, e));
        this.camera.lookAt(TMP);
        if (t >= 1) {
            this.state = 'playing';
            this.hud.setState('playing');
            this.input.enabled = true;
            this.input.consumeAttack();
            this.input.consumeInteract();
            this.input.consumeJump();
            this.bestGoalD = undefined;
            if (this.skipEl) this.skipEl.hidden = true;
            this.hud.say(this.mobile ? 'Siga a seta dourada. Arraste a tela para olhar.' : 'Siga a seta dourada. Clique no mundo para olhar com o mouse.', 3.6);
        }
    }

    _followCamera(dt) {
        if (!this.world) return;
        this.rig.update(dt, this.player, this.world);
    }

    _updateNpcs(dt) {
        const world = this.world;
        let maxAlert = 0;
        for (const r of world.riders) {
            const ev = r.update(dt, this.player, world);
            maxAlert = Math.max(maxAlert, r.alert, ev === 'chase' ? 0.85 : 0);
            if (ev === 'caught') {
                if (this.player.hurt(1)) {
                    this.caught += 1;
                    this.audio.danger();
                    this.hud.flashHit();
                    this.hud.setHearts(this.player.health, this.player.maxHealth);
                    this.hud.say('Os Cavaleiros alcançaram você.', 3);
                    if (!this.player.alive) this._defeat('Os Cavaleiros levaram o portador.');
                    else {
                        // Empurra para longe do cavalo, sem atravessar árvore.
                        const nx = this.player.x + Math.sin(r.yaw) * 2.4;
                        const nz = this.player.z + Math.cos(r.yaw) * 2.4;
                        if (!world.blockedAt(nx, nz, 0.42)) {
                            this.player.x = nx;
                            this.player.z = nz;
                        }
                    }
                }
            } else if (ev === 'chase' && Math.random() < dt * 0.4) {
                this.audio.danger();
            }
        }
        this.hud.setStealth(world.riders.length ? maxAlert : 0);

        for (const g of world.goblins) {
            const ev = g.update(dt, this.player, world);
            if (ev === 'hit') {
                if (this.player.hurt(1)) {
                    this.audio.hit();
                    this.hud.flashHit();
                    this.hud.setHearts(this.player.health, this.player.maxHealth);
                    if (!this.player.alive) this._defeat('A escuridão das minas venceu.');
                }
            }
        }
    }

    _updateInteract() {
        // 0,6 s depois de fechar um diálogo o E é ignorado (criança aperta E repetido)
        if (performance.now() - (this.dialogClosedAt ?? -1e4) < 600) this.input.consumeInteract();
        const near = nearestInteractable(this.player, this.world.interactables);
        this.hud.setPrompt(near ? near.label : '');
        if (!this.input.consumeInteract() || !near) return;

        if (near.kind === 'talk') {
            this._openDialogue(near.speaker || 'Viajante', near.lines, near);
            return;
        }
        if (near.kind === 'page') {
            near.done = true;
            near.mesh.visible = false;
            this.pages += 1;
            this.score += 80;
            this.audio.pickup();
            this.hud.setPages(this.pages, CHAPTERS.length);
            this.hud.say('Uma página da crônica.', 2.5);
            return;
        }
        if (near.kind === 'ring') {
            near.done = true;
            near.mesh.visible = false;
            this.player.setHasRing(true);
            this.hud.setRing(true);
            this.score += 120;
            this.audio.pickup();
            this.hud.say('O Anel é seu. Não o use.', 4);
            this._completeChapter();
            return;
        }
        if (near.kind === 'goal') {
            near.done = true;
            this.audio.chime();
            this.score += 100;
            if (near.sit) {
                // cena final: o portador se senta e a câmera gira devagar
                this.player.x = near.sit.x;
                this.player.z = near.sit.z;
                this.player.y = near.sit.seatY - this.player.hero.seatHeight;
                this.player.yaw = this.player.facing = near.sit.yaw;
                this.player.setPose('sit');
                this.player.sync();
            }
            this._completeChapter(near.sit ? 3200 : 1400);
        }
    }

    _openDialogue(speaker, lines, item) {
        this.guide.hide();
        this.hintT = 0;
        this.dialogue = { speaker, lines: [...lines], item };
        this.state = 'dialogue';
        this.hud.setState('dialogue');
        this.hud.setPrompt('');
        this.input.exitLock();
        this.input.enabled = true;
        this.hud.showDialogue(speaker, lines[0]);
        this.dialogue.lines.shift();
    }

    _advanceDialogue() {
        if (!this.dialogue) return;
        if (this.dialogue.lines.length) {
            this.hud.showDialogue(this.dialogue.speaker, this.dialogue.lines.shift());
            this.audio.chime();
            return;
        }
        if (this.dialogue.item) this.dialogue.item.done = true;
        this.dialogue = null;
        this.hud.hideDialogue();
        this.dialogClosedAt = performance.now(); // E apertado várias vezes não reabre a conversa
        this.state = 'playing';
        this.hud.setState('playing');
        this.input.consumeAttack();
        this.input.consumeInteract();
        if (!this.mobile) this.input.requestLock();
    }

    /**
     * Guarda um ponto de chão firme na trilha (no máx. 8, ≥ 2 m entre si).
     * Firme = no chão, bem acima da fenda e fora de colisores.
     */
    _markSafe(force = false) {
        const p = this.player;
        const w = this.world;
        if (!w) return;
        if (!force && !(p.grounded && p.y > w.fallY + 4 && w.heightAt(p.x, p.z) > w.fallY + 4)) return;
        if (w.blockedAt(p.x, p.z, 0.45)) return;
        const last = this.trail[this.trail.length - 1];
        if (!force && last && Math.hypot(last.x - p.x, last.z - p.z) < 2) return;
        this.trail.push({ x: p.x, z: p.z });
        if (this.trail.length > 8) this.trail.shift();
    }

    /** Leva o portador a um ponto da trilha (`back` = quantos pontos voltar). */
    _respawn(back = 0) {
        const p = this.player;
        const w = this.world;
        const t = this.trail;
        const pt = t.length ? t[Math.max(0, t.length - 1 - back)] : w.spawn;
        // remove o que veio depois (o lugar ruim não vira ponto de volta)
        if (t.length) t.length = Math.max(1, t.length - back);
        p.x = pt.x;
        p.z = pt.z;
        p.y = w.heightAt(p.x, p.z);
        p.stop();
        p.invuln = 1;
        p.sync();
        this.rig.snap(p);
        p.camYaw = p.yaw + Math.PI;
        this.stuck.t = 0;
        this.stuck.warned = false;
    }

    /** Pausa › "Voltar ao caminho" ou detecção automática de "preso". */
    _unstick(msg) {
        if (!this.world) return;
        this._respawn(Math.min(2, Math.max(0, this.trail.length - 1)));
        this.hud.say(msg, 3);
    }

    _checkHazards(dt) {
        const world = this.world;
        const p = this.player;
        // posição inválida (NaN) nunca deveria acontecer — se acontecer, volta ao início
        if (!Number.isFinite(p.x + p.y + p.z)) {
            this.trail.length = 0;
            this._respawn(0);
            return;
        }
        // chão firme: tenta guardar um ponto a cada 0,5 s
        this.safe.t += dt;
        if (this.safe.t > 0.5) {
            this.safe.t = 0;
            this._markSafe();
        }
        if (p.y < world.fallY) {
            // caiu: perde um coração e volta ao último chão firme
            p.hurt(1); // sem efeito se ainda estiver invulnerável
            this.hud.flashHit();
            this.hud.setHearts(p.health, p.maxHealth);
            this.audio.danger();
            if (!p.alive) {
                this._defeat('A fenda engoliu o portador.');
                return;
            }
            this._respawn(0);
            this.hud.say('Cuidado com a beirada! Você voltou para o chão firme.', 3);
            return;
        }
        // preso: pede movimento e não sai de um raio de 0,6 m
        const st = this.stuck;
        if (p.wantsMove && p.grounded) {
            st.t += dt;
            if (Math.hypot(p.x - st.x, p.z - st.z) > 0.6) {
                st.x = p.x;
                st.z = p.z;
                st.t = 0;
                st.warned = false;
            }
            if (st.t > 4 && !st.warned) {
                st.warned = true;
                this.hud.say(this.mobile ? 'Preso? Tente pular — ou espere que eu te tiro daí.' : 'Preso? Pule com Espaço — ou espere que eu te tiro daí.', 3.5);
            }
            if (st.t > 8) this._unstick('Você voltou para o caminho.');
        } else {
            st.t = 0;
            st.x = p.x;
            st.z = p.z;
        }
        if (world.shadowZ !== undefined && this.player.z > world.shadowZ && !world.shadowAwake) {
            world.shadowAwake = true;
            this.audio.roar();
            this.hud.say('A Sombra acordou. Corra pela ponte!', 4);
        }
    }

    async _completeChapter(hold = 1400, { skipped = false } = {}) {
        if (this.state === 'transition' || this.state === 'scene') return;
        this.state = 'scene';
        this.hud.setState('transition');
        this.hud.setPrompt('');
        this.guide.hide();
        this.input.enabled = false;
        this.input.release();
        this.input.exitLock();
        if (!skipped) this.score += 200;
        this.hud.say(skipped ? 'Capítulo pulado. A estrada continua.' : this.chapterIndex === CHAPTERS.length - 1 ? 'A jornada segue…' : 'A estrada continua.', 2.5);
        await wait(hold);

        const next = this.chapterIndex + 1;
        this.settings.unlocked = Math.max(this.settings.unlocked, Math.min(next, CHAPTERS.length - 1));
        this.saveSettings();

        if (next >= CHAPTERS.length) {
            this._victory();
            return;
        }
        try {
            await this._travel(next);
        } catch (err) {
            console.error('[jornada] viagem', err);
            this.busy = false;
            this.toMenu('A viagem tropeçou. Escolha o capítulo para continuar.');
        }
    }

    _defeat(reason) {
        if (this.state === 'defeat') return;
        this.guide.hide();
        this.state = 'defeat';
        this.hud.setState('defeat');
        this.hud.setPrompt('');
        this.input.exitLock();
        this.input.enabled = true;
        this.audio.danger();
        this.hud.showDefeat(statsBlock([
            ['Capítulo', this.chapter.title],
            ['Tempo', formatTime(this.elapsed)],
            ['Páginas', `${this.pages}/${CHAPTERS.length}`]
        ]));
        const p = document.querySelector('#defeatReason');
        if (p) p.textContent = reason;
    }

    _victory() {
        this.state = 'victory';
        this.hud.setState('victory');
        this.input.exitLock();
        this.input.enabled = true;
        const total = this.score + this.pages * 50 + Math.max(0, 600 - Math.floor(this.elapsed));
        if (total > this.settings.best) this.settings.best = total;
        this.settings.saved = null; // jornada completa: o menu volta a "Jogar"
        this.saveSettings();
        this.hud.showVictory(statsBlock([
            ['Glória', String(total)],
            ['Tempo', formatTime(this.elapsed)],
            ['Páginas', `${this.pages}/${CHAPTERS.length}`],
            ['Cavaleiros', this.caught === 0 ? 'nunca o alcançaram' : `alcançaram ${this.caught}×`]
        ]));
        this.hud.setBest(this.settings.best);
    }

    /** Ganchos de teste (só com ?debug=1): troca de capítulo, teleporte, câmera, medidas. */
    _debugHooks() {
        const g = this;
        window.__lab = {
            game: g,
            stage: g.stage,
            /** Vai direto para um capítulo (0–4) e pula a abertura. */
            async goto(i) {
                g.busy = false;
                await g.start(i);
                g.introT = 99;
                g.fade = 0;
                return g.chapter.id;
            },
            tp(x, z, yaw) {
                g.player.x = x;
                g.player.z = z;
                g.player.y = g.world.heightAt(x, z);
                if (yaw !== undefined) g.player.yaw = g.player.facing = yaw;
                g.player.sync();
                return [x, g.player.y, z];
            },
            cam(yaw, pitch = 0.24, dist = 5) {
                g.player.camYaw = yaw;
                g.player.camPitch = pitch;
                g.player.camDist = dist;
                g.rig.free = dist;
            },
            /** Câmera livre: congela o jogo em 'pause' e posiciona à mão. */
            free(px, py, pz, tx, ty, tz) {
                g.state = 'pause';
                g.camera.position.set(px, py, pz);
                g.camera.lookAt(tx, ty, tz);
            },
            unfreeze() {
                g.state = 'playing';
                g.input.enabled = true;
            },
            hud(v) {
                g.hud.showHud(v);
                document.querySelector('.game-shell > header').style.display = v ? '' : 'none';
            },
            stats() {
                return { ...g.stage.stats(), state: g.state, chapter: g.chapter?.id, pos: [g.player.x, g.player.y, g.player.z].map((v) => +v.toFixed(1)) };
            },
            /** fps médio em `s` segundos de requestAnimationFrame. */
            fps(s = 2) {
                return new Promise((res) => {
                    let n = 0;
                    const t0 = performance.now();
                    const f = () => {
                        n++;
                        if (performance.now() - t0 < s * 1000) requestAnimationFrame(f);
                        else res(Math.round(n / s));
                    };
                    requestAnimationFrame(f);
                });
            },
            interact() {
                g.input.interactPressed = true;
            },
            /** estado físico do portador (testes de pulo/velocidade) */
            body() {
                const p = g.player;
                return { x: +p.x.toFixed(3), y: +p.y.toFixed(3), z: +p.z.toFixed(3), vy: +p.vy.toFixed(2), speed: +p.speed.toFixed(2), grounded: p.grounded, mode: p.state.mode, state: g.state };
            },
            camera() {
                const c = g.camera.position;
                return { x: +c.x.toFixed(2), y: +c.y.toFixed(2), z: +c.z.toFixed(2), free: +g.rig.free.toFixed(2), solid: g.world.solidAt(c.x, c.y, c.z, 0) };
            }
        };
    }
}

function boot() {
    const game = new Game();
    game.init().catch((err) => {
        console.error(err);
        game.hud.showError(err?.message || 'Falha ao iniciar a jornada.');
    });
}

boot();
