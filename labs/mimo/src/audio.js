/**
 * Pad quente, ronronar, latido, miado, água e petiscos — Web Audio puro.
 */

export class MimoAudio {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.volume = 0.7;
        this.started = false;
        this._purr = null;
    }

    async resume() {
        if (!this.ctx) this.boot();
        if (!this.ctx) return;
        if (this.ctx.state === 'suspended') await this.ctx.resume();
        this.started = true;
        if (this.padGain && this.enabled) {
            this.padGain.gain.setTargetAtTime(0.045, this.ctx.currentTime, 1.6);
        }
    }

    boot() {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        this.ctx = ctx;
        this.master = ctx.createGain();
        this.master.gain.value = this.enabled ? this.volume : 0;
        this.master.connect(ctx.destination);

        this.sfx = ctx.createGain();
        this.sfx.gain.value = 0.9;
        this.sfx.connect(this.master);

        this.padGain = ctx.createGain();
        this.padGain.gain.value = 0;
        this.padGain.connect(this.master);
        this._pad(ctx);
    }

    setEnabled(on) {
        this.enabled = on;
        if (this.master) this.master.gain.value = on ? this.volume : 0;
        if (on) this.resume();
        else this.stopPurr();
    }

    setVolume(v) {
        this.volume = v;
        if (this.master) this.master.gain.value = this.enabled ? v : 0;
    }

    _pad(ctx) {
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 640;
        filter.Q.value = 0.5;
        filter.connect(this.padGain);
        for (const [f, g, type] of [[174.61, 0.07, 'sine'], [220, 0.04, 'triangle'], [261.63, 0.03, 'sine']]) {
            const o = ctx.createOscillator();
            o.type = type;
            o.frequency.value = f;
            const gain = ctx.createGain();
            gain.gain.value = g;
            o.connect(gain);
            gain.connect(filter);
            o.start();
        }
    }

    _env(dest, t, attack, dur, peak = 0.2) {
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(peak, t + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        g.connect(dest);
        return g;
    }

    bark() {
        if (!this.ctx || !this.enabled) return;
        const t = this.ctx.currentTime;
        for (const [f, d] of [[180, 0.12], [140, 0.18]]) {
            const o = this.ctx.createOscillator();
            o.type = 'sawtooth';
            o.frequency.setValueAtTime(f, t);
            o.frequency.exponentialRampToValueAtTime(f * 0.6, t + d);
            const g = this._env(this.sfx, t, 0.01, d, 0.16);
            const ftr = this.ctx.createBiquadFilter();
            ftr.type = 'bandpass';
            ftr.frequency.value = 420;
            o.connect(ftr);
            ftr.connect(g);
            o.start(t);
            o.stop(t + d + 0.02);
        }
    }

    meow() {
        if (!this.ctx || !this.enabled) return;
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.setValueAtTime(720, t);
        o.frequency.linearRampToValueAtTime(480, t + 0.12);
        o.frequency.linearRampToValueAtTime(640, t + 0.28);
        o.frequency.exponentialRampToValueAtTime(300, t + 0.42);
        const g = this._env(this.sfx, t, 0.02, 0.45, 0.14);
        o.connect(g);
        o.start(t);
        o.stop(t + 0.46);
    }

    chirp(species) {
        if (species === 'cat') this.meow();
        else this.bark();
    }

    eat() {
        if (!this.ctx || !this.enabled) return;
        const t = this.ctx.currentTime;
        for (let i = 0; i < 6; i++) {
            const o = this.ctx.createOscillator();
            o.type = 'square';
            o.frequency.value = 180 + Math.random() * 90;
            const g = this._env(this.sfx, t + i * 0.09, 0.005, 0.08, 0.05);
            o.connect(g);
            o.start(t + i * 0.09);
            o.stop(t + i * 0.09 + 0.09);
        }
    }

    water() {
        if (!this.ctx || !this.enabled) return;
        const t = this.ctx.currentTime;
        const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.8, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const f = this.ctx.createBiquadFilter();
        f.type = 'highpass';
        f.frequency.value = 900;
        const g = this._env(this.sfx, t, 0.05, 0.75, 0.12);
        src.connect(f);
        f.connect(g);
        src.start(t);
    }

    chime() {
        if (!this.ctx || !this.enabled) return;
        const t = this.ctx.currentTime;
        for (const f of [523.25, 659.25, 783.99]) {
            const o = this.ctx.createOscillator();
            o.type = 'sine';
            o.frequency.value = f;
            const g = this._env(this.sfx, t, 0.01, 0.5, 0.07);
            o.connect(g);
            o.start(t);
            o.stop(t + 0.52);
        }
    }

    shake() {
        if (!this.ctx || !this.enabled) return;
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(90, t);
        o.frequency.linearRampToValueAtTime(40, t + 0.35);
        const g = this._env(this.sfx, t, 0.01, 0.36, 0.1);
        o.connect(g);
        o.start(t);
        o.stop(t + 0.38);
    }

    startPurr() {
        if (!this.ctx || !this.enabled || this._purr) return;
        const ctx = this.ctx;
        const noise = ctx.createBufferSource();
        const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        noise.buffer = buf;
        noise.loop = true;
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = 80;
        f.Q.value = 6;
        const g = ctx.createGain();
        g.gain.value = 0.05;
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 12;
        const lg = ctx.createGain();
        lg.gain.value = 0.03;
        lfo.connect(lg);
        lg.connect(g.gain);
        noise.connect(f);
        f.connect(g);
        g.connect(this.sfx);
        noise.start();
        lfo.start();
        this._purr = { noise, lfo, g };
    }

    stopPurr() {
        if (!this._purr) return;
        try {
            this._purr.noise.stop();
            this._purr.lfo.stop();
        } catch { /* */ }
        this._purr = null;
    }
}
