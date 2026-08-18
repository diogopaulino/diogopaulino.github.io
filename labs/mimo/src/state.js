/**
 * Persistência e simulação das necessidades do pet.
 * Ausência usa o relógio real; em jogo o loop chama tick(dt).
 */

import {
    STORAGE_KEY, NEED_KEYS, DECAY_PLAY, DECAY_AWAY_PER_HOUR,
    SLEEP_ENERGY, ACTIONS
} from './config.js';
import { clamp, moodLabel, moodScore } from './utils.js';

export function defaultNeeds() {
    return { hunger: 72, joy: 78, hygiene: 88, energy: 80, love: 70 };
}

export function defaultProfile() {
    return {
        species: 'dog',
        breed: 'golden',
        coat: 'gold',
        name: 'Mel',
        bornAt: Date.now(),
        needs: defaultNeeds(),
        savedAt: Date.now()
    };
}

export function loadProfile() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (!data?.species || !data?.breed || !data?.name) return null;
        data.needs = applyAway(data.needs || defaultNeeds(), data.savedAt || Date.now());
        return data;
    } catch {
        return null;
    }
}

export function saveProfile(profile) {
    try {
        const payload = { ...profile, savedAt: Date.now() };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch { /* privado */ }
}

export function clearProfile() {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* */ }
}

function applyAway(needs, savedAt) {
    const hours = Math.max(0, (Date.now() - savedAt) / 3600000);
    const next = { ...needs };
    for (const key of NEED_KEYS) {
        next[key] = clamp(next[key] + DECAY_AWAY_PER_HOUR[key] * hours, 0, 100);
    }
    return next;
}

export function tickNeeds(needs, dt, sleeping) {
    const next = { ...needs };
    for (const key of NEED_KEYS) {
        let rate = DECAY_PLAY[key];
        if (sleeping) {
            if (key === 'energy') {
                next.energy = clamp(next.energy + SLEEP_ENERGY * dt, 0, 100);
                continue;
            }
            rate *= 0.45;
        }
        next[key] = clamp(next[key] - rate * dt, 0, 100);
    }
    return next;
}

export function applyAction(needs, actionId) {
    const spec = ACTIONS[actionId];
    if (!spec) return needs;
    const next = { ...needs };
    for (const key of NEED_KEYS) {
        if (typeof spec[key] === 'number') next[key] = clamp(next[key] + spec[key], 0, 100);
    }
    if (spec.setHygiene) next.hygiene = 100;
    return next;
}

export function describe(needs) {
    return { ...moodLabel(needs), score: moodScore(needs) };
}
