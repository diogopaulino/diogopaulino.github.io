/**
 * Poker Lab — Texas Hold'em heads-up vs IA + academia.
 */

import {
    applyAction,
    canContinue,
    createMatch,
    describeHand,
    evaluateHand,
    formatChips,
    heroToAct,
    holeStrength,
    legalActions,
    potOdds,
    startHand,
    STREET
} from './engine.js';
import { aiThinkDelay, chooseAction } from './ai.js';
import { HAND_RANK_CHART, LESSONS, liveTip } from './coach.js';
import { renderCards } from './cards.js';
import { isMuted, setMuted, sfxChip, sfxClick, sfxDeal, sfxFold, sfxWin } from './audio.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const state = {
    mode: 'play', // play | academy
    difficulty: 'normal',
    match: null,
    busy: false,
    lessonIndex: 0,
    betAmount: 0,
    showAiCards: false
};

function init() {
    state.match = createMatch({ startingStack: 1000, smallBlind: 5, bigBlind: 10 });
    bindUi();
    renderAll();
    showIntro(true);
}

function bindUi() {
    $('#btnStart')?.addEventListener('click', () => {
        showIntro(false);
        beginMatch();
    });
    $('#btnAcademyIntro')?.addEventListener('click', () => {
        showIntro(false);
        setMode('academy');
    });

    $('#modePlay')?.addEventListener('click', () => setMode('play'));
    $('#modeAcademy')?.addEventListener('click', () => setMode('academy'));
    $('#modeRanks')?.addEventListener('click', () => openRanks(true));

    $('#btnNewHand')?.addEventListener('click', () => {
        if (state.busy) return;
        if (!canContinue(state.match)) {
            state.match = createMatch({
                startingStack: 1000,
                smallBlind: 5,
                bigBlind: 10,
                button: state.match.button
            });
        }
        dealNewHand();
    });

    $('#btnHint')?.addEventListener('click', onHint);
    $('#muteBtn')?.addEventListener('click', () => {
        setMuted(!isMuted());
        $('#muteBtn').setAttribute('aria-pressed', String(isMuted()));
        $('#muteBtn').textContent = isMuted() ? 'Mudo' : 'Som';
        sfxClick();
    });

    $('#difficulty')?.addEventListener('change', (e) => {
        state.difficulty = e.target.value;
    });

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
        $('#betValue').textContent = formatChips(state.betAmount);
    });

    $('#actions')?.addEventListener('click', onActionClick);

    document.addEventListener('keydown', (e) => {
        if (e.target.matches('input, select, textarea')) return;
        if (e.key === 'm' || e.key === 'M') $('#muteBtn')?.click();
        if (e.key === 'n' || e.key === 'N') $('#btnNewHand')?.click();
    });
}

function showIntro(show) {
    const el = $('#intro');
    if (!el) return;
    el.hidden = !show;
}

function openRanks(show) {
    const el = $('#ranksOverlay');
    if (!el) return;
    el.hidden = !show;
    if (show) renderRankChart();
}

