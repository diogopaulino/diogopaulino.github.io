/**
 * Humanoides procedurais com ossos nomeados + AnimationMixer.
 * Fallbacks apresentáveis para quando o GLB não existe.
 */

import * as THREE from 'three';
import { leatherTexture, clothTexture } from '../world/Textures.js';

const matCache = new Map();

export function std(color, roughness = 0.78, metalness = 0.04, extra = {}) {
    const key = `s:${color}:${roughness}:${metalness}:${JSON.stringify(extra)}`;
    if (!matCache.has(key)) {
        matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra }));
    }
    return matCache.get(key);
}

export function mapped(map, color = 0xffffff, roughness = 0.86, metalness = 0.03) {
    return new THREE.MeshStandardMaterial({ map, color, roughness, metalness });
}

export function enableShadows(root) {
    root.traverse((c) => {
        if (c.isMesh) {
            c.castShadow = true;
            c.receiveShadow = true;
        }
    });
}

function nameBone(obj, name) {
    obj.name = name;
    return obj;
}

function makeClips(parts) {
    const clips = {};
    const mk = (name, duration, channels) => {
        const tracks = channels.map((ch) => {
            const n = 8;
            const times = [];
            const values = [];
            for (let i = 0; i <= n; i++) {
                const t = (i / n) * duration;
                times.push(t);
                values.push(Math.sin((i / n) * Math.PI * 2 + ch.phase) * ch.amp + (ch.base || 0));
            }
            return new THREE.NumberKeyframeTrack(`${ch.target.name}.rotation[${ch.axis}]`, times, values);
        });
        clips[name] = new THREE.AnimationClip(name, duration, tracks);
    };

    mk('Idle', 2.4, [
        { target: parts.chest, axis: 'x', amp: 0.03, phase: 0 },
        { target: parts.head, axis: 'y', amp: 0.04, phase: 1 }
    ]);
    mk('Walk', 0.85, [
        { target: parts.legL, axis: 'x', amp: 0.55, phase: 0 },
        { target: parts.legR, axis: 'x', amp: 0.55, phase: Math.PI },
        { target: parts.armL, axis: 'x', amp: 0.45, phase: Math.PI },
        { target: parts.armR, axis: 'x', amp: 0.45, phase: 0 }
    ]);
    mk('Run', 0.55, [
        { target: parts.legL, axis: 'x', amp: 0.85, phase: 0 },
        { target: parts.legR, axis: 'x', amp: 0.85, phase: Math.PI },
        { target: parts.armL, axis: 'x', amp: 0.7, phase: Math.PI },
        { target: parts.armR, axis: 'x', amp: 0.7, phase: 0 },
        { target: parts.chest, axis: 'z', amp: 0.06, phase: 0 }
    ]);
    mk('Sprint', 0.42, [
        { target: parts.legL, axis: 'x', amp: 1.05, phase: 0 },
        { target: parts.legR, axis: 'x', amp: 1.05, phase: Math.PI },
        { target: parts.armL, axis: 'x', amp: 0.9, phase: Math.PI },
        { target: parts.armR, axis: 'x', amp: 0.9, phase: 0 }
    ]);
    mk('Crouch', 1.2, [
        { target: parts.legL, axis: 'x', amp: 0.12, phase: 0, base: 0.55 },
        { target: parts.legR, axis: 'x', amp: 0.12, phase: Math.PI, base: 0.55 }
    ]);
    mk('Attack', 0.45, [
        { target: parts.armR, axis: 'x', amp: 1.1, phase: 0, base: -0.4 },
        { target: parts.chest, axis: 'y', amp: 0.25, phase: 0 }
    ]);
    mk('Block', 0.8, [
        { target: parts.armL, axis: 'x', amp: 0.05, phase: 0, base: -0.9 }
    ]);
    mk('Interact', 0.9, [
        { target: parts.armR, axis: 'x', amp: 0.4, phase: 0, base: -0.6 }
    ]);
    mk('Jump', 0.6, [
        { target: parts.legL, axis: 'x', amp: 0.2, phase: 0, base: 0.4 },
        { target: parts.legR, axis: 'x', amp: 0.2, phase: 0, base: 0.4 }
    ]);
    return clips;
}

