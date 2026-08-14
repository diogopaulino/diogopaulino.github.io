/**
 * Forrest Run — laço principal.
 * Forrest corre no −Z e nunca para: o mundo recicla à frente,
 * os biomas mudam com a milhagem e o pessoal se junta depois de 1400 m.
 */

import * as THREE from 'three';

import {
    QUALITY, DIFFICULTY, BIOMES, FOLLOWERS_AT, BIOME_METERS,
    loadSettings, saveSettings, biomeAt, biomeBlend
} from './config.js';
import { clamp, damp, detectMobile, detectSoftwareGL, hexToArr, lerp } from './utils.js';
import { createSky, createClouds, createRoad, America } from './world.js';
import { Player } from './player.js';
import { Track } from './obstacles.js';
import { Pack } from './followers.js';
import { Effects } from './effects.js';
import { GameAudio } from './audio.js';
import { Input } from './input.js';
import { Hud } from './hud.js';
import { createFeatherMesh } from './models.js';

const CAMERAS = [
    { name: 'perseguição', offset: new THREE.Vector3(0, 2.35, 7.2), look: new THREE.Vector3(0, 1.05, -10) },
    { name: 'cinema', offset: new THREE.Vector3(4.2, 1.35, 3.4), look: new THREE.Vector3(-0.6, 0.95, -8) },
    { name: 'ombro', offset: new THREE.Vector3(-1.4, 1.85, 3.8), look: new THREE.Vector3(0.3, 1.1, -12) }
];

const LOOK = new THREE.Vector3();
const CAM = new THREE.Vector3();
const COL_A = new THREE.Color();
const COL_B = new THREE.Color();

function mixHex(a, b, k) {
    COL_A.setHex(a);
    COL_B.setHex(b);
    COL_A.lerp(COL_B, k);
    return COL_A;
}

class Game {
    constructor() {
        this.settings = loadSettings();
        this.state = 'boot';
        this.hud = new Hud();
        this.canvas = document.getElementById('scene');
        this.feathers = 0;
        this.lives = 3;
        this.time = 0;
        this.cameraMode = 0;
        this.fpsAccum = 0;
        this.fpsFrames = 0;
        this.lastBiome = '';
        this.packAnnounced = false;
        this.heroFeather = null;
    }

    resolveQuality() {
        const choice = this.settings.quality;
        if (choice !== 'auto' && QUALITY[choice]) return QUALITY[choice];
        if (detectMobile() || detectSoftwareGL()) return QUALITY.low;
        const big = Math.min(window.innerWidth, window.innerHeight) >= 900;
        return big ? QUALITY.high : QUALITY.medium;
    }

    async init() {
        this.hud.setLoading(0.08, 'Amarrando os tênis…');
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
        this.renderer.toneMappingExposure = 1.05;
        this.renderer.shadowMap.enabled = this.quality.shadows;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(
            52,
            window.innerWidth / window.innerHeight,
            0.2,
            this.quality.drawDistance * 1.5
        );

        const start = BIOMES[0];
        this.scene.fog = new THREE.FogExp2(start.fog, this.quality.fogDensity);
        this.scene.background = new THREE.Color(start.zenith);

        this.hud.setLoading(0.22, 'Abrindo o céu do Alabama…');
        try {
            this.sky = createSky();
            this.scene.add(this.sky.mesh);
            this.clouds = createClouds();
            this.scene.add(this.clouds.group);

            this.hemi = new THREE.HemisphereLight(start.hemiSky, start.hemiGround, 0.85);
            this.scene.add(this.hemi);
            this.sun = new THREE.DirectionalLight(start.sun, 1.35);
            this.sun.position.set(-18, 28, 12);
            this.sun.castShadow = this.quality.shadows;
            if (this.quality.shadows) {
                this.sun.shadow.mapSize.set(1024, 1024);
                this.sun.shadow.camera.near = 2;
                this.sun.shadow.camera.far = 90;
                this.sun.shadow.camera.left = -24;
                this.sun.shadow.camera.right = 24;
                this.sun.shadow.camera.top = 24;
                this.sun.shadow.camera.bottom = -24;
            }
            this.scene.add(this.sun, this.sun.target);

            this.hud.setLoading(0.4, 'Abrindo a estrada de terra…');
            this.road = createRoad();
            this.road.uniforms.uFogDensity.value = this.quality.fogDensity;
            this.scene.add(this.road.group);

            this.hud.setLoading(0.55, 'Plantando os nogueiras…');
            this.land = new America(this.scene, this.quality);

            this.hud.setLoading(0.7, 'O Forrest está se levantando…');
            this.player = new Player(this.scene);
            this.track = new Track(this.scene, this.quality);
            this.pack = new Pack(this.scene, this.quality.followers);
            this.effects = new Effects(this.scene, this.quality);
            this.audio = new GameAudio();
            this.audio.enabled = !this.settings.muted;
            this.audio.volume = this.settings.volume / 100;
            this.input = new Input();

            this.heroFeather = createFeatherMesh();
            this.heroFeather.scale.setScalar(1.8);
            this.scene.add(this.heroFeather);

            this.flushBiome(start, 0);
            this.bindUi();
            this.isTouch = detectMobile();

            this.enterAttract();
            this.renderer.compile(this.scene, this.camera);
            this.render();

            this.hud.setLoading(1, 'Eu só senti vontade de correr.');
            setTimeout(() => this.hud.hideLoading(), 320);

            this.lastFrame = performance.now();
            this.renderer.setAnimationLoop((now) => this.frame(now));
            window.addEventListener('resize', () => this.resize());
            document.addEventListener('visibilitychange', () => {
                if (document.hidden && this.state === 'playing') this.pause();
            });
        } catch (err) {
            console.error(err);
            this.hud.showError(err?.message || 'Falha ao montar a estrada 3D.');
        }
    }

