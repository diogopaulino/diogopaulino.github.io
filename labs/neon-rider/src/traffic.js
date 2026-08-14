/**
 * Trânsito e fitas VHS: pools reciclados à frente da moto.
 * Colisão é AABB no plano XZ — suficiente para um arcade.
 */

import { createCar, createCassette } from './models.js';
import { hash, randRange } from './utils.js';

const LANES = [-5.4, -1.8, 1.8, 5.4];

function aabbHit(a, b) {
    return Math.abs(a.x - b.x) < (a.w + b.w) * 0.5
        && Math.abs(a.z - b.z) < (a.l + b.l) * 0.5;
}

export class Traffic {
    constructor(scene, mats, quality) {
        this.scene = scene;
        this.cars = [];
        this.tapes = [];
        this.difficulty = { traffic: 1, trafficSpeed: 0.55, tapes: 1 };

        const carCount = quality.chunkProps > 0.7 ? 18 : 12;
        for (let i = 0; i < carCount; i++) {
            const car = createCar(mats, i);
            car.visible = false;
            scene.add(car);
            this.cars.push({
                mesh: car,
                x: 0,
                z: 0,
                speed: 20,
                lane: 0,
                live: false,
                w: 1.8,
                l: 4.2
            });
        }

        for (let i = 0; i < 8; i++) {
            const mesh = createCassette(mats);
            mesh.visible = false;
            scene.add(mesh);
            this.tapes.push({
                mesh,
                x: 0,
                z: 0,
                live: false,
                phase: Math.random() * Math.PI * 2
            });
        }
    }

    setDifficulty(diff) {
        this.difficulty = diff;
    }

    reset(playerZ) {
        for (const car of this.cars) this.despawnCar(car);
        for (const tape of this.tapes) this.despawnTape(tape);
        for (let i = 0; i < this.cars.length; i++) {
            this.placeCar(this.cars[i], playerZ - 40 - i * (18 / this.difficulty.traffic));
        }
        for (let i = 0; i < this.tapes.length; i++) {
            this.placeTape(this.tapes[i], playerZ - 30 - i * 42);
        }
    }

    placeCar(car, z) {
        const lane = Math.floor(hash(z * 13.1) * LANES.length);
        car.lane = lane;
        car.x = LANES[lane] + (hash(z * 7.7) - 0.5) * 0.35;
        car.z = z;
        car.speed = 12 + hash(z * 3.1) * 22 * this.difficulty.trafficSpeed;
        car.live = true;
        car.l = car.mesh.userData.length || 4.2;
        car.mesh.visible = true;
        car.mesh.position.set(car.x, 0, car.z);
        car.mesh.rotation.y = Math.PI;
    }

    placeTape(tape, z) {
        const lane = Math.floor(hash(z * 21.3) * LANES.length);
        tape.x = LANES[lane];
        tape.z = z;
        tape.live = true;
        tape.mesh.visible = true;
        tape.mesh.position.set(tape.x, 1.15, tape.z);
    }

    despawnCar(car) {
        car.live = false;
        car.mesh.visible = false;
    }

    despawnTape(tape) {
        tape.live = false;
        tape.mesh.visible = false;
    }

    update(dt, player) {
        const ahead = player.z - 210;
        const behind = player.z + 28;

        for (const car of this.cars) {
            if (!car.live) {
                this.placeCar(car, ahead - randRange(10, 80));
                continue;
            }
            // Mesmo sentido da moto, mais lentos — o jogador os ultrapassa.
            car.z -= car.speed * dt;
            car.mesh.position.set(car.x, 0, car.z);
            if (car.z > behind || car.z < ahead - 40) {
                this.placeCar(car, ahead - randRange(8, 70));
            }
        }

        for (const tape of this.tapes) {
            if (!tape.live) {
                this.placeTape(tape, ahead - randRange(20, 90));
                continue;
            }
            tape.phase += dt * 2.4;
            tape.mesh.position.set(tape.x, 1.05 + Math.sin(tape.phase) * 0.18, tape.z);
            tape.mesh.rotation.y += dt * 1.6;
            if (tape.mesh.userData.reels) {
                for (const reel of tape.mesh.userData.reels) reel.rotation.z += dt * 4;
            }
            if (tape.z > behind) this.placeTape(tape, ahead - randRange(20, 90));
        }
    }

    collideCars(player) {
        const pb = player.bounds();
        for (const car of this.cars) {
            if (!car.live) continue;
            if (aabbHit(pb, { x: car.x, z: car.z, w: car.w, l: car.l })) return car;
        }
        return null;
    }

    collectTapes(player) {
        const pb = { x: player.x, z: player.z, w: 1.6, l: 2.4 };
        const got = [];
        for (const tape of this.tapes) {
            if (!tape.live) continue;
            if (aabbHit(pb, { x: tape.x, z: tape.z, w: 1.1, l: 1.1 })) {
                tape.live = false;
                tape.mesh.visible = false;
                got.push(tape);
            }
        }
        return got;
    }

    /** Desvia a moto no modo atração: olha um pouco à frente e escolhe a faixa livre. */
    autoSteer(player) {
        let best = 0;
        let bestScore = -1e9;
        for (const laneX of LANES) {
            let score = -Math.abs(laneX - player.x) * 0.15;
            for (const car of this.cars) {
                if (!car.live) continue;
                const dz = car.z - player.z;
                if (dz < 2 && dz > -20 && Math.abs(car.x - laneX) < 2.2) score -= 8;
            }
            if (score > bestScore) {
                bestScore = score;
                best = laneX;
            }
        }
        const delta = best - player.x;
        return Math.max(-1, Math.min(1, delta * 0.35));
    }
}
