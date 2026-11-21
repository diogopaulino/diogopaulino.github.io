// ==========================================================================
// Rock Kombat — CPU AI
// MvC & MK tactical CPU:
// - Executes Magic Series combos (Light -> Medium -> Heavy -> Launcher -> Air Rave)
// - Performs Advancing Guard (Pushblock) under heavy block pressure
// - Uses Hyper Combos & Stage Finishers when opponent enters FINISH HIM dizzy state
// ==========================================================================

import { AI_CONFIG, EX_COST, HYPER_COST, PUSHBLOCK_COST, GROUND, BODY_WIDTH } from './constants.js';
import { random } from './utils.js';
import { moveFor } from './fighter.js';

export function updateCpu(match, difficulty, cpuInput) {
  const cpu = match.p2;
  const player = match.p1;
  const config = AI_CONFIG[difficulty] || AI_CONFIG.normal;

  // 1. Magic Series Combo Continuation when attack connects!
  if (cpu.state === 'attack' && cpu.moveConnected && cpu.move) {
    const mName = cpu.move.name;
    // Launcher jump-cancel into Air Rave!
    if (mName === 'launcher' && Math.random() < config.airFollow) {
      cpuInput.tap('jump');
      return;
    }
    if (cpu.move.cancel && Math.random() < config.combo) {
      if (mName === 'light' || mName === 'crouchlight') {
        cpuInput.tap('medium');
        return;
      }
      if (mName === 'medium') {
        cpuInput.tap('heavy');
        return;
      }
      if (mName === 'heavy') {
        if (cpu.meter >= HYPER_COST && Math.random() < 0.45) {
          cpuInput.tap('hyper');
        } else if (Math.random() < 0.65) {
          cpuInput.tap('launcher');
        } else if (cpu.meter >= EX_COST) {
          cpuInput.tap('special');
        }
        return;
      }
      if (mName === 'airlight') {
        cpuInput.tap('medium');
        return;
      }
      if (mName === 'airmedium') {
        cpuInput.tap('heavy');
        return;
      }
    }
    return;
  }

  // 2. Advancing Guard (Pushblock) when blocking repeated pressure
  if (cpu.state === 'blockstun' && cpu.meter >= PUSHBLOCK_COST && Math.random() < config.guard * 0.25) {
    cpuInput.tap('dash');
    return;
  }

  // 3. Airborne chase during Air Rave
  if (!cpu.grounded() && player.launched && Math.abs(player.x - cpu.x) < 165) {
    if (!cpu.move && Math.random() < config.airFollow) {
      cpuInput.tap('light');
      return;
    }
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

  // 4. FINISH HIM! Immediately go for Hyper or Heavy Finisher
  if (player.state === 'dizzy') {
    if (cpu.meter >= HYPER_COST && distance < 420) {
      cpuInput.tap('hyper');
      return;
    }
    if (distance > 125) {
      cpuInput.tap('dash');
      cpuInput.down(toward);
      match.cpuHold = [toward];
    } else {
      cpuInput.tap('heavy');
    }
    return;
  }

  // 5. Threat detection & defense
  const incoming = player.move
    && player.moveFrame <= player.move.startup + player.move.active + 4
    && distance < (player.move.reach || 240) + 115;

  const projectileThreat = match.projectiles.some(p =>
    p.owner === player && Math.abs(p.x - cpu.x) < 300 && Math.sign(p.vx) === Math.sign(cpu.x - p.x)
  );

  if ((incoming || projectileThreat) && Math.random() < config.guard) {
    cpuInput.down(away);
    match.cpuHold = [away];
    if ((player.move && player.move.level === 'low') || Math.random() < 0.3) {
      cpuInput.down('down');
      match.cpuHold.push('down');
    }
    if (projectileThreat && id !== 'axl' && cpu.meter >= EX_COST && Math.random() < 0.38) {
      cpuInput.tap('special');
    }
    return;
  }

  // 6. Wakeup reversal
  if (cpu.state === 'getup') {
    if (Math.random() < config.punish * 0.45) {
      cpuInput.tap('launcher');
      return;
    }
    if (Math.random() < config.guard) {
      cpuInput.down(away);
      match.cpuHold = [away];
      return;
    }
  }

  // 7. Anti-Air Launcher against jumping player
  if (!player.grounded() && player.y < GROUND - 75 && distance < 155 && Math.random() < config.punish) {
    cpuInput.tap('launcher');
    return;
  }

  // 8. Close-range Throw mix-up against blocking player
  if (distance <= 98 && player.grounded() && player.awayHeld(cpu) && Math.random() < config.attack * 0.55) {
    cpuInput.tap('throw');
    return;
  }

  // 9. Neutral offensive decision
  const roll = Math.random();
  let intentName = 'medium';
  let downIntent = false;

  if (cpu.meter >= HYPER_COST && roll < 0.18 && distance < 420) {
    cpuInput.tap('hyper');
    return;
  } else if (cpu.meter >= EX_COST && roll < (id === 'lennon' ? 0.32 : 0.22)) {
    intentName = 'special';
  } else if (distance > 210 && distance < 440 && cpu.grounded() && Math.random() < config.dash) {
    cpuInput.tap('dash');
    cpuInput.down(toward);
    match.cpuHold = [toward];
    return;
  } else if (roll < 0.42) {
    intentName = 'light';
  } else if (roll < 0.75) {
    intentName = 'medium';
  } else if (roll < 0.90) {
    intentName = 'heavy';
  } else {
    intentName = 'medium';
    downIntent = true;
  }

  const moveName = downIntent ? 'sweep' : intentName;
  const intended = moveFor(cpu, moveName);
  const requiredRange = (intended.reach || 260) + BODY_WIDTH;

  if (intentName === 'special' && intended.projectile && distance < 680 && distance > 150) {
    cpuInput.tap('special');
    return;
  }

  if (distance > requiredRange + 14) {
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
