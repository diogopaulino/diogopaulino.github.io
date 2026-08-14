/**
 * Trilha e efeitos 100 % sintetizados (Web Audio API).
 * Ritmo de carnaval em Fá mixolídio — bumbo saltitante + flauta + drone.
 */

const SCALE = [0, 2, 4, 7, 9, 10]; // mixolídio simplificado
const ROOT = 174.61; // Fá3

function noteFreq(degree, octave = 0) {
    const idx = ((degree % SCALE.length) + SCALE.length) % SCALE.length;
    const oct = octave + Math.floor(degree / SCALE.length);
    return ROOT * Math.pow(2, oct + SCALE[idx] / 12);
}

const RIFF = [0, 2, 4, 2, 5, 4, 2, 0, 4, 5, 4, 2, 0, 2, 3, 2];

export class GameAudio {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.volume = 0.7;
        this.mode = null;
        this.step = 0;
        this.nextNoteTime = 0;
        this.timer = null;
        this.tempo = 132;
    }

    init() {
        if (this.ctx) {
            if (this.ctx.state === 'suspended') this.ctx.resume();
            return;
        }
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        this.ctx = ctx;

        this.master = ctx.createGain();
        this.master.gain.value = this.enabled ? this.volume : 0;

        this.compressor = ctx.createDynamicsCompressor();
        this.compressor.threshold.value = -14;
        this.compressor.ratio.value = 5;

        this.musicBus = ctx.createGain();
        this.musicBus.gain.value = 0.42;
        this.sfxBus = ctx.createGain();
        this.sfxBus.gain.value = 0.95;

        this.reverb = ctx.createConvolver();
        this.reverb.buffer = this._impulse(1.6, 2.2);
        this.reverbSend = ctx.createGain();
        this.reverbSend.gain.value = 0.22;

        this.musicBus.connect(this.compressor);
        this.sfxBus.connect(this.compressor);
        this.musicBus.connect(this.reverbSend);
        this.reverbSend.connect(this.reverb);
        this.reverb.connect(this.compressor);
        this.compressor.connect(this.master);
        this.master.connect(ctx.destination);

        this.noiseBuffer = this._noise(1.2);
    }

    _impulse(duration, decay) {
        const rate = this.ctx.sampleRate;
        const length = Math.floor(rate * duration);
        const buffer = this.ctx.createBuffer(2, length, rate);
        for (let c = 0; c < 2; c++) {
            const data = buffer.getChannelData(c);
            for (let i = 0; i < length; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
            }
        }
        return buffer;
    }

    _noise(seconds) {
        const rate = this.ctx.sampleRate;
        const buffer = this.ctx.createBuffer(1, Math.floor(rate * seconds), rate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        return buffer;
    }

    setVolume(value) {
        this.volume = value;
        if (this.master) {
            this.master.gain.setTargetAtTime(this.enabled ? value : 0, this.ctx.currentTime, 0.05);
        }
    }

    setEnabled(enabled) {
        this.enabled = enabled;
        if (this.master) {
            this.master.gain.setTargetAtTime(enabled ? this.volume : 0, this.ctx.currentTime, 0.05);
        }
    }

    setMode(mode) {
        this.mode = mode;
        if (!this.ctx) return;
        if (mode === 'play' || mode === 'menu') this._startClock();
        else this._stopClock();
        if (mode === 'victory') this._fanfare(true);
        if (mode === 'defeat') this._fanfare(false);
    }

    _startClock() {
        if (this.timer) return;
        this.nextNoteTime = this.ctx.currentTime + 0.05;
        this.timer = setInterval(() => this._scheduler(), 40);
    }

    _stopClock() {
        clearInterval(this.timer);
        this.timer = null;
    }

    _scheduler() {
        if (!this.ctx || !this.enabled) return;
        const stepDur = 60 / this.tempo / 2;
        while (this.nextNoteTime < this.ctx.currentTime + 0.12) {
            this._tick(this.step, this.nextNoteTime);
            this.step += 1;
            this.nextNoteTime += stepDur;
        }
    }

    _tick(step, time) {
        const bar = step % 16;
        if (bar % 4 === 0) this._kick(time, bar === 0 ? 1 : 0.7);
        if (bar === 4 || bar === 12) this._snare(time);
        if (bar % 2 === 1) this._hat(time);

        if (this.mode === 'menu' && bar % 2 === 0) {
            this._tone(noteFreq(RIFF[bar] - 6, -1), time, 0.18, 'triangle', 0.07, this.musicBus);
        }
        if (this.mode === 'play') {
            const melody = RIFF[bar] + (step % 32 >= 16 ? 2 : 0);
            this._tone(noteFreq(melody, 1), time, 0.16, 'triangle', 0.09, this.musicBus);
            if (bar % 4 === 0) {
                this._tone(noteFreq(0, -1), time, 0.28, 'sawtooth', 0.05, this.musicBus);
            }
        }
    }

    _tone(freq, time, dur, type, gain, bus) {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, time);
        g.gain.setValueAtTime(0.0001, time);
        g.gain.exponentialRampToValueAtTime(gain, time + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
        osc.connect(g);
        g.connect(bus);
        osc.start(time);
        osc.stop(time + dur + 0.02);
    }

    _kick(time, amp) {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(140, time);
        osc.frequency.exponentialRampToValueAtTime(42, time + 0.12);
        g.gain.setValueAtTime(0.0001, time);
        g.gain.exponentialRampToValueAtTime(0.55 * amp, time + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);
        osc.connect(g);
        g.connect(this.musicBus);
        osc.start(time);
        osc.stop(time + 0.2);
    }

    _snare(time) {
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 1800;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.22, time);
        g.gain.exponentialRampToValueAtTime(0.0001, time + 0.12);
        src.connect(bp);
        bp.connect(g);
        g.connect(this.musicBus);
        src.start(time);
        src.stop(time + 0.14);
    }

    _hat(time) {
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const hp = this.ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 7000;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.06, time);
        g.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
        src.connect(hp);
        hp.connect(g);
        g.connect(this.musicBus);
        src.start(time);
        src.stop(time + 0.06);
    }

    _sfx(freq, dur, type = 'square', gain = 0.12, sweep = 0) {
        if (!this.ctx || !this.enabled) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);
        if (sweep) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + sweep), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(g);
        g.connect(this.sfxBus);
        osc.start(t);
        osc.stop(t + dur + 0.02);
    }

    jump() { this._sfx(520, 0.12, 'square', 0.1, 280); }
    doubleJump() { this._sfx(740, 0.16, 'triangle', 0.12, 420); }
    land() { this._sfx(140, 0.08, 'sine', 0.12, -60); }
    gem() { this._sfx(880, 0.14, 'triangle', 0.1, 400); }
    heart() { this._sfx(660, 0.22, 'sine', 0.12, 220); }
    stomp() { this._sfx(180, 0.16, 'sawtooth', 0.14, -80); }
    spin() { this._sfx(420, 0.2, 'square', 0.08, 600); }
    hit() { this._sfx(90, 0.22, 'sawtooth', 0.16, -40); }
    checkpoint() {
        this._sfx(392, 0.18, 'triangle', 0.1, 0);
        setTimeout(() => this._sfx(523, 0.2, 'triangle', 0.1, 0), 90);
        setTimeout(() => this._sfx(784, 0.28, 'triangle', 0.1, 0), 180);
    }
    fall() { this._sfx(320, 0.5, 'sine', 0.1, -260); }

    _fanfare(win) {
        if (!this.ctx || !this.enabled) return;
        const t = this.ctx.currentTime;
        const notes = win ? [0, 2, 4, 7] : [4, 2, 0, -2];
        notes.forEach((d, i) => {
            this._tone(noteFreq(d, win ? 1 : 0), t + i * 0.14, 0.28, 'triangle', 0.12, this.sfxBus);
        });
    }
}
