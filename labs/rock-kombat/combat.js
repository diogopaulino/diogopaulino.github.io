// ==========================================================================
// Rock Kombat — Combat Resolution
// MvC & MK hybrid combat engine:
// - Directional hit slashes, shockwave rings, rock notes & MK finish sparks
// - Air Rave juggling, Wall Bounce triggers, OTG (Off-The-Ground) pickup
// - Advancing Guard (Pushblock) & Parry counter-flash
// - First Hit, Counter Hit, Punish & MvC Combo Tier Callouts
// ==========================================================================

import {
  PARRY_COOLDOWN, METER_GAIN, WORLD_W,
  LEFT_WALL, RIGHT_WALL, GROUND,
  PUSH_DISTANCE, COMBO_DECAY, MIN_SCALE, COMBO_TIERS
} from './constants.js';
import { clamp, lerp, random, overlap } from './utils.js';
import audio from './audio.js';

export { overlap };

const MAX_EFFECTS = 140;

export function addImpact(match, x, y, color, heavy = false, angleBias = 0) {
  const count = heavy ? 28 : 14;
  for (let i = 0; i < count; i++) {
    if (match.effects.length >= MAX_EFFECTS) match.effects.shift();
    const spread = heavy ? Math.PI * 2 : Math.PI * 1.3;
    const angle = angleBias ? angleBias + random(-spread * 0.5, spread * 0.5) : random(0, Math.PI * 2);
    const speed = random(2.8, heavy ? 15.5 : 9.5);
    match.effects.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - random(0, 2.2),
      life: random(12, heavy ? 30 : 20),
      maxLife: heavy ? 30 : 20,
      size: random(2.5, heavy ? 8.5 : 5.5),
      color: i % 4 === 0 ? '#ffffff' : color,
      spark: i % 2 === 0,
      slash: heavy && i < 4
    });
  }
  match.rings.push({
    x, y,
    life: heavy ? 18 : 12,
    max: heavy ? 18 : 12,
    color,
    heavy
  });
}

export function addDust(match, x, y) {
  for (let i = 0; i < 8; i++) {
    if (match.effects.length >= MAX_EFFECTS) match.effects.shift();
    match.effects.push({
      x: x + random(-22, 22),
      y: y - random(0, 8),
      vx: random(-3, 3),
      vy: random(-2.4, -0.4),
      life: random(11, 19),
      maxLife: 19,
      size: random(3.5, 7.5),
      color: '#cfc4b2',
      spark: false
    });
  }
}

export function addDamageNumber(match, x, y, text, color, scale = 1) {
  match.damageNumbers.push({
    x, y,
    vy: -2.6,
    text: String(text),
    color,
    scale,
    life: 44,
    maxLife: 44
  });
}

export function triggerPushblock(match, defender, attacker) {
  const dir = defender.directionTo(attacker);
  const pushDist = 135;
  cornerPush(match, defender, attacker, dir * pushDist);
  attacker.vx = dir * 11;
  defender.blockstun = Math.min(defender.blockstun, 4);
  match.hitStop = 6;
  match.shake = 5;
  const shieldX = defender.x + dir * 52;
  const shieldY = defender.y - 175;
  addImpact(match, shieldX, shieldY, '#52b7ff', true);
  addDamageNumber(match, shieldX, shieldY - 45, 'ADVANCING GUARD!', '#52b7ff', 1.15);
  match.events.push({
    type: 'callout',
    fighter: defender,
    text: 'PUSHBLOCK!',
    color: '#52b7ff'
  });
  audio.sfx('pushblock');
}

function scaledDamage(attacker, move) {
  const power = 0.84 + attacker.data.power / 420;
  const comboIndex = Math.max(0, attacker.combo);
  const minScale = move.superMove ? 0.52 : MIN_SCALE;
  const scale = comboIndex <= 1 ? 1 : Math.max(minScale, 1 - (comboIndex - 1) * COMBO_DECAY);
  return Math.max(1, Math.round(move.damage * power * scale));
}

function incomingFactor(defender) {
  return clamp(1 - (defender.data.defense - 75) * 0.0042, 0.82, 1.14);
}

function cornerPush(match, attacker, defender, amount) {
  const next = defender.x + amount;
  if (next <= LEFT_WALL || next >= RIGHT_WALL) {
    attacker.x -= amount * 0.88;
    defender.x = clamp(next, LEFT_WALL, RIGHT_WALL);
    attacker.x = clamp(attacker.x, LEFT_WALL, RIGHT_WALL);
  } else {
    defender.x = next;
  }
}

