/**
 * city — silhueta de Santos atrás dos armazéns + Serra do Mar (G01).
 * Edifícios tipológicos; serra arredondada coberta de mata (não alpes).
 */

import * as THREE from 'three';
import { LAYOUT } from '../config.js';
import { fbm, seeded } from '../utils.js';

function makeBlock(mats, w, h, d) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats.plaster);
    body.position.y = h * 0.5;
    body.castShadow = true;
    g.add(body);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.4, d + 0.4), mats.roof);
    roof.position.y = h + 0.15;
    g.add(roof);
    // Janelas simples
    const win = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, h * 0.35, 0.15), mats.glass);
    win.position.set(0, h * 0.55, -d * 0.5 - 0.05);
    g.add(win);
    return g;
}

export function create(ctx) {
    const { scene, mats, quality } = ctx;
    const group = new THREE.Group();
    group.name = 'city';
    const rnd = seeded(618);

    // Quarteirões atrás do porto
    const rows = quality.id === 'low' ? 2 : 3;
    for (let r = 0; r < rows; r++) {
        for (let i = 0; i < 14; i++) {
            const h = 6 + rnd() * (8 + r * 4);
            const w = 8 + rnd() * 10;
            const d = 8 + rnd() * 8;
            const b = makeBlock(mats, w, h, d);
            b.position.set(
                LAYOUT.quayX + 40 + r * 22 + rnd() * 6,
                0,
                LAYOUT.quayZ0 + 15 + i * 22 + rnd() * 4
            );
            group.add(b);
        }
    }

    // Torre tipológica (igreja / edifício alto)
    const tower = new THREE.Mesh(new THREE.BoxGeometry(6, 28, 6), mats.brick);
    tower.position.set(LAYOUT.quayX + 55, 14, 10);
    tower.castShadow = true;
    group.add(tower);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(3.5, 8, 4), mats.roof);
    spire.position.set(LAYOUT.quayX + 55, 32, 10);
    group.add(spire);

    // Serra do Mar — escarpa arredondada (G01)
    const serra = new THREE.Group();
    const nHills = quality.id === 'low' ? 5 : 8;
    for (let i = 0; i < nHills; i++) {
        const geo = new THREE.SphereGeometry(40 + i * 8, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5);
        const pos = geo.attributes.position;
        for (let v = 0; v < pos.count; v++) {
            const x = pos.getX(v);
            const z = pos.getZ(v);
            const y = pos.getY(v);
            const n = fbm(x * 0.04, z * 0.04, i + 2) * 12;
            pos.setY(v, y * 0.7 + n);
        }
        geo.computeVertexNormals();
        const hill = new THREE.Mesh(geo, mats.mountain);
        hill.position.set(
            LAYOUT.serraX + (i % 3) * 30,
            -2,
            -180 + i * 55
        );
        hill.scale.set(1.4 + (i % 2) * 0.3, 0.85, 1.6);
        serra.add(hill);
    }

    // Cobertura de mata (cones densos à distância)
    const treeGeo = new THREE.ConeGeometry(6, 14, 5);
    for (let i = 0; i < quality.trees; i++) {
        const t = new THREE.Mesh(treeGeo, mats.foliage);
        t.position.set(
            LAYOUT.serraX - 20 + rnd() * 80,
            8 + rnd() * 20,
            -220 + rnd() * 400
        );
        t.scale.setScalar(0.8 + rnd() * 1.4);
        serra.add(t);
    }
    group.add(serra);

    scene.add(group);

    return {
        update() {},
        dispose() {
            treeGeo.dispose();
            scene.remove(group);
        }
    };
}
