(function () {
    'use strict';

    /* ============================================================
       RAKURAKU DINOKUN / DINKIE DINO — lógica fiel 1997
       ============================================================ */
    const STORAGE_KEY = 'tamagotchi-dinkie-v3';
    const OLD_KEYS = ['tamagotchi-dinkie-v2', 'ovinho-save-v1'];
    const THEME_KEY = 'tamagotchi-theme-v3';
    const HISTORY_KEY = 'tamagotchi-history-v3';

    const DAY_MS = 10 * 60 * 1000;
    const EGG_HATCH_MS = 45 * 1000;
    const STAGE_DAYS = { child: 1, teen: 2.5, adult: 4.5 };
    const MAX_POOP = 4;
    const POOP_INTERVAL_MS = DAY_MS / 4;
    const RENDER_MS = 130;
    const DECAY_MS = 1000;
    const IDEAL_TEMP = 25;

    const RATES = {
        hunger: 90,
        thirst: 75,
        happiness: 65,
        hygiene: 40,
        discipline: 18,
        energyAwake: 50,
        energySleep: 220,
        sickBase: 0.04,
        sickBad: 0.55,
        healthSick: 25,
        healthNeglect: 12,
        healthRegen: 6,
        tempDrift: 8
    };

    /* Amarelo clássico = botões vermelhos + cap azul */
    const SHELL_PRESETS = ['#f6c836', '#37b264', '#e8455a', '#8a56ce', '#3898f8', '#f0f2f5', '#2a313d'];
    const ACCENT_PRESETS = ['#e23b2e', '#262626', '#1d63ed', '#f06c30', '#10b981', '#ffffff'];
    const SCREEN_PRESETS = ['#9aaa7a', '#78a6ba', '#c6d175', '#e2b3c2', '#bcf49c', '#d2dfd4'];

    /* Layout autêntico: esquerda / direita separados */
    const LEFT_ICONS = ['drink', 'food', 'light', 'discipline', 'stats'];
    const RIGHT_ICONS = ['play', 'study', 'bath', 'ac', 'medicine'];
    const ALL_ICONS = LEFT_ICONS.concat(RIGHT_ICONS);

    const FOODS = [
        { id: 'burger', label: 'Hamburguer', hunger: 28, happy: 4 },
        { id: 'chicken', label: 'Frango', hunger: 30, happy: 6 },
        { id: 'apple', label: 'Maca', hunger: 18, happy: 8 },
        { id: 'carrot', label: 'Cenoura', hunger: 16, happy: 5 },
        { id: 'icecream', label: 'Sorvete', hunger: 12, happy: 22 },
        { id: 'noodles', label: 'Macarrao', hunger: 26, happy: 7 }
    ];

    const RPS = ['rock', 'scissors', 'paper'];
    const RPS_LABEL = { rock: 'PEDRA', scissors: 'TESOURA', paper: 'PAPEL' };

    const canvas = document.getElementById('petCanvas');
    const ctx = canvas ? canvas.getContext('2d') : null;
    const shellEl = document.getElementById('tamaShell');
    const overlayEl = document.getElementById('tamaOverlay');
    const toastEl = document.getElementById('tamaToast');

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

    const petNameLabel = document.getElementById('petNameLabel');
    const barHunger = document.getElementById('barHunger');
    const barThirst = document.getElementById('barThirst');
    const barHappiness = document.getElementById('barHappiness');
    const barHygiene = document.getElementById('barHygiene');
    const barHealth = document.getElementById('barHealth');
    const barDiscipline = document.getElementById('barDiscipline');
    const stageLabel = document.getElementById('petStageLabel');
    const ageLabel = document.getElementById('petAgeLabel');
    const tempLabel = document.getElementById('petTempLabel');
    const stateLabel = document.getElementById('petStateLabel');
    const muteBtn = document.getElementById('muteBtn');
    const historyPanel = document.getElementById('historyPanel');
    const historyList = document.getElementById('historyList');

    const iconElements = {};
    ALL_ICONS.forEach((id) => {
        const el = document.querySelector(`.lcd-icon[data-icon="${id}"]`);
        if (el) iconElements[id] = el;
    });

    const GRID_W = 70;
    const PIX = canvas ? canvas.width / GRID_W : 4;
    const FLOOR_Y = 43;

    function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

    function loadJSON(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (err) { return fallback; }
    }

    function saveJSON(key, val) {
        try { localStorage.setItem(key, JSON.stringify(val)); } catch (err) {}
    }

    /* ---------- Tema ---------- */
    const theme = Object.assign({
        shell: SHELL_PRESETS[0],
        accent: ACCENT_PRESETS[0],
        screen: SCREEN_PRESETS[0],
        muted: false
    }, loadJSON(THEME_KEY, loadJSON('tamagotchi-theme-v2', {})));

    let ink = '#1c2418';

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
        shellEl.style.setProperty('--shell-light', shadeColor(theme.shell, 0.28));
        shellEl.style.setProperty('--shell-dark', shadeColor(theme.shell, -0.22));
        shellEl.style.setProperty('--accent-color', theme.accent);
        shellEl.style.setProperty('--accent-light', shadeColor(theme.accent, 0.28));
        shellEl.style.setProperty('--accent-dark', shadeColor(theme.accent, -0.28));
        shellEl.style.setProperty('--screen-color', theme.screen);
        shellEl.style.setProperty('--screen-dark', shadeColor(theme.screen, -0.14));
        ink = relativeLuminance(theme.screen) < 0.35 ? '#d2f5c0' : '#1c2418';
        shellEl.style.setProperty('--ink-color', ink);
        if (overlayEl) overlayEl.style.color = ink;
        if (shellColorInput) shellColorInput.value = theme.shell;
        if (accentColorInput) accentColorInput.value = theme.accent;
        if (screenColorInput) screenColorInput.value = theme.screen;
        if (muteBtn) muteBtn.textContent = theme.muted ? 'Som desligado' : 'Som ligado';
        saveJSON(THEME_KEY, theme);
    }

    function buildPresets(container, colors, setter) {
        if (!container) return;
        container.innerHTML = '';
        colors.forEach((c) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'preset-swatch' + (setter._current === c || false ? '' : '');
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

    /* ---------- Estado ---------- */
    function migrateState(raw) {
        if (!raw) return null;
        const s = Object.assign(freshState(raw.name || 'Dino'), raw);
        if (s.thirst == null) s.thirst = 85;
        if (s.temperature == null) s.temperature = IDEAL_TEMP;
        if (s.acOn == null) s.acOn = false;
        if (s.weight == null) s.weight = 5;
        if (s.dirty == null) s.dirty = false;
        if (s.angry == null) s.angry = false;
        if (s.v < 3) s.v = 3;
        return s;
    }

    function freshState(name) {
        const now = Date.now();
        return {
            v: 3,
            name: name || 'Dino',
            birthTime: now,
            hatchTime: null,
            stage: 'egg',
            adultForm: null,
            hunger: 85,
            thirst: 85,
            happiness: 85,
            hygiene: 100,
            health: 100,
            energy: 100,
            discipline: 40,
            weight: 5,
            temperature: IDEAL_TEMP,
            acOn: false,
            poopCount: 0,
            isSick: false,
            dirty: false,
            angry: false,
            lightsOn: true,
            isAlive: true,
            lastUpdate: now,
            careSum: 0,
            careDays: 0,
            sicknessEpisodes: 0,
            foodBias: { burger: 0, chicken: 0, apple: 0, carrot: 0, icecream: 0, noodles: 0 }
        };
    }

    let state = migrateState(loadJSON(STORAGE_KEY, null));
    if (!state) {
        for (let i = 0; i < OLD_KEYS.length; i++) {
            const old = loadJSON(OLD_KEYS[i], null);
            if (old) {
                state = migrateState(old);
                saveJSON(STORAGE_KEY, state);
                break;
            }
        }
    }

    function save() {
        if (state) saveJSON(STORAGE_KEY, state);
    }

    /* ---------- Áudio piezo ---------- */
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

    /* ---------- Setup ---------- */
    function openSetup(isExisting) {
        if (!setupScreen) return;
        setupScreen.classList.remove('hidden');
        if (petNameInput) {
            petNameInput.value = (state && state.name) ? state.name : 'Dino';
            setTimeout(() => { petNameInput.focus(); petNameInput.select(); }, 80);
        }
        if (btnCancelSetup) {
            if (isExisting && state && state.isAlive) btnCancelSetup.classList.remove('hidden');
            else btnCancelSetup.classList.add('hidden');
        }
    }

    if (btnCancelSetup) {
        btnCancelSetup.addEventListener('click', () => {
            setupScreen.classList.add('hidden');
            SND.cancel();
        });
    }
    if (openSetupBtn) {
        openSetupBtn.addEventListener('click', () => { openSetup(true); SND.nav(); });
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
            showToastMsg('Ligado!', 2000);
        });
    }
    if (petNameInput) {
        petNameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') btnStartJourney.click();
        });
    }
    if (!state) openSetup(false);

    /* ---------- Tempo / decay ---------- */
    function ageDays() {
        if (!state || !state.hatchTime) return 0;
        return (Date.now() - state.hatchTime) / DAY_MS;
    }

    function isNightNow() {
        const h = new Date().getHours();
        return h >= 21 || h < 9;
    }

    function educationGrade(d) {
        if (d >= 90) return 'A+';
        if (d >= 75) return 'A';
        if (d >= 60) return 'B+';
        if (d >= 45) return 'B';
        if (d >= 30) return 'C';
        if (d >= 15) return 'D';
        return 'E+';
    }

    function applyDecay(deltaMs) {
        if (!state || !state.isAlive || deltaMs <= 0) return;

        if (state.stage === 'egg') {
            if (Date.now() - state.birthTime >= EGG_HATCH_MS) {
                state.stage = 'baby';
                state.hatchTime = Date.now();
                SND.hatch();
                showToastMsg('Chocou!', 2200);
            }
            state.lastUpdate = Date.now();
            return;
        }

        const deltaDays = deltaMs / DAY_MS;
        const hungerBefore = state.hunger;
        const happyBefore = state.happiness;

        state.hunger = clamp(state.hunger - RATES.hunger * deltaDays, 0, 100);
        state.thirst = clamp(state.thirst - RATES.thirst * deltaDays, 0, 100);

        /* Temperatura: AC ligado esfria, desligado esquenta */
        const tempDir = state.acOn ? -1 : 1;
        state.temperature = clamp(
            state.temperature + tempDir * RATES.tempDrift * deltaDays,
            10, 40
        );

        if (state.temperature >= 30) state.angry = true;
        if (state.temperature <= 18) { /* frio — tremor no render */ }
        if (Math.abs(state.temperature - IDEAL_TEMP) <= 3) state.angry = false;

        let happyDecay = RATES.happiness * deltaDays;
        if (state.hunger < 25) happyDecay *= 1.4;
        if (state.thirst < 25) happyDecay *= 1.3;
        if (state.hygiene < 25 || state.dirty) happyDecay *= 1.4;
        if (state.isSick) happyDecay *= 1.5;
        if (state.angry) happyDecay *= 1.35;
        if (!state.lightsOn && isNightNow()) happyDecay *= 0.25;
        else if (!state.lightsOn) happyDecay *= 1.35;
        if (Math.abs(state.temperature - IDEAL_TEMP) > 6) happyDecay *= 1.3;
        state.happiness = clamp(state.happiness - happyDecay, 0, 100);

        const poopExpected = deltaMs / POOP_INTERVAL_MS;
        const newPoops = Math.floor(poopExpected) + (Math.random() < (poopExpected % 1) ? 1 : 0);
        if (newPoops > 0) {
            state.poopCount = clamp(state.poopCount + newPoops, 0, MAX_POOP);
            if (state.poopCount >= 2) state.dirty = true;
        }
        state.hygiene = clamp(state.hygiene - (RATES.hygiene * deltaDays + newPoops * 16), 0, 100);
        if (state.hygiene < 35) state.dirty = true;

        if (state.lightsOn) {
            state.energy = clamp(state.energy - RATES.energyAwake * deltaDays, 0, 100);
        } else {
            state.energy = clamp(state.energy + RATES.energySleep * deltaDays, 0, 100);
        }

        state.discipline = clamp(state.discipline - RATES.discipline * deltaDays, 0, 100);

        /* Peso sobe com cuidado (comida/água convertidas) */
        if (state.hunger > 40 && state.thirst > 40) {
            state.weight = clamp(state.weight + 2.2 * deltaDays, 1, 99);
        }

        if (!state.isSick) {
            const badness = (
                state.hunger < 25 || state.thirst < 25 || state.hygiene < 25 ||
                state.poopCount >= 3 || Math.abs(state.temperature - IDEAL_TEMP) > 8 ||
                (state.lightsOn && isNightNow() && state.energy < 20)
            );
            const lambda = (badness ? RATES.sickBad : RATES.sickBase) * deltaDays;
            if (Math.random() < (1 - Math.exp(-lambda))) {
                state.isSick = true;
                state.sicknessEpisodes += 1;
                SND.sick();
                showToastMsg('Doente!', 2000);
                maybeAlertBeep();
            }
        }

        if (state.isSick) {
            state.health = clamp(state.health - RATES.healthSick * deltaDays, 0, 100);
        } else if (state.hunger <= 0 || state.thirst <= 0 || state.happiness <= 0) {
            state.health = clamp(state.health - RATES.healthNeglect * deltaDays, 0, 100);
        } else if (state.hunger > 45 && state.happiness > 45 && state.hygiene > 45) {
            state.health = clamp(state.health + RATES.healthRegen * deltaDays, 0, 100);
        }

        /* Raiva espontânea (precisa disciplina) */
        if (!state.angry && state.happiness < 35 && Math.random() < 0.08 * deltaDays) {
            state.angry = true;
            maybeAlertBeep();
        }

        state.careSum += (((hungerBefore + state.hunger) / 2 + (happyBefore + state.happiness) / 2 + state.hygiene) / 3) * deltaDays;
        state.careDays += deltaDays;

        checkEvolution();
        maybeAlertBeep();

        if (state.health <= 0) {
            killPet('Negligencia / Doenca');
            return;
        }
        state.lastUpdate = Date.now();
    }

    let lastAlertBeep = 0;
    function maybeAlertBeep() {
        if (!state || !state.isAlive) return;
        const needs = (
            state.hunger < 25 || state.thirst < 25 || state.hygiene < 30 ||
            state.isSick || state.poopCount >= 2 || state.angry ||
            Math.abs(state.temperature - IDEAL_TEMP) > 7
        );
        if (needs && Date.now() - lastAlertBeep > 12000) {
            lastAlertBeep = Date.now();
            SND.alert();
        }
    }

    function checkEvolution() {
        const ad = ageDays();
        if (state.stage === 'baby' && ad >= STAGE_DAYS.child && state.weight >= 12) {
            state.stage = 'child';
            SND.hatch();
            showToastMsg('Crianca!', 2200);
        } else if (state.stage === 'child' && ad >= STAGE_DAYS.teen && state.weight >= 22) {
            state.stage = 'teen';
            SND.hatch();
            showToastMsg('Jovem!', 2200);
        } else if (state.stage === 'teen' && ad >= STAGE_DAYS.adult && state.weight >= 35) {
            state.stage = 'adult';
            const avg = state.careDays > 0 ? (state.careSum / state.careDays) : 65;
            const score = avg - (state.sicknessEpisodes * 6) + (state.discipline / 5);
            state.adultForm = score >= 70 ? 'good' : score >= 40 ? 'neutral' : 'bad';
            SND.hatch();
            showToastMsg('Adulto!', 2500);
        }
    }

    function killPet(cause) {
        state.isAlive = false;
        uiMode = 'idle';
        selectedSide = null;
        selectedIndex = -1;
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
        const delta = Date.now() - state.lastUpdate;
        if (delta <= 0) return;
        applyDecay(delta);
        save();
    }

    /* ---------- Histórico ---------- */
    function getHistory() { return loadJSON(HISTORY_KEY, loadJSON('tamagotchi-history-v2', [])); }
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
            li.innerHTML = `<span><strong>${escapeHtml(e.name)}</strong></span><span>${e.days}d · ${escapeHtml(e.cause)}</span>`;
            historyList.appendChild(li);
        });
    }
    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
    renderHistory();

    /* ---------- Controles hardware ---------- */
    let uiMode = 'idle';
    let selectedSide = null; /* 'left' | 'right' */
    let selectedIndex = -1;
    let animSequence = null;
    let minigameData = null;
    let foodPick = null;
    let statsPage = 0;
    let toastTimer = null;

    function showToastMsg(text, ms) {
        if (!toastEl) return;
        toastEl.textContent = text;
        toastEl.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms || 1600);
    }

    function currentIconId() {
        if (!selectedSide || selectedIndex < 0) return null;
        const list = selectedSide === 'left' ? LEFT_ICONS : RIGHT_ICONS;
        return list[selectedIndex] || null;
    }

    function updateIconSelection() {
        ALL_ICONS.forEach((id) => {
            if (iconElements[id]) iconElements[id].classList.remove('selected', 'active');
        });
        const id = currentIconId();
        if (id && iconElements[id]) iconElements[id].classList.add('selected');
    }

    const ICON_TITLES = {
        drink: 'Agua',
        food: 'Comida',
        light: 'Luz',
        discipline: 'Disciplina',
        stats: 'Status',
        play: 'Jan-ken-po',
        study: 'Estudar',
        bath: 'Banho',
        ac: 'Ar-cond.',
        medicine: 'Remedio'
    };

    function handleHardwareBtn(btn) {
        if (!state || !state.isAlive) {
            openSetup(false);
            return;
        }
        if (uiMode === 'animating') return;

        if (uiMode === 'clock') {
            if (btn === 'CLOCK' || btn === 'ESC' || btn === 'ENTER') {
                uiMode = 'idle';
                SND.cancel();
            }
            return;
        }

        if (uiMode === 'stats_view') {
            if (btn === 'ESC') {
                uiMode = 'idle';
                SND.cancel();
                return;
            }
            if (btn === 'LEFT' || btn === 'RIGHT') {
                statsPage = (statsPage + (btn === 'RIGHT' ? 1 : -1) + 7) % 7;
                SND.nav();
            }
            if (btn === 'ENTER' || btn === 'CLOCK') {
                uiMode = 'idle';
                SND.cancel();
            }
            return;
        }

        if (uiMode === 'food_pick') {
            if (btn === 'ESC') {
                uiMode = 'idle';
                foodPick = null;
                SND.cancel();
                return;
            }
            if (btn === 'LEFT') {
                foodPick = (foodPick - 1 + FOODS.length) % FOODS.length;
                SND.nav();
                showToastMsg(FOODS[foodPick].label, 1000);
                return;
            }
            if (btn === 'RIGHT') {
                foodPick = (foodPick + 1) % FOODS.length;
                SND.nav();
                showToastMsg(FOODS[foodPick].label, 1000);
                return;
            }
            if (btn === 'ENTER') {
                confirmFood();
            }
            return;
        }

        if (uiMode === 'minigame') {
            if (btn === 'ESC') {
                uiMode = 'idle';
                minigameData = null;
                SND.cancel();
                showToastMsg('Fim', 1200);
                return;
            }
            if (btn === 'LEFT') {
                minigameData.choice = (minigameData.choice - 1 + 3) % 3;
                SND.nav();
                showToastMsg(RPS_LABEL[RPS[minigameData.choice]], 900);
                return;
            }
            if (btn === 'RIGHT') {
                minigameData.choice = (minigameData.choice + 1) % 3;
                SND.nav();
                showToastMsg(RPS_LABEL[RPS[minigameData.choice]], 900);
                return;
            }
            if (btn === 'ENTER') {
                playRpsTurn();
            }
            return;
        }

        if (btn === 'CLOCK') {
            uiMode = 'clock';
            selectedSide = null;
            selectedIndex = -1;
            updateIconSelection();
            SND.confirm();
            return;
        }

        if (btn === 'ESC') {
            if (uiMode === 'menu') {
                uiMode = 'idle';
                selectedSide = null;
                selectedIndex = -1;
                updateIconSelection();
            }
            SND.cancel();
            return;
        }

        /* Autêntico: ◄ só esquerda, ► só direita */
        if (btn === 'LEFT' || btn === 'RIGHT') {
            const side = btn === 'LEFT' ? 'left' : 'right';
            const list = side === 'left' ? LEFT_ICONS : RIGHT_ICONS;
            if (uiMode !== 'menu' || selectedSide !== side) {
                uiMode = 'menu';
                selectedSide = side;
                selectedIndex = 0;
            } else {
                selectedIndex = (selectedIndex + 1) % list.length;
            }
            SND.nav();
            updateIconSelection();
            showToastMsg(ICON_TITLES[currentIconId()] || '', 1000);
            return;
        }

        if (btn === 'ENTER') {
            if (uiMode !== 'menu' || !currentIconId()) {
                uiMode = 'menu';
                selectedSide = 'left';
                selectedIndex = 0;
                updateIconSelection();
                SND.nav();
                showToastMsg(ICON_TITLES.drink, 1000);
                return;
            }
            const actionId = currentIconId();
            if (iconElements[actionId]) iconElements[actionId].classList.add('active');
            executeAction(actionId);
        }
    }

    function executeAction(actionId) {
        setTimeout(() => {
            if (iconElements[actionId]) iconElements[actionId].classList.remove('active');
        }, 500);

        if (state.stage === 'egg' && actionId !== 'stats' && actionId !== 'light') {
            showToastMsg('Ainda e ovo!', 1400);
            SND.cancel();
            return;
        }

        if (actionId === 'drink') {
            if (state.thirst >= 98) {
                showToastMsg('Sem sede', 1200);
                SND.cancel();
                return;
            }
            uiMode = 'animating';
            SND.feed();
            showToastMsg('Glub glub', 1400);
            animSequence = {
                type: 'drink', step: 0, maxStep: 12,
                onDone: () => {
                    state.thirst = clamp(state.thirst + 35, 0, 100);
                    state.happiness = clamp(state.happiness + 4, 0, 100);
                    uiMode = 'idle';
                    save(); updateCompanionUI();
                }
            };
            return;
        }

        if (actionId === 'food') {
            if (state.hunger >= 98) {
                showToastMsg('Barriga cheia', 1200);
                SND.cancel();
                return;
            }
            uiMode = 'food_pick';
            foodPick = 0;
            SND.confirm();
            showToastMsg(FOODS[0].label + ' ◄►', 1600);
            return;
        }

        if (actionId === 'light') {
            state.lightsOn = !state.lightsOn;
            SND.confirm();
            showToastMsg(state.lightsOn ? 'Luz ON' : 'Luz OFF', 1600);
            save(); updateCompanionUI();
            return;
        }

        if (actionId === 'discipline') {
            if (!state.angry && state.discipline >= 90) {
                showToastMsg('Ja educado', 1200);
                SND.cancel();
                return;
            }
            uiMode = 'animating';
            SND.confirm();
            showToastMsg(state.angry ? 'Calma!' : 'Carinho', 1400);
            animSequence = {
                type: 'discipline', step: 0, maxStep: 10,
                onDone: () => {
                    state.angry = false;
                    state.discipline = clamp(state.discipline + 18, 0, 100);
                    state.happiness = clamp(state.happiness + 6, 0, 100);
                    uiMode = 'idle';
                    save(); updateCompanionUI();
                }
            };
            return;
        }

        if (actionId === 'stats') {
            uiMode = 'stats_view';
            statsPage = 0;
            SND.confirm();
            return;
        }

        if (actionId === 'play') {
            if (state.energy < 12) {
                showToastMsg('Cansado', 1200);
                SND.cancel();
                return;
            }
            uiMode = 'minigame';
            minigameData = { round: 1, maxRounds: 5, wins: 0, choice: 0, state: 'waiting', result: null };
            SND.confirm();
            showToastMsg('PEDRA ◄► Enter', 2000);
            return;
        }

        if (actionId === 'study') {
            uiMode = 'animating';
            SND.confirm();
            showToastMsg('Estudando...', 1400);
            animSequence = {
                type: 'study', step: 0, maxStep: 12,
                onDone: () => {
                    state.discipline = clamp(state.discipline + 20, 0, 100);
                    state.happiness = clamp(state.happiness - 3, 0, 100);
                    uiMode = 'idle';
                    save(); updateCompanionUI();
                }
            };
            return;
        }

        if (actionId === 'bath') {
            if (!state.dirty && state.poopCount <= 0 && state.hygiene >= 95) {
                showToastMsg('Limpo', 1200);
                SND.cancel();
                return;
            }
            uiMode = 'animating';
            SND.clean();
            showToastMsg('Banho!', 1400);
            animSequence = {
                type: 'bath', step: 0, maxStep: 14,
                onDone: () => {
                    state.poopCount = 0;
                    state.dirty = false;
                    state.hygiene = 100;
                    state.happiness = clamp(state.happiness + 6, 0, 100);
                    uiMode = 'idle';
                    save(); updateCompanionUI();
                }
            };
            return;
        }

        if (actionId === 'ac') {
            state.acOn = !state.acOn;
            if (state.acOn && state.temperature >= 28) state.angry = false;
            SND.confirm();
            showToastMsg(state.acOn ? 'AC ON' : 'AC OFF', 1600);
            save(); updateCompanionUI();
            return;
        }

        if (actionId === 'medicine') {
            if (!state.isSick) {
                showToastMsg('Saudavel', 1200);
                SND.cancel();
                return;
            }
            uiMode = 'animating';
            SND.confirm();
            showToastMsg('Injecao!', 1600);
            animSequence = {
                type: 'medicine', step: 0, maxStep: 12,
                onDone: () => {
                    /* Autêntico: metros esvaziam após remédio */
                    state.isSick = false;
                    state.health = clamp(state.health + 40, 0, 100);
                    state.hunger = 15;
                    state.thirst = 15;
                    state.happiness = 20;
                    state.discipline = Math.min(state.discipline, 25);
                    uiMode = 'idle';
                    save(); updateCompanionUI();
                }
            };
        }
    }

    function confirmFood() {
        const food = FOODS[foodPick];
        uiMode = 'animating';
        SND.feed();
        showToastMsg(food.label, 1400);
        animSequence = {
            type: 'food', step: 0, maxStep: 14, foodId: food.id,
            onDone: () => {
                state.hunger = clamp(state.hunger + food.hunger, 0, 100);
                state.happiness = clamp(state.happiness + food.happy, 0, 100);
                if (food.id === 'icecream') state.angry = false;
                if (state.foodBias) state.foodBias[food.id] = (state.foodBias[food.id] || 0) + 1;
                foodPick = null;
                uiMode = 'idle';
                save(); updateCompanionUI();
            }
        };
    }

    /* Jan-ken-po: objetivo é deixar o DINO ganhar 3/5 */
    function playRpsTurn() {
        if (!minigameData || minigameData.state !== 'waiting') return;
        minigameData.state = 'reveal';
        const player = RPS[minigameData.choice];
        const dino = RPS[Math.floor(Math.random() * 3)];
        minigameData.player = player;
        minigameData.dino = dino;

        let dinoWins = false;
        if (player === dino) {
            minigameData.result = 'tie';
            showToastMsg('Empate', 1000);
            SND.nav();
        } else if (
            (dino === 'rock' && player === 'scissors') ||
            (dino === 'scissors' && player === 'paper') ||
            (dino === 'paper' && player === 'rock')
        ) {
            dinoWins = true;
            minigameData.wins++;
            minigameData.result = 'dino';
            showToastMsg('Dino ganhou!', 1100);
            SND.confirm();
        } else {
            minigameData.result = 'you';
            showToastMsg('Voce ganhou', 1100);
            SND.cancel();
        }

        setTimeout(() => {
            if (uiMode !== 'minigame' || !minigameData) return;
            if (minigameData.result === 'tie') {
                minigameData.state = 'waiting';
                return;
            }
            minigameData.round++;
            if (minigameData.round > minigameData.maxRounds) {
                const ok = minigameData.wins >= 3;
                state.happiness = clamp(state.happiness + (ok ? 28 : 8), 0, 100);
                state.energy = clamp(state.energy - 10, 0, 100);
                if (ok) SND.hatch();
                showToastMsg(ok ? `Vitoria! ${minigameData.wins}/5` : `${minigameData.wins}/5`, 2200);
                uiMode = 'idle';
                minigameData = null;
                save(); updateCompanionUI();
            } else {
                minigameData.state = 'waiting';
                showToastMsg(`R${minigameData.round}/5`, 1000);
            }
        }, 1100);
    }

    document.querySelectorAll('[data-btn]').forEach((btnEl) => {
        btnEl.addEventListener('mousedown', () => btnEl.classList.add('pressed'));
        btnEl.addEventListener('mouseup', () => btnEl.classList.remove('pressed'));
        btnEl.addEventListener('mouseleave', () => btnEl.classList.remove('pressed'));
        btnEl.addEventListener('click', (e) => {
            e.preventDefault();
            handleHardwareBtn(btnEl.getAttribute('data-btn'));
        });
    });

    /* Clique direto nos ícones do LCD */
    ALL_ICONS.forEach((id) => {
        const el = iconElements[id];
        if (!el) return;
        el.addEventListener('click', () => {
            const side = LEFT_ICONS.includes(id) ? 'left' : 'right';
            const list = side === 'left' ? LEFT_ICONS : RIGHT_ICONS;
            uiMode = 'menu';
            selectedSide = side;
            selectedIndex = list.indexOf(id);
            updateIconSelection();
            SND.nav();
            showToastMsg(ICON_TITLES[id], 900);
        });
    });

    window.addEventListener('keydown', (e) => {
        if (!setupScreen || !setupScreen.classList.contains('hidden')) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        const key = e.key.toLowerCase();
        if (key === 'arrowleft' || key === 'a') { handleHardwareBtn('LEFT'); highlightBtn('LEFT'); }
        else if (key === 'arrowright' || key === 'd') { handleHardwareBtn('RIGHT'); highlightBtn('RIGHT'); }
        else if (key === 'enter' || key === ' ') { e.preventDefault(); handleHardwareBtn('ENTER'); highlightBtn('ENTER'); }
        else if (key === 'escape' || key === 'backspace' || key === 'e') { handleHardwareBtn('ESC'); highlightBtn('ESC'); }
        else if (key === 'c' || key === 'q') { handleHardwareBtn('CLOCK'); highlightBtn('CLOCK'); }
    });

    function highlightBtn(code) {
        const el = document.querySelector(`[data-btn="${code}"]`);
        if (el) {
            el.classList.add('pressed');
            setTimeout(() => el.classList.remove('pressed'), 150);
        }
    }

    /* ---------- Companion UI ---------- */
    function barClass(val) { return val <= 20 ? 'critical' : val <= 45 ? 'low' : ''; }
    function setBar(el, val) {
        if (!el) return;
        el.style.width = clamp(val, 0, 100) + '%';
        el.className = 'stat-fill ' + barClass(val);
    }

    function getStageTitle(stage, form) {
        if (stage === 'egg') return 'Ovo';
        if (stage === 'baby') return 'Bebe';
        if (stage === 'child') return 'Crianca';
        if (stage === 'teen') return 'Jovem';
        if (stage === 'adult') {
            return form === 'good' ? 'Adulto+' : form === 'bad' ? 'Selvagem' : 'Adulto';
        }
        return stage;
    }

    function updateCompanionUI() {
        if (!state) return;
        if (petNameLabel) petNameLabel.textContent = state.name;
        if (stageLabel) stageLabel.textContent = getStageTitle(state.stage, state.adultForm);
        if (ageLabel) ageLabel.textContent = 'Dia ' + Math.floor(ageDays());
        if (tempLabel) {
            const t = Math.round(state.temperature);
            tempLabel.textContent = t + '°C' + (state.acOn ? ' AC' : '');
        }
        setBar(barHunger, state.hunger);
        setBar(barThirst, state.thirst);
        setBar(barHappiness, state.happiness);
        setBar(barHygiene, state.hygiene);
        setBar(barHealth, state.health);
        setBar(barDiscipline, state.discipline);

        if (stateLabel) {
            if (!state.isAlive) stateLabel.textContent = 'Faleceu';
            else if (state.isSick) stateLabel.textContent = 'Doente';
            else if (state.angry) stateLabel.textContent = 'Bravo';
            else if (state.dirty) stateLabel.textContent = 'Sujo';
            else if (!state.lightsOn) stateLabel.textContent = 'Dormindo';
            else stateLabel.textContent = 'Ativo';
        }
    }

    /* ---------- Render LCD ---------- */
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
            if (Math.sin(Date.now() / 200 + i) > 0) rect(x + 2, FLOOR_Y - 6, 1, 1);
        }
    }

    function drawMoonStars(phase) {
        ctx.fillStyle = ink;
        rect(54, 6, 4, 6);
        clearRectG(53, 7, 3, 4);
        if (Math.sin(phase) > -0.5) rect(16, 8, 1, 1);
        if (Math.cos(phase * 1.5) > 0) rect(32, 5, 1, 1);
        if (Math.sin(phase * 2) > 0) rect(45, 11, 1, 1);
    }

    function drawDinoSprite(cx, cy, stage, mood, phase, anim) {
        ctx.fillStyle = ink;
        const invert = state.dirty && Math.sin(phase * 6) > 0;

        if (stage === 'egg') {
            const wiggle = Math.sin(phase * 4) > 0.7 ? (Math.sin(phase * 10) > 0 ? 1 : -1) : 0;
            const x = cx + wiggle;
            /* Ovo oval manchado (estilo Rakuraku) */
            rect(x - 5, cy - 11, 10, 12);
            clearRectG(x - 5, cy - 11, 1, 1);
            clearRectG(x + 4, cy - 11, 1, 1);
            clearRectG(x - 5, cy, 1, 1);
            clearRectG(x + 4, cy, 1, 1);
            /* Manchas */
            clearRectG(x - 2, cy - 8, 2, 2);
            clearRectG(x + 1, cy - 5, 2, 2);
            clearRectG(x - 3, cy - 3, 2, 1);
            clearRectG(x + 2, cy - 2, 1, 2);
            /* Rachadura ao chocar */
            if (Math.sin(phase * 3) > 0.85) {
                clearRectG(x - 1, cy - 10, 1, 3);
                clearRectG(x, cy - 8, 1, 2);
            }
            return;
        }

        if (!state.isAlive || mood === 'angel') {
            rect(cx - 5, cy - 12, 10, 8);
            const flap = Math.sin(phase * 3) > 0 ? 3 : 1;
            rect(cx - 11, cy - 11 - flap, 5, 3);
            rect(cx + 6, cy - 11 - flap, 5, 3);
            rect(cx - 4, cy - 17, 8, 1);
            clearRectG(cx - 3, cy - 9, 2, 1);
            clearRectG(cx + 1, cy - 9, 2, 1);
            return;
        }

        let w = 12, h = 12, tail = 4, spikes = 3, arm = 2;
        if (stage === 'baby') { w = 10; h = 10; tail = 2; spikes = 2; arm = 0; }
        else if (stage === 'child') { w = 14; h = 13; tail = 5; spikes = 4; arm = 2; }
        else if (stage === 'teen') { w = 16; h = 15; tail = 6; spikes = 5; arm = 3; }
        else if (stage === 'adult') { w = 20; h = 18; tail = 8; spikes = 6; arm = 4; }

        const shiver = (state.temperature <= 18 && mood !== 'sleep') ? (Math.sin(phase * 20) > 0 ? 1 : -1) : 0;
        const bounce = (mood === 'sleep') ? 0 : Math.abs(Math.sin(phase * 2)) * 1.5;
        const topY = cy - h - bounce;
        const leftX = cx - Math.floor(w / 2) + shiver;

        const step = Math.sin(phase * 3) > 0 ? 1 : 0;
        rect(cx - w * 0.35 - 1 + shiver, FLOOR_Y - 3 + (mood === 'sleep' ? 0 : step), 3, 3);
        rect(cx + w * 0.35 - 1 + shiver, FLOOR_Y - 3 + (mood === 'sleep' ? 0 : 1 - step), 3, 3);

        for (let i = 0; i < tail; i++) {
            rect(leftX - i * 1.2, cy - Math.floor(h * 0.4) - Math.sin(phase + i * 0.5) * 2, 2, 2);
        }

        rect(leftX, topY, w, h);
        if (invert) {
            clearRectG(leftX + 2, topY + 2, w - 4, h - 4);
            ctx.fillStyle = ink;
        } else {
            clearRectG(leftX, topY, 2, 2);
            clearRectG(leftX + w - 2, topY, 2, 2);
            clearRectG(leftX, topY + h - 2, 2, 2);
            clearRectG(leftX + w - 2, topY + h - 2, 2, 2);
        }

        for (let s = 0; s < spikes; s++) {
            const sx = leftX + 2 + (s * ((w - 4) / Math.max(spikes, 1)));
            rect(sx, topY - 2, 2, 2);
        }

        if (arm > 0) {
            const armY = topY + Math.floor(h * 0.45) + (Math.sin(phase * 4) > 0 ? 1 : 0);
            rect(leftX + w - 2, armY, arm, 2);
            rect(leftX + w - 2 + arm, armY - 1, 1, 1);
        }

        const blink = Math.sin(phase * 0.4) > 0.94;
        const eyeX = leftX + w - Math.floor(w * 0.35);
        const eyeY = topY + Math.floor(h * 0.28);
        if (mood === 'sleep') {
            rect(eyeX - 3, eyeY + 1, 4, 1);
        } else if (mood === 'sick' || mood === 'angry') {
            clearRectG(eyeX - 2, eyeY, 3, 3);
            rect(eyeX - 2, eyeY, 1, 1); rect(eyeX, eyeY + 2, 1, 1);
            rect(eyeX, eyeY, 1, 1); rect(eyeX - 2, eyeY + 2, 1, 1);
        } else if (!blink) {
            clearRectG(eyeX - 2, eyeY, 3, 3);
            rect(eyeX - 1, eyeY + 1, 1, 1);
        }

        const mouthY = topY + Math.floor(h * 0.65);
        const mouthX = leftX + w - 4;
        if (anim && (anim.type === 'food' || anim.type === 'drink') && Math.sin(phase * 8) > 0) {
            clearRectG(mouthX, mouthY - 1, 4, 4);
        } else if (mood === 'angry') {
            clearRectG(mouthX, mouthY + 1, 4, 1);
            rect(mouthX + 1, mouthY, 2, 1);
        } else if (mood === 'happy' || mood === 'good') {
            clearRectG(mouthX, mouthY, 4, 1);
            clearRectG(mouthX - 1, mouthY - 1, 1, 1);
            clearRectG(mouthX + 3, mouthY - 1, 1, 1);
        } else if (mood === 'bad' || mood === 'sick') {
            clearRectG(mouthX, mouthY + 1, 4, 1);
        } else if (mood !== 'sleep') {
            clearRectG(mouthX, mouthY, 3, 1);
        }

        if (state.isSick && Math.sin(phase * 4) > 0) {
            rect(leftX + w + 1, topY + 2, 2, 3);
        }
        if (mood === 'sleep') {
            const zy = Math.floor((Date.now() / 200) % 15);
            rect(leftX + w + 2 + (zy % 4), topY - zy, 2, 2);
            rect(leftX + w + 6 + (zy % 4), topY - 6 - zy, 3, 2);
        }
    }

    function drawFoodItem(step, foodId) {
        ctx.fillStyle = ink;
        const fx = 54, fy = FLOOR_Y - 6;
        if (step >= 10) return;
        if (foodId === 'apple' || foodId === 'carrot') {
            rect(fx + 1, fy, 4, 5);
            rect(fx + 2, fy - 2, 1, 2);
        } else if (foodId === 'icecream') {
            rect(fx + 2, fy + 3, 3, 4);
            rect(fx, fy, 7, 4);
        } else {
            rect(fx, fy, 6, 5);
            rect(fx + 6, fy + 2, 3, 2);
            rect(fx + 8, fy + 1, 2, 1);
            rect(fx + 8, fy + 4, 2, 1);
        }
        if (step > 4) clearRectG(fx, fy, 2, 5);
        if (step > 7) clearRectG(fx + 2, fy, 2, 5);
    }

    function drawDrinkItem(step) {
        ctx.fillStyle = ink;
        const fx = 54, fy = FLOOR_Y - 8;
        rect(fx, fy, 5, 8);
        clearRectG(fx + 1, fy + 1, 3, 5);
        if (step < 8) rect(fx + 1, fy + 3 + Math.floor(step / 3), 3, 3);
    }

    function drawShowerAnim(step) {
        ctx.fillStyle = ink;
        rect(25, 4, 20, 3);
        const dropY = 8 + (step * 2.5);
        for (let i = 0; i < 5; i++) {
            rect(27 + i * 4, (dropY + (i % 2) * 4) % (FLOOR_Y - 4), 1, 3);
        }
    }

    function drawHand(x, y, kind) {
        ctx.fillStyle = ink;
        if (kind === 'rock') {
            rect(x, y, 8, 7);
            clearRectG(x, y, 1, 1);
            clearRectG(x + 7, y, 1, 1);
        } else if (kind === 'scissors') {
            rect(x + 2, y + 3, 5, 5);
            rect(x, y, 2, 6);
            rect(x + 4, y, 2, 6);
        } else {
            rect(x, y + 2, 8, 6);
            rect(x, y, 1, 3);
            rect(x + 2, y, 1, 3);
            rect(x + 4, y, 1, 3);
            rect(x + 6, y, 1, 3);
        }
    }

    function drawMinigameScreen(phase) {
        ctx.fillStyle = ink;
        if (!minigameData) return;

        /* Placar: 5 slots, preenchidos = vitórias do dino */
        for (let i = 0; i < 5; i++) {
            rect(18 + i * 7, 4, 5, 5);
            if (i >= minigameData.wins) clearRectG(19 + i * 7, 5, 3, 3);
        }

        if (minigameData.state === 'waiting') {
            drawHand(10, 22, RPS[minigameData.choice]);
            drawDinoSprite(48, FLOOR_Y - 3, state.stage, 'happy', phase, null);
            rect(33, 18, 3, 1); rect(35, 19, 1, 2); rect(34, 21, 1, 1); rect(34, 23, 1, 1);
        } else {
            drawHand(8, 20, minigameData.player);
            drawHand(48, 20, minigameData.dino);
            /* VS */
            rect(32, 22, 6, 2);
            rect(34, 20, 2, 6);
        }
    }

    function drawFoodPickScreen(phase) {
        ctx.fillStyle = ink;
        const food = FOODS[foodPick];
        drawDinoSprite(22, FLOOR_Y - 3, state.stage, 'happy', phase, null);
        drawFoodItem(2, food.id);
        /* setas */
        rect(4, 22, 4, 2); rect(4, 20, 2, 6);
        rect(62, 22, 4, 2); rect(64, 20, 2, 6);
        ctx.font = '700 9px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(food.label.toUpperCase().slice(0, 8), canvas.width / 2, 28);
        ctx.textAlign = 'left';
    }

    function drawClockView() {
        ctx.fillStyle = ink;
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        rect(8, 10, 54, 28);
        clearRectG(9, 11, 52, 26);
        rect(10, 12, 50, 24);
        clearRectG(12, 14, 46, 20);
        ctx.font = '700 22px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const blink = now.getSeconds() % 2 === 0 ? ':' : ' ';
        ctx.fillText(`${hh}${blink}${mm}`, canvas.width / 2, canvas.height / 2);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
    }

    function drawStatsView() {
        ctx.fillStyle = ink;
        rect(4, 4, 62, 42);
        clearRectG(5, 5, 60, 40);
        ctx.font = '700 10px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        const pages = [
            () => {
                const faces = state.happiness > 70 ? ':)' : state.happiness > 40 ? ':|' : ':(';
                ctx.fillText('HUMOR', canvas.width / 2, 48);
                ctx.font = '700 22px "Press Start 2P", monospace';
                ctx.fillText(faces, canvas.width / 2, 100);
            },
            () => {
                ctx.fillText('ESTUDO', canvas.width / 2, 48);
                ctx.font = '700 28px "Press Start 2P", monospace';
                ctx.fillText(educationGrade(state.discipline), canvas.width / 2, 105);
            },
            () => {
                ctx.fillText('PESO / IDADE', canvas.width / 2, 48);
                ctx.font = '700 14px "Press Start 2P", monospace';
                ctx.fillText(Math.round(state.weight) + 'kg', canvas.width / 2, 90);
                ctx.fillText('Dia ' + Math.floor(ageDays()), canvas.width / 2, 130);
            },
            () => {
                ctx.fillText('FOME', canvas.width / 2, 48);
                drawMeterBars(state.hunger, 5);
            },
            () => {
                ctx.fillText('SEDE', canvas.width / 2, 48);
                drawMeterBars(state.thirst, 5);
            },
            () => {
                ctx.fillText('TEMP', canvas.width / 2, 48);
                ctx.font = '700 22px "Press Start 2P", monospace';
                ctx.fillText(Math.round(state.temperature) + 'C', canvas.width / 2, 105);
            },
            () => {
                ctx.fillText(state.name.toUpperCase().slice(0, 10), canvas.width / 2, 48);
                ctx.font = '700 11px "Press Start 2P", monospace';
                ctx.fillText(state.isSick ? 'DOENTE' : 'OK', canvas.width / 2, 95);
                ctx.fillText(state.acOn ? 'AC ON' : 'AC OFF', canvas.width / 2, 130);
            }
        ];
        pages[statsPage % pages.length]();
        ctx.font = '700 8px "Press Start 2P", monospace';
        ctx.fillText((statsPage + 1) + '/7', canvas.width / 2, 175);
        ctx.textAlign = 'left';
    }

    function drawMeterBars(val, maxSlots) {
        const filled = Math.ceil((val / 100) * maxSlots);
        for (let i = 0; i < maxSlots; i++) {
            rect(12 + i * 10, 22, 7, 10);
            if (i >= filled) clearRectG(13 + i * 10, 23, 5, 8);
        }
    }

    let lastRender = 0;
    function render(timestamp) {
        requestAnimationFrame(render);
        if (timestamp - lastRender < RENDER_MS) return;
        lastRender = timestamp;
        if (!ctx || !canvas) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (!state) return;

        if (uiMode === 'clock') { drawClockView(); return; }
        if (uiMode === 'stats_view') { drawStatsView(); return; }
        if (uiMode === 'food_pick') { drawFloor(); drawFoodPickScreen(timestamp / 300); return; }
        if (uiMode === 'minigame') { drawFloor(); drawMinigameScreen(timestamp / 300); return; }

        drawFloor();
        if (!state.lightsOn || (!state.isAlive && isNightNow())) {
            drawMoonStars(timestamp / 400);
        }
        if (state.poopCount > 0 && (!animSequence || animSequence.type !== 'bath')) {
            drawPoops(state.poopCount);
        }

        let mood = 'happy';
        if (!state.isAlive) mood = 'angel';
        else if (state.isSick) mood = 'sick';
        else if (state.angry) mood = 'angry';
        else if (!state.lightsOn) mood = 'sleep';
        else if (state.hunger < 30 || state.thirst < 30 || state.happiness < 30) mood = 'bad';

        let dinoX = 35;
        if (state.isAlive && state.lightsOn && !state.isSick && !animSequence && state.stage !== 'egg') {
            dinoX = 35 + Math.floor(Math.sin(timestamp / 700) * 14);
        } else if (animSequence && (animSequence.type === 'food' || animSequence.type === 'drink')) {
            dinoX = Math.min(46, 30 + animSequence.step * 2);
        }

        drawDinoSprite(dinoX, FLOOR_Y - 3, state.stage, mood, timestamp / 300, animSequence);

        if (animSequence) {
            animSequence.step++;
            if (animSequence.type === 'food') drawFoodItem(animSequence.step, animSequence.foodId);
            if (animSequence.type === 'drink') drawDrinkItem(animSequence.step);
            if (animSequence.type === 'bath') drawShowerAnim(animSequence.step);
            if (animSequence.step >= animSequence.maxStep) {
                const done = animSequence.onDone;
                animSequence = null;
                if (done) done();
            }
        }
    }

    setInterval(() => {
        if (!state || !state.isAlive) return;
        applyDecay(DECAY_MS);
        updateCompanionUI();
        save();
    }, DECAY_MS);

    catchUp();
    updateCompanionUI();
    requestAnimationFrame(render);
})();
