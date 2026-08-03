/**
 * Builds the 3D world for a circuit: road surface, kerbs, run-off, terrain, barriers,
 * scenery, sky and lighting. Everything is generated from the circuit centreline, so
 * adding a track needs no new assets.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SkyMesh } from 'three/addons/objects/SkyMesh.js';
import {
    roadTexture, kerbTexture, grassTexture, gravelTexture, runoffTexture, concreteTexture,
    crowdTexture, startLineTexture, liveryTexture
} from './textures.js';
import { TEAMS } from './config.js';

const KERB_THRESHOLD = 0.0055;   // 1/radius — kerbs appear on corners tighter than ~180 m
const APRON_WIDTH = 6.5;         // paved run-off next to the kerbs
const RUNOFF_WIDTH = 13.5;       // apron + gravel trap
const VERGE_WIDTH = 120;

/* ------------------------------------------------------------------ *
 * Geometry helpers
 * ------------------------------------------------------------------ */

/**
 * Ribbons are emitted inner-to-outer, so their winding flips depending on which side
 * of the track they sit on. Rather than special-casing every caller, flip the index
 * order whenever the surface ends up facing the ground.
 */
function faceUpwards(geometry) {
    geometry.computeVertexNormals();
    const normals = geometry.attributes.normal;
    let sum = 0;
    const stride = Math.max(1, Math.floor(normals.count / 64));
    for (let i = 0; i < normals.count; i += stride) sum += normals.getY(i);
    if (sum >= 0) return geometry;

    const index = geometry.getIndex();
    const array = index.array;
    for (let i = 0; i < array.length; i += 3) {
        const tmp = array[i + 1];
        array[i + 1] = array[i + 2];
        array[i + 2] = tmp;
    }
    index.needsUpdate = true;
    geometry.computeVertexNormals();
    return geometry;
}

/** World position of a point `lateral` metres to the right of centreline sample `i`. */
function surfacePoint(circuit, i, lateral, lift = 0) {
    const x = circuit.cx[i] + circuit.nx[i] * lateral;
    const z = circuit.cz[i] + circuit.nz[i] * lateral;
    const y = circuit.y[i] + lateral * Math.tan(circuit.bank[i]) + lift;
    return [x, y, z];
}

/**
 * Closed ribbon between two lateral offsets. `inner`/`outer` may be numbers or
 * functions of the sample index, which is how the run-off tapers into the terrain.
 */
