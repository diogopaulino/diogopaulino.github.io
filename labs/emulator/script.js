const GAMES = {
    megadrive: [
        { id: 'sonic', title: 'Sonic The Hedgehog', rom: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Sonic%20the%20Hedgehog%20%28USA%2C%20Europe%29.md' },
        { id: 'sonic2', title: 'Sonic 2', rom: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Sonic%20the%20Hedgehog%202%20%28World%29.md' },
        { id: 'sonic3', title: 'Sonic 3', rom: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Sonic%20the%20Hedgehog%203%20%28USA%29.md' },
        { id: 'streets-of-rage', title: 'Streets of Rage', rom: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Streets%20of%20Rage%20%28USA%2C%20Europe%29.md' },
        { id: 'streets-of-rage-2', title: 'Streets of Rage 2', rom: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Streets%20of%20Rage%202%20%28USA%29.md' },
        { id: 'golden-axe', title: 'Golden Axe', rom: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Golden%20Axe%20%28World%29%20%28Rev%20A%29.md' },
        { id: 'mortal-kombat', title: 'Mortal Kombat', rom: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Mortal%20Kombat%20%28World%29.md' },
        { id: 'mortal-kombat-2', title: 'Mortal Kombat II', rom: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Mortal%20Kombat%20II%20%28World%29.md' },
        { id: 'altered-beast', title: 'Altered Beast', rom: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Altered%20Beast%20%28USA%2C%20Europe%29.md' },
        { id: 'shinobi-3', title: 'Shinobi III', rom: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Shinobi%20III%20-%20Return%20of%20the%20Ninja%20Master%20%28USA%29.md' },
        { id: 'aladdin', title: 'Aladdin', rom: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Aladdin%20%28USA%29.md' },
        { id: 'lion-king', title: 'The Lion King', rom: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Lion%20King%2C%20The%20%28World%29.md' },
        { id: 'earthworm-jim', title: 'Earthworm Jim', rom: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Earthworm%20Jim%20%28USA%29.md' },
        { id: 'gunstar-heroes', title: 'Gunstar Heroes', rom: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Gunstar%20Heroes%20%28USA%29.md' },
        { id: 'comix-zone', title: 'Comix Zone', rom: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Comix%20Zone%20%28USA%29.md' },
        { id: 'road-rash-2', title: 'Road Rash II', rom: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Road%20Rash%20II%20%28USA%2C%20Europe%29.md' },
        { id: 'nba-jam', title: 'NBA Jam', rom: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/NBA%20Jam%20%28USA%2C%20Europe%29.md' },
        { id: 'vectorman', title: 'Vectorman', rom: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Vectorman%20%28USA%2C%20Europe%29.md' }
    ],
    snes: [
        { id: 'super-mario-world', title: 'Super Mario World', rom: 'https://archive.org/download/super-nintendo-romset-ultra-usa/Super%20Mario%20World%20%28USA%29.sfc' },
        { id: 'zelda-link-past', title: 'Zelda: A Link to the Past', rom: 'https://archive.org/download/super-nintendo-romset-ultra-usa/Legend%20of%20Zelda%2C%20The%20-%20A%20Link%20to%20the%20Past%20%28USA%29.sfc' },
        { id: 'super-metroid', title: 'Super Metroid', rom: 'https://archive.org/download/super-nintendo-romset-ultra-usa/Super%20Metroid%20%28USA%2C%20Europe%29%20%28En%2CJa%29.sfc' },
        { id: 'donkey-kong-country', title: 'Donkey Kong Country', rom: 'https://archive.org/download/super-nintendo-romset-ultra-usa/Donkey%20Kong%20Country%20%28USA%29%20%28Rev%202%29.sfc' },
        { id: 'donkey-kong-country-2', title: 'Donkey Kong Country 2', rom: 'https://archive.org/download/super-nintendo-romset-ultra-usa/Donkey%20Kong%20Country%202%20-%20Diddy%27s%20Kong%20Quest%20%28USA%29%20%28Rev%201%29.sfc' },
        { id: 'chrono-trigger', title: 'Chrono Trigger', rom: 'https://archive.org/download/super-nintendo-romset-ultra-usa/Chrono%20Trigger%20%28USA%29.sfc' },
        { id: 'super-mario-kart', title: 'Super Mario Kart', rom: 'https://archive.org/download/super-nintendo-romset-ultra-usa/Super%20Mario%20Kart%20%28USA%29.sfc' },
        { id: 'street-fighter-2-turbo', title: 'Street Fighter II Turbo', rom: 'https://archive.org/download/super-nintendo-romset-ultra-usa/Street%20Fighter%20II%20Turbo%20-%20Hyper%20Fighting%20%28USA%29.sfc' },
        { id: 'mortal-kombat-snes', title: 'Mortal Kombat', rom: 'https://archive.org/download/super-nintendo-romset-ultra-usa/Mortal%20Kombat%20%28USA%29.sfc' },
        { id: 'mortal-kombat-2-snes', title: 'Mortal Kombat II', rom: 'https://archive.org/download/super-nintendo-romset-ultra-usa/Mortal%20Kombat%20II%20%28USA%29.sfc' },
        { id: 'final-fantasy-6', title: 'Final Fantasy III (VI)', rom: 'https://archive.org/download/super-nintendo-romset-ultra-usa/Final%20Fantasy%20III%20%28USA%29.sfc' },
        { id: 'mega-man-x', title: 'Mega Man X', rom: 'https://archive.org/download/super-nintendo-romset-ultra-usa/Mega%20Man%20X%20%28USA%29.sfc' },
        { id: 'mega-man-x2', title: 'Mega Man X2', rom: 'https://archive.org/download/super-nintendo-romset-ultra-usa/Mega%20Man%20X2%20%28USA%29.sfc' },
        { id: 'super-castlevania-4', title: 'Super Castlevania IV', rom: 'https://archive.org/download/super-nintendo-romset-ultra-usa/Super%20Castlevania%20IV%20%28USA%29.sfc' },
        { id: 'contra-3', title: 'Contra III', rom: 'https://archive.org/download/super-nintendo-romset-ultra-usa/Contra%20III%20-%20The%20Alien%20Wars%20%28USA%29.sfc' },
        { id: 'f-zero', title: 'F-Zero', rom: 'https://archive.org/download/super-nintendo-romset-ultra-usa/F-Zero%20%28USA%29.sfc' },
        { id: 'earthbound', title: 'EarthBound', rom: 'https://archive.org/download/super-nintendo-romset-ultra-usa/EarthBound%20%28USA%29.sfc' },
        { id: 'secret-of-mana', title: 'Secret of Mana', rom: 'https://archive.org/download/super-nintendo-romset-ultra-usa/Secret%20of%20Mana%20%28USA%29.sfc' }
    ]
};

const CORES = {
    megadrive: 'genesis_plus_gx',
    snes: 'snes9x'
};

class Emulator {
    constructor() {
        this.nostalgist = null;
        this.currentConsole = 'megadrive';
        this.init();
    }

    init() {
        this.bindEvents();
        this.renderGames();
        this.handleRoute();
        window.addEventListener('hashchange', () => this.handleRoute());
    }

    bindEvents() {
        document.querySelectorAll('.console-tab').forEach(tab => {
            tab.addEventListener('click', () => this.switchConsole(tab.dataset.console));
        });

        document.getElementById('back-btn').addEventListener('click', () => {
            window.location.hash = '';
        });

        document.getElementById('fullscreen-btn').addEventListener('click', () => {
            const wrapper = document.querySelector('.emulator-wrapper');
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else {
                wrapper.requestFullscreen?.();
            }
        });

        const dropZone = document.getElementById('drop-zone');
        const romInput = document.getElementById('rom-input');

        dropZone.addEventListener('click', () => romInput.click());
        
        romInput.addEventListener('change', (e) => {
            if (e.target.files[0]) this.loadCustomROM(e.target.files[0]);
        });

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
            if (e.dataTransfer.files[0]) this.loadCustomROM(e.dataTransfer.files[0]);
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') window.location.hash = '';
        });
    }

    switchConsole(console) {
        this.currentConsole = console;
        document.querySelectorAll('.console-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.console === console);
        });
        this.renderGames();
    }

    renderGames() {
        const grid = document.getElementById('games-grid');
        const games = GAMES[this.currentConsole];
        
        grid.innerHTML = games.map(game => `
            <a href="#${this.currentConsole}/${game.id}" class="game-card">
                <div class="game-icon">🎮</div>
                <span class="game-title">${game.title}</span>
            </a>
        `).join('');
    }

    handleRoute() {
        const hash = window.location.hash.slice(1);
        
        if (!hash) {
            this.showCatalog();
            return;
        }

        const [console, gameId] = hash.split('/');
        
        if (console && gameId) {
            const games = GAMES[console];
            const game = games?.find(g => g.id === gameId);
            
            if (game) {
                this.currentConsole = console;
                this.launchGame(game, console);
                return;
            }
        }

        this.showCatalog();
    }

    showCatalog() {
        document.getElementById('catalog').classList.remove('hidden');
        document.getElementById('player').classList.add('hidden');
        this.exitEmulator();
    }

    showPlayer(title) {
        document.getElementById('catalog').classList.add('hidden');
        document.getElementById('player').classList.remove('hidden');
        document.getElementById('game-title').textContent = title;
    }

    showLoading(show) {
        document.getElementById('loading').classList.toggle('hidden', !show);
    }

    async launchGame(game, console) {
        this.showPlayer(game.title);
        this.showLoading(true);

        try {
            await this.exitEmulator();

            const href = window.location.href.split('#')[0];
            const basePath = href.substring(0, href.lastIndexOf('/') + 1);
            const core = CORES[console];

            this.nostalgist = await Nostalgist.launch({
                core: core,
                rom: game.rom,
                resolveCoreJs: (c) => basePath + 'lib/' + c + '_libretro.js',
                resolveCoreWasm: (c) => basePath + 'lib/' + c + '_libretro.wasm'
            });

            const canvas = this.nostalgist.getCanvas();
            if (canvas) {
                const container = document.getElementById('emulator-container');
                container.innerHTML = '';
                container.appendChild(canvas);
            }

            this.showLoading(false);

        } catch (error) {
            console.error('Erro:', error);
            this.showLoading(false);
            document.getElementById('emulator-container').innerHTML = `
                <div class="error">
                    <p>Erro ao carregar: ${error.message}</p>
                    <button onclick="window.location.hash=''">Voltar</button>
                </div>
            `;
        }
    }

    async loadCustomROM(file) {
        const ext = file.name.toLowerCase();
        const isSNES = ext.endsWith('.sfc') || ext.endsWith('.smc');
        const isMD = ext.endsWith('.md') || ext.endsWith('.bin') || ext.endsWith('.gen') || ext.endsWith('.smd');
        
        if (!isSNES && !isMD && !ext.endsWith('.zip')) {
            alert('Formato não suportado!');
            return;
        }

        const console = isSNES ? 'snes' : 'megadrive';
        const title = file.name.replace(/\.[^/.]+$/, '');
        
        this.showPlayer(title);
        this.showLoading(true);

        try {
            await this.exitEmulator();

            const href = window.location.href.split('#')[0];
            const basePath = href.substring(0, href.lastIndexOf('/') + 1);
            const core = CORES[console];

            this.nostalgist = await Nostalgist.launch({
                core: core,
                rom: file,
                resolveCoreJs: (c) => basePath + 'lib/' + c + '_libretro.js',
                resolveCoreWasm: (c) => basePath + 'lib/' + c + '_libretro.wasm'
            });

            const canvas = this.nostalgist.getCanvas();
            if (canvas) {
                const container = document.getElementById('emulator-container');
                container.innerHTML = '';
                container.appendChild(canvas);
            }

            this.showLoading(false);

        } catch (error) {
            console.error('Erro:', error);
            alert('Erro: ' + error.message);
            window.location.hash = '';
        }
    }

    async exitEmulator() {
        if (this.nostalgist) {
            try { await this.nostalgist.exit(); } catch (e) {}
            this.nostalgist = null;
        }
        document.getElementById('emulator-container').innerHTML = '';
    }
}

document.addEventListener('DOMContentLoaded', () => new Emulator());
