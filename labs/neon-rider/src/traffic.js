/**
 * Trânsito e fitas VHS: pools reciclados à frente da moto, em metros e m/s.
 *
 * REGRAS DO TRÂNSITO
 *   • Todos no mesmo sentido da moto, 40–80 km/h conforme a dificuldade (config.js#DIFFICULTY).
 *     Faixa da esquerda +15 %, da direita −15 % (como numa avenida de verdade).
 *   • Seguir o carro da frente (modelo de distância segura simplificado):
 *       gap_desejado = 6 m + 1,4 s · v
 *     Se o vão é menor, o carro freia até a velocidade do líder (≤ 4 m/s², 8 m/s² se o líder é a
 *     moto muito perto); se maior, retoma a velocidade de cruzeiro (≤ 1,5 m/s²). A moto também conta como líder: carro nenhum
 *     acerta a moto por trás — se você para, o trânsito para atrás de você.
 *   • Troca de faixa: entre 50 e 160 m à frente da moto, com chance `shift`/s. A seta pisca 0,9 s
 *     antes; a manobra leva 2,6 s em perfil cosseno (pico ~2,2 m/s de lateral). Nunca para uma
 *     faixa com carro a menos de 14 m.
 *   • Justiça: num trecho de 16 m cabem no máximo 2 carros (sempre há 2 faixas livres).
 *   • Colisão AABB no plano XZ (caixa do carro × caixa da moto).
 */

import * as THREE from 'three';
import { createCar, createCassette } from './models.js?v=17';
import { hash, randRange } from './utils.js?v=17';

const LANES = [-5.4, -1.8, 1.8, 5.4];
const LANE_SPEED = [1.15, 1.05, 0.95, 0.85];
const KMH = 3.6;
/** Horizonte de spawn à frente da moto (m) e limite atrás (m). */
const AHEAD = 260;
const BEHIND = 30;
const SHIFT_TIME = 2.6;
const SIGNAL_TIME = 0.9;

function aabbHit(a, bx, bz, bw, bl) {
    return Math.abs(a.x - bx) < (a.w + bw) * 0.5
        && Math.abs(a.z - bz) < (a.l + bl) * 0.5;
}

export class Traffic {
    constructor(scene, mats, quality) {
        this.scene = scene;
        this.cars = [];
        this.tapes = [];
        this.difficulty = { density: 2, kmh: [45, 70], shift: 0.1, tapes: 1 };
        this.active = 0;
        this.activeTapes = 4;

        // seta: um material âmbar compartilhado, dois quadradinhos por carro
        this.signalMat = new THREE.MeshBasicMaterial({ color: 0xffa31a, toneMapped: false });
        const signalGeo = new THREE.BoxGeometry(0.2, 0.12, 0.06);

        const carCount = quality.chunkProps > 0.7 ? 18 : 14;
        for (let i = 0; i < carCount; i++) {
            const car = createCar(mats, i);
            car.visible = false;
            // carro gira π: o +x local vira −x do mundo e a traseira fica em −z local
            const half = (car.userData.length || 4.2) / 2;
            const sigL = new THREE.Mesh(signalGeo, this.signalMat);
            sigL.position.set(0.78, 0.62, -half + 0.05);
            const sigR = new THREE.Mesh(signalGeo, this.signalMat);
            sigR.position.set(-0.78, 0.62, -half + 0.05);
            sigL.visible = sigR.visible = false;
            car.add(sigL, sigR);
            scene.add(car);
            this.cars.push({
                mesh: car,
                sigL,
                sigR,
                x: 0,
                z: 0,
                prevX: 0,
                prevZ: 0,
                speed: 15,
                cruise: 15,
                lane: 0,
                fromX: 0,
                targetX: 0,
                shiftT: -1,
                signalT: 0,
                dir: 0,
                live: false,
                passed: false,
                w: 1.8,
                l: car.userData.length || 4.2
            });
        }

        for (let i = 0; i < 8; i++) {
            const mesh = createCassette(mats);
            mesh.visible = false;
            scene.add(mesh);
            this.tapes.push({ mesh, x: 0, z: 0, live: false, phase: Math.random() * Math.PI * 2 });
        }
        this.signalClock = 0;
    }

    setDifficulty(diff) {
        this.difficulty = diff;
        // carros vivos = densidade · janela visível (m) / 100, limitado ao pool
        this.active = Math.min(this.cars.length, Math.round(diff.density * (AHEAD + BEHIND) / 100));
        // fitas vivas ao mesmo tempo: ~4 por janela, escalado pela dificuldade
        this.activeTapes = Math.max(2, Math.min(this.tapes.length, Math.round(4 * diff.tapes)));
    }

    reset(playerZ) {
        for (const car of this.cars) this.despawnCar(car);
        for (const tape of this.tapes) this.despawnTape(tape);
        const spacing = 100 / this.difficulty.density;
        for (let i = 0; i < this.active; i++) {
            this.placeCar(this.cars[i], playerZ - 45 - i * spacing * randRange(0.8, 1.2));
        }
        for (let i = 0; i < this.activeTapes; i++) {
            this.placeTape(this.tapes[i], playerZ - 70 - i * 70);
        }
    }

