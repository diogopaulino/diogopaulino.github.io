// core/store.js — save único em localStorage, tolerante a falhas (aba privada, quota estourada,
// JSON corrompido). Nunca lança: se o storage não colaborar, o jogo roda em memória.

import { EVENT_ORDER } from '../game/config.js';

const KEY = 'svg.save.v2';
const VERSION = 2;

function defaults() {
    const best = {};
    for (const id of EVENT_ORDER) best[id] = { score: 0, medal: null, detail: '', date: 0 };
    return {
        v: VERSION,
        best,
        champ: { best: 0, place: 0, sponsor: null, date: 0, golds: 0 },
        opts: { mute: false, vol: 0.7, scanlines: true, shake: true, touch: null },
        seen: { intro: false, sponsor: null }
    };
}

export class Store {
    constructor() {
        this.data = this._load();
    }

    _load() {
        const d = defaults();
        try {
            const raw = localStorage.getItem(KEY);
            if (!raw) return d;
            const parsed = JSON.parse(raw);
            if (!parsed || parsed.v !== VERSION) return d;
            // merge raso: protege contra chaves ausentes depois de uma versão nova do jogo
            return {
                ...d, ...parsed,
                best: { ...d.best, ...(parsed.best || {}) },
                champ: { ...d.champ, ...(parsed.champ || {}) },
                opts: { ...d.opts, ...(parsed.opts || {}) },
                seen: { ...d.seen, ...(parsed.seen || {}) }
            };
        } catch {
            return d;
        }
    }

    _save() {
        try {
            localStorage.setItem(KEY, JSON.stringify(this.data));
        } catch {
            /* aba privada / quota — o save vira no-op, o jogo continua */
        }
    }

    getBest(eventId) {
        return this.data.best[eventId] || { score: 0, medal: null, detail: '', date: 0 };
    }

    /** Registra o resultado de uma prova; devolve true se bateu recorde pessoal. */
    submitScore(eventId, score, medal, detail = '') {
        const cur = this.getBest(eventId);
        if (score <= cur.score) return false;
        this.data.best[eventId] = { score: Math.round(score), medal, detail, date: Date.now() };
        this._save();
        return true;
    }

    /** Registra o fecho de um campeonato; devolve true se foi a melhor campanha até agora. */
    submitChampionship({ total, place, sponsor, golds }) {
        if (total <= this.data.champ.best) return false;
        this.data.champ = { best: Math.round(total), place, sponsor, golds, date: Date.now() };
        this._save();
        return true;
    }

    /** Soma de todos os recordes pessoais — usada como "pontuação de carreira" no menu. */
    careerTotal() {
        return EVENT_ORDER.reduce((sum, id) => sum + this.getBest(id).score, 0);
    }

    medalCount() {
        const count = { gold: 0, silver: 0, bronze: 0 };
        for (const id of EVENT_ORDER) {
            const m = this.getBest(id).medal;
            if (m && count[m] != null) count[m]++;
        }
        return count;
    }

    getOpts() { return this.data.opts; }

    setOpt(key, value) {
        this.data.opts[key] = value;
        this._save();
    }

    markIntroSeen() {
        if (this.data.seen.intro) return;
        this.data.seen.intro = true;
        this._save();
    }

    rememberSponsor(id) {
        this.data.seen.sponsor = id;
        this._save();
    }

    reset() {
        this.data = defaults();
        this._save();
    }
}
