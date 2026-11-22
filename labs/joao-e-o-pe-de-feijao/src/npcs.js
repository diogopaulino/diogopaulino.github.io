/**
 * Mimosa (segue o João pela corda), gigante (dorme / fareja / persegue / desce o
 * caule / cai) e utilitário de interação. Os corpos vêm de gfx/creature.js e
 * gfx/hero.js; aqui fica a regra de jogo e a escolha do modo de animação.
 */

import * as THREE from 'three';
import { clamp, damp, lerpAngle } from './utils.js';

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _d = new THREE.Vector3();
const _side = new THREE.Vector3();
const _up = new THREE.Vector3();
const _look = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/**
 * Vaca. Parada pasta ('eat'); chamada, segue o João a `hold` metros.
 * Velocidade desejada v = clamp((dist − hold)·2,2, 0, 7,6) e a andadura sai dela:
 *   v < 1,5·passo → walk · v < 1,25·trote → trot · senão run
 * A vaca anda para onde aponta (gira até 4 rad/s), então o casco não patina.
 */
export class CowAI {
    constructor(creature, x, z) {
        this.creature = creature;
        this.group = creature.object;
        this.x = x;
        this.z = z;
        this.yaw = 0;
        this.follow = false;
        this.parked = false;
        this.speed = 0;
        this.state = { mode: 'eat', speed: 0, lookAt: null, groundFn: null, turn: 0 };
        this.grazeT = 0;
    }

    place(x, z, yaw = this.yaw) {
        this.x = x;
        this.z = z;
        this.yaw = yaw;
        this.speed = 0;
    }

    update(dt, player, heightAt) {
        const st = this.state;
        const g = this.creature.gaits;
        st.groundFn = heightAt;
        let turn = 0;
        if (this.follow && !this.parked) {
            const dx = player.x - this.x;
            const dz = player.z - this.z;
            const dist = Math.hypot(dx, dz);
            const hold = 2.5;
            const want = dist > hold ? clamp((dist - hold) * 2.2, 0, 7.6) : 0;
            this.speed = damp(this.speed, want, 5, dt);
            if (this.speed > 0.08) {
                const target = Math.atan2(dx, dz);
                const prev = this.yaw;
                this.yaw = lerpAngle(this.yaw, target, 4, dt);
                turn = clamp((this.yaw - prev) / Math.max(dt, 1e-3) / 2.5, -1, 1);
                this.x += Math.sin(this.yaw) * this.speed * dt;
                this.z += Math.cos(this.yaw) * this.speed * dt;
                st.mode = this.speed < g.walk.speed * 1.5 ? 'walk' : this.speed < g.trot.speed * 1.25 ? 'trot' : 'run';
                st.speed = this.speed;
            } else {
                st.mode = 'idle';
                st.speed = 0;
            }
            st.lookAt = _look.set(player.x, player.y + 1.0, player.z);
        } else if (this.parked) {
            st.mode = 'idle';
            st.speed = 0;
            st.lookAt = _look.set(player.x, player.y + 1.0, player.z);
        } else {
            // pastando: levanta a cabeça de vez em quando
            this.grazeT += dt;
            st.mode = this.grazeT % 14 > 10.5 ? 'idle' : 'eat';
            st.speed = 0;
            st.lookAt = null;
        }
        st.turn = turn;
        this.group.position.set(this.x, heightAt(this.x, this.z), this.z);
        this.group.rotation.y = this.yaw;
        this.creature.update(dt, st);
    }
}

/**
 * Corda entre dois pontos do mundo (mão do João → cabresto da Mimosa): tubo de
 * SEG×RAD vértices reescrito a cada quadro, sem alocação.
 *   p(u) = lerp(a, b, u) − ŷ·flecha·sin(πu),  flecha = clamp(folga, 0,05, 0,9)·½
 */