export function applyHit(match, attacker, defender, move, projectile = null) {
  // OTG limitation: only allow 1 OTG hit per knockdown
  if (defender.state === 'knockdown') {
    if (!move.otg && !move.superMove && move.name !== 'launcher') return;
    if (defender.otgUsed && !move.superMove) return;
    defender.otgUsed = true;
    match.events.push({
      type: 'callout',
      fighter: attacker,
      text: 'OTG PICKUP!',
      color: '#e5b95c'
    });
  }

  const blocked = !move.unblockable && defender.blocking(attacker, move);
  const parry = blocked && defender.parrying(attacker);
  const impactX = projectile ? projectile.x : lerp(attacker.x, defender.x, 0.66);
  const impactY = projectile ? projectile.y : defender.y - (move.level === 'low' ? 66 : 185);
  const counter = !blocked && defender.state === 'attack' && defender.moveFrame <= (defender.move?.startup || 0);
  const punish = !blocked && !counter && defender.state === 'attack' && defender.moveFrame > (defender.move?.startup || 0);

  if (parry) {
    defender.gainMeter(55);
    attacker.state = 'hitstun';
    attacker.hitstun = 16;
    attacker.vx = -attacker.facing * 3.8;
    attacker.move = null;
    defender.parryCooldown = PARRY_COOLDOWN;
    match.hitStop = 12;
    match.shake = 6;
    addImpact(match, impactX, impactY, '#6dffdb', true);
    addDamageNumber(match, impactX, impactY - 42, 'PARRY!', '#6dffdb', 1.25);
    match.events.push({
      type: 'callout',
      fighter: defender,
      text: 'ROYAL PARRY!',
      color: '#6dffdb'
    });
    audio.sfx('parry');
  } else if (blocked) {
    const chipRatio = move.superMove ? 0.18 : move.exMove ? 0.14 : 0.08;
    const chip = Math.max(1, Math.floor(move.damage * chipRatio * incomingFactor(defender)));
    // Chip damage cannot kill unless it's a Hyper or EX Special
    const minHealth = (move.superMove || move.exMove) ? 0 : 1;
    defender.health = clamp(defender.health - chip, minHealth, 100);
    defender.state = 'blockstun';
    defender.blockstun = move.blockstun + (move.superMove ? 3 : 0);
    defender.vx = attacker.facing * move.push * 0.14;
    if (!projectile && !move.beam) {
      cornerPush(match, attacker, defender, attacker.facing * move.push * 0.45);
    }
    attacker.gainMeter(move.meter * METER_GAIN.block);
    defender.gainMeter(Math.max(4, move.damage * METER_GAIN.guard));
    match.hitStop = Math.max(3, move.hitstop - 2);
    match.shake = 2.5;
    addImpact(match, impactX, impactY, '#99c7d6', false);
    addDamageNumber(match, impactX, impactY - 38, chip, '#99c7d6', 0.9);
    audio.sfx('block');

    if (defender.health <= 0) {
      triggerKoState(match, attacker, defender, move);
    }
  } else {
    let damage = Math.max(1, Math.round(scaledDamage(attacker, move) * incomingFactor(defender)));
    if (counter) damage = Math.round(damage * 1.18);
    else if (punish) damage = Math.round(damage * 1.10);

    // First Hit of the round bonus meter + callout
    if (!match.firstHitDone) {
      match.firstHitDone = true;
      attacker.gainMeter(35);
      match.events.push({
        type: 'callout',
        fighter: attacker,
        text: 'FIRST HIT!',
        color: '#ffcf6e'
      });
    } else if (counter) {
      match.events.push({
        type: 'callout',
        fighter: attacker,
        text: 'COUNTER HIT!',
        color: '#ff5e4d'
      });
    } else if (punish) {
      match.events.push({
        type: 'callout',
        fighter: attacker,
        text: 'PUNISH!',
        color: '#ffad42'
      });
    }

    const wasDizzy = defender.state === 'dizzy';
    defender.health = clamp(defender.health - damage, 0, 100);
    const airborne = !defender.grounded() || defender.launched;

    defender.move = null;
    defender.moveFrame = 0;
    defender.dashTimer = 0;
    defender.scaleX = 0.86;
    defender.scaleY = 1.15;

    if (move.launch) {
      defender.launched = true;
      defender.state = 'hitstun';
      defender.hitstun = move.hitstun;
      defender.y = Math.min(defender.y, GROUND - 1);
      defender.vy = -move.launch;
      defender.vx = attacker.facing * 2.4;
      audio.sfx('launch');
    } else if (move.airSlam && airborne) {
      defender.launched = true;
      defender.state = 'hitstun';
      defender.hitstun = move.hitstun;
      defender.vy = move.airSlam;
      defender.vx = attacker.facing * 7.5;
      match.shake = 11;
      match.events.push({
        type: 'callout',
        fighter: attacker,
        text: 'AERIAL SLAM!',
        color: attacker.data.color
      });
    } else if (airborne) {
      // MvC Air Rave juggle boost! Keeps opponent airborne next to attacker
      defender.launched = true;
      defender.state = 'hitstun';
      defender.hitstun = Math.max(22, move.hitstun);
      defender.vy = -(move.airJuggle || 6.6);
      defender.vx = attacker.facing * (move.wallBounce ? 14.5 : 2.8);
    } else {
      defender.launched = false;
      defender.state = move.knockdown ? 'knockdown' : 'hitstun';
      defender.hitstun = move.hitstun + (counter ? 6 : 0);
      defender.knockdown = move.knockdown || 0;
      defender.vx = attacker.facing * (move.wallBounce && !defender.wallBounced ? 16.5 : move.push * 0.25);
      if (!projectile && !move.beam && !move.wallBounce) {
        cornerPush(match, attacker, defender, attacker.facing * move.push * 0.35);
      }
    }

    if (move.level === 'throw') {
      defender.x = clamp(attacker.x + attacker.facing * 92, LEFT_WALL, RIGHT_WALL);
      defender.vx = attacker.facing * 15.5;
      defender.vy = -7.5;
      defender.launched = true;
      defender.state = 'hitstun';
      defender.hitstun = 28;
      audio.sfx('throw');
    }

    attacker.gainMeter(move.meter * METER_GAIN.hit);
    defender.gainMeter(Math.max(5, damage * METER_GAIN.damage));
    attacker.moveConnected = true;
    attacker.combo = attacker.comboClock > 0 ? attacker.combo + 1 : 1;
    attacker.comboClock = 68;
    attacker.comboDamage += damage;

    match.hitStop = move.hitstop + (counter ? 3 : 0);
    const heavyHit = damage >= 10 || move.superMove || move.wallBounce || counter;
    match.shake = Math.max(match.shake, move.superMove ? 11 : heavyHit ? 8 : 4);
    const bias = attacker.facing > 0 ? -0.35 : Math.PI + 0.35;
    addImpact(match, impactX, impactY, attacker.data.color, heavyHit, bias);
    addDamageNumber(
      match,
      impactX,
      impactY - 44,
      counter ? `${damage}!` : damage,
      attacker.data.color,
      heavyHit ? 1.25 : 1
    );

    const sfxType = move.superMove || damage >= 11 ? 'heavy' : damage >= 7 ? 'medium' : 'light';
    audio.sfx(sfxType, damage / 9);

    if (attacker.combo >= 2) {
      match.events.push({ type: 'combo', fighter: attacker });
      for (let i = COMBO_TIERS.length - 1; i >= 0; i--) {
        if (attacker.combo === COMBO_TIERS[i].min) {
          match.events.push({
            type: 'callout',
            fighter: attacker,
            text: COMBO_TIERS[i].label,
            color: attacker.data.color
          });
          break;
        }
      }
    }

    if (defender.health <= 0) {
      // Mortal Kombat FINISH HIM mechanic on match point!
      const isMatchPoint = attacker.wins >= 1;
      if (isMatchPoint && !match.finishHimShown && !wasDizzy && !move.superMove) {
        match.finishHimShown = true;
        match.finishTimer = 210; // 3.5 seconds to land the finishing blow!
        defender.health = 1;
        defender.state = 'dizzy';
        defender.vx = attacker.facing * 3;
        defender.vy = 0;
        defender.y = GROUND;
        defender.launched = false;
        attacker.gainMeter(100); // Free bar for Stage Finisher / Hyper!
        match.hitStop = 16;
        match.shake = 10;
        audio.sfx('finish');
        match.events.push({
          type: 'announce',
          text: 'FINISH HIM!',
          duration: 1350
        });
      } else {
        triggerKoState(match, attacker, defender, move, wasDizzy || move.superMove);
      }
    }
  }

  if (projectile) {
    if (projectile.hitsLeft > 1) {
      projectile.hitsLeft--;
      projectile.hitCooldown = 5;
    } else {
      projectile.dead = true;
    }
  } else {
    attacker.moveHit = true;
  }
}

