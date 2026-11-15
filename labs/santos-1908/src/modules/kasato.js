/**
 * kasato — Kasato Maru (K01–K03).
 * ~123,4 × 15,4 m; 1 chaminé; ponte separada; casco preto com faixa de bojo.
 * Reconstrução naval detalhada: turcos curvos com botes, ventiladores em trompa,
 * balaustradas de passeio, janelas emolduradas, porões de carga, guinchos e passageiros Meiji.
 */

import * as THREE from 'three';
import { LAYOUT } from '../config.js';
import { smoothstep, lerp, seeded } from '../utils.js';
import { createSculptedHuman, profileTube } from '../../../shared/realism.js';

function buildHullGeometry(length, beam) {
    const sections = [
        { z: -length * 0.50, w: beam * 0.08, deck: 5.25, keel: -2.1 },
        { z: -length * 0.44, w: beam * 0.78, deck: 5.75, keel: -2.9 },
        { z: -length * 0.28, w: beam * 0.98, deck: 6.05, keel: -3.2 },
        { z:  length * 0.22, w: beam,        deck: 6.05, keel: -3.2 },
        { z:  length * 0.43, w: beam * 0.92, deck: 5.75, keel: -2.8 },
        { z:  length * 0.50, w: beam * 0.58, deck: 5.30, keel: -2.2 }
    ];

    const positions = [];
    const rings = [];

    for (const section of sections) {
        const half = section.w * 0.5;
        const ring = [
            [-half * 0.96, section.deck],
            [-half, 2.4],
            [-half * 0.78, -0.5],
            [-half * 0.42, section.keel + 0.35],
            [0, section.keel],
            [half * 0.42, section.keel + 0.35],
            [half * 0.78, -0.5],
            [half, 2.4],
            [half * 0.96, section.deck]
        ];
        rings.push(ring);
        for (const [x, y] of ring) positions.push(x, y, section.z);
    }

    const ringSize = rings[0].length;
    const upper = [];
    const boot = [];

    for (let section = 0; section < sections.length - 1; section++) {
        for (let p = 0; p < ringSize - 1; p++) {
            const a = section * ringSize + p;
            const b = a + 1;
            const c = (section + 1) * ringSize + p;
            const d = c + 1;
            const avgY = (
                rings[section][p][1]
                + rings[section][p + 1][1]
                + rings[section + 1][p][1]
                + rings[section + 1][p + 1][1]
            ) * 0.25;
            const target = avgY < 0.5 ? boot : upper;
            target.push(a, c, b, b, c, d);
        }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex([...upper, ...boot]);
    geometry.addGroup(0, upper.length, 0);
    geometry.addGroup(upper.length, boot.length, 1);
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return geometry;
}

/** Bote salva-vidas esculpido com quilha, bancos e lona dobrada, suspenso em turcos curvos. */
function makeLifeboatWithDavits(mats, side) {
    const g = new THREE.Group();

    const hullGeo = profileTube({
        axis: 'z',
        length: 6.4,
        rings: 12,
        seg: 14,
        squashY: 0.58,
        radius: (t) => Math.sin(t * Math.PI) * 0.92
    });
    const hull = new THREE.Mesh(hullGeo, mats.white);
    hull.castShadow = true;
    g.add(hull);

    // Borda de madeira (gunwale) e cobertura de lona moldada ao casco
    const gunwale = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.06, 6, 18), mats.wood);
    gunwale.rotation.x = Math.PI / 2;
    gunwale.scale.set(0.85, 3.1, 1);
    gunwale.position.y = 0.28;
    g.add(gunwale);

    const tarp = new THREE.Mesh(
        new THREE.SphereGeometry(0.85, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
        mats.sack
    );
    tarp.scale.set(0.95, 0.32, 3.05);
    tarp.position.y = 0.24;
    g.add(tarp);

    // Turcos curvos em pescoço de ganso (swan-neck davits) nas extremidades
    for (const dz of [-2.4, 2.4]) {
        const curve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(-side * 0.95, -1.35, dz),
            new THREE.Vector3(-side * 0.95, 0.45, dz),
            new THREE.Vector3(-side * 0.55, 1.15, dz),
            new THREE.Vector3(0, 0.95, dz)
        ]);
        const davit = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.08, 8, false), mats.white);
        davit.castShadow = true;
        g.add(davit);

        const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.85, 6), mats.steel);
        cable.position.set(0, 0.52, dz);
        g.add(cable);
    }

    return g;
}

