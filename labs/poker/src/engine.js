/**
 * Motor Texas Hold'em heads-up.
 *
 * Regras documentadas:
 * - Blinds: no HU o botão (dealer) paga small blind; o outro paga big blind.
 * - Ordem pré-flop: SB age primeiro; pós-flop: BB age primeiro (fora do botão).
 * - Ruas: preflop → flop (3) → turn (1) → river (1) → showdown.
 * - Ranking (maior → menor): royal flush, straight flush, quadra, full house,
 *   flush, straight, trinca, dois pares, par, high card.
 * - Empate: split pot (chips ímpares vão ao primeiro seat no split).
 * - All-in: side pots simplificados (só 2 jogadores → pot único).
 */

export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
export const SUITS = ['s', 'h', 'd', 'c']; // spades, hearts, diamonds, clubs
export const SUIT_SYMBOL = { s: '♠', h: '♥', d: '♦', c: '♣' };
export const SUIT_COLOR = { s: 'black', h: 'red', d: 'red', c: 'black' };
export const RANK_LABEL = {
    '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
    T: '10', J: 'J', Q: 'Q', K: 'K', A: 'A'
};

export const HAND_NAMES = [
    'Carta alta',
    'Par',
    'Dois pares',
    'Trinca',
    'Sequência',
    'Flush',
    'Full house',
    'Quadra',
    'Straight flush',
    'Royal flush'
];

export const STREET = {
    PREFLOP: 'preflop',
    FLOP: 'flop',
    TURN: 'turn',
    RIVER: 'river',
    SHOWDOWN: 'showdown',
    DONE: 'done'
};

const RANK_VALUE = Object.fromEntries(RANKS.map((r, i) => [r, i]));

export function cardId(rank, suit) {
    return `${rank}${suit}`;
}

export function parseCard(id) {
    return { id, rank: id[0], suit: id[1], value: RANK_VALUE[id[0]] };
}

export function createDeck() {
    const deck = [];
    for (const suit of SUITS) {
        for (const rank of RANKS) deck.push(cardId(rank, suit));
    }
    return deck;
}

/** Fisher–Yates */
export function shuffle(deck, rng = Math.random) {
    const a = deck.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/**
 * Avalia a melhor mão de 5 cartas entre até 7.
 * Retorna { category: 0–9, ranks: number[], name, cards }.
 * Comparação lexicográfica de [category, ...ranks].
 */
export function evaluateHand(cardIds) {
    const cards = cardIds.map(parseCard);
    if (cards.length < 5) {
        return { category: -1, ranks: [], name: '—', cards: cardIds };
    }

    let best = null;
    const combos = combinations(cards, 5);
    for (const five of combos) {
        const score = scoreFive(five);
        if (!best || compareScores(score, best) > 0) best = score;
    }
    return best;
}

function combinations(arr, k) {
    const out = [];
    const n = arr.length;
    const idx = Array.from({ length: k }, (_, i) => i);
    while (true) {
        out.push(idx.map((i) => arr[i]));
        let i = k - 1;
        while (i >= 0 && idx[i] === i + n - k) i--;
        if (i < 0) break;
        idx[i]++;
        for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1] + 1;
    }
    return out;
}

function scoreFive(five) {
    const sorted = five.slice().sort((a, b) => b.value - a.value);
    const values = sorted.map((c) => c.value);
    const suits = sorted.map((c) => c.suit);
    const flush = suits.every((s) => s === suits[0]);

    // Ás baixo para wheel A-2-3-4-5
    let straightHigh = straightHighValue(values);
    const isStraight = straightHigh >= 0;

    const counts = countRanks(values);
    const groups = Object.entries(counts)
        .map(([v, n]) => ({ v: Number(v), n }))
        .sort((a, b) => b.n - a.n || b.v - a.v);

    let category;
    let ranks;

    if (isStraight && flush) {
        category = straightHigh === 12 ? 9 : 8; // royal / SF
        ranks = [straightHigh];
    } else if (groups[0].n === 4) {
        category = 7;
        ranks = [groups[0].v, groups[1].v];
    } else if (groups[0].n === 3 && groups[1].n === 2) {
        category = 6;
        ranks = [groups[0].v, groups[1].v];
    } else if (flush) {
        category = 5;
        ranks = values;
    } else if (isStraight) {
        category = 4;
        ranks = [straightHigh];
    } else if (groups[0].n === 3) {
        category = 3;
        ranks = [groups[0].v, ...groups.slice(1).map((g) => g.v)];
    } else if (groups[0].n === 2 && groups[1].n === 2) {
        category = 2;
        const high = Math.max(groups[0].v, groups[1].v);
        const low = Math.min(groups[0].v, groups[1].v);
        ranks = [high, low, groups[2].v];
    } else if (groups[0].n === 2) {
        category = 1;
        ranks = [groups[0].v, ...groups.slice(1).map((g) => g.v)];
    } else {
        category = 0;
        ranks = values;
    }

    return {
        category,
        ranks,
        name: HAND_NAMES[category],
        cards: sorted.map((c) => c.id)
    };
}

