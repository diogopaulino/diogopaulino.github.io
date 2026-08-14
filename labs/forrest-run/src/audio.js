/**
 * Trilha americana procedural + passadas, vento, chuva e SFX.
 * Osciladores nativos da Web Audio API — nenhuma amostra externa.
 *
 * Padrão: ~76 BPM, pentatônica de Sol (G A B D E), baixo em oitava grave.
 * Passada: click filtrado sincronizado com o ciclo de corrida (½ período).
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
        this.bpm = 76;
        this.footAcc = 0;
        this.raining = false;
        this.wind = null;
        this.rainNode = null;
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
        this.music.gain.value = 0.42;
        this.music.connect(this.master);

        this.wind = this.noise(0.04, 700, 'lowpass');
        this.rainNode = this.noise(0.0, 4200, 'highpass');
    }

    noise(gain, cutoff, type) {
        const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const src = this.ctx.createBufferSource();
        src.buffer = buffer;
        src.loop = true;
        const f = this.ctx.createBiquadFilter();
        f.type = type;
        f.frequency.value = cutoff;
        const g = this.ctx.createGain();
        g.gain.value = gain;
        src.connect(f);
        f.connect(g);
        g.connect(this.master);
        src.start();
        return g;
    }

    setVolume(v) {
        this.volume = v;
        if (this.master) this.master.gain.value = this.enabled ? v : 0;
    }

    setEnabled(on) {
        this.enabled = on;
        if (this.master) this.master.gain.value = on ? this.volume : 0;
    }

    setRain(on) {
        this.raining = on;
        if (this.rainNode) this.rainNode.gain.value = on ? 0.045 : 0;
        if (this.wind) this.wind.gain.value = on ? 0.02 : 0.04;
    }

    update(dt, speed, grounded) {
        if (!this.ctx || !this.enabled || !this.started) return;
        const stepDur = 60 / this.bpm / 2;
        this.acc += dt;
        while (this.acc >= stepDur) {
            this.acc -= stepDur;
            this.tick(this.step);
            this.step = (this.step + 1) % 16;
        }
        if (grounded && speed > 4) {
            const stride = 0.42 * (11.5 / Math.max(8, speed));
            this.footAcc += dt;
            if (this.footAcc >= stride) {
                this.footAcc = 0;
                this.foot();
            }
        }
    }

    tick(step) {
        const t = this.ctx.currentTime;
        const pent = [43, 43, 47, 50, 43, 52, 47, 50];
        const bass = pent[Math.floor(step / 2) % pent.length];
        if (step % 2 === 0) this.note(this.mtof(bass), 0.35, 0.06, 'triangle', 480, t);
        if (step % 4 === 0) this.pluck(this.mtof(bass + 12), t);
        if (step === 6 || step === 14) this.pluck(this.mtof(bass + 16), t);
        if (step % 8 === 4) this.pluck(this.mtof(bass + 19), t);
    }

    mtof(m) {
        return 440 * 2 ** ((m - 69) / 12);
    }

    note(freq, dur, gain, type, cutoff, t) {
        const osc = this.ctx.createOscillator();
        osc.type = type;
        osc.frequency.value = freq;
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = cutoff;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(f);
        f.connect(g);
        g.connect(this.music);
        osc.start(t);
        osc.stop(t + dur + 0.02);
    }

    pluck(freq, t) {
        this.note(freq, 0.55, 0.045, 'sawtooth', 1400, t);
    }

    foot() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(90, t);
        o.frequency.exponentialRampToValueAtTime(40, t + 0.06);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.08, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
        o.connect(g);
        g.connect(this.master);
        o.start(t);
        o.stop(t + 0.09);
    }

    collect() {
        if (!this.ctx || !this.enabled) return;
        const t = this.ctx.currentTime;
        this.note(880, 0.18, 0.07, 'sine', 2400, t);
        this.note(1320, 0.28, 0.05, 'sine', 2800, t + 0.07);
    }

    stumble() {
        if (!this.ctx || !this.enabled) return;
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        o.type = 'square';
        o.frequency.setValueAtTime(70, t);
        o.frequency.exponentialRampToValueAtTime(32, t + 0.18);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.12, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
        o.connect(g);
        g.connect(this.master);
        o.start(t);
        o.stop(t + 0.22);
    }

    jump() {
        if (!this.ctx || !this.enabled) return;
        const t = this.ctx.currentTime;
        this.note(220, 0.12, 0.04, 'triangle', 800, t);
    }
}