export class CharacterAnimator {
    constructor(root, clips) {
        this.mixer = new THREE.AnimationMixer(root);
        this.actions = {};
        for (const [name, clip] of Object.entries(clips)) {
            const action = this.mixer.clipAction(clip);
            action.enabled = true;
            this.actions[name] = action;
        }
        this.current = null;
        this.currentName = 'Idle';
        this.play('Idle', 0);
    }

    play(name, fade = 0.18) {
        const next = this.actions[name] || this.actions.Idle;
        if (!next || this.current === next) return;
        next.reset();
        next.setEffectiveWeight(1);
        next.play();
        if (this.current) this.current.crossFadeTo(next, fade, false);
        else next.fadeIn(fade);
        this.current = next;
        this.currentName = name;
    }

    update(dt) {
        this.mixer.update(dt);
    }
}

function addEyes(head, skin, sx, color = 0x2a2418) {
    for (const s of [-1, 1]) {
        const white = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), std(0xf4efe6, 0.35));
        white.position.set(s * sx, 0.04, 0.12);
        head.add(white);
        const iris = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), std(color, 0.35));
        iris.position.set(s * sx, 0.04, 0.142);
        head.add(iris);
        const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 5), std(0x111111, 0.2));
        pupil.position.set(s * sx, 0.04, 0.154);
        head.add(pupil);
    }
}

function curlyHair(head, mat, radius, count, yOff = 0.1) {
    for (let i = 0; i < count; i++) {
        const curl = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), mat);
        const a = (i / count) * Math.PI * 2;
        const h = 0.04 + (i % 3) * 0.03;
        curl.position.set(Math.cos(a) * radius, yOff + h, Math.sin(a) * radius * 0.9);
        head.add(curl);
    }
}

/**
 * Ossos compartilhados: hips, spine, chest, head, armL/R, legL/R.
 */
export function buildHumanoid({
    height = 1.8,
    thin = 1,
    skin = 0xe0b089,
    hair = 0x1a120e,
    shirt = 0x4a3a2a,
    pants = 0x2c2418,
    boots = 0x3a2414,
    eye = 0x3a2a18
} = {}) {
    const scale = height / 1.8;
    const group = new THREE.Group();
    const skinM = std(skin, 0.7);
    const shirtM = mapped(clothTexture(), shirt, 0.9);
    const pantsM = mapped(clothTexture(), pants, 0.88);
    const bootM = mapped(leatherTexture(), boots, 0.7, 0.05);
    const hairM = std(hair, 0.92);

    const hips = nameBone(new THREE.Group(), 'hips');
    group.add(hips);

    const legL = nameBone(new THREE.Group(), 'legL');
    const legR = nameBone(new THREE.Group(), 'legR');
    legL.position.set(-0.12 * thin * scale, 0.92 * scale, 0);
    legR.position.set(0.12 * thin * scale, 0.92 * scale, 0);
    hips.add(legL, legR);

    for (const leg of [legL, legR]) {
        const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.07 * thin * scale, 0.06 * thin * scale, 0.46 * scale, 8), pantsM);
        thigh.position.y = -0.23 * scale;
        leg.add(thigh);
        const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.055 * thin * scale, 0.05 * thin * scale, 0.42 * scale, 8), pantsM);
        shin.position.y = -0.66 * scale;
        leg.add(shin);
        const foot = new THREE.Mesh(new THREE.BoxGeometry(0.1 * scale, 0.08 * scale, 0.22 * scale), bootM);
        foot.position.set(0, -0.9 * scale, 0.04 * scale);
        leg.add(foot);
    }

    const spine = nameBone(new THREE.Group(), 'spine');
    spine.position.y = 0.95 * scale;
    hips.add(spine);

    const chest = nameBone(new THREE.Group(), 'chest');
    spine.add(chest);
    const torso = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.2 * thin * scale, 0.42 * scale, 6, 10),
        shirtM
    );
    torso.position.y = 0.28 * scale;
    chest.add(torso);

    const armL = nameBone(new THREE.Group(), 'armL');
    const armR = nameBone(new THREE.Group(), 'armR');
    armL.position.set(-0.26 * thin * scale, 0.42 * scale, 0);
    armR.position.set(0.26 * thin * scale, 0.42 * scale, 0);
    chest.add(armL, armR);
    for (const arm of [armL, armR]) {
        const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * scale, 0.045 * scale, 0.32 * scale, 8), shirtM);
        upper.position.y = -0.16 * scale;
        arm.add(upper);
        const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.042 * scale, 0.038 * scale, 0.3 * scale, 8), skinM);
        fore.position.y = -0.46 * scale;
        arm.add(fore);
        const hand = new THREE.Mesh(new THREE.SphereGeometry(0.045 * scale, 8, 6), skinM);
        hand.position.y = -0.64 * scale;
        arm.add(hand);
        arm.userData.hand = hand;
    }

    const head = nameBone(new THREE.Group(), 'head');
    head.position.y = 0.62 * scale;
    chest.add(head);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.125 * scale, 14, 12), skinM);
    skull.scale.set(0.92, 1.05, 0.95);
    head.add(skull);
    addEyes(head, skinM, 0.045 * scale, eye);

    const parts = { hips, spine, chest, head, armL, armR, legL, legR, group, scale, skinM, hairM };
    const clips = makeClips(parts);
    enableShadows(group);
    group.userData.parts = parts;
    group.userData.clips = clips;
    return { group, parts, clips };
}

