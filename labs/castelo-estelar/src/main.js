/**
 * Castelo Estelar — renderer Babylon.js, pós-processamento, abertura e órbita livre.
 */

import { buildKingdom, setupKingdomLights } from './world.js';
import { buildCastle } from './castle.js';
import { Magic } from './effects.js';
import { CineCamera, INTRO_DURATION } from './camera.js';
import { FanfareAudio } from './audio.js';
import { detectMobile } from './utils.js';

const STORAGE = 'castelo-estelar-settings';

const QUALITY = {
    low: {
        id: 'low', pr: 1, bloom: false, shadows: false,
        stars: 2000, trees: 40, sparks: 400, burst: 40
    },
    medium: {
        id: 'medium', pr: 1.35, bloom: true, shadows: true,
        shadowMap: 2048, stars: 4500, trees: 75, sparks: 850, burst: 70
    },
    high: {
        id: 'high', pr: 1.75, bloom: true, shadows: true,
        shadowMap: 2048, stars: 7000, trees: 110, sparks: 1300, burst: 100
    }
};

function pickQuality(mode) {
    if (QUALITY[mode]) return QUALITY[mode];
    if (detectMobile()) return QUALITY.low;
    if (window.devicePixelRatio >= 2 && window.innerWidth >= 1400) return QUALITY.high;
    return QUALITY.medium;
}

class CasteloEstelar {
    constructor() {
        this.canvas = document.getElementById('scene');
        this.settings = this.loadSettings();
        this.state = 'boot';
        this.introT = 0;
        this.fwTimes = [11.2, 11.8, 12.4, 13.0, 13.6, 14.2, 14.8];
        this.fwFired = new Set();
        this.audio = new FanfareAudio();

        this.bindUi();
        this.boot();
    }

    loadSettings() {
        try {
            return { quality: 'auto', volume: 72, muted: false, ...JSON.parse(localStorage.getItem(STORAGE) || '{}') };
        } catch {
            return { quality: 'auto', volume: 72, muted: false };
        }
    }

    saveSettings() {
        try { localStorage.setItem(STORAGE, JSON.stringify(this.settings)); } catch { /* privado */ }
    }

    bindUi() {
        document.getElementById('startButton')?.addEventListener('click', () => this.start());
        document.getElementById('replayButton')?.addEventListener('click', () => this.replay());
        document.getElementById('skipButton')?.addEventListener('click', () => this.skip());
        document.getElementById('muteBtn')?.addEventListener('click', () => this.toggleMute());
        document.getElementById('qualitySelect')?.addEventListener('change', (e) => {
            this.settings.quality = e.target.value;
            this.saveSettings();
        });
        document.getElementById('volumeSlider')?.addEventListener('input', (e) => {
            const v = Number(e.target.value) / 100;
            this.settings.volume = Number(e.target.value);
            document.getElementById('volumeValue').textContent = String(this.settings.volume);
            this.audio.setVolume(v);
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
            if (e.code === 'Space' && this.state === 'intro') {
                e.preventDefault();
                this.skip();
            }
            if (e.code === 'KeyR' && this.state !== 'boot') this.replay();
            if (e.code === 'KeyM') this.toggleMute();
            if (e.code === 'KeyF') this.toggleFullscreen();
        });
    }

    async boot() {
        const BABYLON = window.BABYLON;
        if (!BABYLON) {
            this.fail(new Error('Babylon.js não carregado.'));
            return;
        }

        try {
            this.engine = new BABYLON.Engine(this.canvas, true, {
                preserveDrawingBuffer: false,
                stencil: true,
                adaptToDeviceRatio: true
            });
            this.scene = new BABYLON.Scene(this.engine);
            this.scene.clearColor = new BABYLON.Color4(0.02, 0.03, 0.08, 1.0);
        } catch (err) {
            this.fail(err);
            return;
        }

        this.quality = pickQuality(this.settings.quality);

        // Câmera
        this.cineCam = new CineCamera(BABYLON, this.canvas, this.scene);

        // Reino & Castelo
        this.kingdom = buildKingdom(BABYLON, this.scene, this.quality);
        this.castle = buildCastle(BABYLON, this.scene);
        this.lights = setupKingdomLights(BABYLON, this.scene, this.quality);

        if (this.lights.shadowGen) {
            this.castle.root.getChildMeshes().forEach((m) => {
                this.lights.shadowGen.addShadowCaster(m, true);
            });
        }

        // Pós-processamento de cinema
        this.setupPipeline(BABYLON);

        // Efeitos de Fada e Fogos
        this.magic = new Magic(BABYLON, this.scene, this.quality);

        document.getElementById('loadingOverlay').hidden = true;
        document.getElementById('intro').hidden = false;
        document.body.dataset.state = 'intro';

        this.engine.runRenderLoop(() => {
            this.frame();
            this.scene.render();
        });

        window.addEventListener('resize', () => this.engine.resize());
        window.visualViewport?.addEventListener('resize', () => this.engine.resize());
    }

