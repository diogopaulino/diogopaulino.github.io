/**
 * Interior do castelo: adega da entrada secreta, escadaria, salão da guarda com abóbada e
 * colunas, despensa, sala do tigre, corredor das celas e a cela de Camila.
 *
 * Planta (metros; y = 0 na adega, y = 3,2 no andar de cima; paredes de 0,6 m):
 *
 *                 cela (x ±2,5 · z −42…−37,6)
 *            ┌──────── grade ────────┐
 *            │  corredor das celas   │   x ±4 · z −37…−27,3
 *            └───────┐   ┌───────────┘
 *   despensa ┌───────┘   └───────┐ sala do tigre
 *   x −12…−5,6       salão        x 5,6…18 · z −24…−12
 *   z −21,5…−14,5    x ±5 · z −24…−12
 *            └───────┐   ┌───────┘
 *                    │escada│        10 degraus de 0,32 × 0,55 (z −5,9 → −11,4)
 *                ┌───┘   └───┐
 *                │   adega   │       x ±3 · z −5…5
 *                └───────────┘
 *
 * Cada parede é um pano extrudado com os vãos em arco recortados (Build.wallGeo); a colisão
 * usa uma caixa por trecho cheio. Tochas com chama em partículas; o lustre do salão e a tocha
 * da sala do tigre projetam sombra (conforme a qualidade).
 */

import * as THREE from 'three';
import { loadModel } from '../../../shared/gfx/assets.js';
import { Kit, block, wallGeo, vaultGeo, ribGeo, columnGeo, shadowAll } from './Build.js?v=50';
import { addTorch, EnvironmentFX, makeFire } from './Environment.js?v=50';

/* Adereços pequenos e muito densos (o baú tem ~95 mil triângulos) não projetam sombra:
   a sombra deles mal aparece e custava um passe inteiro a mais por luz (×6 na lareira). */
const NO_SHADOW = new Set(['treasure_chest', 'brass_goblets']);

const T = 0.6;
export const UP = 3.2;

