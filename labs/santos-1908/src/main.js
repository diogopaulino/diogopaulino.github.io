/**
 * Santos, 1908 — orquestrador.
 * Contrato dos módulos: create(ctx, world) → { update(t, dt, camera) }.
 * Um módulo que falha no boot ou no update é registrado e pulado; o filme segue.
 *
 * Tempo: `filmT` (0–180 s) é a única fonte de verdade — todo movimento é função de t,
 * então seek/replay reproduzem o mesmo quadro.
 */
import * as THREE from 'three';
import { pickTier, detectSoftwareGL } from '../../shared/gfx/core.js';
import { configureTextures } from '../../shared/gfx/textures.js';
import { createPipeline } from '../../shared/gfx/post.js';
import { createSunRig } from '../../shared/gfx/rig.js';
import { updateWind } from '../../shared/gfx/flora.js';
import { QUALITY, FILM_DURATION, CHAPTERS, CAPTIONS, chapterAt, storyClock, kasatoPose } from './config.js';
import { createMats } from './kit.js';
import { createWorld } from './world.js';
import { createKasato } from './kasato.js';
import { createPort } from './port.js';
import { createCity } from './city.js';
import { createRail } from './rail.js';
import { createVessels } from './vessels.js';
import { createLife } from './life.js';
import { createCamera } from './camera.js';
import { createAudio } from './audio.js';

