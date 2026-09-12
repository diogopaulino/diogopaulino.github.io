/**
 * Costa Dourada — corrida costeira no golden hour.
 * Three.js + bicycle physics + IA. Vanilla ES modules.
 */

import * as THREE from 'three';
import { RACE, QUALITY, PAINTS, loadSettings, saveSettings } from './config.js';
import { detectMobile, detectSoftwareGL, formatTime } from './utils.js';
import { Track } from './track.js';
import { Vehicle, resolveCarContact } from './vehicle.js';
import { createCarMesh, syncCarMesh } from './carModel.js';
import { World } from './world.js';
import { Input } from './input.js';
import { AiDriver } from './ai.js';
import { GameAudio } from './audio.js';
import { Hud } from './hud.js';

const AI_NAMES = ['Sofia', 'Marco', 'Luna'];

function showBootError(err) {
    console.error(err);
    const el = document.getElementById('bootError') || (() => {
        const d = document.createElement('pre');
        d.id = 'bootError';
        d.style.cssText = 'position:fixed;inset:auto 12px 12px 12px;z-index:9999;max-height:40vh;overflow:auto;background:#2a1010;color:#fecaca;padding:12px;border-radius:12px;font:12px/1.4 ui-monospace,monospace;white-space:pre-wrap';
        document.body.appendChild(d);
        return d;
    })();
    el.textContent = String(err && err.stack || err);
}
window.addEventListener('error', (e) => showBootError(e.error || e.message));
window.addEventListener('unhandledrejection', (e) => showBootError(e.reason));

function resolveQuality(settings) {
    if (detectSoftwareGL()) return QUALITY.low;
    if (settings.quality !== 'auto' && QUALITY[settings.quality]) {
        return QUALITY[settings.quality];
    }
    if (detectMobile()) return QUALITY.low;
    return Math.min(window.innerWidth, window.innerHeight) >= 900
        ? QUALITY.high
        : QUALITY.medium;
}

class Game {
    constructor() {
        this.settings = loadSettings();
        this.quality = resolveQuality(this.settings);
        this.phase = 'boot';
        this.raceTime = 0;
        this.countdown = RACE.countdown;
        this.cameraMode = 0;
        this.assists = this.settings.assists !== false;

        this.canvas = document.getElementById('scene');
        this.input = new Input();
        this.audio = new GameAudio();
        this.hud = new Hud();
        this._bindUi();
    }

    _bindUi() {
        document.getElementById('btnStart')?.addEventListener('click', () => this.startRace());
        document.getElementById('btnResume')?.addEventListener('click', () => this.resume());
        document.getElementById('btnRestart')?.addEventListener('click', () => this.startRace());
        document.getElementById('btnMenu')?.addEventListener('click', () => this.showMenu());
        document.getElementById('btnAgain')?.addEventListener('click', () => this.startRace());
        document.getElementById('btnSound')?.addEventListener('click', () => this.toggleMute());
        document.getElementById('qualitySelect')?.addEventListener('change', (e) => {
            this.settings.quality = e.target.value;
            saveSettings(this.settings);
        });
        document.getElementById('assistsToggle')?.addEventListener('change', (e) => {
            this.settings.assists = e.target.checked;
            this.assists = e.target.checked;
            saveSettings(this.settings);
        });
        window.addEventListener('resize', () => this.onResize());
    }

    async init() {
        this.setLoading(0.1, 'Montando a costa…');
        this.track = new Track(this.quality.roadSeg || 280);

        try {
            this.renderer = new THREE.WebGLRenderer({
                canvas: this.canvas,
                antialias: this.quality.antialias,
                powerPreference: detectSoftwareGL() ? 'low-power' : 'high-performance',
                stencil: false
            });
        } catch {
            const t = document.getElementById('loadingText');
            if (t) t.textContent = 'WebGL indisponível neste navegador.';
            return;
        }

        const pr = Math.min(window.devicePixelRatio || 1, this.quality.pixelRatio);
        this.renderer.setPixelRatio(pr);
        this.renderer.setSize(window.innerWidth, window.innerHeight, false);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.15;
        this.renderer.shadowMap.enabled = this.quality.shadows;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(
            58,
            window.innerWidth / window.innerHeight,
            0.3,
            this.quality.drawDistance * 1.8
        );

        this.setLoading(0.35, 'Golden hour…');
        this.world = new World(this.scene, this.track, this.quality);

        this.setLoading(0.6, 'Preparando o grid…');
        this.cars = [];
        this.meshes = [];
        this.drivers = [];

        const playerPaint = PAINTS[0];
        this.player = new Vehicle({
            name: 'Você',
            isPlayer: true,
            skill: 1,
            color: playerPaint.body
        });
        this.cars.push(this.player);
        const pMesh = createCarMesh(playerPaint.body, playerPaint.accent);
        this.scene.add(pMesh);
        this.meshes.push(pMesh);

        for (let i = 0; i < RACE.aiCount; i++) {
            const paint = PAINTS[(i + 1) % PAINTS.length];
            const ai = new Vehicle({
                name: AI_NAMES[i] || `Rival ${i + 1}`,
                skill: 0.72 + i * 0.08,
                color: paint.body
            });
            this.cars.push(ai);
            this.drivers.push(new AiDriver(ai, ai.skill));
            const mesh = createCarMesh(paint.body, paint.accent);
            this.scene.add(mesh);
            this.meshes.push(mesh);
        }

        this.placeOnGrid();
        this.setLoading(0.95, 'Pronto.');
        this.onResize();
        this.showMenu();
        document.getElementById('loading')?.classList.add('hidden');

        this._last = performance.now();
        requestAnimationFrame((t) => this.frame(t));
    }

