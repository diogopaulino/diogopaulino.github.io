/**
 * Lúmina — laço principal: renderer, pós-processamento, voo e o acender do reino.
 */

import * as THREE from 'three';
import { Kingdom } from './world.js';
import { Player } from './player.js';
import { Effects } from './effects.js';
import { Input } from './input.js';
import { Hud } from './hud.js';
import { LuminaAudio } from './audio.js';

const STORAGE = 'lumina-settings';
const TOTAL_WISHES = 8;

const QUALITY = {
    low: { pr: 1, antialias: false, bloom: false, shadows: false, clouds: 8, fireflies: 40, lanterns: 8, trail: 12 },
    medium: { pr: 1.35, antialias: true, bloom: true, shadows: true, clouds: 14, fireflies: 80, lanterns: 14, trail: 20 },
    high: { pr: 1.75, antialias: true, bloom: true, shadows: true, clouds: 20, fireflies: 120, lanterns: 20, trail: 28 }
};

function detectSoftwareGL(renderer) {
    try {
        const gl = renderer.getContext();
        const info = gl.getExtension('WEBGL_debug_renderer_info');
        if (!info) return false;
        const name = gl.getParameter(info.UNMASKED_RENDERER_WEBGL) || '';
        return /swiftshader|llvmpipe|softpipe|microsoft basic render/i.test(name);
    } catch {
        return false;
    }
}

function pickQuality(mode, renderer) {
    if (QUALITY[mode]) return QUALITY[mode];
    const mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 800;
    if (detectSoftwareGL(renderer) || mobile) return QUALITY.low;
    if (devicePixelRatio >= 2 && innerWidth >= 1400) return QUALITY.high;
    return QUALITY.medium;
}

const LANTERN_COLORS = [0xffb347, 0xff6fae, 0xffe066, 0x9ad8ff, 0xff9f43];

class Lumina {
    constructor() {
        this.canvas = document.getElementById('scene');
        this.hud = new Hud();
        this.audio = new LuminaAudio();
        this.input = new Input(this.canvas);
        this.state = 'boot';
        this.wishes = 0;
        this.lanterns = 0;
        this.playTime = 0;
        this.night = 0;
        this.won = false;
        this.settings = this.loadSettings();
        this.bindUi();
        this.boot();
    }

    loadSettings() {
        try {
            return {
                quality: 'auto',
                volume: 70,
                muted: false,
                best: null,
                ...JSON.parse(localStorage.getItem(STORAGE) || '{}')
            };
        } catch {
            return { quality: 'auto', volume: 70, muted: false, best: null };
        }
    }

    saveSettings() {
        localStorage.setItem(STORAGE, JSON.stringify(this.settings));
    }

