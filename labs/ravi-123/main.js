/* ==========================================================================
   Ravi 1·2·3 — boot, loop e entrada
   --------------------------------------------------------------------------
   Um único requestAnimationFrame com delta time real e passo lógico fixo.
   ========================================================================== */

import { initScreen, fit, toBuffer } from './screen.js?v=29';
import { Audio } from './audio.js?v=29';
import { hitTest } from './scenes.js';
import { initGame, update, draw, handleNumber, currentSpots, debugApi, setHover } from './game.js';
import { buildSprites } from './sprites.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;

let ctx = null;
let accumulator = 0;
let last = 0;
let running = true;
let rafId = 0;

function loop(now) {
  if (!running) {
    rafId = 0;
    return;
  }

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
  rafId = requestAnimationFrame(loop);
}

function startLoop() {
  if (rafId) return;
  rafId = requestAnimationFrame(loop);
}

/* --------------------------------------------------------------------------
   Entrada
   -------------------------------------------------------------------------- */

function onKeyDown(event) {
  if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;

  if (event.key >= '0' && event.key <= '9') {
    event.preventDefault();
    handleNumber(Number(event.key));
    return;
  }
  if (event.key === ' ' || event.key === 'Enter') {
    event.preventDefault();
    handleNumber(-1);
    return;
  }
  if (event.key === 'r' || event.key === 'R') {
    event.preventDefault();
    handleNumber(-2);
    return;
  }
  if (event.key === 'm' || event.key === 'M') {
    event.preventDefault();
    Audio.init();
    syncSoundButton(document.getElementById('btn-sound'), Audio.toggleMute());
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
  // Dedo (criança pequena) ganha margem maior que o mouse.
  const n = hitTest(currentSpots(), point.x, point.y, event.pointerType === 'mouse' ? 5 : 10);
  event.preventDefault();
  handleNumber(n === null ? -1 : n);
}

/** Mouse sobre um botão numerado: o jogo desenha a moldura de destaque. */
function onPointerMove(event) {
  if (event.pointerType !== 'mouse') return;
  const point = toBuffer(event.clientX, event.clientY);
  const n = point ? hitTest(currentSpots(), point.x, point.y, 0) : null;
  setHover(n !== null && n >= 0 ? n : null);
}

function syncSoundButton(btn, muted) {
  if (!btn) return;
  btn.textContent = muted ? '♪̸' : '♪';
  btn.setAttribute('aria-pressed', String(!muted));
  btn.setAttribute('aria-label', muted ? 'Ligar o som' : 'Desligar o som');
}

async function toggleFullscreen() {
  // iOS Safari não tem Fullscreen API para páginas — botão some via CSS/UA.
  const root = document.documentElement;
  const isFull = () => Boolean(document.fullscreenElement || document.webkitFullscreenElement);
  try {
    if (isFull()) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) await exit.call(document);
    } else {
      const enter = root.requestFullscreen || root.webkitRequestFullscreen;
      if (enter) await enter.call(root);
    }
  } catch (_) {
    /* ignore */
  }
}

/* --------------------------------------------------------------------------
   Boot
   -------------------------------------------------------------------------- */

async function boot() {
  const canvas = document.getElementById('screen');
  ctx = initScreen(canvas);

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff';
  ctx.font = '10px sans-serif';
  ctx.fillText('CARREGANDO...', 120, 100);

  try {
    await buildSprites();
    initGame();
    if (typeof window !== 'undefined') window.__ravi = debugApi();

    window.addEventListener('keydown', onKeyDown);
    canvas.addEventListener('pointerdown', (event) => {
      Audio.init?.();
      try { canvas.setPointerCapture(event.pointerId); } catch { /* ponteiro já solto */ }
      onPointerDown(event);
    }, { passive: false });
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerleave', () => setHover(null));
    canvas.addEventListener('pointercancel', () => setHover(null));

    let resizeTimer = 0;
    const scheduleFit = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(fit, 80);
    };
    window.addEventListener('resize', scheduleFit);
    window.visualViewport?.addEventListener('resize', scheduleFit);

    // Perdeu o foco (outra janela/app): som suspende; volta ao focar.
    window.addEventListener('blur', () => Audio.suspend());
    window.addEventListener('focus', () => { if (!document.hidden) Audio.resume(); });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        running = false;
        if (rafId) {
          const id = rafId;
          rafId = 0;
          cancelAnimationFrame(id);
        }
        Audio.suspend();
      } else {
        running = true;
        last = 0;
        accumulator = 0;
        Audio.resume();
        startLoop();
      }
    });

    document.getElementById('btn-sound').addEventListener('click', (event) => {
      Audio.init();
      syncSoundButton(event.currentTarget, Audio.toggleMute());
    });
    document.getElementById('btn-fs').addEventListener('click', toggleFullscreen);

    document.addEventListener('fullscreenchange', fit);

    startLoop();
  } catch (err) {
    ctx.fillStyle = 'red';
    ctx.fillText('ERRO: ' + err.message, 20, 120);
    console.error(err);
  }
}

window.addEventListener('pagehide', () => {
  if (rafId) {
    const id = rafId;
    rafId = 0;
    cancelAnimationFrame(id);
  }
  Audio.suspend();
});

boot();
