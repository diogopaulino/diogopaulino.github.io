/**
 * Motor de xadrez — regras FIDE no tabuleiro 0–63.
 *
 * Índice = rank * 8 + file (a1 = 0, h1 = 7, a8 = 56, h8 = 63).
 * Brancas avançam +rank. Lances legais filtram xeque próprio (cravadas).
 *
 * Roque: direitos + caminho vazio + rei não atravessa casa atacada.
 * En passant: casa-alvo atrás do peão que andou dois; captura remove o peão.
 * Promoção: peão na última fila vira D/T/B/C (padrão Dama).
 * Mate = sem lances legais e rei em xeque; afogamento = sem lances e sem xeque.
 */

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const FILES = 'abcdefgh';

export const PIECE_NAME = {
    p: 'Peão',
    n: 'Cavalo',
    b: 'Bispo',
    r: 'Torre',
    q: 'Dama',
    k: 'Rei'
};

export const PIECE_HOW = {
    p: 'Anda uma casa à frente (duas no primeiro lance). Captura só na diagonal. Na última fila, promove.',
    n: 'Salta em L: duas casas numa direção e uma perpendicular. Única peça que pula as outras.',
    b: 'Desliza nas diagonais, qualquer número de casas, sem pular peças.',
    r: 'Desliza nas colunas e fileiras, qualquer número de casas, sem pular peças.',
    q: 'Une torre e bispo: qualquer direção em linha reta, sem pular peças.',
    k: 'Anda uma casa em qualquer direção. O roque é o lance especial com a torre.'
};

export const PIECE_VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

const KNIGHT_D = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
const KING_D = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const BISHOP_D = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const ROOK_D = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function sq(file, rank) {
    return rank * 8 + file;
}

export function fileOf(i) {
    return i & 7;
}

export function rankOf(i) {
    return i >> 3;
}

export function inBoard(file, rank) {
    return file >= 0 && file < 8 && rank >= 0 && rank < 8;
}

export function alg(i) {
    return FILES[fileOf(i)] + (rankOf(i) + 1);
}

export function parseAlg(s) {
    if (!s || s.length < 2) return -1;
    const f = FILES.indexOf(s[0]);
    const r = Number(s[1]) - 1;
    if (!inBoard(f, r)) return -1;
    return sq(f, r);
}

function cloneCastling(c) {
    return { K: c.K, Q: c.Q, k: c.k, q: c.q };
}

function pieceFromChar(ch) {
    const t = ch.toLowerCase();
    return { t, c: ch === t ? 'b' : 'w' };
}

function charFromPiece(p) {
    return p.c === 'w' ? p.t.toUpperCase() : p.t;
}

export class Chess {
    constructor(fen = START_FEN) {
        this.board = new Array(64).fill(null);
        this.side = 'w';
        this.castling = { K: true, Q: true, k: true, q: true };
        this.ep = -1;
        this.half = 0;
        this.full = 1;
        this.stack = [];
        this.load(fen);
    }

    clone() {
        const g = new Chess('8/8/8/8/8/8/8/8 w - - 0 1');
        g.board = this.board.map((p) => (p ? { t: p.t, c: p.c } : null));
        g.side = this.side;
        g.castling = cloneCastling(this.castling);
        g.ep = this.ep;
        g.half = this.half;
        g.full = this.full;
        g.stack = [];
        return g;
    }

    load(fen) {
        const parts = fen.trim().split(/\s+/);
        const rows = parts[0].split('/');
        this.board.fill(null);
        for (let r = 7; r >= 0; r--) {
            const row = rows[7 - r];
            let f = 0;
            for (const ch of row) {
                if (ch >= '1' && ch <= '8') {
                    f += Number(ch);
                } else {
                    this.board[sq(f, r)] = pieceFromChar(ch);
                    f += 1;
                }
            }
        }
        this.side = parts[1] === 'b' ? 'b' : 'w';
        const cr = parts[2] || '-';
        this.castling = {
            K: cr.includes('K'),
            Q: cr.includes('Q'),
            k: cr.includes('k'),
            q: cr.includes('q')
        };
        this.ep = parts[3] && parts[3] !== '-' ? parseAlg(parts[3]) : -1;
        this.half = Number(parts[4] || 0);
        this.full = Number(parts[5] || 1);
        this.stack = [];
    }

