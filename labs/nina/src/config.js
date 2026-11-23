/**
 * Nina — regras e fórmulas do vale.
 *
 * Objetivo: coletar amoras, encostar num filhote perdido com uma amora (ele vem
 * atrás de você) e levá-los ao piquenique no ninho. Podem seguir em fila.
 * Sem morte nem tempo-limite: cair na água vira nado, e nada prende Nina.
 *
 * Escala: o vale usa metros reais para grama, árvores e construções; os bichos
 * são de livro infantil (Nina tem ~1,4 m do focinho à cauda, os filhotes de
 * 0,45 a 0,75 m) para que a criança os veja no meio da grama alta.
 *
 * Escala → velocidades. Nina (raposa jovem, ~0,67 m de altura, 1,4 m do focinho
 * à cauda) tem andaduras naturais do esqueleto: passo ≈ 1 m/s, trote ≈ 2,8 m/s,
 * galope ≈ 8,7 m/s. O passo normal do jogo é o TROTE (2,8 m/s) e a corrida é um
 * galope contido de 6 m/s — raposas de verdade trotam a 2,5–3 m/s e galopam até
 * 13 m/s, mas no vale a criança precisa enxergar onde pisa.
 *
 * Movimento (terceira pessoa, relativo à câmera, passo fixo de 1/120 s):
 *   alvo = dir_entrada · velAlvo               velAlvo = TROTE·|eixo| ou GALOPE (Shift / stick no fim)
 *   v.xz += (alvo − v.xz) · (1 − exp(−k·dt))   k = ACCEL_K acelerando, DECEL_K freando
 *   no ar: k ·= AIR_CONTROL                    (≈ 40% do controle; o impulso do pulo se mantém)
 *   giro do corpo: yaw ← yaw + Δ·(1 − exp(−TURN_K·dt))
 *
 * Pulo (parábola assimétrica, unidades m e s):
 *   vy₀ = JUMP_VY                               altura = vy₀² / (2·GRAVITY) ≈ 0,9 m
 *   subindo: g = GRAVITY · (botão solto ? JUMP_CUT : 1)   → toque curto ≈ 0,35 m
 *   descendo: g = GRAVITY · FALL_MULT, vy ≥ −TERMINAL_VY
 *   coyote: pode pular até COYOTE s depois de sair do chão
 *   buffer: um toque até JUMP_BUFFER s antes de pousar ainda vale
 *   chão: y = max(y, chão(x, z)); descendo morro ela "cola" no chão se a
 *         diferença for < SNAP_DOWN (sem tremer entre chão e ar)
 *   chão(x, z) = max(terreno(x, z), nível_da_água − FLOAT·altura_do_bicho)   (nada no lago)
 *
 * Andadura (Nina e filhotes): escolhida pela velocidade real v contra as
 * velocidades naturais do bicho (creature.gaits):
 *   v < 0,25 m/s → parado · v < (passo+trote)/2 → passo · v < (trote+galope)/2 → trote · senão galope
 *
 * Filhote seguindo, i-ésimo da fila (trilha de migalhas de Nina):
 *   alvo_i = ponto da trilha a GAP·(i+1) metros atrás de Nina, medido sobre o caminho andado
 *            (sem trilha suficiente: líder.pos − líder.forward·GAP·(i+1))
 *   pos = mix(pos, alvo, 1 − exp(−FOLLOW_LAMBDA * dt)), passo limitado a vmax·dt:
 *   vmax = max(1,2; v_Nina·1,25 + 0,5) + 1,5·max(0, d − 3)   (alcança sem teletransportar)
 *
 * Tartaruga (Tata): em terra anda 0,3–0,5 m/s — jamais acompanharia a fila. Quando vira
 * amiga, ela sobe nas costas de Nina e vai de carona: posição presa a um ponto do dorso
 * por mola amortecida (k = RIDE_K, ζ ≈ 0,7), então balança ao frear e ao pousar.
 *
 * Aproximação: |pos − filhote| < BEFRIEND_R (Espaço) ou < AUTO_R (encostar) e amoras ≥ 1
 * Depósito:    |pos − ninho| < HOME_R com pelo menos um seguidor
 */

export const WORLD_RADIUS = 40;

/** Trote (m/s): o andar normal de Nina — igual ao trote natural do esqueleto, pés não escorregam. */
export const WALK_SPEED = 2.8;
/** Galope contido (m/s) com Shift, botão 🏃 ou stick empurrado até o fim. */
export const RUN_SPEED = 6.0;
/** Nadando (lago/riacho) a velocidade-alvo cai para esta fração. */
export const SWIM_K = 0.5;
/** Constantes de tempo (1/s) da aproximação exponencial à velocidade-alvo. */
export const ACCEL_K = 7.5;
export const DECEL_K = 11;
/** Fração do controle horizontal que sobra no ar. */
export const AIR_CONTROL = 0.4;
/** Giro do corpo em direção ao movimento (1/s). */
export const TURN_K = 11;
export const JUMP_VY = 6.3;
export const GRAVITY = 22;
/** Multiplicador da gravidade na queda (cai mais pesado do que sobe). */
export const FALL_MULT = 1.55;
/** Multiplicador da gravidade subindo com o botão solto (pulo variável). */
export const JUMP_CUT = 2.8;
export const TERMINAL_VY = 14;
export const COYOTE = 0.12;
export const JUMP_BUFFER = 0.13;
/** Desce degraus/morros de até SNAP_DOWN m sem decolar. */
export const SNAP_DOWN = 0.32;
export const HOP_BOOST = 0.6;
/**
 * Rede de segurança: abaixo do chão, NaN, fora do mapa ou empurrando o stick sem sair do
 * lugar por STUCK_S s → Nina volta ao último chão seguro (gravado a cada SAFE_EVERY s).
 */
export const STUCK_S = 8;
export const SAFE_EVERY = 0.6;

export const FOLLOW_GAP = 1.15;
export const FOLLOW_LAMBDA = 7.2;
/** Rigidez (1/s²) da mola que prende Tata ao dorso de Nina; amortecimento crítico × 0,7. */
export const RIDE_K = 170;
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
