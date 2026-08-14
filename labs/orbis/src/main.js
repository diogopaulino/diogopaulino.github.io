/**
 * Orbis — observatório de sistemas estelares procedurais.
 * Renderer, câmera, picking e atelier de exoplanetas.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { generateSystem, SHOWCASE, SLIDERS } from './catalog.js';
import { StarSystem } from './system.js';
import { clamp, damp, hashString } from './rng.js';

const QUALITY = {
    high: { planetSeg: 96, starSeg: 64, stars: 7000, asteroids: 1400, bloom: true, pr: 2 },
    medium: { planetSeg: 72, starSeg: 48, stars: 4200, asteroids: 800, bloom: true, pr: 1.5 },
    low: { planetSeg: 48, starSeg: 32, stars: 2200, asteroids: 400, bloom: false, pr: 1 }
};

function detectQuality() {
    const mobile = window.matchMedia('(max-width: 820px), (pointer: coarse)').matches;
    const cores = navigator.hardwareConcurrency || 4;
    if (mobile || cores <= 4) return 'low';
    if (cores <= 8) return 'medium';
    return 'high';
}

const $ = (sel) => document.querySelector(sel);

class Orbis {
    constructor() {
        this.canvas = $('#scene');
        this.qualityId = detectQuality();
        this.quality = QUALITY[this.qualityId];
        this.mode = 'system';
        this.focus = 0;
        this.paused = false;
        this.autoRotate = true;
        this.transition = 0;
        this.seed = SHOWCASE[0].seed;
        this.planetPos = new THREE.Vector3();
        this.camOffset = new THREE.Vector3();
        this.follow = new THREE.Vector3();
        this.raycaster = new THREE.Raycaster();
        this.pointer = new THREE.Vector2();
        this.lastTime = performance.now();
        this.fpsFrames = 0;
        this.fpsTime = 0;
        this.dragging = false;
        this.uiHidden = false;
    }

    async init() {
        window.LabShell?.init();

        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: this.qualityId !== 'low',
            alpha: false,
            powerPreference: 'high-performance'
        });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.quality.pr));
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.08;
        this.renderer.setClearColor(0x02040a, 1);

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.08, 200);
        this.camera.position.set(0, 6.4, 14.5);

        this.controls = new OrbitControls(this.camera, this.canvas);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.055;
        this.controls.enablePan = false;
        this.controls.minDistance = 5.5;
        this.controls.maxDistance = 26;
        this.controls.minPolarAngle = 0.18;
        this.controls.maxPolarAngle = Math.PI - 0.22;
        this.controls.autoRotate = true;
        this.controls.autoRotateSpeed = 0.35;
        this.controls.target.set(0, 0, 0);

        this.system = new StarSystem(this.scene, this.quality);

        await this.setupBloom();
        this.buildUi();
        this.bind();
        this.loadSystem(this.seed, false);

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
                0.32,
                0.72,
                0.78
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
        setTimeout(() => el.remove(), 700);
    }

    loadSystem(seed, cinematic = true) {
        this.seed = seed >>> 0;
        this.data = generateSystem(this.seed);
        this.system.rebuild(this.data);
        this.focus = Math.min(this.focus, this.data.planets.length - 1);
        this.enterSystem(cinematic);
        this.renderCatalog();
        this.renderMeta();
        this.syncForge();
        $('#seedValue').textContent = String(this.seed);
        $('#starType').textContent = this.data.star.name;
    }

    enterSystem(cinematic) {
        this.mode = 'system';
        this.controls.minDistance = 5.5;
        this.controls.maxDistance = 28;
        this.controls.autoRotate = this.autoRotate;
        this.system.setOrbitVisible(true);
        this.system.highlight(-1);
        if (cinematic) {
            this.camera.position.set(0, 7.2, 16);
            this.controls.target.set(0, 0, 0);
        }
        document.body.dataset.view = 'system';
        $('#viewLabel').textContent = 'Sistema';
    }

    focusPlanet(index, user = true) {
        if (index < 0 || index >= this.data.planets.length) return;
        this.focus = index;
        this.mode = 'planet';
        this.system.setOrbitVisible(false);
        this.system.highlight(index);
        this.system.getPlanetWorldPos(index, this.planetPos);
        const r = this.system.getPlanetRadius(index);
        this.controls.minDistance = r * 2.15;
        this.controls.maxDistance = r * 9.5;
        this.controls.autoRotate = this.autoRotate;
        if (user) {
            const dir = this.camera.position.clone().sub(this.controls.target).normalize();
            if (dir.lengthSq() < 0.01) dir.set(0.4, 0.25, 1).normalize();
            this.camera.position.copy(this.planetPos).addScaledVector(dir, r * 4.4);
            this.controls.target.copy(this.planetPos);
        }
        document.body.dataset.view = 'planet';
        $('#viewLabel').textContent = 'Órbita próxima';
        this.renderCatalog();
        this.renderMeta();
        this.syncForge();
    }

    buildUi() {
        const rail = $('#presetRail');
        rail.innerHTML = SHOWCASE.map((s) => (
            `<button class="chip" data-seed="${s.seed}" type="button">${s.title}</button>`
        )).join('');

        const sliders = $('#sliders');
        sliders.innerHTML = SLIDERS.map((s) => `
            <label class="slider">
                <span>${s.label}</span>
                <input type="range" min="${s.min}" max="${s.max}" step="${s.step}" data-key="${s.key}" />
            </label>
        `).join('');
    }

    renderCatalog() {
        const list = $('#planetList');
        list.innerHTML = this.data.planets.map((p, i) => {
            const active = i === this.focus && this.mode === 'planet' ? ' is-active' : '';
            const swatch = `rgb(${Math.round(p.landA[0] * 255)} ${Math.round(p.landA[1] * 255)} ${Math.round(p.landA[2] * 255)})`;
            const ocean = `rgb(${Math.round(p.oceanDeep[0] * 255)} ${Math.round(p.oceanDeep[1] * 255)} ${Math.round(p.oceanDeep[2] * 255)})`;
            return `
                <button class="world-card${active}" data-index="${i}" type="button">
                    <span class="world-orb" style="background: radial-gradient(circle at 32% 28%, ${swatch}, ${ocean} 72%)"></span>
                    <span class="world-copy">
                        <strong>${p.name}</strong>
                        <em>${this.data.name}-${p.designation} · ${p.label}</em>
                    </span>
                </button>
            `;
        }).join('');
    }

    renderMeta() {
        $('#systemName').textContent = this.data.name;
        const p = this.data.planets[this.focus];
        if (!p) return;
        $('#planetName').textContent = p.name;
        $('#planetTag').textContent = `${this.data.name}-${p.designation}`;
        $('#planetKind').textContent = p.label;
        $('#planetLore').textContent = p.lore;
        $('#planetCount').textContent = String(this.data.planets.length);
    }

    syncForge() {
        const p = this.data.planets[this.focus];
        if (!p) return;
        SLIDERS.forEach((s) => {
            const input = document.querySelector(`input[data-key="${s.key}"]`);
            if (input) input.value = p[s.key];
        });
    }

    bind() {
        const on = (sel, event, handler) => {
            const el = $(sel);
            if (el) el.addEventListener(event, handler);
        };

        on('#newSystem', 'click', () => {
            this.loadSystem((Math.random() * 0xffffffff) >>> 0);
        });
        on('#seedForm', 'submit', (e) => {
            e.preventDefault();
            const raw = $('#seedInput').value.trim();
            if (!raw) return;
            const seed = /^\d+$/.test(raw) ? Number(raw) : hashString(raw);
            this.loadSystem(seed);
            $('#seedInput').value = '';
        });
        on('#presetRail', 'click', (e) => {
            const btn = e.target.closest('[data-seed]');
            if (!btn) return;
            this.loadSystem(Number(btn.dataset.seed));
        });
        on('#planetList', 'click', (e) => {
            const btn = e.target.closest('[data-index]');
            if (!btn) return;
            this.focusPlanet(Number(btn.dataset.index));
        });
        on('#backSystem', 'click', () => this.enterSystem(true));
        on('#pauseBtn', 'click', () => this.togglePause());
        on('#rotateBtn', 'click', () => this.toggleRotate());
        on('#forgeToggle', 'click', () => {
            const forge = $('#forge');
            const open = forge.hidden;
            forge.hidden = !open;
            forge.classList.toggle('is-open', open);
        });
        on('#fullscreen', 'click', () => this.toggleFullscreen());
        on('#sliders', 'input', (e) => {
            const key = e.target.dataset.key;
            if (!key) return;
            const p = this.data.planets[this.focus];
            p[key] = Number(e.target.value);
            this.system.applyParams(this.focus, p);
        });

        this.canvas.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            this.dragging = false;
            this.ptrStart = { x: e.clientX, y: e.clientY };
        });
        this.canvas.addEventListener('pointermove', (e) => {
            if (!this.ptrStart) return;
            const dx = e.clientX - this.ptrStart.x;
            const dy = e.clientY - this.ptrStart.y;
            if (dx * dx + dy * dy > 16) this.dragging = true;
        });
        this.canvas.addEventListener('pointerup', (e) => {
            const start = this.ptrStart;
            this.ptrStart = null;
            if (!start || this.dragging) return;
            this.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
            this.pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
            this.raycaster.setFromCamera(this.pointer, this.camera);
            const hit = this.system.pick(this.raycaster);
            if (hit >= 0) this.focusPlanet(hit);
        });

        window.addEventListener('keydown', (e) => {
            if (e.target?.matches?.('input, textarea')) return;
            if (e.code === 'Space') {
                e.preventDefault();
                this.togglePause();
            } else if (e.key === 'r' || e.key === 'R') {
                this.loadSystem((Math.random() * 0xffffffff) >>> 0);
            } else if (e.key === 's' || e.key === 'S') {
                this.enterSystem(true);
            } else if (e.key === 'h' || e.key === 'H') {
                this.uiHidden = !this.uiHidden;
                document.body.classList.toggle('ui-hidden', this.uiHidden);
            } else if (e.key === 'f' || e.key === 'F') {
                this.toggleFullscreen();
            } else if (e.key >= '1' && e.key <= '9') {
                this.focusPlanet(Number(e.key) - 1);
            }
        });
    }

    togglePause() {
        this.paused = !this.paused;
        const btn = $('#pauseBtn');
        if (!btn) return;
        btn.setAttribute('aria-pressed', String(this.paused));
        btn.title = this.paused ? 'Retomar (Espaço)' : 'Pausar (Espaço)';
    }

    toggleRotate() {
        this.autoRotate = !this.autoRotate;
        this.controls.autoRotate = this.autoRotate;
        $('#rotateBtn')?.setAttribute('aria-pressed', String(this.autoRotate));
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen?.();
        } else {
            document.exitFullscreen?.();
        }
    }

    resize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
        const pr = Math.min(window.devicePixelRatio, this.quality.pr);
        this.renderer.setPixelRatio(pr);
        this.system.setPixelRatio(pr);
        this.composer?.setSize(w, h);
        this.composer?.setPixelRatio(pr);
    }

    frame() {
        const now = performance.now();
        const dt = clamp((now - this.lastTime) / 1000, 0, 0.05);
        this.lastTime = now;
        this.system.update(dt, this.paused);

        if (this.mode === 'planet') {
            this.system.getPlanetWorldPos(this.focus, this.planetPos);
            this.camOffset.copy(this.camera.position).sub(this.controls.target);
            this.follow.copy(this.controls.target);
            this.follow.x = damp(this.follow.x, this.planetPos.x, 6, dt);
            this.follow.y = damp(this.follow.y, this.planetPos.y, 6, dt);
            this.follow.z = damp(this.follow.z, this.planetPos.z, 6, dt);
            this.controls.target.copy(this.follow);
            this.camera.position.copy(this.follow).add(this.camOffset);
        }

        this.controls.update();
        if (this.composer) this.composer.render();
        else this.renderer.render(this.scene, this.camera);

        this.fpsFrames += 1;
        this.fpsTime += dt;
        if (this.fpsTime >= 0.4) {
            const fpsEl = $('#fps');
            if (fpsEl) fpsEl.textContent = String(Math.round(this.fpsFrames / this.fpsTime));
            this.fpsFrames = 0;
            this.fpsTime = 0;
        }
    }
}

const app = new Orbis();
app.init().catch((err) => {
    console.error(err);
    const el = $('#loading');
    if (el) el.querySelector('p').textContent = 'Não foi possível iniciar o observatório.';
});
