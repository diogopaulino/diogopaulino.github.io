// ============================================================================
// PIANO MINIMALISTA - SONS ULTRA REALISTAS
// ============================================================================

const audioContext = new (window.AudioContext || window.webkitAudioContext)();

// ============================================================================
// CONFIGURAÇÃO DAS NOTAS E FREQUÊNCIAS
// ============================================================================

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const OCTAVES = [2, 3, 4, 5];
const WHITE_KEYS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const BLACK_KEYS = ['C#', 'D#', 'F#', 'G#', 'A#'];

function getNoteFrequency(note, octave) {
  const A4 = 440;
  const noteIndex = NOTE_NAMES.indexOf(note);
  const semitonesFromA4 = (octave - 4) * 12 + (noteIndex - 9);
  return A4 * Math.pow(2, semitonesFromA4 / 12);
}

// ============================================================================
// MAPEAMENTO DE TECLADO OTIMIZADO
// ============================================================================

const KEYBOARD_MAP = {
  'z': 'C2', 's': 'C#2', 'x': 'D2', 'd': 'D#2', 'c': 'E2',
  'v': 'F2', 'g': 'F#2', 'b': 'G2', 'h': 'G#2', 'n': 'A2', 'j': 'A#2', 'm': 'B2',
  'q': 'C3', '2': 'C#3', 'w': 'D3', '3': 'D#3', 'e': 'E3',
  'r': 'F3', '5': 'F#3', 't': 'G3', '6': 'G#3', 'y': 'A3', '7': 'A#3', 'u': 'B3',
  'i': 'C4', '9': 'C#4', 'o': 'D4', '0': 'D#4', 'p': 'E4',
  '[': 'F4', '=': 'F#4', ']': 'G4',
  'a': 'C5', 'k': 'C#5', 'l': 'D5'
};

// ============================================================================
// ESTADO GLOBAL
// ============================================================================

let masterVolume = 0.7;
let sustainActive = false;
let octaveShift = 0;
const activeNotes = new Map();
const sustainedNotes = new Set();
const pressedKeys = new Set();
let compressor = null;

// ============================================================================
// SÍNTESE DE SOM ULTRA REALISTA
// ============================================================================

function initAudioChain() {
  if (!compressor) {
    compressor = audioContext.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-24, audioContext.currentTime);
    compressor.knee.setValueAtTime(30, audioContext.currentTime);
    compressor.ratio.setValueAtTime(12, audioContext.currentTime);
    compressor.attack.setValueAtTime(0.003, audioContext.currentTime);
    compressor.release.setValueAtTime(0.25, audioContext.currentTime);
    compressor.connect(audioContext.destination);
  }
}

class PianoVoice {
  constructor(frequency, velocity = 0.7) {
    this.frequency = frequency;
    this.velocity = Math.max(0.3, Math.min(1, velocity));
    this.nodes = [];
    this.isReleasing = false;

    initAudioChain();
    this.createVoice();
  }

