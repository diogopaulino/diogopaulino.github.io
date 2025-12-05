const App = {
    emulator: null,
    basePath: window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1),
    settings: {
        scale: localStorage.getItem('emu-scale') || 'max',
        filter: localStorage.getItem('emu-filter') || 'sharp'
    },
    ui: {
        home: document.getElementById('home'),
        player: document.getElementById('player'),
        header: document.querySelector('header'),
        footer: document.querySelector('footer'),
        gameName: document.getElementById('game-name'),
        loader: document.getElementById('loader'),
        screen: document.getElementById('screen'),
        grid: document.getElementById('games-grid'),
        heroCard: document.querySelector('.hero-card'),
        fileInput: document.getElementById('rom-file-input')
    },

    init() {
        this.setupEventListeners();
        this.setupSettings();
        this.loadCatalog();
        window.handleImageError = (img, title) => this.handleImageError(img, title);
    },

    setupEventListeners() {
        // Navigation
        document.getElementById('btn-back')?.addEventListener('click', () => this.showHome());
        document.getElementById('btn-controls')?.addEventListener('click', () => this.showControls());
        document.getElementById('btn-fullscreen')?.addEventListener('click', () => this.toggleFullscreen());

        // File Input
        this.ui.fileInput?.addEventListener('change', e => {
            const file = e.target.files[0];
            if (file) this.startGame(file, file.name.replace(/\.[^/.]+$/, ''));
        });

        // Drag & Drop
        if (this.ui.heroCard) {
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                this.ui.heroCard.addEventListener(eventName, e => {
                    e.preventDefault();
                    e.stopPropagation();
                }, false);
            });

            ['dragenter', 'dragover'].forEach(eventName => {
                this.ui.heroCard.addEventListener(eventName, () => {
                    this.ui.heroCard.classList.add('drag-over');
                }, false);
            });

            ['dragleave', 'drop'].forEach(eventName => {
                this.ui.heroCard.addEventListener(eventName, () => {
                    this.ui.heroCard.classList.remove('drag-over');
                }, false);
            });

            this.ui.heroCard.addEventListener('drop', e => {
                const dt = e.dataTransfer;
                const files = dt.files;
                if (files && files.length > 0) {
                    this.ui.fileInput.files = files;
                    const event = new Event('change');
                    this.ui.fileInput.dispatchEvent(event);
                }
            }, false);
        }

        // Keyboard
        document.addEventListener('keydown', e => this.handleGlobalKeys(e));
        window.addEventListener('keydown', e => this.handleKeyRemap(e));
        window.addEventListener('keyup', e => this.handleKeyRemap(e));
    },

    setupSettings() {
        document.querySelectorAll('.btn-group').forEach(group => {
            const name = group.dataset.setting;
            if (this.settings[name]) {
                group.querySelectorAll('button').forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.value === this.settings[name]);
                });
            }
            group.querySelectorAll('button').forEach(btn => {
                btn.addEventListener('click', () => {
                    this.saveSetting(name, btn.dataset.value);
                    group.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                });
            });
        });
    },

    saveSetting(name, value) {
        this.settings[name] = value;
        localStorage.setItem(`emu-${name}`, value);
        this.applySettings();
    },

    applySettings() {
        const canvas = this.ui.screen.querySelector('canvas');
        if (!canvas) return;

        canvas.className = '';
        canvas.style.filter = '';

        // Filter
        if (this.settings.filter === 'sharp') canvas.classList.add('filter-sharp');
        else if (this.settings.filter === 'smooth') canvas.classList.add('filter-smooth');

        // Scale
        if (this.settings.scale === 'max') {
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            canvas.style.objectFit = 'contain';
        } else if (this.settings.scale === 'stretch') {
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            canvas.style.objectFit = 'fill';
        }
    },

    showHome() {
        document.body.classList.remove('game-mode');
        this.ui.home.classList.remove('hidden');
        this.ui.player.classList.add('hidden');
        this.ui.player.setAttribute('aria-hidden', 'true');
        this.ui.header.style.display = 'flex';
        this.ui.footer.style.display = 'block';
        if (document.fullscreenElement) document.exitFullscreen();
        this.stopEmulator();
    },

    showPlayer(name) {
        document.body.classList.add('game-mode');
        this.ui.home.classList.add('hidden');
        this.ui.player.classList.remove('hidden');
        this.ui.player.setAttribute('aria-hidden', 'false');
        this.ui.header.style.display = 'none';
        this.ui.footer.style.display = 'none';
        this.ui.gameName.textContent = name;
    },

    toggleFullscreen() {
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            this.ui.player.requestFullscreen?.();
        }
    },

    showControls() {
        if (document.getElementById('controls-overlay')) return document.getElementById('controls-overlay').remove();

        const overlay = document.createElement('div');
        overlay.id = 'controls-overlay';
        overlay.className = 'controls-overlay';
        overlay.innerHTML = `
            <div class="controls-modal">
                <div class="controls-modal-header">
                    <span class="controls-modal-title">Controles</span>
                    <button class="controls-modal-close" aria-label="Fechar">
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
                <div class="controls-modal-footer" style="margin-top: 1.5rem; text-align: center; font-size: 0.8rem; color: var(--text-tertiary);">
                    Clique fora para fechar
                </div>
            </div>
        `;

        overlay.addEventListener('click', e => {
            if (e.target === overlay) overlay.remove();
        });
        overlay.querySelector('.controls-modal-close').addEventListener('click', () => overlay.remove());
        this.ui.player.appendChild(overlay);
    },

    handleGlobalKeys(e) {
        if (e.key === 'Escape') {
            const overlay = document.getElementById('controls-overlay');
            if (overlay) {
                overlay.remove();
            } else if (document.fullscreenElement) {
                document.exitFullscreen();
            } else if (!this.ui.player.classList.contains('hidden')) {
                this.showHome();
            }
        }
        if (e.key.toLowerCase() === 'f' && !this.ui.player.classList.contains('hidden')) {
            this.toggleFullscreen();
        }
    },

    handleKeyRemap(e) {
        if (this.ui.player.classList.contains('hidden')) return;

        // Map A/S/D to Z/X/C (Standard Emulator Keys)
        const map = {
            'a': { key: 'z', code: 'KeyZ', keyCode: 90 },
            's': { key: 'x', code: 'KeyX', keyCode: 88 },
            'd': { key: 'c', code: 'KeyC', keyCode: 67 }
        }[e.key.toLowerCase()];

        if (map && e.isTrusted) {
            const evt = new KeyboardEvent(e.type, {
                key: map.key,
                code: map.code,
                keyCode: map.keyCode,
                which: map.keyCode,
                bubbles: true,
                cancelable: true,
                view: window
            });
            Object.defineProperty(evt, 'keyCode', { value: map.keyCode });
            Object.defineProperty(evt, 'which', { value: map.keyCode });
            window.dispatchEvent(evt);
        }
    },

    async startGame(rom, name) {
        this.showPlayer(name);
        this.ui.loader.classList.remove('hidden');

        try {
            await this.stopEmulator();

            const canvas = document.createElement('canvas');
            this.ui.screen.appendChild(canvas);

            const core = this.getCore(typeof rom === 'string' ? rom : rom.name);

            this.emulator = await Nostalgist.launch({
                core,
                rom,
                resolveCoreJs: c => this.basePath + 'lib/' + c + '_libretro.js',
                resolveCoreWasm: c => this.basePath + 'lib/' + c + '_libretro.wasm',
                resolveRom: f => typeof f === 'string' && f.startsWith('http') ? f : this.basePath + f,
                element: canvas
            });

            this.applySettings();
            this.ui.loader.classList.add('hidden');
        } catch (e) {
            console.error(e);
            this.ui.loader.classList.add('hidden');
            this.ui.screen.innerHTML = `<div class="error"><p>Erro ao carregar: ${e.message}</p><button onclick="App.showHome()">Voltar</button></div>`;
        }
    },

    async stopEmulator() {
        if (this.emulator) {
            try {
                await this.emulator.exit();
            } catch (e) { }
            this.emulator = null;
        }
        this.ui.screen.querySelector('canvas')?.remove();
    },

    getCore(f) {
        const ext = f.split('.').pop().toLowerCase();
        return ['sfc', 'smc'].includes(ext) ? 'snes9x' : 'genesis_plus_gx';
    },

    async loadCatalog() {
        try {
            if (typeof gamesCatalog !== 'undefined') {
                this.allGames = gamesCatalog;
                // Optimization: Render only a random subset for the background to improve performance
                this.renderGames(this.allGames);
            } else {
                throw new Error('Catálogo não encontrado');
            }
        } catch (e) {
            console.error(e);
            this.ui.grid.innerHTML = '';
        }
    },

    renderGames(games) {
        if (!this.ui.grid) return;

        // Shuffle and slice to avoid rendering thousands of nodes for a background
        const shuffled = [...games].sort(() => 0.5 - Math.random());
        const subset = shuffled.slice(0, 100); // Render 100 random games to ensure coverage after removals

        this.ui.grid.innerHTML = subset.map(g => {
            const t = g.title.replace(/"/g, '&quot;');
            return `
                <div class="game-card">
                    <div class="game-cover">
                        <img src="${g.cover}" alt="${t}" loading="lazy" data-title="${t}" onerror="handleImageError(this,this.dataset.title)">
                    </div>
                </div>
            `;
        }).join('');
    },

    handleImageError(img, title) {
        let variations = img.variationsList;
        let attempts = parseInt(img.dataset.attempts || '0');

        if (!variations) {
            const base = 'https://raw.githubusercontent.com/libretro-thumbnails/Sega_-_Mega_Drive_-_Genesis/master/Named_Boxarts/';
            const enc = (s) => encodeURIComponent(s);
            const cleanBase = title.replace(/[:\/\?]/g, '_');

            // Generate Title Variations
            const titleVars = [
                cleanBase,
                cleanBase.replace(/'/g, '_'),
                cleanBase.replace(/'/g, ''),
                cleanBase.replace(/^The\s+/, ''),
                cleanBase.replace(/^Disney's\s+/, ''),
                cleanBase.replace(/^The\s+(.+)/, '$1, The'),
                cleanBase.replace(/\s-\s/g, ': '),
                cleanBase.replace(/:\s/g, ' - '),
                cleanBase.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()),
                cleanBase.replace(/&/g, 'and'),
                cleanBase.replace(/\sand\s/g, ' & '),
                cleanBase.split(' - ')[0],
                cleanBase.split(': ')[0]
            ];

            const regions = ['(USA)', '(USA, Europe)', '(World)', '(Europe)', '(Japan)', ''];
            let generatedVariations = [];

            titleVars.forEach(t => {
                regions.forEach(r => {
                    generatedVariations.push(`${base}${enc(t)}${r ? '%20' + enc(r) : ''}.png`);
                });
            });

            variations = [...new Set(generatedVariations)];
            img.variationsList = variations;
        }

        if (attempts >= variations.length) {
            // Remove the parent card completely if image fails to load
            const card = img.closest('.game-card');
            if (card) card.remove();
            return;
        }

        img.dataset.attempts = attempts + 1;
        img.src = variations[attempts];
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
