/**
 * ============================================================================
 * PARTITURA: MAESTRO QUEST - PRO CORE ENGINE & GAMIFICATION
 * ============================================================================
 *
 * Remaster — regras de notação implementadas (conferidas com Gardner Read,
 * "Music Notation", e Elaine Gould, "Behind Bars"):
 *
 *  • Posição vertical vem do índice diatônico, nunca de tabela à mão:
 *        d = oitava·7 + grau (C=0 … B=6)
 *        Clave de Sol: E4 (d=30) na 1ª linha  → y = 150 − (d − 30)·10
 *        Clave de Fá:  G2 (d=18) na 1ª linha  → y = 150 − (d − 18)·10
 *    (linhas em y = 70, 90, 110, 130, 150; meio espaço = 10 unidades)
 *  • Linhas suplementares: todas as linhas entre a pauta e a nota, inclusive
 *    a da própria nota quando ela está numa linha.
 *  • Haste: nota abaixo da 3ª linha → haste para cima, à direita da cabeça;
 *    na 3ª linha ou acima → para baixo, à esquerda. Comprimento 3,5 espaços,
 *    esticada até a linha do meio quando a nota está muito longe dela.
 *  • Acidentes à esquerda da cabeça; armadura de clave (Sol maior: F♯ na 5ª
 *    linha; Fá maior: B♭ na 2ª linha da clave de Fá) dispensa o acidente.
 *  • Clave de Sol enrola na 2ª linha (G4); clave de Fá começa na 4ª linha (F3)
 *    com os dois pontos nos espaços acima e abaixo dela.
 *
 * Áudio: AudioContext único criado no primeiro gesto (latencyHint
 * 'interactive'), master → compressor/limiter, envio de reverb por
 * convolução, envelopes sem clique (ataque em rampa, release por
 * setTargetAtTime), polifonia limitada com roubo da voz mais antiga,
 * violão por Karplus–Strong. Eventos sonoros agendados no relógio do áudio.
 *
 * Progressão (inspirada nos melhores apps de leitura): o repertório de notas
 * cresce com o nível — primeiro só notas dentro da pauta, depois linhas
 * suplementares.
 */

// --- 1. TEORIA MUSICAL ---------------------------------------------------
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const LATIN = { C: 'Dó', D: 'Ré', E: 'Mi', F: 'Fá', G: 'Sol', A: 'Lá', B: 'Si' };

function parsePitch(pitch) {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(pitch);
  if (!m) return null;
  const letter = m[1];
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  const octave = Number(m[3]);
  return {
    letter,
    acc,
    octave,
    diatonic: octave * 7 + LETTERS.indexOf(letter),
    midi: (octave + 1) * 12 + LETTER_PC[letter] + acc
  };
}

const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);
const pitchFreq = (p) => { const x = parsePitch(p); return x ? midiToFreq(x.midi) : 440; };

const STAFF = { top: 70, bottom: 150, middle: 110, half: 10 };
const CLEF_REF = { treble: 30, bass: 18 }; // d da 1ª linha (E4 / G2)

function staffY(pitch, clef) {
  const p = parsePitch(pitch);
  if (!p) return STAFF.middle;
  return STAFF.bottom - (p.diatonic - CLEF_REF[clef]) * STAFF.half;
}

function ledgerLines(y) {
  const lines = [];
  for (let ly = STAFF.top - 20; ly >= y; ly -= 20) lines.push(ly);
  for (let ly = STAFF.bottom + 20; ly <= y; ly += 20) lines.push(ly);
  return lines;
}

function positionName(pitch, clef) {
  const y = staffY(pitch, clef);
  const step = (STAFF.bottom - y) / STAFF.half; // 0 = 1ª linha
  if (step >= 0 && step <= 8) {
    return step % 2 === 0 ? `${step / 2 + 1}ª linha` : `${(step + 1) / 2}º espaço`;
  }
  const n = ledgerLines(y).length;
  const where = y < STAFF.top ? 'acima' : 'abaixo';
  if (n === 0) return `logo ${where} da pauta`;
  const onLine = (y - STAFF.top) % 20 === 0;
  return onLine ? `${n}ª linha suplementar ${where}` : `${where} da ${n}ª linha suplementar`;
}

// Repertório da leitura por nível: dentro da pauta → linhas suplementares.
const READING_POOL = {
  treble: [
    ['E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5'],
    ['D4', 'G5', 'C4', 'A5'],
    ['B3', 'B5', 'A3', 'C6']
  ],
  bass: [
    ['G2', 'A2', 'B2', 'C3', 'D3', 'E3', 'F3', 'G3', 'A3'],
    ['F2', 'B3', 'E2', 'C4'],
    ['D2', 'D4', 'C2', 'E4']
  ]
};

function poolFor(clef, level) {
  const tiers = READING_POOL[clef];
  const unlocked = level >= 5 ? 3 : level >= 3 ? 2 : 1;
  return tiers.slice(0, unlocked).flat();
}

const SCALES = {
  'C-major': {
    name: 'Dó maior',
    notes: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'],
    clef: 'treble',
    keySig: [],
    theory: '<strong>Dó maior:</strong> Tom–Tom–Semitom–Tom–Tom–Tom–Semitom. Só teclas brancas: a porta de entrada da leitura.'
  },
  'G-major': {
    name: 'Sol maior',
    notes: ['G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F#5', 'G5'],
    clef: 'treble',
    keySig: ['F#5'],
    theory: '<strong>Sol maior:</strong> mesma fórmula de Dó maior a partir de Sol — por isso o Fá vira Fá♯. Ele já aparece na armadura, logo após a clave.'
  },
  'F-major': {
    name: 'Fá maior',
    notes: ['F2', 'G2', 'A2', 'Bb2', 'C3', 'D3', 'E3', 'F3'],
    clef: 'bass',
    keySig: ['Bb2'],
    theory: '<strong>Fá maior (clave de Fá):</strong> o Si precisa baixar meio tom (Si♭) para manter Tom–Tom–Semitom. O ♭ da armadura fica na 2ª linha.'
  },
  'A-minor': {
    name: 'Lá menor natural',
    notes: ['A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G5', 'A5'],
    clef: 'treble',
    keySig: [],
    theory: '<strong>Lá menor natural:</strong> relativa de Dó maior — as mesmas notas, começando em Lá: Tom–Semitom–Tom–Tom–Semitom–Tom–Tom.'
  },
  'C-penta': {
    name: 'Dó pentatônica maior',
    notes: ['C4', 'D4', 'E4', 'G4', 'A4', 'C5'],
    clef: 'treble',
    keySig: [],
    theory: '<strong>Pentatônica:</strong> tira a 4ª e a 7ª da escala maior (os semitons). Sobram 5 notas que combinam em qualquer improviso.'
  },
  'C-blues': {
    name: 'Dó blues',
    notes: ['C4', 'Eb4', 'F4', 'Gb4', 'G4', 'Bb4', 'C5'],
    clef: 'treble',
    keySig: [],
    theory: '<strong>Blues:</strong> pentatônica menor (Dó, Mi♭, Fá, Sol, Si♭) + a <em>blue note</em> Sol♭ entre Fá e Sol.'
  }
};

const BADGES_DEFINITIONS = {
  first_step: { id: 'first_step', icon: '🎵', title: 'Primeira nota', desc: 'Acertou sua primeira nota.' },
  combo_master: { id: 'combo_master', icon: '🔥', title: 'Mestre do combo', desc: '10 acertos seguidos.' },
  scale_explorer: { id: 'scale_explorer', icon: '🎹', title: 'Explorador de escalas', desc: 'Ouviu as 6 escalas.' },
  ear_golden: { id: 'ear_golden', icon: '👂', title: 'Ouvido de ouro', desc: '5 acertos seguidos no treino de ouvido.' },
  speed_demon: { id: 'speed_demon', icon: '⚡', title: 'Virtuoso dos 60s', desc: 'Mais de 150 pontos no desafio de 60 segundos.' },
  maestro_supremo: { id: 'maestro_supremo', icon: '👑', title: 'Maestro supremo', desc: 'Chegou ao nível 5.' }
};

// --- 2. MOTOR SONORO ------------------------------------------------------
class WebAudioSynth {
  constructor() {
    this.ctx = null;
    this.instrument = 'piano';
    this.voices = [];
    this.maxVoices = window.matchMedia('(pointer: coarse)').matches ? 16 : 28;
    this.waves = new Map();
    this.ksCache = new Map();
    this.unsupported = false;
    this.everRan = false;
    this.onState = () => {};
  }

