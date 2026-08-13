// core/audio.js — synth PSG (pulse/tri/noise) + scheduler de tracker + SFX. Teto: ~330 linhas.
//
// Cadeia: master gain -> DynamicsCompressor -> destination.
// Canais persistentes (osciladores iniciados uma vez no unlock) evitam churn de nós e cliques.

import { SONGS, STINGERS, SFX_LIBRARY } from '../art/songs.js';

const NOTE_FREQ = {
    C: -9, 'C#': -8, D: -7, 'D#': -6, E: -5, F: -4, 'F#': -3, G: -2, 'G#': -1, A: 0, 'A#': 1, B: 2
};

function noteToFreq(token) {
    // token ex: "C4", "A#3"
    const m = token.match(/^([A-G]#?)(\d)$/);
    if (!m) return null;
    const [, name, oct] = m;
    const semis = NOTE_FREQ[name] + (parseInt(oct, 10) - 4) * 12;
    return 440 * Math.pow(2, semis / 12);
}

function makePulseWave(ctx, duty) {
    // aproxima onda pulso via soma de harmônicos de senoide (poucos termos, leve)
    const N = 16;
    const real = new Float32Array(N);
    const imag = new Float32Array(N);
    for (let n = 1; n < N; n++) {
        imag[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty);
    }
    return ctx.createPeriodicWave(real, imag, { disableNormalization: false });
}

export class AudioEngine {
    constructor() {
        this.ctx = null;
        this.unlocked = false;
        this.muted = false;
        this.volume = 0.7;
        this.channels = {};
        this._voicePool = [];
        this._schedulerId = null;
        this._songState = null;
        this._pendingUnlock = [];
    }

    /** Deve ser chamado num gesto real do usuário (pointerdown/keydown). */
    unlock() {
        if (this.unlocked) return;
        this.unlocked = true;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (this.ctx.state === 'suspended') this.ctx.resume();

        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.muted ? 0 : this.volume;
        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.value = -14;
        this.compressor.ratio.value = 8;
        this.masterGain.connect(this.compressor);
        this.compressor.connect(this.ctx.destination);

        this._buildChannels();
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.ctx.state === 'running') this.ctx.suspend();
            else if (!document.hidden && this.ctx.state === 'suspended') this.ctx.resume();
        });
    }

    _buildChannels() {
        const ctx = this.ctx;
        // Pulse channels P1/P2
        for (const id of ['p1', 'p2']) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            gain.gain.value = 0;
            osc.setPeriodicWave(makePulseWave(ctx, 0.5));
            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start();
            this.channels[id] = { osc, gain, waveCache: {} };
        }
        // Triangle bass
        const triOsc = ctx.createOscillator();
        triOsc.type = 'triangle';
        const triGain = ctx.createGain();
        triGain.gain.value = 0;
        triOsc.connect(triGain);
        triGain.connect(this.masterGain);
        triOsc.start();
        this.channels.tri = { osc: triOsc, gain: triGain };

        // Noise channel (2s loop buffer)
        const bufferSize = ctx.sampleRate * 2;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const nzSrc = ctx.createBufferSource();
        nzSrc.buffer = buffer;
        nzSrc.loop = true;
        const nzFilter = ctx.createBiquadFilter();
        nzFilter.type = 'bandpass';
        nzFilter.frequency.value = 4000;
        const nzGain = ctx.createGain();
        nzGain.gain.value = 0;
        nzSrc.connect(nzFilter);
        nzFilter.connect(nzGain);
        nzGain.connect(this.masterGain);
        nzSrc.start();
        this.channels.nz = { src: nzSrc, filter: nzFilter, gain: nzGain };
    }

    setMute(mute) {
        this.muted = mute;
        if (this.masterGain) {
            this.masterGain.gain.setTargetAtTime(mute ? 0 : this.volume, this.ctx.currentTime, 0.02);
        }
    }

    setVolume(vol) {
        this.volume = vol;
        if (this.masterGain && !this.muted) {
            this.masterGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.02);
        }
    }

    // ---- SFX: 3 primitivas simples usando osciladores efêmeros (poucos por vez, pool 6) ----
    _stealVoice() {
        if (this._voicePool.length >= 6) {
            const old = this._voicePool.shift();
            try { old.osc.stop(); } catch { /* já parado */ }
        }
    }

    blip({ freq = 440, dur = 0.15, type = 'square', gain = 0.2, sweep = 0 } = {}) {
        if (!this.unlocked || this.muted) return;
        this._stealVoice();
        const ctx = this.ctx;
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        // um sweep negativo grande pode levar a frequência a zero/negativo, o que o WebAudio
        // rejeita — o piso de 20 Hz mantém a rampa válida sem mudar o efeito audível
        if (sweep) {
            osc.frequency.linearRampToValueAtTime(Math.max(20, freq + sweep), ctx.currentTime + dur);
        }
        const g = ctx.createGain();
        g.gain.setValueAtTime(gain, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
        osc.connect(g);
        g.connect(this.masterGain);
        osc.start();
        osc.stop(ctx.currentTime + dur + 0.02);
        this._voicePool.push({ osc });
    }

    /** Dispara um SFX nomeado da biblioteca (timbre e sweep vêm da definição). */
    play(id) {
        if (!this.unlocked) return;
        const def = SFX_LIBRARY[id];
        if (!def) return;
        this.blip({
            freq: def.freq,
            dur: def.dur,
            gain: def.gain,
            type: def.type || 'square',
            sweep: def.sweep || 0
        });
    }

    // ---- Tracker: scheduler simples com lookahead ----
    playSong(name) {
        if (!this.unlocked) return;
        const song = SONGS[name] || STINGERS[name];
        if (!song) return;
        // repetir a faixa que já está tocando reiniciaria o compasso a cada troca de cena —
        // manter o loop correndo é o que dá continuidade entre briefing, jogo e resultado
        if (this._songState && this._songName === name) return;
        this.stopSong();
        this._songName = name;
        this._songState = {
            song, orderIdx: 0, rowIdx: 0,
            rowDurSec: 60 / song.bpm / 4,
            nextRowTime: this.ctx.currentTime
        };
        this._schedulerId = setInterval(() => this._tickScheduler(), 25);
    }

    stopSong() {
        if (this._schedulerId) { clearInterval(this._schedulerId); this._schedulerId = null; }
        this._songState = null;
        this._songName = null;
        for (const id of ['p1', 'p2', 'tri']) {
            if (this.channels[id]) this.channels[id].gain.gain.setTargetAtTime(0, this.ctx?.currentTime || 0, 0.05);
        }
        if (this.channels.nz) this.channels.nz.gain.gain.setTargetAtTime(0, this.ctx?.currentTime || 0, 0.05);
    }

    _tickScheduler() {
        const st = this._songState;
        if (!st || !this.ctx) return;
        const lookahead = 0.15;
        while (st.nextRowTime < this.ctx.currentTime + lookahead) {
            this._scheduleRow(st);
            st.rowIdx++;
            if (st.rowIdx >= st.song.rows) {
                st.rowIdx = 0;
                st.orderIdx = (st.orderIdx + 1) % st.song.order.length;
            }
            st.nextRowTime += st.rowDurSec;
        }
    }

    _scheduleRow(st) {
        const patIdx = st.song.order[st.orderIdx];
        const pattern = st.song.patterns[patIdx];
        if (!pattern) return;
        const t = st.nextRowTime;
        const dur = st.rowDurSec;

        this._scheduleToken(pattern.p1, st.rowIdx, t, dur, this.channels.p1, 'p1');
        this._scheduleToken(pattern.p2, st.rowIdx, t, dur, this.channels.p2, 'p2');
        this._scheduleToken(pattern.tri, st.rowIdx, t, dur, this.channels.tri, 'tri');
        this._scheduleNoise(pattern.nz, st.rowIdx, t, dur);
    }

    _scheduleToken(rowStr, rowIdx, t, dur, channel, chId) {
        if (!rowStr || !channel) return;
        const tokens = rowStr.trim().split(/\s+/);
        const tok = tokens[rowIdx];
        if (!tok || tok === '-') return;
        if (tok === '.') {
            channel.gain.gain.setTargetAtTime(0, t, 0.01);
            return;
        }
        const freq = noteToFreq(tok);
        if (!freq) return;
        channel.osc.frequency.setValueAtTime(freq, t);
        channel.gain.gain.cancelScheduledValues(t);
        channel.gain.gain.setValueAtTime(chId === 'tri' ? 0.15 : 0.1, t);
        channel.gain.gain.setTargetAtTime(0.0001, t + dur * 0.85, dur * 0.15);
    }

    _scheduleNoise(rowStr, rowIdx, t, dur) {
        if (!rowStr) return;
        const tokens = rowStr.trim().split(/\s+/);
        const tok = tokens[rowIdx];
        const nz = this.channels.nz;
        if (!tok || tok === '.' || !nz) return;
        const freqMap = { k: 150, s: 2000, h: 6000 };
        nz.filter.frequency.setValueAtTime(freqMap[tok] || 3000, t);
        nz.gain.gain.cancelScheduledValues(t);
        nz.gain.gain.setValueAtTime(0.18, t);
        nz.gain.gain.setTargetAtTime(0.0001, t + 0.04, 0.03);
    }

    playStinger(name) {
        this.playSong(name);
    }
}

export function createAudio() {
    return new AudioEngine();
}
