let emulator = null;

const $ = id => document.getElementById(id);
const basePath = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);

const settings = {
    scale: ['max', 'stretch'].includes(localStorage.getItem('emu-scale')) ? localStorage.getItem('emu-scale') : 'max',
    filter: ['sharp', 'smooth'].includes(localStorage.getItem('emu-filter')) ? localStorage.getItem('emu-filter') : 'sharp'
};

function showHome() {
    document.body.classList.remove('game-mode');
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
    document.body.classList.add('game-mode');
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
    overlay.className = 'controls-overlay';

    overlay.innerHTML = `
        <div class="controls-modal">
            <div class="controls-modal-header">
                <span class="controls-modal-title">Controles</span>
                <button class="controls-modal-close">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
            </div>
            <div class="controls-grid">
                <div class="control-item"><kbd>↑↓←→</kbd> Movimento</div>
                <div class="control-item"><kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> Botões A/B/C</div>
                <div class="control-item"><kbd>Enter</kbd> Start</div>
                <div class="control-item"><kbd>Shift</kbd> Select</div>
                <div class="control-item"><kbd>F</kbd> Tela Cheia</div>
                <div class="control-item"><kbd>Esc</kbd> Sair/Voltar</div>
            </div>
            <div class="controls-modal-footer">
                Clique fora para fechar
            </div>
        </div>
    `;

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });

    overlay.querySelector('.controls-modal-close').addEventListener('click', () => overlay.remove());

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
    $('btn-back').addEventListener('click', showHome);

    $('btn-controls').addEventListener('click', showControls);

    const btnShowControls = $('btn-show-controls');
    if (btnShowControls) {
        btnShowControls.addEventListener('click', showControls);
    }

    $('btn-fullscreen').addEventListener('click', function () {
        const player = $('player');
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            player.requestFullscreen?.();
        }
        this.blur(); // Remove focus to prevent Enter key from triggering it again
    });

    // Removed old rom-file listener as it is now dynamic

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
    loadCatalog();
}

let allGames = [];

async function loadCatalog() {
    const grid = $('games-grid');
    if (!grid) return;

    // Attach listener to upload button
    const input = document.getElementById('rom-file-input');
    if (input) {
        // Remove old listeners to avoid duplicates if called multiple times
        const newClone = input.cloneNode(true);
        input.parentNode.replaceChild(newClone, input);
        newClone.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const name = file.name.replace(/\.[^/.]+$/, '');
                startGame(file, name);
            }
        });
    }

    try {
        // Use global catalog if available
        if (typeof gamesCatalog !== 'undefined') {
            allGames = gamesCatalog;
            renderGames(allGames);
        } else {
            throw new Error('Catálogo de jogos não encontrado (games.js)');
        }

        // Search functionality
        const searchInput = $('game-search');
        if (searchInput) {
            // Remove old listeners
            const newSearch = searchInput.cloneNode(true);
            searchInput.parentNode.replaceChild(newSearch, searchInput);

            newSearch.addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase();
                const filtered = allGames.filter(g => g.title.toLowerCase().includes(term));
                renderGames(filtered);
            });
        }

    } catch (error) {
        console.error('Erro ao carregar catálogo:', error);
        grid.innerHTML = '<p style="color:var(--text-secondary); text-align:center; grid-column: 1/-1;">Erro ao carregar lista de jogos.</p>';
    }
}

// Helper to start game by ID to avoid escaping issues in HTML
window.startGameById = function (id) {
    const game = gamesCatalog.find(g => g.id === id);
    if (game) {
        startGame(game.file, game.title);
    } else {
        console.error('Jogo não encontrado:', id);
    }
};

