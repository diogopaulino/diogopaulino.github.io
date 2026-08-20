/**
 * F1 Grand Prix — Babylon.js Engine.
 * Física Pacejka, carga aerodinâmica, DRS, ERS, circuitos e telemetria ao vivo.
 */

import { buildCircuit, CIRCUITS } from './circuits.js';
import { buildCircuitWorld } from './world.js';
import { buildF1Car, updateCarVisuals } from './carModel.js';
import { Vehicle } from './vehicle.js';
import { RaceEffects } from './effects.js';
import { AudioEngine } from './audio.js';
import { TEAMS } from './config.js';
import { clamp, lerp } from './utils.js';

class F1GrandPrix {
    constructor() {
        this.canvas = document.getElementById('scene');
        this.state = 'boot';
        this.selectedCircuitKey = 'interlagos';
        this.drsActive = false;
        this.ersActive = false;
        this.keys = {};
        this.touchSteer = 0;
        this.touchThrottle = 0;
        this.touchBrake = 0;

        this.audio = new AudioEngine();
        this.bindUi();
        this.boot();
    }

    bindUi() {
        document.getElementById('startButton')?.addEventListener('click', () => this.startRace());
        document.getElementById('soundButton')?.addEventListener('click', () => this.toggleMute());
        document.getElementById('cameraButton')?.addEventListener('click', () => this.cycleCamera());

        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            if (e.code === 'KeyD' || e.code === 'KeyE') this.drsActive = !this.drsActive;
            if (e.code === 'Space') this.ersActive = true;
            if (e.code === 'KeyM') this.toggleMute();
            if (e.code === 'Enter' && this.state === 'menu') this.startRace();
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
            if (e.code === 'Space') this.ersActive = false;
        });

        // Touch controls via data-control
        document.querySelectorAll('[data-control]').forEach((btn) => {
            const ctrl = btn.dataset.control;
            btn.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                if (ctrl === 'throttle') this.touchThrottle = 1.0;
                if (ctrl === 'brake') this.touchBrake = 1.0;
                if (ctrl === 'left') this.touchSteer = -1.0;
                if (ctrl === 'right') this.touchSteer = 1.0;
                if (ctrl === 'drs') this.drsActive = !this.drsActive;
                if (ctrl === 'ers') this.ersActive = true;
            });
            const onUp = (e) => {
                e.preventDefault();
                if (ctrl === 'throttle') this.touchThrottle = 0;
                if (ctrl === 'brake') this.touchBrake = 0;
                if (ctrl === 'left' && this.touchSteer < 0) this.touchSteer = 0;
                if (ctrl === 'right' && this.touchSteer > 0) this.touchSteer = 0;
                if (ctrl === 'ers') this.ersActive = false;
            };
            btn.addEventListener('pointerup', onUp);
            btn.addEventListener('pointercancel', onUp);
        });
    }

    async boot() {
        const BABYLON = window.BABYLON;
        if (!BABYLON) return;

        try {
            this.engine = new BABYLON.Engine(this.canvas, true, {
                preserveDrawingBuffer: false,
                stencil: true,
                adaptToDeviceRatio: true
            });
            this.scene = new BABYLON.Scene(this.engine);
            this.scene.clearColor = new BABYLON.Color4(0.05, 0.06, 0.08, 1.0);
        } catch (err) {
            console.error(err);
            return;
        }

        // Carregar Circuito
        this.loadCircuit(this.selectedCircuitKey);

        // Carro do Jogador
        this.playerCar = buildF1Car(BABYLON, this.scene, '#e10600');
        this.vehicle = new Vehicle({
            circuit: this.circuit,
            team: TEAMS[0],
            isPlayer: true
        });

        // Efeitos
        this.effects = new RaceEffects(BABYLON, this.scene);

        // Câmera de perseguição F1
        this.camera = new BABYLON.FreeCamera('f1_cam', new BABYLON.Vector3(0, 3, -6), this.scene);
        this.camera.minZ = 0.1;
        this.camera.maxZ = 1200;

        // Pipeline PBR
        const pipe = new BABYLON.DefaultRenderingPipeline('pipeline', true, this.scene, [this.camera]);
        pipe.fxaaEnabled = true;
        pipe.bloomEnabled = true;
        pipe.bloomThreshold = 0.78;
        pipe.bloomWeight = 0.28;
        pipe.imageProcessing.toneMappingEnabled = true;
        pipe.imageProcessing.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
        pipe.imageProcessing.contrast = 1.16;

        document.getElementById('loadingOverlay').classList.remove('is-visible');
        document.getElementById('loadingOverlay').hidden = true;
        const menu = document.getElementById('menuOverlay');
        if (menu) menu.classList.add('is-visible');
        document.body.dataset.state = 'menu';

        this._renderLoop = () => {
            this.frame();
            this.scene.render();
        };
        if (window.LabRuntime) LabRuntime.bindBabylonLoop(this.engine, this._renderLoop);
        else this.engine.runRenderLoop(this._renderLoop);

        window.addEventListener('resize', () => this.engine.resize());
    }

    loadCircuit(key) {
        if (this.world) {
            this.world.root.dispose();
        }
        const data = CIRCUITS[key] || CIRCUITS.interlagos;
        this.circuit = buildCircuit(data);
        this.world = buildCircuitWorld(window.BABYLON, this.circuit, this.scene);
        if (this.vehicle) {
            this.vehicle.circuit = this.circuit;
            this.vehicle.reset();
        }
    }

    startRace() {
        this.state = 'racing';
        const menu = document.getElementById('menuOverlay');
        if (menu) menu.classList.remove('is-visible');
        document.getElementById('hud').hidden = false;
        document.getElementById('touchControls').hidden = !('ontouchstart' in window);
        document.body.dataset.state = 'racing';

        this.vehicle.reset();
        this.audio.init();
        this.audio.start();
    }

    toggleMute() {
        const muted = this.audio.toggleMute();
        const btn = document.getElementById('soundButton');
        if (btn) {
            btn.setAttribute('aria-pressed', String(!muted));
        }
    }

    frame() {
        const dt = Math.min(0.05, this.engine.getDeltaTime() / 1000);

        if (this.state === 'racing') {
            // Controles do jogador
            let throttle = this.touchThrottle;
            let brake = this.touchBrake;
            let steer = this.touchSteer;

            if (this.keys['KeyW'] || this.keys['ArrowUp']) throttle = 1.0;
            if (this.keys['KeyS'] || this.keys['ArrowDown']) brake = 1.0;
            if (this.keys['KeyA'] || this.keys['ArrowLeft']) steer = -1.0;
            if (this.keys['KeyD'] || this.keys['ArrowRight']) steer = 1.0;

            // Simulação física do veículo
            this.vehicle.update(dt, {
                throttle,
                brake,
                steer,
                ers: this.ersActive,
                drs: this.drsActive
            });

            const pos = this.vehicle.position;
            const yaw = this.vehicle.yaw;
            const speed = this.vehicle.speed; // m/s
            const speedKmh = Math.round(speed * 3.6);

            // Atualização visual do carro
            this.playerCar.root.position.set(pos.x, pos.y, pos.z);
            this.playerCar.root.rotation.y = -yaw + Math.PI / 2;

            updateCarVisuals(this.playerCar, speed, steer * 0.35, this.drsActive, dt);

            // Efeitos de fumaça e faíscas
            this.effects.update(pos, speedKmh, this.vehicle.slipRatio || 0, speedKmh > 260);

            // Câmera dinâmica de perseguição F1
            const camDist = 6.2;
            const camHeight = 2.4;
            const camTargetX = pos.x - Math.sin(-yaw + Math.PI / 2) * camDist;
            const camTargetZ = pos.z - Math.cos(-yaw + Math.PI / 2) * camDist;
            const camTargetY = pos.y + camHeight;

            this.camera.position.x = lerp(this.camera.position.x, camTargetX, dt * 10.0);
            this.camera.position.y = lerp(this.camera.position.y, camTargetY, dt * 10.0);
            this.camera.position.z = lerp(this.camera.position.z, camTargetZ, dt * 10.0);

            const lookTarget = new window.BABYLON.Vector3(
                pos.x + Math.sin(-yaw + Math.PI / 2) * 5,
                pos.y + 1.2,
                pos.z + Math.cos(-yaw + Math.PI / 2) * 5
            );
            this.camera.setTarget(lookTarget);

            // Áudio do motor
            this.audio.update(this.vehicle.rpm || 4000, speedKmh, throttle, brake, this.vehicle.gear || 1);

            // Telemetria & HUD
            this.updateHud(speedKmh);
        }
    }

    updateHud(speedKmh) {
        const spdEl = document.getElementById('speedValue');
        const gearEl = document.getElementById('gearValue');
        const rpmFill = document.getElementById('rpmFill');
        const drsBadge = document.getElementById('drsBadge');
        const ersFill = document.getElementById('ersFill');

        if (spdEl) spdEl.textContent = `${speedKmh}`;
        if (gearEl) gearEl.textContent = this.vehicle.gear === 0 ? 'N' : (this.vehicle.gear === -1 ? 'R' : `${this.vehicle.gear}`);
        if (rpmFill) {
            const rpmPct = clamp(((this.vehicle.rpm || 4000) - 4000) / 11000, 0, 1) * 100;
            rpmFill.style.width = `${rpmPct}%`;
        }
        if (ersFill) {
            ersFill.style.width = `${(this.vehicle.ers || 4.0) / 4.0 * 100}%`;
        }
        if (drsBadge) {
            drsBadge.dataset.state = this.drsActive ? 'active' : 'available';
        }
    }
}

try {
    new F1GrandPrix();
} catch (err) {
    console.error(err);
}
