/**
 * Percepção de guarda: cone de visão, linha de visão contra as caixas do nível,
 * audição e estados (SLEEP · IDLE · PATROL · SUSPICIOUS · CHASE · ATTACK · RETURN).
 *
 * Visão: o jogador é visto se está a menos de `viewDist` (×0,6 quando agachado), dentro
 * de ±`viewAngle` da frente do guarda e sem caixa sólida entre os olhos do guarda (1,5 m)
 * e a cabeça do jogador (1,5 m em pé · 0,85 m agachado) — agachar atrás de um caixote esconde.
 *
 * Alerta (0…1), mostrado no cone e na barra de "Silêncio":
 *   vendo:      alerta += dt · (0,9 + 1,6·(1 − dist/viewDist))     (de perto enche em ~0,4 s)
 *   ouvindo:    alerta += dt · 0,5
 *   sem sinal:  alerta −= dt · 0,35
 * Ao chegar a 1 o guarda persegue (CHASE); perto o bastante, ataca (ATTACK, 1 de dano a
 * cada 1,55 s, defesa reduz). Perdeu o jogador de vista por 4 s → procura e volta.
 */

import * as THREE from 'three';
import { damp } from '../utils/math.js';

export class GuardAI {
    constructor(guard, opts = {}) {
        this.guard = guard;
        this.state = opts.sleep ? 'SLEEP' : 'IDLE';
        this.home = new THREE.Vector3();
        this.facing = 0;
        this.viewDist = opts.viewDist ?? 9;
        this.viewAngle = opts.viewAngle ?? 0.7;
        this.hearRadius = opts.hearRadius ?? 4.2;
        this.patrol = opts.patrol || [];
        this.patrolI = 0;
        this.timer = 0;
        this.suspicion = 0;
        this.alert = 0;
        this.lostT = 0;
        this.attackCd = 0;
        this.sleep = Boolean(opts.sleep);
        this.snoreT = 0;
        this.waitT = 0;
    }

    canSee(game) {
        const g = this.guard;
        const p = game.player.position;
        const dx = p.x - g.position.x;
        const dz = p.z - g.position.z;
        const dy = p.y - g.position.y;
        const dist = Math.hypot(dx, dz);
        const reach = this.viewDist * (game.player.crouching ? 0.6 : 1);
        if (dist > reach || Math.abs(dy) > 2.2) return false;

        const ang = Math.atan2(dx, dz);
        const d = Math.abs(Math.atan2(Math.sin(ang - this.facing), Math.cos(ang - this.facing)));
        if (d > this.viewAngle && dist > 1.1) return false;

        // linha de visão: olhos do guarda → cabeça do jogador
        const ey = g.position.y + 1.5;
        const ty = p.y + (game.player.crouching ? 0.85 : 1.5);
        const len = Math.hypot(dx, ty - ey, dz) || 1;
        const hit = game.collision.rayHit(g.position.x, ey, g.position.z, dx / len, (ty - ey) / len, dz / len, len);
        return hit >= len - 0.35;
    }

    hear(game) {
        const g = this.guard;
        const p = game.player.position;
        if (Math.abs(p.y - g.position.y) > 2.2) return false;
        const dist = Math.hypot(p.x - g.position.x, p.z - g.position.z);
        const noise = game.player.noise || 0;
        let hear = noise * this.hearRadius;
        if (game.player.crouching) hear *= 0.55;
        if (dist < hear) return true;

        for (const n of game.collision.noiseSources) {
            if (Math.hypot(n.x - g.position.x, n.z - g.position.z) < n.amount * 5) return true;
        }
        return false;
    }

