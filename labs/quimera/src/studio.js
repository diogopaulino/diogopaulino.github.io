/**
 * Ateliê ao entardecer: pódio, lanternas, vaga-lumes e céu em degradê.
 */

import * as THREE from 'three';

export function buildStudio(quality = 'high') {
    const root = new THREE.Group();
    const skyTex = makeSky();
    const sky = new THREE.Mesh(
        new THREE.SphereGeometry(28, 32, 20),
        new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, depthWrite: false })
    );
    sky.rotation.y = 0.4;
    root.add(sky);

    const floor = new THREE.Mesh(
        new THREE.CircleGeometry(7.5, 48),
        new THREE.MeshStandardMaterial({
            color: 0x3a2a38,
            roughness: 0.92,
            metalness: 0.04
        })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    root.add(floor);

    const ring = new THREE.Mesh(
        new THREE.RingGeometry(1.15, 1.28, 48),
        new THREE.MeshStandardMaterial({
            color: 0xc9a227,
            roughness: 0.35,
            metalness: 0.55,
            emissive: 0x6a4a10,
            emissiveIntensity: 0.25
        })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.012;
    ring.receiveShadow = true;
    root.add(ring);

    const podium = new THREE.Mesh(
        new THREE.CylinderGeometry(1.12, 1.18, 0.12, 40),
        new THREE.MeshStandardMaterial({
            color: 0x6a4a38,
            roughness: 0.62,
            metalness: 0.08
        })
    );
    podium.position.y = 0.06;
    podium.receiveShadow = true;
    podium.castShadow = true;
    root.add(podium);

    const top = new THREE.Mesh(
        new THREE.CylinderGeometry(1.05, 1.05, 0.04, 40),
        new THREE.MeshStandardMaterial({
            color: 0xc4a07a,
            roughness: 0.48,
            metalness: 0.12
        })
    );
    top.position.y = 0.13;
    top.receiveShadow = true;
    root.add(top);

    addLanterns(root);
    const motes = addMotes(root, quality === 'low' ? 40 : quality === 'medium' ? 80 : 140);

    return { root, sky, motes, podium };
}

function makeSky() {
    const c = document.createElement('canvas');
    c.width = 8;
    c.height = 64;
    const g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, 64);
    grd.addColorStop(0, '#1b1430');
    grd.addColorStop(0.38, '#4a2e58');
    grd.addColorStop(0.62, '#c4786a');
    grd.addColorStop(0.82, '#e8b888');
    grd.addColorStop(1, '#f0d4b0');
    g.fillStyle = grd;
    g.fillRect(0, 0, 8, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

function addLanterns(root) {
    const spots = [
        [-2.4, 2.1, -1.6],
        [2.6, 2.4, -1.2],
        [-1.6, 1.8, 2.2],
        [1.8, 2.0, 2.0],
        [0.2, 2.6, -2.4]
    ];
    const mat = new THREE.MeshStandardMaterial({
        color: 0xf0c070,
        emissive: 0xf0a040,
        emissiveIntensity: 0.9,
        roughness: 0.4,
        metalness: 0.05
    });
    const cord = new THREE.MeshStandardMaterial({ color: 0x3a2a24, roughness: 0.8 });
    spots.forEach((p, i) => {
        const g = new THREE.Group();
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12 + (i % 3) * 0.02, 16, 12), mat);
        bulb.position.set(0, 0, 0);
        const string = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.4, 6), cord);
        string.position.y = 0.7;
        g.add(bulb, string);
        g.position.set(p[0], p[1], p[2]);
        g.userData.phase = i * 1.3;
        root.add(g);
        g.userData.lantern = true;
    });
}

function addMotes(root, count) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const phase = new Float32Array(count);
    for (let i = 0; i < count; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 8;
        pos[i * 3 + 1] = 0.3 + Math.random() * 3.2;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 8;
        phase[i] = Math.random() * Math.PI * 2;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('phase', new THREE.BufferAttribute(phase, 1));
    const mat = new THREE.PointsMaterial({
        color: 0xffe6b0,
        size: 0.045,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
        sizeAttenuation: true
    });
    const pts = new THREE.Points(geo, mat);
    root.add(pts);
    return pts;
}

export function lightStudio(scene) {
    const hemi = new THREE.HemisphereLight(0xf0c8b0, 0x3a2438, 0.7);
    scene.add(hemi);

    const key = new THREE.DirectionalLight(0xffe0c0, 1.35);
    key.position.set(3.2, 6.2, 4.4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 16;
    key.shadow.camera.left = -4;
    key.shadow.camera.right = 4;
    key.shadow.camera.top = 4;
    key.shadow.camera.bottom = -4;
    key.shadow.bias = -0.0008;
    scene.add(key);

    const rim = new THREE.DirectionalLight(0xc8a0e8, 0.55);
    rim.position.set(-4, 3, -3);
    scene.add(rim);

    const fill = new THREE.PointLight(0xf0a060, 0.6, 8, 1.6);
    fill.position.set(0, 2.4, 2.2);
    scene.add(fill);

    return { hemi, key, rim, fill };
}

export function updateStudio(studio, t) {
    studio.root.children.forEach((c) => {
        if (c.userData.lantern) {
            c.position.y += Math.sin(t * 0.8 + c.userData.phase) * 0.0007;
            c.rotation.z = Math.sin(t * 0.6 + c.userData.phase) * 0.04;
        }
    });
    if (studio.motes) {
        const pos = studio.motes.geometry.attributes.position;
        const phase = studio.motes.geometry.attributes.phase;
        for (let i = 0; i < pos.count; i++) {
            const p = phase.getX(i);
            pos.setY(i, 0.4 + ((Math.sin(t * 0.35 + p) * 0.5 + 0.5) * 3.0));
            pos.setX(i, pos.getX(i) + Math.sin(t * 0.2 + p) * 0.0015);
        }
        pos.needsUpdate = true;
    }
}
