/**
 * Ponto de entrada do jogo O Guerreiro e o Castelo com Babylon.js.
 */

import { Game } from './core/Game.js';

const canvas = document.getElementById('scene') || document.getElementById('gameCanvas');
const game = new Game(canvas);

game.init()
    .then(() => {
        game.start();
    })
    .catch((err) => {
        console.error('[Guerreiro] falha na inicialização', err);
        const el = document.getElementById('loadingText');
        if (el) el.textContent = 'Não foi possível iniciar. Recarregue a página.';
    });

window.__game = game;
