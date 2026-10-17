/**
 * port — cais, armazéns com telhado de duas águas, placas numeradas e guindastes a vapor (P01–P07).
 */

import * as THREE from 'three';
import { LAYOUT } from '../config.js';
import { seeded } from '../utils.js';

function makeSignTexture(num) {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 64;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#e8e2d4';
    ctx.fillRect(0, 0, 128, 64);
    ctx.strokeStyle = '#2a241e';
    ctx.lineWidth = 4;
    ctx.strokeRect(3, 3, 122, 58);
    ctx.fillStyle = '#1e1a16';
    ctx.font = 'bold 34px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Nº ${num}`, 64, 34);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

function makeGableRoofGeometry(depth, roofH, len) {
    const shape = new THREE.Shape();
    const hw = (depth + 1.4) * 0.5;
    shape.moveTo(-hw, 0);
    shape.lineTo(0, roofH);
    shape.lineTo(hw, 0);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: len + 0.8, bevelEnabled: false });
    geo.translate(0, 0, -(len + 0.8) * 0.5);
    geo.computeVertexNormals();
    return geo;
}

function makeWarehouse(mats, len, depth, h, rnd, numberLabel) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
        new THREE.BoxGeometry(depth, h, len),
        rnd() > 0.45 ? mats.brick : mats.plaster
    );
    body.position.y = h * 0.5;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);

    // Embasamento de pedra na base do armazém
    const plinth = new THREE.Mesh(
        new THREE.BoxGeometry(depth + 0.3, 1.1, len + 0.3),
        mats.quay
    );
    plinth.position.y = 0.55;
    g.add(plinth);

    // Telhado de duas águas com lanternim de ventilação
    const roofH = 2.6;
    const roof = new THREE.Mesh(makeGableRoofGeometry(depth, roofH, len), mats.roof);
    roof.position.y = h;
    roof.castShadow = true;
    roof.receiveShadow = true;
    g.add(roof);

    const skylight = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 0.75, len * 0.65),
        mats.glass
    );
    skylight.position.y = h + roofH + 0.15;
    g.add(skylight);

    // Portas correderas duplas com verga arqueada
    const doorMat = mats.wood;
    const nDoors = Math.max(2, Math.floor(len / 16));
    for (let i = 0; i < nDoors; i++) {
        const dz = -len * 0.38 + (i / (nDoors - 1 || 1)) * len * 0.76;
        const door = new THREE.Mesh(new THREE.BoxGeometry(0.35, h * 0.56, 4.2), doorMat);
        door.position.set(-depth * 0.5 - 0.08, h * 0.28, dz);
        g.add(door);
        const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.35, 4.6), mats.quay);
        lintel.position.set(-depth * 0.5 - 0.12, h * 0.58, dz);
        g.add(lintel);
    }

    // Placa numerada histórica do armazém
    const signMat = new THREE.MeshStandardMaterial({
        map: makeSignTexture(numberLabel),
        roughness: 0.7
    });
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.35, 2.7), signMat);
    plate.position.set(-depth * 0.5 - 0.16, h * 0.78, 0);
    g.add(plate);

    return g;
}

function makeCrane(mats) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.85, 2.2, 12), mats.steel);
    base.position.y = 1.1;
    base.castShadow = true;
    g.add(base);

    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.48, 13.5, 10), mats.steel);
    mast.position.y = 7.8;
    mast.castShadow = true;
    g.add(mast);

    // Lança treliçada articulada com polia, cabo e gancho
    const boomGroup = new THREE.Group();
    boomGroup.position.set(0, 7.2, -0.3);
    boomGroup.rotation.x = -0.35;

    for (const sx of [-0.28, 0.28]) {
        const chord = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 16, 6), mats.steel);
        chord.rotation.x = Math.PI / 2;
        chord.position.set(sx, 3.8, -6.5);
        chord.castShadow = true;
        boomGroup.add(chord);
    }
    const sheave = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.08, 8, 16), mats.funnelBand);
    sheave.rotation.y = Math.PI / 2;
    sheave.position.set(0, 3.8, -14.5);
    boomGroup.add(sheave);

    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 7.5, 6), mats.steel);
    cable.position.set(0, 0.1, -14.5);
    boomGroup.add(cable);

    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.06, 8, 14, Math.PI * 1.35), mats.funnelBand);
    hook.position.set(0, -3.7, -14.5);
    boomGroup.add(hook);

    g.add(boomGroup);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.3, 2.8), mats.wood);
    cabin.position.set(0, 3.3, 0.6);
    cabin.castShadow = true;
    g.add(cabin);

    // Caldeira vertical a vapor com chaminé
    const boiler = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.9, 2.8, 12), mats.funnel);
    boiler.position.set(0, 3.4, 2.2);
    g.add(boiler);
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 2.1, 10), mats.funnel);
    stack.position.set(0, 5.4, 2.2);
    g.add(stack);

    g.userData.boom = boomGroup;
    return g;
}

