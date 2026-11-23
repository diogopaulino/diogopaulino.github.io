/**
 * River Knight — laço principal, máquina de estados e integração de todos os
 * sistemas (mundo, entidades, câmera, interface, áudio).
 */

import * as THREE from 'three';
import { createStage } from '../../shared/gfx/stage.js?v=18';

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
} from './config.js?v=60';
import { createFireLights, fireLights } from './lights.js?v=60';
import { createWater, waterHeight } from './water.js?v=60';
import { createTerrain } from './terrain.js?v=60';
import { Effects } from './effects.js?v=60';
import { Entities } from './entities.js?v=60';
import { World } from './world.js?v=60';
import { Player } from './player.js?v=60';
import { createCastle } from './castle.js?v=60';
import { BossBarge } from './boss.js?v=60';
import { Hud } from './hud.js?v=60';
import { Input } from './input.js?v=61';
import { GameAudio } from './audio.js?v=61';
import { centerX, halfWidth } from './river.js?v=60';
import { clamp, damp, detectTouch, formatTime, randRange } from './utils.js?v=60';

/**
 * Hora solar ao longo da jornada (progresso p ∈ [0, 1]):
 *   hora = 17,3 + 0,9·p   → tarde dourada na largada, sol rasante no desfiladeiro,
 *   crepúsculo com tochas acesas diante do castelo.
 * Nuvens: 0,42 + 0,3·p (o céu fecha perto de Morvain).
 */
const HOUR_START = 17.3;
const HOUR_SPAN = 0.9;
const DEBUG = new URLSearchParams(location.search).has('debug');

