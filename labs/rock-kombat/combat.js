// ==========================================================================
// Rock Kombat — Combat
// Hits, blocks, parries, throws, projectile clash, KO freeze
// ==========================================================================

import {
  PARRY_COOLDOWN, METER_GAIN, W,
  LEFT_WALL, RIGHT_WALL, GROUND,
  PUSH_DISTANCE, COMBO_DECAY, MIN_SCALE
} from './constants.js';
import { clamp, lerp, random, overlap } from './utils.js';
import audio from './audio.js';

export { overlap };

export function addImpact(match, x, y, color, heavy = false) {
  const count = heavy ? 26 : 14;
  for (let i = 0; i < count; i++) {
    const angle = random(0, Math.PI * 2);
    const speed = random(2.2, heavy ? 13 : 8);
    match.effects.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - random(0, 2),
      life: random(12, heavy ? 30 : 20),
      size: random(2, heavy ? 8 : 5),
      color,
      spark: i % 3 === 0
    });
  }
  match.rings.push({
    x, y,
    life: heavy ? 18 : 12,
    max: heavy ? 18 : 12,
    color
  });
}

export function addDust(match, x, y) {
  for (let i = 0; i < 8; i++) {
    match.effects.push({
      x: x + random(-18, 18),
      y: y - random(0, 8),
      vx: random(-2.4, 2.4),
      vy: random(-2.2, -0.4),
      life: random(10, 18),
      size: random(3, 7),
      color: '#c4b8a4',
      spark: false
    });
  }
}

export function addDamageNumber(match, x, y, text, color) {
  match.damageNumbers.push({
    x, y,
    vy: -2.4,
    text: String(text),
    color,
    life: 48,
    maxLife: 48
  });
}

function scaledDamage(attacker, move) {
  const power = 0.82 + attacker.data.power / 430;
  const comboIndex = Math.max(0, attacker.combo);
  const scale = comboIndex <= 1 ? 1 : Math.max(MIN_SCALE, 1 - (comboIndex - 1) * COMBO_DECAY);
  return Math.max(1, Math.round(move.damage * power * scale));
}

function incomingFactor(defender) {
  return clamp(1 - (defender.data.defense - 72) * 0.0045, 0.82, 1.12);
}

function cornerPush(match, attacker, defender, amount) {
  const next = defender.x + amount;
  if (next <= LEFT_WALL || next >= RIGHT_WALL) {
    attacker.x -= amount * 0.85;
    defender.x = clamp(next, LEFT_WALL, RIGHT_WALL);
    attacker.x = clamp(attacker.x, LEFT_WALL, RIGHT_WALL);
  } else {
    defender.x = next;
  }
}

export function applyHit(match, attacker, defender, move, projectile = null) {
  const blocked = !move.unblockable && defender.blocking(attacker, move);
  const parry = blocked && defender.parrying(attacker);
  const impactX = lerp(attacker.x, defender.x, 0.68);
  const impactY = defender.y - (move.level === 'low' ? 62 : 188);
  const counter = !blocked && defender.state === 'attack';

  if (parry) {
    defender.gainMeter(24);
    attacker.state = 'hitstun';
    attacker.hitstun = 14;
    attacker.vx = -attacker.facing * 3.4;
    attacker.move = null;
    defender.parryCooldown = PARRY_COOLDOWN;
    match.hitStop = 10;
    match.shake = 4;
    addImpact(match, impactX, impactY, '#b9f2ff', true);
    addDamageNumber(match, impactX, impactY - 40, 'PARRY', '#b9f2ff');
    audio.sfx('parry');
  } else if (blocked) {
    const chip = Math.max(1, Math.floor(move.damage * (move.name === 'special' || move.superMove ? 0.18 : 0.1) * incomingFactor(defender)));
    defender.health = clamp(defender.health - chip, 0, 100);
    defender.state = 'blockstun';
    defender.blockstun = move.blockstun + (move.superMove ? 4 : 0);
    defender.vx = attacker.facing * move.push * 0.12;
    cornerPush(match, attacker, defender, attacker.facing * move.push * 0.42);
    attacker.gainMeter(move.meter * METER_GAIN.block);
    defender.gainMeter(Math.max(2, move.damage * METER_GAIN.guard));
    match.hitStop = Math.max(3, move.hitstop - 2);
    match.shake = 2;
    addImpact(match, impactX, impactY, '#a8c9ce');
    addDamageNumber(match, impactX, impactY - 40, chip, '#a8c9ce');
    audio.sfx('block');
  } else {
    let damage = Math.max(1, Math.round(scaledDamage(attacker, move) * incomingFactor(defender)));
    if (counter) damage = Math.round(damage * 1.15);
    if (move.superMove) damage = Math.round(damage * 1.08);

    defender.health = clamp(defender.health - damage, 0, 100);
    defender.launched = Boolean(move.launch);
    defender.state = move.knockdown && !move.launch ? 'knockdown' : 'hitstun';
    defender.hitstun = move.hitstun + (counter ? 6 : 0);
    defender.knockdown = move.knockdown || 0;
    defender.move = null;
    defender.moveFrame = 0;
    defender.dashTimer = 0;
    defender.vx = attacker.facing * move.push * 0.22;
    if (move.launch) defender.vy = -move.launch;

    if (move.level === 'throw') {
      defender.x = clamp(attacker.x + attacker.facing * 88, LEFT_WALL, RIGHT_WALL);
      defender.vx = attacker.facing * 6;
      defender.state = 'knockdown';
      defender.knockdown = move.knockdown;
      defender.y = GROUND;
      defender.vy = 0;
      audio.sfx('throw');
    }

    attacker.gainMeter(move.meter * METER_GAIN.hit);
    defender.gainMeter(Math.max(4, damage * METER_GAIN.damage));
    attacker.moveConnected = true;
    attacker.combo = attacker.comboClock > 0 ? attacker.combo + 1 : 1;
    attacker.comboClock = 58;
    attacker.comboDamage += damage;

    match.hitStop = move.hitstop + (counter ? 2 : 0);
    match.shake = damage >= 12 || move.superMove ? 9 : damage >= 8 ? 5 : 3;
    addImpact(match, impactX, impactY, attacker.data.color, damage >= 10 || counter);
    addDamageNumber(match, impactX, impactY - 42, counter ? `${damage}!` : damage, attacker.data.color);
    audio.sfx(damage >= 10 || move.superMove ? 'heavy' : 'light', damage / 10);

    if (attacker.combo >= 2) {
      match.events.push({ type: 'combo', fighter: attacker });
    }

    if (defender.health <= 0) {
      defender.state = 'knockdown';
      defender.knockdown = 90;
      defender.vy = move.launch ? defender.vy : -7;
      defender.launched = true;
      match.koZoom = 28;
      match.shake = 14;
    }
  }

  if (projectile) projectile.dead = true;
  else attacker.moveHit = true;
}