    /* init errors bubble via showBootError */

    placeOnGrid() {
        const start = this.track.length - 18;
        this.cars.forEach((car, i) => {
            const row = Math.floor(i / 2);
            const side = i % 2 === 0 ? -1.8 : 1.8;
            const dist = start - row * 7;
            car.snapToTrack(this.track, dist, side);
            car.lap = 0;
            car.finished = false;
            car.bestLap = 0;
            car.lastLap = 0;
            car.place = i + 1;
            car._lapStart = 0;
            car._gate = false;
        });
        this.raceTime = 0;
        this.countdown = RACE.countdown;
    }

    showMenu() {
        this.phase = 'menu';
        document.getElementById('menu')?.classList.remove('hidden');
        document.getElementById('pause')?.classList.add('hidden');
        document.getElementById('finish')?.classList.add('hidden');
        document.getElementById('hud')?.classList.add('hidden');
        const qs = document.getElementById('qualitySelect');
        if (qs) qs.value = this.settings.quality || 'auto';
        const at = document.getElementById('assistsToggle');
        if (at) at.checked = this.assists;
        if (this.settings.best) {
            const el = document.getElementById('bestTime');
            if (el) el.textContent = `Melhor: ${formatTime(this.settings.best)}`;
        }
    }

    async startRace() {
        try {
            try { await this.audio.resume(); } catch (e) { console.warn('audio', e); }
            this.audio.setMuted(!!this.settings.muted);
            this.placeOnGrid();
            this.phase = 'countdown';
            this.countdown = RACE.countdown;
            this.raceTime = 0;
            document.getElementById('loading')?.classList.add('hidden');
            document.getElementById('menu')?.classList.add('hidden');
            document.getElementById('finish')?.classList.add('hidden');
            document.getElementById('pause')?.classList.add('hidden');
            const hud = document.getElementById('hud');
            if (hud) {
                hud.classList.remove('hidden');
                hud.hidden = false;
            }
            this.hud.setMessage('3 voltas · Costa Dourada', 2.2);
        } catch (err) {
            showBootError(err);
        }
    }

    resume() {
        this.phase = 'racing';
        document.getElementById('pause')?.classList.add('hidden');
    }

    toggleMute() {
        this.settings.muted = !this.settings.muted;
        this.audio.setMuted(this.settings.muted);
        saveSettings(this.settings);
        const btn = document.getElementById('btnSound');
        if (btn) btn.setAttribute('aria-pressed', this.settings.muted ? 'false' : 'true');
    }

    setLoading(p, text) {
        const fill = document.getElementById('loadingFill');
        const label = document.getElementById('loadingText');
        if (fill) fill.style.width = `${Math.round(p * 100)}%`;
        if (label && text) label.textContent = text;
    }

