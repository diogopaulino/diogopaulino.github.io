(function () {
    'use strict';

    /**
     * Gravity — sandbox orbital 2D.
     *
     * Newton (Plummer):  a = G M / (r² + ε),  ε = SOFTEN
     * Órbita circular:   v = √(a r) = √(G M r / (r² + ε))
     * Massa:             m = r² · MASS_K · (8 se buraco negro)
     * Binária igual:     v = √(G (m1+m2) / (4 · sep))
     * Três corpos L4:    v⊥ = √(G · 3m / (R √3))
     * Fusão:             p conservado; r = √(r1² + r2²)
     * Estilingue:        v = Δarrasto · SLING_K
     * Dobra temporal:    n subpassos de Euler com k = scale / n
     */
    const TAU = Math.PI * 2;
    const G_BASE = 0.05;
    const MASS_K = 8;
    const SOFTEN = 80;
    const SLING_K = 0.018;
    const MAX_PARTICLES = 720;
    const MAX_BODIES = 48;
    const TRAIL_MAX = 140;

    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });

    let width = 0;
    let height = 0;
    let boundW = 0;
    let boundH = 0;
    let dpr = 1;

    let particles = [];
    let bodies = [];
    let shockwaves = [];
    let running = true;
    let timeScale = 1;

    let ambientGravity = 0;
    let gStrength = 1;
    let friction = 1;
    let particleSize = 3;
    let initialVelocity = 10;
    let bodySizeSetting = 18;
    let bodiesAttract = true;
    let absorbEnabled = true;

    let mouseMode = 'spawn';
    let currentTheme = 'nebula';
    let enableTrails = true;
    let enableGlow = true;
    let enableBounce = false;
    let enableStars = true;
    let enableOrbits = true;
    let enableLabels = true;
    let velocityColorMode = false;
    let additiveBlend = false;
    let currentScenario = 'solar';

    const cam = { x: 0, y: 0, zoom: 1, follow: false };
    let selected = null;

    const themes = {
        nebula: ['#c4b5fd', '#67e8f9', '#fde68a', '#f9a8d4', '#93c5fd'],
        neon: ['#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b'],
        fire: ['#ff4d00', '#ff9900', '#ffcc00', '#ff6b6b', '#fff3bf'],
        ice: ['#67e8f9', '#38bdf8', '#818cf8', '#e0f2fe', '#a5f3fc'],
        sunset: ['#ff6b6b', '#feca57', '#ff9ff3', '#54a0ff', '#5f27cd'],
        ocean: ['#00b4d8', '#90e0ef', '#0077b6', '#caf0f8', '#48bfe3'],
        galaxy: ['#c77dff', '#e0aaff', '#9d4edd', '#7b2cbf', '#ffd6ff'],
        aurora: ['#00f5d4', '#00bbf9', '#9b5de5', '#f15bb5', '#fee440']
    };

    const SCENES = [
        { id: 'solar', name: 'Sistema Solar', chip: '#ffd35c', toast: 'Oito mundos, a Lua, um cinturão e dois cometas.' },
        { id: 'binary', name: 'Binárias', chip: '#60a5fa', toast: 'Duas estrelas dançam; a poeira segue o baricentro.' },
        { id: 'blackhole', name: 'Buraco Negro', chip: '#fb923c', toast: 'Um horizonte, um disco e uma estrela a se desfazer.' },
        { id: 'galaxy', name: 'Colisão', chip: '#e879f9', toast: 'Dois braços espirais em rumo de encontro.' },
        { id: 'threebody', name: 'Três Corpos', chip: '#34d399', toast: 'Três sóis iguais — o problema que não tem retrato.' },
        { id: 'rings', name: 'Anéis', chip: '#fbbf24', toast: 'Um gigante, pastores e um disco de gelo.' },
        { id: 'chaos', name: 'Caos', chip: '#f472b6', toast: 'Massas à deriva. Fusão, rasgo, luz.' },
        { id: 'classic', name: 'Clássico', chip: '#94a3b8', toast: 'Chuva newtoniana — o sandbox original.' }
    ];

    function hexToRgb(hex) {
        const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : { r: 255, g: 255, b: 255 };
    }

    function toScreen(x, y) {
        return {
            x: (x - cam.x) * cam.zoom + width / 2,
            y: (y - cam.y) * cam.zoom + height / 2
        };
    }

    function toWorld(sx, sy) {
        return {
            x: cam.x + (sx - width / 2) / cam.zoom,
            y: cam.y + (sy - height / 2) / cam.zoom
        };
    }

    function clampZoom(z) {
        return Math.max(0.22, Math.min(4.2, z));
    }

    function zoomAt(sx, sy, factor) {
        const before = toWorld(sx, sy);
        cam.zoom = clampZoom(cam.zoom * factor);
        const after = toWorld(sx, sy);
        cam.x += before.x - after.x;
        cam.y += before.y - after.y;
        cam.follow = false;
        syncFollowBtn();
    }

    function resetCamera() {
        cam.x = boundW / 2;
        cam.y = boundH / 2;
        cam.zoom = 1;
        cam.follow = false;
        selected = null;
        syncInspect();
    }

    function resize() {
        const cssW = window.innerWidth;
        const cssH = window.innerHeight;
        if (cssW === 0 || cssH === 0) return;

        dpr = Math.min(window.devicePixelRatio || 1, 2);
        const oldW = width;
        const oldH = height;

        width = cssW;
        height = cssH;
        canvas.width = Math.floor(cssW * dpr);
        canvas.height = Math.floor(cssH * dpr);
        canvas.style.width = cssW + 'px';
        canvas.style.height = cssH + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        generateStars();
        generateNebula();

        if (oldW > 0 && oldH > 0 && (oldW !== width || oldH !== height)) {
            const scale = Math.min(width / oldW, height / oldH);
            const ox = oldW / 2;
            const oy = oldH / 2;
            const nx = width / 2;
            const ny = height / 2;
            const scaleBody = (b) => {
                b.x = nx + (b.x - ox) * scale;
                b.y = ny + (b.y - oy) * scale;
                b.vx *= scale;
                b.vy *= scale;
            };
            particles.forEach(scaleBody);
            bodies.forEach(scaleBody);
            cam.x = nx + (cam.x - ox) * scale;
            cam.y = ny + (cam.y - oy) * scale;
            boundW = width;
            boundH = height;
        } else if (!oldW) {
            boundW = width;
            boundH = height;
            cam.x = boundW / 2;
            cam.y = boundH / 2;
            loadScenario(currentScenario);
        } else {
            boundW = width;
            boundH = height;
        }
    }

    // ---- Starfield + nebula ----
    let stars = [];
    let nebula = [];

    function generateStars() {
        stars = [];
        const count = Math.min(280, Math.floor((width * height) / 7000));
        for (let i = 0; i < count; i++) {
            stars.push({
                x: Math.random() * width,
                y: Math.random() * height,
                r: Math.random() * 1.4 + 0.2,
                phase: Math.random() * TAU,
                speed: 0.4 + Math.random() * 1.6,
                par: 0.15 + Math.random() * 0.55,
                tint: Math.random() < 0.12 ? '#c4b5fd' : Math.random() < 0.08 ? '#fde68a' : '#ffffff'
            });
        }
    }

    function generateNebula() {
        nebula = [
            { x: 0.18, y: 0.28, r: 0.42, c: 'rgba(88, 40, 160, 0.16)' },
            { x: 0.78, y: 0.22, r: 0.38, c: 'rgba(20, 80, 160, 0.14)' },
            { x: 0.62, y: 0.78, r: 0.44, c: 'rgba(160, 40, 90, 0.1)' },
            { x: 0.28, y: 0.72, r: 0.32, c: 'rgba(20, 140, 150, 0.1)' }
        ];
    }

    function drawBackdrop(t) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = enableTrails ? 'rgba(4, 4, 12, 0.2)' : '#04040c';
        ctx.fillRect(0, 0, width, height);

        const ox = (boundW / 2 - cam.x) * 0.04;
        const oy = (boundH / 2 - cam.y) * 0.04;
        for (let i = 0; i < nebula.length; i++) {
            const n = nebula[i];
            const x = n.x * width + ox;
            const y = n.y * height + oy;
            const rad = n.r * Math.max(width, height);
            const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
            g.addColorStop(0, n.c);
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(x, y, rad, 0, TAU);
            ctx.fill();
        }

        if (!enableStars) return;
        const panX = (cam.x - boundW / 2);
        const panY = (cam.y - boundH / 2);
        for (let i = 0; i < stars.length; i++) {
            const s = stars[i];
            let sx = s.x - panX * s.par * cam.zoom * 0.15;
            let sy = s.y - panY * s.par * cam.zoom * 0.15;
            sx = ((sx % width) + width) % width;
            sy = ((sy % height) + height) % height;
            const tw = 0.28 + 0.72 * (0.5 + 0.5 * Math.sin(t * 0.0007 * s.speed + s.phase));
            ctx.globalAlpha = tw * 0.9;
            ctx.fillStyle = s.tint;
            ctx.beginPath();
            ctx.arc(sx, sy, s.r * (0.7 + cam.zoom * 0.15), 0, TAU);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    // ---- Particle ----
    class Particle {
        constructor(x, y, vx, vy, radius, color, kind) {
            this.x = x;
            this.y = y;
            this.vx = vx;
            this.vy = vy;
            this.radius = radius;
            this.color = color;
            this.kind = kind || 'dust';
            this.absorbed = false;
            this.stretch = 0;
            this.stretchA = 0;
        }

        step(k) {
            this.vy += ambientGravity * k;
            this.stretch = 0;

            for (let i = 0; i < bodies.length; i++) {
                const b = bodies[i];
                const dx = b.x - this.x;
                const dy = b.y - this.y;
                const distSq = dx * dx + dy * dy + SOFTEN;
                const dist = Math.sqrt(distSq);

                if (absorbEnabled) {
                    const rSum = b.radius + this.radius;
                    if (dx * dx + dy * dy < rSum * rSum * 0.85) {
                        this.absorbed = true;
                        b.grow(this.radius);
                        continue;
                    }
                }

                const g = (G_BASE * gStrength * b.mass) / distSq;
                this.vx += ((g * dx) / dist) * k;
                this.vy += ((g * dy) / dist) * k;

                if (b.kind === 'blackhole') {
                    const roche = b.radius * 3.4;
                    const raw = Math.sqrt(dx * dx + dy * dy);
                    if (raw < roche) {
                        this.stretch = Math.min(1.8, (roche - raw) / roche * 2.2);
                        this.stretchA = Math.atan2(dy, dx);
                    }
                }
            }

            if (this.absorbed) return;

            if (isPointerDown && mouseMode !== 'spawn' && mouseMode !== 'body' && mouseMode !== 'erase') {
                const dx = pointerW.x - this.x;
                const dy = pointerW.y - this.y;
                const distSq = dx * dx + dy * dy;
                const distance = Math.sqrt(distSq);
                if (mouseMode === 'blackhole') {
                    const force = 1800 / (distSq + 120);
                    this.vx += dx * force * k;
                    this.vy += dy * force * k;
                    if (distance < 18) {
                        this.absorbed = true;
                    }
                } else {
                    const force = 480 / (distSq + 120);
                    const sign = mouseMode === 'attract' ? 0.5 : -2;
                    this.vx += dx * force * sign * k;
                    this.vy += dy * force * sign * k;
                }
            }

            this.vx *= Math.pow(friction, k);
            this.vy *= Math.pow(friction, k);
            this.x += this.vx * k;
            this.y += this.vy * k;

            if (enableBounce) {
                if (this.x < this.radius) { this.x = this.radius; this.vx = Math.abs(this.vx) * 0.7; }
                if (this.x > boundW - this.radius) { this.x = boundW - this.radius; this.vx = -Math.abs(this.vx) * 0.7; }
                if (this.y < this.radius) { this.y = this.radius; this.vy = Math.abs(this.vy) * 0.7; }
                if (this.y > boundH - this.radius) { this.y = boundH - this.radius; this.vy = -Math.abs(this.vy) * 0.7; }
            } else {
                if (this.x < -40) this.x = boundW + 40;
                if (this.x > boundW + 40) this.x = -40;
                if (this.y < -40) this.y = boundH + 40;
                if (this.y > boundH + 40) this.y = -40;
            }
        }

        draw() {
            const s = toScreen(this.x, this.y);
            const pr = Math.max(0.55, this.radius * cam.zoom);
            if (s.x < -20 || s.x > width + 20 || s.y < -20 || s.y > height + 20) return;

            let color = this.color;
            if (velocityColorMode) {
                const speed = Math.hypot(this.vx, this.vy);
                color = `hsl(${Math.max(0, 268 - speed * 18)}, 92%, 62%)`;
            }

            ctx.fillStyle = color;
            ctx.beginPath();
            if (this.stretch > 0.08) {
                ctx.save();
                ctx.translate(s.x, s.y);
                ctx.rotate(this.stretchA);
                ctx.scale(1 + this.stretch, 1 - this.stretch * 0.42);
                ctx.arc(0, 0, pr, 0, TAU);
                ctx.fill();
                ctx.restore();
            } else {
                ctx.arc(s.x, s.y, pr, 0, TAU);
                ctx.fill();
            }

            if (this.kind === 'comet') {
                const mag = Math.hypot(this.vx, this.vy) || 1;
                const tx = s.x - (this.vx / mag) * pr * 7;
                const ty = s.y - (this.vy / mag) * pr * 7;
                const tg = ctx.createLinearGradient(s.x, s.y, tx, ty);
                tg.addColorStop(0, color);
                tg.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.strokeStyle = tg;
                ctx.lineWidth = pr * 1.6;
                ctx.beginPath();
                ctx.moveTo(s.x, s.y);
                ctx.lineTo(tx, ty);
                ctx.stroke();
            }
        }
    }

    // ---- Body ----
    class Body {
        constructor(x, y, vx, vy, radius, color, kind, name) {
            this.x = x;
            this.y = y;
            this.vx = vx;
            this.vy = vy;
            this.radius = radius;
            this.maxRadius = Math.min(110, radius * 2.8);
            this.color = color;
            this.rgb = hexToRgb(color);
            this.kind = kind || 'planet';
            this.name = name || '';
            this.pulse = 0;
            this.spin = Math.random() * TAU;
            this.trail = [];
            this.pinned = false;
            this.updateMass();
        }

        updateMass() {
            this.mass = this.radius * this.radius * MASS_K * (this.kind === 'blackhole' ? 8 : this.kind === 'sun' ? 1.6 : 1);
        }

        grow(amount) {
            if (this.radius < this.maxRadius) {
                this.radius = Math.min(this.maxRadius, this.radius + amount * 0.03);
                this.updateMass();
            }
            this.pulse = 1;
        }

        colorAlpha(a) {
            return `rgba(${this.rgb.r}, ${this.rgb.g}, ${this.rgb.b}, ${a})`;
        }

        integrate(k) {
            if (this.pinned) {
                this.vx = 0;
                this.vy = 0;
            } else {
                this.x += this.vx * k;
                this.y += this.vy * k;
            }
            this.spin += 0.01 * k;
            if (this.pulse > 0) this.pulse -= 0.03 * k;

            if (enableOrbits) {
                this.trail.push(this.x, this.y);
                if (this.trail.length > TRAIL_MAX * 2) this.trail.splice(0, this.trail.length - TRAIL_MAX * 2);
            }
        }

        drawTrail() {
            if (!enableOrbits || this.trail.length < 4) return;
            const n = this.trail.length / 2;
            ctx.beginPath();
            let prev = null;
            for (let i = 0; i < n; i++) {
                const s = toScreen(this.trail[i * 2], this.trail[i * 2 + 1]);
                if (!prev || Math.hypot(s.x - prev.x, s.y - prev.y) > 48) ctx.moveTo(s.x, s.y);
                else ctx.lineTo(s.x, s.y);
                prev = s;
            }
            ctx.strokeStyle = this.colorAlpha(0.28);
            ctx.lineWidth = Math.max(0.8, 1.2 * cam.zoom);
            ctx.stroke();
        }

        draw() {
            const s = toScreen(this.x, this.y);
            const r = Math.max(1.2, this.radius * cam.zoom);
            if (s.x < -r * 5 || s.x > width + r * 5 || s.y < -r * 5 || s.y > height + r * 5) return;

            switch (this.kind) {
                case 'blackhole': drawBlackHole(s, r, this); break;
                case 'sun':
                case 'star': drawSun(s, r, this); break;
                case 'saturn': drawSaturn(s, r, this); break;
                case 'jupiter': drawJupiter(s, r, this); break;
                case 'earth': drawEarth(s, r, this); break;
                case 'comet': drawCometBody(s, r, this); break;
                default: drawPlanet(s, r, this); break;
            }

            if (selected === this) {
                ctx.strokeStyle = 'rgba(253, 230, 138, 0.85)';
                ctx.lineWidth = 1.4;
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.arc(s.x, s.y, r + 7, 0, TAU);
                ctx.stroke();
                ctx.setLineDash([]);
            }

            if (enableLabels && this.name && r > 5 && s.y > 86 && s.y < height - 150) {
                ctx.font = `600 ${Math.max(10, Math.min(13, r * 0.55))}px Space Grotesk, sans-serif`;
                ctx.fillStyle = 'rgba(255,255,255,0.72)';
                ctx.textAlign = 'center';
                ctx.fillText(this.name, s.x, s.y + r + 14);
            }
        }
    }

    function drawGlow(s, r, color, mul) {
        if (!enableGlow) return;
        const g = ctx.createRadialGradient(s.x, s.y, r * 0.2, s.x, s.y, r * mul);
        g.addColorStop(0, color);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(s.x, s.y, r * mul, 0, TAU);
        ctx.fill();
    }

    function drawSun(s, r, b) {
        const t = b.spin;
        const glowR = r * (2.6 + Math.sin(t * 2) * 0.12 + b.pulse * 0.4);
        const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, glowR);
        g.addColorStop(0, 'rgba(255,255,230,1)');
        g.addColorStop(0.12, b.colorAlpha(0.95));
        g.addColorStop(0.38, b.colorAlpha(0.4));
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(s.x, s.y, glowR, 0, TAU);
        ctx.fill();

        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(t * 0.4);
        ctx.strokeStyle = b.colorAlpha(0.22);
        ctx.lineCap = 'round';
        for (let i = 0; i < 10; i++) {
            const a = i * TAU / 10;
            const len = r * (1.55 + 0.35 * Math.sin(t * 3 + i));
            ctx.lineWidth = Math.max(1.2, r * 0.12);
            ctx.beginPath();
            ctx.moveTo(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85);
            ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
            ctx.stroke();
        }
        ctx.restore();

        const core = ctx.createRadialGradient(s.x - r * 0.2, s.y - r * 0.2, r * 0.1, s.x, s.y, r);
        core.addColorStop(0, '#fff7d1');
        core.addColorStop(0.45, b.color);
        core.addColorStop(1, '#ea580c');
        ctx.fillStyle = core;
        ctx.beginPath();
        ctx.arc(s.x, s.y, r, 0, TAU);
        ctx.fill();
    }

    function drawBlackHole(s, r, b) {
        const glow = ctx.createRadialGradient(s.x, s.y, r * 0.2, s.x, s.y, r * 3.1);
        glow.addColorStop(0, 'rgba(255, 214, 140, 0.9)');
        glow.addColorStop(0.16, 'rgba(255, 120, 50, 0.45)');
        glow.addColorStop(0.42, 'rgba(90, 40, 170, 0.22)');
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(s.x, s.y, r * 3.1, 0, TAU);
        ctx.fill();

        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(b.spin * 0.7);
        ctx.scale(1, 0.34);
        const disk = ctx.createRadialGradient(0, 0, r * 0.85, 0, 0, r * 2.7);
        disk.addColorStop(0, 'rgba(0,0,0,0)');
        disk.addColorStop(0.22, 'rgba(255, 244, 200, 0.95)');
        disk.addColorStop(0.42, 'rgba(255, 140, 50, 0.7)');
        disk.addColorStop(0.7, 'rgba(90, 120, 255, 0.32)');
        disk.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = disk;
        ctx.beginPath();
        ctx.arc(0, 0, r * 2.7, 0, TAU);
        ctx.fill();
        ctx.restore();

        ctx.strokeStyle = 'rgba(160, 190, 255, 0.28)';
        ctx.lineWidth = Math.max(1.5, r * 0.1);
        ctx.beginPath();
        ctx.moveTo(s.x, s.y - r * 3.6);
        ctx.lineTo(s.x, s.y - r * 1.15);
        ctx.moveTo(s.x, s.y + r * 1.15);
        ctx.lineTo(s.x, s.y + r * 3.6);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255, 220, 170, 0.9)';
        ctx.lineWidth = Math.max(1.4, r * 0.08);
        ctx.beginPath();
        ctx.arc(s.x, s.y, r * 1.18, 0, TAU);
        ctx.stroke();

        ctx.fillStyle = '#010104';
        ctx.beginPath();
        ctx.arc(s.x, s.y, r, 0, TAU);
        ctx.fill();
    }

    function drawPlanet(s, r, b) {
        drawGlow(s, r, b.colorAlpha(0.55), 2.1 + b.pulse * 0.4);
        const g = ctx.createRadialGradient(s.x - r * 0.3, s.y - r * 0.35, r * 0.1, s.x, s.y, r);
        g.addColorStop(0, 'rgba(255,255,255,0.55)');
        g.addColorStop(0.35, b.color);
        g.addColorStop(1, 'rgba(0,0,0,0.55)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(s.x, s.y, r, 0, TAU);
        ctx.fill();
    }

    function drawEarth(s, r, b) {
        const atmo = ctx.createRadialGradient(s.x, s.y, r * 0.8, s.x, s.y, r * 1.32);
        atmo.addColorStop(0, 'rgba(80,170,255,0)');
        atmo.addColorStop(0.72, 'rgba(80,170,255,0.18)');
        atmo.addColorStop(1, 'rgba(80,170,255,0)');
        ctx.fillStyle = atmo;
        ctx.beginPath();
        ctx.arc(s.x, s.y, r * 1.32, 0, TAU);
        ctx.fill();

        ctx.save();
        ctx.beginPath();
        ctx.arc(s.x, s.y, r, 0, TAU);
        ctx.clip();
        ctx.fillStyle = '#1d4ed8';
        ctx.fillRect(s.x - r, s.y - r, r * 2, r * 2);
        ctx.fillStyle = '#3d9a4a';
        blob(s.x + Math.cos(b.spin) * r * 0.15, s.y + Math.sin(b.spin * 0.7) * r * 0.1, r * 0.42);
        blob(s.x - r * 0.32, s.y + r * 0.22, r * 0.26);
        blob(s.x + r * 0.28, s.y + r * 0.3, r * 0.18);
        ctx.fillStyle = '#e8f4ff';
        ctx.beginPath();
        ctx.ellipse(s.x, s.y - r * 0.82, r * 0.42, r * 0.16, 0, 0, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(s.x, s.y + r * 0.86, r * 0.36, r * 0.13, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        blob(s.x + r * 0.1, s.y - r * 0.15, r * 0.2);
        ctx.restore();

        ctx.fillStyle = 'rgba(255,255,255,0.32)';
        ctx.beginPath();
        ctx.arc(s.x - r * 0.28, s.y - r * 0.28, r * 0.2, 0, TAU);
        ctx.fill();
    }

    function drawJupiter(s, r, b) {
        drawGlow(s, r, b.colorAlpha(0.4), 1.9);
        ctx.save();
        ctx.beginPath();
        ctx.arc(s.x, s.y, r, 0, TAU);
        ctx.clip();
        ctx.fillStyle = '#e8b86a';
        ctx.fillRect(s.x - r, s.y - r, r * 2, r * 2);
        const bands = ['#d4924a', '#f0d0a0', '#c47a38', '#ead8b0', '#d9a056', '#b86a32'];
        for (let i = 0; i < 7; i++) {
            ctx.fillStyle = bands[i % bands.length];
            ctx.globalAlpha = 0.75;
            ctx.fillRect(s.x - r, s.y - r + (i + 0.15 + Math.sin(b.spin + i) * 0.04) * r * 0.28, r * 2, r * 0.16);
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#c4452d';
        ctx.beginPath();
        ctx.ellipse(s.x + r * 0.32, s.y + r * 0.18, r * 0.28, r * 0.15, -0.3, 0, TAU);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.beginPath();
        ctx.arc(s.x - r * 0.3, s.y - r * 0.3, r * 0.18, 0, TAU);
        ctx.fill();
    }

    function drawSaturn(s, r, b) {
        drawRings(s, r, b, 'back');
        drawPlanet(s, r, b);
        drawRings(s, r, b, 'front');
    }

    function drawRings(s, r, b, pass) {
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(-0.35);
        ctx.beginPath();
        if (pass === 'back') ctx.rect(-r * 4, -r * 4, r * 8, r * 4);
        else ctx.rect(-r * 4, 0, r * 8, r * 4);
        ctx.clip();
        ctx.scale(1, 0.32);
        const rings = [
            [r * 1.45, r * 1.7, 'rgba(232, 201, 148, 0.55)'],
            [r * 1.78, r * 2.05, 'rgba(210, 180, 130, 0.28)'],
            [r * 2.12, r * 2.45, 'rgba(245, 230, 190, 0.4)']
        ];
        for (let i = 0; i < rings.length; i++) {
            ctx.beginPath();
            ctx.arc(0, 0, rings[i][1], 0, TAU);
            ctx.arc(0, 0, rings[i][0], 0, TAU, true);
            ctx.fillStyle = rings[i][2];
            ctx.fill();
        }
        ctx.restore();
    }

    function drawCometBody(s, r, b) {
        const mag = Math.hypot(b.vx, b.vy) || 1;
        const tx = s.x - (b.vx / mag) * Math.min(70, r * 8);
        const ty = s.y - (b.vy / mag) * Math.min(70, r * 8);
        const g = ctx.createLinearGradient(s.x, s.y, tx, ty);
        g.addColorStop(0, 'rgba(186, 230, 253, 0.9)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.strokeStyle = g;
        ctx.lineWidth = Math.max(1.5, r * 1.1);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        drawPlanet(s, r, b);
    }

    function blob(x, y, r) {
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 0.72, 0.4, 0, TAU);
        ctx.fill();
    }

    function spawnShock(x, y, color, maxR) {
        shockwaves.push({ x, y, r: 4, max: maxR, color, life: 1 });
    }

    function drawShocks() {
        for (let i = shockwaves.length - 1; i >= 0; i--) {
            const w = shockwaves[i];
            w.r += 2.8 * timeScale;
            w.life -= 0.018 * timeScale;
            if (w.life <= 0 || w.r > w.max) {
                shockwaves.splice(i, 1);
                continue;
            }
            const s = toScreen(w.x, w.y);
            ctx.strokeStyle = w.color;
            ctx.globalAlpha = w.life * 0.7;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(s.x, s.y, w.r * cam.zoom, 0, TAU);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
    }

    function updateBodies(k) {
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
                    if (!a.pinned) {
                        a.vx += ((aAcc * dx) / dist) * k;
                        a.vy += ((aAcc * dy) / dist) * k;
                    }
                    const bAcc = (G_BASE * gStrength * a.mass) / distSq;
                    if (!b.pinned) {
                        b.vx -= ((bAcc * dx) / dist) * k;
                        b.vy -= ((bAcc * dy) / dist) * k;
                    }
                }
            }
        }
        for (let i = 0; i < bodies.length; i++) bodies[i].integrate(k);
        if (bodiesAttract) mergeBodies();
    }

    function mergeBodies() {
        for (let i = bodies.length - 1; i >= 0; i--) {
            for (let j = i - 1; j >= 0; j--) {
                const a = bodies[i];
                const b = bodies[j];
                const dist = Math.hypot(a.x - b.x, a.y - b.y);
                if (dist < (a.radius + b.radius) * 0.5) {
                    const total = a.mass + b.mass;
                    const keep = a.mass > b.mass ? a : b;
                    const eat = keep === a ? b : a;
                    keep.x = (a.x * a.mass + b.x * b.mass) / total;
                    keep.y = (a.y * a.mass + b.y * b.mass) / total;
                    keep.vx = (a.vx * a.mass + b.vx * b.mass) / total;
                    keep.vy = (a.vy * a.mass + b.vy * b.mass) / total;
                    if (a.kind === 'blackhole' || b.kind === 'blackhole') keep.kind = 'blackhole';
                    if (a.pinned || b.pinned) keep.pinned = true;
                    keep.radius = Math.min(110, Math.sqrt(a.radius * a.radius + b.radius * b.radius));
                    keep.maxRadius = Math.max(keep.maxRadius, eat.maxRadius, keep.radius * 1.3);
                    keep.updateMass();
                    keep.pulse = 1;
                    if (!keep.name) keep.name = eat.name;
                    spawnShock(keep.x, keep.y, keep.colorAlpha(0.8), keep.radius * 6);
                    burst(keep.x, keep.y, 14, keep.color);
                    if (selected === eat) selected = keep;
                    bodies.splice(eat === a ? i : j, 1);
                    break;
                }
            }
        }
    }

    function burst(x, y, n, color) {
        const colors = themes[currentTheme];
        for (let i = 0; i < n && particles.length < MAX_PARTICLES; i++) {
            const a = Math.random() * TAU;
            const sp = 1.5 + Math.random() * 4;
            particles.push(new Particle(x, y, Math.cos(a) * sp, Math.sin(a) * sp, 1.2 + Math.random() * 2, color || colors[i % colors.length]));
        }
    }

    function spawnParticles(x, y, count) {
        const colors = themes[currentTheme];
        for (let i = 0; i < count && particles.length < MAX_PARTICLES; i++) {
            const radius = Math.random() * particleSize + 1.4;
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
        const kinds = ['planet', 'ice', 'star', 'mars'];
        bodies.push(new Body(x, y, vx, vy, radius, color, kinds[Math.floor(Math.random() * kinds.length)], 'Mundo'));
    }

    function eraseAt(x, y) {
        for (let i = bodies.length - 1; i >= 0; i--) {
            if (Math.hypot(bodies[i].x - x, bodies[i].y - y) < bodies[i].radius + 16 / cam.zoom) {
                if (selected === bodies[i]) selected = null;
                spawnShock(bodies[i].x, bodies[i].y, bodies[i].colorAlpha(0.6), 40);
                bodies.splice(i, 1);
            }
        }
        for (let i = particles.length - 1; i >= 0; i--) {
            if (Math.hypot(particles[i].x - x, particles[i].y - y) < 32 / cam.zoom) {
                particles.splice(i, 1);
            }
        }
        syncInspect();
    }

    function orbitVelocity(mass, r) {
        const distSq = r * r + SOFTEN;
        const a = (G_BASE * gStrength * mass) / distSq;
        return Math.sqrt(Math.max(0.0001, a * r));
    }

    function placeOrbit(host, radiusOrbit, size, color, kind, name, extraVx, extraVy) {
        const angle = Math.random() * TAU;
        const x = host.x + Math.cos(angle) * radiusOrbit;
        const y = host.y + Math.sin(angle) * radiusOrbit;
        const v = orbitVelocity(host.mass, radiusOrbit);
        const vx = host.vx + -Math.sin(angle) * v + (extraVx || 0);
        const vy = host.vy + Math.cos(angle) * v + (extraVy || 0);
        const body = new Body(x, y, vx, vy, size, color, kind, name);
        bodies.push(body);
        return body;
    }

    function ringDust(host, r0, r1, n, colors) {
        for (let i = 0; i < n && particles.length < MAX_PARTICLES; i++) {
            const r = r0 + Math.random() * (r1 - r0);
            const angle = Math.random() * TAU;
            const x = host.x + Math.cos(angle) * r;
            const y = host.y + Math.sin(angle) * r * 0.98;
            const v = orbitVelocity(host.mass, r);
            particles.push(new Particle(
                x, y,
                host.vx + -Math.sin(angle) * v,
                host.vy + Math.cos(angle) * v,
                1 + Math.random() * 1.6,
                colors[i % colors.length]
            ));
        }
    }

    function clearAll() {
        particles = [];
        bodies = [];
        shockwaves = [];
        selected = null;
        cam.follow = false;
        syncInspect();
    }

    function unit() {
        return Math.min(boundW, boundH);
    }

    function scenarioSolar() {
        clearAll();
        ambientGravity = 0;
        friction = 1;
        bodiesAttract = true;
        absorbEnabled = true;
        gStrength = 1;
        enableBounce = false;

        const cx = boundW / 2;
        const cy = boundH / 2;
        const u = unit();
        const sun = new Body(cx, cy, 0, 0, Math.max(22, u * 0.038), '#ffd35c', 'sun', 'Sol');
        sun.pinned = true;
        bodies.push(sun);

        const earth = placeOrbit(sun, u * 0.16, Math.max(10, u * 0.016), '#3b82f6', 'earth', 'Terra');
        placeOrbit(earth, Math.max(14, earth.radius * 1.85), Math.max(2.6, u * 0.005), '#cbd5e1', 'moon', 'Lua');
        placeOrbit(sun, u * 0.08, Math.max(3.5, u * 0.006), '#9ca3af', 'planet', 'Mercúrio');
        placeOrbit(sun, u * 0.12, Math.max(6.5, u * 0.01), '#f59e0b', 'planet', 'Vênus');
        placeOrbit(sun, u * 0.2, Math.max(5.5, u * 0.009), '#ef4444', 'mars', 'Marte');
        ringDust(sun, u * 0.225, u * 0.255, 70, ['#c4b5fd', '#a8a29e', '#fde68a']);
        placeOrbit(sun, u * 0.31, Math.max(14, u * 0.022), '#e8b86a', 'jupiter', 'Júpiter');
        const saturn = placeOrbit(sun, u * 0.39, Math.max(12, u * 0.018), '#f5d0a6', 'saturn', 'Saturno');
        ringDust(saturn, saturn.radius * 1.6, saturn.radius * 2.5, 40, ['#fde68a', '#e7e5e4']);
        placeOrbit(sun, u * 0.45, Math.max(8, u * 0.013), '#7dd3fc', 'ice', 'Urano');
        placeOrbit(sun, u * 0.51, Math.max(8, u * 0.013), '#2563eb', 'ice', 'Netuno');

        for (let i = 0; i < 2; i++) {
            const r = u * (0.34 + i * 0.12);
            const angle = 1.2 + i * 2.1;
            const x = cx + Math.cos(angle) * r;
            const y = cy + Math.sin(angle) * r;
            const v = orbitVelocity(sun.mass, r) * 0.92;
            const comet = new Body(x, y, -Math.sin(angle) * v, Math.cos(angle) * v, 4, '#e0f2fe', 'comet', i ? 'Halley' : 'Encke');
            bodies.push(comet);
        }
    }

    function scenarioBinary() {
        clearAll();
        ambientGravity = 0;
        friction = 1;
        bodiesAttract = true;
        absorbEnabled = true;
        gStrength = 1;
        enableBounce = false;

        const cx = boundW / 2;
        const cy = boundH / 2;
        const sep = unit() * 0.16;
        const radius = Math.max(16, unit() * 0.028);
        const a = new Body(cx - sep / 2, cy, 0, 0, radius, '#60a5fa', 'star', 'Azura');
        const b = new Body(cx + sep / 2, cy, 0, 0, radius, '#f472b6', 'star', 'Rosa');
        const v = Math.sqrt((G_BASE * gStrength * (a.mass + b.mass)) / (4 * sep));
        a.vy = -v;
        b.vy = v;
        bodies.push(a, b);
        ringDust({ x: cx, y: cy, vx: 0, vy: 0, mass: a.mass + b.mass }, sep * 1.6, sep * 2.8, 110, themes[currentTheme]);
    }

    function scenarioBlackhole() {
        clearAll();
        ambientGravity = 0;
        friction = 1;
        bodiesAttract = true;
        absorbEnabled = true;
        gStrength = 1.25;
        enableBounce = false;

        const cx = boundW / 2;
        const cy = boundH / 2;
        const bh = new Body(cx, cy, 0, 0, Math.max(18, unit() * 0.03), '#1a1a2e', 'blackhole', 'Horizonte');
        bh.pinned = true;
        bodies.push(bh);
        ringDust(bh, bh.radius * 3.2, bh.radius * 9, 160, ['#fde68a', '#fb923c', '#a78bfa', '#f97316']);

        const r = unit() * 0.28;
        const star = new Body(cx + r, cy, 0, orbitVelocity(bh.mass, r) * 0.55, Math.max(14, unit() * 0.022), '#fde68a', 'star', 'Vítima');
        bodies.push(star);
    }

    function spawnSpiral(cx, cy, color, name, driftVx, driftVy) {
        const core = new Body(cx, cy, driftVx, driftVy, Math.max(14, unit() * 0.022), color, 'star', name);
        bodies.push(core);
        const colors = themes[currentTheme];
        const arms = 2;
        for (let i = 0; i < 90 && particles.length < MAX_PARTICLES; i++) {
            const arm = i % arms;
            const t = i / 90;
            const rad = unit() * (0.04 + t * 0.16);
            const angle = arm * Math.PI + t * 3.1 + Math.random() * 0.18;
            const x = cx + Math.cos(angle) * rad;
            const y = cy + Math.sin(angle) * rad * 0.72;
            const v = orbitVelocity(core.mass, rad);
            particles.push(new Particle(
                x, y,
                -Math.sin(angle) * v + driftVx,
                Math.cos(angle) * v + driftVy,
                1 + Math.random() * 1.8,
                colors[i % colors.length]
            ));
        }
    }

    function scenarioGalaxy() {
        clearAll();
        ambientGravity = 0;
        friction = 1;
        bodiesAttract = true;
        absorbEnabled = true;
        gStrength = 1;
        enableBounce = false;
        const cy = boundH / 2;
        spawnSpiral(boundW * 0.3, cy, '#60a5fa', 'Azul', 0.85, 0.15);
        spawnSpiral(boundW * 0.7, cy, '#f472b6', 'Magenta', -0.85, -0.15);
    }

    function scenarioThreeBody() {
        clearAll();
        ambientGravity = 0;
        friction = 1;
        bodiesAttract = true;
        absorbEnabled = false;
        gStrength = 1;
        enableBounce = false;

        const cx = boundW / 2;
        const cy = boundH / 2;
        const R = unit() * 0.16;
        const radius = Math.max(14, unit() * 0.024);
        const colors = ['#fde68a', '#67e8f9', '#f9a8d4'];
        const names = ['Alfa', 'Beta', 'Gama'];
        const probe = new Body(0, 0, 0, 0, radius, colors[0], 'sun', names[0]);
        const v = Math.sqrt((G_BASE * gStrength * 3 * probe.mass) / (R * Math.sqrt(3)));
        for (let i = 0; i < 3; i++) {
            const a = i * TAU / 3;
            const star = new Body(
                cx + Math.cos(a) * R,
                cy + Math.sin(a) * R,
                -Math.sin(a) * v,
                Math.cos(a) * v,
                radius,
                colors[i],
                'sun',
                names[i]
            );
            bodies.push(star);
        }
        const colorsDust = themes[currentTheme];
        for (let i = 0; i < 80; i++) {
            const a = Math.random() * TAU;
            const rad = R * (1.6 + Math.random() * 1.4);
            particles.push(new Particle(
                cx + Math.cos(a) * rad,
                cy + Math.sin(a) * rad,
                (Math.random() - 0.5) * 0.6,
                (Math.random() - 0.5) * 0.6,
                1.2 + Math.random() * 1.8,
                colorsDust[i % colorsDust.length]
            ));
        }
    }

    function scenarioRings() {
        clearAll();
        ambientGravity = 0;
        friction = 1;
        bodiesAttract = true;
        absorbEnabled = true;
        gStrength = 1;
        enableBounce = false;

        const cx = boundW / 2;
        const cy = boundH / 2;
        const planet = new Body(cx, cy, 0, 0, Math.max(26, unit() * 0.045), '#f5d0a6', 'saturn', 'Cronos');
        planet.pinned = true;
        bodies.push(planet);
        ringDust(planet, planet.radius * 1.55, planet.radius * 2.15, 90, ['#fde68a', '#e7e5e4', '#fcd34d']);
        ringDust(planet, planet.radius * 2.3, planet.radius * 3.1, 120, ['#e0f2fe', '#cbd5e1', '#fef3c7']);
        placeOrbit(planet, planet.radius * 3.6, 6, '#cbd5e1', 'moon', 'Pastor A');
        placeOrbit(planet, planet.radius * 4.4, 5, '#94a3b8', 'moon', 'Pastor B');
    }

    function scenarioChaos() {
        clearAll();
        ambientGravity = 0;
        friction = 0.999;
        bodiesAttract = true;
        absorbEnabled = true;
        gStrength = 1.45;
        enableBounce = false;
        const colors = themes[currentTheme];
        const n = 4 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) {
            const radius = 10 + Math.random() * 18;
            const kind = i === 0 && Math.random() > 0.5 ? 'blackhole' : 'star';
            bodies.push(new Body(
                boundW * (0.2 + Math.random() * 0.6),
                boundH * (0.2 + Math.random() * 0.6),
                (Math.random() - 0.5) * 2.4,
                (Math.random() - 0.5) * 2.4,
                radius,
                colors[i % colors.length],
                kind,
                kind === 'blackhole' ? 'Poço' : 'Astro ' + (i + 1)
            ));
        }
        for (let i = 0; i < 130; i++) spawnParticles(Math.random() * boundW, Math.random() * boundH, 1);
    }

    function scenarioClassic() {
        clearAll();
        ambientGravity = 0.45;
        friction = 0.985;
        bodiesAttract = false;
        absorbEnabled = false;
        gStrength = 1;
        enableBounce = true;
        spawnParticles(boundW / 2, boundH * 0.28, 40);
    }

    const scenarios = {
        solar: scenarioSolar,
        binary: scenarioBinary,
        blackhole: scenarioBlackhole,
        galaxy: scenarioGalaxy,
        threebody: scenarioThreeBody,
        rings: scenarioRings,
        chaos: scenarioChaos,
        classic: scenarioClassic
    };

    function loadScenario(name) {
        if (!scenarios[name]) return;
        scenarios[name]();
        currentScenario = name;
        if (history.replaceState) history.replaceState(null, '', '#' + name);
        resetCamera();
        bounceCheckbox.checked = enableBounce;
        syncUIFromState();
        document.querySelectorAll('.scene-chip').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.scenario === name);
        });
        const meta = SCENES.find((s) => s.id === name);
        hudScene.textContent = meta ? meta.name : name;
        if (meta) toast(meta.toast);
    }

    // ---- Input ----
    let isPointerDown = false;
    let pointerX = 0;
    let pointerY = 0;
    let pointerW = { x: 0, y: 0 };
    let slingActive = false;
    let slingStart = null;
    let panning = false;
    let panLast = null;
    let spawnArmed = false;
    let downOnBody = null;
    let pinchStart = null;

    const slingshotHint = document.getElementById('slingshotHint');

    function canvasPoint(clientX, clientY) {
        const rect = canvas.getBoundingClientRect();
        return { x: clientX - rect.left, y: clientY - rect.top };
    }

    function hitBody(wx, wy) {
        let best = null;
        let bestD = Infinity;
        for (let i = 0; i < bodies.length; i++) {
            const b = bodies[i];
            const d = Math.hypot(b.x - wx, b.y - wy);
            const pad = Math.max(10 / cam.zoom, b.radius * 1.15);
            if (d < pad && d < bestD) {
                best = b;
                bestD = d;
            }
        }
        return best;
    }

    function pointerDown(x, y, pan) {
        pointerX = x;
        pointerY = y;
        pointerW = toWorld(x, y);
        downOnBody = hitBody(pointerW.x, pointerW.y);

        if (pan) {
            panning = true;
            panLast = { x, y };
            cam.follow = false;
            syncFollowBtn();
            return;
        }

        if (mouseMode === 'body') {
            slingActive = true;
            slingStart = { x: pointerW.x, y: pointerW.y, sx: x, sy: y };
            showSlingshotHint(x, y);
            return;
        }

        if (downOnBody && mouseMode === 'spawn') {
            selected = downOnBody;
            spawnArmed = false;
            syncInspect();
            return;
        }

        spawnArmed = mouseMode === 'spawn';
        isPointerDown = true;
        if (mouseMode === 'spawn') spawnParticles(pointerW.x, pointerW.y, 8);
        if (mouseMode === 'erase') eraseAt(pointerW.x, pointerW.y);
    }

    function pointerMove(x, y) {
        pointerX = x;
        pointerY = y;
        pointerW = toWorld(x, y);

        if (panning && panLast) {
            cam.x -= (x - panLast.x) / cam.zoom;
            cam.y -= (y - panLast.y) / cam.zoom;
            panLast = { x, y };
            cam.follow = false;
            syncFollowBtn();
            return;
        }

        if (slingActive) {
            showSlingshotHint(x, y);
            return;
        }

        if (downOnBody && mouseMode === 'spawn' && !isPointerDown) {
            const dx = x - (toScreen(downOnBody.x, downOnBody.y).x);
            const dy = y - (toScreen(downOnBody.x, downOnBody.y).y);
            if (Math.hypot(dx, dy) > 12) {
                isPointerDown = true;
                spawnArmed = true;
                spawnParticles(pointerW.x, pointerW.y, 4);
            }
            return;
        }

        if (isPointerDown && mouseMode === 'spawn') spawnParticles(pointerW.x, pointerW.y, 2);
        if (isPointerDown && mouseMode === 'erase') eraseAt(pointerW.x, pointerW.y);
    }

    function pointerUp() {
        if (slingActive && slingStart) {
            const dx = slingStart.x - pointerW.x;
            const dy = slingStart.y - pointerW.y;
            addBody(slingStart.x, slingStart.y, dx * SLING_K, dy * SLING_K, bodySizeSetting);
            slingActive = false;
            slingshotHint.classList.remove('visible');
        }
        isPointerDown = false;
        panning = false;
        panLast = null;
        spawnArmed = false;
        downOnBody = null;
    }

    function showSlingshotHint(x, y) {
        if (!slingStart) return;
        const world = toWorld(x, y);
        const speed = Math.hypot(slingStart.x - world.x, slingStart.y - world.y) * SLING_K;
        const scr = toScreen(slingStart.x, slingStart.y);
        slingshotHint.style.left = scr.x + 'px';
        slingshotHint.style.top = scr.y + 'px';
        slingshotHint.textContent = speed > 0.12 ? `lançar ${speed.toFixed(1)}` : 'solte para criar';
        slingshotHint.classList.add('visible');
    }

    function drawSlingshotPreview() {
        if (!slingActive || !slingStart) return;
        const a = toScreen(slingStart.x, slingStart.y);
        const b = { x: pointerX, y: pointerY };
        ctx.save();
        ctx.setLineDash([6, 6]);
        ctx.strokeStyle = 'rgba(253, 230, 138, 0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(253, 230, 138, 0.2)';
        ctx.strokeStyle = 'rgba(253, 230, 138, 0.85)';
        ctx.beginPath();
        ctx.arc(a.x, a.y, bodySizeSetting * cam.zoom, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }

    function drawPointerField() {
        if (!isPointerDown || (mouseMode !== 'attract' && mouseMode !== 'repel' && mouseMode !== 'blackhole')) return;
        const s = { x: pointerX, y: pointerY };
        const g = ctx.createRadialGradient(s.x, s.y, 8, s.x, s.y, 90);
        if (mouseMode === 'attract') {
            g.addColorStop(0, 'rgba(103, 232, 249, 0.28)');
            g.addColorStop(1, 'rgba(0,0,0,0)');
        } else if (mouseMode === 'repel') {
            g.addColorStop(0, 'rgba(249, 168, 212, 0.28)');
            g.addColorStop(1, 'rgba(0,0,0,0)');
        } else {
            g.addColorStop(0, 'rgba(251, 146, 60, 0.35)');
            g.addColorStop(1, 'rgba(0,0,0,0)');
        }
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 90, 0, TAU);
        ctx.fill();
    }

    canvas.addEventListener('mousedown', (e) => {
        const p = canvasPoint(e.clientX, e.clientY);
        pointerDown(p.x, p.y, e.button === 1 || e.button === 2 || e.shiftKey);
    });
    canvas.addEventListener('mousemove', (e) => {
        const p = canvasPoint(e.clientX, e.clientY);
        pointerMove(p.x, p.y);
    });
    window.addEventListener('mouseup', pointerUp);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const p = canvasPoint(e.clientX, e.clientY);
        zoomAt(p.x, p.y, e.deltaY > 0 ? 0.9 : 1.11);
    }, { passive: false });

    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (e.touches.length === 2) {
            slingActive = false;
            isPointerDown = false;
            const a = canvasPoint(e.touches[0].clientX, e.touches[0].clientY);
            const b = canvasPoint(e.touches[1].clientX, e.touches[1].clientY);
            pinchStart = {
                dist: Math.hypot(a.x - b.x, a.y - b.y),
                midX: (a.x + b.x) / 2,
                midY: (a.y + b.y) / 2,
                zoom: cam.zoom
            };
            return;
        }
        const t = e.touches[0];
        const p = canvasPoint(t.clientX, t.clientY);
        pointerDown(p.x, p.y, false);
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (e.touches.length === 2 && pinchStart) {
            const a = canvasPoint(e.touches[0].clientX, e.touches[0].clientY);
            const b = canvasPoint(e.touches[1].clientX, e.touches[1].clientY);
            const dist = Math.hypot(a.x - b.x, a.y - b.y);
            const midX = (a.x + b.x) / 2;
            const midY = (a.y + b.y) / 2;
            const factor = dist / Math.max(1, pinchStart.dist);
            const before = toWorld(midX, midY);
            cam.zoom = clampZoom(pinchStart.zoom * factor);
            const after = toWorld(midX, midY);
            cam.x += before.x - after.x;
            cam.y += before.y - after.y;
            cam.x -= (midX - pinchStart.midX) / cam.zoom;
            cam.y -= (midY - pinchStart.midY) / cam.zoom;
            pinchStart.midX = midX;
            pinchStart.midY = midY;
            cam.follow = false;
            syncFollowBtn();
            return;
        }
        const t = e.touches[0];
        const p = canvasPoint(t.clientX, t.clientY);
        pointerMove(p.x, p.y);
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        if (e.touches.length < 2) pinchStart = null;
        if (e.touches.length === 0) pointerUp();
    }, { passive: false });

    // ---- Loop ----
    let lastFpsUpdate = 0;
    let frameCount = 0;
    const fpsEl = document.getElementById('fps');
    const countEl = document.getElementById('count');
    const bodyCountEl = document.getElementById('bodyCount');
    const hudScene = document.getElementById('hudScene');

    function updateFps(now) {
        frameCount++;
        if (now - lastFpsUpdate > 500) {
            fpsEl.textContent = String(Math.round((frameCount * 1000) / (now - lastFpsUpdate)));
            frameCount = 0;
            lastFpsUpdate = now;
        }
    }

    function animate(now) {
        if (document.hidden) return;
        requestAnimationFrame(animate);
        now = now || performance.now();
        updateFps(now);

        if (running) {
            const steps = Math.max(1, Math.round(timeScale));
            const k = timeScale / steps;
            for (let s = 0; s < steps; s++) {
                for (let i = particles.length - 1; i >= 0; i--) {
                    particles[i].step(k);
                    if (particles[i].absorbed) particles.splice(i, 1);
                }
                updateBodies(k);
            }
        }

        if (cam.follow && selected) {
            cam.x += (selected.x - cam.x) * 0.08;
            cam.y += (selected.y - cam.y) * 0.08;
        }

        drawBackdrop(now);
        ctx.globalCompositeOperation = additiveBlend ? 'lighter' : 'source-over';
        for (let i = 0; i < particles.length; i++) particles[i].draw();
        ctx.globalCompositeOperation = 'source-over';

        if (enableOrbits) {
            for (let i = 0; i < bodies.length; i++) bodies[i].drawTrail();
        }
        for (let i = 0; i < bodies.length; i++) bodies[i].draw();
        drawShocks();
        drawPointerField();
        drawSlingshotPreview();

        if (particles.length > MAX_PARTICLES) particles.splice(0, particles.length - MAX_PARTICLES);
        countEl.textContent = String(particles.length);
        bodyCountEl.textContent = String(bodies.length);
        if (selected) updateInspectMeta();
    }

    // ---- UI ----
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
    const trailsCheckbox = document.getElementById('trails');
    const glowCheckbox = document.getElementById('glow');
    const bounceCheckbox = document.getElementById('bounce');
    const starsCheckbox = document.getElementById('stars');
    const orbitsCheckbox = document.getElementById('orbits');
    const labelsCheckbox = document.getElementById('labels');
    const velocityColorCheckbox = document.getElementById('velocityColor');
    const additiveCheckbox = document.getElementById('additive');
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    const playPauseBtn = document.getElementById('playPauseBtn');
    const toggleTune = document.getElementById('toggleTune');
    const tunePanel = document.getElementById('tunePanel');
    const inspectEl = document.getElementById('inspect');
    const inspectName = document.getElementById('inspectName');
    const inspectMeta = document.getElementById('inspectMeta');
    const inspectSwatch = document.getElementById('inspectSwatch');
    const followBtn = document.getElementById('followBtn');
    const toastEl = document.getElementById('toast');
    const sceneRail = document.getElementById('sceneRail');

    let toastTimer = 0;
    function toast(msg) {
        toastEl.textContent = msg;
        toastEl.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2400);
    }

    function syncUIFromState() {
        gravityInput.value = ambientGravity;
        document.getElementById('gravityValue').textContent = ambientGravity.toFixed(2);
        gStrengthInput.value = gStrength;
        document.getElementById('gStrengthValue').textContent = gStrength.toFixed(1);
        frictionInput.value = friction;
        document.getElementById('frictionValue').textContent = friction.toFixed(3);
        bodiesAttractInput.checked = bodiesAttract;
        absorbInput.checked = absorbEnabled;
        bounceCheckbox.checked = enableBounce;
    }

    function updateInspectMeta() {
        if (!selected) return;
        const speed = Math.hypot(selected.vx, selected.vy);
        inspectMeta.textContent = `${selected.kind} · r ${selected.radius.toFixed(0)} · v ${speed.toFixed(2)}`;
    }

    function syncInspect() {
        if (!selected || bodies.indexOf(selected) === -1) {
            selected = null;
            inspectEl.hidden = true;
            cam.follow = false;
            syncFollowBtn();
            return;
        }
        inspectEl.hidden = false;
        inspectName.textContent = selected.name || 'Corpo';
        inspectSwatch.style.background = selected.color;
        updateInspectMeta();
        syncFollowBtn();
    }

    function syncFollowBtn() {
        followBtn.setAttribute('aria-pressed', cam.follow && selected ? 'true' : 'false');
        followBtn.textContent = cam.follow && selected ? 'Seguindo' : 'Seguir';
    }

    followBtn.addEventListener('click', () => {
        if (!selected) return;
        cam.follow = !cam.follow;
        syncFollowBtn();
    });

    SCENES.forEach((scene) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'scene-chip' + (scene.id === 'solar' ? ' active' : '');
        btn.dataset.scenario = scene.id;
        btn.setAttribute('role', 'option');
        btn.innerHTML = `<span class="scene-swatch" style="--chip:${scene.chip};background:${scene.chip}"></span><span>${scene.name}</span>`;
        btn.addEventListener('click', () => loadScenario(scene.id));
        sceneRail.appendChild(btn);
    });

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
    bodiesAttractInput.addEventListener('change', (e) => { bodiesAttract = e.target.checked; });
    absorbInput.addEventListener('change', (e) => { absorbEnabled = e.target.checked; });
    trailsCheckbox.addEventListener('change', (e) => { enableTrails = e.target.checked; });
    glowCheckbox.addEventListener('change', (e) => { enableGlow = e.target.checked; });
    bounceCheckbox.addEventListener('change', (e) => { enableBounce = e.target.checked; });
    starsCheckbox.addEventListener('change', (e) => { enableStars = e.target.checked; });
    orbitsCheckbox.addEventListener('change', (e) => { enableOrbits = e.target.checked; });
    labelsCheckbox.addEventListener('change', (e) => { enableLabels = e.target.checked; });
    velocityColorCheckbox.addEventListener('change', (e) => { velocityColorMode = e.target.checked; });
    additiveCheckbox.addEventListener('change', (e) => { additiveBlend = e.target.checked; });
    themeSelect.addEventListener('change', (e) => { currentTheme = e.target.value; });

    document.querySelectorAll('.tool-btn[data-mode]').forEach((btn) => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tool-btn[data-mode]').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            mouseMode = btn.dataset.mode;
            slingActive = false;
            slingshotHint.classList.remove('visible');
            isPointerDown = false;
        });
    });

    document.querySelectorAll('.warp-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.warp-btn').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            timeScale = parseFloat(btn.dataset.warp);
        });
    });

    clearBtn.addEventListener('click', () => {
        particles = [];
        bodies = [];
        shockwaves = [];
        selected = null;
        syncInspect();
    });

    randomBtn.addEventListener('click', () => {
        const keys = Object.keys(scenarios);
        currentTheme = Object.keys(themes)[Math.floor(Math.random() * Object.keys(themes).length)];
        themeSelect.value = currentTheme;
        loadScenario(keys[Math.floor(Math.random() * keys.length)]);
        additiveBlend = Math.random() > 0.55;
        additiveCheckbox.checked = additiveBlend;
        velocityColorMode = Math.random() > 0.65;
        velocityColorCheckbox.checked = velocityColorMode;
    });

    toggleTune.addEventListener('click', () => {
        const open = tunePanel.hidden;
        tunePanel.hidden = !open;
        toggleTune.setAttribute('aria-expanded', open ? 'true' : 'false');
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
        if (!document.fullscreenElement) document.body.classList.remove('fullscreen');
    });

    function setRunning(next) {
        running = next;
        playPauseBtn.querySelector('.icon-pause').style.display = running ? 'block' : 'none';
        playPauseBtn.querySelector('.icon-play').style.display = running ? 'none' : 'block';
        playPauseBtn.setAttribute('aria-label', running ? 'Pausar' : 'Retomar');
        playPauseBtn.title = running ? 'Pausar (Espaço)' : 'Retomar (Espaço)';
    }
    playPauseBtn.addEventListener('click', () => setRunning(!running));

    const modeKeys = { q: 'spawn', w: 'body', a: 'attract', e: 'repel', h: 'blackhole', x: 'erase' };

    document.addEventListener('keydown', (e) => {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
        if (e.code === 'Space') {
            e.preventDefault();
            setRunning(!running);
        } else if (e.key === 'c' || e.key === 'C') {
            clearBtn.click();
        } else if (e.key === 'f' || e.key === 'F') {
            fullscreenBtn.click();
        } else if (e.key === 'r' || e.key === 'R') {
            randomBtn.click();
        } else if (e.key >= '1' && e.key <= '8') {
            const idx = parseInt(e.key, 10) - 1;
            if (SCENES[idx]) loadScenario(SCENES[idx].id);
        } else if (modeKeys[e.key.toLowerCase()]) {
            const mode = modeKeys[e.key.toLowerCase()];
            const btn = document.querySelector(`.tool-btn[data-mode="${mode}"]`);
            if (btn) btn.click();
        }
    });

    window.addEventListener('resize', resize);

    const hashScene = (location.hash || '').replace('#', '');
    if (scenarios[hashScene]) currentScenario = hashScene;

    resize();
    requestAnimationFrame(animate);
    window.LabVisibility?.whenVisible(() => requestAnimationFrame(animate));
})();
