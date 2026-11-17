/**
 * Clara em terceira pessoa: movimento relativo à câmera, lanterna na mão
 * e pulso da chama.
 *
 * Fórmulas:
 *   fuel' = fuel - drain * dt   (só se capítulo.dark e longe de lampião aceso)
 *   flash: se fuel >= 14, fuel -= 14, flashT = 0.55
 *   luz da lanterna (PointLight, candelas):
 *     I = LANTERN.base + (fuel/100)·LANTERN.gain + pulso·LANTERN.flash,  pulso = sin(π·(1 − flashT/0,55))
 *     alcance = 9 + (fuel/100)·9 + pulso·12 m;  tremor de ±6 % (duas senoides fora de fase)
 *   halo e chama crescem com o mesmo I — a lanterna é a fonte de luz da cena.
 *
 * Câmera: órbita em torno do ombro. O raio é encurtado quando o caminho até a
 * câmera cruza chão, casa ou tronco (8 amostras ao longo do raio) e volta devagar:
 *   raio' = damp(raio, livre, livre < raio ? 18 : 3,5)
 *
 * Corpo: `createHero({ preset: 'redHood' })` do kit — corre com a lanterna erguida
 * (`upper: 'hold'`), para e olha em volta, cambaleia ao ser tocada.
 */

import * as THREE from 'three';
import { PLAYER, CAMERA, LANTERN } from './config.js?v=20';
import { clamp, damp } from './utils.js?v=20';
import { createHero } from '../../shared/gfx/hero.js';

const _v = new THREE.Vector3();

export class Player {
    /**
     * @param {THREE.Scene} scene
     * @param {object} fx  { glows, flames } de fx.js
     * @param {{ shadow: boolean, shadowSize: number }} q
     */
    constructor(scene, fx, q) {
        this.hero = createHero({ preset: 'redHood', detail: q.detail ?? 2 });
        this.root = this.hero.object;
        this.root.userData.lanternCaster = true;
        scene.add(this.root);
        this.pose = { mode: 'idle', speed: 0, upper: 'hold', upperAmount: 0, smile: 0, brow: 0, blend: 0.2 };

        // luz da lanterna: PointLight quente com sombra (cubo) + halo + chama
        this.light = new THREE.PointLight(0xffa24a, 0, 18, 1.7);
        this.light.castShadow = q.shadow;
        if (q.shadow) {
            this.light.shadow.mapSize.set(q.shadowSize, q.shadowSize);
            this.light.shadow.camera.near = 0.07;
            this.light.shadow.camera.far = 16;
            this.light.shadow.bias = -0.006;
            this.light.shadow.normalBias = 0.035;
            this.light.shadow.radius = 2;
        }
        scene.add(this.light);
        this.halo = fx.glows.add({ size: 1.5, color: 0xffa860, intensity: 0, flicker: 0.3 });
        this.flame = fx.flames.make(0.09);
        this.flame.visible = false;
        scene.add(this.flame);
        this.lantern = null;
        this.lanternPos = new THREE.Vector3();
        this.lanternOn = true;

        this.x = 0;
        this.y = 0;
        this.z = 0;
        this.vy = 0;
        this.yaw = 0;
        this.facing = 0;
        this.grounded = true;
        this.health = 3;
        this.maxHealth = 3;
        this.invuln = 0;
        this.fuel = PLAYER.fuelMax;
        this.flashT = 0;
        this.footTimer = 0;
        this.alive = true;
        this.camYaw = 0;
        this.camPitch = CAMERA.defaultPitch;
        this.camDist = CAMERA.distance;
        this.camFree = CAMERA.distance;
        this.nearLit = false;
        this.moveSpeed = 0;
        this.hurtT = 0;
        this.time = 0;
        this.info = { footstep: false, flash: false, moving: false };
    }

    /** Carrega a lanterna de madeira e prende na mão direita (mantém o prumo). */
    async equip() {
        const got = await this.hero.equip({ handR: { item: 'lantern', load: { height: 0.3 } } });
        this.lantern = got.handR || null;
        this.lantern?.traverse((o) => {
            if (!o.isMesh) return;
            // a lanterna não faz sombra da própria chama; o vidro acende
            o.castShadow = false;
            if (/glass/i.test(o.material?.name || '')) {
                o.material = o.material.clone();
                o.material.emissive = new THREE.Color(0xff9a3c);
                o.material.emissiveIntensity = 0.6;
                this.glass = o.material;
            }
        });
    }

    spawn(x, z, yaw, heightAt) {
        this.x = x;
        this.z = z;
        this.y = heightAt(x, z);
        this.yaw = yaw;
        this.facing = yaw;
        this.camYaw = yaw + Math.PI;
        this.camPitch = CAMERA.defaultPitch;
        this.camFree = this.camDist;
        this.vy = 0;
        this.health = this.maxHealth;
        this.invuln = 0;
        this.alive = true;
        this.flashT = 0;
        this.moveSpeed = 0;
        this.fuel = PLAYER.fuelMax;
        this.root.visible = true;
        this.lanternOn = true;
        this.sync();
    }

