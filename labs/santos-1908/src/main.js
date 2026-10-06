/**
 * Santos, 1908 — orquestrador.
 * Contrato dos módulos: create(ctx) → { update(t, dt), dispose? }
 * Um módulo que falha é registrado e pulado (receita Tupi).
 */

import * as THREE from 'three';
import { configureCinematicRenderer, applyCinematicEnvironment } from '../../shared/cinematic.js?v=2';
import { QUALITY, FILM_DURATION, chapterAt } from './config.js';
import { createMaterials, disposeMaterials } from './materials.js';
import { detectMobile, detectSoftwareGL, formatClock } from './utils.js';

import * as skyMod from './modules/sky.js';
import * as estuaryMod from './modules/estuary.js';
import * as portMod from './modules/port.js';
import * as cityMod from './modules/city.js';
import * as kasatoMod from './modules/kasato.js';
import * as otherShipsMod from './modules/otherShips.js';
import * as railwayMod from './modules/railway.js';
import { createWorkers, createCargo } from './modules/workers.js';
import * as birdsMod from './modules/birds.js';
import * as steamMod from './modules/steam.js';
import * as audioMod from './modules/audio.js';
import * as cameraMod from './modules/camera.js';
import * as ambienceMod from './modules/ambience.js';
import * as postMod from './modules/post.js';

const STORAGE = 'santos-1908-settings';

const MODULE_BUILDERS = [
    ['sky', skyMod.create],
    ['estuary', estuaryMod.create],
    ['port', portMod.create],
    ['city', cityMod.create],
    ['kasato', kasatoMod.create],
    ['other-ships', otherShipsMod.create],
    ['railway', railwayMod.create],
    ['workers', createWorkers],
    ['cargo', createCargo],
    ['birds', birdsMod.create],
    ['steam', steamMod.create],
    ['ambience', ambienceMod.create]
];

function pickQuality(mode) {
    if (QUALITY[mode]) return QUALITY[mode];

    const memory = navigator.deviceMemory || 8;
    const cores = navigator.hardwareConcurrency || 8;
    const shortSide = Math.min(window.innerWidth, window.innerHeight);

    if (detectMobile() || memory <= 4 || cores <= 4) return QUALITY.low;
    if (memory >= 8 && cores >= 8 && shortSide >= 800) return QUALITY.high;
    return QUALITY.medium;
}

class Santos1908 {
    constructor() {
        this.canvas = document.getElementById('scene');
        this.settings = this.loadSettings();
        this.state = 'boot';
        this.clock = new THREE.Clock(false);
        this.modules = [];
        this.failed = [];
        this.fpsAccum = 0;
        this.fpsFrames = 0;
        this.pixelRatio = 1;
        this.bindUi();
        this.boot();
    }

    loadSettings() {
        try {
            return {
                quality: 'auto',
                volume: 70,
                muted: false,
                ...JSON.parse(localStorage.getItem(STORAGE) || '{}')
            };
        } catch {
            return { quality: 'auto', volume: 70, muted: false };
        }
    }

    saveSettings() {
        try {
            localStorage.setItem(STORAGE, JSON.stringify(this.settings));
        } catch { /* privado */ }
    }

