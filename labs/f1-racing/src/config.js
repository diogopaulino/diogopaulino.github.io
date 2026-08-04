/** Static configuration: teams, compounds, difficulty, quality tiers, persistence. */

export const TEAMS = [
    {
        id: 'scuderia',
        name: 'Scuderia Rossa',
        short: 'ROS',
        number: 16,
        primary: 0xd8261f,
        secondary: 0x1a1c22,
        accent: 0xffd451,
        pace: 1.0
    },
    {
        id: 'silverarrow',
        name: 'Silver Arrow',
        short: 'SIL',
        number: 63,
        primary: 0x1fd4c4,
        secondary: 0x0f1216,
        accent: 0xc8ccd4,
        pace: 0.995
    },
    {
        id: 'bulls',
        name: 'Midnight Bulls',
        short: 'MID',
        number: 1,
        primary: 0x1f3f9c,
        secondary: 0x0c1020,
        accent: 0xe03a2f,
        pace: 1.005
    },
    {
        id: 'papaya',
        name: 'Papaya Works',
        short: 'PAP',
        number: 4,
        primary: 0xf06a12,
        secondary: 0x101418,
        accent: 0x1cc6f0,
        pace: 1.0
    },
    {
        id: 'emerald',
        name: 'Emerald Racing',
        short: 'EME',
        number: 14,
        primary: 0x0e7a5a,
        secondary: 0x0b1114,
        accent: 0xd6e04a,
        pace: 0.99
    },
    {
        id: 'azure',
        name: 'Azure Grand Prix',
        short: 'AZU',
        number: 10,
        primary: 0x0b74c4,
        secondary: 0x11151c,
        accent: 0xe0417a,
        pace: 0.985
    },
    {
        id: 'violet',
        name: 'Violet Dynamics',
        short: 'VIO',
        number: 22,
        primary: 0x7b3ff2,
        secondary: 0x0d0f18,
        accent: 0x00e0b0,
        pace: 0.98
    },
    {
        id: 'crimson',
        name: 'Crimson Motors',
        short: 'CRI',
        number: 27,
        primary: 0xb5123f,
        secondary: 0x14161c,
        accent: 0xf2f2f2,
        pace: 0.978
    }
];

export const DRIVER_NAMES = [
    'M. Ferrari', 'L. Hakkinen', 'S. Vettori', 'A. Prosperi', 'K. Rindt', 'J. Clarke',
    'N. Piquete', 'E. Fittipaldo', 'G. Villanova', 'R. Barros', 'D. Hill Jr.', 'T. Senna'
];

export const COMPOUNDS = {
    soft: { id: 'soft', label: 'Macio', color: '#e8404a', grip: 1.06, wear: 1.55, warmup: 1.35 },
    medium: { id: 'medium', label: 'Médio', color: '#f0c419', grip: 1.0, wear: 1.0, warmup: 1.0 },
    hard: { id: 'hard', label: 'Duro', color: '#e6e6e6', grip: 0.945, wear: 0.66, warmup: 0.78 }
};

export const DIFFICULTIES = {
    rookie: { id: 'rookie', label: 'Rookie', pace: 0.88, error: 0.045, aggression: 0.45, reaction: 0.6 },
    pro: { id: 'pro', label: 'Pro', pace: 0.965, error: 0.02, aggression: 0.7, reaction: 0.8 },
    legend: { id: 'legend', label: 'Legend', pace: 1.02, error: 0.007, aggression: 0.92, reaction: 0.95 }
};

