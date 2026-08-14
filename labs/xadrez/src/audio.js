/**
 * Áudio sintetizado — madeira, captura, xeque e o hush do atelier.
 */

export class SalonAudio {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.volume = 0.7;
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
        this.sfx = ctx.createGain();
        this.amb = ctx.createGain();
        this.sfx.gain.value = 0.9;
        this.amb.gain.value = 0.28;
        this.sfx.connect(this.master);
        this.amb.connect(this.master);
        this.master.connect(ctx.destination);
        this._room();
    }

    setEnabled(on) {
        this.enabled = on;
        if (!this.master || !this.ctx) return;
        this.master.gain.setTargetAtTime(on ? this.volume : 0, this.ctx.currentTime, 0.08);
        if (on && this.ctx.state === 'suspended') this.ctx.resume();
    }

    _now() {
        return this.ctx ? this.ctx.currentTime : 0;
    }

    _env(g, t, a, d, peak) {
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(peak, t + a);
        g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    }

    _noise(dur, peak, freq) {
        if (!this.ctx || !this.enabled) return;
        const t = this._now();
        const src = this.ctx.createBufferSource();
        const len = Math.ceil(this.ctx.sampleRate * dur);
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        src.buffer = buf;
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = freq;
        const g = this.ctx.createGain();
        src.connect(bp);
        bp.connect(g);
        g.connect(this.sfx);
        this._env(g, t, 0.004, dur, peak);
        src.start(t);
        src.stop(t + dur + 0.02);
    }

    _tone(type, freq, dur, peak) {
        if (!this.ctx || !this.enabled) return;
        const t = this._now();
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = type;
        o.frequency.value = freq;
        o.connect(g);
        g.connect(this.sfx);
        this._env(g, t, 0.01, dur, peak);
        o.start(t);
        o.stop(t + dur + 0.04);
    }

    _room() {
        if (!this.ctx) return;
        const o = this.ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = 62;
        const g = this.ctx.createGain();
        g.gain.value = 0.03;
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 180;
        o.connect(f);
        f.connect(g);
        g.connect(this.amb);
        o.start();
    }

    move() {
        this._noise(0.07, 0.16, 420);
        this._tone('sine', 180, 0.08, 0.05);
    }

    capture() {
        this._noise(0.12, 0.22, 180);
        this._tone('triangle', 90, 0.16, 0.08);
    }

    check() {
        this._tone('sine', 660, 0.18, 0.07);
        this._tone('sine', 990, 0.22, 0.05);
    }

    castle() {
        this._noise(0.16, 0.14, 280);
        this._tone('sine', 220, 0.2, 0.04);
    }

    illegal() {
        this._tone('square', 140, 0.1, 0.04);
    }

    win() {
        this._tone('sine', 523, 0.25, 0.06);
        setTimeout(() => this._tone('sine', 659, 0.28, 0.06), 140);
        setTimeout(() => this._tone('sine', 784, 0.4, 0.07), 280);
    }

    promote() {
        this._tone('sine', 784, 0.2, 0.05);
        this._tone('sine', 1046, 0.28, 0.04);
    }
}
