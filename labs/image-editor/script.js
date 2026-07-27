// DOM Elements
const fileInput = document.getElementById('fileInput');
const uploadPlaceholder = document.getElementById('uploadPlaceholder');
const previewArea = document.getElementById('previewArea');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const compareHint = document.getElementById('compareHint');
const controlsArea = document.getElementById('controlsArea');
const resetBtn = document.getElementById('resetBtn');
const changeImageBtn = document.getElementById('changeImageBtn');
const copyBtn = document.getElementById('copyBtn');
const saveBtn = document.getElementById('saveBtn');
const sampleList = document.getElementById('sampleList');
const filtersFilmstrip = document.getElementById('filtersFilmstrip');

// Tabs
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Adjustment inputs
const brightnessInput = document.getElementById('brightness');
const contrastInput = document.getElementById('contrast');
const saturationInput = document.getElementById('saturation');
const blurInput = document.getElementById('blur');
const rotateLeftBtn = document.getElementById('rotateLeft');
const rotateRightBtn = document.getElementById('rotateRight');
const flipHBtn = document.getElementById('flipHorizontal');
const flipVBtn = document.getElementById('flipVertical');

// Caps how large the *editing preview* gets, so multi-megapixel phone
// photos still feel instant while dragging sliders. Exports (save/copy)
// always recompose at the image's native resolution, independent of this.
const MAX_PREVIEW_DIM = 1600;
const THUMB_SIZE = 140;

// State
let originalImage = null;
let previewScale = 1;
let isComparing = false;
let rafPending = false;
const filterButtons = {};

let state = {
    brightness: 100,
    contrast: 100,
    saturation: 100,
    blur: 0,
    rotate: 0,
    flipH: 1,
    flipV: 1,
    filter: 'none'
};

