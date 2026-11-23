const App = {
    emulator: null,
    launchId: 0,
    currentCore: null,
    currentRomId: null,
    isManualFullscreen: false,
    basePath: window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1),
    allGames: [],
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
        pauseMenu: document.getElementById('pause-menu'),
        pauseTitle: document.getElementById('pause-title'),
        startHint: document.getElementById('start-hint'),
        loaderSlow: document.getElementById('loader-slow'),
        loaderCancel: document.getElementById('loader-cancel'),
        libraryStatus: document.getElementById('library-status'),
        buttons: {
            pause: document.getElementById('btn-pause'),
            back: document.getElementById('btn-back'),
            controls: document.getElementById('btn-controls'),
            fullscreen: document.getElementById('btn-fullscreen'),
            save: document.getElementById('btn-save'),
            load: document.getElementById('btn-load')
        }
    },
    // Entrada por toque: cada dedo (touch.identifier) guarda o conjunto de teclas que segura.
    // keyRefs conta quantos dedos seguram cada tecla, para soltar só quando o último sair.
    touchKeys: new Map(),
    touchOnDpad: new Set(),
    keyRefs: new Map(),
    userPaused: false,
    libraryOnline: null,
    lastLaunch: null,
    lastCardId: null,
    timers: { hint: 0, slow: 0, bar: 0 },
    coarse: window.matchMedia ? window.matchMedia('(pointer: coarse)') : { matches: false },
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
        'z': { code: 'KeyZ', keyCode: 90 },
        'x': { code: 'KeyX', keyCode: 88 }
    },
    init() {
        this.loadSettings();
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

    getStoredSetting(name, fallback, allowedValues) {
        try {
            const stored = localStorage.getItem(`emu-${name}`);
            return allowedValues.includes(stored) ? stored : fallback;
        } catch {
            return fallback;
        }
    },
    setupEventListeners() {
        const { buttons, grid, searchInput, romInput, player, pauseMenu, loaderCancel } = this.ui;
        const { back, controls, fullscreen, save, load, pause } = buttons || {};

        back?.addEventListener('click', () => this.showHome());
        pause?.addEventListener('click', () => this.openMenu());
        controls?.addEventListener('click', () => this.showControls());
        fullscreen?.addEventListener('click', () => this.toggleFullscreen());
        save?.addEventListener('click', () => this.saveGame());
        load?.addEventListener('click', () => this.loadGame());
        loaderCancel?.addEventListener('click', () => this.showHome());

        // Botões da barra não podem ficar com o foco: o Nostalgist ignora teclas cujo alvo é um
        // <button>, e o jogo parava de responder ao teclado depois de clicar em "Salvar".
        player?.addEventListener('click', e => {
            const btn = e.target.closest('.player-bar button');
            if (btn) btn.blur();
        });
        // Barra superior no desktop: aparece ao mexer o mouse e some sozinha para não cobrir o jogo.
        player?.addEventListener('mousemove', () => this.flashPlayerBar());

        pauseMenu?.addEventListener('click', e => {
            const btn = e.target.closest('[data-menu]');
            if (btn) this.handleMenuAction(btn.dataset.menu);
            else if (e.target === pauseMenu) this.closeMenu();
        });

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

        // Aba escondida: pausa o emulador e solta teclas presas. Ao voltar, retoma sozinho
        // só se a pessoa não tinha pausado pelo menu.
        document.addEventListener('visibilitychange', () => {
            if (!this.emulator) return;
            try {
                if (document.hidden) {
                    this.releaseAllInputs();
                    this.emulator.pause?.();
                } else if (!this.userPaused) {
                    this.emulator.resume?.();
                }
            } catch (err) {
                console.warn('Emulador: pausa por visibilidade indisponível.', err);
            }
        });
        window.addEventListener('blur', () => this.releaseAllInputs());

        document.getElementById('open-local-rom').addEventListener('click', () => romInput.click());
        romInput?.addEventListener('change', e => {
            const file = e.target.files[0];
            romInput.value = '';
            if (file) this.startGame(file, file.name.replace(/\.[^/.]+$/, ''));
        });
        document.addEventListener('keydown', e => this.handleGlobalKeys(e));
        // Captura na janela: o remapeamento S/D roda antes do handler do emulador no document.
        window.addEventListener('keydown', e => this.handleKeyRemap(e), true);
        window.addEventListener('keyup', e => this.handleKeyRemap(e), true);
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
        // Mouse/caneta (tablet com ponteiro fino, testes no desktop) nos botões de sistema.
        // No toque o touchstart já disparou a ação e o preventDefault impede este click.
        container.addEventListener('click', e => {
            const btn = e.target.closest('[data-action]');
            if (btn) this.runPadAction(btn.dataset.action);
        });
    },

    handleTouch(e) {
        if (e.type !== 'touchend') e.preventDefault();

        const touches = e.changedTouches;
        const ending = e.type === 'touchend' || e.type === 'touchcancel';

        for (let i = 0; i < touches.length; i++) {
            const touch = touches[i];
            const id = touch.identifier;
            const prev = this.touchKeys.get(id);

            if (ending) {
                if (prev) prev.forEach(k => this.releaseKey(k));
                this.touchKeys.delete(id);
                this.touchOnDpad.delete(id);
                continue;
            }

            const el = document.elementFromPoint(touch.clientX, touch.clientY);
            if (e.type === 'touchstart') {
                const actionBtn = el?.closest('[data-action]');
                if (actionBtn) {
                    // Ações (menu, tela cheia) disparam uma vez no toque, sem virar tecla.
                    actionBtn.classList.add('active');
                    setTimeout(() => actionBtn.classList.remove('active'), 120);
                    this.runPadAction(actionBtn.dataset.action);
                    continue;
                }
                if (el?.closest('[data-dpad]')) this.touchOnDpad.add(id);
            }

            const next = this.keysAtPoint(el, touch.clientX, touch.clientY, this.touchOnDpad.has(id));
            if (prev) prev.forEach(k => { if (!next.includes(k)) this.releaseKey(k); });
            next.forEach(k => { if (!prev || !prev.includes(k)) this.pressKey(k); });
            if (next.length) this.touchKeys.set(id, next);
            else this.touchKeys.delete(id);
        }
    },

    /**
     * Direcional de 8 direções: o ângulo do dedo em relação ao centro do d-pad escolhe um de
     * 8 setores de 45° (0° = direita, sentido horário). Diagonais seguram duas setas.
     * Zona morta central = 18% do diâmetro. O dedo que começou no d-pad continua valendo
     * mesmo se escorregar para fora dele.
     */
    keysAtPoint(el, x, y, fromDpad) {
        const dpad = fromDpad ? this.ui.mobileControls.querySelector('[data-dpad]') : null;
        if (dpad) {
            const r = dpad.getBoundingClientRect();
            const dx = x - (r.left + r.width / 2);
            const dy = y - (r.top + r.height / 2);
            if (Math.hypot(dx, dy) < r.width * 0.18) return [];
            const sector = (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8;
            return this.dpadSectors[sector];
        }
        const name = el?.closest('[data-key]')?.getAttribute('data-key');
        return name && this.keyMap[name] ? [name] : [];
    },
    dpadSectors: [
        ['ArrowRight'], ['ArrowRight', 'ArrowDown'], ['ArrowDown'], ['ArrowLeft', 'ArrowDown'],
        ['ArrowLeft'], ['ArrowLeft', 'ArrowUp'], ['ArrowUp'], ['ArrowRight', 'ArrowUp']
    ],

    runPadAction(action) {
        if (action === 'menu') return this.isMenuOpen() ? this.closeMenu() : this.openMenu();
        if (action === 'full') return this.toggleFullscreen();
    },

    pressKey(name) {
        const count = (this.keyRefs.get(name) || 0) + 1;
        this.keyRefs.set(name, count);
        if (count > 1) return;
        this.setKeyVisual(name, true);
        this.hideStartHint();
        const map = this.keyMap[name];
        if (map) this.triggerKey(name, map.code, map.keyCode, 'keydown');
    },

    releaseKey(name) {
        const count = (this.keyRefs.get(name) || 0) - 1;
        if (count > 0) return this.keyRefs.set(name, count);
        this.keyRefs.delete(name);
        this.setKeyVisual(name, false);
        const map = this.keyMap[name];
        if (map) this.triggerKey(name, map.code, map.keyCode, 'keyup');
    },

    // Solta tudo (aba escondida, janela sem foco, menu aberto): evita personagem andando sozinho.
    releaseAllInputs() {
        for (const name of [...this.keyRefs.keys()]) {
            this.keyRefs.set(name, 1);
            this.releaseKey(name);
        }
        this.touchKeys.clear();
        this.touchOnDpad.clear();
    },

    setKeyVisual(name, on) {
        const el = this.ui.mobileControls?.querySelector(`[data-key="${name}"], [data-dir="${name}"]`);
        el?.classList.toggle('active', on);
    },

    triggerKey(key, code, keyCode, type) {
        // Um único evento no document: o handler do emulador escuta ali (respondToGlobalEvents).
        // Antes o mesmo evento ia para canvas + document + window e chegava duplicado.
        this.fireKeyboardEvent(document, type, key, code, keyCode);
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
        try { localStorage.setItem(`emu-${name}`, value); } catch { /* Ajuste válido nesta sessão. */ }
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
        this.launchId++;
        this.ui.loader.classList.add('hidden');
        this.clearLoaderTimers();
        this.hideMenu();
        this.hideStartHint();
        this.releaseAllInputs();
        document.getElementById('controls-overlay')?.remove();
        document.body.classList.remove('game-mode');
        this.ui.home.classList.remove('hidden');
        this.ui.player.classList.add('hidden');
        this.ui.player.setAttribute('aria-hidden', 'true');
        this.ui.header.style.display = 'flex';
        this.ui.footer.style.display = 'block';
        if (this.isNativeFullscreenActive()) this.exitFullscreenSafe();
        if (this.isManualFullscreen) this.exitManualFullscreen();
        // Devolve o foco ao último jogo escolhido (navegação por teclado não se perde).
        const card = this.lastCardId && this.ui.grid.querySelector(`[data-id="${CSS.escape(this.lastCardId)}"]`);
        card?.focus({ preventScroll: false });
        await this.stopEmulator()
    },
    showPlayer(name) {
        document.body.classList.add('game-mode');
        this.ui.home.classList.add('hidden');
        this.ui.player.classList.remove('hidden');
        this.ui.player.setAttribute('aria-hidden', 'false');
        this.ui.header.style.display = 'none';
        this.ui.footer.style.display = 'none';
        this.ui.gameName.textContent = name;
        if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
        this.flashPlayerBar();
    },
    flashPlayerBar() {
        const player = this.ui.player;
        if (!player.classList.contains('bar-visible')) player.classList.add('bar-visible');
        clearTimeout(this.timers.bar);
        this.timers.bar = setTimeout(() => player.classList.remove('bar-visible'), 2600);
    },

    // --- Menu de pausa (Esc, P, botão ⏸) -------------------------------------------------
    isMenuOpen() {
        return !!this.ui.pauseMenu && !this.ui.pauseMenu.hidden;
    },
    openMenu() {
        if (!this.emulator || this.isMenuOpen()) return;
        document.getElementById('controls-overlay')?.remove();
        this.releaseAllInputs();
        this.hideStartHint();
        this.userPaused = true;
        try { this.emulator.pause?.(); } catch (err) { console.warn('Pausa indisponível.', err); }
        this.ui.pauseTitle.textContent = this.ui.gameName.textContent || 'Jogo';
        this.ui.pauseMenu.hidden = false;
        this.ui.player.classList.add('menu-open');
        this.ui.pauseMenu.querySelector('[data-menu="resume"]')?.focus();
    },
    hideMenu() {
        if (!this.ui.pauseMenu) return;
        // Foco preso num botão escondido do menu faria o emulador ignorar o teclado.
        if (this.ui.pauseMenu.contains(document.activeElement)) document.activeElement.blur();
        this.ui.pauseMenu.hidden = true;
        this.ui.player.classList.remove('menu-open');
        this.userPaused = false;
    },
    closeMenu() {
        if (!this.isMenuOpen()) return;
        this.hideMenu();
        if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
        if (!document.hidden) {
            try { this.emulator?.resume?.(); } catch (err) { console.warn('Retomar indisponível.', err); }
        }
    },
    async handleMenuAction(action) {
        if (action === 'resume') return this.closeMenu();
        if (action === 'exit') return this.showHome();
        if (action === 'full') return this.toggleFullscreen();
        if (action === 'save') return this.saveGame();
        // O RetroArch tira a pausa sozinho ao carregar estado ou resetar, e PAUSE_TOGGLE é um
        // "inverte": pedir resume depois deixava o jogo congelado. Por isso retoma ANTES.
        if (action === 'load') {
            if (!(await this.db.get(this.currentRomId))) {
                this.showToast('Você ainda não salvou este jogo.', 'info');
                return;
            }
            this.closeMenu();
            await this.loadGame();
            return;
        }
        if (action === 'restart') {
            this.closeMenu();
            try { this.emulator?.restart?.(); } catch (err) { console.warn('Recomeçar indisponível.', err); }
            this.showToast('Jogo recomeçado!', 'success');
        }
    },

    // Dica rápida ao abrir o jogo: some sozinha ou no primeiro botão apertado.
    showStartHint() {
        const hint = this.ui.startHint;
        if (!hint) return;
        hint.innerHTML = this.coarse.matches
            ? 'Toque em <b>START</b> para começar · <b>⏸</b> pausa'
            : 'Aperte <kbd>Enter</kbd> (START) para começar · <kbd>Esc</kbd> pausa';
        hint.hidden = false;
        requestAnimationFrame(() => hint.classList.add('visible'));
        clearTimeout(this.timers.hint);
        this.timers.hint = setTimeout(() => this.hideStartHint(), 6000);
    },
    hideStartHint() {
        const hint = this.ui.startHint;
        if (!hint || hint.hidden) return;
        clearTimeout(this.timers.hint);
        hint.classList.remove('visible');
        this.timers.hint = setTimeout(() => { hint.hidden = true; }, 250);
    },
    clearLoaderTimers() {
        clearTimeout(this.timers.slow);
        if (this.ui.loaderSlow) this.ui.loaderSlow.hidden = true;
    },
    resetScreen() {
        if (!this.ui.screen) return;
        this.ui.screen.innerHTML = '';
        this.ui.screen.classList.remove('scanlines');
        this.ui.player.classList.remove('has-error');
    },
    isSafariMobile() {
        const ua = navigator.userAgent || '';
        const isIOS = /iPhone|iPad|iPod/.test(ua);
        const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS/.test(ua);
        return isIOS || (isSafari && 'ontouchstart' in window);
    },
    toggleFullscreen() {
        const elem = this.ui.player;
        if (!elem) return;

        // Safari mobile doesn't support fullscreen API reliably, use manual fallback
        if (this.isSafariMobile()) {
            if (!this.isManualFullscreen) {
                this.enterManualFullscreen();
            } else {
                this.exitManualFullscreen();
            }
            return;
        }

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
                <div class="control-item"><kbd>↑↓←→</kbd> Andar</div>
                <div class="control-item"><kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> Botões A/B/C</div>
                <div class="control-item"><kbd>Enter</kbd> Start</div>
                <div class="control-item"><kbd>Shift</kbd> Select</div>
                <div class="control-item"><kbd>F</kbd> Tela Cheia</div>
                <div class="control-item"><kbd>Esc</kbd> <kbd>P</kbd> Menu / pausa</div>
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
        if (this.ui.player.classList.contains('hidden')) return;
        const key = (e.key || '').toLowerCase();
        if (key === 'escape') {
            const overlay = document.getElementById('controls-overlay');
            if (overlay) return overlay.remove();
            if (this.isMenuOpen()) return this.closeMenu();
            // Com o jogo rodando, Esc pausa (sair fica no menu) para ninguém perder o progresso sem querer.
            if (this.emulator) return this.openMenu();
            if (this.isFullscreenActive()) return this.toggleFullscreen();
            return this.showHome();
        }
        if (this.isMenuOpen()) return;
        if (key === 'p' && e.isTrusted) return this.openMenu();
        if (key === 'f' && e.isTrusted) return this.toggleFullscreen();
        if (e.isTrusted && this.emulator) this.hideStartHint();
        if (key === 'enter' && this.isFullscreenActive() && !(e.target instanceof HTMLButtonElement)) {
            e.preventDefault();
            e.stopPropagation();
        }
    },
    handleKeyRemap(e) {
        if (this.ui.player.classList.contains('hidden') || this.isMenuOpen()) return;
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
        const id = ++this.launchId;
        let timeout;
        const romKey = this.getRomKey(rom);
        this.currentRomId = romKey || name || `rom-${Date.now()}`;
        this.lastLaunch = { rom, name };
        this.hideMenu();
        this.hideStartHint();
        this.showPlayer(name || romKey || 'Jogo');
        this.ui.loader.classList.remove('hidden');
        this.clearLoaderTimers();
        this.timers.slow = setTimeout(() => {
            if (id === this.launchId && this.ui.loaderSlow) this.ui.loaderSlow.hidden = false;
        }, 9000);

        try {
            await this.stopEmulator();
            if (id !== this.launchId) return;
            const canvas = document.createElement('canvas');
            this.ui.screen.appendChild(canvas);

            const romToLoad = this.getRomSource(rom);
            if (!romToLoad) throw new Error('Arquivo do jogo inválido.');

            if (typeof romToLoad === 'string' && /^https?:\/\//.test(romToLoad)) {
                this.validateRomUrl(romToLoad);
            }

            const core = this.getCore(romKey);

            const launch = Nostalgist.launch({
                core,
                rom: romToLoad,
                resolveCoreJs: c => `${this.basePath}lib/${c}_libretro.js`,
                resolveCoreWasm: c => `${this.basePath}lib/${c}_libretro.wasm`,
                resolveRom: resource => this.resolveRomPath(resource),
                element: canvas
            }).then(async emulator => {
                if (id === this.launchId) return emulator;
                await emulator.exit();
                return null;
            });
            const deadline = new Promise((_, reject) => {
                timeout = setTimeout(() => reject(new Error('Timeout ao carregar o jogo. Tente novamente.')), 60000);
            });
            const emulator = await Promise.race([launch, deadline]);
            if (id !== this.launchId) return;
            this.emulator = emulator;
            this.currentCore = core;
            this.applySettings();
            if (typeof romToLoad === 'string') this.setLibraryOnline(true);
            this.showStartHint();
        } catch (error) {
            if (id !== this.launchId) return;
            this.launchId++;
            this.ui.loader.classList.add('hidden');
            console.error('Erro ao carregar jogo:', error);
            this.currentCore = null;
            const remote = typeof rom === 'string' && /^https?:\/\//.test(rom);
            if (remote && /fetch|network|load/i.test(error?.message || '')) this.setLibraryOnline(false);
            this.showScreenError(this.getFriendlyErrorMessage(error, remote));
        } finally {
            clearTimeout(timeout);
            if (id === this.launchId) this.clearLoaderTimers();
            if (id === this.launchId) this.ui.loader.classList.add('hidden');
        }
    },
    getFriendlyErrorMessage(error, remote = false) {
        if (!error || !error.message) return 'Não deu para abrir este jogo. Tente de novo.';
        const msg = error.message.toLowerCase();
        if (msg.includes('timeout')) return 'O jogo demorou demais para carregar. Tente de novo.';
        if (remote && this.libraryOnline === false) return 'A biblioteca online está fora do ar, então este jogo não baixou. Você pode abrir um jogo do seu computador.';
        if (msg.includes('failed to load') || msg.includes('fetch') || msg.includes('network')) return 'Não conseguimos baixar este jogo agora. Confira a internet ou tente outro jogo.';
        if (msg.includes('404') || msg.includes('not found')) return 'Este jogo não foi encontrado na biblioteca.';
        if (msg.includes('cors') || msg.includes('cross-origin')) return 'A biblioteca não deixou baixar este jogo.';
        if (msg.includes('invalid url') || msg.includes('url inválida')) return 'O endereço deste jogo está errado.';
        return 'Este arquivo não abriu. Use um jogo de Mega Drive (.md, .bin, .gen, .smd) ou Super Nintendo (.sfc, .smc).';
    },
    showScreenError(message) {
        if (!this.ui.screen) return;
        this.resetScreen();
        const container = document.createElement('div');
        container.className = 'error';
        container.setAttribute('role', 'alert');

        const title = document.createElement('p');
        title.className = 'error-title';
        title.textContent = 'Ops! O jogo não abriu';
        const text = document.createElement('p');
        text.textContent = message;

        const actions = document.createElement('div');
        actions.className = 'error-actions';
        const make = (label, cls, fn) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = cls;
            b.textContent = label;
            b.addEventListener('click', fn);
            actions.appendChild(b);
            return b;
        };
        const retry = make('Tentar de novo', 'primary', () => {
            const last = this.lastLaunch;
            if (last) this.startGame(last.rom, last.name);
        });
        make('Abrir jogo do computador', '', () => this.ui.romInput.click());
        make('Voltar para a biblioteca', '', () => this.showHome());

        container.append(title, text, actions);
        this.ui.screen.appendChild(container);
        this.ui.player.classList.add('has-error');
        retry.focus();
    },

    // Sonda leve do servidor de ROMs: um HEAD sem CORS falha (TypeError) só se o host não
    // responder (DNS/rede). Timeout não conta como "fora do ar" para evitar falso alarme.
    async probeLibrary() {
        const first = this.allGames.find(g => typeof g.file === 'string');
        if (!first || typeof fetch !== 'function') return;
        const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
        const timer = setTimeout(() => ctrl?.abort(), 8000);
        try {
            await fetch(first.file, { method: 'HEAD', mode: 'no-cors', cache: 'no-store', signal: ctrl?.signal });
            this.setLibraryOnline(true);
        } catch (err) {
            if (err?.name !== 'AbortError') this.setLibraryOnline(false);
        } finally {
            clearTimeout(timer);
        }
    },
    setLibraryOnline(online) {
        this.libraryOnline = online;
        if (this.ui.libraryStatus) this.ui.libraryStatus.hidden = online !== false;
        this.ui.grid?.classList.toggle('is-offline', online === false);
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
    startGameById(id) {
        const game = this.allGames.find(g => g.id === id);
        this.lastCardId = id;
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
        const romId = this.currentRomId;
        const emulator = this.emulator;
        try {
            const state = await emulator.saveState();
            if (state) {
                const blob = new Blob([state.state]);
                try {
                    await this.db.put(romId, blob);
                    this.showToast('Jogo salvo com sucesso!', 'success');
                } catch (e) {
                    console.warn('Save failed, attempting download...', e);
                    this.downloadBlob(blob, `${romId}.sav`);
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
        const emulator = this.emulator;
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
                if (this.emulator !== emulator) return;
                await emulator.loadState(stateBlob);
                this.showToast('Jogo carregado!', 'success');
                return true;
            } else {
                this.showToast('Você ainda não salvou este jogo.', 'info');
            }
        } catch (e) {
            console.error(e);
            this.showToast('Erro ao carregar jogo.', 'error');
        }
        return false;
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
        this.releaseAllInputs();
        const emulator = this.emulator;
        this.emulator = null;
        this.currentCore = null;
        this.resetScreen();
        if (emulator) {
            try {
                await emulator.exit();
            } catch (error) {
                console.warn('Erro ao encerrar emulador:', error);
            }
        }
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
                this.renderGames(this.allGames);
                this.probeLibrary();
            } else throw new Error('Catálogo não encontrado')
        } catch (e) {
            console.error(e);
            this.ui.grid.innerHTML = '<p style="color:var(--text-secondary);text-align:center;grid-column:1/-1;">Erro ao carregar lista.</p>'
        }
    },


    buildCoverUrlList(game) {
        const urls = [];
        if (game.cover) urls.push(game.cover);
        if (Array.isArray(game.coverUrls)) urls.push(...game.coverUrls);
        return [...new Set(urls.filter(u => typeof u === 'string' && /^https?:\/\//.test(u)))];
    },
    handleImageError(img) {
        const fallbacks = JSON.parse(img.dataset.fallbacks || '[]');
        if (fallbacks.length > 0) {
            const next = fallbacks.shift();
            img.dataset.fallbacks = JSON.stringify(fallbacks);
            img.src = next;
        } else {
            img.style.display = 'none';
            img.nextElementSibling?.classList.add('is-visible');
        }
    },
    renderGames(games) {
        if (!this.ui.grid) return;
        if (games.length === 0) {
            this.ui.grid.innerHTML = '<p style="color:var(--text-secondary);text-align:center;grid-column:1/-1;padding:2rem;">Nenhum jogo encontrado.</p>';
            return;
        }

        this.ui.grid.innerHTML = games.map((g, index) => {
            const t = g.title.replace(/"/g, '&quot;');
            const urls = this.buildCoverUrlList(g);
            const first = urls.shift() || '';
            const fallbacks = JSON.stringify(urls);

            return `
                <button class="game-card" data-id="${g.id}">
                    <div class="game-cover">
                        <img alt="${t}" 
                             src="${first}" 
                             loading="lazy" 
                             decoding="async" 
                             ${index < 12 ? 'fetchpriority="high"' : 'fetchpriority="low"'}
                             data-fallbacks='${fallbacks.replace(/'/g, "&#39;")}'
                             onerror="App.handleImageError(this)">
                        <div class="cover-placeholder ${first ? '' : 'is-visible'}">
                            <span>${g.title}</span>
                        </div>
                    </div>
                    <div class="game-info">
                        <div class="game-title" title="${t}">${g.title}</div>
                        <div class="game-meta">
                            <span class="game-platform">${g.platform}</span>
                        </div>
                    </div>
                </button>
            `;
        }).join('');
    },
};
document.addEventListener('DOMContentLoaded', () => App.init());
