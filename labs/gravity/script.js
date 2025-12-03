const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

let width, height;
let particles = [];
let gravity = 0.5;
let friction = 0.98;
let particleSize = 3;
let mouseMode = 'spawn'; // spawn, attract, repel, blackhole
let currentTheme = 'neon';

// Themes
const themes = {
    neon: ['#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b'],
    fire: ['#ff0000', '#ff4d00', '#ff9900', '#ffcc00', '#ffff00'],
    ice: ['#00ffff', '#00ccff', '#0099ff', '#0066ff', '#0033ff'],
    matrix: ['#00ff00', '#00cc00', '#009900', '#006600', '#003300'],
    rainbow: ['#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#0000ff', '#4b0082', '#9400d3']
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
        // Apply gravity
        this.dy += gravity;

        // Apply friction
        this.dx *= friction;
        this.dy *= friction;

        // Mouse Interaction
        if (isMouseDown && mouseMode !== 'spawn') {
            const dx = mouseX - this.x;
            const dy = mouseY - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (mouseMode === 'blackhole') {
                const force = 2000 / (distance * distance + 100);
                this.dx += dx * force;
                this.dy += dy * force;
                // Suck particles in
                if (distance < 20) {
                    this.x = mouseX + (Math.random() - 0.5) * 10;
                    this.y = mouseY + (Math.random() - 0.5) * 10;
                    this.dx = (Math.random() - 0.5) * 20;
                    this.dy = (Math.random() - 0.5) * 20;
                }
            } else {
                const force = 500 / (distance * distance + 100); // Inverse square law with dampening
                if (mouseMode === 'attract') {
                    this.dx += dx * force * 0.5;
                    this.dy += dy * force * 0.5;
                } else if (mouseMode === 'repel') {
                    this.dx -= dx * force * 2;
                    this.dy -= dy * force * 2;
                }
            }
        }

        // Update position
        this.x += this.dx;
        this.y += this.dy;

        // Bounce off floor
        if (this.y + this.radius > height) {
            this.y = height - this.radius;
            this.dy = -this.dy * 0.7;
        }

        // Bounce off walls
        if (this.x + this.radius > width || this.x - this.radius < 0) {
            this.dx = -this.dx * 0.7;
            if (this.x + this.radius > width) this.x = width - this.radius;
            if (this.x - this.radius < 0) this.x = this.radius;
        }

        // Bounce off ceiling
        if (this.y - this.radius < 0) {
            this.y = this.radius;
            this.dy = -this.dy * 0.7;
        }

        this.draw();
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;

        // Glow effect (expensive, so keep blur low)
        if (particles.length < 400) {
            ctx.shadowBlur = 10;
            ctx.shadowColor = this.color;
        } else {
            ctx.shadowBlur = 0;
        }

        ctx.fill();
        ctx.shadowBlur = 0; // Reset
        ctx.closePath();
    }
}

function init() {
    particles = [];
}

function animate() {
    requestAnimationFrame(animate);

    // Clear canvas with trail effect
    ctx.fillStyle = 'rgba(10, 10, 10, 0.2)';
    ctx.fillRect(0, 0, width, height);

    particles.forEach((particle, index) => {
        particle.update();
    });

    // Limit particles for performance
    if (particles.length > 800) {
        particles.splice(0, particles.length - 800);
    }

    // Update count
    document.getElementById('count').innerText = particles.length;
}

// Interaction
let isMouseDown = false;
let mouseX = 0;
let mouseY = 0;

function spawnParticles(x, y, count = 1) {
    const colors = themes[currentTheme];
    for (let i = 0; i < count; i++) {
        const radius = Math.random() * particleSize + 2;
        const color = colors[Math.floor(Math.random() * colors.length)];
        const dx = (Math.random() - 0.5) * 10;
        const dy = (Math.random() - 0.5) * 10;
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

// Controls
const gravityInput = document.getElementById('gravity');
const frictionInput = document.getElementById('friction');
const sizeInput = document.getElementById('size');
const clearBtn = document.getElementById('clear');
const themeSelect = document.getElementById('theme-select');
const modeBtns = document.querySelectorAll('.toggle-btn');

gravityInput.addEventListener('input', (e) => {
    gravity = parseFloat(e.target.value);
});

frictionInput.addEventListener('input', (e) => {
    friction = parseFloat(e.target.value);
});

sizeInput.addEventListener('input', (e) => {
    particleSize = parseFloat(e.target.value);
});

clearBtn.addEventListener('click', () => {
    particles = [];
});

themeSelect.addEventListener('change', (e) => {
    currentTheme = e.target.value;
});

modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        // Update active state
        modeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Set mode
        mouseMode = btn.dataset.mode;
    });
});

// Start
init();
animate();
