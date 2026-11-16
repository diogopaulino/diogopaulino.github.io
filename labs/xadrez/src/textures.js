/**
 * Texturas PBR — madeira, marfim, ébano, feltro e latão para Babylon.js.
 * Marchetaria procedural determinística (anéis de crescimento, fibras e poros),
 * madeira fotografada para moldura e mesa, e os mapas originais das peças
 * escaneadas (normal + ORM) de onde também sai o albedo de cada cor.
 */

function canvas(w, h = w) {
    const el = document.createElement('canvas');
    el.width = w;
    el.height = h;
    return el;
}

function ctx2d(el) {
    return el.getContext('2d', { willReadFrequently: true });
}

function rng(seed = 1) {
    let s = seed >>> 0;
    return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

function toBabylonTexture(el, scene, { uScale = 1, vScale = 1 } = {}) {
    const BABYLON = window.BABYLON;
    if (!BABYLON) return null;
    // Upload direto: evita codificar e decodificar dezenas de PNGs no boot.
    const tex = new BABYLON.DynamicTexture('surface', el, scene, true,
        BABYLON.Texture.TRILINEAR_SAMPLINGMODE);
    tex.update(false);
    tex.uScale = uScale;
    tex.vScale = vScale;
    tex.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
    tex.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
    return tex;
}

function heightToNormal(srcCtx, w, h, strength = 2.2) {
    const src = srcCtx.getImageData(0, 0, w, h).data;
    const out = canvas(w, h);
    const ctx = ctx2d(out);
    const img = ctx.createImageData(w, h);
    const d = img.data;
    const lum = (x, y) => {
        const i = (((y + h) % h) * w + ((x + w) % w)) * 4;
        return (src[i] * 0.299 + src[i + 1] * 0.587 + src[i + 2] * 0.114) / 255;
    };
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const dx = (lum(x + 1, y) - lum(x - 1, y)) * strength;
            const dy = (lum(x, y + 1) - lum(x, y - 1)) * strength;
            const len = Math.hypot(dx, dy, 1) || 1;
            const i = (y * w + x) * 4;
            d[i] = ((-dx / len) * 0.5 + 0.5) * 255;
            d[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
            d[i + 2] = (1 / len) * 0.5 * 255 + 128;
            d[i + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);
    return out;
}

function roughnessFrom(srcCtx, w, h, base = 0.35, contrast = 0.25) {
    const src = srcCtx.getImageData(0, 0, w, h).data;
    const out = canvas(w, h);
    const ctx = ctx2d(out);
    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let i = 0; i < src.length; i += 4) {
        const v = (src[i] + src[i + 1] + src[i + 2]) / (3 * 255);
        const r = Math.max(0, Math.min(1, base + (v - 0.5) * contrast));
        d[i] = d[i + 1] = d[i + 2] = r * 255;
        d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return out;
}

function pack(scene, draw, { w = 512, strength = 1.8, roughBase = 0.32, roughContrast = 0.22, repeat = [1, 1], roughness = false } = {}) {
    const el = canvas(w);
    const ctx = ctx2d(el);
    draw(ctx, w);
    const n = heightToNormal(ctx, w, w, strength);
    const r = roughness ? roughnessFrom(ctx, w, w, roughBase, roughContrast) : null;
    const maps = {
        map: toBabylonTexture(el, scene, { uScale: repeat[0], vScale: repeat[1] }),
        normalMap: toBabylonTexture(n, scene, { uScale: repeat[0], vScale: repeat[1] }),
        roughnessMap: r ? toBabylonTexture(r, scene, { uScale: repeat[0], vScale: repeat[1] }) : null
    };
    maps.normalMap.gammaSpace = false;
    maps.normalMap.level = 0.2;
    if (maps.roughnessMap) maps.roughnessMap.gammaSpace = false;
    return maps;
}

/** Ruído de valor 2D determinístico, com período opcional em x (veio tileável). */
function makeNoise(seed) {
    const perm = new Uint8Array(512);
    const rand = rng(seed);
    for (let i = 0; i < 256; i++) perm[i] = i;
    for (let i = 255; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
    const h = (x, y) => perm[(perm[x & 255] + y) & 255] / 255;
    return (x, y) => {
        const xi = Math.floor(x), yi = Math.floor(y);
        const xf = x - xi, yf = y - yi;
        const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
        const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
        return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
}

/**
 * Lâmina de madeira: o veio corre no eixo x do canvas.
 *   anel  = v·rings + fbm(u, v)·warp        (anéis de crescimento ondulados)
 *   tom   = mix(lenho tardio, lenho inicial, serra(anel)^sharp)
 *   fibra = ruído muito esticado ao longo do veio; poros = traços escuros curtos
 * `figure` adiciona o "chatoyance" transversal do bordo (tiger maple suave).
 */
function veneer(ctx, w, { seed, early, late, rings = 9, warp = 1.4, sharp = 1.6, fiber = 0.05, pores = 0.5, figure = 0 }) {
    const n = makeNoise(seed), n2 = makeNoise(seed + 17);
    const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    const a = rgb(early), b = rgb(late);
    const image = ctx.createImageData(w, w);
    const d = image.data;
    const rand = rng(seed * 7 + 3);
    for (let y = 0; y < w; y++) {
        const v = y / w;
        for (let x = 0; x < w; x++) {
            const u = x / w;
            const wobble = n(u * 2.2, v * 3.1) * 0.6 + n(u * 5.3 + 9, v * 7.7) * 0.28 + n2(u * 1.1, v * 14) * 0.12;
            const ring = v * rings + wobble * warp;
            const saw = ring - Math.floor(ring);
            // Transição suave no lenho inicial e borda nítida no lenho tardio.
            const band = Math.pow(saw, sharp) * (1 - Math.pow(saw, 14));
            const fib = (n(u * 6, v * 260) - 0.5) * fiber * 2 + (n2(u * 22, v * 620) - 0.5) * fiber;
            const fig = figure ? Math.sin(u * 46 + n2(u * 3, v * 5) * 5) * figure * (0.5 + n(u * 2, v * 2) * 0.5) : 0;
            let k = 0.34 + band * 0.52 + fib + fig + (n2(u * 1.3, v * 1.7) - 0.5) * 0.16;
            // Poros: aparecem no lenho inicial, alongados no sentido do veio.
            const pore = pores && n(u * 34, v * 900) > 0.86 - band * 0.1 && n2(u * 9, v * 240) > 0.5 ? pores : 0;
            k = Math.max(0, Math.min(1, k)) * (1 - pore * 0.32);
            const i = (y * w + x) * 4;
            const grainNoise = (rand() - 0.5) * 2.2;
            for (let c = 0; c < 3; c++) d[i + c] = b[c] + (a[c] - b[c]) * k + grainNoise;
            d[i + 3] = 255;
        }
    }
    ctx.putImageData(image, 0, 0);
}

/** Disco radial macio (alfa) para a sombra de contato sob cada peça. */
function contactTexture(scene) {
    const el = canvas(128), ctx = ctx2d(el);
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(0,0,0,0.92)');
    g.addColorStop(0.42, 'rgba(0,0,0,0.78)');
    g.addColorStop(0.7, 'rgba(0,0,0,0.3)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    const tex = new window.BABYLON.DynamicTexture('contact_shadow', el, scene, true);
    tex.hasAlpha = true; tex.update(false);
    return tex;
}

const PIECE_KINDS = ['k', 'q', 'r', 'b', 'n', 'p'];
/** Cores-base lineares aproximadas, em sRGB 0–255: buxo/marfim, ébano e latão. */
const PIECE_TONES = {
    w: { base: [226, 204, 162], vein: [198, 170, 124], brass: [203, 160, 82] },
    b: { base: [34, 26, 22], vein: [58, 42, 33], brass: [176, 134, 66] }
};

/**
 * Mapas das peças escaneadas. O ORM original (R = oclusão, G = rugosidade,
 * B = metal) marca as guarnições metálicas; o albedo de cada cor é derivado
 * dele: mix(madeira com veio fino, latão, metal). Resolve quando tudo carregou.
 */
function loadPieceMaps(scene) {
    const B = window.BABYLON;
    const maps = {};
    const jobs = PIECE_KINDS.map(kind => new Promise((resolve) => {
        const url = name => new URL(`../assets/pieces/${kind}-${name}.jpg`, import.meta.url).href;
        // invertY = false: as UVs vêm do glTF (origem no canto superior esquerdo).
        const normal = new B.Texture(url('normal'), scene, false, false, B.Texture.TRILINEAR_SAMPLINGMODE);
        normal.gammaSpace = false;
        normal.anisotropicFilteringLevel = 4;
        const entry = maps[kind] = { normal, orm: null, albedo: {} };
        const img = new Image();
        img.onload = () => {
            const size = img.naturalWidth;
            const src = canvas(size), sctx = ctx2d(src);
            sctx.drawImage(img, 0, 0);
            const orm = sctx.getImageData(0, 0, size, size).data;
            entry.orm = new B.DynamicTexture(`orm_${kind}`, src, scene, true, B.Texture.TRILINEAR_SAMPLINGMODE);
            entry.orm.update(false); entry.orm.gammaSpace = false;
            const noise = makeNoise(kind.charCodeAt(0));
            for (const color of ['w', 'b']) {
                const tone = PIECE_TONES[color];
                const el = canvas(size), ctx = ctx2d(el);
                const out = ctx.createImageData(size, size), d = out.data;
                for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
                    const i = (y * size + x) * 4;
                    const metal = Math.min(1, Math.max(0, (orm[i + 2] - 70) / 120));
                    const g = noise(x / size * 5, y / size * 70) * 0.7 + noise(x / size * 19, y / size * 230) * 0.3;
                    for (let c = 0; c < 3; c++) {
                        const wood = tone.vein[c] + (tone.base[c] - tone.vein[c]) * (0.25 + g * 0.75);
                        d[i + c] = wood + (tone.brass[c] - wood) * metal;
                    }
                    d[i + 3] = 255;
                }
                ctx.putImageData(out, 0, 0);
                entry.albedo[color] = new B.DynamicTexture(`albedo_${kind}_${color}`, el, scene, true, B.Texture.TRILINEAR_SAMPLINGMODE);
                entry.albedo[color].update(false);
            }
            resolve();
        };
        img.onerror = () => resolve();
        img.src = url('orm');
    }));
    return { maps, ready: Promise.all(jobs) };
}

export function createTextures(scene) {
    // Bordo (casas claras) e nogueira (casas escuras): 1024 px, cada casa usa
    // uma janela própria da lâmina (ver world.js), como numa marchetaria real.
    const maple = pack(scene, (ctx, w) => veneer(ctx, w, {
        seed: 11, early: '#ecd9b2', late: '#c9a874', rings: 7, warp: 1.1, sharp: 1.3, fiber: 0.035, pores: 0.18, figure: 0.045
    }), { w: 1024, strength: 0.7 });

    const walnut = pack(scene, (ctx, w) => veneer(ctx, w, {
        seed: 29, early: '#7a5236', late: '#3b2417', rings: 10, warp: 1.9, sharp: 1.9, fiber: 0.06, pores: 0.6
    }), { w: 1024, strength: 0.9 });
    for (const set of [maple, walnut]) {
        set.map.anisotropicFilteringLevel = 8;
        set.normalMap.anisotropicFilteringLevel = 8;
        set.normalMap.level = 0.35;
    }

    const felt = pack(scene, (ctx, w) => {
        const rand = rng(7);
        ctx.fillStyle = '#85817a';
        ctx.fillRect(0, 0, w, w);
        const img = ctx.getImageData(0, 0, w, w);
        const d = img.data;
        for (let i = 0; i < d.length; i += 4) {
            const noise = (rand() - 0.5) * 46;
            d[i] = Math.max(0, Math.min(255, d[i] + noise));
            d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + noise));
            d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + noise));
        }
        ctx.putImageData(img, 0, 0);
    }, { w: 256, repeat: [6, 6], roughBase: 0.95, strength: 1.4 });
    felt.normalMap.level = 0.6;

    const photographed = {
        map: new window.BABYLON.Texture(new URL('../assets/wood.jpg', import.meta.url).href, scene),
        normalMap: new window.BABYLON.Texture(new URL('../assets/wood-normal.jpg', import.meta.url).href, scene)
    };
    photographed.map.anisotropicFilteringLevel = 8;
    photographed.normalMap.gammaSpace = false;
    photographed.normalMap.level = 0.45;
    const pieces = loadPieceMaps(scene);
    return { maple, walnut, mahogany: photographed, felt, contact: contactTexture(scene), pieces: pieces.maps, piecesReady: pieces.ready };
}