function setMode(mode) {
    state.mode = mode;
    $$('.dock-btn[data-mode]').forEach((btn) => {
        btn.classList.toggle('is-active', btn.dataset.mode === mode);
    });
    const academy = $('#academyPanel');
    const playCoach = $('#playCoach');
    if (mode === 'academy') {
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
    if (!canContinue(state.match)) {
        state.match = createMatch({ startingStack: 1000, smallBlind: 5, bigBlind: 10 });
    }
    startHand(state.match);
    state.showAiCards = false;
    state.busy = false;
    sfxDeal();
    renderAll();
    maybeAiTurn();
}

async function onActionClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn || state.busy) return;
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

    const result = applyAction(state.match, { type, amount });
    if (!result.ok) return;

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
    if (h.folded[h.toAct] || (h.allIn[h.toAct] && h.streetContrib[h.toAct] >= h.currentBet)) {
        // shouldn't happen often
    }

    state.busy = true;
    renderActions();
    setStatus('Dealer IA pensa…');
    await sleep(aiThinkDelay(state.difficulty));

    // Loop while AI to act (e.g. after street advance if somehow)
    while (
        match.hand &&
        match.hand.street !== STREET.DONE &&
        match.hand.toAct !== match.heroSeat &&
        !match.hand.folded[match.hand.toAct]
    ) {
        const action = chooseAction(match, state.difficulty);
        if (!action) break;
        if (action.type === 'fold') sfxFold();
        else sfxChip();
        const result = applyAction(match, action);
        renderAll();
        if (result.handOver) {
            state.busy = false;
            onHandOver();
            return;
        }
        if (match.hand.toAct === match.heroSeat) break;
        if (match.hand.allIn[0] || match.hand.allIn[1]) {
            // runout handled inside engine
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

function onHandOver() {
    state.showAiCards = true;
    const r = state.match.lastResult;
    if (r?.winners?.includes(0)) sfxWin();
    renderAll();

    if (!canContinue(state.match)) {
        const heroWins = state.match.stacks[0] > 0;
        setStatus(heroWins ? 'Você zerou a IA — mesa sua!' : 'Stack zerado — nova sessão?');
        $('#btnNewHand').textContent = 'Nova sessão';
    } else {
        $('#btnNewHand').textContent = 'Próxima mão';
    }
}

function onHint() {
    const match = state.match;
    const h = match.hand;
    if (!h || h.street === STREET.DONE) {
        setCoach('Dica', 'Comece uma mão. Eu comento pot odds, força e ruas em tempo real.');
        return;
    }
    const hero = match.heroSeat;
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
                : 'Sem mão feita forte, weigh pot odds e draws antes de pagar.';
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

function renderAll() {
    renderStacks();
    renderBoard();
    renderHoles();
    renderPot();
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

function renderBoard() {
    const board = $('#board');
    const h = state.match.hand;
    const cards = h?.board || [];
    renderCards(board, cards, { baseDelay: 40 });
    // Placeholders até 5
    for (let i = cards.length; i < 5; i++) {
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

function renderHoles() {
    const h = state.match.hand;
    const hero = h?.holes[0] || [];
    const ai = h?.holes[1] || [];
    renderCards($('#heroCards'), hero, { baseDelay: 0 });

    const reveal = state.showAiCards || (h && h.showdown) || (h && h.street === STREET.DONE && h.winners);
    if (reveal && ai.length) {
        renderCards($('#aiCards'), ai, { baseDelay: 80 });
    } else if (ai.length) {
        renderCards($('#aiCards'), ['?', '?'], { faceDown: true });
        // faceDown with fake ids
        const box = $('#aiCards');
        box.innerHTML = '';
        box.appendChild(cardBack(0));
        box.appendChild(cardBack(70));
    } else {
        $('#aiCards').innerHTML = '';
    }

    // Hand label
    if (h && hero.length === 2) {
        if (h.board.length >= 3) {
            $('#heroHandName').textContent = describeHand(evaluateHand([...hero, ...h.board]));
        } else {
            const s = Math.round(holeStrength(hero) * 100);
            $('#heroHandName').textContent = `Força ~${s}%`;
        }
    } else {
        $('#heroHandName').textContent = '—';
    }
}

function cardBack(delay) {
    const el = document.createElement('div');
    el.className = 'card is-back';
    el.style.setProperty('--deal-delay', `${delay}ms`);
    el.innerHTML = '<div class="card-face card-back" aria-hidden="true"><i></i></div>';
    el.setAttribute('aria-label', 'Carta fechada');
    return el;
}

function renderPot() {
    const h = state.match.hand;
    $('#potValue').textContent = formatChips(h?.pot || 0);
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
        next.className = 'act-btn act-btn--accent';
        next.dataset.action = 'nexthand';
        next.textContent = canContinue(state.match) ? 'Próxima mão' : 'Nova sessão';
        next.addEventListener('click', () => $('#btnNewHand').click());
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
    let betOrRaise = legal.find((a) => a.type === 'bet' || a.type === 'raise');

    legal.forEach((a) => {
        if (a.type === 'bet' || a.type === 'raise') return; // handled via confirm
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `act-btn act-btn--${a.type}`;
        btn.dataset.action = a.type;
        btn.textContent = a.type === 'call' ? `${a.label} ${formatChips(a.amount)}` : a.label;
        box.appendChild(btn);
    });

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
        $('#betValue').textContent = formatChips(state.betAmount);
        $('#betLabel').textContent = betOrRaise.type === 'bet' ? 'Aposta' : 'Raise';

        const confirm = document.createElement('button');
        confirm.type = 'button';
        confirm.className = 'act-btn act-btn--bet';
        confirm.dataset.action = betOrRaise.type;
        confirm.textContent = betOrRaise.type === 'bet' ? 'Apostar' : 'Aumentar';
        box.appendChild(confirm);

        // Quick sizes
        const pot = h.pot;
        $$('.size-chip').forEach((chip) => {
            const frac = Number(chip.dataset.frac);
            const amt = Math.min(max, Math.max(min, Math.round(pot * frac) || min));
            chip.onclick = () => {
                state.betAmount = amt;
                slider.value = amt;
                $('#betValue').textContent = formatChips(amt);
            };
        });
    } else {
        sizing.hidden = true;
    }

    setStatus('Sua vez');
}

function statusAfterHand() {
    const r = state.match.lastResult;
    if (!r) return 'Mão encerrada';
    if (r.reason === 'fold') {
        return r.winners[0] === 0 ? 'Rival foldou — você leva o pot' : 'Você foldou';
    }
    if (r.winners.length === 2) return `Split pot · ${describeHand(r.hands[0])}`;
    const w = r.winners[0];
    const hand = r.hands[w];
    return `${w === 0 ? 'Você' : 'IA'} vence com ${describeHand(hand)}`;
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
    $('#diffLabel').textContent = ({
        easy: 'IA · iniciante',
        normal: 'IA · intermediária',
        hard: 'IA · agressiva'
    })[state.difficulty];
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
