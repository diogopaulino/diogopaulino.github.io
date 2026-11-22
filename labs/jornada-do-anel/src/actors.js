/**
 * A Jornada do Anel — elenco e IA.
 *
 * Todo humanoide vem de `gfx/hero.js` e todo animal de `gfx/creature.js`.
 * Os arquétipos (halfling, mago, elfo, anão, cavaleiro sombrio, goblin) têm
 * figurino próprio deste lab — nada é cópia de personagem de livro ou filme.
 *
 * Regras de jogo documentadas aqui:
 *   Cavaleiro sombrio (furtividade)
 *     visto  ⇔  d < alcance·k  ∧  cos(ângulo) > FOV  ∧  linha de visão livre
 *               k = 1 andando, 1,25 correndo (quem corre aparece mais)
 *     ouvido ⇔  correndo ∧ d < 5 m (mesmo pelas costas)
 *     Troncos e rochas (colisores com `block`) cortam a linha de visão: o
 *     segmento cavaleiro→portador é testado contra cada círculo.
 *     Perseguição termina quando d > 1,6·alcance. Pegou ⇔ d < 1,35 m.
 *   Goblin (combate)
 *     ocioso → (d < 11 m) persegue → (d < 1,25 m) golpe com preparo de 0,32 s
 *     → recupera 0,75 s. Levar um golpe: recuo de 1,6 m, atordoa 0,45 s e
 *     cancela o preparo. Vida: goblin 2, orc 3.
 */

import * as THREE from 'three';
import { createHero } from '../../shared/gfx/hero.js';
import { createCreature } from '../../shared/gfx/creature.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
/** Aproxima um ângulo de outro pelo caminho mais curto. */
export function turnTo(cur, target, k) {
    let d = (target - cur) % TAU;
    if (d > Math.PI) d -= TAU;
    if (d < -Math.PI) d += TAU;
    return cur + d * k;
}

/* ------------------------------------------------------------------ */
/* Figurinos                                                            */
/* ------------------------------------------------------------------ */

/** O portador: halfling de colete ferrugem e capa curta de viagem. */
export const BEARER = {
    preset: 'hobbit', hair: 0x3d2716, hairStyle: 'curly', skin: 0xe9bd9a, eyeColor: 0x4a7a9a,
    topColor: 0xe9e0c8, vest: 0x8a3f2b, bottomColor: 0x5a4028, cape: 'short', capeColor: 0x45603a, hood: 'down',
    belt: 0x3a2618, fat: 0.18
};

const VILLAGERS = [
    { preset: 'hobbit', hair: 0x8a5a2a, vest: 0x4a6a3a, topColor: 0xefe6cf, bottomColor: 0x6a4a2c, hat: 'straw', hatColor: 0xd4b56a },
    { preset: 'hobbit', sex: 'f', hair: 0xb07a3a, hairStyle: 'bun', top: 'dress', sleeves: 'puff', topColor: 0x8a5a78, trimColor: 0xe8dcc0, bottom: 'none', apron: 0xf0e8d4, vest: null },
    { preset: 'hobbit', hair: 0x4a2c16, vest: 0x9a7a2a, topColor: 0xd8cfb4, bottomColor: 0x3f4a34, fat: 0.6, beard: 'stubble' },
    { preset: 'hobbit', sex: 'f', hair: 0x5a3018, hairStyle: 'braids', top: 'dress', sleeves: 'long', topColor: 0x4f7a6a, trimColor: 0xf0e0b0, bottom: 'none', apron: 0xe8e0cc, vest: null, hat: 'scarf', hatColor: 0xc8643a },
    { preset: 'hobbit', age: 'elder', hair: 0xd8d4cc, hairStyle: 'balding', vest: 0x5a4a6a, topColor: 0xe6e0d0, bottomColor: 0x4a3a2a, fat: 0.4 },
    { preset: 'hobbit', age: 'child', hair: 0xc89a4a, vest: null, topColor: 0x9ab0c8, bottom: 'shorts', bottomColor: 0x6a5a3a },
    { preset: 'hobbit', hair: 0x6a3a1c, vest: 0x3a5a7a, topColor: 0xe8dcc4, bottomColor: 0x5a4632, hat: 'cap', hatColor: 0x5a4a3a },
    { preset: 'hobbit', sex: 'f', hair: 0x3a2414, hairStyle: 'curly', top: 'dress', sleeves: 'short', topColor: 0xc8a43a, trimColor: 0x6a3a2a, bottom: 'none', vest: null }
];

