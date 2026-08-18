/**
 * Castelo cinematográfico — silhueta de torres cónicas azuis, calcário
 * claro e pináculos dourados, no espírito da abertura clássica.
 *
 * Construído só com geometria nativa + materiais PBR. Sem modelos GLB.
 */

import * as THREE from 'three';
import {
    limestone, roofTiles, flagTexture, clockTexture, goldOrnament
} from './textures.js';
import { makeFlagMaterial } from './shaders.js';

const GEO = {
    box: new THREE.BoxGeometry(1, 1, 1),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 40, 1),
    cylHi: new THREE.CylinderGeometry(1, 1, 1, 48, 1),
    cone: new THREE.ConeGeometry(1, 1, 40, 1),
    coneHi: new THREE.ConeGeometry(1, 1, 48, 4),
    sphere: new THREE.SphereGeometry(1, 32, 20),
    sphereLo: new THREE.SphereGeometry(1, 12, 8),
    plane: new THREE.PlaneGeometry(1, 1, 12, 6),
    torus: new THREE.TorusGeometry(1, 0.12, 12, 32)
};

function mesh(geo, mat, { pos, scale, rot, cast = true, receive = true, name } = {}) {
    const m = new THREE.Mesh(geo, mat);
    if (pos) m.position.set(pos[0], pos[1], pos[2]);
    if (scale) m.scale.set(scale[0], scale[1], scale[2]);
    if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
    if (name) m.name = name;
    m.castShadow = cast;
    m.receiveShadow = receive;
    return m;
}

function makeMats() {
    const stone = limestone();
    const roof = roofTiles();
    const goldMap = goldOrnament();

    const stoneMat = new THREE.MeshStandardMaterial({
        color: 0xfff6ea,
        map: stone.map,
        normalMap: stone.normalMap,
        normalScale: new THREE.Vector2(0.7, 0.7),
        roughnessMap: stone.roughnessMap,
        roughness: 0.72,
        metalness: 0.03,
        emissive: 0x2a241c,
        emissiveIntensity: 0.16
    });

    const roofMat = new THREE.MeshStandardMaterial({
        color: 0x5b82d4,
        map: roof.map,
        normalMap: roof.normalMap,
        normalScale: new THREE.Vector2(1.0, 1.0),
        roughness: 0.48,
        metalness: 0.14,
        emissive: 0x14244a,
        emissiveIntensity: 0.12
    });

    const goldMat = new THREE.MeshStandardMaterial({
        color: 0xe8c547,
        map: goldMap,
        roughness: 0.28,
        metalness: 0.82,
        emissive: 0x3a2808,
        emissiveIntensity: 0.18
    });

    const windowMat = new THREE.MeshStandardMaterial({
        color: 0xffd090,
        emissive: 0xffb14a,
        emissiveIntensity: 1.35,
        roughness: 0.22,
        metalness: 0.05
    });

    const darkMat = new THREE.MeshStandardMaterial({
        color: 0x1a140e,
        roughness: 0.9,
        metalness: 0.05
    });

    const woodMat = new THREE.MeshStandardMaterial({
        color: 0x4a3218,
        roughness: 0.86,
        metalness: 0.02
    });

    const leadMat = new THREE.MeshStandardMaterial({
        color: 0x6a736e,
        roughness: 0.45,
        metalness: 0.35
    });

    return { stoneMat, roofMat, goldMat, windowMat, darkMat, woodMat, leadMat };
}

function merlons(parent, mat, { cx = 0, cz = 0, w, d, y, step = 0.72, h = 0.62, t = 0.38 }) {
    const hw = w / 2;
    const hd = d / 2;
    const place = (x, z) => {
        parent.add(mesh(GEO.box, mat, {
            pos: [cx + x, y + h / 2, cz + z],
            scale: [t, h, t],
            cast: false
        }));
    };
    for (let x = -hw; x <= hw + 0.01; x += step) {
        place(x, -hd);
        place(x, hd);
    }
    for (let z = -hd + step; z < hd; z += step) {
        place(-hw, z);
        place(hw, z);
    }
}

function gothicPane(parent, mats, { x, y, z, w = 0.55, h = 1.35, yaw = 0 }) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = yaw;
    g.add(mesh(GEO.box, mats.windowMat, {
        scale: [w, h, 0.06],
        pos: [0, 0, 0],
        cast: false,
        name: 'window'
    }));
    g.add(mesh(GEO.cone, mats.windowMat, {
        scale: [w * 0.58, h * 0.38, 0.06],
        pos: [0, h * 0.55, 0],
        cast: false,
        name: 'window'
    }));
    g.add(mesh(GEO.box, mats.leadMat, {
        scale: [w * 0.06, h * 1.15, 0.08],
        pos: [0, 0.08, 0.02],
        cast: false
    }));
    g.add(mesh(GEO.box, mats.goldMat, {
        scale: [w * 1.18, 0.08, 0.1],
        pos: [0, -h * 0.52, 0.02],
        cast: false
    }));
    parent.add(g);
}

