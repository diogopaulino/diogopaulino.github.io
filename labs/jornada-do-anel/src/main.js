/**
 * A Jornada do Anel — laço principal, capítulos e câmera cinematográfica.
 */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CHAPTERS, QUALITY, STORAGE_KEY } from './config.js?v=3';
import { clamp, detectMobile, detectSoftwareGL, rendererIsSoftware, formatTime, disposeObject } from './utils.js?v=3';
import { Input } from './input.js?v=3';
import { GameAudio } from './audio.js?v=3';
import { Hud, statsBlock } from './hud.js?v=3';
import { Player } from './player.js?v=3';
import { createSky, applyChapterSky, createLights, tickSky } from './sky.js?v=3';
import { buildChapter } from './world.js?v=3';
import { nearestInteractable } from './npcs.js?v=3';
import { tickMaterials } from './models.js?v=3';

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
        this.pages = 0;
        this.score = 0;
        this.caught = 0;
        this.kills = 0;
        this.introT = 0;
        this.fade = 1;
        this.fadeDir = -1;
        this.dialogue = null;
        this.fpsAccum = 0;
        this.fpsFrames = 0;
        this.hudAccum = 0;
        this.orbit = 0;
        this.pendingChapter = 0;
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

    resolveQuality() {
        const choice = this.settings.quality;
        if (choice !== 'auto' && QUALITY[choice]) return QUALITY[choice];
        if (detectMobile() || detectSoftwareGL()) return QUALITY.low;
        const big = Math.min(window.innerWidth, window.innerHeight) >= 900;
        return big ? QUALITY.high : QUALITY.medium;
    }

    async init() {
        this.hud.setLoading(0.12, 'Abrindo o mapa da Terra Média…');
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
        this.renderer.toneMappingExposure = CHAPTERS[0].exposure ?? 1.2;
        this.renderer.shadowMap.enabled = this.quality.shadows;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.setClearColor(CHAPTERS[0].clear);

        if (rendererIsSoftware(this.renderer) && this.quality.id !== 'low') {
            this.quality = QUALITY.low;
            this.renderer.setPixelRatio(1);
            this.renderer.shadowMap.enabled = false;
        }

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.12, 520);
        const pmrem = new THREE.PMREMGenerator(this.renderer);
        this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        this.scene.environmentIntensity = 0.42;
        pmrem.dispose();
        this.sky = createSky();
        this.scene.add(this.sky.mesh);

        this.hud.setLoading(0.4, 'Erguendo as colinas do Condado…');
        this.input = new Input(this.canvas);
        this.audio = new GameAudio();
        this.player = new Player(this.scene);
        this.player.root.visible = false;

        this.timer = new THREE.Timer();
        this.timer.connect(document);
        this._bindUi();
        window.addEventListener('resize', () => this._resize());

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
        document.getElementById('btnAttack')?.addEventListener('click', () => {
            this.input.attackPressed = true;
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
        if (this.world) {
            this.scene.remove(this.world.group);
            disposeObject(this.world.group);
        }
        if (this.lights) this.scene.remove(this.lights.group);
        this.world = world;
        this.lights = lights;
        this.scene.add(this.world.group);
        applyChapterSky(this.sky, ch);
        this.scene.fog = new THREE.Fog(ch.fog.color, ch.fog.near, ch.fog.far);
        this.scene.environmentIntensity = ch.id === 'moria' ? 0.12 : ch.id === 'forest' ? 0.2 : 0.42;
        this.renderer.setClearColor(ch.clear);
        this.renderer.toneMappingExposure = ch.exposure ?? 1.15;
        this.audio.setTheme(ch.music);

        if (this.lights.dir && this.quality.shadows) {
            this.lights.dir.target.position.set(0, 0, 0);
        }

        if (!menu) {
            const s = this.world.spawn;
            this.player.spawn(s.x, s.z, s.yaw, this.world.heightAt);
            this.player.setHasRing(index > 0 || this.player.hasRing);
            if (index > 0) this.player.setHasRing(true);
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
        this.hud.setRing(this.player.hasRing);
        this.hud.setPages(this.pages, CHAPTERS.length);
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
        tickMaterials(this.time);
        tickSky(this.sky, this.time);
        this.world?.updateFns.forEach((fn) => fn(this.time, dt));
        for (const w of this.world?.waterMeshes || []) {
            if (w.material.map) w.material.map.offset.x = this.time * 0.03;
            if (w.material.normalMap) w.material.normalMap.offset.set(this.time * 0.04, this.time * 0.02);
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
        if (this.hudAccum > 0.2) {
            this.hud.setTime(this.elapsed);
            this.hudAccum = 0;
        }

        const info = this.player.update(dt, this.input, this.world);
        if (info.footstep) this.audio.footstep();
        if (info.attacking) {
            const hits = this.player.attackHit(this.world.goblins);
            for (const g of hits) {
                this.audio.hit();
                if (g.hit()) {
                    this.kills += 1;
                    this.score += 40;
                }
            }
        }

        this._updateNpcs(dt);
        this._updateInteract();
        this._checkHazards();
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
        this.orbit += dt * 0.12;
        const o = this.world.overview;
        this.camera.position.set(
            Math.sin(this.orbit) * o.x,
            o.y,
            Math.cos(this.orbit) * o.z
        );
        this.camera.lookAt(0, 2.5, 0);
        this.sky.mesh.position.copy(this.camera.position);
    }

    _updateIntro(dt) {
        this.introT += dt;
        const t = clamp(this.introT / 3.4, 0, 1);
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
            lerp(3, LOOK.y, e),
            lerp(0, LOOK.z, e)
        );
        this.camera.lookAt(look);
        if (t >= 1) {
            this.state = 'playing';
            this.hud.setState('playing');
            this.input.enabled = true;
            this.hud.say(this.mobile ? 'Arraste na tela para olhar e use o analógico para andar.' : 'Clique no mundo para olhar com o mouse.', 3.2);
        }
    }

    _followCamera(dt) {
        this.player.cameraPosition(CAM);
        this.player.lookAt(LOOK);
        // Evita a câmera enterrar no chão.
        const gy = this.world.heightAt(CAM.x, CAM.z) + 1.1;
        if (CAM.y < gy) CAM.y = gy;
        const k = 1 - Math.exp(-10 * (dt || 0.016));
        this.camera.position.lerp(CAM, k);
        this.camera.lookAt(LOOK);
    }

    _updateNpcs(dt) {
        let maxAlert = 0;
        for (const r of this.world.riders) {
            const ev = r.update(dt, this.player, this.world.heightAt);
            maxAlert = Math.max(maxAlert, r.alert, ev === 'chase' ? 0.85 : 0);
            if (ev === 'caught') {
                this.caught += 1;
                this.audio.danger();
                this.hud.flashHit();
                if (this.player.hurt(1)) {
                    this.hud.setHearts(this.player.health, this.player.maxHealth);
                    this.hud.say('Os Cavaleiros alcançaram você.', 3);
                    if (!this.player.alive) this._defeat('Os Cavaleiros levaram o portador.');
                    else {
                        // Empurra de volta.
                        this.player.x -= Math.sin(r.yaw) * 2.4;
                        this.player.z -= Math.cos(r.yaw) * 2.4;
                    }
                }
            } else if (ev === 'chase' && Math.random() < dt * 0.4) {
                this.audio.danger();
            }
        }
        this.hud.setStealth(this.world.riders.length ? maxAlert : 0);

        for (const g of this.world.goblins) {
            const ev = g.update(dt, this.player, this.world.heightAt);
            if (ev === 'hit') {
                this.audio.hit();
                this.hud.flashHit();
                if (this.player.hurt(1)) {
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
            this._openDialogue(near.id === 'wizard' ? 'O Cinzento' : 'O jardineiro', near.lines, near);
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
            this._completeChapter();
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
        if (this.dialogue.item) this.dialogue.item.done = true;
        this.dialogue = null;
        this.hud.hideDialogue();
        this.state = 'playing';
        this.hud.setState('playing');
        if (!this.mobile) this.input.requestLock();
    }

    _checkHazards() {
        if (this.chapter.id === 'moria') {
            if (this.player.z > 72 && !this.world.balrogAwake) {
                this.world.balrogAwake = true;
                this.audio.roar();
                this.hud.say('A Sombra acordou. Corra pela ponte!', 4);
            }
            if (this.player.y < -2) {
                this._defeat('A fenda engoliu o portador.');
            }
        }
    }

    async _completeChapter() {
        if (this.state === 'transition') return;
        this.state = 'transition';
        this.hud.setState('transition');
        this.input.enabled = false;
        this.input.exitLock();
        this.score += 200;
        this.fadeDir = 1;
        this.hud.say(this.chapterIndex === CHAPTERS.length - 1 ? 'A jornada segue…' : 'A estrada continua.', 2.5);
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
            ['Páginas', `${this.pages}/${CHAPTERS.length}`]
        ]));
        document.querySelector('#gameOverOverlay .lede')?.replaceChildren();
        const p = document.querySelector('#defeatReason');
        if (p) p.textContent = reason;
    }

    _victory() {
        this.state = 'victory';
        this.hud.setState('victory');
        this.input.exitLock();
        const total = this.score + this.pages * 50 + Math.max(0, 600 - Math.floor(this.elapsed));
        if (total > this.settings.best) {
            this.settings.best = total;
            this.saveSettings();
        }
        this.hud.showVictory(statsBlock([
            ['Glória', String(total)],
            ['Tempo', formatTime(this.elapsed)],
            ['Páginas', `${this.pages}/${CHAPTERS.length}`],
            ['Cavaleiros evadidos', this.caught === 0 ? 'nenhum encontro fatal' : `${this.caught} vezes`]
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

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function wait(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

function boot() {
    const game = new Game();
    game.init().catch((err) => {
        console.error(err);
        game.hud.showError(err?.message || 'Falha ao iniciar a jornada.');
    });
}

boot();
