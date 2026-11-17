/**
 * O drakkar do jogador e o guerreiro a bordo.
 *
 * Guarda a física da navegação (velocidade, deriva lateral, limites do rio),
 * a animação do casco sobre as ondas, os remos, os canhões de bordo e os
 * poderes temporários (escudo e fúria).
 */

import * as THREE from 'three';
import { createHero } from '../../shared/gfx/hero.js';
import { buildLongship } from './ships.js?v=50';
import { fireLights } from './lights.js?v=50';
import { waterHeight, waterSlope } from './water.js?v=50';
import { centerX, halfWidth } from './river.js?v=50';
import { BOAT, CANNON } from './config.js?v=50';
import { clamp, damp } from './utils.js?v=50';

const tmpSlope = { dx: 0, dz: 0 };
const tmpMuzzle = new THREE.Vector3();
const tmpMuzzleWorld = new THREE.Vector3();
const ANIM = { rowRate: 3, speedRatio: 0, steer: 0, wind: 1 };

export class Player {
    constructor(scene, quality = null) {
        this.root = new THREE.Group();
        scene.add(this.root);
        const low = quality?.id === 'low';

        // O modelo é construído com a proa em +Z; o grupo interno gira 180°
        // para que o "para frente" do jogador seja -Z no mundo.
        const { group: ship, parts } = buildLongship({
            length: 15,
            beam: 3.6,
            sailBase: '#ded1b0',
            sailStripe: '#a02f2f',
            emblem: 'cross',
            cannons: true,
            cargo: !low,
            tier: quality?.id || 'high',
            crew: { presets: ['peasant', 'dwarf', 'peasant', 'elder'], rowers: low ? 2 : 6, detail: low ? 0 : 1 }
        });
        ship.rotation.y = Math.PI;
        this.root.add(ship);
        this.ship = ship;
        this.parts = parts;

        // Cavaleiro ao leme (popa): herói de alta fidelidade com espada e escudo.
        this.knight = createHero({ preset: 'knight', detail: low ? 1 : 2 });
        const helm = parts.helm || { x: 0, y: parts.deckY, z: -5.2 };
        this.knight.object.position.set(0, parts.poopY ?? helm.y, helm.z + 0.5);
        ship.add(this.knight.object);
        this.knight.equip?.({ handR: 'sword', handL: 'shield' });
        this.knightState = { mode: 'idle', speed: 0, upper: null, upperPhase: 0 };
        this.orderT = 1;

        // Bolha de escudo (casca translúcida com brilho de borda).
        this.shieldBubble = new THREE.Mesh(
            new THREE.SphereGeometry(8.2, 40, 24),
            new THREE.MeshBasicMaterial({
                color: 0x7ec8ff,
                transparent: true,
                opacity: 0.16,
                depthWrite: false,
                side: THREE.DoubleSide
            })
        );
        this.shieldBubble.scale.set(0.55, 0.6, 1);
        this.shieldBubble.visible = false;
        this.root.add(this.shieldBubble);

        this.reset();
    }

    reset(difficulty) {
        this.maxHull = difficulty?.hull ?? BOAT.maxHull;
        this.hull = this.maxHull;
        this.x = centerX(0);
        this.z = 0;
        this.speed = BOAT.baseSpeed;
        this.lateral = 0;
        this.yaw = 0;
        this.roll = 0;
        this.throwTimer = 0;
        this.invuln = 0;
        this.shieldTime = 0;
        this.furyTime = 0;
        this.throwAnim = 0;
        this.alive = true;
        this.distance = 0;
        this.docking = false;
        this.dockZ = 0;

        this.root.position.set(this.x, 0, 0);
        this.root.rotation.set(0, 0, 0);
        this.shieldBubble.visible = false;
        this.ship.visible = true;
        this.orderT = 1;
    }

    get position() {
        return this.root.position;
    }

    get hasShield() {
        return this.shieldTime > 0;
    }

    get hasFury() {
        return this.furyTime > 0;
    }

    /* ------------------------------------------------------------------ */