  createVoice() {
    const now = audioContext.currentTime;

    // Múltiplos osciladores para som rico e complexo
    const oscillators = [];
    const gains = [];

    // Harmônicos baseados em piano acústico real
    const harmonics = [
      { mult: 1, type: 'triangle', level: 1.0 },      // Fundamental
      { mult: 2, type: 'sine', level: 0.5 },          // 2ª harmônica (oitava)
      { mult: 3, type: 'sine', level: 0.25 },         // 3ª harmônica (quinta + oitava)
      { mult: 4, type: 'sine', level: 0.15 },         // 4ª harmônica
      { mult: 5, type: 'sine', level: 0.08 },         // 5ª harmônica
      { mult: 6, type: 'sine', level: 0.05 },         // 6ª harmônica
      { mult: 7, type: 'sine', level: 0.03 },         // 7ª harmônica
      { mult: 0.5, type: 'sine', level: 0.1 }         // Sub-harmônica (corpo)
    ];

    harmonics.forEach(({ mult, type, level }) => {
      const osc = audioContext.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(this.frequency * mult, now);

      const gain = audioContext.createGain();
      const velocityFactor = 0.3 + (this.velocity * 0.7);
      gain.gain.setValueAtTime(level * velocityFactor, now);

      osc.connect(gain);
      oscillators.push(osc);
      gains.push(gain);
    });

    // Filtro passa-baixa dinâmico (simula abafador e ressonância)
    const filter = audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    const filterFreq = 800 + (this.frequency * 3) + (this.velocity * 2000);
    filter.frequency.setValueAtTime(filterFreq, now);
    filter.Q.setValueAtTime(2 + this.velocity, now);

    // Filtro passa-alta para clareza
    const highpass = audioContext.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(Math.max(20, this.frequency * 0.5), now);
    highpass.Q.setValueAtTime(0.5, now);

    // Envelope principal com curvas realistas
    const envelope = audioContext.createGain();
    envelope.gain.setValueAtTime(0, now);

    // Attack ultra-rápido (martelo batendo na corda)
    const attackTime = 0.001 + (1 - this.velocity) * 0.003;
    envelope.gain.linearRampToValueAtTime(this.velocity * 0.8, now + attackTime);

    // Decay inicial (primeira ressonância da corda)
    envelope.gain.exponentialRampToValueAtTime(
      this.velocity * 0.6,
      now + attackTime + 0.08
    );

    // Sustain suave (vibração contínua da corda)
    envelope.gain.exponentialRampToValueAtTime(
      this.velocity * 0.4,
      now + attackTime + 0.3
    );

    // Master gain
    const masterGain = audioContext.createGain();
    const volume = masterVolume * 0.25;
    masterGain.gain.setValueAtTime(volume, now);

    // Conexão do pipeline de áudio
    gains.forEach(gain => {
      gain.connect(highpass);
    });

    highpass.connect(filter);
    filter.connect(envelope);
    envelope.connect(masterGain);
    masterGain.connect(compressor);

    // Modulação sutil do filtro (simula vibração da corda)
    filter.frequency.exponentialRampToValueAtTime(
      500 + this.frequency * 1.5,
      now + 0.15
    );

    // LFO sutil para vibrato natural
    const lfo = audioContext.createOscillator();
    const lfoGain = audioContext.createGain();
    lfo.frequency.setValueAtTime(5, now);
    lfoGain.gain.setValueAtTime(this.velocity * 2, now);
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start(now);

    // Iniciar todos os osciladores
    oscillators.forEach(osc => osc.start(now));

    this.oscillators = oscillators;
    this.gains = gains;
    this.envelope = envelope;
    this.masterGain = masterGain;
    this.filter = filter;
    this.highpass = highpass;
    this.lfo = lfo;
    this.lfoGain = lfoGain;
    this.startTime = now;
  }

  release() {
    if (this.isReleasing) return;
    this.isReleasing = true;

    const now = audioContext.currentTime;

    // Release natural do piano (som continua ressoando)
    const releaseTime = sustainActive ? 2.5 : 0.8;

    this.envelope.gain.cancelScheduledValues(now);
    this.envelope.gain.setValueAtTime(this.envelope.gain.value, now);

    // Curva de release exponencial (natural)
    this.envelope.gain.exponentialRampToValueAtTime(0.001, now + releaseTime);

    // Filtro fecha gradualmente (simula abafador)
    this.filter.frequency.exponentialRampToValueAtTime(
      Math.max(100, this.frequency * 0.5),
      now + releaseTime * 0.3
    );

    // Parar tudo após release
    setTimeout(() => {
      this.oscillators.forEach(osc => {
        try { osc.stop(); } catch(e) {}
      });
      try { this.lfo.stop(); } catch(e) {}
    }, releaseTime * 1000 + 100);

    return releaseTime;
  }
}

// ============================================================================
// CONTROLE DE NOTAS COM SUSTAIN REAL
// ============================================================================

