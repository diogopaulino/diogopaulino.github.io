/* =========================================================
   Image Editor — edição não destrutiva no navegador
   ---------------------------------------------------------
   O documento é só um objeto de parâmetros (state). A imagem original
   nunca é alterada: toda renderização recompõe a partir dela. Por isso o
   desfazer é "ilimitado" (até 300 passos) e custa bytes, não megapixels.

   Ajustes (equivalentes fotográficos):
     exposição  e ∈ [−100,100] → brightness(2^(e/100))  (±1 stop)
     contraste  c ∈ [−100,100] → contrast(1 + 0,8·c/100)
     saturação  s ∈ [−100,100] → saturate(1 + s/100)
     matiz      h ∈ [−180,180] → hue-rotate(h°)
     temperatura t             → camada laranja/azul em soft-light, α = |t|/100·0,45
     nitidez    n ∈ [0,100]    → convolução 3×3 (máscara de nitidez),
                                 k = n/100: [0 −k 0; −k 1+4k −k; 0 −k 0]
     vinheta    v ∈ [0,100]    → gradiente radial preto, α = 0,7·v/100
     desfoque   b px           → blur(b·escala) (proporcional à resolução)
   Intensidade do filtro: o quadro filtrado é desenhado por cima do quadro
   sem filtro com globalAlpha = intensidade.
   Corte: retângulo normalizado (0..1) no espaço JÁ girado/espelhado;
   girar/espelhar transforma o retângulo junto, então o corte acompanha.
   Prévia: no máximo 1600 px no lado maior (fluida ao arrastar); exportar
   recompõe na resolução original pelo MESMO pipeline (o que se vê é o que
   se salva), limitado a 16,7 MP (teto de canvas do Safari iOS).
   ========================================================= */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const editor = $('#editor');
const fileInput = $('#fileInput');
const uploadPlaceholder = $('#uploadPlaceholder');
const uploadError = $('#uploadError');
const previewArea = $('#previewArea');
const stage = $('#stage');
const canvas = $('#canvas');
// Tela visível fica na GPU (filtros CSS rápidos). Efeitos por pixel rodam numa
// tela de CPU (willReadFrequently) e o resultado é copiado para a visível.
const ctx = canvas.getContext('2d');
const cpuCanvas = document.createElement('canvas');
const cpuCtx = cpuCanvas.getContext('2d', { willReadFrequently: true });
const controlsArea = $('#controlsArea');
const filtersFilmstrip = $('#filtersFilmstrip');
const loadingVeil = $('#loadingVeil');
const dimsBadge = $('#imageDimensionsBadge');
const compareFlag = $('#compareFlag');
const toastEl = $('#toast');
const cropOverlay = $('#cropOverlay');
const cropRectEl = $('#cropRect');

const MAX_PREVIEW_DIM = 1600;
const MAX_EXPORT_AREA = 16777216;
const THUMB_SIZE = 140;
const HISTORY_LIMIT = 300;

const ADJUST_KEYS = ['exposure', 'contrast', 'saturation', 'warmth', 'hue', 'sharpen', 'vignette', 'blur'];
const sliderEls = Object.fromEntries(ADJUST_KEYS.concat('intensity').map((k) => [k, document.getElementById(k)]));

const FULL_CROP = Object.freeze({ x: 0, y: 0, w: 1, h: 1 });
const defaultState = () => ({
    exposure: 0,
    contrast: 0,
    saturation: 0,
    warmth: 0,
    hue: 0,
    sharpen: 0,
    vignette: 0,
    blur: 0,
    filter: 'none',
    intensity: 100,
    rotate: 0,
    flipH: 1,
    flipV: 1,
    crop: { ...FULL_CROP }
});
const clone = (s) => ({ ...s, crop: { ...s.crop } });
const sameState = (a, b) => JSON.stringify(a) === JSON.stringify(b);

let originalImage = null;
let previewScale = 1;
let state = defaultState();
let committed = clone(state);
const past = [];
const future = [];
let isComparing = false;
let rafPending = false;
let interactive = false; // arrastando um controle: prévia em meia resolução se pesada
let cropMode = false;
let pendingCrop = { ...FULL_CROP };
let aspect = 'free';
const view = { zoom: 1, x: 0, y: 0, fit: 1, disp: 1 };
const filterButtons = {};

/* ---------------------------------------------------------------------------
   Pixel-level effects (operate directly on ImageData for looks a plain CSS
   filter can't produce: duotone mapping, posterization, RGB-shift glitch,
   edge-detected sketch, and mosaic pixelation).
--------------------------------------------------------------------------- */

function duotonePixel(imageData) {
    const d = imageData.data;
    const shadow = [24, 22, 60];
    const highlight = [255, 120, 150];
    for (let i = 0; i < d.length; i += 4) {
        const lum = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) / 255;
        d[i] = shadow[0] + (highlight[0] - shadow[0]) * lum;
        d[i + 1] = shadow[1] + (highlight[1] - shadow[1]) * lum;
        d[i + 2] = shadow[2] + (highlight[2] - shadow[2]) * lum;
    }
}

function posterizePixel(imageData) {
    const d = imageData.data;
    const levels = 4;
    const step = 255 / (levels - 1);
    for (let i = 0; i < d.length; i += 4) {
        d[i] = Math.round(Math.round(d[i] / step) * step);
        d[i + 1] = Math.round(Math.round(d[i + 1] / step) * step);
        d[i + 2] = Math.round(Math.round(d[i + 2] / step) * step);
    }
}

function glitchPixel(imageData) {
    const { data, width, height } = imageData;
    const src = data.slice();
    const bandHeight = Math.max(3, Math.round(height / 45));

    for (let bandStart = 0; bandStart < height; bandStart += bandHeight) {
        const bandIndex = Math.floor(bandStart / bandHeight);
        const wobble = Math.sin(bandIndex * 12.9898) * 43758.5453;
        const rand = wobble - Math.floor(wobble);
        const shift = Math.round((rand - 0.5) * (width * 0.04));
        const bandEnd = Math.min(height, bandStart + bandHeight);

        for (let y = bandStart; y < bandEnd; y++) {
            const darken = (y % 3 === 0) ? 0.85 : 1;
            const row = y * width;
            for (let x = 0; x < width; x++) {
                const idx = (row + x) * 4;
                const rx = Math.min(width - 1, Math.max(0, x - shift));
                const bx = Math.min(width - 1, Math.max(0, x + shift));
                data[idx] = src[(row + rx) * 4] * darken;
                data[idx + 1] = src[idx + 1] * darken;
                data[idx + 2] = src[(row + bx) * 4 + 2] * darken;
            }
        }
    }
}

