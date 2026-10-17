/**
 * railway — trilhos instanciados do cais + locomotiva a vapor + Estação do Valongo (V01–V02, P08).
 */

import * as THREE from 'three';
import { LAYOUT } from '../config.js';
import { createSpokedWheel } from '../../../shared/realism.js';

function makeRails(mats, length) {
    const g = new THREE.Group();
    const sleeperGeo = new THREE.BoxGeometry(2.4, 0.14, 0.26);
    const n = Math.floor(length / 1.2);
    const sleepers = new THREE.InstancedMesh(sleeperGeo, mats.wood, n);
    const m = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
        m.makeTranslation(0, 0.07, -length * 0.5 + i * 1.2);
        sleepers.setMatrixAt(i, m);
    }
    sleepers.instanceMatrix.needsUpdate = true;
    sleepers.receiveShadow = true;
    g.add(sleepers);

    for (const x of [-0.75, 0.75]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.14, length), mats.rail);
        rail.position.set(x, 0.2, 0);
        g.add(rail);
    }
    return g;
}

function makeLocomotive(mats) {
    const g = new THREE.Group();
    const boiler = new THREE.Mesh(new THREE.CylinderGeometry(1.26, 1.28, 7.2, 16), mats.steel);
    boiler.rotation.x = Math.PI / 2;
    boiler.position.set(0, 2.25, 0);
    boiler.castShadow = true;
    g.add(boiler);

    // Frente da caldeira e farol de latão
    const smokebox = new THREE.Mesh(new THREE.SphereGeometry(1.24, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), mats.funnel);
    smokebox.rotation.x = -Math.PI / 2;
    smokebox.position.set(0, 2.25, -3.55);
    g.add(smokebox);

    const lamp = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.22, 0.45, 10),
        new THREE.MeshStandardMaterial({ color: 0xffe090, emissive: 0xffb840, emissiveIntensity: 0.7, roughness: 0.2 })
    );
    lamp.rotation.x = Math.PI / 2;
    lamp.position.set(0, 2.95, -3.85);
    g.add(lamp);

    // Domo de vapor de latão polido
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.62, 12, 10), mats.funnelBand);
    dome.scale.set(1, 1.25, 1);
    dome.position.set(0, 3.55, 0.4);
    g.add(dome);

    // Limpa-trilhos dianteiro (cowcatcher)
    const catcher = new THREE.Mesh(new THREE.ConeGeometry(1.35, 1.4, 4), mats.steel);
    catcher.rotation.x = -Math.PI / 2 + 0.35;
    catcher.rotation.y = Math.PI / 4;
    catcher.position.set(0, 0.65, -4.1);
    g.add(catcher);

    // Cabine do maquinista com teto arqueado e janelas
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.7, 2.6), mats.wood);
    cab.position.set(0, 2.6, 4.2);
    cab.castShadow = true;
    g.add(cab);
    const cabRoof = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.55, 2.9, 12, 1, false, -Math.PI * 0.35, Math.PI * 0.7), mats.steel);
    cabRoof.rotation.x = Math.PI / 2;
    cabRoof.position.set(0, 2.85, 4.2);
    g.add(cabRoof);

    const funnel = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.42, 2.2, 12), mats.funnel);
    funnel.position.set(0, 4.2, -2.5);
    g.add(funnel);
    const crown = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.08, 8, 16), mats.funnelBand);
    crown.rotation.x = Math.PI / 2;
    crown.position.set(0, 5.28, -2.5);
    g.add(crown);

    // Rodas motrizes raiadas + biela lateral
    for (const z of [-2.1, 0, 2.1]) {
        for (const sx of [-1.22, 1.22]) {
            const wheel = createSpokedWheel({
                radius: 0.88,
                width: 0.16,
                spokes: 12,
                rimMaterial: mats.steel,
                hubMaterial: mats.funnelBand
            });
            wheel.rotation.y = Math.PI / 2;
            wheel.position.set(sx, 0.88, z);
            g.add(wheel);
        }
    }
    for (const sx of [-1.34, 1.34]) {
        const rod = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 4.4), mats.funnelBand);
        rod.position.set(sx, 0.78, 0);
        g.add(rod);
    }

    g.userData.funnel = funnel;
    return g;
}

function makeWagon(mats) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.25, 7.2), mats.wood);
    body.position.y = 2.05;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.74, 0.24, 7.4), mats.steel);
    roof.position.y = 3.25;
    g.add(roof);

    for (const z of [-2.4, 2.4]) {
        for (const sx of [-1.1, 1.1]) {
            const wh = createSpokedWheel({
                radius: 0.46,
                width: 0.12,
                spokes: 8,
                rimMaterial: mats.steel,
                hubMaterial: mats.steel
            });
            wh.rotation.y = Math.PI / 2;
            wh.position.set(sx, 0.46, z);
            g.add(wh);
        }
    }
    return g;
}

