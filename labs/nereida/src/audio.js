/**
 * Trilha submersa: pad em ré dórico, ruído de água filtrado e um canto
 * grave que se aproxima com o despertar. Sem samples — só Web Audio.
 *
 * Ré dórico: D F G A C  (146.83, 174.61, 196.00, 220.00, 261.63)
 */

export class NereidaAudio {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.volume = 0.7;
        this._started = false;
        this._step = 0;
        this._timer = null;
        this._whaleGain = null;
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
        this.comp.ratio.value = 2.8;
        this.master.connect(this.comp);
        this.comp.connect(ctx.destination);

        this.music = ctx.createGain();
        this.music.gain.value = 0.42;
        this.sfx = ctx.createGain();
        this.sfx.gain.value = 0.8;
        this.music.connect(this.master);
        this.sfx.connect(this.master);

        this._water();
        this._pad();
        this._whaleDrone();
        this._chimeLoop();
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

    setAwaken(a) {
        if (!this._whaleGain) return;
        const t = this.ctx.currentTime;
        this._whaleGain.gain.linearRampToValueAtTime(0.04 + a * 0.09, t + 0.4);
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

    _water() {
        const ctx = this.ctx;
        const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let last = 0;
        for (let i = 0; i < data.length; i++) {
            const white = Math.random() * 2 - 1;
            last = (last + 0.02 * white) / 1.02;
            data[i] = last * 3.2;
        }
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 420;
        filter.Q.value = 0.5;
        const g = ctx.createGain();
        g.gain.value = 0.22;
        src.connect(filter);
        filter.connect(g);
        g.connect(this.music);
        src.start();
    }

    _pad() {
        const ctx = this.ctx;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 520;
        filter.Q.value = 0.55;
        filter.connect(this.music);

        this._osc('sine', 146.83, filter, 0.07);
        this._osc('sine', 174.61, filter, 0.045);
        this._osc('triangle', 220.00, filter, 0.028);
        this._osc('sine', 293.66, filter, 0.016);

        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.07;
        const lfoG = ctx.createGain();
        lfoG.gain.value = 70;
        lfo.connect(lfoG);
        lfoG.connect(filter.frequency);
        lfo.start();
    }

    _whaleDrone() {
        const ctx = this.ctx;
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = 92;
        const vib = ctx.createOscillator();
        vib.frequency.value = 0.18;
        const vibG = ctx.createGain();
        vibG.gain.value = 6;
        vib.connect(vibG);
        vibG.connect(o.frequency);
        this._whaleGain = ctx.createGain();
        this._whaleGain.gain.value = 0.04;
        o.connect(this._whaleGain);
        this._whaleGain.connect(this.music);
        o.start();
        vib.start();
    }

    _pluck(freq, when, dur = 1.8, gain = 0.07) {
        const ctx = this.ctx;
        if (!ctx) return;
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, when);
        g.gain.exponentialRampToValueAtTime(gain, when + 0.04);
        g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 1400;
        o.connect(f);
        f.connect(g);
        g.connect(this.music);
        o.start(when);
        o.stop(when + dur + 0.05);
    }

    _chimeLoop() {
        const melody = [293.66, 349.23, 392.0, 440.0, 392.0, 349.23, 293.66, 220.0];
        const beat = 1.15;
        const tick = () => {
            if (!this.ctx || !this.enabled) return;
            const t = this.ctx.currentTime;
            const i = this._step % melody.length;
            this._pluck(melody[i], t, 1.8, 0.055);
            if (i % 4 === 0) this._pluck(146.83, t, 2.6, 0.035);
            this._step++;
            this._timer = setTimeout(tick, beat * 1000);
        };
        tick();
    }

    collect() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        [440, 554.37, 659.25, 880].forEach((f, i) => this._tone(f, t + i * 0.08, 0.7, 0.11));
    }

    sonar() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this._tone(620, t, 0.9, 0.09);
        this._tone(310, t + 0.05, 1.1, 0.06);
    }

    ping() {
        if (!this.ctx) return;
        this._tone(980, this.ctx.currentTime, 0.35, 0.08);
    }

    victory() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        [146.83, 220, 293.66, 349.23, 440, 587.33].forEach((f, i) => {
            this._tone(f, t + i * 0.16, 1.6, 0.12);
        });
        const o = this.ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(110, t);
        o.frequency.exponentialRampToValueAtTime(55, t + 2.4);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.16, t + 0.2);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
        o.connect(g);
        g.connect(this.sfx);
        o.start(t);
        o.stop(t + 2.7);
    }

    _tone(freq, when, dur, gain) {
        const ctx = this.ctx;
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, when);
        g.gain.exponentialRampToValueAtTime(gain, when + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
        o.connect(g);
        g.connect(this.sfx);
        o.start(when);
        o.stop(when + dur + 0.05);
    }
}
