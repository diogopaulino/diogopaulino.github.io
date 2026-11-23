/**
 * Controlador em terceira pessoa do portador (halfling de ~1,1 m): movimento
 * relativo à câmera, pulo, degraus, colisão cilíndrica e animação ligada ao
 * estado. Constantes e fórmulas em config.js (PLAYER).
 *
 * Resumo das regras (unidades SI):
 *   alvo         analógico < 0,6 → caminhada proporcional; ≥ 0,6 → caminhada…trote;
 *                Shift/"correr" → corrida (4,5 m/s)
 *   aceleração   v ← v + (alvo − v)·(1 − e^(−k·dt)); k = 9 acelerando, 12 freando,
 *                6 invertendo; no ar k × 0,35
 *   giro         yaw → direção pedida pelo caminho mais curto, 14/s parado … 7/s correndo
 *   pulo         v₀ = √(2·g·h); g↓ = 1,55·g na descida; soltar cedo: vy × 0,45
 *                coyote 0,1 s · buffer 0,12 s · terminal 16 m/s
 *   degraus      anda para (x,z) só se chão_novo − pés ≤ 0,5 m (acima disso é parede:
 *                pulando, os pés sobem e a beirada passa a caber)
 *   golpe        dura 0,5 s; acerta aos 0,2 s quem estiver a ≤ 1,9 m num arco de ±81°
 *   dano         invulnerável por 1,4 s depois de cada golpe sofrido
 */

import * as THREE from 'three';
import { PLAYER, CAMERA } from './config.js?v=32';
import { clamp, damp } from '../../shared/gfx/core.js';
import { makeBearer, turnTo } from './actors.js?v=32';