export async function buildDungeon(game) {
    const g = new THREE.Group();
    g.name = 'dungeon';
    const kit = new Kit();
    const col = game.collision;
    const fx = new EnvironmentFX();
    const q = game.quality;
    let shadowBudget = q.pointShadows;

    /** Parede ao longo de X (em z) ou de Z (em x), com vãos { at: coordenada do centro, w, h }. */
    const wall = (axis, a0, a1, c, y, h, openings = []) => {
        const len = a1 - a0;
        const geo = wallGeo(len, h, T, openings.map((o) => ({ at: (axis === 'x' ? o.at - a0 : a1 - o.at), w: o.w, h: o.h, arch: o.arch })));
        if (axis === 'x') kit.put('stone', geo, a0, y, c);
        else kit.put('stone', geo, c, y, a1, Math.PI / 2);
        // colisão: trechos cheios entre os vãos
        const cuts = openings.map((o) => [o.at - o.w / 2, o.at + o.w / 2]).sort((p, r) => p[0] - r[0]);
        let s = a0;
        for (const [u, v] of [...cuts, [a1, a1]]) {
            if (u - s > 0.05) {
                if (axis === 'x') col.addBox(s, y, c - T / 2, u, y + h, c + T / 2);
                else col.addBox(c - T / 2, y, s, c + T / 2, y + h, u);
            }
            s = v;
        }
    };
    const floor = (x0, x1, z0, z1, y, m = 'slate') => {
        kit.put(m, block(x1 - x0, 0.3, z1 - z0, 0.01), (x0 + x1) / 2, y - 0.15, (z0 + z1) / 2);
        col.addFloor((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, y);
    };
    const ceil = (x0, x1, z0, z1, y) => {
        kit.put('stone', block(x1 - x0, 0.4, z1 - z0, 0.01), (x0 + x1) / 2, y + 0.2, (z0 + z1) / 2);
        col.addBox(x0, y, z0, x1, y + 0.4, z1);
    };
    const torch = (x, y, z, ry, opts = {}) => {
        const lit = opts.light !== false;
        const shadow = lit && opts.shadow && shadowBudget > 0;
        if (shadow) shadowBudget--;
        return fx.addFire(addTorch(kit, g, x, y, z, ry, { ...opts, shadow, shadowMap: q.pointShadowMap }));
    };
    const many = q.lights >= 0.8;

    // ---- adega (y = 0) ----
    floor(-3.6, 3.6, -5.6, 5.6, 0, 'cobble');
    wall('x', -3.6, 3.6, 5.3, 0, 3.6, [{ at: 0, w: 1.5, h: 2.3 }]);
    wall('x', -3.6, 3.6, -5.3, 0, 3.6, [{ at: 0, w: 2.2, h: 3 }]);
    wall('z', -5.6, 5.6, -3.3, 0, 3.6);
    wall('z', -5.6, 5.6, 3.3, 0, 3.6);
    kit.put('stone', vaultGeo(3, 1.1, 10.6, 16), 0, 2.5, 0);
    for (const z of [-3.3, 0, 3.3]) kit.put('blocks', ribGeo(3, 1.1, 0.13), 0, 2.5, z);
    ceil(-3.6, 3.6, -5.6, 5.6, 3.6);
    col.addBox(-1, 0, 5, 1, 3, 5.6); // a porta secreta fechou atrás de nós
    torch(-3, 1.6, 1.2, Math.PI / 2, { intensity: 6 });
    if (many) torch(3, 1.6, -2.4, -Math.PI / 2, { light: false });

    // ---- escadaria ----
    for (let i = 0; i < 10; i++) {
        const top = 0.32 * (i + 1);
        const z = -6.175 - i * 0.55;
        kit.put('blocks', block(2.2, top + 0.3, 0.57, 0.02), 0, top / 2 - 0.15, z);
        col.addFloor(0, z, 2.2, 0.56, top);
    }
    wall('z', -11.4, -5.6, -1.4, 0, 6.8);
    wall('z', -11.4, -5.6, 1.4, 0, 6.8);
    ceil(-1.7, 1.7, -11.4, -5.6, 6.6);

    // ---- salão da guarda (y = 3,2) ----
    floor(-5.3, 5.3, -24.6, -11.4, UP);
    wall('x', -5.6, 5.6, -11.7, UP, 4.8, [{ at: 0, w: 2.2, h: 3 }]);
    wall('x', -5.6, 5.6, -24.3, UP, 4.8, [{ at: 0, w: 2.4, h: 3 }]);
    wall('z', -24.6, -11.4, -5.3, UP, 4.8, [{ at: -18, w: 2, h: 2.8 }]);
    wall('z', -24.6, -11.4, 5.3, UP, 4.8, [{ at: -18, w: 2.4, h: 3 }]);
    kit.put('stone', vaultGeo(5, 1.7, 12.6, 22), 0, UP + 3.1, -18);
    for (const z of [-21, -18, -15]) kit.put('blocks', ribGeo(5, 1.7, 0.16), 0, UP + 3.1, z);
    ceil(-5.6, 5.6, -24.6, -11.4, UP + 4.8);
    for (const sx of [-3.1, 3.1]) {
        for (const z of [-21, -15]) {
            kit.put('blocks', columnGeo(3.25, 0.3), sx, UP, z);
            col.addPillar(sx, z, 0.42, 3.2, UP);
        }
    }
    torch(-5, UP + 1.7, -13.6, Math.PI / 2, { intensity: 7 });
    torch(5, UP + 1.7, -22.2, -Math.PI / 2, { intensity: 7 });

    // ---- despensa ----
    floor(-12.3, -5.3, -21.8, -14.2, UP);
    wall('x', -12.6, -5.6, -21.8, UP, 3.6);
    wall('x', -12.6, -5.6, -14.2, UP, 3.6);
    wall('z', -22.1, -13.9, -12.3, UP, 3.6);
    ceil(-12.6, -5, -22.1, -13.9, UP + 3.4);
    for (const z of [-20, -18, -16]) kit.put('darkwood', block(7, 0.22, 0.2, 0.02), -8.8, UP + 3.3, z);
    if (many) torch(-12, UP + 1.7, -18, Math.PI / 2, { intensity: 5, distance: 8 });

    // ---- sala do tigre (as vigas e o tigre são do TigerRoomLevel) ----
    floor(5.3, 18.3, -24.6, -11.4, UP, 'cobble');
    wall('x', 5.6, 18.6, -24.3, UP, 5.2);
    wall('x', 5.6, 18.6, -11.7, UP, 5.2);
    wall('z', -24.6, -11.4, 18.3, UP, 5.2);
    ceil(5.3, 18.6, -24.6, -11.4, UP + 5);
    torch(18, UP + 1.9, -18, -Math.PI / 2, { intensity: 8, distance: 13, shadow: true });
    torch(12, UP + 1.9, -24, 0, { intensity: 6 });

    // ---- passagem e corredor das celas ----
    floor(-1.5, 1.5, -27.6, -24, UP);
    wall('z', -27, -24.6, -1.5, UP, 3.6);
    wall('z', -27, -24.6, 1.5, UP, 3.6);
    ceil(-1.8, 1.8, -27.3, -24.3, UP + 3.3);
    floor(-4.3, 4.3, -37.6, -27, UP);
    wall('x', -4.6, 4.6, -27, UP, 4, [{ at: 0, w: 2.4, h: 3 }]);
    wall('z', -37.6, -26.7, -4.3, UP, 4);
    wall('z', -37.6, -26.7, 4.3, UP, 4);
    wall('x', -4.6, 4.6, -37.3, UP, 4, [{ at: 0, w: 2.2, h: 2.5 }]);
    kit.put('stone', vaultGeo(4, 1.2, 10.4, 18), 0, UP + 2.7, -32.2);
    for (const z of [-34.8, -32.2, -29.6]) kit.put('blocks', ribGeo(4, 1.2, 0.13), 0, UP + 2.7, z);
    ceil(-4.6, 4.6, -37.6, -26.7, UP + 4);
    torch(-4, UP + 1.7, -32, Math.PI / 2, { intensity: 7 });
    if (many) torch(4, UP + 1.7, -35.4, -Math.PI / 2, { light: false });

    // ---- cela ----
    floor(-2.8, 2.8, -42.6, -37, UP, 'cobble');
    wall('z', -42.6, -37.6, -2.8, UP, 3.6);
    wall('z', -42.6, -37.6, 2.8, UP, 3.6);
    wall('x', -3.1, 3.1, -42.3, UP, 3.6);
    ceil(-3.1, 3.1, -42.6, -37.6, UP + 3.4);
    // catre de palha e argola da corrente
    kit.put('planks', block(0.9, 0.3, 2, 0.03), -1.9, UP + 0.15, -40.6);
    kit.put('iron', new THREE.TorusGeometry(0.09, 0.02, 8, 16), 0, UP + 1.5, -42);

    kit.build(g);

    // ---- adereços (glTF): barris e caixotes para esconder, mesa do guarda, lustre, grade ----
    const props = [];
    const put = async (name, opts, x, y, z, ry = 0, solid = 0) => {
        const m = await loadModel(name, opts);
        if (!m) return null;
        m.position.set(x, y, z);
        m.rotation.y = ry;
        shadowAll(m, !NO_SHADOW.has(name));
        g.add(m);
        if (solid) col.addPillar(x, z, solid, m.userData.size.y, y);
        props.push(m);
        return m;
    };
    const B = 'wine_barrel_01';
    const C = 'wooden_crate_01';
    const jobs = [
        put(B, { height: 0.95 }, 2.4, 0, 3.6, 0.3, 0.42), put(B, { height: 0.95 }, 2.5, 0, 2.6, 1.3, 0.42), put(C, { height: 0.55 }, -2.4, 0, -3.6, 0.2, 0.5),
        // salão: esconderijos no caminho da ronda
        put(C, { height: 0.75 }, -1.6, UP, -13.4, 0.1, 0.62), put(C, { height: 0.7 }, -1.7, UP, -22.6, 0.5, 0.6),
        put(B, { height: 1.0 }, 4.3, UP, -12.6, 0.2, 0.44), put(B, { height: 1.0 }, 4.3, UP, -23.4, 2.2, 0.44),
        // despensa
        put(B, { height: 1.0 }, -11.5, UP, -15.2, 0, 0.44), put(B, { height: 1.0 }, -10.6, UP, -15.1, 1.2, 0.44), put(B, { height: 1.0 }, -11.5, UP, -16.1, 2.2, 0.44),
        put(C, { height: 0.7 }, -11.3, UP, -20.6, 0.3, 0.6), put(C, { height: 0.6 }, -9.9, UP, -20.9, 1.1, 0.55), put('treasure_chest', { width: 0.9 }, -7.2, UP, -20.9, Math.PI, 0.5),
        // corredor das celas
        put(B, { height: 1.0 }, -3.5, UP, -28, 0.4, 0.44), put(C, { height: 0.7 }, 3.4, UP, -28.2, 0.2, 0.6),
        // mesa do guarda dorminhoco
        put('WoodenTable_01', { height: 0.8 }, 2.6, UP, -16.6, Math.PI / 2, 0),
        put('brass_goblets', { height: 0.2 }, 2.6, UP + 0.8, -16.2, 0.4, 0)
    ];
    await Promise.all(jobs);
    col.addWall(2.6, -16.6, 0.9, 2.0, 0.8, UP);

    // lustre do salão: velas acesas e a luz principal com sombra
    const chand = await put('Chandelier_01', { width: 1.7 }, 0, UP + 2.75, -18, 0);
    const chandLight = new THREE.PointLight(0xffd4a8, 11, 15, 1.5);
    chandLight.position.set(0, UP + 2.6, -18);
    if (shadowBudget > 0) {
        shadowBudget--;
        chandLight.castShadow = true;
        chandLight.shadow.mapSize.set(q.pointShadowMap, q.pointShadowMap);
        chandLight.shadow.bias = -0.004;
        chandLight.shadow.normalBias = 0.03;
        chandLight.shadow.camera.near = 0.6;
        chandLight.shadow.camera.far = 15;
    }
    g.add(chandLight);
    fx.fires.push({ light: chandLight, base: 11, phase: 1.3, parts: [] });
    for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        fx.addFire(makeFire(g, Math.cos(a) * 0.6, UP + 3.4, -18 + Math.sin(a) * 0.6, { size: 0.09, light: false }));
    }

    // porta de madeira da adega (a entrada secreta, já fechada) e grade da cela
    const back = await put('large_castle_door', { height: 2.35 }, 0, 0, 5.2, Math.PI, 0);
    if (back) back.scale.x *= 0.78;
    const gate = await loadModel('large_iron_gate', { width: 2.3, ground: false });
    const cellDoor = new THREE.Group();
    cellDoor.position.set(-1.1, UP, -37.3); // dobradiça no batente oeste
    if (gate) {
        gate.position.set(1.1, 0, 0);
        shadowAll(gate);
        cellDoor.add(gate);
    }
    g.add(cellDoor);
    const cellBox = col.addBox(-1.1, UP, -37.5, 1.1, UP + 2.6, -37.1, { sight: false });

    // vaso de cerâmica torneado sobre um caixote (não toque!)
    const vase = new THREE.Mesh(
        new THREE.LatheGeometry([[0, 0], [0.11, 0], [0.16, 0.08], [0.2, 0.24], [0.15, 0.4], [0.08, 0.47], [0.1, 0.53], [0.085, 0.53], [0.065, 0.47], [0, 0.46]].map(([r, y]) => new THREE.Vector2(r, y)), 20),
        new THREE.MeshStandardMaterial({ color: 0x9a5632, roughness: 0.55 }));
    vase.castShadow = true;
    vase.userData.ownGeo = true;
    await put(C, { height: 0.6 }, 3.6, UP, -14.2, 0.3, 0.55);
    vase.position.set(3.6, UP + 0.6, -14.2);
    g.add(vase);

    return { group: g, fx, cellDoor, cellBox, vase, props };
}
