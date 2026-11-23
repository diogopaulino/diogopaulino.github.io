/* =========================================================
   Calculator — interface
   Simples e científica usam o MESMO motor (engine.js): a expressão é
   uma lista de tokens avaliada com precedência real (2 + 3 × 4 = 14),
   em decimal exato (0,1 + 0,2 = 0,3). O modo científico só revela mais
   teclas. Histórico, modo, ângulo e par de moedas ficam no localStorage.
   ========================================================= */
import {
    Dec, CalcError, evaluate, evaluateText, tokenize, tokensToText, formatDec, plainDec,
    openParens, isUnaryAt, endsOperand
} from './engine.js?v=3';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* ---------------------------------------------------------
   Persistência tolerante a falhas (modo privado, cota cheia)
   --------------------------------------------------------- */
const store = {
    get(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw == null ? fallback : JSON.parse(raw);
        } catch {
            return fallback;
        }
    },
    set(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* segue em memória */ }
    }
};
const KEYS = {
    prefs: 'calculator:prefs:v2',
    history: 'calculator:history:v2',
    rates: 'calculator_exchange_rates_v2'
};
const prefs = Object.assign({ mode: 'calculator', angle: 'deg', from: 'USD', to: 'BRL', amount: '1' }, store.get(KEYS.prefs, {}));
const savePrefs = () => store.set(KEYS.prefs, prefs);

/* ---------------------------------------------------------
   Elementos
   --------------------------------------------------------- */
const root = $('#calc-root');
const modeBtns = $$('.mode-btn');
const calcPanel = $('#calc-panel');
const currencySection = $('#currency');
const keypad = $('#keypad');
const displayMain = $('#display-main');
const displayPrev = $('#display-prev');
const displayPreview = $('#display-preview');
const live = $('#calc-live');
const btn2nd = $('#btn-2nd');
const btnAngle = $('#btn-angle');
const toastEl = $('#calc-toast');

/* ---------------------------------------------------------
   Estado da expressão
   --------------------------------------------------------- */
const MAX_TOKENS = 160;
const MAX_DIGITS = 24;
let tokens = [];
let justEvaluated = false; // o display mostra um resultado recém-calculado
let lastRepeat = null; // "=" repetido reaplica a última operação (iOS)
let errorMsg = '';
let second = false;

const last = () => tokens[tokens.length - 1];

function vibrate(ms = 8) {
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch { /* opcional */ }
}

let toastTimer = 0;
function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    toastEl.classList.remove('is-out');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toastEl.classList.add('is-out');
        toastTimer = setTimeout(() => { toastEl.hidden = true; }, 220);
    }, 1600);
}

/** Começa uma expressão nova se havia resultado/erro na tela. */
function freshIfResult(keepAsOperand) {
    if (errorMsg) {
        errorMsg = '';
        tokens = [];
    }
    if (justEvaluated) {
        justEvaluated = false;
        if (!keepAsOperand) tokens = [];
    }
}

function inputDigit(d) {
    freshIfResult(false);
    const tok = last();
    if (tok && tok.t === 'num') {
        if (tok.v.replace(/\D/g, '').length >= MAX_DIGITS) return;
        if (tok.v === '0') tok.v = d;
        else if (tok.v === '-0') tok.v = `-${d}`;
        else tok.v += d;
        return;
    }
    if (tokens.length >= MAX_TOKENS) return;
    tokens.push({ t: 'num', v: d });
}

function inputDot() {
    freshIfResult(false);
    const tok = last();
    if (tok && tok.t === 'num') {
        if (!tok.v.includes('.')) tok.v += '.';
        return;
    }
    tokens.push({ t: 'num', v: '0.' });
}

