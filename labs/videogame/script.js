let emulator = null;

const $ = id => document.getElementById(id);
const basePath = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
const SONIC_ROM = basePath + 'roms/mega-drive/sonic.md';

const settings = {
    scale: localStorage.getItem('emu-scale') || '2',
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
        try { await emulator.exit(); } catch (e) {}
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

    canvas.style.imageRendering = settings.filter === 'smooth' ? 'auto' : 'pixelated';
    
    if (settings.filter === 'crt') {
        canvas.style.filter = 'contrast(1.1) brightness(0.95)';
    } else {
        canvas.style.filter = '';
    }

    const baseWidth = 320;
    const baseHeight = 224;
    const scale = parseInt(settings.scale);
    canvas.style.width = `${baseWidth * scale}px`;
    canvas.style.height = `${baseHeight * scale}px`;

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
    document.querySelectorAll('.setting-options').forEach(group => {
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

async function startGame(rom, name) {
    showPlayer(name);
    showLoader(true);

    try {
        await stopEmulator();

        emulator = await Nostalgist.launch({
            core: 'genesis_plus_gx',
            rom: rom,
            resolveCoreJs: (core) => basePath + 'lib/' + core + '_libretro.js',
            resolveCoreWasm: (core) => basePath + 'lib/' + core + '_libretro.wasm',
            resolveRom: (file) => typeof file === 'string' && file.startsWith('http') ? file : basePath + file
        });

        const canvas = emulator.getCanvas();
        if (canvas) {
            $('screen').appendChild(canvas);
            applySettings();
        }

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

    document.querySelectorAll('.setting-options').forEach(group => {
        const settingName = group.dataset.setting;
        group.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => {
                saveSetting(settingName, btn.dataset.value);
            });
        });
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !$('player').classList.contains('hidden')) {
            showHome();
        }
    });

    updateSettingsUI();
}

document.addEventListener('DOMContentLoaded', init);
