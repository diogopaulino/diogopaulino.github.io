// core/pixel.js — PixelSurface: canvas de stage (320x224) + canvas de tela com escala inteira,
// câmera, shake, transições (dither fade / wipe diagonal). Teto: ~270 linhas.

import { clamp } from './util.js';
import { BAYER4 } from './palette.js';

export const W = 320;
export const H = 224;
const MAX_BACK_SCALE = 6;

export class PixelSurface {
    constructor(wrapEl, stageCanvas, screenCanvas) {
        this.wrap = wrapEl;
        this.stage = stageCanvas;
        this.screen = screenCanvas;
        this.stage.width = W; this.stage.height = H;
        this.ctx = this.stage.getContext('2d', { alpha: false, desynchronized: true });
        this.ctx.imageSmoothingEnabled = false;
        this.sctx = this.screen.getContext('2d', { alpha: false, desynchronized: true });
        this.sctx.imageSmoothingEnabled = false;

        this.coarse = matchMedia('(pointer: coarse)').matches;
        this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
        this.back = 1;

        this.cam = { x: 0, y: 0 };
        this.shakeT = 0; this.shakeMs = 0; this.shakePower = 0;
        this.theme = 'light';

        this._ditherPatterns = null;
        this._buildDitherPatterns();

        this._ro = new ResizeObserver(() => this._scheduleFit());
        // observa o palco pai — o wrap muda de tamanho por nós (escala inteira)
        const stage = this.wrap.parentElement || this.wrap;
        this._ro.observe(stage);
        this._fitPending = false;
        this.fit();
    }

    _scheduleFit() {
        if (this._fitPending) return;
        this._fitPending = true;
        requestAnimationFrame(() => { this._fitPending = false; this.fit(); });
    }

    fit() {
        // Escala INTEIRA estilo emulador Mega Drive / Genesis.
        const stage = this.wrap.parentElement;
        const maxW = Math.max(32, (stage?.clientWidth || 320) - 4);
        const maxH = Math.max(32, (stage?.clientHeight || 224) - 4);

        const dpr = Math.min(window.devicePixelRatio || 1, 3);
        const raw = Math.min(maxW / W, maxH / H);
        const cssScale = raw >= 1 ? Math.max(1, Math.floor(raw)) : Math.max(0.5, raw);
        this.wrap.style.width = `${W * cssScale}px`;
        this.wrap.style.height = `${H * cssScale}px`;

        const back = clamp(Math.max(cssScale, Math.round(cssScale * dpr)), 1, MAX_BACK_SCALE);
        if (this.screen.width !== W * back || this.screen.height !== H * back) {
            this.screen.width = W * back;
            this.screen.height = H * back;
            this.sctx.imageSmoothingEnabled = false;
        }
        this.back = back;
        this.cssScale = cssScale;
    }

    setTheme(theme) { this.theme = theme; }

    setCam(x, y) {
        this.cam.x = Math.round(x);
        this.cam.y = Math.round(y);
    }

    shake(power, ms) {
        // respeitamos tanto a preferência do sistema quanto o ajuste nas opções do jogo
        if (this.reducedMotion || this.shakeEnabled === false) return;
        this.shakePower = Math.max(this.shakePower, power);
        this.shakeMs = Math.max(this.shakeMs, ms);
        this.shakeT = 0;
    }

    /** Chamado uma vez por frame de update para decair o shake. */
    tickShake(dtMs) {
        if (this.shakeMs <= 0) { this.shakeOffset = { x: 0, y: 0 }; return; }
        this.shakeT += dtMs;
        const t = clamp(this.shakeT / this.shakeMs, 0, 1);
        const power = this.shakePower * (1 - t);
        this.shakeOffset = {
            x: Math.round((Math.random() * 2 - 1) * power),
            y: Math.round((Math.random() * 2 - 1) * power)
        };
        if (t >= 1) { this.shakeMs = 0; this.shakePower = 0; this.shakeOffset = { x: 0, y: 0 }; }
    }

    clearStage(color) {
        const ctx = this.ctx;
        ctx.fillStyle = color || '#000';
        ctx.fillRect(0, 0, W, H);
    }

