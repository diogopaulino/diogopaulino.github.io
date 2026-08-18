/**
 * Lander — classic DOS-inspired arcade flight.
 *
 * All motion uses pixels/second and a fixed timestep. This keeps the controls
 * responsive and deterministic without tying the game speed to the frame rate.
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const PHYSICS = Object.freeze({
    gravity: 24,
    thrust: 72,
    rotation: 2.1,
    fuelBurn: 30,
    safeHorizontalSpeed: 24,
    safeVerticalSpeed: 34,
    safeAngle: 0.18,
    fixedStep: 1 / 120,
    maxFrameTime: 0.1
});

const INITIAL_FUEL = 1000;
const LANDER_FOOT_OFFSET = 12;
const LANDER_HALF_WIDTH = 13;
const CEILING = 30;
const COLORS = Object.freeze({
    background: '#000',
    terrain: '#fff',
    stars: '#fff',
    ship: '#fff',
    legs: '#ff0',
    pad: '#ff0',
    danger: '#f33'
});

let gameState = 'START';
let level = 1;
let score = 0;
let lastTime = 0;
let accumulator = 0;
let terrain = [];
let landingPads = [];
let stars = [];
let particles = [];
let engineParticleBudget = 0;

const keys = {};

/* --- Som -------------------------------------------------------------------
   O propulsor não é um "efeito": é um ruído contínuo cuja intensidade segue o
   acelerador. Por isso ele tem grafo próprio (ruído em loop + passa-baixa),
   enquanto pouso, colisão e reabastecimento passam pelo LabAudio.

   O contexto só nasce no primeiro gesto do jogador — navegadores recusam áudio
   antes disso. */
const labAudio = window.LabAudio;

const engine = {
    ctx: null,
    source: null,
    gain: null,
    filter: null,
    running: false,
};

