/**
 * Humanoides e animais procedurais estilizados em Babylon.js com hierarquia de nós e animador procedural.
 */

import { leatherTexture, clothTexture } from '../world/Textures.js';
import { angleLerp, damp } from '../utils/math.js';

export class CharacterAnimator {
    constructor(root, clips) {
        this.root = root;
        this.clips = clips || {};
        this.currentName = 'Idle';
        this.targetName = 'Idle';
        this.time = 0;
        this.transitionTime = 0;
        this.transitionDuration = 0.15;
        this.prevClip = null;
        this.currentClip = this.clips.Idle || null;
    }

    play(name, fade = 0.15) {
        if (this.targetName === name) return;
        if (!this.clips[name]) return;
        this.prevClip = this.currentClip;
        this.targetName = name;
        this.currentClip = this.clips[name];
        this.transitionTime = 0;
        this.transitionDuration = Math.max(0.01, fade);
    }

    update(dt) {
        this.time += dt;
        this.transitionTime += dt;
        const blend = Math.min(1, this.transitionTime / this.transitionDuration);

        if (this.currentClip) {
            const curPose = this.currentClip.sample(this.time);
            if (blend < 1 && this.prevClip) {
                const prevPose = this.prevClip.sample(this.time);
                for (const nodeName of Object.keys(curPose)) {
                    const node = this.root.userData?.parts?.[nodeName];
                    if (node && node.rotation) {
                        const p = prevPose[nodeName] || { x: 0, y: 0, z: 0 };
                        const c = curPose[nodeName];
                        node.rotation.x = angleLerp(p.x || 0, c.x || 0, blend);
                        node.rotation.y = angleLerp(p.y || 0, c.y || 0, blend);
                        node.rotation.z = angleLerp(p.z || 0, c.z || 0, blend);
                    }
                }
            } else {
                for (const nodeName of Object.keys(curPose)) {
                    const node = this.root.userData?.parts?.[nodeName];
                    if (node && node.rotation) {
                        const c = curPose[nodeName];
                        if (c.x !== undefined) node.rotation.x = c.x;
                        if (c.y !== undefined) node.rotation.y = c.y;
                        if (c.z !== undefined) node.rotation.z = c.z;
                    }
                }
            }
        }
    }
}

class ProceduralClip {
    constructor(duration, channels) {
        this.duration = duration;
        this.channels = channels; // array of { target, axis, amp, phase, base }
    }

    sample(time) {
        const pose = {};
        const t = (time % this.duration) / this.duration;
        for (const ch of this.channels) {
            if (!pose[ch.target]) pose[ch.target] = {};
            const val = Math.sin(t * Math.PI * 2 + (ch.phase || 0)) * ch.amp + (ch.base || 0);
            pose[ch.target][ch.axis] = val;
        }
        return pose;
    }
}

function makeHumanoidClips() {
    return {
        Idle: new ProceduralClip(2.4, [
            { target: 'chest', axis: 'x', amp: 0.03, phase: 0 },
            { target: 'head', axis: 'y', amp: 0.04, phase: 1 }
        ]),
        Walk: new ProceduralClip(0.85, [
            { target: 'legL', axis: 'x', amp: 0.55, phase: 0 },
            { target: 'legR', axis: 'x', amp: 0.55, phase: Math.PI },
            { target: 'armL', axis: 'x', amp: 0.45, phase: Math.PI },
            { target: 'armR', axis: 'x', amp: 0.45, phase: 0 }
        ]),
        Run: new ProceduralClip(0.55, [
            { target: 'legL', axis: 'x', amp: 0.85, phase: 0 },
            { target: 'legR', axis: 'x', amp: 0.85, phase: Math.PI },
            { target: 'armL', axis: 'x', amp: 0.7, phase: Math.PI },
            { target: 'armR', axis: 'x', amp: 0.7, phase: 0 },
            { target: 'chest', axis: 'z', amp: 0.06, phase: 0 }
        ]),
        Sprint: new ProceduralClip(0.42, [
            { target: 'legL', axis: 'x', amp: 1.05, phase: 0 },
            { target: 'legR', axis: 'x', amp: 1.05, phase: Math.PI },
            { target: 'armL', axis: 'x', amp: 0.9, phase: Math.PI },
            { target: 'armR', axis: 'x', amp: 0.9, phase: 0 }
        ]),
        Crouch: new ProceduralClip(1.2, [
            { target: 'legL', axis: 'x', amp: 0.12, phase: 0, base: 0.55 },
            { target: 'legR', axis: 'x', amp: 0.12, phase: Math.PI, base: 0.55 }
        ]),
        Attack: new ProceduralClip(0.45, [
            { target: 'armR', axis: 'x', amp: 1.1, phase: 0, base: -0.4 },
            { target: 'chest', axis: 'y', amp: 0.25, phase: 0 }
        ]),
        Block: new ProceduralClip(0.8, [
            { target: 'armL', axis: 'x', amp: 0.05, phase: 0, base: -0.9 }
        ]),
        Interact: new ProceduralClip(0.9, [
            { target: 'armR', axis: 'x', amp: 0.4, phase: 0, base: -0.6 }
        ]),
        Jump: new ProceduralClip(0.6, [
            { target: 'legL', axis: 'x', amp: 0.2, phase: 0, base: 0.4 },
            { target: 'legR', axis: 'x', amp: 0.2, phase: 0, base: 0.4 }
        ])
    };
}

