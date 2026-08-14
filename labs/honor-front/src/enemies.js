/**
 * Patrulhas do Eixo: cobertura simples, linha de visão e rajadas.
 */

import * as THREE from 'three';
import { heightAt, randRange } from './utils.js';
import { buildSoldier } from './models.js';

const SPAWNS = [
    { x: -14, z: 98, yaw: Math.PI, mg: true },
    { x: 5, z: 99, yaw: Math.PI },
    { x: -14, z: 126, yaw: 2.6 },
    { x: 12, z: 130, yaw: 3.4 },
    { x: -8, z: 148, yaw: Math.PI },
    { x: 10, z: 154, yaw: 2.9 },
    { x: -16, z: 170, yaw: 0.4 },
    { x: 8, z: 176, yaw: Math.PI },
    { x: -5, z: 186, yaw: 2.8 },
    { x: 14, z: 196, yaw: 3.2 },
    { x: -10, z: 234, yaw: Math.PI },
    { x: 6, z: 240, yaw: 3.0 },
    { x: 3, z: 250, yaw: Math.PI },
    { x: -4, z: 258, yaw: 2.7 }
];

export class Enemies {
    constructor(scene) {
        this.list = [];
        this.scene = scene;
        for (const s of SPAWNS) {
            const mesh = buildSoldier({ team: 'axis' });
            mesh.position.set(s.x, heightAt(s.x, s.z), s.z);
            mesh.rotation.y = s.yaw;
            scene.add(mesh);
            this.list.push({
                mesh,
                x: s.x,
                z: s.z,
                y: heightAt(s.x, s.z),
                yaw: s.yaw,
                health: s.mg ? 90 : 70,
                alive: true,
                cooldown: randRange(0.4, 1.6),
                alert: 0,
                mg: !!s.mg,
                phase: randRange(0, 10),
                radius: 0.55
            });
        }
    }

    reset() {
        for (let i = 0; i < this.list.length; i++) {
            const e = this.list[i];
            const s = SPAWNS[i];
            e.x = s.x;
            e.z = s.z;
            e.y = heightAt(s.x, s.z);
            e.yaw = s.yaw;
            e.health = s.mg ? 90 : 70;
            e.alive = true;
            e.cooldown = randRange(0.3, 1.4);
            e.alert = 0;
            e.mesh.visible = true;
            e.mesh.position.set(e.x, e.y, e.z);
            e.mesh.rotation.y = e.yaw;
            e.mesh.rotation.x = 0;
        }
    }

    hitTest(origin, dir, maxDist = 160) {
        let best = null;
        let bestT = maxDist;
        for (const e of this.list) {
            if (!e.alive) continue;
            const cx = e.x - origin.x;
            const cy = (e.y + 1.15) - origin.y;
            const cz = e.z - origin.z;
            const t = cx * dir.x + cy * dir.y + cz * dir.z;
            if (t < 0.4 || t > bestT) continue;
            const px = origin.x + dir.x * t;
            const py = origin.y + dir.y * t;
            const pz = origin.z + dir.z * t;
            const dist = Math.hypot(px - e.x, py - (e.y + 1.15), pz - e.z);
            if (dist < 0.72) {
                best = e;
                bestT = t;
            }
        }
        return best ? { enemy: best, dist: bestT } : null;
    }

    damage(enemy, amount) {
        if (!enemy.alive) return false;
        enemy.health -= amount;
        enemy.alert = 1;
        if (enemy.health <= 0) {
            enemy.alive = false;
            enemy.mesh.rotation.x = 1.35;
            enemy.mesh.position.y = enemy.y + 0.15;
            return true;
        }
        return false;
    }

    explodeAt(x, y, z, radius, amount) {
        const killed = [];
        for (const e of this.list) {
            if (!e.alive) continue;
            const d = Math.hypot(e.x - x, e.z - z, (e.y + 1) - y);
            if (d < radius) {
                if (this.damage(e, amount * (1 - d / radius))) killed.push(e);
            }
        }
        return killed;
    }

    update(dt, player, world, difficulty, onShoot) {
        for (const e of this.list) {
            const parts = e.mesh.userData.parts;
            if (!e.alive) {
                if (parts) {
                    parts.arms[0].rotation.x = -0.4;
                    parts.arms[1].rotation.x = 0.2;
                }
                continue;
            }

            const dx = player.x - e.x;
            const dz = player.z - e.z;
            const dist = Math.hypot(dx, dz);
            const range = e.mg ? 95 : 52;
            const canSee = dist < range && hasLos(e, player, world);

            if (canSee) e.alert = Math.min(1, e.alert + dt * 1.4);
            else e.alert = Math.max(0, e.alert - dt * 0.25);

            if (e.alert > 0.25 && dist > 0.01) {
                const want = Math.atan2(dx, dz);
                e.yaw += Math.atan2(Math.sin(want - e.yaw), Math.cos(want - e.yaw)) * dt * 3.2;
                e.mesh.rotation.y = e.yaw;
            }

            e.phase += dt * (e.alert > 0.4 ? 0.4 : 1.2);
            if (parts) {
                const idle = Math.sin(e.phase) * 0.08;
                parts.arms[1].rotation.x = -0.35 - e.alert * 0.4;
                parts.arms[0].rotation.x = idle;
                parts.legs[0].rotation.x = 0;
                parts.head.rotation.x = -0.08;
            }

            e.cooldown -= dt;
            if (canSee && e.alert > 0.55 && e.cooldown <= 0 && player.alive) {
                const acc = difficulty.enemyAcc * (e.mg ? 0.85 : 1);
                const lead = Math.random() < acc;
                e.cooldown = e.mg ? 0.12 + Math.random() * 0.08 : 0.55 + Math.random() * 0.55;
                onShoot(e, lead, dist);
            }
        }
    }
}

function hasLos(e, player, world) {
    const steps = 6;
    for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const x = e.x + (player.x - e.x) * t;
        const z = e.z + (player.z - e.z) * t;
        if (world.blocked(x, z, 0.15)) return false;
    }
    return true;
}
