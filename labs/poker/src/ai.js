/**
 * IA heads-up — decisões por força de mão + pot odds + rua.
 *
 * Heurística (não é solver GTO):
 * - Pré-flop: holeStrength → fold / call / raise por faixas.
 * - Pós-flop: equity Monte Carlo contra uma mão ALEATÓRIA (equityVsRandom,
 *   ~140 sorteios, < 15 ms). A IA nunca vê as cartas do herói.
 *   Diante de aposta grande a equity é descontada: quem aposta forte costuma
 *   ter mão melhor que a média →  eq' = eq − 0,15 · min(1, call/pote).
 * - Pot odds: call se eq' >= toCall/(pot+toCall) + margem.
 * - Fácil (mesa das crianças): "generosa" — aposta pouco (size 0,5×),
 *   blefa pequeno com frequência (45%) (quem sempre paga ganha esses potes),
 *   esconde mão forte com check (slowplay 70%), nunca aumenta, não empurra
 *   all-in curto e desiste com facilidade (margem +0,20). Testada contra um
 *   jogador que só paga/passa: a criança vence a maioria das sessões.
 */

import {
    equityVsRandom,
    estimateEquity,
    holeStrength,
    legalActions,
    potOdds,
    STREET
} from './engine.js?v=4';

const DIFFICULTY = {
    easy: { aggression: 0.4, bluff: 0.45, callMargin: 0.2, raiseAt: 2, noise: 0.12, size: 0.5, slowplay: 0.7, shove: false, thinkMs: [550, 950] },
    normal: { aggression: 0.75, bluff: 0.1, callMargin: 0.03, raiseAt: 0.78, noise: 0.04, size: 1, slowplay: 0.1, shove: true, thinkMs: [500, 1000] },
    hard: { aggression: 0.95, bluff: 0.16, callMargin: -0.02, raiseAt: 0.7, noise: 0, size: 1, slowplay: 0.05, shove: true, thinkMs: [400, 800] }
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
        strength = equityVsRandom(hole, board, 140, match.rng);
        if (toCall > 0) strength -= 0.15 * Math.min(1, toCall / Math.max(1, pot - toCall));
    }
    if (cfg.noise) strength += (match.rng() * 2 - 1) * cfg.noise;
    strength = Math.max(0, Math.min(0.98, strength));

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
    if (cfg.shove && stack <= bb * 8 && strength >= 0.55 && allin) {
        return { type: 'allin', amount: allin.amount };
    }

    if (toCall <= 0) {
        // Opção de check ou bet
        if (wantBluff && bet) {
            return sizeBet(bet, pot, stack, 0.45 * cfg.size);
        }
        if (strength >= 0.62 * (1.1 - cfg.aggression * 0.2) && bet && !(check && match.rng() < cfg.slowplay)) {
            const frac = strength > 0.8 ? 0.75 : 0.55;
            return sizeBet(bet, pot, stack, frac * cfg.size);
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

    if ((strength >= cfg.raiseAt || wantBluff) && raise && equity >= threshold - 0.05) {
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
