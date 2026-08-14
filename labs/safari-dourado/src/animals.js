/**
 * Animais da savana — modelos em primitivas + comportamentos simples.
 *
 * Cada espécie devolve um Group com `userData.parts` para animar patas,
 * pescoço e tromba. A IA é wander + beber no poço + fugir do jeep.
 */

import * as THREE from 'three';
import { WATER, WORLD_RADIUS } from './config.js';
import { clamp, damp, wrapPi, hash2 } from './utils.js';
import { elephantTexture, zebraTexture, giraffeTexture } from './textures.js';
import { std } from './models.js';

function shadows(root) {
    root.traverse((c) => {
        if (c.isMesh) {
            c.castShadow = true;
            c.receiveShadow = true;
        }
    });
}

function mapped(map, color = 0xffffff, roughness = 0.85) {
    return new THREE.MeshStandardMaterial({ map, color, roughness, metalness: 0.02 });
}

function addLegs(parent, hipY, spread, length, radius, mat, parts) {
    const geo = new THREE.CylinderGeometry(radius * 0.85, radius, length, 7);
    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
        const leg = new THREE.Group();
        leg.position.set(sx * spread, hipY, sz * spread * 0.85);
        parent.add(leg);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.y = -length * 0.5;
        leg.add(mesh);
        parts.legs.push(leg);
    }
}

export function buildElephant() {
    const group = new THREE.Group();
    const skin = mapped(elephantTexture(), 0xb0a8a0, 0.9);
    const dark = std(0x4a4038, 0.85);
    const ivory = std(0xf0e6d0, 0.4, 0.08);
    const parts = { legs: [], trunk: null, head: null, ears: [], tail: null };

    const body = new THREE.Mesh(new THREE.SphereGeometry(1.35, 14, 10), skin);
    body.scale.set(1.15, 0.95, 1.55);
    body.position.y = 1.85;
    group.add(body);

    addLegs(group, 1.55, 0.72, 1.55, 0.28, skin, parts);

    const head = new THREE.Group();
    head.position.set(0, 2.15, 1.55);
    group.add(head);
    parts.head = head;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.72, 12, 10), skin);
    skull.scale.set(1.05, 0.9, 1.1);
    head.add(skull);

    for (const sx of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 8), skin);
        ear.scale.set(0.18, 1.05, 0.85);
        ear.position.set(sx * 0.72, 0.05, -0.1);
        head.add(ear);
        parts.ears.push(ear);

        const tusk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 0.85, 8), ivory);
        tusk.position.set(sx * 0.28, -0.35, 0.55);
        tusk.rotation.x = 0.85;
        tusk.rotation.z = sx * -0.25;
        head.add(tusk);
    }

    const trunk = new THREE.Group();
    trunk.position.set(0, -0.15, 0.62);
    head.add(trunk);
    parts.trunk = trunk;
    let prev = trunk;
    for (let i = 0; i < 4; i++) {
        const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.16 - i * 0.025, 0.18 - i * 0.025, 0.42, 8), skin);
        const wrap = new THREE.Group();
        wrap.position.y = i === 0 ? -0.18 : -0.4;
        prev.add(wrap);
        seg.position.y = -0.2;
        wrap.add(seg);
        prev = wrap;
        if (i === 0) parts.trunkSegs = [wrap];
        else parts.trunkSegs.push(wrap);
    }

    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 1.1, 5), dark);
    tail.position.set(0, 1.7, -2.05);
    tail.rotation.x = 0.45;
    group.add(tail);
    parts.tail = tail;

    shadows(group);
    group.userData.parts = parts;
    group.userData.height = 3.2;
    return group;
}

