/**
 * Trilha original: drone de cordas, vento da pradaria, gaita pentatônica e cascos.
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
        this._hoof = 0;
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
        this.filter.frequency.value = 1200;
        this.filter.connect(this.master);

        this.delay = this.ctx.createDelay();
        this.delay.delayTime.value = 0.38;
        const fb = this.ctx.createGain();
        fb.gain.value = 0.22;
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
        o1.frequency.value = 73;
        o2.frequency.value = 110;
        const g = this.ctx.createGain();
        g.gain.value = 0.04;
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
        bp.frequency.value = 620;
        bp.Q.value = 0.55;
        const g = this.ctx.createGain();
        g.gain.value = 0.028;
        src.connect(bp);
        bp.connect(g);
        g.connect(this.master);
        src.start();
        this.wind = { src, g, bp };
    }

    update(dt, speed) {
        if (!this._enabled) return;
        this._t += dt;
        this._step += dt * (0.42 + Math.min(0.35, Math.abs(speed) * 0.012));
        if (this._step >= 1) {
            this._step -= 1;
            this._pluck();
        }
        if (this.wind) {
            this.wind.g.gain.setTargetAtTime(
                0.022 + Math.min(0.045, Math.abs(speed) * 0.0018),
                this.ctx.currentTime,
                0.2
            );
        }
        if (Math.random() < dt * 0.06) this._harmonica();
    }

    _pluck() {
        const scale = [0, 2, 3, 5, 7, 10, 12];
        const n = scale[Math.floor(Math.random() * scale.length)];
        const f = 146.8 * (2 ** (n / 12));
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = f;
        const g = this.ctx.createGain();
        g.gain.value = 0.038;
        g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.35);
        osc.connect(g);
        g.connect(this.filter);
        osc.start();
        osc.stop(this.ctx.currentTime + 1.4);
    }

    _harmonica() {
        const scale = [0, 3, 5, 7, 10];
        const n = scale[Math.floor(Math.random() * scale.length)];
        const f = 392 * (2 ** (n / 12));
        const osc = this.ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.value = f;
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = f;
        bp.Q.value = 6;
        const g = this.ctx.createGain();
        g.gain.value = 0.018;
        g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.7);
        osc.connect(bp);
        bp.connect(g);
        g.connect(this.master);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.75);
    }

    hoof(inWater) {
        if (!this._enabled) return;
        const t = this.ctx.currentTime;
        const buf = this.ctx.createBuffer(1, 800, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
        }
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = inWater ? 380 : 180;
        bp.Q.value = 0.8;
        const g = this.ctx.createGain();
        g.gain.value = inWater ? 0.05 : 0.07;
        src.connect(bp);
        bp.connect(g);
        g.connect(this.master);
        src.start(t);
    }

    spur() {
        if (!this._enabled) return;
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(90, this.ctx.currentTime + 0.18);
        const g = this.ctx.createGain();
        g.gain.value = 0.04;
        g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);
        osc.connect(g);
        g.connect(this.master);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.22);
    }
}
