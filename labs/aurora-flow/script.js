const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

let width, height;
let particles = [];
let flowField = [];
let cols, rows;
let scale = 20;
let zoff = 0;

let flowSpeed = 1;
let particleCount = 2000;
let turbulence = 0.004;
let interactionMode = 'attract';
let interactionForce = 3;
let particleSize = 1.5;
let trailLength = 0.95;
let blendMode = 'source-over';
let particleShape = 'line';
let bgEffect = 'stars';

let mouseX = -1000;
let mouseY = -1000;
let mouseActive = false;
let lastMouseX = 0;
let lastMouseY = 0;
let mouseVelocityX = 0;
let mouseVelocityY = 0;

let stars = [];
let rainDrops = [];
let nebulaOffset = 0;

const colorThemes = {
    aurora: {
        colors: ['#00ff88', '#00d4ff', '#8b5cf6', '#00ffcc', '#4ade80'],
        bgDark: 'rgba(0, 8, 20, 1)',
        bgLight: 'rgba(230, 245, 255, 1)',
        glow: 'rgba(0, 255, 136, 0.15)'
    },
    sunset: {
        colors: ['#ff6b6b', '#feca57', '#ff9ff3', '#ff9500', '#ff2d55'],
        bgDark: 'rgba(20, 8, 15, 1)',
        bgLight: 'rgba(255, 245, 240, 1)',
        glow: 'rgba(255, 107, 107, 0.15)'
    },
    ocean: {
        colors: ['#0066ff', '#00ffff', '#00ff99', '#00ccff', '#66ffcc'],
        bgDark: 'rgba(0, 10, 25, 1)',
        bgLight: 'rgba(230, 250, 255, 1)',
        glow: 'rgba(0, 102, 255, 0.15)'
    },
    cosmic: {
        colors: ['#8b5cf6', '#ec4899', '#f43f5e', '#a855f7', '#d946ef'],
        bgDark: 'rgba(15, 5, 20, 1)',
        bgLight: 'rgba(250, 240, 255, 1)',
        glow: 'rgba(139, 92, 246, 0.15)'
    },
    neon: {
        colors: ['#39ff14', '#ff073a', '#00fff7', '#f5d300', '#ff6ec7'],
        bgDark: 'rgba(5, 5, 10, 1)',
        bgLight: 'rgba(240, 255, 245, 1)',
        glow: 'rgba(57, 255, 20, 0.15)'
    },
    fire: {
        colors: ['#ff4500', '#ff8c00', '#ffd700', '#ff6347', '#ffcc00'],
        bgDark: 'rgba(15, 5, 0, 1)',
        bgLight: 'rgba(255, 250, 240, 1)',
        glow: 'rgba(255, 69, 0, 0.15)'
    },
    forest: {
        colors: ['#228b22', '#32cd32', '#7cfc00', '#90ee90', '#00fa9a'],
        bgDark: 'rgba(0, 10, 5, 1)',
        bgLight: 'rgba(240, 255, 245, 1)',
        glow: 'rgba(50, 205, 50, 0.15)'
    },
    candy: {
        colors: ['#ff69b4', '#ba55d3', '#00ced1', '#ff1493', '#9400d3'],
        bgDark: 'rgba(10, 5, 15, 1)',
        bgLight: 'rgba(255, 245, 250, 1)',
        glow: 'rgba(255, 105, 180, 0.15)'
    }
};

function getThemeBackground(theme) {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return isDark ? theme.bgDark : theme.bgLight;
}

let currentTheme = 'aurora';

let frameCount = 0;
let lastTime = performance.now();
let fps = 60;

function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    cols = Math.floor(width / scale);
    rows = Math.floor(height / scale);
    flowField = new Array(cols * rows);
    initParticles();
    initStars();
    initRain();
}

function initStars() {
    stars = [];
    const starCount = Math.floor((width * height) / 5000);
    for (let i = 0; i < starCount; i++) {
        stars.push({
            x: Math.random() * width,
            y: Math.random() * height,
            size: Math.random() * 1.5 + 0.5,
            twinkle: Math.random() * Math.PI * 2,
            speed: Math.random() * 0.02 + 0.01
        });
    }
}

