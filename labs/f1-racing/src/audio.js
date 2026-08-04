/**
 * Fully synthesised sound: no samples. The engine is built from a harmonic stack
 * whose fundamental tracks firing frequency (rpm/60 × 3 for a V6), plus filtered
 * noise layers for tyres, wind and rain.
 */

const CYLINDER_FACTOR = 3;   // V6 → three power strokes per revolution

function noiseBuffer(ctx, seconds = 2) {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02;   // brownish noise, less hissy
        data[i] = last * 3.5;
    }
    return buffer;
}

export class AudioEngine {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.volume = 0.7;
        this.started = false;
    }

    /** Must be called from a user gesture. */
    async start() {
        if (this.started) {
            if (this.ctx?.state === 'suspended') await this.ctx.resume();
            return;
        }
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        this.ctx = new Ctx({ latencyHint: 'interactive' });
        const ctx = this.ctx;
        this.started = true;

        this.master = ctx.createGain();
        this.master.gain.value = this.volume;

        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = -14;
        compressor.knee.value = 22;
        compressor.ratio.value = 8;
        compressor.attack.value = 0.004;
        compressor.release.value = 0.18;
        this.master.connect(compressor).connect(ctx.destination);

        this.noise = noiseBuffer(ctx);

        /* --- engine ------------------------------------------------- */
        this.engineGain = ctx.createGain();
        this.engineGain.gain.value = 0;

        this.engineFilter = ctx.createBiquadFilter();
        this.engineFilter.type = 'lowpass';
        this.engineFilter.frequency.value = 1200;
        this.engineFilter.Q.value = 1.1;

        // Slight stereo spread makes the V6 feel like it wraps around you.
        const spread = ctx.createStereoPanner();
        spread.pan.value = 0;
        this.engineGain.connect(this.engineFilter).connect(spread).connect(this.master);

        // Harmonic stack: fundamental + the ratios that give an F1 its wail.
        this.harmonics = [
            { ratio: 0.5, gain: 0.30, type: 'sawtooth' },
            { ratio: 1, gain: 1.00, type: 'sawtooth' },
            { ratio: 1.5, gain: 0.24, type: 'square' },
            { ratio: 2, gain: 0.45, type: 'sawtooth' },
            { ratio: 3, gain: 0.20, type: 'triangle' },
            { ratio: 4, gain: 0.12, type: 'sawtooth' }
        ].map((h) => {
            const osc = ctx.createOscillator();
            osc.type = h.type;
            const gain = ctx.createGain();
            gain.gain.value = h.gain;
            osc.connect(gain).connect(this.engineGain);
            osc.start();
            return { osc, gain, ratio: h.ratio, base: h.gain };
        });

        // Turbo / MGU-H whistle.
        this.turbo = ctx.createOscillator();
        this.turbo.type = 'sine';
        this.turboGain = ctx.createGain();
        this.turboGain.gain.value = 0;
        this.turbo.connect(this.turboGain).connect(this.master);
        this.turbo.start();

        // Intake roar: noise shaped by a resonant bandpass that follows rpm.
        this.intake = ctx.createBufferSource();
        this.intake.buffer = this.noise;
        this.intake.loop = true;
        this.intakeFilter = ctx.createBiquadFilter();
        this.intakeFilter.type = 'bandpass';
        this.intakeFilter.frequency.value = 600;
        this.intakeFilter.Q.value = 3;
        this.intakeGain = ctx.createGain();
        this.intakeGain.gain.value = 0;
        this.intake.connect(this.intakeFilter).connect(this.intakeGain).connect(this.master);
        this.intake.start();

        /* --- rival engines ------------------------------------------ */
        this.rivalOsc = ctx.createOscillator();
        this.rivalOsc.type = 'sawtooth';
        this.rivalPan = ctx.createStereoPanner();
        this.rivalGain = ctx.createGain();
        this.rivalGain.gain.value = 0;
        this.rivalFilter = ctx.createBiquadFilter();
        this.rivalFilter.type = 'lowpass';
        this.rivalFilter.frequency.value = 900;
        this.rivalOsc.connect(this.rivalFilter).connect(this.rivalGain).connect(this.rivalPan).connect(this.master);
        this.rivalOsc.start();

        /* --- tyres ---------------------------------------------------- */
        this.tyre = ctx.createBufferSource();
        this.tyre.buffer = this.noise;
        this.tyre.loop = true;
        this.tyreFilter = ctx.createBiquadFilter();
        this.tyreFilter.type = 'bandpass';
        this.tyreFilter.frequency.value = 1900;
        this.tyreFilter.Q.value = 7;
        this.tyreGain = ctx.createGain();
        this.tyreGain.gain.value = 0;
        this.tyre.connect(this.tyreFilter).connect(this.tyreGain).connect(this.master);
        this.tyre.start();

        /* --- wind + rain ---------------------------------------------- */
        this.wind = ctx.createBufferSource();
        this.wind.buffer = this.noise;
        this.wind.loop = true;
        this.windFilter = ctx.createBiquadFilter();
        this.windFilter.type = 'lowpass';
        this.windFilter.frequency.value = 700;
        this.windGain = ctx.createGain();
        this.windGain.gain.value = 0;
        this.wind.connect(this.windFilter).connect(this.windGain).connect(this.master);
        this.wind.start();

        this.rain = ctx.createBufferSource();
        this.rain.buffer = this.noise;
        this.rain.loop = true;
        this.rainFilter = ctx.createBiquadFilter();
        this.rainFilter.type = 'highpass';
        this.rainFilter.frequency.value = 3200;
        this.rainGain = ctx.createGain();
        this.rainGain.gain.value = 0;
        this.rain.connect(this.rainFilter).connect(this.rainGain).connect(this.master);
        this.rain.start();
    }

    setVolume(value) {
        this.volume = value;
        if (this.master) this.master.gain.value = value;
    }

    setEnabled(enabled) {
        this.enabled = enabled;
        if (this.master) this.master.gain.value = enabled ? this.volume : 0;
    }

    suspend() {
        this.ctx?.suspend?.();
    }

    resume() {
        if (this.ctx?.state === 'suspended') this.ctx.resume();
    }

    /**
     * Per-frame engine state.
     * @param {object} s {rpm, throttle, load, speed, slip, wet, gearChange, offTrack}
     */
    update(s, dt) {
        if (!this.ctx || !this.enabled) return;
        const now = this.ctx.currentTime;
        const smooth = Math.min(1, dt * 18);

        const fundamental = Math.max(40, (s.rpm / 60) * CYLINDER_FACTOR);
        for (const h of this.harmonics) {
            h.osc.frequency.setTargetAtTime(fundamental * h.ratio, now, 0.012);
            const load = 0.35 + s.throttle * 0.65;
            h.gain.gain.setTargetAtTime(h.base * load, now, 0.03);
        }

        const rpmNorm = Math.min(1, s.rpm / 15000);
        const engineLevel = (0.055 + rpmNorm * 0.13) * (0.4 + s.throttle * 0.6) * (s.gearChange ? 0.35 : 1);
        this.engineGain.gain.setTargetAtTime(engineLevel, now, 0.02);
        this.engineFilter.frequency.setTargetAtTime(700 + rpmNorm * 5200 + s.throttle * 1800, now, 0.02);

        this.turbo.frequency.setTargetAtTime(2400 + rpmNorm * 5200, now, 0.05);
        this.turboGain.gain.setTargetAtTime(0.012 * rpmNorm * s.throttle, now, 0.08);

        this.intakeFilter.frequency.setTargetAtTime(320 + rpmNorm * 1500, now, 0.03);
        this.intakeGain.gain.setTargetAtTime(0.05 * (0.3 + s.throttle) * rpmNorm, now, 0.04);

        this.tyreFilter.frequency.setTargetAtTime(1500 + s.slip * 900, now, 0.05);
        this.tyreGain.gain.setTargetAtTime(
            Math.min(0.16, Math.max(0, s.slip - 0.45) * 0.22 + (s.offTrack ? 0.09 : 0)), now, 0.05
        );

        this.windGain.gain.setTargetAtTime(Math.min(0.1, (s.speed / 90) ** 2 * 0.1), now, 0.1);
        this.windFilter.frequency.setTargetAtTime(400 + s.speed * 12, now, 0.1);

        this.rainGain.gain.setTargetAtTime(s.wet * 0.05, now, 0.4);

        if (s.rival) {
            const rf = Math.max(40, (s.rival.rpm / 60) * CYLINDER_FACTOR);
            this.rivalOsc.frequency.setTargetAtTime(rf, now, 0.03);
            this.rivalGain.gain.setTargetAtTime(Math.min(0.08, s.rival.level * 0.08), now, 0.06);
            this.rivalPan.pan.setTargetAtTime(s.rival.pan, now, 0.08);
        } else {
            this.rivalGain.gain.setTargetAtTime(0, now, 0.15);
        }
        void smooth;
    }

    /** Short transient helper. */
    blip({ frequency = 440, duration = 0.12, type = 'square', gain = 0.2, sweep = 0 }) {
        if (!this.ctx || !this.enabled) return;
        const ctx = this.ctx;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.setValueAtTime(frequency, now);
        if (sweep) osc.frequency.exponentialRampToValueAtTime(Math.max(30, frequency + sweep), now + duration);
        const env = ctx.createGain();
        env.gain.setValueAtTime(0.0001, now);
        env.gain.exponentialRampToValueAtTime(gain, now + 0.008);
        env.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        osc.connect(env).connect(this.master);
        osc.start(now);
        osc.stop(now + duration + 0.02);
    }

    burst({ duration = 0.25, gain = 0.3, frequency = 900, type = 'lowpass' }) {
        if (!this.ctx || !this.enabled) return;
        const ctx = this.ctx;
        const now = ctx.currentTime;
        const src = ctx.createBufferSource();
        src.buffer = this.noise;
        src.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = type;
        filter.frequency.value = frequency;
        const env = ctx.createGain();
        env.gain.setValueAtTime(gain, now);
        env.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        src.connect(filter).connect(env).connect(this.master);
        src.start(now);
        src.stop(now + duration + 0.05);
    }

    lightsBeep(index) {
        this.blip({ frequency: 620, duration: 0.35, type: 'square', gain: 0.16 });
        void index;
    }

    lightsOut() {
        this.blip({ frequency: 1180, duration: 0.7, type: 'sawtooth', gain: 0.2, sweep: -400 });
    }

    gearShift() {
        this.burst({ duration: 0.06, gain: 0.12, frequency: 2600, type: 'bandpass' });
    }

    drs(open) {
        this.burst({ duration: 0.18, gain: 0.1, frequency: open ? 1800 : 900, type: 'bandpass' });
    }

    contact(force) {
        const level = Math.min(0.45, 0.06 + force * 0.035);
        this.burst({ duration: 0.22, gain: level, frequency: 420, type: 'lowpass' });
        this.blip({ frequency: 90, duration: 0.2, type: 'triangle', gain: level * 0.7 });
    }

    kerb() {
        this.burst({ duration: 0.07, gain: 0.05, frequency: 260, type: 'lowpass' });
    }

    fanfare() {
        const notes = [523, 659, 784, 1046];
        notes.forEach((f, i) => setTimeout(() => this.blip({ frequency: f, duration: 0.32, type: 'triangle', gain: 0.18 }), i * 130));
    }

    dispose() {
        this.ctx?.close?.();
        this.ctx = null;
        this.started = false;
    }
}
