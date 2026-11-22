/**
 * Poker Lab — Texas Hold'em heads-up vs IA + academia.
 * UI hiper-realista: mesa 3D, fichas, flip de cartas.
 */

import {
    applyAction,
    BLIND_EVERY,
    canContinue,
    createMatch,
    describeHand,
    equityVsRandom,
    evaluateHand,
    formatChips,
    heroToAct,
    holeStrength,
    legalActions,
    potOdds,
    RANK_LABEL,
    startHand,
    STREET
} from './engine.js?v=4';
import { aiThinkDelay, chooseAction } from './ai.js?v=4';
import { HAND_PLAIN, HAND_RANK_CHART, LESSONS, liveTip } from './coach.js?v=4';
import { renderCards, revealCards } from './cards.js?v=4';
import { flyChips, renderChipStack } from './chips.js?v=4';
import { isMuted, setMuted, sfxChip, sfxClick, sfxDeal, sfxFold, sfxWin } from './audio.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const DIFFICULTY_KEY = 'poker:difficulty';
const DIFF_LABEL = { easy: 'IA · fácil', normal: 'IA · intermediária', hard: 'IA · agressiva' };

const state = {
    mode: 'play', // play | academy
    difficulty: readDifficulty(),
    suggestion: null,
    // Incrementa a cada sessão nova: laços da IA de uma sessão velha param.
    session: 0,
    match: null,
    busy: false,
    lessonIndex: 0,
    betAmount: 0,
    prevBets: [0, 0],
    prevPot: 0,
    aiRevealed: false
};

function readDifficulty() {
    try {
        const v = localStorage.getItem(DIFFICULTY_KEY);
        return ['easy', 'normal', 'hard'].includes(v) ? v : 'easy';
    } catch {
        return 'easy';
    }
}

function setDifficulty(v) {
    state.difficulty = ['easy', 'normal', 'hard'].includes(v) ? v : 'easy';
    try { localStorage.setItem(DIFFICULTY_KEY, state.difficulty); } catch { /* modo privado */ }
    $$('#difficulty, #introDifficulty').forEach((el) => { el.value = state.difficulty; });
    renderBadges();
}

function newMatch() {
    state.session += 1;
    state.match = createMatch({ startingStack: 1000, smallBlind: 5, bigBlind: 10 });
}

function init() {
    newMatch();
    bindUi();
    setDifficulty(state.difficulty);
    const mute = $('#muteBtn');
    if (mute) {
        mute.setAttribute('aria-pressed', String(isMuted()));
        mute.textContent = isMuted() ? 'Mudo' : 'Som';
    }
    renderAll();
    showIntro(true);
}

