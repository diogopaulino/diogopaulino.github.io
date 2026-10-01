/**
 * Skyline da orla — edifícios típicos de Santos (torres residenciais).
 */

import * as THREE from 'three';
import { ORLA_LENGTH, ZONES, CANALS } from './config.js';
import { seeded } from './utils.js';

const PALETTE = [0xd9d2c5, 0xe8e4dc, 0xcfc8ba, 0xb8c4c8, 0xe2d8c8, 0xcbd0d4, 0xf0ebe3];

export function createCity(quality) {
    const root = new THREE.Group();
    root.name = 'city';
    const rand = seeded(0x5a47105);
    const count = quality.buildingCount;

    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0);
    const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.72,
        metalness: 0.08
    });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);

    const windowGeo = new THREE.PlaneGeometry(0.9, 0.9);
    const windowMat = new THREE.MeshStandardMaterial({
        color: 0x7ec8e8,
        emissive: 0xffe0a0,
        emissiveIntensity: 0,
        roughness: 0.35,
        metalness: 0.2,
        side: THREE.DoubleSide
    });
    const windowCount = Math.min(count * 4, quality.id === 'low' ? 80 : 280);
    const windows = new THREE.InstancedMesh(windowGeo, windowMat, windowCount);

    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const color = new THREE.Color();
    let wi = 0;

    for (let i = 0; i < count; i++) {
        const x = (rand() - 0.5) * (ORLA_LENGTH - 30);
        if (CANALS.some((c) => Math.abs(x - c.x) < c.width + 6)) {
            // empurra para o lado
        }
        const row = rand() < 0.55 ? 0 : rand() < 0.75 ? 1 : 2;
        const z = ZONES.buildings - row * 14 - rand() * 6;
        const w = 4 + rand() * 7;
        const d = 4 + rand() * 6;
        const floors = 4 + Math.floor(rand() * (row === 0 ? 18 : 12));
        const h = floors * 2.8;
        p.set(x, 0, z);
        q.identity();
        s.set(w, h, d);
        m.compose(p, q, s);
        mesh.setMatrixAt(i, m);
        color.set(PALETTE[(rand() * PALETTE.length) | 0]);
        mesh.setColorAt(i, color);

        // algumas janelas frontais
        if (wi < windowCount - 2 && rand() > 0.35) {
            for (let f = 2; f < floors; f += 2) {
                if (wi >= windowCount) break;
                if (rand() > 0.55) continue;
                p.set(x, f * 2.8 + 1.2, z + d * 0.51);
                s.set(w * 0.55, 1.1, 1);
                m.compose(p, q, s);
                windows.setMatrixAt(wi++, m);
            }
        }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    windows.count = wi;
    windows.instanceMatrix.needsUpdate = true;
    root.add(mesh, windows);

    // Solo urbano
    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(ORLA_LENGTH + 60, 120),
        new THREE.MeshStandardMaterial({ color: 0x4a4a4e, roughness: 0.95 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0.01, ZONES.buildings - 35);
    ground.receiveShadow = true;
    root.add(ground);

    return {
        root,
        windowMat,
        setNight(night) {
            windowMat.emissiveIntensity = night ? 1.1 : 0.05;
            windowMat.color.set(night ? 0xffd89a : 0x7ec8e8);
        }
    };
}
