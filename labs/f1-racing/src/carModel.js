/**
 * Procedural Formula 1 car — lofted monocoque, multi-element wings, halo,
 * driver helmet, carbon accents, compound-coloured tyre sidewalls and animated DRS.
 * Local axes: +Z forward, +Y up, +X to the car's right.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { carbonTexture, liveryTexture } from './textures.js';

const RADIAL = 16;

function ring(halfWidth, bottom, top, squareness = 3.2) {
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
    const rings = sections.map((s) => ring(s.w, s.b, s.t, s.sq ?? 3.2));

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

    const capStart = positions.length / 3;
    const first = sections[0];
    const last = sections[sections.length - 1];
    positions.push(0, (first.b + first.t) / 2, first.z);
    positions.push(0, (last.b + last.t) / 2, last.z);
    uvs.push(0.5, 0, 0.5, 1);
    const nose = capStart, tail = capStart + 1;
    for (let k = 0; k < RADIAL; k++) {
        indices.push(nose, k, (k + 1) % RADIAL);
        const base = (rings.length - 1) * RADIAL;
        indices.push(tail, base + ((k + 1) % RADIAL), base + k);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
}

function tint(geometry, hex) {
    const color = new THREE.Color(hex);
    const count = geometry.attributes.position.count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geometry;
}

function box(w, h, d, x, y, z, hex, rotX = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (rotX) g.rotateX(rotX);
    g.translate(x, y, z);
    return tint(g, hex);
}

function cylinder(rTop, rBottom, height, x, y, z, hex, axis = 'y', segments = 12) {
    const g = new THREE.CylinderGeometry(rTop, rBottom, height, segments);
    if (axis === 'x') g.rotateZ(Math.PI / 2);
    if (axis === 'z') g.rotateX(Math.PI / 2);
    g.translate(x, y, z);
    return tint(g, hex);
}

function wing({ z, halfSpan, chord, elements, y, colorMain, colorFlap, endplateHeight, endplateColor }) {
    const parts = [];
    for (let e = 0; e < elements; e++) {
        const f = e / Math.max(1, elements - 1);
        const g = new THREE.BoxGeometry(halfSpan * 2 * (1 - f * 0.05), 0.028, chord * (1 - f * 0.22));
        g.rotateX(-0.14 - f * 0.2);
        g.translate(0, y + f * 0.1, z + f * 0.09);
        parts.push(tint(g, e === 0 ? colorMain : colorFlap));
    }
    // Slot gaps / cascade fences
    for (let e = 0; e < elements - 1; e++) {
        for (const side of [-0.55, -0.2, 0.2, 0.55]) {
            parts.push(box(0.02, 0.08, 0.12, side * halfSpan, y + 0.06 + e * 0.08, z + 0.05 + e * 0.08, endplateColor));
        }
    }
    for (const side of [-1, 1]) {
        const plate = new THREE.BoxGeometry(0.032, endplateHeight, chord * 1.3);
        plate.translate(side * halfSpan, y + endplateHeight / 2 - 0.04, z + 0.04);
        parts.push(tint(plate, endplateColor));
        // Footplate
        parts.push(box(0.22, 0.02, chord * 0.9, side * (halfSpan - 0.08), y + 0.02, z, endplateColor));
    }
    return parts;
}

function buildWheel(radius, width, rimColor, compoundColor) {
    const parts = [];
    const tyre = new THREE.CylinderGeometry(radius, radius, width, 28, 1, false);
    tyre.rotateZ(Math.PI / 2);
    parts.push(tint(tyre, 0x111218));

    for (const side of [-1, 1]) {
        const shoulder = new THREE.CylinderGeometry(radius * 0.985, radius * 0.88, width * 0.1, 28);
        shoulder.rotateZ(Math.PI / 2);
        shoulder.translate(side * width * 0.52, 0, 0);
        parts.push(tint(shoulder, 0x0c0d10));

        // Sidewall compound stripe
        const stripe = new THREE.CylinderGeometry(radius * 0.9, radius * 0.9, 0.018, 28);
        stripe.rotateZ(Math.PI / 2);
        stripe.translate(side * width * 0.48, 0, 0);
        parts.push(tint(stripe, new THREE.Color(compoundColor).getHex()));
    }

    const rim = new THREE.CylinderGeometry(radius * 0.66, radius * 0.66, width * 0.82, 24);
    rim.rotateZ(Math.PI / 2);
    parts.push(tint(rim, rimColor));

    // Hub
    parts.push(cylinder(radius * 0.18, radius * 0.18, width * 0.7, 0, 0, 0, 0x2a2e36, 'x', 16));

    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const spoke = new THREE.BoxGeometry(width * 0.72, radius * 0.55, 0.028);
        spoke.rotateX(a);
        parts.push(tint(spoke, rimColor));
    }

    // Valve stem detail
    parts.push(cylinder(0.012, 0.012, 0.04, width * 0.35, radius * 0.55, 0, 0x888c94, 'y', 6));

    return mergeGeometries(parts, false);
}

function buildDriver(helmetColor, suitColor) {
    const parts = [];
    // Helmet shell
    const helmet = new THREE.SphereGeometry(0.18, 16, 12);
    helmet.scale(1.05, 0.95, 1.15);
    helmet.translate(0, 0.92, 0.22);
    parts.push(tint(helmet, helmetColor));

    // Visor
    const visor = new THREE.SphereGeometry(0.155, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.45);
    visor.scale(1.02, 0.7, 1.1);
    visor.translate(0, 0.9, 0.28);
    parts.push(tint(visor, 0x0a1018));

    // HANS / collar
    parts.push(box(0.32, 0.08, 0.28, 0, 0.78, 0.18, 0x1a1c22));

    // Shoulders / suit
    parts.push(box(0.42, 0.16, 0.35, 0, 0.62, 0.15, suitColor));
    parts.push(box(0.28, 0.2, 0.22, 0, 0.55, 0.05, suitColor));

    // Steering wheel rim
    const wheel = new THREE.TorusGeometry(0.12, 0.018, 8, 20);
    wheel.rotateX(Math.PI / 2);
    wheel.translate(0, 0.58, 0.48);
    parts.push(tint(wheel, 0x111318));
    parts.push(box(0.1, 0.04, 0.08, 0, 0.58, 0.48, 0x22262e));

    return parts;
}

/**
 * @param {object} team
 * @returns {{group: THREE.Group, api: object}}
 */