function inputOp(op) {
    freshIfResult(true);
    const tok = last();
    if (!tok) {
        // Começar com operador: "−" vira sinal; os outros operam sobre 0.
        if (op === '-') tokens.push({ t: 'op', v: '-' });
        else tokens.push({ t: 'num', v: '0' }, { t: 'op', v: op });
        return;
    }
    if (tok.t === 'op') {
        // "× −" é permitido (multiplicar por negativo); senão troca o operador.
        if (op === '-' && (tok.v === '*' || tok.v === '/' || tok.v === '^')) {
            tokens.push({ t: 'op', v: '-' });
            return;
        }
        while (last() && last().t === 'op') tokens.pop();
        if (!last()) {
            if (op === '-') tokens.push({ t: 'op', v: '-' });
            else tokens.push({ t: 'num', v: '0' }, { t: 'op', v: op });
            return;
        }
        if (last().t === 'lp' || last().t === 'fn') {
            if (op === '-') tokens.push({ t: 'op', v: '-' });
            return;
        }
        tokens.push({ t: 'op', v: op });
        return;
    }
    if (tok.t === 'lp' || tok.t === 'fn') {
        if (op === '-') tokens.push({ t: 'op', v: '-' });
        return;
    }
    if (tok.t === 'num' && tok.v.endsWith('.')) tok.v = tok.v.slice(0, -1);
    if (tokens.length < MAX_TOKENS) tokens.push({ t: 'op', v: op });
}

function inputFn(fn) {
    freshIfResult(false);
    if (tokens.length < MAX_TOKENS) tokens.push({ t: 'fn', v: fn });
}

function inputConst(c) {
    freshIfResult(false);
    if (tokens.length < MAX_TOKENS) tokens.push({ t: 'const', v: c });
}

function inputPost(p) {
    freshIfResult(true);
    if (!endsOperand(last())) {
        if (!tokens.length) toast('Digite um número antes');
        return;
    }
    if (last().t === 'num' && last().v.endsWith('.')) last().v = last().v.slice(0, -1);
    tokens.push({ t: 'post', v: p });
}

function inputParen(kind) {
    if (kind === 'lp') {
        freshIfResult(false);
        if (tokens.length < MAX_TOKENS) tokens.push({ t: 'lp' });
        return;
    }
    freshIfResult(true);
    if (openParens(tokens) > 0 && endsOperand(last())) tokens.push({ t: 'rp' });
}

/** ± : alterna o sinal do último operando (número, constante ou grupo entre parênteses). */
function toggleSign() {
    freshIfResult(true);
    if (!tokens.length) {
        tokens.push({ t: 'op', v: '-' });
        return;
    }
    // Acha o início do último operando.
    let i = tokens.length - 1;
    if (!endsOperand(tokens[i])) {
        // Ainda não há operando depois do operador: alterna um "−" pendente.
        if (last().t === 'op' && last().v === '-' && isUnaryAt(tokens, tokens.length - 1)) tokens.pop();
        else tokens.push({ t: 'op', v: '-' });
        return;
    }
    while (i > 0 && tokens[i].t === 'post') i -= 1;
    if (tokens[i].t === 'rp') {
        let depth = 0;
        for (; i >= 0; i -= 1) {
            if (tokens[i].t === 'rp') depth += 1;
            else if (tokens[i].t === 'lp' || tokens[i].t === 'fn') {
                depth -= 1;
                if (depth === 0) break;
            }
        }
        i = Math.max(0, i);
    }
    if (isUnaryAt(tokens, i - 1) && tokens[i - 1].v === '-') tokens.splice(i - 1, 1);
    else tokens.splice(i, 0, { t: 'op', v: '-' });
}

function backspace() {
    if (errorMsg || justEvaluated) {
        clearAll();
        return;
    }
    const tok = last();
    if (!tok) return;
    if (tok.t === 'num' && tok.v.length > 1) {
        tok.v = tok.v.slice(0, -1);
        if (tok.v === '-' || tok.v === '') tokens.pop();
    } else {
        tokens.pop();
    }
}

function clearAll() {
    tokens = [];
    justEvaluated = false;
    errorMsg = '';
    lastRepeat = null;
    displayPrev.textContent = '';
}