export function buildHumanoid({
    scene,
    height = 1.8,
    thin = 1,
    skinColor = new BABYLON.Color3(0.88, 0.7, 0.55),
    hairColor = new BABYLON.Color3(0.12, 0.08, 0.05),
    shirtColor = new BABYLON.Color3(0.3, 0.22, 0.16),
    pantsColor = new BABYLON.Color3(0.18, 0.15, 0.1),
    bootColor = new BABYLON.Color3(0.24, 0.16, 0.1)
} = {}) {
    const scale = height / 1.8;
    const root = new BABYLON.TransformNode('humanoidRoot', scene);

    const skinMat = new BABYLON.StandardMaterial('skinMat', scene);
    skinMat.diffuseColor = skinColor;
    skinMat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);

    const hairMat = new BABYLON.StandardMaterial('hairMat', scene);
    hairMat.diffuseColor = hairColor;

    const shirtMat = new BABYLON.StandardMaterial('shirtMat', scene);
    shirtMat.diffuseColor = shirtColor;

    const pantsMat = new BABYLON.StandardMaterial('pantsMat', scene);
    pantsMat.diffuseColor = pantsColor;

    const bootMat = new BABYLON.StandardMaterial('bootMat', scene);
    bootMat.diffuseColor = bootColor;

    // Hips
    const hips = new BABYLON.TransformNode('hips', scene);
    hips.parent = root;

    // Legs
    const legL = new BABYLON.TransformNode('legL', scene);
    const legR = new BABYLON.TransformNode('legR', scene);
    legL.position.set(-0.12 * thin * scale, 0.92 * scale, 0);
    legR.position.set(0.12 * thin * scale, 0.92 * scale, 0);
    legL.parent = hips;
    legR.parent = hips;

    for (const leg of [legL, legR]) {
        const thigh = BABYLON.MeshBuilder.CreateCylinder('thigh', {
            diameterTop: 0.14 * thin * scale,
            diameterBottom: 0.12 * thin * scale,
            height: 0.46 * scale,
            tessellation: 8
        }, scene);
        thigh.position.y = -0.23 * scale;
        thigh.material = pantsMat;
        thigh.parent = leg;

        const shin = BABYLON.MeshBuilder.CreateCylinder('shin', {
            diameterTop: 0.11 * thin * scale,
            diameterBottom: 0.1 * thin * scale,
            height: 0.42 * scale,
            tessellation: 8
        }, scene);
        shin.position.y = -0.66 * scale;
        shin.material = pantsMat;
        shin.parent = leg;

        const foot = BABYLON.MeshBuilder.CreateBox('foot', {
            width: 0.1 * scale,
            height: 0.08 * scale,
            depth: 0.22 * scale
        }, scene);
        foot.position.set(0, -0.9 * scale, 0.04 * scale);
        foot.material = bootMat;
        foot.parent = leg;
    }

    // Spine & Chest
    const spine = new BABYLON.TransformNode('spine', scene);
    spine.position.y = 0.95 * scale;
    spine.parent = hips;

    const chest = new BABYLON.TransformNode('chest', scene);
    chest.parent = spine;

    const torso = BABYLON.MeshBuilder.CreateCapsule('torso', {
        radius: 0.16 * thin * scale,
        height: 0.58 * scale,
        tessellation: 8
    }, scene);
    torso.position.y = 0.28 * scale;
    torso.material = shirtMat;
    torso.parent = chest;

    // Arms
    const armL = new BABYLON.TransformNode('armL', scene);
    const armR = new BABYLON.TransformNode('armR', scene);
    armL.position.set(-0.26 * thin * scale, 0.42 * scale, 0);
    armR.position.set(0.26 * thin * scale, 0.42 * scale, 0);
    armL.parent = chest;
    armR.parent = chest;

    for (const arm of [armL, armR]) {
        const upper = BABYLON.MeshBuilder.CreateCylinder('armUpper', {
            diameterTop: 0.1 * scale,
            diameterBottom: 0.09 * scale,
            height: 0.32 * scale,
            tessellation: 8
        }, scene);
        upper.position.y = -0.16 * scale;
        upper.material = shirtMat;
        upper.parent = arm;

        const fore = BABYLON.MeshBuilder.CreateCylinder('armFore', {
            diameterTop: 0.084 * scale,
            diameterBottom: 0.076 * scale,
            height: 0.3 * scale,
            tessellation: 8
        }, scene);
        fore.position.y = -0.46 * scale;
        fore.material = skinMat;
        fore.parent = arm;

        const hand = BABYLON.MeshBuilder.CreateSphere('hand', {
            diameter: 0.09 * scale,
            segments: 6
        }, scene);
        hand.position.y = -0.64 * scale;
        hand.material = skinMat;
        hand.parent = arm;
        arm.userData = { hand };
    }

    // Head
    const head = new BABYLON.TransformNode('head', scene);
    head.position.y = 0.62 * scale;
    head.parent = chest;

    const skull = BABYLON.MeshBuilder.CreateSphere('skull', {
        diameter: 0.25 * scale,
        segments: 10
    }, scene);
    skull.scaling.set(0.92, 1.05, 0.95);
    skull.material = skinMat;
    skull.parent = head;

    // Olhos
    for (const s of [-1, 1]) {
        const eye = BABYLON.MeshBuilder.CreateSphere('eye', { diameter: 0.04 * scale, segments: 6 }, scene);
        eye.position.set(s * 0.045 * scale, 0.04 * scale, 0.11 * scale);
        const eyeMat = new BABYLON.StandardMaterial('eyeMat', scene);
        eyeMat.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.1);
        eye.material = eyeMat;
        eye.parent = head;
    }

    const parts = { hips, spine, chest, head, armL, armR, legL, legR, root, skinMat, hairMat };
    const clips = makeHumanoidClips();
    root.userData = { parts, clips };

    return { root, parts, clips };
}

