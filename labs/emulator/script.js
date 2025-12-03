document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('rom-input');
    const emulatorContainer = document.getElementById('emulator-container');

    if (!dropZone || !fileInput || !emulatorContainer) {
        console.error('Missing elements!');
        return;
    }

    let nostalgist = null;

    fileInput.addEventListener('change', (e) => {
        if (e.target.files[0]) loadROM(e.target.files[0]);
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        if (e.dataTransfer.files[0]) loadROM(e.dataTransfer.files[0]);
    });

    async function loadROM(file) {
        const validExts = ['.md', '.bin', '.gen', '.smd', '.zip'];
        if (!validExts.some(ext => file.name.toLowerCase().endsWith(ext))) {
            alert('Invalid file! Use: .md, .bin, .gen, .smd, .zip');
            return;
        }

        try {
            dropZone.classList.add('hidden');
            emulatorContainer.classList.add('active');

            if (nostalgist) {
                try { await nostalgist.exit(); } catch (e) {}
                nostalgist = null;
            }

            emulatorContainer.innerHTML = '';
            const canvas = document.createElement('canvas');
            canvas.id = 'emulator-canvas';
            emulatorContainer.appendChild(canvas);

            showLoading('Loading emulator...');

            const href = window.location.href;
            const basePath = href.substring(0, href.lastIndexOf('/') + 1);
            
            nostalgist = await Nostalgist.launch({
                element: canvas,
                core: 'genesis_plus_gx',
                rom: file,
                resolveCoreJs: (core) => basePath + 'lib/' + core + '_libretro.js',
                resolveCoreWasm: (core) => basePath + 'lib/' + core + '_libretro.wasm'
            });
            
            hideLoading();

        } catch (error) {
            console.error('Error:', error);
            alert('Error: ' + error.message);
            resetUI();
        }
    }

    function showLoading(msg) {
        const loading = document.createElement('div');
        loading.className = 'loading-overlay';
        loading.innerHTML = `<div class="spinner"></div><div>${msg}</div>`;
        emulatorContainer.appendChild(loading);
    }

    function hideLoading() {
        const loading = emulatorContainer.querySelector('.loading-overlay');
        if (loading) loading.remove();
    }

    function resetUI() {
        hideLoading();
        dropZone.classList.remove('hidden');
        emulatorContainer.classList.remove('active');
    }
});
