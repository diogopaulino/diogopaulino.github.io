const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { alpha: false });

let width = 0;
let height = 0;
let particles = [];
let flowField = [];
let cols = 0;
let rows = 0;
const scale = 22;
let zoff = 0;
let curtainTime = 0;
let breath = 0;

let flowSpeed = 1;
let particleCount = 2200;
let turbulence = 0.004;
let interactionMode = 'attract';
let interactionForce = 3.5;
let particleSize = 1.4;
let trailLength = 0.94;
let blendMode = 'lighter';
let particleShape = 'ribbon';
let bgEffect = 'stars';
let auroraIntensity = 75;
let flowStyle = 'drift';
let connectDist = 0;
let paused = false;

let mouseX = -1000;
let mouseY = -1000;
let mouseActive = false;
let lastMouseX = 0;
let lastMouseY = 0;
let mouseVelocityX = 0;
let mouseVelocityY = 0;
let painting = false;

let stars = [];
let ripples = [];
let wakes = [];
let nebulaOffset = 0;
const isMobile = window.matchMedia('(max-width: 768px)').matches;

const scenes = {
    boreal: {
        name: 'Boreal',
        tag: 'Cortinas',
        colors: ['#3dffb5', '#4ecfff', '#8b7cff', '#7ef9c5', '#9ad7ff'],
        bg: 'rgba(2, 8, 18, 1)',
        glow: 'rgba(61, 255, 181, 0.18)',
        shape: 'ribbon',
        flow: 'drift',
        interaction: 'attract',
        blend: 'lighter',
        bgFx: 'stars',
        speed: 1,
        size: 1.35,
        density: 2400,
        trail: 95,
        turb: 0.0035,
        force: 3.2,
        aurora: 80,
        connect: 0
    },
    tempest: {
        name: 'Tempestade',
        tag: 'Caos',
        colors: ['#ff4d6d', '#ff9f1c', '#ffe66d', '#ff6b35', '#ffd60a'],
        bg: 'rgba(12, 4, 6, 1)',
        glow: 'rgba(255, 77, 109, 0.2)',
        shape: 'spark',
        flow: 'chaos',
        interaction: 'repel',
        blend: 'lighter',
        bgFx: 'none',
        speed: 1.9,
        size: 1.7,
        density: 1800,
        trail: 90,
        turb: 0.012,
        force: 6.5,
        aurora: 25,
        connect: 0
    },
    vortex: {
        name: 'Vórtice',
        tag: 'Espiral',
        colors: ['#a78bfa', '#f472b6', '#60a5fa', '#c084fc', '#e879f9'],
        bg: 'rgba(8, 4, 16, 1)',
        glow: 'rgba(167, 139, 250, 0.2)',
        shape: 'line',
        flow: 'spiral',
        interaction: 'vortex',
        blend: 'screen',
        bgFx: 'nebula',
        speed: 1.35,
        size: 1.5,
        density: 2000,
        trail: 93,
        turb: 0.005,
        force: 5,
        aurora: 35,
        connect: 0
    },
    tide: {
        name: 'Maré',
        tag: 'Ondas',
        colors: ['#22d3ee', '#38bdf8', '#67e8f9', '#2dd4bf', '#a5f3fc'],
        bg: 'rgba(2, 12, 22, 1)',
        glow: 'rgba(34, 211, 238, 0.18)',
        shape: 'circle',
        flow: 'waves',
        interaction: 'attract',
        blend: 'lighter',
        bgFx: 'none',
        speed: 0.75,
        size: 1.8,
        density: 2800,
        trail: 96,
        turb: 0.0028,
        force: 2.8,
        aurora: 45,
        connect: 55
    },
    ember: {
        name: 'Ember',
        tag: 'Ascensão',
        colors: ['#fb923c', '#f97316', '#fbbf24', '#ef4444', '#fdba74'],
        bg: 'rgba(10, 4, 2, 1)',
        glow: 'rgba(251, 146, 60, 0.2)',
        shape: 'glow',
        flow: 'rise',
        interaction: 'attract',
        blend: 'lighter',
        bgFx: 'none',
        speed: 1.15,
        size: 2.1,
        density: 1400,
        trail: 94,
        turb: 0.0045,
        force: 3.8,
        aurora: 20,
        connect: 0
    },
    lattice: {
        name: 'Lattice',
        tag: 'Rede',
        colors: ['#34d399', '#a3e635', '#4ade80', '#86efac', '#bef264'],
        bg: 'rgba(3, 10, 8, 1)',
        glow: 'rgba(52, 211, 153, 0.18)',
        shape: 'dot',
        flow: 'grid',
        interaction: 'paint',
        blend: 'source-over',
        bgFx: 'grid',
        speed: 0.9,
        size: 1.2,
        density: 1600,
        trail: 88,
        turb: 0.003,
        force: 4.2,
        aurora: 0,
        connect: 78
    }
};