export function buildGiraffe() {
    const group = new THREE.Group();
    const hide = mapped(giraffeTexture(), 0xe8c060, 0.78);
    const dark = std(0x3a2414, 0.8);
    const parts = { legs: [], neck: null, head: null };

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.85, 12, 9), hide);
    body.scale.set(0.85, 0.75, 1.45);
    body.position.y = 2.55;
    group.add(body);

    addLegs(group, 2.35, 0.38, 2.45, 0.12, hide, parts);

    const neck = new THREE.Group();
    neck.position.set(0, 3.05, 0.55);
    group.add(neck);
    parts.neck = neck;
    const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 3.4, 8), hide);
    neckMesh.position.y = 1.7;
    neckMesh.rotation.x = 0.12;
    neck.add(neckMesh);

    const head = new THREE.Group();
    head.position.set(0, 3.45, 0.35);
    neck.add(head);
    parts.head = head;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), hide);
    skull.scale.set(0.7, 0.7, 1.35);
    head.add(skull);
    const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.38, 8), hide);
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.z = 0.38;
    head.add(muzzle);
    for (const sx of [-1, 1]) {
        const oss = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.18, 5), dark);
        oss.position.set(sx * 0.1, 0.28, -0.05);
        head.add(oss);
        const ossTip = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), dark);
        ossTip.position.set(sx * 0.1, 0.38, -0.05);
        head.add(ossTip);
    }

    shadows(group);
    group.userData.parts = parts;
    group.userData.height = 6.4;
    return group;
}

export function buildZebra() {
    const group = new THREE.Group();
    const hide = mapped(zebraTexture(), 0xffffff, 0.78);
    const dark = std(0x1a1612, 0.7);
    const parts = { legs: [], neck: null, head: null, tail: null };

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.72, 12, 9), hide);
    body.scale.set(0.85, 0.8, 1.55);
    body.position.y = 1.35;
    group.add(body);

    addLegs(group, 1.2, 0.32, 1.15, 0.09, hide, parts);

    const neck = new THREE.Group();
    neck.position.set(0, 1.7, 0.85);
    group.add(neck);
    parts.neck = neck;
    const neckM = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.7, 8), hide);
    neckM.position.y = 0.28;
    neckM.rotation.x = 0.45;
    neck.add(neckM);

    const head = new THREE.Group();
    head.position.set(0, 0.62, 0.28);
    neck.add(head);
    parts.head = head;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 7), hide);
    skull.scale.set(0.7, 0.65, 1.3);
    head.add(skull);
    const mane = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.55, 0.45), dark);
    mane.position.set(0, 0.22, -0.15);
    neck.add(mane);

    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.85, 5), dark);
    tail.position.set(0, 1.35, -1.15);
    tail.rotation.x = 0.6;
    group.add(tail);
    parts.tail = tail;

    shadows(group);
    group.userData.parts = parts;
    group.userData.height = 2.1;
    return group;
}

export function buildLion() {
    const group = new THREE.Group();
    const fur = std(0xc48a3a, 0.88);
    const mane = std(0x6a3a14, 0.92);
    const dark = std(0x2a1a10, 0.7);
    const parts = { legs: [], head: null, tail: null };

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 9), fur);
    body.scale.set(0.95, 0.75, 1.55);
    body.position.y = 0.95;
    group.add(body);

    addLegs(group, 0.85, 0.32, 0.82, 0.11, fur, parts);

    const head = new THREE.Group();
    head.position.set(0, 1.25, 0.95);
    group.add(head);
    parts.head = head;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.38, 10, 8), fur);
    head.add(skull);
    for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        const puff = new THREE.Mesh(new THREE.SphereGeometry(0.22, 7, 6), mane);
        puff.position.set(Math.cos(a) * 0.38, Math.sin(a * 1.3) * 0.18, Math.sin(a) * 0.22 - 0.08);
        head.add(puff);
    }
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), fur);
    muzzle.position.set(0, -0.08, 0.32);
    muzzle.scale.set(1, 0.7, 1.1);
    head.add(muzzle);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), dark);
    nose.position.set(0, -0.02, 0.48);
    head.add(nose);

    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.95, 5), fur);
    tail.position.set(0, 1.05, -1.15);
    tail.rotation.x = 0.5;
    group.add(tail);
    const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), dark);
    tuft.position.set(0, 0.62, -1.55);
    group.add(tuft);
    parts.tail = tail;

    shadows(group);
    group.userData.parts = parts;
    group.userData.height = 1.6;
    return group;
}

