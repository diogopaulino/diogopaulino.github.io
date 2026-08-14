/**
 * Trilha e efeitos — Web Audio original (conto, não trilha comercial).
 *
 * Temas:
 * cottage — pentatônica alegre, flauta imaginária
 * fair — mercado, notas mais rápidas
 * night — lua, filtro fechado, droninho
 * castle — grave, harpa pontual
 * escape — perseguição, tempo alto
 */

import { clamp } from './utils.js';

const THEMES = {
    cottage: { base: 196, mode: [0, 2, 4, 7, 9], tempo: 0.85, filter: 1100, drone: 98, wave: 'triangle' },
    fair: { base: 262, mode: [0, 2, 4, 5, 7, 9], tempo: 0.55, filter: 1600, drone: 131, wave: 'triangle' },
    night: { base: 147, mode: [0, 3, 5, 7, 10], tempo: 1.15, filter: 520, drone: 73.5, wave: 'sine' },
    castle: { base: 110, mode: [0, 3, 5, 7, 10], tempo: 0.9, filter: 380, drone: 55, wave: 'sawtooth' },
    escape: { base: 165, mode: [0, 2, 3, 7, 10], tempo: 0.38, filter: 900, drone: 82.5, wave: 'sawtooth' }
};

export class GameAudio {
    constructor() {
        this.ctx = null;
        this.master = null;
        this.muted = false;
        this.volume = 0.7;
        this.theme = 'cottage';
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
        this.filter.frequency.value = 1100;
        this.filter.connect(this.master);

        this.delay = this.ctx.createDelay();
        this.delay.delayTime.value = 0.26;
        const fb = this.ctx.createGain();
        fb.gain.value = 0.2;
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
        this.theme = THEMES[id] ? id : 'cottage';
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
        if (this.theme === 'escape' && Math.random() < dt * 0.55) this._drum();
        if (this.theme === 'castle' && Math.random() < dt * 0.12) this._snore();
    }

    _note(theme) {
        const now = this.ctx.currentTime;
        const deg = theme.mode[(Math.random() * theme.mode.length) | 0];
        const oct = Math.random() > 0.7 ? 2 : 1;
        const freq = theme.base * oct * Math.pow(2, deg / 12);
        const osc = this.ctx.createOscillator();
        osc.type = theme.wave;
        osc.frequency.value = freq;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(this.theme === 'castle' ? 0.045 : 0.07, now + 0.04);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 1.35);
        osc.connect(g).connect(this.filter);
        osc.start(now);
        osc.stop(now + 1.45);
    }

    _drum() {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(110, now);
        osc.frequency.exponentialRampToValueAtTime(32, now + 0.22);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.16, now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
        osc.connect(g).connect(this.master);
        osc.start(now);
        osc.stop(now + 0.34);
    }

    _snore() {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(90, now);
        osc.frequency.linearRampToValueAtTime(55, now + 0.7);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.05, now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
        osc.connect(g).connect(this.filter);
        osc.start(now);
        osc.stop(now + 0.85);
    }

    footstep() {
        if (!this._enabled || this.muted) return;
        const now = this.ctx.currentTime;
        const buf = this.ctx.createBuffer(1, 2200, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 480;
        const g = this.ctx.createGain();
        g.gain.value = 0.11;
        src.connect(f).connect(g).connect(this.master);
        src.start(now);
    }

    pickup() {
        this._chime([523, 659, 784, 1046], 0.11);
    }

    chime() {
        this._chime([392, 523, 659], 0.1);
    }

    harp() {
        this._chime([330, 392, 494, 587, 740], 0.09);
    }

    beans() {
        this._chime([698, 880, 1046], 0.12);
    }

    grow() {
        if (!this._enabled || this.muted) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(110, now);
        osc.frequency.exponentialRampToValueAtTime(440, now + 2.4);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(0.08, now + 0.3);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 2.6);
        osc.connect(g).connect(this.filter);
        osc.start(now);
        osc.stop(now + 2.7);
    }

    chop() {
        if (!this._enabled || this.muted) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.value = 90;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.14, now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
        osc.connect(g).connect(this.master);
        osc.start(now);
        osc.stop(now + 0.2);
    }

    danger() {
        if (!this._enabled || this.muted) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(90, now);
        osc.frequency.linearRampToValueAtTime(38, now + 0.85);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.13, now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.95);
        osc.connect(g).connect(this.filter);
        osc.start(now);
        osc.stop(now + 1);
    }

    roar() {
        if (!this._enabled || this.muted) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(70, now);
        osc.frequency.linearRampToValueAtTime(32, now + 1.5);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.18, now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 1.7);
        osc.connect(g).connect(this.filter);
        osc.start(now);
        osc.stop(now + 1.8);
    }

    moo() {
        if (!this._enabled || this.muted) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.linearRampToValueAtTime(120, now + 0.35);
        osc.frequency.linearRampToValueAtTime(150, now + 0.7);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.09, now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);
        osc.connect(g).connect(this.filter);
        osc.start(now);
        osc.stop(now + 0.9);
    }

    crash() {
        if (!this._enabled || this.muted) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(55, now);
        osc.frequency.exponentialRampToValueAtTime(18, now + 1.1);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.22, now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
        osc.connect(g).connect(this.master);
        osc.start(now);
        osc.stop(now + 1.25);
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
            g.gain.exponentialRampToValueAtTime(0.0001, t + 0.48);
            osc.connect(g).connect(this.filter);
            osc.start(t);
            osc.stop(t + 0.52);
        });
    }
}
