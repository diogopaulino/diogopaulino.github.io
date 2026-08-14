/**
 * Trilha original no espírito dos beat 'em ups de 16 bits (FM + bateria).
 * Três temas: rua (synthwave menor), metrô (industrial) e catedral (órgão).
 */

let ctx = null;
let master = null;
let musicGain = null;
let sfxGain = null;
let muted = false;
let musicTimer = null;
let step = 0;
let theme = 'street';

function ensure() {
    if (typeof window === 'undefined') return null;
    if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain();
        master.gain.value = 0.7;
        master.connect(ctx.destination);
        musicGain = ctx.createGain();
        musicGain.gain.value = 0.22;
        musicGain.connect(master);
        sfxGain = ctx.createGain();
        sfxGain.gain.value = 0.55;
        sfxGain.connect(master);
    }
    if (!ctx) return null;
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
}

function envGain(dest, vol, start, dur, attack = 0.01) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    g.connect(dest);
    return g;
}

function osc(freq, type, vol, start, dur, dest, bend = 1) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    if (bend !== 1) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * bend), start + dur);
    o.connect(envGain(dest, vol, start, dur));
    o.start(start);
    o.stop(start + dur + 0.03);
}

function noise(dur, vol, start, dest, hp = 400) {
    const len = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = hp;
    src.connect(f);
    f.connect(envGain(dest, vol, start, dur, 0.005));
    src.start(start);
}

export function unlock() {
    ensure();
}

export function setMuted(v) {
    muted = v;
    if (master) master.gain.value = muted ? 0 : 0.7;
}

export function isMuted() {
    return muted;
}

export function toggleMute() {
    setMuted(!muted);
    if (!muted) unlock();
    return muted;
}

export function sfx(name, strength = 1) {
    if (muted && !ctx) return;
    const ac = ensure();
    if (!ac) return;
    const t = ctx.currentTime;
    const s = strength;
    if (name === 'ui') {
        osc(520, 'square', 0.07, t, 0.06, sfxGain, 1.3);
        osc(780, 'triangle', 0.05, t + 0.05, 0.07, sfxGain);
    } else if (name === 'hit') {
        noise(0.07, 0.16 * s, t, sfxGain, 180);
        osc(140, 'triangle', 0.14 * s, t, 0.09, sfxGain, 0.45);
    } else if (name === 'heavy') {
        noise(0.14, 0.22 * s, t, sfxGain, 70);
        osc(78, 'sawtooth', 0.2 * s, t, 0.16, sfxGain, 0.4);
        osc(42, 'sine', 0.16 * s, t, 0.2, sfxGain, 0.7);
    } else if (name === 'whiff') {
        noise(0.08, 0.05, t, sfxGain, 900);
    } else if (name === 'jump') {
        osc(220, 'square', 0.06, t, 0.1, sfxGain, 1.8);
    } else if (name === 'land') {
        noise(0.06, 0.08, t, sfxGain, 120);
    } else if (name === 'special') {
        osc(60, 'sawtooth', 0.22, t, 0.4, sfxGain, 5);
        noise(0.28, 0.14, t + 0.05, sfxGain, 300);
        osc(440, 'square', 0.07, t + 0.1, 0.28, sfxGain, 0.5);
    } else if (name === 'throw') {
        noise(0.14, 0.16, t, sfxGain, 80);
        osc(110, 'triangle', 0.16, t, 0.18, sfxGain, 0.4);
    } else if (name === 'ko') {
        osc(98, 'sawtooth', 0.18, t, 0.35, sfxGain, 0.4);
        noise(0.3, 0.14, t + 0.05, sfxGain, 50);
    } else if (name === 'item') {
        osc(523, 'triangle', 0.08, t, 0.08, sfxGain);
        osc(784, 'triangle', 0.07, t + 0.07, 0.1, sfxGain);
    } else if (name === 'go') {
        osc(392, 'square', 0.08, t, 0.1, sfxGain);
        osc(523, 'square', 0.09, t + 0.12, 0.14, sfxGain);
    } else if (name === 'hurt') {
        osc(180, 'sawtooth', 0.12, t, 0.12, sfxGain, 0.5);
        noise(0.1, 0.1, t, sfxGain, 200);
    } else if (name === 'die') {
        osc(110, 'triangle', 0.16, t, 0.5, sfxGain, 0.3);
        noise(0.4, 0.12, t, sfxGain, 60);
    } else if (name === 'win') {
        [261, 329, 392, 523].forEach((f, i) => osc(f, 'triangle', 0.09, t + i * 0.12, 0.28, sfxGain));
    } else if (name === 'continue') {
        osc(220, 'square', 0.08, t, 0.12, sfxGain);
    }
}

const THEMES = {
    street: {
        bpm: 128,
        bass: [55, 55, 65.4, 55, 49, 55, 41.2, 49],
        lead: [0, 220, 261, 329, 0, 293, 261, 220, 196, 220, 0, 174, 196, 220, 261, 0]
    },
    metro: {
        bpm: 136,
        bass: [41.2, 41.2, 49, 41.2, 36.7, 41.2, 55, 49],
        lead: [0, 164, 196, 220, 0, 196, 164, 146, 130, 146, 0, 110, 130, 164, 196, 0]
    },
    cathedral: {
        bpm: 108,
        bass: [73.4, 73.4, 65.4, 73.4, 82.4, 73.4, 98, 87.3],
        lead: [0, 293, 349, 392, 0, 349, 329, 293, 261, 293, 0, 220, 261, 293, 349, 0]
    }
};

function tick() {
    if (!ctx || muted) return;
    const spec = THEMES[theme] || THEMES.street;
    const beat = 60 / spec.bpm / 2;
    const t = ctx.currentTime + 0.04;
    const i = step % 8;
    const l = step % 16;

    osc(spec.bass[i], 'sawtooth', 0.22, t, beat * 0.9, musicGain, 0.98);
    osc(spec.bass[i] * 0.5, 'sine', 0.16, t, beat * 0.9, musicGain);

    if (i % 2 === 0) {
        osc(70, 'sine', 0.18, t, 0.08, musicGain, 0.5);
        noise(0.05, 0.08, t, musicGain, 80);
    }
    if (i === 2 || i === 6) noise(0.07, 0.14, t, musicGain, 1400);

    const hat = ctx.createOscillator();
    hat.frequency.value = 9000;
    hat.type = 'square';
    hat.connect(envGain(musicGain, i % 2 ? 0.012 : 0.022, t, 0.03, 0.001));
    hat.start(t);
    hat.stop(t + 0.04);

    if (spec.lead[l]) {
        osc(spec.lead[l], 'square', 0.05, t, beat * 1.4, musicGain, 1.01);
        osc(spec.lead[l] * 2, 'triangle', 0.025, t, beat * 1.2, musicGain);
    }
    step++;
    musicTimer = setTimeout(tick, beat * 1000);
}

export function startMusic(name) {
    if (!ensure()) return;
    theme = name || 'street';
    stopMusic();
    step = 0;
    tick();
}

export function stopMusic() {
    if (musicTimer) clearTimeout(musicTimer);
    musicTimer = null;
}
