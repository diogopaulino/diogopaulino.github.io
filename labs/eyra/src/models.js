/**
 * Modelos nativos: a ira (fera alada), a Yva (árvore-mãe), picos,
 * helicoidais e o piloto. Sem GLTF — só geometria Three.js.
 */

import * as THREE from 'three';
import {
    rockTexture, mossTexture, barkTexture, leafTexture, wingTexture, glowSprite
} from './textures.js';
import { applyRockMoss, applyLeafSway, waterfallMaterial } from './shaders.js';

const geo = {
    sphere: new THREE.SphereGeometry(1, 22, 16),
    sphereLo: new THREE.SphereGeometry(1, 12, 10),
    sphereHi: new THREE.SphereGeometry(1, 28, 20),
    box: new THREE.BoxGeometry(1, 1, 1),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 12),
    cylLo: new THREE.CylinderGeometry(1, 1, 1, 8),
    cone: new THREE.ConeGeometry(1, 1, 12),
    coneLo: new THREE.ConeGeometry(1, 1, 8),
    torus: new THREE.TorusGeometry(1, 0.18, 10, 28),
    plane: new THREE.PlaneGeometry(1, 1, 1, 1),
    icosa: new THREE.IcosahedronGeometry(1, 1)
};

export function std(color, {
    map = null,
    roughness = 0.72,
    metalness = 0.04,
    emissive = 0x000000,
    em = 0,
    transparent = false,
    opacity = 1,
    side = THREE.FrontSide,
    flat = false
} = {}) {
    return new THREE.MeshStandardMaterial({
        color,
        map,
        roughness,
        metalness,
        emissive,
        emissiveIntensity: em,
        transparent,
        opacity,
        side,
        flatShading: flat
    });
}

function mesh(geometry, material, { pos, scale, rot, cast = true, receive = true } = {}) {
    const m = new THREE.Mesh(geometry, material);
    if (pos) m.position.set(...pos);
    if (scale) m.scale.set(...scale);
    if (rot) m.rotation.set(...rot);
    m.castShadow = cast;
    m.receiveShadow = receive;
    return m;
}

let MAT = null;

export function materials() {
    if (MAT) return MAT;
    const rock = applyRockMoss(std(0x7a8a7e, { map: rockTexture(), roughness: 0.88, flat: true }));
    const moss = std(0x2a8a48, { map: mossTexture(), roughness: 0.92 });
    const bark = std(0x5a3a28, { map: barkTexture(), roughness: 0.9 });
    const leaf = applyLeafSway(std(0x1f9a4a, { map: leafTexture(), roughness: 0.7, side: THREE.DoubleSide }));
    const leafDark = applyLeafSway(std(0x0e6a38, { map: leafTexture(), roughness: 0.75, side: THREE.DoubleSide }));
    const wing = std(0x1a4a58, {
        map: wingTexture(),
        roughness: 0.45,
        metalness: 0.08,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.92
    });
    MAT = {
        rock, moss, bark, leaf, leafDark, wing,
        skin: std(0x1c3a48, { roughness: 0.42, metalness: 0.12 }),
        belly: std(0x2a6a68, { roughness: 0.5, emissive: 0x0a3a38, em: 0.15 }),
        stripe: std(0x5ef0d8, { roughness: 0.3, emissive: 0x2ad4c0, em: 0.85 }),
        eye: std(0xffe08a, { roughness: 0.15, emissive: 0xffc040, em: 1.4 }),
        rider: std(0x3a8a9a, { roughness: 0.55 }),
        cloth: std(0x6a3a28, { roughness: 0.8 }),
        gold: std(0xe8c060, { roughness: 0.35, metalness: 0.4, emissive: 0xa08030, em: 0.2 }),
        seed: std(0x7af0d8, { roughness: 0.2, emissive: 0x3ae0c0, em: 1.2 }),
        magenta: std(0xd46ad0, { roughness: 0.4, emissive: 0xa040a0, em: 0.7 }),
        water: std(0x1a8aaa, { roughness: 0.12, metalness: 0.35, transparent: true, opacity: 0.78 }),
        cloud: std(0xf4f0e8, { roughness: 1, transparent: true, opacity: 0.55 }),
        vine: std(0x1a6a38, { roughness: 0.85 })
    };
    return MAT;
}

