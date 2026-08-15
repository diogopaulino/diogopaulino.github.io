/**
 * Rastro Vermelho — laço principal, câmera de perseguição e ciclo do dia.
 *
 * Câmera 0: chase atrás do cavalo
 * Câmera 1: cinematográfica (mais longe, FOV fechado)
 * Câmera 2: sobre o ombro do cavaleiro
 */

import * as THREE from 'three';
import { QUALITY, STORAGE_KEY, CAMERA, DAY_LENGTH, CHUNK_SIZE } from './config.js';
import { clamp, damp, detectMobile, detectSoftwareGL, rendererIsSoftware, wrap01 } from './utils.js';
import { Input } from './input.js';
import { GameAudio } from './audio.js';
import { Hud } from './hud.js';
import { createSky, createSkyUniforms, sampleSkyPalette, applySkyPalette, createLights } from './sky.js';
import { World } from './world.js';
import { Horse } from './horse.js';
import { Wildlife } from './wildlife.js';
import { Dust } from './effects.js';

const LOOK = new THREE.Vector3();
const CAM = new THREE.Vector3();
const FWD = new THREE.Vector3();

class Game {
    constructor() {
        this.hud = new Hud();
        this.canvas = document.getElementById('scene');
        this.settings = this.loadSettings();
        this.state = 'loading';
        this.time = 0;
        this.elapsed = 0;
        this.hour = 0.72;
        this.cameraMode = 0;
        this.lookYaw = 0;
        this.lookPitch = CAMERA.defaultPitch;
        this.camDist = CAMERA.chaseDist;
        this.fpsAccum = 0;
        this.fpsFrames = 0;
        this.hudAccum = 0;
        this.fpsLowTime = 0;
        this.adapted = false;
        this.lastRegion = '';
        this.marks = new Set();
    }

