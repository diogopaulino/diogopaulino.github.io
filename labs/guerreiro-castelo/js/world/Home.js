/**
 * Sala da lareira (Capítulo 1 e epílogo): interior à noite.
 *
 * Planta (metros, origem no centro do cômodo, lareira na parede −Z):
 *   cômodo interno 7,0 × 7,2 · pé-direito 2,9 · paredes de reboco com 0,3 de espessura
 *   lareira de blocos com arco (boca 1,2 × 1,15), console de carvalho e soleira de pedra
 *   janela em arco na parede +X (luar entrando por um SpotLight com sombra)
 *   cama gótica na parede −X, estante e mesa com lamparina na parede +X, tapete diante do fogo
 * Iluminação: fogo (PointLight tremulando com sombra) + luar + lamparina. Sem luz ambiente
 * uniforme — o preset 'night' do WeatherSystem desliga sol e céu dentro de casa.
 */

import * as THREE from 'three';
import { loadModel } from '../../../shared/gfx/assets.js';
import { pbrMaterial } from '../../../shared/gfx/assets.js';
import { Kit, block, wallGeo, mat, shadowAll } from './Build.js?v=40';
import { makeFire } from './Environment.js?v=40';

const W = 3.5; // meia-largura interna (x)
const D = 3.6; // meia-profundidade interna (z)
const H = 2.9;
const T = 0.3;

/** Pontos de marcação da cena (assentos, câmera). */
export const HOME_MARKS = {
    dico: { x: 0.95, z: -1.05, yaw: -1.9 },
    ravi: { x: -0.75, z: -1.3, yaw: 1.35 },
    fire: { x: 0, y: 0.32, z: -3.2 },
    toy: { x: -0.25, y: 0.02, z: -0.75 }
};