function finial(parent, mats, y, scale = 1) {
    parent.add(mesh(GEO.sphere, mats.goldMat, {
        pos: [0, y, 0],
        scale: [0.22 * scale, 0.22 * scale, 0.22 * scale],
        cast: false
    }));
    parent.add(mesh(GEO.cone, mats.goldMat, {
        pos: [0, y + 0.55 * scale, 0],
        scale: [0.07 * scale, 0.85 * scale, 0.07 * scale],
        cast: false
    }));
}

function flag(parent, mats, { y, scale = 1 }) {
    const pole = mesh(GEO.cyl, mats.goldMat, {
        pos: [0, y + 0.7 * scale, 0],
        scale: [0.045 * scale, 1.5 * scale, 0.045 * scale],
        cast: false
    });
    parent.add(pole);
    const cloth = new THREE.Mesh(GEO.plane, makeFlagMaterial(flagTexture()));
    cloth.position.set(0.55 * scale, y + 1.15 * scale, 0);
    cloth.scale.set(1.05 * scale, 0.62 * scale, 1);
    cloth.castShadow = false;
    cloth.receiveShadow = false;
    cloth.frustumCulled = false;
    parent.add(cloth);
    parent.userData.flags = parent.userData.flags || [];
    parent.userData.flags.push(cloth.material);
}

/**
 * Torre cónica clássica.
 * h = altura do fuste, roofH = altura do chapéu, r = raio.
 */
function tower(mats, {
    r = 1.2,
    h = 12,
    roofH = 6.5,
    taper = 0.92,
    windows = true,
    crenel = true,
    banner = true,
    clock = false
} = {}) {
    const g = new THREE.Group();
    g.add(mesh(GEO.cylHi, mats.stoneMat, {
        pos: [0, h / 2, 0],
        scale: [r, h, r * taper]
    }));
    g.add(mesh(GEO.cyl, mats.stoneMat, {
        pos: [0, h + 0.18, 0],
        scale: [r * 1.12, 0.36, r * 1.12 * taper],
        cast: false
    }));
    if (crenel) {
        merlons(g, mats.stoneMat, {
            w: r * 2.05, d: r * 2.05, y: h + 0.3, step: Math.max(0.55, r * 0.55), h: 0.5, t: 0.28
        });
    }
    g.add(mesh(GEO.coneHi, mats.roofMat, {
        pos: [0, h + 0.55 + roofH / 2, 0],
        scale: [r * 1.38, roofH, r * 1.38]
    }));
    finial(g, mats, h + 0.55 + roofH + 0.15, Math.max(0.75, r * 0.7));
    if (banner) flag(g, mats, { y: h + 0.55 + roofH + 0.85, scale: Math.max(0.7, r * 0.65) });

    if (windows) {
        const levels = Math.max(2, Math.floor(h / 4.2));
        for (let i = 0; i < levels; i++) {
            const wy = 2.2 + i * (h - 3.2) / levels;
            gothicPane(g, mats, { x: 0, y: wy, z: r * 0.98, w: r * 0.38, h: 1.15 + r * 0.15 });
            if (r > 1.15) {
                gothicPane(g, mats, {
                    x: 0, y: wy, z: -r * 0.98, w: r * 0.32, h: 1.0, yaw: Math.PI
                });
            }
        }
    }

    if (clock) {
        const face = mesh(GEO.cyl, new THREE.MeshStandardMaterial({
            map: clockTexture(),
            roughness: 0.45,
            metalness: 0.15,
            emissive: 0x221808,
            emissiveIntensity: 0.35
        }), {
            pos: [0, h * 0.62, r * 1.02],
            scale: [0.95, 0.08, 0.95],
            rot: [Math.PI / 2, 0, 0],
            cast: false
        });
        g.add(face);
        g.add(mesh(GEO.torus, mats.goldMat, {
            pos: [0, h * 0.62, r * 1.04],
            scale: [0.95, 0.95, 0.95],
            cast: false
        }));
    }

    g.userData.tipY = h + 0.55 + roofH + 1.4;
    return g;
}

