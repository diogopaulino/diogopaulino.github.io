// core/sprites.js — bake de string-art em canvases offscreen + atlas packer (shelf packing).
// Teto: ~280 linhas.

/**
 * Transforma um array de strings (linhas) + mapa de paleta num canvas offscreen.
 * rows: array de strings de MESMO comprimento. pal: { char -> cor css | null (transparente) }.
 * Lança erro se as linhas não tiverem comprimento uniforme — evita corrupção silenciosa.
 */
export function bake(rows, pal, scale = 1, name = '(sem nome)') {
    const w = rows[0].length;
    for (let i = 1; i < rows.length; i++) {
        if (rows[i].length !== w) {
            throw new Error(`sprites.bake: linha ${i} do sprite "${name}" tem ${rows[i].length} chars, esperado ${w}`);
        }
    }
    const h = rows.length;
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, w * scale);
    cv.height = Math.max(1, h * scale);
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    for (let y = 0; y < h; y++) {
        const row = rows[y];
        for (let x = 0; x < w; x++) {
            const ch = row[x];
            const col = pal[ch];
            let run = 1;
            while (x + run < w && row[x + run] === ch) run++;
            if (col) {
                g.fillStyle = col;
                g.fillRect(x * scale, y * scale, run * scale, scale);
            }
            x += run - 1;
        }
    }
    return cv;
}

/** Bake espelhado horizontalmente (para variantes "flip" pré-computadas). */
export function bakeFlip(rows, pal, scale = 1, name = '(sem nome)') {
    const flipped = rows.map((r) => r.split('').reverse().join(''));
    return bake(flipped, pal, scale, name + '#flip');
}

/**
 * Bake com substituição de cores (recolor) — permite gerar variantes (camisas, times)
 * sem re-autorar o desenho. swaps: { charOrigem -> charDestino }.
 */
export function bakeRecolor(rows, pal, swaps, scale = 1, name = '(sem nome)') {
    const pal2 = { ...pal };
    for (const from in swaps) pal2[from] = pal[swaps[from]] ?? pal2[from];
    return bake(rows, pal2, scale, name + '#recolor');
}

/**
 * Shelf packer simples: recebe uma lista de { name, canvas } e devolve um atlas único
 * { canvas, index: { name: {x,y,w,h} } }. Ordena por altura decrescente para melhor empacotamento.
 */
export function pack(defs, maxWidth = 512) {
    const sorted = [...defs].sort((a, b) => b.canvas.height - a.canvas.height);
    let x = 0, y = 0, shelfH = 0, atlasW = maxWidth, atlasH = 0;
    const placements = [];

    for (const def of sorted) {
        const w = def.canvas.width, h = def.canvas.height;
        if (x + w > atlasW) { x = 0; y += shelfH + 1; shelfH = 0; }
        placements.push({ def, x, y, w, h });
        x += w + 1;
        shelfH = Math.max(shelfH, h);
        atlasH = Math.max(atlasH, y + shelfH);
    }

    const atlas = document.createElement('canvas');
    atlas.width = atlasW;
    atlas.height = Math.max(1, atlasH);
    const g = atlas.getContext('2d');
    g.imageSmoothingEnabled = false;

    const index = {};
    for (const p of placements) {
        g.drawImage(p.def.canvas, p.x, p.y);
        index[p.def.name] = { x: p.x, y: p.y, w: p.w, h: p.h };
    }
    return { canvas: atlas, index };
}

/**
 * Registro de sprites: agrupa bakes em atlases nomeados por grupo (chars/props/city/ui/map).
 * Uso: const reg = new SpriteRegistry(); reg.add('chars', 'gaivota', rows, pal, {ox,oy});
 * reg.build() -> monta os atlases; reg.get('gaivota') -> Sprite pronto pra blit.
 */
export class SpriteRegistry {
    constructor() {
        this.groups = new Map(); // group -> [{name, canvas, ox, oy}]
        this.sprites = new Map(); // name -> Sprite (após build)
        this.atlases = new Map(); // group -> canvas
    }

    add(group, name, rows, pal, opts = {}) {
        const scale = opts.scale || 1;
        const canvas = bake(rows, pal, scale, name);
        this._push(group, name, canvas, opts);
        if (opts.flip) {
            const fc = bakeFlip(rows, pal, scale, name);
            this._push(group, name + '_flip', fc, opts);
        }
        return this;
    }

    addRecolor(group, name, rows, pal, swaps, opts = {}) {
        const scale = opts.scale || 1;
        const canvas = bakeRecolor(rows, pal, swaps, scale, name);
        this._push(group, name, canvas, opts);
        return this;
    }

    addRaw(group, name, canvas, opts = {}) {
        this._push(group, name, canvas, opts);
        return this;
    }

    /** Registra uma tira de animação a partir de uma função geradora de frames. */
    addStrip(group, name, frameCount, genFrame, opts = {}) {
        for (let i = 0; i < frameCount; i++) {
            const { rows, pal } = genFrame(i);
            this.add(group, `${name}#${i}`, rows, pal, opts);
        }
        return this;
    }

    _push(group, name, canvas, opts) {
        if (!this.groups.has(group)) this.groups.set(group, []);
        this.groups.get(group).push({
            name, canvas,
            ox: opts.ox ?? Math.floor(canvas.width / 2),
            oy: opts.oy ?? canvas.height
        });
    }

    build() {
        for (const [group, defs] of this.groups) {
            const { canvas, index } = pack(defs.map((d) => ({ name: d.name, canvas: d.canvas })), 512);
            this.atlases.set(group, canvas);
            for (const d of defs) {
                const pos = index[d.name];
                this.sprites.set(d.name, {
                    atlas: canvas, x: pos.x, y: pos.y, w: pos.w, h: pos.h,
                    ox: d.ox, oy: d.oy, group
                });
            }
        }
        return this;
    }

    get(name) {
        const s = this.sprites.get(name);
        if (!s) throw new Error(`SpriteRegistry: sprite "${name}" não encontrado`);
        return s;
    }

    has(name) { return this.sprites.has(name); }

    frame(name, index) { return this.get(`${name}#${index}`); }

    frameCount(name) {
        let n = 0;
        while (this.sprites.has(`${name}#${n}`)) n++;
        return n;
    }

    /** Devolve o frame animado dado um tempo (s) e fps. */
    anim(name, t, fps = 8) {
        const n = this.frameCount(name);
        if (n === 0) return this.get(name);
        const idx = Math.floor(t * fps) % n;
        return this.frame(name, idx);
    }

    /** ?debug=atlas — desenha todos os atlases com rótulos numa cena de depuração. */
    debugDraw(ctx, font) {
        let ox = 4, oy = 4, rowH = 0;
        for (const [group, canvas] of this.atlases) {
            if (font) font.text(ctx, group, ox, oy, { color: 'A', mono: true });
            oy += 10;
            ctx.drawImage(canvas, ox, oy);
            rowH = canvas.height;
            oy += rowH + 12;
        }
    }
}
