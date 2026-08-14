/**
 * Torradeira 64 — laço principal, câmera, ondas e a farsa do Assistente Office.
 */

import * as THREE from 'three';

import { STORAGE_KEY, QUEST, WAVES, QUALITY, HIT_QUOTES, COLLECT_QUOTES, CLIPPY_QUOTES } from './config.js';
import { damp, pick, detectMobile, detectSoftwareGL } from './utils.js';
import { Input } from './input.js';
import { GameAudio } from './audio.js';
import { Hud } from './hud.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Entities } from './entities.js';
import { Effects } from './effects.js';

const CAMERAS = [
    { name: 'kart', dist: 9.2, height: 4.6, look: 1.1 },
    { name: 'cinema', dist: 13.5, height: 6.8, look: 0.6 },
    { name: 'top', dist: 4.5, height: 18, look: -6 }
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
        this.combo = 1;
        this.comboT = 0;
        this.disks = 0;
        this.kills = 0;
        this.lives = QUEST.lives;
        this.cameraMode = 0;
        this.fps = 60;
        this.fpsAccum = 0;
        this.fpsFrames = 0;
        this.hudAccum = 0;
        this.waveIndex = 0;
        this.bossAnnounced = false;
        this.mobile = detectMobile();
        this._look = new THREE.Vector3();
        this._camPos = new THREE.Vector3();
        this._wanted = new THREE.Vector3();
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
        this.hud.setLoading(0.15, 'Ligando o cartucho…');
        try {
            this.renderer = new THREE.WebGLRenderer({
                canvas: this.canvas,
                antialias: false,
                powerPreference: 'high-performance'
            });
        } catch (err) {
            this.hud.showError('WebGL recusou o disquete. Tente outro navegador.');
            return;
        }

        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.setClearColor(0x7ec8ff, 1);
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.05;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(58, 1, 0.1, 180);
        this.clock = new THREE.Clock();

        this.hud.setLoading(0.35, 'Esquentando a resistência…');
        this.world = new World(this.scene);
        this.effects = new Effects(this.scene, this.camera);
        this.player = new Player(this.scene);
        this.entities = new Entities(this.scene, this.effects);
        this.audio = new GameAudio();
        this.input = new Input();

        this.hud.setLoading(0.7, 'Clippy está “ajudando”…');
        this.bindUi();
        this.applyQuality();
        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.hud.setLoading(1, 'INSERT COIN');
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
        const cap = Math.min(window.devicePixelRatio || 1, q.pixel);
        this.renderer.setPixelRatio(cap);
        this.renderer.shadowMap.enabled = q.shadows;
        this.world.setShadows(q.shadows);
        this.particleScale = q.particles;
    }

    resize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.renderer.setSize(w, h, false);
        this.camera.aspect = w / Math.max(1, h);
        this.camera.updateProjectionMatrix();
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
        this.hud.message(pick(CLIPPY_QUOTES));
        this.snapCamera();
    }

    resetRun(spawn) {
        this.elapsed = 0;
        this.score = 0;
        this.combo = 1;
        this.comboT = 0;
        this.disks = 0;
        this.kills = 0;
        this.lives = QUEST.lives;
        this.waveIndex = 0;
        this.bossAnnounced = false;
        this.effects.clear();
        this.player.reset();
        if (spawn) this.entities.reset();
        else {
            this.entities.clearList(this.entities.ghosts);
            this.entities.clearList(this.entities.invaders);
            this.entities.clearList(this.entities.clippies);
            this.entities.clearList(this.entities.toasts);
            this.entities.clearList(this.entities.dialogs);
            if (this.entities.boss) {
                this.entities.group.remove(this.entities.boss.mesh);
                this.entities.boss = null;
            }
        }
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
        if (kind === 'floppy') {
            this.disks += 1;
            this.addScore(QUEST.floppyScore);
            this.audio.blip();
            this.entities.popup(pick(COLLECT_QUOTES), pos.x, pos.y, pos.z, '#ffe14a');
            this.hud.message(pick(COLLECT_QUOTES));
            if (this.disks >= QUEST.disksToBoss && !this.bossAnnounced) {
                this.bossAnnounced = true;
                this.entities.spawnBoss();
                this.audio.setMode('boss');
                this.hud.message('MEGA-CLIPPY quer AJUDAR.');
            }
        } else if (kind === 'kill') {
            this.kills += 1;
            this.addScore(QUEST.hitScore);
        } else if (kind === 'hurtEnemy') {
            this.addScore(20);
        } else if (kind === 'hit') {
            if (this.player.hurt(pos.x, pos.z)) {
                this.lives -= 1;
                this.combo = 1;
                this.effects.hitCam();
                this.audio.hit();
                this.hud.message(pick(HIT_QUOTES));
                document.getElementById('hitFlash')?.classList.add('on');
                setTimeout(() => document.getElementById('hitFlash')?.classList.remove('on'), 180);
                if (this.lives <= 0) this.defeat();
            }
        } else if (kind === 'life') {
            this.lives = Math.min(5, this.lives + 1);
            this.audio.life();
            this.entities.popup('1-UP PÃO', pos.x, pos.y, pos.z, '#9dff6b');
        } else if (kind === 'bossDown') {
            this.addScore(QUEST.bossScore);
            this.victory();
        }
    }

    addScore(n) {
        this.comboT = 3.2;
        this.combo = Math.min(5, this.combo + 0.2);
        this.score += Math.round(n * this.combo);
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
        return { score: this.score, disks: this.disks, kills: this.kills, elapsed: this.elapsed };
    }

    snapCamera() {
        const cam = CAMERAS[this.cameraMode];
        const f = this.player.forward;
        this.camera.position.set(
            this.player.position.x - f.x * cam.dist,
            this.player.position.y + cam.height,
            this.player.position.z - f.z * cam.dist
        );
        this._look.set(
            this.player.position.x + f.x * 4,
            this.player.position.y + cam.look + 1.2,
            this.player.position.z + f.z * 4
        );
        this.camera.lookAt(this._look);
    }

    updateCamera(dt) {
        const cam = CAMERAS[this.cameraMode];
        const f = this.player.forward;
        this._wanted.set(
            this.player.position.x - f.x * cam.dist,
            this.player.position.y + cam.height,
            this.player.position.z - f.z * cam.dist
        );
        this.camera.position.x = damp(this.camera.position.x, this._wanted.x, 5.5, dt);
        this.camera.position.y = damp(this.camera.position.y, this._wanted.y, 5.5, dt);
        this.camera.position.z = damp(this.camera.position.z, this._wanted.z, 5.5, dt);
        this._look.set(
            this.player.position.x + f.x * 5,
            this.player.position.y + cam.look + 1.1,
            this.player.position.z + f.z * 5
        );
        const shake = this.effects.applyShake();
        this.camera.position.add(shake);
        this.camera.lookAt(this._look);
    }

    loop = () => {
        requestAnimationFrame(this.loop);
        const dt = Math.min(0.033, this.clock.getDelta());
        this.time += dt;

        if (this.state === 'play') this.updatePlay(dt);
        else {
            this.world.update(this.time, dt);
            this.player.mesh.rotation.y += dt * 0.25;
            this.updateCamera(dt * 0.4);
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
        this.comboT = Math.max(0, this.comboT - dt);
        if (this.comboT <= 0) this.combo = damp(this.combo, 1, 1.8, dt);

        this.input.sample();
        const wasGrounded = this.player.grounded;
        this.player.update(dt, this.input, this.world);
        if (wasGrounded && !this.player.grounded) this.audio.jump();

        if (this.input.consumeFire() || this.input.fireHeld) {
            const shot = this.player.tryFire();
            if (shot) {
                this.entities.spawnToast(shot);
                this.audio.fire();
            }
        }

        this.suction(dt);
        this.entities.update(dt, this.time, this.player, this.audio, (k, p) => this.onEvent(k, p));
        this.world.update(this.time, dt);
        this.effects.update(dt);
        this.updateWaves(dt);
        this.updateCamera(dt);

        this.hudAccum += dt;
        if (this.hudAccum > 0.08) {
            this.hudAccum = 0;
            const boss = this.entities.boss;
            this.hud.update({
                score: this.score,
                disks: this.disks,
                lives: this.lives,
                elapsed: this.elapsed,
                combo: this.combo,
                coolReady: 1 - this.player.cool / 0.22,
                boss: !!boss,
                bossHp: boss?.hp ?? 0,
                bossMax: boss?.max ?? 1,
                fps: this.fps,
                showFps: false,
                dt
            });
        }
    }

    suction(dt) {
        const b = this.world.binSuction;
        const dx = this.player.position.x - b.x;
        const dz = this.player.position.z - b.z;
        const d = Math.hypot(dx, dz);
        if (d < 6 && d > 0.2) {
            const pull = (1 - d / 6) * 9 * dt;
            this.player.position.x -= (dx / d) * pull;
            this.player.position.z -= (dz / d) * pull;
            if (d < 1.35) this.onEvent('hit', b);
        }
    }

    updateWaves(dt) {
        for (let i = this.waveIndex + 1; i < WAVES.length; i++) {
            if (this.elapsed >= WAVES[i].time) {
                this.waveIndex = i;
                this.entities.ensureWave(i);
                this.hud.message(`ONDA ${i + 1} — mais retrô, mais caos`);
            }
        }
        if (this.waveIndex >= 1 && this.entities.tetris.length < 1 + this.waveIndex && Math.random() < dt * 0.08) {
            this.entities.spawnTetris();
        }
    }
}

const game = new Game();
game.boot().catch((err) => {
    console.error(err);
    game.hud.showError(err?.message || 'Falha ao carregar o cartucho.');
});