function ensureEngineAudio() {
    if (!labAudio || labAudio.isMuted()) return null;
    if (engine.ctx) {
        if (engine.ctx.state === 'suspended') engine.ctx.resume();
        return engine.ctx;
    }

    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;

    const ctxAudio = new Ctx();
    const seconds = 2;
    const buffer = ctxAudio.createBuffer(1, ctxAudio.sampleRate * seconds, ctxAudio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    const source = ctxAudio.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = ctxAudio.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    filter.Q.value = 0.9;

    const gain = ctxAudio.createGain();
    gain.gain.value = 0;

    source.connect(filter).connect(gain).connect(ctxAudio.destination);
    source.start();

    engine.ctx = ctxAudio;
    engine.source = source;
    engine.filter = filter;
    engine.gain = gain;
    engine.running = true;
    return ctxAudio;
}

/* `level` é a fração de empuxo efetivo (0 sem combustível, 1 no talo). */
function setEngineLevel(level) {
    const ctxAudio = engine.running ? engine.ctx : ensureEngineAudio();
    if (!ctxAudio || !engine.gain) return;

    const muted = labAudio ? labAudio.isMuted() : false;
    const target = muted ? 0 : level * 0.12;
    // setTargetAtTime evita o estalo que um corte seco no ganho produziria.
    engine.gain.gain.setTargetAtTime(target, ctxAudio.currentTime, 0.04);
    engine.filter.frequency.setTargetAtTime(360 + level * 520, ctxAudio.currentTime, 0.06);
}

function sfx(name) {
    if (!labAudio) return;
    switch (name) {
        case 'land':
            labAudio.sequence([523, 659, 784], { step: 0.09, duration: 0.18, gain: 0.13, type: 'triangle' });
            break;
        case 'refuel':
            labAudio.tone({ freq: 300, duration: 0.35, gain: 0.1, slideTo: 720, type: 'sine' });
            break;
        case 'crash':
            labAudio.noise({ duration: 0.7, gain: 0.28, filter: 260 });
            labAudio.tone({ freq: 110, duration: 0.8, gain: 0.18, slideTo: 35, type: 'sawtooth' });
            break;
        case 'launch':
            labAudio.tone({ freq: 180, duration: 0.5, gain: 0.1, slideTo: 420, type: 'triangle' });
            break;
        case 'lowfuel':
            labAudio.tone({ freq: 880, duration: 0.09, gain: 0.09, type: 'square' });
            break;
    }
}

function setGameState(nextState) {
    gameState = nextState;
    document.querySelector('.game-viewport').dataset.state = nextState.toLowerCase();
}

const lander = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    angle: 0,
    fuel: INITIAL_FUEL,
    thrusting: false,
    // Espelha `thrusting` mas só muda quando o propulsor de fato queima
    // combustível — é o que liga e desliga o ruído contínuo do motor.
    engineOn: false,
    rotatingLeft: false,
    rotatingRight: false,
    onGround: true,
    crashed: false,
    landed: false,

    reset() {
        const homePad = landingPads[0];
        this.x = (homePad.x1 + homePad.x2) / 2;
        this.y = homePad.y - LANDER_FOOT_OFFSET;
        this.vx = 0;
        this.vy = 0;
        this.angle = 0;
        this.fuel = INITIAL_FUEL;
        this.thrusting = false;
        this.engineOn = false;
        this.rotatingLeft = false;
        this.rotatingRight = false;
        this.onGround = true;
        this.crashed = false;
        this.landed = false;
        accumulator = 0;
        particles = [];
        engineParticleBudget = 0;
        clearKeys();
        updateHUD();
    },

    update(dt) {
        if (this.crashed || this.landed) return;

        if (this.onGround) {
            this.vx = 0;
            this.vy = 0;
            this.angle = 0;

            if (!this.thrusting || this.fuel <= 0) return;
            this.onGround = false;
        }

        if (this.rotatingLeft) this.angle -= PHYSICS.rotation * dt;
        if (this.rotatingRight) this.angle += PHYSICS.rotation * dt;
        this.angle = normalizeAngle(this.angle);

        this.vy += PHYSICS.gravity * dt;

        if (this.thrusting && this.fuel > 0) {
            const requestedFuel = PHYSICS.fuelBurn * dt;
            const usedFuel = Math.min(this.fuel, requestedFuel);
            const thrustFraction = usedFuel / requestedFuel;
            const acceleration = PHYSICS.thrust * thrustFraction * dt;

            this.vx += Math.sin(this.angle) * acceleration;
            this.vy -= Math.cos(this.angle) * acceleration;
            this.fuel -= usedFuel;
            emitEngineParticles(dt);
            setEngineLevel(thrustFraction);
            this.engineOn = true;
        } else if (this.engineOn) {
            setEngineLevel(0);
            this.engineOn = false;
        }

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        if (this.x < -LANDER_HALF_WIDTH) this.x = canvas.width + LANDER_HALF_WIDTH;
        if (this.x > canvas.width + LANDER_HALF_WIDTH) this.x = -LANDER_HALF_WIDTH;

        if (this.y < CEILING) {
            this.y = CEILING;
            if (this.vy < 0) this.vy = 0;
        }
    },

    draw(target) {
        target.save();
        target.translate(this.x, this.y);
        target.rotate(this.angle);

        if (this.crashed) {
            target.fillStyle = COLORS.danger;
            target.fillRect(-2, -2, 4, 4);
            target.restore();
            return;
        }

        target.fillStyle = COLORS.legs;
        target.beginPath();
        target.moveTo(-8, 5);
        target.quadraticCurveTo(-12, 12, -14, 12);
        target.lineTo(-10, 12);
        target.lineTo(-6, 8);
        target.fill();

        target.beginPath();
        target.moveTo(8, 5);
        target.quadraticCurveTo(12, 12, 14, 12);
        target.lineTo(10, 12);
        target.lineTo(6, 8);
        target.fill();

        target.fillStyle = COLORS.ship;
        target.beginPath();
        target.arc(0, 0, 7, Math.PI, 0);
        target.lineTo(7, 3);
        target.lineTo(-7, 3);
        target.fill();

        target.fillStyle = '#000';
        target.fillRect(-3, -4, 2, 2);
        target.fillRect(1, -4, 2, 2);

        target.fillStyle = '#888';
        target.fillRect(-3, 3, 6, 3);
        target.restore();
    }
};