/** Última operação binária de nível 0 (para repetir com "=" de novo). */
function extractRepeat(list) {
    let depth = 0;
    for (let i = list.length - 1; i > 0; i -= 1) {
        const tok = list[i];
        if (tok.t === 'rp') depth += 1;
        else if (tok.t === 'lp' || tok.t === 'fn') depth -= 1;
        else if (depth === 0 && tok.t === 'op' && !isUnaryAt(list, i) && tok.v !== '^') {
            const tail = list.slice(i + 1);
            if (tail.some((t) => t.t === 'post' && t.v === '%')) return null;
            return { op: tok.v, tail: tail.map((t) => ({ ...t })) };
        }
    }
    return null;
}

function equals() {
    if (errorMsg) return;
    let expr = tokens;
    if (justEvaluated) {
        if (!lastRepeat) return;
        expr = [last(), { t: 'op', v: lastRepeat.op }, ...lastRepeat.tail.map((t) => ({ ...t }))];
    }
    if (!expr.length) return;
    // Operador pendente no fim ("5 +") é descartado, como no iOS.
    while (expr.length && (expr[expr.length - 1].t === 'op' || expr[expr.length - 1].t === 'lp')) expr = expr.slice(0, -1);
    if (!expr.length) return;
    const text = tokensToText(expr, { ghostParens: true });
    try {
        const value = evaluate(expr, { angle: prefs.angle });
        if (!justEvaluated) lastRepeat = extractRepeat(expr);
        tokens = [{ t: 'ans', v: value.toString() }];
        justEvaluated = true;
        displayPrev.textContent = `${text} =`;
        pushHistory(text, value);
        announce(`${text} igual a ${formatDec(value)}`);
        displayMain.classList.remove('is-pop');
        void displayMain.offsetWidth;
        displayMain.classList.add('is-pop');
    } catch (err) {
        errorMsg = err instanceof CalcError ? err.message : 'Erro';
        displayPrev.textContent = text;
        announce(`Erro: ${errorMsg}`);
        displayMain.classList.remove('is-shake');
        void displayMain.offsetWidth;
        displayMain.classList.add('is-shake');
        vibrate([12, 40, 12]);
    }
}

function announce(msg) {
    live.textContent = msg;
}

/** Valor atual (resultado ou prévia) para copiar. */
function currentValue() {
    if (errorMsg || !tokens.length) return tokens.length ? null : Dec.zero;
    try {
        return evaluate(tokens, { angle: prefs.angle });
    } catch {
        return null;
    }
}

/* ---------------------------------------------------------
   Render do display
   --------------------------------------------------------- */
function fitText(el, text) {
    // Fonte encolhe com o comprimento (feito em JS para não depender de container queries).
    const width = el.clientWidth || 300;
    const short = window.innerHeight < 740;
    const base = root.dataset.mode === 'scientific' ? (short ? 44 : 54) : (short ? 52 : 60);
    const charW = 0.58; // largura média de um dígito Outfit em em
    const size = Math.max(22, Math.min(base, width / (Math.max(1, text.length) * charW)));
    el.style.fontSize = `${size}px`;
}

function render() {
    let text;
    if (errorMsg) {
        text = errorMsg;
        displayMain.classList.add('is-error');
    } else {
        displayMain.classList.remove('is-error');
        text = tokens.length ? tokensToText(tokens) : '0';
    }
    const ghost = errorMsg ? 0 : openParens(tokens);
    displayMain.textContent = text;
    if (ghost) {
        const g = document.createElement('span');
        g.className = 'ghost';
        g.textContent = ')'.repeat(ghost);
        displayMain.appendChild(g);
    }
    displayMain.setAttribute('aria-label', `Expressão: ${text}`);
    fitText(displayMain, text + ')'.repeat(ghost));
    displayMain.scrollLeft = displayMain.scrollWidth;

    // Prévia ao vivo (só quando há operação a fazer).
    let preview = '';
    if (!errorMsg && !justEvaluated && tokens.length > 1) {
        try {
            const trimmed = tokens.slice();
            while (trimmed.length && (trimmed[trimmed.length - 1].t === 'op')) trimmed.pop();
            if (trimmed.length && trimmed.some((t) => t.t !== 'num')) {
                preview = `= ${formatDec(evaluate(trimmed, { angle: prefs.angle }))}`;
            }
        } catch {
            preview = '';
        }
    }
    displayPreview.textContent = preview;
}

