// ==========================================================================
// Rock Kombat — Combat Module
// Hit resolution, projectiles, particle effects, damage numbers
// ==========================================================================

import {
  PARRY_COOLDOWN, METER_GAIN, W,
  LEFT_WALL, RIGHT_WALL, GROUND,
  BODY_WIDTH, PUSH_DISTANCE
} from './constants.js';
import { clamp, lerp, random } from './utils.js';
import audio from './audio.js';

/** AABB overlap test — returns true if rectangles a and b intersect */
export function overlap(a, b) {
  return a && b
    && a.left < b.right && a.right > b.left
    && a.top < b.bottom && a.bottom > b.top;
}

/**
 * Spawn impact particles and an expanding ring at (x, y).
 * @param {boolean} heavy - More particles and larger ring for heavy hits
 */
export function addImpact(match, x, y, color, heavy = false) {
  const count = heavy ? 22 : 12;
  for (let i = 0; i < count; i++) {
    const angle = random(0, Math.PI * 2);
    const speed = random(2, heavy ? 11 : 7);
    match.effects.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: random(12, heavy ? 28 : 20),
      size: random(2, heavy ? 7 : 5),
      color
    });
  }
  match.rings.push({
    x, y,
    life: heavy ? 16 : 11,
    max: heavy ? 16 : 11,
    color
  });
}

/**
 * Add a floating damage number at impact point.
 * @param {string} type - 'hit' | 'block' | 'parry'
 */
export function addDamageNumber(match, x, y, text, type, color) {
  match.damageNumbers.push({
    x, y,
    vy: -2,
    text: String(text),
    color,
    life: 45,
    maxLife: 45
  });
}

/**
 * Core hit resolution. Determines block/parry/hit outcome and applies
 * damage, hitstun, meter gain, screen effects, and emits combo events.
 */
export function applyHit(match, attacker, defender, move, projectile = null) {
  const blocked = defender.blocking(attacker, move);
  const parry = blocked && defender.parrying(attacker);
  const impactX = lerp(attacker.x, defender.x, 0.7);
  const impactY = defender.y - (move.level === 'low' ? 65 : 190);

  if (parry) {
    // --- PARRY: defender punishes attacker ---
    defender.gainMeter(24);
    attacker.state = 'hitstun';
    attacker.hitstun = 13;
    attacker.vx = -attacker.facing * 3;
    defender.parryCooldown = PARRY_COOLDOWN;

    match.hitStop = 9;
    match.shake = 3;
    addImpact(match, impactX, impactY, '#b9f2ff', true);
    addDamageNumber(match, impactX, impactY - 40, 'PARRY', 'parry', '#b9f2ff');
    audio.sfx('parry');

  } else if (blocked) {
    // --- BLOCK: reduced chip damage, pushback ---
    const chip = Math.max(1, Math.floor(move.damage * 0.12));
    defender.health = clamp(defender.health - chip, 0, 100);
    defender.state = 'blockstun';
    defender.blockstun = move.blockstun;
    defender.x += attacker.facing * move.push * 0.45;

    attacker.gainMeter(move.meter * METER_GAIN.block);
    defender.gainMeter(Math.max(2, move.damage * METER_GAIN.guard));

    match.hitStop = Math.max(3, move.hitstop - 2);
    match.shake = 2;
    addImpact(match, impactX, impactY, '#a8c9ce');
    addDamageNumber(match, impactX, impactY - 40, chip, 'block', '#a8c9ce');
    audio.sfx('block');

  } else {
    // --- HIT: full damage, hitstun, potential combo ---
    defender.health = clamp(defender.health - move.damage, 0, 100);
    defender.state = move.knockdown ? 'knockdown' : 'hitstun';
    defender.hitstun = move.hitstun;
    defender.knockdown = move.knockdown || 0;
    defender.vx = attacker.facing * move.push * 0.2;
    if (move.launch) defender.vy = -move.launch;

    attacker.gainMeter(move.meter * METER_GAIN.hit);
    defender.gainMeter(Math.max(4, move.damage * METER_GAIN.damage));
    attacker.moveConnected = true;

    // Combo tracking
    attacker.combo = attacker.comboClock > 0 ? attacker.combo + 1 : 1;
    attacker.comboClock = 55;

    match.hitStop = move.hitstop;
    match.shake = move.damage >= 10 ? 7 : 4;
    addImpact(match, impactX, impactY, attacker.data.color, move.damage >= 10);
    addDamageNumber(match, impactX, impactY - 40, move.damage, 'hit', attacker.data.color);
    audio.sfx(move.damage >= 10 ? 'heavy' : 'light', move.damage / 10);

    // Emit combo event for UI
    if (attacker.combo >= 2) {
      match.events.push({ type: 'combo', fighter: attacker });
    }
  }

  // Mark projectile as dead, or flag melee move as having hit
  if (projectile) projectile.dead = true;
  else attacker.moveHit = true;
}