/** Ventilador de convés clássico em trompa curva (cowl ventilator de 1908). */
function makeCowlVentilator(mats, mouthMat) {
    const g = new THREE.Group();
    const neckCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 1.35, 0),
        new THREE.Vector3(0, 1.85, -0.25),
        new THREE.Vector3(0, 1.92, -0.72)
    ]);
    const neck = new THREE.Mesh(new THREE.TubeGeometry(neckCurve, 14, 0.24, 10, false), mats.white);
    neck.castShadow = true;
    g.add(neck);

    // Boca cônica aberta pintada de vermelho naval por dentro
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.26, 0.55, 14, 1, true), mats.white);
    bell.rotation.x = Math.PI / 2;
    bell.position.set(0, 1.92, -0.95);
    g.add(bell);

    const inner = new THREE.Mesh(new THREE.CircleGeometry(0.5, 14), mouthMat);
    inner.rotation.y = Math.PI;
    inner.position.set(0, 1.92, -0.98);
    g.add(inner);

    return g;
}

/** Balaustrada de convés com balaústres verticais e corrimão de madeira/aço. */
function addDeckRailing(parent, x0, x1, y, z0, z1, mats) {
    const lenX = Math.abs(x1 - x0);
    const lenZ = Math.abs(z1 - z0);
    const isX = lenX >= lenZ;
    const len = isX ? lenX : lenZ;
    const cx = (x0 + x1) * 0.5;
    const cz = (z0 + z1) * 0.5;

    for (const ry of [0.35, 0.68, 0.96]) {
        const bar = new THREE.Mesh(
            new THREE.CylinderGeometry(0.03, 0.03, len, 6),
            ry > 0.9 ? mats.wood : mats.white
        );
        if (isX) bar.rotation.z = Math.PI / 2;
        else bar.rotation.x = Math.PI / 2;
        bar.position.set(cx, y + ry, cz);
        parent.add(bar);
    }

    const posts = Math.max(2, Math.floor(len / 2.2));
    for (let i = 0; i <= posts; i++) {
        const t = i / posts;
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 1.0, 6), mats.white);
        post.position.set(lerp(x0, x1, t), y + 0.5, lerp(z0, z1, t));
        parent.add(post);
    }
}

function makeAnchor(mats) {
    const g = new THREE.Group();
    const shank = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 1.9, 8), mats.steel);
    g.add(shank);
    const crown = new THREE.Mesh(
        new THREE.TorusGeometry(0.65, 0.12, 8, 16, Math.PI),
        mats.steel
    );
    crown.rotation.z = Math.PI;
    crown.position.y = -0.35;
    g.add(crown);
    const stock = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.1, 8), mats.steel);
    stock.rotation.z = Math.PI / 2;
    stock.position.y = 0.65;
    g.add(stock);
    return g;
}

