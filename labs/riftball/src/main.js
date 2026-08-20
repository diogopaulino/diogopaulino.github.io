/**
 * Riftball — laço principal, câmera, modos (online / local / CPU) e attract.
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import {
    STORAGE_KEY, QUALITY, DT, MAX_STEPS, NET, TEAMS
} from './config.js';
import { clamp, lerp, wrapPi, detectMobile, detectSoftwareGL } from './utils.js';
import { Input } from './input.js';
import { GameAudio } from './audio.js';
import { Hud } from './hud.js';
import { World } from './world.js';
import { createCraft, createBall, syncCraft, syncBall } from './crafts.js';
import { Effects } from './effects.js';
import { createMatch, step, snapshot, applySnapshot, blankInput } from './physics.js';
import { aiInput } from './ai.js';
import { Net, randomCode, roomUrl } from './net.js';

const CAMERAS = ['chase', 'broadcast', 'orbit'];

class Game {
    constructor() {
        this.hud = new Hud();
        this.input = new Input();
        this.audio = new GameAudio();
        this.net = new Net();
        this.canvas = document.getElementById('scene');
        this.settings = this.loadSettings();
        this.state = 'boot';
        this.mode = 'attract';
        this.match = createMatch();
        this.inputs = [blankInput(), blankInput()];
        this.guestInput = blankInput();
        this.localSlot = 0;
        this.accum = 0;
        this.time = 0;
        this.last = performance.now();
        this.paused = false;
        this.cameraMode = 0;
        this.fps = 60;
        this.fpsAccum = 0;
        this.fpsFrames = 0;
        this.netAccum = 0;
        this.inputAccum = 0;
        this.snaps = [];
        this.pendingEvents = [];
        this.mobile = detectMobile();
        this._camPos = new THREE.Vector3();
        this._look = new THREE.Vector3();
        this._wanted = new THREE.Vector3();
        this._dir = new THREE.Vector3();
        this._lookFrom = new THREE.Vector3();
    }

    loadSettings() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) return { quality: 'auto', volume: 70, muted: false, ...JSON.parse(raw) };
        } catch { /* ignore */ }
        return { quality: 'auto', volume: 70, muted: false };
    }

    saveSettings() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
        } catch { /* ignore */ }
    }

    qualityPreset() {
        let key = this.settings.quality;
        if (key === 'auto') key = (this.mobile || detectSoftwareGL()) ? 'low' : 'high';
        return QUALITY[key] || QUALITY.medium;
    }

    async boot() {
        this.hud.setLoading(0.12, 'Abrindo o rift…');
        const quality = this.qualityPreset();
        this.quality = quality;

        try {
            this.renderer = new THREE.WebGLRenderer({
                canvas: this.canvas,
                antialias: quality.antialias,
                powerPreference: 'high-performance',
                stencil: false
            });
        } catch {
            this.hud.showError('Este laboratório precisa de WebGL. Ative a aceleração de hardware.');
            return;
        }

        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.pixelRatio));
        this.renderer.setSize(window.innerWidth, window.innerHeight, false);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.05;
        this.renderer.shadowMap.enabled = quality.shadows;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.15, 420);
        this.camera.position.set(0, 18, 28);

        this.hud.setLoading(0.4, 'Montando a arena…');
        this.world = new World(this.scene, quality);
        this.crafts = [createCraft(0), createCraft(1)];
        this.crafts.forEach((c) => this.scene.add(c));
        this.ball = createBall();
        this.scene.add(this.ball);
        this.effects = new Effects(this.scene, quality.particles);

        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        if (quality.bloom) {
            this.bloom = new UnrealBloomPass(
                new THREE.Vector2(window.innerWidth, window.innerHeight),
                0.48,
                0.62,
                0.78
            );
            this.composer.addPass(this.bloom);
        }
        this.composer.addPass(new OutputPass());

        this.hud.setLoading(0.78, 'Sintonizando o éter…');
        this.bindUi();
        this.bindNet();
        window.addEventListener('resize', () => this.resize());
        this.resize();

        this.hud.hideLoading();
        this.enterAttract();
        this.loop();
        window.LabVisibility?.whenVisible(() => this.loop());

        const sala = new URLSearchParams(window.location.search).get('sala');
        if (sala) {
            this.hud.els.joinForm.hidden = false;
            this.hud.els.joinCode.value = sala.trim().toUpperCase();
            this.startJoin(sala);
        }
    }

    bindUi() {
        if (this.hud.els.quality) {
            this.hud.els.quality.value = this.settings.quality;
            this.hud.els.quality.addEventListener('change', () => {
                this.settings.quality = this.hud.els.quality.value;
                this.saveSettings();
            });
        }
        if (this.hud.els.volume) {
            this.hud.els.volume.value = this.settings.volume;
            this.hud.els.volumeValue.textContent = String(this.settings.volume);
            this.hud.els.volume.addEventListener('input', () => {
                this.settings.volume = Number(this.hud.els.volume.value);
                this.hud.els.volumeValue.textContent = this.hud.els.volume.value;
                this.audio.setVolume(this.settings.volume / 100);
                this.saveSettings();
            });
        }

        document.getElementById('hostButton')?.addEventListener('click', () => this.startHost());
        document.getElementById('joinToggle')?.addEventListener('click', () => {
            const form = this.hud.els.joinForm;
            form.hidden = !form.hidden;
        });
        document.getElementById('joinForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.startJoin(this.hud.els.joinCode.value);
        });
        document.getElementById('localButton')?.addEventListener('click', () => this.startMatch('local'));
        document.getElementById('cpuButton')?.addEventListener('click', () => this.startMatch('cpu'));
        document.getElementById('copyLinkButton')?.addEventListener('click', () => this.copyRoom());
        document.getElementById('cancelLobbyButton')?.addEventListener('click', () => this.backToMenu());
        document.getElementById('resumeButton')?.addEventListener('click', () => this.togglePause(false));
        document.getElementById('pauseMenuButton')?.addEventListener('click', () => this.backToMenu());
        document.getElementById('replayButton')?.addEventListener('click', () => this.replay());
        document.getElementById('resultMenuButton')?.addEventListener('click', () => this.backToMenu());
        document.getElementById('pauseButton')?.addEventListener('click', () => this.togglePause());
        document.getElementById('soundButton')?.addEventListener('click', () => this.toggleMute());

        this.input.on('pause', () => this.togglePause());
        this.input.on('mute', () => this.toggleMute());
        this.input.on('camera', () => {
            this.cameraMode = (this.cameraMode + 1) % CAMERAS.length;
        });
        this.input.bindTouch({
            zone: document.getElementById('steerZone'),
            knob: document.getElementById('steerKnob'),
            boost: document.getElementById('boostPad'),
            jump: document.getElementById('jumpPad')
        });
        this.hud.setMuted(this.settings.muted);
        this.audio.setVolume(this.settings.volume / 100);
        this.audio.setEnabled(!this.settings.muted);

        const unlock = () => this.audio.init();
        window.addEventListener('pointerdown', unlock, { once: true });
        window.addEventListener('keydown', unlock, { once: true });
    }

    bindNet() {
        this.net.on('connected', () => {
            this.hud.setLobbyStatus('Hover no rift. Vai começar.');
            if (this.net.role === 'host') {
                this.startMatch('online-host');
            } else {
                this.startMatch('online-guest');
            }
        });
        this.net.on('disconnected', () => {
            this.hud.announce('conexão caiu', 2);
            this.hud.setNet('offline');
        });
        this.net.on('error', (msg) => {
            this.hud.setLobbyStatus(msg);
        });
        this.net.on('warn', (msg) => this.hud.setLobbyStatus(msg));
        this.net.on('message', (msg) => this.onNet(msg));
    }

    onNet(msg) {
        if (!msg || !msg.type) return;
        if (this.mode === 'online-host' && msg.type === 'input') {
            this.guestInput = {
                throttle: clamp(msg.throttle || 0, -1, 1),
                steer: clamp(msg.steer || 0, -1, 1),
                boost: Boolean(msg.boost),
                jump: Boolean(msg.jump)
            };
        }
        if (this.mode === 'online-guest' && msg.type === 'state') {
            this.snaps.push({ t: performance.now() / 1000, snap: msg.snap, events: msg.events || [] });
            if (this.snaps.length > 24) this.snaps.shift();
            if (msg.events) this.handleEvents(msg.events, false);
        }
    }

    enterAttract() {
        this.mode = 'attract';
        this.state = 'menu';
        this.match = createMatch();
        this.paused = false;
        this.hud.showMenu();
        this.hud.setTouch(false);
        this.audio.setMode('menu');
        this.net.destroy();
    }

    async startHost() {
        this.audio.init();
        this.audio.blip();
        const code = randomCode();
        this.hud.showLobby(code);
        this.state = 'lobby';
        this.mode = 'lobby';
        await this.net.host(code);
    }

    async startJoin(raw) {
        this.audio.init();
        const code = String(raw || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
        if (code.length < 4) {
            this.hud.els.joinForm.hidden = false;
            this.hud.els.joinCode.focus();
            return;
        }
        this.audio.blip();
        this.hud.showLobby(code);
        this.hud.setLobbyStatus('Procurando o host no rift…');
        this.state = 'lobby';
        this.mode = 'lobby';
        await this.net.join(code);
    }

    async copyRoom() {
        if (!this.net.code) return;
        const url = roomUrl(this.net.code);
        try {
            await navigator.clipboard.writeText(url);
            this.hud.setLobbyStatus('Link copiado. Manda para a outra pessoa.');
        } catch {
            this.hud.setLobbyStatus(url);
        }
        this.audio.blip();
    }

    startMatch(mode) {
        this.audio.init();
        this.audio.blip();
        this.mode = mode;
        this.state = 'play';
        this.paused = false;
        this.match = createMatch();
        this.snaps.length = 0;
        this.pendingEvents = [];
        this.guestInput = blankInput();
        this.localSlot = mode === 'online-guest' ? 1 : 0;
        this.hud.showHud();
        this.hud.setTouch(this.mobile && mode !== 'local');
        this.hud.setNames(TEAMS[0].name, TEAMS[1].name);
        this.hud.setScore(this.match.score, this.match.clock, false);
        this.hud.announce('Riftball', 1.1);
        this.audio.setMode('play');
        this.audio.whistle();
        if (mode === 'online-host') this.hud.setNet(this.net.transport === 'broadcast' ? 'abas' : 'P2P host');
        else if (mode === 'online-guest') this.hud.setNet('P2P');
        else this.hud.setNet(mode === 'local' ? '2P local' : mode === 'cpu' ? 'CPU' : '');
        this.input.localMultiplayer = mode === 'local';
        this.input.enabled = true;
    }

    replay() {
        if (this.mode === 'online-guest') return;
        if (this.mode === 'online-host' || this.mode === 'local' || this.mode === 'cpu') {
            this.startMatch(this.mode);
        } else {
            this.startMatch('cpu');
        }
    }

    backToMenu() {
        this.net.destroy();
        this.hud.showPause(false);
        this.enterAttract();
        const url = new URL(window.location.href);
        url.searchParams.delete('sala');
        history.replaceState({}, '', url);
    }

    togglePause(force) {
        if (this.state !== 'play') return;
        if (this.mode.startsWith('online')) return;
        this.paused = typeof force === 'boolean' ? force : !this.paused;
        this.hud.showPause(this.paused);
        this.input.enabled = !this.paused;
    }

    toggleMute() {
        this.settings.muted = !this.settings.muted;
        this.audio.setEnabled(!this.settings.muted);
        this.hud.setMuted(this.settings.muted);
        this.saveSettings();
    }

    handleEvents(events, localSim) {
        const attract = this.mode === 'attract';
        for (const ev of events) {
            if (ev.type === 'kick') {
                this.effects.burst(ev.x, ev.y, ev.z, TEAMS[ev.team].color, 10 + ev.impact * 2, 7);
                if (localSim && !attract) this.audio.kickHit(ev.impact);
            }
            if (ev.type === 'bump') {
                this.effects.burst(ev.x, ev.y, ev.z, 0xffffff, 8, 5);
                if (localSim && !attract) this.audio.bump();
            }
            if (ev.type === 'goal') {
                this.effects.burst(ev.x, ev.y, ev.z, TEAMS[ev.team].color, 48, 14);
                this.effects.shockwave(ev.x, ev.z, TEAMS[ev.team].color);
                if (!attract) {
                    this.hud.announce(`GOL · ${TEAMS[ev.team].name}`, 1.8);
                    this.audio.setMode('goal');
                    this.audio.goal();
                    window.setTimeout(() => this.audio.setMode('play'), 1600);
                }
            }
            if (attract) continue;
            if (ev.type === 'play') this.hud.announce('vai', 0.7);
            if (ev.type === 'overtime') this.hud.announce('gol de ouro', 1.6);
            if (ev.type === 'over') {
                const w = TEAMS[ev.winner];
                this.hud.showResult(w.name, ev.score || this.match.score, ev.overtime);
                this.audio.setMode('menu');
                this.state = 'result';
            }
        }
    }

    sim(dt) {
        if (this.mode === 'online-guest') return;

        this.inputs[0] = blankInput();
        this.inputs[1] = blankInput();

        if (this.mode === 'attract') {
            this.inputs[0] = aiInput(this.match.crafts[0], this.match.crafts[1], this.match.ball, 0);
            this.inputs[1] = aiInput(this.match.crafts[1], this.match.crafts[0], this.match.ball, 1);
        } else if (this.mode === 'cpu') {
            this.inputs[0] = this.input.sample(0);
            this.inputs[1] = aiInput(this.match.crafts[1], this.match.crafts[0], this.match.ball, 1);
        } else if (this.mode === 'local') {
            this.inputs[0] = this.input.sample(0);
            this.inputs[1] = this.input.sample(1);
        } else if (this.mode === 'online-host') {
            this.inputs[0] = this.input.sample(0);
            this.inputs[1] = this.guestInput;
            this.guestInput = { ...this.guestInput, jump: false };
        }

        step(this.match, this.inputs, dt);
        this.handleEvents(this.match.events, true);
        if (this.mode === 'online-host' && this.match.events.length) {
            this.pendingEvents.push(...this.match.events);
        }

        if (this.mode === 'attract' && this.match.phase === 'over') {
            this.match = createMatch();
        }
    }

    sendNet(dt) {
        if (this.mode === 'online-host') {
            this.netAccum += dt;
            if (this.netAccum >= NET.tick) {
                this.netAccum = 0;
                this.net.send({
                    type: 'state',
                    snap: snapshot(this.match),
                    events: this.pendingEvents.splice(0, this.pendingEvents.length)
                });
            }
        }
        if (this.mode === 'online-guest') {
            this.inputAccum += dt;
            if (this.inputAccum >= NET.inputTick) {
                this.inputAccum = 0;
                const inp = this.input.sample(0);
                this.net.send({ type: 'input', ...inp });
            }
        }
    }

    applyGuestView() {
        if (this.snaps.length < 2) {
            if (this.snaps[0]) applySnapshot(this.match, this.snaps[0].snap);
            return;
        }
        const now = performance.now() / 1000 - NET.delay;
        let a = this.snaps[0];
        let b = this.snaps[this.snaps.length - 1];
        for (let i = 0; i < this.snaps.length - 1; i++) {
            if (this.snaps[i].t <= now && this.snaps[i + 1].t >= now) {
                a = this.snaps[i];
                b = this.snaps[i + 1];
                break;
            }
        }
        const span = Math.max(1e-4, b.t - a.t);
        const t = clamp((now - a.t) / span, 0, 1);
        const sa = a.snap;
        const sb = b.snap;
        for (let i = 0; i < 2; i++) {
            const ca = sa.crafts[i];
            const cb = sb.crafts[i];
            const c = this.match.crafts[i];
            c.x = lerp(ca.x, cb.x, t);
            c.y = lerp(ca.y, cb.y, t);
            c.z = lerp(ca.z, cb.z, t);
            c.yaw = ca.yaw + wrapPi(cb.yaw - ca.yaw) * t;
            c.boost = lerp(ca.boost, cb.boost, t);
            c.boosting = cb.boosting;
        }
        const ba = sa.ball;
        const bb = sb.ball;
        this.match.ball.x = lerp(ba.x, bb.x, t);
        this.match.ball.y = lerp(ba.y, bb.y, t);
        this.match.ball.z = lerp(ba.z, bb.z, t);
        this.match.score[0] = sb.score[0];
        this.match.score[1] = sb.score[1];
        this.match.phase = sb.phase;
        this.match.clock = sb.clock;
        this.match.overtime = sb.overtime;
    }

    updateCamera(dt) {
        const mode = CAMERAS[this.cameraMode];
        const p1 = this.match.crafts[0];
        const p2 = this.match.crafts[1];
        const ball = this.match.ball;
        const me = this.match.crafts[this.localSlot];

        if (this.mode === 'attract' || mode === 'orbit') {
            const ang = this.time * 0.12;
            this._wanted.set(Math.sin(ang) * 34, 16, Math.cos(ang) * 34);
            this._look.set(0, 1.2, 0);
        } else if (mode === 'broadcast' || this.mode === 'local') {
            const cx = (p1.x + p2.x + ball.x) / 3;
            const cz = (p1.z + p2.z + ball.z) / 3;
            const spread = Math.max(
                Math.hypot(p1.x - p2.x, p1.z - p2.z),
                Math.hypot(p1.x - ball.x, p1.z - ball.z),
                14
            );
            this._wanted.set(cx, 9 + spread * 0.38, cz + 16 + spread * 0.2);
            this._look.set(cx, 1, cz);
        } else {
            const hx = Math.sin(me.yaw);
            const hz = Math.cos(me.yaw);
            this._wanted.set(me.x - hx * 9.5, me.y + 4.2, me.z - hz * 9.5);
            this._look.set(me.x + hx * 4 + ball.x * 0.08, 1.1, me.z + hz * 4 + ball.z * 0.08);
        }

        this._camPos.lerp(this._wanted, 1 - Math.exp(-3.2 * dt));
        this.camera.position.copy(this._camPos);
        this.camera.getWorldDirection(this._dir);
        this._lookFrom.copy(this._look).sub(this.camera.position).normalize();
        this._dir.lerp(this._lookFrom, 1 - Math.exp(-4 * dt));
        this._lookFrom.copy(this.camera.position).add(this._dir);
        this.camera.lookAt(this._lookFrom);
    }

    resize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h, false);
        this.composer.setSize(w, h);
        this.bloom?.setSize(w, h);
    }

    loop = () => {
        if (document.hidden) return;
        requestAnimationFrame(this.loop);
        const now = performance.now();
        let dt = (now - this.last) / 1000;
        this.last = now;
        if (dt > 0.08) dt = 0.08;
        this.time += dt;

        this.fpsAccum += dt;
        this.fpsFrames += 1;
        if (this.fpsAccum >= 0.4) {
            this.fps = Math.round(this.fpsFrames / this.fpsAccum);
            this.fpsAccum = 0;
            this.fpsFrames = 0;
            this.hud.setFps(this.fps, this.settings.quality === 'low');
        }

        if (!this.paused) {
            this.accum += dt;
            let steps = 0;
            while (this.accum >= DT && steps < MAX_STEPS) {
                this.sim(DT);
                this.accum -= DT;
                steps += 1;
            }
            this.sendNet(dt);
            if (this.mode === 'online-guest') this.applyGuestView();
        }

        syncCraft(this.crafts[0], this.match.crafts[0], dt);
        syncCraft(this.crafts[1], this.match.crafts[1], dt);
        syncBall(this.ball, this.match.ball, this.time);
        this.effects.trail(0, this.match.crafts[0].x, this.match.crafts[0].y, this.match.crafts[0].z, this.match.crafts[0].boosting);
        this.effects.trail(1, this.match.crafts[1].x, this.match.crafts[1].y, this.match.crafts[1].z, this.match.crafts[1].boosting);
        this.effects.update(dt);
        this.world.update(dt, this.time);
        this.updateCamera(dt);

        if (this.state === 'play' || this.state === 'result') {
            this.hud.setScore(this.match.score, this.match.clock, this.match.overtime);
            const me = this.match.crafts[this.localSlot];
            this.hud.setBoost(me.boost);
        }
        this.hud.tick(this.time);

        this.composer.render();
    };
}

const game = new Game();
game.boot();