export function createIra() {
    const m = materials();
    const g = new THREE.Group();
    g.name = 'ira';

    const body = mesh(geo.sphereHi, m.skin, { scale: [1.15, 0.85, 2.4] });
    const belly = mesh(geo.sphere, m.belly, { scale: [0.85, 0.55, 1.9], pos: [0, -0.28, 0.1] });
    g.add(body, belly);

    for (let i = 0; i < 5; i++) {
        const z = -1.6 + i * 0.7;
        g.add(mesh(geo.box, m.stripe, {
            scale: [1.7, 0.06, 0.12],
            pos: [0, 0.15, z],
            cast: false
        }));
    }

    const neck = new THREE.Group();
    neck.position.set(0, 0.15, 1.9);
    for (let i = 0; i < 5; i++) {
        const s = 0.38 - i * 0.04;
        neck.add(mesh(geo.sphere, m.skin, {
            scale: [s, s * 0.85, s * 1.15],
            pos: [0, i * 0.12, i * 0.38]
        }));
    }
    g.add(neck);

    const head = new THREE.Group();
    head.position.set(0, 0.62, 3.85);
    head.add(mesh(geo.sphereHi, m.skin, { scale: [0.42, 0.32, 0.72] }));
    head.add(mesh(geo.cone, m.skin, { scale: [0.18, 0.7, 0.22], pos: [0, -0.05, 0.72], rot: [Math.PI / 2, 0, 0] }));
    head.add(mesh(geo.sphere, m.eye, { scale: [0.09, 0.09, 0.09], pos: [0.22, 0.08, 0.28], cast: false }));
    head.add(mesh(geo.sphere, m.eye, { scale: [0.09, 0.09, 0.09], pos: [-0.22, 0.08, 0.28], cast: false }));
    const crest = mesh(geo.cone, m.stripe, { scale: [0.08, 0.55, 0.18], pos: [0, 0.38, -0.1], rot: [0.4, 0, 0] });
    head.add(crest);
    for (let i = 0; i < 4; i++) {
        const a = (i - 1.5) * 0.18;
        head.add(mesh(geo.cylLo, m.stripe, {
            scale: [0.025, 0.55, 0.025],
            pos: [a, 0.42, -0.15 - i * 0.04],
            rot: [0.5, 0, a]
        }));
    }
    g.add(head);

    const makeWing = (side) => {
        const wing = new THREE.Group();
        const bone = mesh(geo.cyl, m.skin, {
            scale: [0.07, 3.6, 0.07],
            pos: [side * 2.0, 0.2, 0.2],
            rot: [0, 0, side * -1.05]
        });
        const membrane = mesh(
            new THREE.PlaneGeometry(4.4, 2.6, 6, 4),
            m.wing,
            {
                pos: [side * 2.5, -0.15, -0.15],
                rot: [0.15, 0, side * -0.15],
                scale: [side, 1, 1],
                cast: false
            }
        );
        const tip = mesh(geo.cone, m.skin, {
            scale: [0.12, 0.7, 0.18],
            pos: [side * 4.15, 0.55, 0.05],
            rot: [0, 0, side * -1.2]
        });
        wing.add(bone, membrane, tip);
        wing.userData.side = side;
        return wing;
    };
    const left = makeWing(1);
    const right = makeWing(-1);
    g.add(left, right);

    const tail = new THREE.Group();
    tail.position.set(0, 0.1, -2.2);
    for (let i = 0; i < 7; i++) {
        const s = 0.32 - i * 0.035;
        tail.add(mesh(geo.sphereLo, m.skin, {
            scale: [s * 0.7, s * 0.55, s * 1.3],
            pos: [0, -i * 0.04, -i * 0.48]
        }));
    }
    const fin = mesh(new THREE.PlaneGeometry(1.6, 0.9), m.wing, {
        pos: [0, 0.05, -3.4],
        rot: [0.2, 0, 0],
        cast: false
    });
    tail.add(fin);
    g.add(tail);

    const rider = createRider();
    rider.position.set(0, 0.95, 0.85);
    rider.rotation.x = 0.15;
    g.add(rider);

    const glow = new THREE.PointLight(0x5ef0d8, 1.4, 18, 2);
    glow.position.set(0, 0.2, 0.4);
    g.add(glow);

    g.userData = { left, right, tail, head, neck, glow, rider };
    g.scale.setScalar(1.15);
    return g;
}