function buildRibbon(circuit, inner, outer, {
    lift = 0,
    outerLift = null,
    vScale = 1 / 16,
    uRepeat = 1,
    step = 1
} = {}) {
    const n = circuit.count;
    const innerAt = typeof inner === 'function' ? inner : () => inner;
    const outerAt = typeof outer === 'function' ? outer : () => outer;
    const outerLiftAt = outerLift === null ? null : (typeof outerLift === 'function' ? outerLift : () => outerLift);

    const cols = Math.ceil(n / step) + 1;
    const positions = new Float32Array(cols * 2 * 3);
    const uvs = new Float32Array(cols * 2 * 2);
    const indices = [];

    for (let c = 0; c < cols; c++) {
        const i = (c * step) % n;
        const a = surfacePoint(circuit, i, innerAt(i), lift);
        const b = surfacePoint(circuit, i, outerAt(i), outerLiftAt ? outerLiftAt(i) : lift);
        const o = c * 6;
        positions[o] = a[0]; positions[o + 1] = a[1]; positions[o + 2] = a[2];
        positions[o + 3] = b[0]; positions[o + 4] = b[1]; positions[o + 5] = b[2];
        const v = circuit.s[i] * vScale;
        const uo = c * 4;
        uvs[uo] = 0; uvs[uo + 1] = v;
        uvs[uo + 2] = uRepeat; uvs[uo + 3] = v;
    }
    // The seam column re-uses sample 0 but must keep a monotonic V.
    const last = (cols - 1) * 4;
    uvs[last + 1] = uvs[last + 3] = circuit.length * vScale;

    for (let c = 0; c < cols - 1; c++) {
        const a = c * 2, b = a + 1, d = a + 2, e = a + 3;
        indices.push(a, b, d, b, e, d);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    return faceUpwards(geo);
}

/** Kerb strips, emitted only on the corner side of tight turns. */
function buildKerbs(circuit) {
    const n = circuit.count;
    const positions = [];
    const uvs = [];
    const indices = [];
    let vertexCount = 0;

    const strength = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        const k = Math.abs(circuit.curvature[i]);
        strength[i] = k > KERB_THRESHOLD ? Math.min(1, (k - KERB_THRESHOLD) / 0.012 + 0.35) : 0;
    }
    // Feather the ends so kerbs do not start abruptly mid-corner.
    const smoothed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        let max = 0;
        for (let k = -6; k <= 6; k++) max = Math.max(max, strength[(i + k + n) % n] * (1 - Math.abs(k) / 9));
        smoothed[i] = max;
    }

    for (const side of [-1, 1]) {
        let run = null;
        for (let c = 0; c <= n; c++) {
            const i = c % n;
            // Kerbs sit on the inside of the corner and on the outside of the exit.
            const turningRight = circuit.curvature[i] > 0;
            const active = smoothed[i] > 0.02 && (side === (turningRight ? 1 : -1) ? true : smoothed[i] > 0.45);
            if (active) {
                if (!run) run = [];
                run.push(i);
            } else if (run) {
                emitRun(run, side);
                run = null;
            }
        }
        if (run) emitRun(run, side);
    }

    function emitRun(run, side) {
        if (run.length < 3) return;
        const startVertex = vertexCount;
        for (let k = 0; k < run.length; k++) {
            const i = run[k];
            const half = circuit.halfWidth * circuit.widthScale[i];
            const fade = Math.min(1, Math.min(k, run.length - 1 - k) / 4);
            const width = (0.6 + 1.05 * smoothed[i]) * Math.max(0.25, fade);
            const a = surfacePoint(circuit, i, side * half, 0.015);
            const b = surfacePoint(circuit, i, side * (half + width), 0.075);
            positions.push(a[0], a[1], a[2], b[0], b[1], b[2]);
            const v = circuit.s[i] / 3.2;
            uvs.push(0, v, 1, v);
            vertexCount += 2;
        }
        for (let k = 0; k < run.length - 1; k++) {
            const a = startVertex + k * 2, b = a + 1, d = a + 2, e = a + 3;
            if (side > 0) indices.push(a, b, d, b, e, d);
            else indices.push(a, d, b, b, d, e);
        }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    return faceUpwards(geo);
}

