/**
 * O drakkar do jogador e o guerreiro a bordo.
 *
 * Guarda a física da navegação (velocidade, deriva lateral, limites do rio),
 * a animação do casco sobre as ondas, os remos, o arremesso de machado e os
 * poderes temporários (escudo e fúria).
 */

import * as THREE from 'three';
import { buildLongship, buildWarrior } from './models.js';
import { waterHeight, waterSlope } from './water.js';
import { centerX, halfWidth } from './river.js';
import { BOAT, AXE } from './config.js';
import { clamp, damp, lerp } from './utils.js';

const tmpSlope = { dx: 0, dz: 0 };

export class Player {
    constructor(scene) {
        this.root = new THREE.Group();
        scene.add(this.root);

        // O modelo é construído com a proa em +Z; o grupo interno gira 180°
        // para que o "para frente" do jogador seja -Z no mundo.
        const { group: ship, parts } = buildLongship({
            length: 15,
            beam: 3.6,
            hullColor: 0x6b4429,
            sailBase: '#ded1b0',
            sailStripe: '#a02f2f',
            emblem: 'cross'
        });
        ship.rotation.y = Math.PI;
        this.root.add(ship);
        this.ship = ship;
        this.parts = parts;

        const { group: warrior, parts: wParts } = buildWarrior({});
        warrior.position.set(0, 0.32, -1.6);
        ship.add(warrior);
        this.warrior = warrior;
        this.wParts = wParts;

        // Bolha de escudo.
        this.shieldBubble = new THREE.Mesh(
            new THREE.SphereGeometry(5.6, 20, 14),
            new THREE.MeshBasicMaterial({
                color: 0x7ec8ff,
                transparent: true,
                opacity: 0.16,
                depthWrite: false,
                side: THREE.DoubleSide
            })
        );
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
        this._setOpacity(1);
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

    _setOpacity(value) {
        this.root.traverse((child) => {
            if (!child.material || child === this.shieldBubble) return;
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            for (const m of mats) {
                if (m.userData.baseOpacity === undefined) {
                    m.userData.baseOpacity = m.opacity;
                    m.userData.baseTransparent = m.transparent;
                }
                if (value >= 1) {
                    m.opacity = m.userData.baseOpacity;
                    m.transparent = m.userData.baseTransparent;
                } else {
                    m.transparent = true;
                    m.opacity = m.userData.baseOpacity * value;
                }
            }
        });
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

        this.root.position.set(this.x, wy + 0.62, this.z);

        const steerYaw = clamp(-this.lateral / BOAT.strafeSpeed, -1, 1) * 0.26;
        this.yaw = damp(this.yaw, steerYaw, 6, dt);
        this.roll = damp(this.roll, steerYaw * 1.5 - tmpSlope.dx * 1.4, 5, dt);

        this.root.rotation.y = this.yaw;
        this.root.rotation.z = this.roll;
        this.root.rotation.x = tmpSlope.dz * 1.1 + Math.sin(time * 1.3) * 0.012;

        // --- remos ---
        const rowSpeed = 2.2 + (this.speed / BOAT.boostSpeed) * 3.4;
        for (const oar of this.parts.oars) {
            const phase = time * rowSpeed + oar.userData.phase;
            oar.rotation.x = Math.sin(phase) * 0.46;
            oar.rotation.z = oar.userData.baseRoll - oar.userData.side * Math.sin(phase + 1.3) * 0.22;
        }

        // --- guerreiro ---
        const sway = Math.sin(time * 1.6) * 0.05;
        this.wParts.torso.rotation.z = sway - this.roll * 0.5;
        this.wParts.torso.rotation.x = -this.root.rotation.x * 0.6 + Math.sin(time * 1.1) * 0.03;
        this.wParts.head.rotation.y = clamp(-steer * 0.5, -0.5, 0.5) + Math.sin(time * 0.7) * 0.08;
        this.wParts.armL.rotation.x = -0.35 + Math.sin(time * 1.5) * 0.06;
        this.wParts.armL.rotation.z = 0.22;

        if (this.throwAnim > 0) {
            this.throwAnim = Math.max(0, this.throwAnim - dt * 3.6);
            const t = 1 - this.throwAnim; // 0 → 1 ao longo do arremesso
            const swing = t < 0.35
                ? lerp(0, -2.2, t / 0.35)          // recuo
                : lerp(-2.2, 0.9, (t - 0.35) / 0.65); // golpe
            this.wParts.armR.rotation.x = swing;
            this.wParts.torso.rotation.y = swing * 0.18;
        } else {
            this.wParts.armR.rotation.x = damp(this.wParts.armR.rotation.x, -0.25 + Math.sin(time * 1.4) * 0.07, 8, dt);
            this.wParts.torso.rotation.y = damp(this.wParts.torso.rotation.y, 0, 6, dt);
        }

        // Machado da mão some enquanto está em voo.
        this.wParts.axe.visible = this.throwTimer < (this.hasFury ? BOAT.furyCooldown : BOAT.throwCooldown) * 0.45;

        // --- lanterna e brasas ---
        if (this.parts.lanternFlame) {
            const s = 0.85 + Math.sin(time * 8.5) * 0.15;
            this.parts.lanternFlame.scale.set(s, s * 1.35, s);
        }

        // --- espuma da proa e esteira ---
        const speedRatio = this.speed / BOAT.boostSpeed;
        effects.wake.push(this.x, this.z + 6.5, 1.5 + speedRatio * 1.4, 0.55 + speedRatio * 0.45);

        if (Math.random() < 0.4 + speedRatio * 0.35) {
            const bowX = this.x + Math.sin(this.yaw) * 6.5;
            const bowZ = this.z - 6.8;
            effects.splash(bowX, wy + 0.1, bowZ, 1, 0.3 + speedRatio * 0.35);
        }

        // --- temporizadores ---
        this.throwTimer = Math.max(0, this.throwTimer - dt);
        this.invuln = Math.max(0, this.invuln - dt);
        this.shieldTime = Math.max(0, this.shieldTime - dt);
        this.furyTime = Math.max(0, this.furyTime - dt);

        // Piscar durante a invulnerabilidade.
        if (this.invuln > 0 && !this.hasShield) {
            this._setOpacity(0.35 + Math.abs(Math.sin(time * 22)) * 0.65);
        } else {
            this._setOpacity(1);
        }

        this.shieldBubble.visible = this.hasShield;
        if (this.hasShield) {
            const pulse = 0.14 + Math.sin(time * 5) * 0.05 + (this.shieldTime < 1.6 ? Math.sin(time * 22) * 0.08 : 0);
            this.shieldBubble.material.opacity = Math.max(0.04, pulse);
            this.shieldBubble.scale.setScalar(1 + Math.sin(time * 3) * 0.03);
        }

        if (this.hasFury) {
            const glow = 0.6 + Math.sin(time * 12) * 0.4;
            this.parts.hull.material.emissive?.setRGB(glow * 0.16, glow * 0.05, 0);
            if (Math.random() < 0.4) {
                effects.fire(this.x, wy + 1.6, this.z + 1.2, 1, 0.7);
            }
        } else if (this.parts.hull.material.emissive) {
            this.parts.hull.material.emissive.setRGB(0, 0, 0);
        }
    }

    /* ------------------------------------------------------------------ */

    canThrow() {
        return this.alive && this.throwTimer <= 0;
    }

    /** Lança o machado a partir da mão do guerreiro. */
    throwAxe(entities, ctx) {
        if (!this.canThrow()) return false;
        this.throwTimer = this.hasFury ? BOAT.furyCooldown : BOAT.throwCooldown;
        this.throwAnim = 1;

        const origin = new THREE.Vector3();
        this.wParts.armR.getWorldPosition(origin);

        // Mira: levemente à frente, seguindo a inclinação do barco.
        const dirX = Math.sin(this.yaw) * 0.55 + (ctx?.aimX ?? 0);
        const dir = new THREE.Vector3(dirX, 0, -1).normalize();

        entities.throwAxe(origin.x, origin.y + 0.3, origin.z - 1.2, dir.x, dir.z, AXE.speed);
        return true;
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
