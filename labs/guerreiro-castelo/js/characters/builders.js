/**
 * Humanoides e animais procedurais hiper-realistas (PBR) em Babylon.js
 * com hierarquia de nós e animador procedural.
 */

import { leatherTexture, clothTexture } from '../world/Textures.js';
import { angleLerp, damp } from '../utils/math.js';
import { createMuscle, createSkull, createHand, createTorso } from '../../../shared/realism-bjs.js';

/** PBRMaterial com albedo, roughness e metallic sensatos. */
function pbr(name, scene, color, roughness = 0.72, metallic = 0.04, extra = {}) {
    const mat = new BABYLON.PBRMaterial(name, scene);
    mat.albedoColor = color.clone ? color.clone() : color;
    mat.roughness = roughness;
    mat.metallic = metallic;
    if (extra.emissiveColor) mat.emissiveColor = extra.emissiveColor;
    if (extra.emissiveIntensity !== undefined) mat.emissiveIntensity = extra.emissiveIntensity;
    if (extra.albedoTexture) mat.albedoTexture = extra.albedoTexture;
    if (extra.bumpTexture) mat.bumpTexture = extra.bumpTexture;
    if (extra.alpha !== undefined) mat.alpha = extra.alpha;
    return mat;
}

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

    const skinMat = pbr('skinMat', scene, skinColor, 0.62, 0.02);
    const hairMat = pbr('hairMat', scene, hairColor, 0.88, 0.03);
    const shirtMat = pbr('shirtMat', scene, shirtColor, 0.82, 0.04);
    const pantsMat = pbr('pantsMat', scene, pantsColor, 0.86, 0.04);
    const bootMat = pbr('bootMat', scene, bootColor, 0.55, 0.12);

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
        const thigh = createMuscle(scene, 'thigh', {
            length: 0.46 * scale,
            r0: 0.085 * thin * scale,
            r1: 0.06 * thin * scale,
            bulge: 0.02 * scale,
            bulgeAt: 0.32
        });
        thigh.position.y = -0.23 * scale;
        thigh.material = pantsMat;
        thigh.parent = leg;

        const shin = createMuscle(scene, 'shin', {
            length: 0.42 * scale,
            r0: 0.062 * thin * scale,
            r1: 0.045 * thin * scale,
            bulge: 0.016 * scale,
            bulgeAt: 0.38,
            pinch: 0.25
        });
        shin.position.y = -0.66 * scale;
        shin.material = pantsMat;
        shin.parent = leg;

        const foot = createMuscle(scene, 'foot', {
            length: 0.22 * scale,
            r0: 0.055 * scale,
            r1: 0.04 * scale,
            bulge: 0.012 * scale,
            bulgeAt: 0.45,
            pinch: 0
        });
        foot.rotation.x = Math.PI / 2;
        foot.position.set(0, -0.9 * scale, 0.05 * scale);
        foot.scaling.set(1, 0.72, 1.15);
        foot.material = bootMat;
        foot.parent = leg;
    }

    // Spine & Chest
    const spine = new BABYLON.TransformNode('spine', scene);
    spine.position.y = 0.95 * scale;
    spine.parent = hips;

    const chest = new BABYLON.TransformNode('chest', scene);
    chest.parent = spine;

    const torso = createMuscle(scene, 'torso', {
        length: 0.58 * scale,
        r0: 0.2 * thin * scale,
        r1: 0.15 * thin * scale,
        bulge: 0.04 * scale,
        bulgeAt: 0.62,
        pinch: 0.15
    });
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
        const upper = createMuscle(scene, 'armUpper', {
            length: 0.32 * scale,
            r0: 0.06 * scale,
            r1: 0.045 * scale,
            bulge: 0.016 * scale,
            bulgeAt: 0.3
        });
        upper.position.y = -0.16 * scale;
        upper.material = shirtMat;
        upper.parent = arm;

        const fore = createMuscle(scene, 'armFore', {
            length: 0.3 * scale,
            r0: 0.048 * scale,
            r1: 0.036 * scale,
            bulge: 0.01 * scale,
            bulgeAt: 0.4,
            pinch: 0.15
        });
        fore.position.y = -0.46 * scale;
        fore.material = skinMat;
        fore.parent = arm;

        const hand = createHand(scene, 'hand', skinMat, { scale: scale * 0.85 });
        hand.position.y = -0.64 * scale;
        hand.material = skinMat;
        hand.parent = arm;
        arm.userData = { hand };
    }

    // Head
    const head = new BABYLON.TransformNode('head', scene);
    head.position.y = 0.62 * scale;
    head.parent = chest;

    const skull = createSkull(scene, 'skull', { diameter: 0.25 * scale, style: 'human', segments: 18 });
    skull.scaling.set(0.92, 1.05, 0.95);
    skull.material = skinMat;
    skull.parent = head;

    // Olhos
    const eyeMat = pbr('eyeMat', scene, new BABYLON.Color3(0.08, 0.08, 0.08), 0.22, 0.15);
    for (const s of [-1, 1]) {
        const eye = BABYLON.MeshBuilder.CreateSphere('eye', { diameter: 0.04 * scale, segments: 10 }, scene);
        eye.position.set(s * 0.045 * scale, 0.04 * scale, 0.11 * scale);
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

    const hairCluster = new BABYLON.TransformNode('dicoHair', scene);
    hairCluster.parent = parts.head;
    const afro = BABYLON.MeshBuilder.CreateLathe('dicoAfro', {
        shape: [
            new BABYLON.Vector3(0.05, -0.02, 0),
            new BABYLON.Vector3(0.16, 0.02, 0),
            new BABYLON.Vector3(0.18, 0.1, 0),
            new BABYLON.Vector3(0.12, 0.18, 0),
            new BABYLON.Vector3(0.03, 0.22, 0)
        ],
        tessellation: 16
    }, scene);
    afro.material = parts.hairMat;
    afro.parent = hairCluster;
    for (let i = 0; i < 8; i++) {
        const lock = createMuscle(scene, `curl_${i}`, {
            length: 0.09, r0: 0.026, r1: 0.01, bulge: 0.008, pinch: 0, tessellation: 6, rings: 4
        });
        const a = (i / 8) * Math.PI * 2;
        lock.position.set(Math.cos(a) * 0.13, 0.08, Math.sin(a) * 0.11);
        lock.rotation.z = Math.cos(a) * 0.7;
        lock.material = parts.hairMat;
        lock.parent = hairCluster;
    }

    const mustache = createMuscle(scene, 'mustache', {
        length: 0.12, r0: 0.014, r1: 0.008, bulge: 0.006, bulgeAt: 0.5, pinch: 0.15, tessellation: 8, rings: 5
    });
    mustache.rotation.z = Math.PI / 2;
    mustache.position.set(0, -0.02, 0.12);
    mustache.material = parts.hairMat;
    mustache.parent = parts.head;

    const goatee = createMuscle(scene, 'goatee', {
        length: 0.08, r0: 0.022, r1: 0.008, bulge: 0.006, pinch: 0, tessellation: 8, rings: 4
    });
    goatee.position.set(0, -0.1, 0.1);
    goatee.material = parts.hairMat;
    goatee.parent = parts.head;

    // Colete de couro
    const vest = BABYLON.MeshBuilder.CreateCylinder('vest', {
        diameterTop: 0.4,
        diameterBottom: 0.44,
        height: 0.36,
        tessellation: 18
    }, scene);
    vest.position.y = 0.26;
    const vestMat = pbr('vestMat', scene, new BABYLON.Color3(0.35, 0.22, 0.13), 0.68, 0.08);
    vest.material = vestMat;
    vest.parent = parts.chest;

    // Espada na mão direita
    const sword = new BABYLON.TransformNode('swordRoot', scene);
    sword.parent = parts.armR.userData.hand;
    sword.position.set(0.02, -0.2, 0.02);
    sword.rotation.z = 0.15;

    const blade = BABYLON.MeshBuilder.ExtrudeShapeCustom('swordBlade', {
        shape: [
            new BABYLON.Vector3(0.02, 0, 0),
            new BABYLON.Vector3(0, 0.007, 0),
            new BABYLON.Vector3(-0.02, 0, 0),
            new BABYLON.Vector3(0, -0.007, 0)
        ],
        path: [
            new BABYLON.Vector3(0, 0.02, 0),
            new BABYLON.Vector3(0, 0.7, 0)
        ],
        closeShape: true,
        cap: BABYLON.Mesh.CAP_ALL,
        scaleFunction: (i) => 1 - i * 0.82
    }, scene);
    const bladeMat = pbr('bladeMat', scene, new BABYLON.Color3(0.78, 0.82, 0.86), 0.22, 0.92);
    blade.material = bladeMat;
    blade.parent = sword;

    const guard = BABYLON.MeshBuilder.CreateBox('swordGuard', {
        width: 0.16, height: 0.02, depth: 0.035
    }, scene);
    const goldMat = pbr('goldMat', scene, new BABYLON.Color3(0.7, 0.55, 0.2), 0.35, 0.85);
    guard.material = goldMat;
    guard.parent = sword;

    const hilt = BABYLON.MeshBuilder.CreateCylinder('swordHilt', { diameter: 0.04, height: 0.14, tessellation: 12 }, scene);
    hilt.position.y = -0.08;
    const hiltMat = pbr('hiltMat', scene, new BABYLON.Color3(0.2, 0.12, 0.08), 0.7, 0.05);
    hilt.material = hiltMat;
    hilt.parent = sword;

    // Escudo no braço esquerdo
    const shield = BABYLON.MeshBuilder.CreateCylinder('shield', {
        diameter: 0.38,
        height: 0.04,
        tessellation: 20
    }, scene);
    shield.rotation.z = Math.PI / 2;
    shield.position.set(-0.08, -0.15, 0.06);
    const shieldMat = pbr('shieldMat', scene, new BABYLON.Color3(0.45, 0.12, 0.12), 0.45, 0.55);
    shield.material = shieldMat;
    shield.parent = parts.armL;

    // Tocha portátil na mão esquerda
    const torch = new BABYLON.TransformNode('torchDico', scene);
    torch.parent = parts.armL.userData.hand;
    torch.position.set(0.05, -0.2, 0.05);

    const stick = BABYLON.MeshBuilder.CreateCylinder('torchStickDico', { diameter: 0.04, height: 0.32 }, scene);
    stick.material = hiltMat;
    stick.parent = torch;

    const flame = BABYLON.MeshBuilder.CreateLathe('flameDico', {
        shape: [
            new BABYLON.Vector3(0.012, 0, 0),
            new BABYLON.Vector3(0.05, 0.03, 0),
            new BABYLON.Vector3(0.04, 0.09, 0),
            new BABYLON.Vector3(0.015, 0.16, 0)
        ],
        tessellation: 10
    }, scene);
    flame.position.y = 0.16;
    const flameMat = pbr('flameMatDico', scene, new BABYLON.Color3(1.0, 0.6, 0.2), 0.9, 0.0, {
        emissiveColor: new BABYLON.Color3(1.0, 0.45, 0.08),
        emissiveIntensity: 2.2
    });
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

    const blanket = BABYLON.MeshBuilder.CreateLathe('raviBlanket', {
        shape: [
            new BABYLON.Vector3(0.14, 0, 0),
            new BABYLON.Vector3(0.26, 0.1, 0),
            new BABYLON.Vector3(0.24, 0.28, 0),
            new BABYLON.Vector3(0.12, 0.42, 0)
        ],
        tessellation: 16,
        arc: 0.6,
        cap: BABYLON.Mesh.CAP_ALL
    }, scene);
    blanket.position.set(0, 0.32, 0);
    blanket.rotation.y = Math.PI * 0.15;
    const bMat = pbr('blanketMat', scene, new BABYLON.Color3(0.42, 0.16, 0.16), 0.9, 0.02);
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

    const hairCap = BABYLON.MeshBuilder.CreateLathe('camilaHairCap', {
        shape: [
            new BABYLON.Vector3(0.02, 0, 0),
            new BABYLON.Vector3(0.13, 0.02, 0),
            new BABYLON.Vector3(0.14, 0.1, 0),
            new BABYLON.Vector3(0.05, 0.16, 0)
        ],
        tessellation: 14
    }, scene);
    hairCap.position.set(0, 0.04, -0.02);
    hairCap.material = parts.hairMat;
    hairCap.parent = parts.head;
    for (const [sx, rz] of [[-0.05, 0.18], [0, 0], [0.05, -0.18]]) {
        const lock = createMuscle(scene, 'camilaHair', {
            length: 0.55, r0: 0.04, r1: 0.012, bulge: 0.01, bulgeAt: 0.25, pinch: 0, tessellation: 8, rings: 6
        });
        lock.position.set(sx, -0.02, -0.05);
        lock.rotation.x = 0.18;
        lock.rotation.z = rz;
        lock.material = parts.hairMat;
        lock.parent = parts.head;
    }

    // Vestido
    const dress = BABYLON.MeshBuilder.CreateCylinder('camilaDress', {
        diameterTop: 0.35,
        diameterBottom: 0.65,
        height: 0.7,
        tessellation: 20
    }, scene);
    dress.position.y = 0.55;
    const dressMat = pbr('dressMat', scene, new BABYLON.Color3(0.8, 0.72, 0.84), 0.78, 0.04);
    dress.material = dressMat;
    dress.parent = parts.hips;

    // Grilhões nos pulsos
    const shackles = new BABYLON.TransformNode('camilaShackles', scene);
    shackles.parent = parts.hips;

    const shackleMat = pbr('shackleMat', scene, new BABYLON.Color3(0.5, 0.5, 0.5), 0.35, 0.88);

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
    const helm = createSkull(scene, 'guardHelm', { diameter: 0.32, style: 'human', segments: 14 });
    helm.position.y = 0.02;
    const ironMat = pbr('ironMat', scene, new BABYLON.Color3(0.55, 0.55, 0.52), 0.32, 0.9);
    helm.material = ironMat;
    helm.parent = parts.head;

    if (fat) {
        const belly = createMuscle(scene, 'guardBelly', {
            length: 0.38, r0: 0.24, r1: 0.18, bulge: 0.08, pinch: 0.05, tessellation: 12, rings: 6
        });
        belly.rotation.x = Math.PI / 2;
        belly.position.set(0, 0.02, 0.1);
        const tunicMat = pbr('tunicMat', scene, new BABYLON.Color3(0.35, 0.12, 0.12), 0.85, 0.04);
        belly.material = tunicMat;
        belly.parent = parts.chest;
    }

    // Lança ou Arco
    const spear = new BABYLON.TransformNode('guardSpear', scene);
    spear.parent = parts.armR.userData.hand;
    spear.position.set(0.05, -0.2, 0.1);

    const shaft = BABYLON.MeshBuilder.CreateCylinder('spearShaft', { diameter: 0.036, height: 1.6 }, scene);
    const woodM = pbr('spearWood', scene, new BABYLON.Color3(0.35, 0.22, 0.1), 0.88, 0.03);
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
            tessellation: 24
        }, scene);
        bow.rotation.y = Math.PI / 2;
        bow.material = woodM;
        bow.parent = parts.armL;
    }

    // Molho de chaves na cintura
    const keys = new BABYLON.TransformNode('guardKeys', scene);
    keys.parent = parts.hips;
    const goldKeyMat = pbr('goldKeyMat', scene, new BABYLON.Color3(0.8, 0.65, 0.15), 0.35, 0.85);

    for (let i = 0; i < 3; i++) {
        const k = BABYLON.MeshBuilder.CreateCylinder(`guardKey_${i}`, {
            height: 0.09, diameter: 0.01, tessellation: 6
        }, scene);
        k.position.set(0.08, 0.68 + i * 0.02, 0.14);
        k.rotation.z = 0.25 * i;
        k.material = goldKeyMat;
        k.parent = keys;
        const bow = BABYLON.MeshBuilder.CreateTorus(`guardKeyBow_${i}`, {
            diameter: 0.028, thickness: 0.006, tessellation: 8
        }, scene);
        bow.position.set(0.08, 0.73 + i * 0.02, 0.14);
        bow.rotation.y = 0.4 * i;
        bow.material = goldKeyMat;
        bow.parent = keys;
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

    const pack = BABYLON.MeshBuilder.CreateLathe('friendPack', {
        shape: [
            new BABYLON.Vector3(0.05, 0, 0),
            new BABYLON.Vector3(0.13, 0.04, 0),
            new BABYLON.Vector3(0.15, 0.16, 0),
            new BABYLON.Vector3(0.1, 0.3, 0),
            new BABYLON.Vector3(0.04, 0.34, 0)
        ],
        tessellation: 12
    }, scene);
    pack.scaling.set(1.15, 1, 0.72);
    pack.rotation.x = 0.2;
    pack.position.set(0, 0.08, -0.2);
    const packMat = pbr('packMat', scene, new BABYLON.Color3(0.28, 0.2, 0.1), 0.8, 0.05);
    pack.material = packMat;
    pack.parent = built.parts.chest;

    return built;
}

