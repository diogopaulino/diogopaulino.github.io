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
const LOGICAL_WIDTH = 800;
const LOGICAL_HEIGHT = 600;
let dpr = 1;

function syncHiDPI() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(LOGICAL_WIDTH * dpr) || canvas.height !== Math.round(LOGICAL_HEIGHT * dpr)) {
        canvas.width = Math.round(LOGICAL_WIDTH * dpr);
        canvas.height = Math.round(LOGICAL_HEIGHT * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
syncHiDPI();
window.addEventListener('resize', syncHiDPI);

const COLORS = Object.freeze({
    background: '#03050a',
    terrain: '#d8dce3',
    stars: '#fff',
    ship: '#e2e8f0',
    legs: '#eab308',
    pad: '#fbbf24',
    danger: '#f33'
});

let gameState = 'START';
let level = 1;
let score = 0;
let lastTime = 0;
let accumulator = 0;
let terrain = [];
let terrainCraters = [];
let terrainRocks = [];
let landingPads = [];
let stars = [];
let particles = [];
let crashPieces = [];
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
        crashPieces = [];
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

        if (this.x < -LANDER_HALF_WIDTH) this.x = LOGICAL_WIDTH + LANDER_HALF_WIDTH;
        if (this.x > LOGICAL_WIDTH + LANDER_HALF_WIDTH) this.x = -LANDER_HALF_WIDTH;

        if (this.y < CEILING) {
            this.y = CEILING;
            if (this.vy < 0) this.vy = 0;
        }
    },

    draw(target) {
        if (this.crashed) {
            // Destroços do Módulo Lunar rotacionando após impacto
            for (const piece of crashPieces) {
                target.save();
                target.translate(piece.x, piece.y);
                target.rotate(piece.angle);
                target.fillStyle = piece.color;
                if (piece.shape === 'foil') {
                    target.fillRect(-piece.size, -piece.size * 0.5, piece.size * 2, piece.size);
                } else if (piece.shape === 'strut') {
                    target.strokeStyle = piece.color;
                    target.lineWidth = 1.6;
                    target.beginPath();
                    target.moveTo(-piece.size, 0);
                    target.lineTo(piece.size, 0);
                    target.stroke();
                } else {
                    target.beginPath();
                    target.moveTo(0, -piece.size);
                    target.lineTo(piece.size, piece.size);
                    target.lineTo(-piece.size, piece.size * 0.6);
                    target.closePath();
                    target.fill();
                }
                target.restore();
            }
            return;
        }

        target.save();
        target.translate(this.x, this.y);
        target.rotate(this.angle);

        // Pluma de propulsão principal com discos de Mach
        if (this.engineOn) {
            const flicker = Math.sin(performance.now() * 0.06) * 2.5;
            const plumeLen = 19 + Math.random() * 6 + flicker;

            const outerGrad = target.createLinearGradient(0, 5, 0, 6 + plumeLen);
            outerGrad.addColorStop(0, 'rgba(255, 250, 220, 0.95)');
            outerGrad.addColorStop(0.35, 'rgba(251, 191, 36, 0.85)');
            outerGrad.addColorStop(0.75, 'rgba(234, 88, 12, 0.45)');
            outerGrad.addColorStop(1, 'rgba(234, 88, 12, 0)');
            target.fillStyle = outerGrad;
            target.beginPath();
            target.moveTo(-3.8, 5.5);
            target.quadraticCurveTo(-6.5, 5.5 + plumeLen * 0.55, 0, 6 + plumeLen);
            target.quadraticCurveTo(6.5, 5.5 + plumeLen * 0.55, 3.8, 5.5);
            target.closePath();
            target.fill();

            // Discos de Mach incandescentes na pluma supersônica
            target.fillStyle = 'rgba(224, 242, 254, 0.92)';
            for (let m = 0; m < 3; m++) {
                const my = 8.5 + m * 4.2;
                const mw = Math.max(1.0, 2.5 - m * 0.6);
                target.beginPath();
                target.ellipse(0, my, mw, 1.3, 0, 0, Math.PI * 2);
                target.fill();
            }
        }

        // Jatos de controle de reação (RCS) laterais quando rotacionando
        if (!this.onGround && (this.rotatingLeft || this.rotatingRight)) {
            target.fillStyle = 'rgba(224, 242, 254, 0.85)';
            if (this.rotatingRight) {
                // Empurra o nariz para a direita (jato superior esquerdo + inferior direito)
                target.beginPath();
                target.moveTo(-7.5, -5);
                target.lineTo(-14 - Math.random() * 3, -6.8);
                target.lineTo(-14 - Math.random() * 3, -3.2);
                target.closePath();
                target.fill();
            }
            if (this.rotatingLeft) {
                target.beginPath();
                target.moveTo(7.5, -5);
                target.lineTo(14 + Math.random() * 3, -6.8);
                target.lineTo(14 + Math.random() * 3, -3.2);
                target.closePath();
                target.fill();
            }
        }

        // Trens de pouso articulados com amortecedores e sapatas circulares
        target.strokeStyle = '#cbd5e1';
        target.lineWidth = 1.5;
        target.beginPath();
        // Perna esquerda
        target.moveTo(-6.5, 1.5);
        target.lineTo(-11.5, 11.2);
        target.moveTo(-4.5, 4.5);
        target.lineTo(-10.5, 9.5);
        // Perna direita
        target.moveTo(6.5, 1.5);
        target.lineTo(11.5, 11.2);
        target.moveTo(4.5, 4.5);
        target.lineTo(10.5, 9.5);
        target.stroke();

        // Sapatas circulares douradas (footpads)
        target.fillStyle = '#eab308';
        target.beginPath();
        target.ellipse(-11.8, 11.6, 2.8, 1.0, 0, 0, Math.PI * 2);
        target.ellipse(11.8, 11.6, 2.8, 1.0, 0, 0, Math.PI * 2);
        target.fill();

        // Bocal do motor de descida (sino ablativo escuro)
        target.fillStyle = '#334155';
        target.beginPath();
        target.moveTo(-2.5, 3.5);
        target.lineTo(-4.2, 6.4);
        target.lineTo(4.2, 6.4);
        target.lineTo(2.5, 3.5);
        target.closePath();
        target.fill();

        // Estágio de Descida revestido em folha de ouro Kapton (manta térmica)
        const kaptonGrad = target.createLinearGradient(-7.5, 0, 7.5, 4);
        kaptonGrad.addColorStop(0, '#fde047');
        kaptonGrad.addColorStop(0.45, '#eab308');
        kaptonGrad.addColorStop(0.8, '#a16207');
        kaptonGrad.addColorStop(1, '#713f12');
        target.fillStyle = kaptonGrad;
        target.fillRect(-7.5, -0.5, 15, 4.8);
        target.strokeStyle = 'rgba(113, 63, 18, 0.75)';
        target.lineWidth = 0.8;
        target.strokeRect(-7.5, -0.5, 15, 4.8);
        // Painéis verticais na manta Kapton
        target.beginPath();
        target.moveTo(-3.2, -0.5);
        target.lineTo(-3.2, 4.3);
        target.moveTo(3.2, -0.5);
        target.lineTo(3.2, 4.3);
        target.stroke();

        // Módulo de Ascensão facetado estilo Apollo
        const ascentGrad = target.createLinearGradient(-7, -9, 7, 0);
        ascentGrad.addColorStop(0, '#f8fafc');
        ascentGrad.addColorStop(0.55, '#cbd5e1');
        ascentGrad.addColorStop(1, '#475569');
        target.fillStyle = ascentGrad;
        target.beginPath();
        target.moveTo(-4.2, -9.2);
        target.lineTo(4.2, -9.2);
        target.lineTo(7.4, -4.5);
        target.lineTo(6.2, -0.5);
        target.lineTo(-6.2, -0.5);
        target.lineTo(-7.4, -4.5);
        target.closePath();
        target.fill();
        target.strokeStyle = '#1e293b';
        target.lineWidth = 0.9;
        target.stroke();

        // Janelas triangulares inclinadas com reflexo azulado
        target.fillStyle = '#0f172a';
        target.beginPath();
        target.moveTo(-4.8, -4.8);
        target.lineTo(-1.4, -6.2);
        target.lineTo(-1.8, -3.2);
        target.closePath();
        target.moveTo(4.8, -4.8);
        target.lineTo(1.4, -6.2);
        target.lineTo(1.8, -3.2);
        target.closePath();
        target.fill();

        target.fillStyle = 'rgba(56, 189, 248, 0.65)';
        target.fillRect(-3.8, -5.2, 1.5, 1.1);
        target.fillRect(2.3, -5.2, 1.5, 1.1);

        // Antena parabólica S-Band no topo
        target.strokeStyle = '#e2e8f0';
        target.lineWidth = 1;
        target.beginPath();
        target.moveTo(0, -9.2);
        target.lineTo(0, -12.2);
        target.stroke();
        target.beginPath();
        target.arc(0, -12.6, 2.1, 0.15 * Math.PI, 0.85 * Math.PI);
        target.stroke();

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
    stars = Array.from({ length: 75 }, () => ({
        x: Math.random() * LOGICAL_WIDTH,
        y: Math.random() * LOGICAL_HEIGHT * 0.78,
        size: Math.random() > 0.85 ? 2 : 1.1,
        alpha: 0.4 + Math.random() * 0.6,
        tint: Math.random() > 0.82 ? '#bae6fd' : (Math.random() > 0.9 ? '#fef08a' : '#ffffff')
    }));
}

function generateTerrain() {
    const homeY = LOGICAL_HEIGHT * 0.82;
    terrain = [
        { x: 0, y: LOGICAL_HEIGHT },
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

    while (x < LOGICAL_WIDTH - 35) {
        const roughEnd = Math.min(x + 42 + Math.random() * 68, LOGICAL_WIDTH);
        y += (Math.random() - 0.5) * (82 + level * 3);
        y = Math.max(LOGICAL_HEIGHT * 0.48, Math.min(LOGICAL_HEIGHT * 0.91, y));
        terrain.push({ x: roughEnd, y });
        x = roughEnd;

        if (x >= LOGICAL_WIDTH - 65) break;

        const baseWidth = Math.max(40, 74 - level * 2);
        const padWidth = Math.round(baseWidth - Math.random() * 22);
        const padEnd = Math.min(x + padWidth, LOGICAL_WIDTH - 8);
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

    if (x < LOGICAL_WIDTH) terrain.push({ x: LOGICAL_WIDTH, y: LOGICAL_HEIGHT * 0.82 });
    terrain.push({ x: LOGICAL_WIDTH, y: LOGICAL_HEIGHT });

    // Gerar crateras sombreadas e rochas lunares no regolito
    terrainCraters = [];
    for (let i = 0; i < 14; i++) {
        const cx = 35 + (i * 55) + (Math.random() - 0.5) * 26;
        const groundY = getGroundY(cx);
        terrainCraters.push({
            x: cx,
            y: groundY + 14 + Math.random() * Math.max(12, LOGICAL_HEIGHT - groundY - 26),
            rx: 10 + Math.random() * 18,
            ry: 4 + Math.random() * 7
        });
    }

    terrainRocks = [];
    for (let i = 0; i < 28; i++) {
        const rx = 12 + Math.random() * (LOGICAL_WIDTH - 24);
        const onPad = landingPads.some(p => rx >= p.x1 - 6 && rx <= p.x2 + 6);
        if (onPad) continue;
        const gy = getGroundY(rx);
        terrainRocks.push({
            x: rx,
            y: gy + 2 + Math.random() * 12,
            w: 3 + Math.random() * 6,
            h: 2 + Math.random() * 4
        });
    }
}

function getGroundY(screenX) {
    const wrappedX = ((screenX % LOGICAL_WIDTH) + LOGICAL_WIDTH) % LOGICAL_WIDTH;

    for (let i = 0; i < terrain.length - 1; i++) {
        const current = terrain[i];
        const next = terrain[i + 1];
        if (current.x === next.x || wrappedX < current.x || wrappedX > next.x) continue;

        const progress = (wrappedX - current.x) / (next.x - current.x);
        return current.y + progress * (next.y - current.y);
    }

    return LOGICAL_HEIGHT;
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
    engineParticleBudget += 110 * dt;
    const count = Math.floor(engineParticleBudget);
    engineParticleBudget -= count;
    if (count === 0) return;

    const exhaustX = -Math.sin(lander.angle);
    const exhaustY = Math.cos(lander.angle);
    const groundY = getGroundY(lander.x);
    const alt = groundY - (lander.y + LANDER_FOOT_OFFSET);

    for (let i = 0; i < count; i++) {
        const speed = 58 + Math.random() * 32;
        particles.push({
            x: lander.x + exhaustX * 9 + (Math.random() - 0.5) * 4,
            y: lander.y + 5 + exhaustY * 8,
            vx: exhaustX * speed + lander.vx * 0.15 + (Math.random() - 0.5) * 18,
            vy: exhaustY * speed + lander.vy * 0.15,
            life: 0.28 + Math.random() * 0.25,
            color: Math.random() > 0.3 ? '#fde047' : '#f97316',
            debris: false
        });

        // Poeira lunar (regolito) soprada horizontalmente quando próximo ao solo
        if (alt < 75 && Math.random() < 0.75) {
            const side = Math.random() < 0.5 ? -1 : 1;
            const dustSpeed = (28 + (75 - alt) * 0.9) * (0.6 + Math.random() * 0.6);
            particles.push({
                x: lander.x + side * (4 + Math.random() * 10),
                y: groundY - 1,
                vx: side * dustSpeed,
                vy: -6 - Math.random() * 14,
                life: 0.35 + Math.random() * 0.35,
                color: Math.random() > 0.4 ? '#cbd5e1' : '#94a3b8',
                debris: false
            });
        }
    }
}

function createCrashDebris() {
    for (let i = 0; i < 24; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 35 + Math.random() * 90;
        particles.push({
            x: lander.x,
            y: lander.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 25,
            life: 1.1 + Math.random() * 1.1,
            color: i % 3 === 0 ? '#eab308' : (i % 2 === 0 ? '#f97316' : '#f8fafc'),
            debris: true
        });
    }

    const shapes = ['foil', 'hull', 'strut', 'foil', 'hull', 'strut', 'foil'];
    crashPieces = shapes.map((shape, idx) => {
        const angle = -Math.PI * 0.85 + (idx / shapes.length) * Math.PI * 0.7 + (Math.random() - 0.5) * 0.4;
        const speed = 28 + Math.random() * 55;
        return {
            x: lander.x + (Math.random() - 0.5) * 8,
            y: lander.y + (Math.random() - 0.5) * 6,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 22,
            angle: Math.random() * Math.PI * 2,
            vAngle: (Math.random() - 0.5) * 9,
            size: 3.5 + Math.random() * 3.5,
            shape,
            color: shape === 'foil' ? '#eab308' : (shape === 'strut' ? '#94a3b8' : '#e2e8f0')
        };
    });
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

    for (const piece of crashPieces) {
        const gy = getGroundY(piece.x);
        if (piece.y < gy - 2) {
            piece.x += piece.vx * dt;
            piece.y += piece.vy * dt;
            piece.vy += PHYSICS.gravity * 1.3 * dt;
            piece.angle += piece.vAngle * dt;
        } else {
            piece.y = gy - 2;
            piece.vx *= 0.85;
            piece.vAngle *= 0.8;
        }
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
        target.fillStyle = star.tint || COLORS.stars;
        target.fillRect(star.x, star.y, star.size, star.size);
    });
    target.globalAlpha = 1;
}

function drawTerrain(target) {
    target.save();
    target.beginPath();
    target.moveTo(0, LOGICAL_HEIGHT);
    terrain.forEach(point => target.lineTo(point.x, point.y));
    target.lineTo(LOGICAL_WIDTH, LOGICAL_HEIGHT);
    target.closePath();

    // Regolito lunar com gradiente de profundidade realista
    const regolithGrad = target.createLinearGradient(0, LOGICAL_HEIGHT * 0.45, 0, LOGICAL_HEIGHT);
    regolithGrad.addColorStop(0, '#cbd5e1');
    regolithGrad.addColorStop(0.22, '#94a3b8');
    regolithGrad.addColorStop(0.58, '#475569');
    regolithGrad.addColorStop(1, '#1e293b');
    target.fillStyle = regolithGrad;
    target.fill();

    // Recorte para desenhar crateras sombreadas e rochas dentro do solo lunar
    target.save();
    target.clip();

    for (const c of terrainCraters) {
        target.fillStyle = 'rgba(15, 23, 42, 0.42)';
        target.beginPath();
        target.ellipse(c.x, c.y, c.rx, c.ry, 0, 0, Math.PI * 2);
        target.fill();

        target.strokeStyle = 'rgba(241, 245, 249, 0.35)';
        target.lineWidth = 1.2;
        target.beginPath();
        target.ellipse(c.x, c.y, c.rx, c.ry, 0, 0.1 * Math.PI, 0.9 * Math.PI);
        target.stroke();
    }

    for (const r of terrainRocks) {
        target.fillStyle = 'rgba(30, 41, 59, 0.55)';
        target.fillRect(r.x, r.y, r.w, r.h);
        target.fillStyle = 'rgba(248, 250, 252, 0.45)';
        target.fillRect(r.x, r.y, r.w * 0.6, 1.2);
    }
    target.restore();

    // Crista iluminada da superfície lunar
    target.strokeStyle = '#f8fafc';
    target.lineWidth = 1.8;
    target.beginPath();
    for (let i = 1; i < terrain.length - 1; i++) {
        const pt = terrain[i];
        if (i === 1) target.moveTo(pt.x, pt.y);
        else target.lineTo(pt.x, pt.y);
    }
    target.stroke();

    // Plataformas de pouso metálicas em treliça 3D com luzes sinalizadoras piscantes
    const now = performance.now();
    const blinkOn = Math.sin(now / 160) > 0;
    landingPads.forEach(pad => {
        const pw = pad.x2 - pad.x1;
        const py = pad.y;

        // Treliça metálica estrutural sob a plataforma
        target.strokeStyle = '#64748b';
        target.lineWidth = 1.2;
        target.beginPath();
        const step = 10;
        for (let tx = pad.x1; tx < pad.x2 - 2; tx += step) {
            const nx = Math.min(pad.x2, tx + step);
            target.moveTo(tx, py);
            target.lineTo(tx, py + 7);
            target.lineTo(nx, py);
            target.lineTo(nx, py + 7);
        }
        target.moveTo(pad.x1, py + 7);
        target.lineTo(pad.x2, py + 7);
        target.stroke();

        // Deck superior metálico com faixas de alerta
        target.fillStyle = pad.home ? '#38bdf8' : '#fbbf24';
        target.fillRect(pad.x1, py - 2.5, pw, 3.5);
        target.fillStyle = '#0f172a';
        for (let sx = pad.x1 + 4; sx < pad.x2 - 4; sx += 10) {
            target.fillRect(sx, py - 2, 4, 2.5);
        }

        // Placa de multiplicador / BASE legível com contraste
        const label = pad.home ? 'BASE' : `${pad.multiplier}x`;
        target.fillStyle = 'rgba(15, 23, 42, 0.82)';
        target.fillRect((pad.x1 + pad.x2) / 2 - 18, py + 9, 36, 13);
        target.strokeStyle = pad.home ? '#38bdf8' : '#fbbf24';
        target.lineWidth = 1;
        target.strokeRect((pad.x1 + pad.x2) / 2 - 18, py + 9, 36, 13);

        target.font = 'bold 11px "Courier New", monospace';
        target.textAlign = 'center';
        target.fillStyle = pad.home ? '#e0f2fe' : '#fef08a';
        target.fillText(label, (pad.x1 + pad.x2) / 2, py + 19);

        // Luzes sinalizadoras piscantes nas extremidades da plataforma
        const beaconColor = pad.visited ? '#22c55e' : (blinkOn ? '#ef4444' : '#f59e0b');
        [pad.x1 + 1, pad.x2 - 1].forEach((bx, idx) => {
            const active = (idx === 0 ? blinkOn : !blinkOn) || pad.visited;
            target.fillStyle = '#475569';
            target.fillRect(bx - 1, py - 6, 2, 4);
            target.fillStyle = active ? beaconColor : '#451a03';
            target.beginPath();
            target.arc(bx, py - 6.5, active ? 2.4 : 1.6, 0, Math.PI * 2);
            target.fill();
            if (active) {
                target.fillStyle = pad.visited ? 'rgba(34, 197, 94, 0.32)' : 'rgba(239, 68, 68, 0.35)';
                target.beginPath();
                target.arc(bx, py - 6.5, 5.5, 0, Math.PI * 2);
                target.fill();
            }
        });
    });

    target.restore();
}

function drawParticles(target) {
    particles.forEach(particle => {
        target.fillStyle = particle.color;
        const size = particle.debris ? 3 : Math.max(1, Math.ceil(particle.life * 7));
        target.fillRect(particle.x - size / 2, particle.y - size / 2, size, size);
    });
}

function draw() {
    syncHiDPI();
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    drawStars(ctx);
    drawTerrain(ctx);
    drawParticles(ctx);
    lander.draw(ctx);
}

let rafId = 0;

function frame(timestamp) {
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
}

const labLoop = window.LabRuntime
    ? LabRuntime.createLoop(frame)
    : null;

function gameLoop(timestamp) {
    frame(timestamp);
    rafId = requestAnimationFrame(gameLoop);
}

function startLoop() {
    if (labLoop) {
        labLoop.start();
        return;
    }
    if (rafId) return;
    lastTime = 0;
    rafId = requestAnimationFrame(gameLoop);
}

function stopLoop() {
    if (labLoop) {
        labLoop.stop();
        return;
    }
    if (!rafId) return;
    const id = rafId;
    rafId = 0;
    cancelAnimationFrame(id);
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

// Aba escondida: corta o motor. O rAF pausa via LabRuntime.createLoop
// (autoPause); sem LabRuntime, cai no listener manual.
if (window.LabVisibility && labLoop) {
    LabVisibility.whenHidden(() => setEngineLevel(0));
    LabVisibility.whenVisible(() => { lastTime = 0; });
} else {
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            setEngineLevel(0);
            stopLoop();
        } else {
            startLoop();
        }
    });
}

generateStars();
generateTerrain();
lander.reset();
setGameState('START');
setFlightStatus('READY');
draw();
startLoop();