function sketchPixel(imageData) {
    const { data, width, height } = imageData;
    const gray = new Float32Array(width * height);
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
        gray[p] = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    }

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const p = y * width + x;
            let gx = 0;
            let gy = 0;
            if (x > 0 && x < width - 1 && y > 0 && y < height - 1) {
                const tl = gray[p - width - 1], t = gray[p - width], tr = gray[p - width + 1];
                const l = gray[p - 1], r = gray[p + 1];
                const bl = gray[p + width - 1], b = gray[p + width], br = gray[p + width + 1];
                gx = (tr + 2 * r + br) - (tl + 2 * l + bl);
                gy = (bl + 2 * b + br) - (tl + 2 * t + tr);
            }
            const edge = Math.sqrt(gx * gx + gy * gy);
            const value = Math.max(0, Math.min(255, 255 - edge * 1.2));
            const idx = p * 4;
            data[idx] = data[idx + 1] = data[idx + 2] = value;
        }
    }
}

function pixelateMosaic(imageData) {
    const { data, width, height } = imageData;
    const blockSize = Math.max(4, Math.round(Math.min(width, height) / 45));

    for (let by = 0; by < height; by += blockSize) {
        for (let bx = 0; bx < width; bx += blockSize) {
            let r = 0, g = 0, b = 0, a = 0, count = 0;
            const yEnd = Math.min(height, by + blockSize);
            const xEnd = Math.min(width, bx + blockSize);
            for (let y = by; y < yEnd; y++) {
                for (let x = bx; x < xEnd; x++) {
                    const idx = (y * width + x) * 4;
                    r += data[idx]; g += data[idx + 1]; b += data[idx + 2]; a += data[idx + 3];
                    count++;
                }
            }
            r /= count; g /= count; b /= count; a /= count;
            for (let y = by; y < yEnd; y++) {
                for (let x = bx; x < xEnd; x++) {
                    const idx = (y * width + x) * 4;
                    data[idx] = r; data[idx + 1] = g; data[idx + 2] = b; data[idx + 3] = a;
                }
            }
        }
    }
}

/** Máscara de nitidez 3×3 (cruz). Lê de uma cópia para não reusar pixels já afiados. */
function sharpenPixel(imageData, amount) {
    const { data, width, height } = imageData;
    const src = new Uint8ClampedArray(data);
    const k = amount;
    const c = 1 + 4 * k;
    const row = width * 4;
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const i = y * row + x * 4;
            for (let ch = 0; ch < 3; ch++) {
                const j = i + ch;
                data[j] = c * src[j] - k * (src[j - 4] + src[j + 4] + src[j - row] + src[j + row]);
            }
        }
    }
}

/* ---------------------------------------------------------------------------
   Overlays. `frameOverlay` runs *inside* the rotated/flipped canvas space
   (so borders/stamps travel with the photo, like a real print). `postOverlay`
   runs after the transform is restored, in plain top-left canvas space (so
   vignettes always stay centered on the final view regardless of rotation).
--------------------------------------------------------------------------- */

function vignetteOverlay(strength) {
    return (context, w, h) => {
        const grad = context.createRadialGradient(
            w / 2, h / 2, Math.min(w, h) * 0.25,
            w / 2, h / 2, Math.max(w, h) * 0.72
        );
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, `rgba(0,0,0,${strength})`);
        context.save();
        context.fillStyle = grad;
        context.fillRect(0, 0, w, h);
        context.restore();
    };
}

function whiteWashOverlay(strength) {
    return (context, w, h) => {
        context.save();
        context.fillStyle = `rgba(255,255,255,${strength})`;
        context.fillRect(0, 0, w, h);
        context.restore();
    };
}

function retro80sFrame(context, w, h) {
    const borderSize = Math.min(w, h) * 0.05;
    context.lineWidth = borderSize;
    context.strokeStyle = '#f0f0f0';
    context.strokeRect((-w / 2) + (borderSize / 2), (-h / 2) + (borderSize / 2), w - borderSize, h - borderSize);

    const fontSize = Math.min(w, h) * 0.05;
    context.font = `bold ${fontSize}px "Courier New", monospace`;
    context.fillStyle = '#ff9933';
    context.shadowColor = '#ff3300';
    context.shadowBlur = 5;

    const date = "'87 5 24";
    const padding = borderSize * 1.5;
    context.textAlign = 'right';
    context.textBaseline = 'bottom';
    context.fillText(date, (w / 2) - padding, (h / 2) - padding);
}

/* ---------------------------------------------------------------------------
   Filter registry. `css` feeds ctx.filter alongside the live adjustments
   (cheap, GPU-accelerated). `pixel` and the overlays are extra passes for
   looks CSS filters can't express.
--------------------------------------------------------------------------- */
const FILTER_DEFS = {
    none: { label: 'Original', css: '' },
    mono: { label: 'Mono', css: 'grayscale(100%)' },
    noir: { label: 'Noir', css: 'grayscale(100%) contrast(150%) brightness(92%)', postOverlay: vignetteOverlay(0.55) },
    sepia: { label: 'Sépia', css: 'sepia(100%)' },
    invert: { label: 'Invertido', css: 'invert(100%)' },
    fade: { label: 'Fade', css: 'contrast(88%) saturate(82%) brightness(108%)', postOverlay: whiteWashOverlay(0.12) },
    vintage: { label: 'Vintage', css: 'sepia(50%) contrast(120%) brightness(90%)' },
    kodachrome: { label: 'Kodachrome', css: 'sepia(30%) contrast(120%) saturate(130%)' },
    technicolor: { label: 'Technicolor', css: 'contrast(150%) saturate(150%) hue-rotate(-10deg)' },
    polaroid: { label: 'Polaroid', css: 'sepia(20%) brightness(110%) contrast(90%) saturate(80%)' },
    retro80s: { label: 'Retrô 80s', css: 'sepia(40%) contrast(120%) brightness(110%) saturate(150%)', frameOverlay: retro80sFrame },
    clarendon: { label: 'Clarendon', css: 'contrast(120%) saturate(125%) brightness(105%)' },
    gingham: { label: 'Gingham', css: 'brightness(105%) sepia(20%) hue-rotate(-8deg) saturate(90%)' },
    lofi: { label: 'Lo-Fi', css: 'saturate(180%) contrast(150%)' },
    vignette: { label: 'Vinheta', css: 'saturate(110%)', postOverlay: vignetteOverlay(0.45) },
    duotone: { label: 'Duotone', pixel: duotonePixel },
    popart: { label: 'Pop Art', css: 'saturate(200%) contrast(120%)', pixel: posterizePixel },
    glitch: { label: 'Glitch', css: 'contrast(110%) saturate(130%)', pixel: glitchPixel },
    sketch: { label: 'Esboço', pixel: sketchPixel },
    pixelart: { label: 'Pixel Art', pixel: pixelateMosaic }
};