  ensure() {
    if (this.ctx || this.unsupported) return this.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.unsupported = true; this.onState(); return null; }
    try { this.ctx = new AC({ latencyHint: 'interactive' }); } catch (e) {
      try { this.ctx = new AC(); } catch (e2) { this.unsupported = true; this.onState(); return null; }
    }
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* opcional */ }
    const ctx = this.ctx;

    this.bus = ctx.createGain();
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    const dry = ctx.createGain();
    dry.gain.value = 0.9;
    const send = ctx.createGain();
    send.gain.value = 0.22;
    const conv = ctx.createConvolver();
    try { conv.buffer = this.impulse(1.8); } catch (e) { /* sem reverb */ }
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.knee.value = 8;
    comp.ratio.value = 6;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;

    this.bus.connect(dry);
    dry.connect(this.master);
    this.bus.connect(send);
    send.connect(conv);
    conv.connect(this.master);
    this.master.connect(comp);
    comp.connect(ctx.destination);

    ctx.onstatechange = () => {
      if (ctx.state === 'running') this.everRan = true;
      this.onState();
    };
    return ctx;
  }

  impulse(seconds) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        lp += ((Math.random() * 2 - 1) - lp) * (0.85 - t * 0.6);
        d[i] = lp * Math.pow(1 - t, 2.6);
      }
    }
    return buf;
  }

  unlock() {
    const ctx = this.ensure();
    if (!ctx) return;
    if (ctx.state !== 'running') {
      try {
        const s = ctx.createBufferSource();
        s.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
        s.connect(ctx.destination);
        s.start(0);
      } catch (e) { /* noop */ }
      const p = ctx.resume();
      if (p && p.then) p.then(() => this.onState(), () => this.onState());
    }
  }

  state() {
    if (this.unsupported) return 'unsupported';
    if (!this.ctx) return 'idle';
    if (this.ctx.state === 'running') return 'running';
    return this.everRan ? 'paused' : 'idle';
  }

  now() { return this.ctx ? this.ctx.currentTime : 0; }

  setInstrument(type) { this.instrument = type; }

  pianoWave(midi) {
    const bucket = Math.floor(midi / 6);
    let w = this.waves.get(bucket);
    if (w) return w;
    const fTop = midiToFreq(bucket * 6 + 5);
    const count = Math.max(2, Math.min(28, Math.floor(Math.min(this.ctx.sampleRate * 0.45, 13000) / fTop)));
    const real = new Float32Array(count + 1);
    const imag = new Float32Array(count + 1);
    const p = Math.min(1.6, Math.max(1.05, 1.05 + Math.log2(fTop / 65.4) * 0.14));
    for (let n = 1; n <= count; n++) imag[n] = Math.abs(Math.sin(n * Math.PI / 8.3)) / Math.pow(n, p);
    w = this.ctx.createPeriodicWave(real, imag);
    this.waves.set(bucket, w);
    return w;
  }

  // Karplus–Strong: ruído num delay de N = fs/f amostras, realimentado pela
  // média de duas amostras (passa-baixas) × fator de perda ρ. Gera a corda
  // dedilhada com brilho que morre naturalmente.
  pluckBuffer(midi) {
    const cached = this.ksCache.get(midi);
    if (cached) return cached;
    const sr = this.ctx.sampleRate;
    const f = midiToFreq(midi);
    const len = Math.floor(sr * 1.8);
    const buf = this.ctx.createBuffer(1, len, sr);
    const out = buf.getChannelData(0);
    const N = Math.max(2, Math.round(sr / f));
    const line = new Float32Array(N);
    let prev = 0;
    for (let i = 0; i < N; i++) {
      // Ruído levemente filtrado = palheta mais macia
      prev = prev * 0.5 + (Math.random() * 2 - 1) * 0.5;
      line[i] = prev;
    }
    const rho = 0.996 - Math.min(0.01, f / 120000);
    let idx = 0;
    for (let i = 0; i < len; i++) {
      const a = line[idx];
      const b = line[(idx + 1) % N];
      const v = rho * 0.5 * (a + b);
      line[idx] = v;
      out[i] = a;
      idx = (idx + 1) % N;
    }
    this.ksCache.set(midi, buf);
    if (this.ksCache.size > 40) this.ksCache.delete(this.ksCache.keys().next().value);
    return buf;
  }

  trackVoice(v) {
    this.voices.push(v);
    while (this.voices.length > this.maxVoices) {
      const old = this.voices.shift();
      this.fadeOut(old, 0.01);
    }
  }

  fadeOut(v, tau) {
    if (!v || v.done) return;
    v.done = true;
    const t = this.ctx.currentTime;
    try {
      v.gain.gain.cancelScheduledValues(t);
      v.gain.gain.setValueAtTime(Math.max(0, v.gain.gain.value), t);
      v.gain.gain.setTargetAtTime(0, t, tau);
      v.sources.forEach((s) => s.stop(t + tau * 8));
    } catch (e) { /* já terminou */ }
  }

  /**
   * Toca uma altura. opts: { dur (s), when (s, relógio do áudio), vel (0–1),
   * instrument }. Nunca lança: se o áudio não estiver pronto, só não soa.
   */
  playNote(pitch, opts = {}) {
    const ctx = this.ensure();
    if (!ctx) return;
    if (ctx.state !== 'running') {
      // Primeiro toque no iOS: o contexto ainda está acordando. Reagenda a
      // nota (mantendo o deslocamento relativo) assim que ele rodar.
      if (opts._retry) return;
      const rel = Math.max(0, (opts.when || ctx.currentTime) - ctx.currentTime);
      const p0 = ctx.resume();
      if (p0 && p0.then) {
        p0.then(() => {
          if (ctx.state === 'running') this.playNote(pitch, { ...opts, when: ctx.currentTime + rel, _retry: true });
        }, () => {});
      }
      return;
    }
    const p = parsePitch(pitch);
    if (!p) return;
    const inst = opts.instrument || this.instrument;
    const dur = opts.dur || 0.9;
    const vel = Math.max(0.05, Math.min(1, opts.vel == null ? 0.75 : opts.vel));
    const t = Math.max(ctx.currentTime, opts.when || ctx.currentTime);
    const f = midiToFreq(p.midi);
    const gain = ctx.createGain();
    const sources = [];
    const v = { gain, sources, done: false };
    let tail = 0.6;

    gain.gain.setValueAtTime(0, t);

    if (inst === 'guitar') {
      const src = ctx.createBufferSource();
      src.buffer = this.pluckBuffer(p.midi);
      const body = ctx.createBiquadFilter();
      body.type = 'peaking';
      body.frequency.value = 220;
      body.Q.value = 1.2;
      body.gain.value = 4;
      src.connect(body);
      body.connect(gain);
      const peak = 0.55 * vel;
      gain.gain.linearRampToValueAtTime(peak, t + 0.002);
      gain.gain.setTargetAtTime(0, t + dur, 0.12);
      src.start(t);
      src.stop(t + Math.min(1.8, dur + 1));
      sources.push(src);
      tail = 1;
    } else if (inst === 'celesta') {
      // Barra metálica: parciais inarmônicos 1 / 2,76 / 5,4 decaindo rápido.
      [[1, 1, 0.9], [2.76, 0.35, 0.35], [5.4, 0.12, 0.18]].forEach(([mult, amp, tau]) => {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = f * mult;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(amp, t + 0.002);
        g.gain.setTargetAtTime(0, t + 0.002, tau);
        o.connect(g);
        g.connect(gain);
        o.start(t);
        o.stop(t + dur + 1.4);
        sources.push(o);
      });
      gain.gain.linearRampToValueAtTime(0.28 * vel, t + 0.002);
      gain.gain.setTargetAtTime(0, t + dur + 0.4, 0.25);
      tail = 1.4;
    } else if (inst === 'synth') {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 2;
      filter.frequency.setValueAtTime(f * 2, t);
      filter.frequency.linearRampToValueAtTime(Math.min(9000, f * 10), t + 0.03);
      filter.frequency.setTargetAtTime(f * 3, t + 0.03, 0.25);
      ['sawtooth', 'square'].forEach((type, i) => {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = f;
        o.detune.value = i ? 7 : -7;
        const g = ctx.createGain();
        g.gain.value = i ? 0.35 : 0.6;
        o.connect(g);
        g.connect(filter);
        o.start(t);
        o.stop(t + dur + 0.6);
        sources.push(o);
      });
      filter.connect(gain);
      const peak = 0.16 * vel;
      gain.gain.linearRampToValueAtTime(peak, t + 0.012);
      gain.gain.setTargetAtTime(peak * 0.65, t + 0.012, 0.15);
      gain.gain.setTargetAtTime(0, t + dur, 0.09);
    } else {
      // Piano: corpo harmônico do martelo + coro de 2 cordas + brilho que fecha.
      const wave = this.pianoWave(p.midi);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 0.6;
      filter.frequency.setValueAtTime(Math.min(15000, f * (4 + 18 * vel)), t);
      filter.frequency.setTargetAtTime(Math.min(9000, f * (2.5 + 3 * vel)), t + 0.01, 0.35);
      [-0.7, 0.7].forEach((det) => {
        const o = ctx.createOscillator();
        o.setPeriodicWave(wave);
        o.frequency.value = f;
        o.detune.value = det;
        o.connect(filter);
        o.start(t);
        o.stop(t + dur + 1.2);
        sources.push(o);
      });
      filter.connect(gain);
      const peak = 0.36 * (0.15 + 0.85 * vel * vel);
      const tau1 = Math.min(0.6, Math.max(0.08, 0.3 * Math.sqrt(261.6 / f)));
      gain.gain.linearRampToValueAtTime(peak, t + 0.003);
      gain.gain.setTargetAtTime(peak * 0.3, t + 0.003, tau1);
      gain.gain.setTargetAtTime(0, t + dur, 0.12);
      tail = 1.2;
    }

    let out = gain;
    if (ctx.createStereoPanner) {
      const pan = ctx.createStereoPanner();
      pan.pan.value = Math.max(-0.5, Math.min(0.5, (p.midi - 60) / 40));
      gain.connect(pan);
      out = pan;
    }
    out.connect(this.bus);
    sources[0].onended = () => {
      v.done = true;
      const i = this.voices.indexOf(v);
      if (i !== -1) this.voices.splice(i, 1);
      try { out.disconnect(); } catch (e) { /* noop */ }
    };
    this.trackVoice(v);
    return t + dur + tail;
  }

  // Efeitos curtos e musicais (nada de serra estridente no erro).
  playSFX(type) {
    const ctx = this.ensure();
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime + 0.02;
    if (type === 'correct' || type === 'coin') {
      this.playNote('E6', { when: t + 0.05, dur: 0.15, vel: 0.3, instrument: 'celesta' });
      this.playNote('B6', { when: t + 0.13, dur: 0.25, vel: 0.25, instrument: 'celesta' });
    } else if (type === 'error') {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const lp = ctx.createBiquadFilter();
      o.type = 'triangle';
      o.frequency.setValueAtTime(180, t);
      o.frequency.exponentialRampToValueAtTime(110, t + 0.22);
      lp.type = 'lowpass';
      lp.frequency.value = 900;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.18, t + 0.01);
      g.gain.setTargetAtTime(0, t + 0.04, 0.07);
      o.connect(lp);
      lp.connect(g);
      g.connect(this.bus);
      o.start(t);
      o.stop(t + 0.5);
    } else if (type === 'levelup' || type === 'badge') {
      ['C5', 'E5', 'G5', 'C6', 'E6', 'G6'].forEach((n, i) => {
        this.playNote(n, { when: t + i * 0.075, dur: 0.4, vel: 0.45, instrument: 'celesta' });
      });
    }
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().then(() => this.onState(), () => {});
  }
}

