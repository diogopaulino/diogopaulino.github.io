/* ==========================================================================
   Ravi 1·2·3 — Som suave + trilha leve + fala sincronizada
   --------------------------------------------------------------------------
   Timbre pensado para criança pequena e para não cansar o adulto do lado:
   - Nada de onda quadrada/serra crua. Os efeitos usam "pluck" de marimba
     (senoide + parcial 4× que morre rápido) com ataque macio e decaimento
     exponencial.
   - Cadeia de saída: master → passa-baixa (corta o chiado agudo) →
     compressor suave → saída. Picos nunca estouram.
   - Trilha agendada no relógio do AudioContext (lookahead de 120 ms), sem
     jitter de setInterval. Alterna um ciclo com melodia e um ciclo só com o
     baixo, para a música respirar e não ficar repetitiva.
   - Ducking: a trilha abaixa sozinha enquanto a voz fala.

   Fala (Web Speech API):
   - Escolhe a voz pt-BR mais natural disponível (Luciana, Francisca,
     Google português do Brasil, vozes "Natural/Enhanced/Premium").
   - Frases entram numa fila. Números da contagem usam speakNow(): cortam o
     que estiver tocando e falam na hora, para a voz bater com o número que
     aparece na tela.
   - busy() permite ao jogo esperar a narração terminar antes de começar a
     contar (ver Timeline.waitSpeech em game.js).
   - Cada frase tem um tempo máximo estimado; se o navegador não disparar
     onend (bug conhecido do Chrome), a fila segue mesmo assim.
   ========================================================================== */

const NOTES = [
  261.63, // C4
  293.66, // D4
  329.63, // E4
  349.23, // F4
  392.0, // G4
  440.0, // A4
  493.88, // B4
  523.25, // C5
  587.33, // D5
  659.25 // E5
];

const PT = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];

const MASTER_VOL = 0.8;
const BGM_VOL = 0.16;
const BGM_DUCK = 0.35; // fração do volume da trilha enquanto a voz fala

let ctx = null;
let master = null;
let bgmGain = null;
let noiseBuf = null;
let muted = false;
let lastSpoken = '';

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    // Som é enfeite: se o navegador recusar o contexto, o jogo segue mudo.
    try { ctx = new AC(); } catch (_) { ctx = null; return null; }

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 4200;
    lowpass.Q.value = 0.5;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.knee.value = 18;
    comp.ratio.value = 3;
    comp.attack.value = 0.01;
    comp.release.value = 0.2;

    master = ctx.createGain();
    master.gain.value = muted ? 0 : MASTER_VOL;
    master.connect(lowpass);
    lowpass.connect(comp);
    comp.connect(ctx.destination);

    bgmGain = ctx.createGain();
    bgmGain.gain.value = BGM_VOL;
    bgmGain.connect(master);

    // Um único buffer de ruído reaproveitado por todos os efeitos.
    const frames = ctx.sampleRate;
    noiseBuf = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume()?.catch?.(() => {});
  return ctx;
}

/* --------------------------------------------------------------------------
   Instrumentos
   -------------------------------------------------------------------------- */

/** Envelope macio: ataque curto, decaimento exponencial até `dur`. */
function env(gain, t, vol, dur, attack = 0.008) {
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

/** Oscilador simples com envelope e glide opcional de frequência. */
function osc(freq, dur, vol, when = 0, type = 'sine', target = null, glideTo = 0, attack = 0.008) {
  const a = ensure();
  if (!a || muted || !freq) return;
  const t = a.currentTime + when;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur * 0.8);
  env(g, t, vol, dur, attack);
  o.connect(g);
  g.connect(target || master);
  o.start(t);
  o.stop(t + dur + 0.03);
}

/** Marimba/caixinha de música: fundamental + parcial 4× que morre rápido. */
function pluck(freq, dur = 0.5, vol = 0.1, when = 0, target = null) {
  osc(freq, dur, vol, when, 'sine', target);
  osc(freq * 4, dur * 0.18, vol * 0.22, when, 'sine', target);
  osc(freq * 2, dur * 0.4, vol * 0.18, when, 'triangle', target);
}