const ATTACK_TIME = 0.5;
const STRIKE_AT = 0.2;
/** tempo de "aterrissagem pesada" (s) depois de cair com |vy| > 7 m/s */
const LAND_TIME = 0.2;

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
        this.speed = 0;
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
        /** pedindo movimento (para detectar "preso") */
        this.wantsMove = false;
        this.coyoteT = 0;
        this.bufferT = 0;
        this.jumping = false;
        this.airT = 0;
        this.landT = 0;
        this.pose = null; // 'sit' | 'die' | null — poses de cena
        this.poseT = 0;
        this.camYaw = 0;
        this.camPitch = CAMERA.defaultPitch;
        this.camDist = CAMERA.distance;
        this.state = { mode: 'idle', speed: 0, upper: undefined, upperPhase: 0, upperAmount: 1, phase: undefined, blend: 0.16 };
        this.info = { footstep: false, attacking: false, strike: false, moving: false, jump: false, land: false };
        this.trample = { x: 0, y: 0, z: 0, radius: 0.7 };
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
        this.health = this.maxHealth;
        this.alive = true;
        this.pose = null;
        this.root.visible = true;
        this.hero.lookAt(null);
        this.stop();
        this.sync();
        this.hero.update(0.016, this.state);
    }

    /** Zera velocidades, pulo e golpe (respawn, cena, teleporte). */
    stop() {
        this.vx = this.vz = this.vy = 0;
        this.speed = 0;
        this.grounded = true;
        this.jumping = this.jumpAnim = false;
        this.coyoteT = this.bufferT = this.airT = this.landT = 0;
        this.invuln = 0;
        this.attackT = 0;
        this.struck = true;
        this.moving = this.sprinting = this.wantsMove = false;
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
     * Pode ocupar (x, z)? Colisor cilíndrico + regra do degrau: o chão de lá não
     * pode estar mais de `stepUp` acima dos pés (`ref`).
     */
    _free(world, x, z, ref) {
        if (world.blockedAt(x, z, PLAYER.radius)) return false;
        return world.heightAt(x, z) - ref <= PLAYER.stepUp;
    }

    /**
     * @returns {{footstep: boolean, attacking: boolean, strike: boolean, moving: boolean, jump: boolean, land: boolean}}
     */
    update(dt, input, world) {
        const info = this.info;
        info.footstep = info.attacking = info.strike = info.jump = info.land = false;
        this.invuln = Math.max(0, this.invuln - dt);
        this.hurtT = Math.max(0, this.hurtT - dt);
        this.landT = Math.max(0, this.landT - dt);

        // ---- intenção (relativa à câmera) ----
        const move = input.move;
        let mx = move.x;
        let mz = move.z;
        let len = Math.hypot(mx, mz);
        if (len > 1) {
            mx /= len;
            mz /= len;
            len = 1;
        }
        const active = len > 0.12 && !this.pose && this.alive;
        this.wantsMove = active && len > 0.3;
        let top = 0;
        if (active) {
            if (move.sprint) top = PLAYER.sprint * Math.max(0.6, len);
            else if (len < 0.6) top = PLAYER.walk * (len / 0.6);
            else top = PLAYER.walk + (PLAYER.jog - PLAYER.walk) * ((len - 0.6) / 0.4);
            if (this.landT > 0) top *= 0.45; // recompõe a postura depois de uma queda alta
            if (this.attackT > 0 && this.grounded) top *= 0.55; // golpe trava um pouco o passo
        }
        const sin = Math.sin(this.camYaw);
        const cos = Math.cos(this.camYaw);
        // frente da câmera no XZ (do portador para longe da câmera) e direita da tela
        const dx = active ? (-sin * mz + cos * mx) / len : 0;
        const dz = active ? (-cos * mz - sin * mx) / len : 0;
        const tvx = dx * top;
        const tvz = dz * top;

        // ---- aceleração exponencial ----
        let k;
        if (!active) k = PLAYER.decel;
        else if (this.vx * tvx + this.vz * tvz < 0) k = PLAYER.reverse;
        else k = PLAYER.accel;
        if (!this.grounded) k *= PLAYER.airControl;
        this.vx = damp(this.vx, tvx, k, dt);
        this.vz = damp(this.vz, tvz, k, dt);
        const speed = Math.hypot(this.vx, this.vz);
        this.speed = speed;
        this.moving = speed > 0.3;
        this.sprinting = this.moving && move.sprint && speed > PLAYER.jog + 0.4;

        // giro do corpo: mais rápido parado, arco mais aberto em corrida
        if (active) this.facing = Math.atan2(dx, dz);
        const turn = PLAYER.turnSlow + (PLAYER.turnFast - PLAYER.turnSlow) * clamp(speed / PLAYER.sprint, 0, 1);
        this.yaw = turnTo(this.yaw, this.facing, 1 - Math.exp(-turn * (this.grounded ? 1 : 0.5) * dt));

        // ---- pulo: coyote + buffer + altura variável ----
        if (this.grounded) this.coyoteT = PLAYER.coyote;
        else this.coyoteT = Math.max(0, this.coyoteT - dt);
        if (input.consumeJump()) this.bufferT = PLAYER.jumpBuffer;
        else this.bufferT = Math.max(0, this.bufferT - dt);
        if (this.bufferT > 0 && this.coyoteT > 0 && !this.pose && this.alive && this.landT < 0.08) {
            this.vy = Math.sqrt(2 * PLAYER.gravity * PLAYER.jumpHeight);
            this.grounded = false;
            this.jumping = true;
            this.coyoteT = this.bufferT = 0;
            this.airT = 0;
            info.jump = true;
            this.jumpAnim = true;
        }
        if (this.jumping && this.vy > 0 && !input.jumpHeld) {
            this.vy *= PLAYER.jumpCut; // soltou cedo: pulo baixinho
            this.jumping = false;
        }
        if (this.vy <= 0) this.jumping = false;

        // ---- horizontal: eixo a eixo (desliza ao longo de paredes) ----
        const b = world.bounds;
        const hereG = world.heightAt(this.x, this.z);
        const ref = this.grounded ? Math.max(this.y, hereG) : this.y;
        const nx = clamp(this.x + this.vx * dt, b.minX, b.maxX);
        const nz = clamp(this.z + this.vz * dt, b.minZ, b.maxZ);
        if (nx !== this.x) {
            if (this._free(world, nx, this.z, ref)) this.x = nx;
            else this.vx *= 0.2;
        }
        if (nz !== this.z) {
            if (this._free(world, this.x, nz, ref)) this.z = nz;
            else this.vz *= 0.2;
        }

        // ---- vertical ----
        const wasGrounded = this.grounded;
        const ground = world.heightAt(this.x, this.z);
        const g = this.vy > 0 ? PLAYER.gravity : PLAYER.gravity * PLAYER.fallGravity;
        this.vy = Math.max(this.vy - g * dt, -PLAYER.terminal);
        this.y += this.vy * dt;
        if (this.y <= ground) {
            if (!wasGrounded) {
                // aterrissou: impacto alto = postura pesada curta + passo audível
                if (this.vy < -7) this.landT = LAND_TIME;
                if (this.vy < -3) info.land = true;
            }
            // degrau: sobe suave (pés não "teleportam" 0,5 m num quadro)
            this.y = ground - this.y > 0.03 && wasGrounded ? Math.min(ground, damp(this.y, ground, 28, dt)) : ground;
            this.vy = 0;
            this.grounded = true;
            this.airT = 0;
            this.jumpAnim = false;
        } else if (wasGrounded && this.vy <= 0 && this.y - ground <= PLAYER.snapDown) {
            // descida de rampa/degrau: cola no chão em vez de "quicar"
            this.y = ground;
            this.vy = 0;
            this.grounded = true;
        } else {
            this.grounded = false;
            this.airT += dt;
        }

        // ---- golpe ----
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

        if (this.moving && this.grounded) this.footTimer += dt * speed;
        else if (!this.moving) this.footTimer = 0;

        this.animate(dt, speed);
        this.root.visible = this.invuln <= 0 || !this.alive || Math.sin(this.invuln * 28) > -0.2;
        this.sync();

        // passo a cada ~0,9 m (passada do halfling)
        info.footstep = this.footTimer > 0.9 && this.grounded;
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
            if (!this.grounded && this.jumpAnim && this.airT < 0.9) {
                // no ar depois de pular: 0,42 impulso → 0,78 pronto para aterrissar
                st.mode = 'jump';
                st.phase = this.vy > 0 ? 0.42 + 0.2 * clamp(this.airT / 0.25, 0, 1) : 0.62 + 0.16 * clamp(-this.vy / 6, 0, 1);
            } else if (!this.grounded && this.vy < -4) st.mode = 'fall';
            else if (this.landT > 0) {
                st.mode = 'jump';
                st.phase = 0.8 + 0.2 * (1 - this.landT / LAND_TIME);
            } else if (speed > PLAYER.jog + 0.3) st.mode = 'run';
            else if (speed > 0.25) st.mode = speed > PLAYER.walk + 0.5 ? 'run' : 'walk';
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

    /**
     * Posição desejada da câmera (antes da colisão) em órbita do pivô.
     * `pivot` (opcional) = ponto suavizado que a câmera segue; padrão = cabeça do portador.
     */
    cameraPosition(target, dist = this.camDist, pivot = null) {
        const cp = this.camPitch;
        const cy = this.camYaw;
        const px = pivot ? pivot.x : this.x;
        const py = pivot ? pivot.y : this.y + CAMERA.pivotY;
        const pz = pivot ? pivot.z : this.z;
        target.set(
            px + Math.sin(cy) * Math.cos(cp) * dist,
            py + Math.sin(cp) * dist,
            pz + Math.cos(cy) * Math.cos(cp) * dist
        );
        return target;
    }

    lookAt(target) {
        target.set(this.x, this.y + CAMERA.pivotY, this.z);
        return target;
    }

    attackHit(npcs, range = 1.9) {
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