function bindUi() {
    $('#btnStart')?.addEventListener('click', () => {
        showIntro(false);
        beginMatch();
    });
    $('#introDifficulty')?.addEventListener('change', (e) => setDifficulty(e.target.value));
    $('#sessionAgain')?.addEventListener('click', () => {
        $('#sessionOverlay').close();
        newMatch();
        dealNewHand();
    });
    $('#sessionClose')?.addEventListener('click', () => $('#sessionOverlay').close());
    $('#btnAcademyIntro')?.addEventListener('click', () => {
        showIntro(false);
        setMode('academy');
        $('#coachToggle').focus();
    });

    $('#modePlay')?.addEventListener('click', () => {
        if (state.match.hand) setMode('play');
        else beginMatch();
    });
    $('#modeAcademy')?.addEventListener('click', () => {
        setMode('academy');
        $('#coachToggle').focus();
    });
    $('#modeRanks')?.addEventListener('click', () => openRanks(true));

    $('#btnHint')?.addEventListener('click', onHint);
    $('#btnHintInline')?.addEventListener('click', onHint);
    $('#muteBtn')?.addEventListener('click', () => {
        setMuted(!isMuted());
        $('#muteBtn').setAttribute('aria-pressed', String(isMuted()));
        $('#muteBtn').textContent = isMuted() ? 'Mudo' : 'Som';
        sfxClick();
    });

    $('#difficulty')?.addEventListener('change', (e) => setDifficulty(e.target.value));

    $('#coachToggle')?.addEventListener('click', () => {
        const body = $('#coachBody');
        const open = body.hasAttribute('hidden');
        if (open) body.removeAttribute('hidden');
        else body.setAttribute('hidden', '');
        $('#coachToggle').setAttribute('aria-expanded', String(open));
    });

    $('#prevLesson')?.addEventListener('click', () => {
        state.lessonIndex = Math.max(0, state.lessonIndex - 1);
        renderAcademy();
        sfxClick();
    });
    $('#nextLesson')?.addEventListener('click', () => {
        state.lessonIndex = Math.min(LESSONS.length - 1, state.lessonIndex + 1);
        renderAcademy();
        sfxClick();
    });

    $('#ranksClose')?.addEventListener('click', () => openRanks(false));
    $('#ranksOverlay')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) openRanks(false);
    });

    $('#betSlider')?.addEventListener('input', (e) => {
        state.betAmount = Number(e.target.value);
        syncBetLabels();
    });

    $('#actions')?.addEventListener('click', onActionClick);

    document.addEventListener('keydown', (e) => {
        if (document.querySelector('dialog[open]') || e.repeat || e.ctrlKey || e.metaKey || e.altKey ||
            e.target.matches('input, select, textarea')) return;
        if (e.key === 'm' || e.key === 'M') $('#muteBtn')?.click();
        if (e.key === 'n' || e.key === 'N') $('#actions [data-action="nexthand"]')?.click();
    });


}

function showIntro(show) {
    const el = $('#intro');
    if (!el) return;
    if (show) el.showModal();
    else el.close();
}

function openRanks(show) {
    const el = $('#ranksOverlay');
    if (!el) return;
    if (show) {
        renderRankChart();
        el.showModal();
    } else el.close();
}

function setMode(mode) {
    state.mode = mode;
    $$('.dock-btn[data-mode]').forEach((btn) => {
        btn.classList.toggle('is-active', btn.dataset.mode === mode);
    });
    const academy = $('#academyPanel');
    const playCoach = $('#playCoach');
    if (mode === 'academy') {
        $('#coachBody').hidden = false;
        $('#coachToggle').setAttribute('aria-expanded', 'true');
        academy?.removeAttribute('hidden');
        playCoach?.setAttribute('hidden', '');
        renderAcademy();
    } else {
        academy?.setAttribute('hidden', '');
        playCoach?.removeAttribute('hidden');
        updateCoachLive();
    }
    sfxClick();
}

function beginMatch() {
    setMode('play');
    dealNewHand();
}

function dealNewHand() {
    if (state.busy || (state.match.hand && state.match.hand.street !== STREET.DONE)) return;
    if (!canContinue(state.match)) newMatch();
    for (const id of ['#heroCards', '#aiCards', '#board']) $(id).replaceChildren();
    startHand(state.match);
    state.aiRevealed = false;
    state.suggestion = null;
    state.betAmount = 0;
    state.busy = false;
    state.prevBets = [0, 0];
    state.prevPot = state.match.hand?.pot || 0;
    sfxDeal();
    if (state.match.hand.street === STREET.DONE) {
        onHandOver();
        return;
    }
    renderAll({ animateChips: true });
    maybeAiTurn();
}

