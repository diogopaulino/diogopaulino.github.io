/**
 * Controlador de movimento do guerreiro: velocidade-alvo, inércia, gravidade, pulo,
 * corrida e agachar. Unidades SI (m, s, m/s, m/s²); Dico tem ~1,78 m.
 *
 * Velocidades-alvo (humano adulto com espada e escudo):
 *   agachado 1,5 m/s · andando 1,6 m/s (analógico pouco inclinado) · trote 4,6 m/s
 *   (teclado / analógico cheio) · corrida 6,6 m/s (Shift / botão Correr)
 *   No analógico a velocidade cresce com a inclinação: alvo = lerp(andar, trote, k),
 *   k = (|stick| − 0,15) / 0,85 — o passo nunca patina.
 *
 * Inércia (aproximação exponencial, independente do fps):
 *   v ← v + (alvo − v)·(1 − e^(−λ·dt))
 *   λ chão: 10/s acelerando (95 % em 0,3 s) · 12/s freando
 *   λ ar: 35 % do chão (controle aéreo reduzido)
 *   λ atordoado (empurrão de golpe): 15 % — o tranco carrega o corpo por ~0,3 s
 *
 * Pulo (altura h ≈ 1,0 m):
 *   g subindo = 24 m/s² → v0 = √(2·g·h) ≈ 6,9 m/s
 *   g caindo = 36 m/s² (queda mais pesada que a subida) · soltar o pulo cedo corta a
 *   subida (g ×2,4) · velocidade terminal 30 m/s
 *   coyote time 0,1 s (ainda pula logo depois de sair da borda)
 *   jump buffer 0,12 s (apertou um pouco antes de tocar o chão → pula ao aterrissar)
 */

import { clamp } from '../utils/math.js?v=50';

const WALK = 1.6;
const JOG = 4.6;
const SPRINT = 6.6;
const CROUCH = 1.5;
const ACCEL = 10;
const DECEL = 12;
const AIR_CONTROL = 0.35;
const STUN_CONTROL = 0.15;
const G_UP = 24;
const G_DOWN = 36;
const JUMP_CUT = 2.4;
const JUMP_HEIGHT = 1.0;
const TERMINAL = 30;
const COYOTE = 0.1;
const BUFFER = 0.12;

export class PlayerController {
    constructor(player, collision) {
        this.player = player;
        this.collision = collision;
        /* mantidos públicos para depuração (__lab) e níveis que leiam o ritmo */
        this.walkSpeed = WALK;
        this.runSpeed = JOG;
        this.sprintSpeed = SPRINT;
        this.crouchSpeed = CROUCH;
        this.jumpSpeed = Math.sqrt(2 * G_UP * JUMP_HEIGHT);
        this.vx = 0;
        this.vz = 0;
        this.vy = 0;
        this.mode = 'walk';
        this.coyote = 0;
        this.jumpBuffer = 0;
        this.jumping = false;
        /* empurrão (golpe recebido): reduz o controle por stunT segundos */
        this.stunT = 0;
        /* fator de mobilidade imposto pelo golpe (0,35 durante a espada) */
        this.moveScale = 1;
    }

    setMode(mode) {
        this.mode = mode;
        this.jumpBuffer = 0;
        this.coyote = 0;
    }

    /** Tranco horizontal (m/s) na direção (dx, dz); atordoa por `stun` s. */
    knockback(dx, dz, speed, stun = 0.3) {
        const len = Math.hypot(dx, dz) || 1;
        this.vx = (dx / len) * speed;
        this.vz = (dz / len) * speed;
        if (this.player.grounded) this.vy = Math.max(this.vy, 2.2);
        this.stunT = Math.max(this.stunT, stun);
    }

    update(dt, input, camYaw) {
        const p = this.player;
        if (this.mode === 'helm' || this.mode === 'locked') {
            this.vx = 0;
            this.vz = 0;
            this.vy = 0;
            p.speed = 0;
            p.sprinting = false;
            p.crouching = false;
            p.noise = 0.05;
            input.move.jump = false;
            return 0;
        }
        this.stunT = Math.max(0, this.stunT - dt);

        const crouch = Boolean(input.move.crouch && p.grounded);
        p.collider.height = crouch ? p.collider.crouch : p.collider.standing;
        p.crouching = crouch;

        /* intensidade do comando: teclado = 1; analógico = inclinação */
        const mag = Math.min(1, Math.hypot(input.move.x, input.move.z));
        let wish = 0;
        if (mag > 0.08) {
            if (crouch) wish = CROUCH;
            else if (input.move.sprint) wish = SPRINT;
            else wish = WALK + (JOG - WALK) * clamp((mag - 0.15) / 0.85, 0, 1);
        }
        wish *= this.moveScale;

        /* direção relativa à câmera: frente = −(sin ψ, cos ψ), direita = (cos ψ, −sin ψ) */
        const sin = Math.sin(camYaw);
        const cos = Math.cos(camYaw);
        const wishX = -sin * -input.move.z + cos * input.move.x;
        const wishZ = -cos * -input.move.z - sin * input.move.x;
        const wlen = Math.hypot(wishX, wishZ);
        const tx = wlen > 0.001 ? (wishX / wlen) * wish : 0;
        const tz = wlen > 0.001 ? (wishZ / wlen) * wish : 0;

        let rate = wish > 0 ? ACCEL : DECEL;
        if (!p.grounded) rate *= AIR_CONTROL;
        if (this.stunT > 0) rate *= STUN_CONTROL;
        const k = 1 - Math.exp(-rate * dt);
        this.vx += (tx - this.vx) * k;
        this.vz += (tz - this.vz) * k;

        /* pulo: buffer + coyote time */
        if (input.move.jump) this.jumpBuffer = BUFFER;
        input.move.jump = false;
        this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
        this.coyote = p.grounded ? COYOTE : Math.max(0, this.coyote - dt);
        if (this.jumpBuffer > 0 && this.coyote > 0 && !crouch && this.stunT <= 0) {
            this.vy = this.jumpSpeed;
            this.jumpBuffer = 0;
            this.coyote = 0;
            this.jumping = true;
            p.grounded = false;
        }

        /* gravidade assimétrica + corte do pulo variável */
        let g = this.vy > 0 ? G_UP : G_DOWN;
        if (this.vy > 0 && this.jumping && !input.move.jumpHeld) g *= JUMP_CUT;
        this.vy = Math.max(-TERMINAL, this.vy - g * dt);
        const y = p.position.y + this.vy * dt;

        const res = this.collision.resolveCapsule(
            p.position.x, y, p.position.z,
            p.collider.radius, p.collider.height,
            this.vx, this.vz, dt, 0.42
        );

        p.position.set(res.x, res.y, res.z);
        p.grounded = res.grounded;
        if (res.grounded && this.vy < 0) {
            this.vy = 0;
            this.jumping = false;
        }
        if (y < res.y && this.vy < 0) this.vy = 0;

        const speed = Math.hypot(this.vx, this.vz);
        p.speed = speed;
        p.sprinting = speed > 5.2 && input.move.sprint && !crouch;
        p.noise = crouch ? 0.22 : speed > 5.2 ? 1.35 : speed > 3 ? 0.85 : speed > 0.2 ? 0.55 : 0.05;
        return speed;
    }
}
