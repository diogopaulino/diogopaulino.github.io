/**
 * Fanfarra original em Dó maior — brass filtrado, harpa e pad.
 * Não reproduz melodias protegidas; o contorno é uma cadência própria
 * sincronizada com a abertura de 38 s:
 *   0 s pad e harpa lenta (rasante no lago) · 8 s metais (revelação, andamento ×1,3)
 *   13,2 s harpa em escala (voo da fada) · 23 s sinos (a estrela acende) · 24 s+ fogos
 */

export class FanfareAudio {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.volume = 0.72;
        this._started = false;
        this._played = false;
        this._nodes = [];
    }

    /** Cancela as notas agendadas (replay/pular). */
    stopScheduled() {
        for (const o of this._nodes) {
            try { o.stop(); } catch { /* já parou */ }
        }
        this._nodes.length = 0;
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
        this.comp.threshold.value = -14;
        this.comp.ratio.value = 3.4;
        this.master.connect(this.comp);
        this.comp.connect(ctx.destination);

        this.music = ctx.createGain();
        this.music.gain.value = 0.5;
        this.sfx = ctx.createGain();
        this.sfx.gain.value = 0.7;
        this.music.connect(this.master);
        this.sfx.connect(this.master);

        this._pad();
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
        filter.frequency.value = 520;
        filter.Q.value = 0.55;
        filter.connect(this.music);
        this._osc('sine', 65.41, filter, 0.09);
        this._osc('sine', 98.00, filter, 0.06);
        this._osc('triangle', 130.81, filter, 0.03);
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.07;
        const lfoG = ctx.createGain();
        lfoG.gain.value = 140;
        lfo.connect(lfoG);
        lfoG.connect(filter.frequency);
        lfo.start();
    }

    _brass(freq, when, dur, gain = 0.12) {
        const ctx = this.ctx;
        if (!ctx) return;
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = freq;
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(420, when);
        f.frequency.exponentialRampToValueAtTime(1800, when + 0.12);
        f.frequency.exponentialRampToValueAtTime(700, when + dur);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, when);
        g.gain.exponentialRampToValueAtTime(gain, when + 0.05);
        g.gain.exponentialRampToValueAtTime(gain * 0.7, when + dur * 0.6);
        g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
        o.connect(f);
        f.connect(g);
        g.connect(this.music);
        o.start(when);
        o.stop(when + dur + 0.05);
        this._nodes.push(o);
    }

    _harp(freq, when, dur = 1.6, gain = 0.07) {
        const ctx = this.ctx;
        if (!ctx) return;
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, when);
        g.gain.exponentialRampToValueAtTime(gain, when + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
        o.connect(g);
        g.connect(this.music);
        o.start(when);
        o.stop(when + dur + 0.02);
        this._nodes.push(o);
    }

    _chime(freq, when, gain = 0.06) {
        const ctx = this.ctx;
        if (!ctx) return;
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, when);
        g.gain.exponentialRampToValueAtTime(gain, when + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, when + 1.4);
        o.connect(g);
        g.connect(this.sfx);
        o.start(when);
        o.stop(when + 1.5);
        this._nodes.push(o);
    }

    playFanfare() {
        this.init();
        if (!this.ctx || !this.enabled) return;
        this._played = true;
        this.stopScheduled();
        const t0 = this.ctx.currentTime + 0.05;
        // harpa lenta sobre o lago
        [261.63, 392.0, 523.25, 659.25, 523.25, 392.0, 329.63, 392.0].forEach((f, i) => this._harp(f, t0 + 0.6 + i * 0.9, 2.4, 0.04));
        // Fanfarra original em C: G–C–E–G, depois E–F–G–C (andamento ×1,3, entra na revelação)
        const t = t0 + 8;
        const K = 1.3;
        const brass = [
            [196.0, 0.0, 0.7, 0.09],
            [261.63, 0.55, 0.7, 0.1],
            [329.63, 1.1, 0.75, 0.1],
            [392.0, 1.7, 1.4, 0.12],
            [329.63, 3.4, 0.45, 0.08],
            [349.23, 3.85, 0.45, 0.08],
            [392.0, 4.3, 0.9, 0.11],
            [523.25, 5.2, 2.2, 0.13],
            [392.0, 8.0, 0.55, 0.09],
            [440.0, 8.55, 0.55, 0.09],
            [493.88, 9.1, 0.7, 0.1],
            [523.25, 9.8, 2.4, 0.14],
            [659.25, 13.2, 1.8, 0.1],
            [783.99, 15.0, 2.6, 0.12],
            [1046.5, 17.4, 3.4, 0.1]
        ];
        for (const [f, at, d, g] of brass) this._brass(f, t + at * K, d * K, g);
        // terça e quinta sob as notas longas (acorde cheio no final)
        for (const [f, at, d] of [[329.63, 9.8, 2.4], [392.0, 15.0, 2.6], [523.25, 17.4, 3.4], [659.25, 17.4, 3.4]]) this._brass(f, t + at * K, d * K, 0.05);

        // escala de harpa acompanhando a fada
        const harp = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.7, 1318.5, 1568.0, 1760.0, 2093.0];
        harp.forEach((f, i) => this._harp(f, t0 + 13.4 + i * 0.86, 1.6, 0.045));
        // a estrela acende
        [1046.5, 1318.5, 1568, 2093, 2637].forEach((f, i) => {
            this._chime(f, t0 + 23 + i * 0.11, 0.05);
        });
    }

    /** Estampido de fogo; `delay` (s) = distância / 340 m/s. */
    firework(delay = 0) {
        if (!this.ctx || !this.enabled) return;
        const t = this.ctx.currentTime + delay;
        const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.35, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
        }
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 1800;
        const g = this.ctx.createGain();
        g.gain.value = 0.22;
        src.connect(bp);
        bp.connect(g);
        g.connect(this.sfx);
        src.start(t);
        this._chime(880 + Math.random() * 400, t, 0.04);
    }
}