/* ---------------------------------------------------------------------------
   Pipeline de renderização (independente de resolução via `scale`).
--------------------------------------------------------------------------- */
function orientedSize(img, scale, rotate) {
    const r = (rotate * Math.PI) / 180;
    const s = Math.abs(Math.sin(r));
    const c = Math.abs(Math.cos(r));
    const iw = img.width * scale;
    const ih = img.height * scale;
    return { W: Math.max(1, Math.round(iw * c + ih * s)), H: Math.max(1, Math.round(iw * s + ih * c)), iw, ih };
}

function adjustmentCss(o) {
    const parts = [];
    if (o.exposure) parts.push(`brightness(${Math.pow(2, o.exposure / 100).toFixed(4)})`);
    if (o.contrast) parts.push(`contrast(${(1 + (0.8 * o.contrast) / 100).toFixed(4)})`);
    if (o.saturation) parts.push(`saturate(${(1 + o.saturation / 100).toFixed(4)})`);
    if (o.hue) parts.push(`hue-rotate(${o.hue}deg)`);
    if (o.blur > 0) parts.push(`blur(${(o.blur * o.scale).toFixed(2)}px)`);
    return parts.join(' ');
}

let scratch = null;
function scratchCanvas() {
    if (!scratch) scratch = document.createElement('canvas');
    return scratch;
}

function composeFrame(context, canvasEl, image, o) {
    const def = FILTER_DEFS[o.filter] || FILTER_DEFS.none;

    // Intensidade < 100%: quadro sem filtro + quadro filtrado por cima.
    if (o.filter !== 'none' && o.intensity < 100) {
        const tmp = o.tmpCanvas || scratchCanvas();
        composeFrame(tmp.getContext('2d', { willReadFrequently: true }), tmp, image, { ...o, intensity: 100, tmpCanvas: null });
        composeFrame(context, canvasEl, image, { ...o, filter: 'none' });
        if (o.intensity > 0) {
            context.save();
            context.globalAlpha = o.intensity / 100;
            context.drawImage(tmp, 0, 0);
            context.restore();
        }
        return;
    }

    const { W, H, iw, ih } = orientedSize(image, o.scale, o.rotate);
    const crop = o.ignoreCrop ? FULL_CROP : o.crop;
    const cx = Math.round(crop.x * W);
    const cy = Math.round(crop.y * H);
    const cw = Math.max(1, Math.round(crop.w * W));
    const ch = Math.max(1, Math.round(crop.h * H));

    if (canvasEl.width !== cw) canvasEl.width = cw;
    if (canvasEl.height !== ch) canvasEl.height = ch;
    context.clearRect(0, 0, cw, ch);
    if (o.background) {
        context.fillStyle = o.background;
        context.fillRect(0, 0, cw, ch);
    }

    context.save();
    context.translate(-cx + W / 2, -cy + H / 2);
    context.rotate((o.rotate * Math.PI) / 180);
    context.scale(o.flipH, o.flipV);
    const css = `${adjustmentCss(o)} ${def.css || ''}`.trim();
    context.filter = css || 'none';
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, -iw / 2, -ih / 2, iw, ih);
    context.filter = 'none';
    if (def.frameOverlay) def.frameOverlay(context, iw, ih);
    context.restore();

    if (o.warmth) {
        const a = (Math.abs(o.warmth) / 100) * 0.45;
        context.save();
        context.globalCompositeOperation = 'soft-light';
        context.fillStyle = o.warmth > 0 ? `rgba(255,138,36,${a})` : `rgba(36,128,255,${a})`;
        context.fillRect(0, 0, cw, ch);
        context.restore();
    }

    const needsPixels = def.pixel || o.sharpen > 0;
    if (needsPixels) {
        const imgData = context.getImageData(0, 0, cw, ch);
        if (def.pixel) def.pixel(imgData);
        if (o.sharpen > 0) sharpenPixel(imgData, o.sharpen / 100);
        context.putImageData(imgData, 0, 0);
    }

    if (def.postOverlay) def.postOverlay(context, cw, ch);
    if (o.vignette > 0) vignetteOverlay((0.7 * o.vignette) / 100)(context, cw, ch);
}

function renderOptions(overrides = {}) {
    return { ...state, crop: { ...state.crop }, scale: previewScale, ...overrides };
}

function isHeavy(o = state) {
    const def = FILTER_DEFS[o.filter];
    return o.sharpen > 0 || !!(def && def.pixel);
}

function render() {
    if (!originalImage) return;
    try {
        const base = isComparing
            ? renderOptions({ exposure: 0, contrast: 0, saturation: 0, warmth: 0, hue: 0, sharpen: 0, vignette: 0, blur: 0, filter: 'none' })
            : renderOptions();
        // Arrastando controle com efeito pesado: meia resolução para manter 60 fps.
        if (interactive && isHeavy()) base.scale = previewScale * 0.5;
        if (cropMode) base.ignoreCrop = true;
        if (isHeavy(base)) {
            composeFrame(cpuCtx, cpuCanvas, originalImage, base);
            if (canvas.width !== cpuCanvas.width) canvas.width = cpuCanvas.width;
            if (canvas.height !== cpuCanvas.height) canvas.height = cpuCanvas.height;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(cpuCanvas, 0, 0);
        } else {
            composeFrame(ctx, canvas, originalImage, base);
        }
        layout();
    } catch (err) {
        console.warn('Falha ao renderizar:', err);
    }
}

