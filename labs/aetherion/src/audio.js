/**
 * Trilha ambiente sintetizada: drone espacial, vento solar e cues de warp.
 */

export class SpaceAudio {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.volume = 0.7;
        this._started = false;
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
        this.comp.ratio.value = 4;
        this.master.connect(this.comp);
        this.comp.connect(ctx.destination);

        this.music = ctx.createGain();
        this.music.gain.value = 0.42;
        this.sfx = ctx.createGain();
        this.sfx.gain.value = 0.8;
        this.music.connect(this.master);
        this.sfx.connect(this.master);

        this._pad();
        this._wind();
        this._started = true;
    }

    _osc(type, freq, dest, gain = 0.08) {
        const ctx = this.ctx;
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = freq;
        const g = ctx.createGain();
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
        filter.frequency.value = 420;
        filter.Q.value = 0.7;
        filter.connect(this.music);

        this._osc('sine', 55, filter, 0.11);
        this._osc('sine', 82.4, filter, 0.08);
        this._osc('triangle', 110, filter, 0.03);
        this._osc('sine', 164.8, filter, 0.025);

        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.07;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 180;
        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);
        lfo.start();

        const shimmer = this._osc('sine', 880, this.music, 0.012);
        const trem = ctx.createOscillator();
        trem.frequency.value = 0.18;
        const tremG = ctx.createGain();
        tremG.gain.value = 0.01;
        trem.connect(tremG);
        tremG.connect(shimmer.g.gain);
        trem.start();
    }

    _wind() {
        const ctx = this.ctx;
        const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.loop = true;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 900;
        bp.Q.value = 0.6;
        const g = ctx.createGain();
        g.gain.value = 0.035;
        src.connect(bp);
        bp.connect(g);
        g.connect(this.music);
        src.start();
    }

    setMuted(muted) {
        this.enabled = !muted;
        if (!this.master || !this.ctx) return;
        this.master.gain.setTargetAtTime(muted ? 0 : this.volume, this.ctx.currentTime, 0.08);
    }

    chime() {
        if (!this.ctx || !this.enabled) return;
        const ctx = this.ctx;
        const now = ctx.currentTime;
        for (const [freq, dur] of [[523.25, 0.5], [783.99, 0.7]]) {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = 'sine';
            o.frequency.value = freq;
            g.gain.setValueAtTime(0.0001, now);
            g.gain.exponentialRampToValueAtTime(0.07, now + 0.02);
            g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
            o.connect(g);
            g.connect(this.sfx);
            o.start(now);
            o.stop(now + dur + 0.05);
        }
    }

    warp() {
        if (!this.ctx || !this.enabled) return;
        const ctx = this.ctx;
        const now = ctx.currentTime;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(220, now);
        o.frequency.exponentialRampToValueAtTime(60, now + 0.45);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(0.06, now + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 1200;
        o.connect(f);
        f.connect(g);
        g.connect(this.sfx);
        o.start(now);
        o.stop(now + 0.55);
    }
}
