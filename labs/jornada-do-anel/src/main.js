/**
 * A Jornada do Anel — laço principal, capítulos e câmera de terceira pessoa.
 *
 * O palco (`gfx/stage.js`) cuida de renderer, céu físico, sol com sombra, pós
 * (AO, bloom, névoa de altura, raios, grade de cor) e resolução dinâmica; cada
 * capítulo troca a atmosfera com `stage.setPreset` e monta o próprio mundo.
 *
 * Câmera (colisão): do ponto de mira acima do portador até a posição desejada
 * são testadas 16 amostras; a primeira dentro de chão/colisor encurta a distância
 *   d_livre = d · (i − 1)/16 − folga
 * A distância encolhe rápido (20/s) e volta devagar (2,5/s) para não "pular".
 */

import * as THREE from 'three';
import { createStage, PRESETS } from '../../shared/gfx/stage.js';
import { pickTier, damp } from '../../shared/gfx/core.js';
import { preload } from '../../shared/gfx/assets.js';
import { CHAPTERS, ATMOSPHERES, STORAGE_KEY, CAMERA } from './config.js?v=30';
import { clamp, lerp, formatTime, wait } from './utils.js?v=30';
import { Input } from './input.js?v=30';
import { GameAudio } from './audio.js?v=30';
import { Hud, statsBlock } from './hud.js?v=30';
import { Player } from './player.js?v=30';
import { nearestInteractable } from './actors.js?v=30';
import { buildChapter } from './chapters.js?v=30';

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
        this.camFree = CAMERA.distance;
        this.loadToken = 0;
        this.fadeEl = document.getElementById('fade');
        this.lastFade = -1;
    }

    loadSettings() {
        const fallback = {
            quality: 'auto',
            volume: 70,
            muted: false,
            best: 0,
            unlocked: 0
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
        stage.pipeline.params.fade = 1;
        // o palco rebaixou o tier por desempenho: alivia a grama do capítulo atual
        stage.onTier((tier) => this.world?.grass?.setDensity(tier === 'low' ? 0.45 : 0.75));

        this.input = new Input(this.canvas);
        this.audio = new GameAudio();
        this.player = new Player(this.scene);
        this.player.root.visible = false;
        this._bindUi();

        preload({ models: ['antique_estoc', 'wooden_lantern_01'] });
        stage.start((dt) => this._update(dt));
        await this.player.equip({ drawn: false });
        await this._loadChapter(0, { menu: true });
        this.hud.setLoading(1, 'A estrada espera.');
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
        if (DEBUG) this._debugHooks();
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
        });
        this.hud.el.volumeSlider.addEventListener('input', () => {
            this.settings.volume = Number(this.hud.el.volumeSlider.value);
            this.hud.setVolumeLabel(this.settings.volume);
            this.audio.setVolume(this.settings.volume / 100);
            this.saveSettings();
        });
        document.getElementById('startButton').addEventListener('click', () => this.start(this.pendingChapter));
        document.getElementById('resumeButton').addEventListener('click', () => this.resume());
        document.getElementById('pauseMenuButton').addEventListener('click', () => this.toMenu());
        document.getElementById('retryButton').addEventListener('click', () => this.start(this.chapterIndex));
        document.getElementById('defeatMenuButton').addEventListener('click', () => this.toMenu());
        document.getElementById('replayButton').addEventListener('click', () => this.start(0));
        document.getElementById('victoryMenuButton').addEventListener('click', () => this.toMenu());
        document.getElementById('dialogueContinue').addEventListener('click', () => this._advanceDialogue());
        this.hud.el.soundButton.addEventListener('click', () => this.toggleMute());
        this.hud.el.pauseButton.addEventListener('click', () => this.pause());

        this.input.on('pause', () => {
            if (this.state === 'playing') this.pause();
            else if (this.state === 'pause') this.resume();
        });
        this.input.on('camera', () => {
            const dists = [4.4, 6.4, 9.4];
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
            // o toque gira mais por pixel que o mouse travado (tela pequena)
            this.input.lookX += (e.clientX - lx) * 2.2;
            this.input.lookY += (e.clientY - ly) * 2.2;
            lx = e.clientX;
            ly = e.clientY;
        });
        const endLook = () => {
            lookId = null;
        };
        lookZone?.addEventListener('pointerup', endLook);
        lookZone?.addEventListener('pointercancel', endLook);

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
            old.dispose();
        }
        if (stage.tier !== this.wantedTier() && !stage.software) stage.setTier(this.wantedTier());
        stage.setPreset(ch.atmosphere);
        stage.sun.castShadow = PRESETS[ch.atmosphere].sun > 0;

        const world = buildChapter(ch.id, { stage, tier: stage.tier });
        world.tramplers.push(this.player.trample);
        this.scene.add(world.group);
        stage.follow(world.terrain || { heightAt: world.heightAt, bounds: { minY: world.fogBase ?? 0 } });
        world.applyAtmosphere?.(stage);
        this.audio.setTheme(ch.music);
        // câmera já no lugar para a grama e a floresta gerarem o que vai aparecer
        if (menu) {
            this.player.root.visible = false;
            this._menuCam(world);
        } else {
            const s = world.spawn;
            this.player.spawn(s.x, s.z, s.yaw, world.heightAt);
            this.player.setHasRing(index > 0);
            this.camFree = this.player.camDist;
            this.player.cameraPosition(CAM);
            this.camera.position.copy(CAM);
            this.camera.lookAt(this.player.lookAt(LOOK));
        }
        this.world = world;
        await Promise.all([world.ready(), this.player.equip(world.gear || {})]);
        if (token !== this.loadToken) return false;
        await stage.warmup();
        return true;
    }

    async start(index = 0) {
        if (this.busy) return;
        this.busy = true;
        await this.audio.unlock();
        this.audio.setVolume(this.settings.volume / 100);
        this.audio.setMuted(this.settings.muted);

        this.pendingChapter = index;
        this.elapsed = 0;
        this.pages = 0;
        this.score = 0;
        this.caught = 0;
        this.kills = 0;
        this.player.hasRing = index > 0;
        this.player.maxHealth = 3;
        this.hud.hideDefeat();
        this.hud.hideVictory();
        this.hud.showMenu(false);
        this.hud.hideDialogue();
        this.hud.showPause(false);
        this.hud.showHud(false);

        await this._travel(index);
        this.busy = false;
    }

    /** Fade para preto → carrega → abertura do capítulo. */
    async _travel(index) {
        this.state = 'transition';
        this.hud.setState('transition');
        this.input.enabled = false;
        this.fadeDir = 1;
        this.hud.setTravel(CHAPTERS[index]);
        await wait(Math.max(60, (1 - this.fade) * 900));
        this.fade = 1;
        await this._loadChapter(index);
        this.hud.setTravel(null);
        this._beginIntro();
    }

    _beginIntro() {
        this.state = 'intro';
        this.hud.setState('intro');
        this.introT = 0;
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
        this.state = 'pause';
        this.hud.setState('pause');
        this.hud.showPause(true);
        this.input.exitLock();
        this.input.enabled = false;
    }

    resume() {
        if (this.state !== 'pause') return;
        this.state = 'playing';
        this.hud.setState('playing');
        this.hud.showPause(false);
        this.input.enabled = true;
        if (!this.mobile) this.input.requestLock();
    }

    async toMenu() {
        if (this.busy) return;
        this.busy = true;
        this.hud.showPause(false);
        this.hud.hideDefeat();
        this.hud.hideVictory();
        this.hud.hideDialogue();
        this.hud.showHud(false);
        this.input.exitLock();
        this.state = 'transition';
        this.hud.setState('transition');
        this.fadeDir = 1;
        await wait(700);
        this.fade = 1;
        this.player.root.visible = false;
        await this._loadChapter(0, { menu: true });
        this.input.enabled = true;
        this._refreshChapterList();
        this.hud.showMenu(true);
        this.state = 'menu';
        this.hud.setState('menu');
        this.fadeDir = -1;
        this.busy = false;
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

        const info = this.player.update(dt, this.input, world);
        if (info.footstep) this.audio.footstep();
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

        this._updateNpcs(dt);
        this._updateInteract();
        this._checkHazards();
        this._followCamera(dt);
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

    _updateIntro(dt) {
        this.introT += dt;
        const world = this.world;
        const t = clamp(this.introT / 3.6, 0, 1);
        const e = t * t * (3 - 2 * t);
        const o = world.overview;
        const l = world.overviewLook;
        this.camFree = this.player.camDist;
        this.player.cameraPosition(CAM, this._freeDistance(world));
        this.player.lookAt(LOOK);
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
            this.hud.say(this.mobile ? 'Arraste na tela para olhar e use o analógico para andar.' : 'Clique no mundo para olhar com o mouse.', 3.2);
        }
    }

    /** Maior distância livre entre o ponto de mira e a posição desejada da câmera. */
    _freeDistance(world) {
        const want = this.player.camDist;
        const N = 16;
        for (let i = 1; i <= N; i++) {
            const d = (want * i) / N;
            this.player.cameraPosition(TMP, d);
            if (world.solidAt(TMP.x, TMP.y, TMP.z, CAMERA.skin)) return Math.max(0.9, (want * (i - 1)) / N - 0.15);
        }
        return want;
    }

    _followCamera(dt) {
        const world = this.world;
        if (!world) return;
        const free = this._freeDistance(world);
        this.camFree = damp(this.camFree, free, free < this.camFree ? 20 : 2.5, dt || 0.016);
        this.player.cameraPosition(CAM, Math.min(this.camFree, free + 0.4));
        this.player.lookAt(LOOK);
        const gy = world.heightAt(CAM.x, CAM.z) + CAMERA.skin;
        if (CAM.y < gy) CAM.y = gy;
        const k = 1 - Math.exp(-14 * (dt || 0.016));
        this.camera.position.lerp(CAM, k);
        this.camera.lookAt(LOOK);
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
        const near = nearestInteractable(this.player, this.world.interactables);
        this.hud.setPrompt(near ? near.label : '');
        if (!near || !this.input.consumeInteract()) return;

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
        this.state = 'playing';
        this.hud.setState('playing');
        this.input.consumeAttack();
        this.input.consumeInteract();
        if (!this.mobile) this.input.requestLock();
    }

    _checkHazards() {
        const world = this.world;
        if (world.shadowZ !== undefined && this.player.z > world.shadowZ && !world.shadowAwake) {
            world.shadowAwake = true;
            this.audio.roar();
            this.hud.say('A Sombra acordou. Corra pela ponte!', 4);
        }
        if (this.player.y < world.fallY) this._defeat('A fenda engoliu o portador.');
    }

    async _completeChapter(hold = 1400) {
        if (this.state === 'transition' || this.state === 'scene') return;
        this.state = 'scene';
        this.hud.setState('transition');
        this.hud.setPrompt('');
        this.input.enabled = false;
        this.input.exitLock();
        this.score += 200;
        this.hud.say(this.chapterIndex === CHAPTERS.length - 1 ? 'A jornada segue…' : 'A estrada continua.', 2.5);
        await wait(hold);

        const next = this.chapterIndex + 1;
        this.settings.unlocked = Math.max(this.settings.unlocked, Math.min(next, CHAPTERS.length - 1));
        this.saveSettings();

        if (next >= CHAPTERS.length) {
            this._victory();
            return;
        }
        await this._travel(next);
    }

    _defeat(reason) {
        if (this.state === 'defeat') return;
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
        if (total > this.settings.best) {
            this.settings.best = total;
            this.saveSettings();
        }
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
            cam(yaw, pitch = 0.18, dist = 6.4) {
                g.player.camYaw = yaw;
                g.player.camPitch = pitch;
                g.player.camDist = dist;
                g.camFree = dist;
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
