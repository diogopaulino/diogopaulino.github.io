/**
 * A ilha flutuante: gramado, falésias, lagoa, aldeia, bosque e o castelo.
 * Tudo é composto a partir dos modelos toon — nenhum asset externo.
 */

import * as THREE from 'three';
import {
    MAT, geo, mesh,
    createCastle, createCottage, createTree, createCloud,
    createLantern, createWish, createCarousel, createWell,
    createBridge, createFlowerPatch, createRainbow, toon
} from './models.js';
import { createSky } from './sky.js';

const waterVert = /* glsl */ `
uniform float uTime;
varying vec3 vWorld;
varying vec3 vNormal;
void main() {
    vec3 p = position;
    p.y += sin(p.x * 0.45 + uTime * 1.4) * 0.08 + cos(p.z * 0.55 + uTime * 1.1) * 0.06;
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
    float bands = floor((vWorld.x * 0.12 + vWorld.z * 0.1 + sin(vWorld.x * 0.4 + uTime) * 0.08) * 5.0) / 5.0;
    vec3 col = mix(uDeep, uShallow, bands * 0.5 + 0.35);
    col = mix(col, uSky, fres * 0.45);
    float spark = step(0.96, fract(sin(dot(vWorld.xz * 0.7, vec2(12.9898, 78.233)) + uTime) * 43758.5453));
    col += vec3(1.0, 0.95, 0.8) * spark * 0.55;
    gl_FragColor = vec4(col, 0.88);
}`;

function createWater(radius) {
    const geometry = new THREE.CircleGeometry(radius, 64);
    geometry.rotateX(-Math.PI / 2);
    const material = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uDeep: { value: new THREE.Color('#1f7f8a') },
            uShallow: { value: new THREE.Color('#7ee8e0') },
            uSky: { value: new THREE.Color('#ffc4a8') }
        },
        vertexShader: waterVert,
        fragmentShader: waterFrag,
        transparent: true
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    return mesh;
}

function hash(i) {
    const n = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    return n - Math.floor(n);
}

export class Kingdom {
    constructor(scene, quality) {
        this.scene = scene;
        this.quality = quality;
        this.clock = 0;
        this.wishes = [];
        this.clouds = [];
        this.lanterns = [];
        this.flags = [];
        this.hanging = [];
        this.root = new THREE.Group();
        this.root.name = 'kingdom';
        scene.add(this.root);

        this.sky = createSky();
        scene.add(this.sky);

        this._island();
        this._castle();
        this._village();
        this._nature();
        this._props();
        this._wishes();
        this._clouds();
        this._fog(scene);
    }

    _island() {
        const island = new THREE.Group();
        island.add(mesh(geo.cyl, MAT.grass, { scale: [36, 1.2, 36], pos: [0, -0.4, 0], receive: true }));
        island.add(mesh(geo.cyl, MAT.dirt, { scale: [35.4, 7.5, 35.4], pos: [0, -4.4, 0] }));
        island.add(mesh(geo.sphere, MAT.dirt, { scale: [34, 8, 34], pos: [0, -8.2, 0], receive: true }));
        island.add(mesh(geo.cyl, MAT.rock, { scale: [18, 0.5, 18], pos: [0, 0.12, 8], receive: true }));

        this.water = createWater(11.5);
        this.water.position.set(0, 0.22, 10.5);
        island.add(this.water);

        // queda d'água na borda sul
        const fall = mesh(geo.box, toon(0x7ee8e0, { transparent: true, opacity: 0.45, emissive: 0x4ecdc4, em: 0.2 }), {
            scale: [2.4, 9, 0.35],
            pos: [0, -4.2, 34.5],
            cast: false
        });
        island.add(fall);
        this.waterfall = fall;

        const islet = mesh(geo.cyl, MAT.grass, { scale: [5.5, 1.0, 5.5], pos: [22, -0.2, 16], receive: true });
        island.add(islet);
        island.add(mesh(geo.cyl, MAT.dirt, { scale: [5.1, 3.2, 5.1], pos: [22, -2.0, 16] }));

        const bridge = createBridge();
        bridge.position.set(14.5, 0.05, 13.5);
        bridge.rotation.y = -0.55;
        island.add(bridge);

        this.root.add(island);
        this.island = island;
    }

