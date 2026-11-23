/* =========================================================
   Calculator — motor numérico
   ---------------------------------------------------------
   1. Dec: decimal de precisão arbitrária sobre BigInt.
      valor = m × 10^e  (m: BigInt com sinal, e: inteiro)
      · Soma, subtração e multiplicação são EXATAS (0,1 + 0,2 = 0,3).
      · Divisão e potências guardam PREC = 34 dígitos significativos
        (mesma precisão do decimal128 / IEEE 754-2008), arredondamento
        "metade para cima".
      · Funções transcendentais (sin, ln, √ …) passam por Number e voltam
        com 15 dígitos significativos (toPrecision(15)): é o limite real de
        um double, e corta o ruído binário (Math.log10(1000) = 2,9999…).
   2. Parser descendente recursivo com precedência de calculadora:
        expr    := soma
        soma    := mult (('+'|'−') mult)*          ← 200 + 10% = 220
        mult    := unário (('×'|'÷') unário | mult. implícita)*
        unário  := ('−'|'+') unário | potência     ← −2² = −4
        potência:= pós-fixo ('^' unário)?          ← associativa à direita
        pós-fixo:= primário ('!' | '%' | '²' | '³' | '⁻¹')*
        primário:= número | constante | '(' expr ')' | função expr ')'
      Parênteses abertos são fechados automaticamente no fim.
   ========================================================= */

export const PREC = 34;
const MAX_EXP = 9999; // |resultado| < 10^9999, senão "muito grande"

export class CalcError extends Error {
    constructor(message) {
        super(message);
        this.name = 'CalcError';
    }
}

const TEN = 10n;
const pow10 = (n) => TEN ** BigInt(n);
const digitsOf = (m) => (m < 0n ? -m : m).toString().length;

export class Dec {
    constructor(m, e = 0) {
        this.m = m;
        this.e = e;
    }

    static zero = new Dec(0n, 0);
    static one = new Dec(1n, 0);

    static norm(m, e) {
        if (m === 0n) return Dec.zero;
        while (m % TEN === 0n) {
            m /= TEN;
            e += 1;
        }
        return new Dec(m, e);
    }

    /** Arredonda para `sig` dígitos significativos (metade para cima). */
    static round(m, e, sig = PREC) {
        const d = digitsOf(m);
        if (d > sig) {
            const drop = d - sig;
            const div = pow10(drop);
            let q = m / div;
            const r = m % div;
            const r2 = (r < 0n ? -r : r) * 2n;
            if (r2 >= div) q += m < 0n ? -1n : 1n;
            m = q;
            e += drop;
        }
        const out = Dec.norm(m, e);
        if (!out.isZero()) {
            const mag = out.magnitude();
            if (mag > MAX_EXP) throw new CalcError('Número muito grande');
            if (mag < -MAX_EXP) return Dec.zero;
        }
        return out;
    }

