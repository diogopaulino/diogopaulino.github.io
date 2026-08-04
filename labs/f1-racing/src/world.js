/**
 * Builds the 3D world for a circuit: road surface, kerbs, run-off, terrain, barriers,
 * scenery, sky and lighting. Everything is generated from the circuit centreline, so
 * adding a track needs no new assets.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SkyMesh } from 'three/addons/objects/SkyMesh.js';
import {
    roadMaps, kerbMaps, grassMaps, gravelMaps, runoffMaps, concreteMaps,
    crowdTexture, startLineTexture, liveryTexture, bannerTexture, fenceTexture
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
    const trunk = new THREE.CylinderGeometry(0.28, 0.48, 4.2, 7);
    trunk.translate(0, 2.1, 0);
    paint(trunk, 0x4a3a2a);

    const layers = [];
    for (let i = 0; i < 5; i++) {
        const r = 3.4 - i * 0.55;
        const h = 4.2;
        const cone = new THREE.ConeGeometry(r, h, 9);
        cone.translate(0, 3.8 + i * 2.05, 0);
        cone.rotateX(((i * 17) % 7 - 3) * 0.015);
        cone.rotateZ(((i * 29) % 7 - 3) * 0.015);
        paint(cone, i % 2 === 0 ? 0x254820 : 0x2f5a28);
        layers.push(cone);
    }

    return mergeGeometries([trunk, ...layers], false);
}

function lightPoleGeometry() {
    const pole = new THREE.CylinderGeometry(0.12, 0.16, 12, 8);
    pole.translate(0, 6, 0);
    paint(pole, 0x3a4048);
    const arm = new THREE.BoxGeometry(0.15, 0.12, 3.2);
    arm.translate(0, 11.6, 1.4);
    paint(arm, 0x2e343c);
    const lamp = new THREE.BoxGeometry(0.5, 0.25, 0.7);
    lamp.translate(0, 11.4, 2.6);
    paint(lamp, 0x1a1e24);
    return mergeGeometries([pole, arm, lamp], false);
}

function pitBuilding(length = 90) {
    const group = new THREE.Group();
    const wall = new THREE.MeshStandardMaterial({ color: 0x2a2f38, roughness: 0.7, metalness: 0.25 });
    const glass = new THREE.MeshPhysicalMaterial({
        color: 0x6a90b8, roughness: 0.15, metalness: 0.4, transmission: 0.35, transparent: true, opacity: 0.85
    });

    const garage = new THREE.Mesh(new THREE.BoxGeometry(length, 5.5, 14), wall);
    garage.position.set(0, 2.75, 8);
    group.add(garage);

    const upper = new THREE.Mesh(new THREE.BoxGeometry(length * 0.92, 3.2, 10), glass);
    upper.position.set(0, 7.2, 7);
    group.add(upper);

    const roof = new THREE.Mesh(
        new THREE.BoxGeometry(length + 4, 0.4, 16),
        new THREE.MeshStandardMaterial({ color: 0xd8261f, roughness: 0.55, metalness: 0.3, emissive: 0x3b0906, emissiveIntensity: 0.35 })
    );
    roof.position.set(0, 9.0, 7.5);
    group.add(roof);

    // Garage doors
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x15181e, roughness: 0.8 });
    const doorCount = Math.floor(length / 10);
    for (let i = 0; i < doorCount; i++) {
        const door = new THREE.Mesh(new THREE.BoxGeometry(7.5, 3.8, 0.2), doorMat);
        door.position.set(-length / 2 + 5 + i * 10, 1.9, 0.9);
        group.add(door);
    }

    // Pit wall
    const pitWall = new THREE.Mesh(new THREE.BoxGeometry(length * 0.85, 1.1, 0.45), wall);
    pitWall.position.set(0, 0.55, -2.5);
    group.add(pitWall);

    return group;
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
    el.width = 512;
    el.height = 256;
    const ctx = el.getContext('2d');
    
    // Sky and ground gradient
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, `#${new THREE.Color(skyColor).getHexString()}`);
    grad.addColorStop(0.48, `#${new THREE.Color(sunColor).getHexString()}`);
    grad.addColorStop(0.5, `#${new THREE.Color(groundColor).getHexString()}`);
    grad.addColorStop(1, '#14170f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 256);
    
    // Simulate a bright sun disc for intense HDRI-like reflections
    const sunX = 350; // Azimuth roughly matches the directional light
    const sunY = 100; // Elevation
    const sunGrad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 40);
    sunGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    sunGrad.addColorStop(0.2, 'rgba(255, 250, 240, 0.8)');
    sunGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 40, 0, Math.PI * 2);
    ctx.fill();
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
    sky.turbidity.value = 4.5 + overcast * 12;
    sky.rayleigh.value = wet ? 1.5 : 0.85;
    sky.mieCoefficient.value = 0.008 + overcast * 0.025;
    sky.mieDirectionalG.value = 0.94;

    const sunAngle = circuit.def.sun || { elevation: 40, azimuth: 160 };
    const phi = THREE.MathUtils.degToRad(90 - sunAngle.elevation);
    const theta = THREE.MathUtils.degToRad(sunAngle.azimuth);
    const sunDirection = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
    sky.sunPosition.value.copy(sunDirection);
    sky.material.fog = false;   // the dome sits far beyond the fog range
    scene.add(sky);

    const sunTint = wet ? 0xcfdff0 : 0xffead0;
    const sun = new THREE.DirectionalLight(sunTint, wet ? 2.2 : 5.5);
    sun.position.copy(sunDirection).multiplyScalar(320);
    sun.castShadow = quality.shadows;
    if (quality.shadows) {
        sun.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
        sun.shadow.camera.near = 1;
        sun.shadow.camera.far = 560;
        const extent = 110;
        sun.shadow.camera.left = -extent;
        sun.shadow.camera.right = extent;
        sun.shadow.camera.top = extent;
        sun.shadow.camera.bottom = -extent;
        sun.shadow.bias = -0.0005;
        sun.shadow.normalBias = 0.035;
    }
    scene.add(sun);
    scene.add(sun.target);

    const hemi = new THREE.HemisphereLight(
        wet ? 0x8fa0b5 : 0x9bc2ff,
        circuit.def.scenery === 'city' ? 0x303338 : 0x334426,
        wet ? 1.4 : 0.6
    );
    scene.add(hemi);

    // Soft fill to lift shadowed asphalt without killing contrast.
    const fill = new THREE.DirectionalLight(wet ? 0x8a9aab : 0xb8d0f0, wet ? 0.35 : 0.55);
    fill.position.set(-sunDirection.x * 80, 40, -sunDirection.z * 80);
    scene.add(fill);

    scene.environment = environmentTexture(
        wet ? 0xabbcd2 : 0xffdfb0,
        wet ? 0x768598 : 0x6c9be8,
        circuit.def.scenery === 'city' ? 0x40444a : 0x40552d
    );
    scene.environmentIntensity = wet ? 1.2 : 1.0;

    const fogColor = new THREE.Color(wet ? 0x8d99a8 : 0xa8bede);
    scene.fog = new THREE.Fog(fogColor, quality.drawDistance * 0.38, quality.drawDistance * 1.55);

    /* --- road ----------------------------------------------------- */
    const roadMap = roadTexture(circuit.def.surface);
    roadMap.repeat.set(1, 1);
    roadMap.anisotropy = quality.anisotropy;
    const roadMaterial = new THREE.MeshPhysicalMaterial({
        map: roadMap,
        bumpMap: roadMap,
        bumpScale: 0.015,
        roughness: wet ? 0.28 : 0.86,
        metalness: wet ? 0.16 : 0.02,
        clearcoat: wet ? 1.0 : 0.1,
        clearcoatRoughness: wet ? 0.05 : 0.5,
        envMapIntensity: wet ? 1.5 : 0.35
    });

    const halfAt = (i) => circuit.halfWidth * circuit.widthScale[i];
    const road = new THREE.Mesh(
        buildRibbon(circuit, (i) => -halfAt(i), (i) => halfAt(i), { vScale: 1 / 8 }),
        roadMaterial
    );
    road.receiveShadow = quality.shadows;
    road.renderOrder = 0;
    group.add(road);

    const startLine = new THREE.Mesh(
        buildStartLine(circuit),
        new THREE.MeshStandardMaterial({
            map: startLineTexture(), roughness: 0.65, metalness: 0.05,
            polygonOffset: true, polygonOffsetFactor: -2
        })
    );
    startLine.receiveShadow = false;
    group.add(startLine);

    /* --- kerbs ---------------------------------------------------- */
    const kerbPack = kerbMaps();
    kerbPack.map.anisotropy = quality.anisotropy;
    const kerbs = new THREE.Mesh(
        buildKerbs(circuit),
        new THREE.MeshStandardMaterial({
            map: kerbPack.map,
            normalMap: kerbPack.normalMap,
            normalScale: new THREE.Vector2(1.4, 1.4),
            roughnessMap: kerbPack.roughnessMap,
            roughness: 0.55,
            metalness: 0.04,
            envMapIntensity: 0.5
        })
    );
    kerbs.receiveShadow = quality.shadows;
    kerbs.castShadow = quality.shadows;
    group.add(kerbs);

    /* --- run-off + terrain ---------------------------------------- */
    const cityLike = circuit.def.scenery === 'city';

    const apronPack = runoffMaps();
    apronPack.map.repeat.set(3, 1);
    apronPack.normalMap.repeat.set(3, 1);
    apronPack.map.anisotropy = quality.anisotropy;
    const apronMaterial = new THREE.MeshStandardMaterial({
        map: apronPack.map,
        normalMap: apronPack.normalMap,
        normalScale: new THREE.Vector2(0.7, 0.7),
        roughnessMap: apronPack.roughnessMap,
        roughness: 0.92
    });

    const gravelPack = cityLike ? concreteMaps() : gravelMaps();
    gravelPack.map.repeat.set(5, 1);
    gravelPack.normalMap.repeat.set(5, 1);
    gravelPack.map.anisotropy = quality.anisotropy;
    const gravelMaterial = new THREE.MeshStandardMaterial({
        map: gravelPack.map,
        normalMap: gravelPack.normalMap,
        normalScale: new THREE.Vector2(1.2, 1.2),
        roughnessMap: gravelPack.roughnessMap,
        roughness: 0.98
    });

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

    const grassPack = grassMaps(cityLike ? 0x39413a : 0x1f3518);
    grassPack.map.repeat.set(26, 1);
    grassPack.normalMap.repeat.set(26, 1);
    grassPack.map.anisotropy = quality.anisotropy;
    const grassMaterial = new THREE.MeshStandardMaterial({
        map: grassPack.map,
        normalMap: grassPack.normalMap,
        normalScale: new THREE.Vector2(1.1, 1.1),
        roughnessMap: grassPack.roughnessMap,
        roughness: 1
    });

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
                    outerLift: (i) => baseY + 0.55 - (circuit.y[i] + side * (halfAt(i) + VERGE_WIDTH) * Math.tan(circuit.bank[i])),
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
    const groundPack = grassMaps(cityLike ? 0x3c4139 : 0x1a3014);
    groundPack.map.repeat.set(groundSize / 26, groundSize / 26);
    groundPack.normalMap.repeat.set(groundSize / 26, groundSize / 26);
    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(groundSize, groundSize),
        new THREE.MeshStandardMaterial({
            map: groundPack.map,
            normalMap: groundPack.normalMap,
            normalScale: new THREE.Vector2(0.9, 0.9),
            roughnessMap: groundPack.roughnessMap,
            roughness: 1
        })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set((circuit.minX + circuit.maxX) / 2, baseY + 0.55, (circuit.minZ + circuit.maxZ) / 2);
    ground.receiveShadow = false;
    group.add(ground);

    /* --- barriers ------------------------------------------------- */
    const concretePack = concreteMaps();
    const wallHeight = 1.1;
    const wallGeo = new THREE.BoxGeometry(3.5, wallHeight, 0.42);
    const wallMaterial = new THREE.MeshStandardMaterial({
        map: concretePack.map,
        normalMap: concretePack.normalMap,
        normalScale: new THREE.Vector2(0.6, 0.6),
        roughnessMap: concretePack.roughnessMap,
        roughness: 0.82,
        metalness: 0.06
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

    // Catch fencing above barriers on high-speed stretches.
    const fenceMat = new THREE.MeshStandardMaterial({
        map: fenceTexture(),
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        roughness: 0.4,
        metalness: 0.7,
        depthWrite: false
    });
    const fenceGeo = new THREE.PlaneGeometry(3.5, 2.4);
    const fenceCount = Math.floor(circuit.count / (wallStep * 2)) * 2;
    const fences = new THREE.InstancedMesh(fenceGeo, fenceMat, Math.max(1, fenceCount));
    let fi = 0;
    for (let i = 0; i < circuit.count; i += wallStep * 2) {
        if (Math.abs(circuit.curvature[i]) > 0.012) continue; // skip tight hairpins
        for (const side of [-1, 1]) {
            if (fi >= fenceCount) break;
            const lateral = side * (halfAt(i) + RUNOFF_WIDTH + 1.35);
            const [x, y, z] = surfacePoint(circuit, i, lateral, -0.4);
            dummy.position.set(x, y + wallHeight + 1.2, z);
            dummy.rotation.set(0, circuit.heading[i] + (side > 0 ? 0 : Math.PI), 0);
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();
            fences.setMatrixAt(fi++, dummy.matrix);
        }
    }
    fences.count = fi;
    group.add(fences);

    // Tyre stacks on the outside of the quickest corners.
    const tyreGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.55, 12);
    const tyreMaterial = new THREE.MeshStandardMaterial({ color: 0x1b1c20, roughness: 0.95 });
    const stackSlots = [];
    for (let i = 0; i < circuit.count; i += 3) {
        if (Math.abs(circuit.curvature[i]) < 0.008) continue;
        stackSlots.push(i);
    }
    const tyres = new THREE.InstancedMesh(tyreGeo, tyreMaterial, Math.max(1, stackSlots.length * 4));
    tyres.castShadow = quality.shadows;
    let ti = 0;
    for (const i of stackSlots) {
        const side = circuit.curvature[i] > 0 ? -1 : 1;
        const lateral = side * (halfAt(i) + RUNOFF_WIDTH + 0.5);
        const [x, y, z] = surfacePoint(circuit, i, lateral, -0.4);
        for (let level = 0; level < 4; level++) {
            dummy.position.set(x + (level % 2) * 0.15, y + 0.28 + level * 0.52, z);
            dummy.rotation.set(0, circuit.heading[i] + level * 0.2, 0);
            dummy.updateMatrix();
            tyres.setMatrixAt(ti++, dummy.matrix);
        }
    }
    tyres.count = ti;
    group.add(tyres);

    /* --- advertising hoardings ------------------------------------ */
    const boardStride = 12;
    const boardCount = Math.floor(circuit.count / boardStride);
    const boardGeo = new THREE.PlaneGeometry(7.2, 1.7);
    const boardMats = TEAMS.map((team) => new THREE.MeshStandardMaterial({
        map: bannerTexture(team),
        roughness: 0.45,
        metalness: 0.15,
        side: THREE.DoubleSide,
        envMapIntensity: 0.8
    }));
    let bi = 0;
    for (let i = 0; i < circuit.count; i += boardStride) {
        for (const side of [-1, 1]) {
            const teamIdx = (Math.floor(i / boardStride) + (side > 0 ? 3 : 0)) % TEAMS.length;
            const board = new THREE.Mesh(boardGeo, boardMats[teamIdx]);
            const lateral = side * (halfAt(i) + RUNOFF_WIDTH + 1.05);
            const [x, y, z] = surfacePoint(circuit, i, lateral, -0.4);
            board.position.set(x, y + 1.6, z);
            board.rotation.y = circuit.heading[i] + (side > 0 ? Math.PI : 0);
            group.add(board);
            bi++;
            if (bi > boardCount * 2) break;
        }
    }
    void bi;

    /* --- light poles ---------------------------------------------- */
    if (quality.scenery > 0.2) {
        const poleGeo = lightPoleGeometry();
        const poleMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.65 });
        const poleStep = Math.max(8, Math.round(28 / quality.scenery));
        const poleSlots = Math.floor(circuit.count / poleStep);
        const poles = new THREE.InstancedMesh(poleGeo, poleMat, poleSlots);
        poles.castShadow = quality.shadows;
        let pi = 0;
        for (let i = 0; i < circuit.count && pi < poleSlots; i += poleStep) {
            const side = (Math.floor(i / poleStep) % 2 === 0) ? 1 : -1;
            const lateral = side * (halfAt(i) + RUNOFF_WIDTH + 4.5);
            const [x, y, z] = surfacePoint(circuit, i, lateral, -0.4);
            dummy.position.set(x, y, z);
            dummy.rotation.set(0, circuit.heading[i] + (side > 0 ? Math.PI / 2 : -Math.PI / 2), 0);
            dummy.scale.setScalar(1);
            dummy.updateMatrix();
            poles.setMatrixAt(pi++, dummy.matrix);
        }
        poles.count = pi;
        group.add(poles);
    }

    /* --- scenery -------------------------------------------------- */
    if (quality.scenery > 0.1 && !cityLike) {
        const trees = new THREE.InstancedMesh(
            treeGeometry(),
            new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0.0 }),
            Math.floor(circuit.count * 2.1 * quality.scenery)
        );
        trees.castShadow = quality.shadows;
        trees.receiveShadow = quality.shadows;
        let seed = 1337;
        const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
        let idx = 0;
        const step = Math.max(2, Math.round(5 / quality.scenery));
        for (let i = 0; i < circuit.count && idx < trees.count; i += step) {
            const clusters = rand() < 0.6 ? 2 : 1;
            for (let c = 0; c < clusters && idx < trees.count; c++) {
                const side = rand() < 0.5 ? -1 : 1;
                const lateral = side * (halfAt(i) + RUNOFF_WIDTH + 14 + rand() * 78);
                const [x, , z] = surfacePoint(circuit, i, lateral, -0.4);
                const scale = 0.7 + rand() * 1.05;
                dummy.position.set(x + (rand() - 0.5) * 12, baseY + 0.55, z + (rand() - 0.5) * 12);
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

    // Grandstands + pit complex at the start/finish.
    const standSpots = [0];
    const sorted = [...circuit.corners].sort((a, b) => a.radius - b.radius).slice(0, 4);
    for (const corner of sorted) standSpots.push(corner.index);
    for (const spotIndex of standSpots) {
        const stand = buildGrandstand(spotIndex === 0 ? 130 : 75, spotIndex === 0 ? 13 : 8.5);
        const side = spotIndex === 0 ? 1 : (circuit.curvature[spotIndex] > 0 ? -1 : 1);
        const lateral = side * (halfAt(spotIndex) + RUNOFF_WIDTH + 3.5);
        const [x, y, z] = surfacePoint(circuit, spotIndex, lateral, -0.4);
        stand.position.set(x, y, z);
        stand.rotation.y = circuit.heading[spotIndex] + (side > 0 ? Math.PI / 2 : -Math.PI / 2);
        group.add(stand);
    }

    {
        const pits = pitBuilding(110);
        const side = -1;
        const lateral = side * (halfAt(0) + RUNOFF_WIDTH + 18);
        const [x, y, z] = surfacePoint(circuit, 0, lateral, -0.4);
        pits.position.set(x, y, z);
        pits.rotation.y = circuit.heading[0] + (side > 0 ? Math.PI / 2 : -Math.PI / 2);
        group.add(pits);
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
        color: 0x0a2e1c, emissive: 0x18f08a, emissiveIntensity: 1.6, roughness: 0.35, metalness: 0.2
    });
    for (const zone of circuit.drs) {
        const i = circuit.indexAt(zone.start * circuit.length);
        for (const side of [-1, 1]) {
            const sign = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.2, 0.22), drsMaterial);
            const lateral = side * (halfAt(i) + 3.2);
            const [x, y, z] = surfacePoint(circuit, i, lateral, 0);
            sign.position.set(x, y + 2.3, z);
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
        update(target) {
            sun.target.position.copy(target);
            sun.position.copy(target).addScaledVector(sunDirection, 280);
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
