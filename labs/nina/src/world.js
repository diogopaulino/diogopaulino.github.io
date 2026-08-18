/**
 * O vale: gramado deformado, lago, pomar, celeiro, ninho e os filhotes.
 */

import * as THREE from 'three';
import { WORLD_RADIUS, FRIENDS, TOTAL_BERRIES, heightAt, HOME } from './config.js';
import {
    MAT, geo, mesh, toon,
    createTree, createBarn, createPicnic, createFlower, createMushroom,
    createCloud, createRainbow, createFence, createBerry, createButterfly
} from './models.js';
import { createFriend } from './animals.js';
import { createSky } from './sky.js';

const waterVert = /* glsl */ `
uniform float uTime;
varying vec3 vWorld;
varying vec3 vNormal;
void main() {
    vec3 p = position;
    p.y += sin(p.x * 0.55 + uTime * 1.5) * 0.06 + cos(p.z * 0.5 + uTime * 1.2) * 0.05;
    vec4 world = modelMatrix * vec4(p, 1.0);
    vWorld = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
}`;

const waterFrag = /* glsl */ `
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uSky;
uniform float uTime;
varying vec3 vWorld;
varying vec3 vNormal;
void main() {
    vec3 n = normalize(vNormal);
    float fres = pow(1.0 - max(dot(n, vec3(0.0, 1.0, 0.0)), 0.0), 2.2);
    float bands = floor((vWorld.x * 0.14 + vWorld.z * 0.1 + sin(vWorld.x * 0.45 + uTime) * 0.08) * 5.0) / 5.0;
    vec3 col = mix(uDeep, uShallow, bands * 0.5 + 0.4);
    col = mix(col, uSky, fres * 0.42);
    float spark = step(0.97, fract(sin(dot(vWorld.xz * 0.8, vec2(12.9898, 78.233)) + uTime) * 43758.5453));
    col += vec3(1.0, 0.96, 0.85) * spark * 0.6;
    gl_FragColor = vec4(col, 0.9);
}`;

function hash(i) {
    const n = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    return n - Math.floor(n);
}

export class Valley {
    constructor(scene, quality) {
        this.scene = scene;
        this.quality = quality;
        this.clock = 0;
        this.root = new THREE.Group();
        scene.add(this.root);

        this.sky = createSky();
        scene.add(this.sky);

        this._terrain();
        this._water();
        this._landmarks();
        this._scatter();
        this._berries();
        this._friends();
        this._butterflies(quality.butterflies ?? 14);
        this.homeRing = this._homeRing();
    }

    groundHeight(x, z) {
        return heightAt(x, z);
    }

    _terrain() {
        const size = WORLD_RADIUS * 2.4;
        const g = new THREE.PlaneGeometry(size, size, 80, 80);
        g.rotateX(-Math.PI / 2);
        const pos = g.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
        }
        g.computeVertexNormals();
        const ground = new THREE.Mesh(g, MAT.grass);
        ground.receiveShadow = true;
        this.root.add(ground);