/* ---------------------------------------------------------
   Teclado na tela
   --------------------------------------------------------- */
function press(btn) {
    if (btn.dataset.digit) inputDigit(btn.dataset.digit);
    else if (second && btn.dataset.altFn) inputFn(btn.dataset.altFn);
    else if (second && btn.dataset.altPost) inputPost(btn.dataset.altPost);
    else if (btn.dataset.op) inputOp(btn.dataset.op);
    else if (btn.dataset.fn) inputFn(btn.dataset.fn);
    else if (btn.dataset.post) inputPost(btn.dataset.post);
    else if (btn.dataset.const) inputConst(btn.dataset.const);
    else {
        switch (btn.dataset.key) {
            case 'dot': inputDot(); break;
            case 'neg': toggleSign(); break;
            case 'back': backspace(); break;
            case 'clear': clearAll(); break;
            case 'eq': equals(); break;
            case 'lp': inputParen('lp'); break;
            case 'rp': inputParen('rp'); break;
            default: return;
        }
    }
    // "2nd" vale para uma tecla só (como na Casio).
    if (second && (btn.dataset.altFn || btn.dataset.altPost)) setSecond(false);
    render();
}

keypad.addEventListener('click', (e) => {
    const btn = e.target.closest('button.btn');
    if (!btn) return;
    press(btn);
});
keypad.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch' && e.target.closest('button.btn')) vibrate(6);
});

function flash(btn) {
    if (!btn) return;
    btn.classList.add('is-pressed');
    setTimeout(() => btn.classList.remove('is-pressed'), 110);
}

function setSecond(on) {
    second = on;
    btn2nd.setAttribute('aria-pressed', String(on));
    keypad.classList.toggle('is-second', on);
}
btn2nd.addEventListener('click', () => setSecond(!second));

function setAngle(angle) {
    prefs.angle = angle;
    savePrefs();
    btnAngle.setAttribute('aria-pressed', String(angle === 'rad'));
    btnAngle.querySelector('[data-angle-label]').textContent = angle === 'deg' ? 'DEG' : 'RAD';
    btnAngle.setAttribute('aria-label', angle === 'deg' ? 'Ângulos em graus (trocar para radianos)' : 'Ângulos em radianos (trocar para graus)');
    render();
}
btnAngle.addEventListener('click', () => setAngle(prefs.angle === 'deg' ? 'rad' : 'deg'));

/* ---------------------------------------------------------
   Copiar / colar
   --------------------------------------------------------- */
async function copyResult() {
    const value = currentValue();
    if (!value) {
        toast('Nada para copiar');
        return;
    }
    const text = plainDec(value);
    try {
        await navigator.clipboard.writeText(text);
        toast(`Copiado: ${text}`);
    } catch {
        // Fallback para contextos sem a API (http, permissões).
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        let ok = false;
        try { ok = document.execCommand('copy'); } catch { ok = false; }
        ta.remove();
        toast(ok ? `Copiado: ${text}` : 'Não foi possível copiar');
    }
}
$('#btn-copy').addEventListener('click', copyResult);

function pasteText(text) {
    const clean = String(text || '').trim().slice(0, 300);
    if (!clean) return;
    try {
        const pasted = tokenize(clean);
        if (!pasted.length) return;
        freshIfResult(pasted[0].t === 'op');
        // Número colado logo após outro número: multiplica implicitamente? Não — separa com ×.
        if (endsOperand(last()) && pasted[0].t === 'num') tokens.push({ t: 'op', v: '*' });
        tokens.push(...pasted);
        tokens = tokens.slice(0, MAX_TOKENS);
        render();
        toast('Colado');
    } catch (err) {
        toast(err instanceof CalcError ? err.message : 'Texto não é uma conta');
    }
}

document.addEventListener('paste', (e) => {
    if (prefs.mode === 'currency') return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
    e.preventDefault();
    pasteText(e.clipboardData ? e.clipboardData.getData('text') : '');
});

/* ---------------------------------------------------------
   Teclado físico
   --------------------------------------------------------- */
