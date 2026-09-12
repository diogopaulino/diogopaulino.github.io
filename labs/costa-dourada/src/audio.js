/** Motor procedural via Web Audio — sem assets. */

export class GameAudio {
    constructor() {
        this.ctx = null;
        this.master = null;
        this.engine = null;
        this.enabled = false;
        this.volume = 0.7;
    }

    async resume() {
        if (!this.ctx) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            this.ctx = new Ctx();
            this.master = this.ctx.createGain();
            this.master.gain.value = this.volume;
            this.master.connect(this.ctx.destination);
            this._buildEngine();
        }
        if (this.ctx.state === 'suspended') await this.ctx.resume();
        this.enabled = true;
    }

    setMuted(muted) {
        this.enabled = !muted;
        if (this.master) this.master.gain.value = muted ? 0 : this.volume;
    }

    setVolume(v) {
        this.volume = v;
        if (this.master && this.enabled) this.master.gain.value = v;
    }

    _buildEngine() {
        const ctx = this.ctx;
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 800;
        const gain = ctx.createGain();
        gain.gain.value = 0;
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.master);
        osc.start();
        this.engine = { osc, filter, gain };
    }

    update(vehicle) {
        if (!this.engine || !this.enabled) return;
        const speed = Math.abs(vehicle.vx);
        const rpm = vehicle.rpm || 900;
        const freq = 55 + (rpm / 9000) * 180 + speed * 0.4;
        const now = this.ctx.currentTime;
        this.engine.osc.frequency.setTargetAtTime(freq, now, 0.05);
        this.engine.filter.frequency.setTargetAtTime(600 + speed * 18, now, 0.08);
        const amp = vehicle.throttle * 0.12 + Math.min(0.1, speed * 0.002);
        this.engine.gain.gain.setTargetAtTime(amp, now, 0.05);
    }
}
