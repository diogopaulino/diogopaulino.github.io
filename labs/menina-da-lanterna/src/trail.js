/**
 * Rastro de luz — fagulhas da chama da Nara que correm rente ao chão, de Clara até o
 * próximo passo do capítulo. Complementa a bússola do HUD: no escuro a criança olha
 * para o mundo, não para o canto da tela.
 *
 * Geometria (no plano XZ):
 *   u      = rumo suavizado até o alvo;  u ← normalize(lerp(u, alvo − Clara, 1 − e^(−6·dt)))
 *   s_i    = 1,3 + i·1,4 m  (i = 0…N−1), visível enquanto s_i < d − near·0,6
 *   p_i    = Clara + u·s_i + ⊥u·0,14·sin(1,3·t + i)        (leve serpentear)
 *   y_i    = chão(p_i) + 0,42 + 0,06·sin(3t + 1,7i)   (acima da grama, que tem ~0,4 m)
 * Brilho (onda que corre para o alvo, ~0,8 voltas/s):
 *   w_i    = (½ + ½·cos(2π·(0,13·i − 0,8·t)))⁴
 *   I_i    = A · (0,16 + 0,7·w_i) · borda_i      tamanho = 0,3 + 0,16·w_i  (m)
 *   borda  = smoothstep(1,2; 2,6; s_i) · (1 − smoothstep(0,7; 1; s_i / alcance))
 *   A      = amplitude suavizada: 0 sem alvo/perto · 1 normal · até 1,8 quando a criança
 *            está perdida (main.js manda o `boost`)
 * Fagulha que cairia dentro de casa, tronco ou rio some (testado a 8 Hz, não por quadro).
 * Usa o lote de halos aditivos de fx.js: zero draw call extra, zero alocação por quadro.
 */

const TAU = Math.PI * 2;

export class LightTrail {
    /** @param {{ add(o): object|null }} glows  lote de halos (fx.js) */
    constructor(glows, count = 10) {
        this.sparks = [];
        for (let i = 0; i < count; i++) {
            const h = glows.add({ size: 0.32, color: 0xffd27a, intensity: 0, flicker: 0.5 });
            if (!h) break;
            this.sparks.push({ h, s: 0, hidden: false });
        }
        this.ux = 0;
        this.uz = 1;
        this.amp = 0;
        this.checkT = 0;
        this.hadTarget = false;
    }

    /** Some na hora (troca de capítulo, diálogo, menu). */
    clear() {
        this.amp = 0;
        this.hadTarget = false;
        for (const sp of this.sparks) {
            if (sp.h.intensity === 0) continue;
            sp.h.intensity = 0;
            sp.h.push();
        }
    }

    /**
     * @param {number} dt
     * @param {number} t       relógio do jogo (s)
     * @param {{x:number,z:number}} player
     * @param {{x:number,z:number,near?:number}|null} target
     * @param {{heightAt(x,z):number, blocked(x,z,r):boolean}} zone
     * @param {number} boost   1 = normal · >1 = mais forte (perdida, chama fraca)
     */
    update(dt, t, player, target, zone, boost = 1) {
        const n = this.sparks.length;
        if (!n) return;
        let d = 0;
        if (target) {
            const dx = target.x - player.x;
            const dz = target.z - player.z;
            d = Math.hypot(dx, dz);
            if (d > 1e-3) {
                // alvo novo: o rumo vira na hora; depois só acompanha suave
                const k = this.hadTarget ? 1 - Math.exp(-6 * dt) : 1;
                let ux = this.ux + (dx / d - this.ux) * k;
                let uz = this.uz + (dz / d - this.uz) * k;
                const l = Math.hypot(ux, uz) || 1;
                this.ux = ux / l;
                this.uz = uz / l;
            }
        }
        this.hadTarget = Boolean(target);
        const near = target ? (target.near ?? 2) : 0;
        const reach = target ? Math.max(0, d - near * 0.6) : 0;
        const on = target && reach > 1.6 ? boost : 0;
        this.amp += (on - this.amp) * (1 - Math.exp(-(on > this.amp ? 3 : 5) * dt));
        if (this.amp < 0.004 && !on) {
            if (this.amp !== 0) this.clear();
            return;
        }

        // obstáculos: 8 Hz bastam (as fagulhas andam devagar)
        this.checkT -= dt;
        const check = this.checkT <= 0;
        if (check) this.checkT = 0.125;

        const span = Math.min(reach, 1.3 + (n - 1) * 1.4);
        const px = -this.uz;
        const pz = this.ux;
        for (let i = 0; i < n; i++) {
            const sp = this.sparks[i];
            const h = sp.h;
            const s = 1.3 + i * 1.4;
            if (s > span) {
                if (h.intensity !== 0) {
                    h.intensity = 0;
                    h.push();
                }
                continue;
            }
            const sway = Math.sin(1.3 * t + i) * 0.14;
            const x = player.x + this.ux * s + px * sway;
            const z = player.z + this.uz * s + pz * sway;
            if (check) sp.hidden = zone.blocked(x, z, 0.05);
            if (sp.hidden) {
                if (h.intensity !== 0) {
                    h.intensity = 0;
                    h.push();
                }
                continue;
            }
            const wave = 0.5 + 0.5 * Math.cos(TAU * (0.13 * i - 0.8 * t));
            const w4 = wave * wave * wave * wave;
            const edge = smooth(1.2, 2.6, s) * (1 - smooth(0.7, 1, s / Math.max(span, 0.01)));
            h.set(x, zone.heightAt(x, z) + 0.42 + 0.06 * Math.sin(3 * t + 1.7 * i), z);
            h.intensity = this.amp * (0.16 + 0.7 * w4) * edge;
            h.size = 0.3 + 0.16 * w4;
            h.push();
        }
    }
}

function smooth(a, b, x) {
    const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return k * k * (3 - 2 * k);
}