const keyFind = (sel) => keypad.querySelector(sel);
const KEYMAP = {
    '+': ['[data-op="+"]', () => inputOp('+')],
    '-': ['[data-op="-"]', () => inputOp('-')],
    '*': ['[data-op="*"]', () => inputOp('*')],
    'x': ['[data-op="*"]', () => inputOp('*')],
    '/': ['[data-op="/"]', () => inputOp('/')],
    '^': ['[data-op="^"]', () => inputOp('^')],
    '%': ['[data-post="%"]', () => inputPost('%')],
    '!': ['[data-post="!"]', () => inputPost('!')],
    '(': ['[data-key="lp"]', () => inputParen('lp')],
    ')': ['[data-key="rp"]', () => inputParen('rp')],
    '.': ['[data-key="dot"]', inputDot],
    ',': ['[data-key="dot"]', inputDot],
    'Enter': ['[data-key="eq"]', equals],
    '=': ['[data-key="eq"]', equals],
    'Backspace': ['[data-key="back"]', backspace],
    'Escape': ['[data-key="clear"]', clearAll],
    'Delete': ['[data-key="clear"]', clearAll],
    'F9': ['[data-key="neg"]', toggleSign],
    'p': ['[data-const="pi"]', () => inputConst('pi')],
    'e': ['[data-const="e"]', () => inputConst('e')],
    's': ['[data-fn="sin"]', () => inputFn('sin')],
    'c': ['[data-fn="cos"]', () => inputFn('cos')],
    't': ['[data-fn="tan"]', () => inputFn('tan')],
    'l': ['[data-fn="log"]', () => inputFn('log')],
    'n': ['[data-fn="ln"]', () => inputFn('ln')],
    'r': ['[data-fn="sqrt"]', () => inputFn('sqrt')]
};

document.addEventListener('keydown', (e) => {
    if (prefs.mode === 'currency') return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (e.altKey) return;

    if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === 'c' && !String(window.getSelection() || '')) {
            e.preventDefault();
            copyResult();
        }
        return;
    }

    if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        toggleHistory();
        return;
    }
    if (!historySheet.hidden && e.key === 'Escape') {
        e.preventDefault();
        toggleHistory(false);
        return;
    }

    if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        inputDigit(e.key);
        flash(keyFind(`[data-digit="${e.key}"]`));
        render();
        return;
    }
    const entry = KEYMAP[e.key] || KEYMAP[e.key.toLowerCase()];
    if (!entry) return;
    // Funções científicas por letra só no modo científico.
    if (/^[a-z]$/.test(e.key.toLowerCase()) && e.key !== 'x' && prefs.mode !== 'scientific') return;
    // Enter num botão focado já dispara o clique nativo.
    if (e.key === 'Enter' && t && t.tagName === 'BUTTON' && !t.closest('#keypad')) return;
    e.preventDefault();
    entry[1]();
    flash(keyFind(entry[0]));
    render();
});

/* ---------------------------------------------------------
   Histórico
   --------------------------------------------------------- */
const historySheet = $('#history-sheet');
const historyList = $('#history-list');
const historyEmpty = $('#history-empty');
const btnHistory = $('#btn-history');
let history = store.get(KEYS.history, []);
if (!Array.isArray(history)) history = [];

function pushHistory(expr, value) {
    const result = value.toString();
    const top = history[0];
    if (top && top.expr === expr && top.result === result) return;
    history.unshift({ expr, result, at: Date.now() });
    history = history.slice(0, 60);
    store.set(KEYS.history, history);
    if (!historySheet.hidden) renderHistory();
}

function renderHistory() {
    historyList.textContent = '';
    historyEmpty.hidden = history.length > 0;
    $('#btn-history-clear').hidden = history.length === 0;
    const frag = document.createDocumentFragment();
    history.forEach((item, idx) => {
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'history-item';
        btn.dataset.idx = String(idx);
        let shown = item.result;
        try { shown = formatDec(Dec.parse(item.result)); } catch { /* entrada antiga */ }
        const ex = document.createElement('span');
        ex.className = 'history-expr';
        ex.textContent = `${item.expr} =`;
        const res = document.createElement('span');
        res.className = 'history-result';
        res.textContent = shown;
        btn.append(ex, res);
        btn.setAttribute('aria-label', `${item.expr} igual a ${shown}. Usar resultado`);
        li.appendChild(btn);
        frag.appendChild(li);
    });
    historyList.appendChild(frag);
}