export function buildDico(scene) {
    const built = buildHumanoid({
        scene,
        height: 1.9,
        thin: 0.88,
        skinColor: new BABYLON.Color3(0.85, 0.66, 0.48),
        hairColor: new BABYLON.Color3(0.1, 0.08, 0.06),
        shirtColor: new BABYLON.Color3(0.3, 0.23, 0.17),
        pantsColor: new BABYLON.Color3(0.16, 0.13, 0.1),
        bootColor: new BABYLON.Color3(0.22, 0.14, 0.09)
    });

    const parts = built.parts;

    // Cabelo crespo e barba
    const hairCluster = new BABYLON.TransformNode('dicoHair', scene);
    hairCluster.parent = parts.head;
    for (let i = 0; i < 16; i++) {
        const curl = BABYLON.MeshBuilder.CreateSphere(`curl_${i}`, { diameter: 0.09, segments: 6 }, scene);
        const a = (i / 16) * Math.PI * 2;
        curl.position.set(Math.cos(a) * 0.12, 0.1 + (i % 3) * 0.03, Math.sin(a) * 0.11);
        curl.material = parts.hairMat;
        curl.parent = hairCluster;
    }

    const mustache = BABYLON.MeshBuilder.CreateBox('mustache', { width: 0.09, height: 0.015, depth: 0.03 }, scene);
    mustache.position.set(0, -0.02, 0.12);
    mustache.material = parts.hairMat;
    mustache.parent = parts.head;

    const goatee = BABYLON.MeshBuilder.CreateSphere('goatee', { diameter: 0.06, segments: 6 }, scene);
    goatee.position.set(0, -0.08, 0.1);
    goatee.material = parts.hairMat;
    goatee.parent = parts.head;

    // Colete de couro
    const vest = BABYLON.MeshBuilder.CreateCylinder('vest', {
        diameterTop: 0.4,
        diameterBottom: 0.44,
        height: 0.36,
        tessellation: 10
    }, scene);
    vest.position.y = 0.26;
    const vestMat = new BABYLON.StandardMaterial('vestMat', scene);
    vestMat.diffuseColor = new BABYLON.Color3(0.35, 0.22, 0.13);
    vest.material = vestMat;
    vest.parent = parts.chest;

    // Espada na mão direita
    const sword = new BABYLON.TransformNode('swordRoot', scene);
    sword.parent = parts.armR.userData.hand;
    sword.position.set(0.02, -0.2, 0.02);
    sword.rotation.z = 0.15;

    const blade = BABYLON.MeshBuilder.CreateBox('swordBlade', { width: 0.04, height: 0.72, depth: 0.012 }, scene);
    blade.position.y = 0.36;
    const bladeMat = new BABYLON.StandardMaterial('bladeMat', scene);
    bladeMat.diffuseColor = new BABYLON.Color3(0.78, 0.82, 0.86);
    bladeMat.specularColor = new BABYLON.Color3(0.9, 0.9, 0.9);
    blade.material = bladeMat;
    blade.parent = sword;

    const guard = BABYLON.MeshBuilder.CreateBox('swordGuard', { width: 0.16, height: 0.03, depth: 0.03 }, scene);
    const goldMat = new BABYLON.StandardMaterial('goldMat', scene);
    goldMat.diffuseColor = new BABYLON.Color3(0.7, 0.55, 0.2);
    guard.material = goldMat;
    guard.parent = sword;

    const hilt = BABYLON.MeshBuilder.CreateCylinder('swordHilt', { diameter: 0.04, height: 0.14 }, scene);
    hilt.position.y = -0.08;
    const hiltMat = new BABYLON.StandardMaterial('hiltMat', scene);
    hiltMat.diffuseColor = new BABYLON.Color3(0.2, 0.12, 0.08);
    hilt.material = hiltMat;
    hilt.parent = sword;

    // Escudo no braço esquerdo
    const shield = BABYLON.MeshBuilder.CreateCylinder('shield', {
        diameter: 0.38,
        height: 0.04,
        tessellation: 10
    }, scene);
    shield.rotation.z = Math.PI / 2;
    shield.position.set(-0.08, -0.15, 0.06);
    const shieldMat = new BABYLON.StandardMaterial('shieldMat', scene);
    shieldMat.diffuseColor = new BABYLON.Color3(0.45, 0.12, 0.12);
    shield.material = shieldMat;
    shield.parent = parts.armL;

    // Tocha portátil na mão esquerda
    const torch = new BABYLON.TransformNode('torchDico', scene);
    torch.parent = parts.armL.userData.hand;
    torch.position.set(0.05, -0.2, 0.05);

    const stick = BABYLON.MeshBuilder.CreateCylinder('torchStickDico', { diameter: 0.04, height: 0.32 }, scene);
    stick.material = hiltMat;
    stick.parent = torch;

    const flame = BABYLON.MeshBuilder.CreateSphere('flameDico', { diameter: 0.12, segments: 6 }, scene);
    flame.position.y = 0.2;
    const flameMat = new BABYLON.StandardMaterial('flameMatDico', scene);
    flameMat.diffuseColor = new BABYLON.Color3(1.0, 0.6, 0.2);
    flameMat.emissiveColor = new BABYLON.Color3(1.0, 0.5, 0.1);
    flame.material = flameMat;
    flame.parent = torch;
    torch.setEnabled(false);

    parts.torch = torch;
    parts.torchFlame = flame;
    parts.sword = sword;
    parts.shield = shield;

    return built;
}