/** Mago errante: manto azul-petróleo com barra ocre (figurino do lab). */
export const WIZARD = {
    preset: 'wizard', topColor: 0x2f5a5e, hatColor: 0x27494c, trimColor: 0xc98a3a, belt: 0x6a4424, hair: 0xe8e4da,
    cape: 'long', capeColor: 0x3a3a34, height: 1.86
};

/** O jardineiro: amigo do portador. */
export const GARDENER = {
    preset: 'hobbit', hair: 0xb8863a, skin: 0xe6b48c, vest: 0x5a6a34, topColor: 0xe2d6b8, bottomColor: 0x6a5234, fat: 0.5,
    cape: 'short', capeColor: 0x6a5a3a, hood: 'down'
};

const ELVES = [
    { preset: 'elf', top: 'robe', sleeves: 'wide', topColor: 0xd8e2e6, trimColor: 0xc9b26a, bottom: 'none', cape: 'none', hair: 0x2a1c14, hat: 'tiara', age: 'adult', height: 1.9 },
    { preset: 'elf', sex: 'f', top: 'dress', sleeves: 'wide', topColor: 0xe9e2f0, trimColor: 0xa9b6d8, bottom: 'none', cape: 'none', hair: 0xf0dca0, hat: 'tiara' },
    { preset: 'elf', topColor: 0x5a7a6a, capeColor: 0x3a5a4a, hair: 0xd8c690 },
    { preset: 'elf', top: 'robe', sleeves: 'long', topColor: 0xb8a878, trimColor: 0x6a5a3a, bottom: 'none', cape: 'none', hair: 0x6a4424 },
    { preset: 'elf', sex: 'f', top: 'dress', sleeves: 'long', topColor: 0x7a9ab0, trimColor: 0xe8e0c0, bottom: 'none', cape: 'long', capeColor: 0x4a6a80, hair: 0x3a2618 },
    { preset: 'elf', topColor: 0x7a6a8a, capeColor: 0x4a4460, hair: 0xe6e2da, hairStyle: 'ponytail' }
];

const HUMANS = [
    { preset: 'guard', tabard: 0x6a2a22, hat: 'none', hairStyle: 'short', hair: 0x4a3220, cape: 'long', capeColor: 0x3a2a22, beard: 'stubble' },
    { preset: 'peasant', hat: 'none', top: 'tunic', topColor: 0x4a5a44, cape: 'long', capeColor: 0x2f3a30, hood: 'down', hair: 0x2a1c14, beard: 'full', shoes: 'tall' }
];

const cast = (def, detail, extra = {}) => createHero({ ...def, ...extra, detail });

export const makeBearer = (detail = 2) => cast(BEARER, detail);
export const makeVillager = (i, detail = 1) => cast(VILLAGERS[i % VILLAGERS.length], detail);
export const makeWizard = (detail = 2) => cast(WIZARD, detail);
export const makeGardener = (detail = 2) => cast(GARDENER, detail);
export const makeElf = (i, detail = 1) => cast(ELVES[i % ELVES.length], detail);
export const makeHuman = (i, detail = 1) => cast(HUMANS[i % HUMANS.length], detail);
export const makeDwarf = (detail = 1) => cast({ preset: 'dwarf', hair: 0x8a3a18, armorColor: 0x9a968c, topColor: 0x5a2f24 }, detail);

/** Cavaleiro sombrio: manto, capa longa e capuz erguido, tudo preto; pele preta = rosto oculto. */
export function makeDarkRider(detail = 1) {
    return createHero({
        height: 1.92, build: 0.2, skin: 0x030303, hair: 0x030303, hairStyle: 'bald', eyeColor: 0x000000, lipColor: 0x030303, brows: 0,
        top: 'robe', sleeves: 'wide', topColor: 0x0b0b0d, trimColor: 0x141416, bottom: 'none', shoes: 'tall', shoeColor: 0x060606,
        cape: 'long', capeColor: 0x08080a, mantle: true, hood: 'up', gloves: 'gauntlet', gloveColor: 0x1a1a1e, belt: 0x101012, detail
    });
}