    update(dt, ctx) {
        const { input, time, effects } = ctx;

        // --- velocidade longitudinal ---
        let targetSpeed = BOAT.baseSpeed;
        if (this.docking) {
            // Aproximação final: desacelera até parar em frente à torre.
            targetSpeed = clamp((this.z - this.dockZ) * 0.75, 0, 11);
        } else if (input.boost) targetSpeed = BOAT.boostSpeed;
        else if (input.brake) targetSpeed = BOAT.brakeSpeed;
        targetSpeed *= ctx.speedScale ?? 1;

        this.speed = damp(this.speed, targetSpeed, BOAT.accel / 6, dt);
        this.z -= this.speed * dt;
        this.distance = -this.z;

        // --- deriva lateral ---
        const steer = this.docking ? 0 : input.steer;
        const targetLateral = steer * BOAT.strafeSpeed;
        this.lateral = damp(this.lateral, targetLateral, BOAT.strafeAccel / 8, dt);
        this.x += this.lateral * dt;

        // Correnteza empurra suavemente para o centro nas curvas.
        const cx = centerX(this.z);
        const hw = halfWidth(this.z);
        this.x += (cx - this.x) * 0.22 * dt;

        // Puxão dos redemoinhos.
        if (ctx.pull) {
            this.x += ctx.pull.x * dt;
            this.speed *= 1 - clamp(ctx.pull.drag * dt, 0, 0.6);
        }

        // Limite das margens: raspar na margem custa velocidade.
        const limit = hw - BOAT.bankLimitPadding;
        const offset = this.x - cx;
        if (Math.abs(offset) > limit) {
            this.x = cx + Math.sign(offset) * limit;
            this.lateral *= -0.25;
            this.speed = damp(this.speed, BOAT.brakeSpeed, 6, dt);
            if (Math.random() < 0.5) {
                effects.splash(this.x, 0.2, this.z - 2, 3, 0.7);
            }
            ctx.onScrape?.();
        }

        // --- assentamento sobre as ondas ---
        const wy = waterHeight(this.x, this.z, time);
        waterSlope(this.x, this.z, time, tmpSlope);

        this.root.position.set(this.x, wy + 0.95, this.z);

        const steerYaw = clamp(-this.lateral / BOAT.strafeSpeed, -1, 1) * 0.26;
        this.yaw = damp(this.yaw, steerYaw, 6, dt);
        this.roll = damp(this.roll, clamp(steerYaw * 1.5 - tmpSlope.dx * 1.4, -0.22, 0.22), 5, dt);

        this.root.rotation.y = this.yaw;
        this.root.rotation.z = this.roll;
        this.root.rotation.x = clamp(
            tmpSlope.dz * 1.1 + Math.sin(time * 1.3) * 0.012,
            -0.14,
            0.14
        );

        const speedRatio = this.speed / BOAT.boostSpeed;

        // --- remos, remadores, vela, recuo dos canhões (ships.js) ---
        // cadência da remada cresce com a velocidade: 2,2 rad/s parado → 5,4 rad/s no impulso
        ANIM.rowRate = 2.2 + speedRatio * 3.2;
        ANIM.speedRatio = speedRatio;
        ANIM.steer = steer;
        this.parts.animate(dt, time, ANIM);
        if (this.parts.rudder) this.parts.rudder.rotation.y = -this.yaw * 1.8;
        this._animateKnight(dt);
        if (this.parts.lanternFlame) {
            this.parts.lanternFlame.getWorldPosition(tmpMuzzle);
            fireLights.request(tmpMuzzle.x, tmpMuzzle.y, tmpMuzzle.z, 0xffa54a, 26 + Math.sin(time * 9) * 4, 9);
        }

        // --- espuma da proa e esteira (fora do casco, nunca sobre o convés) ---
        const sternZ = this.z + 9.2;
        effects.wake.push(this.x - 1.15, sternZ, 1.55 + speedRatio * 1.35, 0.7 + speedRatio * 0.5);
        effects.wake.push(this.x + 1.15, sternZ, 1.55 + speedRatio * 1.35, 0.7 + speedRatio * 0.5);

        if (Math.random() < 0.28 + speedRatio * 0.28) {
            const bowX = this.x + Math.sin(this.yaw) * 7.2;
            const bowZ = this.z - 7.6;
            effects.splash(bowX, wy + 0.05, bowZ, 2, 0.28 + speedRatio * 0.28);
        }
        if (Math.random() < 0.14 + speedRatio * 0.16) {
            const side = Math.random() < 0.5 ? -1 : 1;
            effects.splash(this.x + side * 3.4, wy + 0.02, this.z + 8.6, 1, 0.18 + speedRatio * 0.16);
        }

        // --- temporizadores ---
        this.throwTimer = Math.max(0, this.throwTimer - dt);
        this.invuln = Math.max(0, this.invuln - dt);
        this.shieldTime = Math.max(0, this.shieldTime - dt);
        this.furyTime = Math.max(0, this.furyTime - dt);

        // Piscar durante a invulnerabilidade: alterna a visibilidade a ~11 Hz
        // (mais barato e robusto com SkinnedMesh do que clonar materiais para alfa).
        this.ship.visible = !(this.invuln > 0 && !this.hasShield && Math.sin(time * 70) < -0.25);

        this.shieldBubble.visible = this.hasShield;
        if (this.hasShield) {
            const pulse = 0.14 + Math.sin(time * 5) * 0.05 + (this.shieldTime < 1.6 ? Math.sin(time * 22) * 0.08 : 0);
            this.shieldBubble.material.opacity = Math.max(0.04, pulse);
            this.shieldBubble.scale.setScalar(1 + Math.sin(time * 3) * 0.03);
        }

        if (this.hasFury) {
            const glow = 0.6 + Math.sin(time * 12) * 0.4;
            this.parts.setEmissive(glow * 0.16, glow * 0.05, 0);
            this._furyOn = true;
            if (Math.random() < 0.4) {
                effects.fire(this.x, wy + 1.6, this.z + 1.2, 1, 0.7);
            }
        } else if (this._furyOn) {
            this.parts.setEmissive(0, 0, 0);
            this._furyOn = false;
        }
    }

