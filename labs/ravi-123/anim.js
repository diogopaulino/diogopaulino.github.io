/* ==========================================================================
   Ravi 1·2·3 — helpers de animação (baratos, sem alocação)
   --------------------------------------------------------------------------
   Tudo em funções puras sobre `t` (segundos). O loop de render só chama
   Math.sin/floor — nenhum objeto novo por frame.
   ========================================================================== */

/** Oscilação suave −amp..+amp, arredondada para pixel. */
export function wave(t, speed, amp, phase = 0) {
  return Math.round(Math.sin(t * speed + phase) * amp);
}

/** Salto de dança: sobe e cai (0..amp). */
export function hop(t, speed, amp, phase = 0) {
  return Math.round(Math.abs(Math.sin(t * speed + phase)) * amp);
}

/** Ease bounce de saída (flashcard, balões). */
export function bounceOut(p) {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  const n1 = 7.5625;
  const d1 = 2.75;
  if (p < 1 / d1) return n1 * p * p;
  if (p < 2 / d1) { p -= 1.5 / d1; return n1 * p * p + 0.75; }
  if (p < 2.5 / d1) { p -= 2.25 / d1; return n1 * p * p + 0.9375; }
  p -= 2.625 / d1;
  return n1 * p * p + 0.984375;
}

/** Pop elástico 0→1 com overshoot leve. */
export function popIn(p) {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  return bounceOut(p);
}

/** Parallax / scroll modular positivo. */
export function wrap(v, span) {
  const m = v % span;
  return m < 0 ? m + span : m;
}