// --- 3. ESTADO E GAMIFICAÇÃO (LOCALSTORAGE) -------------------------------
class MaestroGameManager {
  constructor() {
    this.storageKey = 'maestro_quest_data';
    this.defaultState = {
      xp: 0,
      level: 1,
      coins: 0,
      combo: 0,
      maxCombo: 0,
      streakDays: 1,
      totalCorrect: 0,
      totalAttempts: 0,
      maxArcadeScore: 0,
      scalesExplored: [],
      earCorrectStreak: 0,
      unlockedBadges: [],
      lastLoginDate: new Date().toDateString(),
      prefs: {}
    };
    this.state = this.loadState();
    this.checkStreak();
  }

  loadState() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const data = JSON.parse(saved);
        const merged = { ...this.defaultState, ...data };
        if (!Array.isArray(merged.scalesExplored)) merged.scalesExplored = [];
        if (!Array.isArray(merged.unlockedBadges)) merged.unlockedBadges = [];
        if (!merged.prefs || typeof merged.prefs !== 'object') merged.prefs = {};
        return merged;
      }
    } catch (e) { /* armazenamento indisponível ou corrompido */ }
    return { ...this.defaultState, scalesExplored: [], unlockedBadges: [], prefs: {} };
  }

  saveState() {
    try { localStorage.setItem(this.storageKey, JSON.stringify(this.state)); } catch (e) { /* modo privado */ }
    this.updateDashboardUI();
  }

  checkStreak() {
    const today = new Date().toDateString();
    if (this.state.lastLoginDate === today) return;
    const last = new Date(this.state.lastLoginDate);
    const diffDays = Math.round((new Date(today) - new Date(last.toDateString())) / 86400000);
    if (diffDays === 1) {
      this.state.streakDays += 1;
      setTimeout(() => this.showToast('🔥 Sequência!', `${this.state.streakDays} dias seguidos lendo partitura.`), 600);
    } else if (diffDays > 1) {
      this.state.streakDays = 1;
    }
    this.state.lastLoginDate = today;
    this.saveState();
  }

  multiplier() {
    const c = this.state.combo;
    return c >= 10 ? 3 : c >= 5 ? 2 : c >= 3 ? 1.5 : 1;
  }

  addXP(amount, x, y) {
    const mult = this.multiplier();
    const gained = Math.round(amount * mult);
    this.state.xp += gained;
    this.state.coins += Math.round(5 * mult);

    if (x !== undefined && y !== undefined && !reduceMotion.matches) {
      const floatEl = document.createElement('div');
      floatEl.className = 'floating-xp';
      floatEl.textContent = `+${gained} XP${mult > 1 ? ` ×${mult}` : ''}`;
      floatEl.style.left = `${Math.min(window.innerWidth - 110, Math.max(12, x - 40))}px`;
      floatEl.style.top = `${Math.max(12, y - 30)}px`;
      document.body.appendChild(floatEl);
      setTimeout(() => floatEl.remove(), 1100);
    }

    // XP acumulado; cada nível pede 100·n XP a partir do anterior.
    while (this.state.xp >= this.levelTarget(this.state.level)) {
      this.state.level += 1;
      synth.playSFX('levelup');
      this.showToast('🎉 Subiu de nível!', `Maestro nível ${this.state.level}${this.state.level === 3 || this.state.level === 5 ? ' — novas notas com linhas suplementares liberadas!' : ''}`);
      if (this.state.level >= 5) this.unlockBadge('maestro_supremo');
    }
    this.saveState();
  }

  levelTarget(level) { return 50 * level * (level + 1); } // 100, 300, 600, 1000…

  registerHit(isCorrect, isEarMode = false) {
    this.state.totalAttempts += 1;
    if (isCorrect) {
      this.state.totalCorrect += 1;
      this.state.combo += 1;
      if (this.state.combo > this.state.maxCombo) this.state.maxCombo = this.state.combo;
      if (isEarMode) {
        this.state.earCorrectStreak += 1;
        if (this.state.earCorrectStreak >= 5) this.unlockBadge('ear_golden');
      }
      this.unlockBadge('first_step');
      if (this.state.combo >= 10) this.unlockBadge('combo_master');
    } else {
      this.state.combo = 0;
      if (isEarMode) this.state.earCorrectStreak = 0;
    }
    this.saveState();
  }

  registerScaleExplored(scaleId) {
    if (this.state.scalesExplored.includes(scaleId)) return;
    this.state.scalesExplored.push(scaleId);
    this.saveState();
    if (this.state.scalesExplored.length >= Object.keys(SCALES).length) this.unlockBadge('scale_explorer');
  }

  unlockBadge(badgeId) {
    if (this.state.unlockedBadges.includes(badgeId)) return;
    this.state.unlockedBadges.push(badgeId);
    const b = BADGES_DEFINITIONS[badgeId];
    synth.playSFX('badge');
    this.showToast(`🏆 ${b.title}`, b.desc);
    this.saveState();
  }

  showToast(title, desc) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast-msg';
    const strong = document.createElement('strong');
    strong.textContent = title;
    const small = document.createElement('span');
    small.textContent = desc;
    toast.append(strong, small);
    container.appendChild(toast);
    while (container.children.length > 3) container.firstElementChild.remove();
    setTimeout(() => {
      toast.classList.add('leaving');
      setTimeout(() => toast.remove(), 400);
    }, 4000);
  }

  updateDashboardUI() {
    const s = this.state;
    const titles = ['Aprendiz da Clave', 'Leitor de Linhas', 'Mestre das Oitavas', 'Virtuoso das Escalas', 'Maestro Supremo', 'Lenda da Partitura'];
    const rankName = titles[Math.min(s.level - 1, titles.length - 1)];
    const base = this.levelTarget(s.level - 1);
    const target = this.levelTarget(s.level);
    const pct = Math.max(0, Math.min(100, ((s.xp - base) / (target - base)) * 100));
    setText('maestro-level-title', `Nível ${s.level}: ${rankName}`);
    setText('maestro-level-badge', String(s.level));
    setText('xp-text', `${s.xp} / ${target} XP`);
    setText('combo-count', `x${s.combo}`);
    setText('streak-days', String(s.streakDays));
    setText('coin-count', String(s.coins));
    const bar = document.getElementById('xp-bar');
    if (bar) bar.style.width = `${pct}%`;
    const prog = document.getElementById('xp-progress');
    if (prog) prog.setAttribute('aria-valuenow', String(Math.round(pct)));
    document.getElementById('combo-box')?.classList.toggle('active', s.combo >= 3);

    setText('stat-total-correct', String(s.totalCorrect));
    setText('stat-max-combo', `x${s.maxCombo}`);
    setText('stat-max-arcade', String(s.maxArcadeScore));
    setText('arcade-highscore', String(s.maxArcadeScore));
    const acc = s.totalAttempts === 0 ? 100 : Math.round((s.totalCorrect / s.totalAttempts) * 100);
    setText('stat-accuracy', `${acc}%`);
  }

  resetProgress() {
    const btn = document.getElementById('btn-reset-data');
    if (btn && !btn.dataset.confirming) {
      btn.dataset.confirming = 'true';
      btn.textContent = 'Toque de novo para confirmar';
      this._resetConfirmTimer = setTimeout(() => {
        delete btn.dataset.confirming;
        btn.textContent = 'Zerar progresso';
      }, 3000);
      return;
    }
    if (btn) {
      clearTimeout(this._resetConfirmTimer);
      delete btn.dataset.confirming;
      btn.textContent = 'Zerar progresso';
    }
    const prefs = this.state.prefs;
    try { localStorage.removeItem(this.storageKey); } catch (e) { /* noop */ }
    this.state = this.loadState();
    this.state.prefs = prefs;
    this.saveState();
    renderBadgesModal();
    this.showToast('Progresso zerado', 'Um novo começo musical.');
  }
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// --- 4. RENDERIZAÇÃO DA PAUTA (SVG) ---------------------------------------
const SVG_NS = 'http://www.w3.org/2000/svg';
const INK = '#1c1b22';
const PAPER_LINE = '#2a2833';