export function buildCar(team, { quality, isPlayer = false, compoundColor = '#e8404a' } = {}) {
    const primary = team.primary;
    const secondary = team.secondary;
    const accent = team.accent;

    const bodySections = [
        { z: 2.78, w: 0.09, b: 0.13, t: 0.22, sq: 2.3 },
        { z: 2.4, w: 0.15, b: 0.11, t: 0.30 },
        { z: 1.85, w: 0.22, b: 0.10, t: 0.40 },
        { z: 1.15, w: 0.32, b: 0.09, t: 0.50 },
        { z: 0.5, w: 0.42, b: 0.08, t: 0.62 },
        { z: 0.0, w: 0.50, b: 0.08, t: 0.68, sq: 3.6 },
        { z: -0.55, w: 0.64, b: 0.08, t: 0.74, sq: 4.0 },
        { z: -1.15, w: 0.60, b: 0.09, t: 0.82, sq: 3.6 },
        { z: -1.8, w: 0.42, b: 0.11, t: 0.74 },
        { z: -2.4, w: 0.26, b: 0.13, t: 0.56 },
        { z: -2.82, w: 0.16, b: 0.15, t: 0.42, sq: 2.5 }
    ];

    const paintParts = [tint(loft(bodySections), primary)];
    const darkParts = [];
    const carbonParts = [];

    // Floor, plank, diffuser.
    carbonParts.push(box(1.95, 0.045, 4.7, 0, 0.05, -0.35, 0x0e1014));
    carbonParts.push(box(1.05, 0.02, 3.2, 0, 0.028, -0.2, 0x2a1808)); // skid plank wood
    carbonParts.push(box(1.55, 0.3, 0.72, 0, 0.18, -2.58, 0x0a0c10, -0.3));
    for (const side of [-1, -0.55, -0.2, 0.2, 0.55, 1]) {
        carbonParts.push(box(0.018, 0.28, 0.68, side * 0.55, 0.16, -2.58, 0x0c0e12, -0.3));
    }

    // Floor edge + bargeboards.
    for (const side of [-1, 1]) {
        carbonParts.push(box(0.045, 0.22, 3.4, side * 0.98, 0.14, -0.15, 0x0c0e12));
        carbonParts.push(box(0.2, 0.38, 0.85, side * 0.88, 0.26, 0.85, 0x0c0e12, -0.12));
        carbonParts.push(cylinder(0.018, 0.018, 0.42, side * 0.82, 0.48, 0.65, 0x1a1e26, 'z'));
        // Sidepod undercut scoop
        carbonParts.push(box(0.35, 0.14, 0.9, side * 0.7, 0.2, -0.4, 0x080a0e));
    }

    // Sidepod inlets + cooling louvres + paint accents.
    for (const side of [-1, 1]) {
        darkParts.push(box(0.45, 0.32, 0.12, side * 0.64, 0.38, 0.08, 0x06080c));
        paintParts.push(box(0.09, 0.24, 1.15, side * 0.68, 0.64, -1.0, accent));
        for (let i = 0; i < 5; i++) {
            carbonParts.push(box(0.28, 0.012, 0.08, side * 0.55, 0.72, -0.6 - i * 0.14, 0x101318));
        }
    }

    // Cockpit opening + halo surround.
    darkParts.push(box(0.55, 0.08, 1.0, 0, 0.68, 0.28, 0x06070a));
    paintParts.push(box(0.62, 0.18, 0.32, 0, 0.76, -0.18, secondary));

    // Driver
    paintParts.push(...buildDriver(accent, secondary));

    // Airbox + engine cover fin.
    const airbox = new THREE.SphereGeometry(0.3, 14, 12);
    airbox.scale(1, 0.92, 1.55);
    airbox.translate(0, 0.88, -0.65);
    paintParts.push(tint(airbox, primary));
    darkParts.push(box(0.18, 0.22, 0.3, 0, 0.92, -0.52, 0x040508));
    paintParts.push(box(0.032, 0.34, 1.2, 0, 0.88, -1.58, accent));

    // Shark fin tip light housing
    paintParts.push(box(0.04, 0.06, 0.12, 0, 1.02, -2.1, accent));

    // Halo.
    const halo = new THREE.TorusGeometry(0.46, 0.042, 10, 28, Math.PI * 1.15);
    halo.rotateY(Math.PI / 2);
    halo.rotateZ(Math.PI * 0.42);
    halo.translate(0, 0.74, 0.32);
    carbonParts.push(tint(halo, 0x16181e));
    carbonParts.push(cylinder(0.048, 0.048, 0.36, 0, 0.8, 0.78, 0x16181e, 'y'));

    // Mirrors + camera.
    for (const side of [-1, 1]) {
        darkParts.push(box(0.17, 0.09, 0.07, side * 0.52, 0.7, 0.52, 0x1c1f25));
        carbonParts.push(cylinder(0.018, 0.018, 0.22, side * 0.42, 0.7, 0.52, 0x1c1f25, 'x'));
    }
    darkParts.push(box(0.08, 0.06, 0.1, 0, 0.95, 0.55, 0x111318)); // T-cam

    // Nose tip camera / number plate area
    paintParts.push(box(0.22, 0.08, 0.18, 0, 0.22, 2.55, secondary));

    // Wings.
    paintParts.push(...wing({
        z: 2.55, halfSpan: 1.02, chord: 0.44, elements: 4, y: 0.13,
        colorMain: primary, colorFlap: accent, endplateHeight: 0.38, endplateColor: secondary
    }));
    paintParts.push(...wing({
        z: -2.74, halfSpan: 0.54, chord: 0.36, elements: 2, y: 0.8,
        colorMain: primary, colorFlap: accent, endplateHeight: 0.55, endplateColor: secondary
    }));
    paintParts.push(box(1.05, 0.045, 0.28, 0, 0.35, -2.68, secondary, -0.18));

    // Suspension wishbones + pushrods.
    for (const zAxle of [1.72, -1.72]) {
        for (const side of [-1, 1]) {
            for (const dz of [0.24, -0.24]) {
                const arm = new THREE.CylinderGeometry(0.022, 0.022, 0.7, 6);
                arm.rotateZ(Math.PI / 2);
                arm.translate(side * 0.42, zAxle > 0 ? 0.26 : 0.3, zAxle + dz);
                carbonParts.push(tint(arm, 0x1e222a));
            }
            // Pushrod
            const push = new THREE.CylinderGeometry(0.016, 0.016, 0.55, 6);
            push.rotateZ(side * 0.55);
            push.rotateX(zAxle > 0 ? -0.4 : 0.35);
            push.translate(side * 0.35, 0.45, zAxle);
            carbonParts.push(tint(push, 0xc8ccd2));
        }
    }

    // Brake ducts
    for (const zAxle of [1.72, -1.72]) {
        for (const side of [-1, 1]) {
            carbonParts.push(box(0.14, 0.16, 0.22, side * 0.62, 0.32, zAxle + 0.15, 0x0a0c10));
        }
    }

    const paintMaterial = new THREE.MeshPhysicalMaterial({
        vertexColors: true,
        roughness: 0.14,
        metalness: 0.55,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05,
        envMapIntensity: 2.6,
        reflectivity: 0.9
    });
    const darkMaterial = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.72,
        metalness: 0.25,
        envMapIntensity: 0.8
    });
    const carbonMaterial = new THREE.MeshPhysicalMaterial({
        vertexColors: true,
        map: carbonTexture(),
        roughness: 0.45,
        metalness: 0.55,
        clearcoat: 0.6,
        clearcoatRoughness: 0.2,
        envMapIntensity: 1.4
    });

    const group = new THREE.Group();

    const bodyMesh = new THREE.Mesh(mergeGeometries(paintParts, false), paintMaterial);
    const trimMesh = new THREE.Mesh(mergeGeometries(darkParts, false), darkMaterial);
    const carbonMesh = new THREE.Mesh(mergeGeometries(carbonParts, false), carbonMaterial);
    for (const mesh of [bodyMesh, trimMesh, carbonMesh]) {
        mesh.castShadow = quality.shadows;
        mesh.receiveShadow = false;
        group.add(mesh);
    }

    // Livery decal on engine cover.
    const livery = liveryTexture(team);
    const decalMat = new THREE.MeshStandardMaterial({
        map: livery,
        transparent: true,
        roughness: 0.35,
        metalness: 0.2,
        polygonOffset: true,
        polygonOffsetFactor: -2
    });
    const noseDecal = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.35), decalMat);
    noseDecal.position.set(0, 0.38, 2.15);
    noseDecal.rotation.x = -0.55;
    group.add(noseDecal);

    const coverDecal = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.4), decalMat);
    coverDecal.position.set(0, 0.95, -1.2);
    coverDecal.rotation.x = -1.15;
    group.add(coverDecal);

    /* --- DRS flap ------------------------------------------------- */
    const drsPivot = new THREE.Group();
    drsPivot.position.set(0, 0.96, -2.76);
    const drsFlap = new THREE.Mesh(
        tint(new THREE.BoxGeometry(1.05, 0.035, 0.28), accent),
        paintMaterial
    );
    drsFlap.castShadow = quality.shadows;
    drsPivot.add(drsFlap);
    // Endplate tips on flap
    for (const side of [-1, 1]) {
        const tip = new THREE.Mesh(tint(new THREE.BoxGeometry(0.03, 0.12, 0.28), secondary), paintMaterial);
        tip.position.set(side * 0.52, 0.04, 0);
        drsPivot.add(tip);
    }
    group.add(drsPivot);

    /* --- wheels --------------------------------------------------- */
    const wheelMaterial = new THREE.MeshStandardMaterial({
        vertexColors: true, roughness: 0.82, metalness: 0.28, envMapIntensity: 0.6
    });
    const discMaterial = new THREE.MeshStandardMaterial({
        color: 0x2a1810, emissive: 0xff3a08, emissiveIntensity: 0, roughness: 0.45, metalness: 0.5
    });

    const wheels = [];
    const discs = [];
    const layout = [
        { x: 0.8, z: 1.72, r: 0.355, w: 0.305, steer: true },
        { x: -0.8, z: 1.72, r: 0.355, w: 0.305, steer: true },
        { x: 0.84, z: -1.72, r: 0.375, w: 0.405, steer: false },
        { x: -0.84, z: -1.72, r: 0.375, w: 0.405, steer: false }
    ];

    for (const spec of layout) {
        const pivot = new THREE.Group();
        pivot.position.set(spec.x, spec.r, spec.z);
        const spin = new THREE.Group();
        const mesh = new THREE.Mesh(buildWheel(spec.r, spec.w, accent, compoundColor), wheelMaterial);
        mesh.castShadow = quality.shadows;
        spin.add(mesh);

        const disc = new THREE.Mesh(
            new THREE.CylinderGeometry(spec.r * 0.52, spec.r * 0.52, spec.w * 0.45, 20),
            discMaterial
        );
        disc.rotation.z = Math.PI / 2;
        spin.add(disc);
        discs.push(disc);

        // Caliper
        const caliper = new THREE.Mesh(
            tint(new THREE.BoxGeometry(0.08, 0.1, 0.14), accent),
            darkMaterial
        );
        caliper.position.set(0, spec.r * 0.15, 0.08);
        pivot.add(caliper);

        pivot.add(spin);
        group.add(pivot);
        wheels.push({ pivot, spin, spec });
    }

    // Exhaust tips
    for (const side of [-0.08, 0.08]) {
        const tip = new THREE.Mesh(
            new THREE.CylinderGeometry(0.035, 0.04, 0.12, 10),
            new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.4, metalness: 0.8, emissive: 0x331100, emissiveIntensity: 0.3 })
        );
        tip.rotation.x = Math.PI / 2;
        tip.position.set(side, 0.55, -2.7);
        group.add(tip);
    }

    /* --- rain light ----------------------------------------------- */
    const rainLight = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.14, 0.06),
        new THREE.MeshStandardMaterial({ color: 0x2a0505, emissive: 0xff1a1a, emissiveIntensity: 0 })
    );
    rainLight.position.set(0, 0.44, -2.85);
    group.add(rainLight);

    if (isPlayer) group.userData.isPlayer = true;

    const api = {
        group,
        wheels,
        discs,
        rainLight,
        materials: { paintMaterial, darkMaterial, carbonMaterial, wheelMaterial, discMaterial, decalMat },
        updateWheels(steer, spinDelta, suspension = 0) {
            for (const wheel of wheels) {
                if (wheel.spec.steer) wheel.pivot.rotation.y = steer;
                wheel.spin.rotation.x += spinDelta;
                wheel.pivot.position.y = wheel.spec.r + suspension;
            }
        },
        setBrakeGlow(amount) {
            discMaterial.emissiveIntensity = amount * 4.2;
        },
        setDrs(open) {
            drsPivot.rotation.x = open * -0.78;
        },
        setRainLight(on) {
            rainLight.material.emissiveIntensity = on ? 5 : 0;
        },
        dispose() {
            group.traverse((obj) => obj.geometry?.dispose());
            paintMaterial.dispose();
            darkMaterial.dispose();
            carbonMaterial.dispose();
            wheelMaterial.dispose();
            discMaterial.dispose();
            decalMat.dispose();
        }
    };

    return api;
}
