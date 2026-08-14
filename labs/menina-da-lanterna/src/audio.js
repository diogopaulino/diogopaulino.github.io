/**
 * Trilha e efeitos — Web Audio original (canção de ninar da Nara).
 */

import { clamp } from './utils.js';

const THEMES = {
    aldeia: { base: 196, mode: [0, 2, 4, 7, 9], tempo: 1.05, filter: 980, drone: 98 },
    trilha: { base: 110, mode: [0, 3, 5, 7, 10], tempo: 0.62, filter: 380, drone: 55 },
    rio: { base: 174, mode: [0, 2, 3, 7, 10], tempo: 0.88, filter: 720, drone: 87 },
    arvore: { base: 82, mode: [0, 3, 5, 6, 10], tempo: 0.48, filter: 260, drone: 41 },
    alvorecer: { base: 262, mode: [0, 2, 4, 5, 7, 9], tempo: 0.78, filter: 1600, drone: 131 }
};

export class GameAudio {
    constructor() {
        this.ctx = null;
        this.master = null;
        this.muted = false;
        this.volume = 0.7;
        this.theme = 'aldeia';
        this._t = 0;
        this._step = 0;
        this._enabled = false;
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
        this.filter.frequency.value = 980;
        this.filter.connect(this.master);

        this.delay = this.ctx.createDelay();
        this.delay.delayTime.value = 0.32;
        const fb = this.ctx.createGain();
        fb.gain.value = 0.26;
        this.filter.connect(this.delay);
        this.delay.connect(fb);
        fb.connect(this.delay);
        this.delay.connect(this.master);

        this._startDrone();
        this._enabled = true;
    }

    setMuted(muted) {
        this.muted = muted;
        if (this.master) this.master.gain.setTargetAtTime(muted ? 0 : this.volume, this.ctx.currentTime, 0.05);
    }

    setVolume(v) {
        this.volume = clamp(v, 0, 1);
        if (!this.muted && this.master) this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    }

    setTheme(id) {
        this.theme = THEMES[id] ? id : 'aldeia';
        const t = THEMES[this.theme];
        if (this.filter) this.filter.frequency.setTargetAtTime(t.filter, this.ctx?.currentTime ?? 0, 0.4);
        if (this.droneOsc) {
            this.droneOsc.frequency.setTargetAtTime(t.drone, this.ctx.currentTime, 0.8);
            this.droneOsc2.frequency.setTargetAtTime(t.drone * 1.5, this.ctx.currentTime, 0.8);
        }
    }

    _startDrone() {
        const t = THEMES[this.theme];
        this.droneOsc = this.ctx.createOscillator();
        this.droneOsc.type = 'sine';
        this.droneOsc.frequency.value = t.drone;
        this.droneGain = this.ctx.createGain();
        this.droneGain.gain.value = 0.065;
        this.droneOsc.connect(this.droneGain).connect(this.filter);
        this.droneOsc.start();

        this.droneOsc2 = this.ctx.createOscillator();
        this.droneOsc2.type = 'triangle';
        this.droneOsc2.frequency.value = t.drone * 1.5;
        const g2 = this.ctx.createGain();
        g2.gain.value = 0.028;
        this.droneOsc2.connect(g2).connect(this.filter);
        this.droneOsc2.start();
    }

    update(dt) {
        if (!this._enabled || this.muted) return;
        const theme = THEMES[this.theme];
        this._t += dt;
        this._step += dt;
        if (this._step >= theme.tempo) {
            this._step -= theme.tempo;
            if (Math.random() > 0.32) this._note(theme);
        }
    }

    _note(theme) {
        const now = this.ctx.currentTime;
        const deg = theme.mode[(Math.random() * theme.mode.length) | 0];
        const oct = Math.random() > 0.72 ? 2 : 1;
        const freq = theme.base * oct * Math.pow(2, deg / 12);
        const osc = this.ctx.createOscillator();
        osc.type = this.theme === 'alvorecer' || this.theme === 'aldeia' ? 'sine' : 'triangle';
        osc.frequency.value = freq;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(this.theme === 'arvore' ? 0.045 : 0.07, now + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 1.55);
        osc.connect(g).connect(this.filter);
        osc.start(now);
        osc.stop(now + 1.6);
    }

    footstep() {
        if (!this._enabled || this.muted) return;
        const now = this.ctx.currentTime;
        const buf = this.ctx.createBuffer(1, 1800, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 420;
        const g = this.ctx.createGain();
        g.gain.value = 0.1;
        src.connect(f).connect(g).connect(this.master);
        src.start(now);
    }

    pickup() {
        this._chime([523, 659, 784], 0.11);
    }

    chime() {
        this._chime([392, 523, 659], 0.09);
    }

    lamp() {
        this._chime([330, 494, 660, 880], 0.08);
    }

    flash() {
        if (!this._enabled || this.muted) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.18);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.12, now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
        osc.connect(g).connect(this.filter);
        osc.start(now);
        osc.stop(now + 0.5);
    }

    danger() {
        if (!this._enabled || this.muted) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(70, now);
        osc.frequency.linearRampToValueAtTime(32, now + 0.7);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.11, now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
        osc.connect(g).connect(this.filter);
        osc.start(now);
        osc.stop(now + 0.85);
    }

    hit() {
        if (!this._enabled || this.muted) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.value = 110;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.09, now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
        osc.connect(g).connect(this.master);
        osc.start(now);
        osc.stop(now + 0.18);
    }

    wrong() {
        this._chime([196, 165], 0.1);
    }

    dawn() {
        this._chime([262, 330, 392, 523, 659, 784], 0.1);
    }

    _chime(freqs, gain) {
        if (!this._enabled || this.muted) return;
        const now = this.ctx.currentTime;
        freqs.forEach((f, i) => {
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = f;
            const g = this.ctx.createGain();
            const t = now + i * 0.07;
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(gain, t + 0.03);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
            osc.connect(g).connect(this.filter);
            osc.start(t);
            osc.stop(t + 0.6);
        });
    }
}
