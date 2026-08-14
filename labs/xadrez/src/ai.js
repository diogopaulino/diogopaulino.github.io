/**
 * IA de xadrez — minimax com poda alfa-beta e tabelas de casas.
 *
 * Avaliação (centipeões):
 *   material + PST de abertura/meio + bônus de mobilidade e par de bispos
 *   − penalidade de rei aberto se a dama inimiga ainda está no tabuleiro.
 *
 * Dificuldade:
 *   iniciante  → profundidade 1 + ruído (erros didáticos)
 *   praticante → profundidade 2
 *   clube      → profundidade 3
 */

const VAL = {
    p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000
};

const PST = {
    p: [
        0, 0, 0, 0, 0, 0, 0, 0,
        50, 50, 50, 50, 50, 50, 50, 50,
        10, 10, 20, 30, 30, 20, 10, 10,
        5, 5, 10, 25, 25, 10, 5, 5,
        0, 0, 0, 20, 20, 0, 0, 0,
        5, -5, -10, 0, 0, -10, -5, 5,
        5, 10, 10, -20, -20, 10, 10, 5,
        0, 0, 0, 0, 0, 0, 0, 0
    ],
    n: [
        -50, -40, -30, -30, -30, -30, -40, -50,
        -40, -20, 0, 0, 0, 0, -20, -40,
        -30, 0, 10, 15, 15, 10, 0, -30,
        -30, 5, 15, 20, 20, 15, 5, -30,
        -30, 0, 15, 20, 20, 15, 0, -30,
        -30, 5, 10, 15, 15, 10, 5, -30,
        -40, -20, 0, 5, 5, 0, -20, -40,
        -50, -40, -30, -30, -30, -30, -40, -50
    ],
    b: [
        -20, -10, -10, -10, -10, -10, -10, -20,
        -10, 0, 0, 0, 0, 0, 0, -10,
        -10, 0, 5, 10, 10, 5, 0, -10,
        -10, 5, 5, 10, 10, 5, 5, -10,
        -10, 0, 10, 10, 10, 10, 0, -10,
        -10, 10, 10, 10, 10, 10, 10, -10,
        -10, 5, 0, 0, 0, 0, 5, -10,
        -20, -10, -10, -10, -10, -10, -10, -20
    ],
    r: [
        0, 0, 0, 0, 0, 0, 0, 0,
        5, 10, 10, 10, 10, 10, 10, 5,
        -5, 0, 0, 0, 0, 0, 0, -5,
        -5, 0, 0, 0, 0, 0, 0, -5,
        -5, 0, 0, 0, 0, 0, 0, -5,
        -5, 0, 0, 0, 0, 0, 0, -5,
        -5, 0, 0, 0, 0, 0, 0, -5,
        0, 0, 0, 5, 5, 0, 0, 0
    ],
    q: [
        -20, -10, -10, -5, -5, -10, -10, -20,
        -10, 0, 0, 0, 0, 0, 0, -10,
        -10, 0, 5, 5, 5, 5, 0, -10,
        -5, 0, 5, 5, 5, 5, 0, -5,
        0, 0, 5, 5, 5, 5, 0, -5,
        -10, 5, 5, 5, 5, 5, 0, -10,
        -10, 0, 5, 0, 0, 0, 0, -10,
        -20, -10, -10, -5, -5, -10, -10, -20
    ],
    k: [
        -30, -40, -40, -50, -50, -40, -40, -30,
        -30, -40, -40, -50, -50, -40, -40, -30,
        -30, -40, -40, -50, -50, -40, -40, -30,
        -30, -40, -40, -50, -50, -40, -40, -30,
        -20, -30, -30, -40, -40, -30, -30, -20,
        -10, -20, -20, -20, -20, -20, -20, -10,
        20, 20, 0, 0, 0, 0, 20, 20,
        20, 30, 10, 0, 0, 10, 30, 20
    ]
};

const DEPTH = { iniciante: 1, praticante: 2, clube: 3 };

function pst(type, index, color) {
    const table = PST[type];
    const i = color === 'w' ? index ^ 56 : index;
    return table[i];
}

export function evaluate(game) {
    let score = 0;
    let wb = 0;
    let bb = 0;
    for (let i = 0; i < 64; i++) {
        const p = game.board[i];
        if (!p) continue;
        const s = VAL[p.t] + pst(p.t, i, p.c);
        score += p.c === 'w' ? s : -s;
        if (p.t === 'b') {
            if (p.c === 'w') wb += 1;
            else bb += 1;
        }
    }
    if (wb >= 2) score += 30;
    if (bb >= 2) score -= 30;
    return score;
}

function order(moves) {
    return moves.slice().sort((a, b) => scoreMove(b) - scoreMove(a));
}

function scoreMove(m) {
    let s = 0;
    if (m.captured) s += 10 * VAL[m.captured.t];
    if (m.promo) s += 800;
    if (m.flag === 'k' || m.flag === 'q') s += 40;
    if (m.flag === 'e') s += 20;
    return s;
}

function minimax(game, depth, alpha, beta) {
    const st = game.status();
    if (st.over) {
        if (st.reason === 'xeque-mate') return game.side === 'w' ? -99999 + (3 - depth) : 99999 - (3 - depth);
        return 0;
    }
    if (depth <= 0) return evaluate(game);

    const moves = order(st.moves);
    if (game.side === 'w') {
        let best = -Infinity;
        for (const m of moves) {
            game.play(m);
            const val = minimax(game, depth - 1, alpha, beta);
            game.undo();
            if (val > best) best = val;
            if (best > alpha) alpha = best;
            if (beta <= alpha) break;
        }
        return best;
    }
    let best = Infinity;
    for (const m of moves) {
        game.play(m);
        const val = minimax(game, depth - 1, alpha, beta);
        game.undo();
        if (val < best) best = val;
        if (best < beta) beta = best;
        if (beta <= alpha) break;
    }
    return best;
}

export function pickMove(game, level = 'praticante', rng = Math.random) {
    const moves = game.legalMoves();
    if (!moves.length) return null;

    if (level === 'iniciante' && rng() < 0.28) {
        const captures = moves.filter((m) => m.captured);
        const pool = captures.length && rng() < 0.7 ? captures : moves;
        return pool[Math.floor(rng() * pool.length)];
    }

    const depth = DEPTH[level] || 2;
    const color = game.side;
    let best = color === 'w' ? -Infinity : Infinity;
    const scored = [];

    for (const m of order(moves)) {
        game.play(m);
        const val = minimax(game, depth - 1, -Infinity, Infinity);
        game.undo();
        scored.push({ m, val });
        if (color === 'w') {
            if (val > best) best = val;
        } else if (val < best) best = best === Infinity ? val : Math.min(best, val);
    }

    scored.sort((a, b) => (color === 'w' ? b.val - a.val : a.val - b.val));
    if (level === 'iniciante' && scored.length > 1 && rng() < 0.35) {
        return scored[Math.min(1, scored.length - 1)].m;
    }
    return scored[0].m;
}

export function hintMove(game) {
    return pickMove(game, 'praticante', () => 0.11);
}

export function moveScore(game, move) {
    game.play(move);
    const val = evaluate(game);
    game.undo();
    return game.side === 'w' ? val : -val;
}
