/** Combate curto — Dico ataca em combo, guarda reage, sem gore. */

export class CombatSystem {
    constructor() {
        this.combo = 0;
        this.comboT = 0;
        this.guards = [];
    }

    setGuards(list) {
        this.guards = list;
    }

    update(dt, game) {
        this.comboT = Math.max(0, this.comboT - dt);
        if (this.comboT <= 0) this.combo = 0;
        const player = game.player;
        if (player.attackT > 0.28 && player.attackT < 0.38) {
            for (const g of this.guards) {
                if (!g.alive) continue;
                const d = Math.hypot(g.position.x - player.position.x, g.position.z - player.position.z);
                if (d < 1.9) {
                    g.takeHit(1);
                    this.combo++;
                    this.comboT = 0.8;
                    game.audio.play('hit');
                    game.cameraRig.addShake(0.08, 0.15);
                }
            }
        }
    }
}