function scheduleRender() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
        rafPending = false;
        render();
    });
}

/* ---------------------------------------------------------------------------
   Layout da prévia (encaixe + zoom + pan). A tela de desenho é posicionada
   à mão dentro do palco; o overlay de corte usa a mesma caixa.
--------------------------------------------------------------------------- */
function stageBox() {
    return { w: stage.clientWidth || 1, h: stage.clientHeight || 1 };
}

function layout() {
    if (!originalImage) return;
    const { w: aw, h: ah } = stageBox();
    const pad = 16;
    // Escala da tela de desenho em relação à prévia "cheia" (meia resolução ao arrastar).
    const full = orientedSize(originalImage, previewScale, state.rotate);
    const crop = cropMode ? FULL_CROP : state.crop;
    const logicalW = full.W * crop.w;
    const logicalH = full.H * crop.h;
    // Encaixe: cabe no palco, sem ampliar além de 100% do original.
    view.fit = Math.min((aw - pad * 2) / logicalW, (ah - pad * 2) / logicalH, 1 / previewScale);
    if (cropMode) {
        view.zoom = 1;
        view.x = 0;
        view.y = 0;
    }
    view.disp = view.fit * view.zoom;
    const dw = logicalW * view.disp;
    const dh = logicalH * view.disp;
    const maxX = Math.max(0, (dw - aw) / 2 + pad);
    const maxY = Math.max(0, (dh - ah) / 2 + pad);
    view.x = Math.max(-maxX, Math.min(maxX, view.x));
    view.y = Math.max(-maxY, Math.min(maxY, view.y));
    const left = (aw - dw) / 2 + view.x;
    const top = (ah - dh) / 2 + view.y;
    canvas.style.width = `${dw}px`;
    canvas.style.height = `${dh}px`;
    canvas.style.transform = `translate(${left}px, ${top}px)`;
    stage.classList.toggle('is-zoomed', view.zoom > 1.001);
    $('#zoomLabel').textContent = `${Math.round(view.disp * previewScale * 100)}%`;
    if (cropMode) positionCropOverlay(left, top, dw, dh);
}

function setZoom(z, clientX, clientY) {
    if (!originalImage || cropMode) return;
    const old = view.zoom;
    // Zoom máximo: 8× o pixel original.
    const maxZoom = Math.max(1, 8 / (view.fit * previewScale));
    const next = Math.max(1, Math.min(maxZoom, z));
    if (Math.abs(next - old) < 1e-4) return;
    const rect = stage.getBoundingClientRect();
    const px = (clientX ?? rect.left + rect.width / 2) - rect.left - rect.width / 2;
    const py = (clientY ?? rect.top + rect.height / 2) - rect.top - rect.height / 2;
    view.x = px - ((px - view.x) * next) / old;
    view.y = py - ((py - view.y) * next) / old;
    view.zoom = next;
    layout();
}

function zoomTo100() {
    if (!originalImage) return;
    setZoom(1 / (view.fit * previewScale));
}

function zoomFit() {
    view.zoom = 1;
    view.x = 0;
    view.y = 0;
    layout();
}

/* ---------------------------------------------------------------------------
   Histórico (desfazer/refazer)
--------------------------------------------------------------------------- */
function commit() {
    if (sameState(state, committed)) return;
    past.push(clone(committed));
    if (past.length > HISTORY_LIMIT) past.shift();
    future.length = 0;
    committed = clone(state);
    updateHistoryButtons();
}

function undo() {
    if (cropMode) cancelCrop();
    if (!sameState(state, committed)) {
        state = clone(committed);
    } else {
        if (!past.length) return;
        future.push(clone(committed));
        committed = past.pop();
        state = clone(committed);
    }
    afterHistoryJump();
}

function redo() {
    if (!future.length) return;
    if (cropMode) cancelCrop();
    past.push(clone(committed));
    committed = future.pop();
    state = clone(committed);
    afterHistoryJump();
}

function afterHistoryJump() {
    syncControls();
    updateHistoryButtons();
    updateDimensionsBadge();
    generateThumbnails();
    scheduleRender();
}

function updateHistoryButtons() {
    $('#undoBtn').disabled = !past.length && sameState(state, committed);
    $('#redoBtn').disabled = !future.length;
}

/* ---------------------------------------------------------------------------
   Controles
--------------------------------------------------------------------------- */
function formatValue(key, v) {
    if (key === 'hue') return `${v}°`;
    if (key === 'blur') return `${v}px`;
    if (key === 'intensity') return `${v}%`;
    if (v > 0 && ['exposure', 'contrast', 'saturation', 'warmth'].includes(key)) return `+${v}`;
    return String(v);
}

function syncControls() {
    Object.entries(sliderEls).forEach(([key, input]) => {
        if (!input) return;
        input.value = String(state[key]);
        const out = input.closest('.slider-group').querySelector('.value');
        out.textContent = formatValue(key, state[key]);
        input.closest('.slider-group').classList.toggle('is-changed', Number(state[key]) !== Number(input.dataset.default));
        // Trilha preenchida a partir do zero (controles bipolares) ou do mínimo.
        const min = Number(input.min);
        const max = Number(input.max);
        const zero = min < 0 ? 0 : min;
        const a = ((Math.min(zero, state[key]) - min) / (max - min)) * 100;
        const b = ((Math.max(zero, state[key]) - min) / (max - min)) * 100;
        input.style.setProperty('--fill-a', `${a}%`);
        input.style.setProperty('--fill-b', `${b}%`);
    });
    Object.entries(filterButtons).forEach(([id, btn]) => {
        const on = id === state.filter;
        btn.classList.toggle('active', on);
        btn.setAttribute('aria-pressed', String(on));
    });
    $('#intensityGroup').classList.toggle('is-disabled', state.filter === 'none');
    sliderEls.intensity.disabled = state.filter === 'none';
}