/** Sino (registradora, foto): parciais inarmônicos com cauda longa. */
function bell(freq, vol = 0.08, when = 0) {
  osc(freq, 0.9, vol, when, 'sine');
  osc(freq * 2.76, 0.45, vol * 0.35, when, 'sine');
  osc(freq * 5.4, 0.2, vol * 0.15, when, 'sine');
}

/** Ruído filtrado (sopro, carimbo, obturador), sem estalo. */
function hush(dur = 0.12, vol = 0.06, when = 0, cutoff = 1200, type = 'lowpass') {
  const a = ensure();
  if (!a || muted) return;
  const t = a.currentTime + when;
  const src = a.createBufferSource();
  src.buffer = noiseBuf;
  const f = a.createBiquadFilter();
  f.type = type;
  f.frequency.value = cutoff;
  const g = a.createGain();
  env(g, t, vol, dur, 0.01);
  src.connect(f);
  f.connect(g);
  g.connect(master);
  const offset = Math.random() * 0.5;
  src.start(t, offset, dur + 0.05);
}

/* --------------------------------------------------------------------------
   Trilha por cenário (agendada no relógio de áudio)
   -------------------------------------------------------------------------- */

const SONGS = {
  // Canção de ninar (título e sonho)
  lullaby: { step: 0.46, notes: [0, 2, 4, 7, 4, 2, 0, -1, 3, 5, 7, 5, 4, 2, 4, -1] },
  // Passeio pela vila (encruzilhada, transporte, viagem, correio)
  town: { step: 0.3, notes: [0, 2, 4, 5, 4, 2, 0, -1, 4, 5, 7, -1, 5, 4, 2, -1] },
  // Oficina saltitante (fábrica)
  factory: { step: 0.27, notes: [0, 4, -1, 4, 3, 5, -1, 5, 4, 7, 5, 2, 0, -1, 4, -1] },
  // Mercearia (mercado e caixa)
  market: { step: 0.28, notes: [4, 2, 0, 2, 4, 4, 4, -1, 2, 2, 2, -1, 4, 7, 7, -1] },
  // Parabéns / festa
  party: {
    step: 0.28,
    notes: [0, 0, 1, 0, 3, 2, -1, -1, 0, 0, 1, 0, 4, 3, -1, -1, 7, 5, 3, 2, 1, -1, 6, 6, 5, 3, 4, 3, -1, -1]
  }
};

let currentTheme = 'lullaby';
let songStepIdx = 0;
let nextNoteTime = 0;
let bgmTimer = 0;
const LOOKAHEAD = 0.12;

function scheduleBgm() {
  if (!ctx || ctx.state !== 'running') return;
  const song = SONGS[currentTheme] || SONGS.town;
  if (nextNoteTime < ctx.currentTime) nextNoteTime = ctx.currentTime + 0.05;
  while (nextNoteTime < ctx.currentTime + LOOKAHEAD) {
    const len = song.notes.length;
    const i = songStepIdx % len;
    const cycle = Math.floor(songStepIdx / len);
    const n = song.notes[i];
    const when = nextNoteTime - ctx.currentTime;
    if (!muted && n >= 0 && n < NOTES.length) {
      // Ciclo par: melodia + baixo. Ciclo ímpar: só o baixo nos tempos fortes.
      if (cycle % 2 === 0) pluck(NOTES[n], song.step * 2.2, 0.16, when, bgmGain);
      if (i % 4 === 0) osc(NOTES[n] * 0.5, song.step * 3, 0.14, when, 'triangle', bgmGain, 0, 0.02);
    }
    songStepIdx++;
    nextNoteTime += song.step;
  }
}

function startBgmLoop() {
  if (bgmTimer) return;
  bgmTimer = setInterval(scheduleBgm, 50);
}

function duck(on) {
  if (!ctx || !bgmGain) return;
  bgmGain.gain.setTargetAtTime(on ? BGM_VOL * BGM_DUCK : BGM_VOL, ctx.currentTime, 0.12);
}