function toggleHistory(force) {
    if (prefs.mode === 'currency') return;
    const open = typeof force === 'boolean' ? force : historySheet.hidden;
    historySheet.hidden = !open;
    btnHistory.setAttribute('aria-expanded', String(open));
    if (open) {
        renderHistory();
        const first = historySheet.querySelector('.history-item') || $('#btn-history-close');
        first.focus({ preventScroll: true });
    } else {
        btnHistory.focus({ preventScroll: true });
    }
}

btnHistory.addEventListener('click', () => toggleHistory());
$('#btn-history-close').addEventListener('click', () => toggleHistory(false));
$('#btn-history-clear').addEventListener('click', () => {
    history = [];
    store.set(KEYS.history, history);
    renderHistory();
    toast('Histórico limpo');
});
historyList.addEventListener('click', (e) => {
    const btn = e.target.closest('.history-item');
    if (!btn) return;
    const item = history[Number(btn.dataset.idx)];
    if (!item) return;
    // Reusa o resultado como operando: se havia conta em andamento, entra nela.
    if (justEvaluated || errorMsg || !tokens.length) {
        tokens = [{ t: 'ans', v: item.result }];
        justEvaluated = true;
        lastRepeat = null;
        displayPrev.textContent = `${item.expr} =`;
    } else {
        if (endsOperand(last())) tokens.push({ t: 'op', v: '*' });
        tokens.push({ t: 'ans', v: item.result });
    }
    toggleHistory(false);
    render();
});
historySheet.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        e.stopPropagation();
        toggleHistory(false);
    }
});

/* ---------------------------------------------------------
   Modos
   --------------------------------------------------------- */
function setMode(mode) {
    if (!['calculator', 'scientific', 'currency'].includes(mode)) mode = 'calculator';
    prefs.mode = mode;
    savePrefs();
    root.dataset.mode = mode;
    modeBtns.forEach((b) => {
        const on = b.dataset.mode === mode;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', String(on));
        b.tabIndex = on ? 0 : -1;
    });
    const isCurrency = mode === 'currency';
    calcPanel.hidden = isCurrency;
    currencySection.hidden = !isCurrency;
    if (isCurrency) {
        historySheet.hidden = true;
        initCurrency();
    } else {
        setSecond(false);
        render();
    }
}

modeBtns.forEach((btn) => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode));
    btn.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        const i = modeBtns.indexOf(btn);
        const next = modeBtns[(i + (e.key === 'ArrowRight' ? 1 : modeBtns.length - 1)) % modeBtns.length];
        next.focus();
        setMode(next.dataset.mode);
    });
});

window.addEventListener('resize', () => {
    if (prefs.mode !== 'currency') render();
});

/* =========================================================
   Conversor de moedas
   Taxas com base USD; conversão cruzada: valor × (taxaDestino / taxaOrigem).
   Provedor primário open.er-api.com, fallback no jsDelivr; cache local de
   1 h evita bater na API a cada visita; offline usa o último cache.
   ========================================================= */
const currencyOne = $('#currency-one');
const currencyTwo = $('#currency-two');
const amountOne = $('#amount-one');
const amountTwo = $('#amount-two');
const rateEl = $('#rate');
const ratesStatus = $('#rates-status');
const refreshBtn = $('#refresh-rates');
const RATES_TIMEOUT_MS = 8000;
const RATES_FRESH_MS = 60 * 60 * 1000;

let rates = null; // { USD: 1, BRL: 5.4, ... }
let ratesMeta = null; // { source, updatedAt, fetchedAt }
let loadingRates = null;

let currencyNames = null;
try {
    currencyNames = new Intl.DisplayNames(['pt-BR'], { type: 'currency' });
} catch {
    currencyNames = null;
}
const nameOf = (code) => {
    try {
        const n = currencyNames ? currencyNames.of(code) : '';
        return n && n !== code ? n : '';
    } catch {
        return '';
    }
};

