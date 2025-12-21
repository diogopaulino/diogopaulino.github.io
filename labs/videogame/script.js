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
        grid: document.getElementById('games-grid')
    },
    init() {
        this.setupEventListeners();
        this.setupSettings();
        this.loadCatalog();
        window.startGameById = id => this.startGameById(id);
        window.handleImageError = (img, title) => this.handleImageError(img, title)
    },
    setupEventListeners() {
        document.getElementById('btn-back')?.addEventListener('click', () => this.showHome());
        document.getElementById('btn-controls')?.addEventListener('click', () => this.showControls());
        document.getElementById('btn-fullscreen')?.addEventListener('click', () => this.toggleFullscreen());
        this.ui.grid?.addEventListener('click', e => {
            const card = e.target.closest('.game-card');
            if (card && card.dataset.id) this.startGameById(card.dataset.id)
        });
        document.getElementById('game-search')?.addEventListener('input', e => this.renderGames(this.allGames.filter(g => g.title.toLowerCase().includes(e.target.value.toLowerCase()))));
        document.getElementById('rom-file-input')?.addEventListener('change', e => {
            const file = e.target.files[0];
            if (file) this.startGame(file, file.name.replace(/\.[^/.]+$/, ''))
        });
        document.addEventListener('keydown', e => this.handleGlobalKeys(e));
        window.addEventListener('keydown', e => this.handleKeyRemap(e));
        window.addEventListener('keyup', e => this.handleKeyRemap(e))
    },
    setupSettings() {
        document.querySelectorAll('.btn-group').forEach(group => {
            const name = group.dataset.setting;
            if (this.settings[name]) group.querySelectorAll('button').forEach(btn => btn.classList.toggle('active', btn.dataset.value === this.settings[name]));
            group.querySelectorAll('button').forEach(btn => {
                btn.addEventListener('click', () => {
                    this.saveSetting(name, btn.dataset.value);
                    group.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active')
                })
            })
        })
    },
    saveSetting(name, value) {
        this.settings[name] = value;
        localStorage.setItem(`emu-${name}`, value);
        this.applySettings()
    },
    applySettings() {
        const canvas = this.ui.screen.querySelector('canvas');
        if (!canvas) return;
        canvas.className = '';
        canvas.style.filter = '';
        if (this.settings.filter === 'sharp') canvas.classList.add('filter-sharp');
        else if (this.settings.filter === 'smooth') canvas.classList.add('filter-smooth');
        if (this.settings.scale === 'max') {
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            canvas.style.objectFit = 'contain'
        } else if (this.settings.scale === 'stretch') {
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            canvas.style.objectFit = 'fill'
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
        this.stopEmulator()
    },
    showPlayer(name) {
        document.body.classList.add('game-mode');
        this.ui.home.classList.add('hidden');
        this.ui.player.classList.remove('hidden');
        this.ui.player.setAttribute('aria-hidden', 'false');
        this.ui.header.style.display = 'none';
        this.ui.footer.style.display = 'none';
        this.ui.gameName.textContent = name
    },
    toggleFullscreen() {
        document.fullscreenElement ? document.exitFullscreen() : this.ui.player.requestFullscreen?.()
    },
    showControls() {
        if (document.getElementById('controls-overlay')) return document.getElementById('controls-overlay').remove();
        const overlay = document.createElement('div');
        overlay.id = 'controls-overlay';
        overlay.className = 'controls-overlay';
        overlay.innerHTML = `<div class="controls-modal"><div class="controls-modal-header"><span class="controls-modal-title">Controles</span><button class="controls-modal-close" aria-label="Fechar"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button></div><div class="controls-grid"><div class="control-item"><kbd>↑↓←→</kbd> Movimento</div><div class="control-item"><kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> Botões A/B/C</div><div class="control-item"><kbd>Enter</kbd> Start</div><div class="control-item"><kbd>Shift</kbd> Select</div><div class="control-item"><kbd>F</kbd> Tela Cheia</div><div class="control-item"><kbd>Esc</kbd> Sair/Voltar</div></div><div class="controls-modal-footer">Clique fora para fechar</div></div>`;
        overlay.addEventListener('click', e => {
            if (e.target === overlay) overlay.remove()
        });
        overlay.querySelector('.controls-modal-close').addEventListener('click', () => overlay.remove());
        this.ui.player.appendChild(overlay)
    },
    handleGlobalKeys(e) {
        if (e.key === 'Escape') {
            const overlay = document.getElementById('controls-overlay');
            if (overlay) overlay.remove();
            else if (document.fullscreenElement) document.exitFullscreen();
            else if (!this.ui.player.classList.contains('hidden')) this.showHome()
        }
        if (e.key.toLowerCase() === 'f' && !this.ui.player.classList.contains('hidden')) this.toggleFullscreen()
    },
    handleKeyRemap(e) {
        if (this.ui.player.classList.contains('hidden')) return;
        const map = {
            's': {
                key: 'z',
                code: 'KeyZ',
                keyCode: 90
            },
            'd': {
                key: 'x',
                code: 'KeyX',
                keyCode: 88
            }
        }[e.key.toLowerCase()];
        if (map && e.isTrusted) {
            e.preventDefault();
            e.stopImmediatePropagation();
            const evt = new KeyboardEvent(e.type, {
                key: map.key,
                code: map.code,
                keyCode: map.keyCode,
                which: map.keyCode,
                bubbles: true,
                cancelable: true,
                view: window
            });
            Object.defineProperty(evt, 'keyCode', {
                value: map.keyCode
            });
            Object.defineProperty(evt, 'which', {
                value: map.keyCode
            });
            window.dispatchEvent(evt)
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
            this.ui.loader.classList.add('hidden')
        } catch (e) {
            console.error(e);
            this.ui.loader.classList.add('hidden');
            this.ui.screen.innerHTML = `<div class="error"><p>Erro ao carregar: ${e.message}</p><button onclick="App.showHome()">Voltar</button></div>`
        }
    },
    startGameById(id) {
        const game = this.allGames.find(g => g.id === id);
        game ? this.startGame(game.file, game.title) : console.error('Jogo não encontrado:', id)
    },
    async stopEmulator() {
        if (this.emulator) {
            try {
                await this.emulator.exit()
            } catch (e) { }
            this.emulator = null
        }
        this.ui.screen.querySelector('canvas')?.remove()
    },
    getCore(f) {
        return ['sfc', 'smc'].includes(f.split('.').pop().toLowerCase()) ? 'snes9x' : 'genesis_plus_gx'
    },
    async loadCatalog() {
        try {
            if (typeof gamesCatalog !== 'undefined') {
                this.allGames = gamesCatalog;
                this.renderGames(this.allGames)
            } else throw new Error('Catálogo não encontrado')
        } catch (e) {
            console.error(e);
            this.ui.grid.innerHTML = '<p style="color:var(--text-secondary);text-align:center;grid-column:1/-1;">Erro ao carregar lista.</p>'
        }
    },
    renderGames(games) {
        if (!this.ui.grid) return;
        if (games.length === 0) return this.ui.grid.innerHTML = '<p style="color:var(--text-secondary);text-align:center;grid-column:1/-1;padding:2rem;">Nenhum jogo encontrado.</p>';
        this.ui.grid.innerHTML = games.map(g => {
            const t = g.title.replace(/"/g, '&quot;');
            return `<button class="game-card" data-id="${g.id}"><div class="game-cover"><img src="${g.cover}" alt="${t}" loading="lazy" data-title="${t}" onerror="handleImageError(this,this.dataset.title)"><div class="cover-placeholder"><span>${g.title}</span></div></div><div class="game-info"><div class="game-title" title="${t}">${g.title}</div><div class="game-meta"><span class="game-platform">${g.platform}</span></div></div></button>`
        }).join('')
    },
    handleImageError(img, title) {
        let v = img.variationsList,
            a = parseInt(img.dataset.attempts || '0');
        if (!v) {
            const b = 'https://raw.githubusercontent.com/libretro-thumbnails/Sega_-_Mega_Drive_-_Genesis/master/Named_Boxarts/',
                e = s => encodeURIComponent(s),
                c = title.replace(/[:\/\?]/g, '_');
            const t = [c, c.replace(/'/g, '_'), c.replace(/'/g, ''), c.replace(/^The\s+/, ''), c.replace(/^Disney's\s+/, ''), c.replace(/^The\s+(.+)/, '$1, The'), c.replace(/\s-\s/g, ': '), c.replace(/:\s/g, ' - '), c.replace(/\w\S*/g, x => x.charAt(0).toUpperCase() + x.substr(1).toLowerCase()), c.replace(/&/g, 'and'), c.replace(/\sand\s/g, ' & '), c.split(' - ')[0], c.split(': ')[0]];
            const r = ['(USA)', '(USA, Europe)', '(World)', '(Europe)', '(Japan)', ''];
            let g = [];
            t.forEach(x => r.forEach(y => g.push(`${b}${e(x)}${y ? '%20' + e(y) : ''}.png`)));
            img.variationsList = v = [...new Set(g)]
        }
        if (a >= v.length) {
            img.style.display = 'none';
            img.nextElementSibling && (img.nextElementSibling.style.display = 'flex');
            return
        }
        img.dataset.attempts = a + 1;
        img.src = v[a]
    }
};
document.addEventListener('DOMContentLoaded', () => App.init());
