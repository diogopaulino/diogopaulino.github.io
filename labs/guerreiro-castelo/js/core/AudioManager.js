/**
 * Áudio procedural via Web Audio API puro — sem dependência de engine gráfica.
 * Temas musicais dinâmicos por estágio, SFX táteis, passos e áudio posicional.
 */

import { clamp } from '../utils/math.js';

const THEMES = {
    home: { base: 196, mode: [0, 2, 4, 7, 9], tempo: 0.55, filter: 700, drone: 98 },
    sea: { base: 147, mode: [0, 2, 4, 7, 11], tempo: 0.7, filter: 900, drone: 73 },
    storm: { base: 98, mode: [0, 3, 5, 6, 10], tempo: 0.38, filter: 320, drone: 49 },
    land: { base: 174, mode: [0, 2, 3, 7, 9], tempo: 0.62, filter: 800, drone: 87 },
    castle: { base: 130, mode: [0, 3, 5, 7, 10], tempo: 0.48, filter: 420, drone: 65 },
    stealth: { base: 110, mode: [0, 1, 4, 5, 8], tempo: 0.4, filter: 280, drone: 55 },
    tiger: { base: 82, mode: [0, 3, 6, 7, 10], tempo: 0.42, filter: 360, drone: 41 },
    chase: { base: 196, mode: [0, 2, 3, 7, 10], tempo: 1.15, filter: 1400, drone: 98 },
    calm: { base: 220, mode: [0, 2, 4, 5, 7, 9], tempo: 0.5, filter: 1100, drone: 110 },
    ending: { base: 196, mode: [0, 2, 4, 7, 9], tempo: 0.48, filter: 900, drone: 98 }
};

export class AudioManager {
    constructor() {
        this.ctx = null;
        this.master = null;
        this.buses = {};
        this.muted = false;
        this.volume = { master: 0.75, music: 0.55, ambient: 0.45, sfx: 0.8, dialogue: 0.9 };
        this.theme = 'home';
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
        this.master.gain.value = this.muted ? 0 : this.volume.master;
        this.master.connect(this.ctx.destination);

        for (const name of ['music', 'ambient', 'sfx', 'dialogue']) {
            const g = this.ctx.createGain();
            g.gain.value = this.volume[name];
            g.connect(this.master);
            this.buses[name] = g;
        }

        this.filter = this.ctx.createBiquadFilter();
        this.filter.type = 'lowpass';
        this.filter.frequency.value = 700;
        this.filter.connect(this.buses.music);

        this.delay = this.ctx.createDelay();
        this.delay.delayTime.value = 0.32;
        const fb = this.ctx.createGain();
        fb.gain.value = 0.18;
        this.filter.connect(this.delay);
        this.delay.connect(fb);
        fb.connect(this.delay);
        this.delay.connect(this.buses.music);

        this._startDrone();
        this._enabled = true;
    }

    attach() {
        // Nativo Web Audio Listener
    }

    setMuted(muted) {
        this.muted = muted;
        if (this.master && this.ctx) {
            this.master.gain.setTargetAtTime(muted ? 0 : this.volume.master, this.ctx.currentTime, 0.05);
        }
    }

    setBusVolume(bus, value) {
        this.volume[bus] = clamp(value, 0, 1);
        const node = bus === 'master' ? this.master : this.buses[bus];
        if (node && this.ctx) {
            const v = bus === 'master' && this.muted ? 0 : this.volume[bus];
            node.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
        }
    }

    setTheme(id) {
        this.theme = THEMES[id] ? id : 'home';
        const t = THEMES[this.theme];
        if (this.filter && this.ctx) {
            this.filter.frequency.setTargetAtTime(t.filter, this.ctx.currentTime, 0.5);
        }
        if (this.droneOsc && this.ctx) {
            this.droneOsc.frequency.setTargetAtTime(t.drone, this.ctx.currentTime, 0.9);
            this.droneOsc2.frequency.setTargetAtTime(t.drone * 1.5, this.ctx.currentTime, 0.9);
        }
    }

    _startDrone() {
        const t = THEMES[this.theme];
        this.droneOsc = this.ctx.createOscillator();
        this.droneOsc.type = 'sine';
        this.droneOsc.frequency.value = t.drone;
        this.droneGain = this.ctx.createGain();
        this.droneGain.gain.value = 0.045;
        this.droneOsc.connect(this.droneGain).connect(this.filter);
        this.droneOsc.start();

        this.droneOsc2 = this.ctx.createOscillator();
        this.droneOsc2.type = 'triangle';
        this.droneOsc2.frequency.value = t.drone * 1.5;
        const g2 = this.ctx.createGain();
        g2.gain.value = 0.02;
        this.droneOsc2.connect(g2).connect(this.filter);
        this.droneOsc2.start();
    }