    _castle() {
        this.castle = createCastle();
        this.castle.position.set(0, 0.2, -12);
        this.castle.scale.setScalar(1.15);
        this.root.add(this.castle);
        this.castle.traverse((obj) => {
            if (obj.userData?.flag) this.flags.push(obj.userData.flag);
        });
    }

    _village() {
        const spots = [
            [-12, 8, 0.9, MAT.roofPink],
            [-16, 4, 1.05, MAT.roofTeal],
            [-10, 13, 0.8, MAT.roofBlue],
            [12, 6, 1.0, MAT.roofPink],
            [16, 2, 0.85, MAT.roofBlue]
        ];
        for (const [x, z, s, roof] of spots) {
            const c = createCottage({ roof });
            c.position.set(x, 0.05, z);
            c.scale.setScalar(s);
            c.rotation.y = hash(x + z) * Math.PI * 2;
            this.root.add(c);
        }

        this.carousel = createCarousel();
        this.carousel.position.set(-8, 0.05, 18);
        this.root.add(this.carousel);

        this.well = createWell();
        this.well.position.set(7.5, 0.05, 4.5);
        this.root.add(this.well);
    }

    _nature() {
        const trees = [
            [-22, -6, 1.3, 'round'], [-18, -14, 1.1, 'pine'], [-24, 8, 1.4, 'lime'],
            [-20, 16, 0.95, 'round'], [20, -10, 1.2, 'pine'], [24, -4, 1.0, 'round'],
            [18, 18, 1.35, 'lime'], [26, 10, 0.9, 'pine'], [-6, -24, 1.5, 'round'],
            [8, -22, 1.1, 'pine'], [-14, -20, 1.2, 'lime'], [22, 16, 0.85, 'round'],
            [10, 22, 1.0, 'pine'], [-26, -2, 1.15, 'round']
        ];
        for (const [x, z, s, kind] of trees) {
            const t = createTree({ kind, scale: s });
            t.position.set(x, 0, z);
            this.root.add(t);
        }

        const giant = createTree({ kind: 'round', scale: 2.4 });
        giant.position.set(-18, 0, -8);
        this.root.add(giant);

        for (const [x, z] of [[-6, 16], [10, 14], [4, 20], [-14, 12], [18, -16]]) {
            const p = createFlowerPatch();
            p.position.set(x, 0.05, z);
            this.root.add(p);
        }

        const rainbow = createRainbow();
        rainbow.position.set(-6, 8, -4);
        this.root.add(rainbow);

        const hangingCount = this.quality.lanterns;
        for (let i = 0; i < hangingCount; i++) {
            const lantern = createLantern([0xffb347, 0xff6fae, 0xffe066, 0x9ad8ff][i % 4]);
            const a = (i / hangingCount) * Math.PI * 2;
            const r = 10 + hash(i) * 16;
            lantern.position.set(Math.cos(a) * r, 2.4 + hash(i + 3) * 3.5, Math.sin(a) * r - 4);
            lantern.scale.setScalar(0.85);
            this.root.add(lantern);
            this.hanging.push(lantern);
        }
    }

