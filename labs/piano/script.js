// ============================================================================
// PIANO MINIMALISTA - SONS ULTRA REALISTAS
// ============================================================================
//
// Remaster: piano de 49 teclas (C2–C6) sintetizado na hora pela Web Audio API.
//
// MODELO DE SOM (por nota, documentado para quem quiser afinar):
//   • Corpo harmônico: PeriodicWave por registro. A amplitude do parcial n vem
//     do ponto onde o martelo bate na corda (x0 ≈ 1/8 do comprimento):
//         a_n = |sin(n·π·x0)| / n^p        p = 1,05 (graves) … 1,6 (agudos)
//     — por isso o 8º parcial praticamente some, como num piano real.
//   • Coro de cordas: notas médias/agudas têm 3 cordas, graves 2. Cada corda é
//     um oscilador desafinado ±d cents (d = 0,4…1,6), o que gera o batimento
//     lento característico ("chorus" natural do piano).
//   • Brilho: passa-baixas que começa em f0·(4 + 22·v^1,3) e fecha para
//     f0·(2,5 + 4·v) com constante τf — os harmônicos agudos morrem antes.
//   • Envelope em dois estágios (prompt sound + aftersound):
//         ataque linear de 2–4 ms (sem clique)
//         τ1 = clamp(0,35·(261,6/f)^0,5; 0,06…0,8) s   → cai até ~ -11 dB
//         τ2 = clamp(2,2·(261,6/f)^0,7; 0,25…9) s      → cauda longa
//     O valor do envelope é calculado analiticamente (envAt) para que o
//     abafador comece exatamente do nível atual: zero estalos.
//   • Abafador (soltar a tecla sem pedal): setTargetAtTime(0, τ = 70–130 ms).
//     Acima de E6 (MIDI 88) pianos reais não têm abafador: a nota só decai.
//   • Martelo: rajada de ruído filtrada (≈ 25 ms) proporcional a v².
//   • Dinâmica: ganho = 0,17·(0,08 + 0,92·v²) → ~19 dB entre pp e ff.
//   • Pedal de sustain: segura as notas soltas e aumenta o envio de reverb
//     (ressonância simpática com todos os abafadores levantados).
//
// CADEIA MASTER: vozes → bus → (seco + reverb convolução) → volume →
//   compressor/limiter → saída. Polifonia limitada (20 no celular, 40 no
//   desktop) com voice stealing: rouba primeiro a voz já solta mais antiga,
//   depois a mais antiga — sempre com fade de 15 ms.
//
// ÁUDIO NO CELULAR: o AudioContext nasce no primeiro gesto (latencyHint
//   'interactive'), é retomado a cada gesto se o sistema o suspender, e é
//   suspenso com a aba oculta. No iPhone, navigator.audioSession = 'playback'
//   faz o som sair mesmo com a chave de silencioso (iOS 17+); o chip de
//   status explica quando o som está desligado e como liberar.
// ============================================================================