function triggerKoState(match, attacker, defender, move, stageFinisher = false) {
  defender.health = 0;
  defender.state = 'knockdown';
  defender.knockdown = 110;
  defender.vy = move.launch ? -14 : -9.5;
  defender.vx = attacker.facing * 9.5;
  defender.launched = true;
  match.koZoom = stageFinisher ? 38 : 28;
  match.shake = stageFinisher ? 18 : 14;
  match.hyperFinish = Boolean(move.superMove || stageFinisher);
  if (match.hyperFinish) {
    match.superFlash = 30;
    addImpact(match, defender.x, defender.y - 160, attacker.data.color, true);
  }
}

export function spawnProjectile(match, owner, move, index = 0) {
  const superScale = move.superMove ? 1.55 : 1;
  const speed = (move.projectileSpeed || 11.2) * (1 - index * 0.08);
  const yOffset = move.barrage ? -155 + Math.sin(index * 1.9) * 58 : -158 + index * 22;
  match.projectiles.push({
    owner, move,
    x: owner.x + owner.facing * (76 - index * 24),
    y: owner.y + yOffset,
    vx: owner.facing * speed,
    vy: move.barrage ? Math.cos(index * 1.7) * 1.2 : 0,
    radius: (move.projectileRadius || 32) * superScale,
    life: move.superMove ? 110 : 88,
    color: owner.data.color,
    secondary: owner.data.secondary || '#ffffff',
    dead: false,
    hitsLeft: move.exMove && owner.data.id === 'kurt' ? 2 : 1,
    hitCooldown: 0,
    superMove: move.superMove
  });
  match.rings.push({
    x: owner.x + owner.facing * 56,
    y: owner.y + yOffset,
    life: 18, max: 18,
    color: owner.data.color
  });
}

