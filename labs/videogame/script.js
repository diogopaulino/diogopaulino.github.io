let emulator = null;

const $ = id => document.getElementById(id);
const basePath = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
const SONIC_ROM = basePath + 'roms/mega-drive/sonic.md';

function showHome() {
    $('home').classList.remove('hidden');
    $('player').classList.add('hidden');
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
    if (canvas) canvas.remove();
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
            resolveCoreWasm: (core) => basePath + 'lib/' + core + '_libretro.wasm'
        });

        const canvas = emulator.getCanvas();
        if (canvas) {
            $('screen').appendChild(canvas);
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
        const screen = $('screen');
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            screen.requestFullscreen?.();
        }
    });

    $('rom-file').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const name = file.name.replace(/\.[^/.]+$/, '');
            startGame(file, name);
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !$('player').classList.contains('hidden')) {
            showHome();
        }
    });
}

document.addEventListener('DOMContentLoaded', init);
