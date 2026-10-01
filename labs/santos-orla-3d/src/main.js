/**
 * Santos Orla 3D — laço principal.
 * Digital twin navegável: intro aérea → walk pela orla José Menino → Ponta da Praia.
 */

import * as THREE from 'three';
import { configureCinematicRenderer, applyCinematicEnvironment } from '../../shared/cinematic.js?v=2';

import {
    STORAGE_KEY,
    QUALITY,
    VIEW_MODES,
    LANDMARKS
} from './config.js';
import { detectMobile, detectTouch, detectSoftwareGL } from './utils.js';
import { World } from './world.js';
import { Player } from './player.js';
import { OrlaCamera } from './camera.js';
import { Input } from './input.js';
import { OrlaAudio } from './audio.js';
import { UI } from './ui.js';

class App {
    constructor() {
        this.ui = new UI();
        this.canvas = document.getElementById('scene');
        this.settings = this.loadSettings();
        this.state = 'loading';
        this.time = 0;
        this.mode = this.settings.mode || 'tourist';
        this.paused = false;
        this.fpsAccum = 0;
        this.fpsFrames = 0;
        this.input = new Input();
        this.audio = new OrlaAudio();
        this.player = null;
        this.touchLookActive = false;
        this._landedOnce = false;
    }

    loadSettings() {
        const fallback = { quality: 'auto', volume: 65, muted: false, mode: 'tourist', day: 1 };
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
        } catch { /* private mode */ }
    }

    resolveQuality() {
        const choice = this.settings.quality;
        if (choice !== 'auto' && QUALITY[choice]) return QUALITY[choice];
        if (detectMobile() || detectSoftwareGL()) return QUALITY.low;
        return Math.min(window.innerWidth, window.innerHeight) >= 900 ? QUALITY.high : QUALITY.medium;
    }

    async init() {
        this.ui.setLoading(0.05, 'Preparando a orla…');
        const quality = this.resolveQuality();
        this.quality = quality;

        try {
            this.renderer = new THREE.WebGLRenderer({
                canvas: this.canvas,
                antialias: quality.antialias,
                powerPreference: 'high-performance',
                alpha: false
            });
        } catch (err) {
            this.ui.showError('WebGL indisponível. Ative a aceleração de hardware.');
            return;
        }

        const pr = Math.min(window.devicePixelRatio || 1, quality.pixelRatio);
        this.renderer.setPixelRatio(pr);
        this.renderer.setSize(window.innerWidth, window.innerHeight, false);
        configureCinematicRenderer(this.renderer, {
            exposure: 1.05,
            shadows: quality.shadows
        });

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.5, 700);
        this.camera.position.set(0, 260, 90);

        try {
            applyCinematicEnvironment(this.scene, this.renderer, { intensity: 0.35 });
        } catch { /* RoomEnvironment opcional */ }

        this.world = new World(this.scene, this.renderer, quality);
        this.world.build((p, text) => this.ui.setLoading(p, text));

        this.player = new Player(this.scene);
        this.rig = new OrlaCamera(this.camera);
        this.dayStop = this.world.setDay(this.settings.day ?? 1);
        this.ui.setDay(this.dayStop);

        this.bindUI();
        this.input.bind();
        window.addEventListener('resize', this.onResize);
        this.onResize();

        this.ui.hideLoading();
        this.ui.showMenu(true);
        this.state = 'menu';
        this.loop(performance.now());
    }

    bindUI() {
        document.getElementById('startButton')?.addEventListener('click', () => this.start());
        document.getElementById('resumeButton')?.addEventListener('click', () => this.setPaused(false));
        document.getElementById('pauseMenuButton')?.addEventListener('click', () => {
            this.setPaused(false);
            this.backToMenu();
        });
        document.getElementById('pauseButton')?.addEventListener('click', () => this.setPaused(!this.paused));
        document.getElementById('soundButton')?.addEventListener('click', () => this.toggleMute());
        document.getElementById('dayButton')?.addEventListener('click', () => {
            this.dayStop = this.world.cycleDay();
            this.settings.day = this.world.dayIndex;
            this.saveSettings();
            this.ui.setDay(this.dayStop);
        });

        document.getElementById('qualitySelect')?.addEventListener('change', (e) => {
            this.settings.quality = e.target.value;
            this.saveSettings();
        });
        document.getElementById('volumeSlider')?.addEventListener('input', (e) => {
            const v = Number(e.target.value) / 100;
            this.settings.volume = Number(e.target.value);
            this.audio.setVolume(v);
            const label = document.getElementById('volumeValue');
            if (label) label.textContent = String(this.settings.volume);
            this.saveSettings();
        });

        const applyMode = (mode) => {
            if (!VIEW_MODES[mode]) return;
            this.mode = mode;
            this.settings.mode = mode;
            this.saveSettings();
            this.ui.setMode(mode);
            if (this.state === 'playing') {
                this.rig.setMode(mode);
                this.ui.setHint(mode === 'map'
                    ? 'Vista mapa da orla inteira · clique Turista para voltar a caminhar'
                    : mode === 'cinematic'
                        ? 'Voo drone · T troca o modo'
                        : detectTouch()
                            ? 'Stick para andar · área direita para olhar'
                            : 'WASD andar · ←→ virar · Shift correr · T modo · L hora do dia');
            }
        };

        // Delegação no shell — chips do menu e do HUD (evita overlap / rebind)
        document.querySelector('.game-shell')?.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-mode]');
            if (!btn || !btn.classList.contains('chip')) return;
            e.preventDefault();
            applyMode(btn.dataset.mode);
        });

        // Esconde toque em ponteiro fino (VM às vezes reporta coarse)
        const touch = document.getElementById('touchControls');
        if (touch) {
            const coarse = matchMedia('(pointer: coarse)').matches || (detectTouch() && detectMobile());
            touch.hidden = !coarse;
            touch.style.display = coarse ? '' : 'none';
        }

        document.getElementById('landmarkList')?.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-goto]');
            if (!btn) return;
            const lm = LANDMARKS.find((l) => l.id === btn.dataset.goto);
            if (!lm) return;
            this.player.reset(lm.x);
            if (this.state === 'menu') this.start({ skipIntro: true });
            else if (this.mode === 'map' || this.mode === 'cinematic') {
                this.mode = 'tourist';
                this.ui.setMode('tourist');
                this.rig.setMode('tourist');
            }
        });

        // Touch stick
        const stick = document.getElementById('moveStick');
        const stickKnob = document.getElementById('moveKnob');
        const lookPad = document.getElementById('lookPad');

        const stickHandler = (clientX, clientY, rect) => {
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            let dx = (clientX - cx) / (rect.width * 0.45);
            let dy = (clientY - cy) / (rect.height * 0.45);
            const mag = Math.hypot(dx, dy);
            if (mag > 1) { dx /= mag; dy /= mag; }
            this.input.setTouchMove(dx, dy);
            if (stickKnob) {
                stickKnob.style.transform = `translate(${dx * 28}px, ${dy * 28}px)`;
            }
        };

        if (stick) {
            const onMove = (ev) => {
                const t = ev.touches?.[0] || ev;
                stickHandler(t.clientX, t.clientY, stick.getBoundingClientRect());
                ev.preventDefault();
            };
            const onEnd = () => {
                this.input.setTouchMove(0, 0);
                if (stickKnob) stickKnob.style.transform = 'translate(0,0)';
            };
            stick.addEventListener('pointerdown', (e) => {
                stick.setPointerCapture(e.pointerId);
                onMove(e);
            });
            stick.addEventListener('pointermove', (e) => {
                if (e.buttons || e.pressure) onMove(e);
            });
            stick.addEventListener('pointerup', onEnd);
            stick.addEventListener('pointercancel', onEnd);
        }

        if (lookPad) {
            let lastX = 0;
            let lastY = 0;
            lookPad.addEventListener('pointerdown', (e) => {
                this.touchLookActive = true;
                lastX = e.clientX;
                lastY = e.clientY;
                lookPad.setPointerCapture(e.pointerId);
            });
            lookPad.addEventListener('pointermove', (e) => {
                if (!this.touchLookActive) return;
                const dx = (e.clientX - lastX) / 80;
                const dy = (e.clientY - lastY) / 80;
                lastX = e.clientX;
                lastY = e.clientY;
                this.input.setTouchLook(dx, dy);
            });
            lookPad.addEventListener('pointerup', () => { this.touchLookActive = false; });
            lookPad.addEventListener('pointercancel', () => { this.touchLookActive = false; });
        }

        window.addEventListener('keydown', (e) => {
            if (e.code === 'KeyP' && this.state === 'playing') this.setPaused(!this.paused);
            if (e.code === 'KeyM') this.toggleMute();
            if (e.code === 'KeyT' && this.state === 'playing') {
                const ids = Object.keys(VIEW_MODES);
                const next = ids[(ids.indexOf(this.mode) + 1) % ids.length];
                applyMode(next);
            }
            if (e.code === 'KeyL' && this.state === 'playing') {
                this.dayStop = this.world.cycleDay();
                this.ui.setDay(this.dayStop);
            }
            if (e.code === 'Escape' && this.state === 'playing') this.setPaused(!this.paused);
        });

        // Prefill settings
        const qs = document.getElementById('qualitySelect');
        if (qs) qs.value = this.settings.quality;
        const vs = document.getElementById('volumeSlider');
        if (vs) vs.value = String(this.settings.volume);
        const vv = document.getElementById('volumeValue');
        if (vv) vv.textContent = String(this.settings.volume);
        this.ui.setMode(this.mode);

        // touch visibility already set above
    }

    start({ skipIntro = false } = {}) {
        this.audio.init();
        this.audio.setEnabled(!this.settings.muted);
        this.audio.setVolume(this.settings.volume / 100);

        this.ui.showMenu(false);
        this.ui.showHud(true);
        this.state = 'playing';
        this.paused = false;

        this._landedOnce = !!skipIntro;
        if (skipIntro) {
            this.rig.setMode(this.mode);
            this.camera.position.set(this.player.x, 3, this.player.z + 6);
        } else {
            this.rig.startIntro();
            this.ui.setHint('');
        }
        this.ui.setMode(this.mode);
        this.ui.setHint(detectTouch()
            ? 'Stick para andar · área direita para olhar'
            : 'WASD andar · ←→ virar · Shift correr · T modo · L hora do dia');
    }

    backToMenu() {
        this.state = 'menu';
        this.ui.showHud(false);
        this.ui.showMenu(true);
        this.rig.startIntro();
        this.rig.introT = 0;
    }

    setPaused(p) {
        this.paused = p;
        this.ui.showPause(p);
    }

    toggleMute() {
        this.settings.muted = !this.settings.muted;
        this.audio.setEnabled(!this.settings.muted);
        this.saveSettings();
        const btn = document.getElementById('soundButton');
        if (btn) {
            btn.setAttribute('aria-pressed', this.settings.muted ? 'false' : 'true');
            btn.textContent = this.settings.muted ? '🔇' : '♪';
        }
    }

    onResize = () => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h, false);
    };

    nearestLandmark() {
        let best = null;
        let dist = Infinity;
        for (const lm of LANDMARKS) {
            const d = Math.hypot(lm.x - this.player.x, lm.z - this.player.z);
            if (d < dist) {
                dist = d;
                best = { ...lm, dist };
            }
        }
        return best;
    }

    loop = (now) => {
        requestAnimationFrame(this.loop);
        const dt = Math.min(0.05, (now - (this._last || now)) / 1000);
        this._last = now;

        if (this.state === 'loading') return;

        // Preview idle camera while on menu
        if (this.state === 'menu') {
            this.time += dt;
            this.world.update(this.time, dt);
            const t = this.time * 0.08;
            this.camera.position.set(Math.sin(t) * 80, 140, 100 + Math.cos(t) * 20);
            this.camera.lookAt(0, 0, 20);
            this.renderer.render(this.scene, this.camera);
            return;
        }

        if (this.state !== 'playing' || this.paused) {
            this.renderer.render(this.scene, this.camera);
            return;
        }

        this.time += dt;
        const input = this.input.poll();
        const camLocked = this.rig.phase === 'intro' || this.mode === 'map' || this.mode === 'cinematic';
        this.player.update(dt, input, camLocked);

        const cam = this.rig.update(dt, this.player);
        this.ui.setIntro(cam.introProgress, cam.landed);
        if (cam.landed && !this._landedOnce) {
            this._landedOnce = true;
            this.rig.setMode(this.mode);
        }

        this.world.update(this.time, dt);
        this.world.followShadow(this.player.x);

        const near = this.nearestLandmark();
        this.ui.updatePlace(this.player.x, near);
        this.ui.syncLabels(this.camera, LANDMARKS, this.ui.showLabels && cam.landed);

        this.audio.update(this.player.z, this.player.speed, this.dayStop?.id === 'night');

        this.renderer.render(this.scene, this.camera);

        this.fpsAccum += dt;
        this.fpsFrames++;
        if (this.fpsAccum >= 0.5) {
            this.ui.setFps(Math.round(this.fpsFrames / this.fpsAccum));
            this.fpsAccum = 0;
            this.fpsFrames = 0;
        }
    };
}

const app = new App();
app.init().catch((err) => {
    console.error(err);
    app.ui.showError(err?.message || 'Falha ao iniciar o laboratório.');
});
