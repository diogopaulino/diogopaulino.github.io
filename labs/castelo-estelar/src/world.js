/**
 * Reino noturno: colina, lago, pinheiros, lua e céu.
 * A água usa o Reflector/Water do three.js para o reflexo da lua e do castelo.
 */

import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { createCastle } from './castle.js';
import { makeSkyMaterial } from './shaders.js';
import {
    waterNormals, moonTexture, barkTexture, grassNight
} from './textures.js';
import { fbm, seeded } from './utils.js';

const dummy = new THREE.Object3D();

export function heightAt(x, z) {
    const r = Math.hypot(x, z);
    const island = Math.max(0, 1 - r / 38);
    const hill = Math.pow(island, 1.35) * 6.4;
    const noise = fbm(x * 0.045, z * 0.045, 5, 4) * 1.4 * island;
    const rim = r < 22 ? 0 : -Math.max(0, (r - 22) * 0.35);
    return hill + noise + rim;
}

function makeTerrain(quality) {
    const segs = quality.id === 'low' ? 64 : quality.id === 'high' ? 128 : 96;
    const size = 90;
    const geo = new THREE.PlaneGeometry(size, size, segs, segs);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = [];
    const cGrass = new THREE.Color(0x1a2a18);
    const cStone = new THREE.Color(0x3a3a36);
    const cSand = new THREE.Color(0x2a3228);
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const y = Math.max(0.05, heightAt(x, z));
        pos.setY(i, y);
        const r = Math.hypot(x, z);
        tmp.copy(cGrass);
        if (y < 1.2) tmp.lerp(cSand, 0.7);
        if (r < 16) tmp.lerp(cStone, 0.35);
        colors.push(tmp.r, tmp.g, tmp.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
        map: grassNight(),
        vertexColors: true,
        roughness: 0.92,
        metalness: 0.02
    }));
}

function makePines(quality) {
    const rng = seeded(20260814);
    const count = quality.trees;
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 2.2, 6);
    const leafGeo = new THREE.ConeGeometry(1, 2.4, 8);
    const trunkMat = new THREE.MeshStandardMaterial({
        color: 0x2a1a10,
        map: barkTexture(),
        roughness: 0.92
    });
    const leafMat = new THREE.MeshStandardMaterial({
        color: 0x0c1a12,
        roughness: 0.78,
        metalness: 0.02
    });

    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
    const leavesA = new THREE.InstancedMesh(leafGeo, leafMat, count);
    const leavesB = new THREE.InstancedMesh(leafGeo, leafMat, count);
    trunks.castShadow = leavesA.castShadow = leavesB.castShadow = true;
    trunks.receiveShadow = true;

    const spots = [];
    let placed = 0;
    let guard = 0;
    while (placed < count && guard < count * 20) {
        guard++;
        const a = rng() * Math.PI * 2;
        const ring = rng();
        const r = ring < 0.45
            ? 18 + rng() * 16
            : 32 + rng() * 22;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        if (z > 8 && r < 28) continue;
        if (Math.hypot(x, z) < 14) continue;
        spots.push([x, z, 0.85 + rng() * 1.6, rng() * Math.PI]);
        placed++;
    }

    spots.forEach((s, i) => {
        const [x, z, sc, rot] = s;
        const y = Math.max(0.2, heightAt(x, z));
        dummy.position.set(x, y + 1.1 * sc, z);
        dummy.rotation.set(0, rot, 0);
        dummy.scale.set(sc, sc * 1.15, sc);
        dummy.updateMatrix();
        trunks.setMatrixAt(i, dummy.matrix);

        dummy.position.set(x, y + 2.5 * sc, z);
        dummy.scale.set(sc * 1.55, sc * 1.4, sc * 1.55);
        dummy.updateMatrix();
        leavesA.setMatrixAt(i, dummy.matrix);

        dummy.position.set(x, y + 3.7 * sc, z);
        dummy.scale.set(sc * 1.15, sc * 1.2, sc * 1.15);
        dummy.updateMatrix();
        leavesB.setMatrixAt(i, dummy.matrix);
    });

    // Pinheiros de primeiro plano — o enquadramento clássico da abertura
    const fg = [
        [-16, 28, 2.4], [-12, 32, 1.9], [15, 30, 2.2], [19, 26, 2.6],
        [-22, 22, 1.7], [24, 20, 1.8]
    ];
    fg.forEach(([x, z, sc], k) => {
        const i = Math.min(spots.length - 1, k);
        if (i < 0) return;
        const y = Math.max(0.15, heightAt(x, z));
        dummy.position.set(x, y + 1.1 * sc, z);
        dummy.rotation.set(0, k, 0);
        dummy.scale.set(sc, sc * 1.2, sc);
        dummy.updateMatrix();
        trunks.setMatrixAt(i, dummy.matrix);
        dummy.position.set(x, y + 2.6 * sc, z);
        dummy.scale.set(sc * 1.6, sc * 1.45, sc * 1.6);
        dummy.updateMatrix();
        leavesA.setMatrixAt(i, dummy.matrix);
        dummy.position.set(x, y + 4.0 * sc, z);
        dummy.scale.set(sc * 1.15, sc * 1.25, sc * 1.15);
        dummy.updateMatrix();
        leavesB.setMatrixAt(i, dummy.matrix);
    });

    const group = new THREE.Group();
    group.add(trunks, leavesA, leavesB);
    return group;
}

