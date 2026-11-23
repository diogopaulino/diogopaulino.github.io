/**
 * Motor Texas Hold'em de 2 a 6 lugares (no-limit), com potes paralelos.
 *
 * Regras documentadas:
 * - Botão gira no sentido horário (assento seguinte com fichas).
 *   Heads-up (2 vivos): o botão paga small blind e age primeiro no pré-flop.
 *   3+ vivos: SB = 1º à esquerda do botão, BB = 2º; abre o pré-flop quem
 *   está à esquerda do BB ("under the gun").
 * - Pós-flop: age primeiro o 1º assento vivo à esquerda do botão.
 * - Ruas: preflop → flop (3) → turn (1) → river (1) → showdown.
 * - Ranking (maior → menor): royal flush, straight flush, quadra, full house,
 *   flush, sequência, trinca, dois pares, par, carta alta.
 * - No-limit: aposta mínima = BB; aumento mínimo = tamanho do último aumento
 *   completo. All-in menor que um aumento completo NÃO reabre a rodada para
 *   quem já agiu (só pagar ou desistir) — regra de torneio (TDA).
 * - Potes paralelos (side pots): no showdown, as contribuições da mão são
 *   fatiadas por nível de all-in. A fatia do nível L vale
 *       Σ_j min(contrib_j, L) − Σ_j min(contrib_j, L_anterior)
 *   e só concorre a ela quem cobriu L sem desistir. Ficha de quem desistiu
 *   fica no pote (dead money). Fatia com um só concorrente é aposta não
 *   coberta e volta para o dono.
 * - Empate num pote: divide igual; fichas ímpares vão para o primeiro
 *   vencedor à esquerda do botão.
 * - Blinds sobem: a cada BLIND_EVERY mãos o nível dobra (5/10 → 10/20 →
 *   20/40 …). Assim toda sessão termina — alguém fica com todas as fichas.
 *   nível = floor((mão − 1) / BLIND_EVERY);  SB = sb0 · 2^nível;  BB = 2 · SB.
 */

export const BLIND_EVERY = 10;

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
    if (cardIds.length < 5) {
        return { category: -1, ranks: [], name: '—', cards: cardIds };
    }
    return evaluateFast(cardIds);
}

/**
 * Avaliação direta de 5–7 cartas, sem gerar as 21 combinações:
 * contagem por valor e por naipe → categoria, desempates e as 5 cartas.
 * Mesmo resultado de evaluateHandSlow (conferido nos testes), ~20× mais rápida.
 */
