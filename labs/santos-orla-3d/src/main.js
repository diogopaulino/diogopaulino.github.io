/**
 * Santos Orla 3D — laço principal.
 * Digital twin procedural navegável: descida aérea → caminhada José Menino → Ponta da Praia.
 *
 * Pipeline: cena HDR (MSAA) → AO → neblina atmosférica → bloom → raios de sol → ACES.
 * Resolução adaptativa (qualidade "auto"): mede fps a cada 0,5 s e ajusta o pixel ratio
 *   fps < 42 → −0,1 (mín. 0,6)   ·   fps > 57 → +0,05 (máx. do tier)
 */

import * as THREE from 'three';
import { createPipeline } from '../../shared/gfx/post.js';
import { configureTextures } from '../../shared/gfx/textures.js';
import { pickTier, detectSoftwareGL, detectMobile, detectTouch } from '../../shared/gfx/core.js';

import { STORAGE_KEY, QUALITY, VIEW_MODES, LANDMARKS, DAY_STOPS, groundY } from './config.js';
import { World } from './world.js';
import { Player } from './player.js';
import { OrlaCamera } from './camera.js';
import { Input } from './input.js';
import { OrlaAudio } from './audio.js';
import { UI } from './ui.js';

class App {
    constructor() {
        this.ui = new UI();
        this.canvas = document.getElementById('scene');
        this.settings = this.loadSettings();
        this.state = 'loading';
        this.time = 0;
        this.mode = VIEW_MODES[this.settings.mode] ? this.settings.mode : 'tourist';
        this.paused = false;
        this.fpsAccum = 0;
        this.fpsFrames = 0;
        this.input = new Input();
        this.audio = new OrlaAudio();
        this.player = null;
        this.pixelRatio = 1;
        this._landedOnce = false;
    }

