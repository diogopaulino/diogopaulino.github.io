/**
 * Silkline — laço principal.
 * Manhattan à noite: o tecelão dispara teias, o pêndulo gera velocidade
 * e os pulsos dourados marcam o combo.
 */

import * as THREE from 'three';

import {
    QUALITY, DIFFICULTY, CAMERA, PALETTE, loadSettings, saveSettings
} from './config.js';
import { clamp, damp, detectMobile, detectSoftwareGL, hexToArr } from './utils.js';
import { City } from './city.js';
import { Player } from './player.js';
import { Effects } from './effects.js';
import { GameAudio } from './audio.js';
import { Input } from './input.js';
import { Hud } from './hud.js';

const CAM_RIGS = [CAMERA.chase, CAMERA.shoulder, CAMERA.cinematic];
const CAM_NAMES = ['perseguição', 'ombro', 'cinema'];
const CAM = new THREE.Vector3();
const LOOK = new THREE.Vector3();
const BACK = new THREE.Vector3();
const AIM = new THREE.Vector3();

class Game {
    constructor() {
        this.settings = loadSettings();
        this.state = 'boot';
        this.hud = new Hud();
        this.canvas = document.getElementById('scene');
        this.lives = 3;
        this.pulses = 0;
        this.maxCombo = 0;
        this.time = 0;
        this.cameraMode = 0;
        this.fpsAccum = 0;
        this.fpsFrames = 0;
        this.bestDistrict = 'Midtown';
    }

    resolveQuality() {
        const choice = this.settings.quality;
        if (choice !== 'auto' && QUALITY[choice]) return QUALITY[choice];
        if (detectMobile() || detectSoftwareGL()) return QUALITY.low;
        const big = Math.min(window.innerWidth, window.innerHeight) >= 900;
        return big ? QUALITY.high : QUALITY.medium;
    }

