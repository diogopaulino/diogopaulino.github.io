/**
 * Vector Fighter — laço principal, telas e round loop.
 * Attract mode no título (CPU vs CPU), select 3D, luta no anel octogonal.
 */

import * as THREE from 'three';
import {
    QUALITY, FIGHTERS, loadSettings, saveSettings,
    fighterById, stageById, ROUND_TIME, ROUNDS_TO_WIN
} from './config.js';
import { detectMobile, detectSoftwareGL, pick } from './utils.js';
import { createArena, createSky, applyStageLights } from './arena.js';
import { Fighter, separate } from './fighter.js';
import { resolveHits, resetCombosIfIdle } from './combat.js';
import { FighterAI } from './ai.js';
import { FightCamera, cameraMoveAxes, towardAxes } from './camera.js';
import { Effects } from './effects.js';
import { GameAudio } from './audio.js';
import { Input } from './input.js';
import { Hud } from './hud.js';

class Game {
    constructor() {
        this.settings = loadSettings();
        this.hud = new Hud();
        this.input = new Input();
        this.audio = new GameAudio();
        this.canvas = document.getElementById('scene');
        this.state = 'boot';
        this.pickSlot = 'p1';
        this.timeScale = 1;
        this.roundTime = ROUND_TIME;
        this.lock = 0;
        this.endHold = 0;
        this.lastTime = performance.now();
        this.fpsAccum = 0;
        this.fpsFrames = 0;
        this.paused = false;
        this.p1Ai = new FighterAI(this.settings.difficulty);
        this.p2Ai = new FighterAI(this.settings.difficulty);
        this.lights = [];
        this.sky = null;
        this.arena = null;
    }

    resolveQuality() {
        const choice = this.settings.quality;
        if (choice !== 'auto' && QUALITY[choice]) return QUALITY[choice];
        if (detectMobile() || detectSoftwareGL()) return QUALITY.low;
        const big = Math.min(window.innerWidth, window.innerHeight) >= 900;
        return big ? QUALITY.high : QUALITY.medium;
    }

