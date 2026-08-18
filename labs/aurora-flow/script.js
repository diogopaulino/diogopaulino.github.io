/**
 * Aurora Flow — noite polar generativa
 *
 * Camadas (fundo → frente):
 *   céu → via láctea → estrelas → lua → cortinas (OI 557.7 nm / N2+ 427.8 nm)
 *   → fitas de plasma (flow field) → meteoros → reflexo no fiorde → montanhas
 *
 * Campo: θ = noise3D(x·τ, y·τ, z) misturado com um dipolo 2D no ponteiro.
 * Cortinas: fibras verticais com envelope fBm; rosa no topo, verde na base.
 * Partículas: Euler + damping 0.97; ribbon = histórico de N pontos.
 */

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { alpha: false });
const sky = document.createElement('canvas');
const skyCtx = sky.getContext('2d', { alpha: false });
const land = document.createElement('canvas');
const landCtx = land.getContext('2d', { alpha: true });

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = window.matchMedia('(pointer: coarse)').matches;
const isMobile = window.matchMedia('(max-width: 768px)').matches || coarse;

let width = 0;
let height = 0;
let dpr = 1;
let horizon = 0;

let particles = [];
let flowField = [];
let cols = 0;
let rows = 0;
const SCALE = isMobile ? 28 : 22;

let zoff = 0;
let time = 0;
let curtainT = 0;
let kpBreath = 0;

let flowSpeed = 1;
let particleCount = isMobile ? 700 : 1600;
let turbulence = 0.0038;
let interactionMode = 'attract';
let interactionForce = 3.5;
let particleSize = 1.35;
let trailLength = 0.93;
let blendMode = 'lighter';
let auroraIntensity = 80;
let auroraAltitude = 0.7;
let flowStyle = 'drift';
let paused = false;
let flash = 0;

let mouseX = -1000;
let mouseY = -1000;
let mouseActive = false;
let lastMouseX = 0;
let lastMouseY = 0;
let mouseVelocityX = 0;
let mouseVelocityY = 0;
let painting = false;

let stars = [];
let milky = [];
let meteors = [];
let ripples = [];
let wakes = [];
let iceSpark = [];

const TRAIL = isMobile ? 4 : 8;

const scenes = {
    boreal: {
        name: 'Boreal',
        tag: 'Cortinas',
        colors: ['#3dffb5', '#7cf4ff', '#c084fc', '#ff8ac4', '#9dffd0'],
        bg: '#02060e',
        glow: 'rgba(61, 255, 181, 0.22)',
        flow: 'drift',
        interaction: 'attract',
        blend: 'lighter',
        terrain: 'fjord',
        sky: 'night',
        fieldLines: false,
        speed: 0.95,
        size: 1.3,
        density: 1700,
        trail: 93,
        turb: 0.0034,
        force: 3.2,
        aurora: 86,
        altitude: 72,
        horizon: 0.7,
        sheets: 4
    },
    tempest: {
        name: 'Tempestade',
        tag: 'CME',
        colors: ['#ff4d6d', '#ff9f1c', '#ffe66d', '#ff6b35', '#ffd60a'],
        bg: '#0c0406',
        glow: 'rgba(255, 77, 109, 0.24)',
        flow: 'chaos',
        interaction: 'repel',
        blend: 'lighter',
        terrain: 'ice',
        sky: 'storm',
        fieldLines: false,
        speed: 1.85,
        size: 1.55,
        density: 1400,
        trail: 88,
        turb: 0.011,
        force: 6.4,
        aurora: 55,
        altitude: 88,
        horizon: 0.74,
        sheets: 3
    },
    corona: {
        name: 'Coroa',
        tag: 'Zênite',
        colors: ['#a78bfa', '#f472b6', '#60a5fa', '#c084fc', '#e879f9'],
        bg: '#070414',
        glow: 'rgba(167, 139, 250, 0.24)',
        flow: 'spiral',
        interaction: 'vortex',
        blend: 'screen',
        terrain: 'void',
        sky: 'zenith',
        fieldLines: true,
        speed: 1.28,
        size: 1.4,
        density: 1500,
        trail: 92,
        turb: 0.0048,
        force: 5.2,
        aurora: 48,
        altitude: 95,
        horizon: 1,
        sheets: 3
    },
    fjord: {
        name: 'Fjord',
        tag: 'Reflexo',
        colors: ['#22d3ee', '#38bdf8', '#67e8f9', '#2dd4bf', '#a5f3fc'],
        bg: '#021018',
        glow: 'rgba(34, 211, 238, 0.22)',
        flow: 'waves',
        interaction: 'attract',
        blend: 'lighter',
        terrain: 'fjord',
        sky: 'night',
        fieldLines: false,
        speed: 0.72,
        size: 1.6,
        density: 1900,
        trail: 95,
        turb: 0.0026,
        force: 2.8,
        aurora: 70,
        altitude: 62,
        horizon: 0.66,
        sheets: 4
    },
    plasma: {
        name: 'Plasma',
        tag: 'Elétrica',
        colors: ['#67e8f9', '#c084fc', '#22d3ee', '#e879f9', '#a5b4fc'],
        bg: '#040816',
        glow: 'rgba(103, 232, 249, 0.22)',
        flow: 'grid',
        interaction: 'paint',
        blend: 'lighter',
        terrain: 'void',
        sky: 'void',
        fieldLines: true,
        speed: 1.12,
        size: 1.25,
        density: 1300,
        trail: 90,
        turb: 0.0055,
        force: 4.6,
        aurora: 22,
        altitude: 80,
        horizon: 1,
        sheets: 2
    },
    dawn: {
        name: 'Alvorada',
        tag: 'Crepúsculo',
        colors: ['#fb923c', '#fbbf24', '#34d399', '#f472b6', '#fdba74'],
        bg: '#120814',
        glow: 'rgba(251, 146, 60, 0.22)',
        flow: 'rise',
        interaction: 'attract',
        blend: 'lighter',
        terrain: 'fjord',
        sky: 'dawn',
        fieldLines: false,
        speed: 0.82,
        size: 1.7,
        density: 1200,
        trail: 94,
        turb: 0.003,
        force: 3.4,
        aurora: 42,
        altitude: 58,
        horizon: 0.72,
        sheets: 3
    }
};

