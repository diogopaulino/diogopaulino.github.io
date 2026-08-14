/** Nível base — grupo, colisão e ciclo de vida. */

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
        this.interactables.length = 0;
    }

    update() {}

    addInteract(item) {
        this.interactables.push(item);
        this.game.interact.add(item);
        return item;
    }
}
