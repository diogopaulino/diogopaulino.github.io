/**
 * Rastro Vermelho — faroeste 3D em Babylon.js.
 * Cavalo procedural, terreno infinito, poeira de galope e atmosfera de cinema.
 */

import { HORSE } from './config.js';
import { heightAt, regionName, biomeAt, WorldManager } from './world.js';
import { buildHorse, animateHorse } from './horse.js';
import { buildSky, updateSkyAndLights } from './sky.js';
import { DustEffects } from './effects.js';
import { WesternAudio } from './audio.js';
import { clamp, lerp } from './utils.js';

class RastroVermelho {
    constructor() {
        this.canvas = document.getElementById('scene');
        this.state = 'boot';

        this.pos = { x: 0, y: heightAt(0, 0), z: 0 };
        this.yaw = 0;
        this.speed = HORSE.cruise || 14;
        this.distance = 0;
        this.dayProgress = 0.45; // entardecer dourado

        this.keys = {};
        this.touchSteer = 0;
        this.touchThrottle = 0;

        this.audio = new WesternAudio();
        this.bindUi();
        this.boot();
    }

    bindUi() {
        document.getElementById('startButton')?.addEventListener('click', () => this.start());
        document.getElementById('soundButton')?.addEventListener('click', () => this.toggleMute());
        document.getElementById('btnSpur')?.addEventListener('pointerdown', () => {
            this.touchThrottle = 1.0;
        });
        document.getElementById('btnSpur')?.addEventListener('pointerup', () => {
            this.touchThrottle = 0;
        });

        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            if (e.code === 'KeyM') this.toggleMute();
            if (e.code === 'Enter' && this.state === 'intro') this.start();
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });

        // Touch stick rédea
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
                this.touchSteer = -clamp((dx * k) / max, -1, 1);
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
            this.scene.clearColor = new BABYLON.Color4(0.85, 0.45, 0.25, 1.0);
        } catch (err) {
            console.error(err);
            return;
        }

        // Iluminação & Céu
        this.lights = {
            hemi: new BABYLON.HemisphericLight('hemi_light', new BABYLON.Vector3(0, 1, 0), this.scene),
            sun: new BABYLON.DirectionalLight('sun_light', new BABYLON.Vector3(-0.4, -0.6, -0.7).normalize(), this.scene)
        };
        this.lights.sun.position = new BABYLON.Vector3(80, 120, 80);
        this.shadowGen = new BABYLON.ShadowGenerator(2048, this.lights.sun);
        this.shadowGen.usePoissonSampling = true;

        this.skyObj = buildSky(BABYLON, this.scene);
        updateSkyAndLights(BABYLON, this.skyObj, this.lights, this.dayProgress);

        // Mundo e Terreno
        this.world = new WorldManager(BABYLON, this.scene);
        this.world.update(this.pos);

        // Cavalo e Cavaleiro
        this.horse = buildHorse(BABYLON, this.scene);
        this.horse.root.position.set(this.pos.x, this.pos.y, this.pos.z);
        this.horse.root.getChildMeshes().forEach((m) => {
            this.shadowGen.addShadowCaster(m, true);
        });

        // Poeira
        this.dust = new DustEffects(BABYLON, this.scene);

        // Câmera de perseguição do cavalo
        this.camera = new BABYLON.FreeCamera('chaseCam', new BABYLON.Vector3(0, 5, -8), this.scene);

        // Pipeline PBR
        const pipe = new BABYLON.DefaultRenderingPipeline('pipeline', true, this.scene, [this.camera]);
        pipe.fxaaEnabled = true;
        pipe.bloomEnabled = true;
        pipe.bloomThreshold = 0.8;
        pipe.bloomWeight = 0.25;
        pipe.imageProcessing.toneMappingEnabled = true;
        pipe.imageProcessing.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
        pipe.imageProcessing.contrast = 1.15;

        document.getElementById('loadingOverlay').hidden = true;
        document.getElementById('menuOverlay').hidden = false;
        document.body.dataset.state = 'intro';

        this.engine.runRenderLoop(() => {
            this.frame();
            this.scene.render();
        });

        window.addEventListener('resize', () => this.engine.resize());
    }

    start() {
        this.state = 'play';
        document.getElementById('menuOverlay').hidden = true;
        document.getElementById('hud').hidden = false;
        document.getElementById('touchControls').hidden = !('ontouchstart' in window);
        document.body.dataset.state = 'play';

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

        if (this.state === 'play') {
            // Controles
            let steer = this.touchSteer;
            let throttle = this.touchThrottle;

            if (this.keys['KeyA'] || this.keys['ArrowLeft']) steer += 1;
            if (this.keys['KeyD'] || this.keys['ArrowRight']) steer -= 1;
            if (this.keys['KeyW'] || this.keys['ArrowUp']) throttle += 1;
            if (this.keys['KeyS'] || this.keys['ArrowDown']) throttle -= 1;

            // Física de galope
            const targetSpeed = throttle > 0 ? (HORSE.sprint || 22) : (throttle < 0 ? (HORSE.walk || 8) : (HORSE.cruise || 14));
            this.speed = lerp(this.speed, targetSpeed, dt * 2.5);
            this.yaw += steer * (HORSE.turnRate || 1.6) * dt;

            this.pos.x += Math.sin(this.yaw) * this.speed * dt;
            this.pos.z += Math.cos(this.yaw) * this.speed * dt;
            this.pos.y = heightAt(this.pos.x, this.pos.z);
            this.distance += this.speed * dt;

            // Atualização do cavalo
            this.horse.root.position.set(this.pos.x, this.pos.y, this.pos.z);
            this.horse.root.rotation.y = this.yaw;

            animateHorse(this.horse, this.speed, this.distance, dt);
            this.dust.update(this.pos, this.speed);

            // Câmera dinâmica de perseguição
            const camDist = 7.5;
            const camHeight = 3.2;
            const targetCamX = this.pos.x - Math.sin(this.yaw) * camDist;
            const targetCamZ = this.pos.z - Math.cos(this.yaw) * camDist;
            const targetCamY = this.pos.y + camHeight;

            this.camera.position.x = lerp(this.camera.position.x, targetCamX, dt * 6.0);
            this.camera.position.y = lerp(this.camera.position.y, targetCamY, dt * 6.0);
            this.camera.position.z = lerp(this.camera.position.z, targetCamZ, dt * 6.0);

            const lookTarget = new window.BABYLON.Vector3(
                this.pos.x + Math.sin(this.yaw) * 4,
                this.pos.y + 1.8,
                this.pos.z + Math.cos(this.yaw) * 4
            );
            this.camera.setTarget(lookTarget);

            // Terreno infinito
            this.world.update(this.pos);

            // Áudio
            this.audio.setGait(this.speed);

            // Atualização de HUD
            this.updateHud();
        }
    }

    updateHud() {
        const speedEl = document.getElementById('speedValue');
        const distEl = document.getElementById('distanceValue');
        const regionEl = document.getElementById('regionName');
        const biomeEl = document.getElementById('biomeLabel');

        if (speedEl) speedEl.textContent = `${Math.round(this.speed * 3.6)}`;
        if (distEl) distEl.textContent = `${(this.distance / 1000).toFixed(1)} km`;

        const cx = Math.floor(this.pos.x / 120);
        const cz = Math.floor(this.pos.z / 120);
        if (regionEl) regionEl.textContent = regionName(cx, cz);
        if (biomeEl) biomeEl.textContent = biomeAt(this.pos.x, this.pos.z, this.pos.y);
    }
}

try {
    new RastroVermelho();
} catch (err) {
    console.error(err);
}
