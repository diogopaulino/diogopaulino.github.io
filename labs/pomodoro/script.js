/* =========================================================
   Pomodoro - Labs
   Timer baseado em timestamp (imune ao throttling de aba),
   tarefas, estatísticas, sons sintetizados e notificações.
   ========================================================= */

(function () {
    'use strict';

    const KEYS = {
        settings: 'pomodoro:settings',
        tasks: 'pomodoro:tasks',
        stats: 'pomodoro:stats',
        state: 'pomodoro:state',
        legacy: 'pomodoro-settings'
    };

    const DEFAULTS = {
        focus: 25,
        short: 5,
        long: 15,
        interval: 4,
        autoBreak: false,
        autoPomodoro: false,
        wakeLock: false,
        alarm: 'bell',
        volume: 70,
        muted: false,
        ticking: false,
        notifications: true,
        askedNotifications: false
    };

    const LIMITS = {
        focus: [1, 180],
        short: [1, 60],
        long: [1, 90],
        interval: [2, 12]
    };

    /* Título estático da página, preservado em toda atualização da aba. */
    const BASE_TITLE = document.title;

    const MODES = {
        focus: { label: 'Foco', badge: 'Foco', title: 'Foco' },
        short: { label: 'Pausa curta', badge: 'Pausa curta', title: 'Pausa' },
        long: { label: 'Pausa longa', badge: 'Pausa longa', title: 'Pausa' }
    };

    const RING_CIRCUMFERENCE = 2 * Math.PI * 88;
    const TICK_MS = 250;
    const STATS_HISTORY_DAYS = 60;
    const WEEK_LABELS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

    /* ---------------------------------------------------------
       Armazenamento tolerante a falhas (modo privado, cotas)
       --------------------------------------------------------- */
    const store = {
        read(key, fallback) {
            try {
                const raw = localStorage.getItem(key);
                if (!raw) return fallback;
                const parsed = JSON.parse(raw);
                return parsed === null || parsed === undefined ? fallback : parsed;
            } catch (err) {
                return fallback;
            }
        },
        write(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
            } catch (err) {
                /* Storage indisponível: o app segue funcionando em memória. */
            }
        },
        remove(key) {
            try {
                localStorage.removeItem(key);
            } catch (err) {
                /* noop */
            }
        }
    };

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

    const toInt = (value, fallback, [min, max]) => {
        const parsed = parseInt(value, 10);
        return Number.isFinite(parsed) ? clamp(parsed, min, max) : fallback;
    };

    const dayKey = (date) => {
        const d = date || new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    /* ---------------------------------------------------------
       Sons sintetizados via Web Audio (sem arquivos externos)
       --------------------------------------------------------- */
    class SoundKit {
        constructor() {
            this.ctx = null;
            this.master = null;
            this.volume = 0.7;
            this.muted = false;
        }

        unlock() {
            if (!this.ctx) {
                const Ctx = window.AudioContext || window.webkitAudioContext;
                if (!Ctx) return null;
                this.ctx = new Ctx();
                this.master = this.ctx.createGain();
                this.master.gain.value = this.volume;
                this.master.connect(this.ctx.destination);
            }
            if (this.ctx.state === 'suspended') this.ctx.resume();
            return this.ctx;
        }

        setVolume(percent) {
            this.volume = clamp(percent, 0, 100) / 100;
            if (this.master) this.master.gain.value = this.volume;
        }

        setMuted(muted) {
            this.muted = !!muted;
        }

        get enabled() {
            return !this.muted && this.volume > 0;
        }

        tone({ freq = 440, type = 'sine', at = 0, duration = 0.4, gain = 0.3, sweepTo = null }) {
            const ctx = this.ctx;
            if (!ctx) return;

            const start = ctx.currentTime + at;
            const osc = ctx.createOscillator();
            const env = ctx.createGain();

            osc.type = type;
            osc.frequency.setValueAtTime(freq, start);
            if (sweepTo) osc.frequency.exponentialRampToValueAtTime(sweepTo, start + duration);

            env.gain.setValueAtTime(0.0001, start);
            env.gain.exponentialRampToValueAtTime(gain, start + 0.012);
            env.gain.exponentialRampToValueAtTime(0.0001, start + duration);

            osc.connect(env);
            env.connect(this.master);
            osc.start(start);
            osc.stop(start + duration + 0.05);
        }

        noise({ at = 0, duration = 1.2, gain = 0.2, cutoff = 900 }) {
            const ctx = this.ctx;
            if (!ctx) return;

            const start = ctx.currentTime + at;
            const frames = Math.floor(ctx.sampleRate * duration);
            const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < frames; i += 1) {
                data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
            }

            const src = ctx.createBufferSource();
            src.buffer = buffer;

            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = cutoff;

            const env = ctx.createGain();
            env.gain.setValueAtTime(gain, start);
            env.gain.exponentialRampToValueAtTime(0.0001, start + duration);

            src.connect(filter);
            filter.connect(env);
            env.connect(this.master);
            src.start(start);
        }

        alarm(kind) {
            if (!this.enabled || kind === 'none') return;
            if (!this.unlock()) return;

            switch (kind) {
                case 'marimba':
                    [523.25, 659.25, 783.99].forEach((freq, i) => {
                        this.tone({ freq, type: 'sine', at: i * 0.16, duration: 0.5, gain: 0.32 });
                        this.tone({ freq: freq * 2, type: 'sine', at: i * 0.16, duration: 0.25, gain: 0.1 });
                    });
                    break;
                case 'digital':
                    for (let i = 0; i < 3; i += 1) {
                        this.tone({ freq: 1180, type: 'square', at: i * 0.22, duration: 0.11, gain: 0.16 });
                    }
                    break;
                case 'gong':
                    this.tone({ freq: 174, type: 'sine', at: 0, duration: 2.6, gain: 0.34 });
                    this.tone({ freq: 261, type: 'sine', at: 0.02, duration: 2.2, gain: 0.16 });
                    this.noise({ at: 0, duration: 1.6, gain: 0.14, cutoff: 700 });
                    break;
                case 'bell':
                default:
                    for (let i = 0; i < 2; i += 1) {
                        const at = i * 0.55;
                        this.tone({ freq: 880, type: 'sine', at, duration: 1.5, gain: 0.3 });
                        this.tone({ freq: 1320, type: 'sine', at, duration: 0.9, gain: 0.12 });
                        this.tone({ freq: 2640, type: 'sine', at, duration: 0.35, gain: 0.05 });
                    }
                    break;
            }
        }

        click() {
            if (!this.enabled || !this.ctx) return;
            this.tone({ freq: 660, type: 'triangle', duration: 0.06, gain: 0.06, sweepTo: 440 });
        }

        tick() {
            if (!this.enabled || !this.ctx) return;
            this.tone({ freq: 1000, type: 'sine', duration: 0.03, gain: 0.035 });
        }
    }

    /* ---------------------------------------------------------
       App
       --------------------------------------------------------- */
    class PomodoroApp {
        constructor() {
            this.el = {
                body: document.body,
                time: document.getElementById('time-display'),
                badge: document.getElementById('status-badge'),
                cycle: document.getElementById('cycle-count'),
                cycleTotal: document.getElementById('cycle-total'),
                ring: document.querySelector('.ring-progress'),
                toggle: document.getElementById('btn-toggle'),
                toggleLabel: document.getElementById('toggle-label'),
                reset: document.getElementById('btn-reset'),
                skip: document.getElementById('btn-skip'),
                modeBtns: Array.from(document.querySelectorAll('.mode-btn')),
                activeTask: document.getElementById('active-task'),
                activeTaskName: document.getElementById('active-task-name'),
                soundBtn: document.getElementById('btn-sound'),
                settingsBtn: document.getElementById('btn-settings'),
                modal: document.getElementById('settings-modal'),
                modalContent: document.querySelector('.modal-content'),
                saveBtn: document.getElementById('btn-save-settings'),
                taskForm: document.getElementById('task-form'),
                taskInput: document.getElementById('task-input'),
                taskEstimate: document.getElementById('task-estimate'),
                taskList: document.getElementById('task-list'),
                tasksEmpty: document.getElementById('tasks-empty'),
                taskSummary: document.getElementById('task-summary'),
                clearDone: document.getElementById('btn-clear-done'),
                statToday: document.getElementById('stat-today'),
                statTime: document.getElementById('stat-time'),
                statStreak: document.getElementById('stat-streak'),
                statTotal: document.getElementById('stat-total'),
                chart: document.getElementById('week-chart'),
                toasts: document.getElementById('toast-region'),
                live: document.getElementById('live-region'),
                notificationStatus: document.getElementById('notification-status'),
                volumeValue: document.getElementById('volume-value'),
                inputs: {
                    focus: document.getElementById('setting-focus'),
                    short: document.getElementById('setting-short'),
                    long: document.getElementById('setting-long'),
                    interval: document.getElementById('setting-interval'),
                    autoBreak: document.getElementById('setting-auto-break'),
                    autoPomodoro: document.getElementById('setting-auto-pomodoro'),
                    wakeLock: document.getElementById('setting-wake-lock'),
                    alarm: document.getElementById('setting-alarm'),
                    volume: document.getElementById('setting-volume'),
                    ticking: document.getElementById('setting-ticking'),
                    notifications: document.getElementById('setting-notifications')
                }
            };

            this.sound = new SoundKit();
            this.settings = this.loadSettings();
            this.tasks = store.read(KEYS.tasks, []);
            this.activeTaskId = null;
            this.stats = this.loadStats();

            this.mode = 'focus';
            this.round = 0;
            this.running = false;
            this.remaining = this.settings.focus * 60000;
            this.endsAt = 0;
            this.timerId = null;
            this.completionId = null;
            this.tickSecond = -1;
            this.lastTitle = '';
            this.lastFaviconStep = -1;
            this.wakeLockSentinel = null;
            this.lastFocusedElement = null;
            this.pendingAwayMessage = false;

            this.sound.setVolume(this.settings.volume);
            this.sound.setMuted(this.settings.muted);

            this.restoreState();
            this.bindEvents();
            this.renderAll();

            if (this.running) {
                this.startLoop();
                this.requestWakeLock();
            }
        }

        /* ------------------------- dados ------------------------- */

        loadSettings() {
            const legacy = store.read(KEYS.legacy, null);
            if (legacy) {
                store.write(KEYS.settings, Object.assign({}, DEFAULTS, legacy));
                store.remove(KEYS.legacy);
            }
            const saved = store.read(KEYS.settings, {});
            const merged = Object.assign({}, DEFAULTS, saved);

            Object.keys(LIMITS).forEach((key) => {
                merged[key] = toInt(merged[key], DEFAULTS[key], LIMITS[key]);
            });
            merged.volume = toInt(merged.volume, DEFAULTS.volume, [0, 100]);
            merged.alarm = ['bell', 'marimba', 'digital', 'gong', 'none'].includes(merged.alarm)
                ? merged.alarm
                : DEFAULTS.alarm;

            return merged;
        }

        persistSettings() {
            store.write(KEYS.settings, this.settings);
        }

        loadStats() {
            const stats = store.read(KEYS.stats, { days: {}, total: 0, minutes: 0 });
            if (!stats.days || typeof stats.days !== 'object') stats.days = {};
            stats.total = Number(stats.total) || 0;
            stats.minutes = Number(stats.minutes) || 0;

            // Mantém o histórico enxuto no localStorage.
            const limit = new Date();
            limit.setDate(limit.getDate() - STATS_HISTORY_DAYS);
            Object.keys(stats.days).forEach((key) => {
                if (new Date(`${key}T00:00:00`) < limit) delete stats.days[key];
            });

            return stats;
        }

        persistStats() {
            store.write(KEYS.stats, this.stats);
        }

        persistTasks() {
            store.write(KEYS.tasks, this.tasks);
        }

        persistState() {
            store.write(KEYS.state, {
                mode: this.mode,
                round: this.round,
                running: this.running,
                remaining: this.remaining,
                endsAt: this.endsAt,
                activeTaskId: this.activeTaskId,
                savedAt: Date.now()
            });
        }

        restoreState() {
            const saved = store.read(KEYS.state, null);
            if (!saved || !MODES[saved.mode]) {
                this.remaining = this.durationFor(this.mode);
                return;
            }

            this.mode = saved.mode;
            this.round = clamp(Number(saved.round) || 0, 0, this.settings.interval);
            this.activeTaskId = this.tasks.some((task) => task.id === saved.activeTaskId)
                ? saved.activeTaskId
                : null;

            const total = this.durationFor(this.mode);

            if (saved.running && saved.endsAt) {
                const left = saved.endsAt - Date.now();
                if (left > 0) {
                    this.remaining = Math.min(left, total);
                    this.endsAt = saved.endsAt;
                    this.running = true;
                    return;
                }
                // O ciclo terminou com a aba fechada: contabiliza e avança.
                this.remaining = 0;
                this.completeSession({ silent: true, autoStart: false });
                this.pendingAwayMessage = true;
                return;
            }

            this.remaining = clamp(Number(saved.remaining) || total, 0, total) || total;
        }

        durationFor(mode) {
            return this.settings[mode] * 60000;
        }

        /* ------------------------- eventos ------------------------- */

        bindEvents() {
            this.el.toggle.addEventListener('click', () => {
                this.sound.unlock();
                this.toggle();
            });

            this.el.reset.addEventListener('click', () => {
                this.sound.unlock();
                this.sound.click();
                this.resetTimer();
                this.toast('Ciclo reiniciado');
            });

            this.el.skip.addEventListener('click', () => {
                this.sound.unlock();
                this.sound.click();
                this.skipSession();
            });

            this.el.modeBtns.forEach((btn) => {
                btn.addEventListener('click', () => {
                    this.sound.unlock();
                    this.sound.click();
                    this.switchMode(btn.dataset.mode, { manual: true });
                });
            });

            this.el.soundBtn.addEventListener('click', () => {
                this.settings.muted = !this.settings.muted;
                this.sound.setMuted(this.settings.muted);
                this.persistSettings();
                this.renderSoundButton();
                if (!this.settings.muted) {
                    this.sound.unlock();
                    this.sound.click();
                }
                this.toast(this.settings.muted ? 'Som desativado' : 'Som ativado');
            });

            // Configurações
            this.el.settingsBtn.addEventListener('click', () => this.openSettings());
            this.el.saveBtn.addEventListener('click', () => this.saveSettings());
            this.el.modal.querySelectorAll('[data-close-modal]').forEach((node) => {
                node.addEventListener('click', () => this.closeSettings());
            });
            this.el.modal.addEventListener('keydown', (event) => this.handleModalKeydown(event));

            this.el.inputs.volume.addEventListener('input', (event) => {
                const value = Number(event.target.value);
                this.el.volumeValue.textContent = `${value}%`;
                this.sound.setVolume(value);
            });

            this.el.inputs.notifications.addEventListener('change', (event) => {
                if (event.target.checked) this.enableNotifications(event.target);
                else this.renderNotificationStatus();
            });

            document.getElementById('btn-test-sound').addEventListener('click', () => {
                this.sound.unlock();
                this.sound.setMuted(false);
                this.sound.alarm(this.el.inputs.alarm.value);
                this.sound.setMuted(this.settings.muted);
            });

            document.getElementById('btn-reset-settings').addEventListener('click', () => {
                this.settings = Object.assign({}, DEFAULTS, { muted: this.settings.muted });
                this.persistSettings();
                this.fillSettingsForm();
                this.sound.setVolume(this.settings.volume);
                this.applySettingsToTimer();
                this.toast('Configurações restauradas');
            });

            document.getElementById('btn-clear-stats').addEventListener('click', () => {
                this.stats = { days: {}, total: 0, minutes: 0 };
                this.persistStats();
                this.renderStats();
                this.toast('Estatísticas apagadas');
            });

            // Tarefas
            this.el.taskForm.addEventListener('submit', (event) => {
                event.preventDefault();
                this.addTask();
            });
            this.el.taskList.addEventListener('click', (event) => this.handleTaskClick(event));
            this.el.clearDone.addEventListener('click', () => {
                this.tasks = this.tasks.filter((task) => !task.done);
                if (!this.tasks.some((task) => task.id === this.activeTaskId)) this.activeTaskId = null;
                this.persistTasks();
                this.renderTasks();
                this.toast('Tarefas concluídas removidas');
            });

            // Atalhos de teclado
            document.addEventListener('keydown', (event) => this.handleShortcut(event));

            // A aba voltou: sincroniza o relógio e o wake lock
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) return;
                this.syncFromTimestamp();
                if (this.running) this.requestWakeLock();
            });

            window.addEventListener('pagehide', () => this.persistState());
        }

        /* ------------------------- timer ------------------------- */

        toggle() {
            if (this.running) this.pause();
            else this.start();
        }

        start() {
            if (this.running) return;
            if (this.remaining <= 0) this.remaining = this.durationFor(this.mode);

            this.running = true;
            this.endsAt = Date.now() + this.remaining;
            this.tickSecond = -1;
            this.sound.click();
            this.askNotificationsOnce();
            this.startLoop();
            this.requestWakeLock();
            this.renderControls();
            this.persistState();
            this.announce(`${MODES[this.mode].label} iniciado`);
        }

        pause() {
            if (!this.running) return;
            this.syncFromTimestamp();
            this.running = false;
            this.stopLoop();
            this.releaseWakeLock();
            this.sound.click();
            this.renderControls();
            this.renderTime();
            this.persistState();
            this.announce('Cronômetro pausado');
        }

        startLoop() {
            this.stopLoop();
            this.timerId = setInterval(() => this.tick(), TICK_MS);
            // Abas em segundo plano sofrem throttling do setInterval; este timeout
            // único costuma acordar mais perto do fim real do ciclo.
            this.completionId = setTimeout(() => this.syncFromTimestamp(), Math.max(0, this.remaining) + 60);
        }

        stopLoop() {
            if (this.timerId) clearInterval(this.timerId);
            if (this.completionId) clearTimeout(this.completionId);
            this.timerId = null;
            this.completionId = null;
        }

        tick() {
            const left = this.endsAt - Date.now();
            this.remaining = Math.max(0, left);

            const second = Math.ceil(this.remaining / 1000);
            if (second !== this.tickSecond) {
                this.tickSecond = second;
                if (this.settings.ticking && this.mode === 'focus' && second > 0) this.sound.tick();
            }

            this.renderTime();

            if (left <= 0) this.completeSession({});
        }

        syncFromTimestamp() {
            if (!this.running) return;
            this.remaining = Math.max(0, this.endsAt - Date.now());
            if (this.remaining === 0) this.completeSession({});
            else this.renderTime();
        }

        resetTimer() {
            this.stopLoop();
            this.running = false;
            this.releaseWakeLock();
            this.remaining = this.durationFor(this.mode);
            this.renderControls();
            this.renderTime({ jump: true });
            this.persistState();
        }

        switchMode(mode, options = {}) {
            if (!MODES[mode]) return;

            this.stopLoop();
            this.running = false;
            this.releaseWakeLock();
            this.mode = mode;
            this.remaining = this.durationFor(mode);

            this.renderMode();
            this.renderControls();
            this.renderTime({ jump: true });
            this.persistState();

            if (options.manual) this.announce(`Modo ${MODES[mode].label}`);

            if (options.autoStart) this.start();
        }

        skipSession() {
            const next = this.nextMode();
            if (this.mode === 'long') this.round = 0;
            this.switchMode(next, { manual: false });
            this.renderCycle();
            this.toast(`Pulou para ${MODES[next].label.toLowerCase()}`);
        }

        nextMode() {
            if (this.mode !== 'focus') return 'focus';
            const done = this.round + 1;
            return done % this.settings.interval === 0 ? 'long' : 'short';
        }

        completeSession(options = {}) {
            this.stopLoop();
            this.running = false;
            this.remaining = 0;
            this.releaseWakeLock();

            const finishedMode = this.mode;
            let next;

            if (finishedMode === 'focus') {
                this.round += 1;
                this.recordSession(this.settings.focus);
                this.creditActiveTask();
                next = this.round % this.settings.interval === 0 ? 'long' : 'short';
            } else {
                if (finishedMode === 'long') this.round = 0;
                next = 'focus';
            }

            if (!options.silent) {
                this.sound.alarm(this.settings.alarm);
                this.notify(finishedMode);
                this.toast(finishedMode === 'focus' ? 'Pomodoro concluído! Hora da pausa.' : 'Pausa encerrada. Bora focar!');
                this.announce(finishedMode === 'focus' ? 'Pomodoro concluído' : 'Pausa encerrada');
            }

            const autoStart = options.autoStart === false
                ? false
                : (next === 'focus' ? this.settings.autoPomodoro : this.settings.autoBreak);

            this.switchMode(next, { autoStart });
            this.renderCycle();
            this.renderStats();
        }

        applySettingsToTimer() {
            this.el.cycleTotal.textContent = this.settings.interval;
            this.round = clamp(this.round, 0, this.settings.interval);
            if (!this.running) {
                this.remaining = this.durationFor(this.mode);
                this.renderTime({ jump: true });
            }
            this.renderCycle();
            this.persistState();
        }

        /* ------------------------- estatísticas ------------------------- */

        recordSession(minutes) {
            const key = dayKey();
            const day = this.stats.days[key] || { sessions: 0, minutes: 0 };
            day.sessions += 1;
            day.minutes += minutes;
            this.stats.days[key] = day;
            this.stats.total += 1;
            this.stats.minutes += minutes;
            this.persistStats();
        }

        currentStreak() {
            let streak = 0;
            const cursor = new Date();

            // A sequência continua válida se hoje ainda não teve pomodoro.
            if (!this.stats.days[dayKey(cursor)]) cursor.setDate(cursor.getDate() - 1);

            while (this.stats.days[dayKey(cursor)]) {
                streak += 1;
                cursor.setDate(cursor.getDate() - 1);
            }

            return streak;
        }

        /* ------------------------- tarefas ------------------------- */

        addTask() {
            const name = this.el.taskInput.value.trim();
            if (!name) return;

            const task = {
                id: `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
                name: name.slice(0, 80),
                estimate: toInt(this.el.taskEstimate.value, 1, [1, 20]),
                done: false,
                completed: 0
            };

            this.tasks.push(task);
            if (!this.activeTaskId) this.activeTaskId = task.id;

            this.el.taskInput.value = '';
            this.el.taskEstimate.value = 1;
            this.persistTasks();
            this.persistState();
            this.renderTasks();
            this.sound.click();
        }

        handleTaskClick(event) {
            const button = event.target.closest('button');
            if (!button) return;

            const item = button.closest('.task-item');
            const id = item && item.dataset.id;
            const task = this.tasks.find((entry) => entry.id === id);
            if (!task) return;

            if (button.classList.contains('task-check')) {
                task.done = !task.done;
                if (task.done && this.activeTaskId === task.id) {
                    const next = this.tasks.find((entry) => !entry.done);
                    this.activeTaskId = next ? next.id : null;
                }
            } else if (button.classList.contains('task-remove')) {
                this.tasks = this.tasks.filter((entry) => entry.id !== id);
                if (this.activeTaskId === id) this.activeTaskId = null;
            } else if (button.classList.contains('task-name')) {
                this.activeTaskId = task.done ? this.activeTaskId : task.id;
            }

            this.sound.click();
            this.persistTasks();
            this.persistState();
            this.renderTasks();
        }

        creditActiveTask() {
            const task = this.tasks.find((entry) => entry.id === this.activeTaskId);
            if (!task) return;
            task.completed += 1;
            this.persistTasks();
            this.renderTasks();
        }

        /* ------------------------- notificações ------------------------- */

        notificationsSupported() {
            return typeof window.Notification !== 'undefined';
        }

        notificationsGranted() {
            return this.notificationsSupported() && Notification.permission === 'granted';
        }

        /** Pede a permissão uma única vez, no primeiro "Iniciar" (gesto do usuário). */
        askNotificationsOnce() {
            if (!this.settings.notifications || this.settings.askedNotifications) return;
            if (!this.notificationsSupported() || Notification.permission !== 'default') return;

            this.settings.askedNotifications = true;
            this.persistSettings();

            Notification.requestPermission().then((result) => {
                if (result === 'granted') this.toast('Notificações ativadas');
                this.renderNotificationStatus();
            }).catch(() => { });
        }

        enableNotifications(checkbox) {
            if (!this.notificationsSupported()) {
                checkbox.checked = false;
                this.renderNotificationStatus('Seu navegador não oferece notificações nesta página.');
                return;
            }

            if (Notification.permission === 'granted') {
                this.renderNotificationStatus();
                return;
            }

            if (Notification.permission === 'denied') {
                checkbox.checked = false;
                this.renderNotificationStatus('Permissão bloqueada. Libere as notificações nas configurações do navegador.', true);
                return;
            }

            Notification.requestPermission().then((result) => {
                if (result !== 'granted') {
                    checkbox.checked = false;
                    this.renderNotificationStatus('Permissão negada pelo navegador.', true);
                } else {
                    this.renderNotificationStatus();
                    this.toast('Notificações ativadas');
                }
            }).catch(() => {
                checkbox.checked = false;
                this.renderNotificationStatus('Não foi possível pedir a permissão.', true);
            });
        }

        notify(finishedMode) {
            if (!this.settings.notifications || !this.notificationsGranted()) return;

            const isFocus = finishedMode === 'focus';
            const task = this.tasks.find((entry) => entry.id === this.activeTaskId);
            const title = isFocus ? '🍅 Pomodoro concluído!' : '✅ Pausa encerrada';
            const body = isFocus
                ? `${task ? `"${task.name}" · ` : ''}Hora de descansar um pouco.`
                : 'Respire fundo e volte ao foco.';

            try {
                const notification = new Notification(title, {
                    body,
                    tag: 'pomodoro-labs',
                    renotify: true,
                    icon: '/favicon.ico',
                    badge: '/favicon.ico'
                });
                notification.onclick = () => {
                    window.focus();
                    notification.close();
                };
            } catch (err) {
                /* Alguns navegadores exigem service worker; o alarme sonoro cobre o aviso. */
            }
        }

        /* ------------------------- wake lock ------------------------- */

        requestWakeLock() {
            if (!this.settings.wakeLock || !this.running) return;
            if (!('wakeLock' in navigator) || this.wakeLockSentinel) return;

            navigator.wakeLock.request('screen').then((sentinel) => {
                this.wakeLockSentinel = sentinel;
                sentinel.addEventListener('release', () => {
                    this.wakeLockSentinel = null;
                });
            }).catch(() => {
                /* Recurso indisponível (aba oculta, bateria baixa, navegador sem suporte). */
            });
        }

        releaseWakeLock() {
            if (!this.wakeLockSentinel) return;
            this.wakeLockSentinel.release().catch(() => { });
            this.wakeLockSentinel = null;
        }

        /* ------------------------- configurações (modal) ------------------------- */

        openSettings() {
            this.fillSettingsForm();
            this.lastFocusedElement = document.activeElement;
            this.el.modal.hidden = false;
            document.body.style.overflow = 'hidden';
            this.el.settingsBtn.setAttribute('aria-expanded', 'true');
            const first = this.el.modal.querySelector('input, select, button');
            if (first) first.focus();
        }

        closeSettings() {
            this.el.modal.hidden = true;
            document.body.style.overflow = '';
            this.el.settingsBtn.setAttribute('aria-expanded', 'false');
            // Descarta ajustes de volume não salvos.
            this.sound.setVolume(this.settings.volume);
            if (this.lastFocusedElement) this.lastFocusedElement.focus();
        }

        handleModalKeydown(event) {
            if (event.key === 'Escape') {
                event.stopPropagation();
                this.closeSettings();
                return;
            }

            if (event.key !== 'Tab') return;

            const focusable = Array.from(
                this.el.modalContent.querySelectorAll('button, input, select, [tabindex]:not([tabindex="-1"])')
            ).filter((node) => !node.disabled && node.offsetParent !== null);
            if (!focusable.length) return;

            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }

        fillSettingsForm() {
            const inputs = this.el.inputs;
            inputs.focus.value = this.settings.focus;
            inputs.short.value = this.settings.short;
            inputs.long.value = this.settings.long;
            inputs.interval.value = this.settings.interval;
            inputs.autoBreak.checked = this.settings.autoBreak;
            inputs.autoPomodoro.checked = this.settings.autoPomodoro;
            inputs.wakeLock.checked = this.settings.wakeLock;
            inputs.alarm.value = this.settings.alarm;
            inputs.volume.value = this.settings.volume;
            inputs.ticking.checked = this.settings.ticking;
            inputs.notifications.checked = this.settings.notifications
                && this.notificationsSupported()
                && Notification.permission !== 'denied';
            this.el.volumeValue.textContent = `${this.settings.volume}%`;
            this.renderNotificationStatus();
        }

        saveSettings() {
            const inputs = this.el.inputs;
            const previousDurations = {
                focus: this.settings.focus,
                short: this.settings.short,
                long: this.settings.long
            };

            this.settings = Object.assign({}, this.settings, {
                focus: toInt(inputs.focus.value, DEFAULTS.focus, LIMITS.focus),
                short: toInt(inputs.short.value, DEFAULTS.short, LIMITS.short),
                long: toInt(inputs.long.value, DEFAULTS.long, LIMITS.long),
                interval: toInt(inputs.interval.value, DEFAULTS.interval, LIMITS.interval),
                autoBreak: inputs.autoBreak.checked,
                autoPomodoro: inputs.autoPomodoro.checked,
                wakeLock: inputs.wakeLock.checked,
                alarm: inputs.alarm.value,
                volume: toInt(inputs.volume.value, DEFAULTS.volume, [0, 100]),
                ticking: inputs.ticking.checked,
                notifications: inputs.notifications.checked
            });

            this.persistSettings();
            this.sound.setVolume(this.settings.volume);

            if (this.settings.wakeLock) this.requestWakeLock();
            else this.releaseWakeLock();

            const durationChanged = previousDurations[this.mode] !== this.settings[this.mode];
            this.applySettingsToTimer();

            this.closeSettings();
            this.toast(durationChanged && this.running
                ? 'Configurações salvas (valem no próximo ciclo)'
                : 'Configurações salvas');
        }

        /* ------------------------- atalhos ------------------------- */

        handleShortcut(event) {
            if (event.metaKey || event.ctrlKey || event.altKey) return;

            if (!this.el.modal.hidden) {
                if (event.key === 'Escape') this.closeSettings();
                return;
            }

            const target = event.target;
            const typing = target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.isContentEditable);
            if (typing) return;

            // Espaço em um botão focado já dispara o clique nativo.
            const onButton = target && target.tagName === 'BUTTON';

            switch (event.key) {
                case ' ':
                case 'Spacebar':
                    if (onButton) return;
                    event.preventDefault();
                    this.sound.unlock();
                    this.toggle();
                    break;
                case 'r':
                case 'R':
                    this.resetTimer();
                    this.toast('Ciclo reiniciado');
                    break;
                case 's':
                case 'S':
                    this.skipSession();
                    break;
                case '1':
                    this.switchMode('focus', { manual: true });
                    break;
                case '2':
                    this.switchMode('short', { manual: true });
                    break;
                case '3':
                    this.switchMode('long', { manual: true });
                    break;
                default:
                    break;
            }
        }

        /* ------------------------- render ------------------------- */

        renderAll() {
            this.el.cycleTotal.textContent = this.settings.interval;
            this.renderMode();
            this.renderControls();
            this.renderTime({ jump: true });
            this.renderCycle();
            this.renderTasks();
            this.renderStats();
            this.renderSoundButton();

            if (this.pendingAwayMessage) {
                this.pendingAwayMessage = false;
                this.toast('Um ciclo terminou enquanto você estava fora');
            }
        }

        renderMode() {
            this.el.body.dataset.mode = this.mode;
            this.el.badge.textContent = MODES[this.mode].badge;
            this.el.modeBtns.forEach((btn) => {
                const active = btn.dataset.mode === this.mode;
                btn.classList.toggle('is-active', active);
                btn.setAttribute('aria-selected', active ? 'true' : 'false');
            });
        }

        renderControls() {
            this.el.toggle.classList.toggle('is-running', this.running);
            this.el.toggleLabel.textContent = this.running ? 'Pausar' : 'Iniciar';
        }

        renderTime(options = {}) {
            const total = this.durationFor(this.mode) || 1;
            const remaining = clamp(this.remaining, 0, total);
            const seconds = Math.ceil(remaining / 1000);
            const text = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

            if (this.el.time.textContent !== text) this.el.time.textContent = text;

            const progress = remaining / total;
            const offset = RING_CIRCUMFERENCE * (1 - progress);

            if (options.jump) {
                this.el.ring.classList.add('is-jumping');
                this.el.ring.style.strokeDashoffset = offset;
                // Reativa a transição só depois que o navegador aplicou o salto.
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => this.el.ring.classList.remove('is-jumping'));
                });
            } else {
                this.el.ring.style.strokeDashoffset = offset;
            }

            this.renderTitle(text);
            this.renderFavicon(progress);
        }

        renderTitle(text) {
            const suffix = MODES[this.mode].title;
            /* A contagem na aba é útil com o timer em outra janela, mas o nome
               precisa continuar no título (é assim que o site é achado por
               busca). BASE_TITLE vem do próprio <title>, então os dois nunca
               divergem. */
            const title = this.running || this.remaining < this.durationFor(this.mode)
                ? `${text} · ${suffix} — ${BASE_TITLE}`
                : BASE_TITLE;

            if (title !== this.lastTitle) {
                this.lastTitle = title;
                document.title = title;
            }
        }

        renderFavicon(progress) {
            const step = Math.round(progress * 40); // ~2,5% por atualização
            if (step === this.lastFaviconStep) return;
            this.lastFaviconStep = step;

            try {
                const size = 64;
                if (!this.faviconCanvas) {
                    this.faviconCanvas = document.createElement('canvas');
                    this.faviconCanvas.width = size;
                    this.faviconCanvas.height = size;
                }

                const ctx = this.faviconCanvas.getContext('2d');
                const color = getComputedStyle(document.body).getPropertyValue('--mode-color').trim() || '#e2503f';
                const center = size / 2;
                const radius = 26;

                ctx.clearRect(0, 0, size, size);

                ctx.beginPath();
                ctx.arc(center, center, radius, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(128, 128, 128, 0.3)';
                ctx.lineWidth = 8;
                ctx.stroke();

                if (progress > 0) {
                    ctx.beginPath();
                    ctx.arc(center, center, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 8;
                    ctx.lineCap = 'round';
                    ctx.stroke();
                }

                ctx.beginPath();
                ctx.arc(center, center, 9, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();

                let link = document.querySelector('link[rel="icon"][data-dynamic]');
                if (!link) {
                    link = document.createElement('link');
                    link.rel = 'icon';
                    link.dataset.dynamic = 'true';
                    document.head.appendChild(link);
                }
                link.href = this.faviconCanvas.toDataURL('image/png');
            } catch (err) {
                /* Canvas indisponível: o favicon padrão continua valendo. */
            }
        }

        renderCycle() {
            const interval = this.settings.interval;
            const position = this.mode === 'focus'
                ? Math.min(this.round + 1, interval)
                : Math.max(1, Math.min(this.round, interval));

            this.el.cycle.textContent = position;
            this.el.cycleTotal.textContent = interval;
        }

        renderSoundButton() {
            const muted = this.settings.muted;
            this.el.soundBtn.classList.toggle('is-muted', muted);
            this.el.soundBtn.setAttribute('aria-pressed', muted ? 'false' : 'true');
            this.el.soundBtn.setAttribute('aria-label', muted ? 'Ativar som' : 'Desativar som');
            this.el.soundBtn.title = muted ? 'Som desligado' : 'Som ligado';
        }

        renderTasks() {
            const list = this.el.taskList;
            list.textContent = '';

            const activeTask = this.tasks.find((task) => task.id === this.activeTaskId && !task.done);
            if (!activeTask) this.activeTaskId = null;

            this.tasks.forEach((task) => {
                const item = document.createElement('li');
                item.className = 'task-item';
                item.dataset.id = task.id;
                item.classList.toggle('is-done', task.done);
                item.classList.toggle('is-active', task.id === this.activeTaskId && !task.done);

                const check = document.createElement('button');
                check.type = 'button';
                check.className = 'task-check';
                check.setAttribute('aria-label', task.done ? `Reabrir ${task.name}` : `Concluir ${task.name}`);
                check.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>';

                const name = document.createElement('button');
                name.type = 'button';
                name.className = 'task-name';
                name.textContent = task.name;
                name.title = task.name;
                name.setAttribute('aria-label', `Focar em ${task.name}`);

                const count = document.createElement('span');
                count.className = 'task-count';
                count.textContent = `${task.completed}/${task.estimate}`;
                count.title = 'Pomodoros concluídos / estimados';

                const remove = document.createElement('button');
                remove.type = 'button';
                remove.className = 'task-remove';
                remove.setAttribute('aria-label', `Remover ${task.name}`);
                remove.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';

                item.append(check, name, count, remove);
                list.appendChild(item);
            });

            const hasTasks = this.tasks.length > 0;
            this.el.tasksEmpty.hidden = hasTasks;
            this.el.clearDone.hidden = !this.tasks.some((task) => task.done);

            const pending = this.tasks.filter((task) => !task.done);
            const estimated = pending.reduce((acc, task) => acc + Math.max(0, task.estimate - task.completed), 0);

            this.el.taskSummary.hidden = !hasTasks;
            if (hasTasks) {
                this.el.taskSummary.textContent = '';
                const left = document.createElement('span');
                left.textContent = `${pending.length} pendente${pending.length === 1 ? '' : 's'}`;
                const right = document.createElement('span');
                right.textContent = `≈ ${this.formatMinutes(estimated * this.settings.focus)} restantes`;
                this.el.taskSummary.append(left, right);
            }

            this.renderActiveTask();
        }

        renderActiveTask() {
            const task = this.tasks.find((entry) => entry.id === this.activeTaskId);
            this.el.activeTask.classList.toggle('is-empty', !task);
            this.el.activeTaskName.textContent = task ? task.name : 'Nenhuma tarefa selecionada';
            if (task) this.el.activeTaskName.title = task.name;
        }

        formatMinutes(minutes) {
            const total = Math.max(0, Math.round(minutes));
            const hours = Math.floor(total / 60);
            const rest = total % 60;
            if (!hours) return `${rest}min`;
            return rest ? `${hours}h${String(rest).padStart(2, '0')}` : `${hours}h`;
        }

        renderStats() {
            const today = this.stats.days[dayKey()] || { sessions: 0, minutes: 0 };

            this.el.statToday.textContent = today.sessions;
            this.el.statTime.textContent = this.formatMinutes(today.minutes);
            this.el.statStreak.textContent = this.currentStreak();
            this.el.statTotal.textContent = this.stats.total;

            const days = [];
            for (let i = 6; i >= 0; i -= 1) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                const entry = this.stats.days[dayKey(date)];
                days.push({
                    label: WEEK_LABELS[date.getDay()],
                    sessions: entry ? entry.sessions : 0,
                    isToday: i === 0
                });
            }

            const max = Math.max(4, ...days.map((day) => day.sessions));
            this.el.chart.textContent = '';

            days.forEach((day) => {
                const col = document.createElement('div');
                col.className = 'chart-col';
                col.classList.toggle('has-value', day.sessions > 0);
                col.classList.toggle('is-today', day.isToday);
                col.title = `${day.label}: ${day.sessions} pomodoro${day.sessions === 1 ? '' : 's'}`;

                const bar = document.createElement('div');
                bar.className = 'chart-bar';
                bar.style.height = `${Math.max(6, (day.sessions / max) * 100)}%`;

                const label = document.createElement('span');
                label.className = 'chart-label';
                label.textContent = day.label;

                col.append(bar, label);
                this.el.chart.appendChild(col);
            });

            this.el.chart.setAttribute(
                'aria-label',
                `Pomodoros dos últimos 7 dias: ${days.map((day) => `${day.label} ${day.sessions}`).join(', ')}`
            );
        }

        renderNotificationStatus(message, isWarning) {
            const node = this.el.notificationStatus;

            if (message) {
                node.textContent = message;
                node.classList.toggle('is-warning', !!isWarning);
                return;
            }

            node.classList.remove('is-warning');

            if (!this.notificationsSupported()) {
                node.textContent = 'Seu navegador não oferece notificações nesta página.';
                return;
            }

            if (Notification.permission === 'granted') {
                node.textContent = 'Permissão concedida — você será avisado mesmo com a aba em segundo plano.';
            } else if (Notification.permission === 'denied') {
                node.textContent = 'Permissão bloqueada. Libere as notificações nas configurações do navegador.';
                node.classList.add('is-warning');
            } else {
                node.textContent = 'Ative para o navegador pedir sua permissão.';
            }
        }

        /* ------------------------- feedback ------------------------- */

        toast(message) {
            const node = document.createElement('div');
            node.className = 'toast';
            node.textContent = message;
            this.el.toasts.appendChild(node);

            setTimeout(() => {
                node.classList.add('is-leaving');
                setTimeout(() => node.remove(), 300);
            }, 2600);
        }

        announce(message) {
            this.el.live.textContent = message;
        }
    }

    const boot = () => new PomodoroApp();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }
})();