function bartizan(mats, { r = 0.42, h = 2.4, roofH = 1.8 }) {
    const g = tower(mats, {
        r, h, roofH, windows: false, crenel: false, banner: false, taper: 1
    });
    g.scale.setScalar(1);
    return g;
}

function archBridge(parent, mats, { z0 = 10, length = 18, width = 3.4, arches = 4 }) {
    const g = new THREE.Group();
    g.add(mesh(GEO.box, mats.stoneMat, {
        pos: [0, 1.35, z0 + length / 2],
        scale: [width, 0.42, length]
    }));
    merlons(g, mats.stoneMat, {
        cx: 0, cz: z0 + length / 2, w: width, d: length, y: 1.52, step: 0.85, h: 0.45, t: 0.22
    });
    const span = length / arches;
    for (let i = 0; i < arches; i++) {
        const z = z0 + span * (i + 0.5);
        g.add(mesh(GEO.cyl, mats.stoneMat, {
            pos: [0, 0.15, z],
            scale: [width * 0.42, width * 1.05, 0.55],
            rot: [0, 0, Math.PI / 2],
            receive: true
        }));
        g.add(mesh(GEO.box, mats.stoneMat, {
            pos: [-width * 0.42, 0.55, z],
            scale: [0.45, 1.2, span * 0.55]
        }));
        g.add(mesh(GEO.box, mats.stoneMat, {
            pos: [width * 0.42, 0.55, z],
            scale: [0.45, 1.2, span * 0.55]
        }));
    }
    parent.add(g);
}

function gatehouse(parent, mats) {
    const g = new THREE.Group();
    g.add(mesh(GEO.box, mats.stoneMat, {
        pos: [0, 4.2, 7.4],
        scale: [7.6, 8.4, 4.2]
    }));
    g.add(mesh(GEO.box, mats.darkMat, {
        pos: [0, 2.6, 9.55],
        scale: [2.6, 4.4, 0.4],
        cast: false
    }));
    g.add(mesh(GEO.cone, mats.darkMat, {
        pos: [0, 5.15, 9.55],
        scale: [1.45, 1.5, 0.4],
        rot: [Math.PI / 2, 0, 0],
        cast: false
    }));
    for (let i = -1; i <= 1; i++) {
        g.add(mesh(GEO.box, mats.woodMat, {
            pos: [i * 0.7, 2.4, 9.62],
            scale: [0.12, 3.8, 0.08],
            cast: false
        }));
    }
    gothicPane(g, mats, { x: -2.2, y: 6.4, z: 9.55, w: 0.7, h: 1.5 });
    gothicPane(g, mats, { x: 2.2, y: 6.4, z: 9.55, w: 0.7, h: 1.5 });
    g.add(mesh(GEO.box, mats.goldMat, {
        pos: [0, 7.6, 9.58],
        scale: [1.4, 0.12, 0.12],
        cast: false
    }));
    parent.add(g);
}

function keepBody(parent, mats) {
    parent.add(mesh(GEO.box, mats.stoneMat, {
        pos: [0, 8.2, -1.2],
        scale: [11.6, 16.4, 9.4]
    }));
    parent.add(mesh(GEO.box, mats.roofMat, {
        pos: [0, 16.7, -1.2],
        scale: [12.2, 0.55, 10.0]
    }));
    merlons(parent, mats.stoneMat, {
        cx: 0, cz: -1.2, w: 11.6, d: 9.4, y: 16.4, step: 0.78, h: 0.7, t: 0.34
    });
    for (let i = -1; i <= 1; i++) {
        gothicPane(parent, mats, { x: i * 2.4, y: 7.2, z: 3.55, w: 0.72, h: 1.7 });
        gothicPane(parent, mats, { x: i * 2.4, y: 11.4, z: 3.55, w: 0.62, h: 1.45 });
    }
    parent.add(mesh(GEO.box, mats.stoneMat, {
        pos: [0, 10.1, 4.15],
        scale: [4.6, 0.28, 1.6]
    }));
    for (let i = -2; i <= 2; i++) {
        parent.add(mesh(GEO.cyl, mats.goldMat, {
            pos: [i * 0.85, 10.55, 4.85],
            scale: [0.07, 0.85, 0.07],
            cast: false
        }));
    }
}

