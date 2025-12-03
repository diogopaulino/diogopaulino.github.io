const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

let width, height;
let particles = [];
let gravity = 0.5;
let friction = 0.98;
let particleSize = 3;
let initialVelocity = 10;
let mouseMode = 'spawn';
let currentTheme = 'neon';
let enableTrails = true;
let enableGlow = true;
let enableBounce = true;

const themes = {
    neon: ['#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b'],
    fire: ['#ff0000', '#ff4d00', '#ff9900', '#ffcc00', '#ffff00'],
    ice: ['#00ffff', '#00ccff', '#0099ff', '#0066ff', '#0033ff'],
    matrix: ['#00ff00', '#00cc00', '#009900', '#006600', '#003300'],
    rainbow: ['#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#0000ff', '#4b0082', '#9400d3'],
    sunset: ['#ff6b6b', '#feca57', '#ff9ff3', '#54a0ff', '#5f27cd'],
    ocean: ['#0077b6', '#00b4d8', '#90e0ef', '#caf0f8', '#03045e'],
    galaxy: ['#9d4edd', '#c77dff', '#e0aaff', '#3c096c', '#240046'],
    aurora: ['#00f5d4', '#00bbf9', '#9b5de5', '#f15bb5', '#fee440'],
    candy: ['#ff6b9d', '#c44569', '#f8b500', '#00d4aa', '#7c3aed']
};

const gravityPresets = {
    '0': { name: 'Sem Gravidade', emoji: '🚀' },
    '0.16': { name: 'Lua', emoji: '🌙' },
    '0.38': { name: 'Marte', emoji: '🔴' },
    '0.5': { name: 'Terra', emoji: '🌍' },
    '0.9': { name: 'Júpiter', emoji: '🟤' }
};

function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
}

window.addEventListener('resize', resize);
resize();

class Particle {
    constructor(x, y, dx, dy, radius, color) {
        this.x = x;
        this.y = y;
        this.dx = dx;
        this.dy = dy;
        this.radius = radius;
        this.color = color;
        this.life = 1;
    }

    update() {
        this.dy += gravity;
        this.dx *= friction;
        this.dy *= friction;

        if (isMouseDown && mouseMode !== 'spawn') {
            const dx = mouseX - this.x;
            const dy = mouseY - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (mouseMode === 'blackhole') {
                const force = 2000 / (distance * distance + 100);
                this.dx += dx * force;
                this.dy += dy * force;
                if (distance < 20) {
                    this.x = mouseX + (Math.random() - 0.5) * 10;
                    this.y = mouseY + (Math.random() - 0.5) * 10;
                    this.dx = (Math.random() - 0.5) * 20;
                    this.dy = (Math.random() - 0.5) * 20;
                }
            } else {
                const force = 500 / (distance * distance + 100);
                if (mouseMode === 'attract') {
                    this.dx += dx * force * 0.5;
                    this.dy += dy * force * 0.5;
                } else if (mouseMode === 'repel') {
                    this.dx -= dx * force * 2;
                    this.dy -= dy * force * 2;
                }
            }
        }

        this.x += this.dx;
        this.y += this.dy;

        if (enableBounce) {
            if (this.y + this.radius > height) {
                this.y = height - this.radius;
                this.dy = -this.dy * 0.7;
            }

            if (this.x + this.radius > width || this.x - this.radius < 0) {
                this.dx = -this.dx * 0.7;
                if (this.x + this.radius > width) this.x = width - this.radius;
                if (this.x - this.radius < 0) this.x = this.radius;
            }

            if (this.y - this.radius < 0) {
                this.y = this.radius;
                this.dy = -this.dy * 0.7;
            }
        } else {
            if (this.x < -this.radius) this.x = width + this.radius;
            if (this.x > width + this.radius) this.x = -this.radius;
            if (this.y < -this.radius) this.y = height + this.radius;
            if (this.y > height + this.radius) this.y = -this.radius;
        }

        this.draw();
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;

        if (enableGlow && particles.length < 400) {
            ctx.shadowBlur = 10;
            ctx.shadowColor = this.color;
        } else {
            ctx.shadowBlur = 0;
        }

        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.closePath();
    }
}

function init() {
    particles = [];
}

function animate() {
    requestAnimationFrame(animate);

    if (enableTrails) {
        ctx.fillStyle = 'rgba(10, 10, 10, 0.2)';
        ctx.fillRect(0, 0, width, height);
    } else {
        ctx.fillStyle = 'rgb(10, 10, 10)';
        ctx.fillRect(0, 0, width, height);
    }

    particles.forEach((particle) => {
        particle.update();
    });

    if (particles.length > 800) {
        particles.splice(0, particles.length - 800);
    }

    document.getElementById('count').innerText = particles.length;
}

let isMouseDown = false;
let mouseX = 0;
let mouseY = 0;

