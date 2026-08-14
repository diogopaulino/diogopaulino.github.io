/**
 * Trilha de caixa de música: pentatônica maior, arpejos lentos e um pad
 * quente — o recorte harmónico de um prólogo Disney.
 */

export class LuminaAudio {
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
        this.music.gain.value = 0.38;
        this.sfx = ctx.createGain();
        this.sfx.gain.value = 0.85;
        this.music.connect(this.master);
        this.sfx.connect(this.master);

        this._pad();
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
        filter.frequency.value = 640;
        filter.Q.value = 0.6;
        filter.connect(this.music);

        this._osc('sine', 130.81, filter, 0.07);
        this._osc('sine', 164.81, filter, 0.05);
        this._osc('triangle', 196.0, filter, 0.03);
        this._osc('sine', 329.63, filter, 0.018);

        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.08;
        const lfoG = ctx.createGain();
        lfoG.gain.value = 90;
        lfo.connect(lfoG);
        lfoG.connect(filter.frequency);
        lfo.start();
    }

    _pluck(freq, when, dur = 1.4, gain = 0.09) {
        const ctx = this.ctx;
        if (!ctx) return;
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, when);
        g.gain.exponentialRampToValueAtTime(gain, when + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 1800;
        o.connect(f);
        f.connect(g);
        g.connect(this.music);
        o.start(when);
        o.stop(when + dur + 0.05);
    }

    _chimeLoop() {
        const ctx = this.ctx;
        // Dó maior pentatônica — caixa de música
        const melody = [523.25, 659.25, 783.99, 880.0, 783.99, 659.25, 523.25, 392.0];
        const bass = [130.81, 164.81, 196.0, 174.61];
        const beat = 0.72;
        const tick = () => {
            if (!this.ctx || !this.enabled) return;
            const t = this.ctx.currentTime;
            const i = this._step % melody.length;
            this._pluck(melody[i], t, 1.5, 0.07);
            if (i % 2 === 0) this._pluck(bass[(i / 2) % bass.length], t, 2.2, 0.045);
            if (i === 0) this._pluck(1046.5, t + 0.08, 1.1, 0.03);
            this._step++;
            this._timer = setTimeout(tick, beat * 1000);
        };
        tick();
    }

    collect() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        [880, 1174.7, 1568].forEach((f, i) => this._tone(f, t + i * 0.07, 0.5, 0.12));
    }

    lantern() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this._tone(698.46, t, 0.8, 0.08);
        this._tone(1046.5, t + 0.06, 0.9, 0.06);
    }

    victory() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
            this._tone(f, t + i * 0.12, 1.4, 0.14);
        });
    }

    _tone(freq, when, dur, gain) {
        const ctx = this.ctx;
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, when);
        g.gain.exponentialRampToValueAtTime(gain, when + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
        o.connect(g);
        g.connect(this.sfx);
        o.start(when);
        o.stop(when + dur + 0.05);
    }
}