Object.entries(sliderEls).forEach(([key, input]) => {
    if (!input) return;
    input.addEventListener('input', () => {
        state[key] = Number(input.value);
        interactive = true;
        syncControls();
        updateHistoryButtons();
        scheduleRender();
    });
    const finish = () => {
        if (!interactive) return;
        interactive = false;
        commit();
        scheduleRender();
    };
    input.addEventListener('change', finish);
    input.addEventListener('pointerup', finish);
    input.addEventListener('keyup', finish);
    input.addEventListener('blur', finish);
    const reset = () => {
        state[key] = Number(input.dataset.default);
        syncControls();
        commit();
        scheduleRender();
    };
    input.addEventListener('dblclick', reset);
    input.closest('.slider-group').querySelector('.slider-header').addEventListener('dblclick', reset);
});

/* Tira de filtros com miniaturas da própria foto. */
function buildFiltersUI() {
    filtersFilmstrip.textContent = '';
    Object.entries(FILTER_DEFS).forEach(([id, def]) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'filter-thumb';
        btn.dataset.filter = id;
        btn.setAttribute('aria-pressed', id === 'none' ? 'true' : 'false');
        btn.innerHTML = '<canvas class="thumb-img" aria-hidden="true"></canvas><span class="thumb-label"></span>';
        btn.querySelector('.thumb-label').textContent = def.label;
        btn.addEventListener('click', () => {
            if (state.filter === id) return;
            state.filter = id;
            if (id !== 'none' && state.intensity === 0) state.intensity = 100;
            syncControls();
            commit();
            scheduleRender();
        });
        filtersFilmstrip.appendChild(btn);
        filterButtons[id] = btn;
    });
}

let thumbsTimer = 0;
function generateThumbnails() {
    if (!originalImage) return;
    clearTimeout(thumbsTimer);
    // Fora do caminho crítico: a prévia principal responde primeiro.
    thumbsTimer = setTimeout(() => {
        const scale = THUMB_SIZE / Math.max(originalImage.width, originalImage.height);
        Object.keys(FILTER_DEFS).forEach((id) => {
            const thumbCanvas = filterButtons[id].querySelector('.thumb-img');
            const thumbCtx = thumbCanvas.getContext('2d', { willReadFrequently: !!FILTER_DEFS[id].pixel });
            try {
                composeFrame(thumbCtx, thumbCanvas, originalImage, {
                    ...defaultState(),
                    rotate: state.rotate,
                    flipH: state.flipH,
                    flipV: state.flipV,
                    crop: state.crop,
                    filter: id,
                    scale,
                    tmpCanvas: document.createElement('canvas')
                });
            } catch {
                /* miniatura opcional */
            }
        });
    }, 60);
}

/* Abas */
function selectTab(tab) {
    if (cropMode && tab !== 'crop') applyCrop();
    $$('.tab-btn').forEach((b) => {
        const on = b.dataset.tab === tab;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', String(on));
    });
    $$('.tab-content').forEach((c) => c.classList.toggle('active', c.id === `${tab}-tab`));
    if (tab === 'crop') enterCrop();
}
$$('.tab-btn').forEach((btn) => btn.addEventListener('click', () => selectTab(btn.dataset.tab)));

/* ---------------------------------------------------------------------------
   Girar / espelhar (o corte acompanha a transformação)
--------------------------------------------------------------------------- */
function rotateCrop(c, dir) {
    // dir = +1 horário, −1 anti-horário (retângulo normalizado no espaço orientado).
    return dir > 0
        ? { x: 1 - (c.y + c.h), y: c.x, w: c.h, h: c.w }
        : { x: c.y, y: 1 - (c.x + c.w), w: c.h, h: c.w };
}

function transformRect(c, kind) {
    if (kind === 'rotR') return rotateCrop(c, 1);
    if (kind === 'rotL') return rotateCrop(c, -1);
    if (kind === 'flipH') return { ...c, x: 1 - c.x - c.w };
    return { ...c, y: 1 - c.y - c.h };
}

function transform(kind) {
    if (!originalImage) return;
    if (kind === 'rotL' || kind === 'rotR') {
        state.rotate = (((state.rotate + (kind === 'rotR' ? 90 : -90)) % 360) + 360) % 360;
    } else if (kind === 'flipH') {
        // Espelhar no espaço da tela: inverte o eixo que hoje está na horizontal.
        if (state.rotate % 180 === 0) state.flipH *= -1;
        else state.flipV *= -1;
    } else {
        if (state.rotate % 180 === 0) state.flipV *= -1;
        else state.flipH *= -1;
    }
    // O corte (aplicado e o pendente) gira/espelha junto com a foto.
    state.crop = transformRect(state.crop, kind);
    if (cropMode) pendingCrop = transformRect(pendingCrop, kind);
    commit();
    updateDimensionsBadge();
    generateThumbnails();
    scheduleRender();
}

$('#rotateLeft').addEventListener('click', () => transform('rotL'));
$('#rotateRight').addEventListener('click', () => transform('rotR'));
$('#flipHorizontal').addEventListener('click', () => transform('flipH'));
$('#flipVertical').addEventListener('click', () => transform('flipV'));

/* ---------------------------------------------------------------------------
   Corte
--------------------------------------------------------------------------- */
function imageAspect() {
    const { W, H } = orientedSize(originalImage, 1, state.rotate);
    return W / H;
}

function aspectValue() {
    if (aspect === 'free') return null;
    if (aspect === 'original') return imageAspect();
    return Number(aspect);
}

/** Maior retângulo com a proporção `a` (em pixels) centrado no atual. */
function fitAspect(rect, a) {
    const ia = imageAspect();
    // Em coordenadas normalizadas: w/h = a / ia.
    const na = a / ia;
    let w = rect.w;
    let h = w / na;
    if (h > rect.h) {
        h = rect.h;
        w = h * na;
    }
    // Se o retângulo atual for pequeno demais, usa a imagem toda como base.
    if (w < 0.05 || h < 0.05) return fitAspect(FULL_CROP, a);
    return { x: rect.x + (rect.w - w) / 2, y: rect.y + (rect.h - h) / 2, w, h };
}

function enterCrop() {
    if (!originalImage || cropMode) return;
    cropMode = true;
    pendingCrop = { ...state.crop };
    editor.classList.add('is-cropping');
    cropOverlay.hidden = false;
    scheduleRender();
}

function exitCrop() {
    cropMode = false;
    editor.classList.remove('is-cropping');
    cropOverlay.hidden = true;
    scheduleRender();
}