function evaluateFast(cardIds) {
    const cards = cardIds.map(parseCard).sort((a, b) => b.value - a.value);
    const cnt = new Array(13).fill(0);
    const bySuit = { s: [], h: [], d: [], c: [] };
    for (const c of cards) {
        cnt[c.value]++;
        bySuit[c.suit].push(c);
    }
    const take = (pool, value, n) => pool.filter((c) => c.value === value).slice(0, n);
    const straightOf = (vals) => straightHighValue(vals);
    const seq = (high) => (high === 3 ? [3, 2, 1, 0, 12] : [high, high - 1, high - 2, high - 3, high - 4]);
    const done = (category, ranks, five) => ({ category, ranks, name: HAND_NAMES[category], cards: five.map((c) => c.id) });

    const flushSuit = Object.keys(bySuit).find((k) => bySuit[k].length >= 5);
    if (flushSuit) {
        const suited = bySuit[flushSuit];
        const high = straightOf(suited.map((c) => c.value));
        if (high >= 0) return done(high === 12 ? 9 : 8, [high], seq(high).map((v) => take(suited, v, 1)[0]));
    }
    const valuesBy = (n) => {
        const out = [];
        for (let v = 12; v >= 0; v--) if (cnt[v] >= n) out.push(v);
        return out;
    };
    const quads = valuesBy(4);
    if (quads.length) {
        const q = quads[0];
        const kicker = cards.find((c) => c.value !== q);
        return done(7, [q, kicker.value], [...take(cards, q, 4), kicker]);
    }
    const trips = valuesBy(3);
    if (trips.length) {
        const t = trips[0];
        const p = valuesBy(2).find((v) => v !== t);
        if (p !== undefined) return done(6, [t, p], [...take(cards, t, 3), ...take(cards, p, 2)]);
    }
    if (flushSuit) {
        const five = bySuit[flushSuit].slice(0, 5);
        return done(5, five.map((c) => c.value), five);
    }
    const high = straightOf(cards.map((c) => c.value));
    if (high >= 0) return done(4, [high], seq(high).map((v) => take(cards, v, 1)[0]));
    if (trips.length) {
        const t = trips[0];
        const kick = cards.filter((c) => c.value !== t).slice(0, 2);
        return done(3, [t, ...kick.map((c) => c.value)], [...take(cards, t, 3), ...kick]);
    }
    const pairs = valuesBy(2);
    if (pairs.length >= 2) {
        const [p1, p2] = pairs;
        const kicker = cards.find((c) => c.value !== p1 && c.value !== p2);
        return done(2, [p1, p2, kicker.value], [...take(cards, p1, 2), ...take(cards, p2, 2), kicker]);
    }
    if (pairs.length === 1) {
        const p = pairs[0];
        const kick = cards.filter((c) => c.value !== p).slice(0, 3);
        return done(1, [p, ...kick.map((c) => c.value)], [...take(cards, p, 2), ...kick]);
    }
    const five = cards.slice(0, 5);
    return done(0, five.map((c) => c.value), five);
}

/** Referência lenta (todas as combinações de 5) — usada nos testes. */
export function evaluateHandSlow(cardIds) {
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
    function outcome(fullBoard) {
        const hero = evaluateHand([...heroHole, ...fullBoard]);
        const villain = evaluateHand([...villainHole, ...fullBoard]);
        return (Math.sign(compareScores(hero, villain)) + 1) / 2;
    }

    const need = 5 - board.length;
    if (need < 0) return 0.5;
    if (need === 0) return outcome(board);

    const used = new Set([...heroHole, ...villainHole, ...board]);
    const remaining = createDeck().filter(card => !used.has(card));
    const n = Math.max(1, Math.min(Math.floor(samples), 400));
    // No turn, cada river possível tem a mesma probabilidade.
    if (need === 1 && n >= remaining.length) {
        let total = 0;
        for (const river of remaining) total += outcome([...board, river]);
        return total / remaining.length;
    }

    let total = 0;
    for (let i = 0; i < n; i++) {
        const fill = shuffle(remaining, rng).slice(0, need);
        total += outcome(board.concat(fill));
    }
    return total / n;
}

/**
 * Equity contra mãos aleatórias: sorteia as 2 cartas de cada rival e o resto
 * da mesa. Não espia ninguém — serve à IA e ao medidor de força do jogador.
 * opponents > 1: só vence quem bate todos (empate divide). Retorna 0–1.
 */
export function equityVsRandom(hole, board, samples = 160, rng = Math.random, opponents = 1) {
    const used = new Set([...hole, ...board]);
    const remaining = createDeck().filter((c) => !used.has(c));
    const need = 5 - board.length;
    const opp = Math.max(1, Math.min(5, opponents | 0));
    const pick = need + 2 * opp;
    let total = 0;
    for (let i = 0; i < samples; i++) {
        // Fisher–Yates parcial: só as posições que serão usadas.
        for (let j = 0; j < pick; j++) {
            const k = j + Math.floor(rng() * (remaining.length - j));
            [remaining[j], remaining[k]] = [remaining[k], remaining[j]];
        }
        const full = board.concat(remaining.slice(2 * opp, pick));
        const mine = evaluateHand([...hole, ...full]);
        let ties = 0;
        let lost = false;
        for (let o = 0; o < opp && !lost; o++) {
            const cmp = compareScores(mine, evaluateHand([remaining[2 * o], remaining[2 * o + 1], ...full]));
            if (cmp < 0) lost = true;
            else if (cmp === 0) ties += 1;
        }
        if (!lost) total += 1 / (ties + 1);
    }
    return total / samples;
}

