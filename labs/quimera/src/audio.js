/**
 * Drone pentatônico suave + pluck ao trocar peça.
 * Começa mudo até o primeiro gesto (política de autoplay).
 */

export class StudioAudio {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.started = false;
        this.volume = 0.62;
    }

    async resume() {
        if (!this.ctx) this.boot();
        if (!this.ctx) return;
        if (this.ctx.state === 'suspended') await this.ctx.resume();
        this.started = true;
        if (this.droneGain && this.enabled) {
            this.droneGain.gain.setTargetAtTime(0.055, this.ctx.currentTime, 1.4);
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

        this.voices = ctx.createGain();
        this.voices.gain.value = 0.85;
        this.dry = ctx.createGain();
        this.dry.gain.value = 0.7;
        this.wet = ctx.createGain();
        this.wet.gain.value = 0.42;
        this.voices.connect(this.dry);
        this.dry.connect(this.master);

        this._reverb(ctx);
        this.voices.connect(this.reverbIn);
        this.reverbOut.connect(this.wet);
        this.wet.connect(this.master);

        this._drone(ctx);
    }

    _reverb(ctx) {
        this.reverbIn = ctx.createGain();
        this.reverbOut = ctx.createGain();
        [0.19, 0.31, 0.47, 0.63].forEach((delayTime, i) => {
            const d = ctx.createDelay(1.2);
            d.delayTime.value = delayTime;
            const fb = ctx.createGain();
            fb.gain.value = 0.36 - i * 0.04;
            const lp = ctx.createBiquadFilter();
            lp.type = 'lowpass';
            lp.frequency.value = 2800 - i * 400;
            this.reverbIn.connect(d);
            d.connect(lp);
            lp.connect(fb);
            fb.connect(d);
            lp.connect(this.reverbOut);
        });
    }

    _drone(ctx) {
        this.droneGain = ctx.createGain();
        this.droneGain.gain.value = 0;
        const freqs = [130.81, 196.0, 261.63, 329.63];
        freqs.forEach((f, i) => {
            const o = ctx.createOscillator();
            o.type = i % 2 ? 'triangle' : 'sine';
            o.frequency.value = f;
            const g = ctx.createGain();
            g.gain.value = i === 0 ? 0.45 : 0.18;
            o.connect(g);
            g.connect(this.droneGain);
            o.start();
        });
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 720;
        this.droneGain.connect(lp);
        lp.connect(this.master);
    }

    setEnabled(on) {
        this.enabled = on;
        if (!this.master || !this.ctx) return;
        this.master.gain.setTargetAtTime(on ? this.volume : 0, this.ctx.currentTime, 0.08);
        if (on && this.ctx.state === 'suspended') this.ctx.resume();
    }

    /** Pluck pentatônico ao trocar uma peça. slot 0 cabeça, 1 corpo, 2 acessório. */
    pluck(slot = 0) {
        if (!this.ctx || !this.enabled || !this.started) return;
        const t = this.ctx.currentTime;
        const scale = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25];
        const freq = scale[(slot + Math.floor(Math.random() * 3)) % scale.length];

        const g = this.ctx.createGain();
        g.connect(this.voices);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.22, t + 0.018);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);

        const o = this.ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(freq, t);
        o.frequency.exponentialRampToValueAtTime(freq * 0.98, t + 0.6);
        o.connect(g);
        o.start(t);
        o.stop(t + 1);

        const o2 = this.ctx.createOscillator();
        o2.type = 'triangle';
        o2.frequency.value = freq * 2;
        const g2 = this.ctx.createGain();
        g2.gain.value = 0.18;
        o2.connect(g2);
        g2.connect(g);
        o2.start(t);
        o2.stop(t + 0.5);
    }
}