    flushBiome(biome, k) {
        const dist = this.player ? this.player.distance : 0;
        const next = biomeAt(dist + BIOME_METERS);
        const mix = (a, b) => mixHex(a, b, k);
        const fog = mix(biome.fog, next.fog);
        this.scene.fog.color.copy(fog);
        this.scene.background.copy(mix(biome.zenith, next.zenith));
        this.sky.uniforms.uHorizon.value.copy(mix(biome.horizon, next.horizon));
        this.sky.uniforms.uZenith.value.copy(mix(biome.zenith, next.zenith));
        this.sky.uniforms.uGround.value.copy(mix(biome.ground, next.ground));
        this.sky.uniforms.uSun.value.copy(mix(biome.sun, next.sun));
        this.hemi.color.copy(mix(biome.hemiSky, next.hemiSky));
        this.hemi.groundColor.copy(mix(biome.hemiGround, next.hemiGround));
        this.sun.color.copy(mix(biome.sun, next.sun));
        this.road.uniforms.uRoad.value.copy(mix(biome.road, next.road));
        this.road.uniforms.uShoulder.value.copy(mix(biome.shoulder, next.shoulder));
        this.road.uniforms.uFogColor.value.copy(fog);
        this.road.uniforms.uDirt.value = lerp(biome.dirt ? 1 : 0, next.dirt ? 1 : 0, k);
        this.road.grassMat.color.copy(mix(biome.ground, next.ground));
        this.effects.setRain(biome.rain || (next.rain && k > 0.4));
        this.audio.setRain(biome.rain || (next.rain && k > 0.4));
        document.documentElement.style.setProperty('--amber', '#' + biome.horizon.toString(16).padStart(6, '0'));
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

        this.bindTouch();
    }

    bindTouch() {
        const left = document.getElementById('touchLeft');
        const right = document.getElementById('touchRight');
        const jump = document.getElementById('touchJump');
        if (!left) return;
        const tap = (el, fn) => {
            el.addEventListener('touchstart', (e) => { e.preventDefault(); fn(); }, { passive: false });
            el.addEventListener('mousedown', (e) => { e.preventDefault(); fn(); });
        };
        tap(left, () => this.input.tapLane(-1));
        tap(right, () => this.input.tapLane(1));
        jump.addEventListener('touchstart', (e) => { e.preventDefault(); this.input.tapJump(); }, { passive: false });
        jump.addEventListener('touchend', () => this.input.releaseJump());
        jump.addEventListener('mousedown', (e) => { e.preventDefault(); this.input.tapJump(); });
        jump.addEventListener('mouseup', () => this.input.releaseJump());
    }

    toggleMute() {
        this.settings.muted = !this.settings.muted;
        this.audio.setEnabled(!this.settings.muted);
        this.hud.setMuted(this.settings.muted);
        saveSettings(this.settings);
        if (!this.settings.muted) this.audio.resume();
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
        this.hud.message('CORRE, FORREST', 1600);
        this.hud.quote(BIOMES[0].quote);
    }

    resetRun(attract) {
        const diff = DIFFICULTY[this.settings.difficulty];
        this.lives = attract ? 99 : diff.lives;
        this.feathers = 0;
        this.time = 0;
        this.lastBiome = 'greenbow';
        this.packAnnounced = false;
        this.player.reset({ vMax: diff.vMax });
        this.player.auto = attract;
        this.land.reset((Math.random() * 9999) | 0);
        this.track.setDifficulty(diff);
        this.track.reset(this.player.z);
        this.pack.reset();
        this.flushBiome(BIOMES[0], 0);
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
        this.player.sitDown();
        const score = Math.floor(this.player.distance + this.feathers * 220);
        if (this.player.distance > (this.settings.best || 0)) {
            this.settings.best = Math.floor(this.player.distance);
            saveSettings(this.settings);
            this.hud.setBest(this.settings.best);
        }
        this.hud.setOverStats({
            distance: this.player.distance,
            feathers: this.feathers,
            time: this.time,
            score
        });
        this.hud.showGameOver(true);
        this.hud.showHud(false);
        this.hud.setTouchVisible(false);
        this.hud.setState('over');
        this.hud.quote('Estou bastante cansado. Acho que vou pra casa agora.');
    }

