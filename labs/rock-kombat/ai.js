// ==========================================================================
// Rock Kombat — AI Module
// CPU decision-making with difficulty-based behavior profiles
// ==========================================================================

import { AI_CONFIG, SPECIAL_COST, GROUND, BODY_WIDTH } from './constants.js';
import { random } from './utils.js';
import { moveFor } from './fighter.js';

/**
 * CPU AI decision loop. Called every frame; uses a think-timer to throttle
 * decisions so the CPU doesn't react inhumanly fast.
 *
 * Key improvements over original:
 * - Range awareness: CPU walks into effective attack range before committing
 * - Air kick capability: CPU can jump-kick downed opponents
 * - Smarter special usage: considers distance and fighter type
 */
export function updateCpu(match, difficulty, cpuInput) {
  const cpu = match.p2;
  const player = match.p1;
  const config = AI_CONFIG[difficulty];

  // Think timer: prevents frame-perfect reactions
  if (--match.cpuThink > 0) return;
  match.cpuThink = Math.floor(random(config.think[0], config.think[1]));

  cpuInput.clearDirections();
  if (!cpu.neutral()) return;

  const distance = Math.abs(player.x - cpu.x);
  const toward = player.x < cpu.x ? 'left' : 'right';
  const away = toward === 'left' ? 'right' : 'left';

  // --- Threat detection: block incoming attacks ---
  const threat = player.move
    && player.moveFrame < player.move.startup + player.move.active + 2
    && distance < player.move.reach + 95;

  if (threat && Math.random() < config.guard) {
    cpuInput.down(away);
    if (player.move.level === 'low' || Math.random() < 0.32) {
      cpuInput.down('down');
    }
    return;
  }

  // --- Opportunity: air kick on downed/getting-up opponent ---
  if (player.state === 'getup' || player.state === 'knockdown') {
    if (distance > 100 && distance < 200 && Math.random() < config.attack * 0.5) {
      cpuInput.down(toward);
      cpuInput.tap('jump');
      cpuInput.tap('kick');
      return;
    }
  }

  // --- Choose intended attack ---
  const roll = Math.random();
  let intentName = 'kick';
  let downIntent = false;

  if (cpu.meter >= SPECIAL_COST && roll < 0.18) {
    intentName = 'special';
  } else if (player.y < GROUND - 60 && roll < config.punish) {
    // Anti-air: uppercut against airborne player
    intentName = 'punch';
    downIntent = true;
  } else if (roll < 0.42) {
    intentName = 'punch';
  } else if (roll < 0.82) {
    intentName = 'kick';
  } else {
    // Sweep
    intentName = 'kick';
    downIntent = true;
  }

  // Determine the actual move name for range calculation
  const moveName = downIntent
    ? (intentName === 'punch' ? 'uppercut' : 'sweep')
    : intentName;
  const intendedMoveData = moveFor(cpu, moveName);

  // Required range = move's reach + body width
  const requiredRange = intendedMoveData.reach + BODY_WIDTH;

  // --- Not in range: walk toward opponent ---
  if (distance > requiredRange) {
    // For projectile specials, fire at range
    if (intentName === 'special' && intendedMoveData.projectile && distance < 500) {
      cpuInput.tap('special');
      return;
    }
    cpuInput.down(toward);
    return;
  }

  // --- In range: execute attack based on attack probability ---
  if (Math.random() < config.attack) {
    if (downIntent) cpuInput.down('down');
    cpuInput.tap(intentName);
  } else if (distance < 125) {
    // Too close and not attacking: back off
    cpuInput.down(away);
  }
}