/** Spawn a projectile from a fighter's special move */
export function spawnProjectile(match, owner, move) {
  const superScale = move.superMove ? 1.8 : 1;
  match.projectiles.push({
    owner, move,
    x: owner.x + owner.facing * 75,
    y: owner.y - 155,
    vx: owner.facing * (move.superMove ? 13 : owner.data.id === 'lennon' ? 9.5 : 10.5),
    radius: 30 * superScale,
    life: move.superMove ? 95 : 75,
    color: owner.data.color,
    dead: false
  });
  match.rings.push({
    x: owner.x + owner.facing * 50,
    y: owner.y - 160,
    life: 22, max: 22,
    color: owner.data.color
  });
}

/** Update all active projectiles — movement, collision, cleanup */
export function updateProjectiles(match) {
  for (let i = match.projectiles.length - 1; i >= 0; i--) {
    const p = match.projectiles[i];
    p.x += p.vx;
    p.life--;

    const defender = p.owner === match.p1 ? match.p2 : match.p1;

    const box = {
      left: p.x - p.radius, right: p.x + p.radius,
      top: p.y - p.radius, bottom: p.y + p.radius
    };

    if (!p.dead && defender.invuln <= 0 && overlap(box, defender.hurtBox())) {
      applyHit(match, p.owner, defender, p.move, p);
    }

    if (p.life <= 0 || p.x < 0 || p.x > W) p.dead = true;
    if (p.dead) match.projectiles.splice(i, 1);
  }
}

/** Check if attacker's active hitbox overlaps defender's hurtbox */
export function resolveCombat(match, attacker, defender) {
  if (defender.invuln > 0) return;
  if (overlap(attacker.activeBox(), defender.hurtBox())) {
    applyHit(match, attacker, defender, attacker.move);
  }
}

/** Push fighters apart when overlapping on the ground */
export function bodyPush(match) {
  const a = match.p1, b = match.p2;
  if (!a.grounded() || !b.grounded()) return;
  const gap = b.x - a.x;
  if (Math.abs(gap) < PUSH_DISTANCE) {
    const push = (PUSH_DISTANCE - Math.abs(gap)) / 2;
    const sign = gap >= 0 ? 1 : -1;
    a.x -= push * sign;
    b.x += push * sign;
    a.x = clamp(a.x, LEFT_WALL, RIGHT_WALL);
    b.x = clamp(b.x, LEFT_WALL, RIGHT_WALL);
  }
}

/** Update all visual effects: particles, rings, damage numbers, screen shake */
export function updateEffects(match) {
  // Impact particles
  for (let i = match.effects.length - 1; i >= 0; i--) {
    const fx = match.effects[i];
    fx.x += fx.vx;
    fx.y += fx.vy;
    fx.vx *= 0.94;
    fx.vy *= 0.94;
    if (--fx.life <= 0) match.effects.splice(i, 1);
  }

  // Expanding rings
  for (let i = match.rings.length - 1; i >= 0; i--) {
    if (--match.rings[i].life <= 0) match.rings.splice(i, 1);
  }

  // Floating damage numbers
  if (match.damageNumbers) {
    for (let i = match.damageNumbers.length - 1; i >= 0; i--) {
      const dn = match.damageNumbers[i];
      dn.y += dn.vy;
      if (--dn.life <= 0) match.damageNumbers.splice(i, 1);
    }
  }

  // Screen shake decay
  match.shake *= 0.78;
  if (match.shake < 0.15) match.shake = 0;
}
