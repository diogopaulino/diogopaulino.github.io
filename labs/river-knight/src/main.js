/**
 * River Knight — laço principal, máquina de estados e integração de todos os
 * sistemas (mundo, entidades, câmera, interface, áudio).
 */

import * as THREE from 'three';

import {
    QUALITY,
    DIFFICULTY,
    SCORE,
    COURSE_LENGTH,
    CASTLE_Z,
    BOSS_Z,
    LANDMARKS,
    STORAGE_KEY,
    BOAT
} from './config.js?v=14';
import { createSky, createSkyUniforms, sampleSkyPalette, applySkyPalette } from './sky.js?v=14';
import { createWater, waterHeight } from './water.js?v=15';
import { createTerrain } from './terrain.js?v=14';
import { Effects } from './effects.js?v=15';
import { Entities } from './entities.js?v=15';
import { World } from './world.js?v=14';
import { Player } from './player.js?v=14';
import { createCastle, BossBarge } from './castle.js?v=14';
import { Hud } from './hud.js?v=14';
import { Input } from './input.js';
import { GameAudio } from './audio.js?v=14';
import { updateCloth } from './models.js?v=14';
import { centerX, halfWidth } from './river.js';
import { clamp, damp, detectMobile, detectSoftwareGL, formatTime, randRange } from './utils.js?v=15';

const WHITE = new THREE.Color(1, 1, 1);