function createRider() {
    const m = materials();
    const g = new THREE.Group();
    g.add(mesh(geo.sphere, m.rider, { scale: [0.16, 0.22, 0.14], pos: [0, 0.28, 0] }));
    g.add(mesh(geo.sphere, m.rider, { scale: [0.12, 0.12, 0.12], pos: [0, 0.52, 0.02] }));
    g.add(mesh(geo.cylLo, m.cloth, { scale: [0.13, 0.28, 0.13], pos: [0, 0.12, 0] }));
    g.add(mesh(geo.cylLo, m.rider, { scale: [0.04, 0.22, 0.04], pos: [0.12, 0.22, 0.05], rot: [0.6, 0, -0.4] }));
    g.add(mesh(geo.cylLo, m.rider, { scale: [0.04, 0.22, 0.04], pos: [-0.12, 0.22, 0.05], rot: [0.6, 0, 0.4] }));
    const braid = mesh(geo.cylLo, m.gold, {
        scale: [0.018, 0.55, 0.018],
        pos: [0, 0.28, -0.18],
        rot: [0.9, 0, 0]
    });
    g.add(braid);
    return g;
}

export function createYva() {
    const m = materials();
    const g = new THREE.Group();
    g.name = 'yva';
    g.add(mesh(geo.cyl, m.bark, { scale: [2.8, 22, 2.8], pos: [0, 11, 0] }));
    g.add(mesh(geo.sphereHi, m.bark, { scale: [3.4, 4.2, 3.4], pos: [0, 2.2, 0] }));
    for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        g.add(mesh(geo.cylLo, m.bark, {
            scale: [0.55, 8, 0.55],
            pos: [Math.cos(a) * 4.5, 18, Math.sin(a) * 4.5],
            rot: [0.7, a, 0]
        }));
        g.add(mesh(geo.sphere, m.leaf, {
            scale: [4.2, 2.4, 4.2],
            pos: [Math.cos(a) * 7.5, 22, Math.sin(a) * 7.5]
        }));
    }
    g.add(mesh(geo.sphereHi, m.leafDark, { scale: [10, 5.5, 10], pos: [0, 24, 0] }));
    g.add(mesh(geo.sphere, m.leaf, { scale: [7.5, 4, 7.5], pos: [0, 27, 0] }));
    const heart = mesh(geo.icosa, m.seed, { scale: [1.4, 1.8, 1.4], pos: [0, 14, 0], cast: false });
    const light = new THREE.PointLight(0x7af0d8, 3.2, 48, 1.6);
    light.position.set(0, 14, 0);
    g.add(heart, light);
    g.userData.heart = heart;
    return g;
}

export function createSpiralPlant(rng = Math.random) {
    const m = materials();
    const g = new THREE.Group();
    const h = 2.2 + rng() * 2.4;
    const turns = 4 + Math.floor(rng() * 3);
    const pts = [];
    for (let i = 0; i <= 28; i++) {
        const t = i / 28;
        const a = t * turns * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * t * 0.55, t * h, Math.sin(a) * t * 0.55));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = new THREE.TubeGeometry(curve, 40, 0.045, 5, false);
    const stem = new THREE.Mesh(tube, m.magenta);
    stem.castShadow = true;
    g.add(stem);
    const cup = mesh(geo.sphere, m.magenta, { scale: [0.42, 0.22, 0.42], pos: [pts[28].x, pts[28].y, pts[28].z] });
    g.add(cup);
    return g;
}

export function createCanopyTree(rng = Math.random) {
    const m = materials();
    const g = new THREE.Group();
    const h = 8 + rng() * 10;
    const r = 0.35 + rng() * 0.35;
    g.add(mesh(geo.cylLo, m.bark, { scale: [r, h, r], pos: [0, h * 0.5, 0] }));
    const layers = 2 + Math.floor(rng() * 2);
    for (let i = 0; i < layers; i++) {
        const s = 3.2 - i * 0.55 + rng() * 0.6;
        g.add(mesh(geo.sphereLo, i % 2 ? m.leaf : m.leafDark, {
            scale: [s, s * 0.55, s],
            pos: [(rng() - 0.5) * 0.8, h - 0.4 - i * 1.5, (rng() - 0.5) * 0.8]
        }));
    }
    return g;
}

