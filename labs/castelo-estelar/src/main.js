/**
 * Castelo Estelar — Babylon.js Engine, Pipeline PBR Hiper-Realista,
 * Abertura Cinemática e Órbita Interativa.
 */

import { Kingdom } from './world.js';
import { Magic } from './effects.js';
import { CineCamera, INTRO_DURATION } from './camera.js';
import { FanfareAudio } from './audio.js';
import { detectMobile, detectSoftwareGL, clamp, smoothstep } from './utils.js';

const STORAGE = 'castelo-estelar-settings';

const QUALITY = {
    low: {
        id: 'low', pr: 1.0, antialias: false, bloom: false, shadows: false,
        shadowMap: 1024, waterSize: 128, stars: 1600, trees: 40,
        sparks: 500, burst: 45
    },
    medium: {
        id: 'medium', pr: 1.35, antialias: true, bloom: true, shadows: true,
        shadowMap: 2048, waterSize: 256, stars: 4000, trees: 70,
        sparks: 1000, burst: 85
    },
    high: {
        id: 'high', pr: 1.75, antialias: true, bloom: true, shadows: true,
        shadowMap: 4096, waterSize: 512, stars: 7000, trees: 110,
        sparks: 1600, burst: 120
    }
};

function pickQuality(mode, engine) {
    if (QUALITY[mode]) return QUALITY[mode];
    if (detectSoftwareGL(engine) || detectMobile()) return QUALITY.low;
    if (window.devicePixelRatio >= 2 && window.innerWidth >= 1400) return QUALITY.high;
    return QUALITY.medium;
}

class CasteloEstelar {
    constructor() {
        this.canvas = document.getElementById('scene');
        this.settings = this.loadSettings();
        this.state = 'boot';
        this.introT = 0;
        this.lastTime = performance.now();
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
        try {
            localStorage.setItem(STORAGE, JSON.stringify(this.settings));
        } catch { /* storage privado */ }
    }

    bindUi() {
        document.getElementById('startButton')?.addEventListener('click', () => this.start());
        document.getElementById('replayButton')?.addEventListener('click', () => this.replay());
        document.getElementById('skipButton')?.addEventListener('click', () => this.skip());
        document.getElementById('muteBtn')?.addEventListener('click', () => this.toggleMute());
        document.getElementById('qualitySelect')?.addEventListener('change', (e) => {
            this.settings.quality = e.target.value;
            this.saveSettings();
            location.reload();
        });
        document.getElementById('volumeSlider')?.addEventListener('input', (e) => {
            const v = Number(e.target.value) / 100;
            this.settings.volume = Number(e.target.value);
            const valLabel = document.getElementById('volumeValue');
            if (valLabel) valLabel.textContent = String(this.settings.volume);
            this.audio.setVolume(v);
            this.saveSettings();
        });

        const vol = document.getElementById('volumeSlider');
        if (vol) {
            vol.value = String(this.settings.volume);
            const valLabel = document.getElementById('volumeValue');
            if (valLabel) valLabel.textContent = String(this.settings.volume);
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

    boot() {
        const B = window.BABYLON;
        if (!B) {
            this.fail('Babylon.js não pôde ser carregado.');
            return;
        }

        try {
            this.engine = new B.Engine(this.canvas, true, {
                preserveDrawingBuffer: false,
                stencil: true,
                antialias: true,
                powerPreference: 'high-performance'
            });
        } catch (err) {
            this.fail(err);
            return;
        }

        this.quality = pickQuality(this.settings.quality, this.engine);
        this.engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio || 1, this.quality.pr));

        this.scene = new B.Scene(this.engine);
        this.scene.clearColor = new B.Color4(0.02, 0.03, 0.07, 1);

        this.kingdom = new Kingdom(this.scene, this.engine, this.quality);
        this.magic = new Magic(this.scene, this.quality);
        this.cine = new CineCamera(this.scene, this.canvas);

        // Pipeline de Pós-processamento Hiper-Realista
        this.pipeline = new B.DefaultRenderingPipeline('default_pipeline', true, this.scene, [this.cine.camera]);
        this.pipeline.bloomEnabled = this.quality.bloom;
        this.pipeline.bloomThreshold = 0.55;
        this.pipeline.bloomWeight = 0.65;
        this.pipeline.bloomKernel = 64;
        this.pipeline.bloomScale = 0.5;

        this.pipeline.imageProcessingEnabled = true;
        this.pipeline.imageProcessing.toneMappingEnabled = true;
        this.pipeline.imageProcessing.toneMappingType = B.ImageProcessingConfiguration.TONEMAPPING_ACES;
        this.pipeline.imageProcessing.exposure = 0.95;
        this.pipeline.imageProcessing.contrast = 1.14;

        this.pipeline.imageProcessing.vignetteEnabled = true;
        this.pipeline.imageProcessing.vignetteWeight = 1.25;
        this.pipeline.imageProcessing.vignetteStretch = 0.5;

        this.pipeline.fxaaEnabled = this.quality.antialias;
        this.pipeline.samples = this.quality.id === 'high' ? 4 : 2;

        if (this.quality.id === 'high') {
            this.pipeline.chromaticAberrationEnabled = true;
            this.pipeline.chromaticAberration.aberrationAmount = 14;
        }

        // Camada de Brilho Emissivo (GlowLayer)
        this.glow = new B.GlowLayer('glow_layer', this.scene, {
            mainTextureFixedSize: 512,
            blurKernelSize: 32
        });
        this.glow.intensity = 0.85;

        window.addEventListener('resize', () => {
            this.engine.resize();
        });

        this.cine.apply(0);
        this.hide('#loadingOverlay');
        this.show('#intro');
        document.body.dataset.state = 'menu';

        this.lastTime = performance.now();
        this.engine.runRenderLoop(() => this.frame());
    }