let currentKey = 'boreal';
let current = scenes.boreal;

let frameCount = 0;
let lastTime = performance.now();
let fps = 60;

function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(t, a, b) { return a + t * (b - a); }
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

function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    cols = Math.floor(width / scale) + 1;
    rows = Math.floor(height / scale) + 1;
    flowField = new Float32Array(cols * rows);
    initStars();
    initParticles();
}

function initStars() {
    stars = [];
    const count = Math.floor((width * height) / 6500);
    for (let i = 0; i < count; i++) {
        stars.push({
            x: Math.random() * width,
            y: Math.random() * height,
            size: Math.random() * 1.4 + 0.3,
            twinkle: Math.random() * Math.PI * 2,
            speed: Math.random() * 0.025 + 0.008,
            layer: Math.random()
        });
    }
}

class Particle {
    constructor() {
        this.reset(true);
    }

    reset(initial) {
        if (flowStyle === 'rise') {
            this.x = Math.random() * width;
            this.y = initial ? Math.random() * height : height + Math.random() * 40;
        } else if (flowStyle === 'spiral') {
            const a = Math.random() * Math.PI * 2;
            const r = Math.random() * Math.min(width, height) * 0.48;
            this.x = width * 0.5 + Math.cos(a) * r;
            this.y = height * 0.5 + Math.sin(a) * r;
        } else {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
        }
        this.prevX = this.x;
        this.prevY = this.y;
        this.vx = 0;
        this.vy = 0;
        this.color = current.colors[(Math.random() * current.colors.length) | 0];
        this.alpha = Math.random() * 0.45 + 0.35;
        this.size = (Math.random() * 1.4 + 0.5) * particleSize;
        this.life = Math.random() * 220 + 90;
        this.maxLife = this.life;
        this.hueShift = Math.random();
    }

