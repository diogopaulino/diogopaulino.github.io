import * as THREE from 'three';
import { Game } from './core/Game.js';

const game = new Game();
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.05);
    game.update(delta);
    game.render();
}

game.init()
    .then(() => animate())
    .catch((err) => {
        console.error('[Guerreiro] falha na inicialização', err);
        const el = document.getElementById('loadingText');
        if (el) el.textContent = 'Não foi possível iniciar. Recarregue a página.';
    });

window.__game = game;
