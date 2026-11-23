// Busca da IA fora da thread da UI. Qualquer erro vira resposta (move: null)
// para a partida nunca ficar esperando um worker que morreu calado.
import { Chess } from './engine.js?v=6';
import { pickMove } from './ai.js?v=6';
self.onmessage = ({ data }) => {
    try {
        const game = new Chess(data.fen);
        self.postMessage({ move: pickMove(game, data.level), id: data.id });
    } catch (err) {
        self.postMessage({ move: null, error: String(err?.message || err), id: data.id });
    }
};
