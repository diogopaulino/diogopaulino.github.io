/**
 * Filhotes: idle perdido, seguir em fila, sentar no piquenique.
 *
 * Fila: alvo_i = líder.pos − forward * GAP * (i + 1)
 * pos ← mix(pos, alvo, 1 − exp(−FOLLOW_LAMBDA * dt))
 */

import * as THREE from 'three';
import { FOLLOW_GAP, FOLLOW_LAMBDA, HOME } from './config.js';
import { BABY_BUILDERS } from './models.js';

function wrapDelta(from, to) {
    let d = (to - from) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
}

export function createFriend(def) {
    const build = BABY_BUILDERS[def.kind];
    const mesh = build();
    mesh.name = def.id;
    mesh.userData.def = def;
    return {
        ...def,
        mesh,
        state: 'lost',
        yaw: Math.random() * Math.PI * 2,
        wanderT: Math.random() * 10,
        hop: 0,
        homeSlot: 0
    };
}

function animateParts(friend, dt, moving, t) {
    const parts = friend.mesh.userData.parts;
    if (!parts) return;
    const swing = moving ? Math.sin(t * 10) * 0.45 : Math.sin(t * 2.2) * 0.08;
    parts.legs?.forEach((leg, i) => {
        leg.rotation.x = swing * (i % 2 ? 1 : -1);
    });
    if (parts.tail) {
        parts.tail.rotation.y = Math.sin(t * 6) * 0.35;
        parts.tail.rotation.x = 0.2 + Math.sin(t * 4) * 0.12;
    }
    if (parts.head) {
        parts.head.rotation.y = Math.sin(t * 1.4 + friend.wanderT) * (moving ? 0.08 : 0.28);
    }
    if (parts.ears) {
        parts.ears.forEach((ear, i) => {
            ear.rotation.z = (i ? 1 : -1) * (0.15 + Math.sin(t * 3 + i) * 0.08);
        });
    }
    if (parts.wings) {
        const flap = Math.sin(t * 14) * 0.45;
        parts.wings[0].rotation.z = flap;
        parts.wings[1].rotation.z = -flap;
    }
}

export function updateFriend(friend, dt, world, leader, index, t, party) {
    const mesh = friend.mesh;
    const ground = (x, z) => world.groundHeight(x, z);

    if (friend.state === 'home') {
        const a = friend.homeSlot * (Math.PI * 2) / 7;
        const radius = party ? 2.6 + Math.sin(t * 2 + a) * 0.35 : 2.35;
        const tx = HOME.x + Math.cos(a + (party ? t * 0.7 : 0)) * radius;
        const tz = HOME.z + Math.sin(a + (party ? t * 0.7 : 0)) * radius;
        mesh.position.x += (tx - mesh.position.x) * Math.min(1, dt * 4);
        mesh.position.z += (tz - mesh.position.z) * Math.min(1, dt * 4);
        mesh.position.y = ground(mesh.position.x, mesh.position.z);
        friend.yaw = a + Math.PI + (party ? t : 0);
        mesh.rotation.y = friend.yaw;
        animateParts(friend, dt, party, t * (party ? 1.6 : 1));
        if (party) mesh.position.y += Math.abs(Math.sin(t * 6 + a)) * 0.18;
        return;
    }

    if (friend.state === 'follow' && leader) {
        const fwd = new THREE.Vector3(Math.sin(leader.yaw), 0, Math.cos(leader.yaw));
        const tx = leader.x - fwd.x * FOLLOW_GAP * (index + 1);
        const tz = leader.z - fwd.z * FOLLOW_GAP * (index + 1);
        const k = 1 - Math.exp(-FOLLOW_LAMBDA * dt);
        mesh.position.x += (tx - mesh.position.x) * k;
        mesh.position.z += (tz - mesh.position.z) * k;
        mesh.position.y = ground(mesh.position.x, mesh.position.z);
        const dx = tx - mesh.position.x;
        const dz = tz - mesh.position.z;
        if (Math.hypot(dx, dz) > 0.04) {
            friend.yaw = Math.atan2(dx, dz);
        } else {
            friend.yaw += wrapDelta(friend.yaw, leader.yaw) * dt * 4;
        }
        mesh.rotation.y = friend.yaw;
        animateParts(friend, dt, true, t);
        mesh.position.y += Math.abs(Math.sin(t * 8 + index)) * 0.04;
        return;
    }

    // perdido: passeio curto ao redor do ponto de spawn
    friend.wanderT += dt;
    const wobble = 0.55;
    const ox = friend.x + Math.cos(friend.wanderT * 0.6) * wobble;
    const oz = friend.z + Math.sin(friend.wanderT * 0.45) * wobble;
    mesh.position.x += (ox - mesh.position.x) * dt * 1.6;
    mesh.position.z += (oz - mesh.position.z) * dt * 1.6;
    mesh.position.y = ground(mesh.position.x, mesh.position.z) + Math.sin(t * 3 + friend.wanderT) * 0.03;
    friend.yaw += dt * 0.4;
    mesh.rotation.y = friend.yaw;
    animateParts(friend, dt, false, t);
}

