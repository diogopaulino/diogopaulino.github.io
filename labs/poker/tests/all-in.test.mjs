import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createMatch, legalActions, startHand, STREET } from '../src/engine.js';

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
