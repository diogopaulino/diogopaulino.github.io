/**
 * Pool de flechas físicas disparadas por arqueiros em Babylon.js.
 */

import { Pool } from '../utils/pool.js';

export class ArrowSystem {
    constructor(scene) {
        this.scene = scene;
        this.pool = new Pool(() => this._make(), 16);
        this.active = [];
        this.gravity = 18;
        this.colliders = [];
        this.onHitPlayer = null;
    }

    _make() {
        const root = new BABYLON.TransformNode('arrowRoot', this.scene);

        const shaft = BABYLON.MeshBuilder.CreateCylinder('arrowShaft', {
            diameter: 0.03,
            height: 0.6,
            tessellation: 6
        }, this.scene);
        shaft.rotation.x = Math.PI / 2;
        shaft.parent = root;

        const shaftMat = new BABYLON.StandardMaterial('shaftMat', this.scene);
        shaftMat.diffuseColor = new BABYLON.Color3(0.35, 0.22, 0.1);
        shaft.material = shaftMat;

        const tip = BABYLON.MeshBuilder.CreateCylinder('arrowTip', {
            diameterTop: 0,
            diameterBottom: 0.08,
            height: 0.14,
            tessellation: 5
        }, this.scene);
        tip.rotation.x = Math.PI / 2;
        tip.position.z = 0.35;
        tip.parent = root;

        const tipMat = new BABYLON.StandardMaterial('tipMat', this.scene);
        tipMat.diffuseColor = new BABYLON.Color3(0.7, 0.75, 0.8);
        tipMat.specularColor = new BABYLON.Color3(0.8, 0.8, 0.8);
        tip.material = tipMat;

        root.setEnabled(false);

        return {
            root,
            vel: new BABYLON.Vector3(),
            alive: false,
            stuck: 0
        };
    }

    setColliders(meshes) {
        this.colliders = meshes || [];
    }

    fire(origin, direction, speed = 28) {
        const a = this.pool.obtain();
        a.root.position.copyFrom(origin);
        a.root.setEnabled(true);
        a.vel.copyFrom(direction).normalize().scaleInPlace(speed);
        a.alive = true;
        a.stuck = 0;

        const lookTarget = a.root.position.add(a.vel);
        a.root.lookAt(lookTarget);

        this.active.push(a);
        return a;
    }

    update(dt, game) {
        for (let i = this.active.length - 1; i >= 0; i--) {
            const a = this.active[i];
            if (a.stuck > 0) {
                a.stuck -= dt;
                if (a.stuck <= 0) {
                    a.root.setEnabled(false);
                    this.active.splice(i, 1);
                    this.pool.release(a);
                }
                continue;
            }

            a.vel.y -= this.gravity * dt;
            const delta = a.vel.scale(dt);
            const currentPos = a.root.position.clone();
            const nextPos = currentPos.add(delta);

            // Raycast check against colliders
            const rayDir = delta.normalizeToNew();
            const rayDist = BABYLON.Vector3.Distance(currentPos, nextPos);
            const ray = new BABYLON.Ray(currentPos, rayDir, rayDist + 0.1);

            let hit = null;
            if (this.colliders.length) {
                for (const col of this.colliders) {
                    if (!col || !col.isEnabled?.()) continue;
                    const pick = ray.intersectsMesh(col, false);
                    if (pick.hit && (!hit || pick.distance < hit.distance)) {
                        hit = pick;
                    }
                }
            }

            // Check hit player
            const playerPos = game.player.position;
            const playerCenter = new BABYLON.Vector3(playerPos.x, playerPos.y + 0.9, playerPos.z);
            const distToPlayer = BABYLON.Vector3.Distance(nextPos, playerCenter);

            if (distToPlayer < 0.65) {
                this.onHitPlayer?.(1);
                a.stuck = 0.01;
                a.root.setEnabled(false);
                continue;
            }

            if (hit || nextPos.y < 0.02) {
                a.root.position.copyFrom(hit ? hit.pickedPoint : nextPos);
                a.stuck = 2.0;
                game.audio?.play('impact');
                continue;
            }

            a.root.position.copyFrom(nextPos);
            const lookTarget = a.root.position.add(a.vel);
            a.root.lookAt(lookTarget);

            if (a.root.position.length() > 400) {
                a.root.setEnabled(false);
                this.active.splice(i, 1);
                this.pool.release(a);
            }
        }
    }

    clear() {
        for (const a of this.active) {
            a.root.setEnabled(false);
            this.pool.release(a);
        }
        this.active.length = 0;
    }
}
