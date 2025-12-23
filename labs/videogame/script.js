const App = {
    emulator: null,
    currentCore: null,
    currentRomId: null,
    isManualFullscreen: false,
    basePath: window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1),
    allGames: [],
    coverCache: new Map(),
    imageObserver: null,
    preconnectedHosts: new Set(),
    settings: {
        scale: 'max',
        filter: 'pixel'
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
        searchInput: document.getElementById('game-search'),
        romInput: document.getElementById('rom-file-input'),
        mobileControls: document.getElementById('mobile-controls'),
        buttons: {
            back: document.getElementById('btn-back'),
            controls: document.getElementById('btn-controls'),
            fullscreen: document.getElementById('btn-fullscreen'),
            save: document.getElementById('btn-save'),
            load: document.getElementById('btn-load')
        }
    },
    activeTouches: new Map(),
    keyMap: {
        'ArrowUp': { code: 'ArrowUp', keyCode: 38 },
        'ArrowDown': { code: 'ArrowDown', keyCode: 40 },
        'ArrowLeft': { code: 'ArrowLeft', keyCode: 37 },
        'ArrowRight': { code: 'ArrowRight', keyCode: 39 },
        'Enter': { code: 'Enter', keyCode: 13 },
        'Shift': { code: 'ShiftLeft', keyCode: 16 },
        'a': { code: 'KeyA', keyCode: 65 },
        's': { code: 'KeyS', keyCode: 83 },
        'd': { code: 'KeyD', keyCode: 68 },
        'q': { code: 'KeyQ', keyCode: 81 },
        'w': { code: 'KeyW', keyCode: 87 },
        'e': { code: 'KeyE', keyCode: 69 },
        'Escape': { code: 'Escape', keyCode: 27 },
        'FULL': { code: 'F', keyCode: 70 }, // Added helper
        'SAVE': { code: 'Save', keyCode: 0 },
        'LOAD': { code: 'Load', keyCode: 0 },
        'z': { code: 'KeyZ', keyCode: 90 },
        'x': { code: 'KeyX', keyCode: 88 }
    },
    init() {
        this.loadSettings();
        this.setupImageObserver();
        this.setupEventListeners();
        this.setupSettings();
        this.setupMobileControls();
        this.loadCatalog();
        this.db.open().catch(() => { });
    },
    loadSettings() {
        this.settings.scale = this.getStoredSetting('scale', 'max', ['max', 'stretch']);
        this.settings.filter = this.getStoredSetting('filter', 'pixel', ['pixel', 'retro', 'smooth']);
    },
    setupImageObserver() {
        // Intersection Observer para lazy loading inteligente
        if ('IntersectionObserver' in window) {
            this.imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const card = entry.target;
                        const gameId = card.dataset.id;
                        if (gameId && !this.coverCache.has(gameId)) {
                            const game = this.allGames.find(g => g.id === gameId);
                            if (game) {
                                this.prepareCover(game);
                                this.imageObserver.unobserve(card);
                            }
                        }
                    }
                });
            }, {
                root: null,
                rootMargin: '200px', // Carrega imagens 200px antes de aparecerem
                threshold: 0.01
            });
        }
    },
    preconnectToImageHosts(games) {
        // Preconnect para CDNs de imagens para estabelecer conexão antecipada
        const hosts = new Set();
        games.slice(0, 20).forEach(game => { // Apenas os primeiros 20 jogos
            const urls = this.buildCoverUrlList(game);
            urls.forEach(url => {
                try {
                    const hostname = new URL(url).hostname;
                    if (!this.preconnectedHosts.has(hostname)) {
                        hosts.add(hostname);
                        this.preconnectedHosts.add(hostname);
                    }
                } catch (e) { }
            });
        });

        hosts.forEach(host => {
            const link = document.createElement('link');
            link.rel = 'preconnect';
            link.href = `https://${host}`;
            link.crossOrigin = 'anonymous';
            document.head.appendChild(link);
        });
    },
    preloadPriorityImages(games) {
        // Preload das primeiras imagens visíveis com alta prioridade
        const visibleGames = games.slice(0, 6); // Primeiros 6 jogos
        visibleGames.forEach(game => {
            const urls = this.buildCoverUrlList(game);
            if (urls.length > 0) {
                const link = document.createElement('link');
                link.rel = 'preload';
                link.as = 'image';
                link.href = urls[0];
                link.fetchPriority = 'high';
                document.head.appendChild(link);
            }
        });
    },
    getStoredSetting(name, fallback, allowedValues) {
        const stored = localStorage.getItem(`emu-${name}`);
        return stored && allowedValues.includes(stored) ? stored : fallback;
    },
    setupEventListeners() {
        const { buttons, grid, searchInput, romInput } = this.ui;
        const { back, controls, fullscreen, save, load } = buttons || {};

        back?.addEventListener('click', () => this.showHome());
        controls?.addEventListener('click', () => this.showControls());
        fullscreen?.addEventListener('click', () => this.toggleFullscreen());
        save?.addEventListener('click', () => this.saveGame());
        load?.addEventListener('click', () => this.loadGame());

        grid?.addEventListener('click', e => {
            const card = e.target.closest('.game-card');
            if (card && card.dataset.id) this.startGameById(card.dataset.id)
        });
        let searchTimeout;
        searchInput?.addEventListener('input', e => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                const term = e.target.value.toLowerCase();
                this.renderGames(this.allGames.filter(g => g.title.toLowerCase().includes(term)));
            }, 300);
        });
        romInput?.addEventListener('change', e => {
            const file = e.target.files[0];
            if (file) this.startGame(file, file.name.replace(/\.[^/.]+$/, ''))
        });
        document.addEventListener('keydown', e => this.handleGlobalKeys(e));
        window.addEventListener('keydown', e => this.handleKeyRemap(e));
        window.addEventListener('keyup', e => this.handleKeyRemap(e));
        ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach(e => document.addEventListener(e, () => this.handleFullscreenChange()));
    },

    handleFullscreenChange() {
        const isFullscreen = this.isFullscreenActive();
        document.body.classList.toggle('is-fullscreen', isFullscreen);
        this.setMobileControlsFullscreen(isFullscreen);
        if (!this.isNativeFullscreenActive()) {
            this.isManualFullscreen = false;
        }
    },
    isNativeFullscreenActive() {
        return !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
    },
    isFullscreenActive() {
        return this.isManualFullscreen || this.isNativeFullscreenActive();
    },
    setupMobileControls() {
        const container = this.ui.mobileControls;
        if (!container) return;

        const options = { passive: false };
        ['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach(e =>
            container.addEventListener(e, evt => this.handleTouch(evt), options)
        );
        container.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); return false; });
    },

    handleTouch(e) {
        if (e.type !== 'touchend') e.preventDefault();

        const touches = e.changedTouches;

        for (let i = 0; i < touches.length; i++) {
            const touch = touches[i];
            const id = touch.identifier;

            // Determine target functionality
            const el = document.elementFromPoint(touch.clientX, touch.clientY);
            const btnKey = el?.closest('[data-key]');
            const btnAction = el?.closest('[data-action]');

            const keyName = btnKey?.dataset.key;
            const actionName = btnAction?.dataset.action?.toUpperCase();

            // Logic for Touch End
            if (e.type === 'touchend' || e.type === 'touchcancel') {
                const active = this.activeTouches.get(id);
                if (active) {
                    this.processButtonRelease(active);
                    this.activeTouches.delete(id);
                }
                continue;
            }

            // Logic for Start/Move
            const current = this.activeTouches.get(id);
            const target = actionName || keyName;

            if (current !== target) {
                if (current) this.processButtonRelease(current);
                if (target) {
                    this.processButtonPress(target);
                    this.activeTouches.set(id, target);
                } else {
                    this.activeTouches.delete(id);
                }
            }
        }
    },

    processButtonPress(key) {
        // Visual Feedback
        const selector = this.keyMap[key] ? `[data-key="${key}"]` : `[data-action="${key.toLowerCase()}"]`;
        document.querySelector(selector)?.classList.add('active');

        // Logic
        if (key === 'FULL') return this.toggleFullscreen();
        if (key === 'SAVE') return this.saveGame();
        if (key === 'LOAD') return this.loadGame();

        const map = this.keyMap[key];
        if (map) this.triggerKey(key, map.code, map.keyCode, 'keydown');
    },

    processButtonRelease(key) {
        // Visual Feedback
        const selector = this.keyMap[key] ? `[data-key="${key}"]` : `[data-action="${key.toLowerCase()}"]`;
        document.querySelector(selector)?.classList.remove('active');

        // Logic (actions trigger on press, so mostly for keys)
        const map = this.keyMap[key];
        if (map && key !== 'FULL' && key !== 'SAVE' && key !== 'LOAD') {
            this.triggerKey(key, map.code, map.keyCode, 'keyup');
        }
    },

    triggerKey(key, code, keyCode, type) {
        const targets = new Set([
            document.activeElement && document.activeElement !== document.body ? document.activeElement : null,
            this.ui.screen.querySelector('canvas'),
            document,
            window
        ]);
        targets.forEach(target => this.fireKeyboardEvent(target, type, key, code, keyCode));
    },
    fireKeyboardEvent(target, type, key, code, keyCode) {
        if (!target || typeof target.dispatchEvent !== 'function') return;
        const evt = new KeyboardEvent(type, {
            key,
            code,
            keyCode,
            which: keyCode,
            bubbles: true,
            cancelable: true,
            view: window
        });
        Object.defineProperty(evt, 'keyCode', { value: keyCode, writable: false });
        Object.defineProperty(evt, 'which', { value: keyCode, writable: false });
        target.dispatchEvent(evt);
    },
    setupSettings() {
        document.querySelectorAll('.btn-group').forEach(group => {
            const setting = group.dataset.setting;
            const buttons = group.querySelectorAll('button');

            // Set initial state
            buttons.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.value === this.settings[setting]);

                btn.addEventListener('click', () => {
                    this.saveSetting(setting, btn.dataset.value);
                    buttons.forEach(b => b.classList.toggle('active', b === btn));
                });
            });
        });
    },
    saveSetting(name, value) {
        if (!this.isValidSetting(name, value)) return;
        this.settings[name] = value;
        localStorage.setItem(`emu-${name}`, value);
        this.applySettings()
    },
    isValidSetting(name, value) {
        const allowed = {
            scale: ['max', 'stretch'],
            filter: ['pixel', 'retro', 'smooth']
        };
        return allowed[name]?.includes(value) ?? false;
    },
    applySettings() {
        const canvas = this.ui.screen.querySelector('canvas');
        if (!canvas) return;
        // Remove previous classes
        this.ui.screen.classList.remove('scanlines');
        canvas.classList.remove('filter-pixel', 'filter-smooth', 'filter-retro');
        canvas.style.imageRendering = '';
        canvas.style.width = '';
        canvas.style.height = '';
        canvas.style.objectFit = '';

        if (this.settings.filter === 'pixel') {
            canvas.classList.add('filter-pixel');
            canvas.style.imageRendering = 'pixelated';
        } else if (this.settings.filter === 'smooth') {
            canvas.classList.add('filter-smooth');
            canvas.style.imageRendering = 'auto';
        } else if (this.settings.filter === 'retro') {
            canvas.classList.add('filter-retro');
            canvas.style.imageRendering = 'pixelated'; // Keep pixels sharp under scanlines
            this.ui.screen.classList.add('scanlines'); // Add scanlines to container
        }

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
    async showHome() {
        document.body.classList.remove('game-mode');
        this.ui.home.classList.remove('hidden');
        this.ui.player.classList.add('hidden');
        this.ui.player.setAttribute('aria-hidden', 'true');
        this.ui.header.style.display = 'flex';
        this.ui.footer.style.display = 'block';
        if (this.isNativeFullscreenActive()) this.exitFullscreenSafe();
        if (this.isManualFullscreen) this.exitManualFullscreen();
        await this.stopEmulator()
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
    resetScreen() {
        if (!this.ui.screen) return;
        this.ui.screen.innerHTML = '';
        this.ui.screen.classList.remove('scanlines');
    },
    toggleFullscreen() {
        const elem = this.ui.player;
        if (!elem) return;

        if (!this.isFullscreenActive()) {
            const requested = this.requestFullscreenSafe(elem);
            if (!requested) this.enterManualFullscreen();
        } else {
            if (this.isManualFullscreen) this.exitManualFullscreen();
            else if (!this.exitFullscreenSafe()) this.exitManualFullscreen();
        }
    },
    requestFullscreenSafe(elem) {
        const request = elem?.requestFullscreen || elem?.webkitRequestFullscreen || elem?.mozRequestFullScreen || elem?.msRequestFullscreen;
        if (!request) return false;
        try {
            const result = request.call(elem);
            this.isManualFullscreen = false;
            if (result && typeof result.catch === 'function') {
                result.catch(err => {
                    console.warn('Fullscreen nativo falhou, usando fallback:', err);
                    this.enterManualFullscreen();
                });
            }
            return true;
        } catch (error) {
            console.warn('Fullscreen nativo indisponível:', error);
            return false;
        }
    },
    exitFullscreenSafe() {
        const exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
        if (!exit) return false;
        try {
            const result = exit.call(document);
            if (result && typeof result.catch === 'function') {
                result.catch(() => { });
            }
            return true;
        } catch (error) {
            console.warn('Erro ao sair do fullscreen nativo:', error);
            return false;
        }
    },
    enterManualFullscreen() {
        this.isManualFullscreen = true;
        document.body.classList.add('is-fullscreen');
        this.setMobileControlsFullscreen(true);
        window.scrollTo(0, 1);
    },
    exitManualFullscreen() {
        this.isManualFullscreen = false;
        document.body.classList.remove('is-fullscreen');
        this.setMobileControlsFullscreen(false);
    },
    setMobileControlsFullscreen(isFullscreen) {
        const mobileControls = this.ui.mobileControls;
        if (mobileControls) mobileControls.classList.toggle('fullscreen-mode', !!isFullscreen);
    },
    showControls() {
        if (document.getElementById('controls-overlay')) return document.getElementById('controls-overlay').remove();
        const overlay = document.createElement('div');
        overlay.id = 'controls-overlay';
        overlay.className = 'controls-overlay';
        overlay.innerHTML = `<div class="controls-modal">
            <div class="controls-modal-header">
                <span class="controls-modal-title">Controles & Saves</span>
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
            <div class="controls-actions" style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--border);display:flex;gap:0.5rem;justify-content:center;">
                <button id="btn-export-save" class="btn-secondary" style="font-size:0.9rem;padding:0.5rem 1rem;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Baixar Save
                </button>
                <button id="btn-import-save" class="btn-secondary" style="font-size:0.9rem;padding:0.5rem 1rem;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    Carregar Save
                </button>
            </div>
            <div class="controls-modal-footer">Clique fora para fechar</div>
        </div>`;

        overlay.addEventListener('click', e => {
            if (e.target === overlay) overlay.remove()
        });
        overlay.querySelector('.controls-modal-close').addEventListener('click', () => overlay.remove());

        const btnExport = overlay.querySelector('#btn-export-save');
        if (btnExport) btnExport.addEventListener('click', () => this.exportSave());

        const btnImport = overlay.querySelector('#btn-import-save');
        if (btnImport) btnImport.addEventListener('click', () => {
            this.importSave();
            overlay.remove();
        });

        this.ui.player.appendChild(overlay)
    },
    handleGlobalKeys(e) {
        if (e.key === 'Escape') {
            const overlay = document.getElementById('controls-overlay');
            if (overlay) overlay.remove();
            else if (this.isFullscreenActive()) this.toggleFullscreen();
            else if (!this.ui.player.classList.contains('hidden')) this.showHome()
        }
        if (e.key.toLowerCase() === 'f' && !this.ui.player.classList.contains('hidden')) this.toggleFullscreen()
        if (e.key === 'Enter' && !this.ui.player.classList.contains('hidden')) {
            const isFullscreen = this.isFullscreenActive();
            if (isFullscreen) {
                e.preventDefault();
                e.stopPropagation();
            }
        }
    },
    handleKeyRemap(e) {
        if (this.ui.player.classList.contains('hidden')) return;
        if (!this.currentCore || !e.isTrusted) return;

        const key = e.key.toLowerCase();
        let map = null;

        if (key === 's') map = { key: 'z', code: 'KeyZ', keyCode: 90 };
        else if (key === 'd') map = { key: 'x', code: 'KeyX', keyCode: 88 };

        if (!map) return;

        e.preventDefault();
        e.stopImmediatePropagation();

        const canvas = this.ui.screen.querySelector('canvas');
        if (canvas && document.activeElement !== canvas) canvas.focus();

        this.triggerKey(map.key, map.code, map.keyCode, e.type);
    },
    async startGame(rom, name) {
        const romKey = this.getRomKey(rom);
        this.currentRomId = romKey || name || `rom-${Date.now()}`;
        this.showPlayer(name || romKey || 'Jogo');
        this.ui.loader.classList.remove('hidden');

        try {
            await this.stopEmulator();
            const canvas = document.createElement('canvas');
            this.ui.screen.appendChild(canvas);

            const romToLoad = this.getRomSource(rom);
            if (!romToLoad) throw new Error('Arquivo do jogo inválido.');

            if (typeof romToLoad === 'string' && /^https?:\/\//.test(romToLoad)) {
                this.validateRomUrl(romToLoad);
            }

            const core = this.getCore(romKey);

            this.emulator = await Promise.race([
                Nostalgist.launch({
                    core,
                    rom: romToLoad,
                    resolveCoreJs: c => `${this.basePath}lib/${c}_libretro.js`,
                    resolveCoreWasm: c => `${this.basePath}lib/${c}_libretro.wasm`,
                    resolveRom: resource => this.resolveRomPath(resource),
                    element: canvas
                }),
                this.createTimeoutPromise(60000, 'Timeout ao carregar o jogo. Tente novamente.')
            ]);

            this.currentCore = core;
            this.applySettings();
        } catch (error) {
            console.error('Erro ao carregar jogo:', error);
            this.currentCore = null;
            this.showScreenError(this.getFriendlyErrorMessage(error));
        } finally {
            this.ui.loader.classList.add('hidden');
        }
    },
    getFriendlyErrorMessage(error) {
        if (!error || !error.message) return 'Erro desconhecido ao carregar o jogo.';
        const msg = error.message.toLowerCase();
        if (msg.includes('failed to load') || msg.includes('fetch') || msg.includes('network') || msg.includes('timeout')) return 'Erro ao carregar o arquivo do jogo. Verifique sua conexão ou tente novamente.';
        if (msg.includes('404') || msg.includes('not found')) return 'Arquivo do jogo não encontrado.';
        if (msg.includes('cors') || msg.includes('cross-origin')) return 'Erro de permissão ao acessar o arquivo do jogo.';
        if (msg.includes('invalid url') || msg.includes('url inválida')) return 'URL do jogo inválida.';
        return `Erro: ${error.message}`;
    },
    showScreenError(message) {
        if (!this.ui.screen) return;
        this.resetScreen();
        const container = document.createElement('div');
        container.className = 'error';

        const text = document.createElement('p');
        text.textContent = message;

        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = 'Voltar';
        button.addEventListener('click', () => this.showHome());

        container.appendChild(text);
        container.appendChild(button);
        this.ui.screen.appendChild(container);
    },
    resolveRomPath(resource) {
        if (!resource || typeof resource !== 'string') return resource;
        if (/^https?:\/\//.test(resource)) {
            if (resource.includes('cdn.jsdelivr.net/gh/')) {
                return resource.replace('https://cdn.jsdelivr.net/gh/', 'https://raw.githubusercontent.com/').replace('@master', '/master');
            }
            try {
                const url = new URL(resource);
                return url.href;
            } catch (err) {
                console.warn('URL inválida:', resource);
                return resource;
            }
        }
        return this.basePath + resource;
    },
    getRomSource(rom) {
        if (rom instanceof File) return rom;
        if (typeof rom === 'string') return rom;
        if (rom && typeof rom === 'object') return rom.file || rom.name || null;
        return null;
    },
    getRomKey(rom) {
        if (typeof rom === 'string') return rom;
        if (rom instanceof File) return rom.name;
        if (rom && typeof rom === 'object') return rom.name || rom.file || '';
        return '';
    },
    validateRomUrl(url) {
        try {
            const parsed = new URL(url);
            if (!parsed.hostname || !parsed.pathname) throw new Error('URL inválida');
        } catch (error) {
            throw new Error(`URL do jogo inválida: ${url}`);
        }
    },
    createTimeoutPromise(timeout, message) {
        return new Promise((_, reject) => {
            setTimeout(() => reject(new Error(message)), timeout);
        });
    },
    startGameById(id) {
        const game = this.allGames.find(g => g.id === id);
        game ? this.startGame(game.file, game.title) : console.error('Jogo não encontrado:', id)
    },
    ensureEmulator(message) {
        if (!this.emulator) {
            if (message) this.showToast(message, 'info');
            return false;
        }
        return true;
    },
    async saveGame() {
        if (!this.ensureEmulator('Abra um jogo para salvar.')) return;
        try {
            const state = await this.emulator.saveState();
            if (state) {
                const blob = new Blob([state.state]);
                try {
                    await this.db.put(this.currentRomId, blob);
                    this.showToast('Jogo salvo com sucesso!', 'success');
                } catch (e) {
                    console.warn('Save failed, attempting download...', e);
                    await this.exportSave({ silent: true });
                    this.showToast('Erro ao salvar no navegador. Baixando arquivo...', 'warning');
                }
            }
        } catch (e) {
            console.error(e);
            this.showToast('Erro ao criar save.', 'error');
        }
    },
    async loadGame() {
        if (!this.ensureEmulator('Abra um jogo para carregar um save.')) return;
        try {
            const state = await this.db.get(this.currentRomId);
            if (state) {
                let stateBlob = state;
                if (typeof state === 'string') {
                    if (state.startsWith('data:')) stateBlob = this.dataURLToBlob(state);
                    else {
                        const res = await fetch(state);
                        stateBlob = await res.blob();
                    }
                    if (!stateBlob) {
                        this.showToast('Save inválido.', 'error');
                        return;
                    }
                }
                await this.emulator.loadState(stateBlob);
                this.showToast('Jogo carregado!', 'success');
            } else {
                this.showToast('Nenhum save encontrado.', 'info');
            }
        } catch (e) {
            console.error(e);
            this.showToast('Erro ao carregar jogo.', 'error');
        }
    },
    async exportSave(options = {}) {
        if (!this.ensureEmulator('Abra um jogo para baixar o save.')) return;
        try {
            const state = await this.emulator.saveState();
            if (!state) {
                this.showToast('Não foi possível gerar o save.', 'warning');
                return;
            }
            const blob = new Blob([state.state]);
            this.downloadBlob(blob, `${this.currentRomId}.sav`);
            if (!options.silent) this.showToast('Save baixado!', 'success');
        } catch (error) {
            console.error('Erro ao exportar save:', error);
            if (!options.silent) this.showToast('Erro ao exportar save.', 'error');
        }
    },
    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const supportsDownload = 'download' in link;
        if (supportsDownload) {
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            const opened = window.open(url, '_blank');
            if (!opened) window.location.href = url;
        }
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    dataURLToBlob(dataUrl) {
        try {
            const parts = dataUrl.split(',');
            if (parts.length < 2) return null;
            const meta = parts[0];
            const base64 = parts[1];
            const mimeMatch = meta.match(/data:(.*?);base64/);
            const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
            const binary = atob(base64);
            const buffer = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) buffer[i] = binary.charCodeAt(i);
            return new Blob([buffer], { type: mime });
        } catch (error) {
            console.warn('Erro ao converter save local:', error);
            return null;
        }
    },
    importSave() {
        if (!this.ensureEmulator('Abra um jogo para carregar um save.')) return;
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.sav,.state';
        input.onchange = async e => {
            const file = e.target.files[0];
            if (file) {
                if (!this.emulator) {
                    this.showToast('Abra um jogo para carregar um save.', 'info');
                    return;
                }
                try {
                    await this.emulator.loadState(file);
                    this.showToast('Save carregado do arquivo!', 'success');
                } catch (err) {
                    console.error(err);
                    this.showToast('Erro ao ler arquivo.', 'error');
                }
            }
        };
        input.click();
    },
    showToast(msg, type = 'info') {
        const existing = document.getElementById('toast-msg');
        if (existing) existing.remove();
        const toast = document.createElement('div');
        toast.id = 'toast-msg';
        toast.className = `toast-msg ${type}`;

        let icon = '';
        if (type === 'success') icon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
        else if (type === 'error') icon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
        else if (type === 'warning') icon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
        else icon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';

        toast.innerHTML = `${icon}<span>${msg}</span>`;
        document.body.appendChild(toast);

        requestAnimationFrame(() => toast.classList.add('visible'));

        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },
    db: {
        _db: null,
        async open() {
            if (this._db) return this._db;
            if (typeof indexedDB === 'undefined') return null;
            return new Promise((resolve, reject) => {
                try {
                    const request = indexedDB.open('emu_saves', 1);
                    request.onerror = () => resolve(null);
                    request.onsuccess = () => resolve(this._db = request.result);
                    request.onupgradeneeded = e => {
                        const db = e.target.result;
                        if (!db.objectStoreNames.contains('states')) db.createObjectStore('states');
                    };
                } catch (e) { resolve(null); }
            });
        },
        async put(key, blob) {
            let db = await this.open();
            if (db) {
                return new Promise((resolve, reject) => {
                    try {
                        const tx = db.transaction('states', 'readwrite');
                        tx.oncomplete = () => resolve();
                        tx.onerror = () => reject(tx.error);
                        tx.objectStore('states').put(blob, key);
                    } catch (err) { reject(err); }
                }).catch(async (err) => {
                    return this.putLocalStorage(key, blob);
                });
            } else {
                return this.putLocalStorage(key, blob);
            }
        },
        async get(key) {
            let db = await this.open();
            if (db) {
                try {
                    const res = await new Promise((resolve, reject) => {
                        const tx = db.transaction('states', 'readonly');
                        const req = tx.objectStore('states').get(key);
                        req.onsuccess = () => resolve(req.result);
                        req.onerror = () => reject(req.error);
                    });
                    if (res) return res;
                    return this.getLocalStorage(key);
                } catch (e) {
                    return this.getLocalStorage(key);
                }
            } else {
                return this.getLocalStorage(key);
            }
        },
        async putLocalStorage(key, blob) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    try {
                        localStorage.setItem('save_' + key, reader.result);
                        resolve();
                    } catch (e) {
                        reject(e);
                    }
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        },
        getLocalStorage(key) {
            const data = localStorage.getItem('save_' + key);
            if (!data) return null;
            return data;
        }
    },
    async stopEmulator() {
        if (this.emulator) {
            try {
                await this.emulator.exit()
            } catch (e) {
                console.warn('Erro ao encerrar emulador:', e);
            }
            this.emulator = null
        }
        this.currentCore = null;
        this.resetScreen()
    },
    getCore(f) {
        if (!f || typeof f !== 'string') return 'genesis_plus_gx';
        const ext = f.split('.').pop().toLowerCase();
        return ['sfc', 'smc'].includes(ext) ? 'snes9x' : 'genesis_plus_gx'
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
    async loadImageWithFallback(gameId, img, placeholder, urls) {
        if (!img || !urls?.length) {
            this.coverCache.set(gameId, null);
            this.showPlaceholder(placeholder, img);
            return;
        }

        const maxAttempts = Math.min(urls.length, 30);
        for (let i = 0; i < maxAttempts; i++) {
            const src = urls[i];
            if (!src) continue;
            try {
                await this.preloadImage(src);
                this.coverCache.set(gameId, src);
                this.showCoverImage(img, placeholder, src);
                return;
            } catch (err) {
                if (i < maxAttempts - 1) await new Promise(r => setTimeout(r, 25));
            }
        }

        this.coverCache.set(gameId, null);
        this.showPlaceholder(placeholder, img);
    },
    preloadImage(src) {
        return new Promise((resolve, reject) => {
            const temp = new Image();
            temp.decoding = 'async'; // Decodificação assíncrona nativa
            temp.loading = 'lazy'; // Lazy loading nativo

            const timer = setTimeout(() => {
                temp.onload = null;
                temp.onerror = null;
                reject(new Error('timeout'));
            }, 4000);

            temp.onload = () => {
                clearTimeout(timer);
                // Aguarda decodificação completa antes de resolver
                if (temp.decode) {
                    temp.decode()
                        .then(() => resolve(src))
                        .catch(() => resolve(src)); // Fallback se decode falhar
                } else {
                    resolve(src);
                }
            };
            temp.onerror = () => {
                clearTimeout(timer);
                reject(new Error('error'));
            };
            temp.src = src;
        });
    },
    prepareCover(game) {
        const card = document.getElementById(this.getGameCardId(game.id));
        if (!card) return;

        const img = card.querySelector('.game-cover img');
        const placeholder = card.querySelector('.cover-placeholder');
        const urls = this.buildCoverUrlList(game);

        if (!urls.length) {
            this.coverCache.set(game.id, null);
            this.showPlaceholder(placeholder, img);
            return;
        }

        this.showPlaceholder(placeholder, img);
        this.loadImageWithFallback(game.id, img, placeholder, urls);
    },
    buildCoverUrlList(game) {
        const urls = [];
        if (game.cover) urls.push(game.cover);
        if (Array.isArray(game.coverUrls)) urls.push(...game.coverUrls);
        return [...new Set(urls.filter(u => typeof u === 'string' && /^https?:\/\//.test(u)))];
    },
    getGameCardId(id) {
        return `game-card-${id.replace(/[^a-zA-Z0-9]/g, '-')}`;
    },
    showCoverImage(img, placeholder, src) {
        if (!img) return;
        img.src = src;

        // Usar decode() nativo para decodificação assíncrona antes de exibir
        if (img.decode) {
            img.decode()
                .then(() => {
                    img.style.display = 'block';
                    if (placeholder) placeholder.classList.remove('is-visible');
                })
                .catch(() => {
                    // Fallback se decode falhar
                    img.style.display = 'block';
                    if (placeholder) placeholder.classList.remove('is-visible');
                });
        } else {
            // Fallback para navegadores sem suporte a decode()
            img.style.display = 'block';
            if (placeholder) placeholder.classList.remove('is-visible');
        }
    },
    showPlaceholder(placeholder, img) {
        if (img) img.style.display = 'none';
        if (placeholder) placeholder.classList.add('is-visible');
    },
    renderGames(games) {
        if (!this.ui.grid) return;
        if (games.length === 0) return this.ui.grid.innerHTML = '<p style="color:var(--text-secondary);text-align:center;grid-column:1/-1;padding:2rem;">Nenhum jogo encontrado.</p>';

        // Preconnect para CDNs de imagens
        this.preconnectToImageHosts(games);

        this.ui.grid.innerHTML = games.map((g, index) => {
            const t = g.title.replace(/"/g, '&quot;');
            const cardId = this.getGameCardId(g.id);
            const hasCache = this.coverCache.has(g.id);
            const cachedCover = hasCache ? this.coverCache.get(g.id) : null;

            // Atributos otimizados para imagens
            const imgAttributes = [
                `alt="${t}"`,
                'loading="lazy"', // Lazy loading nativo
                'decoding="async"', // Decodificação assíncrona
                `data-game="${g.id}"`,
                index < 6 ? 'fetchpriority="high"' : 'fetchpriority="low"' // Prioridade para primeiras imagens
            ];

            if (cachedCover) {
                imgAttributes.push(`src="${cachedCover}"`);
            } else {
                imgAttributes.push('style="display:none"');
            }

            const placeholderClass = `cover-placeholder${cachedCover ? '' : ' is-visible'}`;
            return `<button class="game-card" data-id="${g.id}" id="${cardId}">
                <div class="game-cover">
                    <img ${imgAttributes.join(' ')} data-title="${t}">
                    <div class="${placeholderClass}">
                        <span>${g.title}</span>
                    </div>
                </div>
                <div class="game-info">
                    <div class="game-title" title="${t}">${g.title}</div>
                    <div class="game-meta"><span class="game-platform">${g.platform}</span></div>
                </div>
            </button>`;
        }).join('');

        // Preload das primeiras imagens com alta prioridade
        this.preloadPriorityImages(games);

        // Usar Intersection Observer para carregar imagens sob demanda
        if (this.imageObserver) {
            games.forEach(g => {
                const card = document.getElementById(this.getGameCardId(g.id));
                if (card && !this.coverCache.has(g.id)) {
                    this.imageObserver.observe(card);
                }
            });
        } else {
            // Fallback para navegadores sem Intersection Observer
            games.forEach(g => {
                if (!this.coverCache.has(g.id)) this.prepareCover(g);
            });
        }
    },
};
document.addEventListener('DOMContentLoaded', () => App.init());
