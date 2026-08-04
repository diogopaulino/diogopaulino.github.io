/**
 * F1 Grand Prix — WebGPU edition.
 *
 * Boots the renderer (WebGPU with an automatic WebGL2 fallback), builds the world for
 * the chosen circuit, runs the fixed-step simulation and drives the race director.
 */

import * as THREE from 'three';
import { RenderPipeline } from 'three/webgpu';
import { pass, mrt, output, emissive, uniform, uv, vec2, vec3, float, smoothstep, mix } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';

import { buildCircuit, CIRCUITS, CIRCUIT_KEYS } from './circuits.js';
import {
    TEAMS, DRIVER_NAMES, COMPOUNDS, DIFFICULTIES, QUALITY, WEATHER, CAMERAS,
    loadSettings, saveSettings, loadRecords, saveRecord, clearRecords,
    detectQuality, formatTime
} from './config.js';
import { buildWorld } from './world.js';
import { buildCar } from './carModel.js';
import { Vehicle } from './vehicle.js';
import { AIDriver } from './ai.js';
import { AudioEngine } from './audio.js';
import { ParticleSystem, SkidTrails, RainField } from './effects.js';
import { InputManager } from './input.js';
import { Hud } from './hud.js';
import { crowdTexture } from './textures.js';

const FIXED_STEP = 1 / 120;
const MAX_STEPS = 6;

const FORWARD = new THREE.Vector3();
const RIGHT = new THREE.Vector3();
const CAR_POS = new THREE.Vector3();
const DESIRED = new THREE.Vector3();
const LOOK_AT = new THREE.Vector3();

class Game {
    constructor() {
        this.settings = loadSettings();
        this.records = loadRecords();
        this.state = 'boot';
        this.cars = [];
        this.drivers = [];
        this.raceTime = 0;
        this.accumulator = 0;
        this.frameTimes = [];
        this.cameraMode = this.settings.camera;
        this.audio = new AudioEngine();
    }

    /* ================================================================
     * Boot
     * ============================================================== */

