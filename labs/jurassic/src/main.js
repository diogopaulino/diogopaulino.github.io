/**
 * Jurassic — laço principal, câmera cinematográfica e diário de campo.
 */

import * as THREE from 'three';
import { STORAGE_KEY, QUALITY, CAMERA, WORLD, SPECIES } from './config.js';
import { clamp, damp, detectMobile, detectSoftwareGL, rendererIsSoftware } from './utils.js';
import { Input } from './input.js';
import { ParkAudio } from './audio.js';
import { Hud } from './hud.js';
import { World } from './world.js';
import { Jeep } from './jeep.js';
import { spawnDinosaurs } from './dinosaurs.js';
import { createSky, createLights, sampleDay, applySky, applyLights } from './sky.js';

const TOD_LABELS = [
    [0.18, 'Madrugada'],
    [0.32, 'Amanhecer'],
    [0.48, 'Manhã'],
    [0.62, 'Meio-dia'],
    [0.78, 'Entardecer'],
    [1.0, 'Anoitecer']
];

function todLabel(t) {
    for (const [k, n] of TOD_LABELS) if (t <= k) return n;
    return 'Noite';
}

class Game {
    constructor() {
        this.hud = new Hud();
        this.canvas = document.getElementById('scene');
        this.settings = this.loadSettings();
        this.state = 'loading';
        this.time = 0;
        this.elapsed = 0;
        this.tod = 0.30;
        this.rain = false;
        this.logged = new Set();
        this.observeId = null;
        this.observeT = 0;
        this.camYaw = 0;
        this.camPitch = CAMERA.defaultPitch;
        this.camDist = CAMERA.distance;
        this.camMode = 0;
        this.fpsAccum = 0;
        this.fpsFrames = 0;
        this.hudAccum = 0;
        this.radioAcc = 0;
        this.shakeT = 0;
        this.hideUi = false;
        this._look = new THREE.Vector3();
        this._cam = new THREE.Vector3();
        this._wanted = new THREE.Vector3();
        this._fwd = new THREE.Vector3();
    }

