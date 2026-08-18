/**
 * Mimo — regras, raças e paleta.
 *
 * Necessidades em [0, 100]: fome, alegria, higiene, energia, carinho.
 *
 * Decaimento em jogo (por segundo, pet acordado):
 *   fome 0.12 (~14 min até 0) · alegria 0.08 · higiene 0.06 · energia 0.07 · carinho 0.05
 * Dormindo: energia sobe 5/s; as outras caem pela metade.
 *
 * Ausente (por hora real, aplicado no load):
 *   fome −8 · alegria −5 · higiene −4 · energia +12 (teto 100) · carinho −6
 *
 * Ações (deltas e duração):
 *   Comer    fome +48  alegria +10              ~4.4 s
 *   Petisco  fome +14  alegria +22              ~2.1 s
 *   Brincar  alegria +38 energia −20 fome −8    ~7.2 s
 *   Banho    higiene = 100 alegria +12 energia −8  ~6.8 s
 *   Dormir   energia → 100  alegria +8          até encher
 *   Carinho  carinho +8  alegria +6             por toque (~0.4 s)
 *
 * Humor = 0.28·fome + 0.26·alegria + 0.16·higiene + 0.16·energia + 0.14·carinho
 */

export const STORAGE_KEY = 'mimo-pet-v1';

export const NEED_KEYS = ['hunger', 'joy', 'hygiene', 'energy', 'love'];

export const NEED_LABELS = {
    hunger: 'Fome',
    joy: 'Alegria',
    hygiene: 'Higiene',
    energy: 'Energia',
    love: 'Carinho'
};

export const DECAY_PLAY = {
    hunger: 0.12,
    joy: 0.08,
    hygiene: 0.06,
    energy: 0.07,
    love: 0.05
};

export const DECAY_AWAY_PER_HOUR = {
    hunger: -8,
    joy: -5,
    hygiene: -4,
    energy: 12,
    love: -6
};

export const SLEEP_ENERGY = 5;

export const ACTIONS = {
    feed: { duration: 4.4, hunger: 48, joy: 10 },
    treat: { duration: 2.1, hunger: 14, joy: 22 },
    play: { duration: 7.2, joy: 38, energy: -20, hunger: -8 },
    bath: { duration: 6.8, hygiene: 100, joy: 12, energy: -8, setHygiene: true },
    sleep: { duration: 0, energy: 100, joy: 8 },
    pet: { duration: 0.45, love: 8, joy: 6 }
};

export const MOOD_WEIGHTS = {
    hunger: 0.28,
    joy: 0.26,
    hygiene: 0.16,
    energy: 0.16,
    love: 0.14
};

export const COATS = [
    { id: 'cream', name: 'Creme', primary: '#e8d2b0', secondary: '#f4ece0', belly: '#f7efe4', nose: '#3a2420', eyes: '#6b4a2a' },
    { id: 'gold', name: 'Dourado', primary: '#c9924a', secondary: '#e8c888', belly: '#f0d9b0', nose: '#3a2420', eyes: '#4a6a38' },
    { id: 'chocolate', name: 'Chocolate', primary: '#6b3d24', secondary: '#c4a07a', belly: '#d4b896', nose: '#1a1010', eyes: '#8a5a28' },
    { id: 'black', name: 'Preto', primary: '#1c1a1c', secondary: '#3a3438', belly: '#2a2628', nose: '#111010', eyes: '#d4a84a' },
    { id: 'gray', name: 'Cinza', primary: '#8a8c94', secondary: '#d0d2d8', belly: '#eceef2', nose: '#2a2428', eyes: '#6a8cb0' },
    { id: 'orange', name: 'Laranja', primary: '#d07838', secondary: '#f0c090', belly: '#f4e0c4', nose: '#3a2018', eyes: '#3d6a38' },
    { id: 'white', name: 'Branco', primary: '#f2eee8', secondary: '#e8d8c8', belly: '#fffaf4', nose: '#e8a0b0', eyes: '#58a0d0' },
    { id: 'sable', name: 'Sable', primary: '#8a5a32', secondary: '#f0e4d0', belly: '#f6ead8', nose: '#2a1814', eyes: '#3a5a28' }
];

