/**
 * Cúpola 64 — laço principal: renderer N64, câmera Lakitu, estrelas e o vitral.
 */

import * as THREE from 'three';
import { STORAGE_KEY, QUALITY, QUEST, QUOTES } from './config.js';
import { detectMobile, detectSoftwareGL, pick, formatTime } from './utils.js';
import { n64Materials } from './models.js';
import { Input } from './input.js';
import { GameAudio } from './audio.js';
import { Hud } from './hud.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Entities } from './entities.js';
import { Effects } from './effects.js';

class Game {
    constructor() {
        this.canvas = document.getElementById('scene');
        this.hud = new Hud();
        this.audio = new GameAudio();
        this.input = new Input(this.canvas);
        this.state = 'boot';
        this.elapsed = 0;
        this.mobile = detectMobile();
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
                ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
            };
        } catch {
            return { quality: 'auto', volume: 70, muted: false, best: null };
        }
    }

    saveSettings() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
        } catch { /* ignore */ }
    }

    qualityPreset() {
        let key = this.settings.quality;
        if (key === 'auto') {
            key = (this.mobile || detectSoftwareGL()) ? 'low' : (innerWidth >= 1400 ? 'high' : 'medium');
        }
        return QUALITY[key] || QUALITY.medium;
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
        document.getElementById('retryButton').addEventListener('click', () => this.start());
        document.getElementById('victoryMenuButton').addEventListener('click', () => this.enterMenu());
        document.getElementById('defeatMenuButton').addEventListener('click', () => this.enterMenu());
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
            jump: document.getElementById('btnJump'),
            crouch: document.getElementById('btnCrouch'),
            camL: document.getElementById('btnCamL'),
            camR: document.getElementById('btnCamR')
        });

        window.addEventListener('resize', () => this.resize());
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state === 'play') this.pause();
        });
    }

    async boot() {
        this.hud.setLoading(0.08, 'Inserindo o cartucho…');
        try {
            this.renderer = new THREE.WebGLRenderer({
                canvas: this.canvas,
                antialias: false,
                powerPreference: 'high-performance',
                alpha: false
            });
        } catch (err) {
            this.hud.fail(err?.message || 'WebGL recusou o cartucho.');
            return;
        }

        this.quality = this.qualityPreset();
        for (const m of n64Materials) {
            if (m.userData.n64) m.userData.snap = this.quality.snap;
        }

        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.shadowMap.enabled = !!this.quality.shadows;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.setClearColor(0x7ec8ff, 1);
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.08;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(56, 1, 0.12, 160);
        this.clock = new THREE.Clock();

        this.hud.setLoading(0.32, 'Erguendo a ilha…');
        this.world = new World(this.scene, this.quality);

        this.hud.setLoading(0.55, 'Chamando Nico…');
        this.player = new Player(this.scene);
        this.effects = new Effects(this.scene, this.camera);
        this.entities = new Entities(this.scene, this.world);

        this.hud.setLoading(0.84, 'Afinando o vitral…');
        this.resize();
        this.renderer.compile(this.scene, this.camera);
        this.render();
        this.hud.setLoading(1, 'Pronto');
        setTimeout(() => {
            this.hud.hideLoading();
            this.enterMenu();
            this.loop();
        }, 280);
    }

    enterMenu() {
        this.state = 'menu';
        this.audio.setMode('menu');
        this.hud.showMenu();
        this.hud.setTouchVisible(false);
        document.body.dataset.state = 'menu';
    }

    start() {
        this.audio.init();
        this.audio.setEnabled(!this.settings.muted);
        this.audio.setVolume(this.settings.volume / 100);
        this.audio.setMode('play');
        this.elapsed = 0;
        this.player.lives = QUEST.lives;
        this.player.spawn();
        this.entities.reset();
        this.state = 'play';
        this.hud.showPlay();
        this.hud.setTouchVisible(this.mobile);
        this.hud.setStats({
            stars: 0,
            coins: 0,
            reds: 0,
            lives: this.player.lives
        });
        this.hud.say('Bem-vindo à Ilha da Cúpola!');
        document.body.dataset.state = 'play';
        this.clock.getDelta();
    }

    pause() {
        if (this.state !== 'play') return;
        this.state = 'pause';
        this.hud.showPause();
        document.body.dataset.state = 'pause';
    }

    resume() {
        if (this.state !== 'pause') return;
        this.state = 'play';
        this.hud.hidePause();
        this.hud.showPlay();
        this.clock.getDelta();
        document.body.dataset.state = 'play';
    }

    toggleMute() {
        this.settings.muted = !this.settings.muted;
        this.audio.setEnabled(!this.settings.muted);
        this.hud.setSound(!this.settings.muted);
        this.saveSettings();
        if (!this.settings.muted) this.audio.init();
    }

    loop = () => {
        requestAnimationFrame(this.loop);
        const dt = Math.min(0.033, this.clock.getDelta());
        if (this.state === 'play') this.update(dt);
        else if (this.world) this.world.update(dt * 0.35, this.clock.elapsedTime);
        this.render();
    };

    update(dt) {
        this.elapsed += dt;
        this.world.update(dt, this.elapsed);
        const flags = this.player.update(dt, this.input, this.world, this.camera);
        this.effects.update(dt);

        if (flags.jumped) this.audio.jump(this.player.jumpCombo || 1);
        if (flags.pounded && this.player.grounded) {
            this.audio.pound();
            this.effects.dust(this.player.position);
        }
        if (flags.cannon) this.audio.cannon();
        if (flags.swam && flags.landed) this.audio.splash();
        if (flags.landed && !flags.pounded) this.effects.dust(this.player.position);

        const events = this.entities.update(dt, this.player);
        for (const ev of events) {
            if (ev.type === 'coin') {
                this.audio.coin();
                this.effects.sparkle(ev.pos, 8);
            } else if (ev.type === 'red') {
                this.audio.red();
                this.effects.sparkle(ev.pos, 12);
                this.hud.say(ev.left > 0 ? `${ev.left} vermelhas restantes` : pick(QUOTES.red));
            } else if (ev.type === 'star') {
                this.audio.star();
                this.effects.burst(ev.pos, 22);
                this.player.celebrate();
                this.hud.showStarGet(ev.meta.title);
                this.hud.say(pick(QUOTES.star), 3200);
                if (this.entities.starCount >= QUEST.stars) {
                    this.win();
                }
            } else if (ev.type === 'stomp') {
                this.audio.stomp();
                this.effects.dust(ev.pos);
            } else if (ev.type === 'king') {
                this.audio.stomp();
                this.effects.burst(ev.pos, 10);
                this.hud.say(ev.hits >= QUEST.kingHits ? 'A bomba-rei caiu!' : pick(QUOTES.king));
            } else if (ev.type === 'kingDown') {
                this.effects.burst(ev.pos, 24);
                this.hud.say('A estrela do rei apareceu!');
            } else if (ev.type === 'hurt') {
                if (this.player.hurt()) {
                    this.audio.hurt();
                    this.effects.dust(this.player.position);
                    this.hud.say(pick(QUOTES.hurt));
                    if (!this.player.alive) this.lose();
                }
            }
        }

        this.hud.setStats({
            stars: this.entities.starCount,
            coins: this.entities.coinCount,
            reds: this.entities.redCount,
            lives: this.player.lives
        });
        this.effects.applyShake();
    }

    win() {
        this.state = 'win';
        this.audio.setMode('star');
        this.audio.win();
        const time = formatTime(this.elapsed);
        if (!this.settings.best || this.elapsed < this._bestSeconds(this.settings.best)) {
            this.settings.best = time;
            this.saveSettings();
            this.hud.setBest(time);
        }
        this.hud.showVictory({
            stars: this.entities.starCount,
            coins: this.entities.coinCount,
            seconds: this.elapsed
        });
        document.body.dataset.state = 'win';
    }

    _bestSeconds(stamp) {
        const [m, s] = String(stamp).split(':').map(Number);
        return (m || 0) * 60 + (s || 0);
    }

    lose() {
        this.state = 'over';
        this.audio.lose();
        this.hud.showOver({
            stars: this.entities.starCount,
            coins: this.entities.coinCount,
            seconds: this.elapsed
        });
        document.body.dataset.state = 'over';
    }

    resize() {
        const w = this.canvas.clientWidth || innerWidth;
        const h = this.canvas.clientHeight || innerHeight;
        const pr = Math.min(devicePixelRatio || 1, this.quality.pr);
        this.renderer.setPixelRatio(pr);
        this.renderer.setSize(w, h, false);
        this.camera.aspect = w / Math.max(1, h);
        this.camera.updateProjectionMatrix();
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }
}

new Game();
