/**
 * Resolução de golpes. A hitbox é uma esfera no membro ativo; a hurtbox
 * é o torso. Throw só conecta se a distância no chão for menor que maxRange.
 */

import { TMP, TMP2 } from './fighter.js';

export function resolveHits(attacker, defender, onConnect) {
    if (!attacker.isActive() || defender.invuln > 0) return;
    if (defender.state === 'down' && attacker.move.type !== 'throw') return;

    const move = attacker.move;
    if (move.type === 'throw') {
        const dist = attacker.distTo(defender);
        if (dist > move.maxRange) return;
        if (defender.state === 'punch' || defender.state === 'kick') return;
        apply(attacker, defender, move, onConnect, false);
        return;
    }

    attacker.getWorldLimb(move.limb, TMP);
    defender.hurtbox(TMP2);
    const reach = (move.reach + 0.32 * defender.stats.bulk) * attacker.stats.reach;
    if (TMP.distanceTo(TMP2) > reach) return;

    const counter = defender.state === 'punch' || defender.state === 'kick'
        || defender.state === 'sweep';
    apply(attacker, defender, move, onConnect, counter);
}

function apply(attacker, defender, move, onConnect, counter) {
    const dx = defender.x - attacker.x;
    const dz = defender.z - attacker.z;
    const len = Math.hypot(dx, dz) || 1;
    const result = defender.takeHit(move, dx / len, dz / len, counter);
    attacker.moveHit = true;
    attacker.hitstop = move.hitstop;
    if (result === 'hit') attacker.combo += 1;
    else attacker.combo = 0;
    onConnect(result, move, counter, TMP.clone());
}

export function resetCombosIfIdle(fighter) {
    if (fighter.state === 'idle' || fighter.state === 'walk' || fighter.state === 'guard') {
        if (!fighter.move) fighter.combo = 0;
    }
}
