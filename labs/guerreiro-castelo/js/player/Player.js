/**
 * Dico jogável: movimentação física, animação, combate, lanterna e vida.
 * O corpo é um `createHero` (labs/shared/gfx/hero.js); este arquivo só traduz o
 * estado de jogo para o estado de animação do herói:
 *   parado → idle · andando → walk/run pela velocidade real (o passo não patina)
 *   agachado → sneak · subindo → jump (fase presa ao tempo de voo) · caindo > 0,35 s → fall
 *   golpe → `upper: 'attack'` sobreposto à locomoção, fase = tempo / ATTACK_TIME
 *   defesa → block (parado) ou `upper: 'block'` (andando) · leme → mãos à frente
 *   golpe recebido → 'hit' por 0,32 s
 *
 * Golpe de espada (ATTACK_TIME = 0,46 s), em fases como num jogo de ação:
 *   antecipação 0 → 0,13 s   (espada sobe; dá para ler o golpe)
 *   ativo       0,13 → 0,26 s (a lâmina corta — CombatSystem resolve o acerto aqui)
 *   recuperação 0,26 → 0,46 s (aberto a contra-ataque; mobilidade a 35 %)
 * Apertar atacar na recuperação fica guardado (buffer 0,22 s) e vira o próximo golpe do
 * combo. No ativo o corpo avança 2,4 m/s (passo do golpe).
 *
 * Vida (modo gentil, para crianças também): 5 corações; cada golpe tira 1 (0,35 com
 * defesa) e dá INVULN_TIME (1,0 s) de invulnerabilidade (i-frames, o corpo pisca). Sem
 * levar dano por REGEN_DELAY (5 s), Dico recupera 1 coração a cada REGEN_STEP (3 s).
 */

import * as THREE from 'three';
import { PlayerController } from './PlayerController.js?v=50';
import { makeHero } from '../characters/cast.js?v=50';
import { angleDamp } from '../utils/math.js?v=50';

