import * as THREE from 'three';
import { PALETTE } from './config.js';
import { headGeometry, limbGeometry, torsoGeometry } from '../../shared/realism.js';

const matCache = new Map();
const texLoader = new THREE.TextureLoader();
const suitRedTex = texLoader.load('./assets/red_suit.webp');
suitRedTex.wrapS = suitRedTex.wrapT = THREE.RepeatWrapping;
suitRedTex.repeat.set(2, 2);

const suitBlueTex = texLoader.load('./assets/blue_suit.webp');
suitBlueTex.wrapS = suitBlueTex.wrapT = THREE.RepeatWrapping;
suitBlueTex.repeat.set(4, 4);

function std(color, roughness = 0.6, metalness = 0.1, extra = {}, tex = null) {
    const key = `${color}:${roughness}:${metalness}:${extra.emissive || 0}:${tex ? tex.uuid : 'none'}`;
    if (!matCache.has(key)) {
        const params = { color, roughness, metalness, ...extra };
        if (tex) params.map = tex;
        matCache.set(key, new THREE.MeshStandardMaterial(params));
    }
    return matCache.get(key);
}

export function buildHero() {
    const group = new THREE.Group();
    // High-res materials
    const red = std(0xbb1111, 0.4, 0.1, {}, suitRedTex);
    const navy = std(0x0a1c3a, 0.6, 0.2, {}, suitBlueTex);
    const dark = std(0x080a0f, 0.5, 0.3);
    const visor = std(0xffffff, 0.1, 0.6, { emissive: 0xffffff, emissiveIntensity: 0.2 });
    const gold = std(0xffcc00, 0.3, 0.8, { emissive: 0x664400, emissiveIntensity: 0.5 });
    
    // High segment counts for smooth, non-geometric look
    const capSeg = 12, radSeg = 16;
    
    const hips = new THREE.Group();
    group.add(hips);

    const parts = { legs: [], arms: [], feet: [], hands: [] };

    // Pelvis (muscular)
    const pelvis = new THREE.Mesh(limbGeometry({
        length: 0.32, r0: 0.12, r1: 0.09, bulge: 0.02, pinch: 0, seg: 12, rings: 6
    }), navy);
    pelvis.rotation.z = Math.PI / 2;
    pelvis.position.set(0.16, 0.9, 0);
    hips.add(pelvis);

    for (const sx of [-1, 1]) {
        const leg = new THREE.Group();
        leg.position.set(sx * 0.13, 0.92, 0);
        hips.add(leg);
        
        // Thigh
        const thigh = new THREE.Mesh(limbGeometry({
            length: 0.38, r0: 0.09, r1: 0.065, bulge: 0.025, bulgeAt: 0.28
        }), navy);
        leg.add(thigh);
        
        // Knee
        const knee = new THREE.Mesh(new THREE.SphereGeometry(0.065, radSeg, capSeg), navy);
        knee.position.y = -0.4;
        leg.add(knee);

        // Calf (Shin)
        const shin = new THREE.Group();
        shin.position.y = -0.4;
        leg.add(shin);
        
        const calfMesh = new THREE.Mesh(limbGeometry({
            length: 0.32, r0: 0.07, r1: 0.05, bulge: 0.02, bulgeAt: 0.35, pinch: 0.2
        }), red);
        shin.add(calfMesh);

        const boot = new THREE.Mesh(limbGeometry({
            length: 0.16, r0: 0.055, r1: 0.04, bulge: 0.01, bulgeAt: 0.4, pinch: 0
        }), red);
        boot.rotation.x = Math.PI / 2;
        boot.position.set(0, -0.32, 0.02);
        shin.add(boot);
        
        parts.legs.push(leg);
        parts.feet.push(boot);
    }

    const torso = new THREE.Group();
    torso.position.y = 0.96;
    hips.add(torso);

    // Torso Core
    const core = new THREE.Mesh(torsoGeometry({ height: 0.48, girth: 0.2, style: 'human' }), navy);
    torso.add(core);

    const chest = new THREE.Mesh(limbGeometry({
        length: 0.22, r0: 0.16, r1: 0.14, bulge: 0.03, bulgeAt: 0.4, pinch: 0
    }), red);
    chest.position.y = 0.42;
    chest.scale.set(1.15, 1, 0.85);
    torso.add(chest);

    // Back / Lats
    const lats = new THREE.Mesh(limbGeometry({
        length: 0.36, r0: 0.13, r1: 0.1, bulge: 0.03, pinch: 0, seg: 12, rings: 6
    }), navy);
    lats.rotation.z = Math.PI / 2;
    lats.position.set(0.18, 0.34, -0.06);
    torso.add(lats);

    // Spider Emblem (Front & Back)
    const emblemF = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 16), dark);
    emblemF.rotation.x = Math.PI / 2;
    emblemF.position.set(0, 0.38, 0.17);
    emblemF.scale.set(1, 1, 1.4);
    torso.add(emblemF);

    const emblemB = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.02, 16), red);
    emblemB.rotation.x = Math.PI / 2;
    emblemB.position.set(0, 0.35, -0.15);
    torso.add(emblemB);

    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.02, 8, 24), red);
    belt.rotation.x = Math.PI / 2;
    belt.position.y = 0.02;
    torso.add(belt);

    // Neck
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.1, 16), red);
    neck.position.set(0, 0.52, 0.02);
    torso.add(neck);

    // Head
    const head = new THREE.Group();
    head.position.set(0, 0.56, 0.02);
    torso.add(head);
    
    const skull = new THREE.Mesh(headGeometry(0.13, 'human'), red);
    skull.position.y = 0.12;
    skull.scale.set(0.95, 1.08, 1.05);
    head.add(skull);

    // Realistic Lenses
    for (const sx of [-1, 1]) {
        const lensBase = new THREE.Group();
        lensBase.position.set(sx * 0.05, 0.14, 0.11);
        lensBase.rotation.y = sx * 0.3;
        lensBase.rotation.z = sx * -0.15;
        head.add(lensBase);

        const rim = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.06, 8, 16), dark);
        rim.rotation.z = Math.PI / 2;
        rim.scale.set(1, 1, 0.4);
        lensBase.add(rim);

        const glass = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.05, 8, 16), visor);
        glass.rotation.z = Math.PI / 2;
        glass.position.z = 0.01;
        glass.scale.set(1, 1, 0.5);
        lensBase.add(glass);
    }

    for (const sx of [-1, 1]) {
        const arm = new THREE.Group();
        arm.position.set(sx * 0.26, 0.42, 0);
        torso.add(arm);
        
        // Shoulder
        const deltoid = new THREE.Mesh(new THREE.SphereGeometry(0.09, radSeg, capSeg), red);
        arm.add(deltoid);

        // Bicep
        const upper = new THREE.Mesh(limbGeometry({
            length: 0.28, r0: 0.07, r1: 0.055, bulge: 0.02, bulgeAt: 0.3
        }), navy);
        arm.add(upper);
        
        // Elbow
        const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.055, radSeg, capSeg), red);
        elbow.position.y = -0.28;
        arm.add(elbow);

        const forearm = new THREE.Group();
        forearm.position.y = -0.28;
        arm.add(forearm);
        
        // Lower arm
        const lower = new THREE.Mesh(limbGeometry({
            length: 0.24, r0: 0.055, r1: 0.042, bulge: 0.012, bulgeAt: 0.4, pinch: 0.15
        }), red);
        forearm.add(lower);
        
        // Web Shooter
        const shooter = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.08), dark);
        shooter.position.set(0, -0.22, 0.04);
        forearm.add(shooter);
        
        const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.04, 8), gold);
        nozzle.rotation.x = Math.PI / 2;
        nozzle.position.set(0, -0.22, 0.08);
        forearm.add(nozzle);
        
        // Hand (Fist/Claws)
        const hand = new THREE.Mesh(limbGeometry({
            length: 0.08, r0: 0.04, r1: 0.045, bulge: 0.008, bulgeAt: 0.5, pinch: 0, seg: 10, rings: 5
        }), red);
        hand.position.set(0, -0.24, 0.01);
        forearm.add(hand);
        
        arm.userData.forearm = forearm;
        arm.userData.hand = hand;
        parts.arms.push(arm);
        parts.hands.push(hand);
    }

    group.traverse((c) => {
        if (c.isMesh) {
            c.castShadow = true;
            c.receiveShadow = true;
        }
    });

    parts.torso = torso;
    parts.head = head;
    parts.hips = hips;
    parts.emblem = emblemF;

    return { group, parts };
}