    /** Cavaleiro: parado ao leme, golpe de espada ao ordenar fogo, comemora ao atracar. */
    _animateKnight(dt) {
        const st = this.knightState;
        st.mode = this.docking ? 'cheer' : 'idle';
        this.orderT = Math.min(1, this.orderT + dt / 0.55);
        st.upper = this.orderT < 1 ? 'attack' : null;
        st.upperPhase = this.orderT;
        this.knight.update(dt, st);
    }

    /** Menu: tripulação remando devagar, sem física de navegação. */
    updateMenu(dt, time) {
        ANIM.rowRate = 1.9;
        ANIM.speedRatio = 0.3;
        ANIM.steer = 0;
        this.parts.animate(dt, time, ANIM);
        this._animateKnight(dt);
    }

    /* ------------------------------------------------------------------ */

    canThrow() {
        return this.alive && this.throwTimer <= 0;
    }

    /** Frente do navio no plano XZ (mundo). */
    forwardXZ() {
        return { x: Math.sin(this.yaw), z: -Math.cos(this.yaw) };
    }

    /** Alvo atual sob a mira automática (cone largo à frente). */
    getAimLock(entities) {
        const fwd = this.forwardXZ();
        return entities.findCannonTarget(
            this.x,
            this.position.y + 1.4,
            this.z,
            fwd.x,
            fwd.z
        );
    }