function svgEl(tag, attrs, parent) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) el.setAttribute(k, String(attrs[k]));
  if (parent) parent.appendChild(el);
  return el;
}

class StaffSVGRenderer {
  constructor(svgId) {
    this.svg = document.getElementById(svgId);
    this.clef = 'treble';
    this.guideMode = false;
    this.width = 700;
    this.keySig = [];
  }

  // A pauta usa um viewBox mais estreito no celular: notas ficam maiores.
  fitWidth() {
    const w = this.svg ? this.svg.clientWidth : 700;
    this.width = w && w < 560 ? 460 : 700;
    this.svg.setAttribute('viewBox', `0 0 ${this.width} 240`);
  }

  clear() {
    if (this.svg) this.svg.textContent = '';
  }

  get accent() { return this.clef === 'bass' ? '#7c3aed' : '#0e7490'; }

  renderStaff(clefType = 'treble', keySig = []) {
    this.clear();
    this.clef = clefType;
    this.keySig = keySig;
    const W = this.width;

    const card = document.getElementById('staff-card-wrapper');
    if (card) {
      card.classList.toggle('mode-bass-clef', clefType === 'bass');
      card.classList.toggle('mode-treble-clef', clefType !== 'bass');
    }
    const indicator = document.getElementById('clef-active-indicator');
    if (indicator) indicator.textContent = clefType === 'bass' ? 'Clave de Fá · graves' : 'Clave de Sol · agudos';

    const g = svgEl('g', { class: 'staff-lines' }, this.svg);
    for (let i = 0; i < 5; i++) {
      const y = STAFF.top + i * 20;
      svgEl('line', { x1: 16, y1: y, x2: W - 16, y2: y, stroke: PAPER_LINE, 'stroke-width': 1.6 }, g);
    }
    svgEl('line', { x1: 16, y1: STAFF.top, x2: 16, y2: STAFF.bottom, stroke: PAPER_LINE, 'stroke-width': 2 }, g);
    // Barra final dupla (fina + grossa)
    svgEl('line', { x1: W - 24, y1: STAFF.top, x2: W - 24, y2: STAFF.bottom, stroke: PAPER_LINE, 'stroke-width': 1.6 }, g);
    svgEl('line', { x1: W - 18, y1: STAFF.top, x2: W - 18, y2: STAFF.bottom, stroke: PAPER_LINE, 'stroke-width': 5 }, g);

    if (clefType === 'bass') this.drawBassClef(52, 90);
    else this.drawTrebleClef(50, 130);

    // Armadura de clave
    keySig.forEach((pitch, i) => {
      const y = staffY(pitch, clefType);
      const x = 102 + i * 16;
      if (pitch.includes('#')) this.drawSharp(x, y, INK);
      else this.drawFlat(x, y, INK);
    });
  }