function playNote(noteName, velocity = 0.7) {
  if (activeNotes.has(noteName)) return;

  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }

  const [note, octaveStr] = [noteName.slice(0, -1), noteName.slice(-1)];
  const octave = parseInt(octaveStr) + octaveShift;

  if (octave < 0 || octave > 8) return;

  const frequency = getNoteFrequency(note, octave);
  const voice = new PianoVoice(frequency, velocity);

  activeNotes.set(noteName, voice);

  const keyElement = document.querySelector(`[data-note="${noteName}"]`);
  if (keyElement) {
    keyElement.classList.add('active');
  }
}

function stopNote(noteName, force = false) {
  // Comportamento igual piano real:
  // Se sustain está pressionado, nota continua tocando até soltar o pedal
  if (sustainActive && !force) {
    sustainedNotes.add(noteName);

    // Remove visual da tecla, mas mantém som
    const keyElement = document.querySelector(`[data-note="${noteName}"]`);
    if (keyElement) {
      keyElement.classList.remove('active');
    }
    return;
  }

  const voice = activeNotes.get(noteName);
  if (!voice) return;

  voice.release();

  // Remove após o release time
  setTimeout(() => {
    activeNotes.delete(noteName);
    sustainedNotes.delete(noteName);
  }, (sustainActive ? 2500 : 800) + 100);

  const keyElement = document.querySelector(`[data-note="${noteName}"]`);
  if (keyElement) {
    keyElement.classList.remove('active');
  }
}

function stopAllNotes() {
  const notes = Array.from(activeNotes.keys());
  notes.forEach(note => stopNote(note, true));
  sustainedNotes.clear();
}

// ============================================================================
// SUSTAIN PEDAL IGUAL PIANO REAL
// ============================================================================

function toggleSustain(active) {
  const wasActive = sustainActive;
  sustainActive = active;

  const sustainBtn = document.getElementById('sustain-btn');
  if (active) {
    sustainBtn.classList.add('active');
  } else {
    sustainBtn.classList.remove('active');

    // Quando solta pedal, libera TODAS notas sustentadas
    if (wasActive) {
      const notes = Array.from(sustainedNotes);
      notes.forEach(note => {
        if (activeNotes.has(note)) {
          stopNote(note, true);
        }
      });
      sustainedNotes.clear();
    }
  }
}

// ============================================================================
// CONTROLE DE OITAVAS
// ============================================================================

function changeOctave(delta) {
  octaveShift = Math.max(-2, Math.min(2, octaveShift + delta));
  document.getElementById('octave-display').textContent =
    `${octaveShift >= 0 ? '+' : ''}${octaveShift}`;
  stopAllNotes();
}

// ============================================================================
// GERAÇÃO DO TECLADO
// ============================================================================

function generatePiano() {
  const pianoElement = document.getElementById('piano');
  let whiteKeyIndex = 0;

  OCTAVES.forEach(octave => {
    NOTE_NAMES.forEach(noteName => {
      const fullNote = `${noteName}${octave}`;
      const isBlack = BLACK_KEYS.includes(noteName);

      const key = document.createElement('div');
      key.className = `key ${isBlack ? 'black' : 'white'}`;
      key.dataset.note = fullNote;

      const label = document.createElement('span');
      label.className = 'key-note';
      label.textContent = noteName;
      key.appendChild(label);

      if (isBlack) {
        const prevWhiteKey = whiteKeyIndex - 1;
        const keyWidth = 48;
        const blackKeyWidth = 32;
        key.style.left = `${prevWhiteKey * keyWidth + keyWidth - blackKeyWidth / 2}px`;
      } else {
        whiteKeyIndex++;
      }

      setupKeyEvents(key, fullNote);
      pianoElement.appendChild(key);
    });
  });
}

