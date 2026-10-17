document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const controlsPanel = document.getElementById('controlsPanel');
    const processBtn = document.getElementById('processBtn');
    const downloadAllBtn = document.getElementById('downloadAllBtn');
    const clearListBtn = document.getElementById('clearListBtn');
    const toastBanner = document.getElementById('toastBanner');
    const resultsGrid = document.getElementById('resultsGrid');
    const qualityRange = document.getElementById('qualityRange');
    const qualityValue = document.getElementById('qualityValue');
    const formatBtns = document.querySelectorAll('.format-btn');

    let currentFiles = [];
    const cardsByFile = new Map();
    const previewUrls = new Set();
    const resultUrls = new Set();
    let toastTimer = null;

    function showNotice(message) {
        if (!toastBanner) return;
        toastBanner.textContent = message;
        toastBanner.hidden = false;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            toastBanner.hidden = true;
        }, 4000);
    }

    function releasePreviewUrls() {
        previewUrls.forEach((url) => URL.revokeObjectURL(url));
        previewUrls.clear();
    }

    function releaseResultUrls() {
        resultUrls.forEach((url) => URL.revokeObjectURL(url));
        resultUrls.clear();
        cardsByFile.forEach((card) => delete card.dataset.resultUrl);
    }

    function releaseAllUrls() {
        releasePreviewUrls();
        releaseResultUrls();
    }

    function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, (char) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        })[char]);
    }

    window.addEventListener('pagehide', releaseAllUrls);

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

    if (downloadAllBtn) {
        downloadAllBtn.addEventListener('click', () => {
            const links = resultsGrid.querySelectorAll('a.download-btn');
            links.forEach((a, idx) => {
                setTimeout(() => a.click(), idx * 140);
            });
        });
    }

    if (clearListBtn) {
        clearListBtn.addEventListener('click', () => {
            releaseAllUrls();
            cardsByFile.clear();
            currentFiles = [];
            resultsGrid.innerHTML = '';
            controlsPanel.style.display = 'none';
            if (downloadAllBtn) downloadAllBtn.hidden = true;
            fileInput.value = '';
        });
    }

    function handleFiles(files) {
        const validFiles = Array.from(files).filter(file => file.type.startsWith('image/'));

        if (validFiles.length === 0) {
            showNotice('Por favor, selecione apenas arquivos de imagem válidos (JPG, PNG, WebP).');
            return;
        }

        releaseAllUrls();
        cardsByFile.clear();
        currentFiles = validFiles;
        controlsPanel.style.display = 'flex';
        if (downloadAllBtn) downloadAllBtn.hidden = true;

        // Clear previous results
        resultsGrid.innerHTML = '';

        // Show initial previews
        validFiles.forEach((file, index) => createPreviewCard(file, index));
    }

    function createPreviewCard(file, index) {
        const card = document.createElement('div');
        card.className = 'image-card';
        card.id = `image-card-${index}`;
        cardsByFile.set(file, card);

        const safeName = escapeHtml(file.name);
        const url = URL.createObjectURL(file);
        previewUrls.add(url);
        card.innerHTML = `
            <div class="image-preview">
                <img src="${url}" alt="${safeName}">
                <span class="dimensions-pill" hidden></span>
            </div>
            <div class="card-info">
                <div class="file-name" title="${safeName}">${safeName}</div>
                <div class="stats-row">
                    <span>Original: ${formatBytes(file.size)}</span>
                    <span class="status">Aguardando...</span>
                </div>
            </div>
        `;
        const imgEl = card.querySelector('img');
        const dimPill = card.querySelector('.dimensions-pill');
        imgEl.onload = () => {
            if (dimPill && imgEl.naturalWidth) {
                dimPill.textContent = `${imgEl.naturalWidth} × ${imgEl.naturalHeight}`;
                dimPill.hidden = false;
            }
            card.dataset.origW = imgEl.naturalWidth;
            card.dataset.origH = imgEl.naturalHeight;
        };
        imgEl.onerror = () => markStatus(file, 'Falha ao ler imagem');
        resultsGrid.appendChild(card);
    }

    async function processAllFiles() {
        const maxWidthInput = document.getElementById('maxWidth').value;
        currentOptions.maxWidth = maxWidthInput ? parseInt(maxWidthInput) : 0;

        processBtn.disabled = true;
        processBtn.textContent = 'Processando...';

        for (const file of currentFiles) {
            const card = cardsByFile.get(file);
            if (card) {
                const status = card.querySelector('.status');
                if (status) {
                    status.classList.add('processing');
                    status.innerHTML = 'Processando<span class="progress-pulse"></span>';
                }
                card.classList.add('is-processing');
            }
            await processSingleFile(file);
            if (card) card.classList.remove('is-processing');
        }

        processBtn.disabled = false;
        processBtn.textContent = 'Processar Imagens';

        const readyCount = resultsGrid.querySelectorAll('a.download-btn').length;
        if (downloadAllBtn) {
            downloadAllBtn.hidden = readyCount < 2;
        }
    }

    function markStatus(file, text) {
        const status = cardsByFile.get(file)?.querySelector('.status');
        if (status) status.textContent = text;
    }

    function decodeWithElement(file) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                URL.revokeObjectURL(url);
                resolve(img);
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('read'));
            };
            img.src = url;
        });
    }

    function decodeImage(file) {
        if (typeof createImageBitmap !== 'function') return decodeWithElement(file);
        return createImageBitmap(file).catch(() => decodeWithElement(file));
    }

    async function processSingleFile(file) {
        let bitmap = null;
        try {
            bitmap = await decodeImage(file);
            const canvas = document.createElement('canvas');
            let width = bitmap.width;
            let height = bitmap.height;

            if (currentOptions.maxWidth > 0 && width > currentOptions.maxWidth) {
                const ratio = currentOptions.maxWidth / width;
                width = Math.round(currentOptions.maxWidth);
                height = Math.round(height * ratio);
            }

            canvas.width = width;
            canvas.height = height;
            canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);

            let outputFormat = currentOptions.format;
            if (outputFormat === 'original') {
                const encodable = ['image/jpeg', 'image/png', 'image/webp'];
                outputFormat = encodable.includes(file.type) ? file.type : 'image/png';
            }

            const blob = await new Promise((resolve) => {
                canvas.toBlob(resolve, outputFormat, currentOptions.quality);
            });
            if (!blob) {
                markStatus(file, 'Formato não suportado');
                return;
            }
            updateResultCard(file, blob, outputFormat, width, height);
        } catch {
            markStatus(file, 'Falha ao ler imagem');
        } finally {
            if (bitmap && typeof bitmap.close === 'function') bitmap.close();
        }
    }

    function updateResultCard(originalFile, newBlob, format, outWidth, outHeight) {
        const card = cardsByFile.get(originalFile);
        if (!card) return;

        const originalSize = originalFile.size;
        const newSize = newBlob.size;
        const diffPercent = ((newSize - originalSize) / originalSize * 100);
        const isSavings = newSize < originalSize;
        const isLarger = newSize > originalSize;

        const extension = format.split('/')[1] || 'png';
        const dot = originalFile.name.lastIndexOf('.');
        const base = dot > 0 ? originalFile.name.slice(0, dot) : originalFile.name;
        const newFileName = `${base}_opt.${extension}`;

        if (card.dataset.resultUrl) {
            URL.revokeObjectURL(card.dataset.resultUrl);
            resultUrls.delete(card.dataset.resultUrl);
        }
        const url = URL.createObjectURL(newBlob);
        card.dataset.resultUrl = url;
        resultUrls.add(url);
        const safeFileName = escapeHtml(newFileName);

        const dimPill = card.querySelector('.dimensions-pill');
        if (dimPill && outWidth && outHeight) {
            dimPill.textContent = `${outWidth} × ${outHeight}`;
            dimPill.hidden = false;
        }

        const deltaLabel = isSavings
            ? `${diffPercent.toFixed(1)}%`
            : isLarger
                ? `+${diffPercent.toFixed(1)}%`
                : '0%';
        const deltaClass = isSavings ? 'savings' : isLarger ? 'savings is-larger' : 'savings is-neutral';

        const infoDiv = card.querySelector('.card-info');
        infoDiv.innerHTML = `
            <div class="file-name" title="${safeFileName}">${safeFileName}</div>
            <div class="stats-row">
                <span>${formatBytes(originalSize)} → <strong>${formatBytes(newSize)}</strong></span>
                <span class="${deltaClass}">
                    ${deltaLabel}
                </span>
            </div>
            <div class="dims-meta">${outWidth} × ${outHeight} px</div>
            <a href="${url}" download="${safeFileName}" class="download-btn">
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