async function onActionClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn || btn.dataset.action === 'nexthand' || state.busy) return;
    if (!heroToAct(state.match)) return;

    const type = btn.dataset.action;
    let amount = state.betAmount;
    if (type === 'bet' || type === 'raise') {
        amount = state.betAmount;
    } else if (type === 'allin') {
        amount = state.match.stacks[state.match.heroSeat];
    } else if (type === 'call') {
        const call = legalActions(state.match).find((a) => a.type === 'call');
        amount = call?.amount || 0;
    } else {
        amount = 0;
    }

    if (type === 'fold') sfxFold();
    else sfxChip();

    const beforeBet = state.match.hand?.streetContrib[0] || 0;
    const result = applyAction(state.match, { type, amount });
    if (!result.ok) return;
    state.suggestion = null;

    state.busy = true;
    renderActions();
    const afterBet = state.match.hand?.streetContrib[0] || 0;
    const delta = Math.max(0, afterBet - beforeBet);
    if (delta > 0 && type !== 'fold') {
        await animateBetFlight(0, delta);
    }

    state.busy = false;
    renderAll();
    if (result.handOver) {
        onHandOver();
        return;
    }
    await maybeAiTurn();
}

async function maybeAiTurn() {
    const match = state.match;
    const h = match.hand;
    if (!h || h.street === STREET.DONE) return;
    if (h.toAct === match.heroSeat) return;

    const session = state.session;
    state.busy = true;
    renderActions();
    setStatus('Dealer IA pensa…');
    await sleep(aiThinkDelay(state.difficulty));

    while (
        session === state.session &&
        match.hand &&
        match.hand.street !== STREET.DONE &&
        match.hand.toAct !== match.heroSeat &&
        !match.hand.folded[match.hand.toAct]
    ) {
        const action = chooseAction(match, state.difficulty);
        if (!action) break;
        if (action.type === 'fold') sfxFold();
        else sfxChip();

        const seat = match.hand.toAct;
        const beforeBet = match.hand.streetContrib[seat] || 0;
        let result = applyAction(match, action);
        if (!result.ok) {
            // Nunca travar a mesa: ação recusada vira a mais passiva possível.
            const legal = legalActions(match);
            const safe = legal.find((a) => a.type === 'check') || legal.find((a) => a.type === 'call') || legal[0];
            result = safe ? applyAction(match, safe) : { ok: false };
            if (!result.ok) break;
        }
        const afterBet = match.hand?.streetContrib[seat] || 0;
        const delta = Math.max(0, afterBet - beforeBet);
        if (delta > 0 && action.type !== 'fold') {
            await animateBetFlight(seat, delta);
        }

        renderAll();
        if (result.handOver) {
            state.busy = false;
            onHandOver();
            return;
        }
        if (match.hand.toAct === match.heroSeat) break;
        if (match.hand.allIn[0] || match.hand.allIn[1]) {
            if (match.hand.street === STREET.DONE) {
                state.busy = false;
                onHandOver();
                return;
            }
        }
        await sleep(280);
    }

    state.busy = false;
    renderAll();
}

async function animateBetFlight(seat, amount) {
    const from = seat === 0 ? $('#heroChipStack') : $('#aiChipStack');
    const to = $('#potChips');
    // Garante stack visual na origem antes do voo
    renderChipStack(from, Math.max(amount, 1));
    await flyChips(from, to, amount, { count: Math.min(5, Math.max(2, Math.ceil(amount / 40))) });
}

function onHandOver() {
    const r = state.match.lastResult;
    if (r?.winners?.includes(0)) sfxWin();
    renderAll({ revealAi: true });
    highlightBest();

    if (!canContinue(state.match)) {
        const heroWins = state.match.stacks[0] > 0;
        setStatus(heroWins ? 'Você ganhou todas as fichas!' : 'Suas fichas acabaram');
        const session = state.session;
        // Deixa ver as cartas do showdown antes do card de fim de sessão.
        setTimeout(() => { if (session === state.session) showSessionOver(heroWins); }, r?.reason === 'showdown' ? 1600 : 700);
    }
}