const CAMERA_MODES = [
    // Câmeras afastadas para um casco de 15 m (antes a vela tapava o rio):
    // perseguição ≈ 1,5 comprimento atrás e acima do mastro, olhando ~25 m à frente.
    { name: 'perseguição', offset: new THREE.Vector3(0, 9.2, 22), look: new THREE.Vector3(0, 3.2, -26) },
    { name: 'popa', offset: new THREE.Vector3(0, 6.2, 13.5), look: new THREE.Vector3(0, 3, -22) },
    { name: 'aérea', offset: new THREE.Vector3(0, 21, 34), look: new THREE.Vector3(0, 1.5, -18) }
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
        // Primeira visita começa no Escudeiro (canhão automático): dá para jogar sem ler nada.
        const fallback = {
            difficulty: 'squire',
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

    /** Tier pedido no menu ('auto' deixa o palco decidir pelo aparelho). */
    tierChoice() {
        const choice = this.settings.quality;
        return QUALITY[choice] ? choice : 'auto';
    }

    /* ------------------------------------------------------------------ */
    /* Boot                                                                */
    /* ------------------------------------------------------------------ */

    async init() {
        this.hud.setLoading(0.06, 'Acordando o rio…');

        // Progresso real: cada textura/modelo/HDR que chega avança a barra.
        const manager = new THREE.LoadingManager();
        let assetsDone = false;
        manager.onProgress = (url, loaded, total) => {
            if (this.state === 'loading') this.hud.setLoading(0.3 + 0.6 * (loaded / Math.max(1, total)), 'Carregando o vale…');
        };
        manager.onLoad = () => { assetsDone = true; };

        // Palco compartilhado: renderer, céu físico, sol com sombra, pós (AO, bloom,
        // raios, névoa de altura, grade). Devolve null sem WebGL 2 (aviso já na tela).
        // O norte é girado para o sol da tarde ficar à frente-esquerda do rio (−Z).
        const stage = createStage({
            canvas: this.canvas,
            tier: this.tierChoice(),
            preset: 'entardecer',
            time: HOUR_START,
            fov: 62,
            near: 0.4,
            far: 3600,
            loadingManager: manager,
            sky: { north: new THREE.Vector3(-0.8, 0, 0.6), east: new THREE.Vector3(0.6, 0, 0.8) },
            post: { vignette: 0.34, rays: 0.55, bloom: 0.1 }
        });
        if (!stage) {
            this.hud.showError('Este laboratório precisa de WebGL 2.');
            return;
        }
        this.stage = stage;
        this.renderer = stage.renderer;
        this.scene = stage.scene;
        this.camera = stage.camera;
        const quality = QUALITY[stage.tier];
        this.quality = quality;
        this.camera.position.set(0, 12, 30);
        // Névoa de altura nasce na água; DOF leve só desfoca o horizonte.
        stage.pipeline.params.fogBase = 0;
        stage.shadowRadius = quality.id === 'low' ? 46 : 70;
        createFireLights(this.scene, quality.pointLights ? 4 : 2);

        this.hud.setLoading(0.14, 'Escavando o vale…');
        this.terrain = createTerrain(quality);
        this.scene.add(this.terrain.mesh);

        this.hud.setLoading(0.18, 'Enchendo o rio…');
        this.water = createWater(quality);
        this.scene.add(this.water.mesh);

        this.hud.setLoading(0.22, 'Plantando as margens…');
        this.effects = new Effects(this.scene, quality);
        this.world = new World(this.scene, quality);
        this.world.loadAssets().catch(() => {});
        this.entities = new Entities(this.scene, quality);

        this.hud.setLoading(0.26, 'Erguendo o castelo…');
        this.castle = createCastle(this.scene, quality);
        this.boss = new BossBarge(this.scene, quality);

        this.hud.setLoading(0.3, 'Preparando o guerreiro…');
        this.player = new Player(this.scene, quality);
        this.castle.lookAt(this.player.position);

        this.audio = new GameAudio();
        this.audio.enabled = !this.settings.muted;
        this.audio.volume = this.settings.volume / 100;

        this.input = new Input(this.canvas);
        this.bindUi();

        this.isTouch = detectTouch();
        this.hud.setTouchVisible(false);

        // Espera os assets (com teto de 12 s: se a rede falhar o jogo segue com fallback).
        const t0 = performance.now();
        while (!assetsDone && performance.now() - t0 < 12000) {
            await new Promise((r) => setTimeout(r, 80));
        }

        // Primeiro quadro "a frio" para compilar shaders antes de mostrar o menu.
        this.world.reset(0);
        this.player.reset(DIFFICULTY[this.settings.difficulty]);
        this.updateCamera(1, true);
        this.hud.setLoading(0.94, 'Acendendo as tochas…');
        await stage.warmup();

        this.hud.setLoading(1, 'Pronto');
        setTimeout(() => this.hud.hideLoading(), 260);

        this.enterMenu();
        // O palco cuida do laço (THREE.Timer), da pausa com a aba oculta, do
        // redimensionamento (ResizeObserver) e de não desenhar com canvas de tamanho zero.
        stage.start((dt) => this.frame(dt));
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state === 'playing') this.pause();
        });
        if (DEBUG) this.installDebug();
    }

    /** Atalhos de depuração (`?debug=1`): teleporte, vitória rápida, estatísticas. */
    installDebug() {
        window.__lab = {
            game: this,
            /** Leva o drakkar a `meters` do início (mantém a partida em curso). */
            goto: (meters) => {
                const z = -meters;
                this.player.z = z;
                this.player.x = centerX(z);
                this.player.distance = meters;
                this.entities.reset();
                this.world.reset(z);
                this.world.nextSpawnZ = z - 70;
                this.updateCamera(1, true);
                return z;
            },
            god: () => { clearInterval(this._god); this._god = setInterval(() => { this.player.hull = this.player.maxHull; this.player.alive = true; }, 100); },
            /** Câmera livre: posição e alvo no mundo; sem argumentos volta à câmera do jogo. */
            cam: (...v) => { this._freeCam = v.length === 6 ? v : null; },
            /** Congela/retoma o avanço do drakkar (para enquadrar capturas). */
            hold: (on = true) => { this._hold = on; },
            killBoss: () => { for (let i = 0; i < 40; i++) this.boss.hit(1, this.makeContext(0.016)); },
            stats: () => ({ ...this.stage.stats(), state: this.state, hour: this.stage.hour })
        };
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
        this.camera.fov = 62;
        this.camera.updateProjectionMatrix();

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
        this.hud.setHint(true, this.difficulty.autoFire, this.isTouch);
        this.camera.fov = 62;
        this.camera.updateProjectionMatrix();

        this.entities.reset();
        this.boss.reset();
        this.castle.reset?.();
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
    }

    gameOver() {
        // Pode ser pedido duas vezes no mesmo quadro (colisão + checagem de vida): só vale a primeira.
        if (this.state !== 'playing') return;
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

    frame(dt) {
        this.fpsAccum += dt;
        if (this.fpsAccum > 0.5) {
            this.hud.setFps(this.stage.fps);
            this.fpsAccum = 0;
        }

        if (this.state === 'paused') return;

        this.time += dt;

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
        fireLights.commit(this.camera);
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

        p.updateMenu(dt, this.time);

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

    /**
     * Contexto passado às entidades a cada quadro. Um objeto só, reaproveitado
     * (antes eram um objeto e quatro closures novos por chamada, várias vezes por quadro).
     */
    makeContext(dt) {
        let ctx = this._ctx;
        if (!ctx) {
            ctx = this._ctx = {
                dt: 0,
                time: 0,
                input: this.input,
                effects: this.effects,
                audio: this.audio,
                player: { x: 0, y: 0, z: 0 },
                difficulty: null,
                pull: null,
                speedScale: 1,
                bossLock: null,
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
        ctx.dt = dt;
        ctx.time = this.time;
        ctx.player.x = this.player.x;
        ctx.player.y = this.player.position.y;
        ctx.player.z = this.player.z;
        ctx.difficulty = this.difficulty;
        ctx.pull = null;
        ctx.speedScale = 1;
        ctx.bossLock = null;
        return ctx;
    }

    /**
     * Alvo "Barcaça" para a mira automática enquanto o chefe bloqueia o rio
     * (antes a retícula ficava vazia na luta e o tiro saía reto, sem trava).
     */
    bossLock() {
        const boss = this.boss;
        if (!boss.active || boss.dying > 0 || this.gateOpened) return null;
        const pos = boss.group.position;
        const lock = this._bossLock || (this._bossLock = { kind: 'boss', x: 0, y: 0, z: 0, dist: 0, entity: null });
        lock.x = pos.x;
        lock.y = pos.y + 3;
        lock.z = pos.z;
        lock.dist = Math.hypot(pos.x - this.player.x, pos.z - this.player.z);
        lock.entity = boss;
        return lock;
    }

    fireArrow(x, y, z, speedScale = 1) {
        // Arqueiro mira onde o barco VAI estar: posição + velocidade sobre o fundo × tempo de voo
        // (com 85% de acerto na antecipação e dispersão humana de ±2,4 m / ±4 m).
        const p = this.player;
        const speed = (34 + p.speed * 0.4) * speedScale;
        const tFlight = Math.hypot(p.x - x, p.z - z) / speed;
        const target = this._arrowTarget || (this._arrowTarget = new THREE.Vector3());
        target.set(
            p.x + p.vx * tFlight * 0.85 + randRange(-2.4, 2.4),
            p.position.y + 1.4,
            p.z + p.vz * tFlight * 0.85 + randRange(-4, 4)
        );
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
        ctx.bossLock = this.bossLock();

        // Telégrafo de remo: W/S (↑/↓), botões ▲▼ no toque, LB/RB ou D-pad no controle.
        const gearDelta = this.input.consumeGear();
        if (gearDelta) {
            const g = this.player.shiftGear(gearDelta);
            if (g === null) {
                this.hud.message('Remadores sem fôlego — aguarde', 'danger', 1400);
            } else {
                this.hud.message(BOAT.gears[g].label, g === BOAT.gears.length - 1 ? 'danger' : 'gold', 900);
                this.audio.sfx(g > 1 ? 'horn' : 'hitWood', 0.35);
            }
        }
        if (this.player.exhausted && !this._exhaustedShown) {
            this._exhaustedShown = true;
            this.hud.message('Remadores exaustos: ritmo de cruzeiro', 'danger', 1800);
        } else if (!this.player.exhausted) {
            this._exhaustedShown = false;
        }

        // Escudeiro: o canhão dispara sozinho quando há alvo travado (só falta desviar).
        const autoFire = this.difficulty?.autoFire && this.player.canThrow() && this.player.getAimLock(this.entities, ctx.bossLock);
        if (this.input.consumeFire() || autoFire || (this.player.hasFury && this.input.firing)) {
            if (this.player.fireCannons(this.entities, ctx)) {
                this.audio.sfx('cannon', this.player.hasFury ? 1.15 : 1);
                const lock = this.player._lastLock;
                if (lock?.kind === 'towers') this.hud.message('Canhão na torre!', 'gold', 900);
                else if (lock?.kind === 'enemyShips') this.hud.message('Bordo a bordo!', 'gold', 800);
            }
        }

        const holdZ = this.player.z;
        this.player.update(dt, ctx);
        if (this._hold) {
            this.player.z = holdZ;
            this.player.root.position.z = holdZ;
        }

        // Mira automática — a retícula segue o alvo no mundo.
        {
            const lock = this.player.getAimLock(this.entities, ctx.bossLock);
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
                this.player.u = Math.min(this.player.u, 3);
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
            this.pullVec.x += (dx / (dist || 1)) * strength * 5; // m/s de arrasto lateral rumo ao olho
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
                this.player.bump(Math.sign(dx) || 1, 0.4, 3, 0.7);
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

                // Choque: separa os cascos ao longo da normal e transfere impulso
                // (o barco perde seguimento e é jogado para o lado, sem "grudar").
                const dist = Math.sqrt(dx * dx + dz * dz) || 1;
                const nx = -dx / dist;
                const nz = -dz / dist;
                const overlap = reach - dist;
                player.x += nx * Math.min(overlap, 3);
                player.z += Math.max(0, nz) * Math.min(overlap, 3);
                player.bump(nx, nz, key === 'rocks' ? 3.2 : 2.4, key === 'rocks' ? 0.6 : 0.45);

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

        this.hud.setNav(this.player);

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
        if (this._freeCam) {
            // depuração: câmera livre fixada por __lab.cam(...)
            const f = this._freeCam;
            this.camera.position.set(f[0], f[1], f[2]);
            this.camera.lookAt(f[3], f[4], f[5]);
            return;
        }
        const mode = CAMERA_MODES[this.cameraMode];

        let offsetY = mode.offset.y;
        let offsetZ = mode.offset.z;
        let lookY = mode.look.y;
        let lookZ = mode.look.z;

        if (this.state === 'victory-seq') {
            // Cena do resgate em dois planos:
            //   0–4,4 s  plano geral — a câmera sai de trás do drakkar e abre para
            //            enquadrar o barco atracando e a torre da princesa;
            //   4,4–7 s  plano médio da princesa comemorando na sacada.
            const pr = this.castle.princessWorld;
            this.lookTarget = this.lookTarget || new THREE.Vector3();
            if (this.victoryTimer > 4.4) {
                const k = clamp((this.victoryTimer - 4.4) / 2.6, 0, 1);
                this.camera.position.set(pr.x - 3.2 + k * 1.2, pr.y + 0.5, pr.z + 8.5 - k * 1.5);
                this.lookTarget.set(pr.x, pr.y + 0.25, pr.z);
                this.camera.fov = 40;
                this.camera.updateProjectionMatrix();
                this.camera.lookAt(this.lookTarget);
                return;
            }
            const raw = clamp(this.victoryTimer / 4, 0, 1);
            const t = raw * raw * (3 - 2 * raw);

            // plano geral: da margem oposta, logo depois da muralha, olhando o cais e a torre
            const cx0 = this.castle.centerX;
            const desiredX = lerpNum(p.position.x, cx0 - 40, t);
            const desiredY = lerpNum(p.position.y + mode.offset.y, 11, t);
            const desiredZ = lerpNum(p.position.z + mode.offset.z, CASTLE_Z - 14, t);

            const lambda = instant ? 999 : 2.4;
            this.camera.position.x = damp(this.camera.position.x, desiredX, lambda, dt);
            this.camera.position.y = damp(this.camera.position.y, desiredY, lambda, dt);
            this.camera.position.z = damp(this.camera.position.z, desiredZ, lambda, dt);

            this.lookTarget.set(
                lerpNum(p.position.x, lerpNum(p.position.x, pr.x, 0.55), t),
                lerpNum(p.position.y + 2.6, 15, t),
                lerpNum(p.position.z - 16, CASTLE_Z - 31, t)
            );
            this.camera.lookAt(this.lookTarget);
            return;
        }

        if (this.state === 'defeat') {
            offsetY += this.defeatTimer * 2.4;
            offsetZ += this.defeatTimer * 3.2;
        }

        // A câmera acompanha o RUMO do navio com atraso (como num jogo de navegação):
        // fica atrás da popa e "puxa" a curva, sem copiar cada balanço do casco.
        const heading = p.heading ?? 0;
        if (instant || this._camHeading === undefined) this._camHeading = heading;
        else this._camHeading += (heading - this._camHeading) * (1 - Math.exp(-2.2 * dt));
        const ch = this._camHeading;
        const desiredX = p.position.x - Math.sin(ch) * offsetZ;
        const desiredZ = p.position.z + Math.cos(ch) * offsetZ;
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
        const ahead = -lookZ;
        const lx = p.position.x + Math.sin(ch) * ahead;
        const lz = p.position.z - Math.cos(ch) * ahead;
        this.lookTarget.set(lerpNum(lx, centerX(lz), 0.15), p.position.y + lookY, lz);
        this.camera.lookAt(this.lookTarget);

        if (this.state === 'playing') {
            const span = Math.max(1, BOAT.boostSpeed - BOAT.baseSpeed);
            const boostT = clamp((p.speed - BOAT.baseSpeed) / span, 0, 1);
            const fov = 60 + boostT * 5 + Math.abs(p.roll) * 6;
            this.camera.fov = damp(this.camera.fov, fov, 3.4, dt);
            this.camera.updateProjectionMatrix();
        }
    }

    updateEnvironment() {
        const progress = clamp(this.player.distance / COURSE_LENGTH, 0, 1);

        // A hora só é reaplicada quando muda ~1 min (refazer o céu a cada quadro é desperdício).
        const hour = HOUR_START + HOUR_SPAN * progress;
        if (Math.abs(hour - (this._hour ?? -1)) > 0.015) {
            this._hour = hour;
            this.stage.setTimeOfDay(hour);
            this.stage.sky.setClouds(0.42 + 0.3 * progress);
        }

        // Sombra centrada um pouco à frente do drakkar; foco do DOF no navio.
        const p = this.player.position;
        this._focus = this._focus || new THREE.Vector3();
        this._focus.set(p.x, 0, p.z - 22);
        this.stage.focus = this._focus;
        const params = this.stage.pipeline.params;
        params.dofFocus = this.camera.position.distanceTo(p) + 6;
        params.dofRange = this.state === 'menu' ? 26 : 90;
        params.dofMax = this.state === 'menu' ? 0.8 : 0.35;

        // Claridade das partículas: acompanha o sol (cai de ~1 a ~0,35 no crepúsculo).
        this.effects.setLight(clamp(0.3 + this.stage.sky.sunDir.y * 3.2, 0.3, 1.1));

        this.water.update(this.time, this.camera);
        this.terrain.update(this.camera);
        this.castle.setVisibleFor?.(p.z);
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
