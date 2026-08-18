/**
 * Utilidades numéricas compartilhadas pelos módulos do F1 Grand Prix.
 *
 * Existe porque `main.js` já importava daqui — sem este arquivo o import
 * devolvia 404 e o módulo inteiro do jogo nunca chegava a executar.
 */

/** Prende `v` no intervalo [lo, hi]. */
export function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
}

/** Interpolação linear de `a` até `b`. `t` fora de [0,1] extrapola. */
export function lerp(a, b, t) {
    return a + (b - a) * t;
}

/**
 * Interpolação exponencial independente de framerate.
 *
 * `lerp(a, b, dt * k)` acelera junto com o refresh rate: a 120Hz o valor
 * converge duas vezes mais rápido que a 60Hz. Esta versão converge no mesmo
 * tempo real em qualquer taxa — é a que a câmera e a telemetria devem usar.
 */
export function damp(a, b, lambda, dt) {
    return lerp(a, b, 1 - Math.exp(-lambda * dt));
}

/** -1, 0 ou 1, preservando o zero com sinal como 0. */
export function sign(v) {
    return v > 0 ? 1 : v < 0 ? -1 : 0;
}

/** Remapeia `v` da faixa [inMin, inMax] para [outMin, outMax], travando nas pontas. */
export function mapRange(v, inMin, inMax, outMin, outMax) {
    if (inMax === inMin) return outMin;
    return clamp(outMin + ((v - inMin) / (inMax - inMin)) * (outMax - outMin),
        Math.min(outMin, outMax), Math.max(outMin, outMax));
}
