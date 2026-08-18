/**
 * Trilha infantil: pentatônica maior, pad quente e sinos curtos.
 * Hop / amora / amigo / festa são one-shots no Web Audio.
 */

export class NinaAudio {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.volume = 0.7;
        this._started = false;
        this._step = 0;
        this._timer = null;
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
        this.comp.ratio.value = 3.2;
        this.master.connect(this.comp);
        this.comp.connect(ctx.destination);

        this.music = ctx.createGain();
        this.music.gain.value = 0.36;
        this.sfx = ctx.createGain();
        this.sfx.gain.value = 0.9;
        this.music.connect(this.master);
        this.sfx.connect(this.master);

        this._pad();
        this._tuneLoop();
        this._started = true;
    }

    setVolume(v) {
        this.volume = v;
        if (this.master) this.master.gain.value = this.enabled ? v : 0;
    }

    setEnabled(on) {
        this.enabled = on;
        if (this.master) this.master.gain.value = on ? this.volume : 0;
        if (on) this.init();
    }

    _osc(type, freq, dest, gain = 0.08) {
        const o = this.ctx.createOscillator();
        o.type = type;
        o.frequency.value = freq;
        const g = this.ctx.createGain();
        g.gain.value = gain;
        o.connect(g);
        g.connect(dest);
        o.start();
        return { o, g };
    }

    _pad() {
        const ctx = this.ctx;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 720;
        filter.Q.value = 0.55;
        filter.connect(this.music);

        this._osc('sine', 146.83, filter, 0.07);
        this._osc('sine', 184.99, filter, 0.045);
        this._osc('triangle', 220.0, filter, 0.03);
        this._osc('sine', 329.63, filter, 0.016);

        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.09;
        const lfoG = ctx.createGain();
        lfoG.gain.value = 80;
        lfo.connect(lfoG);
        lfoG.connect(filter.frequency);
        lfo.start();
    }

    _pluck(freq, when, dur = 0.9, gain = 0.08) {
        const ctx = this.ctx;
        if (!ctx) return;
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, when);
        g.gain.exponentialRampToValueAtTime(gain, when + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
        o.connect(g);
        g.connect(this.music);
        o.start(when);
        o.stop(when + dur + 0.05);
    }

    _tuneLoop() {
        const scale = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25];
        const pattern = [0, 2, 4, 2, 5, 4, 2, 0, 4, 3, 2, 0];
        const tick = () => {
            if (!this.ctx || !this.enabled) return;
            const now = this.ctx.currentTime;
            const i = this._step % pattern.length;
            this._pluck(scale[pattern[i]], now, 0.85, 0.07);
            if (i % 4 === 0) this._pluck(scale[pattern[i]] * 0.5, now, 1.2, 0.04);
            this._step++;
        };
        tick();
        this._timer = setInterval(tick, 520);
    }

    _blip(freq, dur, type = 'sine', gain = 0.12) {
        const ctx = this.ctx;
        if (!ctx) return;
        const now = ctx.currentTime;
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.setValueAtTime(freq, now);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(gain, now + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
        o.connect(g);
        g.connect(this.sfx);
        o.start(now);
        o.stop(now + dur + 0.02);
    }

    hop() {
        this._blip(520, 0.12, 'triangle', 0.1);
        this._blip(780, 0.1, 'sine', 0.06);
    }

    berry() {
        this._blip(660, 0.14, 'sine', 0.12);
        this._blip(990, 0.18, 'triangle', 0.08);
    }

    friend() {
        const ctx = this.ctx;
        if (!ctx) return;
        const now = ctx.currentTime;
        [392, 494, 587, 784].forEach((f, i) => {
            this._pluck(f, now + i * 0.08, 0.35, 0.1);
        });
    }

    home() {
        const now = this.ctx?.currentTime;
        if (now == null) return;
        [523, 659, 784, 1046].forEach((f, i) => this._pluck(f, now + i * 0.07, 0.5, 0.11));
    }

    victory() {
        const now = this.ctx?.currentTime;
        if (now == null) return;
        [523, 659, 784, 988, 1175, 1568].forEach((f, i) => this._pluck(f, now + i * 0.12, 0.7, 0.12));
    }
}