export function updateProjectiles(match) {
  for (let i = match.projectiles.length - 1; i >= 0; i--) {
    const p = match.projectiles[i];
    p.x += p.vx;
    p.y += p.vy || 0;
    p.life--;
    if (p.hitCooldown > 0) p.hitCooldown--;

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
        addImpact(match, (p.x + other.x) / 2, (p.y + other.y) / 2, '#fff5d6', true);
        audio.sfx('block');
      }
    }

    const defender = p.owner === match.p1 ? match.p2 : match.p1;
    if (!p.dead && p.hitCooldown <= 0 && defender.invuln <= 0 && overlap(box, defender.hurtBox())) {
      applyHit(match, p.owner, defender, p.move, p);
    }

    if (p.life <= 0 || p.x < -80 || p.x > WORLD_W + 80) p.dead = true;
    if (p.dead) match.projectiles.splice(i, 1);
  }
}

export function resolveCombat(match, attacker, defender) {
  if (defender.invuln > 0) return;
  const active = attacker.activeBox();
  if (active && overlap(active, defender.hurtBox())) {
    applyHit(match, attacker, defender, attacker.move);
  }
}

export function bodyPush(match) {
  const a = match.p1, b = match.p2;
  const gap = b.x - a.x;
  if (Math.abs(gap) >= PUSH_DISTANCE) return;
  // Don't body-push high airborne fighters passing over each other (cross-up support!)
  if (Math.abs(a.y - b.y) > 155) return;
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
    fx.vx *= 0.92;
    fx.vy *= 0.92;
    fx.vy += 0.1;
    if (--fx.life <= 0) match.effects.splice(i, 1);
  }

  for (let i = match.rings.length - 1; i >= 0; i--) {
    if (--match.rings[i].life <= 0) match.rings.splice(i, 1);
  }

  if (match.damageNumbers) {
    for (let i = match.damageNumbers.length - 1; i >= 0; i--) {
      const dn = match.damageNumbers[i];
      dn.y += dn.vy;
      dn.vy *= 0.95;
      if (--dn.life <= 0) match.damageNumbers.splice(i, 1);
    }
  }

  if (match.superFlash > 0) match.superFlash--;
  if (match.koZoom > 0) match.koZoom--;

  match.shake *= 0.8;
  if (match.shake < 0.15) match.shake = 0;
}