  // Clave de Sol desenhada em curvas (independe de fonte): o caracol fecha
  // em volta da 2ª linha (y=130), a haste sobe 1,5 espaço acima da pauta e
  // termina num gancho com bolinha abaixo da 1ª linha.
  drawTrebleClef(x, gy) {
    const g = svgEl('g', { class: 'clef-mark', transform: `translate(${x} ${gy})` }, this.svg);
    const d = [
      'M 3 -1',
      'C -9 -4, -12 10, -1 12',     // laço interno em volta da linha de Sol
      'C 12 14, 22 3, 19 -10',      // sobe pela direita
      'C 16 -24, -4 -26, -15 -14',  // topo do bojo
      'C -26 -2, -22 20, -4 25',    // desce pela esquerda
      'C 14 30, 30 16, 22 -8',      // fecha o bojo grande
      'C 14 -30, 6 -52, 9 -74',     // haste subindo
      'C 11 -90, 0 -96, -5 -84',    // volta do topo
      'C -10 -70, 0 -40, 4 -12',    // desce cruzando a haste
      'L 10 44',                    // haste até abaixo da pauta
      'C 12 56, -6 60, -10 50'      // gancho final
    ].join(' ');
    svgEl('path', { d, fill: 'none', stroke: INK, 'stroke-width': 4.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
    svgEl('circle', { cx: -7, cy: 47, r: 5.5, fill: INK }, g);
  }

  // Clave de Fá: bolinha na 4ª linha (y=90), curva para a direita e para
  // baixo, e os dois pontos nos espaços acima/abaixo da linha de Fá.
  drawBassClef(x, fy) {
    const g = svgEl('g', { class: 'clef-mark', transform: `translate(${x} ${fy})` }, this.svg);
    svgEl('circle', { cx: 0, cy: 0, r: 7, fill: INK }, g);
    svgEl('path', {
      d: 'M -6 -2 C -6 -22, 30 -26, 32 0 C 34 24, 12 42, -12 54',
      fill: 'none', stroke: INK, 'stroke-width': 4.6, 'stroke-linecap': 'round'
    }, g);
    svgEl('circle', { cx: 44, cy: -10, r: 3.6, fill: INK }, g);
    svgEl('circle', { cx: 44, cy: 10, r: 3.6, fill: INK }, g);
  }

  drawSharp(x, y, color, parent) {
    const g = svgEl('g', { class: 'accidental' }, parent || this.svg);
    svgEl('line', { x1: x - 3, y1: y - 15, x2: x - 3, y2: y + 15, stroke: color, 'stroke-width': 1.8 }, g);
    svgEl('line', { x1: x + 3, y1: y - 17, x2: x + 3, y2: y + 13, stroke: color, 'stroke-width': 1.8 }, g);
    svgEl('line', { x1: x - 7, y1: y - 3, x2: x + 7, y2: y - 7, stroke: color, 'stroke-width': 4 }, g);
    svgEl('line', { x1: x - 7, y1: y + 7, x2: x + 7, y2: y + 3, stroke: color, 'stroke-width': 4 }, g);
  }

  drawFlat(x, y, color, parent) {
    const g = svgEl('g', { class: 'accidental' }, parent || this.svg);
    svgEl('line', { x1: x - 4, y1: y - 26, x2: x - 4, y2: y + 7, stroke: color, 'stroke-width': 2 }, g);
    svgEl('path', {
      d: `M ${x - 4} ${y + 7} C ${x + 9} ${y}, ${x + 8} ${y - 10}, ${x - 4} ${y - 3}`,
      fill: 'none', stroke: color, 'stroke-width': 3, 'stroke-linecap': 'round'
    }, g);
  }

  /** Desenha uma nota completa (linhas suplementares, acidente, cabeça, haste). */
  drawNote(pitch, x, opts = {}) {
    const p = parsePitch(pitch);
    if (!p) return null;
    const color = opts.color || INK;
    const y = staffY(pitch, this.clef);
    const g = svgEl('g', { class: `staff-note ${opts.className || ''}`.trim() }, this.svg);
    if (opts.id) g.setAttribute('id', opts.id);

    ledgerLines(y).forEach((ly) => {
      svgEl('line', { x1: x - 19, y1: ly, x2: x + 19, y2: ly, stroke: PAPER_LINE, 'stroke-width': 1.8 }, g);
    });

    const inKey = this.keySig.some((k) => k[0] === p.letter && parsePitch(k).acc === p.acc);
    if (p.acc && !inKey) {
      if (p.acc > 0) this.drawSharp(x - 24, y, color, g);
      else this.drawFlat(x - 24, y, color, g);
    }

    // Cabeça: elipse inclinada ~20°, altura de um espaço (sem cruzar linhas).
    svgEl('ellipse', { cx: x, cy: y, rx: 11.5, ry: 8.2, transform: `rotate(-20 ${x} ${y})`, fill: color }, g);

    // Haste: 3,5 espaços (70u), alongada até a linha do meio se preciso.
    const up = y > STAFF.middle;
    const len = Math.max(70, Math.abs(y - STAFF.middle));
    const sx = up ? x + 10.4 : x - 10.4;
    svgEl('line', { x1: sx, y1: up ? y - 2 : y + 2, x2: sx, y2: up ? y - len : y + len, stroke: color, 'stroke-width': 2.4, 'stroke-linecap': 'round' }, g);

    if (opts.label) {
      svgEl('text', { x, y: 230, 'text-anchor': 'middle', class: 'note-guide', fill: opts.labelColor || '#4b4a57' }, g).textContent = opts.label;
    }
    return g;
  }

  noteLabel(pitch) {
    const p = parsePitch(pitch);
    if (!p) return pitch;
    const accTxt = p.acc > 0 ? '♯' : p.acc < 0 ? '♭' : '';
    return useLatinNotation ? `${LATIN[p.letter]}${accTxt}` : `${p.letter}${accTxt}`;
  }

  drawNotes(pitches, highlightIndex = 0) {
    if (!Array.isArray(pitches)) pitches = [pitches];
    const n = pitches.length;
    const startX = this.keySig.length ? 150 : 140;
    const endX = this.width - 50;
    const span = endX - startX;
    const step = n > 1 ? Math.min(78, span / (n - 1)) : 0;
    const offset = n === 1 ? (startX + endX) / 2 - startX : (span - step * (n - 1)) / 2;
    pitches.forEach((pitch, idx) => {
      const isTarget = idx === highlightIndex;
      const showLabel = this.guideMode || n > 1;
      this.drawNote(pitch, startX + offset + idx * step, {
        id: `svg-note-${idx}`,
        color: isTarget ? this.accent : INK,
        className: isTarget ? 'note-glow' : '',
        label: showLabel ? this.noteLabel(pitch) : '',
        labelColor: isTarget ? this.accent : '#5b5a66'
      });
    });
  }

  drawMystery() {
    const x = this.width / 2;
    const t = svgEl('text', { x, y: 128, 'text-anchor': 'middle', class: 'mystery-mark', fill: this.accent }, this.svg);
    t.textContent = '?';
  }

  // Comparador educativo: a nota certa (verde) ao lado da tocada (vermelho).
  drawErrorComparison(targetPitch, playedPitch) {
    this.renderStaff(this.clef, this.keySig);
    // Tecla tocada muito longe (ex.: C2 na clave de Sol): mostra na oitava
    // mais próxima do alvo para caber na pauta.
    if (playedPitch) {
      const pp = parsePitch(playedPitch);
      const tp = parsePitch(targetPitch);
      let oct = pp.octave;
      while (Math.abs((oct * 7 + LETTERS.indexOf(pp.letter)) - tp.diatonic) > 4 && oct !== tp.octave) oct += oct < tp.octave ? 1 : -1;
      playedPitch = `${pp.letter}${pp.acc > 0 ? '#' : pp.acc < 0 ? 'b' : ''}${oct}`;
    }
    const x1 = this.width * 0.4;
    const x2 = this.width * 0.64;
    this.drawNote(targetPitch, x1, { color: '#047857', label: `${this.noteLabel(targetPitch)} ✓`, labelColor: '#047857' });
    if (playedPitch) {
      this.drawNote(playedPitch, x2, { color: '#be123c', label: `${this.noteLabel(playedPitch)} ✗`, labelColor: '#be123c', className: 'note-wrong' });
    }
    this.animateError();
  }

  animateSuccess() {
    document.getElementById('svg-note-0')?.classList.add('note-hit-anim');
  }

  animateError() {
    if (reduceMotion.matches) return;
    const wrapper = document.querySelector('.staff-display-card');
    if (!wrapper) return;
    wrapper.classList.remove('staff-shake');
    void wrapper.offsetWidth;
    wrapper.classList.add('staff-shake');
    setTimeout(() => wrapper.classList.remove('staff-shake'), 450);
  }
}

// --- 5. INSTÂNCIAS E ESTADO DE JOGO --------------------------------------
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const synth = new WebAudioSynth();
const gameManager = new MaestroGameManager();
const renderer = new StaffSVGRenderer('staff-canvas');

let currentMode = 'quiz';
let currentClefSetting = 'treble';
let questionClef = 'treble';
let currentTargetPitch = 'G4';
let useLatinNotation = gameManager.state.prefs.latin !== false;
let nextNoteTimer = null;
let questionHadError = false;
let answerLocked = false;

const arcade = { running: false, paused: false, endsAt: 0, remaining: 60000, score: 0, timer: null };
const scalePlayback = { timers: [], playing: false };

// --- 6. TECLADO VIRTUAL C2–C6 ----------------------------------------------
const KB_FIRST = 36;
const KB_LAST = 84;
const BLACK_PCS = new Set([1, 3, 6, 8, 10]);
const PC_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const midiToPitch = (m) => `${PC_NAMES[m % 12]}${Math.floor(m / 12) - 1}`;

function setupVirtualKeyboard() {
  const kb = document.getElementById('piano-keyboard');
  if (!kb) return;
  kb.textContent = '';
  let white = 0;
  for (let m = KB_FIRST; m <= KB_LAST; m++) {
    const pc = m % 12;
    const pitch = midiToPitch(m);
    const key = document.createElement('div');
    key.dataset.pitch = pitch;
    key.dataset.midi = String(m);
    if (BLACK_PCS.has(pc)) {
      key.className = 'black-key';
      key.style.setProperty('--i', String(white));
    } else {
      key.className = 'white-key';
      if (pc === 0) key.classList.add('is-c');
      if (m === 60) key.classList.add('is-middle-c');
      const label = document.createElement('span');
      label.className = 'wk-label';
      key.appendChild(label);
      white++;
    }
    kb.appendChild(key);
  }
  kb.style.setProperty('--whites', String(white));
  refreshKeyboardLabels();

  // Multitoque: cada ponteiro toca a tecla em que caiu.
  // passive:false — Safari iOS ignora preventDefault em listeners passivos.
  const kbOpts = { passive: false };
  kb.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const key = e.target.closest('[data-pitch]');
    if (!key) return;
    e.preventDefault();
    handleNoteInput(key.dataset.pitch, e);
  }, kbOpts);
  kb.addEventListener('touchstart', (e) => {
    const key = e.target.closest && e.target.closest('[data-pitch]');
    if (key) e.preventDefault();
  }, kbOpts);
  kb.addEventListener('contextmenu', (e) => e.preventDefault());
}

function refreshKeyboardLabels() {
  document.querySelectorAll('#piano-keyboard .white-key').forEach((key) => {
    const p = parsePitch(key.dataset.pitch);
    const label = key.querySelector('.wk-label');
    if (!label || !p) return;
    const name = useLatinNotation ? LATIN[p.letter] : p.letter;
    label.textContent = p.letter === 'C' ? `${name}${p.octave}` : name;
  });
}

function flashKey(pitch) {
  const p = parsePitch(pitch);
  if (!p) return;
  const key = document.querySelector(`#piano-keyboard [data-midi="${p.midi}"]`);
  if (!key) return;
  key.classList.remove('active-key');
  void key.offsetWidth;
  key.classList.add('active-key');
  setTimeout(() => key.classList.remove('active-key'), 380);
}

