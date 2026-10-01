/**
 * Santos, 1908 — configuração da cena e do filme.
 * Escala: 1 unidade ≈ 1 metro.
 * Referências: research.md (D05 9h30, K02 dimensões, P03–P05 porto manual).
 */

export const FILM_DURATION = 180; // segundos — loop cinematográfico

export const QUALITY = {
    low: {
        id: 'low',
        pr: 1,
        antialias: false,
        bloom: false,
        shadows: false,
        shadowMap: 1024,
        waterSeg: 48,
        warehouses: 8,
        workers: 18,
        carts: 4,
        ships: 2,
        birds: 8,
        steam: 40,
        trees: 20
    },
    medium: {
        id: 'medium',
        pr: 1.25,
        antialias: true,
        bloom: true,
        shadows: true,
        shadowMap: 2048,
        waterSeg: 96,
        warehouses: 12,
        workers: 36,
        carts: 7,
        ships: 3,
        birds: 14,
        steam: 70,
        trees: 40
    },
    high: {
        id: 'high',
        pr: 1.5,
        antialias: true,
        bloom: true,
        shadows: true,
        shadowMap: 4096,
        waterSeg: 128,
        warehouses: 14,
        workers: 52,
        carts: 10,
        ships: 4,
        birds: 22,
        steam: 110,
        trees: 60
    }
};

/** Layout do porto: água em Z, cais em X+ (margem continental / ilha). */
export const LAYOUT = {
    quayX: 28,
    quayZ0: -220,
    quayZ1: 120,
    warehouseDepth: 18,
    kasatoLength: 123.4,
    kasatoBeam: 15.4,
    dockZ: -40, // armazém 14 aproximado
    valongoZ: 55,
    serraX: 180
};

export const CHAPTERS = [
    { id: 'sea', t: 0, label: 'Mar aberto' },
    { id: 'estuary', t: 28, label: 'Estuário' },
    { id: 'port', t: 55, label: 'Porto do café' },
    { id: 'dock', t: 95, label: 'Atracação · 9h30' },
    { id: 'deck', t: 125, label: 'Olhar dos passageiros' },
    { id: 'rail', t: 148, label: 'Valongo' },
    { id: 'rise', t: 162, label: 'Porto e cidade' }
];

export function chapterAt(t) {
    let cur = CHAPTERS[0];
    for (const c of CHAPTERS) {
        if (t >= c.t) cur = c;
    }
    return cur;
}