export function buildDico() {
    const { group, parts, clips } = buildHumanoid({
        height: 1.9,
        thin: 0.88,
        skin: 0xd9a878,
        hair: 0x1a140f,
        shirt: 0x4a3a2c,
        pants: 0x2a2218,
        boots: 0x3a2416,
        eye: 0x3d4a28
    });

    curlyHair(parts.head, parts.hairM, 0.12, 16, 0.08);
    const bang = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), parts.hairM);
    bang.position.set(0, 0.12, 0.08);
    parts.head.add(bang);

    const mustache = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.015, 0.03), parts.hairM);
    mustache.position.set(0, -0.02, 0.12);
    parts.head.add(mustache);
    const goatee = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), parts.hairM);
    goatee.scale.set(0.7, 1.1, 0.6);
    goatee.position.set(0, -0.08, 0.1);
    parts.head.add(goatee);

    const leather = mapped(leatherTexture(), 0x5a3a22, 0.7, 0.08);
    const vest = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.36, 10), leather);
    vest.position.y = 0.26;
    parts.chest.add(vest);

    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 6, 16), std(0x3a2414, 0.6, 0.15));
    belt.rotation.x = Math.PI / 2;
    belt.position.y = 0.08;
    parts.chest.add(belt);

    const sword = new THREE.Group();
    sword.name = 'sword';
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.72, 0.012), std(0xc5cdd6, 0.25, 0.85));
    blade.position.y = 0.36;
    sword.add(blade);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.03), std(0xb08a3a, 0.35, 0.8));
    sword.add(guard);
    const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.14, 8), std(0x3a2414, 0.7));
    hilt.position.y = -0.08;
    sword.add(hilt);
    sword.position.set(0.02, -0.2, 0.02);
    sword.rotation.z = 0.15;
    parts.armR.userData.hand.add(sword);

    const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.04, 10), mapped(leatherTexture(), 0x6b1c1c, 0.55, 0.2));
    shield.rotation.z = Math.PI / 2;
    shield.position.set(-0.08, -0.15, 0.06);
    parts.armL.add(shield);

    const torch = new THREE.Group();
    torch.visible = false;
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.32, 6), std(0x4a3218, 0.9));
    torch.add(stick);
    const flame = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0xffaa33, emissive: 0xff7711, emissiveIntensity: 2.2 })
    );
    flame.position.y = 0.2;
    torch.add(flame);
    torch.position.set(0.05, -0.2, 0.05);
    parts.armL.userData.hand.add(torch);
    parts.torch = torch;
    parts.torchFlame = flame;
    parts.sword = sword;
    parts.shield = shield;

    enableShadows(group);
    return { group, parts, clips };
}