    onResize() {
        if (!this.renderer || !this.camera) return;
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h, false);
    }

    frame(now) {
        const dt = Math.min(0.05, (now - this._last) / 1000);
        this._last = now;
        this.update(dt);
        this.render();
        requestAnimationFrame((t) => this.frame(t));
    }

    update(dt) {
        const input = this.input.poll();

        if (input.pausePressed && (this.phase === 'racing' || this.phase === 'countdown')) {
            this.phase = 'paused';
            document.getElementById('pause')?.classList.remove('hidden');
        } else if (input.pausePressed && this.phase === 'paused') {
            this.resume();
        }
        if (input.cameraPressed) this.cameraMode = (this.cameraMode + 1) % 3;
        if (input.resetPressed && this.phase === 'racing') {
            this.player.snapToTrack(this.track, this.player.lapDistance, 0);
            this.hud.setMessage('Reset', 1);
        }

        if (typeof this.world?.update === 'function') this.world.update(dt);

        if (this.phase === 'menu' || this.phase === 'paused' || this.phase === 'boot') {
            this._updateCamera(dt, true);
            for (let i = 0; i < this.cars.length; i++) syncCarMesh(this.meshes[i], this.cars[i]);
            return;
        }

        if (this.phase === 'countdown') {
            this.countdown -= dt;
            if (this.countdown <= 0) {
                this.phase = 'racing';
                this.hud.setMessage('VAI!', 1);
            }
            this._updateCamera(dt, true);
            for (let i = 0; i < this.cars.length; i++) syncCarMesh(this.meshes[i], this.cars[i]);
            this.hud.update(dt, this._hudState());
            return;
        }

        if (this.phase === 'finished') {
            this._updateCamera(dt, false);
            this.hud.update(dt, this._hudState());
            return;
        }

        this.raceTime += dt;

        this.player.update(dt, {
            throttle: input.throttle,
            brake: input.brake,
            steer: input.steer,
            handbrake: input.handbrake,
            assists: this.assists
        }, this.track);

        for (const driver of this.drivers) {
            const aiInput = driver.step(this.track, this.player);
            driver.vehicle.update(dt, aiInput, this.track);
        }

        for (let i = 0; i < this.cars.length; i++) {
            for (let j = i + 1; j < this.cars.length; j++) {
                resolveCarContact(this.cars[i], this.cars[j]);
            }
        }

        this._updateLaps();
        this._updatePlaces();

        for (let i = 0; i < this.cars.length; i++) {
            syncCarMesh(this.meshes[i], this.cars[i]);
        }

        this.audio.update(this.player);
        this._updateCamera(dt, false);
        this.hud.update(dt, this._hudState());
    }

    _updateLaps() {
        for (const car of this.cars) {
            if (car.finished) continue;
            const nearStart = car.lapDistance < 25;
            const progressing = car.totalDistance > this.track.length * 0.5;
            if (nearStart && progressing && !car._gate) {
                car._gate = true;
                if (car.lap >= 1) {
                    const lapTime = this.raceTime - (car._lapStart || 0);
                    car.lastLap = lapTime;
                    if (!car.bestLap || lapTime < car.bestLap) car.bestLap = lapTime;
                    if (car.isPlayer) this.hud.setMessage(`Volta ${car.lap}: ${formatTime(lapTime)}`, 2);
                }
                car.lap += 1;
                car._lapStart = this.raceTime;
                if (car.lap > RACE.laps) {
                    car.finished = true;
                    car.finishTime = this.raceTime;
                    car.lap = RACE.laps;
                    if (car.isPlayer) this._onPlayerFinish();
                }
            } else if (car.lapDistance > this.track.length * 0.5) {
                car._gate = false;
            }
        }
    }

    _onPlayerFinish() {
        this.phase = 'finished';
        const place = this.player.place;
        if (!this.settings.best || this.raceTime < this.settings.best) {
            this.settings.best = this.raceTime;
            saveSettings(this.settings);
        }
        document.getElementById('finish')?.classList.remove('hidden');
        const title = document.getElementById('finishTitle');
        const blurb = document.getElementById('finishBlurb');
        if (title) title.textContent = place === 1 ? 'Vitória dourada' : `${place}º lugar`;
        if (blurb) {
            blurb.textContent = `Tempo ${formatTime(this.raceTime)} · Melhor volta ${
                this.player.bestLap ? formatTime(this.player.bestLap) : '—'
            }`;
        }
    }

    _updatePlaces() {
        const order = [...this.cars].sort((a, b) => {
            const pa = a.finished
                ? 1e9 + (10000 - a.finishTime)
                : a.lap * this.track.length + a.lapDistance;
            const pb = b.finished
                ? 1e9 + (10000 - b.finishTime)
                : b.lap * this.track.length + b.lapDistance;
            return pb - pa;
        });
        order.forEach((c, i) => { c.place = i + 1; });
    }

    _hudState() {
        return {
            player: this.player,
            cars: this.cars,
            track: this.track,
            raceTime: this.raceTime,
            laps: RACE.laps,
            phase: this.phase,
            countdown: this.countdown
        };
    }

    _updateCamera(dt, locked) {
        const p = this.player;
        const modes = [
            { back: 8.2, up: 2.8, look: 10 },
            { back: 5.4, up: 1.6, look: 14 },
            { back: 12, up: 5.5, look: 6 }
        ];
        const m = modes[this.cameraMode];
        const yaw = p.yaw;
        const desired = new THREE.Vector3(
            p.x - Math.sin(yaw) * m.back,
            p.y + m.up,
            p.z - Math.cos(yaw) * m.back
        );
        if (!this._camPos) this._camPos = desired.clone();
        this._camPos.lerp(desired, locked ? 1 : 1 - Math.exp(-4.5 * dt));
        this.camera.position.copy(this._camPos);
        this.camera.lookAt(
            p.x + Math.sin(yaw) * m.look,
            p.y + 1.1,
            p.z + Math.cos(yaw) * m.look
        );
        if (this.world?.sun) {
            this.world.sun.target.position.set(p.x, p.y, p.z);
            this.world.sun.position.set(p.x - 80, p.y + 55, p.z + 30);
            this.world.sun.target.updateMatrixWorld();
        }
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }
}

const game = new Game();
game.init().catch(showBootError);

// Fallback click binding in case constructor ran before DOM quirks
document.getElementById('btnStart')?.addEventListener('click', () => game.startRace());
