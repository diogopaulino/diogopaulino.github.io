/**
 * Trilha synthwave procedural + SFX de motor, coleta e batida.
 * Osciladores nativos da Web Audio API — nenhuma amostra externa.
 *
 * Padrão: 108 BPM, baixo em lá menor, arpejo 16ths, kick/snare/hats.
 *
 * MOTOR: o tom segue o conta-giros da física — frequência fundamental = rpm / 60 (uma
 * explosão por volta audível), harmônico 2× em onda quadrada, filtro passa-baixa que abre com o
 * acelerador. Troca de marcha = corte curto (quickshifter). VENTO: ruído filtrado com ganho
 * ∝ v² (o mesmo v² do arrasto aerodinâmico).
 * Tudo protegido por try/catch: sem Web Audio (ou bloqueado), o jogo segue mudo.
 */

export class GameAudio {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.volume = 0.72;
        this.master = null;
        this.music = null;
        this.engine = null;
        this.step = 0;
        this.acc = 0;
        this.bpm = 108;
        this.station = 0;
        this.started = false;
    }

    async resume() {
        if (!this.enabled) return;
        try {
            if (!this.ctx) this.boot();
            if (!this.ctx) return;
            if (this.ctx.state === 'suspended') await this.ctx.resume();
            this.started = true;
        } catch (err) {
            /* autoplay bloqueado: tenta de novo no próximo gesto */
        }
    }

    boot() {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        this.ctx = new AudioCtx();
        // um segundo de ruído branco reaproveitado por caixa, chimbal, batida e vento
        this.noiseBuf = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
        const data = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        this.master = this.ctx.createGain();
        this.master.gain.value = this.volume;
        this.master.connect(this.ctx.destination);

        this.music = this.ctx.createGain();
        this.music.gain.value = 0.55;
        this.music.connect(this.master);

        this.engine = this.ctx.createOscillator();
        this.engine.type = 'sawtooth';
        this.engine.frequency.value = 48;
        this.engine2 = this.ctx.createOscillator();
        this.engine2.type = 'square';
        this.engine2.frequency.value = 96;
        const e2Gain = this.ctx.createGain();
        e2Gain.gain.value = 0.35;
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0;
        this.engineFilter = this.ctx.createBiquadFilter();
        this.engineFilter.type = 'lowpass';
        this.engineFilter.frequency.value = 900;
        this.engine.connect(this.engineFilter);
        this.engine2.connect(e2Gain);
        e2Gain.connect(this.engineFilter);
        this.engineFilter.connect(this.engineGain);
        this.engineGain.connect(this.master);
        this.engine.start();
        this.engine2.start();

        const wind = this.ctx.createBufferSource();
        wind.buffer = this.noiseBuf;
        wind.loop = true;
        const windFilter = this.ctx.createBiquadFilter();
        windFilter.type = 'bandpass';
        windFilter.frequency.value = 900;
        windFilter.Q.value = 0.6;
        this.windGain = this.ctx.createGain();
        this.windGain.gain.value = 0;
        wind.connect(windFilter);
        windFilter.connect(this.windGain);
        this.windGain.connect(this.master);
        wind.start();
    }

    setVolume(v) {
        this.volume = v;
        if (this.master) this.master.gain.value = this.enabled ? v : 0;
    }

    setEnabled(on) {
        this.enabled = on;
        if (this.master) this.master.gain.value = on ? this.volume : 0;
    }

    setStation(index) {
        this.station = index % 4;
        this.bpm = [108, 100, 116, 112][this.station];
    }

    /** Silencia motor/vento (pausa, menus) sem parar os osciladores. */
    idle() {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this.engineGain.gain.setTargetAtTime(0, t, 0.08);
        this.windGain.gain.setTargetAtTime(0, t, 0.08);
    }

    /**
     * eng = { rpm, redline, throttle, speed (m/s), nitro, shifted }
     */
    update(dt, eng) {
        if (!this.ctx || !this.enabled || !this.started) return;
        const stepDur = 60 / this.bpm / 4;
        this.acc += dt;
        while (this.acc >= stepDur) {
            this.acc -= stepDur;
            this.tick(this.step);
            this.step = (this.step + 1) % 16;
        }
        if (this.engine && eng) {
            const t = this.ctx.currentTime;
            const f = Math.max(20, eng.rpm / 60);
            this.engine.frequency.setTargetAtTime(f, t, 0.02);
            this.engine2.frequency.setTargetAtTime(f * 2, t, 0.02);
            this.engineFilter.frequency.setTargetAtTime(500 + eng.throttle * 1700 + (eng.nitro ? 900 : 0), t, 0.05);
            let g = 0.022 + eng.throttle * 0.045 + (eng.rpm / eng.redline) * 0.025 + (eng.nitro ? 0.02 : 0);
            if (eng.shifted > 0) {
                // quickshifter: corte de ~50 ms na ignição
                this.engineGain.gain.cancelScheduledValues(t);
                this.engineGain.gain.setValueAtTime(g * 0.25, t);
            }
            this.engineGain.gain.setTargetAtTime(g, t, eng.shifted > 0 ? 0.05 : 0.03);
            const w = Math.min(1, eng.speed / 85);
            this.windGain.gain.setTargetAtTime(w * w * 0.16, t, 0.1);
        }
    }

    tick(step) {
        const t = this.ctx.currentTime;
        const roots = [
            [33, 33, 36, 33, 29, 29, 31, 33],
            [29, 29, 32, 29, 24, 24, 26, 29],
            [36, 36, 38, 36, 31, 31, 33, 36],
            [28, 28, 31, 28, 24, 24, 26, 28]
        ][this.station];
        const bass = roots[Math.floor(step / 2) % roots.length];

        if (step % 2 === 0) this.note(this.mtof(bass), 0.18, 0.09, 'sawtooth', 220, t);
        if (step % 4 === 0) this.kick(t);
        if (step === 4 || step === 12) this.snare(t);
        if (step % 2 === 1) this.hat(t, 0.03);

        const arp = [0, 3, 7, 12, 7, 3, 10, 7];
        const a = this.mtof(bass + 12 + arp[step % arp.length]);
        this.note(a, 0.09, 0.045, 'square', 1800, t);
    }

    mtof(m) {
        return 440 * 2 ** ((m - 69) / 12);
    }

    note(freq, dur, gain, type, cutoff, t) {
        const osc = this.ctx.createOscillator();
        osc.type = type;
        osc.frequency.value = freq;
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = cutoff;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(f);
        f.connect(g);
        g.connect(this.music);
        osc.start(t);
        osc.stop(t + dur + 0.02);
    }

    kick(t) {
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(140, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.22, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
        osc.connect(g);
        g.connect(this.music);
        osc.start(t);
        osc.stop(t + 0.18);
    }

    snare(t) {
        const n = this.noise(t, 0.08, 0.12, 1800);
        n.connect(this.music);
    }

    hat(t, gain) {
        const n = this.noise(t, 0.03, gain, 7000);
        n.connect(this.music);
    }

    noise(t, dur, gain, cutoff) {
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuf;
        const f = this.ctx.createBiquadFilter();
        f.type = 'highpass';
        f.frequency.value = cutoff * 0.4;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(gain, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(f);
        f.connect(g);
        // trecho aleatório do buffer compartilhado (sem alocar ruído novo a cada batida)
        src.start(t, Math.random() * 0.6, dur + 0.02);
        return g;
    }

    collect() {
        if (!this.ctx || !this.enabled) return;
        const t = this.ctx.currentTime;
        this.note(880, 0.08, 0.08, 'square', 2400, t);
        this.note(1320, 0.12, 0.07, 'square', 2800, t + 0.06);
    }

    crash() {
        if (!this.ctx || !this.enabled) return;
        const t = this.ctx.currentTime;
        this.noise(t, 0.28, 0.22, 900).connect(this.master);
        this.note(90, 0.25, 0.12, 'sawtooth', 400, t);
    }

    boostWhoosh() {
        if (!this.ctx || !this.enabled) return;
        const t = this.ctx.currentTime;
        this.note(220, 0.18, 0.05, 'sawtooth', 1200, t);
        this.noise(t, 0.35, 0.08, 2600).connect(this.master);
    }

    /** Bipe da contagem de largada (o "VAI" é uma oitava acima e mais longo). */
    beep(go = false) {
        if (!this.ctx || !this.enabled) return;
        const t = this.ctx.currentTime;
        this.note(go ? 1320 : 660, go ? 0.32 : 0.14, 0.07, 'square', 3200, t);
    }

    /** Ultrapassagem raspando: "fwip" curto. */
    whoosh() {
        if (!this.ctx || !this.enabled) return;
        const t = this.ctx.currentTime;
        this.noise(t, 0.22, 0.12, 1400).connect(this.master);
        this.note(1046, 0.08, 0.035, 'square', 3000, t + 0.04);
    }

    /** Raspão no carro ou no meio-fio. */
    scrape() {
        if (!this.ctx || !this.enabled) return;
        const t = this.ctx.currentTime;
        this.noise(t, 0.18, 0.14, 3200).connect(this.master);
    }
}
