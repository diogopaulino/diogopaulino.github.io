/**
 * Menu principal, overlay de controles, opções de qualidade e volume.
 */

import { QUALITY } from '../core/QualitySettings.js';
import { SETTINGS_KEY } from '../core/assets.js';

export class Menu {
    constructor(game) {
        this.game = game;
        this.root = document.getElementById('menuOverlay');
        this.controls = document.getElementById('controlsOverlay');
        this.settings = document.getElementById('settingsOverlay');
        this.loading = document.getElementById('loadingOverlay');

        document.getElementById('btnNewGame')?.addEventListener('click', () => game.startNewGame());
        document.getElementById('btnContinue')?.addEventListener('click', () => game.continueGame());
        document.getElementById('btnControls')?.addEventListener('click', () => this.showControls(true));
        document.getElementById('btnSettings')?.addEventListener('click', () => this.showSettings(true));
        document.getElementById('btnCloseControls')?.addEventListener('click', () => this.showControls(false));
        document.getElementById('btnCloseSettings')?.addEventListener('click', () => this.showSettings(false));

        document.getElementById('btnPlayAgain')?.addEventListener('click', () => {
            document.getElementById('endOverlay').hidden = true;
            game.startNewGame();
        });
        document.getElementById('btnEndMenu')?.addEventListener('click', () => {
            document.getElementById('endOverlay').hidden = true;
            this.show();
        });

        // Configurações
        const qSel = document.getElementById('qualitySelect');
        if (qSel) {
            qSel.value = game.quality.id;
            qSel.addEventListener('change', (e) => {
                const q = QUALITY[e.target.value];
                if (q) {
                    game.quality = q;
                    this._saveSettings();
                }
            });
        }

        const volSlider = document.getElementById('volumeSlider');
        const volVal = document.getElementById('volumeValue');
        if (volSlider) {
            volSlider.addEventListener('input', (e) => {
                const v = parseInt(e.target.value, 10) / 100;
                game.audio.setBusVolume('master', v);
                if (volVal) volVal.textContent = e.target.value;
                this._saveSettings();
            });
        }

        this.syncContinue();
    }

    _saveSettings() {
        try {
            const data = {
                quality: this.game.quality.id,
                volume: document.getElementById('volumeSlider')?.value || 75
            };
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
        } catch { /* ignore */ }
    }

    syncContinue() {
        const btn = document.getElementById('btnContinue');
        if (btn) btn.disabled = !this.game.checkpoints.hasSave();
    }

    setProgress(p) {
        this.game.hud?.setLoading(p);
    }

    show() {
        if (this.loading) this.loading.hidden = true;
        if (this.root) this.root.hidden = false;
        this.syncContinue();
    }

    hide() {
        if (this.root) this.root.hidden = true;
        if (this.loading) this.loading.hidden = true;
    }

    showControls(v) {
        if (this.controls) this.controls.hidden = !v;
    }

    showSettings(v) {
        if (this.settings) this.settings.hidden = !v;
    }
}
