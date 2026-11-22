import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, canContinue, createMatch, legalActions, startHand, STREET } from '../src/engine.js';

function deal(stacks) {
    const match = createMatch();
    match.stacks = stacks;
    startHand(match);
    return match;
}

test('small blind esgotado encerra a mão e devolve o excedente do big blind', () => {
    const match = deal([100, 3]);
    assert.equal(match.hand.street, STREET.DONE);
    assert.equal(match.hand.board.length, 5);
    assert.equal(match.lastResult.pot, 6);
    assert.equal(match.stacks[0] + match.stacks[1], 103);
});

test('big blind all-in permite somente desistir ou cobrir a diferença', () => {
    const match = deal([8, 100]);
    assert.deepEqual(legalActions(match).map(action => action.type), ['fold', 'call']);
    assert.equal(applyAction(match, { type: 'call' }).handOver, true);
    assert.equal(match.lastResult.pot, 16);
});

test('call curto disputa apenas a parte coberta do all-in', () => {
    const match = deal([26, 100]);
    applyAction(match, { type: 'allin' });
    assert.equal(applyAction(match, { type: 'call' }).handOver, true);
    assert.equal(match.lastResult.pot, 52);
    assert.ok(match.stacks[1] >= 74);
});

import { BLIND_EVERY, compareScores, createDeck, equityVsRandom, evaluateHand, evaluateHandSlow, shuffle } from '../src/engine.js';
import { chooseAction } from '../src/ai.js';

const score = (cards) => evaluateHand(cards.split(' '));

test('desempates do ranking: kicker, roda (A-5) e mão da mesa', () => {
    // Mesmo par, kicker decide.
    assert.ok(compareScores(score('Ah Ad Kc 7s 4d 3c 2h'), score('Ah Ad Qc 7s 4d 3c 2h')) > 0);
    // Roda A-2-3-4-5 perde para 2-3-4-5-6.
    assert.ok(compareScores(score('Ah 2d 3c 4s 5d Kc Kh'), score('6h 2d 3c 4s 5d Kc Kh')) < 0);
    assert.equal(score('Ah 2d 3c 4s 5d 9c Jh').ranks[0], 3);
    // Flush contra flush: segunda carta desempata.
    assert.ok(compareScores(score('Ah Kh 9h 5h 2h'), score('Ah Qh Jh 5h 2h')) > 0);
    // Dois pares: o kicker pode ser o terceiro par.
    assert.deepEqual(score('Ah Ad Kc Ks Qd Qc 2h').ranks, [12, 11, 10]);
    // Full house com duas trincas usa a maior como trinca.
    assert.deepEqual(score('9h 9d 9c 4s 4d 4c 2h').ranks, [7, 2]);
    // Mesa joga (royal na mesa) → empate exato.
    assert.equal(compareScores(score('2c 3d Ah Kh Qh Jh Th'), score('7c 8d Ah Kh Qh Jh Th')), 0);
});

test('avaliador rápido = referência lenta (amostra aleatória)', () => {
    for (let i = 0; i < 4000; i++) {
        const cards = shuffle(createDeck()).slice(0, 5 + (i % 3));
        const a = evaluateHand(cards);
        const b = evaluateHandSlow(cards);
        assert.equal(compareScores(a, b), 0, cards.join(' '));
        assert.equal(compareScores(evaluateHandSlow(a.cards), a), 0, 'as 5 cartas devolvidas formam a mão');
    }
});

test('split pot: mesa com royal flush divide o pote ao meio', () => {
    const match = createMatch();
    startHand(match);
    const h = match.hand;
    h.holes = [['2c', '3d'], ['4c', '5d']];
    h.deck = ['9s', '8s', 'Ah', 'Kh', 'Qh', 'Jh', 'Th'];
    applyAction(match, { type: 'call' });
    while (match.hand.street !== STREET.DONE) applyAction(match, { type: 'check' });
    assert.deepEqual(match.lastResult.winners, [0, 1]);
    assert.deepEqual(match.stacks, [1000, 1000]);
});

test('blinds dobram a cada BLIND_EVERY mãos e a sessão sempre termina', () => {
    const match = createMatch();
    for (let i = 0; i < BLIND_EVERY; i++) {
        startHand(match);
        applyAction(match, { type: 'fold' });
    }
    startHand(match);
    assert.equal(match.bigBlind, 20);
    assert.equal(match.smallBlind, 10);
    const m2 = createMatch();
    let hands = 0;
    while (canContinue(m2) && hands < 500) {
        startHand(m2); hands++;
        while (m2.hand.street !== STREET.DONE) {
            const a = legalActions(m2);
            applyAction(m2, a.find(x => x.type === 'check') || a.find(x => x.type === 'call'));
        }
        assert.equal(m2.stacks[0] + m2.stacks[1], 2000);
    }
    assert.ok(!canContinue(m2), `sessão de calls terminou em ${hands} mãos`);
});

test('all-in curto é aceito mesmo quando a mesa oferece só bet do stack inteiro', () => {
    const match = deal([1000, 1000]);
    match.stacks[match.hand.toAct] = 2; // menos que o min-raise
    const legal = legalActions(match);
    const out = applyAction(match, { type: 'allin' });
    assert.ok(out.ok, JSON.stringify(legal));
});

test('IA sempre devolve ação aceita pelo motor, em sessões inteiras', () => {
    for (const level of ['easy', 'normal', 'hard']) {
        const match = createMatch();
        let guard = 0;
        while (canContinue(match) && guard++ < 400) {
            startHand(match);
            while (match.hand.street !== STREET.DONE) {
                assert.ok(applyAction(match, chooseAction(match, level)).ok);
            }
        }
    }
});

test('medidor de força ordena mãos óbvias', () => {
    assert.ok(equityVsRandom(['Ah', 'As'], [], 400) > 0.75);
    assert.ok(equityVsRandom(['7c', '2d'], [], 400) < 0.42);
});