/** Blinds da mão n (1-based) — ver BLIND_EVERY no topo. */
export function blindsFor(match, handNumber) {
    const level = Math.floor((handNumber - 1) / BLIND_EVERY);
    const sb = match.baseSmallBlind * 2 ** level;
    return { level, sb, bb: sb * 2 };
}

export function potOdds(toCall, pot) {
    // Fórmula: call / (pot + call). Se equity > pot odds, call +EV.
    if (toCall <= 0) return 0;
    return toCall / (pot + toCall);
}

export const AI_NAMES = ['Lia', 'Bruno', 'Taís', 'Caio', 'Nina'];

export function createMatch({
    startingStack = 1000,
    smallBlind = 5,
    bigBlind = 10,
    heroSeat = 0,
    seats = 2,
    rng = Math.random
} = {}) {
    const n = Math.max(2, Math.min(6, seats | 0));
    const players = [{ id: 0, name: 'Você', isHero: true }];
    for (let i = 1; i < n; i++) players.push({ id: i, name: AI_NAMES[i - 1] || `IA ${i}`, isHero: false });
    return {
        startingStack,
        smallBlind,
        bigBlind,
        baseSmallBlind: smallBlind,
        biggestPot: 0,
        handsWon: new Array(n).fill(0),
        heroSeat,
        rng,
        seats: n,
        // Na 1ª mão o botão avança para o assento 1: no heads-up a IA abre
        // no botão (SB) e o herói recebe o BB, como sempre foi.
        button: 0,
        handNumber: 0,
        stacks: new Array(n).fill(startingStack),
        players,
        hand: null,
        log: [],
        lastResult: null
    };
}

/** Assentos com fichas (ainda no torneio). */
export function aliveSeats(match) {
    return match.stacks.map((s, i) => (s > 0 ? i : -1)).filter((i) => i >= 0);
}

/** A sessão continua enquanto o herói tem fichas e há ao menos um rival com fichas. */
export function canContinue(match) {
    if (match.stacks[match.heroSeat] <= 0) return false;
    return match.stacks.some((s, i) => i !== match.heroSeat && s > 0);
}

function nextSeat(match, from, pred) {
    const n = match.seats;
    for (let k = 1; k <= n; k++) {
        const s = (from + k) % n;
        if (pred(s)) return s;
    }
    return -1;
}