    fen() {
        let rows = '';
        for (let r = 7; r >= 0; r--) {
            let empty = 0;
            for (let f = 0; f < 8; f++) {
                const p = this.board[sq(f, r)];
                if (!p) {
                    empty += 1;
                } else {
                    if (empty) {
                        rows += String(empty);
                        empty = 0;
                    }
                    rows += charFromPiece(p);
                }
            }
            if (empty) rows += String(empty);
            if (r) rows += '/';
        }
        let cr = '';
        if (this.castling.K) cr += 'K';
        if (this.castling.Q) cr += 'Q';
        if (this.castling.k) cr += 'k';
        if (this.castling.q) cr += 'q';
        if (!cr) cr = '-';
        const ep = this.ep < 0 ? '-' : alg(this.ep);
        return `${rows} ${this.side} ${cr} ${ep} ${this.half} ${this.full}`;
    }

    kingIndex(color) {
        for (let i = 0; i < 64; i++) {
            const p = this.board[i];
            if (p && p.t === 'k' && p.c === color) return i;
        }
        return -1;
    }

    isAttacked(index, byColor) {
        const f = fileOf(index);
        const r = rankOf(index);
        const pawnDir = byColor === 'w' ? -1 : 1;
        for (const df of [-1, 1]) {
            const pf = f + df;
            const pr = r + pawnDir;
            if (inBoard(pf, pr)) {
                const p = this.board[sq(pf, pr)];
                if (p && p.t === 'p' && p.c === byColor) return true;
            }
        }
        for (const [df, dr] of KNIGHT_D) {
            const nf = f + df;
            const nr = r + dr;
            if (!inBoard(nf, nr)) continue;
            const p = this.board[sq(nf, nr)];
            if (p && p.t === 'n' && p.c === byColor) return true;
        }
        for (const [df, dr] of KING_D) {
            const nf = f + df;
            const nr = r + dr;
            if (!inBoard(nf, nr)) continue;
            const p = this.board[sq(nf, nr)];
            if (p && p.t === 'k' && p.c === byColor) return true;
        }
        if (this._slideHits(f, r, BISHOP_D, byColor, 'bq')) return true;
        if (this._slideHits(f, r, ROOK_D, byColor, 'rq')) return true;
        return false;
    }

    _slideHits(f, r, dirs, byColor, types) {
        for (const [df, dr] of dirs) {
            let nf = f + df;
            let nr = r + dr;
            while (inBoard(nf, nr)) {
                const p = this.board[sq(nf, nr)];
                if (p) {
                    if (p.c === byColor && types.includes(p.t)) return true;
                    break;
                }
                nf += df;
                nr += dr;
            }
        }
        return false;
    }

    inCheck(color = this.side) {
        const k = this.kingIndex(color);
        if (k < 0) return false;
        return this.isAttacked(k, color === 'w' ? 'b' : 'w');
    }

    /**
     * Lances pseudo-legais a partir de uma casa (ainda podem deixar o rei em xeque).
     */
    rawMovesFrom(from) {
        const p = this.board[from];
        if (!p) return [];
        const out = [];
        const f = fileOf(from);
        const r = rankOf(from);
        if (p.t === 'p') this._pawnMoves(from, f, r, p, out);
        else if (p.t === 'n') this._stepMoves(from, f, r, p, KNIGHT_D, out);
        else if (p.t === 'k') {
            this._stepMoves(from, f, r, p, KING_D, out);
            this._castleMoves(from, p, out);
        } else if (p.t === 'b') this._slideMoves(from, f, r, p, BISHOP_D, out);
        else if (p.t === 'r') this._slideMoves(from, f, r, p, ROOK_D, out);
        else if (p.t === 'q') this._slideMoves(from, f, r, p, [...BISHOP_D, ...ROOK_D], out);
        return out;
    }

