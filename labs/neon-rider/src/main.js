/**
 * Neon Rider — laço principal.
 * Avenida infinita à noite: a moto corre no −Z, quarteirões reciclam,
 * e cada fita VHS retuna o néon e a rádio.
 *
 * REGRAS
 *   • Escala real: 1 unidade = 1 m; velocidades em m/s (HUD em km/h = m/s · 3,6).
 *   • Simulação em passo fixo de 1/120 s com acumulador; o quadro desenha a pose interpolada
 *     (alpha = resto/h). Quadro mais longo que 1/20 s é cortado (aba travada não vira teletransporte).
 *   • Largada parada com contagem 3-2-1: segure ↑ para subir o giro; no "VAI" a embreagem solta.
 *   • Chegada a `goal` metros (config.js#DIFFICULTY) = vitória; recorde de tempo por dificuldade.
 *   • Batida (frente da moto na traseira de um carro, vão lateral > 0,35 m e Δv > 3 m/s):
 *     −1 crédito, a moto cai para ≤ 70 % da velocidade do carro e fica 2,2 s invulnerável.
 *     Raspão (toque de lado ou Δv pequeno, ou carro encostando por trás): empurra, −12 % de
 *     velocidade, sem custo. Sem créditos = fim de jogo.
 *   • Placar = metros + 300 · fitas + 150 · ultrapassagens "por um triz" (config.js#SCORE).
 *     Fita também recarrega 25 % do nitro; "por um triz" recarrega 8 %.
 */

import * as THREE from 'three';
import { configureCinematicRenderer, applyCinematicEnvironment } from '../../shared/cinematic.js?v=2';

import {
    QUALITY, DIFFICULTY, STATIONS, BIKE, SCORE, loadSettings, saveSettings
} from './config.js?v=17';
import { clamp, damp, detectMobile, detectSoftwareGL } from './utils.js?v=17';
import { KMH, BIKES } from './physics.js?v=17';
import { createSharedMaterials, tintMaterials } from './models.js?v=17';
import { City, createSky, createRoad } from './world.js?v=17';
import { Player } from './player.js?v=17';
import { Traffic } from './traffic.js?v=17';
import { Effects } from './effects.js?v=17';
import { GameAudio } from './audio.js?v=17';
import { Input } from './input.js?v=17';
import { Hud } from './hud.js?v=17';

/** Passo fixo da física (s) e maior quadro aceito (s). */
const H = 1 / 120;
const MAX_FRAME = 1 / 20;
const COUNTDOWN = 2.4;

/**
 * Câmeras. offset/look relativos à moto (m). `roll` = fração da inclinação da moto que a câmera
 * acompanha (on-board de MotoGP inclina o horizonte; a perseguição quase não).
 */
const CAMERAS = [
    { name: 'perseguição', offset: new THREE.Vector3(0, 2.4, 6.6), look: new THREE.Vector3(0, 1.15, -12), roll: 0.16, follow: 7 },
    { name: 'capacete', offset: new THREE.Vector3(0, 1.42, 0.45), look: new THREE.Vector3(0, 1.2, -14), roll: 0.65, follow: 30 },
    { name: 'cinema', offset: new THREE.Vector3(3.2, 1.1, 4.8), look: new THREE.Vector3(-0.4, 0.95, -9), roll: 0.08, follow: 5 }
];

const LOOK = new THREE.Vector3();
const CAM = new THREE.Vector3();
const SPARK = [1, 0.62, 0.25];
const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)');

/** Pórtico de chegada: dois pilares, travessa e faixa quadriculada no asfalto (5 draw calls). */
function createFinishGate() {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 32;
    const g = c.getContext('2d');
    for (let x = 0; x < 16; x++) for (let y = 0; y < 2; y++) {
        g.fillStyle = (x + y) % 2 ? '#0b0614' : '#f4f0ff';
        g.fillRect(x * 16, y * 16, 16, 16);
    }
    const checker = new THREE.CanvasTexture(c);
    checker.colorSpace = THREE.SRGBColorSpace;
    const group = new THREE.Group();
    const glowA = new THREE.MeshBasicMaterial({ color: 0xff2bd6, toneMapped: false, fog: false });
    const glowB = new THREE.MeshBasicMaterial({ color: 0x00f0ff, toneMapped: false, fog: false });
    const pillar = new THREE.BoxGeometry(0.7, 7.4, 0.7);
    const left = new THREE.Mesh(pillar, glowA);
    left.position.set(-8.4, 3.7, 0);
    const right = new THREE.Mesh(pillar, glowA);
    right.position.set(8.4, 3.7, 0);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(17.5, 0.5, 0.5), glowB);
    bar.position.set(0, 7.4, 0);
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(16, 1.6), new THREE.MeshBasicMaterial({ map: checker, toneMapped: false, fog: false, side: THREE.DoubleSide }));
    banner.position.set(0, 6.3, 0);
    const lineTex = checker.clone();
    lineTex.needsUpdate = true;
    const line = new THREE.Mesh(new THREE.PlaneGeometry(14.8, 2), new THREE.MeshBasicMaterial({ map: lineTex, toneMapped: false }));
    line.rotation.x = -Math.PI / 2;
    line.position.set(0, 0.03, 0);
    group.add(left, right, bar, banner, line);
    group.visible = false;
    group.userData = { glowA, glowB };
    return group;
}