let currentKey = 'boreal';
let current = scenes.boreal;

let frameCount = 0;
let lastTime = performance.now();
let fps = 60;
let meteorTimer = 0;
let warmFrames = 0;

function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(t, a, b) { return a + t * (b - a); }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function hexAlpha(hex, a) {
    const n = hex.replace('#', '');
    const r = parseInt(n.slice(0, 2), 16);
    const g = parseInt(n.slice(2, 4), 16);
    const b = parseInt(n.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
}

function grad(hash, x, y, z) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

const permutation = [151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140, 36, 103, 30, 69, 142,
    8, 99, 37, 240, 21, 10, 23, 190, 6, 148, 247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177,
    33, 88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231,
    83, 111, 229, 122, 60, 211, 133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54, 65, 25, 63, 161, 1, 216,
    80, 73, 209, 76, 132, 187, 208, 89, 18, 169, 200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3,
    64, 52, 217, 226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206, 59, 227, 47, 16, 58, 17, 182,
    189, 28, 42, 223, 183, 170, 213, 119, 248, 152, 2, 44, 154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9, 129, 22, 39,
    253, 19, 98, 108, 110, 79, 113, 224, 232, 178, 185, 112, 104, 218, 246, 97, 228, 251, 34, 242, 193, 238, 210, 144,
    12, 191, 179, 162, 241, 81, 51, 145, 235, 249, 14, 239, 107, 49, 192, 214, 31, 181, 199, 106, 157, 184, 84, 204, 176,
    115, 121, 50, 45, 127, 4, 150, 254, 138, 236, 205, 93, 222, 114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180];
const p = new Array(512);
for (let i = 0; i < 256; i++) {
    p[i] = permutation[i];
    p[256 + i] = permutation[i];
}

function noise3D(x, y, z) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    z -= Math.floor(z);
    const u = fade(x);
    const v = fade(y);
    const w = fade(z);
    const A = p[X] + Y;
    const AA = p[A] + Z;
    const AB = p[A + 1] + Z;
    const B = p[X + 1] + Y;
    const BA = p[B] + Z;
    const BB = p[B + 1] + Z;
    return lerp(w,
        lerp(v, lerp(u, grad(p[AA], x, y, z), grad(p[BA], x - 1, y, z)),
            lerp(u, grad(p[AB], x, y - 1, z), grad(p[BB], x - 1, y - 1, z))),
        lerp(v, lerp(u, grad(p[AA + 1], x, y, z - 1), grad(p[BA + 1], x - 1, y, z - 1)),
            lerp(u, grad(p[AB + 1], x, y - 1, z - 1), grad(p[BB + 1], x - 1, y - 1, z - 1))));
}

function fbm(x, y, z) {
    let v = 0;
    let a = 0.5;
    for (let i = 0; i < 4; i++) {
        v += a * noise3D(x, y, z);
        x *= 2.02;
        y *= 2.02;
        z *= 2.02;
        a *= 0.5;
    }
    return v;
}

function sizeLayer(layer) {
    layer.width = Math.max(1, Math.floor(width * dpr));
    layer.height = Math.max(1, Math.floor(height * dpr));
    const c = layer.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2);
    sizeLayer(canvas);
    sizeLayer(sky);
    sizeLayer(land);
    horizon = horizonY();
    cols = Math.floor(width / SCALE) + 1;
    rows = Math.floor(height / SCALE) + 1;
    flowField = new Float32Array(cols * rows);
    initStars();
    initIce();
    buildTerrain();
    if (!particles.length) initParticles();
}

function initStars() {
    stars = [];
    milky = [];
    const count = Math.floor((width * height) / (isMobile ? 9000 : 5200));
    for (let i = 0; i < count; i++) {
        stars.push({
            x: Math.random() * width,
            y: Math.random() * height,
            size: Math.random() * 1.35 + 0.25,
            twinkle: Math.random() * Math.PI * 2,
            speed: Math.random() * 0.03 + 0.006,
            layer: Math.random()
        });
    }
    const band = Math.floor(count * 0.35);
    const angle = -0.42;
    const ca = Math.cos(angle);
    const sa = Math.sin(angle);
    for (let i = 0; i < band; i++) {
        const u = (Math.random() - 0.5) * width * 1.4;
        const v = (Math.random() - 0.5) * height * 0.18;
        milky.push({
            x: width * 0.48 + u * ca - v * sa,
            y: height * 0.28 + u * sa + v * ca,
            size: Math.random() * 1.1 + 0.2,
            a: Math.random() * 0.45 + 0.12
        });
    }
}

function initIce() {
    iceSpark = [];
    const n = Math.floor(width / 14);
    for (let i = 0; i < n; i++) {
        iceSpark.push({
            x: Math.random() * width,
            y: Math.random(),
            w: Math.random() * 18 + 4,
            a: Math.random() * 0.25 + 0.05,
            s: Math.random() * 0.02 + 0.004
        });
    }
}

function drawPine(c, x, y, h) {
    const w = h * 0.52;
    c.fillStyle = '#05080f';
    for (let t = 0; t < 3; t++) {
        c.beginPath();
        c.moveTo(x, y - h + t * h * 0.2);
        c.lineTo(x - w * (1 - t * 0.2), y - h * 0.42 + t * h * 0.26);
        c.lineTo(x + w * (1 - t * 0.2), y - h * 0.42 + t * h * 0.26);
        c.closePath();
        c.fill();
    }
    c.fillRect(x - 1.4, y - h * 0.12, 2.8, h * 0.18);
}

