// Run directly: node --test labs/xadrez/tests/engine.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { Chess, START_FEN, parseAlg } from '../src/engine.js';
import { LESSONS, PUZZLES } from '../src/coach.js';
import { pickMove } from '../src/ai.js';

const move = (g, from, to, promo = 'q') => {
    const m = g.findMove(parseAlg(from), parseAlg(to), promo);
    assert.ok(m, `${from}-${to} must be legal`);
    g.play(m);
    return m;
};
function perft(game, depth) {
    if (!depth) return 1;
    let n = 0;
    for (const m of game.legalMoves()) { game.play(m); n += perft(game, depth - 1); game.undo(); }
    return n;
}

for (const [name, fen, expected] of [
    ['initial position', START_FEN, 8902],
    ['Kiwipete: castling and pinned pieces', 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', 97862],
    ['rook and pawn ending: en passant', '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', 2812]
]) test(`perft 3: ${name}`, () => {
    const g = new Chess(fen);
    assert.equal(perft(g, 3), expected);
    assert.equal(g.fen(), fen);
    assert.equal(g.stack.length, 0);
});

test('both castling moves relocate the rook and undo exactly', () => {
    const fen = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
    for (const [to, rook] of [['g1', 'f1'], ['c1', 'd1']]) {
        const g = new Chess(fen);
        move(g, 'e1', to);
        assert.equal(g.board[parseAlg(rook)].t, 'r');
        g.undo(); assert.equal(g.fen(), fen);
    }
});

test('en passant removes the bypassed pawn and restores it on undo', () => {
    const fen = '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1';
    const g = new Chess(fen);
    move(g, 'e5', 'd6');
    assert.equal(g.board[parseAlg('d5')], null);
    assert.equal(g.board[parseAlg('d6')].c, 'w');
    g.undo(); assert.equal(g.fen(), fen);
});

test('all four promotion choices are legal and reversible', () => {
    const fen = '3k4/4P3/8/8/8/8/8/4K3 w - - 0 1';
    for (const kind of ['q', 'r', 'b', 'n']) {
        const g = new Chess(fen);
        move(g, 'e7', 'e8', kind);
        assert.equal(g.board[parseAlg('e8')].t, kind);
        g.undo(); assert.equal(g.fen(), fen);
    }
});

test('mate, stalemate, insufficient material, and the fifty-move rule', () => {
    const g = new Chess();
    for (const [a,b] of [['f2','f3'], ['e7','e5'], ['g2','g4'], ['d8','h4']]) move(g,a,b);
    assert.equal(g.status().reason, 'xeque-mate');
    assert.equal(new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1').status().reason, 'afogamento');
    assert.equal(new Chess('4k3/8/8/8/8/8/8/2B1K3 w - - 0 1').status().reason, 'material insuficiente');
    assert.equal(new Chess('4k3/8/8/8/8/8/8/R3K3 w - - 100 1').status().reason, '50 lances');
});

test('every lesson and puzzle still accepts its expected solution', () => {
    for (const task of [...LESSONS, ...PUZZLES]) {
        if (!task.expect) continue;
        const g = new Chess(task.fen), e = task.expect;
        assert.ok(g.findMove(parseAlg(e.from), parseAlg(e.to), e.promo || 'q'), task.id);
    }
});

test('all AI levels return a legal move without mutating the position', () => {
    for (const level of ['iniciante', 'praticante', 'clube']) {
        const g = new Chess(), m = pickMove(g, level);
        assert.ok(g.findMove(m.from, m.to, m.promo));
        assert.equal(g.fen(), START_FEN);
    }
});

test('compressed sculpted assets decode within their declared bounds', () => {
    const layout = JSON.parse(readFileSync(new URL('../assets/staunton.json', import.meta.url)));
    const bytes = gunzipSync(readFileSync(new URL('../assets/staunton.bin.gz', import.meta.url)));
    assert.equal(layout.version, 2);
    assert.equal(Object.keys(layout.pieces).length, 5);
    for (const part of Object.values(layout.pieces)) {
        for (const name of ['positions', 'normals', 'uvs', 'indices']) {
            const [offset, count] = part[name];
            assert.equal(offset % 2, 0);
            assert.ok(offset + count * 2 <= bytes.length);
        }
        const vertices = part.positions[1] / 3;
        assert.equal(part.normals[1], vertices * 3);
        assert.equal(part.uvs[1], vertices * 2);
        for (let i = 0; i < part.indices[1]; i++) assert.ok(bytes.readUInt16LE(part.indices[0] + i * 2) < vertices);
    }
});