    /** Aceita "12.5", "-0.001", "1.5e-7" (ponto como separador decimal). */
    static parse(str) {
        const s = String(str).trim();
        const match = /^([+-]?)(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(s);
        if (!match || (!match[2] && !match[3])) throw new CalcError('Número inválido');
        const [, sign, int = '', frac = '', exp = '0'] = match;
        const digits = (int + frac).replace(/^0+(?=\d)/, '') || '0';
        let m = BigInt(digits);
        if (sign === '-') m = -m;
        return Dec.round(m, Number(exp) - frac.length);
    }

    static fromNumber(x) {
        if (Number.isNaN(x)) throw new CalcError('Fora do domínio');
        if (!Number.isFinite(x)) throw new CalcError('Número muito grande');
        if (x === 0) return Dec.zero;
        return Dec.parse(x.toPrecision(15));
    }

    static fromBigInt(n) {
        return Dec.round(n, 0);
    }

    isZero() { return this.m === 0n; }
    isNeg() { return this.m < 0n; }
    isInteger() { return this.e >= 0; }

    /** Ordem de grandeza: posição do dígito mais significativo (1 → 1, 0,5 → 0). */
    magnitude() { return this.e + digitsOf(this.m); }

    neg() { return new Dec(-this.m, this.e); }
    abs() { return this.m < 0n ? this.neg() : this; }

    add(b) {
        if (this.isZero()) return b;
        if (b.isZero()) return this;
        // Diferença de escala maior que a precisão: o menor não altera o resultado.
        const gap = this.magnitude() - b.magnitude();
        if (gap > PREC + 2) return this;
        if (gap < -(PREC + 2)) return b;
        const e = Math.min(this.e, b.e);
        const m = this.m * pow10(this.e - e) + b.m * pow10(b.e - e);
        return Dec.round(m, e);
    }

    sub(b) { return this.add(b.neg()); }

    mul(b) {
        if (this.isZero() || b.isZero()) return Dec.zero;
        return Dec.round(this.m * b.m, this.e + b.e);
    }

    div(b) {
        if (b.isZero()) throw new CalcError('Divisão por zero');
        if (this.isZero()) return Dec.zero;
        const shift = Math.max(0, PREC + 3 + digitsOf(b.m) - digitsOf(this.m));
        const q = (this.m * pow10(shift)) / b.m;
        return Dec.round(q, this.e - b.e - shift);
    }

    cmp(b) {
        const d = this.sub(b);
        return d.isZero() ? 0 : d.isNeg() ? -1 : 1;
    }

    /** Inteiro exato (só chame se isInteger()). */
    toBigInt() {
        return this.e >= 0 ? this.m * pow10(this.e) : this.m / pow10(-this.e);
    }

    /** Potência inteira exata por quadrados sucessivos (|n| ≤ 100 000). */
    powInt(n) {
        let neg = n < 0;
        let k = neg ? -n : n;
        let base = this;
        let acc = Dec.one;
        while (k > 0) {
            if (k & 1) acc = acc.mul(base);
            k = Math.floor(k / 2);
            if (k) base = base.mul(base);
        }
        return neg ? Dec.one.div(acc) : acc;
    }

    toNumber() {
        return parseFloat(`${this.m}e${this.e}`);
    }

    /** Representação canônica com ponto ("0.1", "-12", "1e+40"). Usada para guardar. */
    toString() {
        if (this.isZero()) return '0';
        const neg = this.m < 0n;
        const ds = (neg ? -this.m : this.m).toString();
        const mag = this.e + ds.length;
        let body;
        if (this.e >= 0 && mag <= 40) body = ds + '0'.repeat(this.e);
        else if (this.e < 0 && mag > 0) body = `${ds.slice(0, mag)}.${ds.slice(mag)}`;
        else if (this.e < 0 && mag > -20) body = `0.${'0'.repeat(-mag)}${ds}`;
        else body = `${ds[0]}${ds.length > 1 ? `.${ds.slice(1)}` : ''}e${mag - 1 >= 0 ? '+' : ''}${mag - 1}`;
        return (neg ? '-' : '') + body;
    }
}

export const CONST = {
    pi: Dec.parse('3.141592653589793238462643383279503'),
    e: Dec.parse('2.718281828459045235360287471352662')
};

/* ---------------------------------------------------------
   Formatação pt-BR: 1.234.567,89 · 1,2345e+20
   --------------------------------------------------------- */
export const DECIMAL_SEP = ',';
export const GROUP_SEP = '.';

export function groupInt(intDigits) {
    return intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, GROUP_SEP);
}

/**
 * Formata um Dec para exibição com até `sig` dígitos significativos.
 * Notação científica fora de 1e-7 … 1e16 (como iOS/Windows).
 */
export function formatDec(dec, sig = 16, { group = true } = {}) {
    if (dec.isZero()) return '0';
    const r = Dec.round(dec.m, dec.e, sig);
    const neg = r.m < 0n;
    const ds = (neg ? -r.m : r.m).toString();
    const mag = r.e + ds.length; // posição da vírgula a partir do 1º dígito
    let out;
    if (mag > sig || mag < -6) {
        const mant = ds.length > 1 ? `${ds[0]}${DECIMAL_SEP}${ds.slice(1)}` : ds;
        const exp = mag - 1;
        out = `${mant}e${exp >= 0 ? '+' : ''}${exp}`;
    } else if (mag <= 0) {
        out = `0${DECIMAL_SEP}${'0'.repeat(-mag)}${ds}`;
    } else if (r.e >= 0) {
        const int = ds + '0'.repeat(r.e);
        out = group ? groupInt(int) : int;
    } else {
        const int = ds.slice(0, mag);
        out = `${group ? groupInt(int) : int}${DECIMAL_SEP}${ds.slice(mag)}`;
    }
    return (neg ? '−' : '') + out;
}

