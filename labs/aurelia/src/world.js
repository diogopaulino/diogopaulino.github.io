/**
 * Mundo da Costa Aurélia: asfalto, ombro, terreno, oceano, árvores instanciadas,
 * falésias, vinhedos, palco do festival e túnel.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createSkyDome, createSkyUniforms, createWater, applySky } from './sky.js';
import {
    roadTexture, dirtTexture, grassTexture, rockTexture,
    barkTexture, leafTexture, bannerTexture
} from './textures.js';
import { SKIES } from './config.js';
import { hash2, lerp, smoothstep, mulberry32 } from './utils.js';

function faceUpwards(geometry) {
    geometry.computeVertexNormals();
    const normals = geometry.attributes.normal;
    let sum = 0;
    const stride = Math.max(1, Math.floor(normals.count / 48));
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

function buildRibbon(road, inner, outer, { lift = 0, vScale = 1 / 14, step = 1 } = {}) {
    const n = road.count;
    const innerAt = typeof inner === 'function' ? inner : () => inner;
    const outerAt = typeof outer === 'function' ? outer : () => outer;
    const cols = Math.ceil(n / step) + 1;
    const positions = new Float32Array(cols * 2 * 3);
    const uvs = new Float32Array(cols * 2 * 2);
    const indices = [];

    for (let c = 0; c < cols; c++) {
        const i = (c * step) % n;
        const inn = innerAt(i);
        const out = outerAt(i);
        const y = road.y[i] + lift;
        const ix = road.cx[i] + road.nx[i] * inn;
        const iz = road.cz[i] + road.nz[i] * inn;
        const ox = road.cx[i] + road.nx[i] * out;
        const oz = road.cz[i] + road.nz[i] * out;
        const bankY = Math.tan(road.bank[i]);
        positions.set([ix, y + inn * bankY, iz], c * 6);
        positions.set([ox, y + out * bankY, oz], c * 6 + 3);
        const v = (road.s[i] * vScale) % 1;
        uvs.set([0, v, 1, v], c * 4);
        if (c < cols - 1) {
            const a = c * 2, b = a + 1, d = a + 2, e = a + 3;
            indices.push(a, d, b, b, d, e);
        }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    return faceUpwards(geo);
}

function treeGeometry() {
    const trunk = new THREE.CylinderGeometry(0.12, 0.2, 2.4, 5);
    trunk.translate(0, 1.2, 0);
    const crown = new THREE.ConeGeometry(1.15, 3.2, 6);
    crown.translate(0, 3.4, 0);
    const crown2 = new THREE.ConeGeometry(0.85, 2.2, 6);
    crown2.translate(0, 4.6, 0);
    return { trunk, crown: mergeGeometries([crown, crown2]) };
}

function cypressGeometry() {
    const trunk = new THREE.CylinderGeometry(0.08, 0.12, 1.6, 5);
    trunk.translate(0, 0.8, 0);
    const crown = new THREE.ConeGeometry(0.55, 4.8, 6);
    crown.translate(0, 3.4, 0);
    return { trunk, crown };
}

function palmGeometry() {
    const trunk = new THREE.CylinderGeometry(0.1, 0.16, 4.2, 6);
    trunk.translate(0, 2.1, 0);
    const fronds = [];
    for (let i = 0; i < 6; i++) {
        const leaf = new THREE.BoxGeometry(0.12, 0.04, 1.8);
        leaf.translate(0, 4.2, 0.7);
        leaf.rotateY((i / 6) * Math.PI * 2);
        leaf.rotateX(-0.45);
        fronds.push(leaf);
    }
    return { trunk, crown: mergeGeometries(fronds) };
}

function tentGeometry() {
    const base = new THREE.ConeGeometry(2.2, 2.4, 4);
    base.translate(0, 1.2, 0);
    return base;
}

export function terrainHeight(x, z, road) {
    const loc = road.locate(x, z);
    const dist = Math.abs(loc.lateral);
    const roadY = road.heightAt(loc.index, 0);
    const n1 = hash2(Math.floor(x * 0.04), Math.floor(z * 0.04));
    const n2 = hash2(Math.floor(x * 0.012 + 9), Math.floor(z * 0.012));
    const hills = (n1 - 0.5) * 16 + (n2 - 0.5) * 28;
    const blend = smoothstep(11, 70, dist);
    let y = lerp(roadY, roadY * 0.35 + hills + 8, blend);

    const west = smoothstep(40, -220, x);
    if (west > 0 && dist > 16) {
        y = lerp(y, -6, west * smoothstep(16, 40, dist));
    }
    return y;
}

export function buildWorld(road, quality, skyId = 'golden') {
    const scene = new THREE.Scene();
    const skyUniforms = createSkyUniforms(skyId);
    const sky = createSkyDome(skyUniforms);
    scene.add(sky);
    const water = createWater(skyUniforms);
    scene.add(water);

    const aniso = quality.anisotropy;
    const roadMat = new THREE.MeshStandardMaterial({
        map: roadTexture(aniso),
        roughness: 0.62,
        metalness: 0.04,
        color: 0x9a9da4
    });
    const asphalt = new THREE.Mesh(buildRibbon(road, -road.halfWidth, road.halfWidth, { lift: 0.04, vScale: 1 / 12 }), roadMat);
    asphalt.receiveShadow = true;
    scene.add(asphalt);

    const dirtMat = new THREE.MeshStandardMaterial({
        map: dirtTexture(aniso), roughness: 0.92, metalness: 0
    });
    const shoulder = new THREE.Mesh(
        buildRibbon(road, -road.halfWidth - 3.2, -road.halfWidth, { lift: 0.01, vScale: 1 / 8 }),
        dirtMat
    );
    const shoulder2 = new THREE.Mesh(
        buildRibbon(road, road.halfWidth, road.halfWidth + 3.2, { lift: 0.01, vScale: 1 / 8 }),
        dirtMat
    );
    shoulder.receiveShadow = true;
    shoulder2.receiveShadow = true;
    scene.add(shoulder, shoulder2);

    const grassMat = new THREE.MeshStandardMaterial({
        map: grassTexture(aniso), roughness: 0.95, metalness: 0, color: 0xc8d4a8
    });
    const verge = new THREE.Mesh(
        buildRibbon(road, -road.halfWidth - 28, -road.halfWidth - 3.2, { lift: -0.05, vScale: 1 / 20, step: 2 }),
        grassMat
    );
    const verge2 = new THREE.Mesh(
        buildRibbon(road, road.halfWidth + 3.2, road.halfWidth + 28, { lift: -0.05, vScale: 1 / 20, step: 2 }),
        grassMat
    );
    verge.receiveShadow = true;
    verge2.receiveShadow = true;
    scene.add(verge, verge2);

    /* Terrain skirt */
    const pad = 420;
    const minX = road.minX - pad;
    const minZ = road.minZ - pad;
    const maxX = road.maxX + pad;
    const maxZ = road.maxZ + pad;
    const res = quality.shadows ? 96 : 64;
    const terrainGeo = new THREE.PlaneGeometry(maxX - minX, maxZ - minZ, res, res);
    terrainGeo.rotateX(-Math.PI / 2);
    const pos = terrainGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i) + (minX + maxX) * 0.5;
        const z = pos.getZ(i) + (minZ + maxZ) * 0.5;
        pos.setY(i, terrainHeight(x, z, road));
        pos.setX(i, x);
        pos.setZ(i, z);
    }
    terrainGeo.computeVertexNormals();
    const terrain = new THREE.Mesh(terrainGeo, new THREE.MeshStandardMaterial({
        map: grassTexture(aniso),
        roughness: 0.96,
        metalness: 0,
        color: 0xb7c48c
    }));
    terrain.receiveShadow = true;
    terrain.position.y = -0.4;
    scene.add(terrain);

    /* Sand near ocean */
    const sand = new THREE.Mesh(
        new THREE.CircleGeometry(520, 32),
        new THREE.MeshStandardMaterial({ color: 0xc2a070, roughness: 0.95, map: dirtTexture(aniso) })
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(-280, 0.6, 40);
    sand.receiveShadow = true;
    scene.add(sand);

    const rockMat = new THREE.MeshStandardMaterial({ map: rockTexture(aniso), roughness: 0.88, color: 0x8a8478 });
    const cliff = new THREE.Mesh(new THREE.BoxGeometry(18, 28, 220), rockMat);
    cliff.position.set(-90, 8, 80);
    cliff.rotation.y = 0.4;
    cliff.castShadow = true;
    scene.add(cliff);
    const cliff2 = cliff.clone();
    cliff2.position.set(-70, 14, 260);
    cliff2.scale.set(1.2, 1.6, 0.6);
    scene.add(cliff2);

    /* Trees */
    const pine = treeGeometry();
    const cyp = cypressGeometry();
    const palm = palmGeometry();
    const bark = new THREE.MeshStandardMaterial({ map: barkTexture(), roughness: 0.9 });
    const leaf = new THREE.MeshStandardMaterial({ map: leafTexture(), roughness: 0.85, color: 0x88cc66 });
    const cypLeaf = new THREE.MeshStandardMaterial({ color: 0x1f5a32, roughness: 0.85 });
    const palmLeaf = new THREE.MeshStandardMaterial({ color: 0x2f8a44, roughness: 0.8 });

    scatterTrees(scene, road, quality.trees, pine, bark, leaf, 'pine');
    scatterTrees(scene, road, Math.floor(quality.trees * 0.35), cyp, bark, cypLeaf, 'cyp');
    scatterTrees(scene, road, Math.floor(quality.trees * 0.18), palm, bark, palmLeaf, 'palm', { west: true });

    /* Rocks */
    scatterRocks(scene, road, quality.rocks, rockMat);

    /* Festival plaza near s=0 */
    const plaza = buildFestival(road);
    scene.add(plaza);

    /* Tunnel */
    for (const tun of road.tunnels) {
        const start = road.sample(tun.start * road.length);
        const end = road.sample(tun.end * road.length);
        const dx = end.x - start.x;
        const dz = end.z - start.z;
        const len = Math.hypot(dx, dz);
        const mid = road.sample((tun.start + tun.end) * 0.5 * road.length);
        const shell = new THREE.Mesh(
            new THREE.CylinderGeometry(6.4, 6.4, len + 8, 10, 1, true, 0, Math.PI),
            new THREE.MeshStandardMaterial({ color: 0x4a463e, roughness: 0.9, side: THREE.DoubleSide })
        );
        shell.rotation.z = Math.PI / 2;
        shell.rotation.y = mid.heading + Math.PI / 2;
        shell.position.set(mid.x, mid.y + 3.2, mid.z);
        scene.add(shell);
    }

    /* Event gates */
    const gates = [];
    const gateGeo = new THREE.TorusGeometry(5.5, 0.12, 8, 24, Math.PI);
    const speedMat = new THREE.MeshStandardMaterial({
        color: 0x4ad2ff, emissive: 0x1488cc, emissiveIntensity: 0.8, roughness: 0.3
    });
    const driftMat = new THREE.MeshStandardMaterial({
        color: 0xffc44a, emissive: 0xcc8800, emissiveIntensity: 0.8, roughness: 0.3
    });

    const hemi = new THREE.HemisphereLight(0xffc090, 0x3a2818, 0.7);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffb060, 2.8);
    sun.position.set(180, 90, 120);
    sun.castShadow = !!quality.shadows;
    if (quality.shadows) {
        sun.shadow.mapSize.set(quality.shadowMap, quality.shadowMap);
        sun.shadow.camera.near = 10;
        sun.shadow.camera.far = 420;
        sun.shadow.camera.left = -90;
        sun.shadow.camera.right = 90;
        sun.shadow.camera.top = 90;
        sun.shadow.camera.bottom = -90;
        sun.shadow.bias = -0.00025;
    }
    scene.add(sun);
    scene.add(sun.target);

    const fill = new THREE.DirectionalLight(0x88aadd, 0.35);
    fill.position.set(-80, 40, -60);
    scene.add(fill);

    applyLighting(hemi, sun, skyId);

    scene.fog = new THREE.FogExp2(new THREE.Color().fromArray(SKIES[skyId].fog), SKIES[skyId].fogDensity);

    return {
        scene, sky, water, skyUniforms, sun, hemi, gates, gateGeo, speedMat, driftMat,
        applySkyId(id) {
            applySky(skyUniforms, id);
            applyLighting(hemi, sun, id);
            const stop = SKIES[id];
            scene.fog.color.fromArray(stop.fog);
            scene.fog.density = stop.fogDensity;
        }
    };
}