function countRanks(values) {
    const m = {};
    for (const v of values) m[v] = (m[v] || 0) + 1;
    return m;
}

/** Retorna o valor alto da sequência, ou -1. Aceita wheel (A2345 → high=3). */
function straightHighValue(valuesDesc) {
    const uniq = [...new Set(valuesDesc)].sort((a, b) => b - a);
    if (uniq.length < 5) return -1;

    // Normal
    for (let i = 0; i <= uniq.length - 5; i++) {
        let ok = true;
        for (let j = 1; j < 5; j++) {
            if (uniq[i + j] !== uniq[i] - j) {
                ok = false;
                break;
            }
        }
        if (ok) return uniq[i];
    }

    // Wheel: A,5,4,3,2
    const set = new Set(uniq);
    if (set.has(12) && set.has(3) && set.has(2) && set.has(1) && set.has(0)) return 3;
    return -1;
}

export function compareScores(a, b) {
    if (a.category !== b.category) return a.category - b.category;
    const n = Math.max(a.ranks.length, b.ranks.length);
    for (let i = 0; i < n; i++) {
        const av = a.ranks[i] ?? -1;
        const bv = b.ranks[i] ?? -1;
        if (av !== bv) return av - bv;
    }
    return 0;
}

export function describeHand(score) {
    if (!score || score.category < 0) return '—';
    const rankWord = (v) => RANK_LABEL[RANKS[v]] || String(v);
    switch (score.category) {
        case 9: return 'Royal flush';
        case 8: return `Straight flush até ${rankWord(score.ranks[0])}`;
        case 7: return `Quadra de ${rankWord(score.ranks[0])}`;
        case 6: return `Full house ${rankWord(score.ranks[0])} cheio de ${rankWord(score.ranks[1])}`;
        case 5: return `Flush (alta ${rankWord(score.ranks[0])})`;
        case 4: return `Sequência até ${rankWord(score.ranks[0])}`;
        case 3: return `Trinca de ${rankWord(score.ranks[0])}`;
        case 2: return `Dois pares ${rankWord(score.ranks[0])} e ${rankWord(score.ranks[1])}`;
        case 1: return `Par de ${rankWord(score.ranks[0])}`;
        default: return `Carta alta ${rankWord(score.ranks[0])}`;
    }
}

/**
 * Força relativa pré-flop simplificada (0–1) para mãos de 2 cartas.
 * Usada pela IA e pelo coach — não é equity exata Monte Carlo.
 */
export function holeStrength(hole) {
    if (!hole || hole.length !== 2) return 0;
    const [a, b] = hole.map(parseCard);
    const hi = Math.max(a.value, b.value);
    const lo = Math.min(a.value, b.value);
    const pair = a.value === b.value;
    const suited = a.suit === b.suit;
    const gap = hi - lo;

    let s = (hi + 1) / 13 * 0.45 + (lo + 1) / 13 * 0.15;
    if (pair) s = 0.55 + hi / 13 * 0.4;
    else {
        if (suited) s += 0.08;
        if (gap === 1) s += 0.06;
        else if (gap === 2) s += 0.03;
        else if (gap >= 4) s -= 0.04 * Math.min(gap - 3, 4);
        if (hi === 12) s += 0.06; // Ás
    }
    return Math.max(0.02, Math.min(0.98, s));
}

/**
 * Equity aproximada pós-flop via amostragem Monte Carlo leve.
 * samples: número de boards futuros (default 120).
 */
export function estimateEquity(heroHole, villainHole, board, samples = 120, rng = Math.random) {
    const used = new Set([...heroHole, ...villainHole, ...board]);
    const remaining = createDeck().filter((c) => !used.has(c));
    const need = 5 - board.length;
    if (need < 0) return 0.5;

    let wins = 0;
    let ties = 0;
    const n = Math.min(samples, 400);

    for (let i = 0; i < n; i++) {
        const pool = shuffle(remaining, rng);
        const fill = pool.slice(0, need);
        const full = board.concat(fill);
        const h = evaluateHand([...heroHole, ...full]);
        const v = evaluateHand([...villainHole, ...full]);
        const cmp = compareScores(h, v);
        if (cmp > 0) wins++;
        else if (cmp === 0) ties++;
    }
    return (wins + ties * 0.5) / n;
}

