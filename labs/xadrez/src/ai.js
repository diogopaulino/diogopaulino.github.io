/**
 * IA de xadrez — negamax com poda alfa-beta, busca de quiescência e
 * aprofundamento iterativo com orçamento de tempo.
 *
 * Avaliação (centipeões, do ponto de vista das brancas):
 *   material + PST (tabela de casas) + par de bispos (+30).
 *   O rei troca de tabela no final (sem damas ou pouco material): no meio
 *   ele se esconde atrás dos peões; no final ele centraliza e ajuda.
 *
 * Dificuldade:
 *   facil      → 1 ply + ruído grande (±650 cp) e 45% de lances ao acaso:
 *                deixa peças penduradas e não vê mates. Feita para crianças.
 *   iniciante  → 1 ply + ruído (±60 cp) e capturas impulsivas (erros didáticos)
 *   praticante → 2 plies + quiescência (não entrega peça de graça), ~0,6 s
 *   clube      → aprofundamento iterativo até 6 plies + quiescência, ~1,4 s
 *
 * Quiescência: nas folhas, continua só com capturas/promoções até a posição
 * "acalmar" (stand-pat = avaliação estática como limite inferior). Evita o
 * efeito horizonte — capturar a dama protegida porque a recaptura ficou
 * além da profundidade.
 * Ordem dos lances: MVV-LVA (vítima mais valiosa, atacante menos valioso),
 * promoções e o melhor lance da iteração anterior primeiro.
 * Tempo: o relógio é conferido a cada 512 nós; ao estourar, vale o melhor
 * lance da última iteração completa (a IA nunca trava a partida).
 * Mate vale ±(MATE − ply): mate mais curto pontua mais.
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

// Rei no final: centralizar (tabela clássica de Tomasz Michniewski).
const KING_END = [
    -50, -40, -30, -20, -20, -30, -40, -50,
    -30, -20, -10, 0, 0, -10, -20, -30,
    -30, -10, 20, 30, 30, 20, -10, -30,
    -30, -10, 30, 40, 40, 30, -10, -30,
    -30, -10, 30, 40, 40, 30, -10, -30,
    -30, -10, 20, 30, 30, 20, -10, -30,
    -30, -30, 0, 0, 0, 0, -30, -30,
    -50, -30, -30, -30, -30, -30, -30, -50
];

const DEPTH = { facil: 1, iniciante: 1, praticante: 2, clube: 6 };
const BUDGET_MS = { facil: 0, iniciante: 0, praticante: 600, clube: 1400 };
const MATE = 99999;
// Ruído (centipeões) somado à nota de cada lance na raiz.
const NOISE = { facil: 650, iniciante: 60 };
const QS_MAX = 6; // teto de plies extras da quiescência

function pst(type, index, color) {
    const table = PST[type];
    const i = color === 'w' ? index ^ 56 : index;
    return table[i];
}

export function evaluate(game) {
    let score = 0;
    let wb = 0;
    let bb = 0;
    let heavy = 0; // material sem peões nem reis (fase do jogo)
    let queens = 0;
    let wk = -1;
    let bk = -1;
    for (let i = 0; i < 64; i++) {
        const p = game.board[i];
        if (!p) continue;
        if (p.t === 'k') {
            if (p.c === 'w') wk = i; else bk = i;
            continue;
        }
        if (p.t !== 'p') heavy += VAL[p.t];
        if (p.t === 'q') queens += 1;
        const s = VAL[p.t] + pst(p.t, i, p.c);
        score += p.c === 'w' ? s : -s;
        if (p.t === 'b') {
            if (p.c === 'w') wb += 1;
            else bb += 1;
        }
    }
    // Final: sem damas e pouco material, ou material total de peças baixo.
    const endgame = (queens === 0 && heavy <= 3400) || heavy <= 2600;
    const kt = endgame ? KING_END : PST.k;
    if (wk >= 0) score += kt[wk ^ 56];
    if (bk >= 0) score -= kt[bk];
    if (wb >= 2) score += 30;
    if (bb >= 2) score -= 30;
    return score;
}

/** MVV-LVA: tomar a dama com um peão vem antes de tomar um peão com a dama. */
function scoreMove(game, m, best) {
    if (best && m.from === best.from && m.to === best.to && m.promo === best.promo) return 1e6;
    let s = 0;
    if (m.captured) s += 10 * VAL[m.captured.t] - VAL[game.board[m.from]?.t || 'p'] / 10;
    if (m.promo) s += m.promo === 'q' ? 8000 : 100;
    if (m.flag === 'k' || m.flag === 'q') s += 40;
    return s;
}

function order(game, moves, best = null) {
    const keyed = moves.map((m) => ({ m, s: scoreMove(game, m, best) }));
    keyed.sort((a, b) => b.s - a.s);
    return keyed.map((k) => k.m);
}