/* --------------------------------------------------------------------------
   Fala — fila + fala imediata para contagem
   -------------------------------------------------------------------------- */

const queue = [];
let speaking = false;
let voice = null;
let voiceResolved = false;
let watchdog = 0;
let generation = 0;

/** Pontua a voz: pt-BR natural primeiro, vozes "cômicas" do macOS por último. */
function scoreVoice(v) {
  let s = 0;
  if (/pt[-_]BR/i.test(v.lang)) s += 100;
  else if (/^pt/i.test(v.lang)) s += 40;
  else return -1;
  if (/natural|neural|enhanced|premium|aprimorad/i.test(v.name)) s += 30;
  if (/luciana|francisca|thalita|fernanda|google/i.test(v.name)) s += 20;
  if (/eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley|bells|bubbles|jester|whisper|zarvox|bad news|good news|organ|trinoids|cellos/i.test(v.name)) s -= 60;
  if (v.localService) s += 5;
  return s;
}

function pickVoice() {
  if (voiceResolved || !window.speechSynthesis) return;
  const all = window.speechSynthesis.getVoices();
  if (!all.length) return;
  let best = null;
  let bestScore = -1;
  for (const v of all) {
    const sc = scoreVoice(v);
    if (sc > bestScore) {
      best = v;
      bestScore = sc;
    }
  }
  voice = bestScore >= 0 ? best : null;
  voiceResolved = true;
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  pickVoice();
  window.speechSynthesis.addEventListener('voiceschanged', () => {
    voiceResolved = false;
    pickVoice();
  });
}

function finishUtterance(gen) {
  if (gen !== generation) return;
  clearTimeout(watchdog);
  speaking = false;
  if (queue.length) pump();
  else duck(false);
}

function utter(text, quick) {
  const gen = ++generation;
  speaking = true;
  duck(true);
  try {
    const u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    u.lang = 'pt-BR';
    // Números: um pouco mais rápidos e animados; frases: calmas e claras.
    u.rate = quick ? 1.02 : 0.94;
    u.pitch = quick ? 1.12 : 1.04;
    u.volume = 0.95;
    u.onend = () => finishUtterance(gen);
    u.onerror = () => finishUtterance(gen);
    clearTimeout(watchdog);
    watchdog = setTimeout(() => finishUtterance(gen), 1200 + text.length * 95);
    window.speechSynthesis.speak(u);
  } catch (_) {
    finishUtterance(gen);
  }
}

function pump() {
  if (speaking || !queue.length || !window.speechSynthesis || muted) return;
  utter(queue.shift(), false);
}

function hasSpeech() {
  return typeof window !== 'undefined' && !!window.speechSynthesis;
}

/* --------------------------------------------------------------------------
   API
   -------------------------------------------------------------------------- */

