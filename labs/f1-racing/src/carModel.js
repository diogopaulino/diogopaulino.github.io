/**
 * Procedural Formula 1 car. The monocoque is lofted through a series of superellipse
 * cross-sections, everything else (wings, halo, suspension, wheels) is assembled from
 * primitives and merged per material so a full grid stays cheap to draw.
 *
 * Local axes: +Z forward, +Y up, +X to the car's right.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const RADIAL = 14;

/** Superellipse ring — squarish at the bottom, rounded on top, like a real tub. */
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

    // Cap the two ends.
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

function box(w, h, d, x, y, z, hex, rot = null) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (rot) g.rotateX(rot);
    g.translate(x, y, z);
    return tint(g, hex);
}

function cylinder(rTop, rBottom, height, x, y, z, hex, axis = 'y', segments = 10) {
    const g = new THREE.CylinderGeometry(rTop, rBottom, height, segments);
    if (axis === 'x') g.rotateZ(Math.PI / 2);
    if (axis === 'z') g.rotateX(Math.PI / 2);
    g.translate(x, y, z);
    return tint(g, hex);
}

/** Front or rear wing: stacked aerofoil elements plus endplates. */
function wing({ z, halfSpan, chord, elements, y, colorMain, colorFlap, endplateHeight, endplateColor }) {
    const parts = [];
    for (let e = 0; e < elements; e++) {
        const f = e / Math.max(1, elements - 1);
        const g = new THREE.BoxGeometry(halfSpan * 2 * (1 - f * 0.06), 0.035, chord * (1 - f * 0.25));
        g.rotateX(-0.16 - f * 0.22);
        g.translate(0, y + f * 0.11, z + f * 0.1);
        parts.push(tint(g, e === 0 ? colorMain : colorFlap));
    }
    for (const side of [-1, 1]) {
        const plate = new THREE.BoxGeometry(0.035, endplateHeight, chord * 1.25);
        plate.translate(side * halfSpan, y + endplateHeight / 2 - 0.05, z + 0.05);
        parts.push(tint(plate, endplateColor));
    }
    return parts;
}

function buildWheel(radius, width, rimColor) {
    const parts = [];
    const tyre = new THREE.CylinderGeometry(radius, radius, width, 22, 1, false);
    tyre.rotateZ(Math.PI / 2);
    parts.push(tint(tyre, 0x14151a));

    // Shoulder chamfer so tyres are not perfect cylinders.
    for (const side of [-1, 1]) {
        const shoulder = new THREE.CylinderGeometry(radius * 0.97, radius * 0.86, width * 0.12, 22);
        shoulder.rotateZ(Math.PI / 2);
        shoulder.translate(side * width * 0.53, 0, 0);
        parts.push(tint(shoulder, 0x0f1013));
    }

    const rim = new THREE.CylinderGeometry(radius * 0.68, radius * 0.68, width * 0.86, 20);
    rim.rotateZ(Math.PI / 2);
    parts.push(tint(rim, rimColor));

    for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const spoke = new THREE.BoxGeometry(width * 0.9, radius * 0.62, 0.035);
        spoke.rotateX(a);
        parts.push(tint(spoke, rimColor));
    }
    return mergeGeometries(parts, false);
}

/**
 * @param {object} team  entry from TEAMS
 * @returns {{group: THREE.Group, api: object}}
 */