function showSessionOver(heroWins) {
    const dlg = $('#sessionOverlay');
    if (!dlg || dlg.open) return;
    const m = state.match;
    dlg.dataset.outcome = heroWins ? 'win' : 'loss';
    $('#sessionTitle').textContent = heroWins ? 'Você venceu!' : 'A IA venceu';
    $('#sessionText').textContent = heroWins
        ? 'Você ganhou todas as fichas da mesa. Parabéns!'
        : `Suas fichas acabaram. ${state.difficulty === 'easy' ? 'Na próxima, use a Dica quando estiver em dúvida.' : 'Tente a mesa fácil ou use a Dica.'}`;
    $('#sessionStats').innerHTML = [
        ['Mãos jogadas', m.handNumber],
        ['Mãos que você ganhou', m.handsWon[0]],
        ['Maior pote', formatChips(m.biggestPot)]
    ].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    dlg.showModal();
    $('#sessionAgain').focus();
}

/** Showdown: acende as 5 cartas da mão vencedora e apaga as outras. */
function highlightBest() {
    const h = state.match.hand;
    const r = state.match.lastResult;
    if (!h || r?.reason !== 'showdown') return;
    const seat = r.winners.length === 1 ? r.winners[0] : 0;
    const best = new Set(r.hands[seat].cards);
    const boxes = [$('#board'), seat === 0 ? $('#heroCards') : $('#aiCards')];
    for (const box of boxes) {
        for (const el of box.querySelectorAll('.card[data-card]')) {
            if (!el.dataset.card || el.dataset.card === '?') continue;
            el.classList.toggle('is-best', best.has(el.dataset.card));
            el.classList.toggle('is-dim', !best.has(el.dataset.card));
        }
    }
}

function onHint() {
    if (state.mode === 'academy') setMode('play');
    $('#coachBody').hidden = false;
    $('#coachToggle').setAttribute('aria-expanded', 'true');
    const match = state.match;
    const h = match.hand;
    if (!h || h.street === STREET.DONE) {
        setCoach('Dica', h ? 'A mão acabou. Toque em “Próxima mão” para receber cartas novas.' : 'Toque em “Distribuir cartas” para começar.');
        return;
    }
    const hero = match.heroSeat;
    if (heroToAct(match)) {
        // Sugestão justa: o mesmo cérebro da IA intermediária, olhando só as
        // suas cartas e a mesa. O botão sugerido brilha.
        const pick = chooseAction(match, 'normal');
        if (pick) {
            state.suggestion = pick.type === 'allin' ? 'allin' : pick.type;
            renderActions();
            setCoach('Sugestão', `${suggestionWhy(pick.type)} ${plainHandLine()}`);
            sfxClick();
            return;
        }
    }
    const hole = h.holes[hero];
    const strength = holeStrength(hole);
    const pct = Math.round(strength * 100);
    let text = `Suas hole cards têm força relativa ~${pct}% (heurística pré-flop).`;

    if (h.board.length >= 3) {
        const made = evaluateHand([...hole, ...h.board]);
        text = `Mão atual: ${describeHand(made)}. `;
        const toCall = Math.max(0, h.currentBet - h.streetContrib[hero]);
        if (toCall > 0) {
            const odds = potOdds(toCall, h.pot);
            text += `Pot odds ${Math.round(odds * 100)}% (call ${toCall} / pote ${h.pot}). `;
            text += made.category >= 2
                ? 'Com dois pares ou melhor, call/raise costuma ser correto.'
                : 'Sem mão feita forte, compare o custo do call com suas chances de melhorar.';
        } else {
            text += made.category >= 3
                ? 'Mão forte — considere bet para valor.'
                : 'Sem aposta: check é válido; bet só com plano (valor ou blefe).';
        }
    } else {
        text += strength >= 0.7
            ? ' Mão premium — raise para construir pot.'
            : strength >= 0.45
                ? ' Jogável — call ou raise pequeno conforme posição.'
                : ' Fraca — fold é o default, sobretudo fora de posição.';
    }
    setCoach('Dica', text);
    sfxClick();
}

