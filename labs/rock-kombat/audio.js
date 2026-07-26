/**
 * Rock Kombat audio engine -- 2-operator FM voices (a stylised YM2612) plus a
 * PSG-style noise channel for drums, wired into a lookahead step sequencer
 * for the background music. Everything is synthesised; there are no sample
 * files. Exposes `RockKombatAudio` on window; script.js calls `sfx()` for one-
 * shots (keeping the old `sound(type, pitch)` shape it already had) and
 * `music.play(stage)` / `music.stop()` around the match lifecycle.
 */
window.RockKombatAudio = (() => {
  'use strict';

  let ctx = null;
  let muted = false;
  let masterGain = null;
  let sfxGain = null;
  let musicGain = null;
  let distortionCurve = null;
  let noiseBuffer = null;

  function makeDistortionCurve(amount = 50) {
    const k = amount;
    const n = 44100;
    const curve = new Float32Array(n);
    const deg = Math.PI / 180;
    for (let i = 0; i < n; ++i) {
      const x = (i * 2) / n - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  function init() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    distortionCurve = makeDistortionCurve(75);
    masterGain = ctx.createGain();
    masterGain.gain.value = muted ? 0 : 1;
    masterGain.connect(ctx.destination);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = 1;
    sfxGain.connect(masterGain);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.5;
    musicGain.connect(masterGain);
  }

  function setMuted(value) {
    muted = value;
    if (masterGain) masterGain.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.05);
    if (muted) stopMusic();
  }

  function getNoiseBuffer() {
    // Shared 2s noise buffer for every drum/crowd hit -- generating it once
    // instead of per-call avoids filling ~0.6s of samples every time the
    // crowd cheers (or every hi-hat tick once music is running).
    if (!noiseBuffer) {
      const len = ctx.sampleRate * 2;
      noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    return noiseBuffer;
  }

  /** Two-operator FM voice: a modulator whose output feeds the carrier's
   *  frequency, with the modulation index decaying over the note -- that
   *  decay is what gives FM percussion/bass its "punch" transient. */
  function fmVoice(destination, when, {
    freq, ratio = 2, modIndex = 200, modIndexDecay = 0.15,
    wave = 'sine', duration = 0.3, gain = 0.2, attack = 0.004, sustainTo = 0.001,
  }) {
    const carrier = ctx.createOscillator();
    carrier.type = wave;
    carrier.frequency.setValueAtTime(freq, when);

    const modulator = ctx.createOscillator();
    modulator.frequency.setValueAtTime(freq * ratio, when);
    const modGain = ctx.createGain();
    modGain.gain.setValueAtTime(modIndex, when);
    modGain.gain.exponentialRampToValueAtTime(Math.max(1, modIndex * 0.04), when + modIndexDecay);
    modulator.connect(modGain);
    modGain.connect(carrier.frequency);

    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, when);
    amp.gain.linearRampToValueAtTime(gain, when + attack);
    amp.gain.exponentialRampToValueAtTime(sustainTo, when + duration);
    carrier.connect(amp);
    amp.connect(destination);

    modulator.start(when);
    carrier.start(when);
    modulator.stop(when + duration + 0.05);
    carrier.stop(when + duration + 0.05);
    carrier.onended = () => { amp.disconnect(); modGain.disconnect(); };
  }

  /** PSG-style noise hit (snare/hat/crowd/whoosh), reusing one shared buffer. */
  function noiseHit(destination, when, {
    duration = 0.15, gain = 0.2, filterType = null, freq = 1500, freqEnd = null, Q = 1,
  }) {
    const src = ctx.createBufferSource();
    const buf = getNoiseBuffer();
    src.buffer = buf;
    src.loop = true;
    const offset = Math.random() * (buf.duration - duration - 0.02);

    let node = src;
    if (filterType) {
      const filter = ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.setValueAtTime(freq, when);
      if (freqEnd) filter.frequency.exponentialRampToValueAtTime(freqEnd, when + duration);
      filter.Q.value = Q;
      node.connect(filter);
      node = filter;
    }

    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + duration);
    node.connect(g);
    g.connect(destination);

    src.start(when, offset);
    src.stop(when + duration + 0.02);
  }

  /** Distorted power chord -- the original heavy-guitar patch, kept for
   *  specials and the K.O. sting, now parameterised on a start time. */
  function powerChord(destination, when, rootFreq, duration = 0.5, brightness = 2300, level = 0.15) {
    const freqs = [rootFreq, rootFreq * 1.498, rootFreq * 2.0];

    const shaper = ctx.createWaveShaper();
    shaper.curve = distortionCurve;
    shaper.oversample = '4x';

    const cabinet = ctx.createBiquadFilter();
    cabinet.type = 'lowpass';
    cabinet.frequency.value = brightness;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(level, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + duration);

    shaper.connect(cabinet);
    cabinet.connect(gain);
    gain.connect(destination);

    const oscillators = freqs.map((freq, idx) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq * (idx === 0 ? 1 : 1.002), when);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.98, when + duration);
      osc.connect(shaper);
      osc.start(when);
      osc.stop(when + duration + 0.05);
      return osc;
    });

    oscillators[oscillators.length - 1].onended = () => {
      gain.disconnect(); cabinet.disconnect(); shaper.disconnect();
    };
  }

  // --- ONE-SHOT SFX -----------------------------------------------------
  function sfx(type, pitch = 1) {
    if (muted) return;
    init();
    const now = ctx.currentTime;

    switch (type) {
      case 'special':
        powerChord(sfxGain, now, 146.83 * pitch, 0.9, 3600, 0.16);
        fmVoice(sfxGain, now, { freq: 220 * pitch, ratio: 3, modIndex: 700, modIndexDecay: 0.22, wave: 'square', duration: 0.55, gain: 0.16 });
        break;
      case 'hit':
        fmVoice(sfxGain, now, { freq: 95 * pitch, ratio: 1, modIndex: 320, modIndexDecay: 0.09, wave: 'sine', duration: 0.22, gain: 0.32 });
        noiseHit(sfxGain, now, { duration: 0.09, gain: 0.16, filterType: 'lowpass', freq: 1200, freqEnd: 300 });
        powerChord(sfxGain, now, 98 * pitch, 0.26, 2200, 0.1);
        break;
      case 'block':
        fmVoice(sfxGain, now, { freq: 540 * pitch, ratio: 7, modIndex: 950, modIndexDecay: 0.05, wave: 'square', duration: 0.13, gain: 0.2 });
        break;
      case 'crowd':
        noiseHit(sfxGain, now, { duration: 0.6, gain: 0.09, filterType: 'bandpass', freq: 850, freqEnd: 1700, Q: 3 });
        break;
      case 'announce':
        fmVoice(sfxGain, now, { freq: 440 * pitch, ratio: 2, modIndex: 260, modIndexDecay: 0.1, wave: 'triangle', duration: 0.2, gain: 0.15 });
        break;
      case 'ui':
      default:
        fmVoice(sfxGain, now, { freq: 300 * pitch, ratio: 2, modIndex: 180, modIndexDecay: 0.06, wave: 'triangle', duration: 0.14, gain: 0.13 });
        break;
    }
  }

  // --- MUSIC SEQUENCER (lookahead) ---------------------------------------
  // Classic "tale of two clocks" scheduler: a plain setInterval wakes up
  // often (25ms) and, each time, schedules every note that falls inside the
  // next 100ms onto the *audio* clock (ctx.currentTime), which is sample-
  // accurate. That keeps the beat rock-solid even if the setInterval itself
  // jitters under page load or a background tab throttle.
  const SCHEDULE_AHEAD = 0.1;
  const LOOKAHEAD_MS = 25;

  // Each pattern is 16 sixteenth-note steps. `bass`/`lead` entries are note
  // frequencies (0 = rest); `drum` entries are 'k' kick, 's' snare, 'h' hat.
  const PATTERNS = {
    stadium: {
      bpm: 132,
      bass: [110, 0, 110, 0, 138.59, 0, 110, 0, 146.83, 0, 146.83, 0, 130.81, 0, 116.54, 0],
      lead: [0, 0, 440, 0, 0, 0, 523.25, 0, 0, 0, 466.16, 0, 0, 0, 415.30, 0],
      drum: ['k', 'h', 's', 'h', 'k', 'h', 's', 'h', 'k', 'h', 's', 'h', 'k', 'k', 's', 'h'],
      leadRatio: 2, leadWave: 'square',
    },
    club: {
      bpm: 152,
      bass: [82.41, 82.41, 0, 82.41, 92.50, 0, 82.41, 0, 73.42, 73.42, 0, 73.42, 82.41, 0, 69.30, 0],
      lead: [0, 329.63, 0, 0, 392.00, 0, 0, 349.23, 0, 293.66, 0, 0, 329.63, 0, 0, 0],
      drum: ['k', 'h', 's', 'h', 'k', 'k', 's', 'h', 'k', 'h', 's', 'h', 'k', 'h', 's', 's'],
      leadRatio: 3, leadWave: 'sawtooth',
    },
    woodstock: {
      bpm: 108,
      bass: [98, 0, 0, 98, 0, 116.54, 0, 0, 87.31, 0, 0, 87.31, 0, 103.83, 0, 0],
      lead: [0, 0, 293.66, 0, 0, 349.23, 0, 0, 261.63, 0, 0, 0, 329.63, 0, 293.66, 0],
      drum: ['k', '', 'h', '', 's', '', 'h', '', 'k', '', 'h', 's', '', '', 'h', ''],
      leadRatio: 1.5, leadWave: 'triangle',
    },
  };

  let musicTimerId = null;
  let musicStage = null;
  let musicSection = 'A'; // alternates A/B every 2 bars so the loop doesn't feel static
  let stepIndex = 0;
  let barsPlayed = 0;
  let nextNoteTime = 0;

  function scheduleStep(pattern, when, sectionShift) {
    const step = stepIndex % 16;
    const bass = pattern.bass[step];
    if (bass) {
      // Section B transposes the bass line up a fourth for contrast.
      const freq = bass * (sectionShift ? 1.333 : 1);
      fmVoice(musicGain, when, { freq, ratio: 1, modIndex: 180, modIndexDecay: 0.12, wave: 'sine', duration: 0.16, gain: 0.22 });
    }
    const lead = pattern.lead[step];
    if (lead && (barsPlayed % 2 === 1)) {
      // The lead line only plays every other bar, call-and-response style.
      const freq = lead * (sectionShift ? 1.333 : 1);
      fmVoice(musicGain, when, { freq, ratio: pattern.leadRatio, modIndex: 90, modIndexDecay: 0.08, wave: pattern.leadWave, duration: 0.12, gain: 0.09 });
    }
    const drum = pattern.drum[step];
    if (drum === 'k') fmVoice(musicGain, when, { freq: 150, ratio: 0.5, modIndex: 400, modIndexDecay: 0.05, wave: 'sine', duration: 0.22, gain: 0.4, sustainTo: 0.001 });
    else if (drum === 's') noiseHit(musicGain, when, { duration: 0.12, gain: 0.22, filterType: 'bandpass', freq: 1800, Q: 0.8 });
    else if (drum === 'h') noiseHit(musicGain, when, { duration: 0.035, gain: 0.1, filterType: 'highpass', freq: 6000, Q: 0.6 });
  }

  function musicScheduler() {
    if (!ctx || !musicStage) return;
    const pattern = PATTERNS[musicStage] || PATTERNS.stadium;
    const stepDuration = 60 / pattern.bpm / 4; // sixteenth notes
    while (nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD) {
      scheduleStep(pattern, nextNoteTime, musicSection === 'B');
      nextNoteTime += stepDuration;
      stepIndex++;
      if (stepIndex % 16 === 0) {
        barsPlayed++;
        if (barsPlayed % 2 === 0) musicSection = musicSection === 'A' ? 'B' : 'A';
      }
    }
  }

  function playMusic(stage) {
    if (muted) return;
    init();
    if (musicStage === stage && musicTimerId) return;
    stopMusic();
    musicStage = stage;
    stepIndex = 0;
    barsPlayed = 0;
    musicSection = 'A';
    nextNoteTime = ctx.currentTime + 0.05;
    musicTimerId = setInterval(musicScheduler, LOOKAHEAD_MS);
  }

  function stopMusic() {
    if (musicTimerId) { clearInterval(musicTimerId); musicTimerId = null; }
    musicStage = null;
  }

  function jingle(name) {
    if (muted) return;
    init();
    const now = ctx.currentTime;
    if (name === 'victory') {
      [0, 0.16, 0.32, 0.56].forEach((t, i) => {
        const notes = [523.25, 659.25, 783.99, 1046.5];
        fmVoice(sfxGain, now + t, { freq: notes[i], ratio: 2, modIndex: 200, modIndexDecay: 0.1, wave: 'square', duration: 0.35, gain: 0.14 });
      });
      powerChord(sfxGain, now + 0.56, 130.81, 0.9, 3000, 0.14);
    }
  }

  return { init, sfx, setMuted, music: { play: playMusic, stop: stopMusic }, jingle };
})();
