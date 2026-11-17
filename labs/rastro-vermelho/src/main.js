/**
 * Rastro Vermelho — laço principal em three.js sobre o kit gráfico HDR (labs/shared/gfx).
 *
 * Quadro: cena em RGBA16F + MSAA → AO → neblina/poeira atmosférica → bloom → raios de sol
 * → ACES + gradação (gfx/post). O céu físico alimenta o IBL e o sol; a sombra segue o cavalo.
 *
 * A simulação (simulation.js) não mudou: x/z em metros, norte em +z. O desenho usa
 * X₃ = x, Z₃ = −z e rotação.y = π − yaw (ver terrain.js). O terreno é ruído em camadas;
 * a mesma altura é lida pelo cavaleiro, pela malha e pelo cenário transmitido em blocos.
 *
 * Resolução adaptativa (só em qualidade automática): a cada 0,6 s mede o fps; abaixo de 48
 * reduz o pixel ratio em 10 % (piso de 60 % do teto do tier), acima de 57 devolve 5 %.
 */
import * as THREE from 'three';
import { createPipeline } from '../../shared/gfx/post.js';
import { configureTextures } from '../../shared/gfx/textures.js';
import { detectSoftwareGL } from '../../shared/gfx/core.js';
import { clamp, damp, lerp, angleDelta, terrainHeight, roadX, biomeAt, LANDMARKS, freshPlayer, stepRiding, worldClock, loadSettings, saveSettings, loadJourney, saveJourney } from './simulation.js';
import { World, PROFILES } from './world.js?v=14';
import { loadKits } from './assets.js?v=14';
import { createMount, createOutlaw } from './actors.js?v=14';
import { Effects } from './effects.js?v=14';
import { Soundscape } from './audio.js';
const $ = s => document.querySelector(s), canvas = $('#scene');
const CHAPTERS = ['I · A carta', 'II · Santa Luz', 'III · A passagem', 'IV · Provisões', 'V · Sol poente', 'VI · A promessa'];
const DEAD_ZONE = .17;
const axis = value => Math.abs(value || 0) < DEAD_ZONE ? 0 : Math.sign(value) * (Math.abs(value) - DEAD_ZONE) / (1 - DEAD_ZONE);
const editable = el => el?.matches?.('input, select, textarea, button, summary, a');
function storage() { try { return window.localStorage; } catch { return { getItem: () => null, setItem: () => {} }; } }
function showError(error) { console.error(error); window.rastroLoadError(); }
/** Simulação (x, altura, z) → vetor do three. */
const V3 = (x, y, z, out = new THREE.Vector3()) => out.set(x, y, -z);
const HOOVES = ['FrontLowerLeg.L', 'FrontLowerLeg.R', 'BackLowerLeg.L', 'BackLowerLeg.R'];
class RastroVermelho {
    constructor() {
        this.storage = storage(); this.settings = loadSettings(this.storage); this.checkpoint = loadJourney(this.storage);
        this.state = 'loading'; this.elapsed = 0; this.time = 0; this.stage = 0;
        this.player = freshPlayer(); this.keys = {}; this.touch = { x: 0, z: 0, sprint: false }; this.pad = { steer: 0, throttle: 0, sprint: false, previous: [] };
        this.look = { yaw: 0, pitch: .2, distance: 6.5 }; this.enemies = []; this.encounterStage = -1;
        this.lastHud = 0; this.lastSave = 0; this.timeScale = 1; this.focusActive = false; this.aimTimer = 0; this.audio = new Soundscape();
        this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
        this.coarse = matchMedia('(pointer: coarse)').matches;
        this.ui = Object.fromEntries([...document.querySelectorAll('[id]')].map(el => [el.id, el]));
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false });
        this.software = detectSoftwareGL(this.renderer);
        this.profile = this.pickQuality();
        this.maxPr = Math.min(devicePixelRatio || 1, this.profile.pr); this.pr = this.maxPr;
        this.renderer.setPixelRatio(this.pr);
        this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFShadowMap;
        this.renderer.info.autoReset = false;
        configureTextures(this.renderer);
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(49, 1, .15, this.profile.far);
        this.cameraPosition = new THREE.Vector3(); this.cameraTarget = new THREE.Vector3(); this.lookAt = new THREE.Vector3();
        this._v = new THREE.Vector3(); this._w = new THREE.Vector3(); this._d = new THREE.Vector3();
        this.init().catch(error => { this.state = 'error'; this.audio.pause(); this.loop?.stop(); showError(error); });
    }
    /** GPU por software → sempre desempenho; automático: toque/poucos núcleos → desempenho, desktop comum → equilibrada, 10+ núcleos → cinemática. */
    pickQuality() {
        if (this.software) return PROFILES.low;
        if (PROFILES[this.settings.quality]) return PROFILES[this.settings.quality];
        const cores = navigator.hardwareConcurrency || 8, memory = navigator.deviceMemory || 8;
        if (matchMedia('(pointer: coarse)').matches || cores <= 4 || memory <= 4) return PROFILES.low;
        return cores >= 10 && memory >= 8 && Math.min(innerWidth, innerHeight) >= 700 ? PROFILES.high : PROFILES.medium;
    }
    async init() {
        const scene = this.scene;
        this.setLoading(.08, 'Carregando rochas, árvores e arreios…');
        const kits = await loadKits(this.profile.id === 'low' ? 2 : 8, f => this.setLoading(.08 + f * .2, 'Carregando rochas, árvores e arreios…'));
        this.setLoading(.3, 'Desenhando estradas e povoados…'); await new Promise(requestAnimationFrame);
        this.world = new World(scene, this.renderer, this.profile, kits);
        await this.world.createLandmarks(f => this.setLoading(.3 + f * .15, 'Desenhando estradas e povoados…'));
        this.setLoading(.46, 'Selando o cavalo…');
        this.horse = await createMount(); scene.add(this.horse.root);
        this.hoofY = HOOVES.map(() => [0, 0]);
        this.effects = new Effects(scene, this.camera, this.profile.id === 'low');
        this.post = createPipeline(this.renderer, { tier: this.profile.id, sky: this.world.sky, software: this.software });
        Object.assign(this.post.params, { exposure: 1, bloom: .09, ao: .9, aoRadius: 1, fogDensity: .0022, fogFalloff: .035, fogBase: 0, haze: .0006, fogSunGlow: .4, rays: .3, saturation: 1.06, contrast: 1.04, vignette: .3, grain: .016 });
        this.resetToCheckpoint(false); this.world.update(this.player.x, this.player.z);
        const total = Math.max(1, this.world.queue.length);
        while (this.world.queue.length) { this.world.update(this.player.x, this.player.z); this.setLoading(.5 + .4 * (1 - this.world.queue.length / total), 'O sol encontra a pradaria…'); await new Promise(requestAnimationFrame); }
        this.bindInput(); this.bindUi(); this.resize(); this.updateHorse(0, 0); this.placeCamera(true); this.updateAtmosphere(0);
        try { await this.renderer.compileAsync(scene, this.camera); } catch { /* compila sob demanda */ }
        this.render(.016);
        this.setLoading(1, 'A fronteira está pronta.'); this.ui.loadingOverlay.hidden = true; this.setState('menu');
        this.ui.startButton.focus({ preventScroll: true });
        this._last = performance.now();
        const tick = () => this.frame();
        if (window.LabRuntime) { this.loop = LabRuntime.createLoop(tick); this.loop.start(); }
        else { const run = () => { requestAnimationFrame(run); if (!document.hidden) tick(); }; requestAnimationFrame(run); }
        const resize = () => { this.resize(); this.placeCamera(true); };
        if (window.LabRuntime) LabRuntime.debounceResize(resize); else addEventListener('resize', resize);
        canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); if (this.state === 'play') this.togglePause(); this.ui.pauseTitle.textContent = 'Reconectando o cenário…'; this.ui.resumeButton.disabled = true; });
        canvas.addEventListener('webglcontextrestored', () => { this.ui.pauseTitle.textContent = 'A trilha está pronta.'; this.ui.resumeButton.disabled = false; });
    }
    resize() {
        const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
        this.renderer.setPixelRatio(this.pr); this.renderer.setSize(w, h, false);
        this.camera.aspect = w / Math.max(1, h);
        // retrato estreito: abre o campo de visão para cavalo e trilha caberem entre os painéis
        this.baseFov = this.camera.aspect < .8 ? 62 : 49;
        this.camera.fov = this.baseFov; this.camera.updateProjectionMatrix();
        this.camera.userData.bufferHeight = h * this.pr;
        this.post?.setSize();
    }
    render(dt) { this.renderer.info.reset(); this.post.render(this.scene, this.camera, dt); }
    bindInput() {
        const controls = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyE', 'KeyF', 'KeyR', 'KeyQ', 'KeyC', 'KeyG', 'KeyP', 'KeyM', 'Escape']);
        addEventListener('keydown', event => {
            if (event.code === 'Tab' && ['menu', 'pause', 'end'].includes(this.state)) { this.trapFocus(event); return; }
            if (editable(event.target)) return;
            if (!['play', 'pause'].includes(this.state) || !controls.has(event.code)) return;
            event.preventDefault();
            if (!event.repeat) {
                if (event.code === 'KeyP' || event.code === 'Escape') { this.togglePause(); return; }
                if (this.state !== 'play') return;
                if (event.code === 'KeyE') this.interact();
                if (event.code === 'KeyF') this.shoot();
                if (event.code === 'KeyR') this.reload();
                if (event.code === 'KeyQ') this.toggleFocus();
                if (event.code === 'KeyC') this.cycleCamera();
                if (event.code === 'KeyG') { this.player.cruise = !this.player.cruise; this.say(this.player.cruise ? 'Marcha automática. S ou rédea para trás para frear.' : 'Marcha manual.'); }
                if (event.code === 'KeyM') this.toggleSound();
            }
            if (this.state === 'play') this.keys[event.code] = true;
        });
        addEventListener('keyup', event => { this.keys[event.code] = false; });
        addEventListener('blur', () => { this.clearInput(); if (this.state === 'play') this.togglePause(); });
        document.addEventListener('visibilitychange', () => { if (document.hidden) { this.clearInput(); if (this.state === 'play') this.togglePause(); } });
        addEventListener('pagehide', () => this.persist());
        canvas.addEventListener('contextmenu', e => e.preventDefault());
        const bindLook = el => {
            let drag = null;
            el.addEventListener('pointerdown', e => { if (this.state !== 'play' || drag) return; drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0, button: e.button }; el.setPointerCapture(e.pointerId); canvas.focus({ preventScroll: true }); });
            el.addEventListener('pointermove', e => {
                if (!drag || e.pointerId !== drag.id || this.state !== 'play') return;
                const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.moved += Math.abs(dx) + Math.abs(dy);
                this.look.yaw += dx * .005 * this.settings.sensitivity; this.look.pitch = clamp(this.look.pitch + dy * .003 * this.settings.sensitivity, -.05, .72);
                drag.x = e.clientX; drag.y = e.clientY;
            });
            el.addEventListener('pointerup', e => { if (drag?.id !== e.pointerId) return; const fire = el === canvas && drag.moved < 7 && drag.button === 0 && e.pointerType !== 'touch'; drag = null; if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId); if (fire) this.shoot(); });
            const cancel = () => { drag = null; }; el.addEventListener('pointercancel', cancel); el.addEventListener('lostpointercapture', cancel); this.cancelLook = cancel;
        };
        bindLook(canvas); bindLook(this.ui.lookZone);
        canvas.addEventListener('wheel', e => { if (this.state !== 'play') return; e.preventDefault(); this.look.distance = clamp(this.look.distance + e.deltaY * .008, 3.6, 12); }, { passive: false });
        const stick = this.ui.moveStick; let pointer = null;
        const move = e => {
            if (e.pointerId !== pointer) return;
            const rect = stick.getBoundingClientRect(), radius = rect.width * .36, x = (e.clientX - rect.left - rect.width / 2) / radius, z = (rect.top + rect.height / 2 - e.clientY) / radius;
            const length = Math.max(1, Math.hypot(x, z)); this.touch.x = x / length; this.touch.z = z / length;
            this.ui.moveKnob.style.transform = `translate(${this.touch.x * radius}px, ${-this.touch.z * radius}px)`;
        };
        stick.addEventListener('pointerdown', e => { if (pointer !== null || this.state !== 'play') return; pointer = e.pointerId; stick.setPointerCapture(pointer); move(e); });
        stick.addEventListener('pointermove', move);
        const release = e => { if (e && e.pointerId !== pointer) return; const old = pointer; pointer = null; this.touch.x = this.touch.z = 0; this.ui.moveKnob.style.transform = ''; if (old !== null && stick.hasPointerCapture(old)) stick.releasePointerCapture(old); };
        for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) stick.addEventListener(name, release);
        this.releaseStick = release;
        const spur = this.ui.btnSpur;
        spur.addEventListener('pointerdown', e => { if (this.state !== 'play') return; spur.setPointerCapture(e.pointerId); this.touch.sprint = true; });
        for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) spur.addEventListener(name, () => { this.touch.sprint = false; });
        this.ui.btnShoot.addEventListener('click', () => this.shoot()); this.ui.btnReload.addEventListener('click', () => this.reload());
        this.ui.btnFocus.addEventListener('click', () => this.toggleFocus()); this.ui.interactButton.addEventListener('click', () => this.interact());
        addEventListener('gamepaddisconnected', () => { this.pad = { steer: 0, throttle: 0, sprint: false, previous: [] }; if (this.state === 'play') this.togglePause(); });
    }
    trapFocus(event) {
        const el = this.state === 'menu' ? this.ui.menuOverlay : this.state === 'pause' ? this.ui.pauseOverlay : this.ui.endOverlay;
        const nodes = [...el.querySelectorAll('button, select, input, summary, a')].filter(n => !n.disabled && n.getClientRects().length);
        if (!nodes.length) return;
        const first = nodes[0], last = nodes.at(-1);
        if (event.shiftKey && (document.activeElement === first || !el.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !el.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    }
    bindUi() {
        const ui = this.ui;
        ui.startButton.addEventListener('click', () => this.start()); ui.newButton.addEventListener('click', () => { this.resetToCheckpoint(true); this.start(); });
        ui.pauseButton.addEventListener('click', () => this.togglePause()); ui.resumeButton.addEventListener('click', () => this.togglePause());
        ui.pauseMenuButton.addEventListener('click', () => this.menu()); ui.endMenuButton.addEventListener('click', () => this.menu());
        ui.retryButton.addEventListener('click', () => { if (this.player.health <= 0) this.resetToCheckpoint(false); this.start(); });
        ui.soundButton.addEventListener('click', () => this.toggleSound());
        ui.qualitySelect.value = this.settings.quality;
        ui.qualitySelect.addEventListener('change', e => { this.settings.quality = e.target.value; this.applyQuality(); this.persist(); });
        ui.volumeSlider.value = this.settings.volume; ui.volumeValue.textContent = `${this.settings.volume}%`;
        ui.volumeSlider.addEventListener('input', e => { this.settings.volume = Number(e.target.value); ui.volumeValue.textContent = `${this.settings.volume}%`; this.audio.configure(this.settings); this.persist(); });
        ui.sensitivitySlider.value = this.settings.sensitivity;
        ui.sensitivitySlider.addEventListener('input', e => { this.settings.sensitivity = Number(e.target.value); this.persist(); });
        ui.motionToggle.checked = this.settings.reducedMotion || this.reducedMotion;
        ui.motionToggle.addEventListener('change', e => { this.settings.reducedMotion = e.target.checked; this.reducedMotion = e.target.checked; this.persist(); });
        ui.soundButton.setAttribute('aria-pressed', String(!this.settings.muted)); ui.touchControls.hidden = !this.coarse;
        this.updateMenu();
    }
    updateMenu() {
        this.ui.bestScore.textContent = `${Math.round(this.settings.best)} m`;
        this.ui.startLabel.textContent = this.hasStarted || this.checkpoint?.stage ? 'Retomar jornada' : 'Iniciar jornada';
        this.ui.newButton.hidden = !(this.hasStarted || this.checkpoint?.stage);
        this.ui.saveNote.textContent = this.stage ? `${Math.min(this.stage, 6)} de 6 destinos · progresso salvo no último destino` : 'O progresso é salvo em cada destino.';
    }
    clearInput() { this.keys = {}; this.touch = { x: 0, z: 0, sprint: false }; this.pad.steer = this.pad.throttle = 0; this.pad.sprint = false; this.releaseStick?.(); this.cancelLook?.(); }
    setState(state) {
        this.state = state; document.body.dataset.state = state; this.clearInput();
        this.ui.menuOverlay.hidden = state !== 'menu'; this.ui.pauseOverlay.hidden = state !== 'pause'; this.ui.endOverlay.hidden = state !== 'end';
        this.ui.hud.hidden = !['play', 'pause'].includes(state); this.ui.focusVeil.hidden = state !== 'play' || !this.focusActive;
        canvas.inert = state !== 'play'; this.ui.hud.inert = state !== 'play';
        if (state !== 'play') { this.focusActive = false; this.audio.pause(); }
    }
    start() {
        if (this.player.health <= 0) this.resetToCheckpoint(false);
        this.hasStarted = true; this.setState('play'); this.audio.start(this.settings); canvas.focus({ preventScroll: true }); this.placeCamera(true); this.updateHud();
        this.say(this.stage === 0 ? 'Sua história começa na fogueira. Aceite a carta para partir.' : 'Siga a trilha e o losango dourado. O oeste espera.', 5);
    }
    menu() { this.persist(); this.setState('menu'); this.updateMenu(); this.ui.startButton.focus({ preventScroll: true }); }
    togglePause() {
        if (this.state === 'play') { this.persist(); this.setState('pause'); this.ui.resumeButton.focus({ preventScroll: true }); }
        else if (this.state === 'pause') { this.setState('play'); this.audio.start(this.settings); canvas.focus({ preventScroll: true }); }
    }
    toggleSound() { this.settings.muted = !this.settings.muted; this.ui.soundButton.setAttribute('aria-pressed', String(!this.settings.muted)); this.audio.configure(this.settings); this.persist(); }
    cycleCamera() { this.look.distance = this.look.distance < 5 ? 6.5 : this.look.distance < 9 ? 10.5 : 3.8; this.look.yaw = 0; this.look.pitch = .2; }
    toggleFocus() { if (this.state !== 'play') return; if (!this.focusActive && this.player.focus < 15) { this.say('Recupere a concentração antes de usar o foco.'); return; } this.focusActive = !this.focusActive; }

    applyQuality() {
        // o tier muda malha, capim, sombras e pós: recarregar é mais seguro que remendar a cena
        if (this.pickQuality() !== this.profile) { this.persist(); location.reload(); return; }
        this.ui.saveNote.textContent = 'Qualidade aplicada.';
    }
    clearEnemies() { for (const e of this.enemies) this.scene.remove(e.root); this.enemies = []; }
    resetToCheckpoint(fresh) {
        if (fresh) { this.checkpoint = null; this.elapsed = 0; }
        const saved = fresh ? null : this.checkpoint;
        this.stage = saved?.stage || 0; this.player = freshPlayer();
        if (saved) Object.assign(this.player, { money: saved.money, distance: saved.distance, kills: saved.kills });
        const p = LANDMARKS[Math.max(0, Math.min(5, this.stage - 1))]; this.player.x = p.x + 6; this.player.z = p.z - 5;
        this.look.yaw = 0; this.look.pitch = .2; this.focusActive = false;
        this.clearEnemies(); this.encounterStage = -1;
        if (this.world) this.world.update(this.player.x, this.player.z, true);
        if (fresh) { saveJourney(this.storage, 0, this.player); this.hasStarted = false; }
    }
    persist() { this.settings.best = Math.max(this.settings.best, this.player.distance); saveSettings(this.storage, this.settings); }
    saveCheckpoint() { saveJourney(this.storage, this.stage, this.player); this.checkpoint = { stage: this.stage, money: this.player.money, distance: this.player.distance, kills: this.player.kills }; this.persist(); }
    say(text, duration = 3.5) { this.ui.message.textContent = text; this.ui.message.dataset.show = 'true'; this.messageRemaining = duration; }
    setLoading(progress, text) { this.ui.loadingFill.style.width = `${progress * 100}%`; this.ui.loadingFill.parentElement.setAttribute('aria-valuenow', Math.round(progress * 100)); this.ui.loadingText.textContent = text; }
    readGamepad(dt) {
        const controller = [...(navigator.getGamepads?.() || [])].find(p => p?.mapping === 'standard');
        if (!controller) { this.pad.steer = this.pad.throttle = 0; this.pad.sprint = false; return; }
        const pressed = controller.buttons.map(b => b.pressed), edge = i => pressed[i] && !this.pad.previous[i];
        if (edge(9) && ['play', 'pause'].includes(this.state)) this.togglePause();
        if (this.state === 'play') {
            this.pad.steer = axis(controller.axes[0]); this.pad.throttle = -axis(controller.axes[1]); this.pad.sprint = pressed[0];
            this.look.yaw += axis(controller.axes[2]) * dt * 1.9 * this.settings.sensitivity; this.look.pitch = clamp(this.look.pitch + axis(controller.axes[3]) * dt * 1.2, -.05, .72);
            if (pressed[7]) this.shoot(); if (edge(2)) this.reload(); if (edge(3)) this.interact(); if (edge(4)) this.toggleFocus(); if (edge(5)) this.cycleCamera();
        }
        this.pad.previous = pressed;
    }
    frame() {
        if (document.hidden) return;
        const now = performance.now(), raw = Math.max(0, (now - this._last) / 1000), dt = Math.min(raw, .05); this._last = now;
        this.time += dt;
        this.readGamepad(dt);
        if (this.state === 'play') this.update(dt);
        else {
            const p = this.player, live = this.state === 'pause' ? 0 : dt;
            if (this.state === 'menu') { this.world.update(p.x, p.z); this.menuCamera(dt); }
            this.updateHorse(live, 0); this.updateAtmosphere(live); this.effects.update(live);
        }
        this.render(dt);
        // Adapta só a qualidade automática, sob pressão contínua de GPU e com o streaming em dia.
        this._acc = (this._acc || 0) + raw; this._frames = (this._frames || 0) + 1;
        if (this._acc >= .6) {
            this.fps = this._frames / this._acc; this._acc = 0; this._frames = 0;
            if (this.state === 'play' && this.settings.quality === 'auto' && !this.software && !this.world.queue.length) {
                let next = this.pr;
                if (this.fps < 48) next = Math.max(this.maxPr * .6, this.pr * .9); else if (this.fps > 57) next = Math.min(this.maxPr, this.pr * 1.05);
                if (Math.abs(next - this.pr) >= .03) { this.pr = next; this.resize(); }
            }
        }
    }
    update(dt) {
        this.elapsed += dt; this.lastHud += dt; this.lastSave += dt;
        const p = this.player;
        const throttle = (this.keys.KeyW || this.keys.ArrowUp ? 1 : 0) - (this.keys.KeyS || this.keys.ArrowDown ? 1 : 0) + this.touch.z + this.pad.throttle;
        const steer = (this.keys.KeyD || this.keys.ArrowRight ? 1 : 0) - (this.keys.KeyA || this.keys.ArrowLeft ? 1 : 0) + this.touch.x + this.pad.steer;
        if (throttle < -.1) p.cruise = false;
        this.timeScale = damp(this.timeScale, this.focusActive ? .32 : 1, 8, dt);
        p.focus = clamp(p.focus + (this.focusActive ? -22 : 7) * dt, 0, 100);
        if (p.focus === 0) this.focusActive = false;
        const simDt = dt * this.timeScale;
        const riding = stepRiding(p, { throttle, steer, sprint: this.keys.ShiftLeft || this.keys.ShiftRight || this.keys.Space || this.touch.sprint || this.pad.sprint }, simDt, this.world.colliders);
        if (riding.obstacle && !this.obstacleCooldown) { this.say('Obstáculo à frente. Reduza e contorne.'); this.obstacleCooldown = 3; }
        this.obstacleCooldown = Math.max(0, (this.obstacleCooldown || 0) - dt);
        this.aimTimer = Math.max(0, this.aimTimer - dt);
        this.updateHorse(simDt, steer); this.placeCamera(false, dt); this.world.update(p.x, p.z); this.updateAtmosphere(dt);
        this.updateEncounter(simDt); this.updateHooves(); this.effects.update(simDt);
        this.hitRemaining = Math.max(0, (this.hitRemaining || 0) - simDt); if (!this.hitRemaining) this.ui.hitMarker.dataset.show = 'false';
        this.audio.update(dt, p.speed, worldClock(this.elapsed).hour);
        this.messageRemaining = Math.max(0, (this.messageRemaining || 0) - dt); if (!this.messageRemaining) this.ui.message.dataset.show = 'false';
        this.damage = Math.max(0, (this.damage || 0) - dt * 1.4); this.ui.damageVeil.style.opacity = this.damage;
        this.ui.focusVeil.hidden = !this.focusActive; this.ui.btnFocus.setAttribute('aria-pressed', String(this.focusActive));
        if (this.lastHud > .1) { this.updateHud(); this.lastHud = 0; }
        if (this.lastSave > 15) { this.persist(); this.lastSave = 0; }
    }
    updateHorse(dt, steer) {
        const p = this.player, root = this.horse.root, y = terrainHeight(p.x, p.z), ahead = terrainHeight(p.x + Math.sin(p.yaw) * 1.2, p.z + Math.cos(p.yaw) * 1.2);
        root.position.set(p.x, y, -p.z); root.rotation.order = 'YXZ'; root.rotation.y = Math.PI - p.yaw;
        // frente do modelo = +Z: subir a ladeira é girar −X; a inclinação nas curvas acompanha a rédea
        root.rotation.x = damp(root.rotation.x, clamp(-(ahead - y) / 1.2, -.32, .32), 5, dt || 1);
        root.rotation.z = damp(root.rotation.z, steer * .06 * clamp(p.speed / 10, 0, 1), 4, dt || 1);
        const aiming = this.aimTimer > 0 || (this.focusActive && this.liveEnemies().length > 0);
        this.horse.update(dt, p.speed, steer, aiming, clamp(angleDelta(0, this.look.yaw), -1.5, 1.5), clamp((this.aimPitch || 0), -.5, .5));
    }
    /** Poeira a cada batida de casco: o osso da canela passa pelo ponto mais baixo (dy troca de sinal). */
    updateHooves() {
        const p = this.player;
        if (this.settings.reducedMotion || this.reducedMotion || p.speed < 2.5) return;
        const dx = Math.sin(p.yaw) * p.speed, dz = -Math.cos(p.yaw) * p.speed;
        HOOVES.forEach((name, i) => {
            const bone = this.horse.horse.bones[name]; if (!bone) return;
            bone.getWorldPosition(this._v);
            const h = this.hoofY[i], dy = this._v.y - h[0];
            if (h[1] < 0 && dy >= 0) this.effects.dust(this._v.x, terrainHeight(this._v.x, -this._v.z), this._v.z, 1 + p.speed * .16, dx, dz);
            h[0] = this._v.y; h[1] = dy;
        });
        const sky = this.world.sky;
        this.effects.light.copy(sky.lightColor).multiplyScalar(.5 + sky.lightIntensity * .2);
    }
    placeCamera(snap, dt = 1 / 60) {
        const p = this.player, heading = p.yaw + this.look.yaw, distance = this.look.distance, y = terrainHeight(p.x, p.z), cam = this.cameraPosition;
        const bob = this.settings.reducedMotion || this.reducedMotion ? 0 : Math.sin(p.phase * 1.7) * .02 * clamp(p.speed / 12, 0, 1);
        let cx = p.x - Math.sin(heading) * distance, cz = p.z - Math.cos(heading) * distance, cy = y + 2.5 + this.look.pitch * distance * .75 + bob;
        // A câmera fica acima do terreno (inclusive no trecho entre ela e o cavaleiro) e fora dos volumes de colisão.
        cy = Math.max(cy, terrainHeight(cx, cz) + 1.1);
        for (let i = 1; i < 5; i++) { const t = i / 5, gx = lerp(p.x, cx, t), gz = lerp(p.z, cz, t); cy = Math.max(cy, (terrainHeight(gx, gz) + .7 - (y + 2.1) * (1 - t)) / t); }
        for (const o of this.world.colliders || []) {
            const dx = cx - o.x, dz = cz - o.z, d = Math.hypot(dx, dz), r = o.radius + .6;
            if (d < r) { cx = o.x + dx / (d || 1) * r; cz = o.z + dz / (d || 1) * r; cy = Math.max(cy, y + 3.4); }
        }
        cam.set(cx, cy, -cz);
        if (snap) this.camera.position.copy(cam); else this.camera.position.lerp(cam, 1 - Math.exp(-dt * 7));
        this.camera.position.y = Math.max(this.camera.position.y, terrainHeight(this.camera.position.x, -this.camera.position.z) + .7);
        // retrato e paisagem curta: mira mais baixo para o cavalo ficar no meio da tela, entre a missão e os controles
        V3(p.x + Math.sin(heading) * 4, y + (this.camera.aspect < .8 ? .3 : canvas.clientHeight < 520 ? 1.1 : 2) + this.look.pitch * .8, p.z + Math.cos(heading) * 4, this.cameraTarget);
        if (snap) this.lookAt.copy(this.cameraTarget); else this.lookAt.lerp(this.cameraTarget, 1 - Math.exp(-dt * 12));
        this.camera.lookAt(this.lookAt);
        const fov = this.focusActive ? this.baseFov * .84 : this.baseFov + (this.settings.reducedMotion ? 0 : p.speed * .3);
        this.camera.fov = damp(this.camera.fov, fov, 3, dt); this.camera.updateProjectionMatrix();
    }
    menuCamera(dt) {
        const p = this.player, y = terrainHeight(p.x, p.z), a = 2.55 + Math.sin(performance.now() * .00007) * .14, portrait = this.camera.aspect < .8;
        V3(p.x + Math.sin(a) * (portrait ? 9 : 7.2), y + 2.1, p.z + Math.cos(a) * (portrait ? 9 : 7.2), this.cameraPosition);
        this.camera.position.lerp(this.cameraPosition, 1 - Math.exp(-dt * 1.1));
        // Desloca o cavaleiro para a direita e deixa espaço para o título.
        const off = clamp((this.camera.aspect - .8) * 2.2, 0, 2.4);
        this.camera.lookAt(V3(p.x + off * Math.cos(a), y + (portrait ? 2.6 : 1.5), p.z - off * Math.sin(a), this._w));
    }
    /** Céu, sol, vento, fogueiras e exposição: noite clareada para a trilha continuar legível. */
    updateAtmosphere(dt) {
        const p = this.player, sky = this.world.sky, params = this.post.params;
        this.world.animate(dt, this.time, p.x, p.z, this.elapsed);
        const day = clamp(sky.daylight, 0, 1), f = clamp((1 - this.timeScale) / .68, 0, 1);
        params.exposure = lerp(2.3, 1.02, day);
        params.saturation = lerp(1.06, .62, f); params.vignette = lerp(.3, .55, f); params.contrast = lerp(1.04, 1.14, f);
        params.grain = this.settings.reducedMotion || this.reducedMotion ? 0 : .016;
    }
    target() { return LANDMARKS[Math.min(this.stage, 5)]; }
    liveEnemies() { return this.enemies.filter(e => e.health > 0); }
    interaction() {
        const p = this.player, target = this.target(), distance = Math.hypot(target.x - p.x, target.z - p.z);
        if (distance < 13 && this.stage < 6) {
            if (this.liveEnemies().length) return { label: 'Neutralize os bandidos da passagem', blocked: true };
            if (p.speed > 4) return { label: 'Freie para interagir', blocked: true };
            return { label: target.action, mission: true };
        }
        const camp = LANDMARKS.find(l => l.id < this.stage && Math.hypot(l.x - p.x, l.z - p.z) < 12);
        if (camp && p.speed < 4 && !this.liveEnemies().some(e => Math.hypot(e.x - p.x, e.z - p.z) < 50)) return { label: 'Descansar e reabastecer', rest: true };
        return null;
    }
    interact() {
        if (this.state !== 'play') return; const action = this.interaction(); if (!action || action.blocked) return;
        this.player.speed = 0; this.player.cruise = false; this.player.stamina = this.player.health = this.player.focus = 100; this.player.ammo = 6; this.player.reload = 0; this.player.tired = false;
        if (action.rest) { this.say('Cavalo descansado. Vigor, foco e munição recuperados.'); this.audio.reward(); return; }
        const target = this.target(); this.player.money += target.reward; this.stage++; this.audio.reward(); this.saveCheckpoint();
        this.say(`${target.story}${target.reward ? ` +$ ${target.reward}` : ''}`, 5);
        this.updateHud();
        if (this.stage === 6) this.finish(true);
    }
    updateEncounter(dt) {
        const t = this.target(), p = this.player;
        if (this.stage < 6 && t.enemies && this.encounterStage !== this.stage && Math.hypot(t.x - p.x, t.z - p.z) < 62) {
            this.clearEnemies(); this.encounterStage = this.stage;
            for (let i = 0; i < t.enemies; i++) {
                const actor = createOutlaw(i + this.stage);
                const x = roadX(t.z) + (i % 2 ? 8 : -8), z = t.z - 22 + i * 7;
                actor.root.position.set(x, terrainHeight(x, z), -z); this.scene.add(actor.root);
                this.enemies.push({ ...actor, x, z, homeX: x, homeZ: z, health: 2, timer: 2.2 + i * .7, phase: i * 2, warning: false });
            }
            this.say('Emboscada. Mire nos bandidos e atire. Q / Foco desacelera o tempo.', 6);
        }
        for (const e of this.enemies) {
            if (e.health <= 0) { e.update(dt, false, true); continue; }
            const distance = Math.hypot(e.x - p.x, e.z - p.z); e.root.rotation.y = Math.PI - Math.atan2(p.x - e.x, p.z - e.z);
            if (distance > 65) { e.warning = false; e.update(dt, false, false); continue; }
            e.phase += dt; e.timer -= dt;
            // Small lateral movement, bound to the encounter. No pursuit across the entire world.
            const nx = e.homeX + Math.sin(e.phase * .65) * 2.5;
            if (!(this.world.colliders || []).some(o => Math.hypot(nx - o.x, e.z - o.z) < o.radius + .4)) e.x = nx;
            e.root.position.set(e.x, terrainHeight(e.x, e.z), -e.z);
            e.warning = e.timer < .85 && distance < 48 && this.hasLineOfSight(e.x, e.z, p.x, p.z);
            e.update(dt, e.warning, false);
            if (e.timer <= 0) {
                e.timer = 2.5 + (e.phase % 1);
                if (e.warning) {
                    e.root.updateMatrixWorld(true); e.muzzleWorld(this._v); V3(p.x, terrainHeight(p.x, p.z) + 1.7, p.z, this._w);
                    this._d.subVectors(this._w, this._v).normalize(); this.effects.muzzle(this._v, this._d); this.effects.tracer(this._v, this._w, 1, .72, .42);
                    // Riding evasively mitigates damage; warnings give a deterministic reaction window.
                    if (p.speed < 12) { p.health = Math.max(0, p.health - (p.speed > 7 ? 7 : 14)); this.damage = .6; this.audio.burst(.12, .1, 1600); }
                    if (!p.health) { this.finish(false); return; }
                }
            }
        }
    }
    hasLineOfSight(ax, az, bx, bz) {
        const dx = bx - ax, dz = bz - az, length2 = dx * dx + dz * dz;
        if (!length2) return true;
        for (const o of this.world.colliders || []) {
            const t = clamp(((o.x - ax) * dx + (o.z - az) * dz) / length2, 0, 1);
            if (t > .03 && t < .97 && Math.hypot(ax + dx * t - o.x, az + dz * t - o.z) < o.radius) return false;
        }
        const ya = terrainHeight(ax, az) + 1.6, yb = terrainHeight(bx, bz) + 2;
        for (let i = 1; i < 8; i++) { const t = i / 8; if (terrainHeight(lerp(ax, bx, t), lerp(az, bz, t)) > lerp(ya, yb, t)) return false; }
        return true;
    }
    aimTarget() {
        const p = this.player, heading = p.yaw + this.look.yaw, cone = this.coarse ? .65 : this.focusActive ? .38 : .23;
        let result = null, score = Infinity;
        for (const e of this.liveEnemies()) {
            const distance = Math.hypot(e.x - p.x, e.z - p.z), angle = Math.abs(angleDelta(heading, Math.atan2(e.x - p.x, e.z - p.z)));
            if (distance > 65 || angle > cone || !this.hasLineOfSight(p.x, p.z, e.x, e.z)) continue;
            const next = angle * 80 + distance * .12;
            if (next < score) { score = next; result = e; }
        }
        return result;
    }
    shoot() {
        const p = this.player; if (this.state !== 'play' || p.cooldown > 0 || p.reload > 0) return;
        if (p.ammo === 0) { this.reload(); return; }
        p.ammo--; p.cooldown = .3; this.audio.shot();
        const enemy = this.aimTarget(), heading = p.yaw + this.look.yaw, y = terrainHeight(p.x, p.z);
        const end = enemy ? V3(enemy.x, terrainHeight(enemy.x, enemy.z) + 1.25, enemy.z, this._w) : V3(p.x + Math.sin(heading) * 55, y + 1.6 - this.look.pitch * 6, p.z + Math.cos(heading) * 55, this._w);
        // ergue o braço antes de ler a boca do cano: o clarão sai do revólver, não do ombro
        this.aimTimer = .7; this.aimPitch = Math.atan2(end.y - (y + 2.1), Math.hypot(end.x - p.x, end.z + p.z));
        this.horse.state.aim = 1; this.updateHorse(0, 0);
        const start = this.horse.muzzleWorld(this._v);
        this._d.subVectors(end, start).normalize();
        this.effects.muzzle(start, this._d); this.effects.tracer(start, end, 1, .85, .55);
        if (enemy) {
            enemy.health -= this.focusActive ? 2 : 1; this.ui.hitMarker.dataset.show = 'true'; this.hitRemaining = .18; this.effects.impact(end, true);
            if (enemy.health <= 0) { p.kills++; p.focus = clamp(p.focus + 12, 0, 100); enemy.warning = false; this.say(this.liveEnemies().length ? 'Acertou. Mantenha a atenção.' : 'Passagem livre. Aproxime-se do destino.', 2.5); }
        } else {
            end.y = terrainHeight(end.x, -end.z) + .1; this.effects.impact(end);
        }
        this.updateHud();
    }
    reload() { if (this.state !== 'play' || this.player.reload || this.player.ammo === 6) return; this.player.reload = 1.8; this.audio.reload(); this.say('Recarregando o tambor…', 1.8); }
    finish(success) {
        this.persist(); this.setState('end');
        this.ui.endEyebrow.textContent = success ? 'A FRONTEIRA SE LEMBRA' : 'A ESTRADA COBROU SEU PREÇO';
        this.ui.endTitle.innerHTML = success ? 'Promessa<br>cumprida.' : 'O rastro<br>não termina aqui.';
        this.ui.endText.textContent = success ? `Seis destinos. ${Math.round(this.player.distance)} metros de história. $ ${this.player.money} em recompensas. O território continua aberto para você.` : 'Você volta ao último destino concluído, com o cavalo descansado e o tambor cheio.';
        this.ui.retryButton.textContent = success ? 'Continuar explorando →' : 'Retomar do último destino →';
        this.ui.retryButton.focus({ preventScroll: true });
    }
    updateHud() {
        const p = this.player, ui = this.ui, t = this.target(), live = this.liveEnemies();
        ui.regionName.textContent = biomeAt(p.x, p.z); ui.clockValue.textContent = worldClock(this.elapsed).label;
        ui.speedValue.textContent = Math.round(p.speed * 3.6); ui.gaitValue.textContent = p.tired ? 'recuperando' : p.speed < .15 ? 'parado' : p.speed < 5 ? 'passo' : p.speed < 10 ? 'trote' : p.speed < 14 ? 'galope' : 'disparada';
        ui.healthMeter.value = p.health; ui.staminaMeter.value = p.stamina; ui.focusMeter.value = p.focus;
        ui.ammoValue.textContent = p.reload > 0 ? '↻' : p.ammo; ui.moneyValue.textContent = `$ ${p.money}`;
        ui.weaponHint.textContent = p.reload > 0 ? `Recarregando ${p.reload.toFixed(1)} s` : this.focusActive ? 'Concentração ativa' : live.length ? `${live.length} bandido${live.length === 1 ? '' : 's'} · mire e atire` : 'R · recarregar';
        ui.chapterLabel.textContent = this.stage < 6 ? `CAPÍTULO ${CHAPTERS[this.stage].toUpperCase()}` : 'JORNADA CONCLUÍDA';
        ui.objectiveTitle.textContent = this.stage < 6 ? t.name : 'O oeste é seu';
        ui.objectiveText.textContent = this.stage >= 6 ? 'Explore a fronteira. Descanse nos acampamentos.' : live.length ? 'Libere a passagem. Use o foco para ganhar tempo.' : this.stage === 0 ? 'Aceite a carta na fogueira para iniciar a jornada.' : `${Math.round(Math.hypot(t.x - p.x, t.z - p.z))} m · siga o losango dourado`;
        if (this.hudStage !== this.stage) { ui.markPips.innerHTML = LANDMARKS.map((_, i) => `<i data-on="${i < this.stage}"></i>`).join(''); ui.markPips.setAttribute('aria-label', `${this.stage} de 6 destinos concluídos`); this.hudStage = this.stage; }
        const action = this.interaction(); ui.interactButton.hidden = !action; ui.interactButton.disabled = !!action?.blocked; ui.interactionText.textContent = action?.label || '';
        const aim = this.aimTarget(); ui.reticle.dataset.target = !!aim; ui.reticle.classList.toggle('threat', live.some(e => e.warning));
        this.drawMap(); this.updateWaypoint();
    }
    updateWaypoint() {
        const ui = this.ui; ui.waypoint.hidden = this.stage >= 6;
        if (this.stage >= 6) return;
        const t = this.target(), w = canvas.clientWidth, h = canvas.clientHeight;
        const point = V3(t.x, terrainHeight(t.x, t.z) + 3, t.z, this._v).project(this.camera), px = (point.x * .5 + .5) * w, py = (1 - (point.y * .5 + .5)) * h;
        const heading = this.player.yaw + this.look.yaw, difference = angleDelta(heading, Math.atan2(t.x - this.player.x, t.z - this.player.z));
        const behind = Math.abs(difference) > Math.PI / 2;
        ui.waypoint.style.left = `${clamp(behind ? difference > 0 ? w - 24 : 24 : px, 24, w - 24)}px`;
        ui.waypoint.style.top = `${clamp(behind ? h * .45 : py, h < 520 ? 104 : 190, h - (this.coarse ? 215 : 125))}px`;
        ui.waypointDistance.textContent = `${behind ? difference > 0 ? '→ ' : '← ' : ''}${Math.round(Math.hypot(t.x - this.player.x, t.z - this.player.z))} m`;
    }
    drawMap() {
        const ctx = this.ui.minimap.getContext('2d'), p = this.player, size = 240, scale = 1.4;
        ctx.clearRect(0, 0, size, size); ctx.save(); ctx.beginPath(); ctx.arc(120, 120, 113, 0, Math.PI * 2); ctx.clip();
        ctx.fillStyle = '#d0bd92'; ctx.fillRect(0, 0, size, size);
        ctx.strokeStyle = '#aa996f'; ctx.lineWidth = 1;
        for (let i = -8; i < 9; i++) { ctx.beginPath(); for (let x = 0; x <= 240; x += 8) { const y = 120 + i * 22 + Math.sin(x * .025 + i + p.z * .006) * 13; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); }
        const map = (x, z) => [120 + (x - p.x) * scale, 120 - (z - p.z) * scale];
        ctx.strokeStyle = '#8c7858'; ctx.lineWidth = 5; ctx.beginPath();
        for (let z = p.z - 95; z <= p.z + 95; z += 3) { const [x, y] = map(roadX(z), z); z === p.z - 95 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke();
        for (const l of LANDMARKS) { const [x, y] = map(l.x, l.z); ctx.fillStyle = l.id < this.stage ? '#62583b' : '#752b21'; ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4); ctx.fillRect(-4, -4, 8, 8); ctx.restore(); }
        for (const e of this.liveEnemies()) { const [x, y] = map(e.x, e.z); ctx.fillStyle = e.warning ? '#ffebbe' : '#a02c22'; ctx.beginPath(); ctx.arc(x, y, e.warning ? 6 : 4, 0, Math.PI * 2); ctx.fill(); }
        ctx.translate(120, 120); ctx.rotate(p.yaw); ctx.fillStyle = '#262c28'; ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6, 7); ctx.lineTo(0, 4); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill(); ctx.restore();
        ctx.strokeStyle = '#e8d6ac'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(120, 120, 115, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#f5e9cb'; ctx.font = 'bold 17px Georgia'; ctx.textAlign = 'center'; ctx.fillText('N', 120, 17);
    }
    /** Diagnóstico para testes: fps medido e carga de desenho do último quadro. */
    stats() { const i = this.renderer.info.render; return { fps: Math.round(this.fps || 0), calls: i.calls, triangles: i.triangles, pr: +this.pr.toFixed(2), tier: this.profile.id }; }
}
export let game = null;
try {
    game = new RastroVermelho(); window.__rastro = game;
} catch (error) { showError(error); }
