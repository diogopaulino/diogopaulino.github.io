import { Chess } from './engine.js';
import { pickMove } from './ai.js';
self.onmessage = ({ data }) => {
    const game = new Chess(data.fen);
    self.postMessage({ move: pickMove(game, data.level) });
};
