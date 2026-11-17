/**
 * Sombrios (fogem da chama), a Noite (cap. IV) e Pingo, a raposa.
 *
 * Sombrio: patrulha waypoints. Se a lanterna estiver fraca (< 28) ou o
 * jogador estiver de costas, aproxima. Um pulso (flashRadius) força fuga.
 *
 * Luz desfaz sombra — regras visuais e de jogo:
 *   • fugindo do pulso, o corpo de fumaça se dissolve (0 → 0,85 em ~0,3 s) e
 *     se refaz quando a fuga termina (2,2 s);
 *   • a menos de LAMP_SAFE (3,4 m, o mesmo raio em que a chama não gasta) de um
 *     lampião aceso o Sombrio não avança: dissolve e recua por 1 s. Lampião
 *     aceso é abrigo.
 */

import { clamp, damp } from './utils.js';

const LAMP_SAFE = 3.4;

function nearLitLamp(x, z, lamps) {
    if (!lamps) return false;
    for (const l of lamps) {
        if (!l.lit) continue;
        const dx = x - l.x;
        const dz = z - l.z;
        if (dx * dx + dz * dz < LAMP_SAFE * LAMP_SAFE) return l;
    }
    return null;
}

export class ShadowWisp {
    /** @param {object} body  retorno de createShadowBody (fx.js) */
    constructor(body, x, z, waypoints) {
        this.body = body;
        this.group = body.object;
        this.x = x;
        this.z = z;
        this.homeX = x;
        this.homeZ = z;
        this.yaw = 0;
        this.waypoints = waypoints;
        this.wp = 0;
        this.state = 'patrol';
        this.speed = 2.15;
        this.chaseSpeed = 4.4;
        this.fleeSpeed = 7.2;
        this.vision = 11;
        this.alive = true;
        this.catchR = 1.05;
        this.alert = 0;
        this.fleeT = 0;
        this.dissolve = 0;
        this.phase = Math.random() * Math.PI * 2;
    }

    reset() {
        this.x = this.homeX;
        this.z = this.homeZ;
        this.wp = 0;
        this.state = 'patrol';
        this.alert = 0;
        this.fleeT = 0;
        this.dissolve = 0;
    }

    scare(px, pz, radius) {
        const d = Math.hypot(this.x - px, this.z - pz);
        if (d < radius) {
            this.state = 'flee';
            this.fleeT = 2.2;
            this.alert = 0;
            return true;
        }
        return false;
    }

