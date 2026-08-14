import { VIEW_W, VIEW_H } from './config.js';
import { KongAudio } from './audio.js';
import { createInput } from './input.js';
import { KongGame } from './game.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
const announcer = document.getElementById('announcer');
const muteBtn = document.getElementById('muteBtn');
const pauseBtn = document.getElementById('pauseBtn');
const pad = document.getElementById('touchPad');

const audio = new KongAudio();
const input = createInput();
const game = new KongGame(audio, input);

input.bindHold(document.getElementById('btnLeft'), 'left');
input.bindHold(document.getElementById('btnRight'), 'right');
input.bindHold(document.getElementById('btnUp'), 'up');
input.bindHold(document.getElementById('btnDown'), 'down');
input.bindHold(document.getElementById('btnJump'), 'jump');
input.bindHold(document.getElementById('btnRoll'), 'roll');

function syncMute() {
  const muted = audio.muted;
  muteBtn.setAttribute('aria-pressed', String(muted));
  muteBtn.setAttribute('aria-label', muted ? 'Ativar som' : 'Desativar som');
  muteBtn.textContent = muted ? '×' : '♪';
}

muteBtn.addEventListener('click', () => {
  audio.toggleMute();
  syncMute();
});

pauseBtn.addEventListener('click', () => {
  if (game.mode === 'play') {
    game.mode = 'pause';
    game.setAnnounce('Pausa');
  } else if (game.mode === 'pause') {
    game.mode = 'play';
  } else if (game.mode === 'title') {
    game.startRun();
  }
});

canvas.addEventListener('pointerdown', (ev) => {
  audio.ensure();
  const rect = canvas.getBoundingClientRect();
  const mx = ((ev.clientX - rect.left) / rect.width) * VIEW_W;
  const my = ((ev.clientY - rect.top) / rect.height) * VIEW_H;
  if (game.mode === 'title') game.startRun();
  else if (game.mode === 'map') game.tapMap(mx, my);
  else if (game.mode === 'clear' || game.mode === 'gameover' || game.mode === 'credits') {
    input.pulse.start = true;
  }
});

let lastAnnounce = '';
let last = performance.now();

function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  game.update(dt);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  game.render(ctx);

  if (game.announce && game.announce !== lastAnnounce) {
    lastAnnounce = game.announce;
    announcer.textContent = game.announce;
  }

  const playing = game.mode === 'play';
  pad.classList.toggle('is-hidden', !playing);
  pauseBtn.classList.toggle('is-dim', game.mode === 'title' || game.mode === 'map');
  syncMute();

  requestAnimationFrame(frame);
}

syncMute();
requestAnimationFrame(frame);