export function buildTeco(scene) {
    const root = new BABYLON.TransformNode('tecoRoot', scene);

    const furMat = pbr('tecoFurMat', scene, new BABYLON.Color3(0.42, 0.28, 0.16), 0.9, 0.02);
    const darkMat = pbr('tecoDarkMat', scene, new BABYLON.Color3(0.22, 0.16, 0.1), 0.85, 0.04);
    const faceMat = pbr('tecoFaceMat', scene, new BABYLON.Color3(0.88, 0.7, 0.56), 0.65, 0.02);

    // Hips
    const hips = new BABYLON.TransformNode('hips', scene);
    hips.parent = root;

    const body = createTorso(scene, 'tecoBody', { height: 0.26, girth: 0.1, style: 'child' });
    body.scaling.set(0.95, 1, 0.85);
    body.position.y = 0.08;
    body.material = furMat;
    body.parent = hips;

    const chest = new BABYLON.TransformNode('chest', scene);
    chest.position.y = 0.28;
    chest.parent = hips;

    const head = new BABYLON.TransformNode('head', scene);
    head.position.y = 0.16;
    head.parent = chest;

    const skull = createSkull(scene, 'tecoSkull', { diameter: 0.18, style: 'child', segments: 14 });
    skull.material = furMat;
    skull.parent = head;

    const muzzle = createMuscle(scene, 'tecoMuzzle', {
        length: 0.07, r0: 0.04, r1: 0.025, bulge: 0.01, pinch: 0, tessellation: 10, rings: 5
    });
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(0, -0.02, 0.07);
    muzzle.material = faceMat;
    muzzle.parent = head;

    for (const s of [-1, 1]) {
        const ear = BABYLON.MeshBuilder.CreateLathe('tecoEar', {
            shape: [
                new BABYLON.Vector3(0.004, 0, 0),
                new BABYLON.Vector3(0.026, 0.012, 0),
                new BABYLON.Vector3(0.016, 0.05, 0),
                new BABYLON.Vector3(0.003, 0.07, 0)
            ],
            tessellation: 8
        }, scene);
        ear.scaling.set(0.65, 1, 0.4);
        ear.position.set(s * 0.07, 0.06, 0);
        ear.rotation.z = s * -0.3;
        ear.material = furMat;
        ear.parent = head;

        const eye = BABYLON.MeshBuilder.CreateSphere('tecoEye', { diameter: 0.025, segments: 10 }, scene);
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

    darkMat.backFaceCulling = false;
    for (const [i, arm] of [armL, armR].entries()) {
        const limb = createMuscle(scene, 'tecoArmMesh', {
            length: 0.18, r0: 0.028, r1: 0.018, bulge: 0.006, pinch: 0.2, tessellation: 8, rings: 5
        });
        limb.position.y = -0.1;
        limb.material = furMat;
        limb.parent = arm;

        const hand = createHand(scene, 'tecoHand', darkMat, { scale: 0.38 });
        hand.position.y = -0.2;
        if (i === 1) hand.scaling.x = -1;
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
        const limb = createMuscle(scene, 'tecoLegMesh', {
            length: 0.16, r0: 0.03, r1: 0.02, bulge: 0.006, pinch: 0.25, tessellation: 8, rings: 5
        });
        limb.position.y = -0.08;
        limb.material = furMat;
        limb.parent = leg;

        const foot = createMuscle(scene, 'tecoFoot', {
            length: 0.07, r0: 0.028, r1: 0.018, bulge: 0.008, pinch: 0, tessellation: 8, rings: 4
        });
        foot.rotation.x = Math.PI / 2;
        foot.position.set(0, -0.16, 0.03);
        foot.material = darkMat;
        foot.parent = leg;
    }

    // Cauda
    const tail = new BABYLON.TransformNode('tail', scene);
    tail.position.set(0, 0.16, -0.1);
    tail.parent = hips;

    const tailMesh = createMuscle(scene, 'tecoTailMesh', {
        length: 0.32, r0: 0.02, r1: 0.012, bulge: 0.006, pinch: 0, tessellation: 8, rings: 6
    });
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

    const orangeMat = pbr('tigerOrangeMat', scene, new BABYLON.Color3(0.85, 0.4, 0.1), 0.78, 0.03);
    const whiteMat = pbr('tigerWhiteMat', scene, new BABYLON.Color3(0.95, 0.92, 0.85), 0.82, 0.02);
    const blackMat = pbr('tigerBlackMat', scene, new BABYLON.Color3(0.1, 0.08, 0.06), 0.75, 0.04);

    const body = createMuscle(scene, 'tigerBody', {
        length: 1.25, r0: 0.42, r1: 0.32, bulge: 0.1, bulgeAt: 0.4, pinch: 0.12, tessellation: 14, rings: 8
    });
    body.rotation.z = Math.PI / 2;
    body.position.set(0, 0.55, 0);
    body.material = orangeMat;
    body.parent = root;

    const belly = createMuscle(scene, 'tigerBelly', {
        length: 0.9, r0: 0.24, r1: 0.18, bulge: 0.04, pinch: 0.05, tessellation: 12, rings: 6
    });
    belly.rotation.z = Math.PI / 2;
    belly.position.set(0, 0.38, 0.05);
    belly.material = whiteMat;
    belly.parent = root;

    const head = new BABYLON.TransformNode('head', scene);
    head.position.set(0.85, 0.62, 0);
    head.parent = root;

    const skull = createSkull(scene, 'tigerSkull', { diameter: 0.5, style: 'cat', segments: 16 });
    skull.rotation.y = -Math.PI / 2;
    skull.scaling.set(1.05, 0.95, 1.15);
    skull.material = orangeMat;
    skull.parent = head;

    const muzzle = createMuscle(scene, 'tigerMuzzle', {
        length: 0.22, r0: 0.12, r1: 0.06, bulge: 0.03, pinch: 0.1, tessellation: 12, rings: 6
    });
    muzzle.rotation.z = -Math.PI / 2;
    muzzle.position.set(0.16, -0.04, 0);
    muzzle.material = whiteMat;
    muzzle.parent = head;

    const nose = BABYLON.MeshBuilder.CreateLathe('tigerNose', {
        shape: [
            new BABYLON.Vector3(0.01, 0, 0),
            new BABYLON.Vector3(0.04, 0.015, 0),
            new BABYLON.Vector3(0.028, 0.045, 0),
            new BABYLON.Vector3(0.008, 0.06, 0)
        ],
        tessellation: 8
    }, scene);
    nose.rotation.z = -Math.PI / 2;
    nose.position.set(0.28, 0.02, 0);
    nose.material = blackMat;
    nose.parent = head;

    for (const s of [-1, 1]) {
        const ear = BABYLON.MeshBuilder.CreateCylinder('tigerEar', { diameterTop: 0, diameterBottom: 0.16, height: 0.12 }, scene);
        ear.position.set(-0.05, 0.24, s * 0.14);
        ear.material = orangeMat;
        ear.parent = head;

        const eye = BABYLON.MeshBuilder.CreateSphere('tigerEye', { diameter: 0.07, segments: 10 }, scene);
        eye.position.set(0.16, 0.08, s * 0.12);
        const tigerEyeMat = pbr('tigerEyeMat', scene, new BABYLON.Color3(0.2, 0.6, 0.1), 0.25, 0.1, {
            emissiveColor: new BABYLON.Color3(0.05, 0.15, 0.02),
            emissiveIntensity: 0.4
        });
        eye.material = tigerEyeMat;
        eye.parent = head;
    }

    // 4 Patas
    for (const [x, z] of [[-0.35, 0.22], [-0.35, -0.22], [0.35, 0.22], [0.35, -0.22]]) {
        const leg = createMuscle(scene, 'tigerLeg', {
            length: 0.36, r0: 0.09, r1: 0.06, bulge: 0.02, pinch: 0.2, tessellation: 10, rings: 6
        });
        leg.position.set(x, 0.22, z);
        leg.material = orangeMat;
        leg.parent = root;

        const paw = createMuscle(scene, 'tigerPaw', {
            length: 0.16, r0: 0.09, r1: 0.06, bulge: 0.02, pinch: 0, tessellation: 8, rings: 4
        });
        paw.rotation.z = -Math.PI / 2;
        paw.scaling.x = 0.5;
        paw.position.set(x + 0.05, 0.05, z);
        paw.material = blackMat;
        paw.parent = root;
    }

    // Cauda
    const tail = new BABYLON.TransformNode('tail', scene);
    tail.position.set(-0.75, 0.7, 0);
    tail.parent = root;

    const tailMesh = createMuscle(scene, 'tigerTailMesh', {
        length: 0.9, r0: 0.05, r1: 0.02, bulge: 0.012, pinch: 0, tessellation: 10, rings: 8
    });
    tailMesh.rotation.z = 0.8;
    tailMesh.position.set(-0.25, 0.2, 0);
    tailMesh.material = orangeMat;
    tailMesh.parent = tail;

    // Listras pretas
    for (let i = 0; i < 10; i++) {
        const stripe = BABYLON.MeshBuilder.CreateBox(`stripe_${i}`, {
            width: 0.04, height: 0.035, depth: 0.7
        }, scene);
        stripe.position.set(-0.45 + i * 0.1, 0.9, 0);
        stripe.rotation.z = (i % 2 === 0 ? 0.12 : -0.08);
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
