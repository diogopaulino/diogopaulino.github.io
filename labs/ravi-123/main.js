/* ==========================================================================
   Ravi 1·2·3 — boot, loop e entrada
   --------------------------------------------------------------------------
   Um único requestAnimationFrame com delta time real e passo lógico fixo.
   O jogo antigo somava 1/60 por frame, então rodava ao dobro da velocidade
   em tela de 120 Hz e derrapava sempre que um frame atrasava.
   ========================================================================== */

import { initScreen, fit, toBuffer } from './screen.js';
import { Audio } from './audio.js';
import { hitTest } from './scenes.js';
import { initGame, update, draw, handleNumber, currentSpots } from './game.js';

const STEP = 1 / 60;      // passo lógico fixo
const MAX_FRAME = 0.25;   // teto para não explodir depois de uma aba oculta

let ctx = null;
let accumulator = 0;
let last = 0;
let running = true;
let rafId = 0;

function loop(now) {
  rafId = requestAnimationFrame(loop);
  if (!running) return;

  const seconds = now / 1000;
  let delta = last ? seconds - last : STEP;
  last = seconds;
  if (delta > MAX_FRAME) delta = MAX_FRAME;

  accumulator += delta;
  let guard = 0;
  while (accumulator >= STEP && guard < 8) {
    update(STEP);
    accumulator -= STEP;
    guard++;
  }
  if (guard === 8) accumulator = 0;

  draw(ctx);
}

/* --------------------------------------------------------------------------
   Entrada
   -------------------------------------------------------------------------- */

function onKeyDown(event) {
  if (event.metaKey || event.ctrlKey || event.altKey) return;

  if (event.key >= '0' && event.key <= '9') {
    event.preventDefault();
    handleNumber(Number(event.key));
    return;
  }
  if (event.key === 'm' || event.key === 'M') {
    event.preventDefault();
    Audio.init();
    Audio.toggleMute();
    return;
  }
  if (event.key === 'f' || event.key === 'F') {
    event.preventDefault();
    toggleFullscreen();
  }
}

function onPointerDown(event) {
  const point = toBuffer(event.clientX, event.clientY);
  if (!point) return;
  const n = hitTest(currentSpots(), point.x, point.y);
  if (n === null) return;
  event.preventDefault();
  handleNumber(n);
}

function toggleFullscreen() {
  const root = document.documentElement;
  try {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (root.requestFullscreen) root.requestFullscreen();
  } catch (_) { /* alguns navegadores bloqueiam sem gesto direto */ }
}

/* --------------------------------------------------------------------------
   Boot
   -------------------------------------------------------------------------- */

function boot() {
  const canvas = document.getElementById('screen');
  ctx = initScreen(canvas);
  initGame();

  window.addEventListener('keydown', onKeyDown);
  canvas.addEventListener('pointerdown', onPointerDown);

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(fit, 80);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      running = false;
      Audio.suspend();
    } else {
      running = true;
      last = 0;          // descarta o intervalo em que a aba ficou oculta
      accumulator = 0;
      Audio.resume();
    }
  });

  document.getElementById('btn-back').addEventListener('click', () => {
    window.location.href = '/labs/';
  });
  document.getElementById('btn-sound').addEventListener('click', (event) => {
    Audio.init();
    const muted = Audio.toggleMute();
    event.currentTarget.textContent = muted ? '♪̸' : '♪';
    event.currentTarget.setAttribute('aria-pressed', String(muted));
  });
  document.getElementById('btn-fs').addEventListener('click', toggleFullscreen);

  rafId = requestAnimationFrame(loop);
}

window.addEventListener('pagehide', () => {
  cancelAnimationFrame(rafId);
  Audio.suspend();
});

boot();