/** Promessa com prazo: carregamento nunca fica infinito. */
function withTimeout(promise, ms, fallback) {
    return Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(fallback), ms))]);
}

class Game {
    constructor() {
        this.settings = loadSettings();
        this.state = 'boot';
        this.hud = new Hud();
        this.canvas = document.getElementById('scene');
        this.stationIndex = 0;
        this.tapes = 0;
        this.nearMisses = 0;
        this.lives = 3;
        this.distance = 0;
        this.time = 0;
        this.topSpeed = 0;
        this.cameraMode = this.settings.camera;
        this.fpsAccum = 0;
        this.fpsFrames = 0;
        this.nitroHeld = false;
        // cores da estação como [r, g, b] 0..1 para as partículas (atualizadas na troca de estação)
        this.colA = [1, 0.17, 0.84];
        this.colB = [0, 0.94, 1];
        this.goal = 3000;
        this.acc = 0;
        this.countdown = 0;
        this.shake = 0;
        this.scrapeCooldown = 0;
        this.camRoll = 0;
        this.camPull = 0;
        // objetos reaproveitados (nada de alocação por quadro)
        this.ctrl = { throttle: 0, brake: 0, steer: 0, nitro: false };
        this.auto = { steer: 0, brake: 0 };
        this.collected = [];
        this.hudState = {
            speed: 0, gear: 1, rpm: 0, redline: 1, limiter: 1, lean: 0, grip: 0, nitro: 1, nitroOn: false,
            distance: 0, tapes: 0, lives: 0, station: null, time: 0, goal: 1, shiftLight: false
        };
        this.engineState = { rpm: 0, redline: 1, throttle: 0, speed: 0, nitro: false, shifted: 0 };
    }

    resolveQuality() {
        // SoftGL/SwiftShader derrete com high — sempre capar, mesmo se o usuário
        // salvou “high” numa sessão anterior com GPU real.
        if (detectSoftwareGL()) return QUALITY.low;
        const choice = this.settings.quality;
        if (choice !== 'auto' && QUALITY[choice]) return QUALITY[choice];
        if (detectMobile()) return QUALITY.low;
        const big = Math.min(window.innerWidth, window.innerHeight) >= 900;
        return big ? QUALITY.high : QUALITY.medium;
    }

    station() {
        return STATIONS[this.stationIndex % STATIONS.length];
    }

