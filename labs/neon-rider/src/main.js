/**
 * Neon Rider — laço principal.
 * Avenida infinita à noite: a moto corre no −Z, quarteirões reciclam,
 * e cada fita VHS retuna o néon e a rádio.
 */

import * as THREE from 'three';

import {
    QUALITY, DIFFICULTY, STATIONS, loadSettings, saveSettings
} from './config.js';
import { clamp, damp, detectMobile, detectSoftwareGL } from './utils.js';
import { createSharedMaterials, tintMaterials } from './models.js';
import { City, createSky, createRoad } from './world.js';
import { Player } from './player.js';
import { Traffic } from './traffic.js';
import { Effects } from './effects.js';
import { GameAudio } from './audio.js';
import { Input } from './input.js';
import { Hud } from './hud.js';

const CAMERAS = [
    { name: 'perseguição', offset: new THREE.Vector3(0, 2.55, 7.4), look: new THREE.Vector3(0, 1.15, -12) },
    { name: 'capacete', offset: new THREE.Vector3(0, 1.48, 0.55), look: new THREE.Vector3(0, 1.22, -14) },
    { name: 'cinema', offset: new THREE.Vector3(3.4, 1.15, 5.1), look: new THREE.Vector3(-0.4, 0.95, -9) }
];

const LOOK = new THREE.Vector3();
const CAM = new THREE.Vector3();

class Game {
    constructor() {
        this.settings = loadSettings();
        this.state = 'boot';
        this.hud = new Hud();
        this.canvas = document.getElementById('scene');
        this.stationIndex = 0;
        this.tapes = 0;
        this.lives = 3;
        this.distance = 0;
        this.time = 0;
        this.cameraMode = 0;
        this.fpsAccum = 0;
        this.fpsFrames = 0;
        this.boostHeld = false;
        this.paletteMix = 1;
    }

    resolveQuality() {
        const choice = this.settings.quality;
        if (choice !== 'auto' && QUALITY[choice]) return QUALITY[choice];
        if (detectMobile() || detectSoftwareGL()) return QUALITY.low;
        const big = Math.min(window.innerWidth, window.innerHeight) >= 900;
        return big ? QUALITY.high : QUALITY.medium;
    }

    station() {
        return STATIONS[this.stationIndex % STATIONS.length];
    }