    /**
     * Dispara canhão com mira automática (estilo jogos de navio).
     * Um botão: trava o melhor alvo no cone e escolhe o canhão certo.
     * Em fúria: salva de bordo no mesmo lado.
     */
    fireCannons(entities, ctx) {
        if (!this.canThrow()) return false;
        this.throwTimer = this.hasFury ? BOAT.furyCooldown : BOAT.throwCooldown;
        this.throwAnim = 1;
        this.orderT = 0;

        const fwd = this.forwardXZ();
        const target = entities.findCannonTarget(
            this.x,
            this.position.y + 1.4,
            this.z,
            fwd.x,
            fwd.z
        );
        this._lastLock = target;

        let aimX = fwd.x;
        let aimZ = fwd.z;
        let aimY = this.position.y + 2.2;
        if (target) {
            aimX = target.x - this.x;
            aimZ = target.z - this.z;
            aimY = target.y;
        } else {
            // Sem trava: tiro curto à frente (ainda útil contra o que surgir).
            aimX = fwd.x * 0.35 + (ctx?.input?.steer ?? 0) * 0.55;
            aimZ = fwd.z;
            aimY = this.position.y + 3.5;
        }
        const aimLen = Math.hypot(aimX, aimZ) || 1;
        aimX /= aimLen;
        aimZ /= aimLen;

        // Lado no espaço local do modelo (já rotacionado 180° → inverte X mundo).
        const rightX = Math.cos(this.yaw);
        const rightZ = Math.sin(this.yaw);
        const sideDot = aimX * rightX + aimZ * rightZ;
        const preferSide = Math.abs(sideDot) < 0.25 ? 0 : sideDot > 0 ? -1 : 1;

        const guns = this.parts.cannons || [];
        const selected = [];
        if (preferSide === 0) {
            const bow = guns.find((g) => g.userData.aim === 'bow');
            if (bow) selected.push(bow);
        } else {
            for (const gun of guns) {
                if (gun.userData.aim === 'bow') continue;
                if (gun.userData.side === preferSide) selected.push(gun);
            }
            // Ordena pela proximidade Z ao alvo — canhão do meio primeiro.
            if (target && selected.length > 1) {
                selected.sort((a, b) => {
                    a.getWorldPosition(tmpMuzzle);
                    const da = Math.hypot(target.x - tmpMuzzle.x, target.z - tmpMuzzle.z);
                    b.getWorldPosition(tmpMuzzleWorld);
                    const db = Math.hypot(target.x - tmpMuzzleWorld.x, target.z - tmpMuzzleWorld.z);
                    return da - db;
                });
            }
        }
        if (!selected.length) {
            const bow = guns.find((g) => g.userData.aim === 'bow');
            if (bow) selected.push(bow);
            else if (guns[0]) selected.push(guns[0]);
        }
        const toFire = this.hasFury ? selected : selected.slice(0, 1);
        const speed = CANNON.speed * (this.hasFury ? 1.08 : 1);
        let fired = 0;

        for (let i = 0; i < toFire.length; i++) {
            const gun = toFire[i];
            tmpMuzzle.copy(gun.userData.muzzleLocal);
            gun.localToWorld(tmpMuzzle);
            tmpMuzzleWorld.copy(tmpMuzzle);

            let dirX = aimX;
            let dirZ = aimZ;
            if (target) {
                dirX = target.x - tmpMuzzleWorld.x;
                dirZ = target.z - tmpMuzzleWorld.z;
            }
            const dLen = Math.hypot(dirX, dirZ) || 1;
            dirX /= dLen;
            dirZ /= dLen;

            const dist = target ? Math.hypot(target.x - tmpMuzzleWorld.x, target.z - tmpMuzzleWorld.z) : 55;
            const dy = (target ? target.y : aimY) - tmpMuzzleWorld.y;
            const tFlight = dist / speed;
            let loft = dy / Math.max(0.2, tFlight) + 0.5 * CANNON.gravity * tFlight;
            loft = clamp(loft, 4.5, 28);

            // Pequeno atraso entre bocas na salva.
            const stagger = i * 0.04;
            const ox = tmpMuzzleWorld.x + dirX * stagger * speed * 0.15;
            const oz = tmpMuzzleWorld.z + dirZ * stagger * speed * 0.15;

            if (entities.fireShot(ox, tmpMuzzleWorld.y, oz, dirX, dirZ, speed, loft)) {
                fired += 1;
                this.parts.fireGun(gun);
                fireLights.request(tmpMuzzleWorld.x, tmpMuzzleWorld.y, tmpMuzzleWorld.z, 0xffb060, 160, 16);
                ctx.effects.muzzle?.(tmpMuzzleWorld.x, tmpMuzzleWorld.y, tmpMuzzleWorld.z, dirX, dirZ);
                ctx.effects.explosion(tmpMuzzleWorld.x, tmpMuzzleWorld.y, tmpMuzzleWorld.z, 0.22, 0.12);
                ctx.effects.smokePuff(tmpMuzzleWorld.x, tmpMuzzleWorld.y + 0.2, tmpMuzzleWorld.z, 5, 0.85);
                ctx.effects.fire(tmpMuzzleWorld.x, tmpMuzzleWorld.y, tmpMuzzleWorld.z, 2, 0.9);
            }
        }

        return fired > 0;
    }

    /** @deprecated use fireCannons */
    throwAxe(entities, ctx) {
        return this.fireCannons(entities, ctx);
    }

    damage(amount, ctx) {
        if (!this.alive || this.invuln > 0) return false;
        if (this.hasShield) {
            this.shieldTime = 0;
            this.invuln = BOAT.invulnAfterHit;
            ctx.effects.explosion(this.x, this.position.y + 1, this.z, 0.9, 0.55);
            ctx.audio.sfx('hitMetal');
            return false;
        }

        this.hull -= amount;
        this.invuln = BOAT.invulnAfterHit;
        ctx.effects.explosion(this.x, this.position.y + 1, this.z, 0.8);
        ctx.audio.sfx('damage');

        if (this.hull <= 0) {
            this.hull = 0;
            this.alive = false;
            return true;
        }
        return false;
    }

    heal(amount = 1) {
        this.hull = Math.min(this.maxHull, this.hull + amount);
    }

    grantShield(seconds = 8) {
        this.shieldTime = seconds;
    }

    grantFury(seconds = 9) {
        this.furyTime = seconds;
    }

    /** Sequência final: o barco encosta na doca do castelo. */
    startDocking(targetZ) {
        this.docking = true;
        this.dockZ = targetZ;
    }
}
