/**
 * Rastro Vermelho — Babylon.js edition.
 * The terrain uses layered value noise; its height is sampled by the rider,
 * the terrain mesh, and the streamed scenery so the world remains continuous.
 */
import { clamp, damp, lerp, angleDelta, terrainHeight, roadX, biomeAt, LANDMARKS, freshPlayer, stepRiding, worldClock, loadSettings, saveSettings, loadJourney, saveJourney } from './simulation.js';
import { World, PROFILES, loadHorse, createPerson, material } from './world.js';
import { Soundscape } from './audio.js';
const B = window.BABYLON, $ = s => document.querySelector(s), canvas = $('#scene');
const CHAPTERS = ['I · A carta', 'II · Santa Luz', 'III · A passagem', 'IV · Provisões', 'V · Sol poente', 'VI · A promessa'];
const DEAD_ZONE = .17;
const axis = value => Math.abs(value || 0) < DEAD_ZONE ? 0 : Math.sign(value) * (Math.abs(value) - DEAD_ZONE) / (1 - DEAD_ZONE);
const editable = el => el?.matches('input, select, textarea, button, summary, a');
function storage() { try { return window.localStorage; } catch { return { getItem: () => null, setItem: () => {} }; } }
function showError(error) { console.error(error); window.rastroLoadError(); }
class RastroVermelho {
    constructor() {
        this.storage = storage(); this.settings = loadSettings(this.storage); this.checkpoint = loadJourney(this.storage);
        this.profile = this.pickQuality(); this.state = 'loading'; this.elapsed = 0; this.stage = 0;
        this.player = freshPlayer(); this.keys = {}; this.touch = { x: 0, z: 0, sprint: false }; this.pad = { steer: 0, throttle: 0, sprint: false, previous: [] };
        this.look = { yaw: 0, pitch: .2, distance: 8 }; this.enemies = []; this.encounterStage = -1; this.effects = [];
        this.lastHud = 0; this.lastSave = 0; this.badFrames = 0; this.frameAverage = 16.7; this.timeScale = 1; this.focusActive = false; this.audio = new Soundscape();
        this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
        this.coarse = matchMedia('(pointer: coarse)').matches;
        this.ui = Object.fromEntries([...document.querySelectorAll('[id]')].map(el => [el.id, el]));
        this.engine = new B.Engine(canvas, true, { preserveDrawingBuffer: false, stencil: false, powerPreference: 'high-performance', adaptToDeviceRatio: false });
        this.engine.setHardwareScalingLevel(1 / Math.min(devicePixelRatio || 1, this.profile.scale));
        this.scene = new B.Scene(this.engine); this.scene.skipPointerMovePicking = true; this.scene.autoClear = true;
        this.scene.fogMode = B.Scene.FOGMODE_EXP2; this.scene.fogDensity = this.profile.id === 'high' ? .005 : .007;
        this.scene.fogColor = B.Color3.FromHexString('#b0b3a2'); this.scene.clearColor = new B.Color4(.57, .66, .71, 1);
        this.cameraPosition = new B.Vector3(); this.cameraTarget = new B.Vector3(); this.sunsetFog = B.Color3.FromHexString('#a68a75'); this.dayFog = B.Color3.FromHexString('#a4b6ba'); this.nightFog = B.Color3.FromHexString('#26313e');
        this.init().catch(error => { this.state = 'error'; this.audio.pause(); this.engine.stopRenderLoop(); showError(error); });
    }
    pickQuality() {
        try {
            const c = document.createElement('canvas');
            const gl = c.getContext('webgl2') || c.getContext('webgl');
            if (gl) {
                const info = gl.getExtension('WEBGL_debug_renderer_info');
                const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) || '') : '';
                if (/swiftshader|llvmpipe|softpipe|microsoft basic render|\bcpu\b/i.test(name)) {
                    return PROFILES.low;
                }
            } else {
                return PROFILES.low;
            }
        } catch { /* ignore */ }
        return PROFILES[this.settings.quality]
            || (matchMedia('(pointer: coarse)').matches ? PROFILES.low : PROFILES.medium);
    }
    async init() {
        const scene = this.scene;
        this.camera = new B.UniversalCamera('câmera', new B.Vector3(0, 14, -12), scene);
        this.camera.minZ = .15; this.camera.maxZ = 1800; this.camera.fov = .86; this.camera.inputs.clear();
        this.sky = B.MeshBuilder.CreateSphere('céu', { diameter: 2800, sideOrientation: B.Mesh.BACKSIDE, segments: 24 }, scene);
        this.skyMaterial = new B.SkyMaterial('atmosfera', scene); this.skyMaterial.backFaceCulling = false;
        this.skyMaterial.useSunPosition = true; this.skyMaterial.turbidity = 2.2; this.skyMaterial.rayleigh = 2.1; this.skyMaterial.mieCoefficient = .004; this.skyMaterial.mieDirectionalG = .8;
        this.sky.material = this.skyMaterial; this.sky.isPickable = false; this.sky.applyFog = false; this.sky.infiniteDistance = true;
        this.sun = new B.DirectionalLight('sol', new B.Vector3(-.6, -.5, .5), scene); this.sun.intensity = 2.3;
        this.sun.autoUpdateExtends = false; this.sun.autoCalcShadowZBounds = false; this.sun.shadowMinZ = 1; this.sun.shadowMaxZ = 190;
        this.sun.orthoLeft = -42; this.sun.orthoRight = 42; this.sun.orthoTop = 42; this.sun.orthoBottom = -42;
        this.hemi = new B.HemisphericLight('luz-do-céu', B.Axis.Y, scene); this.hemi.intensity = .75; this.hemi.groundColor.set(.25, .22, .17);
        this.shadow = new B.ShadowGenerator(this.profile.shadowSize, this.sun); this.shadow.usePercentageCloserFiltering = true;
        this.shadow.filteringQuality = B.ShadowGenerator.QUALITY_LOW; this.shadow.bias = .001; this.shadow.normalBias = .025; this.shadow.setDarkness(.23);
        this.pipeline = new B.DefaultRenderingPipeline('cinema', true, scene, [this.camera]); this.pipeline.samples = 1; this.pipeline.fxaaEnabled = true;
        this.pipeline.bloomEnabled = this.profile.bloom; this.pipeline.bloomThreshold = 1.15; this.pipeline.bloomWeight = .13; this.pipeline.bloomKernel = 32;
        this.pipeline.imageProcessing.toneMappingEnabled = true; this.pipeline.imageProcessing.toneMappingType = B.ImageProcessingConfiguration.TONEMAPPING_ACES;
        this.pipeline.imageProcessing.exposure = 1.05; this.pipeline.imageProcessing.contrast = 1.06;
        this.setLoading(.15, 'Desenhando estradas e povoados…'); this.world = new World(scene, this.shadow, this.profile);
        this.setLoading(.35, 'Selando o cavalo…');
        let timeout;
        try { this.horse = await Promise.race([loadHorse(scene, this.shadow, this.world.mats), new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Tempo de carregamento do cavalo excedido.')), 30000); })]); }
        finally { clearTimeout(timeout); }
        this.resetToCheckpoint(false); this.world.update(this.player.x, this.player.z);
        const total = this.world.queue.length;
        while (this.world.queue.length) { this.world.update(this.player.x, this.player.z); this.setLoading(.5 + .4 * (1 - this.world.queue.length / total), 'O sol encontra a pradaria…'); await new Promise(requestAnimationFrame); }
        this.createDust(); this.createHorizon(); this.bindInput(); this.bindUi(); this.updateHorse(0, 0); this.placeCamera(true); this.updateAtmosphere();
        await scene.whenReadyAsync();
        this.setLoading(1, 'A fronteira está pronta.'); this.ui.loadingOverlay.hidden = true; this.setState('menu');
        this.ui.startButton.focus({ preventScroll: true });
        this._renderLoop = () => this.frame();
        if (window.LabRuntime) LabRuntime.bindBabylonLoop(this.engine, this._renderLoop); else this.engine.runRenderLoop(this._renderLoop);
        const resize = () => { this.engine.resize(); this.placeCamera(true); };
        if (window.LabRuntime) LabRuntime.debounceResize(resize); else addEventListener('resize', resize);
        this.engine.onContextLostObservable.add(() => { if (this.state === 'play') this.togglePause(); this.ui.pauseTitle.textContent = 'Reconectando o cenário…'; this.ui.resumeButton.disabled = true; });
        this.engine.onContextRestoredObservable.add(() => { this.ui.pauseTitle.textContent = 'A trilha está pronta.'; this.ui.resumeButton.disabled = false; });
    }
    createHorizon() {
        // A coarse distant landscape fills the horizon without streaming high-detail tiles.
        this.horizon = B.MeshBuilder.CreateGround('serras-distantes', { width: 3200, height: 3200, subdivisions: 90 }, this.scene);
        const positions = this.horizon.getVerticesData(B.VertexBuffer.PositionKind);
        for (let i = 0; i < positions.length; i += 3) positions[i + 1] = terrainHeight(positions[i], positions[i + 2]) - 9;
        this.horizon.setVerticesData(B.VertexBuffer.PositionKind, positions); this.horizon.createNormals(false);
        this.horizon.material = material(this.scene, 'terra-distante', '#77816a'); this.horizon.isPickable = false; this.horizon.freezeWorldMatrix();
    }
    createDust() {
        const texture = new B.DynamicTexture('poeira-textura', 64, this.scene, false), ctx = texture.getContext();
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32); gradient.addColorStop(0, 'rgba(220,193,145,.45)'); gradient.addColorStop(1, 'rgba(220,193,145,0)');
        ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64); texture.update();
        this.dust = new B.ParticleSystem('poeira-dos-cascos', this.profile.id === 'low' ? 55 : 140, this.scene);
        this.dust.particleTexture = texture; this.dust.emitter = new B.Vector3(); this.dust.minEmitBox.set(-.4, 0, -.3); this.dust.maxEmitBox.set(.4, .1, .3);
        this.dust.color1 = new B.Color4(.7, .58, .37, .2); this.dust.color2 = new B.Color4(.65, .54, .35, .15); this.dust.colorDead = new B.Color4(.6, .5, .35, 0);
        this.dust.minSize = .3; this.dust.maxSize = 1; this.dust.minLifeTime = .4; this.dust.maxLifeTime = 1.3;
        this.dust.direction1.set(-.4, .2, -.4); this.dust.direction2.set(.4, .5, .4); this.dust.minEmitPower = .3; this.dust.maxEmitPower = .8;
        this.dust.blendMode = B.ParticleSystem.BLENDMODE_STANDARD; this.dust.emitRate = 0; this.dust.start();
    }
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
        canvas.addEventListener('wheel', e => { if (this.state !== 'play') return; e.preventDefault(); this.look.distance = clamp(this.look.distance + e.deltaY * .008, 4.5, 13); }, { passive: false });
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
        if (state !== 'play') { this.focusActive = false; this.audio.pause(); if (this.dust) this.dust.emitRate = 0; }
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
    cycleCamera() { this.look.distance = this.look.distance < 6 ? 8 : this.look.distance < 10 ? 12 : 4.5; this.look.yaw = 0; this.look.pitch = .2; }
    toggleFocus() { if (this.state !== 'play') return; if (!this.focusActive && this.player.focus < 15) { this.say('Recupere a concentração antes de usar o foco.'); return; } this.focusActive = !this.focusActive; }
    applyQuality() {
        this.profile = this.pickQuality(); this.engine.setHardwareScalingLevel(1 / Math.min(devicePixelRatio || 1, this.profile.scale));
        this.shadow.getShadowMap().resize(this.profile.shadowSize); this.pipeline.bloomEnabled = this.profile.bloom;
        this.scene.fogDensity = this.profile.id === 'high' ? .005 : .007;
        this.world.setProfile(this.profile); this.world.update(this.player.x, this.player.z); this.engine.resize(); this.badFrames = 0;
        this.ui.saveNote.textContent = 'Qualidade aplicada. Os detalhes do cenário estão sendo atualizados.';
    }
    resetToCheckpoint(fresh) {
        if (fresh) { this.checkpoint = null; this.elapsed = 0; }
        const saved = fresh ? null : this.checkpoint;
        this.stage = saved?.stage || 0; this.player = freshPlayer();
        if (saved) Object.assign(this.player, { money: saved.money, distance: saved.distance, kills: saved.kills });
        const p = LANDMARKS[Math.max(0, Math.min(5, this.stage - 1))]; this.player.x = p.x + 6; this.player.z = p.z - 5;
        this.look.yaw = 0; this.look.pitch = .2; this.focusActive = false;
        for (const e of this.enemies) { e.root.getChildMeshes().forEach(m => this.shadow.removeShadowCaster(m)); e.root.dispose(); }
        this.enemies = []; this.encounterStage = -1;
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
        const raw = this.engine.getDeltaTime() / 1000, dt = Math.min(raw, .05);
        this.readGamepad(dt);
        if (this.state === 'play') this.update(dt);
        else if (this.state === 'menu') { this.world.update(this.player.x, this.player.z); this.menuCamera(dt); this.updateAtmosphere(); }
        this.sky.position.copyFrom(this.camera.position);
        this.scene.render();
        // Adapt only automatic quality, after sustained GPU pressure and after streaming finishes.
        this.frameAverage = damp(this.frameAverage, raw * 1000, .8, dt);
        if (this.state === 'play' && this.settings.quality === 'auto' && !this.world.queue.length) {
            this.badFrames = this.frameAverage > 27 ? this.badFrames + dt : Math.max(0, this.badFrames - dt);
            if (this.badFrames > 5 && this.engine.getHardwareScalingLevel() < 1.6) { this.engine.setHardwareScalingLevel(Math.min(1.6, this.engine.getHardwareScalingLevel() + .15)); this.engine.resize(); this.badFrames = 0; }
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
        if (riding.obstacle && !this.obstacleCooldown) { this.say('Obstacle devant. Reduza e contorne.'.replace('Obstacle devant.', 'Obstáculo à frente.')); this.obstacleCooldown = 3; }
        this.obstacleCooldown = Math.max(0, (this.obstacleCooldown || 0) - dt);
        this.updateHorse(simDt, steer); this.placeCamera(false, dt); this.world.update(p.x, p.z); this.updateAtmosphere(); this.world.animate(this.elapsed, p.x, p.z);
        this.updateEncounter(simDt); this.updateEffects(simDt);
        this.dust.emitter.set(p.x, terrainHeight(p.x, p.z) + .12, p.z - Math.cos(p.yaw) * .6);
        this.dust.emitRate = this.settings.reducedMotion || this.reducedMotion ? 0 : p.speed > 4 ? Math.min(45, p.speed * 2.4) : 0;
        this.dust.updateSpeed = .01 * this.timeScale;
        this.audio.update(dt, p.speed, worldClock(this.elapsed).hour);
        this.messageRemaining = Math.max(0, (this.messageRemaining || 0) - dt); if (!this.messageRemaining) this.ui.message.dataset.show = 'false';
        this.damage = Math.max(0, (this.damage || 0) - dt * 1.4); this.ui.damageVeil.style.opacity = this.damage;
        this.ui.focusVeil.hidden = !this.focusActive; this.ui.btnFocus.setAttribute('aria-pressed', String(this.focusActive));
        if (this.lastHud > .1) { this.updateHud(); this.lastHud = 0; }
        if (this.lastSave > 15) { this.persist(); this.lastSave = 0; }
    }
    updateHorse(dt, steer) {
        const p = this.player, y = terrainHeight(p.x, p.z), ahead = terrainHeight(p.x + Math.sin(p.yaw) * 1.2, p.z + Math.cos(p.yaw) * 1.2);
        this.horse.root.position.set(p.x, y, p.z); this.horse.root.rotation.y = p.yaw;
        this.horse.root.rotation.x = damp(this.horse.root.rotation.x, clamp(-(ahead - y) / 1.2, -.32, .32), 5, dt || 1);
        this.horse.root.rotation.z = damp(this.horse.root.rotation.z, -steer * .05 * clamp(p.speed / 10, 0, 1), 4, dt || 1);
        this.horse.update(p.speed, p.phase, steer);
    }
    placeCamera(snap, dt = 1 / 60) {
        const p = this.player, heading = p.yaw + this.look.yaw, distance = this.look.distance, y = terrainHeight(p.x, p.z);
        const bob = this.settings.reducedMotion || this.reducedMotion ? 0 : Math.sin(p.phase * 1.7) * .022 * clamp(p.speed / 12, 0, 1);
        this.cameraPosition.set(p.x - Math.sin(heading) * distance, y + 3.2 + this.look.pitch * distance * .7 + bob, p.z - Math.cos(heading) * distance);
        // Camera is clamped over terrain and outside building/tree collision volumes.
        this.cameraPosition.y = Math.max(this.cameraPosition.y, terrainHeight(this.cameraPosition.x, this.cameraPosition.z) + 1.2);
        for (const o of this.world.colliders || []) {
            const dx = this.cameraPosition.x - o.x, dz = this.cameraPosition.z - o.z, d = Math.hypot(dx, dz), r = o.radius + .5;
            if (d < r) { this.cameraPosition.x = o.x + dx / (d || 1) * r; this.cameraPosition.z = o.z + dz / (d || 1) * r; this.cameraPosition.y = Math.max(this.cameraPosition.y, y + 4); }
        }
        if (snap) this.camera.position.copyFrom(this.cameraPosition); else B.Vector3.LerpToRef(this.camera.position, this.cameraPosition, 1 - Math.exp(-dt * 7), this.camera.position);
        this.camera.position.y = Math.max(this.camera.position.y, terrainHeight(this.camera.position.x, this.camera.position.z) + .8);
        this.cameraTarget.set(p.x + Math.sin(heading) * 4, y + 2 + this.look.pitch, p.z + Math.cos(heading) * 4);
        this.camera.setTarget(this.cameraTarget); this.camera.fov = damp(this.camera.fov, this.focusActive ? .72 : .86 + (this.settings.reducedMotion ? 0 : p.speed * .003), 3, dt);
    }
    menuCamera(dt) {
        const p = this.player, y = terrainHeight(p.x, p.z), a = .95 + Math.sin(performance.now() * .00007) * .12;
        this.cameraPosition.set(p.x + Math.sin(a) * 11, y + 4.2, p.z + Math.cos(a) * 11);
        B.Vector3.LerpToRef(this.camera.position, this.cameraPosition, 1 - Math.exp(-dt * 1.1), this.camera.position);
        // Offset the subject to the right to leave room for the title.
        this.camera.setTarget(new B.Vector3(p.x + 3.3, y + 2, p.z - 1.5));
    }
    updateAtmosphere() {
        const { hour } = worldClock(this.elapsed), angle = (hour - 6) / 12 * Math.PI, elevation = Math.sin(angle), day = clamp(elevation * 3, 0, 1);
        this.sun.direction.set(-.65, -Math.max(.08, elevation), .45); this.sun.direction.normalize();
        this.sun.position.set(this.player.x - this.sun.direction.x * 85, terrainHeight(this.player.x, this.player.z) - this.sun.direction.y * 85, this.player.z - this.sun.direction.z * 85);
        this.sun.intensity = .07 + Math.max(0, elevation) * 2.2; this.sun.diffuse.set(1, lerp(.62, .95, day), lerp(.38, .87, day));
        this.hemi.intensity = lerp(.28, .8, day);
        this.skyMaterial.sunPosition.set(-100, elevation * 100, 60); this.skyMaterial.luminance = lerp(.1, .85, day);
        this.skyMaterial.rayleigh = lerp(1, 2.2, day);
        B.Color3.LerpToRef(this.sunsetFog, this.dayFog, day, this.scene.fogColor);
        if (elevation < 0) B.Color3.LerpToRef(this.scene.fogColor, this.nightFog, clamp(-elevation * 5, 0, 1), this.scene.fogColor);
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
            for (const e of this.enemies) { e.root.getChildMeshes().forEach(m => this.shadow.removeShadowCaster(m)); e.root.dispose(); }
            this.enemies = []; this.encounterStage = this.stage;
            for (let i = 0; i < t.enemies; i++) {
                const actor = createPerson(this.scene, { ...this.world.mats, coat: this.world.mats.darkWood, scarf: this.world.mats.scarf });
                const x = roadX(t.z) + (i % 2 ? 8 : -8), z = t.z - 22 + i * 7;
                actor.root.position.set(x, terrainHeight(x, z), z); actor.root.getChildMeshes().forEach(m => this.shadow.addShadowCaster(m));
                this.enemies.push({ ...actor, x, z, homeX: x, homeZ: z, health: 2, timer: 2.2 + i * .7, phase: i * 2, warning: false });
            }
            this.say('Emboscada. Mire nos bandidos e atire. Q / Foco desacelera o tempo.', 6);
        }
        for (const e of this.enemies) {
            if (e.health <= 0) continue;
            const distance = Math.hypot(e.x - p.x, e.z - p.z); e.root.rotation.y = Math.atan2(p.x - e.x, p.z - e.z);
            if (distance > 65) { e.warning = false; continue; }
            e.phase += dt; e.timer -= dt;
            // Small lateral movement, bound to the encounter. No pursuit across the entire world.
            const nx = e.homeX + Math.sin(e.phase * .65) * 2.5;
            if (!(this.world.colliders || []).some(o => Math.hypot(nx - o.x, e.z - o.z) < o.radius + .4)) e.x = nx;
            e.root.position.set(e.x, terrainHeight(e.x, e.z), e.z);
            e.warning = e.timer < .85 && distance < 48 && this.hasLineOfSight(e.x, e.z, p.x, p.z);
            e.gun.rotation.x = e.warning ? -.35 : .6;
            if (e.timer <= 0) {
                e.timer = 2.5 + (e.phase % 1);
                if (e.warning) {
                    this.tracer(new B.Vector3(e.x, e.root.position.y + 1.2, e.z), new B.Vector3(p.x, terrainHeight(p.x, p.z) + 2, p.z), '#dfad70');
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
        const enemy = this.aimTarget(), heading = p.yaw + this.look.yaw;
        const start = new B.Vector3(p.x + .3, terrainHeight(p.x, p.z) + 2.2, p.z + .6);
        const end = enemy ? new B.Vector3(enemy.x, terrainHeight(enemy.x, enemy.z) + 1.3, enemy.z) : new B.Vector3(p.x + Math.sin(heading) * 55, terrainHeight(p.x, p.z) + 1.8, p.z + Math.cos(heading) * 55);
        this.tracer(start, end, '#f5d491');
        if (enemy) {
            enemy.health -= this.focusActive ? 2 : 1; this.ui.hitMarker.dataset.show = 'true'; this.hitRemaining = .18;
            if (enemy.health <= 0) { p.kills++; p.focus = clamp(p.focus + 12, 0, 100); enemy.root.rotation.z = Math.PI / 2; enemy.root.position.y += .2; enemy.warning = false; this.say(this.liveEnemies().length ? 'Acertou. Mantenha a atenção.' : 'Passagem livre. Aproxime-se do destino.', 2.5); }
        }
        this.updateHud();
    }
    reload() { if (this.state !== 'play' || this.player.reload || this.player.ammo === 6) return; this.player.reload = 1.8; this.audio.reload(); this.say('Recarregando o tambor…', 1.8); }
    tracer(start, end, color) {
        const line = B.MeshBuilder.CreateLines('rastro-do-tiro', { points: [start, end] }, this.scene); line.color = B.Color3.FromHexString(color); line.isPickable = false;
        this.effects.push({ mesh: line, life: .085 });
    }
    updateEffects(dt) {
        for (let i = this.effects.length - 1; i >= 0; i--) { const e = this.effects[i]; e.life -= dt; if (e.life <= 0) { e.mesh.dispose(); this.effects.splice(i, 1); } }
        this.hitRemaining = Math.max(0, (this.hitRemaining || 0) - dt); if (!this.hitRemaining) this.ui.hitMarker.dataset.show = 'false';
    }
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
        const point = B.Vector3.Project(new B.Vector3(t.x, terrainHeight(t.x, t.z) + 3, t.z), B.Matrix.IdentityReadOnly, this.scene.getTransformMatrix(), new B.Viewport(0, 0, w, h));
        const heading = this.player.yaw + this.look.yaw, difference = angleDelta(heading, Math.atan2(t.x - this.player.x, t.z - this.player.z));
        const behind = Math.abs(difference) > Math.PI / 2;
        ui.waypoint.style.left = `${clamp(behind ? difference > 0 ? w - 24 : 24 : point.x, 24, w - 24)}px`;
        ui.waypoint.style.top = `${clamp(behind ? h * .45 : point.y, h < 520 ? 104 : 190, h - (this.coarse ? 215 : 125))}px`;
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
}
export let game = null;
try {
    const probe = document.createElement('canvas');
    const supported = !!(probe.getContext('webgl2', { powerPreference: 'high-performance' }) || probe.getContext('webgl'));
    if (!B || !supported) throw new Error('WebGL indisponível.');
    game = new RastroVermelho();
} catch (error) { showError(error); }
