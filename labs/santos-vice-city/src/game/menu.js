// game/menu.js — lista navegável reutilizada por todas as telas de menu.
//
// Um único componente cuida de cursor, repetição de tecla, som de navegação e desenho, para
// que menu principal, seleção de evento, opções e recordes se comportem exatamente igual.

import { W } from '../core/pixel.js';
import { SVC } from '../core/palette.js';
import { panel } from './hud.js';

export class MenuList {
    /**
     * @param {Array<{label:string, hint?:string, value?:any, disabled?:boolean}>} items
     */
    constructor(items, opts = {}) {
        this.items = items;
        this.index = 0;
        this.repeatT = 0;
        this.opts = { wrap: true, ...opts };
        this.moveFirstEnabled();
    }

    moveFirstEnabled() {
        const i = this.items.findIndex((it) => !it.disabled);
        if (i >= 0) this.index = i;
    }

    get current() { return this.items[this.index]; }

    setItems(items) {
        this.items = items;
        this.index = Math.min(this.index, Math.max(0, items.length - 1));
    }

    /** Devolve 'move' | 'confirm' | 'back' | null. */
    update(input, audio, dtMs) {
        this.repeatT = Math.max(0, this.repeatT - dtMs);

        const down = input.state.down.down;
        const up = input.state.up.down;
        const step = (dir) => {
            const n = this.items.length;
            for (let k = 1; k <= n; k++) {
                let next = this.index + dir * k;
                if (this.opts.wrap) next = ((next % n) + n) % n;
                else if (next < 0 || next >= n) return false;
                if (!this.items[next].disabled) { this.index = next; return true; }
            }
            return false;
        };

        let action = null;
        if ((input.state.down.pressed || (down && this.repeatT === 0)) && step(1)) {
            audio.play('ui_move'); this.repeatT = input.state.down.pressed ? 320 : 110; action = 'move';
        } else if ((input.state.up.pressed || (up && this.repeatT === 0)) && step(-1)) {
            audio.play('ui_move'); this.repeatT = input.state.up.pressed ? 320 : 110; action = 'move';
        }
        if (!down && !up) this.repeatT = 0;

        if (input.state.a.pressed || input.state.start.pressed) {
            if (this.current && !this.current.disabled) { audio.play('ui_confirm'); return 'confirm'; }
            audio.play('ui_deny');
        }
        if (input.state.b.pressed) { audio.play('ui_back'); return 'back'; }
        return action;
    }

    /** Desenho padrão em coluna. `x` é o centro. */
    draw(px, font, sprites, x, y, opts = {}) {
        const lineH = opts.lineH || 18;
        const t = opts.time || 0;
        this.items.forEach((it, i) => {
            const active = i === this.index;
            const iy = y + i * lineH;
            const color = it.disabled ? 'n' : active ? 'A' : 'q';
            font.text(px.ctx, it.label, x, iy, {
                color, align: 'center', mono: true, shadow: '0'
            });
            if (active && !it.disabled) {
                const bob = Math.round(Math.sin(t * 8) * 1.5);
                const half = font.measure(it.label, { mono: true }) / 2;
                px.blitScreen(sprites.get('cursor'), x - half - 12 + bob, iy + 4);
            }
        });

        const cur = this.current;
        if (cur && cur.hint && opts.hintY != null) {
            panel(px, 18, opts.hintY, W - 36, 22, { fill: '1', border: 'n' });
            font.text(px.ctx, cur.hint, W / 2, opts.hintY + 7, {
                color: 'p', align: 'center', mono: true
            });
        }
    }
}

/**
 * Véu escuro sobre o cenário.
 * Os fundos são propositalmente carregados — pôr do sol ditherizado, skyline com janelas
 * acesas, grade neon. Texto direto por cima disso fica ilegível, então toda tela de menu
 * assenta o conteúdo sobre este véu.
 */
export function scrim(px, y, h, alpha = 0.62) {
    px.ctx.globalAlpha = alpha;
    px.rect(0, y, W, h, SVC['0']);
    px.ctx.globalAlpha = 1;
}

/** Barra de título usada no topo das telas de menu. */
export function screenHeader(px, font, title, subtitle) {
    px.rect(0, 0, W, 30, SVC['0']);
    px.rect(0, 30, W, 1, SVC['x']);
    font.textBig(px.ctx, title, W / 2, 6, { scale: 2, color: 'A', outlineColor: '0', align: 'center' });
    if (subtitle) font.text(px.ctx, subtitle, W / 2, 24, { color: 'p', align: 'center', mono: true });
}

/** Rodapé de ajuda com os botões disponíveis. */
export function screenFooter(px, font, text) {
    px.rect(0, 210, W, 14, SVC['0']);
    px.rect(0, 210, W, 1, SVC['m']);
    font.text(px.ctx, text, W / 2, 214, { color: 'o', align: 'center', mono: true });
}