export class Rope {
    constructor(length = 3.2, radius = 0.014) {
        this.length = length;
        this.radius = radius;
        this.SEG = 12;
        this.RAD = 5;
        const n = (this.SEG + 1) * this.RAD;
        this.pos = new Float32Array(n * 3);
        this.nor = new Float32Array(n * 3);
        const idx = [];
        for (let i = 0; i < this.SEG; i++) {
            for (let j = 0; j < this.RAD; j++) {
                const a = i * this.RAD + j;
                const b = i * this.RAD + ((j + 1) % this.RAD);
                idx.push(a, a + this.RAD, b, b, a + this.RAD, b + this.RAD);
            }
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
        geo.setAttribute('normal', new THREE.BufferAttribute(this.nor, 3));
        geo.setIndex(idx);
        geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
        this.mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x9a7c4c, roughness: 0.95 }));
        this.mesh.castShadow = true;
        this.mesh.frustumCulled = false;
        this.mesh.visible = false;
    }

    update(a, b) {
        _d.subVectors(b, a);
        const dist = _d.length();
        const sag = clamp(this.length - dist, 0.05, 0.9) * 0.5;
        _d.divideScalar(dist || 1);
        _side.crossVectors(_d, UP).normalize();
        _up.crossVectors(_side, _d);
        let o = 0;
        for (let i = 0; i <= this.SEG; i++) {
            const u = i / this.SEG;
            const cx = a.x + (b.x - a.x) * u;
            const cy = a.y + (b.y - a.y) * u - Math.sin(Math.PI * u) * sag;
            const cz = a.z + (b.z - a.z) * u;
            for (let j = 0; j < this.RAD; j++) {
                const t = (j / this.RAD) * Math.PI * 2;
                const c = Math.cos(t);
                const s = Math.sin(t);
                const nx = _side.x * c + _up.x * s;
                const ny = _side.y * c + _up.y * s;
                const nz = _side.z * c + _up.z * s;
                this.pos[o] = cx + nx * this.radius;
                this.pos[o + 1] = cy + ny * this.radius;
                this.pos[o + 2] = cz + nz * this.radius;
                this.nor[o] = nx;
                this.nor[o + 1] = ny;
                this.nor[o + 2] = nz;
                o += 3;
            }
        }
        this.mesh.geometry.attributes.position.needsUpdate = true;
        this.mesh.geometry.attributes.normal.needsUpdate = true;
    }
}

/**
 * Gigante. Regras de furtividade (as do jogo original, com raios em escala):
 *   dormindo: alerta −0,12/s sempre; dentro de `hearR` (e no mesmo andar) soma
 *             0,12/s andando (anula a queda) ou 0,55/s correndo; a menos de
 *             `closeR` soma mais 0,4/s. Alerta ≥ 1 → acorda ('stir').
 *   acordando: 2,2 s levantando, saindo da cadeira e urrando; depois persegue a `chaseSpeed`.
 *   perseguindo: anda reto até o João, contornando os obstáculos (`obstacles`);
 *             a menos de `catchR` → 'caught' e fica tonto por `dazeT` = 3 s
 *             (parado, coçando a cabeça) — o João tem tempo de fugir. Cada passada emite `stomp`
 *             (o jogo treme a câmera proporcional à distância).
 *
 * O herói é escalado por fora (`scale`), então a velocidade passada à animação
 * é v/scale para o passo casar com o chão.
 */
export class GiantAI {
    constructor(hero, scale, x, z, y = 0) {
        this.hero = hero;
        this.group = hero.object;
        this.scale = scale;
        this.x = x;
        this.z = z;
        this.y = y;
        this.yaw = Math.PI;
        this.state = 'sleep';
        this.alert = 0;
        this.chaseSpeed = 7.8;
        this.catchR = 3.3;
        this.hearR = 16;
        this.closeR = 5;
        this.phase = 0;
        this.alive = true;
        this.fallVy = 0;
        this.falling = false;
        this.wakeT = 0;
        this.stomp = false;
        this.steps = 0;
        this.obstacles = [];
        this.wakeTo = null;
        this.anim = { mode: 'sit', speed: 0, blend: 0.3, jaw: 0, brow: 0, blink: 0, smile: 0 };
        this.fallDir = { x: 1, z: 0 };
        this.groundFn = null;
        this.landed = false;
        this.dazeT = 0;
    }

    reset(x, z, y, yaw, state = 'sleep') {
        this.x = x;
        this.z = z;
        this.y = y;
        this.yaw = yaw;
        this.state = state;
        this.alert = state === 'sleep' ? 0 : 1;
        this.alive = true;
        this.falling = false;
        this.landed = false;
        this.dazeT = 0;
        this.fallVy = 0;
        this.wakeT = 0;
        this.phase = 0;
        this.steps = 0;
        this.group.rotation.set(0, yaw, 0);
        this.group.visible = true;
    }

