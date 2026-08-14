/**
 * Armilla — esfera armilar musical.
 * Renderer, picking, HUD e o loop que liga órbita a nota.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
    PRESETS, RING_DEFS, SCALE_LABELS, ROOT_NAMES, STORAGE_KEY,
    clonePattern, randomPattern, emptyPattern, pitchFor, noteName, ROOTS
} from './config.js';
import { ArmillaSphere } from './sphere.js';
import { SphereAudio } from './audio.js';

const QUALITY = {
    high: { stars: 2800, dust: 420, burst: 18, bloom: true, pr: 2 },
    medium: { stars: 1600, dust: 240, burst: 12, bloom: true, pr: 1.5 },
    low: { stars: 700, dust: 90, burst: 6, bloom: false, pr: 1 }
};

function detectSoftwareGL() {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        if (!gl) return true;
        const info = gl.getExtension('WEBGL_debug_renderer_info');
        const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) || '') : '';
        return /swiftshader|llvmpipe|softpipe|microsoft basic render|\bcpu\b/i.test(name);
    } catch {
        return false;
    }
}

function detectQuality() {
    const mobile = window.matchMedia('(max-width: 820px), (pointer: coarse)').matches;
    const cores = navigator.hardwareConcurrency || 4;
    if (detectSoftwareGL() || mobile || cores <= 4) return 'low';
    if (cores <= 8) return 'medium';
    return 'high';
}

const $ = (sel) => document.querySelector(sel);

class Armilla {
    constructor() {
        this.canvas = $('#scene');
        this.qualityId = detectQuality();
        this.quality = QUALITY[this.qualityId];
        this.audio = new SphereAudio();
        this.playing = true;
        this.autoRotate = true;
        this.uiHidden = false;
        this.presetId = PRESETS[0].id;
        this.scale = PRESETS[0].scale;
        this.root = PRESETS[0].root;
        this.bpm = PRESETS[0].bpm;
        this.pattern = clonePattern(PRESETS[0].rings);
        this.lastNote = '—';
        this.selected = 2;
        this.dragging = false;
        this.pointer = new THREE.Vector2();
        this.raycaster = new THREE.Raycaster();
        this.lastTime = performance.now();
        this.fpsFrames = 0;
        this.fpsTime = 0;
    }

    async init() {
        window.LabShell?.init();
        this._restore();

        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: this.qualityId !== 'low',
            alpha: false,
            powerPreference: 'high-performance'
        });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.quality.pr));
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.12;
        this.renderer.setClearColor(0x05030c, 1);

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.12, 140);
        this.camera.position.set(2.8, 3.6, 9.4);

        this.scene.add(new THREE.AmbientLight(0x6a5a88, 0.38));
        const key = new THREE.DirectionalLight(0xffe0c0, 0.55);
        key.position.set(4, 8, 6);
        this.scene.add(key);
        const fill = new THREE.DirectionalLight(0x7ea8ff, 0.22);
        fill.position.set(-6, -2, -4);
        this.scene.add(fill);

        this.sphere = new ArmillaSphere(this.scene, this.quality);
        this.sphere.setPattern(this.pattern);
        this.sphere.setSelected(this.selected);

        this.controls = new OrbitControls(this.camera, this.canvas);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.06;
        this.controls.minDistance = 4.2;
        this.controls.maxDistance = 18;
        this.controls.autoRotate = this.autoRotate;
        this.controls.autoRotateSpeed = 0.45;
        this.controls.target.set(0, 0, 0);

        await this.setupBloom();
        this.bind();
        this.renderHud();
        this.audio.setDroneRoot(ROOTS[this.root] || 0);

        this.renderer.compile(this.scene, this.camera);
        this.hideLoading();

        window.addEventListener('resize', () => this.resize());
        this.renderer.setAnimationLoop(() => this.frame());
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
            composer.setSize(window.innerWidth, window.innerHeight);
            composer.addPass(new RenderPass(this.scene, this.camera));
            const bloom = new UnrealBloomPass(
                new THREE.Vector2(window.innerWidth, window.innerHeight),
                0.42,
                0.68,
                0.72
            );
            composer.addPass(bloom);
            composer.addPass(new OutputPass());
            this.composer = composer;
            this.bloom = bloom;
        } catch {
            this.composer = null;
        }
    }

    hideLoading() {
        const el = $('#loading');
        if (!el) return;
        el.classList.add('is-done');
        setTimeout(() => el.remove(), 800);
    }

    bind() {
        const wake = () => {
            this.audio.resume();
            const hint = $('#listenHint');
            if (hint && !hint.classList.contains('is-gone')) {
                hint.classList.add('is-gone');
                setTimeout(() => hint.remove(), 500);
            }
        };
        window.addEventListener('pointerdown', wake);
        window.addEventListener('keydown', wake);

        this.canvas.addEventListener('pointermove', (e) => this.onMove(e));
        this.canvas.addEventListener('pointerdown', (e) => {
            this.dragStart = { x: e.clientX, y: e.clientY };
            this.dragging = false;
        });
        this.canvas.addEventListener('pointerup', (e) => this.onUp(e));
        this.controls.addEventListener('start', () => { this.dragging = true; });

        $('#playBtn').addEventListener('click', () => this.togglePlay());
        $('#rotateBtn').addEventListener('click', () => this.toggleRotate());
        $('#muteBtn').addEventListener('click', () => this.toggleMute());
        $('#fullscreen').addEventListener('click', () => this.toggleFullscreen());
        $('#randomBtn').addEventListener('click', () => this.randomize());
        $('#clearBtn').addEventListener('click', () => this.clear());

        $('#scaleSelect').addEventListener('change', (e) => {
            this.scale = e.target.value;
            this.presetId = 'custom';
            this.renderHud();
            this.persist();
        });
        $('#rootSelect').addEventListener('change', (e) => {
            this.root = e.target.value;
            this.audio.setDroneRoot(ROOTS[this.root] || 0);
            this.presetId = 'custom';
            this.renderHud();
            this.persist();
        });
        $('#tempo').addEventListener('input', (e) => {
            this.bpm = Number(e.target.value);
            $('#tempoVal').textContent = `${this.bpm}`;
            this.presetId = 'custom';
            this.persist();
        });

        window.addEventListener('keydown', (e) => this.onKey(e));
    }

    hitFromEvent(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.pointer, this.camera);
        return this.sphere.pick(this.raycaster);
    }

    onMove(e) {
        const hit = this.hitFromEvent(e);
        this.sphere.setHover(hit);
        this.canvas.classList.toggle('is-hover', !!hit);
        if (hit) {
            const def = RING_DEFS[hit.ring];
            const midi = pitchFor(def, hit.step, this.scale, this.root);
            $('#tooltip').hidden = false;
            $('#tooltip').textContent = `${def.role} · passo ${hit.step + 1} · ${noteName(midi)}`;
        } else {
            $('#tooltip').hidden = true;
        }
    }

    onUp(e) {
        const dx = e.clientX - (this.dragStart?.x || 0);
        const dy = e.clientY - (this.dragStart?.y || 0);
        if (Math.hypot(dx, dy) > 6) return;
        const hit = this.hitFromEvent(e);
        if (!hit) return;
        this.audio.resume();
        this.selected = hit.ring;
        this.sphere.setSelected(hit.ring);
        const on = this.sphere.toggleStep(hit.ring, hit.step);
        this.pattern = this.sphere.pattern;
        if (on) {
            const def = RING_DEFS[hit.ring];
            const midi = pitchFor(def, hit.step, this.scale, this.root);
            this.audio.play(hit.ring, midi, 0.9);
            this.sphere.flash(hit.ring, hit.step);
            this.lastNote = noteName(midi);
        }
        this.presetId = 'custom';
        this.renderHud();
        this.persist();
    }

    onKey(e) {
        if (e.target.matches('input, select, textarea')) return;
        const k = e.key.toLowerCase();
        if (k === ' ') {
            e.preventDefault();
            this.togglePlay();
        } else if (k === 'm') this.toggleMute();
        else if (k === 'r') this.randomize();
        else if (k === 'c') this.clear();
        else if (k === 'h') this.toggleUi();
        else if (k === 'f') this.toggleFullscreen();
        else if (k === 'a') this.toggleRotate();
        else if (k >= '1' && k <= '4') {
            this.selected = Number(k) - 1;
            this.sphere.setSelected(this.selected);
            this.renderHud();
        } else if (k === '[') this.nudgeTempo(-4);
        else if (k === ']') this.nudgeTempo(4);
    }

    nudgeTempo(d) {
        this.bpm = Math.max(48, Math.min(140, this.bpm + d));
        $('#tempo').value = String(this.bpm);
        $('#tempoVal').textContent = `${this.bpm}`;
        this.persist();
    }

    togglePlay() {
        this.playing = !this.playing;
        this.audio.resume();
        this.renderHud();
    }

    toggleRotate() {
        this.autoRotate = !this.autoRotate;
        this.controls.autoRotate = this.autoRotate;
        $('#rotateBtn').setAttribute('aria-pressed', this.autoRotate ? 'true' : 'false');
    }

    toggleMute() {
        const on = !this.audio.enabled;
        this.audio.setEnabled(on);
        $('#muteBtn').setAttribute('aria-pressed', on ? 'false' : 'true');
        $('#muteBtn').classList.toggle('is-muted', !on);
    }

    toggleUi() {
        this.uiHidden = !this.uiHidden;
        document.body.classList.toggle('ui-hidden', this.uiHidden);
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
        else document.exitFullscreen?.();
    }

    applyPreset(id) {
        const preset = PRESETS.find((p) => p.id === id) || PRESETS[0];
        this.presetId = preset.id;
        this.scale = preset.scale;
        this.root = preset.root;
        this.bpm = preset.bpm;
        this.pattern = clonePattern(preset.rings);
        this.sphere.setPattern(this.pattern);
        this.audio.setDroneRoot(ROOTS[this.root] || 0);
        this.renderHud();
        this.persist();
    }

    randomize() {
        this.pattern = randomPattern();
        this.sphere.setPattern(this.pattern);
        this.presetId = 'custom';
        this.renderHud();
        this.persist();
    }

    clear() {
        this.pattern = emptyPattern();
        this.sphere.setPattern(this.pattern);
        this.presetId = 'void';
        this.renderHud();
        this.persist();
    }

    toggleRingMute(index) {
        const next = !this.audio.muted[index];
        this.audio.setMuteRing(index, next);
        this.sphere.setMuted(index, next);
        this.renderHud();
    }

    renderHud() {
        $('#playBtn').setAttribute('aria-pressed', this.playing ? 'true' : 'false');
        $('#playBtn').title = this.playing ? 'Pausar (Espaço)' : 'Tocar (Espaço)';
        $('#playIconPause').style.display = this.playing ? '' : 'none';
        $('#playIconPlay').style.display = this.playing ? 'none' : '';
        $('#rotateBtn').setAttribute('aria-pressed', this.autoRotate ? 'true' : 'false');

        const preset = PRESETS.find((p) => p.id === this.presetId);
        $('#presetName').textContent = preset ? preset.name : 'Livre';
        $('#presetTag').textContent = preset ? preset.tag : 'Composição sua';
        $('#noteNow').textContent = this.lastNote;
        $('#bpmRead').textContent = `${this.bpm} BPM`;
        $('#modeRead').textContent = `${this.root} ${SCALE_LABELS[this.scale] || this.scale}`;

        $('#scaleSelect').value = this.scale;
        $('#rootSelect').value = this.root;
        $('#tempo').value = String(this.bpm);
        $('#tempoVal').textContent = `${this.bpm}`;

        const rail = $('#presetRail');
        rail.innerHTML = '';
        PRESETS.forEach((p) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'chip' + (p.id === this.presetId ? ' is-on' : '');
            btn.textContent = p.name;
            btn.addEventListener('click', () => this.applyPreset(p.id));
            rail.appendChild(btn);
        });

        const list = $('#layerList');
        list.innerHTML = '';
        RING_DEFS.forEach((def, i) => {
            const count = this.pattern[i].reduce((a, b) => a + b, 0);
            const row = document.createElement('button');
            row.type = 'button';
            row.className = 'layer' + (this.selected === i ? ' is-on' : '') + (this.audio.muted[i] ? ' is-muted' : '');
            row.innerHTML = `
                <span class="swatch" style="--c:${def.color}"></span>
                <span class="layer-meta">
                    <strong>${def.name}</strong>
                    <em>${def.role} · ${count} estrelas</em>
                </span>
                <span class="layer-key">${i + 1}</span>
            `;
            row.addEventListener('click', () => {
                this.selected = i;
                this.sphere.setSelected(i);
                this.renderHud();
            });
            row.addEventListener('dblclick', (e) => {
                e.preventDefault();
                this.toggleRingMute(i);
            });
            list.appendChild(row);
        });
    }

    persist() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                presetId: this.presetId,
                scale: this.scale,
                root: this.root,
                bpm: this.bpm,
                pattern: this.pattern
            }));
        } catch { /* ignore */ }
    }

    _restore() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const data = JSON.parse(raw);
            if (data.scale) this.scale = data.scale;
            if (data.root) this.root = data.root;
            if (data.bpm) this.bpm = data.bpm;
            if (data.presetId) this.presetId = data.presetId;
            if (Array.isArray(data.pattern) && data.pattern.length === 4) {
                this.pattern = data.pattern.map((row) => row.slice(0, 16));
            }
        } catch { /* ignore */ }
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
        const now = performance.now();
        const dt = Math.min(0.05, (now - this.lastTime) / 1000);
        this.lastTime = now;

        this.fpsFrames++;
        this.fpsTime += dt;
        if (this.fpsTime >= 0.5) {
            $('#fps').textContent = `${Math.round(this.fpsFrames / this.fpsTime)}`;
            this.fpsFrames = 0;
            this.fpsTime = 0;
        }

        this.controls.update();
        const triggers = this.sphere.update(dt, this.playing, this.bpm);
        triggers.forEach(({ ring, step }) => {
            const def = RING_DEFS[ring];
            const midi = pitchFor(def, step, this.scale, this.root);
            this.audio.play(ring, midi, 0.85);
            this.sphere.flash(ring, step);
            this.lastNote = noteName(midi);
            const noteEl = $('#noteNow');
            if (noteEl) noteEl.textContent = this.lastNote;
        });

        if (this.composer) this.composer.render();
        else this.renderer.render(this.scene, this.camera);
    }
}

const app = new Armilla();
app.init().catch((err) => {
    console.error(err);
    const el = $('#loading');
    if (el) el.innerHTML = '<p>Não foi possível acordar as esferas.</p>';
});
