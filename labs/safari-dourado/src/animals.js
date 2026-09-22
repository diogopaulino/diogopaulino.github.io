/**
 * Fauna africana em malhas esculpidas (músculo, crânio, pernas).
 * Olhos continuam esferas pequenas. Sem billboards.
 */
import { createMuscle, createSkull } from '../../shared/realism-bjs.js';

function pbr(BABYLON, scene, name, hex, roughness = 0.72, metallic = 0.04) {
    const m = new BABYLON.PBRMaterial(name, scene);
    m.albedoColor = BABYLON.Color3.FromHexString(hex);
    m.roughness = roughness;
    m.metallic = metallic;
    return m;
}

function addCapsule(BABYLON, scene, parent, name, height, radius, pos, mat, rot = null, scale = null) {
    const mesh = createMuscle(scene, name, {
        length: Math.max(radius * 2.2, height * 0.82),
        r0: radius * 1.18,
        r1: radius * 0.78,
        bulge: radius * 0.4,
        bulgeAt: 0.36,
        pinch: 0.2,
        tessellation: 12,
        rings: 8
    });
    mesh.parent = parent;
    mesh.position.set(pos[0], pos[1], pos[2]);
    mesh.material = mat;
    mesh.isPickable = false;
    mesh.receiveShadows = true;
    if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]);
    if (scale) mesh.scaling.set(scale[0], scale[1], scale[2]);
    return mesh;
}

function addSkull(BABYLON, scene, parent, name, diameter, pos, mat, scale = null, style = 'dog') {
    const mesh = createSkull(scene, name, { diameter, style, segments: 16 });
    mesh.parent = parent;
    mesh.position.set(pos[0], pos[1], pos[2]);
    mesh.material = mat;
    mesh.receiveShadows = true;
    if (scale) mesh.scaling.set(scale[0], scale[1], scale[2]);
    return mesh;
}

function addEar(BABYLON, scene, parent, name, pos, mat, { height = 0.8, width = 0.45, thick = 0.04, rotY = 0 } = {}) {
    const shape = [
        new BABYLON.Vector3(0, 0, 0),
        new BABYLON.Vector3(width * 0.75, height * 0.28, 0),
        new BABYLON.Vector3(width * 0.12, height, 0),
        new BABYLON.Vector3(-width * 0.55, height * 0.5, 0),
        new BABYLON.Vector3(-width * 0.15, height * 0.08, 0)
    ];
    const mesh = BABYLON.MeshBuilder.ExtrudeShape(name, {
        shape,
        path: [
            new BABYLON.Vector3(0, 0, -thick * 0.5),
            new BABYLON.Vector3(0, 0, thick * 0.5)
        ],
        cap: BABYLON.Mesh.CAP_ALL,
        closeShape: true
    }, scene);
    mesh.parent = parent;
    mesh.position.set(pos[0], pos[1], pos[2]);
    mesh.rotation.y = rotY;
    mesh.material = mat;
    mesh.isPickable = false;
    return mesh;
}

function addSphere(BABYLON, scene, parent, name, diameter, pos, mat, scale = null) {
    const mesh = BABYLON.MeshBuilder.CreateSphere(name, { diameter, segments: 18 }, scene);
    mesh.parent = parent;
    mesh.position.set(pos[0], pos[1], pos[2]);
    mesh.material = mat;
    mesh.isPickable = false;
    if (scale) mesh.scaling.set(scale[0], scale[1], scale[2]);
    return mesh;
}

function addCyl(BABYLON, scene, parent, name, opts, pos, mat, rot = null) {
    const mesh = BABYLON.MeshBuilder.CreateCylinder(name, {
        tessellation: 16,
        ...opts
    }, scene);
    mesh.parent = parent;
    mesh.position.set(pos[0], pos[1], pos[2]);
    mesh.material = mat;
    mesh.isPickable = false;
    if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]);
    return mesh;
}

function addLegs(BABYLON, scene, root, mat, xs, zFront, zBack, y, h, r) {
    for (const x of xs) {
        for (const z of [zFront, zBack]) {
            addCapsule(BABYLON, scene, root, 'perna', h, r, [x, y, z], mat);
        }
    }
}

export function buildGiraffe(BABYLON, scene) {
    const root = new BABYLON.TransformNode('giraffe_root', scene);
    const hide = pbr(BABYLON, scene, 'giraffe_hide', '#c4a05a', 0.78);
    const dark = pbr(BABYLON, scene, 'giraffe_dark', '#5a3a1c', 0.82);
    const mane = pbr(BABYLON, scene, 'giraffe_mane', '#3a2814', 0.9);

    const body = addCapsule(BABYLON, scene, root, 'corpo', 2.4, 0.55, [0, 2.35, 0], hide, [Math.PI / 2, 0, 0], [1.15, 1, 0.95]);
    addLegs(BABYLON, scene, root, dark, [-0.32, 0.32], 0.75, -0.7, 1.05, 2.0, 0.12);
    addCapsule(BABYLON, scene, root, 'pescoço', 2.6, 0.16, [0, 4.0, 0.35], hide, [0.35, 0, 0]);
    addSkull(BABYLON, scene, root, 'cabeça', 0.55, [0, 5.35, 0.95], hide, [0.85, 0.75, 1.2], 'dog');
    addCapsule(BABYLON, scene, root, 'focinho', 0.45, 0.12, [0, 5.2, 1.35], hide, [Math.PI / 2, 0, 0]);
    for (const sx of [-1, 1]) {
        addCyl(BABYLON, scene, root, 'osso', { height: 0.22, diameter: 0.06 }, [sx * 0.1, 5.65, 0.9], dark);
        addSphere(BABYLON, scene, root, 'olho', 0.07, [sx * 0.18, 5.38, 1.15], mane);
    }
    addCapsule(BABYLON, scene, root, 'crina', 1.8, 0.035, [0, 4.1, 0.12], mane, [0.35, 0, 0]);
    addCapsule(BABYLON, scene, root, 'cauda', 0.9, 0.06, [0, 2.1, -1.35], dark, [0.9, 0, 0]);

    return { root, body, species: 'giraffe', name: 'Girafa-da-savana' };
}

