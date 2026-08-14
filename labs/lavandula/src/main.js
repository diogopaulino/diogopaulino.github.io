/**
 * Lavandula — laço principal, câmera cinematográfica e memórias do campo.
 */

import * as THREE from 'three';
import { QUALITY, STORAGE_KEY, MEMORIES, LIGHT } from './config.js';
import { clamp, detectMobile, detectSoftwareGL, rendererIsSoftware, formatTime } from './utils.js';
import { Input } from './input.js';
import { GameAudio } from './audio.js';
import { Hud, statsBlock } from './hud.js';
import { Player } from './player.js';
import { createSky, createLights } from './sky.js';
import { World } from './world.js';

const LOOK = new THREE.Vector3();
const CAM = new THREE.Vector3();
const CAM_SMOOTH = new THREE.Vector3();

class Game {
    constructor() {
        this.hud = new Hud();
        this.canvas = document.getElementById('scene');
        this.settings = this.loadSettings();
        this.state = 'loading';
        this.time = 0;
        this.elapsed = 0;
        this.found = new Set();
        this.introT = 0;
        this.fade = 1;
        this.fadeDir = -1;
        this.fpsAccum = 0;
        this.fpsFrames = 0;
        this.hudAccum = 0;
        this.ended = false;
    }

    loadSettings() {
        const fallback = { quality: 'auto', volume: 70, muted: false };
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
        this.hud.setLoading(0.1, 'Abrindo os campos…');
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
        this.renderer.toneMappingExposure = LIGHT.exposure;
        this.renderer.shadowMap.enabled = this.quality.shadows;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.setClearColor(LIGHT.clear);

        if (rendererIsSoftware(this.renderer) && this.quality.id !== 'low') {
            this.quality = QUALITY.low;
            this.renderer.setPixelRatio(1);
            this.renderer.shadowMap.enabled = false;
        }

        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(LIGHT.fog, LIGHT.fogNear, this.quality.drawDistance * 0.72);
        this.camera = new THREE.PerspectiveCamera(
            48,
            window.innerWidth / window.innerHeight,
            0.12,
            this.quality.drawDistance
        );

        this.hud.setLoading(0.28, 'Pintando o entardecer…');
        this.sky = createSky();
        this.scene.add(this.sky.mesh);
        this.lights = createLights(this.scene, this.quality);

        this.hud.setLoading(0.55, 'Plantando as fileiras…');
        this.world = new World(this.scene, this.quality);
        this.player = new Player(this.scene);
        this.player.root.visible = false;

        this.input = new Input(this.canvas);
        this.audio = new GameAudio();
        this.timer = new THREE.Timer();
        this.timer.connect(document);

        this._bindUi();
        window.addEventListener('resize', () => this._resize());

        this.hud.setLoading(1, 'Os campos esperam.');
        this.hud.hideLoading();
        this.hud.el.qualitySelect.value = this.settings.quality;
        this.hud.el.volumeSlider.value = String(this.settings.volume);
        this.hud.setVolumeLabel(this.settings.volume);
        this.hud.setMuted(this.settings.muted);
        this.hud.showMenu(true);
        this.state = 'menu';
        this.hud.setState('menu');
        this._placeMenuCamera();
        this._loop();
    }

    _placeMenuCamera() {
        this.camera.position.set(18, 8.5, 42);
        this.camera.lookAt(0, 2.2, -10);
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
        document.getElementById('startButton').addEventListener('click', () => this.start());
        document.getElementById('resumeButton').addEventListener('click', () => this.resume());
        document.getElementById('pauseMenuButton').addEventListener('click', () => this.toMenu());
        document.getElementById('againButton').addEventListener('click', () => this.start());
        document.getElementById('restMenuButton').addEventListener('click', () => this.toMenu());
        this.hud.el.soundButton.addEventListener('click', () => this.toggleMute());
        this.hud.el.pauseButton.addEventListener('click', () => this.pause());

        this.input.on('pause', () => {
            if (this.state === 'playing') this.pause();
            else if (this.state === 'pause') this.resume();
        });
        this.input.on('camera', () => {
            const dists = [3.6, 5.8, 9.2];
            const i = dists.findIndex((d) => Math.abs(this.player.camDist - d) < 0.35);
            this.player.camDist = dists[(i + 1) % dists.length];
        });
        this.input.on('mute', () => this.toggleMute());
        this.input.on('pointerdown', () => {
            if (this.state === 'playing') this.input.requestLock();
        });

        this._bindTouch();
    }