function buildTerrain() {
    landCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    landCtx.clearRect(0, 0, width, height);
    if (current.terrain === 'void') return;

    const hzn = horizonY();
    const layers = current.terrain === 'ice' ? 2 : 3;

    for (let layer = 0; layer < layers; layer++) {
        const base = hzn + 6 - layer * 10;
        landCtx.beginPath();
        landCtx.moveTo(-20, height);
        landCtx.lineTo(-20, base);
        for (let x = 0; x <= width + 20; x += 7) {
            const n = noise3D(x * 0.0028 + layer * 31, layer * 9.1, 0.21);
            const n2 = noise3D(x * 0.011 + layer * 7, 3.2, 0.4);
            const peak = Math.max(0, n * 0.55 + 0.42) * (70 + layer * 54) * (layer === layers - 1 ? 1.2 : 0.72);
            landCtx.lineTo(x, base - peak + n2 * 10);
        }
        landCtx.lineTo(width + 20, height);
        landCtx.closePath();
        const g = landCtx.createLinearGradient(0, hzn - 200, 0, height);
        if (current.sky === 'dawn' && layer === layers - 1) {
            g.addColorStop(0, '#0c0814');
            g.addColorStop(1, '#1a0c10');
        } else {
            g.addColorStop(0, layer === layers - 1 ? '#070b14' : `rgba(${5 + layer * 3},${9 + layer * 4},${18 + layer * 5},0.92)`);
            g.addColorStop(1, '#02040a');
        }
        landCtx.fillStyle = g;
        landCtx.fill();

        if (layer === layers - 1) {
            landCtx.save();
            landCtx.clip();
            landCtx.strokeStyle = 'rgba(214, 228, 255, 0.22)';
            landCtx.lineWidth = 1.6;
            landCtx.beginPath();
            for (let x = 0; x <= width + 20; x += 7) {
                const n = noise3D(x * 0.0028 + layer * 31, layer * 9.1, 0.21);
                const n2 = noise3D(x * 0.011 + layer * 7, 3.2, 0.4);
                const peak = Math.max(0, n * 0.55 + 0.42) * (70 + layer * 54) * 1.2;
                const y = base - peak + n2 * 10;
                if (x === 0) landCtx.moveTo(x, y);
                else landCtx.lineTo(x, y);
            }
            landCtx.stroke();
            landCtx.restore();
        }
    }

    const pineCount = Math.floor(width / (isMobile ? 52 : 36));
    for (let i = 0; i < pineCount; i++) {
        const nx = noise3D(i * 0.73, 4.2, 0.5);
        const x = (i + 0.25 + nx * 0.4) * (width / pineCount);
        const y = hzn + 10 + nx * 8;
        drawPine(landCtx, x, y, 16 + Math.abs(nx) * 22);
    }

    landCtx.fillStyle = current.terrain === 'ice' ? '#0a121c' : '#050910';
    landCtx.fillRect(0, hzn + 8, width, 16);
}

class Particle {
    constructor() {
        this.trail = new Float32Array(TRAIL * 2);
        this.reset(true);
    }

    reset(initial) {
        const hzn = horizonY();
        const skyH = Math.max(80, hzn);
        if (flowStyle === 'rise') {
            this.x = Math.random() * width;
            this.y = initial ? Math.random() * skyH : skyH + Math.random() * 20;
        } else if (flowStyle === 'spiral') {
            const a = Math.random() * Math.PI * 2;
            const r = Math.random() * Math.min(width, height) * 0.46;
            this.x = width * 0.5 + Math.cos(a) * r;
            this.y = height * 0.42 + Math.sin(a) * r;
        } else {
            this.x = Math.random() * width;
            this.y = Math.random() * skyH;
        }
        this.vx = 0;
        this.vy = 0;
        this.color = current.colors[(Math.random() * current.colors.length) | 0];
        this.alpha = Math.random() * 0.4 + 0.4;
        this.size = (Math.random() * 1.2 + 0.55) * particleSize;
        this.life = Math.random() * 240 + 80;
        this.maxLife = this.life;
        this.glow = !isMobile && Math.random() < 0.08;
        this.ti = 0;
        this.tn = 0;
        for (let i = 0; i < this.trail.length; i += 2) {
            this.trail[i] = this.x;
            this.trail[i + 1] = this.y;
        }
        this.tn = TRAIL;
        this.ti = 0;
    }

    pushTrail() {
        this.trail[this.ti] = this.x;
        this.trail[this.ti + 1] = this.y;
        this.ti = (this.ti + 2) % this.trail.length;
        this.tn = Math.min(this.tn + 1, TRAIL);
    }

    update() {
        const col = clamp((this.x / SCALE) | 0, 0, cols - 1);
        const row = clamp((this.y / SCALE) | 0, 0, rows - 1);
        const angle = flowField[col + row * cols];
        const force = 0.4 * flowSpeed;
        this.vx += Math.cos(angle) * force;
        this.vy += Math.sin(angle) * force;

        if (mouseActive) {
            const dx = mouseX - this.x;
            const dy = mouseY - this.y;
            const dist = Math.hypot(dx, dy) || 1;
            const maxDist = interactionMode === 'paint' ? 120 : 220;
            if (dist < maxDist) {
                const strength = (1 - dist / maxDist) * interactionForce;
                const nx = dx / dist;
                const ny = dy / dist;
                if (interactionMode === 'attract') {
                    this.vx += nx * strength;
                    this.vy += ny * strength;
                } else if (interactionMode === 'repel') {
                    this.vx -= nx * strength * 2.15;
                    this.vy -= ny * strength * 2.15;
                } else if (interactionMode === 'vortex') {
                    this.vx += -ny * strength + mouseVelocityX * 0.12;
                    this.vy += nx * strength + mouseVelocityY * 0.12;
                } else if (interactionMode === 'paint') {
                    this.vx += mouseVelocityX * 0.2 * strength + nx * strength * 0.18;
                    this.vy += mouseVelocityY * 0.2 * strength + ny * strength * 0.18;
                    if (Math.hypot(mouseVelocityX, mouseVelocityY) > 2) {
                        this.life = Math.min(this.maxLife, this.life + 5);
                    }
                }
            }
        }

        for (let i = 0; i < wakes.length; i++) {
            const w = wakes[i];
            const dx = this.x - w.x;
            const dy = this.y - w.y;
            const dist = Math.hypot(dx, dy) || 1;
            if (dist < w.radius) {
                const s = (1 - dist / w.radius) * w.power;
                this.vx += (dx / dist) * s;
                this.vy += (dy / dist) * s;
            }
        }

        this.vx *= 0.972;
        this.vy *= 0.972;
        const maxSpeed = flowStyle === 'chaos' ? 9.2 : 6.1;
        const speed = Math.hypot(this.vx, this.vy);
        if (speed > maxSpeed) {
            this.vx = (this.vx / speed) * maxSpeed;
            this.vy = (this.vy / speed) * maxSpeed;
        }

        this.pushTrail();
        this.x += this.vx;
        this.y += this.vy;
        this.life--;

        const hzn = horizonY();
        const margin = 36;
        if (
            this.x < -margin || this.x > width + margin ||
            this.y < -margin || this.y > hzn + margin ||
            this.life <= 0
        ) {
            this.reset(false);
        }
    }

