/** Small procedural soundscape: no network audio, one shared noise buffer.
 * Audio starts only after a gesture and is suspended with the game. */
export class Soundscape {
    constructor() { this.context = null; this.hoof = 0; this.bird = 4; }
    async start(settings) {
        try {
            if (!this.context) {
                const Audio = window.AudioContext || window.webkitAudioContext;
                if (!Audio) return;
                const c = this.context = new Audio();
                this.master = c.createGain(); this.master.connect(c.destination);
                this.noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
                const samples = this.noise.getChannelData(0);
                for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
                const wind = c.createBufferSource(), filter = c.createBiquadFilter();
                wind.buffer = this.noise; wind.loop = true; filter.type = 'lowpass'; filter.frequency.value = 320;
                this.wind = c.createGain(); this.wind.gain.value = .025;
                wind.connect(filter).connect(this.wind).connect(this.master); wind.start();
            }
            this.configure(settings); await this.context.resume();
        } catch { /* Audio is optional when the browser blocks or lacks Web Audio. */ }
    }
    configure(settings) { if (this.master) this.master.gain.setTargetAtTime(settings.muted ? 0 : settings.volume / 100 * .45, this.context.currentTime, .05); }
    pause() { this.context?.suspend().catch(() => {}); }
    tone(frequency, duration, volume = .2, type = 'sine', end = frequency / 2) {
        const c = this.context; if (!c || c.state !== 'running') return;
        const o = c.createOscillator(), gain = c.createGain(), t = c.currentTime;
        o.type = type; o.frequency.setValueAtTime(frequency, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, end), t + duration);
        gain.gain.setValueAtTime(volume, t); gain.gain.exponentialRampToValueAtTime(.001, t + duration);
        o.connect(gain).connect(this.master); o.start(); o.stop(t + duration + .02);
        o.onended = () => { o.disconnect(); gain.disconnect(); };
    }
    burst(duration, volume, frequency) {
        const c = this.context; if (!c || c.state !== 'running') return;
        const source = c.createBufferSource(), filter = c.createBiquadFilter(), gain = c.createGain(), t = c.currentTime;
        source.buffer = this.noise; filter.type = 'lowpass'; filter.frequency.value = frequency;
        gain.gain.setValueAtTime(volume, t); gain.gain.exponentialRampToValueAtTime(.001, t + duration);
        source.connect(filter).connect(gain).connect(this.master); source.start(t, Math.random()); source.stop(t + duration);
        source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
    }
    shot() { this.burst(.24, .55, 4000); this.tone(125, .23, .5, 'triangle', 35); }
    reload() { this.tone(1200, .045, .07, 'triangle', 450); }
    reward() { this.tone(440, .32, .12, 'sine', 660); }
    update(dt, speed, hour) {
        if (!this.context || this.context.state !== 'running') return;
        this.wind.gain.setTargetAtTime(.025 + speed * .002, this.context.currentTime, .2);
        this.hoof -= dt; this.bird -= dt;
        if (speed > .7 && this.hoof <= 0) {
            this.hoof = Math.max(.12, .7 / Math.sqrt(speed));
            this.tone(160 + Math.random() * 60, .075, .2, 'triangle', 65); this.burst(.055, .07, 1100);
        }
        if (this.bird <= 0) {
            this.bird = 7 + Math.random() * 12;
            if (hour > 5 && hour < 20) this.tone(1800, .22, .025, 'sine', 2900);
        }
    }
}