function spawnParticles(x, y, count = 1) {
    const colors = themes[currentTheme];
    for (let i = 0; i < count; i++) {
        const radius = Math.random() * particleSize + 2;
        const color = colors[Math.floor(Math.random() * colors.length)];
        const dx = (Math.random() - 0.5) * initialVelocity;
        const dy = (Math.random() - 0.5) * initialVelocity;
        particles.push(new Particle(x, y, dx, dy, radius, color));
    }
}

function handleInput(x, y) {
    mouseX = x;
    mouseY = y;
    if (isMouseDown && mouseMode === 'spawn') {
        spawnParticles(x, y, 5);
    }
}

canvas.addEventListener('mousedown', (e) => {
    isMouseDown = true;
    handleInput(e.clientX, e.clientY);
});

canvas.addEventListener('mousemove', (e) => {
    handleInput(e.clientX, e.clientY);
});

canvas.addEventListener('mouseup', () => {
    isMouseDown = false;
});

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    isMouseDown = true;
    const touch = e.touches[0];
    handleInput(touch.clientX, touch.clientY);
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    handleInput(touch.clientX, touch.clientY);
}, { passive: false });

canvas.addEventListener('touchend', () => {
    isMouseDown = false;
});

const gravityInput = document.getElementById('gravity');
const frictionInput = document.getElementById('friction');
const sizeInput = document.getElementById('size');
const velocityInput = document.getElementById('velocity');
const clearBtn = document.getElementById('clear');
const randomBtn = document.getElementById('random');
const themeSelect = document.getElementById('theme-select');
const modeBtns = document.querySelectorAll('.toggle-btn');
const presetBtns = document.querySelectorAll('.preset-btn');
const trailsCheckbox = document.getElementById('trails');
const glowCheckbox = document.getElementById('glow');
const bounceCheckbox = document.getElementById('bounce');
const fullscreenBtn = document.getElementById('fullscreen-btn');

gravityInput.addEventListener('input', (e) => {
    gravity = parseFloat(e.target.value);
    updatePresetActiveState();
});

frictionInput.addEventListener('input', (e) => {
    friction = parseFloat(e.target.value);
});

sizeInput.addEventListener('input', (e) => {
    particleSize = parseFloat(e.target.value);
});

velocityInput.addEventListener('input', (e) => {
    initialVelocity = parseFloat(e.target.value);
});

clearBtn.addEventListener('click', () => {
    particles = [];
});

themeSelect.addEventListener('change', (e) => {
    currentTheme = e.target.value;
});

modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        modeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        mouseMode = btn.dataset.mode;
    });
});

presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const gravityValue = parseFloat(btn.dataset.gravity);
        gravity = gravityValue;
        gravityInput.value = gravityValue;
        updatePresetActiveState();
    });
});

function updatePresetActiveState() {
    presetBtns.forEach(btn => {
        const presetValue = parseFloat(btn.dataset.gravity);
        if (Math.abs(gravity - presetValue) < 0.02) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

trailsCheckbox.addEventListener('change', (e) => {
    enableTrails = e.target.checked;
});

glowCheckbox.addEventListener('change', (e) => {
    enableGlow = e.target.checked;
});

bounceCheckbox.addEventListener('change', (e) => {
    enableBounce = e.target.checked;
});

randomBtn.addEventListener('click', () => {
    const themeKeys = Object.keys(themes);
    const randomTheme = themeKeys[Math.floor(Math.random() * themeKeys.length)];
    currentTheme = randomTheme;
    themeSelect.value = randomTheme;

    gravity = Math.random() * 1.5 - 0.5;
    gravityInput.value = gravity;
    updatePresetActiveState();

    friction = 0.9 + Math.random() * 0.099;
    frictionInput.value = friction;

    particleSize = 1 + Math.floor(Math.random() * 14);
    sizeInput.value = particleSize;

    initialVelocity = 1 + Math.floor(Math.random() * 29);
    velocityInput.value = initialVelocity;

    enableTrails = Math.random() > 0.3;
    trailsCheckbox.checked = enableTrails;

    enableGlow = Math.random() > 0.3;
    glowCheckbox.checked = enableGlow;

    enableBounce = Math.random() > 0.3;
    bounceCheckbox.checked = enableBounce;

    const modes = ['spawn', 'attract', 'repel', 'blackhole'];
    const randomMode = modes[Math.floor(Math.random() * modes.length)];
    mouseMode = randomMode;
    modeBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === randomMode);
    });
});

fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().then(() => {
            document.body.classList.add('fullscreen');
        }).catch(() => {});
    } else {
        document.exitFullscreen().then(() => {
            document.body.classList.remove('fullscreen');
        }).catch(() => {});
    }
});

document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
        document.body.classList.remove('fullscreen');
    }
});

init();
animate();