export const DOG_BREEDS = [
    {
        id: 'golden', name: 'Golden Retriever',
        bodyLen: 1.18, bodyH: 0.52, bodyW: 0.48, legLen: 0.42, legR: 0.09,
        head: 0.42, snout: 0.34, ear: 'floppy', earSize: 1.05,
        tail: 'bushy', fur: 0.85, coat: 'gold', pattern: 'solid',
        names: ['Mel', 'Thor', 'Lola', 'Sol']
    },
    {
        id: 'labrador', name: 'Labrador',
        bodyLen: 1.08, bodyH: 0.54, bodyW: 0.5, legLen: 0.4, legR: 0.1,
        head: 0.44, snout: 0.3, ear: 'floppy', earSize: 0.86,
        tail: 'otter', fur: 0.35, coat: 'gold', pattern: 'solid',
        names: ['Max', 'Nina', 'Toby', 'Lua']
    },
    {
        id: 'shiba', name: 'Shiba Inu',
        bodyLen: 0.92, bodyH: 0.48, bodyW: 0.46, legLen: 0.36, legR: 0.085,
        head: 0.46, snout: 0.22, ear: 'point', earSize: 0.92,
        tail: 'curl', fur: 0.7, coat: 'orange', pattern: 'bicolor',
        names: ['Kiko', 'Hana', 'Mochi', 'Yuki']
    },
    {
        id: 'poodle', name: 'Poodle',
        bodyLen: 0.95, bodyH: 0.46, bodyW: 0.4, legLen: 0.46, legR: 0.07,
        head: 0.4, snout: 0.28, ear: 'floppy', earSize: 0.9,
        tail: 'pompon', fur: 1, coat: 'cream', pattern: 'poodle',
        names: ['Coco', 'Pierre', 'Bela', 'Nino']
    },
    {
        id: 'bulldog', name: 'Bulldog',
        bodyLen: 0.88, bodyH: 0.5, bodyW: 0.58, legLen: 0.26, legR: 0.11,
        head: 0.52, snout: 0.12, ear: 'fold', earSize: 0.7,
        tail: 'short', fur: 0.15, coat: 'sable', pattern: 'bicolor',
        names: ['Brutus', 'Daisy', 'Tank', 'Pudim']
    },
    {
        id: 'husky', name: 'Husky',
        bodyLen: 1.12, bodyH: 0.52, bodyW: 0.46, legLen: 0.44, legR: 0.085,
        head: 0.42, snout: 0.28, ear: 'point', earSize: 0.95,
        tail: 'bushy', fur: 0.8, coat: 'gray', pattern: 'mask',
        names: ['Nieve', 'Koda', 'Storm', 'Alaska']
    },
    {
        id: 'dachshund', name: 'Dachshund',
        bodyLen: 1.42, bodyH: 0.34, bodyW: 0.36, legLen: 0.18, legR: 0.07,
        head: 0.36, snout: 0.42, ear: 'floppy', earSize: 1.15,
        tail: 'whip', fur: 0.25, coat: 'chocolate', pattern: 'solid',
        names: ['Salsicha', 'Pretzel', 'Lili', 'Otto']
    },
    {
        id: 'collie', name: 'Border Collie',
        bodyLen: 1.1, bodyH: 0.5, bodyW: 0.42, legLen: 0.44, legR: 0.08,
        head: 0.4, snout: 0.3, ear: 'semi', earSize: 0.88,
        tail: 'plume', fur: 0.75, coat: 'black', pattern: 'bicolor',
        names: ['Sky', 'Bess', 'Ranger', 'Pip']
    }
];

