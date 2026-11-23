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

const HEADER_H = 60;   // altura do header compartilhado (botão voltar + tema)
const HUD_ROW = 48;    // linha dos botões de som/tela cheia sob o header
const HUD_SIDE = 112;  // margem lateral mínima para os 2 botões do HUD (2×44 + gap + padding) não cobrirem a tela
const SIDE_GUTTER = 88; // margem lateral do modo "side" (header e HUD nas laterais)

/** Escala inteira (pixel quadrado perfeito) quando >= 2×; fluida abaixo disso. */
function snap(raw) {
  return raw >= 2 ? Math.floor(raw) : raw;
}

/**
 * Escolhe entre dois layouts e fica com o que dá a maior tela:
 * - "top": header e HUD em cima, canvas centralizado no espaço que sobra.
 * - "side": celular deitado; header e HUD vão para as margens laterais e o
 *   canvas usa a altura inteira (sem nada cobrindo o palco).
 */
export function fit() {
  const iw = window.visualViewport?.width || window.innerWidth;
  const ih = window.visualViewport?.height || window.innerHeight;

  let top = HEADER_H;
  let sTop = snap(Math.min(iw / W, (ih - top) / H));
  if ((iw - W * sTop) / 2 < HUD_SIDE) {
    top = HEADER_H + HUD_ROW;
    sTop = snap(Math.min(iw / W, (ih - top) / H));
  }

  const landscape = iw > ih;
  const sSide = landscape ? snap(Math.min((iw - SIDE_GUTTER * 2) / W, ih / H)) : 0;
  const side = sSide > sTop;
  const scale = side ? sSide : sTop;

  const root = document.documentElement;
  root.dataset.fit = side ? 'side' : 'top';
  root.style.setProperty('--top', side ? '0px' : `${top}px`);
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