function clearKeys() {
    Object.keys(keys).forEach(code => {
        keys[code] = false;
    });
    document.querySelectorAll('.control-btn.active').forEach(button => {
        button.classList.remove('active');
    });
}

function normalizeAngle(angle) {
    let normalized = angle;
    while (normalized > Math.PI) normalized -= Math.PI * 2;
    while (normalized < -Math.PI) normalized += Math.PI * 2;
    return normalized;
}

function handleInput() {
    lander.rotatingLeft = Boolean(keys.ArrowLeft || keys.KeyA);
    lander.rotatingRight = Boolean(keys.ArrowRight || keys.KeyD);
    lander.thrusting = Boolean(keys.ArrowUp || keys.KeyW || keys.Space);
}

function generateStars() {
    stars = Array.from({ length: 65 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height * 0.78,
        size: Math.random() > 0.88 ? 2 : 1,
        alpha: 0.45 + Math.random() * 0.55
    }));
}

function generateTerrain() {
    const homeY = canvas.height * 0.82;
    terrain = [
        { x: 0, y: canvas.height },
        { x: 0, y: homeY },
        { x: 20, y: homeY },
        { x: 110, y: homeY }
    ];
    landingPads = [{
        x1: 20,
        x2: 110,
        y: homeY,
        home: true,
        multiplier: 1,
        visited: false
    }];

    let x = 110;
    let y = homeY;

    while (x < canvas.width - 35) {
        const roughEnd = Math.min(x + 42 + Math.random() * 68, canvas.width);
        y += (Math.random() - 0.5) * (82 + level * 3);
        y = Math.max(canvas.height * 0.48, Math.min(canvas.height * 0.91, y));
        terrain.push({ x: roughEnd, y });
        x = roughEnd;

        if (x >= canvas.width - 65) break;

        const baseWidth = Math.max(40, 74 - level * 2);
        const padWidth = Math.round(baseWidth - Math.random() * 22);
        const padEnd = Math.min(x + padWidth, canvas.width - 8);
        const multiplier = padWidth <= 46 ? 5 : padWidth <= 59 ? 3 : 2;

        landingPads.push({
            x1: x,
            x2: padEnd,
            y,
            home: false,
            multiplier,
            visited: false
        });
        terrain.push({ x: padEnd, y });
        x = padEnd;
    }

    if (x < canvas.width) terrain.push({ x: canvas.width, y: canvas.height * 0.82 });
    terrain.push({ x: canvas.width, y: canvas.height });
}

function getGroundY(screenX) {
    const wrappedX = ((screenX % canvas.width) + canvas.width) % canvas.width;

    for (let i = 0; i < terrain.length - 1; i++) {
        const current = terrain[i];
        const next = terrain[i + 1];
        if (current.x === next.x || wrappedX < current.x || wrappedX > next.x) continue;

        const progress = (wrappedX - current.x) / (next.x - current.x);
        return current.y + progress * (next.y - current.y);
    }

    return canvas.height;
}

function getCurrentAltitude() {
    return Math.max(0, getGroundY(lander.x) - (lander.y + LANDER_FOOT_OFFSET));
}

function findPadAt(screenX) {
    return landingPads.find(pad => (
        screenX - LANDER_HALF_WIDTH >= pad.x1
        && screenX + LANDER_HALF_WIDTH <= pad.x2
    ));
}