function applyCrop() {
    if (!cropMode) return;
    state.crop = { ...pendingCrop };
    commit();
    exitCrop();
    updateDimensionsBadge();
    generateThumbnails();
}

function cancelCrop() {
    if (!cropMode) return;
    pendingCrop = { ...state.crop };
    exitCrop();
}

function positionCropOverlay(left, top, dw, dh) {
    cropOverlay.style.transform = `translate(${left}px, ${top}px)`;
    cropOverlay.style.width = `${dw}px`;
    cropOverlay.style.height = `${dh}px`;
    const c = pendingCrop;
    cropRectEl.style.left = `${c.x * 100}%`;
    cropRectEl.style.top = `${c.y * 100}%`;
    cropRectEl.style.width = `${c.w * 100}%`;
    cropRectEl.style.height = `${c.h * 100}%`;
    cropOverlay.dataset.locked = aspect === 'free' ? 'false' : 'true';
    const { W, H } = orientedSize(originalImage, 1, state.rotate);
    dimsBadge.textContent = `${Math.round(c.w * W)} × ${Math.round(c.h * H)} px`;
    dimsBadge.hidden = false;
}

$$('#aspectChips .chip').forEach((chip) => {
    chip.addEventListener('click', () => {
        aspect = chip.dataset.aspect;
        $$('#aspectChips .chip').forEach((c) => c.setAttribute('aria-checked', String(c === chip)));
        if (!originalImage) return;
        if (!cropMode) enterCrop();
        const a = aspectValue();
        if (a) pendingCrop = fitAspect(pendingCrop, a);
        scheduleRender();
    });
});

$('#cropApplyBtn').addEventListener('click', () => {
    applyCrop();
    selectTab('adjust');
    toast('Corte aplicado');
});
$('#cropResetBtn').addEventListener('click', () => {
    if (!cropMode) enterCrop();
    aspect = 'free';
    $$('#aspectChips .chip').forEach((c) => c.setAttribute('aria-checked', String(c.dataset.aspect === 'free')));
    pendingCrop = { ...FULL_CROP };
    scheduleRender();
});

// Arrastar o retângulo (mover) ou as alças (redimensionar, com proporção travada).
let cropDrag = null;
const MIN_CROP = 0.04;

cropOverlay.addEventListener('pointerdown', (e) => {
    const handle = e.target.closest('.crop-handle');
    const inside = e.target.closest('#cropRect');
    if (!handle && !inside) return;
    e.preventDefault();
    e.stopPropagation();
    cropOverlay.setPointerCapture(e.pointerId);
    const rect = cropOverlay.getBoundingClientRect();
    cropDrag = {
        id: e.pointerId,
        mode: handle ? handle.dataset.h : 'move',
        sx: e.clientX,
        sy: e.clientY,
        start: { ...pendingCrop },
        bw: rect.width,
        bh: rect.height
    };
});

cropOverlay.addEventListener('pointermove', (e) => {
    if (!cropDrag || e.pointerId !== cropDrag.id) return;
    const dx = (e.clientX - cropDrag.sx) / cropDrag.bw;
    const dy = (e.clientY - cropDrag.sy) / cropDrag.bh;
    const s = cropDrag.start;
    let { x, y, w, h } = s;
    const m = cropDrag.mode;
    if (m === 'move') {
        x = Math.max(0, Math.min(1 - w, s.x + dx));
        y = Math.max(0, Math.min(1 - h, s.y + dy));
    } else {
        let left = s.x;
        let top = s.y;
        let right = s.x + s.w;
        let bottom = s.y + s.h;
        if (m.includes('w')) left = Math.max(0, Math.min(right - MIN_CROP, s.x + dx));
        if (m.includes('e')) right = Math.min(1, Math.max(left + MIN_CROP, right + dx));
        if (m.includes('n')) top = Math.max(0, Math.min(bottom - MIN_CROP, s.y + dy));
        if (m.includes('s')) bottom = Math.min(1, Math.max(top + MIN_CROP, bottom + dy));
        x = left;
        y = top;
        w = right - left;
        h = bottom - top;
        const a = aspectValue();
        if (a && m.length === 2) {
            // Canto com proporção travada: a largura manda, a altura segue;
            // se estourar a borda, a altura manda.
            const na = a / imageAspect();
            const anchorX = m.includes('w') ? s.x + s.w : s.x;
            const anchorY = m.includes('n') ? s.y + s.h : s.y;
            h = w / na;
            const maxH = m.includes('n') ? anchorY : 1 - anchorY;
            if (h > maxH) {
                h = maxH;
                w = h * na;
            }
            x = m.includes('w') ? anchorX - w : anchorX;
            y = m.includes('n') ? anchorY - h : anchorY;
        }
    }
    pendingCrop = { x, y, w, h };
    layout();
});

const endCropDrag = (e) => {
    if (cropDrag && e.pointerId === cropDrag.id) cropDrag = null;
};
cropOverlay.addEventListener('pointerup', endCropDrag);
cropOverlay.addEventListener('pointercancel', endCropDrag);

/* ---------------------------------------------------------------------------
   Zoom e pan na prévia (roda, pinça, arrastar, duplo clique)
--------------------------------------------------------------------------- */
const pointers = new Map();
let gesture = null;

