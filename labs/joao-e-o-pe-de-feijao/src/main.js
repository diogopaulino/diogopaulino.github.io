/**
 * João e o Pé de Feijão — laço principal, capítulos e câmera cinematográfica no Babylon.js.
 */

import { CHAPTERS, QUALITY, STORAGE_KEY } from './config.js';
import { clamp, lerp, detectMobile, detectSoftwareGL, formatTime } from './utils.js';
import { Input } from './input.js';
import { GameAudio } from './audio.js';
import { Hud, statsBlock } from './hud.js';
import { Player } from './player.js';
import { createSky, applyChapterSky, createLights } from './sky.js';
import { buildChapter, bindShadows } from './world.js';
import { setModelQuality } from './models.js';
import { nearestInteractable } from './npcs.js';

const B = window.BABYLON;
/* Criados sob demanda, não na avaliação do módulo: sem Babylon carregado,
   `new B.Vector3()` no topo do arquivo derrubava o módulo inteiro antes de
   qualquer guarda rodar — nem a própria tela de erro do lab chegava a aparecer.
   São scratch vectors reaproveitados a cada frame, então continuam únicos. */
let LOOK = null;
let CAM = null;

class Game {
    constructor() {
        this.hud = new Hud();
        this.canvas = document.getElementById('scene');
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
        this.fpsAccum = 0;
        this.fpsFrames = 0;
        this.hudAccum = 0;
        this.orbit = 0;
        this.pendingChapter = 0;
        this.shake = 0;
        this.carry = { beans: 0, treasures: { gold: false, hen: false, harp: false } };
        this.lastTime = performance.now();
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

    resolveQuality() {
        const choice = this.settings.quality;
        if (choice !== 'auto' && QUALITY[choice]) return QUALITY[choice];
        if (detectMobile() || detectSoftwareGL()) return QUALITY.low;
        const big = Math.min(window.innerWidth, window.innerHeight) >= 900;
        return big ? QUALITY.high : QUALITY.medium;
    }

    async init() {
        this.hud.setLoading(0.1, 'Abrindo o livro do conto…');
        this.quality = this.resolveQuality();
        this.mobile = detectMobile();
        setModelQuality(this.quality.id);

        try {
            this.engine = new B.Engine(this.canvas, true, {
                preserveDrawingBuffer: false,
                stencil: true,
                powerPreference: 'high-performance',
                antialias: this.quality.antialias
            });
        } catch (err) {
            this.hud.showError('Não foi possível criar o contexto WebGL.');
            return;
        }

        const pr = Math.min(window.devicePixelRatio || 1, this.quality.pixelRatio);
        this.engine.setHardwareScalingLevel(1 / pr);

        this.scene = new B.Scene(this.engine);
        this.scene.clearColor = new B.Color4(0.5, 0.7, 0.9, 1);

        this.camera = new B.UniversalCamera('camera', new B.Vector3(18, 10, 16), this.scene);
        this.camera.fov = 54 * (Math.PI / 180);
        this.camera.minZ = 0.12;
        this.camera.maxZ = 750;
        this.camera.inputs?.clear();

        this.sky = createSky(this.scene);

        this.hud.setLoading(0.4, 'Plantando o quintal…');
        this.input = new Input(this.canvas);
        this.audio = new GameAudio();
        this.player = new Player(this.scene);
        this.player.setVisible(false);

        this._bindUi();
        window.addEventListener('resize', () => this._resize());

        await this._loadChapter(0, { menu: true });
        this.hud.setLoading(1, 'O conto espera.');
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

        this.lastTime = performance.now();
        this._renderLoop = () => this._loop();
        if (window.LabRuntime) LabRuntime.bindBabylonLoop(this.engine, this._renderLoop);
        else this.engine.runRenderLoop(this._renderLoop);
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
            this.quality = this.resolveQuality();
            const pr = Math.min(window.devicePixelRatio || 1, this.quality.pixelRatio);
            this.engine.setHardwareScalingLevel(1 / pr);
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

    async _loadChapter(index, { menu = false } = {}) {
        const ch = CHAPTERS[index];
        this.chapterIndex = index;
        this.chapter = ch;

        if (this.world) {
            this.world.dispose();
            this.world = null;
        }
        if (this.lights) {
            this.lights.dispose();
            this.lights = null;
        }

        const world = buildChapter(ch.id, this.scene, this.quality);
        const lights = createLights(this.scene, ch, this.quality);
        this.world = world;
        this.lights = lights;
        bindShadows(world, lights);

        applyChapterSky(this.sky, ch, this.scene);
        this.audio.setTheme(ch.music);

        if (!menu) {
            const s = this.world.spawn;
            this.player.spawn(s.x, s.z, s.yaw, this.world.heightAt, s.y);
            if (index >= 1) this.player.beans = 5;
            if (index >= 4) {
                this.player.treasures = { gold: true, hen: true, harp: true };
            }
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

        this.quality = this.resolveQuality();
        const pr = Math.min(window.devicePixelRatio || 1, this.quality.pixelRatio);
        this.engine.setHardwareScalingLevel(1 / pr);

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

        await this._loadChapter(index);
        this._beginIntro();
    }

    _beginIntro() {
        this.state = 'intro';
        this.hud.setState('intro');
        this.introT = 0;
        this.player.setVisible(true);
        this.hud.showHud(true);
        this.hud.setTouchVisible(this.mobile);
        this.hud.setChapter(this.chapter);
        this.hud.setHearts(this.player.health, this.player.maxHealth);
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

    async toMenu() {
        this.hud.showPause(false);
        this.hud.hideDefeat();
        this.hud.hideVictory();
        this.hud.hideDialogue();
        this.hud.showHud(false);
        this.player.setVisible(false);
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

    _loop() {
        const now = performance.now();
        const dt = Math.min(0.05, (now - this.lastTime) / 1000);
        this.lastTime = now;
        this.time += dt;

        this._update(dt);
        this.scene.render();

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

        this.fade = clamp(this.fade + this.fadeDir * dt * 0.85, 0, 1);
        document.getElementById('fade').style.opacity = String(this.fade);
        this.shake = Math.max(0, this.shake - dt * 4);

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
        if (info.jumped) this.audio.chime();
        if (info.fell) {
            this._defeat('João caiu das nuvens.');
            return;
        }

        this._updateNpcs(dt);
        this._updateInteract();
        this._updateChapterLogic(dt);
        this._followCamera(dt);

        if (this.sky?.mesh) {
            this.sky.mesh.position.copyFrom(this.camera.position);
        }
        if (this.quality.shadows && this.lights?.dir) {
            this.lights.dir.position.set(
                this.player.x + this.chapter.sun.dir[0] * 50,
                this.player.y + this.chapter.sun.dir[1] * 50,
                this.player.z + this.chapter.sun.dir[2] * 50
            );
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
        this.camera.setTarget(new B.Vector3(0, 2.5, 0));
        if (this.sky?.mesh) this.sky.mesh.position.copyFrom(this.camera.position);
    }

    _updateIntro(dt) {
        this.introT += dt;
        const t = clamp(this.introT / 3.2, 0, 1);
        const e = t * t * (3 - 2 * t);
        const o = this.world.overview;
        if (!CAM) {
            CAM = new B.Vector3();
            LOOK = new B.Vector3();
        }
        this.player.cameraPosition(CAM);
        this.player.lookAt(LOOK);
        this.camera.position.set(
            lerp(o.x, CAM.x, e),
            lerp(o.y, CAM.y, e),
            lerp(o.z, CAM.z, e)
        );
        const look = new B.Vector3(
            lerp(0, LOOK.x, e),
            lerp(3, LOOK.y, e),
            lerp(0, LOOK.z, e)
        );
        this.camera.setTarget(look);
        if (t >= 1) {
            this.state = 'playing';
            this.hud.setState('playing');
            this.input.enabled = true;
            this.hud.say(this.mobile ? 'Toque para olhar e andar.' : 'Clique no mundo para olhar com o mouse.', 3.2);
        }
    }

    _followCamera(dt) {
        this.player.cameraPosition(CAM);
        this.player.lookAt(LOOK);
        const gy = this.world.heightAt(CAM.x, CAM.z) + 1.15;
        if (CAM.y < gy) CAM.y = gy;
        const k = 1 - Math.exp(-10 * (dt || 0.016));
        this.camera.position.x = lerp(this.camera.position.x, CAM.x, k);
        this.camera.position.y = lerp(this.camera.position.y, CAM.y, k);
        this.camera.position.z = lerp(this.camera.position.z, CAM.z, k);

        if (this.shake > 0) {
            this.camera.position.x += (Math.random() - 0.5) * this.shake * 0.35;
            this.camera.position.y += (Math.random() - 0.5) * this.shake * 0.2;
        }
        this.camera.setTarget(LOOK);
    }

    _updateNpcs(dt) {
        if (this.world.cow) {
            this.world.cow.update(dt, this.player, this.world.heightAt);
        }

        const giant = this.world.giant;
        if (!giant) {
            if (this.chapter.id !== 'escape') this.hud.setMeter('', 0);
            return;
        }

        let ev;
        if (this.chapter.id === 'escape' && !this.world.flags.chopped) {
            ev = giant.chaseDown(dt, this.player, this.world.stalkX, this.world.stalkZ);
            this.hud.setMeter('O gigante desce', clamp((80 - giant.y) / 80, 0, 1), giant.y < this.player.y + 10);
        } else if (this.chapter.id === 'castle') {
            ev = giant.update(dt, this.player, this.world.heightAt);
            this.hud.setMeter('O gigante fareja', giant.alert, giant.alert > 0.55 || giant.state === 'chase');
            if (ev === 'stir') {
                this.audio.roar();
                this.hud.say('Fee-fi-fo-fum! O gigante acordou!', 4);
            }
        } else {
            ev = giant.update(dt, this.player, this.world.heightAt);
        }

        if (ev === 'caught') {
            this.caught += 1;
            this.audio.danger();
            this.hud.flashHit();
            this.shake = 1.2;
            if (this.player.hurt(1)) {
                this.hud.setHearts(this.player.health, this.player.maxHealth);
                this.hud.say('O gigante quase te pegou!', 2.5);
                if (!this.player.alive) {
                    this._defeat('Fee-fi-fo-fum. O gigante alcançou João.');
                } else {
                    this.player.x -= Math.sin(giant.yaw) * 3.2;
                    this.player.z -= Math.cos(giant.yaw) * 3.2;
                    this.player.invuln = 1.6;
                }
            }
        }
    }

    _updateInteract() {
        const near = nearestInteractable(this.player, this.world.interactables);
        let label = near ? near.label : '';
        if (near?.kind === 'goal' && this.chapter.id === 'cottage' && !this.player.hasCow) {
            label = 'Leve a Mimosa com você';
        }
        if (near?.kind === 'chop' && !this.player.hasAxe) {
            label = 'Pegue o machado primeiro';
        }
        if (near?.kind === 'plant' && !this.world.flags.talkedMother) {
            label = 'Fale com a mãe primeiro';
        }
        if (near?.kind === 'goal' && this.chapter.id === 'night' && !this.world.flags.grown) {
            label = '';
        }
        if (near?.kind === 'chop' && this.player.hasAxe) {
            label = `Cortar o pé (${this.world.chop}/${this.world.chopNeeded})`;
        }
        this.hud.setPrompt(label);
        if (!near || !this.input.consumeInteract()) return;

        if (near.kind === 'talk') {
            this._openDialogue(near.speaker, near.lines, near);
            return;
        }
        if (near.kind === 'cow') {
            if (!this.world.flags.talkedMother) {
                this.hud.say('Fale com a mãe antes de levar a Mimosa.', 3);
                return;
            }
            this.player.hasCow = true;
            this.world.cow.follow = true;
            this.world.flags.hasCow = true;
            near.done = true;
            this.audio.moo();
            const gx = 16;
            const gz = 9;
            this.player.facing = Math.atan2(gx - this.player.x, gz - this.player.z);
            this.player.yaw = this.player.facing;
            this.player.camYaw = this.player.facing + Math.PI;
            this.hud.say('A Mimosa te segue. Siga o caminho de terra até o arco dourado.', 4);
            this.hud.setObjective('Siga o caminho de terra até o arco da feira.');
            this.score += 40;
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
                if (!this.world.flags.grown || this.player.y < 64) {
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
            if (!this.world.flags.talkedMother) {
                this.hud.say('Primeiro, fale com a mãe.', 2.5);
                return;
            }
            if (this.world.flags.growing || this.world.flags.grown) return;
            near.done = true;
            this.world.growStalk();
            this.audio.grow();
            this.hud.say('Os feijões acordam. O pé sobe até as nuvens…', 5);
            this.hud.setObjective('Suba o pé de feijão — trepe no caule ou pule nas folhas.');
            this.score += 80;
            return;
        }
        if (near.kind === 'treasure') {
            near.done = true;
            if (near.mesh) near.mesh.setEnabled(false);
            this.player.treasures[near.id] = true;
            this.score += 120;
            this._syncRelics();
            if (near.id === 'harp') {
                this.audio.harp();
                this.world.giant?.wake();
                this.hud.say('A harpa canta — o gigante abre um olho!', 4);
            } else {
                this.audio.pickup();
                this.hud.say(near.id === 'gold' ? 'O saco de ouro é seu.' : 'A galinha dos ovos de ouro!', 3);
            }
            if (this.player.treasureCount >= 3) {
                this.hud.say('Os três tesouros estão na sacola. Fuja!', 3);
                this._completeChapter();
            }
            return;
        }
        if (near.kind === 'axe') {
            near.done = true;
            if (near.mesh) near.mesh.setEnabled(false);
            this.player.hasAxe = true;
            this.audio.pickup();
            this.hud.say('O machado está na mão. Corte o pé!', 3.5);
            this.hud.setObjective('Corte o pé de feijão na base — aperte E várias vezes.');
            this.score += 60;
            return;
        }
        if (near.kind === 'chop') {
            if (!this.player.hasAxe) {
                this.hud.say('O machado está junto à lenha, ao lado da cabana.', 3);
                return;
            }
            this.world.chop += 1;
            this.audio.chop();
            this.shake = 0.8;
            this.hud.setMeter('Corte o pé', this.world.chop / this.world.chopNeeded, false);
            if (this.world.stalk) {
                this.world.stalk.group.rotation.z = (this.world.chop / this.world.chopNeeded) * 0.35;
            }
            if (this.world.chop >= this.world.chopNeeded) {
                this._chopDown();
            }
        }
    }

    _updateChapterLogic(dt) {
        if (this.chapter.id === 'cottage' && this.player.hasCow) {
            const gate = this.world.interactables.find((i) => i.id === 'gate');
            if (gate && !gate.done && Math.hypot(this.player.x - gate.x, this.player.z - gate.z) < 4.2) {
                gate.done = true;
                this.audio.chime();
                this._completeChapter();
                return;
            }
        }
        if (this.chapter.id === 'night' && this.world.flags.grown && this.player.y > 66) {
            const clouds = this.world.interactables.find((i) => i.id === 'clouds');
            if (clouds && !clouds.done && Math.hypot(this.player.x - clouds.x, this.player.z - clouds.z) < 3.2) {
                clouds.done = true;
                this.audio.chime();
                this._completeChapter();
            }
        }
        if (this.chapter.id === 'escape' && this.world.flags.chopped) {
            if (this.world.stalk) {
                this.world.stalk.group.userData = this.world.stalk.group.userData || {};
                this.world.stalk.group.userData.fall = (this.world.stalk.group.userData.fall || 0) + dt * 0.9;
                this.world.stalk.group.rotation.z = Math.min(1.35, this.world.stalk.group.userData.fall);
            }
        }
    }

    _chopDown() {
        if (this.world.flags.chopped) return;
        this.world.flags.chopped = true;
        this.audio.crash();
        this.audio.roar();
        this.shake = 2.2;
        this.world.giant?.drop();
        this.hud.say('O pé cai — e o gigante com ele.', 4);
        this.hud.setMeter('', 0);
        this.score += 250;
        wait(2200).then(() => {
            if (this.state === 'playing' || this.state === 'transition') this._completeChapter();
        });
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
        if (item) {
            if (item.id === 'mother') {
                this.world.flags.talkedMother = true;
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
                if (this.world.cow) {
                    this.world.cow.follow = false;
                    this.world.cow.parked = true;
                    this.world.cow.x = 1.6;
                    this.world.cow.z = 12.4;
                }
                this._syncRelics();
                this.audio.beans();
                this.hud.say('Cinco feijões mágicos. A Mimosa fica com o mercador.', 4);
                item.done = true;
                this.score += 100;
                this.dialogue = null;
                this.hud.hideDialogue();
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
        this.input.enabled = false;
        this.input.exitLock();
        this.score += 200;
        this.fadeDir = 1;
        const last = this.chapterIndex === CHAPTERS.length - 1;
        this.hud.say(last ? 'E viveram com ouro, ovos e música.' : 'O conto continua…', 2.5);
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
            ['Tesouros', `${this.player.treasureCount}/3`]
        ]));
        const p = document.querySelector('#defeatReason');
        if (p) p.textContent = reason;
    }

    _victory() {
        this.state = 'victory';
        this.hud.setState('victory');
        this.input.exitLock();
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

    _resize() {
        this.engine.resize();
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

