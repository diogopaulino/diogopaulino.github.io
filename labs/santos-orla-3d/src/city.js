/**
 * Skyline da orla — torres residenciais com sacadas, lajes e terraço técnico.
 * Fileira da frente: modelos compostos (createApartmentTower).
 * Fundo: instâncias leves para densidade sem matar o FPS.
 */

import * as THREE from 'three';
import { ORLA_LENGTH, ZONES, CANALS } from './config.js';
import { seeded } from './utils.js';
import { createApartmentTower, plasterMaterial } from '../../shared/realism.js';

const PALETTE = [0xd9d2c5, 0xe8e4dc, 0xcfc8ba, 0xb8c4c8, 0xe2d8c8, 0xcbd0d4, 0xf0ebe3, 0xd4cfc4];

function createApartmentFacadeTexture() {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 512;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#f2eee8';
    ctx.fillRect(0, 0, 256, 512);

    const floors = 16;
    const cols = 4;
    const fh = 512 / floors;
    const cw = 256 / cols;

    for (let r = 0; r < floors; r++) {
        const y = r * fh;
        ctx.fillStyle = 'rgba(120, 118, 112, 0.32)';
        ctx.fillRect(0, y + fh - 5, 256, 4);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.fillRect(0, y + fh - 8, 256, 3);

        for (let col = 0; col < cols; col++) {
            const x = col * cw;
            ctx.fillStyle = 'rgba(42, 68, 86, 0.72)';
            ctx.fillRect(x + 8, y + 6, cw - 16, fh - 15);
            ctx.fillStyle = 'rgba(235, 235, 232, 0.65)';
            ctx.fillRect(x + cw * 0.5 - 1, y + 6, 2, fh - 15);
            ctx.fillStyle = 'rgba(155, 200, 218, 0.45)';
            ctx.fillRect(x + 5, y + fh - 14, cw - 10, 6);
        }
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
}

export function createCity(quality) {
    const root = new THREE.Group();
    root.name = 'city';
    const rand = seeded(0x5a47105);
    const count = quality.buildingCount;
    // Poucas torres compostas na frente; o restante é InstancedMesh (FPS estável em softGL).
    const heroCount = quality.id === 'low' ? 6 : quality.id === 'medium' ? 14 : 22;
    const midCount = quality.id === 'low' ? 8 : quality.id === 'medium' ? 16 : 24;
    const detailedCount = Math.min(count, heroCount + midCount);

    const detailedRoot = new THREE.Group();
    detailedRoot.name = 'city-detailed';
    root.add(detailedRoot);

    // Instâncias de fundo (LOD barato)
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0);
    const facadeTex = createApartmentFacadeTexture();
    const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: facadeTex,
        bumpMap: facadeTex,
        bumpScale: 0.045,
        roughness: 0.58,
        metalness: 0.1
    });
    const farCount = Math.max(0, count - detailedCount);
    const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, farCount));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, farCount) * 3), 3);

    const windowGeo = new THREE.PlaneGeometry(0.9, 0.9);
    const windowMat = new THREE.MeshStandardMaterial({
        color: 0x7ec8e8,
        emissive: 0xffe0a0,
        emissiveIntensity: 0,
        roughness: 0.35,
        metalness: 0.2,
        side: THREE.DoubleSide
    });
    const windowCount = Math.min(count * 4, quality.id === 'low' ? 80 : 320);
    const windows = new THREE.InstancedMesh(windowGeo, windowMat, windowCount);

    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const color = new THREE.Color();
    let wi = 0;
    let farI = 0;

    for (let i = 0; i < count; i++) {
        let x = (rand() - 0.5) * (ORLA_LENGTH - 30);
        for (const c of CANALS) {
            if (Math.abs(x - c.x) < c.width + 5) x += (x < c.x ? -1 : 1) * (c.width + 6);
        }

        const front = i < detailedCount;
        const row = front ? 0 : rand() < 0.55 ? 1 : 2;
        const z = front
            ? ZONES.buildings - rand() * 3.5
            : ZONES.buildings - row * 14 - rand() * 6;
        const w = front ? 5.5 + rand() * 7.5 : 4 + rand() * 7;
        const d = front ? 5.2 + rand() * 4.5 : 4 + rand() * 6;
        const floors = front
            ? 9 + Math.floor(rand() * 14)
            : 4 + Math.floor(rand() * 12);
        const tint = PALETTE[(rand() * PALETTE.length) | 0];

        if (front) {
            const isHero = i < heroCount;
            const tower = createApartmentTower({
                width: w,
                depth: d,
                floors,
                tint,
                detail: isHero
                    ? (quality.id === 'high' ? 'full' : 'mid')
                    : 'lod'
            });
            tower.position.set(x, 0, z);
            tower.rotation.y = (rand() - 0.5) * 0.08;
            detailedRoot.add(tower);

            // Luzes de janela emissivas em algumas torres
            if (wi < windowCount - 2) {
                for (let f = 3; f < floors; f += 2) {
                    if (wi >= windowCount) break;
                    if (rand() > 0.55) continue;
                    p.set(x, f * 2.85 + 1.2, z + d * 0.52);
                    s.set(w * 0.5, 1.05, 1);
                    m.compose(p, q, s);
                    windows.setMatrixAt(wi++, m);
                }
            }
        } else if (farI < farCount) {
            const h = floors * 2.8;
            p.set(x, 0, z);
            q.identity();
            s.set(w, h, d);
            m.compose(p, q, s);
            mesh.setMatrixAt(farI, m);
            color.set(tint);
            mesh.setColorAt(farI, color);
            farI++;

            if (wi < windowCount - 2 && rand() > 0.45) {
                for (let f = 2; f < floors; f += 2) {
                    if (wi >= windowCount) break;
                    if (rand() > 0.5) continue;
                    p.set(x, f * 2.8 + 1.2, z + d * 0.51);
                    s.set(w * 0.55, 1.1, 1);
                    m.compose(p, q, s);
                    windows.setMatrixAt(wi++, m);
                }
            }
        }
    }

    mesh.count = farI;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    windows.count = wi;
    windows.instanceMatrix.needsUpdate = true;
    if (farI > 0) root.add(mesh);
    root.add(windows);

    // Solo urbano + calçadas laterais
    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(ORLA_LENGTH + 60, 120),
        plasterMaterial(0x4a4a4e, { roughness: 0.95, repeat: 12 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0.01, ZONES.buildings - 35);
    ground.receiveShadow = true;
    root.add(ground);

    return {
        root,
        windowMat,
        setNight(night) {
            windowMat.emissiveIntensity = night ? 1.25 : 0.05;
            windowMat.color.set(night ? 0xffd89a : 0x7ec8e8);
        }
    };
}
