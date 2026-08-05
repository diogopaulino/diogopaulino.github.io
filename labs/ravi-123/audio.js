/* ==========================================================================
   Ravi 1·2·3 — áudio + fala de contagem
   ========================================================================== */

const NOTES = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25, 587.33];
const PT = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];

let ctx = null;
let muted = false;

function ensure() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur = 0.18, type = 'sine', vol = 0.22, when = 0) {
  const a = ensure();
  if (!a || muted) return;
  const t = a.currentTime + when;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export const Audio = {
  init() { ensure(); },

  note(i) {
    tone(NOTES[Math.min(Math.max(i, 0), NOTES.length - 1)], 0.28, 'triangle', 0.28);
  },

  pop() {
    tone(180, 0.08, 'square', 0.15);
    tone(90, 0.12, 'sine', 0.1, 0.04);
  },

  magic() {
    [0, 2, 4, 7].forEach((n, i) => tone(NOTES[n] * 2, 0.35, 'triangle', 0.18, i * 0.09));
  },

  success() {
    [4, 5, 7, 9].forEach((n, i) => {
      const f = NOTES[Math.min(n, NOTES.length - 1)];
      tone(f, 0.22, 'sine', 0.2, i * 0.1);
    });
  },

  bonk() {
    tone(120, 0.15, 'sawtooth', 0.12);
  },

  sheep() {
    tone(420, 0.08, 'sine', 0.1);
    tone(380, 0.12, 'triangle', 0.08, 0.06);
  },

  engine() {
    tone(90, 0.4, 'sawtooth', 0.06);
    tone(140, 0.3, 'square', 0.04, 0.05);
  },

  party() {
    [0, 2, 4, 5, 7, 5, 4, 2].forEach((n, i) => tone(NOTES[n], 0.16, 'triangle', 0.14, i * 0.12));
  },

  /** Conta em voz alta 1..n (SpeechSynthesis) + nota musical. */
  async countTo(n, onStep) {
    ensure();
    const max = Math.max(0, Math.min(9, n | 0));
    for (let i = 1; i <= max; i++) {
      this.note(i - 1);
      this.speak(PT[i]);
      if (onStep) onStep(i);
      await wait(580);
    }
  },

  speak(text) {
    try {
      if (!window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(String(text));
      u.lang = 'pt-BR';
      u.rate = 1.05;
      u.pitch = 1.15;
      u.volume = muted ? 0 : 0.95;
      window.speechSynthesis.speak(u);
    } catch (_) { /* ignore */ }
  },

  say(text) {
    this.speak(text);
  }
};

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