    hurt(amount = 1) {
        if (this.invuln > 0 || !this.alive) return false;
        this.health -= amount;
        this.invuln = PLAYER.invuln;
        this.hurtT = 0.5;
        if (this.health <= 0) {
            this.health = 0;
            this.alive = false;
        }
        return true;
    }

    addFuel(n) {
        this.fuel = clamp(this.fuel + n, 0, PLAYER.fuelMax);
    }

    /**
     * @returns {{footstep: boolean, flash: boolean, moving: boolean}}
     */
    update(dt, input, world, chapter) {
        this.invuln = Math.max(0, this.invuln - dt);
        this.flashT = Math.max(0, this.flashT - dt);

        const look = input.consumeLook();
        this.camYaw -= look.x * 0.0022;
        this.camPitch = clamp(this.camPitch - look.y * 0.0020, CAMERA.pitchMin, CAMERA.pitchMax);
        this.camDist = clamp(this.camDist + input.consumeZoom() * 0.55, CAMERA.minDistance, CAMERA.maxDistance);

        const move = input.move;
        let mx = move.x;
        let mz = move.z;
        const len = Math.hypot(mx, mz);
        if (len > 1) {
            mx /= len;
            mz /= len;
        }

        const speed = move.sprint ? PLAYER.sprint : PLAYER.walk;
        const sin = Math.sin(this.camYaw);
        const cos = Math.cos(this.camYaw);
        const fx = -sin;
        const fz = -cos;
        const rx = cos;
        const rz = -sin;

        const vx = (fx * mz + rx * mx) * speed;
        const vz = (fz * mz + rz * mx) * speed;
        const moving = len > 0.08;

        if (moving) {
            this.facing = Math.atan2(vx, vz);
            this.footTimer += dt * speed;
        } else {
            this.footTimer = 0;
        }

        let nx = this.x + vx * dt;
        let nz = this.z + vz * dt;

        const b = world.bounds;
        nx = clamp(nx, b.minX, b.maxX);
        nz = clamp(nz, b.minZ, b.maxZ);

        const px = this.x;
        const pz = this.z;
        if (!world.blocked(nx, this.z, PLAYER.radius)) this.x = nx;
        if (!world.blocked(this.x, nz, PLAYER.radius)) this.z = nz;
        // velocidade real (depois da colisão) alimenta a animação: encostada na parede, ela para
        const real = Math.hypot(this.x - px, this.z - pz) / Math.max(dt, 1e-4);
        this.moveSpeed = damp(this.moveSpeed, real, 12, dt);

        const ground = world.heightAt(this.x, this.z);
        this.vy -= PLAYER.gravity * dt;
        this.y += this.vy * dt;
        if (this.y <= ground + 0.25) {
            // desce ladeira colada no chão (sem quicar a cada degrau do relevo)
            this.y = ground;
            this.vy = 0;
            this.grounded = true;
        } else {
            this.grounded = false;
        }

        this.nearLit = this._nearLitLamp(world);
        if (chapter?.dark && !this.nearLit) {
            this.fuel = Math.max(0, this.fuel - PLAYER.fuelDrain * dt);
        } else if (!chapter?.dark) {
            this.fuel = Math.min(PLAYER.fuelMax, this.fuel + dt * 4);
        }

        let flashed = false;
        if (input.consumeFlash() && this.flashT <= 0 && this.fuel >= PLAYER.flashCost) {
            this.fuel -= PLAYER.flashCost;
            this.flashT = PLAYER.flashTime;
            flashed = true;
        }

        let dy = this.facing - this.yaw;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        this.yaw += dy * (1 - Math.exp(-PLAYER.turnSpeed * dt));

        this.root.visible = this.invuln <= 0 || Math.sin(this.invuln * 28) > 0;
        this.sync();
        this.animate(dt, this.moveSpeed);

        const footstep = this.footTimer > (move.sprint ? 0.62 : 0.5) * 2.2;
        if (footstep) this.footTimer = 0;
        this.info.footstep = footstep && real > 0.5;
        this.info.flash = flashed;
        this.info.moving = moving;
        return this.info;
    }