export function startHand(match) {
    const alive = aliveSeats(match);
    if (alive.length < 2 || !canContinue(match)) return null;

    match.handNumber += 1;
    match.button = nextSeat(match, match.button, (s) => match.stacks[s] > 0);
    const blinds = blindsFor(match, match.handNumber);
    if (blinds.bb !== match.bigBlind && match.handNumber > 1) {
        pushLog(match, `Blinds sobem para ${blinds.sb}/${blinds.bb}`);
    }
    match.smallBlind = blinds.sb;
    match.bigBlind = blinds.bb;

    const n = match.seats;
    const live = (s) => match.stacks[s] > 0;
    const headsUp = alive.length === 2;
    const sbSeat = headsUp ? match.button : nextSeat(match, match.button, live);
    const bbSeat = nextSeat(match, sbSeat, live);

    const deck = shuffle(createDeck(), match.rng);
    const holes = Array.from({ length: n }, () => []);
    // Distribui uma carta por vez, começando à esquerda do botão.
    for (let round = 0; round < 2; round++) {
        let s = match.button;
        for (let k = 0; k < alive.length; k++) {
            s = nextSeat(match, s, live);
            holes[s].push(deck.pop());
        }
    }

    const zeros = () => new Array(n).fill(0);
    const hand = {
        deck,
        board: [],
        holes,
        street: STREET.PREFLOP,
        pot: 0,
        bets: zeros(),
        contrib: zeros(),
        streetContrib: zeros(),
        currentBet: 0,
        minRaise: match.bigBlind,
        lastAggressor: bbSeat,
        toAct: -1,
        acted: new Array(n).fill(false),
        // Pode aumentar? Falso para quem já agiu e só viu um all-in incompleto.
        canRaise: new Array(n).fill(true),
        // Fora da mão desde o início (sem fichas) conta como desistente.
        folded: match.stacks.map((s) => s <= 0),
        out: match.stacks.map((s) => s <= 0),
        allIn: new Array(n).fill(false),
        lastAction: new Array(n).fill(null),
        sbSeat,
        bbSeat,
        button: match.button,
        winners: null,
        showdown: false,
        pendingAdvance: false
    };
    match.hand = hand;
    match.lastResult = null;

    const sbAmt = Math.min(match.smallBlind, match.stacks[sbSeat]);
    const bbAmt = Math.min(match.bigBlind, match.stacks[bbSeat]);
    commit(match, sbSeat, sbAmt);
    commit(match, bbSeat, bbAmt);
    hand.lastAction[sbSeat] = { type: 'blind', amount: sbAmt };
    hand.lastAction[bbSeat] = { type: 'blind', amount: bbAmt };
    // Regra TDA: mesmo com o BB all-in por menos, quem entra paga o BB
    // inteiro. O excedente não coberto volta no showdown (buildPots).
    hand.currentBet = match.bigBlind;

    pushLog(match, `Mão #${match.handNumber} — blinds ${sbAmt}/${bbAmt}`);
    const first = headsUp ? sbSeat : nextSeat(match, bbSeat, live);
    hand.toAct = first;
    return settle(match, first) && hand;
}

function pushLog(match, msg) {
    match.log.unshift({ t: Date.now(), msg });
    if (match.log.length > 40) match.log.length = 40;
}

/** Assentos ainda disputando o pote (não desistiram). */
function contenders(h) {
    const out = [];
    for (let s = 0; s < h.folded.length; s++) if (!h.folded[s]) out.push(s);
    return out;
}

/** Quem ainda pode decidir algo (na mão e com fichas). */
function actors(h) {
    return contenders(h).filter((s) => !h.allIn[s]);
}

/**
 * Precisa agir? Ainda não igualou a aposta, ou não agiu nesta rua e existe
 * outro jogador capaz de responder (se todos os outros estão all-in e ele
 * já cobriu, não há o que decidir).
 */
function needsAction(h, s) {
    if (h.folded[s] || h.allIn[s]) return false;
    if (h.streetContrib[s] < h.currentBet) return true;
    if (h.acted[s]) return false;
    return actors(h).some((o) => o !== s);
}

export function legalActions(match) {
    const h = match.hand;
    if (!h || h.street === STREET.SHOWDOWN || h.street === STREET.DONE) return [];
    if (h.pendingAdvance) return [];

    const seat = h.toAct;
    if (seat < 0 || h.folded[seat] || h.allIn[seat]) return [];

    const toCall = Math.max(0, h.currentBet - h.streetContrib[seat]);
    const stack = match.stacks[seat];
    const othersCanAct = actors(h).some((o) => o !== seat);
    const actions = [];

    if (toCall <= 0) {
        actions.push({ type: 'check', label: 'Check', amount: 0 });
        if (stack > 0 && othersCanAct) {
            const minBet = Math.min(stack, Math.max(match.bigBlind, h.minRaise));
            if (minBet < stack) actions.push({ type: 'bet', label: 'Apostar', min: minBet, max: stack, amount: minBet });
            actions.push({ type: 'allin', label: 'All-in', amount: stack });
        }
    } else {
        actions.push({ type: 'fold', label: 'Fold', amount: 0 });
        const callAmt = Math.min(stack, toCall);
        actions.push({ type: 'call', label: callAmt >= stack ? 'All-in (call)' : 'Call', amount: callAmt });
        if (stack > toCall && othersCanAct && h.canRaise[seat]) {
            const minRaiseTotal = h.currentBet + h.minRaise;
            const minPut = minRaiseTotal - h.streetContrib[seat];
            const minAmt = Math.min(stack, Math.max(toCall + 1, minPut));
            if (minAmt < stack) {
                actions.push({ type: 'raise', label: 'Raise', min: minAmt, max: stack, amount: minAmt });
            }
            actions.push({ type: 'allin', label: 'All-in', amount: stack });
        }
    }
    return actions;
}

