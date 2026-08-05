/* ==========================================================================
   Ravi 1·2·3 — síntese estilo AdLib/PC-speaker + fala em fila
   --------------------------------------------------------------------------
   A fala é enfileirada em vez de cancelada a cada frase. No jogo antigo cada
   `say()` chamava speechSynthesis.cancel(), então qualquer narração que caísse
   no meio de uma contagem cortava o número que estava sendo falado.
   ========================================================================== */

const NOTES = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25, 587.33];
const PT = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];

let ctx = null;
let master = null;
let muted = false;

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.7;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/**
 * Nota simples com envelope curto. `type` fica em square/pulse na maior parte
 * do tempo para lembrar o timbre FM dos jogos DOS.
 */
function tone(freq, dur = 0.16, type = 'square', vol = 0.18, when = 0) {
  const a = ensure();
  if (!a || muted) return;
  const t = a.currentTime + when;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain);
  gain.connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

/** Ruído curto, para passos e estouros. */
function noise(dur = 0.08, vol = 0.12, when = 0) {
  const a = ensure();
  if (!a || muted) return;
  const frames = Math.max(1, Math.floor(a.sampleRate * dur));
  const buffer = a.createBuffer(1, frames, a.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = a.createBufferSource();
  const gain = a.createGain();
  src.buffer = buffer;
  gain.gain.value = vol;
  src.connect(gain);
  gain.connect(master);
  src.start(a.currentTime + when);
}

/* --------------------------------------------------------------------------
   Fala — fila serializada
   -------------------------------------------------------------------------- */

const queue = [];
let speaking = false;
let voice = null;
let voiceResolved = false;

function pickVoice() {
  if (voiceResolved || !window.speechSynthesis) return;
  const all = window.speechSynthesis.getVoices();
  if (!all.length) return;
  voice = all.find((v) => /pt[-_]BR/i.test(v.lang))
    || all.find((v) => /^pt/i.test(v.lang))
    || null;
  voiceResolved = true;
}

if (window.speechSynthesis) {
  pickVoice();
  window.speechSynthesis.addEventListener('voiceschanged', pickVoice);
}

function pump() {
  if (speaking || !queue.length || !window.speechSynthesis) return;
  const item = queue.shift();
  speaking = true;
  try {
    const u = new SpeechSynthesisUtterance(item);
    if (voice) u.voice = voice;
    u.lang = 'pt-BR';
    u.rate = 1.02;
    u.pitch = 1.15;
    u.volume = muted ? 0 : 0.95;
    const next = () => { speaking = false; pump(); };
    u.onend = next;
    u.onerror = next;
    window.speechSynthesis.speak(u);
  } catch (_) {
    speaking = false;
  }
}

export const Audio = {
  init() {
    ensure();
    pickVoice();
  },

  get muted() { return muted; },

  toggleMute() {
    muted = !muted;
    if (master) master.gain.value = muted ? 0 : 0.7;
    if (muted) this.stopSpeech();
    return muted;
  },

  /** Enfileira uma fala. Nunca interrompe o que já está sendo dito. */
  speak(str) {
    if (!str || !window.speechSynthesis) return;
    if (queue.length > 6) queue.length = 6; // não deixa a fila crescer sem fim
    queue.push(String(str));
    pump();
  },

  /** Corta tudo — usado só na troca de cena e no restart. */
  stopSpeech() {
    queue.length = 0;
    speaking = false;
    try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (_) { /* ignore */ }
  },

  /** Fala um número e toca a nota correspondente. */
  countStep(n) {
    this.note(Math.max(0, Math.min(8, n - 1)));
    this.speak(PT[Math.max(0, Math.min(9, n))]);
  },

  note(i) {
    tone(NOTES[Math.min(Math.max(i, 0), NOTES.length - 1)], 0.26, 'square', 0.16);
    tone(NOTES[Math.min(Math.max(i, 0), NOTES.length - 1)] * 2, 0.14, 'triangle', 0.07, 0.01);
  },

  pop() {
    tone(660, 0.05, 'square', 0.12);
    tone(990, 0.05, 'square', 0.08, 0.04);
  },

  click() {
    tone(880, 0.03, 'square', 0.09);
  },

  magic() {
    [0, 2, 4, 7].forEach((n, i) => tone(NOTES[n] * 2, 0.22, 'triangle', 0.13, i * 0.07));
  },

  success() {
    [4, 5, 7, 8].forEach((n, i) => tone(NOTES[n], 0.2, 'square', 0.14, i * 0.09));
  },

  bonk() {
    tone(150, 0.16, 'sawtooth', 0.12);
    tone(110, 0.2, 'square', 0.08, 0.05);
  },

  sheep() {
    tone(430, 0.07, 'sawtooth', 0.08);
    tone(370, 0.11, 'square', 0.06, 0.05);
  },

  engine() {
    tone(80, 0.5, 'sawtooth', 0.05);
    tone(120, 0.4, 'square', 0.035, 0.05);
    noise(0.3, 0.04);
  },

  stamp() {
    noise(0.1, 0.16);
    tone(90, 0.2, 'square', 0.12, 0.02);
  },

  party() {
    [0, 2, 4, 5, 7, 5, 4, 2].forEach((n, i) => tone(NOTES[n], 0.14, 'square', 0.11, i * 0.11));
  },

  fanfare() {
    [0, 4, 7, 8, 7, 8].forEach((n, i) => {
      tone(NOTES[n] * 2, 0.18, 'square', 0.13, i * 0.13);
      tone(NOTES[n], 0.18, 'triangle', 0.08, i * 0.13);
    });
  },

  /** Chamado no visibilitychange — não deixa o contexto rodando em aba oculta. */
  suspend() {
    if (ctx && ctx.state === 'running') ctx.suspend();
    this.stopSpeech();
  },

  resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }
};