    _push(out, from, to, extra = {}) {
        const captured = extra.captured ?? this.board[to];
        out.push({
            from,
            to,
            promo: extra.promo || null,
            captured: captured || null,
            flag: extra.flag || (captured ? 'c' : 'n'),
            epCap: extra.epCap ?? -1
        });
    }

    _pawnMoves(from, f, r, p, out) {
        const dir = p.c === 'w' ? 1 : -1;
        const start = p.c === 'w' ? 1 : 6;
        const last = p.c === 'w' ? 7 : 0;
        const fwd = r + dir;
        if (inBoard(f, fwd) && !this.board[sq(f, fwd)]) {
            if (fwd === last) this._promos(out, from, sq(f, fwd), null);
            else {
                this._push(out, from, sq(f, fwd));
                const two = r + dir * 2;
                if (r === start && inBoard(f, two) && !this.board[sq(f, two)]) {
                    this._push(out, from, sq(f, two), { flag: 'd' });
                }
            }
        }
        for (const df of [-1, 1]) {
            const nf = f + df;
            const nr = r + dir;
            if (!inBoard(nf, nr)) continue;
            const to = sq(nf, nr);
            const t = this.board[to];
            if (t && t.c !== p.c) {
                if (nr === last) this._promos(out, from, to, t);
                else this._push(out, from, to, { captured: t, flag: 'c' });
            } else if (to === this.ep && this.ep >= 0) {
                const capSq = sq(nf, r);
                this._push(out, from, to, {
                    captured: this.board[capSq],
                    flag: 'e',
                    epCap: capSq
                });
            }
        }
    }

    _promos(out, from, to, captured) {
        for (const promo of ['q', 'r', 'b', 'n']) {
            this._push(out, from, to, { promo, captured, flag: captured ? 'c' : 'n' });
        }
    }

    _stepMoves(from, f, r, p, dirs, out) {
        for (const [df, dr] of dirs) {
            const nf = f + df;
            const nr = r + dr;
            if (!inBoard(nf, nr)) continue;
            const to = sq(nf, nr);
            const t = this.board[to];
            if (!t) this._push(out, from, to);
            else if (t.c !== p.c) this._push(out, from, to, { captured: t, flag: 'c' });
        }
    }

    _slideMoves(from, f, r, p, dirs, out) {
        for (const [df, dr] of dirs) {
            let nf = f + df;
            let nr = r + dr;
            while (inBoard(nf, nr)) {
                const to = sq(nf, nr);
                const t = this.board[to];
                if (!t) this._push(out, from, to);
                else {
                    if (t.c !== p.c) this._push(out, from, to, { captured: t, flag: 'c' });
                    break;
                }
                nf += df;
                nr += dr;
            }
        }
    }

    _castleMoves(from, p, out) {
        if (this.inCheck(p.c)) return;
        const enemy = p.c === 'w' ? 'b' : 'w';
        if (p.c === 'w' && from === 4) {
            if (this.castling.K && !this.board[5] && !this.board[6]
                && !this.isAttacked(5, enemy) && !this.isAttacked(6, enemy)
                && this.board[7]?.t === 'r' && this.board[7]?.c === 'w') {
                this._push(out, from, 6, { flag: 'k' });
            }
            if (this.castling.Q && !this.board[3] && !this.board[2] && !this.board[1]
                && !this.isAttacked(3, enemy) && !this.isAttacked(2, enemy)
                && this.board[0]?.t === 'r' && this.board[0]?.c === 'w') {
                this._push(out, from, 2, { flag: 'q' });
            }
        }
        if (p.c === 'b' && from === 60) {
            if (this.castling.k && !this.board[61] && !this.board[62]
                && !this.isAttacked(61, enemy) && !this.isAttacked(62, enemy)
                && this.board[63]?.t === 'r' && this.board[63]?.c === 'b') {
                this._push(out, from, 62, { flag: 'k' });
            }
            if (this.castling.q && !this.board[59] && !this.board[58] && !this.board[57]
                && !this.isAttacked(59, enemy) && !this.isAttacked(58, enemy)
                && this.board[56]?.t === 'r' && this.board[56]?.c === 'b') {
                this._push(out, from, 58, { flag: 'q' });
            }
        }
    }

