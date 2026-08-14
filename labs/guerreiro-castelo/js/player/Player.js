/**
 * Dico jogável — vida, tocha, combate leve, animação.
 */

import * as THREE from 'three';
import { CapsuleCollider } from './CapsuleCollider.js';
import { PlayerController } from './PlayerController.js';
import { buildDico, CharacterAnimator, applyLocomotion } from '../characters/builders.js';
import { angleDamp } from '../utils/math.js';

export class Player {
    constructor(scene, collision) {
        const built = buildDico();
        this.root = built.group;
        this.parts = built.parts;
        this.animator = new CharacterAnimator(built.group, built.clips);
        scene.add(this.root);
        this.root.traverse((c) => { if (c.isMesh) c.userData.ignoreCamera = true; });

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
        this.collider = new CapsuleCollider({ radius: 0.32, height: 1.78 });
        this.controller = new PlayerController(this, collision);
        this.footTimer = 0;
        this.parent = scene;
        this._worldPos = new THREE.Vector3();
    }

    attachTo(parent) {
        if (this.root.parent) this.root.parent.remove(this.root);
        parent.add(this.root);
        this.parent = parent;
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
        if (this.parts.torch) this.parts.torch.visible = on;
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
        this.root.getWorldPosition(this._worldPos);
        return this._worldPos;
    }

    sync() {
        this.root.position.copy(this.position);
        this.root.rotation.y = this.facing;
        this.root.scale.setScalar(this.crouching ? 0.92 : 1);
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
        this.facing = angleDamp(this.facing, this.controller.mode === 'walk' ? this.facing : this.facing, 10, dt);
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
            this.parts.torchFlame.scale.setScalar(s);
        }
        this.sync();
        return this._footstep ? (this._footstep = false, true) : false;
    }
}