    update() {
        const col = Math.max(0, Math.min(cols - 1, (this.x / scale) | 0));
        const row = Math.max(0, Math.min(rows - 1, (this.y / scale) | 0));
        const angle = flowField[col + row * cols];
        const force = 0.42 * flowSpeed;
        this.vx += Math.cos(angle) * force;
        this.vy += Math.sin(angle) * force;

        if (mouseActive) {
            const dx = mouseX - this.x;
            const dy = mouseY - this.y;
            const dist = Math.hypot(dx, dy) || 1;
            const maxDist = interactionMode === 'paint' ? 110 : 210;

            if (dist < maxDist) {
                const strength = (1 - dist / maxDist) * interactionForce;
                const nx = dx / dist;
                const ny = dy / dist;

                if (interactionMode === 'attract') {
                    this.vx += nx * strength;
                    this.vy += ny * strength;
                } else if (interactionMode === 'repel') {
                    this.vx -= nx * strength * 2.1;
                    this.vy -= ny * strength * 2.1;
                } else if (interactionMode === 'vortex') {
                    this.vx += -ny * strength + mouseVelocityX * 0.12;
                    this.vy += nx * strength + mouseVelocityY * 0.12;
                } else if (interactionMode === 'paint') {
                    const speed = Math.hypot(mouseVelocityX, mouseVelocityY);
                    this.vx += mouseVelocityX * 0.18 * strength + nx * strength * 0.2;
                    this.vy += mouseVelocityY * 0.18 * strength + ny * strength * 0.2;
                    if (speed > 2) this.life = Math.min(this.maxLife, this.life + 4);
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

        this.vx *= 0.975;
        this.vy *= 0.975;

        const maxSpeed = flowStyle === 'chaos' ? 9 : 6.2;
        const speed = Math.hypot(this.vx, this.vy);
        if (speed > maxSpeed) {
            this.vx = (this.vx / speed) * maxSpeed;
            this.vy = (this.vy / speed) * maxSpeed;
        }

        this.prevX = this.x;
        this.prevY = this.y;
        this.x += this.vx;
        this.y += this.vy;
        this.life--;

        const margin = 40;
        if (
            this.x < -margin || this.x > width + margin ||
            this.y < -margin || this.y > height + margin ||
            this.life <= 0
        ) {
            this.reset(false);
        }
    }

    draw() {
        const lifeRatio = this.life / this.maxLife;
        const alpha = this.alpha * lifeRatio;
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = this.color;
        ctx.fillStyle = this.color;
        ctx.lineWidth = this.size;
        ctx.lineCap = 'round';

        if (particleShape === 'ribbon' || particleShape === 'line') {
            ctx.beginPath();
            ctx.moveTo(this.prevX, this.prevY);
            ctx.lineTo(this.x, this.y);
            ctx.stroke();
        } else if (particleShape === 'circle' || particleShape === 'dot') {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size * (particleShape === 'dot' ? 1.4 : 2.1), 0, Math.PI * 2);
            ctx.fill();
        } else if (particleShape === 'spark') {
            const len = this.size * 3.4;
            const ang = Math.atan2(this.vy, this.vx);
            ctx.beginPath();
            ctx.moveTo(this.x - Math.cos(ang) * len, this.y - Math.sin(ang) * len);
            ctx.lineTo(this.x + Math.cos(ang) * len, this.y + Math.sin(ang) * len);
            ctx.moveTo(this.x - Math.sin(ang) * len * 0.45, this.y + Math.cos(ang) * len * 0.45);
            ctx.lineTo(this.x + Math.sin(ang) * len * 0.45, this.y - Math.cos(ang) * len * 0.45);
            ctx.stroke();
        } else if (particleShape === 'glow') {
            const r = this.size * 5.5;
            const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, r);
            g.addColorStop(0, this.color);
            g.addColorStop(0.45, this.color + '55');
            g.addColorStop(1, 'transparent');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalAlpha = 1;
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
        return n * Math.PI * 3.2 + Math.sin(y * 0.004 + curtainTime) * 0.35;
    }
    if (flowStyle === 'chaos') {
        return n * Math.PI * 8 + Math.sin(zoff * 20 + x) * 0.8;
    }
    if (flowStyle === 'spiral') {
        const dx = x * scale - cx;
        const dy = y * scale - cy;
        return Math.atan2(dy, dx) + Math.PI * 0.5 + n * 0.9;
    }
    if (flowStyle === 'waves') {
        return Math.sin(y * 0.035 + curtainTime * 2.2) * 0.9 + n * Math.PI + Math.cos(x * 0.02) * 0.25;
    }
    if (flowStyle === 'rise') {
        return -Math.PI * 0.5 + n * 1.4 + Math.sin(x * 0.01 + curtainTime) * 0.4;
    }
    if (flowStyle === 'grid') {
        const cell = ((x / 3) | 0) + ((y / 3) | 0);
        return (cell % 2 === 0 ? 0 : Math.PI * 0.5) + n * 0.7;
    }
    return n * Math.PI * 4;
}

function updateFlowField() {
    const cx = width * 0.5;
    const cy = height * 0.5;
    let i = 0;
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            flowField[i++] = fieldAngle(x, y, cx, cy);
        }
    }
    zoff += 0.0018 * flowSpeed;
}

function drawBackground() {
    if (bgEffect === 'stars') {
        const parallaxX = (mouseActive ? (mouseX - width / 2) : 0) * 0.01;
        const parallaxY = (mouseActive ? (mouseY - height / 2) : 0) * 0.01;
        for (const star of stars) {
            star.twinkle += star.speed;
            const alpha = (Math.sin(star.twinkle) + 1) * 0.35 + 0.15;
            const px = star.x + parallaxX * (0.4 + star.layer);
            const py = star.y + parallaxY * (0.4 + star.layer);
            ctx.fillStyle = `rgba(255,255,255,${alpha * 0.7})`;
            ctx.beginPath();
            ctx.arc(px, py, star.size, 0, Math.PI * 2);
            ctx.fill();
        }
    } else if (bgEffect === 'grid') {
        ctx.strokeStyle = current.colors[0] + '14';
        ctx.lineWidth = 1;
        const size = 48;
        const offset = (curtainTime * 18) % size;
        for (let x = -size + offset; x < width; x += size) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        for (let y = -size + offset * 0.6; y < height; y += size) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
    } else if (bgEffect === 'nebula') {
        nebulaOffset += 0.002 * flowSpeed;
        const g = ctx.createRadialGradient(
            width * 0.5 + Math.sin(nebulaOffset) * 120,
            height * 0.5 + Math.cos(nebulaOffset * 0.8) * 90,
            0,
            width * 0.5,
            height * 0.5,
            Math.max(width, height) * 0.55
        );
        g.addColorStop(0, current.colors[0] + '12');
        g.addColorStop(0.4, current.colors[1] + '08');
        g.addColorStop(0.75, current.colors[2] + '04');
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, width, height);
    }
}