const GOBLIN_SKINS = [0x86a05a, 0x7a9462, 0x93a86a, 0x6f8a58, 0x8a9a52];
export function makeGoblin(i, detail = 1, big = false) {
    if (big) return createHero({ preset: 'orc', skin: 0x5f7a50, height: 1.78, armorColor: 0x3a3028, detail });
    return createHero({
        preset: 'goblin', skin: GOBLIN_SKINS[i % GOBLIN_SKINS.length], topColor: [0x5a4a32, 0x4a3a3a, 0x3f4a3a][i % 3],
        vest: [0x3a2a1c, 0x2a2a30, null][i % 3], hat: i % 4 === 1 ? 'bandana' : 'none', hatColor: 0x5a1c1c, detail
    });
}

/* ------------------------------------------------------------------ */
/* Figurantes                                                           */
/* ------------------------------------------------------------------ */

/**
 * Figurante: parado num modo (idle, talk, sit, wave, cheer) ou andando em
 * circuito por pontos. `look` faz a cabeça seguir o portador quando perto.
 */
export class Extra {
    constructor(hero, { x, z, yaw = 0, mode = 'idle', path = null, speed = 1.2, heightAt, lookRange = 6, y = null }) {
        this.hero = hero;
        this.x = x;
        this.z = z;
        this.yaw = yaw;
        this.path = path;
        this.wp = 0;
        this.speed = speed;
        this.baseMode = mode;
        this.heightAt = heightAt;
        this.fixedY = y;
        this.lookRange = lookRange;
        this.state = { mode, speed: 0 };
        this.pause = 0;
        this.look = new THREE.Vector3();
        this.sync();
    }

    sync() {
        this.hero.object.position.set(this.x, this.fixedY ?? this.heightAt(this.x, this.z), this.z);
        this.hero.object.rotation.y = this.yaw;
    }

    update(dt, player) {
        if (this.path) {
            if (this.pause > 0) {
                this.pause -= dt;
                this.state.mode = 'idle';
                this.state.speed = 0;
            } else {
                const w = this.path[this.wp];
                const dx = w.x - this.x;
                const dz = w.z - this.z;
                const d = Math.hypot(dx, dz);
                if (d < 0.5) {
                    this.wp = (this.wp + 1) % this.path.length;
                    this.pause = w.wait ?? 0;
                } else {
                    this.x += (dx / d) * this.speed * dt;
                    this.z += (dz / d) * this.speed * dt;
                    this.yaw = turnTo(this.yaw, Math.atan2(dx, dz), Math.min(1, dt * 5));
                }
                this.state.mode = this.baseMode === 'idle' ? 'walk' : this.baseMode;
                this.state.speed = this.speed;
            }
            this.sync();
        }
        if (player && this.lookRange > 0) {
            const d = Math.hypot(player.x - this.x, player.z - this.z);
            if (d < this.lookRange) this.hero.lookAt(this.look.set(player.x, player.y + 0.95, player.z));
            else this.hero.lookAt(null);
        }
        this.hero.update(dt, this.state);
    }
}

/** Bicho solto: alterna entre andar a esmo dentro de um raio e ciscar/pastar. */
export class Critter {
    constructor(creature, { x, z, radius = 5, heightAt, modes = ['idle', 'eat'], blocked = null }) {
        this.c = creature;
        this.home = { x, z };
        this.x = x;
        this.z = z;
        this.radius = radius;
        this.yaw = Math.random() * TAU;
        this.heightAt = heightAt;
        this.modes = modes;
        this.blocked = blocked;
        this.t = 1 + Math.random() * 4;
        this.walking = false;
        this.state = { mode: 'idle', groundFn: heightAt };
        this.speed = creature.gaits?.walk?.speed ?? 0.6;
        this.sync();
    }

    sync() {
        this.c.object.position.set(this.x, this.heightAt(this.x, this.z), this.z);
        this.c.object.rotation.y = this.yaw;
    }

    update(dt) {
        this.t -= dt;
        if (this.t <= 0) {
            this.walking = !this.walking;
            this.t = this.walking ? 2 + Math.random() * 3 : 3 + Math.random() * 5;
            if (this.walking) {
                const a = Math.random() * TAU;
                const r = Math.random() * this.radius;
                this.tx = this.home.x + Math.cos(a) * r;
                this.tz = this.home.z + Math.sin(a) * r;
            } else {
                this.state.mode = this.modes[(Math.random() * this.modes.length) | 0];
            }
        }
        if (this.walking) {
            const dx = this.tx - this.x;
            const dz = this.tz - this.z;
            const d = Math.hypot(dx, dz);
            if (d < 0.3) this.t = 0;
            else {
                const nx = this.x + (dx / d) * this.speed * dt;
                const nz = this.z + (dz / d) * this.speed * dt;
                if (this.blocked?.(nx, nz)) this.t = 0;
                else {
                    this.x = nx;
                    this.z = nz;
                }
                this.yaw = turnTo(this.yaw, Math.atan2(dx, dz), Math.min(1, dt * 4));
                this.state.mode = 'walk';
            }
            this.sync();
        }
        this.c.update(dt, this.state);
    }
}

