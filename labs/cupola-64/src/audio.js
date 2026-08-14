/**
 * Chiptune original da Ilha da Cúpola — onda quadrada alegre em dó maior,
 * no espírito dos campos N64 (melodia nova, não é tema de jogo existente).
 */

function midi(n) {
    return 440 * Math.pow(2, (n - 69) / 12);
}

/** Frase saltitante em C maior pentatônico. */
const TUNE = [
    72, 76, 79, 76, 84, 79, 76, 72,
    74, 76, 79, 81, 79, 76, 74, 72,
    67, 72, 76, 79, 76, 72, 69, 67,
    72, 74, 76, 79, 84, 79, 76, 72
];
const BASS = [
    48, 48, 52, 52, 45, 45, 47, 47,
    48, 48, 43, 43, 45, 45, 40, 43
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
        this.bpm = 128;
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
        if (this.master && this.ctx) {
            this.master.gain.setTargetAtTime(on ? this.volume : 0, this.ctx.currentTime, 0.05);
        }
        if (on) this.init();
    }

    setVolume(v) {
        this.volume = v;
        if (this.master && this.enabled && this.ctx) {
            this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
        }
    }

    setMode(mode) {
        this.mode = mode;
        this.bpm = mode === 'play' ? 136 : mode === 'star' ? 96 : 118;
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
        this._sq(midi(TUNE[i]), time, dur * 0.82, 0.065, 0);
        if (this.step % 2 === 0) this._sq(midi(BASS[(this.step / 2) % BASS.length]), time, dur * 1.5, 0.08, 2);
        if (this.step % 4 === 0) this._noise(time, 0.035, 0.06, 1900);
        if (this.step % 8 === 4) this._noise(time, 0.07, 0.1, 640);
        if (this.mode === 'play' && this.step % 16 === 8) {
            this._sq(midi(TUNE[i] + 12), time, dur * 0.5, 0.03, 1);
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

    jump(kind = 1) {
        const base = [0, 523, 659, 784, 988][kind] || 523;
        this._beep(base, 0.02, 0.1, 'square');
        this._beep(base * 1.33, 0.07, 0.08, 'square');
    }

    pound() {
        this._noise(this.ctx?.currentTime ?? 0, 0.16, 0.22, 280);
        this._beep(180, 0.02, 0.12, 'sawtooth');
    }

    coin() {
        this._beep(988, 0.01, 0.1, 'square');
        this._beep(1318, 0.07, 0.09, 'square');
    }

    red() {
        this._beep(784, 0.01, 0.1, 'square');
        this._beep(1174, 0.08, 0.1, 'square');
        this._beep(1568, 0.16, 0.08, 'square');
    }

    star() {
        [659, 784, 988, 1174, 1568].forEach((f, i) => this._beep(f, 0.04 + i * 0.09, 0.12, 'square'));
    }

    stomp() {
        this._beep(220, 0.01, 0.1, 'square');
        this._noise(this.ctx?.currentTime ?? 0, 0.08, 0.14, 500);
    }

    hurt() {
        this._beep(196, 0.02, 0.14, 'square');
        this._beep(147, 0.12, 0.12, 'square');
    }

    cannon() {
        this._noise(this.ctx?.currentTime ?? 0, 0.2, 0.18, 400);
        this._beep(330, 0.02, 0.1, 'triangle');
    }

    splash() {
        this._noise(this.ctx?.currentTime ?? 0, 0.14, 0.12, 900);
    }

    win() {
        [72, 76, 79, 84, 88, 96].forEach((n, i) => this._beep(midi(n), 0.06 + i * 0.11, 0.12, 'square'));
    }

    lose() {
        [67, 64, 60, 55, 48].forEach((n, i) => this._beep(midi(n), 0.05 + i * 0.13, 0.13, 'square'));
    }

    _beep(freq, delay, gain, type) {
        if (!this.ctx) return;
        const start = this.ctx.currentTime + delay;
        const dur = 0.16;
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
        o.stop(start + dur + 0.03);
    }
}
