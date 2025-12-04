let emulator = null;

const $ = id => document.getElementById(id);
const basePath = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);

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
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.85);
        backdrop-filter: blur(5px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        animation: fadeIn 0.2s;
    `;

    overlay.innerHTML = `
        <div class="panel" style="max-width: 400px; width: 90%; pointer-events: auto; box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
            <div class="panel-title" style="justify-content: space-between; margin-bottom: 1.5rem;">
                <span style="font-size: 1rem;">Controles</span>
                <button class="close-btn" style="background:none;border:none;color:var(--text-secondary);cursor:pointer;padding:0.5rem;">
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
            <div style="margin-top: 1.5rem; text-align: center; font-size: 0.8rem; color: var(--text-secondary);">
                Clique fora para fechar
            </div>
        </div>
    `;

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });

    overlay.querySelector('.close-btn').addEventListener('click', () => overlay.remove());

    document.body.appendChild(overlay);
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

    $('btn-fullscreen').addEventListener('click', () => {
        const player = $('player');
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            player.requestFullscreen?.();
        }
    });

    $('btn-fullscreen').addEventListener('click', () => {
        const player = $('player');
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            player.requestFullscreen?.();
        }
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
    loadCatalog();
}

let allGames = [];

async function loadCatalog() {
    const grid = $('games-grid');
    if (!grid) return;

    // Add Library Header (Search Only) if not exists
    if (!document.querySelector('.library-header')) {
        const header = document.createElement('div');
        header.className = 'library-header';
        header.innerHTML = `
            <div class="search-container">
                <svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                <input type="text" id="game-search" placeholder="Buscar jogos..." class="search-input">
            </div>
        `;
        grid.parentNode.insertBefore(header, grid);
    }

    // Add Footer with Upload Button if not exists
    if (!document.querySelector('.library-footer')) {
        const footer = document.createElement('div');
        footer.className = 'library-footer';
        footer.innerHTML = `
            <label class="upload-btn-footer">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Carregar ROM Local (.zip, .md, .gen)
                <input type="file" id="rom-file-footer" accept=".md,.bin,.gen,.smd,.zip,.sfc,.smc" hidden>
            </label>
        `;
        grid.parentNode.appendChild(footer);

        // Attach listener to the new footer upload button
        const input = document.getElementById('rom-file-footer');
        if (input) {
            input.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const name = file.name.replace(/\.[^/.]+$/, '');
                    startGame(file, name);
                }
            });
        }
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
            searchInput.addEventListener('input', (e) => {
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

function renderGames(games) {
    const grid = $('games-grid');
    if (!grid) return;

    if (games.length === 0) {
        grid.innerHTML = '<p style="color:var(--text-secondary); text-align:center; grid-column: 1/-1; padding: 2rem;">Nenhum jogo encontrado.</p>';
        return;
    }

    const gamesHTML = games.map(game => {
        // We will try to load the image. If it fails, the global handleImageError will take over.
        // We encode the title for the initial attempt.
        return `
        <button class="game-card" onclick="startGame('${game.file}', '${game.title.replace(/'/g, "\\'")}')">
            <div class="game-cover">
                <img src="${game.cover}" 
                     alt="${game.title}" 
                     loading="lazy" 
                     onerror="handleImageError(this, '${game.title.replace(/'/g, "\\'")}')">
                <div class="cover-placeholder">
                    <span>${game.title}</span>
                </div>
            </div>
            <div class="game-info">
                <div class="game-title" title="${game.title}">${game.title}</div>
                <div class="game-meta">
                    <span class="game-platform">${game.platform}</span>
                </div>
            </div>
        </button>
        `;
    }).join('');

    grid.innerHTML = gamesHTML;
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
        cleanBase.replace(/:\s/g, ' - ')                // 8. Subtitle dash: "Game - Subtitle"
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
