/**
 * Sons leves via Web Audio API — sem arquivos externos.
 */

let ctx = null;
let muted = false;

function ac() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
}

export function setMuted(v) {
    muted = !!v;
}

export function isMuted() {
    return muted;
}

function tone(freq, dur, type = 'sine', gain = 0.04, delay = 0) {
    if (muted) return;
    const c = ac();
    const t0 = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
}

export function sfxDeal() {
    tone(420, 0.06, 'triangle', 0.03);
    tone(520, 0.05, 'triangle', 0.025, 0.04);
}

export function sfxChip() {
    tone(180, 0.08, 'square', 0.02);
    tone(240, 0.06, 'square', 0.015, 0.03);
}

export function sfxFold() {
    tone(160, 0.12, 'sine', 0.03);
}

export function sfxWin() {
    tone(523, 0.1, 'sine', 0.04);
    tone(659, 0.12, 'sine', 0.035, 0.09);
    tone(784, 0.16, 'sine', 0.03, 0.18);
}

export function sfxClick() {
    tone(660, 0.04, 'sine', 0.02);
}
