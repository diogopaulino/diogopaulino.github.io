/**
 * Trilha e efeitos — Web Audio original (nada da trilha de Medal of Honor).
 * Drone de metais graves, surf, tiros, ping do clip e rádio.
 */

import { clamp } from './utils.js';

export class GameAudio {
    constructor() {
        this.ctx = null;
        this.master = null;
        this.muted = false;
        this.volume = 0.72;
        this._enabled = false;
        this._t = 0;
        this._boom = 2.5;
        this._note = 0;
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
        this.filter.frequency.value = 720;
        this.filter.connect(this.master);

        this._startDrone();
        this._startSurf();
        this._enabled = true;
    }

    setMuted(muted) {
        this.muted = muted;
        if (this.master) {
            this.master.gain.setTargetAtTime(muted ? 0 : this.volume, this.ctx.currentTime, 0.05);
        }
    }

    setVolume(v) {
        this.volume = clamp(v, 0, 1);
        if (!this.muted && this.master) {
            this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
        }
    }

    _startDrone() {
        const o1 = this.ctx.createOscillator();
        o1.type = 'sawtooth';
        o1.frequency.value = 55;
        const g1 = this.ctx.createGain();
        g1.gain.value = 0.045;
        o1.connect(g1).connect(this.filter);
        o1.start();

        const o2 = this.ctx.createOscillator();
        o2.type = 'triangle';
        o2.frequency.value = 82.5;
        const g2 = this.ctx.createGain();
        g2.gain.value = 0.028;
        o2.connect(g2).connect(this.filter);
        o2.start();
        this.drone = o1;
    }

    _startSurf() {
        const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 380;
        bp.Q.value = 0.6;
        const g = this.ctx.createGain();
        g.gain.value = 0.045;
        src.connect(bp).connect(g).connect(this.master);
        src.start();
        this.surfGain = g;
    }

    _noiseBurst(duration, gain, freq, q = 0.8) {
        if (!this._enabled || this.muted) return;
        const t = this.ctx.currentTime;
        const buf = this.ctx.createBuffer(1, Math.max(1, this.ctx.sampleRate * duration), this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = freq;
        bp.Q.value = q;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(gain, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
        src.connect(bp).connect(g).connect(this.master);
        src.start();
        src.stop(t + duration);
    }

    _tone(freq, duration, gain, type = 'sine') {
        if (!this._enabled || this.muted) return;
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        o.type = type;
        o.frequency.value = freq;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(gain, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
        o.connect(g).connect(this.master);
        o.start();
        o.stop(t + duration);
    }

    shot(kind = 'garand') {
        this._noiseBurst(kind === 'thompson' ? 0.09 : 0.14, 0.28, kind === 'thompson' ? 900 : 520, 0.7);
        this._tone(kind === 'thompson' ? 180 : 140, 0.08, 0.12, 'square');
    }

    ping() {
        this._tone(2650, 0.55, 0.16, 'sine');
        this._tone(1980, 0.4, 0.08, 'triangle');
    }

    reload() {
        this._noiseBurst(0.08, 0.12, 1400, 1.4);
        setTimeout(() => this._noiseBurst(0.06, 0.1, 800, 1.1), 180);
    }

    explosion() {
        this._noiseBurst(0.55, 0.45, 90, 0.45);
        this._tone(48, 0.7, 0.22, 'sine');
    }

    hit() {
        this._noiseBurst(0.12, 0.18, 220, 0.8);
    }

    footstep(wet) {
        this._noiseBurst(0.06, wet ? 0.08 : 0.05, wet ? 180 : 320, 1.2);
    }

    radioBeep() {
        this._tone(880, 0.08, 0.1, 'square');
        this._tone(660, 0.12, 0.08, 'square');
    }

    flare() {
        this._noiseBurst(0.8, 0.2, 700, 0.5);
        this._tone(520, 1.2, 0.08, 'sawtooth');
    }

    update(dt, nearWater) {
        if (!this._enabled || this.muted) return;
        this._t += dt;
        if (this.surfGain) {
            const target = nearWater ? 0.07 : 0.018;
            this.surfGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.4);
        }
        this._boom -= dt;
        if (this._boom <= 0) {
            this._boom = 4 + Math.random() * 7;
            this._noiseBurst(0.45, 0.12, 70, 0.4);
        }
        this._note += dt;
        if (this._note > 3.2) {
            this._note = 0;
            const notes = [55, 65.4, 73.4, 82.4, 98];
            this._tone(notes[(Math.random() * notes.length) | 0], 1.8, 0.035, 'triangle');
        }
    }
}
