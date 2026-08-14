/**
 * Aurelia Festival — festival de velocidade estilo Forza Horizon.
 * Renderer WebGL, bloom, câmera cinemática, eventos de speed/drift e photo mode.
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { CARS, SKIES, QUALITY, CAMERAS, RADIO, EVENTS } from './config.js';
import {
    loadSettings, saveSettings, loadBest, saveBest,
    detectQuality, clamp, damp, lerp, formatSpeed
} from './utils.js';
import { buildRoad } from './road.js';
import { buildWorld, placeEventGates, followSunShadow } from './world.js';
import { buildCar } from './carModel.js';
import { Vehicle } from './vehicle.js';
import { Traffic } from './traffic.js';
import { Smoke, SkidMarks } from './effects.js';
import { AudioEngine } from './audio.js';
import { InputManager } from './input.js';
import { Hud } from './hud.js';

const FIXED_STEP = 1 / 90;
const MAX_STEPS = 5;
const FORWARD = new THREE.Vector3();
const DESIRED = new THREE.Vector3();
const LOOK = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const CAR_POS = new THREE.Vector3();

class Game {
    constructor() {
        this.settings = loadSettings();
        this.best = loadBest();
        this.state = 'boot';
        this.audio = new AudioEngine();
        this.accumulator = 0;
        this.frameTimes = [];
        this.cameraMode = this.settings.camera || 'chase';
        this.orbit = { theta: 0.6, phi: 0.42, dist: 9, fov: 55 };
        this.photo = { filter: 'none', yaw: 0.4, pitch: 0.28, dist: 8, fov: 50 };
        this.eventState = { id: null, peak: 0, points: 0, stars: 0 };
        this.score = 0;
        this.driveTime = 0;
        this.skidAcc = 0;
        this.menuAngle = 0.4;
    }

    async init() {
        this.dom = {
            canvas: document.querySelector('#scene'),
            loader: document.querySelector('#loadingOverlay'),
            loaderText: document.querySelector('#loadingText'),
            menu: document.querySelector('#menuOverlay'),
            pause: document.querySelector('#pauseOverlay'),
            photo: document.querySelector('#photoOverlay'),
            hud: document.querySelector('#hud'),
            controls: document.querySelector('#touchControls'),
            results: document.querySelector('#resultsOverlay')
        };

        this.hud = new Hud(document);
        const qKey = this.settings.quality === 'auto' ? detectQuality() : this.settings.quality;
        this.quality = QUALITY[qKey] || QUALITY.medium;

        this.setLoading('ligando o renderer…');
        this.initRenderer();
        await this.paint();

        this.setLoading('asfaltando a Costa Aurélia…');
        this.road = buildRoad();
        await this.paint();

        this.setLoading('pintando a hora dourada…');
        this.world = buildWorld(this.road, this.quality, this.settings.sky);
        placeEventGates(this.world, this.road, EVENTS);
        await this.paint();

        this.setLoading('rolando o supercarro…');
        this.spawnPlayer(this.settings.car);
        this.traffic = new Traffic(this.world.scene, this.road, this.quality.traffic);
        this.smoke = new Smoke(this.world.scene);
        this.skids = new SkidMarks(this.world.scene);

        this.makeEnvironment();
        await this.paint();
        this.bindUi();
        this.input = new InputManager({
            root: this.dom.controls,
            actions: {
                togglePause: () => this.togglePause(),
                cycleCamera: () => this.cycleCamera(),
                resetCar: () => this.player?.recover(),
                toggleMute: () => this.toggleMute(),
                cycleRadio: () => this.cycleRadio(),
                photoMode: () => this.togglePhoto(),
                cycleSky: () => this.cycleSky()
            }
        });

        this.hud.populateMenu();
        this.syncMenuSelection();
        this.hideLoading();
        this.dom.menu.hidden = false;
        this.dom.menu.classList.add('is-visible');
        this.state = 'menu';
        this.last = performance.now();
        this.loop = this.loop.bind(this);
        requestAnimationFrame(this.loop);
    }

    setLoading(text) {
        if (this.dom?.loaderText) this.dom.loaderText.textContent = text;
    }

    paint() {
        return new Promise((resolve) => requestAnimationFrame(() => resolve()));
    }

    hideLoading() {
        this.dom.loader.classList.remove('is-visible');
        this.dom.loader.hidden = true;
    }

    initRenderer() {
        const canvas = this.dom.canvas;
        this.renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true,
            powerPreference: 'high-performance',
            alpha: false
        });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.quality.pixelRatio));
        this.renderer.setSize(window.innerWidth, window.innerHeight, false);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = SKIES[this.settings.sky]?.exposure || 1;
        this.renderer.shadowMap.enabled = !!this.quality.shadows;
        this.renderer.shadowMap.type = THREE.PCFShadowMap;

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.15, 2800);
        this.camera.position.set(8, 4, -12);

        this.composer = new EffectComposer(this.renderer);
        this.composer.setPixelRatio(this.renderer.getPixelRatio());
        this.composer.addPass(new RenderPass(new THREE.Scene(), this.camera));
        this.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.42, 0.55, 0.82);
        if (this.quality.bloom) this.composer.addPass(this.bloom);
        this.composer.addPass(new OutputPass());

        addEventListener('resize', () => this.resize());
    }

    attachComposer() {
        this.composer.passes[0].scene = this.world.scene;
    }

    makeEnvironment() {
        try {
            const pmrem = new THREE.PMREMGenerator(this.renderer);
            const envScene = new THREE.Scene();
            const envSky = this.world.sky.clone();
            envSky.geometry = new THREE.SphereGeometry(12, 16, 12);
            envScene.add(envSky);
            this.world.scene.environment = pmrem.fromScene(envScene, 0.04).texture;
            pmrem.dispose();
        } catch (err) {
            console.warn('Aurelia: environment map skipped', err);
        }
        this.attachComposer();
    }

    spawnPlayer(carId) {
        if (this.carMesh) this.world.scene.remove(this.carMesh);
        const spec = CARS.find((c) => c.id === carId) || CARS[0];
        this.settings.car = spec.id;
        this.carMesh = buildCar(spec);
        this.world.scene.add(this.carMesh);
        this.player = new Vehicle({ road: this.road, spec, isPlayer: true });
        this.player.spawn(16, 0);
        this.player.applyMesh(this.carMesh, 0.016);
        this.carMesh.userData.lightsOn = this.settings.sky === 'night' || this.settings.sky === 'dusk';
        this.hud.setCar(spec);
        this.hud.setSky(this.settings.sky);
        this.hud.setRadio(RADIO[this.audio.station]);
        this.hud.setCamera(this.cameraMode);
    }

    bindUi() {
        document.querySelector('#startButton')?.addEventListener('click', () => this.startDrive());
        document.querySelector('#resumeButton')?.addEventListener('click', () => this.togglePause(false));
        document.querySelector('#pauseMenuButton')?.addEventListener('click', () => this.backToMenu());
        document.querySelector('#photoClose')?.addEventListener('click', () => this.togglePhoto(false));
        document.querySelector('#pauseButton')?.addEventListener('click', () => this.togglePause());
        document.querySelector('#cameraButton')?.addEventListener('click', () => this.cycleCamera());
        document.querySelector('#soundButton')?.addEventListener('click', () => this.toggleMute());
        document.querySelector('#photoButton')?.addEventListener('click', () => this.togglePhoto());
        document.querySelector('#resetButton')?.addEventListener('click', () => this.player?.recover());

        document.querySelector('#carList')?.addEventListener('click', (event) => {
            const btn = event.target.closest('[data-car]');
            if (!btn) return;
            this.spawnPlayer(btn.dataset.car);
            this.syncMenuSelection();
            saveSettings(this.settings);
        });
        document.querySelector('#skyList')?.addEventListener('click', (event) => {
            const btn = event.target.closest('[data-sky]');
            if (!btn) return;
            this.setSky(btn.dataset.sky);
            this.syncMenuSelection();
            saveSettings(this.settings);
        });

        const qualitySelect = document.querySelector('#qualitySelect');
        if (qualitySelect) {
            qualitySelect.value = this.settings.quality;
            qualitySelect.addEventListener('change', () => {
                this.settings.quality = qualitySelect.value;
                saveSettings(this.settings);
            });
        }
        const volume = document.querySelector('#volumeSlider');
        if (volume) {
            volume.value = Math.round(this.settings.volume * 100);
            volume.addEventListener('input', () => {
                this.settings.volume = Number(volume.value) / 100;
                this.audio.setVolume(this.settings.volume);
                const label = document.querySelector('#volumeValue');
                if (label) label.textContent = volume.value;
                saveSettings(this.settings);
            });
        }
        document.querySelectorAll('[data-filter]').forEach((btn) => {
            btn.addEventListener('click', () => {
                this.photo.filter = btn.dataset.filter;
                this.dom.canvas.dataset.filter = this.photo.filter;
                document.querySelectorAll('[data-filter]').forEach((b) => b.classList.toggle('is-active', b === btn));
            });
        });

        this.dom.canvas.addEventListener('pointerdown', (event) => {
            if (this.state !== 'photo') return;
            this.photo.dragging = true;
            this.photo.lastX = event.clientX;
            this.photo.lastY = event.clientY;
            this.dom.canvas.setPointerCapture?.(event.pointerId);
        });
        this.dom.canvas.addEventListener('pointermove', (event) => {
            if (!this.photo.dragging) return;
            this.photo.yaw -= (event.clientX - this.photo.lastX) * 0.005;
            this.photo.pitch = clamp(this.photo.pitch + (event.clientY - this.photo.lastY) * 0.004, 0.05, 1.2);
            this.photo.lastX = event.clientX;
            this.photo.lastY = event.clientY;
        });
        this.dom.canvas.addEventListener('pointerup', () => { this.photo.dragging = false; });
        this.dom.canvas.addEventListener('wheel', (event) => {
            if (this.state !== 'photo') return;
            event.preventDefault();
            this.photo.dist = clamp(this.photo.dist + event.deltaY * 0.01, 3.2, 22);
        }, { passive: false });
    }

    syncMenuSelection() {
        document.querySelectorAll('[data-car]').forEach((el) => {
            el.classList.toggle('is-active', el.dataset.car === this.settings.car);
        });
        document.querySelectorAll('[data-sky]').forEach((el) => {
            el.classList.toggle('is-active', el.dataset.sky === this.settings.sky);
        });
        const blurb = document.querySelector('#carBlurb');
        const spec = CARS.find((c) => c.id === this.settings.car);
        if (blurb && spec) blurb.textContent = spec.blurb;
        const best = document.querySelector('#bestScore');
        if (best) best.textContent = this.best.score ? Math.round(this.best.score).toLocaleString('pt-BR') : '—';
    }

    setSky(id) {
        this.settings.sky = id;
        this.world.applySkyId(id);
        this.renderer.toneMappingExposure = SKIES[id].exposure;
        const night = id === 'night' || id === 'dusk';
        if (this.carMesh) this.carMesh.userData.lightsOn = night;
        this.traffic?.setLights(night);
        this.hud.setSky(id);
        this.bloom.strength = id === 'night' ? 0.7 : id === 'golden' ? 0.48 : 0.38;
    }

    async startDrive() {
        await this.audio.start();
        this.audio.setVolume(this.settings.volume);
        this.audio.setEnabled(this.settings.audio);
        this.dom.menu.classList.remove('is-visible');
        this.dom.menu.hidden = true;
        this.dom.hud.hidden = false;
        this.dom.controls.hidden = false;
        this.dom.controls.style.display = '';
        this.player.spawn(16, 0);
        this.score = 0;
        this.driveTime = 0;
        this.eventState = { id: null, peak: 0, points: 0, stars: 0 };
        this.state = 'drive';
        this.dom.canvas.tabIndex = 0;
        this.dom.canvas.focus();
        this.hud.toast('Festival aberto — acelere na Costa Aurélia');
    }

    backToMenu() {
        this.dom.pause.classList.remove('is-visible');
        this.dom.pause.hidden = true;
        this.dom.hud.hidden = true;
        this.dom.controls.hidden = true;
        this.dom.menu.hidden = false;
        this.dom.menu.classList.add('is-visible');
        this.state = 'menu';
        this.persistScore();
        this.player.spawn(16, 0);
        this.syncMenuSelection();
    }

    persistScore() {
        if (this.score > (this.best.score || 0)) {
            this.best.score = this.score;
            saveBest(this.best);
        }
    }

    togglePause(force) {
        if (this.state === 'menu' || this.state === 'photo' || this.state === 'boot') return;
        const pause = force ?? this.state !== 'pause';
        this.state = pause ? 'pause' : 'drive';
        this.dom.pause.hidden = !pause;
        this.dom.pause.classList.toggle('is-visible', pause);
    }

    togglePhoto(force) {
        if (this.state === 'menu' || this.state === 'boot') return;
        const on = force ?? this.state !== 'photo';
        if (on) {
            this.prevState = this.state === 'pause' ? 'pause' : 'drive';
            this.state = 'photo';
            this.dom.photo.hidden = false;
            this.dom.photo.classList.add('is-visible');
            this.dom.hud.hidden = true;
            this.photo.yaw = this.orbit.theta;
            this.photo.pitch = 0.32;
            this.photo.dist = 7.5;
        } else {
            this.state = this.prevState || 'drive';
            this.dom.photo.hidden = true;
            this.dom.photo.classList.remove('is-visible');
            this.dom.hud.hidden = this.state !== 'drive';
            this.dom.canvas.dataset.filter = 'none';
        }
    }

    cycleCamera() {
        const i = CAMERAS.findIndex((c) => c.id === this.cameraMode);
        this.cameraMode = CAMERAS[(i + 1) % CAMERAS.length].id;
        this.settings.camera = this.cameraMode;
        this.hud.setCamera(this.cameraMode);
        saveSettings(this.settings);
        this.hud.toast(CAMERAS.find((c) => c.id === this.cameraMode).name);
    }

    cycleSky() {
        const keys = Object.keys(SKIES);
        const i = keys.indexOf(this.settings.sky);
        this.setSky(keys[(i + 1) % keys.length]);
        this.hud.toast(SKIES[this.settings.sky].name);
        saveSettings(this.settings);
    }

    cycleRadio() {
        const station = this.audio.cycleStation();
        this.hud.setRadio(station);
        this.hud.toast(station.name);
    }

    toggleMute() {
        this.settings.audio = !this.settings.audio;
        this.audio.setEnabled(this.settings.audio);
        const btn = document.querySelector('#soundButton');
        if (btn) btn.setAttribute('aria-pressed', this.settings.audio ? 'true' : 'false');
        saveSettings(this.settings);
    }

    resize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h, false);
        this.composer.setSize(w, h);
        this.bloom.setSize(w, h);
    }

    loop(now) {
        requestAnimationFrame(this.loop);
        const dt = Math.min(0.05, (now - this.last) / 1000);
        this.last = now;
        this.frameTimes.push(dt);
        if (this.frameTimes.length > 30) this.frameTimes.shift();

        this.world.skyUniforms.uTime.value = now * 0.001;
        const input = this.input.poll();

        if (this.state === 'menu') {
            this.updateMenuCam(dt);
        } else if (this.state === 'drive') {
            this.accumulator += dt;
            let steps = 0;
            while (this.accumulator >= FIXED_STEP && steps < MAX_STEPS) {
                this.player.update(FIXED_STEP, input);
                this.traffic.update(FIXED_STEP, this.player);
                this.accumulator -= FIXED_STEP;
                steps++;
            }
            this.driveTime += dt;
            this.player.applyMesh(this.carMesh, dt);
            this.updateEvents();
            this.updateEffects(dt);
            this.updateChaseCam(dt);
            this.audio.update(dt, this.player);
        } else if (this.state === 'pause') {
            this.player.applyMesh(this.carMesh, dt);
        } else if (this.state === 'photo') {
            this.updatePhotoCam();
        }

        CAR_POS.set(this.player.position.x, this.player.position.y, this.player.position.z);
        followSunShadow(this.world.sun, CAR_POS, this.world.skyUniforms.uSunDir.value);

        const fps = Math.round(this.frameTimes.length / this.frameTimes.reduce((a, b) => a + b, 0));
        if (this.state === 'drive') {
            this.hud.update(dt, this.player, {
                fps,
                road: this.road,
                traffic: this.traffic,
                score: this.score,
                event: this.activeHudEvent()
            });
        }

        this.composer.render();
    }

    updateMenuCam(dt) {
        this.menuAngle += dt * 0.22;
        const p = this.player.position;
        const r = 7.4;
        this.camera.position.set(
            p.x + Math.sin(this.menuAngle) * r,
            p.y + 2.1,
            p.z + Math.cos(this.menuAngle) * r
        );
        this.camera.lookAt(p.x, p.y + 0.55, p.z);
        this.camera.fov = damp(this.camera.fov, 42, 3, dt);
        this.camera.updateProjectionMatrix();
        this.player.applyMesh(this.carMesh, dt);
    }

    updateChaseCam(dt) {
        const p = this.player.position;
        FORWARD.set(Math.sin(this.player.yaw), 0, Math.cos(this.player.yaw));
        const speed = this.player.speed;
        let fov = 55;

        if (this.cameraMode === 'hood') {
            DESIRED.copy(FORWARD).multiplyScalar(1.15).add(p);
            DESIRED.y = p.y + 0.82;
            LOOK.copy(FORWARD).multiplyScalar(18).add(p);
            LOOK.y = p.y + 0.6;
            fov = 68 + speed * 0.12;
        } else if (this.cameraMode === 'bumper') {
            DESIRED.copy(FORWARD).multiplyScalar(-0.2).add(p);
            DESIRED.y = p.y + 0.42;
            LOOK.copy(FORWARD).multiplyScalar(16).add(p);
            fov = 72 + speed * 0.15;
        } else if (this.cameraMode === 'cockpit') {
            DESIRED.copy(FORWARD).multiplyScalar(-0.15).add(p);
            DESIRED.y = p.y + 0.95;
            LOOK.copy(FORWARD).multiplyScalar(20).add(p);
            LOOK.y = p.y + 0.85;
            fov = 62;
        } else if (this.cameraMode === 'cinematic') {
            const t = this.driveTime;
            const side = Math.sin(t * 0.18);
            DESIRED.set(
                p.x + Math.sin(this.player.yaw + 1.1 * side) * (9 + speed * 0.04),
                p.y + 2.4 + Math.sin(t * 0.3) * 0.6,
                p.z + Math.cos(this.player.yaw + 1.1 * side) * (9 + speed * 0.04)
            );
            LOOK.set(p.x, p.y + 0.6, p.z);
            fov = 48;
        } else {
            const back = 6.8 + speed * 0.06;
            const height = 2.15 + speed * 0.018;
            DESIRED.copy(p).addScaledVector(FORWARD, -back);
            DESIRED.y = p.y + height;
            LOOK.copy(p).addScaledVector(FORWARD, 10 + speed * 0.08);
            LOOK.y = p.y + 0.85;
            fov = 58 + speed * 0.18;
        }

        this.camera.position.x = damp(this.camera.position.x, DESIRED.x, 6.5, dt);
        this.camera.position.y = damp(this.camera.position.y, DESIRED.y, 7, dt);
        this.camera.position.z = damp(this.camera.position.z, DESIRED.z, 6.5, dt);
        this.camera.lookAt(LOOK);
        this.camera.fov = damp(this.camera.fov, clamp(fov, 48, 88), 4, dt);
        this.camera.updateProjectionMatrix();
        this.orbit.theta = Math.atan2(this.camera.position.x - p.x, this.camera.position.z - p.z);
    }

    updatePhotoCam() {
        const p = this.player.position;
        const { yaw, pitch, dist } = this.photo;
        this.camera.position.set(
            p.x + Math.sin(yaw) * Math.cos(pitch) * dist,
            p.y + 0.6 + Math.sin(pitch) * dist,
            p.z + Math.cos(yaw) * Math.cos(pitch) * dist
        );
        this.camera.lookAt(p.x, p.y + 0.45, p.z);
        this.camera.fov = this.photo.fov;
        this.camera.updateProjectionMatrix();
    }

    updateEffects(dt) {
        if (this.player.slip > 0.2 && this.player.speed > 8 && this.player.surface === 0) {
            this.skidAcc += dt;
            if (this.skidAcc > 0.04) {
                this.skidAcc = 0;
                const p = this.player.position;
                this.skids.stamp(p.x, p.y, p.z, this.player.yaw);
                this.smoke.emit(p.x, p.y, p.z, 2);
            }
        }
        this.smoke.update(dt, this.camera);
    }

    updateEvents() {
        const progress = this.player.progress;
        const current = EVENTS.find((e) => progress >= e.start && progress < e.end) || null;
        if (current) {
            if (this.eventState.id !== current.id) {
                this.eventState = { id: current.id, peak: this.player.speed, points: 0, stars: 0 };
                this.hud.toast(current.name);
            }
            this.eventState.peak = Math.max(this.eventState.peak, this.player.speed);
            if (current.kind === 'drift') {
                this.eventState.points += this.player.slip * this.player.speed * 0.35;
            }
        } else if (this.eventState.id) {
            const ev = EVENTS.find((e) => e.id === this.eventState.id);
            if (ev) this.awardEvent(ev, this.eventState);
            this.eventState = { id: null, peak: 0, points: 0, stars: 0 };
        }
    }

    awardEvent(ev, state) {
        let stars = 0;
        let gained = 0;
        if (ev.kind === 'speed') {
            const v = state.peak;
            stars = v >= ev.stars[2] ? 3 : v >= ev.stars[1] ? 2 : v >= ev.stars[0] ? 1 : 0;
            gained = Math.round(formatSpeed(v) * (1 + stars));
            this.hud.toast(`${ev.name} · ${formatSpeed(v)} km/h · ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}`);
        } else {
            stars = state.points > 420 ? 3 : state.points > 220 ? 2 : state.points > 80 ? 1 : 0;
            gained = Math.round(state.points * (1 + stars * 0.5));
            this.hud.toast(`${ev.name} · ${Math.round(state.points)} pts · ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}`);
        }
        this.score += gained;
        state.stars = stars;
    }

    activeHudEvent() {
        if (!this.eventState.id) return null;
        const ev = EVENTS.find((e) => e.id === this.eventState.id);
        if (!ev) return null;
        let starsEarned = 0;
        if (ev.kind === 'speed') {
            const v = this.eventState.peak;
            starsEarned = v >= ev.stars[2] ? 3 : v >= ev.stars[1] ? 2 : v >= ev.stars[0] ? 1 : 0;
        } else {
            starsEarned = this.eventState.points > 420 ? 3 : this.eventState.points > 220 ? 2 : this.eventState.points > 80 ? 1 : 0;
        }
        return { ...ev, peak: this.eventState.peak, points: this.eventState.points, starsEarned };
    }
}

function bootFail(reason) {
    const overlay = document.getElementById('loadingOverlay');
    const box = document.getElementById('bootFallback');
    if (!box) return;
    overlay?.classList.add('is-visible', 'has-error');
    const lights = overlay?.querySelector('.loading-mark');
    const text = document.getElementById('loadingText');
    if (lights) lights.hidden = true;
    if (text) text.hidden = true;
    box.hidden = false;
    if (reason === 'gpu') {
        document.getElementById('bootFallbackTitle').textContent = 'WebGL não disponível';
        document.getElementById('bootFallbackText').textContent =
            'Este festival 3D precisa de WebGL. Tente um navegador atualizado com aceleração de hardware.';
    }
}

window.addEventListener('error', () => bootFail('runtime'));

try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') || probe.getContext('webgl');
    if (!gl) bootFail('gpu');
    else new Game().init().catch((err) => {
        console.error(err);
        bootFail('runtime');
    });
} catch (err) {
    console.error(err);
    bootFail('gpu');
}
