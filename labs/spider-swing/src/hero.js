import * as THREE from 'three';
import { PALETTE } from './config.js';

const matCache = new Map();
const texLoader = new THREE.TextureLoader();
const suitRedTex = texLoader.load('./assets/red_suit.jpg');
suitRedTex.wrapS = suitRedTex.wrapT = THREE.RepeatWrapping;
suitRedTex.repeat.set(2, 2);

const suitBlueTex = texLoader.load('./assets/blue_suit.jpg');
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
    const pelvis = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.08, capSeg, radSeg), navy);
    pelvis.rotation.z = Math.PI / 2;
    pelvis.scale.set(1, 0.8, 1);
    hips.add(pelvis);

    for (const sx of [-1, 1]) {
        const leg = new THREE.Group();
        leg.position.set(sx * 0.13, 0.92, 0);
        hips.add(leg);
        
        // Thigh
        const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.25, capSeg, radSeg), navy);
        thigh.position.y = -0.18;
        // make it thicker at top, using scale doesn't taper capsules easily, but we can scale non-uniform
        thigh.scale.set(1.1, 1, 1.2);
        leg.add(thigh);
        
        // Knee
        const knee = new THREE.Mesh(new THREE.SphereGeometry(0.065, radSeg, capSeg), navy);
        knee.position.y = -0.4;
        leg.add(knee);

        // Calf (Shin)
        const shin = new THREE.Group();
        shin.position.y = -0.4;
        leg.add(shin);
        
        const calfMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.24, capSeg, radSeg), red);
        calfMesh.position.y = -0.18;
        calfMesh.scale.set(1, 1, 1.1);
        shin.add(calfMesh);

        // Boot/Foot
        const boot = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.12, capSeg, radSeg), red);
        boot.rotation.x = Math.PI / 2;
        boot.position.set(0, -0.42, 0.06);
        boot.scale.set(1, 1, 0.7);
        shin.add(boot);
        
        parts.legs.push(leg);
        parts.feet.push(boot);
    }

    const torso = new THREE.Group();
    torso.position.y = 0.96;
    hips.add(torso);

    // Torso Core
    const core = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.2, capSeg, radSeg), navy);
    core.position.y = 0.15;
    core.scale.set(1.2, 1, 0.9);
    torso.add(core);

    // Chest (Pecs)
    const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.15, capSeg, radSeg), red);
    chest.position.y = 0.35;
    chest.rotation.z = Math.PI / 2;
    chest.scale.set(1, 1.4, 0.9);
    torso.add(chest);

    // Back / Lats
    const lats = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.18, capSeg, radSeg), navy);
    lats.position.set(0, 0.32, -0.05);
    lats.rotation.z = Math.PI / 2;
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
    
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 24), red);
    skull.position.y = 0.12;
    skull.scale.set(0.9, 1.15, 1.05);
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
        const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.18, capSeg, radSeg), navy);
        upper.position.y = -0.14;
        arm.add(upper);
        
        // Elbow
        const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.055, radSeg, capSeg), red);
        elbow.position.y = -0.28;
        arm.add(elbow);

        const forearm = new THREE.Group();
        forearm.position.y = -0.28;
        arm.add(forearm);
        
        // Lower arm
        const lower = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.16, capSeg, radSeg), red);
        lower.position.y = -0.12;
        lower.scale.set(1, 1, 1);
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
        const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055, radSeg, capSeg), red);
        hand.position.set(0, -0.28, 0.01);
        hand.scale.set(1, 1.2, 0.8);
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
