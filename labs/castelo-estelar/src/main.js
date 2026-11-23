/**
 * Castelo Estelar — palco (kit gfx), abertura cinematográfica, órbita livre e passeio.
 *
 * Linha do tempo da abertura (s), tudo função de `introT`:
 *   janelas     glow = 0,16·smoothstep(8, 13) + 0,84·smoothstep(22,6, 26,5)
 *               (poucas janelas na revelação; o castelo inteiro acende quando a fada toca a estrela)
 *   estrela     smoothstep(22,9, 23,6)
 *   letterbox   barras 2,39:1 entram em 1,2 s e saem entre 35 e 38 s
 *   foco (DOF)  distância ao alvo da câmera; faixa = 0,9·foco (abre na órbita)
 *
 * Passeio (ver explore.js): o castelo apaga e seis estrelas caem pelo reino.
 *   janelas     glow → 0,1 + 0,5·(recolhidas / 5)   (amortecido: g ← g + (alvo − g)·(1 − e^(−1,5·dt)))
 *   final       a fada refaz o voo da abertura (t = 13,2 s + f); a estrela acende em f ≈ 9,8 s,
 *               os fogos seguem a mesma programação da abertura; em f = 23 s aparece o placar.
 *
 * Estados: boot → menu → intro ⇄ orbit ⇄ explore (pausa · final · placar). Toda tela tem saída;
 * blur/aba oculta pausa o passeio, solta as teclas e suspende o áudio (a fanfarra não se adianta).
 *
 * Depuração: ?debug=1 expõe window.__lab (seek, orbit, explore, route, stats, histogram); ?q=low|medium|high força o tier.
 */

import * as THREE from 'three';
import { createStage } from '../../shared/gfx/stage.js?v=18';
import { smoothstep } from '../../shared/gfx/core.js';
import { Guide } from '../../shared/gfx/guide.js';
import { createKingdom } from './world.js?v=7';
import { Magic } from './effects.js?v=6';
import { CineCamera, FollowCamera, INTRO_DURATION, FAIRY } from './camera.js?v=7';
import { FanfareAudio } from './audio.js?v=7';
import { WalkWorld, Walker, Shards, Companion, SPAWN } from './explore.js?v=7';
import { Input } from './input.js?v=8';

const STORAGE = 'castelo-estelar-settings';
const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
const LOAD_TIMEOUT = 30000;

/** Programa de fogos: [t, x, y, z, cor, tipo, escala] — o estouro acontece 1,5 s depois. */
const CUES = [
    [23.4, -30, 66, -50, 0xffc866, 'chrys', 1.0],
    [24.3, 34, 75, -40, 0xff5f86, 'peony', 1.1],
    [25.0, 2, 88, -64, 0x7ad0ff, 'ring', 1.15],
    [25.9, -52, 58, -22, 0xb58cff, 'peony', 0.9],
    [26.5, 56, 62, -58, 0xffe08a, 'willow', 1.15],
    [27.4, -14, 79, -36, 0x8affc4, 'chrys', 1.0],
    [28.1, 22, 69, -18, 0xff8a4a, 'peony', 1.0],
    [28.9, -44, 84, -66, 0xffe08a, 'willow', 1.25],
    [29.6, 46, 85, -30, 0x6fb4ff, 'ring', 1.1],
    [30.3, 0, 69, -48, 0xff6fae, 'chrys', 1.2],
    [31.0, -28, 72, -28, 0xfff0b0, 'peony', 1.0],
    [31.6, 30, 91, -60, 0xffd070, 'willow', 1.3],
    [32.5, -58, 69, -44, 0x8ad8ff, 'peony', 1.0],
    [33.2, 8, 95, -52, 0xffb060, 'chrys', 1.35],
    [34.2, 50, 66, -24, 0xd08cff, 'ring', 1.0],
    [35.0, -20, 89, -58, 0xffe6a0, 'willow', 1.35]
];
const COLORS = [0xffc866, 0xff5f86, 0x7ad0ff, 0xb58cff, 0xffe08a, 0x8affc4, 0xff8a4a, 0x6fb4ff];
const TYPES = ['peony', 'chrys', 'willow', 'ring'];
/** Final do passeio: duração (s) e ponto de vista da câmera (diante do portão, olhando a menagem). */
const FINALE = { dur: 23, from: FAIRY[0], camPos: new THREE.Vector3(12, 19, 58), camLook: new THREE.Vector3(2, 33, -2) };
/** O que cada estrela devolve ao castelo (mensagem do aviso). */
const LIGHT_MSG = [
    'as torres da muralha acenderam',
    'o salão nobre acendeu',
    'os vitrais da capela acenderam',
    'a ponte do céu acendeu',
    'agora leve a luz ao portão do castelo'
];

