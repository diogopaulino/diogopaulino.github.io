const GAMES_LIBRARY = [
    { id: 'sonic-the-hedgehog', title: 'Sonic The Hedgehog', year: 1991, genre: 'platform', color: '#0066cc', rom: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Sonic%20the%20Hedgehog%20%28USA%2C%20Europe%29.md' },
    { id: 'sonic-2', title: 'Sonic 2', year: 1992, genre: 'platform', color: '#0088ff', rom: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Sonic%20the%20Hedgehog%202%20%28World%29.md' },
    { id: 'sonic-3', title: 'Sonic 3', year: 1994, genre: 'platform', color: '#00aaff', rom: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Sonic%20the%20Hedgehog%203%20%28USA%29.md' },
    { id: 'sonic-knuckles', title: 'Sonic & Knuckles', year: 1994, genre: 'platform', color: '#cc0000', rom: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Sonic%20%26%20Knuckles%20%28World%29.md' },
    { id: 'golden-axe', title: 'Golden Axe', year: 1989, genre: 'action', color: '#cc9900', rom: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Golden%20Axe%20%28World%29%20%28Rev%20A%29.md' },
    { id: 'golden-axe-2', title: 'Golden Axe II', year: 1991, genre: 'action', color: '#ddaa00', rom: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Golden%20Axe%20II%20%28World%29.md' },
    { id: 'golden-axe-3', title: 'Golden Axe III', year: 1993, genre: 'action', color: '#eebb00', rom: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Golden%20Axe%20III%20%28Japan%29.md' },
    { id: 'streets-of-rage', title: 'Streets of Rage', year: 1991, genre: 'action', color: '#8833aa', rom: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Streets%20of%20Rage%20%28USA%2C%20Europe%29.md' },
    { id: 'streets-of-rage-2', title: 'Streets of Rage 2', year: 1992, genre: 'action', color: '#9944bb', rom: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Streets%20of%20Rage%202%20%28USA%29.md' },
    { id: 'streets-of-rage-3', title: 'Streets of Rage 3', year: 1994, genre: 'action', color: '#aa55cc', rom: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Streets%20of%20Rage%203%20%28USA%29.md' },
    { id: 'mortal-kombat', title: 'Mortal Kombat', year: 1993, genre: 'fighting', color: '#222222', rom: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Mortal%20Kombat%20%28World%29.md' },
    { id: 'mortal-kombat-2', title: 'Mortal Kombat II', year: 1994, genre: 'fighting', color: '#333333', rom: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Mortal%20Kombat%20II%20%28World%29.md' },
    { id: 'mortal-kombat-3', title: 'Mortal Kombat 3', year: 1995, genre: 'fighting', color: '#444444', rom: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Mortal%20Kombat%203%20%28USA%29.md' },
    { id: 'shinobi-3', title: 'Shinobi III', year: 1993, genre: 'action', color: '#1a1a4d', rom: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Shinobi%20III%20-%20Return%20of%20the%20Ninja%20Master%20%28USA%29.md' },
    { id: 'altered-beast', title: 'Altered Beast', year: 1988, genre: 'action', color: '#4d3319', rom: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Altered%20Beast%20%28USA%2C%20Europe%29.md' },
    { id: 'earthworm-jim', title: 'Earthworm Jim', year: 1994, genre: 'platform', color: '#336633', rom: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Earthworm%20Jim%20%28USA%29.md' },
    { id: 'earthworm-jim-2', title: 'Earthworm Jim 2', year: 1995, genre: 'platform', color: '#448844', rom: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Earthworm%20Jim%202%20%28USA%29.md' },
    { id: 'aladdin', title: 'Aladdin', year: 1993, genre: 'platform', color: '#663399', rom: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Aladdin%20%28USA%29.md' },
    { id: 'lion-king', title: 'The Lion King', year: 1994, genre: 'platform', color: '#cc6600', rom: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Lion%20King%2C%20The%20%28World%29.md' },
    { id: 'jungle-book', title: 'Jungle Book', year: 1994, genre: 'platform', color: '#228822', rom: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Jungle%20Book%2C%20The%20%28USA%29.md' },
    { id: 'toe-jam-earl', title: 'ToeJam & Earl', year: 1991, genre: 'action', color: '#ff3366', rom: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/ToeJam%20%26%20Earl%20%28USA%2C%20Europe%29%20%28Rev%20A%29.md' },
    { id: 'phantasy-star-4', title: 'Phantasy Star IV', year: 1993, genre: 'rpg', color: '#3366cc', rom: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Phantasy%20Star%20IV%20%28USA%29.md' },
    { id: 'shining-force', title: 'Shining Force', year: 1992, genre: 'rpg', color: '#cc9933', rom: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Shining%20Force%20%28USA%29.md' },
    { id: 'shining-force-2', title: 'Shining Force II', year: 1993, genre: 'rpg', color: '#ddaa44', rom: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Shining%20Force%20II%20%28USA%29.md' },
    { id: 'nba-jam', title: 'NBA Jam', year: 1994, genre: 'sports', color: '#ff6600', rom: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/NBA%20Jam%20%28USA%2C%20Europe%29.md' },
    { id: 'nba-jam-te', title: 'NBA Jam T.E.', year: 1995, genre: 'sports', color: '#ff7722', rom: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/NBA%20Jam%20-%20Tournament%20Edition%20%28World%29.md' },
    { id: 'road-rash', title: 'Road Rash', year: 1991, genre: 'action', color: '#cc3333', rom: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Road%20Rash%20%28USA%2C%20Europe%29.md' },
    { id: 'road-rash-2', title: 'Road Rash II', year: 1992, genre: 'action', color: '#dd4444', rom: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Road%20Rash%20II%20%28USA%2C%20Europe%29.md' },
    { id: 'comix-zone', title: 'Comix Zone', year: 1995, genre: 'action', color: '#ff4400', rom: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Comix%20Zone%20%28USA%29.md' },
    { id: 'vectorman', title: 'Vectorman', year: 1995, genre: 'action', color: '#00cc66', rom: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Vectorman%20%28USA%2C%20Europe%29.md' },
    { id: 'gunstar-heroes', title: 'Gunstar Heroes', year: 1993, genre: 'action', color: '#ff0066', rom: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Gunstar%20Heroes%20%28USA%29.md' },
    { id: 'contra-hard-corps', title: 'Contra Hard Corps', year: 1994, genre: 'action', color: '#990000', rom: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Contra%20-%20Hard%20Corps%20%28USA%29.md' },
    { id: 'castlevania', title: 'Castlevania', year: 1994, genre: 'action', color: '#660033', rom: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Castlevania%20-%20Bloodlines%20%28USA%29.md' },
    { id: 'x-men-2', title: 'X-Men 2', year: 1995, genre: 'action', color: '#ffcc00', rom: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/X-Men%202%20-%20Clone%20Wars%20%28USA%29.md' }
];

class GenesisVault {
    constructor() {
        this.nostalgist = null;
        this.currentGame = null;
        this.currentFilter = 'all';
        this.elements = {
            catalog: document.getElementById('catalog'),
            player: document.getElementById('player'),
            gamesGrid: document.getElementById('games-grid'),
            emulatorContainer: document.getElementById('emulator-container'),
            loadingScreen: document.getElementById('loading-screen'),
            loadingCover: document.getElementById('loading-cover'),
            loadingTitle: document.getElementById('loading-title'),
            gameTitle: document.getElementById('game-title'),
            backBtn: document.getElementById('back-btn'),
            fullscreenBtn: document.getElementById('fullscreen-btn'),
            dropZone: document.getElementById('drop-zone'),
            romInput: document.getElementById('rom-input'),
            filterBtns: document.querySelectorAll('.filter-btn')
        };
        this.init();
    }

    init() {
        this.renderGames();
        this.bindEvents();
        this.handleRoute();
        window.addEventListener('hashchange', () => this.handleRoute());
    }

    bindEvents() {
        this.elements.backBtn?.addEventListener('click', () => this.goToCatalog());
        this.elements.fullscreenBtn?.addEventListener('click', () => this.toggleFullscreen());
        
        this.elements.filterBtns.forEach(btn => {
            btn.addEventListener('click', (e) => this.filterGames(e.target.dataset.filter));
        });

        this.elements.dropZone?.addEventListener('click', () => this.elements.romInput?.click());

        this.elements.romInput?.addEventListener('change', (e) => {
            if (e.target.files[0]) this.loadCustomROM(e.target.files[0]);
        });

        this.elements.dropZone?.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.elements.dropZone.classList.add('drag-over');
        });

        this.elements.dropZone?.addEventListener('dragleave', () => {
            this.elements.dropZone.classList.remove('drag-over');
        });

        this.elements.dropZone?.addEventListener('drop', (e) => {
            e.preventDefault();
            this.elements.dropZone.classList.remove('drag-over');
            if (e.dataTransfer.files[0]) this.loadCustomROM(e.dataTransfer.files[0]);
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.elements.player?.classList.contains('hidden')) {
                this.goToCatalog();
            }
        });
    }

    renderGames(filter = 'all') {
        const filteredGames = filter === 'all' 
            ? GAMES_LIBRARY 
            : GAMES_LIBRARY.filter(game => game.genre === filter);

        this.elements.gamesGrid.innerHTML = filteredGames.map((game, index) => `
            <article class="game-card" data-game-id="${game.id}" style="--delay: ${index * 0.03}s; --game-color: ${game.color}">
                <div class="game-cover">
                    <div class="cover-art">
                        <span class="cover-title">${game.title}</span>
                        <span class="cover-year">${game.year}</span>
                    </div>
                    <div class="game-overlay">
                        <button class="play-btn">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M8 5v14l11-7z"/>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="game-info">
                    <h3 class="game-title">${game.title}</h3>
                    <div class="game-meta">
                        <span class="game-year">${game.year}</span>
                        <span class="game-genre">${this.getGenreLabel(game.genre)}</span>
                    </div>
                </div>
            </article>
        `).join('');

        this.elements.gamesGrid.querySelectorAll('.game-card').forEach(card => {
            card.addEventListener('click', () => {
                window.location.hash = card.dataset.gameId;
            });
        });
    }

    getGenreLabel(genre) {
        const labels = { action: 'Ação', platform: 'Plataforma', fighting: 'Luta', rpg: 'RPG', sports: 'Esportes' };
        return labels[genre] || genre;
    }

    filterGames(filter) {
        this.currentFilter = filter;
        this.elements.filterBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });
        this.renderGames(filter);
    }

    handleRoute() {
        const hash = window.location.hash.slice(1);
        if (hash && hash !== 'custom') {
            const game = GAMES_LIBRARY.find(g => g.id === hash);
            if (game) {
                this.launchGame(game);
                return;
            }
        }
        this.showCatalog();
    }

    showCatalog() {
        this.elements.catalog?.classList.remove('hidden');
        this.elements.player?.classList.add('hidden');
        this.exitEmulator();
    }

    showPlayer() {
        this.elements.catalog?.classList.add('hidden');
        this.elements.player?.classList.remove('hidden');
    }

    goToCatalog() {
        window.location.hash = '';
    }

    async launchGame(game) {
        this.currentGame = game;
        this.showPlayer();
        this.showLoading(game);

        try {
            await this.exitEmulator();
            const href = window.location.href.split('#')[0];
            const basePath = href.substring(0, href.lastIndexOf('/') + 1);

            this.nostalgist = await Nostalgist.launch({
                core: 'genesis_plus_gx',
                rom: game.rom,
                resolveCoreJs: (core) => basePath + 'lib/' + core + '_libretro.js',
                resolveCoreWasm: (core) => basePath + 'lib/' + core + '_libretro.wasm'
            });

            const canvas = this.nostalgist.getCanvas();
            if (canvas) {
                this.elements.emulatorContainer.innerHTML = '';
                this.elements.emulatorContainer.appendChild(canvas);
            }

            this.elements.gameTitle.textContent = game.title;
            this.hideLoading();
        } catch (error) {
            console.error('Erro ao carregar o jogo:', error);
            this.showError(error.message);
        }
    }

    async loadCustomROM(file) {
        const validExts = ['.md', '.bin', '.gen', '.smd', '.zip'];
        if (!validExts.some(ext => file.name.toLowerCase().endsWith(ext))) {
            alert('Arquivo inválido! Use: .md, .bin, .gen, .smd, .zip');
            return;
        }

        window.location.hash = 'custom';
        const customGame = { id: 'custom', title: file.name.replace(/\.[^/.]+$/, ''), color: '#666666' };
        this.currentGame = customGame;
        this.showPlayer();
        this.showLoading(customGame);

        try {
            await this.exitEmulator();
            const href = window.location.href.split('#')[0];
            const basePath = href.substring(0, href.lastIndexOf('/') + 1);

            this.nostalgist = await Nostalgist.launch({
                core: 'genesis_plus_gx',
                rom: file,
                resolveCoreJs: (core) => basePath + 'lib/' + core + '_libretro.js',
                resolveCoreWasm: (core) => basePath + 'lib/' + core + '_libretro.wasm'
            });

            const canvas = this.nostalgist.getCanvas();
            if (canvas) {
                this.elements.emulatorContainer.innerHTML = '';
                this.elements.emulatorContainer.appendChild(canvas);
            }

            this.elements.gameTitle.textContent = customGame.title;
            this.hideLoading();
        } catch (error) {
            console.error('Erro ao carregar ROM:', error);
            this.showError(error.message);
        }
    }

    showLoading(game) {
        this.elements.loadingScreen?.classList.add('active');
        if (this.elements.loadingTitle) this.elements.loadingTitle.textContent = game.title;
        if (this.elements.loadingCover) {
            this.elements.loadingCover.style.background = `linear-gradient(145deg, ${game.color} 0%, #000 100%)`;
        }
    }

    hideLoading() {
        this.elements.loadingScreen?.classList.remove('active');
    }

    showError(message) {
        this.hideLoading();
        this.elements.emulatorContainer.innerHTML = `
            <div class="error-screen">
                <div class="error-icon">⚠️</div>
                <h2>Erro ao carregar</h2>
                <p>${message}</p>
                <button class="retry-btn" onclick="window.location.hash=''">Voltar ao catálogo</button>
            </div>
        `;
    }

    async exitEmulator() {
        if (this.nostalgist) {
            try { await this.nostalgist.exit(); } catch (e) {}
            this.nostalgist = null;
        }
        if (this.elements.emulatorContainer) this.elements.emulatorContainer.innerHTML = '';
    }

    toggleFullscreen() {
        const wrapper = document.querySelector('.emulator-wrapper');
        if (!document.fullscreenElement) {
            wrapper?.requestFullscreen().catch(() => {});
        } else {
            document.exitFullscreen();
        }
    }
}

document.addEventListener('DOMContentLoaded', () => new GenesisVault());
