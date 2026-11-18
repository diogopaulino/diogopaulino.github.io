/**
 * Jurassic — laço principal, câmeras e diário de campo.
 *
 * Palco: `shared/gfx/stage.js` (céu físico, sol com sombra em cascata, pós com
 * AO, névoa de altura, DOF e grade de cor). Mundo em world.js, construções em
 * structures.js, fauna em dinosaurs.js, veículo em jeep.js, efeitos em fx.js.
 *
 * REGRAS DO JOGO
 *   • Dirija pela ilha; a menos de `observe` metros de uma espécie, segure
 *     E / botão direito / "observar" por `log` segundos para catalogá-la.
 *   • Seis espécies catalogadas = diário completo (vitória).
 *   • O rex persegue quem para junto ao vão rompido da cerca ou entra no
 *     paddock; a menos de 5,4 m dele o turno acaba.
 *
 * CÂMERAS (tecla C): perseguição · perseguição alta · capô.
 *   Observando: binóculo — a câmera sobe ao teto do jipe, mira o animal e fecha
 *   o campo:  fov = clamp(2·atan(1,1·tamanho / d); 9°; 46°)  com foco (DOF) em d.
 * TREMOR: cada passo pesado soma  peso / (1 + (d/12)²)  e decai com e^(−6·t).
 */

import * as THREE from 'three';
import { createStage } from '../../shared/gfx/stage.js';
import { clamp, damp, smoothstep } from '../../shared/gfx/core.js';
import { STORAGE_KEY, QUALITY, CAMERA, WORLD, SPECIES, DAY_STOPS } from './config.js?v=20';
import { Input } from './input.js?v=20';
import { ParkAudio } from './audio.js?v=20';
import { Hud } from './hud.js?v=20';
import { World } from './world.js?v=20';
import { Jeep } from './jeep.js?v=20';
import { spawnDinosaurs } from './dinosaurs.js?v=20';
import { buildStructures } from './structures.js?v=20';
import { createParticles, createRain, createPuddles } from './fx.js?v=20';

const DEBUG = new URLSearchParams(location.search);
const nextTask = () => new Promise((r) => setTimeout(r, 0));

class Game {
    constructor() {
        this.hud = new Hud();
        this.canvas = document.getElementById('scene');
        this.settings = this.loadSettings();
        this.state = 'loading';
        this.elapsed = 0;
        this.tod = 0;
        this.rain = false;
        this.wet = 0;
        this.rainAmount = 0;
        this.logged = new Set();
        this.observeT = 0;
        this.observeTarget = null;
        this.camYaw = 0;
        this.camPitch = CAMERA.defaultPitch;
        this.camDist = CAMERA.distance;
        this.camMode = 0;
        this.hudAccum = 0;
        this.radioAcc = 0;
        this.shake = 0;
        this.flash = 0;
        this.nextBolt = 6;
        this.thunderIn = -1;
        this.night = 0;
        this.hideUi = false;
        this.touch = matchMedia('(pointer: coarse)').matches;
        this.zoom = 0;
        this.sparkAcc = 0;
        this._look = new THREE.Vector3();
        this._cam = new THREE.Vector3();
        this._wanted = new THREE.Vector3();
        this._v = new THREE.Vector3();
        this.tramplers = Array.from({ length: 8 }, () => ({ x: 0, y: -999, z: 0, radius: 0.1 }));
        this.ctx = {
            jeep: null, jeepHead: null, camera: null, playing: false,
            jeepDist: (d) => Math.hypot(d.position.x - this.jeep.x, d.position.z - this.jeep.z),
            onStep: (d, p, w) => this._step(d, p, w),
            onRoar: (d, k) => this._roar(d, k)
        };
    }

