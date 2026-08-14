/**
 * Trilha arcade FM + SFX. Tudo sintetizado na Web Audio API.
 * Luta: 132 BPM, frígio em Lá — baixo quadrado, lead de “juiz”.
 */

const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];
const ROOT = 110;

function deg(step, oct = 0) {
    const i = ((step % PHRYGIAN.length) + PHRYGIAN.length) % PHRYGIAN.length;
    const o = oct + Math.floor(step / PHRYGIAN.length);
    return ROOT * Math.pow(2, o + PHRYGIAN[i] / 12);
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
        this.bpm = 128;
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
        this.comp.threshold.value = -16;
        this.comp.ratio.value = 4;
        this.music = ctx.createGain();
        this.music.gain.value = 0.38;
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
        this.bpm = mode === 'fight' ? 136 : 112;
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

    tick(time, step) {
        if (!this.ctx || !this.enabled) return;
        const fight = this.mode === 'fight';
        if (step % 4 === 0) this.kick(time, fight ? 0.9 : 0.55);
        if (step === 4 || step === 12) this.snare(time);
        if (step % 2 === 0) this.hat(time, 0.03);
        const bass = fight
            ? [0, 0, 7, 0, 8, 7, 3, 0, 0, 5, 7, 8, 3, 0, 1, 0]
            : [0, 0, 3, 0, 5, 3, 0, 7, 0, 3, 5, 0, 8, 7, 5, 3];
        this.bass(time, deg(bass[step], 0), fight ? 0.18 : 0.12);
        if (fight && (step === 0 || step === 6 || step === 10)) {
            this.lead(time, deg([0, 3, 7, 8, 10, 12, 8, 7][step % 8], 2));
        } else if (!fight && step % 8 === 0) {
            this.lead(time, deg(7, 2));
        }
    }

    osc(type, freq, t, dur, gain, bus) {
        const ctx = this.ctx;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g);
        g.connect(bus);
        o.start(t);
        o.stop(t + dur + 0.02);
    }

    kick(t, amp) {
        const ctx = this.ctx;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(140, t);
        o.frequency.exponentialRampToValueAtTime(38, t + 0.12);
        g.gain.setValueAtTime(amp, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
        o.connect(g);
        g.connect(this.music);
        o.start(t);
        o.stop(t + 0.2);
    }

    snare(t) {
        const ctx = this.ctx;
        const buf = ctx.createBuffer(1, 2200, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const f = ctx.createBiquadFilter();
        f.type = 'highpass';
        f.frequency.value = 1200;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.22, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
        src.connect(f);
        f.connect(g);
        g.connect(this.music);
        src.start(t);
        src.stop(t + 0.14);
    }

    hat(t, amp) {
        this.osc('square', 7200, t, 0.04, amp, this.music);
    }

    bass(t, freq, amp) {
        this.osc('square', freq, t, 0.16, amp, this.music);
    }

    lead(t, freq) {
        this.osc('sawtooth', freq, t, 0.22, 0.07, this.music);
    }

    blip() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this.osc('square', 880, t, 0.08, 0.12, this.sfx);
        this.osc('square', 1320, t + 0.05, 0.07, 0.08, this.sfx);
    }

    whoosh() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this.osc('sawtooth', 220, t, 0.09, 0.08, this.sfx);
    }

    hit(blocked) {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        if (blocked) {
            this.osc('square', 640, t, 0.07, 0.16, this.sfx);
            this.osc('triangle', 1280, t, 0.05, 0.08, this.sfx);
            return;
        }
        this.osc('sawtooth', 90, t, 0.14, 0.28, this.sfx);
        this.osc('square', 180, t, 0.08, 0.12, this.sfx);
        const ctx = this.ctx;
        const buf = ctx.createBuffer(1, 1800, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.22, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
        src.connect(g);
        g.connect(this.sfx);
        src.start(t);
        src.stop(t + 0.12);
    }

    announce() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this.osc('square', 392, t, 0.18, 0.16, this.sfx);
        this.osc('square', 523, t + 0.16, 0.22, 0.18, this.sfx);
        this.osc('square', 784, t + 0.36, 0.28, 0.2, this.sfx);
    }

    ko() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this.osc('sawtooth', 196, t, 0.4, 0.22, this.sfx);
        this.osc('square', 98, t, 0.55, 0.2, this.sfx);
        this.osc('triangle', 523, t + 0.2, 0.4, 0.12, this.sfx);
    }

    win() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        [523, 659, 784, 1046].forEach((f, i) => {
            this.osc('square', f, t + i * 0.12, 0.18, 0.14, this.sfx);
        });
    }
}