/** Painted start/finish band across the road. */
function buildStartLine(circuit) {
    const half = circuit.halfWidth * 1.02;
    const positions = [];
    const uvs = [];
    const indices = [];
    const span = 4;
    for (let c = 0; c <= span; c++) {
        const i = (circuit.count - 2 + c) % circuit.count;
        const a = surfacePoint(circuit, i, -half, 0.012);
        const b = surfacePoint(circuit, i, half, 0.012);
        positions.push(a[0], a[1], a[2], b[0], b[1], b[2]);
        uvs.push(0, c / span, 1, c / span);
    }
    for (let c = 0; c < span; c++) {
        const a = c * 2, b = a + 1, d = a + 2, e = a + 3;
        indices.push(a, b, d, b, e, d);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    return faceUpwards(geo);
}

/* ------------------------------------------------------------------ *
 * Scenery
 * ------------------------------------------------------------------ */

function treeGeometry() {
    const trunk = new THREE.CylinderGeometry(0.22, 0.32, 2.6, 5);
    trunk.translate(0, 1.3, 0);
    paint(trunk, 0x4a3a2a);
    const low = new THREE.ConeGeometry(2.3, 4.6, 7);
    low.translate(0, 4.4, 0);
    paint(low, 0x2c4a22);
    const top = new THREE.ConeGeometry(1.5, 3.4, 7);
    top.translate(0, 6.8, 0);
    paint(top, 0x35592a);
    return mergeGeometries([trunk, low, top], false);
}

function paint(geometry, hex) {
    const color = new THREE.Color(hex);
    const count = geometry.attributes.position.count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        const jitter = 0.86 + ((i * 37) % 17) / 60;
        colors[i * 3] = color.r * jitter;
        colors[i * 3 + 1] = color.g * jitter;
        colors[i * 3 + 2] = color.b * jitter;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geometry;
}

function buildGrandstand(length, height = 9) {
    const group = new THREE.Group();
    const depth = 16;

    const seating = new THREE.Mesh(
        new THREE.BoxGeometry(length, height, depth),
        new THREE.MeshStandardMaterial({ map: crowdTexture(), roughness: 0.92, metalness: 0 })
    );
    seating.geometry.translate(0, height / 2, depth / 2);
    // Rake the stand back so the crowd faces the track.
    const pos = seating.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        pos.setZ(i, pos.getZ(i) + y * 0.55);
    }
    pos.needsUpdate = true;
    seating.geometry.computeVertexNormals();
    seating.castShadow = false;
    seating.receiveShadow = true;
    group.add(seating);

    const roof = new THREE.Mesh(
        new THREE.BoxGeometry(length + 2, 0.5, depth + 6),
        new THREE.MeshStandardMaterial({ color: 0x2a2f38, roughness: 0.7, metalness: 0.25 })
    );
    roof.position.set(0, height + 4.5, depth * 0.75);
    group.add(roof);

    for (const sx of [-0.46, 0.46]) {
        const pillar = new THREE.Mesh(
            new THREE.BoxGeometry(0.6, height + 4.5, 0.6),
            new THREE.MeshStandardMaterial({ color: 0x33383f, roughness: 0.6, metalness: 0.4 })
        );
        pillar.position.set(length * sx, (height + 4.5) / 2, depth + 2);
        group.add(pillar);
    }
    return group;
}

function buildGantry(circuit) {
    const group = new THREE.Group();
    const width = circuit.width + 12;
    const metal = new THREE.MeshStandardMaterial({ color: 0x22262d, roughness: 0.45, metalness: 0.6 });

    const beam = new THREE.Mesh(new THREE.BoxGeometry(width, 1.4, 1.2), metal);
    beam.position.y = 8.4;
    group.add(beam);

    for (const sx of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(1.1, 8.4, 1.1), metal);
        leg.position.set((sx * width) / 2, 4.2, 0);
        group.add(leg);
    }

    const banner = new THREE.Mesh(
        new THREE.PlaneGeometry(width * 0.72, 2.4),
        new THREE.MeshStandardMaterial({ color: 0xd8261f, roughness: 0.6, emissive: 0x3b0906, emissiveIntensity: 0.8 })
    );
    banner.position.set(0, 8.4, 0.7);
    group.add(banner);

    const lights = new THREE.Group();
    for (let i = 0; i < 5; i++) {
        const housing = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.6, 0.6), metal);
        housing.position.set((i - 2) * 2.2, 6.4, 0.9);
        lights.add(housing);
        for (let row = 0; row < 2; row++) {
            const bulb = new THREE.Mesh(
                new THREE.CircleGeometry(0.42, 12),
                new THREE.MeshStandardMaterial({ color: 0x1a0403, emissive: 0xff1408, emissiveIntensity: 0 })
            );
            bulb.position.set((i - 2) * 2.2, 6.95 - row * 1.05, 1.22);
            bulb.userData.lightIndex = i;
            lights.add(bulb);
        }
    }
    group.add(lights);
    group.userData.lights = lights;
    return group;
}

/* ------------------------------------------------------------------ *
 * Environment
 * ------------------------------------------------------------------ */

