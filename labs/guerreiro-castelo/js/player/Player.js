/**
 * Dico jogável: movimentação física, animação, combate, tocha e vida em Babylon.js.
 */

import { CapsuleCollider } from './CapsuleCollider.js';
import { PlayerController } from './PlayerController.js';
import { buildDico, CharacterAnimator, applyLocomotion } from '../characters/builders.js';
import { angleDamp } from '../utils/math.js';

export class Player {
    constructor(scene, collision) {
        this.scene = scene;
        const built = buildDico(scene);
        this.root = built.root;
        this.parts = built.parts;
        this.animator = new CharacterAnimator(built.root, built.clips);

        this.position = new BABYLON.Vector3(0, 0, 0);
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
        this.collider = new CapsuleCollider({ radius: 0.32, height: 1.78 });
        this.controller = new PlayerController(this, collision);
        this.footTimer = 0;
        this._worldPos = new BABYLON.Vector3();
    }

    attachTo(parent) {
        this.root.parent = parent;
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
        this.sync();
    }

    setTorch(on) {
        this.torchOn = on;
        if (this.parts.torch) {
            this.parts.torch.setEnabled(on);
        }
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

    worldPosition() {
        return this.root.getAbsolutePosition();
    }

    sync() {
        this.root.position.copyFrom(this.position);
        this.root.rotation.y = this.facing;
        const scale = this.crouching ? 0.92 : 1.0;
        this.root.scaling.set(scale, scale, scale);
    }

    update(dt, input, camYaw) {
        this.invuln = Math.max(0, this.invuln - dt);
        this.attackT = Math.max(0, this.attackT - dt);
        this.blockT = Math.max(0, this.blockT - dt);
        this.interactT = Math.max(0, this.interactT - dt);

        if (input.attack && this.attackT <= 0) {
            this.attackT = 0.45;
            input.attack = false;
        }
        if (input.block) this.blockT = 0.1;

        const speed = this.controller.update(dt, input, camYaw) ?? 0;
        this.facing = angleDamp(this.facing, this.facing, 10, dt);
        if (speed > 0.25 && this.controller.mode === 'walk') {
            this.facing = angleDamp(this.facing, Math.atan2(this.controller.vx, this.controller.vz), 12, dt);
        }

        if (speed > 0.4 && this.grounded) {
            this.footTimer += dt * (this.sprinting ? 3.2 : 2.2);
            if (this.footTimer > 1) {
                this.footTimer = 0;
                this._footstep = true;
            }
        }

        applyLocomotion(
            this.animator,
            speed,
            this.crouching,
            this.grounded,
            this.attackT > 0.1,
            this.blockT > 0,
            this.interactT > 0
        );
        this.animator.update(dt);

        if (this.parts.torchFlame) {
            const s = 0.9 + Math.sin(performance.now() * 0.012) * 0.15;
            this.parts.torchFlame.scaling.set(s, s, s);
        }

        this.sync();
        return this._footstep ? (this._footstep = false, true) : false;
    }
}