/** Versão para a área de transferência: sem agrupamento e com hífen ASCII. */
export function plainDec(dec, sig = 16) {
    return formatDec(dec, sig, { group: false }).replace('−', '-');
}

/* ---------------------------------------------------------
   Tokens
   num   { t:'num', v:'12.5' }  (dígitos digitados, ponto interno)
   ans   { t:'ans', v:'0.333…' } (resultado anterior, precisão cheia)
   op    { t:'op', v:'+'|'-'|'*'|'/'|'^' }
   fn    { t:'fn', v:'sin'|… }   (já inclui o "(")
   lp/rp { t:'lp' } { t:'rp' }
   post  { t:'post', v:'!'|'%'|'sq'|'cube'|'inv' }
   const { t:'const', v:'pi'|'e' }
   --------------------------------------------------------- */

export const FN_LABEL = {
    sin: 'sin', cos: 'cos', tan: 'tan',
    asin: 'sin⁻¹', acos: 'cos⁻¹', atan: 'tan⁻¹',
    log: 'log', ln: 'ln', sqrt: '√', cbrt: '∛',
    exp10: '10^', exp: 'e^', abs: 'abs'
};
const OP_LABEL = { '+': '+', '-': '−', '*': '×', '/': '÷', '^': '^' };
const POST_LABEL = { '!': '!', '%': '%', sq: '²', cube: '³', inv: '⁻¹' };
const CONST_LABEL = { pi: 'π', e: 'e' };

/** Número digitado → texto pt-BR preservando zeros e vírgula finais ("1.234,50"). */
export function formatTyped(v) {
    if (/e/i.test(v)) return formatDec(Dec.parse(v));
    const [int, frac] = v.split('.');
    const g = groupInt(int || '0');
    return frac === undefined ? g : `${g}${DECIMAL_SEP}${frac}`;
}

export function tokenLabel(tok) {
    switch (tok.t) {
        case 'num': return formatTyped(tok.v);
        case 'ans': return formatDec(Dec.parse(tok.v));
        case 'op': return OP_LABEL[tok.v];
        case 'fn': return `${FN_LABEL[tok.v]}(`;
        case 'lp': return '(';
        case 'rp': return ')';
        case 'post': return POST_LABEL[tok.v];
        case 'const': return CONST_LABEL[tok.v];
        default: return '';
    }
}

/** Expressão legível: operadores binários com espaço, unários colados. */
export function tokensToText(tokens, { ghostParens = false } = {}) {
    let out = '';
    let depth = 0;
    tokens.forEach((tok, i) => {
        const label = tokenLabel(tok);
        if (tok.t === 'op' && tok.v !== '^' && !isUnaryAt(tokens, i)) out += ` ${label} `;
        else out += label;
        if (tok.t === 'lp' || tok.t === 'fn') depth += 1;
        if (tok.t === 'rp') depth = Math.max(0, depth - 1);
    });
    if (ghostParens && depth > 0) out += ')'.repeat(depth);
    return out;
}

export function openParens(tokens) {
    let depth = 0;
    for (const tok of tokens) {
        if (tok.t === 'lp' || tok.t === 'fn') depth += 1;
        else if (tok.t === 'rp') depth = Math.max(0, depth - 1);
    }
    return depth;
}

/** Um '+'/'−' é unário no início ou logo após operador, '(' ou função. */
export function isUnaryAt(tokens, i) {
    const tok = tokens[i];
    if (!tok || tok.t !== 'op' || (tok.v !== '-' && tok.v !== '+')) return false;
    const prev = tokens[i - 1];
    return !prev || prev.t === 'op' || prev.t === 'lp' || prev.t === 'fn';
}

/** Fim de operando: depois dele pode vir operador binário ou pós-fixo. */
export function endsOperand(tok) {
    return !!tok && (tok.t === 'num' || tok.t === 'ans' || tok.t === 'rp' || tok.t === 'post' || tok.t === 'const');
}

