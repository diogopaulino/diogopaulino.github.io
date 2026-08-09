/* ==========================================================================
   Ravi 1·2·3 — paleta VGA, primitivas de pixel e cache de sprites
   --------------------------------------------------------------------------
   Regra da casa: nenhum desenho usa cor solta, gradiente ou coordenada
   fracionária. Tudo passa pela paleta congelada e por primitivas que só
   aceitam inteiros — é isso que garante o pixel art de verdade.
   ========================================================================== */

import { makeSurface } from './screen.js';

/* --------------------------------------------------------------------------
   Paleta — 32 cores amostradas das telas originais do jogo de 1990
   -------------------------------------------------------------------------- */

export const PAL = [
  '#000000', // 0  preto / contorno
  '#ffffff', // 1  branco
  '#d8d8d8', // 2  cinza claro (cano, metal)
  '#a0a0a0', // 3  cinza
  '#686868', // 4  cinza escuro
  '#303030', // 5  quase preto
  '#f85858', // 6  tijolo claro
  '#d02020', // 7  tijolo / vermelho
  '#901010', // 8  tijolo escuro
  '#f8b800', // 9  amarelo
  '#f8f858', // 10 amarelo claro
  '#c08000', // 11 ocre
  '#f89058', // 12 areia
  '#d07030', // 13 chão laranja
  '#a04808', // 14 chão escuro / madeira
  '#683008', // 15 madeira escura
  '#58d858', // 16 verde claro
  '#20a020', // 17 verde
  '#106810', // 18 verde escuro
  '#58a8f8', // 19 azul claro / céu
  '#2058d8', // 20 azul
  '#102890', // 21 azul escuro
  '#b858f8', // 22 roxo claro
  '#8028d8', // 23 roxo
  '#f858b8', // 24 rosa
  '#f8f8d8', // 25 creme
  '#00c8c8', // 26 ciano
  '#f87818', // 27 laranja
  '#004080', // 28 azul noite
  '#181840', // 29 noite
  '#c8c8f8', // 30 lilás
  '#f8d8b8'  // 31 pele
];

/** Índices nomeados — deixa o código das cenas legível. */
export const K = {
  BLACK: 0, WHITE: 1, GRAY_L: 2, GRAY: 3, GRAY_D: 4, GRAY_XD: 5,
  RED_L: 6, RED: 7, RED_D: 8,
  YEL: 9, YEL_L: 10, OCHRE: 11,
  SAND: 12, FLOOR: 13, FLOOR_D: 14, WOOD_D: 15,
  GRN_L: 16, GRN: 17, GRN_D: 18,
  BLU_L: 19, BLU: 20, BLU_D: 21,
  PUR_L: 22, PUR: 23, PINK: 24,
  CREAM: 25, CYAN: 26, ORANGE: 27, NAVY: 28, NIGHT: 29, LILAC: 30, SKIN: 31
};

/* --------------------------------------------------------------------------
   Pen — primitivas inteiras sobre um contexto 2D
   -------------------------------------------------------------------------- */

export class Pen {
  constructor(ctx) {
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;
  }

  /** Seleciona a cor pelo índice da paleta. */
  col(i) {
    this.ctx.fillStyle = PAL[i] || PAL[0];
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

  /** Contorno de 1px. */
  frame(x, y, w, h) {
    this.hline(x, y, w);
    this.hline(x, y + h - 1, w);
    this.vline(x, y, h);
    this.vline(x + w - 1, y, h);
    return this;
  }

  /** Elipse cheia por varredura de linhas — sem antialias. */
  ellipse(cx, cy, rx, ry) {
    if (rx <= 0 || ry <= 0) return this;
    for (let y = -ry; y <= ry; y++) {
      const t = 1 - (y * y) / (ry * ry);
      if (t <= 0) continue;
      const w = Math.round(rx * Math.sqrt(t));
      if (w > 0) this.hline(cx - w, cy + y, w * 2 + 1);
    }
    return this;
  }

  circle(cx, cy, r) {
    return this.ellipse(cx, cy, r, r);
  }

  /** Anel de 1px (roda, engrenagem, aro). */
  ring(cx, cy, r) {
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

  /** Bresenham. */
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

  /**
   * Caixa com chanfro — a base visual de todo painel diegético.
   * `light` desenha o alto/esquerda, `dark` o baixo/direita.
   */
  bevel(x, y, w, h, face, light, dark) {
    this.col(face).rect(x, y, w, h);
    this.col(light).hline(x, y, w).vline(x, y, h);
    this.col(dark).hline(x, y + h - 1, w).vline(x + w - 1, y, h);
    return this;
  }

  /** Chanfro invertido — usado nas células afundadas do painel. */
  inset(x, y, w, h, face, light, dark) {
    return this.bevel(x, y, w, h, face, dark, light);
  }
}

/* --------------------------------------------------------------------------
   Sprites
   -------------------------------------------------------------------------- */

export const IMG = {};

export async function loadImages(names) {
  const promises = names.map(name => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        IMG[name] = img;
        resolve();
      };
      img.onerror = reject;
      img.src = `./assets/img/${name}.jpg`;
    });
  });
  await Promise.all(promises);
}

