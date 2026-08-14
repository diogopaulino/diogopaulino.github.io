/**
 * Aurelia — laço principal.
 * A medusa de luz desce a cidade submersa em −Z. Chunks reciclam,
 * paletas mudam com a profundidade, e o pulso no beat da trilha rende impulso.
 */

import * as THREE from 'three';

import {
    QUALITY, DIFFICULTY, PLAY, depthPalette, loadSettings, saveSettings
} from './config.js';
import { clamp, damp, detectMobile, detectSoftwareGL } from './utils.js';
import { Ocean } from './world.js';
import { Player } from './player.js';
import { Entities } from './entities.js';
import { Effects } from './effects.js';
import { GameAudio } from './audio.js';
import { Input } from './input.js';
import { Hud } from './hud.js';

const CAMERAS = [
    { name: 'sombra', offset: new THREE.Vector3(0, 2.1, 8.4), look: new THREE.Vector3(0, 0.2, -12) },
    { name: 'olho', offset: new THREE.Vector3(0, 0.55, 1.4), look: new THREE.Vector3(0, 0.1, -10) },
    { name: 'cinema', offset: new THREE.Vector3(4.2, 1.4, 6.2), look: new THREE.Vector3(-0.6, 0.3, -8) }
];

const LOOK = new THREE.Vector3();
const CAM = new THREE.Vector3();

class Game {
    constructor() {
        this.settings = loadSettings();
        this.state = 'boot';
        this.hud = new Hud();
        this.canvas = document.getElementById('scene');
        this.lumens = 0;
        this.lives = 3;
        this.depth = 0;
        this.time = 0;
        this.combo = 1;
        this.maxCombo = 1;
        this.comboT = 0;
        this.score = 0;
        this.cameraMode = 0;
        this.fpsAccum = 0;
        this.fpsFrames = 0;
        this.inCurrent = false;
        this.currentMsgT = 0;
        this.paletteId = '';
    }

    resolveQuality() {
        const choice = this.settings.quality;
        if (choice !== 'auto' && QUALITY[choice]) return QUALITY[choice];
        if (detectMobile() || detectSoftwareGL()) return QUALITY.low;
        const big = Math.min(window.innerWidth, window.innerHeight) >= 900;
        return big ? QUALITY.high : QUALITY.medium;
    }

    difficulty() {
        return DIFFICULTY[this.settings.difficulty] || DIFFICULTY.tide;
    }

    async init() {
        this.hud.setLoading(0.08, 'Afundo a luz…');
        if (document.fonts?.ready) await document.fonts.ready;
        this.quality = this.resolveQuality();

        try {
            this.renderer = new THREE.WebGLRenderer({
                canvas: this.canvas,
                antialias: this.quality.antialias,
                powerPreference: 'high-performance',
                stencil: false,
                alpha: false
            });
        } catch (err) {
            this.hud.showError('Não foi possível iniciar o WebGL neste navegador.');
            return;
        }

        const pr = Math.min(window.devicePixelRatio || 1, this.quality.pixelRatio);
        this.renderer.setPixelRatio(pr);
        this.renderer.setSize(window.innerWidth, window.innerHeight, false);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.05;
        this.renderer.autoClear = true;

        this.scene = new THREE.Scene();
        const pal = depthPalette(0);
        this.scene.background = new THREE.Color(pal.zenith);
        this.scene.fog = new THREE.FogExp2(pal.fog, 0.012);

        this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.2, 280);
        this.camera.position.set(0, 10, 10);