function initRain() {
    rainDrops = [];
    const rainCount = 100;
    for (let i = 0; i < rainCount; i++) {
        rainDrops.push({
            x: Math.random() * width,
            y: Math.random() * height,
            speed: Math.random() * 5 + 3,
            length: Math.random() * 20 + 10,
            char: String.fromCharCode(0x30A0 + Math.random() * 96)
        });
    }
}

function drawBackgroundEffect() {
    const theme = colorThemes[currentTheme];

    if (bgEffect === 'stars') {
        ctx.save();
        for (const star of stars) {
            star.twinkle += star.speed;
            const alpha = (Math.sin(star.twinkle) + 1) / 2 * 0.8 + 0.2;
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.6})`;
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    } else if (bgEffect === 'grid') {
        ctx.save();
        ctx.strokeStyle = `${theme.colors[0]}15`;
        ctx.lineWidth = 1;
        const gridSize = 50;
        for (let x = 0; x < width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        for (let y = 0; y < height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        ctx.restore();
    } else if (bgEffect === 'nebula') {
        nebulaOffset += 0.002;
        ctx.save();
        const gradient = ctx.createRadialGradient(
            width / 2 + Math.sin(nebulaOffset) * 100,
            height / 2 + Math.cos(nebulaOffset * 0.7) * 100,
            0,
            width / 2,
            height / 2,
            Math.max(width, height) / 2
        );
        gradient.addColorStop(0, `${theme.colors[0]}08`);
        gradient.addColorStop(0.3, `${theme.colors[1]}05`);
        gradient.addColorStop(0.6, `${theme.colors[2]}03`);
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
    } else if (bgEffect === 'rain') {
        ctx.save();
        ctx.fillStyle = `${theme.colors[0]}30`;
        ctx.font = '14px monospace';
        for (const drop of rainDrops) {
            drop.y += drop.speed;
            if (drop.y > height) {
                drop.y = -20;
                drop.x = Math.random() * width;
                drop.char = String.fromCharCode(0x30A0 + Math.random() * 96);
            }
            ctx.globalAlpha = 0.5;
            ctx.fillText(drop.char, drop.x, drop.y);
        }
        ctx.restore();
    }
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

    return lerp(w, lerp(v, lerp(u, grad(p[AA], x, y, z),
        grad(p[BA], x - 1, y, z)),
        lerp(u, grad(p[AB], x, y - 1, z),
            grad(p[BB], x - 1, y - 1, z))),
        lerp(v, lerp(u, grad(p[AA + 1], x, y, z - 1),
            grad(p[BA + 1], x - 1, y, z - 1)),
            lerp(u, grad(p[AB + 1], x, y - 1, z - 1),
                grad(p[BB + 1], x - 1, y - 1, z - 1))));
}

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

class Particle {
    constructor() {
        this.reset();
    }

    reset() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.prevX = this.x;
        this.prevY = this.y;
        this.vx = 0;
        this.vy = 0;
        const theme = colorThemes[currentTheme];
        this.color = theme.colors[Math.floor(Math.random() * theme.colors.length)];
        this.alpha = Math.random() * 0.5 + 0.3;
        this.size = (Math.random() * 1.5 + 0.5) * particleSize;
        this.life = Math.random() * 200 + 100;
        this.maxLife = this.life;
        this.rotation = Math.random() * Math.PI * 2;
    }

    update() {
        const col = Math.floor(this.x / scale);
        const row = Math.floor(this.y / scale);
        const index = col + row * cols;

        if (flowField[index] !== undefined) {
            const angle = flowField[index];
            const force = 0.5 * flowSpeed;
            this.vx += Math.cos(angle) * force;
            this.vy += Math.sin(angle) * force;
            this.rotation = angle;
        }

        if (mouseActive) {
            const dx = mouseX - this.x;
            const dy = mouseY - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const maxDist = 200;

            if (dist < maxDist) {
                const strength = (1 - dist / maxDist) * interactionForce;
                const nx = dx / (dist || 1);
                const ny = dy / (dist || 1);

                if (interactionMode === 'attract') {
                    this.vx += nx * strength;
                    this.vy += ny * strength;
                } else if (interactionMode === 'repel') {
                    this.vx -= nx * strength * 2;
                    this.vy -= ny * strength * 2;
                } else if (interactionMode === 'vortex') {
                    this.vx += (-ny * strength + mouseVelocityX * 0.1);
                    this.vy += (nx * strength + mouseVelocityY * 0.1);
                }
            }
        }

        this.vx *= 0.98;
        this.vy *= 0.98;

        const maxSpeed = 6;
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (speed > maxSpeed) {
            this.vx = (this.vx / speed) * maxSpeed;
            this.vy = (this.vy / speed) * maxSpeed;
        }

        this.prevX = this.x;
        this.prevY = this.y;
        this.x += this.vx;
        this.y += this.vy;

        this.life--;

        if (this.x < 0 || this.x > width || this.y < 0 || this.y > height || this.life <= 0) {
            this.reset();
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

        if (particleShape === 'line') {
            ctx.beginPath();
            ctx.moveTo(this.prevX, this.prevY);
            ctx.lineTo(this.x, this.y);
            ctx.stroke();
        } else if (particleShape === 'circle') {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size * 2, 0, Math.PI * 2);
            ctx.fill();
        } else if (particleShape === 'star') {
            this.drawStar(this.x, this.y, 5, this.size * 3, this.size * 1.5);
        } else if (particleShape === 'spark') {
            const len = this.size * 4;
            ctx.beginPath();
            ctx.moveTo(this.x - len, this.y);
            ctx.lineTo(this.x + len, this.y);
            ctx.moveTo(this.x, this.y - len);
            ctx.lineTo(this.x, this.y + len);
            ctx.moveTo(this.x - len * 0.7, this.y - len * 0.7);
            ctx.lineTo(this.x + len * 0.7, this.y + len * 0.7);
            ctx.moveTo(this.x + len * 0.7, this.y - len * 0.7);
            ctx.lineTo(this.x - len * 0.7, this.y + len * 0.7);
            ctx.stroke();
        } else if (particleShape === 'glow') {
            const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * 6);
            gradient.addColorStop(0, this.color);
            gradient.addColorStop(0.5, this.color + '40');
            gradient.addColorStop(1, 'transparent');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size * 6, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalAlpha = 1;
    }

    drawStar(cx, cy, spikes, outerRadius, innerRadius) {
        let rot = Math.PI / 2 * 3;
        let x = cx;
        let y = cy;
        const step = Math.PI / spikes;

        ctx.beginPath();
        ctx.moveTo(cx, cy - outerRadius);
        for (let i = 0; i < spikes; i++) {
            x = cx + Math.cos(rot) * outerRadius;
            y = cy + Math.sin(rot) * outerRadius;
            ctx.lineTo(x, y);
            rot += step;

            x = cx + Math.cos(rot) * innerRadius;
            y = cy + Math.sin(rot) * innerRadius;
            ctx.lineTo(x, y);
            rot += step;
        }
        ctx.lineTo(cx, cy - outerRadius);
        ctx.closePath();
        ctx.fill();
    }
}

function initParticles() {
    particles = [];
    for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
    }
}

function updateFlowField() {
    let yoff = 0;
    for (let y = 0; y < rows; y++) {
        let xoff = 0;
        for (let x = 0; x < cols; x++) {
            const index = x + y * cols;
            const n = noise3D(xoff, yoff, zoff);
            const angle = n * Math.PI * 4;
            flowField[index] = angle;
            xoff += turbulence;
        }
        yoff += turbulence;
    }
    zoff += 0.002 * flowSpeed;
}

function animate() {
    requestAnimationFrame(animate);

    const theme = colorThemes[currentTheme];

    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = getThemeBackground(theme);
    ctx.globalAlpha = 1 - trailLength;
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1;

    drawBackgroundEffect();

    ctx.globalCompositeOperation = blendMode;

    updateFlowField();

    for (const particle of particles) {
        particle.update();
        particle.draw();
    }

    ctx.globalCompositeOperation = 'source-over';

    if (mouseActive) {
        drawMouseGlow();
    }

    frameCount++;
    const now = performance.now();
    if (now - lastTime >= 1000) {
        fps = Math.round(frameCount * 1000 / (now - lastTime));
        document.getElementById('fps').textContent = fps;
        frameCount = 0;
        lastTime = now;
    }

    document.getElementById('particleCount').textContent = particles.length;
}

function drawMouseGlow() {
    const theme = colorThemes[currentTheme];
    const gradient = ctx.createRadialGradient(mouseX, mouseY, 0, mouseX, mouseY, 150);
    gradient.addColorStop(0, theme.glow);
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.fillRect(mouseX - 150, mouseY - 150, 300, 300);
}

function handleMouseMove(x, y) {
    mouseVelocityX = x - lastMouseX;
    mouseVelocityY = y - lastMouseY;
    lastMouseX = mouseX;
    lastMouseY = mouseY;
    mouseX = x;
    mouseY = y;
    mouseActive = true;
}

canvas.addEventListener('mousemove', (e) => {
    handleMouseMove(e.clientX, e.clientY);
});

canvas.addEventListener('mouseleave', () => {
    mouseActive = false;
});

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    handleMouseMove(touch.clientX, touch.clientY);
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    handleMouseMove(touch.clientX, touch.clientY);
}, { passive: false });

canvas.addEventListener('touchend', () => {
    mouseActive = false;
});

const flowSpeedEl = document.getElementById('flowSpeed');
if (flowSpeedEl) {
    flowSpeedEl.addEventListener('input', (e) => {
        flowSpeed = parseFloat(e.target.value);
        const speedValue = document.getElementById('speedValue');
        if (speedValue) speedValue.textContent = flowSpeed.toFixed(1);
    });
}

const densityEl = document.getElementById('density');
if (densityEl) {
    densityEl.addEventListener('input', (e) => {
        const newCount = parseInt(e.target.value);
        if (newCount > particleCount) {
            for (let i = particleCount; i < newCount; i++) {
                particles.push(new Particle());
            }
        } else {
            particles.length = newCount;
        }
        particleCount = newCount;
        const densityValue = document.getElementById('densityValue');
        if (densityValue) densityValue.textContent = newCount;
    });
}

const turbulenceEl = document.getElementById('turbulence');
if (turbulenceEl) {
    turbulenceEl.addEventListener('input', (e) => {
        turbulence = parseFloat(e.target.value);
        const turbValue = document.getElementById('turbValue');
        if (turbValue) turbValue.textContent = turbulence.toFixed(3);
    });
}

const particleSizeEl = document.getElementById('particleSize');
if (particleSizeEl) {
    particleSizeEl.addEventListener('input', (e) => {
        particleSize = parseFloat(e.target.value);
        const sizeValue = document.getElementById('sizeValue');
        if (sizeValue) sizeValue.textContent = particleSize.toFixed(1);
        for (const particle of particles) {
            particle.size = (Math.random() * 1.5 + 0.5) * particleSize;
        }
    });
}

const trailLengthEl = document.getElementById('trailLength');
if (trailLengthEl) {
    trailLengthEl.addEventListener('input', (e) => {
        trailLength = parseInt(e.target.value) / 100;
        const trailValue = document.getElementById('trailValue');
        if (trailValue) trailValue.textContent = e.target.value + '%';
    });
}

document.getElementById('interactionForce').addEventListener('input', (e) => {
    interactionForce = parseFloat(e.target.value);
    document.getElementById('forceValue').textContent = interactionForce.toFixed(1);
});

document.getElementById('blendMode').addEventListener('change', (e) => {
    blendMode = e.target.value;
});

document.getElementById('bgEffect').addEventListener('change', (e) => {
    bgEffect = e.target.value;
});

document.getElementById('reset').addEventListener('click', () => {
    ctx.fillStyle = getThemeBackground(colorThemes[currentTheme]);
    ctx.fillRect(0, 0, width, height);
    initParticles();
    zoff = 0;
});

document.getElementById('random').addEventListener('click', randomize);

function randomize() {
    const themes = Object.keys(colorThemes);
    const randomTheme = themes[Math.floor(Math.random() * themes.length)];
    currentTheme = randomTheme;

    document.querySelectorAll('.color-swatch').forEach(s => {
        s.classList.toggle('active', s.dataset.theme === randomTheme);
    });
    updateThemeColors();

    const modes = ['attract', 'repel', 'vortex'];
    interactionMode = modes[Math.floor(Math.random() * modes.length)];
    document.querySelectorAll('.interaction-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.mode === interactionMode);
    });

    const shapes = ['line', 'circle', 'star', 'spark', 'glow'];
    particleShape = shapes[Math.floor(Math.random() * shapes.length)];
    document.querySelectorAll('.shape-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.shape === particleShape);
    });

    const blendModes = ['lighter', 'source-over', 'screen', 'overlay', 'color-dodge'];
    blendMode = blendModes[Math.floor(Math.random() * blendModes.length)];
    document.getElementById('blendMode').value = blendMode;

    const bgEffects = ['none', 'stars', 'grid', 'nebula', 'rain'];
    bgEffect = bgEffects[Math.floor(Math.random() * bgEffects.length)];
    document.getElementById('bgEffect').value = bgEffect;

    flowSpeed = Math.random() * 2.5 + 0.5;
    document.getElementById('flowSpeed').value = flowSpeed;
    document.getElementById('speedValue').textContent = flowSpeed.toFixed(1);

    turbulence = Math.random() * 0.012 + 0.002;
    document.getElementById('turbulence').value = turbulence;
    document.getElementById('turbValue').textContent = turbulence.toFixed(3);

    particleSize = Math.random() * 3.5 + 1;
    document.getElementById('particleSize').value = particleSize;
    document.getElementById('sizeValue').textContent = particleSize.toFixed(1);

    trailLength = Math.random() * 0.15 + 0.85;
    document.getElementById('trailLength').value = trailLength * 100;
    document.getElementById('trailValue').textContent = Math.round(trailLength * 100) + '%';

    interactionForce = Math.random() * 7 + 2;
    document.getElementById('interactionForce').value = interactionForce;
    document.getElementById('forceValue').textContent = interactionForce.toFixed(1);

    const newCount = Math.floor(Math.random() * 5000 + 1000);
    if (newCount > particleCount) {
        for (let i = particleCount; i < newCount; i++) {
            particles.push(new Particle());
        }
    } else {
        particles.length = newCount;
    }
    particleCount = newCount;
    document.getElementById('density').value = newCount;
    document.getElementById('densityValue').textContent = newCount;

    for (const particle of particles) {
        particle.color = colorThemes[currentTheme].colors[Math.floor(Math.random() * colorThemes[currentTheme].colors.length)];
        particle.size = (Math.random() * 1.5 + 0.5) * particleSize;
    }

    ctx.fillStyle = getThemeBackground(colorThemes[currentTheme]);
    ctx.fillRect(0, 0, width, height);
}

function updateThemeColors() {
    const theme = colorThemes[currentTheme];
    document.documentElement.style.setProperty('--aurora-1', theme.colors[0]);
    document.documentElement.style.setProperty('--aurora-2', theme.colors[1]);
    document.documentElement.style.setProperty('--aurora-3', theme.colors[2]);
    document.documentElement.style.setProperty('--glow-color', theme.glow);

    for (const particle of particles) {
        particle.color = theme.colors[Math.floor(Math.random() * theme.colors.length)];
    }
}

document.querySelectorAll('.interaction-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.interaction-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        interactionMode = btn.dataset.mode;
    });
});

document.querySelectorAll('.shape-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.shape-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        particleShape = btn.dataset.shape;
    });
});

document.querySelectorAll('.color-swatch').forEach(swatch => {
    swatch.addEventListener('click', () => {
        document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        currentTheme = swatch.dataset.theme;
        updateThemeColors();
    });
});

document.getElementById('fullscreen').addEventListener('click', toggleFullscreen);

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => { });
        document.querySelector('.fullscreen-enter').style.display = 'none';
        document.querySelector('.fullscreen-exit').style.display = 'block';
    } else {
        document.exitFullscreen();
        document.querySelector('.fullscreen-enter').style.display = 'block';
        document.querySelector('.fullscreen-exit').style.display = 'none';
    }
}

document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
        document.querySelector('.fullscreen-enter').style.display = 'block';
        document.querySelector('.fullscreen-exit').style.display = 'none';
    }
});

const controls = document.querySelector('.controls');
const toggleBtn = document.getElementById('toggleControls');
const closeBtn = document.getElementById('closeControls');

toggleBtn.addEventListener('click', () => {
    controls.classList.add('visible');
    toggleBtn.classList.add('hidden');
});

closeBtn.addEventListener('click', () => {
    controls.classList.remove('visible');
    toggleBtn.classList.remove('hidden');
});

// Listen for theme changes (dark/light mode)
const themeObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
            // Force a redraw with the new theme background
            const theme = colorThemes[currentTheme];
            ctx.fillStyle = getThemeBackground(theme);
            ctx.fillRect(0, 0, width, height);
        }
    });
});

themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
});

window.addEventListener('resize', resize);
resize();
animate();