    loadSettings() {
        const fallback = { quality: 'auto', volume: 65, muted: false, mode: 'tourist', day: 1 };
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
        } catch {
            return fallback;
        }
    }

    saveSettings() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
        } catch { /* modo privado */ }
    }

    async init() {
        const t0 = performance.now();
        this.timing = {};
        this.ui.setLoading(0.03, 'Preparando a orla…');
        try {
            this.renderer = new THREE.WebGLRenderer({
                canvas: this.canvas,
                antialias: false, // o AA vem do MSAA do alvo HDR
                powerPreference: 'high-performance',
                alpha: false,
                stencil: false
            });
        } catch (err) {
            this.ui.showError('WebGL indisponível. Ative a aceleração de hardware.');
            return;
        }
        const software = detectSoftwareGL(this.renderer);
        const tier = software ? 'low' : pickTier(this.settings.quality);
        this.quality = QUALITY[tier];
        this.maxPixelRatio = Math.min(window.devicePixelRatio || 1, this.quality.pixelRatio);
        this.pixelRatio = this.maxPixelRatio;
        this.renderer.setPixelRatio(this.pixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight, false);
        this.renderer.shadowMap.enabled = this.quality.shadows;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.info.autoReset = false;
        configureTextures(this.renderer);

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.25, this.quality.far);

        this.world = new World(this.scene, this.renderer, this.quality);
        this.world.dayIndex = Number.isInteger(this.settings.day) && DAY_STOPS[this.settings.day] ? this.settings.day : 1;
        this.world.hour = DAY_STOPS[this.world.dayIndex].hour;
        await this.world.build((p, text) => this.ui.setLoading(p * 0.9, text));

        this.timing.build = Math.round(performance.now() - t0);
        this.post = createPipeline(this.renderer, { tier, sky: this.world.sky, software });
        Object.assign(this.post.params, {
            bloom: 0.085, ao: 0.9, aoRadius: 1.4, fogFalloff: 0.05, fogBase: 0, rays: 0.5, fogSunGlow: 0.45,
            saturation: 1.08, contrast: 1.06, vignette: 0.26, grain: 0.012
        });

        this.player = new Player(this.scene, this.world.parts.terrain.openings);
        this.player.blockers = this.world.blockers();
        this.rig = new OrlaCamera(this.camera);
        this.rig.update(0.016, this.player, window.innerWidth / window.innerHeight);
        this.dayStop = DAY_STOPS[this.world.dayIndex];
        this.ui.setDay(this.dayStop);

        this.ui.setLoading(0.94, 'Compilando shaders…');
        this.world.update(0, 0.016, this.camera, this.rig.focus, this.quality.shadowRadius, this.player);
        try {
            await this.renderer.compileAsync(this.scene, this.camera);
        } catch { /* compila sob demanda */ }
        this.timing.compiled = Math.round(performance.now() - t0);
        await new Promise((resolve) => setTimeout(resolve, 0));

        // aquece o pós-processamento e as sombras atrás do loading (evita travada no 1º frame)
        this.post.render(this.scene, this.camera, 0.016);

        this.timing.ready = Math.round(performance.now() - t0);
        this.bindUI();
        this.input.bind();
        window.addEventListener('resize', this.onResize);
        this.onResize();

        this.ui.hideLoading();
        this.ui.showMenu(true);
        this.state = 'menu';
        requestAnimationFrame(this.loop);
    }

    hintText() {
        if (this.mode === 'map') return 'Vista de mapa · escolha Turista para voltar a caminhar';
        if (this.mode === 'cinematic') return 'Voo de drone · T troca o modo';
        return detectTouch()
            ? 'Stick para andar · arraste à direita para olhar'
            : 'WASD andar · arraste o mouse ou ←→ para virar · Shift correr · T modo · L hora';
    }

    applyMode(mode) {
        if (!VIEW_MODES[mode]) return;
        this.mode = mode;
        this.settings.mode = mode;
        this.saveSettings();
        this.ui.setMode(mode);
        if (this.state === 'playing') {
            if (this.rig.phase !== 'intro') this.rig.setMode(mode);
            else this.rig.mode = mode;
            this.ui.setHint(this.hintText());
        }
    }

    cycleDay() {
        this.dayStop = this.world.cycleDay();
        this.settings.day = this.world.dayIndex;
        this.saveSettings();
        this.ui.setDay(this.dayStop);
    }

    bindUI() {
        const $ = (id) => document.getElementById(id);
        $('startButton')?.addEventListener('click', () => this.start());
        $('resumeButton')?.addEventListener('click', () => this.setPaused(false));
        $('pauseMenuButton')?.addEventListener('click', () => {
            this.setPaused(false);
            this.backToMenu();
        });
        $('pauseButton')?.addEventListener('click', () => this.setPaused(!this.paused));
        $('soundButton')?.addEventListener('click', () => this.toggleMute());
        $('dayButton')?.addEventListener('click', () => this.cycleDay());

        $('qualitySelect')?.addEventListener('change', (e) => {
            this.settings.quality = e.target.value;
            this.saveSettings();
            // o tier define geometria e alvos de render: recarrega para aplicar
            location.reload();
        });
        $('volumeSlider')?.addEventListener('input', (e) => {
            this.settings.volume = Number(e.target.value);
            this.audio.setVolume(this.settings.volume / 100);
            const label = $('volumeValue');
            if (label) label.textContent = String(this.settings.volume);
            this.saveSettings();
        });

        // Delegação no shell — chips do menu e do HUD
        document.querySelector('.game-shell')?.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-mode]');
            if (!btn || !btn.classList.contains('chip')) return;
            e.preventDefault();
            this.applyMode(btn.dataset.mode);
        });

        const touch = $('touchControls');
        if (touch) {
            const coarse = matchMedia('(pointer: coarse)').matches || (detectTouch() && detectMobile());
            touch.hidden = !coarse;
            touch.style.display = coarse ? '' : 'none';
        }

        $('landmarkList')?.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-goto]');
            if (!btn) return;
            const lm = LANDMARKS.find((l) => l.id === btn.dataset.goto);
            if (!lm) return;
            this.player.reset(lm.x, lm.z);
            if (this.state === 'menu') this.start({ skipIntro: true });
            if (this.mode === 'map' || this.mode === 'cinematic') this.applyMode('tourist');
        });

        // Stick virtual
        const stick = $('moveStick');
        const knob = $('moveKnob');
        if (stick) {
            const move = (ev) => {
                const rect = stick.getBoundingClientRect();
                let dx = (ev.clientX - (rect.left + rect.width / 2)) / (rect.width * 0.45);
                let dy = (ev.clientY - (rect.top + rect.height / 2)) / (rect.height * 0.45);
                const mag = Math.hypot(dx, dy);
                if (mag > 1) { dx /= mag; dy /= mag; }
                this.input.setTouchMove(dx, dy);
                if (knob) knob.style.transform = `translate(${dx * 28}px, ${dy * 28}px)`;
                ev.preventDefault();
            };
            const end = () => {
                this.input.setTouchMove(0, 0);
                if (knob) knob.style.transform = 'translate(0,0)';
            };
            stick.addEventListener('pointerdown', (e) => { stick.setPointerCapture(e.pointerId); move(e); });
            stick.addEventListener('pointermove', (e) => { if (e.buttons || e.pressure) move(e); });
            stick.addEventListener('pointerup', end);
            stick.addEventListener('pointercancel', end);
        }

        // Olhar: arrasto no pad (toque) ou direto no canvas (mouse)
        const bindLook = (el) => {
            if (!el) return;
            let active = false;
            let lx = 0;
            let ly = 0;
            el.addEventListener('pointerdown', (e) => {
                active = true;
                lx = e.clientX;
                ly = e.clientY;
                el.setPointerCapture?.(e.pointerId);
            });
            el.addEventListener('pointermove', (e) => {
                if (!active || this.state !== 'playing') return;
                const dx = e.clientX - lx;
                const dy = e.clientY - ly;
                lx = e.clientX;
                ly = e.clientY;
                // arrasto horizontal vira o visitante; vertical inclina a câmera
                if (this.rig.phase === 'walk') {
                    this.player.yaw -= dx * 0.0052;
                    this.rig.drag(0, dy);
                }
            });
            const stop = () => { active = false; };
            el.addEventListener('pointerup', stop);
            el.addEventListener('pointercancel', stop);
            el.addEventListener('pointerleave', stop);
        };
        bindLook($('lookPad'));
        bindLook(this.canvas);

        window.addEventListener('keydown', (e) => {
            if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'SELECT') return;
            if ((e.code === 'KeyP' || e.code === 'Escape') && this.state === 'playing') this.setPaused(!this.paused);
            if (e.code === 'KeyM') this.toggleMute();
            if (e.code === 'KeyT' && this.state === 'playing') {
                const ids = Object.keys(VIEW_MODES);
                this.applyMode(ids[(ids.indexOf(this.mode) + 1) % ids.length]);
            }
            if (e.code === 'KeyL' && this.state === 'playing') this.cycleDay();
        });

        const qs = $('qualitySelect');
        if (qs) qs.value = this.settings.quality;
        const vs = $('volumeSlider');
        if (vs) vs.value = String(this.settings.volume);
        const vv = $('volumeValue');
        if (vv) vv.textContent = String(this.settings.volume);
        this.ui.setMode(this.mode);
        this.updateMuteUi();
    }

    start({ skipIntro = false } = {}) {
        this.audio.init();
        this.audio.setEnabled(!this.settings.muted);
        this.audio.setVolume(this.settings.volume / 100);

        this.ui.showMenu(false);
        this.ui.showHud(true);
        this.state = 'playing';
        this.paused = false;
        this.rig.mode = this.mode;
        if (skipIntro) {
            this.rig.setMode(this.mode);
            this._landedOnce = true;
        } else {
            this.rig.startIntro();
            this._landedOnce = false;
        }
        this.ui.setMode(this.mode);
        this.ui.setHint(this.hintText());
    }

    backToMenu() {
        this.state = 'menu';
        this.rig.phase = 'menu';
        this.ui.showHud(false);
        this.ui.showMenu(true);
    }

    setPaused(p) {
        this.paused = p;
        this.ui.showPause(p);
    }

    updateMuteUi() {
        const btn = document.getElementById('soundButton');
        if (!btn) return;
        btn.setAttribute('aria-pressed', this.settings.muted ? 'false' : 'true');
        btn.textContent = this.settings.muted ? '🔇' : '♪';
    }

    toggleMute() {
        this.settings.muted = !this.settings.muted;
        this.audio.setEnabled(!this.settings.muted);
        this.saveSettings();
        this.updateMuteUi();
    }

    onResize = () => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setPixelRatio(this.pixelRatio);
        this.renderer.setSize(w, h, false);
        this.post?.setSize();
    };

    adaptResolution(fps) {
        if (this.settings.quality !== 'auto') return;
        let next = this.pixelRatio;
        if (fps < 42) next = Math.max(0.6, next - 0.1);
        else if (fps > 57) next = Math.min(this.maxPixelRatio, next + 0.05);
        if (Math.abs(next - this.pixelRatio) < 0.04) return;
        this.pixelRatio = next;
        this.onResize();
    }

    /** Teleporte de depuração: posiciona visitante e câmera sem transição. */
    tp(x, z, yaw = Math.PI / 2, pitch = 0.2) {
        if (this.state === 'menu') this.start({ skipIntro: true });
        this.player.reset(x, z);
        this.player.yaw = yaw;
        this.rig.pitch = pitch;
        this.rig.orbit = 0;
        this.rig._walkTarget(this.player, this.rig.pos, this.rig.look);
        for (let i = 0; i < 3; i++) this.frame(0.016);
        return `${Math.round(this.fps || 0)} fps · ${this.renderer.info.render.calls} calls · ${this.renderer.info.render.triangles} tris · pr ${this.pixelRatio.toFixed(2)}`;
    }

    /** Custo médio por quadro (ms), independente de rAF: renderiza n vezes e espera a GPU. */
    bench(n = 30) {
        const gl = this.renderer.getContext();
        const t0 = performance.now();
        for (let i = 0; i < n; i++) {
            this.time += 0.016;
            this.world.update(this.time, 0.016, this.camera, this.rig.focus, this.quality.shadowRadius, this.player);
            this.renderer.info.reset();
            this.post.render(this.scene, this.camera, 0.016);
        }
        gl.finish();
        const ms = (performance.now() - t0) / n;
        return `${ms.toFixed(2)} ms/quadro (${Math.round(1000 / ms)} fps) · ${this.renderer.info.render.calls} calls · ${this.renderer.info.render.triangles} tris · pr ${this.pixelRatio.toFixed(2)} · ${this.quality.id}`;
    }

    nearestLandmark() {
        let best = null;
        let dist = Infinity;
        for (const lm of LANDMARKS) {
            const d = Math.hypot(lm.x - this.player.x, lm.z - this.player.z);
            if (d < dist) {
                dist = d;
                best = { ...lm, dist };
            }
        }
        return best;
    }

    loop = (now) => {
        requestAnimationFrame(this.loop);
        if (document.hidden) {
            this._last = now;
            return;
        }
        const dt = Math.min(0.05, (now - (this._last || now)) / 1000);
        this._last = now;
        if (this.state === 'loading') return;
        this.frame(dt);
    };

    /** Um passo de simulação + render. */
    frame(dt) {
        const frozen = this.state === 'playing' && this.paused;
        const step = frozen ? 0 : dt;
        this.time += step;

        const aspect = this.camera.aspect;
        let cam = { introProgress: 0, landed: false };
        if (this.state === 'menu') {
            this.rig.phase = 'menu';
            this.player.update(step, this.input, true);
            cam = this.rig.update(step, this.player, aspect);
        } else if (!frozen) {
            const input = this.input.poll();
            const locked = this.rig.phase !== 'walk';
            this.player.update(step, input, locked);
            if (!locked) this.rig.drag(0, -input.lookY * 260 * step);
            cam = this.rig.update(step, this.player, aspect);
            this.ui.setIntro(cam.introProgress, cam.landed);
            if (cam.landed && !this._landedOnce) {
                this._landedOnce = true;
                this.rig.setMode(this.mode);
            }
            const near = this.nearestLandmark();
            this.ui.updatePlace(this.player.x, near);
            this.ui.syncLabels(this.camera, LANDMARKS, this.ui.showLabels && cam.landed, this.rig.phase === 'walk' ? 240 : Infinity);
            this.audio.update(this.player.z, this.player.speed, this.world.sky.night > 0.5);
        }

        // sombra: raio cresce com a altura da câmera (mapa/drone enxergam longe)
        const camH = this.camera.position.y - groundY(this.camera.position.x, this.camera.position.z);
        const radius = Math.min(420, Math.max(this.quality.shadowRadius, camH * 1.25));
        this.world.update(this.time, step, this.camera, this.rig.focus, radius, this.player);

        const p = this.post.params;
        const env = this.world.env;
        p.exposure = env.exposure;
        p.fogDensity = env.fog;
        p.haze = env.haze;
        const drone = this.rig.phase === 'cinematic' || this.rig.phase === 'menu';
        p.dofRange = drone ? Math.max(30, this.rig.focusDist * 0.9) : 0;
        p.dofFocus = this.rig.focusDist;
        p.dofMax = 0.55;

        this.renderer.info.reset();
        this.post.render(this.scene, this.camera, dt);

        this.fpsAccum += dt;
        this.fpsFrames++;
        if (this.fpsAccum >= 0.5) {
            const fps = this.fpsFrames / this.fpsAccum;
            this.fps = fps;
            this.ui.setFps(Math.round(fps));
            if (this.state === 'playing' && !frozen) this.adaptResolution(fps);
            this.fpsAccum = 0;
            this.fpsFrames = 0;
        }
    }
}

const app = new App();
// gancho de depuração/teste (sem efeito para o visitante)
window.__orla = app;
app.init().catch((err) => {
    console.error(err);
    app.ui.showError(err?.message || 'Falha ao iniciar o laboratório.');
});