    async init() {
        this.hud.setLoading(0.08, 'Acendendo as janelas…');
        if (document.fonts?.ready) await document.fonts.ready;
        this.quality = this.resolveQuality();

        try {
            this.renderer = new THREE.WebGLRenderer({
                canvas: this.canvas,
                antialias: this.quality.antialias,
                powerPreference: 'high-performance',
                stencil: false
            });
        } catch (err) {
            this.hud.showError('Não foi possível iniciar o WebGL neste navegador.');
            return;
        }

        const pr = Math.min(window.devicePixelRatio || 1, this.quality.pixelRatio);
        this.renderer.setPixelRatio(pr);
        this.renderer.setSize(window.innerWidth, window.innerHeight, false);
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 0.92;
        this.renderer.shadowMap.enabled = this.quality.shadows;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(
            62,
            window.innerWidth / window.innerHeight,
            0.25,
            this.quality.drawDistance * 1.8
        );
        this.scene.fog = new THREE.FogExp2(PALETTE.fog, this.quality.fogDensity);
        this.scene.background = new THREE.Color(PALETTE.zenith);

        try {
            this.hud.setLoading(0.22, 'Levantando o skyline…');
            this.hemi = new THREE.HemisphereLight(0x6a88bb, 0x2a1810, 0.55);
            this.scene.add(this.hemi);
            this.moon = new THREE.DirectionalLight(PALETTE.moon, 0.55);
            this.moon.position.set(-80, 140, 60);
            this.moon.castShadow = this.quality.shadows;
            if (this.quality.shadows) {
                this.moon.shadow.mapSize.set(1024, 1024);
                this.moon.shadow.camera.near = 20;
                this.moon.shadow.camera.far = 420;
                this.moon.shadow.camera.left = -80;
                this.moon.shadow.camera.right = 80;
                this.moon.shadow.camera.top = 80;
                this.moon.shadow.camera.bottom = -80;
            }
            this.scene.add(this.moon, this.moon.target);

            this.cityGlow = new THREE.PointLight(0xff8a4a, 18, 260, 1.6);
            this.scene.add(this.cityGlow);

            this.hud.setLoading(0.48, 'Pavimentando Manhattan…');
            this.city = new City(this.scene, this.quality);

            this.hud.setLoading(0.72, 'Costurando o traje…');
            this.player = new Player(this.scene);
            this.effects = new Effects(this.scene, this.quality);
            this.audio = new GameAudio();
            this.audio.enabled = !this.settings.muted;
            this.audio.volume = this.settings.volume / 100;
            this.input = new Input();

            this.hud.setLoading(0.86, 'Ligando o bloom…');
            await this.setupPostProcessing();

            this.bindUi();
            this.isTouch = detectMobile();

            this.enterAttract();
            this.renderer.compile(this.scene, this.camera);
            this.render();

            this.hud.setLoading(1, 'O telhado espera');
            setTimeout(() => this.hud.hideLoading(), 280);

            this.lastFrame = performance.now();
            this.renderer.setAnimationLoop((now) => this.frame(now));
            window.addEventListener('resize', () => this.resize());
            document.addEventListener('visibilitychange', () => {
                if (document.hidden && this.state === 'playing') this.pause();
            });
        } catch (err) {
            console.error(err);
            this.hud.showError(err?.message || 'Falha ao montar Manhattan.');
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
                0.38,
                0.62,
                0.48
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
        const hud = this.hud;
        hud.buildDifficulties(this.settings.difficulty, (id) => {
            this.settings.difficulty = id;
            saveSettings(this.settings);
        });
        hud.bindSettings({
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
        hud.setBest(this.settings.best);
        hud.setMuted(this.settings.muted);

        document.getElementById('startButton').addEventListener('click', () => this.start());
        document.getElementById('resumeButton').addEventListener('click', () => this.resume());
        document.getElementById('pauseMenuButton').addEventListener('click', () => this.enterAttract());
        document.getElementById('retryButton').addEventListener('click', () => this.start());
        document.getElementById('overMenuButton').addEventListener('click', () => this.enterAttract());
        hud.el.soundButton.addEventListener('click', () => this.toggleMute());
        hud.el.pauseButton.addEventListener('click', () => {
            if (this.state === 'playing') this.pause();
            else if (this.state === 'paused') this.resume();
        });

        this.canvas.addEventListener('click', () => {
            if (this.state === 'playing' && !this.isTouch) this.input.requestLock(this.canvas);
        });

        this.input.on('pause', () => {
            if (this.state === 'playing') this.pause();
            else if (this.state === 'paused') this.resume();
        });
        this.input.on('mute', () => this.toggleMute());
        this.input.on('camera', () => {
            this.cameraMode = (this.cameraMode + 1) % CAM_RIGS.length;
            this.hud.message(CAM_NAMES[this.cameraMode], 900);
        });
        this.input.on('confirm', () => {
            if (this.state === 'menu') this.start();
            else if (this.state === 'over') this.start();
            else if (this.state === 'paused') this.resume();
        });

        this.bindTouch();
    }

    bindTouch() {
        const zone = document.getElementById('lookZone');
        const web = document.getElementById('touchWeb');
        const jump = document.getElementById('touchJump');
        if (!zone) return;

        let lastX = 0;
        let lastY = 0;
        zone.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const t = e.touches[0];
            lastX = t.clientX;
            lastY = t.clientY;
            this.input.touchForward = true;
        }, { passive: false });
        zone.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const t = e.touches[0];
            this.input.touchLook.x += (t.clientX - lastX) * 1.6;
            this.input.touchLook.y += (t.clientY - lastY) * 1.6;
            lastX = t.clientX;
            lastY = t.clientY;
        }, { passive: false });
        zone.addEventListener('touchend', () => {
            this.input.touchForward = false;
        });

