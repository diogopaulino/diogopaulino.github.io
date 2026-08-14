/**
 * Eyra — laço principal: renderer, pós-processamento, voo e o vínculo com a Yva.
 */

import * as THREE from 'three';
import { World } from './world.js';
import { Player } from './player.js';
import { Effects } from './effects.js';
import { Input } from './input.js';
import { Hud } from './hud.js';
import { EyraAudio } from './audio.js';
import { tickShaders } from './shaders.js';
import {
    QUALITY, PHYS, SEEDS, ZONES, loadSettings, saveSettings
} from './config.js';
import { detectMobile, detectSoftwareGL, zoneAt, clamp } from './utils.js';

function pickQuality(mode, renderer) {
    if (QUALITY[mode]) return QUALITY[mode];
    const mobile = detectMobile() || innerWidth < 800;
    if (detectSoftwareGL(renderer) || mobile) return QUALITY.low;
    if (devicePixelRatio >= 2 && innerWidth >= 1400) return QUALITY.high;
    return QUALITY.medium;
}

class Eyra {
    constructor() {
        this.canvas = document.getElementById('scene');
        this.hud = new Hud();
        this.audio = new EyraAudio();
        this.input = new Input(this.canvas);
        this.state = 'boot';
        this.settings = loadSettings();
        this.bindUi();
        this.boot();
    }