function applyLighting(hemi, sun, skyId) {
    const stop = SKIES[skyId];
    hemi.color.set(stop.hemiSky);
    hemi.groundColor.set(stop.hemiGround);
    hemi.intensity = stop.ambient + 0.35;
    sun.color.set(stop.dirColor);
    sun.intensity = stop.dirIntensity;
    const d = new THREE.Vector3().fromArray(stop.sunDir).normalize();
    sun.position.copy(d).multiplyScalar(260);
}

function scatterTrees(scene, road, count, geo, trunkMat, crownMat, seed, { west = false } = {}) {
    if (count <= 0) return;
    const rand = mulberry32(seed === 'pine' ? 7 : seed === 'cyp' ? 13 : 21);
    const trunkMesh = new THREE.InstancedMesh(geo.trunk, trunkMat, count);
    const crownMesh = new THREE.InstancedMesh(geo.crown, crownMat, count);
    trunkMesh.castShadow = true;
    crownMesh.castShadow = true;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    let placed = 0;
    let guard = 0;
    while (placed < count && guard < count * 8) {
        guard++;
        const i = Math.floor(rand() * road.count);
        const side = rand() > 0.5 ? 1 : -1;
        const lat = (road.halfWidth + 8 + rand() * 70) * side;
        const x = road.cx[i] + road.nx[i] * lat;
        const z = road.cz[i] + road.nz[i] * lat;
        if (west && x > -20) continue;
        if (!west && x < -160) continue;
        if (Math.abs(lat) < road.halfWidth + 6) continue;
        const y = terrainHeight(x, z, road);
        if (y < 2) continue;
        const scale = 0.75 + rand() * 0.7;
        p.set(x, y, z);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI * 2);
        s.set(scale, scale, scale);
        m.compose(p, q, s);
        trunkMesh.setMatrixAt(placed, m);
        crownMesh.setMatrixAt(placed, m);
        placed++;
    }
    trunkMesh.count = placed;
    crownMesh.count = placed;
    scene.add(trunkMesh, crownMesh);
}