/* ---------------------------------------------------------
   Tokenizador de texto livre (colar, campo de moedas).
   Aceita vírgula ou ponto decimal: se há vírgula, ela é a decimal e
   os pontos são milhares ("1.500,25"); sem vírgula, um ponto seguido
   de exatamente 3 dígitos é milhar ("1.500"), senão é decimal ("1.5").
   --------------------------------------------------------- */
export function normalizeNumberText(raw) {
    let s = raw.replace(/\s|_/g, '');
    if (s.includes(',')) return s.replace(/\./g, '').replace(',', '.');
    const dots = (s.match(/\./g) || []).length;
    if (dots > 1) return s.replace(/\./g, '');
    if (dots === 1 && /^\d{1,3}\.\d{3}$/.test(s)) return s.replace('.', '');
    return s;
}

const WORD_FN = [
    ['asin', 'asin'], ['acos', 'acos'], ['atan', 'atan'],
    ['sin', 'sin'], ['sen', 'sin'], ['cos', 'cos'], ['tan', 'tan'], ['tg', 'tan'],
    ['log', 'log'], ['ln', 'ln'], ['sqrt', 'sqrt'], ['abs', 'abs']
];

export function tokenize(text) {
    const src = String(text)
        .replace(/[×xX*]/g, '*')
        .replace(/[÷:]/g, '/')
        .replace(/[−–—]/g, '-')
        .replace(/\*\*/g, '^');
    const out = [];
    let i = 0;
    while (i < src.length) {
        const ch = src[i];
        if (/\s/.test(ch)) { i += 1; continue; }
        const num = /^[\d.,]+(?:e[+-]?\d+)?/i.exec(src.slice(i));
        if (num && /\d/.test(num[0])) {
            const norm = normalizeNumberText(num[0]);
            Dec.parse(norm); // valida
            out.push({ t: 'num', v: norm });
            i += num[0].length;
            continue;
        }
        if ('+-*/^'.includes(ch)) { out.push({ t: 'op', v: ch }); i += 1; continue; }
        if (ch === '(' || ch === '[') { out.push({ t: 'lp' }); i += 1; continue; }
        if (ch === ')' || ch === ']') { out.push({ t: 'rp' }); i += 1; continue; }
        if (ch === '!' || ch === '%') { out.push({ t: 'post', v: ch }); i += 1; continue; }
        if (ch === '²') { out.push({ t: 'post', v: 'sq' }); i += 1; continue; }
        if (ch === '³') { out.push({ t: 'post', v: 'cube' }); i += 1; continue; }
        if (ch === 'π') { out.push({ t: 'const', v: 'pi' }); i += 1; continue; }
        if (ch === '√') { out.push({ t: 'fn', v: 'sqrt' }); i += 1; if (src[i] === '(') i += 1; continue; }
        const rest = src.slice(i).toLowerCase();
        if (rest.startsWith('pi')) { out.push({ t: 'const', v: 'pi' }); i += 2; continue; }
        const word = WORD_FN.find(([w]) => rest.startsWith(w));
        if (word) {
            out.push({ t: 'fn', v: word[1] });
            i += word[0].length;
            while (src[i] === ' ') i += 1;
            if (src[i] === '(') i += 1;
            continue;
        }
        if (rest[0] === 'e') { out.push({ t: 'const', v: 'e' }); i += 1; continue; }
        throw new CalcError(`Símbolo desconhecido: ${ch}`);
    }
    return out;
}

/* ---------------------------------------------------------
   Avaliação
   --------------------------------------------------------- */
const DEG = Math.PI / 180;

function snap(x) {
    // Resíduo binário de sin(π) etc.: abaixo de 1e-15 é zero na prática.
    return Math.abs(x) < 1e-15 ? 0 : x;
}