// Mantém a região da clave visível no teclado rolável do celular.
function scrollKeyboardTo(pitch) {
  const wrap = document.getElementById('piano-scroll');
  const p = parsePitch(pitch);
  if (!wrap || !p || wrap.scrollWidth <= wrap.clientWidth + 2) return;
  const key = document.querySelector(`#piano-keyboard [data-midi="${p.midi - (p.midi % 12)}"]`);
  if (!key) return;
  const target = key.offsetLeft - wrap.clientWidth / 2 + key.offsetWidth * 3.5;
  wrap.scrollTo({ left: Math.max(0, target), behavior: reduceMotion.matches ? 'auto' : 'smooth' });
}

function updateKeyboardZones() {
  const left = document.getElementById('zone-left');
  const right = document.getElementById('zone-right');
  if (!left || !right) return;
  left.classList.toggle('active-zone', currentClefSetting !== 'treble');
  right.classList.toggle('active-zone', currentClefSetting !== 'bass');
}

function updateNotationButtons() {
  document.querySelectorAll('.trigger-pad').forEach((b) => {
    const note = b.dataset.note;
    const nameEl = b.querySelector('.note-name');
    const cifraEl = b.querySelector('.note-cifra');
    if (nameEl) nameEl.textContent = useLatinNotation ? LATIN[note] : note;
    if (cifraEl) cifraEl.textContent = useLatinNotation ? note : LATIN[note];
  });
  refreshKeyboardLabels();
  setText('notation-mode-display', useLatinNotation ? 'Dó Ré Mi' : 'C D E');
}

// --- 7. FLUXO DE PERGUNTAS ------------------------------------------------
function updateFeedback(msg, type = 'normal') {
  const banner = document.getElementById('feedback-display');
  const icon = document.getElementById('feedback-icon');
  const text = document.getElementById('feedback-text');
  if (!banner || !text) return;
  banner.classList.remove('success', 'error', 'feedback-pop');
  if (type === 'success' || type === 'error') {
    banner.classList.add(type);
    if (!reduceMotion.matches) {
      void banner.offsetWidth;
      banner.classList.add('feedback-pop');
    }
  }
  if (icon) icon.textContent = type === 'success' ? '✅' : type === 'error' ? '↺' : '💡';
  text.innerHTML = msg;
}

function nameOf(letter) {
  return useLatinNotation ? LATIN[letter] : letter;
}

function pickTarget() {
  let clef = currentClefSetting;
  if (clef === 'both') clef = Math.random() < 0.5 ? 'treble' : 'bass';
  const pool = poolFor(clef, gameManager.state.level);
  let next = currentTargetPitch;
  let guard = 0;
  while ((next === currentTargetPitch || !pool.includes(next)) && guard++ < 20) {
    next = pool[Math.floor(Math.random() * pool.length)];
  }
  questionClef = clef;
  currentTargetPitch = next;
}

function setTargetClefAndPitch() {
  clearTimeout(nextNoteTimer);
  nextNoteTimer = null;
  answerLocked = false;
  questionHadError = false;
  currentClefSetting = document.getElementById('clef-select')?.value || 'treble';
  pickTarget();
  updateKeyboardZones();
  renderer.renderStaff(questionClef);

  if (currentMode === 'ear') {
    renderer.drawMystery();
    playTargetSound(0.25);
  } else {
    renderer.drawNotes([currentTargetPitch], 0);
  }
  scrollKeyboardTo(currentTargetPitch);
}

function playTargetSound(delay = 0) {
  synth.unlock();
  const t = synth.now() + delay;
  synth.playNote(currentTargetPitch, { when: t, dur: 1.2, vel: 0.8 });
}

// Botão de letra (sem oitava) soa na oitava mais próxima do alvo.
function resolvePadPitch(letter) {
  const target = parsePitch(currentTargetPitch);
  const baseOct = target ? target.octave : (renderer.clef === 'bass' ? 3 : 4);
  let best = `${letter}${baseOct}`;
  let bestDist = Infinity;
  for (let o = baseOct - 1; o <= baseOct + 1; o++) {
    const c = parsePitch(`${letter}${o}`);
    const d = target ? Math.abs(c.midi - target.midi) : 0;
    if (d < bestDist) { bestDist = d; best = `${letter}${o}`; }
  }
  return best;
}

function eventPoint(event) {
  if (event && Number.isFinite(event.clientX) && event.clientX > 0) return { x: event.clientX, y: event.clientY };
  const banner = document.getElementById('feedback-display');
  if (banner) {
    const r = banner.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top };
  }
  return { x: window.innerWidth / 2, y: window.innerHeight / 3 };
}

function handleNoteInput(pitchOrLetter, event) {
  synth.unlock();
  hideAudioHintSoon();
  const fromPad = pitchOrLetter.length === 1;
  const soundPitch = fromPad ? resolvePadPitch(pitchOrLetter) : pitchOrLetter;
  const played = parsePitch(soundPitch);
  if (!played) return;

  synth.playNote(soundPitch, { dur: 0.9, vel: 0.78 });
  flashKey(soundPitch);

  if (currentMode === 'scales') {
    if (!scalePlayback.playing) updateFeedback(`Você tocou <strong>${renderer.noteLabel(soundPitch)}${played.octave}</strong>.`);
    return;
  }

  const answering = currentMode === 'quiz' || currentMode === 'ear' || (currentMode === 'arcade' && arcade.running && !arcade.paused);
  if (!answering || answerLocked) return;

  const target = parsePitch(currentTargetPitch);
  // Leitura pelo nome: a letra precisa bater e não pode haver acidente.
  const isCorrect = played.letter === target.letter && played.acc === target.acc;
  const exactOctave = played.midi === target.midi;
  const pt = eventPoint(event);
  const where = positionName(currentTargetPitch, questionClef);
  const correctName = nameOf(target.letter);

  if (isCorrect) {
    answerLocked = true;
    synth.playSFX('correct');
    renderer.animateSuccess();
    if (currentMode === 'ear') {
      // Revela a nota que soou, para ligar som e escrita.
      renderer.renderStaff(questionClef);
      renderer.drawNotes([currentTargetPitch], 0);
      document.getElementById('svg-note-0')?.classList.add('note-hit-anim');
    }
    // O erro desta pergunta já foi contado; a correção só rende XP reduzido.
    if (!questionHadError) gameManager.registerHit(true, currentMode === 'ear');
    gameManager.addXP(questionHadError ? 4 : 10, pt.x, pt.y);
    if (currentMode === 'arcade') {
      arcade.score += 10 + Math.min(10, gameManager.state.combo);
      setText('arcade-score', String(arcade.score));
    }
    const octaveNote = !fromPad && !exactOctave ? ` (mesma nota, outra oitava — a da pauta é ${correctName}${target.octave})` : '';
    updateFeedback(`<strong>${correctName}${target.octave}</strong> — ${where}.${octaveNote}`, 'success');
    nextNoteTimer = setTimeout(setTargetClefAndPitch, currentMode === 'arcade' ? 420 : 900);
  } else {
    questionHadError = true;
    synth.playSFX('error');
    gameManager.registerHit(false, currentMode === 'ear');
    const playedName = `${nameOf(played.letter)}${played.acc > 0 ? '♯' : played.acc < 0 ? '♭' : ''}`;
    if (currentMode === 'ear') {
      updateFeedback(`Não é <strong>${playedName}</strong>. Ouça de novo (<kbd>R</kbd>) e compare.`, 'error');
      setTimeout(() => playTargetSound(0), 500);
    } else if (currentMode === 'arcade') {
      updateFeedback(`Era <strong>${correctName}</strong> (${where}).`, 'error');
      renderer.animateError();
      answerLocked = true;
      nextNoteTimer = setTimeout(setTargetClefAndPitch, 650);
    } else {
      updateFeedback(`Você tocou <strong>${playedName}</strong>; a nota da pauta é <strong>${correctName}</strong> — ${where}. Toque ${correctName} para seguir.`, 'error');
      renderer.drawErrorComparison(currentTargetPitch, soundPitch);
    }
  }
}

// --- 8. ESCALAS (agendadas no relógio do áudio) ---------------------------
function stopScale(silent) {
  scalePlayback.timers.forEach(clearTimeout);
  scalePlayback.timers = [];
  scalePlayback.playing = false;
  const stopBtn = document.getElementById('btn-stop-scale');
  if (stopBtn) stopBtn.disabled = true;
  if (!silent) updateFeedback('Escala interrompida.');
}

function showScale(scaleId, highlight = -1, dir = 'asc') {
  const scale = SCALES[scaleId];
  if (!scale) return;
  const notes = dir === 'asc' ? scale.notes : [...scale.notes].reverse();
  renderer.renderStaff(scale.clef, scale.keySig);
  renderer.drawNotes(notes, highlight);
  const theory = document.getElementById('scale-theory-desc');
  if (theory) theory.innerHTML = scale.theory;
}

