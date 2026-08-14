/**
 * A Menina da Lanterna — laço principal, capítulos e câmera.
 * Clara acende o que a noite esqueceu. Cinco cenas, uma historinha.
 */

import * as THREE from 'three';
import { CHAPTERS, QUALITY, STORAGE_KEY, PLAYER, STORY, ROOT_ORDER, ROOT_NAMES } from './config.js';
import { clamp, detectMobile, detectSoftwareGL, rendererIsSoftware, formatTime, lerp } from './utils.js';
import { Input } from './input.js';
import { GameAudio } from './audio.js';
import { Hud, statsBlock } from './hud.js';
import { Player } from './player.js';
import { createSky, applyChapterSky, createLights } from './sky.js';
import {
    buildChapter, lightWorldLamp, revealBridge, lightCrystal, resetCrystals
} from './world.js';
import { nearestInteractable } from './npcs.js';

const LOOK = new THREE.Vector3();
const CAM = new THREE.Vector3();

class Game {
    constructor() {
        this.hud = new Hud();
        this.canvas = document.getElementById('scene');
        this.settings = this.loadSettings();
        this.state = 'loading';
        this.chapterIndex = 0;
        this.time = 0;
        this.elapsed = 0;
        this.memories = 0;
        this.score = 0;
        this.caught = 0;
        this.lampsTotal = 0;
        this.introT = 0;
        this.fade = 1;
        this.fadeDir = -1;
        this.dialogue = null;
        this.fpsAccum = 0;
        this.fpsFrames = 0;
        this.hudAccum = 0;
        this.orbit = 0;
        this.pendingChapter = 0;
        this.darkHurtT = 0;
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
        } catch (err) { /* privado */ }
    }

    resolveQuality() {
        const choice = this.settings.quality;
        if (choice !== 'auto' && QUALITY[choice]) return QUALITY[choice];
        if (detectMobile() || detectSoftwareGL()) return QUALITY.low;
        const big = Math.min(window.innerWidth, window.innerHeight) >= 900;
        return big ? QUALITY.high : QUALITY.medium;
    }

    async init() {
        this.hud.setLoading(0.12, 'Acendendo o pavio…');
        this.quality = this.resolveQuality();
        this.mobile = detectMobile();

        try {
            this.renderer = new THREE.WebGLRenderer({
                canvas: this.canvas,
                antialias: this.quality.antialias,
                powerPreference: 'high-performance',
                alpha: false
            });
        } catch (err) {
            this.hud.showError('Não foi possível criar o contexto WebGL.');
            return;
        }

        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.quality.pixelRatio));
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = CHAPTERS[0].exposure ?? 0.9;
        this.renderer.shadowMap.enabled = this.quality.shadows;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.setClearColor(CHAPTERS[0].clear);

        if (rendererIsSoftware(this.renderer) && this.quality.id !== 'low') {
            this.quality = QUALITY.low;
            this.renderer.setPixelRatio(1);
            this.renderer.shadowMap.enabled = false;
        }

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.12, 520);
        this.sky = createSky();
        this.scene.add(this.sky.mesh);

        this.hud.setLoading(0.4, 'Abrindo Vale-da-Bruma…');
        this.input = new Input(this.canvas);
        this.audio = new GameAudio();
        this.player = new Player(this.scene);
        this.player.root.visible = false;

        this.timer = new THREE.Timer();
        this.timer.connect(document);
        this._bindUi();
        window.addEventListener('resize', () => this._resize());

        await this._loadChapter(0, { menu: true });
        this.hud.setLoading(1, 'A chama espera.');
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
        this._loop();
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
            const dists = [4.2, 5.8, 8.6];
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
        const end = () => {
            this.input.touchMove.x = 0;
            this.input.touchMove.y = 0;
            knob.style.transform = 'translate(0,0)';
        };
        stick.addEventListener('pointerdown', (e) => {
            stick.setPointerCapture(e.pointerId);
            setFrom(e.clientX, e.clientY);
        });
        stick.addEventListener('pointermove', (e) => {
            if (stick.hasPointerCapture(e.pointerId)) setFrom(e.clientX, e.clientY);
        });
        stick.addEventListener('pointerup', end);
        stick.addEventListener('pointercancel', end);

        const lookZone = document.getElementById('lookZone');
        let lx = 0;
        let ly = 0;
        lookZone?.addEventListener('pointerdown', (e) => {
            lookZone.setPointerCapture(e.pointerId);
            lx = e.clientX;
            ly = e.clientY;
        });
        lookZone?.addEventListener('pointermove', (e) => {
            if (!lookZone.hasPointerCapture(e.pointerId)) return;
            this.input.lookX += e.clientX - lx;
            this.input.lookY += e.clientY - ly;
            lx = e.clientX;
            ly = e.clientY;
        });

        document.getElementById('btnInteract')?.addEventListener('click', () => {
            this.input.interactPressed = true;
        });
        document.getElementById('btnFlash')?.addEventListener('click', () => {
            this.input.flashPressed = true;
        });
        document.getElementById('btnSprint')?.addEventListener('pointerdown', () => {
            this.input.touchSprint = true;
        });
        document.getElementById('btnSprint')?.addEventListener('pointerup', () => {
            this.input.touchSprint = false;
        });
    }

    async _loadChapter(index, { menu = false } = {}) {
        const ch = CHAPTERS[index];
        this.chapterIndex = index;
        this.chapter = ch;

        const world = buildChapter(ch.id, this.quality);
        const lights = createLights(this.scene, ch, this.quality);
        if (this.world) this.scene.remove(this.world.group);
        if (this.lights) this.scene.remove(this.lights.group);
        this.world = world;
        this.lights = lights;
        this.scene.add(this.world.group);
        applyChapterSky(this.sky, ch);
        this.scene.fog = new THREE.Fog(ch.fog.color, ch.fog.near, ch.fog.far);
        this.renderer.setClearColor(ch.clear);
        this.renderer.toneMappingExposure = ch.exposure ?? 0.9;
        this.audio.setTheme(ch.music);

        if (!menu) {
            const s = this.world.spawn;
            this.player.spawn(s.x, s.z, s.yaw, this.world.heightAt);
        } else {
            this.player.root.visible = false;
        }
    }

    async start(index = 0) {
        await this.audio.unlock();
        this.audio.setVolume(this.settings.volume / 100);
        this.audio.setMuted(this.settings.muted);

        this.quality = this.resolveQuality();
        if (rendererIsSoftware(this.renderer)) this.quality = QUALITY.low;
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.quality.pixelRatio));
        this.renderer.shadowMap.enabled = this.quality.shadows;

        this.pendingChapter = index;
        this.chapterIndex = index;
        this.elapsed = 0;
        this.memories = 0;
        this.score = 0;
        this.caught = 0;
        this.lampsTotal = 0;
        this.player.maxHealth = 3;
        this.hud.hideDefeat();
        this.hud.hideVictory();
        this.hud.showMenu(false);
        this.hud.hideDialogue();
        this.hud.showPause(false);

        await this._loadChapter(index);
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
        this.hud.setFuel(this.player.fuel);
        this.hud.setMemories(this.memories, CHAPTERS.length);
        this.hud.showChapterCard(this.chapter);
        this.hud.say(this.chapter.objective, 5.5);
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
        this.hud.showPause(false);
        this.hud.hideDefeat();
        this.hud.hideVictory();
        this.hud.hideDialogue();
        this.hud.showHud(false);
        this.player.root.visible = false;
        this.input.exitLock();
        this.input.enabled = true;
        await this._loadChapter(0, { menu: true });
        this._refreshChapterList();
        this.hud.showMenu(true);
        this.state = 'menu';
        this.hud.setState('menu');
    }

    toggleMute() {
        this.settings.muted = !this.settings.muted;
        this.audio.setMuted(this.settings.muted);
        this.hud.setMuted(this.settings.muted);
        this.saveSettings();
    }

    _loop(timestamp) {
        requestAnimationFrame((t) => this._loop(t));
        this.timer.update(timestamp);
        const dt = Math.min(0.05, this.timer.getDelta());
        this.time += dt;
        this._update(dt);
        this.renderer.render(this.scene, this.camera);
        this.fpsFrames += 1;
        this.fpsAccum += dt;
        if (this.fpsAccum >= 0.5) {
            this.hud.setFps(Math.round(this.fpsFrames / this.fpsAccum));
            this.fpsFrames = 0;
            this.fpsAccum = 0;
        }
    }

    _update(dt) {
        this.hud.tick(dt);
        this.audio.update(dt);
        this.world?.updateFns.forEach((fn) => fn(this.time, dt));
        for (const w of this.world?.waterMeshes || []) {
            if (w.userData.baseY == null) w.userData.baseY = w.position.y;
            if (w.material.map) w.material.map.offset.x = this.time * 0.03;
            w.position.y = w.userData.baseY + Math.sin(this.time * 1.3) * 0.06;
        }

        this.fade = clamp(this.fade + this.fadeDir * dt * 0.85, 0, 1);
        document.getElementById('fade').style.opacity = String(this.fade);

        if (this.state === 'menu') {
            if (this.world) this._updateMenuCam(dt);
            return;
        }
        if (this.state === 'intro') {
            this._updateIntro(dt);
            return;
        }
        if (this.state === 'pause' || this.state === 'dialogue' || this.state === 'defeat' || this.state === 'victory') {
            this._followCamera(1);
            return;
        }
        if (this.state !== 'playing') return;

        this.elapsed += dt;
        this.hudAccum += dt;
        if (this.hudAccum > 0.15) {
            this.hud.setTime(this.elapsed);
            this.hud.setFuel(this.player.fuel);
            this.hudAccum = 0;
        }

        const info = this.player.update(dt, this.input, this.world, this.chapter);
        if (info.footstep) this.audio.footstep();
        if (info.flash) {
            this.audio.flash();
            this._applyFlash();
        }

        this._updateNpcs(dt);
        this._pickupFireflies();
        this._updateInteract();
        this._checkDark(dt);
        this._refreshObjective();
        this._followCamera(dt);
        this.sky.mesh.position.copy(this.camera.position);
        if (this.quality.shadows && this.lights?.dir) {
            this.lights.dir.position.set(
                this.player.x + this.chapter.sun.dir[0] * 40,
                this.player.y + this.chapter.sun.dir[1] * 40,
                this.player.z + this.chapter.sun.dir[2] * 40
            );
            this.lights.dir.target.position.set(this.player.x, this.player.y, this.player.z);
            this.lights.dir.target.updateMatrixWorld();
        }
    }

    _updateMenuCam(dt) {
        this.orbit += dt * 0.1;
        const o = this.world.overview;
        this.camera.position.set(
            Math.sin(this.orbit) * o.x,
            o.y,
            Math.cos(this.orbit) * o.z
        );
        this.camera.lookAt(0, 2.2, 0);
        this.sky.mesh.position.copy(this.camera.position);
    }

    _updateIntro(dt) {
        this.introT += dt;
        const t = clamp(this.introT / 3.2, 0, 1);
        const e = t * t * (3 - 2 * t);
        const o = this.world.overview;
        this.player.cameraPosition(CAM);
        this.player.lookAt(LOOK);
        this.camera.position.set(
            lerp(o.x, CAM.x, e),
            lerp(o.y, CAM.y, e),
            lerp(o.z, CAM.z, e)
        );
        const look = new THREE.Vector3(
            lerp(0, LOOK.x, e),
            lerp(2.8, LOOK.y, e),
            lerp(0, LOOK.z, e)
        );
        this.camera.lookAt(look);
        if (t >= 1) {
            this.state = 'playing';
            this.hud.setState('playing');
            this.input.enabled = true;
            this.hud.say('Clique no mundo para olhar. Espaço pulsa a lanterna.', 3.4);
        }
    }

    _followCamera(dt) {
        this.player.cameraPosition(CAM);
        this.player.lookAt(LOOK);
        const gy = this.world.heightAt(CAM.x, CAM.z) + 1.05;
        if (CAM.y < gy) CAM.y = gy;
        const k = 1 - Math.exp(-10 * (dt || 0.016));
        this.camera.position.lerp(CAM, k);
        this.camera.lookAt(LOOK);
    }

    _applyFlash() {
        const px = this.player.x;
        const pz = this.player.z;
        const r = PLAYER.flashRadius;
        for (const lamp of this.world.lamps) {
            if (lamp.lit) continue;
            if (Math.hypot(lamp.x - px, lamp.z - pz) < r * 0.72) {
                this._lightLamp(lamp);
            }
        }
        for (const s of this.world.shadows) s.scare(px, pz, r);
        if (this.world.night) this.world.night.scare(px, pz, r);
        const cage = this.world.interactables.find((it) => it.kind === 'cage' && !it.done);
        if (cage && Math.hypot(cage.x - px, cage.z - pz) < 3.2) this._freeFox(cage);
    }

    _lightLamp(lamp) {
        if (!lightWorldLamp(this.world, lamp)) return;
        this.lampsTotal += 1;
        this.score += 40;
        this.audio.lamp();
        const n = this.world.lampsLit();
        const need = this.world.progress.lampsNeeded;
        this.hud.say(need ? `Chama ${n}/${need}.` : 'A chama pegou.', 2.2);
        if (this.chapter.id === 'rio' && n >= need) {
            revealBridge(this.world);
            this.hud.say('A ponte aparece sobre o rio.', 3);
        }
    }

    _freeFox(cage) {
        cage.done = true;
        if (cage.mesh) cage.mesh.visible = false;
        this.world.progress.foxFreed = true;
        this.world.fox?.free();
        this.score += 80;
        this.audio.chime();
        this._openDialogue('Pingo', STORY.pingo, null);
    }

    _updateNpcs(dt) {
        let maxAlert = 0;
        for (const s of this.world.shadows) {
            const ev = s.update(dt, this.player, this.world.heightAt);
            maxAlert = Math.max(maxAlert, s.alert, ev === 'chase' ? 0.8 : 0);
            if (ev === 'caught') this._shadowHit();
            else if (ev === 'chase' && Math.random() < dt * 0.35) this.audio.danger();
        }
        if (this.world.night) {
            const ev = this.world.night.update(dt, this.player, this.world.heightAt);
            maxAlert = Math.max(maxAlert, this.world.night.alert, ev === 'chase' ? 0.9 : 0);
            if (ev === 'caught') this._shadowHit('A Noite soprou a chama.');
        }
        this.world.fox?.update(dt, this.player, this.world.heightAt);
        this.hud.setStealth(this.world.shadows.length || this.world.night ? maxAlert : 0);
    }

    _shadowHit(reason) {
        this.caught += 1;
        this.audio.hit();
        this.hud.flashHit();
        if (this.player.hurt(1)) {
            this.hud.setHearts(this.player.health, this.player.maxHealth);
            this.player.addFuel(-18);
            this.hud.say('A sombra tocou você. A chama tremeu.', 2.6);
            if (!this.player.alive) this._defeat(reason || 'A noite engoliu a última chama.');
        }
    }

    _pickupFireflies() {
        for (const f of this.world.fireflies) {
            if (f.done) continue;
            const d = Math.hypot(this.player.x - f.mesh.position.x, this.player.z - f.z);
            if (d > 1.15) continue;
            f.done = true;
            f.mesh.visible = false;
            this.player.addFuel(PLAYER.fireflyHeal);
            this.score += 12;
            this.audio.pickup();
        }
    }

    _updateInteract() {
        const near = nearestInteractable(this.player, this.world.interactables);
        let label = near ? near.label : '';
        if (near?.kind === 'goal' && !this.world.readyToExit()) {
            label = this.chapter.hint;
        }
        this.hud.setPrompt(label);
        if (!near || !this.input.consumeInteract()) return;

        if (near.kind === 'talk') {
            this._openDialogue(near.speaker || 'Alguém', near.lines, near);
            return;
        }
        if (near.kind === 'lamp') {
            this._lightLamp(near);
            return;
        }
        if (near.kind === 'memory') {
            near.done = true;
            near.mesh.visible = false;
            this.memories += 1;
            this.score += 90;
            this.audio.pickup();
            this.hud.setMemories(this.memories, CHAPTERS.length);
            if (near.id === 'carta') this.hud.say(STORY.carta, 6);
            else this.hud.say('Uma lembrança da Nara cabe no bolso.', 3);
            return;
        }
        if (near.kind === 'cage') {
            this.hud.say('Pulse a lanterna (Espaço) para queimar as sarças.', 3);
            return;
        }
        if (near.kind === 'crystal') {
            this._tryCrystal(near);
            return;
        }
        if (near.kind === 'place') {
            near.done = true;
            this.world.progress.placed = true;
            this.audio.dawn();
            if (this.world.nara) this.world.nara.visible = true;
            this._openDialogue('Nara', STORY.nara, { kind: 'nara-end' });
            return;
        }
        if (near.kind === 'goal') {
            if (!this.world.readyToExit()) {
                this.hud.say(this.chapter.hint, 3);
                return;
            }
            near.done = true;
            this.audio.chime();
            this.score += 120;
            this._completeChapter();
        }
    }

    _tryCrystal(it) {
        const next = ROOT_ORDER[this.world.progress.crystals.length];
        if (it.index !== next) {
            resetCrystals(this.world);
            this.audio.wrong();
            this.hud.say('A canção errou. Começa de novo: ouro, azul, rosa, verde.', 4);
            return;
        }
        lightCrystal(it);
        this.world.progress.crystals.push(it.index);
        this.audio.lamp();
        const n = this.world.progress.crystals.length;
        this.hud.say(`A raiz ${ROOT_NAMES[it.index]} acendeu (${n}/4).`, 2.4);
        if (n === 4) {
            this.score += 150;
            this.hud.say('O oco da árvore se abre. A Noite recua.', 4);
            if (this.world.night) {
                this.world.night.orbit = 16;
                this.world.night.stun = 8;
            }
        }
    }

    _refreshObjective() {
        const w = this.world;
        const ch = this.chapter;
        if (ch.id === 'aldeia') {
            const lamps = w.lampsLit();
            this.hud.setObjective(
                `${w.progress.talked ? '✓' : '○'} Tomás  ·  lampiões ${lamps}/4  ·  ${this.memories ? '✓' : '○'} carta`
            );
        } else if (ch.id === 'trilha') {
            this.hud.setObjective(`Lanternas ${w.lampsLit()}/5  ·  chegue ao moinho`);
        } else if (ch.id === 'rio') {
            this.hud.setObjective(
                `Bóias ${w.lampsLit()}/3  ·  ${w.progress.foxFreed ? '✓' : '○'} Pingo  ·  atravesse`
            );
        } else if (ch.id === 'arvore') {
            this.hud.setObjective(`Raízes ${w.progress.crystals.length}/4  ·  ouro, azul, rosa, verde`);
        } else {
            this.hud.setObjective(w.progress.placed ? 'O dia volta.' : 'Coloque a lanterna na pedra.');
        }
    }

    _checkDark(dt) {
        if (!this.chapter.dark) return;
        if (this.player.fuel > 4 || this.player.nearLit) {
            this.darkHurtT = 0;
            return;
        }
        this.darkHurtT += dt;
        if (this.darkHurtT > 3.6) {
            this.darkHurtT = 0;
            this._shadowHit('A chama apagou. A noite ficou grande demais.');
        }
    }

    _openDialogue(speaker, lines, item) {
        this.dialogue = { speaker, lines: [...lines], item };
        this.state = 'dialogue';
        this.hud.setState('dialogue');
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
        const item = this.dialogue.item;
        if (item?.kind === 'talk') {
            item.done = true;
            this.world.progress.talked = true;
        }
        const end = item?.kind === 'nara-end';
        this.dialogue = null;
        this.hud.hideDialogue();
        if (end) {
            this._completeChapter();
            return;
        }
        this.state = 'playing';
        this.hud.setState('playing');
        if (!this.mobile) this.input.requestLock();
    }

    async _completeChapter() {
        if (this.state === 'transition') return;
        this.state = 'transition';
        this.hud.setState('transition');
        this.input.enabled = false;
        this.input.exitLock();
        this.score += 200;
        this.fadeDir = 1;
        const last = this.chapterIndex === CHAPTERS.length - 1;
        this.hud.say(last ? 'O dia lembrou o caminho.' : 'A trilha continua.', 2.4);
        await wait(1400);

        const next = this.chapterIndex + 1;
        this.settings.unlocked = Math.max(this.settings.unlocked, next);
        this.saveSettings();

        if (next >= CHAPTERS.length) {
            this._victory();
            return;
        }
        await this._loadChapter(next);
        this._beginIntro();
    }

    _defeat(reason) {
        if (this.state === 'defeat') return;
        this.state = 'defeat';
        this.hud.setState('defeat');
        this.input.exitLock();
        this.input.enabled = true;
        this.audio.danger();
        this.hud.showDefeat(statsBlock([
            ['Capítulo', this.chapter.title],
            ['Tempo', formatTime(this.elapsed)],
            ['Lembranças', `${this.memories}/${CHAPTERS.length}`]
        ]));
        const p = document.querySelector('#defeatReason');
        if (p) p.textContent = reason;
    }

    _victory() {
        this.state = 'victory';
        this.hud.setState('victory');
        this.input.exitLock();
        const total = this.score + this.memories * 50 + this.lampsTotal * 10 + Math.max(0, 700 - Math.floor(this.elapsed));
        if (total > this.settings.best) {
            this.settings.best = total;
            this.saveSettings();
        }
        this.hud.showVictory(statsBlock([
            ['Chama', String(total)],
            ['Tempo', formatTime(this.elapsed)],
            ['Lembranças', `${this.memories}/${CHAPTERS.length}`],
            ['Lampiões', String(this.lampsTotal)]
        ]));
        this.hud.setBest(this.settings.best);
    }

    _resize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
    }
}

function wait(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

function boot() {
    const game = new Game();
    game.init().catch((err) => {
        console.error(err);
        game.hud.showError(err?.message || 'Falha ao acender a lanterna.');
    });
}

boot();