/** Trigonometria em graus com valores notáveis exatos (sin 30° = 0,5). */
function trigDeg(kind, deg) {
    const a = ((deg % 360) + 360) % 360;
    if (kind === 'tan' && (a === 90 || a === 270)) throw new CalcError('Fora do domínio');
    const exact = {
        sin: { 0: 0, 30: 0.5, 90: 1, 150: 0.5, 180: 0, 210: -0.5, 270: -1, 330: -0.5 },
        cos: { 0: 1, 60: 0.5, 90: 0, 120: -0.5, 180: -1, 240: -0.5, 270: 0, 300: 0.5 },
        tan: { 0: 0, 45: 1, 135: -1, 180: 0, 225: 1, 315: -1 }
    }[kind][a];
    if (exact !== undefined) return exact;
    return Math[kind](a * DEG);
}

function applyFn(name, x, angle) {
    const n = x.toNumber();
    switch (name) {
        case 'sin':
        case 'cos':
        case 'tan':
            if (angle === 'deg') return Dec.fromNumber(snap(trigDeg(name, n)));
            if (name === 'tan' && Math.abs(Math.cos(n)) < 1e-15) throw new CalcError('Fora do domínio');
            return Dec.fromNumber(snap(Math[name](n)));
        case 'asin':
        case 'acos': {
            if (n < -1 || n > 1) throw new CalcError('Fora do domínio');
            const r = Math[name](n);
            return Dec.fromNumber(snap(angle === 'deg' ? r / DEG : r));
        }
        case 'atan': {
            const r = Math.atan(n);
            return Dec.fromNumber(snap(angle === 'deg' ? r / DEG : r));
        }
        case 'log':
            if (n <= 0) throw new CalcError('Fora do domínio');
            if (x.m === 1n) return new Dec(BigInt(x.e), 0); // potência exata de 10
            return Dec.fromNumber(Math.log10(n));
        case 'ln':
            if (n <= 0) throw new CalcError('Fora do domínio');
            return Dec.fromNumber(Math.log(n));
        case 'sqrt':
            if (x.isNeg()) throw new CalcError('Raiz de negativo');
            return decSqrt(x);
        case 'cbrt':
            return Dec.fromNumber(Math.cbrt(n));
        case 'exp10':
            return power(new Dec(1n, 1), x);
        case 'exp':
            return Dec.fromNumber(Math.exp(n));
        case 'abs':
            return x.abs();
        default:
            throw new CalcError('Função desconhecida');
    }
}

/** Raiz quadrada com 34 dígitos (Newton em BigInt): √2 sem ruído. */
function decSqrt(x) {
    if (x.isZero()) return Dec.zero;
    // Escala para inteiro com expoente par e ~2·PREC dígitos.
    let m = x.m;
    let e = x.e;
    const want = PREC * 2 + 2;
    let shift = Math.max(0, want - digitsOf(m));
    if ((e - shift) % 2 !== 0) shift += 1;
    m *= pow10(shift);
    e -= shift;
    // Newton partindo de cima (r₀ ≥ √m) decresce monotonicamente até ⌊√m⌋.
    let r = pow10(Math.ceil(digitsOf(m) / 2));
    for (;;) {
        const next = (r + m / r) / 2n;
        if (next >= r) break;
        r = next;
    }
    return Dec.round(r, e / 2);
}

export function power(base, exp) {
    if (exp.isInteger() && exp.abs().magnitude() <= 6) {
        const n = Number(exp.toBigInt());
        if (Math.abs(n) <= 100000) {
            if (base.isZero() && n < 0) throw new CalcError('Divisão por zero');
            if (base.isZero()) return n === 0 ? Dec.one : Dec.zero;
            return base.powInt(n);
        }
    }
    const b = base.toNumber();
    const p = exp.toNumber();
    if (b < 0) throw new CalcError('Fora do domínio');
    return Dec.fromNumber(Math.pow(b, p));
}

function factorial(x) {
    if (!x.isInteger() || x.isNeg()) throw new CalcError('Fatorial só de inteiros ≥ 0');
    const n = Number(x.toBigInt());
    if (n > 3000) throw new CalcError('Número muito grande');
    let acc = 1n;
    for (let k = 2n; k <= BigInt(n); k += 1n) acc *= k;
    return Dec.fromBigInt(acc);
}

class Parser {
    constructor(tokens, angle) {
        this.t = tokens;
        this.i = 0;
        this.angle = angle;
    }

    peek() { return this.t[this.i]; }
    next() { return this.t[this.i++]; }