export function potOdds(toCall, pot) {
    // Fórmula: call / (pot + call). Se equity > pot odds, call +EV.
    if (toCall <= 0) return 0;
    return toCall / (pot + toCall);
}

export function createMatch({
    startingStack = 1000,
    smallBlind = 5,
    bigBlind = 10,
    heroSeat = 0,
    rng = Math.random
} = {}) {
    return {
        startingStack,
        smallBlind,
        bigBlind,
        heroSeat,
        rng,
        button: 1, // AI começa no botão; hero recebe BB na 1ª mão
        handNumber: 0,
        stacks: [startingStack, startingStack],
        players: [
            { id: 0, name: 'Você', isHero: true },
            { id: 1, name: 'Dealer IA', isHero: false }
        ],
        hand: null,
        log: [],
        lastResult: null
    };
}

export function canContinue(match) {
    return match.stacks[0] > 0 && match.stacks[1] > 0;
}

export function startHand(match) {
    if (!canContinue(match)) return null;

    match.button = match.handNumber === 0 ? match.button : 1 - match.button;
    match.handNumber += 1;

    const deck = shuffle(createDeck(), match.rng);
    const sbSeat = match.button; // HU: botão = SB
    const bbSeat = 1 - match.button;

    const sbAmt = Math.min(match.smallBlind, match.stacks[sbSeat]);
    const bbAmt = Math.min(match.bigBlind, match.stacks[bbSeat]);

    match.stacks[sbSeat] -= sbAmt;
    match.stacks[bbSeat] -= bbAmt;

    const holes = [[], []];
    holes[0].push(deck.pop(), deck.pop());
    holes[1].push(deck.pop(), deck.pop());

    const hand = {
        deck,
        board: [],
        holes,
        street: STREET.PREFLOP,
        pot: sbAmt + bbAmt,
        bets: [0, 0],
        contrib: [0, 0],
        streetContrib: [0, 0],
        currentBet: bbAmt,
        minRaise: match.bigBlind,
        lastAggressor: bbSeat,
        toAct: sbSeat,
        acted: [false, false],
        folded: [false, false],
        allIn: [match.stacks[0] === 0, match.stacks[1] === 0],
        sbSeat,
        bbSeat,
        button: match.button,
        winners: null,
        showdown: false,
        pendingAdvance: false
    };
    hand.bets[sbSeat] = sbAmt;
    hand.bets[bbSeat] = bbAmt;
    hand.contrib[sbSeat] = sbAmt;
    hand.contrib[bbSeat] = bbAmt;
    hand.streetContrib[sbSeat] = sbAmt;
    hand.streetContrib[bbSeat] = bbAmt;

    if (hand.allIn[0] || hand.allIn[1]) {
        hand.acted = [true, true];
    }

    match.hand = hand;
    match.lastResult = null;
    pushLog(match, `Mão #${match.handNumber} — blinds ${sbAmt}/${bbAmt}`);
    return hand;
}

function pushLog(match, msg) {
    match.log.unshift({ t: Date.now(), msg });
    if (match.log.length > 40) match.log.length = 40;
}

export function legalActions(match) {
    const h = match.hand;
    if (!h || h.street === STREET.SHOWDOWN || h.street === STREET.DONE) return [];
    if (h.pendingAdvance) return [];

    const seat = h.toAct;
    if (h.folded[seat] || h.allIn[seat]) return [];

    const toCall = h.currentBet - h.streetContrib[seat];
    const stack = match.stacks[seat];
    const actions = [];

    if (toCall <= 0) {
        actions.push({ type: 'check', label: 'Check', amount: 0 });
        if (stack > 0) {
            const minBet = Math.min(stack, Math.max(match.bigBlind, h.minRaise));
            actions.push({ type: 'bet', label: 'Apostar', min: minBet, max: stack, amount: minBet });
            if (stack > minBet) actions.push({ type: 'allin', label: 'All-in', amount: stack });
        }
    } else {
        actions.push({ type: 'fold', label: 'Fold', amount: 0 });
        const callAmt = Math.min(stack, toCall);
        actions.push({ type: 'call', label: callAmt >= stack ? 'All-in (call)' : 'Call', amount: callAmt });
        if (stack > toCall) {
            const minRaiseTotal = h.currentBet + h.minRaise;
            const minPut = minRaiseTotal - h.streetContrib[seat];
            if (stack > toCall) {
                const minAmt = Math.min(stack, Math.max(toCall + 1, minPut));
                if (minAmt < stack) {
                    actions.push({
                        type: 'raise',
                        label: 'Raise',
                        min: minAmt,
                        max: stack,
                        amount: minAmt
                    });
                }
                actions.push({ type: 'allin', label: 'All-in', amount: stack });
            }
        }
    }
    return actions;
}

