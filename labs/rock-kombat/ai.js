// ==========================================================================
// Rock Kombat — CPU AI
// Archetype spacing, wakeup, anti-air, sticky block, dash pressure
// ==========================================================================

import { AI_CONFIG, SPECIAL_COST, GROUND, BODY_WIDTH } from './constants.js';
import { random } from './utils.js';
import { moveFor } from './fighter.js';

export function updateCpu(match, difficulty, cpuInput) {
  const cpu = match.p2;
  const player = match.p1;
  const config = AI_CONFIG[difficulty] || AI_CONFIG.normal;

  if (cpu.state === 'attack' && cpu.moveConnected && cpu.move?.cancel && Math.random() < config.attack * 0.4) {
    if (cpu.move.cancel.includes('kick')) cpuInput.tap('kick');
    else if (cpu.move.cancel.includes('special') && cpu.meter >= SPECIAL_COST) cpuInput.tap('special');
    return;
  }

  if (--match.cpuThink > 0) {
    if (match.cpuHold && cpu.neutral()) {
      for (const key of match.cpuHold) cpuInput.down(key);
    }
    return;
  }

  match.cpuThink = Math.floor(random(config.think[0], config.think[1]));
  cpuInput.clearDirections();
  match.cpuHold = [];

  if (!cpu.neutral() && cpu.state !== 'dash' && cpu.state !== 'getup') return;

  const distance = Math.abs(player.x - cpu.x);
  const toward = player.x < cpu.x ? 'left' : 'right';
  const away = toward === 'left' ? 'right' : 'left';
  const id = cpu.data.id;

  const incoming = player.move
    && player.moveFrame <= player.move.startup + player.move.active + 3
    && distance < (player.move.reach || 0) + 110;

  const projectileThreat = match.projectiles.some(p =>
    p.owner === player && Math.abs(p.x - cpu.x) < 280 && Math.sign(p.vx) === Math.sign(cpu.x - p.x)
  );

  if ((incoming || projectileThreat) && Math.random() < config.guard) {
    cpuInput.down(away);
    match.cpuHold = [away];
    if ((player.move && player.move.level === 'low') || Math.random() < 0.28) {
      cpuInput.down('down');
      match.cpuHold.push('down');
    }
    if (projectileThreat && id !== 'axl' && cpu.meter >= SPECIAL_COST && Math.random() < 0.35) {
      cpuInput.tap('special');
    }
    return;
  }

  if (cpu.state === 'getup' || (cpu.invuln > 0 && cpu.state === 'idle' && distance < 140)) {
    if (Math.random() < config.punish * 0.45) {
      cpuInput.down('down');
      cpuInput.tap('punch');
      return;
    }
    if (Math.random() < config.guard) {
      cpuInput.down(away);
      match.cpuHold = [away];
      return;
    }
  }

  if ((player.state === 'knockdown' || player.state === 'getup') && Math.random() < config.attack) {
    if (distance > 160 && Math.random() < 0.4) {
      cpuInput.down(toward);
      cpuInput.tap('jump');
      match.cpuHold = [toward];
      return;
    }
    if (distance < 90) {
      cpuInput.tap('punch');
      cpuInput.tap('kick');
      return;
    }
  }

  if (!player.grounded() && player.y < GROUND - 70 && distance < 150 && Math.random() < config.punish) {
    cpuInput.down('down');
    cpuInput.tap('punch');
    return;
  }

  const roll = Math.random();
  let intentName = 'kick';
  let downIntent = false;

  if (cpu.meter >= SPECIAL_COST && roll < (id === 'lennon' ? 0.28 : id === 'axl' ? 0.16 : 0.2)) {
    intentName = 'special';
  } else if (id === 'axl' && distance > 180 && distance < 360 && cpu.grounded() && Math.random() < config.dash) {
    cpu.state = 'dash';
    cpu.dashType = 'forward';
    cpu.dashTimer = 12;
    cpu.facing = player.x >= cpu.x ? 1 : -1;
    return;
  } else if (roll < 0.38) {
    intentName = 'punch';
  } else if (roll < 0.78) {
    intentName = 'kick';
  } else {
    intentName = 'kick';
    downIntent = true;
  }

  const moveName = downIntent ? (intentName === 'punch' ? 'uppercut' : 'sweep') : intentName;
  const intended = moveFor(cpu, moveName);
  const requiredRange = (intended.reach || 220) + BODY_WIDTH;

  if (intentName === 'special' && intended.projectile && distance < 560 && distance > 140) {
    cpuInput.tap('special');
    if (Math.random() < config.sticky) {
      cpuInput.down(away);
      match.cpuHold = [away];
    }
    return;
  }

  if (distance > requiredRange + 12) {
    cpuInput.down(toward);
    match.cpuHold = [toward];
    return;
  }

  if (Math.random() < config.attack) {
    if (downIntent) cpuInput.down('down');
    cpuInput.tap(intentName);
  } else if (distance < 120) {
    cpuInput.down(away);
    match.cpuHold = [away];
  } else {
    cpuInput.down(toward);
    match.cpuHold = [toward];
  }
}