/* ------------------------------------------------------------------ */
/* Cavaleiro sombrio                                                    */
/* ------------------------------------------------------------------ */

/** Segmento (ax,az)→(bx,bz) cruza algum colisor que bloqueia a visão? */
export function sightBlocked(ax, az, bx, bz, colliders) {
    const dx = bx - ax;
    const dz = bz - az;
    const len2 = dx * dx + dz * dz || 1;
    for (let i = 0; i < colliders.length; i++) {
        const c = colliders[i];
        if (!c.block) continue;
        const t = clamp(((c.x - ax) * dx + (c.z - az) * dz) / len2, 0, 1);
        if (t < 0.04 || t > 0.96) continue;
        const ex = ax + dx * t - c.x;
        const ez = az + dz * t - c.z;
        const r = c.r + 0.35;
        if (ex * ex + ez * ez < r * r) return true;
    }
    return false;
}

export class Rider {
    /**
     * @param {object} horse  createCreature('horse', { coat: 'black', saddle: true })
     * @param {object} hero   cavaleiro (fica preso ao socket `back` do cavalo, em modo `ride`)
     */
    constructor(horse, hero, x, z, waypoints) {
        this.horse = horse;
        this.hero = hero;
        this.group = horse.object;
        this.x = x;
        this.z = z;
        this.yaw = 0;
        this.waypoints = waypoints;
        this.wp = 0;
        this.state = 'patrol';
        // velocidades casadas com as andaduras do cavalo (o casco não patina)
        this.speed = clamp(horse.gaits?.trot?.speed ?? 3.6, 2.8, 4.2);
        this.chaseSpeed = clamp(horse.gaits?.run?.speed ?? 7.4, 6.6, 7.6);
        this.vision = 16;
        this.fov = 0.62;
        this.alive = true;
        this.catchR = 1.35;
        this.alert = 0;
        this.horseState = { mode: 'trot', groundFn: null, lookAt: null };
        this.heroState = { mode: 'ride', speed: 1 };
        this.look = new THREE.Vector3();
        this.pauseT = 0;
        /** s de "cegueira" depois de alcançar o portador: dá tempo de fugir (jogo infantil, sem castigo em cadeia). */
        this.blindT = 0;
    }

