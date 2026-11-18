const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const container = document.querySelector('.canvas-container');

// State
let isDrawing = false;
let currentTool = 'brush';
let brushSize = 5;
let currentColor = '#000000';
let currentOpacity = 1;
let fillShapes = false;
let snapshot;
const history = [];
let historyIndex = -1;

// Tools Elements
const toolBtns = document.querySelectorAll('.tool-btn');
const colorPicker = document.getElementById('colorPicker');
const colorPreview = document.querySelector('.color-preview');
const brushSizeInput = document.getElementById('brushSize');
const brushSizeVal = document.getElementById('brushSizeVal');
const opacityInput = document.getElementById('opacity');
const opacityVal = document.getElementById('opacityVal');
const fillShapesInput = document.getElementById('fillShapes');
const activeToolName = document.getElementById('activeToolName');
const swatches = document.querySelectorAll('.color-swatch');

// Brush cursor preview (desktop)
const brushCursor = document.createElement('div');
brushCursor.className = 'brush-cursor';
brushCursor.setAttribute('aria-hidden', 'true');
container.appendChild(brushCursor);

const syncBrushCursor = () => {
    const rect = canvas.getBoundingClientRect();
    const scale = rect.width / canvas.width || 1;
    const size = Math.max(4, brushSize * scale);
    brushCursor.style.width = `${size}px`;
    brushCursor.style.height = `${size}px`;
    brushCursor.classList.toggle('is-eraser', currentTool === 'eraser');
    const showPreview = currentTool === 'brush' || currentTool === 'eraser';
    if (!showPreview) brushCursor.classList.remove('is-visible');
    if (showPreview) {
        const alphaHex = Math.round(currentOpacity * 55).toString(16).padStart(2, '0');
        brushCursor.style.backgroundColor = currentTool === 'eraser'
            ? 'rgba(255,255,255,0.35)'
            : `${currentColor}${alphaHex}`;
    }
};

const moveBrushCursor = (clientX, clientY) => {
    const showPreview = currentTool === 'brush' || currentTool === 'eraser';
    if (!showPreview) {
        brushCursor.classList.remove('is-visible');
        return;
    }
    const crect = container.getBoundingClientRect();
    brushCursor.style.left = `${clientX - crect.left + container.scrollLeft}px`;
    brushCursor.style.top = `${clientY - crect.top + container.scrollTop}px`;
    syncBrushCursor();
    brushCursor.classList.add('is-visible');
};

canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') moveBrushCursor(e.clientX, e.clientY);
});
canvas.addEventListener('pointerenter', (e) => {
    if (e.pointerType === 'mouse') moveBrushCursor(e.clientX, e.clientY);
});
canvas.addEventListener('pointerleave', () => brushCursor.classList.remove('is-visible'));

// Actions Elements
const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');
const clearBtn = document.getElementById('clearBtn');
const saveBtn = document.getElementById('saveBtn');

// Initialize Canvas
const initCanvas = () => {
    // Set canvas size to a fixed reasonable size or responsive
    // For a paint app, fixed size centered is often better to avoid scaling issues
    canvas.width = 800;
    canvas.height = 600;

    // Fill with white background initially
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Save initial state
    saveState();
};

const getCanvasPoint = (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
    };
};

const paintShape = () => {
    if (fillShapes && currentTool !== 'line') {
        ctx.fill();
    }
    ctx.stroke();
};

// History Management
const saveState = () => {
    // Remove any redo states
    if (historyIndex < history.length - 1) {
        history.splice(historyIndex + 1);
    }

    history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    historyIndex++;

    // Limit history
    if (history.length > 20) {
        history.shift();
        historyIndex--;
    }

    updateUndoRedoButtons();
};

const undo = () => {
    if (historyIndex > 0) {
        historyIndex--;
        restoreState(history[historyIndex]);
    }
};

const redo = () => {
    if (historyIndex < history.length - 1) {
        historyIndex++;
        restoreState(history[historyIndex]);
    }
};

const restoreState = (image) => {
    ctx.putImageData(image, 0, 0);
    updateUndoRedoButtons();
};

const updateUndoRedoButtons = () => {
    undoBtn.disabled = historyIndex <= 0;
    redoBtn.disabled = historyIndex >= history.length - 1;
};

// Drawing Logic
// Offscreen buffer for brush strokes so opacity < 1 doesn't accumulate within the same stroke
const strokeCanvas = document.createElement('canvas');
const strokeCtx = strokeCanvas.getContext('2d');