    loadSettings() {
        const fallback = { quality: 'auto', volume: 70, muted: false };
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
        } catch {
            return fallback;
        }
    }

    saveSettings() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
        } catch { /* privado */ }
    }

    resolveQuality() {
        const choice = this.settings.quality;
        if (choice !== 'auto' && QUALITY[choice]) return QUALITY[choice];
        if (detectMobile() || detectSoftwareGL()) return QUALITY.medium;
        const big = Math.min(window.innerWidth, window.innerHeight) >= 900;
        return big ? QUALITY.ultra : QUALITY.high;
    }

    async init() {
        this.hud.setLoading(0.1, 'Abrindo os portões do parque…');
        this.quality = this.resolveQuality();
        this.mobile = detectMobile();

        try {
            this.renderer = new THREE.WebGLRenderer({
                canvas: this.canvas,
                antialias: this.quality.antialias,
                powerPreference: 'high-performance',
                alpha: false
            });
        } catch {
            this.hud.showError('Não foi possível criar o contexto WebGL.');
            return;
        }

        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.quality.pixelRatio));
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.1;
        this.renderer.shadowMap.enabled = this.quality.shadows;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.setClearColor(0x6aa0d0);

        if (rendererIsSoftware(this.renderer) && this.quality.id !== 'low') {
            this.quality = QUALITY.low;
            this.renderer.setPixelRatio(1);
            this.renderer.shadowMap.enabled = false;
        }

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.18, 520);
        this.sky = createSky();
        this.scene.add(this.sky.mesh);
        this.lights = createLights(this.scene, this.quality);

        this.hud.setLoading(0.35, 'Erguendo a selva e o lago…');
        this.world = new World(this.scene, this.quality);

        this.hud.setLoading(0.62, 'Despertando os dinossauros…');
        this.dinos = spawnDinosaurs(this.scene, this.world, this.quality);
        this.jeep = new Jeep(this.scene);
        this.jeep.reset(WORLD.spawn);
        this.jeep.setLights(true);

        this.input = new Input(this.canvas);
        this.audio = new ParkAudio();
        this.clock = new THREE.Clock();

        if (this.quality.bloom && !rendererIsSoftware(this.renderer)) await this._bloom();

        this._bindUi();
        this._bindTouch();
        window.addEventListener('resize', () => this._resize());

        this.hud.el.qualitySelect.value = this.settings.quality;
        this.hud.el.volumeSlider.value = String(this.settings.volume);
        this.hud.setVolumeLabel(this.settings.volume);
        this.hud.setMuted(this.settings.muted);
        this.hud.setLoading(1, 'O portão está aberto.');
        this.hud.hideLoading();
        this.hud.showMenu(true);
        this.state = 'menu';
        this.hud.setState('menu');
        this._applyAtmosphere();
        this._heroCamera();
        this._loop();
    }

    async _bloom() {
        try {
            const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }] = await Promise.all([
                import('three/addons/postprocessing/EffectComposer.js'),
                import('three/addons/postprocessing/RenderPass.js'),
                import('three/addons/postprocessing/UnrealBloomPass.js'),
                import('three/addons/postprocessing/OutputPass.js')
            ]);
            this.composer = new EffectComposer(this.renderer);
            this.composer.setPixelRatio(this.renderer.getPixelRatio());
            this.composer.setSize(window.innerWidth, window.innerHeight);
            this.composer.addPass(new RenderPass(this.scene, this.camera));
            this.bloom = new UnrealBloomPass(
                new THREE.Vector2(window.innerWidth, window.innerHeight),
                0.22, 0.5, 0.82
            );
            this.composer.addPass(this.bloom);
            this.composer.addPass(new OutputPass());
        } catch {
            this.composer = null;
        }
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
        document.getElementById('retryButton').addEventListener('click', () => this.start());
        document.getElementById('caughtMenuButton').addEventListener('click', () => this.toMenu());
        document.getElementById('replayButton').addEventListener('click', () => this.start());
        document.getElementById('victoryMenuButton').addEventListener('click', () => this.toMenu());
        this.hud.el.soundButton.addEventListener('click', () => this.toggleMute());
        this.hud.el.pauseButton.addEventListener('click', () => {
            if (this.state === 'play') this.pause();
            else if (this.state === 'pause') this.resume();
        });
        this.input.on('pause', () => {
            if (this.state === 'play') this.pause();
            else if (this.state === 'pause') this.resume();
        });
        this.input.on('mute', () => this.toggleMute());
        this.input.on('camera', () => { this.camMode = (this.camMode + 1) % 3; });
        this.input.on('lights', () => this.jeep.setLights(!this.jeep.lightsOn));
        this.input.on('tod', () => {
            this.tod = (this.tod + 0.14) % 1;
            this.hud.setTod(todLabel(this.tod));
        });
        this.input.on('rain', () => {
            this.rain = !this.rain;
            this.hud.setRain(this.rain);
        });
        this.input.on('hud', () => {
            this.hideUi = !this.hideUi;
            this.hud.showHud(this.state === 'play' && !this.hideUi);
        });
        this.input.on('pointerdown', () => {
            if (this.state === 'play') this.input.requestLock();
        });
        this.input.on('confirm', () => {
            if (this.state === 'menu') this.start();
        });
    }

    _bindTouch() {
        const stick = document.getElementById('moveStick');
        const knob = document.getElementById('moveKnob');
        const look = document.getElementById('lookZone');
        const observe = document.getElementById('btnObserve');
        if (!stick) return;

        const bindStick = (el, setter) => {
            let pid = null;
            const go = (e) => {
                const t = [...e.changedTouches].find((x) => x.identifier === pid) || e.touches[0];
                if (!t) return;
                const r = el.getBoundingClientRect();
                const x = ((t.clientX - r.left) / r.width) * 2 - 1;
                const y = ((t.clientY - r.top) / r.height) * 2 - 1;
                setter(x, y);
                if (knob && el === stick) {
                    knob.style.transform = `translate(${clamp(x, -1, 1) * 22}px, ${clamp(y, -1, 1) * 22}px)`;
                }
            };
            el.addEventListener('touchstart', (e) => {
                pid = e.changedTouches[0].identifier;
                go(e);
                e.preventDefault();
            }, { passive: false });
            el.addEventListener('touchmove', (e) => { go(e); e.preventDefault(); }, { passive: false });
            const end = () => {
                pid = null;
                setter(0, 0);
                if (knob && el === stick) knob.style.transform = '';
            };
            el.addEventListener('touchend', end);
            el.addEventListener('touchcancel', end);
        };

        bindStick(stick, (x, y) => {
            this.input.touchMove.x = clamp(x, -1, 1);
            this.input.touchMove.y = clamp(-y, -1, 1);
        });
        bindStick(look, (x, y) => {
            this.input.touchLook.x = clamp(x, -1, 1);
            this.input.touchLook.y = clamp(y, -1, 1);
        });
        observe?.addEventListener('touchstart', (e) => {
            this.input.observeHeld = true;
            this.input.observePressed = true;
            e.preventDefault();
        });
        observe?.addEventListener('touchend', () => { this.input.observeHeld = false; });
    }

    start() {
        this.logged.clear();
        this.hud._fillCatalog();
        this.elapsed = 0;
        this.observeId = null;
        this.observeT = 0;
        this.camMode = 0;
        this.camYaw = 0;
        this.camPitch = CAMERA.defaultPitch;
        this.camDist = CAMERA.distance;
        this.shakeT = 0;
        this.jeep.reset(WORLD.spawn);
        this._snapCamera();
        this.dinos.trex.caught = false;
        this.hud.hideCaught();
        this.hud.hideVictory();
        this.hud.showMenu(false);
        this.hud.showPause(false);
        this.hud.showHud(true);
        this.hud.showTouch(this.mobile);
        this.hud.setRain(this.rain);
        this.hud.setTod(todLabel(this.tod));
        this.hud.randomRadio();
        this.state = 'play';
        this.hud.setState('play');
        this.input.enabled = true;
        this.audio.setVolume(this.settings.volume / 100);
        this.audio.setEnabled(!this.settings.muted);
        this.audio.resume();
        this.input.requestLock();
        this.clock.getDelta();
    }

    pause() {
        if (this.state !== 'play') return;
        this.state = 'pause';
        this.hud.setState('pause');
        this.hud.showPause(true);
        this.input.exitLock();
        this.input.enabled = false;
    }

    resume() {
        this.hud.showPause(false);
        this.state = 'play';
        this.hud.setState('play');
        this.input.enabled = true;
        this.input.requestLock();
        this.clock.getDelta();
    }

    toMenu() {
        this.input.exitLock();
        this.input.enabled = true;
        this.hud.hideCaught();
        this.hud.hideVictory();
        this.hud.showPause(false);
        this.hud.showHud(false);
        this.hud.showMenu(true);
        this.state = 'menu';
        this.hud.setState('menu');
    }

    toggleMute() {
        this.settings.muted = !this.settings.muted;
        this.audio.setEnabled(!this.settings.muted);
        this.hud.setMuted(this.settings.muted);
        this.saveSettings();
        if (!this.settings.muted) this.audio.resume();
    }

    _applyAtmosphere() {
        const pal = sampleDay(this.tod);
        applySky(this.sky, pal);
        applyLights(this.lights, pal, this.rain);
        this.renderer.toneMappingExposure = pal.exp * (this.rain ? 0.88 : 1);
        this.scene.fog = new THREE.FogExp2(pal.fog, this.rain ? 0.012 : 0.0075);
        this.renderer.setClearColor(pal.fog);
        if (this.world.waterMat) this.world.waterMat.uniforms.uSun.value.copy(pal.sunDir);
    }

    _nearestDino() {
        let best = null;
        let bestD = 1e9;
        const px = this.jeep.x;
        const pz = this.jeep.z;
        for (const d of this.dinos.list) {
            const spec = SPECIES.find((s) => s.id === d.id);
            if (!spec) continue;
            const dx = d.position.x - px;
            const dz = d.position.z - pz;
            const dist = Math.hypot(dx, dz);
            if (dist < spec.observe && dist < bestD) {
                bestD = dist;
                best = { dino: d, spec, dist };
            }
        }
        return best;
    }

    _updateObserve(dt) {
        const near = this._nearestDino();
        const holding = this.input.observeHeld;
        if (near) {
            this.hud.setPrompt(holding ? 'Registrando…' : 'Segure E / botão direito para observar');
            if (holding) {
                this.observeId = near.spec.id;
                this.observeT += dt;
                this.hud.setDossier(near.spec, true);
                if (this.observeT >= near.spec.log && !this.logged.has(near.spec.id)) {
                    this.logged.add(near.spec.id);
                    this.hud.setLogged(near.spec.id);
                    this.hud.setRadio(`Diário: ${near.spec.common} catalogado. ${this.logged.size}/6`);
                    if (this.logged.size >= 6) this._win();
                }
            } else {
                this.observeT = 0;
                this.hud.setDossier(near.spec, false);
            }
        } else {
            this.observeT = 0;
            this.hud.setPrompt('');
            this.hud.setDossier(null, false);
        }
        return near && holding ? near : null;
    }

    _win() {
        this.state = 'victory';
        this.hud.setState('victory');
        this.input.exitLock();
        this.hud.showHud(false);
        this.hud.showVictory(`
            <span>Espécies <b>6/6</b></span>
            <span>Tempo <b>${this.hud.el.time.textContent}</b></span>
        `);
    }

    _caught() {
        this.state = 'caught';
        this.hud.setState('caught');
        this.input.exitLock();
        this.hud.showHud(false);
        this.hud.setShake(true);
        this.audio.roar(1.4);
        this.hud.showCaught(`
            <span>O rex alcançou o jipe.</span>
            <span>Espécies <b>${this.logged.size}/6</b></span>
        `);
        setTimeout(() => this.hud.setShake(false), 900);
    }

    _heroCamera() {
        const t = this.time * 0.085;
        this.camera.fov = 46;
        this.camera.updateProjectionMatrix();
        this.camera.position.set(
            -8 + Math.cos(t) * 32,
            13.5,
            8 + Math.sin(t) * 26
        );
        this.camera.lookAt(-12, 7.2, -4);
        this._cam.copy(this.camera.position);
    }

    _snapCamera() {
        const yaw = this.jeep.yaw;
        this._wanted.set(
            this.jeep.x - Math.sin(yaw) * CAMERA.distance,
            this.jeep.y + CAMERA.height,
            this.jeep.z - Math.cos(yaw) * CAMERA.distance
        );
        this._cam.copy(this._wanted);
        this.camera.position.copy(this._wanted);
        this.camera.lookAt(
            this.jeep.x + Math.sin(yaw) * CAMERA.lookAhead,
            this.jeep.y + CAMERA.lookY,
            this.jeep.z + Math.cos(yaw) * CAMERA.lookAhead
        );
    }

    _camera(dt, observe) {
        const look = this.input.consumeLook();
        this.camYaw -= look.x * 0.0022;
        this.camPitch = clamp(this.camPitch - look.y * 0.002, CAMERA.pitchMin, CAMERA.pitchMax);
        this.camDist = clamp(this.camDist + this.input.consumeZoom() * 0.9, CAMERA.minDistance, CAMERA.maxDistance);

        const modes = [
            { dist: this.camDist, h: CAMERA.height, fov: 50 },
            { dist: this.camDist * 1.55, h: 8.4, fov: 46 },
            { dist: 2.1, h: 1.72, fov: 64 }
        ];
        const m = modes[this.camMode];
        this.camera.fov = damp(this.camera.fov, observe ? 36 : m.fov, 6, dt);
        this.camera.updateProjectionMatrix();

        const yaw = this.jeep.yaw + this.camYaw;
        this._fwd.set(Math.sin(yaw), 0, Math.cos(yaw));
        const jYaw = this.jeep.yaw;
        const lookAt = observe
            ? this._look.set(observe.dino.position.x, observe.dino.position.y + 3.2, observe.dino.position.z)
            : this._look.set(
                this.jeep.x + Math.sin(jYaw) * CAMERA.lookAhead,
                this.jeep.y + CAMERA.lookY,
                this.jeep.z + Math.cos(jYaw) * CAMERA.lookAhead
            );

        this._wanted.set(
            this.jeep.x - this._fwd.x * m.dist,
            this.jeep.y + m.h + this.camPitch * 7,
            this.jeep.z - this._fwd.z * m.dist
        );
        if (this.camMode === 2 && !observe) {
            this._wanted.set(
                this.jeep.x + Math.sin(jYaw) * 0.35,
                this.jeep.y + 1.78,
                this.jeep.z + Math.cos(jYaw) * 0.35
            );
        }
        if (observe) {
            const ox = observe.dino.position.x - this.jeep.x;
            const oz = observe.dino.position.z - this.jeep.z;
            const len = Math.hypot(ox, oz) || 1;
            this._wanted.set(
                this.jeep.x - (ox / len) * 8,
                this.jeep.y + 4.2,
                this.jeep.z - (oz / len) * 8
            );
        }

        const ground = this.world.heightAt(this._wanted.x, this._wanted.z) + 1.4;
        this._wanted.y = Math.max(this._wanted.y, ground);
        this._cam.lerp(this._wanted, 1 - Math.exp(-5.5 * dt));
        if (this.shakeT > 0) {
            this._cam.x += (Math.random() - 0.5) * this.shakeT * 0.35;
            this._cam.y += (Math.random() - 0.5) * this.shakeT * 0.2;
        }
        this.camera.position.copy(this._cam);
        this.camera.lookAt(lookAt);
    }

    _resize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
        this.composer?.setSize(w, h);
        this.bloom?.setSize(w, h);
    }

    _loop = () => {
        requestAnimationFrame(this._loop);
        const dt = Math.min(0.05, this.clock.getDelta());
        this.time += dt;

        if (this.state === 'menu' || this.state === 'pause' || this.state === 'victory' || this.state === 'caught') {
            this.tod += dt * 0.003;
            this._applyAtmosphere();
            this.world.update(dt, this.time, this.jeep, this.rain);
            for (const d of this.dinos.list) d.update(dt, this.time, { x: this.jeep.x, z: this.jeep.z, speed: 0 });
            if (this.state === 'menu') this._heroCamera();
            else this._camera(dt, null);
            this._render();
            return;
        }

        this.elapsed += dt;
        this.tod += dt * 0.0045;
        if (this.tod > 1) this.tod -= 1;
        this._applyAtmosphere();

        const jeepState = this.jeep.update(dt, this.input, this.world);
        this.world.update(dt, this.time, this.jeep, this.rain);

        for (const d of this.dinos.list) d.update(dt, this.time, jeepState);

        const rexDist = Math.hypot(this.dinos.trex.position.x - this.jeep.x, this.dinos.trex.position.z - this.jeep.z);
        if (rexDist < 22) {
            this.shakeT = damp(this.shakeT, clamp((22 - rexDist) / 22, 0, 1), 6, dt);
            if (rexDist < 14) this.audio.roar(1);
        } else {
            this.shakeT = damp(this.shakeT, 0, 4, dt);
        }
        this.hud.setShake(this.shakeT > 0.35);

        if (this.dinos.trex.caught) {
            this._caught();
            this._render();
            return;
        }

        const observe = this._updateObserve(dt);
        this._camera(dt, observe);

        this.radioAcc += dt;
        if (this.radioAcc > 28) {
            this.radioAcc = 0;
            this.hud.randomRadio();
        }
        this.hud.tickRadio(dt);

        const kmh = Math.abs(this.jeep.speed) * 3.6;
        this.hud.setSpeed(kmh, this.jeep.onRoad);
        this.hud.setTime(this.elapsed);
        this.hud.setTod(todLabel(this.tod));

        this.audio.update(dt, this.jeep.speed, this.rain, rexDist < 18);
        if (this.world.sparks.length && Math.random() < dt * 2) this.audio.spark();

        this.fpsAccum += dt;
        this.fpsFrames++;
        this.hudAccum += dt;
        if (this.hudAccum > 0.4) {
            this.hud.setFps(Math.round(this.fpsFrames / this.fpsAccum));
            this.fpsAccum = 0;
            this.fpsFrames = 0;
            this.hudAccum = 0;
        }

        this._render();
    };

    _render() {
        if (this.composer) this.composer.render();
        else this.renderer.render(this.scene, this.camera);
    }
}

const game = new Game();
game.init().catch((err) => {
    console.error(err);
    document.getElementById('errorOverlay').hidden = false;
    document.getElementById('loadingOverlay').hidden = true;
});