export function buildElephant(BABYLON, scene) {
    const root = new BABYLON.TransformNode('elephant_root', scene);
    const hide = pbr(BABYLON, scene, 'elephant_hide', '#8a8680', 0.88, 0.02);
    const dark = pbr(BABYLON, scene, 'elephant_dark', '#5a5650', 0.9);
    const ivory = pbr(BABYLON, scene, 'elephant_ivory', '#e8dcc0', 0.35, 0.08);
    ivory.clearCoat.isEnabled = true;
    ivory.clearCoat.intensity = 0.35;

    const body = addCapsule(BABYLON, scene, root, 'corpo', 3.1, 0.95, [0, 1.7, 0], hide, [Math.PI / 2, 0, 0], [1.15, 1, 1.25]);
    addLegs(BABYLON, scene, root, dark, [-0.55, 0.55], 0.7, -0.75, 0.7, 1.35, 0.28);
    addSkull(BABYLON, scene, root, 'cabeça', 1.35, [0, 2.15, 1.55], hide, [1.05, 0.95, 1.05], 'dog');
    for (const sx of [-1, 1]) {
        addEar(BABYLON, scene, root, 'orelha', [sx * 0.9, 1.7, 1.3], hide, {
            height: 1.15, width: 0.72, thick: 0.06, rotY: sx * 0.6
        });
        addCyl(BABYLON, scene, root, 'presa', { height: 0.95, diameterTop: 0.06, diameterBottom: 0.12 },
            [sx * 0.28, 1.55, 2.15], ivory, [1.1, 0, sx * 0.15]);
        addSphere(BABYLON, scene, root, 'olho', 0.1, [sx * 0.35, 2.25, 2.05], dark);
    }
    // Tromba segmentada
    const trunk = new BABYLON.TransformNode('tromba', scene);
    trunk.parent = root;
    trunk.position.set(0, 1.75, 2.15);
    for (let i = 0; i < 5; i++) {
        const r = 0.18 - i * 0.02;
        addCapsule(BABYLON, scene, trunk, 'seg', 0.38, r, [0, -0.2 - i * 0.28, 0.08 + i * 0.06], hide, [0.4 + i * 0.08, 0, 0]);
    }
    addCapsule(BABYLON, scene, root, 'cauda', 0.7, 0.07, [0, 1.4, -1.9], dark, [0.7, 0, 0]);

    return { root, body, species: 'elephant', name: 'Elefante-africano' };
}

export function buildZebra(BABYLON, scene) {
    const root = new BABYLON.TransformNode('zebra_root', scene);
    const hide = pbr(BABYLON, scene, 'zebra_hide', '#f2efe6', 0.7);
    const stripe = pbr(BABYLON, scene, 'zebra_stripe', '#1a1814', 0.75);
    const hoof = pbr(BABYLON, scene, 'zebra_hoof', '#2a2418', 0.85);

    const body = addCapsule(BABYLON, scene, root, 'corpo', 1.55, 0.38, [0, 1.15, 0], hide, [Math.PI / 2, 0, 0], [1.1, 1, 0.95]);
    // Faixas no flanco
    for (let i = 0; i < 5; i++) {
        const band = addCyl(BABYLON, scene, root, 'faixa', { height: 0.72, diameter: 0.78 },
            [0, 1.15, -0.5 + i * 0.25], stripe, [Math.PI / 2, 0, 0]);
        band.scaling.set(0.14, 1, 1);
    }
    addLegs(BABYLON, scene, root, hide, [-0.22, 0.22], 0.45, -0.5, 0.55, 1.0, 0.09);
    for (const x of [-0.22, 0.22]) {
        for (const z of [0.45, -0.5]) {
            addCapsule(BABYLON, scene, root, 'casco', 0.12, 0.07, [x, 0.08, z], hoof, null, [1.15, 0.55, 1.2]);
        }
    }
    addCapsule(BABYLON, scene, root, 'pescoço', 0.7, 0.12, [0, 1.65, 0.55], hide, [0.55, 0, 0]);
    addSkull(BABYLON, scene, root, 'cabeça', 0.42, [0, 1.95, 0.95], hide, [0.75, 0.7, 1.15], 'dog');
    addCapsule(BABYLON, scene, root, 'focinho', 0.35, 0.1, [0, 1.85, 1.25], hide, [Math.PI / 2, 0, 0]);
    for (const sx of [-1, 1]) {
        addSphere(BABYLON, scene, root, 'olho', 0.06, [sx * 0.14, 2.0, 1.05], stripe);
        addEar(BABYLON, scene, root, 'orelha', [sx * 0.12, 2.08, 0.82], hide, {
            height: 0.22, width: 0.08, thick: 0.012, rotY: sx * 0.35
        });
    }
    addCapsule(BABYLON, scene, root, 'crina', 0.55, 0.03, [0, 1.85, 0.4], stripe, [0.55, 0, 0]);
    addCapsule(BABYLON, scene, root, 'cauda', 0.7, 0.05, [0, 1.15, -0.95], stripe, [0.85, 0, 0]);

    return { root, body, species: 'zebra', name: 'Zebra-da-planície' };
}