    update(dt) {
        if (!this._enabled || this.muted) return;
        this._t += dt;
        const theme = THEMES[this.theme];
        this._step += dt * theme.tempo;
        if (this._step > 1) {
            this._step -= 1;
            this._note(theme);
        }
    }

    _note(theme) {
        const osc = this.ctx.createOscillator();
        osc.type = this.theme === 'chase' ? 'sawtooth' : 'sine';
        const deg = theme.mode[(Math.random() * theme.mode.length) | 0];
        osc.frequency.value = theme.base * Math.pow(2, deg / 12);
        const g = this.ctx.createGain();
        g.gain.value = 0.04;
        g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 1.4);
        osc.connect(g).connect(this.filter);
        osc.start();
        osc.stop(this.ctx.currentTime + 1.5);
    }

    tone(freq, dur = 0.2, type = 'sine', gain = 0.12, bus = 'sfx') {
        if (!this._enabled || this.muted || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        osc.type = type;
        osc.frequency.value = freq;
        const g = this.ctx.createGain();
        g.gain.value = gain;
        g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + dur);
        osc.connect(g).connect(this.buses[bus] || this.buses.sfx);
        osc.start();
        osc.stop(this.ctx.currentTime + dur + 0.05);
    }

    noise(dur = 0.3, gain = 0.08, bus = 'sfx') {
        if (!this._enabled || this.muted || !this.ctx) return;
        const n = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
        const data = n.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const src = this.ctx.createBufferSource();
        src.buffer = n;
        const g = this.ctx.createGain();
        g.gain.value = gain;
        g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + dur);
        const f = this.ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = 800;
        src.connect(f).connect(g).connect(this.buses[bus] || this.buses.sfx);
        src.start();
    }

    play(name) {
        switch (name) {
            case 'interact': this.tone(520, 0.12, 'triangle', 0.08); break;
            case 'pickup': this.tone(880, 0.18, 'sine', 0.1); this.tone(1320, 0.22, 'sine', 0.05); break;
            case 'fail': this.tone(140, 0.35, 'sawtooth', 0.07); break;
            case 'success': this.tone(523, 0.2, 'sine', 0.08); this.tone(784, 0.28, 'sine', 0.06); break;
            case 'click': this.tone(2400, 0.06, 'square', 0.03); break;
            case 'clink': this.tone(1800, 0.08, 'triangle', 0.06); this.tone(2400, 0.1, 'sine', 0.04); break;
            case 'door': this.noise(0.4, 0.06); this.tone(90, 0.4, 'sine', 0.08); break;
            case 'thunder': this.noise(1.4, 0.22, 'ambient'); this.tone(48, 1.6, 'sawtooth', 0.08, 'ambient'); break;
            case 'hit': this.noise(0.12, 0.1); this.tone(90, 0.12, 'square', 0.08); break;
            case 'block': this.tone(200, 0.1, 'square', 0.07); break;
            case 'bell': this.tone(620, 1.8, 'sine', 0.12, 'ambient'); this.tone(930, 1.8, 'sine', 0.06, 'ambient'); break;
            case 'growl': this.tone(70, 0.6, 'sawtooth', 0.1); this.noise(0.5, 0.08); break;
            case 'fire': this.noise(0.3, 0.03, 'ambient'); break;
            case 'arrow': this.noise(0.08, 0.05); this.tone(1400, 0.08, 'triangle', 0.04); break;
            case 'impact': this.noise(0.15, 0.08); this.tone(110, 0.15, 'sine', 0.08); break;
            case 'wave': this.noise(0.8, 0.05, 'ambient'); break;
            case 'snore': this.tone(90, 0.5, 'sine', 0.04, 'dialogue'); break;
            case 'speech': this.tone(180 + Math.random() * 80, 0.08, 'triangle', 0.03, 'dialogue'); break;
            default: this.tone(440, 0.1, 'sine', 0.05);
        }
    }

    footstep(crouch) {
        this.tone(crouch ? 70 : 95, 0.07, 'sine', crouch ? 0.03 : 0.05);
        this.noise(0.06, crouch ? 0.02 : 0.04);
    }
}
