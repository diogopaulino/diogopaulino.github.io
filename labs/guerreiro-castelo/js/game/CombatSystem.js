/**
 * Combate curto — Dico ataca em combo, guarda reage, sem gore.
 *
 * Acerto: na janela ativa do golpe (Player.ATTACK_ACTIVE, 0,13–0,26 s) resolve UMA vez,
 * num arco à frente (alcance 2,4 m, ±70°), para o clique acertar sem precisar encostar no
 * modelo no quadro exato.
 *
 * Peso do golpe (game feel):
 *   hitstop — o jogo congela 70 ms (110 ms no 3º golpe do combo) no impacto
 *   knockback — o guarda é empurrado 3,8 m/s (6 m/s no 3º golpe) e cambaleia 0,45 s
 *   tremor de câmera curto + som + vibração (navigator.vibrate, se houver)
 * Combo: golpes ligados com menos de 0,9 s entre si; o 3º fecha a sequência.
 */

const REACH = 2.4;
const ARC = 1.22; // rad (~70°)
const COMBO_WINDOW = 0.9;

export class CombatSystem {
    constructor() {
        this.combo = 0;
        this.comboT = 0;
        this.guards = [];
    }

    setGuards(list) {
        this.guards = list;
        this.combo = 0;
        this.comboT = 0;
    }

    update(dt, game) {
        this.comboT = Math.max(0, this.comboT - dt);
        if (this.comboT <= 0) this.combo = 0;
        const player = game.player;
        if (!player.swingActive || player.swingHit) return;
        player.swingHit = true;
        game.audio.play('swing');
        let connected = false;
        const finisher = this.combo >= 2;
        for (const g of this.guards) {
            if (!g.alive) continue;
            const dx = g.position.x - player.position.x;
            const dz = g.position.z - player.position.z;
            if (Math.abs(g.position.y - player.position.y) > 1.6) continue;
            const d = Math.hypot(dx, dz);
            if (d > REACH) continue;
            const aim = Math.atan2(dx, dz);
            const diff = Math.atan2(Math.sin(aim - player.facing), Math.cos(aim - player.facing));
            if (Math.abs(diff) > ARC && d > 0.9) continue;
            g.takeHit(1, player.position.x, player.position.z, finisher ? 6 : 3.8, game);
            connected = true;
        }
        if (connected) {
            this.combo = finisher ? 0 : this.combo + 1;
            this.comboT = COMBO_WINDOW;
            game.audio.play('hit');
            game.hitstop?.(finisher ? 0.11 : 0.07);
            game.cameraRig.addShake(finisher ? 0.12 : 0.08, 0.15);
            try { navigator.vibrate?.(finisher ? 35 : 18); } catch { /* sem vibração */ }
        }
    }
}
