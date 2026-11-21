/* ==========================================================================
   Ravi 1·2·3 — tela virtual 320×200 (modo VGA 13h do DOS)
   --------------------------------------------------------------------------
   Proporção clássica 320×200 exatamente como no Mickey's 123 de DOS:
   - 0..166   (STAGE_H = 166): Palco principal onde os números fazem parte do cenário
   - 166..200 (34px): Barra de narração inferior clássica
   O upscale acontece na GPU via CSS (image-rendering: pixelated).
   ========================================================================== */

export const W = 320;
export const H = 200;
export const STAGE_H = 166;

let canvas = null;
let ctx = null;

/** Cria o contexto 2D sem suavização e devolve ele. */
export function initScreen(el) {
  canvas = el;
  canvas.width = W;
  canvas.height = H;
  ctx = canvas.getContext('2d', { alpha: false });
  ctx.imageSmoothingEnabled = false;
  fit();
  return ctx;
}

export function getContext() {
  return ctx;
}

/**
 * Calcula a maior escala que cabe na viewport.
 * Prefere escala inteira (pixel quadrado perfeito) quando >= 2×, e fluida em
 * telas menores para ocupar toda a largura disponível sem cortar nada.
 */
export function fit() {
  const raw = Math.min(window.innerWidth / W, window.innerHeight / H);
  const scale = raw >= 2 ? Math.floor(raw) : raw;
  const root = document.documentElement;
  root.style.setProperty('--sw', `${Math.round(W * scale)}px`);
  root.style.setProperty('--sh', `${Math.round(H * scale)}px`);
}

/**
 * Converte coordenada de ponteiro (clientX/clientY) para pixel do buffer 320×200.
 */
export function toBuffer(clientX, clientY) {
  if (!canvas) return null;
  const r = canvas.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return null;
  const x = Math.floor(((clientX - r.left) / r.width) * W);
  const y = Math.floor(((clientY - r.top) / r.height) * H);
  if (x < 0 || y < 0 || x >= W || y >= H) return null;
  return { x, y };
}

/** Canvas fora de tela do tamanho pedido, para assar fundos e sprites. */
export function makeSurface(w = W, h = H) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const c2d = c.getContext('2d');
  c2d.imageSmoothingEnabled = false;
  return { canvas: c, ctx: c2d };
}