export function buildRavi(scene) {
    const built = buildHumanoid({
        scene,
        height: 1.05,
        thin: 0.95,
        skinColor: new BABYLON.Color3(0.9, 0.76, 0.6),
        hairColor: new BABYLON.Color3(0.85, 0.75, 0.5),
        shirtColor: new BABYLON.Color3(0.22, 0.35, 0.55),
        pantsColor: new BABYLON.Color3(0.3, 0.22, 0.16),
        bootColor: new BABYLON.Color3(0.35, 0.22, 0.14)
    });

    const blanket = BABYLON.MeshBuilder.CreateBox('raviBlanket', { width: 0.55, height: 0.08, depth: 0.7 }, scene);
    blanket.position.set(0, 0.4, 0.05);
    const bMat = new BABYLON.StandardMaterial('blanketMat', scene);
    bMat.diffuseColor = new BABYLON.Color3(0.42, 0.16, 0.16);
    blanket.material = bMat;
    blanket.parent = built.root;

    built.parts.blanket = blanket;
    return built;
}

export function buildCamila(scene) {
    const built = buildHumanoid({
        scene,
        height: 1.68,
        thin: 0.9,
        skinColor: new BABYLON.Color3(0.94, 0.78, 0.65),
        hairColor: new BABYLON.Color3(0.9, 0.82, 0.52),
        shirtColor: new BABYLON.Color3(0.8, 0.72, 0.84),
        pantsColor: new BABYLON.Color3(0.55, 0.42, 0.6),
        bootColor: new BABYLON.Color3(0.35, 0.22, 0.28)
    });

    const parts = built.parts;

    // Cabelo longo da princesa
    const hair = BABYLON.MeshBuilder.CreateCapsule('camilaHair', { radius: 0.12, height: 0.45 }, scene);
    hair.position.set(0, 0.02, -0.04);
    hair.material = parts.hairMat;
    hair.parent = parts.head;

    // Vestido
    const dress = BABYLON.MeshBuilder.CreateCylinder('camilaDress', {
        diameterTop: 0.35,
        diameterBottom: 0.65,
        height: 0.7,
        tessellation: 10
    }, scene);
    dress.position.y = 0.55;
    const dressMat = new BABYLON.StandardMaterial('dressMat', scene);
    dressMat.diffuseColor = new BABYLON.Color3(0.8, 0.72, 0.84);
    dress.material = dressMat;
    dress.parent = parts.hips;

    // Grilhões nos pulsos
    const shackles = new BABYLON.TransformNode('camilaShackles', scene);
    shackles.parent = parts.hips;

    const shackleMat = new BABYLON.StandardMaterial('shackleMat', scene);
    shackleMat.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.5);

    const leftRing = BABYLON.MeshBuilder.CreateTorus('leftRing', { diameter: 0.1, thickness: 0.024 }, scene);
    leftRing.position.set(-0.12, 0.9, 0.12);
    leftRing.material = shackleMat;
    leftRing.parent = shackles;

    const rightRing = BABYLON.MeshBuilder.CreateTorus('rightRing', { diameter: 0.1, thickness: 0.024 }, scene);
    rightRing.position.set(0.12, 0.9, 0.12);
    rightRing.material = shackleMat;
    rightRing.parent = shackles;

    const chain = BABYLON.MeshBuilder.CreateCylinder('shackleChain', { diameter: 0.024, height: 0.24 }, scene);
    chain.rotation.z = Math.PI / 2;
    chain.position.set(0, 0.9, 0.12);
    chain.material = shackleMat;
    chain.parent = shackles;

    parts.shackles = shackles;
    return built;
}

