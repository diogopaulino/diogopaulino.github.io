document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const controlsPanel = document.getElementById('controlsPanel');
    const processBtn = document.getElementById('processBtn');
    const resultsGrid = document.getElementById('resultsGrid');
    const qualityRange = document.getElementById('qualityRange');
    const qualityValue = document.getElementById('qualityValue');
    const formatBtns = document.querySelectorAll('.format-btn');

    let currentFiles = [];
    let currentOptions = {
        format: 'original',
        quality: 0.8,
        maxWidth: 0 // 0 means auto/original
    };

    // Event Listeners
    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });

    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });

    qualityRange.addEventListener('input', (e) => {
        const val = e.target.value;
        qualityValue.textContent = `${val}%`;
        currentOptions.quality = val / 100;
    });

    formatBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            formatBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentOptions.format = btn.dataset.format;

            // Disable quality for PNG as it's lossless
            if (currentOptions.format === 'image/png') {
                qualityRange.disabled = true;
                qualityRange.parentElement.style.opacity = '0.5';
            } else {
                qualityRange.disabled = false;
                qualityRange.parentElement.style.opacity = '1';
            }
        });
    });

    processBtn.addEventListener('click', processAllFiles);

    function handleFiles(files) {
        const validFiles = Array.from(files).filter(file => file.type.startsWith('image/'));

        if (validFiles.length === 0) {
            alert('Por favor, selecione apenas arquivos de imagem.');
            return;
        }

        currentFiles = validFiles;
        controlsPanel.style.display = 'flex';

        // Clear previous results
        resultsGrid.innerHTML = '';

        // Show initial previews
        validFiles.forEach(createPreviewCard);
    }

    function createPreviewCard(file) {
        const card = document.createElement('div');
        card.className = 'image-card';
        card.id = `card-${file.name.replace(/[^a-zA-Z0-9]/g, '')}`; // Simple ID sanitization

        const reader = new FileReader();
        reader.onload = (e) => {
            card.innerHTML = `
                <div class="image-preview">
                    <img src="${e.target.result}" alt="${file.name}">
                </div>
                <div class="card-info">
                    <div class="file-name" title="${file.name}">${file.name}</div>
                    <div class="stats-row">
                        <span>Original: ${formatBytes(file.size)}</span>
                        <span class="status">Aguardando...</span>
                    </div>
                </div>
            `;
        };
        reader.readAsDataURL(file);
        resultsGrid.appendChild(card);
    }

    async function processAllFiles() {
        const maxWidthInput = document.getElementById('maxWidth').value;
        currentOptions.maxWidth = maxWidthInput ? parseInt(maxWidthInput) : 0;

        processBtn.disabled = true;
        processBtn.textContent = 'Processando...';

        for (const file of currentFiles) {
            await processSingleFile(file);
        }

        processBtn.disabled = false;
        processBtn.textContent = 'Processar Imagens';
    }

    function processSingleFile(file) {
        return new Promise((resolve) => {
            const img = new Image();
            const reader = new FileReader();

            reader.onload = (e) => {
                img.src = e.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    // Resize logic
                    if (currentOptions.maxWidth > 0 && width > currentOptions.maxWidth) {
                        const ratio = currentOptions.maxWidth / width;
                        width = currentOptions.maxWidth;
                        height = height * ratio;
                    }

                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // Determine output format
                    let outputFormat = currentOptions.format;
                    if (outputFormat === 'original') {
                        outputFormat = file.type;
                    }

                    // Convert to blob
                    canvas.toBlob((blob) => {
                        updateResultCard(file, blob, outputFormat);
                        resolve();
                    }, outputFormat, currentOptions.quality);
                };
            };
            reader.readAsDataURL(file);
        });
    }

    function updateResultCard(originalFile, newBlob, format) {
        const cardId = `card-${originalFile.name.replace(/[^a-zA-Z0-9]/g, '')}`;
        const card = document.getElementById(cardId);
        if (!card) return;

        const originalSize = originalFile.size;
        const newSize = newBlob.size;
        const savings = ((originalSize - newSize) / originalSize * 100).toFixed(1);
        const isSavings = newSize < originalSize;

        const extension = format.split('/')[1];
        const newFileName = originalFile.name.substring(0, originalFile.name.lastIndexOf('.')) + '_opt.' + extension;

        const url = URL.createObjectURL(newBlob);

        const infoDiv = card.querySelector('.card-info');
        infoDiv.innerHTML = `
            <div class="file-name" title="${newFileName}">${newFileName}</div>
            <div class="stats-row">
                <span>${formatBytes(newSize)}</span>
                <span class="savings" style="color: ${isSavings ? 'var(--success)' : 'var(--text-secondary)'}">
                    ${isSavings ? '-' + savings + '%' : '+0%'}
                </span>
            </div>
            <a href="${url}" download="${newFileName}" class="download-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Baixar
            </a>
        `;
    }

    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
});
