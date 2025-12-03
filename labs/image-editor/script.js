// DOM Elements
const fileInput = document.getElementById('fileInput');
const uploadPlaceholder = document.getElementById('uploadPlaceholder');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const controlsArea = document.getElementById('controlsArea');
const resetBtn = document.getElementById('resetBtn');
const saveBtn = document.getElementById('saveBtn');

// Tabs
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Controls
const brightnessInput = document.getElementById('brightness');
const contrastInput = document.getElementById('contrast');
const saturationInput = document.getElementById('saturation');
const blurInput = document.getElementById('blur');
const filterBtns = document.querySelectorAll('.filter-btn');
const rotateLeftBtn = document.getElementById('rotateLeft');
const rotateRightBtn = document.getElementById('rotateRight');
const flipHBtn = document.getElementById('flipHorizontal');
const flipVBtn = document.getElementById('flipVertical');

// State
let originalImage = null;
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

// Filter Presets
const filters = {
    none: '',
    grayscale: 'grayscale(100%)',
    sepia: 'sepia(100%)',
    invert: 'invert(100%)',
    vintage: 'sepia(50%) contrast(120%) brightness(90%)',
    kodachrome: 'sepia(30%) contrast(120%) saturate(130%)',
    technicolor: 'contrast(150%) saturate(150%) hue-rotate(-10deg)',
    polaroid: 'sepia(20%) brightness(110%) contrast(90%) saturate(80%)'
};

// Initialize
function init() {
    controlsArea.classList.add('disabled');
    setupEventListeners();
}

function setupEventListeners() {
    // Upload
    uploadPlaceholder.addEventListener('click', () => fileInput.click());
    uploadPlaceholder.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadPlaceholder.style.borderColor = 'var(--accent)';
    });
    uploadPlaceholder.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadPlaceholder.style.borderColor = 'var(--border-subtle)';
    });
    uploadPlaceholder.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadPlaceholder.style.borderColor = 'var(--border-subtle)';
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    });
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleFile(file);
    });

    // Tabs
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`${btn.dataset.tab}-tab`).classList.add('active');
        });
    });

    // Adjustments
    [brightnessInput, contrastInput, saturationInput, blurInput].forEach(input => {
        input.addEventListener('input', updateState);
    });

    // Filters
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.filter = btn.dataset.filter;
            render();
        });
    });

    // Transforms
    rotateLeftBtn.addEventListener('click', () => {
        state.rotate -= 90;
        render();
    });
    rotateRightBtn.addEventListener('click', () => {
        state.rotate += 90;
        render();
    });
    flipHBtn.addEventListener('click', () => {
        state.flipH *= -1;
        render();
    });
    flipVBtn.addEventListener('click', () => {
        state.flipV *= -1;
        render();
    });

    // Actions
    resetBtn.addEventListener('click', resetEditor);
    saveBtn.addEventListener('click', saveImage);
}

function handleFile(file) {
    if (!file.type.match('image.*')) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        originalImage = new Image();
        originalImage.onload = () => {
            canvas.width = originalImage.width;
            canvas.height = originalImage.height;
            uploadPlaceholder.style.display = 'none';
            canvas.style.display = 'block';
            controlsArea.classList.remove('disabled');
            resetEditor();
        };
        originalImage.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function updateState() {
    state.brightness = brightnessInput.value;
    state.contrast = contrastInput.value;
    state.saturation = saturationInput.value;
    state.blur = blurInput.value;

    // Update UI values
    brightnessInput.previousElementSibling.querySelector('.value').textContent = `${state.brightness}%`;
    contrastInput.previousElementSibling.querySelector('.value').textContent = `${state.contrast}%`;
    saturationInput.previousElementSibling.querySelector('.value').textContent = `${state.saturation}%`;
    blurInput.previousElementSibling.querySelector('.value').textContent = `${state.blur}px`;

    render();
}

function render() {
    if (!originalImage) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Save context state
    ctx.save();

    // Handle Rotation and Flip
    // To rotate around center, we need to translate to center, rotate, then translate back
    // However, canvas dimensions might need to swap if rotated 90/270 degrees
    // For simplicity in this "lab", we will keep canvas size fixed to image size
    // and just rotate the drawing context.
    // A more robust solution would resize the canvas.

    // Let's implement proper canvas resizing for rotation
    const angleInRadians = state.rotate * Math.PI / 180;
    const absSin = Math.abs(Math.sin(angleInRadians));
    const absCos = Math.abs(Math.cos(angleInRadians));

    const newWidth = originalImage.width * absCos + originalImage.height * absSin;
    const newHeight = originalImage.width * absSin + originalImage.height * absCos;

    canvas.width = newWidth;
    canvas.height = newHeight;

    // Move to center
    ctx.translate(newWidth / 2, newHeight / 2);

    // Rotate
    ctx.rotate(angleInRadians);

    // Flip
    ctx.scale(state.flipH, state.flipV);

    // Apply Filters
    // Combine manual adjustments with preset filters
    const adjustments = `brightness(${state.brightness}%) contrast(${state.contrast}%) saturate(${state.saturation}%) blur(${state.blur}px)`;
    const preset = filters[state.filter];
    ctx.filter = `${adjustments} ${preset}`.trim();

    // Draw image centered
    ctx.drawImage(originalImage, -originalImage.width / 2, -originalImage.height / 2);

    ctx.restore();
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

    // Reset UI
    brightnessInput.value = 100;
    contrastInput.value = 100;
    saturationInput.value = 100;
    blurInput.value = 0;

    filterBtns.forEach(b => b.classList.remove('active'));
    document.querySelector('[data-filter="none"]').classList.add('active');

    updateState();
}

function saveImage() {
    const link = document.createElement('a');
    link.download = 'edited-image.png';
    link.href = canvas.toDataURL();
    link.click();
}

// Theme Logic handled by shared.js

// Start
init();