function renderGames(games) {
    const grid = $('games-grid');
    if (!grid) return;

    if (games.length === 0) {
        grid.innerHTML = '<p style="color:var(--text-secondary); text-align:center; grid-column: 1/-1; padding: 2rem;">Nenhum jogo encontrado.</p>';
        return;
    }

    grid.innerHTML = games.map(game => {
        // Safe title for HTML attribute (only double quotes need escaping in attribute)
        const safeTitle = game.title.replace(/"/g, '&quot;');

        return `
        <button class="game-card" onclick="startGameById('${game.id}')">
            <div class="game-cover">
                <img src="${game.cover}" 
                     alt="${safeTitle}" 
                     loading="lazy" 
                     data-title="${safeTitle}"
                     onerror="handleImageError(this, this.dataset.title)">
                <div class="cover-placeholder">
                    <span>${game.title}</span>
                </div>
            </div>
            <div class="game-info">
                <div class="game-title" title="${safeTitle}">${game.title}</div>
                <div class="game-meta">
                    <span class="game-platform">${game.platform}</span>
                </div>
            </div>
        </button>
        `;
    }).join('');
}

// Global handler for image errors to try multiple sources
window.handleImageError = function (img, title) {
    const attempts = parseInt(img.dataset.attempts || '0');

    const base = 'https://raw.githubusercontent.com/libretro-thumbnails/Sega_-_Mega_Drive_-_Genesis/master/Named_Boxarts/';
    const enc = (s) => encodeURIComponent(s);

    // 1. Clean the title for Libretro (standard chars)
    // Libretro replaces : / ? with _
    const cleanBase = title.replace(/:/g, '_').replace(/\//g, '_').replace(/\?/g, '_');

    // Generate Title Variations
    const titleVars = [
        cleanBase,                                      // 1. Original: "Disney's Aladdin"
        cleanBase.replace(/'/g, '_'),                   // 2. Underscore quote: "Disney_s Aladdin"
        cleanBase.replace(/'/g, ''),                    // 3. Remove quote: "Disneys Aladdin"
        cleanBase.replace(/^The\s+/, ''),               // 4. Remove "The ": "Addams Family"
        cleanBase.replace(/^Disney's\s+/, ''),          // 5. Remove "Disney's ": "Aladdin"
        cleanBase.replace(/^The\s+(.+)/, '$1, The'),    // 6. Swap The: "Addams Family, The"
        cleanBase.replace(/\s-\s/g, ': '),              // 7. Subtitle colon: "Game: Subtitle"
        cleanBase.replace(/:\s/g, ' - '),               // 8. Subtitle dash: "Game - Subtitle"
        // 9. Force Title Case (capitalize every word)
        cleanBase.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()),
        // 10. Replace & with and
        cleanBase.replace(/&/g, 'and'),
        // 11. Replace and with &
        cleanBase.replace(/\sand\s/g, ' & '),
        // 12. Truncate at " - " (Get main title only)
        cleanBase.split(' - ')[0],
        // 13. Truncate at ": " (Get main title only)
        cleanBase.split(': ')[0]
    ];

    // Generate Region Variations
    const regions = [
        '(USA)',
        '(USA, Europe)',
        '(World)',
        '(Europe)',
        '(Japan)',
        ''
    ];

    // Create all combinations
    let variations = [];

    // Prioritize specific known tricky ones
    // e.g. "Altered Beast" often needs (USA, Europe)
    // e.g. "The Addams Family" often needs "Addams Family, The (USA)" or "(Europe)"

    titleVars.forEach(t => {
        regions.forEach(r => {
            // Construct filename: Title (Region).png or Title.png
            const filename = r ? `${t} ${r}.png` : `${t}.png`;
            // Encode ONLY the filename parts, but keep the structure
            // Actually, we just encode the whole thing because / is not allowed in filenames anyway
            variations.push(`${base}${enc(t)}${r ? '%20' + enc(r) : ''}.png`);
        });
    });

    // Remove duplicates
    const uniqueVariations = [...new Set(variations)];
    const maxAttempts = uniqueVariations.length;

    if (attempts >= maxAttempts) {
        // All attempts failed, show the CSS placeholder
        img.style.display = 'none';
        const placeholder = img.nextElementSibling;
        if (placeholder) {
            placeholder.style.display = 'flex';
        }
        return;
    }

    img.dataset.attempts = attempts + 1;
    img.src = uniqueVariations[attempts];
};

document.addEventListener('DOMContentLoaded', init);
