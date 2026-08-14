export class PauseMenu {
    constructor(game) {
        this.game = game;
        this.root = document.getElementById('pauseOverlay');
        document.getElementById('btnResume').addEventListener('click', () => game.setPaused(false));
        document.getElementById('btnRestartCp').addEventListener('click', () => {
            game.setPaused(false);
            game.reloadCheckpoint();
        });
        document.getElementById('btnPauseSettings').addEventListener('click', () => {
            this.root.hidden = true;
            document.getElementById('settingsOverlay').hidden = false;
        });
        document.getElementById('btnQuitMenu').addEventListener('click', () => game.quitToMenu());
    }

    show(v) {
        this.root.hidden = !v;
    }
}