export function buildGuard(scene, { fat = false, archer = false } = {}) {
    const built = buildHumanoid({
        scene,
        height: fat ? 1.7 : 1.82,
        thin: fat ? 1.35 : 1.08,
        skinColor: new BABYLON.Color3(0.82, 0.62, 0.48),
        hairColor: new BABYLON.Color3(0.2, 0.15, 0.1),
        shirtColor: new BABYLON.Color3(0.35, 0.12, 0.12),
        pantsColor: new BABYLON.Color3(0.16, 0.16, 0.14),
        bootColor: new BABYLON.Color3(0.2, 0.15, 0.1)
    });

    const parts = built.parts;

    // Elmo de ferro
    const helm = BABYLON.MeshBuilder.CreateSphere('guardHelm', { diameter: 0.3, segments: 8 }, scene);
    helm.position.y = 0.04;
    const ironMat = new BABYLON.StandardMaterial('ironMat', scene);
    ironMat.diffuseColor = new BABYLON.Color3(0.55, 0.55, 0.52);
    ironMat.specularColor = new BABYLON.Color3(0.7, 0.7, 0.7);
    helm.material = ironMat;
    helm.parent = parts.head;

    if (fat) {
        const belly = BABYLON.MeshBuilder.CreateSphere('guardBelly', { diameter: 0.56, segments: 8 }, scene);
        belly.position.y = 0.12;
        const tunicMat = new BABYLON.StandardMaterial('tunicMat', scene);
        tunicMat.diffuseColor = new BABYLON.Color3(0.35, 0.12, 0.12);
        belly.material = tunicMat;
        belly.parent = parts.chest;
    }

    // Lança ou Arco
    const spear = new BABYLON.TransformNode('guardSpear', scene);
    spear.parent = parts.armR.userData.hand;
    spear.position.set(0.05, -0.2, 0.1);

    const shaft = BABYLON.MeshBuilder.CreateCylinder('spearShaft', { diameter: 0.036, height: 1.6 }, scene);
    const woodM = new BABYLON.StandardMaterial('spearWood', scene);
    woodM.diffuseColor = new BABYLON.Color3(0.35, 0.22, 0.1);
    shaft.material = woodM;
    shaft.parent = spear;

    const tip = BABYLON.MeshBuilder.CreateCylinder('spearTip', { diameterTop: 0, diameterBottom: 0.08, height: 0.16 }, scene);
    tip.position.y = 0.86;
    tip.material = ironMat;
    tip.parent = spear;

    if (archer) {
        spear.setEnabled(false);
        const bow = BABYLON.MeshBuilder.CreateTorus('guardBow', {
            diameter: 0.56,
            thickness: 0.036,
            tessellation: 12
        }, scene);
        bow.rotation.y = Math.PI / 2;
        bow.material = woodM;
        bow.parent = parts.armL;
    }

    // Molho de chaves na cintura
    const keys = new BABYLON.TransformNode('guardKeys', scene);
    keys.parent = parts.hips;
    const goldKeyMat = new BABYLON.StandardMaterial('goldKeyMat', scene);
    goldKeyMat.diffuseColor = new BABYLON.Color3(0.8, 0.65, 0.15);

    for (let i = 0; i < 3; i++) {
        const k = BABYLON.MeshBuilder.CreateBox(`guardKey_${i}`, { width: 0.04, height: 0.12, depth: 0.02 }, scene);
        k.position.set(0.08, 0.7 + i * 0.02, 0.14);
        k.rotation.z = 0.3 * i;
        k.material = goldKeyMat;
        k.parent = keys;
    }
    keys.setEnabled(fat);

    parts.keys = keys;
    parts.spear = spear;
    return built;
}

