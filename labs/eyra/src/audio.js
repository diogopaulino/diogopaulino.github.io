/**
 * Pad em ré menor pentatônico, vento nas asas e sinos de semente.
 * Só Web Audio — nenhum sample externo.
 */

export class EyraAudio {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.volume = 0.7;
        this.master = null;
        this.started = false;
        this.step = 0;
        this.acc = 0;
        this.bpm = 64;
    }

    init() {
        if (this.ctx) {
            if (this.ctx.state === 'suspended') this.ctx.resume();
            this.started = true;
            return;
        }
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        this.ctx = new Ctx();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.enabled ? this.volume : 0;
        this.master.connect(this.ctx.destination);

        this.music = this.ctx.createGain();
        this.music.gain.value = 0.36;
        this.music.connect(this.master);

        const noiseBuf = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
        const data = noiseBuf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const wind = this.ctx.createBufferSource();
        wind.buffer = noiseBuf;
        wind.loop = true;
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 380;
        bp.Q.value = 0.4;
        this.windGain = this.ctx.createGain();
        this.windGain.gain.value = 0.04;
        wind.connect(bp);
        bp.connect(this.windGain);
        this.windGain.connect(this.master);
        wind.start();

        this.whoosh = this.ctx.createOscillator();
        this.whoosh.type = 'sawtooth';
        this.whoosh.frequency.value = 42;
        this.whooshGain = this.ctx.createGain();
        this.whooshGain.gain.value = 0;
        const lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 220;
        this.whoosh.connect(lp);
        lp.connect(this.whooshGain);
        this.whooshGain.connect(this.master);
        this.whoosh.start();

        this._pad();
        this.started = true;
    }

    _osc(type, freq, dest, gain = 0.06) {
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
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 520;
        filter.Q.value = 0.55;
        filter.connect(this.music);
        this._osc('sine', 146.83, filter, 0.07);
        this._osc('sine', 174.61, filter, 0.045);
        this._osc('triangle', 220.0, filter, 0.03);
        this._osc('sine', 329.63, filter, 0.02);
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

    setFlight(speed01, boosting) {
        if (!this.windGain || !this.whooshGain) return;
        const t = this.ctx.currentTime;
        this.windGain.gain.setTargetAtTime(0.03 + speed01 * 0.05, t, 0.12);
        this.whooshGain.gain.setTargetAtTime(boosting ? 0.045 : speed01 * 0.018, t, 0.08);
        this.whoosh.frequency.setTargetAtTime(36 + speed01 * 40, t, 0.1);
    }

    blip(freq, dur, type = 'sine', gain = 0.12) {
        if (!this.ctx || !this.enabled || !this.started) return;
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.62), t + dur);
        g.gain.setValueAtTime(gain, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(g);
        g.connect(this.master);
        o.start(t);
        o.stop(t + dur + 0.02);
    }

    seed(combo = 1) {
        const base = 392 * Math.pow(2, (combo % 8) / 12);
        this.blip(base, 0.28, 'sine', 0.12);
        this.blip(base * 1.5, 0.36, 'triangle', 0.06);
    }

    ring(combo = 1) {
        this.blip(523 * Math.pow(2, (combo % 5) / 12), 0.18, 'sine', 0.08);
    }

    hit() {
        this.blip(90, 0.22, 'sawtooth', 0.08);
        this.blip(60, 0.3, 'square', 0.04);
    }

    victory() {
        [392, 494, 587, 740].forEach((f, i) => {
            setTimeout(() => this.blip(f, 0.45, 'sine', 0.1), i * 160);
        });
    }

    tick(dt) {
        if (!this.ctx || !this.enabled || !this.started) return;
        this.acc += dt;
        const step = 60 / this.bpm;
        if (this.acc < step) return;
        this.acc -= step;
        const scale = [146.83, 174.61, 196, 220, 261.63, 293.66];
        const note = scale[this.step % scale.length];
        if (this.step % 4 === 0) this.blip(note * 2, 0.4, 'sine', 0.035);
        this.step++;
    }
}
