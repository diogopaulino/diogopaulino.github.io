/**
 * Nereida — laço principal: renderer, bloom, natação e o despertar do recife.
 */

import * as THREE from 'three';
import { Sanctuary } from './world.js';
import { Life } from './creatures.js';
import { Player } from './player.js';
import { Input } from './input.js';
import { Hud } from './hud.js';
import { NereidaAudio } from './audio.js';
import {
    QUALITY, TOTAL_TIDES, COLLECT_R, SONAR_SPEED, SONAR_LIFE,
    SONAR_PING_R, SURFACE, FOG_COLOR, FOG0
} from './config.js';

const STORAGE = 'nereida-settings';

function detectSoftwareGL(renderer) {
    try {
        const gl = renderer.getContext();
        const info = gl.getExtension('WEBGL_debug_renderer_info');
        if (!info) return false;
        const name = gl.getParameter(info.UNMASKED_RENDERER_WEBGL) || '';
        return /swiftshader|llvmpipe|softpipe|microsoft basic render/i.test(name);
    } catch {
        return false;
    }
}

function pickQuality(mode, renderer) {
    if (QUALITY[mode]) return QUALITY[mode];
    const mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 800;
    if (detectSoftwareGL(renderer) || mobile) return QUALITY.low;
    if (devicePixelRatio >= 2 && innerWidth >= 1400) return QUALITY.high;
    return QUALITY.medium;
}

class Nereida {
    constructor() {
        this.canvas = document.getElementById('scene');
        this.hud = new Hud();
        this.audio = new NereidaAudio();
        this.input = new Input(this.canvas);
        this.state = 'boot';
        this.tides = 0;
        this.pings = 0;
        this.playTime = 0;
        this.won = false;
        this.sonar = null;
        this.settings = this.loadSettings();
        this.bindUi();
        this.boot();
    }

    loadSettings() {
        try {
            return {
                quality: 'auto',
                volume: 70,
                muted: false,
                best: null,
                ...JSON.parse(localStorage.getItem(STORAGE) || '{}')
            };
        } catch {
            return { quality: 'auto', volume: 70, muted: false, best: null };
        }
    }

    saveSettings() {
        localStorage.setItem(STORAGE, JSON.stringify(this.settings));
    }