    trace(c) {
        const n = this.tn;
        if (n < 2) return;
        const len = this.trail.length;
        const start = (this.ti - n * 2 + len) % len;
        c.moveTo(this.trail[start], this.trail[start + 1]);
        for (let i = 1; i < n; i++) {
            const idx = (start + i * 2) % len;
            c.lineTo(this.trail[idx], this.trail[idx + 1]);
        }
        c.lineTo(this.x, this.y);
    }
}

function initParticles() {
    particles = [];
    for (let i = 0; i < particleCount; i++) particles.push(new Particle());
}

function setDensity(n) {
    n = Math.max(200, n | 0);
    if (n > particleCount) {
        for (let i = particleCount; i < n; i++) particles.push(new Particle());
    } else {
        particles.length = n;
    }
    particleCount = n;
    const el = document.getElementById('density');
    const val = document.getElementById('densityValue');
    if (el) el.value = n;
    if (val) val.textContent = n;
}

function fieldAngle(x, y, cx, cy) {
    const n = noise3D(x * turbulence * 12, y * turbulence * 12, zoff);
    if (flowStyle === 'drift') {
        return n * Math.PI * 3.1 + Math.sin(y * 0.004 + curtainT) * 0.38;
    }
    if (flowStyle === 'chaos') {
        return n * Math.PI * 8 + Math.sin(zoff * 20 + x) * 0.85;
    }
    if (flowStyle === 'spiral') {
        const dx = x * SCALE - cx;
        const dy = y * SCALE - cy;
        return Math.atan2(dy, dx) + Math.PI * 0.5 + n * 0.85;
    }
    if (flowStyle === 'waves') {
        return Math.sin(y * 0.034 + curtainT * 2.1) * 0.95 + n * Math.PI + Math.cos(x * 0.02) * 0.22;
    }
    if (flowStyle === 'rise') {
        return -Math.PI * 0.5 + n * 1.35 + Math.sin(x * 0.01 + curtainT) * 0.42;
    }
    if (flowStyle === 'grid') {
        const cell = ((x / 3) | 0) + ((y / 3) | 0);
        return (cell % 2 === 0 ? 0 : Math.PI * 0.5) + n * 0.65;
    }
    return n * Math.PI * 4;
}

function updateFlowField() {
    const cx = width * 0.5;
    const cy = height * (current.terrain === 'void' ? 0.45 : 0.38);
    let i = 0;
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            flowField[i++] = fieldAngle(x, y, cx, cy);
        }
    }
    zoff += 0.0017 * flowSpeed;
}

function fillSky(alpha) {
    const hzn = Math.max(1, horizonY());
    skyCtx.globalAlpha = alpha;
    skyCtx.globalCompositeOperation = 'source-over';
    if (current.sky === 'dawn') {
        const g = skyCtx.createLinearGradient(0, 0, 0, hzn);
        g.addColorStop(0, '#070414');
        g.addColorStop(0.48, '#1a0c22');
        g.addColorStop(0.78, '#c45c3a');
        g.addColorStop(1, '#f0a060');
        skyCtx.fillStyle = g;
    } else if (current.sky === 'storm') {
        const g = skyCtx.createLinearGradient(0, 0, 0, height);
        g.addColorStop(0, '#14060a');
        g.addColorStop(1, '#080204');
        skyCtx.fillStyle = g;
    } else if (current.sky === 'zenith') {
        const g = skyCtx.createRadialGradient(width * 0.5, height * 0.42, 20, width * 0.5, height * 0.42, Math.max(width, height) * 0.7);
        g.addColorStop(0, '#140820');
        g.addColorStop(1, current.bg);
        skyCtx.fillStyle = g;
    } else {
        const g = skyCtx.createLinearGradient(0, 0, 0, hzn);
        g.addColorStop(0, '#01040a');
        g.addColorStop(0.7, current.bg);
        g.addColorStop(1, current.bg);
        skyCtx.fillStyle = g;
    }
    skyCtx.fillRect(0, 0, width, height);
    skyCtx.globalAlpha = 1;
}

function drawStars() {
    const hzn = horizonY();
    const parallaxX = (mouseActive ? (mouseX - width / 2) : 0) * 0.012;
    const parallaxY = (mouseActive ? (mouseY - height / 2) : 0) * 0.012;

    skyCtx.save();
    skyCtx.globalCompositeOperation = 'lighter';
    for (const s of milky) {
        if (s.y > hzn) continue;
        skyCtx.fillStyle = `rgba(190,210,255,${s.a * 0.55})`;
        skyCtx.fillRect(s.x, s.y, s.size, s.size);
    }
    for (const star of stars) {
        if (star.y > hzn) continue;
        star.twinkle += star.speed * flowSpeed;
        const alpha = (Math.sin(star.twinkle) + 1) * 0.32 + 0.18;
        const px = star.x + parallaxX * (0.35 + star.layer);
        const py = star.y + parallaxY * (0.35 + star.layer);
        skyCtx.fillStyle = `rgba(255,255,255,${alpha * 0.75})`;
        skyCtx.beginPath();
        skyCtx.arc(px, py, star.size, 0, Math.PI * 2);
        skyCtx.fill();
    }
    skyCtx.restore();
}