async function fetchWithTimeout(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), RATES_TIMEOUT_MS);
    try {
        const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } finally {
        clearTimeout(timer);
    }
}

function normalizeRates(raw) {
    const out = {};
    Object.keys(raw).forEach((code) => {
        const v = Number(raw[code]);
        // Só códigos ISO de 3 letras com taxa positiva (o fallback traz cripto e lixo).
        if (/^[a-z]{3}$/i.test(code) && Number.isFinite(v) && v > 0) out[code.toUpperCase()] = v;
    });
    out.USD = 1;
    return out;
}

async function fetchPrimary() {
    const data = await fetchWithTimeout('https://open.er-api.com/v6/latest/USD');
    if (!data || data.result !== 'success' || !data.rates) throw new Error('sem taxas');
    return {
        rates: normalizeRates(data.rates),
        meta: { source: 'ExchangeRate-API', updatedAt: (data.time_last_update_unix || 0) * 1000 || Date.now() }
    };
}

async function fetchFallback() {
    const data = await fetchWithTimeout('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json');
    if (!data || !data.usd) throw new Error('sem taxas');
    return {
        rates: normalizeRates(data.usd),
        meta: { source: 'fawazahmed0/currency-api', updatedAt: data.date ? Date.parse(`${data.date}T00:00:00Z`) : Date.now() }
    };
}

