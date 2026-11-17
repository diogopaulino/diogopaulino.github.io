/**
 * João em terceira pessoa (three.js): movimento relativo à câmera, pulo com
 * coyote e buffer, trepar no caule e pouso em folhas-plataforma.
 *
 * O corpo é um `createHero({ preset: 'villageBoy' })` de gfx/hero.js; aqui só se
 * decide o MODO de animação a partir do estado físico:
 *   no chão parado → idle · andando → walk · correndo → run (fase pela velocidade real)
 *   no ar → fall · no caule → climb (ritmo ∝ |W/S|) · golpe de machado → upper 'attack'
 *
 * Física (inalterada do jogo original):
 *   v_y ← v_y − g·dt (g = 22); soltar o pulo cedo soma 0,55·g (pulo curto)
 *   coyote 0,14 s depois de sair do chão; buffer de pulo 0,12 s
 *   colisão: círculos e caixas orientadas, resolvidas por eixo (desliza nas paredes)
 */

import { PLAYER, CAMERA } from './config.js';
import { clamp, lerpAngle } from './utils.js';
import { createHero } from '../../shared/gfx/hero.js';

const AXIS = { x: 0, z: 0 };

export class Player {
    constructor(scene, detail = 2) {
        this.scene = scene;
        this.hero = createHero({ preset: 'villageBoy', detail, height: 1.32, hair: 0x9a6a30, topColor: 0xe2d8b8, vest: 0x7a3f2a, bottomColor: 0x4a5a3c });
        this.root = this.hero.object;
        scene.add(this.root);
        this.anim = { mode: 'idle', speed: 0, upper: undefined, upperPhase: 0, blend: 0.18 };

        this.x = 0;
        this.y = 0;
        this.z = 0;
        this.vy = 0;
        this.yaw = 0;
        this.facing = 0;
        this.grounded = true;
        this.climbing = false;
        this.health = 3;
        this.maxHealth = 3;
        this.invuln = 0;
        this.footTimer = 0;
        this.alive = true;
        this.camYaw = 0;
        this.camPitch = CAMERA.defaultPitch;
        this.camDist = CAMERA.distance;
        this.coyote = 0;
        this.jumpBuf = 0;
        this.beans = 0;
        this.treasures = { gold: false, hen: false, harp: false };
        this.hasCow = false;
        this.hasAxe = false;
        this.sprinting = false;
        this.speed = 0;      // velocidade horizontal real (m/s) — alimenta a passada
        this.swing = 0;      // s restantes do golpe de machado
        this.visible = true;
    }

    get treasureCount() {
        return Number(this.treasures.gold) + Number(this.treasures.hen) + Number(this.treasures.harp);
    }

    setVisible(v) {
        this.visible = Boolean(v);
        this.root.visible = this.visible;
    }

    spawn(x, z, yaw, heightAt, y) {
        this.x = x;
        this.z = z;
        this.y = y ?? heightAt(x, z);
        this.yaw = yaw;
        this.facing = yaw;
        this.camYaw = yaw + Math.PI;
        this.camPitch = CAMERA.defaultPitch;
        this.vy = 0;
        this.health = this.maxHealth;
        this.invuln = 0;
        this.alive = true;
        this.climbing = false;
        this.grounded = y == null;
        this.speed = 0;
        this.swing = 0;
        this.setVisible(true);
        this.sync();
    }

    hurt(amount = 1) {
        if (this.invuln > 0 || !this.alive) return false;
        this.health -= amount;
        this.invuln = PLAYER.invuln;
        if (this.health <= 0) {
            this.health = 0;
            this.alive = false;
        }
        return true;
    }

    /** Golpe de machado (0,55 s): sobrepõe os braços à locomoção. */
    attack() {
        this.swing = 0.55;
    }