export function buildRavi() {
    const { group, parts, clips } = buildHumanoid({
        height: 1.05,
        thin: 0.95,
        skin: 0xe8c49a,
        hair: 0xd8c48a,
        shirt: 0x3a5a8a,
        pants: 0x4a3a28,
        boots: 0x5a3a22,
        eye: 0x4a6a8a
    });
    curlyHair(parts.head, std(0xe8d4a0, 0.9), 0.08, 14, 0.06);
    const blanket = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.08, 0.7), std(0x6a2a2a, 0.92));
    blanket.position.set(0, 0.4, 0.05);
    blanket.visible = true;
    group.add(blanket);
    parts.blanket = blanket;
    return { group, parts, clips };
}

export function buildCamila() {
    const { group, parts, clips } = buildHumanoid({
        height: 1.68,
        thin: 0.9,
        skin: 0xf0c8a8,
        hair: 0xe8d48a,
        shirt: 0xc9b8d4,
        pants: 0x8a6a9a,
        boots: 0x5a3a44,
        eye: 0x4a6a8a
    });
    const hairM = std(0xe8d48a, 0.55);
    const hair = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.35, 6, 10), hairM);
    hair.position.set(0, 0.02, -0.04);
    parts.head.add(hair);
    const bangs = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.08), hairM);
    bangs.position.set(0, 0.1, 0.1);
    parts.head.add(bangs);
    const dress = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.7, 10), std(0xc9b8d4, 0.88));
    dress.position.y = 0.55;
    parts.hips.add(dress);
    const shackles = new THREE.Group();
    const left = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 12), std(0x888888, 0.4, 0.8));
    left.position.set(-0.12, 0.9, 0.12);
    const right = left.clone();
    right.position.x = 0.12;
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.24, 6), std(0x777777, 0.4, 0.8));
    chain.rotation.z = Math.PI / 2;
    chain.position.set(0, 0.9, 0.12);
    shackles.add(left, right, chain);
    parts.hips.add(shackles);
    parts.shackles = shackles;
    return { group, parts, clips };
}

export function buildGuard({ fat = false, archer = false } = {}) {
    const { group, parts, clips } = buildHumanoid({
        height: fat ? 1.7 : 1.82,
        thin: fat ? 1.35 : 1.08,
        skin: 0xd2a07a,
        hair: 0x3a2a18,
        shirt: 0x4a4a3a,
        pants: 0x2a2a22,
        boots: 0x3a2a18,
        eye: 0x2a2a18
    });
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.58), std(0x8a8a82, 0.35, 0.7));
    helm.position.y = 0.04;
    parts.head.add(helm);
    const tunic = new THREE.Mesh(
        new THREE.CylinderGeometry(fat ? 0.32 : 0.22, fat ? 0.28 : 0.2, 0.5, 10),
        std(0x5a1c1c, 0.85)
    );
    tunic.position.y = 0.22;
    parts.chest.add(tunic);
    if (fat) {
        const belly = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), std(0x5a1c1c, 0.88));
        belly.position.y = 0.12;
        parts.chest.add(belly);
    }
    const spear = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.6, 6), std(0x5a3a18, 0.8));
    spear.add(shaft);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.16, 6), std(0xb0b8c0, 0.3, 0.8));
    tip.position.y = 0.86;
    spear.add(tip);
    spear.position.set(0.05, -0.2, 0.1);
    parts.armR.userData.hand.add(spear);
    if (archer) {
        spear.visible = false;
        const bow = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.018, 6, 16, Math.PI), std(0x5a3a18, 0.7));
        bow.rotation.y = Math.PI / 2;
        parts.armL.add(bow);
    }
    const keys = new THREE.Group();
    for (let i = 0; i < 3; i++) {
        const k = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.02), std(0xc9a227, 0.4, 0.7));
        k.position.set(0.08, 0.7 + i * 0.02, 0.14);
        k.rotation.z = 0.3 * i;
        keys.add(k);
    }
    keys.visible = fat;
    parts.hips.add(keys);
    parts.keys = keys;
    parts.spear = spear;
    return { group, parts, clips };
}

export function buildFriend(variant = 0) {
    const palettes = [
        { shirt: 0x3a4a3a, pants: 0x2a2218, hair: 0x3a2414 },
        { shirt: 0x3a3a5a, pants: 0x2a2a22, hair: 0x1a1a12 },
        { shirt: 0x5a3a2a, pants: 0x3a2a18, hair: 0x6a4a22 }
    ];
    const p = palettes[variant % 3];
    const built = buildHumanoid({
        height: 1.78 + variant * 0.04,
        thin: 1,
        shirt: p.shirt,
        pants: p.pants,
        hair: p.hair
    });
    curlyHair(built.parts.head, std(p.hair, 0.9), 0.11, 10, 0.08);
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.32, 0.16), mapped(leatherTexture(), 0x4a3218, 0.8));
    pack.position.set(0, 0.28, -0.22);
    built.parts.chest.add(pack);
    return built;
}

