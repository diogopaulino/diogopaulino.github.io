/**
 * Dico jogável: movimentação física, animação, combate, lanterna e vida.
 * O corpo é um `createHero` (labs/shared/gfx/hero.js); este arquivo só traduz o
 * estado de jogo para o estado de animação do herói:
 *   parado → idle · andando → walk/run pela velocidade real (o passo não patina)
 *   agachado → sneak · no ar → jump com a fase presa ao tempo de voo
 *   golpe → `upper: 'attack'` sobreposto à locomoção, fase = 1 − attackT/0,42
 *   defesa → block (parado) ou `upper: 'block'` (andando) · leme → mãos à frente
 */

import * as THREE from 'three';
import { PlayerController } from './PlayerController.js?v=40';
import { makeHero } from '../characters/cast.js?v=40';
import { angleDamp } from '../utils/math.js';

const ATTACK_TIME = 0.42;

export class Player {
    constructor(collision) {
        this.hero = makeHero('dico');
        this.root = this.hero.object;
        this.root.userData.keep = true;

        this.position = new THREE.Vector3(0, 0, 0);
        this.facing = 0;
        this.yaw = 0;
        this.speed = 0;
        this.grounded = true;
        this.crouching = false;
        this.sprinting = false;
        this.alive = true;
        this.health = 5;
        this.maxHealth = 5;
        this.invuln = 0;
        this.attackT = 0;
        this.blockT = 0;
        this.interactT = 0;
        this.noise = 0;
        this.torchOn = false;
        this.airT = 0;
        this.collider = { radius: 0.32, height: 1.78, standing: 1.78, crouch: 1.15 };
        this.controller = new PlayerController(this, collision);
        this.footTimer = 0;
        /* pose imposta por cutscene: { mode, upper } ou null */
        this.pose = null;
        this.anim = { mode: 'idle', speed: 0, upper: undefined, upperPhase: 0, phase: undefined, amount: undefined, blend: 0.2 };
        this.items = {};

        /* Luz da lanterna de cinto (masmorra). Sem sombra: acompanha o jogador. */
        this.lamp = new THREE.PointLight(0xffc890, 0, 10, 1.6);
        this.lamp.position.set(0.35, 1.5, 0.5);
        this.root.add(this.lamp);
    }

    /** Espada, escudo e lanterna (glTF) nos sockets do herói. */
    async equip() {
        this.items = await this.hero.equip({ handR: 'sword', handL: 'shield', hipR: 'lantern' });
        if (this.items.hipR) this.items.hipR.visible = this.torchOn;
    }

    /** Em casa Dico guarda as armas. */
    setArmed(on) {
        if (this.items.handR) this.items.handR.visible = on;
        if (this.items.handL) this.items.handL.visible = on;
        this.hero.guardL = on && Boolean(this.items.handL);
    }

    attachTo(parent) {
        parent.add(this.root);
    }

    spawn(x, y, z, yaw = 0) {
        this.position.set(x, y, z);
        this.facing = yaw;
        this.yaw = yaw;
        this.health = this.maxHealth;
        this.alive = true;
        this.invuln = 0;
        this.controller.vx = 0;
        this.controller.vz = 0;
        this.controller.vy = 0;
        this.pose = null;
        this.sync();
    }

    setTorch(on) {
        this.torchOn = on;
        if (this.items.hipR) this.items.hipR.visible = on;
        this.lamp.intensity = on ? 5 : 0;
    }

    hurt(amount = 1) {
        if (this.invuln > 0 || !this.alive) return false;
        if (this.blockT > 0) amount *= 0.35;
        this.health -= amount;
        this.invuln = 0.9;
        if (this.health <= 0) {
            this.health = 0;
            this.alive = false;
        }
        return true;
    }

    heal() {
        this.health = this.maxHealth;
        this.alive = true;
    }

    worldPosition(target) {
        return this.root.getWorldPosition(target);
    }

    sync() {
        this.root.position.copy(this.position);
        this.root.rotation.y = this.facing;
    }

    update(dt, input, camYaw) {
        this.invuln = Math.max(0, this.invuln - dt);
        this.attackT = Math.max(0, this.attackT - dt);
        this.blockT = Math.max(0, this.blockT - dt);
        this.interactT = Math.max(0, this.interactT - dt);

        const free = this.controller.mode === 'walk';
        if (input.attack && this.attackT <= 0 && free) {
            this.attackT = ATTACK_TIME;
            this.swingHit = false;
            input.attack = false;
            this.controller.vx += Math.sin(this.facing) * 3.2;
            this.controller.vz += Math.cos(this.facing) * 3.2;
        }
        if (input.block && free) this.blockT = 0.1;

        const speed = this.controller.update(dt, input, camYaw) ?? 0;
        if (speed > 0.25 && free) {
            this.facing = angleDamp(this.facing, Math.atan2(this.controller.vx, this.controller.vz), 12, dt);
        }

        if (speed > 0.4 && this.grounded) {
            this.footTimer += dt * (this.sprinting ? 3.2 : 2.2);
            if (this.footTimer > 1) {
                this.footTimer = 0;
                this._footstep = true;
            }
        }
        this.airT = this.grounded ? 0 : this.airT + dt;

        const a = this.anim;
        a.upper = undefined;
        a.phase = undefined;
        a.amount = undefined;
        a.speed = speed;
        if (this.pose) {
            a.mode = this.pose.mode;
            a.upper = this.pose.upper;
        } else if (this.controller.mode === 'helm') {
            a.mode = 'idle';
            a.upper = 'carry';
        } else if (!this.alive) {
            a.mode = 'die';
        } else if (!this.grounded && this.airT > 0.12) {
            /* fase do salto: 0,45 (impulso) → 0,8 (antes de aterrissar) em ~0,7 s de voo */
            a.mode = 'jump';
            a.phase = 0.45 + Math.min(0.35, this.airT * 0.5);
        } else if (speed > 0.3) {
            a.mode = this.crouching ? 'sneak' : speed > 4.4 ? 'run' : 'walk';
            if (this.blockT > 0) a.upper = 'block';
        } else if (this.crouching) {
            a.mode = 'sneak';
            a.amount = 0;
        } else {
            a.mode = this.blockT > 0 ? 'block' : 'idle';
        }
        if (this.attackT > 0 && !this.pose) {
            a.upper = 'attack';
            a.upperPhase = 1 - this.attackT / ATTACK_TIME;
        }
        this.hero.update(dt, a);
        /* pisca ao levar dano */
        this.hero.mesh.visible = this.invuln <= 0 || Math.floor(this.invuln * 14) % 2 === 0;

        this.sync();
        return this._footstep ? (this._footstep = false, true) : false;
    }
}