    update(dt, input, world) {
        this.invuln = Math.max(0, this.invuln - dt);
        this.swing = Math.max(0, this.swing - dt);

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
        this.sprinting = Boolean(move.sprint && len > 0.2 && this.grounded);

        if (input.consumeJump()) this.jumpBuf = PLAYER.jumpBuffer;
        else this.jumpBuf = Math.max(0, this.jumpBuf - dt);

        const climb = this._findClimb(world);
        if (climb && !this.climbing && this.jumpBuf > 0) {
            this.climbing = true;
            this.jumpBuf = 0;
            this.grounded = false;
        }
        const wantClimb = Boolean(climb && this.climbing);

        let jumped = false;
        let footstep = false;
        const px = this.x;
        const pz = this.z;

        if (wantClimb && climb) {
            // No caule: o João gira em volta do eixo (A/D) e sobe/desce (W/S). O eixo
            // serpenteia com a altura, então o centro é reavaliado a cada quadro.
            this.grounded = false;
            this.coyote = 0;
            climb.axis(this.y, AXIS);
            const ang = Math.atan2(this.x - AXIS.x, this.z - AXIS.z);
            const newAng = ang + mx * dt * 1.9;
            this.vy = mz * PLAYER.climbSpeed;
            this.y = clamp(this.y + this.vy * dt, climb.yMin, climb.yMax);
            climb.axis(this.y, AXIS);
            const cr = climb.hold(this.y);
            this.x = AXIS.x + Math.sin(newAng) * cr;
            this.z = AXIS.z + Math.cos(newAng) * cr;
            this.facing = newAng + Math.PI;
            this.footTimer += Math.abs(this.vy) * dt;
            if (this.y <= climb.yMin + 0.02 && mz < -0.2) {
                // chegou ao chão descendo: solta sozinho
                this.climbing = false;
                this.grounded = true;
                this.vy = 0;
            } else if (this.jumpBuf > 0 && mz < 0.15) {
                this.climbing = false;
                this.vy = PLAYER.jump * 0.72;
                this.jumpBuf = 0;
                jumped = true;
                const kick = 2.4;
                this.x -= Math.sin(this.facing) * kick * dt * 8;
                this.z -= Math.cos(this.facing) * kick * dt * 8;
            }
        } else {
            this.climbing = false;
            const speed = (move.sprint ? PLAYER.sprint : PLAYER.walk);
            const sin = Math.sin(this.camYaw);
            const cos = Math.cos(this.camYaw);
            const fx = -sin;
            const fz = -cos;
            const rx = cos;
            const rz = -sin;
            const vx = (fx * mz + rx * mx) * speed;
            const vz = (fz * mz + rz * mx) * speed;

            if (len > 0.08) {
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
            if (!this._blocked(nx, this.z, world)) this.x = nx;
            if (!this._blocked(this.x, nz, world)) this.z = nz;

            const ground = this._groundY(world);
            if (this.grounded) this.coyote = PLAYER.coyote;
            else this.coyote = Math.max(0, this.coyote - dt);

            if (this.jumpBuf > 0 && this.coyote > 0) {
                this.vy = PLAYER.jump;
                this.grounded = false;
                this.coyote = 0;
                this.jumpBuf = 0;
                jumped = true;
            }

            this.vy -= PLAYER.gravity * dt;
            if (!input.jumpHeld && this.vy > 1.2) this.vy -= PLAYER.gravity * dt * 0.55;
            this.y += this.vy * dt;

            if (this.vy <= 0 && this.y <= ground) {
                this.y = ground;
                this.vy = 0;
                this.grounded = true;
            } else if (this.grounded && this.vy <= 0 && this.y - ground < 0.35) {
                // descendo ladeira: cola no chão em vez de "voar" a cada desnível
                this.y = ground;
                this.vy = 0;
            } else {
                this.grounded = false;
            }

            if (this.y < world.voidY) {
                return { footstep: false, jumped: false, moving: false, fell: true };
            }
        }

        this.speed = dt > 0 ? Math.hypot(this.x - px, this.z - pz) / dt : 0;
        this.yaw = lerpAngle(this.yaw, this.facing, PLAYER.turnSpeed, dt);
        this._animate(dt, mz);

        this.root.visible = this.visible && !(this.invuln > 0 && Math.sin(this.invuln * 28) <= 0);
        this.sync();

        if (this.climbing) {
            footstep = this.footTimer > 1.1;
        } else {
            footstep = this.grounded && this.footTimer > 2.1;
        }
        if (footstep) this.footTimer = 0;
        return { footstep, jumped, moving: len > 0.08, fell: false, climbing: this.climbing };
    }

    /** Escolhe o modo do herói a partir do estado físico e avança a animação. */
    _animate(dt, climbInput = 0) {
        const a = this.anim;
        if (this.climbing) {
            a.mode = 'climb';
            a.speed = Math.abs(climbInput) * 1.5;
        } else if (!this.grounded) {
            a.mode = 'fall';
            a.speed = 0;
        } else if (this.speed > 6.2) {
            a.mode = 'run';
            a.speed = this.speed;
        } else if (this.speed > 0.35) {
            // a criança anda rápido (5 m/s): acima de 3 m/s já é corridinha
            a.mode = this.speed > 3 ? 'run' : 'walk';
            a.speed = this.speed;
        } else {
            a.mode = 'idle';
            a.speed = 0;
        }
        if (this.swing > 0) {
            a.upper = 'attack';
            a.upperPhase = 1 - this.swing / 0.55;
        } else {
            a.upper = undefined;
        }
        this.hero.update(dt, a);
    }

    /** Animação parada (diálogo, cutscene, pausa): mantém o corpo vivo sem mover. */
    idle(dt, mode = 'idle') {
        this.swing = Math.max(0, this.swing - dt);
        const a = this.anim;
        a.mode = this.climbing ? 'climb' : mode;
        a.speed = 0;
        a.upper = undefined;
        this.hero.update(dt, a);
        this.root.visible = this.visible;
    }

    _groundY(world) {
        let y = world.heightAt(this.x, this.z);
        for (const p of world.platforms) {
            const d = Math.hypot(this.x - p.x, this.z - p.z);
            if (d < p.r && this.y >= p.y - 0.55) y = Math.max(y, p.y);
        }
        return y;
    }

    _findClimb(world) {
        for (const c of world.climbs) {
            if (c.locked) continue;
            if (this.y < c.yMin - 0.6 || this.y > c.yMax + 0.8) continue;
            c.axis(this.y, AXIS);
            if (Math.hypot(this.x - AXIS.x, this.z - AXIS.z) < c.r) return c;
        }
        return null;
    }

    /**
     * Colisores: círculo { x, z, r } ou caixa orientada { box, x, z, hx, hz, cos, sin }.
     * `top` (opcional): só bloqueia quem está abaixo dessa altura (passar por cima de um degrau, por exemplo).
     */
    _blocked(x, z, world) {
        const r = PLAYER.radius;
        for (const c of world.colliders) {
            if (c.top != null && this.y > c.top) continue;
            const dx = x - c.x;
            const dz = z - c.z;
            if (c.box) {
                const lx = dx * c.cos - dz * c.sin;
                const lz = dx * c.sin + dz * c.cos;
                if (Math.abs(lx) < c.hx + r && Math.abs(lz) < c.hz + r) return true;
            } else if (dx * dx + dz * dz < (r + c.r) * (r + c.r)) return true;
        }
        return false;
    }

    sync() {
        this.root.position.set(this.x, this.y, this.z);
        this.root.rotation.y = this.yaw;
    }

    cameraPosition(target) {
        const dist = this.climbing ? this.camDist * 1.5 : this.camDist;
        const cp = this.camPitch;
        const cy = this.camYaw;
        return target.set(
            this.x + Math.sin(cy) * Math.cos(cp) * dist,
            this.y + CAMERA.height + Math.sin(cp) * dist,
            this.z + Math.cos(cy) * Math.cos(cp) * dist
        );
    }

    lookAt(target) {
        return target.set(this.x, this.y + CAMERA.lookY, this.z);
    }
}
