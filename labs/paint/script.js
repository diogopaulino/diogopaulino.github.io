const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const container = document.querySelector('.canvas-container');

// State
let isDrawing = false;
let currentTool = 'brush';
let brushSize = 5;
let currentColor = '#000000';
let currentOpacity = 1;
let snapshot;
let history = [];
let historyIndex = -1;

// Tools Elements
const toolBtns = document.querySelectorAll('.tool-btn');
const colorPicker = document.getElementById('colorPicker');
const colorPreview = document.querySelector('.color-preview');
const brushSizeInput = document.getElementById('brushSize');
const brushSizeVal = document.getElementById('brushSizeVal');
const opacityInput = document.getElementById('opacity');
const opacityVal = document.getElementById('opacityVal');
const swatches = document.querySelectorAll('.color-swatch');

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
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Save initial state
    saveState();

    // Center canvas in container
    centerCanvas();
};

const centerCanvas = () => {
    // CSS handles centering via flexbox, but we ensure it doesn't overflow weirdly
};

// History Management
const saveState = () => {
    // Remove any redo states
    if (historyIndex < history.length - 1) {
        history = history.slice(0, historyIndex + 1);
    }

    history.push(canvas.toDataURL());
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

const restoreState = (dataUrl) => {
    const img = new Image();
    img.src = dataUrl;
    img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        updateUndoRedoButtons();
    };
};

const updateUndoRedoButtons = () => {
    undoBtn.style.opacity = historyIndex > 0 ? '1' : '0.5';
    undoBtn.style.pointerEvents = historyIndex > 0 ? 'auto' : 'none';

    redoBtn.style.opacity = historyIndex < history.length - 1 ? '1' : '0.5';
    redoBtn.style.pointerEvents = historyIndex < history.length - 1 ? 'auto' : 'none';
};

// Drawing Logic
const startDraw = (e) => {
    isDrawing = true;
    ctx.beginPath(); // Start a new path

    // Get correct coordinates
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.moveTo(x, y);

    // For shapes, we need a snapshot of the canvas before dragging
    if (['rect', 'circle', 'line'].includes(currentTool)) {
        snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
        ctx.beginPath(); // Reset path for the shape
    } else if (currentTool === 'fill') {
        floodFill(x, y, hexToRgba(currentColor));
        isDrawing = false; // Fill is a one-time action
    }
};

const drawing = (e) => {
    if (!isDrawing) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.strokeStyle = currentColor;
    ctx.fillStyle = currentColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = currentOpacity;

    if (currentTool === 'brush') {
        ctx.lineTo(x, y);
        ctx.stroke();
    } else if (currentTool === 'eraser') {
        ctx.strokeStyle = '#ffffff'; // Assuming white background
        ctx.globalAlpha = 1; // Eraser always full opacity
        ctx.lineTo(x, y);
        ctx.stroke();
    } else if (['rect', 'circle', 'line'].includes(currentTool)) {
        ctx.putImageData(snapshot, 0, 0); // Restore original state

        if (currentTool === 'rect') {
            drawRect(e);
        } else if (currentTool === 'circle') {
            drawCircle(e);
        } else if (currentTool === 'line') {
            drawLine(e);
        }
    }
};

const stopDraw = () => {
    if (isDrawing) {
        if (currentTool !== 'fill') {
            saveState(); // Save state after drawing stroke/shape
        }
        isDrawing = false;
    }
};

// Shape Helpers
const drawRect = (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    // We need the start point. Since we didn't save it globally, let's just use a simple way:
    // Actually, for shapes, we need the start point. Let's store it in startDraw.
    // Re-implementing startDraw to store startX/startY
};

// Re-implementing startDraw and drawing to handle start coordinates properly
let startX, startY;

const startDrawFixed = (e) => {
    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(startX, startY);

    if (['rect', 'circle', 'line'].includes(currentTool)) {
        snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    } else if (currentTool === 'fill') {
        floodFill(Math.floor(startX), Math.floor(startY), hexToRgba(currentColor));
        isDrawing = false;
    } else if (currentTool === 'picker') {
        pickColor(startX, startY);
        isDrawing = false;
    }
};

