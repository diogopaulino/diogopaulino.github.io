/**
 * Vento, drone e uma escala dórica lenta — trilha original, nada de filme.
 *
 * Notas: D dórico (D E F G A B C) ~ 146.83 Hz, tempo ~ 48 BPM.
 * Drone em D2 + A2. Vento = ruído passa-banda.
 */

import { clamp } from './utils.js';

const SCALE = [0, 2, 3, 5, 7, 9, 10, 12];
const BASE = 146.83;

export class GameAudio {
    constructor() {
        this.ctx = null;
        this.master = null;
        this.muted = false;
        this.volume = 0.7;
        this._enabled = false;
        this._t = 0;
        this._step = 0;
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
        this.filter.frequency.value = 1100;
        this.filter.Q.value = 0.7;
        this.filter.connect(this.master);

        this.delay = this.ctx.createDelay();
        this.delay.delayTime.value = 0.42;
        const fb = this.ctx.createGain();
        fb.gain.value = 0.28;
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
            this.master.gain.setTargetAtTime(muted ? 0 : this.volume, this.ctx.currentTime, 0.08);
        }
    }

    setVolume(v) {
        this.volume = clamp(v, 0, 1);
        if (!this.muted && this.master && this.ctx) {
            this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.08);
        }
    }

    _startDrone() {
        const o1 = this.ctx.createOscillator();
        const o2 = this.ctx.createOscillator();
        o1.type = 'sine';
        o2.type = 'triangle';
        o1.frequency.value = BASE / 2;
        o2.frequency.value = BASE * 0.75;
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
        const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 3, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 520;
        bp.Q.value = 0.55;
        const g = this.ctx.createGain();
        g.gain.value = 0.04;
        src.connect(bp);
        bp.connect(g);
        g.connect(this.master);
        src.start();
        this.wind = { src, g, bp };
    }

    update(dt, moving, sitting) {
        if (!this._enabled) return;
        this._t += dt;
        const pace = sitting ? 0.22 : moving ? 0.48 : 0.32;
        this._step += dt * pace;
        if (this._step >= 1) {
            this._step -= 1;
            this._tone();
        }
        if (this.wind) {
            const w = sitting ? 0.028 : moving ? 0.055 : 0.04;
            this.wind.g.gain.setTargetAtTime(w, this.ctx.currentTime, 0.35);
        }
        if (Math.random() < dt * 0.06) this._bird();
    }

    _tone() {
        const n = SCALE[Math.floor(Math.random() * SCALE.length)];
        const oct = Math.random() > 0.72 ? 2 : 1;
        const f = BASE * oct * (2 ** (n / 12));
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = f;
        const g = this.ctx.createGain();
        g.gain.value = 0.038;
        g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.8);
        osc.connect(g);
        g.connect(this.filter);
        osc.start();
        osc.stop(this.ctx.currentTime + 1.9);
    }

    _bird() {
        const f = 880 + Math.random() * 520;
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(f * 1.25, this.ctx.currentTime + 0.12);
        osc.frequency.exponentialRampToValueAtTime(f * 0.85, this.ctx.currentTime + 0.28);
        const g = this.ctx.createGain();
        g.gain.value = 0.018;
        g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.32);
        osc.connect(g);
        g.connect(this.master);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.34);
    }

    chime() {
        if (!this._enabled) return;
        [0, 4, 7].forEach((n, i) => {
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = BASE * 2 * (2 ** (n / 12));
            const g = this.ctx.createGain();
            const t = this.ctx.currentTime + i * 0.12;
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(0.05, t + 0.04);
            g.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
            osc.connect(g);
            g.connect(this.filter);
            osc.start(t);
            osc.stop(t + 1.5);
        });
    }

    footstep() {
        if (!this._enabled) return;
        const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.08, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
        }
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'lowpass';
        bp.frequency.value = 280;
        const g = this.ctx.createGain();
        g.gain.value = 0.06;
        src.connect(bp);
        bp.connect(g);
        g.connect(this.master);
        src.start();
    }
}
