/**
 * Áudio ambiente sintético: mar, vento, cidade distante.
 */

export class OrlaAudio {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.volume = 0.65;
        this.started = false;
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
        this.master.connect(ctx.destination);

        this.sea = this._noisePad(0.22, 800, 0.35);
        this.wind = this._noisePad(0.1, 400, 0.5);
        this.city = this._drone(110, 0.04);
        this.started = true;
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
        if (!this.started) return;
        const seaProx = Math.max(0, Math.min(1, (z - 5) / 40));
        this.sea.gain.gain.setTargetAtTime(0.12 + seaProx * 0.28, this.ctx.currentTime, 0.2);
        this.wind.gain.gain.setTargetAtTime(0.05 + speed * 0.008 + (night ? 0.04 : 0), this.ctx.currentTime, 0.2);
        this.city.gain.gain.setTargetAtTime(night ? 0.025 : 0.045, this.ctx.currentTime, 0.3);
    }
}
