/**
 * Castelo Estelar — renderer, pós-processamento, abertura e órbita livre.
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { Kingdom } from './world.js';
import { Magic } from './effects.js';
import { CineCamera, INTRO_DURATION } from './camera.js';
import { FanfareAudio } from './audio.js';
import { detectMobile, detectSoftwareGL, clamp, smoothstep } from './utils.js';

const STORAGE = 'castelo-estelar-settings';

const QUALITY = {
    low: {
        id: 'low', pr: 1, antialias: false, bloom: false, shadows: false,
        shadowMap: 1024, waterSize: 128, stars: 1800, trees: 40, clouds: 5,
        sparks: 400, burst: 40
    },
    medium: {
        id: 'medium', pr: 1.35, antialias: true, bloom: true, shadows: true,
        shadowMap: 2048, waterSize: 256, stars: 4200, trees: 70, clouds: 8,
        sparks: 900, burst: 70
    },
    high: {
        id: 'high', pr: 1.75, antialias: true, bloom: true, shadows: true,
        shadowMap: 4096, waterSize: 512, stars: 7000, trees: 110, clouds: 12,
        sparks: 1400, burst: 110
    }
};

function pickQuality(mode, renderer) {
    if (QUALITY[mode]) return QUALITY[mode];
    if (detectSoftwareGL(renderer) || detectMobile()) return QUALITY.low;
    if (devicePixelRatio >= 2 && innerWidth >= 1400) return QUALITY.high;
    return QUALITY.medium;
}

class CasteloEstelar {
    constructor() {
        this.canvas = document.getElementById('scene');
        this.settings = this.loadSettings();
        this.state = 'boot';
        this.clock = new THREE.Clock();
        this.introT = 0;
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

    boot() {
        try {
            this.renderer = new THREE.WebGLRenderer({
                canvas: this.canvas,
                antialias: true,
                alpha: false,
                powerPreference: 'high-performance'
            });
        } catch (err) {
            this.fail(err);
            return;
        }
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 0.88;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.setClearColor(0x050814, 1);

        this.quality = pickQuality(this.settings.quality, this.renderer);
        this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.quality.pr));
        this.renderer.setSize(innerWidth, innerHeight);
        this.renderer.shadowMap.enabled = this.quality.shadows;

        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x0a1528, 0.0032);

        this.camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.2, 700);
        this.cine = new CineCamera(this.camera, this.canvas);

        this.kingdom = new Kingdom(this.scene, this.renderer, this.quality);
        this.magic = new Magic(this.scene, this.quality);

        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        if (this.quality.bloom) {
            this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.55, 0.7, 0.72);
            this.composer.addPass(this.bloom);
        }
        this.composer.addPass(new OutputPass());

        window.addEventListener('resize', () => this.resize());
        this.resize();
        this.cine.apply(0);
        this.hide('#loadingOverlay');
        this.show('#intro');
        document.body.dataset.state = 'menu';
        this.clock.start();
        this.renderer.setAnimationLoop(() => this.frame());
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
        this.kingdom.setGlow(1);
        this.renderer.toneMappingExposure = 1.08;
        this.finishIntro();
    }

    finishIntro() {
        this.state = 'orbit';
        document.body.dataset.state = 'orbit';
        this.hide('#skipButton');
        this.show('#titleCard');
        document.getElementById('hint')?.classList.remove('is-gone');
        setTimeout(() => document.getElementById('hint')?.classList.add('is-gone'), 5200);
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

    resize() {
        const w = innerWidth;
        const h = innerHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
        this.composer.setSize(w, h);
        this.bloom?.setSize(w, h);
    }

    frame() {
        const dt = Math.min(this.clock.getDelta(), 0.05);
        const time = this.clock.elapsedTime;
        this.kingdom.tick(time);
        this.magic.tick(dt);
        this.cine.tick(dt);

        if (this.state === 'intro') {
            this.introT = this.cine.t;
            const glow = smoothstep(12.5, 16.5, this.introT);
            this.kingdom.setGlow(glow);
            this.renderer.toneMappingExposure = 0.88 + glow * 0.22;
            this.magic.setIntro(this.introT, this.audio);
            if (this.introT >= 18) this.show('#titleCard');
            if (this.cine.mode === 'orbit') this.finishIntro();
        } else if (this.state === 'orbit') {
            this.kingdom.setGlow(1);
        }

        const sparkMat = this.magic.sparks.pts.material;
        if (sparkMat.uniforms?.uPixel) {
            sparkMat.uniforms.uPixel.value = 220 * clamp(this.quality.pr, 1, 2);
        }

        this.composer.render();
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
