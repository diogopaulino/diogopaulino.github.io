let emulator = null;

const $ = id => document.getElementById(id);
const basePath = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
const SONIC_ROM = basePath + 'roms/mega-drive/sonic.md';

const settings = {
    scale: ['max', 'stretch'].includes(localStorage.getItem('emu-scale')) ? localStorage.getItem('emu-scale') : 'max',
    filter: ['sharp', 'smooth'].includes(localStorage.getItem('emu-filter')) ? localStorage.getItem('emu-filter') : 'sharp'
};

function showHome() {
    $('home').classList.remove('hidden');
    $('player').classList.add('hidden');
    document.querySelector('header').style.display = 'flex';
    document.querySelector('footer').style.display = 'block';
    if (document.fullscreenElement) {
        document.exitFullscreen();
    }
    stopEmulator();
}

function showPlayer(name) {
    $('home').classList.add('hidden');
    $('player').classList.remove('hidden');
    document.querySelector('header').style.display = 'none';
    document.querySelector('footer').style.display = 'none';
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
    if (canvas) canvas.remove();
}

function applySettings() {
    const screen = $('screen');
    const canvas = screen.querySelector('canvas');
    if (!canvas) return;

    // Reset classes
    canvas.className = '';
    canvas.style.filter = '';

    // Apply Filter Class
    if (settings.filter === 'sharp') canvas.classList.add('filter-sharp');
    else if (settings.filter === 'smooth') canvas.classList.add('filter-smooth');

    // Scale logic
    if (settings.scale === 'max') {
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.objectFit = 'contain';
    } else if (settings.scale === 'stretch') {
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.objectFit = 'fill';
    }
}

function updateSettingsUI() {
    // Buttons
    document.querySelectorAll('.btn-group').forEach(group => {
        const settingName = group.dataset.setting;
        if (settings[settingName]) {
            group.querySelectorAll('button').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.value === settings[settingName]);
            });
        }
    });

    // Sliders removed

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
                <div class="control-item"><kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> Botões A/B/C</div>
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

function getCore(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    if (['sfc', 'smc'].includes(ext)) return 'snes9x';
    return 'genesis_plus_gx';
}

async function startGame(rom, name) {
    showPlayer(name);
    showLoader(true);

    try {
        await stopEmulator();

        // Create a canvas for the emulator
        const canvas = document.createElement('canvas');
        $('screen').appendChild(canvas);

        const core = getCore(typeof rom === 'string' ? rom : rom.name);

        emulator = await Nostalgist.launch({
            core: core,
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

    // Sliders listeners removed

    // Key remapping for A/S/D -> Z/X/C
    const keyMap = {
        'a': { key: 'z', code: 'KeyZ', keyCode: 90 },
        's': { key: 'x', code: 'KeyX', keyCode: 88 },
        'd': { key: 'c', code: 'KeyC', keyCode: 67 },
    };

    const remapHandler = (e) => {
        if ($('player').classList.contains('hidden')) return;

        const mapping = keyMap[e.key.toLowerCase()];
        if (mapping && e.isTrusted) {
            const newEvent = new KeyboardEvent(e.type, {
                key: mapping.key,
                code: mapping.code,
                keyCode: mapping.keyCode,
                which: mapping.keyCode,
                bubbles: true,
                cancelable: true,
                view: window
            });

            Object.defineProperty(newEvent, 'keyCode', { value: mapping.keyCode });
            Object.defineProperty(newEvent, 'which', { value: mapping.keyCode });

            window.dispatchEvent(newEvent);
        }
    };

    window.addEventListener('keydown', remapHandler);
    window.addEventListener('keyup', remapHandler);

    updateSettingsUI();
}

document.addEventListener('DOMContentLoaded', init);
