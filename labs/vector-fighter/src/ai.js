/**
 * CPU no espírito arcade: pensa em intervalos, erra de propósito,
 * guarda contra golpes visíveis e pressiona quando a vida está alta.
 */

import { DIFFICULTY } from './config.js';

export class FighterAI {
    constructor(level = 'normal') {
        this.setLevel(level);
        this.cool = 0;
        this.holdGuard = 0;
        this.sideTimer = 0;
        this.side = 0;
        this.last = empty();
    }

    setLevel(level) {
        this.cfg = DIFFICULTY[level] || DIFFICULTY.normal;
    }

    think(me, opp) {
        const cmd = empty();
        if (!me.alive || me.state === 'down' || me.state === 'win') return cmd;

        const dist = me.distTo(opp);
        const attacking = opp.state === 'punch' || opp.state === 'kick' || opp.state === 'sweep';

        if (this.holdGuard > 0) {
            cmd.guard = true;
            return cmd;
        }

        if (attacking && dist < 2.1 && Math.random() < this.cfg.block) {
            this.holdGuard = 0.28 + Math.random() * 0.2;
            cmd.guard = true;
            return cmd;
        }

        if (Math.random() < this.cfg.error) {
            cmd.x = Math.random() < 0.5 ? -1 : 1;
            return cmd;
        }

        if (dist > 2.6) {
            cmd.z = 1;
            if (Math.random() < 0.2 * this.cfg.aggro) cmd.dash = true;
        } else if (dist > 1.35) {
            cmd.z = 0.55;
            if (Math.random() < this.cfg.aggro) {
                if (Math.random() < 0.45) cmd.kick = true;
                else cmd.punch = true;
            }
        } else {
            const roll = Math.random();
            if (roll < 0.22 * this.cfg.aggro && dist < 1.15) cmd.throw = true;
            else if (roll < 0.4) cmd.sweep = true;
            else if (roll < 0.72) cmd.punch = true;
            else cmd.kick = true;
        }

        if (this.sideTimer > 0) cmd.x = this.side;
        return cmd;
    }

    update(dt, me, opp) {
        this.cool -= dt;
        this.holdGuard = Math.max(0, this.holdGuard - dt);
        this.sideTimer = Math.max(0, this.sideTimer - dt);
        if (this.sideTimer <= 0 && Math.random() < 0.015) {
            this.side = Math.random() < 0.5 ? -1 : 1;
            this.sideTimer = 0.28 + Math.random() * 0.4;
        }
        if (this.cool > 0) {
            const held = { ...this.last, punch: false, kick: false, sweep: false, throw: false, jump: false, dash: false };
            if (this.holdGuard > 0) held.guard = true;
            return held;
        }
        this.cool = this.cfg.think * (0.7 + Math.random() * 0.6);
        this.last = this.think(me, opp);
        return this.last;
    }
}

function empty() {
    return { x: 0, z: 0, punch: false, kick: false, sweep: false, throw: false, guard: false, jump: false, dash: false };
}
