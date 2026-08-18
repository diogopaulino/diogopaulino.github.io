/**
 * Nina — laço principal: renderer, pulo, amoras, fila de filhotes e a festa.
 */

import * as THREE from 'three';
import { Valley } from './world.js';
import { Player } from './player.js';
import { Effects } from './effects.js';
import { Input } from './input.js';
import { Hud } from './hud.js';
import { NinaAudio } from './audio.js';
import { updateFriend } from './animals.js';
import {
    TOTAL_FRIENDS, BEFRIEND_R, HOME_R, BERRY_R, HOME
} from './config.js';

const STORAGE = 'nina-settings';

const QUALITY = {
    low: { pr: 1, antialias: false, bloom: false, shadows: false, clouds: 5, butterflies: 6, flowers: 28, sparks: 12, confetti: 18 },
    medium: { pr: 1.35, antialias: true, bloom: true, shadows: true, clouds: 10, butterflies: 14, flowers: 70, sparks: 28, confetti: 40 },
    high: { pr: 1.75, antialias: true, bloom: true, shadows: true, clouds: 16, butterflies: 22, flowers: 110, sparks: 36, confetti: 56 }
};

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

class Nina {
    constructor() {
        this.canvas = document.getElementById('scene');
        this.hud = new Hud();
        this.audio = new NinaAudio();
        this.input = new Input(this.canvas);
        this.state = 'boot';
        this.playTime = 0;
        this.won = false;
        this.party = 0;
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
            jump: document.getElementById('btnJump'),
            run: document.getElementById('btnRun')
        });

        window.addEventListener('resize', () => this.resize());
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state === 'play') this.pause();
        });
    }

    async boot() {
        this.hud.setLoading(0.08, 'Abrindo o vale…');
        try {
            await this.setupRenderer();
        } catch (err) {
            this.hud.fail(err?.message || 'Falha ao iniciar o WebGL.');
            return;
        }

        this.hud.setLoading(0.38, 'Plantando o gramado…');
        this.valley = new Valley(this.scene, this.quality);

        this.hud.setLoading(0.62, 'Chamando Nina…');
        this.player = new Player(this.scene, this.camera);
        this.effects = new Effects(this.scene, this.quality);

        this.hud.setLoading(0.84, 'Acendendo o sol…');
        await this.setupBloom();

        this.renderer.compile(this.scene, this.camera);
        this.render();
        this.hud.setLoading(1, 'Pronto');
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
        this.renderer.toneMappingExposure = 1.08;
        this.renderer.shadowMap.enabled = this.quality.shadows;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.2, 900);

        const hemi = new THREE.HemisphereLight(0xffe0c0, 0x6fd15a, 0.9);
        this.scene.add(hemi);

        this.sun = new THREE.DirectionalLight(0xfff0c8, 1.28);
        this.sun.position.set(24, 32, 16);
        this.sun.castShadow = this.quality.shadows;
        if (this.quality.shadows) {
            this.sun.shadow.mapSize.set(2048, 2048);
            this.sun.shadow.camera.near = 4;
            this.sun.shadow.camera.far = 90;
            this.sun.shadow.camera.left = -42;
            this.sun.shadow.camera.right = 42;
            this.sun.shadow.camera.top = 42;
            this.sun.shadow.camera.bottom = -42;
            this.sun.shadow.bias = -0.0004;
        }
        this.scene.add(this.sun);
        this.scene.add(new THREE.AmbientLight(0xffd8c4, 0.32));
        const fill = new THREE.DirectionalLight(0xa8d4ff, 0.38);
        fill.position.set(-20, 14, -14);
        this.scene.add(fill);
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
                0.22,
                0.5,
                0.78
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
        this.playTime = 0;
        this.won = false;
        this.party = 0;
        this.player.reset();
        this.valley.reset();
        this.syncHud();
        this.hud.setTouchVisible(matchMedia('(pointer: coarse)').matches);
        this.hud.showPlay();
        this.hud.say('Pegue amoras brilhantes e ofereça aos filhotes. Espaço pula ou chama.');
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

    followers() {
        return this.valley.friends.filter((f) => f.state === 'follow');
    }

    homeCount() {
        return this.valley.friends.filter((f) => f.state === 'home').length;
    }

    nearestLost() {
        const p = this.player.pos;
        let best = null;
        let bestD = Infinity;
        for (const f of this.valley.friends) {
            if (f.state !== 'lost') continue;
            const d = Math.hypot(p.x - f.mesh.position.x, p.z - f.mesh.position.z);
            if (d < bestD) {
                bestD = d;
                best = f;
            }
        }
        return best;
    }

    syncHud() {
        const lost = this.nearestLost();
        this.hud.setStatus({
            home: this.homeCount(),
            berries: this.player.berries,
            following: this.followers().length,
            hint: lost ? lost.hint : 'o ninho'
        });
    }

    collectBerries() {
        const p = this.player.pos;
        for (const b of this.valley.berries) {
            if (b.userData.taken) continue;
            if (p.distanceTo(b.position) < BERRY_R) {
                b.userData.taken = true;
                b.visible = false;
                this.player.berries++;
                this.effects.burst(b.position, 0xff6eb4);
                this.audio.berry();
                this.hud.say(`Amora! Você tem ${this.player.berries}.`);
                this.syncHud();
            }
        }
    }

    tryAction() {
        const p = this.player.pos;
        let nearest = null;
        let nearestD = BEFRIEND_R;
        for (const f of this.valley.friends) {
            if (f.state !== 'lost') continue;
            const d = p.distanceTo(f.mesh.position);
            if (d < nearestD) {
                nearestD = d;
                nearest = f;
            }
        }
        if (nearest) {
            if (this.player.berries < 1) {
                this.hud.say(`${nearest.name} quer uma amora. Pegue uma primeiro!`);
                this.player.tryJump();
                this.audio.hop();
                return;
            }
            this.player.berries--;
            nearest.state = 'follow';
            this.effects.heart(nearest.mesh.position);
            this.effects.burst(nearest.mesh.position, 0xffe066);
            this.audio.friend();
            this.hud.say(`${nearest.name} veio com você! Leve ao ninho.`);
            this.syncHud();
            return;
        }

        const homeDist = Math.hypot(p.x - HOME.x, p.z - HOME.z);
        if (homeDist < HOME_R && this.followers().length) {
            this.dropOff();
            return;
        }

        if (this.player.tryJump()) this.audio.hop();
    }

    dropOff() {
        const waiting = this.followers();
        const already = this.homeCount();
        waiting.forEach((f, i) => {
            f.state = 'home';
            f.homeSlot = already + i;
        });
        this.effects.burst(new THREE.Vector3(HOME.x, this.valley.groundHeight(HOME.x, HOME.z) + 1, HOME.z), 0xffe066);
        this.audio.home();
        const n = this.homeCount();
        this.hud.say(n >= TOTAL_FRIENDS ? 'Todos no piquenique!' : `${waiting.length === 1 ? waiting[0].name + ' chegou' : waiting.length + ' filhotes chegaram'} ao ninho.`);
        this.syncHud();
        if (n >= TOTAL_FRIENDS && !this.won) this.win();
    }

    win() {
        this.won = true;
        this.party = 1;
        const origin = new THREE.Vector3(HOME.x, this.valley.groundHeight(HOME.x, HOME.z) + 1.4, HOME.z);
        this.effects.party(origin);
        this.audio.victory();
        const seconds = this.playTime;
        const stamp = `${Math.floor(seconds)}s`;
        if (!this.settings.best || seconds < parseFloat(this.settings.best)) {
            this.settings.best = stamp;
            this.saveSettings();
            this.hud.setBest(stamp);
        }
        setTimeout(() => {
            this.state = 'victory';
            this.hud.showVictory({
                home: TOTAL_FRIENDS,
                berries: this.player.berries,
                seconds
            });
        }, 1800);
    }

    frame(now) {
        const dt = Math.min(0.033, (now - this.last) / 1000) || 0.016;
        this.last = now;

        const look = this.input.sample();
        const playing = this.state === 'play';
        const t = now * 0.001;

        if (playing) {
            this.playTime += dt;
            this.player.update(dt, this.input, look, this.valley);
            if (this.input.consumeJump()) this.tryAction();
            this.collectBerries();

            const chain = this.followers();
            const leader = { x: this.player.pos.x, z: this.player.pos.z, yaw: this.player.yaw };
            for (const friend of this.valley.friends) {
                const idx = chain.indexOf(friend);
                updateFriend(friend, dt, this.valley, leader, Math.max(0, idx), t, this.party > 0.5);
            }
        } else {
            const orbit = now * 0.0001;
            this.camera.position.set(Math.cos(orbit) * 28, 12 + Math.sin(orbit * 0.7) * 2.4, Math.sin(orbit) * 28);
            this.camera.lookAt(0, 1.2, 2);
            this.input.look.dx = this.input.look.dy = 0;
            for (const friend of this.valley.friends) {
                updateFriend(friend, dt, this.valley, null, 0, t, false);
            }
        }

        this.valley.update(dt, this.party, playing ? this.followers().length : 0);
        this.effects.update(dt);
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

new Nina();