function drawAuroraCurtains() {
    if (auroraIntensity <= 0) return;
    const intensity = auroraIntensity / 100;
    curtainTime += 0.0022 * flowSpeed;
    breath = 0.85 + Math.sin(curtainTime * 1.4) * 0.15;

    ctx.save();
    const bands = flowStyle === 'chaos' ? 2 : 4;
    const step = Math.max(8, (width / 160) | 0);

    for (let b = 0; b < bands; b++) {
        const baseY = height * (0.04 + b * 0.13);
        const amplitude = (48 + b * 18) * (0.55 + intensity * 0.55) * breath;
        const curtainHeight = height * (0.22 + b * 0.05);
        const color = current.colors[b % current.colors.length];

        ctx.beginPath();
        for (let x = 0; x <= width; x += step) {
            const n = noise3D(x * 0.002 + b * 18, curtainTime + b * 4, 0.5);
            const wave = Math.sin(x * 0.0028 + curtainTime * 1.7 + b) * amplitude * 0.45;
            const y = baseY + n * amplitude + wave;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.lineTo(width, baseY + curtainHeight);
        ctx.lineTo(0, baseY + curtainHeight);
        ctx.closePath();

        const gradient = ctx.createLinearGradient(0, baseY - amplitude, 0, baseY + curtainHeight);
        gradient.addColorStop(0, color + 'aa');
        gradient.addColorStop(0.4, color + '40');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.globalAlpha = intensity * (0.55 - b * 0.08) * breath;
        ctx.shadowBlur = 36;
        ctx.shadowColor = color;
        ctx.fill();
        ctx.shadowBlur = 0;
    }
    ctx.restore();
}

function drawConnections() {
    if (connectDist <= 0 || particles.length > 3200) return;
    const max = connectDist;
    const step = particles.length > 2000 ? 3 : 2;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 0.6;

    for (let i = 0; i < particles.length; i += step) {
        const a = particles[i];
        for (let j = i + step; j < Math.min(particles.length, i + 28); j += step) {
            const b = particles[j];
            const dx = a.x - b.x;
            const dy = a.y - b.y;
            const d = Math.hypot(dx, dy);
            if (d < max) {
                ctx.globalAlpha = (1 - d / max) * 0.18;
                ctx.strokeStyle = a.color;
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
            }
        }
    }
    ctx.restore();
}

function spawnRipple(x, y) {
    ripples.push({ x, y, radius: 6, maxRadius: 260, alpha: 1 });
    wakes.push({ x, y, radius: 40, power: 10, life: 0.9 });

    const burst = 260;
    for (const particle of particles) {
        const dx = particle.x - x;
        const dy = particle.y - y;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist < burst) {
            const strength = (1 - dist / burst) * 18;
            particle.vx += (dx / dist) * strength;
            particle.vy += (dy / dist) * strength;
            particle.life = Math.min(particle.maxLife, particle.life + 30);
        }
    }
}

