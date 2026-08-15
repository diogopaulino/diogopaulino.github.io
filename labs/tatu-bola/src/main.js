/**
 * Tatu Bola — laço principal, câmera N64 e a ilha dos cristais.
 */

import * as THREE from 'three';

import { STORAGE_KEY, QUEST, QUALITY, PLAYER, GET_QUOTES, HIT_QUOTES, ROLL_QUOTES } from './config.js';
import { damp, pick, detectMobile, detectSoftwareGL } from './utils.js';
import { Input } from './input.js';
import { GameAudio } from './audio.js';
import { Hud } from './hud.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Entities } from './entities.js';
import { Effects } from './effects.js';
import { setSnap, setSnapAspect } from './models.js';

const CAMERAS = [
    { name: 'atrás', dist: 7.4, height: 3.6, look: 0.55 },
    { name: 'cinema', dist: 11.2, height: 5.4, look: 0.2 },
    { name: 'perto', dist: 4.6, height: 2.4, look: 0.7 }
];

class Game {
    constructor() {
        this.hud = new Hud();
        this.canvas = document.getElementById('scene');
        this.settings = this.loadSettings();
        this.state = 'loading';
        this.time = 0;
        this.elapsed = 0;
        this.score = 0;
        this.crystals = 0;
        this.cajus = 0;
        this.cajuBank = 0;
        this.kills = 0;
        this.lives = QUEST.lives;
        this.cameraMode = 0;
        this.fps = 60;
        this.fpsAccum = 0;
        this.fpsFrames = 0;
        this.hudAccum = 0;
        this.mobile = detectMobile();
        this._look = new THREE.Vector3();
        this._wanted = new THREE.Vector3();
        this._camYaw = Math.PI;
    }