    bindUi() {
        document.getElementById('startButton')?.addEventListener('click', () => this.start());
        document.getElementById('replayButton')?.addEventListener('click', () => this.replay());
        document.getElementById('muteBtn')?.addEventListener('click', () => this.toggleMute());
        document.getElementById('qualitySelect')?.addEventListener('change', (e) => {
            this.settings.quality = e.target.value;
            this.saveSettings();
        });
        document.getElementById('volumeSlider')?.addEventListener('input', (e) => {
            const v = Number(e.target.value);
            this.settings.volume = v;
            document.getElementById('volumeValue').textContent = String(v);
            this.audio?.setVolume(v / 100);
            this.saveSettings();
        });
        const vol = document.getElementById('volumeSlider');
        if (vol) {
            vol.value = String(this.settings.volume);
            document.getElementById('volumeValue').textContent = String(this.settings.volume);
        }
        const q = document.getElementById('qualitySelect');
        if (q) q.value = this.settings.quality;

        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && this.state === 'playing') {
                e.preventDefault();
                this.togglePause();
            }
            if (e.code === 'KeyR' && this.state !== 'boot') this.replay();
            if (e.code === 'KeyM') this.toggleMute();
            if (e.code === 'KeyF') this.toggleFullscreen();
        });
        window.addEventListener('resize', () => this.resize());
    }

    async boot() {
        try {
            const initialQuality = pickQuality(this.settings.quality);
            this.renderer = new THREE.WebGLRenderer({
                canvas: this.canvas,
                antialias: initialQuality.antialias,
                powerPreference: 'high-performance',
                alpha: false
            });
            this.quality = detectSoftwareGL(this.renderer) ? QUALITY.low : initialQuality;
            this.pixelRatio = Math.min(devicePixelRatio || 1, this.quality.pr);
            this.renderer.setPixelRatio(this.pixelRatio);
            this.renderer.setSize(window.innerWidth, window.innerHeight, false);
            configureCinematicRenderer(this.renderer, {
                exposure: 1.05,
                shadows: this.quality.shadows
            });

            this.scene = new THREE.Scene();
            this.scene.background = new THREE.Color('#c4b8a0');
            this.camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.5, 1200);

            applyCinematicEnvironment(this.scene, this.renderer, { intensity: 0.35 });
            this.mats = createMaterials();

            const ctx = {
                scene: this.scene,
                renderer: this.renderer,
                camera: this.camera,
                canvas: this.canvas,
                mats: this.mats,
                quality: this.quality
            };

            // Warm-up modular — um módulo por frame de microtarefa
            const progress = document.getElementById('loadProgress');
            for (let i = 0; i < MODULE_BUILDERS.length; i++) {
                const [name, build] = MODULE_BUILDERS[i];
                try {
                    const mod = build(ctx);
                    this.modules.push({ name, ...mod });
                } catch (err) {
                    console.warn(`[santos-1908] módulo "${name}" falhou:`, err);
                    this.failed.push(name);
                }
                if (progress) {
                    progress.style.width = `${((i + 1) / (MODULE_BUILDERS.length + 2)) * 100}%`;
                }
                await new Promise((r) => requestAnimationFrame(r));
            }

            this.audio = audioMod.create(ctx);
            this.cine = cameraMod.create(ctx);
            this.post = postMod.create(ctx);
            this.modules.push({ name: 'audio', update: (t, dt) => this.audio.update(t, dt, chapterAt(t).id) });
            this.modules.push({ name: 'camera', update: (_t, dt) => this.cine.update(dt) });

            // Compila shaders ainda atrás do loading para evitar travada no primeiro plano.
            if (progress) progress.style.width = '92%';
            this.cine.restart();
            await this.renderer.compileAsync(this.scene, this.camera);
            this.resize();
            // Também aquece o pipeline de pós-processamento (bloom/output).
            this.post.render();
            await new Promise((resolve) => requestAnimationFrame(resolve));

            if (progress) progress.style.width = '100%';
            this.state = 'ready';
            document.body.dataset.state = 'ready';
            document.getElementById('loadingOverlay').hidden = true;
            document.getElementById('intro').hidden = false;

            if (this.failed.length) {
                console.info('[santos-1908] módulos pulados:', this.failed.join(', '));
            }
        } catch (err) {
            console.error(err);
            document.getElementById('loadingOverlay').hidden = true;
            const errEl = document.getElementById('errorOverlay');
            const txt = document.getElementById('errorText');
            if (txt) txt.textContent = err?.message || String(err);
            if (errEl) errEl.hidden = false;
        }
    }

    start() {
        this.audio.init();
        this.audio.setVolume(this.settings.volume / 100);
        this.audio.setEnabled(!this.settings.muted);
        document.getElementById('intro').hidden = true;
        document.getElementById('hud').hidden = false;
        document.getElementById('titleCard').hidden = false;
        document.body.dataset.state = 'playing';
        this.state = 'playing';
        this.cine.restart();
        this.cine.playing = true;
        this.clock.start();
        this.tick();
        // Esconde cartão de título após alguns segundos
        setTimeout(() => {
            const tc = document.getElementById('titleCard');
            if (tc) tc.hidden = true;
        }, 5000);
        this.updateMuteUi();
    }

    replay() {
        this.cine.restart();
        this.cine.playing = true;
        this.state = 'playing';
        document.body.dataset.state = 'playing';
        document.getElementById('titleCard').hidden = false;
        setTimeout(() => {
            const tc = document.getElementById('titleCard');
            if (tc) tc.hidden = true;
        }, 4500);
        if (!this._raf) this.tick();
    }

    togglePause() {
        if (this.state === 'playing') {
            this.cine.playing = false;
            this.state = 'paused';
            document.body.dataset.state = 'paused';
        } else if (this.state === 'paused') {
            this.cine.playing = true;
            this.state = 'playing';
            document.body.dataset.state = 'playing';
        }
    }

    toggleMute() {
        this.settings.muted = !this.settings.muted;
        this.audio?.setEnabled(!this.settings.muted);
        this.saveSettings();
        this.updateMuteUi();
    }

    updateMuteUi() {
        const btn = document.getElementById('muteBtn');
        if (btn) {
            btn.setAttribute('aria-pressed', this.settings.muted ? 'true' : 'false');
            btn.textContent = this.settings.muted ? 'Mudo' : 'Som';
        }
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
        else document.exitFullscreen?.();
    }

    resize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h, false);
        this.post?.resize(w, h);
    }

    adaptResolution(fps) {
        if (this.settings.quality !== 'auto') return;

        const minPr = 0.75;
        const maxPr = this.quality.pr;
        let next = this.pixelRatio;

        if (fps < 38) next = Math.max(minPr, next - 0.1);
        else if (fps > 56) next = Math.min(maxPr, next + 0.05);

        if (Math.abs(next - this.pixelRatio) < 0.04) return;
        this.pixelRatio = next;
        this.renderer.setPixelRatio(this.pixelRatio);
        this.post?.setPixelRatio?.(this.pixelRatio);
        this.resize();
    }

    tick() {
        this._raf = requestAnimationFrame(() => this.tick());
        const dt = Math.min(this.clock.getDelta(), 0.05);
        const t = this.cine.filmT;

        for (const mod of this.modules) {
            try {
                mod.update?.(t, dt);
            } catch (err) {
                if (!mod._dead) {
                    console.warn(`[santos-1908] update "${mod.name}" falhou:`, err);
                    mod._dead = true;
                }
            }
        }

        this.post.render();

        const timeEl = document.getElementById('filmTime');
        if (timeEl) timeEl.textContent = `${formatClock(t)} / ${formatClock(FILM_DURATION)}`;

        if (this.state === 'playing') {
            this.fpsAccum += dt;
            this.fpsFrames++;
            if (this.fpsAccum >= 2) {
                this.adaptResolution(this.fpsFrames / this.fpsAccum);
                this.fpsAccum = 0;
                this.fpsFrames = 0;
            }
        }
    }
}

new Santos1908();