function buildKasato(mats, quality) {
    const g = new THREE.Group();
    g.name = 'kasato-maru';
    const L = LAYOUT.kasatoLength;
    const B = LAYOUT.kasatoBeam;

    const hull = new THREE.Mesh(
        buildHullGeometry(L, B),
        [mats.hull, mats.hullBoot]
    );
    hull.castShadow = quality.shadows;
    hull.receiveShadow = true;
    g.add(hull);

    // Convés principal pranchado em teca
    const deck = new THREE.Mesh(new THREE.BoxGeometry(B - 0.5, 0.38, L * 0.88), mats.deck);
    deck.position.y = 6.2;
    deck.receiveShadow = true;
    g.add(deck);

    // Castelo de proa e tombadilho de popa
    const forecastle = new THREE.Mesh(new THREE.BoxGeometry(B * 0.72, 1.55, 17), mats.hull);
    forecastle.position.set(0, 6.95, -L * 0.36);
    g.add(forecastle);
    const foreDeck = new THREE.Mesh(new THREE.BoxGeometry(B * 0.7, 0.22, 16.6), mats.deck);
    foreDeck.position.set(0, 7.75, -L * 0.36);
    g.add(foreDeck);

    // Porões de carga dianteiro e traseiro com tampas de madeira e lona
    for (const hz of [-26, 28]) {
        const coaming = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.9, 7.2), mats.steel);
        coaming.position.set(0, 6.75, hz);
        const hatchCover = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.28, 6.9), mats.sack);
        hatchCover.position.set(0, 7.28, hz);
        g.add(coaming, hatchCover);
    }

    // Superestrutura central: salões recuados + passeio coberto com colunas e balaustrada
    const cabinW = B * 0.58;
    const cabinL = L * 0.27;
    const superCabin = new THREE.Mesh(new THREE.BoxGeometry(cabinW, 3.0, cabinL), mats.white);
    superCabin.position.set(0, 7.85, 5);
    superCabin.castShadow = true;
    superCabin.receiveShadow = true;
    g.add(superCabin);

    // Teto do passeio inferior (overhang sustentado por colunas)
    const promDeckW = B * 0.78;
    const promDeckL = L * 0.29;
    const promDeck = new THREE.Mesh(new THREE.BoxGeometry(promDeckW, 0.26, promDeckL), mats.deck);
    promDeck.position.set(0, 9.45, 5);
    promDeck.castShadow = true;
    promDeck.receiveShadow = true;
    g.add(promDeck);

    // Colunas torneadas do passeio coberto
    for (const sx of [-promDeckW * 0.47, promDeckW * 0.47]) {
        for (let z = -promDeckL * 0.44; z <= promDeckL * 0.44; z += 3.2) {
            const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 3.0, 8), mats.white);
            pillar.position.set(sx, 7.85, 5 + z);
            g.add(pillar);
        }
    }

    // Balaustrada no convés dos botes (nível 2)
    addDeckRailing(g, -promDeckW * 0.48, -promDeckW * 0.48, 9.58, 5 - promDeckL * 0.48, 5 + promDeckL * 0.48, mats);
    addDeckRailing(g, promDeckW * 0.48, promDeckW * 0.48, 9.58, 5 - promDeckL * 0.48, 5 + promDeckL * 0.48, mats);
    addDeckRailing(g, -promDeckW * 0.48, promDeckW * 0.48, 9.58, 5 - promDeckL * 0.48, 5 - promDeckL * 0.48, mats);
    addDeckRailing(g, -promDeckW * 0.48, promDeckW * 0.48, 9.58, 5 + promDeckL * 0.48, 5 + promDeckL * 0.48, mats);

    // Casario superior (Boat Deckhouse) com janelas emolduradas
    const upperW = B * 0.48;
    const upperL = L * 0.20;
    const upperDeckHouse = new THREE.Mesh(new THREE.BoxGeometry(upperW, 2.35, upperL), mats.white);
    upperDeckHouse.position.set(0, 10.75, 5);
    upperDeckHouse.castShadow = true;
    g.add(upperDeckHouse);

    const upperRoof = new THREE.Mesh(new THREE.BoxGeometry(upperW + 0.8, 0.24, upperL + 0.8), mats.deck);
    upperRoof.position.set(0, 12.0, 5);
    g.add(upperRoof);

    // Janelas do salão superior e inferior (vidro escuro emoldurado)
    for (const side of [-1, 1]) {
        for (let z = -8; z <= 16; z += 3.0) {
            const win = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.85, 1.35), mats.glass);
            win.position.set(side * (cabinW * 0.5 + 0.02), 8.15, z);
            g.add(win);
        }
        for (let z = -4; z <= 14; z += 3.2) {
            const win = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.72, 1.15), mats.glass);
            win.position.set(side * (upperW * 0.5 + 0.02), 10.95, z);
            g.add(win);
        }
    }

    // Botes salva-vidas em turcos curvos (zero blocos flutuantes!)
    for (const side of [-1, 1]) {
        for (const z of [-4, 5, 14]) {
            const b = makeLifeboatWithDavits(mats, side);
            b.position.set(side * (promDeckW * 0.48 + 0.45), 11.2, z);
            g.add(b);
        }
    }

    // Ventiladores em trompa curva (cowl ventilators clássicos de 1908)
    const cowlRedMat = new THREE.MeshStandardMaterial({ color: 0x8f2820, roughness: 0.65 });
    for (const [vx, vz, rot] of [[-2.3, -1.5, 0], [2.3, -1.5, 0], [-2.1, 13.5, Math.PI], [2.1, 13.5, Math.PI]]) {
        const vent = makeCowlVentilator(mats, cowlRedMat);
        vent.position.set(vx, 12.05, vz);
        vent.rotation.y = rot;
        g.add(vent);
    }

    // Ponte de comando separada (K03) com asas do passadiço, janelas e guarda-corpo
    const bridgeW = B * 0.84;
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(B * 0.58, 2.9, 6.2), mats.white);
    bridge.position.set(0, 11.2, -18);
    bridge.castShadow = true;
    g.add(bridge);

    const bridgeFloor = new THREE.Mesh(new THREE.BoxGeometry(bridgeW, 0.25, 6.8), mats.deck);
    bridgeFloor.position.set(0, 9.7, -18);
    g.add(bridgeFloor);
    addDeckRailing(g, -bridgeW * 0.48, bridgeW * 0.48, 9.82, -21.2, -21.2, mats);

    const pilothouse = new THREE.Mesh(new THREE.BoxGeometry(B * 0.46, 2.1, 4.2), mats.white);
    pilothouse.position.set(0, 13.6, -18.5);
    g.add(pilothouse);

    const bridgeGlass = new THREE.Mesh(new THREE.BoxGeometry(B * 0.42, 0.85, 0.16), mats.glass);
    bridgeGlass.position.set(0, 13.85, -20.62);
    g.add(bridgeGlass);

    const bridgeRoof = new THREE.Mesh(new THREE.BoxGeometry(B * 0.52, 0.26, 4.8), mats.deck);
    bridgeRoof.position.set(0, 14.75, -18.5);
    g.add(bridgeRoof);

    // Chaminé única com colar de latão e apito a vapor
    const funnel = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.45, 12.4, 20), mats.funnel);
    funnel.position.set(0, 14.2, 8);
    funnel.castShadow = true;
    g.add(funnel);
    for (const y of [15.4, 17.0]) {
        const band = new THREE.Mesh(new THREE.CylinderGeometry(2.26, 2.28, 0.72, 20), mats.white);
        band.position.set(0, y, 8);
        g.add(band);
    }
    const whistle = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.0, 8), mats.funnelBand);
    whistle.position.set(0, 16.4, 5.65);
    g.add(whistle);

    // Mastros + cesto de gávea + paus de carga (derricks)
    for (const [z, boomDir] of [[-42, 1], [35, -1]]) {
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.42, 24, 10), mats.wood);
        mast.position.set(0, 18, z);
        mast.castShadow = true;
        g.add(mast);

        const crossTree = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.18, 0.22), mats.wood);
        crossTree.position.set(0, 23.2, z);
        g.add(crossTree);

        const nest = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.55, 0.95, 12), mats.wood);
        nest.position.set(0, 23.6, z);
        g.add(nest);

        for (const sx of [-0.65, 0.65]) {
            const derrick = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, 11.5, 8), mats.wood);
            derrick.position.set(sx, 11.4, z + boomDir * 4.4);
            derrick.rotation.x = boomDir * 0.92;
            derrick.rotation.z = -sx * 0.18;
            g.add(derrick);
        }
    }

    // Estais e cabos dos mastros
    const riggingMat = new THREE.LineBasicMaterial({ color: 0x302c26, transparent: true, opacity: 0.72 });
    const addRigging = (from, to) => {
        const geo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(...from),
            new THREE.Vector3(...to)
        ]);
        g.add(new THREE.Line(geo, riggingMat));
    };
    addRigging([0, 29, -42], [-B * 0.46, 6.7, -57]);
    addRigging([0, 29, -42], [ B * 0.46, 6.7, -57]);
    addRigging([0, 29, -42], [0, 14.7, -18.5]);
    addRigging([0, 29,  35], [-B * 0.46, 6.7,  52]);
    addRigging([0, 29,  35], [ B * 0.46, 6.7,  52]);
    addRigging([0, 29,  35], [0, 12.0, 8]);

    // Bandeira mercante japonesa na popa
    const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 5.2, 8), mats.wood);
    flagPole.position.set(0, 8.2, L * 0.48);
    flagPole.rotation.x = 0.18;
    const flag = new THREE.Mesh(
        new THREE.PlaneGeometry(2.6, 1.7),
        new THREE.MeshStandardMaterial({ color: 0xf4f0e8, roughness: 0.7, side: THREE.DoubleSide })
    );
    flag.position.set(0, 9.8, L * 0.48 + 1.45);
    flag.rotation.y = Math.PI / 2;
    const sunDisc = new THREE.Mesh(
        new THREE.CircleGeometry(0.45, 16),
        new THREE.MeshStandardMaterial({ color: 0xbc1e24, roughness: 0.7, side: THREE.DoubleSide })
    );
    sunDisc.position.set(0.02, 9.8, L * 0.48 + 1.45);
    sunDisc.rotation.y = Math.PI / 2;
    g.add(flagPole, flag, sunDisc);

    // Amuradas laterais
    for (const side of [-1, 1]) {
        const r = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.95, L * 0.85), mats.steel);
        r.position.set(side * B * 0.48, 6.7, 0);
        g.add(r);
        const cap = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, L * 0.85), mats.wood);
        cap.position.set(side * B * 0.48, 7.2, 0);
        g.add(cap);
    }

    // Vigias em lote no casco
    const portholeGeo = new THREE.CircleGeometry(0.2, 12);
    const portholes = new THREE.InstancedMesh(portholeGeo, mats.funnelBand, 28);
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, 1, 1);
    let pi = 0;
    for (const side of [-1, 1]) {
        quaternion.setFromEuler(new THREE.Euler(0, side * Math.PI / 2, 0));
        for (let i = 0; i < 14; i++) {
            matrix.compose(
                new THREE.Vector3(side * B * 0.492, 4.25, -34 + i * 5.2),
                quaternion,
                scale
            );
            portholes.setMatrixAt(pi++, matrix);
        }
    }
    portholes.instanceMatrix.needsUpdate = true;
    g.add(portholes);

    // Imigrantes esculpidos no convés e passeio olhando para o cais (H02)
    const nPax = quality.id === 'low' ? 16 : 36;
    const paxRandom = seeded(0x19080618);
    const paxShirts = [0xd8d0c0, 0x2c3440, 0x4a525d, 0xc8bfb0, 0x6b3a32, 0x2e4c5c];
    for (let i = 0; i < nPax; i++) {
        const p = createSculptedHuman({
            style: i % 6 === 0 ? 'child' : 'human',
            skin: 0xd8b490,
            hair: 0x1c1612,
            shirt: paxShirts[i % paxShirts.length],
            pants: 0x242830,
            hat: i % 2 === 0 ? 0x2c2824 : (i % 3 === 0 ? 0xd2c4a0 : null),
            detailedFace: false,
            scale: i % 6 === 0 ? 0.78 : 1.0
        });
        const onPromenade = i % 3 === 0;
        const px = onPromenade ? (B * 0.35) : (B * 0.42);
        const py = onPromenade ? 9.6 : 6.4;
        const pz = onPromenade ? (-10 + paxRandom() * 28) : (-34 + paxRandom() * 66);
        p.position.set(px, py, pz);
        p.rotation.y = Math.PI * 0.5 + (paxRandom() - 0.5) * 0.45;
        g.add(p);
    }

    // Âncoras esculpidas de proa
    for (const sx of [-1, 1]) {
        const anchor = makeAnchor(mats);
        anchor.position.set(sx * B * 0.34, 4.2, -L * 0.44);
        anchor.rotation.y = sx * 0.35;
        g.add(anchor);
    }

    g.userData.funnel = funnel;
    g.userData.length = L;
    return g;
}

