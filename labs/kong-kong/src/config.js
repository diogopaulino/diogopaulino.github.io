/**
 * Kong Kong — constantes, paleta e fórmulas de física.
 *
 * Unidades: pixels e segundos. Integração Euler explícita.
 *
 *   vy += GRAVITY * dt
 *   y  += vy * dt
 *
 * Altura máxima do pulo (sem corte):  h = JUMP_VEL² / (2 * GRAVITY)
 * Tempo de subida:                     t = -JUMP_VEL / GRAVITY
 * Pulo variável: se o botão soltar com vy < 0, vy *= JUMP_CUT
 * Coyote: ainda pode pular COYOTE s após deixar o chão
 * Buffer: pulo apertado até JUMP_BUF s antes de aterrissar dispara no pouso
 *
 * Lenço vermelho: 1ª batida solta o lenço (hit extra). Sem lenço, perde 1 vida.
 * 100 bananas = 1 vida extra.
 */

export const VIEW_W = 480;
export const VIEW_H = 270;
export const TILE = 16;

export const PHYS = Object.freeze({
  GRAVITY: 1650,
  MAX_FALL: 520,
  JUMP_VEL: -510,
  JUMP_CUT: 0.42,
  COYOTE: 0.1,
  JUMP_BUF: 0.12,
  ACCEL: 1600,
  AIR_ACCEL: 980,
  FRICTION: 1900,
  MAX_VX: 178,
  ROLL_SPEED: 248,
  ROLL_TIME: 0.46,
  CLIMB_SPEED: 96,
  SWIM_GRAVITY: 420,
  SWIM_JUMP: -220,
  SWIM_MAX: 140,
  KNOCKBACK_X: 160,
  KNOCKBACK_Y: -220,
  BLAST_SPEED: 256,
  BLAST_FLOAT: 0.5,
  BLAST_GRAV: 0.03,
  BOUNCE_VEL: -460,
  STOMP_VEL: -280,
  HITBOX_W: 12,
  HITBOX_H: 18
});

export const START_LIVES = 4;
export const BANANAS_PER_LIFE = 100;
export const SAVE_KEY = 'kong-kong-save';

export const PAL = Object.freeze({
  fur: '#8a4a1e',
  furL: '#d4894a',
  furD: '#4e2610',
  skin: '#f3c894',
  skinD: '#d49a62',
  scarf: '#e31b23',
  scarfD: '#8e1018',
  scarfL: '#ff6b6b',
  eye: '#1c120c',
  white: '#fff6ea',
  banana: '#f6d03a',
  bananaD: '#d49b12'
});

export const THEMES = Object.freeze({
  jungle: {
    sky: ['#6ec7ff', '#c8f0a8', '#7bc45a'],
    far: '#2e7a48',
    mid: '#1f5c34',
    dirt: '#6b3a1c',
    dirtD: '#3e2110',
    grass: '#3d9a3a',
    grassL: '#7ad24a',
    water: '#2a8fd4',
    fog: 'rgba(180, 230, 140, 0.18)'
  },
  canopy: {
    sky: ['#5ab8f0', '#9be7ff', '#4aaa6a'],
    far: '#246044',
    mid: '#174a32',
    dirt: '#7a4a24',
    dirtD: '#4a2a12',
    grass: '#2f8a40',
    grassL: '#6ecf4a',
    water: '#1f7ec8',
    fog: 'rgba(120, 220, 180, 0.16)'
  },
  ruins: {
    sky: ['#f0a060', '#ffd08a', '#c07040'],
    far: '#8a4a2a',
    mid: '#6a3218',
    dirt: '#8a5a3a',
    dirtD: '#4a2c18',
    grass: '#c07a3a',
    grassL: '#e0a05a',
    water: '#3a88aa',
    fog: 'rgba(255, 180, 80, 0.14)'
  },
  mine: {
    sky: ['#1a1430', '#2a2450', '#12101c'],
    far: '#1c1830',
    mid: '#141022',
    dirt: '#3a3248',
    dirtD: '#1c1828',
    grass: '#6a5a40',
    grassL: '#8a7a50',
    water: '#2a4060',
    fog: 'rgba(80, 60, 140, 0.2)'
  },
  falls: {
    sky: ['#4aa8d8', '#b8f0ff', '#3a9a88'],
    far: '#2a6a70',
    mid: '#1a4a52',
    dirt: '#4a5a50',
    dirtD: '#2a322c',
    grass: '#3a8a70',
    grassL: '#6ad0a0',
    water: '#1e90d8',
    fog: 'rgba(140, 220, 255, 0.22)'
  },
  throne: {
    sky: ['#4a1020', '#8a2030', '#2a0810'],
    far: '#5a1828',
    mid: '#3a1018',
    dirt: '#5a2a28',
    dirtD: '#2a1210',
    grass: '#8a3a28',
    grassL: '#c06040',
    water: '#c04020',
    fog: 'rgba(220, 40, 40, 0.12)'
  }
});

export function hash2(x, y) {
  let n = (x * 374761393 + y * 668265263) | 0;
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

export function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
