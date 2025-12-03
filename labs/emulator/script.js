// Clean Genesis Emulator with Nostalgist
document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('rom-input');
    const emulatorContainer = document.getElementById('emulator-container');

    // Debug: Check if elements exist
    console.log('Elements found:', {
        dropZone: !!dropZone,
        fileInput: !!fileInput,
        emulatorContainer: !!emulatorContainer
    });

    if (!dropZone || !fileInput || !emulatorContainer) {
        console.error('Missing elements!');
        return;
    }

    let nostalgist = null;

    // File input handler
    fileInput.addEventListener('change', (e) => {
        if (e.target.files[0]) loadROM(e.target.files[0]);
    });

    // Drag & drop handlers
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
        console.log('loadROM called with:', file.name, file.type, file.size);

        // Validate file
        const validExts = ['.md', '.bin', '.gen', '.smd', '.zip'];
        if (!validExts.some(ext => file.name.toLowerCase().endsWith(ext))) {
            alert('Invalid file! Use: .md, .bin, .gen, .smd, .zip');
            return;
        }

        console.log('File validated, showing loading...');
        showLoading();

        try {
            // Hide drop zone, show emulator
            dropZone.classList.add('hidden');
            emulatorContainer.classList.add('active');
            console.log('UI updated, launching Nostalgist...');

            // Clean previous instance
            if (nostalgist) {
                console.log('Cleaning previous instance...');
                await nostalgist.exit();
                emulatorContainer.innerHTML = '';
            }

            // Launch Nostalgist
            console.log('Launching Nostalgist with:', emulatorContainer);
            nostalgist = await Nostalgist.launch({
                element: emulatorContainer,
                rom: file,
                core: 'genesis_plus_gx',
                resolveCoreJs: (core) => `lib/${core}_libretro.js`,
                resolveCoreWasm: (core) => `lib/${core}_libretro.wasm`,
                style: {
                    width: '100%',
                    height: '100%'
                }
            });

            hideLoading();
            console.log('✓ ROM loaded successfully:', file.name);

        } catch (error) {
            console.error('✗ Error loading ROM:', error);
            console.error('Error stack:', error.stack);
            alert('Failed to load ROM:\n' + error.message);
            hideLoading();
            dropZone.classList.remove('hidden');
            emulatorContainer.classList.remove('active');
        }
    }

    function showLoading() {
        const loading = document.createElement('div');
        loading.className = 'loading-overlay';
        loading.innerHTML = `
            <div class="spinner"></div>
            <div>Loading ROM...</div>
        `;
        emulatorContainer.appendChild(loading);
    }

    function hideLoading() {
        const loading = emulatorContainer.querySelector('.loading-overlay');
        if (loading) setTimeout(() => loading.remove(), 1000);
    }

    console.log('Genesis Emulator ready');
});
