/**
 * Modelos low-poly do santuário: arraia, baleia, medusa, coral e pedra.
 * Tudo em geometria nativa — sem glTF.
 */

import * as THREE from 'three';

const geo = {
    sphere: new THREE.SphereGeometry(1, 20, 14),
    sphereLo: new THREE.SphereGeometry(1, 12, 10),
    sphereHi: new THREE.SphereGeometry(1, 28, 20),
    cone: new THREE.ConeGeometry(1, 1, 12),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 10),
    cylTaper: new THREE.CylinderGeometry(0.35, 1, 1, 10),
    plane: new THREE.PlaneGeometry(1, 1),
    icosa: new THREE.IcosahedronGeometry(1, 1),
    torus: new THREE.TorusGeometry(1, 0.22, 8, 18)
};

function std(color, extra = {}) {
    return new THREE.MeshStandardMaterial({
        color,
        roughness: 0.62,
        metalness: 0.04,
        ...extra
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

export function createManta() {
    const g = new THREE.Group();
    const skin = std(0x1b4d62, { emissive: 0x0a2a38, emissiveIntensity: 0.35, roughness: 0.48 });
    const glow = std(0x5ee7ff, { emissive: 0x5ee7ff, emissiveIntensity: 1.35, roughness: 0.25 });
    const belly = std(0xc8e8e4, { roughness: 0.7 });
    const ink = std(0x081018);

    const body = mesh(geo.sphereHi, skin, { scale: [1.55, 0.22, 0.95] });
    g.add(body);
    g.add(mesh(geo.sphere, belly, { pos: [0, -0.08, 0.05], scale: [1.25, 0.12, 0.72], cast: false }));

    const wingL = new THREE.Group();
    wingL.add(mesh(geo.sphere, skin, { pos: [-1.15, 0, 0.05], scale: [1.35, 0.07, 0.72], rot: [0, 0.15, -0.08] }));
    wingL.add(mesh(geo.sphere, glow, { pos: [-1.05, 0.02, 0.08], scale: [1.05, 0.03, 0.08], cast: false }));
    const wingR = new THREE.Group();
    wingR.add(mesh(geo.sphere, skin, { pos: [1.15, 0, 0.05], scale: [1.35, 0.07, 0.72], rot: [0, -0.15, 0.08] }));
    wingR.add(mesh(geo.sphere, glow, { pos: [1.05, 0.02, 0.08], scale: [1.05, 0.03, 0.08], cast: false }));
    g.add(wingL, wingR);

    const cephalic = mesh(geo.cone, skin, { pos: [0, 0.02, 0.95], scale: [0.18, 0.55, 0.18], rot: [1.2, 0, 0] });
    g.add(cephalic);
    g.add(mesh(geo.sphere, ink, { pos: [-0.18, 0.12, 0.55], scale: [0.07, 0.07, 0.07], cast: false }));
    g.add(mesh(geo.sphere, ink, { pos: [0.18, 0.12, 0.55], scale: [0.07, 0.07, 0.07], cast: false }));

    const tail = new THREE.Group();
    tail.add(mesh(geo.cone, skin, { pos: [0, 0, -1.35], scale: [0.08, 1.5, 0.08], rot: [1.57, 0, 0] }));
    tail.add(mesh(geo.sphere, glow, { pos: [0, 0, -2.05], scale: [0.07, 0.07, 0.07], cast: false }));
    g.add(tail);

    const light = new THREE.PointLight(0x7af0ff, 1.4, 11, 1.6);
    light.position.set(0, 0.2, 0.2);
    g.add(light);

    g.userData.wingL = wingL;
    g.userData.wingR = wingR;
    g.userData.tail = tail;
    g.userData.glow = glow;
    g.rotation.y = Math.PI;
    return g;
}

export function createWhale() {
    const g = new THREE.Group();
    const skin = std(0x163044, { roughness: 0.55, emissive: 0x0a2030, emissiveIntensity: 0.4 });
    const belly = std(0x8fb8c4, { roughness: 0.7 });
    const glow = std(0x66f0ff, { emissive: 0x66f0ff, emissiveIntensity: 1.1, roughness: 0.3 });
    const eye = std(0x081018);

    g.add(mesh(geo.sphereHi, skin, { scale: [7.4, 2.15, 2.45] }));
    g.add(mesh(geo.sphere, belly, { pos: [0.4, -0.85, 0], scale: [5.6, 1.15, 1.7], cast: false }));
    g.add(mesh(geo.sphereHi, skin, { pos: [6.1, 0.15, 0], scale: [3.4, 1.85, 2.05] }));
    g.add(mesh(geo.sphere, eye, { pos: [7.6, 0.55, 1.15], scale: [0.18, 0.18, 0.18], cast: false }));
    g.add(mesh(geo.sphere, eye, { pos: [7.6, 0.55, -1.15], scale: [0.18, 0.18, 0.18], cast: false }));

    for (let i = 0; i < 6; i++) {
        const x = -2.4 + i * 1.55;
        g.add(mesh(geo.sphere, glow, { pos: [x, 0.35, 2.15], scale: [1.15, 0.07, 0.07], cast: false }));
        g.add(mesh(geo.sphere, glow, { pos: [x, 0.35, -2.15], scale: [1.15, 0.07, 0.07], cast: false }));
    }

    const pecL = mesh(geo.sphere, skin, { pos: [1.6, -0.4, 2.5], scale: [2.1, 0.16, 1.15], rot: [0.15, 0.45, 0.2] });
    const pecR = mesh(geo.sphere, skin, { pos: [1.6, -0.4, -2.5], scale: [2.1, 0.16, 1.15], rot: [-0.15, -0.45, -0.2] });
    g.add(pecL, pecR);

    const tail = new THREE.Group();
    tail.position.set(-7.2, 0.15, 0);
    tail.add(mesh(geo.cylTaper, skin, { scale: [0.9, 4.2, 0.7], rot: [0, 0, 1.57], pos: [-1.6, 0, 0] }));
    const flukeL = mesh(geo.sphere, skin, { pos: [-4.3, 0.05, 1.55], scale: [2.4, 0.14, 1.55], rot: [0, 0.55, 0] });
    const flukeR = mesh(geo.sphere, skin, { pos: [-4.3, 0.05, -1.55], scale: [2.4, 0.14, 1.55], rot: [0, -0.55, 0] });
    tail.add(flukeL, flukeR);
    tail.add(mesh(geo.sphere, glow, { pos: [-4.1, 0.12, 0], scale: [0.9, 0.06, 0.06], cast: false }));
    g.add(tail);

    g.userData.tail = tail;
    g.userData.pecL = pecL;
    g.userData.pecR = pecR;
    g.userData.glow = glow;
    return g;
}

export function createJelly(tint = 0x88f0ff) {
    const g = new THREE.Group();
    const bellMat = std(tint, {
        emissive: tint,
        emissiveIntensity: 0.85,
        transparent: true,
        opacity: 0.55,
        roughness: 0.22,
        depthWrite: false
    });
    const tentMat = std(tint, {
        emissive: tint,
        emissiveIntensity: 0.7,
        transparent: true,
        opacity: 0.45,
        roughness: 0.4,
        depthWrite: false
    });
    const bell = mesh(geo.sphere, bellMat, { scale: [1, 0.58, 1], cast: false, receive: false });
    g.add(bell);
    const tentacles = [];
    for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const t = mesh(geo.cyl, tentMat, {
            pos: [Math.cos(a) * 0.42, -1.15, Math.sin(a) * 0.42],
            scale: [0.035, 2.1, 0.035],
            cast: false,
            receive: false
        });
        g.add(t);
        tentacles.push(t);
    }
    g.userData.bell = bell;
    g.userData.tentacles = tentacles;
    g.userData.phase = Math.random() * Math.PI * 2;
    return g;
}

export function createCoral(kind, color) {
    const g = new THREE.Group();
    const mat = std(color, { emissive: color, emissiveIntensity: 0.22, roughness: 0.7 });
    if (kind === 'fan') {
        const fan = mesh(geo.sphere, mat, { scale: [1.6, 1.5, 0.12] });
        fan.rotation.y = Math.random() * Math.PI;
        g.add(fan);
        g.add(mesh(geo.cyl, mat, { pos: [0, -1.1, 0], scale: [0.12, 1.1, 0.12] }));
    } else if (kind === 'brain') {
        g.add(mesh(geo.torus, mat, { scale: [1.1, 1.1, 1.1], rot: [1.1, 0, 0] }));
        g.add(mesh(geo.icosa, mat, { scale: [0.85, 0.7, 0.85] }));
    } else {
        const n = 4 + Math.floor(Math.random() * 4);
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2;
            const h = 1.2 + Math.random() * 1.6;
            g.add(mesh(geo.cylTaper, mat, {
                pos: [Math.cos(a) * 0.35, h * 0.45, Math.sin(a) * 0.35],
                scale: [0.22 + Math.random() * 0.12, h, 0.22],
                rot: [Math.random() * 0.25, 0, Math.random() * 0.25]
            }));
        }
    }
    g.userData.mat = mat;
    return g;
}

export function createRock(size = 1) {
    const mat = std(0x243844, { roughness: 0.92, emissive: 0x0c1c24, emissiveIntensity: 0.12 });
    const g = new THREE.Group();
    g.add(mesh(geo.icosa, mat, { scale: [size, size * (0.55 + Math.random() * 0.4), size * 0.9] }));
    if (Math.random() > 0.4) {
        g.add(mesh(geo.sphereLo, mat, {
            pos: [(Math.random() - 0.5) * size, -size * 0.15, (Math.random() - 0.5) * size],
            scale: [size * 0.55, size * 0.35, size * 0.5]
        }));
    }
    return g;
}

export function createAnemone(color) {
    const g = new THREE.Group();
    const stem = std(color, { emissive: color, emissiveIntensity: 0.3, roughness: 0.55 });
    g.add(mesh(geo.sphereLo, stem, { scale: [0.45, 0.28, 0.45] }));
    for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const arm = mesh(geo.cyl, stem, {
            pos: [Math.cos(a) * 0.15, 0.55, Math.sin(a) * 0.15],
            scale: [0.04, 0.9, 0.04],
            rot: [0.45, a, 0],
            cast: false
        });
        g.add(arm);
    }
    g.userData.mat = stem;
    return g;
}

export function createTideLight(color = 0x9ef7ff) {
    const g = new THREE.Group();
    const core = new THREE.Mesh(
        geo.sphere,
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 })
    );
    core.scale.setScalar(0.42);
    const halo = new THREE.Mesh(
        geo.sphere,
        new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.18,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        })
    );
    halo.scale.setScalar(1.35);
    const light = new THREE.PointLight(color, 2.4, 14, 1.5);
    g.add(core, halo, light);
    g.userData.core = core;
    g.userData.halo = halo;
    g.userData.light = light;
    g.userData.taken = false;
    return g;
}
