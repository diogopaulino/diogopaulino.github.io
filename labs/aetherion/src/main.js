/**
 * Aetherion — laço principal: renderer, pós-processamento, HUD e input.
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { StarSystem } from './system.js';
import { ObservatoryCamera } from './camera.js';
import { SpaceAudio } from './audio.js';

const AU = 42;
const STORAGE = 'aetherion-quality';

const QUALITY = {
    low: { planetSegs: 32, asteroids: 140, stars: 2800, bloom: false, pr: 1, antialias: false },
    medium: { planetSegs: 56, asteroids: 380, stars: 5200, bloom: true, pr: 1.35, antialias: true },
    high: { planetSegs: 80, asteroids: 680, stars: 8200, bloom: true, pr: 2, antialias: true }
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
    if (mode === 'low' || mode === 'medium' || mode === 'high') return QUALITY[mode];
    const mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 800;
    if (detectSoftwareGL(renderer) || mobile) return QUALITY.low;
    if (devicePixelRatio >= 2 && innerWidth >= 1400) return QUALITY.high;
    return QUALITY.medium;
}

class Aetherion {
    constructor() {
        this.canvas = document.getElementById('scene');
        this.hud = document.getElementById('hud');
        this.intro = document.getElementById('intro');
        this.help = document.getElementById('helpOverlay');
        this.error = document.getElementById('errorOverlay');
        this.bodyList = document.getElementById('bodyList');
        this.hint = document.getElementById('hint');
        this.audio = new SpaceAudio();
        this.clock = new THREE.Clock();
        this.simTime = 0;
        this.warp = 1;
        this.focusedId = 'star';
        this.raycaster = new THREE.Raycaster();
        this.pointer = new THREE.Vector2();
        this.worldPos = new THREE.Vector3();
        this.hintTimer = 0;
        this.qualityMode = localStorage.getItem(STORAGE) || 'auto';
        const select = document.getElementById('qualitySelect');
        if (select) select.value = this.qualityMode;
        this.bindUi();
    }

    bindUi() {
        document.getElementById('startButton').addEventListener('click', () => this.start());
        document.getElementById('newSystemBtn').addEventListener('click', () => this.forge());
        document.getElementById('systemViewBtn').addEventListener('click', () => this.viewSystem());
        document.getElementById('muteBtn').addEventListener('click', () => this.toggleMute());
        document.getElementById('helpButton')?.addEventListener('click', () => this.toggleHelp(true));
        document.getElementById('helpClose')?.addEventListener('click', () => this.toggleHelp(false));
        document.getElementById('qualitySelect').addEventListener('change', (e) => {
            this.qualityMode = e.target.value;
            localStorage.setItem(STORAGE, this.qualityMode);
        });
        document.getElementById('warpBtns').addEventListener('click', (e) => {
            const btn = e.target.closest('[data-warp]');
            if (!btn) return;
            this.setWarp(Number(btn.dataset.warp));
        });
        window.addEventListener('keydown', (e) => this.onKey(e));
        window.addEventListener('resize', () => this.resize());
    }

    fail(message) {
        document.getElementById('errorText').textContent = message;
        this.error.hidden = false;
        this.intro.hidden = true;
    }

    start() {
        try {
            this.bootRenderer();
        } catch (err) {
            this.fail(err?.message || 'Falha ao iniciar o WebGL.');
            return;
        }

        this.audio.init();
        this.system = new StarSystem(this.scene, this.quality);
        this.system.generate();
        this.populateCatalog();
        this.rig.systemView();
        this.rig.spherical.radius = 520;
        this.focusedId = 'star';
        this.refreshDossier();
        this.highlightCatalog();

        this.intro.hidden = true;
        this.hud.hidden = false;
        document.body.dataset.state = 'observing';
        this.clock.start();
        this.loop();
        this.hintTimer = 8;
    }

    bootRenderer() {
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            powerPreference: 'high-performance',
            stencil: false
        });
        if (!this.renderer.getContext()) {
            throw new Error('WebGL indisponível neste navegador.');
        }

        this.quality = pickQuality(this.qualityMode, this.renderer);
        this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.quality.pr));
        this.renderer.setSize(innerWidth, innerHeight);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.05;
        this.renderer.setClearColor(0x03040c, 1);

        this.scene = new THREE.Scene();
        this.scene.add(new THREE.HemisphereLight(0x8aa7ff, 0x06040a, 0.32));

        this.camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.15, 4000);
        this.rig = new ObservatoryCamera(this.camera, this.canvas);

        this.canvas.addEventListener('pointerup', (e) => this.onCanvasClick(e));

        if (this.quality.bloom) {
            try {
                this.composer = new EffectComposer(this.renderer);
                this.composer.setPixelRatio(this.renderer.getPixelRatio());
                this.composer.addPass(new RenderPass(this.scene, this.camera));
                this.bloom = new UnrealBloomPass(
                    new THREE.Vector2(innerWidth, innerHeight),
                    0.42,
                    0.48,
                    0.78
                );
                this.composer.addPass(this.bloom);
                this.composer.addPass(new OutputPass());
            } catch {
                this.composer = null;
            }
        }
    }

    populateCatalog() {
        this.bodyList.innerHTML = '';
        for (const body of this.system.bodies) {
            if (body.kind === 'moon') continue;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'body-btn';
            btn.dataset.id = body.id;
            btn.innerHTML = `<span class="swatch" style="--swatch:${body.color}"></span>
                <span>${body.name}<small>${body.subtitle}</small></span>`;
            btn.addEventListener('click', () => this.focusBody(body.id));
            this.bodyList.appendChild(btn);
        }
    }

    highlightCatalog() {
        for (const btn of this.bodyList.querySelectorAll('.body-btn')) {
            btn.classList.toggle('is-on', btn.dataset.id === this.focusedId);
        }
    }

    bodyById(id) {
        return this.system.bodies.find((b) => b.id === id);
    }

    bodyPosition(body, target) {
        if (body.kind === 'star') return target.set(0, 0, 0);
        if (body.kind === 'belt') return target.set(body.orbitRadius, 0.4, 0);
        body.group.getWorldPosition(target);
        return target;
    }

    focusBody(id, { warpSfx = true } = {}) {
        const body = this.bodyById(id);
        if (!body) return;
        this.focusedId = id;
        this.bodyPosition(body, this.worldPos);
        this.rig.focus(this.worldPos, body.focusDistance);
        this.refreshDossier();
        this.highlightCatalog();
        if (warpSfx) this.audio.warp();
        document.getElementById('systemViewBtn').classList.remove('is-on');
    }

    viewSystem() {
        this.focusedId = 'star';
        this.rig.systemView();
        this.refreshDossier();
        this.highlightCatalog();
        document.getElementById('systemViewBtn').classList.add('is-on');
        this.audio.chime();
    }

    forge() {
        this.system.generate();
        this.populateCatalog();
        this.viewSystem();
        this.rig.spherical.radius = 480;
        this.audio.chime();
    }

    refreshDossier() {
        const body = this.bodyById(this.focusedId) || this.system.bodies[0];
        document.getElementById('dossierKind').textContent = body.subtitle;
        document.getElementById('dossierName').textContent = body.name;
        const au = body.orbitRadius / AU;
        document.getElementById('statDistance').textContent = body.orbitRadius
            ? `${au.toFixed(2)} UA`
            : '0 UA';
        document.getElementById('statRadius').textContent = body.kind === 'star'
            ? `${(body.radius / 6.4).toFixed(2)} R☉`
            : body.kind === 'hole'
                ? `${body.radius.toFixed(1)} Rs`
                : `${(body.radius / 1.5).toFixed(2)} ⊕`;
        document.getElementById('statPeriod').textContent = body.orbitRadius
            ? `${Math.pow(Math.max(au, 0.05), 1.5).toFixed(2)} anos`
            : '—';
        document.getElementById('statComp').textContent = body.composition;
        document.getElementById('dossierBlurb').textContent = body.blurb;
    }

    setWarp(value) {
        this.warp = value;
        for (const btn of document.querySelectorAll('#warpBtns [data-warp]')) {
            btn.classList.toggle('is-on', Number(btn.dataset.warp) === value);
        }
    }

    toggleMute() {
        const next = this.audio.enabled;
        this.audio.setMuted(next);
        const btn = document.getElementById('muteBtn');
        btn.textContent = this.audio.enabled ? 'Som' : 'Mudo';
        btn.setAttribute('aria-pressed', String(!this.audio.enabled));
    }

    toggleHelp(open) {
        this.help.hidden = !open;
    }

    onKey(e) {
        if (e.target.matches('input, select, textarea')) return;
        const k = e.key.toLowerCase();
        if (k === '?' || k === 'h') this.toggleHelp(this.help.hidden);
        if (k === 'escape') this.toggleHelp(false);
        if (document.body.dataset.state !== 'observing') return;
        if (k === 'n') this.forge();
        if (k === 'm') this.toggleMute();
        if (k === '0') this.viewSystem();
        if (k === ' ') {
            e.preventDefault();
            this.setWarp(this.warp === 0 ? 1 : 0);
        }
        if (k === 'f') this.toggleFullscreen();
        if (k === '[' || k === ']') {
            const ids = this.system.bodies.filter((b) => b.kind !== 'moon').map((b) => b.id);
            const i = Math.max(0, ids.indexOf(this.focusedId));
            const next = k === ']'
                ? ids[(i + 1) % ids.length]
                : ids[(i - 1 + ids.length) % ids.length];
            this.focusBody(next);
        }
        if (k === '1') this.setWarp(1);
        if (k === '2') this.setWarp(8);
        if (k === '3') this.setWarp(32);
        if (k === '4') this.setWarp(96);
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
        else document.exitFullscreen?.();
    }

    onCanvasClick(e) {
        if (!this.rig.consumeClick()) return;
        const rect = this.canvas.getBoundingClientRect();
        this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.pointer, this.camera);
        const meshes = this.system.bodies.map((b) => b.pickMesh).filter(Boolean);
        const hits = this.raycaster.intersectObjects(meshes, false);
        if (!hits.length) return;
        let obj = hits[0].object;
        while (obj && !obj.userData.bodyId) obj = obj.parent;
        const id = hits[0].object.userData.bodyId || obj?.userData.bodyId;
        if (id) this.focusBody(id);
    }

    resize() {
        if (!this.renderer) return;
        const w = innerWidth;
        const h = innerHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
        this.composer?.setSize(w, h);
        this.bloom?.setSize(w, h);
    }

    loop = () => {
        requestAnimationFrame(this.loop);
        const dt = Math.min(this.clock.getDelta(), 0.05);
        this.simTime += dt * this.warp;
        this.system.update(this.simTime, dt * Math.max(this.warp, 0.15));

        const focused = this.bodyById(this.focusedId);
        if (focused && !this.rig.auto) {
            this.bodyPosition(focused, this.worldPos);
            this.rig.desiredTarget.copy(this.worldPos);
        }

        this.rig.update(dt);
        if (this.composer) this.composer.render();
        else this.renderer.render(this.scene, this.camera);

        if (this.hintTimer > 0) {
            this.hintTimer -= dt;
            if (this.hintTimer <= 0) this.hint.classList.add('is-gone');
        }
    };
}

window.addEventListener('load', () => {
    const app = new Aetherion();
    window.__aetherion = app;
});
