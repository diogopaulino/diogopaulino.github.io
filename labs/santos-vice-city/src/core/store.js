// core/store.js — save único em localStorage, tolerante a falhas (privado, quota, JSON corrompido).
// Teto: ~110 linhas.

const KEY = 'svc.save.v1';
const VERSION = 1;

const EVENT_IDS = ['ciclovia', 'surf', 'pastel', 'canal', 'morro'];

function defaults() {
    const best = {};
    for (const id of EVENT_IDS) best[id] = { score: 0, medal: null, date: 0 };
    return {
        v: VERSION,
        best,
        champ: { best: 0, podium: 0, assist: false, date: 0 },
        opts: { mute: false, vol: 0.7, scanlines: true, shake: true, assist: false, showTouch: null },
        seen: { intro: false }
    };
}

export class Store {
    constructor() {
        this.data = this._load();
    }

    _load() {
        try {
            const raw = localStorage.getItem(KEY);
            if (!raw) return defaults();
            const parsed = JSON.parse(raw);
            if (!parsed || parsed.v !== VERSION) return defaults();
            const d = defaults();
            // merge raso — protege contra chaves faltando após uma versão nova
            return {
                ...d, ...parsed,
                best: { ...d.best, ...(parsed.best || {}) },
                champ: { ...d.champ, ...(parsed.champ || {}) },
                opts: { ...d.opts, ...(parsed.opts || {}) },
                seen: { ...d.seen, ...(parsed.seen || {}) }
            };
        } catch {
            return defaults();
        }
    }

    _save() {
        try {
            localStorage.setItem(KEY, JSON.stringify(this.data));
        } catch {
            /* privado / quota — silenciosamente ignora */
        }
    }

    getBest(eventId) {
        return this.data.best[eventId] || { score: 0, medal: null, date: 0 };
    }

    /** Registra um resultado; devolve true se bateu recorde. */
    submitScore(eventId, score, medal) {
        const cur = this.getBest(eventId);
        const isRecord = score > cur.score;
        if (isRecord) {
            this.data.best[eventId] = { score, medal, date: Date.now() };
            this._save();
        }
        return isRecord;
    }

    submitChampion(totalScore, podium, assist) {
        const isRecord = totalScore > this.data.champ.best;
        if (isRecord) {
            this.data.champ = { best: totalScore, podium, assist, date: Date.now() };
            this._save();
        }
        return isRecord;
    }

    getOpts() { return this.data.opts; }

    setOpt(key, value) {
        this.data.opts[key] = value;
        this._save();
    }

    markIntroSeen() {
        this.data.seen.intro = true;
        this._save();
    }

    reset() {
        this.data = defaults();
        this._save();
    }
}
