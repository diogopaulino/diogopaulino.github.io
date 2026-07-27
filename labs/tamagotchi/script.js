(function () {
    'use strict';

    /* ============================================================
       RAKURAKU DINOKUN / DINKIE DINO — lógica fiel 1997
       ============================================================ */
    const STORAGE_KEY = 'tamagotchi-dinkie-v6';
    const OLD_KEYS = ['tamagotchi-dinkie-v5', 'tamagotchi-dinkie-v4', 'tamagotchi-dinkie-v3', 'tamagotchi-dinkie-v2', 'ovinho-save-v1'];
    const THEME_KEY = 'tamagotchi-theme-v6';
    const HISTORY_KEY = 'tamagotchi-history-v3';

    const DAY_MS = 10 * 60 * 1000;
    const RENDER_MS = 400;
    const DECAY_MS = 1000;
    const IDEAL_TEMP = 25;
    const MUTE_HOLD_MS = 3000;
    const CLOCK_HOLD_MS = 1200;
    const EDU_GRADES = ['E+', 'D+', 'C+', 'B+', 'A+'];
    /* MUGG: 1kg=lv1, 15kg=lv2; extrapolamos teen/adult */
    const EVOL_WEIGHT = { child: 15, teen: 25, adult: 35 };
    const MOOD_FACES = [':(', ':-|', ':|', ':)', ':D', ':))'];
    const MOOD_LABELS = ['Unhappy', 'Slightly unhappy', 'Neutral', 'Slightly happy', 'Happy', 'Very Happy'];

    const RATES = {
        sickBase: 0.04,
        sickBad: 0.55,
        sickTimer: 0.35
    };

    /* Cores: amarelo + vermelho (clássico) */
    const SHELL_PRESETS = ['#f6c836', '#2ec4b6', '#e8455a', '#f0f2f5', '#37b264', '#3898f8', '#2a313d'];
    const ACCENT_PRESETS = ['#e23b2e', '#f6c836', '#262626', '#1d63ed', '#ffffff', '#10b981'];
    const SCREEN_PRESETS = ['#9aaa7a', '#a8b890', '#78a6ba', '#c6d175', '#e2b3c2', '#bcf49c'];

    /* Layout autêntico: esquerda / direita separados */
    const LEFT_ICONS = ['drink', 'food', 'light', 'discipline', 'stats'];
    const RIGHT_ICONS = ['play', 'study', 'bath', 'ac', 'medicine'];
    const ALL_ICONS = LEFT_ICONS.concat(RIGHT_ICONS);

    /* Evolução por comida: carne→T-Rex, vegetais→Bronto, massa→Triceratops */
    const FOODS = [
        { id: 'burger', label: 'Hamburguer', path: 'meat' },
        { id: 'chicken', label: 'Frango', path: 'meat' },
        { id: 'apple', label: 'Maca', path: 'veggie' },
        { id: 'carrot', label: 'Cenoura', path: 'veggie' },
        { id: 'icecream', label: 'Sorvete', path: 'pasta' },
        { id: 'noodles', label: 'Macarrao', path: 'pasta' }
    ];
    const ADULT_FORMS = { meat: 'trex', veggie: 'bronto', pasta: 'trike' };

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
    }, (() => {
        const cur = loadJSON(THEME_KEY, null);
        if (cur) return cur;
        const old = loadJSON('tamagotchi-theme-v5', loadJSON('tamagotchi-theme-v4', {}));
        return old.muted != null ? { muted: old.muted } : {};
    })());

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
        if (s.mood == null) {
            const h = s.happiness != null ? s.happiness : 85;
            s.mood = clamp(Math.round(h / 20), 0, 5);
        }
        if (s.foodUnits == null) {
            const h = s.hunger != null ? s.hunger : 85;
            s.foodUnits = clamp(Math.round(h / 25), 0, 4);
        }
        if (s.drinkUnits == null) {
            const t = s.thirst != null ? s.thirst : 85;
            s.drinkUnits = t >= 50 ? 1 : 0;
        }
        if (s.temperature == null) s.temperature = IDEAL_TEMP;
        if (s.acOn == null) s.acOn = false;
        if (s.weight == null || s.weight < 1) s.weight = 1;
        if (s.dirty == null) s.dirty = false;
        if (s.angry == null) s.angry = false;
        if (s.madAngry == null) s.madAngry = s.mood <= 1;
        if (s.heatAngry == null) s.heatAngry = s.temperature >= 30;
        if (s.freezing == null) s.freezing = s.temperature < 20;
        if (s.eduLevel == null) {
            const d = s.discipline != null ? s.discipline : 0;
            s.eduLevel = clamp(Math.floor(d / 25), 0, 4);
        }
        if (s.sickTimer == null) s.sickTimer = 0;
        if (s.lastScheduleHour == null) s.lastScheduleHour = new Date().getHours();
        if (s.inGameMode == null) s.inGameMode = s.stage !== 'egg';
        if (!s.foodPath) s.foodPath = { meat: 0, veggie: 0, pasta: 0 };
        if (s.iceCreamCount == null) s.iceCreamCount = (s.foodBias && s.foodBias.icecream) || 0;
        if (s.adultForm === 'good') s.adultForm = 'bronto';
        if (s.adultForm === 'bad') s.adultForm = 'trex';
        if (s.adultForm === 'neutral') s.adultForm = 'trike';
        if (s.afterlifeAt == null) s.afterlifeAt = null;
        delete s.poopCount;
        delete s.hygiene;
        delete s.health;
        delete s.energy;
        delete s.discipline;
        delete s.hunger;
        delete s.thirst;
        delete s.happiness;
        delete s.caredAt9am;
        delete s.careSum;
        delete s.careDays;
        s.v = 6;
        return s;
    }

    function freshState(name) {
        const now = Date.now();
        const h = new Date().getHours();
        return {
            v: 6,
            name: name || 'Dino',
            birthTime: now,
            hatchTime: null,
            stage: 'egg',
            adultForm: null,
            mood: 4,
            foodUnits: 4,
            drinkUnits: 1,
            eduLevel: 0,
            weight: 1,
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
            sicknessEpisodes: 0,
            foodBias: { burger: 0, chicken: 0, apple: 0, carrot: 0, icecream: 0, noodles: 0 },
            foodPath: { meat: 0, veggie: 0, pasta: 0 },
            iceCreamCount: 0,
            deathForm: null,
            afterlifeAt: null
        };
    }

    function resolveAdultForm() {
        if (!state) return 'trike';
        const p = state.foodPath || { meat: 0, veggie: 0, pasta: 0 };
        let best = 'pasta';
        let bestVal = -1;
        ['meat', 'veggie', 'pasta'].forEach((k) => {
            if ((p[k] || 0) > bestVal) {
                bestVal = p[k] || 0;
                best = k;
            }
        });
        return ADULT_FORMS[best] || 'trike';
    }

    function evolLevel() {
        if (!state) return 1;
        if (state.stage === 'egg' || state.stage === 'baby') return 1;
        if (state.stage === 'child') return 2;
        if (state.stage === 'teen') return 3;
        return 4;
    }

    function hungerPlatesEmpty() {
        if (!state) return 0;
        return clamp(2 - Math.ceil(state.foodUnits / 2), 0, 2);
    }

    function thirstGlassEmpty() {
        if (!state) return 0;
        return state.drinkUnits > 0 ? 0 : 1;
    }

    function syncAngryFlags() {
        if (!state) return;
        state.heatAngry = state.temperature >= 30;
        state.freezing = state.temperature < 20;
        state.madAngry = state.madAngry || state.mood <= 1;
        state.angry = state.madAngry || state.heatAngry;
    }

    /* Agenda MUGG: esvazia pratos/copos, humor, +1kg se cheio; temp ±0~8 */
    function applyScheduleHour(hour) {
        if (!state || !state.isAlive || state.stage === 'egg' || !state.inGameMode) return;
        if (state.afterlifeAt) return;

        const lv = evolLevel();
        const emptyPlates = lv <= 1 ? 2 : 1;
        const moodDropHours = [10, 12, 14, 16, 18];

        if (hour === 9) {
            /* Ordem MUGG: 1) converter cheio→peso 2) checar evolução */
            if (state.foodUnits >= 4 && state.drinkUnits >= 1) {
                state.weight = clamp(state.weight + 1, 1, 99);
            }
            checkEvolution(true);
        }

        if (hour >= 10 && hour <= 20) {
            /* Converter peso ANTES de esvaziar */
            if (state.foodUnits >= 4 && state.drinkUnits >= 1) {
                state.weight = clamp(state.weight + 1, 1, 99);
            }
            state.foodUnits = clamp(4 - emptyPlates * 2, 0, 4);
            state.drinkUnits = 0;
            if (moodDropHours.indexOf(hour) >= 0) {
                state.mood = clamp(state.mood - 1, 0, 5);
            }
        }

        /* Temperatura: ± aleatório 0~8°C por hora (AC liga = esfria) */
        const delta = Math.floor(Math.random() * 9);
        state.temperature = clamp(
            state.temperature + (state.acOn ? -delta : delta),
            10, 40
        );

        syncAngryFlags();
        if (state.foodUnits < 2 || state.drinkUnits < 1 || state.mood <= 1) maybeAlertBeep();
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

        /* Após adulto: 1 dia anjo/vampiro, depois morte */
        if (state.afterlifeAt) {
            if (Date.now() - state.afterlifeAt >= DAY_MS) {
                killPet('Fim');
                return;
            }
            state.lastUpdate = Date.now();
            return;
        }

        if (state.stage === 'adult' && state.hatchTime) {
            const adultAge = (Date.now() - (state.adultAt || state.hatchTime)) / DAY_MS;
            if (adultAge >= 4) {
                enterAfterlife();
                state.lastUpdate = Date.now();
                return;
            }
        }

        const deltaDays = deltaMs / DAY_MS;

        if (!state.dirty && state.mood <= 2 && Math.random() < 0.06 * deltaDays) {
            state.dirty = true;
        }

        if (!state.madAngry && state.mood <= 1 && Math.random() < 0.08 * deltaDays) {
            state.madAngry = true;
            syncAngryFlags();
            maybeAlertBeep();
        }

        if (!state.isSick) {
            const badness = (
                state.foodUnits < 1 || state.drinkUnits < 1 ||
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

        syncAngryFlags();
        maybeAlertBeep();
        state.lastUpdate = Date.now();
    }

    function enterAfterlife() {
        /* MUGG: anjo/vampiro ~1 dia, independente do ramo; sorvete → vampiro */
        state.afterlifeAt = Date.now();
        state.deathForm = state.iceCreamCount > 0 ? 'devil' : 'angel';
        state.isAlive = true;
        selectedSide = null;
        selectedIndex = -1;
        updateIconSelection();
        showToastMsg(state.deathForm === 'devil' ? 'Vampiro!' : 'Anjo!', 2000);
        SND.hatch();
        save();
        updateCompanionUI();
    }

    function checkEvolution(atNineAm) {
        if (!atNineAm || !state || !state.isAlive) return;
        if (state.stage === 'baby' && state.weight >= EVOL_WEIGHT.child) {
            state.stage = 'child';
            state.adultForm = resolveAdultForm();
            SND.hatch();
        } else if (state.stage === 'child' && state.weight >= EVOL_WEIGHT.teen) {
            state.stage = 'teen';
            state.adultForm = resolveAdultForm();
            SND.hatch();
        } else if (state.stage === 'teen' && state.weight >= EVOL_WEIGHT.adult) {
            state.stage = 'adult';
            state.adultForm = resolveAdultForm();
            state.adultAt = Date.now();
            SND.hatch();
        }
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

    let lastAlertBeep = 0;
    function maybeAlertBeep() {
        if (!state || !state.isAlive || state.afterlifeAt) return;
        const needs = (
            state.foodUnits < 2 || state.drinkUnits < 1 ||
            state.isSick || state.dirty || state.madAngry || state.heatAngry ||
            state.freezing || Math.abs(state.temperature - IDEAL_TEMP) > 7
        );
        /* MUGG: bip a cada ~4 minutos */
        if (needs && Date.now() - lastAlertBeep > 240000) {
            lastAlertBeep = Date.now();
            SND.alert();
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
        state.afterlifeAt = null;
        state.deathForm = 'dead';
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
    let escEnterHeldSince = 0;

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

    function handleHardwareBtn(btn) {
        if (!state || !state.isAlive) {
            openSetup(false);
            return;
        }
        if (uiMode === 'animating') return;

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

        if (state.afterlifeAt) {
            showToastMsg('Sem interacao', 1400);
            SND.cancel();
            return;
        }

        if (state.stage === 'egg' && actionId !== 'stats' && actionId !== 'light') {
            showToastMsg('Ainda e ovo!', 1400);
            SND.cancel();
            return;
        }

        if (actionId === 'drink') {
            if (state.drinkUnits >= 1) {
                SND.cancel();
                return;
            }
            uiMode = 'animating';
            SND.feed();
            animSequence = {
                type: 'drink', step: 0, maxStep: 12,
                onDone: () => {
                    state.drinkUnits = 1;
                    uiMode = 'idle';
                    save(); updateCompanionUI();
                }
            };
            return;
        }

        if (actionId === 'food') {
            if (state.foodUnits >= 4) {
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
            /* MUGG: Pet = +1 educação (como Study); também acalma raiva */
            uiMode = 'animating';
            SND.confirm();
            animSequence = {
                type: 'discipline', step: 0, maxStep: 10,
                onDone: () => {
                    if (state.madAngry) state.madAngry = false;
                    if (state.heatAngry && state.acOn) state.heatAngry = false;
                    state.eduLevel = clamp(state.eduLevel + 1, 0, 4);
                    syncAngryFlags();
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
            uiMode = 'minigame';
            minigameData = { round: 1, maxRounds: 5, wins: 0, choice: 0, state: 'waiting', result: null };
            SND.confirm();
            return;
        }

        if (actionId === 'study') {
            if (state.eduLevel >= 4) {
                SND.cancel();
                return;
            }
            uiMode = 'animating';
            SND.confirm();
            animSequence = {
                type: 'study', step: 0, maxStep: 12,
                onDone: () => {
                    state.eduLevel = clamp(state.eduLevel + 1, 0, 4);
                    uiMode = 'idle';
                    save(); updateCompanionUI();
                }
            };
            return;
        }

        if (actionId === 'bath') {
            if (!state.dirty) {
                SND.cancel();
                return;
            }
            uiMode = 'animating';
            SND.clean();
            showToastMsg('Banho!', 1400);
            animSequence = {
                type: 'bath', step: 0, maxStep: 14,
                onDone: () => {
                    state.dirty = false;
                    uiMode = 'idle';
                    save(); updateCompanionUI();
                }
            };
            return;
        }

        if (actionId === 'ac') {
            /* MUGG: usar AC cura o status, mesmo se já estava ajustado */
            state.acOn = !state.acOn;
            if (state.acOn) state.heatAngry = false;
            else state.freezing = false;
            syncAngryFlags();
            SND.confirm();
            showToastMsg(state.acOn ? 'AC ON' : 'AC OFF', 1200);
            save(); updateCompanionUI();
            return;
        }

        if (actionId === 'medicine') {
            if (!state.isSick) {
                SND.cancel();
                return;
            }
            uiMode = 'animating';
            SND.confirm();
            animSequence = {
                type: 'medicine', step: 0, maxStep: 12,
                onDone: () => {
                    /* MUGG: cura e zera mood, food, drink, education */
                    state.isSick = false;
                    state.sickTimer = 0;
                    state.mood = 0;
                    state.foodUnits = 0;
                    state.drinkUnits = 0;
                    state.eduLevel = 0;
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
                /* MUGG: 1 feed = 1 unidade; prato vazio precisa de 2 feeds */
                state.foodUnits = clamp(state.foodUnits + 1, 0, 4);
                if (food.id === 'icecream') {
                    state.madAngry = false;
                    state.iceCreamCount = (state.iceCreamCount || 0) + 1;
                    syncAngryFlags();
                }
                if (state.foodBias) state.foodBias[food.id] = (state.foodBias[food.id] || 0) + 1;
                if (state.foodPath && food.path) {
                    state.foodPath[food.path] = (state.foodPath[food.path] || 0) + 1;
                }
                foodPick = null;
                uiMode = 'idle';
                save(); updateCompanionUI();
            }
        };
    }

    /* MUGG: empate = vitória sua; só vitória do Dino sobe humor +1; set sem bônus */
    function playRpsTurn() {
        if (!minigameData || minigameData.state !== 'waiting') return;
        minigameData.state = 'reveal';
        const player = RPS[minigameData.choice];
        const dino = RPS[Math.floor(Math.random() * 3)];
        minigameData.player = player;
        minigameData.dino = dino;

        if (player === dino) {
            minigameData.result = 'tie';
            SND.nav();
        } else if (
            (dino === 'rock' && player === 'scissors') ||
            (dino === 'scissors' && player === 'paper') ||
            (dino === 'paper' && player === 'rock')
        ) {
            minigameData.wins++;
            minigameData.result = 'dino';
            state.mood = clamp(state.mood + 1, 0, 5);
            SND.confirm();
        } else {
            minigameData.result = 'you';
            SND.cancel();
        }

        setTimeout(() => {
            if (uiMode !== 'minigame' || !minigameData) return;
            minigameData.round++;
            if (minigameData.round > minigameData.maxRounds) {
                uiMode = 'idle';
                minigameData = null;
                save(); updateCompanionUI();
            } else {
                minigameData.state = 'waiting';
            }
        }, 1100);
    }

    document.querySelectorAll('[data-btn]').forEach((btnEl) => {
        const code = btnEl.getAttribute('data-btn');
        let touchUsed = false;

        function pressDown() {
            btnEl.classList.add('pressed');
            if (code === 'ESC') {
                escHeld = true;
                if (enterHeld && !escEnterHeldSince) escEnterHeldSince = Date.now();
            }
            if (code === 'ENTER') {
                enterHeld = true;
                if (escHeld && !escEnterHeldSince) escEnterHeldSince = Date.now();
            }
            if (code === 'LEFT') { leftHeld = true; if (rightHeld && !bothHeldSince) bothHeldSince = Date.now(); }
            if (code === 'RIGHT') { rightHeld = true; if (leftHeld && !bothHeldSince) bothHeldSince = Date.now(); }
        }

        function pressUp(fromTouch) {
            btnEl.classList.remove('pressed');
            const holdClock = escEnterHeldSince && (Date.now() - escEnterHeldSince >= CLOCK_HOLD_MS);
            const holdMute = bothHeldSince && (Date.now() - bothHeldSince >= MUTE_HOLD_MS);
            if (code === 'ESC') { escHeld = false; escEnterHeldSince = 0; }
            if (code === 'ENTER') { enterHeld = false; escEnterHeldSince = 0; }
            if (code === 'LEFT') { leftHeld = false; bothHeldSince = 0; }
            if (code === 'RIGHT') { rightHeld = false; bothHeldSince = 0; }
            if (fromTouch && !holdClock && !holdMute) handleHardwareBtn(code);
        }

        btnEl.addEventListener('mousedown', pressDown);
        btnEl.addEventListener('mouseup', () => pressUp(false));
        btnEl.addEventListener('mouseleave', () => {
            btnEl.classList.remove('pressed');
            if (code === 'ESC') { escHeld = false; escEnterHeldSince = 0; }
            if (code === 'ENTER') { enterHeld = false; escEnterHeldSince = 0; }
            if (code === 'LEFT') { leftHeld = false; bothHeldSince = 0; }
            if (code === 'RIGHT') { rightHeld = false; bothHeldSince = 0; }
        });
        btnEl.addEventListener('click', (e) => {
            e.preventDefault();
            if (touchUsed) { touchUsed = false; return; }
            handleHardwareBtn(code);
        });
        btnEl.addEventListener('touchstart', (e) => {
            e.preventDefault();
            touchUsed = true;
            pressDown();
        }, { passive: false });
        btnEl.addEventListener('touchend', (e) => {
            e.preventDefault();
            pressUp(true);
        }, { passive: false });
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
        const f = form || (state && state.adultForm) || null;
        const path = f === 'trex' ? 'T-Rex' : f === 'bronto' ? 'Bronto' : f === 'trike' ? 'Tricera' : null;
        if (stage === 'child') return path ? path + ' jr' : 'Crianca';
        if (stage === 'teen') return path ? path + '+' : 'Jovem';
        if (stage === 'adult') return path || 'Adulto';
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
        setBar(barHunger, (state.foodUnits / 4) * 100);
        setBar(barThirst, state.drinkUnits * 100);
        setBar(barHappiness, (state.mood / 5) * 100);
        setBar(barDiscipline, (state.eduLevel + 1) * 20);
        setBar(barWeight, clamp(state.weight * 2, 0, 100));

        if (stateLabel) {
            if (!state.isAlive) stateLabel.textContent = 'Faleceu';
            else if (state.afterlifeAt) stateLabel.textContent = state.deathForm === 'devil' ? 'Vampiro' : 'Anjo';
            else if (state.isSick) stateLabel.textContent = 'Doente';
            else if (state.freezing) stateLabel.textContent = 'Frio';
            else if (state.madAngry) stateLabel.textContent = 'Abandonado';
            else if (state.heatAngry) stateLabel.textContent = 'Calor';
            else if (state.dirty) stateLabel.textContent = 'Sujo';
            else if (!state.lightsOn) stateLabel.textContent = 'Dormindo';
            else stateLabel.textContent = MOOD_LABELS[clamp(state.mood, 0, 5)] || 'Ativo';
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

    function drawMoodFace(moodLevel) {
        const level = clamp(moodLevel, 0, 5);
        ctx.font = '700 18px "Press Start 2P", monospace';
        ctx.fillText(MOOD_FACES[level], canvas.width / 2, 72);
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

    /* Sprites 1-bit — baby fiel à foto (chifres, olhos, boca em linha) */
    const SPRITE_MAP = {
        egg: { w:8, h:7, rows:['00111100','01111110','11011011','11000011','11011011','01111110','00111100'] },
        /* Foto: blob quadrado + 2 chifres nos cantos, olhos 1px, boca reta */
        baby: { w:8, h:8, rows:[
            '10000001',
            '01111110',
            '11011011',
            '11000011',
            '11111111',
            '01111110',
            '00111100',
            '01100110'
        ] },
        trex_child: { w:9, h:7, rows:['000111100','001111110','001100110','011111110','011000110','001100110','001000010'] },
        trex_teen: { w:10, h:8, rows:['0000111110','0001111111','0001100011','0011111111','0011100110','0111100110','0110000110','0100000010'] },
        trex_adult: { w:12, h:9, rows:['000001111110','000011111111','000011000011','000111111111','000111100110','011111000110','011100000110','011000000011','010000000010'] },
        bronto_child: { w:8, h:7, rows:['00000110','00001110','00001100','01111111','11000011','01100110','01000010'] },
        bronto_teen: { w:10, h:8, rows:['0000001100','0000011100','0000011000','0000111000','0111111111','1100000011','0110000110','0100000010'] },
        bronto_adult: { w:12, h:9, rows:['000000001100','000000011100','000000111000','000001110000','000011110000','011111111111','110000000011','011000000110','010000000010'] },
        trike_child: { w:8, h:7, rows:['00010000','00111000','01111111','11011011','11000011','01111110','01000010'] },
        trike_teen: { w:9, h:8, rows:['000011000','000111100','001111110','011111111','110110111','110000011','011111110','010000010'] },
        trike_adult: { w:11, h:9, rows:['00000100000','00001110000','00011111000','00111111111','01111111111','11011011111','11000000011','01111111110','01000000010'] },
        angel: { w:10, h:7, rows:['0100000010','1101111011','0111111110','1101101101','1100000011','0111111110','0011111100'] },
        devil: { w:10, h:7, rows:['1010000101','0110111101','0111111110','1101001011','1100000011','0111111110','1100000011'] },
        dead: { w:8, h:9, rows:['00011000','00111100','01011010','11000011','11011011','01111110','00111100','00011000','01110111'] }
    };

    function spriteKeyForState() {
        if (!state) return 'egg';
        if (!state.isAlive) return 'dead';
        /* MUGG: anjo/vampiro por 1 dia, sem interação */
        if (state.afterlifeAt) {
            return state.deathForm === 'devil' ? 'devil' : 'angel';
        }
        if (state.stage === 'egg') return 'egg';
        if (state.stage === 'baby') return 'baby';
        const form = state.adultForm || resolveAdultForm();
        if (state.stage === 'child') return form + '_child';
        if (state.stage === 'teen') return form + '_teen';
        return form + '_adult';
    }

    function drawSpriteKey(key, cx, cy, invert) {
        const spr = SPRITE_MAP[key] || SPRITE_MAP.baby;
        const ox = cx - Math.floor(spr.w / 2);
        const oy = cy - spr.h;
        ctx.fillStyle = ink;
        for (let y = 0; y < spr.h; y++) {
            const row = spr.rows[y];
            for (let x = 0; x < spr.w; x++) {
                if (row[x] === '1') {
                    if (invert) clearRectG(ox + x, oy + y, 1, 1);
                    else rect(ox + x, oy + y, 1, 1);
                }
            }
        }
        return { ox, oy, w: spr.w, h: spr.h };
    }

    /* Animação LCD: sprites do growth chart 1997 */
    function drawDinoSprite(cx, cy, stage, mood, frame, anim) {
        ctx.fillStyle = ink;
        const invert = state.dirty && (frame % 2 === 1);
        const shiver = (state.temperature <= 18 && mood !== 'sleep' && state.isAlive && frame % 2 === 1) ? 1 : 0;
        const x = cx + shiver;
        const key = spriteKeyForState();
        const box = drawSpriteKey(key, x, cy, invert);

        if (!state.isAlive) return;

        const walking = mood !== 'sleep' && !state.isSick && state.lightsOn && stage !== 'egg';
        if (walking) {
            const step = frame % 2;
            rect(box.ox + 1, FLOOR_Y - 1 + step, 2, 1);
            rect(box.ox + box.w - 3, FLOOR_Y - 1 + (1 - step), 2, 1);
        }

        if (state.isSick && frame % 2 === 0) {
            rect(box.ox + box.w + 1, box.oy + 1, 1, 2);
        }
        if (mood === 'sleep') {
            rect(box.ox + box.w + 1, box.oy - 1, 2, 2);
            rect(box.ox + box.w + 3, box.oy - 3, 1, 1);
        }
        if (mood === 'angry' && frame % 2 === 0) {
            rect(box.ox + box.w - 2, box.oy - 2, 1, 1);
            rect(box.ox + box.w, box.oy - 2, 1, 1);
        }
        if (anim && (anim.type === 'food' || anim.type === 'drink') && frame % 2 === 0) {
            clearRectG(box.ox + box.w - 4, box.oy + Math.floor(box.h * 0.55), 3, 2);
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
        const fx = 36, fy = FLOOR_Y - 6;
        rect(fx, fy, 4, 6);
        clearRectG(fx + 1, fy + 1, 2, 4);
        if (step < 8) rect(fx + 1, fy + 2 + Math.floor(step / 3), 2, 2);
    }

    function drawShowerAnim(step) {
        ctx.fillStyle = ink;
        rect(16, 2, 14, 2);
        const dropY = 5 + step;
        for (let i = 0; i < 4; i++) {
            rect(18 + i * 3, (dropY + (i % 2) * 2) % (FLOOR_Y - 3), 1, 2);
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
            drawHand(6, 14, RPS[minigameData.choice]);
            drawDinoSprite(32, FLOOR_Y - 2, state.stage, 'happy', frame, null);
            rect(22, 12, 2, 1); rect(23, 13, 1, 2); rect(22, 15, 1, 1);
        } else {
            drawHand(4, 12, minigameData.player);
            drawHand(32, 12, minigameData.dino);
            rect(22, 15, 4, 1);
            rect(23, 13, 2, 5);
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
        /* MUGG ordem: humor, temp, sede, fome, peso/dias, educação */
        ctx.fillStyle = ink;
        ctx.font = '700 9px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        const midX = canvas.width / 2;
        const pages = [
            () => {
                ctx.fillText('HUMOR', midX, 28);
                drawMoodFace(state.mood);
            },
            () => {
                ctx.fillText('TEMP', midX, 28);
                ctx.font = '700 18px "Press Start 2P", monospace';
                ctx.fillText(Math.round(state.temperature) + 'C', midX, 72);
            },
            () => {
                ctx.fillText('SEDE', midX, 28);
                drawGlass(thirstGlassEmpty() > 0);
            },
            () => {
                ctx.fillText('FOME', midX, 28);
                drawPlates(hungerPlatesEmpty());
            },
            () => {
                ctx.fillText('PESO/IDADE', midX, 28);
                ctx.font = '700 12px "Press Start 2P", monospace';
                ctx.fillText(Math.round(state.weight) + 'kg', midX, 58);
                ctx.fillText('Dia ' + Math.floor(ageDays()), midX, 84);
            },
            () => {
                ctx.fillText('ESTUDO', midX, 28);
                ctx.font = '700 22px "Press Start 2P", monospace';
                ctx.fillText(educationGrade(state.eduLevel), midX, 72);
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
        else if (state.afterlifeAt) mood = 'angel';
        else if (state.isSick) mood = 'sick';
        else if (state.madAngry || state.heatAngry) mood = 'angry';
        else if (state.freezing) mood = 'bad';
        else if (!state.lightsOn) mood = 'sleep';
        else if (state.foodUnits < 2 || state.drinkUnits < 1 || state.mood <= 1) mood = 'bad';

        /* Posição: troca a cada ~6 frames (poucos passos, estilo original) */
        let dinoX = 24;
        if (state.isAlive && !state.afterlifeAt && state.lightsOn && !state.isSick && !animSequence && state.stage !== 'egg') {
            const walkCycle = Math.floor(lcdFrame / 6) % 5;
            dinoX = 16 + walkCycle * 4;
        } else if (animSequence && (animSequence.type === 'food' || animSequence.type === 'drink')) {
            dinoX = Math.min(32, 18 + animSequence.step * 2);
        }

        drawDinoSprite(dinoX, FLOOR_Y - 2, state.stage, mood, lcdFrame, animSequence);

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
        if (leftHeld && rightHeld && bothHeldSince && Date.now() - bothHeldSince >= MUTE_HOLD_MS) {
            theme.muted = !theme.muted;
            applyTheme();
            bothHeldSince = Date.now() + 999999;
            SND.nav();
        }
        if (escHeld && enterHeld && escEnterHeldSince && Date.now() - escEnterHeldSince >= CLOCK_HOLD_MS) {
            if (state && state.isAlive && state.inGameMode && uiMode === 'idle') {
                const now = new Date();
                clockSetHour = now.getHours();
                clockSetMin = now.getMinutes();
                clockSetField = 'hour';
                uiMode = 'clock_set';
                SND.nav();
            }
            escEnterHeldSince = Date.now() + 999999;
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