export function buildFriend(scene, variant = 0) {
    const palettes = [
        { shirt: new BABYLON.Color3(0.22, 0.3, 0.22), pants: new BABYLON.Color3(0.16, 0.13, 0.1), hair: new BABYLON.Color3(0.22, 0.14, 0.08) },
        { shirt: new BABYLON.Color3(0.22, 0.22, 0.35), pants: new BABYLON.Color3(0.16, 0.16, 0.13), hair: new BABYLON.Color3(0.1, 0.1, 0.08) },
        { shirt: new BABYLON.Color3(0.35, 0.22, 0.16), pants: new BABYLON.Color3(0.22, 0.16, 0.1), hair: new BABYLON.Color3(0.4, 0.28, 0.14) }
    ];
    const p = palettes[variant % 3];
    const built = buildHumanoid({
        scene,
        height: 1.78 + variant * 0.04,
        thin: 1,
        shirtColor: p.shirt,
        pantsColor: p.pants,
        hairColor: p.hair
    });

    const pack = BABYLON.MeshBuilder.CreateBox('friendPack', { width: 0.28, height: 0.32, depth: 0.16 }, scene);
    pack.position.set(0, 0.28, -0.22);
    const packMat = new BABYLON.StandardMaterial('packMat', scene);
    packMat.diffuseColor = new BABYLON.Color3(0.28, 0.2, 0.1);
    pack.material = packMat;
    pack.parent = built.parts.chest;

    return built;
}

