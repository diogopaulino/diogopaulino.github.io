/**
 * Fauna africana em malhas 3D PBR (cápsulas/cilindros/esferas densas).
 * Sem billboards — silhuetas legíveis a distância, sombra real.
 */

function pbr(BABYLON, scene, name, hex, roughness = 0.72, metallic = 0.04) {
    const m = new BABYLON.PBRMaterial(name, scene);
    m.albedoColor = BABYLON.Color3.FromHexString(hex);
    m.roughness = roughness;
    m.metallic = metallic;
    return m;
}

function addCapsule(BABYLON, scene, parent, name, height, radius, pos, mat, rot = null, scale = null) {
    const mesh = BABYLON.MeshBuilder.CreateCapsule(name, {
        height, radius, tessellation: 16, subdivisions: 4
    }, scene);
    mesh.parent = parent;
    mesh.position.set(pos[0], pos[1], pos[2]);
    mesh.material = mat;
    mesh.isPickable = false;
    mesh.receiveShadows = true;
    if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]);
    if (scale) mesh.scaling.set(scale[0], scale[1], scale[2]);
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
    addCyl(BABYLON, scene, root, 'pescoço', { height: 2.6, diameterTop: 0.28, diameterBottom: 0.38 }, [0, 4.0, 0.35], hide, [0.35, 0, 0]);
    addSphere(BABYLON, scene, root, 'cabeça', 0.55, [0, 5.35, 0.95], hide, [0.85, 0.75, 1.2]);
    addCapsule(BABYLON, scene, root, 'focinho', 0.45, 0.12, [0, 5.2, 1.35], hide, [Math.PI / 2, 0, 0]);
    for (const sx of [-1, 1]) {
        addCyl(BABYLON, scene, root, 'osso', { height: 0.22, diameter: 0.06 }, [sx * 0.1, 5.65, 0.9], dark);
        addSphere(BABYLON, scene, root, 'olho', 0.07, [sx * 0.18, 5.38, 1.15], mane);
    }
    addCyl(BABYLON, scene, root, 'crina', { height: 1.8, diameterTop: 0.04, diameterBottom: 0.08 }, [0, 4.1, 0.12], mane, [0.35, 0, 0]);
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

    const body = addSphere(BABYLON, scene, root, 'corpo', 2.6, [0, 1.7, 0], hide, [1.35, 1.05, 1.55]);
    addLegs(BABYLON, scene, root, dark, [-0.55, 0.55], 0.7, -0.75, 0.7, 1.35, 0.28);
    addSphere(BABYLON, scene, root, 'cabeça', 1.35, [0, 2.15, 1.55], hide, [1.05, 0.95, 1.0]);
    for (const sx of [-1, 1]) {
        addSphere(BABYLON, scene, root, 'orelha', 1.1, [sx * 0.95, 2.25, 1.35], hide, [0.18, 1.0, 0.75]);
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
            addSphere(BABYLON, scene, root, 'casco', 0.14, [x, 0.08, z], hoof, [1, 0.55, 1.1]);
        }
    }
    addCyl(BABYLON, scene, root, 'pescoço', { height: 0.7, diameterTop: 0.2, diameterBottom: 0.28 }, [0, 1.65, 0.55], hide, [0.55, 0, 0]);
    addSphere(BABYLON, scene, root, 'cabeça', 0.42, [0, 1.95, 0.95], hide, [0.75, 0.7, 1.15]);
    addCapsule(BABYLON, scene, root, 'focinho', 0.35, 0.1, [0, 1.85, 1.25], hide, [Math.PI / 2, 0, 0]);
    for (const sx of [-1, 1]) {
        addSphere(BABYLON, scene, root, 'olho', 0.06, [sx * 0.14, 2.0, 1.05], stripe);
        addSphere(BABYLON, scene, root, 'orelha', 0.12, [sx * 0.12, 2.2, 0.85], hide, [0.55, 1.1, 0.45]);
    }
    addCyl(BABYLON, scene, root, 'crina', { height: 0.55, diameterTop: 0.04, diameterBottom: 0.08 }, [0, 1.85, 0.4], stripe, [0.55, 0, 0]);
    addCapsule(BABYLON, scene, root, 'cauda', 0.7, 0.05, [0, 1.15, -0.95], stripe, [0.85, 0, 0]);

    return { root, body, species: 'zebra', name: 'Zebra-da-planície' };
}
