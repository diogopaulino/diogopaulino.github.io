(function () {
    'use strict';

    /* ============================================================
       CONSTANTS
       ============================================================ */
    const STORAGE_KEY = 'ovinho-save-v1';
    const THEME_KEY = 'ovinho-theme-v1';
    const HISTORY_KEY = 'ovinho-history-v1';

    const DAY_MS = 10 * 60 * 1000;      // 10 real minutes = 1 pet day
    const EGG_HATCH_MS = 60 * 1000;     // 1 real minute as an egg
    const STAGE_DAYS = { child: 1, teen: 2.5, adult: 4.5 };
    const STAGE_ORDER = ['baby', 'child', 'teen', 'adult'];
    const MAX_POOP = 4;
    const POOP_INTERVAL_MS = DAY_MS / 5;
    const RENDER_MS = 140;
    const DECAY_MS = 1000;

    const RATES = {
        hunger: 100,
        happiness: 70,
        hygiene: 40,
        energyAwake: 60,
        energySleep: 240,
        discipline: 15,
        sickBase: 0.05,
        sickBad: 0.6,
        healthSick: 25,
        healthNeglect: 10,
        healthRegen: 5
    };

    const SHELL_PRESETS = ['#f2c94c', '#e8536b', '#f6a63a', '#4ecb71', '#3aa6f6', '#a76ef4', '#ff8fc7', '#3a3a3a'];
    const ACCENT_PRESETS = ['#ef7d3b', '#3a3a3a', '#e8544a', '#2563eb', '#111827', '#ffffff'];
    const SCREEN_PRESETS = ['#9bbc0f', '#8fd3f4', '#f4a3c1', '#f7e07f', '#c3f7a3', '#dcdcdc'];

    const ICON_META = {
        feed: '🍖 Comer',
        clean: '🧼 Limpar',
        light: '💡 Luz',
        discipline: '❗ Disciplina',
        play: '🎮 Brincar',
        medicine: '💊 Remédio',
        stats: '📊 Status'
    };
    const LEFT_ICON_IDS = ['feed', 'clean', 'light', 'discipline'];
    const RIGHT_ICON_IDS = ['play', 'medicine', 'stats'];

    /* ============================================================
       DOM
       ============================================================ */
    const canvas = document.getElementById('petCanvas');
    const ctx = canvas.getContext('2d');
    const shellEl = document.getElementById('tamaShell');
    const overlayEl = document.getElementById('tamaOverlay');
    const toastEl = document.getElementById('tamaToast');
    const nameArcEl = document.getElementById('petNameArc');
    const barHunger = document.getElementById('barHunger');
    const barHappiness = document.getElementById('barHappiness');
    const barHygiene = document.getElementById('barHygiene');
    const barHealth = document.getElementById('barHealth');
    const stageLabel = document.getElementById('petStageLabel');
    const ageLabel = document.getElementById('petAgeLabel');
    const renameBtn = document.getElementById('renameBtn');
    const resetBtn = document.getElementById('resetBtn');
    const muteBtn = document.getElementById('muteBtn');
    const shellColorInput = document.getElementById('shellColorInput');
    const accentColorInput = document.getElementById('accentColorInput');
    const screenColorInput = document.getElementById('screenColorInput');
    const shellPresetsEl = document.getElementById('shellPresets');
    const accentPresetsEl = document.getElementById('accentPresets');
    const screenPresetsEl = document.getElementById('screenPresets');
    const historyPanel = document.getElementById('historyPanel');
    const historyList = document.getElementById('historyList');

    const GRID_W = 64;
    const GRID_H = 40;
    const PIX = canvas.width / GRID_W;
    const FLOOR_Y = 34;

    function layoutIconColumn(ids, cx) {
        const top = 4, bottom = FLOOR_Y - 3;
        const gap = (bottom - top) / ids.length;
        return ids.map((id, i) => ({ id, label: ICON_META[id], cx, cy: top + gap * i + gap / 2 }));
    }
    const ICONS = layoutIconColumn(LEFT_ICON_IDS, 7).concat(layoutIconColumn(RIGHT_ICON_IDS, 57));

    /* ============================================================
       AUDIO
       ============================================================ */
    let audioCtx = null;
    let muted = false;

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
        if (muted) return;
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
        gain.gain.exponentialRampToValueAtTime(vol || 0.05, t0 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + (dur || 0.08));
        osc.start(t0);
        osc.stop(t0 + (dur || 0.08) + 0.02);
    }

    function playJingle(notes) {
        let t = 0;
        notes.forEach(([f, d]) => {
            beep(f, d, t, 0.055);
            t += d * 1.05;
        });
    }

    const SND = {
        tick: () => beep(920, 0.03, 0, 0.03),
        confirm: () => playJingle([[660, 0.05], [880, 0.06]]),
        cancel: () => beep(300, 0.06, 0, 0.04),
        feed: () => playJingle([[520, 0.05], [660, 0.05], [780, 0.07]]),
        clean: () => playJingle([[700, 0.04], [900, 0.05]]),
        happy: () => playJingle([[660, 0.06], [880, 0.06], [1040, 0.09]]),
        sad: () => playJingle([[440, 0.08], [340, 0.12]]),
        evolve: () => playJingle([[523, 0.09], [659, 0.09], [784, 0.09], [1047, 0.16]]),
        sick: () => playJingle([[300, 0.1], [260, 0.14]]),
        death: () => playJingle([[400, 0.12], [340, 0.12], [260, 0.2]]),
        hatch: () => playJingle([[440, 0.06], [660, 0.06], [990, 0.12]])
    };

    /* ============================================================
       STORAGE HELPERS
       ============================================================ */
    function loadJSON(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (err) {
            return fallback;
        }
    }

    function saveJSON(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (err) {
            /* storage unavailable (private mode / quota) */
        }
    }

    /* ============================================================
       THEME
       ============================================================ */
    const theme = Object.assign({
        shell: SHELL_PRESETS[0],
        accent: ACCENT_PRESETS[0],
        screen: SCREEN_PRESETS[0],
        muted: false
    }, loadJSON(THEME_KEY, {}));

    let ink = '#1a2e05';

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
        shellEl.style.setProperty('--shell-color', theme.shell);
        shellEl.style.setProperty('--shell-light', shadeColor(theme.shell, 0.28));
        shellEl.style.setProperty('--shell-dark', shadeColor(theme.shell, -0.22));
        shellEl.style.setProperty('--accent-color', theme.accent);
        shellEl.style.setProperty('--accent-light', shadeColor(theme.accent, 0.3));
        shellEl.style.setProperty('--accent-dark', shadeColor(theme.accent, -0.3));
        shellEl.style.setProperty('--screen-color', theme.screen);
        shellColorInput.value = theme.shell;
        accentColorInput.value = theme.accent;
        screenColorInput.value = theme.screen;
        ink = relativeLuminance(theme.screen) < 0.4 ? '#d9ffb0' : '#1a2e05';
        overlayEl.style.color = ink;
        muted = !!theme.muted;
        muteBtn.textContent = muted ? '🔇 Som desligado' : '🔊 Som ligado';
        saveJSON(THEME_KEY, theme);
    }

    function buildPresets(container, colors, cssVarSetter) {
        container.innerHTML = '';
        colors.forEach((c) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'preset-swatch';
            b.style.background = c;
            b.setAttribute('aria-label', c);
            b.addEventListener('click', () => cssVarSetter(c));
            container.appendChild(b);
        });
    }

    buildPresets(shellPresetsEl, SHELL_PRESETS, (c) => { theme.shell = c; applyTheme(); });
    buildPresets(accentPresetsEl, ACCENT_PRESETS, (c) => { theme.accent = c; applyTheme(); });
    buildPresets(screenPresetsEl, SCREEN_PRESETS, (c) => { theme.screen = c; applyTheme(); });

    shellColorInput.addEventListener('input', () => { theme.shell = shellColorInput.value; applyTheme(); });
    accentColorInput.addEventListener('input', () => { theme.accent = accentColorInput.value; applyTheme(); });
    screenColorInput.addEventListener('input', () => { theme.screen = screenColorInput.value; applyTheme(); });
    muteBtn.addEventListener('click', () => { theme.muted = !theme.muted; applyTheme(); });

    applyTheme();

    /* ============================================================
       STATE
       ============================================================ */
    let state = loadJSON(STORAGE_KEY, null);

    function freshState(name, shellColor, accentColor, screenColor) {
        const now = Date.now();
        if (shellColor) { theme.shell = shellColor; }
        if (accentColor) { theme.accent = accentColor; }
        if (screenColor) { theme.screen = screenColor; }
        return {
            v: 1,
            name: name || 'Bicho',
            birthTime: now,
            hatchTime: null,
            stage: 'egg',
            adultForm: null,
            hunger: 80,
            happiness: 80,
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
            sicknessEpisodes: 0,
            lastTouch: 0
        };
    }

    let uiMode = 'idle'; // idle | menu | minigame | stats
    let cursorIndex = 0;
    let minigame = null;
    let eggWiggle = 0;
    let lastRenderTime = 0;

    function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

    function save() {
        if (state) saveJSON(STORAGE_KEY, state);
    }

    /* ============================================================
       HISTORY
       ============================================================ */
    function getHistory() { return loadJSON(HISTORY_KEY, []); }

    function addHistory(entry) {
        const h = getHistory();
        h.unshift(entry);
        saveJSON(HISTORY_KEY, h.slice(0, 20));
        renderHistory();
    }

    function renderHistory() {
        const h = getHistory();
        if (!h.length) { historyPanel.hidden = true; return; }
        historyPanel.hidden = false;
        historyList.innerHTML = '';
        h.forEach((e) => {
            const li = document.createElement('li');
            const form = e.form ? ` (${formLabel(e.form)})` : '';
            li.innerHTML = `<span>${escapeHtml(e.name)}${form}</span><span>${e.days} dia(s) · ${e.cause}</span>`;
            historyList.appendChild(li);
        });
    }

    function formLabel(f) {
        return f === 'good' ? 'radiante' : f === 'bad' ? 'arisco' : 'equilibrado';
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    /* ============================================================
       NAME / NEW EGG MODAL
       ============================================================ */
    function showNamePrompt(opts) {
        const backdrop = document.createElement('div');
        backdrop.className = 'name-modal-backdrop';
        backdrop.innerHTML = `
            <div class="name-modal">
                <h3>${opts.title}</h3>
                <p>${opts.sub}</p>
                <input type="text" maxlength="12" value="${escapeHtml(opts.value || '')}" placeholder="Nome do bichinho">
                <button type="button">${opts.confirmLabel}</button>
            </div>
        `;
        document.body.appendChild(backdrop);
        const input = backdrop.querySelector('input');
        const btn = backdrop.querySelector('button');
        input.focus();
        input.select();
        function confirmIt() {
            const val = input.value.trim().slice(0, 12) || 'Bicho';
            document.body.removeChild(backdrop);
            opts.onConfirm(val);
        }
        btn.addEventListener('click', confirmIt);
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') confirmIt(); });
    }

    function startNewEgg(existing) {
        showNamePrompt({
            title: existing ? 'Novo ovo' : 'Bem-vindo!',
            sub: 'Como você quer chamar seu novo bichinho?',
            confirmLabel: '🥚 Chocar ovo',
            value: '',
            onConfirm: (name) => {
                state = freshState(name);
                applyTheme();
                uiMode = 'idle';
                overlayEl.classList.add('hidden');
                save();
                updateStaticUI();
            }
        });
    }

    renameBtn.addEventListener('click', () => {
        if (!state) return;
        showNamePrompt({
            title: 'Renomear',
            sub: 'Escolha um novo nome para o seu bichinho.',
            confirmLabel: '✔ Salvar',
            value: state.name,
            onConfirm: (name) => { state.name = name; save(); updateStaticUI(); }
        });
    });

    resetBtn.addEventListener('click', () => {
        if (!state) return;
        const ok = window.confirm(`Tem certeza que quer abandonar ${state.name} e começar um novo ovo?`);
        if (!ok) return;
        if (state.isAlive) {
            addHistory({
                name: state.name,
                days: Math.max(0, Math.floor(ageDays())),
                form: state.adultForm,
                cause: 'abandonado',
                endedAt: Date.now()
            });
        }
        startNewEgg(true);
    });

    /* ============================================================
       TIME / AGE
       ============================================================ */
    function ageDays() {
        if (!state || !state.hatchTime) return 0;
        return (Date.now() - state.hatchTime) / DAY_MS;
    }

    function isNightNow() {
        const h = new Date().getHours();
        return h >= 21 || h < 7;
    }

    /* ============================================================
       DECAY ENGINE
       ============================================================ */
    function applyDecay(deltaMs) {
        if (!state || !state.isAlive || deltaMs <= 0) return;

        if (state.stage === 'egg') {
            if (Date.now() - state.birthTime >= EGG_HATCH_MS) {
                state.stage = 'baby';
                state.hatchTime = Date.now();
                SND.hatch();
                showToastMsg('Chocou! 🐣', 2200);
            }
            state.lastUpdate = Date.now();
            return;
        }

        const deltaDays = deltaMs / DAY_MS;
        const hungerBefore = state.hunger;
        const happyBefore = state.happiness;

        state.hunger = clamp(state.hunger - RATES.hunger * deltaDays, 0, 100);
        let happyDecay = RATES.happiness * deltaDays;
        if (state.hunger < 20) happyDecay *= 1.6;
        if (state.hygiene < 20) happyDecay *= 1.3;
        if (state.isSick) happyDecay *= 1.4;
        if (!state.lightsOn && isNightNow()) happyDecay *= 0.3;
        else if (!state.lightsOn) happyDecay *= 1.5;
        state.happiness = clamp(state.happiness - happyDecay, 0, 100);

        const poopExpected = deltaMs / POOP_INTERVAL_MS;
        const newPoops = Math.floor(poopExpected) + (Math.random() < (poopExpected % 1) ? 1 : 0);
        if (newPoops > 0) state.poopCount = clamp(state.poopCount + newPoops, 0, MAX_POOP);
        let hygieneDecay = RATES.hygiene * deltaDays + newPoops * 15;
        state.hygiene = clamp(state.hygiene - hygieneDecay, 0, 100);

        if (state.lightsOn) {
            state.energy = clamp(state.energy - RATES.energyAwake * deltaDays, 0, 100);
        } else {
            state.energy = clamp(state.energy + RATES.energySleep * deltaDays, 0, 100);
        }

        state.discipline = clamp(state.discipline - RATES.discipline * deltaDays, 0, 100);

        if (!state.isSick) {
            const badness = (state.hunger < 25 || state.hygiene < 25);
            const lambda = (badness ? RATES.sickBad : RATES.sickBase) * deltaDays;
            const pSick = 1 - Math.exp(-lambda);
            if (Math.random() < pSick) {
                state.isSick = true;
                state.sicknessEpisodes += 1;
                SND.sick();
                showToastMsg('😷 Ficou doente!', 2200);
            }
        }

        if (state.isSick) {
            state.health = clamp(state.health - RATES.healthSick * deltaDays, 0, 100);
        } else if (state.hunger <= 0 || state.happiness <= 0) {
            state.health = clamp(state.health - RATES.healthNeglect * deltaDays, 0, 100);
        } else if (state.hunger > 40 && state.happiness > 40 && state.hygiene > 40) {
            state.health = clamp(state.health + RATES.healthRegen * deltaDays, 0, 100);
        }

        const avgHunger = (hungerBefore + state.hunger) / 2;
        const avgHappy = (happyBefore + state.happiness) / 2;
        const avgHygiene = state.hygiene;
        state.careSum += ((avgHunger + avgHappy + avgHygiene) / 3) * deltaDays;
        state.careDays += deltaDays;

        checkEvolution();

        if (state.health <= 0) {
            killPet('negligência');
            return;
        }

        state.lastUpdate = Date.now();
    }

    function checkEvolution() {
        const ad = ageDays();
        const idx = STAGE_ORDER.indexOf(state.stage);
        if (idx < STAGE_ORDER.indexOf('child') && ad >= STAGE_DAYS.child) {
            state.stage = 'child';
            SND.evolve();
            showToastMsg(`${state.name} evoluiu!`, 2400);
        }
        if (STAGE_ORDER.indexOf(state.stage) < STAGE_ORDER.indexOf('teen') && ad >= STAGE_DAYS.teen) {
            state.stage = 'teen';
            SND.evolve();
            showToastMsg(`${state.name} evoluiu!`, 2400);
        }
        if (STAGE_ORDER.indexOf(state.stage) < STAGE_ORDER.indexOf('adult') && ad >= STAGE_DAYS.adult) {
            state.stage = 'adult';
            const avgCare = state.careDays > 0 ? state.careSum / state.careDays : 60;
            const score = avgCare - state.sicknessEpisodes * 8;
            state.adultForm = score >= 65 ? 'good' : score >= 35 ? 'neutral' : 'bad';
            SND.evolve();
            showToastMsg(`${state.name} virou adulto!`, 2600);
        }
    }

    function killPet(cause) {
        state.isAlive = false;
        uiMode = 'idle';
        minigame = null;
        overlayEl.classList.add('hidden');
        toastEl.classList.remove('show');
        SND.death();
        addHistory({
            name: state.name,
            days: Math.max(0, Math.floor(ageDays())),
            form: state.adultForm,
            cause: cause,
            endedAt: Date.now()
        });
        save();
    }

    function catchUp() {
        if (!state) return;
        const now = Date.now();
        const delta = now - state.lastUpdate;
        if (delta <= 0) return;
        applyDecay(delta);
        save();
    }

    /* ============================================================
       ACTIONS
       ============================================================ */
    let toastTimer = null;
    function showToastMsg(text, ms) {
        toastEl.textContent = text;
        toastEl.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms || 1500);
    }

    function feedPet() {
        if (state.hunger >= 95) {
            state.happiness = clamp(state.happiness - 5, 0, 100);
            showToastMsg('Já está cheio! 🍽️', 1600);
            SND.cancel();
            return;
        }
        state.hunger = clamp(state.hunger + 30, 0, 100);
        state.happiness = clamp(state.happiness + 5, 0, 100);
        SND.feed();
        showToastMsg('Nhom nhom! 🍖', 1600);
    }

    function cleanPet() {
        if (state.poopCount <= 0 && state.hygiene >= 95) {
            showToastMsg('Já está limpo! ✨', 1400);
            SND.cancel();
            return;
        }
        state.poopCount = 0;
        state.hygiene = 100;
        state.happiness = clamp(state.happiness + 5, 0, 100);
        SND.clean();
        showToastMsg('Tudo limpo! 🧼', 1600);
    }

    function medicatePet() {
        if (!state.isSick) {
            showToastMsg('Não está doente', 1400);
            SND.cancel();
            return;
        }
        if (Math.random() < 0.7) {
            state.isSick = false;
            state.health = clamp(state.health + 20, 0, 100);
            SND.confirm();
            showToastMsg('Melhorou! 💊', 1800);
        } else {
            state.happiness = clamp(state.happiness - 5, 0, 100);
            SND.cancel();
            showToastMsg('Não gostou do remédio...', 1800);
        }
    }

    function toggleLight() {
        state.lightsOn = !state.lightsOn;
        SND.confirm();
        showToastMsg(state.lightsOn ? 'Luz acesa 💡' : 'Hora de dormir 😴', 1600);
    }

    function disciplinePet() {
        state.discipline = clamp(state.discipline + 15, 0, 100);
        state.happiness = clamp(state.happiness - 8, 0, 100);
        SND.confirm();
        showToastMsg('Repreendido ❗', 1600);
    }

    function wakeUp() {
        state.lightsOn = true;
        state.happiness = clamp(state.happiness - 3, 0, 100);
        SND.cancel();
        showToastMsg('Você acordou o bichinho...', 1600);
    }

    function petTouch() {
        const now = Date.now();
        if (now - state.lastTouch < 1500) return;
        state.lastTouch = now;
        state.happiness = clamp(state.happiness + 1, 0, 100);
        beep(1200, 0.04, 0, 0.03);
    }

    /* ============================================================
       INPUT
       ============================================================ */
    function handleButton(btn) {
        ensureAudio();
        if (!state) return;

        if (!state.isAlive) {
            if (btn === 'B') startNewEgg(true);
            return;
        }

        if (state.stage === 'egg') {
            if (btn === 'B') { eggWiggle = 1; beep(500, 0.05, 0, 0.04); }
            return;
        }

        if (!state.lightsOn) {
            wakeUp();
            return;
        }

        if (uiMode === 'minigame') { handleMinigameInput(btn); return; }
        if (uiMode === 'stats') {
            uiMode = 'idle';
            overlayEl.classList.add('hidden');
            SND.cancel();
            return;
        }

        if (uiMode === 'menu') {
            if (btn === 'A') {
                cursorIndex = (cursorIndex + 1) % ICONS.length;
                SND.tick();
                showToastMsg(ICONS[cursorIndex].label, 60000);
            } else if (btn === 'B') {
                activateIcon(ICONS[cursorIndex].id);
            } else if (btn === 'C') {
                uiMode = 'idle';
                toastEl.classList.remove('show');
                SND.cancel();
            }
            return;
        }

        // idle
        if (btn === 'A') {
            uiMode = 'menu';
            cursorIndex = 0;
            SND.tick();
            showToastMsg(ICONS[0].label, 60000);
        } else if (btn === 'B') {
            petTouch();
        }
    }

    function activateIcon(id) {
        if (id === 'play') {
            uiMode = 'minigame';
            toastEl.classList.remove('show');
            minigame = { phase: 'ready' };
            renderMinigameOverlay();
            return;
        }
        if (id === 'stats') {
            uiMode = 'stats';
            toastEl.classList.remove('show');
            renderStatsOverlay();
            return;
        }
        if (id === 'feed') feedPet();
        else if (id === 'clean') cleanPet();
        else if (id === 'medicine') medicatePet();
        else if (id === 'light') toggleLight();
        else if (id === 'discipline') disciplinePet();
        uiMode = 'idle';
        toastEl.classList.remove('show');
        save();
    }

    document.querySelectorAll('.tama-btn').forEach((b) => {
        b.addEventListener('click', () => handleButton(b.dataset.btn));
    });

    window.addEventListener('keydown', (e) => {
        const map = { a: 'A', A: 'A', '1': 'A', b: 'B', B: 'B', '2': 'B', Enter: 'B', c: 'C', C: 'C', '3': 'C', Escape: 'C' };
        const btn = map[e.key];
        if (!btn) return;
        e.preventDefault();
        const el = document.querySelector(`.tama-btn[data-btn="${btn}"]`);
        if (el) {
            el.classList.add('pressed');
            setTimeout(() => el.classList.remove('pressed'), 120);
        }
        handleButton(btn);
    });

    /* ============================================================
       MINIGAME - Pedra, Papel, Tesoura
       ============================================================ */
    const RPS_EMOJI = { r: '✊', p: '✋', s: '✌️' };
    const RPS_BEATS = { r: 's', p: 'r', s: 'p' };

    function renderMinigameOverlay() {
        overlayEl.classList.remove('hidden');
        if (minigame.phase === 'ready') {
            overlayEl.innerHTML = `
                <div class="ov-title">✊✋✌️</div>
                <div class="ov-sub">Pedra, Papel ou Tesoura</div>
                <div class="ov-sub">B para jogar · C cancela</div>
            `;
        } else if (minigame.phase === 'choosing') {
            overlayEl.innerHTML = `
                <div class="ov-title">ESCOLHA!</div>
                <div class="ov-sub">A = Pedra · B = Papel · C = Tesoura</div>
            `;
        } else if (minigame.phase === 'result') {
            const outcomeText = minigame.outcome === 'win' ? '🎉 VOCÊ VENCEU!' : minigame.outcome === 'lose' ? '😅 VOCÊ PERDEU' : '🤝 EMPATE';
            overlayEl.innerHTML = `
                <div class="ov-title">${RPS_EMOJI[minigame.player]} vs ${RPS_EMOJI[minigame.computer]}</div>
                <div class="ov-sub">${outcomeText}</div>
            `;
        }
    }

    function handleMinigameInput(btn) {
        if (minigame.phase === 'ready') {
            if (btn === 'B') {
                minigame.phase = 'choosing';
                SND.tick();
                renderMinigameOverlay();
            } else if (btn === 'C') {
                exitMinigame();
            }
            return;
        }
        if (minigame.phase === 'choosing') {
            const choiceMap = { A: 'r', B: 'p', C: 's' };
            const player = choiceMap[btn];
            if (!player) return;
            const computer = ['r', 'p', 's'][Math.floor(Math.random() * 3)];
            let outcome = 'tie';
            if (player !== computer) outcome = RPS_BEATS[player] === computer ? 'win' : 'lose';
            minigame.player = player;
            minigame.computer = computer;
            minigame.outcome = outcome;
            minigame.phase = 'result';
            if (outcome === 'win') {
                state.happiness = clamp(state.happiness + 15, 0, 100);
                SND.happy();
            } else if (outcome === 'lose') {
                state.happiness = clamp(state.happiness - 5, 0, 100);
                SND.sad();
            } else {
                state.happiness = clamp(state.happiness + 4, 0, 100);
                SND.tick();
            }
            save();
            renderMinigameOverlay();
            setTimeout(exitMinigame, 2000);
            return;
        }
        if (minigame.phase === 'result') {
            exitMinigame();
        }
    }

    function exitMinigame() {
        uiMode = 'idle';
        minigame = null;
        overlayEl.classList.add('hidden');
    }

    /* ============================================================
       STATS OVERLAY
       ============================================================ */
    function renderStatsOverlay() {
        overlayEl.classList.remove('hidden');
        const s = state;
        overlayEl.innerHTML = `
            <div class="ov-title">STATUS</div>
            <div class="ov-stats">
                Fase: ${stageName(s.stage, s.adultForm)}<br>
                Idade: ${Math.floor(ageDays())} dia(s)<br>
                Fome: ${Math.round(s.hunger)}%<br>
                Alegria: ${Math.round(s.happiness)}%<br>
                Higiene: ${Math.round(s.hygiene)}%<br>
                Saúde: ${Math.round(s.health)}%<br>
                Disciplina: ${Math.round(s.discipline)}%<br>
                ${s.isSick ? '⚠️ Doente' : '✔️ Saudável'}
            </div>
            <div class="ov-sub" style="margin-top:6px;">Aperte qualquer botão</div>
        `;
    }

    /* ============================================================
       UI TEXT SYNC (bars, labels)
       ============================================================ */
    function barClass(v) { return v <= 20 ? 'critical' : v <= 45 ? 'low' : ''; }

    function setBar(el, v) {
        el.style.width = clamp(v, 0, 100) + '%';
        el.className = 'stat-fill ' + barClass(v);
    }

    function stageName(stage, form) {
        if (stage === 'egg') return 'Ovo';
        if (stage === 'baby') return 'Bebê';
        if (stage === 'child') return 'Criança';
        if (stage === 'teen') return 'Adolescente';
        if (stage === 'adult') return `Adulto (${formLabel(form)})`;
        return stage;
    }

    let lastArcName = null;
    function renderNameArc(text) {
        if (text === lastArcName) return;
        lastArcName = text;
        nameArcEl.innerHTML = '';
        const chars = text.split('');
        const n = chars.length;
        const step = n > 1 ? Math.min(11, 60 / (n - 1)) : 0;
        const startAngle = -((n - 1) * step) / 2;
        chars.forEach((ch, i) => {
            const span = document.createElement('span');
            span.textContent = ch === ' ' ? ' ' : ch;
            span.style.transform = `rotate(${startAngle + i * step}deg)`;
            nameArcEl.appendChild(span);
        });
    }

    function updateStaticUI() {
        if (!state) return;
        renderNameArc(state.isAlive ? state.name.toUpperCase() : `${state.name.toUpperCase()} +`);
        setBar(barHunger, state.hunger);
        setBar(barHappiness, state.happiness);
        setBar(barHygiene, state.hygiene);
        setBar(barHealth, state.health);
        stageLabel.textContent = stageName(state.stage, state.adultForm);
        ageLabel.textContent = 'Dia ' + Math.floor(ageDays());
    }

    /* ============================================================
       CANVAS DRAW PRIMITIVES
       ============================================================ */
    function rect(gx, gy, gw, gh) {
        ctx.fillRect(Math.round(gx * PIX), Math.round(gy * PIX), Math.round(gw * PIX), Math.round(gh * PIX));
    }

    function clearRectG(gx, gy, gw, gh) {
        ctx.clearRect(Math.round(gx * PIX), Math.round(gy * PIX), Math.round(gw * PIX), Math.round(gh * PIX));
    }

    function fillEllipse(cx, cy, rx, ry) {
        const top = Math.floor(cy - ry);
        const bottom = Math.ceil(cy + ry);
        for (let gy = top; gy <= bottom; gy++) {
            const ny = (gy + 0.5 - cy) / ry;
            if (Math.abs(ny) > 1) continue;
            const dx = rx * Math.sqrt(1 - ny * ny);
            const xStart = Math.round(cx - dx);
            const xEnd = Math.round(cx + dx);
            if (xEnd > xStart) rect(xStart, gy, xEnd - xStart, 1);
        }
    }

    function clearEllipse(cx, cy, rx, ry) {
        const top = Math.floor(cy - ry);
        const bottom = Math.ceil(cy + ry);
        for (let gy = top; gy <= bottom; gy++) {
            const ny = (gy + 0.5 - cy) / ry;
            if (Math.abs(ny) > 1) continue;
            const dx = rx * Math.sqrt(1 - ny * ny);
            const xStart = Math.round(cx - dx);
            const xEnd = Math.round(cx + dx);
            if (xEnd > xStart) clearRectG(xStart, gy, xEnd - xStart, 1);
        }
    }

    function triUp(cx, topY, h) {
        for (let r = 0; r < h; r++) {
            const w = h - r;
            rect(cx - w / 2, topY + r, w, 1);
        }
    }

    /* ============================================================
       SPRITES
       ============================================================ */
    const STAGE_SIZE = {
        baby: { rx: 9, ry: 8, legW: 3, legH: 3, spikes: 2, spikeH: 2, tail: 3, arms: false },
        child: { rx: 12, ry: 10, legW: 3, legH: 4, spikes: 3, spikeH: 3, tail: 4, arms: false },
        teen: { rx: 15, ry: 12, legW: 4, legH: 5, spikes: 4, spikeH: 4, tail: 6, arms: true },
        adult: { rx: 18, ry: 14, legW: 5, legH: 6, spikes: 5, spikeH: 5, tail: 8, arms: true }
    };

    function drawFloor() {
        ctx.fillStyle = ink;
        rect(4, FLOOR_Y, 56, 1);
    }

    function drawPoops(count) {
        ctx.fillStyle = ink;
        const slotsLeft = [7, 12];
        const slotsRight = [57, 52];
        for (let i = 0; i < count; i++) {
            const x = i < 2 ? slotsLeft[i] : slotsRight[i - 2];
            fillEllipse(x, FLOOR_Y - 1.2, 1.6, 1.2);
            fillEllipse(x, FLOOR_Y - 2.6, 1.1, 0.9);
        }
    }

    function drawStatusPips(hunger, happiness) {
        ctx.fillStyle = ink;
        const hCount = Math.ceil(clamp(happiness, 0, 100) / 25);
        const fCount = Math.ceil(clamp(hunger, 0, 100) / 25);
        for (let i = 0; i < 4; i++) {
            const x = 8 + i * 3.4;
            if (i < hCount) rect(x, 3, 2.2, 2.2);
            else { rect(x, 3, 2.2, 2.2); clearRectG(x + 0.35, 3.35, 1.5, 1.5); }
        }
        for (let i = 0; i < 4; i++) {
            const x = 56 - i * 3.4;
            if (i < fCount) rect(x, 3, 2.2, 2.2);
            else { rect(x, 3, 2.2, 2.2); clearRectG(x + 0.35, 3.35, 1.5, 1.5); }
        }
    }

    function moodFor() {
        if (!state.isAlive) return 'angel';
        if (state.isSick) return 'sick';
        if (!state.lightsOn) return 'sleep';
        if (state.stage === 'adult') {
            if (state.adultForm === 'good') return 'good';
            if (state.adultForm === 'bad') return 'bad';
            return 'neutral';
        }
        if (state.happiness < 30 || state.hunger < 25) return 'bad';
        if (state.happiness > 70 && state.hunger > 60) return 'good';
        return 'neutral';
    }

    function drawDino(size, mood, phase, eating) {
        const bounce = mood === 'good' ? Math.abs(Math.sin(phase)) * 1.4 : Math.sin(phase * 0.5) * 0.4;
        const cx = 32;
        const bodyBottom = FLOOR_Y - size.legH;
        const cy = bodyBottom - size.rx * 0 - size.ry - bounce;

        ctx.fillStyle = ink;

        // legs
        const legY = FLOOR_Y - size.legH;
        const legOffset = size.rx * 0.45;
        const legAnim = Math.sin(phase * 1.6) * 0.6;
        rect(cx - legOffset - size.legW / 2, legY, size.legW, size.legH + (mood === 'sleep' ? 0 : legAnim));
        rect(cx + legOffset - size.legW / 2, legY, size.legW, size.legH - (mood === 'sleep' ? 0 : legAnim));

        // arms
        if (size.arms) {
            const armY = cy - size.ry * 0.1;
            const armLift = mood === 'good' ? 3 : mood === 'bad' ? -1 : 1;
            rect(cx - size.rx - 1, armY - armLift, 2.4, 2.4);
            rect(cx + size.rx - 1.4, armY - armLift, 2.4, 2.4);
        }

        // tail
        const tailDir = mood === 'bad' ? 1 : -1;
        for (let i = 0; i < size.tail; i++) {
            const t = i / size.tail;
            const tx = cx + size.rx - 2 + i * 0.9;
            const ty = cy + size.ry * 0.35 + tailDir * i * 0.55;
            rect(tx, ty, Math.max(1, 2.2 - t * 1.4), Math.max(1, 2.2 - t * 1.4));
        }

        // body
        fillEllipse(cx, cy, size.rx, size.ry);

        // spikes
        const topY = cy - size.ry;
        for (let i = 0; i < size.spikes; i++) {
            const t = (i + 0.5) / size.spikes;
            const sx = cx - size.rx * 0.65 + t * size.rx * 1.3;
            const sy = topY + Math.sqrt(Math.max(0, 1 - Math.pow((sx - cx) / size.rx, 2))) * 0 + 1.5;
            triUp(sx, sy - size.spikeH, size.spikeH);
        }

        // belly shade line
        clearRectG(cx - size.rx * 0.5, cy + size.ry * 0.35, size.rx, 1);

        // eyes
        const eyeY = cy - size.ry * 0.12;
        const eyeDX = size.rx * 0.38;
        const blink = Math.sin(phase * 0.35) > 0.96;
        if (mood === 'sleep') {
            rect(cx - eyeDX - 1.3, eyeY, 2.6, 0.9);
            rect(cx + eyeDX - 1.3, eyeY, 2.6, 0.9);
        } else if (mood === 'sick') {
            clearRectG(cx - eyeDX - 1.6, eyeY - 1.6, 3.2, 3.2);
            clearRectG(cx + eyeDX - 1.6, eyeY - 1.6, 3.2, 3.2);
        } else if (mood === 'angel') {
            rect(cx - eyeDX - 1, eyeY, 2, 0.8);
            rect(cx + eyeDX - 1, eyeY, 2, 0.8);
        } else if (!blink) {
            clearEllipse(cx - eyeDX, eyeY, 1.8, 2.2);
            clearEllipse(cx + eyeDX, eyeY, 1.8, 2.2);
        }

        // eyebrows for bad mood
        if (mood === 'bad') {
            rect(cx - eyeDX - 2, eyeY - 3, 3, 1);
            rect(cx + eyeDX - 1, eyeY - 3, 3, 1);
        }

        // mouth
        const mouthY = cy + size.ry * 0.45;
        if (eating) {
            clearRectG(cx - 2.5, mouthY - 1, 5, 3);
        } else if (mood === 'good' || mood === 'angel') {
            clearRectG(cx - 2, mouthY, 4, 1);
            clearRectG(cx - 3, mouthY - 1, 1.4, 1.4);
            clearRectG(cx + 1.6, mouthY - 1, 1.4, 1.4);
        } else if (mood === 'bad' || mood === 'sick') {
            clearRectG(cx - 2, mouthY + 1, 4, 1);
            clearRectG(cx - 3, mouthY, 1.4, 1.4);
            clearRectG(cx + 1.6, mouthY, 1.4, 1.4);
        } else if (mood !== 'sleep') {
            clearRectG(cx - 1.2, mouthY, 2.4, 1);
        }

        // sparkle for good adult
        if (mood === 'good' && state.stage === 'adult') {
            const sparkleY = topY - 5 + Math.sin(phase * 2) * 1.2;
            const sx = cx + size.rx * 0.7;
            rect(sx, sparkleY, 1, 2.4);
            rect(sx - 1, sparkleY + 0.7, 3, 1);
        }

        // Zzz for sleeping
        if (mood === 'sleep') {
            const zY = topY - 4 - ((phase * 6) % 8);
            ctx.fillStyle = ink;
            rect(cx + size.rx * 0.6, zY, 3, 1);
            rect(cx + size.rx * 0.6 + 2, zY + 1, -3, 1);
            rect(cx + size.rx * 0.6, zY + 2, 3, 1);
        }

        // sweat drop for sick
        if (mood === 'sick') {
            fillEllipse(cx + size.rx * 0.75, cy - size.ry * 0.4, 1.1, 1.6);
        }
    }

    function drawEgg(phase) {
        const cx = 32, cy = FLOOR_Y - 15;
        const wiggleX = eggWiggle > 0 ? Math.sin(phase * 6) * eggWiggle * 2 : 0;
        ctx.fillStyle = ink;
        fillEllipse(cx + wiggleX, cy, 13, 15);
        clearEllipse(cx - 5 + wiggleX, cy - 4, 1.6, 1.6);
        clearEllipse(cx + 5 + wiggleX, cy + 2, 1.4, 1.4);
        clearEllipse(cx - 2 + wiggleX, cy + 7, 1.3, 1.3);
        if (eggWiggle > 0) eggWiggle = Math.max(0, eggWiggle - 0.05);

        const eggAge = Date.now() - state.birthTime;
        if (eggAge > EGG_HATCH_MS * 0.6) {
            clearRectG(cx - 6 + wiggleX, cy - 1, 3, 1);
            clearRectG(cx - 3 + wiggleX, cy - 2, 3, 1);
            clearRectG(cx + wiggleX, cy - 1, 3, 1);
            clearRectG(cx + 3 + wiggleX, cy, 3, 1);
        }
    }

    function drawAngelScene(phase) {
        const cx = 32, cy = 18 + Math.sin(phase * 0.8) * 2;
        ctx.fillStyle = ink;
        fillEllipse(cx, cy, 9, 8);
        clearEllipse(cx - 3, cy - 1, 1.6, 1.8);
        clearEllipse(cx + 3, cy - 1, 1.6, 1.8);
        clearRectG(cx - 2, cy + 3, 4, 1);
        // halo
        rect(cx - 4, cy - 12, 8, 1.2);
        // wings
        fillEllipse(cx - 10, cy, 4, 6);
        fillEllipse(cx + 10, cy, 4, 6);
        // sparkles
        [[10, -6], [-14, 4], [16, 8]].forEach(([dx, dy], i) => {
            const s = (Math.sin(phase * 2 + i) + 1) / 2;
            if (s > 0.4) {
                rect(cx + dx, cy + dy, 1, 1);
            }
        });
    }

    function drawMenuIcon(type, cx, cy, active) {
        ctx.fillStyle = ink;
        if (type === 'feed') {
            rect(cx - 4, cy + 1, 8, 2);
            rect(cx - 3, cy - 1, 6, 1.5);
            rect(cx - 1, cy - 4, 0.8, 2);
        } else if (type === 'play') {
            fillEllipse(cx, cy, 3.6, 3.6);
            clearRectG(cx - 3.6, cy - 0.4, 7.2, 0.8);
            clearRectG(cx - 0.4, cy - 3.6, 0.8, 7.2);
        } else if (type === 'clean') {
            triUp(cx, cy - 4, 4);
            fillEllipse(cx, cy + 1.5, 3, 2.6);
        } else if (type === 'medicine') {
            rect(cx - 0.9, cy - 3.5, 1.8, 7);
            rect(cx - 3.5, cy - 0.9, 7, 1.8);
        } else if (type === 'light') {
            fillEllipse(cx, cy - 1, 3, 3);
            rect(cx - 1, cy + 2, 2, 1.6);
            if (active) {
                rect(cx - 5.5, cy - 3.5, 1.4, 1.4);
                rect(cx + 4, cy - 3.5, 1.4, 1.4);
            }
        } else if (type === 'discipline') {
            rect(cx - 0.9, cy - 4.5, 1.8, 5);
            rect(cx - 0.9, cy + 1.5, 1.8, 1.8);
        } else if (type === 'stats') {
            rect(cx - 3.5, cy + 1, 2, 3);
            rect(cx - 0.5, cy - 1.5, 2, 5.5);
            rect(cx + 2.5, cy - 3.5, 2, 7.5);
        }
    }

    function drawMenuBar() {
        ICONS.forEach((icon, i) => {
            drawMenuIcon(icon.id, icon.cx, icon.cy, i === cursorIndex);
        });
        const cur = ICONS[cursorIndex];
        const blink = Math.sin(Date.now() / 220) > 0;
        if (blink) {
            ctx.fillStyle = ink;
            const r = 5.2;
            rect(cur.cx - r, cur.cy - r, r * 2, 0.8);
            rect(cur.cx - r, cur.cy + r - 0.8, r * 2, 0.8);
            rect(cur.cx - r, cur.cy - r, 0.8, r * 2);
            rect(cur.cx + r - 0.8, cur.cy - r, 0.8, r * 2);
        }
    }

    /* ============================================================
       MAIN RENDER
       ============================================================ */
    function render(ts) {
        if (!state) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const phase = ts / 260;

        if (!state.isAlive) {
            drawAngelScene(phase);
            drawFloor();
            return;
        }

        if (state.stage === 'egg') {
            drawEgg(phase);
            drawFloor();
            return;
        }

        drawFloor();
        drawPoops(state.poopCount);

        const size = STAGE_SIZE[state.stage];
        const mood = moodFor();
        drawDino(size, mood, phase, false);

        if (uiMode !== 'menu' && uiMode !== 'minigame' && uiMode !== 'stats') {
            drawStatusPips(state.hunger, state.happiness);
        }

        if (uiMode === 'menu') {
            drawMenuBar();
        }
    }

    function loop(ts) {
        if (ts - lastRenderTime >= RENDER_MS) {
            lastRenderTime = ts;
            render(ts);
        }
        requestAnimationFrame(loop);
    }

    /* ============================================================
       GAME LOOP / LIFECYCLE
       ============================================================ */
    function tick() {
        if (!state) return;
        applyDecay(Date.now() - state.lastUpdate);
        updateStaticUI();
        save();
    }

    function init() {
        renderHistory();
        if (!state) {
            state = null;
            requestAnimationFrame(loop);
            startNewEgg(false);
            return;
        }
        catchUp();
        updateStaticUI();
        requestAnimationFrame(loop);
    }

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') { catchUp(); updateStaticUI(); }
    });
    window.addEventListener('focus', () => { catchUp(); updateStaticUI(); });
    window.addEventListener('beforeunload', save);

    setInterval(tick, DECAY_MS);
    init();
})();
