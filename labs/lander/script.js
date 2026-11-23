/**
 * Lander — classic DOS-inspired arcade flight.
 *
 * Remaster “física de verdade”: a nave é o Módulo Lunar da Apollo na fase
 * final da descida (abaixo de ~200 m, depois do “low gate”). Toda a dinâmica
 * roda em unidades SI (m, m/s, kg, N, s) num passo fixo de 1/120 s; a tela só
 * converte metros em pixels na hora de desenhar e de testar colisão.
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

/* setPointerCapture lança InvalidStateError se o ponteiro já foi solto (toque
   muito curto, evento sintético). A captura é um bônus: sem ela o gesto segue. */
function capturePointer(element, pointerId) {
    try {
        element.setPointerCapture(pointerId);
    } catch (err) {
        /* segue sem captura */
    }
}

/* Física -----------------------------------------------------------------------
   ESCALA: 1 px lógico = 0,4 m. O canvas lógico (800 × 600 px) cobre 320 m de
   largura por 240 m de altura; a nave desenhada tem ~26 px entre as sapatas =
   10,4 m (o LM real tinha ~9,4 m de envergadura das pernas).

   NAVE (Apollo LM, valores arredondados):
     massa seca  m₀ = 6.850 kg  (estágio de subida abastecido ~4.700 kg
                                 + estágio de descida vazio ~2.150 kg)
     propelente  mₚ = 700 kg no Normal (1.100 kg no Fácil), −6 %/missão
     motor DPS   F_max = 45,04 kN, acelerável de 10 % a 100 %
     impulso específico Isp = 311 s  →  vazão ṁ = F / (Isp · g₀), g₀ = 9,80665
   Com ~7.550 kg o peso lunar é 12,2 kN: pairar pede ≈ 27 % do motor e queima
   ≈ 4 kg/s. A aceleração a = F/m cresce à medida que o tanque esvazia.

   LUA: g = 1,62 m/s², sem atmosfera — nada de arrasto, a poeira voa em
   trajetória balística e a pluma do motor é quase invisível.

   INTEGRAÇÃO (passo fixo h = 1/120 s, dt do quadro limitado a 1/20 s):
     a = (F/m)·(sen θ, −cos θ) + (0, g)          (y da tela cresce para baixo)
     x ← x + v·h + ½·a·h² ;  v ← v + a·h       (exato p/ aceleração constante no passo)
     m ← m − ṁ·h
   O empuxo real segue o comando com atraso de 1ª ordem (τ = 0,12 s), como a
   válvula de um motor de verdade.

   ATITUDE (RCS em “rate command / attitude hold”, como o piloto automático do
   LM): girar pede uma taxa de ±25 °/s; soltar faz o computador zerar a taxa e
   manter o ângulo. A aceleração angular é limitada a 60 °/s² — o LM real era
   bem mais lento (~5–10 °/s²); aqui é ampliada para caber numa arena de 320 m.
   No Fácil o computador também devolve a nave à vertical.

   POUSO (referência: o trem de pouso do LM foi projetado para ≤ 3,0 m/s na
   vertical e ≤ 1,2 m/s na horizontal):
     Normal: ↓ ≤ 2,0 m/s · ↔ ≤ 1,0 m/s · inclinação ≤ 8°
     Fácil:  ↓ ≤ 3,0 m/s · ↔ ≤ 1,5 m/s · inclinação ≤ 12°
     As duas sapatas precisam estar sobre a mesma plataforma. Qualquer outro
     toque no chão é queda. POUSO PERFEITO: ↓ ≤ 1,0 m/s e ↔ ≤ 0,5 m/s.
   PONTOS = multiplicador · (100 + 100 · suavidade) + ⌊propelente restante / 2⌋,
     suavidade = 1 − v↓ / limite↓.
   LUZ DE CONTATO: as sondas sob as sapatas do LM tinham 1,7 m; quando a
   sapata mais baixa fica a ≤ 1,7 m do chão, acende “CONTATO”.
   ----------------------------------------------------------------------------- */
const M_PER_PX = 0.4;
const PX_PER_M = 1 / M_PER_PX;

const PHYSICS = Object.freeze({
    gravity: 1.62,          // m/s²
    g0: 9.80665,            // m/s² (definição do Isp)
    isp: 311,               // s
    maxThrust: 45040,       // N
    minThrottle: 0.1,
    dryMass: 6850,          // kg
    spoolTau: 0.12,         // s
    maxRate: 25 * Math.PI / 180,     // rad/s
    angularAccel: 60 * Math.PI / 180, // rad/s²
    contactProbe: 1.7,      // m
    fixedStep: 1 / 120,
    maxFrameTime: 1 / 20
});

const MODES = Object.freeze({
    easy: { fuel: 1100, autoLevel: true, vy: 3.0, vx: 1.5, angle: 12 },
    normal: { fuel: 700, autoLevel: false, vy: 2.0, vx: 1.0, angle: 8 }
});
const PERFECT = Object.freeze({ vy: 1.0, vx: 0.5 });

/* Preferências salvas (modo, acelerador, recorde). Sem storage, valem só nesta
   visita. */
const STORE_KEY = 'lander:prefs:v2';
const prefs = (() => {
    const base = { mode: 'easy', throttle: 0.6, best: 0 };
    try {
        const legacy = localStorage.getItem('lander:mode');
        if (legacy in MODES) base.mode = legacy;
        const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
        if (saved && typeof saved === 'object') {
            if (saved.mode in MODES) base.mode = saved.mode;
            if (Number.isFinite(saved.throttle)) base.throttle = clamp(saved.throttle, PHYSICS.minThrottle, 1);
            if (Number.isFinite(saved.best)) base.best = Math.max(0, saved.best);
        }
    } catch (err) {
        /* storage indisponível */
    }
    return base;
})();

function savePrefs() {
    try {
        localStorage.setItem(STORE_KEY, JSON.stringify(prefs));
    } catch (err) {
        /* Sem storage o ajuste vale só nesta visita. */
    }
}

let mode = prefs.mode;

function limits() {
    return MODES[mode];
}

function clamp(value, min, max) {
    return value < min ? min : value > max ? max : value;
}

/* Geometria da nave em px (local, nariz para cima). */
const FOOT_X = 11.8;
const FOOT_Y = 11.6;
const LANDER_HALF_WIDTH = 13;
const CEILING = 18;
const LOGICAL_WIDTH = 800;
const LOGICAL_HEIGHT = 600;
const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');

let dpr = 1;
const starfield = document.createElement('canvas');
let starfieldDirty = true;

function syncHiDPI() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(LOGICAL_WIDTH * dpr) || canvas.height !== Math.round(LOGICAL_HEIGHT * dpr)) {
        starfieldDirty = true;
        canvas.width = Math.round(LOGICAL_WIDTH * dpr);
        canvas.height = Math.round(LOGICAL_HEIGHT * dpr);
    }
}
syncHiDPI();
window.addEventListener('resize', syncHiDPI);