function makeValongoSignTexture() {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 64;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#eee8d8';
    ctx.fillRect(0, 0, 256, 64);
    ctx.strokeStyle = '#2d261e';
    ctx.lineWidth = 4;
    ctx.strokeRect(3, 3, 250, 58);
    ctx.fillStyle = '#1f1a15';
    ctx.font = 'bold 26px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('VALONGO · S.P.R.', 128, 34);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

function makeArchGeometry() {
    const s = new THREE.Shape();
    s.moveTo(-2.1, 0);
    s.lineTo(-2.1, 5.2);
    s.lineTo(2.1, 5.2);
    s.lineTo(2.1, 0);
    s.lineTo(1.35, 0);
    s.lineTo(1.35, 3.1);
    s.absarc(0, 3.1, 1.35, 0, Math.PI, false);
    s.lineTo(-1.35, 0);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.55, bevelEnabled: false });
    g.translate(0, 0, -0.275);
    g.computeVertexNormals();
    return g;
}

function makeValongo(mats) {
    // Tipologia: Estação do Valongo (São Paulo Railway, 1867) com arcadas e platabanda
    const g = new THREE.Group();
    const hall = new THREE.Mesh(new THREE.BoxGeometry(28, 9, 14), mats.plaster);
    hall.position.y = 4.5;
    hall.castShadow = true;
    hall.receiveShadow = true;
    g.add(hall);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(32, 0.65, 18), mats.roof);
    roof.position.y = 9.35;
    roof.castShadow = true;
    g.add(roof);

    // Platabanda superior e torreão central com relógio
    const turret = new THREE.Mesh(new THREE.BoxGeometry(6.5, 3.2, 4.5), mats.plaster);
    turret.position.set(0, 10.8, -5.2);
    g.add(turret);
    const clockFace = new THREE.Mesh(new THREE.CircleGeometry(0.95, 16), mats.white);
    clockFace.position.set(0, 11.1, -7.48);
    clockFace.rotation.y = Math.PI;
    g.add(clockFace);

    // Arcadas esculpidas em alvenaria de tijolo
    const archGeo = makeArchGeometry();
    for (let i = 0; i < 5; i++) {
        const arch = new THREE.Mesh(archGeo, mats.brick);
        arch.position.set(-10 + i * 5, 0.5, -7.25);
        arch.castShadow = true;
        g.add(arch);
    }

    const platform = new THREE.Mesh(new THREE.BoxGeometry(36, 0.55, 6.5), mats.quay);
    platform.position.set(0, 0.55, -10.2);
    platform.receiveShadow = true;
    g.add(platform);

    const signMat = new THREE.MeshStandardMaterial({ map: makeValongoSignTexture(), roughness: 0.65 });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(8.5, 1.35, 0.25), signMat);
    sign.position.set(0, 7.8, -7.2);
    g.add(sign);

    return g;
}

export function create(ctx) {
    const { scene, mats, quality } = ctx;
    const group = new THREE.Group();
    group.name = 'railway';

    const rails = makeRails(mats, 280);
    rails.position.set(LAYOUT.quayX + 8, 1.2, (LAYOUT.quayZ0 + LAYOUT.quayZ1) * 0.5);
    group.add(rails);

    const rails2 = makeRails(mats, 280);
    rails2.position.set(LAYOUT.quayX + 12, 1.2, rails.position.z);
    group.add(rails2);

    const loco = makeLocomotive(mats);
    loco.position.set(LAYOUT.quayX + 8, 1.2, LAYOUT.valongoZ - 20);
    loco.rotation.y = Math.PI;
    group.add(loco);

    // Vagões de café da São Paulo Railway
    const wagonCount = quality.id === 'low' ? 2 : 4;
    for (let i = 0; i < wagonCount; i++) {
        const w = makeWagon(mats);
        w.position.set(LAYOUT.quayX + 8, 1.2, LAYOUT.valongoZ - 35 - i * 8.6);
        group.add(w);
    }

    const station = makeValongo(mats);
    station.position.set(LAYOUT.quayX + 32, 0, LAYOUT.valongoZ);
    group.add(station);

    scene.add(group);

    return {
        update(t) {
            loco.position.y = 1.2 + Math.sin(t * 8) * 0.015;
        },
        dispose() {
            scene.remove(group);
        }
    };
}