export function buildTeco(scene) {
    const root = new BABYLON.TransformNode('tecoRoot', scene);

    const furMat = new BABYLON.StandardMaterial('tecoFurMat', scene);
    furMat.diffuseColor = new BABYLON.Color3(0.42, 0.28, 0.16);

    const darkMat = new BABYLON.StandardMaterial('tecoDarkMat', scene);
    darkMat.diffuseColor = new BABYLON.Color3(0.22, 0.16, 0.1);

    const faceMat = new BABYLON.StandardMaterial('tecoFaceMat', scene);
    faceMat.diffuseColor = new BABYLON.Color3(0.88, 0.7, 0.56);

    // Hips
    const hips = new BABYLON.TransformNode('hips', scene);
    hips.parent = root;

    const body = BABYLON.MeshBuilder.CreateSphere('tecoBody', { diameter: 0.24, segments: 8 }, scene);
    body.scaling.set(0.9, 1.15, 0.8);
    body.position.y = 0.22;
    body.material = furMat;
    body.parent = hips;

    const chest = new BABYLON.TransformNode('chest', scene);
    chest.position.y = 0.28;
    chest.parent = hips;

    const head = new BABYLON.TransformNode('head', scene);
    head.position.y = 0.16;
    head.parent = chest;

    const skull = BABYLON.MeshBuilder.CreateSphere('tecoSkull', { diameter: 0.18, segments: 8 }, scene);
    skull.material = furMat;
    skull.parent = head;

    const muzzle = BABYLON.MeshBuilder.CreateSphere('tecoMuzzle', { diameter: 0.1, segments: 6 }, scene);
    muzzle.scaling.set(1, 0.8, 1.2);
    muzzle.position.set(0, -0.02, 0.07);
    muzzle.material = faceMat;
    muzzle.parent = head;

    for (const s of [-1, 1]) {
        const ear = BABYLON.MeshBuilder.CreateSphere('tecoEar', { diameter: 0.07, segments: 6 }, scene);
        ear.position.set(s * 0.08, 0.06, 0);
        ear.material = furMat;
        ear.parent = head;

        const eye = BABYLON.MeshBuilder.CreateSphere('tecoEye', { diameter: 0.025, segments: 6 }, scene);
        eye.position.set(s * 0.03, 0.02, 0.09);
        eye.material = darkMat;
        eye.parent = head;
    }

    // Braços
    const armL = new BABYLON.TransformNode('armL', scene);
    const armR = new BABYLON.TransformNode('armR', scene);
    armL.position.set(-0.12, 0.06, 0);
    armR.position.set(0.12, 0.06, 0);
    armL.parent = chest;
    armR.parent = chest;

    for (const arm of [armL, armR]) {
        const limb = BABYLON.MeshBuilder.CreateCylinder('tecoArmMesh', { diameter: 0.045, height: 0.22 }, scene);
        limb.position.y = -0.1;
        limb.material = furMat;
        limb.parent = arm;

        const hand = BABYLON.MeshBuilder.CreateSphere('tecoHand', { diameter: 0.06, segments: 6 }, scene);
        hand.position.y = -0.22;
        hand.material = darkMat;
        hand.parent = arm;
    }

    // Pernas
    const legL = new BABYLON.TransformNode('legL', scene);
    const legR = new BABYLON.TransformNode('legR', scene);
    legL.position.set(-0.06, 0.12, 0);
    legR.position.set(0.06, 0.12, 0);
    legL.parent = hips;
    legR.parent = hips;

    for (const leg of [legL, legR]) {
        const limb = BABYLON.MeshBuilder.CreateCylinder('tecoLegMesh', { diameter: 0.05, height: 0.18 }, scene);
        limb.position.y = -0.08;
        limb.material = furMat;
        limb.parent = leg;

        const foot = BABYLON.MeshBuilder.CreateSphere('tecoFoot', { diameter: 0.06, segments: 6 }, scene);
        foot.scaling.set(1, 0.6, 1.4);
        foot.position.set(0, -0.18, 0.02);
        foot.material = darkMat;
        foot.parent = leg;
    }

    // Cauda
    const tail = new BABYLON.TransformNode('tail', scene);
    tail.position.set(0, 0.16, -0.1);
    tail.parent = hips;

    const tailMesh = BABYLON.MeshBuilder.CreateCylinder('tecoTailMesh', {
        diameterTop: 0.036,
        diameterBottom: 0.02,
        height: 0.32
    }, scene);
    tailMesh.rotation.x = 0.9;
    tailMesh.position.set(0, 0.05, -0.12);
    tailMesh.material = furMat;
    tailMesh.parent = tail;

    const parts = { hips, chest, head, armL, armR, legL, legR, tail, root };
    const clips = {
        Idle: new ProceduralClip(2.0, [
            { target: 'head', axis: 'y', amp: 0.15, phase: 0 },
            { target: 'tail', axis: 'y', amp: 0.3, phase: 1 }
        ]),
        Walk: new ProceduralClip(0.65, [
            { target: 'legL', axis: 'x', amp: 0.6, phase: 0 },
            { target: 'legR', axis: 'x', amp: 0.6, phase: Math.PI },
            { target: 'armL', axis: 'x', amp: 0.5, phase: Math.PI },
            { target: 'armR', axis: 'x', amp: 0.5, phase: 0 }
        ]),
        Run: new ProceduralClip(0.45, [
            { target: 'legL', axis: 'x', amp: 0.9, phase: 0 },
            { target: 'legR', axis: 'x', amp: 0.9, phase: Math.PI },
            { target: 'armL', axis: 'x', amp: 0.8, phase: Math.PI },
            { target: 'armR', axis: 'x', amp: 0.8, phase: 0 }
        ]),
        Climb: new ProceduralClip(0.55, [
            { target: 'armL', axis: 'x', amp: 0.8, phase: 0 },
            { target: 'armR', axis: 'x', amp: 0.8, phase: Math.PI },
            { target: 'legL', axis: 'x', amp: 0.5, phase: Math.PI }
        ]),
        Grab: new ProceduralClip(0.5, [
            { target: 'armR', axis: 'x', amp: 0.6, phase: 0, base: -0.8 }
        ]),
        Shoulder: new ProceduralClip(2.0, [
            { target: 'head', axis: 'y', amp: 0.2, phase: 0 }
        ]),
        Scared: new ProceduralClip(0.4, [
            { target: 'head', axis: 'x', amp: 0.25, phase: 0, base: -0.2 }
        ]),
        Celebrate: new ProceduralClip(0.5, [
            { target: 'armL', axis: 'x', amp: 0.6, phase: 0, base: -1.2 },
            { target: 'armR', axis: 'x', amp: 0.6, phase: 0, base: -1.2 }
        ])
    };

    root.userData = { parts, clips };
    return { root, parts, clips };
}