function suggestionWhy(type) {
    return {
        fold: 'Desistir: sua mão está fraca e a aposta custa caro.',
        check: 'Passar: dá para ver a próxima carta de graça.',
        call: 'Pagar: sua mão ainda pode ganhar e o preço é bom.',
        bet: 'Apostar: sua mão está boa — faça a IA pagar para ver.',
        raise: 'Aumentar: sua mão é forte, cresça o pote.',
        allin: 'Tudo: mão forte e poucas fichas — vale arriscar.'
    }[type] || '';
}

/** Mão do jogador em palavras simples + o que ela significa. */
function plainHandLine() {
    const h = state.match.hand;
    if (!h) return '';
    const hole = h.holes[0];
    if (h.board.length >= 3) {
        const made = evaluateHand([...hole, ...h.board]);
        return `Você tem ${describeHand(made)} (${HAND_PLAIN[made.category]}).`;
    }
    return `Você tem ${describeHole(hole)}.`;
}

/** Duas cartas antes do flop: "Par de 8", "K e 7 do mesmo naipe". */
function describeHole(hole) {
    if (!hole || hole.length < 2) return '—';
    const [a, b] = hole;
    const la = RANK_LABEL[a[0]];
    const lb = RANK_LABEL[b[0]];
    if (a[0] === b[0]) return `Par de ${la}`;
    const order = 'AKQJT98765432';
    const [hi, lo] = order.indexOf(a[0]) < order.indexOf(b[0]) ? [la, lb] : [lb, la];
    return `${hi} e ${lo}${a[1] === b[1] ? ' do mesmo naipe' : ''}`;
}

/**
 * Medidor da mão do jogador (0–1): chance de vencer uma mão qualquer
 * (equityVsRandom). Faixas: < 0,40 fraca · < 0,55 média · < 0,72 boa · forte.
 * Recalcula só quando as cartas mudam.
 */
let meterKey = '';
let meterValue = 0;
function heroMeter() {
    const h = state.match.hand;
    if (!h) return null;
    const key = h.holes[0].join('') + h.board.join('');
    if (key !== meterKey) {
        meterKey = key;
        meterValue = equityVsRandom(h.holes[0], h.board, 220);
    }
    const v = meterValue;
    const word = v < 0.4 ? 'fraca' : v < 0.55 ? 'média' : v < 0.72 ? 'boa' : 'forte';
    return { v, word };
}

function renderAll(opts = {}) {
    renderStacks();
    renderBoard();
    renderHoles(opts);
    renderPot();
    renderChipPiles();
    renderActions();
    renderLog();
    renderBadges();
    updateCoachLive();
    renderHandResult();
}

function renderStacks() {
    const m = state.match;
    $('#heroStack').textContent = formatChips(m.stacks[0]);
    $('#aiStack').textContent = formatChips(m.stacks[1]);
    const h = m.hand;
    $('#heroBet').textContent = h ? formatChips(h.streetContrib[0] || 0) : '0';
    $('#aiBet').textContent = h ? formatChips(h.streetContrib[1] || 0) : '0';

    const heroSeat = $('.seat--hero');
    const aiSeat = $('.seat--ai');
    heroSeat?.classList.toggle('is-turn', !!(h && h.street !== STREET.DONE && h.toAct === 0));
    aiSeat?.classList.toggle('is-turn', !!(h && h.street !== STREET.DONE && h.toAct === 1));
    heroSeat?.classList.toggle('is-winner', !!(h && h.street === STREET.DONE && h.winners?.includes(0)));
    aiSeat?.classList.toggle('is-winner', !!(h && h.street === STREET.DONE && h.winners?.includes(1)));
    heroSeat?.classList.toggle('is-folded', !!(h && h.folded[0]));
    aiSeat?.classList.toggle('is-folded', !!(h && h.folded[1]));

    const btn = h?.button ?? m.button;
    $('#heroDealer').hidden = btn !== 0;
    $('#aiDealer').hidden = btn !== 1;

    const heroBlind = h ? (h.sbSeat === 0 ? 'SB' : 'BB') : '';
    const aiBlind = h ? (h.sbSeat === 1 ? 'SB' : 'BB') : '';
    $('#heroBlind').textContent = heroBlind;
    $('#aiBlind').textContent = aiBlind;
}

