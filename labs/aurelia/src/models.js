/**
 * Peças da cidade submersa e a medusa — geometria compartilhada, sem assets externos.
 */

import * as THREE from 'three';
import { jellyMaterial } from './shaders.js';

export function createSharedGeo() {
    return {
        col: new THREE.CylinderGeometry(1, 1.15, 1, 10),
        box: new THREE.BoxGeometry(1, 1, 1),
        sphere: new THREE.SphereGeometry(1, 14, 10),
        sphereHi: new THREE.SphereGeometry(1, 28, 18),
        torus: new THREE.TorusGeometry(1, 0.12, 10, 28),
        cone: new THREE.ConeGeometry(1, 2, 7),
        plane: new THREE.PlaneGeometry(1, 1, 1, 1),
        kelp: new THREE.PlaneGeometry(0.35, 8, 1, 8),
        bell: new THREE.SphereGeometry(1, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.62),
        tent: new THREE.CylinderGeometry(0.045, 0.012, 2.4, 5, 6),
        arm: new THREE.CylinderGeometry(0.09, 0.04, 1.3, 6, 4),
        fish: new THREE.ConeGeometry(0.12, 0.42, 5)
    };
}

export function tintUniforms(u, pal) {
    u.uZenith.value.setHex(pal.zenith);
    u.uHorizon.value.setHex(pal.horizon);
    u.uSand.value.setHex(pal.sand);
    u.uStone.value.setHex(pal.stone);
    u.uGlowA.value.setHex(pal.glowA);
    u.uGlowB.value.setHex(pal.glowB);
    u.uFog.value.setHex(pal.fog);
    u.uJelly.value.setHex(pal.jelly);
}

export function makeColumn(geo, mat, height, radius) {
    const mesh = new THREE.Mesh(geo.col, mat);
    mesh.scale.set(radius, height, radius);
    mesh.position.y = height * 0.5;
    const cap = new THREE.Mesh(geo.box, mat);
    cap.scale.set(radius * 2.4, 0.35, radius * 2.4);
    cap.position.y = height;
    const g = new THREE.Group();
    g.add(mesh, cap);
    return g;
}

export function makeArch(geo, mat, width, height) {
    const g = new THREE.Group();
    const r = 0.55;
    const left = new THREE.Mesh(geo.col, mat);
    left.scale.set(r, height, r);
    left.position.set(-width * 0.5, height * 0.5, 0);
    const right = left.clone();
    right.position.x = width * 0.5;
    const beam = new THREE.Mesh(geo.box, mat);
    beam.scale.set(width + r * 2, 0.7, 1.1);
    beam.position.y = height;
    const ring = new THREE.Mesh(geo.torus, mat);
    ring.scale.set(width * 0.38, width * 0.38, 1);
    ring.position.y = height * 0.55;
    g.add(left, right, beam, ring);
    return g;
}

export function makeTemple(geo, mat) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(geo.box, mat);
    base.scale.set(6.4, 0.7, 6.4);
    base.position.y = 0.35;
    g.add(base);
    for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const col = makeColumn(geo, mat, 5.4, 0.42);
        col.position.set(Math.cos(a) * 2.3, 0.7, Math.sin(a) * 2.3);
        g.add(col);
    }
    const roof = new THREE.Mesh(geo.cone, mat);
    roof.scale.set(4.2, 2.4, 4.2);
    roof.position.y = 7.4;
    g.add(roof);
    return g;
}

export function makeRock(geo, mat, rng) {
    const g = new THREE.Group();
    const n = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
        const m = new THREE.Mesh(geo.sphere, mat);
        const s = 0.8 + rng() * 2.2;
        m.scale.set(s, s * (0.5 + rng() * 0.5), s * (0.7 + rng() * 0.5));
        m.position.set((rng() - 0.5) * 2.2, s * 0.35, (rng() - 0.5) * 2.2);
        m.rotation.set(rng() * 1.2, rng() * 6, rng());
        g.add(m);
    }
    return g;
}

export function makeStatue(geo, mat) {
    const g = new THREE.Group();
    const plinth = new THREE.Mesh(geo.box, mat);
    plinth.scale.set(1.6, 0.5, 1.6);
    plinth.position.y = 0.25;
    const body = new THREE.Mesh(geo.box, mat);
    body.scale.set(0.9, 2.4, 0.7);
    body.position.y = 1.7;
    const head = new THREE.Mesh(geo.sphere, mat);
    head.scale.set(0.55, 0.7, 0.55);
    head.position.y = 3.2;
    g.add(plinth, body, head);
    return g;
}

export function makeCoral(geo, mats, rng) {
    const g = new THREE.Group();
    const n = 3 + Math.floor(rng() * 4);
    for (let i = 0; i < n; i++) {
        const m = new THREE.Mesh(geo.cone, rng() > 0.5 ? mats.glowA : mats.glowB);
        const h = 0.8 + rng() * 2.4;
        m.scale.set(0.18 + rng() * 0.22, h, 0.18 + rng() * 0.22);
        m.position.set((rng() - 0.5) * 1.8, h * 0.5, (rng() - 0.5) * 1.8);
        m.rotation.z = (rng() - 0.5) * 0.5;
        g.add(m);
    }
    return g;
}

/**
 * Medusa de luz: campana translúcida, braços orais e tentáculos ondulantes.
 * `userData.pulse` e `userData.hit` alimentam o shader.
 */
export function createJellyfish(THREE, geo, pal) {
    const root = new THREE.Group();
    const u = {
        uJelly: { value: new THREE.Color(pal.jelly) },
        uGlowA: { value: new THREE.Color(pal.glowA) },
        uPulse: { value: 0 },
        uHit: { value: 0 }
    };
    const bellMat = jellyMaterial(THREE, u);
    const bell = new THREE.Mesh(geo.bell, bellMat);
    bell.scale.set(1.15, 1.05, 1.15);

    const inner = new THREE.Mesh(
        geo.sphereHi,
        new THREE.MeshBasicMaterial({
            color: pal.glowA,
            transparent: true,
            opacity: 0.55,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        })
    );
    inner.scale.set(0.48, 0.38, 0.48);
    inner.position.y = 0.12;

    const tentMat = new THREE.MeshBasicMaterial({
        color: pal.jelly,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const tentacles = [];
    for (let i = 0; i < 10; i++) {
        const t = new THREE.Mesh(geo.tent, tentMat);
        const a = (i / 10) * Math.PI * 2;
        t.position.set(Math.cos(a) * 0.55, -1.05, Math.sin(a) * 0.55);
        t.userData.seed = a;
        tentacles.push(t);
        root.add(t);
    }
    const arms = [];
    for (let i = 0; i < 4; i++) {
        const t = new THREE.Mesh(geo.arm, tentMat);
        const a = (i / 4) * Math.PI * 2 + 0.4;
        t.position.set(Math.cos(a) * 0.22, -0.55, Math.sin(a) * 0.22);
        t.userData.seed = a;
        arms.push(t);
        root.add(t);
    }

    const light = new THREE.PointLight(pal.glowA, 4.5, 18, 2);
    light.position.y = 0.2;

    root.add(bell, inner, light);
    root.userData = { pulse: u, inner, tentacles, arms, light, bell, tentMat };
    return root;
}
