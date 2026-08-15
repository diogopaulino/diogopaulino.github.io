/**
 * Aurelia Festival — festival de velocidade na costa em Babylon.js.
 * Supercarros, física de drift, pôr do sol dourado e trilha sonora.
 */

import { buildCoastalWorld } from './world.js';
import { buildSupercar, updateSupercarVisuals } from './carModel.js';
import { DriftEffects } from './effects.js';
import { clamp, lerp } from './utils.js';

class AureliaFestival {
    constructor() {
        this.canvas = document.getElementById('scene');
        this.state = 'boot';

        this.pos = { x: 0, y: 4, z: -1100 };
        this.yaw = 0;
        this.speed = 0;
        this.driftScore = 0;
        this.isDrifting = false;
        this.isBoost = false;

        this.keys = {};
        this.touchSteer = 0;
        this.touchThrottle = 0;
        this.touchHandbrake = false;

        this.bindUi();
        this.boot();
    }

    bindUi() {
        document.getElementById('startButton')?.addEventListener('click', () => this.start());
        document.getElementById('soundButton')?.addEventListener('click', () => this.toggleMute());

        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            if (e.code === 'Space') this.touchHandbrake = true;
            if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.isBoost = true;
            if (e.code === 'Enter' && this.state === 'menu') this.start();
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
            if (e.code === 'Space') this.touchHandbrake = false;
            if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.isBoost = false;
        });

        // Touch controls via data-control
        document.querySelectorAll('[data-control]').forEach((btn) => {
            const ctrl = btn.dataset.control;
            btn.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                if (ctrl === 'throttle') this.touchThrottle = 1.0;
                if (ctrl === 'brake') this.touchThrottle = -1.0;
                if (ctrl === 'left') this.touchSteer = -1.0;
                if (ctrl === 'right') this.touchSteer = 1.0;
                if (ctrl === 'handbrake') this.touchHandbrake = true;
            });
            const onUp = (e) => {
                e.preventDefault();
                if (ctrl === 'throttle' || ctrl === 'brake') this.touchThrottle = 0;
                if (ctrl === 'left' && this.touchSteer < 0) this.touchSteer = 0;
                if (ctrl === 'right' && this.touchSteer > 0) this.touchSteer = 0;
                if (ctrl === 'handbrake') this.touchHandbrake = false;
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
            this.scene.clearColor = new BABYLON.Color4(0.08, 0.06, 0.05, 1.0);
        } catch (err) {
            console.error(err);
            return;
        }

        // Cenário Costeiro
        this.world = buildCoastalWorld(BABYLON, this.scene);

        // Supercarro
        this.car = buildSupercar(BABYLON, this.scene, '#e11d48');

        // Efeitos
        this.effects = new DriftEffects(BABYLON, this.scene);

        // Câmera de perseguição
        this.camera = new BABYLON.FreeCamera('chaseCam', new BABYLON.Vector3(0, 3, -8), this.scene);
        this.camera.minZ = 0.1;
        this.camera.maxZ = 1600;

        // Pipeline PBR de cinema
        const pipe = new BABYLON.DefaultRenderingPipeline('pipeline', true, this.scene, [this.camera]);
        pipe.fxaaEnabled = true;
        pipe.bloomEnabled = true;
        pipe.bloomThreshold = 0.75;
        pipe.bloomWeight = 0.35;
        pipe.imageProcessing.toneMappingEnabled = true;
        pipe.imageProcessing.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
        pipe.imageProcessing.contrast = 1.2;

        document.getElementById('loadingOverlay').classList.remove('is-visible');
        document.getElementById('loadingOverlay').hidden = true;
        document.getElementById('menuOverlay').hidden = false;
        document.body.dataset.state = 'menu';

        this.engine.runRenderLoop(() => {
            this.frame();
            this.scene.render();
        });

        window.addEventListener('resize', () => this.engine.resize());
    }

    start() {
        this.state = 'drive';
        document.getElementById('menuOverlay').hidden = true;
        document.getElementById('hud').hidden = false;
        document.getElementById('touchControls').hidden = !('ontouchstart' in window);
        document.body.dataset.state = 'drive';
    }

    toggleMute() {
        // Toggle áudio
    }

    frame() {
        const dt = Math.min(0.05, this.engine.getDeltaTime() / 1000);

        if (this.state === 'drive') {
            // Controles
            let throttle = this.touchThrottle;
            let steer = this.touchSteer;

            if (this.keys['KeyW'] || this.keys['ArrowUp']) throttle = 1.0;
            if (this.keys['KeyS'] || this.keys['ArrowDown']) throttle = -0.8;
            if (this.keys['KeyA'] || this.keys['ArrowLeft']) steer = -1.0;
            if (this.keys['KeyD'] || this.keys['ArrowRight']) steer = 1.0;

            const handbrake = this.touchHandbrake || !!this.keys['Space'];
            const maxSpeed = this.isBoost ? 85 : 65; // m/s (~300 km/h)
            const accel = this.isBoost ? 28 : 18;

            if (throttle > 0) {
                this.speed = Math.min(maxSpeed, this.speed + accel * dt);
            } else if (throttle < 0) {
                this.speed = Math.max(-15, this.speed - 32 * dt);
            } else {
                this.speed = lerp(this.speed, 0, dt * 1.5);
            }

            // Física de drift
            this.isDrifting = handbrake && Math.abs(steer) > 0.2 && this.speed > 10;
            const turnRate = (this.isDrifting ? 2.4 : 1.6) * (Math.min(1, this.speed / 15));
            this.yaw += steer * turnRate * dt;

            const moveDir = this.yaw + (this.isDrifting ? steer * 0.45 : 0);
            this.pos.x += Math.sin(moveDir) * this.speed * dt;
            this.pos.z += Math.cos(moveDir) * this.speed * dt;

            // Ajuste de altura do terreno / estrada
            const t = ((this.pos.z + 1200) / 2400) * Math.PI * 4;
            this.pos.y = Math.sin(t * 1.5) * 8 + 4.2;

            // Pontuação de drift
            if (this.isDrifting) {
                this.driftScore += Math.round(this.speed * 12 * dt);
            }

            // Atualização do supercarro
            this.car.root.position.set(this.pos.x, this.pos.y, this.pos.z);
            this.car.root.rotation.y = this.yaw;

            updateSupercarVisuals(this.car, this.speed, steer * 0.4, this.isDrifting, dt);
            this.effects.update(this.pos, this.speed * 3.6, this.isDrifting, this.isBoost);

            // Câmera dinâmica de perseguição
            const camDist = this.isBoost ? 7.2 : 6.0;
            const camHeight = 2.4;
            const targetCamX = this.pos.x - Math.sin(this.yaw) * camDist;
            const targetCamZ = this.pos.z - Math.cos(this.yaw) * camDist;
            const targetCamY = this.pos.y + camHeight;

            this.camera.position.x = lerp(this.camera.position.x, targetCamX, dt * 8.0);
            this.camera.position.y = lerp(this.camera.position.y, targetCamY, dt * 8.0);
            this.camera.position.z = lerp(this.camera.position.z, targetCamZ, dt * 8.0);

            const lookTarget = new window.BABYLON.Vector3(
                this.pos.x + Math.sin(this.yaw) * 6,
                this.pos.y + 1.2,
                this.pos.z + Math.cos(this.yaw) * 6
            );
            this.camera.setTarget(lookTarget);

            // HUD
            this.updateHud();
        }
    }

    updateHud() {
        const spdEl = document.getElementById('speedValue');
        const scoreEl = document.getElementById('scoreValue');
        const driftBadge = document.getElementById('driftBadge');
        const speedKmh = Math.round(Math.abs(this.speed) * 3.6);

        if (spdEl) spdEl.textContent = `${speedKmh}`;
        if (scoreEl) scoreEl.textContent = `${this.driftScore}`;
        if (driftBadge) driftBadge.dataset.active = String(this.isDrifting);
    }
}

try {
    new AureliaFestival();
} catch (err) {
    console.error(err);
}
