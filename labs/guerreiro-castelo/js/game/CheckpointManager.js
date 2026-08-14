import { STORAGE_KEY } from '../core/assets.js';

export const CHECKPOINTS = [
    'home_intro',
    'ship_start',
    'storm_start',
    'storm_rope',
    'castle_beach',
    'castle_exterior',
    'secret_door',
    'sleeping_guard',
    'princess_cell',
    'tiger_room',
    'princess_rescued',
    'escape_start',
    'beach_escape',
    'ship_escape',
    'ending'
];

export class CheckpointManager {
    constructor() {
        this.current = 'home_intro';
        this.data = this.load() || { checkpoint: 'home_intro', flags: {}, inventory: {} };
    }

    load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    }

    hasSave() {
        return Boolean(this.load()?.checkpoint);
    }

    save(id, extra = {}) {
        this.current = id;
        this.data = {
            checkpoint: id,
            flags: extra.flags || this.data.flags || {},
            inventory: extra.inventory || this.data.inventory || {},
            quest: extra.quest || this.data.quest,
            level: extra.level || this.data.level
        };
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
        } catch { /* privado */ }
    }

    clear() {
        this.current = 'home_intro';
        this.data = { checkpoint: 'home_intro', flags: {}, inventory: {} };
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch { /* privado */ }
    }
}