    _bindTouch() {
        const stick = document.getElementById('moveStick');
        const knob = document.getElementById('moveKnob');
        if (!stick || !knob) return;
        const setFrom = (cx, cy) => {
            const r = stick.getBoundingClientRect();
            let dx = (cx - (r.left + r.width / 2)) / (r.width * 0.5);
            let dy = (cy - (r.top + r.height / 2)) / (r.height * 0.5);
            const len = Math.hypot(dx, dy);
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

        document.getElementById('btnSit')?.addEventListener('click', () => {
            this.input.sitPressed = true;
        });
        document.getElementById('btnInteract')?.addEventListener('click', () => {
            this.input.interactPressed = true;
        });
        document.getElementById('btnStride')?.addEventListener('pointerdown', () => {
            this.input.touchSprint = true;
        });
        document.getElementById('btnStride')?.addEventListener('pointerup', () => {
            this.input.touchSprint = false;
        });
        document.getElementById('btnStride')?.addEventListener('pointercancel', () => {
            this.input.touchSprint = false;
        });
    }

    async start() {
        this.hud.showMenu(false);
        this.hud.hideRest();
        this.audio.unlock();
        this.audio.setVolume(this.settings.volume / 100);
        this.audio.setMuted(this.settings.muted);

        this.found = new Set();
        this.elapsed = 0;
        this.ended = false;
        this.introT = 0;
        this.fade = 1;
        this.fadeDir = -1;
        this.player.spawn(this.world.heightAt);
        CAM_SMOOTH.copy(this.player.cameraPosition(CAM));
        this.hud.setMemories(0);
        this.hud.setTime(0);
        this.hud.setObjective('Ande pela estrada. Os campos não pedem nada.');
        this.hud.showHud(true);
        this.hud.setTouchVisible(this.mobile);
        this.hud.say('O vento nas fileiras. Anda quando quiser.', 5);
        this.state = 'intro';
        this.hud.setState('intro');
        this.input.enabled = true;
    }

    pause() {
        if (this.state !== 'playing' && this.state !== 'intro') return;
        this.state = 'pause';
        this.hud.setState('pause');
        this.hud.showPause(true);
        this.hud.showHud(false);
        this.input.exitLock();
        this.input.enabled = false;
    }

    resume() {
        this.hud.showPause(false);
        this.hud.showHud(true);
        this.state = 'playing';
        this.hud.setState('playing');
        this.input.enabled = true;
    }

    toMenu() {
        this.hud.showPause(false);
        this.hud.hideRest();
        this.hud.showHud(false);
        this.player.root.visible = false;
        this.hud.showMenu(true);
        this.state = 'menu';
        this.hud.setState('menu');
        this.input.exitLock();
        this.input.enabled = true;
        this._placeMenuCamera();
    }

    toggleMute() {
        this.settings.muted = !this.settings.muted;
        this.audio.setMuted(this.settings.muted);
        this.hud.setMuted(this.settings.muted);
        this.saveSettings();
    }

    _resize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
    }