/**
 * Aplica a ação de quem tem a vez (h.toAct).
 * Para bet/raise, amount = fichas colocadas AGORA (além do que já está na rua).
 */
export function applyAction(match, action) {
    const h = match.hand;
    if (!h || !action) return { ok: false, error: 'Sem mão' };
    const seat = h.toAct;
    const legal = legalActions(match);
    let found = legal.find((a) => a.type === action.type);
    if (!found && action.type === 'allin') {
        // Stack curto: "tudo" pode aparecer como bet/raise com máximo = stack
        // ou como call que já consome o stack. Mesmo efeito, outro nome.
        const stack = match.stacks[seat];
        found = legal.find((a) => (a.type === 'bet' || a.type === 'raise') && a.max === stack)
            || legal.find((a) => a.type === 'call' && a.amount === stack);
        if (found) action = { type: found.type, amount: stack };
    }
    if (!found && (action.type === 'bet' || action.type === 'raise')) {
        // Valor ≥ stack num spot onde só existe "tudo": vira all-in.
        const all = legal.find((a) => a.type === 'allin');
        if (all && Number(action.amount) >= match.stacks[seat]) { found = all; action = { type: 'allin' }; }
    }
    if (!found) return { ok: false, error: 'Ação ilegal' };

    const name = match.players[seat].name;
    let put = 0;

    switch (action.type) {
        case 'fold':
            h.folded[seat] = true;
            h.acted[seat] = true;
            h.lastAction[seat] = { type: 'fold', amount: 0 };
            pushLog(match, `${name} desiste`);
            break;
        case 'check':
            h.acted[seat] = true;
            h.lastAction[seat] = { type: 'check', amount: 0 };
            pushLog(match, `${name} passa`);
            break;
        case 'call':
            put = Math.min(match.stacks[seat], h.currentBet - h.streetContrib[seat]);
            commit(match, seat, put);
            h.acted[seat] = true;
            h.lastAction[seat] = { type: h.allIn[seat] ? 'allin' : 'call', amount: h.streetContrib[seat] };
            pushLog(match, `${name} paga ${put}${h.allIn[seat] ? ' (all-in)' : ''}`);
            break;
        case 'bet':
        case 'raise': {
            put = clampAmount(action.amount, found.min, found.max);
            raiseTo(match, seat, put);
            // Pré-flop o BB já é a aposta: "apostar" ali é, na mesa, aumentar.
            h.lastAction[seat] = { type: h.street === STREET.PREFLOP ? 'raise' : action.type, amount: h.streetContrib[seat] };
            pushLog(match, action.type === 'bet' ? `${name} aposta ${put}` : `${name} aumenta para ${h.currentBet}`);
            break;
        }
        case 'allin': {
            put = match.stacks[seat];
            raiseTo(match, seat, put);
            h.lastAction[seat] = { type: 'allin', amount: h.streetContrib[seat] };
            pushLog(match, `${name} vai all-in (${h.streetContrib[seat]})`);
            break;
        }
        default:
            return { ok: false, error: 'Ação desconhecida' };
    }
    return afterAction(match, seat);
}

