/**
 * IV — As Minas. Salão subterrâneo de colunas colossais, escadaria, braseiros,
 * cristais, a ponte estreita sobre o abismo e o portão de saída. Sem sol: a luz
 * vem do fogo e do cajado do mago, que acompanha o portador.
 *
 * Planta (eixo +Z):   0…46 salão alto (y = 0) · 46…54 escadaria (12 degraus de 0,25 m)
 *                     54…74 salão baixo (y = −3) · 74…92 ponte (2,6 m de largura, lombada de 0,5 m)
 *                     92…112 patamar e portão. Cair abaixo de y = −8 é derrota.
 */

import * as THREE from 'three';
import { smoothstep } from '../../shared/gfx/core.js';
import { ChapterWorld, own, makePage, lightShaft, halo, addFire, addAmbient } from './world.js?v=30';
import { Batch, mat, trs, block, column, arch, stairs, crystal, stoneBridge, addBrazier } from './build.js?v=30';
import { makeGoblin, GoblinAI, makeWizard, turnTo, createCreature } from './actors.js?v=30';
import { makeStaff } from './ch-shire.js?v=30';

const HALF = 17; // meia largura do salão
const LOW = -3;

export function buildMines(ctx) {
    const world = new ChapterWorld(ctx);
    const { tier } = ctx;
    const q = world.q;
    world.bounds = { minX: -15, maxX: 15, minZ: -3, maxZ: 109 };
    world.spawn = { x: 0, z: 2, yaw: 0 };
    world.overview.set(5, 4, -9);
    world.overviewLook.set(0, 3, 18);
    world.gear = { drawn: true };
    world.fallY = -8;
    world.shadowZ = 72;
    world.fogBase = -30;

    const bridge = stoneBridge({ length: 18, width: 2.6, rise: 0.5, arches: 2, depth: 3.4, rail: false });
    world.ground = (x, z) => {
        if (z < 46) return 0;
        if (z < 54) return Math.max(LOW, -Math.ceil((z - 46) / (8 / 12) + 0.001) * 0.25 + 0.25);
        if (z < 74) return LOW;
        if (z < 92) return Math.abs(x) < 1.3 ? LOW + bridge.deck(z - 83) : -40;
        return LOW;
    };
    world.applyAtmosphere = (stage) => {
        stage.fill.intensity = 0.16;
        stage.fill.color.set(0x8a7a9a);
    };

    const batch = new Batch();
    const DARK = 0xa8acb4;
    // pisos
    batch.add('slateDark', block(HALF * 2, 1, 52, 0.05), trs(0, -1, 20), 0xffffff, 2.2);
    batch.add('slateDark', block(HALF * 2, 1, 20, 0.05), trs(0, LOW - 1, 64), 0xf0e8e0, 2.2);
    batch.add('slateDark', block(HALF * 2, 1, 22, 0.05), trs(0, LOW - 1, 103), 0xf0e8e0, 2.2);
    batch.add('stoneDark', stairs({ n: 12, run: 8 / 12, riser: 0.25, width: HALF * 2 }), trs(0, LOW, 54, Math.PI), 0xffffff, 1.6);
    // bordas do abismo (paredes que descem na escuridão)
    batch.add('rockDark', block(HALF * 2, 40, 2, 0.1), trs(0, LOW - 40.5, 73), 0x9a9088, 4);
    batch.add('rockDark', block(HALF * 2, 40, 2, 0.1), trs(0, LOW - 40.5, 93), 0x9a9088, 4);
    // paredes laterais com pilastras e teto
    for (const sx of [-1, 1]) {
        batch.add('stoneDark', block(2, 64, 122, 0.1), trs(sx * (HALF + 1), -44, 53), DARK, 3);
        for (let z = 4; z <= 104; z += 9) {
            batch.add('stoneDark', block(1.6, 22, 2.2, 0.12), trs(sx * (HALF - 0.4), LOW, z), 0xc8c0b8, 2.4);
        }
    }
    batch.add('rockDark', block(HALF * 2 + 4, 2, 122, 0.1), trs(0, 17, 53), 0x8a827c, 5);
    batch.add('stoneDark', block(HALF * 2 + 4, 26, 2, 0.1), trs(0, -6, -5), DARK, 3);
    batch.add('stoneDark', block(HALF * 2 + 4, 26, 2, 0.1), trs(0, -6, 113), DARK, 3);
    // vigas de pedra em arco entre as colunas (travam o teto a cada vão)
    for (let z = 4; z <= 40; z += 9) {
        batch.add('stoneDark', arch({ span: 13.2, pier: 1.3, rise: 9.5, thick: 1.6, crown: 1.0, ogival: 2.4 }), trs(0, 0, z), 0xd0c8c0, 3);
    }
    // colunas colossais
    const cols = [];
    for (let z = 4; z <= 40; z += 9) cols.push([8, 0, z], [-8, 0, z]);
    for (const z of [59, 69]) cols.push([8, LOW, z], [-8, LOW, z]);
    for (const z of [97, 106]) cols.push([6.5, LOW, z], [-6.5, LOW, z]);
    cols.forEach(([x, y, z], i) => {
        if (world.low && i % 2 && z > 50) return;
        batch.add('stoneDark', column({ height: 17 - y, radius: 1.15, flutes: 8, depth: 0.07, capital: 1.2, base: 1.3 }), trs(x, y, z, i * 0.4), 0xd8d0c8, 2.6);
        world.addCollider(x, z, 1.75, { block: true, top: 20 });
    });
    // ponte
    for (const [, g] of bridge.parts) batch.add('stoneDark', g, trs(0, LOW, 83), 0xe0d8d0, 1.8);
    // portão de saída: arco ogival com folhas de luz do dia
    batch.add('stoneDark', arch({ span: 4.4, pier: 1.6, rise: 4.2, thick: 2.2, crown: 1.6, ogival: 1.2 }), trs(0, LOW, 111.2), 0xe8e0d8, 2);
    // braseiros
    const braziers = [[-5, 0, 9], [5, 0, 27], [-5, 0, 44], [6, LOW, 57], [-6, LOW, 70], [3.4, LOW, 95], [-3.4, LOW, 104]];
    braziers.forEach(([x, y, z]) => {
        addBrazier(batch, trs(x, y, z));
        world.addCollider(x, z, 0.5, { top: 1.5 });
    });
    // cristais nas paredes
    const gems = [[-15.2, 0, 17, 1], [15.3, 0, 35, 1.3], [-15, LOW, 63, 1.5], [15.2, LOW, 66, 1.1], [-12, LOW, 100, 1.2], [14.6, 0, 6, 0.9]];
    gems.forEach(([x, y, z, s], i) => {
        for (let k = 0; k < 6; k++) {
            const a = k * 1.1 + i;
            batch.add('crystal', crystal((0.7 + (k % 3) * 0.5) * s, (0.13 + (k % 2) * 0.06) * s),
                trs(x + Math.cos(a) * 0.35 * s, y - 0.1, z + Math.sin(a) * 0.5 * s, a, 1, Math.cos(a) * 0.35, Math.sin(a) * 0.35 - Math.sign(x) * 0.25), 0xffffff, 0);
        }
        const h = halo(0x6fd8ff, 3.2 * s, 0.3);
        h.position.set(x - Math.sign(x) * 0.3, y + 0.8, z);
        world.group.add(h);
        world.addCollider(x, z, 0.8, { top: 2 });
    });
    world.group.add(own(batch.build({ name: 'minas' })));
    mat('crystal').vertexColors = true;

    // fogo: os mais próximos do caminho ganham luz (orçamento por tier)
    braziers.forEach(([x, y, z], i) => addFire(world, x, y + 1.3, z, { size: 1.5, light: i % 2 === 0 || !world.low, intensity: 26, distance: 24 }));
    for (const [x, y, z] of [gems[2], gems[0]]) world.addLight(x - Math.sign(x) * 0.8, y + 1.2, z, 0x58c8ff, 16, 14);

    // luz do dia atrás do portão
    const day = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 7), new THREE.MeshBasicMaterial({ color: 0xfff2d0, toneMapped: false }));
    day.material.color.multiplyScalar(3);
    day.userData.own = true;
    day.position.set(0, LOW + 3.4, 112.1);
    day.rotation.y = Math.PI;
    world.group.add(day);
    const shaft = lightShaft(7, 2.6, 0xffe6b0);
    shaft.position.set(0, LOW, 109.5);
    world.group.add(shaft);
    const exitLight = new THREE.SpotLight(0xffe2b0, 400, 30, 0.5, 0.6, 1.4);
    exitLight.position.set(0, LOW + 4, 112);
    exitLight.target.position.set(0, LOW, 100);
    world.group.add(exitLight, exitLight.target);
    world.addInteract({ x: 0, z: 108, r: 2.8, id: 'exit', kind: 'goal', label: 'Escapar das minas', done: false });
    world.goal = 'exit';

    // brilho de brasa no fundo do abismo
    const ember = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, 18), new THREE.MeshBasicMaterial({ color: 0xff4a12, transparent: true, opacity: 0.5, fog: false }));
    ember.userData.own = true;
    ember.rotation.x = -Math.PI / 2;
    ember.position.set(0, -34, 83);
    world.group.add(ember);
    const emberLight = new THREE.PointLight(0xff5a1c, 90, 60, 1.2);
    emberLight.position.set(0, -22, 83);
    world.group.add(emberLight);

    // ---------- goblins ----------
    const npc = q.npc;
    const horde = [
        [-4, 22, 0], [4, 26, 0], [-6, 36, 0], [5, 40, 1], [-3, 60, 0], [4, 62, 0], [-6, 68, 0], [2, 69, 1]
    ];
    horde.forEach(([x, z, big], i) => {
        const hero = makeGoblin(i, big ? Math.max(npc, 1) : npc, !!big);
        hero.equip({ handR: big ? 'hammer' : 'axe' });
        world.group.add(hero.object);
        world.goblins.push(new GoblinAI(hero, x, z, { hp: big ? 3 : 2, speed: big ? 2.6 : 3.2, big: !!big, heightAt: world.heightAt }));
    });

    // ---------- o mago e a luz do cajado ----------
    const wizard = makeWizard(tier === 'low' ? 1 : 2);
    const staff = makeStaff();
    wizard.attach('handR', staff, { position: [0, -0.86, 0], upright: true });
    staff.userData.glow.scale.setScalar(1.6);
    world.group.add(wizard.object);
    const staffLight = new THREE.PointLight(0xd8ecff, 46, 30, 1.5);
    if (q.pointShadow) {
        staffLight.castShadow = true;
        staffLight.shadow.mapSize.set(q.pointShadow, q.pointShadow);
        staffLight.shadow.camera.near = 0.3;
        staffLight.shadow.camera.far = 30;
        staffLight.shadow.bias = -0.004;
    }
    world.group.add(staffLight);
    const w = { x: 1.6, z: 0.4, yaw: 0, st: { mode: 'idle', speed: 0 } };
    world.updateFns.push((t, dt, p) => {
        if (!p) return;
        // segue 2,4 m atrás e à direita do portador; não entra na ponte antes dele
        const tx = p.x - Math.sin(p.yaw) * 2.2 + Math.cos(p.yaw) * 1.0;
        const tz = p.z - Math.cos(p.yaw) * 2.2 - Math.sin(p.yaw) * 1.0;
        const dx = tx - w.x;
        const dz = tz - w.z;
        const d = Math.hypot(dx, dz);
        const sp = d > 6 ? 6.4 : d > 0.7 ? Math.min(4.2, 1 + d * 1.4) : 0;
        if (sp > 0) {
            const nx = w.x + (dx / d) * sp * dt;
            const nz = w.z + (dz / d) * sp * dt;
            if (world.ground(nx, nz) > -10) {
                w.x = nx;
                w.z = nz;
            }
            w.yaw = turnTo(w.yaw, Math.atan2(dx, dz), Math.min(1, dt * 6));
        }
        w.st.mode = sp > 3 ? 'run' : sp > 0 ? 'walk' : 'idle';
        w.st.speed = sp;
        const y = world.heightAt(w.x, w.z);
        wizard.object.position.set(w.x, y, w.z);
        wizard.object.rotation.y = w.yaw;
        wizard.update(dt, w.st);
        staffLight.position.set(w.x + Math.sin(w.yaw) * 0.5, y + 2.9, w.z + Math.cos(w.yaw) * 0.5);
        staffLight.intensity = 46 * (1 + Math.sin(t * 3.1) * 0.05);
    });

    // ---------- a Sombra: fera alada que sobe do abismo ----------
    const beast = createCreature('dragon', { detail: world.low ? 0 : 1, colors: { base: 0x120d0c, belly: 0x3a1208, back: 0x080606 } });
    beast.object.position.set(-6.5, -30, 79);
    beast.object.rotation.y = 1.9;
    beast.object.visible = false;
    world.group.add(beast.object);
    world.disposers.push(() => beast.dispose());
    const bst = { mode: 'flap', lookAt: new THREE.Vector3() };
    world.updateFns.push((t, dt, p) => {
        if (!world.shadowAwake) return;
        beast.object.visible = true;
        const k = 1 - Math.exp(-0.9 * dt);
        beast.object.position.y += (LOW - 0.8 + Math.sin(t * 1.3) * 0.6 - beast.object.position.y) * k;
        beast.object.position.z += ((p ? Math.min(88, Math.max(76, p.z - 3)) : 80) - beast.object.position.z) * k * 0.6;
        if (p) bst.lookAt.set(p.x, p.y + 1, p.z);
        bst.mode = Math.sin(t * 0.7) > 0.6 ? 'roar' : 'flap';
        beast.update(dt, bst);
        emberLight.intensity = 260 + Math.sin(t * 7) * 60;
    });

    // poeira suspensa
    addAmbient(world, {
        count: 60, life: 9, spread: new THREE.Vector3(9, 3, 9), velocity: new THREE.Vector3(0.05, 0.06, 0.05),
        velocitySpread: new THREE.Vector3(0.12, 0.08, 0.12), turbulence: 0.7, size: [0.05, 0.05], color: 0xffd8a0, opacity: 0.45, additive: true
    }, { y: 1.8 });

    makePage(world, 5, 14, 'mines-page');
    void smoothstep;
    return world;
}