    _updateCamera(dt) {
        this.player.cameraPosition(CAM);
        const ground = this.world.heightAt(CAM.x, CAM.z) + 0.55;
        if (CAM.y < ground) CAM.y = ground;
        CAM_SMOOTH.lerp(CAM, 1 - Math.exp(-8 * dt));
        this.camera.position.copy(CAM_SMOOTH);
        this.player.lookAt(LOOK);
        this.camera.lookAt(LOOK);
        if (this.quality.shadows && this.lights.dir) {
            this.lights.dir.target.position.set(this.player.x, this.player.y, this.player.z);
            this.lights.dir.target.updateMatrixWorld();
            this.lights.dir.position.set(
                this.player.x + LIGHT.sunDir[0] * 70,
                this.player.y + LIGHT.sunDir[1] * 70,
                this.player.z + LIGHT.sunDir[2] * 70
            );
        }
    }

    _collect(mem) {
        if (this.found.has(mem.id)) return;
        this.found.add(mem.id);
        this.audio.chime();
        this.hud.showMemory(mem);
        this.hud.setMemories(this.found.size);
        this.hud.say(mem.line, 6);
        if (mem.sit && !this.player.sitting) this.player.sitting = true;

        if (this.found.size >= MEMORIES.length && !this.ended) {
            this.ended = true;
            this.hud.setObjective('Os campos ficam. Você também.');
            setTimeout(() => this._rest(), 4200);
        } else {
            const left = MEMORIES.length - this.found.size;
            this.hud.setObjective(
                left === 1
                    ? 'Falta um lugar quieto.'
                    : `${left} lugares quietos ainda esperam.`
            );
        }
    }

    _rest() {
        if (this.state !== 'playing') return;
        this.input.exitLock();
        this.hud.showHud(false);
        this.hud.showRest(statsBlock([
            ['Memórias', `${this.found.size}/${MEMORIES.length}`],
            ['Caminho', formatTime(this.elapsed)]
        ]));
        this.state = 'rest';
        this.hud.setState('rest');
    }

    _tickPlaying(dt) {
        this.elapsed += dt;
        const info = this.player.update(dt, this.input, this.world);
        if (info.footstep) this.audio.footstep();
        this.audio.update(dt, info.moving, info.sitting);

        const near = this.world.nearestMemory(this.player.x, this.player.z);
        if (near && !this.found.has(near.id)) {
            this.hud.setPrompt(near.sit ? 'sentar e lembrar' : 'lembrar');
            if (this.input.consumeInteract()) this._collect(near);
        } else {
            this.hud.setPrompt('');
            this.input.consumeInteract();
        }

        this._updateCamera(dt);
        this.hud.setTime(this.elapsed);
        this.hud.tick(dt);
    }

    _loop = () => {
        requestAnimationFrame(this._loop);
        this.timer.update();
        const dt = clamp(this.timer.getDelta(), 0, 0.05);
        this.time += dt;
        this.world.update(this.time);

        this.fade = clamp(this.fade + this.fadeDir * dt * 0.7, 0, 1);
        this.hud.setFade(this.fade);

        if (this.state === 'menu') {
            this.camera.position.x = 18 + Math.sin(this.time * 0.08) * 4;
            this.camera.position.y = 8.2 + Math.sin(this.time * 0.12) * 0.4;
            this.camera.lookAt(0, 2.2, -10);
        } else if (this.state === 'intro') {
            this.introT += dt;
            this.player.root.visible = true;
            this._updateCamera(dt);
            if (this.introT > 1.2) {
                this.state = 'playing';
                this.hud.setState('playing');
            }
        } else if (this.state === 'playing') {
            this._tickPlaying(dt);
        } else if (this.state === 'pause' || this.state === 'rest') {
            this._updateCamera(dt);
        }

        this.fpsAccum += dt;
        this.fpsFrames++;
        this.hudAccum += dt;
        if (this.hudAccum > 0.4) {
            this.hud.setFps(Math.round(this.fpsFrames / this.fpsAccum));
            this.fpsAccum = 0;
            this.fpsFrames = 0;
            this.hudAccum = 0;
        }

        this.renderer.render(this.scene, this.camera);
    };
}

const game = new Game();
game.init();