const COLORS = Object.freeze({
    background: '#03050a',
    stars: '#fff'
});

let gameState = 'START';
let paused = false;
let level = 1;
let score = 0;
let lastTime = 0;
let accumulator = 0;
let missionTime = 0;
let terrain = [];
let terrainCraters = [];
let terrainRocks = [];
let landingPads = [];
let stars = [];
let crashPieces = [];
let engineParticleBudget = 0;
let shake = 0;

const keys = {};

/* Gradientes criados uma vez: o canvas aplica a transformação na hora de
   pintar, então o mesmo gradiente serve em qualquer posição/rotação/zoom. */
let gradients = null;
function getGradients() {
    if (gradients) return gradients;
    const regolith = ctx.createLinearGradient(0, LOGICAL_HEIGHT * 0.45, 0, LOGICAL_HEIGHT);
    regolith.addColorStop(0, '#cbd5e1');
    regolith.addColorStop(0.22, '#94a3b8');
    regolith.addColorStop(0.58, '#475569');
    regolith.addColorStop(1, '#1e293b');

    const kapton = ctx.createLinearGradient(-7.5, 0, 7.5, 4);
    kapton.addColorStop(0, '#fde047');
    kapton.addColorStop(0.45, '#eab308');
    kapton.addColorStop(0.8, '#a16207');
    kapton.addColorStop(1, '#713f12');

    const ascent = ctx.createLinearGradient(-7, -9, 7, 0);
    ascent.addColorStop(0, '#f8fafc');
    ascent.addColorStop(0.55, '#cbd5e1');
    ascent.addColorStop(1, '#475569');

    // Pluma de comprimento unitário (0 → 1), esticada com scale().
    const plume = ctx.createLinearGradient(0, 0, 0, 1);
    plume.addColorStop(0, 'rgba(255, 244, 214, 0.9)');
    plume.addColorStop(0.3, 'rgba(253, 186, 116, 0.55)');
    plume.addColorStop(0.75, 'rgba(147, 197, 253, 0.18)');
    plume.addColorStop(1, 'rgba(147, 197, 253, 0)');

    gradients = { regolith, kapton, ascent, plume };
    return gradients;
}

/* --- Som -------------------------------------------------------------------
   O propulsor não é um "efeito": é um ruído contínuo cuja intensidade segue o
   acelerador. Por isso ele tem grafo próprio (ruído em loop + passa-baixa),
   enquanto pouso, colisão e reabastecimento passam pelo LabAudio.

   O contexto só nasce no primeiro gesto do jogador — navegadores recusam áudio
   antes disso. Qualquer falha de áudio é engolida: o jogo segue mudo. */
const labAudio = window.LabAudio;

const engine = {
    ctx: null,
    source: null,
    gain: null,
    filter: null,
    running: false,
    level: -1
};

let userGestured = false;

function ensureEngineAudio() {
    if (!userGestured || !labAudio || labAudio.isMuted()) return null;
    try {
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
    } catch (err) {
        return null;
    }
}

/* `level` é a fração de empuxo efetivo (0 desligado, 1 no talo). Só fala com o
   Web Audio quando o nível muda de fato (≥ 2 %). */
function setEngineLevel(level) {
    if (Math.abs(level - engine.level) < 0.02 && !(level === 0 && engine.level !== 0)) return;
    engine.level = level;
    const ctxAudio = engine.running ? engine.ctx : (level > 0 ? ensureEngineAudio() : null);
    if (!ctxAudio || !engine.gain) return;
    try {
        const muted = labAudio ? labAudio.isMuted() : false;
        const target = muted ? 0 : level * 0.12;
        // setTargetAtTime evita o estalo que um corte seco no ganho produziria.
        engine.gain.gain.setTargetAtTime(target, ctxAudio.currentTime, 0.04);
        engine.filter.frequency.setTargetAtTime(360 + level * 520, ctxAudio.currentTime, 0.06);
    } catch (err) {
        /* áudio é opcional */
    }
}

function sfx(name) {
    if (!labAudio || !userGestured) return;
    try {
        switch (name) {
            case 'land':
                labAudio.sequence([523, 659, 784], { step: 0.09, duration: 0.18, gain: 0.13, type: 'triangle' });
                break;
            case 'contact':
                labAudio.tone({ freq: 1320, duration: 0.07, gain: 0.06, type: 'sine' });
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
            case 'click':
                labAudio.tone({ freq: 640, duration: 0.03, gain: 0.04, type: 'square' });
                break;
        }
    } catch (err) {
        /* áudio é opcional */
    }
}

function vibrate(pattern) {
    try {
        navigator.vibrate?.(pattern);
    } catch (err) {
        /* sem vibração */
    }
}

function setGameState(nextState) {
    gameState = nextState;
    document.querySelector('.game-viewport').dataset.state = nextState.toLowerCase();
}