const stopDraw = () => {
    if (!isDrawing) return;
    if (currentTool !== 'fill' && currentTool !== 'picker') saveState();
    isDrawing = false;
};

// Shape drawing keeps the initial canvas snapshot while the pointer moves.
let startX, startY;
let previousPoint;

const startDrawFixed = (e) => {
    isDrawing = true;
    const { x, y } = getCanvasPoint(e);
    startX = x;
    startY = y;

    ctx.beginPath();
    ctx.moveTo(startX, startY);

    if (['rect', 'circle', 'line'].includes(currentTool) || (currentTool === 'brush' && currentOpacity < 1)) {
        snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
        if (currentTool === 'brush') {
            if (strokeCanvas.width !== canvas.width || strokeCanvas.height !== canvas.height) {
                strokeCanvas.width = canvas.width;
                strokeCanvas.height = canvas.height;
            }
            strokeCtx.clearRect(0, 0, strokeCanvas.width, strokeCanvas.height);
        }
    } else if (currentTool === 'fill') {
        floodFill(Math.floor(startX), Math.floor(startY), hexToRgba(currentColor));
        isDrawing = false;
    } else if (currentTool === 'picker') {
        pickColor(startX, startY);
        isDrawing = false;
    }
    if (currentTool === 'brush' || currentTool === 'eraser') {
        previousPoint = { x, y };
        drawingFixed(e);
    }
};

const drawingFixed = (e) => {
    if (!isDrawing) return;

    const { x, y } = getCanvasPoint(e);

    ctx.strokeStyle = currentColor;
    ctx.fillStyle = currentColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = currentOpacity;

    if (currentTool === 'brush' || currentTool === 'eraser') {
        const translucent = currentTool === 'brush' && currentOpacity < 1;
        const ink = translucent ? strokeCtx : ctx;
        ink.strokeStyle = ink.fillStyle = currentTool === 'eraser' ? '#ffffff' : currentColor;
        ink.lineWidth = brushSize;
        ink.lineCap = 'round';
        ink.globalAlpha = 1;
        ink.beginPath();
        if (x === previousPoint.x && y === previousPoint.y) {
            ink.arc(x, y, brushSize / 2, 0, Math.PI * 2);
            ink.fill();
        } else {
            ink.moveTo(previousPoint.x, previousPoint.y);
            ink.lineTo(x, y);
            ink.stroke();
        }
        previousPoint = { x, y };
        if (translucent) {
            ctx.putImageData(snapshot, 0, 0);
            ctx.globalAlpha = currentOpacity;
            ctx.drawImage(strokeCanvas, 0, 0);
        }
    } else if (['rect', 'circle', 'line'].includes(currentTool)) {
        ctx.putImageData(snapshot, 0, 0);
        ctx.beginPath();

        if (currentTool === 'rect') {
            ctx.rect(startX, startY, x - startX, y - startY);
            paintShape();
        } else if (currentTool === 'circle') {
            const radius = Math.hypot(x - startX, y - startY);
            ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
            paintShape();
        } else if (currentTool === 'line') {
            ctx.moveTo(startX, startY);
            ctx.lineTo(x, y);
            ctx.stroke();
        }
    }
};

// Flood Fill Algorithm
const floodFill = (x, y, fillColor) => {
    const w = canvas.width;
    const h = canvas.height;
    if (x < 0 || x >= w || y < 0 || y >= h) return;

    const imageData = ctx.getImageData(0, 0, w, h);
    const pixels = new Uint32Array(imageData.data.buffer);
    const first = y * w + x;
    const target = pixels[first];
    // Usa a ordem de bytes nativa nos dois lados da comparação RGBA.
    const replacement = new Uint32Array(Uint8Array.from(fillColor).buffer)[0];
    if (target === replacement) return;

    // Marca ao enfileirar: cada pixel entra uma única vez, sem criar objetos
    // de coordenadas nem uma segunda máscara de visitados.
    const stack = new Uint32Array(w * h);
    let count = 0;
    function visit(index) {
        if (pixels[index] !== target) return;
        pixels[index] = replacement;
        stack[count++] = index;
    }
    visit(first);
    while (count) {
        const index = stack[--count];
        const column = index % w;
        if (column > 0) visit(index - 1);
        if (column + 1 < w) visit(index + 1);
        if (index >= w) visit(index - w);
        if (index + w < pixels.length) visit(index + w);
    }
    ctx.putImageData(imageData, 0, 0);
    saveState();
};

