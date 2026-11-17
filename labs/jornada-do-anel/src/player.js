/**
 * Controlador em terceira pessoa do portador: movimento relativo à câmera,
 * seguimento do relevo, colisão cilíndrica e animação ligada ao estado.
 *
 * Fórmulas:
 *   velocidade   v = (frente·mz + direita·mx) · (andar 4,35 | correr 7,15 m/s) · (1,06 com o Anel)
 *   aceleração   v ← damp(v, alvo, 14/s parado→andando, 10/s ao parar)
 *   giro         yaw ← pelo caminho mais curto, 10/s
 *   golpe        dura 0,5 s; acerta aos 0,2 s quem estiver a ≤ 2,1 m num arco de ±81° (cos > 0,15)
 *   dano         invulnerável por 1,4 s depois de cada golpe sofrido
 */

import * as THREE from 'three';
import { PLAYER, CAMERA } from './config.js?v=30';
import { clamp, damp } from '../../shared/gfx/core.js';
import { makeBearer, turnTo } from './actors.js?v=30';

const ATTACK_TIME = 0.5;
const STRIKE_AT = 0.2;

export class Player {
    constructor(scene) {
        this.hero = makeBearer(2);
        this.root = this.hero.object;
        scene.add(this.root);

        this.x = 0;
        this.y = 0;
        this.z = 0;
        this.vx = 0;
        this.vz = 0;
        this.vy = 0;
        this.yaw = 0;
        this.facing = 0;
        this.grounded = true;
        this.health = 3;
        this.maxHealth = 3;
        this.invuln = 0;
        this.hasRing = false;
        this.attackT = 0;
        this.struck = true;
        this.hurtT = 0;
        this.footTimer = 0;
        this.alive = true;
        this.moving = false;
        this.sprinting = false;
        this.pose = null; // 'sit' | 'die' | null — poses de cena
        this.poseT = 0;
        this.camYaw = 0;
        this.camPitch = CAMERA.defaultPitch;
        this.camDist = CAMERA.distance;
        this.state = { mode: 'idle', speed: 0, upper: undefined, upperPhase: 0, upperAmount: 1, phase: undefined };
        this.info = { footstep: false, attacking: false, strike: false, moving: false };
        this.trample = { x: 0, y: 0, z: 0, radius: 0.8 };
        this.armed = null;
        this.lookTarget = new THREE.Vector3();
    }

    /**
     * Itens por capítulo. `drawn`: espada na mão (capítulos de perigo) ou nas costas.
     * `lantern`: lanterna pendurada no cinto (a luz é do capítulo).
     */
    async equip({ drawn = false, lantern = false } = {}) {
        const key = `${drawn}:${lantern}`;
        if (this.armed === key) return;
        this.armed = key;
        for (const s of ['handR', 'back', 'hipR']) this.hero.detach(s);
        await this.hero.equip({ [drawn ? 'handR' : 'back']: 'sword', ...(lantern ? { hipR: 'lantern' } : {}) });
    }

    spawn(x, z, yaw, heightAt) {
        this.x = x;
        this.z = z;
        this.y = heightAt(x, z);
        this.yaw = yaw;
        this.facing = yaw;
        this.camYaw = yaw + Math.PI;
        this.camPitch = CAMERA.defaultPitch;
        this.vx = this.vz = this.vy = 0;
        this.health = this.maxHealth;
        this.invuln = 0;
        this.alive = true;
        this.attackT = 0;
        this.struck = true;
        this.pose = null;
        this.root.visible = true;
        this.hero.lookAt(null);
        this.sync();
        this.hero.update(0.016, this.state);
    }

    setHasRing(v) {
        this.hasRing = v;
    }

    hurt(amount = 1) {
        if (this.invuln > 0 || !this.alive) return false;
        this.health -= amount;
        this.invuln = PLAYER.invuln;
        this.hurtT = 0.4;
        if (this.health <= 0) {
            this.health = 0;
            this.alive = false;
            this.setPose('die');
        }
        return true;
    }

    setPose(p) {
        this.pose = p;
        this.poseT = 0;
    }

