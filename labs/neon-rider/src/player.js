/**
 * Moto do jogador: física SI em physics.js (motor, câmbio, freio, inclinação, círculo de atrito);
 * aqui fica a ponte com a cena — pose interpolada entre passos fixos, pisca de invulnerabilidade,
 * balanço depois da batida e o brilho do néon.
 * A moto avança no eixo −Z (para dentro da câmera padrão).
 */

import { BIKE, ROAD } from './config.js?v=17';
import { BikePhysics, BIKES } from './physics.js?v=17';
import { createBike } from './models.js?v=17';

/** Meia-largura útil (m): a moto encosta no meio-fio sem subir na calçada. */
const HALF = ROAD.halfWidth - 0.45;

export class Player {
    constructor(scene, mats) {
        this.root = createBike(mats);
        scene.add(this.root);
        this.phys = new BikePhysics(BIKES.sport);
        // estado do passo anterior, para interpolar a pose no quadro (passo fixo → tela suave)
        this.prevX = 0;
        this.prevZ = 0;
        this.prevLean = 0;
        this.x = 0;
        this.z = 0;
        this.renderX = 0;
        this.renderZ = 0;
        this.invuln = 0;
        this.wobble = 0;
        this.wobblePhase = 0;
        this.alive = true;
        this.auto = false;
        this.wheelSpin = 0;
        this.blink = 0;
    }

    get speed() { return this.phys.v; }
    get boost() { return this.phys.nitro; }

    reset({ bike, speed = BIKE.startSpeed }) {
        this.phys.setBike(BIKES[bike] || BIKES.sport);
        this.phys.reset(speed);
        this.x = this.prevX = this.renderX = 0;
        this.z = this.prevZ = this.renderZ = 0;
        this.prevLean = 0;
        this.invuln = 0;
        this.wobble = 0;
        this.alive = true;
        this.root.visible = true;
        this.root.position.set(0, 0, 0);
        this.root.rotation.set(0, 0, 0);
        this.root.userData.lean.rotation.z = 0;
    }

    /** Passo fixo da simulação. `c` = { throttle, brake, steer, nitro }. */
    step(h, c) {
        this.prevX = this.x;
        this.prevZ = this.z;
        this.prevLean = this.phys.lean;
        if (!this.alive) {
            // fim de corrida: freio suave até parar, sem esterço
            this.phys.step(h, IDLE_BRAKE, HALF);
        } else {
            this.phys.step(h, c, HALF);
        }
        this.x = this.phys.x;
        this.z = this.phys.z;
        this.invuln = Math.max(0, this.invuln - h);
        this.wobble = Math.max(0, this.wobble - h);
    }

    /**
     * Pose do quadro: interpola entre o passo anterior e o atual (alpha = resto do acumulador / h).
     * dt = tempo real do quadro (para animações puramente visuais).
     */
    render(alpha, dt) {
        const p = this.phys;
        this.renderX = this.prevX + (this.x - this.prevX) * alpha;
        this.renderZ = this.prevZ + (this.z - this.prevZ) * alpha;
        let lean = this.prevLean + (p.lean - this.prevLean) * alpha;
        // balanço amortecido depois da batida (o piloto segura a moto)
        if (this.wobble > 0) {
            this.wobblePhase += dt * 17;
            lean += Math.sin(this.wobblePhase) * 0.22 * (this.wobble / BIKE.invuln);
        }
        this.root.position.set(this.renderX, 0, this.renderZ);
        this.root.userData.lean.rotation.z = -lean;
        // ângulo de rumo: atan(vy / v) — a moto aponta para onde está indo
        this.root.rotation.y = p.v > 1 ? -Math.atan2(p.vy, p.v) : 0;
        // mergulho do garfo/agachamento (transferência de carga, physics.js)
        this.root.rotation.x = -p.pitch;
        this.wheelSpin += (p.v / BIKE.wheelVisualRadius) * dt;
        for (const w of this.root.userData.wheels) w.rotation.x = -this.wheelSpin;

        // invulnerável: pisca a 10 Hz para ficar claro que está "fantasma"
        if (this.invuln > 0) {
            this.blink += dt;
            this.root.visible = Math.floor(this.blink * 10) % 2 === 0 || this.invuln < 0.15;
        } else if (!this.root.visible) {
            this.root.visible = true;
        }

        const glow = this.root.userData.glow;
        glow.material.opacity = Math.min(0.95, 0.28 + p.v / 160 + (p.nitroOn ? 0.3 : 0));
        glow.scale.x = 0.9 + Math.abs(lean) * 1.4;
    }

    /** Batida séria: perde velocidade até a do carro (menos o tranco) e fica invulnerável. */
    crash(carSpeed) {
        this.invuln = BIKE.invuln;
        this.wobble = BIKE.invuln;
        this.blink = 0;
        this.phys.impact(Math.max(4, Math.min(this.phys.v * 0.4, carSpeed * 0.7)));
    }

    /** Raspão lateral: empurra para longe do carro e corta 12 % da velocidade, sem custo de crédito. */
    scrape(dirX) {
        this.wobble = Math.max(this.wobble, 0.6);
        this.phys.impact(this.phys.v * 0.88, dirX * 2.2);
        this.invuln = Math.max(this.invuln, 0.35);
    }

    bounds() {
        return { x: this.x, z: this.z, w: BIKE.width, l: BIKE.length };
    }
}

const IDLE_BRAKE = { throttle: 0, brake: 0.5, steer: 0, nitro: false };