const drawingFixed = (e) => {
    if (!isDrawing) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.strokeStyle = currentColor;
    ctx.fillStyle = currentColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = currentOpacity;

    if (currentTool === 'brush') {
        ctx.lineTo(x, y);
        ctx.stroke();
    } else if (currentTool === 'eraser') {
        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha = 1;
        ctx.lineTo(x, y);
        ctx.stroke();
    } else if (['rect', 'circle', 'line'].includes(currentTool)) {
        ctx.putImageData(snapshot, 0, 0);
        ctx.beginPath();

        if (currentTool === 'rect') {
            let w = x - startX;
            let h = y - startY;
            ctx.rect(startX, startY, w, h);
            ctx.fill(); // Or stroke? Let's do fill for now or maybe stroke based on a toggle? 
            // Standard paint usually has outline or fill. Let's do stroke for now as it's simpler for a "lab"
            // Actually, let's do stroke to match the brush color/size
            ctx.stroke();
        } else if (currentTool === 'circle') {
            let radius = Math.sqrt(Math.pow((x - startX), 2) + Math.pow((y - startY), 2));
            ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
            ctx.stroke();
        } else if (currentTool === 'line') {
            ctx.moveTo(startX, startY);
            ctx.lineTo(x, y);
            ctx.stroke();
        }
    }
};

// Flood Fill Algorithm
const floodFill = (x, y, fillColor) => {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Get target color
    const targetColor = getPixelColor(data, x, y);

    // If target is same as fill, return
    if (colorsMatch(targetColor, fillColor)) return;

    const stack = [[x, y]];

    while (stack.length) {
        const [cx, cy] = stack.pop();
        const pixelIndex = (cy * canvas.width + cx) * 4;

        if (cx >= 0 && cx < canvas.width && cy >= 0 && cy < canvas.height) {
            if (colorsMatch(getPixelColor(data, cx, cy), targetColor)) {
                setPixelColor(data, pixelIndex, fillColor);

                stack.push([cx + 1, cy]);
                stack.push([cx - 1, cy]);
                stack.push([cx, cy + 1]);
                stack.push([cx, cy - 1]);
            }
        }
    }

    ctx.putImageData(imageData, 0, 0);
    saveState();
};

const getPixelColor = (data, x, y) => {
    const i = (y * canvas.width + x) * 4;
    return [data[i], data[i + 1], data[i + 2], data[i + 3]];
};

const setPixelColor = (data, i, color) => {
    data[i] = color[0];
    data[i + 1] = color[1];
    data[i + 2] = color[2];
    data[i + 3] = 255; // Force opaque for fill
};

const colorsMatch = (c1, c2) => {
    return c1[0] === c2[0] && c1[1] === c2[1] && c1[2] === c2[2]; // Ignoring alpha for simplicity in match
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

// Event Listeners
canvas.addEventListener('mousedown', startDrawFixed);
canvas.addEventListener('mousemove', drawingFixed);
canvas.addEventListener('mouseup', stopDraw);
canvas.addEventListener('mouseout', stopDraw);

toolBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelector('.tool-btn.active').classList.remove('active');
        btn.classList.add('active');
        currentTool = btn.dataset.tool;
    });
});

const setColor = (color) => {
    currentColor = color;
    colorPicker.value = color;
    colorPreview.style.backgroundColor = color;
};

colorPicker.addEventListener('input', (e) => setColor(e.target.value));

swatches.forEach(swatch => {
    swatch.addEventListener('click', () => setColor(swatch.dataset.color));
});

brushSizeInput.addEventListener('input', (e) => {
    brushSize = e.target.value;
    brushSizeVal.textContent = `${brushSize}px`;
});

opacityInput.addEventListener('input', (e) => {
    currentOpacity = e.target.value / 100;
    opacityVal.textContent = `${e.target.value}%`;
});

undoBtn.addEventListener('click', undo);
redoBtn.addEventListener('click', redo);

clearBtn.addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveState();
});

saveBtn.addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = `paint-lab-${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
});

// Keyboard Shortcuts
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
            e.preventDefault();
            undo();
        } else if (e.key === 'y') {
            e.preventDefault();
            redo();
        }
    }
});

// Init
window.addEventListener('load', initCanvas);
