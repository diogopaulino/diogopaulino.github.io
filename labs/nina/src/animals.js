/**
 * Filhotes: perdidos (cada um com seu jeito), seguindo em fila, sentados no piquenique.
 *
 * Todos são criaturas com esqueleto de gfx/creature.js em idade de filhote
 * (cabeça e olhos grandes, pernas curtas); a tartaruga é modelada em turtle.js.
 *
 * Fila (trilha de migalhas): o i-ésimo seguidor mira o ponto da trilha de Nina
 * a GAP·(i+1) m atrás dela, medido sobre o caminho que ela andou:
 *   alvo_i = trilha(GAP·(i+1))            (curto demais → líder.pos − forward·GAP·(i+1))
 *   pos ← mix(pos, alvo, 1 − exp(−FOLLOW_LAMBDA·dt))
 * A andadura sai da velocidade real: v = |Δpos|/dt (suavizada), ver gaitFor().
 *
 *   passo limitado: vmax = max(1,2; v_Nina·1,25 + 0,5) + 1,5·max(0, d − 3) m/s
 *   (acompanha Nina correndo, mas não teletransporta depois de um respawn)
 *
 * Carona (Tata, a tartaruga): em terra ela anda a 0,3–0,5 m/s, então viaja no dorso
 * de Nina. Mola amortecida (semi-implícita, por eixo):
 *   a = RIDE_K·(dorso − pos) + C·(v_dorso − v),  C = 2·0,7·√RIDE_K
 *   v += a·dt;  pos += v·dt                     (balança ao frear e ao pousar)
 * Ao descer no ninho ela cai do dorso com g = 9,8 m/s² até o chão.
 *
 * Perdido: fica no seu canto alternando parado / comendo / sentado; quando Nina
 * chega a menos de 7 m ele se vira para ela e fica alerta. O patinho boia em
 * círculos no lago:  pos = origem + 1,3·(cos ωt, sin ωt), ω = 0,22 rad/s.
 *
 * Piquenique: lugar k de 7 em volta da toalha, raio 1,7 m, olhando para o centro.
 * Festa: a roda gira (0,7 rad/s) e todos pulam: y += 0,14·|sin(6t + a)|.
 */
import * as THREE from 'three';
import { createCreature } from '../../shared/gfx/creature.js';
import { createTurtle } from './turtle.js?v=23';
import { FOLLOW_GAP, FOLLOW_LAMBDA, RIDE_K, HOME } from './config.js?v=23';

const RIDE_C = 2 * 0.7 * Math.sqrt(RIDE_K);

/** preset do kit, idade (0 filhote … 1 adulto), escala de livro infantil e cores. */
const KINDS = {
    chick: {
        preset: 'chicken', age: 0.1, scale: 2.4,
        colors: {
            base: 0xf6d24a, belly: 0xfbe68a, back: 0xedbd32, tail: 0xedbd32, wing: 0xf2c63c, wingTip: 0xe2aa2c,
            beak: 0xf08a2a, leg: 0xf0962e, iris: 0x1a120c
        }
    },
    duck: {
        preset: 'duck', age: 0.12, scale: 2.3,
        colors: {
            base: 0xf3d55c, belly: 0xf9e892, back: 0xc2a23c, face: 0xf3d55c, chin: 0xf7e07a, neck: 0xf1d052, tail: 0xb49434,
            beak: 0xe88c2c, leg: 0xee8a2a, wing: 0xdcbc4c, wingTip: 0xbc9c3a, iris: 0x1a120c
        }
    },
    bunny: { preset: 'rabbit', age: 0.25, scale: 2.3, colors: { base: 0xdccab0, belly: 0xfaf4ea, back: 0xc4ad8c, chin: 0xfaf4ea } },
    lamb: { preset: 'sheep', age: 0.15, scale: 1.3, colors: { base: 0xf6f1e4, belly: 0xece4d2, face: 0x40342c, chin: 0x40342c, muzzle: 0x40342c, socks: 0x40342c, ear: 0x40342c } },
    kitten: { preset: 'cat', age: 0.2, scale: 1.75, colors: { base: 0xdc8e40, back: 0xb96c26, belly: 0xf6ead6, chin: 0xfaf2e4, muzzle: 0xf6ead6, iris: 0x7ab84a } },
    hedge: { preset: 'hedgehog', age: 0.35, scale: 2.6, colors: {} },
    turtle: { turtle: true, scale: 1.15 }
};

function wrapDelta(from, to) {
    let d = (to - from) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
}

/**
 * Andadura pela velocidade real contra as velocidades naturais do bicho:
 *   v < 0,25 → idle · v < (passo+trote)/2 → walk · v < (trote+galope)/2 → trot · senão run
 */
