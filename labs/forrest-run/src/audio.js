/**
 * Trilha sonora e paisagem acústica procedural para Forrest Run.
 *
 * Utiliza exclusivamente a Web Audio API nativa com osciladores e filtros modelados:
 * - Trilha folk/Americana suave em Sol Maior (G-A-B-D-E) inspirada no tema de Alan Silvestri
 * - Passadas com ressonância acústica distinta (terra macia vs asfalto nítido)
 * - Vento dinâmico que escala com a velocidade do Forrest
 * - Chuva e trovões distantes no bioma molhado
 * - Efeitos sonoros nítidos de salto, coleta de penas e tropeço
 */

export class GameAudio {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.volume = 0.7;
        this.master = null;
        this.music = null;
        this.sfx = null;
        this.started = false;
        this.step = 0;
        this.acc = 0;
        this.bpm = 78;
        this.footAcc = 0;
        this.raining = false;
        this.wind = null;
        this.rainNode = null;
    }

    async resume() {
        if (!this.enabled) return;
        if (!this.ctx) this.boot();
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }
        this.started = true;
    }

    boot() {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioCtx();

        this.master = this.ctx.createGain();
        this.master.gain.value = this.volume;
        this.master.connect(this.ctx.destination);

        this.music = this.ctx.createGain();
        this.music.gain.value = 0.45;
        this.music.connect(this.master);

        this.sfx = this.ctx.createGain();
        this.sfx.gain.value = 0.75;
        this.sfx.connect(this.master);

        // Vento e chuva procedurais
        this.wind = this.createNoiseNode(0.035, 600, 'lowpass');
        this.rainNode = this.createNoiseNode(0.0, 3800, 'highpass');
    }

    createNoiseNode(gain, cutoff, type) {
        const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const src = this.ctx.createBufferSource();
        src.buffer = buffer;
        src.loop = true;

        const filter = this.ctx.createBiquadFilter();
        filter.type = type;
        filter.frequency.value = cutoff;

        const gainNode = this.ctx.createGain();
        gainNode.gain.value = gain;

        src.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.master);
        src.start();

        return gainNode;
    }

    setVolume(v) {
        this.volume = v;
        if (this.master) {
            this.master.gain.value = this.enabled ? v : 0;
        }
    }

    setEnabled(on) {
        this.enabled = on;
        if (this.master) {
            this.master.gain.value = on ? this.volume : 0;
        }
    }

    setRain(on) {
        this.raining = on;
        if (this.rainNode) {
            this.rainNode.gain.setTargetAtTime(on ? 0.05 : 0, this.ctx.currentTime, 0.5);
        }
        if (this.wind) {
            this.wind.gain.setTargetAtTime(on ? 0.02 : 0.04, this.ctx.currentTime, 0.5);
        }
    }

    update(dt, speed, grounded, isDirt = false) {
        if (!this.ctx || !this.enabled || !this.started) return;

        // Ritmo da música procedural
        const stepDur = 60 / this.bpm / 2;
        this.acc += dt;
        while (this.acc >= stepDur) {
            this.acc -= stepDur;
            this.tick(this.step);
            this.step = (this.step + 1) % 16;
        }

        // Passadas sincronizadas com a velocidade e o tipo de solo
        if (grounded && speed > 4) {
            const stride = 0.38 * (12.0 / Math.max(8, speed));
            this.footAcc += dt;
            if (this.footAcc >= stride) {
                this.footAcc = 0;
                this.playFootstep(isDirt);
            }
        }
    }

    tick(step) {
        const t = this.ctx.currentTime;
        // Progressão folk Americana em G: G - D - Em - C
        const progression = [
            [43, 50, 55, 59], // G
            [38, 50, 54, 57], // D
            [40, 47, 52, 55], // Em
            [48, 52, 55, 60]  // C
        ];

        const bar = Math.floor(step / 4) % progression.length;
        const chord = progression[bar];

        // Baixo acústico
        if (step % 4 === 0) {
            this.note(this.mtof(chord[0]), 0.45, 0.07, 'triangle', 450, t);
        }

        // Dedilhado de violão acústico
        const noteIdx = (step % 4);
        if (chord[noteIdx]) {
            this.pluck(this.mtof(chord[noteIdx] + 12), t + Math.random() * 0.005);
        }

        // Brilho harmônico suave
        if (step === 2 || step === 10) {
            this.note(this.mtof(chord[2] + 24), 0.7, 0.02, 'sine', 1600, t);
        }
    }

    mtof(m) {
        return 440 * Math.pow(2, (m - 69) / 12);
    }

    note(freq, dur, gain, type, cutoff, t) {
        const osc = this.ctx.createOscillator();
        osc.type = type;
        osc.frequency.value = freq;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = cutoff;

        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

        osc.connect(filter);
        filter.connect(g);
        g.connect(this.music);

        osc.start(t);
        osc.stop(t + dur + 0.02);
    }

    pluck(freq, t) {
        this.note(freq, 0.4, 0.04, 'sawtooth', 1800, t);
    }

    playFootstep(isDirt) {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        o.type = isDirt ? 'triangle' : 'sine';

        const startFreq = isDirt ? 110 : 85;
        const endFreq = isDirt ? 45 : 35;

        o.frequency.setValueAtTime(startFreq, t);
        o.frequency.exponentialRampToValueAtTime(endFreq, t + 0.06);

        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.07, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);

        o.connect(g);
        g.connect(this.sfx);
        o.start(t);
        o.stop(t + 0.08);
    }

    collect() {
        if (!this.ctx || !this.enabled) return;
        const t = this.ctx.currentTime;
        // Acorde harmônico cristalino
        this.note(880, 0.22, 0.08, 'sine', 2600, t);
        this.note(1320, 0.32, 0.06, 'sine', 3200, t + 0.06);
        this.note(1760, 0.42, 0.04, 'sine', 3800, t + 0.12);
    }

    stumble() {
        if (!this.ctx || !this.enabled) return;
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(95, t);
        o.frequency.exponentialRampToValueAtTime(30, t + 0.2);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(350, t);

        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.12, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);

        o.connect(filter);
        filter.connect(g);
        g.connect(this.sfx);
        o.start(t);
        o.stop(t + 0.25);
    }

    jump() {
        if (!this.ctx || !this.enabled) return;
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(180, t);
        o.frequency.exponentialRampToValueAtTime(360, t + 0.12);

        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.06, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);

        o.connect(g);
        g.connect(this.sfx);
        o.start(t);
        o.stop(t + 0.15);
    }
}