export async function buildHomeInterior(game) {
    const g = new THREE.Group();
    g.name = 'home';
    const kit = new Kit();
    const q = game.quality;

    // ---- piso, forro e paredes ----
    kit.put('oak', block(W * 2 + T * 2, 0.2, D * 2 + T * 2, 0.01), 0, -0.1, 0);
    kit.put('darkwood', block(W * 2 + T * 2, 0.16, D * 2 + T * 2, 0.01), 0, H + 0.08 + 0.18, 0);
    // parede −Z (lareira) e +Z (porta)
    kit.put('plaster', wallGeo(W * 2 + T * 2, H + 0.2, T), -W - T, 0, -D - T / 2);
    kit.put('plaster', wallGeo(W * 2 + T * 2, H + 0.2, T, [{ at: W + T + 1.6, w: 1.1, h: 2.15, arch: true }]), -W - T, 0, D + T / 2);
    // parede +X (janela em arco) e −X: o pano corre em X, então gira 90° em Y
    const east = wallGeo(D * 2, H + 0.2, T, [{ at: D - 0.7, w: 1.15, h: 1.35, sill: 0.95, arch: true }]);
    kit.put('plaster', east, W + T / 2, 0, D, Math.PI / 2);
    kit.put('plaster', wallGeo(D * 2, H + 0.2, T), -W - T / 2, 0, D, Math.PI / 2);

    // vigas do forro (a cada 1,2 m) e esteios nos cantos
    for (let z = -3; z <= 3.01; z += 1.2) kit.put('darkwood', block(W * 2, 0.2, 0.18, 0.02), 0, H - 0.02, z);
    kit.put('darkwood', block(0.22, 0.26, D * 2, 0.02), 0, H - 0.2, 0);
    for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) kit.put('darkwood', block(0.2, H, 0.2, 0.02), sx * (W - 0.1), H / 2, sz * (D - 0.1));
    }
    // rodapé
    kit.put('darkwood', block(W * 2, 0.14, 0.05, 0.01), 0, 0.07, D - 0.03);
    kit.put('darkwood', block(0.05, 0.14, D * 2, 0.01), -W + 0.03, 0.07, 0);
    kit.put('darkwood', block(0.05, 0.14, D * 2, 0.01), W - 0.03, 0.07, 0);

    // ---- janela: caixilho e cruzeta ----
    const wz = 0.7; // centro da janela em z (D − (D − 0.7) = 0.7)
    kit.put('darkwood', block(0.1, 0.07, 1.3, 0.01), W + 0.05, 0.93, wz);
    kit.put('darkwood', block(0.05, 1.3, 0.05, 0.01), W + 0.12, 1.6, wz);
    kit.put('darkwood', block(0.05, 0.05, 1.15, 0.01), W + 0.12, 1.55, wz);
    kit.put('darkwood', block(0.42, 0.06, 1.5, 0.015), W - 0.12, 0.92, wz); // peitoril interno

    // ---- lareira ----
    const fz = -D + 0.34;
    kit.put('blocks', wallGeo(2.5, H, 0.68, [{ at: 1.25, w: 1.2, h: 1.15, arch: true }]), -1.25, 0, fz);
    kit.put('brick', block(1.5, 1.4, 0.06, 0.01), 0, 0.7, -D + 0.03); // fundo chamuscado
    kit.put('blocks', block(2.7, 0.14, 1.25, 0.03), 0, 0.07, -D + 0.62); // soleira
    kit.put('oak', block(2.8, 0.12, 0.95, 0.03), 0, 1.5, -D + 0.47); // console
    kit.put('oak', block(0.16, 0.22, 0.2, 0.02), -1.1, 1.34, -D + 0.76);
    kit.put('oak', block(0.16, 0.22, 0.2, 0.02), 1.1, 1.34, -D + 0.76);
    // cães de lareira (ferro) e lenha
    for (const sx of [-0.34, 0.34]) {
        kit.put('iron', block(0.03, 0.03, 0.5, 0.008), sx, 0.24, -D + 0.42);
        kit.put('iron', block(0.03, 0.3, 0.03, 0.008), sx, 0.29, -D + 0.66);
        kit.put('iron', new THREE.SphereGeometry(0.035, 10, 8), sx, 0.46, -D + 0.66);
    }
    const logGeo = () => new THREE.CylinderGeometry(0.06, 0.07, 0.78, 10).rotateZ(Math.PI / 2);
    kit.put('darkwood', logGeo(), 0, 0.32, -D + 0.4, 0.12);
    kit.put('darkwood', logGeo(), 0.02, 0.33, -D + 0.56, -0.2);
    kit.put('darkwood', logGeo(), -0.03, 0.44, -D + 0.48, 0.5);

    // ---- banco de Dico e banquinho de Ravi (assento na altura do `seatHeight` de cada um) ----
    const bench = (x, z, w, h, ry) => {
        const b = new THREE.Group();
        const k2 = new Kit();
        k2.put('oak', block(w, 0.06, 0.42, 0.02), 0, h - 0.03, 0);
        for (const sx of [-1, 1]) {
            k2.put('oak', block(0.07, h - 0.06, 0.36, 0.015), sx * (w / 2 - 0.08), (h - 0.06) / 2, 0);
        }
        k2.put('oak', block(w - 0.2, 0.06, 0.06, 0.015), 0, h * 0.42, 0);
        k2.build(b);
        b.position.set(x, 0, z);
        b.rotation.y = ry;
        g.add(b);
    };
    bench(HOME_MARKS.dico.x, HOME_MARKS.dico.z, 0.75, game.player.hero.seatHeight ?? 0.48, HOME_MARKS.dico.yaw);
    bench(HOME_MARKS.ravi.x, HOME_MARKS.ravi.z, 0.5, 0.31, HOME_MARKS.ravi.yaw);

    kit.build(g);

    // ---- tapete (pano com franja) ----
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.9, 1, 1).rotateX(-Math.PI / 2),
        pbrMaterial('fabric_pattern_07', { repeat: [3, 2.2], color: 0xb85a48, roughness: 1 }));
    rug.position.set(0, 0.012, -1.3);
    rug.receiveShadow = true;
    rug.userData.ownGeo = true;
    g.add(rug);

    // ---- móveis e objetos (glTF fotogramétricos) ----
    const put = async (name, opts, x, y, z, ry = 0) => {
        const m = await loadModel(name, opts);
        if (!m) return null;
        m.position.set(x, y, z);
        m.rotation.y = ry;
        shadowAll(m);
        g.add(m);
        return m;
    };
    const [, , table] = await Promise.all([
        put('GothicBed_01', { height: 1.5 }, -2.6, 0, 1.6, 0),
        put('wooden_bookshelf_worn', { height: 2.05 }, W - 0.33, 0, -2.2, -Math.PI / 2),
        put('WoodenTable_01', { height: 0.78 }, W - 0.55, 0, 2.2, Math.PI / 2),
        put('WoodenChair_01', { height: 1.25 }, W - 1.35, 0, 2.3, Math.PI / 2),
        put('wine_barrel_01', { height: 0.85 }, -W + 0.5, 0, -D + 0.5, 0.4),
        put('wooden_bucket_01', { height: 0.32 }, 1.75, 0, -D + 0.5, 1),
        put('brass_goblets', { height: 0.2 }, W - 0.5, 0.78, 2.55, 0.3),
        put('marble_bust_01', { height: 0.34 }, 0.85, 1.56, -D + 0.42, 0.2),
        put('treasure_chest', { width: 0.9 }, -W + 0.6, 0, -1.2, Math.PI / 2)
    ]);
    const lampModel = await put('vintage_oil_lamp', { height: 0.3 }, W - 0.5, 0.78, 1.85, 0);
    const door = await put('large_castle_door', { height: 2.3 }, 1.6, 0, D + 0.05, 0);
    if (door) door.scale.x *= 0.62;
    void table;

    // brinquedo: cavalinho — é ele que o Teco leva no epílogo
    const toy = await put('horse_statue_01', { height: 0.24 }, HOME_MARKS.toy.x, HOME_MARKS.toy.y, HOME_MARKS.toy.z, 0.8);

    // ---- luzes ----
    const fire = makeFire(g, HOME_MARKS.fire.x, HOME_MARKS.fire.y, HOME_MARKS.fire.z, {
        size: 0.62, intensity: 12, distance: 11, shadow: q.pointShadows > 0, shadowMap: Math.max(512, q.pointShadowMap), smoke: true
    });
    if (fire.light) fire.light.position.set(0, 0.75, -D + 0.95);

    const moon = new THREE.SpotLight(0x8fb0ff, 90, 16, 0.26, 0.6, 1.2);
    moon.position.set(W + 5.5, 5.2, wz + 1.4);
    moon.target.position.set(0.4, 0, -0.2);
    if (q.pointShadows > 1) {
        moon.castShadow = true;
        moon.shadow.mapSize.set(1024, 1024);
        moon.shadow.bias = -0.002;
        moon.shadow.camera.near = 2;
        moon.shadow.camera.far = 16;
    }
    g.add(moon, moon.target);

    const lamp = new THREE.PointLight(0xffb060, 1.6, 4.5, 1.8);
    lamp.position.set(W - 0.6, 1.2, 1.85);
    g.add(lamp);
    if (lampModel) {
        // chama da lamparina
        const glow = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 3.2, 1) }));
        glow.position.set(W - 0.5, 1.0, 1.85);
        glow.userData.ownGeo = true;
        g.add(glow);
    }

    /* rebatida do fogo nas paredes claras: luz quente, fraca e sem sombra, do lado da câmera */
    const bounce = new THREE.PointLight(0xffd2a0, 3, 9, 1.4);
    bounce.position.set(-1.2, 2.1, 1.6);
    g.add(bounce);

    g.userData.fire = fire;
    g.userData.shiny = toy;
    return g;
}

/** Caixas de colisão: paredes, lareira, cama, estante e mesa. */
export function addHomeColliders(collision) {
    collision.addFloor(0, 0, W * 2 + 1, D * 2 + 1, 0);
    collision.addWall(0, -D - T / 2, W * 2 + 1, T, H);
    collision.addWall(0, D + T / 2, W * 2 + 1, T, H);
    collision.addWall(-W - T / 2, 0, T, D * 2 + 1, H);
    collision.addWall(W + T / 2, 0, T, D * 2 + 1, H);
    collision.addBox(-W - 1, H, -D - 1, W + 1, H + 0.4, D + 1); // forro (segura a câmera)
    collision.addWall(0, -D + 0.5, 2.6, 1.0, H); // lareira
    collision.addWall(-2.6, 1.6, 1.6, 2.1, 0.7); // cama
    collision.addWall(W - 0.33, -2.2, 0.66, 1.4, 2.05); // estante
    collision.addWall(W - 0.55, 2.2, 0.8, 1.8, 0.78); // mesa
}
