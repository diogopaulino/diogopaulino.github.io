/**
 * Áudio sintetizado — bongos da selva + lead pentatônica.
 * Sem samples: Web Audio API puro.
 */

const BPM = 128;
const BEAT = 60 / BPM;

const NOTES = {
  C3: 130.81, E3: 164.81, G3: 196.0, A3: 220.0,
  C4: 261.63, D4: 293.66, E4: 329.63, G4: 392.0, A4: 440.0,
  C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99
};

/* Compasso 4/4, 8 compassos. Índices = semicolcheias. */
const MELODY = [
  'C4', 'E4', 0, 'G4', 0, 'E4', 'A4', 0,
  'G4', 0, 'E4', 'D4', 'C4', 0, 'E4', 0,
  'G4', 0, 'C5', 'G4', 0, 'E4', 'G4', 0,
  'A4', 'G4', 'E4', 0, 'C4', 0, 0, 0,
  'E4', 0, 'G4', 'A4', 0, 'G4', 'E4', 0,
  'C5', 0, 'A4', 'G4', 0, 'E4', 'D4', 0,
  'C4', 'E4', 'G4', 0, 'E4', 0, 'C4', 0,
  'G3', 0, 'C4', 0, 'E4', 0, 'C4', 0
];

const BASS = [
  'C3', 0, 0, 0, 'G3', 0, 0, 0,
  'A3', 0, 0, 0, 'G3', 0, 0, 0,
  'C3', 0, 0, 0, 'E3', 0, 0, 0,
  'G3', 0, 0, 0, 'C3', 0, 0, 0
];

export class KongAudio {
  constructor() {
    this.ctx = null;
    this.muted = this.readMuted();
    this.musicOn = false;
    this.step = 0;
    this.nextTime = 0;
    this.timer = 0;
    this.master = null;
  }

  readMuted() {
    try {
      return localStorage.getItem('kongKongMuted') === 'true';
    } catch {
      return false;
    }
  }

  persist() {
    try {
      localStorage.setItem('kongKongMuted', String(this.muted));
    } catch {
      /* ignore */
    }
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  toggleMute() {
    this.muted = !this.muted;
    this.persist();
    if (this.muted) this.stopMusic();
    else {
      this.ensure();
      this.play('select');
    }
    return this.muted;
  }

  tone(freq, dur, type, vol, at) {
    const ctx = this.ensure();
    if (!ctx || this.muted) return;
    const t = at ?? ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  noise(dur, vol, at) {
    const ctx = this.ensure();
    if (!ctx || this.muted) return;
    const t = at ?? ctx.currentTime;
    const n = Math.max(1, (ctx.sampleRate * dur) | 0);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  play(kind) {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    switch (kind) {
      case 'jump':
        this.tone(220, 0.12, 'square', 0.09, t);
        this.tone(340, 0.1, 'square', 0.06, t + 0.04);
        break;
      case 'roll':
        this.noise(0.12, 0.05, t);
        this.tone(140, 0.14, 'sawtooth', 0.04, t);
        break;
      case 'banana':
        this.tone(660, 0.08, 'sine', 0.07, t);
        this.tone(880, 0.1, 'sine', 0.05, t + 0.05);
        break;
      case 'bunch':
        this.tone(520, 0.08, 'triangle', 0.07, t);
        this.tone(780, 0.12, 'triangle', 0.06, t + 0.06);
        this.tone(1040, 0.14, 'sine', 0.05, t + 0.12);
        break;
      case 'stomp':
        this.tone(90, 0.12, 'sine', 0.1, t);
        this.noise(0.08, 0.04, t);
        break;
      case 'hurt':
        this.tone(180, 0.18, 'sawtooth', 0.08, t);
        this.tone(90, 0.28, 'square', 0.06, t + 0.04);
        break;
      case 'die':
        this.tone(220, 0.15, 'square', 0.08, t);
        this.tone(160, 0.2, 'square', 0.07, t + 0.12);
        this.tone(90, 0.4, 'sawtooth', 0.06, t + 0.28);
        break;
      case 'barrel':
        this.tone(140, 0.08, 'triangle', 0.06, t);
        this.noise(0.06, 0.03, t);
        break;
      case 'blast':
        this.tone(200, 0.08, 'square', 0.07, t);
        this.tone(420, 0.16, 'triangle', 0.05, t + 0.03);
        this.noise(0.1, 0.04, t);
        break;
      case 'boom':
        this.noise(0.28, 0.1, t);
        this.tone(70, 0.3, 'sine', 0.12, t);
        break;
      case 'checkpoint':
        this.tone(392, 0.1, 'triangle', 0.06, t);
        this.tone(523, 0.12, 'triangle', 0.06, t + 0.1);
        this.tone(659, 0.18, 'sine', 0.05, t + 0.2);
        break;
      case 'letter':
        this.tone(523, 0.12, 'triangle', 0.07, t);
        this.tone(659, 0.16, 'triangle', 0.06, t + 0.1);
        this.tone(784, 0.22, 'sine', 0.05, t + 0.2);
        break;
      case '1up':
        this.tone(523, 0.1, 'square', 0.06, t);
        this.tone(659, 0.1, 'square', 0.06, t + 0.1);
        this.tone(784, 0.1, 'square', 0.06, t + 0.2);
        this.tone(1046, 0.2, 'sine', 0.05, t + 0.3);
        break;
      case 'scarf':
        this.tone(440, 0.1, 'sine', 0.06, t);
        this.tone(660, 0.16, 'sine', 0.05, t + 0.08);
        break;
      case 'win':
        this.tone(523, 0.14, 'triangle', 0.07, t);
        this.tone(659, 0.14, 'triangle', 0.07, t + 0.14);
        this.tone(784, 0.14, 'triangle', 0.07, t + 0.28);
        this.tone(1046, 0.4, 'sine', 0.06, t + 0.42);
        break;
      case 'select':
        this.tone(330, 0.06, 'sine', 0.05, t);
        this.tone(440, 0.08, 'sine', 0.04, t + 0.04);
        break;
      case 'boss':
        this.tone(80, 0.2, 'sawtooth', 0.08, t);
        this.noise(0.12, 0.05, t);
        break;
      default:
        this.tone(300, 0.06, 'sine', 0.04, t);
    }
  }

  startMusic() {
    if (this.musicOn) return;
    const ctx = this.ensure();
    if (!ctx || this.muted) return;
    this.musicOn = true;
    this.step = 0;
    this.nextTime = ctx.currentTime + 0.05;
  }

  stopMusic() {
    this.musicOn = false;
  }

  tick() {
    if (!this.musicOn || this.muted || !this.ctx) return;
    const ctx = this.ctx;
    const ahead = 0.12;
    while (this.nextTime < ctx.currentTime + ahead) {
      const i = this.step % MELODY.length;
      const note = MELODY[i];
      if (note) this.tone(NOTES[note], 0.14, 'triangle', 0.045, this.nextTime);
      const bass = BASS[this.step % BASS.length];
      if (bass) this.tone(NOTES[bass], 0.22, 'sine', 0.05, this.nextTime);
      if (this.step % 4 === 0) this.noise(0.04, 0.03, this.nextTime);
      if (this.step % 8 === 4) this.noise(0.03, 0.018, this.nextTime);
      this.nextTime += BEAT / 4;
      this.step++;
    }
  }
}