    /** Faixas ocupadas por carros vivos a menos de `span` de z (bitmask de 4 bits). */
    lanesNear(z, span, skip) {
        let mask = 0;
        for (const other of this.cars) {
            if (!other.live || other === skip) continue;
            if (Math.abs(other.z - z) < span) mask |= 1 << other.lane;
        }
        return mask;
    }

    placeCar(car, z) {
        for (let tries = 0; tries < 6; tries++) {
            const mask = this.lanesNear(z, 16, car);
            const busy = (mask & 1) + ((mask >> 1) & 1) + ((mask >> 2) & 1) + ((mask >> 3) & 1);
            if (busy < 2) break;
            z -= 18;
        }
        let lane = Math.floor(hash(z * 13.1) * LANES.length);
        const near = this.lanesNear(z, 12, car);
        for (let k = 0; k < LANES.length && (near & (1 << lane)); k++) lane = (lane + 1) % LANES.length;
        const [lo, hi] = this.difficulty.kmh;
        car.lane = lane;
        car.x = car.prevX = car.targetX = car.fromX = LANES[lane] + (hash(z * 7.7) - 0.5) * 0.3;
        car.z = car.prevZ = z;
        car.cruise = (lo + hash(z * 3.1) * (hi - lo)) / KMH * LANE_SPEED[lane];
        car.speed = car.cruise;
        car.shiftT = -1;
        car.signalT = 0;
        car.dir = 0;
        car.passed = false;
        car.live = true;
        car.mesh.visible = true;
        car.sigL.visible = car.sigR.visible = false;
        car.mesh.position.set(car.x, 0, car.z);
        car.mesh.rotation.y = Math.PI;
    }

    /** Sorteia a troca de faixa (ver REGRAS). Carro perto da linha da moto tende a ir na direção dela. */
    maybeShift(car, player, h) {
        const ahead = player.z - car.z;
        if (car.shiftT >= 0 || car.signalT > 0 || ahead < 50 || ahead > 160) return;
        if (Math.random() > this.difficulty.shift * h) return;
        const aim = Math.abs(car.x - player.x) < 4;
        const toward = aim ? Math.sign(player.x - car.x) || 1 : (Math.random() < 0.5 ? -1 : 1);
        const dir = car.lane === 0 ? 1 : car.lane === LANES.length - 1 ? -1 : toward;
        const lane = car.lane + dir;
        if (this.lanesNear(car.z, 14, car) & (1 << lane)) return;
        car.dir = dir;
        car.signalT = SIGNAL_TIME;
        car.nextLane = lane;
    }