function drawMoon() {
    if (current.sky === 'dawn') return;
    const mx = width * 0.78;
    const my = height * 0.16;
    const r = Math.min(width, height) * 0.028;
    const halo = skyCtx.createRadialGradient(mx, my, r, mx, my, r * 14);
    halo.addColorStop(0, 'rgba(220,230,255,0.16)');
    halo.addColorStop(0.35, hexAlpha(current.colors[1], 0.06));
    halo.addColorStop(1, 'transparent');
    skyCtx.fillStyle = halo;
    skyCtx.fillRect(mx - r * 14, my - r * 14, r * 28, r * 28);

    const g = skyCtx.createRadialGradient(mx - r * 0.3, my - r * 0.3, 0, mx, my, r);
    g.addColorStop(0, '#f4f7ff');
    g.addColorStop(1, '#c5d0e8');
    skyCtx.fillStyle = g;
    skyCtx.beginPath();
    skyCtx.arc(mx, my, r, 0, Math.PI * 2);
    skyCtx.fill();
}

function horizonY() {
    if (current.terrain === 'void') return height;
    let t = current.horizon;
    if (height < 520 && width > height) t = Math.min(0.84, t + 0.12);
    return height * t;
}

function drawAurora() {
    const intensity = auroraIntensity / 100;
    if (intensity <= 0.02) return;
    const hzn = horizonY();
    const skyH = Math.max(90, hzn);
    const short = height < 520;
    const sheets = short || isMobile ? Math.min(current.sheets, 3) : current.sheets;
    const step = short ? 6 : isMobile ? 4 : 2;

    curtainT += 0.002 * flowSpeed;
    kpBreath = 0.82 + Math.sin(curtainT * 1.3) * 0.18;

    skyCtx.save();
    skyCtx.globalCompositeOperation = 'lighter';
    skyCtx.lineCap = 'round';

    for (let s = 0; s < sheets; s++) {
        const phase = s * 19.7;
        const topC = current.colors[(s + 2) % current.colors.length];
        const botC = current.colors[s % current.colors.length];
        const grad = skyCtx.createLinearGradient(0, 0, 0, hzn);
        grad.addColorStop(0, hexAlpha(topC, 0.92));
        grad.addColorStop(0.35, hexAlpha(current.colors[1], 0.7));
        grad.addColorStop(0.78, hexAlpha(botC, 0.38));
        grad.addColorStop(1, hexAlpha(botC, 0));
        skyCtx.strokeStyle = grad;
        skyCtx.lineWidth = (isMobile ? 2.2 : 3.1) + s * 0.35;
        skyCtx.globalAlpha = intensity * (0.9 - s * 0.14) * kpBreath;
        skyCtx.beginPath();

        for (let x = 0; x < width; x += step) {
            const env = fbm(x * 0.0016 + phase, curtainT * 0.5 + s, s * 0.4);
            const fold = Math.pow(clamp(Math.sin(x * 0.007 + curtainT + phase) * 0.5 + 0.5, 0, 1), 1.6);
            const envelope = Math.pow(clamp(env * 0.5 + 0.5, 0, 1), 1.25) * (0.28 + fold * 0.85);
            if (envelope < 0.16) continue;
            const flicker = 0.62 + noise3D(x * 0.02, curtainT * 1.6, s) * 0.38;
            const h = envelope * skyH * auroraAltitude * (0.55 + s * 0.1) * flicker;
            const wobble = noise3D(x * 0.028, curtainT * 0.8, s + 2) * 14;
            const yTop = hzn - h - skyH * 0.04 * s;
            skyCtx.moveTo(x + wobble, yTop);
            skyCtx.lineTo(x, hzn - 2);
        }
        skyCtx.stroke();
    }
    skyCtx.restore();
}

function drawFieldLines() {
    if (!current.fieldLines || height < 520) return;
    skyCtx.save();
    skyCtx.globalCompositeOperation = 'lighter';
    skyCtx.strokeStyle = hexAlpha(current.colors[1], 0.22);
    skyCtx.lineWidth = 0.8;
    const count = isMobile ? 10 : 16;
    for (let i = 0; i < count; i++) {
        let x = ((i + 0.5) / count) * width;
        let y = height * 0.12 + (i % 3) * 18;
        skyCtx.beginPath();
        skyCtx.moveTo(x, y);
        for (let s = 0; s < 36; s++) {
            const col = clamp((x / SCALE) | 0, 0, cols - 1);
            const row = clamp((y / SCALE) | 0, 0, rows - 1);
            const a = flowField[col + row * cols];
            x += Math.cos(a) * 9;
            y += Math.sin(a) * 9;
            skyCtx.lineTo(x, y);
        }
        skyCtx.stroke();
    }
    skyCtx.restore();
}

function drawParticles() {
    skyCtx.save();
    skyCtx.globalCompositeOperation = blendMode;
    skyCtx.lineCap = 'round';
    skyCtx.lineJoin = 'round';
    skyCtx.lineWidth = particleSize;

    const groups = new Map();
    for (const p of particles) {
        p.update();
        let g = groups.get(p.color);
        if (!g) {
            g = [];
            groups.set(p.color, g);
        }
        g.push(p);
    }

    for (const [color, group] of groups) {
        skyCtx.strokeStyle = color;
        skyCtx.globalAlpha = 0.48;
        skyCtx.beginPath();
        for (const p of group) p.trace(skyCtx);
        skyCtx.stroke();
    }

    skyCtx.globalAlpha = 0.55;
    for (const p of particles) {
        if (!p.glow) continue;
        const r = p.size * 4.2;
        const g = skyCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        g.addColorStop(0, p.color);
        g.addColorStop(1, 'transparent');
        skyCtx.fillStyle = g;
        skyCtx.beginPath();
        skyCtx.arc(p.x, p.y, r, 0, Math.PI * 2);
        skyCtx.fill();
    }
    skyCtx.restore();
}

function spawnMeteor(fromUser) {
    const x = fromUser && mouseActive ? mouseX : Math.random() * width * 0.85;
    const y = fromUser && mouseActive ? Math.min(mouseY, height * 0.35) : Math.random() * height * 0.28;
    meteors.push({
        x,
        y,
        vx: 7 + Math.random() * 5,
        vy: 4 + Math.random() * 3,
        life: 1,
        color: current.colors[0]
    });
}

