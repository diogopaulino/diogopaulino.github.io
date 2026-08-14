/**
 * Cinturão de asteroides (InstancedMesh) e um cometa com cauda oposta ao sol.
 */

import * as THREE from 'three';

function rockyGeometry(rng, radius) {
    const geo = new THREE.IcosahedronGeometry(radius, 1);
    const pos = geo.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        const n = 0.72 + rng() * 0.5;
        v.normalize().multiplyScalar(radius * n);
        pos.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    return geo;
}

export function createAsteroidBelt({ inner, outer, count, rng, ySpread = 2.4 }) {
    const geo = rockyGeometry(rng, 1);
    const mat = new THREE.MeshStandardMaterial({
        color: 0x8a8178,
        roughness: 0.92,
        metalness: 0.08,
        emissive: 0x2a241c,
        emissiveIntensity: 0.45
    });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    for (let i = 0; i < count; i++) {
        const radius = inner + rng() * (outer - inner);
        const theta = rng() * Math.PI * 2;
        const y = (rng() - 0.5) * ySpread;
        const s = 0.18 + rng() * 0.55;
        dummy.position.set(Math.cos(theta) * radius, y, Math.sin(theta) * radius);
        dummy.rotation.set(rng() * 6, rng() * 6, rng() * 6);
        dummy.scale.setScalar(s);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        color.setHSL(0.07 + rng() * 0.06, 0.18, 0.28 + rng() * 0.22);
        mesh.setColorAt(i, color);
    }
    mesh.instanceColor.needsUpdate = true;
    mesh.instanceMatrix.needsUpdate = true;

    return {
        mesh,
        update(dt) {
            mesh.rotation.y += dt * 0.018;
        }
    };
}

export function createComet(rng) {
    const group = new THREE.Group();
    const nucleus = new THREE.Mesh(
        rockyGeometry(rng, 0.55),
        new THREE.MeshStandardMaterial({
            color: 0xc8d4e8,
            roughness: 0.55,
            metalness: 0.15,
            emissive: 0x88aacc,
            emissiveIntensity: 0.25
        })
    );
    nucleus.userData.pick = true;
    group.add(nucleus);

    const tailCount = 90;
    const tailPos = new Float32Array(tailCount * 3);
    const tailCol = new Float32Array(tailCount * 3);
    for (let i = 0; i < tailCount; i++) {
        const t = i / tailCount;
        tailCol[i * 3] = 0.55 + (1 - t) * 0.4;
        tailCol[i * 3 + 1] = 0.75 + (1 - t) * 0.2;
        tailCol[i * 3 + 2] = 1.0;
    }
    const tailGeo = new THREE.BufferGeometry();
    tailGeo.setAttribute('position', new THREE.BufferAttribute(tailPos, 3));
    tailGeo.setAttribute('color', new THREE.BufferAttribute(tailCol, 3));
    const tail = new THREE.Line(
        tailGeo,
        new THREE.LineBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0.75,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        })
    );
    group.add(tail);

    const tmp = new THREE.Vector3();
    const side = new THREE.Vector3();

    return {
        group,
        pickMesh: nucleus,
        update(worldPos) {
            group.position.copy(worldPos);
            const dir = tmp.copy(worldPos).normalize();
            side.set(-dir.z, 0.15, dir.x).normalize();
            const pos = tailGeo.attributes.position;
            for (let i = 0; i < tailCount; i++) {
                const t = i / (tailCount - 1);
                const wobble = Math.sin(t * 14.0 + worldPos.x * 0.05) * t * 0.8;
                pos.setXYZ(
                    i,
                    dir.x * t * 18 + side.x * wobble,
                    dir.y * t * 18 + 0.3 * t,
                    dir.z * t * 18 + side.z * wobble
                );
            }
            pos.needsUpdate = true;
        }
    };
}
