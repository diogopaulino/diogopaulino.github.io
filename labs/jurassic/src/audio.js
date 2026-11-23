/**
 * Selva procedural: insetos, vento, motor do jipe e rugidos.
 * Osciladores nativos — nenhuma amostra externa.
 *
 * MOTOR — diesel de 4 cilindros: frequência de explosão f = rpm/60 · 2 (dois
 * tempos de potência por volta); a serra toca f, a quadrada f/2 (ronco).
 * Volume e brilho (passa-baixa) sobem com a carga do acelerador e a rotação;
 * a troca de marcha aparece sozinha na queda de rpm que vem de jeep.js.
 * CASCALHO — ruído em passa-banda (~900 Hz) com ganho ∝ deslizamento lateral.
 * Tudo só liga após um gesto (resume) e nunca lança erro se o áudio faltar.
 */

import { clamp } from './utils.js?v=23';

export class ParkAudio {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.volume = 0.72;
        this.master = null;
        this.ambience = null;
        this.engine = null;
        this.engineGain = null;
        this.engineFilter = null;
        this.started = false;
        this.bugAcc = 0;
        this.roarCool = 0;
    }

    async resume() {
        if (!this.enabled) return;
        try {
            if (!this.ctx) this.boot();
            if (this.ctx.state === 'suspended') await this.ctx.resume();
            this.started = true;
        } catch {
            // sem Web Audio (ou bloqueado): o jogo segue mudo
            this.ctx = null;
            this.started = false;
        }
    }

    boot() {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioCtx();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.volume;
        this.master.connect(this.ctx.destination);

        this.ambience = this.ctx.createGain();
        this.ambience.gain.value = 0.22;
        this.ambience.connect(this.master);

        const noise = this._noise(2);
        const lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 900;
        const windGain = this.ctx.createGain();
        windGain.gain.value = 0.18;
        noise.connect(lp);
        lp.connect(windGain);
        windGain.connect(this.ambience);
        this.windGain = windGain;

        this.engine = this.ctx.createOscillator();
        this.engine.type = 'sawtooth';
        this.engine.frequency.value = 42;
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0;
        this.engineFilter = this.ctx.createBiquadFilter();
        this.engineFilter.type = 'lowpass';
        this.engineFilter.frequency.value = 420;
        const engine2 = this.ctx.createOscillator();
        engine2.type = 'square';
        engine2.frequency.value = 21;
        const g2 = this.ctx.createGain();
        g2.gain.value = 0.25;
        this.engine.connect(this.engineFilter);
        engine2.connect(g2);
        g2.connect(this.engineFilter);
        this.engineFilter.connect(this.engineGain);
        this.engineGain.connect(this.master);
        this.engine.start();
        engine2.start();
        this.engine2 = engine2;

        // cascalho/derrapagem
        const grit = this._noise(1);
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 900;
        bp.Q.value = 0.8;
        this.skidGain = this.ctx.createGain();
        this.skidGain.gain.value = 0;
        grit.connect(bp);
        bp.connect(this.skidGain);
        this.skidGain.connect(this.master);
    }

    /** Batida seca (colisão); `k` 0..1. */
    bump(k = 1) {
        if (!this.ctx || !this.enabled || k < 0.05) return;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        const now = this.ctx.currentTime;
        o.type = 'triangle';
        o.frequency.setValueAtTime(140, now);
        o.frequency.exponentialRampToValueAtTime(45, now + 0.18);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(Math.min(0.5, 0.35 * k), now + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
        o.connect(g);
        g.connect(this.master);
        o.start(now);
        o.stop(now + 0.32);
    }

    _noise(seconds) {
        const n = this.ctx.createBufferSource();
        const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * seconds, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        n.buffer = buf;
        n.loop = true;
        n.start();
        return n;
    }

    setVolume(v) {
        this.volume = v;
        if (this.master) this.master.gain.value = this.enabled ? v : 0;
    }

    setEnabled(on) {
        this.enabled = on;
        if (this.master) this.master.gain.value = on ? this.volume : 0;
    }

    chirp() {
        if (!this.ctx || !this.enabled) return;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'triangle';
        o.frequency.value = 2800 + Math.random() * 1800;
        g.gain.value = 0.03;
        o.connect(g);
        g.connect(this.ambience);
        o.start();
        o.frequency.exponentialRampToValueAtTime(1400, this.ctx.currentTime + 0.08);
        g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.12);
        o.stop(this.ctx.currentTime + 0.14);
    }

    roar(intense = 1) {
        if (!this.ctx || !this.enabled || this.roarCool > 0) return;
        this.roarCool = 3.2;
        const o = this.ctx.createOscillator();
        const o2 = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        const f = this.ctx.createBiquadFilter();
        o.type = 'sawtooth';
        o2.type = 'square';
        o.frequency.value = 55;
        o2.frequency.value = 38;
        f.type = 'lowpass';
        f.frequency.value = 280;
        g.gain.value = 0.0001;
        o.connect(f);
        o2.connect(f);
        f.connect(g);
        g.connect(this.master);
        const now = this.ctx.currentTime;
        g.gain.exponentialRampToValueAtTime(0.22 * intense, now + 0.12);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 1.6);
        o.frequency.exponentialRampToValueAtTime(32, now + 1.4);
        o.start();
        o2.start();
        o.stop(now + 1.7);
        o2.stop(now + 1.7);
    }

    /** Baque grave de um passo pesado; `k` 0..1 = proximidade/peso. */
    thud(k = 1) {
        if (!this.ctx || !this.enabled || k < 0.03) return;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        const now = this.ctx.currentTime;
        o.type = 'sine';
        o.frequency.setValueAtTime(62, now);
        o.frequency.exponentialRampToValueAtTime(26, now + 0.28);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(Math.min(0.5, 0.42 * k), now + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
        o.connect(g);
        g.connect(this.master);
        o.start(now);
        o.stop(now + 0.45);
    }

    /** Trovão: ruído filtrado em passa-baixa com cauda longa. */
    thunder(k = 1) {
        if (!this.ctx || !this.enabled) return;
        const n = this._noise(2);
        const f = this.ctx.createBiquadFilter();
        const g = this.ctx.createGain();
        const now = this.ctx.currentTime;
        f.type = 'lowpass';
        f.frequency.setValueAtTime(900, now);
        f.frequency.exponentialRampToValueAtTime(90, now + 2.4);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(0.5 * k, now + 0.06);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 3.2);
        n.connect(f);
        f.connect(g);
        g.connect(this.master);
        n.stop(now + 3.3);
    }

    spark() {
        if (!this.ctx || !this.enabled) return;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'square';
        o.frequency.value = 1200 + Math.random() * 800;
        g.gain.value = 0.04;
        o.connect(g);
        g.connect(this.master);
        o.start();
        g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.05);
        o.stop(this.ctx.currentTime + 0.06);
    }

    /**
     * @param {number} rpm   rotação do motor (jeep.rpm)
     * @param {number} load  0..1 acelerador
     * @param {number} skid  m/s de deslizamento lateral
     */
    update(dt, speed, raining, nearRex, rpm = 850 + Math.abs(speed) * 180, load = 0, skid = 0) {
        if (!this.ctx || !this.enabled || !this.started) return;
        this.roarCool = Math.max(0, this.roarCool - dt);
        const f = (rpm / 60) * 2;
        const now = this.ctx.currentTime;
        // rampas curtas: sem degraus audíveis entre quadros
        this.engine.frequency.setTargetAtTime(f, now, 0.04);
        this.engine2.frequency.setTargetAtTime(f * 0.5, now, 0.04);
        this.engineFilter.frequency.setTargetAtTime(260 + rpm * 0.11 + load * 380, now, 0.05);
        this.engineGain.gain.setTargetAtTime(clamp(0.035 + (rpm - 850) / 3150 * 0.07 + load * 0.08, 0, 0.22), now, 0.06);
        if (this.skidGain) this.skidGain.gain.setTargetAtTime(clamp((Math.abs(skid) - 1.2) * 0.05, 0, 0.16), now, 0.05);
        if (this.windGain) this.windGain.gain.value = raining ? 0.32 : 0.16;

        this.bugAcc += dt;
        if (this.bugAcc > 0.45 + Math.random() * 0.8) {
            this.bugAcc = 0;
            this.chirp();
        }
        if (nearRex && this.roarCool <= 0) this.roar(1.15);
    }
}