    _apply(dt) {
        this.group.position.set(this.x, this.y, this.z);
        this.group.rotation.y = this.yaw;
        this.hero.update(dt, this.anim);
    }

    /**
     * @returns {'sleep'|'stir'|'waking'|'chase'|'caught'|'falling'|null}
     */
    update(dt, player, heightAt) {
        if (!this.alive) return null;
        this.stomp = false;
        const a = this.anim;
        if (this.falling) return this._fall(dt);

        this.phase += dt;
        const dx = player.x - this.x;
        const dz = player.z - this.z;
        const dist = Math.hypot(dx, dz);
        const dy = Math.abs((player.y || 0) - this.y);
        let ev = this.state;

        if (this.state === 'sleep') {
            this.alert = Math.max(0, this.alert - dt * 0.12);
            const near = dist < this.hearR && dy < 4;
            if (near) {
                this.alert += dt * (player.sprinting ? 0.55 : 0.12);
                if (dist < this.closeR) this.alert += dt * 0.4;
            }
            a.mode = 'sit';
            a.speed = 0;
            a.blink = 1;
            a.brow = 0;
            // ronco: boca abre na inspiração (0,22 Hz)
            a.jaw = 0.18 + 0.22 * Math.max(0, Math.sin(this.phase * 1.4));
            if (this.alert >= 1) {
                this.state = 'waking';
                this.wakeT = 0;
                this.alert = 1;
                ev = 'stir';
            }
        } else if (this.state === 'waking') {
            this.wakeT += dt;
            this.alert = 1;
            // levanta e sai de lado da cadeira (até `wakeTo`) antes de urrar
            a.mode = this.wakeT < 0.4 ? 'sit' : 'idle';
            if (this.wakeTo && this.wakeT > 0.4) {
                const k = 1 - Math.exp(-2.6 * dt);
                this.x += (this.wakeTo.x - this.x) * k;
                this.z += (this.wakeTo.z - this.z) * k;
                if (Math.hypot(this.wakeTo.x - this.x, this.wakeTo.z - this.z) > 1.2) {
                    a.mode = 'walk';
                    a.speed = 1.4;
                }
            }
            a.blend = 0.5;
            a.blink = 0;
            a.brow = -1;
            a.jaw = clamp(Math.sin(clamp((this.wakeT - 0.5) / 1.1, 0, 1) * Math.PI), 0, 1);
            this.yaw = lerpAngle(this.yaw, Math.atan2(dx, dz), 2.5, dt);
            if (this.wakeT > 2.2) {
                this.state = 'chase';
                a.blend = 0.25;
            }
        } else if (this.state === 'chase' && this.dazeT > 0) {
            // tonto depois de alcançar o João: fica parado e olha em volta
            this.dazeT = Math.max(0, this.dazeT - dt);
            a.mode = 'idle';
            a.speed = 0;
            a.brow = 1;
            a.jaw = 0.1;
            this.yaw += dt * 0.6;
        } else if (this.state === 'chase') {
            this.alert = 1;
            const sp = this.chaseSpeed;
            if (dist > 0.2) {
                this.yaw = lerpAngle(this.yaw, Math.atan2(dx, dz), 5, dt);
                let nx = this.x + (dx / dist) * sp * dt;
                let nz = this.z + (dz / dist) * sp * dt;
                // contorna obstáculos: empurra para fora do círculo (desliza pela tangente)
                for (const o of this.obstacles) {
                    const ox = nx - o.x;
                    const oz = nz - o.z;
                    const od = Math.hypot(ox, oz);
                    if (od < o.r && od > 1e-3) {
                        nx = o.x + (ox / od) * o.r;
                        nz = o.z + (oz / od) * o.r;
                    }
                }
                this.x = nx;
                this.z = nz;
            }
            a.mode = 'run';
            a.speed = sp / this.scale;
            a.blink = 0;
            a.brow = -1;
            a.jaw = 0.25;
            // uma passada a cada π de fase da marcha
            const steps = Math.floor(this.hero.phase / Math.PI);
            if (steps !== this.steps) {
                this.steps = steps;
                this.stomp = true;
            }
            if (dist < this.catchR && dy < 3.2) {
                ev = 'caught';
                this.dazeT = 3;
            }
        }

        this.y = heightAt ? heightAt(this.x, this.z) : this.y;
        this._apply(dt);
        if (this.state === 'sleep') {
            // cabeça caída no peito, subindo e descendo com a respiração
            const b = this.hero.bones;
            const br = Math.sin(this.phase * 1.4);
            b.head.rotation.x += 0.42 + br * 0.05;
            b.neck.rotation.x += 0.22;
            b.chest.rotation.x += 0.1 + br * 0.03;
        }
        return ev;
    }