export function buildGazelle() {
    const group = new THREE.Group();
    const hide = std(0xd2a060, 0.8);
    const white = std(0xf2ead8, 0.75);
    const dark = std(0x2a1a10, 0.7);
    const parts = { legs: [], neck: null, head: null };

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), hide);
    body.scale.set(0.8, 0.75, 1.55);
    body.position.y = 0.95;
    group.add(body);
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), white);
    belly.scale.set(0.7, 0.5, 1.2);
    belly.position.set(0, 0.72, 0.05);
    group.add(belly);

    addLegs(group, 0.85, 0.18, 0.85, 0.05, hide, parts);

    const neck = new THREE.Group();
    neck.position.set(0, 1.2, 0.5);
    group.add(neck);
    parts.neck = neck;
    const neckM = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.55, 6), hide);
    neckM.position.y = 0.22;
    neckM.rotation.x = 0.35;
    neck.add(neckM);

    const head = new THREE.Group();
    head.position.set(0, 0.5, 0.18);
    neck.add(head);
    parts.head = head;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), hide);
    skull.scale.set(0.7, 0.65, 1.25);
    head.add(skull);
    for (const sx of [-1, 1]) {
        const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.03, 0.38, 5), dark);
        horn.position.set(sx * 0.06, 0.28, -0.02);
        horn.rotation.z = sx * 0.15;
        horn.rotation.x = -0.15;
        head.add(horn);
    }

    shadows(group);
    group.userData.parts = parts;
    group.userData.height = 1.45;
    return group;
}

export function buildWildebeest() {
    const group = new THREE.Group();
    const hide = std(0x5a4a3a, 0.88);
    const beard = std(0x2a2218, 0.9);
    const parts = { legs: [], head: null, neck: null };

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.78, 12, 9), hide);
    body.scale.set(0.95, 0.85, 1.55);
    body.position.y = 1.35;
    group.add(body);

    addLegs(group, 1.15, 0.34, 1.15, 0.1, hide, parts);

    const neck = new THREE.Group();
    neck.position.set(0, 1.55, 0.95);
    group.add(neck);
    parts.neck = neck;
    const neckM = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 0.55, 8), hide);
    neckM.position.y = 0.1;
    neckM.rotation.x = 0.7;
    neck.add(neckM);

    const head = new THREE.Group();
    head.position.set(0, 0.15, 0.45);
    neck.add(head);
    parts.head = head;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 7), hide);
    skull.scale.set(0.75, 0.7, 1.2);
    head.add(skull);
    const beardM = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.4, 6), beard);
    beardM.position.set(0, -0.28, 0.15);
    head.add(beardM);
    for (const sx of [-1, 1]) {
        const horn = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.035, 5, 10, Math.PI * 0.8), beard);
        horn.position.set(sx * 0.18, 0.18, 0);
        horn.rotation.y = sx * 0.4;
        horn.rotation.z = sx * 0.3;
        head.add(horn);
    }

    shadows(group);
    group.userData.parts = parts;
    group.userData.height = 2.0;
    return group;
}

export function buildHippo() {
    const group = new THREE.Group();
    const skin = std(0x8a6a68, 0.78);
    const dark = std(0x2a1a18, 0.6);
    const parts = { head: null };

    const body = new THREE.Mesh(new THREE.SphereGeometry(1.15, 12, 9), skin);
    body.scale.set(1.05, 0.75, 1.45);
    body.position.y = 0.55;
    group.add(body);

    const head = new THREE.Group();
    head.position.set(0, 0.7, 1.15);
    group.add(head);
    parts.head = head;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), skin);
    skull.scale.set(1.05, 0.7, 1.25);
    head.add(skull);
    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), skin);
    snout.scale.set(1.15, 0.55, 1.1);
    snout.position.set(0, -0.08, 0.45);
    head.add(snout);
    for (const sx of [-1, 1]) {
        const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), dark);
        nostril.position.set(sx * 0.16, 0.08, 0.82);
        head.add(nostril);
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), dark);
        eye.position.set(sx * 0.32, 0.22, 0.28);
        head.add(eye);
    }

    shadows(group);
    group.userData.parts = parts;
    group.userData.height = 1.2;
    return group;
}