/** Posição do navio ao longo do filme. */
export function kasatoPose(t) {
    const dockZ = LAYOUT.dockZ;
    const startZ = 280;
    const u = smoothstep(0, 110, t);
    const z = lerp(startZ, dockZ, u);
    const x = lerp(-8, LAYOUT.quayX - 12, smoothstep(40, 105, t));
    const yaw = lerp(0, -0.08, smoothstep(50, 100, t));
    const bob = Math.sin(t * 0.7) * 0.14 * (1 - smoothstep(100, 120, t));
    return { x, y: bob, z, yaw };
}

export function create(ctx) {
    const { scene, mats, quality } = ctx;
    const ship = buildKasato(mats, quality);
    scene.add(ship);

    const wake = new THREE.Mesh(
        new THREE.PlaneGeometry(10, 48),
        new THREE.MeshBasicMaterial({
            color: '#e0ece8',
            transparent: true,
            opacity: 0.28,
            depthWrite: false,
            side: THREE.DoubleSide
        })
    );
    wake.rotation.x = -Math.PI / 2;
    wake.position.y = 0.14;
    scene.add(wake);

    return {
        ship,
        update(t) {
            const p = kasatoPose(t);
            ship.position.set(p.x, p.y, p.z);
            ship.rotation.y = p.yaw;
            const moving = t < 115;
            wake.visible = moving;
            wake.position.set(p.x, 0.14, p.z + 34);
            wake.material.opacity = moving ? 0.25 * (1 - smoothstep(90, 115, t)) : 0;
        },
        dispose() {
            scene.remove(ship);
            scene.remove(wake);
            wake.geometry.dispose();
            wake.material.dispose();
        }
    };
}
