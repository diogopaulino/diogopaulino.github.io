/**
 * Hovers hiper-realistas com glow e a bola de éter (casca física + núcleo).
 * Capsule / Lathe / cilindros densos — sem pilhas de caixas.
 */

import * as THREE from 'three';
import { BALL, TEAMS } from './config.js';

function bodyMat(color, emissive, extra = {}) {
    return new THREE.MeshPhysicalMaterial({
        color,
        metalness: 0.72,
        roughness: 0.22,
        clearcoat: 0.65,
        clearcoatRoughness: 0.18,
        emissive,
        emissiveIntensity: 0.35,
        ...extra
    });
}

function hullProfile() {
    // Perfil longitudinal do casco (raio × comprimento) — Lathe em torno de Y, depois rotaciona.
    return [
        new THREE.Vector2(0.02, -1.05),
        new THREE.Vector2(0.28, -0.85),
        new THREE.Vector2(0.48, -0.35),
        new THREE.Vector2(0.52, 0.15),
        new THREE.Vector2(0.42, 0.65),
        new THREE.Vector2(0.22, 0.95),
        new THREE.Vector2(0.06, 1.12)
    ];
}

export function createCraft(team) {
    const def = TEAMS[team];
    const root = new THREE.Group();
    const dark = bodyMat(0x12161f, 0x000000, { metalness: 0.85, roughness: 0.28, clearcoat: 0.4 });
    const paint = bodyMat(def.accent, def.color, { emissiveIntensity: 0.22, metalness: 0.55, roughness: 0.28 });
    const glow = new THREE.MeshBasicMaterial({
        color: def.color,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    const hullGeo = new THREE.LatheGeometry(hullProfile(), 48);
    hullGeo.rotateZ(-Math.PI / 2);
    hullGeo.scale(1, 0.55, 0.72);
    const hull = new THREE.Mesh(hullGeo, paint);
    hull.position.y = 0.18;
    hull.castShadow = true;
    root.add(hull);

    const nose = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.28, 0.55, 8, 24),
        paint
    );
    nose.rotation.z = Math.PI / 2;
    nose.position.set(1.05, 0.18, 0);
    nose.scale.set(1, 0.85, 1.15);
    nose.castShadow = true;
    root.add(nose);

    const cabin = new THREE.Mesh(
        new THREE.SphereGeometry(0.42, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.55),
        new THREE.MeshPhysicalMaterial({
            color: 0x071018,
            metalness: 0.15,
            roughness: 0.06,
            transmission: 0.55,
            thickness: 0.25,
            clearcoat: 1,
            clearcoatRoughness: 0.05,
            emissive: def.color,
            emissiveIntensity: 0.45,
            transparent: true,
            opacity: 0.82
        })
    );
    cabin.position.set(0.12, 0.38, 0);
    cabin.rotation.z = -0.15;
    root.add(cabin);

    const wingPts = [
        new THREE.Vector2(0.02, -0.75),
        new THREE.Vector2(0.08, -0.4),
        new THREE.Vector2(0.06, 0.2),
        new THREE.Vector2(0.03, 0.7)
    ];
    const wingGeo = new THREE.LatheGeometry(wingPts, 24);
    wingGeo.scale(1, 0.12, 1);
    const wingL = new THREE.Mesh(wingGeo, dark);
    const wingR = wingL.clone();
    wingL.position.set(-0.1, 0.12, 0.78);
    wingR.position.set(-0.1, 0.12, -0.78);
    wingL.rotation.z = 0.1;
    wingR.rotation.z = 0.1;
    wingL.scale.set(0.9, 1, 1.55);
    wingR.scale.set(0.9, 1, 1.55);
    root.add(wingL, wingR);

    const stripe = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.05, 1.85, 4, 12),
        glow
    );
    stripe.rotation.z = Math.PI / 2;
    stripe.position.set(0.05, 0.4, 0);
    root.add(stripe);

    const engineGeo = new THREE.CylinderGeometry(0.14, 0.2, 0.38, 24);
    const engL = new THREE.Mesh(engineGeo, dark);
    const engR = engL.clone();
    engL.rotation.z = Math.PI / 2;
    engR.rotation.z = Math.PI / 2;
    engL.position.set(-1.15, 0.16, 0.28);
    engR.position.set(-1.15, 0.16, -0.28);
    root.add(engL, engR);

    const intake = new THREE.Mesh(
        new THREE.TorusGeometry(0.15, 0.035, 12, 28),
        bodyMat(0x1a2030, def.color, { emissiveIntensity: 0.5, metalness: 0.9, roughness: 0.15 })
    );
    const inL = intake.clone();
    const inR = intake.clone();
    inL.rotation.y = Math.PI / 2;
    inR.rotation.y = Math.PI / 2;
    inL.position.set(-1.32, 0.16, 0.28);
    inR.position.set(-1.32, 0.16, -0.28);
    root.add(inL, inR);

    const flameGeo = new THREE.ConeGeometry(0.16, 0.7, 20);
    const flameMat = new THREE.MeshBasicMaterial({
        color: 0xffe08a,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const flameL = new THREE.Mesh(flameGeo, flameMat);
    const flameR = new THREE.Mesh(flameGeo, flameMat.clone());
    flameL.rotation.z = Math.PI / 2;
    flameR.rotation.z = Math.PI / 2;
    flameL.position.set(-1.45, 0.16, 0.28);
    flameR.position.set(-1.45, 0.16, -0.28);
    root.add(flameL, flameR);

    const under = new THREE.PointLight(def.color, 4.5, 9, 2);
    under.position.set(0, -0.15, 0);
    root.add(under);

    const disc = new THREE.Mesh(
        new THREE.CircleGeometry(0.62, 48),
        new THREE.MeshBasicMaterial({
            color: def.color,
            transparent: true,
            opacity: 0.22,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide
        })
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = -0.42;
    root.add(disc);

    root.userData = { flames: [flameL, flameR], under, disc, team };
    root.rotation.order = 'YXZ';
    return root;
}

export function createBall() {
    const root = new THREE.Group();
    const shell = new THREE.Mesh(
        new THREE.IcosahedronGeometry(BALL.radius, 4),
        new THREE.MeshPhysicalMaterial({
            color: 0xf4f0ff,
            metalness: 0.08,
            roughness: 0.08,
            transmission: 0.62,
            thickness: 0.45,
            ior: 1.4,
            clearcoat: 1,
            clearcoatRoughness: 0.05,
            emissive: 0xfff4c8,
            emissiveIntensity: 0.55,
            transparent: true,
            opacity: 0.88
        })
    );
    shell.castShadow = true;
    root.add(shell);

    const core = new THREE.Mesh(
        new THREE.IcosahedronGeometry(BALL.radius * 0.45, 3),
        new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            emissive: 0xffe8a8,
            emissiveIntensity: 1.4,
            roughness: 0.15,
            metalness: 0.1,
            clearcoat: 0.8,
            transparent: true,
            opacity: 0.92
        })
    );
    root.add(core);

    const halo = new THREE.Mesh(
        new THREE.SphereGeometry(BALL.radius * 1.18, 48, 32),
        new THREE.MeshBasicMaterial({
            color: 0xffe08a,
            transparent: true,
            opacity: 0.18,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        })
    );
    root.add(halo);

    const light = new THREE.PointLight(0xffe8a8, 16, 16, 2);
    root.add(light);
    root.userData = { shell, core, halo, light };
    return root;
}