        const dirt = mesh(geo.cyl, MAT.dirt, {
            scale: [5.4, 0.08, 5.4],
            pos: [HOME.x, 0.02, HOME.z],
            cast: false
        });
        this.root.add(dirt);
    }

    _water() {
        const geometry = new THREE.CircleGeometry(4.6, 48);
        geometry.rotateX(-Math.PI / 2);
        const material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uDeep: { value: new THREE.Color('#1a8aaa') },
                uShallow: { value: new THREE.Color('#7af0e0') },
                uSky: { value: new THREE.Color('#ffe2b0') }
            },
            vertexShader: waterVert,
            fragmentShader: waterFrag,
            transparent: true
        });
        const water = new THREE.Mesh(geometry, material);
        water.position.set(-15.2, heightAt(-15.2, 7.2) + 0.35, 7.2);
        water.receiveShadow = true;
        this.root.add(water);
        this.water = water;

        const rim = mesh(geo.torus, MAT.dirt, {
            scale: [4.4, 0.6, 4.4],
            pos: [-15.2, water.position.y - 0.15, 7.2],
            rot: [Math.PI / 2, 0, 0],
            cast: false
        });
        this.root.add(rim);
    }

    _landmarks() {
        this.picnic = createPicnic();
        this.picnic.position.set(HOME.x, heightAt(HOME.x, HOME.z) + 0.02, HOME.z);
        this.root.add(this.picnic);

        const barn = createBarn();
        barn.position.set(13.5, heightAt(13.5, -10), -10);
        barn.rotation.y = -0.4;
        this.root.add(barn);

        const fenceA = createFence(7);
        fenceA.position.set(10.2, heightAt(10.2, -12.4), -12.4);
        fenceA.rotation.y = 0.4;
        this.root.add(fenceA);

        const rainbow = createRainbow();
        rainbow.position.set(-6, 4.5, -18);
        this.root.add(rainbow);
        this.rainbow = rainbow;
    }

    _scatter() {
        const flowerMats = [MAT.flowerP, MAT.flowerY, MAT.flowerL, MAT.flowerO];
        const nFlowers = this.quality.flowers ?? 70;
        for (let i = 0; i < nFlowers; i++) {
            const a = hash(i * 3.1) * Math.PI * 2;
            const r = 6 + hash(i * 7.7) * 30;
            const x = Math.cos(a) * r;
            const z = Math.sin(a) * r;
            if (Math.hypot(x + 15, z - 7) < 5) continue;
            const f = createFlower(flowerMats[i % 4]);
            f.position.set(x, heightAt(x, z), z);
            f.rotation.y = hash(i) * 6;
            f.scale.setScalar(0.85 + hash(i + 9) * 0.5);
            this.root.add(f);
        }

        for (let i = 0; i < 16; i++) {
            const a = 0.4 + i * 0.38;
            const r = 18 + (i % 5) * 2.4;
            const x = Math.cos(a) * r + 4;
            const z = Math.sin(a) * r + 8;
            const tree = createTree({
                h: 1.8 + hash(i) * 1.4,
                r: 1.0 + hash(i + 2) * 0.55,
                fruit: i % 2 === 0,
                tint: i % 3 === 0 ? 0x7ae08a : 0x4ecf6a
            });
            tree.position.set(x, heightAt(x, z), z);
            this.root.add(tree);
        }

        for (let i = 0; i < 12; i++) {
            const a = Math.PI + i * 0.45;
            const r = 16 + hash(i + 4) * 4;
            const x = Math.cos(a) * r - 4;
            const z = Math.sin(a) * r - 4;
            const m = createMushroom({
                s: 0.8 + hash(i) * 1.1,
                cap: i % 2 ? 0xff6b7a : 0xffc04a
            });
            m.position.set(x, heightAt(x, z), z);
            this.root.add(m);
        }

        this.clouds = [];
        const nClouds = this.quality.clouds ?? 10;
        for (let i = 0; i < nClouds; i++) {
            const c = createCloud();
            const a = hash(i + 20) * Math.PI * 2;
            const r = 12 + hash(i + 40) * 28;
            c.position.set(Math.cos(a) * r, 10 + hash(i) * 6, Math.sin(a) * r);
            c.scale.setScalar(1.2 + hash(i + 3) * 1.6);
            this.root.add(c);
            this.clouds.push(c);
        }
    }

    _berries() {
        this.berries = [];
        const spots = [
            [2.8, 4.5], [4.2, -1.2], [-3.4, 3.1], [8.5, -4],
            [-8.2, 1.4], [6.2, 10.5], [-10.5, -6.2], [16.4, 1.2],
            [1.2, -8.4], [-4.8, 12.2], [12.8, 12.4], [-16.8, 2.2],
            [9.4, -14.2], [-12.2, -14.8]
        ];
        for (let i = 0; i < TOTAL_BERRIES; i++) {
            const [x, z] = spots[i] || [
                Math.cos(i * 2.3) * (8 + i),
                Math.sin(i * 2.3) * (8 + i)
            ];
            const b = createBerry({ light: i < 5 && this.quality.shadows });
            b.position.set(x, heightAt(x, z) + 0.35, z);
            b.userData.taken = false;
            b.userData.phase = hash(i + 50) * 6;
            this.root.add(b);
            this.berries.push(b);
        }
    }

    _friends() {
        this.friends = FRIENDS.map((def) => {
            const f = createFriend(def);
            f.mesh.position.set(def.x, heightAt(def.x, def.z), def.z);
            this.root.add(f.mesh);
            return f;
        });
    }

    _butterflies(n) {
        this.butterflies = [];
        const colors = [0xff7ab0, 0xffe066, 0xc9a0ff, 0x7ad0ff];
        for (let i = 0; i < n; i++) {
            const b = createButterfly(colors[i % 4]);
            b.userData.a = hash(i + 80) * Math.PI * 2;
            b.userData.r = 4 + hash(i + 90) * 16;
            b.userData.y = 1.2 + hash(i + 70) * 2.2;
            b.userData.s = 0.6 + hash(i) * 0.8;
            this.root.add(b);
            this.butterflies.push(b);
        }
    }

    _homeRing() {
        const ring = mesh(geo.torus, toon(0xffe066, {
            emissive: 0xffb347,
            em: 0.65,
            transparent: true,
            opacity: 0.0
        }), {
            scale: [2.8, 0.8, 2.8],
            pos: [HOME.x, 0.2, HOME.z],
            rot: [Math.PI / 2, 0, 0],
            cast: false,
            receive: false
        });
        this.root.add(ring);
        return ring;
    }

    reset() {
        for (const b of this.berries) {
            b.visible = true;
            b.userData.taken = false;
        }
        for (const f of this.friends) {
            f.state = 'lost';
            f.mesh.position.set(f.x, heightAt(f.x, f.z), f.z);
            f.mesh.visible = true;
            f.homeSlot = 0;
        }
    }

    update(dt, party, followers) {
        this.clock += dt;
        const t = this.clock;
        if (this.water?.material.uniforms) {
            this.water.material.uniforms.uTime.value = t;
        }
        for (const c of this.clouds) {
            c.position.x += dt * 0.35;
            if (c.position.x > WORLD_RADIUS) c.position.x = -WORLD_RADIUS;
            c.position.y += Math.sin(t * 0.3 + c.position.z) * 0.002;
        }
        for (const b of this.berries) {
            if (b.userData.taken) continue;
            b.rotation.y += dt * 1.6;
            b.position.y = heightAt(b.position.x, b.position.z) + 0.38 + Math.sin(t * 2.4 + b.userData.phase) * 0.08;
        }
        for (const bf of this.butterflies) {
            bf.userData.a += dt * bf.userData.s;
            const x = Math.cos(bf.userData.a) * bf.userData.r;
            const z = Math.sin(bf.userData.a * 0.85) * bf.userData.r * 0.7;
            bf.position.set(x, heightAt(x, z) + bf.userData.y + Math.sin(t * 2 + bf.userData.a) * 0.25, z);
            bf.lookAt(x + 1, bf.position.y, z);
            const flap = Math.sin(t * 16 + bf.userData.a) * 0.7;
            if (bf.userData.wings) {
                bf.userData.wings[0].rotation.z = flap;
                bf.userData.wings[1].rotation.z = -flap;
            }
        }
        if (this.rainbow) {
            this.rainbow.rotation.y = 0.55 + Math.sin(t * 0.15) * 0.05;
            this.rainbow.visible = true;
        }
        const glow = followers > 0 ? 0.55 + Math.sin(t * 4) * 0.2 : 0;
        this.homeRing.material.opacity = THREE.MathUtils.damp(this.homeRing.material.opacity, glow, 6, dt);
        this.homeRing.position.y = heightAt(HOME.x, HOME.z) + 0.18;
        this.homeRing.rotation.z += dt * 0.4;

        this.sky.userData.mat.uniforms.uParty.value = party;
    }
}
