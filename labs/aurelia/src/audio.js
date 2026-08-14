/**
 * Motor sintético + rádio de festival (Web Audio, sem samples).
 */

import { RADIO } from './config.js';

function noiseBuffer(ctx, seconds = 1.5) {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.03 * white) / 1.03;
        data[i] = last * 3.2;
    }
    return buffer;
}

export class AudioEngine {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.volume = 0.72;
        this.started = false;
        this.station = 0;
        this.step = 0;
        this.acc = 0;
    }

    async start() {
        if (this.started) {
            if (this.ctx?.state === 'suspended') await this.ctx.resume();
            return;
        }
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        this.ctx = new Ctx({ latencyHint: 'interactive' });
        const ctx = this.ctx;
        this.started = true;

        this.master = ctx.createGain();
        this.master.gain.value = this.volume;
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -16;
        comp.ratio.value = 6;
        this.master.connect(comp).connect(ctx.destination);

        this.engineGain = ctx.createGain();
        this.engineGain.gain.value = 0;
        this.engineFilter = ctx.createBiquadFilter();
        this.engineFilter.type = 'lowpass';
        this.engineFilter.frequency.value = 900;
        this.engineGain.connect(this.engineFilter).connect(this.master);

        this.harmonics = [0.5, 1, 2, 3, 4.02].map((ratio, i) => {
            const osc = ctx.createOscillator();
            osc.type = i === 2 ? 'square' : 'sawtooth';
            const g = ctx.createGain();
            g.gain.value = [0.35, 1, 0.35, 0.16, 0.08][i];
            osc.connect(g).connect(this.engineGain);
            osc.start();
            return { osc, ratio };
        });

        this.wind = ctx.createBufferSource();
        this.wind.buffer = noiseBuffer(ctx);
        this.wind.loop = true;
        this.windGain = ctx.createGain();
        this.windGain.gain.value = 0;
        const windFilter = ctx.createBiquadFilter();
        windFilter.type = 'bandpass';
        windFilter.frequency.value = 800;
        this.wind.connect(windFilter).connect(this.windGain).connect(this.master);
        this.wind.start();

        this.music = ctx.createGain();
        this.music.gain.value = 0.22;
        this.music.connect(this.master);
    }

    setVolume(v) {
        this.volume = v;
        if (this.master) this.master.gain.value = this.enabled ? v : 0;
    }

    setEnabled(on) {
        this.enabled = on;
        if (this.master) this.master.gain.value = on ? this.volume : 0;
    }

    cycleStation() {
        this.station = (this.station + 1) % RADIO.length;
        return RADIO[this.station];
    }

    update(dt, vehicle) {
        if (!this.ctx || !this.enabled || !this.started) return;
        const rpm = vehicle.rpm || 900;
        const speed = vehicle.speed || 0;
        const throttle = vehicle.throttle || 0;
        const fund = (rpm / 60) * 2.2;

        for (const h of this.harmonics) {
            h.osc.frequency.setTargetAtTime(fund * h.ratio, this.ctx.currentTime, 0.04);
        }
        this.engineFilter.frequency.setTargetAtTime(700 + throttle * 2800 + rpm * 0.12, this.ctx.currentTime, 0.05);
        this.engineGain.gain.setTargetAtTime(0.04 + throttle * 0.22 + speed * 0.0015, this.ctx.currentTime, 0.05);
        this.windGain.gain.setTargetAtTime(Math.min(0.12, speed * 0.0018), this.ctx.currentTime, 0.08);

        const bpm = RADIO[this.station].bpm;
        const stepDur = 60 / bpm / 4;
        this.acc += dt;
        while (this.acc >= stepDur) {
            this.acc -= stepDur;
            this.tick(this.step);
            this.step = (this.step + 1) % 16;
        }
    }

    tick(step) {
        const ctx = this.ctx;
        const t = ctx.currentTime;
        const station = this.station;
        if (step % 4 === 0) this.hit(t, 55, 0.09, 'sine');
        if (step % 4 === 2) this.noiseHit(t, 0.04);
        if (step % 2 === 0) this.hat(t, 0.012);

        const scale = station === 2
            ? [220, 247, 262, 294]
            : station === 3
                ? [196, 233, 262, 311]
                : [220, 261, 329, 392];
        const note = scale[(step * (station + 1)) % scale.length];
        if (step % 2 === 0) this.hit(t, note, 0.05, station === 1 ? 'square' : 'triangle');
        if (station === 1 && step % 4 === 1) this.hit(t, note * 1.5, 0.03, 'sawtooth');
    }

    hit(time, freq, dur, type) {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0.18, time);
        g.gain.exponentialRampToValueAtTime(0.001, time + dur);
        osc.connect(g).connect(this.music);
        osc.start(time);
        osc.stop(time + dur + 0.02);
    }

    hat(time, dur) {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = 9000;
        g.gain.setValueAtTime(0.03, time);
        g.gain.exponentialRampToValueAtTime(0.001, time + dur);
        const f = this.ctx.createBiquadFilter();
        f.type = 'highpass';
        f.frequency.value = 6000;
        osc.connect(f).connect(g).connect(this.music);
        osc.start(time);
        osc.stop(time + dur + 0.01);
    }

    noiseHit(time, dur) {
        const src = this.ctx.createBufferSource();
        src.buffer = this.wind.buffer;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.12, time);
        g.gain.exponentialRampToValueAtTime(0.001, time + dur);
        src.connect(g).connect(this.music);
        src.start(time);
        src.stop(time + dur);
    }
}