    parse() {
        if (!this.t.length) return Dec.zero;
        const node = this.sum();
        if (this.i < this.t.length) {
            // ')' sobrando é ignorado como na maioria das calculadoras.
            while (this.peek() && this.peek().t === 'rp') this.i += 1;
            if (this.i < this.t.length) throw new CalcError('Expressão inválida');
        }
        return node.v;
    }

    sum() {
        let left = this.product();
        for (;;) {
            const tok = this.peek();
            if (!tok || tok.t !== 'op' || (tok.v !== '+' && tok.v !== '-')) break;
            this.next();
            const right = this.product();
            // Percentual de calculadora: 200 + 10% = 220 · 200 − 10% = 180
            const r = right.pct ? left.v.mul(right.raw).div(new Dec(1n, 2)) : right.v;
            left = { v: tok.v === '+' ? left.v.add(r) : left.v.sub(r) };
        }
        return left;
    }

    product() {
        let left = this.unary();
        for (;;) {
            const tok = this.peek();
            if (!tok) break;
            if (tok.t === 'op' && (tok.v === '*' || tok.v === '/')) {
                this.next();
                const right = this.unary();
                left = { v: tok.v === '*' ? left.v.mul(right.v) : left.v.div(right.v) };
            } else if (tok.t === 'num' || tok.t === 'ans' || tok.t === 'const' || tok.t === 'lp' || tok.t === 'fn') {
                // Multiplicação implícita: 2π, 3(4+1), (2)(3), 2sin(30)
                const right = this.unary();
                left = { v: left.v.mul(right.v) };
            } else break;
        }
        return left;
    }

    unary() {
        const tok = this.peek();
        if (tok && tok.t === 'op' && (tok.v === '-' || tok.v === '+')) {
            this.next();
            const inner = this.unary();
            return tok.v === '-' ? { v: inner.v.neg(), pct: inner.pct, raw: inner.raw && inner.raw.neg() } : inner;
        }
        return this.power();
    }

    power() {
        const base = this.postfix();
        const tok = this.peek();
        if (tok && tok.t === 'op' && tok.v === '^') {
            this.next();
            if (!this.peek()) throw new CalcError('Expressão incompleta');
            const exp = this.unary();
            return { v: power(base.v, exp.v) };
        }
        return base;
    }

    postfix() {
        let node = this.primary();
        for (;;) {
            const tok = this.peek();
            if (!tok || tok.t !== 'post') break;
            this.next();
            switch (tok.v) {
                case '%': node = { v: node.v.div(new Dec(1n, 2)), pct: true, raw: node.v }; break;
                case '!': node = { v: factorial(node.v) }; break;
                case 'sq': node = { v: node.v.mul(node.v) }; break;
                case 'cube': node = { v: node.v.powInt(3) }; break;
                case 'inv': node = { v: Dec.one.div(node.v) }; break;
                default: break;
            }
        }
        return node;
    }

    primary() {
        const tok = this.next();
        if (!tok) throw new CalcError('Expressão incompleta');
        switch (tok.t) {
            case 'num': return { v: Dec.parse(tok.v) };
            case 'ans': return { v: Dec.parse(tok.v) };
            case 'const': return { v: CONST[tok.v] };
            case 'lp': {
                const inner = this.sum();
                if (this.peek() && this.peek().t === 'rp') this.next();
                return { v: inner.v };
            }
            case 'fn': {
                const inner = this.sum();
                if (this.peek() && this.peek().t === 'rp') this.next();
                return { v: applyFn(tok.v, inner.v, this.angle) };
            }
            default:
                throw new CalcError('Expressão incompleta');
        }
    }
}

/** Avalia uma lista de tokens. angle: 'deg' | 'rad'. Lança CalcError. */
export function evaluate(tokens, { angle = 'deg' } = {}) {
    try {
        return new Parser(tokens, angle).parse();
    } catch (err) {
        if (err instanceof CalcError) throw err;
        if (err instanceof RangeError) throw new CalcError('Número muito grande');
        throw new CalcError('Expressão inválida');
    }
}

/** Avalia texto livre (colar, campo de valor do conversor). */
export function evaluateText(text, opts) {
    return evaluate(tokenize(text), opts);
}