function drawMeteors() {
    if (!meteors.length) return;
    skyCtx.save();
    skyCtx.globalCompositeOperation = 'lighter';
    skyCtx.lineCap = 'round';
    for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i];
        m.x += m.vx * flowSpeed;
        m.y += m.vy * flowSpeed;
        m.life *= 0.965;
        if (m.life < 0.04 || m.y > horizonY()) {
            meteors.splice(i, 1);
            continue;
        }
        skyCtx.strokeStyle = hexAlpha(m.color, m.life);
        skyCtx.lineWidth = 2.2;
        skyCtx.beginPath();
        skyCtx.moveTo(m.x, m.y);
        skyCtx.lineTo(m.x - m.vx * 6, m.y - m.vy * 6);
        skyCtx.stroke();
        skyCtx.fillStyle = `rgba(255,255,255,${m.life})`;
        skyCtx.beginPath();
        skyCtx.arc(m.x, m.y, 2.1, 0, Math.PI * 2);
        skyCtx.fill();
    }
    skyCtx.restore();
}

function spawnRipple(x, y) {
    ripples.push({ x, y, radius: 8, maxRadius: 280, alpha: 1 });
    wakes.push({ x, y, radius: 46, power: 12, life: 0.95 });
    flash = Math.min(1, flash + 0.45);
    auroraIntensity = clamp(auroraIntensity + 8, 0, 100);

    const burst = 280;
    for (const particle of particles) {
        const dx = particle.x - x;
        const dy = particle.y - y;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist < burst) {
            const strength = (1 - dist / burst) * 20;
            particle.vx += (dx / dist) * strength;
            particle.vy += (dy / dist) * strength;
            particle.life = Math.min(particle.maxLife, particle.life + 36);
        }
    }
}

function updateRipplesAndWakes() {
    if (ripples.length) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = ripples.length - 1; i >= 0; i--) {
            const r = ripples[i];
            r.radius += (r.maxRadius - r.radius) * 0.08 + 2.4;
            r.alpha *= 0.91;
            if (r.alpha < 0.03) {
                ripples.splice(i, 1);
                continue;
            }
            ctx.beginPath();
            ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
            ctx.strokeStyle = current.colors[i % current.colors.length];
            ctx.globalAlpha = r.alpha * 0.55;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(r.x, r.y, r.radius * 0.55, 0, Math.PI * 2);
            ctx.globalAlpha = r.alpha * 0.22;
            ctx.stroke();
        }
        ctx.restore();
    }

    for (let i = wakes.length - 1; i >= 0; i--) {
        const w = wakes[i];
        w.radius += 8;
        w.power *= 0.88;
        w.life *= 0.9;
        if (w.life < 0.05) wakes.splice(i, 1);
    }
}

function drawReticle() {
    if (!mouseActive || coarse) return;
    const radius = interactionMode === 'paint' ? 78 : 118;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(mouseX, mouseY, 0, mouseX, mouseY, radius);
    g.addColorStop(0, current.glow);
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.fillRect(mouseX - radius, mouseY - radius, radius * 2, radius * 2);

    ctx.strokeStyle = hexAlpha(current.colors[0], 0.55);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(mouseX, mouseY, 16 + Math.hypot(mouseVelocityX, mouseVelocityY) * 0.35, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(mouseX - 22, mouseY);
    ctx.lineTo(mouseX - 8, mouseY);
    ctx.moveTo(mouseX + 8, mouseY);
    ctx.lineTo(mouseX + 22, mouseY);
    ctx.moveTo(mouseX, mouseY - 22);
    ctx.lineTo(mouseX, mouseY - 8);
    ctx.moveTo(mouseX, mouseY + 8);
    ctx.lineTo(mouseX, mouseY + 22);
    ctx.stroke();
    ctx.restore();
}

function drawLake() {
    const hzn = horizonY();
    if (current.terrain === 'void' || hzn >= height - 8) return;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, hzn, width, height - hzn);
    ctx.clip();
    ctx.translate(0, hzn);
    ctx.scale(1, -0.36);
    ctx.globalAlpha = 0.28;
    ctx.drawImage(sky, 0, 0, sky.width, sky.height * (hzn / height), 0, -hzn, width, hzn);
    ctx.restore();

    ctx.fillStyle = current.terrain === 'ice' ? 'rgba(8, 16, 28, 0.52)' : 'rgba(2, 10, 18, 0.58)';
    ctx.fillRect(0, hzn, width, height - hzn);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(180, 210, 255, 0.08)';
    ctx.lineWidth = 1;
    const wobble = Math.sin(time * 0.8) * 3;
    for (let i = 0; i < 5; i++) {
        const y = hzn + 18 + i * ((height - hzn) / 6) + wobble * (i % 2 ? 1 : -1);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(width * 0.3, y + 4, width * 0.7, y - 3, width, y + 2);
        ctx.stroke();
    }
    for (const ice of iceSpark) {
        ice.x += ice.s * 8;
        if (ice.x > width) ice.x = 0;
        const y = hzn + ice.y * (height - hzn);
        ctx.globalAlpha = ice.a * (0.5 + Math.sin(time * 2 + ice.x) * 0.5);
        ctx.fillStyle = '#dce9ff';
        ctx.fillRect(ice.x, y, ice.w, 1);
    }
    ctx.restore();

    const fog = ctx.createLinearGradient(0, hzn - 28, 0, hzn + 36);
    fog.addColorStop(0, 'transparent');
    fog.addColorStop(0.5, 'rgba(6, 12, 22, 0.35)');
    fog.addColorStop(1, 'transparent');
    ctx.fillStyle = fog;
    ctx.fillRect(0, hzn - 28, width, 64);
}

function drawKp() {
    const kp = clamp(turbulence * 420 + auroraIntensity / 18 + flowSpeed * 0.6 + kpBreath, 0.4, 9);
    const el = document.getElementById('kpIndex');
    if (el) el.textContent = kp.toFixed(1);
}

