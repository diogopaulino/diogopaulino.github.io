/**
 * Quimera — catálogo de kits e âncoras do boneco.
 *
 * Combinações = KITS.length ^ 3 (cabeça × corpo × acessório).
 * As âncoras abaixo são o contrato entre as três peças: qualquer
 * cabeça encaixa no pescoço, qualquer acessório no mesmo grip.
 */

export const LAYOUT = {
    // pés em y = 0; estilo vinil chibi (cabeça grande, tronco curto)
    HEAD_R: 0.30,
    HEAD_Y: 1.50,
    NECK_Y: 1.20,
    SHOULDER_Y: 1.06,
    SHOULDER_X: 0.36,
    CHEST_Y: 0.84,
    HIP_Y: 0.50,
    GRIP: [0.52, 0.70, 0.16],
    SHOULDER_L: [-0.38, 1.12, 0.12],
    BACK: [0, 0.92, -0.28],
    HEAD_TOP: [0, 0.34, 0]
};

export const STORAGE_KEY = 'quimera-mix-v1';

export const KITS = [
    {
        id: 'pirate',
        name: 'Pirata',
        emoji: '🏴‍☠️',
        blurb: 'Sete mares',
        complete: 'Lenda dos Sete Mares',
        skin: 0xc99672,
        iris: 0x3a2418,
        colors: {
            primary: 0x6b1d2a,
            secondary: 0x1c1c22,
            accent: 0xc9a227,
            cloth: 0x3d2a24,
            trim: 0xe8d9b0
        }
    },
    {
        id: 'sailor',
        name: 'Marinheiro',
        emoji: '⚓',
        blurb: 'Vento em popa',
        complete: 'Vento em Popa',
        skin: 0xe0b090,
        iris: 0x3d5a80,
        colors: {
            primary: 0x1d3a6e,
            secondary: 0xf2f0ea,
            accent: 0xc45c4a,
            cloth: 0x1d3a6e,
            trim: 0xf2f0ea
        }
    },
    {
        id: 'astronaut',
        name: 'Astronauta',
        emoji: '🚀',
        blurb: 'Órbita calma',
        complete: 'Órbita Tranquila',
        skin: 0xd4a07a,
        iris: 0x2a3344,
        colors: {
            primary: 0xe8e4dc,
            secondary: 0x6a7380,
            accent: 0xd4783a,
            cloth: 0xe8e4dc,
            trim: 0xc45c2a
        }
    },
    {
        id: 'warrior',
        name: 'Guerreiro',
        emoji: '🛡️',
        blurb: 'Guarda da aurora',
        complete: 'Guardião da Aurora',
        skin: 0xb8734f,
        iris: 0x2c1810,
        colors: {
            primary: 0x6e3b22,
            secondary: 0x8a8f96,
            accent: 0xc9a227,
            cloth: 0x4a2a1c,
            trim: 0xb8bec8
        }
    },
    {
        id: 'wizard',
        name: 'Mago',
        emoji: '🔮',
        blurb: 'Pó de estrela',
        complete: 'Arquimago da Bruma',
        skin: 0xe8c4a8,
        iris: 0x5b3ea8,
        colors: {
            primary: 0x3a2a6e,
            secondary: 0x1a1430,
            accent: 0xd4b85a,
            cloth: 0x3a2a6e,
            trim: 0xd4b85a
        }
    },
    {
        id: 'ninja',
        name: 'Ninja',
        emoji: '🥷',
        blurb: 'Sombra quieta',
        complete: 'Sombra do Bambuzal',
        skin: 0xc48a6a,
        iris: 0x1a1a1e,
        colors: {
            primary: 0x1a1a22,
            secondary: 0x2e2a38,
            accent: 0xa33a3a,
            cloth: 0x1a1a22,
            trim: 0x5a1a1a
        }
    },
    {
        id: 'chef',
        name: 'Chef',
        emoji: '🍳',
        blurb: 'Fogo brando',
        complete: 'Mestre do Fogão',
        skin: 0xf0c8a8,
        iris: 0x4a3020,
        colors: {
            primary: 0xf4f1ea,
            secondary: 0x2a2a32,
            accent: 0xc45c4a,
            cloth: 0xf4f1ea,
            trim: 0x2a2a32
        }
    },
    {
        id: 'robot',
        name: 'Robô',
        emoji: '🤖',
        blurb: 'Clic-clic',
        complete: 'Unidade Amável',
        skin: 0x9aa4b2,
        iris: 0x3ad0e8,
        colors: {
            primary: 0x6a7380,
            secondary: 0x2a3038,
            accent: 0x3ad0e8,
            cloth: 0x8a929c,
            trim: 0xffb060
        }
    },
    {
        id: 'explorer',
        name: 'Explorador',
        emoji: '🧭',
        blurb: 'Mapa aberto',
        complete: 'Rumo ao Desconhecido',
        skin: 0xc4a07a,
        iris: 0x3d5a40,
        colors: {
            primary: 0xc4a05a,
            secondary: 0x4a5a38,
            accent: 0x6b3a22,
            cloth: 0xd4c08a,
            trim: 0x4a5a38
        }
    },
    {
        id: 'cowboy',
        name: 'Cowboy',
        emoji: '🤠',
        blurb: 'Pôr do sol',
        complete: 'Cavaleiro do Ocaso',
        skin: 0xd4a07c,
        iris: 0x4a3020,
        colors: {
            primary: 0x6b3a22,
            secondary: 0xc4a06a,
            accent: 0xc45c2a,
            cloth: 0x3d4a6e,
            trim: 0x6b3a22
        }
    },
    {
        id: 'viking',
        name: 'Viking',
        emoji: '🪓',
        blurb: 'Mar do norte',
        complete: 'Filho do Fiordo',
        skin: 0xe0b898,
        iris: 0x3d5a80,
        colors: {
            primary: 0x4a3020,
            secondary: 0x8a6a48,
            accent: 0xb8bec8,
            cloth: 0x6b3a22,
            trim: 0xd8c8b0
        }
    },
    {
        id: 'fairy',
        name: 'Fada',
        emoji: '✨',
        blurb: 'Pó-len',
        complete: 'Guardiã do Clareira',
        skin: 0xf2d0b4,
        iris: 0x5a8a6e,
        colors: {
            primary: 0xe8a0c4,
            secondary: 0xb8e0d0,
            accent: 0xf0e070,
            cloth: 0xf0c0d8,
            trim: 0xd0f0e8
        }
    },
    {
        id: 'samurai',
        name: 'Samurai',
        emoji: '⚔️',
        blurb: 'Cerejeira',
        complete: 'Lâmina da Cerejeira',
        skin: 0xc09070,
        iris: 0x1a1a1e,
        colors: {
            primary: 0x6b1d2a,
            secondary: 0x1c1c22,
            accent: 0xc9a227,
            cloth: 0x2a2a38,
            trim: 0xc9a227
        }
    },
    {
        id: 'scientist',
        name: 'Cientista',
        emoji: '🔬',
        blurb: 'Eureka',
        complete: 'Eureka Calmo',
        skin: 0xe8c4b8,
        iris: 0x4a6a8a,
        colors: {
            primary: 0xf2f0ea,
            secondary: 0x3a6a8a,
            accent: 0x6ad0a0,
            cloth: 0xf2f0ea,
            trim: 0x3a6a8a
        }
    }
];