    async init() {
        this.hud.setLoading(0.1, 'Ligando o polígono…');
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
            this.hud.showError('Este laboratório precisa de WebGL. Ative a aceleração de hardware.');
            return;
        }

        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.quality.pixelRatio));
        this.renderer.setSize(window.innerWidth, window.innerHeight, false);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.05;
        this.renderer.shadowMap.enabled = this.quality.shadows;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 120);
        this.camera.position.set(0, 3.2, 11);
        this.rig = new FightCamera(this.camera);

        this.hud.setLoading(0.45, 'Montando o anel…');
        this.buildStage(stageById(this.settings.stage));

        this.hud.setLoading(0.7, 'Invocando lutadores…');
        this.spawn(fighterById(this.settings.p1), fighterById(this.settings.cpu));
        this.effects = new Effects(this.scene, this.quality.particles);

        this.hud.bindSelect({
            onFighter: (id) => this.pickFighter(id),
            onStage: (id) => this.pickStage(id),
            onDiff: (id) => {
                this.settings.difficulty = id;
                this.p2Ai.setLevel(id);
                this.p1Ai.setLevel(id);
                saveSettings(this.settings);
                this.audio.blip();
            },
            onQuality: (q) => {
                this.settings.quality = q;
                saveSettings(this.settings);
            },
            onVolume: (v) => {
                this.settings.volume = v;
                this.audio.setVolume(v);
                saveSettings(this.settings);
            }
        });

        this.hud.els.quality.value = this.settings.quality;
        this.hud.els.volume.value = Math.round(this.settings.volume * 100);
        this.hud.els.volumeValue.textContent = this.hud.els.volume.value;
        this.hud.els.stages.querySelectorAll('.chip').forEach((c) => {
            c.classList.toggle('is-on', c.dataset.stage === this.settings.stage);
        });
        this.hud.els.difficulty.querySelectorAll('.chip').forEach((c) => {
            c.classList.toggle('is-on', c.dataset.diff === this.settings.difficulty);
        });
        this.hud.setWins(this.settings.wins);
        this.hud.showTouch(detectMobile());
        this.bindUi();
        this.bindTouch();

        window.addEventListener('resize', () => this.resize());
        this.resize();

        this.hud.setLoading(1, 'JUDGE');
        this.hud.hideLoading();
        this.goTitle();
        this.lastTime = performance.now();
        this.renderer.setAnimationLoop(() => this.frame());
    }

    buildStage(stage) {
        this.stage = stage;
        if (this.arena) this.scene.remove(this.arena);
        if (this.sky) this.scene.remove(this.sky);
        for (const l of this.lights) this.scene.remove(l);
        this.sky = createSky(stage.skyTop, stage.skyBot);
        this.scene.add(this.sky);
        this.arena = createArena(stage, this.quality.extras);
        this.scene.add(this.arena);
        const pack = applyStageLights(this.scene, stage, this.quality);
        this.lights = [pack.ambient, pack.hemi, pack.sun, pack.fill, pack.spot, pack.spot.target];
    }

    spawn(defA, defB) {
        if (this.p1) this.p1.dispose(this.scene);
        if (this.p2) this.p2.dispose(this.scene);
        this.p1 = new Fighter(defA, 1, this.scene, this.quality);
        this.p2 = new Fighter(defB, 2, this.scene, this.quality);
        this.p1.rounds = 0;
        this.p2.rounds = 0;
    }

    bindUi() {
        document.getElementById('startButton').addEventListener('click', () => this.goSelect());
        document.getElementById('fightButton').addEventListener('click', () => this.goVs());
        document.getElementById('randomCpu').addEventListener('click', () => {
            this.settings.cpu = pick(FIGHTERS).id;
            this.pickSlot = 'cpu';
            this.refreshSelect();
            this.audio.blip();
        });
        document.getElementById('pickP1').addEventListener('click', () => {
            this.pickSlot = 'p1';
            this.hud.setPickHint('Escolha o lutador 1');
            this.refreshSelect();
        });
        document.getElementById('pickCpu').addEventListener('click', () => {
            this.pickSlot = 'cpu';
            this.hud.setPickHint('Escolha o oponente (CPU)');
            this.refreshSelect();
        });
        document.getElementById('resumeButton').addEventListener('click', () => this.setPaused(false));
        document.getElementById('pauseMenuButton').addEventListener('click', () => {
            this.setPaused(false);
            this.goTitle();
        });
        document.getElementById('retryButton').addEventListener('click', () => this.goVs());
        document.getElementById('resultMenuButton').addEventListener('click', () => this.goTitle());
        document.getElementById('soundButton').addEventListener('click', () => this.toggleMute());
        document.getElementById('pauseButton').addEventListener('click', () => this.setPaused(true));

        this.input.on('pause', () => {
            if (this.state === 'fight') this.setPaused(!this.paused);
            else if (this.state === 'pause') this.setPaused(false);
        });
        this.input.on('mute', () => this.toggleMute());
        this.input.on('confirm', () => {
            if (this.state === 'title') this.goSelect();
            else if (this.state === 'select') this.goVs();
            else if (this.state === 'result') this.goVs();
        });
    }

    bindTouch() {
        const stick = document.getElementById('stick');
        const nub = document.getElementById('stickNub');
        const setFrom = (clientX, clientY) => {
            const r = stick.getBoundingClientRect();
            const dx = (clientX - (r.left + r.width / 2)) / (r.width * 0.42);
            const dy = (clientY - (r.top + r.height / 2)) / (r.height * 0.42);
            const x = Math.max(-1, Math.min(1, dx));
            const z = Math.max(-1, Math.min(1, dy));
            this.input.setTouchAxis(x, z);
            nub.style.transform = `translate(${x * 18}px, ${z * 18}px)`;
        };
        const clear = () => {
            this.input.setTouchAxis(0, 0);
            nub.style.transform = 'translate(0,0)';
        };
        stick.addEventListener('pointerdown', (e) => {
            // Best-effort: lança InvalidStateError se o ponteiro já terminou.
            try {
                stick.setPointerCapture(e.pointerId);
            } catch (err) {
                /* segue sem captura */
            }
            setFrom(e.clientX, e.clientY);
        });
        stick.addEventListener('pointermove', (e) => {
            if (e.buttons) setFrom(e.clientX, e.clientY);
        });
        stick.addEventListener('pointerup', clear);
        stick.addEventListener('pointercancel', clear);

        document.getElementById('touchPunch').addEventListener('pointerdown', (e) => {
            e.preventDefault();
            this.input.tapPunch();
        });
        document.getElementById('touchKick').addEventListener('pointerdown', (e) => {
            e.preventDefault();
            this.input.tapKick();
        });
        document.getElementById('touchThrow').addEventListener('pointerdown', (e) => {
            e.preventDefault();
            this.input.tapThrow();
        });
        const guard = document.getElementById('touchGuard');
        guard.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            this.input.setTouchGuard(true);
        });
        guard.addEventListener('pointerup', () => this.input.setTouchGuard(false));
        guard.addEventListener('pointercancel', () => this.input.setTouchGuard(false));
    }

    toggleMute() {
        this.audio.init();
        this.audio.setEnabled(!this.audio.enabled);
        document.getElementById('soundButton').setAttribute('aria-pressed', String(this.audio.enabled));
        document.getElementById('soundButton').textContent = this.audio.enabled ? '♪' : '×';
    }

    pickFighter(id) {
        this.audio.blip();
        if (this.pickSlot === 'p1') {
            this.settings.p1 = id;
            this.pickSlot = 'cpu';
            this.hud.setPickHint('Agora o CPU');
        } else {
            this.settings.cpu = id;
            this.hud.setPickHint('Pronto. Entre no anel.');
        }
        saveSettings(this.settings);
        this.refreshSelect();
        if (this.state === 'select') {
            this.p1.dispose(this.scene);
            this.p1 = new Fighter(fighterById(this.settings.p1), 1, this.scene, this.quality);
            this.p1.x = 0;
            this.p1.z = 0;
            this.p1.syncTransform();
            this.p2.root.visible = false;
        }
    }

    pickStage(id) {
        this.audio.blip();
        this.settings.stage = id;
        saveSettings(this.settings);
        this.buildStage(stageById(id));
    }

    refreshSelect() {
        this.hud.highlightRoster(
            this.pickSlot === 'p1' ? this.settings.p1 : this.settings.cpu,
            this.pickSlot
        );
        document.getElementById('pickP1').classList.toggle('is-on', this.pickSlot === 'p1');
        document.getElementById('pickCpu').classList.toggle('is-on', this.pickSlot === 'cpu');
        document.getElementById('selectP1Name').textContent = fighterById(this.settings.p1).name;
        document.getElementById('selectCpuName').textContent = fighterById(this.settings.cpu).name;
        document.getElementById('selectBlurb').textContent = fighterById(
            this.pickSlot === 'p1' ? this.settings.p1 : this.settings.cpu
        ).blurb;
    }

    goTitle() {
        this.state = 'title';
        this.paused = false;
        this.timeScale = 1;
        this.audio.setMode('menu');
        this.hud.setScreen('title');
        this.rig.setMode('fight');
        this.spawn(pick(FIGHTERS), pick(FIGHTERS));
        this.p1.rounds = 0;
        this.p2.rounds = 0;
        this.roundTime = ROUND_TIME;
        this.lock = 0.4;
        this.endHold = 0;
        this.attract = true;
    }

    goSelect() {
        this.audio.init();
        this.audio.blip();
        this.state = 'select';
        this.attract = false;
        this.hud.setScreen('select');
        this.pickSlot = 'p1';
        this.hud.setPickHint('Escolha o lutador 1');
        this.refreshSelect();
        this.spawn(fighterById(this.settings.p1), fighterById(this.settings.cpu));
        this.p1.x = 0;
        this.p1.z = 0;
        this.p1.syncTransform();
        this.p2.root.visible = false;
        this.p2.shadow.visible = false;
        this.rig.setMode('showcase');
        this.camera.position.set(3.2, 1.8, 3.6);
    }

    goVs() {
        this.audio.init();
        this.audio.announce();
        this.state = 'vs';
        this.attract = false;
        this.buildStage(stageById(this.settings.stage));
        this.spawn(fighterById(this.settings.p1), fighterById(this.settings.cpu));
        this.p2Ai.setLevel(this.settings.difficulty);
        this.hud.showVs(this.p1.def, this.p2.def, this.stage);
        this.hud.setScreen('vs');
        this.rig.setMode('fight');
        this.lock = 1.8;
        this.vsToFight = true;
    }

    beginRound(announceRound = true) {
        this.state = 'fight';
        this.paused = false;
        this.timeScale = 1;
        this.roundTime = ROUND_TIME;
        this.endHold = 0;
        this.p1.reset(1);
        this.p2.reset(2);
        this.hud.setScreen('fight');
        this.hud.setupFight(this.p1, this.p2);
        this.rig.setMode('fight');
        this.audio.setMode('fight');
        this.lock = 1.25;
        if (announceRound) {
            const n = this.p1.rounds + this.p2.rounds + 1;
            this.hud.announce(`ROUND ${n}`, 0.7);
            window.setTimeout(() => {
                if (this.state === 'fight') {
                    this.hud.announce('FIGHT!', 0.55);
                    this.audio.announce();
                }
            }, 750);
        }
    }

    setPaused(on) {
        if (this.state !== 'fight' && this.state !== 'pause') return;
        this.paused = on;
        this.state = on ? 'pause' : 'fight';
        this.hud.setScreen(this.state);
    }

    frame() {
        const now = performance.now();
        const raw = Math.min(0.05, (now - this.lastTime) / 1000);
        this.lastTime = now;
        const dt = raw * this.timeScale;
        this.input.tick(raw);
        this.hud.tickAnnounce();

        this.fpsAccum += raw;
        this.fpsFrames += 1;
        if (this.fpsAccum >= 0.5) {
            this.hud.setFps(Math.round(this.fpsFrames / this.fpsAccum));
            this.fpsAccum = 0;
            this.fpsFrames = 0;
        }

        if (this.state === 'vs') {
            this.lock -= raw;
            this.idlePose(raw);
            this.rig.update(raw, this.p1, this.p2);
            if (this.lock <= 0 && this.vsToFight) {
                this.vsToFight = false;
                this.beginRound(true);
            }
        } else if (this.state === 'select') {
            this.p1.poseT += raw;
            this.p1.setPose('idle');
            this.p1.applyPose(this.p1.targetPose, 0.2);
            this.p1.animateOverlay(raw);
            this.p1.syncTransform();
            this.rig.update(raw, this.p1, this.p2);
        } else if (this.state === 'title' || this.state === 'fight' || this.state === 'pause') {
            if (!this.paused) this.updateFight(dt, raw);
            this.rig.update(raw, this.p1, this.p2, this.timeScale);
        } else if (this.state === 'result') {
            this.idlePose(raw);
            this.rig.update(raw, this.p1, this.p2);
        }

        this.effects.update(raw);
        this.renderer.render(this.scene, this.camera);
    }

    idlePose(dt) {
        for (const f of [this.p1, this.p2]) {
            f.poseT += dt;
            f.animateOverlay(dt);
            f.applyPose(f.targetPose, 0.15);
            f.syncTransform();
        }
    }

    updateFight(dt, raw) {
        if (this.lock > 0) this.lock -= raw;

        const axes = this.input.axes();
        const pMove = cameraMoveAxes(this.camera, axes.x, axes.z);

        let cmd1;
        let move1;
        if (this.attract) {
            cmd1 = this.p1Ai.update(dt, this.p1, this.p2);
            move1 = towardAxes(this.p1, this.p2, cmd1.x, cmd1.z);
        } else if (this.lock > 0) {
            cmd1 = idleCmd();
            move1 = { x: 0, z: 0 };
        } else {
            cmd1 = this.input.command();
            move1 = pMove;
        }
        const cmd2 = this.lock > 0 ? idleCmd() : this.p2Ai.update(dt, this.p2, this.p1);
        const move2 = towardAxes(this.p2, this.p1, cmd2.x, cmd2.z);

        this.p1.update(dt, cmd1, this.p2, move1);
        this.p2.update(dt, cmd2, this.p1, move2);
        separate(this.p1, this.p2);

        if (this.lock <= 0 && this.endHold <= 0) {
            resolveHits(this.p1, this.p2, (result, move, counter, pos) => {
                this.onHit(this.p1, this.p2, result, pos);
            });
            resolveHits(this.p2, this.p1, (result, move, counter, pos) => {
                this.onHit(this.p2, this.p1, result, pos);
            });
        }
        resetCombosIfIdle(this.p1);
        resetCombosIfIdle(this.p2);

        if (!this.attract && this.state === 'fight') {
            if (this.lock <= 0 && this.endHold <= 0) this.roundTime -= raw;
            this.hud.setTimer(this.roundTime);
            this.hud.paintHp(this.p1, this.p2);
            this.hud.setCombo(Math.max(this.p1.combo, this.p2.combo));
        }

        if (this.endHold > 0) {
            this.endHold -= raw;
            if (this.endHold <= 0) this.afterRound();
            return;
        }

        const over = this.checkRoundOver();
        if (over) this.finishRound(over);
    }

    onHit(att, def, result, pos) {
        this.audio.hit(result === 'block');
        const color = result === 'block' ? 0xf0e8c8 : att.def.palette.accent;
        this.effects.burst(pos, color, result === 'block' ? 6 : 14, result === 'block' ? 3 : 6);
        this.rig.impulse(result === 'block' ? 0.15 : 0.45);
        if (result === 'hit' && def.hp <= 0) this.effects.shatter(def);
    }

    checkRoundOver() {
        if (!this.p1.alive && this.p1.koReason === 'ring') return { winner: this.p2, reason: 'RING OUT' };
        if (!this.p2.alive && this.p2.koReason === 'ring') return { winner: this.p1, reason: 'RING OUT' };
        if (!this.p1.alive) return { winner: this.p2, reason: 'K.O.' };
        if (!this.p2.alive) return { winner: this.p1, reason: 'K.O.' };
        if (this.roundTime <= 0) {
            if (this.p1.hp === this.p2.hp) return { winner: null, reason: 'DRAW' };
            const winner = this.p1.hp > this.p2.hp ? this.p1 : this.p2;
            return { winner, reason: 'TIME OUT' };
        }
        return null;
    }

    finishRound(over) {
        this.endHold = this.attract ? 1.4 : 2.2;
        this.timeScale = over.reason === 'K.O.' ? 0.35 : 1;
        if (over.winner) {
            over.winner.celebrate();
            if (!this.attract) over.winner.rounds += 1;
        }
        if (!this.attract) {
            this.hud.paintRounds(this.p1, this.p2);
            const perfect = over.winner && over.winner.hp >= over.winner.maxHp - 0.1;
            this.hud.announce(perfect ? 'PERFECT' : over.reason, 1.8);
            if (over.reason === 'K.O.' || over.reason === 'RING OUT') this.audio.ko();
        }
        if (over.winner && over.reason !== 'DRAW') {
            const loser = over.winner === this.p1 ? this.p2 : this.p1;
            if (loser.koReason !== 'ring') this.effects.shatter(loser);
        }
    }

    afterRound() {
        this.timeScale = 1;
        if (this.attract) {
            this.p1.reset(1);
            this.p2.reset(2);
            this.roundTime = ROUND_TIME;
            this.lock = 0.3;
            return;
        }
        if (this.p1.rounds >= ROUNDS_TO_WIN || this.p2.rounds >= ROUNDS_TO_WIN) {
            const win = this.p1.rounds > this.p2.rounds;
            if (win) {
                this.settings.wins += 1;
                saveSettings(this.settings);
                this.hud.setWins(this.settings.wins);
                this.audio.win();
            }
            this.state = 'result';
            this.hud.showResult({
                win,
                reason: win ? 'YOU WIN' : 'YOU LOSE',
                p1: this.p1,
                cpu: this.p2
            });
            this.hud.setScreen('result');
            this.audio.setMode('menu');
            return;
        }
        this.beginRound(true);
    }

    resize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h, false);
    }
}

function idleCmd() {
    return { x: 0, z: 0, punch: false, kick: false, sweep: false, throw: false, guard: false, jump: false, dash: false };
}

const game = new Game();
game.init().catch((err) => {
    console.error(err);
    game.hud.showError(err.message || 'Falha ao iniciar o anel.');
});
