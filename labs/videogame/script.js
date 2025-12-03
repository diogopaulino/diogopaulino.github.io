let emulator = null;

const $ = id => document.getElementById(id);
const basePath = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
const SONIC_ROM = basePath + 'roms/mega-drive/sonic.md';

const settings = {
    scale: localStorage.getItem('emu-scale') || 'max',
    filter: localStorage.getItem('emu-filter') || 'sharp'
};

function showHome() {
    $('home').classList.remove('hidden');
    $('player').classList.add('hidden');
    if (document.fullscreenElement) {
        document.exitFullscreen();
    }
    stopEmulator();
}

function showPlayer(name) {
    $('home').classList.add('hidden');
    $('player').classList.remove('hidden');
    $('game-name').textContent = name;
}

function showLoader(show) {
    $('loader').classList.toggle('hidden', !show);
}

async function stopEmulator() {
    if (emulator) {
        try { await emulator.exit(); } catch (e) { }
        emulator = null;
    }
    const screen = $('screen');
    const canvas = screen.querySelector('canvas');
    const crtOverlay = screen.querySelector('.crt-overlay');
    if (canvas) canvas.remove();
    if (crtOverlay) crtOverlay.remove();
}

function applySettings() {
    const screen = $('screen');
    const canvas = screen.querySelector('canvas');
    if (!canvas) return;

    // Filter logic
    canvas.style.imageRendering = settings.filter === 'smooth' ? 'auto' : 'pixelated';

    if (settings.filter === 'crt') {
        canvas.style.filter = 'contrast(1.2) brightness(1.1) saturate(1.2)';
    } else {
        canvas.style.filter = '';
    }

    // Scale logic
    if (settings.scale === 'max') {
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.objectFit = 'contain';
    } else {
        const baseWidth = 320;
        const baseHeight = 224;
        const scale = parseInt(settings.scale);
        canvas.style.width = `${baseWidth * scale}px`;
        canvas.style.height = `${baseHeight * scale}px`;
        canvas.style.objectFit = 'contain';
    }

    // CRT Overlay
    let crtOverlay = screen.querySelector('.crt-overlay');
    if (settings.filter === 'crt') {
        if (!crtOverlay) {
            crtOverlay = document.createElement('div');
            crtOverlay.className = 'crt-overlay';
            screen.appendChild(crtOverlay);
        }
    } else if (crtOverlay) {
        crtOverlay.remove();
    }
}

function updateSettingsUI() {
    document.querySelectorAll('.btn-group').forEach(group => {
        const settingName = group.dataset.setting;
        if (settings[settingName]) {
            group.querySelectorAll('button').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.value === settings[settingName]);
            });
        }
    });
}

function saveSetting(name, value) {
    settings[name] = value;
    localStorage.setItem(`emu-${name}`, value);
    applySettings();
    updateSettingsUI();
}

function showControls() {
    const existing = $('controls-overlay');
    if (existing) {
        existing.remove();
        return;
    }

    const overlay = document.createElement('div');
    overlay.id = 'controls-overlay';
    overlay.style.cssText = `
        position: absolute;
        inset: 0;
        background: rgba(0,0,0,0.85);
        backdrop-filter: blur(5px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 60;
        animation: fadeIn 0.2s;
    `;

    overlay.innerHTML = `
        <div class="panel" style="max-width: 400px; width: 90%; pointer-events: auto;">
            <div class="panel-title" style="justify-content: space-between;">
                <span>Controles</span>
                <button onclick="this.closest('#controls-overlay').remove()" style="background:none;border:none;color:white;cursor:pointer;">✕</button>
            </div>
            <div class="controls-grid">
                <div class="control-item"><kbd>↑↓←→</kbd> Movimento</div>
                <div class="control-item"><kbd>Z</kbd> <kbd>X</kbd> <kbd>C</kbd> Botões A/B/C</div>
                <div class="control-item"><kbd>Enter</kbd> Start</div>
                <div class="control-item"><kbd>Shift</kbd> Select</div>
                <div class="control-item"><kbd>F</kbd> Tela Cheia</div>
                <div class="control-item"><kbd>Esc</kbd> Sair</div>
            </div>
            <div style="margin-top: 1rem; text-align: center; font-size: 0.8rem; color: var(--text-secondary);">
                Clique em qualquer lugar para fechar
            </div>
        </div>
    `;

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });

    $('player').appendChild(overlay);
}

async function startGame(rom, name) {
    showPlayer(name);
    showLoader(true);

    try {
        await stopEmulator();

        // Create a canvas for the emulator
        const canvas = document.createElement('canvas');
        $('screen').appendChild(canvas);

        emulator = await Nostalgist.launch({
            core: 'genesis_plus_gx',
            rom: rom,
            resolveCoreJs: (core) => basePath + 'lib/' + core + '_libretro.js',
            resolveCoreWasm: (core) => basePath + 'lib/' + core + '_libretro.wasm',
            resolveRom: (file) => typeof file === 'string' && file.startsWith('http') ? file : basePath + file,
            element: canvas
        });

        // Ensure settings are applied to the active canvas
        applySettings();

        showLoader(false);
    } catch (error) {
        console.error('Erro:', error);
        showLoader(false);
        $('screen').innerHTML = `
            <div class="error">
                <p>Erro ao carregar: ${error.message}</p>
                <button onclick="showHome()">Voltar</button>
            </div>
        `;
    }
}

function init() {
    $('play-sonic').addEventListener('click', () => {
        startGame(SONIC_ROM, 'Sonic The Hedgehog');
    });

    $('btn-back').addEventListener('click', showHome);

    $('btn-controls').addEventListener('click', showControls);

    $('btn-fullscreen').addEventListener('click', () => {
        const player = $('player');
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            player.requestFullscreen?.();
        }
    });

    $('rom-file').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const name = file.name.replace(/\.[^/.]+$/, '');
            startGame(file, name);
        }
    });

    document.querySelectorAll('.btn-group').forEach(group => {
        const settingName = group.dataset.setting;
        group.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => {
                saveSetting(settingName, btn.dataset.value);
            });
        });
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if ($('controls-overlay')) {
                $('controls-overlay').remove();
            } else if (document.fullscreenElement) {
                document.exitFullscreen();
            } else if (!$('player').classList.contains('hidden')) {
                showHome();
            }
        }
        if (e.key.toLowerCase() === 'f' && !$('player').classList.contains('hidden')) {
            $('btn-fullscreen').click();
        }
    });

    // Add animation style for fade in
    const style = document.createElement('style');
    style.textContent = `@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`;
    document.head.appendChild(style);

    updateSettingsUI();
}

document.addEventListener('DOMContentLoaded', init);