export function gaitFor(creature, v) {
    if (v < 0.25) return 'idle';
    const g = creature.gaits;
    if (v < (g.walk.speed + g.trot.speed) * 0.5) return 'walk';
    if (v < (g.trot.speed + g.run.speed) * 0.5) return 'trot';
    return 'run';
}

export function createFriend(def, detail = 2) {
    const kind = KINDS[def.kind];
    const creature = kind.turtle
        ? createTurtle({ scale: kind.scale })
        : createCreature(kind.preset, { detail, age: kind.age, scale: kind.scale, colors: kind.colors, seed: def.id.length * 7 + def.x | 0 });
    const mesh = creature.object;
    mesh.name = def.id;
    mesh.rotation.order = 'YXZ';
    mesh.traverse((o) => {
        if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
        }
    });
    return {
        ...def,
        creature,
        mesh,
        state: 'lost',
        yaw: Math.random() * Math.PI * 2,
        speed: 0,
        mode: 'idle',
        swim: false,
        wanderT: Math.random() * 10,
        actT: 1 + Math.random() * 3,
        act: 'idle',
        hop: 0,
        homeSlot: 0,
        seated: false,
        /** raio com que este filhote amassa a grama */
        trample: Math.max(0.45, creature.length * 0.55),
        anim: { mode: 'idle', speed: 0, lookAt: null, groundFn: null, turn: 0 },
        look: new THREE.Vector3(),
        /** velocidade da mola da carona e altura/velocidade da queda ao descer */
        rideV: new THREE.Vector3(),
        fallH: 0,
        fallV: 0
    };
}

const LOST_ACTS = ['idle', 'eat', 'idle', 'sit', 'idle', 'alert'];

function moveToward(friend, tx, tz, maxSpeed, dt) {
    const p = friend.mesh.position;
    const dx = tx - p.x;
    const dz = tz - p.z;
    const d = Math.hypot(dx, dz);
    if (d < 1e-4) return 0;
    const step = Math.min(d, maxSpeed * dt);
    p.x += (dx / d) * step;
    p.z += (dz / d) * step;
    return step / Math.max(dt, 1e-4);
}

/**
 * @param {object} friend
 * @param {number} dt
 * @param {object} ctx  { valley, nina: Vector3|null, ninaHead: Vector3, ninaYaw, ninaPitch, ninaSpeed,
 *                        back: Vector3 (dorso), backV: Vector3 (velocidade do dorso), trail(dist, out) → bool,
 *                        index, t, party }
 */