    update(dt, player, world) {
        if (!this.alive) return null;
        this.blindT = Math.max(0, this.blindT - dt);
        const heightAt = world.heightAt;
        const dx = player.x - this.x;
        const dz = player.z - this.z;
        const dist = Math.hypot(dx, dz);
        const fx = Math.sin(this.yaw);
        const fz = Math.cos(this.yaw);
        const facing = dist > 0.01 ? (dx * fx + dz * fz) / dist : 0;
        const k = player.sprinting ? 1.25 : 1;
        const clear = dist < this.vision * k && !sightBlocked(this.x, this.z, player.x, player.z, world.colliders);
        const seen = clear && facing > this.fov && this.blindT <= 0;
        const heard = player.sprinting && player.moving && dist < 5 && this.blindT <= 0;

        if (seen || heard) {
            this.state = 'chase';
            this.alert = 1;
        } else if (this.state === 'chase' && dist > this.vision * 1.6) {
            this.state = 'patrol';
        } else if (clear && facing > 0.2) {
            // na borda do campo de visão: o medidor sobe devagar, sem disparar a perseguição
            this.alert = Math.min(0.5, this.alert + dt * 0.5);
        }

        let tx;
        let tz;
        if (this.state === 'chase') {
            tx = player.x;
            tz = player.z;
        } else {
            const w = this.waypoints[this.wp];
            tx = w.x;
            tz = w.z;
            if (Math.hypot(this.x - tx, this.z - tz) < 1.6) {
                this.wp = (this.wp + 1) % this.waypoints.length;
                this.pauseT = 1.6; // para e fareja
            }
        }

        this.pauseT = Math.max(0, this.pauseT - dt);
        const halted = this.state !== 'chase' && this.pauseT > 0;
        const sp = halted ? 0 : this.state === 'chase' ? this.chaseSpeed : this.speed;
        const ax = tx - this.x;
        const az = tz - this.z;
        const al = Math.hypot(ax, az) || 1;
        this.yaw = turnTo(this.yaw, Math.atan2(ax / al, az / al), Math.min(1, dt * (this.state === 'chase' ? 3.2 : 1.8)));
        this.x += Math.sin(this.yaw) * sp * dt;
        this.z += Math.cos(this.yaw) * sp * dt;
        this.alert = Math.max(0, this.alert - dt * 0.35);

        this.group.position.set(this.x, heightAt(this.x, this.z), this.z);
        this.group.rotation.y = this.yaw;
        const hs = this.horseState;
        hs.mode = halted ? 'alert' : this.state === 'chase' ? 'run' : 'trot';
        hs.speed = sp;
        hs.groundFn = heightAt;
        hs.lookAt = this.state === 'chase' ? this.look.set(player.x, player.y + 1, player.z) : null;
        this.horse.update(dt, hs);
        this.heroState.speed = halted ? 0.2 : this.state === 'chase' ? 1.6 : 1;
        this.hero.lookAt(this.state === 'chase' || halted ? this.look.set(player.x, player.y + 1, player.z) : null);
        this.hero.update(dt, this.heroState);

        if (dist < this.catchR && this.blindT <= 0) {
            // alcançou: perde o rastro por 4 s e para para farejar (o portador escapa)
            this.state = 'patrol';
            this.alert = 0.4;
            this.blindT = 4;
            this.pauseT = 2.2;
            return 'caught';
        }
        if (this.state === 'chase') return 'chase';
        return null;
    }
}

/**
 * Monta o cavaleiro no cavalo: a raiz do herói vai para o socket `back`,
 * rebaixada de `seatHeight` (em `ride` a pelve desce até a altura do assento).
 */
export function mount(horse, hero, { forward = 0, lift = 0 } = {}) {
    const socket = horse.sockets.back;
    socket.add(hero.object);
    hero.object.position.set(0, -hero.seatHeight + lift, forward);
    hero.object.rotation.set(0, 0, 0);
    return hero;
}

export function makeBlackHorse(detail = 1, seed = 1) {
    return createCreature('horse', { coat: 'black', saddle: true, detail, seed: 1, scale: 1.06 + (seed % 3) * 0.02 });
}

/* ------------------------------------------------------------------ */
/* Goblins                                                              */
/* ------------------------------------------------------------------ */

export class GoblinAI {
    constructor(hero, x, z, { hp = 2, speed = 3.2, big = false, heightAt } = {}) {
        this.hero = hero;
        this.group = hero.object;
        this.x = x;
        this.z = z;
        this.yaw = Math.random() * TAU;
        this.hp = hp;
        this.alive = true;
        this.big = big;
        this.speed = speed;
        this.aggro = 11;
        this.hitR = big ? 1.5 : 1.25;
        this.mode = 'idle'; // idle | chase | attack | recover | stagger | dead
        this.t = 0;
        this.struck = false;
        this.kx = 0;
        this.kz = 0;
        this.wanderT = Math.random() * 2;
        this.wanderGo = false;
        this.deadT = 0;
        this.state = { mode: 'idle', speed: 0, phase: undefined, duration: undefined };
        this.look = new THREE.Vector3();
        this.group.position.set(x, heightAt ? heightAt(x, z) : 0, z);
        this.group.rotation.y = this.yaw;
    }

    /** Leva um golpe vindo de (fx, fz). Devolve true se morreu. */
    hit(fx = this.x, fz = this.z) {
        if (!this.alive) return false;
        this.hp -= 1;
        const dx = this.x - fx;
        const dz = this.z - fz;
        const d = Math.hypot(dx, dz) || 1;
        // recuo: 1,6 m dissipados em ~0,3 s (v0 = 9 m/s com amortecimento 6/s)
        this.kx = (dx / d) * (this.big ? 5 : 9);
        this.kz = (dz / d) * (this.big ? 5 : 9);
        this.t = 0;
        if (this.hp <= 0) {
            this.alive = false;
            this.mode = 'dead';
            return true;
        }
        this.mode = 'stagger';
        return false;
    }