export function spawnProjectile(match, owner, move) {
  const superScale = move.superMove ? 1.85 : 1;
  const speed = (move.projectileSpeed || 10.5) * (move.superMove ? 1.22 : 1);
  match.projectiles.push({
    owner, move,
    x: owner.x + owner.facing * 78,
    y: owner.y - 155,
    vx: owner.facing * speed,
    radius: (move.projectileRadius || 30) * superScale,
    life: move.superMove ? 100 : 78,
    color: owner.data.color,
    dead: false,
    superMove: move.superMove
  });
  match.rings.push({
    x: owner.x + owner.facing * 54,
    y: owner.y - 160,
    life: 22, max: 22,
    color: owner.data.color
  });
}

export function updateProjectiles(match) {
  for (let i = match.projectiles.length - 1; i >= 0; i--) {
    const p = match.projectiles[i];
    p.x += p.vx;
    p.life--;

    const box = {
      left: p.x - p.radius, right: p.x + p.radius,
      top: p.y - p.radius, bottom: p.y + p.radius
    };

    for (let j = match.projectiles.length - 1; j > i; j--) {
      const other = match.projectiles[j];
      if (other.owner === p.owner) continue;
      const dx = p.x - other.x;
      const dy = p.y - other.y;
      if (dx * dx + dy * dy < (p.radius + other.radius) ** 2) {
        if (p.superMove && !other.superMove) {
          other.dead = true;
        } else if (other.superMove && !p.superMove) {
          p.dead = true;
        } else {
          p.dead = true;
          other.dead = true;
        }
        addImpact(match, (p.x + other.x) / 2, (p.y + other.y) / 2, '#fff4d0', true);
        audio.sfx('block');
      }
    }

    const defender = p.owner === match.p1 ? match.p2 : match.p1;
    if (!p.dead && defender.invuln <= 0 && overlap(box, defender.hurtBox())) {
      applyHit(match, p.owner, defender, p.move, p);
    }

    if (p.life <= 0 || p.x < -40 || p.x > W + 40) p.dead = true;
    if (p.dead) match.projectiles.splice(i, 1);
  }
}

export function resolveCombat(match, attacker, defender) {
  if (defender.invuln > 0) return;
  if (overlap(attacker.activeBox(), defender.hurtBox())) {
    applyHit(match, attacker, defender, attacker.move);
  }
}

export function bodyPush(match) {
  const a = match.p1, b = match.p2;
  const gap = b.x - a.x;
  if (Math.abs(gap) >= PUSH_DISTANCE) return;
  const push = (PUSH_DISTANCE - Math.abs(gap)) / 2;
  const sign = gap >= 0 ? 1 : -1;
  const airScale = (a.grounded() && b.grounded()) ? 1 : 0.45;
  a.x -= push * sign * airScale;
  b.x += push * sign * airScale;
  a.x = clamp(a.x, LEFT_WALL, RIGHT_WALL);
  b.x = clamp(b.x, LEFT_WALL, RIGHT_WALL);
}

export function updateEffects(match) {
  for (let i = match.effects.length - 1; i >= 0; i--) {
    const fx = match.effects[i];
    fx.x += fx.vx;
    fx.y += fx.vy;
    fx.vx *= 0.93;
    fx.vy *= 0.93;
    fx.vy += 0.08;
    if (--fx.life <= 0) match.effects.splice(i, 1);
  }

  for (let i = match.rings.length - 1; i >= 0; i--) {
    if (--match.rings[i].life <= 0) match.rings.splice(i, 1);
  }

  if (match.damageNumbers) {
    for (let i = match.damageNumbers.length - 1; i >= 0; i--) {
      const dn = match.damageNumbers[i];
      dn.y += dn.vy;
      dn.vy *= 0.96;
      if (--dn.life <= 0) match.damageNumbers.splice(i, 1);
    }
  }

  if (match.superFlash > 0) match.superFlash--;
  if (match.koZoom > 0) match.koZoom--;

  match.shake *= 0.78;
  if (match.shake < 0.15) match.shake = 0;
}
