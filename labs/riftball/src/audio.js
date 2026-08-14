/**
 * Trilha synth no rift — baixo em pulso, lead pentatônico, SFX de chute/gol.
 * Tudo sintetizado na Web Audio API.
 */

const PENT = [0, 2, 4, 7, 9];
const ROOT = 110;

function deg(step, oct = 0) {
    const i = ((step % PENT.length) + PENT.length) % PENT.length;
    const o = oct + Math.floor(step / PENT.length);
    return ROOT * Math.pow(2, o + PENT[i] / 12);
}

export class GameAudio {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.volume = 0.7;
        this.mode = 'menu';
        this.step = 0;
        this.next = 0;
        this.timer = null;
        this.bpm = 118;
    }

    init() {
        if (this.ctx) {
            if (this.ctx.state === 'suspended') this.ctx.resume();
            return;
        }
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        this.ctx = ctx;
        this.master = ctx.createGain();
        this.master.gain.value = this.enabled ? this.volume : 0;
        this.comp = ctx.createDynamicsCompressor();
        this.comp.threshold.value = -18;
        this.comp.ratio.value = 3.5;
        this.music = ctx.createGain();
        this.music.gain.value = 0.32;
        this.sfx = ctx.createGain();
        this.sfx.gain.value = 0.9;
        this.music.connect(this.comp);
        this.sfx.connect(this.comp);
        this.comp.connect(this.master);
        this.master.connect(ctx.destination);
        this.next = ctx.currentTime + 0.05;
        this.loop();
    }

    setVolume(v) {
        this.volume = v;
        if (this.master) this.master.gain.value = this.enabled ? v : 0;
    }

    setEnabled(on) {
        this.enabled = on;
        if (this.master) this.master.gain.value = on ? this.volume : 0;
    }

    setMode(mode) {
        this.mode = mode;
        this.bpm = mode === 'play' ? 132 : mode === 'goal' ? 108 : 118;
    }

    loop() {
        if (!this.ctx) return;
        const ctx = this.ctx;
        const stepDur = 60 / this.bpm / 4;
        const horizon = ctx.currentTime + 0.18;
        while (this.next < horizon) {
            this.tick(this.next, this.step);
            this.next += stepDur;
            this.step = (this.step + 1) % 16;
        }
        this.timer = window.setTimeout(() => this.loop(), 40);
    }

    tick(t, step) {
        const bass = [0, 0, 3, 0, 4, 4, 3, 0, 0, 2, 3, 0, 4, 3, 2, 0][step];
        this.tone(deg(bass, 0), t, 0.18, 'sawtooth', 0.09, this.music);
        if (step % 4 === 0) this.kick(t);
        if (step % 4 === 2) this.hat(t, 0.03);
        if (this.mode === 'play' && (step === 4 || step === 12)) {
            this.tone(deg(step === 4 ? 4 : 6, 2), t, 0.22, 'triangle', 0.05, this.music);
        }
        if (this.mode === 'menu' && step % 8 === 6) {
            this.tone(deg(7, 2), t, 0.4, 'sine', 0.04, this.music);
        }
    }

    tone(freq, t, dur, type, gain, dest) {
        const ctx = this.ctx;
        if (!ctx) return;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g);
        g.connect(dest);
        o.start(t);
        o.stop(t + dur + 0.02);
    }

    kick(t) {
        const ctx = this.ctx;
        if (!ctx) return;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(140, t);
        o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
        g.gain.setValueAtTime(0.22, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
        o.connect(g);
        g.connect(this.music);
        o.start(t);
        o.stop(t + 0.18);
    }

    hat(t, gain) {
        const ctx = this.ctx;
        if (!ctx) return;
        const buf = ctx.createBuffer(1, 2200, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const f = ctx.createBiquadFilter();
        f.type = 'highpass';
        f.frequency.value = 6000;
        const g = ctx.createGain();
        g.gain.setValueAtTime(gain, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
        src.connect(f);
        f.connect(g);
        g.connect(this.music);
        src.start(t);
        src.stop(t + 0.06);
    }

    blip() {
        if (!this.ctx) return;
        this.tone(880, this.ctx.currentTime, 0.08, 'square', 0.05, this.sfx);
    }

    kickHit(impact = 1) {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this.tone(220 + impact * 40, t, 0.1, 'triangle', 0.08 * Math.min(1.4, impact), this.sfx);
        this.hat(t, 0.04);
    }

    bump() {
        if (!this.ctx) return;
        this.tone(90, this.ctx.currentTime, 0.12, 'sawtooth', 0.07, this.sfx);
    }

    goal() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this.tone(deg(4, 3), t, 0.35, 'triangle', 0.1, this.sfx);
        this.tone(deg(6, 3), t + 0.08, 0.4, 'triangle', 0.09, this.sfx);
        this.tone(deg(8, 3), t + 0.16, 0.55, 'sine', 0.08, this.sfx);
    }

    whistle() {
        if (!this.ctx) return;
        this.tone(1480, this.ctx.currentTime, 0.22, 'sine', 0.07, this.sfx);
    }
}
