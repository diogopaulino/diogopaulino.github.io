/**
 * kasato — Kasato Maru (K01–K03).
 * ~123,4 × 15,4 m; 1 chaminé; ponte separada; casco preto com faixa de bojo.
 * Posição animada: mar aberto → atracação no armazém 14 (D06).
 */

import * as THREE from 'three';
import { LAYOUT } from '../config.js';
import { smoothstep, lerp } from '../utils.js';

function buildKasato(mats, quality) {
    const g = new THREE.Group();
    g.name = 'kasato-maru';
    const L = LAYOUT.kasatoLength;
    const B = LAYOUT.kasatoBeam;

    // Casco principal (prismático simplificado)
    const hull = new THREE.Mesh(
        new THREE.BoxGeometry(B, 8, L * 0.92),
        mats.hull
    );
    hull.position.y = 2;
    hull.castShadow = true;
    hull.receiveShadow = true;
    g.add(hull);

    // Proa / popa afiladas
    const bow = new THREE.Mesh(new THREE.BoxGeometry(B * 0.85, 7.5, L * 0.12), mats.hull);
    bow.position.set(0, 2.1, -L * 0.48);
    bow.scale.set(1, 1, 1);
    bow.castShadow = true;
    g.add(bow);

    const stern = new THREE.Mesh(new THREE.BoxGeometry(B * 0.9, 7.2, L * 0.1), mats.hull);
    stern.position.set(0, 1.9, L * 0.48);
    g.add(stern);

    // Faixa de bojo (K03 tipológica)
    const boot = new THREE.Mesh(new THREE.BoxGeometry(B + 0.3, 1.4, L * 0.95), mats.hullBoot);
    boot.position.y = -0.8;
    g.add(boot);

    // Convés
    const deck = new THREE.Mesh(new THREE.BoxGeometry(B - 0.6, 0.4, L * 0.88), mats.deck);
    deck.position.y = 6.2;
    deck.receiveShadow = true;
    g.add(deck);

    // Superestrutura central
    const superstructure = new THREE.Mesh(
        new THREE.BoxGeometry(B * 0.72, 5.5, L * 0.28),
        mats.white
    );
    superstructure.position.set(0, 9, 5);
    superstructure.castShadow = true;
    g.add(superstructure);

    // Ponte de comando separada (K03)
    const bridge = new THREE.Mesh(
        new THREE.BoxGeometry(B * 0.85, 3.2, 8),
        mats.white
    );
    bridge.position.set(0, 11.5, -18);
    bridge.castShadow = true;
    g.add(bridge);
    const bridgeRoof = new THREE.Mesh(new THREE.BoxGeometry(B * 0.9, 0.35, 8.5), mats.steel);
    bridgeRoof.position.set(0, 13.2, -18);
    g.add(bridgeRoof);

    // Chaminé única
    const funnel = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 12, 12), mats.funnel);
    funnel.position.set(0, 14, 8);
    funnel.castShadow = true;
    g.add(funnel);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(2.35, 2.35, 1.2, 12), mats.funnelBand);
    band.position.set(0, 16, 8);
    g.add(band);

    // Mastros
    for (const z of [-45, 35]) {
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 22, 6), mats.wood);
        mast.position.set(0, 17, z);
        g.add(mast);
    }

    // Amuradas
    for (const side of [-1, 1]) {
        const r = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.9, L * 0.85), mats.steel);
        r.position.set(side * B * 0.48, 6.7, 0);
        g.add(r);
    }

    // Passageiros no deck (silhuetas — H02)
    const nPax = quality.id === 'low' ? 12 : 28;
    const paxGeo = new THREE.CapsuleGeometry(0.28, 0.9, 3, 6);
    for (let i = 0; i < nPax; i++) {
        const p = new THREE.Mesh(paxGeo, i % 3 === 0 ? mats.cloth : mats.clothLight);
        p.position.set(
            (Math.random() - 0.5) * B * 0.55,
            7.2,
            -30 + Math.random() * 55
        );
        p.castShadow = quality.shadows;
        g.add(p);
    }

    // Âncoras / detalhes de proa
    const anchor = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.5, 0.4), mats.steel);
    anchor.position.set(-B * 0.35, 4, -L * 0.45);
    g.add(anchor);

    g.userData.funnel = funnel;
    g.userData.length = L;
    return g;
}

/** Posição do navio ao longo do filme. */
export function kasatoPose(t) {
    const dockZ = LAYOUT.dockZ;
    const startZ = 280;
    // Aproxima até ~t=110, depois para
    const u = smoothstep(0, 110, t);
    const z = lerp(startZ, dockZ, u);
    const x = lerp(-8, LAYOUT.quayX - 12, smoothstep(40, 105, t));
    const yaw = lerp(0, -0.08, smoothstep(50, 100, t));
    const bob = Math.sin(t * 0.7) * 0.15 * (1 - smoothstep(100, 120, t));
    return { x, y: bob, z, yaw };
}

export function create(ctx) {
    const { scene, mats, quality } = ctx;
    const ship = buildKasato(mats, quality);
    scene.add(ship);

    const wake = new THREE.Mesh(
        new THREE.PlaneGeometry(8, 40),
        new THREE.MeshBasicMaterial({
            color: '#d0ddd8',
            transparent: true,
            opacity: 0.25,
            depthWrite: false,
            side: THREE.DoubleSide
        })
    );
    wake.rotation.x = -Math.PI / 2;
    wake.position.y = 0.15;
    scene.add(wake);

    return {
        ship,
        update(t) {
            const p = kasatoPose(t);
            ship.position.set(p.x, p.y, p.z);
            ship.rotation.y = p.yaw;
            const moving = t < 115;
            wake.visible = moving;
            wake.position.set(p.x, 0.15, p.z + 30);
            wake.material.opacity = moving ? 0.22 * (1 - smoothstep(90, 115, t)) : 0;
        },
        dispose() {
            scene.remove(ship);
            scene.remove(wake);
            wake.geometry.dispose();
            wake.material.dispose();
        }
    };
}