/** Coloca `put` fichas e trata aumento completo × all-in incompleto. */
function raiseTo(match, seat, put) {
    const h = match.hand;
    const prevBet = h.currentBet;
    commit(match, seat, put);
    h.acted[seat] = true;
    h.canRaise[seat] = false;
    const total = h.streetContrib[seat];
    if (total <= prevBet) return; // all-in que nem chega a pagar: é um call curto
    const raiseSize = total - prevBet;
    h.currentBet = total;
    h.lastAggressor = seat;
    // Primeira aposta da rua sempre abre a ação; depois, só aumento completo.
    const full = prevBet === 0 || raiseSize >= h.minRaise;
    for (let s = 0; s < h.acted.length; s++) {
        if (s === seat || h.folded[s] || h.allIn[s]) continue;
        // Todos precisam responder ao valor novo. Só um aumento completo
        // devolve o direito de aumentar a quem já tinha agido.
        if (full) h.canRaise[s] = true;
        else if (!h.acted[s]) h.canRaise[s] = true;
        h.acted[s] = false;
    }
    if (full) h.minRaise = Math.max(match.bigBlind, raiseSize);
}

function clampAmount(v, min, max) {
    const n = Number(v);
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, Math.round(n)));
}

function commit(match, seat, amount) {
    const h = match.hand;
    const put = Math.max(0, Math.min(amount, match.stacks[seat]));
    match.stacks[seat] -= put;
    h.streetContrib[seat] += put;
    h.contrib[seat] += put;
    h.bets[seat] = h.streetContrib[seat];
    h.pot += put;
    if (match.stacks[seat] === 0) h.allIn[seat] = true;
}

function afterAction(match, seat) {
    return settle(match, nextSeat(match, seat, () => true));
}

/**
 * Decide o próximo passo a partir do assento `from`: vitória por desistência,
 * próximo a agir, nova rua, runout (todos all-in) ou showdown. Nunca deixa a
 * mão parada sem ninguém para agir.
 */
function settle(match, from) {
    const h = match.hand;
    for (let guard = 0; guard < 8; guard++) {
        const alive = contenders(h);
        if (alive.length === 1) return finishByFold(match, alive[0]);

        const next = nextSeat(match, from - 1 + match.seats, (s) => needsAction(h, s));
        if (next >= 0) {
            h.toAct = next;
            return { ok: true };
        }
        // Rodada fechada.
        if (actors(h).length <= 1) return runoutToShowdown(match);
        if (h.street === STREET.RIVER) return goShowdown(match);
        advanceStreet(match);
        from = nextSeat(match, h.button, () => true);
    }
    return goShowdown(match);
}

function finishByFold(match, winner) {
    const h = match.hand;
    const pot = h.pot;
    match.stacks[winner] += pot;
    match.biggestPot = Math.max(match.biggestPot || 0, pot);
    match.handsWon[winner] += 1;
    h.winners = [winner];
    h.street = STREET.DONE;
    h.toAct = -1;
    h.showdown = false;
    const payouts = new Array(match.seats).fill(0);
    payouts[winner] = pot;
    match.lastResult = {
        winners: [winner],
        pot,
        reason: 'fold',
        hands: null,
        pots: [{ amount: pot, eligible: [winner], winners: [winner] }],
        payouts
    };
    pushLog(match, `${match.players[winner].name} leva ${pot} (os outros desistiram)`);
    return { ok: true, handOver: true };
}

function advanceStreet(match) {
    const h = match.hand;
    h.streetContrib.fill(0);
    h.bets.fill(0);
    h.currentBet = 0;
    h.minRaise = match.bigBlind;
    h.acted.fill(false);
    h.canRaise.fill(true);
    for (let s = 0; s < h.lastAction.length; s++) {
        if (!h.folded[s] && !h.allIn[s]) h.lastAction[s] = null;
    }

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
    }
    return { ok: true, streetAdvanced: true };
}

function runoutToShowdown(match) {
    const h = match.hand;
    const before = h.board.length;
    while (h.board.length < 5) h.board.push(h.deck.pop());
    if (h.board.length > before) pushLog(match, `Mesa até o fim: ${h.board.join(' ')}`);
    h.street = STREET.RIVER;
    return goShowdown(match);
}