export const Audio = {
  init() {
    ensure();
    pickVoice();
    startBgmLoop();
  },

  get muted() {
    return muted;
  },

  setTheme(theme) {
    if (theme && SONGS[theme] && theme !== currentTheme) {
      currentTheme = theme;
      songStepIdx = 0;
      if (ctx) nextNoteTime = ctx.currentTime + 0.25;
    }
  },

  toggleMute() {
    muted = !muted;
    if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : MASTER_VOL, ctx.currentTime, 0.05);
    if (muted) this.stopSpeech();
    return muted;
  },

  /** Frase de narração (entra na fila). */
  speak(str) {
    if (!str) return;
    lastSpoken = String(str);
    if (!hasSpeech() || muted) return;
    if (queue.length > 3) queue.splice(0, queue.length - 3);
    queue.push(lastSpoken);
    pump();
  },

  /** Fala já, cortando o que estiver tocando (contagem sincronizada). */
  speakNow(str) {
    if (!str || !hasSpeech() || muted) return;
    queue.length = 0;
    try {
      window.speechSynthesis.cancel();
    } catch (_) {
      /* ignore */
    }
    utter(String(str), true);
  },

  /** true enquanto há narração tocando ou na fila. */
  busy() {
    if (!hasSpeech() || muted) return false;
    return speaking || queue.length > 0;
  },

  repeatLast() {
    this.click();
    if (!lastSpoken) return;
    this.stopSpeech();
    this.speak(lastSpoken);
  },

  stopSpeech() {
    queue.length = 0;
    generation++;
    speaking = false;
    clearTimeout(watchdog);
    duck(false);
    try {
      if (hasSpeech()) window.speechSynthesis.cancel();
    } catch (_) {
      /* ignore */
    }
  },

  countStep(n) {
    const k = Math.max(0, Math.min(9, n));
    this.note(k === 0 ? 0 : k - 1);
    this.speakNow(PT[k]);
  },

  note(i) {
    pluck(NOTES[Math.min(Math.max(i, 0), NOTES.length - 1)], 0.6, 0.12);
  },

  /** Barra do xilofone da festa (1..9), um pouco mais brilhante que note(). */
  chime(n) {
    const f = NOTES[Math.min(Math.max(n - 1, 0), NOTES.length - 1)] * 2;
    pluck(f, 0.9, 0.11);
    osc(f * 3, 0.25, 0.02, 0, 'sine');
  },

  pop() {
    osc(420, 0.09, 0.07, 0, 'sine', null, 880);
  },

  click() {
    osc(1300, 0.04, 0.035, 0, 'sine');
  },

  /** Bipe do leitor do caixa. */
  beep() {
    osc(1568, 0.07, 0.045, 0, 'sine');
  },

  cashRegister() {
    hush(0.08, 0.04, 0, 2500, 'bandpass');
    bell(1318.5, 0.07, 0.06);
  },

  wrapRibbon() {
    [2, 4, 7, 9].forEach((n, i) => pluck(NOTES[n] * 1.5, 0.35, 0.07, i * 0.06));
  },

  blowAir() {
    hush(0.5, 0.06, 0, 700);
  },

  magic() {
    [0, 2, 4, 7, 9].forEach((n, i) => pluck(NOTES[n] * 2, 0.45, 0.05, i * 0.07));
  },

  success() {
    [0, 2, 4, 7].forEach((n, i) => pluck(NOTES[n], 0.5, 0.08, i * 0.1));
  },

  /** "Ops": boop grave e curto, sem zumbido. */
  bonk() {
    osc(330, 0.18, 0.07, 0, 'sine', null, 196);
  },

  sheep() {
    osc(520, 0.22, 0.03, 0, 'triangle', null, 470, 0.03);
    osc(1040, 0.16, 0.008, 0.02, 'sine');
  },

  engine() {
    for (let i = 0; i < 4; i++) osc(70 + i * 4, 0.09, 0.07, i * 0.09, 'triangle');
    hush(0.32, 0.025, 0, 500);
  },

  stamp() {
    osc(140, 0.16, 0.1, 0, 'sine', null, 70);
    hush(0.07, 0.04, 0, 900);
  },

  /** Obturador da câmera da foto da festa. */
  shutter() {
    hush(0.05, 0.06, 0, 3000, 'highpass');
    hush(0.06, 0.05, 0.08, 2500, 'highpass');
    bell(2093, 0.025, 0.12);
  },

  party() {
    [0, 2, 4, 5, 7, 5, 4, 2].forEach((n, i) => pluck(NOTES[n], 0.35, 0.06, i * 0.11));
  },

  fanfare() {
    [0, 4, 7, 9, 7, 9].forEach((n, i) => {
      pluck(NOTES[n] * 2, 0.4, 0.06, i * 0.13);
      osc(NOTES[n], 0.3, 0.04, i * 0.13, 'triangle', null, 0, 0.02);
    });
  },

  suspend() {
    if (ctx && ctx.state === 'running') ctx.suspend()?.catch?.(() => {});
    this.stopSpeech();
  },

  resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume()?.catch?.(() => {});
    if (ctx) nextNoteTime = ctx.currentTime + 0.1;
  }
};
