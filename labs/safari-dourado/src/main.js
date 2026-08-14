/**
 * Safari Dourado — laço principal, câmera cinematográfica e caderno de campo.
 */

import * as THREE from 'three';
import { QUALITY, STORAGE_KEY, CAMERA, GOLDEN_HOUR, SPECIES_ORDER, SPECIES } from './config.js';
import { clamp, damp, detectMobile, detectSoftwareGL, rendererIsSoftware, formatTime } from './utils.js';
import { Input } from './input.js';
import { GameAudio } from './audio.js';
import { Hud, statsBlock } from './hud.js';
import { createSky, createSkyUniforms, sampleSkyPalette, applySkyPalette, createLights } from './sky.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Wildlife } from './animals.js';
import { PhotoSystem, focalMm } from './photo.js';

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
        this.hour = 0;
        this.cameraMode = 0;
        this.photoFov = CAMERA.photoFov;
        this.lookYaw = 0;
        this.lookPitch = 0.12;
        this.fpsAccum = 0;
        this.fpsFrames = 0;
        this.hudAccum = 0;
        this.won = false;
        this.fpsLowTime = 0;
        this.adapted = false;
        this.photo = new PhotoSystem();
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
        this.hud.setLoading(0.1, 'Abrindo a trilha de terra…');
        this.quality = this.resolveQuality();
        this.mobile = detectMobile();

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
        this.renderer.setClearColor(0x1a1008, 1);

        if (rendererIsSoftware(this.renderer) && this.settings.quality === 'auto') {
            this.quality = QUALITY.low;
            this.renderer.shadowMap.enabled = false;
            this.renderer.setPixelRatio(1);
        }

        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0xc89a62, this.quality.fogDensity);

        this.camera = new THREE.PerspectiveCamera(CAMERA.chaseFov, window.innerWidth / window.innerHeight, 0.15, this.quality.drawDistance * 4);
        this.skyUniforms = createSkyUniforms();
        this.sky = createSky(this.skyUniforms);
        this.scene.add(this.sky);
        this.lights = createLights(this.scene, this.quality);

        this.hud.setLoading(0.38, 'Plantando acácias…');
        this.world = new World(this.scene, this.skyUniforms, this.quality);

        this.hud.setLoading(0.62, 'A vida selvagem chega ao poço…');
        this.player = new Player(this.scene, this.world);
        this.wildlife = new Wildlife(this.scene, this.world, this.quality);

        this.hud.setLoading(0.82, 'Afinando a hora dourada…');
        this.input = new Input(this.canvas);
        this.audio = new GameAudio();
        this.audio.volume = this.settings.volume / 100;
        this.audio.muted = this.settings.muted;

        this.input.bindTouch({
            stick: document.getElementById('moveStick'),
            knob: document.getElementById('moveKnob'),
            look: document.getElementById('lookZone'),
            photo: document.getElementById('btnPhoto'),
            shutter: document.getElementById('btnShutter')
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
                    0.22, 0.55, 0.82
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
        h.replayButton = document.getElementById('replayButton');
        h.victoryMenuButton = document.getElementById('victoryMenuButton');

        h.startButton.addEventListener('click', () => this.start());
        h.resumeButton.addEventListener('click', () => this.resume());
        h.pauseMenuButton.addEventListener('click', () => this.toMenu());
        h.replayButton.addEventListener('click', () => this.start());
        h.victoryMenuButton.addEventListener('click', () => this.toMenu());
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
        this.player.reset();
        this.photo.reset();
        this.elapsed = 0;
        this.hour = 0;
        this.won = false;
        this.lookYaw = this.player.yaw;
        this.lookPitch = 0.12;
        this.photoFov = CAMERA.photoFov;
        this.hud.showMenu(false);
        this.hud.showPause(false);
        this.hud.showVictory(false);
        this.hud.showHud(true);
        this.state = 'play';
        this.hud.setState('play');
        this.input.enabled = true;
        this.input.requestLock();
        this.hud.say('A hora dourada começou. Dirija até o poço e levante a lente.', 4.5);
    }

    toMenu() {
        this.input.exitLock();
        this.hud.showPause(false);
        this.hud.showVictory(false);
        this.hud.showHud(false);
        this.hud.setPhotoMode(false);
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
            this.hour = clamp(this.elapsed / GOLDEN_HOUR, 0, 1);
            this.tickPlay(dt);
        } else {
            this.idleCamera(dt);
        }

        this.applySky();
        this.sky.position.copy(this.camera.position);
        if (this.sky.material.uniforms.uTime) this.sky.material.uniforms.uTime.value = this.time;
        this.world.update(dt, this.time, this.player);

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
        const photoMode = this.input.photoMode;
        this.player.update(dt, this.input, photoMode);
        this.wildlife.update(dt, this.player, this.time);
        this.updateCamera(dt, photoMode);
        this.audio.update(dt, this.player.speed);
        this.audio.engineTone(this.player.speed);

        const zoom = this.input.consumeZoom();
        if (photoMode && zoom) {
            this.photoFov = clamp(this.photoFov + zoom * 3.2, CAMERA.photoFovMin, CAMERA.photoFovMax);
        }

        const aim = this.photo.update(dt, this.camera, this.wildlife);
        this.hud.setPhotoMode(photoMode);
        this.hud.el.prompt.hidden = photoMode;
        if (photoMode) {
            const spec = aim ? SPECIES[aim.animal.species] : null;
            const rating = !aim ? 'sem alvo'
                : aim.dist < 9 ? 'perto demais'
                    : aim.center > 0.7 && aim.fill > 0.22 ? 'nítido'
                        : 'busque o centro';
            this.hud.setViewfinder({
                species: spec?.label || 'paisagem',
                hint: spec ? `${Math.round(aim.dist)} m · ${spec.rarity}` : 'procure movimento',
                zoom: `${focalMm(this.photoFov)}mm`,
                rating
            });
        }

        if (this.input.consumeShutter()) {
            if (!photoMode) {
                this.hud.say('Aperte F para levantar a lente, depois clique ou Espaço.', 2.8);
            } else {
                const shot = this.photo.shoot(aim);
                this.audio.shutter();
                this.hud.flashShutter();
                if (shot) this.hud.showPolaroid(shot);
                if (shot?.first) this.hud.say(`${shot.label} — primeiro registro no caderno.`, 3.2);
                this.maybeWin();
            }
        }

        this.hudAccum += dt;
        if (this.hudAccum > 0.12) {
            this.hudAccum = 0;
            this.hud.setPlay({
                score: this.photo.score,
                shots: this.photo.shots,
                time: this.elapsed,
                hour: this.hour,
                journal: this.photo.speciesCount(),
                best: this.photo.best
            });
        }
    }

    maybeWin() {
        if (this.won) return;
        if (this.photo.speciesCount() < SPECIES_ORDER.length) return;
        this.won = true;
        this.settings.best = Math.max(this.settings.best, this.photo.score);
        this.saveSettings();
        this.hud.setVictory(statsBlock([
            ['Revelações', String(this.photo.score)],
            ['Fotos', String(this.photo.shots)],
            ['Tempo', formatTime(this.elapsed)]
        ]));
        this.hud.showVictory(true);
        this.hud.showHud(false);
        this.hud.setPhotoMode(false);
        this.state = 'victory';
        this.hud.setState('victory');
        this.input.exitLock();
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
        if (this.world.grass) this.world.grass.visible = false;
        this.hud.say('Qualidade reduzida para manter o safari fluido.', 3.4);
    }

    updateCamera(dt, photoMode) {
        const look = this.input.consumeLook();
        const sens = photoMode ? 0.0016 : 0.0022;
        this.lookYaw -= look.x * sens;
        this.lookPitch = clamp(this.lookPitch - look.y * sens, -0.55, 0.72);

        if (!photoMode && this.cameraMode === 0 && Math.hypot(this.input.move.x, this.input.move.z) > 0.15) {
            this.lookYaw = damp(this.lookYaw, this.player.yaw, 1.8, dt);
        }

        const fovTarget = photoMode ? this.photoFov : (this.cameraMode === 2 ? 52 : CAMERA.chaseFov);
        this.camera.fov = damp(this.camera.fov, fovTarget, 8, dt);
        this.camera.updateProjectionMatrix();

        FWD.set(Math.sin(this.lookYaw), 0, Math.cos(this.lookYaw));
        const origin = this.player.mesh.position;

        if (photoMode) {
            CAM.copy(origin).addScaledVector(FWD, 0.35);
            CAM.y = origin.y + 2.15;
            LOOK.copy(CAM).add(new THREE.Vector3(
                Math.sin(this.lookYaw) * Math.cos(this.lookPitch),
                Math.sin(this.lookPitch),
                Math.cos(this.lookYaw) * Math.cos(this.lookPitch)
            ));
        } else if (this.cameraMode === 2) {
            CAM.set(origin.x, origin.y + CAMERA.aerialHeight, origin.z + CAMERA.aerialDist * 0.2);
            LOOK.set(origin.x, origin.y + 1, origin.z);
        } else if (this.cameraMode === 1) {
            CAM.copy(origin).addScaledVector(FWD, -0.2);
            CAM.y = origin.y + CAMERA.hoodHeight;
            LOOK.copy(origin).addScaledVector(FWD, 12);
            LOOK.y = origin.y + 1.4;
        } else {
            CAM.copy(origin).addScaledVector(FWD, -CAMERA.chaseDist);
            CAM.y = origin.y + CAMERA.chaseHeight + Math.sin(this.lookPitch) * 2;
            LOOK.copy(origin);
            LOOK.y = origin.y + CAMERA.chaseLook;
        }

        this.camera.position.lerp(CAM, 1 - Math.exp(-6 * dt));
        this.camera.lookAt(LOOK);

        this.lights.dir.target.position.copy(origin);
        this.lights.dir.position.copy(origin).addScaledVector(this.skyUniforms.uSunDir.value, 90);
    }

    idleCamera(dt) {
        const t = this.time * 0.08;
        CAM.set(Math.cos(t) * 42, 14 + Math.sin(t * 0.6) * 3, 58 + Math.sin(t) * 18);
        LOOK.set(0, 1.5, 0);
        this.camera.position.lerp(CAM, 1 - Math.exp(-1.6 * dt));
        this.camera.lookAt(LOOK);
        this.camera.fov = damp(this.camera.fov, 52, 3, dt);
        this.camera.updateProjectionMatrix();
    }

    applySky() {
        const pal = sampleSkyPalette(this.state === 'play' ? this.hour : 0.22);
        applySkyPalette(this.skyUniforms, pal);
        this.scene.fog.color.copy(pal.fog);
        if (this.world.water?.material.uniforms.uFogColor) {
            this.world.water.material.uniforms.uFogColor.value.copy(pal.fog);
        }
        this.lights.dir.color.copy(pal.light);
        this.lights.dir.intensity = pal.lightIntensity;
        this.lights.hemi.color.copy(pal.horizon);
        this.lights.hemi.groundColor.copy(pal.ground);
        this.lights.amb.color.copy(pal.ambient);
        this.renderer.toneMappingExposure = 1.12 - this.hour * 0.22;
        if (this.bloom) this.bloom.strength = 0.22 + this.hour * 0.18;
    }
}

const game = new Game();
game.init().catch((err) => {
    console.error(err);
    game.hud.showError(err?.message || 'Falha ao iniciar o safari.');
});
