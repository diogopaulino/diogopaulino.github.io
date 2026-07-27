(function () {
    'use strict';

    /* ============================================================
       CONSTANTES E CHAVES
       ============================================================ */
    const STORAGE_KEY = 'tamagotchi-dinkie-v2';
    const OLD_STORAGE_KEY = 'ovinho-save-v1';
    const THEME_KEY = 'tamagotchi-theme-v2';
    const HISTORY_KEY = 'tamagotchi-history-v2';

    const DAY_MS = 10 * 60 * 1000;      // 10 minutos reais = 1 dia do dinossauro
    const EGG_HATCH_MS = 45 * 1000;     // 45 segundos de choca como ovo
    const STAGE_DAYS = { child: 1, teen: 2.5, adult: 4.5 };
    const STAGE_ORDER = ['egg', 'baby', 'child', 'teen', 'adult'];
    const MAX_POOP = 4;
    const POOP_INTERVAL_MS = DAY_MS / 4;
    const RENDER_MS = 130;              // FPS retrô limpo
    const DECAY_MS = 1000;

    const RATES = {
        hunger: 90,
        happiness: 65,
        hygiene: 40,
        discipline: 20,
        energyAwake: 50,
        energySleep: 220,
        sickBase: 0.04,
        sickBad: 0.55,
        healthSick: 25,
        healthNeglect: 12,
        healthRegen: 6
    };

    /* Paletas Anos 90 - Edição Rakuraku Dinokun */
    const SHELL_PRESETS = [
        '#f6c836', // Amarelo Rakuraku Clássico
        '#37b264', // Verde Menta Dino
        '#f45288', // Rosa Retrô
        '#8a56ce', // Roxo Atômico Translúcido
        '#3898f8', // Azul Celeste 1997
        '#f0f2f5', // Branco Neve
        '#2a313d'  // Carbon Black
    ];
    const ACCENT_PRESETS = ['#f06c30', '#262626', '#1d63ed', '#e63262', '#10b981', '#ffffff'];
    const SCREEN_PRESETS = ['#8c9e7a', '#78a6ba', '#c6d175', '#e2b3c2', '#bcf49c', '#d2dfd4'];

    const ICON_IDS = ['feed', 'train', 'play', 'doctor', 'clean', 'light', 'stats', 'alert'];
    const SELECTABLE_ICONS = ['feed', 'train', 'play', 'doctor', 'clean', 'light', 'stats'];

    /* ============================================================
       ELEMENTOS DO DOM
       ============================================================ */
    const canvas = document.getElementById('petCanvas');
    const ctx = canvas ? canvas.getContext('2d') : null;
    const shellEl = document.getElementById('tamaShell');
    const overlayEl = document.getElementById('tamaOverlay');
    const toastEl = document.getElementById('tamaToast');

    /* Setup Screen */
    const setupScreen = document.getElementById('setupScreen');
    const petNameInput = document.getElementById('petNameInput');
    const btnStartJourney = document.getElementById('btnStartJourney');
    const btnCancelSetup = document.getElementById('btnCancelSetup');
    const openSetupBtn = document.getElementById('openSetupBtn');
    const shellColorInput = document.getElementById('shellColorInput');
    const accentColorInput = document.getElementById('accentColorInput');
    const screenColorInput = document.getElementById('screenColorInput');
    const shellPresetsEl = document.getElementById('shellPresets');
    const accentPresetsEl = document.getElementById('accentPresets');
    const screenPresetsEl = document.getElementById('screenPresets');

    /* Painel Lívido / Status */
    const petNameLabel = document.getElementById('petNameLabel');
    const barHunger = document.getElementById('barHunger');
    const barHappiness = document.getElementById('barHappiness');
    const barHygiene = document.getElementById('barHygiene');
    const barHealth = document.getElementById('barHealth');
    const barDiscipline = document.getElementById('barDiscipline');
    const stageLabel = document.getElementById('petStageLabel');
    const ageLabel = document.getElementById('petAgeLabel');
    const stateLabel = document.getElementById('petStateLabel');
    const muteBtn = document.getElementById('muteBtn');
    const historyPanel = document.getElementById('historyPanel');
    const historyList = document.getElementById('historyList');

    /* Ícones do LCD */
    const iconElements = {};
    ICON_IDS.forEach((id) => {
        const el = document.querySelector(`.lcd-icon[data-icon="${id}"]`);
        if (el) iconElements[id] = el;
    });

    const GRID_W = 70;
    const GRID_H = 50;
    const PIX = canvas ? canvas.width / GRID_W : 4;
    const FLOOR_Y = 43;

    function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

    /* ============================================================
       GERENCIAMENTO DE TEMA & CORES
       ============================================================ */
    const theme = Object.assign({
        shell: SHELL_PRESETS[0],
        accent: ACCENT_PRESETS[0],
        screen: SCREEN_PRESETS[0],
        muted: false
    }, loadJSON(THEME_KEY, {}));

    let ink = '#1a2717';

    function relativeLuminance(hex) {
        const c = hex.replace('#', '');
        const r = parseInt(c.substring(0, 2), 16) / 255;
        const g = parseInt(c.substring(2, 4), 16) / 255;
        const b = parseInt(c.substring(4, 6), 16) / 255;
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    function shadeColor(hex, percent) {
        const c = hex.replace('#', '');
        const num = parseInt(c.length === 3 ? c.split('').map((x) => x + x).join('') : c, 16);
        let r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
        const target = percent < 0 ? 0 : 255;
        const p = Math.abs(percent);
        r = Math.round((target - r) * p) + r;
        g = Math.round((target - g) * p) + g;
        b = Math.round((target - b) * p) + b;
        return '#' + [r, g, b].map((v) => clamp(v, 0, 255).toString(16).padStart(2, '0')).join('');
    }

    function applyTheme() {
        if (!shellEl) return;
        shellEl.style.setProperty('--shell-color', theme.shell);
        shellEl.style.setProperty('--shell-light', shadeColor(theme.shell, 0.25));
        shellEl.style.setProperty('--shell-dark', shadeColor(theme.shell, -0.22));

        shellEl.style.setProperty('--accent-color', theme.accent);
        shellEl.style.setProperty('--accent-light', shadeColor(theme.accent, 0.28));
        shellEl.style.setProperty('--accent-dark', shadeColor(theme.accent, -0.28));

        shellEl.style.setProperty('--screen-color', theme.screen);
        shellEl.style.setProperty('--screen-dark', shadeColor(theme.screen, -0.15));

        ink = relativeLuminance(theme.screen) < 0.35 ? '#d2f5c0' : '#1a2717';
        shellEl.style.setProperty('--ink-color', ink);
        if (overlayEl) overlayEl.style.color = ink;

        if (shellColorInput) shellColorInput.value = theme.shell;
        if (accentColorInput) accentColorInput.value = theme.accent;
        if (screenColorInput) screenColorInput.value = theme.screen;

        if (muteBtn) {
            muteBtn.textContent = theme.muted ? '🔇 Som Desligado' : '🔊 Som Ligado';
        }
        saveJSON(THEME_KEY, theme);
    }

    function buildPresets(container, colors, setter) {
        if (!container) return;
        container.innerHTML = '';
        colors.forEach((c) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'preset-swatch';
            b.style.background = c;
            b.setAttribute('aria-label', c);
            b.addEventListener('click', () => {
                setter(c);
                container.querySelectorAll('.preset-swatch').forEach((s) => s.classList.remove('active'));
                b.classList.add('active');
            });
            container.appendChild(b);
        });
    }

    buildPresets(shellPresetsEl, SHELL_PRESETS, (c) => { theme.shell = c; applyTheme(); });
    buildPresets(accentPresetsEl, ACCENT_PRESETS, (c) => { theme.accent = c; applyTheme(); });
    buildPresets(screenPresetsEl, SCREEN_PRESETS, (c) => { theme.screen = c; applyTheme(); });

    if (shellColorInput) shellColorInput.addEventListener('input', () => { theme.shell = shellColorInput.value; applyTheme(); });
    if (accentColorInput) accentColorInput.addEventListener('input', () => { theme.accent = accentColorInput.value; applyTheme(); });
    if (screenColorInput) screenColorInput.addEventListener('input', () => { theme.screen = screenColorInput.value; applyTheme(); });
    if (muteBtn) muteBtn.addEventListener('click', () => { theme.muted = !theme.muted; applyTheme(); });

    applyTheme();

    /* ============================================================
       SISTEMA DE ARQUIVAMENTO NO LOCALSTORAGE
       ============================================================ */
    function loadJSON(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (err) { return fallback; }
    }

    function saveJSON(key, val) {
        try { localStorage.setItem(key, JSON.stringify(val)); } catch (err) {}
    }

    /* Migração de save antigo ou carregamento de save atual */
    let state = loadJSON(STORAGE_KEY, null);
    if (!state) {
        const oldState = loadJSON(OLD_STORAGE_KEY, null);
        if (oldState) {
            state = oldState;
            state.v = 2;
            saveJSON(STORAGE_KEY, state);
        }
    }

    function freshState(name) {
        const now = Date.now();
        return {
            v: 2,
            name: name || 'Dino',
            birthTime: now,
            hatchTime: null,
            stage: 'egg',
            adultForm: null,
            hunger: 85,
            happiness: 85,
            hygiene: 100,
            health: 100,
            energy: 100,
            discipline: 50,
            poopCount: 0,
            isSick: false,
            lightsOn: true,
            isAlive: true,
            lastUpdate: now,
            careSum: 0,
            careDays: 0,
            sicknessEpisodes: 0
        };
    }

    function save() {
        if (state) saveJSON(STORAGE_KEY, state);
    }

    /* ============================================================
       ÁUDIO PIEZOELÉTRICO COM WEB AUDIO API
       ============================================================ */
    let audioCtx = null;
    function ensureAudio() {
        if (!audioCtx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return null;
            audioCtx = new AC();
        }
        if (audioCtx.state === 'suspended') audioCtx.resume();
        return audioCtx;
    }

    function beep(freq, dur, delay, vol) {
        if (theme.muted) return;
        const ac = ensureAudio();
        if (!ac) return;
        const t0 = ac.currentTime + (delay || 0);
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = 'square';
        osc.frequency.value = freq;
        gain.gain.value = 0;
        osc.connect(gain).connect(ac.destination);
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(vol || 0.05, t0 + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + (dur || 0.06));
        osc.start(t0);
        osc.stop(t0 + (dur || 0.06) + 0.02);
    }

    const SND = {
        nav: () => beep(1400, 0.04, 0, 0.04),
        confirm: () => { beep(880, 0.05, 0, 0.05); beep(1480, 0.08, 0.05, 0.05); },
        cancel: () => { beep(700, 0.06, 0, 0.05); beep(350, 0.08, 0.06, 0.05); },
        feed: () => { beep(550, 0.05, 0); beep(700, 0.05, 0.07); beep(850, 0.08, 0.14); },
        clean: () => { beep(900, 0.03, 0); beep(1200, 0.03, 0.04); beep(1500, 0.03, 0.08); beep(1800, 0.06, 0.12); },
        sick: () => { beep(350, 0.15, 0, 0.07); beep(280, 0.25, 0.18, 0.07); },
        hatch: () => {
            beep(523, 0.08, 0); beep(659, 0.08, 0.1); beep(784, 0.08, 0.2); beep(1046, 0.2, 0.3, 0.07);
        },
        death: () => { beep(300, 0.2, 0); beep(250, 0.25, 0.22); beep(200, 0.4, 0.48); },
        alert: () => { beep(2200, 0.08, 0, 0.07); beep(2200, 0.08, 0.15, 0.07); }
    };

    /* ============================================================
       SETUP E INTRO DEDICADA
       ============================================================ */
    function openSetup(isExisting) {
        if (!setupScreen) return;
        setupScreen.classList.remove('hidden');
        if (petNameInput) {
            petNameInput.value = (state && state.name) ? state.name : 'Dino';
            setTimeout(() => { petNameInput.focus(); petNameInput.select(); }, 100);
        }
        if (btnCancelSetup) {
            if (isExisting && state && state.isAlive) {
                btnCancelSetup.classList.remove('hidden');
            } else {
                btnCancelSetup.classList.add('hidden');
            }
        }
    }

    if (btnCancelSetup) {
        btnCancelSetup.addEventListener('click', () => {
            setupScreen.classList.add('hidden');
            SND.cancel();
        });
    }

    if (openSetupBtn) {
        openSetupBtn.addEventListener('click', () => {
            openSetup(true);
            SND.nav();
        });
    }

    if (btnStartJourney) {
        btnStartJourney.addEventListener('click', () => {
            const val = petNameInput ? petNameInput.value.trim().slice(0, 12) || 'Dino' : 'Dino';
            if (!state || !state.isAlive || btnCancelSetup.classList.contains('hidden')) {
                state = freshState(val);
            } else {
                state.name = val;
            }
            save();
            updateCompanionUI();
            setupScreen.classList.add('hidden');
            SND.hatch();
            showToastMsg('Ligado! 🦖🚀', 2200);
        });
    }

    if (petNameInput) {
        petNameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') btnStartJourney.click();
        });
    }

    /* Se não tem save ou o pet morreu no anterior, abre o setup inicial! */
    if (!state) {
        openSetup(false);
    }

    /* ============================================================
       MECÂNICA E ENVELHECIMENTO
       ============================================================ */
    function ageDays() {
        if (!state || !state.hatchTime) return 0;
        return (Date.now() - state.hatchTime) / DAY_MS;
    }

    function isNightNow() {
        const h = new Date().getHours();
        return h >= 21 || h < 7;
    }

    function applyDecay(deltaMs) {
        if (!state || !state.isAlive || deltaMs <= 0) return;

        if (state.stage === 'egg') {
            if (Date.now() - state.birthTime >= EGG_HATCH_MS) {
                state.stage = 'baby';
                state.hatchTime = Date.now();
                SND.hatch();
                showToastMsg('Ovo chocou! 🐣', 2500);
            }
            state.lastUpdate = Date.now();
            return;
        }

        const deltaDays = deltaMs / DAY_MS;
        const hungerBefore = state.hunger;
        const happyBefore = state.happiness;

        state.hunger = clamp(state.hunger - RATES.hunger * deltaDays, 0, 100);
        
        let happyDecay = RATES.happiness * deltaDays;
        if (state.hunger < 25) happyDecay *= 1.5;
        if (state.hygiene < 25) happyDecay *= 1.4;
        if (state.isSick) happyDecay *= 1.5;
        if (!state.lightsOn && isNightNow()) happyDecay *= 0.25;
        else if (!state.lightsOn) happyDecay *= 1.4;
        state.happiness = clamp(state.happiness - happyDecay, 0, 100);

        const poopExpected = deltaMs / POOP_INTERVAL_MS;
        const newPoops = Math.floor(poopExpected) + (Math.random() < (poopExpected % 1) ? 1 : 0);
        if (newPoops > 0) {
            state.poopCount = clamp(state.poopCount + newPoops, 0, MAX_POOP);
            if (state.poopCount >= 2) checkAlert();
        }
        state.hygiene = clamp(state.hygiene - (RATES.hygiene * deltaDays + newPoops * 18), 0, 100);

        if (state.lightsOn) {
            state.energy = clamp(state.energy - RATES.energyAwake * deltaDays, 0, 100);
        } else {
            state.energy = clamp(state.energy + RATES.energySleep * deltaDays, 0, 100);
        }

        state.discipline = clamp(state.discipline - RATES.discipline * deltaDays, 0, 100);

        if (!state.isSick) {
            const badness = (state.hunger < 25 || state.hygiene < 25 || state.poopCount >= 3);
            const lambda = (badness ? RATES.sickBad : RATES.sickBase) * deltaDays;
            if (Math.random() < (1 - Math.exp(-lambda))) {
                state.isSick = true;
                state.sicknessEpisodes += 1;
                SND.sick();
                showToastMsg('😷 Fiquei doente!', 2200);
                checkAlert();
            }
        }

        if (state.isSick) {
            state.health = clamp(state.health - RATES.healthSick * deltaDays, 0, 100);
        } else if (state.hunger <= 0 || state.happiness <= 0) {
            state.health = clamp(state.health - RATES.healthNeglect * deltaDays, 0, 100);
        } else if (state.hunger > 45 && state.happiness > 45 && state.hygiene > 45) {
            state.health = clamp(state.health + RATES.healthRegen * deltaDays, 0, 100);
        }

        state.careSum += (((hungerBefore + state.hunger)/2 + (happyBefore + state.happiness)/2 + state.hygiene)/3) * deltaDays;
        state.careDays += deltaDays;

        checkEvolution();
        checkAlert();

        if (state.health <= 0) {
            killPet('Negligência / Doença');
            return;
        }
        state.lastUpdate = Date.now();
    }

    function checkEvolution() {
        const ad = ageDays();
        if (state.stage === 'baby' && ad >= STAGE_DAYS.child) {
            state.stage = 'child';
            SND.hatch();
            showToastMsg('Evoluiu: Criança! 🦖', 2500);
        } else if (state.stage === 'child' && ad >= STAGE_DAYS.teen) {
            state.stage = 'teen';
            SND.hatch();
            showToastMsg('Evoluiu: Jovem T-Rex! 🦕', 2500);
        } else if (state.stage === 'teen' && ad >= STAGE_DAYS.adult) {
            state.stage = 'adult';
            const avg = state.careDays > 0 ? (state.careSum / state.careDays) : 65;
            const score = avg - (state.sicknessEpisodes * 6);
            state.adultForm = score >= 70 ? 'good' : score >= 40 ? 'neutral' : 'bad';
            SND.hatch();
            showToastMsg('Evoluiu: Dino Mestre! 👑', 2800);
        }
    }

    function killPet(cause) {
        state.isAlive = false;
        uiMode = 'idle';
        selectedIconIndex = -1;
        updateIconSelection();
        if (overlayEl) overlayEl.classList.add('hidden');
        if (toastEl) toastEl.classList.remove('show');
        SND.death();
        addHistory({
            name: state.name,
            days: Math.max(0, Math.floor(ageDays())),
            stage: state.stage,
            cause: cause,
            endedAt: Date.now()
        });
        save();
        updateCompanionUI();
    }

    function catchUp() {
        if (!state || !state.isAlive) return;
        const now = Date.now();
        const delta = now - state.lastUpdate;
        if (delta <= 0) return;
        applyDecay(delta);
        save();
    }

    /* ============================================================
       HISTÓRICO E MEMÓRIAS
       ============================================================ */
    function getHistory() { return loadJSON(HISTORY_KEY, []); }

    function addHistory(entry) {
        const h = getHistory();
        h.unshift(entry);
        saveJSON(HISTORY_KEY, h.slice(0, 15));
        renderHistory();
    }

    function renderHistory() {
        if (!historyPanel || !historyList) return;
        const h = getHistory();
        if (!h.length) { historyPanel.hidden = true; return; }
        historyPanel.hidden = false;
        historyList.innerHTML = '';
        h.forEach((e) => {
            const li = document.createElement('li');
            const st = e.stage === 'adult' ? 'Dino Mestre' : 'Dino';
            li.innerHTML = `<span>🦖 <strong>${escapeHtml(e.name)}</strong> (${st})</span><span>${e.days} dia(s) · ${e.cause}</span>`;
            historyList.appendChild(li);
        });
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
    renderHistory();

    /* ============================================================
       CONTROLE DOS 5 BOTões HARDWARE ANOS 90 & UI MODE
       ============================================================ */
    let uiMode = 'idle';        // idle | menu | minigame | clock | animating
    let selectedIconIndex = -1; // -1 = nenhum
    let animSequence = null;    // Para comer / banho / etc
    let minigameData = null;

    let toastTimer = null;
    function showToastMsg(text, ms) {
        if (!toastEl) return;
        toastEl.textContent = text;
        toastEl.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms || 1600);
    }

    function updateIconSelection() {
        ICON_IDS.forEach((id) => {
            if (iconElements[id]) iconElements[id].classList.remove('selected', 'active');
        });
        if (selectedIconIndex >= 0 && selectedIconIndex < SELECTABLE_ICONS.length) {
            const id = SELECTABLE_ICONS[selectedIconIndex];
            if (iconElements[id]) iconElements[id].classList.add('selected');
        }
    }

    function checkAlert() {
        const el = iconElements['alert'];
        if (!el) return;
        const needAlert = (state && state.isAlive && (state.hunger < 25 || state.hygiene < 30 || state.isSick || state.poopCount >= 2));
        if (needAlert && !el.classList.contains('alerting')) {
            el.classList.add('alerting');
            if (Math.random() < 0.5) SND.alert();
        } else if (!needAlert) {
            el.classList.remove('alerting');
        }
    }

    /* Handler Central dos Botões (Cliques + Teclado) */
    function handleHardwareBtn(btn) {
        if (!state) {
            openSetup(false);
            return;
        }
        if (!state.isAlive) {
            openSetup(false);
            return;
        }
        if (uiMode === 'animating') return; // Bloqueado durante animações dramáticas

        /* Modo Relógio Digital */
        if (uiMode === 'clock') {
            if (btn === 'CLOCK' || btn === 'ESC' || btn === 'ENTER') {
                uiMode = 'idle';
                SND.cancel();
                return;
            }
        }

        /* Modo Minigame Adivinhação */
        if (uiMode === 'minigame') {
            if (btn === 'ESC') {
                uiMode = 'idle';
                minigameData = null;
                SND.cancel();
                showToastMsg('Fim do jogo 🎮', 1400);
                return;
            }
            if (btn === 'LEFT' || btn === 'RIGHT') {
                playGuessingTurn(btn === 'LEFT' ? 'left' : 'right');
            }
            return;
        }

        /* Botão CLOCK alterna para tela de relógio sempre que pressionado fora do jogo */
        if (btn === 'CLOCK') {
            uiMode = 'clock';
            selectedIconIndex = -1;
            updateIconSelection();
            SND.confirm();
            return;
        }

        /* Botão ESC sai do menu e volta pro descanso */
        if (btn === 'ESC') {
            if (uiMode === 'menu') {
                uiMode = 'idle';
                selectedIconIndex = -1;
                updateIconSelection();
                SND.cancel();
            } else {
                SND.cancel();
            }
            return;
        }

        /* Botões LEFT / RIGHT de navegação */
        if (btn === 'LEFT' || btn === 'RIGHT') {
            if (uiMode === 'idle') {
                uiMode = 'menu';
                selectedIconIndex = (btn === 'LEFT') ? SELECTABLE_ICONS.length - 1 : 0;
            } else {
                if (btn === 'RIGHT') {
                    selectedIconIndex = (selectedIconIndex + 1) % SELECTABLE_ICONS.length;
                } else {
                    selectedIconIndex = (selectedIconIndex - 1 + SELECTABLE_ICONS.length) % SELECTABLE_ICONS.length;
                }
            }
            SND.nav();
            updateIconSelection();
            const chosenId = SELECTABLE_ICONS[selectedIconIndex];
            const metaTitles = {
                feed: '🍗 Alimentar', train: '📚 Estudar / Treino', play: '🎮 Brincar (Esq/Dir)',
                doctor: '💉 Remédio', clean: '🚿 Banho / Limpar', light: '💡 Luz / Sono', stats: '📊 Medidor de Status'
            };
            showToastMsg(metaTitles[chosenId] || '', 1200);
            return;
        }

        /* Botão ENTER confirma a ação do menu selecionado */
        if (btn === 'ENTER') {
            if (uiMode === 'idle') {
                /* Se der ENTER com alerta piscando ou sem menu, seleciona o primeiro ícone */
                uiMode = 'menu';
                selectedIconIndex = 0;
                updateIconSelection();
                SND.nav();
                showToastMsg('🍗 Alimentar', 1200);
                return;
            }

            if (selectedIconIndex >= 0) {
                const actionId = SELECTABLE_ICONS[selectedIconIndex];
                if (iconElements[actionId]) iconElements[actionId].classList.add('active');
                executeAction(actionId);
            }
        }
    }

    /* Ações Físicas dos Ícones do LCD */
    function executeAction(actionId) {
        setTimeout(() => {
            if (iconElements[actionId]) iconElements[actionId].classList.remove('active');
        }, 600);

        if (state.stage === 'egg' && actionId !== 'stats' && actionId !== 'light') {
            showToastMsg('Ainda é um ovo! 🥚', 1400);
            SND.cancel();
            return;
        }

        if (actionId === 'feed') {
            if (state.hunger >= 98) {
                showToastMsg('Barriguinha cheia! 🍖', 1500);
                SND.cancel();
                return;
            }
            uiMode = 'animating';
            SND.feed();
            showToastMsg('Nhom nhom... 🍗', 1600);
            animSequence = { type: 'feed', step: 0, maxStep: 14, onDone: () => {
                state.hunger = clamp(state.hunger + 32, 0, 100);
                state.happiness = clamp(state.happiness + 8, 0, 100);
                uiMode = 'idle';
                save(); updateCompanionUI();
            }};
            return;
        }

        if (actionId === 'train') {
            uiMode = 'animating';
            SND.confirm();
            showToastMsg('Treinando rugido! 🦖', 1600);
            animSequence = { type: 'train', step: 0, maxStep: 12, onDone: () => {
                state.discipline = clamp(state.discipline + 22, 0, 100);
                state.happiness = clamp(state.happiness - 4, 0, 100);
                uiMode = 'idle';
                save(); updateCompanionUI();
            }};
            return;
        }

        if (actionId === 'play') {
            if (state.energy < 15) {
                showToastMsg('Muitíssimo cansado! 😴', 1500);
                SND.cancel();
                return;
            }
            uiMode = 'minigame';
            minigameData = { round: 1, maxRounds: 5, wins: 0, state: 'waiting' };
            SND.confirm();
            showToastMsg('Adivinhe: ◄ Esq ou Dir ► ?', 2400);
            return;
        }

        if (actionId === 'doctor') {
            if (!state.isSick) {
                showToastMsg('Ele está super saudável! ✔️', 1500);
                SND.cancel();
                return;
            }
            uiMode = 'animating';
            SND.confirm();
            showToastMsg('Injeção curativa! 💉', 1800);
            animSequence = { type: 'doctor', step: 0, maxStep: 14, onDone: () => {
                state.isSick = false;
                state.health = clamp(state.health + 35, 0, 100);
                uiMode = 'idle';
                save(); updateCompanionUI(); checkAlert();
            }};
            return;
        }

        if (actionId === 'clean') {
            if (state.poopCount <= 0 && state.hygiene >= 95) {
                showToastMsg('Display brilhando! ✨', 1400);
                SND.cancel();
                return;
            }
            uiMode = 'animating';
            SND.clean();
            showToastMsg('Chuveirinho ligando! 🚿', 1600);
            animSequence = { type: 'clean', step: 0, maxStep: 16, onDone: () => {
                state.poopCount = 0;
                state.hygiene = 100;
                state.happiness = clamp(state.happiness + 6, 0, 100);
                uiMode = 'idle';
                save(); updateCompanionUI(); checkAlert();
            }};
            return;
        }

        if (actionId === 'light') {
            state.lightsOn = !state.lightsOn;
            SND.confirm();
            showToastMsg(state.lightsOn ? 'Luz acessa 💡' : 'Boa noite, Dino! 😴', 1800);
            save(); updateCompanionUI();
            return;
        }

        if (actionId === 'stats') {
            uiMode = 'stats_view';
            SND.confirm();
            showToastMsg('Verificando status...', 1200);
            setTimeout(() => { if (uiMode === 'stats_view') uiMode = 'idle'; }, 4500);
            return;
        }
    }

    /* Minigame Adivinhação Esquerda/Direita (Dinkie Dino Classic) */
    function playGuessingTurn(playerGuess) {
        if (!minigameData || minigameData.state !== 'waiting') return;
        minigameData.state = 'animating';
        const dinoSide = Math.random() < 0.5 ? 'left' : 'right';
        const win = (playerGuess === dinoSide);
        minigameData.dinoSide = dinoSide;

        if (win) {
            minigameData.wins++;
            SND.confirm();
            showToastMsg('Acertou! 🎉', 1200);
        } else {
            SND.cancel();
            showToastMsg('Errou! 🙈', 1200);
        }

        setTimeout(() => {
            if (uiMode !== 'minigame' || !minigameData) return;
            minigameData.round++;
            if (minigameData.round > minigameData.maxRounds) {
                const finalWin = minigameData.wins >= 3;
                if (finalWin) {
                    state.happiness = clamp(state.happiness + 25, 0, 100);
                    state.energy = clamp(state.energy - 10, 0, 100);
                    SND.hatch();
                    showToastMsg(`Vitória! ${minigameData.wins}/5 🏆`, 2500);
                } else {
                    state.happiness = clamp(state.happiness + 5, 0, 100);
                    showToastMsg(`Fim! Acertou ${minigameData.wins}/5`, 2000);
                }
                uiMode = 'idle';
                minigameData = null;
                save(); updateCompanionUI();
            } else {
                minigameData.state = 'waiting';
                showToastMsg(`Rodada ${minigameData.round}/5: ◄ ou ►?`, 1500);
            }
        }, 1200);
    }

    /* Ligações DOM <-> Botões Físicos */
    document.querySelectorAll('[data-btn]').forEach((btnEl) => {
        btnEl.addEventListener('mousedown', () => btnEl.classList.add('pressed'));
        btnEl.addEventListener('mouseup', () => btnEl.classList.remove('pressed'));
        btnEl.addEventListener('mouseleave', () => btnEl.classList.remove('pressed'));
        btnEl.addEventListener('click', (e) => {
            e.preventDefault();
            const code = btnEl.getAttribute('data-btn');
            handleHardwareBtn(code);
        });
    });

    /* Atalhos de Teclado no Navegador */
    window.addEventListener('keydown', (e) => {
        if (!setupScreen || !setupScreen.classList.contains('hidden')) return; // Evita interferir na digitação no Setup
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        const key = e.key.toLowerCase();
        if (key === 'arrowleft' || key === 'a') { handleHardwareBtn('LEFT'); highlightBtn('LEFT'); }
        else if (key === 'arrowright' || key === 'd') { handleHardwareBtn('RIGHT'); highlightBtn('RIGHT'); }
        else if (key === 'enter' || key === ' ') { handleHardwareBtn('ENTER'); highlightBtn('ENTER'); }
        else if (key === 'escape' || key === 'backspace' || key === 'e') { handleHardwareBtn('ESC'); highlightBtn('ESC'); }
        else if (key === 'c' || key === 'q') { handleHardwareBtn('CLOCK'); highlightBtn('CLOCK'); }
    });

    function highlightBtn(code) {
        const el = document.querySelector(`[data-btn="${code}"]`);
        if (el) {
            el.classList.add('pressed');
            setTimeout(() => el.classList.remove('pressed'), 160);
        }
    }

    /* ============================================================
       ATUALIZAÇÃO DA UI DO PAINEL COMPANION
       ============================================================ */
    function barClass(val) { return val <= 20 ? 'critical' : val <= 45 ? 'low' : ''; }
    function setBar(el, val) {
        if (!el) return;
        el.style.width = clamp(val, 0, 100) + '%';
        el.className = 'stat-fill ' + barClass(val);
    }

    function getStageTitle(stage, form) {
        if (stage === 'egg') return 'Ovo Rakuraku';
        if (stage === 'baby') return 'Bebê Dino 🐣';
        if (stage === 'child') return 'Criança 🦕';
        if (stage === 'teen') return 'Jovem T-Rex 🦖';
        if (stage === 'adult') {
            const f = form === 'good' ? 'Radiante ✨' : form === 'bad' ? 'Selvagem 💥' : 'Valente 🛡️';
            return `Dino Mestre (${f})`;
        }
        return stage;
    }

    function updateCompanionUI() {
        if (!state) return;
        if (petNameLabel) petNameLabel.textContent = state.name.toUpperCase();
        if (stageLabel) stageLabel.textContent = getStageTitle(state.stage, state.adultForm);
        if (ageLabel) ageLabel.textContent = 'Dia ' + Math.floor(ageDays());
        
        setBar(barHunger, state.hunger);
        setBar(barHappiness, state.happiness);
        setBar(barHygiene, state.hygiene);
        setBar(barHealth, state.health);
        setBar(barDiscipline, state.discipline);

        if (stateLabel) {
            if (!state.isAlive) {
                stateLabel.innerHTML = '🔴 Faleceu';
            } else if (state.isSick) {
                stateLabel.innerHTML = '⚠️ Doente!';
            } else if (!state.lightsOn) {
                stateLabel.innerHTML = '😴 Dormindo';
            } else {
                stateLabel.innerHTML = '🟢 Ativo';
            }
        }
    }

    /* ============================================================
       MOTOR DE RENDERIZAÇÃO RETRÔ (DOT MATRIX CANVAS 2D)
       ============================================================ */
    function rect(gx, gy, gw, gh) {
        ctx.fillRect(Math.round(gx * PIX), Math.round(gy * PIX), Math.round(gw * PIX), Math.round(gh * PIX));
    }
    function clearRectG(gx, gy, gw, gh) {
        ctx.clearRect(Math.round(gx * PIX), Math.round(gy * PIX), Math.round(gw * PIX), Math.round(gh * PIX));
    }

    function drawFloor() {
        ctx.fillStyle = ink;
        rect(4, FLOOR_Y, 62, 1);
    }

    function drawPoops(count) {
        ctx.fillStyle = ink;
        const slots = [8, 14, 55, 49];
        for (let i = 0; i < count; i++) {
            const x = slots[i % 4];
            rect(x, FLOOR_Y - 2, 3, 2);
            rect(x + 1, FLOOR_Y - 4, 1, 2);
            /* mosquinha */
            if (Math.sin(Date.now() / 200 + i) > 0) rect(x + 2, FLOOR_Y - 6, 1, 1);
        }
    }

    function drawMoonStars(phase) {
        ctx.fillStyle = ink;
        /* Lua Crescente no topo direito */
        rect(54, 6, 4, 6);
        clearRectG(53, 7, 3, 4);
        /* Estrelinhas que piscam com fase */
        if (Math.sin(phase) > -0.5) rect(16, 8, 1, 1);
        if (Math.cos(phase * 1.5) > 0) rect(32, 5, 1, 1);
        if (Math.sin(phase * 2) > 0) rect(45, 11, 1, 1);
    }

    /* Sprite do Dinossauro de Acordo com Estágio e Humor */
    function drawDinoSprite(cx, cy, stage, mood, phase, anim) {
        ctx.fillStyle = ink;

        /* OVO MANCHADO RAKURAKU */
        if (stage === 'egg') {
            const wiggle = Math.sin(phase * 4) > 0.6 ? (Math.sin(phase * 8) > 0 ? 1 : -1) : 0;
            const x = cx + wiggle;
            rect(x - 6, cy - 10, 12, 11);
            clearRectG(x - 6, cy - 10, 2, 2);
            clearRectG(x + 4, cy - 10, 2, 2);
            clearRectG(x - 6, cy - 1, 1, 1);
            clearRectG(x + 5, cy - 1, 1, 1);
            /* Manchas do ovo de dinossauro */
            clearRectG(x - 2, cy - 7, 3, 2);
            clearRectG(x - 4, cy - 3, 2, 2);
            clearRectG(x + 1, cy - 4, 3, 2);
            return;
        }

        /* ANJO (FALECEU) */
        if (!state.isAlive || mood === 'angel') {
            rect(cx - 5, cy - 12, 10, 8);
            /* Asas */
            const flap = Math.sin(phase * 3) > 0 ? 3 : 1;
            rect(cx - 11, cy - 11 - flap, 5, 3);
            rect(cx + 6, cy - 11 - flap, 5, 3);
            /* Auréola */
            rect(cx - 4, cy - 17, 8, 1);
            rect(cx - 5, cy - 16, 1, 1);
            rect(cx + 4, cy - 16, 1, 1);
            /* Olhinhos tristes */
            clearRectG(cx - 3, cy - 9, 2, 1);
            clearRectG(cx + 1, cy - 9, 2, 1);
            return;
        }

        /* CONFIGURAÇÕES DO CORPO POR ESTÁGIO EVOLUTIVO */
        let w = 12, h = 12, tail = 4, spikes = 3, arm = 2;
        if (stage === 'baby') { w = 10; h = 10; tail = 2; spikes = 2; arm = 0; }
        else if (stage === 'child') { w = 14; h = 13; tail = 5; spikes = 4; arm = 2; }
        else if (stage === 'teen') { w = 16; h = 15; tail = 6; spikes = 5; arm = 3; }
        else if (stage === 'adult') { w = 20; h = 18; tail = 8; spikes = 6; arm = 4; }

        const bounce = (mood === 'sleep') ? 0 : Math.abs(Math.sin(phase * 2)) * 1.5;
        const topY = cy - h - bounce;
        const leftX = cx - Math.floor(w / 2);

        /* Pernas em marcha */
        const step = Math.sin(phase * 3) > 0 ? 1 : 0;
        rect(cx - w * 0.35 - 1, FLOOR_Y - 3 + (mood === 'sleep' ? 0 : step), 3, 3);
        rect(cx + w * 0.35 - 1, FLOOR_Y - 3 + (mood === 'sleep' ? 0 : 1 - step), 3, 3);

        /* Cauda Retrô de Dinossauro à esquerda ou direita */
        for (let i = 0; i < tail; i++) {
            rect(cx - Math.floor(w / 2) - i * 1.2, cy - Math.floor(h * 0.4) - Math.sin(phase + i * 0.5) * 2, 2, 2);
        }

        /* Corpo Principal Ovalado */
        rect(leftX, topY, w, h);
        /* Arredondar cantos do pixel art */
        clearRectG(leftX, topY, 2, 2);
        clearRectG(leftX + w - 2, topY, 2, 2);
        clearRectG(leftX, topY + h - 2, 2, 2);
        clearRectG(leftX + w - 2, topY + h - 2, 2, 2);

        /* Espinhas Dorsais / Placas (Triceratops / T-Rex) */
        for (let s = 0; s < spikes; s++) {
            const sx = leftX + 2 + (s * ((w - 4) / spikes));
            rect(sx, topY - 2, 2, 2);
        }

        /* Braços curtos de T-Rex / Dino na frente */
        if (arm > 0) {
            const armY = topY + Math.floor(h * 0.45) + (Math.sin(phase * 4) > 0 ? 1 : 0);
            rect(leftX + w - 2, armY, arm, 2);
            rect(leftX + w - 2 + arm, armY - 1, 1, 1); // garras
        }

        /* Olhos de Liquid Crystal (Piscando) */
        const blink = (Math.sin(phase * 0.4) > 0.94);
        const eyeX = leftX + w - Math.floor(w * 0.35);
        const eyeY = topY + Math.floor(h * 0.28);
        if (mood === 'sleep') {
            rect(eyeX - 3, eyeY + 1, 4, 1);
        } else if (mood === 'sick') {
            /* Olho com X ou caída */
            clearRectG(eyeX - 2, eyeY, 3, 3);
            rect(eyeX - 2, eyeY, 1, 1); rect(eyeX, eyeY + 2, 1, 1);
            rect(eyeX, eyeY, 1, 1); rect(eyeX - 2, eyeY + 2, 1, 1);
        } else if (!blink) {
            clearRectG(eyeX - 2, eyeY, 3, 3);
            rect(eyeX - 1, eyeY + 1, 1, 1); // pupila ativa
        }

        /* Boca e Expressão */
        const mouthY = topY + Math.floor(h * 0.65);
        const mouthX = leftX + w - 4;
        if (anim && anim.type === 'feed' && Math.sin(phase * 8) > 0) {
            clearRectG(mouthX, mouthY - 1, 4, 4); // bocão comendo
        } else if (mood === 'happy' || mood === 'good') {
            clearRectG(mouthX, mouthY, 4, 1);
            clearRectG(mouthX - 1, mouthY - 1, 1, 1);
            clearRectG(mouthX + 3, mouthY - 1, 1, 1);
        } else if (mood === 'bad' || mood === 'sick') {
            clearRectG(mouthX, mouthY + 1, 4, 1);
            clearRectG(mouthX - 1, mouthY + 2, 1, 1);
            clearRectG(mouthX + 3, mouthY + 2, 1, 1);
        } else if (mood !== 'sleep') {
            clearRectG(mouthX, mouthY, 3, 1);
        }

        /* Gotinha de suor quando doente */
        if (state.isSick && Math.sin(phase * 4) > 0) {
            rect(leftX + w + 1, topY + 2, 2, 3);
        }

        /* Zzz de dormir */
        if (mood === 'sleep') {
            const zy = Math.floor((Date.now() / 200) % 15);
            rect(leftX + w + 2 + (zy % 4), topY - zy, 2, 2);
            rect(leftX + w + 6 + (zy % 4), topY - 6 - zy, 3, 2);
        }
    }

    /* Desenha Coxa de Carne ou Cenoura (Animação Feed) */
    function drawFoodItem(step) {
        ctx.fillStyle = ink;
        const fx = 54, fy = FLOOR_Y - 6;
        if (step < 8) {
            /* Coxa de galinha / carne de dinossauro 🍖 */
            rect(fx, fy, 6, 5);
            rect(fx + 6, fy + 2, 3, 2);
            rect(fx + 8, fy + 1, 2, 1);
            rect(fx + 8, fy + 4, 2, 1);
            if (step > 3) clearRectG(fx, fy, 2, 5); // mordida 1
            if (step > 6) clearRectG(fx + 2, fy, 2, 5); // mordida 2
        }
    }

    /* Animação do Chuveirinho Lavando Coco */
    function drawShowerAnim(step) {
        ctx.fillStyle = ink;
        /* Chuveirinho no topo */
        rect(25, 4, 20, 3);
        /* Gotas de água caem paralelamente */
        const dropY = 8 + (step * 2.5);
        for (let i = 0; i < 5; i++) {
            rect(27 + i * 4, (dropY + (i % 2) * 4) % (FLOOR_Y - 4), 1, 3);
        }
    }

    /* Animação e Tela de Minigame (Esq / Dir) */
    function drawMinigameScreen(phase) {
        ctx.fillStyle = ink;
        /* Indicadores de seta esquerda e direita no display */
        rect(6, 20, 6, 2); rect(6, 18, 2, 6);
        rect(58, 20, 6, 2); rect(62, 18, 2, 6);

        if (minigameData.state === 'waiting') {
            /* Dino no meio, curioso */
            drawDinoSprite(35, FLOOR_Y - 3, state.stage, 'happy', phase, null);
            /* Pegação de atenção: pontinho de interrogação ? */
            rect(34, 12, 3, 1); rect(36, 13, 1, 2); rect(35, 15, 1, 1); rect(35, 17, 1, 1);
        } else {
            const side = minigameData.dinoSide;
            const x = side === 'left' ? 18 : 52;
            drawDinoSprite(x, FLOOR_Y - 3 - 4, state.stage, 'happy', phase, null);
        }
        /* Placar de Vitórias */
        for (let i = 0; i < 5; i++) {
            rect(22 + i * 5, 5, 3, 3);
            if (i >= minigameData.wins) clearRectG(23, 6, 1, 1);
        }
    }

    /* Tela do Relógio Digital Retrô 1997 */
    function drawClockView() {
        ctx.fillStyle = ink;
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');

        /* Caixa de Moldura LCD no Canvas */
        rect(8, 10, 54, 28);
        clearRectG(9, 11, 52, 26);
        rect(10, 12, 50, 24);
        clearRectG(12, 14, 46, 20);

        /* Desenha Texto Digital usando Canvas Vanilla Font */
        ctx.font = '700 24px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const blink = now.getSeconds() % 2 === 0 ? ':' : ' ';
        ctx.fillText(`${hh}${blink}${mm}`, canvas.width / 2, canvas.height / 2 - 8);
        
        ctx.font = '700 11px "Press Start 2P", monospace';
        ctx.fillText(`SEG ${ss}s`, canvas.width / 2, canvas.height / 2 + 16);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
    }

    /* Tela de Visualização de Status (Acionada pelo ícone Stats) */
    function drawStatsView() {
        ctx.fillStyle = ink;
        rect(6, 6, 58, 38);
        clearRectG(8, 8, 54, 34);
        ctx.font = '700 10px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`NOME: ${state.name}`, canvas.width / 2, 42);
        ctx.fillText(`FOME: ${Math.round(state.hunger)}%`, canvas.width / 2, 72);
        ctx.fillText(`ALEG: ${Math.round(state.happiness)}%`, canvas.width / 2, 102);
        ctx.fillText(`SAUDE: ${Math.round(state.health)}%`, canvas.width / 2, 132);
        ctx.fillText(state.isSick ? '⚠️ DOENTE' : '✔️ SAUDAVEL', canvas.width / 2, 162);
        ctx.textAlign = 'left';
    }

    /* ============================================================
       LOOP PRINCIPAL DE RENDERIZAÇÃO NO CANVAS
       ============================================================ */
    let lastRender = 0;
    function render(timestamp) {
        requestAnimationFrame(render);
        if (timestamp - lastRender < RENDER_MS) return;
        lastRender = timestamp;

        if (!ctx || !canvas) return;

        /* Limpa Tela LCD */
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!state) return;

        /* MODO RELÓGIO DIGITAL */
        if (uiMode === 'clock') {
            drawClockView();
            return;
        }

        /* MODO MEDIDOR DE STATUS RÁPIDO */
        if (uiMode === 'stats_view') {
            drawStatsView();
            return;
        }

        /* MODO MINIGAME */
        if (uiMode === 'minigame') {
            drawFloor();
            drawMinigameScreen(timestamp / 300);
            return;
        }

        /* MODO JOGABILIDADE PADRÃO E ANIMAÇÕES */
        drawFloor();

        /* Fundo Noturno */
        if (!state.lightsOn || (!state.isAlive && isNightNow())) {
            drawMoonStars(timestamp / 400);
        }

        /* Cocos no chão */
        if (state.poopCount > 0 && (!animSequence || animSequence.type !== 'clean')) {
            drawPoops(state.poopCount);
        }

        /* Calcular Humor */
        let mood = 'happy';
        if (!state.isAlive) mood = 'angel';
        else if (state.isSick) mood = 'sick';
        else if (!state.lightsOn) mood = 'sleep';
        else if (state.hunger < 30 || state.happiness < 30) mood = 'bad';

        /* Posição X do Dino (Andando alegre se estiver bem) */
        let dinoX = 35;
        if (state.isAlive && state.lightsOn && !state.isSick && !animSequence && state.stage !== 'egg') {
            dinoX = 35 + Math.floor(Math.sin(timestamp / 700) * 14);
        } else if (animSequence && animSequence.type === 'feed') {
            /* Caminha com pressa até a comida na direita */
            dinoX = Math.min(46, 30 + animSequence.step * 2);
        }

        drawDinoSprite(dinoX, FLOOR_Y - 3, state.stage, mood, timestamp / 300, animSequence);

        /* Elementos de Animação Ativas */
        if (animSequence) {
            animSequence.step++;
            if (animSequence.type === 'feed') drawFoodItem(animSequence.step);
            if (animSequence.type === 'clean') drawShowerAnim(animSequence.step);

            if (animSequence.step >= animSequence.maxStep) {
                const done = animSequence.onDone;
                animSequence = null;
                if (done) done();
            }
        }
    }

    /* ============================================================
       LOOP DE TEMPO E DECAY
       ============================================================ */
    setInterval(() => {
        if (!state || !state.isAlive) return;
        applyDecay(DECAY_MS);
        updateCompanionUI();
        save();
    }, DECAY_MS);

    /* Inicialização */
    catchUp();
    updateCompanionUI();
    requestAnimationFrame(render);

})();