    /**
     * Pose do corpo a partir da velocidade no mundo (m/s):
     *   v < 0,3 parada · v < 4,6 trote leve ('run' com passo curto) · acima, corrida.
     * O braço da lanterna fica erguido o tempo todo e sobe mais no pulso.
     */
    animate(dt, speed, extra = null) {
        this.time += dt;
        this.hurtT = Math.max(0, this.hurtT - dt);
        const p = this.pose;
        const pulse = this.flashT > 0 ? Math.sin((1 - this.flashT / PLAYER.flashTime) * Math.PI) : 0;
        if (extra?.mode) {
            p.mode = extra.mode;
            p.speed = extra.speed ?? 0;
            p.upper = extra.upper ?? null;
            p.upperAmount = 0;
        } else if (speed > 0.3) {
            p.mode = speed > 2.4 ? 'run' : 'walk';
            p.speed = speed;
            p.upper = this.lanternOn ? 'hold' : null;
            p.upperAmount = 0.6;
        } else {
            p.mode = this.lanternOn ? 'hold' : 'idle';
            p.speed = 0;
            p.amount = 0;
            p.upper = null;
        }
        if (speed > 0.3) p.amount = undefined;
        p.brow = this.hurtT > 0 ? 0.9 : pulse * 0.5;
        p.jaw = this.hurtT > 0 ? 0.4 : 0;
        this.hero.update(dt, p);
        this._updateLantern(pulse);
    }

    _updateLantern(pulse) {
        const t = this.fuel / PLAYER.fuelMax;
        if (this.lantern && this.lanternOn) {
            this.lantern.getWorldPosition(this.lanternPos);
            this.lanternPos.y += 0.13;
        } else if (this.lanternOn) {
            this.lanternPos.set(this.x, this.y + 0.9, this.z);
        }
        const flick = 1 + 0.045 * Math.sin(this.time * 17.3) + 0.03 * Math.sin(this.time * 29.1 + 1.7);
        const power = this.root.visible || this.invuln > 0 ? 1 : 0;
        const I = (LANTERN.base + t * LANTERN.gain + pulse * LANTERN.flash) * flick * power * this.lightScale;
        this.light.position.copy(this.lanternPos);
        this.light.intensity = I;
        this.light.distance = 9 + t * 9 + pulse * 12;
        this.halo.set(this.lanternPos.x, this.lanternPos.y, this.lanternPos.z);
        this.halo.size = 0.55 + t * 0.45 + pulse * 3.0;
        this.halo.intensity = (0.1 + t * 0.14 + pulse * 0.9) * power * this.lightScale;
        this.halo.push();
        this.flame.visible = power > 0 && this.lightScale > 0.05;
        this.flame.position.copy(this.lanternPos).y -= 0.05;
        const fs = (0.07 + t * 0.045 + pulse * 0.06) * this.lightScale;
        this.flame.scale.set(fs * 0.62, fs, fs * 0.62);
        if (this.glass) this.glass.emissiveIntensity = (0.25 + t * 0.9 + pulse * 2) * this.lightScale;
    }

    _nearLitLamp(world) {
        const r = PLAYER.lampRange;
        for (const lamp of world.lamps || []) {
            if (!lamp.lit) continue;
            if (Math.hypot(this.x - lamp.x, this.z - lamp.z) < r) return true;
        }
        return false;
    }

    sync() {
        this.root.position.set(this.x, this.y, this.z);
        this.root.rotation.y = this.yaw;
    }

    /**
     * Posição desejada da câmera com colisão: amostra o segmento alvo→câmera e
     * encurta o raio no primeiro ponto que entra no chão ou num obstáculo.
     */
    cameraPosition(target, world, dt = 0.016) {
        const cp = this.camPitch;
        const cy = this.camYaw;
        const dx = Math.sin(cy) * Math.cos(cp);
        const dyv = Math.sin(cp);
        const dz = Math.cos(cy) * Math.cos(cp);
        const oy = this.y + CAMERA.height;
        let free = this.camDist;
        if (world) {
            const N = 8;
            for (let i = 1; i <= N; i++) {
                const d = (this.camDist * i) / N;
                const sx = this.x + dx * d;
                const sz = this.z + dz * d;
                const sy = oy + dyv * d;
                if (sy < world.heightAt(sx, sz) + 0.35 || (d > 0.8 && world.blocked(sx, sz, 0.25, sy))) {
                    free = Math.max(1.1, d - this.camDist / N);
                    break;
                }
            }
        }
        this.camFree = damp(this.camFree, free, free < this.camFree ? 18 : 3.5, dt);
        const dist = Math.min(this.camFree, this.camDist);
        target.set(this.x + dx * dist, oy + dyv * dist, this.z + dz * dist);
        if (world) {
            const gy = world.heightAt(target.x, target.z) + 0.4;
            if (target.y < gy) target.y = gy;
        }
        return target;
    }

    lookAt(target) {
        target.set(this.x, this.y + CAMERA.lookY, this.z);
        return target;
    }

    /** Ponto do mundo na altura do peito (para NPCs olharem). */
    chest(target = _v) {
        return target.set(this.x, this.y + 1.0, this.z);
    }
}

Player.prototype.lightScale = 1;