function renderChipPiles() {
    const h = state.match.hand;
    const heroBet = h?.streetContrib[0] || 0;
    const aiBet = h?.streetContrib[1] || 0;
    const pot = h?.pot || 0;
    renderChipStack($('#heroChipStack'), heroBet);
    renderChipStack($('#aiChipStack'), aiBet);
    renderChipStack($('#potChips'), pot);
}

function renderBoard() {
    const board = $('#board');
    const h = state.match.hand;
    const cards = h?.board || [];
    renderCards(board, cards, { baseDelay: 40, slots: 5 });
    for (let i = board.children.length; i < 5; i++) {
        const ph = document.createElement('div');
        ph.className = 'card card-slot';
        ph.setAttribute('aria-hidden', 'true');
        board.appendChild(ph);
    }
    $('#streetLabel').textContent = streetName(h?.street);
}

function streetName(s) {
    return {
        preflop: 'Pré-flop',
        flop: 'Flop',
        turn: 'Turn',
        river: 'River',
        showdown: 'Showdown',
        done: 'Mão encerrada'
    }[s] || '—';
}

function renderHoles(opts = {}) {
    const h = state.match.hand;
    const hero = h?.holes[0] || [];
    const ai = h?.holes[1] || [];
    renderCards($('#heroCards'), hero, { baseDelay: 0 });

    const reveal = h?.showdown;
    if (reveal && ai.length) {
        if (opts.revealAi && !state.aiRevealed) {
            state.aiRevealed = true;
            revealCards($('#aiCards'), ai);
        } else {
            renderCards($('#aiCards'), ai, { baseDelay: 80 });
        }
    } else if (ai.length) {
        const box = $('#aiCards');
        renderCards(box, ['?', '?'], { faceDown: true });
    } else {
        $('#aiCards').innerHTML = '';
    }

    const meterEl = $('#heroMeter');
    if (h && hero.length === 2) {
        $('#heroHandName').textContent = h.board.length >= 3
            ? describeHand(evaluateHand([...hero, ...h.board]))
            : describeHole(hero);
        const meter = heroMeter();
        if (meterEl && meter) {
            meterEl.hidden = false;
            meterEl.dataset.level = meter.word;
            meterEl.style.setProperty('--v', meter.v.toFixed(3));
            $('#heroMeterWord').textContent = `Mão ${meter.word}`;
        }
    } else {
        $('#heroHandName').textContent = '—';
        if (meterEl) meterEl.hidden = true;
    }
    const aiName = $('#aiHandName');
    if (aiName) {
        const r = state.match.lastResult;
        aiName.textContent = h?.street === STREET.DONE && r?.reason === 'showdown' ? describeHand(r.hands[1]) : '';
    }
}

function renderPot() {
    const h = state.match.hand;
    $('#potValue').textContent = formatChips(h?.pot || 0);
}

const ACTION_TEXT = {
    fold: { main: () => 'Desistir', sub: 'fold' },
    check: { main: () => 'Passar', sub: 'check' },
    call: { main: (a, stack) => (a.amount >= stack ? `Pagar ${formatChips(a.amount)} (tudo)` : `Pagar ${formatChips(a.amount)}`), sub: 'call' },
    allin: { main: (a) => `Tudo: ${formatChips(a.amount)}`, sub: 'all-in' }
};

function actionButton(type, main, sub) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `act-btn act-btn--${type}`;
    btn.dataset.action = type;
    btn.innerHTML = `<span class="act-main"></span><small class="act-sub"></small>`;
    btn.querySelector('.act-main').textContent = main;
    btn.querySelector('.act-sub').textContent = sub;
    if (state.suggestion === type) btn.classList.add('is-suggested');
    return btn;
}

