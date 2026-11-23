import { detectSoftwareGL } from '../../shared/gfx/capabilities.js';
/**
 * Orbis — observatório do Sistema Solar.
 * Renderer, câmera, relógio da simulação, picking, painel de dados e atelier.
 *
 * Relógio: `simDays` = dias desde J2000.0 (começa "agora", em UTC). A cada
 * quadro avança `taxa × sentido × dt`, com dt real limitado a 0,05 s. A taxa
 * é discreta (tempo real … 1 ano/s). Como as posições são função da data
 * (Kepler analítico), pausar, inverter e saltar de data são exatos.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { generateSystem, SHOWCASE, SLIDERS, moonLine } from './catalog.js?v=5';
import { StarSystem } from './system.js?v=6';
import { daysSinceJ2000, msFromDays, AU, LIGHT_SPEED } from './kepler.js?v=1';
import { clamp } from './rng.js';

const QUALITY = {
    high: { planetSeg: 64, starSeg: 48, stars: 4000, asteroids: 900, bloom: true, pr: 1.75, antialias: true },
    medium: { planetSeg: 56, starSeg: 40, stars: 3000, asteroids: 700, bloom: true, pr: 1.5, antialias: true },
    low: { planetSeg: 48, starSeg: 32, stars: 2200, asteroids: 450, bloom: false, pr: 1.25, antialias: false }
};

/* Taxas do relógio, em dias simulados por segundo real. */
const RATES = [
    { label: 'Tempo real', short: '1 s/s', d: 1 / 86400 },
    { label: '1 minuto/s', short: '1 min/s', d: 1 / 1440 },
    { label: '1 hora/s', short: '1 h/s', d: 1 / 24 },
    { label: '1 dia/s', short: '1 dia/s', d: 1 },
    { label: '1 semana/s', short: '1 sem/s', d: 7 },
    { label: '1 mês/s', short: '1 mês/s', d: 365.2425 / 12 },   // mês gregoriano médio
    { label: '1 ano/s', short: '1 ano/s', d: 365.25 }            // ano juliano
];
const DEFAULT_RATE = 3;

/* Limites do relógio: anos 1000–3000. Os elementos do JPL valem 1800–2050;
   fora disso as posições são aproximadas (aviso no HUD). */
const MIN_DAYS = daysSinceJ2000(Date.UTC(1000, 0, 1));
const MAX_DAYS = daysSinceJ2000(Date.UTC(2999, 11, 31));
const VALID_FROM = daysSinceJ2000(Date.UTC(1800, 0, 1));
const VALID_TO = daysSinceJ2000(Date.UTC(2050, 11, 31));

const STORE_KEY = 'orbis:settings:v2';
const LOAD_TIMEOUT = 12000;

const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const narrow = () => window.matchMedia('(max-width: 860px)').matches;

function detectQuality() {
    const mobile = window.matchMedia('(max-width: 820px), (pointer: coarse)').matches;
    const cores = navigator.hardwareConcurrency || 4;
    if (detectSoftwareGL() || mobile || cores <= 4) return 'low';
    if (cores <= 8) return 'medium';
    return 'high';
}

function loadSettings() {
    try {
        const raw = localStorage.getItem(STORE_KEY);
        return raw ? JSON.parse(raw) || {} : {};
    } catch {
        return {};
    }
}

function saveSettings(s) {
    try {
        localStorage.setItem(STORE_KEY, JSON.stringify(s));
    } catch { /* modo privado / cota: segue sem persistir */ }
}

const $ = (sel) => document.querySelector(sel);
const nf = (digits, min = 0) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: digits, minimumFractionDigits: min });
const fmt0 = nf(0);
const fmt1 = nf(1, 1);
const fmt2 = nf(2, 2);
const fmt3 = nf(3, 3);
const fmt4 = nf(4, 4);
const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };

function sci(value, unit) {
    const exp = Math.floor(Math.log10(Math.abs(value)));
    const mant = value / 10 ** exp;
    return `${fmt3.format(mant)} × 10${String(exp).split('').map((c) => SUP[c]).join('')} ${unit}`;
}

function fmtPeriod(days) {
    if (days < 2) return `${fmt2.format(days * 24)} h`;
    const yrs = days / 365.25;
    return yrs >= 1.5 ? `${fmt2.format(days)} d · ${fmt2.format(yrs)} anos` : `${fmt2.format(days)} d`;
}

function fmtRotation(Wd) {
    const hours = (360 / Math.abs(Wd)) * 24;
    const txt = hours < 72 ? `${fmt2.format(hours)} h` : `${fmt2.format(hours / 24)} d`;
    return Wd < 0 ? `${txt} (retrógrada)` : txt;
}

function fmtLight(au) {
    const s = (au * AU) / LIGHT_SPEED;
    if (s < 3600) return `${Math.floor(s / 60)} min ${String(Math.round(s % 60)).padStart(2, '0')} s`;
    return `${Math.floor(s / 3600)} h ${String(Math.round((s % 3600) / 60)).padStart(2, '0')} min`;
}