    update(dt, player, heightAt, lamps) {
        if (!this.alive) return null;
        this.phase += dt * 2.4;
        this.fleeT = Math.max(0, this.fleeT - dt);

        const dx = player.x - this.x;
        const dz = player.z - this.z;
        const dist = Math.hypot(dx, dz);
        const dim = player.fuel < 28;
        const bold = dim || player.flashT <= 0;

        // lampião aceso é abrigo: a sombra que entra no círculo recua
        const lamp = nearLitLamp(this.x, this.z, lamps);
        if (lamp && this.fleeT < 1) this.fleeT = 1;

        if (this.fleeT > 0) this.state = 'flee';
        else if (dist < this.vision && bold) {
            this.state = 'chase';
            this.alert = Math.min(1, this.alert + dt * 0.9);
        } else if (this.state === 'chase' && dist > this.vision * 1.5) {
            this.state = 'patrol';
        } else if (this.state === 'flee') {
            this.state = 'patrol';
        }

        let tx;
        let tz;
        if (this.state === 'flee') {
            const fx = lamp ? this.x - lamp.x : -dx;
            const fz = lamp ? this.z - lamp.z : -dz;
            tx = this.x + fx;
            tz = this.z + fz;
        } else if (this.state === 'chase') {
            tx = player.x;
            tz = player.z;
        } else {
            const w = this.waypoints[this.wp];
            tx = w.x;
            tz = w.z;
            if (Math.hypot(this.x - tx, this.z - tz) < 1.5) {
                this.wp = (this.wp + 1) % this.waypoints.length;
            }
        }

        const sp = this.state === 'flee' ? this.fleeSpeed
            : this.state === 'chase' ? this.chaseSpeed : this.speed;
        const ax = tx - this.x;
        const az = tz - this.z;
        const al = Math.hypot(ax, az) || 1;
        this.x += (ax / al) * sp * dt;
        this.z += (az / al) * sp * dt;
        // gira com inércia: fumaça não vira de estalo
        const want = Math.atan2(ax / al, az / al);
        let dy = want - this.yaw;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        this.yaw += dy * Math.min(1, dt * 6);
        this.alert = Math.max(0, this.alert - dt * 0.22);

        const y = heightAt(this.x, this.z);
        this.group.position.set(this.x, y + 0.12 + Math.sin(this.phase) * 0.14, this.z);
        this.group.rotation.y = this.yaw;
        const s = 0.94 + Math.sin(this.phase * 1.6) * 0.06;
        this.group.scale.set(s, 1 + (1 - s), s);

        // visual: dissolução, medo (brasa no contorno) e arrasto da barra
        this.dissolve = damp(this.dissolve, this.state === 'flee' ? 0.85 : 0, this.state === 'flee' ? 9 : 2.2, dt);
        this.body.setDissolve(this.dissolve);
        this.body.setFear(this.state === 'chase' ? 0.5 + this.alert * 0.5 : this.alert * 0.4);
        this.body.setDrift(0, 0.05, -sp * 0.1);

        if (this.state !== 'flee' && dist < this.catchR) return 'caught';
        if (this.state === 'chase') return 'chase';
        return null;
    }
}

export class NightWraith {
    constructor(body, cx, cz, radius = 10) {
        this.body = body;
        this.group = body.object;
        this.cx = cx;
        this.cz = cz;
        this.baseOrbit = radius;
        this.orbit = radius;
        this.angle = 0;
        this.x = cx + radius;
        this.z = cz;
        this.alive = true;
        this.stun = 0;
        this.catchR = 1.6;
        this.alert = 0;
        this.dissolve = 0;
    }

    reset() {
        this.orbit = this.baseOrbit;
        this.angle = 0;
        this.x = this.cx + this.orbit;
        this.z = this.cz;
        this.stun = 0;
        this.alert = 0;
        this.dissolve = 0;
    }

    scare(px, pz, radius) {
        const d = Math.hypot(this.x - px, this.z - pz);
        if (d < radius * 1.15) {
            this.stun = 1.8;
            this.alert = 0;
            return true;
        }
        return false;
    }

    update(dt, player, heightAt) {
        if (!this.alive) return null;
        this.stun = Math.max(0, this.stun - dt);
        this.angle += dt * (this.stun > 0 ? 0.15 : 0.55);
        const wantX = this.cx + Math.cos(this.angle) * this.orbit;
        const wantZ = this.cz + Math.sin(this.angle) * this.orbit;
        // Se o jogador está perto das raízes, a Noite se aproxima.
        const pd = Math.hypot(player.x - this.cx, player.z - this.cz);
        const mix = pd < 14 && this.stun <= 0 ? 0.55 : 0.12;
        const px = this.x;
        const pz = this.z;
        this.x += (wantX * (1 - mix) + player.x * mix - this.x) * dt * 1.4;
        this.z += (wantZ * (1 - mix) + player.z * mix - this.z) * dt * 1.4;
        const y = heightAt(this.x, this.z);
        this.group.position.set(this.x, y + 0.5 + Math.sin(this.angle * 3) * 0.25, this.z);
        // encara a menina
        const face = Math.atan2(player.x - this.x, player.z - this.z);
        let dy = face - this.group.rotation.y;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        this.group.rotation.y += dy * Math.min(1, dt * 3);
        const dist = Math.hypot(player.x - this.x, player.z - this.z);
        this.alert = clamp(1 - dist / 10, 0, 1);

        this.dissolve = damp(this.dissolve, this.stun > 0 ? 0.62 : 0, this.stun > 0 ? 8 : 1.6, dt);
        this.body.setDissolve(this.dissolve);
        this.body.setFear(this.alert);
        const v = Math.hypot(this.x - px, this.z - pz) / Math.max(dt, 1e-4);
        this.body.setDrift(0, 0.04, -Math.min(0.6, v * 0.08));

        if (this.stun <= 0 && dist < this.catchR) return 'caught';
        if (this.alert > 0.4) return 'chase';
        return null;
    }
}

