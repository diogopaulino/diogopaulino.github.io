/**
 * Castelo (exterior): muralha com adarve e ameias, quatro torres de canto com telhado
 * cônico de ardósia, portão em arco com a porta `large_castle_door`, e torre de menagem
 * com torreões. Tudo fundido por material (pedra, blocos, ardósia) com UV em metros.
 *
 * Planta (origem no centro do pátio, portão voltado para +Z):
 *   muralha 36 × 38 m, 9 m de altura, 2 m de espessura · torres r = 3,6 m, 13 m
 *   menagem 13 × 13 m, 21 m · ameias de 1,1 m a cada 2,2 m
 */

import * as THREE from 'three';
import { loadModel } from '../../../shared/gfx/assets.js';
import { Kit, block, wallGeo, shadowAll } from './Build.js?v=50';

export const CASTLE = { hx: 18, hz: 19, wall: 9, thick: 2 };

export async function buildCastle({ door = true, detail = 1 } = {}) {
    const g = new THREE.Group();
    g.name = 'castle';
    const kit = new Kit();
    const { hx, hz, wall, thick } = CASTLE;

    // embasamento de rocha (esconde a junção com o terreno)
    kit.put('cliff', block(hx * 2 + 5, 7, hz * 2 + 5, 0.4), 0, -3.4, 0);

    // muralhas
    kit.put('stone', wallGeo(hx * 2, wall, thick, [{ at: hx, w: 4.2, h: 5.6, arch: true }]), -hx, 0, hz);
    kit.put('stone', wallGeo(hx * 2, wall, thick), -hx, 0, -hz);
    kit.put('stone', wallGeo(hz * 2, wall, thick), -hx, 0, hz, Math.PI / 2);
    kit.put('stone', wallGeo(hz * 2, wall, thick), hx, 0, hz, Math.PI / 2);
    // ameias sobre o parapeito externo
    const merlon = (x, z, ry = 0) => kit.put('stone', block(1.1, 1.2, 0.55, 0.05), x, wall + 0.6, z, ry);
    for (let x = -hx + 3.3; x <= hx - 3.2; x += 2.2) {
        merlon(x, hz + 0.7);
        merlon(x, -hz - 0.7);
    }
    for (let z = -hz + 3.3; z <= hz - 3.2; z += 2.2) {
        merlon(-hx - 0.7, z, Math.PI / 2);
        merlon(hx + 0.7, z, Math.PI / 2);
    }
    // cordão de pedra sob as ameias
    kit.put('blocks', block(hx * 2, 0.3, thick + 0.5, 0.06), 0, wall - 0.15, hz);
    kit.put('blocks', block(hx * 2, 0.3, thick + 0.5, 0.06), 0, wall - 0.15, -hz);
    kit.put('blocks', block(thick + 0.5, 0.3, hz * 2, 0.06), -hx, wall - 0.15, 0);
    kit.put('blocks', block(thick + 0.5, 0.3, hz * 2, 0.06), hx, wall - 0.15, 0);

    // torre redonda: fuste, coroa em balanço, ameias em anel e telhado cônico
    const tower = (x, z, r, h, roof = true) => {
        const seg = detail ? 28 : 16;
        kit.put('stone', new THREE.CylinderGeometry(r, r * 1.08, h + 4, seg), x, h / 2 - 2, z);
        kit.put('blocks', new THREE.CylinderGeometry(r + 0.45, r, 0.9, seg), x, h + 0.45, z);
        const n = Math.round((r + 0.4) * 2.6);
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2;
            kit.put('stone', block(0.95, 1.1, 0.5, 0.05), x + Math.cos(a) * (r + 0.2), h + 1.45, z + Math.sin(a) * (r + 0.2), -a + Math.PI / 2);
        }
        if (roof) {
            kit.put('roof', new THREE.ConeGeometry(r + 0.1, r * 1.5, seg, 3), x, h + 0.9 + r * 0.75, z);
            kit.put('iron', new THREE.CylinderGeometry(0.03, 0.03, 1.6, 6), x, h + 0.9 + r * 1.5 + 0.7, z);
        }
    };
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) tower(sx * hx, sz * hz, 3.6, 13);
    tower(-4.6, hz + 0.6, 2.3, 11, true);
    tower(4.6, hz + 0.6, 2.3, 11, true);
    // passadiço sobre o portão
    kit.put('blocks', block(7, 1.2, thick + 1.4, 0.08), 0, wall + 0.6, hz);

    // menagem
    const kz = -5;
    kit.put('blocks', block(13, 21, 13, 0.12), 0, 10.5, kz);
    kit.put('stone', block(13.9, 1, 13.9, 0.1), 0, 21.3, kz);
    for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
            kit.put('stone', new THREE.CylinderGeometry(1.5, 1.5, 9, 16), sx * 6.5, 19, kz + sz * 6.5);
            kit.put('roof', new THREE.ConeGeometry(1.75, 3.4, 16, 2), sx * 6.5, 25.2, kz + sz * 6.5);
        }
    }
    kit.put('roof', new THREE.ConeGeometry(8.4, 6.5, 4, 3).rotateY(Math.PI / 4), 0, 25, kz);
    kit.build(g);

    // janelas acesas da menagem (vãos em arco com luz quente por dentro)
    const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.3, 0.45) });
    const win = new THREE.Shape();
    win.moveTo(-0.35, 0); win.lineTo(-0.35, 1); win.absarc(0, 1, 0.35, Math.PI, 0, true); win.lineTo(0.35, 0);
    const winGeo = new THREE.ShapeGeometry(win, 8);
    for (const [x, y] of [[-3, 9], [3, 9], [0, 14], [-3, 17.5], [3, 17.5]]) {
        const m = new THREE.Mesh(winGeo, glow);
        m.position.set(x, y, kz + 6.56);
        m.userData.ownGeo = true;
        g.add(m);
    }

    if (door) {
        const d = await loadModel('large_castle_door', { height: 5.5 });
        if (d) {
            d.scale.x *= 1.05;
            d.position.set(0, 0, hz - 0.2);
            shadowAll(d);
            g.add(d);
        }
    }
    /* postos dos arqueiros no adarve, sobre o portão */
    g.userData.archerSpots = [[-9, wall, hz], [-3, wall + 1.2, hz], [3, wall + 1.2, hz], [9, wall, hz]];
    return g;
}

/** Caixas de colisão da muralha e das torres (castelo com origem em ox, oy, oz). */
export function addCastleColliders(collision, ox, oy, oz) {
    const { hx, hz, wall, thick } = CASTLE;
    const h = wall + 2;
    collision.addWall(ox, oz + hz, hx * 2, thick, h, oy - 4);
    collision.addWall(ox, oz - hz, hx * 2, thick, h, oy - 4);
    collision.addWall(ox - hx, oz, thick, hz * 2, h, oy - 4);
    collision.addWall(ox + hx, oz, thick, hz * 2, h, oy - 4);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) collision.addPillar(ox + sx * hx, oz + sz * hz, 3.4, 16, oy - 4);
    collision.addPillar(ox - 4.6, oz + hz + 0.6, 2.2, 13, oy - 4);
    collision.addPillar(ox + 4.6, oz + hz + 0.6, 2.2, 13, oy - 4);
}