export const KIT_BY_ID = Object.fromEntries(KITS.map((k) => [k.id, k]));

export const COMBO_TOTAL = KITS.length ** 3;

export function kitIndex(id) {
    const i = KITS.findIndex((k) => k.id === id);
    return i < 0 ? 0 : i;
}

export function wrapIndex(i, n = KITS.length) {
    return ((i % n) + n) % n;
}

export function randomIds(preferMix = true) {
    const n = KITS.length;
    const head = Math.floor(Math.random() * n);
    let body = Math.floor(Math.random() * n);
    let accessory = Math.floor(Math.random() * n);
    if (preferMix) {
        if (body === head) body = wrapIndex(body + 1 + Math.floor(Math.random() * (n - 1)));
        if (accessory === head || accessory === body) {
            accessory = wrapIndex(head + 2 + Math.floor(Math.random() * (n - 2)));
        }
    }
    return {
        head: KITS[head].id,
        body: KITS[body].id,
        accessory: KITS[accessory].id
    };
}

export function mixTitle(ids) {
    const h = KIT_BY_ID[ids.head];
    const b = KIT_BY_ID[ids.body];
    const a = KIT_BY_ID[ids.accessory];
    if (ids.head === ids.body && ids.body === ids.accessory) {
        return { kicker: 'Conjunto completo', title: h.complete };
    }
    return {
        kicker: 'Quimera livre',
        title: `${h.name} · ${b.name} · ${a.name}`
    };
}

export function parseHash(hash) {
    const raw = String(hash || '').replace(/^#/, '').trim();
    if (!raw) return null;
    const [head, body, accessory] = raw.split('-');
    if (KIT_BY_ID[head] && KIT_BY_ID[body] && KIT_BY_ID[accessory]) {
        return { head, body, accessory };
    }
    return null;
}

export function toHash(ids) {
    return `${ids.head}-${ids.body}-${ids.accessory}`;
}