/**
 * Aplica ação do jogador toAct.
 * amount: chips a colocar nesta ação (além do já contribuído na rua para bet/raise = total put this street action).
 * Para bet/raise/allin, amount = chips adicionais a enviar agora.
 */
export function applyAction(match, action) {
    const h = match.hand;
    if (!h) return { ok: false, error: 'Sem mão' };
    const seat = h.toAct;
    const legal = legalActions(match);
    const found = legal.find((a) => a.type === action.type);
    if (!found) return { ok: false, error: 'Ação ilegal' };

    let put = 0;
    const name = match.players[seat].name;

    switch (action.type) {
        case 'fold': {
            h.folded[seat] = true;
            h.acted[seat] = true;
            pushLog(match, `${name} desiste (fold)`);
            return finishByFold(match, 1 - seat);
        }
        case 'check': {
            h.acted[seat] = true;
            pushLog(match, `${name} dá check`);
            break;
        }
        case 'call': {
            put = Math.min(match.stacks[seat], h.currentBet - h.streetContrib[seat]);
            commit(match, seat, put);
            h.acted[seat] = true;
            pushLog(match, `${name} paga ${put}`);
            break;
        }
        case 'bet': {
            put = clampAmount(action.amount, found.min, found.max);
            commit(match, seat, put);
            h.currentBet = h.streetContrib[seat];
            h.minRaise = put;
            h.lastAggressor = seat;
            h.acted = [false, false];
            h.acted[seat] = true;
            pushLog(match, `${name} aposta ${put}`);
            break;
        }
        case 'raise': {
            put = clampAmount(action.amount, found.min, found.max);
            const prevBet = h.currentBet;
            commit(match, seat, put);
            const raiseSize = h.streetContrib[seat] - prevBet;
            h.minRaise = Math.max(match.bigBlind, raiseSize);
            h.currentBet = h.streetContrib[seat];
            h.lastAggressor = seat;
            h.acted = [false, false];
            h.acted[seat] = true;
            pushLog(match, `${name} aumenta para ${h.currentBet} (+${put})`);
            break;
        }
        case 'allin': {
            put = match.stacks[seat];
            const prevBet = h.currentBet;
            commit(match, seat, put);
            if (h.streetContrib[seat] > h.currentBet) {
                const raiseSize = h.streetContrib[seat] - prevBet;
                h.minRaise = Math.max(match.bigBlind, raiseSize);
                h.currentBet = h.streetContrib[seat];
                h.lastAggressor = seat;
                h.acted = [false, false];
            }
            h.acted[seat] = true;
            h.allIn[seat] = true;
            pushLog(match, `${name} vai all-in (${put})`);
            break;
        }
        default:
            return { ok: false, error: 'Ação desconhecida' };
    }

    return afterAction(match);
}

function clampAmount(v, min, max) {
    const n = Number(v);
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, Math.round(n)));
}

function commit(match, seat, amount) {
    const h = match.hand;
    const put = Math.min(amount, match.stacks[seat]);
    match.stacks[seat] -= put;
    h.streetContrib[seat] += put;
    h.contrib[seat] += put;
    h.bets[seat] = h.streetContrib[seat];
    h.pot += put;
    if (match.stacks[seat] === 0) h.allIn[seat] = true;
}

function afterAction(match) {
    const h = match.hand;

    // Ambos all-in ou um all-in e o outro cobriu → runout
    if (bettingRoundClosed(match)) {
        if (h.folded[0] || h.folded[1]) {
            // já tratado
            return { ok: true };
        }
        if (bothCommittedOrAllIn(match) && h.street !== STREET.RIVER) {
            return runoutToShowdown(match);
        }
        if (h.street === STREET.RIVER) {
            return goShowdown(match);
        }
        return advanceStreet(match);
    }

    h.toAct = 1 - h.toAct;
    // Pular quem fold/all-in
    if (h.folded[h.toAct] || (h.allIn[h.toAct] && h.streetContrib[h.toAct] >= h.currentBet)) {
        if (bettingRoundClosed(match)) {
            if (h.street === STREET.RIVER) return goShowdown(match);
            if (bothCommittedOrAllIn(match)) return runoutToShowdown(match);
            return advanceStreet(match);
        }
    }
    return { ok: true };
}