export function createPeakTree(rng = Math.random) {
    const m = materials();
    const g = new THREE.Group();
    const h = 2.4 + rng() * 2.2;
    g.add(mesh(geo.cylLo, m.bark, { scale: [0.12, h, 0.12], pos: [0, h * 0.5, 0] }));
    g.add(mesh(geo.coneLo, m.leaf, { scale: [1.1, 2.2, 1.1], pos: [0, h + 0.4, 0] }));
    g.add(mesh(geo.coneLo, m.leafDark, { scale: [0.75, 1.4, 0.75], pos: [0, h + 1.1, 0] }));
    return g;
}

export function createMountain(rng, size = 1) {
    const m = materials();
    const g = new THREE.Group();
    const h = 18 * size;
    const r = 8 * size;
    const rock = mesh(geo.cone, m.rock, { scale: [r, h, r * 0.92], pos: [0, h * 0.15, 0], rot: [0, rng() * 6, 0.08] });
    const cap = mesh(geo.sphere, m.moss, { scale: [r * 0.92, r * 0.38, r * 0.92], pos: [0, h * 0.52, 0] });
    const hang = mesh(geo.cone, m.rock, {
        scale: [r * 0.72, h * 0.85, r * 0.68],
        pos: [0, -h * 0.28, 0],
        rot: [Math.PI, rng() * 2, 0.12]
    });
    g.add(rock, cap, hang);
    const nVines = 3 + Math.floor(rng() * 4);
    for (let i = 0; i < nVines; i++) {
        const a = rng() * Math.PI * 2;
        const vr = r * (0.4 + rng() * 0.4);
        g.add(mesh(geo.cylLo, m.vine, {
            scale: [0.06, 6 + rng() * 8, 0.06],
            pos: [Math.cos(a) * vr, -2 - rng() * 4, Math.sin(a) * vr]
        }));
    }
    g.userData.radius = r;
    g.userData.height = h;
    return g;
}

export function createWaterfall(height = 22, width = 2.4) {
    const m = materials();
    const mat = waterfallMaterial();
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, height, 1, 12), mat);
    plane.position.y = -height * 0.35;
    plane.castShadow = false;
    plane.receiveShadow = false;
    const splash = mesh(geo.sphereLo, std(0xd8f8fc, { transparent: true, opacity: 0.35, roughness: 0.2 }), {
        scale: [width * 0.7, 0.4, width * 0.7],
        pos: [0, -height * 0.7, 0],
        cast: false
    });
    const g = new THREE.Group();
    g.add(plane, splash);
    return g;
}

export function createSeed() {
    const m = materials();
    const g = new THREE.Group();
    const core = mesh(geo.icosa, m.seed, { scale: [0.55, 0.7, 0.55], cast: false });
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowSprite('#7af0d8'),
        color: 0xffffff,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    }));
    halo.scale.set(3.2, 3.2, 1);
    const light = new THREE.PointLight(0x7af0d8, 1.6, 16, 2);
    g.add(core, halo, light);
    g.userData.core = core;
    return g;
}

export function createRing() {
    const m = materials();
    const ring = mesh(geo.torus, m.stripe, { scale: [2.6, 2.6, 2.6], rot: [Math.PI / 2, 0, 0], cast: false });
    ring.material = std(0x7af0d8, {
        roughness: 0.25,
        emissive: 0x3ae0c8,
        em: 0.95,
        transparent: true,
        opacity: 0.85
    });
    const g = new THREE.Group();
    g.add(ring);
    const glow = new THREE.PointLight(0x5ef0d8, 1.1, 12, 2);
    g.add(glow);
    return g;
}

export function createCloud(rng = Math.random) {
    const m = materials();
    const g = new THREE.Group();
    const n = 3 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
        g.add(mesh(geo.sphereLo, m.cloud, {
            scale: [4 + rng() * 5, 1.6 + rng() * 1.4, 3.5 + rng() * 4],
            pos: [(rng() - 0.5) * 6, (rng() - 0.5) * 1.2, (rng() - 0.5) * 5],
            cast: false,
            receive: false
        }));
    }
    return g;
}

export { geo, mesh };
