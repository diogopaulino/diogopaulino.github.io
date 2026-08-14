export class Menu {
    constructor(game) {
        this.game = game;
        this.root = document.getElementById('menuOverlay');
        this.controls = document.getElementById('controlsOverlay');
        this.settings = document.getElementById('settingsOverlay');
        document.getElementById('btnNewGame').addEventListener('click', () => game.newGame());
        document.getElementById('btnContinue').addEventListener('click', () => game.continueGame());
        document.getElementById('btnControls').addEventListener('click', () => this.showControls(true));
        document.getElementById('btnSettings').addEventListener('click', () => this.showSettings(true));
        document.getElementById('btnCloseControls').addEventListener('click', () => this.showControls(false));
        document.getElementById('btnCloseSettings').addEventListener('click', () => this.showSettings(false));
        this.syncContinue();
    }

    syncContinue() {
        const btn = document.getElementById('btnContinue');
        btn.disabled = !this.game.checkpoints.hasSave();
    }

    show(v) {
        this.root.hidden = !v;
        if (v) this.syncContinue();
    }

    showControls(v) {
        this.controls.hidden = !v;
    }

    showSettings(v) {
        this.settings.hidden = !v;
    }
}
