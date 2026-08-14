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
import { initGame, update, draw, handleNumber, currentSpots, debugApi } from './game.js';
import { buildSprites } from './sprites.js';

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
    // O atalho e o botão precisam contar a mesma história: mudo pela tecla M sem atualizar
    // o botão deixava o rótulo e o estado do leitor de tela mentindo sobre o som.
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
  const n = hitTest(currentSpots(), point.x, point.y);
  event.preventDefault();
  handleNumber(n === null ? -1 : n);
}

/**
 * Reflete o estado do áudio no botão.
 * `aria-pressed` descreve o botão "som", então ele vale true quando o som está LIGADO.
 * Antes o atributo recebia o valor de `muted`, ou seja, o leitor de tela anunciava
 * "pressionado" justamente quando o som estava desligado — o oposto do estado real.
 */
function syncSoundButton(btn, muted) {
  if (!btn) return;
  btn.textContent = muted ? '♪̸' : '♪';
  btn.setAttribute('aria-pressed', String(!muted));
  btn.setAttribute('aria-label', muted ? 'Ligar o som' : 'Desligar o som');
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

    document.getElementById('btn-sound').addEventListener('click', (event) => {
      Audio.init();
      syncSoundButton(event.currentTarget, Audio.toggleMute());
    });
    document.getElementById('btn-fs').addEventListener('click', toggleFullscreen);

    // Alguns navegadores não disparam `resize` ao entrar/sair de tela cheia; sem isto a
    // escala do canvas ficaria congelada na medida da janela antiga.
    document.addEventListener('fullscreenchange', fit);

    rafId = requestAnimationFrame(loop);
  } catch (err) {
    ctx.fillStyle = 'red';
    ctx.fillText('ERRO: ' + err.message, 20, 120);
    console.error(err);
  }
}

window.addEventListener('pagehide', () => {
  cancelAnimationFrame(rafId);
  Audio.suspend();
});

boot();
