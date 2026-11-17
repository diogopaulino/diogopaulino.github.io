/**
 * O navio: galeão fotogramétrico `dutch_ship_medium` (Poly Haven, CC0) como casco, mastros e
 * cordame, com convés jogável calculado por função.
 *
 * Referenciais: o modelo tem a proa em +X e mede 22 m; aqui ele é escalado ×1,4 (≈ 31 m),
 * girado para a proa apontar em −Z e afundado até a linha d'água:
 *   x_navio = z_modelo·S     z_navio = −x_modelo·S     y_navio = y_modelo·S + Y0
 *
 * Convés (alturas medidas por raycast no modelo, em metros do modelo):
 *   convés principal  x ∈ [−5,45; 3,75]   y = 1,66 (+ tosamento de 0,093·m para ré de x = −2,5)
 *   tombadilho (ré)   x ∈ [−7,6; −5,45)   y = 3,10   — o leme fica aqui
 *   castelo de proa   x ∈ (3,75; 6,3]     y = 3,05
 *   escadas           rampas de 0,9 m nos dois bordos (|z| > 0,85) ligando os níveis
 * Borda: meia-boca interna hb(x) = 2,1 − 0,065·max(0, |x + 0,5| − 3,2)².
 * A colisão vive no referencial do navio: ele balança no mar, o chão do jogador não.
 */

import * as THREE from 'three';
import { loadModel, pbrMaterial } from '../../../shared/gfx/assets.js';
import { Kit, block, ropeGeo, ropeMaterial, sailGeo, clothMaterial, shadowAll } from './Build.js?v=40';

export const SHIP_SCALE = 1.4;
const S = SHIP_SCALE;
const Y0 = -0.5;
const MAIN = 1.66;
const QUARTER = 3.1;
const FORE = 3.05;

const mainY = (xm) => MAIN + Math.max(0, -2.5 - xm) * 0.093;

/** Altura do convés (m, referencial do navio) ou null fora da área de pisar. */
export function deckY(x, z) {
    const xm = -z / S;
    const zm = Math.abs(x / S);
    const hb = 2.1 - 0.065 * Math.max(0, Math.abs(xm + 0.5) - 3.2) ** 2;
    if (zm > hb + 0.2 || xm < -7.6 || xm > 6.3) return null;
    let ym;
    if (xm < -5.45) ym = QUARTER;
    else if (xm > 3.75) ym = FORE;
    else {
        ym = mainY(xm);
        if (zm > 0.85) {
            // rampas das escadas, nos bordos
            if (xm < -4.55) ym += (QUARTER - ym) * ((-4.55 - xm) / 0.9);
            else if (xm > 2.85) ym += (FORE - ym) * ((xm - 2.85) / 0.9);
        }
    }
    return ym * S + Y0;
}

/** Pontos de marcação no referencial do navio. */
export const SHIP_MARKS = {
    helm: { x: 0, z: 8.75 },
    helmStand: { x: 0, z: 9.55 },
    spawn: { x: 1.7, z: 0.6 },
    bow: { x: 0, z: -7.4 },
    mast: { x: 0, z: 0.75 },
    mooring: { x: -2.6, z: 4.6 },
    friends: [{ x: -2.2, z: -2.6, yaw: 0.7 }, { x: 2.3, z: 1.4, yaw: -1.4 }, { x: -2.1, z: 5.6, yaw: 2.2 }]
};