function updateRipplesAndWakes() {
    if (ripples.length) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = ripples.length - 1; i >= 0; i--) {
            const r = ripples[i];
            r.radius += (r.maxRadius - r.radius) * 0.09 + 2.5;
            r.alpha *= 0.9;
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
            ctx.globalAlpha = r.alpha * 0.25;
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

function drawMouseGlow() {
    if (!mouseActive) return;
    const radius = interactionMode === 'paint' ? 90 : 140;
    const g = ctx.createRadialGradient(mouseX, mouseY, 0, mouseX, mouseY, radius);
    g.addColorStop(0, current.glow);
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.fillRect(mouseX - radius, mouseY - radius, radius * 2, radius * 2);

    if (interactionMode === 'paint' && painting) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = current.colors[0] + '55';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(mouseX, mouseY, 18 + Math.hypot(mouseVelocityX, mouseVelocityY) * 0.4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
}

function animate() {
    requestAnimationFrame(animate);
    if (paused) return;

    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = current.bg;
    ctx.globalAlpha = 1 - trailLength;
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1;

    drawBackground();
    drawAuroraCurtains();

    updateFlowField();

    ctx.globalCompositeOperation = blendMode;
    for (const particle of particles) {
        particle.update();
        particle.draw();
    }

    ctx.globalCompositeOperation = 'source-over';
    drawConnections();
    updateRipplesAndWakes();
    drawMouseGlow();

    frameCount++;
    const now = performance.now();
    if (now - lastTime >= 1000) {
        fps = Math.round((frameCount * 1000) / (now - lastTime));
        const fpsEl = document.getElementById('fps');
        if (fpsEl) fpsEl.textContent = fps;
        frameCount = 0;
        lastTime = now;

        if (fps < 28 && particleCount > 900) {
            setDensity(Math.max(900, particleCount - 200));
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

    particleShape = scene.shape;
    flowStyle = scene.flow;
    interactionMode = scene.interaction;
    blendMode = scene.blend;
    bgEffect = scene.bgFx;
    flowSpeed = scene.speed;
    particleSize = scene.size;
    trailLength = scene.trail / 100;
    turbulence = scene.turb;
    interactionForce = scene.force;
    auroraIntensity = scene.aurora;
    connectDist = scene.connect;

    const density = isMobile ? Math.max(500, Math.round(scene.density * 0.5)) : scene.density;
    setDensity(density);

    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    const setText = (id, t) => { const el = document.getElementById(id); if (el) el.textContent = t; };
    setVal('flowSpeed', flowSpeed);
    setText('speedValue', flowSpeed.toFixed(1));
    setVal('trailLength', scene.trail);
    setText('trailValue', scene.trail + '%');
    setVal('force', interactionForce);
    setText('forceValue', interactionForce.toFixed(1));

    document.querySelectorAll('.scene-chip').forEach((c) => {
        c.classList.toggle('active', c.dataset.scene === key);
        c.setAttribute('aria-selected', c.dataset.scene === key ? 'true' : 'false');
    });
    document.querySelectorAll('.tool-btn[data-mode]').forEach((b) => {
        b.classList.toggle('active', b.dataset.mode === interactionMode);
    });

    const hud = document.getElementById('hudScene');
    if (hud) hud.textContent = scene.name;

    applyThemeVars();
    for (const particle of particles) {
        particle.color = current.colors[(Math.random() * current.colors.length) | 0];
        particle.size = (Math.random() * 1.4 + 0.5) * particleSize;
    }

    ctx.fillStyle = current.bg;
    ctx.fillRect(0, 0, width, height);
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
        btn.style.setProperty(
            '--chip-gradient',
            `linear-gradient(135deg, ${scene.colors[0]}, ${scene.colors[1]})`
        );
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
            power: 2.2,
            life: 0.7
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

function togglePause() {
    paused = !paused;
    const pauseIcon = document.querySelector('.pause-icon');
    const playIcon = document.querySelector('.play-icon');
    if (pauseIcon && playIcon) {
        pauseIcon.style.display = paused ? 'none' : 'block';
        playIcon.style.display = paused ? 'block' : 'none';
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

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
        document.querySelector('.fullscreen-enter').style.display = 'none';
        document.querySelector('.fullscreen-exit').style.display = 'block';
    } else {
        document.exitFullscreen();
        document.querySelector('.fullscreen-enter').style.display = 'block';
        document.querySelector('.fullscreen-exit').style.display = 'none';
    }
}

document.getElementById('fullscreen')?.addEventListener('click', toggleFullscreen);
document.addEventListener('fullscreenchange', () => {
    const on = !!document.fullscreenElement;
    document.querySelector('.fullscreen-enter').style.display = on ? 'none' : 'block';
    document.querySelector('.fullscreen-exit').style.display = on ? 'block' : 'none';
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

buildSceneRail();
resize();
applyScene(currentKey, true);
animate();