    bindUi() {
        const h = this.hud.el;
        h.qualitySelect.value = this.settings.quality;
        h.volumeSlider.value = this.settings.volume;
        h.volumeValue.textContent = this.settings.volume;
        this.hud.setBest(this.settings.best);
        this.hud.setSound(!this.settings.muted);

        document.getElementById('startButton').addEventListener('click', () => this.start());
        document.getElementById('resumeButton').addEventListener('click', () => this.resume());
        document.getElementById('pauseMenuButton').addEventListener('click', () => this.enterMenu());
        document.getElementById('replayButton').addEventListener('click', () => this.start());
        document.getElementById('victoryMenuButton').addEventListener('click', () => this.enterMenu());
        h.pauseButton.addEventListener('click', () => {
            if (this.state === 'play') this.pause();
            else if (this.state === 'pause') this.resume();
        });
        h.soundButton.addEventListener('click', () => this.toggleMute());
        h.qualitySelect.addEventListener('change', () => {
            this.settings.quality = h.qualitySelect.value;
            this.saveSettings();
        });
        h.volumeSlider.addEventListener('input', () => {
            this.settings.volume = Number(h.volumeSlider.value);
            h.volumeValue.textContent = this.settings.volume;
            this.audio.setVolume(this.settings.volume / 100);
            this.saveSettings();
        });

        this.input.on('pause', () => {
            if (this.state === 'play') this.pause();
            else if (this.state === 'pause') this.resume();
        });
        this.input.on('mute', () => this.toggleMute());

        this.input.bindTouch({
            stick: document.getElementById('moveStick'),
            knob: document.getElementById('moveKnob'),
            up: document.getElementById('btnUp'),
            down: document.getElementById('btnDown'),
            pulse: document.getElementById('btnPulse')
        });

        window.addEventListener('resize', () => this.resize());
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state === 'play') this.pause();
        });
    }

    async boot() {
        this.hud.setLoading(0.08, 'Afundo com calma…');
        try {
            await this.setupRenderer();
        } catch (err) {
            this.hud.fail(err?.message || 'Falha ao iniciar o WebGL.');
            return;
        }

        this.hud.setLoading(0.32, 'Levantando o recife…');
        this.world = new Sanctuary(this.scene, this.quality);

        this.hud.setLoading(0.55, 'Chamando a vida…');
        this.life = new Life(this.scene, this.quality);
        this.player = new Player(this.scene, this.camera);
        this._sonarMesh();

        this.hud.setLoading(0.82, 'Filtrando a luz…');
        await this.setupBloom();

        this.renderer.compile(this.scene, this.camera);
        this.render();
        this.hud.setLoading(1, 'A maré está pronta');
        setTimeout(() => {
            this.hud.hideLoading();
            this.enterMenu();
            this.last = performance.now();
            this.renderer.setAnimationLoop((now) => this.frame(now));
        }, 280);
    }

    async setupRenderer() {
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            powerPreference: 'high-performance',
            stencil: false
        });
        if (!this.renderer.getContext()) {
            throw new Error('WebGL indisponível neste navegador.');
        }
        this.quality = pickQuality(this.settings.quality, this.renderer);
        this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.quality.pr));
        this.renderer.setSize(innerWidth, innerHeight);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.05;
        this.renderer.shadowMap.enabled = this.quality.shadows;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(FOG_COLOR);
        this.scene.fog = new THREE.FogExp2(FOG_COLOR, FOG0);
        this.camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.2, 220);

        const hemi = new THREE.HemisphereLight(0x4ec4d4, 0x0a2430, 0.55);
        this.scene.add(hemi);

        this.sun = new THREE.DirectionalLight(0xc8e8ff, 0.85);
        this.sun.position.set(12, 28, -8);
        this.sun.castShadow = this.quality.shadows;
        if (this.quality.shadows) {
            this.sun.shadow.mapSize.set(1024, 1024);
            this.sun.shadow.camera.near = 4;
            this.sun.shadow.camera.far = 80;
            this.sun.shadow.camera.left = -36;
            this.sun.shadow.camera.right = 36;
            this.sun.shadow.camera.top = 36;
            this.sun.shadow.camera.bottom = -36;
            this.sun.shadow.bias = -0.0005;
        }
        this.scene.add(this.sun);
        this.scene.add(new THREE.AmbientLight(0x123040, 0.32));
        const fill = new THREE.DirectionalLight(0x3a6a88, 0.28);
        fill.position.set(-18, 8, 14);
        this.scene.add(fill);
    }

    _sonarMesh() {
        const geo = new THREE.RingGeometry(0.6, 0.85, 48);
        const mat = new THREE.MeshBasicMaterial({
            color: 0x9ef7ff,
            transparent: true,
            opacity: 0,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        this.sonarRing = new THREE.Mesh(geo, mat);
        this.sonarRing.rotation.x = Math.PI / 2;
        this.sonarRing.visible = false;
        this.scene.add(this.sonarRing);
    }

    async setupBloom() {
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
            composer.setSize(innerWidth, innerHeight);
            composer.addPass(new RenderPass(this.scene, this.camera));
            composer.addPass(new UnrealBloomPass(
                new THREE.Vector2(innerWidth, innerHeight),
                0.42,
                0.62,
                0.55
            ));
            composer.addPass(new OutputPass());
            this.composer = composer;
        } catch {
            this.composer = null;
        }
    }

    start() {
        this.audio.init();
        this.audio.setVolume(this.settings.volume / 100);
        this.audio.setEnabled(!this.settings.muted);
        this.tides = 0;
        this.pings = 0;
        this.playTime = 0;
        this.won = false;
        this.sonar = null;
        this.player.reset();
        this.world.reset();
        this.life.setAwaken(0);
        this.audio.setAwaken(0);
        this.hud.setTides(0, TOTAL_TIDES);
        this.hud.setTouchVisible(matchMedia('(pointer: coarse)').matches);
        this.hud.showPlay();
        this.hud.say('Deslize até as luzes. Espaço emite um sonar.');
        this.state = 'play';
        document.body.dataset.state = 'play';
    }

    enterMenu() {
        this.state = 'menu';
        document.body.dataset.state = 'menu';
        this.hud.showMenu();
    }

    pause() {
        if (this.state !== 'play') return;
        this.state = 'pause';
        this.hud.showPause();
    }

    resume() {
        if (this.state !== 'pause') return;
        this.state = 'play';
        this.hud.hidePause();
        this.last = performance.now();
    }

    toggleMute() {
        this.settings.muted = !this.settings.muted;
        this.audio.setEnabled(!this.settings.muted);
        this.hud.setSound(!this.settings.muted);
        this.saveSettings();
    }

    collectTide(orb) {
        orb.userData.taken = true;
        orb.visible = false;
        orb.userData.light.intensity = 0;
        this.tides++;
        const a = this.tides / TOTAL_TIDES;
        this.world.setAwaken(a);
        this.life.setAwaken(a);
        this.audio.setAwaken(a);
        this.audio.collect();
        this.hud.setTides(this.tides, TOTAL_TIDES);
        this.hud.say(orb.userData.hint);
        this.sun.intensity = 0.85 + a * 0.35;
        this.renderer.toneMappingExposure = 1.05 + a * 0.18;

        if (this.tides >= TOTAL_TIDES && !this.won) {
            this.won = true;
            this.audio.victory();
            const seconds = this.playTime;
            const stamp = `${this.pings} sonares · ${Math.floor(seconds)}s`;
            if (!this.settings.best) this.settings.best = stamp;
            this.saveSettings();
            this.hud.setBest(this.settings.best);
            this.hud.say('A baleia encontrou você.');
            setTimeout(() => {
                this.state = 'victory';
                this.hud.showVictory({
                    tides: this.tides,
                    pings: this.pings,
                    seconds
                });
            }, 2200);
        }
    }

    fireSonar() {
        this.pings++;
        this.sonar = { age: 0 };
        this.sonarRing.visible = true;
        this.sonarRing.position.copy(this.player.mesh.position);
        this.sonarRing.material.opacity = 0.7;
        this.audio.sonar();
        const origin = this.player.mesh.position;
        for (const orb of this.world.tides) {
            if (orb.userData.taken) continue;
            if (origin.distanceTo(orb.position) < SONAR_PING_R) {
                this.audio.ping();
                orb.userData.halo.scale.setScalar(2.4);
            }
        }
    }

    frame(now) {
        const dt = Math.min(0.033, (now - this.last) / 1000) || 0.016;
        this.last = now;
        const t = now * 0.001;

        const look = this.input.sample();
        const playing = this.state === 'play';

        if (playing) {
            this.playTime += dt;
            this.player.update(dt, this.input, look);
            if (this.input.consumePulse()) this.fireSonar();

            const pos = this.player.mesh.position;
            this.hud.setDepth(pos.y, SURFACE);
            for (const orb of this.world.tides) {
                if (orb.userData.taken) continue;
                if (pos.distanceTo(orb.position) < COLLECT_R) this.collectTide(orb);
            }
        } else {
            const orbit = now * 0.00008;
            this.camera.position.set(
                Math.cos(orbit) * 32,
                11 + Math.sin(orbit * 0.7) * 3,
                Math.sin(orbit) * 32
            );
            this.camera.lookAt(0, 7, 0);
            this.input.look.dx = this.input.look.dy = 0;
        }

        if (this.sonar) {
            this.sonar.age += dt;
            const r = 0.8 + this.sonar.age * SONAR_SPEED;
            this.sonarRing.scale.setScalar(r);
            this.sonarRing.position.copy(playing ? this.player.mesh.position : this.sonarRing.position);
            this.sonarRing.material.opacity = Math.max(0, 0.7 * (1 - this.sonar.age / SONAR_LIFE));
            if (this.sonar.age >= SONAR_LIFE) {
                this.sonar = null;
                this.sonarRing.visible = false;
            }
        }

        this.world.update(dt);
        this.life.update(dt, t, playing ? this.player.mesh.position : null, this.won);
        this.render();
    }

    render() {
        if (this.composer) this.composer.render();
        else this.renderer.render(this.scene, this.camera);
    }

    resize() {
        const w = innerWidth;
        const h = innerHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
        this.composer?.setSize(w, h);
    }
}

new Nereida();