    /**
     * Perseguição vertical no pé de feijão (capítulo V). O gigante desce abraçado
     * ao caule, do lado em que o João está, mirando ficar 3,4 m acima dele:
     *   y ← damp(y, y_João + 3,4, 1,1)
     * `axis(y, out)` devolve o centro do feixe; `radius` = distância do eixo.
     */
    chaseDown(dt, player, axis, radius = 2.2) {
        if (!this.alive || this.falling) return this.update(dt, player, null);
        this.stomp = false;
        this.state = 'chase';
        this.alert = 1;
        this.phase += dt;
        const targetY = player.y + 3.4;
        const prevY = this.y;
        this.y = damp(this.y, targetY, 1.1, dt);
        const c = axis(player.y, _a);
        const ang = Math.atan2(player.x - c.x, player.z - c.z);
        const g = axis(this.y, _b);
        this.x = g.x + Math.sin(ang) * radius;
        this.z = g.z + Math.cos(ang) * radius;
        this.yaw = ang + Math.PI; // de frente para o caule
        const a = this.anim;
        a.mode = 'climb';
        a.speed = clamp(Math.abs(this.y - prevY) / Math.max(dt, 1e-3) / 2.2, 0.25, 2);
        a.blink = 0;
        a.brow = -1;
        a.jaw = 0.3;
        this._apply(dt);
        const dist = Math.hypot(player.x - this.x, player.z - this.z);
        const dy = Math.abs(player.y - this.y);
        if (dist < 2.8 && dy < 3.4) return 'caught';
        return 'chase';
    }

    wake() {
        if (this.state === 'sleep') {
            this.state = 'waking';
            this.wakeT = 0;
        }
        this.alert = 1;
    }

    /** O pé foi cortado: o gigante despenca na direção `dir` até `groundY`. */
    drop(dir, groundFn = null) {
        this.falling = true;
        this.fallVy = 6;
        this.state = 'falling';
        if (dir) this.fallDir = dir;
        this.groundFn = groundFn;
    }

    _fall(dt) {
        const a = this.anim;
        if (!this.landed) {
            this.fallVy -= 28 * dt;
            this.y += this.fallVy * dt;
            this.x += this.fallDir.x * 9 * dt;
            this.z += this.fallDir.z * 9 * dt;
            this.group.rotation.x = Math.min(1.2, this.group.rotation.x + dt * 1.1);
            a.mode = 'fall';
            a.jaw = 1;
            a.brow = 1;
            const gy = this.groundFn ? this.groundFn(this.x, this.z) : 0;
            if (this.y <= gy) {
                this.y = gy;
                this.landed = true;
                this.stomp = true;
                this.group.rotation.x = 0;
                a.mode = 'die';
                a.phase = 1;
                a.blend = 0.05;
                a.blink = 1;
                a.jaw = 0.3;
            }
        }
        this.group.position.set(this.x, this.y, this.z);
        this.hero.update(dt, a);
        return 'falling';
    }
}

export function nearestInteractable(player, list, extra = 0.25) {
    let best = null;
    let bestD = Infinity;
    for (const it of list) {
        if (it.done) continue;
        const dy = it.y != null ? Math.abs(player.y - it.y) : 0;
        if (it.y != null && dy > (it.yReach ?? 2.4)) continue;
        const d = Math.hypot(player.x - it.x, player.z - it.z);
        if (d < it.r + extra && d < bestD) {
            best = it;
            bestD = d;
        }
    }
    return best;
}
