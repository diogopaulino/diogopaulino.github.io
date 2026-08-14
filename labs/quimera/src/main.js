/**
 * Quimera — ateliê 3D de mix-and-match.
 * Loop, câmera, HUD e persistência (hash + localStorage).
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
    KITS, KIT_BY_ID, COMBO_TOTAL, STORAGE_KEY,
    wrapIndex, kitIndex, randomIds, mixTitle, parseHash, toHash
} from './config.js';
import { Character } from './character.js';
import { buildStudio, lightStudio, updateStudio } from './studio.js';
import { StudioAudio } from './audio.js';

const $ = (sel) => document.querySelector(sel);

function detectQuality() {
    const mobile = window.matchMedia('(max-width: 820px), (pointer: coarse)').matches;
    const cores = navigator.hardwareConcurrency || 4;
    try {
        const c = document.createElement('canvas');
        const gl = c.getContext('webgl2') || c.getContext('webgl');
        const info = gl?.getExtension('WEBGL_debug_renderer_info');
        const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) || '') : '';
        if (/swiftshader|llvmpipe|softpipe|microsoft basic render|\bcpu\b/i.test(name)) return 'low';
    } catch { /* ignore */ }
    if (mobile || cores <= 4) return 'low';
    if (cores <= 8) return 'medium';
    return 'high';
}

class Quimera {
    constructor() {
        this.canvas = $('#scene');
        this.quality = detectQuality();
        this.audio = new StudioAudio();
        this.character = new Character();
        this.ids = { head: 'pirate', body: 'sailor', accessory: 'astronaut' };
        this.autoRotate = true;
        this.uiHidden = false;
        this.clock = new THREE.Clock();
        this.raycaster = new THREE.Raycaster();
        this.pointer = new THREE.Vector2();
        this.pointerDown = null;
    }

    init() {
        window.LabShell?.init();
        this._restore();
        this._renderer();
        this._scene();
        this._hud();
        this._events();
        this.applyMix(this.ids, { bounce: false, silent: true });
        $('#loading')?.classList.add('is-done');
        this.loop();
    }

