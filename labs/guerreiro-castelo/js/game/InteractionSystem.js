/**
 * Interação por raycast da câmera. Objetos implementam:
 * { interactionLabel, interactionDistance, interact(player, game) }
 */

import * as THREE from 'three';

export class InteractionSystem {
    constructor(camera) {
        this.camera = camera;
        this.items = [];
        this.ray = new THREE.Raycaster();
        this.ray.far = 6;
        this.prompt = null;
        this._dir = new THREE.Vector3();
        this._origin = new THREE.Vector3();
    }

    clear() {
        this.items.length = 0;
        this.prompt = null;
    }

    add(item) {
        this.items.push(item);
        return item;
    }

    remove(item) {
        const i = this.items.indexOf(item);
        if (i >= 0) this.items.splice(i, 1);
    }

    update(player, game) {
        this.prompt = null;
        if (game.cutscenes?.blocking) return null;
        this.camera.getWorldDirection(this._dir);
        this._origin.copy(this.camera.position);
        let best = null;
        let bestScore = Infinity;

        for (const item of this.items) {
            if (item.enabled === false) continue;
            const obj = item.object;
            if (!obj) continue;
            obj.getWorldPosition(this._origin);
            const dist = this._origin.distanceTo(player.position);
            const maxd = item.interactionDistance ?? 2.2;
            if (dist > maxd) continue;
            const to = this._origin.clone().sub(this.camera.position).normalize();
            this.camera.getWorldDirection(this._dir);
            const dot = this._dir.dot(to);
            if (dot < 0.35 && dist > 1.1) continue;
            const score = dist * (1.4 - dot);
            if (score < bestScore) {
                bestScore = score;
                best = item;
            }
        }

        this.prompt = best;
        return best;
    }

    tryInteract(player, game) {
        if (!this.prompt) return false;
        this.prompt.interact?.(player, game);
        return true;
    }
}
