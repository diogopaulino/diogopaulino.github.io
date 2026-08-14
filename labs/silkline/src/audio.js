/**
 * Chuva, whoosh do balanço, impacto da teia e um pad noturno em lá menor.
 * Só Web Audio — nenhum sample externo.
 */

export class GameAudio {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.volume = 0.7;
        this.master = null;
        this.music = null;
        this.wind = null;
        this.started = false;
        this.step = 0;
        this.acc = 0;
        this.bpm = 86;
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

        const noiseBuf = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
        const data = noiseBuf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const rain = this.ctx.createBufferSource();
        rain.buffer = noiseBuf;
        rain.loop = true;
        const rainFilter = this.ctx.createBiquadFilter();
        rainFilter.type = 'highpass';
        rainFilter.frequency.value = 1800;
        this.rainGain = this.ctx.createGain();
        this.rainGain.gain.value = 0.045;
        rain.connect(rainFilter);
        rainFilter.connect(this.rainGain);
        this.rainGain.connect(this.master);
        rain.start();

        this.wind = this.ctx.createOscillator();
        this.wind.type = 'sawtooth';
        this.wind.frequency.value = 42;
        this.windGain = this.ctx.createGain();
        this.windGain.gain.value = 0;
        const windF = this.ctx.createBiquadFilter();
        windF.type = 'lowpass';
        windF.frequency.value = 380;
        this.wind.connect(windF);
        windF.connect(this.windGain);
        this.windGain.connect(this.master);
        this.wind.start();
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
        g.gain.setValueAtTime(gain, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g);
        g.connect(this.master);
        o.start(t);
        o.stop(t + dur + 0.02);
    }

    attach() {
        this.blip(520, 0.09, 'triangle', 0.1);
        this.blip(880, 0.12, 'sine', 0.06);
    }

    release() {
        this.blip(180, 0.16, 'sine', 0.05);
    }

    miss() {
        this.blip(110, 0.08, 'square', 0.04);
    }

    collect() {
        this.blip(660, 0.1, 'sine', 0.1);
        this.blip(990, 0.18, 'triangle', 0.06);
    }

    hurt() {
        this.blip(90, 0.22, 'sawtooth', 0.12);
    }

    splash() {
        this.blip(70, 0.35, 'sine', 0.1);
    }

    update(dt, speed, swinging) {
        if (!this.ctx || !this.enabled || !this.started) return;
        const stepDur = 60 / this.bpm / 2;
        this.acc += dt;
        while (this.acc >= stepDur) {
            this.acc -= stepDur;
            this.tick(this.step);
            this.step = (this.step + 1) % 8;
        }
        if (this.windGain) {
            const target = swinging ? 0.04 + Math.min(0.08, speed * 0.0012) : 0.012 + speed * 0.0004;
            this.windGain.gain.value += (target - this.windGain.gain.value) * 0.08;
            this.wind.frequency.value = 36 + speed * 0.55;
        }
    }

    tick(step) {
        const t = this.ctx.currentTime;
        const root = 110;
        const notes = [0, 3, 7, 10, 12, 10, 7, 3];
        const n = notes[step];
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'sine';
        o.frequency.value = root * Math.pow(2, n / 12);
        g.gain.setValueAtTime(0.05, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 900;
        o.connect(f);
        f.connect(g);
        g.connect(this.music);
        o.start(t);
        o.stop(t + 0.6);

        if (step % 2 === 0) {
            const k = this.ctx.createOscillator();
            const kg = this.ctx.createGain();
            k.type = 'sine';
            k.frequency.setValueAtTime(90, t);
            k.frequency.exponentialRampToValueAtTime(38, t + 0.12);
            kg.gain.setValueAtTime(0.08, t);
            kg.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
            k.connect(kg);
            kg.connect(this.music);
            k.start(t);
            k.stop(t + 0.2);
        }
    }
}
