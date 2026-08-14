/** Curvas de interpolação para cutscenes e transições. */

export const easeInOutCubic = (t) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export const easeInOutQuad = (t) =>
    t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

export const easeInCubic = (t) => t * t * t;

export const easeOutQuad = (t) => 1 - (1 - t) * (1 - t);

export const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;

export function getEasing(name) {
    switch (name) {
        case 'inCubic': return easeInCubic;
        case 'outCubic': return easeOutCubic;
        case 'inOutQuad': return easeInOutQuad;
        case 'outQuad': return easeOutQuad;
        case 'inOutSine': return easeInOutSine;
        default: return easeInOutCubic;
    }
}
