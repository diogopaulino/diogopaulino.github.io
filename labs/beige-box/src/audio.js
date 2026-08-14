/**
 * Áudio 100 % sintetizado — hum do CRT, disquete, teclado, chiptune e noite.
 */

export class DeskAudio {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.volume = 0.72;
        this.humNodes = [];
        this.musicTimer = null;
        this.step = 0;
        this.playingWalkman = false;
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
        this.sfx = ctx.createGain();
        this.sfx.gain.value = 0.9;
        this.amb = ctx.createGain();
        this.amb.gain.value = 0.35;
        this.music = ctx.createGain();
        this.music.gain.value = 0.0;

        this.sfx.connect(this.master);
        this.amb.connect(this.master);
        this.music.connect(this.master);
        this.master.connect(ctx.destination);

        this._night();
    }

    setEnabled(on) {
        this.enabled = on;
        if (!this.master) return;
        this.master.gain.setTargetAtTime(on ? this.volume : 0, this.ctx.currentTime, 0.05);
        if (on && this.ctx.state === 'suspended') this.ctx.resume();
    }

    _now() {
        return this.ctx ? this.ctx.currentTime : 0;
    }

    _env(amp, t, a = 0.01, d = 0.2, peak = 0.4) {
        amp.gain.setValueAtTime(0.0001, t);
        amp.gain.exponentialRampToValueAtTime(peak, t + a);
        amp.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    }

    _tone(type, freq, dur, peak = 0.12, dest = null) {
        if (!this.ctx || !this.enabled) return;
        const t = this._now();
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = type;
        o.frequency.value = freq;
        o.connect(g);
        g.connect(dest || this.sfx);
        this._env(g, t, 0.008, dur, peak);
        o.start(t);
        o.stop(t + dur + 0.05);
    }

    _noise(dur, peak = 0.08, bpFreq = 1200, dest = null) {
        if (!this.ctx || !this.enabled) return;
        const t = this._now();
        const n = this.ctx.createBufferSource();
        const len = Math.ceil(this.ctx.sampleRate * dur);
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        n.buffer = buf;
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = bpFreq;
        const g = this.ctx.createGain();
        n.connect(bp);
        bp.connect(g);
        g.connect(dest || this.sfx);
        this._env(g, t, 0.004, dur, peak);
        n.start(t);
        n.stop(t + dur + 0.02);
    }

    click() {
        this._noise(0.04, 0.12, 2400);
        this._tone('square', 1400, 0.03, 0.04);
    }

    key() {
        this._noise(0.03, 0.1, 3200);
        this._tone('square', 880 + Math.random() * 400, 0.025, 0.03);
    }

    lamp() {
        this._tone('sine', 90, 0.08, 0.08);
        this._noise(0.05, 0.05, 800);
    }

    crtOn() {
        this._tone('sawtooth', 60, 0.5, 0.06);
        this._noise(0.3, 0.08, 400);
        this._startHum();
    }

    crtOff() {
        this._tone('sine', 80, 0.25, 0.05);
        this._stopHum();
    }

    _startHum() {
        this._stopHum();
        if (!this.ctx) return;
        const o = this.ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = 60;
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 180;
        const g = this.ctx.createGain();
        g.gain.value = 0.03;
        o.connect(f);
        f.connect(g);
        g.connect(this.amb);
        o.start();
        this.humNodes = [o, g];
    }

    _stopHum() {
        for (const n of this.humNodes) {
            try { n.stop ? n.stop() : (n.gain.value = 0); } catch { /* already stopped */ }
        }
        this.humNodes = [];
    }

    floppySeek() {
        if (!this.ctx || !this.enabled) return;
        const t = this._now();
        for (let i = 0; i < 8; i++) {
            const o = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            o.type = 'square';
            o.frequency.value = 420 + i * 70;
            o.connect(g);
            g.connect(this.sfx);
            const ti = t + i * 0.07;
            this._env(g, ti, 0.005, 0.05, 0.07);
            o.start(ti);
            o.stop(ti + 0.08);
        }
        this._noise(0.7, 0.06, 1800);
    }

    floppyEject() {
        this._tone('triangle', 320, 0.12, 0.08);
        this._noise(0.1, 0.07, 900);
    }

    tray() {
        this._tone('triangle', 180, 0.25, 0.07);
        this._noise(0.2, 0.05, 600);
    }

    phone() {
        if (!this.ctx || !this.enabled) return;
        const t = this._now();
        for (let i = 0; i < 4; i++) {
            const o1 = this.ctx.createOscillator();
            const o2 = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            o1.type = o2.type = 'sine';
            o1.frequency.value = 440;
            o2.frequency.value = 480;
            o1.connect(g);
            o2.connect(g);
            g.connect(this.sfx);
            const ti = t + i * 0.55;
            g.gain.setValueAtTime(0.0001, ti);
            g.gain.exponentialRampToValueAtTime(0.12, ti + 0.02);
            g.gain.exponentialRampToValueAtTime(0.0001, ti + 0.28);
            o1.start(ti);
            o2.start(ti);
            o1.stop(ti + 0.3);
            o2.stop(ti + 0.3);
        }
    }

    hdd() {
        this._noise(0.05, 0.04, 2800);
    }

    chair() {
        this._noise(0.18, 0.05, 400);
        this._tone('sine', 110, 0.2, 0.03);
    }

    blinds() {
        this._noise(0.22, 0.06, 700);
    }

    fan() {
        /* contínuo tratado no walkman/ambiente */
    }

    toggleWalkman() {
        this.playingWalkman = !this.playingWalkman;
        if (!this.ctx) return this.playingWalkman;
        if (this.playingWalkman) this._startChiptune();
        else this._stopChiptune();
        return this.playingWalkman;
    }

    _startChiptune() {
        this._stopChiptune();
        if (!this.ctx) return;
        this.music.gain.setTargetAtTime(0.22, this._now(), 0.15);
        const melody = [0, 3, 7, 8, 7, 3, 0, -2, 0, 3, 5, 7, 8, 7, 5, 3];
        const bass = [0, 0, -5, -5, -7, -7, -5, -2];
        const root = 196;
        const stepDur = 0.22;
        this.step = 0;
        const tick = () => {
            if (!this.playingWalkman || !this.ctx) return;
            const t = this._now();
            const i = this.step % melody.length;
            const f = root * Math.pow(2, melody[i] / 12);
            const o = this.ctx.createOscillator();
            o.type = 'square';
            o.frequency.value = f;
            const g = this.ctx.createGain();
            o.connect(g);
            g.connect(this.music);
            this._env(g, t, 0.01, 0.18, 0.12);
            o.start(t);
            o.stop(t + 0.2);

            if (i % 2 === 0) {
                const b = this.ctx.createOscillator();
                b.type = 'triangle';
                b.frequency.value = root * 0.5 * Math.pow(2, bass[(i / 2) % bass.length] / 12);
                const bg = this.ctx.createGain();
                b.connect(bg);
                bg.connect(this.music);
                this._env(bg, t, 0.01, 0.28, 0.1);
                b.start(t);
                b.stop(t + 0.3);
            }
            this.step++;
            this.musicTimer = setTimeout(tick, stepDur * 1000);
        };
        tick();
    }

    _stopChiptune() {
        this.playingWalkman = false;
        if (this.musicTimer) clearTimeout(this.musicTimer);
        this.musicTimer = null;
        if (this.music) this.music.gain.setTargetAtTime(0, this._now(), 0.2);
    }

    _night() {
        if (!this.ctx) return;
        const n = this.ctx.createBufferSource();
        const len = this.ctx.sampleRate * 2;
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.4;
        n.buffer = buf;
        n.loop = true;
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 2400;
        bp.Q.value = 0.6;
        const g = this.ctx.createGain();
        g.gain.value = 0.04;
        n.connect(bp);
        bp.connect(g);
        g.connect(this.amb);
        n.start();
    }
}