    loadSettings() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) return { ...{ quality: 'auto', volume: 70, muted: false, best: 0 }, ...JSON.parse(raw) };
        } catch { /* ignore */ }
        return { quality: 'auto', volume: 70, muted: false, best: 0 };
    }

    saveSettings() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
        } catch { /* ignore */ }
    }

    qualityPreset() {
        let key = this.settings.quality;
        if (key === 'auto') {
            key = (this.mobile || detectSoftwareGL()) ? 'low' : 'high';
        }
        return QUALITY[key] || QUALITY.medium;
    }

    async boot() {
        this.hud.setLoading(0.12, 'Inserindo o CD…');
        try {
            this.renderer = new THREE.WebGLRenderer({
                canvas: this.canvas,
                antialias: false,
                powerPreference: 'high-performance'
            });
        } catch {
            this.hud.showError('WebGL recusou o cartucho. Tente outro navegador.');
            return;
        }

        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.setClearColor(0xff9a72, 1);
        this.renderer.toneMapping = THREE.NoToneMapping;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(55, 1, 0.12, 140);
        this.clock = new THREE.Clock();

        this.hud.setLoading(0.4, 'Tesselando a ilha…');
        this.world = new World(this.scene);
        this.effects = new Effects(this.scene);
        this.player = new Player(this.scene);
        this.entities = new Entities(this.scene, this.world, this.effects);
        this.audio = new GameAudio();
        this.input = new Input();

        this.hud.setLoading(0.78, 'Ligando o 32-bit…');
        this.bindUi();
        this.applyQuality();
        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.hud.setLoading(1, 'PRESS START');
        await new Promise((r) => setTimeout(r, 280));
        this.hud.hideLoading();
        this.gotoMenu();
        this.loop();
    }

    bindUi() {
        document.getElementById('startButton')?.addEventListener('click', () => this.start());
        document.getElementById('resumeButton')?.addEventListener('click', () => this.resume());
        document.getElementById('pauseMenuButton')?.addEventListener('click', () => this.gotoMenu());
        document.getElementById('retryButton')?.addEventListener('click', () => this.start());
        document.getElementById('defeatMenuButton')?.addEventListener('click', () => this.gotoMenu());
        document.getElementById('replayButton')?.addEventListener('click', () => this.start());
        document.getElementById('victoryMenuButton')?.addEventListener('click', () => this.gotoMenu());
        document.getElementById('pauseButton')?.addEventListener('click', () => this.togglePause());
        document.getElementById('soundButton')?.addEventListener('click', () => this.toggleMute());

        const vol = document.getElementById('volumeSlider');
        if (vol) {
            vol.value = String(this.settings.volume);
            this.hud.setVolume(this.settings.volume / 100);
            vol.addEventListener('input', () => {
                this.settings.volume = Number(vol.value);
                this.audio.setVolume(this.settings.volume / 100);
                this.hud.setVolume(this.settings.volume / 100);
                this.saveSettings();
            });
        }

        const q = document.getElementById('qualitySelect');
        if (q) {
            q.value = this.settings.quality;
            q.addEventListener('change', () => {
                this.settings.quality = q.value;
                this.applyQuality();
                this.saveSettings();
            });
        }

        this.input.on('pause', () => this.togglePause());
        this.input.on('mute', () => this.toggleMute());
        this.input.on('camera', () => {
            this.cameraMode = (this.cameraMode + 1) % CAMERAS.length;
            this.hud.message(`Câmera: ${CAMERAS[this.cameraMode].name}`);
        });
        this.input.on('confirm', () => {
            if (this.state === 'menu') this.start();
            else if (this.state === 'pause') this.resume();
        });

        this.audio.setEnabled(!this.settings.muted);
        this.hud.setMuted(this.settings.muted);
        this.hud.setTouch(this.mobile);
    }

    applyQuality() {
        const q = this.qualityPreset();
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixel));
        this.renderer.shadowMap.enabled = q.shadows;
        this.world.setShadows(q.shadows);
        setSnap(q.snap);
        this.canvas.style.imageRendering = q.pixel < 0.9 ? 'pixelated' : 'auto';
    }

    resize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.renderer.setSize(w, h, false);
        this.camera.aspect = w / Math.max(1, h);
        this.camera.updateProjectionMatrix();
        setSnapAspect(this.camera.aspect);
    }

    gotoMenu() {
        this.state = 'menu';
        this.input.enabled = false;
        this.audio.setMode('menu');
        this.hud.showMenu(this.settings.best);
        this.resetRun(false);
        this.snapCamera();
    }

    start() {
        this.audio.init();
        this.audio.setVolume(this.settings.volume / 100);
        this.audio.setEnabled(!this.settings.muted);
        this.resetRun(true);
        this.state = 'play';
        this.input.enabled = true;
        this.audio.setMode('play');
        this.hud.showPlay();
        this.hud.message('COLETE 7 CRISTAIS');
        this.snapCamera();
    }

    resetRun(spawn) {
        this.elapsed = 0;
        this.score = 0;
        this.crystals = 0;
        this.cajus = 0;
        this.cajuBank = 0;
        this.kills = 0;
        this.lives = QUEST.lives;
        this.won = false;
        this.effects.clear();
        this.player.reset();
        if (spawn) this.entities.reset();
        else this.entities.reset();
    }

    togglePause() {
        if (this.state === 'play') {
            this.state = 'pause';
            this.input.enabled = false;
            this.hud.showPause();
        } else if (this.state === 'pause') {
            this.resume();
        }
    }

    resume() {
        this.state = 'play';
        this.input.enabled = true;
        this.clock.getDelta();
        this.hud.hidePause();
        this.hud.showPlay();
    }

    toggleMute() {
        this.settings.muted = !this.settings.muted;
        this.audio.setEnabled(!this.settings.muted);
        this.hud.setMuted(this.settings.muted);
        this.saveSettings();
    }

    onEvent(kind, pos) {
        if (this.state !== 'play') return;
        if (kind === 'crystal') {
            this.crystals += 1;
            this.addScore(QUEST.crystalScore);
            this.audio.crystal();
            this.hud.message(pick(GET_QUOTES));
            this.entities.popup('CRYSTAL GET', pos.x, pos.y, pos.z, '#7af0ff');
            if (this.crystals >= QUEST.crystals) {
                this.hud.message('O ÍDOLO DESPERTOU');
            }
        } else if (kind === 'caju') {
            this.cajus += 1;
            this.cajuBank += 1;
            this.addScore(QUEST.cajuScore);
            this.audio.caju();
            if (this.cajuBank >= QUEST.cajuLife) {
                this.cajuBank = 0;
                this.lives = Math.min(QUEST.maxLives, this.lives + 1);
                this.audio.life();
                this.hud.message('1-UP');
                this.entities.popup('1-UP', pos.x, pos.y, pos.z, '#7dff9a');
            }
        } else if (kind === 'crate') {
            this.addScore(QUEST.crateScore);
            this.audio.crate();
        } else if (kind === 'enemy') {
            this.kills += 1;
            this.addScore(QUEST.enemyScore);
            this.audio.enemy();
            this.entities.popup('KO', pos.x, pos.y, pos.z, '#ff3d8a');
        } else if (kind === 'hit' || kind === 'drown') {
            if (this.player.hurt()) {
                this.lives -= 1;
                this.effects.hitCam();
                this.audio.hit();
                this.hud.message(pick(HIT_QUOTES));
                document.getElementById('hitFlash')?.classList.add('on');
                setTimeout(() => document.getElementById('hitFlash')?.classList.remove('on'), 180);
                if (this.lives <= 0) this.defeat();
                else if (kind === 'drown') this.player.respawn();
            }
        } else if (kind === 'idol' && !this.won) {
            this.won = true;
            this.addScore(QUEST.idolScore);
            this.victory();
        }
    }

    addScore(n) {
        this.score += n;
    }

    defeat() {
        this.state = 'over';
        this.input.enabled = false;
        this.player.alive = false;
        this.audio.setMode('menu');
        this.audio.lose();
        this.recordBest();
        this.hud.showOver(this.stats());
    }

    victory() {
        this.state = 'win';
        this.input.enabled = false;
        this.audio.setMode('win');
        this.audio.win();
        this.recordBest();
        this.hud.showWin(this.stats());
    }

    recordBest() {
        if (this.score > (this.settings.best || 0)) {
            this.settings.best = this.score;
            this.saveSettings();
        }
    }

    stats() {
        return {
            score: this.score,
            crystals: this.crystals,
            cajus: this.cajus,
            elapsed: this.elapsed
        };
    }

    snapCamera() {
        const cam = CAMERAS[this.cameraMode];
        const yaw = this.player.yaw;
        this.camera.position.set(
            this.player.position.x - Math.sin(yaw) * cam.dist,
            this.player.position.y + cam.height,
            this.player.position.z - Math.cos(yaw) * cam.dist
        );
        this._look.set(
            this.player.position.x,
            this.player.position.y + cam.look + 0.8,
            this.player.position.z
        );
        this.camera.lookAt(this._look);
        this._camYaw = Math.atan2(
            this.player.position.x - this.camera.position.x,
            this.player.position.z - this.camera.position.z
        );
    }

    updateCamera(dt) {
        const cam = CAMERAS[this.cameraMode];
        const yaw = this.player.yaw;
        this._wanted.set(
            this.player.position.x - Math.sin(yaw) * cam.dist,
            this.player.position.y + cam.height,
            this.player.position.z - Math.cos(yaw) * cam.dist
        );
        const ground = this.world.heightAt(this._wanted.x, this._wanted.z);
        this._wanted.y = Math.max(this._wanted.y, ground + 1.6);
        this.camera.position.x = damp(this.camera.position.x, this._wanted.x, 4.8, dt);
        this.camera.position.y = damp(this.camera.position.y, this._wanted.y, 4.8, dt);
        this.camera.position.z = damp(this.camera.position.z, this._wanted.z, 4.8, dt);
        this._look.set(
            this.player.position.x,
            this.player.position.y + cam.look + 0.85,
            this.player.position.z
        );
        this.camera.position.add(this.effects.applyShake());
        this.camera.lookAt(this._look);
        this._camYaw = Math.atan2(
            this.player.position.x - this.camera.position.x,
            this.player.position.z - this.camera.position.z
        );
    }

    loop = () => {
        requestAnimationFrame(this.loop);
        const dt = Math.min(0.033, this.clock.getDelta());
        this.time += dt;

        if (this.state === 'play') this.updatePlay(dt);
        else {
            this.world.update(this.time, dt);
            this.player.mesh.rotation.y += dt * 0.35;
            this.updateCamera(dt * 0.35);
        }

        this.renderer.render(this.scene, this.camera);

        this.fpsFrames++;
        this.fpsAccum += dt;
        if (this.fpsAccum >= 0.5) {
            this.fps = Math.round(this.fpsFrames / this.fpsAccum);
            this.fpsFrames = 0;
            this.fpsAccum = 0;
        }
    };

    updatePlay(dt) {
        this.elapsed += dt;
        this.input.sample();
        this.player.update(dt, this.input, this.world, this._camYaw);

        if (this.player._didJump) this.audio.jump();
        if (this.player._didRoll) {
            this.audio.roll();
            this.hud.message(pick(ROLL_QUOTES));
        }

        if (this.player.position.y < -2.5 || this.player.swimT > PLAYER.drownTime) {
            this.audio.splash();
            this.player.rollT = 0;
            this.player.invuln = 0;
            this.onEvent('drown', this.player.position);
            this.player.swimT = 0;
        }

        this.entities.update(dt, this.time, this.player, (k, p) => this.onEvent(k, p));
        this.world.update(this.time, dt);
        this.effects.update(dt);
        this.updateCamera(dt);

        this.hudAccum += dt;
        if (this.hudAccum > 0.08) {
            this.hudAccum = 0;
            this.hud.update({
                score: this.score,
                crystals: this.crystals,
                cajus: this.cajus,
                lives: this.lives,
                elapsed: this.elapsed,
                fps: this.fps,
                showFps: false,
                dt
            });
        }
    }
}

const game = new Game();
game.boot().catch((err) => {
    console.error(err);
    game.hud.showError(err?.message || 'Falha ao carregar o CD.');
});