    update(dt, player, world) {
        const st = this.state;
        st.phase = undefined;
        this.t += dt;
        let event = null;

        // recuo com amortecimento exponencial
        if (this.kx || this.kz) {
            const nx = this.x + this.kx * dt;
            const nz = this.z + this.kz * dt;
            if (!world.blockedAt(nx, nz, 0.4) && world.heightAt(nx, nz) > world.heightAt(this.x, this.z) - 1) {
                this.x = nx;
                this.z = nz;
            }
            const damp = Math.exp(-6 * dt);
            this.kx *= damp;
            this.kz *= damp;
            if (Math.abs(this.kx) + Math.abs(this.kz) < 0.05) this.kx = this.kz = 0;
        }

        if (this.mode === 'dead') {
            st.mode = 'die';
            st.phase = Math.min(1, this.t / 1.2);
            this.deadT += dt;
            // o corpo afunda no chão depois de 6 s
            const sink = Math.max(0, this.deadT - 6) * 0.35;
            this.group.position.set(this.x, world.heightAt(this.x, this.z) - sink, this.z);
            if (sink > 0.9) this.group.visible = false;
            this.hero.lookAt(null);
            this.hero.update(dt, st);
            return null;
        }

        const dx = player.x - this.x;
        const dz = player.z - this.z;
        const dist = Math.hypot(dx, dz);
        const awake = player.alive && dist < this.aggro && Math.abs(player.y - world.heightAt(this.x, this.z)) < 3;

        if (this.mode === 'stagger') {
            st.mode = 'hit';
            st.phase = Math.min(1, this.t / 0.45);
            if (this.t >= 0.45) this.mode = 'chase';
        } else if (this.mode === 'attack') {
            st.mode = 'attack';
            st.phase = Math.min(1, this.t / 0.7);
            this.yaw = turnTo(this.yaw, Math.atan2(dx, dz), Math.min(1, dt * 6));
            if (!this.struck && this.t >= 0.32) {
                this.struck = true;
                if (dist < this.hitR + 0.35) event = 'hit';
            }
            if (this.t >= 0.7) {
                this.mode = 'recover';
                this.t = 0;
            }
        } else if (this.mode === 'recover') {
            st.mode = 'idle';
            if (this.t >= 0.75) this.mode = 'chase';
        } else if (awake) {
            this.mode = 'chase';
            this.yaw = turnTo(this.yaw, Math.atan2(dx, dz), Math.min(1, dt * 7));
            if (dist < this.hitR) {
                this.mode = 'attack';
                this.t = 0;
                this.struck = false;
                st.mode = 'attack';
                st.phase = 0;
            } else {
                const nx = this.x + Math.sin(this.yaw) * this.speed * dt;
                const nz = this.z + Math.cos(this.yaw) * this.speed * dt;
                // não pula no abismo atrás do portador
                if (world.heightAt(nx, nz) > world.heightAt(this.x, this.z) - 1.2 && !world.blockedAt(nx, nz, 0.3)) {
                    this.x = nx;
                    this.z = nz;
                    st.mode = 'run';
                    st.speed = this.speed;
                } else {
                    st.mode = 'idle';
                }
            }
        } else {
            this.mode = 'idle';
            this.wanderT -= dt;
            if (this.wanderT <= 0) {
                this.wanderGo = !this.wanderGo;
                this.wanderT = this.wanderGo ? 1.2 + Math.random() * 1.5 : 1.5 + Math.random() * 3;
                if (this.wanderGo) this.yaw += (Math.random() - 0.5) * 2.4;
            }
            if (this.wanderGo) {
                const nx = this.x + Math.sin(this.yaw) * 1.1 * dt;
                const nz = this.z + Math.cos(this.yaw) * 1.1 * dt;
                if (world.heightAt(nx, nz) > world.heightAt(this.x, this.z) - 0.6 && !world.blockedAt(nx, nz, 0.3)) {
                    this.x = nx;
                    this.z = nz;
                    st.mode = 'walk';
                    st.speed = 1.1;
                } else {
                    this.wanderGo = false;
                    st.mode = 'idle';
                }
            } else {
                st.mode = 'idle';
            }
        }

        this.group.position.set(this.x, world.heightAt(this.x, this.z), this.z);
        this.group.rotation.y = this.yaw;
        this.hero.lookAt(awake ? this.look.set(player.x, player.y + 0.9, player.z) : null);
        this.hero.update(dt, st);
        return event;
    }
}

export function nearestInteractable(player, list, extra = 0.2) {
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

export { createCreature };
