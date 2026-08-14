/**
 * O tecelão: traje vermelho e navy, visor branco, lançadores no pulso.
 * Silhueta atlética original — sem símbolos de terceiros.
 */

import * as THREE from 'three';
import { PALETTE } from './config.js';

const matCache = new Map();

function std(color, roughness = 0.62, metalness = 0.12, extra = {}) {
    const key = `${color}:${roughness}:${metalness}:${extra.emissive || 0}`;
    if (!matCache.has(key)) {
        matCache.set(key, new THREE.MeshStandardMaterial({
            color, roughness, metalness, ...extra
        }));
    }
    return matCache.get(key);
}

export function buildHero() {
    const group = new THREE.Group();
    const red = std(PALETTE.suit, 0.48, 0.18, { emissive: 0x3a0508, emissiveIntensity: 0.22 });
    const navy = std(PALETTE.navy, 0.7, 0.08);
    const dark = std(0x0a0c12, 0.55, 0.2);
    const visor = std(0xf4f7ff, 0.12, 0.55, { emissive: 0xdde8ff, emissiveIntensity: 0.85 });
    const gold = std(0xf4c15d, 0.35, 0.55, { emissive: 0x6a4010, emissiveIntensity: 0.35 });
    const skin = std(0xc48a6a, 0.7, 0.04);

    const hips = new THREE.Group();
    group.add(hips);

    const parts = { legs: [], arms: [], feet: [], hands: [] };

    for (const sx of [-1, 1]) {
        const leg = new THREE.Group();
        leg.position.set(sx * 0.12, 0.92, 0);
        hips.add(leg);
        const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.42, 8), navy);
        thigh.position.y = -0.2;
        leg.add(thigh);
        const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.052, 0.4, 8), navy);
        shin.position.y = -0.58;
        leg.add(shin);
        const boot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.22), dark);
        boot.position.set(0, -0.82, 0.04);
        leg.add(boot);
        parts.legs.push(leg);
        parts.feet.push(boot);
    }

    const torso = new THREE.Group();
    torso.position.y = 0.95;
    hips.add(torso);

    const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.38, 6, 10), red);
    chest.position.y = 0.38;
    torso.add(chest);

    const emblem = new THREE.Mesh(new THREE.OctahedronGeometry(0.07, 0), gold);
    emblem.scale.set(0.7, 1.15, 0.25);
    emblem.position.set(0, 0.48, 0.2);
    torso.add(emblem);

    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.03, 6, 16), dark);
    belt.rotation.x = Math.PI / 2;
    belt.position.y = 0.12;
    torso.add(belt);

    const head = new THREE.Group();
    head.position.y = 0.78;
    torso.add(head);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.155, 12, 10), red);
    skull.scale.set(0.95, 1.05, 1);
    head.add(skull);
    const mask = new THREE.Mesh(new THREE.SphereGeometry(0.145, 12, 10), dark);
    mask.scale.set(0.92, 0.72, 0.7);
    mask.position.set(0, -0.01, 0.04);
    head.add(mask);

    for (const sx of [-1, 1]) {
        const lens = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), visor);
        lens.scale.set(1.15, 0.72, 0.45);
        lens.position.set(sx * 0.055, 0.02, 0.13);
        head.add(lens);
    }

    for (const sx of [-1, 1]) {
        const arm = new THREE.Group();
        arm.position.set(sx * 0.26, 0.58, 0);
        torso.add(arm);
        const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.32, 8), red);
        upper.position.y = -0.14;
        arm.add(upper);
        const forearm = new THREE.Group();
        forearm.position.y = -0.32;
        arm.add(forearm);
        const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.042, 0.3, 8), red);
        lower.position.y = -0.14;
        forearm.add(lower);
        const shooter = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.1), dark);
        shooter.position.set(0, -0.28, 0.04);
        forearm.add(shooter);
        const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.06, 6), gold);
        nozzle.rotation.x = Math.PI / 2;
        nozzle.position.set(0, -0.28, 0.1);
        forearm.add(nozzle);
        const hand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), skin);
        hand.position.set(0, -0.34, 0.02);
        forearm.add(hand);
        arm.userData.forearm = forearm;
        arm.userData.hand = hand;
        parts.arms.push(arm);
        parts.hands.push(hand);
    }

    group.traverse((c) => {
        if (c.isMesh) {
            c.castShadow = true;
            c.receiveShadow = true;
        }
    });

    parts.torso = torso;
    parts.head = head;
    parts.hips = hips;
    parts.emblem = emblem;

    return { group, parts };
}

/**
 * Poses: corrida no chão, queda com braços abertos, pêndulo com braços ao âncora.
 */
export function poseHero(parts, { grounded, swinging, speed, phase, lookPitch = 0 }) {
    const run = grounded ? Math.min(1, speed / 8) : 0;
    const swing = swinging ? 1 : 0;
    const air = !grounded && !swinging ? 1 : 0;

    for (let i = 0; i < 2; i++) {
        const s = i === 0 ? 1 : -1;
        const leg = parts.legs[i];
        const arm = parts.arms[i];
        const walk = Math.sin(phase + i * Math.PI) * run;
        leg.rotation.x = walk * 0.85 + air * (-0.35 + s * 0.12) + swing * 0.55;
        arm.rotation.x = -walk * 0.7 + air * (-1.15) + swing * (-2.35);
        arm.rotation.z = s * (0.08 + air * 0.55 + swing * 0.15);
        arm.userData.forearm.rotation.x = run * 0.25 + swing * -0.35 + air * 0.4;
    }
    parts.torso.rotation.x = run * 0.12 + swing * 0.35 + air * 0.18;
    parts.head.rotation.x = lookPitch * 0.25 - swing * 0.15;
    parts.hips.rotation.z = Math.sin(phase) * run * 0.06;
}