export async function buildShip(game, { sails = true, props = true } = {}) {
    const ship = new THREE.Group();
    ship.name = 'ship';
    const model = await loadModel('dutch_ship_medium', { ground: false });
    if (model) {
        model.rotation.y = Math.PI / 2;
        model.scale.setScalar(S);
        model.position.y = Y0;
        shadowAll(model);
        model.traverse((o) => {
            if (o.isMesh && /sails|rigging/.test(o.material.name)) o.material.alphaTest = Math.max(o.material.alphaTest, 0.4);
        });
        ship.add(model);
    }
    const yQ = QUARTER * S + Y0;
    const kit = new Kit();

    // ---- roda do leme (tombadilho): aro, cubo, 8 raios com punhos torneados, pedestal ----
    const helm = new THREE.Group();
    const wk = new Kit();
    wk.put('darkwood', new THREE.TorusGeometry(0.46, 0.04, 8, 28));
    wk.put('darkwood', new THREE.TorusGeometry(0.3, 0.022, 6, 24));
    wk.put('darkwood', new THREE.CylinderGeometry(0.09, 0.09, 0.14, 12).rotateX(Math.PI / 2));
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const spoke = new THREE.LatheGeometry([[0.018, 0], [0.02, 0.46], [0.03, 0.5], [0.034, 0.58], [0.024, 0.66], [0, 0.68]].map(([r, y]) => new THREE.Vector2(r, y)), 8);
        spoke.rotateZ(a);
        wk.add('darkwood', spoke);
    }
    wk.build(helm);
    helm.position.set(SHIP_MARKS.helm.x, yQ + 1.05, SHIP_MARKS.helm.z);
    ship.add(helm);
    kit.put('darkwood', block(0.2, 1.05, 0.26, 0.03), SHIP_MARKS.helm.x, yQ + 0.52, SHIP_MARKS.helm.z - 0.2);
    kit.put('darkwood', block(0.34, 0.08, 0.5, 0.02), SHIP_MARKS.helm.x, yQ + 0.04, SHIP_MARKS.helm.z - 0.2);
    kit.put('iron', new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8).rotateX(Math.PI / 2), SHIP_MARKS.helm.x, yQ + 1.05, SHIP_MARKS.helm.z - 0.12);
    kit.build(ship);

    // ---- cabo enroscado no leme (tempestade) ----
    const hz = SHIP_MARKS.helm.z;
    const rope = new THREE.Mesh(ropeGeo([
        [1.6, yQ + 5.5, hz - 1.2], [0.7, yQ + 2.6, hz - 0.4], [0.35, yQ + 1.45, hz + 0.05], [-0.2, yQ + 1.2, hz - 0.08],
        [-0.42, yQ + 0.8, hz + 0.06], [0.1, yQ + 0.62, hz - 0.06], [0.45, yQ + 1.0, hz + 0.05], [0.1, yQ + 1.4, hz - 0.05],
        [-0.5, yQ + 0.5, hz + 0.3], [-1.3, yQ + 0.06, hz + 0.5]
    ], 0.032, 70), ropeMaterial());
    rope.castShadow = true;
    rope.userData.ownGeo = true;
    rope.visible = false;
    ship.add(rope);
    // âncora de interação do cabo (o objeto visível tem origem em 0,0,0)
    const ropeSpot = new THREE.Object3D();
    ropeSpot.position.set(0, yQ + 1, hz);
    ship.add(ropeSpot);

    // ---- amarra: do cabeço no convés até o cais (fuga) ----
    const mk = SHIP_MARKS.mooring;
    const yM = deckY(mk.x, mk.z);
    const mooring = new THREE.Group();
    const line = new THREE.Mesh(ropeGeo([
        [mk.x, yM + 0.5, mk.z], [mk.x - 0.9, yM + 1.25, mk.z + 0.1], [mk.x - 3.5, yM + 0.4, mk.z + 0.6], [mk.x - 9, 0.4, mk.z + 2.5]
    ], 0.04, 40), ropeMaterial());
    line.castShadow = true;
    line.userData.ownGeo = true;
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.045, 8, 20).rotateX(Math.PI / 2), ropeMaterial());
    coil.position.set(mk.x, yM + 0.5, mk.z);
    coil.userData.ownGeo = true;
    mooring.add(line, coil);
    mooring.visible = false;
    ship.add(mooring);
    const bitt = new Kit();
    bitt.put('darkwood', new THREE.CylinderGeometry(0.09, 0.11, 0.62, 12), mk.x, yM + 0.31, mk.z);
    bitt.put('darkwood', new THREE.CylinderGeometry(0.04, 0.04, 0.5, 8).rotateZ(Math.PI / 2), mk.x, yM + 0.46, mk.z);
    bitt.build(ship);
    const mooringSpot = new THREE.Object3D();
    mooringSpot.position.set(mk.x, yM + 0.6, mk.z);
    ship.add(mooringSpot);

    // ---- velas de pano com vento (verga própria no mastro grande e no traquete) ----
    const sail = new THREE.Group();
    const cloth = clothMaterial(new THREE.MeshStandardMaterial({ color: 0xe6dcc2, roughness: 0.95, metalness: 0 }), { amp: 0.22 });
    const yardMat = pbrMaterial('dark_wooden_planks', { color: 0x9a7a58 });
    const addSail = (z, y, w, drop, taper) => {
        const s = new THREE.Group();
        const m = new THREE.Mesh(sailGeo(w, drop, 1.1, taper), cloth);
        m.rotation.y = Math.PI; // barriga para a proa (−Z)
        m.castShadow = true;
        m.receiveShadow = true;
        m.userData.ownGeo = true;
        const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, w + 0.8, 10).rotateZ(Math.PI / 2), yardMat);
        yard.scale.set(1, 1, 1);
        yard.castShadow = true;
        yard.userData.ownGeo = true;
        s.add(m, yard);
        s.position.set(0, y, z);
        s.userData.cloth = m;
        sail.add(s);
        return s;
    };
    addSail(0.05, 10.6 * S + Y0, 10.5, 7.4, 1.1);
    addSail(-9.3, 9.6 * S + Y0, 8.4, 6.2, 1.1);
    sail.userData.uniforms = cloth.userData.cloth;
    sail.userData.set = 1;
    sail.visible = sails;
    ship.add(sail);
    const sailSpot = new THREE.Object3D();
    sailSpot.position.set(SHIP_MARKS.mast.x, deckY(0, 0.75) + 1.2, SHIP_MARKS.mast.z);
    ship.add(sailSpot);

    // ---- carga no convés ----
    const cargo = [];
    if (props) {
        const spots = [
            ['wine_barrel_01', 0.95, -2.35, 5.9, 0.3], ['wine_barrel_01', 0.95, -2.3, 6.75, 1.2], ['wooden_crate_01', 0.5, 2.35, 6.3, 0.2],
            ['wooden_crate_01', 0.5, 2.3, -3.6, 1.4], ['wine_barrel_01', 0.95, 2.4, -4.5, 2], ['wooden_bucket_01', 0.34, -2.2, -1.2, 0]
        ];
        await Promise.all(spots.map(async ([name, h, x, z, ry]) => {
            const m = await loadModel(name, { height: h });
            if (!m) return;
            m.position.set(x, deckY(x, z), z);
            m.rotation.y = ry;
            shadowAll(m);
            ship.add(m);
            cargo.push({ x, z, r: name === 'wooden_bucket_01' ? 0.2 : 0.42, h });
        }));
    }

    // ---- lanternas de popa e do mastro (luz quente à noite) ----
    const lamps = [];
    for (const [x, y, z] of [[0, yQ + 2.6, hz + 1.2], [0, deckY(0, 2) + 3.2, 1.4]]) {
        const l = new THREE.PointLight(0xffa850, 0, 16, 1.6);
        l.position.set(x, y, z);
        ship.add(l);
        lamps.push(l);
    }

    Object.assign(ship.userData, { helm, rope, ropeSpot, mooring, mooringSpot, sail, sailSpot, cargo, lamps, deckY, time: 0 });
    return ship;
}

