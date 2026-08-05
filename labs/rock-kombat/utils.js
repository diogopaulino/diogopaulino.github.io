export const $ = selector => document.querySelector(selector);
export const $$ = selector => [...document.querySelectorAll(selector)];
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const lerp = (a, b, t) => a + (b - a) * t;
export const random = (min, max) => min + Math.random() * (max - min);
