(function () {
    'use strict';

    /* ============================================================
       RAKURAKU DINOKUN / DINKIE DINO — lógica fiel 1997
       ============================================================ */
    const STORAGE_KEY = 'tamagotchi-dinkie-v4';
    const OLD_KEYS = ['tamagotchi-dinkie-v3', 'tamagotchi-dinkie-v2', 'ovinho-save-v1'];
    const THEME_KEY = 'tamagotchi-theme-v3';
    const HISTORY_KEY = 'tamagotchi-history-v3';

    const DAY_MS = 10 * 60 * 1000;
    const STAGE_DAYS = { child: 1, teen: 2.5, adult: 4.5 };
    const RENDER_MS = 400;
    const DECAY_MS = 1000;
    const IDEAL_TEMP = 25;
    const MUTE_HOLD_MS = 3000;
    const EDU_GRADES = ['E+', 'D+', 'C+', 'B+', 'A+'];
    const EVOL_WEIGHT = { baby: 12, child: 22, teen: 35 };

    const RATES = {
        hunger: 90,
        thirst: 75,
        happiness: 65,
        sickBase: 0.04,
        sickBad: 0.55,
        sickTimer: 0.35,
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
    const barDiscipline = document.getElementById('barDiscipline');
    const barWeight = document.getElementById('barWeight');
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

    /* LCD 192×128 → grade 48×32 (pixels grandes, como no original) */
    const GRID_W = 48;
    const PIX = canvas ? canvas.width / GRID_W : 4;
    const FLOOR_Y = 28;

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
        if (s.madAngry == null) s.madAngry = s.angry && s.happiness < 40;
        if (s.heatAngry == null) s.heatAngry = s.temperature >= 30;
        if (s.freezing == null) s.freezing = s.temperature < 20;
        if (s.eduLevel == null) {
            const d = s.discipline != null ? s.discipline : 0;
            s.eduLevel = clamp(Math.floor(d / 25), 0, 4);
        }
        if (s.sickTimer == null) s.sickTimer = 0;
        if (s.lastScheduleHour == null) s.lastScheduleHour = new Date().getHours();
        if (s.caredAt9am == null) s.caredAt9am = false;
        if (s.inGameMode == null) s.inGameMode = s.stage !== 'egg';
        delete s.poopCount;
        delete s.hygiene;
        delete s.health;
        delete s.energy;
        delete s.discipline;
        s.v = 4;
        return s;
    }

    function freshState(name) {
        const now = Date.now();
        const h = new Date().getHours();
        return {
            v: 4,
            name: name || 'Dino',
            birthTime: now,
            hatchTime: null,
            stage: 'egg',
            adultForm: null,
            hunger: 85,
            thirst: 85,
            happiness: 85,
            eduLevel: 0,
            weight: 5,
            temperature: IDEAL_TEMP,
            acOn: false,
            isSick: false,
            sickTimer: 0,
            dirty: false,
            angry: false,
            madAngry: false,
            heatAngry: false,
            freezing: false,
            lightsOn: true,
            isAlive: true,
            inGameMode: false,
            lastUpdate: now,
            lastScheduleHour: h,
            caredAt9am: false,
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
            if (state.stage === 'egg') {
                const now = new Date();
                clockSetHour = now.getHours();
                clockSetMin = now.getMinutes();
                clockSetField = 'hour';
                uiMode = 'clock_set';
            }
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

    function educationGrade(level) {
        return EDU_GRADES[clamp(level, 0, EDU_GRADES.length - 1)];
    }

    function hungerPlatesEmpty() {
        if (!state) return 0;
        if (state.hunger >= 66) return 0;
        if (state.hunger >= 33) return 1;
        return 2;
    }

    function thirstGlassEmpty() {
        if (!state) return 0;
        return state.thirst < 50 ? 1 : 0;
    }

    function syncAngryFlags() {
        if (!state) return;
        state.heatAngry = state.temperature >= 30;
        state.freezing = state.temperature < 20;
        state.angry = state.madAngry || state.heatAngry;
    }

    function applyScheduleHour(hour) {
        if (!state || !state.isAlive || state.stage === 'egg' || !state.inGameMode) return;
        if (hour === 9) {
            if (state.hunger >= 50 && state.thirst >= 50) {
                state.weight = clamp(state.weight + 1, 1, 99);
                state.caredAt9am = true;
            } else {
                state.caredAt9am = false;
            }
            checkEvolution(true);
        }
        if (hour === 10 || hour === 14 || hour === 18) {
            state.hunger = clamp(state.hunger - 34, 0, 100);
        }
        if (hour === 11 || hour === 15 || hour === 19) {
            state.thirst = clamp(state.thirst - 45, 0, 100);
        }
        if (state.hunger < 25 || state.thirst < 25) maybeAlertBeep();
    }

    function applyDecay(deltaMs) {
        if (!state || !state.isAlive || deltaMs <= 0) return;

        const nowHour = new Date().getHours();
        if (nowHour !== state.lastScheduleHour) {
            applyScheduleHour(nowHour);
            state.lastScheduleHour = nowHour;
        }

        if (state.stage === 'egg' || !state.inGameMode) {
            state.lastUpdate = Date.now();
            return;
        }

        const deltaDays = deltaMs / DAY_MS;
        const hungerBefore = state.hunger;
        const happyBefore = state.happiness;

        state.hunger = clamp(state.hunger - RATES.hunger * deltaDays, 0, 100);
        state.thirst = clamp(state.thirst - RATES.thirst * deltaDays, 0, 100);

        const tempDir = state.acOn ? -1 : 1;
        state.temperature = clamp(
            state.temperature + tempDir * RATES.tempDrift * deltaDays,
            10, 40
        );
        syncAngryFlags();

        let happyDecay = RATES.happiness * deltaDays;
        if (state.hunger < 25) happyDecay *= 1.4;
        if (state.thirst < 25) happyDecay *= 1.3;
        if (state.dirty) happyDecay *= 1.4;
        if (state.isSick) happyDecay *= 1.5;
        if (state.angry) happyDecay *= 1.35;
        if (!state.lightsOn && isNightNow()) happyDecay *= 0.25;
        else if (!state.lightsOn) happyDecay *= 1.35;
        if (Math.abs(state.temperature - IDEAL_TEMP) > 6) happyDecay *= 1.3;
        state.happiness = clamp(state.happiness - happyDecay, 0, 100);

        if (!state.dirty && state.happiness < 30 && Math.random() < 0.06 * deltaDays) {
            state.dirty = true;
        }

        if (!state.madAngry && state.happiness < 30 && Math.random() < 0.05 * deltaDays) {
            state.madAngry = true;
            syncAngryFlags();
            maybeAlertBeep();
        }

        if (!state.isSick) {
            const badness = (
                state.hunger < 25 || state.thirst < 25 ||
                Math.abs(state.temperature - IDEAL_TEMP) > 8 ||
                (state.lightsOn && isNightNow())
            );
            const lambda = (badness ? RATES.sickBad : RATES.sickBase) * deltaDays;
            if (Math.random() < (1 - Math.exp(-lambda))) {
                state.isSick = true;
                state.sickTimer = 1;
                state.sicknessEpisodes += 1;
                SND.sick();
                maybeAlertBeep();
            }
        } else {
            state.sickTimer += RATES.sickTimer * deltaDays;
            if (state.sickTimer >= 1) {
                killPet('Doenca');
                return;
            }
        }

        state.careSum += (((hungerBefore + state.hunger) / 2 + (happyBefore + state.happiness) / 2) / 2) * deltaDays;
        state.careDays += deltaDays;

        checkEvolution(false);
        maybeAlertBeep();
        state.lastUpdate = Date.now();
    }

    let lastAlertBeep = 0;
    function maybeAlertBeep() {
        if (!state || !state.isAlive) return;
        const needs = (
            state.hunger < 25 || state.thirst < 25 ||
            state.isSick || state.dirty || state.madAngry || state.heatAngry ||
            state.freezing || Math.abs(state.temperature - IDEAL_TEMP) > 7
        );
        if (needs && Date.now() - lastAlertBeep > 12000) {
            lastAlertBeep = Date.now();
            SND.alert();
        }
    }

    function checkEvolution(atNineAm) {
        const ad = ageDays();
        if (atNineAm && state.stage === 'baby' && state.weight >= EVOL_WEIGHT.baby) {
            state.stage = 'child';
            SND.hatch();
        } else if (atNineAm && state.stage === 'child' && ad >= STAGE_DAYS.child && state.weight >= EVOL_WEIGHT.child) {
            state.stage = 'teen';
            SND.hatch();
        } else if (atNineAm && state.stage === 'teen' && ad >= STAGE_DAYS.teen && state.weight >= EVOL_WEIGHT.teen) {
            state.stage = 'adult';
            const avg = state.careDays > 0 ? (state.careSum / state.careDays) : 65;
            const score = avg - (state.sicknessEpisodes * 6) + (state.eduLevel * 8);
            state.adultForm = score >= 70 ? 'good' : score >= 40 ? 'neutral' : 'bad';
            SND.hatch();
        } else if (!atNineAm) {
            if (state.stage === 'baby' && ad >= STAGE_DAYS.child && state.weight >= EVOL_WEIGHT.baby) {
                /* evolução principal às 9h */
            }
        }
    }

    function startHatching() {
        if (!state || state.stage !== 'egg') return;
        uiMode = 'animating';
        SND.hatch();
        animSequence = {
            type: 'hatch', step: 0, maxStep: 20,
            onDone: () => {
                state.stage = 'baby';
                state.hatchTime = Date.now();
                state.inGameMode = true;
                uiMode = 'idle';
                save();
                updateCompanionUI();
            }
        };
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
    let selectedSide = null;
    let selectedIndex = -1;
    let animSequence = null;
    let minigameData = null;
    let foodPick = null;
    let statsPage = 0;
    let toastTimer = null;
    let clockSetField = 'hour';
    let clockSetHour = 12;
    let clockSetMin = 0;
    let escHeld = false;
    let enterHeld = false;
    let leftHeld = false;
    let rightHeld = false;
    let bothHeldSince = 0;

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
        discipline: 'Carinho',
        stats: 'Status',
        play: 'Jan-ken-po',
        study: 'Estudar',
        bath: 'Banho',
        ac: 'Ar-cond.',
        medicine: 'Remedio'
    };

    /* Termina animação em curso (aplica efeito) para não engolir o próximo clique */
    function finishAnimationNow() {
        if (!animSequence) {
            if (uiMode === 'animating') uiMode = 'idle';
            return;
        }
        const done = animSequence.onDone;
        animSequence = null;
        if (done) done();
        else if (uiMode === 'animating') uiMode = 'idle';
    }

    function handleHardwareBtn(btn) {
        if (!state || !state.isAlive) {
            openSetup(false);
            return;
        }
        if (uiMode === 'animating') finishAnimationNow();

        if (uiMode === 'clock_set') {
            if (btn === 'ESC') {
                uiMode = state.inGameMode ? 'idle' : 'clock_set';
                SND.cancel();
                return;
            }
            if (btn === 'LEFT') {
                if (clockSetField === 'hour') clockSetHour = (clockSetHour + 1) % 24;
                else clockSetMin = (clockSetMin + 1) % 60;
                SND.nav();
                return;
            }
            if (btn === 'RIGHT') {
                clockSetField = clockSetField === 'hour' ? 'minute' : 'hour';
                SND.nav();
                return;
            }
            if (btn === 'ENTER') {
                if (clockSetField === 'hour') {
                    clockSetField = 'minute';
                    SND.nav();
                } else {
                    state.lastScheduleHour = clockSetHour;
                    if (!state.inGameMode && state.stage === 'egg') {
                        startHatching();
                    } else {
                        uiMode = 'idle';
                        SND.confirm();
                    }
                }
            }
            return;
        }

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
                statsPage = (statsPage + (btn === 'RIGHT' ? 1 : -1) + 6) % 6;
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
            if (state.stage === 'egg' && !state.inGameMode) {
                startHatching();
                SND.confirm();
                return;
            }
            uiMode = 'clock';
            selectedSide = null;
            selectedIndex = -1;
            updateIconSelection();
            SND.confirm();
            return;
        }

        if (btn === 'ESC') {
            if (escHeld && enterHeld) {
                const now = new Date();
                clockSetHour = now.getHours();
                clockSetMin = now.getMinutes();
                clockSetField = 'hour';
                uiMode = 'clock_set';
                SND.nav();
                return;
            }
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
            /* Se já há ícone selecionado (mesmo após animação → idle), executa na hora */
            if (!currentIconId()) {
                uiMode = 'menu';
                selectedSide = 'left';
                selectedIndex = 0;
                updateIconSelection();
            }
            const actionId = currentIconId();
            uiMode = 'menu';
            if (iconElements[actionId]) iconElements[actionId].classList.add('active');
            executeAction(actionId);
        }
    }

    function executeAction(actionId) {
        if (uiMode === 'animating' || animSequence) finishAnimationNow();
        if (uiMode === 'food_pick') foodPick = null;
        if (uiMode === 'minigame') minigameData = null;

        setTimeout(() => {
            if (iconElements[actionId]) iconElements[actionId].classList.remove('active');
        }, 500);

        if (state.stage === 'egg' && actionId !== 'stats' && actionId !== 'light') {
            showToastMsg('Ainda é ovo! Chocando... 🥚', 1600);
            SND.cancel();
            return;
        }

        if (actionId === 'drink') {
            uiMode = 'animating';
            SND.feed();
            showToastMsg('Beber Água 💧', 1400);
            animSequence = {
                type: 'drink', step: 0, maxStep: 14,
                onDone: () => {
                    state.thirst = clamp(state.thirst + 40, 0, 100);
                    state.happiness = clamp(state.happiness + 6, 0, 100);
                    showToastMsg('Que refrescante! 💦', 1400);
                    uiMode = 'idle';
                    save(); updateCompanionUI();
                }
            };
            return;
        }

        if (actionId === 'food') {
            uiMode = 'food_pick';
            foodPick = 0;
            SND.confirm();
            showToastMsg(FOODS[0].label + ' — ◄► e Enter', 2000);
            return;
        }

        if (actionId === 'light') {
            state.lightsOn = !state.lightsOn;
            SND.confirm();
            showToastMsg(state.lightsOn ? 'Luz: ACESA 💡' : 'Luz: APAGADA 🌙', 1600);
            save(); updateCompanionUI();
            return;
        }

        if (actionId === 'discipline') {
            uiMode = 'animating';
            SND.confirm();
            showToastMsg('Atenção! Disciplinando... ⚠️', 1400);
            animSequence = {
                type: 'discipline', step: 0, maxStep: 12,
                onDone: () => {
                    if (state.madAngry) state.madAngry = false;
                    if (state.heatAngry && state.acOn) state.heatAngry = false;
                    state.eduLevel = clamp(state.eduLevel + 1, 0, 4);
                    syncAngryFlags();
                    state.happiness = clamp(state.happiness + 5, 0, 100);
                    showToastMsg('Dino mais educado! 🎓', 1400);
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
            showToastMsg('Status do Dino (Enter p/ mudar) 📊', 2000);
            return;
        }

        if (actionId === 'play') {
            uiMode = 'minigame';
            minigameData = { round: 1, maxRounds: 5, wins: 0, choice: 0, state: 'waiting', result: null };
            SND.confirm();
            showToastMsg('Jokenpô! ◄► escolhe e Enter 🕹️', 2500);
            return;
        }

        if (actionId === 'study') {
            uiMode = 'animating';
            SND.confirm();
            showToastMsg('Estudando para escola... 📚', 1400);
            animSequence = {
                type: 'study', step: 0, maxStep: 14,
                onDone: () => {
                    state.eduLevel = clamp(state.eduLevel + 1, 0, 4);
                    state.happiness = clamp(state.happiness + 5, 0, 100);
                    showToastMsg('Inteligência +1! 📖✨', 1400);
                    uiMode = 'idle';
                    save(); updateCompanionUI();
                }
            };
            return;
        }

        if (actionId === 'bath') {
            uiMode = 'animating';
            SND.clean();
            showToastMsg('Tomando Banho de Chuveiro 🚿', 1600);
            animSequence = {
                type: 'bath', step: 0, maxStep: 16,
                onDone: () => {
                    state.dirty = false;
                    state.happiness = clamp(state.happiness + 10, 0, 100);
                    showToastMsg('Limpinho e cheiroso! 🧼✨', 1500);
                    uiMode = 'idle';
                    save(); updateCompanionUI();
                }
            };
            return;
        }

        if (actionId === 'ac') {
            state.acOn = !state.acOn;
            if (state.acOn && state.temperature >= 28) {
                state.heatAngry = false;
            }
            if (!state.acOn && state.temperature < 22) {
                state.freezing = false;
            }
            syncAngryFlags();
            SND.confirm();
            uiMode = 'animating';
            showToastMsg(state.acOn ? 'Ligando Ar-Condicionado... ❄️' : 'Desligando Ar... ♨️', 1400);
            animSequence = {
                type: 'ac', step: 0, maxStep: 12, acState: state.acOn,
                onDone: () => {
                    showToastMsg(state.acOn ? 'Ar-Condicionado: LIGADO ❄️' : 'Ar-Condicionado: DESLIGADO ♨️', 1600);
                    uiMode = 'idle';
                    save(); updateCompanionUI();
                }
            };
            return;
        }

        if (actionId === 'medicine') {
            uiMode = 'animating';
            SND.confirm();
            showToastMsg('Tomando Remédio e Vitaminas 💊', 1600);
            animSequence = {
                type: 'medicine', step: 0, maxStep: 14,
                onDone: () => {
                    state.isSick = false;
                    state.sickTimer = 0;
                    state.hunger = clamp(state.hunger + 10, 0, 100);
                    state.thirst = clamp(state.thirst + 10, 0, 100);
                    state.happiness = clamp(state.happiness + 15, 0, 100);
                    showToastMsg('Saúde renovada! ❤️', 1600);
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
        showToastMsg('Comendo: ' + food.label + ' 😋', 1400);
        animSequence = {
            type: 'food', step: 0, maxStep: 14, foodId: food.id,
            onDone: () => {
                state.hunger = clamp(state.hunger + food.hunger, 0, 100);
                state.happiness = clamp(state.happiness + food.happy, 0, 100);
                if (food.id === 'icecream') {
                    state.madAngry = false;
                    syncAngryFlags();
                }
                if (state.foodBias) state.foodBias[food.id] = (state.foodBias[food.id] || 0) + 1;
                foodPick = null;
                uiMode = 'idle';
                showToastMsg('Delícia! ' + food.label + ' 🦖', 1400);
                save(); updateCompanionUI();
            }
        };
    }

    /* Jan-ken-po: Joguinho interativo */
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
            SND.nav();
            showToastMsg('Empate! Ambos jogaram ' + RPS_LABEL[player] + ' 🤜🤛', 1400);
        } else if (
            (dino === 'rock' && player === 'scissors') ||
            (dino === 'scissors' && player === 'paper') ||
            (dino === 'paper' && player === 'rock')
        ) {
            dinoWins = true;
            minigameData.wins++;
            minigameData.result = 'dino';
            state.happiness = clamp(state.happiness + 20, 0, 100);
            SND.confirm();
            showToastMsg('Dino venceu com ' + RPS_LABEL[dino] + '! 🦖🎉', 1400);
        } else {
            minigameData.result = 'you';
            SND.cancel();
            showToastMsg('Você ganhou com ' + RPS_LABEL[player] + '! 🙋‍♂️✨', 1400);
        }

        setTimeout(() => {
            if (uiMode !== 'minigame' || !minigameData) return;
            if (minigameData.result === 'tie') {
                minigameData.state = 'waiting';
                return;
            }
            minigameData.round++;
            if (minigameData.round > minigameData.maxRounds) {
                state.happiness = clamp(state.happiness + (minigameData.wins >= 3 ? 20 : 10), 0, 100);
                if (minigameData.wins >= 3) {
                    SND.hatch();
                    showToastMsg('Fim: DINO É CAMPEÃO! 🏆🦖', 2500);
                } else {
                    showToastMsg('Fim do jogo! Boa partida 🕹️✨', 2200);
                }
                uiMode = 'idle';
                minigameData = null;
                save(); updateCompanionUI();
            } else {
                minigameData.state = 'waiting';
                showToastMsg('Rodada ' + minigameData.round + '/5: Escolha ◄► Enter', 1600);
            }
        }, 1300);
    }

    document.querySelectorAll('[data-btn]').forEach((btnEl) => {
        const code = btnEl.getAttribute('data-btn');
        let pointerArmed = false;
        let lastFireAt = 0;

        const onPress = () => {
            btnEl.classList.add('pressed');
            if (code === 'ESC') escHeld = true;
            if (code === 'ENTER') enterHeld = true;
            if (code === 'LEFT') { leftHeld = true; if (rightHeld && !bothHeldSince) bothHeldSince = Date.now(); }
            if (code === 'RIGHT') { rightHeld = true; if (leftHeld && !bothHeldSince) bothHeldSince = Date.now(); }
        };
        const onRelease = () => {
            btnEl.classList.remove('pressed');
            if (code === 'ESC') escHeld = false;
            if (code === 'ENTER') enterHeld = false;
            if (code === 'LEFT') { leftHeld = false; bothHeldSince = 0; }
            if (code === 'RIGHT') { rightHeld = false; bothHeldSince = 0; }
        };
        const fire = () => {
            const now = Date.now();
            if (now - lastFireAt < 80) return;
            lastFireAt = now;
            handleHardwareBtn(code);
        };

        /*
          Ação no pointerup (com capture), não no click.
          O transform :active/:pressed deslocava o botão e o click se perdia —
          aí parecia que precisava clicar 2x.
        */
        btnEl.addEventListener('pointerdown', (e) => {
            if (e.button != null && e.button !== 0) return;
            pointerArmed = true;
            try { btnEl.setPointerCapture(e.pointerId); } catch (err) {}
            onPress();
        });
        btnEl.addEventListener('pointerup', (e) => {
            if (!pointerArmed) return;
            pointerArmed = false;
            /* Dispara antes do onRelease para Esc+Enter (ajuste de hora) ainda ver os dois held */
            fire();
            onRelease();
        });
        btnEl.addEventListener('pointercancel', () => {
            pointerArmed = false;
            onRelease();
        });
        btnEl.addEventListener('lostpointercapture', () => {
            if (pointerArmed) {
                pointerArmed = false;
                onRelease();
            }
        });
        btnEl.addEventListener('click', (e) => {
            e.preventDefault();
        });
    });

    /* Clique direto nos ícones do LCD — Ativa E EXECUTA NA HORA! */
    ALL_ICONS.forEach((id) => {
        const el = iconElements[id];
        if (!el) return;
        let iconArmed = false;
        let lastIconFire = 0;

        const fireIcon = () => {
            const now = Date.now();
            if (now - lastIconFire < 80) return;
            lastIconFire = now;
            const side = LEFT_ICONS.includes(id) ? 'left' : 'right';
            const list = side === 'left' ? LEFT_ICONS : RIGHT_ICONS;
            uiMode = 'menu';
            selectedSide = side;
            selectedIndex = list.indexOf(id);
            updateIconSelection();
            if (iconElements[id]) iconElements[id].classList.add('active');
            SND.nav();
            executeAction(id);
        };

        el.addEventListener('pointerdown', (e) => {
            if (e.button != null && e.button !== 0) return;
            iconArmed = true;
            try { el.setPointerCapture(e.pointerId); } catch (err) {}
        });
        el.addEventListener('pointerup', () => {
            if (!iconArmed) return;
            iconArmed = false;
            fireIcon();
        });
        el.addEventListener('pointercancel', () => { iconArmed = false; });
        el.addEventListener('click', (e) => { e.preventDefault(); });
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
        setBar(barDiscipline, (state.eduLevel + 1) * 20);
        setBar(barWeight, clamp(state.weight, 0, 99));

        if (stateLabel) {
            if (!state.isAlive) stateLabel.textContent = 'Faleceu';
            else if (state.isSick) stateLabel.textContent = 'Doente';
            else if (state.freezing) stateLabel.textContent = 'Frio';
            else if (state.madAngry) stateLabel.textContent = 'Abandonado';
            else if (state.heatAngry) stateLabel.textContent = 'Calor';
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
        rect(3, FLOOR_Y, 42, 1);
    }

    function drawPlates(emptyCount) {
        for (let i = 0; i < 2; i++) {
            const x = 14 + i * 10;
            rect(x, 50, 6, 2);
            rect(x - 1, 48, 8, 1);
            if (i < emptyCount) clearRectG(x + 1, 49, 4, 2);
        }
    }

    function drawGlass(empty) {
        rect(20, 48, 4, 6);
        rect(19, 46, 6, 2);
        if (empty) clearRectG(21, 49, 2, 4);
    }

    function drawMoodFace(happiness) {
        const level = happiness >= 85 ? 5 : happiness >= 70 ? 4 : happiness >= 55 ? 3 : happiness >= 40 ? 2 : happiness >= 25 ? 1 : 0;
        const faces = [':(', ':-|', ':|', ':)', ':D', ':))'];
        ctx.font = '700 18px "Press Start 2P", monospace';
        ctx.fillText(faces[level], canvas.width / 2, 72);
    }

    function drawClockSetScreen() {
        ctx.fillStyle = ink;
        const hh = String(clockSetHour).padStart(2, '0');
        const mm = String(clockSetMin).padStart(2, '0');
        const blink = lcdFrame % 2 === 0;
        ctx.font = '700 16px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        let text = hh + ':' + mm;
        if (blink && clockSetField === 'hour') text = '  ' + hh.slice(1) + ':' + mm;
        if (blink && clockSetField === 'minute') text = hh + ':' + '  ';
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
    }

    function drawMoonStars(frame) {
        ctx.fillStyle = ink;
        rect(36, 3, 4, 5);
        clearRectG(35, 4, 3, 3);
        if (frame % 2 === 0) rect(10, 4, 1, 1);
        else rect(22, 3, 1, 1);
    }

    /* Animação LCD: só frames 0/1 lentos — sem bounce/flicker */
    function drawDinoSprite(cx, cy, stage, mood, frame, anim) {
        ctx.fillStyle = ink;
        const invert = state.dirty && (frame % 2 === 1);

        if (stage === 'egg') {
            /* Ovo estático manchado — sem tremor/pisca */
            const x = cx;
            const y = cy;
            rect(x - 4, y - 9, 8, 2);
            rect(x - 5, y - 7, 10, 8);
            rect(x - 4, y + 1, 8, 1);
            clearRectG(x - 5, y - 7, 1, 1);
            clearRectG(x + 4, y - 7, 1, 1);
            clearRectG(x - 2, y - 5, 2, 2);
            clearRectG(x + 1, y - 2, 2, 2);
            return;
        }

        if (!state.isAlive || mood === 'angel') {
            rect(cx - 4, cy - 9, 8, 6);
            rect(cx - 8, cy - 8, 3, 2);
            rect(cx + 5, cy - 8, 3, 2);
            rect(cx - 3, cy - 12, 6, 1);
            clearRectG(cx - 2, cy - 7, 2, 1);
            clearRectG(cx + 1, cy - 7, 2, 1);
            return;
        }

        let w = 10, h = 9, tail = 3, spikes = 2, arm = 1;
        if (stage === 'baby') { w = 8; h = 7; tail = 2; spikes = 1; arm = 0; }
        else if (stage === 'child') { w = 10; h = 9; tail = 3; spikes = 2; arm = 1; }
        else if (stage === 'teen') { w = 12; h = 11; tail = 4; spikes = 3; arm = 2; }
        else if (stage === 'adult') { w = 14; h = 12; tail = 5; spikes = 4; arm = 2; }

        const shiver = (state.temperature <= 18 && mood !== 'sleep' && frame % 2 === 1) ? 1 : 0;
        const topY = cy - h;
        const leftX = cx - Math.floor(w / 2) + shiver;

        const walking = mood !== 'sleep' && !state.isSick && state.lightsOn;
        const step = walking ? (frame % 2) : 0;
        rect(Math.round(cx - w * 0.3) - 1 + shiver, FLOOR_Y - 2 + step, 2, 2);
        rect(Math.round(cx + w * 0.3) - 1 + shiver, FLOOR_Y - 2 + (1 - step), 2, 2);

        for (let i = 0; i < tail; i++) {
            rect(leftX - 1 - i, cy - Math.floor(h * 0.4), 2, 2);
        }

        rect(leftX, topY, w, h);
        if (invert) {
            clearRectG(leftX + 1, topY + 1, w - 2, h - 2);
            ctx.fillStyle = ink;
        } else {
            clearRectG(leftX, topY, 1, 1);
            clearRectG(leftX + w - 1, topY, 1, 1);
        }

        for (let s = 0; s < spikes; s++) {
            const sx = leftX + 1 + Math.floor(s * ((w - 2) / Math.max(spikes, 1)));
            rect(sx, topY - 2, 2, 2);
        }

        if (arm > 0) {
            rect(leftX + w - 1, topY + Math.floor(h * 0.45), arm, 2);
        }

        const blink = (frame % 16) === 15;
        const eyeX = leftX + w - Math.floor(w * 0.35);
        const eyeY = topY + Math.floor(h * 0.3);
        if (mood === 'sleep') {
            rect(eyeX - 2, eyeY + 1, 3, 1);
        } else if (mood === 'sick' || mood === 'angry') {
            clearRectG(eyeX - 2, eyeY, 2, 2);
            rect(eyeX - 2, eyeY, 1, 1);
            rect(eyeX - 1, eyeY + 1, 1, 1);
        } else if (!blink) {
            clearRectG(eyeX - 2, eyeY, 2, 2);
            rect(eyeX - 1, eyeY + 1, 1, 1);
        }

        const mouthY = topY + Math.floor(h * 0.65);
        const mouthX = leftX + w - 4;
        if (anim && (anim.type === 'food' || anim.type === 'drink') && frame % 2 === 0) {
            clearRectG(mouthX, mouthY - 1, 3, 3);
        } else if (mood === 'angry') {
            clearRectG(mouthX, mouthY + 1, 3, 1);
        } else if (mood === 'happy' || mood === 'good') {
            clearRectG(mouthX, mouthY, 3, 1);
        } else if (mood === 'bad' || mood === 'sick') {
            clearRectG(mouthX, mouthY + 1, 3, 1);
        } else if (mood !== 'sleep') {
            clearRectG(mouthX, mouthY, 2, 1);
        }

        if (state.isSick && frame % 2 === 0) {
            rect(leftX + w + 1, topY + 1, 1, 2);
        }
        if (mood === 'sleep') {
            rect(leftX + w + 1, topY - 2, 2, 2);
        }
    }

    function drawFoodItem(step, foodId) {
        ctx.fillStyle = ink;
        const fx = 36, fy = FLOOR_Y - 5;
        if (step >= 10) return;
        if (foodId === 'apple' || foodId === 'carrot') {
            rect(fx + 1, fy, 3, 4);
            rect(fx + 2, fy - 2, 1, 2);
        } else if (foodId === 'icecream') {
            rect(fx + 1, fy + 2, 2, 3);
            rect(fx, fy, 5, 3);
        } else {
            rect(fx, fy, 4, 4);
            rect(fx + 4, fy + 1, 2, 2);
        }
        if (step > 4) clearRectG(fx, fy, 2, 4);
        if (step > 7) clearRectG(fx + 2, fy, 2, 4);
    }

    function drawDrinkItem(step) {
        ctx.fillStyle = ink;
        const fx = 36, fy = FLOOR_Y - 8;
        rect(fx, fy, 5, 8);
        clearRectG(fx + 1, fy + 1, 3, 6);
        if (step < 10) {
            rect(fx + 1, fy + 2 + Math.floor(step / 2), 3, 4);
        }
        // Bolhas de água indo para o dino
        if (step % 2 === 0) {
            rect(fx - 4, fy + 3, 2, 2);
            rect(fx - 7, fy + 5, 2, 2);
        }
    }

    function drawShowerAnim(step) {
        ctx.fillStyle = ink;
        rect(12, 1, 36, 3);
        rect(28, 4, 6, 2);
        const dropY = (step * 3) % 18;
        for (let i = 0; i < 7; i++) {
            rect(14 + i * 5, (dropY + (i % 2) * 4) % (FLOOR_Y - 4), 1, 3);
        }
        // Bolhas e água de banho
        if (step % 2 === 0) {
            rect(12, FLOOR_Y - 4, 4, 4); clearRectG(13, FLOOR_Y - 3, 2, 2);
            rect(42, FLOOR_Y - 5, 3, 3); clearRectG(43, FLOOR_Y - 4, 1, 1);
        }
    }

    function drawStudyAnim(step) {
        ctx.fillStyle = ink;
        const lx = 38, ly = FLOOR_Y - 6;
        rect(lx, ly, 14, 6);
        clearRectG(lx + 6, ly + 1, 2, 5);
        if (step % 2 === 0) rect(lx + 6, ly - 2, 2, 3); // Página virando
        // Notas do livro subindo
        const ny = FLOOR_Y - 9 - (step % 4) * 3;
        rect(lx + 2, ny, 3, 3);
        rect(lx + 9, ny - 3, 2, 2);
    }

    function drawDisciplineAnim(step) {
        ctx.fillStyle = ink;
        const bx = 42, by = 4;
        rect(bx, by, 12, 16);
        clearRectG(bx + 1, by + 1, 10, 14);
        rect(bx + 5, by + 3, 2, 7); // Exclamação !
        rect(bx + 5, by + 12, 2, 2);
        if (step % 2 === 0) {
            rect(bx - 3, by + 5, 2, 1);
            rect(bx - 5, by + 8, 2, 1);
            rect(bx - 3, by + 11, 2, 1);
        }
    }

    function drawMedicineAnim(step) {
        ctx.fillStyle = ink;
        const mx = 42, my = FLOOR_Y - 8;
        rect(mx, my, 8, 8);
        rect(mx + 2, my - 3, 4, 3);
        clearRectG(mx + 3, my + 1, 2, 6);
        clearRectG(mx + 1, my + 3, 6, 2); // Cruz no frasco
        const cy = FLOOR_Y - 10 - (step % 5) * 3;
        rect(24, cy, 5, 5); clearRectG(24, cy, 1, 1); clearRectG(28, cy, 1, 1); clearRectG(24, cy + 4, 1, 1); clearRectG(28, cy + 4, 1, 1);
    }

    function drawAcAnim(step, acState) {
        ctx.fillStyle = ink;
        if (acState) {
            for (let i = 0; i < 3; i++) {
                const wx = ((step * 5) + i * 18) % 56 + 4;
                rect(wx, 5 + i * 4, 7, 1);
                rect(wx + 3, 3 + i * 4, 1, 5); // Flocos de neve ❄️
            }
        } else {
            for (let i = 0; i < 4; i++) {
                const hx = 12 + i * 12;
                const hy = FLOOR_Y - 5 - ((step + i) % 3) * 5;
                rect(hx, hy, 2, 4); rect(hx + 2, hy - 3, 2, 2); // Ondas de calor ♨️
            }
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

    function drawMinigameScreen(frame) {
        ctx.fillStyle = ink;
        if (!minigameData) return;

        for (let i = 0; i < 5; i++) {
            rect(10 + i * 6, 2, 4, 4);
            if (i >= minigameData.wins) clearRectG(11 + i * 6, 3, 2, 2);
        }

        if (minigameData.state === 'waiting') {
            const bobY = 13 + (frame % 2);
            drawHand(6, bobY, RPS[minigameData.choice]);
            drawDinoSprite(36, FLOOR_Y - 2 - ((frame % 2) * 2), state.stage, 'happy', frame, null);
            rect(24, 13, 2, 1); rect(25, 14, 1, 2); rect(24, 16, 1, 1); // "vs" sinal
        } else {
            drawHand(6, 12, minigameData.player);
            drawHand(36, 12, minigameData.dino);
            // Impacto visual de duelo no centro
            rect(22, 13, 6, 2);
            rect(24, 11, 2, 6);
            if (frame % 2 === 0) { clearRectG(23, 12, 4, 4); }
        }
    }

    function drawFoodPickScreen(frame) {
        ctx.fillStyle = ink;
        const food = FOODS[foodPick];
        drawDinoSprite(14, FLOOR_Y - 2, state.stage, 'happy', frame, null);
        drawFoodItem(2, food.id);
        rect(2, 14, 3, 1); rect(2, 13, 1, 3);
        rect(43, 14, 3, 1); rect(45, 13, 1, 3);
        ctx.font = '700 8px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(food.label.toUpperCase().slice(0, 8), canvas.width / 2, 18);
        ctx.textAlign = 'left';
    }

    function drawClockView() {
        ctx.fillStyle = ink;
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        rect(4, 6, 40, 20);
        clearRectG(5, 7, 38, 18);
        rect(6, 8, 36, 16);
        clearRectG(7, 9, 34, 14);
        ctx.font = '700 16px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const blink = now.getSeconds() % 2 === 0 ? ':' : ' ';
        ctx.fillText(`${hh}${blink}${mm}`, canvas.width / 2, canvas.height / 2);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
    }

    function drawStatsView() {
        ctx.fillStyle = ink;
        ctx.font = '700 9px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        const midX = canvas.width / 2;
        const pages = [
            () => {
                ctx.fillText('HUMOR', midX, 28);
                drawMoodFace(state.happiness);
            },
            () => {
                ctx.fillText('ESTUDO', midX, 28);
                ctx.font = '700 22px "Press Start 2P", monospace';
                ctx.fillText(educationGrade(state.eduLevel), midX, 72);
            },
            () => {
                ctx.fillText('PESO/IDADE', midX, 28);
                ctx.font = '700 12px "Press Start 2P", monospace';
                ctx.fillText(Math.round(state.weight) + 'kg', midX, 58);
                ctx.fillText('Dia ' + Math.floor(ageDays()), midX, 84);
            },
            () => {
                ctx.fillText('FOME', midX, 28);
                drawPlates(hungerPlatesEmpty());
            },
            () => {
                ctx.fillText('SEDE', midX, 28);
                drawGlass(thirstGlassEmpty() > 0);
            },
            () => {
                ctx.fillText('TEMP', midX, 28);
                ctx.font = '700 18px "Press Start 2P", monospace';
                ctx.fillText(Math.round(state.temperature) + 'C', midX, 72);
            }
        ];
        pages[statsPage % pages.length]();
        ctx.font = '700 7px "Press Start 2P", monospace';
        ctx.fillText((statsPage + 1) + '/6', midX, 118);
        ctx.textAlign = 'left';
    }

    function drawMeterBars(val, maxSlots) {
        const filled = Math.ceil((val / 100) * maxSlots);
        for (let i = 0; i < maxSlots; i++) {
            rect(8 + i * 7, 14, 5, 7);
            if (i >= filled) clearRectG(9 + i * 7, 15, 3, 5);
        }
    }

    let lastRender = 0;
    let lcdFrame = 0;
    function render(timestamp) {
        requestAnimationFrame(render);
        if (timestamp - lastRender < RENDER_MS) return;
        lastRender = timestamp;
        lcdFrame++;
        if (!ctx || !canvas) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (!state) return;

        if (uiMode === 'clock_set') { drawClockSetScreen(); return; }
        if (uiMode === 'clock') { drawClockView(); return; }
        if (uiMode === 'stats_view') { drawStatsView(); return; }
        if (uiMode === 'food_pick') { drawFloor(); drawFoodPickScreen(lcdFrame); return; }
        if (uiMode === 'minigame') { drawFloor(); drawMinigameScreen(lcdFrame); return; }

        drawFloor();
        if (!state.lightsOn || (!state.isAlive && isNightNow())) {
            drawMoonStars(lcdFrame);
        }

        let mood = 'happy';
        if (!state.isAlive) mood = 'angel';
        else if (state.isSick) mood = 'sick';
        else if (state.madAngry || state.heatAngry) mood = 'angry';
        else if (state.freezing) mood = 'bad';
        else if (!state.lightsOn) mood = 'sleep';
        else if (state.hunger < 30 || state.thirst < 30 || state.happiness < 30) mood = 'bad';

        /* Posição e dança durante animações */
        let dinoX = 24;
        if (state.isAlive && state.lightsOn && !state.isSick && !animSequence && state.stage !== 'egg') {
            const walkCycle = Math.floor(lcdFrame / 6) % 5;
            dinoX = 16 + walkCycle * 4;
        } else if (animSequence) {
            if (animSequence.type === 'food' || animSequence.type === 'drink') {
                dinoX = Math.min(32, 16 + animSequence.step * 2);
            } else {
                dinoX = 22 + ((animSequence.step % 2 === 0) ? -3 : 3); // Dino animado dançando
            }
        }

        drawDinoSprite(dinoX, FLOOR_Y - 2, state.stage, mood, lcdFrame, animSequence);

        if (animSequence) {
            animSequence.step++;
            if (animSequence.type === 'food') drawFoodItem(animSequence.step, animSequence.foodId);
            if (animSequence.type === 'drink') drawDrinkItem(animSequence.step);
            if (animSequence.type === 'bath') drawShowerAnim(animSequence.step);
            if (animSequence.type === 'study') drawStudyAnim(animSequence.step);
            if (animSequence.type === 'discipline') drawDisciplineAnim(animSequence.step);
            if (animSequence.type === 'medicine') drawMedicineAnim(animSequence.step);
            if (animSequence.type === 'ac') drawAcAnim(animSequence.step, animSequence.acState);
            if (animSequence.step >= animSequence.maxStep) {
                const done = animSequence.onDone;
                animSequence = null;
                if (done) done();
            }
        }
    }

    setInterval(() => {
        if (leftHeld && rightHeld && bothHeldSince && Date.now() - bothHeldSince >= MUTE_HOLD_MS) {
            theme.muted = !theme.muted;
            applyTheme();
            bothHeldSince = Date.now() + 999999;
            SND.nav();
        }
    }, 200);

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
