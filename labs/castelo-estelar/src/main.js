/**
 * Castelo Estelar — palco (kit gfx), abertura cinematográfica e órbita livre.
 *
 * Linha do tempo da abertura (s), tudo função de `introT`:
 *   janelas     glow = 0,16·smoothstep(8, 13) + 0,84·smoothstep(22,6, 26,5)
 *               (poucas janelas na revelação; o castelo inteiro acende quando a fada toca a estrela)
 *   estrela     smoothstep(22,9, 23,6)
 *   letterbox   barras 2,39:1 entram em 1,2 s e saem entre 35 e 38 s
 *   foco (DOF)  distância ao alvo da câmera; faixa = 0,9·foco (abre na órbita)
 *
 * Depuração: ?debug=1 expõe window.__lab (seek, orbit, stats, histogram); ?q=low|medium|high força o tier.
 */

import * as THREE from 'three';
import { createStage } from '../../shared/gfx/stage.js';
import { smoothstep } from '../../shared/gfx/core.js';
import { createKingdom } from './world.js?v=6';
import { Magic } from './effects.js?v=6';
import { CineCamera, INTRO_DURATION, FAIRY } from './camera.js?v=6';
import { FanfareAudio } from './audio.js?v=6';

const STORAGE = 'castelo-estelar-settings';
const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');

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

class CasteloEstelar {
    constructor() {
        this.canvas = document.getElementById('scene');
        this.settings = this.loadSettings();
        this.state = 'boot';
        this.introT = 0;
        this.audio = new FanfareAudio();
        this.nextShow = 0;
        this.bindUi();
        this.boot().catch((err) => this.fail(err));
    }

    loadSettings() {
        try {
            return { quality: 'auto', volume: 72, muted: false, ...JSON.parse(localStorage.getItem(STORAGE) || '{}') };
        } catch {
            return { quality: 'auto', volume: 72, muted: false };
        }
    }

    saveSettings() {
        try { localStorage.setItem(STORAGE, JSON.stringify(this.settings)); } catch { /* privado */ }
    }

    bindUi() {
        // a cena monta de forma assíncrona: ignora cliques enquanto ainda está em 'boot'
        const ready = (fn) => () => { if (this.state !== 'boot') fn(); };
        document.getElementById('startButton')?.addEventListener('click', ready(() => this.start()));
        document.getElementById('replayButton')?.addEventListener('click', ready(() => this.replay()));
        document.getElementById('skipButton')?.addEventListener('click', ready(() => this.skip()));
        document.getElementById('muteBtn')?.addEventListener('click', () => this.toggleMute());
        document.getElementById('qualitySelect')?.addEventListener('change', (e) => {
            // terreno, floresta e reflexo são montados por tier: recarrega para aplicar
            this.settings.quality = e.target.value;
            this.saveSettings();
            location.reload();
        });
        document.getElementById('volumeSlider')?.addEventListener('input', (e) => {
            this.settings.volume = Number(e.target.value);
            document.getElementById('volumeValue').textContent = String(this.settings.volume);
            this.audio.setVolume(this.settings.volume / 100);
            this.saveSettings();
        });
        const vol = document.getElementById('volumeSlider');
        if (vol) {
            vol.value = String(this.settings.volume);
            document.getElementById('volumeValue').textContent = String(this.settings.volume);
        }
        const q = document.getElementById('qualitySelect');
        if (q) q.value = this.settings.quality;
        window.addEventListener('keydown', (e) => {
            if (e.target instanceof HTMLSelectElement || e.target instanceof HTMLInputElement) return;
            if (e.code === 'Space' && this.state === 'intro') {
                e.preventDefault();
                this.skip();
            }
            if (e.code === 'KeyR' && (this.state === 'intro' || this.state === 'orbit')) this.replay();
            if (e.code === 'KeyM') this.toggleMute();
            if (e.code === 'KeyF') this.toggleFullscreen();
        });
    }