export function syncCraft(mesh, craft, dt) {
    mesh.position.set(craft.x, craft.y, craft.z);
    // Modelo com nariz em +X; o yaw da física aponta (sin, cos) = +Z em 0.
    mesh.rotation.y = craft.yaw - Math.PI / 2;
    const hx = Math.sin(craft.yaw);
    const hz = Math.cos(craft.yaw);
    const fwd = craft.vx * hx + craft.vz * hz;
    const lat = craft.vx * hz - craft.vz * hx;
    const tilt = THREE.MathUtils.clamp(-lat * 0.045, -0.32, 0.32);
    const pitch = THREE.MathUtils.clamp(-fwd * 0.012, -0.22, 0.22);
    mesh.rotation.z = THREE.MathUtils.damp(mesh.rotation.z, tilt, 8, dt);
    mesh.rotation.x = THREE.MathUtils.damp(mesh.rotation.x, pitch, 8, dt);
    const boost = craft.boosting ? 1 : 0.12;
    for (const f of mesh.userData.flames) {
        f.material.opacity = THREE.MathUtils.damp(f.material.opacity, boost, 12, dt);
        f.scale.y = 0.7 + boost * 1.4 + Math.random() * 0.2;
    }
    mesh.userData.under.intensity = 3.2 + (craft.boosting ? 6 : 0);
    mesh.userData.disc.material.opacity = 0.22 + (craft.boosting ? 0.35 : 0);
}

export function syncBall(mesh, ball, t) {
    mesh.position.set(ball.x, ball.y, ball.z);
    mesh.userData.shell.rotation.y = t * 1.6;
    mesh.userData.core.rotation.x = -t * 2.4;
    const pulse = 1 + Math.sin(t * 6) * 0.04;
    mesh.userData.halo.scale.setScalar(pulse);
}