function easeInOut(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

class Orbis {
    constructor() {
        this.canvas = $('#scene');
        this.qualityId = detectQuality();
        this.quality = QUALITY[this.qualityId];
        const s = loadSettings();
        this.settings = {
            rate: Number.isInteger(s.rate) && s.rate >= 0 && s.rate < RATES.length ? s.rate : (reduceMotion ? 2 : DEFAULT_RATE),
            dir: s.dir === -1 ? -1 : 1,
            autoRotate: typeof s.autoRotate === 'boolean' ? s.autoRotate : !reduceMotion,
            labels: s.labels !== false,
            orbits: s.orbits !== false,
            scaleReal: s.scaleReal === true,
            // Painel aberto/fechado é lembrado separado para celular e desktop.
            infoOpenNarrow: typeof s.infoOpenNarrow === 'boolean' ? s.infoOpenNarrow : false,
            infoOpenWide: typeof s.infoOpenWide === 'boolean' ? s.infoOpenWide : true
        };
        this.mode = 'system';
        this.focus = -1;        // −1 = Sol
        this.paused = false;
        this.simDays = daysSinceJ2000(Date.now());
        this.seed = SHOWCASE[0].seed;

        this.planetPos = new THREE.Vector3();
        this.tmp = new THREE.Vector3();
        this.tmp2 = new THREE.Vector3();
        this.fly = {
            active: false, t: 0, dur: 0.9, index: -1, toDist: 10,
            fromTarget: new THREE.Vector3(), dir: new THREE.Vector3(), fromDist: 10
        };
        this.helio = { x: 0, y: 0, z: 0, r: 0, v: 0 };
        this.earth = { x: 0, y: 0, z: 0, r: 0, v: 0 };
        this.lastTime = performance.now();
        this.fpsFrames = 0;
        this.fpsTime = 0;
        this.hudTime = 0;
        this.dragging = false;
        this.uiHidden = false;
        this.loopErrors = 0;
        this.labelEls = [];
        this.labelState = [];
        this.text = new Map();
        this.dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
        this.timeFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'UTC' });
    }

    async init() {
        window.LabShell?.init();
        this.loadTimer = setTimeout(() => this.showLoadProblem('O observatório está demorando para abrir.'), LOAD_TIMEOUT);

        try {
            this.renderer = new THREE.WebGLRenderer({
                canvas: this.canvas,
                antialias: !!this.quality.antialias,
                alpha: false,
                powerPreference: 'high-performance'
            });
        } catch (err) {
            console.warn(err);
            this.showLoadProblem('Seu navegador não conseguiu iniciar o WebGL. Ative a aceleração de hardware e tente de novo.');
            return;
        }
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.quality.pr, 2));
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.08;
        this.renderer.setClearColor(0x02040a, 1);

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.02, 1200);
        this.camera.position.set(0, 9, 20);

        this.controls = new OrbitControls(this.camera, this.canvas);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.06;
        this.controls.enablePan = false;
        this.controls.minDistance = 2.6;
        this.controls.maxDistance = 70;
        this.controls.minPolarAngle = 0.05;
        this.controls.maxPolarAngle = Math.PI - 0.05;
        this.controls.autoRotate = this.settings.autoRotate;
        this.controls.autoRotateSpeed = 0.3;
        this.controls.target.set(0, 0, 0);

        this.system = new StarSystem(this.scene, this.quality);
        this.system.setScaleMode(this.settings.scaleReal, true);
        this.system.setOrbitVisible(this.settings.orbits);

        // Bloom é opcional: se o import travar, seguimos sem ele após 4 s.
        await Promise.race([this.setupBloom(), new Promise((r) => setTimeout(r, 4000))]);
        this.buildUi();
        this.bind();
        this.loadSystem(this.seed, false);
        this.system.update(this.simDays, 0, 0);
        this.enterSystem(false);

        this.renderer.compile(this.scene, this.camera);
        this.hideLoading();

        // Altura real do relógio → CSS (--dock-h), para os painéis não o cobrirem.
        const dock = $('.dock');
        if (dock && 'ResizeObserver' in window) {
            new ResizeObserver(() => {
                document.documentElement.style.setProperty('--dock-h', `${Math.ceil(dock.offsetHeight)}px`);
                this.updateViewOffset();
            }).observe(dock);
        }

        if (window.LabRuntime) LabRuntime.debounceResize(() => this.resize());
        else window.addEventListener('resize', () => this.resize());
        this._renderLoop = () => this.frame();
        if (window.LabRuntime) {
            LabRuntime.bindThreeLoop(this.renderer, this._renderLoop);
        } else {
            this.renderer.setAnimationLoop(this._renderLoop);
            document.addEventListener('visibilitychange', () => {
                this.renderer.setAnimationLoop(document.hidden ? null : this._renderLoop);
            });
        }
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) this.lastTime = performance.now();
        });
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
        clearTimeout(this.loadTimer);
        const el = $('#loading');
        if (!el) return;
        el.classList.add('is-done');
        setTimeout(() => el.remove(), 700);
    }

    showLoadProblem(message) {
        const el = $('#loading');
        if (!el || el.classList.contains('is-done')) return;
        el.classList.add('has-error');
        const p = el.querySelector('p');
        if (p) p.textContent = message;
        const retry = $('#retryBtn');
        if (retry) retry.hidden = false;
    }

    loadSystem(seed, cinematic = true) {
        this.seed = seed >>> 0;
        this.data = generateSystem(this.seed);
        this.system.rebuild(this.data);
        this.buildLabels();
        this.renderCatalog();
        this.renderMeta();
        this.syncForge();
        if (cinematic) this.enterSystem(true);
    }

    /* ---------- câmera ---------- */

    /** Distância para enquadrar um raio R (cena), respeitando o FOV horizontal no retrato. */
    fitDistance(R) {
        const vHalf = (this.camera.fov * Math.PI) / 360;
        const hHalf = Math.atan(Math.tan(vHalf) * this.camera.aspect);
        return (R / Math.tan(Math.min(vHalf, hHalf))) * 1.04;
    }

    systemRadius() {
        // Até o afélio de Júpiter. Comprimida: (1,2 + 4,55·√5,2)·1,048 ≈ 12,1. Real: 2,6·5,45 ≈ 14,2.
        return this.settings.scaleReal ? 14.5 : 12.4;
    }

    startFly(index, toDist) {
        const f = this.fly;
        f.active = true;
        f.t = 0;
        f.dur = reduceMotion ? 0 : 0.95;
        f.index = index;
        f.toDist = toDist;
        f.fromTarget.copy(this.controls.target);
        f.dir.copy(this.camera.position).sub(this.controls.target);
        f.fromDist = f.dir.length() || 10;
        f.dir.normalize();
        if (index < 0 && f.dir.y < 0.3) {
            f.dir.y = 0.45;
            f.dir.normalize();
        }
        this.controls.minDistance = 0.001;
        this.controls.maxDistance = Infinity;
    }

    finishFly() {
        const f = this.fly;
        f.active = false;
        if (f.index < 0) {
            const fit = this.fitDistance(this.systemRadius());
            this.controls.minDistance = this.settings.scaleReal ? 0.9 : 2.6;
            this.controls.maxDistance = Math.max(fit * 2.6, this.settings.scaleReal ? 260 : 70);
        } else {
            const r = this.system.getPlanetRadius(f.index);
            this.controls.minDistance = r * 1.9;
            this.controls.maxDistance = r * 40;
        }
    }

    updateCamera(dt) {
        const f = this.fly;
        this.system.getPlanetWorldPos(this.mode === 'planet' ? this.focus : -1, this.planetPos);
        if (f.active) {
            f.t += dt;
            const k = f.dur > 0 ? easeInOut(Math.min(1, f.t / f.dur)) : 1;
            this.controls.target.lerpVectors(f.fromTarget, this.planetPos, k);
            const dist = f.fromDist + (f.toDist - f.fromDist) * k;
            this.camera.position.copy(this.controls.target).addScaledVector(f.dir, dist);
            if (k >= 1) this.finishFly();
            return;
        }
        if (this.mode === 'planet') {
            // Trava exata no planeta: câmera e alvo andam juntos com a órbita.
            this.tmp.copy(this.planetPos).sub(this.controls.target);
            this.controls.target.add(this.tmp);
            this.camera.position.add(this.tmp);
        }
    }

    enterSystem(cinematic = true) {
        this.mode = 'system';
        this.focus = -1;
        this.controls.autoRotate = this.settings.autoRotate;
        this.system.setSolo(-1);
        const dist = this.fitDistance(this.systemRadius());
        if (cinematic) {
            this.startFly(-1, dist);
        } else {
            this.controls.target.set(0, 0, 0);
            this.camera.position.set(0, dist * 0.42, dist * 0.91);
            this.fly.index = -1;
            this.finishFly();
        }
        this.camera.near = this.settings.scaleReal ? 0.01 : 0.02;
        this.camera.updateProjectionMatrix();
        document.body.dataset.view = 'system';
        this.renderCatalog();
        this.renderMeta();
        this.closeForge();
    }

    focusPlanet(index) {
        if (!this.data || index < 0 || index >= this.data.planets.length) {
            this.enterSystem(true);
            return;
        }
        this.focus = index;
        this.mode = 'planet';
        this.system.setSolo(index);
        const r = this.system.getPlanetRadius(index);
        this.controls.autoRotate = this.settings.autoRotate;
        this.camera.near = Math.max(0.002, r * 0.08);
        this.camera.updateProjectionMatrix();
        this.startFly(index, r * (narrow() ? 6.2 : 4.6));
        document.body.dataset.view = 'planet';
        this.renderCatalog();
        this.renderMeta();
        this.syncForge();
    }

    /* ---------- UI ---------- */

    buildUi() {
        const sliders = $('#sliders');
        sliders.innerHTML = SLIDERS.map((s) => `
            <label class="slider">
                <span>${s.label}</span>
                <input type="range" min="${s.min}" max="${s.max}" step="${s.step}" data-key="${s.key}" />
            </label>
        `).join('');
        this.syncToggles();
        this.syncClockUi();
        this.setInfoOpen(this.infoOpen(), false);
        const input = $('#dateInput');
        if (input) {
            input.min = '1000-01-01';
            input.max = '2999-12-31';
        }
    }

    buildLabels() {
        const layer = $('#labels');
        if (!layer) return;
        const names = ['Sol', ...this.data.planets.map((p) => p.name)];
        layer.innerHTML = names.map((n, i) => (
            `<button class="body-label${i === 0 ? ' is-sun' : ''}" type="button" tabindex="-1" data-index="${i - 1}"><span>${n}</span></button>`
        )).join('');
        this.labelEls = Array.from(layer.children);
        this.labelState = this.labelEls.map((el, i) => ({
            x: -1e4, y: -1e4, cx: 0, cy: 0, ok: false, shown: true,
            w: names[i].length * 6.8 + 20 // largura estimada do rótulo (px), sem medir o DOM
        }));
        // Prioridade na colisão: planetas de dentro para fora; o Sol por último.
        this.labelOrder = this.labelEls.map((_, i) => i).slice(1).concat(0);
    }

    renderCatalog() {
        const list = $('#planetList');
        const sunActive = this.mode === 'system' ? ' is-active' : '';
        const sun = `
            <button class="world-card${sunActive}" data-index="-1" type="button" aria-current="${this.mode === 'system'}">
                <span class="world-orb is-sun"></span>
                <span class="world-copy"><strong>Sol</strong><em>Estrela G2V · ${this.data.planets.length} planetas</em></span>
            </button>`;
        list.innerHTML = sun + this.data.planets.map((p, i) => {
            const on = i === this.focus && this.mode === 'planet';
            const swatch = `rgb(${Math.round(p.landA[0] * 255)} ${Math.round(p.landA[1] * 255)} ${Math.round(p.landA[2] * 255)})`;
            const ocean = `rgb(${Math.round(p.oceanDeep[0] * 255)} ${Math.round(p.oceanDeep[1] * 255)} ${Math.round(p.oceanDeep[2] * 255)})`;
            return `
                <button class="world-card${on ? ' is-active' : ''}" data-index="${i}" type="button" aria-current="${on}">
                    <span class="world-orb" style="background: radial-gradient(circle at 32% 28%, ${swatch}, ${ocean} 72%)"></span>
                    <span class="world-copy">
                        <strong>${p.name}</strong>
                        <em>${p.label} · ${moonLine(p)}</em>
                    </span>
                    <kbd class="world-key" aria-hidden="true">${i + 1}</kbd>
                </button>
            `;
        }).join('');
        const active = list.querySelector('.is-active');
        if (active && narrow()) active.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
    }

    stat(label, value, id = '') {
        return `<div class="stat"><dt>${label}</dt><dd${id ? ` id="${id}"` : ''}>${value}</dd></div>`;
    }

    renderMeta() {
        if (!this.data) return;
        $('#systemName').textContent = this.data.name;
        $('#planetCount').textContent = String(this.data.planets.length);
        const grid = $('#statsGrid');
        if (this.mode === 'system' || this.focus < 0) {
            const s = this.data.star;
            $('#viewLabel').textContent = 'Estrela';
            $('#planetName').textContent = s.name;
            $('#planetTag').textContent = `Anã amarela ${s.spectral}`;
            $('#planetKind').textContent = `${this.data.planets.length} planetas`;
            $('#planetLore').textContent = s.lore;
            $('#liveALabel').textContent = 'Distância à Terra';
            $('#liveBLabel').textContent = 'Luz até a Terra';
            grid.innerHTML = [
                this.stat('Massa', sci(s.mass, 'kg')),
                this.stat('Raio médio', `${fmt0.format(s.radiusKm)} km`),
                this.stat('Rotação (equador)', fmtRotation(s.rot.Wd)),
                this.stat('Inclinação do eixo', '7,25° à eclíptica'),
                this.stat('Temperatura', `${fmt0.format(s.teff)} K`),
                this.stat('Luminosidade', sci(s.luminosity, 'W'))
            ].join('');
            this.updateLive();
            this.updateViewOffset();
            return;
        }
        const p = this.data.planets[this.focus];
        const b = this.system.bodies[this.focus];
        const o = b.orbitData;
        $('#viewLabel').textContent = `Planeta ${p.designation}`;
        $('#planetName').textContent = p.name;
        $('#planetTag').textContent = p.label;
        $('#planetKind').textContent = moonLine(p);
        $('#planetLore').textContent = p.lore;
        $('#liveALabel').textContent = 'Distância ao Sol';
        $('#liveBLabel').textContent = 'Velocidade orbital';
        const moons = (p.moonsNamed || []).map((m) => (
            `${m.name} ${fmtPeriod(m.period)}${m.i > 90 ? ' (retrógrada)' : ''}`
        )).join(' · ') || 'nenhuma';
        const isEarth = p.name === 'Terra';
        grid.innerHTML = [
            isEarth ? '' : this.stat('Distância à Terra', '—', 'statEarth'),
            isEarth ? '' : this.stat('Luz até a Terra', '—', 'statLight'),
            this.stat('Período orbital', fmtPeriod(o.periodDays)),
            this.stat('Semi-eixo maior', `${fmt4.format(o.a)} UA`),
            this.stat('Periélio · afélio', `${fmt3.format(o.a * (1 - o.e))} · ${fmt3.format(o.a * (1 + o.e))} UA`),
            this.stat('Excentricidade', fmt4.format(o.e)),
            this.stat('Inclinação da órbita', `${fmt2.format(Math.abs(o.iDeg))}°`),
            this.stat('Rotação sideral', fmtRotation(p.rot.Wd)),
            this.stat('Inclinação axial', `${fmt1.format(b.tilt)}°`),
            this.stat('Massa', sci(p.mass, 'kg')),
            this.stat('Raio médio', `${fmt0.format(p.radiusKm)} km`),
            `<div class="stat wide"><dt>Luas (período sideral)</dt><dd>${moons}</dd></div>`
        ].join('');
        this.updateLive();
        this.updateViewOffset();
    }

    setText(id, value) {
        if (this.text.get(id) === value) return;
        this.text.set(id, value);
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    /** Valores que mudam com o tempo simulado (chamado ~8×/s). */
    updateLive() {
        const earthIdx = this.data.planets.findIndex((p) => p.name === 'Terra');
        const earth = this.system.getHelio(earthIdx, this.earth);
        if (this.mode === 'system' || this.focus < 0) {
            if (earth) {
                this.setText('liveA', `${fmt4.format(earth.r)} UA`);
                this.setText('liveB', fmtLight(earth.r));
            }
            return;
        }
        const h = this.system.getHelio(this.focus, this.helio);
        if (!h) return;
        this.setText('liveA', `${fmt4.format(h.r)} UA`);
        this.setText('liveB', `${fmt2.format(h.v)} km/s`);
        if (earth && this.focus !== earthIdx) {
            const d = Math.hypot(h.x - earth.x, h.y - earth.y, h.z - earth.z);
            this.text.delete('statEarth');
            this.text.delete('statLight');
            const e1 = document.getElementById('statEarth');
            const e2 = document.getElementById('statLight');
            if (e1) e1.textContent = `${fmt4.format(d)} UA`;
            if (e2) e2.textContent = fmtLight(d);
        }
    }

    updateClock() {
        const ms = msFromDays(this.simDays);
        const date = new Date(ms);
        this.setText('simDate', this.dateFmt.format(date).replace(/\./g, '').replace(/ de /g, ' '));
        this.setText('simTime', `${this.timeFmt.format(date)} UTC`);
        const outOfRange = this.simDays < VALID_FROM || this.simDays > VALID_TO;
        document.body.classList.toggle('is-approx', outOfRange);
    }

    syncClockUi() {
        const r = RATES[this.settings.rate];
        const arrow = this.settings.dir < 0 ? '◀' : '▶';
        this.setText('rateLabel', this.paused ? `Pausado · ${r.short}` : `${arrow} ${r.short}`);
        const pause = $('#pauseBtn');
        if (pause) {
            pause.setAttribute('aria-pressed', String(this.paused));
            pause.setAttribute('aria-label', this.paused ? 'Retomar o tempo' : 'Pausar o tempo');
            pause.title = this.paused ? 'Retomar (Espaço)' : 'Pausar (Espaço)';
        }
        $('#reverseBtn')?.setAttribute('aria-pressed', String(this.settings.dir < 0));
        const slower = $('#slowerBtn');
        const faster = $('#fasterBtn');
        if (slower) slower.disabled = this.settings.rate <= 0;
        if (faster) faster.disabled = this.settings.rate >= RATES.length - 1;
        if (slower) slower.title = `Mais devagar (,) — ${RATES[Math.max(0, this.settings.rate - 1)].label}`;
        if (faster) faster.title = `Mais rápido (.) — ${RATES[Math.min(RATES.length - 1, this.settings.rate + 1)].label}`;
        document.body.classList.toggle('is-paused', this.paused);
    }

    syncToggles() {
        $('#rotateBtn')?.setAttribute('aria-pressed', String(this.settings.autoRotate));
        $('#labelsBtn')?.setAttribute('aria-pressed', String(this.settings.labels));
        $('#orbitsBtn')?.setAttribute('aria-pressed', String(this.settings.orbits));
        const scaleBtn = $('#scaleBtn');
        if (scaleBtn) scaleBtn.setAttribute('aria-pressed', String(this.settings.scaleReal));
        this.setText('scaleLabel', this.settings.scaleReal ? 'Real' : 'Comprimida');
        this.setText('scaleNote', this.settings.scaleReal
            ? 'Distâncias na proporção real entre as órbitas. Planetas e Sol ampliados para serem visíveis.'
            : 'Distâncias comprimidas (∝ √UA) para caber na tela; tamanhos ampliados. Datas, períodos e formas das órbitas são reais.');
        document.body.classList.toggle('labels-off', !this.settings.labels);
    }

    persist() {
        saveSettings(this.settings);
    }

    toast(msg) {
        const el = $('#toast');
        if (!el) return;
        el.textContent = msg;
        el.classList.add('is-on');
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => el.classList.remove('is-on'), 2200);
    }

    infoOpen() {
        return narrow() ? this.settings.infoOpenNarrow : this.settings.infoOpenWide;
    }

    setInfoOpen(open, save = true) {
        if (narrow()) this.settings.infoOpenNarrow = open;
        else this.settings.infoOpenWide = open;
        const panel = $('#infoPanel');
        panel?.classList.toggle('is-collapsed', !open);
        const btn = $('#infoToggle');
        if (btn) {
            btn.setAttribute('aria-expanded', String(open));
            btn.setAttribute('aria-label', open ? 'Recolher dados' : 'Mostrar dados');
        }
        if (save) this.persist();
        this.updateViewOffset();
    }

    /**
     * Centraliza o Sol/planeta na área livre entre os painéis (setViewOffset):
     * no celular o trilho de cima e a ficha de baixo comem a tela; no desktop
     * e no landscape, as colunas laterais. Lê layout só em resize/toggle.
     */
    updateViewOffset() {
        if (!this.camera) return;
        const w = window.innerWidth;
        const h = window.innerHeight;
        let top = 0, bottom = h, left = 0, right = w;
        const rectOf = (el) => {
            if (!el || this.uiHidden) return null;
            const cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden') return null;
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0 ? r : null;
        };
        const list = rectOf($('.hud-left'));
        const info = rectOf(document.body.classList.contains('forge-open') ? $('#forge') : $('#infoPanel'));
        const dock = rectOf($('.dock'));
        if (list) {
            if (list.width > w * 0.6) top = Math.max(top, list.bottom);
            else left = Math.max(left, list.right);
        }
        if (info) {
            if (info.width > w * 0.6) bottom = Math.min(bottom, info.top);
            else right = Math.min(right, info.left);
        }
        if (dock && dock.width > w * 0.6) bottom = Math.min(bottom, dock.top);
        const ox = clamp(w / 2 - (left + right) / 2, -w * 0.22, w * 0.22);
        const oy = clamp(h / 2 - (top + bottom) / 2, -h * 0.22, h * 0.22);
        this.camera.setViewOffset(w, h, Math.round(ox), Math.round(oy), w, h);
        this.camera.updateProjectionMatrix();
    }

    closeForge() {
        const forge = $('#forge');
        if (!forge) return;
        forge.hidden = true;
        forge.classList.remove('is-open');
        document.body.classList.remove('forge-open');
        $('#forgeToggle')?.setAttribute('aria-expanded', 'false');
        this.updateViewOffset();
    }

    syncForge() {
        if (this.focus < 0) return;
        const p = this.data.planets[this.focus];
        if (!p) return;
        SLIDERS.forEach((s) => {
            const input = document.querySelector(`input[data-key="${s.key}"]`);
            if (input) input.value = p[s.key];
        });
    }

    /* ---------- tempo ---------- */

    togglePause() {
        this.paused = !this.paused;
        this.syncClockUi();
    }

    setRate(index) {
        const next = clamp(index, 0, RATES.length - 1);
        if (next === this.settings.rate) return;
        this.settings.rate = next;
        this.syncClockUi();
        this.persist();
        this.toast(`${this.settings.dir < 0 ? 'Voltando' : 'Avançando'} ${RATES[next].label}`);
    }

    toggleReverse() {
        this.settings.dir = this.settings.dir < 0 ? 1 : -1;
        this.syncClockUi();
        this.persist();
        this.toast(this.settings.dir < 0 ? 'Tempo invertido' : 'Tempo para a frente');
    }

    setDays(days, msg) {
        this.simDays = clamp(days, MIN_DAYS, MAX_DAYS);
        this.updateClock();
        if (msg) this.toast(msg);
    }

    goToday() {
        this.setDays(daysSinceJ2000(Date.now()), 'Agora');
    }

    toggleScale() {
        this.settings.scaleReal = !this.settings.scaleReal;
        this.system.setScaleMode(this.settings.scaleReal, reduceMotion);
        this.syncToggles();
        this.persist();
        // Reenquadra: a transição de escala leva ~0,6 s.
        setTimeout(() => {
            if (this.mode === 'system') this.enterSystem(true);
            else this.focusPlanet(this.focus);
        }, reduceMotion ? 0 : 350);
    }

    toggleLabels() {
        this.settings.labels = !this.settings.labels;
        this.syncToggles();
        this.persist();
    }

    toggleOrbits() {
        this.settings.orbits = !this.settings.orbits;
        this.system.setOrbitVisible(this.settings.orbits);
        this.syncToggles();
        this.persist();
    }

    toggleRotate() {
        this.settings.autoRotate = !this.settings.autoRotate;
        this.controls.autoRotate = this.settings.autoRotate;
        this.syncToggles();
        this.persist();
    }

    toggleFullscreen() {
        try {
            if (!document.fullscreenElement) document.documentElement.requestFullscreen?.()?.catch?.(() => {});
            else document.exitFullscreen?.()?.catch?.(() => {});
        } catch { /* iOS sem API de tela cheia */ }
    }

    /* ---------- entrada ---------- */

    /** Seleção por proximidade na tela (alvos minúsculos na escala real e no toque). */
    pickAt(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        const w = rect.width;
        const h = rect.height;
        const tanHalf = Math.tan((this.camera.fov * Math.PI) / 360);
        let best = -2;
        let bestScore = Infinity;
        for (let i = -1; i < this.data.planets.length; i++) {
            this.system.getPlanetWorldPos(i, this.tmp);
            const dist = this.tmp.distanceTo(this.camera.position);
            this.tmp.project(this.camera);
            if (this.tmp.z > 1) continue;
            const sx = (this.tmp.x * 0.5 + 0.5) * w;
            const sy = (-this.tmp.y * 0.5 + 0.5) * h;
            const pr = (this.system.getPlanetRadius(i) / (dist * tanHalf)) * (h / 2);
            const tol = Math.max(26, pr + 12);
            const d = Math.hypot(sx - (clientX - rect.left), sy - (clientY - rect.top));
            if (d <= tol && d / tol < bestScore) {
                bestScore = d / tol;
                best = i;
            }
        }
        return best;
    }

    selectBody(index) {
        if (index < 0) this.enterSystem(true);
        else this.focusPlanet(index);
    }

    bind() {
        const on = (sel, event, handler) => {
            const el = $(sel);
            if (el) el.addEventListener(event, handler);
        };

        on('#planetList', 'click', (e) => {
            const btn = e.target.closest('[data-index]');
            if (!btn) return;
            this.selectBody(Number(btn.dataset.index));
        });
        on('#labels', 'click', (e) => {
            const btn = e.target.closest('[data-index]');
            if (!btn) return;
            this.selectBody(Number(btn.dataset.index));
        });
        on('#backSystem', 'click', () => this.enterSystem(true));
        on('#pauseBtn', 'click', () => this.togglePause());
        on('#reverseBtn', 'click', () => this.toggleReverse());
        on('#slowerBtn', 'click', () => this.setRate(this.settings.rate - 1));
        on('#fasterBtn', 'click', () => this.setRate(this.settings.rate + 1));
        on('#todayBtn', 'click', () => this.goToday());
        on('#scaleBtn', 'click', () => this.toggleScale());
        on('#rotateBtn', 'click', () => this.toggleRotate());
        on('#labelsBtn', 'click', () => this.toggleLabels());
        on('#orbitsBtn', 'click', () => this.toggleOrbits());
        on('#infoToggle', 'click', () => this.setInfoOpen(!this.infoOpen()));
        on('#dateBtn', 'click', () => {
            const input = $('#dateInput');
            if (!input) return;
            const d = new Date(msFromDays(this.simDays));
            if (!Number.isNaN(d.getTime())) input.value = d.toISOString().slice(0, 10);
            try {
                if (input.showPicker) input.showPicker();
                else input.focus();
            } catch {
                input.focus();
            }
        });
        on('#dateInput', 'change', (e) => {
            const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(e.target.value || '');
            if (!m) return;
            const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
            if (Number.isNaN(ms)) return;
            this.setDays(daysSinceJ2000(ms), `Indo para ${m[3]}/${m[2]}/${m[1]}`);
        });
        on('#forgeToggle', 'click', () => {
            const forge = $('#forge');
            const open = forge.hidden;
            forge.hidden = !open;
            forge.classList.toggle('is-open', open);
            document.body.classList.toggle('forge-open', open);
            $('#forgeToggle')?.setAttribute('aria-expanded', String(open));
            this.updateViewOffset();
        });
        on('#forgeClose', 'click', () => this.closeForge());
        on('#fullscreen', 'click', () => this.toggleFullscreen());
        on('#retryBtn', 'click', () => window.location.reload());
        on('#sliders', 'input', (e) => {
            const key = e.target.dataset.key;
            if (!key || this.focus < 0) return;
            const p = this.data.planets[this.focus];
            p[key] = Number(e.target.value);
            const forgeKeys = ['water', 'temp', 'mountain', 'cities', 'emissive'];
            let delta = 0;
            for (const k of forgeKeys) delta += Math.abs(p[k] - (p.base?.[k] ?? p[k]));
            p.paint = Math.max(0.22, 1 - delta * 0.85);
            this.system.applyParams(this.focus, p);
        });

        this.canvas.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            this.dragging = false;
            this.ptrStart = { x: e.clientX, y: e.clientY, id: e.pointerId };
        });
        this.canvas.addEventListener('pointermove', (e) => {
            if (!this.ptrStart || e.pointerId !== this.ptrStart.id) return;
            const dx = e.clientX - this.ptrStart.x;
            const dy = e.clientY - this.ptrStart.y;
            if (dx * dx + dy * dy > 64) this.dragging = true;
        });
        this.canvas.addEventListener('pointerup', (e) => {
            const start = this.ptrStart;
            this.ptrStart = null;
            if (!start || this.dragging || !this.data) return;
            const hit = this.pickAt(e.clientX, e.clientY);
            if (hit < -1) return;
            const already = hit === -1 ? this.mode === 'system' : hit === this.focus && this.mode === 'planet';
            if (!already) this.selectBody(hit);
        });
        this.canvas.addEventListener('pointercancel', () => { this.ptrStart = null; });
        window.addEventListener('blur', () => {
            this.ptrStart = null;
            this.dragging = false;
        });

        window.addEventListener('keydown', (e) => {
            if (e.target?.matches?.('input, textarea, select') || e.ctrlKey || e.metaKey || e.altKey) return;
            const k = e.key;
            if (e.code === 'Space') {
                if (e.target?.matches?.('button')) return; // Espaço já ativa o botão focado
                e.preventDefault();
                this.togglePause();
            } else if (k === ',' || k === '<' || k === '-' || k === '[') {
                this.setRate(this.settings.rate - 1);
            } else if (k === '.' || k === '>' || k === '=' || k === '+' || k === ']') {
                this.setRate(this.settings.rate + 1);
            } else if (k === 'r' || k === 'R') {
                this.toggleReverse();
            } else if (k === 't' || k === 'T') {
                this.goToday();
            } else if (k === 'e' || k === 'E') {
                this.toggleScale();
            } else if (k === 'l' || k === 'L') {
                this.toggleLabels();
            } else if (k === 'o' || k === 'O') {
                this.toggleOrbits();
            } else if (k === 's' || k === 'S' || k === '0' || k === 'Escape') {
                if (k === 'Escape' && !$('#forge')?.hidden) this.closeForge();
                else this.enterSystem(true);
            } else if (k === 'h' || k === 'H') {
                this.uiHidden = !this.uiHidden;
                document.body.classList.toggle('ui-hidden', this.uiHidden);
                this.updateViewOffset();
            } else if (k === 'f' || k === 'F') {
                this.toggleFullscreen();
            } else if (k >= '1' && k <= '9') {
                this.focusPlanet(Number(k) - 1);
            }
        });
    }

    resize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        const pr = Math.min(window.devicePixelRatio, this.quality.pr, 2);
        this.renderer.setPixelRatio(pr);
        this.renderer.setSize(w, h);
        this.system.setPixelRatio(pr);
        this.composer?.setPixelRatio(pr);
        this.composer?.setSize(w, h);
        if (!this.fly.active) this.finishFly();
        this.updateViewOffset();
    }

    /* ---------- rótulos 3D ---------- */

    updateLabels() {
        const show = this.settings.labels && this.mode === 'system' && !this.uiHidden;
        const w = window.innerWidth;
        const h = window.innerHeight;
        const tanHalf = Math.tan((this.camera.fov * Math.PI) / 360);
        const states = this.labelState;
        for (let n = 0; n < states.length; n++) {
            const st = states[n];
            st.ok = false;
            if (!show) continue;
            this.system.getPlanetWorldPos(n - 1, this.tmp2);
            const dist = this.tmp2.distanceTo(this.camera.position);
            this.tmp2.project(this.camera);
            if (this.tmp2.z >= 1 || Math.abs(this.tmp2.x) > 1.1 || Math.abs(this.tmp2.y) > 1.1) continue;
            const pr = (this.system.getPlanetRadius(n - 1) / (dist * tanHalf)) * (h / 2);
            st.cx = (this.tmp2.x * 0.5 + 0.5) * w;
            st.cy = (-this.tmp2.y * 0.5 + 0.5) * h + Math.min(pr, 60) + 4;
            st.ok = true;
        }
        // Colisão simples O(n²) com 9 rótulos: quem tem prioridade fica.
        const order = this.labelOrder;
        for (let a = 0; a < order.length; a++) {
            const A = states[order[a]];
            if (!A.ok) continue;
            for (let b = 0; b < a; b++) {
                const B = states[order[b]];
                if (!B.ok) continue;
                if (Math.abs(A.cx - B.cx) < (A.w + B.w) * 0.5 && Math.abs(A.cy - B.cy) < 20) {
                    A.ok = false;
                    break;
                }
            }
        }
        for (let n = 0; n < states.length; n++) {
            const st = states[n];
            const el = this.labelEls[n];
            if (st.ok && (Math.abs(st.cx - st.x) > 0.4 || Math.abs(st.cy - st.y) > 0.4)) {
                st.x = st.cx;
                st.y = st.cy;
                el.style.transform = `translate3d(${st.x.toFixed(1)}px, ${st.y.toFixed(1)}px, 0)`;
            }
            if (st.ok !== st.shown) {
                st.shown = st.ok;
                el.classList.toggle('is-hidden', !st.ok);
            }
        }
    }

    /* ---------- loop ---------- */

    frame() {
        try {
            const now = performance.now();
            const elapsed = (now - this.lastTime) / 1000;
            const dt = clamp(elapsed, 0, 0.05);
            const flyDt = Math.min(elapsed, 0.25);
            this.lastTime = now;

            let dd = 0;
            if (!this.paused) {
                dd = RATES[this.settings.rate].d * this.settings.dir * dt;
                const next = this.simDays + dd;
                if (next < MIN_DAYS || next > MAX_DAYS) {
                    this.simDays = clamp(next, MIN_DAYS, MAX_DAYS);
                    dd = 0;
                    this.paused = true;
                    this.syncClockUi();
                    this.toast('Limite do relógio (anos 1000–3000)');
                } else {
                    this.simDays = next;
                }
            }

            this.system.update(this.simDays, dt, dd);
            this.updateCamera(flyDt);
            this.controls.update();
            this.system.followCamera(this.camera.position);
            if (this.composer) this.composer.render();
            else this.renderer.render(this.scene, this.camera);
            this.updateLabels();

            this.hudTime += elapsed;
            if (this.hudTime >= 0.12) {
                this.hudTime = 0;
                this.updateClock();
                this.updateLive();
            }

            this.fpsFrames += 1;
            this.fpsTime += elapsed;
            if (this.fpsTime >= 0.5) {
                this.setText('fps', String(Math.round(this.fpsFrames / this.fpsTime)));
                this.fpsFrames = 0;
                this.fpsTime = 0;
            }
            this.loopErrors = 0;
        } catch (err) {
            this.loopErrors += 1;
            if (this.loopErrors === 1) console.error(err);
            if (this.loopErrors > 30) {
                this.renderer.setAnimationLoop(null);
                this.toast('Algo deu errado na simulação. Recarregue a página.');
            }
        }
    }
}

const app = new Orbis();
app.init().catch((err) => {
    console.error(err);
    app.showLoadProblem('Não foi possível iniciar o observatório.');
});