/**
 * Pingo: preso nas sarças fica sentado; livre, segue um ponto 1,4 m atrás de Clara.
 * A velocidade é limitada (v = min(7, 2,4·distância)) e escolhe a andadura da
 * criatura (passo, trote, corrida) para a pata não patinar.
 */
export class FoxCompanion {
    /** @param {object} creature  retorno de createCreature('fox') */
    constructor(creature, x, z) {
        this.creature = creature;
        this.group = creature.object;
        this.x = x;
        this.z = z;
        this.homeX = x;
        this.homeZ = z;
        this.yaw = 0;
        this.freed = false;
        this.state = { mode: 'sit', speed: 0, lookAt: null, groundFn: null };
        this.speed = 0;
    }

    reset(freed = false) {
        this.x = this.homeX;
        this.z = this.homeZ;
        this.freed = freed;
        this.speed = 0;
    }

    free() {
        this.freed = true;
        this.group.visible = true;
    }

    update(dt, player, heightAt, look) {
        const st = this.state;
        st.groundFn = heightAt;
        st.lookAt = look || null;
        if (!this.freed) {
            this.group.position.set(this.x, heightAt(this.x, this.z), this.z);
            const face = Math.atan2(player.x - this.x, player.z - this.z);
            let dy = face - this.yaw;
            dy = Math.atan2(Math.sin(dy), Math.cos(dy));
            this.yaw += dy * Math.min(1, dt * 2);
            this.group.rotation.y = this.yaw;
            st.mode = 'sit';
            st.speed = 0;
            this.creature.update(dt, st);
            return;
        }
        const tx = player.x - Math.sin(player.yaw) * 1.4 + Math.cos(player.yaw) * 0.7;
        const tz = player.z - Math.cos(player.yaw) * 1.4 - Math.sin(player.yaw) * 0.7;
        const dx = tx - this.x;
        const dz = tz - this.z;
        const dist = Math.hypot(dx, dz);
        const want = dist < 0.35 ? 0 : Math.min(7, dist * 2.4);
        this.speed = damp(this.speed, want, 6, dt);
        if (dist > 12) {
            // ficou para trás (troca de trecho): reaparece ao lado
            this.x = tx;
            this.z = tz;
            this.speed = 0;
        } else if (dist > 0.02) {
            const step = Math.min(dist, this.speed * dt);
            this.x += (dx / dist) * step;
            this.z += (dz / dist) * step;
            if (this.speed > 0.3) {
                const face = Math.atan2(dx, dz);
                let dy = face - this.yaw;
                dy = Math.atan2(Math.sin(dy), Math.cos(dy));
                this.yaw += dy * Math.min(1, dt * 9);
            }
        }
        this.group.position.set(this.x, heightAt(this.x, this.z), this.z);
        this.group.rotation.y = this.yaw;
        const g = this.creature.gaits;
        st.speed = this.speed;
        st.mode = this.speed < 0.25 ? 'idle'
            : this.speed < (g.walk?.speed ?? 1) * 1.5 ? 'walk'
                : this.speed < (g.trot?.speed ?? 2.5) * 1.35 ? 'trot' : 'run';
        this.creature.update(dt, st);
    }
}

export function nearestInteractable(player, list, extra = 0.25) {
    let best = null;
    let bestD = Infinity;
    for (const it of list) {
        if (it.done) continue;
        const d = Math.hypot(player.x - it.x, player.z - it.z);
        if (d < it.r + extra && d < bestD) {
            best = it;
            bestD = d;
        }
    }
    return best;
}