(function () {
  'use strict';

  // ==========================================================================
  // CONFIGURAÇÃO DAS NOTAS
  // ==========================================================================

  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const FIRST_MIDI = 36; // C2
  const LAST_MIDI = 84;  // C6 — 49 teclas, como um controlador de 4 oitavas
  const BLACK_PCS = new Set([1, 3, 6, 8, 10]);
  // Teclas pretas reais não ficam centradas na divisa: C#/D# e F#/G#/A# se
  // abrem para os lados. Deslocamento em fração da largura da tecla preta.
  const BLACK_OFFSET = { 1: -0.12, 3: 0.12, 6: -0.14, 8: 0, 10: 0.14 };

  const DYNAMICS = [
    { label: 'pp', v: 0.24 },
    { label: 'p', v: 0.38 },
    { label: 'mp', v: 0.52 },
    { label: 'mf', v: 0.66 },
    { label: 'f', v: 0.8 },
    { label: 'ff', v: 0.96 }
  ];

  // Mapeamento físico (event.code): funciona igual em QWERTY, ABNT2 e AZERTY.
  // Fileira de baixo = oitava base; fileira de cima = oitava base + 1.
  const KEY_CODES = {
    KeyZ: 0, KeyS: 1, KeyX: 2, KeyD: 3, KeyC: 4, KeyV: 5, KeyG: 6, KeyB: 7, KeyH: 8, KeyN: 9, KeyJ: 10, KeyM: 11,
    Comma: 12, KeyL: 13, Period: 14, Semicolon: 15, Slash: 16,
    KeyQ: 12, Digit2: 13, KeyW: 14, Digit3: 15, KeyE: 16, KeyR: 17, Digit5: 18, KeyT: 19, Digit6: 20, KeyY: 21,
    Digit7: 22, KeyU: 23, KeyI: 24, Digit9: 25, KeyO: 26, Digit0: 27, KeyP: 28, BracketLeft: 29, Equal: 30, BracketRight: 31
  };
  const CODE_LABEL = {
    Comma: ',', Period: '.', Semicolon: ';', Slash: '/', BracketLeft: '[', BracketRight: ']', Equal: '='
  };
  const KB_OCT_MIN = 2;
  const KB_OCT_MAX = 4;

  const STORAGE_KEY = 'piano-settings-v2';
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const MAX_VOICES = coarse ? 20 : 40;

  const midiName = (m) => `${NOTE_NAMES[m % 12]}${Math.floor(m / 12) - 1}`;
  const midiFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // ==========================================================================
  // ESTADO
  // ==========================================================================

  const settings = { volume: 0.75, dynamic: 3, reverb: 0.3, kbOctave: 3 };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved && typeof saved === 'object') {
      if (Number.isFinite(saved.volume)) settings.volume = clamp(saved.volume, 0, 1);
      if (Number.isFinite(saved.dynamic)) settings.dynamic = clamp(saved.dynamic | 0, 0, DYNAMICS.length - 1);
      if (Number.isFinite(saved.reverb)) settings.reverb = clamp(saved.reverb, 0, 1);
      if (Number.isFinite(saved.kbOctave)) settings.kbOctave = clamp(saved.kbOctave | 0, KB_OCT_MIN, KB_OCT_MAX);
    }
  } catch (err) { /* armazenamento indisponível */ }

  let saveTimer = 0;
  function saveSettings() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch (err) { /* modo privado */ }
    }, 250);
  }

  // midi → Set de fontes que seguram a nota ('p:<id>' ponteiro, 'k:<code>' teclado, 'm' MIDI)
  const holders = new Map();
  const keyEls = new Map();
  let pedalDown = false;
  let pedalLocked = false;

  // ==========================================================================
  // MOTOR DE ÁUDIO
  // ==========================================================================

  const Engine = (function () {
    let ctx = null;
    let bus = null;
    let revSend = null;
    let master = null;
    let noiseBuf = null;
    let unsupported = false;
    let everRan = false;
    const waves = new Map();
    const voices = [];          // todas as vozes vivas (inclusive em release)
    const noteVoice = new Map(); // midi → voz "dona" da tecla
    const pending = [];         // notas pedidas antes do contexto rodar
    let onState = () => {};

    function volumeGain(v) { return v * v * 1.1; }

    function makeImpulse(seconds) {
      // Reverb de sala pequena: ruído estéreo com decaimento exponencial e
      // agudos que morrem antes (média móvel crescente simula absorção do ar).
      const rate = ctx.sampleRate;
      const len = Math.max(1, Math.floor(rate * seconds));
      const buf = ctx.createBuffer(2, len, rate);
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        let lp = 0;
        for (let i = 0; i < len; i++) {
          const t = i / len;
          const k = 0.15 + t * 0.8; // quanto maior, mais escuro
          lp += ((Math.random() * 2 - 1) - lp) * (1 - k);
          d[i] = lp * Math.pow(1 - t, 2.4) * (i < rate * 0.008 ? i / (rate * 0.008) : 1);
        }
      }
      return buf;
    }

    function create() {
      if (ctx || unsupported) return ctx;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { unsupported = true; onState(); return null; }
      try {
        ctx = new AC({ latencyHint: 'interactive' });
      } catch (err) {
        try { ctx = new AC(); } catch (err2) { unsupported = true; onState(); return null; }
      }
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (err) { /* opcional */ }

      bus = ctx.createGain();
      bus.gain.value = 1;

      const dry = ctx.createGain();
      dry.gain.value = 0.92;
      revSend = ctx.createGain();
      revSend.gain.value = settings.reverb * 0.55;
      const conv = ctx.createConvolver();
      try { conv.buffer = makeImpulse(2.4); } catch (err) { /* sem reverb */ }

      master = ctx.createGain();
      master.gain.value = volumeGain(settings.volume);

      // Compressor suave + teto: acordes cheios em ff não clipam.
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -10;
      comp.knee.value = 8;
      comp.ratio.value = 6;
      comp.attack.value = 0.002;
      comp.release.value = 0.2;

      bus.connect(dry);
      dry.connect(master);
      bus.connect(revSend);
      revSend.connect(conv);
      conv.connect(master);
      master.connect(comp);
      comp.connect(ctx.destination);

      // Ruído compartilhado para o martelo (0,25 s basta).
      const n = Math.floor(ctx.sampleRate * 0.25);
      noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
      const nd = noiseBuf.getChannelData(0);
      for (let i = 0; i < n; i++) nd[i] = Math.random() * 2 - 1;

      ctx.onstatechange = () => {
        if (ctx.state === 'running') {
          everRan = true;
          flushPending();
        }
        onState();
      };
      return ctx;
    }

    // Chamado em todo gesto: cria/retoma o contexto. O buffer mudo de 1 amostra
    // é o "destrava" clássico do iOS antigo.
    function unlock() {
      if (!create()) return;
      if (ctx.state !== 'running') {
        try {
          const b = ctx.createBuffer(1, 1, ctx.sampleRate);
          const s = ctx.createBufferSource();
          s.buffer = b;
          s.connect(ctx.destination);
          s.start(0);
        } catch (err) { /* noop */ }
        const p = ctx.resume();
        if (p && p.then) p.then(onState, onState);
      }
    }

    function state() {
      if (unsupported) return 'unsupported';
      if (!ctx) return 'idle';
      if (ctx.state === 'running') return 'running';
      return everRan ? 'paused' : 'idle';
    }

    function waveFor(midi) {
      const bucket = Math.floor(midi / 6);
      let w = waves.get(bucket);
      if (w) return w;
      const fTop = midiFreq(bucket * 6 + 5);
      const fMid = midiFreq(bucket * 6 + 3);
      const limit = Math.min(ctx.sampleRate * 0.45, 14000);
      const count = clamp(Math.floor(limit / fTop), 2, 32);
      const real = new Float32Array(count + 1);
      const imag = new Float32Array(count + 1);
      // p cresce com a altura: graves ricos, agudos mais puros.
      const p = clamp(1.05 + Math.log2(fMid / 65.4) * 0.14, 1.05, 1.6);
      const x0 = 1 / 8.3;
      for (let n = 1; n <= count; n++) {
        imag[n] = Math.abs(Math.sin(n * Math.PI * x0)) / Math.pow(n, p);
      }
      w = ctx.createPeriodicWave(real, imag);
      waves.set(bucket, w);
      return w;
    }

    function killVoice(v, fast) {
      if (v.dead) return;
      v.dead = true;
      const now = ctx.currentTime;
      const g = v.env.gain;
      g.cancelScheduledValues(now);
      g.setValueAtTime(envAt(v, now), now);
      g.setTargetAtTime(0, now, fast ? 0.005 : 0.03);
      const end = now + (fast ? 0.05 : 0.2);
      v.oscs.forEach((o) => { try { o.stop(end); } catch (err) { /* já parado */ } });
    }

    function envAt(v, t) {
      if (v.releasedAt != null && t >= v.releasedAt) {
        return v.relFrom * Math.exp(-(t - v.releasedAt) / v.tauRel);
      }
      const t1 = v.t0 + v.att;
      if (t <= v.t0) return 0;
      if (t < t1) return v.peak * (t - v.t0) / v.att;
      const t2 = t1 + 3 * v.tau1;
      const target1 = v.peak * v.aft;
      if (t < t2) return target1 + (v.peak - target1) * Math.exp(-(t - t1) / v.tau1);
      const v2 = target1 + (v.peak - target1) * Math.exp(-3);
      return v2 * Math.exp(-(t - t2) / v.tau2);
    }

    function removeVoice(v) {
      const i = voices.indexOf(v);
      if (i !== -1) voices.splice(i, 1);
      if (noteVoice.get(v.midi) === v) noteVoice.delete(v.midi);
      try { v.out.disconnect(); } catch (err) { /* noop */ }
    }

    function stealIfNeeded() {
      while (voices.length >= MAX_VOICES) {
        let victim = null;
        for (const v of voices) {
          if (v.dead) continue;
          if (v.releasedAt != null && (!victim || victim.releasedAt == null || v.releasedAt < victim.releasedAt)) victim = v;
        }
        if (!victim) victim = voices.find((v) => !v.dead) || voices[0];
        killVoice(victim, true);
        removeVoice(victim);
      }
    }

    function startVoice(midi, velocity) {
      const now = ctx.currentTime;
      const f = midiFreq(midi);
      const vel = clamp(velocity, 0.05, 1);

      // Re-ataque: a mesma corda batida de novo. Abafa rápido a voz anterior.
      const prev = noteVoice.get(midi);
      if (prev) killVoice(prev, false);
      stealIfNeeded();

      const ratio = 261.63 / f;
      const v = {
        midi,
        t0: now,
        att: 0.002 + (1 - vel) * 0.002,
        peak: 0.17 * (0.08 + 0.92 * vel * vel),
        aft: 0.28,
        tau1: clamp(0.35 * Math.pow(ratio, 0.5), 0.06, 0.8),
        tau2: clamp(2.2 * Math.pow(ratio, 0.7), 0.25, 9),
        tauRel: midi < 48 ? 0.13 : midi < 72 ? 0.09 : 0.07,
        releasedAt: null,
        relFrom: 0,
        dead: false,
        oscs: [],
        env: null,
        out: null
      };

      const wave = waveFor(midi);
      const strings = midi < 41 ? 2 : 3;
      const spread = midi < 41 ? 0.4 : clamp(0.6 + (midi - 41) * 0.025, 0.6, 1.6);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 0.6;
      const fStart = clamp(f * (4 + 22 * Math.pow(vel, 1.3)), 400, 16000);
      const fEnd = clamp(f * (2.5 + 4 * vel), 250, 12000);
      const tauF = 0.25 + 0.6 * Math.sqrt(ratio);
      filter.frequency.setValueAtTime(fStart, now);
      filter.frequency.setTargetAtTime(fEnd, now + 0.01, tauF);

      const env = ctx.createGain();
      env.gain.setValueAtTime(0, now);
      env.gain.linearRampToValueAtTime(v.peak, now + v.att);
      env.gain.setTargetAtTime(v.peak * v.aft, now + v.att, v.tau1);
      env.gain.setTargetAtTime(0, now + v.att + 3 * v.tau1, v.tau2);

      const mix = ctx.createGain();
      mix.gain.value = 1 / strings;
      for (let s = 0; s < strings; s++) {
        const o = ctx.createOscillator();
        o.setPeriodicWave(wave);
        o.frequency.value = f;
        const off = strings === 2 ? (s ? spread : -spread) * 0.5 : (s - 1) * spread;
        o.detune.value = off + (Math.random() - 0.5) * 0.3;
        o.connect(mix);
        o.start(now);
        v.oscs.push(o);
      }
      mix.connect(filter);
      filter.connect(env);

      let out = env;
      if (ctx.createStereoPanner) {
        // Perspectiva do pianista: graves à esquerda, agudos à direita.
        const pan = ctx.createStereoPanner();
        pan.pan.value = clamp((midi - 60) / 40, -0.6, 0.6);
        env.connect(pan);
        out = pan;
      }
      out.connect(bus);
      v.env = env;
      v.out = out;

      // Martelo: ruído curto filtrado em banda, mais forte quanto maior v.
      try {
        const nz = ctx.createBufferSource();
        nz.buffer = noiseBuf;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = clamp(f * 3, 700, 5200);
        bp.Q.value = 0.9;
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0, now);
        ng.gain.linearRampToValueAtTime(0.05 * vel * vel, now + 0.001);
        ng.gain.setTargetAtTime(0, now + 0.002, 0.012);
        nz.connect(bp);
        bp.connect(ng);
        ng.connect(out);
        nz.start(now);
        nz.stop(now + 0.12);
      } catch (err) { /* sem martelo */ }

      // Fim natural: quando a cauda passa de -80 dB a voz é recolhida.
      const natural = now + v.att + 3 * v.tau1 + v.tau2 * 7;
      v.oscs.forEach((o) => o.stop(natural));
      v.oscs[0].onended = () => removeVoice(v);

      voices.push(v);
      noteVoice.set(midi, v);
      return v;
    }

    function releaseVoice(midi) {
      const v = noteVoice.get(midi);
      if (!v || v.dead || v.releasedAt != null) return;
      if (midi >= 89) return; // sem abafador no registro mais agudo
      const now = ctx.currentTime;
      const level = envAt(v, now);
      v.relFrom = level;
      v.releasedAt = now;
      const g = v.env.gain;
      g.cancelScheduledValues(now);
      g.setValueAtTime(level, now);
      g.setTargetAtTime(0, now, v.tauRel);
      const end = now + v.tauRel * 9;
      v.oscs.forEach((o) => { try { o.stop(end); } catch (err) { /* noop */ } });
    }

    function flushPending() {
      if (!pending.length || !ctx || ctx.state !== 'running') return;
      const list = pending.splice(0);
      list.forEach((p) => {
        startVoice(p.midi, p.vel);
        // Toque rápido que terminou antes do contexto acordar: ainda soa curto.
        if (!isHeld(p.midi) && !pedalDown) setTimeout(() => releaseVoice(p.midi), 140);
      });
    }

    function noteOn(midi, vel) {
      unlock();
      if (!ctx) return;
      if (ctx.state !== 'running') {
        if (pending.length < 16) pending.push({ midi, vel });
        return;
      }
      startVoice(midi, vel);
    }

    function noteOff(midi) {
      if (!ctx) return;
      const i = pending.findIndex((p) => p.midi === midi);
      if (i !== -1) return; // será solta em flushPending
      releaseVoice(midi);
    }

    function isRinging(midi) {
      const v = noteVoice.get(midi);
      return !!v && !v.dead;
    }

    function setVolume(v) {
      if (master) master.gain.setTargetAtTime(volumeGain(v), ctx.currentTime, 0.03);
    }

    function setReverb(r, pedal) {
      if (!revSend) return;
      // Pedal levantado = todas as cordas livres para ressoar.
      const target = r * 0.55 * (pedal ? 1.45 : 1);
      revSend.gain.setTargetAtTime(target, ctx.currentTime, pedal ? 0.08 : 0.35);
    }

    function allOff(hard) {
      pending.length = 0;
      if (!ctx) return;
      for (const midi of Array.from(noteVoice.keys())) {
        if (hard) {
          const v = noteVoice.get(midi);
          killVoice(v, false);
        } else {
          releaseVoice(midi);
        }
      }
    }

    function suspend() {
      if (ctx && ctx.state === 'running') ctx.suspend().then(onState, onState);
    }

    return {
      unlock,
      state,
      noteOn,
      noteOff,
      isRinging,
      setVolume,
      setReverb,
      allOff,
      suspend,
      onStateChange: (fn) => { onState = fn; }
    };
  })();

  // ==========================================================================
  // NOTAS, HOLDERS E PEDAL
  // ==========================================================================

  function isHeld(midi) {
    const set = holders.get(midi);
    return !!set && set.size > 0;
  }

  function paintKey(midi) {
    const el = keyEls.get(midi);
    if (!el) return;
    const held = isHeld(midi);
    el.classList.toggle('active', held);
    el.classList.toggle('ringing', !held && pedalDown && Engine.isRinging(midi));
  }

  function noteOn(midi, velocity, source) {
    if (midi < 21 || midi > 108) return;
    let set = holders.get(midi);
    if (!set) { set = new Set(); holders.set(midi, set); }
    set.add(source);
    Engine.noteOn(midi, velocity);
    const el = keyEls.get(midi);
    if (el) {
      el.style.setProperty('--key-velocity', velocity.toFixed(3));
      el.classList.remove('key-strike');
      void el.offsetWidth; // reinicia o brilho do impacto
      el.classList.add('key-strike');
    }
    paintKey(midi);
    hideHintSoon();
  }

  function noteOff(midi, source) {
    const set = holders.get(midi);
    if (!set || !set.delete(source)) return;
    if (set.size === 0 && !pedalDown) Engine.noteOff(midi);
    paintKey(midi);
  }

  function releaseSources(prefix) {
    holders.forEach((set, midi) => {
      let changed = false;
      set.forEach((src) => {
        if (src.startsWith(prefix)) { set.delete(src); changed = true; }
      });
      if (changed) {
        if (set.size === 0 && !pedalDown) Engine.noteOff(midi);
        paintKey(midi);
      }
    });
  }

  function setPedal(down) {
    const next = pedalLocked ? true : !!down;
    if (next === pedalDown) return;
    pedalDown = next;
    Engine.setReverb(settings.reverb, pedalDown);
    ui.sustainBtn.classList.toggle('active', pedalDown);
    ui.sustainBtn.setAttribute('aria-pressed', String(pedalDown));
    ui.piano.classList.toggle('pedal-down', pedalDown);
    if (!pedalDown) {
      // Pedal sobe: abafa tudo que não está sendo segurado por um dedo/tecla.
      keyEls.forEach((el, midi) => {
        if (!isHeld(midi)) Engine.noteOff(midi);
        paintKey(midi);
      });
      // Notas fora do teclado visual (MIDI) também.
      for (let m = 21; m <= 108; m++) {
        if (!keyEls.has(m) && !isHeld(m)) Engine.noteOff(m);
      }
    }
  }

  // ==========================================================================
  // UI
  // ==========================================================================

  const ui = {};

  function buildKeyboard() {
    const piano = ui.piano;
    piano.textContent = '';
    let whiteIndex = 0;
    for (let midi = FIRST_MIDI; midi <= LAST_MIDI; midi++) {
      const pc = midi % 12;
      const isBlack = BLACK_PCS.has(pc);
      const key = document.createElement('div');
      key.className = `key ${isBlack ? 'black' : 'white'}`;
      key.dataset.midi = String(midi);
      key.setAttribute('aria-hidden', 'true');

      const shortcut = document.createElement('span');
      shortcut.className = 'key-shortcut';
      key.appendChild(shortcut);

      if (!isBlack) {
        const label = document.createElement('span');
        label.className = 'key-note';
        label.textContent = pc === 0 ? midiName(midi) : NOTE_NAMES[pc];
        if (pc === 0) key.classList.add('is-c');
        if (midi === 60) key.classList.add('is-middle-c');
        key.appendChild(label);
        key.style.setProperty('--i', String(whiteIndex));
        whiteIndex++;
      } else {
        key.style.setProperty('--i', String(whiteIndex));
        key.style.setProperty('--off', String(BLACK_OFFSET[pc]));
      }
      keyEls.set(midi, key);
      piano.appendChild(key);
    }
    piano.style.setProperty('--whites', String(whiteIndex));
    buildMinimap(whiteIndex);
  }

  function buildMinimap(whites) {
    const map = ui.map;
    if (!map) return;
    const keys = document.createElement('div');
    keys.className = 'map-keys';
    let w = 0;
    for (let midi = FIRST_MIDI; midi <= LAST_MIDI; midi++) {
      const pc = midi % 12;
      const k = document.createElement('span');
      if (BLACK_PCS.has(pc)) {
        k.className = 'map-black';
        k.style.left = `calc(${(w / whites) * 100}% - 1.6%)`;
      } else {
        k.className = 'map-white';
        w++;
      }
      keys.appendChild(k);
    }
    map.insertBefore(keys, ui.mapWindow);
  }

  // Rótulos das teclas do computador só nas teclas mapeadas pela oitava atual.
  function refreshShortcutLabels() {
    const base = (settings.kbOctave + 1) * 12;
    const byMidi = new Map();
    Object.entries(KEY_CODES).forEach(([code, semi]) => {
      const midi = base + semi;
      if (byMidi.has(midi)) return;
      const label = CODE_LABEL[code] || code.replace(/^Key|^Digit/, '');
      byMidi.set(midi, label);
    });
    keyEls.forEach((el, midi) => {
      const span = el.querySelector('.key-shortcut');
      const label = byMidi.get(midi) || '';
      span.textContent = label;
      el.classList.toggle('mapped', !!label);
    });
    const lo = midiName(base);
    const hi = midiName(base + 31);
    ui.octaveDisplay.textContent = `${lo}–${hi}`;
    ui.octaveDisplay.setAttribute('aria-label', `Teclado do computador de ${lo} a ${hi}`);
  }

  function changeOctave(delta) {
    const next = clamp(settings.kbOctave + delta, KB_OCT_MIN, KB_OCT_MAX);
    if (next === settings.kbOctave) {
      ui.octaveDisplay.classList.remove('nudge');
      void ui.octaveDisplay.offsetWidth;
      ui.octaveDisplay.classList.add('nudge');
      return;
    }
    releaseSources('k:'); // evita nota presa ao trocar a oitava com tecla segurada
    settings.kbOctave = next;
    refreshShortcutLabels();
    scrollToMidi((next + 1) * 12, true);
    saveSettings();
  }

  function setDynamic(index) {
    settings.dynamic = clamp(index, 0, DYNAMICS.length - 1);
    ui.dynamic.value = String(settings.dynamic);
    ui.dynamicOut.textContent = DYNAMICS[settings.dynamic].label;
    ui.dynamic.setAttribute('aria-valuetext', DYNAMICS[settings.dynamic].label);
    saveSettings();
  }

  // ----- Rolagem do teclado (celular) e minimapa -----

  function keyLeft(midi) {
    const el = keyEls.get(midi);
    return el ? el.offsetLeft : 0;
  }

  function scrollToMidi(midi, smooth) {
    const wrap = ui.wrapper;
    if (wrap.scrollWidth <= wrap.clientWidth + 2) return;
    const target = keyLeft(midi) - 12;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    wrap.scrollTo({ left: target, behavior: smooth && !reduce ? 'smooth' : 'auto' });
  }

  function updateMapWindow() {
    const wrap = ui.wrapper;
    const total = wrap.scrollWidth;
    const fits = total <= wrap.clientWidth + 2;
    ui.map.hidden = fits;
    if (fits) return;
    ui.mapWindow.style.left = `${(wrap.scrollLeft / total) * 100}%`;
    ui.mapWindow.style.width = `${(wrap.clientWidth / total) * 100}%`;
    const max = Math.max(1, total - wrap.clientWidth);
    ui.map.setAttribute('aria-valuenow', String(Math.round((wrap.scrollLeft / max) * 100)));
  }

  function bindMinimap() {
    const map = ui.map;
    let dragging = null;
    const moveTo = (clientX) => {
      const rect = map.getBoundingClientRect();
      const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
      const wrap = ui.wrapper;
      wrap.scrollLeft = ratio * wrap.scrollWidth - wrap.clientWidth / 2;
    };
    map.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      dragging = e.pointerId;
      try { map.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
      moveTo(e.clientX);
    });
    map.addEventListener('pointermove', (e) => { if (dragging === e.pointerId) moveTo(e.clientX); });
    const end = (e) => { if (dragging === e.pointerId) dragging = null; };
    map.addEventListener('pointerup', end);
    map.addEventListener('pointercancel', end);
    map.addEventListener('keydown', (e) => {
      const wrap = ui.wrapper;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        wrap.scrollBy({ left: (e.key === 'ArrowLeft' ? -1 : 1) * wrap.clientWidth * 0.5, behavior: 'smooth' });
      }
    });
    ui.wrapper.addEventListener('scroll', updateMapWindow, { passive: true });
  }

  // Ajusta a largura da tecla: no desktop as 29 brancas cabem; no celular a
  // tecla fica com ~44 px (dedo) e o teclado rola pelo minimapa.
  function layout() {
    const wrap = ui.wrapper;
    const whites = Number(ui.piano.style.getPropertyValue('--whites')) || 29;
    const avail = wrap.clientWidth - 28;
    const fit = avail / whites;
    const wk = fit >= 30 ? Math.min(54, fit) : coarse ? 46 : 40;
    ui.piano.style.setProperty('--wk', `${wk.toFixed(2)}px`);
    requestAnimationFrame(updateMapWindow);
  }

  // ----- Ponteiro: multitoque + glissando -----

  function velocityFromPointer(e, keyEl) {
    // Caneta com pressão real usa a pressão; dedo/mouse usam a posição na
    // tecla (perto da borda frontal = mais forte), como no GarageBand.
    if (e.pointerType === 'pen' && e.pressure > 0) return clamp(0.2 + e.pressure * 0.8, 0.2, 1);
    const rect = keyEl.getBoundingClientRect();
    const rel = clamp((e.clientY - rect.top) / (rect.height || 1), 0, 1);
    const base = DYNAMICS[settings.dynamic].v;
    return clamp(base * (0.55 + rel * 0.6), 0.12, 1);
  }

  function bindPointer() {
    const piano = ui.piano;
    const pointerNote = new Map();
    // passive:false — sem isso o Safari iOS ignora preventDefault e o scroll
    // come o toque; setPointerCapture em touch quebra acordes multitoque.
    const opts = { passive: false };

    const keyAt = (x, y) => {
      const el = document.elementFromPoint(x, y);
      const key = el && el.closest ? el.closest('.key') : null;
      return key && piano.contains(key) ? key : null;
    };

    const update = (e) => {
      const key = keyAt(e.clientX, e.clientY);
      const next = key ? Number(key.dataset.midi) : null;
      const prev = pointerNote.has(e.pointerId) ? pointerNote.get(e.pointerId) : null;
      if (next === prev) return;
      const src = `p:${e.pointerId}`;
      if (prev != null) noteOff(prev, src);
      if (next != null) {
        pointerNote.set(e.pointerId, next);
        noteOn(next, velocityFromPointer(e, key), src);
      } else {
        pointerNote.delete(e.pointerId);
      }
    };

    const release = (e) => {
      if (!pointerNote.has(e.pointerId)) return;
      const prev = pointerNote.get(e.pointerId);
      pointerNote.delete(e.pointerId);
      if (prev != null) noteOff(prev, `p:${e.pointerId}`);
    };

    piano.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      // Capture só mouse/caneta — no iOS o capture do 1º dedo engole os demais.
      if (e.pointerType !== 'touch') {
        try { piano.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
      }
      update(e);
    }, opts);
    // Move/up no window: dedos sem capture continuam rastreáveis fora da tecla.
    window.addEventListener('pointermove', (e) => {
      if (pointerNote.has(e.pointerId) || piano.hasPointerCapture(e.pointerId)) update(e);
    }, opts);
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    piano.addEventListener('lostpointercapture', release);
    piano.addEventListener('contextmenu', (e) => e.preventDefault());
    // Cinto: bloqueia scroll/zoom nativo mesmo se o Pointer Event falhar.
    piano.addEventListener('touchstart', (e) => { e.preventDefault(); }, opts);
    piano.addEventListener('touchmove', (e) => { e.preventDefault(); }, opts);

    ui.releaseAllPointers = () => {
      pointerNote.clear();
      releaseSources('p:');
    };
  }

  // ----- Teclado do computador -----

  function isTypingTarget(t) {
    return t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName));
  }

  function bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.code === 'Space') {
        if (isTypingTarget(e.target) && e.target.type !== 'range') return;
        e.preventDefault();
        if (!e.repeat) { Engine.unlock(); setPedal(true); }
        return;
      }
      if (isTypingTarget(e.target)) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        if (!e.repeat) changeOctave(e.key === 'ArrowLeft' ? -1 : 1);
        return;
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        setDynamic(settings.dynamic + (e.key === 'ArrowUp' ? 1 : -1));
        return;
      }
      const semi = KEY_CODES[e.code];
      if (semi === undefined) return;
      e.preventDefault();
      if (e.repeat) return;
      const midi = (settings.kbOctave + 1) * 12 + semi;
      // Humanização leve: ±3% para o teclado não soar "carimbado".
      const vel = clamp(DYNAMICS[settings.dynamic].v + (Math.random() - 0.5) * 0.06, 0.1, 1);
      noteOn(midi, vel, `k:${e.code}`);
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        if (isTypingTarget(e.target) && e.target.type !== 'range') return;
        e.preventDefault();
        setPedal(false);
        return;
      }
      if (KEY_CODES[e.code] === undefined) return;
      releaseSources(`k:${e.code}`);
    });
  }

  // ----- Web MIDI (opcional, só depois de clicar) -----

  function bindMidi() {
    const btn = ui.midiBtn;
    if (!btn) return;
    if (!navigator.requestMIDIAccess) {
      btn.hidden = true;
      return;
    }
    const onMessage = (msg) => {
      const [status, d1, d2] = msg.data;
      const cmd = status & 0xf0;
      if (cmd === 0x90 && d2 > 0) noteOn(d1, Math.pow(d2 / 127, 0.9), 'm');
      else if (cmd === 0x80 || (cmd === 0x90 && d2 === 0)) noteOff(d1, 'm');
      else if (cmd === 0xb0 && d1 === 64) setPedal(d2 >= 64);
      else if (cmd === 0xb0 && (d1 === 123 || d1 === 120)) { releaseSources('m'); }
    };
    btn.addEventListener('click', () => {
      Engine.unlock();
      btn.disabled = true;
      navigator.requestMIDIAccess().then((access) => {
        const attach = () => {
          let count = 0;
          access.inputs.forEach((input) => { input.onmidimessage = onMessage; count++; });
          btn.classList.toggle('active', count > 0);
          btn.querySelector('span').textContent = count ? `MIDI · ${count}` : 'MIDI: nenhum';
          btn.disabled = false;
        };
        access.onstatechange = attach;
        attach();
      }).catch(() => {
        btn.querySelector('span').textContent = 'MIDI bloqueado';
        btn.disabled = false;
      });
    });
  }

  // ----- Controles -----

  function bindControls() {
    ui.volume.value = String(Math.round(settings.volume * 100));
    ui.volumeOut.textContent = `${ui.volume.value}%`;
    ui.volume.addEventListener('input', () => {
      settings.volume = Number(ui.volume.value) / 100;
      ui.volumeOut.textContent = `${ui.volume.value}%`;
      Engine.setVolume(settings.volume);
      saveSettings();
    });

    ui.reverb.value = String(Math.round(settings.reverb * 100));
    ui.reverbOut.textContent = `${ui.reverb.value}%`;
    ui.reverb.addEventListener('input', () => {
      settings.reverb = Number(ui.reverb.value) / 100;
      ui.reverbOut.textContent = `${ui.reverb.value}%`;
      Engine.setReverb(settings.reverb, pedalDown);
      saveSettings();
    });

    ui.dynamic.addEventListener('input', () => setDynamic(Number(ui.dynamic.value)));
    setDynamic(settings.dynamic);

    // Pedal momentâneo: segura enquanto o dedo/mouse está no botão.
    const pedalBtn = ui.sustainBtn;
    const pedalPointers = new Set();
    pedalBtn.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      Engine.unlock();
      pedalPointers.add(e.pointerId);
      try { pedalBtn.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
      setPedal(true);
    });
    const pedalUp = (e) => {
      if (!pedalPointers.delete(e.pointerId)) return;
      if (!pedalPointers.size) setPedal(false);
    };
    pedalBtn.addEventListener('pointerup', pedalUp);
    pedalBtn.addEventListener('pointercancel', pedalUp);
    pedalBtn.addEventListener('lostpointercapture', pedalUp);
    pedalBtn.addEventListener('contextmenu', (e) => e.preventDefault());
    pedalBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); if (!e.repeat) setPedal(true); }
    });
    pedalBtn.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); setPedal(false); }
    });

    ui.lockBtn.addEventListener('click', () => {
      Engine.unlock();
      pedalLocked = !pedalLocked;
      ui.lockBtn.classList.toggle('active', pedalLocked);
      ui.lockBtn.setAttribute('aria-pressed', String(pedalLocked));
      setPedal(pedalLocked);
    });

    ui.octDown.addEventListener('click', () => changeOctave(-1));
    ui.octUp.addEventListener('click', () => changeOctave(1));

    ui.status.addEventListener('click', () => {
      Engine.unlock();
      renderStatus();
    });
  }

  // ----- Status do áudio: nunca mudo sem explicação -----

  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let statusFlashTimer = 0;
  let lastState = 'idle';

  function renderStatus() {
    const st = Engine.state();
    const el = ui.status;
    const text = el.querySelector('.audio-status-text');
    const extra = el.querySelector('.audio-status-extra');
    el.dataset.state = st;
    extra.hidden = true;
    clearTimeout(statusFlashTimer);
    if (st === 'running') {
      if (lastState !== 'running') {
        text.textContent = 'Som ativo';
        el.hidden = false;
        statusFlashTimer = setTimeout(() => { el.hidden = true; }, 1400);
      } else {
        el.hidden = true;
      }
    } else if (st === 'unsupported') {
      el.hidden = false;
      text.textContent = 'Este navegador não tem Web Audio — o piano não pode tocar aqui.';
    } else {
      el.hidden = false;
      text.textContent = st === 'paused'
        ? 'Som pausado pelo sistema — toque aqui ou em uma tecla para retomar.'
        : 'Toque em uma tecla (ou aqui) para ligar o som.';
      if (isIOS) {
        // No iOS < 17 a chave de silencioso cala a Web Audio; audioSession resolve no 17+.
        extra.hidden = false;
        extra.textContent = 'iPhone/iPad: suba o volume; se continuar mudo, desligue o modo silencioso.';
      }
    }
    lastState = st;
  }

  let hintHidden = false;
  function hideHintSoon() {
    if (hintHidden) return;
    hintHidden = true;
    setTimeout(() => ui.hint && ui.hint.classList.add('is-quiet'), 2500);
  }

  // ----- Ciclo de vida: aba oculta, foco perdido -----

  function panic(keepPedalLock) {
    if (ui.releaseAllPointers) ui.releaseAllPointers();
    releaseSources('k:');
    if (!keepPedalLock) { pedalLocked = false; ui.lockBtn.classList.remove('active'); ui.lockBtn.setAttribute('aria-pressed', 'false'); }
    setPedal(false);
  }

  function bindLifecycle() {
    let hideTimer = 0;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        panic(true);
        Engine.allOff(false);
        // Economiza bateria: suspende o contexto depois da cauda.
        hideTimer = setTimeout(() => { if (document.hidden) Engine.suspend(); }, 1500);
      } else {
        clearTimeout(hideTimer);
        // Retoma sem gesto se o navegador permitir; senão o chip explica.
        if (Engine.state() === 'paused') Engine.unlock();
        renderStatus();
      }
    });
    window.addEventListener('blur', () => {
      // Teclas soltas fora da janela nunca chegam como keyup.
      releaseSources('k:');
      if (!pedalLocked) setPedal(false);
    });
    window.addEventListener('pagehide', () => Engine.allOff(true));
    // Qualquer gesto retoma o áudio se o sistema o suspendeu (ligação, Siri…).
    const wake = () => { if (Engine.state() !== 'running' && Engine.state() !== 'unsupported' && lastState !== 'idle') Engine.unlock(); };
    window.addEventListener('pointerdown', wake, true);
    window.addEventListener('keydown', wake, true);
  }

  // ==========================================================================
  // INICIALIZAÇÃO
  // ==========================================================================

  function init() {
    ui.piano = document.getElementById('piano');
    ui.wrapper = document.querySelector('.piano-wrapper');
    ui.map = document.getElementById('keyboard-map');
    ui.mapWindow = document.getElementById('keyboard-map-window');
    ui.sustainBtn = document.getElementById('sustain-btn');
    ui.lockBtn = document.getElementById('sustain-lock-btn');
    ui.volume = document.getElementById('volume');
    ui.volumeOut = document.getElementById('volume-value');
    ui.reverb = document.getElementById('reverb');
    ui.reverbOut = document.getElementById('reverb-value');
    ui.dynamic = document.getElementById('dynamic');
    ui.dynamicOut = document.getElementById('dynamic-value');
    ui.octDown = document.getElementById('octave-down');
    ui.octUp = document.getElementById('octave-up');
    ui.octaveDisplay = document.getElementById('octave-display');
    ui.status = document.getElementById('audio-status');
    ui.midiBtn = document.getElementById('midi-btn');
    ui.hint = document.querySelector('.instructions');
    if (!ui.piano || !ui.wrapper) return;

    buildKeyboard();
    refreshShortcutLabels();
    bindPointer();
    bindKeyboard();
    bindControls();
    bindMinimap();
    bindMidi();
    bindLifecycle();

    Engine.onStateChange(renderStatus);
    renderStatus();

    layout();
    if (window.LabRuntime) LabRuntime.debounceResize(layout, 100);
    else window.addEventListener('resize', layout);

    // Começa mostrando o Dó central (ou a oitava mapeada no teclado).
    requestAnimationFrame(() => {
      scrollToMidi(coarse ? 60 : (settings.kbOctave + 1) * 12, false);
      updateMapWindow();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