export function buildCar(team, { quality, isPlayer = false } = {}) {
    const primary = team.primary;
    const secondary = team.secondary;
    const accent = team.accent;

    /* --- monocoque ------------------------------------------------ */
    const bodySections = [
        { z: 2.72, w: 0.10, b: 0.14, t: 0.24, sq: 2.4 },
        { z: 2.35, w: 0.16, b: 0.12, t: 0.32 },
        { z: 1.75, w: 0.24, b: 0.10, t: 0.42 },
        { z: 1.10, w: 0.33, b: 0.09, t: 0.52 },
        { z: 0.45, w: 0.42, b: 0.08, t: 0.64 },
        { z: 0.00, w: 0.50, b: 0.08, t: 0.68, sq: 3.6 },
        { z: -0.55, w: 0.62, b: 0.08, t: 0.72, sq: 4.0 },
        { z: -1.20, w: 0.58, b: 0.09, t: 0.80, sq: 3.6 },
        { z: -1.85, w: 0.40, b: 0.11, t: 0.72 },
        { z: -2.45, w: 0.26, b: 0.13, t: 0.56 },
        { z: -2.80, w: 0.17, b: 0.15, t: 0.44, sq: 2.6 }
    ];

    const paintParts = [tint(loft(bodySections), primary)];
    const darkParts = [];

    // Floor, plank and diffuser.
    darkParts.push(box(1.9, 0.05, 4.6, 0, 0.055, -0.35, 0x101216));
    darkParts.push(box(1.5, 0.28, 0.7, 0, 0.17, -2.55, 0x0d0f13, -0.28));
    // Complex Diffuser strakes
    for (const side of [-1, -0.5, 0.5, 1]) {
        darkParts.push(box(0.02, 0.26, 0.65, side * 0.6, 0.15, -2.55, 0x0c0e12, -0.28));
    }
    // Floor edges (bargeboard/edge extensions)
    for (const side of [-1, 1]) {
        darkParts.push(box(0.05, 0.24, 3.2, side * 0.95, 0.15, -0.2, 0x0c0e12));
        darkParts.push(box(0.18, 0.35, 0.8, side * 0.85, 0.25, 0.8, 0x0c0e12, -0.15)); // Bargeboards
        darkParts.push(cylinder(0.02, 0.02, 0.4, side * 0.8, 0.45, 0.6, 0x0c0e12, 'z'));
    }

    // Sidepod inlets + cooling louvres.
    for (const side of [-1, 1]) {
        darkParts.push(box(0.42, 0.30, 0.14, side * 0.62, 0.36, 0.05, 0x090b0f));
        paintParts.push(box(0.10, 0.22, 1.1, side * 0.66, 0.62, -1.0, accent));
    }

    // Cockpit opening + headrest.
    darkParts.push(box(0.52, 0.10, 0.95, 0, 0.66, 0.30, 0x08090c));
    paintParts.push(box(0.60, 0.20, 0.30, 0, 0.74, -0.16, secondary));

    // Airbox + engine cover fin.
    const airbox = new THREE.SphereGeometry(0.28, 12, 10);
    airbox.scale(1, 0.9, 1.5);
    airbox.translate(0, 0.86, -0.62);
    paintParts.push(tint(airbox, primary));
    darkParts.push(box(0.16, 0.2, 0.28, 0, 0.9, -0.5, 0x05060a));
    paintParts.push(box(0.035, 0.32, 1.15, 0, 0.86, -1.55, accent));

    // Halo.
    const halo = new THREE.TorusGeometry(0.44, 0.045, 8, 22, Math.PI * 1.15);
    halo.rotateY(Math.PI / 2);
    halo.rotateZ(Math.PI * 0.42);
    halo.translate(0, 0.72, 0.34);
    darkParts.push(tint(halo, 0x15171c));
    darkParts.push(cylinder(0.05, 0.05, 0.34, 0, 0.78, 0.76, 0x15171c, 'y'));

    // Mirrors.
    for (const side of [-1, 1]) {
        darkParts.push(box(0.16, 0.09, 0.06, side * 0.5, 0.68, 0.5, 0x1a1d22));
        darkParts.push(cylinder(0.02, 0.02, 0.2, side * 0.4, 0.68, 0.5, 0x1a1d22, 'x'));
    }

    // Wings.
    paintParts.push(...wing({
        z: 2.52, halfSpan: 1.0, chord: 0.42, elements: 3, y: 0.14,
        colorMain: primary, colorFlap: accent, endplateHeight: 0.34, endplateColor: secondary
    }));
    paintParts.push(...wing({
        z: -2.72, halfSpan: 0.53, chord: 0.34, elements: 1, y: 0.78,
        colorMain: primary, colorFlap: accent, endplateHeight: 0.52, endplateColor: secondary
    }));
    paintParts.push(box(1.0, 0.05, 0.26, 0, 0.34, -2.66, secondary, -0.2));  // beam wing

    // Suspension wishbones.
    for (const zAxle of [1.72, -1.72]) {
        for (const side of [-1, 1]) {
            for (const dz of [0.22, -0.22]) {
                const arm = new THREE.CylinderGeometry(0.028, 0.028, 0.66, 6);
                arm.rotateZ(Math.PI / 2);
                arm.translate(side * 0.44, zAxle > 0 ? 0.26 : 0.3, zAxle + dz);
                darkParts.push(tint(arm, 0x1c1f25));
            }
        }
    }

    const paintMaterial = new THREE.MeshPhysicalMaterial({
        vertexColors: true,
        roughness: 0.12,         // Shinier for realism
        metalness: 0.35,         // Metallic flake paint look
        clearcoat: 1.0,
        clearcoatRoughness: 0.04,
        envMapIntensity: 1.8     // High reflection
    });
    const darkMaterial = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.85,
        metalness: 0.15          // Matte Carbon Fiber look
    });

    const group = new THREE.Group();

    const bodyMesh = new THREE.Mesh(mergeGeometries(paintParts, false), paintMaterial);
    const trimMesh = new THREE.Mesh(mergeGeometries(darkParts, false), darkMaterial);
    for (const mesh of [bodyMesh, trimMesh]) {
        mesh.castShadow = quality.shadows;
        mesh.receiveShadow = false;
        group.add(mesh);
    }

    /* --- DRS flap (animated) -------------------------------------- */
    const drsPivot = new THREE.Group();
    drsPivot.position.set(0, 0.94, -2.74);
    const drsFlap = new THREE.Mesh(
        tint(new THREE.BoxGeometry(1.02, 0.04, 0.26), accent),
        paintMaterial
    );
    drsFlap.castShadow = quality.shadows;
    drsPivot.add(drsFlap);
    group.add(drsPivot);

    /* --- wheels ---------------------------------------------------- */
    const wheelMaterial = new THREE.MeshStandardMaterial({
        vertexColors: true, roughness: 0.78, metalness: 0.3
    });
    const discMaterial = new THREE.MeshStandardMaterial({
        color: 0x2a1a14, emissive: 0xff3a08, emissiveIntensity: 0, roughness: 0.5
    });

    const wheels = [];
    const discs = [];
    const layout = [
        { x: 0.78, z: 1.72, r: 0.355, w: 0.32, steer: true },
        { x: -0.78, z: 1.72, r: 0.355, w: 0.32, steer: true },
        { x: 0.82, z: -1.72, r: 0.375, w: 0.42, steer: false },
        { x: -0.82, z: -1.72, r: 0.375, w: 0.42, steer: false }
    ];

    for (const spec of layout) {
        const pivot = new THREE.Group();
        pivot.position.set(spec.x, spec.r, spec.z);
        const spin = new THREE.Group();
        const mesh = new THREE.Mesh(buildWheel(spec.r, spec.w, accent), wheelMaterial);
        mesh.castShadow = quality.shadows;
        spin.add(mesh);

        const disc = new THREE.Mesh(
            new THREE.CylinderGeometry(spec.r * 0.55, spec.r * 0.55, spec.w * 0.5, 16),
            discMaterial
        );
        disc.rotation.z = Math.PI / 2;
        spin.add(disc);
        discs.push(disc);

        pivot.add(spin);
        group.add(pivot);
        wheels.push({ pivot, spin, spec });
    }

    /* --- rain light ------------------------------------------------ */
    const rainLight = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.14, 0.06),
        new THREE.MeshStandardMaterial({ color: 0x2a0505, emissive: 0xff1a1a, emissiveIntensity: 0 })
    );
    rainLight.position.set(0, 0.42, -2.82);
    group.add(rainLight);

    if (isPlayer) group.userData.isPlayer = true;

    const api = {
        group,
        wheels,
        discs,
        rainLight,
        materials: { paintMaterial, darkMaterial, wheelMaterial, discMaterial },
        /** @param {number} steer radians @param {number} spin radians */
        updateWheels(steer, spinDelta, suspension = 0) {
            for (const wheel of wheels) {
                if (wheel.spec.steer) wheel.pivot.rotation.y = steer;
                wheel.spin.rotation.x += spinDelta;
                wheel.pivot.position.y = wheel.spec.r + suspension;
            }
        },
        setBrakeGlow(amount) {
            discMaterial.emissiveIntensity = amount * 3.4;
        },
        setDrs(open) {
            drsPivot.rotation.x = open * -0.72;
        },
        setRainLight(on) {
            rainLight.material.emissiveIntensity = on ? 4 : 0;
        },
        dispose() {
            group.traverse((obj) => obj.geometry?.dispose());
            paintMaterial.dispose();
            darkMaterial.dispose();
            wheelMaterial.dispose();
            discMaterial.dispose();
        }
    };

    return api;
}