/** Texto do botão de aposta acompanha o slider: "Apostar 40" / "Aumentar para 60". */
function syncBetLabels() {
    $('#betValue').textContent = formatChips(state.betAmount);
    const btn = $('#actions [data-action="bet"], #actions [data-action="raise"]');
    const h = state.match.hand;
    if (!btn || !h) return;
    const total = (h.streetContrib[0] || 0) + state.betAmount;
    btn.querySelector('.act-main').textContent = btn.dataset.action === 'bet'
        ? `Apostar ${formatChips(state.betAmount)}`
        : `Aumentar para ${formatChips(total)}`;
}

function renderActions() {
    const box = $('#actions');
    const sizing = $('#sizing');
    box.innerHTML = '';

    const h = state.match.hand;
    if (!h || h.street === STREET.DONE) {
        sizing.hidden = true;
        const next = document.createElement('button');
        next.type = 'button';
        next.className = 'act-btn act-btn--accent act-btn--next';
        next.dataset.action = 'nexthand';
        next.textContent = !h ? 'Distribuir cartas' : canContinue(state.match) ? 'Próxima mão' : 'Jogar de novo';
        next.addEventListener('click', () => {
            if (h && !canContinue(state.match)) newMatch();
            dealNewHand();
        });
        box.appendChild(next);
        setStatus(h?.street === STREET.DONE ? statusAfterHand() : 'Pronto para repartir');
        return;
    }

    if (state.busy || !heroToAct(state.match)) {
        sizing.hidden = true;
        setStatus(state.busy ? 'Dealer IA pensa…' : 'Aguardando…');
        return;
    }

    const legal = legalActions(state.match);
    const betOrRaise = legal.find((a) => a.type === 'bet' || a.type === 'raise');
    const stack = state.match.stacks[state.match.heroSeat];

    // Ordem fixa da esquerda para a direita: desistir · passar/pagar · apostar · tudo.
    for (const type of ['fold', 'check', 'call']) {
        const a = legal.find((x) => x.type === type);
        if (a) box.appendChild(actionButton(type, ACTION_TEXT[type].main(a, stack), ACTION_TEXT[type].sub));
    }

    if (betOrRaise) {
        sizing.hidden = false;
        const min = betOrRaise.min;
        const max = betOrRaise.max;
        const slider = $('#betSlider');
        slider.min = min;
        slider.max = max;
        slider.step = 1;
        if (!state.betAmount || state.betAmount < min || state.betAmount > max) {
            state.betAmount = Math.min(max, Math.max(min, Math.round((min + Math.min(max, state.match.hand.pot)) / 2)));
        }
        slider.value = state.betAmount;
        $('#betLabel').textContent = betOrRaise.type === 'bet' ? 'Quanto apostar' : 'Quanto aumentar';
        box.appendChild(actionButton(betOrRaise.type, '', betOrRaise.type));

        const pot = h.pot;
        $$('.size-chip').forEach((chip) => {
            const frac = Number(chip.dataset.frac);
            const amt = Math.min(max, Math.max(min, Math.round(pot * frac) || min));
            chip.onclick = () => {
                state.betAmount = amt;
                slider.value = amt;
                syncBetLabels();
            };
        });
    } else {
        sizing.hidden = true;
    }
    const allin = legal.find((a) => a.type === 'allin');
    if (allin) box.appendChild(actionButton('allin', ACTION_TEXT.allin.main(allin), ACTION_TEXT.allin.sub));
    syncBetLabels();

    const toCall = Math.max(0, h.currentBet - h.streetContrib[0]);
    setStatus(toCall > 0
        ? `Sua vez · a IA apostou. Pague ${formatChips(Math.min(toCall, stack))} para continuar, aumente ou desista.`
        : 'Sua vez · passe de graça ou aposte.');
}