    loadSettings() {
        const fallback = { quality: 'auto', volume: 70, muted: false };
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            const s = raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
            if (s.quality === 'ultra') s.quality = 'high';
            return s;
        } catch {
            return fallback;
        }
    }

    saveSettings() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
        } catch { /* privado */ }
    }

    async init() {
        this.hud.setLoading(0.04, 'Acendendo os geradores…');
        await document.fonts?.load('700 48px Barlow').catch(() => {});
        const choice = DEBUG.get('tier') || this.settings.quality;
        const stage = createStage({
            canvas: this.canvas, tier: QUALITY[choice] ? choice : 'auto', preset: DAY_STOPS[0].preset, fov: 50, near: 0.3
        });
        if (!stage) {
            this.hud.showError('Não foi possível criar o contexto WebGL 2.');
            return;
        }
        this.stage = stage;
        this.scene = stage.scene;
        this.camera = stage.camera;
        this.quality = QUALITY[stage.tier];
        this.ctx.camera = this.camera;

        const progress = (p, text) => this.hud.setLoading(p, text);
        this.world = await World.create(stage, this.quality, progress);
        progress(0.5, 'Concretando o portal e as cercas…');
        await nextTask();
        this.park = buildStructures(this.world, stage);

        progress(0.56, 'Despertando os dinossauros…');
        this.dinos = await spawnDinosaurs(this.scene, this.world, this.quality, (p) => progress(0.56 + p * 0.26));
        progress(0.84, 'Abastecendo a Unidade 4…');
        await nextTask();
        this.jeep = new Jeep(this.scene, this.quality);
        this.jeep.reset(WORLD.spawn, this.world);
        this.ctx.jeep = this.jeep;
        this.ctx.jeepHead = this.jeep.head;

        this.fx = createParticles(this.quality.particles);
        this.rainFx = createRain(this.quality.rain);
        this.puddles = createPuddles(this.world, this.quality.puddles);
        this.scene.add(this.fx.object, this.rainFx.object, this.puddles.object);

        this.input = new Input(this.canvas);
        this.audio = new ParkAudio();
        stage.onTier((t) => this.world.setTier(t));
        this.world.setTier(stage.tier);

        this._bindUi();
        this._bindTouch();
        this._applyAtmosphere();
        // faróis já acesos na compilação: evita o tranco de recompilar materiais ao abrir o portão
        this.jeep.setLights(true, this.night);

        progress(0.9, 'Carregando plantas e rochas…');
        await Promise.race([Promise.all([this.world.ready, this.park.ready]), new Promise((r) => setTimeout(r, 12000))]);
        progress(0.96, 'Compilando a luz da manhã…');
        this._heroCamera(0);
        this.world.update(0.016, 0, this.camera, this.tramplers);
        await stage.warmup();

        this.hud.el.qualitySelect.value = this.settings.quality;
        this.hud.el.volumeSlider.value = String(this.settings.volume);
        this.hud.setVolumeLabel(this.settings.volume);
        this.hud.setMuted(this.settings.muted);
        this.hud.setLoading(1, 'O portão está aberto.');
        this.hud.hideLoading();
        this.hud.showMenu(true);
        this.state = 'menu';
        this.hud.setState('menu');
        stage.start((dt, t) => this._frame(dt, t));
        if (DEBUG.has('debug')) this._debug();
    }

    _bindUi() {
        this.hud.el.qualitySelect.addEventListener('change', () => {
            this.settings.quality = this.hud.el.qualitySelect.value;
            this.saveSettings();
            // sombra, pós e grama mudam na hora; selva e fauna no próximo carregamento
            if (QUALITY[this.settings.quality]) {
                this.stage.setTier(this.settings.quality);
                this.world.setTier(this.settings.quality);
            }
        });
        this.hud.el.volumeSlider.addEventListener('input', () => {
            this.settings.volume = Number(this.hud.el.volumeSlider.value);
            this.hud.setVolumeLabel(this.settings.volume);
            this.audio.setVolume(this.settings.volume / 100);
            this.saveSettings();
        });
        const on = (id, fn) => document.getElementById(id).addEventListener('click', fn);
        on('startButton', () => this.start());
        on('resumeButton', () => this.resume());
        on('pauseMenuButton', () => this.toMenu());
        on('retryButton', () => this.start());
        on('caughtMenuButton', () => this.toMenu());
        on('replayButton', () => this.start());
        on('victoryMenuButton', () => this.toMenu());
        this.hud.el.soundButton.addEventListener('click', () => this.toggleMute());
        const togglePause = () => {
            if (this.state === 'play') this.pause();
            else if (this.state === 'pause') this.resume();
        };
        this.hud.el.pauseButton.addEventListener('click', togglePause);
        this.input.on('pause', togglePause);
        this.input.on('mute', () => this.toggleMute());
        this.input.on('camera', () => { this.camMode = (this.camMode + 1) % 3; });
        this.input.on('lights', () => this.jeep.setLights(!this.jeep.lightsOn, this.night));
        this.input.on('tod', () => this.setTod((this.tod + 1) % DAY_STOPS.length));
        this.input.on('rain', () => this.setRain(!this.rain));
        this.input.on('hud', () => {
            this.hideUi = !this.hideUi;
            this.hud.showHud(this.state === 'play' && !this.hideUi);
        });
        this.input.on('pointerdown', () => {
            if (this.state === 'play') this.input.requestLock();
        });
        this.input.on('confirm', () => {
            if (this.state === 'menu') this.start();
        });
    }

    _bindTouch() {
        const stick = document.getElementById('moveStick');
        const knob = document.getElementById('moveKnob');
        const look = document.getElementById('lookZone');
        const observe = document.getElementById('btnObserve');
        if (!stick) return;
        const bindStick = (el, setter) => {
            let pid = null;
            const go = (e) => {
                const t = [...e.changedTouches].find((x) => x.identifier === pid) || e.touches[0];
                if (!t) return;
                const r = el.getBoundingClientRect();
                const x = ((t.clientX - r.left) / r.width) * 2 - 1;
                const y = ((t.clientY - r.top) / r.height) * 2 - 1;
                setter(x, y);
                if (knob && el === stick) knob.style.transform = `translate(${clamp(x, -1, 1) * 22}px, ${clamp(y, -1, 1) * 22}px)`;
            };
            el.addEventListener('touchstart', (e) => {
                pid = e.changedTouches[0].identifier;
                go(e);
                e.preventDefault();
            }, { passive: false });
            el.addEventListener('touchmove', (e) => { go(e); e.preventDefault(); }, { passive: false });
            const end = () => {
                pid = null;
                setter(0, 0);
                if (knob && el === stick) knob.style.transform = '';
            };
            el.addEventListener('touchend', end);
            el.addEventListener('touchcancel', end);
        };
        bindStick(stick, (x, y) => {
            this.input.touchMove.x = clamp(x, -1, 1);
            this.input.touchMove.y = clamp(-y, -1, 1);
        });
        bindStick(look, (x, y) => {
            this.input.touchLook.x = clamp(x, -1, 1);
            this.input.touchLook.y = clamp(y, -1, 1);
        });
        observe?.addEventListener('touchstart', (e) => {
            this.input.observeHeld = true;
            this.input.observePressed = true;
            e.preventDefault();
        }, { passive: false });
        const release = () => { this.input.observeHeld = false; };
        observe?.addEventListener('touchend', release);
        observe?.addEventListener('touchcancel', release);
    }

    // ───────────────────────────── estados ─────────────────────────────

    start() {
        this.logged.clear();
        this.hud._fillCatalog();
        this.elapsed = 0;
        this.observeT = 0;
        this.observeTarget = null;
        this.camMode = 0;
        this.camYaw = 0;
        this.camPitch = CAMERA.defaultPitch;
        this.camDist = CAMERA.distance;
        this.shake = 0;
        this.zoom = 0;
        this.jeep.reset(WORLD.spawn, this.world);
        this.jeep.setLights(this.night > 0.4 || this.rain || this.tod === 0, this.night);
        this._snapCamera();
        this.dinos.trex.caught = false;
        this.dinos.trex.state = 'return';
        this.park.closeGate(true);
        this.park.openGate();
        this.hud.hideCaught();
        this.hud.hideVictory();
        this.hud.showMenu(false);
        this.hud.showPause(false);
        this.hud.showHud(!this.hideUi);
        this.hud.showTouch(matchMedia('(pointer: coarse)').matches);
        this.hud.setRain(this.rain);
        this.hud.setTod(DAY_STOPS[this.tod].label);
        this.hud.setRadio('Central para Unidade 4: portão liberado. Seis espécies no circuito de hoje.');
        this.state = 'play';
        this.hud.setState('play');
        this.input.enabled = true;
        this.audio.setVolume(this.settings.volume / 100);
        this.audio.setEnabled(!this.settings.muted);
        this.audio.resume();
        this.input.requestLock();
    }

    pause() {
        if (this.state !== 'play') return;
        this.state = 'pause';
        this.hud.setState('pause');
        this.hud.showPause(true);
        this.input.exitLock();
    }

    resume() {
        this.hud.showPause(false);
        this.state = 'play';
        this.hud.setState('play');
        this.input.requestLock();
    }

    toMenu() {
        this.input.exitLock();
        this.hud.hideCaught();
        this.hud.hideVictory();
        this.hud.showPause(false);
        this.hud.showHud(false);
        this.hud.setDossier(null, false);
        this.hud.showMenu(true);
        this.park.closeGate();
        this.state = 'menu';
        this.hud.setState('menu');
    }

    toggleMute() {
        this.settings.muted = !this.settings.muted;
        this.audio.setEnabled(!this.settings.muted);
        this.hud.setMuted(this.settings.muted);
        this.saveSettings();
        if (!this.settings.muted) this.audio.resume();
    }

    setTod(i) {
        this.tod = i;
        this._applyAtmosphere();
        this.hud.setTod(DAY_STOPS[i].label);
        if (this.jeep) this.jeep.setLights(this.jeep.lightsOn || this.night > 0.5, this.night);
    }

    setRain(on) {
        this.rain = on;
        this._applyAtmosphere();
        this.hud.setRain(on);
        this.nextBolt = 3;
    }

    /** Hora + clima → preset do palco. Chuva usa 'tempestade' mantendo a hora. */
    _applyAtmosphere() {
        const stop = DAY_STOPS[this.tod];
        const st = this.stage;
        st.setPreset(this.rain ? 'tempestade' : stop.preset, { keepHour: true });
        st.setTimeOfDay(stop.hour);
        const p = st.pipeline.params;
        if (!this.rain && stop.preset === 'neblina-floresta') {
            // névoa úmida de manhã, mas rala o bastante para ver um braquiossauro a 80 m
            p.fogDensity = 0.016;
            p.fogFalloff = 0.07;
            p.haze = 0.0022;
        }
        if (this.rain) {
            p.fogDensity = 0.011;
            p.haze = 0.0032;
        }
        if (!this.rain && stop.preset === 'entardecer') {
            // sol baixo: sem reforço a sombra da mata fecha em preto
            st.fill.intensity = Math.max(st.fill.intensity, 0.55);
            st.scene.environmentIntensity *= 1.5;
        }
        if (st.sky.sunDir.y < 0) {
            // noite: luar fraco + preenchimento, para a mata não virar silhueta preta (mais ainda sob chuva)
            st.fill.intensity = Math.max(st.fill.intensity, this.rain ? 1.3 : 0.85);
            st.scene.environmentIntensity *= this.rain ? 2.2 : 1.3;
        }
        p.dofRange = 0;
        this.night = 1 - smoothstep(-0.08, 0.14, st.sky.sunDir.y);
        this.baseExposure = p.exposure;
        this.baseFill = st.fill.intensity;
    }

    // ───────────────────────────── eventos ─────────────────────────────

    /** Passo pesado: poeira no pé, baque e tremor. */
    _step(d, p, weight) {
        const dist = Math.hypot(p.x - this.camera.position.x, p.z - this.camera.position.z);
        const k = weight / (1 + (dist / 12) ** 2);
        this.shake = Math.min(1, this.shake + k * 0.9);
        this.audio.thud(Math.min(1, k * 1.6));
        const wet = this.wet;
        const n = Math.round(3 + weight * 5);
        const g = this.world.heightAt(p.x, p.z);
        for (let i = 0; i < n; i++) {
            const a = Math.random() * 6.283;
            const s = 0.4 + Math.random() * 1.2 * (0.5 + weight);
            const c = 0.5 - wet * 0.25;
            this.fx.emit(p.x + Math.cos(a) * 0.3, g + 0.15, p.z + Math.sin(a) * 0.3, Math.cos(a) * s, 0.5 + Math.random() * 0.8, Math.sin(a) * s,
                c * 1.15, c, c * 0.8, 0.2 + weight * 0.14, 0.5 + weight * 0.6, 1.6 + weight * 1.8, 1.3 + Math.random() * 0.9, -0.15, 1.6);
        }
    }

    _roar(d, k) {
        const dist = this.ctx.jeepDist(d);
        const near = clamp(1.4 - dist / 60, 0.15, 1.3);
        this.audio.roar(k * near);
        this.shake = Math.min(1, this.shake + 0.45 * near * k);
        if (this.state === 'play' && dist < 60) this.hud.setRadio('Central: o rex está vocalizando. Fique longe do vão rompido, no lado sul do paddock.');
    }

    _nearestDino() {
        let best = null;
        let bestD = 1e9;
        for (const d of this.dinos.list) {
            const dist = Math.hypot(d.position.x - this.jeep.x, d.position.z - this.jeep.z);
            if (dist < d.spec.observe && dist < bestD) {
                bestD = dist;
                best = d;
            }
        }
        return best;
    }

    _updateObserve(dt) {
        const near = this._nearestDino();
        const holding = this.input.observeHeld;
        if (near !== this.observeTarget) {
            this.observeTarget = near;
            this.observeT = 0;
        }
        if (!near) {
            this.observeT = 0;
            this.hud.setPrompt('');
            this.hud.setDossier(null, false);
            return null;
        }
        const spec = near.spec;
        const done = this.logged.has(spec.id);
        this.hud.setPrompt(holding ? (done ? `${spec.common} — já catalogado` : 'Registrando…') : `${spec.common} à vista — ${this.touch ? 'segure OBSERVAR' : 'segure E / botão direito para observar'}`);
        if (!holding) {
            this.observeT = 0;
            this.hud.setDossier(spec, false);
            return null;
        }
        this.observeT += dt;
        this.hud.setDossier(spec, true);
        if (this.observeT >= spec.log && !done) {
            this.logged.add(spec.id);
            this.hud.setLogged(spec.id);
            this.hud.setRadio(`Diário: ${spec.common} catalogado. ${this.logged.size}/6`);
            if (this.logged.size >= SPECIES.length) this._win();
        }
        return near;
    }

    _win() {
        this.state = 'victory';
        this.hud.setState('victory');
        this.input.exitLock();
        this.hud.showHud(false);
        this.hud.setDossier(null, false);
        this.hud.showVictory(`
            <span>Espécies <b>6/6</b></span>
            <span>Tempo <b>${this.hud.el.time.textContent}</b></span>
        `);
    }

    _caught() {
        this.state = 'caught';
        this.hud.setState('caught');
        this.input.exitLock();
        this.hud.showHud(false);
        this.hud.setDossier(null, false);
        this.hud.setShake(true);
        this.audio.roar(1.4);
        this.hud.showCaught(`
            <span>O rex alcançou o jipe.</span>
            <span>Espécies <b>${this.logged.size}/6</b></span>
        `);
        setTimeout(() => this.hud.setShake(false), 900);
    }

    // ───────────────────────────── câmeras ─────────────────────────────

    /** Câmera do menu: órbita lenta sobre o lago, mirando o braquiossauro. */
    _heroCamera(t) {
        const b = this.dinos.list[0];
        const a = t * 0.045 + 0.7;
        const cx = b.position.x + Math.cos(a) * 30;
        const cz = b.position.z + Math.sin(a) * 30;
        this.camera.fov = 46;
        this.camera.updateProjectionMatrix();
        this.camera.position.set(cx, Math.max(this.world.heightAt(cx, cz) + 2.2, b.position.y + 3.4), cz);
        this.camera.lookAt(b.position.x, b.position.y + 7.6, b.position.z);
        this._cam.copy(this.camera.position);
    }

    _snapCamera() {
        const yaw = this.jeep.yaw;
        this._cam.set(this.jeep.x - Math.sin(yaw) * CAMERA.distance, this.jeep.y + CAMERA.height, this.jeep.z - Math.cos(yaw) * CAMERA.distance);
        this.camera.position.copy(this._cam);
    }

    _camera(dt, t, observe) {
        const look = this.input.consumeLook();
        this.camYaw -= look.x * 0.0022;
        this.camPitch = clamp(this.camPitch - look.y * 0.002, CAMERA.pitchMin, CAMERA.pitchMax);
        this.camDist = clamp(this.camDist + this.input.consumeZoom() * 0.9, CAMERA.minDistance, CAMERA.maxDistance);
        // sem mouse travado a câmera volta devagar para trás do jipe
        if (!this.input.locked && Math.abs(this.jeep.speed) > 1) this.camYaw = damp(this.camYaw, 0, 1.2, dt);

        const j = this.jeep;
        const p = this.stage.pipeline.params;
        this.zoom = damp(this.zoom, observe ? 1 : 0, 5, dt);
        let fov = this.camMode === 2 ? 62 : this.camMode === 1 ? 46 : 52;
        const jYaw = j.yaw;

        if (observe) {
            // binóculo: do teto do jipe para o animal
            const f = observe.focus;
            this._wanted.set(j.x, j.y + 2.55, j.z);
            const d = this._wanted.distanceTo(f);
            const size = observe.flyer ? 7 : Math.max(observe.height, observe.length * 0.55);
            fov = clamp((2 * Math.atan((1.1 * size) / d) * 180) / Math.PI, 9, 46);
            this._look.lerp(f, 1 - Math.exp(-6 * dt));
            p.dofFocus = d;
            p.dofRange = d * 0.35 + 4;
            p.dofMax = 1;
            this._cam.lerp(this._wanted, 1 - Math.exp(-9 * dt));
        } else {
            p.dofRange = 0;
            const yaw = jYaw + this.camYaw;
            const m = this.camMode;
            const dist = m === 1 ? this.camDist * 1.7 : this.camDist;
            if (m === 2) {
                // capô: olho do motorista, um pouco acima do volante
                this._wanted.set(j.x + Math.sin(jYaw) * 0.25 + Math.cos(jYaw) * 0.1, j.y + 1.86, j.z + Math.cos(jYaw) * 0.25 - Math.sin(jYaw) * 0.1);
                this._v.set(j.x + Math.sin(yaw) * 12, j.y + 1.5 - this.camPitch * 8, j.z + Math.cos(yaw) * 12);
            } else {
                this._wanted.set(j.x - Math.sin(yaw) * dist, j.y + (m === 1 ? 7.4 : CAMERA.height) + this.camPitch * 7, j.z - Math.cos(yaw) * dist);
                this._v.set(j.x + Math.sin(jYaw) * CAMERA.lookAhead, j.y + CAMERA.lookY, j.z + Math.cos(jYaw) * CAMERA.lookAhead);
            }
            if (m !== 2) this._avoidFoliage(this._wanted);
            const ground = this.world.heightAt(this._wanted.x, this._wanted.z) + 1.1;
            if (this._wanted.y < ground) this._wanted.y = ground;
            this._cam.lerp(this._wanted, 1 - Math.exp(-(m === 2 ? 30 : 5.5) * dt));
            this._look.lerp(this._v, 1 - Math.exp(-(m === 2 ? 20 : 9) * dt));
        }
        this.camera.fov = damp(this.camera.fov, fov, 6, dt);
        this.camera.updateProjectionMatrix();
        this.camera.position.copy(this._cam);
        // tremor: senos incomensuráveis (sem ruído branco, para não "vibrar" de quadro a quadro)
        const s = this.shake * this.shake * (observe ? 0.35 : 1);
        if (s > 0.0005) {
            this.camera.position.x += Math.sin(t * 37.1) * 0.16 * s;
            this.camera.position.y += Math.sin(t * 43.7 + 1.3) * 0.22 * s;
            this.camera.position.z += Math.sin(t * 31.3 + 2.1) * 0.16 * s;
        }
        this.camera.lookAt(this._look);
    }

    /**
     * Tira a câmera de dentro das copas: sob uma frondosa ela desce para baixo dos
     * galhos (y ≤ base + 3·s); junto a cicas e samambaias é empurrada para fora do raio da planta.
     */
    _avoidFoliage(p) {
        const trees = this.world.trees;
        for (let i = 0; i < trees.length; i++) {
            const t = trees[i];
            if (t.species === 'palmeira') continue;
            const s = (t.s || 1) * 1.1;
            const R = t.species === 'carvalho' ? 6.2 * s : 2.7 * s;
            const dx = p.x - t.x;
            const dz = p.z - t.z;
            if (Math.abs(dx) > R || Math.abs(dz) > R) continue;
            const d = Math.hypot(dx, dz);
            if (d >= R) continue;
            if (t.species === 'carvalho') {
                const top = t.y + 3.0 * s;
                if (p.y > top) p.y = top;
                if (d < 1.2) {
                    p.x = t.x + (dx / (d || 1)) * 1.2;
                    p.z = t.z + (dz / (d || 1)) * 1.2;
                }
            } else {
                p.x = t.x + (dx / (d || 1)) * R;
                p.z = t.z + (dz / (d || 1)) * R;
            }
        }
    }

    // ───────────────────────────── quadro ─────────────────────────────

    _weather(dt, t) {
        this.rainAmount = damp(this.rainAmount, this.rain ? 1 : 0, 0.9, dt);
        this.wet = clamp(this.wet + (this.rain ? dt / 8 : -dt / 25), 0, 1);
        const light = 0.25 + (1 - this.night) * 0.75 + this.flash * 1.5;
        this.rainFx.update(t, this.camera, this.rainAmount, light);
        this.puddles.update(this.wet);
        // relâmpago: clarão duplo (exposição + luz de preenchimento) e trovão atrasado
        if (this.rain) {
            this.nextBolt -= dt;
            if (this.nextBolt <= 0) {
                this.nextBolt = 7 + Math.random() * 12;
                this.flash = 1;
                this.thunderIn = 0.4 + Math.random() * 1.6;
            }
        }
        if (this.thunderIn > 0) {
            this.thunderIn -= dt;
            if (this.thunderIn <= 0) this.audio.thunder(0.9);
        }
        if (this.flash > 0 || this._flashOn) {
            this.flash = Math.max(0, this.flash - dt * 2.6);
            const f = this.flash * this.flash * (0.6 + 0.4 * Math.sin(t * 70));
            this.stage.pipeline.params.exposure = this.baseExposure * (1 + f * 1.4);
            this.stage.fill.intensity = this.baseFill + f * 2.2;
            this._flashOn = this.flash > 0;
        }
    }

    _effects(dt, t) {
        const j = this.jeep;
        const sp = Math.abs(j.speed);
        // lama/poeira nas rodas traseiras: taxa ∝ velocidade; na chuva vira respingo escuro e pesado
        if (sp > 2.5 && this.state === 'play') {
            const rate = (j.onRoad && this.wet < 0.2 ? 0.5 : 1.2) * sp * dt * 2.2;
            let n = Math.floor(rate + Math.random());
            const s = Math.sin(j.yaw);
            const c = Math.cos(j.yaw);
            const mud = this.wet > 0.25 || !j.onRoad;
            while (n-- > 0) {
                const side = Math.random() < 0.5 ? -1 : 1;
                const x = j.x + side * 0.82 * c - 1.35 * s;
                const z = j.z - side * 0.82 * s - 1.35 * c;
                const back = -(0.25 + Math.random() * 0.35) * j.speed;
                if (mud && this.wet > 0.25) {
                    this.fx.emit(x, j.y + 0.2, z, s * back + (Math.random() - 0.5) * 1.5, 1.5 + Math.random() * 2.5, c * back + (Math.random() - 0.5) * 1.5,
                        0.2, 0.15, 0.1, 0.75, 0.12, 0.1, 0.55 + Math.random() * 0.3, 9, 0.6);
                } else {
                    const k = mud ? 0.36 : 0.52;
                    this.fx.emit(x, j.y + 0.2, z, s * back * 0.3, 0.4 + Math.random() * 0.7, c * back * 0.3,
                        k * 1.2, k, k * 0.78, mud ? 0.3 : 0.16, 0.5, 2.6, 1.1 + Math.random() * 0.8, -0.2, 1.4);
                }
            }
        }
        // faíscas no vão rompido da cerca
        this.sparkAcc -= dt;
        if (this.sparkAcc <= 0) {
            this.sparkAcc = 0.25 + Math.random() * 1.6;
            const pts = this.park.sparkPoints;
            const p = pts[Math.floor(Math.random() * pts.length)];
            if (p && p.distanceTo(this.camera.position) < 90) {
                for (let i = 0; i < 14; i++) {
                    this.fx.emit(p.x, p.y, p.z, (Math.random() - 0.5) * 5, Math.random() * 4, (Math.random() - 0.5) * 5,
                        1.6, 1.9, 3.2, 1, 0.07, -0.03, 0.3 + Math.random() * 0.5, 9, 0.8, true);
                }
                this.park.sparkLight.position.copy(p);
                this.park.spark(1);
                if (p.distanceTo(this.camera.position) < 45) this.audio.spark();
            }
        }
        const day = 1 - this.night * 0.82;
        this.fx.material.uniforms.uLight.value.setScalar(day * (this.rain ? 0.7 : 1) + this.flash);
        this.fx.update(dt, this.canvas.clientHeight || 720, this.camera.fov);
    }

    _tramplers() {
        const tr = this.tramplers;
        tr[0].x = this.jeep.x;
        tr[0].y = this.jeep.y;
        tr[0].z = this.jeep.z;
        tr[0].radius = 2.4;
        let n = 1;
        const list = this.dinos.list;
        for (let i = 0; i < list.length && n < tr.length; i++) {
            const d = list[i];
            if (d.flyer || d.position.distanceToSquared(this.camera.position) > 3600) continue;
            tr[n].x = d.position.x;
            tr[n].y = d.position.y;
            tr[n].z = d.position.z;
            tr[n].radius = Math.max(1, d.length * 0.22);
            n++;
        }
        for (; n < tr.length; n++) tr[n].y = -999;
    }

    _frame(dt, t) {
        const playing = this.state === 'play';
        this.ctx.playing = playing;
        this.shake *= Math.exp(-6 * dt);
        this.park.update(dt, t, this.night);
        this._weather(dt, t);

        if (playing) {
            this.elapsed += dt;
            this.jeep.update(dt, this.input, this.world, this.wet);
        } else this.jeep.idle(dt);

        if (this.state !== 'pause') this.dinos.update(dt, t, this.ctx);

        let observe = null;
        if (playing) {
            if (this.dinos.trex.caught) this._caught();
            else observe = this._updateObserve(dt);
        }
        if (this.state === 'menu') this._heroCamera(t);
        else this._camera(dt, t, observe);

        this._effects(dt, t);
        this._tramplers();
        this.world.update(dt, t, this.camera, this.tramplers);

        if (!playing) return;
        const rexDist = this.ctx.jeepDist(this.dinos.trex);
        this.hud.setShake(this.dinos.trex.state === 'chase' && rexDist < 30);
        this.radioAcc += dt;
        if (this.radioAcc > 28) {
            this.radioAcc = 0;
            this.hud.randomRadio();
        }
        this.hud.tickRadio(dt);
        this.audio.update(dt, this.jeep.speed, this.rain, false);
        this.hudAccum += dt;
        if (this.hudAccum > 0.2) {
            this.hudAccum = 0;
            this.hud.setSpeed(Math.abs(this.jeep.speed) * 3.6, this.jeep.onRoad);
            this.hud.setTime(this.elapsed);
            this.hud.setFps(Math.round(this.stage.fps));
        }
    }

    /** Atalhos de depuração (?debug=1): window.__lab. */
    _debug() {
        const g = this;
        window.__lab = {
            game: g,
            stats: () => g.stage.stats(),
            tp(x, z, yaw = 0) {
                g.jeep.reset({ x, z, yaw }, g.world);
                g.camYaw = 0;
                g._snapCamera();
            },
            /** Leva o jipe para perto da espécie `id` (a `dist` m, olhando para ela). */
            goto(id, dist = 18, ang = 0) {
                const d = g.dinos.list.find((x) => x.id === id);
                const x = d.position.x + Math.cos(ang) * dist;
                const z = d.position.z + Math.sin(ang) * dist;
                this.tp(x, z, Math.atan2(d.position.x - x, d.position.z - z));
                return [Math.round(x), Math.round(z)];
            },
            observe(on) { g.input.observeHeld = on; },
            tod: (i) => g.setTod(i),
            rain: (on) => g.setRain(on),
            cam: (m) => { g.camMode = m; },
            /** Câmera livre: desliga a do jogo até free(false). */
            free(x, y, z, tx, ty, tz, fov = 45) {
                if (x === false) {
                    g._camera = Game.prototype._camera;
                    return;
                }
                g._camera = () => {
                    g.camera.position.set(x, y, z);
                    g.camera.fov = fov;
                    g.camera.updateProjectionMatrix();
                    g.camera.lookAt(tx, ty, tz);
                };
            },
            dino: (id, n = 0) => g.dinos.list.filter((x) => x.id === id)[n],
            log(id) {
                g.logged.add(id);
                g.hud.setLogged(id);
                if (g.logged.size >= SPECIES.length) g._win();
            }
        };
    }
}

const game = new Game();
game.init().catch((err) => {
    console.error(err);
    document.getElementById('errorOverlay').hidden = false;
    document.getElementById('loadingOverlay').hidden = true;
});
