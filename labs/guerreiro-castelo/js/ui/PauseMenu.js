/**
 * Menu de pausa em Babylon.js.
 */

import { CHECKPOINT_STAGE } from '../core/SceneManager.js';

export class PauseMenu {
    constructor(game) {
        this.game = game;
        this.root = document.getElementById('pauseOverlay');

        document.getElementById('btnResume')?.addEventListener('click', () => this.toggle(false));
        document.getElementById('btnRestartCp')?.addEventListener('click', () => {
            this.toggle(false);
            const cp = game.checkpoints.current || 'home_intro';
            const stage = CHECKPOINT_STAGE[cp] || 'home';
            game.loadStage(stage, cp);
        });
        document.getElementById('btnPauseSettings')?.addEventListener('click', () => {
            this.show(false);
            game.menu.showSettings(true);
        });
        document.getElementById('btnQuitMenu')?.addEventListener('click', () => {
            this.toggle(false);
            game.running = false;
            game.hud.hide();
            game.menu.show();
        });
    }

    toggle(force) {
        const next = force !== undefined ? force : !this.game.paused;
        this.game.paused = next;
        this.show(next);
        if (next) {
            this.game.input.exitLock();
        } else {
            this.game.input.requestLock();
        }
    }

    show(v) {
        if (this.root) this.root.hidden = !v;
    }
}
