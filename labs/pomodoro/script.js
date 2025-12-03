class PomodoroApp {
    constructor() {
        // Default Settings
        this.settings = {
            focus: 25,
            short: 5,
            long: 15,
            autoBreak: false,
            autoPomodoro: false
        };

        this.loadSettings();

        this.timeLeft = this.settings.focus * 60;
        this.totalTime = this.settings.focus * 60;
        this.timerId = null;
        this.isRunning = false;
        this.cycleCount = 1;
        this.mode = 'focus'; // focus, short, long

        // DOM Elements
        this.timeDisplay = document.getElementById('time-display');
        this.progressCircle = document.querySelector('.timer-progress');
        this.statusBadge = document.getElementById('status-badge');
        this.cycleDisplay = document.getElementById('cycle-count');
        this.toggleBtn = document.getElementById('btn-toggle');
        this.resetBtn = document.getElementById('btn-reset');
        this.modeBtns = document.querySelectorAll('.mode-btn');

        // Settings DOM
        this.settingsBtn = document.getElementById('btn-settings');
        this.settingsModal = document.getElementById('settings-modal');
        this.closeSettingsBtn = document.getElementById('btn-close-settings');
        this.saveSettingsBtn = document.getElementById('btn-save-settings');

        // Inputs
        this.inputFocus = document.getElementById('setting-focus');
        this.inputShort = document.getElementById('setting-short');
        this.inputLong = document.getElementById('setting-long');
        this.inputAutoBreak = document.getElementById('setting-auto-break');
        this.inputAutoPomodoro = document.getElementById('setting-auto-pomodoro');

        // Audio Context
        this.audioCtx = null;

        this.init();
    }

    init() {
        this.updateDisplay();
        this.setupEventListeners();
        this.requestNotificationPermission();
    }

    loadSettings() {
        const saved = localStorage.getItem('pomodoro-settings');
        if (saved) {
            this.settings = JSON.parse(saved);
        }
    }

    saveSettings() {
        this.settings = {
            focus: parseInt(this.inputFocus.value) || 25,
            short: parseInt(this.inputShort.value) || 5,
            long: parseInt(this.inputLong.value) || 15,
            autoBreak: this.inputAutoBreak.checked,
            autoPomodoro: this.inputAutoPomodoro.checked
        };
        localStorage.setItem('pomodoro-settings', JSON.stringify(this.settings));

        // Close modal
        this.settingsModal.classList.remove('open');

        // Reset timer to apply new settings if not running
        if (!this.isRunning) {
            this.resetTimer();
        }
    }

    populateSettings() {
        this.inputFocus.value = this.settings.focus;
        this.inputShort.value = this.settings.short;
        this.inputLong.value = this.settings.long;
        this.inputAutoBreak.checked = this.settings.autoBreak;
        this.inputAutoPomodoro.checked = this.settings.autoPomodoro;
    }

    setupEventListeners() {
        this.toggleBtn.addEventListener('click', () => this.toggleTimer());
        this.resetBtn.addEventListener('click', () => this.resetTimer());

        this.modeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const newMode = e.target.dataset.mode;
                this.switchMode(newMode);
            });
        });

        // Settings Modal
        this.settingsBtn.addEventListener('click', () => {
            this.populateSettings();
            this.settingsModal.classList.add('open');
        });

        this.closeSettingsBtn.addEventListener('click', () => {
            this.settingsModal.classList.remove('open');
        });

        this.saveSettingsBtn.addEventListener('click', () => {
            this.saveSettings();
        });

        // Close modal on outside click
        this.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.settingsModal) {
                this.settingsModal.classList.remove('open');
            }
        });
    }

    requestNotificationPermission() {
        if ("Notification" in window && Notification.permission !== "granted") {
            Notification.requestPermission();
        }
    }

    toggleTimer() {
        if (this.isRunning) {
            this.pauseTimer();
        } else {
            this.startTimer();
        }
    }

    startTimer() {
        if (!this.isRunning) {
            this.isRunning = true;
            this.toggleBtn.innerHTML = '<span class="icon-pause">⏸</span> Pause';
            this.toggleBtn.classList.add('active');

            // Initialize audio context on first user interaction
            if (!this.audioCtx) {
                this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }

            this.lastTime = Date.now();
            this.timerId = setInterval(() => {
                const now = Date.now();
                const delta = Math.floor((now - this.lastTime) / 1000);

                if (delta >= 1) {
                    this.timeLeft -= delta;
                    this.lastTime = now;
                    this.updateDisplay();

                    if (this.timeLeft <= 0) {
                        this.completeTimer();
                    }
                }
            }, 100);
        }
    }

    pauseTimer() {
        this.isRunning = false;
        clearInterval(this.timerId);
        this.toggleBtn.innerHTML = '<span class="icon-play">▶</span> Start';
        this.toggleBtn.classList.remove('active');
    }

    resetTimer() {
        this.pauseTimer();
        this.timeLeft = this.settings[this.mode] * 60;
        this.totalTime = this.settings[this.mode] * 60;
        this.updateDisplay();
    }

    switchMode(mode) {
        this.mode = mode;
        this.pauseTimer();
        this.timeLeft = this.settings[mode] * 60;
        this.totalTime = this.settings[mode] * 60;

        // Update UI
        this.modeBtns.forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-mode="${mode}"]`).classList.add('active');

        if (mode === 'focus') {
            document.body.classList.remove('break-mode');
            this.statusBadge.textContent = 'FOCUS';
        } else {
            document.body.classList.add('break-mode');
            this.statusBadge.textContent = mode === 'short' ? 'SHORT BREAK' : 'LONG BREAK';
        }

        this.updateDisplay();
    }

    completeTimer() {
        this.pauseTimer();
        this.playSound();
        this.sendNotification();

        if (this.mode === 'focus') {
            if (this.cycleCount % 4 === 0) {
                this.switchMode('long');
            } else {
                this.switchMode('short');
            }
            this.cycleCount++;
            this.cycleDisplay.textContent = this.cycleCount;

            if (this.settings.autoBreak) {
                this.startTimer();
            }
        } else {
            this.switchMode('focus');

            if (this.settings.autoPomodoro) {
                this.startTimer();
            }
        }
    }

    updateDisplay() {
        const minutes = Math.floor(this.timeLeft / 60);
        const seconds = this.timeLeft % 60;
        const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        this.timeDisplay.textContent = timeString;
        document.title = `${timeString} - Pomodoro`;

        // Update Progress Circle
        const circumference = 2 * Math.PI * 45; // r=45
        const offset = circumference - (this.timeLeft / this.totalTime) * circumference;
        this.progressCircle.style.strokeDashoffset = offset;
    }

    playSound() {
        if (!this.audioCtx) return;

        const oscillator = this.audioCtx.createOscillator();
        const gainNode = this.audioCtx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);

        // Gentle chime
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(440, this.audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(880, this.audioCtx.currentTime + 0.1);

        gainNode.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.5);

        oscillator.start();
        oscillator.stop(this.audioCtx.currentTime + 0.5);
    }

    sendNotification() {
        if (Notification.permission === "granted") {
            const title = this.mode === 'focus' ? "Focus Session Complete" : "Break Over";
            const body = this.mode === 'focus' ? "Time to take a break." : "Ready to focus again?";

            new Notification(title, {
                body: body,
                icon: '/assets/images/favicon.png'
            });
        }
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    const app = new PomodoroApp();
});
