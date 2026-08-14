/**
 * Chiptune 100% sintético — onda quadrada, ruído e um baixo que parece
 * cartucho de 8 bits. Nenhuma amostra externa.
 */

function midi(n) {
    return 440 * Math.pow(2, (n - 69) / 12);
}

/** Melodia original estilo N64 courtyard — não é um tema existente. */
const TUNE = [
    76, 79, 83, 79, 76, 72, 74, 76,
    79, 83, 86, 83, 79, 76, 74, 72,
    71, 72, 74, 76, 79, 74, 76, 72,
    67, 71, 72, 74, 76, 79, 83, 84
];
const BASS = [
    48, 48, 43, 43, 45, 45, 47, 47,
    48, 48, 52, 52, 45, 45, 43, 43
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
        this.bpm = 132;
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
        this.music.gain.value = 0.28;
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
        if (mode === 'play') this.bpm = 140;
        else if (mode === 'boss') this.bpm = 168;
        else if (mode === 'win') this.bpm = 110;
        else this.bpm = 118;
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
        this._sq(midi(TUNE[i]), time, dur * 0.85, 0.07, this.mode === 'boss' ? 1 : 0);
        if (this.step % 2 === 0) this._sq(midi(BASS[bassI]), time, dur * 1.4, 0.09, 2);
        if (this.step % 4 === 0) this._noise(time, 0.04, 0.08, 1800);
        if (this.step % 8 === 4) this._noise(time, 0.08, 0.12, 700);
        if (this.mode === 'boss' && this.step % 2 === 1) {
            this._sq(midi(TUNE[i] + 12), time, dur * 0.4, 0.04, 0);
        }
    }

    _sq(freq, time, dur, gain, typeIndex) {
        if (!this.ctx) return;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = ['square', 'square', 'triangle'][typeIndex] || 'square';
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
        const n = 2 * this.ctx.sampleRate * dur;
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

    blip() {
        this._beep(880, 0.09, 0.12, 'square');
        this._beep(1320, 0.12, 0.08, 'square');
    }

    crunch() {
        this._noise(this.ctx?.currentTime ?? 0, 0.12, 0.22, 900);
        this._beep(220, 0.1, 0.1, 'sawtooth');
    }

    hit() {
        this._beep(160, 0.16, 0.18, 'square');
        this._noise(this.ctx?.currentTime ?? 0, 0.1, 0.16, 400);
    }

    error() {
        this._beep(440, 0.08, 0.1, 'square');
        this._beep(330, 0.14, 0.1, 'square');
        this._beep(220, 0.22, 0.12, 'square');
    }

    jump() {
        this._beep(520, 0.08, 0.08, 'square');
        this._beep(740, 0.12, 0.07, 'square');
    }

    fire() {
        this._beep(300, 0.06, 0.08, 'square');
        this._beep(180, 0.1, 0.06, 'triangle');
    }

    life() {
        this._beep(523, 0.1, 0.1, 'square');
        this._beep(659, 0.16, 0.1, 'square');
        this._beep(784, 0.24, 0.12, 'square');
        this._beep(1046, 0.32, 0.1, 'square');
    }

    clippy() {
        this._beep(700, 0.08, 0.08, 'triangle');
        this._beep(840, 0.14, 0.07, 'triangle');
    }

    win() {
        const notes = [72, 76, 79, 84, 79, 84, 88];
        notes.forEach((n, i) => this._beep(midi(n), 0.12 + i * 0.1, 0.1, 'square'));
    }

    lose() {
        [62, 58, 55, 50, 46].forEach((n, i) => this._beep(midi(n), 0.08 + i * 0.14, 0.14, 'square'));
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