export const ATTACK_TIME = 0.46;
/** Janela ativa do golpe (s desde o início). */
export const ATTACK_ACTIVE = [0.13, 0.26];
const ATTACK_BUFFER = 0.22;
const LUNGE = 2.4;
const INVULN_TIME = 1.0;
const HIT_TIME = 0.32;
const REGEN_DELAY = 5;
const REGEN_STEP = 3;

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
        this.attackElapsed = 0;
        this.attackBuffer = 0;
        this.blockT = 0;
        this.interactT = 0;
        this.hitT = 0;
        this.noise = 0;
        this.torchOn = false;
        this.airT = 0;
        this.sinceHurt = 99;
        this.regenT = 0;
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
        this.armed = on;
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
        this.attackT = 0;
        this.attackBuffer = 0;
        this.hitT = 0;
        this.sinceHurt = 99;
        const c = this.controller;
        c.vx = 0;
        c.vz = 0;
        c.vy = 0;
        c.stunT = 0;
        c.jumpBuffer = 0;
        this.grounded = true;
        this.pose = null;
        this.sync();
    }

    setTorch(on) {
        this.torchOn = on;
        if (this.items.hipR) this.items.hipR.visible = on;
        this.lamp.intensity = on ? 5 : 0;
    }

    /**
     * Recebe dano. Com (fromX, fromZ) — posição local do agressor — leva um tranco de
     * `push` m/s para longe dele. Devolve false durante os i-frames.
     */
    hurt(amount = 1, fromX, fromZ, push = 0) {
        if (this.invuln > 0 || !this.alive) return false;
        const blocking = this.blockT > 0;
        if (blocking) amount *= 0.35;
        this.health -= amount;
        this.invuln = INVULN_TIME;
        this.sinceHurt = 0;
        this.attackT = 0;
        this.attackBuffer = 0;
        if (!blocking) this.hitT = HIT_TIME;
        if (push > 0 && fromX !== undefined) {
            this.controller.knockback(this.position.x - fromX, this.position.z - fromZ, blocking ? push * 0.5 : push, blocking ? 0.15 : 0.3);
        }
        if (this.health <= 0.01) {
            this.health = 0;
            this.alive = false;
        }
        try { navigator.vibrate?.(blocking ? 20 : 45); } catch { /* sem vibração */ }
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

    /** Golpe no meio da janela ativa e ainda sem resolver? (lido pelo CombatSystem) */
    get swingActive() {
        return this.attackT > 0 && this.attackElapsed >= ATTACK_ACTIVE[0] && this.attackElapsed <= ATTACK_ACTIVE[1];
    }

    update(dt, input, camYaw) {
        this.invuln = Math.max(0, this.invuln - dt);
        this.hitT = Math.max(0, this.hitT - dt);
        this.sinceHurt += dt;
        if (this.alive && this.health < this.maxHealth && this.sinceHurt > REGEN_DELAY) {
            this.regenT += dt;
            if (this.regenT >= REGEN_STEP) {
                this.regenT = 0;
                this.health = Math.min(this.maxHealth, Math.floor(this.health + 1));
            }
        } else {
            this.regenT = 0;
        }
        this.blockT = Math.max(0, this.blockT - dt);
        this.interactT = Math.max(0, this.interactT - dt);
        this.attackBuffer = Math.max(0, this.attackBuffer - dt);

        const c = this.controller;
        const free = c.mode === 'walk' && this.alive && this.armed !== false;
        if (input.attack) {
            input.attack = false;
            if (free) this.attackBuffer = ATTACK_BUFFER;
        }

        if (this.attackT > 0) {
            const before = this.attackElapsed;
            this.attackT = Math.max(0, this.attackT - dt);
            this.attackElapsed = ATTACK_TIME - this.attackT;
            /* passo do golpe: ao entrar na janela ativa o corpo avança */
            if (before < ATTACK_ACTIVE[0] && this.attackElapsed >= ATTACK_ACTIVE[0] && c.stunT <= 0) {
                c.vx += Math.sin(this.facing) * LUNGE;
                c.vz += Math.cos(this.facing) * LUNGE;
            }
        }
        /* começa um golpe novo: livre, sem atordoamento e fora da antecipação/ativo do anterior */
        if (this.attackBuffer > 0 && free && c.stunT <= 0 && this.hitT <= 0 &&
            (this.attackT <= 0 || this.attackElapsed > ATTACK_ACTIVE[1] + 0.06)) {
            this.attackBuffer = 0;
            this.attackT = ATTACK_TIME;
            this.attackElapsed = 0;
            this.swingHit = false;
            /* mira assistida: vira para onde o analógico/teclado aponta, na hora */
            const mx = input.move.x;
            const mz = input.move.z;
            if (Math.hypot(mx, mz) > 0.3) {
                const s = Math.sin(camYaw);
                const co = Math.cos(camYaw);
                this.facing = Math.atan2(-s * -mz + co * mx, -co * -mz - s * mx);
            }
        }
        if (input.block && free && this.attackT <= 0) this.blockT = 0.1;
        /* golpe e defesa travam o passo: mobilidade reduzida (compromisso do ataque) */
        c.moveScale = this.attackT > 0 ? 0.35 : this.blockT > 0 ? 0.45 : 1;

        const speed = c.update(dt, input, camYaw) ?? 0;
        if (speed > 0.25 && c.mode === 'walk' && this.attackT <= 0 && c.stunT <= 0) {
            /* giro suavizado do corpo em direção ao movimento (λ = 12/s) */
            this.facing = angleDamp(this.facing, Math.atan2(c.vx, c.vz), 12, dt);
        }

        if (speed > 0.4 && this.grounded) {
            /* cadência ~ 1,9 passos/s andando, 2,9 trotando/correndo */
            this.footTimer += dt * (speed > 3 ? 2.9 : 1.9);
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
        } else if (c.mode === 'helm') {
            a.mode = 'idle';
            a.upper = 'carry';
        } else if (!this.alive) {
            a.mode = 'die';
        } else if (this.hitT > 0) {
            a.mode = 'hit';
            a.phase = 1 - this.hitT / HIT_TIME;
        } else if (!this.grounded && this.airT > 0.12) {
            if (c.vy < -2 && this.airT > 0.35) {
                a.mode = 'fall';
            } else {
                /* fase do salto: 0,45 (impulso) → 0,8 (antes de aterrissar) */
                a.mode = 'jump';
                a.phase = 0.45 + Math.min(0.35, this.airT * 0.5);
            }
        } else if (speed > 0.3) {
            a.mode = this.crouching ? 'sneak' : speed > 4.2 ? 'run' : 'walk';
            if (this.blockT > 0) a.upper = 'block';
        } else if (this.crouching) {
            a.mode = 'sneak';
            a.amount = 0;
        } else {
            a.mode = this.blockT > 0 ? 'block' : 'idle';
        }
        if (this.attackT > 0 && !this.pose && this.alive) {
            a.upper = 'attack';
            a.upperPhase = this.attackElapsed / ATTACK_TIME;
        }
        this.hero.update(dt, a);
        /* pisca durante os i-frames */
        this.hero.mesh.visible = this.invuln <= 0 || Math.floor(this.invuln * 14) % 2 === 0;

        this.sync();
        return this._footstep ? (this._footstep = false, true) : false;
    }
}
