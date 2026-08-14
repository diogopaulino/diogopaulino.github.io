/**
 * Trilha submarina procedural + SFX de pulso, coleta e impacto.
 * Osciladores nativos da Web Audio API — nenhuma amostra externa.
 *
 * Padrão: 72 BPM, dron em ré menor, harpa pentatônica, kick abafado.
 */

export class GameAudio {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.volume = 0.74;
        this.master = null;
        this.music = null;
        this.step = 0;
        this.acc = 0;
        this.bpm = 72;
        this.started = false;
        this.beatPulse = 0;
    }

    async resume() {
        if (!this.enabled) return;
        if (!this.ctx) this.boot();
        if (this.ctx.state === 'suspended') await this.ctx.resume();
        this.started = true;
    }

    boot() {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioCtx();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.volume;
        this.master.connect(this.ctx.destination);

        this.music = this.ctx.createGain();
        this.music.gain.value = 0.48;
        this.music.connect(this.master);

        this.amb = this.ctx.createOscillator();
        this.amb.type = 'sine';
        this.amb.frequency.value = 55;
        this.ambGain = this.ctx.createGain();
        this.ambGain.gain.value = 0.12;
        const ambF = this.ctx.createBiquadFilter();
        ambF.type = 'lowpass';
        ambF.frequency.value = 240;
        this.amb.connect(ambF);
        ambF.connect(this.ambGain);
        this.ambGain.connect(this.music);
        this.amb.start();

        this.noise = this._noise();
        this.noiseGain = this.ctx.createGain();
        this.noiseGain.gain.value = 0.03;
        const nf = this.ctx.createBiquadFilter();
        nf.type = 'bandpass';
        nf.frequency.value = 680;
        nf.Q.value = 0.6;
        this.noise.connect(nf);
        nf.connect(this.noiseGain);
        this.noiseGain.connect(this.music);
    }

    _noise() {
        const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        src.start();
        return src;
    }

    setVolume(v) {
        this.volume = v;
        if (this.master) this.master.gain.value = this.enabled ? v : 0;
    }

    setEnabled(on) {
        this.enabled = on;
        if (this.master) this.master.gain.value = on ? this.volume : 0;
    }

    /** Distância ao próximo beat (0 = exatamente no pulso). */
    beatError() {
        const stepDur = 60 / this.bpm / 2;
        const t = this.acc;
        return Math.min(t, stepDur - t);
    }

    onBeatWindow() {
        return this.beatError() < 0.09;
    }

    update(dt, speed, pulsing) {
        if (!this.ctx || !this.enabled || !this.started) return;
        const stepDur = 60 / this.bpm / 2;
        this.acc += dt;
        this.beatPulse = Math.max(0, this.beatPulse - dt);
        while (this.acc >= stepDur) {
            this.acc -= stepDur;
            this.tick(this.step);
            this.step = (this.step + 1) % 8;
            this.beatPulse = 0.12;
        }
        if (this.amb) {
            this.amb.frequency.value = 48 + speed * 0.35;
            this.ambGain.gain.value = 0.1 + (pulsing ? 0.06 : 0);
        }
    }

    tick(step) {
        const t = this.ctx.currentTime;
        if (step % 2 === 0) this._kick(t);
        if (step === 2 || step === 6) this._pad(t, step === 6 ? 196 : 146.83);
        if (step === 1 || step === 5) this._harp(t, [220, 261.63, 293.66, 329.63][step % 4]);
    }

    _kick(time) {
        this._tone(time, { freq: 90, endFreq: 38, duration: 0.28, gain: 0.16, type: 'sine' });
    }

    _pad(time, freq) {
        this._tone(time, { freq, endFreq: freq * 0.99, duration: 1.4, gain: 0.05, type: 'triangle' });
        this._tone(time, { freq: freq * 1.5, duration: 1.2, gain: 0.03, type: 'sine' });
    }

    _harp(time, freq) {
        this._tone(time, { freq, endFreq: freq * 1.02, duration: 0.55, gain: 0.045, type: 'sine' });
    }

    _tone(time, { freq, endFreq, duration, gain, type = 'sine' }) {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, time);
        if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), time + duration);
        g.gain.setValueAtTime(0.0001, time);
        g.gain.exponentialRampToValueAtTime(gain, time + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, time + duration);
        osc.connect(g);
        g.connect(this.music);
        osc.start(time);
        osc.stop(time + duration + 0.02);
    }

    _noiseBurst({ duration = 0.2, freq = 900, gain = 0.1 } = {}) {
        if (!this.ctx || !this.enabled) return;
        const t = this.ctx.currentTime;
        const src = this.ctx.createBufferSource();
        if (!this._nbuf) {
            const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.4, this.ctx.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
            this._nbuf = buf;
        }
        src.buffer = this._nbuf;
        const f = this.ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = freq;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(gain, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
        src.connect(f);
        f.connect(g);
        g.connect(this.master);
        src.start(t);
        src.stop(t + duration);
    }

    pulse(onBeat) {
        this._noiseBurst({ duration: 0.22, freq: onBeat ? 1400 : 700, gain: onBeat ? 0.12 : 0.08 });
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this._tone(t, { freq: onBeat ? 523 : 196, endFreq: 80, duration: 0.32, gain: 0.09, type: 'sine' });
        if (onBeat) this._tone(t, { freq: 784, duration: 0.22, gain: 0.05, type: 'triangle' });
    }

    collect(relic) {
        if (!this.ctx || !this.enabled) return;
        const t = this.ctx.currentTime;
        const f = relic ? 880 : 659.25;
        this._tone(t, { freq: f, duration: 0.22, gain: 0.08, type: 'sine' });
        this._tone(t, { freq: f * 1.5, duration: 0.28, gain: 0.04, type: 'triangle' });
    }

    ring() {
        if (!this.ctx || !this.enabled) return;
        const t = this.ctx.currentTime;
        this._tone(t, { freq: 392, duration: 0.4, gain: 0.08, type: 'sine' });
        this._tone(t, { freq: 588, duration: 0.45, gain: 0.05, type: 'triangle' });
        this._tone(t, { freq: 784, duration: 0.5, gain: 0.04, type: 'sine' });
    }

    hit() {
        this._noiseBurst({ duration: 0.28, freq: 180, gain: 0.16 });
        if (!this.ctx) return;
        this._tone(this.ctx.currentTime, { freq: 90, endFreq: 40, duration: 0.35, gain: 0.14, type: 'sawtooth' });
    }

    current() {
        if (!this.ctx || !this.enabled) return;
        this._tone(this.ctx.currentTime, { freq: 174, duration: 0.18, gain: 0.03, type: 'sine' });
    }
}
