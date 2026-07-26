(function () {
    'use strict';

    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d', {
        alpha: false,
        desynchronized: true
    });

    let width, height;

    // ---- Physics constants ----
    const G_BASE = 0.05;
    const MASS_K = 8;
    const SOFTEN = 80;
    const SLING_K = 0.02;
    const MAX_PARTICLES = 500;
    const MAX_BODIES = 40;

    // ---- State ----
    let particles = [];
    let bodies = [];
    let running = true;

    let ambientGravity = 0;
    let gStrength = 1;
    let friction = 1;
    let particleSize = 3;
    let initialVelocity = 10;
    let bodySizeSetting = 18;
    let bodiesAttract = false;
    let absorbEnabled = true;

    let mouseMode = 'spawn';
    let currentTheme = 'neon';
    let enableTrails = true;
    let enableGlow = true;
    let enableBounce = true;
    let enableStars = true;
    let velocityColorMode = false;
    let additiveBlend = false;
    let currentScenario = 'solar';

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

    function hexToRgb(hex) {
        const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : { r: 255, g: 255, b: 255 };
    }

    function resize() {
        const newWidth = window.innerWidth;
        const newHeight = window.innerHeight;
        if (newWidth === 0 || newHeight === 0) return;

        const oldWidth = width;
        const oldHeight = height;
        width = canvas.width = newWidth;
        height = canvas.height = newHeight;
        generateStars();

        if (oldWidth > 0 && oldHeight > 0 && (oldWidth !== width || oldHeight !== height)) {
            // Uniform scale around the new center keeps orbits circular instead of
            // stretching them into ellipses when the aspect ratio changes.
            const scale = Math.min(width / oldWidth, height / oldHeight);
            const oldCx = oldWidth / 2;
            const oldCy = oldHeight / 2;
            const newCx = width / 2;
            const newCy = height / 2;
            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];
                p.x = newCx + (p.x - oldCx) * scale;
                p.y = newCy + (p.y - oldCy) * scale;
                p.vx *= scale;
                p.vy *= scale;
            }
            for (let i = 0; i < bodies.length; i++) {
                const b = bodies[i];
                b.x = newCx + (b.x - oldCx) * scale;
                b.y = newCy + (b.y - oldCy) * scale;
                b.vx *= scale;
                b.vy *= scale;
            }
        } else if (!oldWidth) {
            loadScenario(currentScenario);
        }
    }

    // ---- Starfield ----
    let stars = [];
    function generateStars() {
        stars = [];
        const count = Math.floor((width * height) / 9000);
        for (let i = 0; i < count; i++) {
            stars.push({
                x: Math.random() * width,
                y: Math.random() * height,
                r: Math.random() * 1.3 + 0.3,
                phase: Math.random() * Math.PI * 2,
                speed: 0.4 + Math.random() * 1.4
            });
        }
    }

    function drawStars(t) {
        for (let i = 0; i < stars.length; i++) {
            const s = stars[i];
            const tw = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * 0.0008 * s.speed + s.phase));
            ctx.globalAlpha = tw * 0.85;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    // ---- Particle ----
    class Particle {
        constructor(x, y, vx, vy, radius, color) {
            this.x = x;
            this.y = y;
            this.vx = vx;
            this.vy = vy;
            this.radius = radius;
            this.color = color;
            this.absorbed = false;
        }

        update() {
            this.vy += ambientGravity;

            for (let i = 0; i < bodies.length; i++) {
                const b = bodies[i];
                const dx = b.x - this.x;
                const dy = b.y - this.y;
                const distSq = dx * dx + dy * dy + SOFTEN;

                if (absorbEnabled) {
                    const rSum = b.radius + this.radius;
                    if (distSq < rSum * rSum) {
                        this.absorbed = true;
                        b.grow(this.radius);
                        continue;
                    }
                }

                const dist = Math.sqrt(distSq);
                const g = (G_BASE * gStrength * b.mass) / distSq;
                this.vx += (g * dx) / dist;
                this.vy += (g * dy) / dist;
            }

            if (this.absorbed) return;

            this.vx *= friction;
            this.vy *= friction;

            if (isPointerDown && mouseMode !== 'spawn' && mouseMode !== 'body' && mouseMode !== 'erase') {
                const dx = pointerX - this.x;
                const dy = pointerY - this.y;
                const distSq = dx * dx + dy * dy;
                const distance = Math.sqrt(distSq);

                if (mouseMode === 'blackhole') {
                    const force = 2000 / (distSq + 100);
                    this.vx += dx * force;
                    this.vy += dy * force;
                    if (distance < 20) {
                        this.x = pointerX + (Math.random() - 0.5) * 10;
                        this.y = pointerY + (Math.random() - 0.5) * 10;
                        this.vx = (Math.random() - 0.5) * 20;
                        this.vy = (Math.random() - 0.5) * 20;
                    }
                } else {
                    const force = 500 / (distSq + 100);
                    if (mouseMode === 'attract') {
                        this.vx += dx * force * 0.5;
                        this.vy += dy * force * 0.5;
                    } else if (mouseMode === 'repel') {
                        this.vx -= dx * force * 2;
                        this.vy -= dy * force * 2;
                    }
                }
            }

            this.x += this.vx;
            this.y += this.vy;

            if (enableBounce) {
                if (this.y + this.radius > height) {
                    this.y = height - this.radius;
                    this.vy = -this.vy * 0.7;
                }
                if (this.x + this.radius > width || this.x - this.radius < 0) {
                    this.vx = -this.vx * 0.7;
                    if (this.x + this.radius > width) this.x = width - this.radius;
                    if (this.x - this.radius < 0) this.x = this.radius;
                }
                if (this.y - this.radius < 0) {
                    this.y = this.radius;
                    this.vy = -this.vy * 0.7;
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
            let color = this.color;
            if (velocityColorMode) {
                const speed = Math.hypot(this.vx, this.vy);
                const hue = Math.max(0, 265 - speed * 20);
                color = `hsl(${hue}, 92%, 62%)`;
            }

            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = color;

            if (enableGlow && this.radius > 2.5 && particles.length < 260) {
                ctx.shadowBlur = 9;
                ctx.shadowColor = color;
            } else {
                ctx.shadowBlur = 0;
            }

            ctx.fill();
            ctx.shadowBlur = 0;
        }
    }

    // ---- Body (gravity attractor) ----
    class Body {
        constructor(x, y, vx, vy, radius, color, type) {
            this.x = x;
            this.y = y;
            this.vx = vx;
            this.vy = vy;
            this.radius = radius;
            this.maxRadius = Math.min(95, radius * 2.6);
            this.color = color;
            this.rgb = hexToRgb(color);
            this.type = type || 'star';
            this.pulse = 0;
            this.ringAngle = Math.random() * Math.PI * 2;
            this.updateMass();
        }

        updateMass() {
            this.mass = this.radius * this.radius * MASS_K * (this.type === 'blackhole' ? 8 : 1);
        }

        grow(amount) {
            if (this.radius < this.maxRadius) {
                this.radius = Math.min(this.maxRadius, this.radius + amount * 0.035);
                this.updateMass();
            }
            this.pulse = 1;
        }

        colorAlpha(a) {
            return `rgba(${this.rgb.r}, ${this.rgb.g}, ${this.rgb.b}, ${a})`;
        }

        integrate() {
            this.x += this.vx;
            this.y += this.vy;

            if (this.x < -this.radius * 2) this.x = width + this.radius * 2;
            if (this.x > width + this.radius * 2) this.x = -this.radius * 2;
            if (this.y < -this.radius * 2) this.y = height + this.radius * 2;
            if (this.y > height + this.radius * 2) this.y = -this.radius * 2;

            if (this.pulse > 0) this.pulse -= 0.03;
        }

        draw() {
            if (this.type === 'blackhole') {
                const grad = ctx.createRadialGradient(this.x, this.y, this.radius * 0.15, this.x, this.y, this.radius * 2.4);
                grad.addColorStop(0, 'rgba(255, 205, 130, 0.9)');
                grad.addColorStop(0.18, 'rgba(255, 140, 60, 0.5)');
                grad.addColorStop(0.45, 'rgba(130, 50, 190, 0.22)');
                grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius * 2.4, 0, Math.PI * 2);
                ctx.fill();

                this.ringAngle += 0.015;
                ctx.strokeStyle = 'rgba(255, 214, 160, 0.9)';
                ctx.lineWidth = Math.max(2, this.radius * 0.12);
                ctx.beginPath();
                ctx.ellipse(this.x, this.y, this.radius * 1.7, this.radius * 0.5, this.ringAngle, 0, Math.PI * 2);
                ctx.stroke();

                ctx.fillStyle = '#050208';
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                ctx.fill();
            } else {
                const glowR = this.radius * (2.2 + this.pulse * 0.6);
                const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, glowR);
                grad.addColorStop(0, this.colorAlpha(0.95));
                grad.addColorStop(0.35, this.colorAlpha(0.45));
                grad.addColorStop(1, this.colorAlpha(0));
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(this.x, this.y, glowR, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
                ctx.beginPath();
                ctx.arc(this.x - this.radius * 0.3, this.y - this.radius * 0.3, this.radius * 0.35, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    function updateBodies() {
        if (bodiesAttract) {
            for (let i = 0; i < bodies.length; i++) {
                const a = bodies[i];
                for (let j = i + 1; j < bodies.length; j++) {
                    const b = bodies[j];
                    const dx = b.x - a.x;
                    const dy = b.y - a.y;
                    const distSq = dx * dx + dy * dy + SOFTEN;
                    const dist = Math.sqrt(distSq);

                    const aAcc = (G_BASE * gStrength * b.mass) / distSq;
                    a.vx += (aAcc * dx) / dist;
                    a.vy += (aAcc * dy) / dist;

                    const bAcc = (G_BASE * gStrength * a.mass) / distSq;
                    b.vx -= (bAcc * dx) / dist;
                    b.vy -= (bAcc * dy) / dist;
                }
            }
        }

        for (let i = 0; i < bodies.length; i++) {
            bodies[i].integrate();
        }

        if (bodiesAttract) mergeBodies();
    }

    function mergeBodies() {
        for (let i = bodies.length - 1; i >= 0; i--) {
            for (let j = i - 1; j >= 0; j--) {
                const a = bodies[i];
                const b = bodies[j];
                const dx = a.x - b.x;
                const dy = a.y - b.y;
                const dist = Math.hypot(dx, dy);

                if (dist < (a.radius + b.radius) * 0.55) {
                    const totalMass = a.mass + b.mass;
                    b.x = (a.x * a.mass + b.x * b.mass) / totalMass;
                    b.y = (a.y * a.mass + b.y * b.mass) / totalMass;
                    b.vx = (a.vx * a.mass + b.vx * b.mass) / totalMass;
                    b.vy = (a.vy * a.mass + b.vy * b.mass) / totalMass;
                    if (a.type === 'blackhole' || b.type === 'blackhole') b.type = 'blackhole';
                    if (a.radius > b.radius) {
                        b.color = a.color;
                        b.rgb = a.rgb;
                    }
                    b.radius = Math.min(95, Math.sqrt(a.radius * a.radius + b.radius * b.radius));
                    b.maxRadius = Math.max(b.maxRadius, a.maxRadius, b.radius * 1.4);
                    b.updateMass();
                    b.pulse = 1;
                    bodies.splice(i, 1);
                    break;
                }
            }
        }
    }

    // ---- Spawning ----
    function spawnParticles(x, y, count) {
        if (particles.length >= MAX_PARTICLES) return;
        const colors = themes[currentTheme];
        for (let i = 0; i < count && particles.length < MAX_PARTICLES; i++) {
            const radius = Math.random() * particleSize + 2;
            const color = colors[Math.floor(Math.random() * colors.length)];
            const vx = (Math.random() - 0.5) * initialVelocity;
            const vy = (Math.random() - 0.5) * initialVelocity;
            particles.push(new Particle(x, y, vx, vy, radius, color));
        }
    }

    function addBody(x, y, vx, vy, radius) {
        if (bodies.length >= MAX_BODIES) return;
        const colors = themes[currentTheme];
        const color = colors[Math.floor(Math.random() * colors.length)];
        bodies.push(new Body(x, y, vx, vy, radius, color, 'star'));
    }

    function eraseAt(x, y) {
        for (let i = bodies.length - 1; i >= 0; i--) {
            if (Math.hypot(bodies[i].x - x, bodies[i].y - y) < bodies[i].radius + 18) {
                bodies.splice(i, 1);
            }
        }
        for (let i = particles.length - 1; i >= 0; i--) {
            if (Math.hypot(particles[i].x - x, particles[i].y - y) < 34) {
                particles.splice(i, 1);
            }
        }
    }

    function orbitVelocity(mass, r) {
        const distSq = r * r + SOFTEN;
        const a = (G_BASE * gStrength * mass) / distSq;
        return Math.sqrt(a * r);
    }

    function clearAll() {
        particles = [];
        bodies = [];
    }

    // ---- Scenarios ----
    function scenarioSolar() {
        clearAll();
        ambientGravity = 0;
        friction = 1;
        bodiesAttract = false;
        absorbEnabled = true;
        gStrength = 1;

        const cx = width / 2;
        const cy = height / 2;
        const sun = new Body(cx, cy, 0, 0, 34, '#ffd35c', 'star');
        bodies.push(sun);

        const planetDefs = [
            { r: 70, radius: 6, color: '#9ca3af' },
            { r: 105, radius: 8, color: '#f59e0b' },
            { r: 145, radius: 9, color: '#3b82f6' },
            { r: 190, radius: 7, color: '#ef4444' },
            { r: 250, radius: 15, color: '#d97706' }
        ];

        planetDefs.forEach((def) => {
            const angle = Math.random() * Math.PI * 2;
            const px = cx + Math.cos(angle) * def.r;
            const py = cy + Math.sin(angle) * def.r;
            const v = orbitVelocity(sun.mass, def.r);
            const vx = -Math.sin(angle) * v;
            const vy = Math.cos(angle) * v;
            bodies.push(new Body(px, py, vx, vy, def.radius, def.color, 'planet'));
        });

        for (let i = 0; i < 60; i++) {
            const r = 215 + Math.random() * 20;
            const angle = Math.random() * Math.PI * 2;
            const x = cx + Math.cos(angle) * r;
            const y = cy + Math.sin(angle) * r;
            const v = orbitVelocity(sun.mass, r);
            const vx = -Math.sin(angle) * v;
            const vy = Math.cos(angle) * v;
            particles.push(new Particle(x, y, vx, vy, 1 + Math.random() * 1.5, '#c4b5fd'));
        }
    }

    function scenarioBinary() {
        clearAll();
        ambientGravity = 0;
        friction = 1;
        bodiesAttract = true;
        absorbEnabled = true;
        gStrength = 1;

        const cx = width / 2;
        const cy = height / 2;
        const sep = 160;
        const radius = 24;
        const starA = new Body(cx - sep / 2, cy, 0, 0, radius, '#60a5fa', 'star');
        const starB = new Body(cx + sep / 2, cy, 0, 0, radius, '#f472b6', 'star');
        const v = Math.sqrt((G_BASE * gStrength * (starA.mass + starB.mass)) / (4 * sep));
        starA.vy = -v;
        starB.vy = v;
        bodies.push(starA, starB);

        const comboMass = starA.mass + starB.mass;
        const colors = themes[currentTheme];
        for (let i = 0; i < 90; i++) {
            const r = 240 + Math.random() * 140;
            const angle = Math.random() * Math.PI * 2;
            const x = cx + Math.cos(angle) * r;
            const y = cy + Math.sin(angle) * r;
            const vOrb = orbitVelocity(comboMass, r);
            const vx = -Math.sin(angle) * vOrb;
            const vy = Math.cos(angle) * vOrb;
            particles.push(new Particle(x, y, vx, vy, 1 + Math.random() * 2, colors[i % colors.length]));
        }
    }

    function scenarioBlackhole() {
        clearAll();
        ambientGravity = 0;
        friction = 1;
        bodiesAttract = false;
        absorbEnabled = true;
        gStrength = 1.3;

        const cx = width / 2;
        const cy = height / 2;
        const bh = new Body(cx, cy, 0, 0, 26, '#1a1a2e', 'blackhole');
        bodies.push(bh);

        for (let i = 0; i < 140; i++) {
            const r = 70 + Math.random() * 220;
            const angle = Math.random() * Math.PI * 2;
            const x = cx + Math.cos(angle) * r;
            const y = cy + Math.sin(angle) * r;
            const v = orbitVelocity(bh.mass, r) * (0.85 + Math.random() * 0.3);
            const vx = -Math.sin(angle) * v;
            const vy = Math.cos(angle) * v;
            const heatColor = r < 130 ? '#fde68a' : r < 200 ? '#fb923c' : '#a78bfa';
            particles.push(new Particle(x, y, vx, vy, 1 + Math.random() * 2.2, heatColor));
        }
    }

    function makeMiniGalaxy(cx, cy, color, driftVx, driftVy) {
        const core = new Body(cx, cy, driftVx, driftVy, 22, color, 'star');
        bodies.push(core);
        const colors = themes[currentTheme];
        for (let i = 0; i < 70; i++) {
            const r = 40 + Math.random() * 130;
            const angle = Math.random() * Math.PI * 2;
            const x = cx + Math.cos(angle) * r;
            const y = cy + Math.sin(angle) * r;
            const v = orbitVelocity(core.mass, r);
            const vx = -Math.sin(angle) * v + driftVx;
            const vy = Math.cos(angle) * v + driftVy;
            particles.push(new Particle(x, y, vx, vy, 1 + Math.random() * 2, colors[i % colors.length]));
        }
    }

    function scenarioGalaxy() {
        clearAll();
        ambientGravity = 0;
        friction = 1;
        bodiesAttract = true;
        absorbEnabled = true;
        gStrength = 1;

        const cy = height / 2;
        makeMiniGalaxy(width * 0.28, cy, '#60a5fa', 1.1, 0);
        makeMiniGalaxy(width * 0.72, cy, '#f472b6', -1.1, 0);
    }

    function scenarioChaos() {
        clearAll();
        ambientGravity = 0;
        friction = 0.999;
        bodiesAttract = true;
        absorbEnabled = true;
        gStrength = 1.5;

        const n = 4 + Math.floor(Math.random() * 3);
        const colors = themes[currentTheme];
        for (let i = 0; i < n; i++) {
            const radius = 10 + Math.random() * 22;
            const x = Math.random() * width;
            const y = Math.random() * height;
            const vx = (Math.random() - 0.5) * 3;
            const vy = (Math.random() - 0.5) * 3;
            bodies.push(new Body(x, y, vx, vy, radius, colors[i % colors.length], 'star'));
        }
        for (let i = 0; i < 120; i++) {
            spawnParticles(Math.random() * width, Math.random() * height, 1);
        }
    }

    function scenarioClassic() {
        clearAll();
        ambientGravity = 0.5;
        friction = 0.98;
        bodiesAttract = false;
        absorbEnabled = false;
        gStrength = 1;
        spawnParticles(width / 2, height / 2, 30);
    }

    const scenarios = {
        solar: scenarioSolar,
        binary: scenarioBinary,
        blackhole: scenarioBlackhole,
        galaxy: scenarioGalaxy,
        chaos: scenarioChaos,
        classic: scenarioClassic
    };

    function loadScenario(name) {
        if (!scenarios[name]) return;
        if (width && height) {
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = '#06060e';
            ctx.fillRect(0, 0, width, height);
        }
        scenarios[name]();
        currentScenario = name;
        syncUIFromState();
        document.querySelectorAll('.scenario-btn').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.scenario === name);
        });
    }

    // ---- Input handling ----
    let isPointerDown = false;
    let pointerX = 0;
    let pointerY = 0;
    let slingActive = false;
    let slingStart = null;

    const slingshotHint = document.getElementById('slingshotHint');

    function canvasPoint(clientX, clientY) {
        const rect = canvas.getBoundingClientRect();
        return { x: clientX - rect.left, y: clientY - rect.top };
    }

    function pointerDown(x, y) {
        pointerX = x;
        pointerY = y;

        if (mouseMode === 'body') {
            slingActive = true;
            slingStart = { x, y };
            showSlingshotHint(x, y);
        } else if (mouseMode === 'spawn') {
            isPointerDown = true;
            spawnParticles(x, y, 10);
        } else if (mouseMode === 'erase') {
            isPointerDown = true;
            eraseAt(x, y);
        } else {
            isPointerDown = true;
        }
    }

    function pointerMove(x, y) {
        pointerX = x;
        pointerY = y;

        if (slingActive) {
            showSlingshotHint(x, y);
        } else if (isPointerDown && mouseMode === 'spawn') {
            spawnParticles(x, y, 2);
        } else if (isPointerDown && mouseMode === 'erase') {
            eraseAt(x, y);
        }
    }

    function pointerUp() {
        if (slingActive) {
            const dx = slingStart.x - pointerX;
            const dy = slingStart.y - pointerY;
            addBody(slingStart.x, slingStart.y, dx * SLING_K, dy * SLING_K, bodySizeSetting);
            slingActive = false;
            slingshotHint.classList.remove('visible');
        }
        isPointerDown = false;
    }

    function showSlingshotHint(x, y) {
        if (!slingStart) return;
        const dx = slingStart.x - x;
        const dy = slingStart.y - y;
        const speed = Math.hypot(dx, dy) * SLING_K;
        slingshotHint.style.left = slingStart.x + 'px';
        slingshotHint.style.top = slingStart.y + 'px';
        slingshotHint.textContent = speed > 0.15 ? `lançar ${speed.toFixed(1)}` : 'solte para criar';
        slingshotHint.classList.add('visible');
    }

    function drawSlingshotPreview() {
        if (!slingActive || !slingStart) return;
        ctx.save();
        ctx.setLineDash([6, 6]);
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.85)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(slingStart.x, slingStart.y);
        ctx.lineTo(pointerX, pointerY);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = 'rgba(251, 191, 36, 0.25)';
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.8)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(slingStart.x, slingStart.y, bodySizeSetting, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }

    canvas.addEventListener('mousedown', (e) => {
        const p = canvasPoint(e.clientX, e.clientY);
        pointerDown(p.x, p.y);
    });
    canvas.addEventListener('mousemove', (e) => {
        const p = canvasPoint(e.clientX, e.clientY);
        pointerMove(p.x, p.y);
    });
    window.addEventListener('mouseup', pointerUp);

    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const p = canvasPoint(touch.clientX, touch.clientY);
        pointerDown(p.x, p.y);
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const p = canvasPoint(touch.clientX, touch.clientY);
        pointerMove(p.x, p.y);
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        pointerUp();
    }, { passive: false });

    // ---- Animation loop ----
    let lastFpsUpdate = 0;
    let frameCount = 0;

    function updateFps(now) {
        frameCount++;
        if (now - lastFpsUpdate > 500) {
            const fps = Math.round((frameCount * 1000) / (now - lastFpsUpdate));
            const el = document.getElementById('fps');
            if (el) el.innerText = fps;
            frameCount = 0;
            lastFpsUpdate = now;
        }
    }

    function animate(now) {
        requestAnimationFrame(animate);
        if (!running) return;
        now = now || performance.now();
        updateFps(now);

        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = enableTrails ? 'rgba(6, 6, 14, 0.22)' : '#06060e';
        ctx.fillRect(0, 0, width, height);

        if (enableStars) drawStars(now);

        ctx.globalCompositeOperation = additiveBlend ? 'lighter' : 'source-over';
        for (let i = particles.length - 1; i >= 0; i--) {
            particles[i].update();
            if (particles[i].absorbed) particles.splice(i, 1);
        }
        ctx.globalCompositeOperation = 'source-over';

        updateBodies();
        for (let i = 0; i < bodies.length; i++) bodies[i].draw();

        if (particles.length > MAX_PARTICLES) {
            particles.splice(0, particles.length - MAX_PARTICLES);
        }

        drawSlingshotPreview();

        const countEl = document.getElementById('count');
        const bodyCountEl = document.getElementById('bodyCount');
        if (countEl) countEl.innerText = particles.length;
        if (bodyCountEl) bodyCountEl.innerText = bodies.length;
    }

    // ---- UI wiring ----
    const gravityInput = document.getElementById('gravity');
    const gStrengthInput = document.getElementById('gStrength');
    const frictionInput = document.getElementById('friction');
    const bodySizeInput = document.getElementById('bodySize');
    const sizeInput = document.getElementById('size');
    const velocityInput = document.getElementById('velocity');
    const bodiesAttractInput = document.getElementById('bodiesAttract');
    const absorbInput = document.getElementById('absorb');
    const clearBtn = document.getElementById('clear');
    const randomBtn = document.getElementById('random');
    const themeSelect = document.getElementById('theme-select');
    const modeBtns = document.querySelectorAll('.mode-btn');
    const scenarioBtns = document.querySelectorAll('.scenario-btn');
    const trailsCheckbox = document.getElementById('trails');
    const glowCheckbox = document.getElementById('glow');
    const bounceCheckbox = document.getElementById('bounce');
    const starsCheckbox = document.getElementById('stars');
    const velocityColorCheckbox = document.getElementById('velocityColor');
    const additiveCheckbox = document.getElementById('additive');
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    const playPauseBtn = document.getElementById('playPauseBtn');

    function syncUIFromState() {
        gravityInput.value = ambientGravity;
        document.getElementById('gravityValue').textContent = ambientGravity.toFixed(2);

        gStrengthInput.value = gStrength;
        document.getElementById('gStrengthValue').textContent = gStrength.toFixed(1);

        frictionInput.value = friction;
        document.getElementById('frictionValue').textContent = friction.toFixed(3);

        bodiesAttractInput.checked = bodiesAttract;
        absorbInput.checked = absorbEnabled;
    }

    gravityInput.addEventListener('input', (e) => {
        ambientGravity = parseFloat(e.target.value);
        document.getElementById('gravityValue').textContent = ambientGravity.toFixed(2);
    });

    gStrengthInput.addEventListener('input', (e) => {
        gStrength = parseFloat(e.target.value);
        document.getElementById('gStrengthValue').textContent = gStrength.toFixed(1);
    });

    frictionInput.addEventListener('input', (e) => {
        friction = parseFloat(e.target.value);
        document.getElementById('frictionValue').textContent = friction.toFixed(3);
    });

    bodySizeInput.addEventListener('input', (e) => {
        bodySizeSetting = parseFloat(e.target.value);
        document.getElementById('bodySizeValue').textContent = bodySizeSetting;
    });

    sizeInput.addEventListener('input', (e) => {
        particleSize = parseFloat(e.target.value);
        document.getElementById('sizeValue').textContent = particleSize;
    });

    velocityInput.addEventListener('input', (e) => {
        initialVelocity = parseFloat(e.target.value);
        document.getElementById('velocityValue').textContent = initialVelocity;
    });

    bodiesAttractInput.addEventListener('change', (e) => {
        bodiesAttract = e.target.checked;
    });

    absorbInput.addEventListener('change', (e) => {
        absorbEnabled = e.target.checked;
    });

    clearBtn.addEventListener('click', () => {
        particles = [];
        bodies = [];
    });

    themeSelect.addEventListener('change', (e) => {
        currentTheme = e.target.value;
    });

    modeBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            modeBtns.forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            if (slingActive) {
                slingActive = false;
                slingshotHint.classList.remove('visible');
            }
            isPointerDown = false;
            mouseMode = btn.dataset.mode;
        });
    });

    scenarioBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            loadScenario(btn.dataset.scenario);
        });
    });

    trailsCheckbox.addEventListener('change', (e) => { enableTrails = e.target.checked; });
    glowCheckbox.addEventListener('change', (e) => { enableGlow = e.target.checked; });
    bounceCheckbox.addEventListener('change', (e) => { enableBounce = e.target.checked; });
    starsCheckbox.addEventListener('change', (e) => { enableStars = e.target.checked; });
    velocityColorCheckbox.addEventListener('change', (e) => { velocityColorMode = e.target.checked; });
    additiveCheckbox.addEventListener('change', (e) => { additiveBlend = e.target.checked; });

    randomBtn.addEventListener('click', () => {
        const scenarioKeys = Object.keys(scenarios);
        const randomScenario = scenarioKeys[Math.floor(Math.random() * scenarioKeys.length)];

        const themeKeys = Object.keys(themes);
        currentTheme = themeKeys[Math.floor(Math.random() * themeKeys.length)];
        themeSelect.value = currentTheme;

        loadScenario(randomScenario);

        gStrength = 0.6 + Math.random() * 1.8;
        gStrengthInput.value = gStrength;
        document.getElementById('gStrengthValue').textContent = gStrength.toFixed(1);

        particleSize = 1 + Math.floor(Math.random() * 10);
        sizeInput.value = particleSize;
        document.getElementById('sizeValue').textContent = particleSize;

        initialVelocity = 4 + Math.floor(Math.random() * 20);
        velocityInput.value = initialVelocity;
        document.getElementById('velocityValue').textContent = initialVelocity;

        enableGlow = Math.random() > 0.2;
        glowCheckbox.checked = enableGlow;

        velocityColorMode = Math.random() > 0.6;
        velocityColorCheckbox.checked = velocityColorMode;

        additiveBlend = Math.random() > 0.6;
        additiveCheckbox.checked = additiveBlend;
    });

    fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().then(() => {
                document.body.classList.add('fullscreen');
            }).catch(() => { });
        } else {
            document.exitFullscreen().then(() => {
                document.body.classList.remove('fullscreen');
            }).catch(() => { });
        }
    });

    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
            document.body.classList.remove('fullscreen');
        }
    });

    function setRunning(next) {
        running = next;
        playPauseBtn.querySelector('.icon-pause').style.display = running ? 'block' : 'none';
        playPauseBtn.querySelector('.icon-play').style.display = running ? 'none' : 'block';
        playPauseBtn.setAttribute('aria-label', running ? 'Pausar' : 'Retomar');
        playPauseBtn.title = running ? 'Pausar (Espaço)' : 'Retomar (Espaço)';
    }

    playPauseBtn.addEventListener('click', () => setRunning(!running));

    const controlsPanel = document.getElementById('controlsPanel');
    const toggleControlsBtn = document.getElementById('toggleControls');
    const closeControlsBtn = document.getElementById('closeControls');

    toggleControlsBtn.addEventListener('click', () => {
        controlsPanel.classList.add('visible');
        toggleControlsBtn.classList.add('hidden');
    });

    closeControlsBtn.addEventListener('click', () => {
        controlsPanel.classList.remove('visible');
        toggleControlsBtn.classList.remove('hidden');
    });

    document.addEventListener('keydown', (e) => {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;

        if (e.code === 'Space') {
            e.preventDefault();
            setRunning(!running);
        } else if (e.key === 'c' || e.key === 'C') {
            particles = [];
            bodies = [];
        } else if (e.key === 'f' || e.key === 'F') {
            fullscreenBtn.click();
        } else if (e.key >= '1' && e.key <= '6') {
            const keys = Object.keys(scenarios);
            const idx = parseInt(e.key, 10) - 1;
            if (keys[idx]) loadScenario(keys[idx]);
        }
    });

    window.addEventListener('resize', resize);

    // ---- Init ----
    resize();
    if (width && height && bodies.length === 0 && particles.length === 0) {
        loadScenario('solar');
    }
    requestAnimationFrame(animate);
})();