export function buildFlamingo() {
    const group = new THREE.Group();
    const pink = std(0xf0a0a8, 0.55);
    const deep = std(0xe07078, 0.5);
    const dark = std(0x2a1a18, 0.6);
    const parts = { neck: null, head: null, leg: null };

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), pink);
    body.scale.set(0.85, 0.7, 1.35);
    body.position.y = 1.15;
    group.add(body);

    const neck = new THREE.Group();
    neck.position.set(0, 1.28, 0.22);
    group.add(neck);
    parts.neck = neck;
    const n1 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.55, 6), pink);
    n1.position.y = 0.25;
    n1.rotation.x = -0.35;
    neck.add(n1);
    const head = new THREE.Group();
    head.position.set(0, 0.55, 0.18);
    neck.add(head);
    parts.head = head;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), pink);
    head.add(skull);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 6), dark);
    beak.rotation.x = 1.35;
    beak.position.set(0, -0.04, 0.16);
    head.add(beak);

    const leg = new THREE.Group();
    leg.position.set(0.04, 1.05, 0);
    group.add(leg);
    parts.leg = leg;
    const lm = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.05, 5), deep);
    lm.position.y = -0.52;
    leg.add(lm);

    const wing = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), deep);
    wing.scale.set(0.35, 0.55, 1.1);
    wing.position.set(0.18, 1.18, -0.05);
    group.add(wing);

    shadows(group);
    group.userData.parts = parts;
    group.userData.height = 1.7;
    return group;
}

const BUILDERS = {
    elephant: buildElephant,
    giraffe: buildGiraffe,
    lion: buildLion,
    zebra: buildZebra,
    gazelle: buildGazelle,
    wildebeest: buildWildebeest,
    hippo: buildHippo,
    flamingo: buildFlamingo
};

function animateLegs(parts, phase, amp = 0.55) {
    if (!parts?.legs) return;
    parts.legs.forEach((leg, i) => {
        const s = i % 2 === 0 ? 1 : -1;
        leg.rotation.x = Math.sin(phase + (i > 1 ? Math.PI : 0)) * amp * s * 0.35;
    });
}

/**
 * População da savana: manadas, um par de leões no kopje, hipopótamos no poço.
 */
export class Wildlife {
    constructor(scene, world, quality) {
        this.scene = scene;
        this.world = world;
        this.animals = [];
        this._fwd = new THREE.Vector3();
        this.spawnAll(quality);
    }

    spawnAll(quality) {
        const scale = quality.id === 'low' ? 0.55 : quality.id === 'medium' ? 0.8 : 1;
        this.herd('elephant', 3, 48, 0.4, scale);
        this.herd('giraffe', 4, 70, 0.2, scale);
        this.herd('zebra', 8, 95, 0.15, scale);
        this.herd('wildebeest', 7, 110, 0.15, scale);
        this.herd('gazelle', 9, 80, 0.2, scale);
        this.placeLions();
        this.placeHippos(Math.max(2, Math.round(3 * scale)));
        this.placeFlamingos(Math.max(6, Math.round(10 * scale)));
    }

    herd(species, count, radius, tightness, scale) {
        const n = Math.max(2, Math.round(count * scale));
        const a0 = hash2(n, radius, species.length) * Math.PI * 2;
        const cx = Math.cos(a0) * radius;
        const cz = Math.sin(a0) * radius;
        for (let i = 0; i < n; i++) {
            const a = a0 + (i / n) * Math.PI * 2 * tightness + hash2(i, 3, 9) * 1.4;
            const r = 4 + hash2(i, 7, 2) * 14;
            this.spawn(species, cx + Math.cos(a) * r, cz + Math.sin(a) * r, {
                homeX: cx,
                homeZ: cz,
                homeR: 22
            });
        }
    }

    placeLions() {
        const kopjes = this.world.kopjes;
        const spots = kopjes.length ? kopjes.slice(0, 2) : [{ x: 55, z: -40 }, { x: -70, z: 30 }];
        spots.forEach((k, i) => {
            this.spawn('lion', k.x + (i ? 2 : -1), k.z + 1.5, {
                homeX: k.x,
                homeZ: k.z,
                homeR: 8,
                rest: true
            });
        });
    }

