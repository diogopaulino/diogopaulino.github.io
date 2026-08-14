/**
 * Pad submarino em ré menor, bolhas, impulso e sinos de pérola.
 * Só Web Audio — nenhum sample externo.
 */

export class GameAudio {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.volume = 0.7;
        this.master = null;
        this.music = null;
        this.started = false;
        this.step = 0;
        this.acc = 0;
        this.bpm = 72;
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
        this.music.gain.value = 0.38;
        this.music.connect(this.master);

        const noiseBuf = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
        const data = noiseBuf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const water = this.ctx.createBufferSource();
        water.buffer = noiseBuf;
        water.loop = true;
        const hp = this.ctx.createBiquadFilter();
        hp.type = 'bandpass';
        hp.frequency.value = 420;
        hp.Q.value = 0.35;
        this.waterGain = this.ctx.createGain();
        this.waterGain.gain.value = 0.055;
        water.connect(hp);
        hp.connect(this.waterGain);
        this.waterGain.connect(this.master);
        water.start();

        this.whoosh = this.ctx.createOscillator();
        this.whoosh.type = 'sawtooth';
        this.whoosh.frequency.value = 48;
        this.whooshGain = this.ctx.createGain();
        this.whooshGain.gain.value = 0;
        const lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 280;
        this.whoosh.connect(lp);
        lp.connect(this.whooshGain);
        this.whooshGain.connect(this.master);
        this.whoosh.start();
    }

    setVolume(v) {
        this.volume = v;
        if (this.master) this.master.gain.value = this.enabled ? v : 0;
    }

    setEnabled(on) {
        this.enabled = on;
        if (this.master) this.master.gain.value = on ? this.volume : 0;
    }

    blip(freq, dur, type = 'sine', gain = 0.12) {
        if (!this.ctx || !this.enabled || !this.started) return;
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.6), t + dur);
        g.gain.setValueAtTime(gain, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(g);
        g.connect(this.master);
        o.start(t);
        o.stop(t + dur + 0.02);
    }

    pearl(combo = 1) {
        const base = 392 * Math.pow(2, (combo % 8) / 12);
        this.blip(base, 0.22, 'sine', 0.11);
        this.blip(base * 1.5, 0.28, 'triangle', 0.06);
    }

    ring(combo = 1) {
        this.blip(523 * (1 + combo * 0.03), 0.18, 'sine', 0.1);
        this.blip(784, 0.32, 'triangle', 0.05);
    }

    boostOn() {
        this.blip(180, 0.2, 'sawtooth', 0.06);
    }

    hit() {
        this.blip(90, 0.35, 'square', 0.1);
        this.blip(40, 0.4, 'sawtooth', 0.07);
    }

    roll() {
        this.blip(220, 0.16, 'triangle', 0.07);
        this.blip(440, 0.22, 'sine', 0.05);
    }

    win() {
        [523, 659, 784, 1046].forEach((f, i) => {
            setTimeout(() => this.blip(f, 0.45, 'sine', 0.1), i * 140);
        });
    }

    setWhoosh(amount) {
        if (!this.whooshGain) return;
        this.whooshGain.gain.value = amount * 0.08;
        this.whoosh.frequency.value = 40 + amount * 70;
    }

    update(dt) {
        if (!this.ctx || !this.enabled || !this.started || !this.music) return;
        this.acc += dt;
        const beat = 60 / this.bpm;
        if (this.acc < beat) return;
        this.acc -= beat;
        this.step++;

        const t = this.ctx.currentTime;
        const scale = [146.83, 174.61, 196, 220, 261.63, 293.66];
        const note = scale[this.step % scale.length];
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        const f = this.ctx.createBiquadFilter();
        o.type = this.step % 4 === 0 ? 'sine' : 'triangle';
        o.frequency.value = note / (this.step % 8 === 0 ? 1 : 2);
        f.type = 'lowpass';
        f.frequency.value = 720;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.045, t + 0.04);
        g.gain.exponentialRampToValueAtTime(0.0001, t + beat * 2.4);
        o.connect(f);
        f.connect(g);
        g.connect(this.music);
        o.start(t);
        o.stop(t + beat * 2.6);
    }
}