function environmentTexture(sunColor, skyColor, groundColor) {
    const el = document.createElement('canvas');
    el.width = 128;
    el.height = 64;
    const ctx = el.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 64);
    grad.addColorStop(0, `#${new THREE.Color(skyColor).getHexString()}`);
    grad.addColorStop(0.48, `#${new THREE.Color(sunColor).getHexString()}`);
    grad.addColorStop(0.52, `#${new THREE.Color(groundColor).getHexString()}`);
    grad.addColorStop(1, '#14170f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 64);
    const texture = new THREE.CanvasTexture(el);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

/* ------------------------------------------------------------------ *
 * World
 * ------------------------------------------------------------------ */

export function buildWorld(circuit, { quality, weather }) {
    const scene = new THREE.Scene();
    const group = new THREE.Group();
    scene.add(group);

    const wet = weather.id !== 'dry';
    const overcast = weather.cloud;

    /* --- sky + light --------------------------------------------- */
    const sky = new SkyMesh();
    sky.scale.setScalar(45000);
    sky.turbidity.value = 3 + overcast * 12;
    sky.rayleigh.value = wet ? 0.7 : 2.2;
    sky.mieCoefficient.value = 0.005 + overcast * 0.02;
    sky.mieDirectionalG.value = 0.82;

    const sunAngle = circuit.def.sun || { elevation: 40, azimuth: 160 };
    const phi = THREE.MathUtils.degToRad(90 - sunAngle.elevation);
    const theta = THREE.MathUtils.degToRad(sunAngle.azimuth);
    const sunDirection = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
    sky.sunPosition.value.copy(sunDirection);
    sky.material.fog = false;   // the dome sits far beyond the fog range
    scene.add(sky);

    const sunTint = wet ? 0xbfc9d6 : 0xfff2dd;
    const sun = new THREE.DirectionalLight(sunTint, wet ? 1.6 : 3.6);
    sun.position.copy(sunDirection).multiplyScalar(320);
    sun.castShadow = quality.shadows;
    if (quality.shadows) {
        sun.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
        sun.shadow.camera.near = 1;
        sun.shadow.camera.far = 520;
        const extent = 90;
        sun.shadow.camera.left = -extent;
        sun.shadow.camera.right = extent;
        sun.shadow.camera.top = extent;
        sun.shadow.camera.bottom = -extent;
        sun.shadow.bias = -0.0008;
        sun.shadow.normalBias = 0.05;
    }
    scene.add(sun);
    scene.add(sun.target);

    // Kept deliberately low: too much sky light and the sun's shadows stop reading.
    const hemi = new THREE.HemisphereLight(
        wet ? 0x7f8b9c : 0x9fc4ff,
        circuit.def.scenery === 'city' ? 0x2a2c30 : 0x2d3a22,
        wet ? 1.15 : 0.42
    );
    scene.add(hemi);

    scene.environment = environmentTexture(
        wet ? 0x9aa6b4 : 0xffd9a0,
        wet ? 0x6d7887 : 0x5f8fd0,
        circuit.def.scenery === 'city' ? 0x3a3d42 : 0x39492a
    );
    scene.environmentIntensity = wet ? 0.55 : 0.3;

    const fogColor = new THREE.Color(wet ? 0x8d99a8 : 0xa8bede);
    scene.fog = new THREE.Fog(fogColor, quality.drawDistance * 0.35, quality.drawDistance * 1.5);

    /* --- road ----------------------------------------------------- */
    const roadMap = roadTexture(circuit.def.surface);
    roadMap.repeat.set(1, 1);
    roadMap.anisotropy = quality.anisotropy;
    const roadMaterial = new THREE.MeshStandardMaterial({
        map: roadMap,
        roughness: wet ? 0.28 : 0.86,
        metalness: wet ? 0.16 : 0.02,
        envMapIntensity: wet ? 1.5 : 0.35
    });

    const halfAt = (i) => circuit.halfWidth * circuit.widthScale[i];
    const road = new THREE.Mesh(
        buildRibbon(circuit, (i) => -halfAt(i), (i) => halfAt(i), { vScale: 1 / 14 }),
        roadMaterial
    );
    road.receiveShadow = quality.shadows;
    road.renderOrder = 0;
    group.add(road);

    const startLine = new THREE.Mesh(
        buildStartLine(circuit),
        new THREE.MeshStandardMaterial({ map: startLineTexture(), roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 })
    );
    startLine.receiveShadow = false;
    group.add(startLine);

    /* --- kerbs ---------------------------------------------------- */
    const kerbMap = kerbTexture();
    kerbMap.anisotropy = quality.anisotropy;
    const kerbs = new THREE.Mesh(
        buildKerbs(circuit),
        new THREE.MeshStandardMaterial({ map: kerbMap, roughness: 0.62, metalness: 0.03 })
    );
    kerbs.receiveShadow = quality.shadows;
    group.add(kerbs);

    /* --- run-off + terrain ---------------------------------------- */
    const cityLike = circuit.def.scenery === 'city';

    // Modern circuits: a paved apron right beside the track, then a gravel trap.
    const apronMap = runoffTexture();
    apronMap.repeat.set(3, 1);
    apronMap.anisotropy = quality.anisotropy;
    const apronMaterial = new THREE.MeshStandardMaterial({ map: apronMap, roughness: 0.92 });

    const gravelMap = cityLike ? concreteTexture() : gravelTexture();
    gravelMap.repeat.set(5, 1);
    gravelMap.anisotropy = quality.anisotropy;
    const gravelMaterial = new THREE.MeshStandardMaterial({ map: gravelMap, roughness: 0.98 });

    for (const side of [-1, 1]) {
        const apron = new THREE.Mesh(
            buildRibbon(
                circuit,
                (i) => side * (halfAt(i) + 0.35),
                (i) => side * (halfAt(i) + APRON_WIDTH),
                { vScale: 1 / 18, lift: -0.015, outerLift: -0.1 }
            ),
            apronMaterial
        );
        apron.receiveShadow = quality.shadows;
        group.add(apron);

        const gravel = new THREE.Mesh(
            buildRibbon(
                circuit,
                (i) => side * (halfAt(i) + APRON_WIDTH - 0.1),
                (i) => side * (halfAt(i) + RUNOFF_WIDTH),
                { vScale: 1 / 26, lift: -0.1, outerLift: -0.4 }
            ),
            gravelMaterial
        );
        gravel.receiveShadow = quality.shadows;
        group.add(gravel);
    }

    const grassMap = grassTexture(cityLike ? 0x39413a : 0x33501f);
    grassMap.repeat.set(26, 1);
    grassMap.anisotropy = quality.anisotropy;
    const grassMaterial = new THREE.MeshStandardMaterial({ map: grassMap, roughness: 1 });

    let baseY = Infinity;
    for (let i = 0; i < circuit.count; i++) baseY = Math.min(baseY, circuit.y[i]);
    baseY -= 3;

    for (const side of [-1, 1]) {
        const verge = new THREE.Mesh(
            buildRibbon(
                circuit,
                (i) => side * (halfAt(i) + RUNOFF_WIDTH - 0.15),
                (i) => side * (halfAt(i) + VERGE_WIDTH),
                {
                    vScale: 1 / 55,
                    lift: -0.36,
                    // Blend the outer edge towards the base plane so the ground meets it flat.
                    outerLift: (i) => baseY - circuit.y[i] + 0.6,
                    step: 2
                }
            ),
            grassMaterial
        );
        verge.receiveShadow = quality.shadows;
        group.add(verge);
    }

    const spanX = circuit.maxX - circuit.minX;
    const spanZ = circuit.maxZ - circuit.minZ;
    const groundSize = Math.max(spanX, spanZ) + 4200;
    const groundMap = grassTexture(cityLike ? 0x3c4139 : 0x2c471c);
    groundMap.repeat.set(groundSize / 26, groundSize / 26);
    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(groundSize, groundSize),
        new THREE.MeshStandardMaterial({ map: groundMap, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set((circuit.minX + circuit.maxX) / 2, baseY + 0.55, (circuit.minZ + circuit.maxZ) / 2);
    ground.receiveShadow = false;
    group.add(ground);

    /* --- barriers ------------------------------------------------- */
    const wallHeight = 1.05;
    const wallGeo = new THREE.BoxGeometry(3.4, wallHeight, 0.4);
    const wallMaterial = new THREE.MeshStandardMaterial({
        map: concreteTexture(), roughness: 0.85, metalness: 0.05
    });
    const wallStep = Math.max(1, Math.round(3.6 / circuit.spacing));
    const wallCount = Math.floor(circuit.count / wallStep) * 2;
    const walls = new THREE.InstancedMesh(wallGeo, wallMaterial, wallCount);
    walls.castShadow = quality.shadows;
    walls.receiveShadow = quality.shadows;

    const dummy = new THREE.Object3D();
    let w = 0;
    for (let i = 0; i < circuit.count; i += wallStep) {
        for (const side of [-1, 1]) {
            if (w >= wallCount) break;
            const lateral = side * (halfAt(i) + RUNOFF_WIDTH + 1.2);
            const [x, y, z] = surfacePoint(circuit, i, lateral, -0.4);
            dummy.position.set(x, y + wallHeight / 2, z);
            dummy.rotation.set(0, circuit.heading[i], 0);
            dummy.updateMatrix();
            walls.setMatrixAt(w++, dummy.matrix);
        }
    }
    walls.count = w;
    group.add(walls);

    // Tyre stacks on the outside of the quickest corners.
    const tyreGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.55, 10);
    const tyreMaterial = new THREE.MeshStandardMaterial({ color: 0x1b1c20, roughness: 0.95 });
    const stackSlots = [];
    for (let i = 0; i < circuit.count; i += 3) {
        if (Math.abs(circuit.curvature[i]) < 0.008) continue;
        stackSlots.push(i);
    }
    const tyres = new THREE.InstancedMesh(tyreGeo, tyreMaterial, Math.max(1, stackSlots.length * 3));
    tyres.castShadow = quality.shadows;
    let ti = 0;
    for (const i of stackSlots) {
        const side = circuit.curvature[i] > 0 ? -1 : 1;
        const lateral = side * (halfAt(i) + RUNOFF_WIDTH + 0.5);
        const [x, y, z] = surfacePoint(circuit, i, lateral, -0.4);
        for (let level = 0; level < 3; level++) {
            dummy.position.set(x, y + 0.28 + level * 0.55, z);
            dummy.rotation.set(0, circuit.heading[i], 0);
            dummy.updateMatrix();
            tyres.setMatrixAt(ti++, dummy.matrix);
        }
    }
    tyres.count = ti;
    group.add(tyres);

    /* --- advertising hoardings ------------------------------------ */
    const boardCount = Math.floor(circuit.count / 14);
    const boardGeo = new THREE.PlaneGeometry(6.5, 1.5);
    const boards = new THREE.InstancedMesh(
        boardGeo,
        new THREE.MeshStandardMaterial({ roughness: 0.55, side: THREE.DoubleSide }),
        boardCount * 2
    );
    const boardColor = new THREE.Color();
    let bi = 0;
    for (let i = 0; i < circuit.count; i += 14) {
        for (const side of [-1, 1]) {
            if (bi >= boardCount * 2) break;
            const lateral = side * (halfAt(i) + RUNOFF_WIDTH + 1.05);
            const [x, y, z] = surfacePoint(circuit, i, lateral, -0.4);
            dummy.position.set(x, y + 1.5, z);
            dummy.rotation.set(0, circuit.heading[i] + (side > 0 ? Math.PI : 0), 0);
            dummy.updateMatrix();
            boards.setMatrixAt(bi, dummy.matrix);
            const team = TEAMS[(i / 14 + (side > 0 ? 3 : 0)) % TEAMS.length | 0];
            boards.setColorAt(bi, boardColor.setHex(team.primary).multiplyScalar(0.85));
            bi++;
        }
    }
    boards.count = bi;
    if (boards.instanceColor) boards.instanceColor.needsUpdate = true;
    group.add(boards);

    /* --- scenery -------------------------------------------------- */
    if (quality.scenery > 0.1 && !cityLike) {
        const trees = new THREE.InstancedMesh(
            treeGeometry(),
            new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }),
            Math.floor(circuit.count * 1.4 * quality.scenery)
        );
        trees.castShadow = false;
        trees.receiveShadow = false;
        let seed = 1337;
        const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
        let idx = 0;
        const step = Math.max(2, Math.round(6 / quality.scenery));
        for (let i = 0; i < circuit.count && idx < trees.count; i += step) {
            const clusters = rand() < 0.55 ? 2 : 1;
            for (let c = 0; c < clusters && idx < trees.count; c++) {
                const side = rand() < 0.5 ? -1 : 1;
                const lateral = side * (halfAt(i) + RUNOFF_WIDTH + 14 + rand() * 78);
                const [x, y, z] = surfacePoint(circuit, i, lateral, -0.4);
                const scale = 0.75 + rand() * 0.9;
                dummy.position.set(x + (rand() - 0.5) * 12, y - 0.3, z + (rand() - 0.5) * 12);
                dummy.rotation.set(0, rand() * Math.PI * 2, 0);
                dummy.scale.setScalar(scale);
                dummy.updateMatrix();
                trees.setMatrixAt(idx++, dummy.matrix);
            }
        }
        dummy.scale.setScalar(1);
        trees.count = idx;
        group.add(trees);
    }

    // Grandstands: one at the line, the rest at the slowest corners (best viewing).
    const standSpots = [0];
    const sorted = [...circuit.corners].sort((a, b) => a.radius - b.radius).slice(0, 4);
    for (const corner of sorted) standSpots.push(corner.index);
    for (const spotIndex of standSpots) {
        const stand = buildGrandstand(spotIndex === 0 ? 120 : 70, spotIndex === 0 ? 12 : 8);
        const side = spotIndex === 0 ? 1 : (circuit.curvature[spotIndex] > 0 ? -1 : 1);
        const lateral = side * (halfAt(spotIndex) + RUNOFF_WIDTH + 3.5);
        const [x, y, z] = surfacePoint(circuit, spotIndex, lateral, -0.4);
        stand.position.set(x, y, z);
        // The stand is built facing local -Z with its length on X, so it has to be
        // turned a quarter turn to run alongside the track and face the racing line.
        stand.rotation.y = circuit.heading[spotIndex] + (side > 0 ? Math.PI / 2 : -Math.PI / 2);
        group.add(stand);
    }

    const gantry = buildGantry(circuit);
    {
        const [x, y, z] = surfacePoint(circuit, 0, 0, 0);
        gantry.position.set(x, y, z);
        gantry.rotation.y = circuit.heading[0];
        group.add(gantry);
    }

    /* --- DRS zone markers ----------------------------------------- */
    const drsMaterial = new THREE.MeshStandardMaterial({
        color: 0x0a2e1c, emissive: 0x18f08a, emissiveIntensity: 1.4, roughness: 0.4
    });
    for (const zone of circuit.drs) {
        const i = circuit.indexAt(zone.start * circuit.length);
        for (const side of [-1, 1]) {
            const sign = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.1, 0.2), drsMaterial);
            const lateral = side * (halfAt(i) + 3.2);
            const [x, y, z] = surfacePoint(circuit, i, lateral, 0);
            sign.position.set(x, y + 2.2, z);
            sign.rotation.y = circuit.heading[i];
            group.add(sign);
        }
    }

    return {
        scene,
        group,
        sun,
        sky,
        ground,
        gantry,
        baseY,
        roadMaterial,
        /** Keeps the shadow frustum tight around the player. */
        update(target) {
            sun.target.position.copy(target);
            sun.position.copy(target).addScaledVector(sunDirection, 260);
            sun.target.updateMatrixWorld();
        },
        dispose() {
            group.traverse((obj) => {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) {
                    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
                    for (const m of mats) m.dispose();
                }
            });
            scene.environment?.dispose();
        }
    };
}

export { liveryTexture };