function checkCollision() {
    if (lander.onGround || lander.crashed || lander.landed) return;

    const footY = lander.y + LANDER_FOOT_OFFSET;
    const collisionY = Math.min(
        getGroundY(lander.x - LANDER_HALF_WIDTH + 2),
        getGroundY(lander.x),
        getGroundY(lander.x + LANDER_HALF_WIDTH - 2)
    );

    if (footY < collisionY) return;

    const pad = findPadAt(lander.x);
    const safeHorizontal = Math.abs(lander.vx) <= PHYSICS.safeHorizontalSpeed;
    const safeVertical = lander.vy >= 0 && lander.vy <= PHYSICS.safeVerticalSpeed;
    const safeAngle = Math.abs(normalizeAngle(lander.angle)) <= PHYSICS.safeAngle;

    if (pad && safeHorizontal && safeVertical && safeAngle) {
        land(pad);
    } else {
        crash();
    }
}

function land(pad) {
    setEngineLevel(0);
    const landingVerticalSpeed = lander.vy;
    lander.x = Math.max(pad.x1 + LANDER_HALF_WIDTH, Math.min(pad.x2 - LANDER_HALF_WIDTH, lander.x));
    lander.y = pad.y - LANDER_FOOT_OFFSET;
    lander.vx = 0;
    lander.vy = 0;
    lander.angle = 0;
    lander.thrusting = false;

    if (pad.home) {
        lander.onGround = true;
        lander.fuel = INITIAL_FUEL;
        setFlightStatus('REFUELED', 'safe');
        sfx('refuel');
        return;
    }

    const softness = Math.max(0, 1 - landingVerticalSpeed / PHYSICS.safeVerticalSpeed);
    const landingPoints = Math.round(100 * pad.multiplier * (1 + softness));
    score += landingPoints;
    pad.visited = true;
    lander.landed = true;
    setGameState('LANDED');

    setStatusMessage(
        `SAFE LANDING<br><strong>+${landingPoints} POINTS</strong><small>Press Space for the next mission</small>`,
        'success'
    );
    setFlightStatus('LANDED', 'safe');
    sfx('land');
}

function crash() {
    setGameState('CRASHED');
    lander.crashed = true;
    lander.thrusting = false;
    lander.engineOn = false;
    setEngineLevel(0);
    sfx('crash');
    createCrashDebris();
    setStatusMessage('CRASHED<br><small>Press Space to try again</small>', 'danger');
    setFlightStatus('HULL LOST', 'danger');
}

function setStatusMessage(html, tone) {
    const message = document.getElementById('gameOverMsg');
    message.innerHTML = html;
    message.dataset.tone = tone;
    message.classList.remove('hidden');
}

function setFlightStatus(text, tone = '') {
    const status = document.getElementById('hudStatus');
    status.innerText = text;
    status.dataset.tone = tone;
}

function startMission({ nextLevel = false, newGame = false } = {}) {
    if (newGame) {
        level = 1;
        score = 0;
    } else if (nextLevel) {
        level++;
    }

    if (newGame || nextLevel) generateTerrain();

    setGameState('PLAYING');
    document.getElementById('startMsg').classList.add('hidden');
    document.getElementById('gameOverMsg').classList.add('hidden');
    lander.reset();
    lander.engineOn = false;
    setEngineLevel(0);
    lowFuelWarned = false;
    setFlightStatus('READY');
    sfx('launch');
}

/* Bipe único ao cruzar 15% de combustível: repetir a cada frame viraria alarme
   de incêndio, e avisar tarde demais não deixa tempo de reagir. */
const LOW_FUEL_RATIO = 0.15;
let lowFuelWarned = false;

function checkLowFuel() {
    if (gameState !== 'PLAYING') return;
    const low = lander.fuel <= INITIAL_FUEL * LOW_FUEL_RATIO;
    if (low && !lowFuelWarned) {
        lowFuelWarned = true;
        sfx('lowfuel');
        setFlightStatus('LOW FUEL', 'danger');
    } else if (!low) {
        lowFuelWarned = false;
    }
}

