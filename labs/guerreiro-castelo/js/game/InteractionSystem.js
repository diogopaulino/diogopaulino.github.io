/**
 * Sistema de interação contextual por proximidade e foco da câmera.
 * Cada item: { object (Object3D), interactionLabel, interactionDistance, enabled, interact(player, game) }.
 * Pontuação: dist · (1,5 − cos do ângulo entre a câmera e o objeto) — o mais perto e mais
 * centralizado vence. Tudo em coordenadas de mundo (o navio se move).
 */

import * as THREE from 'three';

const _cam = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _obj = new THREE.Vector3();
const _to = new THREE.Vector3();
const _pl = new THREE.Vector3();

export class InteractionSystem {
    constructor(camera) {
        this.camera = camera;
        this.items = [];
        this.prompt = null;
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
        if (player.controller.mode !== 'walk') return null;

        this.camera.getWorldPosition(_cam);
        this.camera.getWorldDirection(_dir);
        player.worldPosition(_pl);
        let best = null;
        let bestScore = Infinity;

        for (const item of this.items) {
            if (item.enabled === false) continue;
            const obj = item.object;
            if (!obj || !obj.parent) continue;
            obj.getWorldPosition(_obj);
            if (item.offsetY) _obj.y += item.offsetY;

            const dist = Math.hypot(_obj.x - _pl.x, (_obj.y - _pl.y) * (item.flat ? 0 : 1), _obj.z - _pl.z);
            const maxd = item.interactionDistance ?? 2.4;
            if (dist > maxd) continue;

            _to.copy(_obj).sub(_cam).normalize();
            const dot = _dir.dot(_to);
            if (dot < 0.25 && dist > 1.2) continue;

            const score = dist * (1.5 - dot);
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
        player.interactT = 0.4;
        this.prompt.interact?.(player, game);
        return true;
    }
}
