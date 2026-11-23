/**
 * Folhas do pé de feijão como plataformas fiéis à malha.
 *
 * O kit (gfx/terrain.js → createBeanstalk) devolve cada folha como { position, radius }:
 *   position = ponta do pecíolo + ô·0,45·L (plano XZ), y = y_ponta − 0,02·L
 *   radius   = 0,42·W, com W = 0,85·L (L = comprimento da lâmina)
 *   ô        = direção radial da folha (do eixo do caule para fora)
 * Daí: L = radius / 0,357 e ô = normalize(position − eixo(t)), t = (y − 0,255·L) / altura.
 *
 * A lâmina é uma grade dobrada em V na nervura e caída na ponta. Em coordenadas da folha
 * (u ∈ [0,1] ao longo da nervura, s = desvio lateral em metros):
 *   y(u, s) = y_ponta + 0,32·|s| − 0,32·L·u² + 0,08·L·u
 * Pegada pisável: elipse centrada em u = 0,45 com semi-eixos 0,47·L (ao longo) e 0,4·W
 * (através). Fora dela a função devolve NaN e o João cai — a sombra/marcador mostra onde.
 */

/** Converte a folha do kit em plataforma. `axisLocal(t, out)` = eixo do caule no espaço do kit. */
export function makeLeaf(l, { ox = 0, oy = 0, oz = 0, height, axisLocal, tmp }) {
    const L = l.radius / 0.357;
    const W = L * 0.85;
    axisLocal((l.position.y - 0.255 * L) / height, tmp);
    let dx = l.position.x - tmp.x;
    let dz = l.position.z - tmp.z;
    const d = Math.hypot(dx, dz) || 1;
    dx /= d;
    dz /= d;
    const ex = l.position.x - dx * L * 0.45 + ox;
    const ez = l.position.z - dz * L * 0.45 + oz;
    const ey = l.position.y + 0.02 * L + oy;
    const leaf = {
        ex, ey, ez, ox: dx, oz: dz, L, W,
        x: l.position.x + ox, z: l.position.z + oz, y: 0,
        /** raio de busca (m): toda a pegada cabe nele a partir do centro */
        r: L * 0.52,
        /** azimute da folha em volta do eixo do caule (rad, mesmo sentido de atan2(x, z)) */
        ang: Math.atan2(dx, dz)
    };
    leaf.y = leafSurface(leaf, leaf.x, leaf.z);
    return leaf;
}

/**
 * Altura da lâmina em (x, z) ou NaN fora da pegada.
 * `grow` (m) alarga a pegada (a câmera usa folga; o pé do João, não).
 */
export function leafSurface(f, x, z, grow = 0) {
    const dx = x - f.ex;
    const dz = z - f.ez;
    const a = dx * f.ox + dz * f.oz;
    const s = dz * f.ox - dx * f.oz;
    const ea = (a - 0.45 * f.L) / (0.47 * f.L + grow);
    const es = s / (0.4 * f.W + grow);
    if (ea * ea + es * es > 1) return NaN;
    const u = a / f.L;
    return f.ey + 0.32 * Math.abs(s) - 0.32 * f.L * u * u + 0.08 * f.L * u;
}

/** Diferença angular em (−π, π]. */
export function angDiff(a, b) {
    return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}