    placeTape(tape, z) {
        let lane = Math.floor(hash(z * 21.3) * LANES.length);
        // fita nunca nasce em cima de um carro (pegar a fita não pode exigir uma batida)
        const near = this.lanesNear(z, 10);
        for (let k = 0; k < LANES.length && (near & (1 << lane)); k++) lane = (lane + 1) % LANES.length;
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

    /** Passo fixo: velocidades, distância segura, trocas de faixa e reciclagem. */
    step(h, player) {
        const ahead = player.z - AHEAD;
        const behind = player.z + BEHIND;
        this.signalClock += h;

        for (let i = 0; i < this.cars.length; i++) {
            const car = this.cars[i];
            car.prevX = car.x;
            car.prevZ = car.z;
            if (!car.live) {
                if (i < this.active) this.placeCar(car, ahead - randRange(0, 60));
                continue;
            }

            // líder: carro mais próximo à frente na mesma faixa (ou a moto, se estiver na frente)
            let leaderGap = Infinity;
            let leaderSpeed = car.cruise;
            let bikeLeads = false;
            for (const other of this.cars) {
                if (other === car || !other.live) continue;
                if (Math.abs(other.x - car.x) > 2.2) continue;
                const gap = car.z - other.z - (car.l + other.l) * 0.5;
                if (gap > -0.5 && gap < leaderGap) {
                    leaderGap = gap;
                    leaderSpeed = other.speed;
                }
            }
            const bikeGap = car.z - player.z - (car.l + 2.1) * 0.5;
            if (Math.abs(player.x - car.x) < 1.9 && bikeGap > -0.5 && bikeGap < leaderGap) {
                leaderGap = bikeGap;
                leaderSpeed = player.speed;
                bikeLeads = true;
            }
            const safe = 6 + 1.4 * car.speed;
            let target = car.cruise;
            if (leaderGap < safe) target = Math.min(car.cruise, leaderSpeed * Math.max(0, leaderGap / safe));
            const dv = target - car.speed;
            // freia até 4 m/s² por carro; pela moto, frenagem de emergência (8 m/s²)
            const decel = bikeLeads && leaderGap < safe * 0.6 ? 8 : 4;
            car.speed = Math.max(0, car.speed + Math.max(-decel * h, Math.min(1.5 * h, dv)));
            car.z -= car.speed * h;

            // seta → manobra
            this.maybeShift(car, player, h);
            if (car.signalT > 0) {
                car.signalT -= h;
                if (car.signalT <= 0) {
                    if (this.lanesNear(car.z, 14, car) & (1 << car.nextLane)) {
                        car.dir = 0;            // a faixa fechou: desiste e apaga a seta
                    } else {
                        car.lane = car.nextLane;
                        car.fromX = car.x;
                        car.targetX = LANES[car.lane];
                        car.shiftT = 0;
                    }
                }
            }
            if (car.shiftT >= 0) {
                car.shiftT += h;
                const k = Math.min(1, car.shiftT / SHIFT_TIME);
                // perfil cosseno: começa e termina sem tranco lateral
                car.x = car.fromX + (car.targetX - car.fromX) * (0.5 - 0.5 * Math.cos(Math.PI * k));
                if (k >= 1) {
                    car.shiftT = -1;
                    car.dir = 0;
                }
            }

            if (car.z > behind || car.z < ahead - 60) {
                if (i < this.active) this.placeCar(car, ahead - randRange(0, 60));
                else this.despawnCar(car);
            }
        }

        for (let i = 0; i < this.tapes.length; i++) {
            const tape = this.tapes[i];
            if (i >= this.activeTapes) continue;
            if (!tape.live || tape.z > behind) this.placeTape(tape, ahead - randRange(10, 90));
        }
    }

    /** Pose do quadro (interpolada) + animações visuais. */
    render(alpha, dt) {
        const blinkOn = Math.floor(this.signalClock * 3) % 2 === 0;
        for (const car of this.cars) {
            if (!car.live) continue;
            const x = car.prevX + (car.x - car.prevX) * alpha;
            const z = car.prevZ + (car.z - car.prevZ) * alpha;
            car.mesh.position.set(x, 0, z);
            // durante a troca o bico aponta para o lado (derivada do perfil cosseno)
            let yaw = 0;
            if (car.shiftT >= 0 && car.speed > 1) {
                const k = Math.min(1, car.shiftT / SHIFT_TIME);
                const vx = (car.targetX - car.fromX) * 0.5 * Math.PI * Math.sin(Math.PI * k) / SHIFT_TIME;
                yaw = Math.atan2(vx, car.speed);
            }
            car.mesh.rotation.y = Math.PI - yaw;
            const signalling = car.dir !== 0 && blinkOn;
            car.sigL.visible = signalling && car.dir < 0;
            car.sigR.visible = signalling && car.dir > 0;
        }
        for (const tape of this.tapes) {
            if (!tape.live) continue;
            tape.phase += dt * 2.4;
            tape.mesh.position.set(tape.x, 1.05 + Math.sin(tape.phase) * 0.18, tape.z);
            tape.mesh.rotation.y += dt * 1.6;
            if (tape.mesh.userData.reels) {
                for (const reel of tape.mesh.userData.reels) reel.rotation.z += dt * 4;
            }
        }
    }

    collideCars(player) {
        const pb = player.bounds();
        for (const car of this.cars) {
            if (!car.live) continue;
            if (aabbHit(pb, car.x, car.z, car.w, car.l)) return car;
        }
        return null;
    }

    /**
     * Ultrapassagens raspando: carro que acabou de ficar para trás com vão lateral (borda a borda)
     * < 0,9 m, a mais de 80 km/h. Devolve quantas aconteceram neste passo.
     */
    nearMisses(player) {
        let count = 0;
        for (const car of this.cars) {
            if (!car.live || car.passed) continue;
            if (car.z - car.l * 0.5 > player.z + 1.05) {
                car.passed = true;
                const edgeGap = Math.abs(car.x - player.x) - (car.w + 0.8) * 0.5;
                if (edgeGap < 0.9 && edgeGap > 0 && player.speed > 80 / KMH && player.invuln <= 0) count++;
            }
        }
        return count;
    }

    collectTapes(player, out) {
        out.length = 0;
        for (const tape of this.tapes) {
            if (!tape.live) continue;
            if (Math.abs(player.x - tape.x) < 1.35 && Math.abs(player.z - tape.z) < 1.8) {
                tape.live = false;
                tape.mesh.visible = false;
                out.push(tape);
            }
        }
        return out;
    }

    /**
     * Piloto automático do modo atração: escolhe a faixa livre mais próxima olhando
     * 1,6 s à frente e devolve { steer, brake }.
     */
    autoPilot(player, out) {
        let best = player.x;
        let bestScore = -1e9;
        const look = 12 + player.speed * 1.6;
        for (const laneX of LANES) {
            let score = -Math.abs(laneX - player.x) * 0.15;
            for (const car of this.cars) {
                if (!car.live) continue;
                const dz = player.z - car.z;
                if (dz > -4 && dz < look && Math.abs(car.x - laneX) < 2.2) score -= 8 + (look - dz) * 0.2;
            }
            if (score > bestScore) {
                bestScore = score;
                best = laneX;
            }
        }
        out.steer = Math.max(-1, Math.min(1, (best - player.x) * 0.45));
        out.brake = bestScore < -12 ? 0.6 : 0;
        return out;
    }
}
