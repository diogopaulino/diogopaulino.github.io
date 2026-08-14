/**
 * Nereida — constantes, paleta e fórmulas da natação.
 *
 * Física (água viscosa, sem gravidade efetiva):
 *   a = input * ACCEL
 *   v ← v + a·dt
 *   v ← v · exp(-DRAG · dt)
 *   p ← p + v·dt
 *   y ∈ [FLOOR + CLEARANCE, SURFACE - CLEARANCE]
 *   se |xz| > BOUND: projeta de volta e amortece v.xz
 *
 * Coleta:  |p − p_maré| < COLLECT_R  e  maré ainda visível.
 *
 * Sonar: raio(t) = SONAR_SPEED · t, t ∈ [0, SONAR_LIFE].
 *   ping se a maré está dentro do raio neste frame.
 *
 * Despertar α = coletadas / TOTAL_TIDES ∈ [0, 1]
 *   whaleRadius  = lerp(WHALE_R0, WHALE_R1, α)
 *   fogDensity   = lerp(FOG0, FOG1, α)
 *   coralGlow    = lerp(0.18, 1.15, α)
 */

export const TOTAL_TIDES = 7;

export const FLOOR = 0;
export const SURFACE = 26;
export const BOUND = 46;
export const CLEARANCE = 1.35;

export const ACCEL = 16;
export const DRAG = 1.65;
export const MAX_SPEED = 9.2;
export const VERTICAL = 7.4;

export const COLLECT_R = 2.35;
export const SONAR_SPEED = 18;
export const SONAR_LIFE = 1.35;
export const SONAR_PING_R = 22;

export const WHALE_R0 = 34;
export const WHALE_R1 = 13;

export const FOG0 = 0.021;
export const FOG1 = 0.011;
export const FOG_COLOR = 0x06202c;

export const QUALITY = {
    low: {
        pr: 1,
        antialias: false,
        bloom: false,
        shadows: false,
        kelp: 28,
        fish: 48,
        jellies: 5,
        plankton: 160,
        rays: 0,
        coral: 18
    },
    medium: {
        pr: 1.35,
        antialias: true,
        bloom: true,
        shadows: true,
        kelp: 48,
        fish: 90,
        jellies: 8,
        plankton: 280,
        rays: 7,
        coral: 28
    },
    high: {
        pr: 1.7,
        antialias: true,
        bloom: true,
        shadows: true,
        kelp: 70,
        fish: 130,
        jellies: 11,
        plankton: 420,
        rays: 10,
        coral: 40
    }
};

export const TIDES = [
    { pos: [0.4, 4.2, -18.5], name: 'Anêmona', hint: 'O jardim acendeu.' },
    { pos: [17.2, 5.6, -7.4], name: 'Leque', hint: 'Os corais cantam em silêncio.' },
    { pos: [-18.6, 5.1, 5.2], name: 'Kelp', hint: 'A floresta balança com você.' },
    { pos: [9.4, 11.8, 15.6], name: 'Cardume', hint: 'Os peixes aprenderam o seu rastro.' },
    { pos: [-13.2, 13.6, -11.4], name: 'Medusas', hint: 'As águas-vivas pulsam mais fundo.' },
    { pos: [21.5, 7.8, 9.6], name: 'Arco', hint: 'A pedra lembra a lua.' },
    { pos: [0, 9.4, 0.6], name: 'Coração', hint: 'O santuário reconhece Nereida.' }
];

export function lerp(a, b, t) {
    return a + (b - a) * t;
}
