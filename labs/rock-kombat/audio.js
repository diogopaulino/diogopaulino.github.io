let context = null;
let master = null;
let muted = localStorage.getItem('rk-muted') === '1';
let musicTimer = null;
let musicStep = 0;

function ensure() {
  if (!context) {
    context = new (window.AudioContext || window.webkitAudioContext)();
    master = context.createGain();
    master.gain.value = muted ? 0 : 0.58;
    master.connect(context.destination);
  }
  if (context.state === 'suspended') context.resume();
  return context;
}

function gainAt(value, start, duration) {
  const gain = context.createGain();
  gain.gain.setValueAtTime(Math.max(.0001, value), start);
  gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
  gain.connect(master);
  return gain;
}

function tone(freq, duration, volume, type = 'sine', when = 0, bend = 1) {
  ensure();
  const start = context.currentTime + when;
  const osc = context.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq * bend), start + duration);
  osc.connect(gainAt(volume, start, duration));
  osc.start(start);
  osc.stop(start + duration + .02);
}

function noise(duration, volume, when = 0, highpass = 150) {
  ensure();
  const start = context.currentTime + when;
  const length = Math.ceil(context.sampleRate * duration);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = highpass;
  source.buffer = buffer;
  source.connect(filter);
  filter.connect(gainAt(volume, start, duration));
  source.start(start);
}

function sfx(name, strength = 1) {
  if (muted && !context) return;
  ensure();
  const s = Math.max(.5, Math.min(1.6, strength));
  if (name === 'ui') { tone(420, .07, .08, 'square', 0, 1.45); tone(760, .06, .05, 'triangle', .045, .9); }
  if (name === 'whiff') { noise(.09, .06 * s, 0, 850); tone(190, .08, .035 * s, 'sawtooth', 0, .55); }
  if (name === 'light') { noise(.08, .13 * s, 0, 220); tone(145, .11, .15 * s, 'triangle', 0, .48); }
  if (name === 'heavy') { noise(.14, .2 * s, 0, 90); tone(92, .18, .23 * s, 'sawtooth', 0, .38); tone(52, .2, .14 * s, 'sine', .01, .72); }
  if (name === 'block') { noise(.1, .1, 0, 1200); tone(620, .12, .08, 'square', 0, .72); }
  if (name === 'parry') { tone(940, .18, .12, 'sine', 0, 1.6); tone(1320, .22, .08, 'triangle', .03, .75); }
  if (name === 'special') { tone(75, .42, .22, 'sawtooth', 0, 4.2); noise(.3, .14, .06, 380); tone(440, .36, .08, 'square', .12, .5); }
  if (name === 'super') { tone(48, .7, .3, 'sawtooth', 0, 7); noise(.55, .2, .08, 130); tone(880, .5, .11, 'triangle', .18, .35); }
  if (name === 'ko') { tone(130, .38, .2, 'sawtooth', 0, .38); tone(82, .55, .22, 'triangle', .18, .38); }
  if (name === 'round') { tone(330, .12, .1, 'square'); tone(440, .12, .1, 'square', .14); tone(660, .22, .12, 'square', .28); }
  if (name === 'win') { [261.6, 329.6, 392, 523.2].forEach((f, i) => tone(f, .32, .08, 'triangle', i * .12, 1.01)); }
}

const patterns = {
  seattle: [55, 55, 82.4, 55, 73.4, 55, 92.5, 82.4],
  coliseum: [65.4, 98, 65.4, 110, 65.4, 98, 123.5, 110],
  cellar: [73.4, 87.3, 110, 87.3, 73.4, 98, 110, 130.8]
};

function startMusic(stage) {
  stopMusic();
  ensure();
  musicStep = 0;
  const pattern = patterns[stage] || patterns.seattle;
  const tick = () => {
    if (!muted) {
      const f = pattern[musicStep % pattern.length];
      tone(f, .22, .035, 'sawtooth', 0, .92);
      if (musicStep % 2 === 0) { noise(.035, .022, 0, 2400); tone(45, .08, .04, 'sine', 0, .65); }
    }
    musicStep++;
  };
  tick();
  musicTimer = setInterval(tick, stage === 'coliseum' ? 180 : 210);
}

function stopMusic() {
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null;
}

function setMuted(value) {
  muted = value;
  localStorage.setItem('rk-muted', value ? '1' : '0');
  if (master) master.gain.setTargetAtTime(value ? 0 : .58, context.currentTime, .02);
}

export default { ensure, sfx, startMusic, stopMusic, setMuted, get muted() { return muted; } };
