/**
 * Áudio 100 % sintetizado com a Web Audio API — nenhum arquivo de som.
 *
 * A trilha é um sequenciador simples em ré menor com alaúde (osciladores com
 * decaimento rápido), tambores de guerra e um drone de coro. As camadas entram
 * e saem conforme o momento do jogo (menu, rio, chefe, vitória, derrota).
 */

const SCALE = [0, 2, 3, 5, 7, 8, 10]; // eólio (menor natural)
const ROOT = 146.83; // ré2

/** Frequência de um grau da escala (com oitavas). */
function noteFreq(degree, octave = 0) {
    const idx = ((degree % 7) + 7) % 7;
    const oct = octave + Math.floor(degree / 7);
    return ROOT * Math.pow(2, oct + SCALE[idx] / 12);
}

const PROGRESSION = [
    { root: 0, chord: [0, 2, 4] },   // Dm
    { root: 5, chord: [5, 0, 2] },   // Bb
    { root: 2, chord: [2, 4, 6] },   // F
    { root: 4, chord: [4, 6, 1] }    // C
];

export class GameAudio {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.volume = 0.7;
        this.mode = null;
        this.step = 0;
        this.nextNoteTime = 0;
        this.timer = null;
        this.tempo = 96;
        this.intensity = 0;
    }

    /** Precisa ser chamado a partir de um gesto do usuário. */
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
        this.compressor.threshold.value = -12;
        this.compressor.knee.value = 22;
        this.compressor.ratio.value = 6;
        this.compressor.attack.value = 0.004;
        this.compressor.release.value = 0.22;

        this.musicBus = ctx.createGain();
        this.musicBus.gain.value = 0.55;
        this.sfxBus = ctx.createGain();
        this.sfxBus.gain.value = 0.9;

        // Reverberação curta (impulso sintético) dá "sala" ao conjunto.
        this.reverb = ctx.createConvolver();
        this.reverb.buffer = this._impulse(2.1, 2.6);
        this.reverbSend = ctx.createGain();
        this.reverbSend.gain.value = 0.24;

        this.musicBus.connect(this.compressor);
        this.sfxBus.connect(this.compressor);
        this.musicBus.connect(this.reverbSend);
        this.sfxBus.connect(this.reverbSend);
        this.reverbSend.connect(this.reverb);
        this.reverb.connect(this.compressor);
        this.compressor.connect(this.master);
        this.master.connect(ctx.destination);

        this.noiseBuffer = this._noise(2);
    }

    _impulse(duration, decay) {
        const rate = this.ctx.sampleRate;
        const length = Math.floor(rate * duration);
        const buffer = this.ctx.createBuffer(2, length, rate);
        for (let c = 0; c < 2; c++) {
            const data = buffer.getChannelData(c);
            for (let i = 0; i < length; i++) {
                const t = i / length;
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
            }
        }
        return buffer;
    }

    _noise(seconds) {
        const rate = this.ctx.sampleRate;
        const buffer = this.ctx.createBuffer(1, rate * seconds, rate);
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

    /* -------------------------------------------------------------- */
    /* Vozes                                                           */
    /* -------------------------------------------------------------- */

    _pluck(freq, time, duration = 0.5, gain = 0.25, type = 'triangle') {
        const ctx = this.ctx;
        const osc = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const env = ctx.createGain();

        osc.type = type;
        osc.frequency.value = freq;
        osc2.type = 'sawtooth';
        osc2.frequency.value = freq * 1.005;

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(Math.min(7200, freq * 9), time);
        filter.frequency.exponentialRampToValueAtTime(Math.max(220, freq * 2.2), time + duration);
        filter.Q.value = 1.4;

        env.gain.setValueAtTime(0.0001, time);
        env.gain.exponentialRampToValueAtTime(gain, time + 0.012);
        env.gain.exponentialRampToValueAtTime(0.0001, time + duration);

        osc.connect(filter);
        osc2.connect(filter);
        filter.connect(env);
        env.connect(this.musicBus);

        osc.start(time);
        osc2.start(time);
        osc.stop(time + duration + 0.05);
        osc2.stop(time + duration + 0.05);
    }

    _pad(freq, time, duration, gain = 0.08) {
        const ctx = this.ctx;
        const env = ctx.createGain();
        env.gain.setValueAtTime(0.0001, time);
        env.gain.exponentialRampToValueAtTime(gain, time + duration * 0.4);
        env.gain.exponentialRampToValueAtTime(0.0001, time + duration);
        env.connect(this.musicBus);

        for (const detune of [-7, 0, 7]) {
            const osc = ctx.createOscillator();
            osc.type = 'triangle';
            osc.frequency.value = freq;
            osc.detune.value = detune;
            osc.connect(env);
            osc.start(time);
            osc.stop(time + duration + 0.1);
        }
    }

    _drum(time, kind = 'kick', gain = 0.5) {
        const ctx = this.ctx;
        if (kind === 'kick') {
            const osc = ctx.createOscillator();
            const env = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(150, time);
            osc.frequency.exponentialRampToValueAtTime(44, time + 0.16);
            env.gain.setValueAtTime(gain, time);
            env.gain.exponentialRampToValueAtTime(0.0001, time + 0.3);
            osc.connect(env);
            env.connect(this.musicBus);
            osc.start(time);
            osc.stop(time + 0.32);
        } else {
            const src = ctx.createBufferSource();
            src.buffer = this.noiseBuffer;
            const filter = ctx.createBiquadFilter();
            filter.type = kind === 'snare' ? 'bandpass' : 'highpass';
            filter.frequency.value = kind === 'snare' ? 1900 : 6200;
            filter.Q.value = 1.1;
            const env = ctx.createGain();
            env.gain.setValueAtTime(gain * 0.55, time);
            env.gain.exponentialRampToValueAtTime(0.0001, time + (kind === 'snare' ? 0.18 : 0.07));
            src.connect(filter);
            filter.connect(env);
            env.connect(this.musicBus);
            src.start(time, Math.random());
            src.stop(time + 0.3);
        }
    }

    _brass(freq, time, duration, gain = 0.16) {
        const ctx = this.ctx;
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const env = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq * 0.98, time);
        osc.frequency.linearRampToValueAtTime(freq, time + 0.09);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(freq * 2.2, time);
        filter.frequency.linearRampToValueAtTime(freq * 5, time + duration * 0.5);
        env.gain.setValueAtTime(0.0001, time);
        env.gain.exponentialRampToValueAtTime(gain, time + 0.07);
        env.gain.setValueAtTime(gain, time + duration * 0.7);
        env.gain.exponentialRampToValueAtTime(0.0001, time + duration);
        osc.connect(filter);
        filter.connect(env);
        env.connect(this.musicBus);
        osc.start(time);
        osc.stop(time + duration + 0.05);
    }

    /* -------------------------------------------------------------- */
    /* Sequenciador                                                    */
    /* -------------------------------------------------------------- */

    playMusic(mode) {
        if (!this.ctx) return;
        if (this.mode === mode) return;
        this.mode = mode;
        this.step = 0;
        this.tempo = mode === 'boss' ? 132 : mode === 'river' ? 112 : mode === 'victory' ? 104 : 84;
        this.nextNoteTime = this.ctx.currentTime + 0.08;

        if (!this.timer) {
            this.timer = setInterval(() => this._scheduler(), 25);
        }
    }

    stopMusic() {
        this.mode = null;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    _scheduler() {
        if (!this.ctx || !this.mode) return;
        const beat = 60 / this.tempo / 2; // colcheias
        while (this.nextNoteTime < this.ctx.currentTime + 0.16) {
            this._scheduleStep(this.step, this.nextNoteTime, beat);
            this.nextNoteTime += beat;
            this.step++;
        }
    }

    _scheduleStep(step, time, beat) {
        const bar = Math.floor(step / 8) % PROGRESSION.length;
        const inBar = step % 8;
        const chord = PROGRESSION[bar];
        const mode = this.mode;

        // Drone/coro no início de cada compasso.
        if (inBar === 0) {
            this._pad(noteFreq(chord.root, 0) / 2, time, beat * 8.6, mode === 'boss' ? 0.13 : 0.075);
            this._pad(noteFreq(chord.root + 4, 0), time, beat * 8.6, 0.045);
        }

        if (mode === 'menu') {
            // Arpejo lento de alaúde.
            if (inBar % 2 === 0) {
                const deg = chord.chord[(inBar / 2) % chord.chord.length];
                this._pluck(noteFreq(deg, 1), time, beat * 2.4, 0.16);
            }
            if (inBar === 4) this._drum(time, 'kick', 0.24);
            return;
        }

        if (mode === 'river') {
            const deg = chord.chord[inBar % chord.chord.length];
            this._pluck(noteFreq(deg, 1), time, beat * 1.6, 0.13);
            if (inBar % 4 === 0) this._pluck(noteFreq(chord.root, 0), time, beat * 2.2, 0.18);
            if (inBar === 0 || inBar === 3 || inBar === 6) this._drum(time, 'kick', 0.42);
            if (inBar === 4) this._drum(time, 'snare', 0.34);
            if (inBar % 2 === 1) this._drum(time, 'hat', 0.2);

            // Melodia esporádica quando a ação aperta.
            if (this.intensity > 0.4 && inBar === 2) {
                const deg2 = chord.chord[(step * 3) % chord.chord.length] + 7;
                this._pluck(noteFreq(deg2, 1), time + beat * 0.5, beat * 1.4, 0.1, 'square');
            }
            return;
        }

        if (mode === 'boss') {
            this._drum(time, inBar % 2 === 0 ? 'kick' : 'hat', inBar % 2 === 0 ? 0.55 : 0.2);
            if (inBar === 4 || inBar === 6) this._drum(time, 'snare', 0.4);
            if (inBar === 0) this._brass(noteFreq(chord.root, 0), time, beat * 3.4, 0.2);
            if (inBar === 4) this._brass(noteFreq(chord.root + 4, 0), time, beat * 2.4, 0.15);
            const deg = chord.chord[inBar % chord.chord.length];
            if (inBar % 2 === 1) this._pluck(noteFreq(deg, 1), time, beat * 1.1, 0.09, 'sawtooth');
            return;
        }

        if (mode === 'victory') {
            const major = [0, 2, 4, 7];
            if (inBar % 2 === 0) {
                this._brass(ROOT * Math.pow(2, (major[(inBar / 2) % 4] + 3) / 12) * 2, time, beat * 2.2, 0.18);
            }
            if (inBar === 0 || inBar === 4) this._drum(time, 'kick', 0.4);
            if (inBar % 2 === 1) this._pluck(noteFreq(chord.chord[inBar % 3], 2), time, beat * 1.6, 0.12);
            return;
        }

        if (mode === 'defeat') {
            if (inBar === 0) this._pluck(noteFreq(chord.root, 0), time, beat * 6, 0.14);
            if (inBar === 4) this._pluck(noteFreq(chord.root + 2, 0), time, beat * 4, 0.09);
        }
    }

    /* -------------------------------------------------------------- */
    /* Efeitos                                                         */
    /* -------------------------------------------------------------- */

    _noiseBurst(time, { duration = 0.3, type = 'bandpass', freq = 800, endFreq = null, q = 1, gain = 0.4 }) {
        const ctx = this.ctx;
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const filter = ctx.createBiquadFilter();
        filter.type = type;
        filter.frequency.setValueAtTime(freq, time);
        if (endFreq) filter.frequency.exponentialRampToValueAtTime(endFreq, time + duration);
        filter.Q.value = q;
        const env = ctx.createGain();
        env.gain.setValueAtTime(gain, time);
        env.gain.exponentialRampToValueAtTime(0.0001, time + duration);
        src.connect(filter);
        filter.connect(env);
        env.connect(this.sfxBus);
        src.start(time, Math.random() * 1.5);
        src.stop(time + duration + 0.05);
    }

    _tone(time, { freq = 440, endFreq = null, duration = 0.25, gain = 0.3, type = 'sine' }) {
        const ctx = this.ctx;
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, time);
        if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), time + duration);
        env.gain.setValueAtTime(0.0001, time);
        env.gain.exponentialRampToValueAtTime(gain, time + 0.012);
        env.gain.exponentialRampToValueAtTime(0.0001, time + duration);
        osc.connect(env);
        env.connect(this.sfxBus);
        osc.start(time);
        osc.stop(time + duration + 0.05);
    }

    sfx(name, intensity = 1) {
        if (!this.ctx || !this.enabled) return;
        const t = this.ctx.currentTime + 0.001;

        switch (name) {
            case 'throw':
                this._noiseBurst(t, { duration: 0.22, freq: 1800, endFreq: 420, q: 3, gain: 0.22 * intensity });
                this._tone(t, { freq: 620, endFreq: 240, duration: 0.16, gain: 0.1, type: 'triangle' });
                break;
            case 'hitWood':
                this._noiseBurst(t, { duration: 0.14, type: 'lowpass', freq: 1400, endFreq: 300, gain: 0.32 });
                this._tone(t, { freq: 180, endFreq: 90, duration: 0.18, gain: 0.22, type: 'square' });
                break;
            case 'hitMetal':
                this._tone(t, { freq: 1560, endFreq: 720, duration: 0.24, gain: 0.14, type: 'triangle' });
                this._noiseBurst(t, { duration: 0.2, freq: 3400, q: 6, gain: 0.16 });
                break;
            case 'explosion':
                this._noiseBurst(t, { duration: 0.85, type: 'lowpass', freq: 2400, endFreq: 120, gain: 0.6 * intensity });
                this._tone(t, { freq: 120, endFreq: 32, duration: 0.7, gain: 0.4 * intensity, type: 'sine' });
                break;
            case 'splash':
                this._noiseBurst(t, { duration: 0.5, type: 'bandpass', freq: 700, endFreq: 2600, q: 0.9, gain: 0.22 * intensity });
                break;
            case 'arrow':
                this._noiseBurst(t, { duration: 0.3, freq: 2600, endFreq: 900, q: 5, gain: 0.16 });
                break;
            case 'damage':
                this._tone(t, { freq: 220, endFreq: 60, duration: 0.5, gain: 0.4, type: 'sawtooth' });
                this._noiseBurst(t, { duration: 0.35, type: 'lowpass', freq: 900, endFreq: 160, gain: 0.35 });
                break;
            case 'pickup':
                this._tone(t, { freq: 880, duration: 0.18, gain: 0.16, type: 'sine' });
                this._tone(t + 0.07, { freq: 1320, duration: 0.24, gain: 0.14, type: 'sine' });
                break;
            case 'coin':
                this._tone(t, { freq: 1180, duration: 0.1, gain: 0.1, type: 'square' });
                this._tone(t + 0.05, { freq: 1760, duration: 0.16, gain: 0.08, type: 'square' });
                break;
            case 'fury':
                this._tone(t, { freq: 180, endFreq: 900, duration: 0.6, gain: 0.24, type: 'sawtooth' });
                this._noiseBurst(t, { duration: 0.7, freq: 400, endFreq: 4200, q: 2, gain: 0.2 });
                break;
            case 'horn':
                this._brassSfx(t, 196, 0.9);
                this._brassSfx(t + 0.18, 294, 1.2);
                break;
            case 'gate':
                this._tone(t, { freq: 90, endFreq: 40, duration: 1.4, gain: 0.4, type: 'sawtooth' });
                this._noiseBurst(t, { duration: 1.6, type: 'lowpass', freq: 1200, endFreq: 90, gain: 0.4 });
                break;
            case 'firework':
                this._noiseBurst(t, { duration: 0.5, type: 'highpass', freq: 1800, gain: 0.18 * intensity });
                this._tone(t, { freq: 340, endFreq: 90, duration: 0.35, gain: 0.14, type: 'triangle' });
                break;
            default:
                break;
        }
    }

    _brassSfx(time, freq, duration) {
        const ctx = this.ctx;
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const env = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = freq;
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(freq * 2, time);
        filter.frequency.linearRampToValueAtTime(freq * 6, time + duration * 0.4);
        env.gain.setValueAtTime(0.0001, time);
        env.gain.exponentialRampToValueAtTime(0.3, time + 0.08);
        env.gain.setValueAtTime(0.3, time + duration * 0.6);
        env.gain.exponentialRampToValueAtTime(0.0001, time + duration);
        osc.connect(filter);
        filter.connect(env);
        env.connect(this.sfxBus);
        osc.start(time);
        osc.stop(time + duration + 0.1);
    }

    dispose() {
        this.stopMusic();
        this.ctx?.close();
        this.ctx = null;
    }
}
