/**
 * Amora — regras e fórmulas do vale.
 *
 * Objetivo: coletar amoras, oferecer uma a cada filhote perdido (Espaço)
 * e levá-los ao piquenique no ninho. Podem seguir em fila, estilo Pikmin.
 *
 * Movimento (terceira pessoa, relativo à câmera):
 *   a = eixo * ACCEL
 *   v *= exp(-FRICTION * dt)
 *   |v.xz| ≤ (correndo ? RUN : WALK)
 *   hop: se grounded ou coyote < COYOTE → vy = JUMP_VY
 *        + impulso horizontal HOP_BOOST * dir
 *   vy -= GRAVITY * dt
 *   y = max(y, groundHeight(x, z))
 *
 * Filhote seguindo o i-ésimo da fila:
 *   alvo = líder.pos − líder.forward * GAP * (i + 1)
 *   pos = mix(pos, alvo, 1 − exp(−FOLLOW_LAMBDA * dt))
 *
 * Aproximação: |pos − filhote| < BEFRIEND_R e amoras ≥ 1
 * Depósito:    |pos − ninho| < HOME_R com pelo menos um seguidor
 */

export const WORLD_RADIUS = 40;

export const WALK_SPEED = 7.2;
export const RUN_SPEED = 11.6;
export const ACCEL = 34;
export const FRICTION = 6.4;
export const JUMP_VY = 8.6;
export const GRAVITY = 26;
export const COYOTE = 0.12;
export const HOP_BOOST = 2.4;

export const FOLLOW_GAP = 1.28;
export const FOLLOW_LAMBDA = 7.2;
export const BEFRIEND_R = 1.9;
export const HOME_R = 3.8;
export const BERRY_R = 1.15;

export const TOTAL_FRIENDS = 7;
export const TOTAL_BERRIES = 14;

export const HOME = { x: 0, z: 2.2 };

/** Filhotes perdidos — um por canto do vale. */
export const FRIENDS = [
    { id: 'piu', name: 'Piu', kind: 'chick', hint: 'o pintinho atrás do celeiro', x: 14.5, z: -9.2 },
    { id: 'pata', name: 'Pata', kind: 'duck', hint: 'o patinho no lago', x: -15.4, z: 7.6 },
    { id: 'fofo', name: 'Fofo', kind: 'bunny', hint: 'o coelhinho no pomar', x: 10.2, z: 16.8 },
    { id: 'la', name: 'Lã', kind: 'lamb', hint: 'o cordeirinho no morro', x: -7.4, z: -17.6 },
    { id: 'miau', name: 'Miau', kind: 'kitten', hint: 'o gatinho no campo de flores', x: 18.8, z: 4.4 },
    { id: 'ouri', name: 'Ouri', kind: 'hedge', hint: 'o ouriço no bosque de cogumelos', x: -18.6, z: -8.4 },
    { id: 'tata', name: 'Tata', kind: 'turtle', hint: 'a tartaruguinha no riacho', x: -21.2, z: 14.2 }
];

/**
 * Relevo do vale. Colina do cordeiro + depressão do lago + ondulação suave.
 * h = 0.42·sin(0.09x)·cos(0.08z)
 *   + 2.55·exp(−((x+7)²+(z+17)²)/92)
 *   + 0.55·exp(−(x²+z²)/18)
 *   − 1.15·exp(−((x+15)²+(z−7)²)/28)
 */
export function heightAt(x, z) {
    const wave = 0.42 * Math.sin(x * 0.09) * Math.cos(z * 0.08);
    const hill = 2.55 * Math.exp(-((x + 7) ** 2 + (z + 17) ** 2) / 92);
    const mound = 0.55 * Math.exp(-(x * x + z * z) / 18);
    const pond = 1.15 * Math.exp(-((x + 15) ** 2 + (z - 7) ** 2) / 28);
    const rim = Math.max(0, Math.hypot(x, z) - 34) * 0.55;
    return wave + hill + mound - pond + rim;
}

export function clampToWorld(x, z, r = WORLD_RADIUS - 1.6) {
    const d = Math.hypot(x, z);
    if (d <= r) return { x, z };
    const k = r / d;
    return { x: x * k, z: z * k };
}
