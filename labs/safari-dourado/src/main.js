/**
 * Safari Dourado — safari fotográfico 3D em Babylon.js.
 * Jipe 4x4, fauna da savana (girafas, elefantes, zebras), poço d'água e caderno de campo.
 */

import { buildSavannaWorld } from './world.js';
import { buildJeep } from './models.js';
import { clamp, lerp } from './utils.js';

class SafariDourado {
    constructor() {
        this.canvas = document.getElementById('scene');
        this.state = 'boot';

        this.pos = { x: 0, y: 0.1, z: -100 };
        this.yaw = 0;
        this.speed = 0;
        this.photos = [];
        this.inPhotoMode = false;

        this.keys = {};
        this.touchSteer = 0;
        this.touchThrottle = 0;

        this.bindUi();
        this.boot();
    }

    bindUi() {
        document.getElementById('startButton')?.addEventListener('click', () => this.start());
        document.getElementById('soundButton')?.addEventListener('click', () => this.toggleMute());
        document.getElementById('btnPhoto')?.addEventListener('click', () => this.togglePhotoMode());
        document.getElementById('btnShutter')?.addEventListener('click', () => this.takePhoto());

        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            if (e.code === 'KeyF' || e.code === 'KeyC') this.togglePhotoMode();
            if (e.code === 'Space' && this.inPhotoMode) this.takePhoto();
            if (e.code === 'KeyM') this.toggleMute();
            if (e.code === 'Enter' && this.state === 'menu') this.start();
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });

        // Touch stick rédea/movimento
        const stick = document.getElementById('moveStick');
        const knob = document.getElementById('moveKnob');
        if (stick && knob) {
            let active = false;
            let startX = 0, startY = 0;

            const onMove = (clientX, clientY) => {
                if (!active) return;
                const dx = clientX - startX;
                const dy = clientY - startY;
                const max = 44;
                const dist = Math.hypot(dx, dy);
                const k = dist > 0 ? Math.min(dist, max) / dist : 0;
                knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
                this.touchSteer = clamp((dx * k) / max, -1, 1);
                this.touchThrottle = -clamp((dy * k) / max, -1, 1);
            };

            stick.addEventListener('pointerdown', (e) => {
                active = true;
                startX = e.clientX;
                startY = e.clientY;
                stick.setPointerCapture(e.pointerId);
            });

            stick.addEventListener('pointermove', (e) => onMove(e.clientX, e.clientY));

            const onEnd = () => {
                active = false;
                knob.style.transform = 'translate(0px, 0px)';
                this.touchSteer = 0;
                this.touchThrottle = 0;
            };

            stick.addEventListener('pointerup', onEnd);
            stick.addEventListener('pointercancel', onEnd);
        }
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
            this.scene.clearColor = new BABYLON.Color4(0.12, 0.08, 0.05, 1.0);
        } catch (err) {
            console.error(err);
            return;
        }

        // Cenário da Savana
        this.world = buildSavannaWorld(BABYLON, this.scene);

        // Jipe de Expedição
        this.jeep = buildJeep(BABYLON, this.scene);

        // Câmera de perseguição do jipe
        this.camera = new BABYLON.FreeCamera('chaseCam', new BABYLON.Vector3(0, 3, -108), this.scene);
        this.camera.minZ = 0.1;
        this.camera.maxZ = 1600;

        // Pipeline PBR de cinema
        const pipe = new BABYLON.DefaultRenderingPipeline('pipeline', true, this.scene, [this.camera]);
        pipe.fxaaEnabled = true;
        pipe.bloomEnabled = true;
        pipe.bloomThreshold = 0.78;
        pipe.bloomWeight = 0.32;
        pipe.imageProcessing.toneMappingEnabled = true;
        pipe.imageProcessing.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
        pipe.imageProcessing.contrast = 1.18;

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

    togglePhotoMode() {
        this.inPhotoMode = !this.inPhotoMode;
        const vf = document.getElementById('viewfinder');
        if (vf) vf.hidden = !this.inPhotoMode;
    }

    takePhoto() {
        // Flash da câmera
        const flash = document.getElementById('shutterFlash');
        if (flash) {
            flash.style.opacity = '1';
            setTimeout(() => { flash.style.opacity = '0'; }, 120);
        }

        // Identificação do sujeito fotografado
        let photoSubject = 'Savana Dourada';
        for (const animal of this.world.animalInstances) {
            const dx = animal.root.position.x - this.camera.position.x;
            const dz = animal.root.position.z - this.camera.position.z;
            const dist = Math.hypot(dx, dz);
            if (dist < 80) {
                photoSubject = animal.name || animal.species;
                break;
            }
        }

        this.photos.push(photoSubject);
        const shotsEl = document.getElementById('shotsValue');
        if (shotsEl) shotsEl.textContent = `${this.photos.length} fotos`;

        const vfSpecies = document.getElementById('vfSpecies');
        if (vfSpecies) vfSpecies.textContent = photoSubject;

        const polaroid = document.getElementById('polaroid');
        const polSpecies = document.getElementById('polaroidSpecies');
        if (polaroid && polSpecies) {
            polSpecies.textContent = photoSubject;
            polaroid.hidden = false;
            setTimeout(() => { polaroid.hidden = true; }, 2400);
        }
    }

    toggleMute() {
        // Toggle áudio
    }

    frame() {
        const dt = Math.min(0.05, this.engine.getDeltaTime() / 1000);

        if (this.state === 'drive') {
            // Controles de direção do Jipe
            let throttle = this.touchThrottle;
            let steer = this.touchSteer;

            if (this.keys['KeyW'] || this.keys['ArrowUp']) throttle = 1.0;
            if (this.keys['KeyS'] || this.keys['ArrowDown']) throttle = -0.7;
            if (this.keys['KeyA'] || this.keys['ArrowLeft']) steer = -1.0;
            if (this.keys['KeyD'] || this.keys['ArrowRight']) steer = 1.0;

            const maxSpeed = 24; // m/s (~85 km/h)
            if (throttle > 0) {
                this.speed = Math.min(maxSpeed, this.speed + 12 * dt);
            } else if (throttle < 0) {
                this.speed = Math.max(-10, this.speed - 20 * dt);
            } else {
                this.speed = lerp(this.speed, 0, dt * 2.2);
            }

            const turnRate = 1.5 * (Math.min(1, Math.abs(this.speed) / 5));
            this.yaw += steer * turnRate * dt;

            this.pos.x += Math.sin(this.yaw) * this.speed * dt;
            this.pos.z += Math.cos(this.yaw) * this.speed * dt;

            // Atualização do jipe
            this.jeep.root.position.set(this.pos.x, this.pos.y, this.pos.z);
            this.jeep.root.rotation.y = this.yaw;

            // Esterçamento das rodas dianteiras
            this.jeep.wheels.fl.pivot.rotation.y = steer * 0.45;
            this.jeep.wheels.fr.pivot.rotation.y = steer * 0.45;

            // Rotação dos pneus
            const rotSpeed = (this.speed / 0.42) * dt;
            Object.values(this.jeep.wheels).forEach(w => w.tire.rotation.x += rotSpeed);

            // Câmera de perseguição do jipe
            const camDist = this.inPhotoMode ? 2.8 : 8.5;
            const camHeight = this.inPhotoMode ? 2.0 : 3.2;
            const targetCamX = this.pos.x - Math.sin(this.yaw) * camDist;
            const targetCamZ = this.pos.z - Math.cos(this.yaw) * camDist;
            const targetCamY = this.pos.y + camHeight;

            this.camera.position.x = lerp(this.camera.position.x, targetCamX, dt * 6.0);
            this.camera.position.y = lerp(this.camera.position.y, targetCamY, dt * 6.0);
            this.camera.position.z = lerp(this.camera.position.z, targetCamZ, dt * 6.0);

            const lookTarget = new window.BABYLON.Vector3(
                this.pos.x + Math.sin(this.yaw) * 6,
                this.pos.y + 1.2,
                this.pos.z + Math.cos(this.yaw) * 6
            );
            this.camera.setTarget(lookTarget);
        }
    }
}

try {
    new SafariDourado();
} catch (err) {
    console.error(err);
}