function emitEngineParticles(dt) {
    engineParticleBudget += 70 * dt;
    const count = Math.floor(engineParticleBudget);
    engineParticleBudget -= count;
    if (count === 0) return;

    const exhaustX = -Math.sin(lander.angle);
    const exhaustY = Math.cos(lander.angle);

    for (let i = 0; i < count; i++) {
        const speed = 58 + Math.random() * 32;
        particles.push({
            x: lander.x + exhaustX * 9 + (Math.random() - 0.5) * 4,
            y: lander.y + 5 + exhaustY * 8,
            vx: exhaustX * speed + lander.vx * 0.15,
            vy: exhaustY * speed + lander.vy * 0.15,
            life: 0.2 + Math.random() * 0.18,
            color: Math.random() > 0.3 ? '#ff0' : '#f30',
            debris: false
        });
    }
}

function createCrashDebris() {
    for (let i = 0; i < 18; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 35 + Math.random() * 80;
        particles.push({
            x: lander.x,
            y: lander.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 25,
            life: 1.1 + Math.random() * 1.1,
            color: i % 4 === 0 ? '#ff0' : '#fff',
            debris: true
        });
    }
}

function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        if (particle.debris) particle.vy += PHYSICS.gravity * 1.6 * dt;
        particle.life -= dt;
        if (particle.life <= 0) particles.splice(i, 1);
    }
}

function setReadoutState(element, value, safeLimit) {
    const ratio = Math.abs(value) / safeLimit;
    element.classList.toggle('danger', ratio > 1);
    element.classList.toggle('caution', ratio > 0.72 && ratio <= 1);
}

function updateHUD() {
    const altitude = getCurrentAltitude();
    const angleDegrees = normalizeAngle(lander.angle) * 180 / Math.PI;
    const horizontal = lander.vx;
    const vertical = -lander.vy;

    document.getElementById('hudMission').innerText = String(level).padStart(2, '0');
    document.getElementById('hudScore').innerText = String(score).padStart(6, '0');
    document.getElementById('hudAlt').innerText = altitude.toFixed(0);
    document.getElementById('hudHSpeed').innerText = horizontal.toFixed(1);
    document.getElementById('hudVSpeed').innerText = vertical.toFixed(1);
    document.getElementById('hudAngle').innerText = `${angleDegrees >= 0 ? '+' : ''}${angleDegrees.toFixed(0)}°`;
    document.getElementById('hudFuel').innerText = Math.max(0, lander.fuel).toFixed(0);

    setReadoutState(document.getElementById('hudHSpeed'), horizontal, PHYSICS.safeHorizontalSpeed);
    setReadoutState(document.getElementById('hudVSpeed'), lander.vy, PHYSICS.safeVerticalSpeed);
    setReadoutState(document.getElementById('hudAngle'), angleDegrees, PHYSICS.safeAngle * 180 / Math.PI);

    const fuel = document.getElementById('hudFuel');
    fuel.classList.toggle('danger', lander.fuel <= 100);
    fuel.classList.toggle('caution', lander.fuel > 100 && lander.fuel <= 250);

    if (gameState === 'PLAYING' && !lander.onGround) {
        setFlightStatus(altitude < 90 ? 'FINAL APPROACH' : 'IN FLIGHT', altitude < 90 ? 'caution' : '');
    }
}

function drawStars(target) {
    stars.forEach(star => {
        target.globalAlpha = star.alpha;
        target.fillStyle = COLORS.stars;
        target.fillRect(star.x, star.y, star.size, star.size);
    });
    target.globalAlpha = 1;
}

function drawTerrain(target) {
    target.fillStyle = COLORS.terrain;
    target.beginPath();
    target.moveTo(0, canvas.height);
    terrain.forEach(point => target.lineTo(point.x, point.y));
    target.lineTo(canvas.width, canvas.height);
    target.fill();

    const beaconPulse = 2 + Math.sin(performance.now() / 180) * 1.5;
    landingPads.forEach(pad => {
        target.fillStyle = COLORS.pad;
        target.fillRect(pad.x1, pad.y - 2, pad.x2 - pad.x1, 3);

        target.font = '12px "Courier New", monospace';
        target.textAlign = 'center';
        target.fillStyle = '#000';
        target.fillText(
            pad.home ? 'BASE' : `×${pad.multiplier}`,
            (pad.x1 + pad.x2) / 2,
            pad.y + 14
        );

        if (!pad.home) {
            target.fillStyle = COLORS.pad;
            target.fillRect(pad.x1 - beaconPulse / 2, pad.y - 7, beaconPulse, 5);
            target.fillRect(pad.x2 - beaconPulse / 2, pad.y - 7, beaconPulse, 5);
        }
    });
}