function scatterRocks(scene, road, count, mat) {
    if (count <= 0) return;
    const rand = mulberry32(99);
    const geo = new THREE.DodecahedronGeometry(1.1, 0);
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    let placed = 0;
    for (let n = 0; n < count * 3 && placed < count; n++) {
        const i = Math.floor(rand() * road.count);
        const side = rand() > 0.5 ? 1 : -1;
        const lat = (road.halfWidth + 6 + rand() * 40) * side;
        const x = road.cx[i] + road.nx[i] * lat;
        const z = road.cz[i] + road.nz[i] * lat;
        const y = terrainHeight(x, z, road);
        if (y < 1.5) continue;
        p.set(x, y, z);
        q.setFromEuler(new THREE.Euler(rand(), rand() * 6, rand() * 0.4));
        const sc = 0.6 + rand() * 1.8;
        s.set(sc, sc * (0.6 + rand()), sc);
        m.compose(p, q, s);
        mesh.setMatrixAt(placed, m);
        placed++;
    }
    mesh.count = placed;
    scene.add(mesh);
}

function buildFestival(road) {
    const group = new THREE.Group();
    const start = road.sample(8);
    group.position.set(start.x - start.nx * 22, start.y, start.z - start.nz * 22);

    const colors = [0xff6b2c, 0xffc44a, 0x4ad2ff, 0xff4d6d, 0x7dffb3];
    for (let i = 0; i < 7; i++) {
        const tent = new THREE.Mesh(tentGeometry(), new THREE.MeshStandardMaterial({
            color: colors[i % colors.length], roughness: 0.7, metalness: 0.05
        }));
        tent.position.set((i - 3) * 6.5, 0, -8 - (i % 2) * 5);
        tent.castShadow = true;
        group.add(tent);
    }

    const stage = new THREE.Mesh(new THREE.BoxGeometry(14, 1.2, 8), new THREE.MeshStandardMaterial({
        color: 0x1a1c22, roughness: 0.5
    }));
    stage.position.set(0, 0.6, -22);
    group.add(stage);

    const screen = new THREE.Mesh(new THREE.PlaneGeometry(10, 5), new THREE.MeshStandardMaterial({
        color: 0xff8a3a, emissive: 0xff6a20, emissiveIntensity: 0.7
    }));
    screen.position.set(0, 4.2, -25.8);
    group.add(screen);

    const banner = new THREE.Mesh(new THREE.PlaneGeometry(12, 3.2), new THREE.MeshStandardMaterial({
        map: bannerTexture('#ff6b2c', '#111318'), side: THREE.DoubleSide
    }));
    banner.position.set(0, 6.4, 4);
    group.add(banner);

    const poleL = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 8, 6), new THREE.MeshStandardMaterial({ color: 0x222 }));
    poleL.position.set(-6.2, 4, 4);
    const poleR = poleL.clone();
    poleR.position.x = 6.2;
    group.add(poleL, poleR);

    const light = new THREE.PointLight(0xff7a3a, 4.5, 40);
    light.position.set(0, 5, -18);
    group.add(light);

    return group;
}

export function placeEventGates(world, road, events) {
    for (const g of world.gates) world.scene.remove(g);
    world.gates.length = 0;
    for (const ev of events) {
        const sample = road.sample(ev.start * road.length);
        const mesh = new THREE.Mesh(world.gateGeo, ev.kind === 'drift' ? world.driftMat : world.speedMat);
        mesh.rotation.set(0, sample.heading, Math.PI / 2);
        mesh.position.set(sample.x, sample.y + 2.8, sample.z);
        world.scene.add(mesh);
        world.gates.push(mesh);

        const end = road.sample(ev.end * road.length);
        const mesh2 = mesh.clone();
        mesh2.position.set(end.x, end.y + 2.8, end.z);
        mesh2.rotation.y = end.heading;
        world.scene.add(mesh2);
        world.gates.push(mesh2);
    }
}

export function followSunShadow(sun, target, sunDir) {
    if (!sun.castShadow) return;
    sun.position.copy(target).addScaledVector(sunDir, 240);
    sun.target.position.copy(target);
    sun.target.updateMatrixWorld();
}