        try {
            this.hud.setLoading(0.28, 'Erguendo a cidade…');
            this.ocean = new Ocean(this.scene, this.quality, pal);
            this.hud.setLoading(0.48, 'Acordando a medusa…');
            this.player = new Player(this.scene, this.ocean.geo, pal);
            this.entities = new Entities(this.scene, this.ocean.geo, pal, this.quality);
            this.effects = new Effects(this.scene, this.quality);
            this.effects.setPalette(pal);
            this.audio = new GameAudio();
            this.audio.setVolume(this.settings.volume / 100);
            this.audio.setEnabled(!this.settings.muted);
            this.input = new Input();

            this.hud.setLoading(0.7, 'Cáusticas…');
            await this.setupPostProcessing();

            this.bindUi();
            this.seedAhead();
            this.applyPalette(pal, true);

            this.hud.setLoading(0.92, 'A superfície fecha…');
            this.enterMenu();
            this.renderer.compile(this.scene, this.camera);
            this.render();

            this.hud.setLoading(1, 'Mergulhar');
            setTimeout(() => this.hud.hideLoading(), 280);

            this.lastFrame = performance.now();
            this.renderer.setAnimationLoop((now) => this.frame(now));
            window.addEventListener('resize', () => this.resize());
            document.addEventListener('visibilitychange', () => {
                if (document.hidden && this.state === 'playing') this.pause();
            });
        } catch (err) {
            console.error(err);
            this.hud.showError(err?.message || 'Falha ao montar o abismo 3D.');
        }
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
                0.55,
                0.72,
                0.28
            );
            composer.addPass(bloom);
            composer.addPass(new OutputPass());
            this.composer = composer;
            this.bloom = bloom;
        } catch (err) {
            this.composer = null;
        }
    }

    bindUi() {
        this.hud.buildDifficulties(this.settings.difficulty, (id) => {
            this.settings.difficulty = id;
            saveSettings(this.settings);
        });
        this.hud.bindSettings({
            quality: this.settings.quality,
            volume: this.settings.volume,
            onQuality: (q) => {
                this.settings.quality = q;
                saveSettings(this.settings);
            },
            onVolume: (v) => {
                this.settings.volume = v;
                this.audio.setVolume(v / 100);
                saveSettings(this.settings);
            }
        });
        this.hud.setBest(this.settings.best);
        this.hud.setMuted(this.settings.muted);
        this.hud.setTouchVisible(detectMobile());

        document.getElementById('startButton').addEventListener('click', () => this.start());
        document.getElementById('resumeButton').addEventListener('click', () => this.resume());
        document.getElementById('pauseMenuButton').addEventListener('click', () => this.enterMenu());
        document.getElementById('retryButton').addEventListener('click', () => this.start());
        document.getElementById('overMenuButton').addEventListener('click', () => this.enterMenu());
        this.hud.el.soundButton.addEventListener('click', () => this.toggleMute());
        this.hud.el.pauseButton.addEventListener('click', () => {
            if (this.state === 'playing') this.pause();
            else if (this.state === 'paused') this.resume();
        });

        this.input.on('pause', () => {
            if (this.state === 'playing') this.pause();
            else if (this.state === 'paused') this.resume();
            else if (this.state === 'menu') this.start();
        });
        this.input.on('confirm', () => {
            if (this.state === 'menu' || this.state === 'over') this.start();
            else if (this.state === 'paused') this.resume();
        });
        this.input.on('mute', () => this.toggleMute());
        this.input.on('camera', () => {
            this.cameraMode = (this.cameraMode + 1) % CAMERAS.length;
            this.hud.message(CAMERAS[this.cameraMode].name);
        });
        this.input.on('pulse', () => this.tryPulse());

        this.canvas.addEventListener('click', () => {
            if (this.state === 'playing' && !detectMobile()) this.input.lock(this.canvas);
            if (this.state === 'playing') this.tryPulse();
        });

        const zone = document.getElementById('steerZone');
        const pulseBtn = document.getElementById('touchPulse');
        const onSteer = (e) => {
            const t = e.touches ? e.touches[0] : e;
            const r = zone.getBoundingClientRect();
            const x = ((t.clientX - r.left) / r.width) * 2 - 1;
            const y = ((t.clientY - r.top) / r.height) * 2 - 1;
            this.input.setTouch(clamp(x, -1, 1), clamp(y, -1, 1));
        };
        zone.addEventListener('pointerdown', onSteer);
        zone.addEventListener('pointermove', (e) => {
            if (e.buttons || e.pressure) onSteer(e);
        });
        zone.addEventListener('pointerup', () => this.input.clearTouch());
        zone.addEventListener('pointerleave', () => this.input.clearTouch());
        pulseBtn.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            this.tryPulse();
        });
    }

    tryPulse() {
        if (this.state !== 'playing') return;
        const onBeat = this.audio.onBeatWindow();
        if (this.player.pulse(onBeat)) {
            this.audio.pulse(onBeat);
            const p = this.player.position;
            this.effects.shock(p.x, p.y, p.z);
            if (onBeat) {
                this.combo = Math.min(12, this.combo + 1);
                this.comboT = 2.6;
                this.hud.message('no pulso', 700);
            }
        }
    }

    toggleMute() {
        this.settings.muted = !this.settings.muted;
        this.audio.setEnabled(!this.settings.muted);
        this.hud.setMuted(this.settings.muted);
        saveSettings(this.settings);
    }

    applyPalette(pal, instant = false) {
        if (this.paletteId === pal.id && !instant) return;
        this.paletteId = pal.id;
        this.ocean.setPalette(pal);
        this.player.setPalette(pal);
        this.entities.setPalette(pal);
        this.effects.setPalette(pal);
        document.documentElement.style.setProperty('--glow-a', '#' + pal.glowA.toString(16).padStart(6, '0'));
        document.documentElement.style.setProperty('--glow-b', '#' + pal.glowB.toString(16).padStart(6, '0'));
        if (!instant) this.hud.message(pal.name);
    }

    seedAhead() {
        const z = this.player.position.z;
        const start = Math.floor(-z / PLAY.chunkLength);
        for (let i = start; i < start + PLAY.chunkCount; i++) {
            this.entities.seedChunk(i, -i * PLAY.chunkLength, this.difficulty());
        }
    }

    enterMenu() {
        this.state = 'menu';
        this.input.unlock();
        this.hud.setState('menu');
        this.hud.showMenu(true);
        this.hud.showPause(false);
        this.hud.showGameOver(false);
        this.hud.showHud(false);
        this.player.reset();
        this.entities.clear();
        this.seedAhead();
        this.applyPalette(depthPalette(0), true);
        this.hud.setBest(this.settings.best);
    }

    async start() {
        await this.audio.resume();
        this.lumens = 0;
        this.lives = 3;
        this.depth = 0;
        this.time = 0;
        this.combo = 1;
        this.maxCombo = 1;
        this.comboT = 0;
        this.score = 0;
        this.inCurrent = false;
        this.player.reset();
        this.entities.clear();
        this.seedAhead();
        this.applyPalette(depthPalette(0), true);
        this.state = 'playing';
        this.hud.setState('playing');
        this.hud.showMenu(false);
        this.hud.showPause(false);
        this.hud.showGameOver(false);
        this.hud.showHud(true);
        this.hud.message('pulse no ritmo', 1800);
        if (!detectMobile()) this.input.lock(this.canvas);
    }

    pause() {
        if (this.state !== 'playing') return;
        this.state = 'paused';
        this.input.unlock();
        this.hud.setState('paused');
        this.hud.showPause(true);
    }

    resume() {
        if (this.state !== 'paused') return;
        this.state = 'playing';
        this.hud.setState('playing');
        this.hud.showPause(false);
        if (!detectMobile()) this.input.lock(this.canvas);
    }

    gameOver() {
        this.state = 'over';
        this.input.unlock();
        this.hud.setState('over');
        this.hud.showGameOver(true);
        if (this.score > (this.settings.best || 0)) {
            this.settings.best = this.score;
            saveSettings(this.settings);
        }
        this.hud.setOverStats({
            depth: this.depth,
            lumens: this.lumens,
            combo: this.maxCombo,
            time: this.time,
            score: this.score
        });
        this.hud.setBest(this.settings.best);
    }

    frame(now) {
        const dt = clamp((now - this.lastFrame) / 1000, 0, 0.05);
        this.lastFrame = now;

        if (this.state === 'menu' || this.state === 'over' || this.state === 'paused') {
            this.player.root.rotation.y += dt * 0.25;
            const u = this.player.root.userData;
            u.pulse.uPulse.value = 0.35 + Math.sin(now * 0.002) * 0.35;
            const t = now * 0.001;
            for (const tent of u.tentacles) {
                tent.rotation.x = Math.sin(t * 2.2 + tent.userData.seed) * 0.28;
                tent.rotation.z = Math.cos(t * 1.8 + tent.userData.seed) * 0.2;
            }
            this.ocean.u.uTime.value += dt;
            this.updateCamera(dt, true);
            this.render();
            return;
        }

        this.time += dt;
        this.comboT = Math.max(0, this.comboT - dt);
        if (this.comboT === 0) this.combo = 1;

        const input = this.input.sample();
        const diff = this.difficulty();
        this.player.update(dt, input, diff.speed * (this.inCurrent ? 1.28 : 1));

        const bump = this.ocean.collide(
            this.player.position.x,
            this.player.position.y,
            this.player.position.z,
            0.9
        );
        if (bump) {
            this.player.position.x += bump.nx * 0.35;
            this.player.position.z += bump.nz * 0.35;
            if (this.player.speed > 22 && this.player.hit(0.18 * diff.damage)) {
                this.audio.hit();
                this.livesCheck();
            }
        }

        this.ocean.update(dt, this.player.position.z);
        this.seedAhead();

        this.entities.update(dt, this.player, this.effects, {
            collect: (relic) => {
                this.lumens += relic ? 5 : 1;
                this.player.heal(relic ? 0.18 : 0.06);
                this.combo = Math.min(12, this.combo + 1);
                this.maxCombo = Math.max(this.maxCombo, this.combo);
                this.comboT = 2.8;
                this.score += (relic ? 250 : 50) * this.combo;
                this.audio.collect(relic);
                if (relic) this.hud.message('relíquia', 900);
            },
            ring: () => {
                this.combo = Math.min(12, this.combo + 2);
                this.maxCombo = Math.max(this.maxCombo, this.combo);
                this.comboT = 3.2;
                this.score += 400 * this.combo;
                this.player.speed = Math.min(this.player.speed + 8, 48);
                this.audio.ring();
                this.hud.message('anel de ruína', 900);
            },
            eel: () => {
                if (this.player.hit(0.28 * diff.damage)) {
                    this.audio.hit();
                    this.combo = 1;
                    this.livesCheck();
                }
            },
            current: (on) => {
                if (on && !this.inCurrent) {
                    this.audio.current();
                    this.currentMsgT += dt;
                    if (this.currentMsgT > 0.4) this.hud.message('corrente', 800);
                }
                if (!on) this.currentMsgT = 0;
                this.inCurrent = on;
            }
        });

        this.effects.trail(
            this.player.position.x,
            this.player.position.y - 0.4,
            this.player.position.z + 0.8
        );
        this.effects.update(dt);

        this.depth = Math.max(this.depth, -this.player.position.z * 1.65);
        this.score += this.player.speed * dt * 2 * this.combo;
        this.applyPalette(depthPalette(this.depth));

        this.audio.update(dt, this.player.speed, this.player.pulseT > 0);

        this.updateCamera(dt, false);
        this.render();

        this.hud.update({
            depth: this.depth,
            lumens: this.lumens,
            combo: this.combo,
            glow: this.player.glow,
            pulseReady: this.player.cool <= 0,
            layer: depthPalette(this.depth).name,
            onBeat: this.audio.beatPulse > 0
        });

        this.fpsAccum += dt;
        this.fpsFrames += 1;
        if (this.fpsAccum >= 0.4) {
            this.hud.setFps(this.fpsFrames / this.fpsAccum);
            this.fpsAccum = 0;
            this.fpsFrames = 0;
        }

        if (this.bloom) {
            const pulse = this.player.root.userData.pulse.uPulse.value;
            this.bloom.strength = 0.48 + pulse * 0.35;
        }
    }

    livesCheck() {
        if (this.player.glow > 0) return;
        this.lives -= 1;
        if (this.lives <= 0) {
            this.gameOver();
            return;
        }
        this.player.glow = 0.55;
        this.player.invuln = 1.6;
        this.hud.message(`${this.lives} brilho${this.lives > 1 ? 's' : ''} restante${this.lives > 1 ? 's' : ''}`, 1400);
    }

    updateCamera(dt, idle) {
        const rig = CAMERAS[this.cameraMode];
        const p = this.player.root;
        const offset = CAM.copy(rig.offset).applyQuaternion(p.quaternion);
        const target = LOOK.copy(p.position).add(offset);
        if (idle) {
            const t = performance.now() * 0.00025;
            this.camera.position.set(Math.sin(t) * 9, 9, Math.cos(t) * 9);
            this.camera.lookAt(p.position);
            return;
        }
        this.camera.position.x = damp(this.camera.position.x, target.x, 6, dt);
        this.camera.position.y = damp(this.camera.position.y, target.y, 6, dt);
        this.camera.position.z = damp(this.camera.position.z, target.z, 6, dt);
        const look = LOOK.copy(p.position).add(CAM.copy(rig.look).applyQuaternion(p.quaternion));
        this.camera.lookAt(look);
    }

    render() {
        if (this.composer) this.composer.render();
        else this.renderer.render(this.scene, this.camera);
    }

    resize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h, false);
        this.composer?.setSize(w, h);
    }
}

const game = new Game();
game.init();