    update(dt, game) {
        const g = this.guard;
        this.timer += dt;
        this.attackCd = Math.max(0, this.attackCd - dt);

        if (this.state === 'SLEEP') {
            this.snoreT += dt;
            if (this.snoreT > 2.4) {
                this.snoreT = 0;
                const p = game.player.position;
                if (Math.hypot(p.x - g.position.x, p.z - g.position.z) < 7) {
                    game.audio?.play('snore');
                    game.hud?.flashStealth?.('Ronc… ronc…');
                }
            }
            if (this.hear(game) && game.player.noise > 0.9) {
                this.suspicion += dt * 0.8;
            } else {
                this.suspicion = Math.max(0, this.suspicion - dt * 0.15);
            }
            if (this.suspicion > 1.2) {
                this.state = 'SUSPICIOUS';
                this.timer = 0;
                this.alert = 0.6;
            }
            g.speed = 0;
            return;
        }

        const p = game.player.position;
        const dx = p.x - g.position.x;
        const dz = p.z - g.position.z;
        const dist = Math.hypot(dx, dz);
        const seen = game.player.alive && this.canSee(game);
        const heard = game.player.alive && this.hear(game) && game.player.noise > 0.7;

        if (seen) this.alert += dt * (0.9 + 1.6 * (1 - Math.min(1, dist / this.viewDist)));
        else if (heard) this.alert += dt * 0.5;
        else if (this.state !== 'CHASE' && this.state !== 'ATTACK') this.alert -= dt * 0.35;
        this.alert = Math.max(0, Math.min(1, this.alert));

        if (this.alert >= 1 && this.state !== 'CHASE' && this.state !== 'ATTACK') {
            this.state = 'CHASE';
            this.lostT = 0;
            game.audio?.play('fail');
        }

        if (this.state === 'CHASE' || this.state === 'ATTACK') {
            this.lostT = seen || dist < 2.5 ? 0 : this.lostT + dt;
            if (this.lostT > 4 || !game.player.alive) {
                this.state = 'SEARCH';
                this.timer = 0;
                g.speed = 0;
                return;
            }
        }

        if (this.state === 'CHASE') {
            this.facing = Math.atan2(dx, dz);
            const spd = 3.4;
            const nx = g.position.x + Math.sin(this.facing) * spd * dt;
            const nz = g.position.z + Math.cos(this.facing) * spd * dt;
            // guarda também respeita paredes: usa a mesma cápsula do jogador
            const res = game.collision.resolveCapsule(g.position.x, g.position.y, g.position.z, 0.32, 1.7, (nx - g.position.x) / dt, (nz - g.position.z) / dt, dt, 0.42);
            g.position.x = res.x;
            g.position.z = res.z;
            if (res.grounded) g.position.y = res.y;
            g.speed = spd;
            if (dist < 1.7) this.state = 'ATTACK';
            return;
        }

        if (this.state === 'ATTACK') {
            this.facing = Math.atan2(dx, dz);
            g.speed = 0;
            if (dist > 2.3) {
                this.state = 'CHASE';
                return;
            }
            if (this.attackCd <= 0 && dist < 1.9) {
                this.attackCd = 1.55;
                this.hitPending = 0.28; // o golpe acerta no meio do movimento
            }
            if (this.hitPending > 0) {
                this.hitPending -= dt;
                if (this.hitPending <= 0 && dist < 2.1) {
                    if (game.player.hurt(1)) {
                        game.audio?.play('hit');
                        game.cameraRig?.addShake(0.1, 0.2);
                    }
                }
            }
            return;
        }

        if (this.state === 'SUSPICIOUS' || this.state === 'SEARCH') {
            this.facing += dt * 0.8;
            g.speed = 0;
            if (this.timer > 3) {
                this.state = this.sleep ? 'SLEEP' : 'RETURN';
                this.suspicion = 0;
            }
            return;
        }

        if (this.state === 'RETURN' || this.state === 'IDLE' || this.state === 'PATROL') {
            if (this.patrol.length) {
                this.state = 'PATROL';
                const goal = this.patrol[this.patrolI];
                const gx = goal.x - g.position.x;
                const gz = goal.z - g.position.z;
                const gd = Math.hypot(gx, gz);
                if (this.waitT > 0) {
                    // pausa no ponto de ronda, olhando em volta
                    this.waitT -= dt;
                    this.facing += Math.sin(this.timer * 1.3) * dt * 0.9;
                    g.speed = 0;
                } else if (gd < 0.3) {
                    this.patrolI = (this.patrolI + 1) % this.patrol.length;
                    this.waitT = goal.wait ?? 1.2;
                } else {
                    // quando algo chamou a atenção, anda mais devagar olhando para o jogador
                    const spd = this.alert > 0.35 ? 0.6 : 1.6;
                    this.facing = this.alert > 0.35 ? Math.atan2(dx, dz) : Math.atan2(gx, gz);
                    const dir = Math.atan2(gx, gz);
                    g.position.x += Math.sin(dir) * spd * dt;
                    g.position.z += Math.cos(dir) * spd * dt;
                    g.position.y = damp(g.position.y, goal.y ?? g.position.y, 8, dt);
                    g.speed = spd;
                }
            } else {
                const hx = this.home.x - g.position.x;
                const hz = this.home.z - g.position.z;
                if (Math.hypot(hx, hz) > 0.4) {
                    this.facing = Math.atan2(hx, hz);
                    g.position.x += Math.sin(this.facing) * 1.6 * dt;
                    g.position.z += Math.cos(this.facing) * 1.6 * dt;
                    g.speed = 1.6;
                } else {
                    this.state = 'IDLE';
                    g.speed = 0;
                }
            }
        }
    }
}