function playSelectedScale(direction = 'asc') {
  stopScale(true);
  synth.unlock();
  const scaleId = document.getElementById('scale-select')?.value || 'C-major';
  const scale = SCALES[scaleId];
  if (!scale) return;
  const notes = direction === 'asc' ? scale.notes : [...scale.notes].reverse();
  const gap = 0.42;
  scalePlayback.playing = true;
  const stopBtn = document.getElementById('btn-stop-scale');
  if (stopBtn) stopBtn.disabled = false;
  updateFeedback(`🎶 ${scale.name} ${direction === 'asc' ? 'subindo' : 'descendo'}…`);
  showScale(scaleId, -1, direction);
  gameManager.registerScaleExplored(scaleId);

  const start = synth.now() + 0.08;
  notes.forEach((pitch, i) => {
    synth.playNote(pitch, { when: start + i * gap, dur: i === notes.length - 1 ? 1.1 : 0.5, vel: 0.72 });
    scalePlayback.timers.push(setTimeout(() => {
      showScale(scaleId, i, direction);
      flashKey(pitch);
    }, 80 + i * gap * 1000));
  });
  scalePlayback.timers.push(setTimeout(() => {
    scalePlayback.playing = false;
    if (stopBtn) stopBtn.disabled = true;
    updateFeedback(`✅ ${scale.name}: ${notes.map((n) => renderer.noteLabel(n)).join(' · ')}`, 'success');
  }, 80 + notes.length * gap * 1000 + 400));
}

// --- 9. DESAFIO 60s ---------------------------------------------------------
function renderArcadeButton() {
  const btn = document.getElementById('btn-start-arcade');
  if (!btn) return;
  if (arcade.running && arcade.paused) {
    btn.textContent = '▶ Continuar';
    btn.disabled = false;
    btn.classList.add('pulse-btn');
  } else if (arcade.running) {
    btn.textContent = '⏸ Pausar';
    btn.disabled = false;
    btn.classList.remove('pulse-btn');
  } else {
    btn.textContent = arcade.score > 0 ? '⚡ Jogar de novo' : '⚡ Iniciar';
    btn.disabled = false;
    btn.classList.add('pulse-btn');
  }
}

function tickArcade() {
  if (!arcade.running || arcade.paused) return;
  const left = Math.max(0, arcade.endsAt - performance.now());
  setText('timer-display', `${Math.ceil(left / 1000)}s`);
  document.getElementById('timer-display')?.classList.toggle('hurry', left < 10000);
  if (left <= 0) finishArcade();
}

function startArcadeMode() {
  synth.unlock();
  if (arcade.running) {
    if (arcade.paused) resumeArcade();
    else pauseArcade('Pausado.');
    return;
  }
  arcade.running = true;
  arcade.paused = false;
  arcade.score = 0;
  arcade.endsAt = performance.now() + 60000;
  setText('arcade-score', '0');
  updateFeedback('⚡ Valendo! Acerte o máximo de notas em 60 segundos.');
  setTargetClefAndPitch();
  clearInterval(arcade.timer);
  arcade.timer = setInterval(tickArcade, 200);
  tickArcade();
  renderArcadeButton();
}

function pauseArcade(msg) {
  if (!arcade.running || arcade.paused) return;
  arcade.paused = true;
  arcade.remaining = Math.max(0, arcade.endsAt - performance.now());
  clearInterval(arcade.timer);
  clearTimeout(nextNoteTimer);
  nextNoteTimer = null;
  updateFeedback(`${msg} Toque <strong>Continuar</strong> quando quiser.`);
  renderArcadeButton();
}

function resumeArcade() {
  if (!arcade.running || !arcade.paused) return;
  arcade.paused = false;
  arcade.endsAt = performance.now() + arcade.remaining;
  arcade.timer = setInterval(tickArcade, 200);
  setTargetClefAndPitch();
  updateFeedback('Valendo de novo!');
  renderArcadeButton();
}

function stopArcade() {
  clearInterval(arcade.timer);
  arcade.timer = null;
  arcade.running = false;
  arcade.paused = false;
  setText('timer-display', '60s');
  document.getElementById('timer-display')?.classList.remove('hurry');
  renderArcadeButton();
}

function finishArcade() {
  const score = arcade.score;
  stopArcade();
  clearTimeout(nextNoteTimer);
  nextNoteTimer = null;
  answerLocked = true;
  setText('timer-display', '0s');
  if (score > gameManager.state.maxArcadeScore) {
    gameManager.state.maxArcadeScore = score;
    gameManager.saveState();
    updateFeedback(`🏆 Novo recorde: <strong>${score}</strong> pontos!`, 'success');
    synth.playSFX('levelup');
  } else {
    updateFeedback(`⏰ Tempo! <strong>${score}</strong> pontos. Recorde: ${gameManager.state.maxArcadeScore}.`);
  }
  if (score >= 150) gameManager.unlockBadge('speed_demon');
}

// --- 10. MODAL DE TROFÉUS ---------------------------------------------------
function renderBadgesModal() {
  const container = document.getElementById('badges-grid-container');
  if (!container) return;
  container.textContent = '';
  Object.values(BADGES_DEFINITIONS).forEach((b) => {
    const unlocked = gameManager.state.unlockedBadges.includes(b.id);
    const card = document.createElement('div');
    card.className = `badge-card ${unlocked ? 'unlocked' : 'locked'}`;
    const icon = document.createElement('div');
    icon.className = 'badge-icon';
    icon.textContent = unlocked ? b.icon : '🔒';
    const info = document.createElement('div');
    info.className = 'badge-info';
    const h3 = document.createElement('h3');
    h3.textContent = b.title;
    const p = document.createElement('p');
    p.textContent = b.desc;
    info.append(h3, p);
    card.append(icon, info);
    container.appendChild(card);
  });
}

let lastFocus = null;
function openModal() {
  const modal = document.getElementById('modal-badges');
  if (!modal) return;
  lastFocus = document.activeElement;
  gameManager.updateDashboardUI();
  renderBadgesModal();
  modal.classList.remove('hidden');
  document.getElementById('btn-close-badges')?.focus();
  if (arcade.running) pauseArcade('Pausado.');
}

function closeModal() {
  const modal = document.getElementById('modal-badges');
  if (!modal || modal.classList.contains('hidden')) return;
  modal.classList.add('hidden');
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}

function setupModalListeners() {
  document.getElementById('btn-open-badges')?.addEventListener('click', openModal);
  document.getElementById('btn-close-badges')?.addEventListener('click', closeModal);
  document.getElementById('modal-badges')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-badges') closeModal();
  });
  document.getElementById('btn-reset-data')?.addEventListener('click', () => gameManager.resetProgress());
}

// --- 11. ABAS E CONTROLES ---------------------------------------------------
const MODE_COPY = {
  quiz: { instr: 'Qual é esta nota?', feedback: 'Leia a nota em destaque e toque o nome dela.' },
  ear: { instr: 'Que nota soou?', feedback: 'Ouça e responda. <kbd>R</kbd> ou 🔁 repete o som.' },
  arcade: { instr: 'Quantas em 60 s?', feedback: 'Toque <strong>Iniciar</strong> para disparar o cronômetro.' },
  scales: { instr: 'Ouça e veja a escala', feedback: 'Escolha uma escala e toque ▲ ou ▼.' }
};

function switchMode(mode) {
  if (!MODE_COPY[mode]) return;
  stopScale(true);
  clearTimeout(nextNoteTimer);
  nextNoteTimer = null;
  if (arcade.running) stopArcade();
  arcade.score = 0;
  setText('arcade-score', '0');
  renderArcadeButton();

  currentMode = mode;
  document.querySelectorAll('.tab-btn').forEach((t) => {
    const on = t.dataset.mode === mode;
    t.classList.toggle('active', on);
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
  });
  document.getElementById('toolbar-scales')?.classList.toggle('hidden', mode !== 'scales');
  document.getElementById('toolbar-arcade')?.classList.toggle('hidden', mode !== 'arcade');
  const replay = document.getElementById('btn-replay');
  if (replay) replay.hidden = mode !== 'ear';
  document.body.dataset.mode = mode;
  setText('mode-instruction-text', MODE_COPY[mode].instr);
  updateFeedback(MODE_COPY[mode].feedback);

  if (mode === 'scales') {
    showScale(document.getElementById('scale-select')?.value || 'C-major');
  } else if (mode === 'arcade') {
    answerLocked = true;
    renderer.renderStaff(currentClefSetting === 'bass' ? 'bass' : 'treble');
    renderer.drawMystery();
  } else {
    setTargetClefAndPitch();
  }
  savePrefs();
}

function savePrefs() {
  gameManager.state.prefs = {
    latin: useLatinNotation,
    guide: renderer.guideMode,
    clef: document.getElementById('clef-select')?.value,
    instrument: synth.instrument,
    mode: currentMode
  };
  gameManager.saveState();
}

