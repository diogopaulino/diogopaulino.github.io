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
 *            · +250 corte · +200 por capítulo · bônus de tempo max(0, 700 − s).
 *
 * Câmera: órbita em volta do João (yaw/pitch/distância) suavizada com
 *   pos ← lerp(pos, alvo, 1 − e^(−10·dt)); não desce abaixo do chão + 0,5 m, é
 *   puxada para perto quando uma parede fica no meio e treme com `shake`.
 */

import * as THREE from 'three';
import { CHAPTERS, QUALITY, STORAGE_KEY, CAMERA } from './config.js';
import { clamp, lerp, formatTime } from './utils.js';
import { Input } from './input.js';
import { GameAudio } from './audio.js';
import { Hud, statsBlock } from './hud.js';
import { Player } from './player.js?v=8';
import { createWorld } from './world.js?v=8';
import { nearestInteractable } from './npcs.js?v=8';
import { createStage } from '../../shared/gfx/stage.js';
import { pickTier, detectMobile } from '../../shared/gfx/core.js';

const LOOK = new THREE.Vector3();
const CAM = new THREE.Vector3();
const TMP = new THREE.Vector3();
const DEBUG = new URLSearchParams(location.search).has('debug');

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
        this.dialogue = null;
        this.hudAccum = 0;
        this.orbit = 0;
        this.pendingChapter = 0;
        this.shake = 0;
        this.cut = null;
        this.clearing = null;
        this.envBase = 1;
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
            const dists = [4.6, 6.8, 10.2];
            const i = dists.findIndex((d) => Math.abs(this.player.camDist - d) < 0.35);
            this.player.camDist = dists[(i + 1) % dists.length];
        });
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
        document.getElementById('btnJump')?.addEventListener('click', () => {
            this.input.jumpPressed = true;
            this.input.jumpHeld = true;
            setTimeout(() => { this.input.jumpHeld = false; }, 180);
        });
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
        if (!menu) {
            const s = w.spawn;
            this.player.spawn(s.x, s.z, s.yaw, w.heightAt, s.y);
            if (s.climbing) this.player.climbing = true;
            if (index >= 1) this.player.beans = 5;
            if (index >= 4) this.player.treasures = { gold: true, hen: true, harp: true };
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
        this.player.maxHealth = 3;
        this.hud.hideDefeat();
        this.hud.hideVictory();
        this.hud.showMenu(false);
        this.hud.hideDialogue();
        this.hud.showPause(false);

        this._loadChapter(index);
        this._beginIntro();
    }

    _beginIntro() {
        this.state = 'intro';
        this.hud.setState('intro');
        this.introT = 0;
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

    toMenu() {
        this.hud.showPause(false);
        this.hud.hideDefeat();
        this.hud.hideVictory();
        this.hud.hideDialogue();
        this.hud.showHud(false);
        this.player.setVisible(false);
        this.input.exitLock();
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

        this.fade = clamp(this.fade + this.fadeDir * dt * 0.85, 0, 1);
        this.fadeEl.style.opacity = this.fade.toFixed(3);
        this.shake = Math.max(0, this.shake - dt * 4);

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
            const info = this.player.update(dt, this.input, w);
            if (info.fell) {
                this._defeat('João caiu das nuvens.');
            } else {
                if (info.footstep) this.audio.footstep();
                if (info.jumped) this.audio.chime();
                this._updateNpcs(dt);
                this._updateInteract();
                this._updateChapterLogic();
                this._followCamera(dt);
            }
        } else {
            // pausa, diálogo, transição, derrota, vitória: o mundo respira, o João fica parado
            this.player.idle(dt, this.state === 'victory' ? 'cheer' : 'idle');
            if (w.cow && this.state !== 'pause') w.cow.update(dt, this.player, w.heightAt);
            if (this.state === 'victory' || this.state === 'transition') this._updateNpcs(dt, true);
            this._followCamera(dt);
        }

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
        this._cameraTarget();
        this.camera.position.lerpVectors(o.pos, CAM, e);
        TMP.lerpVectors(o.look, LOOK, e);
        this.camera.lookAt(TMP);
        if (t >= 1) {
            this.state = 'playing';
            this.hud.setState('playing');
            this.input.enabled = true;
            this.hud.say(this.mobile ? 'Toque para olhar e andar.' : 'Clique no mundo para olhar com o mouse.', 3.2);
        }
    }

    /** Posição desejada da câmera (CAM) e alvo (LOOK), já com colisão. */
    _cameraTarget() {
        const p = this.player;
        const w = this.world;
        p.cameraPosition(CAM);
        p.lookAt(LOOK);
        if (p.climbing) {
            // na escalada a câmera sobe e olha para baixo: o chão encolhe sob os pés
            CAM.y += 2.6;
            LOOK.y -= 0.8;
        }
        // parede no meio: anda do João até a câmera e para no primeiro ponto bloqueado
        let k = 1;
        for (let i = 1; i <= 8; i++) {
            const u = i / 8;
            const x = lerp(LOOK.x, CAM.x, u);
            const z = lerp(LOOK.z, CAM.z, u);
            if (this._camBlocked(x, lerp(LOOK.y, CAM.y, u), z)) {
                k = Math.max(0.16, (i - 1) / 8);
                break;
            }
        }
        if (k < 1) CAM.lerpVectors(LOOK, CAM, k);
        if (w.cam && w.inside?.(p.x, p.z)) {
            CAM.x = clamp(CAM.x, w.cam.minX, w.cam.maxX);
            CAM.z = clamp(CAM.z, w.cam.minZ, w.cam.maxZ);
            CAM.y = Math.min(CAM.y, w.cam.maxY);
        }
        const gy = w.heightAt(CAM.x, CAM.z) + 0.5;
        if (gy > -20 && CAM.y < gy) CAM.y = gy;
    }

    _camBlocked(x, y, z) {
        for (const c of this.world.colliders) {
            if (!c.box) continue;
            if (c.camTop != null && y > c.camTop) continue;
            const dx = x - c.x;
            const dz = z - c.z;
            const lx = dx * c.cos - dz * c.sin;
            const lz = dx * c.sin + dz * c.cos;
            if (Math.abs(lx) < c.hx + 0.25 && Math.abs(lz) < c.hz + 0.25) return true;
        }
        return false;
    }

    _followCamera(dt) {
        this._cameraTarget();
        const k = 1 - Math.exp(-10 * (dt || 0.016));
        this.camera.position.lerp(CAM, k);
        this._applyShake();
        this.camera.lookAt(LOOK);
    }

    _applyShake() {
        if (this.shake <= 0) return;
        this.camera.position.x += (Math.random() - 0.5) * this.shake * 0.35;
        this.camera.position.y += (Math.random() - 0.5) * this.shake * 0.22;
    }

    /** Cutscene: câmera fixa em `pos` olhando `look(t)`; `tick` roda a cada quadro e `end` ao fim. */
    _beginCut(cut) {
        this.cut = { t: 0, ...cut };
        this.state = 'cutscene';
        this.hud.setState('cutscene');
        this.hud.setPrompt('');
        this.input.enabled = false;
    }

    _updateCut(dt) {
        const c = this.cut;
        c.t += dt;
        c.tick?.(c.t, dt);
        c.pos(c.t, CAM);
        c.look(c.t, LOOK);
        this.camera.position.lerp(CAM, 1 - Math.exp(-(c.snap ?? 3) * dt));
        this._applyShake();
        this.camera.lookAt(LOOK);
        if (c.t >= c.dur) {
            this.cut = null;
            c.end();
        }
    }

    _resumePlay() {
        this.state = 'playing';
        this.hud.setState('playing');
        this.input.enabled = true;
    }

    _updateNpcs(dt, passive = false) {
        const w = this.world;
        if (w.cow && !passive) w.cow.update(dt, this.player, w.heightAt);

        const giant = w.giant;
        if (!giant) {
            if (!passive) this.hud.setMeter('', 0);
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
        this.hud.setPrompt(label);
        if (!near || !this.input.consumeInteract()) return;

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
                this.hud.setObjective('Suba o pé de feijão — pule junto ao caule para agarrar e segure W.');
                this.hud.say('Chegue perto do caule e pule para agarrar. W sobe, A/D dá a volta.', 5);
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
        this.state = 'playing';
        this.hud.setState('playing');
        if (!this.mobile) this.input.requestLock();
    }

    async _completeChapter() {
        if (this.state === 'transition') return;
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
            ['Sustos', this.caught === 0 ? 'nenhum' : `${this.caught}`]
        ]));
        this.hud.setBest(this.settings.best);
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
                g.player.camYaw = yaw;
                g.player.camPitch = pitch;
                g.player.camDist = dist;
            },
            press: () => { g.input.interactPressed = true; },
            talk: () => { while (g.dialogue) g._advanceDialogue(); },
            state: () => ({
                state: g.state, chapter: g.chapter.id, x: +g.player.x.toFixed(2), y: +g.player.y.toFixed(2), z: +g.player.z.toFixed(2),
                climbing: g.player.climbing, flags: g.world.flags, giant: g.world.giant?.state, health: g.player.health
            }),
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