function animate() {
    requestAnimationFrame(animate);
    if (paused) return;

    time += 0.016 * flowSpeed;
    flash *= 0.9;
    if (auroraIntensity > current.aurora) {
        auroraIntensity += (current.aurora - auroraIntensity) * 0.02;
    }

    fillSky(warmFrames < 4 ? 1 : 1 - trailLength);
    warmFrames++;
    drawStars();
    drawMoon();
    updateFlowField();
    drawAurora();
    drawFieldLines();
    drawParticles();

    meteorTimer++;
    if (!reducedMotion && meteorTimer > 220 + Math.random() * 400) {
        meteorTimer = 0;
        if (Math.random() < 0.55) spawnMeteor(false);
    }
    drawMeteors();

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.drawImage(sky, 0, 0, sky.width, sky.height, 0, 0, width, height);
    drawLake();
    ctx.drawImage(land, 0, 0, land.width, land.height, 0, 0, width, height);

    if (flash > 0.02) {
        ctx.fillStyle = hexAlpha(current.colors[0], flash * 0.18);
        ctx.fillRect(0, 0, width, height);
    }

    updateRipplesAndWakes();
    drawReticle();
    drawKp();

    frameCount++;
    const now = performance.now();
    if (now - lastTime >= 1000) {
        fps = Math.round((frameCount * 1000) / (now - lastTime));
        const fpsEl = document.getElementById('fps');
        if (fpsEl) fpsEl.textContent = fps;
        frameCount = 0;
        lastTime = now;
        if (fps < 28 && particleCount > 700) {
            setDensity(Math.max(700, particleCount - 220));
        }
    }

    const countEl = document.getElementById('particleCount');
    if (countEl) countEl.textContent = particles.length;
}

function applyThemeVars() {
    document.documentElement.style.setProperty('--a1', current.colors[0]);
    document.documentElement.style.setProperty('--a2', current.colors[1]);
    document.documentElement.style.setProperty('--a3', current.colors[2]);
    document.documentElement.style.setProperty('--glow', current.glow);
}

function applyScene(key, silent) {
    const scene = scenes[key];
    if (!scene) return;
    currentKey = key;
    current = scene;

    flowStyle = scene.flow;
    interactionMode = scene.interaction;
    blendMode = scene.blend;
    flowSpeed = scene.speed;
    particleSize = scene.size;
    trailLength = scene.trail / 100;
    turbulence = scene.turb;
    interactionForce = scene.force;
    auroraIntensity = scene.aurora;
    auroraAltitude = scene.altitude / 100;
    horizon = height * scene.horizon;

    const density = isMobile ? Math.max(420, Math.round(scene.density * 0.48)) : scene.density;
    setDensity(density);

    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    const setText = (id, t) => { const el = document.getElementById(id); if (el) el.textContent = t; };
    setVal('flowSpeed', flowSpeed);
    setText('speedValue', flowSpeed.toFixed(1));
    setVal('trailLength', scene.trail);
    setText('trailValue', scene.trail + '%');
    setVal('force', interactionForce);
    setText('forceValue', interactionForce.toFixed(1));
    setVal('altitude', scene.altitude);
    setText('altitudeValue', scene.altitude + '%');
    setVal('glow', scene.aurora);
    setText('glowValue', scene.aurora + '%');

    document.querySelectorAll('.scene-chip').forEach((c) => {
        c.classList.toggle('active', c.dataset.scene === key);
        c.setAttribute('aria-selected', c.dataset.scene === key ? 'true' : 'false');
    });
    document.querySelectorAll('.tool-btn[data-mode]').forEach((b) => {
        b.classList.toggle('active', b.dataset.mode === interactionMode);
    });

    const hud = document.getElementById('hudScene');
    const tag = document.getElementById('hudTag');
    if (hud) hud.textContent = scene.name;
    if (tag) tag.textContent = scene.tag;

    applyThemeVars();
    buildTerrain();
    for (const particle of particles) {
        particle.color = current.colors[(Math.random() * current.colors.length) | 0];
        particle.size = (Math.random() * 1.2 + 0.55) * particleSize;
    }

    fillSky(1);
    warmFrames = 0;
    flash = 0.65;
    if (!silent) showToast(`${scene.name} · ${scene.tag}`);
}

function buildSceneRail() {
    const rail = document.getElementById('sceneRail');
    if (!rail) return;
    rail.innerHTML = '';
    Object.entries(scenes).forEach(([key, scene]) => {
        const btn = document.createElement('button');
        btn.className = 'scene-chip' + (key === currentKey ? ' active' : '');
        btn.dataset.scene = key;
        btn.setAttribute('role', 'option');
        btn.setAttribute('aria-selected', key === currentKey ? 'true' : 'false');
        btn.style.setProperty('--chip-gradient', `linear-gradient(135deg, ${scene.colors[0]}, ${scene.colors[1]})`);
        btn.style.setProperty('--chip-glow', hexAlpha(scene.colors[0], 0.55));
        btn.innerHTML = `<span class="scene-swatch" aria-hidden="true"></span><span>${scene.name}</span>`;
        btn.addEventListener('click', () => applyScene(key));
        rail.appendChild(btn);
    });
}

function randomize() {
    const keys = Object.keys(scenes);
    let key = keys[(Math.random() * keys.length) | 0];
    while (keys.length > 1 && key === currentKey) {
        key = keys[(Math.random() * keys.length) | 0];
    }
    applyScene(key);
}