function setupTabs() {
  const tabs = Array.from(document.querySelectorAll('.tab-btn'));
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => {
      if (currentMode !== tab.dataset.mode) switchMode(tab.dataset.mode);
    });
    // Setas navegam entre abas (padrão WAI-ARIA de tablist).
    tab.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
      next.focus();
      next.click();
    });
  });
}

const PHYS_KEYS = { KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6, KeyG: 7, KeyY: 8, KeyH: 9, KeyU: 10, KeyJ: 11, KeyK: 12 };

function setupControlBars() {
  const prefs = gameManager.state.prefs || {};
  const instrumentSelect = document.getElementById('instrument-select');
  if (instrumentSelect) {
    if (prefs.instrument && instrumentSelect.querySelector(`option[value="${prefs.instrument}"]`)) instrumentSelect.value = prefs.instrument;
    synth.setInstrument(instrumentSelect.value);
    instrumentSelect.addEventListener('change', () => {
      synth.setInstrument(instrumentSelect.value);
      synth.unlock();
      synth.playNote(currentMode === 'scales' ? 'C4' : currentTargetPitch, { dur: 0.8 });
      savePrefs();
    });
  }

  const clefSelect = document.getElementById('clef-select');
  if (clefSelect) {
    if (prefs.clef && clefSelect.querySelector(`option[value="${prefs.clef}"]`)) clefSelect.value = prefs.clef;
    currentClefSetting = clefSelect.value;
    clefSelect.addEventListener('change', () => {
      currentClefSetting = clefSelect.value;
      updateKeyboardZones();
      if (currentMode === 'quiz' || currentMode === 'ear') setTargetClefAndPitch();
      else if (currentMode === 'arcade' && arcade.running && !arcade.paused) setTargetClefAndPitch();
      savePrefs();
    });
  }

  document.getElementById('toggle-notation-btn')?.addEventListener('click', () => {
    useLatinNotation = !useLatinNotation;
    updateNotationButtons();
    if (currentMode === 'scales') showScale(document.getElementById('scale-select').value);
    else if (currentMode !== 'ear' && !answerLocked) { renderer.renderStaff(questionClef); renderer.drawNotes([currentTargetPitch], 0); }
    savePrefs();
  });

  const btnHint = document.getElementById('toggle-hint-btn');
  const applyGuide = () => {
    setText('hint-status', renderer.guideMode ? 'on' : 'off');
    btnHint?.classList.toggle('active', renderer.guideMode);
    btnHint?.setAttribute('aria-pressed', String(renderer.guideMode));
  };
  renderer.guideMode = !!prefs.guide;
  applyGuide();
  btnHint?.addEventListener('click', () => {
    renderer.guideMode = !renderer.guideMode;
    applyGuide();
    if ((currentMode === 'quiz' || currentMode === 'arcade') && !answerLocked) {
      renderer.renderStaff(questionClef);
      renderer.drawNotes([currentTargetPitch], 0);
    }
    savePrefs();
  });

  document.getElementById('btn-play-scale')?.addEventListener('click', () => playSelectedScale('asc'));
  document.getElementById('btn-play-scale-desc')?.addEventListener('click', () => playSelectedScale('desc'));
  document.getElementById('btn-stop-scale')?.addEventListener('click', () => stopScale(false));
  document.getElementById('scale-select')?.addEventListener('change', (e) => {
    stopScale(true);
    showScale(e.target.value);
    updateFeedback(`Escala: <strong>${SCALES[e.target.value].name}</strong>. Toque ▲ ou ▼ para ouvir.`);
  });

  document.getElementById('btn-start-arcade')?.addEventListener('click', startArcadeMode);
  document.getElementById('btn-replay')?.addEventListener('click', () => playTargetSound(0));

  document.querySelectorAll('.trigger-pad').forEach((btn) => {
    btn.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault(); // resposta no toque, sem esperar o "click" (~0 ms de latência)
      btn.classList.remove('active-hit');
      void btn.offsetWidth;
      btn.classList.add('active-hit');
      setTimeout(() => btn.classList.remove('active-hit'), 300);
      handleNoteInput(btn.dataset.note, e);
    });
    btn.addEventListener('click', (e) => {
      if (e.detail === 0) handleNoteInput(btn.dataset.note); // teclado (Enter/Espaço)
    });
  });

  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    const t = e.target;
    if (t instanceof HTMLElement && /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) return;
    if (e.key === 'Escape') { closeModal(); return; }
    if (!document.getElementById('modal-badges')?.classList.contains('hidden')) return;

    if (/^Digit[1-7]$/.test(e.code)) {
      e.preventDefault();
      const letter = LETTERS[Number(e.code.slice(5)) - 1];
      document.querySelector(`.trigger-pad[data-note="${letter}"]`)?.classList.add('active-hit');
      setTimeout(() => document.querySelector(`.trigger-pad[data-note="${letter}"]`)?.classList.remove('active-hit'), 250);
      handleNoteInput(letter);
      return;
    }
    if (e.code === 'KeyR') {
      e.preventDefault();
      if (currentMode === 'scales') playSelectedScale('asc');
      else playTargetSound(0);
      return;
    }
    const semi = PHYS_KEYS[e.code];
    if (semi !== undefined) {
      e.preventDefault();
      const target = parsePitch(currentTargetPitch);
      const baseOct = currentMode === 'scales' ? 4 : target ? target.octave : 4;
      handleNoteInput(midiToPitch((baseOct + 1) * 12 + semi));
    }
  });
}

// --- 12. STATUS DO ÁUDIO E CICLO DE VIDA -----------------------------------
const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let audioHintTimer = 0;
let lastAudioState = 'idle';

function renderAudioStatus() {
  const el = document.getElementById('audio-status');
  if (!el) return;
  const st = synth.state();
  el.dataset.state = st;
  const text = el.querySelector('.audio-status-text');
  clearTimeout(audioHintTimer);
  if (st === 'running') {
    el.hidden = lastAudioState === 'running';
    text.textContent = 'Som ativo';
    if (!el.hidden) audioHintTimer = setTimeout(() => { el.hidden = true; }, 1300);
  } else if (st === 'unsupported') {
    el.hidden = false;
    text.textContent = 'Este navegador não tem Web Audio — dá para ler, mas não para ouvir.';
  } else {
    el.hidden = false;
    const base = st === 'paused' ? 'Som pausado — toque aqui para retomar.' : 'Toque uma nota (ou aqui) para ligar o som.';
    text.textContent = isIOS ? `${base} No iPhone, suba o volume e confira o modo silencioso.` : base;
  }
  lastAudioState = st;
}

function hideAudioHintSoon() { /* o chip some sozinho quando o áudio roda */ }

function setupLifecycle() {
  synth.onState = renderAudioStatus;
  document.getElementById('audio-status')?.addEventListener('click', () => {
    synth.unlock();
    setTimeout(renderAudioStatus, 120);
  });
  let suspendTimer = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (arcade.running) pauseArcade('Pausado porque você saiu da aba.');
      if (scalePlayback.playing) stopScale(true);
      suspendTimer = setTimeout(() => synth.suspend(), 1200);
    } else {
      clearTimeout(suspendTimer);
      if (synth.state() === 'paused') synth.unlock();
      renderAudioStatus();
    }
  });
  window.addEventListener('blur', () => {
    if (arcade.running) pauseArcade('Pausado.');
  });
  const wake = () => { if (synth.state() === 'paused') synth.unlock(); };
  window.addEventListener('pointerdown', wake, true);
  window.addEventListener('keydown', wake, true);
}

// --- 13. INICIALIZAÇÃO ------------------------------------------------------
function init() {
  renderer.fitWidth();
  setupVirtualKeyboard();
  updateNotationButtons();
  setupTabs();
  setupControlBars();
  setupModalListeners();
  setupLifecycle();
  gameManager.updateDashboardUI();
  renderAudioStatus();

  const startMode = ['quiz', 'ear', 'scales'].includes(gameManager.state.prefs.mode) ? gameManager.state.prefs.mode : 'quiz';
  switchMode(startMode);

  const onResize = () => {
    const before = renderer.width;
    renderer.fitWidth();
    if (renderer.width === before) return;
    if (currentMode === 'scales') showScale(document.getElementById('scale-select').value);
    else if (currentMode === 'ear') { renderer.renderStaff(questionClef); renderer.drawMystery(); }
    else if (currentMode === 'arcade' && !arcade.running) { renderer.renderStaff(questionClef); renderer.drawMystery(); }
    else { renderer.renderStaff(questionClef); renderer.drawNotes([currentTargetPitch], 0); }
  };
  if (window.LabRuntime) LabRuntime.debounceResize(onResize);
  else window.addEventListener('resize', onResize);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