    bindUi() {
        const h = this.hud.el;
        h.qualitySelect.value = this.settings.quality;
        h.volumeSlider.value = this.settings.volume;
        h.volumeValue.textContent = this.settings.volume;
        this.hud.setBest(this.settings.best);
        this.hud.setSound(!this.settings.muted);

        document.getElementById('startButton').addEventListener('click', () => this.start());
        document.getElementById('resumeButton').addEventListener('click', () => this.resume());
        document.getElementById('pauseMenuButton').addEventListener('click', () => this.enterMenu());
        document.getElementById('replayButton').addEventListener('click', () => this.start());
        document.getElementById('victoryMenuButton').addEventListener('click', () => this.enterMenu());
        h.pauseButton.addEventListener('click', () => {
            if (this.state === 'play') this.pause();
            else if (this.state === 'pause') this.resume();
        });
        h.soundButton.addEventListener('click', () => this.toggleMute());
        h.qualitySelect.addEventListener('change', () => {
            this.settings.quality = h.qualitySelect.value;
            this.saveSettings();
        });
        h.volumeSlider.addEventListener('input', () => {
            this.settings.volume = Number(h.volumeSlider.value);
            h.volumeValue.textContent = this.settings.volume;
            this.audio.setVolume(this.settings.volume / 100);
            this.saveSettings();
        });

        this.input.on('pause', () => {
            if (this.state === 'play') this.pause();
            else if (this.state === 'pause') this.resume();
        });
        this.input.on('mute', () => this.toggleMute());

        this.input.bindTouch({
            stick: document.getElementById('moveStick'),
            knob: document.getElementById('moveKnob'),
            up: document.getElementById('btnUp'),
            down: document.getElementById('btnDown'),
            lantern: document.getElementById('btnLantern')
        });

        window.addEventListener('resize', () => this.resize());
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state === 'play') this.pause();
        });
    }

    async boot() {
        this.hud.setLoading(0.08, 'Abrindo o livro…');
        try {
            await this.setupRenderer();
        } catch (err) {
            this.hud.fail(err?.message || 'Falha ao iniciar o WebGL.');
            return;
        }

        this.hud.setLoading(0.35, 'Erguendo a ilha…');
        this.kingdom = new Kingdom(this.scene, this.quality);

        this.hud.setLoading(0.6, 'Chamando Luma…');
        this.player = new Player(this.scene, this.camera, this.canvas);
        this.effects = new Effects(this.scene, this.quality);

        this.hud.setLoading(0.82, 'Acendendo o sol…');
        await this.setupBloom();

        this.renderer.compile(this.scene, this.camera);
        this.render();
        this.hud.setLoading(1, 'Pronto');
        setTimeout(() => {
            this.hud.hideLoading();
            this.enterMenu();
            this.last = performance.now();
            this.renderer.setAnimationLoop((now) => this.frame(now));
        }, 280);
    }

    async setupRenderer() {
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            powerPreference: 'high-performance',
            stencil: false
        });
        if (!this.renderer.getContext()) {
            throw new Error('WebGL indisponível neste navegador.');
        }
        this.quality = pickQuality(this.settings.quality, this.renderer);
        this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.quality.pr));
        this.renderer.setSize(innerWidth, innerHeight);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.12;
        this.renderer.shadowMap.enabled = this.quality.shadows;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.2, 900);

        const hemi = new THREE.HemisphereLight(0xffc4e0, 0x6fd15a, 0.85);
        this.scene.add(hemi);

        this.sun = new THREE.DirectionalLight(0xffe0b0, 1.35);
        this.sun.position.set(28, 34, 18);
        this.sun.castShadow = this.quality.shadows;
        if (this.quality.shadows) {
            this.sun.shadow.mapSize.set(2048, 2048);
            this.sun.shadow.camera.near = 4;
            this.sun.shadow.camera.far = 90;
            this.sun.shadow.camera.left = -42;
            this.sun.shadow.camera.right = 42;
            this.sun.shadow.camera.top = 42;
            this.sun.shadow.camera.bottom = -42;
            this.sun.shadow.bias = -0.0004;
        }
        this.scene.add(this.sun);
        this.scene.add(new THREE.AmbientLight(0xffd4c4, 0.28));
        const fill = new THREE.DirectionalLight(0xa8c4ff, 0.35);
        fill.position.set(-22, 12, -16);
        this.scene.add(fill);
    }

    async setupBloom() {
        if (!this.quality.bloom) return;
        try {
            const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }] = await Promise.all([
                import('three/addons/postprocessing/EffectComposer.js'),
                import('three/addons/postprocessing/RenderPass.js'),
                import('three/addons/postprocessing/UnrealBloomPass.js'),
                import('three/addons/postprocessing/OutputPass.js')
            ]);
            const composer = new EffectComposer(this.renderer);
            composer.setPixelRatio(this.renderer.getPixelRatio());
            composer.setSize(innerWidth, innerHeight);
            composer.addPass(new RenderPass(this.scene, this.camera));
            composer.addPass(new UnrealBloomPass(
                new THREE.Vector2(innerWidth, innerHeight),
                0.28,
                0.55,
                0.72
            ));
            composer.addPass(new OutputPass());
            this.composer = composer;
        } catch {
            this.composer = null;
        }
    }

    start() {
        this.audio.init();
        this.audio.setVolume(this.settings.volume / 100);
        this.audio.setEnabled(!this.settings.muted);
        this.wishes = 0;
        this.lanterns = 0;
        this.playTime = 0;
        this.night = 0;
        this.won = false;
        this.player.reset();
        for (const wish of this.kingdom.wishes) {
            wish.visible = true;
            wish.userData.taken = false;
        }
        this.hud.setWishes(0, TOTAL_WISHES);
        this.hud.setLanterns(0);
        this.hud.setTouchVisible(matchMedia('(pointer: coarse)').matches);
        this.hud.showPlay();
        this.hud.say('Voe até os desejos dourados. Espaço solta uma lanterna.');
        this.state = 'play';
        document.body.dataset.state = 'play';
    }

    enterMenu() {
        this.state = 'menu';
        document.body.dataset.state = 'menu';
        this.hud.showMenu();
    }

    pause() {
        if (this.state !== 'play') return;
        this.state = 'pause';
        this.hud.showPause();
    }

    resume() {
        if (this.state !== 'pause') return;
        this.state = 'play';
        this.hud.hidePause();
        this.last = performance.now();
    }

    toggleMute() {
        this.settings.muted = !this.settings.muted;
        this.audio.setEnabled(!this.settings.muted);
        this.hud.setSound(!this.settings.muted);
        this.saveSettings();
    }

    collectWish(wish) {
        wish.userData.taken = true;
        wish.visible = false;
        this.wishes++;
        this.effects.collectBurst(wish.position);
        this.audio.collect();
        this.hud.setWishes(this.wishes, TOTAL_WISHES);
        this.hud.say(`Desejo de ${wish.userData.label}.`);
        this.night = this.wishes / TOTAL_WISHES * 0.72;
        this.sun.intensity = 1.35 - this.night * 0.55;

        if (this.wishes >= TOTAL_WISHES && !this.won) {
            this.won = true;
            this.effects.fireworks(new THREE.Vector3(0, 10, -12));
            this.audio.victory();
            const seconds = this.playTime;
            const stamp = `${this.lanterns} lanternas · ${Math.floor(seconds)}s`;
            if (!this.settings.best) this.settings.best = stamp;
            this.saveSettings();
            this.hud.setBest(this.settings.best);
            setTimeout(() => {
                this.state = 'victory';
                this.hud.showVictory({
                    wishes: this.wishes,
                    lanterns: this.lanterns,
                    seconds
                });
            }, 1600);
        }
    }

    releaseLantern() {
        const origin = this.player.mesh.position.clone();
        origin.y += 0.6;
        const color = LANTERN_COLORS[this.lanterns % LANTERN_COLORS.length];
        this.effects.releaseLantern(origin, color);
        this.lanterns++;
        this.hud.setLanterns(this.lanterns);
        this.audio.lantern();
    }

    frame(now) {
        const dt = Math.min(0.033, (now - this.last) / 1000) || 0.016;
        this.last = now;

        const look = this.input.sample();
        const playing = this.state === 'play';

        if (playing) {
            this.playTime += dt;
            this.player.update(dt, this.input, look, this.kingdom);
            if (this.input.consumeLantern()) this.releaseLantern();

            const pos = this.player.mesh.position;
            for (const wish of this.kingdom.wishes) {
                if (wish.userData.taken) continue;
                if (pos.distanceTo(wish.position) < 1.8) this.collectWish(wish);
            }
        } else {
            // órbita cinemática no menu
            const t = now * 0.00012;
            this.camera.position.set(Math.cos(t) * 38, 14 + Math.sin(t * 0.6) * 3, Math.sin(t) * 38);
            this.camera.lookAt(0, 4, -6);
            this.input.look.dx = this.input.look.dy = 0;
        }

        this.kingdom.update(dt, this.night);
        this.effects.update(dt, playing ? this.player.mesh.position : null);
        this.render();
    }

    render() {
        if (this.composer) this.composer.render();
        else this.renderer.render(this.scene, this.camera);
    }

    resize() {
        const w = innerWidth;
        const h = innerHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
        this.composer?.setSize(w, h);
    }
}

new Lumina();