    _restore() {
        const fromHash = parseHash(location.hash);
        if (fromHash) {
            this.ids = fromHash;
            return;
        }
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const saved = JSON.parse(raw);
                if (KIT_BY_ID[saved.head] && KIT_BY_ID[saved.body] && KIT_BY_ID[saved.accessory]) {
                    this.ids = saved;
                }
            }
        } catch { /* ignore */ }
    }

    _persist() {
        const hash = toHash(this.ids);
        history.replaceState(null, '', `#${hash}`);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.ids));
        } catch { /* ignore */ }
    }

    _renderer() {
        const pr = this.quality === 'high' ? 2 : this.quality === 'medium' ? 1.5 : 1;
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: this.quality !== 'low',
            powerPreference: 'high-performance'
        });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pr));
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.05;
        this.renderer.shadowMap.enabled = this.quality !== 'low';
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.setClearColor(0x1b1430, 1);
    }

    _scene() {
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x4a2e58, 8, 22);

        this.camera = new THREE.PerspectiveCamera(34, window.innerWidth / window.innerHeight, 0.1, 40);
        this.camera.position.set(2.4, 1.7, 4.2);

        this.controls = new OrbitControls(this.camera, this.canvas);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.06;
        this.controls.target.set(0, 0.95, 0);
        this.controls.minDistance = 2.4;
        this.controls.maxDistance = 7;
        this.controls.minPolarAngle = 0.55;
        this.controls.maxPolarAngle = 1.42;
        this.controls.autoRotate = this.autoRotate;
        this.controls.autoRotateSpeed = 0.55;
        this.controls.enablePan = false;

        this.studio = buildStudio(this.quality);
        this.scene.add(this.studio.root);
        lightStudio(this.scene);

        this.character.root.position.y = 0.15;
        this.scene.add(this.character.root);
    }

    _hud() {
        this._fillSelect('head');
        this._fillSelect('body');
        this._fillSelect('accessory');
        this._syncHud();

        $('#randomBtn').addEventListener('click', () => this.surprise());
        $('#themeBtn').addEventListener('click', () => this.fullSet());
        $('#muteBtn').addEventListener('click', () => this.toggleMute());
        $('#rotateBtn').addEventListener('click', () => this.toggleRotate());
        $('#fullscreen').addEventListener('click', () => this.toggleFullscreen());

        document.querySelectorAll('[data-step]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const slot = btn.dataset.slot;
                const dir = Number(btn.dataset.step);
                this.step(slot, dir);
            });
        });

        document.querySelectorAll('[data-slot-select]').forEach((sel) => {
            sel.addEventListener('change', () => {
                const slot = sel.dataset.slotSelect;
                this.ids[slot] = sel.value;
                this.applyMix(this.ids);
            });
        });
    }

    _fillSelect(slot) {
        const sel = document.querySelector(`[data-slot-select="${slot}"]`);
        sel.innerHTML = KITS.map((k) => `<option value="${k.id}">${k.emoji} ${k.name}</option>`).join('');
    }

    _syncHud() {
        const title = mixTitle(this.ids);
        $('#mixKicker').textContent = title.kicker;
        $('#mixTitle').textContent = title.title;
        $('#comboRead').textContent = COMBO_TOTAL.toLocaleString('pt-BR');
        ['head', 'body', 'accessory'].forEach((slot) => {
            const kit = KIT_BY_ID[this.ids[slot]];
            const sel = document.querySelector(`[data-slot-select="${slot}"]`);
            if (sel) sel.value = kit.id;
            const label = document.querySelector(`[data-slot-label="${slot}"]`);
            if (label) label.textContent = `${kit.emoji} ${kit.name}`;
        });
        $('#rotateBtn')?.setAttribute('aria-pressed', String(this.autoRotate));
        $('#muteBtn')?.setAttribute('aria-pressed', String(!this.audio.enabled));
    }

    applyMix(ids, { bounce = true, silent = false } = {}) {
        this.ids = { ...ids };
        this.character.setMix(this.ids, { bounce });
        this._persist();
        this._syncHud();
        if (!silent) this.audio.pluck(1);
    }

    step(slot, dir) {
        const i = wrapIndex(kitIndex(this.ids[slot]) + dir);
        this.ids[slot] = KITS[i].id;
        this.character.setMix(this.ids, { bounce: true });
        this._persist();
        this._syncHud();
        this.audio.pluck(slot === 'head' ? 0 : slot === 'body' ? 1 : 2);
        this.audio.resume();
    }

    surprise() {
        this.audio.resume();
        this.applyMix(randomIds(true));
        this.audio.pluck(0);
    }

    fullSet() {
        this.audio.resume();
        const kit = KITS[Math.floor(Math.random() * KITS.length)];
        this.applyMix({ head: kit.id, body: kit.id, accessory: kit.id });
    }

    toggleMute() {
        this.audio.resume();
        this.audio.setEnabled(!this.audio.enabled);
        this._syncHud();
    }

    toggleRotate() {
        this.autoRotate = !this.autoRotate;
        this.controls.autoRotate = this.autoRotate;
        this._syncHud();
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
        else document.exitFullscreen?.();
    }

    _events() {
        window.addEventListener('resize', () => this._onResize());
        window.addEventListener('hashchange', () => {
            const ids = parseHash(location.hash);
            if (ids) this.applyMix(ids, { silent: true });
        });

        const wake = () => this.audio.resume();
        window.addEventListener('pointerdown', wake, { once: true });
        window.addEventListener('keydown', wake, { once: true });

        this.canvas.addEventListener('pointerdown', (e) => {
            this.pointerDown = { x: e.clientX, y: e.clientY, t: performance.now() };
        });
        this.canvas.addEventListener('pointerup', (e) => {
            if (!this.pointerDown) return;
            const dx = e.clientX - this.pointerDown.x;
            const dy = e.clientY - this.pointerDown.y;
            const dt = performance.now() - this.pointerDown.t;
            this.pointerDown = null;
            if (dt > 400 || dx * dx + dy * dy > 64) return;
            this._pick(e);
        });

        window.addEventListener('keydown', (e) => {
            if (e.target.closest?.('input, select, textarea')) return;
            const k = e.key.toLowerCase();
            if (k === 'arrowleft' || k === 'a') this.step('head', -1);
            else if (k === 'arrowright' || k === 'd') this.step('head', 1);
            else if (k === 'arrowup' || k === 'w') this.step('body', -1);
            else if (k === 'arrowdown' || k === 's') this.step('body', 1);
            else if (k === 'q') this.step('accessory', -1);
            else if (k === 'e') this.step('accessory', 1);
            else if (k === 'r') this.surprise();
            else if (k === 't') this.fullSet();
            else if (k === 'm') this.toggleMute();
            else if (k === 'h') this._toggleUi();
            else if (k === 'f') this.toggleFullscreen();
        });
    }

    _toggleUi() {
        this.uiHidden = !this.uiHidden;
        document.body.classList.toggle('ui-hidden', this.uiHidden);
    }

    _pick(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.pointer, this.camera);
        const hits = this.raycaster.intersectObject(this.character.root, true);
        const slot = hits.find((h) => h.object.userData.slot)?.object.userData.slot;
        if (slot) this.step(slot, 1);
    }

    _onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    loop() {
        const dt = Math.min(0.05, this.clock.getDelta());
        const t = this.clock.elapsedTime;
        this.controls.update();
        this.character.update(dt, t);
        updateStudio(this.studio, t);
        this.renderer.render(this.scene, this.camera);
        requestAnimationFrame(() => this.loop());
    }
}

const app = new Quimera();
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => app.init(), { once: true });
} else {
    app.init();
}