    progress(k, text) {
        const bar = document.getElementById('loadBar');
        if (bar) bar.style.transform = `scaleX(${Math.min(1, k).toFixed(3)})`;
        const label = document.getElementById('loadText');
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
            near: 0.4,
            shadowRadius: 78,
            adaptive: !DEBUG,
            loadingManager: manager
        });
        if (!stage) {
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
        stage.focus = new THREE.Vector3(0, 14, 4);
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
        this.kingdom = await createKingdom(stage, (k) => { kingdomRef = k; });
        clearInterval(pump);
        const K = this.kingdom;

        this.magic = new Magic(stage.scene, { tier: stage.tier, star: K.star, donjon: K.donjon });
        this.magic.placeFireflies(K.terrain);
        this.magic.setCues(CUES);
        this.magic.onBurst = (type, dist) => this.audio.firework(Math.min(0.6, dist / 340));
        this.hidden = [...K.reflectionHidden, ...this.magic.reflectionHidden];

        this.fit();
        new ResizeObserver(() => this.fit()).observe(this.canvas);

        this.progress(0.92, 'Acendendo as torres…');
        this.applyTimeline(INTRO_DURATION);
        K.update(0.016, 0, stage.camera);
        await stage.warmup();
        this.progress(1);

        this.hide('#loadingOverlay');
        this.show('#intro');
        document.body.dataset.state = 'menu';
        this.state = 'menu';
        stage.start((dt, t) => this.frame(dt, t));
        if (DEBUG) this.debugApi();
    }

    fit() {
        const cam = this.stage.camera;
        cam.aspect = this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight);
        this.cine.fitAspect();
    }

    fail(err) {
        console.error(err);
        this.hide('#loadingOverlay');
        const ov = document.getElementById('errorOverlay');
        const text = document.getElementById('errorText');
        if (text && err) text.textContent = String(err.message || err);
        if (ov) ov.hidden = false;
    }

    start() {
        this.hide('#intro');
        this.audio.setVolume(this.settings.volume / 100);
        this.audio.setEnabled(!this.settings.muted);
        this.show('#hud');
        this.syncMute();
        this.replay();
    }

    replay() {
        this.magic.reset();
        this.cine.playIntro();
        this.introT = 0;
        this.state = 'intro';
        document.body.dataset.state = 'intro';
        this.show('#skipButton');
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
        this.state = 'orbit';
        document.body.dataset.state = 'orbit';
        this.hide('#skipButton');
        this.show('#titleCard');
        this.nextShow = 2.5;
        document.getElementById('hint')?.classList.remove('is-gone');
        clearTimeout(this.hintTimer);
        this.hintTimer = setTimeout(() => document.getElementById('hint')?.classList.add('is-gone'), 5200);
    }

    toggleMute() {
        this.settings.muted = !this.settings.muted;
        this.audio.setEnabled(!this.settings.muted);
        this.saveSettings();
        this.syncMute();
    }

    syncMute() {
        const btn = document.getElementById('muteBtn');
        if (btn) {
            btn.setAttribute('aria-pressed', this.settings.muted ? 'true' : 'false');
            btn.textContent = this.settings.muted ? 'Mudo' : 'Som';
        }
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
        else document.exitFullscreen?.();
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
    }

    frame(dt, time) {
        const stage = this.stage;
        const K = this.kingdom;
        const P = stage.pipeline.params;
        this.cine.tick(dt);

        if (this.state === 'intro') {
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
            }
            this.applyTimeline(INTRO_DURATION);
            // fogos esparsos depois da abertura
            this.nextShow -= dt;
            if (this.nextShow <= 0 && this.state === 'orbit') {
                this.nextShow = 2.2 + Math.random() * 3.5;
                this.magic.launch((Math.random() - 0.5) * 120, 62 + Math.random() * 34, -20 - Math.random() * 50,
                    COLORS[(Math.random() * COLORS.length) | 0], TYPES[(Math.random() * TYPES.length) | 0], 0.9 + Math.random() * 0.4);
            }
        }

        // DOF: foco no alvo; na órbita a faixa abre (quase tudo nítido)
        const focus = this.state === 'menu' ? 120 : this.cine.focus;
        P.dofFocus = focus;
        P.dofRange = this.state === 'intro' ? focus * 0.9 : focus * 1.6;

        this.magic.update(dt, time, stage.camera);
        K.update(dt, time, stage.camera);
        K.lake.uniforms.uFlash.value.copy(this.magic.flash);
        K.lake.uniforms.uFlashPos.value.copy(this.magic.flashPos);
        // o 1º quadro ainda não tem mapa de sombra: o reflexo começa no 3º
        if ((this.frames = (this.frames ?? 0) + 1) > 2) K.lake.renderReflection(stage.scene, stage.camera, this.hidden);
        this.reflStats = stage.renderer.info.render.triangles;
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
                self.state = 'intro';
                document.body.dataset.state = 'intro';
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
                self.state = 'orbit';
                const c = self.cine.controls;
                c.autoRotate = false;
                const a = (az * Math.PI) / 180;
                const e = (el * Math.PI) / 180;
                self.stage.camera.position.set(c.target.x + Math.sin(a) * Math.cos(e) * dist, c.target.y + Math.sin(e) * dist, c.target.z + Math.cos(a) * Math.cos(e) * dist);
                c.update();
                return 1;
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
