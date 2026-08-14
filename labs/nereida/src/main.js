/**
 * Nereida — laço principal.
 * A arraia segue a corrente, os anéis alimentam o combo e o templo
 * náutilo espera no fim do recife.
 */

import * as THREE from 'three';
import { CAMERA, COURSE, DIFFICULTY, PHYS, QUALITY, ZONES, loadSettings, saveSettings } from './config.js';
import { Effects } from './effects.js';
import { GameAudio } from './audio.js';
import { Hud } from './hud.js';
import { Input } from './input.js';
import { Manta } from './manta.js';
import { tickShaders } from './shaders.js';
import { causticTexture, coralTexture, mantaTexture, sandTexture, skyTexture } from './textures.js';
import { clamp, detectMobile, detectSoftwareGL, zoneAt } from './utils.js';
import { Reef } from './world.js';

class Game {
    constructor() {
        this.settings = loadSettings();
        this.state = 'boot';
        this.hud = new Hud();
        this.canvas = document.getElementById('scene');
        this.audio = new GameAudio();
        this.input = new Input();
        this.time = 0;
        this.playTime = 0;
        this.fpsAccum = 0;
        this.fpsFrames = 0;
        this.comboGap = 0;
        this.bindUi();
        this.init();
    }

    resolveQuality() {
        const choice = this.settings.quality;
        if (choice !== 'auto' && QUALITY[choice]) return QUALITY[choice];
        if (detectMobile() || detectSoftwareGL()) return QUALITY.low;
        const cores = navigator.hardwareConcurrency || 8;
        if (cores <= 4) return QUALITY.low;
        const big = Math.min(window.innerWidth, window.innerHeight) >= 900;
        return big ? QUALITY.high : QUALITY.medium;
    }

    bindUi() {
        const h = this.hud.el;
        this.hud.bindSettings({
            quality: this.settings.quality,
            volume: this.settings.volume,
            onQuality: (v) => {
                this.settings.quality = v;
                saveSettings(this.settings);
            },
            onVolume: (v) => {
                this.settings.volume = v;
                this.audio.setVolume(v / 100);
                saveSettings(this.settings);
            }
        });
        this.hud.buildDifficulties(this.settings.difficulty, (id) => {
            this.settings.difficulty = id;
            saveSettings(this.settings);
        });
        this.hud.setBest(this.settings.best);
        this.audio.setVolume(this.settings.volume / 100);
        this.audio.setEnabled(!this.settings.muted);
        this.hud.setMuted(this.settings.muted);

        h.startButton.addEventListener('click', () => this.start());
        h.resumeButton.addEventListener('click', () => this.resume());
        h.pauseMenuButton.addEventListener('click', () => this.toMenu());
        h.retryButton.addEventListener('click', () => this.start());
        h.overMenuButton.addEventListener('click', () => this.toMenu());
        h.soundButton.addEventListener('click', () => this.toggleMute());
        h.pauseButton.addEventListener('click', () => {
            if (this.state === 'playing') this.pause();
            else if (this.state === 'paused') this.resume();
        });

        this.input.on('pause', () => {
            if (this.state === 'playing') this.pause();
            else if (this.state === 'paused') this.resume();
            else if (this.state === 'menu') this.start();
        });
        this.input.on('mute', () => this.toggleMute());
        this.input.on('camera', () => {
            if (this.state !== 'playing' || !this.manta) return;
            const name = this.manta.cycleCamera();
            this.hud.message(name, 900);
        });
        this.input.on('confirm', () => {
            if (this.state === 'menu') this.start();
        });
        this.input.on('rollLeft', () => this.tryRoll(-1));
        this.input.on('rollRight', () => this.tryRoll(1));

        this.input.bindTouch({
            lookZone: h.lookZone,
            boost: h.touchBoost,
            roll: h.touchRoll
        });
    }

    async init() {
        this.hud.setLoading(0.08, 'A maré sobe…');
        if (document.fonts?.ready) await document.fonts.ready;
        this.quality = this.resolveQuality();

        try {
            this.renderer = new THREE.WebGLRenderer({
                canvas: this.canvas,
                antialias: this.quality.antialias,
                powerPreference: 'high-performance',
                stencil: false
            });
        } catch {
            this.hud.showError('Não foi possível iniciar o WebGL neste navegador.');
            return;
        }

        const pr = Math.min(window.devicePixelRatio || 1, this.quality.pixelRatio);
        this.renderer.setPixelRatio(pr);
        this.renderer.setSize(window.innerWidth, window.innerHeight, false);
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.05;
        this.renderer.shadowMap.enabled = this.quality.shadows;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x02141c);
        this.scene.fog = new THREE.FogExp2(0x053445, 0.018);

        this.camera = new THREE.PerspectiveCamera(CAMERA.chase.fov, window.innerWidth / window.innerHeight, 0.2, 420);
        this.camera.position.set(0, 20, -12);

        this.hud.setLoading(0.22, 'Tecendo caústicas…');
        this.textures = {
            sand: sandTexture(THREE),
            coral: coralTexture(THREE),
            manta: mantaTexture(THREE),
            sky: skyTexture(THREE),
            caustic: causticTexture(THREE)
        };

