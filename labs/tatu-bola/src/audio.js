/**
 * Chiptune tropical original — onda quadrada + triângulo, sem samples.
 * Melodia pentatônica de praia (não é tema existente).
 */

function midi(n) {
    return 440 * Math.pow(2, (n - 69) / 12);
}

const TUNE = [
    76, 79, 81, 79, 76, 72, 74, 76,
    81, 84, 81, 79, 76, 74, 72, 69,
    67, 69, 72, 74, 76, 79, 76, 72,
    69, 67, 64, 67, 69, 72, 74, 76
];
const BASS = [
    45, 45, 40, 40, 43, 43, 38, 38,
    45, 45, 48, 48, 43, 43, 40, 40
];

export class GameAudio {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.volume = 0.7;
        this.mode = 'menu';
        this.step = 0;
        this.next = 0;
        this.timer = 0;
        this.bpm = 118;
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
        this.music = ctx.createGain();
        this.music.gain.value = 0.26;
        this.sfx = ctx.createGain();
        this.sfx.gain.value = 0.9;
        this.music.connect(this.master);
        this.sfx.connect(this.master);
        this.master.connect(ctx.destination);
        this.next = ctx.currentTime + 0.05;
        this._loop();
    }

    setEnabled(on) {
        this.enabled = on;
        if (this.master) {
            this.master.gain.setTargetAtTime(on ? this.volume : 0, this.ctx.currentTime, 0.05);
        }
    }

    setVolume(v) {
        this.volume = v;
        if (this.master && this.enabled) {
            this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
        }
    }

    setMode(mode) {
        this.mode = mode;
        if (mode === 'play') this.bpm = 128;
        else if (mode === 'win') this.bpm = 108;
        else this.bpm = 112;
    }

    _loop() {
        const tick = () => {
            if (!this.ctx) return;
            const ctx = this.ctx;
            const stepDur = 60 / this.bpm / 2;
            while (this.next < ctx.currentTime + 0.12) {
                if (this.mode !== 'off') this._step(this.next, stepDur);
                this.next += stepDur;
                this.step++;
            }
            this.timer = requestAnimationFrame(tick);
        };
        this.timer = requestAnimationFrame(tick);
    }

    _step(time, dur) {
        const i = this.step % TUNE.length;
        const bassI = this.step % BASS.length;
        this._osc(midi(TUNE[i]), time, dur * 0.82, 0.065, 'square');
        if (this.step % 2 === 0) this._osc(midi(BASS[bassI]), time, dur * 1.5, 0.09, 'triangle');
        if (this.step % 4 === 0) this._noise(time, 0.035, 0.07, 2200);
        if (this.step % 8 === 4) this._noise(time, 0.07, 0.1, 600);
        if (this.mode === 'play' && this.step % 8 === 2) {
            this._osc(midi(TUNE[i] + 12), time, dur * 0.4, 0.03, 'triangle');
        }
    }

    _osc(freq, time, dur, gain, type) {
        if (!this.ctx) return;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, time);
        g.gain.setValueAtTime(0.0001, time);
        g.gain.exponentialRampToValueAtTime(gain, time + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
        o.connect(g);
        g.connect(this.music);
        o.start(time);
        o.stop(time + dur + 0.02);
    }

    _noise(time, dur, gain, freq) {
        if (!this.ctx) return;
        const n = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
        const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const f = this.ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = freq;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(gain, time);
        g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
        src.connect(f);
        f.connect(g);
        g.connect(this.sfx);
        src.start(time);
        src.stop(time + dur + 0.02);
    }

    crystal() {
        [784, 988, 1175, 1568].forEach((f, i) => this._beep(f, 0.04 + i * 0.06, 0.1, 'square'));
    }

    caju() {
        this._beep(880, 0.0, 0.08, 'square');
        this._beep(1320, 0.06, 0.06, 'square');
    }

    crate() {
        this._noise(this.ctx?.currentTime ?? 0, 0.12, 0.2, 800);
        this._beep(180, 0.02, 0.1, 'sawtooth');
    }

    hit() {
        this._beep(140, 0.0, 0.16, 'square');
        this._noise(this.ctx?.currentTime ?? 0, 0.1, 0.16, 380);
    }

    jump() {
        this._beep(480, 0.0, 0.08, 'square');
        this._beep(720, 0.05, 0.07, 'square');
    }

    roll() {
        this._beep(220, 0.0, 0.08, 'sawtooth');
        this._beep(160, 0.08, 0.08, 'sawtooth');
        this._noise(this.ctx?.currentTime ?? 0, 0.1, 0.1, 500);
    }

    life() {
        [523, 659, 784, 1046].forEach((f, i) => this._beep(f, i * 0.08, 0.1, 'square'));
    }

    enemy() {
        this._beep(330, 0.0, 0.08, 'square');
        this._beep(220, 0.07, 0.1, 'square');
    }

    win() {
        [72, 76, 79, 84, 88, 84, 91].forEach((n, i) => this._beep(midi(n), 0.08 + i * 0.1, 0.1, 'square'));
    }

    lose() {
        [64, 60, 57, 53, 48].forEach((n, i) => this._beep(midi(n), 0.06 + i * 0.14, 0.13, 'square'));
    }

    splash() {
        this._noise(this.ctx?.currentTime ?? 0, 0.18, 0.14, 900);
    }

    _beep(freq, delay, gain, type) {
        if (!this.ctx) return;
        const start = this.ctx.currentTime + delay;
        const dur = 0.14;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, start);
        g.gain.setValueAtTime(0.0001, start);
        g.gain.exponentialRampToValueAtTime(gain, start + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
        o.connect(g);
        g.connect(this.sfx);
        o.start(start);
        o.stop(start + dur + 0.02);
    }
}