const fmtWhen = (ts) => {
    try {
        return new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch {
        return '';
    }
};

function setStatus(text, tone = '') {
    ratesStatus.textContent = text;
    ratesStatus.dataset.tone = tone;
}

function populateSelects() {
    const codes = Object.keys(rates).sort((a, b) => {
        // Moedas mais usadas no topo, depois ordem alfabética.
        const top = ['BRL', 'USD', 'EUR', 'GBP', 'JPY', 'ARS', 'CAD', 'CHF', 'CNY', 'AUD'];
        const ia = top.indexOf(a);
        const ib = top.indexOf(b);
        if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
        return a.localeCompare(b);
    });
    const build = (select, value) => {
        const frag = document.createDocumentFragment();
        codes.forEach((code) => {
            const opt = document.createElement('option');
            opt.value = code;
            const name = nameOf(code);
            opt.textContent = name ? `${code} — ${name}` : code;
            frag.appendChild(opt);
        });
        select.textContent = '';
        select.appendChild(frag);
        select.value = codes.includes(value) ? value : codes[0];
    };
    build(currencyOne, prefs.from);
    build(currencyTwo, prefs.to);
}

function applyRates(payload, { cached = false } = {}) {
    rates = payload.rates;
    ratesMeta = payload.meta;
    populateSelects();
    convert('one');
    const when = fmtWhen(ratesMeta.updatedAt);
    setStatus(`${cached ? 'Cache · ' : ''}Cotação de ${when} · ${ratesMeta.source}`);
}

function loadCache() {
    const cached = store.get(KEYS.rates, null);
    if (cached && cached.rates && cached.meta && cached.fetchedAt) return cached;
    return null;
}

async function refreshRates({ force = false } = {}) {
    if (loadingRates) return loadingRates;
    const cached = loadCache();
    if (cached && !rates) applyRates(cached, { cached: true });
    if (!force && cached && Date.now() - cached.fetchedAt < RATES_FRESH_MS) {
        applyRates(cached);
        return null;
    }
    refreshBtn.disabled = true;
    refreshBtn.classList.add('is-loading');
    if (!rates) setStatus('Carregando cotações…');
    loadingRates = (async () => {
        try {
            let payload;
            try {
                payload = await fetchPrimary();
            } catch {
                payload = await fetchFallback();
            }
            store.set(KEYS.rates, { ...payload, fetchedAt: Date.now() });
            applyRates(payload);
            if (force) toast('Cotações atualizadas');
        } catch (err) {
            // Previsto (offline, bloqueador): o app segue com o cache.
            console.warn('Cotações indisponíveis:', err);
            if (rates) {
                setStatus(`Sem conexão — usando cotação de ${fmtWhen(ratesMeta.updatedAt)}`, 'warn');
            } else {
                setStatus('Cotações indisponíveis. Verifique a conexão e toque em atualizar.', 'error');
                rateEl.textContent = '—';
            }
        } finally {
            refreshBtn.disabled = false;
            refreshBtn.classList.remove('is-loading');
            loadingRates = null;
        }
    })();
    return loadingRates;
}

function parseAmount(text) {
    const clean = String(text || '').trim();
    if (!clean) return null;
    try {
        const v = evaluateText(clean);
        return v.toNumber();
    } catch {
        return NaN;
    }
}

function formatMoney(value, code) {
    if (!Number.isFinite(value)) return '';
    const abs = Math.abs(value);
    const digits = abs === 0 ? 2 : abs < 0.01 ? 6 : abs < 1 ? 4 : 2;
    return value.toLocaleString('pt-BR', { minimumFractionDigits: Math.min(2, digits), maximumFractionDigits: digits }) + (code ? '' : '');
}

function formatRate(r) {
    const digits = r < 0.001 ? 8 : r < 1 ? 6 : 4;
    return r.toLocaleString('pt-BR', { maximumFractionDigits: digits });
}

function convert(direction) {
    if (!rates) return;
    const from = currencyOne.value;
    const to = currencyTwo.value;
    const rFrom = rates[from];
    const rTo = rates[to];
    if (!rFrom || !rTo) return;
    const cross = rTo / rFrom;
    rateEl.innerHTML = '';
    const a = document.createElement('strong');
    a.textContent = `1 ${from} = ${formatRate(cross)} ${to}`;
    const b = document.createElement('span');
    b.textContent = `1 ${to} = ${formatRate(1 / cross)} ${from}`;
    rateEl.append(a, b);

    const srcInput = direction === 'one' ? amountOne : amountTwo;
    const dstInput = direction === 'one' ? amountTwo : amountOne;
    const factor = direction === 'one' ? cross : 1 / cross;
    const v = parseAmount(srcInput.value);
    srcInput.classList.toggle('is-invalid', Number.isNaN(v));
    if (v === null || Number.isNaN(v)) {
        dstInput.value = '';
        return;
    }
    dstInput.value = formatMoney(v * factor);
    dstInput.classList.remove('is-invalid');
    prefs.from = from;
    prefs.to = to;
    if (direction === 'one') prefs.amount = amountOne.value.slice(0, 40);
    savePrefs();
}

let currencyReady = false;
function initCurrency() {
    if (!currencyReady) {
        currencyReady = true;
        amountOne.value = prefs.amount || '1';
    }
    refreshRates();
}

currencyOne.addEventListener('change', () => convert('one'));
currencyTwo.addEventListener('change', () => convert('one'));
amountOne.addEventListener('input', () => convert('one'));
amountTwo.addEventListener('input', () => convert('two'));
[amountOne, amountTwo].forEach((input) => {
    // Enter "fecha" a conta: 250*4 vira 1.000,00.
    input.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        const v = parseAmount(input.value);
        if (v !== null && !Number.isNaN(v)) input.value = formatMoney(v);
        convert(input === amountOne ? 'one' : 'two');
    });
});
refreshBtn.addEventListener('click', () => refreshRates({ force: true }));
$('#swap').addEventListener('click', () => {
    if (!rates) return;
    const a = currencyOne.value;
    currencyOne.value = currencyTwo.value;
    currencyTwo.value = a;
    $('#swap').classList.remove('is-spin');
    void $('#swap').offsetWidth;
    $('#swap').classList.add('is-spin');
    convert('one');
});
$$('.pair-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
        if (!rates) return;
        const [a, b] = chip.dataset.pair.split('-');
        if (rates[a]) currencyOne.value = a;
        if (rates[b]) currencyTwo.value = b;
        convert('one');
    });
});

/* ---------------------------------------------------------
   Início
   --------------------------------------------------------- */
setAngle(prefs.angle === 'rad' ? 'rad' : 'deg');
setMode(prefs.mode);
render();