const CAMERA_MODES = [
    { name: 'perseguição', offset: new THREE.Vector3(0, 6.35, 13.0), look: new THREE.Vector3(0, 3.05, -14) },
    { name: 'proa', offset: new THREE.Vector3(0, 5.4, 10.4), look: new THREE.Vector3(0, 2.7, -20) },
    { name: 'aérea', offset: new THREE.Vector3(0, 15, 26), look: new THREE.Vector3(0, 1.5, -14) }
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
        this.comboTimer = 0;
        this.kills = 0;
        this.coins = 0;
        this.cameraMode = 0;
        this.bossStarted = false;
        this.gateOpened = false;
        this.victoryTimer = 0;
        this.defeatTimer = 0;
        this.fpsAccum = 0;
        this.fpsFrames = 0;
        this.hudAccum = 0;
        this.pullVec = { x: 0, drag: 0 };
        this.landmarkIndex = 0;
        this.fpsLowTime = 0;
        this.adapted = false;
        this._aimNdc = new THREE.Vector3();
    }

    /* ------------------------------------------------------------------ */
    /* Configurações persistidas                                           */
    /* ------------------------------------------------------------------ */

    loadSettings() {
        const fallback = {
            difficulty: 'warrior',
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
            /* modo privado: seguimos sem persistir */
        }
    }

    resolveQuality() {
        const choice = this.settings.quality;
        if (choice !== 'auto' && QUALITY[choice]) return QUALITY[choice];
        if (detectMobile() || detectSoftwareGL()) return QUALITY.low;
        const big = Math.min(window.innerWidth, window.innerHeight) >= 900;
        return big ? QUALITY.high : QUALITY.medium;
    }

    /* ------------------------------------------------------------------ */
    /* Boot                                                                */
    /* ------------------------------------------------------------------ */

    async init() {
        this.hud.setLoading(0.1, 'Acordando o rio…');

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

        if (!this.renderer.capabilities.isWebGL2 && !this.renderer.getContext()) {
            this.hud.showError('Este laboratório precisa de WebGL.');
            return;
        }

        const pixelRatio = Math.min(window.devicePixelRatio || 1, quality.pixelRatio);
        this.renderer.setPixelRatio(pixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight, false);
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.06;
        this.renderer.shadowMap.enabled = quality.shadows;
        this.renderer.shadowMap.type = THREE.PCFShadowMap;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(
            62,
            window.innerWidth / window.innerHeight,
            0.4,
            quality.drawDistance * 3.2
        );
        this.camera.position.set(0, 12, 30);

        this.hud.setLoading(0.25, 'Pintando o céu…');
        this.skyUniforms = createSkyUniforms();
        this.sky = createSky(this.skyUniforms);
        this.scene.add(this.sky);

        this.palette = sampleSkyPalette(0);
        applySkyPalette(this.skyUniforms, this.palette);
        this.scene.fog = new THREE.FogExp2(this.palette.fog.getHex(), quality.fogDensity);

        this.sun = new THREE.DirectionalLight(this.palette.light.getHex(), this.palette.lightIntensity);
        this.sun.castShadow = quality.shadows;
        if (quality.shadows) {
            this.sun.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
            this.sun.shadow.camera.near = 1;
            this.sun.shadow.camera.far = 260;
            this.sun.shadow.camera.left = -70;
            this.sun.shadow.camera.right = 70;
            this.sun.shadow.camera.top = 70;
            this.sun.shadow.camera.bottom = -70;
            this.sun.shadow.bias = -0.0012;
            this.sun.shadow.normalBias = 0.55;
        }
        this.scene.add(this.sun, this.sun.target);

        this.hemi = new THREE.HemisphereLight(this.palette.ambient.getHex(), 0x241a12, 0.75);
        this.scene.add(this.hemi);

        // Luz de preenchimento presa à câmera: sem ela o barco fica só silhueta
        // quando o sol está de frente.
        this.fill = new THREE.DirectionalLight(0xc5d8ff, 0.7);
        this.fill.castShadow = false;
        this.scene.add(this.fill, this.fill.target);

        this.hud.setLoading(0.42, 'Escavando o vale…');
        this.terrain = createTerrain(quality);
        this.scene.add(this.terrain.mesh);

        this.hud.setLoading(0.55, 'Enchendo o rio…');
        this.water = createWater(this.skyUniforms, quality);
        this.water.uniforms.uFogColor.value.copy(this.palette.fog);
        this.scene.add(this.water.mesh);

        this.hud.setLoading(0.68, 'Plantando as margens…');
        this.effects = new Effects(this.scene, quality);
        this.world = new World(this.scene, quality);
        this.entities = new Entities(this.scene, quality);

        this.hud.setLoading(0.82, 'Erguendo o castelo…');
        this.castle = createCastle(this.scene);
        this.boss = new BossBarge(this.scene);

        this.hud.setLoading(0.92, 'Preparando o guerreiro…');
        this.player = new Player(this.scene, quality);

        this.audio = new GameAudio();
        this.audio.enabled = !this.settings.muted;
        this.audio.volume = this.settings.volume / 100;

        this.input = new Input(this.canvas);
        this.bindUi();

        this.isTouch = detectMobile();
        this.hud.setTouchVisible(false);

        await this.setupPostProcessing(quality);

        // Primeiro quadro "a frio" para compilar shaders antes de mostrar o menu.
        this.world.reset(0);
        this.player.reset(DIFFICULTY[this.settings.difficulty]);
        this.updateCamera(1, true);
        this.renderer.compile(this.scene, this.camera);
        this.render();

        this.hud.setLoading(1, 'Pronto');
        setTimeout(() => this.hud.hideLoading(), 260);

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

            const bloom = new UnrealBloomPass(
                new THREE.Vector2(window.innerWidth, window.innerHeight),
                0.18,
                0.7,
                0.88
            );
            composer.addPass(bloom);
            composer.addPass(new OutputPass());

            this.composer = composer;
            this.bloom = bloom;
        } catch (err) {
            // Sem pós-processamento o jogo continua funcionando normalmente.
            this.composer = null;
        }
    }

    /* ------------------------------------------------------------------ */
    /* Interface                                                           */
    /* ------------------------------------------------------------------ */

    bindUi() {
        const hud = this.hud;

        hud.buildDifficulties(this.settings.difficulty, (id) => {
            this.settings.difficulty = id;
            this.saveSettings();
        });
        hud.setBestScore(this.settings.best);
        hud.setSoundButton(!this.settings.muted);

        hud.el.qualitySelect.value = this.settings.quality;
        hud.el.qualitySelect.addEventListener('change', (e) => {
            this.settings.quality = e.target.value;
            this.saveSettings();
            hud.message('A qualidade muda ao recarregar a página', 'gold', 3200);
        });

        hud.el.volumeSlider.value = this.settings.volume;
        hud.el.volumeValue.textContent = String(this.settings.volume);
        hud.el.volumeSlider.addEventListener('input', (e) => {
            const value = Number(e.target.value);
            this.settings.volume = value;
            hud.el.volumeValue.textContent = String(value);
            this.audio.setVolume(value / 100);
            this.saveSettings();
        });

        document.getElementById('startButton').addEventListener('click', () => this.startRun());
        document.getElementById('resumeButton').addEventListener('click', () => this.resume());
        document.getElementById('pauseMenuButton').addEventListener('click', () => this.enterMenu());
        document.getElementById('retryButton').addEventListener('click', () => this.startRun());
        document.getElementById('defeatMenuButton').addEventListener('click', () => this.enterMenu());
        document.getElementById('replayButton').addEventListener('click', () => this.startRun());
        document.getElementById('victoryMenuButton').addEventListener('click', () => this.enterMenu());

        hud.el.pauseButton.addEventListener('click', () => {
            if (this.state === 'playing') this.pause();
            else if (this.state === 'paused') this.resume();
        });

        hud.el.soundButton.addEventListener('click', () => this.toggleSound());

        this.input.on('pause', () => {
            if (this.state === 'playing') this.pause();
            else if (this.state === 'paused') this.resume();
        });
        this.input.on('mute', () => this.toggleSound());
        this.input.on('camera', () => {
            this.cameraMode = (this.cameraMode + 1) % CAMERA_MODES.length;
            this.hud.message(`Câmera: ${CAMERA_MODES[this.cameraMode].name}`, 'gold', 1400);
        });
        this.input.on('confirm', () => {
            if (this.state === 'menu') this.startRun();
            else if (this.state === 'gameover' || this.state === 'victory') this.startRun();
            else if (this.state === 'paused') this.resume();
        });

        this.input.bindTouch({
            steerZone: hud.el.steerZone,
            buttons: Array.from(document.querySelectorAll('.touch-controls .pad'))
        });
    }

    toggleSound() {
        this.settings.muted = !this.settings.muted;
        this.audio.setEnabled(!this.settings.muted);
        this.hud.setSoundButton(!this.settings.muted);
        this.saveSettings();
    }

    /* ------------------------------------------------------------------ */
    /* Estados                                                             */
    /* ------------------------------------------------------------------ */

    enterMenu() {
        this.state = 'menu';
        this.hud.setState('menu');
        this.hud.showHud(false);
        this.hud.showMenu();
        this.hud.setTouchVisible(false);
        this.hud.clearMessage();
        this.hud.setHint(false);
        this.hud.showBoss(false);
        this.hud.setBestScore(this.settings.best);

        this.entities?.reset();
        this.boss?.reset();
        this.effects?.reset();
        this.player.reset(DIFFICULTY[this.settings.difficulty]);
        this.player.z = -120;
        this.player.x = centerX(-120);
        this.world.reset(-120);
        this.menuAngle = 0;

        if (this.audio.ctx) this.audio.playMusic('menu');
    }

    startRun() {
        this.audio.init();
        this.audio.setVolume(this.settings.volume / 100);
        this.audio.setEnabled(!this.settings.muted);
        this.audio.playMusic('river');

        this.difficulty = DIFFICULTY[this.settings.difficulty];
        this.state = 'playing';
        this.hud.setState('playing');
        this.hud.hideOverlays();
        this.hud.showHud(true);
        this.hud.showBoss(false);
        this.hud.setTouchVisible(this.isTouch);

        this.score = 0;
        this.combo = 1;
        this.comboTimer = 0;
        this.kills = 0;
        this.coins = 0;
        this.elapsed = 0;
        this.bossStarted = false;
        this.gateOpened = false;
        this.victoryTimer = 0;
        this.defeatTimer = 0;
        this.cameraMode = 0;
        this.landmarkIndex = 0;
        this.hud.setHint(true);

        this.entities.reset();
        this.boss.reset();
        this.effects.reset();
        this.input.reset();
        this.player.reset(this.difficulty);
        this.world.reset(0);

        this.hud.setHull(this.player.hull, this.player.maxHull);
        this.hud.setFury(0, false);
        this.hud.setProgress(0, COURSE_LENGTH);
        this.hud.setScore(0);
        this.hud.setCombo(1);
        this.hud.setTime(0);
        this.hud.message('Rumo ao castelo — aponte o navio e dispare!', 'gold', 2200);

        this.updateCamera(1, true);
    }

    pause() {
        if (this.state !== 'playing') return;
        this.state = 'paused';
        this.hud.setState('paused');
        this.hud.showPause();
        this.input.reset();
    }

    resume() {
        if (this.state !== 'paused') return;
        this.state = 'playing';
        this.hud.setState('playing');
        this.hud.hidePause();
        this.lastFrame = performance.now();
    }

    gameOver() {
        this.state = 'defeat';
        this.hud.setState('defeat');
        this.hud.showBoss(false);
        this.hud.message('O casco cedeu…', 'danger', 3000);
        this.audio.playMusic('defeat');
        this.audio.sfx('explosion', 1.3);
        this.effects.explosion(this.player.x, this.player.position.y + 1, this.player.z, 2.6);
        this.defeatTimer = 0;
    }

    showDefeatScreen() {
        this.state = 'gameover';
        this.hud.setState('gameover');
        this.hud.showHud(false);
        this.hud.setTouchVisible(false);
        this.registerScore();
        this.hud.showGameOver([
            { label: 'Glória', value: Math.round(this.score).toLocaleString('pt-BR'), gold: true },
            { label: 'Distância', value: `${Math.round(Math.min(COURSE_LENGTH, this.player.distance))} m` },
            { label: 'Abatidos', value: String(this.kills) },
            { label: 'Tempo', value: formatTime(this.elapsed) }
        ]);
    }

    startVictory() {
        this.state = 'victory-seq';
        this.hud.setState('cinematic');
        this.hud.showBoss(false);
        this.hud.setTouchVisible(false);
        this.hud.message('A princesa está livre!', 'gold', 4200);
        this.audio.playMusic('victory');
        this.audio.sfx('horn');
        this.victoryTimer = 0;
        this.hud.setProgress(1, 0);
        this.player.startDocking(CASTLE_Z - 30);
    }

    showVictoryScreen() {
        this.state = 'victory';
        this.hud.setState('victory');
        this.hud.showHud(false);
        this.registerScore();
        this.hud.showVictory([
            { label: 'Glória', value: Math.round(this.score).toLocaleString('pt-BR'), gold: true },
            { label: 'Tempo', value: formatTime(this.elapsed) },
            { label: 'Abatidos', value: String(this.kills) },
            { label: 'Casco', value: `${this.player.hull}/${this.player.maxHull}` }
        ]);
    }

    registerScore() {
        const bonus = this.player.hull * SCORE.hullBonus * (this.state === 'victory' ? 1 : 0);
        this.score += bonus;
        if (this.score > (this.settings.best || 0)) {
            this.settings.best = Math.round(this.score);
            this.saveSettings();
        }
    }

    /* ------------------------------------------------------------------ */
    /* Pontuação                                                           */
    /* ------------------------------------------------------------------ */

    addScore(points) {
        this.score += points * this.combo * (this.difficulty?.scoreScale ?? 1);
    }

    onKill(points, position) {
        this.kills++;
        this.addScore(points);
        this.combo = Math.min(SCORE.comboMax, this.combo + SCORE.comboStep);
        this.comboTimer = 4.5;
        if (position && this.combo > 1.5 && Math.random() < 0.4) {
            this.hud.message(`Combo x${this.combo.toFixed(1)}`, 'gold', 1100);
        }
    }

    /* ------------------------------------------------------------------ */
    /* Laço                                                                */
    /* ------------------------------------------------------------------ */

    frame(now) {
        const raw = (now - this.lastFrame) / 1000;
        this.lastFrame = now;
        const dt = Math.min(0.05, Math.max(0.0005, raw));

        this.fpsAccum += raw;
        this.fpsFrames++;
        if (this.fpsAccum > 0.5) {
            const fps = this.fpsFrames / this.fpsAccum;
            this.hud.setFps(fps);
            if (this.state === 'playing' && !this.adapted) {
                if (fps < 38) this.fpsLowTime += 0.5;
                else this.fpsLowTime = Math.max(0, this.fpsLowTime - 0.35);
                if (this.fpsLowTime > 1.2) {
                    this.adapted = true;
                    this.renderer.setPixelRatio(Math.min(this.renderer.getPixelRatio(), 1.05));
                    this.composer = null;
                    this.hud.message('Qualidade ajustada para o rio fluir', 'gold', 2400);
                }
            }
            this.fpsAccum = 0;
            this.fpsFrames = 0;
        }

        if (this.state === 'paused') {
            this.render();
            return;
        }

        this.time += dt;
        updateCloth(this.time);

        try {
            switch (this.state) {
                case 'menu':
                    this.updateMenu(dt);
                    break;
                case 'playing':
                    this.updatePlaying(dt);
                    break;
                case 'defeat':
                    this.updateDefeat(dt);
                    break;
                case 'victory-seq':
                    this.updateVictorySequence(dt);
                    break;
                default:
                    this.updateIdle(dt);
                    break;
            }
        } catch (err) {
            console.error('[River Knight]', err);
        }

        this.effects.update(dt, this.time);
        this.updateEnvironment(dt);
        this.render();
    }

    updateIdle(dt) {
        // Telas finais: o rio continua vivo ao fundo.
        this.world.update(dt, this.time, this.player.z, this.effects);
        this.entities.update(dt, this.makeContext(dt));
        this.castle.update(dt, this.time);
        this.updateCamera(dt);
    }

    updateMenu(dt) {
        // Câmera cinematográfica orbitando o drakkar parado.
        this.menuAngle += dt * 0.16;
        const p = this.player;
        p.z -= dt * 7;
        p.x = damp(p.x, centerX(p.z), 1.2, dt);
        const wy = waterHeight(p.x, p.z, this.time);
        p.root.position.set(p.x, wy + 0.42, p.z);
        p.root.rotation.z = Math.sin(this.time * 0.7) * 0.035;
        p.root.rotation.x = Math.sin(this.time * 0.5) * 0.02;

        for (const oar of p.parts.oars) {
            const phase = this.time * 1.8 + oar.userData.phase;
            oar.rotation.x = Math.sin(phase) * 0.3;
            oar.rotation.z = oar.userData.side * (0.3 + Math.sin(phase + 1.2) * 0.18);
        }
        p.wParts.armR.rotation.x = -0.25 + Math.sin(this.time * 1.2) * 0.08;
        p.wParts.torso.rotation.z = Math.sin(this.time * 1.4) * 0.05;

        this.effects.wake.push(p.x, p.z + 6.5, 2.0, 0.55);
        if (Math.random() < 0.4) this.effects.splash(p.x, wy, p.z - 6.5, 2, 0.4);

        const radius = 26;
        const cx = p.x + Math.cos(this.menuAngle) * radius;
        const cz = p.z + Math.sin(this.menuAngle) * radius;
        this.camera.position.set(cx, wy + 9 + Math.sin(this.menuAngle * 2) * 2.2, cz);
        this.camera.lookAt(p.x, wy + 2.6, p.z);

        this.world.update(dt, this.time, p.z, this.effects);
        this.castle.update(dt, this.time);
    }

    makeContext(dt) {
        return {
            dt,
            time: this.time,
            input: this.input,
            effects: this.effects,
            audio: this.audio,
            player: { x: this.player.x, y: this.player.position.y, z: this.player.z },
            difficulty: this.difficulty,
            fireArrow: (x, y, z, speedScale = 1) => this.fireArrow(x, y, z, speedScale),
            onKill: (points, pos) => this.onKill(points, pos),
            onEnrage: () => {
                this.hud.message('Morvain enfurece!', 'danger', 2400);
                this.audio.sfx('horn');
            },
            onScrape: () => {
                if (Math.random() < 0.05) this.audio.sfx('hitWood');
            }
        };
    }

    fireArrow(x, y, z, speedScale = 1) {
        const lead = this.player.speed * 0.42;
        const target = new THREE.Vector3(
            this.player.x + randRange(-2.4, 2.4),
            this.player.position.y + 1.4,
            this.player.z - lead + randRange(-4, 4)
        );
        const speed = (30 + this.player.speed * 0.5) * speedScale;
        if (this.entities.spawnArrow(x, y, z, target, speed)) {
            this.audio.sfx('arrow');
        }
    }

    updatePlaying(dt) {
        this.elapsed += dt;
        const ctx = this.makeContext(dt);

        // Redemoinhos exercem tração antes do movimento do jogador.
        this.computePull();
        ctx.pull = this.pullVec;
        ctx.speedScale = this.bossStarted && this.boss.active && this.boss.dying <= 0 ? 0.92 : 1;

        if (this.input.consumeFire() || (this.player.hasFury && this.input.firing)) {
            if (this.player.fireCannons(this.entities, ctx)) {
                this.audio.sfx('cannon', this.player.hasFury ? 1.15 : 1);
                const lock = this.player._lastLock;
                if (lock?.kind === 'towers') this.hud.message('Canhão na torre!', 'gold', 900);
                else if (lock?.kind === 'enemyShips') this.hud.message('Bordo a bordo!', 'gold', 800);
            }
        }

        this.player.update(dt, ctx);

        // Mira automática — a retícula segue o alvo no mundo.
        {
            const lock = this.player.getAimLock(this.entities);
            if (lock) {
                this._aimNdc.set(lock.x, lock.y, lock.z).project(this.camera);
                const x = (this._aimNdc.x * 0.5 + 0.5) * 100;
                const y = (-this._aimNdc.y * 0.5 + 0.5) * 100;
                const onScreen = this._aimNdc.z < 1 && x > 8 && x < 92 && y > 10 && y < 88;
                this.hud.setAim(lock, onScreen ? x : 50, onScreen ? y : 46);
            } else {
                this.hud.setAim(null, 50, 46);
            }
            const cd = this.player.hasFury ? BOAT.furyCooldown : BOAT.throwCooldown;
            const ready = 1 - clamp(this.player.throwTimer / cd, 0, 1);
            this.hud.setThrowReady(ready);
        }

        // O chefe fecha o rio até morrer (ou o portão abrir).
        if (this.boss.active && this.boss.dying <= 0 && !this.gateOpened) {
            const wall = this.boss.group.position.z + 34;
            if (this.player.z < wall) {
                this.player.z = wall;
                this.player.speed = Math.min(this.player.speed, 12);
            }
        }

        // Perto do castelo o rio afunila no vão do portão.
        if (this.player.z < CASTLE_Z + 70) {
            const gateHalf = this.castle.gateWidth / 2 - 4;
            const cx = this.castle.centerX;
            this.player.x = clamp(this.player.x, cx - gateHalf, cx + gateHalf);
        }

        this.world.direct(this.player.z, this.entities, this.difficulty);
        this.world.update(dt, this.time, this.player.z, this.effects);
        this.entities.update(dt, ctx);
        this.entities.resolveAxeHits(ctx);
        this.castle.update(dt, this.time);
        this.castle.emitTorchSparks(this.effects);

        this.updateBoss(dt, ctx);
        this.resolveCollisions(ctx);

        // Combo esfria com o tempo.
        if (this.comboTimer > 0) {
            this.comboTimer -= dt;
            if (this.comboTimer <= 0) this.combo = 1;
        }

        this.score += this.player.speed * dt * SCORE.distancePerMeter * (this.difficulty?.scoreScale ?? 1);

        const progress = clamp(this.player.distance / COURSE_LENGTH, 0, 1);
        while (this.landmarkIndex < LANDMARKS.length && progress >= LANDMARKS[this.landmarkIndex].at) {
            this.hud.message(LANDMARKS[this.landmarkIndex].text, 'gold', 2400);
            this.landmarkIndex++;
        }
        if (this.elapsed > 8) this.hud.setHint(false);

        if (!this.player.alive) {
            this.gameOver();
            return;
        }

        // Chegada: o drakkar cruza o vão do portão.
        if (this.gateOpened && this.player.z <= CASTLE_Z + 2) {
            this.startVictory();
        }

        this.updateHud(dt);
        this.updateCamera(dt);
        this.audio.intensity = clamp(this.entities.countActive('enemyShips') / 3, 0, 1);
    }

    computePull() {
        this.pullVec.x = 0;
        this.pullVec.drag = 0;
        for (const w of this.entities.pools.whirlpools) {
            if (!w.active) continue;
            const dx = w.position.x - this.player.x;
            const dz = w.position.z - this.player.z;
            const dist = Math.hypot(dx, dz);
            if (dist > 16) continue;
            const strength = (1 - dist / 16) ** 2;
            this.pullVec.x += (dx / (dist || 1)) * strength * 16;
            this.pullVec.drag += strength * 1.4;
        }
    }

    updateBoss(dt, ctx) {
        const boss = this.boss;

        if (!this.bossStarted && this.player.z < BOSS_Z + 340) {
            this.bossStarted = true;
            boss.spawn(BOSS_Z, this.difficulty);
            this.hud.showBoss(true);
            this.hud.setBossHealth(1);
            this.hud.message('A Barcaça Negra bloqueia o rio!', 'danger', 3400);
            this.audio.playMusic('boss');
            this.audio.sfx('horn');
        }

        if (!boss.active) return;
        boss.update(dt, ctx);

        if (boss.dying <= 0) {
            // Balas de canhão contra o chefe.
            for (const shot of this.entities.pools.shots) {
                if (!shot.active) continue;
                const dx = shot.group.position.x - boss.group.position.x;
                const dz = shot.group.position.z - boss.group.position.z;
                const dy = shot.group.position.y - boss.group.position.y;
                if (Math.abs(dx) < 8 && Math.abs(dz) < 18 && dy < 10 && dy > -3) {
                    shot.deactivate();
                    boss.hit(1, ctx);
                    this.effects.explosion(
                        shot.group.position.x,
                        shot.group.position.y,
                        shot.group.position.z,
                        0.7,
                        0.3
                    );
                    this.audio.sfx('explosion', 0.45);
                    this.hud.setBossHealth(boss.healthRatio);
                }
            }

            // Aríete: encostar na barcaça machuca.
            const dx = this.player.x - boss.group.position.x;
            const dz = this.player.z - boss.group.position.z;
            if (Math.abs(dx) < 9 && Math.abs(dz) < 19) {
                if (this.player.damage(1, ctx)) this.gameOver();
                this.hud.setHull(this.player.hull, this.player.maxHull);
                this.hud.flash('danger');
                this.player.z += 6;
            }
        } else if (!this.gateOpened) {
            this.gateOpened = true;
            this.castle.openGate();
            this.hud.showBoss(false);
            this.hud.message('O portão está aberto!', 'gold', 3600);
            this.audio.sfx('gate');
            this.audio.playMusic('river');
        }
    }

    resolveCollisions(ctx) {
        const player = this.player;
        const px = player.x;
        const pz = player.z;
        const playerRadius = 3.6;

        const hurt = (amount, hint) => {
            const died = player.damage(amount, ctx);
            this.hud.setHull(player.hull, player.maxHull);
            this.hud.flash(player.hasShield ? 'gold' : 'danger');
            this.combo = 1;
            this.comboTimer = 0;
            if (hint && Math.random() < 0.5) this.hud.message(hint, 'danger', 1600);
            if (died) this.gameOver();
        };

        // --- flechas inimigas ---
        for (const arrow of this.entities.pools.arrows) {
            if (!arrow.active) continue;
            const p = arrow.group.position;
            if (Math.abs(p.y - player.position.y) > 4.2) continue;
            const dx = p.x - px;
            const dz = p.z - pz;
            if (dx * dx + dz * dz > 20) continue;

            arrow.deactivate();
            this.effects.impact(p.x, p.y, p.z, 0xffc987);
            hurt(1, 'Flecha em chamas!');
            if (!player.alive) return;
        }

        // --- obstáculos e barcos ---
        for (const key of ['enemyShips', 'towers', 'barricades', 'rocks']) {
            for (const entity of this.entities.pools[key]) {
                if (!entity.active) continue;
                if (entity.sinking > 0 || entity.crumble > 0) continue;

                const dx = entity.position.x - px;
                const dz = entity.position.z - pz;
                const reach = entity.radius + playerRadius;
                if (dx * dx + dz * dz > reach * reach) continue;

                if (key === 'towers') {
                    // Torres ficam na margem: só raspa se o barco encostar mesmo.
                    if (Math.abs(dx) > entity.radius + 2) continue;
                }

                // Empurrão lateral para o jogador não "grudar" no obstáculo.
                const push = Math.sign(dx || 1) * -1;
                player.x += push * 2.4;
                player.lateral = push * 8;
                player.speed *= 0.55;

                if (key === 'enemyShips' || key === 'barricades') {
                    entity.hit(2, ctx);
                    if (!entity.active || entity.sinking > 0) {
                        this.onKill(key === 'enemyShips' ? SCORE.enemyShip : SCORE.barricade, entity.position);
                    }
                }

                this.effects.splash(px, player.position.y, pz - 3, 14, 1.2);
                hurt(1, key === 'rocks' ? 'Cuidado com as pedras!' : null);
                if (!player.alive) return;
            }
        }

        // --- itens ---
        for (const item of this.entities.pools.pickups) {
            if (!item.active) continue;
            const dx = item.position.x - px;
            const dz = item.position.z - pz;
            const reach = item.radius + playerRadius;
            if (dx * dx + dz * dz > reach * reach) continue;

            item.deactivate();
            this.collect(item.type);
        }
    }

    collect(type) {
        const p = this.player;
        const pos = p.position;

        switch (type) {
            case 'coin':
                this.coins++;
                this.addScore(SCORE.coin);
                this.audio.sfx('coin');
                this.effects.impact(pos.x, pos.y + 1.4, pos.z, 0xffd97a);
                break;
            case 'heart':
                if (p.hull < p.maxHull) {
                    p.heal(1);
                    this.hud.message('Casco reparado', 'gold', 1600);
                } else {
                    this.addScore(SCORE.coin * 2);
                }
                this.hud.setHull(p.hull, p.maxHull);
                this.audio.sfx('pickup');
                this.hud.flash('gold');
                break;
            case 'shield':
                p.grantShield(8);
                this.hud.message('Bênção do escudo', 'gold', 1800);
                this.audio.sfx('pickup');
                break;
            case 'fury':
                p.grantFury(9);
                this.hud.message('Fúria do guerreiro!', 'gold', 1800);
                this.audio.sfx('fury');
                this.effects.explosion(pos.x, pos.y + 1, pos.z, 1.1, 0.06);
                break;
            default:
                break;
        }
    }

    updateHud(dt) {
        this.hudAccum += dt;
        if (this.hudAccum < 0.08) return;
        this.hudAccum = 0;

        const progress = clamp(this.player.distance / COURSE_LENGTH, 0, 1);
        this.hud.setProgress(progress, COURSE_LENGTH - this.player.distance);
        this.hud.setScore(this.score);
        this.hud.setCombo(this.combo);
        this.hud.setTime(this.elapsed);
        this.hud.setHull(this.player.hull, this.player.maxHull);

        const furyRatio = this.player.hasFury ? this.player.furyTime / 9 : this.player.hasShield ? this.player.shieldTime / 8 : 0;
        this.hud.setFury(furyRatio, this.player.hasFury);
    }

    updateDefeat(dt) {
        this.defeatTimer += dt;
        const p = this.player;
        p.root.position.y -= dt * 1.1;
        p.root.rotation.z += dt * 0.55;
        p.root.rotation.x += dt * 0.2;

        if (Math.random() < 0.7) {
            this.effects.fire(p.x + randRange(-2, 2), p.root.position.y + 1.5, p.z + randRange(-4, 4), 2, 1.1);
            this.effects.smokePuff(p.x, p.root.position.y + 2, p.z, 1, 1.8);
        }

        this.world.update(dt, this.time, p.z, this.effects);
        this.entities.update(dt, this.makeContext(dt));
        this.castle.update(dt, this.time);
        this.updateCamera(dt);

        if (this.defeatTimer > 2.8) this.showDefeatScreen();
    }

    updateVictorySequence(dt) {
        this.victoryTimer += dt;
        const ctx = this.makeContext(dt);
        this.player.update(dt, ctx);
        this.world.update(dt, this.time, this.player.z, this.effects);
        this.entities.update(dt, ctx);
        this.castle.update(dt, this.time);

        // Fogos sobre o castelo.
        if (Math.random() < dt * 2.2) {
            this.effects.firework(
                this.castle.centerX + randRange(-40, 40),
                randRange(38, 62),
                CASTLE_Z - randRange(10, 60)
            );
            this.audio.sfx('firework', 0.7);
        }

        this.updateCamera(dt);
        if (this.victoryTimer > 7) this.showVictoryScreen();
    }

    /* ------------------------------------------------------------------ */
    /* Câmera e ambiente                                                   */
    /* ------------------------------------------------------------------ */

    updateCamera(dt, instant = false) {
        const p = this.player;
        const mode = CAMERA_MODES[this.cameraMode];

        let offsetY = mode.offset.y;
        let offsetZ = mode.offset.z;
        let lookY = mode.look.y;
        let lookZ = mode.look.z;

        if (this.state === 'victory-seq') {
            // A câmera sai de trás do drakkar e se reposiciona para enquadrar,
            // no mesmo plano, o barco atracado e a princesa na torre.
            const raw = clamp(this.victoryTimer / 5.5, 0, 1);
            const t = raw * raw * (3 - 2 * raw);
            const pr = this.castle.princessWorld;

            const desiredX = lerpNum(p.position.x, p.position.x - 17, t);
            const desiredY = lerpNum(p.position.y + mode.offset.y, p.position.y + 13, t);
            const desiredZ = lerpNum(p.position.z + mode.offset.z, p.position.z + 27, t);

            const lambda = instant ? 999 : 2.4;
            this.camera.position.x = damp(this.camera.position.x, desiredX, lambda, dt);
            this.camera.position.y = damp(this.camera.position.y, desiredY, lambda, dt);
            this.camera.position.z = damp(this.camera.position.z, desiredZ, lambda, dt);

            this.lookTarget = this.lookTarget || new THREE.Vector3();
            this.lookTarget.set(
                lerpNum(p.position.x, lerpNum(p.position.x, pr.x, 0.5), t),
                lerpNum(p.position.y + 2.6, lerpNum(p.position.y + 3.0, pr.y, 0.46), t),
                lerpNum(p.position.z - 16, lerpNum(p.position.z, pr.z, 0.5), t)
            );
            this.camera.lookAt(this.lookTarget);
            return;
        }

        if (this.state === 'defeat') {
            offsetY += this.defeatTimer * 2.4;
            offsetZ += this.defeatTimer * 3.2;
        }

        const yaw = p.root.rotation.y * 0.5;
        const desiredX = p.position.x + Math.sin(yaw) * offsetZ * -1;
        const desiredZ = p.position.z + Math.cos(yaw) * offsetZ;
        const waterY = waterHeight(desiredX, desiredZ, this.time);
        const desiredY = Math.max(waterY + 3.2, p.position.y + offsetY);

        if (instant) {
            this.camera.position.set(desiredX, desiredY, desiredZ);
        } else {
            const lambda = this.state === 'playing' ? 6.5 : 2.6;
            this.camera.position.x = damp(this.camera.position.x, desiredX, lambda, dt);
            this.camera.position.y = damp(this.camera.position.y, desiredY, lambda * 0.8, dt);
            this.camera.position.z = damp(this.camera.position.z, desiredZ, lambda, dt);
        }

        this.lookTarget = this.lookTarget || new THREE.Vector3();
        const aheadX = centerX(p.position.z + lookZ);
        this.lookTarget.set(
            lerpNum(p.position.x, aheadX, 0.18),
            p.position.y + lookY,
            p.position.z + lookZ
        );
        this.camera.lookAt(this.lookTarget);

        if (this.state === 'playing') {
            const span = Math.max(1, BOAT.boostSpeed - BOAT.baseSpeed);
            const boostT = clamp((p.speed - BOAT.baseSpeed) / span, 0, 1);
            const fov = 61 + boostT * 7 + Math.abs(p.roll) * 8;
            this.camera.fov = damp(this.camera.fov, fov, 3.4, dt);
            this.camera.updateProjectionMatrix();
        }
    }

    updateEnvironment(dt) {
        const progress = clamp(this.player.distance / COURSE_LENGTH, 0, 1);
        const palette = sampleSkyPalette(progress);
        applySkyPalette(this.skyUniforms, palette);

        this.scene.fog.color.copy(palette.fog);
        this.water.uniforms.uFogColor.value.copy(palette.fog);
        this.sun.color.copy(palette.light);
        this.sun.intensity = palette.lightIntensity;
        this.hemi.color.copy(palette.ambient);

        // Direção do sol: mantém uma elevação mínima para as sombras ficarem legíveis.
        const dir = palette.sunDir;
        const sx = dir.x;
        const sy = Math.max(dir.y, 0) + 0.45;
        const sz = dir.z;
        const len = Math.hypot(sx, sy, sz) || 1;
        const cam = this.camera.position;
        this.sun.position.set(cam.x + (sx / len) * 120, (sy / len) * 120, cam.z + (sz / len) * 120);
        this.sun.target.position.set(cam.x, 0, cam.z - 20);
        this.sun.target.updateMatrixWorld();

        this.fill.position.set(cam.x, cam.y + 6, cam.z + 4);
        this.fill.target.position.set(this.player.position.x, this.player.position.y, this.player.position.z - 8);
        this.fill.target.updateMatrixWorld();
        this.fill.color.copy(palette.ambient).lerp(WHITE, 0.35);

        this.sky.position.copy(cam);
        this.sky.material.uniforms.uTime.value = this.time;
        this.sky.material.uniforms.uCloud.value = 0.42 + progress * 0.42;

        this.water.update(this.time, this.camera);
        this.terrain.update(this.camera);
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
        this.bloom?.setSize(w, h);
    }
}

function lerpNum(a, b, t) {
    return a + (b - a) * t;
}

const game = new Game();
game.init().catch((err) => {
    console.error(err);
    game.hud.showError('Algo deu errado ao montar o rio. Recarregue a página.');
});

window.__riverKnight = game;
