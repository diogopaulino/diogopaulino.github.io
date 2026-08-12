// game/championship.js — estado de uma campanha: patrocinador escolhido, provas cumpridas,
// notas dos rivais e a tabela final. É um objeto simples e serializável; nenhuma dependência
// de canvas/DOM aqui, o que deixa a regra do campeonato testável de cabeça.

import { EVENT_ORDER, EVENTS, RIVALS, PLAYER_NAME, PLACE_POINTS, medalFor, SPONSOR_BOON } from './config.js';

/**
 * Gera a nota de um rival numa prova. A força do rival (0..1) escala o `par` do evento e a
 * variância `spread` embaralha o resultado — assim o pódio muda entre campanhas, mas o
 * especialista de cada prova continua sendo favorito nela.
 */
function rivalScore(rival, eventId, rng) {
    const par = EVENTS[eventId].par;
    const skill = rival.skill[eventId] ?? 0.7;
    const noise = (rng.next() * 2 - 1) * rival.spread;
    return Math.max(0, Math.round(par * (skill + noise)));
}

export class Championship {
    /** @param {'champ'|'single'|'practice'} mode */
    constructor(mode, sponsor, rng, eventIds = EVENT_ORDER) {
        this.mode = mode;
        this.sponsor = sponsor;
        this.rng = rng;
        this.events = [...eventIds];
        this.index = 0;
        /** @type {Record<string, {score:number, raw:number, medal:string|null, detail:string, place:number}>} */
        this.results = {};
        this.boardCache = null;
    }

    get currentEventId() { return this.events[this.index]; }
    get isFinished() { return this.index >= this.events.length; }
    get progressLabel() { return `${Math.min(this.index + 1, this.events.length)}/${this.events.length}`; }

    /** Bônus do patrocinador: só vale na prova afim. */
    applyBoon(eventId, raw) {
        if (!this.sponsor || this.sponsor.boon !== eventId) return raw;
        return raw * (1 + SPONSOR_BOON);
    }

    /**
     * Fecha uma prova. Recebe o score bruto do módulo de gameplay, aplica bônus, calcula a
     * medalha e a colocação contra os rivais, e devolve o pacote para a tela de resultado.
     */
    submit(eventId, raw, detail = '') {
        const boosted = Math.round(this.applyBoon(eventId, raw));
        const rivals = RIVALS.map((r) => ({
            id: r.id,
            name: r.name,
            score: rivalScore(r, eventId, this.rng)
        }));
        const table = [...rivals, { id: 'player', name: PLAYER_NAME, score: boosted }]
            .sort((a, b) => b.score - a.score);
        const place = table.findIndex((row) => row.id === 'player') + 1;

        const entry = {
            score: boosted,
            raw: Math.round(raw),
            boon: boosted - Math.round(raw),
            medal: medalFor(eventId, boosted),
            detail,
            place,
            table
        };
        this.results[eventId] = entry;
        this.boardCache = null;
        return entry;
    }

    advance() { this.index++; }

    /** Total do jogador em pontos de prova (soma dos scores). */
    total() {
        return this.events.reduce((sum, id) => sum + (this.results[id]?.score || 0), 0);
    }

    goldCount() {
        return this.events.filter((id) => this.results[id]?.medal === 'gold').length;
    }

    /**
     * Tabela final do campeonato: pontos por colocação em cada prova, somados.
     * É assim que o pódio do California Games funcionava — não é o somatório bruto de
     * pontuação, é quantas vezes você chegou na frente.
     */
    standings() {
        if (this.boardCache) return this.boardCache;
        const rows = new Map();
        rows.set('player', { id: 'player', name: PLAYER_NAME, points: 0, score: 0 });
        for (const r of RIVALS) rows.set(r.id, { id: r.id, name: r.name, points: 0, score: 0 });

        for (const eventId of this.events) {
            const res = this.results[eventId];
            if (!res) continue;
            res.table.forEach((entry, i) => {
                const row = rows.get(entry.id);
                if (!row) return;
                row.points += PLACE_POINTS[i] ?? 0;
                row.score += entry.score;
            });
        }

        this.boardCache = [...rows.values()].sort((a, b) => b.points - a.points || b.score - a.score);
        return this.boardCache;
    }

    playerPlace() {
        return this.standings().findIndex((row) => row.id === 'player') + 1;
    }
}