        const hemi = new THREE.HemisphereLight(0x7ad0d8, 0x0a2430, 0.85);
        this.scene.add(hemi);
        const sun = new THREE.DirectionalLight(0xd8fff6, 1.35);
        sun.position.set(18, 42, 8);
        sun.castShadow = this.quality.shadows;
        if (sun.castShadow) {
            sun.shadow.mapSize.set(1024, 1024);
            sun.shadow.camera.near = 2;
            sun.shadow.camera.far = 120;
            sun.shadow.camera.left = -40;
            sun.shadow.camera.right = 40;
            sun.shadow.camera.top = 40;
            sun.shadow.camera.bottom = -40;
        }
        this.sun = sun;
        this.scene.add(sun);
        this.scene.add(new THREE.AmbientLight(0x1a3a48, 0.35));

        this.hud.setLoading(0.48, 'Plantando o recife…');
        const diff = DIFFICULTY[this.settings.difficulty] || DIFFICULTY.tide;
        this.reef = new Reef(this.scene, this.quality, diff, this.textures);
        this.manta = new Manta(this.scene, this.camera, this.textures);
        this.effects = new Effects(this.scene, this.quality);

        this.hud.setLoading(0.78, 'Afinando o canto…');
        await this.setupPostProcessing();

        this.hud.setTouchVisible(detectMobile());
        window.addEventListener('resize', () => this.resize());
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state === 'playing') this.pause();
        });

        this.hud.setLoading(1, 'A corrente chama');
        setTimeout(() => {
            this.hud.hideLoading();
            this.toMenu();
            this.lastFrame = performance.now();
            this.renderer.setAnimationLoop((now) => this.frame(now));
        }, 240);
    }

    async setupPostProcessing() {
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
            composer.setSize(window.innerWidth, window.innerHeight);
            composer.addPass(new RenderPass(this.scene, this.camera));
            const bloom = new UnrealBloomPass(
                new THREE.Vector2(window.innerWidth, window.innerHeight),
                0.48,
                0.62,
                0.38
            );
            composer.addPass(bloom);
            composer.addPass(new OutputPass());
            this.composer = composer;
        } catch {
            this.composer = null;
        }
    }

    resize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h, false);
        this.composer?.setSize(w, h);
    }

    diff() {
        return DIFFICULTY[this.settings.difficulty] || DIFFICULTY.tide;
    }

    toMenu() {
        this.state = 'menu';
        this.input.enabled = false;
        this.input.exitLock();
        this.hud.setState('menu');
        this.hud.showPause(false);
        this.hud.showGameOver(false);
        this.hud.showMenu(true);
        this.hud.showHud(false);
        this.manta?.reset();
    }

    async start() {
        await this.audio.resume();
        const d = this.diff();
        this.lives = d.lives;
        this.pearls = 0;
        this.rings = 0;
        this.combo = 1;
        this.maxCombo = 1;
        this.score = 0;
        this.playTime = 0;
        this.comboGap = 0;
        this.won = false;
        this._wreckSaid = false;
        this._whaleSaid = false;
        this._boostLatch = false;
        this.reef.reset();
        this.manta.reset();
        this.state = 'playing';
        this.input.enabled = true;
        this.hud.setState('playing');
        this.hud.showMenu(false);
        this.hud.showPause(false);
        this.hud.showGameOver(false);
        this.hud.showHud(true);
        this.hud.message('A corrente te leva', 1400);
        this.input.requestLock(this.canvas);
        this.canvas.addEventListener('click', () => {
            if (this.state === 'playing') this.input.requestLock(this.canvas);
        }, { once: true });
    }

    pause() {
        if (this.state !== 'playing') return;
        this.state = 'paused';
        this.input.enabled = false;
        this.input.exitLock();
        this.hud.setState('paused');
        this.hud.showPause(true);
    }

    resume() {
        if (this.state !== 'paused') return;
        this.state = 'playing';
        this.input.enabled = true;
        this.hud.setState('playing');
        this.hud.showPause(false);
        this.input.requestLock(this.canvas);
        this.lastFrame = performance.now();
    }

    toggleMute() {
        this.settings.muted = !this.settings.muted;
        this.audio.setEnabled(!this.settings.muted);
        this.hud.setMuted(this.settings.muted);
        saveSettings(this.settings);
    }

    tryRoll(dir) {
        if (this.state !== 'playing' || !this.manta) return;
        if (this.manta.startRoll(dir)) {
            this.audio.roll();
            this.combo = Math.min(12, this.combo + 0.5);
            this.score += 120 * this.combo;
            this.comboGap = 0;
            this.hud.message('pirueta', 700);
            this.effects.burst(this.manta.pos, 0x5ef0d8);
        }
    }

    finish(won) {
        this.won = won;
        this.state = 'over';
        this.input.enabled = false;
        this.input.exitLock();
        if (won) {
            this.score += Math.max(0, 4000 - this.playTime * 12);
            this.audio.win();
        }
        if (this.score > (this.settings.best || 0)) {
            this.settings.best = Math.floor(this.score);
            saveSettings(this.settings);
            this.hud.setBest(this.settings.best);
        }
        this.hud.setState('over');
        this.hud.showHud(true);
        this.hud.setOverStats({
            pearls: this.pearls,
            combo: Math.floor(this.maxCombo),
            rings: this.rings,
            time: this.playTime,
            score: this.score
        });
        this.hud.showGameOver(true, won);
        this.hud.message(won ? 'O náutilo canta' : 'Escamas ao vento', 1800);
    }

    hurt() {
        if (this.manta.invuln > 0) return;
        this.manta.hit();
        this.audio.hit();
        this.lives -= 1;
        this.combo = 1;
        this.effects.burst(this.manta.pos, 0xff7a8a);
        this.hud.message('choque', 800);
        if (this.lives <= 0) this.finish(false);
    }

    frame(now) {
        const dt = clamp((now - (this.lastFrame || now)) / 1000, 0, 0.05);
        this.lastFrame = now;
        this.time += dt;
        this.fpsAccum += dt;
        this.fpsFrames++;
        if (this.fpsAccum >= 0.4) {
            this.hud.setFps(this.fpsFrames / this.fpsAccum);
            this.fpsAccum = 0;
            this.fpsFrames = 0;
        }

        this.input.sample();
        const attract = this.state === 'menu' || this.state === 'boot';
        if (attract && this.manta) {
            this.manta.s = (this.time * 6) % (COURSE.length * 0.4);
            this.manta.lat = Math.sin(this.time * 0.35) * 4;
            this.manta.vert = Math.cos(this.time * 0.28) * 2;
            this.manta.speed = 10;
            this.manta.syncPose(dt);
            this.manta.updateCamera(dt);
        }

        if (this.state === 'playing') {
            this.playTime += dt;
            this.comboGap += dt;
            if (this.comboGap > PHYS.comboWindow) this.combo = Math.max(1, this.combo - dt * 1.8);

            const boosting = this.input.boost && this.manta.boost > 0.02;
            if (boosting && !this._boostLatch) {
                this.audio.boostOn();
                this._boostLatch = true;
            }
            if (!boosting) this._boostLatch = false;
            const reached = this.manta.update(dt, this.input, this.diff(), boosting);
            this.audio.setWhoosh(this.manta.speed / PHYS.maxSpeed);

            const events = this.reef.collect(this.manta.pos, PHYS.radius);
            for (const ev of events) {
                if (ev.type === 'ring') {
                    this.rings += 1;
                    this.combo = Math.min(12, this.combo + 1);
                    this.maxCombo = Math.max(this.maxCombo, this.combo);
                    this.comboGap = 0;
                    this.score += 80 * this.combo;
                    this.manta.boost = Math.min(1, this.manta.boost + 0.22);
                    this.manta.speed += 3;
                    this.audio.ring(this.combo);
                    this.effects.burst(this.manta.pos, 0x5ef0d8);
                    if (this.combo >= 4) this.hud.message(`${Math.floor(this.combo)}× corrente`, 900);
                } else if (ev.type === 'pearl') {
                    this.pearls += 1;
                    this.comboGap = 0;
                    this.combo = Math.min(12, this.combo + 0.35);
                    this.score += 40 * this.combo;
                    this.audio.pearl(this.combo);
                    this.effects.burst(this.manta.pos, 0xf4d9a6);
                } else if (ev.type === 'jelly') {
                    this.hurt();
                }
            }

            const t = clamp(this.manta.s / COURSE.length, 0, 1);
            if (t > 0.36 && t < 0.42 && !this._wreckSaid) {
                this._wreckSaid = true;
                this.hud.message('A nau partida', 1400);
            }
            if (t > 0.54 && t < 0.6 && !this._whaleSaid) {
                this._whaleSaid = true;
                this.hud.message('A baleia passa', 1400);
            }
            if (reached) this.finish(true);
        } else {
            this._wreckSaid = false;
            this._whaleSaid = false;
        }

        this.reef.update(dt, this.time);
        const boosting = this.state === 'playing' && this.input.boost;
        this.effects.update(dt, this.state === 'playing' ? this.manta.pos : null, boosting);
        tickShaders(this.scene, this.time);
        this.audio.update(dt);

        const t = this.manta ? clamp(this.manta.s / COURSE.length, 0, 1) : 0;
        const zone = zoneAt(t, ZONES);
        if (this.scene.fog) {
            this.scene.fog.density = zone.fog;
            this.scene.fog.color.setHex(zone.tint);
        }
        this.scene.background.setHex(zone.tint);

        if (this.state === 'playing' || this.state === 'paused') {
            const depth = Math.max(4, 42 - this.manta.pos.y);
            this.hud.update({
                depth,
                zone: zone.name,
                progress: t,
                boost: this.manta.boost,
                speed: this.manta.speed,
                pearls: this.pearls,
                combo: this.combo,
                lives: this.lives
            });
        }

        if (this.composer) this.composer.render();
        else this.renderer.render(this.scene, this.camera);
    }
}

new Game();