    fail(err) {
        console.error(err);
        this.hide('#loadingOverlay');
        const ov = document.getElementById('errorOverlay');
        const text = document.getElementById('errorText');
        if (text && err) text.textContent = String(err.message || err);
        if (ov) ov.hidden = false;
    }

    start() {
        this.hide('#intro');
        this.audio.setVolume(this.settings.volume / 100);
        this.audio.setEnabled(!this.settings.muted);
        this.audio.playFanfare();
        this.magic.replay();
        this.cine.playIntro();
        this.introT = 0;
        this.state = 'intro';
        document.body.dataset.state = 'intro';
        this.show('#hud');
        this.show('#skipButton');
        this.hide('#titleCard');
        this.syncMute();
    }

    replay() {
        this.magic.replay();
        this.cine.playIntro();
        this.introT = 0;
        this.state = 'intro';
        document.body.dataset.state = 'intro';
        this.show('#skipButton');
        this.hide('#titleCard');
        this.audio.playFanfare();
    }

    skip() {
        if (this.state !== 'intro') return;
        this.cine.skip();
        this.introT = INTRO_DURATION;
        this.kingdom.setGlow(1.0);
        this.pipeline.imageProcessing.exposure = 1.12;
        this.finishIntro();
    }

    finishIntro() {
        this.state = 'orbit';
        document.body.dataset.state = 'orbit';
        this.hide('#skipButton');
        this.show('#titleCard');
        const hint = document.getElementById('hint');
        if (hint) {
            hint.classList.remove('is-gone');
            setTimeout(() => hint.classList.add('is-gone'), 5500);
        }
    }

    toggleMute() {
        this.settings.muted = !this.settings.muted;
        this.audio.setEnabled(!this.settings.muted);
        this.saveSettings();
        this.syncMute();
    }

    syncMute() {
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

    frame() {
        const now = performance.now();
        const dt = Math.min((now - this.lastTime) / 1000, 0.05);
        this.lastTime = now;
        const time = now / 1000;

        this.kingdom.tick(time);
        this.magic.tick(dt);
        this.cine.tick(dt);

        if (this.state === 'intro') {
            this.introT = this.cine.t;
            const glow = smoothstep(12.5, 16.5, this.introT);
            this.kingdom.setGlow(glow);
            this.pipeline.imageProcessing.exposure = 0.95 + glow * 0.22;
            this.magic.setIntro(this.introT, this.audio);

            if (this.introT >= 18.0) this.show('#titleCard');
            if (this.cine.mode === 'orbit') this.finishIntro();
        } else if (this.state === 'orbit') {
            this.kingdom.setGlow(1.0);
        }

        this.scene.render();
    }

    show(sel) {
        const el = document.querySelector(sel);
        if (el) el.hidden = false;
    }

    hide(sel) {
        const el = document.querySelector(sel);
        if (el) el.hidden = true;
    }
}

new CasteloEstelar();
