/**
 * Síntese das quatro vozes da esfera.
 * Reverb é um cluster de delays (sem IR externo).
 */

import { midiToFreq } from './config.js';

export class SphereAudio {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.volume = 0.78;
        this.started = false;
        this.muted = [false, false, false, false];
    }

    async resume() {
        if (!this.ctx) this.boot();
        if (this.ctx.state === 'suspended') await this.ctx.resume();
        this.started = true;
        if (this.droneGain && this.enabled) {
            const t = this.ctx.currentTime;
            this.droneGain.gain.setTargetAtTime(0.045, t, 1.2);
        }
    }

    boot() {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        this.ctx = ctx;

        this.master = ctx.createGain();
        this.master.gain.value = this.enabled ? this.volume : 0;

        this.voices = ctx.createGain();
        this.voices.gain.value = 0.9;

        this.dry = ctx.createGain();
        this.dry.gain.value = 0.62;
        this.wet = ctx.createGain();
        this.wet.gain.value = 0.48;

        this.voices.connect(this.dry);
        this.dry.connect(this.master);
        this.master.connect(ctx.destination);

        this._reverb(ctx);
        this.voices.connect(this.reverbIn);
        this.reverbOut.connect(this.wet);
        this.wet.connect(this.master);

        this._drone(ctx);
    }

    _reverb(ctx) {
        this.reverbIn = ctx.createGain();
        this.reverbOut = ctx.createGain();
        const times = [0.17, 0.26, 0.39, 0.53];
        const filters = [];
        times.forEach((delayTime, i) => {
            const d = ctx.createDelay(1.2);
            d.delayTime.value = delayTime;
            const fb = ctx.createGain();
            fb.gain.value = 0.38 - i * 0.04;
            const lp = ctx.createBiquadFilter();
            lp.type = 'lowpass';
            lp.frequency.value = 4200 - i * 500;
            this.reverbIn.connect(d);
            d.connect(lp);
            lp.connect(fb);
            fb.connect(d);
            lp.connect(this.reverbOut);
            filters.push(lp);
        });
        this._reverbFilters = filters;
    }

    _drone(ctx) {
        this.droneGain = ctx.createGain();
        this.droneGain.gain.value = 0;
        const a = ctx.createOscillator();
        const b = ctx.createOscillator();
        a.type = 'sine';
        b.type = 'sine';
        a.frequency.value = 110;
        b.frequency.value = 164.81;
        const ga = ctx.createGain();
        const gb = ctx.createGain();
        ga.gain.value = 0.55;
        gb.gain.value = 0.28;
        a.connect(ga);
        b.connect(gb);
        ga.connect(this.droneGain);
        gb.connect(this.droneGain);
        this.droneGain.connect(this.master);
        a.start();
        b.start();
        this.droneA = a;
        this.droneB = b;
    }

    setEnabled(on) {
        this.enabled = on;
        if (!this.master || !this.ctx) return;
        const t = this.ctx.currentTime;
        this.master.gain.setTargetAtTime(on ? this.volume : 0, t, 0.06);
        if (on && this.ctx.state === 'suspended') this.ctx.resume();
    }

    setVolume(v) {
        this.volume = v;
        if (this.master && this.enabled) {
            this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
        }
    }

    setMuteRing(index, muted) {
        this.muted[index] = muted;
    }

    setDroneRoot(midiRoot) {
        if (!this.droneA) return;
        const t = this.ctx.currentTime;
        const f = midiToFreq(33 + (midiRoot % 12));
        this.droneA.frequency.setTargetAtTime(f, t, 0.4);
        this.droneB.frequency.setTargetAtTime(f * 1.498, t, 0.4);
    }

    play(ringIndex, midi, velocity = 1) {
        if (!this.ctx || !this.enabled || !this.started) return;
        if (this.muted[ringIndex]) return;
        const t = this.ctx.currentTime;
        const freq = midiToFreq(midi);
        const v = Math.max(0.15, Math.min(1, velocity));
        if (ringIndex === 0) this._bass(freq, v, t);
        else if (ringIndex === 1) this._pad(freq, v, t);
        else if (ringIndex === 2) this._bell(freq, v, t);
        else this._air(freq, v, t);
    }

    _env(g, t, attack, decay, peak) {
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(peak, t + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    }

    _bass(freq, v, t) {
        const g = this.ctx.createGain();
        g.connect(this.voices);
        this._env(g, t, 0.012, 0.95, 0.28 * v);

        const sub = this.ctx.createOscillator();
        sub.type = 'sine';
        sub.frequency.value = freq * 0.5;
        const sg = this.ctx.createGain();
        sg.gain.value = 0.7;
        sub.connect(sg);
        sg.connect(g);

        const fund = this.ctx.createOscillator();
        fund.type = 'sine';
        fund.frequency.value = freq;
        fund.connect(g);

        const click = this.ctx.createOscillator();
        click.type = 'triangle';
        click.frequency.value = freq * 2;
        const cg = this.ctx.createGain();
        this._env(cg, t, 0.004, 0.07, 0.08 * v);
        click.connect(cg);
        cg.connect(this.voices);

        sub.start(t);
        fund.start(t);
        click.start(t);
        sub.stop(t + 1.1);
        fund.stop(t + 1.1);
        click.stop(t + 0.12);
    }

    _pad(freq, v, t) {
        const g = this.ctx.createGain();
        const lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(900, t);
        lp.frequency.exponentialRampToValueAtTime(2200, t + 0.18);
        lp.Q.value = 0.7;
        g.connect(lp);
        lp.connect(this.voices);
        this._env(g, t, 0.05, 1.35, 0.16 * v);

        [1, 1.003, 1.498].forEach((ratio, i) => {
            const o = this.ctx.createOscillator();
            o.type = i === 2 ? 'sine' : 'triangle';
            o.frequency.value = freq * ratio;
            const og = this.ctx.createGain();
            og.gain.value = i === 2 ? 0.28 : 0.42;
            o.connect(og);
            og.connect(g);
            o.start(t);
            o.stop(t + 1.55);
        });
    }

    _bell(freq, v, t) {
        const g = this.ctx.createGain();
        g.connect(this.voices);
        this._env(g, t, 0.008, 1.55, 0.2 * v);

        const car = this.ctx.createOscillator();
        const mod = this.ctx.createOscillator();
        const modG = this.ctx.createGain();
        car.type = 'sine';
        mod.type = 'sine';
        car.frequency.value = freq;
        mod.frequency.value = freq * 2.01;
        modG.gain.setValueAtTime(freq * 2.4, t);
        modG.gain.exponentialRampToValueAtTime(freq * 0.15, t + 0.7);
        mod.connect(modG);
        modG.connect(car.frequency);
        car.connect(g);

        const partial = this.ctx.createOscillator();
        partial.type = 'sine';
        partial.frequency.value = freq * 2.76;
        const pg = this.ctx.createGain();
        pg.gain.value = 0.18;
        partial.connect(pg);
        pg.connect(g);

        car.start(t);
        mod.start(t);
        partial.start(t);
        car.stop(t + 1.7);
        mod.stop(t + 1.7);
        partial.stop(t + 1.7);
    }

    _air(freq, v, t) {
        const g = this.ctx.createGain();
        g.connect(this.voices);
        this._env(g, t, 0.004, 0.85, 0.12 * v);

        const o = this.ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = freq;
        o.connect(g);
        o.start(t);
        o.stop(t + 1.0);

        const n = this.ctx.createBufferSource();
        const len = Math.ceil(this.ctx.sampleRate * 0.18);
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        n.buffer = buf;
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = Math.min(8000, freq * 3.2);
        bp.Q.value = 4;
        const ng = this.ctx.createGain();
        this._env(ng, t, 0.002, 0.16, 0.045 * v);
        n.connect(bp);
        bp.connect(ng);
        ng.connect(this.voices);
        n.start(t);
        n.stop(t + 0.2);
    }
}