function statusAfterHand() {
    const r = state.match.lastResult;
    if (!r) return 'Mão encerrada';
    if (r.reason === 'fold') {
        return r.winners[0] === 0 ? `A IA desistiu — você leva ${formatChips(r.pot)}` : 'Você desistiu da mão';
    }
    if (r.winners.length === 2) return `Empate · pote dividido (${describeHand(r.hands[0])})`;
    const w = r.winners[0];
    const hand = r.hands[w];
    return `${w === 0 ? 'Você vence' : 'A IA vence'} com ${describeHand(hand)} · ${formatChips(r.pot)}`;
}

function setStatus(msg) {
    const el = $('#statusLine');
    if (el) el.textContent = msg;
}

function renderLog() {
    const ul = $('#eventLog');
    if (!ul) return;
    ul.innerHTML = state.match.log
        .slice(0, 12)
        .map((e) => `<li>${escapeHtml(e.msg)}</li>`)
        .join('');
}

function renderBadges() {
    $('#handNumber').textContent = state.match.handNumber
        ? `Mão #${state.match.handNumber}`
        : '—';
    $('#diffLabel').textContent = DIFF_LABEL[state.difficulty];
    const m = state.match;
    const next = Math.floor(Math.max(0, m.handNumber - 1) / BLIND_EVERY + 1) * BLIND_EVERY + 1;
    const blinds = $('#blindLabel');
    if (blinds) blinds.textContent = `Blinds ${m.smallBlind}/${m.bigBlind} · sobem na mão ${next}`;
}

function updateCoachLive() {
    if (state.mode === 'academy') return;
    const legal = state.match.hand ? legalActions(state.match) : [];
    const tip = liveTip(state.match, legal);
    setCoach(tip.title, tip.text);
}

function setCoach(title, text) {
    const t = $('#coachTitle');
    const p = $('#coachText');
    if (t) t.textContent = title;
    if (p) p.textContent = text;
}

function renderHandResult() {
    const banner = $('#resultBanner');
    const h = state.match.hand;
    if (!h || h.street !== STREET.DONE) {
        banner.hidden = true;
        return;
    }
    banner.hidden = false;
    banner.textContent = statusAfterHand();
    const r = state.match.lastResult;
    banner.dataset.outcome = !r ? '' : r.winners.length === 2 ? 'split' : r.winners[0] === 0 ? 'win' : 'loss';
}

function renderAcademy() {
    const lesson = LESSONS[state.lessonIndex];
    $('#lessonKicker').textContent = lesson.kicker;
    $('#lessonTitle').textContent = lesson.title;
    $('#lessonText').textContent = lesson.text;
    $('#lessonTip').textContent = lesson.tip;
    $('#lessonProgress').textContent = `${state.lessonIndex + 1} / ${LESSONS.length}`;
    $('#prevLesson').disabled = state.lessonIndex === 0;
    $('#nextLesson').disabled = state.lessonIndex === LESSONS.length - 1;

    const quiz = $('#lessonQuiz');
    quiz.innerHTML = '';
    if (lesson.quiz) {
        const q = document.createElement('p');
        q.className = 'quiz-prompt';
        q.textContent = lesson.quiz.prompt;
        quiz.appendChild(q);
        const row = document.createElement('div');
        row.className = 'quiz-options';
        lesson.quiz.options.forEach((opt, i) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'quiz-btn';
            b.textContent = opt;
            b.addEventListener('click', () => {
                $$('.quiz-btn', row).forEach((x) => x.classList.remove('is-correct', 'is-wrong'));
                if (i === lesson.quiz.answer) {
                    b.classList.add('is-correct');
                    $('#lessonTip').textContent = lesson.quiz.success;
                    sfxWin();
                } else {
                    b.classList.add('is-wrong');
                    sfxFold();
                }
            });
            row.appendChild(b);
        });
        quiz.appendChild(row);
    }
}

function renderRankChart() {
    const list = $('#rankList');
    list.innerHTML = HAND_RANK_CHART.map(
        (r) => `<li><strong>${escapeHtml(r.name)}</strong><span>${escapeHtml(r.example)}</span></li>`
    ).join('');
}

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

init();