export function buildTeco() {
    const group = new THREE.Group();
    const fur = std(0x6a4a2a, 0.9);
    const dark = std(0x3a2a18, 0.88);
    const face = std(0xe0b090, 0.65);

    const hips = nameBone(new THREE.Group(), 'hips');
    group.add(hips);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), fur);
    body.scale.set(0.9, 1.15, 0.8);
    body.position.y = 0.22;
    hips.add(body);

    const chest = nameBone(new THREE.Group(), 'chest');
    chest.position.y = 0.28;
    hips.add(chest);

    const head = nameBone(new THREE.Group(), 'head');
    head.position.y = 0.16;
    chest.add(head);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), fur);
    head.add(skull);
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), face);
    muzzle.scale.set(1, 0.8, 1.2);
    muzzle.position.set(0, -0.02, 0.07);
    head.add(muzzle);
    addEyes(head, face, 0.03, 0x221808);
    for (const s of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), fur);
        ear.position.set(s * 0.08, 0.06, 0);
        head.add(ear);
    }

    const armL = nameBone(new THREE.Group(), 'armL');
    const armR = nameBone(new THREE.Group(), 'armR');
    armL.position.set(-0.12, 0.06, 0);
    armR.position.set(0.12, 0.06, 0);
    chest.add(armL, armR);
    for (const arm of [armL, armR]) {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.22, 6), fur);
        m.position.y = -0.1;
        arm.add(m);
        const hand = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 5), dark);
        hand.position.y = -0.22;
        arm.add(hand);
        arm.userData.hand = hand;
    }

    const legL = nameBone(new THREE.Group(), 'legL');
    const legR = nameBone(new THREE.Group(), 'legR');
    legL.position.set(-0.06, 0.12, 0);
    legR.position.set(0.06, 0.12, 0);
    hips.add(legL, legR);
    for (const leg of [legL, legR]) {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.022, 0.18, 6), fur);
        m.position.y = -0.08;
        leg.add(m);
        const foot = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 5), dark);
        foot.scale.set(1, 0.6, 1.4);
        foot.position.set(0, -0.18, 0.02);
        leg.add(foot);
    }

    const tail = nameBone(new THREE.Group(), 'tail');
    tail.position.set(0, 0.16, -0.1);
    hips.add(tail);
    const tailM = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.01, 0.32, 6), fur);
    tailM.rotation.x = 0.9;
    tailM.position.set(0, 0.05, -0.12);
    tail.add(tailM);

    const parts = { hips, chest, head, armL, armR, legL, legR, tail, group };
    const clips = makeClips(parts);
    const extra = [
        new THREE.NumberKeyframeTrack('tail.rotation[1]', [0, 0.4, 0.8], [0.4, -0.4, 0.4])
    ];
    clips.Climb = new THREE.AnimationClip('Climb', 0.6, [
        new THREE.NumberKeyframeTrack('armL.rotation[0]', [0, 0.3, 0.6], [0.8, -0.8, 0.8]),
        new THREE.NumberKeyframeTrack('armR.rotation[0]', [0, 0.3, 0.6], [-0.8, 0.8, -0.8]),
        new THREE.NumberKeyframeTrack('legL.rotation[0]', [0, 0.3, 0.6], [-0.5, 0.5, -0.5])
    ]);
    clips.Grab = new THREE.AnimationClip('Grab', 0.5, extra);
    clips.Shoulder = clips.Idle;
    clips.Scared = new THREE.AnimationClip('Scared', 0.4, [
        new THREE.NumberKeyframeTrack('head.rotation[0]', [0, 0.2, 0.4], [0.2, -0.1, 0.2])
    ]);
    clips.Celebrate = new THREE.AnimationClip('Celebrate', 0.6, [
        new THREE.NumberKeyframeTrack('armL.rotation[0]', [0, 0.3, 0.6], [-1.2, -0.2, -1.2]),
        new THREE.NumberKeyframeTrack('armR.rotation[0]', [0, 0.3, 0.6], [-0.2, -1.2, -0.2])
    ]);
    enableShadows(group);
    group.userData.parts = parts;
    group.userData.clips = clips;
    return { group, parts, clips };
}