const stagePointerOpts = { passive: false };
stage.addEventListener('pointerdown', (e) => {
    if (!originalImage || cropMode) return;
    e.preventDefault();
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    // Capture só mouse/caneta — no iOS o capture do 1º dedo impede a pinça.
    if (e.pointerType !== 'touch') {
        try { stage.setPointerCapture(e.pointerId); } catch { /* ok */ }
    }
    if (pointers.size === 2) {
        const [a, b] = Array.from(pointers.values());
        gesture = { kind: 'pinch', dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: view.zoom };
    } else if (view.zoom > 1.001) {
        gesture = { kind: 'pan', x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
    }
}, stagePointerOpts);
function onStagePointerMove(e) {
    if (!pointers.has(e.pointerId)) return;
    e.preventDefault();
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!gesture) return;
    if (gesture.kind === 'pinch' && pointers.size >= 2) {
        const [a, b] = Array.from(pointers.values());
        setZoom(gesture.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, gesture.dist)), (a.x + b.x) / 2, (a.y + b.y) / 2);
    } else if (gesture.kind === 'pan') {
        view.x = gesture.vx + (e.clientX - gesture.x);
        view.y = gesture.vy + (e.clientY - gesture.y);
        layout();
    }
}
window.addEventListener('pointermove', onStagePointerMove, stagePointerOpts);
const endStagePointer = (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size < 2 && gesture && gesture.kind === 'pinch') gesture = null;
    if (!pointers.size) gesture = null;
};
window.addEventListener('pointerup', endStagePointer);
window.addEventListener('pointercancel', endStagePointer);
stage.addEventListener('touchstart', (e) => { if (originalImage && !cropMode) e.preventDefault(); }, stagePointerOpts);
stage.addEventListener('touchmove', (e) => { if (originalImage && !cropMode) e.preventDefault(); }, stagePointerOpts);
stage.addEventListener('wheel', (e) => {
    if (!originalImage || cropMode) return;
    e.preventDefault();
    setZoom(view.zoom * Math.exp(-e.deltaY * 0.0022), e.clientX, e.clientY);
}, { passive: false });
stage.addEventListener('dblclick', (e) => {
    if (!originalImage || cropMode) return;
    if (view.zoom > 1.001) zoomFit();
    else setZoom(Math.max(2, 1 / (view.fit * previewScale)), e.clientX, e.clientY);
});

$('#zoomInBtn').addEventListener('click', () => setZoom(view.zoom * 1.25));
$('#zoomOutBtn').addEventListener('click', () => setZoom(view.zoom / 1.25));
$('#zoomLabel').addEventListener('click', () => (view.zoom > 1.001 ? zoomFit() : zoomTo100()));

let resizeTimer = 0;
const ro = new ResizeObserver(() => {
    cancelAnimationFrame(resizeTimer);
    resizeTimer = requestAnimationFrame(layout);
});
ro.observe(stage);

/* ---------------------------------------------------------------------------
   Comparar com o original (segurar)
--------------------------------------------------------------------------- */
function setComparing(on) {
    if (!originalImage || isComparing === on) return;
    isComparing = on;
    compareFlag.hidden = !on;
    $('#compareBtn').classList.toggle('is-active', on);
    scheduleRender();
}
const compareBtn = $('#compareBtn');
compareBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    setComparing(true);
});
['pointerup', 'pointercancel', 'pointerleave'].forEach((evt) => compareBtn.addEventListener(evt, () => setComparing(false)));
compareBtn.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        setComparing(true);
    }
});
compareBtn.addEventListener('keyup', () => setComparing(false));
compareBtn.addEventListener('contextmenu', (e) => e.preventDefault());

/* ---------------------------------------------------------------------------
   Abrir imagem
--------------------------------------------------------------------------- */
function showError(msg) {
    uploadError.textContent = msg;
    uploadError.hidden = !msg;
}

function setLoading(on) {
    loadingVeil.hidden = !on;
}

function handleFile(file) {
    if (!file) return;
    const looksImage = (file.type && file.type.startsWith('image/')) || /\.(jpe?g|png|webp|avif|gif|bmp|svg|heic)$/i.test(file.name || '');
    if (!looksImage) {
        showError('Esse arquivo não é uma imagem.');
        toast('Esse arquivo não é uma imagem');
        return;
    }
    loadImageFromURL(URL.createObjectURL(file), true);
}

let imageLoadId = 0;
function loadImageFromURL(url, revoke = false) {
    const id = ++imageLoadId;
    const img = new Image();
    img.decoding = 'async';
    setLoading(true);
    showError('');
    // Nada de carregamento infinito: 20 s e desiste com mensagem.
    const timer = setTimeout(() => {
        if (id !== imageLoadId) return;
        imageLoadId++;
        setLoading(false);
        showError('A imagem demorou demais para abrir. Tente outra.');
    }, 20000);
    img.onload = () => {
        clearTimeout(timer);
        if (revoke) URL.revokeObjectURL(url);
        if (id !== imageLoadId) return;
        setLoading(false);
        if (!img.naturalWidth || !img.naturalHeight) {
            showError('Não foi possível ler essa imagem.');
            return;
        }
        onImageReady(img);
    };
    img.onerror = () => {
        clearTimeout(timer);
        if (revoke) URL.revokeObjectURL(url);
        if (id !== imageLoadId) return;
        setLoading(false);
        showError('Não foi possível abrir essa imagem (formato não suportado?).');
    };
    img.src = url;
}

function onImageReady(img) {
    originalImage = img;
    previewScale = Math.min(1, MAX_PREVIEW_DIM / Math.max(img.width, img.height));
    state = defaultState();
    committed = clone(state);
    past.length = 0;
    future.length = 0;
    aspect = 'free';
    $$('#aspectChips .chip').forEach((c) => c.setAttribute('aria-checked', String(c.dataset.aspect === 'free')));
    view.zoom = 1;
    view.x = 0;
    view.y = 0;
    editor.dataset.state = 'ready';
    controlsArea.classList.remove('disabled');
    if (cropMode) exitCrop();
    selectTab('adjust');
    syncControls();
    updateHistoryButtons();
    updateDimensionsBadge();
    generateThumbnails();
    render();
}

function showUploadState() {
    imageLoadId++;
    if (cropMode) exitCrop();
    originalImage = null;
    editor.dataset.state = 'empty';
    controlsArea.classList.add('disabled');
    setLoading(false);
    updateDimensionsBadge();
}

function updateDimensionsBadge() {
    if (!originalImage) {
        dimsBadge.hidden = true;
        return;
    }
    const { W, H } = orientedSize(originalImage, 1, state.rotate);
    dimsBadge.textContent = `${Math.round(state.crop.w * W)} × ${Math.round(state.crop.h * H)} px`;
    dimsBadge.hidden = false;
}

$('#uploadBtn').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
    handleFile(fileInput.files[0]);
    fileInput.value = '';
});
$$('.sample-item').forEach((btn) => btn.addEventListener('click', () => loadImageFromURL(btn.dataset.sample)));