export function buildTiger(scene) {
    const root = new BABYLON.TransformNode('tigerRoot', scene);

    const orangeMat = new BABYLON.StandardMaterial('tigerOrangeMat', scene);
    orangeMat.diffuseColor = new BABYLON.Color3(0.85, 0.4, 0.1);

    const whiteMat = new BABYLON.StandardMaterial('tigerWhiteMat', scene);
    whiteMat.diffuseColor = new BABYLON.Color3(0.95, 0.92, 0.85);

    const blackMat = new BABYLON.StandardMaterial('tigerBlackMat', scene);
    blackMat.diffuseColor = new BABYLON.Color3(0.1, 0.08, 0.06);

    const body = BABYLON.MeshBuilder.CreateCapsule('tigerBody', { radius: 0.38, height: 1.5 }, scene);
    body.rotation.z = Math.PI / 2;
    body.position.set(0, 0.55, 0);
    body.material = orangeMat;
    body.parent = root;

    const belly = BABYLON.MeshBuilder.CreateCapsule('tigerBelly', { radius: 0.22, height: 1.1 }, scene);
    belly.rotation.z = Math.PI / 2;
    belly.position.set(0, 0.38, 0.05);
    belly.material = whiteMat;
    belly.parent = root;

    const head = new BABYLON.TransformNode('head', scene);
    head.position.set(0.85, 0.62, 0);
    head.parent = root;

    const skull = BABYLON.MeshBuilder.CreateSphere('tigerSkull', { diameter: 0.56, segments: 8 }, scene);
    skull.scaling.set(1.15, 0.9, 0.85);
    skull.material = orangeMat;
    skull.parent = head;

    const muzzle = BABYLON.MeshBuilder.CreateSphere('tigerMuzzle', { diameter: 0.28, segments: 6 }, scene);
    muzzle.position.set(0.18, -0.04, 0);
    muzzle.material = whiteMat;
    muzzle.parent = head;

    const nose = BABYLON.MeshBuilder.CreateSphere('tigerNose', { diameter: 0.1, segments: 6 }, scene);
    nose.position.set(0.3, 0.02, 0);
    nose.material = blackMat;
    nose.parent = head;

    for (const s of [-1, 1]) {
        const ear = BABYLON.MeshBuilder.CreateCylinder('tigerEar', { diameterTop: 0, diameterBottom: 0.16, height: 0.12 }, scene);
        ear.position.set(-0.05, 0.24, s * 0.14);
        ear.material = orangeMat;
        ear.parent = head;

        const eye = BABYLON.MeshBuilder.CreateSphere('tigerEye', { diameter: 0.07, segments: 6 }, scene);
        eye.position.set(0.16, 0.08, s * 0.12);
        const tigerEyeMat = new BABYLON.StandardMaterial('tigerEyeMat', scene);
        tigerEyeMat.diffuseColor = new BABYLON.Color3(0.2, 0.6, 0.1);
        eye.material = tigerEyeMat;
        eye.parent = head;
    }

    // 4 Patas
    for (const [x, z] of [[-0.35, 0.22], [-0.35, -0.22], [0.35, 0.22], [0.35, -0.22]]) {
        const leg = BABYLON.MeshBuilder.CreateCylinder('tigerLeg', { diameter: 0.16, height: 0.45 }, scene);
        leg.position.set(x, 0.22, z);
        leg.material = orangeMat;
        leg.parent = root;

        const paw = BABYLON.MeshBuilder.CreateSphere('tigerPaw', { diameter: 0.2, segments: 6 }, scene);
        paw.scaling.set(1, 0.5, 1.2);
        paw.position.set(x, 0.04, z);
        paw.material = blackMat;
        paw.parent = root;
    }

    // Cauda
    const tail = new BABYLON.TransformNode('tail', scene);
    tail.position.set(-0.75, 0.7, 0);
    tail.parent = root;

    const tailMesh = BABYLON.MeshBuilder.CreateCylinder('tigerTailMesh', { diameter: 0.08, height: 0.9 }, scene);
    tailMesh.rotation.z = 0.8;
    tailMesh.position.set(-0.25, 0.2, 0);
    tailMesh.material = orangeMat;
    tailMesh.parent = tail;

    // Listras pretas
    for (let i = 0; i < 10; i++) {
        const stripe = BABYLON.MeshBuilder.CreateBox(`stripe_${i}`, { width: 0.06, height: 0.42, depth: 0.55 }, scene);
        stripe.position.set(-0.4 + i * 0.12, 0.62, 0);
        stripe.rotation.y = 0.15;
        stripe.material = blackMat;
        stripe.parent = root;
    }

    const parts = { head, tail, root };
    const clips = {
        Idle: new ProceduralClip(2.0, [
            { target: 'head', axis: 'y', amp: 0.15, phase: 0 },
            { target: 'tail', axis: 'z', amp: 0.25, phase: 1 }
        ]),
        Walk: new ProceduralClip(0.8, [
            { target: 'head', axis: 'x', amp: 0.08, phase: 0 },
            { target: 'tail', axis: 'z', amp: 0.4, phase: 0 }
        ]),
        Growl: new ProceduralClip(0.6, [
            { target: 'head', axis: 'x', amp: 0.2, phase: 0, base: -0.15 }
        ]),
        Jump: new ProceduralClip(0.5, [
            { target: 'head', axis: 'x', amp: 0.3, phase: 0, base: 0.2 }
        ])
    };

    root.userData = { parts, clips };
    return { root, parts, clips };
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
