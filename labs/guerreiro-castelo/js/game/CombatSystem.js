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
        /* Um golpe resolve uma vez, num arco à frente, para o clique acertar
           sem precisar encostar no modelo no quadro exato. */
        if (player.attackT > 0.12 && player.attackT < 0.34 && !player.swingHit) {
            player.swingHit = true;
            let connected = false;
            for (const g of this.guards) {
                if (!g.alive) continue;
                const dx = g.position.x - player.position.x;
                const dz = g.position.z - player.position.z;
                const d = Math.hypot(dx, dz);
                if (d > 2.55) continue;
                const aim = Math.atan2(dx, dz);
                const diff = Math.atan2(Math.sin(aim - player.facing), Math.cos(aim - player.facing));
                if (Math.abs(diff) > 1.25) continue;
                g.takeHit(1);
                connected = true;
            }
            if (connected) {
                this.combo++;
                this.comboT = 0.9;
                game.audio.play('hit');
                game.cameraRig.addShake(0.08, 0.15);
            }
        }
    }
}