export function create(ctx) {
    const { scene, mats, quality } = ctx;
    const group = new THREE.Group();
    group.name = 'port';
    const rnd = seeded(1908);

    // Plataforma de cantaria do cais
    const quayLen = LAYOUT.quayZ1 - LAYOUT.quayZ0;
    const quay = new THREE.Mesh(
        new THREE.BoxGeometry(22, 1.4, quayLen + 40),
        mats.quay
    );
    quay.position.set(LAYOUT.quayX + 5, 0.5, (LAYOUT.quayZ0 + LAYOUT.quayZ1) * 0.5);
    quay.receiveShadow = true;
    quay.castShadow = true;
    group.add(quay);

    // Meio-fio de granito e cabeços de amarração (bollards)
    const wall = new THREE.Mesh(
        new THREE.BoxGeometry(0.75, 0.55, quayLen + 40),
        mats.quay
    );
    wall.position.set(LAYOUT.quayX - 5.5, 1.25, quay.position.z);
    group.add(wall);

    const bollardGeo = new THREE.CylinderGeometry(0.22, 0.28, 0.65, 10);
    for (let bz = LAYOUT.quayZ0; bz <= LAYOUT.quayZ1; bz += 18) {
        const bol = new THREE.Mesh(bollardGeo, mats.steel);
        bol.position.set(LAYOUT.quayX - 5.4, 1.65, bz);
        bol.castShadow = true;
        group.add(bol);
    }

    // Armazéns numerados (Armazém 14 no ponto de atracação)
    const n = quality.warehouses;
    let z = LAYOUT.quayZ0 + 10;
    for (let i = 0; i < n; i++) {
        const len = 28 + rnd() * 22;
        const h = 8 + rnd() * 3.5;
        const isDock = Math.abs(z + len * 0.5 - LAYOUT.dockZ) < 35;
        const num = isDock ? 14 : 11 + i;
        const w = makeWarehouse(mats, len, LAYOUT.warehouseDepth, h, rnd, num);
        w.position.set(LAYOUT.quayX + 18, 0, z + len * 0.5);
        group.add(w);

        if (isDock) {
            w.userData.is14 = true;
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 4.2, 8), mats.steel);
            pole.position.set(-LAYOUT.warehouseDepth * 0.5 - 0.2, h + 2.1, 0);
            const flag = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.4, 2.4), mats.funnelBand);
            flag.position.set(-LAYOUT.warehouseDepth * 0.5 - 0.2, h + 3.4, 1.2);
            w.add(pole, flag);
        }

        z += len + 6 + rnd() * 4;
        if (z > LAYOUT.quayZ1) break;
    }

    // Guindastes a vapor (P05)
    const craneCount = quality.id === 'low' ? 2 : 4;
    for (let i = 0; i < craneCount; i++) {
        const cr = makeCrane(mats);
        cr.position.set(
            LAYOUT.quayX - 2,
            0,
            LAYOUT.quayZ0 + 40 + i * ((LAYOUT.quayZ1 - LAYOUT.quayZ0 - 60) / Math.max(craneCount - 1, 1))
        );
        cr.rotation.y = Math.PI * 0.5 + (rnd() - 0.5) * 0.3;
        group.add(cr);
    }

    // Postes de ferro fundido / luminárias a gás tipológicas
    const lampMat = new THREE.MeshStandardMaterial({
        color: 0xffe6a8,
        emissive: 0xffb84d,
        emissiveIntensity: 0.45,
        roughness: 0.25
    });
    for (let i = 0; i < 10; i++) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.16, 5.5, 10), mats.steel);
        pole.position.set(LAYOUT.quayX + 2, 2.75, LAYOUT.quayZ0 + 20 + i * 30);
        pole.castShadow = true;
        group.add(pole);
        const cap = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.32, 8), mats.steel);
        cap.position.set(0, 3.18, 0);
        const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.18, 0.52, 8), lampMat);
        lamp.position.set(0, 2.85, 0);
        pole.add(lamp, cap);
    }

    scene.add(group);

    return {
        update(t) {
            group.traverse((o) => {
                if (o.userData.boom) {
                    o.userData.boom.rotation.x = -0.35 + Math.sin(t * 0.15 + o.position.z * 0.01) * 0.08;
                }
            });
        },
        dispose() {
            scene.remove(group);
        }
    };
}

