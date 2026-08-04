/* ==========================================================================
   Ravi 1·2·3 — áudio estilo PC speaker
   --------------------------------------------------------------------------
   Onda quadrada pura, um canal por vez na maior parte do tempo, envelope
   mínimo só para não estalar. É o som de um 486 tentando fazer música.
   ========================================================================== */

window.Sfx = (function () {
  'use strict';

  var ctx = null;
  var master = null;
  var muted = false;
  var scheduled = [];
  var loopTimer = null;

  /* Frequências temperadas — C3 até B5, que é toda a extensão que um
     alto-falante de PC de 1991 conseguia fingir com dignidade. */
  var NOTES = (function () {
    var names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    var table = { 'R': 0 };
    for (var oct = 2; oct <= 6; oct++) {
      for (var i = 0; i < 12; i++) {
        var midi = (oct + 1) * 12 + i;
        table[names[i] + oct] = 440 * Math.pow(2, (midi - 69) / 12);
      }
    }
    return table;
  })();

  function freqOf(note) {
    if (typeof note === 'number') return note;
    var f = NOTES[note];
    return f === undefined ? 0 : f;
  }

  function init() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.18;
    master.connect(ctx.destination);
    return ctx;
  }

  function ready() {
    return ctx && !muted;
  }

  /**
   * Um bipe. `wave` costuma ser 'square' (PC speaker) — 'triangle' entra
   * quando o som precisa soar mais macio, tipo passos ou água.
   */
  function tone(note, when, dur, opts) {
    if (!ready()) return;
    opts = opts || {};
    var f = freqOf(note);
    if (!f) return;

    var t0 = ctx.currentTime + when;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();

    osc.type = opts.wave || 'square';
    osc.frequency.setValueAtTime(f, t0);
    if (opts.slideTo) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqOf(opts.slideTo)), t0 + dur);
    }

    var vol = (opts.vol === undefined ? 1 : opts.vol);
    var attack = 0.004;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    gain.gain.setValueAtTime(vol, t0 + Math.max(attack, dur - 0.02));
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);

    scheduled.push(osc);
    osc.onended = function () {
      var i = scheduled.indexOf(osc);
      if (i >= 0) scheduled.splice(i, 1);
      try { gain.disconnect(); } catch (e) { }
    };
  }

  /** Ruído curto para explosões, sopro e confete. */
  function noise(when, dur, opts) {
    if (!ready()) return;
    opts = opts || {};
    var t0 = ctx.currentTime + when;
    var frames = Math.max(1, Math.floor(ctx.sampleRate * dur));
    var buf = ctx.createBuffer(1, frames, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < frames; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    }
    var src = ctx.createBufferSource();
    src.buffer = buf;

    var filter = ctx.createBiquadFilter();
    filter.type = opts.type || 'bandpass';
    filter.frequency.setValueAtTime(opts.freq || 900, t0);
    if (opts.sweepTo) filter.frequency.exponentialRampToValueAtTime(opts.sweepTo, t0 + dur);
    filter.Q.value = opts.q || 1;

    var gain = ctx.createGain();
    gain.gain.setValueAtTime(opts.vol === undefined ? 0.6 : opts.vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
    src.stop(t0 + dur);
  }

  /**
   * Toca uma sequência [nota, batidas] no andamento dado (BPM).
   * Devolve a duração total em segundos, útil para encadear animação.
   */
  function melody(seq, bpm, opts) {
    opts = opts || {};
    var beat = 60 / (bpm || 140);
    var t = opts.delay || 0;
    for (var i = 0; i < seq.length; i++) {
      var note = seq[i][0];
      var beats = seq[i][1];
      var dur = beats * beat;
      if (note !== 'R') {
        tone(note, t, dur * (opts.legato ? 0.98 : 0.82), {
          wave: opts.wave || 'square',
          vol: opts.vol === undefined ? 0.9 : opts.vol
        });
        if (opts.harmony) {
          tone(opts.harmony(note), t, dur * 0.8, { wave: 'triangle', vol: 0.35 });
        }
      }
      t += dur;
    }
    return t;
  }

  /* ------------------------------------------------------------- efeitos   */

  var FX = {
    click: function () { tone('C5', 0, 0.035, { vol: 0.5 }); },

    move: function () { tone('G4', 0, 0.03, { vol: 0.35, wave: 'triangle' }); },

    good: function () {
      melody([['C5', 1], ['E5', 1], ['G5', 2]], 460);
    },

    great: function () {
      melody([['C5', 1], ['E5', 1], ['G5', 1], ['C6', 3]], 440);
    },

    bad: function () {
      tone('E4', 0, 0.12, { vol: 0.7, slideTo: 'B3' });
      tone('B3', 0.13, 0.2, { vol: 0.7, slideTo: 'G3' });
    },

    coin: function () {
      melody([['B5', 1], ['E6', 3]], 520, { vol: 0.7 });
    },

    star: function () {
      melody([['E5', 1], ['G5', 1], ['B5', 1], ['E6', 2]], 620, { vol: 0.6 });
    },

    pop: function () {
      tone('C6', 0, 0.05, { vol: 0.6, slideTo: 'C5' });
    },

    pickup: function () {
      melody([['G4', 1], ['C5', 1]], 700, { vol: 0.55 });
    },

    drop: function () {
      tone('C4', 0, 0.08, { vol: 0.5, slideTo: 'G3', wave: 'triangle' });
    },

    engine: function () {
      tone('C3', 0, 0.5, { vol: 0.35, wave: 'sawtooth', slideTo: 'G3' });
      noise(0, 0.5, { freq: 260, sweepTo: 620, vol: 0.22 });
    },

    whoosh: function () {
      noise(0, 0.32, { freq: 380, sweepTo: 1900, vol: 0.3, type: 'bandpass', q: 0.7 });
    },

    blow: function () {
      noise(0, 0.55, { freq: 700, sweepTo: 220, vol: 0.4, type: 'lowpass', q: 0.4 });
    },

    doorbell: function () {
      melody([['E5', 2], ['C5', 3]], 240, { vol: 0.75, wave: 'triangle' });
    },

    machine: function () {
      tone('E3', 0, 0.18, { vol: 0.35, wave: 'sawtooth' });
      tone('E3', 0.2, 0.18, { vol: 0.3, wave: 'sawtooth' });
      noise(0.05, 0.3, { freq: 180, vol: 0.18, type: 'lowpass' });
    },

    fanfare: function () {
      melody([
        ['C5', 1], ['C5', 1], ['C5', 1], ['C5', 2],
        ['G4', 1], ['A4', 1], ['C5', 2], ['A4', 1], ['C5', 4]
      ], 300, { vol: 0.85 });
    },

    boot: function () {
      /* O bipe único do POST, o som mais nostálgico que existe. */
      tone('C6', 0, 0.14, { vol: 0.55 });
    },

    error: function () {
      tone('A3', 0, 0.28, { vol: 0.6 });
      tone('D#3', 0.02, 0.28, { vol: 0.4 });
    }
  };

  /* -------------------------------------------------- músicas mais longas  */

  /* "Parabéns pra Você" — a melodia de "Good Morning to All" (1893),
     em domínio público. Só as notas; nada de letra. */
  var HAPPY_BIRTHDAY = [
    ['G4', 0.75], ['G4', 0.25], ['A4', 1], ['G4', 1], ['C5', 1], ['B4', 2],
    ['G4', 0.75], ['G4', 0.25], ['A4', 1], ['G4', 1], ['D5', 1], ['C5', 2],
    ['G4', 0.75], ['G4', 0.25], ['G5', 1], ['E5', 1], ['C5', 1], ['B4', 1], ['A4', 2],
    ['F5', 0.75], ['F5', 0.25], ['E5', 1], ['C5', 1], ['D5', 1], ['C5', 2]
  ];

  /* Tema do menu: alegre, curto, feito pra dar loop sem cansar. */
  var TITLE_LOOP = [
    ['C5', 0.5], ['E5', 0.5], ['G5', 0.5], ['E5', 0.5],
    ['F5', 0.5], ['A5', 0.5], ['G5', 1],
    ['C5', 0.5], ['E5', 0.5], ['G5', 0.5], ['E5', 0.5],
    ['D5', 0.5], ['B4', 0.5], ['C5', 1],
    ['A4', 0.5], ['C5', 0.5], ['E5', 0.5], ['C5', 0.5],
    ['D5', 0.5], ['F5', 0.5], ['E5', 1],
    ['G4', 0.5], ['B4', 0.5], ['D5', 0.5], ['B4', 0.5],
    ['C5', 2]
  ];

  var PARTY_LOOP = [
    ['C5', 0.5], ['C5', 0.5], ['G5', 0.5], ['G5', 0.5],
    ['A5', 0.5], ['A5', 0.5], ['G5', 1],
    ['F5', 0.5], ['F5', 0.5], ['E5', 0.5], ['E5', 0.5],
    ['D5', 0.5], ['D5', 0.5], ['C5', 1]
  ];

  var SONGS = {
    birthday: { seq: HAPPY_BIRTHDAY, bpm: 170 },
    title: { seq: TITLE_LOOP, bpm: 168 },
    party: { seq: PARTY_LOOP, bpm: 176 }
  };

  function play(name) {
    if (!ready()) return 0;
    var fn = FX[name];
    if (!fn) return 0;
    fn();
    return 0;
  }

  function song(name, opts) {
    if (!ready()) return 0;
    var s = SONGS[name];
    if (!s) return 0;
    return melody(s.seq, s.bpm, opts || {});
  }

  /** Toca uma música em loop até stopLoop(). */
  function loop(name, opts) {
    stopLoop();
    if (!ready()) return;
    var s = SONGS[name];
    if (!s) return;
    var run = function () {
      if (!ready()) return;
      var dur = melody(s.seq, s.bpm, opts || { vol: 0.5 });
      loopTimer = setTimeout(run, dur * 1000);
    };
    run();
  }

  function stopLoop() {
    if (loopTimer) {
      clearTimeout(loopTimer);
      loopTimer = null;
    }
  }

  function stopAll() {
    stopLoop();
    scheduled.slice().forEach(function (osc) {
      try { osc.stop(); } catch (e) { }
    });
    scheduled.length = 0;
  }

  function setMuted(v) {
    muted = !!v;
    if (muted) stopAll();
    if (master) master.gain.value = muted ? 0 : 0.18;
    return muted;
  }

  function isMuted() { return muted; }

  return {
    init: init,
    play: play,
    tone: tone,
    noise: noise,
    melody: melody,
    song: song,
    loop: loop,
    stopLoop: stopLoop,
    stopAll: stopAll,
    setMuted: setMuted,
    isMuted: isMuted
  };
})();
