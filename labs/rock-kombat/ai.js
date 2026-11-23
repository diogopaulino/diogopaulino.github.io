// ==========================================================================
// Rock Kombat — CPU AI
// MvC & MK tactical CPU:
// - Executes Magic Series combos (Light -> Medium -> Heavy -> Launcher -> Air Rave)
// - Performs Advancing Guard (Pushblock) under heavy block pressure
// - Uses Hyper Combos & Stage Finishers when opponent enters FINISH HIM dizzy state
// ==========================================================================

import { AI_CONFIG, EX_COST, HYPER_COST, PUSHBLOCK_COST, GROUND, BODY_WIDTH } from './constants.js?v=23';
import { random } from './utils.js';
import { moveFor } from './fighter.js';

export function updateCpu(match, difficulty, cpuInput) {
  const cpu = match.p2;
  const player = match.p1;
  const config = AI_CONFIG[difficulty] || AI_CONFIG.normal;
  // Fácil never spends 2 bars on a Hyper (config.hyper === false).
  const hyperMeter = config.hyper === false ? Infinity : HYPER_COST;

  // 1. Magic Series Combo Continuation when attack connects!
  if (cpu.state === 'attack' && cpu.moveConnected && cpu.move) {
    if (match.cpuComboMove === cpu.move) return;
    match.cpuComboMove = cpu.move;
    const mName = cpu.move.name;
    cpuInput.clearDirections();
    // Launcher jump-cancel into Air Rave!
    if (mName === 'launcher' && cpu.launchConfirmed && Math.random() < config.airFollow) {
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
        if (cpu.meter >= hyperMeter && Math.random() < 0.45) {
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
  if (cpu.state === 'blockstun') {
    if (cpu.stateFrame === 4 && cpu.meter >= PUSHBLOCK_COST && Math.random() < config.guard * 0.6) {
      cpuInput.tap('dash');
    }
    return;
  }

  // 3. Airborne chase during Air Rave
  if (!cpu.grounded() && player.launched && Math.abs(player.x - cpu.x) < 165
    && !cpu.move && cpu.stateFrame % 5 === 0 && Math.random() < config.airFollow) {
    cpuInput.tap('light');
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

  // 4. FINISH HIM! Immediately go for Hyper or Heavy Finisher
  if (player.state === 'dizzy') {
    if (cpu.meter >= hyperMeter && distance < 420) {
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

  // 5. Threat detection & defense — with human reaction time. The CPU only "sees" a
  //    player attack after `config.react` frames (fast jabs land before that, as they
  //    would against a person); up close it may also guard on a guess (`anticipate`).
  const react = config.react ?? 12;
  const incoming = player.move
    && player.moveFrame >= react
    && player.moveFrame <= player.move.startup + player.move.active + 4
    && distance < (player.move.reach || 240) + 115;
  const guess = !player.move && distance < 190 && player.grounded()
    && Math.random() < (config.anticipate ?? 0.1);

  const projectileThreat = match.projectiles.some(p =>
    p.owner === player && Math.abs(p.x - cpu.x) < 300 && Math.sign(p.vx) === Math.sign(cpu.x - p.x)
  );

  if (guess) {
    cpuInput.down(away);
    match.cpuHold = [away];
    if (Math.random() < 0.5) {
      cpuInput.down('down');
      match.cpuHold.push('down');
    }
    return;
  }

  if ((incoming || projectileThreat) && Math.random() < config.guard) {
    cpuInput.down(away);
    match.cpuHold = [away];
    // Low only once the move is readable (it already showed `react` frames); otherwise a guess.
    if ((player.move && player.move.level === 'low') || Math.random() < 0.3) {
      cpuInput.down('down');
      match.cpuHold.push('down');
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

  if (cpu.meter >= hyperMeter && roll < 0.14 * config.attack && distance < (id === 'axl' ? 420 : 640)) {
    cpuInput.tap('hyper');
    return;
  } else if (cpu.meter >= EX_COST && roll < config.attack * (id === 'lennon' ? 0.44 : 0.32)) {
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
