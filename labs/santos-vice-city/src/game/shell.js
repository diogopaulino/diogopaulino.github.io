// game/shell.js — registro de eventos, run state, medalhas, rivais, pontos, save glue.
// Teto: ~230 linhas.

import ciclovia from './events/ciclovia.js';
import surf from './events/surf.js';
import pastel from './events/pastel.js';
import canal from './events/canal.js';
import morro from './events/morro.js';

export const EVENTS = [ciclovia, surf, pastel, canal, morro];
export const EVENT_IDS = EVENTS.map(e => e.id);
export const ORDER = ['ciclovia', 'surf', 'pastel', 'canal', 'morro'];

const RIVALS = [
    { name: 'MARÉ ALTA', color: '#3fb8c4' },
    { name: 'TIA DO CALDO', color: '#ffb35c' },
    { name: 'JORGE DO CARRINHO', color: '#ff2fa0' },
    { name: 'GAIVOTA F.C.', color: '#00f0ff' },
    { name: 'ZÉ DA KOMBI', color: '#e0bd82' },
    { name: 'DONA NEUZA', color: '#f6d8bd' }
];

export class GameShell {
    constructor(store, rng) {
        this.store = store;
        this.rng = rng;
        this.eventIdx = 0;
        this.champPoints = 0;
        this.champRivals = [];
        this.mode = 'treino'; // 'treino' | 'campeonato'
    }

    getEvent(idOrIdx) {
        if (typeof idOrIdx === 'string') {
            return EVENTS.find(e => e.id === idOrIdx);
        }
        return EVENTS[idOrIdx] || EVENTS[0];
    }

    startCampeonato() {
        this.mode = 'campeonato';
        this.eventIdx = 0;
        this.champPoints = 0;
        this.champRivals = this._genRivals();
        return this.getEvent(0);
    }

    startTreino(eventId) {
        this.mode = 'treino';
        return this.getEvent(eventId);
    }

    nextEvent() {
        if (this.mode !== 'campeonato') return null;
        this.eventIdx++;
        if (this.eventIdx >= EVENTS.length) return null; // campeonato acabou
        return this.getEvent(this.eventIdx);
    }

    /** Calcula pontos normalizados: score normalizado + bônus por medalha. */
    scoreToPoints(eventId, score, medal) {
        const event = this.getEvent(eventId);
        const platina = event.medals.platina;
        const norm = Math.max(0, Math.min(1000, Math.round(1000 * score / platina)));
        const medalBonus = { none: 0, bronze: 50, prata: 120, ouro: 250, platina: 400 }[medal] || 0;
        return norm + medalBonus;
    }

    recordResult(eventId, score, medal) {
        const isRecord = this.store.submitScore(eventId, score, medal);
        if (this.mode === 'campeonato') {
            const points = this.scoreToPoints(eventId, score, medal);
            this.champPoints += points;
        }
        return isRecord;
    }

    finishCampeonato() {
        const isChampRecord = this.store.submitChampion(this.champPoints, 1, false);
        return { points: this.champPoints, isRecord: isChampRecord, rivals: this.champRivals };
    }

    _genRivals() {
        const rivals = [];
        for (let i = 0; i < 3; i++) {
            const rival = this.rng.pick(RIVALS);
            rivals.push({ ...rival, points: 0, medals: {} });
        }

        // simula pontos dos rivais (jittered)
        for (const rival of rivals) {
            for (const eventId of ORDER) {
                const event = this.getEvent(eventId);
                const base = event.medals.prata;
                const target = base * (0.88 + this.rng.next() * 0.24); // ±12%
                const score = Math.floor(target * (0.9 + this.rng.next() * 0.2));
                const medal = score >= event.medals.ouro ? 'ouro'
                            : score >= event.medals.prata ? 'prata'
                            : score >= event.medals.bronze ? 'bronze'
                            : 'none';
                rival.points += this.scoreToPoints(eventId, score, medal);
                rival.medals[eventId] = medal;
            }
        }
        rivals.sort((a, b) => b.points - a.points);
        return rivals;
    }

    getPodium() {
        const all = [...this.champRivals, { name: 'VOCÊ', points: this.champPoints }];
        all.sort((a, b) => b.points - a.points);
        return all.slice(0, 3);
    }
}