    bindUi() {
        const h = this.hud.el;
        h.qualitySelect.value = this.settings.quality;
        h.volumeSlider.value = this.settings.volume;
        h.volumeValue.textContent = this.settings.volume;
        this.hud.setBest(this.settings.best);
        this.hud.setSound(!this.settings.muted);

        h.startButton.addEventListener('click', () => this.start());
        h.resumeButton.addEventListener('click', () => this.resume());
        h.pauseMenuButton.addEventListener('click', () => this.enterMenu());
        h.replayButton.addEventListener('click', () => this.start());
        h.victoryMenuButton.addEventListener('click', () => this.enterMenu());
        h.pauseButton.addEventListener('click', () => {
            if (this.state === 'play') this.pause();
            else if (this.state === 'pause') this.resume();
        });
        h.soundButton.addEventListener('click', () => this.toggleMute());
        h.qualitySelect.addEventListener('change', () => {
            this.settings.quality = h.qualitySelect.value;
            saveSettings(this.settings);
        });
        h.volumeSlider.addEventListener('input', () => {
            this.settings.volume = Number(h.volumeSlider.value);
            h.volumeValue.textContent = this.settings.volume;
            this.audio.setVolume(this.settings.volume / 100);
            saveSettings(this.settings);
        });

        this.input.on('pause', () => {
            if (this.state === 'play') this.pause();
            else if (this.state === 'pause') this.resume();
        });
        this.input.on('mute', () => this.toggleMute());

        this.input.bindTouch({
            stick: document.getElementById('moveStick'),
            knob: document.getElementById('moveKnob'),
            boost: document.getElementById('btnBoost'),
            roll: document.getElementById('btnRoll')
        });

        window.addEventListener('resize', () => this.resize());
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state === 'play') this.pause();
        });
    }

    async boot() {
        this.hud.setLoading(0.08, 'Abrindo o céu…');
        try {
            await this.setupRenderer();
        } catch (err) {
            this.hud.fail(err?.message || 'Falha ao iniciar o WebGL.');
            return;
        }

        this.hud.setLoading(0.32, 'Erguendo os picos…');
        this.world = new World(this.scene, this.quality);

        this.hud.setLoading(0.58, 'Chamando a ira…');
        this.player = new Player(this.scene, this.camera);
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
            this.fpsAcc = 0;
            this.fpsFrames = 0;
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
        this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.quality.pixelRatio));
        this.renderer.setSize(innerWidth, innerHeight);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.08;
        this.renderer.shadowMap.enabled = this.quality.shadows;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.35, 1400);

        const hemi = new THREE.HemisphereLight(0xffe2b0, 0x1a4a38, 0.72);
        this.scene.add(hemi);

        this.sun = new THREE.DirectionalLight(0xffe8c0, 1.55);
        this.sun.position.set(80, 90, 40);
        this.sun.castShadow = this.quality.shadows;
        if (this.quality.shadows) {
            this.sun.shadow.mapSize.set(2048, 2048);
            this.sun.shadow.camera.near = 10;
            this.sun.shadow.camera.far = 320;
            this.sun.shadow.camera.left = -140;
            this.sun.shadow.camera.right = 140;
            this.sun.shadow.camera.top = 140;
            this.sun.shadow.camera.bottom = -140;
            this.sun.shadow.bias = -0.00035;
        }
        this.scene.add(this.sun);
        this.scene.add(new THREE.AmbientLight(0x4a7080, 0.32));
        const fill = new THREE.DirectionalLight(0x88c8e0, 0.4);
        fill.position.set(-50, 30, -40);
        this.scene.add(fill);
        const bio = new THREE.PointLight(0x5ef0d8, 1.2, 80, 1.4);
        bio.position.set(0, 52, 0);
        this.scene.add(bio);
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
                0.32,
                0.48,
                0.78
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
        this.seeds = 0;
        this.rings = 0;
        this.combo = 1;
        this.comboTimer = 0;
        this.score = 0;
        this.playTime = 0;
        this.won = false;
        this.player.reset();
        this.world.resetPickups();
        this.hud.setScore({ seeds: 0, combo: 1, score: 0 });
        this.hud.setTouchVisible(matchMedia('(pointer: coarse)').matches);
        this.hud.showPlay();
        this.hud.say('Voe até as sementes de luz. Espaço é o impulso.');
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
        saveSettings(this.settings);
    }

    collectSeed(seed) {
        seed.userData.taken = true;
        seed.visible = false;
        this.seeds++;
        this.combo = Math.min(12, this.combo + 1);
        this.comboTimer = PHYS.comboWindow;
        this.score += 400 * this.combo;
        this.effects.burst(seed.position.clone());
        this.audio.seed(this.combo);
        this.hud.setScore({ seeds: this.seeds, combo: this.combo, score: this.score });
        this.hud.say(this.seeds >= SEEDS
            ? 'As oito sementes cantam. Volte à Yva.'
            : `Semente ${this.seeds} de ${SEEDS}.`);
        this.sun.intensity = 1.55 - (this.seeds / SEEDS) * 0.35;
    }

    collectRing(ring) {
        ring.userData.taken = true;
        this.rings++;
        this.combo = Math.min(12, this.combo + 1);
        this.comboTimer = PHYS.comboWindow;
        this.score += 80 * this.combo;
        this.audio.ring(this.combo);
        this.hud.setScore({ seeds: this.seeds, combo: this.combo, score: this.score });
        this.player.boost = clamp(this.player.boost + 0.12, 0, 1);
    }

    win() {
        this.won = true;
        this.audio.victory();
        this.effects.burst(this.world.yvaPos.clone(), 0xffe08a);
        if (!this.settings.best || this.score > this.settings.best) {
            this.settings.best = this.score;
            saveSettings(this.settings);
            this.hud.setBest(this.settings.best);
        }
        setTimeout(() => {
            this.state = 'victory';
            this.hud.showVictory({
                seeds: this.seeds,
                rings: this.rings,
                score: this.score,
                seconds: this.playTime
            });
        }, 1400);
    }

    frame(now) {
        const dt = Math.min(0.033, (now - this.last) / 1000) || 0.016;
        this.last = now;

        const look = this.input.sample();
        const playing = this.state === 'play';
        const dusk = 0.18 + (this.seeds / SEEDS) * 0.55;

        if (playing) {
            this.playTime += dt;
            this.comboTimer -= dt;
            if (this.comboTimer <= 0) this.combo = 1;

            const boosting = this.input.boostHeld;
            const roll = this.input.consumeRoll();
            if (roll) this.player.startRoll(roll);

            const hit = this.player.update(dt, this.input, look, this.world, boosting);
            if (hit) this.audio.hit();

            const pos = this.player.pos;
            for (const seed of this.world.seeds) {
                if (seed.userData.taken) continue;
                if (pos.distanceTo(seed.position) < 4.2) this.collectSeed(seed);
            }
            for (const ring of this.world.rings) {
                if (ring.userData.taken) continue;
                if (pos.distanceTo(ring.position) < 3.4) this.collectRing(ring);
            }

            if (this.seeds >= SEEDS && !this.won && this.world.yvaPos) {
                if (pos.distanceTo(this.world.yvaPos) < 14) this.win();
            }

            const zone = zoneAt(pos.y, ZONES);
            this.hud.setFlight({
                alt: pos.y,
                zone: zone.name,
                speed: this.player.speed * 1.8,
                boost: this.player.boost
            });
            this.hud.setScore({ seeds: this.seeds, combo: this.combo, score: this.score });
            this.audio.setFlight(this.player.speed / PHYS.maxSpeed, boosting);
            this.audio.tick(dt);
        } else {
            const t = now * 0.00008;
            this.camera.position.set(Math.cos(t) * 90, 62 + Math.sin(t * 0.7) * 10, Math.sin(t) * 90);
            this.camera.lookAt(0, 48, 0);
            this.camera.fov = 52;
            this.camera.updateProjectionMatrix();
            this.input.look.dx = this.input.look.dy = 0;
        }

        this.world.update(dt, dusk);
        this.effects.update(dt, playing ? this.player.pos : null);
        tickShaders(this.scene, now * 0.001);
        this.render();

        this.fpsAcc += dt;
        this.fpsFrames++;
        if (this.fpsAcc >= 0.5) {
            this.hud.setFps(Math.round(this.fpsFrames / this.fpsAcc));
            this.fpsAcc = 0;
            this.fpsFrames = 0;
        }
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

new Eyra();
