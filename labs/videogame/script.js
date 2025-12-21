const App = {
    emulator: null,
    currentCore: null,
    basePath: window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1),
    settings: {
        scale: localStorage.getItem('emu-scale') || 'max',
        filter: localStorage.getItem('emu-filter') || 'hd'
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
        this.setupMobileControls();
        this.loadCatalog();
        window.startGameById = id => this.startGameById(id);
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
        document.getElementById('game-search')?.addEventListener('input', e => this.renderGames(this.allGames.filter(g => g.title.toLowerCase().includes(e.target.value.toLowerCase()))));
        document.getElementById('rom-file-input')?.addEventListener('change', e => {
            const file = e.target.files[0];
            if (file) this.startGame(file, file.name.replace(/\.[^/.]+$/, ''))
        });
        document.addEventListener('keydown', e => this.handleGlobalKeys(e));
        window.addEventListener('keydown', e => this.handleKeyRemap(e));
        window.addEventListener('keyup', e => this.handleKeyRemap(e));
        document.addEventListener('fullscreenchange', () => this.handleFullscreenChange());
        document.addEventListener('webkitfullscreenchange', () => this.handleFullscreenChange());
        document.addEventListener('mozfullscreenchange', () => this.handleFullscreenChange());
        document.addEventListener('MSFullscreenChange', () => this.handleFullscreenChange());
        this.setupMobileActionButtons();
    },
    setupMobileActionButtons() {
        const container = document.getElementById('mobile-controls');
        if (!container) return;
        container.addEventListener('click', e => {
            const btn = e.target.closest('[data-action]');
            if (btn && btn.dataset.action === 'save') {
                e.preventDefault();
                e.stopPropagation();
                this.saveGame();
            } else if (btn && btn.dataset.action === 'load') {
                e.preventDefault();
                e.stopPropagation();
                this.loadGame();
            }
        });
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
        const keyMap = {
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
            'Escape': { code: 'Escape', keyCode: 27 }
        };

        const activeTouches = new Map(); // touchId -> keyName

        const handleTouch = (e) => {
            e.preventDefault();
            // Process all changed touches
            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                const touchId = touch.identifier;

                // Find element under touch
                const element = document.elementFromPoint(touch.clientX, touch.clientY);
                const btn = element?.closest('[data-key]');
                const actionBtn = element?.closest('[data-action]');
                const keyName = btn ? btn.dataset.key : null;
                const actionName = actionBtn ? actionBtn.dataset.action : null;

                // Handle Touch End / Cancel
                if (e.type === 'touchend' || e.type === 'touchcancel') {
                    const activeKey = activeTouches.get(touchId);
                    if (activeKey) {
                        if (activeKey === 'FULL') {
                            this.toggleFullscreen();
                            const el = document.querySelector(`[data-key="${activeKey}"]`);
                            if (el) el.classList.remove('active');
                            activeTouches.delete(touchId);
                            continue;
                        }
                        if (activeKey === 'SAVE') {
                            this.saveGame();
                            const el = document.querySelector('[data-action="save"]');
                            if (el) el.classList.remove('active');
                            activeTouches.delete(touchId);
                            continue;
                        }
                        if (activeKey === 'LOAD') {
                            this.loadGame();
                            const el = document.querySelector('[data-action="load"]');
                            if (el) el.classList.remove('active');
                            activeTouches.delete(touchId);
                            continue;
                        }

                        const mapping = keyMap[activeKey];
                        if (mapping) this.triggerKey(activeKey, mapping.code, mapping.keyCode, 'keyup');
                        const el = document.querySelector(`[data-key="${activeKey}"]`);
                        if (el) el.classList.remove('active');
                        activeTouches.delete(touchId);
                    }
                    continue;
                }

                // Handle Touch Start / Move
                const currentKey = activeTouches.get(touchId);
                const isCurrentAction = currentKey === 'SAVE' || currentKey === 'LOAD';
                const newIdentifier = actionName ? (actionName.toUpperCase()) : keyName;

                    // If we moved to a new key/action (or no key)
                if (currentKey !== newIdentifier) {
                    // Release old key if it existed
                    if (currentKey) {
                        if (currentKey === 'FULL') {
                            const el = document.querySelector(`[data-key="${currentKey}"]`);
                            if (el) el.classList.remove('active');
                        } else if (isCurrentAction) {
                            const el = document.querySelector(`[data-action="${currentKey.toLowerCase()}"]`);
                            if (el) el.classList.remove('active');
                        } else {
                            const mapping = keyMap[currentKey];
                            if (mapping) this.triggerKey(currentKey, mapping.code, mapping.keyCode, 'keyup');
                            const el = document.querySelector(`[data-key="${currentKey}"]`);
                            if (el) el.classList.remove('active');
                        }
                    }

                        // Press new key/action if valid
                    if (actionName) {
                        const actionElement = element?.closest('[data-action]');
                        if (actionElement) {
                            actionElement.classList.add('active');
                            activeTouches.set(touchId, actionName.toUpperCase());
                        }
                    } else if (keyName) {
                        if (keyName === 'FULL') {
                            btn.classList.add('active');
                            activeTouches.set(touchId, keyName);
                        } else {
                            const mapping = keyMap[keyName];
                            if (mapping) this.triggerKey(keyName, mapping.code, mapping.keyCode, 'keydown');
                            btn.classList.add('active');
                            activeTouches.set(touchId, keyName);
                        }
                    } else {
                        activeTouches.delete(touchId);
                    }
                }
            }
        };

        const container = document.getElementById('mobile-controls');
        if (!container) return;

        container.addEventListener('touchstart', handleTouch, { passive: false });
        container.addEventListener('touchmove', handleTouch, { passive: false });
        container.addEventListener('touchend', handleTouch, { passive: false });
        container.addEventListener('touchcancel', handleTouch, { passive: false });
        container.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); return false; });
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
        canvas.className = '';
        canvas.style.filter = '';
        canvas.style.imageRendering = '';
        
        if (this.settings.filter === 'hd') {
            canvas.classList.add('filter-hd');
            canvas.style.imageRendering = 'pixelated';
            canvas.style.imageRendering = '-moz-crisp-edges';
            canvas.style.imageRendering = 'crisp-edges';
        } else if (this.settings.filter === 'smooth') {
            canvas.classList.add('filter-smooth');
            canvas.style.imageRendering = 'auto';
        } else if (this.settings.filter === 'light') {
            canvas.classList.add('filter-light');
            canvas.style.imageRendering = 'auto';
            canvas.style.filter = 'contrast(1.05)';
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
        const elem = this.ui.player;
        const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;

        if (!isFullscreen) {
            if (elem.requestFullscreen) {
                elem.requestFullscreen().catch(err => {
                    console.error(`Error attempting to enable fullscreen: ${err.message} (${err.name})`);
                });
            } else if (elem.webkitRequestFullscreen) {
                elem.webkitRequestFullscreen();
            } else if (elem.mozRequestFullScreen) {
                elem.mozRequestFullScreen();
            } else if (elem.msRequestFullscreen) {
                elem.msRequestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        }
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
        if (!this.currentCore) return;
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
                await this.db.put(this.currentRomId, blob);
                this.showToast('Jogo salvo com sucesso!', 'success');
            }
        } catch (e) {
            console.error(e);
            this.showToast('Erro ao salvar jogo.', 'error');
        }
    },
    async loadGame() {
        if (!this.emulator) return;
        try {
            const state = await this.db.get(this.currentRomId);
            if (state) {
                await this.emulator.loadState(state);
                this.showToast('Jogo carregado!', 'success');
            } else {
                this.showToast('Nenhum save encontrado.', 'info');
            }
        } catch (e) {
            console.error(e);
            this.showToast('Erro ao carregar jogo.', 'error');
        }
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
        else if (type === 'info') icon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';

        toast.innerHTML = `${icon}<span>${msg}</span>`;
        Object.assign(toast.style, {
            position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(20, 20, 20, 0.9)', color: '#fff', padding: '0.75rem 1.25rem',
            borderRadius: '99px', zIndex: '10000', backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            fontSize: '0.9rem', fontWeight: '500', opacity: '0', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            display: 'flex', alignItems: 'center', gap: '8px', pointerEvents: 'none'
        });
        document.body.appendChild(toast);

        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(-50%) translateY(0)';
        });

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(10px)';
            setTimeout(() => toast.remove(), 300)
        }, 3000)
    },
    db: {
        _db: null,
        async open() {
            if (this._db) return this._db;
            return new Promise((resolve, reject) => {
                const request = indexedDB.open('emu_saves', 1);
                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve(this._db = request.result);
                request.onupgradeneeded = e => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains('states')) db.createObjectStore('states');
                };
            });
        },
        async put(key, blob) {
            const db = await this.open();
            return new Promise((resolve, reject) => {
                const tx = db.transaction('states', 'readwrite');
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
                tx.objectStore('states').put(blob, key);
            });
        },
        async get(key) {
            const db = await this.open();
            return new Promise((resolve, reject) => {
                const tx = db.transaction('states', 'readonly');
                const req = tx.objectStore('states').get(key);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
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
        if (!img || !urls || urls.length === 0) {
            if (placeholder) placeholder.style.display = 'flex';
            return;
        }
        
        const validUrls = urls.filter(url => url && typeof url === 'string' && url.startsWith('http'));
        const filteredUrls = skipUrl ? validUrls.filter(url => url !== skipUrl) : validUrls;
        
        if (filteredUrls.length === 0) {
            img.style.display = 'none';
            if (placeholder) placeholder.style.display = 'flex';
            return;
        }
        
        let currentIndex = 0;
        const maxAttempts = Math.min(filteredUrls.length, 15);
        let isResolved = false;
        
        const tryNext = () => {
            if (isResolved || currentIndex >= maxAttempts) {
                if (!isResolved) {
                    img.style.display = 'none';
                    if (placeholder) placeholder.style.display = 'flex';
                }
                return;
            }
            
            const url = filteredUrls[currentIndex];
            if (!url) {
                currentIndex++;
                setTimeout(tryNext, 25);
                return;
            }
            
            const testImg = new Image();
            let timeoutId = null;
            
            const cleanup = () => {
                if (timeoutId) clearTimeout(timeoutId);
                testImg.onload = null;
                testImg.onerror = null;
            };
            
            timeoutId = setTimeout(() => {
                cleanup();
                if (!isResolved) {
                    currentIndex++;
                    if (currentIndex < maxAttempts) {
                        setTimeout(tryNext, 25);
                    } else {
                        img.style.display = 'none';
                        if (placeholder) placeholder.style.display = 'flex';
                    }
                }
            }, 2000);
            
            testImg.onload = () => {
                if (isResolved) return;
                cleanup();
                isResolved = true;
                img.src = url;
                img.style.display = 'block';
                if (placeholder) placeholder.style.display = 'none';
            };
            
            testImg.onerror = () => {
                if (isResolved) return;
                cleanup();
                currentIndex++;
                if (currentIndex < maxAttempts) {
                    setTimeout(tryNext, 25);
                } else {
                    img.style.display = 'none';
                    if (placeholder) placeholder.style.display = 'flex';
                }
            };
            
            testImg.src = url;
        };
        
        tryNext();
    },
    renderGames(games) {
        if (!this.ui.grid) return;
        if (games.length === 0) return this.ui.grid.innerHTML = '<p style="color:var(--text-secondary);text-align:center;grid-column:1/-1;padding:2rem;">Nenhum jogo encontrado.</p>';
        
        this.ui.grid.innerHTML = games.map(g => {
            const t = g.title.replace(/"/g, '&quot;');
            const cardId = `game-card-${g.id.replace(/[^a-zA-Z0-9]/g, '-')}`;
            return `<button class="game-card" data-id="${g.id}" id="${cardId}"><div class="game-cover"><img src="${g.cover}" alt="${t}" loading="lazy" data-title="${g.title}"><div class="cover-placeholder"><span>${g.title}</span></div></div><div class="game-info"><div class="game-title" title="${t}">${g.title}</div><div class="game-meta"><span class="game-platform">${g.platform}</span></div></div></button>`
        }).join('');
        
        games.forEach(g => {
            const cardId = `game-card-${g.id.replace(/[^a-zA-Z0-9]/g, '-')}`;
            const card = document.getElementById(cardId);
            if (!card) return;
            
            const img = card.querySelector('.game-cover img');
            const placeholder = card.querySelector('.cover-placeholder');
            
            if (img && placeholder) {
                placeholder.style.display = 'none';
                
                const coverUrls = Array.isArray(g.coverUrls) ? g.coverUrls : [];
                
                const urlSet = new Set();
                if (g.cover) urlSet.add(g.cover);
                coverUrls.forEach(url => {
                    if (url && typeof url === 'string') {
                        urlSet.add(url);
                    }
                });
                
                const allUrls = Array.from(urlSet);
                
                if (allUrls.length === 0) {
                    placeholder.style.display = 'flex';
                    return;
                }
                
                img.addEventListener('error', () => {
                    this.loadImageWithFallback(img, allUrls, placeholder, g.cover);
                }, { once: true });
                
                const testImg = new Image();
                testImg.onload = () => {
                    img.style.display = 'block';
                    placeholder.style.display = 'none';
                };
                testImg.onerror = () => {
                    this.loadImageWithFallback(img, allUrls, placeholder, g.cover);
                };
                testImg.src = g.cover;
            }
        });
    },
};
document.addEventListener('DOMContentLoaded', () => App.init());