    frame(now) {
        const dt = clamp((now - this.lastFrame) / 1000, 0, 0.05);
        this.lastFrame = now;
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
        const input = this.input.sample();
        this.player.update(dt, input, playing);

        const { cur, k } = biomeBlend(this.player.distance);
        this.flushBiome(cur, k);
        this.land.recycle(this.player.z, cur.id);
        this.track.update(dt, this.player);
        this.pack.update(dt, this.player, this.player.distance);

        this.road.group.position.z = this.player.z - 90;
        this.road.uniforms.uZ.value = this.player.z;
        this.sky.mesh.position.set(this.player.x * 0.04, 0, this.player.z);
        this.clouds.group.position.set(0, 0, this.player.z);
        this.sun.position.set(this.player.x - 18, 28, this.player.z + 12);
        this.sun.target.position.set(this.player.x, 0, this.player.z - 20);

        if (this.heroFeather) {
            const t = nowSec(this);
            this.heroFeather.position.set(
                this.player.x + Math.sin(t * 0.4) * 1.4,
                1.6 + Math.sin(t * 0.7) * 0.35,
                this.player.z - 2.2 + Math.cos(t * 0.5) * 0.8
            );
            this.heroFeather.rotation.set(0.5, t, 0.4);
            this.heroFeather.visible = this.state === 'menu' || this.state === 'over';
        }

        if (playing) {
            this.time += dt;
            if (this.player._didJump) this.audio.jump();

            if (cur.id !== this.lastBiome) {
                this.lastBiome = cur.id;
                this.hud.message(cur.name, 1600);
                this.hud.quote(cur.quote);
            }
            if (!this.packAnnounced && this.player.distance >= FOLLOWERS_AT) {
                this.packAnnounced = true;
                this.hud.message('O pessoal veio atrás', 1800);
                this.hud.quote('De Alabama até o mar, e de volta. Aí começaram a me seguir.');
            }

            const got = this.track.collect(this.player);
            if (got.length) {
                this.feathers += got.length;
                this.audio.collect();
                for (const f of got) {
                    this.effects.spawn(f.mesh.position.x, 1.2, f.z, {
                        count: 18,
                        color: [1, 1, 0.92],
                        speed: 4,
                        size: 0.7,
                        life: 0.55
                    });
                }
            }

            const hit = this.track.collide(this.player);
            if (hit && this.player.hit()) {
                this.lives -= 1;
                this.audio.stumble();
                this.effects.spawn(this.player.x, 0.6, this.player.z, {
                    count: 22,
                    color: hexToArr(cur.horizon),
                    speed: 6,
                    size: 0.7,
                    life: 0.45
                });
                if (this.lives <= 0) this.gameOver();
                else this.hud.message('Tropeço', 700);
            }

            if (this.player.grounded && this.player.speed > 8 && Math.sin(this.player.cycle) > 0.92) {
                this.effects.dust(this.player.x, 0.08, this.player.z + 0.4);
            }

            this.hud.update({
                speed: this.player.speed,
                distance: this.player.distance,
                feathers: this.feathers,
                lives: this.lives,
                biome: cur,
                time: this.time
            });
        }

        this.effects.update(dt, this.player);
        this.audio.update(dt, this.player.speed, this.player.grounded && playing);
    }

    updateCamera(dt, instant) {
        const rig = CAMERAS[this.cameraMode];
        CAM.copy(rig.offset);
        CAM.x += this.player.x;
        CAM.z += this.player.z;
        LOOK.copy(rig.look);
        LOOK.x += this.player.x;
        LOOK.z += this.player.z;
        const k = instant ? 1 : 1 - Math.exp(-dt * (this.cameraMode === 2 ? 10 : 5.5));
        this.camera.position.lerp(CAM, k);
        if (!this._look) this._look = LOOK.clone();
        this._look.lerp(LOOK, k);
        this.camera.lookAt(this._look);
        this.camera.fov = damp(this.camera.fov, 50 + this.player.speed * 0.22, 3.5, dt);
        this.camera.updateProjectionMatrix();
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }

    resize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h, false);
    }
}

function nowSec(game) {
    return (game.time || 0) + (game.player?.cycle || 0) * 0.1;
}

const game = new Game();
game.init().catch((err) => {
    console.error(err);
    game.hud.showError(err?.message || 'Falha ao iniciar o Forrest Run.');
});
