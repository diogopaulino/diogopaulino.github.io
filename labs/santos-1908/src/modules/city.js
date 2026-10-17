/**
 * city — silhueta histórica de Santos atrás dos armazéns + Serra do Mar (G01).
 * Fachadas coloniais/ecléticas com janelas em arco, torre de igreja e mata atlântica orgânica instanciada.
 */

import * as THREE from 'three';
import { LAYOUT } from '../config.js';
import { fbm, seeded } from '../utils.js';

function makeColonialFacadeTexture() {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#cfc2a8';
    ctx.fillRect(0, 0, 128, 128);

    // Cornijas horizontais de pavimento
    ctx.fillStyle = 'rgba(70,55,40,0.32)';
    ctx.fillRect(0, 0, 128, 4);
    ctx.fillRect(0, 62, 128, 3);
    ctx.fillRect(0, 124, 128, 4);

    // Vãos de janelas coloniais com bandeira em arco
    for (const y of [16, 76]) {
        for (let x = 12; x < 116; x += 28) {
            ctx.fillStyle = '#ddd4c0';
            ctx.fillRect(x - 2, y - 2, 18, 36);
            ctx.fillStyle = '#2d3b42';
            ctx.fillRect(x, y + 4, 14, 28);
            ctx.beginPath();
            ctx.arc(x + 7, y + 4, 7, Math.PI, 0);
            ctx.fill();
            ctx.strokeStyle = '#c8bfa8';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(x + 7, y - 3);
            ctx.lineTo(x + 7, y + 32);
            ctx.moveTo(x, y + 16);
            ctx.lineTo(x + 14, y + 16);
            ctx.stroke();
        }
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

function makeOrganicCanopyGeo() {
    const geo = new THREE.IcosahedronGeometry(5.5, 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        const lobe = 0.82 + 0.24 * Math.sin(x * 0.45 + z * 0.35) * Math.cos(y * 0.4);
        pos.setXYZ(i, x * lobe, y * 0.78 * lobe, z * lobe);
    }
    geo.computeVertexNormals();
    return geo;
}

function makeBlock(mats, facadeMat, w, h, d) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), facadeMat);
    body.position.y = h * 0.5;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);

    // Telhado de quatro águas (piramidal achatado)
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.hypot(w, d) * 0.54, 2.2, 4), mats.roof);
    roof.rotation.y = Math.PI * 0.25;
    roof.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d));
    roof.position.y = h + 1.05;
    roof.castShadow = true;
    g.add(roof);
    return g;
}

export function create(ctx) {
    const { scene, mats, quality } = ctx;
    const group = new THREE.Group();
    group.name = 'city';
    const rnd = seeded(618);

    const facadeTex = makeColonialFacadeTexture();
    facadeTex.repeat.set(2, 2);
    const facadeMat = new THREE.MeshStandardMaterial({
        map: facadeTex,
        roughness: 0.82,
        metalness: 0.04
    });

    // Quarteirões históricos atrás do porto
    const rows = quality.id === 'low' ? 2 : 3;
    for (let r = 0; r < rows; r++) {
        for (let i = 0; i < 14; i++) {
            const h = 6 + rnd() * (8 + r * 4);
            const w = 8 + rnd() * 10;
            const d = 8 + rnd() * 8;
            const b = makeBlock(mats, facadeMat, w, h, d);
            b.position.set(
                LAYOUT.quayX + 40 + r * 22 + rnd() * 6,
                0,
                LAYOUT.quayZ0 + 15 + i * 22 + rnd() * 4
            );
            group.add(b);
        }
    }

    // Igreja histórica / Santuário do Valongo com nave, torre sineira e coruchéu
    const church = new THREE.Group();
    church.position.set(LAYOUT.quayX + 55, 0, 10);
    const nave = new THREE.Mesh(new THREE.BoxGeometry(14, 12, 9), mats.plaster);
    nave.position.set(5, 6, 0);
    nave.castShadow = true;
    church.add(nave);
    const tower = new THREE.Mesh(new THREE.BoxGeometry(5.8, 26, 5.8), mats.brick);
    tower.position.set(0, 13, 0);
    tower.castShadow = true;
    church.add(tower);
    const belfry = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.7, 4.5, 8), mats.plaster);
    belfry.position.set(0, 28, 0);
    church.add(belfry);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(2.6, 7.5, 8), mats.roof);
    spire.position.set(0, 34, 0);
    church.add(spire);
    group.add(church);

    // Serra do Mar — escarpa arredondada (G01)
    const serra = new THREE.Group();
    const nHills = quality.id === 'low' ? 5 : 8;
    for (let i = 0; i < nHills; i++) {
        const geo = new THREE.SphereGeometry(40 + i * 8, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.5);
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

    // Cobertura de Mata Atlântica instanciada com copas orgânicas (1 draw call!)
    const treeGeo = makeOrganicCanopyGeo();
    const trees = new THREE.InstancedMesh(treeGeo, mats.foliage, quality.trees);
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    for (let i = 0; i < quality.trees; i++) {
        p.set(
            LAYOUT.serraX - 20 + rnd() * 80,
            8 + rnd() * 20,
            -220 + rnd() * 400
        );
        q.setFromEuler(new THREE.Euler(0, rnd() * Math.PI * 2, 0));
        const sc = 0.8 + rnd() * 1.4;
        s.set(sc, sc * (0.85 + rnd() * 0.3), sc);
        m.compose(p, q, s);
        trees.setMatrixAt(i, m);
    }
    trees.instanceMatrix.needsUpdate = true;
    serra.add(trees);
    group.add(serra);

    scene.add(group);

    return {
        update() {},
        dispose() {
            treeGeo.dispose();
            facadeTex.dispose();
            facadeMat.dispose();
            scene.remove(group);
        }
    };
}

