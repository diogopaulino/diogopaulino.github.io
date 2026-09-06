/**
 * IA heads-up — decisões por força de mão + pot odds + rua.
 *
 * Heurística (não é solver GTO):
 * - Pré-flop: holeStrength → fold / call / raise por faixas.
 * - Pós-flop: equity Monte Carlo leve vs hole do vilão quando conhecida
 *   (no play normal a IA NÃO vê as cartas do herói; usa força da própria
 *   mão + board texture + pot odds).
 * - Pot odds: call se equityEstimada >= toCall/(pot+toCall) com margem.
 */

import {
    estimateEquity,
    evaluateHand,
    holeStrength,
    legalActions,
    potOdds,
    STREET
} from './engine.js';

const DIFFICULTY = {
    easy: { aggression: 0.55, bluff: 0.06, callMargin: 0.08, thinkMs: [450, 900] },
    normal: { aggression: 0.75, bluff: 0.12, callMargin: 0.03, thinkMs: [500, 1100] },
    hard: { aggression: 0.95, bluff: 0.18, callMargin: -0.02, thinkMs: [400, 800] }
};

export function getDifficulty(level = 'normal') {
    return DIFFICULTY[level] || DIFFICULTY.normal;
}

export function chooseAction(match, level = 'normal') {
    const cfg = getDifficulty(level);
    const legal = legalActions(match);
    if (!legal.length) return null;

    const h = match.hand;
    const seat = h.toAct;
    const hole = h.holes[seat];
    const board = h.board;
    const toCall = Math.max(0, h.currentBet - h.streetContrib[seat]);
    const stack = match.stacks[seat];
    const pot = h.pot;
    const odds = potOdds(toCall, pot);

    let strength;
    if (h.street === STREET.PREFLOP || board.length === 0) {
        strength = holeStrength(hole);
    } else {
        const made = evaluateHand([...hole, ...board]);
        // Categoria 0–9 → base; kickers suavizam
        strength = (made.category + 1) / 10 * 0.7 + (made.ranks[0] || 0) / 12 * 0.15;
        // Draw bonus simples: flush draw / OESD aproximado
        strength += drawBonus(hole, board) * 0.12;
        strength = Math.min(0.98, strength);
    }

    // Bluff ocasional em spot de check/bet
    const roll = match.rng();
    const wantBluff = roll < cfg.bluff && strength < 0.35;

    const fold = legal.find((a) => a.type === 'fold');
    const check = legal.find((a) => a.type === 'check');
    const call = legal.find((a) => a.type === 'call');
    const bet = legal.find((a) => a.type === 'bet');
    const raise = legal.find((a) => a.type === 'raise');
    const allin = legal.find((a) => a.type === 'allin');

    // All-in curto: commit se stack <= 8 BB e strength decente
    const bb = match.bigBlind;
    if (stack <= bb * 8 && strength >= 0.55 && allin) {
        return { type: 'allin', amount: allin.amount };
    }

    if (toCall <= 0) {
        // Opção de check ou bet
        if (wantBluff && bet) {
            return sizeBet(bet, pot, stack, 0.45);
        }
        if (strength >= 0.62 * (1.1 - cfg.aggression * 0.2) && bet) {
            const frac = strength > 0.8 ? 0.75 : 0.55;
            return sizeBet(bet, pot, stack, frac);
        }
        if (check) return { type: 'check', amount: 0 };
        if (bet) return sizeBet(bet, pot, stack, 0.4);
        return legal[0];
    }

    // Facing a bet
    const equity = strength; // proxy sem ver hole do herói
    const threshold = odds + cfg.callMargin;

    if (equity + 0.02 < threshold && strength < 0.45) {
        // Fold fraco
        if (fold && !wantBluff) return { type: 'fold', amount: 0 };
    }

    if ((strength >= 0.72 || wantBluff) && raise && equity >= threshold - 0.05) {
        return sizeRaise(raise, pot, toCall, stack, strength > 0.85 ? 1.0 : 0.7);
    }

    if (call && (equity >= threshold || strength >= 0.5 || toCall <= bb)) {
        return { type: 'call', amount: call.amount };
    }

    if (fold) return { type: 'fold', amount: 0 };
    if (call) return { type: 'call', amount: call.amount };
    return legal[0];
}

function sizeBet(betAction, pot, stack, frac) {
    const target = Math.round(Math.max(betAction.min, Math.min(betAction.max, pot * frac)));
    if (target >= stack * 0.9 && betAction.max >= stack) {
        return { type: 'allin', amount: stack };
    }
    return { type: 'bet', amount: Math.min(betAction.max, Math.max(betAction.min, target)) };
}

function sizeRaise(raiseAction, pot, toCall, stack, mult) {
    const target = Math.round(toCall + Math.max(pot * 0.55, toCall) * mult);
    const amt = Math.min(raiseAction.max, Math.max(raiseAction.min, target));
    if (amt >= stack * 0.85) return { type: 'allin', amount: stack };
    return { type: 'raise', amount: amt };
}

/** Flush draw (4 do mesmo naipe) ou quase sequência — bônus 0–1 */
function drawBonus(hole, board) {
    const all = [...hole, ...board].map((id) => ({ rank: id[0], suit: id[1] }));
    const bySuit = {};
    for (const c of all) bySuit[c.suit] = (bySuit[c.suit] || 0) + 1;
    let bonus = 0;
    if (Object.values(bySuit).some((n) => n === 4)) bonus += 0.7;
    if (Object.values(bySuit).some((n) => n >= 5)) bonus += 0.2;
    return Math.min(1, bonus);
}

export function aiThinkDelay(level = 'normal') {
    const cfg = getDifficulty(level);
    const [a, b] = cfg.thinkMs;
    return a + Math.random() * (b - a);
}

/** Coach helper: equity real (com hole do herói) só para dicas educativas */
export function coachingEquity(match) {
    const h = match.hand;
    if (!h || h.board.length < 3) return null;
    return estimateEquity(h.holes[0], h.holes[1], h.board, 80, match.rng);
}