    async init() {
        this.hud.setLoading(0.08, 'Aquecendo o CRT…');
        if (document.fonts?.ready) await document.fonts.ready;
        this.quality = this.resolveQuality();

        try {
            this.renderer = new THREE.WebGLRenderer({
                canvas: this.canvas,
                antialias: this.quality.antialias,
                powerPreference: 'high-performance',
                stencil: false
            });
        } catch (err) {
            this.hud.showError('Não foi possível iniciar o WebGL neste navegador.');
            return;
        }

        const pr = Math.min(window.devicePixelRatio || 1, this.quality.pixelRatio);
        this.renderer.setPixelRatio(pr);
        this.renderer.setSize(window.innerWidth, window.innerHeight, false);
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.12;
        this.renderer.shadowMap.enabled = this.quality.shadows;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(
            58,
            window.innerWidth / window.innerHeight,
            0.2,
            this.quality.drawDistance * 1.6
        );

        const st = this.station();
        this.scene.fog = new THREE.FogExp2(st.fog, this.quality.fogDensity);
        this.scene.background = new THREE.Color(st.zenith);

        this.hud.setLoading(0.22, 'Pintando a madrugada…');
        try {
            this.sky = createSky();
            this.scene.add(this.sky.mesh);

        this.hemi = new THREE.HemisphereLight(st.horizon, st.ground, 0.55);
        this.scene.add(this.hemi);
        this.sun = new THREE.DirectionalLight(st.neonB, 0.55);
        this.sun.position.set(-8, 18, 10);
        this.sun.castShadow = this.quality.shadows;
        if (this.quality.shadows) {
            this.sun.shadow.mapSize.set(1024, 1024);
            this.sun.shadow.camera.near = 2;
            this.sun.shadow.camera.far = 80;
            this.sun.shadow.camera.left = -20;
            this.sun.shadow.camera.right = 20;
            this.sun.shadow.camera.top = 20;
            this.sun.shadow.camera.bottom = -20;
        }
        this.scene.add(this.sun, this.sun.target);

        this.mats = createSharedMaterials(st);

        this.hud.setLoading(0.4, 'Asfaltando a avenida…');
        this.road = createRoad(st);
        this.scene.add(this.road.group);

        this.hud.setLoading(0.55, 'Erguendo o distrito…');
        this.city = new City(this.scene, this.quality, this.mats);

        this.hud.setLoading(0.7, 'Montando a moto…');
        this.player = new Player(this.scene, this.mats);
        this.headlight = new THREE.SpotLight(0xfff2d8, 3.2, 48, 0.42, 0.45, 1.1);
        this.headlight.position.set(0, 1.1, 0);
        this.headlight.target.position.set(0, 0.4, -16);
        this.scene.add(this.headlight, this.headlight.target);

        this.traffic = new Traffic(this.scene, this.mats, this.quality);
        this.effects = new Effects(this.scene, this.quality);
        this.audio = new GameAudio();
        this.audio.enabled = !this.settings.muted;
        this.audio.volume = this.settings.volume / 100;
        this.input = new Input();

        this.applyStation(st, true);

        this.hud.setLoading(0.86, 'Ligando o bloom…');
        await this.setupPostProcessing();

        this.bindUi();
        this.isTouch = detectMobile();

        this.enterAttract();
        this.renderer.compile(this.scene, this.camera);
        this.render();

        this.hud.setLoading(1, 'INSERT COIN');
        setTimeout(() => this.hud.hideLoading(), 280);

        this.lastFrame = performance.now();
        this.renderer.setAnimationLoop((now) => this.frame(now));
        window.addEventListener('resize', () => this.resize());
            document.addEventListener('visibilitychange', () => {
                if (document.hidden && this.state === 'playing') this.pause();
            });
        } catch (err) {
            console.error(err);
            this.hud.showError(err?.message || 'Falha ao montar a avenida 3D.');
        }
    }