    /** Desenha um sprite (mundo, sujeito à câmera + shake). */
    blit(sprite, wx, wy, opts = {}) {
        if (!sprite) return;
        const s = opts.scale || 1;
        const so = this.shakeOffset || { x: 0, y: 0 };
        const dx = Math.round(wx - this.cam.x - sprite.ox * s + so.x);
        const dy = Math.round(wy - this.cam.y - sprite.oy * s + so.y);
        this._draw(sprite, dx, dy, opts);
    }

    /**
     * Desenha um sprite direto na tela, ignorando câmera (HUD, cenas de menu).
     * Assim como `blit`, honra a âncora do sprite (ox/oy): (sx, sy) é o ponto de apoio —
     * tipicamente o centro horizontal e a base — e não o canto superior esquerdo.
     */
    blitScreen(sprite, sx, sy, opts = {}) {
        if (!sprite) return;
        const s = opts.scale || 1;
        this._draw(sprite, Math.round(sx - sprite.ox * s), Math.round(sy - sprite.oy * s), opts);
    }

    _draw(sprite, dx, dy, opts) {
        const ctx = this.ctx;
        const scale = opts.scale || 1;
        if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
        ctx.drawImage(sprite.atlas, sprite.x, sprite.y, sprite.w, sprite.h,
            dx, dy, sprite.w * scale, sprite.h * scale);
        if (opts.alpha != null) ctx.globalAlpha = 1;
    }

    rect(x, y, w, h, color) {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    }

    rectWorld(x, y, w, h, color) {
        const so = this.shakeOffset || { x: 0, y: 0 };
        this.rect(x - this.cam.x + so.x, y - this.cam.y + so.y, w, h, color);
    }

    line(x0, y0, x1, y1, color) {
        this.ctx.strokeStyle = color;
        this.ctx.beginPath();
        this.ctx.moveTo(x0 + 0.5, y0 + 0.5);
        this.ctx.lineTo(x1 + 0.5, y1 + 0.5);
        this.ctx.stroke();
    }

    clip(x, y, w, h, fn) {
        const ctx = this.ctx;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();
        fn(ctx);
        ctx.restore();
    }

    _buildDitherPatterns() {
        const levels = [0, 4, 8, 12, 16]; // de 5 (0%) a 16 (100%) sobre bayer 4x4
        this._ditherPatterns = levels.map((lvl) => {
            const cv = document.createElement('canvas');
            cv.width = 4; cv.height = 4;
            const g = cv.getContext('2d');
            for (let y = 0; y < 4; y++) {
                for (let x = 0; x < 4; x++) {
                    const thresh = BAYER4[y][x] * 16;
                    if (thresh < lvl) { g.fillStyle = '#000'; g.fillRect(x, y, 1, 1); }
                }
            }
            return cv;
        });
    }

    /** Fade ditherizado (0..1) sobre o stage inteiro, na cor dada. */
    ditherFade(t, color = '#000000') {
        if (t <= 0) return;
        const idx = Math.min(4, Math.floor(t * 4.999));
        const ctx = this.ctx;
        const pattern = ctx.createPattern(this._ditherPatterns[idx], 'repeat');
        ctx.fillStyle = color;
        ctx.globalAlpha = 1;
        ctx.save();
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
    }

    /** Wipe diagonal (0..1) — barras verticais cobrindo a tela da esquerda pra direita. */
    wipe(t, color = '#000000', bars = 10) {
        if (t <= 0) return;
        const ctx = this.ctx;
        ctx.fillStyle = color;
        const barW = Math.ceil(W / bars) + 2;
        const travel = W + H * 0.5 + barW;
        for (let i = 0; i < bars; i++) {
            const skew = i * (H * 0.5 / bars);
            const edge = -barW + t * travel - skew;
            if (edge > -barW) {
                ctx.fillRect(i * barW, 0, Math.min(barW, Math.max(0, edge + barW)), H);
            }
        }
    }

    present() {
        const s = this.sctx;
        s.imageSmoothingEnabled = false;
        s.drawImage(this.stage, 0, 0, W, H, 0, 0, this.screen.width, this.screen.height);
    }
}
