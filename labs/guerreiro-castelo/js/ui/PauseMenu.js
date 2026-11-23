/**
 * Menu de pausa: continuar, reiniciar checkpoint, controles, configurações, sair.
 * Abre por Esc, pelo botão ⏸ do HUD (mouse e toque), ao trocar de aba ou ao perder o
 * foco da janela. Pausar solta todas as teclas e botões (nada fica preso na volta) e
 * leva o foco do teclado para "Continuar".
 */

import { CHECKPOINT_STAGE } from '../core/SceneManager.js?v=50';

export class PauseMenu {
    constructor(game) {
        this.game = game;
        this.root = document.getElementById('pauseOverlay');

        document.getElementById('btnResume')?.addEventListener('click', () => this.toggle(false));
        document.getElementById('btnPause')?.addEventListener('click', (e) => {
            e.preventDefault();
            if (game.running && !game.loading) this.toggle(!game.paused);
        });
        document.getElementById('btnPauseControls')?.addEventListener('click', () => {
            this.show(false);
            game.menu.showControls(true);
        });
        document.getElementById('btnRestartCp')?.addEventListener('click', () => {
            this.toggle(false);
            const cp = game.checkpoints.current || 'home_intro';
            const stage = CHECKPOINT_STAGE[cp] || 'home';
            const data = game.checkpoints.load();
            if (data) game.story.applySave(data);
            game.player.heal();
            game.loadStage(stage, cp);
        });
        document.getElementById('btnPauseSettings')?.addEventListener('click', () => {
            this.show(false);
            game.menu.showSettings(true);
        });
        document.getElementById('btnQuitMenu')?.addEventListener('click', () => {
            this.toggle(false);
            game.quitToMenu();
        });
    }

    toggle(force) {
        const next = force !== undefined ? force : !this.game.paused;
        this.game.paused = next;
        this.show(next);
        this.game.input.release();
        document.body.toggleAttribute('data-paused', next);
        if (next) {
            this.game.input.exitLock();
            const obj = document.getElementById('pauseObjective');
            const cur = document.getElementById('objective')?.textContent;
            if (obj) obj.textContent = cur ? `Objetivo: ${cur}` : '';
            /* foco no primeiro botão: Enter/Espaço continua, Tab navega */
            requestAnimationFrame(() => document.getElementById('btnResume')?.focus({ preventScroll: true }));
        } else {
            document.getElementById('controlsOverlay')?.setAttribute('hidden', '');
            document.getElementById('settingsOverlay')?.setAttribute('hidden', '');
            this.game.input.requestLock();
            /* tira o foco do botão para o Espaço voltar a ser pulo, não clique */
            if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        }
    }

    show(v) {
        if (this.root) this.root.hidden = !v;
    }
}