    async setupPostProcessing() {
        if (!this.quality.bloom) return;
        try {
            const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }] = await Promise.all([
                import('three/addons/postprocessing/EffectComposer.js'),
                import('three/addons/postprocessing/RenderPass.js'),
                import('three/addons/postprocessing/UnrealBloomPass.js'),
                import('three/addons/postprocessing/OutputPass.js')
            ]);
            const composer = new EffectComposer(this.renderer);
            composer.setPixelRatio(this.renderer.getPixelRatio());
            composer.setSize(window.innerWidth, window.innerHeight);
            composer.addPass(new RenderPass(this.scene, this.camera));
            const bloom = new UnrealBloomPass(
                new THREE.Vector2(window.innerWidth, window.innerHeight),
                0.42,
                0.55,
                0.42
            );
            composer.addPass(bloom);
            composer.addPass(new OutputPass());
            this.composer = composer;
            this.bloom = bloom;
        } catch (err) {
            this.composer = null;
        }
    }

    applyStation(st, instant = false) {
        this.targetStation = st;
        this.paletteMix = instant ? 1 : 0;
        if (instant) this.flushStation(st);
    }

    flushStation(st) {
        this.scene.fog.color.setHex(st.fog);
        this.scene.background.setHex(st.zenith);
        this.sky?.uniforms.uHorizon.value.setHex(st.horizon);
        this.sky?.uniforms.uZenith.value.setHex(st.zenith);
        this.sky?.uniforms.uGround.value.setHex(st.ground);
        this.road?.uniforms.uNeonA.value.setHex(st.neonA);
        this.road?.uniforms.uNeonB.value.setHex(st.neonB);
        this.road?.uniforms.uAsphalt.value.setHex(st.asphalt);
        if (this.hemi) {
            this.hemi.color.setHex(st.horizon);
            this.hemi.groundColor.setHex(st.ground);
        }
        if (this.sun) this.sun.color.setHex(st.neonB);
        if (this.mats) tintMaterials(this.mats, st);
        this.city?.setStation(st);
        if (this.player) {
            this.player.root.userData.glow.material.color.setHex(st.neonA);
            this.player.root.userData.paint.emissive.setHex(st.neonA);
            this.player.root.userData.paint.emissiveIntensity = 0.35;
        }
        this.audio?.setStation(this.stationIndex);
        document.documentElement.style.setProperty('--neon-a', '#' + st.neonA.toString(16).padStart(6, '0'));
        document.documentElement.style.setProperty('--neon-b', '#' + st.neonB.toString(16).padStart(6, '0'));
    }

    bindUi() {
        const hud = this.hud;
        hud.buildDifficulties(this.settings.difficulty, (id) => {
            this.settings.difficulty = id;
            saveSettings(this.settings);
        });
        hud.bindSettings({
            quality: this.settings.quality,
            volume: this.settings.volume,
            onQuality: (q) => {
                this.settings.quality = q;
                saveSettings(this.settings);
            },
            onVolume: (v) => {
                this.settings.volume = v;
                this.audio.setVolume(v / 100);
                saveSettings(this.settings);
            }
        });
        hud.setBest(this.settings.best);
        hud.setMuted(this.settings.muted);

        document.getElementById('startButton').addEventListener('click', () => this.start());
        document.getElementById('resumeButton').addEventListener('click', () => this.resume());
        document.getElementById('pauseMenuButton').addEventListener('click', () => this.enterAttract());
        document.getElementById('retryButton').addEventListener('click', () => this.start());
        document.getElementById('overMenuButton').addEventListener('click', () => this.enterAttract());
        hud.el.soundButton.addEventListener('click', () => this.toggleMute());
        hud.el.pauseButton.addEventListener('click', () => {
            if (this.state === 'playing') this.pause();
            else if (this.state === 'paused') this.resume();
        });

        this.input.on('pause', () => {
            if (this.state === 'playing') this.pause();
            else if (this.state === 'paused') this.resume();
        });
        this.input.on('mute', () => this.toggleMute());
        this.input.on('camera', () => {
            this.cameraMode = (this.cameraMode + 1) % CAMERAS.length;
            this.hud.message(CAMERAS[this.cameraMode].name, 900);
        });
        this.input.on('confirm', () => {
            if (this.state === 'menu') this.start();
            else if (this.state === 'over') this.start();
            else if (this.state === 'paused') this.resume();
        });
        this.input.on('radio', () => {
            if (this.state !== 'playing' && this.state !== 'menu') return;
            this.cycleStation();
        });

        this.bindTouch();
    }

    bindTouch() {
        const zone = document.getElementById('steerZone');
        const boost = document.getElementById('touchBoost');
        const brake = document.getElementById('touchBrake');
        if (!zone) return;

        const readSteer = (e) => {
            const t = e.touches?.[0] || e.changedTouches?.[0];
            if (!t) return;
            const r = zone.getBoundingClientRect();
            const x = ((t.clientX - r.left) / r.width) * 2 - 1;
            this.input.setTouchSteer(clamp(x * 1.4, -1, 1));
        };
        zone.addEventListener('touchstart', (e) => { e.preventDefault(); readSteer(e); }, { passive: false });
        zone.addEventListener('touchmove', (e) => { e.preventDefault(); readSteer(e); }, { passive: false });
        zone.addEventListener('touchend', () => this.input.setTouchSteer(0));

        const hold = (el, setter) => {
            el.addEventListener('touchstart', (e) => { e.preventDefault(); setter(true); }, { passive: false });
            el.addEventListener('touchend', () => setter(false));
            el.addEventListener('touchcancel', () => setter(false));
        };
        hold(boost, (v) => this.input.setTouchBoost(v));
        hold(brake, (v) => this.input.setTouchBrake(v));
    }

    toggleMute() {
        this.settings.muted = !this.settings.muted;
        this.audio.setEnabled(!this.settings.muted);
        this.hud.setMuted(this.settings.muted);
        saveSettings(this.settings);
        if (!this.settings.muted) this.audio.resume();
    }

    cycleStation() {
        this.stationIndex = (this.stationIndex + 1) % STATIONS.length;
        this.applyStation(this.station(), false);
        this.hud.message(this.station().name, 1200);
        this.audio.collect();
    }

    enterAttract() {
        this.state = 'menu';
        this.hud.setState('menu');
        this.hud.showMenu(true);
        this.hud.showPause(false);
        this.hud.showGameOver(false);
        this.hud.setTouchVisible(false);
        this.resetRun(true);
        this.player.auto = true;
    }

    start() {
        this.audio.resume();
        this.resetRun(false);
        this.state = 'playing';
        this.hud.setState('playing');
        this.hud.showMenu(false);
        this.hud.showGameOver(false);
        this.hud.showPause(false);
        this.hud.showHud(true);
        this.hud.setTouchVisible(this.isTouch);
        this.hud.message('NOITE AFORA', 1400);
    }

    resetRun(attract) {
        const diff = DIFFICULTY[this.settings.difficulty];
        this.lives = attract ? 99 : diff.lives;
        this.tapes = 0;
        this.distance = 0;
        this.time = 0;
        this.stationIndex = 0;
        this.applyStation(this.station(), true);
        this.player.reset({ maxSpeed: diff.maxSpeed });
        this.player.auto = attract;
        this.city.reset((Math.random() * 9999) | 0);
        this.traffic.setDifficulty(diff);
        this.traffic.reset(this.player.z);
        this.updateCamera(1, true);
    }

    pause() {
        if (this.state !== 'playing') return;
        this.state = 'paused';
        this.hud.setState('paused');
        this.hud.showPause(true);
    }

    resume() {
        if (this.state !== 'paused') return;
        this.state = 'playing';
        this.hud.setState('playing');
        this.hud.showPause(false);
        this.lastFrame = performance.now();
        this.audio.resume();
    }

    gameOver() {
        this.state = 'over';
        this.player.alive = false;
        const score = Math.floor(this.distance + this.tapes * 480);
        if (this.distance > (this.settings.best || 0)) {
            this.settings.best = Math.floor(this.distance);
            saveSettings(this.settings);
            this.hud.setBest(this.settings.best);
        }
        this.hud.setOverStats({
            distance: this.distance,
            tapes: this.tapes,
            time: this.time,
            score
        });
        this.hud.showGameOver(true);
        this.hud.showHud(false);
        this.hud.setTouchVisible(false);
        this.hud.setState('over');
    }

    frame(now) {
        const dt = clamp((now - this.lastFrame) / 1000, 0, 0.05);
        this.lastFrame = now;

        if (this.paletteMix < 1 && this.targetStation) {
            this.paletteMix = Math.min(1, this.paletteMix + dt * 2.4);
            this.flushStation(this.targetStation);
        }

        if (this.state === 'playing' || this.state === 'menu') this.simulate(dt);
        this.updateCamera(dt, false);
        this.render();

        this.fpsAccum += dt;
        this.fpsFrames += 1;
        if (this.fpsAccum >= 0.4) {
            this.hud.setFps(this.fpsFrames / this.fpsAccum);
            this.fpsAccum = 0;
            this.fpsFrames = 0;
        }
    }

    simulate(dt) {
        const playing = this.state === 'playing';
        this.input.sample();
        const auto = (!playing || this.player.auto) ? this.traffic.autoSteer(this.player) : 0;
        const input = playing
            ? this.input
            : { steer: auto, boost: false, brake: false };

        if (playing && this.input.boost && !this.boostHeld) this.audio.boostWhoosh();
        this.boostHeld = playing && this.input.boost;

        this.player.update(dt, input, 0);
        this.city.recycle(this.player.z);
        this.city.updateLights(this.player.z);
        this.traffic.update(dt, this.player);

        this.road.group.position.z = this.player.z - 80;
        this.road.uniforms.uZ.value = this.player.z;
        this.sky.mesh.position.set(this.player.x * 0.05, 0, this.player.z);
        this.sun.position.set(this.player.x - 8, 18, this.player.z + 10);
        this.sun.target.position.set(this.player.x, 0, this.player.z - 20);
        this.headlight.position.set(this.player.x, 1.15, this.player.z + 0.6);
        this.headlight.target.position.set(this.player.x, 0.3, this.player.z - 18);

        if (playing) {
            this.time += dt;
            this.distance += this.player.speed * dt * 2.4;

            const collected = this.traffic.collectTapes(this.player);
            if (collected.length) {
                this.tapes += collected.length;
                this.stationIndex = this.tapes % STATIONS.length;
                this.applyStation(this.station(), false);
                this.audio.collect();
                this.hud.message(this.station().name, 1100);
                for (const tape of collected) {
                    this.effects.spawn(tape.x, 1.2, tape.z, {
                        count: 22,
                        color: hexToArr(this.station().neonB),
                        speed: 8,
                        size: 0.8,
                        life: 0.55
                    });
                }
            }

            const crash = this.traffic.collideCars(this.player);
            if (crash && this.player.hit()) {
                this.lives -= 1;
                this.audio.crash();
                this.hud.flashGlitch();
                this.effects.spawn(this.player.x, 0.8, this.player.z, {
                    count: 40,
                    color: [1, 0.4, 0.2],
                    speed: 10,
                    size: 0.9,
                    life: 0.6
                });
                if (this.lives <= 0) this.gameOver();
                else this.hud.message('BATIDA', 700);
            }

            if (this.input.boost && this.player.boost > 0.05) {
                this.effects.trail(
                    this.player.x,
                    0.2,
                    this.player.z + 1.1,
                    hexToArr(this.station().neonA)
                );
            }

            this.hud.update({
                speed: this.player.speed,
                distance: this.distance,
                tapes: this.tapes,
                lives: this.lives,
                station: this.station(),
                boost: this.player.boost,
                time: this.time
            });
        }

        this.effects.update(dt);
        this.audio.update(dt, this.player.speed, this.input.boost && playing);
    }

    updateCamera(dt, instant) {
        const rig = CAMERAS[this.cameraMode];
        CAM.copy(rig.offset);
        CAM.x += this.player.x;
        CAM.z += this.player.z;
        LOOK.copy(rig.look);
        LOOK.x += this.player.x;
        LOOK.z += this.player.z;
        const k = instant ? 1 : 1 - Math.exp(-dt * (this.cameraMode === 1 ? 14 : 6));
        this.camera.position.lerp(CAM, k);
        if (!this._look) this._look = LOOK.clone();
        this._look.lerp(LOOK, k);
        this.camera.lookAt(this._look);
        this.camera.fov = damp(this.camera.fov, 56 + this.player.speed * 0.18, 4, dt);
        this.camera.updateProjectionMatrix();
    }

    render() {
        if (this.composer) this.composer.render();
        else this.renderer.render(this.scene, this.camera);
    }

    resize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h, false);
        this.composer?.setSize(w, h);
    }
}

function hexToArr(hex) {
    return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
}

const game = new Game();
game.init().catch((err) => {
    console.error(err);
    game.hud.showError(err?.message || 'Falha ao iniciar o Neon Rider.');
});