// ---------------------------------------------------------------------------
// Pixel-level effects (operate directly on ImageData for looks a plain CSS
// filter can't produce: duotone mapping, posterization, RGB-shift glitch,
// edge-detected sketch, and mosaic pixelation).
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Overlays. `frameOverlay` runs *inside* the rotated/flipped canvas space
// (so borders/stamps travel with the photo, like a real print). `postOverlay`
// runs after the transform is restored, in plain top-left canvas space (so
// vignettes always stay centered on the final view regardless of rotation).
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Filter registry. `css` feeds ctx.filter alongside the live brightness/
// contrast/saturation/blur adjustments (cheap, GPU-accelerated). `pixel`
// and the overlays are extra passes for looks CSS filters can't express.
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Core render pipeline. Resolution-independent via `scale`: the live preview
// uses previewScale (capped), thumbnails use a tiny scale, and exports use
// scale 1 (native resolution) — all through the exact same code path, so
// what you see while editing is exactly what you get when you save.
// ---------------------------------------------------------------------------
function composeFrame(context, canvasEl, image, opts) {
    const { scale, rotate, flipH, flipV, brightness, contrast, saturation, blur, filterId } = opts;
    const def = FILTER_DEFS[filterId] || FILTER_DEFS.none;

    const angleInRadians = rotate * Math.PI / 180;
    const absSin = Math.abs(Math.sin(angleInRadians));
    const absCos = Math.abs(Math.cos(angleInRadians));

    const iw = image.width * scale;
    const ih = image.height * scale;
    const newWidth = iw * absCos + ih * absSin;
    const newHeight = iw * absSin + ih * absCos;

    canvasEl.width = newWidth;
    canvasEl.height = newHeight;

    context.save();
    context.translate(newWidth / 2, newHeight / 2);
    context.rotate(angleInRadians);
    context.scale(flipH, flipV);

    const scaledBlur = blur * scale;
    context.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) blur(${scaledBlur}px) ${def.css || ''}`.trim();
    context.drawImage(image, -iw / 2, -ih / 2, iw, ih);

    if (def.frameOverlay) {
        context.filter = 'none';
        def.frameOverlay(context, iw, ih);
    }
    context.restore();

    if (def.pixel) {
        const imgData = context.getImageData(0, 0, newWidth, newHeight);
        def.pixel(imgData);
        context.putImageData(imgData, 0, 0);
    }

    if (def.postOverlay) {
        def.postOverlay(context, newWidth, newHeight);
    }
}

function currentRenderOptions(overrides = {}) {
    return {
        scale: previewScale,
        rotate: state.rotate,
        flipH: state.flipH,
        flipV: state.flipV,
        brightness: state.brightness,
        contrast: state.contrast,
        saturation: state.saturation,
        blur: state.blur,
        filterId: state.filter,
        ...overrides
    };
}

function render() {
    if (!originalImage || isComparing) return;
    composeFrame(ctx, canvas, originalImage, currentRenderOptions());
}

// Batches rapid-fire slider/rotate events into a single redraw per animation
// frame, instead of recomputing (and for heavier filters, re-running pixel
// loops) once per raw input event.
function scheduleRender() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
        rafPending = false;
        render();
    });
}

// ---------------------------------------------------------------------------
// Instagram-style filter filmstrip: one small thumbnail per filter, rendered
// from the user's own photo (at neutral adjustments, so it previews the
// filter itself) so people can see the effect before committing to it.
// ---------------------------------------------------------------------------
function buildFiltersUI() {
    filtersFilmstrip.innerHTML = '';
    Object.entries(FILTER_DEFS).forEach(([id, def]) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'filter-thumb';
        btn.dataset.filter = id;
        btn.setAttribute('aria-pressed', id === 'none' ? 'true' : 'false');
        if (id === 'none') btn.classList.add('active');
        btn.innerHTML = `<span class="thumb-img"></span><span class="thumb-label">${def.label}</span>`;
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-thumb').forEach((b) => {
                b.classList.remove('active');
                b.setAttribute('aria-pressed', 'false');
            });
            btn.classList.add('active');
            btn.setAttribute('aria-pressed', 'true');
            state.filter = id;
            scheduleRender();
        });
        filtersFilmstrip.appendChild(btn);
        filterButtons[id] = btn;
    });
}

let thumbCanvas = null;
function generateThumbnails() {
    if (!originalImage) return;
    if (!thumbCanvas) thumbCanvas = document.createElement('canvas');
    const thumbCtx = thumbCanvas.getContext('2d');
    const scale = THUMB_SIZE / Math.max(originalImage.width, originalImage.height);

    Object.keys(FILTER_DEFS).forEach((id) => {
        composeFrame(thumbCtx, thumbCanvas, originalImage, {
            scale,
            rotate: state.rotate,
            flipH: state.flipH,
            flipV: state.flipV,
            brightness: 100,
            contrast: 100,
            saturation: 100,
            blur: 0,
            filterId: id
        });
        const url = thumbCanvas.toDataURL('image/jpeg', 0.82);
        const btn = filterButtons[id];
        if (btn) btn.querySelector('.thumb-img').style.backgroundImage = `url(${url})`;
    });
}

// Initialize
function init() {
    controlsArea.classList.add('disabled');
    buildFiltersUI();
    setupEventListeners();
}

function setupEventListeners() {
    // Upload
    uploadPlaceholder.addEventListener('click', (e) => {
        if (e.target.closest('.sample-item')) return;
        fileInput.click();
    });
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleFile(file);
    });

    // Drag & drop works anywhere over the preview, even after an image is
    // already loaded, so swapping photos never requires the reset button.
    ['dragover', 'dragenter'].forEach((evt) => {
        previewArea.addEventListener(evt, (e) => {
            e.preventDefault();
            previewArea.classList.add('drag-active');
        });
    });
    ['dragleave', 'dragend'].forEach((evt) => {
        previewArea.addEventListener(evt, (e) => {
            e.preventDefault();
            previewArea.classList.remove('drag-active');
        });
    });
    previewArea.addEventListener('drop', (e) => {
        e.preventDefault();
        previewArea.classList.remove('drag-active');
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    });

    // Paste an image straight from the clipboard.
    window.addEventListener('paste', (e) => {
        const items = e.clipboardData ? Array.from(e.clipboardData.items) : [];
        const item = items.find((i) => i.type.startsWith('image/'));
        if (!item) return;
        const file = item.getAsFile();
        if (file) handleFile(file);
    });

    // Sample gallery
    sampleList.querySelectorAll('.sample-item').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            loadImageFromURL(btn.dataset.sample);
        });
    });

    // Tabs
    tabBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            tabBtns.forEach((b) => b.classList.remove('active'));
            tabContents.forEach((c) => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`${btn.dataset.tab}-tab`).classList.add('active');
        });
    });

    // Adjustments
    [brightnessInput, contrastInput, saturationInput, blurInput].forEach((input) => {
        input.addEventListener('input', updateState);
    });

    // Transforms
    rotateLeftBtn.addEventListener('click', () => {
        state.rotate -= 90;
        scheduleRender();
        generateThumbnails();
    });
    rotateRightBtn.addEventListener('click', () => {
        state.rotate += 90;
        scheduleRender();
        generateThumbnails();
    });
    flipHBtn.addEventListener('click', () => {
        state.flipH *= -1;
        scheduleRender();
        generateThumbnails();
    });
    flipVBtn.addEventListener('click', () => {
        state.flipV *= -1;
        scheduleRender();
        generateThumbnails();
    });

    // Hold-to-compare: press and hold the photo to peek at the untouched original.
    canvas.addEventListener('pointerdown', () => {
        if (!originalImage) return;
        isComparing = true;
        canvas.classList.add('comparing');
        composeFrame(ctx, canvas, originalImage, currentRenderOptions({
            brightness: 100, contrast: 100, saturation: 100, blur: 0, filterId: 'none'
        }));
    });
    ['pointerup', 'pointercancel'].forEach((evt) => {
        window.addEventListener(evt, () => {
            if (!isComparing) return;
            isComparing = false;
            canvas.classList.remove('comparing');
            scheduleRender();
        });
    });

    // Actions
    resetBtn.addEventListener('click', resetEditor);
    changeImageBtn.addEventListener('click', showUploadState);
    saveBtn.addEventListener('click', saveImage);
    if (navigator.clipboard && window.ClipboardItem) {
        copyBtn.addEventListener('click', copyImage);
    } else {
        copyBtn.style.display = 'none';
    }
}

function handleFile(file) {
    if (!file.type.match('image.*')) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => onImageReady(img);
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function loadImageFromURL(url) {
    const img = new Image();
    img.onload = () => onImageReady(img);
    img.src = url;
}

function onImageReady(img) {
    originalImage = img;
    previewScale = Math.min(1, MAX_PREVIEW_DIM / Math.max(img.width, img.height));
    uploadPlaceholder.style.display = 'none';
    canvas.style.display = 'block';
    previewArea.classList.add('has-image');
    controlsArea.classList.remove('disabled');
    resetEditor();
    generateThumbnails();
}

function showUploadState() {
    originalImage = null;
    canvas.style.display = 'none';
    previewArea.classList.remove('has-image');
    uploadPlaceholder.style.display = 'flex';
    controlsArea.classList.add('disabled');
}

function updateState() {
    state.brightness = brightnessInput.value;
    state.contrast = contrastInput.value;
    state.saturation = saturationInput.value;
    state.blur = blurInput.value;

    brightnessInput.previousElementSibling.querySelector('.value').textContent = `${state.brightness}%`;
    contrastInput.previousElementSibling.querySelector('.value').textContent = `${state.contrast}%`;
    saturationInput.previousElementSibling.querySelector('.value').textContent = `${state.saturation}%`;
    blurInput.previousElementSibling.querySelector('.value').textContent = `${state.blur}px`;

    scheduleRender();
}

function resetEditor() {
    state = {
        brightness: 100,
        contrast: 100,
        saturation: 100,
        blur: 0,
        rotate: 0,
        flipH: 1,
        flipV: 1,
        filter: 'none'
    };

    brightnessInput.value = 100;
    contrastInput.value = 100;
    saturationInput.value = 100;
    blurInput.value = 0;

    document.querySelectorAll('.filter-thumb').forEach((b) => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
    });
    filterButtons.none?.classList.add('active');
    filterButtons.none?.setAttribute('aria-pressed', 'true');

    updateState();
}

function exportCanvasAtFullResolution() {
    const exportCanvas = document.createElement('canvas');
    const exportCtx = exportCanvas.getContext('2d');
    composeFrame(exportCtx, exportCanvas, originalImage, currentRenderOptions({ scale: 1 }));
    return exportCanvas;
}

function saveImage() {
    if (!originalImage) return;
    const exportCanvas = exportCanvasAtFullResolution();
    const link = document.createElement('a');
    link.download = 'edited-image.png';
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
}

async function copyImage() {
    if (!originalImage) return;
    const exportCanvas = exportCanvasAtFullResolution();
    const originalLabel = copyBtn.textContent;
    try {
        const blob = await new Promise((resolve) => exportCanvas.toBlob(resolve, 'image/png'));
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        copyBtn.textContent = 'Copiado!';
    } catch (err) {
        copyBtn.textContent = 'Falhou';
    } finally {
        setTimeout(() => { copyBtn.textContent = originalLabel; }, 1500);
    }
}

// Theme Logic handled by shared.js

// Start
init();
