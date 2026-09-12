/**
 * GT procedural low-poly — corpo, cabine, rodas esterçáveis e luzes.
 * Sem assets externos: rápido de carregar e fácil de tintar.
 */

import * as THREE from 'three';

const SHARED = {
    wheel: null,
    tire: null
};

function getWheelGeo() {
    if (!SHARED.wheel) {
        SHARED.tire = new THREE.CylinderGeometry(0.33, 0.33, 0.24, 12, 1);
        SHARED.tire.rotateZ(Math.PI / 2);
        SHARED.wheel = new THREE.CylinderGeometry(0.2, 0.2, 0.18, 10, 1);
        SHARED.wheel.rotateZ(Math.PI / 2);
    }
    return SHARED;
}

export function createCarMesh(paint = 0xc4281c, accent = 0x1a0a08) {
    const root = new THREE.Group();
    root.name = 'car';

    const bodyMat = new THREE.MeshStandardMaterial({
        color: paint, metalness: 0.72, roughness: 0.28, envMapIntensity: 0.9
    });
    const darkMat = new THREE.MeshStandardMaterial({
        color: accent, metalness: 0.4, roughness: 0.65
    });
    const glassMat = new THREE.MeshStandardMaterial({
        color: 0x88aacc, metalness: 0.9, roughness: 0.12, transparent: true, opacity: 0.55
    });
    const lightMat = new THREE.MeshStandardMaterial({
        color: 0xfff2c8, emissive: 0xffcc66, emissiveIntensity: 0.85, roughness: 0.35
    });
    const tailMat = new THREE.MeshStandardMaterial({
        color: 0xff2030, emissive: 0xff1020, emissiveIntensity: 0.4, roughness: 0.4
    });
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9, metalness: 0.1 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xc8c8c8, metalness: 0.85, roughness: 0.3 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.42, 4.2), bodyMat);
    body.position.y = 0.48;
    body.castShadow = true;
    body.receiveShadow = true;
    root.add(body);

    const nose = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.28, 0.9), bodyMat);
    nose.position.set(0, 0.42, 1.85);
    nose.castShadow = true;
    root.add(nose);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.38, 1.6), darkMat);
    cabin.position.set(0, 0.78, -0.15);
    cabin.castShadow = true;
    root.add(cabin);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 1.35), bodyMat);
    roof.position.set(0, 1.0, -0.2);
    root.add(roof);

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.32, 0.08), glassMat);
    windshield.position.set(0, 0.82, 0.62);
    windshield.rotation.x = -0.45;
    root.add(windshield);

    const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.28, 0.08), glassMat);
    rearGlass.position.set(0, 0.82, -0.95);
    rearGlass.rotation.x = 0.4;
    root.add(rearGlass);

    for (const x of [-0.72, 0.72]) {
        const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.22), darkMat);
        mirror.position.set(x, 0.7, 0.55);
        root.add(mirror);
    }

    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.35), bodyMat);
    spoiler.position.set(0, 0.95, -1.85);
    root.add(spoiler);

    for (const x of [-0.55, 0.55]) {
        const hl = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.08), lightMat);
        hl.position.set(x, 0.42, 2.28);
        root.add(hl);
        const tl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.08), tailMat);
        tl.position.set(x, 0.48, -2.12);
        root.add(tl);
    }

    const geos = getWheelGeo();
    const wheels = [];
    const positions = [
        [-0.82, 0.33, 1.35],
        [0.82, 0.33, 1.35],
        [-0.82, 0.33, -1.35],
        [0.82, 0.33, -1.35]
    ];
    for (let i = 0; i < 4; i++) {
        const pivot = new THREE.Group();
        pivot.position.set(...positions[i]);
        const tire = new THREE.Mesh(geos.tire, tireMat);
        tire.castShadow = true;
        const rim = new THREE.Mesh(geos.wheel, rimMat);
        pivot.add(tire, rim);
        root.add(pivot);
        wheels.push(pivot);
    }

    root.userData = { wheels, bodyMat, tailMat, lightMat };
    return root;
}

export function syncCarMesh(mesh, vehicle) {
    mesh.position.set(vehicle.x, vehicle.y, vehicle.z);
    mesh.rotation.order = 'YXZ';
    mesh.rotation.y = vehicle.yaw;
    mesh.rotation.x = vehicle.pitch;
    mesh.rotation.z = vehicle.roll;

    const wheels = mesh.userData.wheels;
    if (!wheels) return;
    for (let i = 0; i < 4; i++) {
        const w = wheels[i];
        w.rotation.x = vehicle.wheelAngle;
        if (i < 2) w.rotation.y = vehicle.steerAngle * 0.85;
        else w.rotation.y = 0;
    }
    const brakeGlow = 0.35 + vehicle.brake * 1.4;
    if (mesh.userData.tailMat) mesh.userData.tailMat.emissiveIntensity = brakeGlow;
}
