import { Chess } from './engine.js?v=5';
import { pickMove } from './ai.js?v=5';
self.onmessage = ({ data }) => {
    const game = new Chess(data.fen);
    self.postMessage({ move: pickMove(game, data.level) });
};