export function updateFriend(friend, dt, ctx) {
    const { valley, t } = ctx;
    const mesh = friend.mesh;
    const p = mesh.position;
    const c = friend.creature;
    const a = friend.anim;
    const px = p.x;
    const pz = p.z;
    let wantYaw = friend.yaw;
    let yawRate = 6;
    let mode = null;
    let bounce = 0;
    a.lookAt = null;

    if (friend.state === 'home') {
        const ang = friend.homeSlot * (Math.PI * 2) / 7 + 0.45 + (ctx.party ? t * 0.7 : 0);
        const radius = ctx.party ? 1.9 + Math.sin(t * 2 + ang) * 0.25 : 1.7;
        const tx = HOME.x + Math.cos(ang) * radius;
        const tz = HOME.z + Math.sin(ang) * radius;
        const d = Math.hypot(tx - p.x, tz - p.z);
        if (ctx.party) {
            moveToward(friend, tx, tz, 3.2, dt);
            friend.seated = false;
            bounce = Math.abs(Math.sin(t * 6 + ang)) * 0.14;
            wantYaw = Math.atan2(tx - px, tz - pz);
            if (d < 0.15) wantYaw = ang + Math.PI * 0.5 + Math.PI;
        } else if (d > 0.06 && !friend.seated) {
            moveToward(friend, tx, tz, 2.4, dt);
            wantYaw = Math.atan2(tx - px, tz - pz);
        } else {
            friend.seated = true;
            mode = 'sit';
            // sentado, olhando para a cesta no meio da toalha
            wantYaw = Math.atan2(HOME.x - p.x, HOME.z - p.z);
            yawRate = 4;
        }
    } else if (friend.state === 'ride' && ctx.nina) {
        // carona no dorso: mola amortecida presa ao dorso, gira junto com Nina
        const rv = friend.rideV;
        const b = ctx.back;
        if (p.distanceToSquared(b) > 9) {
            p.copy(b);
            rv.copy(ctx.backV);
        }
        const h = Math.min(dt, 1 / 30);
        rv.x += (RIDE_K * (b.x - p.x) + RIDE_C * (ctx.backV.x - rv.x)) * h;
        rv.y += (RIDE_K * (b.y - p.y) + RIDE_C * (ctx.backV.y - rv.y)) * h;
        rv.z += (RIDE_K * (b.z - p.z) + RIDE_C * (ctx.backV.z - rv.z)) * h;
        p.addScaledVector(rv, h);
        friend.yaw += wrapDelta(friend.yaw, ctx.ninaYaw) * Math.min(1, dt * 10);
        mesh.rotation.set(ctx.ninaPitch, friend.yaw, 0);
        friend.speed = 0;
        friend.swim = false;
        friend.mode = 'idle';
        a.mode = 'idle';
        a.speed = 0.2;
        a.turn = 0;
        a.groundFn = null;
        a.lookAt = null;
        c.update(dt, a);
        return;
    } else if (friend.state === 'follow' && ctx.nina) {
        const dist = FOLLOW_GAP * (ctx.index + 1) + 0.35;
        const target = friend.look;
        if (!ctx.trail(dist, target)) {
            target.set(ctx.nina.x - Math.sin(ctx.ninaYaw) * dist, 0, ctx.nina.z - Math.cos(ctx.ninaYaw) * dist);
        }
        const k = 1 - Math.exp(-FOLLOW_LAMBDA * dt);
        let sx = (target.x - p.x) * k;
        let sz = (target.z - p.z) * k;
        const d = Math.hypot(target.x - p.x, target.z - p.z);
        const vmax = Math.max(1.2, (ctx.ninaSpeed || 0) * 1.25 + 0.5) + 1.5 * Math.max(0, d - 3);
        const sl = Math.hypot(sx, sz);
        if (sl > vmax * dt) {
            sx *= (vmax * dt) / sl;
            sz *= (vmax * dt) / sl;
        }
        p.x += sx;
        p.z += sz;
        const dx = p.x - px;
        const dz = p.z - pz;
        if (Math.hypot(dx, dz) > 0.012) wantYaw = Math.atan2(dx, dz);
        else {
            // parado na fila: olha para Nina
            wantYaw = Math.atan2(ctx.nina.x - p.x, ctx.nina.z - p.z);
            yawRate = 3;
        }
        a.lookAt = ctx.ninaHead;
    } else {
        // perdido
        friend.wanderT += dt;
        friend.actT -= dt;
        if (friend.actT <= 0) {
            friend.act = LOST_ACTS[(Math.random() * LOST_ACTS.length) | 0];
            friend.actT = 2.5 + Math.random() * 3.5;
        }
        if (friend.kind === 'duck') {
            const w = friend.wanderT * 0.22;
            const tx = friend.x + Math.cos(w) * 1.3;
            const tz = friend.z + Math.sin(w) * 1.3;
            p.x += (tx - p.x) * Math.min(1, dt * 2);
            p.z += (tz - p.z) * Math.min(1, dt * 2);
            wantYaw = Math.atan2(-Math.sin(w), Math.cos(w));
            yawRate = 3;
        } else {
            p.x += (friend.x - p.x) * Math.min(1, dt * 3);
            p.z += (friend.z - p.z) * Math.min(1, dt * 3);
            mode = friend.act;
        }
        if (ctx.nina) {
            const dn = Math.hypot(ctx.nina.x - p.x, ctx.nina.z - p.z);
            if (dn < 7) {
                a.lookAt = ctx.ninaHead;
                if (friend.kind !== 'duck') {
                    wantYaw = Math.atan2(ctx.nina.x - p.x, ctx.nina.z - p.z);
                    yawRate = 2.5;
                    mode = dn < 3.2 ? 'alert' : 'idle';
                }
            }
        }
    }

    // velocidade real → andadura
    const v = Math.hypot(p.x - px, p.z - pz) / Math.max(dt, 1e-4);
    friend.speed += (v - friend.speed) * Math.min(1, dt * 10);
    const dy = wrapDelta(friend.yaw, wantYaw);
    friend.yaw += dy * Math.min(1, dt * yawRate);
    mesh.rotation.set(0, friend.yaw, 0);

    p.y = valley.floorY(p.x, p.z, c.height);
    // descendo do dorso: queda livre até o chão
    if (friend.fallH > 0) {
        friend.fallV += 9.8 * dt;
        friend.fallH = Math.max(0, friend.fallH - friend.fallV * dt);
        bounce += friend.fallH;
    }
    friend.swim = valley.swimming;
    if (friend.hop > 0) {
        friend.hop = Math.max(0, friend.hop - dt / 0.5);
        bounce += Math.sin((1 - friend.hop) * Math.PI) * 0.34;
    }
    p.y += bounce;

    if (friend.swim) mode = 'swim';
    else if (!mode || friend.speed > 0.3) mode = gaitFor(c, friend.speed);
    friend.mode = mode;
    a.mode = mode;
    a.speed = Math.max(friend.speed, 0.2);
    a.turn = Math.max(-1, Math.min(1, dy * 1.5));
    a.groundFn = friend.swim || bounce > 0.02 ? null : valley.groundFn;
    c.update(dt, a);
}