function setupKeyEvents(keyElement, noteName) {
  let touchId = null;

  // Mouse events
  keyElement.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const rect = keyElement.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const velocity = 0.5 + (y / rect.height) * 0.5;
    playNote(noteName, velocity);
  });

  keyElement.addEventListener('mouseup', () => {
    stopNote(noteName);
  });

  keyElement.addEventListener('mouseleave', () => {
    stopNote(noteName);
  });

  // Touch events otimizados para mobile
  keyElement.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (touchId !== null) return;

    const touch = e.changedTouches[0];
    touchId = touch.identifier;

    const rect = keyElement.getBoundingClientRect();
    const y = touch.clientY - rect.top;
    const velocity = 0.5 + (y / rect.height) * 0.5;
    playNote(noteName, velocity);
  }, { passive: false });

  keyElement.addEventListener('touchend', (e) => {
    e.preventDefault();
    const touch = Array.from(e.changedTouches).find(t => t.identifier === touchId);
    if (touch) {
      touchId = null;
      stopNote(noteName);
    }
  }, { passive: false });

  keyElement.addEventListener('touchcancel', (e) => {
    e.preventDefault();
    touchId = null;
    stopNote(noteName);
  }, { passive: false });
}

// ============================================================================
// CONTROLES
// ============================================================================

function setupControls() {
  const volumeSlider = document.getElementById('volume');
  const volumeValue = document.getElementById('volume-value');

  volumeSlider.addEventListener('input', (e) => {
    masterVolume = e.target.value / 100;
    volumeValue.textContent = `${e.target.value}%`;
  });

  const sustainBtn = document.getElementById('sustain-btn');
  sustainBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    toggleSustain(true);
  });

  sustainBtn.addEventListener('mouseup', (e) => {
    e.preventDefault();
    toggleSustain(false);
  });

  sustainBtn.addEventListener('mouseleave', (e) => {
    if (sustainActive) {
      toggleSustain(false);
    }
  });

  sustainBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    toggleSustain(true);
  }, { passive: false });

  sustainBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    toggleSustain(false);
  }, { passive: false });

  document.getElementById('octave-up').addEventListener('click', () => {
    changeOctave(1);
  });

  document.getElementById('octave-down').addEventListener('click', () => {
    changeOctave(-1);
  });
}

// ============================================================================
// EVENTOS DE TECLADO
// ============================================================================

function setupKeyboardEvents() {
  window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();

    if (key === ' ') {
      e.preventDefault();
      if (!pressedKeys.has(' ')) {
        toggleSustain(true);
        pressedKeys.add(' ');
      }
      return;
    }

    if (key === 'arrowleft') {
      e.preventDefault();
      changeOctave(-1);
      return;
    }

    if (key === 'arrowright') {
      e.preventDefault();
      changeOctave(1);
      return;
    }

    const noteName = KEYBOARD_MAP[key];
    if (noteName && !pressedKeys.has(key)) {
      e.preventDefault();
      pressedKeys.add(key);
      const velocity = 0.6 + Math.random() * 0.4;
      playNote(noteName, velocity);
    }
  });

  window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();

    if (key === ' ') {
      e.preventDefault();
      pressedKeys.delete(' ');
      toggleSustain(false);
      return;
    }

    const noteName = KEYBOARD_MAP[key];
    if (noteName) {
      e.preventDefault();
      pressedKeys.delete(key);
      stopNote(noteName);
    }
  });

  window.addEventListener('keydown', (e) => {
    if ([' ', 'ArrowLeft', 'ArrowRight'].includes(e.key) || KEYBOARD_MAP[e.key.toLowerCase()]) {
      e.preventDefault();
    }
  });
}

// ============================================================================
// INICIALIZAÇÃO
// ============================================================================

function init() {
  generatePiano();
  setupControls();
  setupKeyboardEvents();

  // Auto-scroll para meio do piano
  const wrapper = document.querySelector('.piano-wrapper');
  const piano = document.getElementById('piano');
  if (wrapper && piano) {
    setTimeout(() => {
      wrapper.scrollLeft = (piano.offsetWidth - wrapper.offsetWidth) / 2;
    }, 100);
  }

  console.log('🎹 Piano Ultra Realista');
  console.log('✨ 8 harmônicas por nota');
  console.log('🎚️ Velocity-sensitive');
  console.log('⬇️ Sustain como piano real');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