    async init() {
        this.hud.setLoading(0.08, 'Aquecendo o CRT…');
        if (document.fonts?.ready) await withTimeout(document.fonts.ready, 2500, null);
        this.quality = this.resolveQuality();

        try {
            this.renderer = new THREE.WebGLRenderer({
                canvas: this.canvas,
                antialias: this.quality.antialias,
                powerPreference: detectSoftwareGL() ? 'low-power' : 'high-performance',
                stencil: false
            });
        } catch (err) {
            this.hud.showError('Não foi possível iniciar o WebGL neste navegador.');
            return;
        }

        // pixelRatio ≤ 2 sempre; o preset de qualidade baixa mais (celular = 1)
        const pr = Math.min(window.devicePixelRatio || 1, this.quality.pixelRatio, 2);
        this.renderer.setPixelRatio(pr);
        this.renderer.setSize(window.innerWidth, window.innerHeight, false);
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.12;
        this.renderer.shadowMap.enabled = this.quality.shadows;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        configureCinematicRenderer(this.renderer, { shadows: this.renderer.shadowMap.enabled });

        this.scene = new THREE.Scene();
        applyCinematicEnvironment(this.scene, this.renderer, { intensity: this.quality?.id === 'low' ? 0.24 : 0.68 });
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
            this.road = createRoad(st, this.quality.fogDensity);
            this.scene.add(this.road.group);

            this.hud.setLoading(0.55, 'Erguendo o distrito…');
            this.city = new City(this.scene, this.quality, this.mats);

            this.hud.setLoading(0.7, 'Montando a moto…');
            this.player = new Player(this.scene, this.mats);
            this.headlight = new THREE.SpotLight(0xfff2d8, 3.2, 60, 0.42, 0.45, 1.1);
            this.headlight.position.set(0, 1.1, 0);
            this.headlight.target.position.set(0, 0.4, -16);
            this.scene.add(this.headlight, this.headlight.target);

            this.traffic = new Traffic(this.scene, this.mats, this.quality);
            this.finish = createFinishGate();
            this.scene.add(this.finish);
            this.effects = new Effects(this.scene, this.quality);
            this.audio = new GameAudio();
            this.audio.enabled = !this.settings.muted;
            this.audio.volume = this.settings.volume / 100;
            this.input = new Input();
            this.input.autoThrottle = this.settings.autoThrottle;

            this.applyStation(st);

            this.hud.setLoading(0.86, 'Ligando o bloom…');
            await withTimeout(this.setupPostProcessing(), 8000, null);

            // toque = tela sem hover com ponteiro grosso (iPad incluso, que se apresenta como Mac no UA);
            // notebook com tela de toque vira "toque" no primeiro dedo na tela
            this.isTouch = detectMobile() || matchMedia('(hover: none) and (pointer: coarse)').matches;
            this.bindUi();

            this.enterAttract();
            this.renderer.compile(this.scene, this.camera);
            this.render();

            this.hud.setLoading(1, 'INSERT COIN');
            setTimeout(() => this.hud.hideLoading(), 280);

            this.lastFrame = performance.now();
            const loop = (now) => this.frame(now);
            if (window.LabRuntime) LabRuntime.bindThreeLoop(this.renderer, loop);
            else this.renderer.setAnimationLoop(loop);
            if (window.LabRuntime) LabRuntime.debounceResize(() => this.resize());
            else window.addEventListener('resize', () => this.resize());
            const autoPause = () => {
                this.input.clear();
                this.releaseTouch?.();
                if (this.state === 'playing') this.pause();
            };
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) autoPause();
                // ao voltar, o relógio recomeça do zero (sem quadro gigante acumulado)
                else this.lastFrame = performance.now();
            });
            // trocar de janela também pausa: sem isso a moto seguia sem controle até bater
            window.addEventListener('blur', autoPause);
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

    applyStation(st) {
        this.flushStation(st);
    }

    flushStation(st) {
        hexInto(st.neonA, this.colA);
        hexInto(st.neonB, this.colB);
        this.scene.fog.color.setHex(st.fog);
        this.scene.background.setHex(st.zenith);
        this.sky?.uniforms.uHorizon.value.setHex(st.horizon);
        this.sky?.uniforms.uZenith.value.setHex(st.zenith);
        this.sky?.uniforms.uGround.value.setHex(st.ground);
        this.road?.uniforms.uNeonA.value.setHex(st.neonA);
        this.road?.uniforms.uNeonB.value.setHex(st.neonB);
        this.road?.uniforms.uAsphalt.value.setHex(st.asphalt);
        this.road?.uniforms.uFogColor.value.setHex(st.fog);
        if (this.hemi) {
            this.hemi.color.setHex(st.horizon);
            this.hemi.groundColor.setHex(st.ground);
        }
        if (this.sun) this.sun.color.setHex(st.neonB);
        if (this.mats) tintMaterials(this.mats, st);
        if (this.finish) {
            this.finish.userData.glowA.color.setHex(st.neonA);
            this.finish.userData.glowB.color.setHex(st.neonB);
        }
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
        const showRecord = () => hud.setRecord(DIFFICULTY[this.settings.difficulty], this.settings.records[this.settings.difficulty]);
        hud.buildDifficulties(this.settings.difficulty, (id) => {
            this.settings.difficulty = id;
            saveSettings(this.settings);
            showRecord();
            // a moto do modo atração passa a ser a da dificuldade escolhida
            if (this.state === 'menu') this.resetRun(true);
        });
        hud.bindSettings({
            quality: this.settings.quality,
            volume: this.settings.volume,
            autoThrottle: this.settings.autoThrottle,
            shake: this.settings.shake,
            onQuality: (q) => {
                this.settings.quality = q;
                saveSettings(this.settings);
                if (this.resolveQuality() !== this.quality) location.reload();
            },
            onVolume: (v) => {
                this.settings.volume = v;
                this.audio.setVolume(v / 100);
                saveSettings(this.settings);
            },
            onAutoThrottle: (on) => {
                this.settings.autoThrottle = on;
                this.input.autoThrottle = on;
                saveSettings(this.settings);
            },
            onShake: (on) => {
                this.settings.shake = on;
                saveSettings(this.settings);
            }
        });
        showRecord();
        hud.setMuted(this.settings.muted);

        const on = (id, fn) => document.getElementById(id)?.addEventListener('click', fn);
        on('startButton', () => this.start());
        on('resumeButton', () => this.resume());
        on('restartButton', () => this.start());
        on('pauseMenuButton', () => this.enterAttract());
        on('retryButton', () => this.start());
        on('overMenuButton', () => this.enterAttract());
        on('winRetryButton', () => this.start());
        on('winMenuButton', () => this.enterAttract());
        hud.el.soundButton.addEventListener('click', () => this.toggleMute());
        hud.el.cameraButton.addEventListener('click', () => this.cycleCamera());
        hud.el.pauseButton.addEventListener('click', () => {
            if (this.state === 'playing') this.pause();
            else if (this.state === 'paused') this.resume();
        });

        this.input.on('pause', () => {
            if (this.state === 'playing') this.pause();
            else if (this.state === 'paused') this.resume();
        });
        this.input.on('mute', () => this.toggleMute());
        this.input.on('camera', () => this.cycleCamera());
        this.input.on('confirm', () => {
            if (this.state === 'menu') this.start();
            else if (this.state === 'over' || this.state === 'won') this.start();
            else if (this.state === 'paused') this.resume();
        });
        this.input.on('radio', () => {
            if (this.state !== 'playing' && this.state !== 'menu') return;
            this.cycleStation();
        });

        // primeiro dedo na tela liga os controles de toque (notebooks/tablets híbridos)
        window.addEventListener('pointerdown', (e) => {
            if (e.pointerType !== 'touch' || this.isTouch) return;
            this.isTouch = true;
            if (this.state === 'playing' || this.state === 'paused') this.hud.setTouchVisible(true);
        }, { passive: true });

        this.bindTouch();
    }

    /**
     * Toque com Pointer Events (cancelamento e captura incluídos, para o guidão nunca
     * ficar preso virado): a posição do dedo na faixa vira o esterço, −1 (esquerda) a 1,
     * com zona morta de 8 % no centro.
     */
    bindTouch() {
        const zone = document.getElementById('steerZone');
        const knob = document.getElementById('steerKnob');
        const boost = document.getElementById('touchBoost');
        const brake = document.getElementById('touchBrake');
        if (!zone) return;

        let steerId = null;
        let rect = null;
        const readSteer = (e) => {
            const r = rect || zone.getBoundingClientRect();
            let x = clamp((((e.clientX - r.left) / r.width) * 2 - 1) * 1.3, -1, 1);
            if (Math.abs(x) < 0.08) x = 0;
            this.input.setTouchSteer(x);
            knob.style.transform = `translateX(${(x * r.width * 0.36).toFixed(1)}px)`;
        };
        const endSteer = (e) => {
            if (e && e.pointerId !== steerId) return;
            steerId = null;
            rect = null;
            this.input.setTouchSteer(0);
            knob.style.transform = '';
            zone.classList.remove('is-active');
        };
        zone.addEventListener('pointerdown', (e) => {
            if (steerId !== null) return;
            steerId = e.pointerId;
            rect = zone.getBoundingClientRect();
            try { zone.setPointerCapture?.(e.pointerId); } catch { /* ponteiro já solto */ }
            zone.classList.add('is-active');
            this.input.touchActive = true;
            readSteer(e);
            e.preventDefault();
        });
        zone.addEventListener('pointermove', (e) => { if (e.pointerId === steerId) readSteer(e); });
        for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) zone.addEventListener(type, endSteer);

        const hold = (el, setter) => {
            let id = null;
            el.addEventListener('pointerdown', (e) => {
                id = e.pointerId;
                try { el.setPointerCapture?.(e.pointerId); } catch { /* ponteiro já solto */ }
                el.classList.add('is-held');
                this.input.touchActive = true;
                setter(true);
                e.preventDefault();
            });
            const up = (e) => {
                if (e.pointerId !== id) return;
                id = null;
                el.classList.remove('is-held');
                setter(false);
            };
            for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(type, up);
            el.addEventListener('contextmenu', (e) => e.preventDefault());
        };
        hold(boost, (v) => this.input.setTouchBoost(v));
        hold(brake, (v) => this.input.setTouchBrake(v));
        this.releaseTouch = () => {
            endSteer({ pointerId: steerId });
            this.input.setTouchBoost(false);
            this.input.setTouchBrake(false);
            boost.classList.remove('is-held');
            brake.classList.remove('is-held');
        };
    }

    toggleMute() {
        this.settings.muted = !this.settings.muted;
        this.audio.setEnabled(!this.settings.muted);
        this.hud.setMuted(this.settings.muted);
        saveSettings(this.settings);
        if (!this.settings.muted) this.audio.resume();
    }

    cycleCamera() {
        this.cameraMode = (this.cameraMode + 1) % CAMERAS.length;
        this.settings.camera = this.cameraMode;
        saveSettings(this.settings);
        this.hud.message(`câmera: ${CAMERAS[this.cameraMode].name}`, 900);
        this.updateCamera(1, true);
    }

    cycleStation() {
        this.stationIndex = (this.stationIndex + 1) % STATIONS.length;
        this.applyStation(this.station());
        this.hud.message(this.station().name, 1200);
        this.audio.collect();
    }

    enterAttract() {
        this.state = 'menu';
        this.hud.setState('menu');
        this.hud.showMenu(true);
        this.hud.showPause(false);
        this.hud.showGameOver(false);
        this.hud.showWin(false);
        this.hud.setTouchVisible(false);
        this.releaseTouch?.();
        this.input.clear();
        this.audio.idle();
        this.resetRun(true);
    }

    start() {
        this.audio.resume();
        this.resetRun(false);
        this.state = 'playing';
        this.countdown = COUNTDOWN;
        this.hud.setState('playing');
        this.hud.showMenu(false);
        this.hud.showGameOver(false);
        this.hud.showWin(false);
        this.hud.showPause(false);
        this.hud.showHud(true);
        this.hud.setTouchVisible(this.isTouch);
        this.releaseTouch?.();
        this.input.clear();
        this.hud.countdown(3);
        this.lastFrame = performance.now();
        // o botão Jogar some: tira o foco dele para Espaço virar nitro, não "clicar de novo"
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    }

    resetRun(attract) {
        const diff = DIFFICULTY[this.settings.difficulty];
        this.lives = attract ? 99 : diff.lives;
        this.tapes = 0;
        this.nearMisses = 0;
        this.distance = 0;
        this.time = 0;
        this.topSpeed = 0;
        this.acc = 0;
        this.shake = 0;
        this.countdown = 0;
        this.stationIndex = 0;
        this.applyStation(this.station());
        // modo atração já sai rodando; a corrida larga parada
        this.player.reset({ bike: diff.bike, speed: attract ? 70 / KMH : 0 });
        this.player.auto = attract;
        this.goal = diff.goal;
        this.finishZ = -this.goal;
        this.finish.position.set(0, 0, this.finishZ);
        this.finish.visible = false;
        this.city.reset((Math.random() * 9999) | 0);
        this.traffic.setDifficulty(diff);
        this.traffic.reset(this.player.z);
        this.hud.setBike(BIKES[diff.bike]);
        this.updateCamera(1, true);
    }

    pause() {
        if (this.state !== 'playing') return;
        this.state = 'paused';
        this.hud.setState('paused');
        this.hud.showPause(true);
        this.releaseTouch?.();
        this.input.clear();
        this.audio.idle();
        document.getElementById('resumeButton').focus({ preventScroll: true });
    }

    resume() {
        if (this.state !== 'paused') return;
        this.state = 'playing';
        this.hud.setState('playing');
        this.hud.showPause(false);
        this.input.clear();
        this.lastFrame = performance.now();
        this.acc = 0;
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        this.audio.resume();
    }

    score() {
        return Math.floor(this.distance + this.tapes * SCORE.tape + this.nearMisses * SCORE.nearMiss);
    }

    /** Atualiza o recorde da dificuldade atual; devolve true se bateu tempo ou distância. */
    saveRecord(finished) {
        const id = this.settings.difficulty;
        const prev = this.settings.records[id] || { time: null, dist: 0, score: 0 };
        const next = { ...prev };
        let beat = false;
        if (finished && (prev.time == null || this.time < prev.time)) {
            next.time = this.time;
            beat = true;
        }
        if (this.distance > prev.dist) {
            next.dist = Math.floor(this.distance);
            if (!finished && prev.time == null) beat = true;
        }
        next.score = Math.max(prev.score || 0, this.score());
        this.settings.records[id] = next;
        saveSettings(this.settings);
        this.hud.setRecord(DIFFICULTY[id], next);
        return beat;
    }

    endRun() {
        this.player.alive = false;
        this.hud.showHud(false);
        this.hud.setTouchVisible(false);
        this.releaseTouch?.();
        this.input.clear();
        this.audio.idle();
    }

    gameOver() {
        this.state = 'over';
        this.endRun();
        const record = this.saveRecord(false);
        this.hud.setOverStats({
            distance: this.distance,
            tapes: this.tapes,
            time: this.time,
            score: this.score(),
            top: this.topSpeed * KMH,
            nearMisses: this.nearMisses,
            record
        });
        this.hud.showGameOver(true);
        this.hud.setState('over');
        document.getElementById('retryButton').focus({ preventScroll: true });
    }

    /** Cruzou a linha de chegada: placar, recorde e "Jogar de novo". */
    win() {
        this.state = 'won';
        this.distance = this.goal;
        this.endRun();
        const record = this.saveRecord(true);
        this.audio.collect();
        this.hud.setWinStats({
            distance: this.distance,
            tapes: this.tapes,
            time: this.time,
            score: this.score(),
            lives: this.lives,
            top: this.topSpeed * KMH,
            avg: this.time > 0 ? (this.distance / this.time) * KMH : 0,
            nearMisses: this.nearMisses,
            record
        });
        this.hud.showWin(true);
        this.hud.setState('won');
        document.getElementById('winRetryButton').focus({ preventScroll: true });
    }

    frame(now) {
        const dt = clamp((now - this.lastFrame) / 1000, 0, MAX_FRAME);
        this.lastFrame = now;

        try {
            const running = this.state === 'playing' || this.state === 'menu' || this.state === 'over' || this.state === 'won';
            if (running) {
                if (this.state === 'playing' || this.state === 'menu') this.input.sample(dt);
                this.acc += dt;
                let steps = 0;
                while (this.acc >= H && steps < 8) {
                    this.fixedStep(H);
                    this.acc -= H;
                    steps++;
                }
            }
            const alpha = clamp(this.acc / H, 0, 1);
            this.player.render(alpha, dt);
            this.traffic.render(alpha, dt);
            this.follow();
            this.effects.update(dt);
            if (this.state === 'playing') this.updateHud();
            this.updateAudio(dt);
            this.updateCamera(dt, false);
            this.render();
        } catch (err) {
            // exceção no laço não pode congelar a tela: registra e tenta de novo no próximo quadro
            console.error(err);
        }

        this.fpsAccum += dt;
        this.fpsFrames += 1;
        if (this.fpsAccum >= 0.5) {
            this.hud.setFps(this.fpsFrames / this.fpsAccum);
            this.fpsAccum = 0;
            this.fpsFrames = 0;
        }
    }

    /** Um passo fixo de simulação (física, trânsito, regras). */
    fixedStep(h) {
        const playing = this.state === 'playing';
        const p = this.player;
        const c = this.ctrl;

        if (playing && this.countdown > 0) {
            // largada: freio segurando a moto, acelerador só sobe o giro
            const before = Math.ceil(this.countdown / (COUNTDOWN / 3));
            this.countdown -= h;
            c.throttle = this.input.throttle;
            c.brake = 1;
            c.steer = 0;
            c.nitro = false;
            const after = Math.ceil(Math.max(0, this.countdown) / (COUNTDOWN / 3));
            if (after !== before) {
                this.hud.countdown(after);
                this.audio.beep(after === 0);
            }
        } else if (playing) {
            c.throttle = this.input.throttle;
            c.brake = this.input.brake;
            c.steer = this.input.steer;
            c.nitro = this.input.nitro;
        } else if (this.state === 'menu') {
            this.traffic.autoPilot(p, this.auto);
            c.steer = this.auto.steer;
            c.brake = this.auto.brake;
            c.throttle = this.auto.brake > 0 ? 0 : (p.speed < 75 / KMH ? 0.8 : 0.25);
            c.nitro = false;
        }

        p.step(h, c);
        this.traffic.step(h, p);

        if (!playing) return;
        if (this.countdown > 0) return;

        this.time += h;
        this.distance = p.phys.distance;
        if (p.speed > this.topSpeed) this.topSpeed = p.speed;
        this.scrapeCooldown = Math.max(0, this.scrapeCooldown - h);

        if (c.nitro && p.phys.nitroOn && !this.nitroHeld) this.audio.boostWhoosh();
        this.nitroHeld = c.nitro && p.phys.nitroOn;

        // o pórtico só entra na cena quando está ao alcance da vista (não custa draw call antes)
        this.finish.visible = p.z - this.finishZ < this.quality.drawDistance * 1.5;
        if (p.z <= this.finishZ) {
            this.win();
            return;
        }

        const got = this.traffic.collectTapes(p, this.collected);
        if (got.length) {
            this.tapes += got.length;
            p.phys.nitro = Math.min(1, p.phys.nitro + 0.25 * got.length);
            this.stationIndex = this.tapes % STATIONS.length;
            this.applyStation(this.station());
            this.audio.collect();
            this.hud.message(`${this.station().name} · nitro +25%`, 1100);
            for (const tape of got) {
                this.effects.spawn(tape.x, 1.2, tape.z, {
                    count: 22,
                    color: this.colB,
                    speed: 8,
                    size: 0.8,
                    life: 0.55
                });
            }
        }

        const near = this.traffic.nearMisses(p);
        if (near) {
            this.nearMisses += near;
            p.phys.nitro = Math.min(1, p.phys.nitro + 0.08 * near);
            this.audio.whoosh();
            this.hud.message(`por um triz +${SCORE.nearMiss * near}`, 700);
        }

        const car = this.traffic.collideCars(p);
        if (car && p.invuln <= 0) this.resolveContact(car);

        // meio-fio: faíscas e chiado (no máximo 6 por segundo)
        if (p.phys.scrape > 0 && p.speed > 5 && this.scrapeCooldown <= 0) {
            this.scrapeCooldown = 0.16;
            const side = Math.sign(p.x);
            this.effects.spawn(p.x + side * 0.4, 0.25, p.z, { count: 5, color: SPARK, speed: 5, size: 0.35, life: 0.35 });
            this.audio.scrape();
        }

        if (c.nitro && p.phys.nitroOn) {
            this.effects.trail(p.x, 0.2, p.z + 1.1, this.colA);
        }
    }

    /** Classifica o contato (ver REGRAS no topo) e aplica a consequência. */
    resolveContact(car) {
        const p = this.player;
        const dx = p.x - car.x;
        const lateralPen = (car.w + BIKE.width) * 0.5 - Math.abs(dx);
        const closing = p.speed - car.speed;
        const carBehind = car.z > p.z;
        if (carBehind || lateralPen < 0.35 || closing < 3) {
            p.scrape(Math.sign(dx) || 1);
            this.audio.scrape();
            this.kick(0.25);
            this.effects.spawn(p.x - Math.sign(dx) * 0.4, 0.7, p.z, { count: 10, color: SPARK, speed: 6, size: 0.5, life: 0.4 });
            this.hud.message('raspão', 600);
            return;
        }
        this.lives -= 1;
        p.crash(car.speed);
        this.audio.crash();
        this.hud.flashGlitch();
        this.kick(1);
        try { navigator.vibrate?.(140); } catch (err) { /* sem vibração */ }
        this.effects.spawn(p.x, 0.8, p.z - 1, {
            count: 40,
            color: [1, 0.4, 0.2],
            speed: 10,
            size: 0.9,
            life: 0.6
        });
        if (this.lives <= 0) this.gameOver();
        else this.hud.message(`batida · −1 crédito (${this.lives})`, 1300);
    }

    /** Tranco de câmera (respeita "Tremor de tela" e prefers-reduced-motion). */
    kick(amount) {
        if (!this.settings.shake || REDUCED_MOTION.matches) return;
        this.shake = Math.max(this.shake, amount);
    }

    /** Luzes, céu e asfalto acompanham a pose interpolada da moto. */
    follow() {
        const x = this.player.renderX;
        const z = this.player.renderZ;
        this.city.recycle(z);
        this.city.updateLights(z);
        this.road.group.position.z = z - 80;
        this.road.uniforms.uZ.value = z;
        this.sky.mesh.position.set(x * 0.05, 0, z);
        this.sun.position.set(x - 8, 18, z + 10);
        this.sun.target.position.set(x, 0, z - 20);
        this.headlight.position.set(x, 1.15, z - 0.4);
        this.headlight.target.position.set(x + this.player.phys.vy * 0.6, 0.3, z - 22);
    }

    updateHud() {
        const p = this.player.phys;
        const s = this.hudState;
        s.speed = p.v * KMH;
        s.gear = p.gear;
        s.rpm = p.rpm;
        s.redline = p.bike.redline;
        s.limiter = p.bike.limiter;
        s.lean = p.lean * 180 / Math.PI;
        s.grip = p.gripUse;
        s.nitro = p.nitro;
        s.nitroOn = p.nitroOn;
        s.distance = this.distance;
        s.tapes = this.tapes;
        s.lives = this.lives;
        s.station = this.station();
        s.time = this.time;
        s.goal = this.goal;
        s.score = this.score();
        this.hud.update(s);
    }

    updateAudio(dt) {
        if (this.state !== 'playing' && this.state !== 'menu') return;
        const p = this.player.phys;
        const e = this.engineState;
        e.rpm = p.rpm;
        e.redline = p.bike.redline;
        e.throttle = this.ctrl.throttle;
        e.speed = p.v;
        e.nitro = p.nitroOn;
        e.shifted = p.shifted;
        this.audio.update(dt, this.state === 'playing' ? e : null);
    }

    updateCamera(dt, instant) {
        const rig = CAMERAS[this.cameraMode];
        const p = this.player;
        const phys = p.phys;
        // a câmera recua um pouco ao acelerar e avança ao frear (sensação de g longitudinal)
        const pullTarget = clamp(phys.aLong / 9.81, -1, 1) * (this.cameraMode === 1 ? 0.12 : 0.9);
        this.camPull = instant ? pullTarget : damp(this.camPull, pullTarget, 4, dt);
        CAM.copy(rig.offset);
        CAM.x += p.renderX;
        CAM.z += p.renderZ + this.camPull;
        LOOK.copy(rig.look);
        LOOK.x += p.renderX + phys.vy * 0.5;
        LOOK.z += p.renderZ;
        // z fica rígido (sem atraso de 10+ m a 300 km/h); x/y suavizados
        const k = instant ? 1 : 1 - Math.exp(-dt * rig.follow);
        this.camera.position.x += (CAM.x - this.camera.position.x) * k;
        this.camera.position.y += (CAM.y - this.camera.position.y) * k;
        this.camera.position.z = CAM.z;
        if (!this._look) this._look = LOOK.clone();
        this._look.x += (LOOK.x - this._look.x) * k;
        this._look.y += (LOOK.y - this._look.y) * k;
        this._look.z = LOOK.z;

        // tremor: batidas + vibração leve em alta velocidade (∝ (v/90)²)
        const allowShake = this.settings.shake && !REDUCED_MOTION.matches;
        const vib = allowShake && this.state === 'playing' ? Math.min(1, (phys.v / 90) ** 2) * 0.012 : 0;
        const amp = this.shake * 0.18 + vib;
        if (amp > 0.0005) {
            const t = this.lastFrame * 0.001;
            this.camera.position.x += Math.sin(t * 53) * amp;
            this.camera.position.y += Math.sin(t * 71 + 1.3) * amp;
        }
        this.shake = Math.max(0, this.shake - dt * 2.2);

        this.camera.lookAt(this._look);
        const rollTarget = -phys.lean * rig.roll;
        this.camRoll = instant ? rollTarget : damp(this.camRoll, rollTarget, 8, dt);
        this.camera.rotateZ(this.camRoll);

        // FOV abre com a velocidade (até +20° a 300 km/h) e +4° no nitro
        const fov = 58 + Math.min(1, phys.v * KMH / 300) * 20 + (phys.nitroOn ? 4 : 0);
        const nextFov = instant ? fov : damp(this.camera.fov, fov, 4, dt);
        if (Math.abs(nextFov - this.camera.fov) > 0.01) {
            this.camera.fov = nextFov;
            this.camera.updateProjectionMatrix();
        }
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

function hexInto(hex, out) {
    out[0] = ((hex >> 16) & 255) / 255;
    out[1] = ((hex >> 8) & 255) / 255;
    out[2] = (hex & 255) / 255;
    return out;
}

const game = new Game();
window.__neon = game;
game.init().catch((err) => {
    console.error(err);
    game.hud.showError(err?.message || 'Falha ao iniciar o Neon Rider.');
});