/** Acende/apaga as lanternas do navio. */
export function setShipLamps(ship, intensity) {
    for (const l of ship.userData.lamps) l.intensity = intensity;
}

/**
 * Anima o navio: vento nas velas e desfraldar (escala vertical 0,06 → 1 em ~2,5 s).
 * `set` = 0 (ferrada) … 1 (toda solta).
 */
export function updateShip(ship, dt, wind = 1, set = 1) {
    const u = ship.userData;
    u.time += dt;
    const sail = u.sail;
    sail.userData.set += (set - sail.userData.set) * Math.min(1, dt * 1.4);
    const k = Math.max(0.06, sail.userData.set);
    for (const s of sail.children) s.userData.cloth.scale.y = k;
    sail.userData.uniforms.uTime.value = u.time;
    sail.userData.uniforms.uWind.value = wind * k;
}

/** Colisão do navio: convés por função, borda do casco, mastros, bote e carga. */
export function addShipColliders(collision, ship) {
    collision.setGround(deckY);
    collision.setLimit((p) => {
        const xm = -p.z / S;
        const hb = (2.1 - 0.065 * Math.max(0, Math.abs(xm + 0.5) - 3.2) ** 2) * S - 0.42;
        if (p.x > hb) p.x = hb;
        else if (p.x < -hb) p.x = -hb;
        if (p.z > 7.45 * S) p.z = 7.45 * S;
        else if (p.z < -6.15 * S) p.z = -6.15 * S;
    });
    const yMain = MAIN * S + Y0;
    const yQ = QUARTER * S + Y0;
    collision.addPillar(0, 0.75, 0.5, 12, yMain, { sight: false }); // mastro grande
    collision.addPillar(0, 3.2, 0.5, 1.1, yMain); // cabrestante
    collision.addBox(-1.15, yMain, -5.1, 1.15, yMain + 1.1, -0.5); // bote e escotilha
    collision.addPillar(0, 9.7 * 1.0 + 0.0, 0.01, 0.01, yQ); // (reservado)
    collision.addBox(-0.3, yQ, SHIP_MARKS.helm.z - 0.5, 0.3, yQ + 1.5, SHIP_MARKS.helm.z + 0.12); // leme
    for (const c of ship.userData.cargo) collision.addPillar(c.x, c.z, c.r, c.h, deckY(c.x, c.z));
}
