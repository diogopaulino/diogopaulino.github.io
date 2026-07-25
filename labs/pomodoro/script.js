class PomodoroApp {
    constructor() {
        this.defaults = {
            focus: 25,
            short: 5,
            long: 15,
            autoBreak: false,
            autoPomodoro: false,
            soundEnabled: true,
            sound: 'soft',
            volume: 65,
            notifications: false
        };

        this.settings = this.loadSettings();
        this.mode = 'focus';
        this.cycleCount = 1;
        this.timeLeft = this.settings.focus * 60;
        this.totalTime = this.timeLeft;
        this.timerId = null;
        this.targetTime = null;
        this.isRunning = false;
        this.audioCtx = null;
        this.lastFocusedElement = null;
        this.toastTimer = null;

        this.cacheElements();
        this.init();
    }

    cacheElements() {
        this.timeDisplay = document.getElementById('time-display');
        this.progressCircle = document.querySelector('.timer-progress');
        this.statusBadge = document.getElementById('status-badge');
        this.sessionLabel = document.getElementById('session-label');
        this.sessionTitle = document.getElementById('session-title');
        this.timerDescription = document.getElementById('timer-description');
        this.timerAnnouncement = document.getElementById('timer-announcement');
        this.pomodoroCard = document.querySelector('.pomodoro-card');
        this.cycleDisplay = document.getElementById('cycle-count');
        this.toggleBtn = document.getElementById('btn-toggle');
        this.toggleIcon = this.toggleBtn.querySelector('.control-icon');
        this.toggleLabel = this.toggleBtn.querySelector('.control-label');
        this.resetBtn = document.getElementById('btn-reset');
        this.modeBtns = document.querySelectorAll('.mode-btn');
        this.signalStatus = document.getElementById('signal-status');
        this.soundStatus = document.getElementById('sound-status');
        this.notificationStatus = document.getElementById('notification-status');
        this.settingsToast = document.getElementById('settings-toast');

        this.settingsBtn = document.getElementById('btn-settings');
        this.settingsModal = document.getElementById('settings-modal');
        this.closeSettingsBtn = document.getElementById('btn-close-settings');
        this.saveSettingsBtn = document.getElementById('btn-save-settings');
        this.testSoundBtn = document.getElementById('btn-test-sound');

        this.inputFocus = document.getElementById('setting-focus');
        this.inputShort = document.getElementById('setting-short');
        this.inputLong = document.getElementById('setting-long');
        this.inputAutoBreak = document.getElementById('setting-auto-break');
        this.inputAutoPomodoro = document.getElementById('setting-auto-pomodoro');
        this.inputSoundEnabled = document.getElementById('setting-sound-enabled');
        this.inputSound = document.getElementById('setting-sound');
        this.inputVolume = document.getElementById('setting-volume');
        this.volumeValue = document.getElementById('volume-value');
        this.inputNotifications = document.getElementById('setting-notifications');
        this.notificationHelp = document.getElementById('notification-help');
    }

    init() {
        this.setupEventListeners();
        this.updateModeUI();
        this.updateDisplay();
        this.updateSignalStatus();
    }

    loadSettings() {
        try {
            const saved = JSON.parse(localStorage.getItem('pomodoro-settings') || '{}');
            return this.normalizeSettings(saved);
        } catch (error) {
            return { ...this.defaults };
        }
    }

    normalizeSettings(settings = {}) {
        const numberInRange = (value, fallback, min, max) => {
            const number = Number.parseInt(value, 10);
            return Math.min(max, Math.max(min, Number.isFinite(number) ? number : fallback));
        };
        const sounds = ['soft', 'digital', 'bell'];

        return {
            focus: numberInRange(settings.focus, this.defaults.focus, 1, 120),
            short: numberInRange(settings.short, this.defaults.short, 1, 60),
            long: numberInRange(settings.long, this.defaults.long, 1, 120),
            autoBreak: settings.autoBreak === true,
            autoPomodoro: settings.autoPomodoro === true,
            soundEnabled: settings.soundEnabled !== false,
            sound: sounds.includes(settings.sound) ? settings.sound : this.defaults.sound,
            volume: numberInRange(settings.volume, this.defaults.volume, 0, 100),
            notifications: settings.notifications === true
        };
    }

    persistSettings() {
        try {
            localStorage.setItem('pomodoro-settings', JSON.stringify(this.settings));
        } catch (error) {
            // The timer still works when storage is unavailable.
        }
    }

    setupEventListeners() {
        this.toggleBtn.addEventListener('click', () => this.toggleTimer());
        this.resetBtn.addEventListener('click', () => this.resetTimer());

        this.modeBtns.forEach((button) => {
            button.addEventListener('click', () => this.switchMode(button.dataset.mode));
            button.addEventListener('keydown', (event) => this.handleModeNavigation(event));
        });

        this.settingsBtn.addEventListener('click', () => this.openSettings());
        this.signalStatus.addEventListener('click', () => this.openSettings());
        this.closeSettingsBtn.addEventListener('click', () => this.closeSettings());
        this.saveSettingsBtn.addEventListener('click', () => this.saveSettings());
        this.testSoundBtn.addEventListener('click', () => this.previewSound());

        this.inputVolume.addEventListener('input', () => {
            this.volumeValue.textContent = `${this.inputVolume.value}%`;
        });

        this.inputNotifications.addEventListener('change', () => this.handleNotificationToggle());

        this.settingsModal.addEventListener('click', (event) => {
            if (event.target === this.settingsModal) this.closeSettings();
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Tab' && this.settingsModal.classList.contains('open')) {
                this.keepFocusInSettings(event);
            }

            if (event.key === 'Escape' && this.settingsModal.classList.contains('open')) {
                this.closeSettings();
            }

            if (event.code === 'Space' && !this.settingsModal.classList.contains('open')
                && !['INPUT', 'BUTTON', 'SELECT'].includes(document.activeElement.tagName)) {
                event.preventDefault();
                this.toggleTimer();
            }
        });

        document.addEventListener('visibilitychange', () => {
            if (this.isRunning && document.visibilityState === 'visible') this.tick();
        });

        window.addEventListener('storage', (event) => {
            if (event.key !== 'pomodoro-settings') return;
            this.settings = this.loadSettings();
            this.updateSignalStatus();
            if (!this.isRunning) this.resetTimer();
        });
    }

    openSettings() {
        this.populateSettings();
        this.lastFocusedElement = document.activeElement;
        this.settingsModal.classList.add('open');
        this.settingsModal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('modal-open');
        this.closeSettingsBtn.focus();
    }

    closeSettings() {
        this.settingsModal.classList.remove('open');
        this.settingsModal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modal-open');
        this.lastFocusedElement?.focus();
    }

    keepFocusInSettings(event) {
        const focusable = Array.from(this.settingsModal.querySelectorAll(
            'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )).filter((element) => element.offsetParent !== null);

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

    handleModeNavigation(event) {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();

        const buttons = Array.from(this.modeBtns);
        const currentIndex = buttons.indexOf(event.currentTarget);
        let nextIndex = currentIndex;

        if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % buttons.length;
        if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + buttons.length) % buttons.length;
        if (event.key === 'Home') nextIndex = 0;
        if (event.key === 'End') nextIndex = buttons.length - 1;

        buttons[nextIndex].focus();
        this.switchMode(buttons[nextIndex].dataset.mode);
    }

    populateSettings() {
        this.inputFocus.value = this.settings.focus;
        this.inputShort.value = this.settings.short;
        this.inputLong.value = this.settings.long;
        this.inputAutoBreak.checked = this.settings.autoBreak;
        this.inputAutoPomodoro.checked = this.settings.autoPomodoro;
        this.inputSoundEnabled.checked = this.settings.soundEnabled;
        this.inputSound.value = this.settings.sound;
        this.inputVolume.value = this.settings.volume;
        this.volumeValue.textContent = `${this.settings.volume}%`;

        const notificationSupported = 'Notification' in window;
        const permission = notificationSupported ? Notification.permission : 'unsupported';
        this.inputNotifications.disabled = !notificationSupported || permission === 'denied';
        this.inputNotifications.checked = this.settings.notifications && permission === 'granted';

        if (!notificationSupported) {
            this.notificationHelp.textContent = 'Este navegador não oferece notificações.';
        } else if (permission === 'denied') {
            this.notificationHelp.textContent = 'Bloqueadas nas configurações do navegador.';
        } else if (permission === 'granted') {
            this.notificationHelp.textContent = 'Aviso liberado para esta página.';
        } else {
            this.notificationHelp.textContent = 'O navegador pedirá sua permissão.';
        }
    }

    clampNumber(input, fallback, min, max) {
        const value = Number.parseInt(input.value, 10);
        return Math.min(max, Math.max(min, Number.isFinite(value) ? value : fallback));
    }

    saveSettings() {
        const previousDuration = this.settings[this.mode];

        this.settings = {
            focus: this.clampNumber(this.inputFocus, 25, 1, 120),
            short: this.clampNumber(this.inputShort, 5, 1, 60),
            long: this.clampNumber(this.inputLong, 15, 1, 120),
            autoBreak: this.inputAutoBreak.checked,
            autoPomodoro: this.inputAutoPomodoro.checked,
            soundEnabled: this.inputSoundEnabled.checked,
            sound: this.inputSound.value,
            volume: Number.parseInt(this.inputVolume.value, 10),
            notifications: this.inputNotifications.checked && this.hasNotificationPermission()
        };

        this.persistSettings();
        this.closeSettings();
        this.updateSignalStatus();
        this.showToast();

        if (!this.isRunning && previousDuration !== this.settings[this.mode]) {
            this.resetTimer();
        } else {
            this.updateDisplay();
        }
    }

    showToast() {
        window.clearTimeout(this.toastTimer);
        this.settingsToast.classList.add('visible');
        this.toastTimer = window.setTimeout(() => {
            this.settingsToast.classList.remove('visible');
        }, 2600);
    }

    async handleNotificationToggle() {
        if (!this.inputNotifications.checked || !('Notification' in window)) return;

        if (Notification.permission === 'default') {
            const permission = await Notification.requestPermission();
            this.inputNotifications.checked = permission === 'granted';
        } else if (Notification.permission !== 'granted') {
            this.inputNotifications.checked = false;
        }

        this.populateNotificationHelp();
    }

    populateNotificationHelp() {
        if (!('Notification' in window)) {
            this.notificationHelp.textContent = 'Este navegador não oferece notificações.';
        } else if (Notification.permission === 'granted') {
            this.notificationHelp.textContent = 'Aviso liberado para esta página.';
        } else if (Notification.permission === 'denied') {
            this.notificationHelp.textContent = 'Bloqueadas nas configurações do navegador.';
            this.inputNotifications.disabled = true;
        } else {
            this.notificationHelp.textContent = 'O navegador pedirá sua permissão.';
        }
    }

    hasNotificationPermission() {
        return 'Notification' in window && Notification.permission === 'granted';
    }

    updateSignalStatus() {
        this.soundStatus.textContent = this.settings.soundEnabled ? 'Som ligado' : 'Som desligado';
        this.signalStatus.classList.toggle('sound-off', !this.settings.soundEnabled);

        if (!('Notification' in window)) {
            this.notificationStatus.textContent = 'Notificações indisponíveis';
        } else if (Notification.permission === 'denied') {
            this.notificationStatus.textContent = 'Notificações bloqueadas';
        } else if (this.settings.notifications && Notification.permission === 'granted') {
            this.notificationStatus.textContent = 'Notificações ligadas';
        } else {
            this.notificationStatus.textContent = 'Notificações desligadas';
        }
    }

    toggleTimer() {
        this.isRunning ? this.pauseTimer() : this.startTimer();
    }

    startTimer() {
        if (this.isRunning || this.timeLeft <= 0) return;
        this.ensureAudioContext();
        this.isRunning = true;
        this.targetTime = Date.now() + this.timeLeft * 1000;
        this.setControlState();
        this.timerDescription.textContent = this.mode === 'focus' ? 'Mantenha o foco. Você consegue.' : 'Respire e recarregue a energia.';
        this.timerId = window.setInterval(() => this.tick(), 250);
    }

    tick() {
        if (!this.isRunning) return;

        this.timeLeft = Math.max(0, Math.ceil((this.targetTime - Date.now()) / 1000));
        this.updateDisplay();

        if (this.timeLeft <= 0) this.completeTimer();
    }

    pauseTimer() {
        if (this.isRunning && this.targetTime) {
            this.timeLeft = Math.max(0, Math.ceil((this.targetTime - Date.now()) / 1000));
        }
        this.isRunning = false;
        this.targetTime = null;
        window.clearInterval(this.timerId);
        this.timerId = null;
        this.setControlState();
        this.timerDescription.textContent = this.timeLeft === this.totalTime
            ? 'Prepare-se e comece quando quiser.'
            : 'Pausado. Continue quando estiver pronto.';
        this.updateDisplay();
    }

    setControlState() {
        this.toggleIcon.textContent = this.isRunning ? 'Ⅱ' : '▶';
        this.toggleLabel.textContent = this.isRunning ? 'Pausar' : (this.timeLeft < this.totalTime ? 'Continuar' : 'Começar');
        this.toggleBtn.setAttribute('aria-label', this.toggleLabel.textContent);
    }

    resetTimer() {
        this.pauseTimer();
        this.timeLeft = this.settings[this.mode] * 60;
        this.totalTime = this.timeLeft;
        this.timerDescription.textContent = 'Prepare-se e comece quando quiser.';
        this.setControlState();
        this.updateDisplay();
    }

    switchMode(mode, shouldAutoStart = false) {
        this.pauseTimer();
        this.mode = mode;
        this.timeLeft = this.settings[mode] * 60;
        this.totalTime = this.timeLeft;
        this.updateModeUI();
        this.updateDisplay();
        this.setControlState();

        if (shouldAutoStart) this.startTimer();
    }

    updateModeUI() {
        const content = {
            focus: {
                badge: 'FOCO',
                label: 'Hora de focar',
                title: 'Sessão de foco'
            },
            short: {
                badge: 'PAUSA',
                label: 'Pausa rápida',
                title: 'Pausa curta'
            },
            long: {
                badge: 'DESCANSO',
                label: 'Recupere a energia',
                title: 'Pausa longa'
            }
        }[this.mode];

        document.body.classList.toggle('break-mode', this.mode !== 'focus');
        this.statusBadge.textContent = content.badge;
        this.sessionLabel.textContent = content.label;
        this.sessionTitle.textContent = content.title;
        this.cycleDisplay.textContent = this.cycleCount;

        this.modeBtns.forEach((button) => {
            const active = button.dataset.mode === this.mode;
            button.classList.toggle('active', active);
            button.setAttribute('aria-selected', String(active));
            button.tabIndex = active ? 0 : -1;
        });
    }

    completeTimer() {
        const completedMode = this.mode;
        this.isRunning = false;
        this.targetTime = null;
        window.clearInterval(this.timerId);
        this.timerId = null;

        this.playSound(this.settings.sound, this.settings.volume);
        this.sendNotification(completedMode);
        this.pomodoroCard.classList.remove('session-complete');
        window.requestAnimationFrame(() => this.pomodoroCard.classList.add('session-complete'));
        window.setTimeout(() => this.pomodoroCard.classList.remove('session-complete'), 760);

        let nextMode;
        let autoStart;
        if (completedMode === 'focus') {
            nextMode = this.cycleCount === 4 ? 'long' : 'short';
            this.cycleCount = this.cycleCount === 4 ? 1 : this.cycleCount + 1;
            autoStart = this.settings.autoBreak;
        } else {
            nextMode = 'focus';
            autoStart = this.settings.autoPomodoro;
        }

        const message = completedMode === 'focus'
            ? 'Sessão de foco concluída. Hora de fazer uma pausa.'
            : 'Pausa concluída. Hora de voltar ao foco.';
        this.timerAnnouncement.textContent = message;
        this.switchMode(nextMode, autoStart);
        if (!autoStart) this.timerDescription.textContent = message;
    }

    updateDisplay() {
        const minutes = Math.floor(this.timeLeft / 60);
        const seconds = this.timeLeft % 60;
        const timeString = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

        this.timeDisplay.textContent = timeString;
        this.timeDisplay.setAttribute('aria-label', `${minutes} minutos e ${seconds} segundos restantes`);
        document.title = `${timeString} · ${this.sessionTitle.textContent} — Pomodoro`;

        const circumference = 2 * Math.PI * 45;
        const ratio = this.totalTime > 0 ? this.timeLeft / this.totalTime : 0;
        this.progressCircle.style.strokeDashoffset = String(circumference * (1 - ratio));
    }

    ensureAudioContext() {
        if (!this.audioCtx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) this.audioCtx = new AudioContextClass();
        }

        if (this.audioCtx?.state === 'suspended') this.audioCtx.resume();
        return this.audioCtx;
    }

    previewSound() {
        this.ensureAudioContext();
        this.playSound(this.inputSound.value, Number.parseInt(this.inputVolume.value, 10), true);
    }

    playSound(sound = 'soft', volume = 65, force = false) {
        if (!force && !this.settings.soundEnabled) return;
        if (volume <= 0) return;
        const context = this.ensureAudioContext();
        if (!context) return;

        const sequences = {
            soft: [
                { frequency: 523.25, delay: 0, duration: 0.5 },
                { frequency: 659.25, delay: 0.18, duration: 0.7 }
            ],
            digital: [
                { frequency: 784, delay: 0, duration: 0.12, type: 'square' },
                { frequency: 988, delay: 0.16, duration: 0.12, type: 'square' },
                { frequency: 1318, delay: 0.32, duration: 0.22, type: 'square' }
            ],
            bell: [
                { frequency: 659.25, delay: 0, duration: 1.2 },
                { frequency: 987.77, delay: 0.04, duration: 1.05 },
                { frequency: 1318.51, delay: 0.08, duration: 0.9 }
            ]
        };

        const masterVolume = Math.min(1, volume / 100) * 0.18;
        (sequences[sound] || sequences.soft).forEach((note) => {
            const oscillator = context.createOscillator();
            const gain = context.createGain();
            const start = context.currentTime + note.delay;
            const end = start + note.duration;

            oscillator.type = note.type || 'sine';
            oscillator.frequency.setValueAtTime(note.frequency, start);
            gain.gain.setValueAtTime(0.001, start);
            gain.gain.exponentialRampToValueAtTime(masterVolume, start + 0.025);
            gain.gain.exponentialRampToValueAtTime(0.001, end);
            oscillator.connect(gain);
            gain.connect(context.destination);
            oscillator.start(start);
            oscillator.stop(end + 0.03);
        });
    }

    sendNotification(completedMode) {
        if (!this.settings.notifications || !this.hasNotificationPermission()) return;

        const focusCompleted = completedMode === 'focus';
        try {
            const notification = new Notification(
                focusCompleted ? 'Foco concluído' : 'Pausa concluída',
                {
                    body: focusCompleted ? 'Ótimo trabalho. Hora de respirar um pouco.' : 'Pronto para mais uma sessão?',
                    icon: '/favicon.ico',
                    tag: 'pomodoro-session',
                    renotify: true
                }
            );
            notification.onclick = () => {
                window.focus();
                notification.close();
            };
        } catch (error) {
            // Some browsers expose the API but restrict desktop notifications.
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.pomodoroApp = new PomodoroApp();
});