export function sliceSpriteSheet(imageName, targetHeight = 0) {
  const img = IMG[imageName];
  if (!img) return [];
  const s = makeSurface(img.width, img.height);
  const ctx = s.ctx;
  ctx.drawImage(img, 0, 0);
  const imgData = ctx.getImageData(0, 0, img.width, img.height);
  const data = imgData.data;

  // Ajustado para remover fundo magenta com segurança (sem comer o rosa da Aria)
  // Checamos se R e B são altos, G é baixo, e se R e B são similares (magenta real).
  const isBg = (r, g, b) => r > 150 && b > 150 && g < 150 && Math.abs(r - b) < 60;

  const visited = new Uint8Array(img.width * img.height);
  const rects = [];

  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const idx = y * img.width + x;
      if (visited[idx]) continue;
      const p = idx * 4;
      if (isBg(data[p], data[p+1], data[p+2])) {
        visited[idx] = 1;
        continue;
      }

      let minX = x, maxX = x, minY = y, maxY = y;
      const stack = [[x, y]];
      visited[idx] = 1;
      let pixelCount = 0;

      while (stack.length > 0) {
        const [cx, cy] = stack.pop();
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;
        pixelCount++;

        const neighbors = [
          [cx-1, cy], [cx+1, cy], [cx, cy-1], [cx, cy+1],
          [cx-1, cy-1], [cx+1, cy-1], [cx-1, cy+1], [cx+1, cy+1]
        ];

        for (const [nx, ny] of neighbors) {
          if (nx >= 0 && nx < img.width && ny >= 0 && ny < img.height) {
            const nidx = ny * img.width + nx;
            if (!visited[nidx]) {
              visited[nidx] = 1;
              const np = nidx * 4;
              if (!isBg(data[np], data[np+1], data[np+2])) {
                stack.push([nx, ny]);
              }
            }
          }
        }
      }

      // Filtro: ignorar ruídos
      if (pixelCount < 100) continue;
      
      const w = maxX - minX + 1;
      const h = maxY - minY + 1;
      
      // Filtro: ignorar textos compridos
      if (w > h * 2.5) continue;
      if (h > w * 3) continue;

      rects.push({x: minX, y: minY, w, h});
    }
  }

  // Ordenar da esquerda pra direita, de cima pra baixo
  rects.sort((a, b) => {
    if (Math.abs(a.y - b.y) < Math.min(a.h, b.h) / 2) {
      return a.x - b.x;
    }
    return a.y - b.y;
  });

  const sprites = [];
  for (const r of rects) {
    let finalW = r.w;
    let finalH = r.h;
    if (targetHeight > 0) {
      finalH = targetHeight;
      finalW = Math.round((r.w / r.h) * targetHeight);
    }
    const sub = makeSurface(finalW, finalH);
    sub.ctx.drawImage(img, r.x, r.y, r.w, r.h, 0, 0, finalW, finalH);
    const sData = sub.ctx.getImageData(0, 0, finalW, finalH);
    for (let i = 0; i < sData.data.length; i += 4) {
      if (isBg(sData.data[i], sData.data[i+1], sData.data[i+2])) {
        sData.data[i+3] = 0;
      }
    }
    sub.ctx.putImageData(sData, 0, 0);
    sprites.push({ canvas: sub.canvas, w: finalW, h: finalH });
  }
  return sprites;
}

/**
 * Assa um sprite desenhado por código.
 * `draw(pen, w, h)` recebe uma Pen já apontada para a superfície.
 */
export function bakeSprite(w, h, draw) {
  const s = makeSurface(w, h);
  draw(new Pen(s.ctx), w, h);
  return { canvas: s.canvas, w, h };
}

/* --------------------------------------------------------------------------
   Blit
   -------------------------------------------------------------------------- */

/** Desenha um sprite com o canto superior esquerdo em (x, y). */
export function blit(ctx, sprite, x, y) {
  if (!sprite) return;
  ctx.drawImage(sprite.canvas, x | 0, y | 0);
}

/** Desenha um sprite centrado horizontalmente e apoiado pela base em (x, y). */
export function blitFoot(ctx, sprite, x, y) {
  if (!sprite) return;
  ctx.drawImage(sprite.canvas, (x - (sprite.w >> 1)) | 0, (y - sprite.h) | 0);
}

/** Desenha um sprite centrado nos dois eixos. */
export function blitMid(ctx, sprite, x, y) {
  if (!sprite) return;
  ctx.drawImage(sprite.canvas, (x - (sprite.w >> 1)) | 0, (y - (sprite.h >> 1)) | 0);
}
