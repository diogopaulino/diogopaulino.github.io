/**
 * Nina — regras e fórmulas do vale.
 *
 * Objetivo: coletar amoras, oferecer uma a cada filhote perdido (Espaço)
 * e levá-los ao piquenique no ninho. Podem seguir em fila.
 *
 * Escala: o vale usa metros reais para grama, árvores e construções; os bichos
 * são de livro infantil (Nina tem ~1,4 m do focinho à cauda, os filhotes de
 * 0,45 a 0,75 m) para que a criança os veja no meio da grama alta.
 *
 * Movimento (terceira pessoa, relativo à câmera):
 *   a = eixo * ACCEL
 *   v *= exp(-FRICTION * dt)
 *   |v.xz| ≤ (correndo ? RUN : WALK)
 *   hop: se grounded ou coyote < COYOTE → vy = JUMP_VY
 *        + impulso horizontal HOP_BOOST * dir
 *   vy -= GRAVITY * dt
 *   y = max(y, chão(x, z))                      altura do pulo = JUMP_VY² / (2·GRAVITY) ≈ 0,9 m
 *   chão(x, z) = max(terreno(x, z), nível_da_água − FLOAT·altura_do_bicho)   (nada no lago)
 *
 * Andadura (Nina e filhotes): escolhida pela velocidade real v contra as
 * velocidades naturais do bicho (creature.gaits):
 *   v < 0,25 m/s → parado · v < (passo+trote)/2 → passo · v < (trote+galope)/2 → trote · senão galope
 *
 * Filhote seguindo, i-ésimo da fila (trilha de migalhas de Nina):
 *   alvo_i = ponto da trilha a GAP·(i+1) metros atrás de Nina, medido sobre o caminho andado
 *            (sem trilha suficiente: líder.pos − líder.forward·GAP·(i+1))
 *   pos = mix(pos, alvo, 1 − exp(−FOLLOW_LAMBDA * dt))
 *
 * Aproximação: |pos − filhote| < BEFRIEND_R e amoras ≥ 1
 * Depósito:    |pos − ninho| < HOME_R com pelo menos um seguidor
 */

export const WORLD_RADIUS = 40;

export const WALK_SPEED = 4.0;
export const RUN_SPEED = 7.4;
export const ACCEL = 26;
export const FRICTION = 8.0;
export const JUMP_VY = 6.3;
export const GRAVITY = 22;
export const COYOTE = 0.12;
export const HOP_BOOST = 1.5;

export const FOLLOW_GAP = 1.15;
export const FOLLOW_LAMBDA = 7.2;
export const BEFRIEND_R = 2.1;
export const HOME_R = 3.8;
export const BERRY_R = 1.25;
/** Fração da altura do bicho que afunda quando ele boia. */
export const FLOAT = 0.52;

export const TOTAL_FRIENDS = 7;
export const TOTAL_BERRIES = 14;

export const HOME = { x: 0, z: 2.2 };
/** Celeiro entre o ninho e o pintinho (que fica ATRÁS dele); a porta olha para o ninho. */
export const BARN = { x: 11.2, z: -6.6, ry: -0.905 };
export const POND = { x: -15.2, z: 7.2, radius: 7.2 };
/** Riacho: nasce nas colinas a noroeste e deságua no laguinho (ordem = rio abaixo). */
export const CREEK = [[-66, 47], [-52, 37], [-40, 28.5], [-30, 20.5], [-23, 14.6], [-18.6, 10.4]];
/** Trilhas de terra: celeiro → pomar passando ao lado do ninho, ninho → lago e a entrada do ninho. */
export const TRAILS = [
    [[8.5, -4.4], [6.0, -1.2], [4.7, 3.0], [3.7, 7.4], [5.2, 11.6], [9.4, 15.6], [15.5, 20.5], [24, 25]],
    [[-3.5, 4.3], [-5.8, 5.8], [-8.4, 6.8]],
    [[3.7, 7.4], [1.3, 6.5], [0, 5.3]]
];

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

/** Arbustos de amora (x, z) — 14 frutos colhíveis. */
export const BERRY_SPOTS = [
    [-2.2, 9.6], [2.6, -4.6], [-5.4, 2.2], [6.2, -9.4],
    [-8.2, 0.4], [6.6, 11.6], [-10.5, -6.2], [16.4, 0.6],
    [1.2, -8.4], [-4.8, 12.2], [12.8, 13.4], [-17.8, -1.2],
    [8.2, -15.2], [-12.2, -14.8]
];

/**
 * Relevo-base do vale (antes do lago, do riacho e das trilhas, que world.js escava).
 * Colina do cordeiro + morrinho do ninho + ondulação suave + colinas em volta:
 * h = 0.42·sin(0.09x)·cos(0.08z)
 *   + 3.1·exp(−((x+7)²+(z+17)²)/92)
 *   + 0.5·exp(−(x²+(z−2.2)²)/26)
 *   + 10·smoothstep(34, 82, d)            (d = distância ao centro: anel de colinas)
 */
export function heightAt(x, z) {
    const wave = 0.42 * Math.sin(x * 0.09) * Math.cos(z * 0.08);
    const hill = 3.1 * Math.exp(-((x + 7) ** 2 + (z + 17) ** 2) / 92);
    const mound = 0.5 * Math.exp(-(x * x + (z - HOME.z) ** 2) / 26);
    const d = Math.hypot(x, z);
    const k = Math.min(1, Math.max(0, (d - 34) / 48));
    const rim = 10 * k * k * (3 - 2 * k);
    return wave + hill + mound + rim;
}

export function clampToWorld(x, z, r = WORLD_RADIUS - 1.6) {
    const d = Math.hypot(x, z);
    if (d <= r) return { x, z };
    const k = r / d;
    return { x: x * k, z: z * k };
}