    placeHippos(n) {
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2;
            const r = 8 + hash2(i, 1, 4) * 10;
            this.spawn('hippo', Math.cos(a) * r, Math.sin(a) * r, {
                aquatic: true,
                homeX: 0,
                homeZ: 0,
                homeR: WATER.radius - 6
            });
        }
    }

    placeFlamingos(n) {
        for (let i = 0; i < n; i++) {
            const a = 0.4 + (i / n) * 1.6;
            const r = WATER.radius - 2 + hash2(i, 2, 5) * 5;
            this.spawn('flamingo', Math.cos(a) * r, Math.sin(a) * r, {
                wader: true,
                homeX: Math.cos(0.9) * (WATER.radius + 2),
                homeZ: Math.sin(0.9) * (WATER.radius + 2),
                homeR: 10
            });
        }
    }

    spawn(species, x, z, extra = {}) {
        const build = BUILDERS[species];
        if (!build) return null;
        const mesh = build();
        const s = 0.92 + hash2(x, z, 3) * 0.22;
        mesh.scale.setScalar(s);
        const y = extra.aquatic
            ? WATER.surfaceY - 0.15
            : this.world.heightAt(x, z);
        mesh.position.set(x, y, z);
        mesh.rotation.y = hash2(x, z, 8) * Math.PI * 2;
        this.scene.add(mesh);

        const animal = {
            id: `${species}-${this.animals.length}`,
            species,
            mesh,
            parts: mesh.userData.parts,
            x,
            z,
            y,
            yaw: mesh.rotation.y,
            speed: 0,
            phase: hash2(x, z, 1) * Math.PI * 2,
            state: extra.rest ? 'rest' : extra.aquatic ? 'swim' : 'graze',
            timer: 1 + hash2(x, z, 2) * 4,
            homeX: extra.homeX ?? x,
            homeZ: extra.homeZ ?? z,
            homeR: extra.homeR ?? 24,
            aquatic: Boolean(extra.aquatic),
            wader: Boolean(extra.wader),
            rest: Boolean(extra.rest),
            action: 'idle',
            photographed: 0,
            scale: s
        };
        this.animals.push(animal);
        return animal;
    }

    update(dt, jeep, time) {
        const jx = jeep.x;
        const jz = jeep.z;
        const jSpeed = Math.abs(jeep.speed);

        for (const a of this.animals) {
            a.timer -= dt;
            const dx = a.x - jx;
            const dz = a.z - jz;
            const dist = Math.hypot(dx, dz);

            if (!a.aquatic && !a.rest && dist < 11 && jSpeed > 4) {
                a.state = 'flee';
                a.timer = 2.2;
                a.action = 'run';
            } else if (a.rest && dist < 9 && jSpeed > 3) {
                a.state = 'alert';
                a.timer = 2;
                a.action = 'roar';
            }

            if (a.timer <= 0) {
                this.pickState(a);
            }

            this.steer(a, dt);
            this.animate(a, dt, time);

            a.y = a.aquatic
                ? WATER.surfaceY - 0.12 + Math.sin(time * 0.8 + a.phase) * 0.08
                : this.world.heightAt(a.x, a.z);
            a.mesh.position.set(a.x, a.y, a.z);
            a.mesh.rotation.y = a.yaw;
        }
    }

    pickState(a) {
        const r = hash2(a.x, a.z, a.timer + 3);
        if (a.aquatic) {
            a.state = r > 0.35 ? 'swim' : 'idle';
            a.timer = 3 + r * 5;
            a.action = a.state === 'swim' ? 'walk' : 'idle';
            return;
        }
        if (a.wader) {
            a.state = r > 0.5 ? 'wander' : 'idle';
            a.timer = 2 + r * 4;
            a.action = a.state === 'wander' ? 'walk' : 'idle';
            return;
        }
        if (a.rest) {
            a.state = r > 0.82 ? 'wander' : 'rest';
            a.timer = 4 + r * 8;
            a.action = a.state === 'rest' ? 'idle' : 'walk';
            return;
        }
        if (r < 0.18 && Math.hypot(a.x, a.z) < WATER.shore + 18) {
            a.state = 'drink';
            a.timer = 4 + r * 3;
            a.action = 'drink';
            return;
        }
        a.state = r > 0.45 ? 'wander' : 'graze';
        a.timer = 3 + r * 6;
        a.action = a.state === 'wander' ? 'walk' : 'idle';
    }

    steer(a, dt) {
        let targetSpeed = 0;
        let turn = 0;

        if (a.state === 'flee') {
            targetSpeed = a.species === 'gazelle' ? 14 : a.species === 'zebra' ? 11 : 7;
            const away = Math.atan2(a.x - a.homeX, a.z - a.homeZ);
            turn = wrapPi(away - a.yaw);
        } else if (a.state === 'wander' || a.state === 'swim') {
            targetSpeed = a.aquatic ? 1.4 : a.species === 'elephant' ? 2.2 : a.species === 'giraffe' ? 2.6 : 3.4;
            const toHome = Math.atan2(a.homeX - a.x, a.homeZ - a.z);
            const distHome = Math.hypot(a.x - a.homeX, a.z - a.homeZ);
            const wander = a.yaw + Math.sin(a.phase * 0.3) * 0.4;
            const desired = distHome > a.homeR ? toHome : wander;
            turn = wrapPi(desired - a.yaw);
        } else if (a.state === 'drink') {
            const toWater = Math.atan2(-a.x, -a.z);
            turn = wrapPi(toWater - a.yaw);
            const r = Math.hypot(a.x, a.z);
            targetSpeed = r > WATER.shore + 2 ? 2.4 : 0;
            if (r <= WATER.shore + 2) a.action = 'drink';
        } else {
            targetSpeed = 0;
        }

        a.yaw = wrapPi(a.yaw + clamp(turn, -1.8, 1.8) * dt);
        a.speed = damp(a.speed, targetSpeed, 3.2, dt);
        a.x += Math.sin(a.yaw) * a.speed * dt;
        a.z += Math.cos(a.yaw) * a.speed * dt;

        const lim = WORLD_RADIUS - 8;
        const rr = Math.hypot(a.x, a.z);
        if (rr > lim) {
            a.x *= lim / rr;
            a.z *= lim / rr;
        }

        if (a.aquatic) {
            const wr = Math.hypot(a.x, a.z);
            const maxR = WATER.radius - 4;
            if (wr > maxR) {
                a.x *= maxR / wr;
                a.z *= maxR / wr;
            }
        }

        if (!a.aquatic && !a.wader) {
            const wr = Math.hypot(a.x, a.z);
            if (wr < WATER.radius - 1) {
                const s = (WATER.radius + 2) / Math.max(wr, 0.01);
                a.x *= s;
                a.z *= s;
            }
        }
    }

    animate(a, dt, time) {
        a.phase += dt * (1.8 + a.speed * 1.4);
        const parts = a.parts;
        animateLegs(parts, a.phase, a.speed > 0.4 ? 1 : 0.15);

        if (parts?.neck) {
            const bob = a.action === 'drink' ? 0.85 : Math.sin(a.phase * 0.5) * 0.08;
            parts.neck.rotation.x = damp(parts.neck.rotation.x, bob, 4, dt);
        }
        if (parts?.head && a.species === 'lion' && a.action === 'roar') {
            parts.head.rotation.x = Math.sin(time * 8) * 0.12 - 0.15;
        }
        if (parts?.trunkSegs) {
            parts.trunkSegs.forEach((seg, i) => {
                seg.rotation.x = Math.sin(time * 1.2 + i) * 0.18 + (a.action === 'drink' ? 0.4 : 0.1);
            });
        }
        if (parts?.ears) {
            parts.ears.forEach((ear, i) => {
                ear.rotation.y = Math.sin(time * 2 + i) * 0.12;
            });
        }
        if (a.species === 'flamingo' && parts?.leg) {
            parts.leg.rotation.x = a.action === 'idle' ? 0.15 : Math.sin(a.phase) * 0.2;
        }
    }

    /** Animal mais próximo do centro da tela, para o sistema de foto. */
    forEach(fn) {
        this.animals.forEach(fn);
    }
}