    setupPipeline(BABYLON) {
        const pipe = new BABYLON.DefaultRenderingPipeline('pipeline', true, this.scene, [this.cineCam.camera]);
        pipe.fxaaEnabled = true;

        if (this.quality.bloom) {
            pipe.bloomEnabled = true;
            pipe.bloomThreshold = 0.72;
            pipe.bloomWeight = 0.35;
            pipe.bloomKernel = 64;
        }

        pipe.imageProcessing.toneMappingEnabled = true;
        pipe.imageProcessing.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
        pipe.imageProcessing.contrast = 1.18;
        pipe.imageProcessing.exposure = 1.1;

        const glow = new BABYLON.GlowLayer('glow', this.scene);
        glow.intensity = 0.85;
    }

    start() {
        this.state = 'intro';
        this.introT = 0;
        this.fwFired.clear();
        this.cineCam.detachOrbit();

        document.getElementById('intro').hidden = true;
        document.getElementById('hud').hidden = false;
        document.getElementById('skipButton').hidden = false;
        document.body.dataset.state = 'play';

        this.audio.init();
        this.audio.setVolume(this.settings.volume / 100);
        this.audio.setEnabled(!this.settings.muted);
        this.audio.start();
    }

    skip() {
        if (this.state !== 'intro') return;
        this.finishIntro();
    }

    replay() {
        this.magic.reset();
        this.start();
    }

    finishIntro() {
        this.state = 'free';
        this.magic.stopFairy();
        this.cineCam.attachOrbit();
        document.getElementById('skipButton').hidden = true;
    }

    toggleMute() {
        this.settings.muted = !this.settings.muted;
        this.saveSettings();
        this.audio.setEnabled(!this.settings.muted);
        const btn = document.getElementById('muteBtn');
        if (btn) {
            btn.setAttribute('aria-pressed', String(!this.settings.muted));
            btn.textContent = this.settings.muted ? 'Mudo' : 'Som';
        }
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen?.().catch(() => {});
        } else {
            document.exitFullscreen?.().catch(() => {});
        }
    }

    frame() {
        const dt = this.engine.getDeltaTime() / 1000;

        if (this.state === 'intro') {
            this.introT += dt;
            this.cineCam.update(this.introT);

            // 1. Iniciar voo da fada aos 5.2s
            if (this.introT >= 5.2 && this.introT < 11.2) {
                if (!this.magic.fairyActive) this.magic.startFairy();
                const progress = (this.introT - 5.2) / 6.0;
                this.magic.updateFairy(progress);
            } else if (this.introT >= 11.2 && this.magic.fairyActive) {
                this.magic.stopFairy();
            }

            // 2. Disparos dos fogos de artifício
            const fwColors = ['#ffd700', '#00e5ff', '#ff1493', '#76ff03', '#ff9100', '#d500f9', '#ffffff'];
            this.fwTimes.forEach((t, i) => {
                if (this.introT >= t && !this.fwFired.has(i)) {
                    this.fwFired.add(i);
                    const x = (Math.random() - 0.5) * 22;
                    const y = 28 + Math.random() * 12;
                    const z = -2 + (Math.random() - 0.5) * 10;
                    this.magic.burst(x, y, z, fwColors[i % fwColors.length]);
                    this.audio.firework();
                }
            });

            // 3. Fim da introdução
            if (this.introT >= INTRO_DURATION) {
                this.finishIntro();
            }
        }
    }

    fail(err) {
        console.error(err);
        const overlay = document.getElementById('errorOverlay');
        const load = document.getElementById('loadingOverlay');
        if (load) load.hidden = true;
        if (overlay) overlay.hidden = false;
    }
}

try {
    new CasteloEstelar();
} catch (err) {
    console.error(err);
}