    _props() {
        // pedras e arbustos na beira da lagoa
        for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2;
            const r = 12.4;
            this.root.add(mesh(geo.sphere, MAT.rock, {
                scale: [0.5 + hash(i) * 0.4, 0.32, 0.5 + hash(i + 1) * 0.3],
                pos: [Math.cos(a) * r, 0.2, Math.sin(a) * r + 10.5]
            }));
        }
    }

    _wishes() {
        const spots = [
            { pos: [0, 3.2, 10.5], label: 'a lagoa de cristal' },
            { pos: [-8, 2.6, 18], label: 'o carrossel' },
            { pos: [7.5, 2.8, 4.5], label: 'o poço dos desejos' },
            { pos: [22, 3.0, 16], label: 'o ilhéu' },
            { pos: [-18, 5.2, -8], label: 'a árvore gigante' },
            { pos: [0, 3.4, -5.5], label: 'o pátio do castelo' },
            { pos: [18, 3.4, -16], label: 'o bosque leste' },
            { pos: [-22, 3.6, 8], label: 'o jardim oeste' }
        ];
        for (const spot of spots) {
            const wish = createWish();
            wish.position.set(...spot.pos);
            wish.userData.label = spot.label;
            wish.userData.base = wish.position.clone();
            wish.userData.taken = false;
            this.root.add(wish);
            this.wishes.push(wish);
        }
    }

    _clouds() {
        const count = this.quality.clouds;
        for (let i = 0; i < count; i++) {
            const tint = i % 3 === 0 ? 'pink' : i % 3 === 1 ? 'peach' : 'white';
            const cloud = createCloud({ tint, scale: 1.4 + hash(i) * 2.2 });
            const a = hash(i + 9) * Math.PI * 2;
            const r = 28 + hash(i + 2) * 70;
            cloud.position.set(
                Math.cos(a) * r,
                -6 + hash(i + 4) * 22,
                Math.sin(a) * r
            );
            this.scene.add(cloud);
            this.clouds.push(cloud);
        }
    }

    _fog(scene) {
        scene.fog = new THREE.FogExp2(0xc48aaa, 0.0048);
        scene.background = new THREE.Color('#c46aa8');
    }

    groundHeight(x, z) {
        const r = Math.hypot(x, z);
        if (r < 36.5) return 0.2;
        if (Math.hypot(x - 22, z - 16) < 6) return 0.2;
        return -8;
    }

    inBounds(x, z) {
        return Math.hypot(x, z) < 48 || Math.hypot(x - 22, z - 16) < 10;
    }

    update(dt, night) {
        this.clock += dt;
        const t = this.clock;
        if (this.water?.material.uniforms) {
            this.water.material.uniforms.uTime.value = t;
        }
        if (this.waterfall) {
            this.waterfall.material.opacity = 0.35 + Math.sin(t * 4) * 0.08;
        }
        if (this.carousel?.userData.spin) {
            this.carousel.userData.spin.rotation.y += dt * 0.7;
            this.carousel.userData.spin.children.forEach((h, i) => {
                h.position.y = Math.sin(t * 2.2 + i) * 0.18;
            });
        }
        for (const flag of this.flags) {
            flag.rotation.y = Math.sin(t * 2.4 + flag.id) * 0.35;
        }
        for (const cloud of this.clouds) {
            cloud.position.x += Math.sin(t * 0.12 + cloud.userData.bob) * 0.01;
            cloud.position.y += Math.cos(t * 0.18 + cloud.userData.bob) * 0.008;
        }
        for (const wish of this.wishes) {
            if (wish.userData.taken) continue;
            const b = wish.userData.base;
            wish.position.y = b.y + Math.sin(t * 1.6 + b.x) * 0.28;
            wish.userData.core.rotation.y += dt * 1.4;
            wish.userData.core.rotation.z = Math.sin(t * 2) * 0.2;
            const s = 1 + Math.sin(t * 3 + b.z) * 0.08;
            wish.userData.halo.scale.setScalar(0.85 * s);
        }
        for (const lantern of this.hanging) {
            lantern.position.y += Math.sin(t * 1.8 + lantern.id) * 0.002;
            if (lantern.userData.flame) {
                const s = 0.9 + Math.sin(t * 8 + lantern.id) * 0.15;
                lantern.userData.flame.scale.set(s, s * 1.2, s);
            }
        }
        this.sky.userData.mat.uniforms.uNight.value = night;
        this.sky.userData.stars.material.opacity = 0.12 + night * 0.75;
        if (this.scene.fog) {
            this.scene.fog.color.setHSL(0.92 - night * 0.08, 0.35, 0.72 - night * 0.28);
        }
    }
}
