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

let mouseX = -1000;
let mouseY = -1000;
let mouseActive = false;
let lastMouseX = 0;
let lastMouseY = 0;
let mouseVelocityX = 0;
let mouseVelocityY = 0;

const colorThemes = {
    aurora: {
        colors: ['#00ff88', '#00d4ff', '#8b5cf6', '#00ffcc', '#4ade80'],
        bg: 'rgba(0, 8, 20, 1)',
        glow: 'rgba(0, 255, 136, 0.15)'
    },
    sunset: {
        colors: ['#ff6b6b', '#feca57', '#ff9ff3', '#ff9500', '#ff2d55'],
        bg: 'rgba(20, 8, 15, 1)',
        glow: 'rgba(255, 107, 107, 0.15)'
    },
    ocean: {
        colors: ['#0066ff', '#00ffff', '#00ff99', '#00ccff', '#66ffcc'],
        bg: 'rgba(0, 10, 25, 1)',
        glow: 'rgba(0, 102, 255, 0.15)'
    },
    cosmic: {
        colors: ['#8b5cf6', '#ec4899', '#f43f5e', '#a855f7', '#d946ef'],
        bg: 'rgba(15, 5, 20, 1)',
        glow: 'rgba(139, 92, 246, 0.15)'
    },
    neon: {
        colors: ['#39ff14', '#ff073a', '#00fff7', '#f5d300', '#ff6ec7'],
        bg: 'rgba(5, 5, 10, 1)',
        glow: 'rgba(57, 255, 20, 0.15)'
    }
};

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

const permutation = [151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,
    8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,
    33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,
    83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,
    80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,
    64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,
    189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,
    253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,
    12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,
    115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];
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
        this.size = Math.random() * 1.5 + 0.5;
        this.life = Math.random() * 200 + 100;
        this.maxLife = this.life;
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
        }
        
        if (mouseActive) {
            const dx = mouseX - this.x;
            const dy = mouseY - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const maxDist = 200;
            
            if (dist < maxDist) {
                const strength = (1 - dist / maxDist) * 3;
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
        
        ctx.beginPath();
        ctx.moveTo(this.prevX, this.prevY);
        ctx.lineTo(this.x, this.y);
        ctx.strokeStyle = this.color;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = this.size;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.globalAlpha = 1;
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
    
    ctx.fillStyle = theme.bg;
    ctx.globalAlpha = 0.05;
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1;
    
    updateFlowField();
    
    for (const particle of particles) {
        particle.update();
        particle.draw();
    }
    
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

document.getElementById('flowSpeed').addEventListener('input', (e) => {
    flowSpeed = parseFloat(e.target.value);
});

document.getElementById('density').addEventListener('input', (e) => {
    const newCount = parseInt(e.target.value);
    if (newCount > particleCount) {
        for (let i = particleCount; i < newCount; i++) {
            particles.push(new Particle());
        }
    } else {
        particles.length = newCount;
    }
    particleCount = newCount;
});

document.getElementById('turbulence').addEventListener('input', (e) => {
    turbulence = parseFloat(e.target.value);
});

document.getElementById('reset').addEventListener('click', () => {
    ctx.fillStyle = colorThemes[currentTheme].bg;
    ctx.fillRect(0, 0, width, height);
    initParticles();
    zoff = 0;
});

document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        interactionMode = btn.dataset.mode;
    });
});

document.querySelectorAll('.color-swatch').forEach(swatch => {
    swatch.addEventListener('click', () => {
        document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        currentTheme = swatch.dataset.theme;
        
        const theme = colorThemes[currentTheme];
        document.documentElement.style.setProperty('--aurora-1', theme.colors[0]);
        document.documentElement.style.setProperty('--aurora-2', theme.colors[1]);
        document.documentElement.style.setProperty('--aurora-3', theme.colors[2]);
        document.documentElement.style.setProperty('--glow-color', theme.glow);
        
        for (const particle of particles) {
            particle.color = theme.colors[Math.floor(Math.random() * theme.colors.length)];
        }
    });
});

window.addEventListener('resize', resize);
resize();
animate();