    async init() {
        this.dom = {
            canvas: document.querySelector('#scene'),
            loader: document.querySelector('#loadingOverlay'),
            loaderText: document.querySelector('#loadingText'),
            menu: document.querySelector('#menuOverlay'),
            pause: document.querySelector('#pauseOverlay'),
            results: document.querySelector('#resultsOverlay'),
            hud: document.querySelector('#hud'),
            countdown: document.querySelector('#countdown'),
            backend: document.querySelector('#backendBadge'),
            controls: document.querySelector('#touchControls')
        };

        this.hud = new Hud(document);
        this.quality = QUALITY[this.settings.quality === 'auto' ? detectQuality() : this.settings.quality];

        this.setLoading('inicializando renderer…');
        await this.initRenderer();

        this.buildMenu();
        this.bindUi();
        this.hideLoading();
        this.dom.menu.classList.add('is-visible');
        this.state = 'menu';

        addEventListener('resize', () => this.resize(), { passive: true });
        if (window.visualViewport) {
            visualViewport.addEventListener('resize', () => this.resize(), { passive: true });
        }
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state === 'racing') this.togglePause(true);
        });

        renderLoop(this);
    }

    async initRenderer() {
        const renderer = new THREE.WebGPURenderer({
            canvas: this.dom.canvas,
            antialias: this.quality.id !== 'low',
            powerPreference: 'high-performance'
        });
        renderer.setPixelRatio(Math.min(devicePixelRatio || 1, this.quality.pixelRatio));
        renderer.setSize(innerWidth, innerHeight, false);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.12;
        renderer.shadowMap.enabled = this.quality.shadows;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        await renderer.init();
        this.renderer = renderer;

        const backend = renderer.backend?.isWebGPUBackend ? 'WebGPU' : 'WebGL2';
        this.backend = backend;
        if (this.dom.backend) this.dom.backend.textContent = backend;

        this.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.3, this.quality.drawDistance * 2.4);
        this.cameraTarget = new THREE.Vector3();
        this.cameraLook = new THREE.Vector3();
    }

    setLoading(text) {
        if (this.dom.loaderText) this.dom.loaderText.textContent = text;
        this.dom.loader?.classList.add('is-visible');
    }

    hideLoading() {
        this.dom.loader?.classList.remove('is-visible');
    }

    /* ================================================================
     * Menu
     * ============================================================== */

    buildMenu() {
        const circuitList = document.querySelector('#circuitList');
        circuitList.innerHTML = '';
        for (const key of CIRCUIT_KEYS) {
            const def = CIRCUITS[key];
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'option-card circuit-card';
            button.dataset.circuit = key;
            button.setAttribute('aria-pressed', String(key === this.settings.circuit));
            const record = this.records[key];
            button.innerHTML = `
                <span class="card-flag" aria-hidden="true">${def.flag}</span>
                <span class="card-body">
                    <strong>${def.short}</strong>
                    <span class="card-sub">${def.tagline}</span>
                    <span class="card-meta">${def.location} · ${def.laps} voltas</span>
                </span>
                <span class="card-record">${record ? formatTime(record) : ''}</span>`;
            button.addEventListener('click', () => {
                this.settings.circuit = key;
                this.syncMenu();
            });
            circuitList.appendChild(button);
        }

        const teamList = document.querySelector('#teamList');
        teamList.innerHTML = '';
        for (const team of TEAMS.slice(0, 6)) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'option-card team-card';
            button.dataset.team = team.id;
            button.style.setProperty('--team', `#${team.primary.toString(16).padStart(6, '0')}`);
            button.innerHTML = `
                <span class="team-number">${team.number}</span>
                <span class="card-body"><strong>${team.name}</strong></span>
                <span class="team-swatch" aria-hidden="true"></span>`;
            button.addEventListener('click', () => {
                this.settings.team = team.id;
                this.syncMenu();
            });
            teamList.appendChild(button);
        }

        for (const [group, values] of [
            ['compound', Object.keys(COMPOUNDS)],
            ['weather', Object.keys(WEATHER)],
            ['difficulty', Object.keys(DIFFICULTIES)]
        ]) {
            const container = document.querySelector(`#${group}Options`);
            if (!container) continue;
            container.innerHTML = '';
            for (const value of values) {
                const source = group === 'compound' ? COMPOUNDS : group === 'weather' ? WEATHER : DIFFICULTIES;
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'chip';
                button.dataset.group = group;
                button.dataset.value = value;
                button.textContent = source[value].label;
                if (group === 'compound') button.style.setProperty('--chip', source[value].color);
                button.addEventListener('click', () => {
                    this.settings[group] = value;
                    this.syncMenu();
                });
                container.appendChild(button);
            }
        }

        this.syncMenu();
    }

    syncMenu() {
        for (const button of document.querySelectorAll('[data-circuit]')) {
            button.setAttribute('aria-pressed', String(button.dataset.circuit === this.settings.circuit));
        }
        for (const button of document.querySelectorAll('[data-team]')) {
            button.setAttribute('aria-pressed', String(button.dataset.team === this.settings.team));
        }
        for (const button of document.querySelectorAll('[data-group]')) {
            const group = button.dataset.group;
            button.setAttribute('aria-pressed', String(this.settings[group] === button.dataset.value));
        }
        const def = CIRCUITS[this.settings.circuit];
        const blurb = document.querySelector('#circuitBlurb');
        if (blurb) blurb.textContent = def.blurb;
        saveSettings(this.settings);
    }

    bindUi() {
        const launch = () => this.startRace().catch((error) => {
            console.error(error);
            this.setLoading('não foi possível montar a corrida — recarregue a página');
        });
        document.querySelector('#startButton')?.addEventListener('click', launch);
        document.querySelector('#resumeButton')?.addEventListener('click', () => this.togglePause(false));
        document.querySelector('#restartButton')?.addEventListener('click', launch);
        document.querySelector('#quitButton')?.addEventListener('click', () => this.toMenu());
        document.querySelector('#resultsMenuButton')?.addEventListener('click', () => this.toMenu());
        document.querySelector('#resultsRestartButton')?.addEventListener('click', launch);
        document.querySelector('#cameraButton')?.addEventListener('click', () => this.cycleCamera());
        document.querySelector('#pauseButton')?.addEventListener('click', () => this.togglePause());

        const volume = document.querySelector('#volumeSlider');
        if (volume) {
            volume.value = String(Math.round(this.settings.volume * 100));
            volume.addEventListener('input', () => {
                this.settings.volume = Number(volume.value) / 100;
                this.audio.setVolume(this.settings.volume);
                saveSettings(this.settings);
            });
        }

        const opponents = document.querySelector('#opponentsSlider');
        if (opponents) {
            opponents.value = String(this.settings.opponents);
            const label = document.querySelector('#opponentsValue');
            const sync = () => {
                this.settings.opponents = Number(opponents.value);
                if (label) label.textContent = String(this.settings.opponents);
                saveSettings(this.settings);
            };
            opponents.addEventListener('input', sync);
            sync();
        }

        for (const [id, key] of [['assistsToggle', 'assists'], ['audioToggle', 'engineAudio']]) {
            const toggle = document.querySelector(`#${id}`);
            if (!toggle) continue;
            toggle.checked = this.settings[key];
            toggle.addEventListener('change', () => {
                this.settings[key] = toggle.checked;
                if (key === 'engineAudio') this.audio.setEnabled(toggle.checked);
                saveSettings(this.settings);
            });
        }

        const quality = document.querySelector('#qualitySelect');
        if (quality) {
            quality.value = this.settings.quality;
            quality.addEventListener('change', () => {
                this.settings.quality = quality.value;
                saveSettings(this.settings);
                this.hud.message('A qualidade muda na próxima corrida', { tone: 'info' });
            });
        }

        document.querySelector('#clearRecords')?.addEventListener('click', () => {
            clearRecords();
            this.records = {};
            this.buildMenu();
        });

        this.input = new InputManager({
            root: this.dom.controls,
            actions: {
                togglePause: () => {
                    if (this.state === 'racing' || this.state === 'paused') this.togglePause();
                },
                cycleCamera: () => this.cycleCamera(),
                restart: () => { if (this.state !== 'menu') launch(); },
                toggleDrs: () => this.requestDrs(),
                toggleMute: () => {
                    this.settings.engineAudio = !this.settings.engineAudio;
                    this.audio.setEnabled(this.settings.engineAudio);
                }
            }
        });
    }

    /* ================================================================
     * Race setup
     * ============================================================== */

    async startRace() {
        this.setLoading('construindo circuito…');
        this.dom.menu.classList.remove('is-visible');
        this.dom.pause.classList.remove('is-visible');
        this.dom.results.classList.remove('is-visible');
        // Let the loading overlay paint. rAF alone would stall in a background tab.
        await new Promise((resolve) => {
            const done = () => resolve();
            requestAnimationFrame(done);
            setTimeout(done, 60);
        });

        this.disposeRace();

        this.quality = QUALITY[this.settings.quality === 'auto' ? detectQuality() : this.settings.quality];
        this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, this.quality.pixelRatio));
        this.renderer.shadowMap.enabled = this.quality.shadows;
        this.camera.far = this.quality.drawDistance * 2.4;
        this.camera.updateProjectionMatrix();

        const circuit = buildCircuit(this.settings.circuit);
        this.circuit = circuit;
        this.weather = WEATHER[this.settings.weather];
        this.difficulty = DIFFICULTIES[this.settings.difficulty];
        this.totalLaps = this.settings.laps || circuit.laps;

        this.world = buildWorld(circuit, { quality: this.quality, weather: this.weather });
        this.scene = this.world.scene;

        this.setLoading('preparando o grid…');

        const playerTeam = TEAMS.find((t) => t.id === this.settings.team) || TEAMS[0];
        const rivals = TEAMS.filter((t) => t.id !== playerTeam.id);
        const gridSize = Math.min(1 + this.settings.opponents, TEAMS.length);

        this.cars = [];
        this.drivers = [];
        this.models = new Map();

        for (let i = 0; i < gridSize; i++) {
            const isPlayer = i === 0;
            const team = isPlayer ? playerTeam : rivals[(i - 1) % rivals.length];
            const compound = isPlayer
                ? this.settings.compound
                : ['soft', 'medium', 'hard'][(i + 1) % 3];

            const vehicle = new Vehicle({
                circuit,
                team,
                driver: isPlayer ? 'Você' : DRIVER_NAMES[i % DRIVER_NAMES.length],
                compound,
                weather: this.weather,
                isPlayer
            });

            // Grid order: the player starts mid-pack so there is a race in both directions.
            const slot = isPlayer ? Math.floor(gridSize / 2) : (i <= Math.floor(gridSize / 2) ? i - 1 : i);
            vehicle.placeOnGrid(Math.max(0, slot));
            this.cars.push(vehicle);

            if (!isPlayer) {
                vehicle.ai = new AIDriver(vehicle, { difficulty: this.difficulty, seed: i * 13 + 5 });
                this.drivers.push(vehicle.ai);
            } else {
                this.player = vehicle;
            }

            const model = buildCar(team, {
                quality: this.quality,
                isPlayer,
                compoundColor: (COMPOUNDS[compound] || COMPOUNDS.medium).color
            });
            this.scene.add(model.group);
            this.models.set(vehicle, model);
        }

        this.setLoading('gerando efeitos…');
        this.smoke = new ParticleSystem(this.scene, {
            max: Math.round(340 * this.quality.particles),
            gravity: 1.1,
            drag: 0.9
        });
        this.sparks = new ParticleSystem(this.scene, {
            max: Math.round(160 * this.quality.particles),
            blending: THREE.AdditiveBlending,
            gravity: -9,
            drag: 0.82
        });
        this.spray = new ParticleSystem(this.scene, {
            max: Math.round(260 * this.quality.particles),
            gravity: -2.2,
            drag: 0.88
        });
        this.trails = new SkidTrails(this.scene, { maxPoints: 700 });
        this.rain = new RainField(this.scene, { count: Math.round(2400 * this.quality.particles) });
        this.rain.setEnabled(this.weather.id !== 'dry');

        this.buildCameraPosts();
        this.setupPostProcessing();

        this.hud.prepareMinimap(circuit);
        this.hud.resizeMinimap();
        document.querySelector('#circuitName').textContent = circuit.short;

        this.raceTime = 0;
        this.accumulator = 0;
        this.countdown = 5.4;
        this.lastLapCross = new Map();
        this.state = 'countdown';
        this.dom.hud.classList.add('is-visible');

        await this.audio.start();
        this.audio.setVolume(this.settings.volume);
        this.audio.setEnabled(this.settings.engineAudio);

        this.setLoading('compilando shaders…');
        this.camera.position.set(
            this.player.position.x, this.player.position.y + 6, this.player.position.z - 14
        );
        this.camera.lookAt(this.player.position.x, this.player.position.y, this.player.position.z);
        await this.renderer.compileAsync(this.scene, this.camera);

        this.hideLoading();
        this.hud.message('Prepare-se', { duration: 1.6, tone: 'info' });
        if ('wakeLock' in navigator) {
            navigator.wakeLock.request('screen').then((lock) => { this.wakeLock = lock; }).catch(() => {});
        }
    }

    /** Trackside camera positions used by the broadcast view. */
    buildCameraPosts() {
        const circuit = this.circuit;
        const posts = [];
        const stride = Math.max(24, Math.round(220 / circuit.spacing));
        for (let i = 0; i < circuit.count; i += stride) {
            const side = circuit.curvature[i] > 0 ? -1 : 1;
            const lateral = side * (circuit.halfWidth + 24);
            posts.push(new THREE.Vector3(
                circuit.cx[i] + circuit.nx[i] * lateral,
                circuit.y[i] + 9,
                circuit.cz[i] + circuit.nz[i] * lateral
            ));
        }
        this.cameraPosts = posts;
        this.activePost = 0;
    }

    setupPostProcessing() {
        this.pipeline?.dispose?.();
        this.pipeline = null;
        if (!this.quality.post) return;

        const scenePass = pass(this.scene, this.camera);
        scenePass.setMRT(mrt({ output, emissive }));

        const color = scenePass.getTextureNode('output');
        const emissiveTexture = scenePass.getTextureNode('emissive');

        this.speedUniform = uniform(0);

        let node = color;
        if (this.quality.bloom) {
            // Hyper-realistic Bloom: mais intenso, limiar ajustado para cobrir destaques do sol e reflexos
            const bloomEffect = bloom(emissiveTexture.add(color.mul(0.15)), 2.2, 0.65, 0.05);
            node = node.add(bloomEffect);
        }

        // Color Grading: Estilo Transmissão Oficial de F1 (Contraste alto, saturação rica)
        // Correção de Gamma e contraste
        node = node.pow(0.88);
        const luma = node.dot(vec3(0.2126, 0.7152, 0.0722));
        node = mix(vec3(luma), node, float(1.25)); // +25% Saturação
        
        // Efeito de túnel em alta velocidade (Speed Pinch + Vignette Dinâmico)
        const uvDist = uv().sub(vec2(0.5, 0.5));
        const distance = uvDist.length();
        const vignette = smoothstep(1.05, 0.25, distance);
        const speedPinch = this.speedUniform.mul(0.65);
        node = node.mul(mix(float(1), vignette, float(0.4).add(speedPinch)));

        const pipeline = new RenderPipeline(this.renderer);
        pipeline.outputColorTransform = false;
        pipeline.outputNode = node.renderOutput();
        this.pipeline = pipeline;
    }

    disposeRace() {
        if (!this.scene) return;
        for (const model of this.models?.values() ?? []) model.dispose();
        this.smoke?.dispose();
        this.sparks?.dispose();
        this.spray?.dispose();
        this.trails?.dispose();
        this.rain?.dispose();
        this.world?.dispose();
        this.pipeline = null;
        this.scene = null;
        this.wakeLock?.release?.().catch(() => {});
        this.wakeLock = null;
    }

    toMenu() {
        this.state = 'menu';
        this.dom.hud.classList.remove('is-visible');
        this.dom.results.classList.remove('is-visible');
        this.dom.pause.classList.remove('is-visible');
        this.dom.menu.classList.add('is-visible');
        this.buildMenu();
        this.audio.suspend();
    }

    togglePause(force) {
        const shouldPause = force ?? this.state === 'racing';
        if (shouldPause && this.state === 'racing') {
            this.state = 'paused';
            this.dom.pause.classList.add('is-visible');
            this.audio.suspend();
        } else if (!shouldPause && this.state === 'paused') {
            this.state = 'racing';
            this.dom.pause.classList.remove('is-visible');
            this.audio.resume();
        }
    }

    cycleCamera() {
        const index = CAMERAS.findIndex((c) => c.id === this.cameraMode);
        this.cameraMode = CAMERAS[(index + 1) % CAMERAS.length].id;
        this.settings.camera = this.cameraMode;
        saveSettings(this.settings);
        this.hud.message(CAMERAS.find((c) => c.id === this.cameraMode).label, { duration: 1.2 });
    }

    requestDrs() {
        if (this.state !== 'racing' || !this.player) return;
        if (!this.player.drsAvailable) {
            this.hud.message('DRS indisponível', { duration: 1, tone: 'warn' });
            return;
        }
        this.player.drsOpen = !this.player.drsOpen;
        this.audio.drs(this.player.drsOpen);
    }

    /* ================================================================
     * Simulation
     * ============================================================== */

    step(dt) {
        const cars = this.cars;

        for (let i = 0; i < cars.length; i++) {
            const car = cars[i];
            let input;

            if (car === this.player) {
                const control = this.input.state;
                const locked = this.state === 'countdown';
                input = {
                    throttle: locked ? 0 : control.throttle,
                    brake: locked ? 1 : control.brake,
                    steer: control.steer,
                    ers: control.ers,
                    assists: this.settings.assists
                };
                car.ersActive = control.ers && car.ers > 0;
            } else if (this.state === 'countdown') {
                input = { throttle: 0, brake: 1, steer: 0, ers: false, assists: true };
            } else {
                input = car.ai.update(dt, cars, { safety: false });
                car.ersActive = input.ers;
            }

            if (car.finished) {
                input = { throttle: 0.25, brake: 0, steer: input.steer ?? 0, ers: false, assists: true };
            }

            car.update(dt, input);
            const wallHit = car.clampToTrack();
            if (wallHit > 8) {
                if (car === this.player) {
                    this.audio.contact(wallHit * 0.4);
                    if (navigator.vibrate) navigator.vibrate(45);
                }
                if (this.sparks) {
                    for (let s = 0; s < 10; s++) {
                        this.sparks.spawn(
                            car.position.x + (Math.random()-0.5)*2, 
                            car.position.y + 0.2, 
                            car.position.z + (Math.random()-0.5)*2, 
                            (Math.random()-0.5)*20, Math.random()*15+5, (Math.random()-0.5)*20, 
                            { size: 1.5, life: 0.4, color: 0xffddaa }
                        );
                    }
                }
            }

            // Marshals: a car stranded off track is returned to the racing line.
            if (car.offTrack && Math.abs(car.vx) < 4 && this.state === 'racing') {
                car.stuckTimer = (car.stuckTimer || 0) + dt;
                if (car.stuckTimer > 2.5) {
                    car.recover();
                    car.stuckTimer = 0;
                    if (car === this.player) this.hud.message('Recolocado na pista', { duration: 1.6, tone: 'warn' });
                }
            } else {
                car.stuckTimer = 0;
            }
        }

        // Car-to-car contact.
        for (let i = 0; i < cars.length; i++) {
            for (let j = i + 1; j < cars.length; j++) {
                const force = Vehicle.resolveContact(cars[i], cars[j]);
                if (force > 4) {
                    if (cars[i] === this.player || cars[j] === this.player) {
                        this.audio.contact(force * 0.25);
                    }
                    if (this.sparks && force > 6) {
                        for (let s = 0; s < 12; s++) {
                            const mx = (cars[i].position.x + cars[j].position.x) / 2;
                            const my = (cars[i].position.y + cars[j].position.y) / 2 + 0.3;
                            const mz = (cars[i].position.z + cars[j].position.z) / 2;
                            this.sparks.spawn(mx, my, mz, (Math.random()-0.5)*30, Math.random()*20+5, (Math.random()-0.5)*30, { size: 1.5, life: 0.4, color: 0xffaa44 });
                        }
                    }
                }
            }
        }

        this.updateRaceDirector(dt);
    }

    updateRaceDirector(dt) {
        const circuit = this.circuit;

        if (this.state === 'countdown') {
            const previous = Math.ceil(this.countdown);
            this.countdown -= dt;
            const current = Math.ceil(this.countdown);
            if (current !== previous && current >= 0 && current <= 5) {
                this.setStartLights(5 - current);
                if (current > 0) this.audio.lightsBeep(current);
            }
            if (this.countdown <= 0) {
                this.state = 'racing';
                this.setStartLights(-1);
                this.audio.lightsOut();
                this.hud.message('VERDE!', { duration: 1.4, tone: 'good' });
                this.raceTime = 0;
            }
            return;
        }

        if (this.state !== 'racing') return;
        this.raceTime += dt;

        for (const car of this.cars) {
            if (car.finished) continue;

            const lapsDone = Math.floor(Math.max(0, car.totalDistance) / circuit.length);
            if (lapsDone > car.lap) {
                const lapTime = this.raceTime - (this.lastLapCross.get(car) ?? 0);
                this.lastLapCross.set(car, this.raceTime);
                car.lap = lapsDone;
                if (car.lap > 0 && lapTime > 5) {
                    car.lastLap = lapTime;
                    if (!car.bestLap || lapTime < car.bestLap) {
                        car.bestLap = lapTime;
                        if (car === this.player) {
                            const isRecord = saveRecord(this.settings.circuit, lapTime);
                            this.records = loadRecords();
                            this.hud.message(
                                isRecord ? `RECORDE! ${formatTime(lapTime)}` : `Melhor volta ${formatTime(lapTime)}`,
                                { duration: 2.6, tone: 'good' }
                            );
                        }
                    }
                }
                if (car.lap >= this.totalLaps) {
                    car.finished = true;
                    car.finishTime = this.raceTime;
                    if (car === this.player) this.finishRace();
                }
            }

            // DRS: detection + activation zone, lap 2+, within 1s of car ahead.
            const zone = circuit.drsZoneAt(car.lapDistance / circuit.length);
            const ahead = this.carAhead(car);
            const withinRange = ahead && ahead.gapSeconds < 1.0;
            const inActivation = zone && (car.lapDistance / circuit.length) >= zone.start
                && (car.lapDistance / circuit.length) <= zone.end;
            car.drsAvailable = Boolean(inActivation) && car.lap >= 1 && Boolean(withinRange)
                && !car.offTrack && car.surface <= 1;
            if (!car.drsAvailable || car.brake > 0.2) car.drsOpen = false;
            if (car !== this.player && car.drsAvailable && car.throttle > 0.75) car.drsOpen = true;
        }

        this.order = [...this.cars].sort((a, b) => {
            if (a.finished !== b.finished) return a.finished ? -1 : 1;
            if (a.finished && b.finished) return a.finishTime - b.finishTime;
            return b.totalDistance - a.totalDistance;
        });
        this.order.forEach((car, index) => { car.position_ = index + 1; });
    }

    carAhead(car) {
        const circuit = this.circuit;
        let best = null;
        let bestGap = Infinity;
        for (const other of this.cars) {
            if (other === car) continue;
            const gap = other.totalDistance - car.totalDistance;
            if (gap <= 0 || gap > 200) continue;
            if (gap < bestGap) {
                bestGap = gap;
                best = other;
            }
        }
        if (!best) return null;
        void circuit;
        return { car: best, gap: bestGap, gapSeconds: bestGap / Math.max(14, car.speed) };
    }

    setStartLights(count) {
        const lights = this.world?.gantry?.userData?.lights;
        if (!lights) return;
        for (const child of lights.children) {
            const index = child.userData.lightIndex;
            if (index === undefined) continue;
            child.material.emissiveIntensity = count >= 0 && index <= count ? 6 : 0;
        }
        const dom = this.dom.countdown;
        if (dom) {
            dom.classList.toggle('is-visible', count >= 0);
            dom.querySelectorAll('i').forEach((light, i) => {
                light.classList.toggle('is-lit', count >= 0 && i <= count);
            });
        }
    }

    finishRace() {
        this.state = 'finished';
        this.audio.fanfare();
        const player = this.player;
        const position = this.order?.findIndex((c) => c === player) + 1 || 1;

        document.querySelector('#resultPosition').textContent = `${position}º`;
        document.querySelector('#resultBest').textContent = formatTime(player.bestLap);
        document.querySelector('#resultTotal').textContent = formatTime(player.finishTime);
        document.querySelector('#resultTeam').textContent = `${player.team.name} · ${this.circuit.short}`;
        document.querySelector('#resultTitle').textContent =
            position === 1 ? 'VITÓRIA!' : position <= 3 ? 'PÓDIO!' : 'BANDEIRA QUADRICULADA';

        const board = document.querySelector('#resultBoard');
        board.innerHTML = '';
        for (const [index, car] of (this.order ?? this.cars).entries()) {
            const row = document.createElement('li');
            row.className = 'result-row' + (car === player ? ' is-player' : '');
            row.innerHTML = `
                <span>${index + 1}</span>
                <span class="result-flag" style="background:#${car.team.primary.toString(16).padStart(6, '0')}"></span>
                <span class="result-name">${car.driver}</span>
                <span class="result-time">${car.bestLap ? formatTime(car.bestLap) : '—'}</span>`;
            board.appendChild(row);
        }

        this.dom.results.classList.add('is-visible');
        this.wakeLock?.release?.().catch(() => {});
    }

    /* ================================================================
     * Presentation
     * ============================================================== */

    syncModels(dt) {
        const cTex = crowdTexture();
        if (cTex) {
            cTex.offset.y = Math.sin(performance.now() / 1000 * 8) * 0.015;
        }

        for (const car of this.cars) {
            const model = this.models.get(car);
            if (!model) continue;
            model.group.position.set(car.position.x, car.position.y + 0.02, car.position.z);
            model.group.rotation.order = 'YXZ';
            model.group.rotation.set(car.pitch, car.yaw, car.roll);
            model.updateWheels(car.steer * 1.15, (car.vx / 0.36) * dt, car.suspension);
            model.setBrakeGlow(Math.min(1, car.brake * (0.25 + Math.abs(car.vx) / 90)));
            model.setDrs(car.drsOpen ? 1 : 0);
            model.setRainLight(this.weather.id !== 'dry');
        }
    }

    updateCamera(dt) {
        const car = this.player;
        if (!car) return;

        FORWARD.set(Math.sin(car.yaw), 0, Math.cos(car.yaw));
        RIGHT.set(Math.cos(car.yaw), 0, -Math.sin(car.yaw));
        CAR_POS.set(car.position.x, car.position.y, car.position.z);
        const speedNorm = Math.min(1, Math.abs(car.vx) / 90);
        const lookBack = this.input?.state?.lookBack;
        let targetFov = 62;

        if (lookBack) {
            DESIRED.copy(CAR_POS).addScaledVector(FORWARD, 7.5);
            DESIRED.y += 2.4;
            const follow = 1 - Math.exp(-dt * 10);
            this.camera.position.lerp(DESIRED, follow);
            LOOK_AT.copy(CAR_POS).addScaledVector(FORWARD, -18);
            LOOK_AT.y += 1.0;
            this.cameraLook.lerp(LOOK_AT, Math.min(1, dt * 12));
            targetFov = 58;
        } else switch (this.cameraMode) {
            case 'cockpit': {
                this.camera.position.copy(CAR_POS).addScaledVector(FORWARD, 0.22);
                this.camera.position.y += 1.05;
                LOOK_AT.copy(CAR_POS)
                    .addScaledVector(FORWARD, 28)
                    .addScaledVector(RIGHT, car.steer * 18);
                LOOK_AT.y += 1.05;
                this.cameraLook.copy(LOOK_AT);
                targetFov = 72 + speedNorm * 12;
                break;
            }
            case 'bonnet': {
                this.camera.position.copy(CAR_POS).addScaledVector(FORWARD, 1.75);
                this.camera.position.y += 0.8;
                LOOK_AT.copy(CAR_POS).addScaledVector(FORWARD, 34);
                LOOK_AT.y += 0.85;
                this.cameraLook.copy(LOOK_AT);
                targetFov = 68 + speedNorm * 14;
                break;
            }
            case 'broadcast': {
                let best = this.cameraPosts[this.activePost];
                if (!best || best.distanceTo(CAR_POS) > 190) {
                    let bestDist = Infinity;
                    this.cameraPosts.forEach((post, index) => {
                        const d = post.distanceTo(CAR_POS);
                        if (d < bestDist) { bestDist = d; this.activePost = index; best = post; }
                    });
                }
                this.camera.position.lerp(best, Math.min(1, dt * 6));
                this.cameraLook.lerp(CAR_POS, Math.min(1, dt * 9));
                targetFov = 32 + Math.min(28, best.distanceTo(CAR_POS) * 0.16);
                break;
            }
            default: {
                const back = 8.8 + speedNorm * 2.4;
                const height = 3.2 + speedNorm * 0.55;
                DESIRED.copy(CAR_POS)
                    .addScaledVector(FORWARD, -back)
                    .addScaledVector(RIGHT, -car.yawRate * 2.8);
                DESIRED.y += height;
                const follow = 1 - Math.exp(-dt * (5.5 + speedNorm * 3.5));
                this.camera.position.lerp(DESIRED, follow);

                LOOK_AT.copy(CAR_POS).addScaledVector(FORWARD, 14);
                LOOK_AT.y += 1.15;
                this.cameraLook.lerp(LOOK_AT, Math.min(1, dt * 8));
                targetFov = 60 + speedNorm * 16;
                break;
            }
        }

        const groundClearance = this.circuit
            ? this.circuit.heightAt(this.circuit.nearest(this.camera.position.x, this.camera.position.z), 0) + 0.5
            : -999;
        if (this.camera.position.y < groundClearance) {
            this.camera.position.y = groundClearance;
        }

        if (speedNorm > 0.55 && this.cameraMode !== 'broadcast' && !lookBack) {
            const shakeFactor = Math.pow((speedNorm - 0.55) * 2.2, 2) * 0.04;
            this.cameraLook.x += (Math.random() - 0.5) * shakeFactor;
            this.cameraLook.y += (Math.random() - 0.5) * shakeFactor * 0.7;
        }

        this.camera.lookAt(this.cameraLook);
        // A touch of head tilt in the cockpit sells the lateral load.
        if (this.cameraMode === 'cockpit' && !lookBack) {
            this.camera.rotateZ(-car.roll * 0.8 - car.steer * 0.12);
        }
        
        // Efeito de vibração violenta em alta velocidade (Hyper-realismo)
        if (speedNorm > 0.35 && this.cameraMode !== 'broadcast' && !lookBack) {
            const shakeLevel = Math.pow(speedNorm - 0.35, 2) * 3.5; // Escala quadrática
            const t = (this.raceTime || 0) * 60;
            this.camera.position.x += (Math.sin(t) * 0.02 + Math.sin(t * 3.2) * 0.01) * shakeLevel;
            this.camera.position.y += (Math.cos(t * 1.4) * 0.02 + Math.cos(t * 2.7) * 0.01) * shakeLevel;
            this.camera.position.z += (Math.sin(t * 1.7) * 0.02) * shakeLevel;
            
            // Vibração rotacional no cockpit (a cabeça do piloto treme)
            if (this.cameraMode === 'cockpit') {
                this.camera.rotateX((Math.sin(t * 4.1) * 0.006) * shakeLevel);
                this.camera.rotateY((Math.cos(t * 3.5) * 0.006) * shakeLevel);
            }
        }

        this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 5);
        this.camera.updateProjectionMatrix();
    }

    emitEffects(dt) {
        const car = this.player;
        if (!car || this.state === 'countdown') return;
        const density = this.quality.particles;

        for (const other of this.cars) {
            const isPlayer = other === car;
            const distance = Math.hypot(other.position.x - car.position.x, other.position.z - car.position.z);
            if (!isPlayer && distance > 140) continue;
            if (Math.abs(other.vx) < 8) continue;

            const forward = { x: Math.sin(other.yaw), z: Math.cos(other.yaw) };
            const rearX = other.position.x - forward.x * 1.9;
            const rearZ = other.position.z - forward.z * 1.9;

            // Tyre smoke from sliding or wheelspin.
            const slide = Math.max(other.slip - 0.7, other.wheelSpin * 0.75, (other.lockUp || 0) * 0.9);
            if (slide > 0.08 && Math.random() < slide * density * 1.1) {
                for (const side of [-0.8, 0.8]) {
                    this.smoke.spawn(
                        rearX + Math.cos(other.yaw) * side,
                        other.position.y + 0.22,
                        rearZ - Math.sin(other.yaw) * side,
                        (Math.random() - 0.5) * 2.0,
                        0.6 + Math.random() * 0.8,
                        (Math.random() - 0.5) * 2.0,
                        { size: 0.55 + slide * 0.35, life: 0.7 + Math.random() * 0.5, color: 0xb9bdc4, growth: 2.4 }
                    );
                }
            }

            // Dust when running wide.
            if (other.offTrack && Math.abs(other.vx) > 12 && Math.random() < 0.55 * density) {
                this.smoke.spawn(
                    rearX, other.position.y + 0.1, rearZ,
                    (Math.random() - 0.5) * 3, 1.2 + Math.random(), (Math.random() - 0.5) * 3,
                    { size: 1.0, life: 1.0, color: 0x9c8a6b, growth: 3.0 }
                );
            }

            // Sparks from the plank under compression.
            if (Math.abs(other.vx) > 55 && other.suspension < -0.02 && Math.random() < 0.5 * density) {
                this.sparks.spawn(
                    rearX, other.position.y + 0.06, rearZ,
                    -forward.x * 6 + (Math.random() - 0.5) * 3,
                    1.5 + Math.random() * 2,
                    -forward.z * 6 + (Math.random() - 0.5) * 3,
                    { size: 0.16, life: 0.42, color: 0xffb257, growth: 0.2 }
                );
            }

            // Rooster tail in the wet.
            if (this.weather.spray > 0 && Math.abs(other.vx) > 18 && Math.random() < this.weather.spray * density) {
                this.spray.spawn(
                    rearX, other.position.y + 0.25, rearZ,
                    -forward.x * 5 + (Math.random() - 0.5) * 3,
                    2.4 + Math.random() * 2,
                    -forward.z * 5 + (Math.random() - 0.5) * 3,
                    { size: 0.95, life: 0.7, color: 0xd8e2ee, growth: 3.2 }
                );
            }
        }

        const slideIntensity = Math.max(car.slip - 0.7, car.lockUp || 0, car.wheelSpin * 0.7);
        if (Math.abs(car.vx) > 10) {
            this.trails.push(car.position, car.yaw, 0.82, car.surface <= 1 ? slideIntensity : 0);
        }
        void dt;
    }

    updateAudio(dt) {
        const car = this.player;
        if (!car) return;

        let rival = null;
        let nearest = Infinity;
        for (const other of this.cars) {
            if (other === car) continue;
            const dx = other.position.x - car.position.x;
            const dz = other.position.z - car.position.z;
            const distance = Math.hypot(dx, dz);
            if (distance < nearest) {
                nearest = distance;
                const cos = Math.cos(car.yaw);
                const sin = Math.sin(car.yaw);
                rival = {
                    rpm: other.rpm,
                    level: Math.max(0, 1 - distance / 45),
                    pan: Math.max(-1, Math.min(1, (dx * cos - dz * sin) / 18))
                };
            }
        }
        if (nearest > 45) rival = null;

        this.audio.update({
            rpm: car.rpm,
            throttle: car.throttle,
            speed: Math.abs(car.vx),
            slip: Math.max(car.slip, car.wheelSpin),
            wet: this.weather.spray,
            offTrack: car.offTrack,
            gearChange: car.shiftCooldown > 0.06,
            rival
        }, dt);

        if (car.justShifted) {
            car.justShifted = 0;
            this.audio.gearShift();
        }
        if (car.surface === 1 && !this.kerbSoundCooldown) {
            this.audio.kerb();
            this.kerbSoundCooldown = 0.18;
        }
        this.kerbSoundCooldown = Math.max(0, (this.kerbSoundCooldown || 0) - dt);
    }

    updateHud(dt) {
        const car = this.player;
        if (!car) return;

        const lastCross = this.lastLapCross.get(car) ?? 0;
        const currentLapTime = this.state === 'racing' ? this.raceTime - lastCross : 0;
        const corner = this.circuit.cornerAt(car.lapDistance);

        this.hud.update({
            car,
            position: car.position_,
            totalCars: this.cars.length,
            lapCount: this.totalLaps,
            currentLapTime,
            lastDelta: car.lastLap && car.bestLap ? car.lastLap - car.bestLap : null,
            drsState: car.drsOpen ? 'open' : car.drsAvailable ? 'ready' : 'off',
            sector: corner ? corner.name : ''
        }, dt);

        this.hud.updateTower(this.order ?? this.cars, car);
        this.hud.drawMinimap(this.cars, car);
    }

    resize() {
        if (!this.renderer) return;
        const width = innerWidth;
        const height = innerHeight;
        this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, this.quality.pixelRatio));
        this.renderer.setSize(width, height, false);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.hud.resizeMinimap();
    }

    frame(delta) {
        const running = this.state === 'racing' || this.state === 'countdown' || this.state === 'finished';
        if (!this.scene || !running) {
            if (this.scene) this.render();
            return;
        }

        this.input.update(delta);

        this.accumulator += Math.min(delta, 0.25);
        let steps = 0;
        while (this.accumulator >= FIXED_STEP && steps < MAX_STEPS) {
            this.step(FIXED_STEP);
            this.accumulator -= FIXED_STEP;
            steps++;
        }

        this.syncModels(delta);
        this.updateCamera(delta);
        this.emitEffects(delta);
        this.updateAudio(delta);
        this.updateHud(delta);

        this.smoke.update(delta, this.camera);
        this.sparks.update(delta, this.camera);
        this.spray.update(delta, this.camera);
        this.rain.update(delta, this.camera, Math.abs(this.player.vx));
        this.world.update(this.camera.position);

        if (this.speedUniform) {
            this.speedUniform.value = Math.min(1, Math.abs(this.player.vx) / 95);
        }

        this.render();
    }

    render() {
        if (this.pipeline) this.pipeline.render();
        else this.renderer.render(this.scene, this.camera);
    }
}

function renderLoop(game) {
    let last = performance.now();
    let fpsAccum = 0;
    let fpsFrames = 0;

    game.renderer.setAnimationLoop(() => {
        const now = performance.now();
        const delta = Math.min(0.1, (now - last) / 1000);
        last = now;

        fpsAccum += delta;
        fpsFrames++;
        if (fpsAccum >= 0.5) {
            game.hud.setFps(Math.round(fpsFrames / fpsAccum));
            fpsAccum = 0;
            fpsFrames = 0;
        }

        game.frame(delta);
    });
}

const game = new Game();
game.init().catch((error) => {
    console.error(error);
    const loader = document.querySelector('#loadingText');
    if (loader) {
        loader.textContent = 'Seu navegador não conseguiu iniciar o renderer 3D. Tente um navegador atualizado.';
    }
});

window.__f1 = game;