    legalMovesFrom(from) {
        const p = this.board[from];
        if (!p || p.c !== this.side) return [];
        return this.rawMovesFrom(from).filter((m) => this._legal(m));
    }

    legalMoves() {
        const all = [];
        for (let i = 0; i < 64; i++) {
            const p = this.board[i];
            if (p && p.c === this.side) {
                const ms = this.rawMovesFrom(i).filter((m) => this._legal(m));
                all.push(...ms);
            }
        }
        return all;
    }

    _legal(move) {
        this.play(move);
        const ok = !this.inCheck(this.side === 'w' ? 'b' : 'w');
        this.undo();
        return ok;
    }

    play(move) {
        const piece = this.board[move.from];
        const undo = {
            from: move.from,
            to: move.to,
            piece,
            captured: move.captured ? { t: move.captured.t, c: move.captured.c } : null,
            promo: move.promo,
            flag: move.flag,
            epCap: move.epCap,
            ep: this.ep,
            castling: cloneCastling(this.castling),
            half: this.half,
            full: this.full,
            side: this.side,
            rookFrom: -1,
            rookTo: -1
        };

        this.board[move.to] = piece;
        this.board[move.from] = null;

        if (move.flag === 'e' && move.epCap >= 0) {
            this.board[move.epCap] = null;
        }

        if (move.flag === 'k' || move.flag === 'q') {
            const rank = rankOf(move.from);
            if (move.flag === 'k') {
                undo.rookFrom = sq(7, rank);
                undo.rookTo = sq(5, rank);
            } else {
                undo.rookFrom = sq(0, rank);
                undo.rookTo = sq(3, rank);
            }
            this.board[undo.rookTo] = this.board[undo.rookFrom];
            this.board[undo.rookFrom] = null;
        }

        if (move.promo) {
            this.board[move.to] = { t: move.promo, c: piece.c };
        }

        if (piece.t === 'k') {
            if (piece.c === 'w') {
                this.castling.K = false;
                this.castling.Q = false;
            } else {
                this.castling.k = false;
                this.castling.q = false;
            }
        }
        if (piece.t === 'r') {
            if (move.from === 0) this.castling.Q = false;
            if (move.from === 7) this.castling.K = false;
            if (move.from === 56) this.castling.q = false;
            if (move.from === 63) this.castling.k = false;
        }
        if (move.captured?.t === 'r') {
            if (move.to === 0) this.castling.Q = false;
            if (move.to === 7) this.castling.K = false;
            if (move.to === 56) this.castling.q = false;
            if (move.to === 63) this.castling.k = false;
        }

        this.ep = -1;
        if (move.flag === 'd') {
            this.ep = sq(fileOf(move.from), (rankOf(move.from) + rankOf(move.to)) >> 1);
        }

        const isPawn = piece.t === 'p';
        this.half = isPawn || move.captured ? 0 : this.half + 1;
        if (this.side === 'b') this.full += 1;
        this.side = this.side === 'w' ? 'b' : 'w';
        this.stack.push(undo);
        return undo;
    }

    undo() {
        const u = this.stack.pop();
        if (!u) return;
        this.board[u.from] = u.piece;
        this.board[u.to] = u.flag === 'e' ? null : u.captured;
        if (u.flag === 'e' && u.epCap >= 0) this.board[u.epCap] = u.captured;
        if (u.rookFrom >= 0) {
            this.board[u.rookFrom] = this.board[u.rookTo];
            this.board[u.rookTo] = null;
        }
        this.ep = u.ep;
        this.castling = u.castling;
        this.half = u.half;
        this.full = u.full;
        this.side = u.side;
    }