const lander = {
    // Posição em px lógicos (centro do casco); velocidades em m/s.
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    angle: 0,
    omega: 0,
    fuel: 0,          // kg de propelente
    fuelStart: 0,
    throttleCmd: 0,   // 0 ou [minThrottle, 1]
    throttle: 0,      // empuxo real / F_max (com atraso da válvula)
    thrusting: false,
    engineOn: false,
    rotatingLeft: false,
    rotatingRight: false,
    contact: false,
    crashed: false,
    landed: false,

    mass() {
        return PHYSICS.dryMass + this.fuel;
    },

    reset() {
        // Começo de missão: no alto, à esquerda, já derivando para a direita e
        // descendo devagar — como o LM ao passar do “low gate”.
        this.x = 52;
        this.y = 46;
        this.vx = Math.min(12, 2.8 + level * 1.2);
        this.vy = 1.5;
        this.angle = 0;
        this.omega = 0;
        this.fuelStart = Math.round(MODES[mode].fuel * Math.max(0.6, 1 - (level - 1) * 0.06));
        this.fuel = this.fuelStart;
        this.throttleCmd = 0;
        this.throttle = 0;
        this.thrusting = false;
        this.engineOn = false;
        this.rotatingLeft = false;
        this.rotatingRight = false;
        this.contact = false;
        this.crashed = false;
        this.landed = false;
        accumulator = 0;
        missionTime = 0;
        clearParticles();
        crashPieces = [];
        engineParticleBudget = 0;
        clearKeys();
        updateHUD();
    },

    update(h) {
        if (this.crashed || this.landed) return;

        /* Atitude: rate command / attitude hold. */
        const input = (this.rotatingRight ? 1 : 0) - (this.rotatingLeft ? 1 : 0);
        let rateTarget = input * PHYSICS.maxRate;
        if (!input && MODES[mode].autoLevel) {
            // Fácil: computador devolve à vertical (taxa ∝ ângulo, saturada).
            rateTarget = clamp(-this.angle * 1.6, -PHYSICS.maxRate, PHYSICS.maxRate);
        }
        const maxDelta = PHYSICS.angularAccel * h;
        this.omega += clamp(rateTarget - this.omega, -maxDelta, maxDelta);
        this.angle = normalizeAngle(this.angle + this.omega * h);

        /* Motor: comando → válvula (atraso 1ª ordem) → empuxo. */
        this.throttleCmd = this.thrusting && this.fuel > 0 ? prefs.throttle : 0;
        this.throttle += (this.throttleCmd - this.throttle) * (1 - Math.exp(-h / PHYSICS.spoolTau));
        if (this.throttle < 0.005 && this.throttleCmd === 0) this.throttle = 0;

        let thrust = PHYSICS.maxThrust * this.throttle;
        if (thrust > 0) {
            const burn = thrust / (PHYSICS.isp * PHYSICS.g0) * h; // kg neste passo
            if (burn > this.fuel) {
                thrust *= this.fuel / burn;
                this.fuel = 0;
            } else {
                this.fuel -= burn;
            }
        }
        const accel = thrust / this.mass();
        const ax = Math.sin(this.angle) * accel;
        const ay = -Math.cos(this.angle) * accel + PHYSICS.gravity;

        // Posição em px: deslocamento em metros × PX_PER_M.
        this.x += (this.vx * h + 0.5 * ax * h * h) * PX_PER_M;
        this.y += (this.vy * h + 0.5 * ay * h * h) * PX_PER_M;
        this.vx += ax * h;
        this.vy += ay * h;

        const level01 = thrust / PHYSICS.maxThrust;
        if (level01 > 0.01) {
            emitEngineParticles(h, level01);
            this.engineOn = true;
        } else {
            this.engineOn = false;
        }

        if (this.x < -LANDER_HALF_WIDTH) this.x = LOGICAL_WIDTH + LANDER_HALF_WIDTH;
        if (this.x > LOGICAL_WIDTH + LANDER_HALF_WIDTH) this.x = -LANDER_HALF_WIDTH;

        if (this.y < CEILING) {
            this.y = CEILING;
            if (this.vy < 0) this.vy = 0;
        }
        missionTime += h;
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

        const g = getGradients();
        target.save();
        target.translate(this.x, this.y);
        target.rotate(this.angle);

        // Pluma do DPS: no vácuo ela se abre e é quase transparente (propelente
        // hipergólico). O comprimento segue o empuxo real.
        if (this.engineOn) {
            const flicker = Math.sin(performance.now() * 0.06) * 1.5;
            const plumeLen = 8 + this.throttle * 26 + Math.random() * 4 + flicker;
            target.save();
            target.translate(0, 5.5);
            target.scale(1, plumeLen);
            target.fillStyle = g.plume;
            target.beginPath();
            target.moveTo(-3.8, 0);
            target.quadraticCurveTo(-7.5 - this.throttle * 3, 0.55, 0, 1);
            target.quadraticCurveTo(7.5 + this.throttle * 3, 0.55, 3.8, 0);
            target.closePath();
            target.fill();
            target.restore();
        }

        // Jatos de controle de reação (RCS): acendem quando a taxa está mudando.
        const torque = this.rotatingLeft || this.rotatingRight || Math.abs(this.omega) > 0.01;
        if (torque && !this.landed) {
            target.fillStyle = 'rgba(224, 242, 254, 0.85)';
            const firingRight = this.rotatingRight || (!this.rotatingLeft && this.omega < -0.01);
            const firingLeft = this.rotatingLeft || (!this.rotatingRight && this.omega > 0.01);
            if (firingRight) {
                target.beginPath();
                target.moveTo(-7.5, -5);
                target.lineTo(-14 - Math.random() * 3, -6.8);
                target.lineTo(-14 - Math.random() * 3, -3.2);
                target.closePath();
                target.fill();
            }
            if (firingLeft) {
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
        target.moveTo(-6.5, 1.5);
        target.lineTo(-11.5, 11.2);
        target.moveTo(-4.5, 4.5);
        target.lineTo(-10.5, 9.5);
        target.moveTo(6.5, 1.5);
        target.lineTo(11.5, 11.2);
        target.moveTo(4.5, 4.5);
        target.lineTo(10.5, 9.5);
        // Sondas de contato (1,7 m = 4,25 px) sob as sapatas
        target.moveTo(-11.8, 12.4);
        target.lineTo(-11.8, 12.4 + PHYSICS.contactProbe * PX_PER_M);
        target.moveTo(11.8, 12.4);
        target.lineTo(11.8, 12.4 + PHYSICS.contactProbe * PX_PER_M);
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
        target.fillStyle = g.kapton;
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
        target.fillStyle = g.ascent;
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

        // Luz de contato azul na cabine
        if (this.contact) {
            target.fillStyle = '#38bdf8';
            target.beginPath();
            target.arc(0, -7.4, 1.4, 0, Math.PI * 2);
            target.fill();
        }

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

function setThrottle(next) {
    const value = Math.round(clamp(next, PHYSICS.minThrottle, 1) * 100) / 100;
    if (value === prefs.throttle) return;
    prefs.throttle = value;
    savePrefs();
    sfx('click');
    updateHUD();
}

function generateStars() {
    starfieldDirty = true;
    stars = Array.from({ length: 90 }, () => ({
        x: Math.random() * LOGICAL_WIDTH,
        y: Math.random() * LOGICAL_HEIGHT * 0.86,
        size: Math.random() > 0.85 ? 2 : 1.1,
        alpha: 0.4 + Math.random() * 0.6,
        tint: Math.random() > 0.82 ? '#bae6fd' : (Math.random() > 0.9 ? '#fef08a' : '#ffffff')
    }));
}

function generateTerrain() {
    const startY = LOGICAL_HEIGHT * 0.82;
    terrain = [
        { x: 0, y: LOGICAL_HEIGHT },
        { x: 0, y: startY },
        { x: 20, y: startY },
        { x: 110, y: startY }
    ];
    // A primeira plataforma (1x) fica sob o ponto de partida: é a opção segura.
    landingPads = [{
        x1: 20,
        x2: 110,
        y: startY,
        multiplier: 1,
        visited: false
    }];

    let x = 110;
    let y = startY;

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
            multiplier,
            visited: false
        });
        terrain.push({ x: padEnd, y });
        x = padEnd;
    }

    if (x < LOGICAL_WIDTH) terrain.push({ x: LOGICAL_WIDTH, y: startY });
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

/* Sapatas no mundo (rotação do canvas: x' = x cos θ − y sen θ ; y' = x sen θ + y cos θ).
   Escreve num objeto reaproveitado para não alocar por passo. */
const feet = { lx: 0, ly: 0, rx: 0, ry: 0 };
function computeFeet() {
    const c = Math.cos(lander.angle);
    const s = Math.sin(lander.angle);
    feet.lx = lander.x - FOOT_X * c - FOOT_Y * s;
    feet.ly = lander.y - FOOT_X * s + FOOT_Y * c;
    feet.rx = lander.x + FOOT_X * c - FOOT_Y * s;
    feet.ry = lander.y + FOOT_X * s + FOOT_Y * c;
    return feet;
}

/* Altitude de radar em metros: da sapata mais baixa até o chão sob ela. */
function getCurrentAltitude() {
    const f = computeFeet();
    const left = getGroundY(f.lx) - f.ly;
    const right = getGroundY(f.rx) - f.ry;
    return Math.max(0, Math.min(left, right) * M_PER_PX);
}

function findPadAt(screenX) {
    return landingPads.find(pad => (
        screenX - LANDER_HALF_WIDTH >= pad.x1
        && screenX + LANDER_HALF_WIDTH <= pad.x2
    ));
}

function padUnder(xa, xb) {
    for (const pad of landingPads) {
        if (xa >= pad.x1 && xa <= pad.x2 && xb >= pad.x1 && xb <= pad.x2) return pad;
    }
    return null;
}

function checkCollision() {
    if (lander.crashed || lander.landed) return;

    const f = computeFeet();
    const groundL = getGroundY(f.lx);
    const groundR = getGroundY(f.rx);
    // Bocal e cantos do casco também batem (rampa íngreme, nave deitada).
    const c = Math.cos(lander.angle);
    const s = Math.sin(lander.angle);
    const nozzleX = lander.x - 6.4 * s;
    const nozzleY = lander.y + 6.4 * c;
    const hullHit = nozzleY >= getGroundY(nozzleX)
        || lander.y - 7.4 * s + 4.3 * c >= getGroundY(lander.x - 7.4 * c - 4.3 * s)
        || lander.y + 7.4 * s + 4.3 * c >= getGroundY(lander.x + 7.4 * c - 4.3 * s);

    const minClear = Math.min(groundL - f.ly, groundR - f.ry) * M_PER_PX;
    const contactNow = minClear <= PHYSICS.contactProbe;
    if (contactNow && !lander.contact) sfx('contact');
    lander.contact = contactNow;

    const footHit = f.ly >= groundL || f.ry >= groundR;
    if (!footHit && !hullHit) return;

    const pad = padUnder(f.lx, f.rx);
    const lim = limits();
    const tilt = Math.abs(normalizeAngle(lander.angle)) * 180 / Math.PI;
    const safeHorizontal = Math.abs(lander.vx) <= lim.vx;
    const safeVertical = lander.vy <= lim.vy;
    const safeAngle = tilt <= lim.angle;

    if (pad && !hullHit && safeHorizontal && safeVertical && safeAngle) {
        land(pad);
    } else {
        // O motivo vira a dica da tela de queda: o jogador aprende o que errou.
        let reason = `Inclinação de ${tilt.toFixed(0)}° (máx. ${lim.angle}°): pouse reto.`;
        if (!pad) reason = 'Fora da plataforma: as duas sapatas precisam estar nas faixas amarelas.';
        else if (!safeVertical) reason = `Desceu a ${fmt(lander.vy)} m/s (máx. ${fmt(lim.vy)}): acelere o motor antes de chegar.`;
        else if (!safeHorizontal) reason = `Deriva lateral de ${fmt(Math.abs(lander.vx))} m/s (máx. ${fmt(lim.vx)}): incline contra o movimento.`;
        crash(reason);
    }
}

function fmt(value, digits = 1) {
    return value.toFixed(digits).replace('.', ',');
}

function land(pad) {
    const vy = Math.max(0, lander.vy);
    const vx = Math.abs(lander.vx);
    const tilt = Math.abs(lander.angle) * 180 / Math.PI;
    lander.x = Math.max(pad.x1 + LANDER_HALF_WIDTH, Math.min(pad.x2 - LANDER_HALF_WIDTH, lander.x));
    lander.y = pad.y - FOOT_Y;
    lander.vx = 0;
    lander.vy = 0;
    lander.angle = 0;
    lander.omega = 0;
    lander.thrusting = false;
    lander.throttle = 0;
    lander.engineOn = false;
    setEngineLevel(0);

    const lim = limits();
    const softness = Math.max(0, 1 - vy / lim.vy);
    const perfect = vy <= PERFECT.vy && vx <= PERFECT.vx;
    const fuelBonus = Math.floor(lander.fuel / 2);
    const landingPoints = Math.round(pad.multiplier * (100 + 100 * softness)) + fuelBonus;
    score += landingPoints;
    if (score > prefs.best) {
        prefs.best = score;
        savePrefs();
    }
    pad.visited = true;
    lander.landed = true;
    setGameState('LANDED');
    kickDust(vy);
    vibrate(perfect ? [20, 40, 20] : 30);

    setStatusMessage(
        perfect ? 'POUSO PERFEITO!' : 'A ÁGUIA POUSOU',
        `+${landingPoints} pts · ↓ ${fmt(vy)} m/s · ↔ ${fmt(vx)} m/s · ${tilt.toFixed(0)}° · sobra ${Math.round(lander.fuel)} kg`,
        'success'
    );
    setFlightStatus('POUSOU', 'safe');
    sfx('land');
}

function crash(reason = '') {
    setGameState('CRASHED');
    lander.crashed = true;
    lander.thrusting = false;
    lander.engineOn = false;
    lander.throttle = 0;
    lander.contact = false;
    setEngineLevel(0);
    sfx('crash');
    vibrate([60, 40, 120]);
    if (!reducedMotion?.matches) shake = 1;
    createCrashDebris();
    setStatusMessage('A NAVE QUEBROU', reason, 'danger');
    setFlightStatus('NAVE PERDIDA', 'danger');
}

/* Título grande + uma linha de explicação. Montado com textContent: nada de
   HTML vindo de string. */
function setStatusMessage(title, detail, tone) {
    const message = document.getElementById('gameOverMsg');
    const result = document.getElementById('missionResult');
    const heading = document.createElement('strong');
    heading.textContent = title;
    const small = document.createElement('small');
    small.textContent = detail;
    result.replaceChildren(heading, small);
    const button = document.getElementById('btnContinue');
    button.textContent = gameState === 'LANDED' ? '▶ PRÓXIMA MISSÃO' : '↻ TENTAR DE NOVO';
    message.dataset.tone = tone;
    message.classList.remove('hidden');
    button.focus({ preventScroll: true });
    syncPauseButton();
}

function setFlightStatus(text, tone = '') {
    const status = document.getElementById('hudStatus');
    if (status.textContent !== text) status.textContent = text;
    if (status.dataset.tone !== tone) status.dataset.tone = tone;
}

function startMission({ nextLevel = false, newGame = false } = {}) {
    userGestured = true;
    if (newGame) {
        level = 1;
        score = 0;
    } else if (nextLevel) {
        level++;
    }

    if (newGame || nextLevel) generateTerrain();

    setGameState('PLAYING');
    paused = false;
    document.getElementById('pauseMsg').classList.add('hidden');
    document.getElementById('startMsg').classList.add('hidden');
    document.getElementById('gameOverMsg').classList.add('hidden');
    lander.reset();
    setEngineLevel(0);
    lowFuelWarned = false;
    shake = 0;
    camera.z = 1;
    lastTime = 0;
    setFlightStatus('DESCIDA');
    syncSafeReadout();
    syncPauseButton();
    startLoop();
    sfx('launch');
}

/* Pausa de verdade: corta o motor, para o loop e mostra o aviso. */
function setPaused(next) {
    if (next && gameState !== 'PLAYING') return;
    if (paused === next) return;
    paused = next;
    document.getElementById('pauseMsg').classList.toggle('hidden', !paused);
    clearKeys();
    if (paused) {
        setEngineLevel(0);
        lander.thrusting = false;
        stopLoop();
        draw();
        document.getElementById('btnResume').focus({ preventScroll: true });
    } else {
        lastTime = 0;
        accumulator = 0;
        startLoop();
    }
    syncPauseButton();
}

function syncPauseButton() {
    const btn = document.getElementById('btnPause');
    btn.disabled = gameState !== 'PLAYING';
    btn.innerHTML = paused ? '<u>C</u>ontinuar' : '<u>P</u>ausa';
}

function syncSafeReadout() {
    const lim = limits();
    const text = `POUSO SEGURO: ↓ ≤ ${fmt(lim.vy)} · ↔ ≤ ${fmt(lim.vx)} m/s · ±${lim.angle}°`;
    document.getElementById('safeReadout').textContent = text;
}

function syncModeButtons() {
    document.querySelectorAll('[data-mode]').forEach(btn => {
        btn.setAttribute('aria-pressed', String(btn.dataset.mode === mode));
    });
}

function syncBest() {
    const el = document.getElementById('bestScore');
    if (el) el.textContent = prefs.best ? `Recorde: ${prefs.best} pts` : '';
}

/* Bipe único ao cruzar 15% de propelente: repetir a cada frame viraria alarme
   de incêndio, e avisar tarde demais não deixa tempo de reagir. */
const LOW_FUEL_RATIO = 0.15;
let lowFuelWarned = false;

function checkLowFuel() {
    if (gameState !== 'PLAYING') return;
    const low = lander.fuel <= lander.fuelStart * LOW_FUEL_RATIO;
    if (low && !lowFuelWarned) {
        lowFuelWarned = true;
        sfx('lowfuel');
        vibrate(40);
    } else if (!low) {
        lowFuelWarned = false;
    }
}

/* --- Partículas: pool fixo (nenhuma alocação durante o voo) ----------------
   Tipos: 0 exaustão, 1 poeira de regolito, 2 destroço. No vácuo a poeira não
   faz nuvem: sai em lâminas rasas e cai em parábola sob 1,62 m/s². */
const POOL_SIZE = 480;
const pool = Array.from({ length: POOL_SIZE }, () => ({
    alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, kind: 0, color: '#fff'
}));
let poolCursor = 0;
const G_PX = PHYSICS.gravity * PX_PER_M; // px/s²

function spawn(kind, x, y, vx, vy, life, color) {
    const p = pool[poolCursor];
    poolCursor = (poolCursor + 1) % POOL_SIZE;
    p.alive = true;
    p.kind = kind;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.life = life;
    p.max = life;
    p.color = color;
}

function clearParticles() {
    for (const p of pool) p.alive = false;
}

function emitEngineParticles(h, level01) {
    engineParticleBudget += (30 + 110 * level01) * h;
    const count = Math.floor(engineParticleBudget);
    engineParticleBudget -= count;
    if (count === 0) return;

    const exhaustX = -Math.sin(lander.angle);
    const exhaustY = Math.cos(lander.angle);
    const groundY = getGroundY(lander.x);
    const altM = (groundY - (lander.y + FOOT_Y)) * M_PER_PX;

    for (let i = 0; i < count; i++) {
        const speed = 70 + Math.random() * 40;
        spawn(0,
            lander.x + exhaustX * 9 + (Math.random() - 0.5) * 4,
            lander.y + 5 + exhaustY * 8,
            exhaustX * speed + lander.vx * PX_PER_M + (Math.random() - 0.5) * 22,
            exhaustY * speed + lander.vy * PX_PER_M,
            0.12 + Math.random() * 0.18,
            Math.random() > 0.35 ? '#fde68a' : '#fdba74');

        // Regolito soprado quando a pluma toca o chão (abaixo de ~30 m).
        if (altM < 30 && Math.random() < 0.9 * level01 + 0.1) {
            const side = Math.random() < 0.5 ? -1 : 1;
            const strength = (30 - altM) / 30;
            const dustSpeed = (60 + strength * 140) * (0.6 + Math.random() * 0.6);
            spawn(1,
                lander.x + side * (4 + Math.random() * 10),
                groundY - 1,
                side * dustSpeed,
                -4 - Math.random() * 10 * strength,
                0.5 + Math.random() * 0.6,
                Math.random() > 0.4 ? '#cbd5e1' : '#94a3b8');
        }
    }
}

function kickDust(vy) {
    const n = 18 + Math.round(vy * 8);
    for (let i = 0; i < n; i++) {
        const side = i % 2 ? 1 : -1;
        spawn(1, lander.x + side * (FOOT_X + Math.random() * 3), lander.y + FOOT_Y,
            side * (20 + Math.random() * 50), -6 - Math.random() * 14,
            0.5 + Math.random() * 0.5, '#cbd5e1');
    }
}

function createCrashDebris() {
    for (let i = 0; i < 30; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 35 + Math.random() * 90;
        spawn(2, lander.x, lander.y,
            Math.cos(angle) * speed,
            Math.sin(angle) * speed - 25,
            1.4 + Math.random() * 1.2,
            i % 3 === 0 ? '#eab308' : (i % 2 === 0 ? '#f97316' : '#f8fafc'));
    }

    const shapes = ['foil', 'hull', 'strut', 'foil', 'hull', 'strut', 'foil'];
    crashPieces = shapes.map((shape, idx) => {
        const angle = -Math.PI * 0.85 + (idx / shapes.length) * Math.PI * 0.7 + (Math.random() - 0.5) * 0.4;
        const speed = 28 + Math.random() * 55;
        return {
            x: lander.x + (Math.random() - 0.5) * 8,
            y: lander.y + (Math.random() - 0.5) * 6,
            vx: Math.cos(angle) * speed + lander.vx * PX_PER_M * 0.5,
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
    for (let i = 0; i < POOL_SIZE; i++) {
        const p = pool[i];
        if (!p.alive) continue;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.kind !== 0) {
            p.vy += G_PX * dt;
            const gy = getGroundY(p.x);
            if (p.y > gy) {
                // Chão: poeira para, destroço quica de leve.
                p.y = gy;
                if (p.kind === 2) {
                    p.vy *= -0.25;
                    p.vx *= 0.6;
                } else {
                    p.vx = 0;
                    p.vy = 0;
                }
            }
        }
        p.life -= dt;
        if (p.life <= 0) p.alive = false;
    }

    for (const piece of crashPieces) {
        const gy = getGroundY(piece.x);
        if (piece.y < gy - 2) {
            piece.x += piece.vx * dt;
            piece.y += piece.vy * dt;
            piece.vy += G_PX * dt;
            piece.angle += piece.vAngle * dt;
        } else {
            piece.y = gy - 2;
            piece.vx *= 0.85;
            piece.vAngle *= 0.8;
        }
    }

    if (shake > 0) shake = Math.max(0, shake - dt * 2.2);
}

/* --- HUD --------------------------------------------------------------------
   Elementos resolvidos uma vez; o loop só escreve quando o texto muda. Cada
   leitura que decide o pouso fica verde/amarela/vermelha pela faixa segura. */
function setReadoutState(element, value, safeLimit) {
    const ratio = Math.abs(value) / safeLimit;
    const danger = ratio > 1;
    const caution = !danger && ratio > 0.72;
    if (element.classList.contains('danger') !== danger) element.classList.toggle('danger', danger);
    if (element.classList.contains('caution') !== caution) element.classList.toggle('caution', caution);
}

const hudEls = {};
function hudEl(id) {
    return hudEls[id] || (hudEls[id] = document.getElementById(id));
}

function setReadout(id, value) {
    const el = hudEl(id);
    if (el && el.textContent !== value) el.textContent = value;
}

let lastFuelRatio = -1;

function updateHUD() {
    const altitude = getCurrentAltitude();
    const angleDegrees = normalizeAngle(lander.angle) * 180 / Math.PI;
    const lim = limits();
    const mass = lander.mass();
    const twr = (PHYSICS.maxThrust * prefs.throttle) / (mass * PHYSICS.gravity);

    setReadout('hudMission', String(level).padStart(2, '0'));
    setReadout('hudScore', String(score).padStart(6, '0'));
    setReadout('hudAlt', altitude >= 100 ? altitude.toFixed(0) : fmt(altitude));
    setReadout('hudVSpeed', `${lander.vy >= 0 ? '↓' : '↑'}${fmt(Math.abs(lander.vy))}`);
    setReadout('hudHSpeed', `${lander.vx >= 0 ? '→' : '←'}${fmt(Math.abs(lander.vx))}`);
    setReadout('hudAngle', `${angleDegrees >= 0 ? '+' : ''}${angleDegrees.toFixed(0)}°`);
    setReadout('hudFuel', Math.max(0, lander.fuel).toFixed(0));
    setReadout('hudThrottle', `${Math.round(prefs.throttle * 100)}%`);
    setReadout('hudTwr', fmt(twr, 2));
    const t = Math.floor(missionTime);
    setReadout('hudTime', `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`);

    // Cores de pouso só na aproximação (< 60 m): lá no alto descer a 5 m/s é
    // normal e pintar de vermelho só assusta.
    const near = altitude < 60 || gameState !== 'PLAYING';
    setReadoutState(hudEl('hudHSpeed'), near ? lander.vx : 0, lim.vx);
    setReadoutState(hudEl('hudVSpeed'), near ? Math.max(0, lander.vy) : 0, lim.vy);
    setReadoutState(hudEl('hudAngle'), near ? angleDegrees : 0, lim.angle);
    // TWR < 1: o motor nessa posição não segura a nave.
    hudEl('hudTwr').classList.toggle('danger', twr < 1);

    const fuelRatio = lander.fuelStart ? Math.max(0, lander.fuel) / lander.fuelStart : 1;
    const fuel = hudEl('hudFuel');
    const fuelDanger = fuelRatio <= 0.1;
    const fuelCaution = !fuelDanger && fuelRatio <= 0.25;
    if (fuel.classList.contains('danger') !== fuelDanger) fuel.classList.toggle('danger', fuelDanger);
    if (fuel.classList.contains('caution') !== fuelCaution) fuel.classList.toggle('caution', fuelCaution);
    // Barra de combustível por transform (sem reflow) e só quando muda ~0,5%.
    if (Math.abs(fuelRatio - lastFuelRatio) > 0.005) {
        lastFuelRatio = fuelRatio;
        const bar = hudEl('hudFuelBar');
        bar.style.transform = `scaleX(${fuelRatio.toFixed(3)})`;
        bar.dataset.tone = fuelDanger ? 'danger' : fuelCaution ? 'caution' : '';
    }
    const thrBar = hudEl('hudThrottleBar');
    const thrScale = lander.throttle.toFixed(2);
    if (thrBar && thrBar.dataset.v !== thrScale) {
        thrBar.dataset.v = thrScale;
        thrBar.style.transform = `scaleX(${thrScale})`;
    }

    if (gameState === 'PLAYING') {
        if (lander.fuel <= 0) setFlightStatus('SEM PROPELENTE', 'danger');
        else if (lowFuelWarned) setFlightStatus('PROPELENTE BAIXO', 'danger');
        else if (lander.contact) setFlightStatus('CONTATO', 'safe');
        else if (altitude < 40) setFlightStatus('APROXIMAÇÃO', 'caution');
        else setFlightStatus('DESCIDA');
    }
}

/* --- Câmera ------------------------------------------------------------------
   Como no Lunar Lander clássico, a vista aproxima perto do chão: zoom 1× acima
   de ~70 m, chegando a 2,2× abaixo de ~25 m. As estrelas ficam fixas (estão no
   infinito); o terreno e a nave escalam. */
const camera = { z: 1, x0: 0, y0: 0 };

function updateCamera(dt) {
    let target = 1;
    if (gameState === 'PLAYING' || gameState === 'LANDED') {
        const alt = getCurrentAltitude();
        target = clamp(1 + (70 - alt) / 37, 1, 2.2);
    } else if (gameState === 'CRASHED') {
        target = camera.z;
    }
    const k = 1 - Math.exp(-dt * (reducedMotion?.matches ? 1.5 : 3));
    camera.z += (target - camera.z) * k;
    if (Math.abs(camera.z - 1) < 0.002) camera.z = 1;

    const w = LOGICAL_WIDTH / camera.z;
    const h = LOGICAL_HEIGHT / camera.z;
    const ground = getGroundY(lander.x);
    const cx = lander.x;
    const cy = (lander.y + ground) / 2;
    camera.x0 = clamp(cx - w / 2, 0, LOGICAL_WIDTH - w);
    camera.y0 = clamp(cy - h / 2, 0, LOGICAL_HEIGHT - h);
}

function drawStars(target) {
    stars.forEach(star => {
        target.globalAlpha = star.alpha;
        target.fillStyle = star.tint || COLORS.stars;
        target.fillRect(star.x, star.y, star.size, star.size);
    });
    target.globalAlpha = 1;
    // A Terra no céu negro — referência de que o “chão” é a Lua.
    target.fillStyle = '#1e3a8a';
    target.beginPath();
    target.arc(330, 70, 15, 0, Math.PI * 2);
    target.fill();
    target.fillStyle = '#7dd3fc';
    target.beginPath();
    target.arc(330, 70, 15, -Math.PI / 2, Math.PI / 2);
    target.ellipse(330, 70, 6, 15, 0, Math.PI / 2, -Math.PI / 2, false);
    target.fill();
}

function drawTerrain(target) {
    const g = getGradients();
    target.save();
    target.beginPath();
    target.moveTo(0, LOGICAL_HEIGHT);
    for (let i = 0; i < terrain.length; i++) target.lineTo(terrain[i].x, terrain[i].y);
    target.lineTo(LOGICAL_WIDTH, LOGICAL_HEIGHT);
    target.closePath();

    // Regolito lunar com gradiente de profundidade realista
    target.fillStyle = g.regolith;
    target.fill();

    // Recorte para desenhar crateras sombreadas e rochas dentro do solo lunar
    target.save();
    target.clip();

    target.fillStyle = 'rgba(15, 23, 42, 0.42)';
    for (const c of terrainCraters) {
        target.beginPath();
        target.ellipse(c.x, c.y, c.rx, c.ry, 0, 0, Math.PI * 2);
        target.fill();
    }
    target.strokeStyle = 'rgba(241, 245, 249, 0.35)';
    target.lineWidth = 1.2;
    for (const c of terrainCraters) {
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

    // Plataformas de pouso metálicas em treliça com placa de multiplicador
    target.font = 'bold 11px "Courier New", monospace';
    target.textAlign = 'center';
    for (const pad of landingPads) {
        const pw = pad.x2 - pad.x1;
        const py = pad.y;

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

        target.fillStyle = '#fbbf24';
        target.fillRect(pad.x1, py - 2.5, pw, 3.5);
        target.fillStyle = '#0f172a';
        for (let sx = pad.x1 + 4; sx < pad.x2 - 4; sx += 10) {
            target.fillRect(sx, py - 2, 4, 2.5);
        }

        const label = `${pad.multiplier}x`;
        const mid = (pad.x1 + pad.x2) / 2;
        target.fillStyle = 'rgba(15, 23, 42, 0.82)';
        target.fillRect(mid - 18, py + 9, 36, 13);
        target.strokeStyle = '#fbbf24';
        target.lineWidth = 1;
        target.strokeRect(mid - 18, py + 9, 36, 13);
        target.fillStyle = '#fef08a';
        target.fillText(label, mid, py + 19);
    }
    target.restore();
}

function drawBeacons(target, now) {
    const blinkOn = Math.sin(now / 160) > 0;
    for (const pad of landingPads) {
        const py = pad.y;
        const beaconColor = pad.visited ? '#22c55e' : (blinkOn ? '#ef4444' : '#f59e0b');
        for (let idx = 0; idx < 2; idx++) {
            const bx = idx === 0 ? pad.x1 + 1 : pad.x2 - 1;
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
        }
    }
}

/* Guia de pouso: perto do chão, um colchete sob a nave fica verde quando a
   velocidade e o ângulo estão dentro do limite e vermelho quando não estão.
   É a leitura do HUD traduzida para quem ainda não lê números. Acima dela, o
   vetor velocidade (4 px por m/s) mostra para onde a nave está indo. */
function drawLandingGuide(target) {
    if (gameState !== 'PLAYING' || lander.crashed) return;
    const lim = limits();

    // Vetor velocidade
    const speed = Math.hypot(lander.vx, lander.vy);
    if (speed > 0.15) {
        const len = Math.min(60, speed * 4) / camera.z;
        const ux = lander.vx / speed;
        const uy = lander.vy / speed;
        const ok = Math.abs(lander.vx) <= lim.vx && lander.vy <= lim.vy;
        target.strokeStyle = ok ? 'rgba(34, 197, 94, 0.85)' : 'rgba(250, 204, 21, 0.85)';
        target.lineWidth = 1.4 / camera.z;
        target.beginPath();
        target.moveTo(lander.x, lander.y);
        const ex = lander.x + ux * len;
        const ey = lander.y + uy * len;
        target.lineTo(ex, ey);
        target.moveTo(ex, ey);
        target.lineTo(ex - (ux * 5 - uy * 3) / camera.z, ey - (uy * 5 + ux * 3) / camera.z);
        target.moveTo(ex, ey);
        target.lineTo(ex - (ux * 5 + uy * 3) / camera.z, ey - (uy * 5 - ux * 3) / camera.z);
        target.stroke();
    }

    const altitude = getCurrentAltitude();
    if (altitude > 56) return;
    const ok = Math.abs(lander.vx) <= lim.vx && lander.vy <= lim.vy
        && Math.abs(normalizeAngle(lander.angle)) * 180 / Math.PI <= lim.angle;
    const pad = findPadAt(lander.x);
    const groundY = getGroundY(lander.x);
    const alpha = 0.35 + 0.65 * (1 - altitude / 56);
    target.save();
    target.globalAlpha = alpha;
    target.strokeStyle = ok ? (pad ? '#22c55e' : '#facc15') : '#ef4444';
    target.lineWidth = 2 / camera.z;
    target.setLineDash([4 / camera.z, 4 / camera.z]);
    target.beginPath();
    target.moveTo(lander.x, lander.y + FOOT_Y + 4);
    target.lineTo(lander.x, groundY - 2);
    target.stroke();
    target.setLineDash([]);
    target.beginPath();
    target.moveTo(lander.x - 16, groundY - 6);
    target.lineTo(lander.x - 16, groundY - 1);
    target.lineTo(lander.x + 16, groundY - 1);
    target.lineTo(lander.x + 16, groundY - 6);
    target.stroke();
    target.restore();
}

function drawParticles(target) {
    for (let i = 0; i < POOL_SIZE; i++) {
        const p = pool[i];
        if (!p.alive) continue;
        target.fillStyle = p.color;
        const t = p.life / p.max;
        const size = p.kind === 2 ? 2.6 : p.kind === 1 ? 1.4 + t : Math.max(1, t * 4.5);
        target.globalAlpha = p.kind === 1 ? Math.min(1, t * 1.6) : 1;
        target.fillRect(p.x - size / 2, p.y - size / 2, size, size);
    }
    target.globalAlpha = 1;
}

function draw() {
    syncHiDPI();
    if (starfieldDirty) {
        starfield.width = canvas.width;
        starfield.height = canvas.height;
        const background = starfield.getContext('2d');
        background.setTransform(dpr, 0, 0, dpr, 0, 0);
        background.fillStyle = COLORS.background;
        background.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
        drawStars(background);
        starfieldDirty = false;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(starfield, 0, 0);

    const z = camera.z * dpr;
    let sx = 0;
    let sy = 0;
    if (shake > 0) {
        sx = (Math.random() - 0.5) * 8 * shake;
        sy = (Math.random() - 0.5) * 8 * shake;
    }
    ctx.setTransform(z, 0, 0, z, (-camera.x0 * camera.z + sx) * dpr, (-camera.y0 * camera.z + sy) * dpr);
    const now = performance.now();
    drawTerrain(ctx);
    drawBeacons(ctx, now);
    drawLandingGuide(ctx);
    drawParticles(ctx);
    lander.draw(ctx);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
}

let rafId = 0;

function frame(timestamp) {
    if (paused) return;
    try {
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
            setEngineLevel(lander.engineOn ? lander.throttle : 0);
        } else {
            updateParticles(frameTime);
        }

        checkLowFuel();
        updateCamera(frameTime);
        updateHUD();
        draw();
    } catch (err) {
        // Um erro num quadro não pode congelar o jogo: registra e segue.
        console.error(err);
    }
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
    userGestured = true;
    if (event.code === 'Space' && event.target.closest?.('button:focus-visible')) return;
    const gameCodes = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyW', 'KeyA', 'KeyD'];
    if (gameCodes.includes(event.code)) event.preventDefault();

    if ((event.code === 'KeyP' || event.code === 'Escape') && !event.repeat) {
        setPaused(!paused);
        return;
    }
    if (paused) {
        if ((event.code === 'Space' || event.code === 'Enter') && !event.repeat
            && !event.target.closest?.('button')) setPaused(false);
        return;
    }

    // Acelerador: X / + sobe, Z / − desce (passos de 10 %).
    if (['KeyX', 'Equal', 'NumpadAdd'].includes(event.code)) {
        setThrottle(prefs.throttle + 0.1);
        return;
    }
    if (['KeyZ', 'Minus', 'NumpadSubtract'].includes(event.code)) {
        setThrottle(prefs.throttle - 0.1);
        return;
    }

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

// Perder o foco solta tudo e pausa o voo: ninguém volta e encontra a nave no chão.
window.addEventListener('blur', () => {
    clearKeys();
    if (gameState === 'PLAYING') setPaused(true);
});

function bindButton(id, code) {
    const element = document.getElementById(id);

    const setPressed = pressed => {
        keys[code] = pressed;
        element.classList.toggle('active', pressed);
    };

    element.addEventListener('pointerdown', event => {
        event.preventDefault();
        userGestured = true;
        capturePointer(element, event.pointerId);
        if (paused) {
            setPaused(false);
        } else if (gameState !== 'PLAYING') {
            startMission({ nextLevel: gameState === 'LANDED' });
        }
        setPressed(true);
    });
    element.addEventListener('pointerup', () => setPressed(false));
    element.addEventListener('pointercancel', () => setPressed(false));
    element.addEventListener('lostpointercapture', () => setPressed(false));
    element.addEventListener('contextmenu', event => event.preventDefault());
}

document.getElementById('btnNewGame').addEventListener('click', () => {
    startMission({ newGame: true });
});

document.getElementById('btnStart').addEventListener('click', () => {
    startMission({ newGame: true });
});

document.getElementById('btnContinue').addEventListener('click', () => {
    startMission({ nextLevel: gameState === 'LANDED' });
});

document.getElementById('btnMenu')?.addEventListener('click', () => {
    setGameState('START');
    document.getElementById('gameOverMsg').classList.add('hidden');
    document.getElementById('startMsg').classList.remove('hidden');
    syncBest();
    syncPauseButton();
    document.getElementById('btnStart').focus({ preventScroll: true });
});

document.getElementById('btnPause').addEventListener('click', () => setPaused(!paused));
document.getElementById('btnResume').addEventListener('click', () => setPaused(false));
document.getElementById('btnRestart')?.addEventListener('click', () => {
    paused = false;
    document.getElementById('pauseMsg').classList.add('hidden');
    startMission({ newGame: false });
});

document.getElementById('btnThrottleUp')?.addEventListener('click', () => setThrottle(prefs.throttle + 0.1));
document.getElementById('btnThrottleDown')?.addEventListener('click', () => setThrottle(prefs.throttle - 0.1));

document.querySelectorAll('[data-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
        mode = btn.dataset.mode;
        prefs.mode = mode;
        savePrefs();
        syncModeButtons();
        syncSafeReadout();
        lander.fuelStart = MODES[mode].fuel;
        lander.fuel = lander.fuelStart;
        lastFuelRatio = -1;
        updateHUD();
    });
});

bindButton('btnLeft', 'ArrowLeft');
bindButton('btnRight', 'ArrowRight');
bindButton('btnThrust', 'ArrowUp');

if (labAudio) {
    labAudio.configure({ storageKey: 'lander:muted', volume: 0.5 });
    const host = document.querySelector('[data-lab-header] .header-actions');
    if (host) labAudio.mountToggle(host);
    // Mudo pelo botão precisa calar o propulsor contínuo na hora.
    labAudio.onChange(() => {
        engine.level = -1;
        setEngineLevel(lander.engineOn ? lander.throttle : 0);
    });
}

// Aba escondida: corta o motor e pausa o voo. O rAF pausa via
// LabRuntime.createLoop (autoPause); sem LabRuntime, cai no listener manual.
if (window.LabVisibility && labLoop) {
    LabVisibility.whenHidden(() => {
        setEngineLevel(0);
        clearKeys();
        if (gameState === 'PLAYING') setPaused(true);
    });
    LabVisibility.whenVisible(() => { lastTime = 0; });
} else {
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            setEngineLevel(0);
            clearKeys();
            if (gameState === 'PLAYING') setPaused(true);
            stopLoop();
        } else if (!paused) {
            startLoop();
        }
    });
}

generateStars();
generateTerrain();
lander.reset();
setGameState('START');
setFlightStatus('PRONTO');
syncModeButtons();
syncSafeReadout();
syncPauseButton();
syncBest();
draw();
startLoop();
