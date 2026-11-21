/* ==========================================================================
   Ravi 1·2·3 — Síntese FM/AdLib + Trilha Sonora Musical + Fala em Fila
   --------------------------------------------------------------------------
   - Efeitos sonoros ricos (notas de contagem, caixa registradora, sopro das
     velas, embrulho de presente, motor, ovelhas, fanfarra de aniversário).
   - Música de fundo procedural leve por ambiente (nana noturna, vila alegre,
     oficina mecânica, mercado, festa de aniversário), que abaixa o volume
     (ducking) durante a fala ou contagem.
   - Fala enfileirada com opção de repetir a última frase no botão de voz.
   ========================================================================== */

const NOTES = [
  261.63, // C4
  293.66, // D4
  329.63, // E4
  349.23, // F4
  392.00, // G4
  440.00, // A4
  493.88, // B4
  523.25, // C5
  587.33, // D5
  659.25  // E5
];

const PT = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];

let ctx = null;
let master = null;
let bgmGain = null;
let muted = false;
let lastSpoken = '';

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.72;
    master.connect(ctx.destination);

    bgmGain = ctx.createGain();
    bgmGain.gain.value = 0.22;
    bgmGain.connect(master);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** Nota de efeito sonoro (ligada ao master). */
function tone(freq, dur = 0.16, type = 'square', vol = 0.16, when = 0, target = null) {
  const a = ensure();
  if (!a || muted || !freq) return;
  const t = a.currentTime + when;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain);
  gain.connect(target || master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

/** Ruído branco com envelope (passos, carimbo, sopro de vela). */
function noise(dur = 0.08, vol = 0.12, when = 0) {
  const a = ensure();
  if (!a || muted) return;
  const frames = Math.max(1, Math.floor(a.sampleRate * dur));
  const buffer = a.createBuffer(1, frames, a.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) {
    const env = Math.sin((i / frames) * Math.PI);
    data[i] = (Math.random() * 2 - 1) * env;
  }
  const src = a.createBufferSource();
  const gain = a.createGain();
  src.buffer = buffer;
  gain.gain.value = vol;
  src.connect(gain);
  gain.connect(master);
  src.start(a.currentTime + when);
}

/* --------------------------------------------------------------------------
   Sequenciador Musical AdLib por Cenário
   -------------------------------------------------------------------------- */

const SONGS = {
  // Canção de ninar suave (título e sonho)
  lullaby: {
    step: 0.42,
    wave: 'triangle',
    notes: [0, 2, 4, 7, 4, 2, 0, -1, 3, 5, 7, 5, 4, 2, 4, -1]
  },
  // Passeio alegre pela vila (encruzilhada, transporte, viagem, correio)
  town: {
    step: 0.28,
    wave: 'triangle',
    notes: [0, 2, 4, 5, 4, 2, 0, 4, 5, 7, 8, 7, 5, 4, 2, 4]
  },
  // Oficina mecânica saltitante (fábrica)
  factory: {
    step: 0.25,
    wave: 'square',
    notes: [0, 4, 0, 4, 3, 5, 3, 5, 4, 7, 5, 2, 0, 4, 7, -1]
  },
  // Mercearia animada (mercado)
  market: {
    step: 0.26,
    wave: 'triangle',
    notes: [4, 2, 0, 2, 4, 4, 4, -1, 2, 2, 2, -1, 4, 7, 7, -1]
  },
  // Parabéns / Festa Surpresa
  party: {
    step: 0.26,
    wave: 'square',
    notes: [0, 0, 1, 0, 3, 2, -1, 0, 0, 1, 0, 4, 3, -1, 7, 5, 3, 2, 1, -1, 6, 6, 5, 3, 4, 3]
  }
};

let currentTheme = 'lullaby';
let songStepIdx = 0;
let bgmTimer = 0;

function tickBgm() {
  if (!ctx || muted || ctx.state !== 'running') return;
  const song = SONGS[currentTheme] || SONGS.town;
  const n = song.notes[songStepIdx % song.notes.length];
  songStepIdx++;
  if (n >= 0 && n < NOTES.length) {
    const freq = NOTES[n];
    const vol = speaking ? 0.03 : (song.wave === 'square' ? 0.055 : 0.085);
    tone(freq, song.step * 0.85, song.wave, vol, 0, bgmGain);
    if (songStepIdx % 4 === 1) {
      tone(freq * 0.5, song.step * 0.9, 'triangle', vol * 0.7, 0, bgmGain);
    }
  }
}

function startBgmLoop() {
  clearInterval(bgmTimer);
  const song = SONGS[currentTheme] || SONGS.town;
  bgmTimer = setInterval(tickBgm, Math.round(song.step * 1000));
}

/* --------------------------------------------------------------------------
   Fala — Fila serializada com Web Speech API
   -------------------------------------------------------------------------- */

const queue = [];
let speaking = false;
let voice = null;
let voiceResolved = false;

function pickVoice() {
  if (voiceResolved || !window.speechSynthesis) return;
  const all = window.speechSynthesis.getVoices();
  if (!all.length) return;
  voice =
    all.find((v) => /pt[-_]BR/i.test(v.lang)) ||
    all.find((v) => /^pt/i.test(v.lang)) ||
    null;
  voiceResolved = true;
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
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
    u.rate = 0.88;
    u.pitch = 1.15;
    u.volume = muted ? 0 : 0.95;
    const next = () => {
      speaking = false;
      pump();
    };
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
    if (!bgmTimer) startBgmLoop();
  },

  get muted() {
    return muted;
  },

  setTheme(theme) {
    if (theme && SONGS[theme] && theme !== currentTheme) {
      currentTheme = theme;
      songStepIdx = 0;
      if (ctx) startBgmLoop();
    }
  },

  toggleMute() {
    muted = !muted;
    if (master) master.gain.value = muted ? 0 : 0.72;
    if (muted) this.stopSpeech();
    return muted;
  },

  speak(str) {
    if (!str) return;
    lastSpoken = String(str);
    if (!window.speechSynthesis || muted) return;
    if (queue.length > 6) queue.length = 6;
    queue.push(lastSpoken);
    pump();
  },

  repeatLast() {
    this.click();
    if (!lastSpoken) return;
    this.stopSpeech();
    this.speak(lastSpoken);
  },

  stopSpeech() {
    queue.length = 0;
    speaking = false;
    try {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    } catch (_) {
      /* ignore */
    }
  },

  countStep(n) {
    this.note(Math.max(0, Math.min(9, n === 0 ? 0 : n - 1)));
    this.speak(PT[Math.max(0, Math.min(9, n))]);
  },

  note(i) {
    const f = NOTES[Math.min(Math.max(i, 0), NOTES.length - 1)];
    tone(f, 0.26, 'square', 0.16);
    tone(f * 2, 0.15, 'triangle', 0.08, 0.01);
  },

  pop() {
    tone(660, 0.05, 'square', 0.12);
    tone(990, 0.05, 'square', 0.08, 0.04);
  },

  click() {
    tone(880, 0.035, 'square', 0.09);
  },

  cashRegister() {
    // Som clássico "Ka-ching!" da caixa registradora do mercado
    tone(1046.5, 0.08, 'square', 0.16, 0);
    tone(1567.98, 0.28, 'triangle', 0.18, 0.07);
    tone(2093.0, 0.22, 'sine', 0.12, 0.08);
  },

  wrapRibbon() {
    // Som de embrulhar presente com laço
    [2, 4, 7, 9].forEach((n, i) => tone(NOTES[n] * 1.5, 0.12, 'triangle', 0.13, i * 0.05));
  },

  blowAir() {
    // Sopro das velinhas do bolo
    noise(0.55, 0.22, 0);
    tone(240, 0.35, 'sine', 0.06, 0.05);
  },

  magic() {
    [0, 2, 4, 7, 9].forEach((n, i) => tone(NOTES[n] * 2, 0.22, 'triangle', 0.13, i * 0.065));
  },

  success() {
    [4, 5, 7, 8].forEach((n, i) => tone(NOTES[n], 0.2, 'square', 0.14, i * 0.09));
  },

  bonk() {
    tone(150, 0.16, 'sawtooth', 0.12);
    tone(110, 0.2, 'square', 0.08, 0.05);
  },

  sheep() {
    tone(430, 0.08, 'sawtooth', 0.08);
    tone(370, 0.12, 'square', 0.06, 0.05);
  },

  engine() {
    tone(82, 0.45, 'sawtooth', 0.055);
    tone(124, 0.35, 'square', 0.04, 0.05);
    noise(0.28, 0.045);
  },

  stamp() {
    noise(0.1, 0.16);
    tone(95, 0.2, 'square', 0.13, 0.02);
  },

  party() {
    [0, 2, 4, 5, 7, 5, 4, 2].forEach((n, i) => tone(NOTES[n], 0.14, 'square', 0.11, i * 0.1));
  },

  fanfare() {
    [0, 4, 7, 8, 7, 8].forEach((n, i) => {
      tone(NOTES[n] * 2, 0.18, 'square', 0.13, i * 0.12);
      tone(NOTES[n], 0.18, 'triangle', 0.08, i * 0.12);
    });
  },

  suspend() {
    if (ctx && ctx.state === 'running') ctx.suspend();
    this.stopSpeech();
  },

  resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }
};
