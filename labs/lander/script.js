/**
 * Lunar Lander - Retro Win3.1 Style
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game State
let gameState = 'START';
let score = 0;
let level = 1;
let lastTime = 0;

// Physics - Optimized for Realistic Moon Gravity (Slow, deliberate)
const GRAVITY = 0.0015; // Very low gravity (Moon is 1/6th Earth)
const THRUST_POWER = 0.0035; // Gentle thrust for fine control
const ROTATION_SPEED = 0.03; // Slower rotation
const LANDING_MAX_SPEED = 0.3; // Strict landing speed
const LANDING_MAX_ANGLE = 0.15; // Strict landing angle

// Colors
const COLOR_BG = '#000000';
const COLOR_TERRAIN = '#ffffff';
const COLOR_SHIP_BODY = '#ffffff';
const COLOR_SHIP_LEGS = '#ffff00';
const COLOR_SHIP_DETAIL = '#000000'; // Or grey

let particles = [];
let terrain = [];
let landingPads = [];

const lander = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2, // Upright
    fuel: 1000,
    maxFuel: 1000,
    thrusting: false,
    rotatingLeft: false,
    rotatingRight: false,
    onGround: true,
    crashed: false,
    landed: false,

    reset: function () {
        const homePad = landingPads[0];
        this.x = (homePad.x1 + homePad.x2) / 2;
        this.y = homePad.y - 12; // Adjusted for new sprite height ~24px total

        this.vx = 0;
        this.vy = 0;
        this.angle = -Math.PI / 2;
        this.thrusting = false;
        this.rotatingLeft = false;
        this.rotatingRight = false;
        this.crashed = false;
        this.landed = false;
        this.onGround = true;

        if (level === 1) this.fuel = this.maxFuel;
        else this.fuel = Math.min(this.fuel + 500, this.maxFuel);

        particles = [];
        updateHUD();
    },

    update: function (dt) {
        if (this.crashed || this.landed) return;

        if (this.onGround) {
            this.vx = 0;
            this.vy = 0;
            this.angle = -Math.PI / 2;

            if (this.thrusting && this.fuel > 0) {
                this.onGround = false;
                this.vy -= 0.05;
            } else {
                return;
            }
        }

        this.vy += GRAVITY * dt;

        if (this.thrusting && this.fuel > 0) {
            const tx = Math.cos(this.angle) * THRUST_POWER * dt;
            const ty = Math.sin(this.angle) * THRUST_POWER * dt;
            this.vx += tx;
            this.vy += ty;
            this.fuel -= 0.5 * dt;

            // Simple white/grey/yellow pixel particles usually
            // User requested "fire" so we use red/yellow pixels
            for (let i = 0; i < 3; i++) {
                particles.push({
                    x: this.x - Math.cos(this.angle) * 10,
                    y: this.y - Math.sin(this.angle) * 10,
                    vx: this.vx - Math.cos(this.angle) * (1 + Math.random()),
                    vy: this.vy - Math.sin(this.angle) * (1 + Math.random()),
                    life: 1.0,
                    color: Math.random() > 0.5 ? '#ffff00' : '#ff0000'
                });
            }
        }

        if (this.rotatingLeft) this.angle -= ROTATION_SPEED;
        if (this.rotatingRight) this.angle += ROTATION_SPEED;

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Wrap
        if (this.x < 0) this.x = canvas.width;
        if (this.x > canvas.width) this.x = 0;
    },

    draw: function (ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle + Math.PI / 2);

        if (this.crashed) {
            // Debris
            ctx.fillStyle = '#fff';
            for (let i = 0; i < 8; i++) {
                let r = Math.random() * 20;
                let a = Math.random() * Math.PI * 2;
                ctx.fillRect(Math.cos(a) * r, Math.sin(a) * r, 2, 2);
            }
        } else {
            // Recreating the Sprite from Image 
            // Yellow Legs (Curve)
            ctx.fillStyle = COLOR_SHIP_LEGS;

            // Left leg
            ctx.beginPath();
            ctx.moveTo(-8, 5);
            ctx.quadraticCurveTo(-12, 12, -14, 12);
            ctx.lineTo(-10, 12); // Foot
            ctx.lineTo(-6, 8);
            ctx.fill();

            // Right leg
            ctx.beginPath();
            ctx.moveTo(8, 5);
            ctx.quadraticCurveTo(12, 12, 14, 12);
            ctx.lineTo(10, 12);
            ctx.lineTo(6, 8);
            ctx.fill();

            // Body: White Sphere/Dome
            ctx.fillStyle = COLOR_SHIP_BODY;
            ctx.beginPath();
            ctx.arc(0, 0, 7, Math.PI, 0); // Top half circle
            ctx.lineTo(7, 3);
            ctx.lineTo(-7, 3);
            ctx.fill();

            // Base of body (darker or metallic?)
            // Image shows it kind of spherical.

            // Windows/Detail: Black pixels
            ctx.fillStyle = '#000';
            // Cockpit eyes/window
            ctx.fillRect(-3, -4, 2, 2);
            ctx.fillRect(1, -4, 2, 2);

            // Thruster nozzle
            ctx.fillStyle = '#888';
            ctx.fillRect(-3, 3, 6, 3);
        }
        ctx.restore();
    }
};

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.05;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

function drawParticles(ctx) {
    if (!particles.length) return;
    particles.forEach(p => {
        ctx.fillStyle = p.color;
        const s = Math.ceil(p.life * 3);
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    });
}

// Map Logic
function generateTerrain(lvl) {
    terrain = [];
    landingPads = [];
    const w = canvas.width;
    const h = canvas.height;

    // Simple jagged terrain
    let pts = 20;
    let x = 0;
    let y = h * 0.85;

    // Start Pad
    landingPads.push({ x1: 20, x2: 80, y: h * 0.8, multiplier: 0 });
    terrain.push({ x: 0, y: h });
    terrain.push({ x: 0, y: h * 0.8 });
    terrain.push({ x: 20, y: h * 0.8 });
    terrain.push({ x: 80, y: h * 0.8 });
    x = 80;
    y = h * 0.8;

    // Random segments
    while (x < w - 20) {
        // Chance for pad
        if (Math.random() < 0.2 && x > 100 && x < w - 100) {
            let nextX = Math.min(x + 50, w);
            // Pad is flat
            landingPads.push({ x1: x, x2: nextX, y: y, multiplier: Math.floor(Math.random() * 4) + 2 });
            terrain.push({ x: nextX, y: y });
            x = nextX;
        } else {
            let nextX = Math.min(x + Math.random() * 40 + 10, w);
            let nextY = y + (Math.random() - 0.5) * 60;
            if (nextY > h - 10) nextY = h - 10;
            if (nextY < h * 0.4) nextY = h * 0.4;

            terrain.push({ x: nextX, y: nextY });
            x = nextX;
            y = nextY;
        }
    }

    terrain.push({ x: w, y: h * 0.8 }); // End flat
    terrain.push({ x: w, y: h });
}

function drawTerrain(ctx) {
    ctx.fillStyle = COLOR_TERRAIN;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height); // Start bottom left
    terrain.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(canvas.width, canvas.height);
    ctx.fill();

    // Highlight Pads? In the screenshot they look white too, maybe just flat areas.
    // We can add small text x2 under gravity? 
    // Or maybe just draw small indicator lines
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1;
    landingPads.forEach(pad => {
        if (pad.multiplier > 0) {
            ctx.strokeRect(pad.x1, pad.y, pad.x2 - pad.x1, 2);
            ctx.fillStyle = '#fff';
            ctx.font = '10px monospace';
            ctx.fillText('x' + pad.multiplier, pad.x1 + 10, pad.y + 12);
        }
    });
}

function checkCollision() {
    // Check floor
    // Simplification: Point sample feet

    // Find terrain segment below lander
    // ... (Similar logic to previous, omitted for brevity, trust simple proximity)

    // Simple check: Just check Y vs nearby terrain points
    // This is a "lab" game, robust collision is good but pixel perfect not strictly req.
    // Let's use the segment logic again for correctness.

    if (lander.y < 0) return; // Space is safe

    // Check pads first (Priority land)
    for (let pad of landingPads) {
        if (lander.x > pad.x1 && lander.x < pad.x2 && Math.abs((lander.y + 12) - pad.y) < 5) {
            // Legs touching pad Y
            if (lander.vy > 0) { // Moving down
                checkLanding(pad.multiplier);
                return;
            }
        }
    }

    // Check Terrain Lines
    for (let i = 0; i < terrain.length - 1; i++) {
        let p1 = terrain[i];
        let p2 = terrain[i + 1];
        if (lander.x >= p1.x && lander.x <= p2.x) {
            // Lerp Y
            let t = (lander.x - p1.x) / (p2.x - p1.x);
            let groundY = p1.y + t * (p2.y - p1.y);

            if (lander.y + 10 > groundY) {
                crash(); // Hit non-pad ground
                return;
            }
        }
    }

    if (lander.y > canvas.height) crash();
}

function checkLanding(mult) {
    if (Math.abs(lander.vy) < LANDING_MAX_SPEED && Math.abs(lander.vx) < LANDING_MAX_SPEED) { // Add drift check
        land(mult);
    } else {
        crash();
    }
}

function crash() {
    gameState = 'GAMEOVER';
    lander.crashed = true;
    document.getElementById('gameOverMsg').classList.remove('hidden');
}

function land(mult) {
    gameState = 'LANDED';
    lander.landed = true;
    score += (mult || 1) * 50;
    if (mult === 0) lander.fuel = lander.maxFuel; // Refuel at home

    // Update Score display instantly
    updateHUD();

    setTimeout(() => {
        if (mult > 0) {
            level++;
            // alert("Safe Landing! Next Level..."); // Removed alert for smoother flow
            startGame();
        } else {
            // Landed on start pad, allow taking off again
            lander.onGround = true;
            lander.landed = false; // logic fix: allow update() to run again
            gameState = 'PLAYING';
        }
    }, 1000);
}

function startGame() {
    gameState = 'PLAYING';
    document.getElementById('startMsg').classList.add('hidden');
    document.getElementById('gameOverMsg').classList.add('hidden');
    generateTerrain(level);
    lander.reset();
    // Do NOT call requestAnimationFrame here, loop is always running
}

function updateHUD() {
    // Top right format "Altitude   1000.00"
    const alt = Math.max(0, canvas.height - lander.y - 12 - 2).toFixed(2); // precise altitude
    document.getElementById('hudAlt').innerText = alt;
    document.getElementById('hudHSpeed').innerText = lander.vx.toFixed(2);
    document.getElementById('hudVSpeed').innerText = (-lander.vy).toFixed(2);
    document.getElementById('hudFuel').innerText = lander.fuel.toFixed(2);
}

function gameLoop(ts) {
    let dt = ts - lastTime;
    lastTime = ts;
    if (dt > 50) dt = 50;

    if (gameState === 'PLAYING' || gameState === 'LANDED') {
        handleInput();
        lander.update(dt);
        updateParticles();
        checkCollision();
    }

    updateHUD();

    // Draw
    ctx.fillStyle = COLOR_BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawTerrain(ctx);
    drawParticles(ctx);
    lander.draw(ctx);

    requestAnimationFrame(gameLoop);
}

// Input
const keys = {};
window.onkeydown = e => {
    // Prevent default scrolling for game keys
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
        e.preventDefault();
    }

    keys[e.code] = true;

    if (e.code === 'Space') {
        if (gameState === 'START' || gameState === 'GAMEOVER') startGame();
    }
}
window.onkeyup = e => keys[e.code] = false;

function handleInput() {
    lander.rotatingLeft = keys['ArrowLeft'];
    lander.rotatingRight = keys['ArrowRight'];
    lander.thrusting = keys['ArrowUp'] || keys['ArrowDown'] || keys['Space']; // Added Space for thrust
}

// Touch Handling for On Screen Controls
const bindBtn = (id, code) => {
    const el = document.getElementById(id);
    const setKey = (val) => {
        if (code === 'ArrowUp') { keys['ArrowUp'] = val; keys['ArrowDown'] = val; } // map both for thrust
        else keys[code] = val;
    };

    el.onmousedown = e => { setKey(true); el.classList.add('active'); }
    el.onmouseup = e => { setKey(false); el.classList.remove('active'); }
    el.onmouseleave = e => { setKey(false); el.classList.remove('active'); }
    el.ontouchstart = e => { e.preventDefault(); setKey(true); el.classList.add('active'); }
    el.ontouchend = e => { e.preventDefault(); setKey(false); el.classList.remove('active'); }
}
bindBtn('btnLeft', 'ArrowLeft');
bindBtn('btnRight', 'ArrowRight');
bindBtn('btnThrust', 'ArrowUp');

// Start
generateTerrain(1);
lander.reset();
lander.draw(ctx); // Initial draw
requestAnimationFrame(gameLoop); // Start loop ONCE