const hexToRgba = (hex) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b, 255];
};

const pickColor = (x, y) => {
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);
    setColor(hex);
};

const rgbToHex = (r, g, b) => {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
};

let activePointerId = null;

canvas.addEventListener('pointerdown', (e) => {
    if (activePointerId !== null) return;
    e.preventDefault();
    activePointerId = e.pointerId;
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    startDrawFixed(e);
});

canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== activePointerId) return;
    e.preventDefault();
    drawingFixed(e);
});

const endPointerDraw = (e) => {
    if (activePointerId === null || e.pointerId !== activePointerId) return;
    e.preventDefault();
    stopDraw();
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
    activePointerId = null;
};

canvas.addEventListener('pointerup', endPointerDraw);
canvas.addEventListener('pointercancel', endPointerDraw);

toolBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        toolBtns.forEach((other) => {
            const isActive = other === btn;
            other.classList.toggle('active', isActive);
            other.setAttribute('aria-pressed', String(isActive));
        });
        currentTool = btn.dataset.tool;
        if (activeToolName) {
            activeToolName.textContent = btn.dataset.name || currentTool;
        }
        syncBrushCursor();
    });
});

const setColor = (color) => {
    currentColor = color;
    colorPicker.value = color;
    if (colorPreview) {
        colorPreview.style.backgroundColor = color;
    }
    // Marca a amostra correspondente (se a cor veio da paleta) para que o anel de seleção
    // acompanhe a cor ativa em vez de ficar preso na primeira.
    swatches.forEach((sw) => {
        sw.classList.toggle('is-active', sw.dataset.color?.toLowerCase() === color.toLowerCase());
        sw.setAttribute('aria-pressed', String(sw.classList.contains('is-active')));
    });
    syncBrushCursor();
};

colorPicker.addEventListener('input', (e) => setColor(e.target.value));

swatches.forEach(swatch => {
    swatch.addEventListener('click', () => setColor(swatch.dataset.color));
});

brushSizeInput.addEventListener('input', (e) => {
    brushSize = e.target.value;
    brushSizeVal.textContent = `${brushSize}px`;
    syncBrushCursor();
});

opacityInput.addEventListener('input', (e) => {
    currentOpacity = e.target.value / 100;
    opacityVal.textContent = `${e.target.value}%`;
    syncBrushCursor();
});

if (fillShapesInput) {
    fillShapes = fillShapesInput.checked;
    fillShapesInput.addEventListener('change', () => {
        fillShapes = fillShapesInput.checked;
    });
}

undoBtn.addEventListener('click', undo);
redoBtn.addEventListener('click', redo);

clearBtn.addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveState();
});

saveBtn.addEventListener('click', async () => {
    try {
        const { saveCanvas } = await import('../shared/save-canvas.js');
        await saveCanvas(canvas, `paint-lab-${Date.now()}.png`);
    } catch {
        const label = saveBtn.querySelector('span');
        label.textContent = 'Falha ao salvar';
        setTimeout(() => { label.textContent = 'Salvar'; }, 2000);
    }
});

// Keyboard Shortcuts
const selectToolByName = (toolName) => {
    const targetBtn = Array.from(toolBtns).find(b => b.dataset.tool === toolName);
    if (targetBtn) targetBtn.click();
};

const adjustBrushSize = (delta) => {
    const next = Math.max(1, Math.min(50, Number(brushSize) + delta));
    brushSize = next;
    brushSizeInput.value = String(next);
    brushSizeVal.textContent = `${next}px`;
    syncBrushCursor();
};

document.addEventListener('keydown', (e) => {
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) {
        return;
    }

    if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === 'z') {
            e.preventDefault();
            if (e.shiftKey) redo();
            else undo();
        } else if (e.key.toLowerCase() === 'y') {
            e.preventDefault();
            redo();
        }
        return;
    }

    if (e.altKey) return;

    const key = e.key.toLowerCase();
    const keyMap = {
        b: 'brush',
        e: 'eraser',
        g: 'fill',
        i: 'picker',
        r: 'rect',
        c: 'circle',
        l: 'line'
    };

    if (keyMap[key]) {
        e.preventDefault();
        selectToolByName(keyMap[key]);
    } else if (e.key === '[') {
        e.preventDefault();
        adjustBrushSize(-2);
    } else if (e.key === ']') {
        e.preventDefault();
        adjustBrushSize(2);
    }
});

// Init
initCanvas();