    loadSettings() {
        const fallback = { quality: 'auto', volume: 70, muted: false, best: 0 };
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
        } catch (err) {
            return fallback;
        }
    }

    saveSettings() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
        } catch (err) { /* privado */ }
    }

    resolveQuality() {
        const choice = this.settings.quality;
        if (choice !== 'auto' && QUALITY[choice]) return QUALITY[choice];
        if (detectMobile() || detectSoftwareGL()) return QUALITY.low;
        const big = Math.min(window.innerWidth, window.innerHeight) >= 900;
        return big ? QUALITY.high : QUALITY.medium;
    }

    async init() {
        this.hud.setLoading(0.08, 'Abrindo a trilha de terra…');
        this.quality = this.resolveQuality();
        this.mobile = detectMobile() || Boolean(window.matchMedia?.('(pointer: coarse)')?.matches);

        try {
            this.renderer = new THREE.WebGLRenderer({
                canvas: this.canvas,
                antialias: this.quality.antialias,
                powerPreference: 'high-performance',
                alpha: false
            });
        } catch (err) {
            this.hud.showError('WebGL não pôde iniciar neste navegador.');
            return;
        }

        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.quality.pixelRatio));
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.08;
        this.renderer.shadowMap.enabled = this.quality.shadows;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.setClearColor(0x1a0e08, 1);

        if (rendererIsSoftware(this.renderer) && this.settings.quality === 'auto') {
            this.quality = QUALITY.low;
            this.renderer.shadowMap.enabled = false;
            this.renderer.setPixelRatio(1);
        }

        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0xc89a62, this.quality.fogDensity);

        this.camera = new THREE.PerspectiveCamera(
            CAMERA.chaseFov,
            window.innerWidth / window.innerHeight,
            0.15,
            this.quality.drawDistance * 4
        );
        this.skyUniforms = createSkyUniforms();
        this.sky = createSky(this.skyUniforms);
        this.scene.add(this.sky);
        this.lights = createLights(this.scene, this.quality);

        this.hud.setLoading(0.32, 'Erguendo as serras…');
        this.world = new World(this.scene, this.quality);
        this.spawn = this.world.findSpawn();
        this.world.loadChunk(Math.floor(this.spawn.x / CHUNK_SIZE), Math.floor(this.spawn.z / CHUNK_SIZE));

        this.hud.setLoading(0.58, 'Apertando a sela…');
        this.player = new Horse(this.scene, this.world);
        this.player.reset(this.spawn);
        this.wildlife = new Wildlife(this.scene, this.world, this.quality);
        this.dust = new Dust(this.scene, this.quality);

        this.hud.setLoading(0.82, 'O vento chega do oeste…');
        this.input = new Input(this.canvas);
        this.audio = new GameAudio();
        this.audio.volume = this.settings.volume / 100;
        this.audio.muted = this.settings.muted;

        this.input.bindTouch({
            stick: document.getElementById('moveStick'),
            knob: document.getElementById('moveKnob'),
            look: document.getElementById('lookZone'),
            spur: document.getElementById('btnSpur')
        });

        this.composer = null;
        if (this.quality.bloom) {
            try {
                const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }] = await Promise.all([
                    import('three/addons/postprocessing/EffectComposer.js'),
                    import('three/addons/postprocessing/RenderPass.js'),
                    import('three/addons/postprocessing/UnrealBloomPass.js'),
                    import('three/addons/postprocessing/OutputPass.js')
                ]);
                const composer = new EffectComposer(this.renderer);
                composer.addPass(new RenderPass(this.scene, this.camera));
                const bloom = new UnrealBloomPass(
                    new THREE.Vector2(window.innerWidth, window.innerHeight),
                    0.18, 0.55, 0.84
                );
                composer.addPass(bloom);
                composer.addPass(new OutputPass());
                this.composer = composer;
                this.bloom = bloom;
            } catch (err) {
                this.composer = null;
            }
        }

        this.bindUi();
        this.hud.setSettings({
            quality: this.settings.quality,
            volume: this.settings.volume,
            best: this.settings.best
        });
        this.hud.setMuted(this.settings.muted);
        this.hud.showTouch(this.mobile);
        this.hud.hideLoading();
        this.hud.showMenu(true);
        this.state = 'menu';
        this.hud.setState('menu');

        window.addEventListener('resize', () => this.resize());
        this.clock = new THREE.Clock();
        this.renderer.setAnimationLoop(() => this.frame());
    }

    bindUi() {
        const h = this.hud.el;
        h.startButton = document.getElementById('startButton');
        h.resumeButton = document.getElementById('resumeButton');
        h.pauseMenuButton = document.getElementById('pauseMenuButton');

        h.startButton.addEventListener('click', () => this.start());
        h.resumeButton.addEventListener('click', () => this.resume());
        h.pauseMenuButton.addEventListener('click', () => this.toMenu());
        h.soundButton.addEventListener('click', () => this.toggleMute());
        h.pauseButton.addEventListener('click', () => this.togglePause());
        h.qualitySelect.addEventListener('change', () => {
            this.settings.quality = h.qualitySelect.value;
            this.saveSettings();
        });
        h.volumeSlider.addEventListener('input', () => {
            this.settings.volume = Number(h.volumeSlider.value);
            h.volumeValue.textContent = String(this.settings.volume);
            this.audio.setVolume(this.settings.volume / 100);
            this.saveSettings();
        });

        this.input.on('pause', () => this.togglePause());
        this.input.on('mute', () => this.toggleMute());
        this.input.on('camera', () => {
            if (this.state === 'play') this.cameraMode = (this.cameraMode + 1) % 3;
        });
        this.input.on('cruise', () => {
            if (this.state !== 'play') return;
            const on = this.player.toggleCruise();
            this.hud.say(on ? 'Galope livre — o cavalo não para.' : 'Rédea curta — o passo fica com você.', 2.8);
        });
        this.input.on('pointerdown', () => {
            if (this.state === 'play') this.input.requestLock();
        });
        this.canvas.addEventListener('click', () => {
            if (this.state === 'play') this.input.requestLock();
        });
    }

    async start() {
        await this.audio.unlock();
        this.audio.setMuted(this.settings.muted);
        this.audio.setVolume(this.settings.volume / 100);
        this.player.reset(this.spawn);
        this.elapsed = 0;
        this.hour = 0.72;
        this.marks = new Set();
        this.lastRegion = '';
        this.lookYaw = this.player.yaw;
        this.lookPitch = CAMERA.defaultPitch;
        this.hud.showMenu(false);
        this.hud.showPause(false);
        this.hud.showHud(true);
        this.state = 'play';
        this.hud.setState('play');
        this.input.enabled = true;
        this.input.requestLock();
        const region = this.world.currentRegion(this.player.x, this.player.z);
        this.hud.say(`${region.name}. O cavalo já galopa — o oeste não acaba.`, 4.6);
        this.lastRegion = region.name;
    }

    toMenu() {
        this.input.exitLock();
        this.settings.best = Math.max(this.settings.best, this.player.distance);
        this.saveSettings();
        this.hud.showPause(false);
        this.hud.showHud(false);
        this.hud.showMenu(true);
        this.state = 'menu';
        this.hud.setState('menu');
        this.hud.setSettings({
            quality: this.settings.quality,
            volume: this.settings.volume,
            best: this.settings.best
        });
    }

    togglePause() {
        if (this.state === 'play') {
            this.state = 'pause';
            this.hud.setState('pause');
            this.hud.showPause(true);
            this.input.exitLock();
        } else if (this.state === 'pause') {
            this.resume();
        }
    }

    resume() {
        this.hud.showPause(false);
        this.state = 'play';
        this.hud.setState('play');
        this.input.requestLock();
    }

    toggleMute() {
        this.settings.muted = !this.settings.muted;
        this.audio.setMuted(this.settings.muted);
        this.hud.setMuted(this.settings.muted);
        this.saveSettings();
    }

    resize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
        this.composer?.setSize(w, h);
    }

    frame() {
        const dt = Math.min(0.05, this.clock.getDelta());
        this.time += dt;

        if (this.state === 'play') {
            this.elapsed += dt;
            this.hour = wrap01(0.72 + this.elapsed / DAY_LENGTH);
            this.tickPlay(dt);
        } else {
            this.idleCamera(dt);
        }

        this.applySky();
        this.sky.position.copy(this.camera.position);
        if (this.sky.material.uniforms.uTime) this.sky.material.uniforms.uTime.value = this.time;
        this.world.update(dt, this.time, this.player);
        this.dust.update(dt);

        if (this.composer) this.composer.render();
        else this.renderer.render(this.scene, this.camera);

        this.fpsAccum += dt;
        this.fpsFrames += 1;
        if (this.fpsAccum >= 0.5) {
            const fps = Math.round(this.fpsFrames / this.fpsAccum);
            this.hud.setFps(fps);
            this.adaptIfNeeded(fps, this.fpsAccum);
            this.fpsAccum = 0;
            this.fpsFrames = 0;
        }
        this.hud.tick(dt);
    }

    tickPlay(dt) {
        const result = this.player.update(dt, this.input);
        const nearHerd = this.wildlife.update(dt, this.player, this.time);
        this.updateCamera(dt);

        this.audio.update(dt, this.player.speed);
        if (result.hoof) {
            this.audio.hoof(this.player.inWater);
            this.dust.burst(this.player.x, this.player.y, this.player.z, this.player.speed, this.player.inWater);
        }
        if (result.spur) this.audio.spur();

        const region = this.world.currentRegion(this.player.x, this.player.z);
        if (region.name !== this.lastRegion) {
            this.lastRegion = region.name;
            this.hud.say(region.name, 2.6);
        }

        const mark = this.world.nearestLandmark(this.player.x, this.player.z, 16);
        if (mark && !this.marks.has(mark.id)) {
            this.marks.add(mark.id);
            this.hud.say(`${mark.label} — ${region.name}`, 3.2);
        }
        if (nearHerd && !this.marks.has('herd')) {
            this.marks.add('herd');
            this.hud.say('Manada na pradaria.', 2.8);
        }

        this.hudAccum += dt;
        if (this.hudAccum > 0.12) {
            this.hudAccum = 0;
            this.hud.setPlay({
                gait: this.player.gait,
                speed: this.player.speed,
                region: region.name,
                biome: region.biome,
                distance: this.player.distance,
                hour: this.hour,
                yaw: this.lookYaw,
                cruise: this.player.cruise,
                marks: this.marks
            });
        }

        if (this.player.distance > this.settings.best) {
            this.settings.best = this.player.distance;
        }
    }

    adaptIfNeeded(fps, dt) {
        if (this.adapted || this.settings.quality !== 'auto') return;
        if (fps < 26) this.fpsLowTime += dt;
        else this.fpsLowTime = 0;
        if (this.fpsLowTime < 2.2) return;
        this.adapted = true;
        this.renderer.setPixelRatio(1);
        this.renderer.shadowMap.enabled = false;
        this.composer = null;
        if (this.world.grass) this.world.grass.count = Math.min(this.world.grass.count, 700);
        this.hud.say('Qualidade reduzida para manter o galope fluido.', 3.4);
    }

    updateCamera(dt) {
        const look = this.input.consumeLook();
        this.lookYaw -= look.x * 0.0022;
        this.lookPitch = clamp(this.lookPitch - look.y * 0.0018, CAMERA.pitchMin, CAMERA.pitchMax);
        this.camDist = clamp(this.camDist + this.input.consumeZoom() * 0.45, 5.5, 22);

        if (this.cameraMode === 0 && Math.hypot(this.input.move.x, this.input.move.z) > 0.12) {
            this.lookYaw = damp(this.lookYaw, this.player.yaw, 1.6, dt);
        }

        const fovTarget = this.cameraMode === 1 ? CAMERA.cineFov
            : this.cameraMode === 2 ? CAMERA.riderFov
                : CAMERA.chaseFov;
        this.camera.fov = damp(this.camera.fov, fovTarget, 8, dt);
        this.camera.updateProjectionMatrix();

        FWD.set(Math.sin(this.lookYaw), 0, Math.cos(this.lookYaw));
        const origin = this.player.mesh.position;

        if (this.cameraMode === 2) {
            CAM.copy(origin).addScaledVector(FWD, 0.35);
            CAM.y = origin.y + CAMERA.riderHeight;
            LOOK.copy(origin).addScaledVector(FWD, 14);
            LOOK.y = origin.y + 1.5 + Math.sin(this.lookPitch) * 4;
        } else if (this.cameraMode === 1) {
            const dist = this.camDist * 1.45;
            CAM.copy(origin).addScaledVector(FWD, -dist);
            CAM.y = origin.y + CAMERA.cineHeight + Math.sin(this.lookPitch) * 3;
            LOOK.copy(origin);
            LOOK.y = origin.y + 1.1;
        } else {
            CAM.copy(origin).addScaledVector(FWD, -this.camDist);
            CAM.y = origin.y + CAMERA.chaseHeight + Math.sin(this.lookPitch) * 2.4;
            LOOK.copy(origin);
            LOOK.y = origin.y + CAMERA.chaseLook;
        }

        const ground = this.world.heightAt(CAM.x, CAM.z);
        CAM.y = Math.max(CAM.y, ground + 1.35);

        this.camera.position.lerp(CAM, 1 - Math.exp(-6.5 * dt));
        // O alvo respeita o relevo, mas a interpolação atravessa a encosta
        // quando o cavalo despenca ladeira abaixo — reergue a posição final.
        const camGround = this.world.heightAt(this.camera.position.x, this.camera.position.z);
        this.camera.position.y = Math.max(this.camera.position.y, camGround + 1.35);
        this.camera.lookAt(LOOK);

        this.lights.dir.target.position.copy(origin);
        this.lights.dir.position.copy(origin).addScaledVector(this.skyUniforms.uSunDir.value, 96);
    }

    idleCamera(dt) {
        const t = this.time * 0.07;
        const s = this.spawn;
        CAM.set(s.x + Math.cos(t) * 28, s.y + 11 + Math.sin(t * 0.6) * 2.5, s.z + 18 + Math.sin(t) * 16);
        LOOK.set(s.x, s.y + 1.8, s.z);
        this.camera.position.lerp(CAM, 1 - Math.exp(-1.4 * dt));
        this.camera.lookAt(LOOK);
        this.camera.fov = damp(this.camera.fov, 52, 3, dt);
        this.camera.updateProjectionMatrix();
        this.lights.dir.target.position.set(s.x, s.y, s.z);
        this.lights.dir.position.set(s.x + 70, s.y + 48, s.z - 50);
    }

    applySky() {
        const pal = sampleSkyPalette(this.state === 'play' ? this.hour : 0.72);
        applySkyPalette(this.skyUniforms, pal);
        this.scene.fog.color.copy(pal.fog);
        this.lights.dir.color.copy(pal.light);
        this.lights.dir.intensity = pal.lightIntensity;
        this.lights.hemi.color.copy(pal.horizon);
        this.lights.hemi.groundColor.copy(pal.ground);
        this.lights.amb.color.copy(pal.ambient);
        const night = pal.lightIntensity < 0.8 ? 0.22 : 0;
        this.renderer.toneMappingExposure = 1.1 - night * 0.15;
        if (this.bloom) this.bloom.strength = 0.16 + (this.hour > 0.7 && this.hour < 0.88 ? 0.16 : 0);
        if (this.world.water?.material) {
            this.world.water.material.color.set(0x1a3a3a).lerp(pal.horizon, 0.25);
        }
    }
}

const game = new Game();
game.init().catch((err) => {
    console.error(err);
    game.hud.showError('Algo falhou ao abrir o oeste.');
});
