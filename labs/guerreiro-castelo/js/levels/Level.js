/**
 * Nível base em Babylon.js — transformNode raiz, obstáculos, ciclo de vida e interação.
 */

export class Level {
    constructor(game) {
        this.game = game;
        this.group = null;
        this.interactables = [];
        this.obstacles = [];
        this.npcs = [];
        this.time = 0;
    }

    get id() {
        return 'level';
    }

    async build() {}

    enter() {}

    exit() {
        for (const item of this.interactables) {
            this.game.interact.remove(item);
        }
        this.interactables.length = 0;
        this.obstacles.length = 0;
        this.npcs.length = 0;
        if (this.group) {
            try {
                this.group.dispose(false, true);
            } catch { /* ignore */ }
            this.group = null;
        }
    }

    update() {}

    addInteract(item) {
        this.interactables.push(item);
        this.game.interact.add(item);
        return item;
    }
}
