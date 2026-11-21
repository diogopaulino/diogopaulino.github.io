/* ==========================================================================
   Ravi 1·2·3 — Paleta VGA 16-bit (44 cores), primitivas rápidas e cache
   --------------------------------------------------------------------------
   - Paleta calibrada para alto contraste e calor visual (madeiras, ouro,
     esmeralda, carmim e azul meia-noite).
   - `Pen.col()` evita reatribuir `ctx.fillStyle` quando a cor já está ativa.
   - `bakeSprite()` cria superfícies offscreen uma única vez no boot.
   ========================================================================== */

import { makeSurface } from './screen.js';

export const PAL = [
  '#0c0a18', // 0  BLACK      — contorno profundo índigo-escuro
  '#ffffff', // 1  WHITE      — brilho puro
  '#e2e6f0', // 2  GRAY_L     — metal claro / prata
  '#a6b0c4', // 3  GRAY       — aço médio
  '#64708a', // 4  GRAY_D     — aço sombra
  '#32384d', // 5  GRAY_XD    — ferro escuro
  '#ff6b6b', // 6  RED_L      — vermelho coral / brilho
  '#e02838', // 7  RED        — vermelho vibrante
  '#8c1422', // 8  RED_D      — carmim profundo
  '#ffc828', // 9  YEL        — ouro vivo
  '#fff280', // 10 YEL_L      — ouro claro / luz
  '#d48818', // 11 OCHRE      — ocre dourado / bronze
  '#f4b478', // 12 SAND       — madeira clara / camurça
  '#d87c38', // 13 FLOOR      — assoalho quente
  '#9e4c18', // 14 FLOOR_D    — mogno / madeira média
  '#5c280c', // 15 WOOD_D     — nogueira escura
  '#68e868', // 16 GRN_L      — folha iluminada
  '#24b038', // 17 GRN        — esmeralda vivo
  '#126824', // 18 GRN_D      — pinheiro sombra
  '#70c4ff', // 19 BLU_L      — céu claro / cristal
  '#2870e8', // 20 BLU        — azul real
  '#143488', // 21 BLU_D      — azul marinho rico
  '#c878ff', // 22 PUR_L      — lavanda vibrante
  '#7c30d0', // 23 PUR        — púrpura real
  '#ff68b8', // 24 PINK       — rosa chiclete
  '#fff6dc', // 25 CREAM      — marfim / papel cartão
  '#18dce8', // 26 CYAN       — turquesa brilhante
  '#ff8420', // 27 ORANGE     — tangerina
  '#1c2c64', // 28 NAVY       — azul meia-noite
  '#0e1434', // 29 NIGHT      — céu noturno profundo
  '#d8d0ff', // 30 LILAC      — lilás pastel
  '#ffd8b4', // 31 SKIN       — pele iluminada
  '#e0a478', // 32 SKIN_D     — pele sombra
  '#481868', // 33 PUR_D      — roxo sombra
  '#ffb0d8', // 34 PINK_L     — rosa claro / glacê
  '#b82068', // 35 PINK_D     — framboesa
  '#88f4c8', // 36 MINT       — menta
  '#0c8888', // 37 TEAL       — petróleo
  '#ffe0a0', // 38 GOLD_L     — champanhe
  '#784820', // 39 BROWN      — couro
  '#381808', // 40 WOOD_XD    — ébano
  '#244820', // 41 FOREST     — bosque noturno
  '#a8e0ff', // 42 SKY_L      — horizonte manhã
  '#4488d8'  // 43 SKY_M      — céu meio-dia
];

export const K = {
  BLACK: 0, WHITE: 1, GRAY_L: 2, GRAY: 3, GRAY_D: 4, GRAY_XD: 5,
  RED_L: 6, RED: 7, RED_D: 8,
  YEL: 9, YEL_L: 10, OCHRE: 11,
  SAND: 12, FLOOR: 13, FLOOR_D: 14, WOOD_D: 15,
  GRN_L: 16, GRN: 17, GRN_D: 18,
  BLU_L: 19, BLU: 20, BLU_D: 21,
  PUR_L: 22, PUR: 23, PINK: 24,
  CREAM: 25, CYAN: 26, ORANGE: 27, NAVY: 28, NIGHT: 29, LILAC: 30, SKIN: 31,
  SKIN_D: 32, PUR_D: 33, PINK_L: 34, PINK_D: 35, MINT: 36, TEAL: 37,
  GOLD_L: 38, BROWN: 39, WOOD_XD: 40, FOREST: 41, SKY_L: 42, SKY_M: 43
};

/* --------------------------------------------------------------------------
   Pen — primitivas inteiras rápidas sobre um contexto 2D
   -------------------------------------------------------------------------- */

export class Pen {
  constructor(ctx) {
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;
    this._ci = -1;
  }

  col(i) {
    if (this._ci !== i) {
      this._ci = i;
      this.ctx.fillStyle = PAL[i] || PAL[0];
    }
    return this;
  }

