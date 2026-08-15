/** Áudio procedural: vento, aço, impactos e trompas sem arquivos externos. */
export class BattleAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.ambience = [];
  }

  async start() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : .7;
      this.master.connect(this.ctx.destination);
      this.createAmbience();
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }

  setMuted(value) {
    this.muted = value;
    if (this.master && this.ctx) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.linearRampToValueAtTime(value ? 0 : .7, this.ctx.currentTime + .08);
    }
  }

  toggle() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  createNoiseBuffer(duration = 1) {
    const length = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = last * .72 + white * .28;
      data[i] = last;
    }
    return buffer;
  }

  createAmbience() {
    const wind = this.ctx.createBufferSource();
    wind.buffer = this.createNoiseBuffer(4);
    wind.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 650;
    const gain = this.ctx.createGain();
    gain.gain.value = .055;
    wind.connect(filter).connect(gain).connect(this.master);
    wind.start();

    const drone = this.ctx.createOscillator();
    drone.type = 'sine';
    drone.frequency.value = 43;
    const droneGain = this.ctx.createGain();
    droneGain.gain.value = .025;
    drone.connect(droneGain).connect(this.master);
    drone.start();
    this.ambience.push(wind, drone);
  }

  tone({ frequency = 180, endFrequency = frequency, duration = .15, gain = .15, type = 'sine', delay = 0 } = {}) {
    if (!this.ctx || !this.master || this.muted) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const envelope = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, frequency), now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration);
    envelope.gain.setValueAtTime(.0001, now);
    envelope.gain.exponentialRampToValueAtTime(gain, now + .015);
    envelope.gain.exponentialRampToValueAtTime(.0001, now + duration);
    osc.connect(envelope).connect(this.master);
    osc.start(now);
    osc.stop(now + duration + .03);
  }

  noise({ duration = .13, gain = .12, highpass = 300, delay = 0 } = {}) {
    if (!this.ctx || !this.master || this.muted) return;
    const now = this.ctx.currentTime + delay;
    const source = this.ctx.createBufferSource();
    source.buffer = this.createNoiseBuffer(duration + .04);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = highpass;
    const envelope = this.ctx.createGain();
    envelope.gain.setValueAtTime(gain, now);
    envelope.gain.exponentialRampToValueAtTime(.0001, now + duration);
    source.connect(filter).connect(envelope).connect(this.master);
    source.start(now);
  }

  swing(heavy = false) {
    this.noise({ duration: heavy ? .28 : .18, gain: heavy ? .17 : .11, highpass: 700 });
    this.tone({ frequency: heavy ? 145 : 220, endFrequency: heavy ? 60 : 105, duration: heavy ? .27 : .15, gain: .08, type: 'triangle' });
  }

  hit(armored = false) {
    this.noise({ duration: .09, gain: .2, highpass: armored ? 1100 : 280 });
    this.tone({ frequency: armored ? 980 : 120, endFrequency: armored ? 460 : 55, duration: armored ? .22 : .16, gain: .17, type: armored ? 'square' : 'sine' });
    if (armored) this.tone({ frequency: 1320, endFrequency: 780, duration: .13, gain: .07, type: 'sine', delay: .018 });
  }

  block(perfect = false) {
    this.hit(true);
    this.tone({ frequency: perfect ? 1540 : 870, endFrequency: 430, duration: perfect ? .42 : .24, gain: perfect ? .13 : .08, type: 'triangle' });
  }

  dodge() {
    this.noise({ duration: .24, gain: .08, highpass: 450 });
  }

  horn() {
    [0, .08, .16].forEach((delay, index) => {
      this.tone({ frequency: 92 + index * 2, endFrequency: 86, duration: 1.15, gain: .055, type: 'sawtooth', delay });
    });
  }

  death() {
    this.tone({ frequency: 110, endFrequency: 38, duration: .55, gain: .12, type: 'sawtooth' });
    this.noise({ duration: .42, gain: .07, highpass: 80 });
  }

  victory() {
    [196, 247, 294, 392].forEach((frequency, index) => {
      this.tone({ frequency, endFrequency: frequency * .98, duration: .7, gain: .06, type: 'triangle', delay: index * .15 });
    });
  }
}
