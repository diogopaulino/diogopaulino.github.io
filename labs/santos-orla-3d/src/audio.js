/**
 * Áudio ambiente sintético: mar, vento, cidade distante — mais buzina e sino de descoberta.
 * Só nasce após um gesto (start); qualquer falha da Web Audio é engolida (o lab segue mudo).
 * Buzina: dois quadrados a 415/523 Hz (≈ buzina dupla de carro), volume ∝ 1/(1 + d/12).
 */

export class OrlaAudio {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.volume = 0.65;
        this.started = false;
    }

    init() {
        try {
            if (this.ctx) {
                if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
                return;
            }
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return;
            const ctx = new Ctx();
            try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* iOS 17+ */ }
            this.ctx = ctx;
            this.master = ctx.createGain();
            this.master.gain.value = this.enabled ? this.volume : 0;
            this.master.connect(ctx.destination);

            this.sea = this._noisePad(0.22, 800, 0.35);
            this.wind = this._noisePad(0.1, 400, 0.5);
            this.city = this._drone(110, 0.04);
            this.started = true;
        } catch {
            this.ctx = null;
            this.started = false;
        }
    }

    /** Pausa/aba oculta: congela o contexto (não gasta CPU nem toca no fundo). */
    suspend() {
        if (this.ctx?.state === 'running') this.ctx.suspend().catch(() => {});
    }

    resume() {
        if (this.ctx?.state === 'suspended') this.ctx.resume().catch(() => {});
    }

    _noisePad(gain, filterFreq, q) {
        const ctx = this.ctx;
        const bufferSize = 2 * ctx.sampleRate;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = filterFreq;
        filter.Q.value = q;
        const g = ctx.createGain();
        g.gain.value = gain;
        src.connect(filter);
        filter.connect(g);
        g.connect(this.master);
        src.start();
        return { src, filter, gain: g };
    }

    _drone(freq, gain) {
        const ctx = this.ctx;
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.value = gain;
        osc.connect(g);
        g.connect(this.master);
        osc.start();
        return { osc, gain: g };
    }

    _tone(type, freq, start, dur, peak, filterHz = 0) {
        const ctx = this.ctx;
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, start);
        g.gain.linearRampToValueAtTime(peak, start + 0.015);
        g.gain.setValueAtTime(peak, start + dur * 0.7);
        g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
        let node = osc;
        if (filterHz) {
            const f = ctx.createBiquadFilter();
            f.type = 'lowpass';
            f.frequency.value = filterHz;
            osc.connect(f);
            node = f;
        }
        node.connect(g);
        g.connect(this.master);
        osc.start(start);
        osc.stop(start + dur + 0.05);
    }

    /** Buzina de carro a d metros do visitante. */
    honk(d = 10) {
        if (!this.started || !this.enabled || this.ctx.state !== 'running') return;
        try {
            const t = this.ctx.currentTime + 0.02;
            const amp = 0.07 / (1 + d / 12);
            this._tone('square', 415, t, 0.32, amp, 1800);
            this._tone('square', 523, t, 0.32, amp * 0.8, 1800);
        } catch { /* sem som */ }
    }

    /** Sino curto ao descobrir um ponto do roteiro (arpejo maior). */
    chime(final = false) {
        if (!this.started || !this.enabled || this.ctx.state !== 'running') return;
        try {
            const t = this.ctx.currentTime + 0.02;
            const notes = final ? [523.25, 659.25, 783.99, 1046.5] : [659.25, 987.77];
            notes.forEach((f, i) => this._tone('sine', f, t + i * 0.11, 0.9, 0.08));
        } catch { /* sem som */ }
    }

    setEnabled(on) {
        this.enabled = on;
        if (this.master) this.master.gain.setTargetAtTime(on ? this.volume : 0, this.ctx.currentTime, 0.05);
    }

    setVolume(v) {
        this.volume = v;
        if (this.master && this.enabled) {
            this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
        }
    }

    /** Intensidade conforme proximidade do mar e velocidade. */
    update(z, speed, night) {
        if (!this.started || this.ctx.state !== 'running') return;
        const seaProx = Math.max(0, Math.min(1, (z - 5) / 40));
        const t = this.ctx.currentTime;
        this.sea.gain.gain.setTargetAtTime(0.12 + seaProx * 0.28, t, 0.2);
        this.wind.gain.gain.setTargetAtTime(0.05 + speed * 0.012 + (night ? 0.04 : 0), t, 0.2);
        this.city.gain.gain.setTargetAtTime(night ? 0.025 : 0.045, t, 0.3);
    }
}