function showToast(message) {
    let toast = document.querySelector('.toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.remove('show');
    void toast.offsetWidth;
    toast.classList.add('show');
    clearTimeout(toast._hideTimeout);
    toast._hideTimeout = setTimeout(() => toast.classList.remove('show'), 1800);
}

function handlePointer(x, y) {
    mouseVelocityX = x - lastMouseX;
    mouseVelocityY = y - lastMouseY;
    lastMouseX = mouseX;
    lastMouseY = mouseY;
    mouseX = x;
    mouseY = y;
    mouseActive = true;

    if (interactionMode === 'paint' && painting) {
        wakes.push({
            x,
            y,
            radius: 28 + Math.hypot(mouseVelocityX, mouseVelocityY) * 0.5,
            power: 2.3,
            life: 0.72
        });
        if (wakes.length > 40) wakes.shift();
    }
}

let pointerMoved = false;
let pointerDownX = 0;
let pointerDownY = 0;

canvas.addEventListener('mousemove', (e) => {
    if (painting && (Math.abs(e.clientX - pointerDownX) > 6 || Math.abs(e.clientY - pointerDownY) > 6)) {
        pointerMoved = true;
    }
    handlePointer(e.clientX, e.clientY);
});
canvas.addEventListener('mouseleave', () => {
    mouseActive = false;
    painting = false;
});
canvas.addEventListener('mousedown', (e) => {
    painting = true;
    pointerMoved = false;
    pointerDownX = e.clientX;
    pointerDownY = e.clientY;
    handlePointer(e.clientX, e.clientY);
});
canvas.addEventListener('mouseup', (e) => {
    if (!pointerMoved) spawnRipple(e.clientX, e.clientY);
    painting = false;
});

let touchMoved = false;
let touchStartX = 0;
let touchStartY = 0;

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.touches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
    touchMoved = false;
    painting = true;
    handlePointer(t.clientX, t.clientY);
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const t = e.touches[0];
    if (Math.abs(t.clientX - touchStartX) > 8 || Math.abs(t.clientY - touchStartY) > 8) {
        touchMoved = true;
    }
    handlePointer(t.clientX, t.clientY);
}, { passive: false });

canvas.addEventListener('touchend', () => {
    if (!touchMoved) spawnRipple(mouseX, mouseY);
    mouseActive = false;
    painting = false;
}, { passive: true });

document.querySelectorAll('.tool-btn[data-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tool-btn[data-mode]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        interactionMode = btn.dataset.mode;
        showToast(
            interactionMode === 'attract' ? 'Atrair' :
            interactionMode === 'repel' ? 'Repelir' :
            interactionMode === 'vortex' ? 'Vórtice' : 'Pintar fluxo'
        );
    });
});

document.getElementById('random')?.addEventListener('click', randomize);
document.getElementById('meteor')?.addEventListener('click', () => {
    spawnMeteor(true);
    showToast('Meteoro');
});

function togglePause() {
    paused = !paused;
    const pauseIcon = document.querySelector('.pause-icon');
    const playIcon = document.querySelector('.play-icon');
    if (pauseIcon && playIcon) {
        pauseIcon.hidden = paused;
        playIcon.hidden = !paused;
    }
    showToast(paused ? 'Pausado' : 'Retomado');
}

document.getElementById('playPause')?.addEventListener('click', togglePause);

function saveImage() {
    const link = document.createElement('a');
    link.download = `aurora-flow-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('Imagem salva');
}

document.getElementById('saveImage')?.addEventListener('click', saveImage);

const tunePanel = document.getElementById('tunePanel');
const toggleTune = document.getElementById('toggleTune');

function setTuneOpen(open) {
    if (!tunePanel || !toggleTune) return;
    tunePanel.hidden = !open;
    toggleTune.setAttribute('aria-expanded', open ? 'true' : 'false');
}

toggleTune?.addEventListener('click', () => {
    setTuneOpen(tunePanel.hidden);
});

document.getElementById('flowSpeed')?.addEventListener('input', (e) => {
    flowSpeed = parseFloat(e.target.value);
    document.getElementById('speedValue').textContent = flowSpeed.toFixed(1);
});
document.getElementById('density')?.addEventListener('input', (e) => {
    setDensity(parseInt(e.target.value, 10));
});
document.getElementById('trailLength')?.addEventListener('input', (e) => {
    trailLength = parseInt(e.target.value, 10) / 100;
    document.getElementById('trailValue').textContent = e.target.value + '%';
});
document.getElementById('force')?.addEventListener('input', (e) => {
    interactionForce = parseFloat(e.target.value);
    document.getElementById('forceValue').textContent = interactionForce.toFixed(1);
});
document.getElementById('altitude')?.addEventListener('input', (e) => {
    auroraAltitude = parseInt(e.target.value, 10) / 100;
    document.getElementById('altitudeValue').textContent = e.target.value + '%';
});
document.getElementById('glow')?.addEventListener('input', (e) => {
    auroraIntensity = parseInt(e.target.value, 10);
    current.aurora = auroraIntensity;
    document.getElementById('glowValue').textContent = e.target.value + '%';
});

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
    } else {
        document.exitFullscreen();
    }
}

document.getElementById('fullscreen')?.addEventListener('click', toggleFullscreen);
document.addEventListener('fullscreenchange', () => {
    const on = !!document.fullscreenElement;
    const enter = document.querySelector('.fullscreen-enter');
    const exit = document.querySelector('.fullscreen-exit');
    if (enter) enter.hidden = on;
    if (exit) exit.hidden = !on;
});

document.addEventListener('keydown', (e) => {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    const key = e.key.toLowerCase();
    const sceneKeys = Object.keys(scenes);

    if (key === ' ') {
        e.preventDefault();
        togglePause();
    } else if (key === 'r') {
        randomize();
    } else if (key === 's') {
        saveImage();
    } else if (key === 'f') {
        toggleFullscreen();
    } else if (key === 'c') {
        setTuneOpen(tunePanel.hidden);
    } else if (key === 'm') {
        spawnMeteor(true);
        showToast('Meteoro');
    } else if (key === 'escape') {
        setTuneOpen(false);
    } else if (key === 'a') {
        document.querySelector('.tool-btn[data-mode="attract"]')?.click();
    } else if (key === 'e') {
        document.querySelector('.tool-btn[data-mode="repel"]')?.click();
    } else if (key === 'v') {
        document.querySelector('.tool-btn[data-mode="vortex"]')?.click();
    } else if (key === 'p') {
        document.querySelector('.tool-btn[data-mode="paint"]')?.click();
    } else if (key >= '1' && key <= '6') {
        const scene = sceneKeys[parseInt(key, 10) - 1];
        if (scene) applyScene(scene);
    }
});

window.addEventListener('resize', resize);

if (reducedMotion) {
    flowSpeed = 0.35;
}

buildSceneRail();
resize();
applyScene(currentKey, true);
animate();