const STORAGE = 'santos-1908-settings';
const $ = (id) => document.getElementById(id);
const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
/** Hora do dia (segundos desde 0h) → "9:29:41". */
const clockText = (sec) => {
    const s = Math.floor(sec);
    return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
const RATES = [1, 2, 0.5];
const BOOT_TIMEOUT_MS = 30000;

const BUILDERS = [
    ['kasato', createKasato],
    ['port', createPort],
    ['city', createCity],
    ['rail', createRail],
    ['vessels', createVessels],
    ['life', createLife]
];

class Santos1908 {
    constructor() {
        this.canvas = $('scene');
        this.settings = this.loadSettings();
        const q = new URLSearchParams(location.search).get('q');
        if (q && QUALITY[q]) this.settings.quality = q;
        this.state = 'boot';
        this.modules = [];
        this.failed = [];
        this.last = 0;
        this.fpsAcc = 0;
        this.fpsN = 0;
        this.fps = 0;
        this.focus = new THREE.Vector3();
        this.pose = {};
        this.bindUi();
        // Carregamento nunca infinito: passou do limite, mostra o erro com "tentar de novo".
        this._watchdog = setTimeout(() => {
            if (this.state === 'boot') this.fail(new Error('O porto demorou demais para carregar. Tente de novo ou use a qualidade Leve.'));
        }, BOOT_TIMEOUT_MS);
        this.boot();
    }

    loadSettings() {
        const base = { quality: 'auto', volume: 70, muted: false, rate: 1 };
        try {
            return { ...base, ...JSON.parse(localStorage.getItem(STORAGE) || '{}') };
        } catch {
            return base;
        }
    }

    saveSettings() {
        try {
            localStorage.setItem(STORAGE, JSON.stringify(this.settings));
        } catch { /* modo privado */ }
    }

    bindUi() {
        $('startButton')?.addEventListener('click', () => this.start());
        $('pauseBtn')?.addEventListener('click', () => this.togglePause());
        $('replayButton')?.addEventListener('click', () => this.replay());
        $('muteBtn')?.addEventListener('click', () => this.toggleMute());
        $('prevBtn')?.addEventListener('click', () => this.jumpChapter(-1));
        $('nextBtn')?.addEventListener('click', () => this.jumpChapter(1));
        $('rateBtn')?.addEventListener('click', () => this.cycleRate());
        $('endReplay')?.addEventListener('click', () => this.replay());
        $('retryButton')?.addEventListener('click', () => location.reload());
        $('retryLowButton')?.addEventListener('click', () => {
            this.settings.quality = 'low';
            this.saveSettings();
            location.reload();
        });
        const scrub = $('timeline');
        if (scrub) {
            scrub.max = String(FILM_DURATION);
            scrub.addEventListener('input', () => {
                this._scrubbing = true;
                this.seek(Number(scrub.value));
            });
            scrub.addEventListener('change', () => { this._scrubbing = false; });
        }
        // Aba oculta ou janela sem foco: pausa o filme e cala o som (retoma no botão).
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                if (this.state === 'playing') this.togglePause();
                this.audio?.setEnabled(false);
            } else if (!this.settings.muted && this.state !== 'boot') {
                this.audio?.setEnabled(true);
            }
        });
        $('qualitySelect')?.addEventListener('change', (e) => {
            this.settings.quality = e.target.value;
            this.saveSettings();
            // qualidade muda geometria e alvos de render: recarrega já com a escolha salva
            location.reload();
        });
        $('volumeSlider')?.addEventListener('input', (e) => {
            const v = Number(e.target.value);
            this.settings.volume = v;
            $('volumeValue').textContent = String(v);
            this.audio?.setVolume(v / 100);
            this.saveSettings();
        });
        if ($('volumeSlider')) {
            $('volumeSlider').value = String(this.settings.volume);
            $('volumeValue').textContent = String(this.settings.volume);
        }
        if ($('qualitySelect')) $('qualitySelect').value = this.settings.quality;

        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && (this.state === 'playing' || this.state === 'paused' || this.state === 'ended')) {
                if (e.target.closest?.('button, input, select')) return;
                e.preventDefault();
                if (this.state === 'ended') this.replay();
                else this.togglePause();
            }
            if (e.code === 'KeyR' && this.state !== 'boot' && this.state !== 'ready') this.replay();
            if (this.state === 'playing' || this.state === 'paused' || this.state === 'ended') {
                if (e.code === 'ArrowRight') { e.preventDefault(); this.jumpChapter(1); }
                if (e.code === 'ArrowLeft') { e.preventDefault(); this.jumpChapter(-1); }
                if (e.code === 'KeyV') this.cycleRate();
            }
            if (e.code === 'KeyM') this.toggleMute();
            if (e.code === 'KeyF') {
                const root = document.documentElement;
                const can = Boolean(document.fullscreenEnabled || document.webkitFullscreenEnabled)
                    && typeof (root.requestFullscreen || root.webkitRequestFullscreen) === 'function';
                if (!can) return;
                const isFull = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
                try {
                    if (isFull) (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
                    else (root.requestFullscreen || root.webkitRequestFullscreen)?.call(root);
                } catch { /* iOS sem API */ }
            }
        });
        window.addEventListener('resize', () => this.resize());
    }

    fail(err) {
        console.error(err);
        clearTimeout(this._watchdog);
        this.state = 'error';
        document.body.dataset.state = 'error';
        $('loadingOverlay').hidden = true;
        if ($('errorText')) $('errorText').textContent = err?.message || String(err);
        $('errorOverlay').hidden = false;
    }

    async boot() {
        const t0 = performance.now();
        const bar = $('loadProgress');
        const progress = (p) => { if (bar) bar.style.width = `${Math.round(p * 100)}%`; };
        // setTimeout (não rAF): o boot avança mesmo com a aba em segundo plano
        const frame = () => new Promise((r) => setTimeout(r, 0));
        try {
            this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, powerPreference: 'high-performance', alpha: false });
        } catch (err) {
            this.fail(new Error('WebGL indisponível neste aparelho.'));
            return;
        }
        try {
            const renderer = this.renderer;
            const software = detectSoftwareGL(renderer);
            this.tier = software ? 'low' : pickTier(this.settings.quality);
            this.quality = QUALITY[this.tier];
            const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
            this.pixelRatio = Math.min(window.devicePixelRatio || 1, this.quality.pr, coarse ? 1.5 : this.quality.pr);
            renderer.setPixelRatio(this.pixelRatio);
            this.canvas.addEventListener('webglcontextlost', (e) => {
                e.preventDefault();
                if (this.state === 'playing') this.togglePause();
            });
            renderer.setSize(window.innerWidth, window.innerHeight, false);
            renderer.shadowMap.enabled = this.quality.shadows;
            renderer.shadowMap.type = THREE.PCFShadowMap;
            renderer.info.autoReset = false;
            configureTextures(renderer);

            this.scene = new THREE.Scene();
            this.camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.4, 9000);
            const ctx = {
                scene: this.scene, renderer, camera: this.camera, canvas: this.canvas,
                tier: this.tier, quality: this.quality, mats: createMats()
            };
            this.ctx = ctx;
            progress(0.08);
            await frame();

            this.world = createWorld(ctx);
            this.sky = this.world.sky;
            this.rig = createSunRig(this.scene, this.sky, { shadows: this.quality.shadows, mapSize: this.quality.shadowMap, radius: 90, depth: 900 });
            progress(0.2);
            await frame();

            for (let i = 0; i < BUILDERS.length; i++) {
                const [name, build] = BUILDERS[i];
                try {
                    const mod = build(ctx, this.world, this.modules);
                    this.modules.push({ name, ...mod });
                } catch (err) {
                    console.warn(`[santos-1908] módulo "${name}" falhou:`, err);
                    this.failed.push(name);
                }
                progress(0.2 + ((i + 1) / BUILDERS.length) * 0.62);
                await frame();
            }

            this.post = createPipeline(renderer, { tier: this.tier, sky: this.sky, software });
            // Manhã de inverno: bruma baixa sobre o estuário, grade levemente quente/sépia
            Object.assign(this.post.params, {
                exposure: 1.06, bloom: 0.1, ao: 0.8, aoRadius: 1.3,
                fogDensity: 0.0032, fogFalloff: 0.03, fogBase: 0, haze: 0.00016, fogSunGlow: 0.95,
                rays: 0.6, saturation: 0.96, contrast: 1.05, sepia: 0.12, vignette: 0.16, grain: 0.012
            });
            this.post.params.gain.setRGB(1.03, 1.0, 0.95);
            this.post.params.lift.setRGB(0.012, 0.009, 0.004);
            ctx.post = this.post;
            ctx.fogBase = this.post.params.fogDensity;
            ctx.glowBase = this.post.params.fogSunGlow;

            this.audio = createAudio();
            this.cine = createCamera(ctx);
            this.cine.restart();
            progress(0.9);

            // IBL + LUT prontos antes de compilar, para não haver troca de programa no 1º quadro
            this.sky.flush();
            this.step(0, 0);
            await renderer.compileAsync(this.scene, this.camera);
            this.resize();
            this.post.render(this.scene, this.camera, 0);
            await frame();
            progress(1);

            if (this.state === 'error') return; // o watchdog já desistiu
            clearTimeout(this._watchdog);
            this.bootMs = Math.round(performance.now() - t0);
            this.state = 'ready';
            document.body.dataset.state = 'ready';
            $('loadingOverlay').hidden = true;
            $('intro').hidden = false;
            if (this.failed.length) console.info('[santos-1908] módulos pulados:', this.failed.join(', '));

            window.__lab = {
                seek: (t) => { this.cine.seek(t); this.step(this.cine.filmT, 0); this.render(0); },
                free: (pos, look, fov) => { this.cine.free(pos, look, fov); },
                pause: () => { if (this.state === 'playing') this.togglePause(); },
                play: () => { if (this.state === 'paused') this.togglePause(); else if (this.state === 'ready') this.start(); },
                renderer, camera: this.camera, scene: this.scene, post: this.post,
                get fps() { return app.fps; },
                get bootMs() { return app.bootMs; },
                get tier() { return app.tier; },
                get failed() { return app.failed; }
            };
            this.loop(performance.now());
        } catch (err) {
            this.fail(err);
        }
    }

    start() {
        this.audio.init();
        this.audio.setVolume(this.settings.volume / 100);
        this.audio.setEnabled(!this.settings.muted);
        $('intro').hidden = true;
        $('hud').hidden = false;
        this.showTitle(5200);
        document.body.dataset.state = 'playing';
        this.state = 'playing';
        this.cine.restart();
        this.cine.playing = true;
        this.setRate(this.settings.rate);
        this.updateMuteUi();
        this.updatePauseUi();
    }

    /** Pula para o começo do capítulo anterior/seguinte (←/→). */
    jumpChapter(dir) {
        const t = this.cine.filmT;
        let i = CHAPTERS.findIndex((c) => c.id === chapterAt(t).id);
        // "voltar" no meio de um capítulo volta ao início dele, como num player de vídeo
        if (dir < 0 && t - CHAPTERS[i].t > 2) dir = 0;
        i = Math.max(0, Math.min(CHAPTERS.length - 1, i + dir));
        this.seek(CHAPTERS[i].t + 0.01);
    }

    seek(t) {
        this.cine.seek(t);
        if (this.state === 'ended') {
            $('endCard').hidden = true;
            this.state = 'paused';
            document.body.dataset.state = 'paused';
            this.updatePauseUi();
        }
    }

    setRate(r) {
        const rate = RATES.includes(r) ? r : 1;
        this.settings.rate = rate;
        this.cine.rate = rate;
        const btn = $('rateBtn');
        if (btn) btn.textContent = `${String(rate).replace('.', ',')}×`;
    }

    cycleRate() {
        const i = RATES.indexOf(this.settings.rate);
        this.setRate(RATES[(i + 1) % RATES.length]);
        this.saveSettings();
    }

    showTitle(ms) {
        const tc = $('titleCard');
        if (!tc) return;
        tc.hidden = false;
        clearTimeout(this._title);
        this._title = setTimeout(() => { tc.hidden = true; }, ms);
    }

    replay() {
        if ($('endCard')) $('endCard').hidden = true;
        this.cine.restart();
        this.cine.playing = true;
        this.state = 'playing';
        document.body.dataset.state = 'playing';
        this.updatePauseUi();
        this.showTitle(4500);
    }

    togglePause() {
        if (this.state === 'ended') {
            this.replay();
            return;
        }
        if (this.state === 'playing') {
            this.cine.playing = false;
            this.state = 'paused';
        } else if (this.state === 'paused') {
            this.cine.playing = true;
            this.state = 'playing';
        }
        document.body.dataset.state = this.state;
        this.updatePauseUi();
    }

    updatePauseUi() {
        const btn = $('pauseBtn');
        if (!btn) return;
        const paused = this.state === 'paused';
        btn.setAttribute('aria-pressed', paused ? 'true' : 'false');
        btn.textContent = paused || this.state === 'ended' ? 'Continuar' : 'Pausar';
    }

    toggleMute() {
        this.settings.muted = !this.settings.muted;
        this.audio?.setEnabled(!this.settings.muted);
        this.saveSettings();
        this.updateMuteUi();
    }

    updateMuteUi() {
        const btn = $('muteBtn');
        if (!btn) return;
        btn.setAttribute('aria-pressed', this.settings.muted ? 'true' : 'false');
        btn.textContent = this.settings.muted ? 'Mudo' : 'Som';
    }

    resize() {
        if (!this.renderer) return;
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h, false);
        this.post?.setSize();
    }

    /** Resolução adaptativa (só em "auto"): cai abaixo de 42 fps, sobe acima de 57. */
    adapt(fps) {
        if (this.settings.quality !== 'auto') return;
        let next = this.pixelRatio;
        if (fps < 42) next = Math.max(0.7, next - 0.1);
        else if (fps > 57) {
            const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
            next = Math.min(window.devicePixelRatio || 1, this.quality.pr, coarse ? 1.5 : this.quality.pr, next + 0.05);
        }
        if (Math.abs(next - this.pixelRatio) < 0.04) return;
        this.pixelRatio = next;
        this.renderer.setPixelRatio(next);
        this.resize();
    }

    /** Avança o mundo para o instante t do filme. */
    step(t, dt) {
        const cam = this.camera;
        updateWind(t, 0.8);
        this.world.update(t, dt, cam);
        for (const mod of this.modules) {
            if (mod._dead) continue;
            try {
                mod.update?.(t, dt, cam);
            } catch (err) {
                console.warn(`[santos-1908] update "${mod.name}" falhou:`, err);
                mod._dead = true;
            }
        }
        // sombra: centra no que a câmera olha, raio cresce com a altura do plano
        const look = this.cine?.look;
        if (look) {
            const d = Math.min(cam.position.distanceTo(look), 160);
            this.focus.copy(cam.position).lerp(look, Math.min(1, (d * 0.55) / Math.max(1, cam.position.distanceTo(look))));
            this.focus.y = 2;
            this.rig.update(this.focus, Math.min(240, Math.max(70, 50 + cam.position.y * 1.6 + d * 0.5)));
        }
    }

    render(dt) {
        this.renderer.info.reset(); // soma todos os passes do quadro (cena + sombras + pós)
        this.post.render(this.scene, this.camera, dt);
    }

    loop = (now) => {
        requestAnimationFrame(this.loop);
        if (document.hidden) {
            this.last = now;
            return;
        }
        const dt = Math.min(0.05, (now - (this.last || now)) / 1000);
        this.last = now;
        let t = 0;
        let ch = CHAPTERS[0];
        try {
            this.cine.update(dt);
            t = this.cine.filmT;
            this.step(t, dt);
            ch = chapterAt(t);
            this.audio.update(t, dt, ch.id, this.state === 'playing');
            this.render(dt);
        } catch (err) {
            // um quadro com erro não congela o filme: registra uma vez e segue
            if (!this._loopErr) console.error(err);
            this._loopErr = true;
        }

        if (this.cine.ended && this.state === 'playing') {
            this.state = 'ended';
            document.body.dataset.state = 'ended';
            this.updatePauseUi();
            if ($('endCard')) {
                $('endCard').hidden = false;
                $('endReplay')?.focus({ preventScroll: true });
            }
        }

        if (this._ch !== ch.id) {
            this._ch = ch.id;
            if ($('chapterLabel')) $('chapterLabel').textContent = ch.label;
            if ($('captionLabel')) $('captionLabel').textContent = CAPTIONS[ch.id] || '';
        }
        const sec = Math.floor(t);
        if (sec !== this._sec) {
            this._sec = sec;
            if ($('filmTime')) $('filmTime').textContent = `${fmt(t)} / ${fmt(FILM_DURATION)}`;
        }
        // Relógio diegético = hora da HISTÓRIA (salta nos cortes; 9h30 = amarras passadas, D05)
        const clock = clockText(storyClock(t));
        if (clock !== this._clock) {
            this._clock = clock;
            if ($('filmClock')) $('filmClock').textContent = clock;
            kasatoPose(t, this.pose);
            const sp = this.pose.docked ? 'atracado' : `${this.pose.knots.toFixed(1).replace('.', ',')} nós`;
            if ($('shipSpeed')) $('shipSpeed').textContent = sp;
        }
        const scrub = $('timeline');
        if (scrub && !this._scrubbing) {
            const v = t.toFixed(1);
            if (scrub.value !== v) scrub.value = v;
        }
        this.fpsAcc += dt;
        this.fpsN++;
        if (this.fpsAcc >= 1) {
            this.fps = Math.round(this.fpsN / this.fpsAcc);
            if (this.state === 'playing') this.adapt(this.fps);
            this.fpsAcc = 0;
            this.fpsN = 0;
        }
    };
}

const app = new Santos1908();
