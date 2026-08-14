/**
 * Primitivas e materiais do boneco vinil.
 * Tudo é MeshStandardMaterial — look de figura colecionável.
 */

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { LAYOUT } from './config.js';

export function vinyl(color, extra = {}) {
    return new THREE.MeshStandardMaterial({
        color,
        roughness: extra.roughness ?? 0.42,
        metalness: extra.metalness ?? 0.08,
        emissive: extra.emissive ?? 0x000000,
        emissiveIntensity: extra.emissiveIntensity ?? 0,
        transparent: extra.transparent ?? false,
        opacity: extra.opacity ?? 1,
        side: extra.side ?? THREE.FrontSide,
        ...('map' in extra ? { map: extra.map } : {})
    });
}

export function glass(color = 0x88c8e8) {
    return new THREE.MeshPhysicalMaterial({
        color,
        roughness: 0.06,
        metalness: 0.12,
        transmission: 0.72,
        thickness: 0.35,
        transparent: true,
        opacity: 0.55,
        clearcoat: 1,
        clearcoatRoughness: 0.08
    });
}

export function makePalette(kit) {
    const c = kit.colors;
    return {
        skin: vinyl(kit.skin, { roughness: 0.55 }),
        primary: vinyl(c.primary),
        secondary: vinyl(c.secondary),
        accent: vinyl(c.accent, { metalness: 0.55, roughness: 0.28 }),
        cloth: vinyl(c.cloth, { roughness: 0.62 }),
        trim: vinyl(c.trim),
        iris: vinyl(kit.iris, { roughness: 0.3 }),
        white: vinyl(0xf6f3ee, { roughness: 0.35 }),
        dark: vinyl(0x1a1a22, { roughness: 0.4 }),
        gum: vinyl(0xd47878, { roughness: 0.5 }),
        glow: vinyl(c.accent, {
            roughness: 0.25,
            metalness: 0.2,
            emissive: c.accent,
            emissiveIntensity: 0.55
        })
    };
}

/**
 * Contexto de montagem: um Group + helpers que já parentam e projetam sombra.
 */
export function makeCtx(kit) {
    const group = new THREE.Group();
    const mats = makePalette(kit);
    const add = makeAdd(group);
    return { group, mats, kit, add, L: LAYOUT };
}

export function makeAdd(parent) {
    const add = {
        mesh(geo, mat, pos, rot, scale) {
            const m = new THREE.Mesh(geo, mat);
            m.castShadow = true;
            m.receiveShadow = true;
            if (pos) m.position.set(pos[0], pos[1], pos[2]);
            if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
            if (scale) m.scale.set(scale[0], scale[1], scale[2]);
            parent.add(m);
            return m;
        },
        sphere(r, mat, pos, rot, scale, seg = 24) {
            return add.mesh(new THREE.SphereGeometry(r, seg, seg), mat, pos, rot, scale);
        },
        box(w, h, d, mat, pos, rot, scale, r = 0.04) {
            return add.mesh(new RoundedBoxGeometry(w, h, d, 3, r), mat, pos, rot, scale);
        },
        cyl(rt, rb, h, mat, pos, rot, scale, seg = 20) {
            const geo = new THREE.CylinderGeometry(rt, rb, h, seg);
            return add.mesh(geo, mat, pos, rot, scale);
        },
        cap(r, len, mat, pos, rot, scale) {
            return add.mesh(new THREE.CapsuleGeometry(r, len, 6, 12), mat, pos, rot, scale);
        },
        torus(r, t, mat, pos, rot, scale, radial = 12, tubular = 20) {
            return add.mesh(new THREE.TorusGeometry(r, t, radial, tubular), mat, pos, rot, scale);
        },
        cone(r, h, mat, pos, rot, scale, seg = 16) {
            return add.mesh(new THREE.ConeGeometry(r, h, seg), mat, pos, rot, scale);
        },
        group(pos) {
            const g = new THREE.Group();
            if (pos) g.position.set(pos[0], pos[1], pos[2]);
            parent.add(g);
            return g;
        }
    };
    return add;
}

