document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('rom-input');
    const emulatorTarget = document.getElementById('emulator-target');
    const introScreen = document.getElementById('intro-screen');
    let nostalgistInstance = null;

    // Handle File Selection
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            loadRom(e.target.files[0]);
        }
    });

    // Handle Drag and Drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) {
            loadRom(e.dataTransfer.files[0]);
        }
    });

    async function loadRom(file) {
        // Show loading state
        showLoading();

        try {
            // If an instance already exists, exit it
            if (nostalgistInstance) {
                await nostalgistInstance.exit();
            }

            // Launch Nostalgist
            nostalgistInstance = await Nostalgist.launch({
                element: emulatorTarget,
                rom: file,
                core: 'genesis_plus_gx', // Reliable Genesis core
                style: {
                    width: '100%',
                    height: '100%',
                    position: 'absolute',
                    top: '0',
                    left: '0',
                    zIndex: '5' // Below scanlines
                }
            });

            // Hide intro screen if successful
            introScreen.style.display = 'none';

        } catch (error) {
            console.error('Failed to load ROM:', error);
            alert('Error loading ROM. Please try another file or check your internet connection (needed to download the emulator core).');
            hideLoading();
        }
    }

    function showLoading() {
        const loading = document.createElement('div');
        loading.className = 'loading-overlay';
        loading.innerHTML = `
            <div class="spinner"></div>
            <div>LOADING SYSTEM...</div>
        `;
        emulatorTarget.appendChild(loading);
    }

    function hideLoading() {
        const loading = emulatorTarget.querySelector('.loading-overlay');
        if (loading) {
            loading.remove();
        }
    }
});
