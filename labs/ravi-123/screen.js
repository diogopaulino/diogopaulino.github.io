/* ==========================================================================
   Ravi 1·2·3 — tela virtual 320×200 (modo VGA 13h)
   --------------------------------------------------------------------------
   O jogo inteiro é desenhado num buffer fixo de 320×200. O upscale acontece
   no CSS (image-rendering: pixelated), então o navegador escala na GPU e o
   backing store nunca muda de tamanho — nem no resize, nem em tela cheia.
   ========================================================================== */

export const W = 320;
export const H = 200;

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
 * Prefere escala inteira (pixel quadrado perfeito). Só cai para fracionária
 * quando nem 2× caberia — caso contrário um celular ficaria preso em 1× e
 * desperdiçaria quase toda a tela.
 */
export function fit() {
  const raw = Math.min(window.innerWidth / W, window.innerHeight / H);
  const scale = raw >= 2 ? Math.floor(raw) : raw;
  const root = document.documentElement;
  root.style.setProperty('--sw', `${Math.round(W * scale)}px`);
  root.style.setProperty('--sh', `${Math.round(H * scale)}px`);
}

/**
 * Converte coordenada de ponteiro (clientX/clientY) para pixel do buffer.
 * Usa o rect real do canvas, então funciona com qualquer escala — inteira,
 * fracionária ou em fullscreen — sem precisar saber qual foi usada.
 * Devolve null se o toque caiu fora da área do jogo (letterbox).
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

/** Canvas fora de tela do tamanho do buffer, para assar fundos e sprites. */
export function makeSurface(w = W, h = H) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const c2d = c.getContext('2d');
  c2d.imageSmoothingEnabled = false;
  return { canvas: c, ctx: c2d };
}
