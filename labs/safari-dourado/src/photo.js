/**
 * Sistema de fotografia: enquadra a vida selvagem no centro da lente,
 * pontua espécie, preenchimento, foco e ação, e preenche o caderno.
 */

import * as THREE from 'three';
import { PHOTO, SPECIES } from './config.js';
import { clamp } from './utils.js';

const NDC = new THREE.Vector3();
const WORLD = new THREE.Vector3();

export class PhotoSystem {
    constructor() {
        this.best = {};
        this.shots = 0;
        this.score = 0;
        this.cool = 0;
        this.last = null;
        this.aim = null;
    }

    reset() {
        this.best = {};
        this.shots = 0;
        this.score = 0;
        this.cool = 0;
        this.last = null;
        this.aim = null;
    }

    speciesCount() {
        return Object.keys(this.best).length;
    }

    update(dt, camera, wildlife) {
        this.cool = Math.max(0, this.cool - dt);
        this.aim = this.pickTarget(camera, wildlife);
        return this.aim;
    }

    pickTarget(camera, wildlife) {
        let best = null;
        let bestScore = 0;
        wildlife.forEach((a) => {
            WORLD.set(a.x, a.y + (a.mesh.userData.height || 1.2) * 0.55, a.z);
            NDC.copy(WORLD).project(camera);
            if (NDC.z < -1 || NDC.z > 1) return;
            const cx = Math.abs(NDC.x);
            const cy = Math.abs(NDC.y);
            if (cx > 0.92 || cy > 0.78) return;

            const cam = camera.position;
            const dist = Math.hypot(a.x - cam.x, a.z - cam.z);
            if (dist < 4 || dist > PHOTO.maxDist + 8) return;

            const height = (a.mesh.userData.height || 1.2) * a.scale;
            const fill = clamp(height / (dist * Math.tan((camera.fov * Math.PI) / 360) * 2.2), 0, 1.6);
            const center = 1 - Math.min(1, Math.hypot(NDC.x, NDC.y * 0.85) / PHOTO.centerWeight);
            const rank = fill * 1.4 + center * 1.1 + (dist < PHOTO.maxDist ? 0.2 : 0);
            if (rank > bestScore) {
                bestScore = rank;
                best = { animal: a, dist, fill, center, ndcX: NDC.x, ndcY: NDC.y };
            }
        });
        return best;
    }

    shoot(target) {
        if (this.cool > 0) return null;
        this.cool = PHOTO.cooldown;
        this.shots += 1;

        if (!target) {
            this.last = {
                ok: false,
                label: 'céu e poeira',
                tag: 'nada no enquadramento',
                score: 0
            };
            return this.last;
        }

        const { animal, dist, fill, center } = target;
        const spec = SPECIES[animal.species];
        let mult = 1;

        if (dist < PHOTO.minDist) {
            mult *= 0.28;
            animal.state = animal.rest ? 'alert' : 'flee';
            animal.timer = 2.4;
            animal.action = animal.rest ? 'roar' : 'run';
        } else if (dist >= PHOTO.sweetMin && dist <= PHOTO.sweetMax) {
            mult *= 1.28;
        } else if (dist > PHOTO.maxDist * 0.85) {
            mult *= 0.55;
        }

        mult *= 0.55 + clamp(fill, 0, 1.2) * 0.9;
        mult *= 0.5 + center * 0.7;

        if (animal.action === 'run' || animal.action === 'drink' || animal.action === 'roar') {
            mult *= 1.22;
        }

        const first = !this.best[animal.species];
        const repeat = animal.photographed > 0;
        if (repeat) mult *= 0.42;

        let points = Math.round(spec.points * mult);
        if (first) points += 480;
        points = Math.max(40, points);

        animal.photographed += 1;
        const prev = this.best[animal.species] || 0;
        if (points > prev) this.best[animal.species] = points;
        this.score += points;

        const grade = points >= spec.points * 1.4 ? 'obra-prima'
            : points >= spec.points ? 'grande plano'
                : dist < PHOTO.minDist ? 'perto demais'
                    : 'registro';

        this.last = {
            ok: true,
            species: animal.species,
            label: spec.label,
            tag: first ? 'primeiro registro' : grade,
            score: points,
            first,
            grade
        };
        return this.last;
    }
}

export function focalMm(fov) {
    const mm = Math.round(18 + (52 - fov) * (300 / 34));
    return clamp(mm, 24, 400);
}