['dragover', 'dragenter'].forEach((evt) => {
    previewArea.addEventListener(evt, (e) => {
        e.preventDefault();
        previewArea.classList.add('drag-active');
    });
});
['dragleave', 'dragend'].forEach((evt) => {
    previewArea.addEventListener(evt, (e) => {
        if (evt === 'dragleave' && previewArea.contains(e.relatedTarget)) return;
        previewArea.classList.remove('drag-active');
    });
});
previewArea.addEventListener('drop', (e) => {
    e.preventDefault();
    previewArea.classList.remove('drag-active');
    const file = e.dataTransfer && e.dataTransfer.files[0];
    if (file) handleFile(file);
});
// Soltar fora da prévia não pode navegar para a imagem e perder as edições.
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => {
    e.preventDefault();
    if (previewArea.contains(e.target)) return;
    const file = e.dataTransfer && e.dataTransfer.files[0];
    if (file) handleFile(file);
});

window.addEventListener('paste', (e) => {
    const items = e.clipboardData ? Array.from(e.clipboardData.items) : [];
    const item = items.find((i) => i.type.startsWith('image/'));
    if (!item) return;
    const file = item.getAsFile();
    if (file) {
        e.preventDefault();
        handleFile(file);
    }
});

/* ---------------------------------------------------------------------------
   Ações
--------------------------------------------------------------------------- */
let toastTimer = 0;
function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, 2200);
}

function resetEditor() {
    if (!originalImage) return;
    if (cropMode) exitCrop();
    state = defaultState();
    commit();
    syncControls();
    updateDimensionsBadge();
    generateThumbnails();
    scheduleRender();
    toast('Edições redefinidas — Ctrl+Z desfaz');
}

/** Recompõe na resolução original (limitada a 16,7 MP). */
function exportCanvas(background) {
    const out = document.createElement('canvas');
    const octx = out.getContext('2d', { willReadFrequently: true });
    const { W, H } = orientedSize(originalImage, 1, state.rotate);
    const area = W * state.crop.w * H * state.crop.h;
    const scale = area > MAX_EXPORT_AREA ? Math.sqrt(MAX_EXPORT_AREA / area) : 1;
    composeFrame(octx, out, originalImage, renderOptions({ scale, background, tmpCanvas: document.createElement('canvas') }));
    return { canvas: out, scaled: scale < 1 };
}

async function saveImage() {
    if (!originalImage) return;
    if (cropMode) applyCrop();
    const mime = $('#exportFormatSelect').value;
    const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[mime] || 'png';
    const quality = mime === 'image/png' ? undefined : Number($('#exportQualitySelect').value);
    const btn = $('#saveBtn');
    const label = btn.querySelector('span');
    btn.disabled = true;
    label.textContent = 'Gerando…';
    // Cede um quadro para o "Gerando…" aparecer antes do trabalho pesado.
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
    try {
        const { canvas: out, scaled } = exportCanvas(mime === 'image/jpeg' ? '#ffffff' : null);
        const { saveCanvas } = await import('../shared/save-canvas.js');
        await saveCanvas(out, `imagem-editada.${ext}`, mime, quality);
        toast(scaled ? 'Baixada (reduzida a 16,7 MP, limite do navegador)' : `Baixada: ${out.width} × ${out.height} px`);
    } catch {
        toast('Falha ao salvar. Tente PNG ou JPG.');
    } finally {
        btn.disabled = false;
        label.textContent = 'Baixar';
    }
}

async function copyImage() {
    if (!originalImage) return;
    if (!navigator.clipboard || !window.ClipboardItem) {
        toast('Seu navegador não copia imagens — use Baixar');
        return;
    }
    if (cropMode) applyCrop();
    try {
        const { canvas: out } = exportCanvas(null);
        const blob = await new Promise((resolve) => out.toBlob(resolve, 'image/png'));
        if (!blob) throw new Error('blob');
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        toast('Imagem copiada');
    } catch {
        toast('Não foi possível copiar');
    }
}

$('#resetBtn').addEventListener('click', resetEditor);
$('#changeImageBtn').addEventListener('click', showUploadState);
$('#saveBtn').addEventListener('click', saveImage);
$('#copyBtn').addEventListener('click', copyImage);
$('#undoBtn').addEventListener('click', undo);
$('#redoBtn').addEventListener('click', redo);

/* ---------------------------------------------------------------------------
   Atalhos
--------------------------------------------------------------------------- */
document.addEventListener('keydown', (e) => {
    const t = e.target;
    const typing = t && ((t.tagName === 'INPUT' && t.type !== 'range') || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    if (typing) return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (mod) {
        if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
        else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); redo(); }
        else if (k === 's') { e.preventDefault(); saveImage(); }
        else if (k === 'o') { e.preventDefault(); fileInput.click(); }
        else if (k === 'c' && originalImage && !String(window.getSelection() || '')) { e.preventDefault(); copyImage(); }
        return;
    }
    if (e.altKey || !originalImage) return;
    const onRange = t && t.type === 'range';
    if (cropMode && e.key === 'Enter') { e.preventDefault(); $('#cropApplyBtn').click(); return; }
    if (cropMode && e.key === 'Escape') { e.preventDefault(); cancelCrop(); selectTab('adjust'); return; }
    if (e.key === '\\' && !e.repeat) { setComparing(true); return; }
    if (onRange) return;
    if (k === 'r') { e.preventDefault(); transform(e.shiftKey ? 'rotL' : 'rotR'); }
    else if (k === 'h') { e.preventDefault(); transform('flipH'); }
    else if (k === 'v') { e.preventDefault(); transform('flipV'); }
    else if (k === 'c') { e.preventDefault(); selectTab('crop'); }
    else if (e.key === '0') { e.preventDefault(); zoomFit(); }
    else if (e.key === '1') { e.preventDefault(); zoomTo100(); }
    else if (e.key === '+' || e.key === '=') { e.preventDefault(); setZoom(view.zoom * 1.25); }
    else if (e.key === '-') { e.preventDefault(); setZoom(view.zoom / 1.25); }
});
document.addEventListener('keyup', (e) => {
    if (e.key === '\\') setComparing(false);
});
window.addEventListener('blur', () => setComparing(false));

// Sair com edições na tela pede confirmação do navegador.
window.addEventListener('beforeunload', (e) => {
    if (originalImage && past.length) {
        e.preventDefault();
        e.returnValue = '';
    }
});

/* Início */
controlsArea.classList.add('disabled');
buildFiltersUI();
syncControls();
updateHistoryButtons();