function makeMoon() {
    const group = new THREE.Group();
    const moon = new THREE.Mesh(
        new THREE.SphereGeometry(7.5, 48, 32),
        new THREE.MeshStandardMaterial({
            map: moonTexture(),
            emissive: 0xcfd8ee,
            emissiveIntensity: 0.55,
            roughness: 1,
            metalness: 0,
            toneMapped: true
        })
    );
    moon.position.set(-42, 58, -38);
    moon.castShadow = false;
    moon.receiveShadow = false;
    group.add(moon);

    const glow = new THREE.Mesh(
        new THREE.SphereGeometry(11, 24, 16),
        new THREE.MeshBasicMaterial({
            color: 0xb8c8ff,
            transparent: true,
            opacity: 0.12,
            depthWrite: false,
            side: THREE.BackSide
        })
    );
    glow.position.copy(moon.position);
    group.add(glow);
    group.userData.moon = moon;
    return group;
}

function makeStars(count) {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const color = new THREE.Color();
    for (let i = 0; i < count; i++) {
        const u = Math.random();
        const v = Math.random();
        const theta = u * Math.PI * 2;
        const phi = Math.acos(2 * v - 1);
        const r = 420 + Math.random() * 80;
        pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        pos[i * 3 + 1] = Math.abs(r * Math.cos(phi));
        pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
        const t = Math.random();
        if (t < 0.15) color.setRGB(0.7, 0.82, 1);
        else if (t < 0.28) color.setRGB(1, 0.82, 0.55);
        else color.setRGB(0.95, 0.96, 1);
        const mag = 0.45 + Math.random() * 0.7;
        col[i * 3] = color.r * mag;
        col[i * 3 + 1] = color.g * mag;
        col[i * 3 + 2] = color.b * mag;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return new THREE.Points(geo, new THREE.PointsMaterial({
        size: 1.6,
        sizeAttenuation: false,
        vertexColors: true,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    }));
}

function makeClouds(count) {
    const group = new THREE.Group();
    const geo = new THREE.SphereGeometry(1, 10, 8);
    const mat = new THREE.MeshStandardMaterial({
        color: 0x1a2438,
        roughness: 1,
        transparent: true,
        opacity: 0.42,
        depthWrite: false
    });
    const rng = seeded(77);
    for (let i = 0; i < count; i++) {
        const c = new THREE.Mesh(geo, mat);
        const a = rng() * Math.PI * 2;
        const r = 40 + rng() * 70;
        c.position.set(Math.cos(a) * r, 18 + rng() * 16, Math.sin(a) * r - 20);
        c.scale.set(8 + rng() * 10, 2.2 + rng() * 1.8, 5 + rng() * 6);
        c.castShadow = false;
        group.add(c);
    }
    return group;
}

export class Kingdom {
    constructor(scene, renderer, quality) {
        this.scene = scene;
        this.quality = quality;
        this.group = new THREE.Group();
        scene.add(this.group);

        this.skyMat = makeSkyMaterial();
        const sky = new THREE.Mesh(new THREE.SphereGeometry(520, 32, 20), this.skyMat);
        sky.frustumCulled = false;
        this.group.add(sky);
        this.group.add(makeStars(quality.stars));
        this.moon = makeMoon();
        this.group.add(this.moon);
        this.group.add(makeClouds(quality.clouds));

        const terrain = makeTerrain(quality);
        terrain.receiveShadow = true;
        terrain.castShadow = false;
        this.group.add(terrain);

        this.castle = createCastle();
        this.castle.position.y = 0.05;
        this.group.add(this.castle);
        this.group.add(makePines(quality));

        const waterGeo = new THREE.PlaneGeometry(220, 220);
        if (quality.waterSize >= 256) {
            this.water = new Water(waterGeo, {
                textureWidth: quality.waterSize,
                textureHeight: quality.waterSize,
                waterNormals: waterNormals(),
                sunDirection: new THREE.Vector3(-0.28, 0.58, 0.72).normalize(),
                sunColor: 0xe8f0ff,
                waterColor: 0x16344c,
                distortionScale: 1.6,
                fog: true,
                alpha: 1
            });
            this.water.rotation.x = -Math.PI / 2;
            this.water.position.y = 0.08;
        } else {
            this.water = new THREE.Mesh(waterGeo, new THREE.MeshStandardMaterial({
                color: 0x1a3a58,
                roughness: 0.14,
                metalness: 0.78,
                emissive: 0x061018,
                emissiveIntensity: 0.2
            }));
            this.water.rotation.x = -Math.PI / 2;
            this.water.position.y = 0.08;
        }
        this.group.add(this.water);

        this._lights();
    }

    _lights() {
        this.ambient = new THREE.AmbientLight(0x3a4868, 0.42);
        this.group.add(this.ambient);

        this.hemi = new THREE.HemisphereLight(0x9ab0d8, 0x12161e, 0.62);
        this.group.add(this.hemi);

        // Key: lua à esquerda-frente, para a fachada não virar silhueta.
        this.moonLight = new THREE.DirectionalLight(0xe8f0ff, 1.85);
        this.moonLight.position.set(-28, 58, 72);
        this.moonLight.castShadow = this.quality.shadows;
        if (this.quality.shadows) {
            const s = this.moonLight.shadow;
            s.mapSize.set(this.quality.shadowMap, this.quality.shadowMap);
            s.camera.near = 10;
            s.camera.far = 180;
            s.camera.left = s.camera.bottom = -48;
            s.camera.right = s.camera.top = 48;
            s.bias = -0.00025;
            s.normalBias = 0.04;
        }
        this.group.add(this.moonLight);
        this.group.add(this.moonLight.target);
        this.moonLight.target.position.set(0, 14, 0);

        this.rim = new THREE.DirectionalLight(0x9bb4ff, 0.55);
        this.rim.position.set(-40, 36, -55);
        this.group.add(this.rim);

        this.fill = new THREE.DirectionalLight(0xffe2b8, 0.38);
        this.fill.position.set(18, 22, 50);
        this.group.add(this.fill);

        this.warm = new THREE.PointLight(0xffb066, 16, 42, 1.5);
        this.warm.position.set(0, 11, 9);
        this.warm.castShadow = false;
        this.group.add(this.warm);

        this.spireLight = new THREE.PointLight(0xffc878, 10, 32, 1.7);
        this.spireLight.position.set(0, 42, -1);
        this.group.add(this.spireLight);
    }

    setGlow(t) {
        this.castle.userData.setGlow(0.85 + t * 1.8);
        this.warm.intensity = 10 + t * 16;
        this.spireLight.intensity = 6 + t * 12;
        this.fill.intensity = 0.38 + t * 0.22;
    }

    tick(time) {
        this.castle.userData.tick(time);
        if (this.water.material?.uniforms?.time) {
            this.water.material.uniforms.time.value = time * 0.35;
        } else if (this.water.material) {
            this.water.material.roughness = 0.16 + Math.sin(time * 0.4) * 0.03;
        }
        this.skyMat.uniforms.uTime.value = time;
        const moon = this.moon.userData.moon;
        if (moon) moon.rotation.y = time * 0.01;
    }
}