/** Rosto padrão: olhos, pálpebras (pisca) e nariz. */
export function addFace(ctx, { iris = ctx.mats.iris, smile = true, mask = false } = {}) {
    const { add, mats, group } = ctx;
    const eyeZ = 0.24;
    const eyeX = 0.09;
    const eyeY = 0.04;

    if (!mask) {
        add.sphere(0.055, mats.white, [-eyeX, eyeY, eyeZ], null, [1, 1.05, 0.7]);
        add.sphere(0.055, mats.white, [eyeX, eyeY, eyeZ], null, [1, 1.05, 0.7]);
        add.sphere(0.028, iris, [-eyeX, eyeY, eyeZ + 0.03]);
        add.sphere(0.028, iris, [eyeX, eyeY, eyeZ + 0.03]);
        add.sphere(0.012, mats.dark, [-eyeX + 0.006, eyeY + 0.004, eyeZ + 0.05]);
        add.sphere(0.012, mats.dark, [eyeX + 0.006, eyeY + 0.004, eyeZ + 0.05]);
        add.sphere(0.018, mats.skin, [0, -0.02, 0.28], null, [0.7, 0.55, 0.7]);
        if (smile) {
            add.torus(0.07, 0.01, mats.gum, [0, -0.12, 0.25], [0.5, 0, 0], [1, 0.45, 1]);
        }
    }

    const lids = new THREE.Group();
    const lidMat = mats.skin;
    const lidL = new THREE.Mesh(new THREE.SphereGeometry(0.058, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), lidMat);
    const lidR = lidL.clone();
    lidL.rotation.x = Math.PI;
    lidR.rotation.x = Math.PI;
    lidL.position.set(-eyeX, eyeY + 0.02, eyeZ + 0.01);
    lidR.position.set(eyeX, eyeY + 0.02, eyeZ + 0.01);
    lidL.scale.set(1, 0.12, 0.85);
    lidR.scale.set(1, 0.12, 0.85);
    lids.add(lidL, lidR);
    group.add(lids);
    group.userData.lids = [lidL, lidR];
    return lids;
}

/**
 * Corpo vestido genérico. Kits acrescentam detalhes por cima.
 * Braços e pernas compartilham o mesmo encaixe (LAYOUT).
 */
export function clothedBody(ctx, opts = {}) {
    const { add, mats, group, L } = ctx;
    if (opts.skipBase) return group;
    const torsoC = opts.torso ?? mats.cloth;
    const pelvisC = opts.pelvis ?? mats.primary;
    const legC = opts.leg ?? mats.secondary;
    const armC = opts.arm ?? torsoC;
    const bootC = opts.boot ?? mats.dark;
    const neckC = opts.neck ?? mats.skin;

    add.cyl(0.08, 0.09, 0.12, neckC, [0, L.NECK_Y - 0.02, 0]);
    add.box(0.52, 0.58, 0.36, torsoC, [0, L.CHEST_Y, 0], null, null, 0.08);
    add.box(0.46, 0.22, 0.34, pelvisC, [0, L.HIP_Y, 0], null, null, 0.06);

    // pernas
    add.cap(0.09, 0.28, legC, [-0.12, 0.28, 0]);
    add.cap(0.09, 0.28, legC, [0.12, 0.28, 0]);
    add.box(0.16, 0.12, 0.24, bootC, [-0.12, 0.06, 0.02], null, null, 0.04);
    add.box(0.16, 0.12, 0.24, bootC, [0.12, 0.06, 0.02], null, null, 0.04);

    // braços
    const armL = add.cap(0.075, 0.36, armC, [-L.SHOULDER_X, 0.82, 0.02], [0, 0, 0.28]);
    const armR = add.cap(0.075, 0.36, armC, [L.SHOULDER_X, 0.82, 0.02], [0, 0, -0.28]);
    add.sphere(0.09, opts.hand ?? mats.skin, [-0.46, 0.58, 0.06]);
    add.sphere(0.09, opts.hand ?? mats.skin, [0.46, 0.58, 0.06]);

    group.userData.arms = [armL, armR];
    group.userData.wings = opts.wings || null;
    return group;
}

export function tagSlot(group, slot) {
    group.userData.slot = slot;
    group.traverse((c) => {
        c.userData.slot = slot;
    });
    return group;
}