function bothCommittedOrAllIn(match) {
    const h = match.hand;
    const a0 = h.allIn[0] || h.streetContrib[0] >= h.currentBet;
    const a1 = h.allIn[1] || h.streetContrib[1] >= h.currentBet;
    return (h.allIn[0] || h.allIn[1]) && a0 && a1;
}

function bettingRoundClosed(match) {
    const h = match.hand;
    if (h.folded[0] || h.folded[1]) return true;

    for (let s = 0; s < 2; s++) {
        if (h.folded[s]) continue;
        if (h.allIn[s]) continue;
        if (!h.acted[s]) return false;
        if (h.streetContrib[s] < h.currentBet && match.stacks[s] > 0) return false;
    }
    return true;
}

function finishByFold(match, winner) {
    const h = match.hand;
    const pot = h.pot;
    match.stacks[winner] += pot;
    h.winners = [winner];
    h.street = STREET.DONE;
    h.showdown = false;
    match.lastResult = {
        winners: [winner],
        pot,
        reason: 'fold',
        hands: null
    };
    pushLog(match, `${match.players[winner].name} leva ${pot} (fold)`);
    return { ok: true, handOver: true };
}

function advanceStreet(match) {
    const h = match.hand;
    h.streetContrib = [0, 0];
    h.bets = [0, 0];
    h.currentBet = 0;
    h.minRaise = match.bigBlind;
    h.acted = [false, false];

    if (h.street === STREET.PREFLOP) {
        h.street = STREET.FLOP;
        h.board.push(h.deck.pop(), h.deck.pop(), h.deck.pop());
        pushLog(match, `Flop: ${h.board.join(' ')}`);
    } else if (h.street === STREET.FLOP) {
        h.street = STREET.TURN;
        h.board.push(h.deck.pop());
        pushLog(match, `Turn: ${h.board[3]}`);
    } else if (h.street === STREET.TURN) {
        h.street = STREET.RIVER;
        h.board.push(h.deck.pop());
        pushLog(match, `River: ${h.board[4]}`);
    } else {
        return goShowdown(match);
    }

    // Pós-flop: primeiro a agir é o não-botão (BB no HU)
    h.toAct = 1 - h.button;
    if (h.allIn[0] && h.allIn[1]) return runoutToShowdown(match);
    if (h.allIn[h.toAct]) h.toAct = 1 - h.toAct;
    return { ok: true, streetAdvanced: true };
}

function runoutToShowdown(match) {
    const h = match.hand;
    while (h.board.length < 5) {
        h.board.push(h.deck.pop());
    }
    if (h.street === STREET.PREFLOP) pushLog(match, `All-in runout: ${h.board.join(' ')}`);
    else pushLog(match, `Runout: ${h.board.join(' ')}`);
    h.street = STREET.RIVER;
    return goShowdown(match);
}

function goShowdown(match) {
    const h = match.hand;
    h.street = STREET.SHOWDOWN;
    h.showdown = true;

    const hand0 = evaluateHand([...h.holes[0], ...h.board]);
    const hand1 = evaluateHand([...h.holes[1], ...h.board]);
    const cmp = compareScores(hand0, hand1);
    const pot = h.pot;
    let winners;
    if (cmp > 0) winners = [0];
    else if (cmp < 0) winners = [1];
    else winners = [0, 1];

    if (winners.length === 2) {
        const half = Math.floor(pot / 2);
        match.stacks[0] += half;
        match.stacks[1] += pot - half;
        pushLog(match, `Split pot ${pot} — ${describeHand(hand0)}`);
    } else {
        match.stacks[winners[0]] += pot;
        pushLog(match, `${match.players[winners[0]].name} vence ${pot} com ${describeHand(winners[0] === 0 ? hand0 : hand1)}`);
    }

    h.winners = winners;
    h.street = STREET.DONE;
    match.lastResult = {
        winners,
        pot,
        reason: 'showdown',
        hands: [hand0, hand1]
    };
    return { ok: true, handOver: true, showdown: true };
}

export function heroToAct(match) {
    const h = match.hand;
    return !!(h && h.street !== STREET.DONE && h.toAct === match.heroSeat && !h.folded[match.heroSeat]);
}

export function formatChips(n) {
    return new Intl.NumberFormat('pt-BR').format(n);
}
