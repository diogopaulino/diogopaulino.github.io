/**
 * Sistema de interação contextual por proximidade e foco da câmera em Babylon.js.
 */

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

        const camPos = this.camera.position;
        const camTarget = this.camera.getTarget ? this.camera.getTarget() : new BABYLON.Vector3(0, 0, 0);
        const camDir = camTarget.subtract(camPos).normalize();

        const playerPos = player.position;
        let best = null;
        let bestScore = Infinity;

        for (const item of this.items) {
            if (item.enabled === false) continue;
            const obj = item.object;
            if (!obj) continue;

            const objPos = obj.getAbsolutePosition ? obj.getAbsolutePosition() : obj.position;
            if (!objPos) continue;

            const dx = objPos.x - playerPos.x;
            const dy = objPos.y - playerPos.y;
            const dz = objPos.z - playerPos.z;
            const dist = Math.hypot(dx, dy, dz);

            const maxd = item.interactionDistance ?? 2.4;
            if (dist > maxd) continue;

            const toDir = objPos.subtract(camPos).normalize();
            const dot = BABYLON.Vector3.Dot(camDir, toDir);
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
        this.prompt.interact?.(player, game);
        return true;
    }
}