export function poseHero(parts, { grounded, swinging, speed, phase, lookPitch = 0 }) {
    const run = grounded ? Math.min(1, speed / 8) : 0;
    const swing = swinging ? 1 : 0;
    const air = !grounded && !swinging ? 1 : 0;

    for (let i = 0; i < 2; i++) {
        const s = i === 0 ? 1 : -1;
        const leg = parts.legs[i];
        const arm = parts.arms[i];
        const walk = Math.sin(phase + i * Math.PI) * run;
        
        leg.rotation.x = walk * 0.85 + air * (-0.35 + s * 0.15) + swing * 0.6;
        
        const thighRot = leg.rotation.x;
        // Bending knee
        const shin = leg.children[2]; // shin is 3rd child (thigh, knee, shin)
        if (shin) {
            let kneeBend = run * (walk < 0 ? -walk * 1.5 : 0) + air * 0.4 + swing * 0.8;
            shin.rotation.x = -kneeBend;
        }

        arm.rotation.x = -walk * 0.7 + air * (-1.3) + swing * (-2.6);
        arm.rotation.z = s * (0.15 + air * 0.6 + swing * 0.2);
        arm.userData.forearm.rotation.x = run * 0.3 + swing * -0.2 + air * 0.5;
    }
    parts.torso.rotation.x = run * 0.15 + swing * 0.4 + air * 0.2;
    parts.head.rotation.x = lookPitch * 0.3 - swing * 0.2;
    parts.hips.rotation.z = Math.sin(phase) * run * 0.08;
    parts.hips.position.y = run * Math.abs(Math.sin(phase * 2)) * 0.05;
}