function curtainWall(parent, mats) {
    parent.add(mesh(GEO.box, mats.stoneMat, {
        pos: [0, 3.4, 2.2],
        scale: [22.5, 6.8, 14.5]
    }));
    merlons(parent, mats.stoneMat, {
        cx: 0, cz: 2.2, w: 22.5, d: 14.5, y: 6.8, step: 0.85, h: 0.65, t: 0.36
    });
    parent.add(mesh(GEO.box, mats.stoneMat, {
        pos: [-9.6, 4.6, 2.2],
        scale: [2.2, 9.2, 15.2]
    }));
    parent.add(mesh(GEO.box, mats.stoneMat, {
        pos: [9.6, 4.6, 2.2],
        scale: [2.2, 9.2, 15.2]
    }));
}

export function createCastle() {
    const root = new THREE.Group();
    root.name = 'castle';
    const mats = makeMats();
    root.userData.mats = mats;
    root.userData.flags = [];
    root.userData.windows = [];

    curtainWall(root, mats);
    keepBody(root, mats);
    gatehouse(root, mats);
    archBridge(root, mats, { z0: 9.4, length: 16, width: 3.6, arches: 4 });

    const towers = [
        { x: 0, z: -1.4, r: 2.05, h: 22.5, roofH: 12.2, clock: true, y: 16.5 },
        { x: -6.4, z: 4.6, r: 1.25, h: 11.5, roofH: 6.4, y: 6.8 },
        { x: 6.1, z: 4.9, r: 1.12, h: 10.2, roofH: 5.8, y: 6.8 },
        { x: -8.6, z: -1.1, r: 1.45, h: 15.6, roofH: 8.2, y: 6.8 },
        { x: 8.8, z: -1.4, r: 1.18, h: 18.4, roofH: 9.6, y: 6.8 },
        { x: -5.1, z: -6.4, r: 1.55, h: 16.8, roofH: 8.8, y: 6.8 },
        { x: 4.6, z: -6.6, r: 1.32, h: 13.5, roofH: 7.2, y: 6.8 },
        { x: -2.55, z: 7.35, r: 0.92, h: 8.4, roofH: 4.4, y: 8.4 },
        { x: 2.55, z: 7.35, r: 0.88, h: 8.9, roofH: 4.6, y: 8.4 },
        { x: 0.0, z: -6.2, r: 0.95, h: 10.5, roofH: 5.5, y: 16.4 }
    ];

    let tallest = 0;
    for (const spec of towers) {
        const t = tower(mats, spec);
        t.position.set(spec.x, spec.y, spec.z);
        root.add(t);
        if (t.userData.flags) root.userData.flags.push(...t.userData.flags);
        tallest = Math.max(tallest, spec.y + t.userData.tipY);
    }

    const corners = [
        [-5.5, 16.4, 3.2], [5.5, 16.4, 3.2], [-5.5, 16.4, -5.4], [5.5, 16.4, -5.4]
    ];
    for (const [x, y, z] of corners) {
        const b = bartizan(mats, { r: 0.48, h: 2.6, roofH: 2.1 });
        b.position.set(x, y, z);
        root.add(b);
    }

    // Escadaria do pátio até o portão
    for (let i = 0; i < 8; i++) {
        root.add(mesh(GEO.box, mats.stoneMat, {
            pos: [0, 0.18 + i * 0.22, 25.2 - i * 0.7],
            scale: [4.4 - i * 0.12, 0.24, 1.15],
            receive: true
        }));
    }

    // Rosácea dourada acima do portão
    root.add(mesh(GEO.torus, mats.goldMat, {
        pos: [0, 9.6, 9.58],
        scale: [0.85, 0.85, 0.85],
        cast: false
    }));
    root.add(mesh(GEO.sphere, mats.windowMat, {
        pos: [0, 9.6, 9.62],
        scale: [0.62, 0.62, 0.08],
        cast: false,
        name: 'window'
    }));

    // Buttresses laterais
    for (const sx of [-1, 1]) {
        root.add(mesh(GEO.box, mats.stoneMat, {
            pos: [sx * 11.6, 4.2, 4.5],
            scale: [1.6, 8.2, 2.4],
            rot: [0, 0, sx * -0.18]
        }));
    }

    root.traverse((obj) => {
        if (obj.name === 'window' || obj.material === mats.windowMat) {
            root.userData.windows.push(obj);
        }
        if (obj.material && obj.material.uniforms && obj.material.uniforms.uMap) {
            if (!root.userData.flags.includes(obj.material)) root.userData.flags.push(obj.material);
        }
    });

    root.userData.tallest = tallest;
    root.userData.setGlow = (intensity) => {
        mats.windowMat.emissiveIntensity = intensity;
    };
    root.userData.tick = (time) => {
        for (const mat of root.userData.flags) {
            if (mat.uniforms?.uTime) mat.uniforms.uTime.value = time;
        }
    };

    return root;
}