export const CAT_BREEDS = [
    {
        id: 'siamese', name: 'Siamês',
        bodyLen: 0.95, bodyH: 0.36, bodyW: 0.32, legLen: 0.34, legR: 0.055,
        head: 0.34, snout: 0.16, ear: 'point', earSize: 1.25,
        tail: 'whip', fur: 0.25, coat: 'cream', pattern: 'colorpoint',
        names: ['Suki', 'Ming', 'Cleo', 'Thai']
    },
    {
        id: 'persian', name: 'Persa',
        bodyLen: 0.85, bodyH: 0.42, bodyW: 0.48, legLen: 0.22, legR: 0.08,
        head: 0.46, snout: 0.08, ear: 'small', earSize: 0.62,
        tail: 'plume', fur: 1, coat: 'cream', pattern: 'solid',
        names: ['Nuvem', 'Mimi', 'Duque', 'Pompom']
    },
    {
        id: 'mainecoon', name: 'Maine Coon',
        bodyLen: 1.2, bodyH: 0.44, bodyW: 0.42, legLen: 0.38, legR: 0.07,
        head: 0.4, snout: 0.18, ear: 'tuft', earSize: 1.15,
        tail: 'plume', fur: 0.95, coat: 'sable', pattern: 'tabby',
        names: ['Leon', 'Maple', 'Odin', 'Fera']
    },
    {
        id: 'orange', name: 'Laranja',
        bodyLen: 0.9, bodyH: 0.38, bodyW: 0.36, legLen: 0.3, legR: 0.06,
        head: 0.38, snout: 0.14, ear: 'point', earSize: 1,
        tail: 'whip', fur: 0.4, coat: 'orange', pattern: 'tabby',
        names: ['Garfield', 'Frajola', 'Tangerina', 'Ginger']
    },
    {
        id: 'black', name: 'Preto',
        bodyLen: 0.88, bodyH: 0.36, bodyW: 0.34, legLen: 0.3, legR: 0.058,
        head: 0.36, snout: 0.14, ear: 'point', earSize: 1.05,
        tail: 'whip', fur: 0.35, coat: 'black', pattern: 'solid',
        names: ['Shadow', 'Noite', 'Salém', 'Ink']
    },
    {
        id: 'ragdoll', name: 'Ragdoll',
        bodyLen: 1.05, bodyH: 0.4, bodyW: 0.4, legLen: 0.32, legR: 0.065,
        head: 0.4, snout: 0.14, ear: 'point', earSize: 0.92,
        tail: 'plume', fur: 0.9, coat: 'cream', pattern: 'colorpoint',
        names: ['Doll', 'Azul', 'Momo', 'Luna']
    },
    {
        id: 'british', name: 'British Shorthair',
        bodyLen: 0.86, bodyH: 0.42, bodyW: 0.46, legLen: 0.24, legR: 0.08,
        head: 0.46, snout: 0.12, ear: 'small', earSize: 0.72,
        tail: 'thick', fur: 0.55, coat: 'gray', pattern: 'solid',
        names: ['Winston', 'Misty', 'Earl', 'Puff']
    },
    {
        id: 'calico', name: 'Calico',
        bodyLen: 0.9, bodyH: 0.37, bodyW: 0.35, legLen: 0.3, legR: 0.06,
        head: 0.37, snout: 0.14, ear: 'point', earSize: 1,
        tail: 'whip', fur: 0.4, coat: 'white', pattern: 'patches',
        names: ['Pinta', 'Flor', 'Calí', 'Mancha']
    }
];

export function breedsOf(species) {
    return species === 'cat' ? CAT_BREEDS : DOG_BREEDS;
}

export function breedById(species, id) {
    return breedsOf(species).find((b) => b.id === id) || breedsOf(species)[0];
}

export function coatById(id) {
    return COATS.find((c) => c.id === id) || COATS[0];
}

export const QUALITY = {
    low: { id: 'low', pixelRatio: 1, shadows: false, shadowSize: 512, bloom: false, dust: 40, aniso: 2, segs: 12 },
    medium: { id: 'medium', pixelRatio: 1.5, shadows: true, shadowSize: 1024, bloom: true, dust: 90, aniso: 4, segs: 18 },
    high: { id: 'high', pixelRatio: 2, shadows: true, shadowSize: 2048, bloom: true, dust: 180, aniso: 8, segs: 28 }
};

export const LIGHT = {
    exposure: 1.08,
    clear: 0x1a1412,
    fog: 0x2a201c,
    sun: 0xffd4a0,
    sky: 0xa8c8e8,
    ground: 0x4a3024
};