    /**
     * @returns {{footstep: boolean, attacking: boolean, strike: boolean, moving: boolean}}
     */
    update(dt, input, world) {
        const info = this.info;
        info.footstep = info.attacking = info.strike = false;
        this.invuln = Math.max(0, this.invuln - dt);
        this.hurtT = Math.max(0, this.hurtT - dt);

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
        const active = len > 0.08 && !this.pose;
        const top = (move.sprint ? PLAYER.sprint : PLAYER.walk) * (this.hasRing ? 1.06 : 1) * Math.min(1, len);
        const sin = Math.sin(this.camYaw);
        const cos = Math.cos(this.camYaw);
        // Frente da câmera no XZ (do jogador para longe da câmera).
        const tvx = active ? (-sin * mz + cos * mx) / (len > 1 ? 1 : len || 1) * top : 0;
        const tvz = active ? (-cos * mz - sin * mx) / (len > 1 ? 1 : len || 1) * top : 0;
        const k = active ? 14 : 10;
        this.vx = damp(this.vx, tvx, k, dt);
        this.vz = damp(this.vz, tvz, k, dt);
        const speed = Math.hypot(this.vx, this.vz);
        this.moving = speed > 0.4;
        this.sprinting = this.moving && move.sprint && speed > PLAYER.walk + 0.6;

        if (active) this.facing = Math.atan2(tvx, tvz);
        if (this.moving) this.footTimer += dt * speed;
        else this.footTimer = 0;

        let nx = this.x + this.vx * dt;
        let nz = this.z + this.vz * dt;
        const b = world.bounds;
        nx = clamp(nx, b.minX, b.maxX);
        nz = clamp(nz, b.minZ, b.maxZ);
        if (!world.blockedAt(nx, this.z, PLAYER.radius)) this.x = nx;
        else this.vx = 0;
        if (!world.blockedAt(this.x, nz, PLAYER.radius)) this.z = nz;
        else this.vz = 0;

        const ground = world.heightAt(this.x, this.z);
        this.vy -= PLAYER.gravity * dt;
        this.y += this.vy * dt;
        if (this.y <= ground) {
            // degraus sobem suave; queda livre só quando o chão some
            this.y = ground - this.y > 0.02 ? damp(this.y, ground, 30, dt) : ground;
            if (ground - this.y < 0.02) this.y = ground;
            this.vy = 0;
            this.grounded = true;
        } else {
            this.grounded = this.y - ground < 0.25;
            if (this.grounded && this.vy < 0 && this.y - ground < 0.12) {
                this.y = ground;
                this.vy = 0;
            }
        }

        if (this.attackT > 0) {
            this.attackT = Math.max(0, this.attackT - dt);
            if (!this.struck && ATTACK_TIME - this.attackT >= STRIKE_AT) {
                this.struck = true;
                info.strike = true;
            }
        }
        if (!this.pose && input.consumeAttack() && this.attackT <= 0) {
            this.attackT = ATTACK_TIME;
            this.struck = false;
            info.attacking = true;
        }

        this.yaw = turnTo(this.yaw, this.facing, Math.min(1, PLAYER.turnSpeed * dt));
        this.animate(dt, speed);
        this.root.visible = this.invuln <= 0 || !this.alive || Math.sin(this.invuln * 28) > -0.2;
        this.sync();

        info.footstep = this.footTimer > 1.5 && this.grounded;
        if (info.footstep) this.footTimer = 0;
        info.moving = this.moving;
        return info;
    }

    /** Liga o estado de jogo ao herói (mistura de modos é do kit). */
    animate(dt, speed = 0) {
        const st = this.state;
        st.upper = undefined;
        st.phase = undefined;
        if (this.pose) {
            this.poseT += dt;
            st.mode = this.pose;
            st.speed = 0;
            if (this.pose === 'die') st.phase = Math.min(1, this.poseT / 1.2);
        } else {
            if (!this.grounded && this.vy < -4) st.mode = 'fall';
            else if (speed > PLAYER.walk + 0.9) st.mode = 'run';
            else if (speed > 0.4) st.mode = 'walk';
            else st.mode = 'idle';
            st.speed = speed;
            if (this.attackT > 0) {
                st.upper = 'attack';
                st.upperPhase = 1 - this.attackT / ATTACK_TIME;
                st.upperAmount = 1;
            } else if (this.hurtT > 0) {
                st.upper = 'hit';
                st.upperPhase = 1 - this.hurtT / 0.4;
                st.upperAmount = 1;
            }
        }
        this.hero.update(dt, st);
    }

    sync() {
        this.root.position.set(this.x, this.y, this.z);
        this.root.rotation.y = this.yaw;
        this.trample.x = this.x;
        this.trample.y = this.y;
        this.trample.z = this.z;
    }

    /** Posição desejada da câmera (antes da colisão) para uma distância `dist`. */
    cameraPosition(target, dist = this.camDist) {
        const cp = this.camPitch;
        const cy = this.camYaw;
        target.set(
            this.x + Math.sin(cy) * Math.cos(cp) * dist,
            this.y + CAMERA.height + Math.sin(cp) * dist,
            this.z + Math.cos(cy) * Math.cos(cp) * dist
        );
        return target;
    }

    lookAt(target) {
        target.set(this.x, this.y + CAMERA.lookY, this.z);
        return target;
    }

    attackHit(npcs, range = 2.1) {
        const hits = [];
        const fx = Math.sin(this.yaw);
        const fz = Math.cos(this.yaw);
        for (const n of npcs) {
            if (!n.alive) continue;
            const dx = n.x - this.x;
            const dz = n.z - this.z;
            const d = Math.hypot(dx, dz);
            if (d > range) continue;
            const dot = (dx * fx + dz * fz) / (d || 1);
            if (dot > 0.15) hits.push(n);
        }
        return hits;
    }
}
