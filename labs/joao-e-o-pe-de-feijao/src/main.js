/**
 * João e o Pé de Feijão — laço principal, capítulos, câmera e cutscenes (three.js r185).
 *
 * O palco (renderer, céu, sol com sombra, pós) é `createStage` de gfx/stage.js;
 * o mundo vem de world.js. Aqui ficam as regras do conto:
 *   I   fale com a mãe → chame a Mimosa → leve-a ao arco da feira
 *   II  fale com o mercador → cinco feijões
 *   III fale com a mãe → olhe os feijões (o pé cresce) → suba além de y = 66
 *   IV  pegue ouro, galinha e harpa (a harpa acorda o gigante) → com os três, fuja
 *   V   desça, pegue o machado e dê 8 machadadas no pé
 * Pontuação: +40 vaca · +100 troca · +80 plantio · +120 por tesouro · +60 machado
 *            · +50 por vagem dourada · +250 corte · +200 por capítulo · bônus de tempo max(0, 700 − s).
 *
 * Câmera: camera.js (órbita com pivô suavizado, recentralização e colisão com paredes,
 *   terreno, caule e folhas). Saindo de uma cutscene, a câmera "alcança" o rig em ~0,5 s.
 *
 * Pé de feijão (III e V) como fase vertical:
 *   salto assistido caule ↔ folha com anel de pouso (player.js, markers.js)
 *   sombra de contato sob o João em qualquer apoio (markers.js)
 *   ponto seguro: último apoio firme (chão, folha ou trecho do caule), gravado a cada 0,4 s
 *   queda longa (> 7 m de queda livre) → fade curto e volta ao ponto seguro, sem perder
 *     coração; só cair no vazio das nuvens (IV) custa 1 coração
 *   preso dentro de um colisor por 0,8 s ou abaixo do chão → volta ao ponto seguro
 *   altímetro no HUD durante a subida; 4 vagens douradas opcionais (+50 cada)
 *
 * Modo infantil (regras de perdão):
 *   vida           5 corações · o gigante fica tonto 3 s depois de alcançar (npcs.js)
 *   queda          cair das nuvens custa 1 coração; queda longa no pé de feijão é grátis
 *   derrota        "Tentar de novo" recomeça o capítulo com a glória de quando entrou nele
 *   caule          perto do pé crescido, E agarra (além do pulo); no ar, encostar agarra
 *   bússola        seta no HUD aponta o próximo passo do capítulo (guide.js, _guideTarget)
 *   dica           30 s sem se aproximar do alvo → repete a dica do capítulo
 *   cutscenes      botão "Pular" (abertura, pé crescendo, gigante acordando, pé caindo)
 */

import * as THREE from 'three';
import { CHAPTERS, QUALITY, STORAGE_KEY, CAMERA, PLAYER } from './config.js?v=12';
import { clamp, lerp, formatTime } from './utils.js?v=12';
import { Input } from './input.js?v=12';
import { GameAudio } from './audio.js?v=12';
import { Hud, statsBlock } from './hud.js?v=12';
import { Player } from './player.js?v=12';
import { createWorld } from './world.js?v=12';
import { nearestInteractable } from './npcs.js?v=12';
import { CameraRig } from './camera.js?v=12';
import { createMarkers } from './markers.js?v=12';
import { Guide } from '../../shared/gfx/guide.js?v=1';
import { createStage } from '../../shared/gfx/stage.js';
import { pickTier, detectMobile } from '../../shared/gfx/core.js';

const TMP = new THREE.Vector3();
const AXP = { x: 0, z: 0 };
const DEBUG = new URLSearchParams(location.search).has('debug');
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Luz das nuvens por capítulo: [borda, barriga, ganho da borda, ganho da barriga]. */
const CLOUD_LIGHT = {
    night: [0x8fa8ff, 0x3a4a8a, 0.1, 0.12],
    castle: [0xfff0d0, 0xffb060, 0.2, 0.34],
    escape: [0xffd0b0, 0xff8a50, 0.22, 0.4]
};

class Game {
    constructor() {
        this.hud = new Hud();
        this.canvas = document.getElementById('scene');
        this.fadeEl = document.getElementById('fade');
        this.settings = this.loadSettings();
        this.state = 'loading';
        this.chapterIndex = 0;
        this.time = 0;
        this.elapsed = 0;
        this.score = 0;
        this.caught = 0;
        this.introT = 0;
        this.fade = 1;
        this.fadeDir = -1;
        this.fadeSpeed = 0.85;
        this.camCatch = 9;
        this.stuckT = 0;
        this.podsTaken = 0;
        this.dialogue = null;
        this.hudAccum = 0;
        this.orbit = 0;
        this.pendingChapter = 0;
        this.shake = 0;
        this.cut = null;
        this.clearing = null;
        this.envBase = 1;
        this.guide = new Guide(document.getElementById('guide'));
        this.skipEl = document.getElementById('skipButton');
        this.hintT = 0;
        this.bestGoalD = Infinity;
        /** Último apoio firme: chão, folha ou trecho do caule (quedas longas voltam para cá). */
        this.safe = { kind: 'ground', x: 0, y: 0, z: 0, ang: 0, leaf: null, t: 0 };
        /** Glória/tempo ao entrar no capítulo (o "Tentar de novo" volta para cá). */
        this.checkpoint = { score: 0, elapsed: 0, caught: 0 };
    }