  px(x, y) {
    this.ctx.fillRect(x | 0, y | 0, 1, 1);
    return this;
  }

  hline(x, y, w) {
    if (w > 0) this.ctx.fillRect(x | 0, y | 0, w | 0, 1);
    return this;
  }

  vline(x, y, h) {
    if (h > 0) this.ctx.fillRect(x | 0, y | 0, 1, h | 0);
    return this;
  }

  rect(x, y, w, h) {
    if (w > 0 && h > 0) this.ctx.fillRect(x | 0, y | 0, w | 0, h | 0);
    return this;
  }

  roundRect(x, y, w, h, r = 2) {
    x |= 0; y |= 0; w |= 0; h |= 0;
    if (w <= 0 || h <= 0) return this;
    if (r <= 1 || w < 6 || h < 6) {
      this.rect(x + 1, y, w - 2, h);
      this.rect(x, y + 1, w, h - 2);
      return this;
    }
    this.rect(x + 2, y, w - 4, h);
    this.rect(x + 1, y + 1, w - 2, h - 2);
    this.rect(x, y + 2, w, h - 4);
    return this;
  }

  frame(x, y, w, h) {
    this.hline(x, y, w);
    this.hline(x, y + h - 1, w);
    this.vline(x, y, h);
    this.vline(x + w - 1, y, h);
    return this;
  }

  ellipse(cx, cy, rx, ry) {
    cx |= 0; cy |= 0; rx |= 0; ry |= 0;
    if (rx <= 0 || ry <= 0) return this;
    for (let y = -ry; y <= ry; y++) {
      const t = 1 - (y * y) / (ry * ry);
      if (t <= 0) continue;
      const w = Math.round(rx * Math.sqrt(t));
      if (w >= 0) this.hline(cx - w, cy + y, w * 2 + 1);
    }
    return this;
  }

  circle(cx, cy, r) {
    return this.ellipse(cx, cy, r, r);
  }

  ring(cx, cy, r) {
    cx |= 0; cy |= 0; r |= 0;
    let x = r;
    let y = 0;
    let err = 1 - r;
    while (x >= y) {
      this.px(cx + x, cy + y).px(cx + y, cy + x);
      this.px(cx - y, cy + x).px(cx - x, cy + y);
      this.px(cx - x, cy - y).px(cx - y, cy - x);
      this.px(cx + y, cy - x).px(cx + x, cy - y);
      y++;
      if (err < 0) err += 2 * y + 1;
      else { x--; err += 2 * (y - x) + 1; }
    }
    return this;
  }

  line(x0, y0, x1, y1) {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.px(x0, y0);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return this;
  }

  poly(pts) {
    if (!pts || pts.length < 3) return this;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of pts) {
      if (p[1] < minY) minY = p[1] | 0;
      if (p[1] > maxY) maxY = p[1] | 0;
    }
    for (let y = minY; y <= maxY; y++) {
      const nodes = [];
      let j = pts.length - 1;
      for (let i = 0; i < pts.length; i++) {
        const yi = pts[i][1];
        const yj = pts[j][1];
        if ((yi < y && yj >= y) || (yj < y && yi >= y)) {
          nodes.push((pts[i][0] + ((y - yi) / (yj - yi)) * (pts[j][0] - pts[i][0])) | 0);
        }
        j = i;
      }
      nodes.sort((a, b) => a - b);
      for (let i = 0; i < nodes.length; i += 2) {
        if (i + 1 < nodes.length) {
          this.hline(nodes[i], y, nodes[i + 1] - nodes[i] + 1);
        }
      }
    }
    return this;
  }

  bevel(x, y, w, h, face, light, dark) {
    this.col(face).rect(x, y, w, h);
    this.col(light).hline(x, y, w).vline(x, y, h);
    this.col(dark).hline(x, y + h - 1, w).vline(x + w - 1, y, h);
    return this;
  }

  inset(x, y, w, h, face, light, dark) {
    return this.bevel(x, y, w, h, face, dark, light);
  }
}

/* --------------------------------------------------------------------------
   Sprites & Blit
   -------------------------------------------------------------------------- */

export function bakeSprite(w, h, draw) {
  const s = makeSurface(w, h);
  draw(new Pen(s.ctx), w, h);
  return { canvas: s.canvas, w, h };
}

export function blit(ctx, sprite, x, y) {
  if (!sprite) return;
  ctx.drawImage(sprite.canvas, x | 0, y | 0);
}

export function blitFoot(ctx, sprite, x, y) {
  if (!sprite) return;
  ctx.drawImage(sprite.canvas, (x - (sprite.w >> 1)) | 0, (y - sprite.h) | 0);
}

export function blitMid(ctx, sprite, x, y) {
  if (!sprite) return;
  ctx.drawImage(sprite.canvas, (x - (sprite.w >> 1)) | 0, (y - (sprite.h >> 1)) | 0);
}