export function buildTiger() {
    const group = new THREE.Group();
    const orange = std(0xc45a18, 0.75);
    const white = std(0xeee6d6, 0.8);
    const black = std(0x1a120c, 0.85);

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 1.15, 8, 12), orange);
    body.rotation.z = Math.PI / 2;
    body.position.set(0, 0.55, 0);
    group.add(body);

    const belly = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.9, 6, 10), white);
    belly.rotation.z = Math.PI / 2;
    belly.position.set(0, 0.38, 0.05);
    group.add(belly);

    const head = nameBone(new THREE.Group(), 'head');
    head.position.set(0.85, 0.62, 0);
    group.add(head);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), orange);
    skull.scale.set(1.15, 0.9, 0.85);
    head.add(skull);
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), white);
    muzzle.position.set(0.18, -0.04, 0);
    head.add(muzzle);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), black);
    nose.position.set(0.3, 0.02, 0);
    head.add(nose);
    for (const s of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.12, 6), orange);
        ear.position.set(-0.05, 0.24, s * 0.14);
        head.add(ear);
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), std(0x1a3a08, 0.3));
        eye.position.set(0.16, 0.08, s * 0.12);
        head.add(eye);
    }

    for (const [x, z] of [[-0.35, 0.22], [-0.35, -0.22], [0.35, 0.22], [0.35, -0.22]]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.45, 8), orange);
        leg.position.set(x, 0.22, z);
        group.add(leg);
        const paw = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), black);
        paw.scale.set(1, 0.5, 1.2);
        paw.position.set(x, 0.04, z);
        group.add(paw);
    }

    const tail = nameBone(new THREE.Group(), 'tail');
    tail.position.set(-0.75, 0.7, 0);
    group.add(tail);
    const tailM = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.03, 0.9, 6), orange);
    tailM.rotation.z = 0.8;
    tailM.position.set(-0.25, 0.2, 0);
    tail.add(tailM);

    for (let i = 0; i < 12; i++) {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.55), black);
        stripe.position.set(-0.4 + i * 0.12, 0.62, 0);
        stripe.rotation.y = 0.15;
        group.add(stripe);
    }

    const parts = { head, tail, group };
    const clips = {
        Idle: new THREE.AnimationClip('Idle', 2, [
            new THREE.NumberKeyframeTrack('head.rotation[1]', [0, 1, 2], [0.1, -0.1, 0.1])
        ]),
        Walk: new THREE.AnimationClip('Walk', 0.8, [
            new THREE.NumberKeyframeTrack('head.rotation[0]', [0, 0.4, 0.8], [0.05, -0.05, 0.05])
        ]),
        Growl: new THREE.AnimationClip('Growl', 0.6, [
            new THREE.NumberKeyframeTrack('head.rotation[0]', [0, 0.3, 0.6], [0, -0.25, 0])
        ]),
        Jump: new THREE.AnimationClip('Jump', 0.5, [
            new THREE.NumberKeyframeTrack('head.rotation[0]', [0, 0.25, 0.5], [-0.2, 0.3, -0.2])
        ])
    };
    enableShadows(group);
    group.userData.parts = parts;
    group.userData.clips = clips;
    return { group, parts, clips };
}

export function applyLocomotion(animator, speed, crouch, grounded, attacking, blocking, interacting) {
    if (attacking) animator.play('Attack', 0.08);
    else if (blocking) animator.play('Block', 0.1);
    else if (interacting) animator.play('Interact', 0.1);
    else if (!grounded) animator.play('Jump', 0.08);
    else if (crouch) animator.play(speed > 0.15 ? 'Walk' : 'Crouch', 0.15);
    else if (speed > 5.4) animator.play('Sprint', 0.12);
    else if (speed > 3.2) animator.play('Run', 0.12);
    else if (speed > 0.2) animator.play('Walk', 0.14);
    else animator.play('Idle', 0.2);
}