export const QUALITY = {
    low: {
        id: 'low',
        label: 'Performance',
        pixelRatio: 1,
        shadows: false,
        shadowSize: 1024,
        post: false,
        bloom: false,
        scenery: 0.35,
        particles: 0.35,
        drawDistance: 900,
        anisotropy: 2
    },
    medium: {
        id: 'medium',
        label: 'Equilibrado',
        pixelRatio: 1.35,
        shadows: true,
        shadowSize: 1536,
        post: true,
        bloom: true,
        scenery: 0.7,
        particles: 0.7,
        drawDistance: 1400,
        anisotropy: 4
    },
    high: {
        id: 'high',
        label: 'Ultra',
        pixelRatio: 1.6,
        shadows: true,
        shadowSize: 2048,
        post: true,
        bloom: true,
        scenery: 1,
        particles: 1,
        drawDistance: 2200,
        anisotropy: 8
    }
};

export const CAMERAS = [
    { id: 'chase', label: 'Perseguição' },
    { id: 'cockpit', label: 'Cockpit' },
    { id: 'bonnet', label: 'Capô' },
    { id: 'broadcast', label: 'TV' }
];

export const WEATHER = {
    dry: { id: 'dry', label: 'Pista seca', grip: 1, spray: 0, cloud: 0.25 },
    damp: { id: 'damp', label: 'Pista úmida', grip: 0.88, spray: 0.4, cloud: 0.7 },
    wet: { id: 'wet', label: 'Chuva forte', grip: 0.74, spray: 1, cloud: 1 }
};

export const STORAGE_KEY = 'f1gp.settings.v2';
export const RECORDS_KEY = 'f1gp.records.v2';

export const DEFAULT_SETTINGS = {
    circuit: 'monza',
    team: 'scuderia',
    compound: 'soft',
    weather: 'dry',
    difficulty: 'pro',
    laps: 0,             // 0 = circuit default
    opponents: 7,
    camera: 'chase',
    quality: 'auto',
    volume: 0.7,
    engineAudio: true,
    assists: true,       // steering damping + traction help
    autoGears: true,
    racingLine: false,
    units: 'kmh'
};

function safeStorage() {
    try {
        const probe = '__f1probe';
        localStorage.setItem(probe, '1');
        localStorage.removeItem(probe);
        return localStorage;
    } catch {
        return null;
    }
}

const store = safeStorage();

export function loadSettings() {
    if (!store) return { ...DEFAULT_SETTINGS };
    try {
        const raw = store.getItem(STORAGE_KEY);
        if (!raw) return { ...DEFAULT_SETTINGS };
        return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {
        return { ...DEFAULT_SETTINGS };
    }
}

export function saveSettings(settings) {
    if (!store) return;
    try {
        store.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch { /* quota or private mode */ }
}

export function loadRecords() {
    if (!store) return {};
    try {
        return JSON.parse(store.getItem(RECORDS_KEY) || '{}');
    } catch {
        return {};
    }
}

export function saveRecord(circuitKey, lapTime) {
    if (!store) return false;
    const records = loadRecords();
    if (records[circuitKey] && records[circuitKey] <= lapTime) return false;
    records[circuitKey] = lapTime;
    try {
        store.setItem(RECORDS_KEY, JSON.stringify(records));
    } catch { /* ignore */ }
    return true;
}

export function clearRecords() {
    if (!store) return;
    try {
        store.removeItem(RECORDS_KEY);
    } catch { /* ignore */ }
}

/** Picks a quality tier from the device profile when the user hasn't chosen one. */
export function detectQuality() {
    const mobile = matchMedia('(pointer: coarse)').matches;
    const cores = navigator.hardwareConcurrency || 4;
    const memory = navigator.deviceMemory || 4;
    if (mobile) return cores >= 6 && memory >= 4 ? 'medium' : 'low';
    // Desktop browsers: prefer medium+ so shadows/PBR read correctly.
    if (cores >= 6 && memory >= 4) return 'high';
    if (cores >= 4) return 'medium';
    return 'low';
}

export function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return '--:--.---';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${m}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

export function formatDelta(seconds) {
    if (!Number.isFinite(seconds)) return '--.---';
    const sign = seconds >= 0 ? '+' : '-';
    const abs = Math.abs(seconds);
    return `${sign}${abs.toFixed(3)}`;
}