function drawParticles(target) {
    particles.forEach(particle => {
        target.fillStyle = particle.color;
        const size = particle.debris ? 3 : Math.max(1, Math.ceil(particle.life * 7));
        target.fillRect(particle.x - size / 2, particle.y - size / 2, size, size);
    });
}

function draw() {
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawStars(ctx);
    drawTerrain(ctx);
    drawParticles(ctx);
    lander.draw(ctx);
}

function gameLoop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const frameTime = Math.min((timestamp - lastTime) / 1000, PHYSICS.maxFrameTime);
    lastTime = timestamp;

    if (gameState === 'PLAYING') {
        accumulator += frameTime;
        handleInput();

        while (accumulator >= PHYSICS.fixedStep) {
            lander.update(PHYSICS.fixedStep);
            updateParticles(PHYSICS.fixedStep);
            checkCollision();
            accumulator -= PHYSICS.fixedStep;
            if (gameState !== 'PLAYING') break;
        }
    } else {
        updateParticles(frameTime);
    }

    checkLowFuel();
    updateHUD();
    draw();
    requestAnimationFrame(gameLoop);
}

window.addEventListener('keydown', event => {
    const gameCodes = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyW', 'KeyA', 'KeyD'];
    if (gameCodes.includes(event.code)) event.preventDefault();

    if (event.code === 'KeyR' && !event.repeat) {
        startMission({ newGame: true });
    } else if (event.code === 'Space' && !event.repeat && gameState !== 'PLAYING') {
        startMission({ nextLevel: gameState === 'LANDED' });
    }

    keys[event.code] = true;
});

window.addEventListener('keyup', event => {
    keys[event.code] = false;
});

window.addEventListener('blur', clearKeys);

function bindButton(id, code) {
    const element = document.getElementById(id);

    const setPressed = pressed => {
        keys[code] = pressed;
        element.classList.toggle('active', pressed);
    };

    element.addEventListener('pointerdown', event => {
        event.preventDefault();
        element.setPointerCapture?.(event.pointerId);
        if (gameState !== 'PLAYING') {
            startMission({ nextLevel: gameState === 'LANDED' });
        }
        setPressed(true);
    });
    element.addEventListener('pointerup', () => setPressed(false));
    element.addEventListener('pointercancel', () => setPressed(false));
    element.addEventListener('lostpointercapture', () => setPressed(false));
}

document.getElementById('btnNewGame').addEventListener('click', () => {
    startMission({ newGame: true });
});

document.getElementById('btnStart').addEventListener('click', () => {
    startMission({ newGame: true });
});

bindButton('btnLeft', 'ArrowLeft');
bindButton('btnRight', 'ArrowRight');
bindButton('btnThrust', 'ArrowUp');

if (labAudio) {
    labAudio.configure({ storageKey: 'lander:muted', volume: 0.5 });
    const host = document.querySelector('[data-lab-header] .header-actions');
    if (host) labAudio.mountToggle(host);
    // Mudo pelo botão precisa calar o propulsor contínuo na hora.
    labAudio.onChange(() => setEngineLevel(lander.engineOn ? 1 : 0));
}

// Aba escondida: o motor não pode continuar roncando em segundo plano.
document.addEventListener('visibilitychange', () => {
    if (document.hidden) setEngineLevel(0);
});

generateStars();
generateTerrain();
lander.reset();
setGameState('START');
setFlightStatus('READY');
draw();
requestAnimationFrame(gameLoop);
