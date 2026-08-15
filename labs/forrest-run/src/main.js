/**
 * Forrest Run — Laço Principal com Babylon.js.
 *
 * Gráficos Hyper Realistas com PBR, Iluminação Solar Direcional com Sombras PCF,
 * Pipeline de Pós-Processamento Cinemático (ACES Tone Mapping, Bloom, Vinheta, Aberração Cromática),
 * e transição contínua entre biomas da histórica travessia americana.
 */

import {
    QUALITY, DIFFICULTY, BIOMES, FOLLOWERS_AT, BIOME_METERS,
    loadSettings, saveSettings, biomeAt, biomeBlend
} from './config.js';
import { clamp, damp, detectMobile, detectSoftwareGL, hexToColor3, hexToColor4, mixHexColor3, lerp } from './utils.js';
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
    { name: 'perseguição', offset: new BABYLON.Vector3(0, 2.5, 7.8), look: new BABYLON.Vector3(0, 1.1, -12) },
    { name: 'cinema', offset: new BABYLON.Vector3(4.5, 1.6, 4.0), look: new BABYLON.Vector3(-0.6, 1.0, -9) },
    { name: 'ombro', offset: new BABYLON.Vector3(-1.6, 1.9, 4.2), look: new BABYLON.Vector3(0.3, 1.15, -14) }
];

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
        this.camPos = new BABYLON.Vector3(0, 2.5, 7.8);
        this.camLook = new BABYLON.Vector3(0, 1.1, -12);
    }

    resolveQuality() {
        const choice = this.settings.quality;
        if (choice !== 'auto' && QUALITY[choice]) return QUALITY[choice];
        if (detectMobile() || detectSoftwareGL()) return QUALITY.low;
        const big = Math.min(window.innerWidth, window.innerHeight) >= 880;
        return big ? QUALITY.high : QUALITY.medium;
    }

    async init() {
        this.hud.setLoading(0.08, 'Amarrando os tênis…');
        if (document.fonts?.ready) await document.fonts.ready;
        this.quality = this.resolveQuality();

        try {
            this.engine = new BABYLON.Engine(this.canvas, this.quality.antialias, {
                preserveDrawingBuffer: false,
                stencil: false,
                powerPreference: 'high-performance',
                adaptToDeviceRatio: true
            });
            const pr = Math.min(window.devicePixelRatio || 1, this.quality.pixelRatio);
            this.engine.setHardwareScalingLevel(1 / pr);
        } catch (err) {
            this.hud.showError('Não foi possível iniciar o WebGL/Babylon.js neste navegador.');
            return;
        }

        this.scene = new BABYLON.Scene(this.engine);
        const start = BIOMES[0];

        // 1. Atmosfera e Névoa
        this.scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
        this.scene.fogDensity = this.quality.fogDensity;
        this.scene.fogColor = hexToColor3(start.fog);
        this.scene.clearColor = hexToColor4(start.zenith, 1.0);

        // 2. Câmera
        this.camera = new BABYLON.UniversalCamera(
            'camera',
            new BABYLON.Vector3(0, 2.5, 7.8),
            this.scene
        );
        this.camera.fov = 0.88; // ~50 graus
        this.camera.minZ = 0.2;
        this.camera.maxZ = this.quality.drawDistance * 1.5;
        this.camera.setTarget(new BABYLON.Vector3(0, 1.1, -12));

        // 3. Iluminação PBR Solar e Ambiente
        this.hud.setLoading(0.22, 'Abrindo o céu do Alabama…');
        this.hemi = new BABYLON.HemisphericLight('hemiLight', new BABYLON.Vector3(0, 1, 0), this.scene);
        this.hemi.diffuse = hexToColor3(start.hemiSky);
        this.hemi.groundColor = hexToColor3(start.hemiGround);
        this.hemi.intensity = start.hemiIntensity;

        this.sun = new BABYLON.DirectionalLight('sunLight', new BABYLON.Vector3(0.4, -0.75, 0.45), this.scene);
        this.sun.position = new BABYLON.Vector3(-18, 28, 12);
        this.sun.diffuse = hexToColor3(start.sun);
        this.sun.intensity = start.sunIntensity;

        if (this.quality.shadows) {
            this.shadowGenerator = new BABYLON.ShadowGenerator(this.quality.shadowMapSize || 1024, this.sun);
            this.shadowGenerator.useBlurExponentialShadowMap = true;
            this.shadowGenerator.blurKernel = 32;
            this.shadowGenerator.bias = 0.0005;
        } else {
            this.shadowGenerator = null;
        }

        // 4. Pipeline de Pós-Processamento Cinemático
        if (this.quality.bloom) {
            this.pipeline = new BABYLON.DefaultRenderingPipeline('pipeline', true, this.scene, [this.camera]);
            this.pipeline.bloomEnabled = true;
            this.pipeline.bloomThreshold = 0.72;
            this.pipeline.bloomWeight = start.bloomWeight;
            this.pipeline.bloomKernel = 48;

            this.pipeline.chromaticAberrationEnabled = true;
            this.pipeline.chromaticAberration.aberrationAmount = 10;

            this.pipeline.grainEnabled = true;
            this.pipeline.grain.intensity = 5;

            this.pipeline.imageProcessing.toneMappingEnabled = true;
            this.pipeline.imageProcessing.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
            this.pipeline.imageProcessing.vignetteEnabled = true;
            this.pipeline.imageProcessing.vignetteWeight = 1.1;
            this.pipeline.imageProcessing.exposure = 1.08;
        }

        // 5. Mundo, Céu e Estrada PBR
        this.hud.setLoading(0.38, 'Plantando as nogueiras de Greenbow…');
        this.sky = createSky(this.scene);
        this.clouds = createClouds(this.scene);
        this.road = createRoad(this.scene, this.shadowGenerator);
        this.land = new America(this.scene, this.shadowGenerator, this.quality);

        // 6. Personagem, Pista, Seguidores e Áudio
        this.hud.setLoading(0.65, 'O Forrest está amarrando os tênis…');
        this.player = new Player(this.scene, this.shadowGenerator);
        this.track = new Track(this.scene, this.shadowGenerator, this.quality);
        this.pack = new Pack(this.scene, this.shadowGenerator, this.quality.followers);
        this.effects = new Effects(this.scene, this.quality);
        this.audio = new GameAudio();
        this.audio.enabled = !this.settings.muted;
        this.audio.volume = this.settings.volume / 100;
        this.input = new Input();

        // Pena de destaque para o menu
        this.heroFeather = createFeatherMesh(this.scene);
        this.heroFeather.scaling.setAll(2.0);

        this.flushBiome(start, 0);
        this.bindUi();
        this.isTouch = detectMobile();

        this.enterAttract();
        this.hud.setLoading(1, 'Eu só senti vontade de correr.');
        setTimeout(() => this.hud.hideLoading(), 340);

        // Loop de Renderização
        this.lastFrame = performance.now();
        this.engine.runRenderLoop(() => {
            const now = performance.now();
            const dt = clamp((now - this.lastFrame) / 1000, 0, 0.05);
            this.lastFrame = now;

            if (this.state === 'playing' || this.state === 'menu') {
                this.simulate(dt);
            }
            this.updateCamera(dt, false);
            this.scene.render();

            this.fpsAccum += dt;
            this.fpsFrames += 1;
            if (this.fpsAccum >= 0.4) {
                this.hud.setFps(this.fpsFrames / this.fpsAccum);
                this.fpsAccum = 0;
                this.fpsFrames = 0;
            }
        });

        window.addEventListener('resize', () => this.engine.resize());
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state === 'playing') this.pause();
        });
    }

    flushBiome(biome, k) {
        const dist = this.player ? this.player.distance : 0;
        const next = biomeAt(dist + BIOME_METERS);

        const fogCol = mixHexColor3(biome.fog, next.fog, k);
        const zenithCol = mixHexColor3(biome.zenith, next.zenith, k);
        const groundCol = mixHexColor3(biome.ground, next.ground, k);
        const sunCol = mixHexColor3(biome.sun, next.sun, k);
        const hemiSkyCol = mixHexColor3(biome.hemiSky, next.hemiSky, k);
        const hemiGndCol = mixHexColor3(biome.hemiGround, next.hemiGround, k);

        this.scene.fogColor = fogCol;
        this.scene.clearColor = new BABYLON.Color4(zenithCol.r, zenithCol.g, zenithCol.b, 1.0);
        this.sky.material.emissiveColor = zenithCol;
        this.hemi.diffuse = hemiSkyCol;
        this.hemi.groundColor = hemiGndCol;
        this.sun.diffuse = sunCol;

        const sunInt = lerp(biome.sunIntensity, next.sunIntensity, k);
        this.sun.intensity = sunInt;

        if (this.pipeline && this.pipeline.bloomEnabled) {
            this.pipeline.bloomWeight = lerp(biome.bloomWeight, next.bloomWeight, k);
        }

        // Estrada PBR (Rugosidade e Brilho de chuva)
        const isRain = biome.rain || (next.rain && k > 0.4);
        const wetR = lerp(biome.wetRoughness, next.wetRoughness, k);
        this.road.roadMat.roughness = wetR;
        this.road.grassMat.albedoColor = groundCol;

        this.effects.setRain(isRain);
        this.audio.setRain(isRain);

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
            this.hud.message(`Câmera: ${CAMERAS[this.cameraMode].name}`, 900);
        });
        this.input.on('confirm', () => {
            if (this.state === 'menu' || this.state === 'over') this.start();
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
        jump.addEventListener('mousedown', (e) => { e.preventDefault(); this.input.tapJump(); });
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
        this.hud.message('CORRE, FORREST', 1700);
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
        const score = Math.floor(this.player.distance + this.feathers * 240);
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

    simulate(dt) {
        const playing = this.state === 'playing';
        const input = this.input.sample();
        this.player.update(dt, input, playing);

        const { cur, k } = biomeBlend(this.player.distance);
        this.flushBiome(cur, k);
        this.land.recycle(this.player.z, cur.id);
        this.track.update(dt, this.player);
        this.pack.update(dt, this.player, this.player.distance);

        // Reposicionar nós que seguem o corredor
        this.road.root.position.z = this.player.z - 90;
        this.sky.mesh.position.set(this.player.x * 0.05, 0, this.player.z);
        this.clouds.root.position.set(0, 0, this.player.z);
        this.sun.position.set(this.player.x - 18, 28, this.player.z + 12);

        // Pena Flutuante do Menu / Hero
        if (this.heroFeather) {
            const t = (this.time || 0) + (this.player?.cycle || 0) * 0.1;
            this.heroFeather.position.set(
                this.player.x + Math.sin(t * 0.45) * 1.5,
                1.7 + Math.sin(t * 0.75) * 0.35,
                this.player.z - 2.5 + Math.cos(t * 0.55) * 0.9
            );
            this.heroFeather.rotation.set(0.4, t * 1.2, 0.3);
            this.heroFeather.setEnabled(this.state === 'menu' || this.state === 'over');
        }

        if (playing) {
            this.time += dt;
            if (this.player._didJump) this.audio.jump();

            if (cur.id !== this.lastBiome) {
                this.lastBiome = cur.id;
                this.hud.message(cur.name, 1700);
                this.hud.quote(cur.quote);
            }

            if (!this.packAnnounced && this.player.distance >= FOLLOWERS_AT) {
                this.packAnnounced = true;
                this.hud.message('O pessoal veio atrás', 1900);
                this.hud.quote('De Alabama até o mar, e de volta. Aí começaram a me seguir.');
            }

            // Coleta de penas
            const got = this.track.collect(this.player);
            if (got.length) {
                this.feathers += got.length;
                this.audio.collect();
                for (const f of got) {
                    this.effects.spawn(f.mesh.position.x, 1.2, f.z, {
                        count: 20,
                        color: [1, 0.98, 0.85, 1],
                        speed: 4.5,
                        size: 0.45,
                        life: 0.6
                    });
                }
            }

            // Colisões com obstáculos
            const hit = this.track.collide(this.player);
            if (hit && this.player.hit()) {
                this.lives -= 1;
                this.audio.stumble();
                this.effects.spawn(this.player.x, 0.7, this.player.z, {
                    count: 24,
                    color: [0.9, 0.65, 0.35, 1],
                    speed: 6.0,
                    size: 0.5,
                    life: 0.5
                });
                if (this.lives <= 0) {
                    this.gameOver();
                } else {
                    this.hud.message('Tropeço', 700);
                }
            }

            // Poeira de passos
            if (this.player.grounded && this.player.speed > 8 && Math.sin(this.player.cycle) > 0.92) {
                this.effects.dust(this.player.x, 0.08, this.player.z + 0.4, cur.dirt);
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
        this.audio.update(dt, this.player.speed, this.player.grounded && playing, cur.dirt);
    }

    updateCamera(dt, instant) {
        const rig = CAMERAS[this.cameraMode];

        const targetPos = new BABYLON.Vector3(
            this.player.x + rig.offset.x,
            this.player.y + rig.offset.y,
            this.player.z + rig.offset.z
        );

        const targetLook = new BABYLON.Vector3(
            this.player.x + rig.look.x,
            this.player.y + rig.look.y,
            this.player.z + rig.look.z
        );

        const k = instant ? 1.0 : 1.0 - Math.exp(-dt * (this.cameraMode === 2 ? 12 : 6.5));

        this.camPos = BABYLON.Vector3.Lerp(this.camPos, targetPos, k);
        this.camLook = BABYLON.Vector3.Lerp(this.camLook, targetLook, k);

        this.camera.position.copyFrom(this.camPos);
        this.camera.setTarget(this.camLook);

        // Dilatação de FOV sutil com a velocidade para sensação de ritmo
        const targetFov = 0.88 + (this.player.speed / 30) * 0.08;
        this.camera.fov = damp(this.camera.fov, targetFov, 4.0, dt);
    }
}

const game = new Game();
game.init().catch((err) => {
    console.error(err);
    game.hud.showError(err?.message || 'Falha ao iniciar o Forrest Run em Babylon.js.');
});
