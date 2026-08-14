/**
 * Pandemônio — laço principal, máquina de estados e câmera no trilho.
 */

import * as THREE from 'three';

import { QUALITY, DIFFICULTY, SCORE, CAMERA_MODES, PALETTE, STORAGE_KEY, PLAYER } from './config.js';
import { clamp, damp, detectMobile, detectSoftwareGL, formatTime } from './utils.js';
import { Course } from './path.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Entities } from './entities.js';
import { Effects } from './effects.js';
import { Hud } from './hud.js';
import { Input } from './input.js';
import { GameAudio } from './audio.js';

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
        this.comboTimer = 0;
        this.gems = 0;
        this.kills = 0;
        this.cameraMode = 0;
        this.fpsAccum = 0;
        this.fpsFrames = 0;
        this.hudAccum = 0;
        this.events = [];
        this.checkpointS = 0;
        this.lives = 3;
        this.maxLives = 3;
        this._camPos = new THREE.Vector3();
        this._camLook = new THREE.Vector3();
        this._sunOffset = new THREE.Vector3(14, 24, 10);
        this._wasGrounded = true;
    }

    loadSettings() {
        const fallback = {
            difficulty: 'hero',
            quality: 'auto',
            volume: 70,
            muted: false,
            best: 0
        };
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
        } catch (err) {
            return fallback;
        }
    }

    saveSettings() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
        } catch (err) {
            /* modo privado */
        }
    }

    resolveQuality() {
        const choice = this.settings.quality;
        if (choice !== 'auto' && QUALITY[choice]) return QUALITY[choice];
        if (detectMobile() || detectSoftwareGL()) return QUALITY.low;
        const big = Math.min(window.innerWidth, window.innerHeight) >= 900;
        return big ? QUALITY.high : QUALITY.medium;
    }

    async init() {
        this.hud.setLoading(0.08, 'Abrindo o portal…');
        const quality = this.resolveQuality();
        this.quality = quality;

        try {
            this.renderer = new THREE.WebGLRenderer({
                canvas: this.canvas,
                antialias: quality.antialias,
                powerPreference: 'high-performance',
                stencil: false
            });
        } catch (err) {
            this.hud.showError('Não foi possível iniciar o WebGL neste navegador.');
            return;
        }

        if (!this.renderer.getContext()) {
            this.hud.showError('Este laboratório precisa de WebGL.');
            return;
        }

        const pixelRatio = Math.min(window.devicePixelRatio || 1, quality.pixelRatio);
        this.renderer.setPixelRatio(pixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight, false);
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.12;
        this.renderer.shadowMap.enabled = quality.shadows;
        this.renderer.shadowMap.type = THREE.PCFShadowMap;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(PALETTE.skyTop);
        this.scene.fog = new THREE.FogExp2(PALETTE.fog, quality.fogDensity);

        this.camera = new THREE.PerspectiveCamera(
            58,
            window.innerWidth / window.innerHeight,
            0.25,
            quality.drawDistance * 3.4
        );

        this.hud.setLoading(0.22, 'Acendendo o céu de Lyrion…');
        this.hemi = new THREE.HemisphereLight(PALETTE.ambientSky, PALETTE.ambientGround, 0.95);
        this.scene.add(this.hemi);

        this.sun = new THREE.DirectionalLight(PALETTE.sun, 1.35);
        this.sun.position.set(18, 28, 10);
        this.sun.castShadow = quality.shadows;
        if (quality.shadows) {
            this.sun.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
            this.sun.shadow.camera.near = 2;
            this.sun.shadow.camera.far = 80;
            this.sun.shadow.camera.left = -22;
            this.sun.shadow.camera.right = 22;
            this.sun.shadow.camera.top = 22;
            this.sun.shadow.camera.bottom = -22;
            this.sun.shadow.bias = -0.001;
            this.sun.shadow.normalBias = 0.35;
        }
        this.scene.add(this.sun, this.sun.target);

        this.fill = new THREE.DirectionalLight(0xff9ad5, 0.35);
        this.fill.position.set(-12, 8, -6);
        this.scene.add(this.fill);

        this.hud.setLoading(0.4, 'Desenhando o trilho…');
        const diff = DIFFICULTY[this.settings.difficulty];
        this.course = new Course(diff.widthBonus);
        this.world = new World(this.scene, this.course, quality);

        this.hud.setLoading(0.62, 'Convocando Lyra…');
        this.player = new Player(this.scene);
        this.entities = new Entities(this.scene, this.course, diff);
        this.effects = new Effects(this.scene, quality.particles);

        this.audio = new GameAudio();
        this.audio.enabled = !this.settings.muted;
        this.audio.volume = this.settings.volume / 100;

        this.input = new Input(this.canvas);
        this.bindUi();
        this.isTouch = detectMobile();
        this.hud.setTouchVisible(false);

        await this.setupPostProcessing(quality);

        this.hud.setLoading(0.9, 'Aquecendo o carnaval…');
        this.resetRun(true);
        this.updateCamera(1, true);
        this.renderer.compile(this.scene, this.camera);
        this.render();

        this.hud.setLoading(1, 'Pronto');
        setTimeout(() => this.hud.hideLoading(), 240);

        this.enterMenu();
        this.lastFrame = performance.now();
        this.renderer.setAnimationLoop((now) => this.frame(now));
        window.addEventListener('resize', () => this.resize());
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state === 'playing') this.pause();
        });
    }

    async setupPostProcessing(quality) {
        if (!quality.bloom) return;
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
            composer.addPass(new UnrealBloomPass(
                new THREE.Vector2(window.innerWidth, window.innerHeight),
                0.22, 0.65, 0.82
            ));
            composer.addPass(new OutputPass());
            this.composer = composer;
        } catch (err) {
            this.composer = null;
        }
    }

    bindUi() {
        const h = this.hud.el;
        this.hud.buildDifficulties(this.settings.difficulty, (id) => {
            this.settings.difficulty = id;
            this.saveSettings();
        });
        h.qualitySelect.value = this.settings.quality;
        h.volumeSlider.value = this.settings.volume;
        h.volumeValue.textContent = this.settings.volume;
        this.hud.setBestScore(this.settings.best);
        this.hud.setSoundButton(!this.settings.muted);

        h.startButton = document.getElementById('startButton');
        document.getElementById('startButton').addEventListener('click', () => this.start());
        document.getElementById('resumeButton').addEventListener('click', () => this.resume());
        document.getElementById('pauseMenuButton').addEventListener('click', () => this.enterMenu());
        document.getElementById('retryButton').addEventListener('click', () => this.start());
        document.getElementById('defeatMenuButton').addEventListener('click', () => this.enterMenu());
        document.getElementById('replayButton').addEventListener('click', () => this.start());
        document.getElementById('victoryMenuButton').addEventListener('click', () => this.enterMenu());
        h.pauseButton.addEventListener('click', () => {
            if (this.state === 'playing') this.pause();
            else if (this.state === 'paused') this.resume();
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

        this.input.bindTouch(h.touch.querySelectorAll('[data-control]'));
        this.input.on('pause', () => {
            if (this.state === 'playing') this.pause();
            else if (this.state === 'paused') this.resume();
        });
        this.input.on('mute', () => this.toggleMute());
        this.input.on('camera', () => {
            this.cameraMode = (this.cameraMode + 1) % CAMERA_MODES.length;
            if (this.state === 'playing') {
                this.hud.message(CAMERA_MODES[this.cameraMode].name, 'teal', 1200);
            }
        });
        this.input.on('confirm', () => {
            if (this.state === 'menu') this.start();
            else if (this.state === 'paused') this.resume();
        });
    }

    toggleMute() {
        this.settings.muted = !this.settings.muted;
        this.audio.setEnabled(!this.settings.muted);
        this.hud.setSoundButton(!this.settings.muted);
        this.saveSettings();
    }

    enterMenu() {
        this.state = 'menu';
        this.hud.setState('menu');
        this.hud.showHud(false);
        this.hud.setTouchVisible(false);
        this.hud.showMenu();
        this.audio.init();
        this.audio.setMode('menu');
        this.resetRun(true);
    }

    start() {
        this.audio.init();
        this.resetRun(false);
        this.state = 'playing';
        this.hud.setState('playing');
        this.hud.hideOverlays();
        this.hud.showHud(true);
        this.hud.setTouchVisible(this.isTouch);
        this.audio.setMode('play');
        this.hud.message('Corre, Lyra!', 'gold', 1600);
        this.input.reset();
    }

    pause() {
        if (this.state !== 'playing') return;
        this.state = 'paused';
        this.hud.setState('paused');
        this.hud.showPause();
        this.audio.setMode('menu');
    }

    resume() {
        if (this.state !== 'paused') return;
        this.state = 'playing';
        this.hud.setState('playing');
        this.hud.hidePause();
        this.audio.setMode('play');
        this.input.reset();
    }

    resetRun(preview) {
        const diff = DIFFICULTY[this.settings.difficulty];
        this.diff = diff;
        this.lives = diff.lives;
        this.maxLives = diff.lives;
        this.score = 0;
        this.combo = 1;
        this.comboTimer = 0;
        this.gems = 0;
        this.kills = 0;
        this.elapsed = 0;
        this.time = preview ? 4.2 : 0;
        this.checkpointS = 0;
        this.player.reset(0);
        const floor = this.course.floorAt(0, this.time);
        this.player.y = (floor ? floor.y : 6.5) + 0.05;
        this.player._place(this.course, this.time, 0.016);
        this.entities.difficulty = diff;
        this.entities.spawn();
        this.hud.setLives(this.lives, this.maxLives);
        this.hud.setGems(0);
        this.hud.setScore(0);
        this.hud.setCombo(1);
        this.hud.setProgress(0);
    }

    addScore(amount) {
        const gained = Math.round(amount * this.combo * this.diff.scoreScale);
        this.score += gained;
        this.combo = Math.min(8, this.combo + 0.5);
        this.comboTimer = SCORE.comboWindow;
    }

    frame(now) {
        const dt = clamp((now - this.lastFrame) / 1000, 0, 0.05);
        this.lastFrame = now;
        this.time += dt;

        if (this.state === 'playing') {
            this.elapsed += dt;
            this.tick(dt);
        } else {
            this.world.update(this.time);
            this.player._place(this.course, this.time, dt);
            this.player._animate(dt, 0);
            this.entities.update(dt * 0.35, this.time, this.player, []);
        }

        this.updateCamera(dt, this.state !== 'playing');
        this.effects.update(dt);
        this.render();

        this.fpsAccum += dt;
        this.fpsFrames += 1;
        this.hudAccum += dt;
        if (this.fpsAccum >= 0.5) {
            this.hud.setFps(this.fpsFrames / this.fpsAccum);
            this.fpsAccum = 0;
            this.fpsFrames = 0;
        }
        if (this.hudAccum >= 0.1 && this.state === 'playing') {
            this.hudAccum = 0;
            this.hud.setScore(this.score);
            this.hud.setGems(this.gems);
            this.hud.setCombo(this.combo);
            this.hud.setProgress(this.player.s / this.course.goalS);
            this.hud.setLives(this.lives, this.maxLives);
        }
    }

    tick(dt) {
        if (this.comboTimer > 0) {
            this.comboTimer -= dt;
            if (this.comboTimer <= 0) this.combo = 1;
        }

        if (this.input.consumeJump()) this.player.tryJump();
        if (this.input.consumeAttack() && this.player.tryAttack()) this.audio.spin();

        this._wasGrounded = this.player.grounded;
        this.player.update(dt, this.input.axis, this.course, this.time);

        if (this.player._didJump === 'jump') this.audio.jump();
        if (this.player._didJump === 'double') this.audio.doubleJump();
        if (!this._wasGrounded && this.player.grounded) this.audio.land();

        this.world.update(this.time);
        this.events.length = 0;
        this.entities.update(dt, this.time, this.player, this.events);
        this.resolveEvents();

        if (this.player.fallingIntoVoid(this.course, this.time)) {
            this.die('fall');
            return;
        }

        if (this.player.s >= this.course.goalS && this.player.grounded) {
            this.win();
        }

        this.sun.position.copy(this.player.mesh.position).add(this._sunOffset);
        this.sun.target.position.copy(this.player.mesh.position);
    }

    resolveEvents() {
        for (const ev of this.events) {
            if (ev.type === 'gem') {
                this.gems += 1;
                this.addScore(ev.score);
                this.audio.gem();
                this.effects.burst(this.player.mesh.position, 0x7ef0ff, 8, 5);
                if (this.gems > 0 && this.gems % 100 === 0) {
                    this.lives = Math.min(this.maxLives + 1, this.lives + 1);
                    this.maxLives = Math.max(this.maxLives, this.lives);
                    this.hud.message('Vida extra!', 'gold');
                }
            } else if (ev.type === 'heart') {
                this.lives = Math.min(this.maxLives + 1, this.lives + 1);
                this.maxLives = Math.max(this.maxLives, this.lives);
                this.addScore(ev.score);
                this.audio.heart();
                this.hud.message('Coração!', 'gold');
                this.effects.burst(this.player.mesh.position, 0xff2d95, 12, 5);
            } else if (ev.type === 'checkpoint') {
                this.checkpointS = ev.s;
                this.addScore(ev.score);
                this.audio.checkpoint();
                this.hud.message('Cristal salvo', 'teal');
            } else if (ev.type === 'stomp' || ev.type === 'spin') {
                this.kills += 1;
                this.addScore(ev.score);
                if (ev.type === 'stomp') this.audio.stomp();
                this.effects.burst(this.player.mesh.position, 0xffd166, 10, 6);
            } else if (ev.type === 'bounce') {
                this.player.vy = PLAYER.stompBounce;
                this.player.grounded = false;
                this.player.jumps = 1;
            } else if (ev.type === 'hurt') {
                this.die('hit');
            }
        }
    }

    die(reason) {
        if (this.player.invuln > 0 && reason === 'hit') return;
        if (reason === 'hit') {
            this.player.hit();
            this.audio.hit();
            this.hud.flash('danger');
        } else {
            this.audio.fall();
        }
        this.lives -= 1;
        this.combo = 1;
        if (this.lives <= 0) {
            this.gameOver();
            return;
        }
        if (reason === 'fall') this.respawn();
        else this.hud.message('Ai!', 'danger', 900);
    }

    respawn() {
        const s = this.course.nearestCheckpoint(this.checkpointS);
        this.player.reset(s);
        const floor = this.course.floorAt(s, this.time);
        this.player.y = (floor ? floor.y : 6.5) + 0.4;
        this.player.invuln = PLAYER.invuln;
        this.hud.message('De novo!', 'teal', 1000);
        this.updateCamera(1, true);
    }

    stats() {
        return [
            { label: 'Glória', value: Math.round(this.score).toLocaleString('pt-BR'), gold: true },
            { label: 'Cristais', value: String(this.gems) },
            { label: 'Inimigos', value: String(this.kills) },
            { label: 'Tempo', value: formatTime(this.elapsed) }
        ];
    }

    gameOver() {
        this.state = 'over';
        this.hud.setState('over');
        this.hud.showHud(false);
        this.audio.setMode('defeat');
        this.hud.showGameOver(this.stats());
    }

    win() {
        this.state = 'won';
        this.hud.setState('won');
        const timeBonus = Math.max(0, Math.round((180 - this.elapsed) * SCORE.timeBonusPerSecond));
        const lifeBonus = this.lives * SCORE.lifeBonus;
        this.score += (timeBonus + lifeBonus + SCORE.finish) * this.diff.scoreScale;
        if (this.score > this.settings.best) {
            this.settings.best = this.score;
            this.saveSettings();
            this.hud.setBestScore(this.score);
        }
        this.hud.showHud(false);
        this.hud.setTouchVisible(false);
        this.audio.setMode('victory');
        this.hud.flash('gold');
        this.hud.showVictory([
            ...this.stats(),
            { label: 'Bônus', value: Math.round(timeBonus + lifeBonus).toLocaleString('pt-BR'), gold: true }
        ]);
    }

    updateCamera(dt, snap) {
        const mode = CAMERA_MODES[this.cameraMode];
        const p = this.player;
        const backDir = p.facing >= 0 ? -1 : 1;
        const tan = p.tangent || new THREE.Vector3(0, 0, 1);
        const bin = p.binormal || new THREE.Vector3(1, 0, 0);
        this._camPos.copy(p.mesh.position)
            .addScaledVector(tan, backDir * mode.back)
            .addScaledVector(bin, mode.side * (p.facing >= 0 ? 1 : -1));
        this._camPos.y = p.mesh.position.y + mode.height;
        this._camLook.copy(p.mesh.position)
            .addScaledVector(tan, (p.facing >= 0 ? 1 : -1) * mode.lookAhead);
        this._camLook.y = p.mesh.position.y + 1.15;

        if (snap) {
            this.camera.position.copy(this._camPos);
            this.camera.lookAt(this._camLook);
            return;
        }
        this.camera.position.x = damp(this.camera.position.x, this._camPos.x, 6, dt);
        this.camera.position.y = damp(this.camera.position.y, this._camPos.y, 5, dt);
        this.camera.position.z = damp(this.camera.position.z, this._camPos.z, 6, dt);
        this.camera.lookAt(this._camLook);
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
    game.hud.showError(err?.message || 'Falha ao carregar o laboratório.');
});
