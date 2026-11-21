// ==========================================================================
// Rock Kombat — Audio & Arcade Synthesizer
// Pre-baked noise buffers (zero GC allocation during gameplay), power-chord
// distortion synth, MvC Hyper sirens, and MK bass impacts.
// ==========================================================================

let context = null;
let master = null;
let noiseBuffer = null;

function readStored(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

let muted = readStored('rk-muted') === '1';
let musicTimer = null;
let musicStep = 0;

function ensure() {
  if (!context) {
    const AudioCtx = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioCtx) return null;
    context = new AudioCtx();
    master = context.createGain();
    master.gain.value = muted ? 0 : 0.68;
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -13;
    limiter.knee.value = 14;
    limiter.ratio.value = 4;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.13;
    master.connect(limiter);
    limiter.connect(context.destination);

    // Pre-generate 1.2s white noise buffer once to avoid per-hit GC allocations
    const length = Math.ceil(context.sampleRate * 1.2);
    noiseBuffer = context.createBuffer(1, length, context.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }
  if (context.state === 'suspended') context.resume().catch(() => {});
  return context;
}

function gainAt(value, start, duration) {
  const gain = context.createGain();
  gain.gain.setValueAtTime(Math.max(0.0001, value), start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  gain.connect(master);
  return gain;
}

function tone(freq, duration, volume, type = 'sine', when = 0, bend = 1) {
  if (!ensure()) return;
  const start = context.currentTime + when;
  const osc = context.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  osc.frequency.exponentialRampToValueAtTime(Math.max(24, freq * bend), start + duration);
  osc.connect(gainAt(volume, start, duration));
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

function powerChord(root, duration, volume, when = 0) {
  tone(root, duration, volume, 'sawtooth', when, 0.99);
  tone(root * 1.498, duration, volume * 0.75, 'sawtooth', when, 0.99); // Fifth
  tone(root * 2, duration * 0.85, volume * 0.45, 'square', when, 0.98); // Octave
}

function noise(duration, volume, when = 0, highpass = 160, lowpass = 9000) {
  if (!ensure() || !noiseBuffer) return;
  const start = context.currentTime + when;
  const source = context.createBufferSource();
  source.buffer = noiseBuffer;

  const hp = context.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = highpass;

  const lp = context.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = lowpass;

  source.connect(hp);
  hp.connect(lp);
  lp.connect(gainAt(volume, start, duration));
  source.start(start, 0, Math.min(duration, 1.15));
}

function sfx(name, strength = 1) {
  if (muted) return;
  if (!ensure()) return;
  const s = Math.max(0.5, Math.min(1.65, strength));

  switch (name) {
    case 'ui':
      tone(520, 0.06, 0.08, 'square', 0, 1.35);
      tone(880, 0.07, 0.06, 'triangle', 0.035, 1.1);
      break;
    case 'whiff':
      noise(0.07, 0.06 * s, 0, 950, 4800);
      tone(210, 0.07, 0.04 * s, 'triangle', 0, 0.52);
      break;
    case 'light':
      noise(0.08, 0.14 * s, 0, 260, 6200);
      tone(165, 0.1, 0.16 * s, 'triangle', 0, 0.45);
      break;
    case 'medium':
      noise(0.11, 0.18 * s, 0, 160, 5400);
      tone(130, 0.14, 0.2 * s, 'sawtooth', 0, 0.42);
      tone(75, 0.15, 0.14 * s, 'sine', 0.01, 0.65);
      break;
    case 'heavy':
      noise(0.16, 0.24 * s, 0, 80, 4200);
      tone(98, 0.2, 0.25 * s, 'sawtooth', 0, 0.35);
      tone(54, 0.22, 0.2 * s, 'sine', 0.01, 0.6);
      break;
    case 'launch':
      noise(0.18, 0.22, 0, 120, 6000);
      tone(110, 0.26, 0.24, 'sawtooth', 0, 2.8);
      tone(220, 0.22, 0.14, 'square', 0.04, 2.2);
      break;
    case 'wallbounce':
      noise(0.22, 0.26, 0, 60, 3200);
      tone(68, 0.28, 0.28, 'sine', 0, 0.4);
      tone(140, 0.18, 0.18, 'sawtooth', 0.02, 0.5);
      break;
    case 'block':
      noise(0.09, 0.11, 0, 1400, 8000);
      tone(640, 0.1, 0.09, 'square', 0, 0.72);
      break;
    case 'pushblock':
      noise(0.16, 0.18, 0, 500, 6500);
      tone(320, 0.18, 0.16, 'sawtooth', 0, 1.9);
      tone(820, 0.14, 0.1, 'triangle', 0.03, 1.4);
      break;
    case 'parry':
      tone(980, 0.16, 0.15, 'sine', 0, 1.5);
      tone(1480, 0.22, 0.12, 'triangle', 0.025, 1.25);
      noise(0.08, 0.08, 0, 2500, 9500);
      break;
    case 'special':
      powerChord(110, 0.32, 0.15, 0);
      tone(90, 0.36, 0.2, 'sawtooth', 0, 3.6);
      noise(0.24, 0.14, 0.04, 420, 6500);
      break;
    case 'hyper':
      // MvC Hyper Combo activation siren + sub-bass drop
      tone(55, 0.65, 0.32, 'sine', 0, 0.45);
      tone(220, 0.45, 0.22, 'sawtooth', 0, 3.8);
      tone(440, 0.5, 0.18, 'square', 0.08, 2.6);
      powerChord(146.8, 0.55, 0.18, 0.12);
      noise(0.5, 0.22, 0.05, 140, 7500);
      break;
    case 'dash':
      noise(0.11, 0.09, 0, 480, 5500);
      tone(240, 0.09, 0.06, 'sawtooth', 0, 1.85);
      break;
    case 'superjump':
      noise(0.16, 0.11, 0, 380, 6800);
      tone(180, 0.22, 0.12, 'triangle', 0, 2.9);
      break;
    case 'throw':
      noise(0.16, 0.18, 0, 80, 3600);
      tone(115, 0.2, 0.2, 'triangle', 0, 0.42);
      tone(68, 0.24, 0.16, 'sawtooth', 0.03, 0.52);
      break;
    case 'finish':
      // Mortal Kombat FINISH HIM deep gong
      tone(65, 0.85, 0.32, 'sawtooth', 0, 0.65);
      tone(98, 0.75, 0.22, 'triangle', 0.02, 0.62);
      noise(0.6, 0.2, 0, 80, 2400);
      break;
    case 'ko':
      tone(140, 0.42, 0.24, 'sawtooth', 0, 0.34);
      tone(78, 0.62, 0.28, 'sine', 0.12, 0.35);
      noise(0.45, 0.2, 0.05, 60, 2800);
      break;
    case 'round':
      powerChord(164.8, 0.14, 0.09, 0);
      powerChord(220, 0.14, 0.1, 0.13);
      powerChord(329.6, 0.26, 0.13, 0.26);
      break;
    case 'win':
      [220, 277.2, 329.6, 440].forEach((f, i) => {
        powerChord(f, 0.35, 0.09, i * 0.11);
      });
      break;
  }
}

const stageTracks = {
  seattle: {
    tempo: 165,
    bass: [55, 55, 82.4, 55, 73.4, 82.4, 65.4, 73.4],
    lead: [220, 0, 329.6, 293.7, 261.6, 0, 329.6, 392]
  },
  coliseum: {
    tempo: 145,
    bass: [65.4, 65.4, 98, 65.4, 110, 98, 87.3, 98],
    lead: [261.6, 329.6, 392, 0, 440, 392, 329.6, 293.7]
  },
  cellar: {
    tempo: 175,
    bass: [73.4, 73.4, 110, 87.3, 73.4, 98, 110, 130.8],
    lead: [293.7, 0, 349.2, 440, 0, 392, 349.2, 329.6]
  }
};

function startMusic(stage) {
  stopMusic();
  if (muted || !ensure()) return;
  musicStep = 0;
  const track = stageTracks[stage] || stageTracks.seattle;
  const tick = () => {
    if (!muted && context) {
      const idx = musicStep % track.bass.length;
      const b = track.bass[idx];
      tone(b, 0.18, 0.042, 'sawtooth', 0, 0.95);
      tone(b * 1.5, 0.14, 0.024, 'square', 0, 0.96);

      if (idx === 0 || idx === 4 || (idx === 7 && musicStep % 16 >= 8)) {
        powerChord(b * 2, 0.13, 0.026, 0.012);
      }
      const l = track.lead[idx];
      if (l > 0 && musicStep % 16 >= 8) {
        tone(l, 0.14, 0.022, 'triangle', 0, 1.01);
      }
      if (musicStep % 2 === 0) {
        // Kick + hi-hat
        tone(52, 0.08, 0.055, 'sine', 0, 0.55);
        noise(0.03, 0.02, 0, 3200, 9000);
      } else if (musicStep % 4 === 3) {
        // Snare
        noise(0.065, 0.036, 0, 700, 5800);
      }
    }
    musicStep++;
  };
  tick();
  musicTimer = setInterval(tick, track.tempo);
}

function stopMusic() {
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null;
}

function setMuted(value) {
  muted = value;
  try { localStorage.setItem('rk-muted', value ? '1' : '0'); } catch { /* ignore */ }
  if (value) stopMusic();
  if (master && context) master.gain.setTargetAtTime(value ? 0 : 0.68, context.currentTime, 0.02);
}

export default { ensure, sfx, startMusic, stopMusic, setMuted, get muted() { return muted; } };
