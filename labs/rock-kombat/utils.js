export const $ = selector => document.querySelector(selector);
export const $$ = selector => [...document.querySelectorAll(selector)];
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const lerp = (a, b, t) => a + (b - a) * t;
export const random = (min, max) => min + Math.random() * (max - min);

export function approach(value, target, maxDelta) {
  if (value < target) return Math.min(target, value + maxDelta);
  return Math.max(target, value - maxDelta);
}

export function overlap(a, b) {
  return a && b
    && a.left < b.right && a.right > b.left
    && a.top < b.bottom && a.bottom > b.top;
}