const fmtTime = (s) => {
    const m = Math.floor(s / 60);
    return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

class CasteloEstelar {
    constructor() {
        this.canvas = document.getElementById('scene');
        this.settings = this.loadSettings();
        this.state = 'boot';
        this.introT = 0;
        this.audio = new FanfareAudio();
        this.nextShow = 0;
        this.paused = false;
        this.finale = -1;
        this.completed = false;
        this.walkTime = 0;
        this.glow = 1;
        this.glowTarget = 1;
        this.starK = 0;
        this._look = { x: 0, y: 0, zoom: 0 };
        this._target = { x: 0, z: 0, name: '', near: 3 };
        this.shadowFocus = new THREE.Vector3();
        this.castleFocus = new THREE.Vector3(0, 14, 4);
        this.bindUi();
        this.loadTimer = setTimeout(() => this.slowLoad(), LOAD_TIMEOUT);
        this.boot().catch((err) => this.fail(err));
    }

    loadSettings() {
        const base = { quality: 'auto', volume: 72, muted: false, best: 0 };
        try {
            return { ...base, ...JSON.parse(localStorage.getItem(STORAGE) || '{}') };
        } catch {
            return base;
        }
    }

    saveSettings() {
        try { localStorage.setItem(STORAGE, JSON.stringify(this.settings)); } catch { /* privado */ }
    }

    $(id) {
        return document.getElementById(id);
    }

    bindUi() {
        // a cena monta de forma assíncrona: ignora cliques enquanto ainda está em 'boot'
        const ready = (fn) => () => { if (this.state !== 'boot') fn(); };
        const on = (id, fn) => this.$(id)?.addEventListener('click', fn);
        on('startButton', ready(() => this.start()));
        on('exploreStart', ready(() => this.startExplore()));
        on('replayButton', ready(() => this.replay()));
        on('skipButton', ready(() => this.skip()));
        on('exploreButton', ready(() => this.startExplore()));
        on('pauseButton', () => this.setPaused(true));
        on('runButton', () => this.toggleRun());
        on('muteBtn', () => this.toggleMute());
        on('resumeButton', () => this.setPaused(false));
        on('respawnButton', () => this.respawn());
        on('restartButton', () => this.enterExplore(true));
        on('orbitButton', () => this.exitExplore());
        on('introButton', () => this.replay());
        on('freeWalkButton', () => this.closeDone());
        on('doneRestart', () => this.enterExplore(true));
        on('doneOrbit', () => this.exitExplore());
        on('retryLoad', () => location.reload());
        on('lowLoad', () => {
            this.settings.quality = 'low';
            this.saveSettings();
            location.reload();
        });
        this.$('qualitySelect')?.addEventListener('change', (e) => {
            // terreno, floresta e reflexo são montados por tier: recarrega para aplicar
            this.settings.quality = e.target.value;
            this.saveSettings();
            location.reload();
        });
        this.$('volumeSlider')?.addEventListener('input', (e) => {
            this.settings.volume = Number(e.target.value);
            this.$('volumeValue').textContent = String(this.settings.volume);
            this.audio.setVolume(this.settings.volume / 100);
            this.saveSettings();
        });
        const vol = this.$('volumeSlider');
        if (vol) {
            vol.value = String(this.settings.volume);
            this.$('volumeValue').textContent = String(this.settings.volume);
        }
        const q = this.$('qualitySelect');
        if (q) q.value = this.settings.quality;
        window.addEventListener('keydown', (e) => {
            if (e.target instanceof HTMLSelectElement || e.target instanceof HTMLInputElement) return;
            if (e.repeat && e.code !== 'Space') return;
            const s = this.state;
            if (e.code === 'Space' && s === 'intro') {
                e.preventDefault();
                this.skip();
            }
            if (e.code === 'KeyR' && (s === 'intro' || s === 'orbit')) this.replay();
            if (e.code === 'KeyE' && s === 'orbit') this.startExplore();
            if (s === 'explore') {
                if (e.code === 'Escape' || e.code === 'KeyP') {
                    if (this.doneOpen) this.closeDone();
                    else if (this.finale < 0) this.setPaused(!this.paused);
                }
                if (e.code === 'KeyT' && !this.paused && this.finale < 0) this.respawn();
            }
            if (e.code === 'KeyM') this.toggleMute();
            if (e.code === 'KeyF') this.toggleFullscreen();
        });
        // perder o foco nunca deixa tecla presa nem o passeio correndo sozinho
        window.addEventListener('blur', () => this.onBlur());
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.onBlur();
                this.audio.suspend();
            } else if (!this.settings.muted) {
                this.audio.resume();
            }
        });
    }

    onBlur() {
        this.input?.clear();
        if (this.state === 'explore' && !this.paused && this.finale < 0 && !this.doneOpen) this.setPaused(true);
    }

    slowLoad() {
        if (this.state !== 'boot') return;
        const label = this.$('loadText');
        if (label) label.textContent = 'Está demorando mais que o normal. A conexão ou a placa de vídeo podem estar lentas.';
        this.show('#loadRetry');
    }

    progress(k, text) {
        const bar = this.$('loadBar');
        if (bar) bar.style.transform = `scaleX(${Math.min(1, k).toFixed(3)})`;
        const track = bar?.parentElement;
        if (track) track.setAttribute('aria-valuenow', String(Math.round(Math.min(1, k) * 100)));
        const label = this.$('loadText');
        if (label && text) label.textContent = text;
    }

    async boot() {
        const manager = new THREE.LoadingManager();
        manager.onProgress = (_, loaded, total) => this.progress(0.1 + 0.7 * (loaded / Math.max(total, 1)), 'Carregando pedra, ardósia e floresta…');
        const forced = params.get('q');
        const stage = createStage({
            canvas: this.canvas,
            tier: ['low', 'medium', 'high'].includes(forced) ? forced : this.settings.quality,
            preset: 'noite-lua',
            fov: 32,
            near: 0.3,
            shadowRadius: 78,
            adaptive: !DEBUG,
            loadingManager: manager
        });
        if (!stage) {
            clearTimeout(this.loadTimer);
            this.hide('#loadingOverlay');
            return;
        }
        this.stage = stage;
        const P = stage.pipeline.params;
        // noite legível sem estourar: exposição menor que a do preset, bloom contido, névoa rasteira
        Object.assign(P, {
            exposure: 1.9, bloom: 0.08, fogDensity: 0.0055, fogFalloff: 0.075, haze: 0.00022, fogSunGlow: 0.5,
            vignette: 0.44, grain: 0.02, saturation: 0.9, contrast: 1.06, ao: 0.7, rays: 0.3, dofMax: 0.8
        });
        stage.fill.intensity = 0.62;
        stage.focus = this.castleFocus;
        this.exposure = P.exposure;

        this.progress(0.1, 'Erguendo o penhasco…');
        // a floresta só termina de assar os impostores se for atualizada durante o loading
        let kingdomRef = null;
        const pump = setInterval(() => {
            const k = kingdomRef;
            if (!k) return;
            k.terrain.update(stage.camera);
            k.forest.update(stage.camera);
        }, 60);
        this.cine = new CineCamera(stage.camera, this.canvas, (x, z) => this.kingdom?.terrain.heightAt(x, z) ?? 0);
        this.cine.apply(INTRO_DURATION);
        stage.camera.updateMatrixWorld();
        try {
            this.kingdom = await createKingdom(stage, (k) => { kingdomRef = k; });
        } finally {
            clearInterval(pump);
        }
        const K = this.kingdom;

        this.magic = new Magic(stage.scene, { tier: stage.tier, star: K.star, donjon: K.donjon });
        this.magic.placeFireflies(K.terrain);
        this.magic.setCues(CUES);
        this.magic.onBurst = (type, dist) => {
            if (!this.quietBurst) this.audio.firework(Math.min(0.6, dist / 340));
        };

        // passeio: chão, princesa, estrelas, fada, câmera de ombro e controles
        this.progress(0.86, 'Chamando a princesa…');
        this.walk = new WalkWorld(K);
        this.walker = new Walker(stage.scene, this.walk, { detail: stage.tier === 'low' ? 1 : 2 });
        this.walker.spawn(SPAWN.x, SPAWN.z, SPAWN.heading);
        this.shards = new Shards(stage.scene, this.walk);
        this.companion = new Companion(stage.scene, { light: stage.tier !== 'low' });
        this.follow = new FollowCamera(stage.camera, (x, z) => this.walk.floorAt(x, z));
        this.input = new Input(this.canvas, { zone: this.$('stickZone'), base: this.$('stickBase'), knob: this.$('stickKnob') });
        this.guide = new Guide(this.$('guide'));
        this.hidden = [...K.reflectionHidden, ...this.magic.reflectionHidden, this.shards.group];

        this.fit();
        new ResizeObserver(() => this.fit()).observe(this.canvas);

        this.progress(0.92, 'Acendendo as torres…');
        this.applyTimeline(INTRO_DURATION);
        K.update(0.016, 0, stage.camera);
        this.companion.setOn(true);
        await stage.warmup();
        // compilados: princesa, estrelas e fada ficam guardadas até o passeio
        this.walker.root.visible = false;
        this.shards.group.visible = false;
        this.companion.setOn(false);
        this.progress(1);

        clearTimeout(this.loadTimer);
        this.hide('#loadingOverlay');
        this.show('#intro');
        this.setState('menu');
        stage.start((dt, t) => this.frame(dt, t));
        if (DEBUG) this.debugApi();
    }

    setState(s) {
        this.state = s;
        document.body.dataset.state = s === 'explore' && this.paused ? 'paused' : s;
        this.syncDock();
    }

    /** Botões do dock por estado (o CSS esconde "Correr" com mouse). */
    syncDock() {
        const s = this.state;
        const vis = {
            skipButton: s === 'intro',
            exploreButton: s === 'orbit',
            replayButton: s === 'orbit',
            pauseButton: s === 'explore',
            runButton: s === 'explore'
        };
        for (const [id, v] of Object.entries(vis)) {
            const el = this.$(id);
            if (el) el.hidden = !v;
        }
        const quest = this.$('quest');
        if (quest) quest.hidden = s !== 'explore';
        const hint = this.$('hint');
        if (hint && s === 'orbit') {
            hint.textContent = matchMedia('(pointer: coarse)').matches
                ? 'Arraste para orbitar · “Recolher estrelas” começa o passeio'
                : 'Arraste para orbitar · rolagem aproxima · E ou “Recolher estrelas” começa o passeio';
        }
    }

    fit() {
        const cam = this.stage.camera;
        cam.aspect = this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight);
        this.cine.fitAspect();
        cam.updateProjectionMatrix();
    }

    fail(err) {
        console.error(err);
        clearTimeout(this.loadTimer);
        this.hide('#loadingOverlay');
        const ov = this.$('errorOverlay');
        const text = this.$('errorText');
        if (text && err) text.textContent = String(err.message || err);
        if (ov) ov.hidden = false;
    }

    /** Primeiro gesto: áudio liberado com o volume salvo. */
    unlockAudio() {
        this.audio.setVolume(this.settings.volume / 100);
        this.audio.setEnabled(!this.settings.muted);
        this.syncMute();
    }

    start() {
        this.hide('#intro');
        this.unlockAudio();
        this.show('#hud');
        this.replay();
    }

    replay() {
        if (this.state === 'explore') this.exitExplore(false);
        this.magic.reset();
        this.cine.playIntro();
        this.introT = 0;
        this.setState('intro');
        this.hide('#titleCard');
        this.audio.playFanfare();
    }

    skip() {
        if (this.state !== 'intro') return;
        this.audio.stopScheduled();
        this.cine.skip();
        this.introT = INTRO_DURATION;
        this.finishIntro();
    }

    finishIntro() {
        this.setState('orbit');
        this.show('#titleCard');
        this.nextShow = 2.5;
        this.flashHint(6500);
    }

    flashHint(ms) {
        const hint = this.$('hint');
        if (!hint) return;
        hint.classList.remove('is-gone');
        clearTimeout(this.hintTimer);
        this.hintTimer = setTimeout(() => hint.classList.add('is-gone'), ms);
    }

    // ------------------------------------------------------------------ passeio

    startExplore() {
        if (this.state === 'menu') {
            this.hide('#intro');
            this.unlockAudio();
            this.show('#hud');
        }
        if (this.state === 'intro') this.audio.stopScheduled();
        this.enterExplore(!this.walkStarted);
    }

    /** reset = recomeça do zero (estrelas, tempo, posição). */
    enterExplore(reset = true) {
        this.hide('#pauseOverlay');
        this.hide('#doneOverlay');
        this.hide('#titleCard');
        this.doneOpen = false;
        this.paused = false;
        this.finale = -1;
        this.follow.override = null;
        this.cine.controls.enabled = false;
        this.cine.controls.autoRotate = false;
        if (reset) {
            this.walkStarted = true;
            this.completed = false;
            this.walkTime = 0;
            this.shards.reset();
            this.magic.reset();
            this.walker.spawn(SPAWN.x, SPAWN.z, SPAWN.heading);
            this.glowTarget = 0.1;
            this.starK = 0;
            this.updateQuest();
        }
        this.walker.root.visible = true;
        this.shards.group.visible = true;
        this.companion.setOn(true);
        this.companion.place(this.walker.x, this.walker.y, this.walker.z);
        this.follow.snap(this.walker.x, this.walker.y, this.walker.z, this.walker.heading);
        this.stage.focus = this.shadowFocus.set(this.walker.x, this.walker.y, this.walker.z);
        this.stage.shadowRadius = 40;
        this.stage.pipeline.params.dofMax = 0.35;
        this.stage.pipeline.params.fade = 1;
        this.input.setEnabled(true);
        this.setState('explore');
        const touch = matchMedia('(pointer: coarse)').matches;
        this.toast(reset
            ? (touch ? 'Polegar esquerdo anda · arraste à direita para olhar. Siga a luz dourada.' : 'WASD ou setas andam · Shift corre · arraste para olhar. Siga a luz dourada.')
            : 'De volta ao passeio.', 6500);
    }

    /** Sai do passeio para a órbita contemplativa (o progresso fica guardado). */
    exitExplore(toOrbit = true) {
        this.input.setEnabled(false);
        this.hide('#pauseOverlay');
        this.hide('#doneOverlay');
        this.doneOpen = false;
        this.paused = false;
        this.finale = -1;
        this.walker.root.visible = false;
        this.shards.group.visible = false;
        this.companion.setOn(false);
        this.guide.hide();
        this.stage.focus = this.castleFocus;
        this.stage.shadowRadius = 78;
        this.stage.pipeline.params.dofMax = 0.8;
        this.follow.override = null;
        if (toOrbit) {
            this.cine.enterOrbit();
            this.cine.fitAspect();
            this.setState('orbit');
            this.nextShow = 1.5;
            this.flashHint(5000);
        }
    }

    setPaused(on) {
        if (this.state !== 'explore' || this.doneOpen || this.finale >= 0) return;
        this.paused = on;
        this.input.clear();
        this.input.setEnabled(!on);
        if (on) {
            const st = this.$('pauseStats');
            if (st) st.textContent = `${this.shards.count}/${this.shards.total} estrelas · ${fmtTime(this.walkTime)}`;
            this.show('#pauseOverlay');
            this.$('resumeButton')?.focus({ preventScroll: true });
        } else {
            this.hide('#pauseOverlay');
        }
        this.setState('explore');
    }

    /** Volta à última estrela recolhida (ou ao início): a saída de qualquer enrosco. */
    respawn() {
        if (this.state !== 'explore') return;
        const cp = this.shards.checkpoint();
        if (cp) {
            // um passo para trás da estrela, virada para a próxima
            const nx = this.shards.next(cp.x, cp.z);
            const h = nx ? Math.atan2(nx.x - cp.x, nx.z - cp.z) : this.walker.heading;
            this.walker.spawn(cp.x, cp.z, h);
        } else {
            this.walker.spawn(SPAWN.x, SPAWN.z, SPAWN.heading);
        }
        this.companion.place(this.walker.x, this.walker.y, this.walker.z);
        this.follow.snap(this.walker.x, this.walker.y, this.walker.z, this.walker.heading);
        if (this.paused) this.setPaused(false);
        this.toast('De volta à trilha.', 2200);
    }

    toggleRun() {
        this.input.runToggle = !this.input.runToggle;
        const b = this.$('runButton');
        if (b) {
            b.setAttribute('aria-pressed', this.input.runToggle ? 'true' : 'false');
            b.textContent = this.input.runToggle ? 'Correndo' : 'Correr';
        }
    }

    collect(s) {
        const n = this.shards.count;
        const total = this.shards.total;
        this.audio.pickup(n);
        this.quietBurst = true;
        this.magic.burst(s.x, s.y + 1.2, s.z, 0xffd890, 'star', 0.13);
        this.quietBurst = false;
        navigator.vibrate?.(30);
        this.updateQuest();
        if (s.final) {
            this.startFinale();
            return;
        }
        this.glowTarget = 0.1 + 0.5 * (n / (total - 1));
        this.toast(`Estrela ${n}/${total} — ${LIGHT_MSG[Math.min(LIGHT_MSG.length - 1, n - 1)]}.`, 3800);
    }

    updateQuest() {
        const n = this.shards.count;
        const total = this.shards.total;
        const c = this.$('questCount');
        if (c) c.textContent = `${n}/${total}`;
        const g = this.$('questGoal');
        if (g) g.textContent = n >= total ? 'o reino acendeu' : this.shards.unlocked ? 'leve a luz ao portão' : 'estrelas caídas';
        const pips = this.$('questPips');
        if (pips) {
            if (pips.children.length !== total) pips.innerHTML = '<i></i>'.repeat(total);
            [...pips.children].forEach((p, i) => p.classList.toggle('is-on', i < n));
        }
    }

    startFinale() {
        this.finale = 0;
        this.input.clear();
        this.input.setEnabled(false);
        this.magic.reset();
        this.magic.cueIndex = 0;
        while (this.magic.cueIndex < CUES.length && CUES[this.magic.cueIndex][0] < FINALE.from) this.magic.cueIndex++;
        this.audio.finale();
        this.guide.hide();
        this.companion.setOn(false);
        this.follow.override = { pos: FINALE.camPos, look: FINALE.camLook, k: 0 };
        this.toast('A fada leva a última estrela até a torre…', 4200);
    }

    finishWalk() {
        this.finale = -1;
        this.completed = true;
        this.follow.override = null;
        this.companion.setOn(true);
        this.companion.place(this.walker.x, this.walker.y, this.walker.z);
        const t = this.walkTime;
        const best = this.settings.best;
        const record = !best || t < best;
        if (record) {
            this.settings.best = t;
            this.saveSettings();
        }
        const txt = this.$('doneText');
        if (txt) {
            txt.textContent = `Você devolveu as ${this.shards.total} estrelas em ${fmtTime(t)}. `
                + (record ? (best ? 'Novo recorde!' : 'Primeiro recorde registrado.') : `Recorde: ${fmtTime(best)}.`);
        }
        this.doneOpen = true;
        this.show('#doneOverlay');
        this.$('freeWalkButton')?.focus({ preventScroll: true });
        this.nextShow = 3;
    }

    closeDone() {
        this.doneOpen = false;
        this.hide('#doneOverlay');
        this.input.setEnabled(true);
        this.toast('Passeio livre: os fogos seguem no céu. Pausa (Esc) para sair.', 4200);
    }

    toast(text, ms = 3000) {
        const el = this.$('toast');
        if (!el) return;
        el.textContent = text;
        el.classList.add('is-on');
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => el.classList.remove('is-on'), ms);
    }

    // ------------------------------------------------------------------ áudio, tela

    toggleMute() {
        this.settings.muted = !this.settings.muted;
        this.audio.setEnabled(!this.settings.muted);
        this.saveSettings();
        this.syncMute();
    }

    syncMute() {
        const btn = this.$('muteBtn');
        if (btn) {
            btn.setAttribute('aria-pressed', this.settings.muted ? 'true' : 'false');
            btn.textContent = this.settings.muted ? 'Mudo' : 'Som';
        }
    }

    toggleFullscreen() {
        // iOS Safari não tem Fullscreen API para páginas — no-op silencioso.
        const root = document.documentElement;
        const can = Boolean(document.fullscreenEnabled || document.webkitFullscreenEnabled)
            && typeof (root.requestFullscreen || root.webkitRequestFullscreen) === 'function';
        if (!can) return;
        const isFull = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
        try {
            if (isFull) {
                const exit = document.exitFullscreen || document.webkitExitFullscreen;
                exit?.call(document)?.catch?.(() => {});
            } else {
                const enter = root.requestFullscreen || root.webkitRequestFullscreen;
                enter?.call(root)?.catch?.(() => {});
            }
        } catch { /* ignore */ }
    }

    /** Tudo o que depende só do tempo da abertura (serve também ao seek de depuração). */
    applyTimeline(t) {
        const K = this.kingdom;
        const glow = 0.16 * smoothstep(8, 13, t) + 0.84 * smoothstep(22.6, 26.5, t);
        K.setGlow(glow);
        K.castle.setStar(smoothstep(22.9, 23.6, t));
        const P = this.stage.pipeline.params;
        // fade-in do preto no primeiro segundo
        P.fade = smoothstep(0, 1.4, t);
        // o olho fecha um pouco quando o castelo acende
        P.exposure = this.exposure * (1 - 0.12 * glow);
        this.glow = glow;
    }

    frame(dt, time) {
        try {
            this.tick(dt, time);
        } catch (err) {
            // um quadro com erro não derruba o laço; registra só a primeira vez
            if (!this.frameError) {
                this.frameError = true;
                console.error(err);
            }
        }
    }

    tick(dt, time) {
        const stage = this.stage;
        const K = this.kingdom;
        const P = stage.pipeline.params;
        const frozen = this.state === 'explore' && (this.paused || this.doneOpen);

        if (this.state === 'explore') {
            this.exploreTick(dt, time);
        } else if (this.state === 'intro') {
            this.cine.tick(dt);
            this.introT = this.cine.t;
            this.applyTimeline(this.introT);
            this.magic.intro(this.introT, dt, FAIRY);
            if (this.introT >= 34.5) this.show('#titleCard');
            if (this.cine.mode === 'orbit') this.finishIntro();
        } else {
            if (this.state === 'menu') {
                // fundo do menu: castelo aceso, giro lento
                this.menuAngle = (this.menuAngle ?? 0) + dt * 0.02;
                const a = 0.25 + Math.sin(this.menuAngle * 3) * 0.2;
                stage.camera.position.set(Math.sin(a) * 120, 13, Math.cos(a) * 120);
                stage.camera.lookAt(2, 30, 0);
            } else {
                this.cine.tick(dt);
            }
            this.applyTimeline(INTRO_DURATION);
            this.showTick(dt, this.state === 'orbit');
        }

        // DOF: foco no alvo; na órbita a faixa abre (quase tudo nítido); no passeio, a princesa
        if (this.state === 'explore') {
            const f = this.follow.focus;
            P.dofFocus = f;
            P.dofRange = f * 4 + 30;
        } else {
            const focus = this.state === 'menu' ? 120 : this.cine.focus;
            P.dofFocus = focus;
            P.dofRange = this.state === 'intro' ? focus * 0.9 : focus * 1.6;
        }

        if (!frozen || this.doneOpen) this.magic.update(dt, time, stage.camera);
        K.update(dt, time, stage.camera);
        K.lake.uniforms.uFlash.value.copy(this.magic.flash);
        K.lake.uniforms.uFlashPos.value.copy(this.magic.flashPos);
        // o 1º quadro ainda não tem mapa de sombra: o reflexo começa no 3º
        if ((this.frames = (this.frames ?? 0) + 1) > 2) K.lake.renderReflection(stage.scene, stage.camera, this.hidden);
        this.reflStats = stage.renderer.info.render.triangles;
    }

    /** Fogos esparsos (órbita e passeio concluído). */
    showTick(dt, on) {
        this.nextShow -= dt;
        if (this.nextShow <= 0 && on) {
            this.nextShow = 2.2 + Math.random() * 3.5;
            this.magic.launch((Math.random() - 0.5) * 120, 62 + Math.random() * 34, -20 - Math.random() * 50,
                COLORS[(Math.random() * COLORS.length) | 0], TYPES[(Math.random() * TYPES.length) | 0], 0.9 + Math.random() * 0.4);
        }
    }

    exploreTick(dt, time) {
        const W = this.walker;
        const look = this.input.consumeLook(this._look);
        const active = !this.paused && !this.doneOpen && this.finale < 0;
        let target = null;
        if (active) {
            this.follow.look(look.x, look.y, look.zoom);
            const info = W.update(dt, this.input.readMove(), this.follow.yaw);
            if (info.step) this.audio.step(info.surface);
            if (!this.completed) this.walkTime += dt;
            const hit = this.shards.update(dt, time, W.x, W.y, W.z);
            if (hit) this.collect(hit);
            if (W.stuck > 2.5 && !this.stuckWarned) {
                this.stuckWarned = true;
                this.toast('Sem passagem por aqui. Contorne, ou use “Voltar à trilha” (T) na pausa.', 4500);
            } else if (W.stuck === 0) {
                this.stuckWarned = false;
            }
            const s = this.finale < 0 ? this.shards.next(W.x, W.z) : null;
            if (s) {
                target = this.shards.steer(s, W.x, W.z, this._target);
                target.name = s.name;
            }
            if (this.completed) this.showTick(dt, true);
        } else if (this.finale >= 0 && !this.paused) {
            // final: a fada refaz o voo da abertura, a estrela acende, fogos; a câmera sobe para ver
            this.finale += dt;
            const f = this.finale;
            const ft = FINALE.from + f;
            this.magic.intro(ft, dt, FAIRY);
            if (this.follow.override) this.follow.override.k = smoothstep(0, 3.2, f) * (1 - smoothstep(FINALE.dur - 2.5, FINALE.dur, f));
            this.glowTarget = 0.6 + 0.4 * smoothstep(9.4, 13.4, f);
            this.starK = smoothstep(9.7, 10.4, f);
            W.speed = 0;
            W.animate(dt, f > 9.8 ? 'cheer' : 'idle');
            if (f >= FINALE.dur) this.finishWalk();
        } else if (this.doneOpen) {
            W.animate(dt, 'cheer');
            this.showTick(dt, true);
        }
        this.follow.update(active || this.finale >= 0 ? dt : 0, W.x, W.y, W.z, W.heading, W.speed);
        this.companion.update(dt, time, W, target);
        if (active) this.guide.update(this.stage.camera, W.x, W.z, target);
        else this.guide.hide();

        // luz do castelo: cresce com as estrelas (amortecida)
        this.glow += (this.glowTarget - this.glow) * (1 - Math.exp(-1.5 * dt));
        const K = this.kingdom;
        K.setGlow(this.glow);
        K.castle.setStar(this.starK);
        const P = this.stage.pipeline.params;
        P.fade = 1;
        P.exposure = this.exposure * (1 - 0.12 * this.glow);
        this.shadowFocus.set(W.x, W.y, W.z);
    }

    show(sel) {
        const el = document.querySelector(sel);
        if (el) el.hidden = false;
    }

    hide(sel) {
        const el = document.querySelector(sel);
        if (el) el.hidden = true;
    }

    /** API de depuração (?debug=1). */
    debugApi() {
        const self = this;
        window.__lab = {
            app: this,
            /** Pula para o tempo t da abertura, simulando os 7 s anteriores de efeitos. */
            seek(t, hold = true) {
                if (self.state === 'menu') self.start();
                self.magic.reset();
                self.setState('intro');
                self.cine.mode = 'intro';
                self.cine.controls.enabled = false;
                const t0 = Math.max(0, t - 7);
                while (self.magic.cueIndex < CUES.length && CUES[self.magic.cueIndex][0] < t0) self.magic.cueIndex++;
                for (let s = t0; s < t; s += 1 / 30) {
                    self.cine.apply(s);
                    self.magic.intro(s, 1 / 30, FAIRY);
                    self.magic.update(1 / 30, s, self.stage.camera);
                }
                self.cine.t = t;
                self.cine.apply(t);
                self.hold = hold;
                if (hold) {
                    // congela o tempo da abertura (os efeitos seguem)
                    const tick = self.cine.tick.bind(self.cine);
                    self.cine.tick = (dt) => { tick(0); };
                }
                return t;
            },
            /** Órbita livre em (azimute°, elevação°, distância). */
            orbit(az, el, dist) {
                delete self.cine.tick;
                if (self.state === 'menu') self.start();
                self.skip();
                self.setState('orbit');
                const c = self.cine.controls;
                c.autoRotate = false;
                const a = (az * Math.PI) / 180;
                const e = (el * Math.PI) / 180;
                self.stage.camera.position.set(c.target.x + Math.sin(a) * Math.cos(e) * dist, c.target.y + Math.sin(e) * dist, c.target.z + Math.cos(a) * Math.cos(e) * dist);
                c.update();
                return 1;
            },
            /** Entra no passeio; com (x, z) teleporta a princesa. */
            explore(x, z, heading = 0) {
                if (self.state !== 'explore') self.startExplore();
                if (x != null) {
                    self.walker.spawn(x, z, heading);
                    self.follow.snap(self.walker.x, self.walker.y, self.walker.z, heading);
                }
                return { x: self.walker.x, y: self.walker.y, z: self.walker.z };
            },
            /**
             * Caminha (simulação a 30 Hz, sem desenhar) de estrela em estrela, em linha reta.
             * Devolve, por trecho, se chegou, em quantos segundos e onde parou.
             */
            route(sprint = false) {
                if (self.state !== 'explore') self.startExplore();
                self.enterExplore(true);
                const W = self.walker;
                const out = [];
                const move = { x: 0, y: 0, sprint };
                for (const s of self.shards.items) {
                    let t = 0;
                    let got = false;
                    const aim = { x: 0, z: 0 };
                    while (t < 90 && !got) {
                        // câmera sempre atrás: "frente" do direcional = rumo da bússola
                        self.shards.steer(s, W.x, W.z, aim);
                        const yaw = Math.atan2(W.x - aim.x, W.z - aim.z);
                        move.y = 1;
                        W.update(1 / 30, move, yaw);
                        t += 1 / 30;
                        const hit = self.shards.update(1 / 30, t, W.x, W.y, W.z);
                        if (hit) got = true;
                    }
                    out.push({ name: s.name, got, t: +t.toFixed(1), at: [+W.x.toFixed(1), +W.y.toFixed(1), +W.z.toFixed(1)] });
                    if (!got) break;
                }
                self.updateQuest();
                return JSON.stringify(out);
            },
            stats() {
                const s = self.stage.stats();
                return JSON.stringify({ ...s, reflectionTriangles: self.reflStats, sparks: self.magic.sp.n });
            },
            /** Histograma de luminância do quadro: % de pixels ≥ 250, ≥ 235 e média (0–255). */
            histogram() {
                self.stage.render(0);
                const c = document.createElement('canvas');
                c.width = 320;
                c.height = 180;
                const g = c.getContext('2d');
                g.drawImage(self.canvas, 0, 0, 320, 180);
                const d = g.getImageData(0, 0, 320, 180).data;
                let hot = 0;
                let warm = 0;
                let sum = 0;
                for (let i = 0; i < d.length; i += 4) {
                    const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
                    sum += l;
                    if (l >= 250) hot++;
                    if (l >= 235) warm++;
                }
                const n = d.length / 4;
                return JSON.stringify({ pct250: +(100 * hot / n).toFixed(2), pct235: +(100 * warm / n).toFixed(2), mean: +(sum / n).toFixed(1) });
            }
        };
    }
}

new CasteloEstelar();