/**
 * Fatia as contribuições em pote principal + potes paralelos (ver topo).
 * Devolve [{ amount, eligible: [assentos] }], do principal ao último.
 */
export function buildPots(contrib, folded) {
    const levels = [...new Set(contrib.filter((c, s) => c > 0 && !folded[s]))].sort((a, b) => a - b);
    const pots = [];
    let prev = 0;
    for (const level of levels) {
        let amount = 0;
        for (const c of contrib) amount += Math.max(0, Math.min(c, level) - Math.min(c, prev));
        const eligible = [];
        for (let s = 0; s < contrib.length; s++) if (!folded[s] && contrib[s] >= level) eligible.push(s);
        if (amount > 0) pots.push({ amount, eligible });
        prev = level;
    }
    // Ficha morta acima do maior nível vivo (desistente que apostou mais) vai pro último pote.
    let dead = 0;
    for (const c of contrib) dead += Math.max(0, c - prev);
    if (dead > 0 && pots.length) pots[pots.length - 1].amount += dead;
    return pots;
}

function goShowdown(match) {
    const h = match.hand;
    h.street = STREET.SHOWDOWN;
    h.showdown = true;
    h.toAct = -1;

    const n = match.seats;
    const hands = new Array(n).fill(null);
    for (const s of contenders(h)) hands[s] = evaluateHand([...h.holes[s], ...h.board]);

    const payouts = new Array(n).fill(0);
    const pots = buildPots(h.contrib, h.folded);
    const results = [];
    // Ordem de desempate das fichas ímpares: a partir da esquerda do botão.
    const order = [];
    for (let k = 1; k <= n; k++) order.push((h.button + k) % n);

    for (let i = 0; i < pots.length; i++) {
        const pot = pots[i];
        if (pot.eligible.length === 1) {
            // Aposta sem cobertura: volta para quem apostou.
            const s = pot.eligible[0];
            payouts[s] += pot.amount;
            results.push({ ...pot, winners: [s], refund: true });
            pushLog(match, `${match.players[s].name} recebe ${pot.amount} de volta (aposta sem cobertura)`);
            continue;
        }
        let best = null;
        let winners = [];
        for (const s of pot.eligible) {
            const cmp = best ? compareScores(hands[s], best) : 1;
            if (cmp > 0) { best = hands[s]; winners = [s]; } else if (cmp === 0) winners.push(s);
        }
        const share = Math.floor(pot.amount / winners.length);
        let odd = pot.amount - share * winners.length;
        for (const s of order) {
            if (!winners.includes(s)) continue;
            payouts[s] += share + (odd > 0 ? 1 : 0);
            if (odd > 0) odd -= 1;
        }
        results.push({ ...pot, winners, hand: best });
        const label = pots.length > 1 ? (i === 0 ? 'pote principal' : `pote paralelo ${i}`) : 'o pote';
        pushLog(match, winners.length > 1
            ? `${label} (${pot.amount}) dividido — ${describeHand(best)}`
            : `${match.players[winners[0]].name} leva ${label} (${pot.amount}) com ${describeHand(best)}`);
    }

    for (let s = 0; s < n; s++) match.stacks[s] += payouts[s];
    // Pote "de verdade" = tudo menos devoluções.
    const contested = results.filter((r) => !r.refund);
    const potTotal = contested.reduce((a, r) => a + r.amount, 0);
    h.pot = potTotal;
    const mainWinners = contested.length ? contested[0].winners : results[0]?.winners || [];
    const allWinners = [...new Set(contested.flatMap((r) => r.winners))];

    h.winners = allWinners;
    h.street = STREET.DONE;
    match.biggestPot = Math.max(match.biggestPot || 0, potTotal);
    if (mainWinners.length === 1) match.handsWon[mainWinners[0]] += 1;
    match.lastResult = {
        winners: mainWinners,
        allWinners,
        pot: potTotal,
        reason: 'showdown',
        hands,
        pots: results,
        payouts
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
