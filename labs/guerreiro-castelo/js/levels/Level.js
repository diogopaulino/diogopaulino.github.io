/**
 * Nível base — grupo raiz (THREE.Group), ciclo de vida e interação.
 * Os atores persistentes (Dico, Teco, Camila) são devolvidos ao "limbo" do jogo antes de o
 * grupo do nível ser descartado.
 */

import * as THREE from 'three';

export class Level {
    constructor(game) {
        this.game = game;
        this.group = null;
        this.interactables = [];
        this.npcs = [];
        this.time = 0;
    }

    get id() {
        return 'level';
    }

    async build() {}

    enter() {}

    /** Ponto invisível para interação (horizonte, portão). */
    proxy(x, y, z, parent = this.group) {
        const o = new THREE.Object3D();
        o.position.set(x, y, z);
        parent.add(o);
        return o;
    }

    exit() {
        const g = this.game;
        for (const item of this.interactables) {
            g.interact.remove(item);
        }
        this.interactables.length = 0;
        this.npcs.length = 0;
        g.limbo.add(g.player.root, g.teco.root, g.camila.root);
        if (this.group) {
            this.group.removeFromParent();
            if (!this.group.userData.keep) {
                this.group.traverse((o) => {
                    if (o.userData?.ownGeo) o.geometry?.dispose();
                    if (o.isLight && o.shadow?.map) o.shadow.map.dispose();
                });
            }
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
