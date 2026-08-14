/**
 * Supercarro procedural: carroceria loftada, verniz (clearcoat), rodas raiadas,
 * faróis, lanternas e variantes GT / hyper / muscle / rally / roadster.
 * Eixos locais: +Z frente, +Y cima, +X direita.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const RADIAL = 14;

function ring(halfWidth, bottom, top, squareness = 2.6) {
    const points = [];
    const cy = (bottom + top) / 2;
    const halfHeight = (top - bottom) / 2;
    for (let k = 0; k < RADIAL; k++) {
        const a = (k / RADIAL) * Math.PI * 2;
        const c = Math.cos(a);
        const s = Math.sin(a);
        const p = 2 / squareness;
        points.push([
            Math.sign(c) * Math.abs(c) ** p * halfWidth,
            cy + Math.sign(s) * Math.abs(s) ** p * halfHeight
        ]);
    }
    return points;
}

function loft(sections) {
    const positions = [];
    const uvs = [];
    const indices = [];
    const rings = sections.map((s) => ring(s.w, s.b, s.t, s.sq ?? 2.6));
    rings.forEach((r, si) => {
        r.forEach(([x, y], k) => {
            positions.push(x, y, sections[si].z);
            uvs.push(k / RADIAL, si / (sections.length - 1));
        });
    });
    for (let si = 0; si < rings.length - 1; si++) {
        for (let k = 0; k < RADIAL; k++) {
            const a = si * RADIAL + k;
            const b = si * RADIAL + ((k + 1) % RADIAL);
            const c = a + RADIAL;
            const d = b + RADIAL;
            indices.push(a, c, b, b, c, d);
        }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
}

function paintMaterial(hex, { metalness = 0.42, roughness = 0.16, clearcoat = 1 } = {}) {
    return new THREE.MeshPhysicalMaterial({
        color: hex,
        metalness,
        roughness,
        clearcoat,
        clearcoatRoughness: 0.08,
        envMapIntensity: 1.35,
        sheen: 0.15,
        sheenColor: new THREE.Color(hex).lerp(new THREE.Color(0xffffff), 0.35)
    });
}

function chrome() {
    return new THREE.MeshStandardMaterial({
        color: 0xc8d0d8, metalness: 1, roughness: 0.18, envMapIntensity: 1.6
    });
}

function rubber() {
    return new THREE.MeshStandardMaterial({
        color: 0x111111, metalness: 0.15, roughness: 0.72
    });
}

function dark() {
    return new THREE.MeshStandardMaterial({
        color: 0x14161c, metalness: 0.4, roughness: 0.45
    });
}

function glass(color = 0x89b8d8, opacity = 0.42) {
    return new THREE.MeshPhysicalMaterial({
        color,
        metalness: 0.15,
        roughness: 0.06,
        transparent: true,
        opacity,
        envMapIntensity: 1.5
    });
}

function makeWheel(caliperHex, radius = 0.34) {
    const group = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.085, 10, 22), rubber());
    tire.rotation.y = Math.PI / 2;
    group.add(tire);

    const rim = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.72, radius * 0.72, 0.12, 18), chrome());
    rim.rotation.z = Math.PI / 2;
    group.add(rim);

    const disc = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.42, radius * 0.42, 0.04, 16), new THREE.MeshStandardMaterial({
        color: 0x888888, metalness: 0.85, roughness: 0.28
    }));
    disc.rotation.z = Math.PI / 2;
    group.add(disc);

    const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.16), new THREE.MeshStandardMaterial({
        color: caliperHex, metalness: 0.4, roughness: 0.35
    }));
    caliper.position.set(0.02, radius * 0.22, 0);
    group.add(caliper);

    for (let i = 0; i < 5; i++) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.035, radius * 1.15, 0.045), chrome());
        spoke.rotation.z = (i / 5) * Math.PI;
        group.add(spoke);
    }
    group.userData.spin = group;
    return group;
}

function bodySections(kind) {
    if (kind === 'hyper') {
        return [
            { z: 2.18, w: 0.28, b: 0.12, t: 0.28, sq: 3.4 },
            { z: 1.85, w: 0.78, b: 0.08, t: 0.38, sq: 2.8 },
            { z: 1.15, w: 0.98, b: 0.06, t: 0.42, sq: 2.4 },
            { z: 0.35, w: 1.02, b: 0.08, t: 0.72, sq: 2.2 },
            { z: -0.45, w: 1.00, b: 0.08, t: 0.78, sq: 2.2 },
            { z: -1.15, w: 1.04, b: 0.08, t: 0.48, sq: 2.4 },
            { z: -1.85, w: 0.96, b: 0.10, t: 0.42, sq: 2.6 },
            { z: -2.15, w: 0.72, b: 0.14, t: 0.38, sq: 3.0 }
        ];
    }
    if (kind === 'muscle') {
        return [
            { z: 2.35, w: 0.42, b: 0.16, t: 0.38, sq: 2.8 },
            { z: 1.70, w: 0.92, b: 0.10, t: 0.48, sq: 2.4 },
            { z: 0.55, w: 0.98, b: 0.10, t: 0.52, sq: 2.3 },
            { z: -0.15, w: 0.92, b: 0.12, t: 0.92, sq: 2.1 },
            { z: -0.85, w: 0.90, b: 0.12, t: 0.88, sq: 2.1 },
            { z: -1.55, w: 0.96, b: 0.12, t: 0.52, sq: 2.4 },
            { z: -2.15, w: 0.88, b: 0.14, t: 0.44, sq: 2.6 }
        ];
    }
    if (kind === 'rally') {
        return [
            { z: 1.95, w: 0.48, b: 0.22, t: 0.48, sq: 2.6 },
            { z: 1.35, w: 0.82, b: 0.16, t: 0.55, sq: 2.3 },
            { z: 0.35, w: 0.88, b: 0.16, t: 0.62, sq: 2.2 },
            { z: -0.15, w: 0.84, b: 0.16, t: 1.05, sq: 2.0 },
            { z: -0.85, w: 0.84, b: 0.16, t: 1.08, sq: 2.0 },
            { z: -1.45, w: 0.86, b: 0.16, t: 0.62, sq: 2.2 },
            { z: -1.85, w: 0.78, b: 0.18, t: 0.52, sq: 2.4 }
        ];
    }
    if (kind === 'roadster') {
        return [
            { z: 2.05, w: 0.38, b: 0.12, t: 0.32, sq: 3.0 },
            { z: 1.55, w: 0.88, b: 0.08, t: 0.42, sq: 2.5 },
            { z: 0.65, w: 0.96, b: 0.08, t: 0.46, sq: 2.3 },
            { z: 0.05, w: 0.92, b: 0.10, t: 0.62, sq: 2.2 },
            { z: -0.65, w: 0.94, b: 0.10, t: 0.52, sq: 2.2 },
            { z: -1.45, w: 0.98, b: 0.10, t: 0.44, sq: 2.4 },
            { z: -1.95, w: 0.78, b: 0.12, t: 0.38, sq: 2.8 }
        ];
    }
    // gt
    return [
        { z: 2.12, w: 0.34, b: 0.12, t: 0.32, sq: 3.1 },
        { z: 1.62, w: 0.86, b: 0.08, t: 0.42, sq: 2.5 },
        { z: 0.75, w: 0.98, b: 0.08, t: 0.46, sq: 2.3 },
        { z: 0.10, w: 0.94, b: 0.10, t: 0.78, sq: 2.15 },
        { z: -0.70, w: 0.92, b: 0.10, t: 0.82, sq: 2.15 },
        { z: -1.35, w: 0.98, b: 0.10, t: 0.48, sq: 2.4 },
        { z: -1.95, w: 0.86, b: 0.12, t: 0.42, sq: 2.7 }
    ];
}

export function buildCar(spec) {
    const root = new THREE.Group();
    const kind = spec.body || 'gt';
    const paint = paintMaterial(spec.color);
    const accent = paintMaterial(spec.accent, { metalness: 0.55, roughness: 0.22, clearcoat: 0.6 });

    const body = new THREE.Mesh(loft(bodySections(kind)), paint);
    body.castShadow = true;
    body.receiveShadow = true;
    root.add(body);

    if (kind !== 'roadster') {
        const cabin = new THREE.Mesh(loft([
            { z: 0.22, w: 0.72, b: 0.48, t: 0.92, sq: 2.4 },
            { z: -0.15, w: 0.70, b: 0.50, t: 1.08, sq: 2.2 },
            { z: -0.75, w: 0.68, b: 0.50, t: 1.05, sq: 2.2 },
            { z: -1.05, w: 0.64, b: 0.48, t: 0.78, sq: 2.5 }
        ]), glass(kind === 'rally' ? 0x334455 : 0x6aa0c8, kind === 'rally' ? 0.55 : 0.38));
        cabin.castShadow = true;
        root.add(cabin);
    } else {
        const screen = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.38, 0.04), glass());
        screen.position.set(0, 0.72, 0.22);
        screen.rotation.x = -0.55;
        root.add(screen);
        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.48), dark());
        seat.position.set(-0.22, 0.42, -0.35);
        root.add(seat);
        const seat2 = seat.clone();
        seat2.position.x = 0.22;
        root.add(seat2);
        const roll = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.025, 6, 16, Math.PI), chrome());
        roll.rotation.z = Math.PI;
        roll.position.set(0, 0.55, -0.55);
        root.add(roll);
    }

    const splitter = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.04, 0.28), accent);
    splitter.position.set(0, 0.12, 2.05);
    root.add(splitter);

    if (kind === 'hyper' || kind === 'gt') {
        const wing = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.04, 0.28), accent);
        wing.position.set(0, kind === 'hyper' ? 0.72 : 0.55, -2.02);
        wing.rotation.x = -0.12;
        root.add(wing);
        for (const side of [-0.72, 0.72]) {
            const plate = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.28, 0.32), dark());
            plate.position.set(side, kind === 'hyper' ? 0.58 : 0.42, -2.0);
            root.add(plate);
        }
    }

    const headGeo = new THREE.BoxGeometry(0.28, 0.1, 0.08);
    const headMat = new THREE.MeshStandardMaterial({
        color: 0xffffee, emissive: 0xfff2c8, emissiveIntensity: 0.8, roughness: 0.2
    });
    const headL = new THREE.Mesh(headGeo, headMat);
    headL.position.set(-0.62, 0.32, 2.08);
    const headR = headL.clone();
    headR.position.x = 0.62;
    root.add(headL, headR);

    const tailMat = new THREE.MeshStandardMaterial({
        color: 0xff2222, emissive: 0xff1a1a, emissiveIntensity: 0.55, roughness: 0.3
    });
    const tailL = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.08, 0.06), tailMat);
    tailL.position.set(-0.55, 0.38, kind === 'muscle' ? -2.18 : -2.05);
    const tailR = tailL.clone();
    tailR.position.x = 0.55;
    root.add(tailL, tailR);

    const mirrorGeo = new THREE.BoxGeometry(0.16, 0.08, 0.1);
    const mL = new THREE.Mesh(mirrorGeo, dark());
    mL.position.set(-0.95, 0.62, 0.35);
    const mR = mL.clone();
    mR.position.x = 0.95;
    root.add(mL, mR);

    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.02), new THREE.MeshStandardMaterial({
        color: 0xf2f0e6, roughness: 0.6
    }));
    plate.position.set(0, 0.28, -2.08);
    root.add(plate);

    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.12, 10), chrome());
    exhaust.rotation.x = Math.PI / 2;
    exhaust.position.set(0.28, 0.16, -2.12);
    const exhaust2 = exhaust.clone();
    exhaust2.position.x = 0.42;
    root.add(exhaust, exhaust2);

    if (kind === 'rally') {
        const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 0.42), accent);
        scoop.position.set(0, 1.12, -0.15);
        root.add(scoop);
        for (const x of [-0.22, 0, 0.22]) {
            const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 10), headMat);
            lamp.rotation.x = Math.PI / 2;
            lamp.position.set(x, 0.48, 1.95);
            root.add(lamp);
        }
    }

    const wb = spec.wheelbase || 2.7;
    const track = kind === 'hyper' ? 0.92 : kind === 'rally' ? 0.82 : 0.86;
    const wheelY = spec.ride ?? 0.14;
    const wheelR = kind === 'rally' ? 0.36 : 0.33;
    const wheels = [];
    const positions = [
        [track, wheelY, wb * 0.5],
        [-track, wheelY, wb * 0.5],
        [track, wheelY, -wb * 0.5],
        [-track, wheelY, -wb * 0.5]
    ];
    for (const [x, y, z] of positions) {
        const w = makeWheel(spec.caliper, wheelR);
        w.position.set(x, y, z);
        if (x < 0) w.rotation.y = Math.PI;
        root.add(w);
        wheels.push(w);
    }

    const lightL = new THREE.SpotLight(0xfff1d0, 0, 42, 0.42, 0.45, 1.1);
    lightL.position.set(-0.55, 0.38, 2.1);
    lightL.target.position.set(-0.55, 0.1, 12);
    root.add(lightL, lightL.target);
    const lightR = lightL.clone();
    lightR.position.x = 0.55;
    lightR.target.position.x = 0.55;
    root.add(lightR, lightR.target);

    for (const child of root.children) {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    }

    root.userData = {
        wheels,
        headlights: [lightL, lightR],
        headMats: [headMat],
        tailMat,
        paint,
        spec
    };
    return root;
}

/** Miniatura estática para o menu (mesmo builder, sem luzes). */
export function buildCarPreview(spec) {
    return buildCar(spec);
}

export function dummyCarGeo() {
    return mergeGeometries([
        new THREE.BoxGeometry(1.8, 0.5, 4.2).translate(0, 0.4, 0)
    ]);
}
