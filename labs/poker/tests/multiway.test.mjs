// Run: node --test labs/poker/tests/
import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, buildPots, canContinue, createMatch, legalActions, startHand, STREET } from '../src/engine.js';
import { chooseAction } from '../src/ai.js';

const total = (m) => m.stacks.reduce((a, b) => a + b, 0) + (m.hand && m.hand.street !== STREET.DONE ? m.hand.pot : 0);

test('buildPots: principal + paralelo, ficha morta de quem desistiu fica no pote', () => {
    // A all-in 100, B e C 300; D desistiu depois de pôr 50.
    const pots = buildPots([100, 300, 300, 50], [false, false, false, true]);
    assert.deepEqual(pots, [
        { amount: 350, eligible: [0, 1, 2] },
        { amount: 400, eligible: [1, 2] }
    ]);
    // Aposta sem cobertura vira fatia de um só (devolução).
    assert.deepEqual(buildPots([40, 100], [false, false]).at(-1), { amount: 60, eligible: [1] });
});

test('4 lugares: botão, blinds e quem abre o pré-flop', () => {
    const m = createMatch({ seats: 4 });
    startHand(m);
    const h = m.hand;
    assert.equal(h.button, 1);
    assert.equal(h.sbSeat, 2);
    assert.equal(h.bbSeat, 3);
    assert.equal(h.toAct, 0); // UTG = herói
    assert.equal(h.pot, 15);
    for (const s of [0, 1, 2, 3]) assert.equal(h.holes[s].length, 2);
});

test('3 jogadores, um all-in curto: pote principal e paralelo pagos certo', () => {
    const m = createMatch({ seats: 3 });
    m.stacks = [100, 1000, 1000];
    startHand(m); // botão 1, SB 2, BB 0, abre o 1
    const h = m.hand;
    // Mão fixa: herói (0) tem a melhor; 1 é o segundo melhor.
    h.holes[0] = ['As', 'Ad']; h.holes[1] = ['Ks', 'Kd']; h.holes[2] = ['7c', '2h'];
    h.deck = ['8c', 'Jh', '9s', '4d', '3c']; // pop() tira do fim: flop 3c 4d 9s
    assert.equal(h.toAct, 1);
    applyAction(m, { type: 'raise', amount: 300 });   // 1 aumenta para 300
    applyAction(m, { type: 'call' });                 // 2 paga 300
    applyAction(m, { type: 'allin' });                // 0 (BB) all-in 100 total
    // 0 estava curto: 1 e 2 seguem para o flop entre si.
    assert.notEqual(m.hand.street, STREET.DONE);
    let guard = 0;
    while (m.hand.street !== STREET.DONE && guard++ < 20) {
        const legal = legalActions(m);
        applyAction(m, legal.find((a) => a.type === 'check') || legal.find((a) => a.type === 'call'));
    }
    const r = m.lastResult;
    assert.equal(r.reason, 'showdown');
    assert.equal(r.pots[0].amount, 300);           // 100 × 3
    assert.deepEqual(r.pots[0].winners, [0]);       // AA leva o principal
    assert.equal(r.pots[1].amount, 400);            // 200 × 2
    assert.deepEqual(r.pots[1].winners, [1]);       // KK leva o paralelo
    assert.equal(m.stacks[0], 300);
    assert.equal(m.stacks.reduce((a, b) => a + b), 2100);
});

test('all-in incompleto não reabre o aumento para quem já agiu', () => {
    const m = createMatch({ seats: 3 });
    m.stacks = [1000, 1000, 1000];
    startHand(m); // abre o 1
    applyAction(m, { type: 'raise', amount: 100 }); // 1 → 100 (aumento de 90)
    m.stacks[2] = 125;                             // SB com 5 na mesa + 125 = 130 total
    applyAction(m, { type: 'allin' });             // 2 → 130: +30 < 90 (incompleto)
    applyAction(m, { type: 'call' });              // 0 (BB) paga 130
    assert.equal(m.hand.toAct, 1);
    const types = legalActions(m).map((a) => a.type);
    assert.ok(!types.includes('raise') && !types.includes('allin'), types.join());
    assert.deepEqual(types, ['fold', 'call']);
});

test('sessões inteiras de 2, 4 e 6 lugares: fichas conservadas, IA sempre legal, sessão termina', () => {
    for (const seats of [2, 4, 6]) {
        for (const level of ['easy', 'normal', 'hard']) {
            const m = createMatch({ seats });
            const start = total(m);
            let hands = 0;
            while (canContinue(m) && hands++ < 600) {
                startHand(m);
                let steps = 0;
                while (m.hand.street !== STREET.DONE) {
                    assert.ok(steps++ < 200, 'mão sem fim');
                    const seat = m.hand.toAct;
                    const act = seat === 0
                        ? (legalActions(m).find((a) => a.type === 'check') || legalActions(m).find((a) => a.type === 'call'))
                        : chooseAction(m, level);
                    assert.ok(applyAction(m, act).ok, `${seats}/${level}: ${JSON.stringify(act)}`);
                }
                assert.equal(total(m), start);
                assert.ok(m.stacks.every((s) => s >= 0 && Number.isInteger(s)));
            }
            assert.ok(!canContinue(m), `${seats} lugares/${level}: terminou em ${hands} mãos`);
        }
    }
});