/** Só capturas e promoções legais — os lances "barulhentos" da quiescência. */
function noisyMoves(game) {
    const out = [];
    for (let i = 0; i < 64; i++) {
        const p = game.board[i];
        if (!p || p.c !== game.side) continue;
        for (const m of game.rawMovesFrom(i)) {
            if ((m.captured || m.promo) && game._legal(m)) out.push(m);
        }
    }
    return out;
}

class Search {
    constructor(game, budgetMs, useQs) {
        this.game = game;
        this.deadline = budgetMs > 0 ? now() + budgetMs : Infinity;
        this.useQs = useQs;
        this.nodes = 0;
        this.aborted = false;
    }

    tick() {
        if ((++this.nodes & 511) === 0 && now() > this.deadline) this.aborted = true;
        return this.aborted;
    }

    /** Nota da posição para quem tem a vez. */
    stat() {
        const e = evaluate(this.game);
        return this.game.side === 'w' ? e : -e;
    }

    quiesce(alpha, beta, ply, qdepth) {
        if (this.tick()) return 0;
        const game = this.game;
        const inCheck = game.inCheck();
        let moves;
        if (inCheck) {
            // Em xeque não existe "ficar parado": todas as defesas contam.
            moves = game.legalMoves();
            if (!moves.length) return -MATE + ply;
        } else {
            const standPat = this.stat();
            if (standPat >= beta) return standPat;
            if (standPat > alpha) alpha = standPat;
            if (qdepth >= QS_MAX) return standPat;
            moves = noisyMoves(game);
        }
        for (const m of order(game, moves)) {
            game.play(m);
            const val = -this.quiesce(-beta, -alpha, ply + 1, qdepth + 1);
            game.undo();
            if (this.aborted) return 0;
            if (val >= beta) return val;
            if (val > alpha) alpha = val;
        }
        return alpha;
    }

    negamax(depth, alpha, beta, ply) {
        if (this.tick()) return 0;
        const game = this.game;
        if (depth <= 0) {
            if (this.useQs) return this.quiesce(alpha, beta, ply, 0);
            // Folha barata: só checa mate quando há xeque.
            if (game.inCheck() && game.legalMoves().length === 0) return -MATE + ply;
            return this.stat();
        }
        const moves = game.legalMoves();
        if (!moves.length) return game.inCheck() ? -MATE + ply : 0;
        if (game.half >= 100 || game._insufficient()) return 0;
        let best = -Infinity;
        for (const m of order(game, moves)) {
            game.play(m);
            const val = -this.negamax(depth - 1, -beta, -alpha, ply + 1);
            game.undo();
            if (this.aborted) return 0;
            if (val > best) best = val;
            if (val > alpha) alpha = val;
            if (alpha >= beta) break;
        }
        return best;
    }
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export function pickMove(game, level = 'praticante', rng = Math.random, opts = {}) {
    const moves = game.legalMoves();
    if (!moves.length) return null;

    if (level === 'facil' && rng() < 0.45) {
        return moves[Math.floor(rng() * moves.length)];
    }
    if (level === 'iniciante' && rng() < 0.28) {
        const captures = moves.filter((m) => m.captured);
        const pool = captures.length && rng() < 0.7 ? captures : moves;
        return pool[Math.floor(rng() * pool.length)];
    }

    const maxDepth = opts.depth || DEPTH[level] || 2;
    const budget = opts.budgetMs ?? BUDGET_MS[level] ?? 600;
    const noise = NOISE[level] || 0;
    const useQs = !noise;
    const track = game.trackKeys;
    game.trackKeys = false;

    try {
        if (noise) {
            // Níveis com ruído: nota exata de cada lance (janela cheia) + sorteio.
            const s = new Search(game, 0, false);
            const scored = [];
            for (const m of moves) {
                game.play(m);
                const val = -s.negamax(maxDepth - 1, -Infinity, Infinity, 1);
                game.undo();
                scored.push({ m, val: val + (rng() * 2 - 1) * noise });
            }
            scored.sort((a, b) => b.val - a.val);
            if (level === 'iniciante' && scored.length > 1 && rng() < 0.35) return scored[1].m;
            return scored[0].m;
        }

        // Aprofundamento iterativo: 1, 2, … até maxDepth ou o tempo acabar.
        const s = new Search(game, budget, useQs);
        let best = order(game, moves)[0];
        for (let depth = 1; depth <= maxDepth; depth++) {
            let alpha = -Infinity;
            let iterBest = null;
            for (const m of order(game, moves, best)) {
                game.play(m);
                const val = -s.negamax(depth - 1, -Infinity, -alpha, 1);
                game.undo();
                if (s.aborted) break;
                if (val > alpha) { alpha = val; iterBest = m; }
            }
            if (s.aborted) break;
            if (iterBest) best = iterBest;
            if (alpha >= MATE - 64) break; // achou mate: não precisa ir mais fundo
        }
        return best;
    } finally {
        game.trackKeys = track;
    }
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
