/* ==========================================================================
   Ravi 1·2·3: A Grande Festa Surpresa - Áudio
   ========================================================================== */

(function () {
  'use strict';

  var actx = null;

  function initAudio() {
    if (actx) return;
    var C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    actx = new C();
  }

  // Escala pentatônica mágica para as contagens (notas em Hz)
  var scale = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99];

  function playNote(index) {
    if (!actx) return;
    if (actx.state === 'suspended') actx.resume();
    
    var t = actx.currentTime;
    var osc = actx.createOscillator();
    var gain = actx.createGain();

    var freq = scale[Math.min(index, scale.length - 1)];
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.3, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

    osc.connect(gain);
    gain.connect(actx.destination);

    osc.start(t);
    osc.stop(t + 0.5);
  }

  function playMagic() {
    if (!actx) return;
    if (actx.state === 'suspended') actx.resume();

    var t = actx.currentTime;
    [0, 2, 4, 7].forEach((n, i) => {
      var osc = actx.createOscillator();
      var gain = actx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(scale[n] * 2, t + (i * 0.1));
      
      gain.gain.setValueAtTime(0, t + (i * 0.1));
      gain.gain.linearRampToValueAtTime(0.2, t + (i * 0.1) + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + (i * 0.1) + 0.5);

      osc.connect(gain);
      gain.connect(actx.destination);
      osc.start(t + (i * 0.1));
      osc.stop(t + (i * 0.1) + 0.5);
    });
  }

  function playPop() {
    if (!actx) return;
    if (actx.state === 'suspended') actx.resume();

    var t = actx.currentTime;
    var osc = actx.createOscillator();
    var gain = actx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.1);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

    osc.connect(gain);
    gain.connect(actx.destination);

    osc.start(t);
    osc.stop(t + 0.1);
  }

  window.GameAudio = {
    init: initAudio,
    playNote: playNote,
    playMagic: playMagic,
    playPop: playPop
  };
})();
