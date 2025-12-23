const App = {
    emulator: null,
    currentCore: null,
    basePath: window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1),
    settings: {
        scale: localStorage.getItem('emu-scale') || 'max',
        filter: localStorage.getItem('emu-filter') || 'pixel'
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
        this.setupEventListeners();
        this.setupSettings();
        this.setupMobileControls();
        this.loadCatalog();
    },
    setupEventListeners() {
        document.getElementById('btn-back')?.addEventListener('click', () => this.showHome());
        document.getElementById('btn-controls')?.addEventListener('click', () => this.showControls());
        document.getElementById('btn-fullscreen')?.addEventListener('click', () => this.toggleFullscreen());
        document.getElementById('btn-save')?.addEventListener('click', () => this.saveGame());
        document.getElementById('btn-load')?.addEventListener('click', () => this.loadGame());
        this.ui.grid?.addEventListener('click', e => {
            const card = e.target.closest('.game-card');
            if (card && card.dataset.id) this.startGameById(card.dataset.id)
        });
        let searchTimeout;
        document.getElementById('game-search')?.addEventListener('input', e => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                const term = e.target.value.toLowerCase();
                this.renderGames(this.allGames.filter(g => g.title.toLowerCase().includes(term)));
            }, 300);
        });
        document.getElementById('rom-file-input')?.addEventListener('change', e => {
            const file = e.target.files[0];
            if (file) this.startGame(file, file.name.replace(/\.[^/.]+$/, ''))
        });
        document.addEventListener('keydown', e => this.handleGlobalKeys(e));
        window.addEventListener('keydown', e => this.handleKeyRemap(e));
        window.addEventListener('keyup', e => this.handleKeyRemap(e));
        ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach(e => document.addEventListener(e, () => this.handleFullscreenChange()));
    },

    handleFullscreenChange() {
        const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
        document.body.classList.toggle('is-fullscreen', !!isFullscreen);
        const mobileControls = document.getElementById('mobile-controls');
        if (mobileControls) {
            mobileControls.classList.toggle('fullscreen-mode', !!isFullscreen);
        }
    },
    setupMobileControls() {
        const container = document.getElementById('mobile-controls');
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
        const evt = new KeyboardEvent(type, {
            key: key,
            code: code,
            keyCode: keyCode,
            which: keyCode,
            bubbles: true,
            cancelable: true,
            view: window
        });
        Object.defineProperty(evt, 'keyCode', { value: keyCode });
        Object.defineProperty(evt, 'which', { value: keyCode });
        document.dispatchEvent(evt); // Global listener often on document
        window.dispatchEvent(evt);   // Backup
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
        this.settings[name] = value;
        localStorage.setItem(`emu-${name}`, value);
        this.applySettings()
    },
    applySettings() {
        const canvas = this.ui.screen.querySelector('canvas');
        if (!canvas) return;
        // Remove previous classes
        this.ui.screen.classList.remove('scanlines');

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
    showHome() {
        document.body.classList.remove('game-mode');
        this.ui.home.classList.remove('hidden');
        this.ui.player.classList.add('hidden');
        this.ui.player.setAttribute('aria-hidden', 'true');
        this.ui.header.style.display = 'flex';
        this.ui.footer.style.display = 'block';
        if (document.fullscreenElement) document.exitFullscreen().catch(() => { });
        this.exitManualFullscreen();
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
        const elem = this.ui.player;
        const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement || this.isManualFullscreen;

        if (!isFullscreen) {
            // Tenta API nativa primeiro
            if (elem.requestFullscreen) {
                elem.requestFullscreen().then(() => {
                    this.isManualFullscreen = false;
                }).catch(err => {
                    console.warn('Fullscreen nativo falhou, usando fallback:', err);
                    this.enterManualFullscreen();
                });
            } else if (elem.webkitRequestFullscreen) {
                try {
                    elem.webkitRequestFullscreen();
                } catch (e) {
                    this.enterManualFullscreen();
                }
            } else if (elem.mozRequestFullScreen) {
                elem.mozRequestFullScreen();
            } else if (elem.msRequestFullscreen) {
                elem.msRequestFullscreen();
            } else {
                this.enterManualFullscreen();
            }
        } else {
            if (document.exitFullscreen) document.exitFullscreen().catch(() => { });
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
            else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
            else if (document.msExitFullscreen) document.msExitFullscreen();

            this.exitManualFullscreen();
        }
    },
    enterManualFullscreen() {
        this.isManualFullscreen = true;
        document.body.classList.add('is-fullscreen');
        const mobileControls = document.getElementById('mobile-controls');
        if (mobileControls) mobileControls.classList.add('fullscreen-mode');
        window.scrollTo(0, 1);
    },
    exitManualFullscreen() {
        this.isManualFullscreen = false;
        document.body.classList.remove('is-fullscreen');
        const mobileControls = document.getElementById('mobile-controls');
        if (mobileControls) mobileControls.classList.remove('fullscreen-mode');
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
            else if (document.fullscreenElement || this.isManualFullscreen) this.toggleFullscreen();
            else if (!this.ui.player.classList.contains('hidden')) this.showHome()
        }
        if (e.key.toLowerCase() === 'f' && !this.ui.player.classList.contains('hidden')) this.toggleFullscreen()
        if (e.key === 'Enter' && !this.ui.player.classList.contains('hidden')) {
            const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement || this.isManualFullscreen;
            if (isFullscreen) {
                e.preventDefault();
                e.stopPropagation();
            }
        }
    },
    handleKeyRemap(e) {
        if (this.ui.player.classList.contains('hidden')) return;
        if (!this.currentCore) return;

        const key = e.key.toLowerCase();
        let map = null;

        if (key === 's') map = { key: 'z', code: 'KeyZ', keyCode: 90 };
        else if (key === 'd') map = { key: 'x', code: 'KeyX', keyCode: 88 };

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
            Object.defineProperty(evt, 'keyCode', { value: map.keyCode, writable: false });
            Object.defineProperty(evt, 'which', {
                value: map.keyCode,
                writable: false
            });
            const canvas = this.ui.screen.querySelector('canvas');
            if (canvas) {
                canvas.dispatchEvent(evt);
                canvas.focus();
            }
            document.dispatchEvent(evt);
            window.dispatchEvent(evt);
        }
    },
    async startGame(rom, name) {
        this.currentRomId = typeof rom === 'string' ? rom : rom.name;
        this.showPlayer(name);
        this.ui.loader.classList.remove('hidden');
        try {
            await this.stopEmulator();
            const canvas = document.createElement('canvas');
            this.ui.screen.appendChild(canvas);

            const romFile = typeof rom === 'string' ? rom : rom.name;
            const core = this.getCore(romFile);
            this.currentCore = core;

            const resolveRom = (f, options) => {
                if (!f) return f;
                if (typeof f === 'string') {
                    if (f.startsWith('http://') || f.startsWith('https://')) {
                        if (f.includes('cdn.jsdelivr.net/gh/')) {
                            const githubUrl = f.replace('https://cdn.jsdelivr.net/gh/', 'https://raw.githubusercontent.com/').replace('@master', '/master');
                            return githubUrl;
                        }
                        try {
                            const url = new URL(f);
                            return url.href;
                        } catch (e) {
                            console.warn('URL inválida:', f);
                            return f;
                        }
                    }
                    return this.basePath + f;
                }
                return f;
            };

            const romToLoad = typeof rom === 'string' ? rom : (rom instanceof File ? rom : (rom.file || rom.name));

            if (typeof romToLoad === 'string' && (romToLoad.startsWith('http://') || romToLoad.startsWith('https://'))) {
                try {
                    const testUrl = new URL(romToLoad);
                    if (!testUrl.hostname || !testUrl.pathname) {
                        throw new Error('URL inválida');
                    }
                } catch (urlError) {
                    throw new Error(`URL do jogo inválida: ${romToLoad}`);
                }
            }

            this.emulator = await Promise.race([
                Nostalgist.launch({
                    core,
                    rom: romToLoad,
                    resolveCoreJs: c => this.basePath + 'lib/' + c + '_libretro.js',
                    resolveCoreWasm: c => this.basePath + 'lib/' + c + '_libretro.wasm',
                    resolveRom: resolveRom,
                    element: canvas
                }),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Timeout ao carregar o jogo. Tente novamente.')), 60000)
                )
            ]);

            this.applySettings();
            this.ui.loader.classList.add('hidden')
        } catch (e) {
            console.error('Erro ao carregar jogo:', e);
            this.ui.loader.classList.add('hidden');
            let errorMessage = 'Erro desconhecido ao carregar o jogo.';

            if (e.message) {
                const msg = e.message.toLowerCase();
                if (msg.includes('failed to load') || msg.includes('fetch') || msg.includes('network') || msg.includes('timeout')) {
                    errorMessage = 'Erro ao carregar o arquivo do jogo. Verifique sua conexão ou tente novamente.';
                } else if (msg.includes('404') || msg.includes('not found')) {
                    errorMessage = 'Arquivo do jogo não encontrado.';
                } else if (msg.includes('cors') || msg.includes('cross-origin')) {
                    errorMessage = 'Erro de permissão ao acessar o arquivo do jogo.';
                } else if (msg.includes('invalid url') || msg.includes('url inválida')) {
                    errorMessage = 'URL do jogo inválida.';
                } else {
                    errorMessage = `Erro: ${e.message}`;
                }
            }

            this.ui.screen.innerHTML = `<div class="error"><p>${errorMessage}</p><button onclick="App.showHome()">Voltar</button></div>`
        }
    },
    startGameById(id) {
        const game = this.allGames.find(g => g.id === id);
        game ? this.startGame(game.file, game.title) : console.error('Jogo não encontrado:', id)
    },
    async saveGame() {
        if (!this.emulator) return;
        try {
            const state = await this.emulator.saveState();
            if (state) {
                const blob = new Blob([state.state]);
                try {
                    await this.db.put(this.currentRomId, blob);
                    this.showToast('Jogo salvo com sucesso!', 'success');
                } catch (e) {
                    console.warn('Save failed, attempting download...', e);
                    this.exportSave();
                    this.showToast('Erro ao salvar no navegador. Baixando arquivo...', 'warning');
                }
            }
        } catch (e) {
            console.error(e);
            this.showToast('Erro ao criar save.', 'error');
        }
    },
    async loadGame() {
        if (!this.emulator) return;
        try {
            const state = await this.db.get(this.currentRomId);
            if (state) {
                let stateBlob = state;
                if (typeof state === 'string') {
                    const res = await fetch(state);
                    stateBlob = await res.blob();
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
    exportSave() {
        if (!this.emulator) return;
        this.emulator.saveState().then(state => {
            if (state) {
                const blob = new Blob([state.state]);
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `${this.currentRomId}.sav`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(a.href);
                this.showToast('Save baixado!', 'success');
            }
        });
    },
    importSave() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.sav,.state';
        input.onchange = async e => {
            const file = e.target.files[0];
            if (file) {
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
            } catch (e) { }
            this.emulator = null
        }
        this.currentCore = null;
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
    async loadImageWithFallback(img, urls, placeholder, skipUrl = null) {
        if (!img || !urls?.length) {
            if (placeholder) placeholder.style.display = 'flex';
            return;
        }

        const candidates = urls.filter(u => u && typeof u === 'string' && u.startsWith('http') && u !== skipUrl);
        const maxAttempts = Math.min(candidates.length, 30);

        const loadOne = (src) => new Promise((resolve, reject) => {
            const temp = new Image();
            const timer = setTimeout(() => {
                temp.onload = null;
                temp.onerror = null;
                reject('timeout');
            }, 2000);

            temp.onload = () => {
                clearTimeout(timer);
                resolve(src);
            };
            temp.onerror = () => {
                clearTimeout(timer);
                reject('error');
            };
            temp.src = src;
        });

        for (let i = 0; i < maxAttempts; i++) {
            try {
                const src = candidates[i];
                if (!src) continue;
                await loadOne(src);

                img.src = src;
                img.style.display = 'block';
                if (placeholder) placeholder.style.display = 'none';
                return;
            } catch (e) {
                // Continue to next, small delay to separate requests slightly
                if (i < maxAttempts - 1) await new Promise(r => setTimeout(r, 25));
            }
        }

        // All failed
        img.style.display = 'none';
        if (placeholder) placeholder.style.display = 'flex';
    },
    renderGames(games) {
        if (!this.ui.grid) return;
        if (games.length === 0) return this.ui.grid.innerHTML = '<p style="color:var(--text-secondary);text-align:center;grid-column:1/-1;padding:2rem;">Nenhum jogo encontrado.</p>';

        this.ui.grid.innerHTML = games.map(g => {
            const t = g.title.replace(/"/g, '&quot;');
            const cardId = `game-card-${g.id.replace(/[^a-zA-Z0-9]/g, '-')}`;
            const hasCover = !!g.cover;
            return `<button class="game-card" data-id="${g.id}" id="${cardId}">
                <div class="game-cover">
                    ${hasCover ? `<img src="${g.cover}" alt="${t}" loading="lazy" data-title="${g.title}">` : ''}
                    <div class="cover-placeholder" style="${hasCover ? 'display:none' : 'display:flex'}">
                        <span>${g.title}</span>
                    </div>
                </div>
                <div class="game-info">
                    <div class="game-title" title="${t}">${g.title}</div>
                    <div class="game-meta"><span class="game-platform">${g.platform}</span></div>
                </div>
            </button>`;
        }).join('');

        games.forEach(g => {
            if (!g.cover) return;
            const cardId = `game-card-${g.id.replace(/[^a-zA-Z0-9]/g, '-')}`;
            const card = document.getElementById(cardId);
            if (!card) return;

            const img = card.querySelector('.game-cover img');
            const placeholder = card.querySelector('.cover-placeholder');
            if (img && placeholder) {
                const coverUrls = Array.isArray(g.coverUrls) ? g.coverUrls : [];
                const urlSet = new Set([g.cover, ...coverUrls.filter(Boolean)]);
                this.loadImageWithFallback(img, Array.from(urlSet), placeholder, null);
            }
        });
    },
};
document.addEventListener('DOMContentLoaded', () => App.init());
