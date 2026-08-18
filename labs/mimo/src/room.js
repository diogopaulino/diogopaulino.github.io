/**
 * Sala de estar ao fim da tarde: janela, tapete, sofá, planta e o cantinho do pet.
 */

import * as THREE from 'three';
import { woodMaps, plasterMaps, fabricMaps, rugMaps, cushionMaps, skyTexture, leafMaps } from './textures.js';

function mesh(geo, mat, { pos, scale, rot, cast = true, receive = true } = {}) {
    const m = new THREE.Mesh(geo, mat);
    if (pos) m.position.set(...pos);
    if (scale) m.scale.set(...scale);
    if (rot) m.rotation.set(...rot);
    m.castShadow = cast;
    m.receiveShadow = receive;
    return m;
}

export function buildRoom(quality) {
    const aniso = quality.aniso ?? 4;
    const root = new THREE.Group();
    const refs = {};

    const wood = woodMaps(aniso);
    const plaster = plasterMaps(aniso);
    const fabric = fabricMaps(aniso);
    const rug = rugMaps(aniso);
    const cushion = cushionMaps(aniso);
    const leaf = leafMaps(aniso);

    const woodMat = new THREE.MeshPhysicalMaterial({
        ...wood, color: 0xc4a070, roughness: 0.62, metalness: 0.02, envMapIntensity: 0.5
    });
    const wallMat = new THREE.MeshPhysicalMaterial({
        ...plaster, color: 0xf0e4d4, roughness: 0.92, envMapIntensity: 0.25
    });
    const wallWarm = new THREE.MeshPhysicalMaterial({
        ...plaster, color: 0xe8c8a8, roughness: 0.9, envMapIntensity: 0.25
    });
    const fabricMat = new THREE.MeshPhysicalMaterial({
        ...fabric, color: 0x8a4030, roughness: 0.88, sheen: 0.6, sheenColor: 0xd08060
    });
    const rugMat = new THREE.MeshPhysicalMaterial({
        ...rug, roughness: 0.95, sheen: 0.35, sheenColor: 0xe8a070
    });
    const cushionMat = new THREE.MeshPhysicalMaterial({
        ...cushion, color: 0xe8c888, roughness: 0.86, sheen: 0.5, sheenColor: 0xffe8c0
    });
    const ceramic = new THREE.MeshPhysicalMaterial({
        color: 0xf4efe8, roughness: 0.22, metalness: 0.05, clearcoat: 0.8, clearcoatRoughness: 0.12
    });
    const ceramicBlue = new THREE.MeshPhysicalMaterial({
        color: 0x6a8aa8, roughness: 0.25, clearcoat: 0.7, clearcoatRoughness: 0.15
    });
    const metal = new THREE.MeshPhysicalMaterial({
        color: 0xc8b090, roughness: 0.28, metalness: 0.72
    });
    const glass = new THREE.MeshPhysicalMaterial({
        color: 0xc8e0f4, roughness: 0.08, metalness: 0.05,
        transparent: true, opacity: 0.22
    });
    const leafMat = new THREE.MeshPhysicalMaterial({
        ...leaf, color: 0x3d8a48, roughness: 0.62, sheen: 0.4, sheenColor: 0xa0d070
    });
    const soil = new THREE.MeshStandardMaterial({ color: 0x3a2418, roughness: 0.95 });
    const waterMat = new THREE.MeshPhysicalMaterial({
        color: 0x6ab0d8, roughness: 0.08, metalness: 0.05, transparent: true, opacity: 0.55
    });

    const box = new THREE.BoxGeometry(1, 1, 1);
    const sph = new THREE.SphereGeometry(1, 16, 12);
    const cyl = new THREE.CylinderGeometry(1, 1, 1, 20);
    const plane = new THREE.PlaneGeometry(1, 1);
    const circ = new THREE.CircleGeometry(1, 48);

    root.add(mesh(box, woodMat, { scale: [6.4, 0.08, 5.2], pos: [0, -0.04, 0], cast: false }));
    root.add(mesh(box, wallMat, { scale: [6.4, 3.1, 0.12], pos: [0, 1.5, -2.55], cast: false }));
    root.add(mesh(box, wallWarm, { scale: [0.12, 3.1, 5.2], pos: [-3.15, 1.5, 0], cast: false }));
    root.add(mesh(box, wallMat, { scale: [0.12, 3.1, 5.2], pos: [3.15, 1.5, 0], cast: false }));
    root.add(mesh(box, woodMat, { scale: [6.4, 0.1, 5.2], pos: [0, 3.08, 0], cast: false }));
    root.add(mesh(box, woodMat, { scale: [6.4, 0.12, 0.08], pos: [0, 0.06, -2.48], cast: false }));
    root.add(mesh(box, woodMat, { scale: [0.08, 0.12, 5.0], pos: [-3.08, 0.06, 0], cast: false }));
    root.add(mesh(box, woodMat, { scale: [0.08, 0.12, 5.0], pos: [3.08, 0.06, 0], cast: false }));

    const winW = 2.1;
    const winH = 1.55;
    const winY = 1.55;
    root.add(mesh(box, metal, { scale: [winW + 0.16, 0.06, 0.08], pos: [0, winY + winH / 2, -2.48] }));
    root.add(mesh(box, metal, { scale: [winW + 0.16, 0.06, 0.08], pos: [0, winY - winH / 2, -2.48] }));
    root.add(mesh(box, metal, { scale: [0.06, winH, 0.08], pos: [-winW / 2, winY, -2.48] }));
    root.add(mesh(box, metal, { scale: [0.06, winH, 0.08], pos: [winW / 2, winY, -2.48] }));
    root.add(mesh(box, metal, { scale: [0.04, winH, 0.06], pos: [0, winY, -2.48] }));
    root.add(mesh(box, metal, { scale: [winW, 0.04, 0.06], pos: [0, winY, -2.48] }));

    root.add(mesh(plane, new THREE.MeshBasicMaterial({ map: skyTexture() }), {
        scale: [winW * 1.4, winH * 1.5, 1], pos: [0, winY, -2.72], cast: false, receive: false
    }));
    root.add(mesh(box, glass, {
        scale: [winW * 0.96, winH * 0.96, 0.02], pos: [0, winY, -2.49], cast: false, receive: false
    }));

    const curtainMat = new THREE.MeshPhysicalMaterial({
        color: 0xf4e8d8, roughness: 0.85, sheen: 0.5, sheenColor: 0xfff6e8, transparent: true, opacity: 0.88
    });
    const curtainGeo = new THREE.PlaneGeometry(0.7, 2.2, 8, 20);
    const posAttr = curtainGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
        posAttr.setZ(i, Math.sin(posAttr.getX(i) * 14 + posAttr.getY(i) * 2) * 0.04);
    }
    curtainGeo.computeVertexNormals();
    const c1 = new THREE.Mesh(curtainGeo, curtainMat);
    c1.position.set(-1.35, 1.55, -2.42);
    c1.castShadow = true;
    const c2 = c1.clone();
    c2.position.x = 1.35;
    c2.scale.x = -1;
    root.add(c1, c2);

    const shaft = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 1.6, 2.4),
        new THREE.MeshBasicMaterial({
            color: 0xffe0b0, transparent: true, opacity: 0.045, depthWrite: false, blending: THREE.AdditiveBlending
        })
    );
    shaft.position.set(0, 1.1, -1.1);
    shaft.rotation.x = 0.35;
    root.add(shaft);
    refs.shaft = shaft;

    root.add(mesh(circ, rugMat, {
        scale: [1.55, 1.55, 1], pos: [0, 0.015, 0.15], rot: [-Math.PI / 2, 0, 0], cast: false
    }));

    const sofa = new THREE.Group();
    sofa.position.set(1.85, 0, 0.15);
    sofa.rotation.y = -Math.PI / 2.4;
    sofa.add(mesh(box, fabricMat, { scale: [1.7, 0.38, 0.78], pos: [0, 0.28, 0] }));
    sofa.add(mesh(box, fabricMat, { scale: [1.7, 0.7, 0.16], pos: [0, 0.7, -0.32] }));
    sofa.add(mesh(box, fabricMat, { scale: [0.14, 0.5, 0.78], pos: [-0.8, 0.52, 0] }));
    sofa.add(mesh(box, fabricMat, { scale: [0.14, 0.5, 0.78], pos: [0.8, 0.52, 0] }));
    sofa.add(mesh(box, fabricMat, { scale: [0.5, 0.28, 0.18], pos: [-0.4, 0.72, -0.18], rot: [-0.25, 0, 0] }));
    sofa.add(mesh(box, fabricMat, { scale: [0.5, 0.28, 0.18], pos: [0.4, 0.72, -0.18], rot: [-0.25, 0, 0] }));
    for (const [x, z] of [[-0.72, 0.32], [0.72, 0.32], [-0.72, -0.32], [0.72, -0.32]]) {
        sofa.add(mesh(box, woodMat, { scale: [0.08, 0.22, 0.08], pos: [x, 0.08, z] }));
    }
    root.add(sofa);

    const plant = new THREE.Group();
    plant.position.set(-2.35, 0, -1.7);
    plant.add(mesh(cyl, ceramic, { scale: [0.18, 0.28, 0.18], pos: [0, 0.14, 0] }));
    plant.add(mesh(cyl, soil, { scale: [0.16, 0.04, 0.16], pos: [0, 0.28, 0], cast: false }));
    plant.add(mesh(cyl, new THREE.MeshStandardMaterial({ color: 0x3a5a28 }), {
        scale: [0.025, 0.7, 0.025], pos: [0, 0.62, 0]
    }));
    for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        plant.add(mesh(sph, leafMat, {
            scale: [0.18, 0.28, 0.06],
            pos: [Math.cos(a) * 0.22, 0.7 + (i % 3) * 0.18, Math.sin(a) * 0.18],
            rot: [0.6, a, 0.3]
        }));
    }
    root.add(plant);

    const shelf = new THREE.Group();
    shelf.position.set(-2.85, 1.15, 0.6);
    shelf.add(mesh(box, woodMat, { scale: [0.28, 0.04, 1.4], pos: [0, 0, 0] }));
    shelf.add(mesh(box, woodMat, { scale: [0.28, 0.04, 1.4], pos: [0, 0.42, 0] }));
    const bookColors = [0x8a3030, 0x3a5080, 0xc4a050, 0x4a6a48, 0x6a3a58];
    for (let i = 0; i < 5; i++) {
        shelf.add(mesh(box, new THREE.MeshStandardMaterial({ color: bookColors[i], roughness: 0.7 }), {
            scale: [0.16, 0.28, 0.06], pos: [0.02, 0.16, -0.5 + i * 0.14]
        }));
    }
    root.add(shelf);

    const lamp = new THREE.Group();
    lamp.position.set(2.4, 0, -1.7);
    lamp.add(mesh(cyl, metal, { scale: [0.12, 0.04, 0.12], pos: [0, 0.02, 0] }));
    lamp.add(mesh(cyl, metal, { scale: [0.025, 1.15, 0.025], pos: [0, 0.6, 0] }));
    lamp.add(mesh(new THREE.ConeGeometry(0.22, 0.28, 16, 1, true), new THREE.MeshPhysicalMaterial({
        color: 0xf4e0c0, roughness: 0.7, emissive: 0xffd8a0, emissiveIntensity: 0.35, side: THREE.DoubleSide
    }), { pos: [0, 1.22, 0], rot: [Math.PI, 0, 0] }));
    root.add(lamp);
    refs.lamp = lamp;

    const bed = new THREE.Group();
    bed.position.set(-1.35, 0, 1.15);
    bed.add(mesh(cyl, cushionMat, { scale: [0.42, 0.1, 0.42], pos: [0, 0.08, 0] }));
    bed.add(mesh(new THREE.TorusGeometry(0.38, 0.08, 10, 24), cushionMat, {
        pos: [0, 0.12, 0], rot: [Math.PI / 2, 0, 0]
    }));
    root.add(bed);
    refs.bed = bed;

    const bowls = new THREE.Group();
    bowls.position.set(-2.15, 0, 0.55);
    bowls.add(mesh(cyl, ceramic, { scale: [0.12, 0.05, 0.12], pos: [0, 0.04, 0] }));
    bowls.add(mesh(cyl, ceramicBlue, { scale: [0.12, 0.05, 0.12], pos: [0.32, 0.04, 0] }));
    const kibble = new THREE.MeshPhysicalMaterial({ color: 0xc48a40, roughness: 0.7 });
    for (let i = 0; i < 8; i++) {
        bowls.add(mesh(sph, kibble, {
            scale: [0.018, 0.012, 0.018],
            pos: [(Math.random() - 0.5) * 0.12, 0.07, (Math.random() - 0.5) * 0.12]
        }));
    }
    root.add(bowls);
    refs.bowls = bowls;

    const ball = mesh(sph, new THREE.MeshPhysicalMaterial({
        color: 0xe85a4a, roughness: 0.35, clearcoat: 0.4
    }), { scale: [0.09, 0.09, 0.09], pos: [0.85, 0.09, 0.7] });
    root.add(ball);
    refs.ball = ball;

    const yarn = mesh(sph, new THREE.MeshPhysicalMaterial({
        color: 0x6a9ad0, roughness: 0.7, sheen: 0.5, sheenColor: 0xa0c8f0
    }), { scale: [0.08, 0.08, 0.08], pos: [0.55, 0.08, 0.95] });
    root.add(yarn);
    refs.yarn = yarn;

    const frame = mesh(box, woodMat, { scale: [0.42, 0.32, 0.03], pos: [2.55, 1.7, -1.1] });
    frame.add(mesh(plane, new THREE.MeshBasicMaterial({ color: 0xd8b090 }), {
        scale: [0.85, 0.78, 1], pos: [0, 0, 0.55], cast: false, receive: false
    }));
    root.add(frame);

    const tub = new THREE.Group();
    tub.position.set(2.15, 0, 1.55);
    tub.add(mesh(cyl, ceramic, { scale: [0.42, 0.22, 0.32], pos: [0, 0.14, 0] }));
    tub.add(mesh(cyl, waterMat, { scale: [0.36, 0.04, 0.26], pos: [0, 0.2, 0], cast: false }));
    tub.visible = false;
    root.add(tub);
    refs.tub = tub;

    const n = quality.dust ?? 80;
    const dustPos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
        dustPos[i * 3] = (Math.random() - 0.5) * 4;
        dustPos[i * 3 + 1] = 0.4 + Math.random() * 1.8;
        dustPos[i * 3 + 2] = (Math.random() - 0.5) * 3;
    }
    const dust = new THREE.Points(
        new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(dustPos, 3)),
        new THREE.PointsMaterial({
            color: 0xffe6c0, size: 0.012, transparent: true, opacity: 0.28,
            depthWrite: false, blending: THREE.AdditiveBlending
        })
    );
    root.add(dust);
    refs.dust = dust;

    return { root, refs };
}

export function updateRoom(refs, time) {
    if (refs.dust) {
        refs.dust.rotation.y = time * 0.02;
        const p = refs.dust.geometry.attributes.position;
        for (let i = 0; i < p.count; i++) {
            let y = p.getY(i) + Math.sin(time * 0.4 + i) * 0.0008;
            if (y > 2.4) y = 0.3;
            p.setY(i, y);
        }
        p.needsUpdate = true;
    }
    if (refs.shaft) {
        refs.shaft.material.opacity = 0.035 + Math.sin(time * 0.5) * 0.012;
    }
    if (refs.ball) refs.ball.rotation.z = time * 0.3;
}