    loadSettings() {
        const fallback = { quality: 'auto', volume: 70, muted: false, best: 0, unlocked: 0 };
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
        } catch (err) { /* armazenamento privado */ }
    }

    async init() {
        this.hud.setLoading(0.05, 'Abrindo o livro do conto…');
        this.mobile = detectMobile();
        this.touch = matchMedia('(pointer: coarse)').matches || this.mobile;
        this.hud.setTouch(this.touch);
        const choice = QUALITY[this.settings.quality] ? this.settings.quality : 'auto';

        // progresso real dos downloads (texturas, glTF) na barra, entre as etapas de montagem
        const manager = new THREE.LoadingManager();
        let stageP = 0.05;
        manager.onProgress = (url, loaded, total) => {
            if (this.state === 'loading') this.hud.setLoading(Math.min(0.97, stageP + (loaded / Math.max(1, total)) * 0.08));
        };

        this.stage = createStage({ canvas: this.canvas, tier: choice, preset: 'dia-claro', fov: 54, near: 0.2, loadingManager: manager });
        if (!this.stage) {
            this.hud.showError('Não foi possível criar o contexto WebGL 2.');
            return;
        }
        this.camera = this.stage.camera;
        this.quality = QUALITY[this.stage.tier];
        this.focus = new THREE.Vector3();
        this.stage.focus = this.focus;

        this.input = new Input(this.canvas);
        this.audio = new GameAudio();
        this.player = new Player(this.stage.scene, this.quality.heroDetail);
        this.player.setVisible(false);
        this.rig = new CameraRig(this.camera);
        this.markers = createMarkers(this.stage.scene);

        this._bindUi();

        this.worlds = await createWorld(this.stage, this.quality, (p, text) => {
            stageP = p;
            this.hud.setLoading(p, text);
        });
        this.stage.onTier((t) => {
            this.quality = QUALITY[t];
            this.worlds.grass.setDensity(t === 'low' ? 0.5 : 1);
        });

        this._loadChapter(0, { menu: true });
        this.hud.setLoading(0.98, 'O conto espera.');
        this._updateMenuCam(0);
        this.worlds.update(0.016, 0, this.camera, this.player, null);
        await this.stage.warmup();
        this.hud.hideLoading();
        this._refreshChapterList();

        this.hud.el.qualitySelect.value = this.settings.quality;
        this.hud.el.volumeSlider.value = String(this.settings.volume);
        this.hud.setVolumeLabel(this.settings.volume);
        this.hud.setBest(this.settings.best);
        this.hud.setMuted(this.settings.muted);
        this.hud.showMenu(true);
        this.state = 'menu';
        this.hud.setState('menu');

        this.stage.start((dt) => this._update(dt));
        if (DEBUG) this._debugApi();
    }

    _refreshChapterList() {
        this.hud.fillChapters(this.settings.unlocked, CHAPTERS[this.pendingChapter].id, (i) => {
            this.pendingChapter = i;
            this._refreshChapterList();
        });
    }

    _bindUi() {
        this.hud.el.qualitySelect.addEventListener('change', () => {
            this.settings.quality = this.hud.el.qualitySelect.value;
            this.saveSettings();
            // sombra, pós e pixelRatio trocam na hora; árvores e detalhe dos modelos, na próxima leitura
            this.stage.setTier(pickTier(this.settings.quality));
        });
        this.hud.el.volumeSlider.addEventListener('input', () => {
            this.settings.volume = Number(this.hud.el.volumeSlider.value);
            this.hud.setVolumeLabel(this.settings.volume);
            this.audio.setVolume(this.settings.volume / 100);
            this.saveSettings();
        });
        // o mundo é montado de forma assíncrona: só começa quando o menu já está pronto
        document.getElementById('startButton').addEventListener('click', () => {
            if (this.state === 'menu') this.start(this.pendingChapter);
        });
        document.getElementById('resumeButton').addEventListener('click', () => this.resume());
        document.getElementById('pauseMenuButton').addEventListener('click', () => this.toMenu());
        document.getElementById('retryButton').addEventListener('click', () => this.retry());
        document.getElementById('defeatMenuButton').addEventListener('click', () => this.toMenu());
        document.getElementById('replayButton').addEventListener('click', () => this.start(0));
        document.getElementById('victoryMenuButton').addEventListener('click', () => this.toMenu());
        document.getElementById('dialogueContinue').addEventListener('click', (e) => {
            e.stopPropagation();
            this._advanceDialogue();
        });
        // tocar em qualquer lugar do diálogo também avança
        this.hud.el.dialogue.addEventListener('click', () => this._advanceDialogue());
        // o aviso "E …" é um botão: tocar nele interage
        this.hud.el.prompt.addEventListener('click', () => {
            if (this.state === 'playing') this.input.interactPressed = true;
        });
        this.skipEl?.addEventListener('click', () => this._skip());
        // aba oculta ou janela sem foco: o palco para de desenhar, o conto pausa e nenhuma tecla fica presa
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) return;
            this.input.release();
            if (this.state === 'playing') this.pause();
        });
        window.addEventListener('blur', () => {
            this.input.release();
            if (this.state === 'playing') this.pause();
        });
        // Esc solta o mouse sem chegar como tecla: soltar o mouse jogando abre a pausa
        document.addEventListener('pointerlockchange', () => {
            if (!document.pointerLockElement && this.state === 'playing' && !this.touch) this.pause();
        });
        this.hud.el.soundButton.addEventListener('click', () => this.toggleMute());
        this.hud.el.pauseButton.addEventListener('click', () => this.pause());

        this.input.on('pause', () => {
            if (this.state === 'playing') this.pause();
            else if (this.state === 'pause') this.resume();
        });
        this.input.on('camera', () => this.rig.cycle());
        this.input.on('mute', () => this.toggleMute());
        this.input.on('confirm', () => {
            if (this.state === 'dialogue') this._advanceDialogue();
        });
        this.input.on('pointerdown', () => {
            if (this.state === 'playing' && !this.mobile) this.input.requestLock();
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

        let stickId = null;

        const end = () => {
            stickId = null;
            this.input.touchMove.x = 0;
            this.input.touchMove.y = 0;
            knob.style.transform = 'translate(0,0)';
        };
        stick.addEventListener('pointerdown', (e) => {
            stickId = e.pointerId;
            capturePointer(stick, e.pointerId);
            setFrom(e.clientX, e.clientY);
        });
        stick.addEventListener('pointermove', (e) => {
            if (stickId === e.pointerId) setFrom(e.clientX, e.clientY);
        });
        stick.addEventListener('pointerup', end);
        stick.addEventListener('pointercancel', end);

        const lookZone = document.getElementById('lookZone');
        let lookId = null;
        let lx = 0;
        let ly = 0;
        lookZone?.addEventListener('pointerdown', (e) => {
            lookId = e.pointerId;
            capturePointer(lookZone, e.pointerId);
            lx = e.clientX;
            ly = e.clientY;
        });
        lookZone?.addEventListener('pointermove', (e) => {
            if (lookId !== e.pointerId) return;
            this.input.lookX += e.clientX - lx;
            this.input.lookY += e.clientY - ly;
            lx = e.clientX;
            ly = e.clientY;
        });
        const endLook = () => {
            lookId = null;
        };
        lookZone?.addEventListener('pointerup', endLook);
        lookZone?.addEventListener('pointercancel', endLook);

        document.getElementById('btnInteract')?.addEventListener('click', () => {
            this.input.interactPressed = true;
        });
        // pulo no toque: segurar o botão = pulo alto, tocar rápido = pulo curto (como no teclado)
        const jumpBtn = document.getElementById('btnJump');
        jumpBtn?.addEventListener('pointerdown', (e) => {
            capturePointer(jumpBtn, e.pointerId);
            this.input.jumpPressed = true;
            this.input.jumpHeld = true;
        });
        const jumpUp = () => { this.input.jumpHeld = false; };
        jumpBtn?.addEventListener('pointerup', jumpUp);
        jumpBtn?.addEventListener('pointercancel', jumpUp);
        jumpBtn?.addEventListener('lostpointercapture', jumpUp);
        document.getElementById('btnSprint')?.addEventListener('pointerdown', () => {
            this.input.touchSprint = true;
        });
        document.getElementById('btnSprint')?.addEventListener('pointerup', () => {
            this.input.touchSprint = false;
        });
        document.getElementById('btnSprint')?.addEventListener('pointercancel', () => {
            this.input.touchSprint = false;
        });
    }

    /** Monta o capítulo: estado lógico (world.js), céu/hora/névoa do palco e posição do João. */
    _loadChapter(index, { menu = false } = {}) {
        const ch = CHAPTERS[index];
        this.chapterIndex = index;
        this.chapter = ch;
        this.cut = null;
        this.clearing = null;
        this.shake = 0;

        this.world = this.worlds.enter(ch.id);
        const w = this.world;
        const st = this.stage;
        st.setPreset(ch.sky.preset);
        st.setTimeOfDay(ch.sky.hour);
        st.sky.setClouds(ch.sky.clouds);
        st.follow({ heightAt: w.heightAt, bounds: { minY: w.minY } });
        const pp = st.pipeline.params;
        pp.fogBase = w.fogBase;
        st.shadowRadius = w.shadowRadius;
        if (ch.id === 'castle') {
            // bruma rente ao mar de nuvens: funde o horizonte e dá profundidade aos cúmulos
            pp.fogDensity = 0.011;
            pp.fogFalloff = 0.05;
            pp.haze = 0.0005;
            pp.exposure *= 0.84;
        } else if (ch.id === 'night') {
            pp.bloom = 0.2;
        }
        // luz de preenchimento: sem ela o lado em sombra de madeira e palha afunda no preto
        st.fill.intensity = ch.id === 'night' ? 0.9 : ch.id === 'castle' ? 0.55 : 0.75;
        const cl = CLOUD_LIGHT[ch.id];
        if (cl) this.worlds.setCloudLight(...cl);
        this.envBase = st.scene.environmentIntensity;
        this.audio.setTheme(ch.music);

        this.player.hero.equip({ handR: null });
        this.markers.hide();
        if (!menu) {
            const s = w.spawn;
            const p = this.player;
            p.spawn(s.x, s.z, s.yaw, w.heightAt, s.y);
            if (s.climbing && w.climbs[0]) {
                const c = w.climbs[0];
                c.axis(s.y, AXP);
                p.grabStalk(c, s.y, Math.atan2(s.x - AXP.x, s.z - AXP.z));
            }
            if (index >= 1) p.beans = 5;
            if (index >= 4) p.treasures = { gold: true, hen: true, harp: true };
            this.rig.reset(p, p.climbing ? p.climbAng + CAMERA.climbSide : s.yaw + Math.PI);
            this.rig.solve(1 / 60, p, w);
        } else {
            this.player.setVisible(false);
        }
        this._syncRelics();
    }

    _syncRelics() {
        const id = this.chapter?.id;
        if (id === 'cottage') this.hud.setRelics('story', 0, 5);
        else if (id === 'fair') this.hud.setRelics('beans', this.player.beans, 5);
        else if (id === 'night') this.hud.setRelics('beans', this.player.beans || 5, 5);
        else this.hud.setRelics('treasure', this.player.treasureCount, 3);
    }

    async start(index = 0) {
        await this.audio.unlock();
        this.audio.setVolume(this.settings.volume / 100);
        this.audio.setMuted(this.settings.muted);

        this.pendingChapter = index;
        this.chapterIndex = index;
        this.elapsed = 0;
        this.score = 0;
        this.caught = 0;
        this.player.beans = index >= 1 ? 5 : 0;
        this.player.treasures = index >= 4
            ? { gold: true, hen: true, harp: true }
            : { gold: false, hen: false, harp: false };
        this.player.hasCow = false;
        this.player.hasAxe = false;
        this.player.maxHealth = 5;
        this.podsTaken = 0;
        this.hud.hideDefeat();
        this.hud.hideVictory();
        this.hud.showMenu(false);
        this.hud.hideDialogue();
        this.hud.showPause(false);

        this._loadChapter(index);
        this._beginIntro();
    }

    /** Derrota → recomeça o capítulo atual com a glória e o tempo de quando entrou nele. */
    async retry() {
        const cp = { ...this.checkpoint };
        await this.start(this.chapterIndex);
        Object.assign(this, cp);
        this.checkpoint = cp;
    }

    /** "Pular": encerra a abertura ou a cutscene atual (o pé termina de crescer na hora). */
    _skip() {
        if (this.state === 'intro') {
            this.introT = 99;
        } else if (this.state === 'cutscene' && this.cut) {
            const w = this.world;
            if (w.flags?.growing && !w.flags.grown) w.flags.growT = Math.max(w.flags.growT, 6.5);
            this.cut.t = this.cut.dur;
        }
    }

    _beginIntro() {
        this.state = 'intro';
        this.hud.setState('intro');
        this.introT = 0;
        this.checkpoint = { score: this.score, elapsed: this.elapsed, caught: this.caught, podsTaken: this.podsTaken };
        this.hintT = 0;
        this.bestGoalD = Infinity;
        this.stuckT = 0;
        this.climbTipShown = this.chapter.id !== 'night';
        this.safe.t = 99;
        this._trackSafe(0);
        this.guide.hide();
        if (this.skipEl) this.skipEl.hidden = false;
        this.player.setVisible(true);
        this.hud.showHud(true);
        this.hud.setTouchVisible(matchMedia('(pointer: coarse)').matches || this.mobile);
        this.hud.setChapter(this.chapter);
        this.hud.setHearts(this.player.health, this.player.maxHealth);
        this.hud.setMeter('', 0);
        this._syncRelics();
        this.hud.showChapterCard(this.chapter);
        this.hud.say(this.chapter.objective, 5);
        this.input.enabled = false;
        this.input.release();
        this.fade = 1;
        this.fadeDir = -1;
        this.fadeSpeed = 0.85;
    }

    pause() {
        if (this.state !== 'playing') return;
        this.guide.hide();
        this.state = 'pause';
        this.hud.setState('pause');
        this.hud.showPause(true);
        this.hud.setPrompt('');
        this.markers.hide();
        this.input.exitLock();
        this.input.release();
        // o teclado segue ligado para P/Esc tirarem da pausa (o mundo não anda em 'pause')
        document.getElementById('resumeButton')?.focus({ preventScroll: true });
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

    toMenu() {
        this.hud.showPause(false);
        this.hud.hideDefeat();
        this.hud.hideVictory();
        this.hud.hideDialogue();
        this.hud.showHud(false);
        this.player.setVisible(false);
        this.markers.hide();
        this.input.exitLock();
        this.input.release();
        this.input.enabled = true;
        this._loadChapter(0, { menu: true });
        this._refreshChapterList();
        this.hud.showMenu(true);
        this.state = 'menu';
        this.hud.setState('menu');
        this.fadeDir = -1;
    }

    toggleMute() {
        this.settings.muted = !this.settings.muted;
        this.audio.setMuted(this.settings.muted);
        this.hud.setMuted(this.settings.muted);
        this.saveSettings();
    }

    _update(dt) {
        this.time += dt;
        this.hud.tick(dt);
        this.audio.update(dt);
        const w = this.world;
        for (const fn of w.updateFns) fn(this.time, dt);

        this.fade = clamp(this.fade + this.fadeDir * dt * this.fadeSpeed, 0, 1);
        if (this.fade !== this.lastFade) {
            // só escreve no DOM quando o fade muda (no jogo ele fica parado em 0)
            this.lastFade = this.fade;
            this.fadeEl.style.opacity = this.fade.toFixed(3);
        }
        this.shake = Math.max(0, this.shake - dt * 4);
        this.camCatch += dt;

        this.hudAccum += dt;
        if (this.hudAccum > 0.25) {
            this.hudAccum = 0;
            this.hud.setFps(Math.round(this.stage.fps));
            if (this.state === 'playing') this.hud.setTime(this.elapsed);
        }
        this._updateWeather(dt);

        if (this.state === 'menu') {
            this._updateMenuCam(dt);
        } else if (this.state === 'intro') {
            this.player.idle(dt);
            this._updateIntro(dt);
        } else if (this.state === 'cutscene') {
            this.player.idle(dt);
            this._updateNpcs(dt, true);
            this._updateCut(dt);
        } else if (this.state === 'playing') {
            this.elapsed += dt;
            const p = this.player;
            this.rig.input(this.input);
            const info = p.update(dt, this.input, w, this.rig.yaw);
            const longFall = !p.grounded && !p.climbing && !p.leap && p.fallTop - p.y > PLAYER.longFall;
            if (info.fell || longFall || !Number.isFinite(p.x + p.y + p.z)) {
                this._rescue(info.fell && this.chapter.id === 'castle');
            } else {
                if (info.footstep) this.audio.footstep();
                if (info.jumped) this.audio.footstep();
                if (info.landed > 0) {
                    this.audio.footstep();
                    // aterrissagem pesada (> 2,5 m): tremor curto proporcional à queda
                    if (info.landed > 2.5) this.shake = Math.max(this.shake, Math.min(0.6, info.landed * 0.12));
                }
                this._trackSafe(dt);
                this._checkStuck(dt);
                this._updatePods();
                this._updateNpcs(dt);
                if (this.state === 'playing') this._updateInteract();
                if (this.state === 'playing') this._updateChapterLogic();
                this._followCamera(dt);
                if (this.state === 'playing') this._updateGuide(dt);
                else this.guide.hide();
            }
        } else {
            if (this.state === 'dialogue' && (this.input.consumeInteract() | this.input.consumeJump())) this._advanceDialogue();
            // pausa, diálogo, transição, derrota, vitória: o mundo respira, o João fica parado
            this.player.idle(dt, this.state === 'victory' ? 'cheer' : 'idle');
            if (w.cow && this.state !== 'pause') w.cow.update(dt, this.player, w.heightAt);
            if (this.state === 'victory' || this.state === 'transition') this._updateNpcs(dt, true);
            this._followCamera(dt);
        }

        this.markers.update(dt, this.player, w, this.state === 'playing');
        this.worlds.update(dt, this.time, this.camera, this.player, this.state === 'dialogue' ? this.dialogue?.speaker : null);
        this.stage.scene.environmentIntensity = this.envBase * (w.envK ?? 1);
        this.focus.set(this.player.x, this.player.y, this.player.z);
        if (this.state === 'menu') this.focus.copy(w.overview.look);
    }

    /**
     * Capítulo I: o dia nasce nublado e abre quando a Mimosa sai do pasto.
     * cobertura(t) = lerp(0,92, 0,36, t/12 s), reaplicada a cada 0,6 s (cada troca reassa o céu).
     */
    _updateWeather(dt) {
        const c = this.clearing;
        if (!c) return;
        c.t += dt;
        c.acc += dt;
        if (c.acc < 0.6) return;
        c.acc = 0;
        const k = clamp(c.t / 12, 0, 1);
        this.stage.sky.setClouds(lerp(c.from, c.to, k * k * (3 - 2 * k)));
        if (k >= 1) this.clearing = null;
    }

    _updateMenuCam(dt) {
        this.orbit += dt * 0.07;
        const o = this.world.overview;
        const x = o.look.x + Math.sin(this.orbit + 0.6) * o.radius;
        const z = o.look.z + Math.cos(this.orbit + 0.6) * o.radius;
        this.camera.position.set(x, Math.max(o.pos.y, this.world.heightAt(x, z) + 2.5), z);
        this.camera.lookAt(o.look);
    }

    _updateIntro(dt) {
        this.introT += dt;
        const t = clamp(this.introT / 3.2, 0, 1);
        const e = t * t * (3 - 2 * t);
        const o = this.world.overview;
        this.rig.solve(dt, this.player, this.world);
        this.camera.position.lerpVectors(o.pos, this.rig.pos, e);
        TMP.lerpVectors(o.look, this.rig.look, e);
        this.camera.lookAt(TMP);
        if (t >= 1) {
            this.state = 'playing';
            this.hud.setState('playing');
            this.input.enabled = true;
            this.input.consumeTaps();
            this.camCatch = 9;
            if (this.skipEl) this.skipEl.hidden = true;
            if (this.player.climbing) this.hud.say(this.touch ? 'Puxe a bolinha para baixo para descer. No fim do curso, escorrega.' : 'Segure S (ou ↓) para descer — com Shift, escorrega.', 4.5);
            else this.hud.say(this.touch ? 'Siga a seta dourada. Arraste a tela para olhar.' : 'Siga a seta dourada. Clique no mundo para olhar com o mouse.', 3.6);
        }
    }

    /**
     * Câmera do jogo: o rig (camera.js) resolve posição e alvo com colisão. Logo depois de
     * uma cutscene/diálogo a câmera alcança o rig com λ = 6 (~0,5 s) em vez de cortar.
     */
    _followCamera(dt) {
        const r = this.rig.solve(dt, this.player, this.world);
        const shake = REDUCED ? this.shake * 0.3 : this.shake;
        if (this.camCatch < 0.9) {
            const k = 1 - Math.exp(-6 * dt);
            this.camera.position.lerp(r.pos, k);
            if (shake > 0) this._applyShake(shake);
            this.camera.lookAt(r.look);
        } else {
            r.apply(shake);
        }
    }

    _applyShake(amount = this.shake) {
        if (amount <= 0) return;
        this.camera.position.x += (Math.random() - 0.5) * amount * 0.35;
        this.camera.position.y += (Math.random() - 0.5) * amount * 0.22;
    }

    /** Cutscene: câmera fixa em `pos` olhando `look(t)`; `tick` roda a cada quadro e `end` ao fim. */
    _beginCut(cut) {
        this.cut = { t: 0, ...cut };
        this.cutPos ||= new THREE.Vector3();
        this.cutLook ||= new THREE.Vector3();
        this.markers.hide();
        this.input.consumeTaps();
        this.state = 'cutscene';
        this.hud.setState('cutscene');
        this.hud.setPrompt('');
        this.guide.hide();
        this.input.enabled = false;
        if (this.skipEl) this.skipEl.hidden = false;
    }

    _updateCut(dt) {
        const c = this.cut;
        c.t += dt;
        c.tick?.(c.t, dt);
        c.pos(c.t, this.cutPos);
        c.look(c.t, this.cutLook);
        this.camera.position.lerp(this.cutPos, 1 - Math.exp(-(c.snap ?? 3) * dt));
        this._applyShake(REDUCED ? this.shake * 0.3 : this.shake);
        this.camera.lookAt(this.cutLook);
        if (c.t >= c.dur) {
            this.cut = null;
            if (this.skipEl) this.skipEl.hidden = true;
            c.end();
        }
    }

    _resumePlay() {
        this.state = 'playing';
        this.hud.setState('playing');
        this.input.enabled = true;
        this.input.consumeTaps();
        this.camCatch = 0;
        this.hintT = 0;
        this.bestGoalD = Infinity;
    }

    /**
     * Ponto seguro = último apoio firme, gravado a cada 0,4 s:
     *   chão   (x, z) com terreno acima do vazio
     *   folha  centro da folha (nunca a beirada de onde ele escorregou)
     *   caule  altura e azimute em volta do eixo
     * `force` grava já (início de capítulo).
     */
    _trackSafe(dt) {
        const p = this.player;
        const w = this.world;
        const sf = this.safe;
        sf.t += dt;
        if (sf.t < 0.4 || p.leap) return;
        if (p.climbing) {
            sf.kind = 'stalk';
            sf.y = p.y;
            sf.ang = p.climbAng;
        } else if (p.grounded && p.support) {
            sf.kind = 'leaf';
            sf.leaf = p.support;
            sf.x = p.support.x;
            sf.y = p.support.y;
            sf.z = p.support.z;
        } else if (p.grounded) {
            // chão firme também em volta (±1,6 m): o resgate nunca devolve o João à beirada
            const v = w.voidY + 4;
            if (w.heightAt(p.x, p.z) < v || w.heightAt(p.x + 1.6, p.z) < v || w.heightAt(p.x - 1.6, p.z) < v
                || w.heightAt(p.x, p.z + 1.6) < v || w.heightAt(p.x, p.z - 1.6) < v) return;
            if (p._blocked(p.x, p.z, w)) return;
            sf.kind = 'ground';
            sf.x = p.x;
            sf.z = p.z;
        } else {
            return;
        }
        sf.t = 0;
    }

    /**
     * Resgate: queda longa (> PLAYER.longFall), vazio das nuvens ou estado inválido.
     * Fade de 0,45 s e volta ao ponto seguro. `costly` (vazio do castelo) custa 1 coração.
     */
    _rescue(costly = false) {
        const p = this.player;
        const w = this.world;
        if (costly) {
            p.hurt(1);
            this.hud.flashHit();
            this.hud.setHearts(p.health, p.maxHealth);
            this.audio.danger();
            if (!p.alive) {
                this._defeat('João caiu das nuvens.');
                return;
            }
        }
        const sf = this.safe;
        const climb = w.climbs[0];
        if (sf.kind === 'stalk' && climb && !climb.locked) {
            p.grabStalk(climb, sf.y, sf.ang);
            this.hud.say('O João se agarrou de novo ao caule. Ufa!', 3);
        } else if (sf.kind === 'leaf' && w.platforms.includes(sf.leaf)) {
            p.placeAt(sf.x, sf.y, sf.z, sf.leaf);
            this.hud.say('Uma folha larga amorteceu a queda.', 3);
        } else {
            const y = w.heightAt(sf.x, sf.z);
            p.placeAt(sf.x, y, sf.z, null);
            this.hud.say(costly ? 'Ufa! Uma nuvem segurou o João. Cuidado com a beirada.' : 'De volta ao chão firme.', 3.2);
        }
        p.invuln = Math.max(p.invuln, 1.2);
        p.sync();
        this.input.consumeTaps();
        this.rig.reset(p, p.climbing ? p.climbAng + CAMERA.climbSide : this.rig.yaw);
        this.camCatch = 9;
        this.fade = 0.9;
        this.fadeDir = -1;
        this.fadeSpeed = 2.2;
        this.stuckT = 0;
    }

    /** Preso dentro de um colisor por 0,8 s, ou enterrado no chão: volta ao ponto seguro. */
    _checkStuck(dt) {
        const p = this.player;
        if (p.climbing || p.leap) {
            this.stuckT = 0;
            return;
        }
        const w = this.world;
        const buried = p.grounded && p.y < w.heightAt(p.x, p.z) - 0.6;
        const inside = p._blocked(p.x, p.z, w);
        this.stuckT = buried || inside ? this.stuckT + dt : 0;
        if (this.stuckT > 0.8) this._rescue(false);
    }

    /** Vagens douradas (capítulo III): pegar = encostar (raio 0,9 m, ±1,2 m de altura). */
    _updatePods() {
        const p = this.player;
        for (const pod of this.world.pods) {
            if (pod.taken || !pod.mesh.visible) continue;
            if (Math.abs(p.y - pod.y) > 1.2 || Math.hypot(p.x - pod.x, p.z - pod.z) > 0.9) continue;
            pod.taken = true;
            pod.mesh.visible = false;
            this.podsTaken += 1;
            this.score += 50;
            this.audio.pickup();
            this.hud.say(`Vagem dourada! ${this.podsTaken}/${this.world.pods.length} · +50 de glória`, 2.6);
        }
    }

    /**
     * Próximo passo do capítulo para a bússola: { x, z, name, near } ou null.
     *   I   mãe → Mimosa → arco da feira      II mercador
     *   III mãe → feijões → caule (some subindo)
     *   IV  ouro → galinha → harpa (a harpa por último: ela acorda o gigante)
     *   V   (descendo: some) → machado → base do pé
     */
    _guideTarget() {
        const w = this.world;
        const p = this.player;
        const f = w.flags || {};
        const find = (id) => w.interactables.find((i) => i.id === id && !i.done);
        const at = (it, name) => (it ? { x: it.x, z: it.z, name, near: it.r + 0.3 } : null);
        switch (this.chapter.id) {
            case 'cottage':
                if (!f.talkedMother) return at(find('mother'), 'Mãe');
                if (!p.hasCow) return at(find('cow'), 'Mimosa');
                return at(find('gate'), 'Feira');
            case 'fair':
                return at(find('merchant'), 'Mercador');
            case 'night':
                if (!f.talkedMother) return at(find('mother'), 'Mãe');
                if (!f.grown) return at(find('beans'), 'Feijões');
                if (p.climbing || p.y > 4) return null;
                return { x: w.stalk.x, z: w.stalk.z, name: 'Pé de feijão', near: 3 };
            case 'castle':
                return at(find('gold'), 'Ouro') || at(find('hen'), 'Galinha') || at(find('harp'), 'Harpa');
            case 'escape':
                if (p.climbing || p.y > 4) return null;
                if (!p.hasAxe) return at(find('axe'), 'Machado');
                return at(find('chop'), 'Pé de feijão');
            default:
                return null;
        }
    }

    _updateGuide(dt) {
        // 10 Hz bastam (a seta tem transição no CSS) e poupam a busca do alvo a cada quadro
        this.guideAcc = (this.guideAcc || 0) + dt;
        if (this.guideAcc < 0.1) return;
        dt = this.guideAcc;
        this.guideAcc = 0;
        const t = this._guideTarget();
        this.guide.update(this.camera, this.player.x, this.player.z, t);
        // altímetro da subida (III): a bússola some no caule; a barra mostra quanto falta
        const p = this.player;
        if (this.chapter.id === 'night' && this.world.flags.grown && (p.climbing || p.y > 4 || p.leap)) {
            const top = 66;
            const left = Math.max(0, Math.round(top - p.y));
            this.hud.setMeter(left > 0 ? `Nuvens · faltam ${left} m` : 'Nuvens à vista', clamp(p.y / top, 0.03, 1), false, false);
        } else if (this.chapter.id === 'night') {
            this.hud.setMeter('', 0);
        }
        if (!t) return;
        const d = Math.hypot(t.x - this.player.x, t.z - this.player.z);
        if (d < this.bestGoalD - 3) {
            this.bestGoalD = d;
            this.hintT = 0;
        }
        this.hintT += dt;
        if (this.hintT > 30) {
            this.hintT = 0;
            this.hud.say(this.chapter.hint, 5);
        }
    }

    _updateNpcs(dt, passive = false) {
        const w = this.world;
        if (w.cow && !passive) w.cow.update(dt, this.player, w.heightAt);

        const giant = w.giant;
        if (!giant) {
            // sem gigante a barra é do altímetro (III, _updateGuide) ou some
            if (!passive && this.chapter.id !== 'night') this.hud.setMeter('', 0);
            return;
        }

        let ev;
        if (this.chapter.id === 'escape' && !w.flags.chopped) {
            if (passive) return;
            ev = giant.chaseDown(dt, this.player, w.stalk.axis);
            this.hud.setMeter('O gigante desce', clamp((80 - giant.y) / 80, 0, 1), giant.y < this.player.y + 10);
        } else if (this.chapter.id === 'castle') {
            // em cutscene o João não conta como alvo: o gigante só levanta e urra
            ev = giant.update(dt, passive && giant.state === 'chase' ? giant : this.player, w.heightAt);
            if (!passive) {
                this.hud.setMeter('O gigante fareja', giant.alert, giant.alert > 0.55 || giant.state !== 'sleep');
                if (ev === 'stir') {
                    this.audio.roar();
                    this.shake = 1.4;
                    this.hud.say('Fee-fi-fo-fum! O gigante acordou!', 4);
                }
            }
        } else {
            ev = giant.update(dt, this.player, w.heightAt);
        }

        if (giant.stomp) {
            // passada do gigante: tremor cai com a distância (some além de ~40 m)
            const d = Math.hypot(this.player.x - giant.x, this.player.z - giant.z);
            this.shake = Math.max(this.shake, clamp(1.5 - d / 28, 0, 1.3));
            if (this.audio.ctx && !this.settings.muted) this.audio._drum();
        }

        if (ev === 'caught' && !passive) {
            this.caught += 1;
            this.audio.danger();
            this.hud.flashHit();
            this.shake = 1.2;
            if (this.player.hurt(1)) {
                this.hud.setHearts(this.player.health, this.player.maxHealth);
                this.hud.say('O gigante quase te pegou!', 2.5);
                if (!this.player.alive) {
                    this._defeat('Fee-fi-fo-fum. O gigante alcançou João.');
                } else if (this.chapter.id === 'castle') {
                    // empurrão de 3,2 m para longe do gigante (só se o destino estiver livre)
                    const nx = this.player.x + Math.sin(giant.yaw) * 3.2;
                    const nz = this.player.z + Math.cos(giant.yaw) * 3.2;
                    if (!this.player._blocked(nx, nz, w) && w.heightAt(nx, nz) > -10) {
                        this.player.x = nx;
                        this.player.z = nz;
                    }
                    this.player.invuln = 1.6;
                } else {
                    this.player.invuln = 1.6;
                }
            }
        }
    }

    _updateInteract() {
        // 0,6 s depois de fechar um diálogo o E é ignorado (criança aperta E repetido)
        if (performance.now() - (this.dialogClosedAt ?? -1e4) < 600) this.input.consumeInteract();
        const w = this.world;
        const near = nearestInteractable(this.player, w.interactables);
        let label = near ? near.label : '';
        if (near?.kind === 'goal' && this.chapter.id === 'cottage' && !this.player.hasCow) {
            label = 'Leve a Mimosa com você';
        }
        if (near?.kind === 'chop' && !this.player.hasAxe) {
            label = 'Pegue o machado primeiro';
        }
        if (near?.kind === 'plant' && !w.flags.talkedMother) {
            label = 'Fale com a mãe primeiro';
        }
        if (near?.kind === 'goal' && this.chapter.id === 'night' && !w.flags.grown) {
            label = '';
        }
        if (near?.kind === 'chop' && this.player.hasAxe) {
            label = `Cortar o pé (${w.chop}/${w.chopNeeded})`;
        }
        // ações do pé de feijão (player.js decide; aqui só o aviso): agarrar, saltar p/ folha, voltar ao caule
        const p = this.player;
        let key = 'E';
        if (!label && p.action) {
            key = p.action === 'stalk' ? 'E' : 'Espaço';
            label = p.action === 'grab' ? 'Agarrar o pé de feijão'
                : p.action === 'leaf' ? 'Saltar para a folha'
                    : 'Voltar ao caule';
        }
        if (p.climbing && !this.climbTipShown) {
            this.climbTipShown = true;
            this.hud.say(this.touch ? 'Bolinha para cima sobe; para os lados, dá a volta no caule.' : 'W sobe · A/D dão a volta no caule · Shift acelera.', 4.5);
        }
        this.hud.setPrompt(label, key);
        if (!this.input.consumeInteract() || !near) return;

        if (near.kind === 'talk') {
            this._openDialogue(near.speaker, near.lines, near);
            return;
        }
        if (near.kind === 'cow') {
            if (!w.flags.talkedMother) {
                this.hud.say('Fale com a mãe antes de levar a Mimosa.', 3);
                return;
            }
            this.player.hasCow = true;
            w.cow.follow = true;
            w.flags.hasCow = true;
            near.done = true;
            this.audio.moo();
            this.hud.say('A Mimosa te segue. Siga o caminho de terra até o arco da feira.', 4);
            this.hud.setObjective('Siga o caminho de terra até o arco da feira.');
            this.score += 40;
            const sky = this.chapter.sky;
            if (sky.clearTo != null) this.clearing = { t: 0, acc: 0, from: sky.clouds, to: sky.clearTo };
            return;
        }
        if (near.kind === 'goal') {
            if (this.chapter.id === 'cottage') {
                if (!this.player.hasCow) {
                    this.hud.say('A Mimosa precisa ir junto.', 2.5);
                    return;
                }
                near.done = true;
                this.audio.chime();
                this._completeChapter();
                return;
            }
            if (this.chapter.id === 'night') {
                if (!w.flags.grown || this.player.y < 64) {
                    this.hud.say('Suba até o topo do pé de feijão.', 2.5);
                    return;
                }
                near.done = true;
                this.audio.chime();
                this._completeChapter();
                return;
            }
            near.done = true;
            this._completeChapter();
            return;
        }
        if (near.kind === 'plant') {
            if (!w.flags.talkedMother) {
                this.hud.say('Primeiro, fale com a mãe.', 2.5);
                return;
            }
            if (w.flags.growing || w.flags.grown) return;
            near.done = true;
            this._growCutscene();
            return;
        }
        if (near.kind === 'treasure') {
            near.done = true;
            if (near.mesh) near.mesh.visible = false;
            this.player.treasures[near.id] = true;
            this.score += 120;
            this._syncRelics();
            if (near.id === 'harp') {
                this.audio.harp();
                w.giant?.wake();
                this.hud.say('A harpa canta — o gigante abre um olho!', 4);
            } else {
                this.audio.pickup();
                this.hud.say(near.id === 'gold' ? 'O saco de ouro é seu.' : 'A galinha dos ovos de ouro!', 3);
            }
            if (this.player.treasureCount >= 3) this._wakeCutscene();
            return;
        }
        if (near.kind === 'axe') {
            near.done = true;
            if (near.mesh) near.mesh.visible = false;
            this.player.hasAxe = true;
            this.player.hero.equip({ handR: 'axe' });
            this.audio.pickup();
            this.hud.say('O machado está na mão. Corte o pé!', 3.5);
            this.hud.setObjective('Corte o pé de feijão na base — aperte E várias vezes.');
            this.score += 60;
            return;
        }
        if (near.kind === 'chop') {
            if (!this.player.hasAxe) {
                this.hud.say('O machado está no toco, junto à lenha, em frente à cabana.', 3);
                return;
            }
            if (this.player.swing > 0.2) return; // uma machadada por vez
            w.chop += 1;
            this.player.attack();
            this.player.facing = Math.atan2(near.x - this.player.x, near.z - this.player.z);
            this.audio.chop();
            this.shake = 0.8;
            this.hud.setMeter('Corte o pé', w.chop / w.chopNeeded, false);
            if (w.chop >= w.chopNeeded) this._chopDown();
        }
    }

    /** III — os feijões acordam: 8 s de câmera recuada vendo o pé furar a noite até as nuvens. */
    _growCutscene() {
        const w = this.world;
        w.growStalk();
        this.audio.grow();
        this.hud.say('Os feijões acordam. O pé sobe até as nuvens…', 6);
        this.score += 80;
        const sx = w.stalk.x;
        const sz = w.stalk.z;
        this._beginCut({
            dur: 8.2,
            snap: 1.6,
            pos: (t, out) => out.set(sx + 15 + t * 1.6, w.heightAt(sx + 15, sz + 12) + 1.3 + t * 0.25, sz + 12 + t * 1.2),
            look: (t, out) => out.set(sx, 2 + (w.growK || 0) * 44, sz),
            tick: (t) => {
                if (!w.flags.grown) this.shake = Math.max(this.shake, 0.35);
            },
            end: () => {
                this.hud.setObjective('Suba o pé de feijão até as nuvens. Vagens douradas nas folhas valem glória.');
                this.hud.say(this.touch ? 'Encoste no caule e toque em pular para agarrar.' : 'Encoste no caule e aperte Espaço (ou E) para agarrar.', 5);
                this._resumePlay();
            }
        });
    }

    /** IV — terceiro tesouro: o gigante acorda, levanta e urra; então a fuga começa. */
    _wakeCutscene() {
        const w = this.world;
        const g = w.giant;
        g.wake();
        this.hud.say('Os três tesouros estão na sacola. Fuja!', 3.5);
        let roared = false;
        const p = this.player;
        this._beginCut({
            dur: 4,
            snap: 2.4,
            pos: (t, out) => {
                const dx = p.x - g.x;
                const dz = p.z - g.z;
                const d = Math.hypot(dx, dz) || 1;
                return out.set(p.x + (dx / d) * 3.5 + (dz / d) * 2, p.y + 1.6, p.z + (dz / d) * 3.5 - (dx / d) * 2);
            },
            look: (t, out) => out.set(g.x, g.y + 7.2, g.z),
            tick: (t) => {
                if (t > 0.8 && !roared) {
                    roared = true;
                    this.audio.roar();
                    this.shake = 1.6;
                    this.hud.say('Fee-fi-fo-fum!', 3);
                }
            },
            end: () => {
                this.state = 'playing';
                this._completeChapter();
            }
        });
    }

    _updateChapterLogic() {
        const w = this.world;
        if (this.chapter.id === 'cottage' && this.player.hasCow) {
            const gate = w.interactables.find((i) => i.id === 'gate');
            if (gate && !gate.done && Math.hypot(this.player.x - gate.x, this.player.z - gate.z) < 4.2) {
                gate.done = true;
                this.audio.chime();
                this._completeChapter();
                return;
            }
        }
        if (this.chapter.id === 'night' && w.flags.grown && this.player.y > 66) {
            const clouds = w.interactables.find((i) => i.id === 'clouds');
            if (clouds && !clouds.done && Math.hypot(this.player.x - clouds.x, this.player.z - clouds.z) < 4.2) {
                clouds.done = true;
                this.audio.chime();
                this._completeChapter();
            }
        }
    }

    /** V — oitava machadada: o pé tomba (world.js), o gigante cai com ele e o conto fecha ao pôr do sol. */
    _chopDown() {
        const w = this.world;
        if (w.flags.chopped) return;
        w.flags.chopped = true;
        this.audio.crash();
        this.audio.roar();
        this.shake = 2.2;
        w.giant?.drop(w.fallDir, w.heightAt);
        this.hud.say('O pé cai — e o gigante com ele.', 4);
        this.hud.setMeter('', 0);
        this.score += 250;
        const sx = w.stalk.x;
        const sz = w.stalk.z;
        let hit = false;
        this._beginCut({
            dur: 7,
            snap: 1.8,
            pos: (t, out) => out.set(sx - 13, w.heightAt(sx - 13, sz + 13) + 3.2, sz + 13),
            look: (t, out) => out.set(sx + w.fallDir.x * 14, 20 - Math.min(16, w.fall.th * 11), sz + w.fallDir.z * 14),
            tick: () => {
                if (w.fall.impact && !hit) {
                    hit = true;
                    this.audio.crash();
                    this.shake = 2.6;
                }
            },
            end: () => {
                this.state = 'playing';
                this._completeChapter();
            }
        });
    }

    _openDialogue(speaker, lines, item) {
        this.guide.hide();
        this.dialogue = { speaker, lines: [...lines], item };
        this.state = 'dialogue';
        this.hud.setState('dialogue');
        this.hud.setPrompt('');
        this.input.exitLock();
        this.input.enabled = true;
        this.player.facing = Math.atan2(item.x - this.player.x, item.z - this.player.z);
        this.player.yaw = this.player.facing;
        this.player.sync();
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
        const w = this.world;
        const item = this.dialogue.item;
        if (item) {
            if (item.id === 'mother') {
                w.flags.talkedMother = true;
                if (this.chapter.id === 'cottage') {
                    this.hud.setObjective('Chame a Mimosa e leve-a ao caminho da feira.');
                    this.hud.say('A Mimosa pasta perto da cerca.', 3.5);
                }
                if (this.chapter.id === 'night') {
                    this.hud.setObjective('Olhe os feijões que a mãe jogou no quintal.');
                    this.hud.say('Há um brilho roxo na terra do quintal.', 3.5);
                }
            }
            if (item.id === 'merchant') {
                this.player.beans = 5;
                this.player.hasCow = false;
                if (w.cow) {
                    w.cow.follow = false;
                    w.cow.parked = true;
                    w.cow.place(w.cowPark.x, w.cowPark.z, -2.2);
                }
                this._syncRelics();
                this.audio.beans();
                this.hud.say('Cinco feijões mágicos. A Mimosa fica com o mercador.', 4);
                item.done = true;
                this.score += 100;
                this.dialogue = null;
                this.hud.hideDialogue();
                this.state = 'playing';
                this._completeChapter();
                return;
            }
        }
        this.dialogue = null;
        this.hud.hideDialogue();
        this.dialogClosedAt = performance.now(); // E apertado várias vezes não reabre a conversa
        this.state = 'playing';
        this.hud.setState('playing');
        this.input.consumeInteract();
        this.input.consumeJump();
        if (!this.mobile) this.input.requestLock();
    }

    async _completeChapter() {
        if (this.state === 'transition') return;
        this.guide.hide();
        this.state = 'transition';
        this.hud.setState('transition');
        this.hud.setPrompt('');
        this.input.enabled = false;
        this.input.exitLock();
        this.score += 200;
        this.fadeDir = 1;
        const last = this.chapterIndex === CHAPTERS.length - 1;
        this.hud.say(last ? 'E viveram com ouro, ovos e música.' : 'O conto continua…', 2.5);
        const from = this.chapterIndex;
        await wait(1400);
        if (this.state !== 'transition' || this.chapterIndex !== from) return; // saiu para o menu no meio

        const next = this.chapterIndex + 1;
        this.settings.unlocked = Math.max(this.settings.unlocked, Math.min(next, CHAPTERS.length - 1));
        this.saveSettings();

        if (next >= CHAPTERS.length) {
            this.fadeDir = -1;
            this._victory();
            return;
        }
        this._loadChapter(next);
        this._beginIntro();
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
            ['Tesouros', `${this.player.treasureCount}/3`]
        ]));
        const p = document.querySelector('#defeatReason');
        if (p) p.textContent = reason;
    }

    _victory() {
        this.state = 'victory';
        this.hud.setState('victory');
        this.input.exitLock();
        this.input.enabled = true;
        const total = this.score + this.player.treasureCount * 80 + Math.max(0, 700 - Math.floor(this.elapsed));
        if (total > this.settings.best) {
            this.settings.best = total;
            this.saveSettings();
        }
        this.hud.showVictory(statsBlock([
            ['Glória', String(total)],
            ['Tempo', formatTime(this.elapsed)],
            ['Tesouros', `${this.player.treasureCount}/3`],
            ['Vagens douradas', `${this.podsTaken}/4`],
            ['Sustos', this.caught === 0 ? 'nenhum' : `${this.caught}`]
        ]));
        this.hud.setBest(this.settings.best);
    }

    _debugState() {
        const p = this.player;
        const cam = this.camera.position;
        return {
            state: this.state, chapter: this.chapter.id, x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2),
            vx: +p.vx.toFixed(2), vz: +p.vz.toFixed(2), vy: +p.vy.toFixed(2), speed: +p.speed.toFixed(2),
            grounded: p.grounded, climbing: p.climbing, leap: Boolean(p.leap), onLeaf: Boolean(p.support), action: p.action,
            flags: this.world.flags, giant: this.world.giant?.state, health: p.health, pods: this.podsTaken, safe: this.safe.kind,
            cam: { x: +cam.x.toFixed(2), y: +cam.y.toFixed(2), z: +cam.z.toFixed(2), dist: +this.rig.cur.toFixed(2) }
        };
    }

    /** Atalhos de depuração (só com ?debug=1): pular capítulo, teleportar, medir. */
    _debugApi() {
        const g = this;
        window.__lab = {
            game: g,
            stage: g.stage,
            goto: (i) => g.start(i),
            skipIntro: () => { g.introT = 99; },
            tp: (x, z, y) => {
                g.player.x = x;
                g.player.z = z;
                g.player.y = y ?? g.world.heightAt(x, z);
                g.player.vy = 0;
                g.player.sync();
            },
            cam: (yaw, pitch = CAMERA.defaultPitch, dist = CAMERA.distance) => {
                g.rig.yaw = yaw;
                g.rig.pitch = pitch;
                g.rig.dist = dist;
                g.rig.idle = 0;
            },
            /**
             * Simulação sem desenhar: roda `seconds` de jogo em passos de 1/60 s segurando
             * `keys` (nomes de ação: forward, back, left, right, sprint) e apertando `press`
             * ('jump' | 'interact') no primeiro passo. Devolve o estado ao fim.
             */
            sim: (seconds, keys = [], press = null, opts = {}) => {
                const inp = g.input;
                keys.forEach((k) => inp.keys.add(k));
                if (press === 'jump') { inp.jumpPressed = true; inp.jumpHeld = true; }
                if (press === 'interact') inp.interactPressed = true;
                const n = Math.round(seconds * 60);
                let maxY = -1e9;
                let minY = 1e9;
                for (let i = 0; i < n; i++) {
                    if (opts.releaseJumpAt != null && i === Math.round(opts.releaseJumpAt * 60)) inp.jumpHeld = false;
                    g._update(1 / 60);
                    maxY = Math.max(maxY, g.player.y);
                    minY = Math.min(minY, g.player.y);
                }
                keys.forEach((k) => inp.keys.delete(k));
                inp.jumpHeld = false;
                return { ...g._debugState(), maxY: +maxY.toFixed(3), minY: +minY.toFixed(3) };
            },
            leaves: () => g.world.platforms.map((l) => ({ x: +l.x.toFixed(2), y: +l.y.toFixed(2), z: +l.z.toFixed(2), ang: +l.ang.toFixed(2), L: +l.L.toFixed(2) })),
            press: () => { g.input.interactPressed = true; },
            talk: () => { while (g.dialogue) g._advanceDialogue(); },
            state: () => g._debugState(),
            stats: () => g.stage.stats()
        };
    }
}

function wait(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

function boot() {
    const game = new Game();
    game.init().catch((err) => {
        console.error(err);
        game.hud.showError(err?.message || 'Falha ao abrir o conto.');
    });
}

boot();