    san(move) {
        if (move.flag === 'k') return this._checkSuffix(move, 'O-O');
        if (move.flag === 'q') return this._checkSuffix(move, 'O-O-O');
        const piece = this.board[move.from];
        const dest = alg(move.to);
        const capture = !!(move.captured || move.flag === 'e' || move.flag === 'c');
        let body;
        if (piece.t === 'p') {
            body = capture ? `${FILES[fileOf(move.from)]}x${dest}` : dest;
            if (move.promo) body += `=${move.promo.toUpperCase()}`;
        } else {
            const letter = piece.t.toUpperCase();
            body = `${letter}${this._disamb(move, piece)}${capture ? 'x' : ''}${dest}`;
            if (move.promo) body += `=${move.promo.toUpperCase()}`;
        }
        return this._checkSuffix(move, body);
    }

    _disamb(move, piece) {
        const others = [];
        for (let i = 0; i < 64; i++) {
            if (i === move.from) continue;
            const p = this.board[i];
            if (!p || p.t !== piece.t || p.c !== piece.c) continue;
            const hits = this.rawMovesFrom(i).some((m) => m.to === move.to && this._legal(m));
            if (hits) others.push(i);
        }
        if (!others.length) return '';
        const sameFile = others.some((i) => fileOf(i) === fileOf(move.from));
        const sameRank = others.some((i) => rankOf(i) === rankOf(move.from));
        if (!sameFile) return FILES[fileOf(move.from)];
        if (!sameRank) return String(rankOf(move.from) + 1);
        return alg(move.from);
    }

    _checkSuffix(move, body) {
        this.play(move);
        const enemy = this.side;
        const check = this.inCheck(enemy);
        const none = this.legalMoves().length === 0;
        this.undo();
        if (check && none) return `${body}#`;
        if (check) return `${body}+`;
        return body;
    }

    status() {
        const moves = this.legalMoves();
        const check = this.inCheck();
        if (!moves.length) {
            return {
                over: true,
                result: check ? (this.side === 'w' ? '0-1' : '1-0') : '½-½',
                reason: check ? 'xeque-mate' : 'afogamento',
                check,
                moves
            };
        }
        if (this.half >= 100) {
            return { over: true, result: '½-½', reason: '50 lances', check, moves };
        }
        if (this._insufficient()) {
            return { over: true, result: '½-½', reason: 'material insuficiente', check, moves };
        }
        return { over: false, result: '*', reason: check ? 'xeque' : '', check, moves };
    }

    _insufficient() {
        const pcs = this.board.filter(Boolean);
        if (pcs.length === 2) return true;
        if (pcs.length === 3) {
            return pcs.some((p) => p.t === 'n' || p.t === 'b');
        }
        if (pcs.length === 4) {
            const bishops = pcs.filter((p) => p.t === 'b');
            if (bishops.length === 2) {
                const sqs = [];
                this.board.forEach((p, i) => { if (p?.t === 'b') sqs.push(i); });
                const color = (i) => (fileOf(i) + rankOf(i)) & 1;
                return color(sqs[0]) === color(sqs[1]);
            }
        }
        return false;
    }

    findMove(from, to, promo = 'q') {
        const list = this.legalMovesFrom(from);
        const hits = list.filter((m) => m.to === to);
        if (!hits.length) return null;
        if (hits.length === 1) return hits[0];
        return hits.find((m) => m.promo === promo) || hits.find((m) => m.promo === 'q') || hits[0];
    }

    moveBySan(san) {
        const want = san.replace(/[+#]/g, '');
        for (const m of this.legalMoves()) {
            if (this.san(m).replace(/[+#]/g, '') === want) return m;
        }
        return null;
    }

    material(color) {
        let n = 0;
        for (const p of this.board) {
            if (p && p.c === color) n += PIECE_VALUE[p.t];
        }
        return n;
    }

    hanging(index) {
        const p = this.board[index];
        if (!p) return false;
        const enemy = p.c === 'w' ? 'b' : 'w';
        if (!this.isAttacked(index, enemy)) return false;
        return !this.isAttacked(index, p.c);
    }
}
