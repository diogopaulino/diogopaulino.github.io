/**
 * Patrulhas e defensores do Eixo para Honor Front em Babylon.js.
 */

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
    constructor(BABYLON, scene, heightAt) {
        this.BABYLON = BABYLON;
        this.scene = scene;
        this.list = [];

        for (const s of SPAWNS) {
            const root = buildSoldier(BABYLON, scene);
            const y = heightAt(s.x, s.z);
            root.position.set(s.x, y, s.z);
            root.rotation.y = s.yaw;

            this.list.push({
                root,
                x: s.x,
                z: s.z,
                y,
                yaw: s.yaw,
                health: s.mg ? 90 : 70,
                alive: true,
                cooldown: 0.8 + Math.random() * 0.8,
                alert: 0,
                mg: !!s.mg,
                radius: 0.65
            });
        }
    }

    reset(heightAt) {
        for (let i = 0; i < this.list.length; i++) {
            const e = this.list[i];
            const s = SPAWNS[i];
            e.x = s.x;
            e.z = s.z;
            e.y = heightAt(s.x, s.z);
            e.yaw = s.yaw;
            e.health = s.mg ? 90 : 70;
            e.alive = true;
            e.cooldown = 0.8 + Math.random() * 0.8;
            e.alert = 0;
            e.root.setEnabled(true);
            e.root.position.set(e.x, e.y, e.z);
            e.root.rotation.set(0, e.yaw, 0);
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
            if (dist < 0.85) {
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
            enemy.root.rotation.x = 1.35;
            enemy.root.position.y = enemy.y + 0.15;
            return true; // eliminado
        }
        return false;
    }

    update(dt, player, onShoot) {
        if (!player.alive) return;

        for (const e of this.list) {
            if (!e.alive) continue;

            const dx = player.x - e.x;
            const dz = player.z - e.z;
            const dist = Math.hypot(dx, dz);

            if (dist < 45) {
                // Alinhar mira na direção do jogador
                const targetYaw = Math.atan2(dx, dz);
                e.yaw = targetYaw;
                e.root.rotation.y = e.yaw;

                e.cooldown -= dt;
                if (e.cooldown <= 0) {
                    e.cooldown = e.mg ? 0.35 : 1.4;
                    if (onShoot) {
                        onShoot(e, dist);
                    }
                }
            }
        }
    }
}
