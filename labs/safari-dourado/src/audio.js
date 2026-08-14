/**
 * Trilha original: marimba pentatônica, vento e chamados da savana.
 */

import { clamp } from './utils.js';

export class GameAudio {
    constructor() {
        this.ctx = null;
        this.master = null;
        this.muted = false;
        this.volume = 0.7;
        this._enabled = false;
        this._t = 0;
        this._step = 0;
        this.engine = null;
    }

    async unlock() {
        if (this.ctx) {
            if (this.ctx.state === 'suspended') await this.ctx.resume();
            return;
        }
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        this.ctx = new Ctx();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : this.volume;
        this.master.connect(this.ctx.destination);

        this.filter = this.ctx.createBiquadFilter();
        this.filter.type = 'lowpass';
        this.filter.frequency.value = 1400;
        this.filter.connect(this.master);

        this.delay = this.ctx.createDelay();
        this.delay.delayTime.value = 0.32;
        const fb = this.ctx.createGain();
        fb.gain.value = 0.18;
        this.filter.connect(this.delay);
        this.delay.connect(fb);
        fb.connect(this.delay);
        this.delay.connect(this.master);

        this._startDrone();
        this._startWind();
        this._enabled = true;
    }

    setMuted(muted) {
        this.muted = muted;
        if (this.master && this.ctx) {
            this.master.gain.setTargetAtTime(muted ? 0 : this.volume, this.ctx.currentTime, 0.05);
        }
    }

    setVolume(v) {
        this.volume = clamp(v, 0, 1);
        if (!this.muted && this.master && this.ctx) {
            this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
        }
    }

    _startDrone() {
        const o1 = this.ctx.createOscillator();
        const o2 = this.ctx.createOscillator();
        o1.type = 'sine';
        o2.type = 'triangle';
        o1.frequency.value = 98;
        o2.frequency.value = 147;
        const g = this.ctx.createGain();
        g.gain.value = 0.045;
        o1.connect(g);
        o2.connect(g);
        g.connect(this.filter);
        o1.start();
        o2.start();
        this.drone = { o1, o2, g };
    }

    _startWind() {
        const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 680;
        bp.Q.value = 0.6;
        const g = this.ctx.createGain();
        g.gain.value = 0.03;
        src.connect(bp);
        bp.connect(g);
        g.connect(this.master);
        src.start();
        this.wind = { src, g, bp };
    }

    update(dt, speed) {
        if (!this._enabled) return;
        this._t += dt;
        this._step += dt * (0.55 + Math.min(0.4, Math.abs(speed) * 0.02));
        if (this._step >= 1) {
            this._step -= 1;
            this._pluck();
        }
        if (this.wind) {
            this.wind.g.gain.setTargetAtTime(
                0.025 + Math.min(0.04, Math.abs(speed) * 0.002),
                this.ctx.currentTime,
                0.2
            );
        }
        if (Math.random() < dt * 0.08) this._call();
    }

    _pluck() {
        const scale = [0, 2, 4, 7, 9, 12];
        const n = scale[Math.floor(Math.random() * scale.length)];
        const f = 196 * (2 ** (n / 12));
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = f;
        const g = this.ctx.createGain();
        g.gain.value = 0.045;
        g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.1);
        osc.connect(g);
        g.connect(this.filter);
        osc.start();
        osc.stop(this.ctx.currentTime + 1.2);
    }

    _call() {
        const f = 420 + Math.random() * 280;
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(f * 0.7, this.ctx.currentTime + 0.45);
        const g = this.ctx.createGain();
        g.gain.value = 0.03;
        g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);
        osc.connect(g);
        g.connect(this.master);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.55);
    }

    shutter() {
        if (!this._enabled) return;
        const t = this.ctx.currentTime;
        const buf = this.ctx.createBuffer(1, 2200, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
        }
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const g = this.ctx.createGain();
        g.gain.value = 0.28;
        src.connect(g);
        g.connect(this.master);
        src.start(t);
    }

    engineTone(speed) {
        if (!this._enabled) return;
        if (!this.engine) {
            const osc = this.ctx.createOscillator();
            osc.type = 'sawtooth';
            const g = this.ctx.createGain();
            g.gain.value = 0;
            const f = this.ctx.createBiquadFilter();
            f.type = 'lowpass';
            f.frequency.value = 280;
            osc.connect(f);
            f.connect(g);
            g.connect(this.master);
            osc.start();
            this.engine = { osc, g };
        }
        const abs = Math.abs(speed);
        this.engine.osc.frequency.setTargetAtTime(42 + abs * 3.4, this.ctx.currentTime, 0.08);
        this.engine.g.gain.setTargetAtTime(abs > 0.4 ? 0.018 + abs * 0.0012 : 0.004, this.ctx.currentTime, 0.1);
    }
}