        const hold = (el, setter) => {
            el.addEventListener('touchstart', (e) => { e.preventDefault(); setter(true); }, { passive: false });
            el.addEventListener('touchend', () => setter(false));
            el.addEventListener('touchcancel', () => setter(false));
        };
        hold(web, (v) => { this.input.touchWeb = v; });
        hold(jump, (v) => {
            if (v && !this.input.touchJump) this.input.jumpPressed = true;
            this.input.touchJump = v;
        });
    }

    toggleMute() {
        this.settings.muted = !this.settings.muted;
        this.audio.setEnabled(!this.settings.muted);
        this.hud.setMuted(this.settings.muted);
        saveSettings(this.settings);
        if (!this.settings.muted) this.audio.resume();
    }

    enterAttract() {
        this.state = 'menu';
        this.hud.setState('menu');
        this.hud.showMenu(true);
        this.hud.showPause(false);
        this.hud.showGameOver(false);
        this.hud.setTouchVisible(false);
        this.hud.setReticle(false, false);
        this.input.exitLock();
        this.resetRun(true);
        this.player.auto = true;
    }

    start() {
        this.audio.resume();
        this.resetRun(false);
        this.state = 'playing';
        this.hud.setState('playing');
        this.hud.showMenu(false);
        this.hud.showGameOver(false);
        this.hud.showPause(false);
        this.hud.showHud(true);
        this.hud.setTouchVisible(this.isTouch);
        this.hud.setReticle(true, false);
        this.hud.message('SILKLINE', 1400);
        if (!this.isTouch) this.input.requestLock(this.canvas);
    }

    resetRun(attract) {
        const diff = DIFFICULTY[this.settings.difficulty];
        this.lives = attract ? 99 : diff.lives;
        this.pulses = 0;
        this.maxCombo = 0;
        this.time = 0;
        this.player.webMax = diff.webMax;
        this.player.gravity = diff.gravity;
        const s = this.city.spawn;
        this.player.spawn(s.x, s.y + 1.2, s.z);
        this.player.auto = attract;
        this.city.seedPulses();
        this.cityGlow.position.set(s.x, 40, s.z);
        this.updateCamera(1, true);
    }

    pause() {
        if (this.state !== 'playing') return;
        this.state = 'paused';
        this.hud.setState('paused');
        this.hud.showPause(true);
        this.input.exitLock();
    }

    resume() {
        if (this.state !== 'paused') return;
        this.state = 'playing';
        this.hud.setState('playing');
        this.hud.showPause(false);
        this.lastFrame = performance.now();
        this.audio.resume();
        if (!this.isTouch) this.input.requestLock(this.canvas);
    }

    gameOver() {
        this.state = 'over';
        this.player.alive = false;
        this.player.release();
        const score = Math.floor(this.pulses * 260 + this.maxCombo * 140 + this.time * 6);
        if (score > (this.settings.best || 0)) {
            this.settings.best = score;
            saveSettings(this.settings);
            this.hud.setBest(score);
        }
        this.hud.setOverStats({
            pulses: this.pulses,
            combo: this.maxCombo,
            time: this.time,
            score,
            district: this.bestDistrict
        });
        this.hud.showGameOver(true);
        this.hud.showHud(false);
        this.hud.setTouchVisible(false);
        this.hud.setReticle(false, false);
        this.hud.setState('over');
        this.input.exitLock();
    }

    frame(now) {
        const dt = clamp((now - this.lastFrame) / 1000, 0, 0.05);
        this.lastFrame = now;

        if (this.state === 'playing' || this.state === 'menu') this.simulate(dt);
        this.updateCamera(dt, false);
        this.render();

        this.fpsAccum += dt;
        this.fpsFrames += 1;
        if (this.fpsAccum >= 0.4) {
            this.hud.setFps(this.fpsFrames / this.fpsAccum);
            this.fpsAccum = 0;
            this.fpsFrames = 0;
        }
    }

    simulate(dt) {
        const playing = this.state === 'playing';
        this.input.sample();
        if (!playing) {
            this.input.moveX = 0;
            this.input.moveZ = 1;
            this.input.webHeld = true;
        }
        const ev = this.player.update(dt, this.input, this.city);
        this.city.update(dt, this.camera.position);
        this.cityGlow.position.lerp(this.player.pos, 0.04);
        this.cityGlow.position.y = 36;

        if (playing) {
            this.time += dt;
            this.maxCombo = Math.max(this.maxCombo, Math.floor(this.player.combo));
            this.bestDistrict = this.city.districtName(this.player.pos.x, this.player.pos.z);

            if (ev.attached) {
                this.audio.attach();
                this.effects.spawn(this.player.anchor.x, this.player.anchor.y, this.player.anchor.z, {
                    count: 16,
                    color: [0.9, 0.95, 1],
                    speed: 5,
                    size: 0.45,
                    life: 0.35
                });
            }
            if (ev.released) this.audio.release();
            if (ev.missed) this.audio.miss();

            const got = this.city.collectPulses(
                this.player.pos.x,
                this.player.pos.y + 0.8,
                this.player.pos.z,
                2.4
            );
            if (got.length) {
                this.pulses += got.length;
                this.player.combo += got.length;
                this.audio.collect();
                this.hud.message(this.player.combo >= 8 ? 'COMBO' : 'PULSO', 700);
                for (const p of got) {
                    this.effects.spawn(p.x, p.y, p.z, {
                        count: 20,
                        color: hexToArr(PALETTE.pulse),
                        speed: 7,
                        size: 0.7,
                        life: 0.5
                    });
                }
            }

            if (ev.splash) {
                this.audio.splash();
                this.effects.spawn(this.player.pos.x, 1, this.player.pos.z, {
                    count: 30,
                    color: [0.4, 0.65, 0.9],
                    speed: 8,
                    size: 0.8,
                    life: 0.55
                });
                if (this.player.hit()) {
                    this.lives -= 1;
                    if (this.lives <= 0) this.gameOver();
                    else {
                        const s = this.city.spawn;
                        this.player.spawn(s.x, s.y + 2, s.z);
                        this.hud.message('O RIO', 900);
                    }
                }
            }

            const dir = this.player.lookDir();
            const lock = this.city.pickAnchor(
                this.player.pos.x,
                this.player.pos.y + 1.3,
                this.player.pos.z,
                dir.x, dir.y, dir.z,
                this.player.webMax
            );
            this.hud.setReticle(true, Boolean(lock));

            this.hud.update({
                speed: this.player.speed,
                district: this.bestDistrict,
                altitude: this.player.pos.y,
                pulses: this.pulses,
                combo: this.player.combo,
                lives: this.lives,
                comboHeat: Math.min(1, this.player.combo / 12)
            });
        }

        this.effects.update(dt, this.camera.position);
        this.audio.update(dt, this.player.speed, this.player.swinging);
    }

    updateCamera(dt, instant) {
        const rig = CAM_RIGS[this.cameraMode];
        const look = this.player.lookDir(LOOK);
        BACK.set(-look.x, 0, -look.z);
        if (BACK.lengthSq() < 1e-4) BACK.set(0, 0, 1);
        BACK.normalize().multiplyScalar(rig.dist);

        CAM.copy(this.player.pos);
        CAM.add(BACK);
        CAM.y += rig.height - look.y * 2.4;

        AIM.copy(this.player.pos).addScaledVector(look, 14);
        AIM.y += rig.look + 0.4;

        const k = instant ? 1 : 1 - Math.exp(-dt * (this.player.swinging ? 7.5 : 5.5));
        this.camera.position.lerp(CAM, k);
        if (!this._aim) this._aim = AIM.clone();
        this._aim.lerp(AIM, k);
        this.camera.lookAt(this._aim);

        const fovTarget = rig.fov + Math.min(14, this.player.speed * 0.12);
        this.camera.fov = damp(this.camera.fov, fovTarget, 4, dt);
        this.camera.updateProjectionMatrix();

        this.moon.target.position.copy(this.player.pos);
        this.moon.position.set(
            this.player.pos.x - 70,
            this.player.pos.y + 120,
            this.player.pos.z + 50
        );
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
game.init().catch((err) => {
    console.error(err);
    game.hud.showError(err?.message || 'Falha ao iniciar o Silkline.');
});
