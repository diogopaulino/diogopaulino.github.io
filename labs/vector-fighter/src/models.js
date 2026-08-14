/**
 * Lutadores low-poly no espírito Virtua Fighter 1 (1993):
 * caixas e cilindros de 6 faces, Lambert com flat shading e arestas visíveis.
 * Nenhum glTF — a silhueta é o personagem.
 */

import * as THREE from 'three';

const geo = {
    box: new THREE.BoxGeometry(1, 1, 1),
    sphere6: new THREE.SphereGeometry(1, 6, 5),
    sphere8: new THREE.SphereGeometry(1, 8, 6),
    cyl6: new THREE.CylinderGeometry(1, 1, 1, 6),
    cyl8: new THREE.CylinderGeometry(1, 1, 1, 8),
    cone6: new THREE.ConeGeometry(1, 1, 6)
};

const EDGE = new THREE.LineBasicMaterial({
    color: 0x140c0a,
    transparent: true,
    opacity: 0.42,
    depthWrite: false
});

function lambert(color, { em = 0, emissive = 0x000000 } = {}) {
    const mat = new THREE.MeshLambertMaterial({
        color,
        emissive,
        emissiveIntensity: em,
        flatShading: true
    });
    mat.polygonOffset = true;
    mat.polygonOffsetFactor = 1;
    mat.polygonOffsetUnits = 1;
    return mat;
}

function part(geometry, material, { pos, scale, rot, edges = true } = {}) {
    const m = new THREE.Mesh(geometry, material);
    if (pos) m.position.set(pos[0], pos[1], pos[2]);
    if (scale) m.scale.set(scale[0], scale[1], scale[2]);
    if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
    m.castShadow = true;
    m.receiveShadow = true;
    if (edges) {
        const line = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 22), EDGE);
        if (scale) line.scale.set(1, 1, 1);
        m.add(line);
    }
    return m;
}

function bone(name, y = 0, x = 0, z = 0) {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(x, y, z);
    return g;
}

/**
 * Constrói um lutador hierárquico (ossos + malhas) a partir da ficha do roster.
 * `userData.bones` alimenta o mixer de poses em fighter.js.
 */
export function createFighterModel(def, { showEdges = true } = {}) {
    const pal = def.palette;
    const bulk = def.stats.bulk;
    const h = 0.92 + (bulk - 1) * 0.15;
    const w = 0.92 + (bulk - 1) * 0.55;

    const skin = lambert(pal.skin);
    const hair = lambert(pal.hair);
    const primary = lambert(pal.primary);
    const secondary = lambert(pal.secondary);
    const accent = lambert(pal.accent, pal.accent > 0x404040 ? { em: 0.08, emissive: pal.accent } : {});
    const shoes = lambert(pal.shoes);
    const eyeW = lambert(0xf7f2ea);
    const eyeI = lambert(0x1a1210);

    const root = new THREE.Group();
    root.name = def.id;

    const hips = bone('hips', 0.98 * h);
    root.add(hips);

    const pelvis = part(geo.box, secondary, {
        scale: [0.42 * w, 0.18, 0.28],
        edges: showEdges
    });
    hips.add(pelvis);

    const torso = bone('torso', 0.16);
    hips.add(torso);
    torso.add(part(geo.box, primary, {
        pos: [0, 0.28, 0],
        scale: [0.5 * w, 0.58, 0.32],
        edges: showEdges
    }));

    const head = bone('head', 0.68);
    torso.add(head);
    head.add(part(geo.sphere8, skin, {
        scale: [0.22 * (0.95 + w * 0.05), 0.24, 0.21],
        edges: showEdges
    }));

    // Sobrancelhas em caixa — o “cara de VF”.
    const browY = 0.06 + (def.look.brow || 0);
    head.add(part(geo.box, hair, {
        pos: [0.08, browY, 0.17],
        scale: [0.09, 0.03, 0.04],
        rot: [0, 0, -0.15],
        edges: false
    }));
    head.add(part(geo.box, hair, {
        pos: [-0.08, browY, 0.17],
        scale: [0.09, 0.03, 0.04],
        rot: [0, 0, 0.15],
        edges: false
    }));
    head.add(part(geo.box, eyeW, { pos: [0.07, 0.02, 0.18], scale: [0.055, 0.045, 0.03], edges: false }));
    head.add(part(geo.box, eyeW, { pos: [-0.07, 0.02, 0.18], scale: [0.055, 0.045, 0.03], edges: false }));
    head.add(part(geo.box, eyeI, { pos: [0.07, 0.02, 0.2], scale: [0.03, 0.03, 0.02], edges: false }));
    head.add(part(geo.box, eyeI, { pos: [-0.07, 0.02, 0.2], scale: [0.03, 0.03, 0.02], edges: false }));

    dressHair(head, def.look.hair, hair, secondary, showEdges);

    const lArm = bone('lArm', 0.46, 0.3 * w, 0);
    const rArm = bone('rArm', 0.46, -0.3 * w, 0);
    torso.add(lArm, rArm);
    lArm.add(part(geo.cyl6, skin, { pos: [0, -0.16, 0], scale: [0.075 * w, 0.32, 0.075 * w], edges: showEdges }));
    rArm.add(part(geo.cyl6, skin, { pos: [0, -0.16, 0], scale: [0.075 * w, 0.32, 0.075 * w], edges: showEdges }));

    const lFore = bone('lFore', -0.34);
    const rFore = bone('rFore', -0.34);
    lArm.add(lFore);
    rArm.add(rFore);
    lFore.add(part(geo.cyl6, skin, { pos: [0, -0.14, 0], scale: [0.065 * w, 0.28, 0.065 * w], edges: showEdges }));
    rFore.add(part(geo.cyl6, skin, { pos: [0, -0.14, 0], scale: [0.065 * w, 0.28, 0.065 * w], edges: showEdges }));

    const lHand = bone('lHand', -0.3);
    const rHand = bone('rHand', -0.3);
    lFore.add(lHand);
    rFore.add(rHand);
    lHand.add(part(geo.box, skin, { scale: [0.1, 0.1, 0.12], edges: showEdges }));
    rHand.add(part(geo.box, skin, { scale: [0.1, 0.1, 0.12], edges: showEdges }));

    const lThigh = bone('lThigh', -0.04, 0.13 * w, 0);
    const rThigh = bone('rThigh', -0.04, -0.13 * w, 0);
    hips.add(lThigh, rThigh);
    lThigh.add(part(geo.cyl6, primary, { pos: [0, -0.22, 0], scale: [0.1 * w, 0.4, 0.1 * w], edges: showEdges }));
    rThigh.add(part(geo.cyl6, primary, { pos: [0, -0.22, 0], scale: [0.1 * w, 0.4, 0.1 * w], edges: showEdges }));

    const lShin = bone('lShin', -0.42);
    const rShin = bone('rShin', -0.42);
    lThigh.add(lShin);
    rThigh.add(rShin);
    lShin.add(part(geo.cyl6, secondary, { pos: [0, -0.2, 0], scale: [0.085 * w, 0.38, 0.085 * w], edges: showEdges }));
    rShin.add(part(geo.cyl6, secondary, { pos: [0, -0.2, 0], scale: [0.085 * w, 0.38, 0.085 * w], edges: showEdges }));

    const lFoot = bone('lFoot', -0.4);
    const rFoot = bone('rFoot', -0.4);
    lShin.add(lFoot);
    rShin.add(rFoot);
    lFoot.add(part(geo.box, shoes, { pos: [0, 0.02, 0.08], scale: [0.16, 0.08, 0.3], edges: showEdges }));
    rFoot.add(part(geo.box, shoes, { pos: [0, 0.02, 0.08], scale: [0.16, 0.08, 0.3], edges: showEdges }));

    dressGear(hips, torso, def.look.gear, { primary, secondary, accent, skin, showEdges, w });

    root.userData.bones = {
        hips, torso, head,
        lArm, lFore, lHand,
        rArm, rFore, rHand,
        lThigh, lShin, lFoot,
        rThigh, rShin, rFoot
    };
    root.userData.palette = pal;
    root.userData.height = 1.72 * h;
    return root;
}

function dressHair(head, style, hair, secondary, edges) {
    if (style === 'bald') {
        head.add(part(geo.box, hair, { pos: [0, -0.02, 0.18], scale: [0.16, 0.08, 0.06], edges: false }));
        return;
    }
    if (style === 'short') {
        head.add(part(geo.sphere8, hair, { pos: [0, 0.1, -0.02], scale: [0.24, 0.16, 0.22], edges }));
        head.add(part(geo.box, hair, { pos: [0, 0.04, -0.02], scale: [0.44, 0.05, 0.08], edges: false }));
        return;
    }
    if (style === 'pony') {
        head.add(part(geo.sphere8, hair, { pos: [0, 0.12, -0.02], scale: [0.25, 0.16, 0.24], edges }));
        head.add(part(geo.cyl6, hair, { pos: [0, -0.02, -0.22], rot: [0.7, 0, 0], scale: [0.07, 0.42, 0.07], edges }));
        return;
    }
    if (style === 'buns') {
        head.add(part(geo.sphere8, hair, { pos: [0, 0.1, -0.02], scale: [0.24, 0.14, 0.22], edges }));
        head.add(part(geo.sphere6, hair, { pos: [0.2, 0.14, -0.04], scale: [0.1, 0.1, 0.1], edges }));
        head.add(part(geo.sphere6, hair, { pos: [-0.2, 0.14, -0.04], scale: [0.1, 0.1, 0.1], edges }));
        return;
    }
    if (style === 'mask') {
        head.add(part(geo.sphere8, hair, { pos: [0, 0.1, -0.04], scale: [0.24, 0.16, 0.22], edges }));
        head.add(part(geo.box, hair, { pos: [0, 0.0, 0.16], scale: [0.34, 0.22, 0.12], edges }));
        head.add(part(geo.box, secondary, { pos: [0, -0.04, 0.2], scale: [0.22, 0.08, 0.06], edges: false }));
        return;
    }
    // crop
    head.add(part(geo.sphere8, hair, { pos: [0, 0.1, -0.03], scale: [0.23, 0.12, 0.22], edges }));
}

function dressGear(hips, torso, gear, ctx) {
    const { primary, secondary, accent, showEdges, w } = ctx;
    if (gear === 'gi') {
        hips.add(part(geo.box, primary, {
            pos: [0, -0.12, 0.02],
            scale: [0.5 * w, 0.28, 0.3],
            edges: showEdges
        }));
        torso.add(part(geo.box, accent, {
            pos: [0, 0.02, 0.17],
            scale: [0.46 * w, 0.08, 0.04],
            edges: false
        }));
        return;
    }
    if (gear === 'wrestler') {
        torso.add(part(geo.box, primary, {
            pos: [0, 0.02, 0],
            scale: [0.36 * w, 0.22, 0.28],
            edges: showEdges
        }));
        hips.add(part(geo.box, accent, { pos: [0, 0.12, 0.16], scale: [0.18, 0.06, 0.04], edges: false }));
        return;
    }
    if (gear === 'silk') {
        hips.add(part(geo.box, primary, {
            pos: [0, -0.18, 0],
            scale: [0.52 * w, 0.4, 0.3],
            edges: showEdges
        }));
        torso.add(part(geo.box, accent, {
            pos: [0, 0.34, 0.17],
            scale: [0.22, 0.08, 0.04],
            edges: false
        }));
        return;
    }
    if (gear === 'ninja') {
        torso.add(part(geo.box, secondary, {
            pos: [0, 0.18, -0.2],
            scale: [0.36, 0.55, 0.06],
            rot: [0.15, 0, 0],
            edges: showEdges
        }));
        torso.add(part(geo.box, accent, {
            pos: [0, 0.02, 0.17],
            scale: [0.2, 0.05, 0.03],
            edges: false
        }));
        return;
    }
    if (gear === 'tank') {
        torso.add(part(geo.cyl6, accent, {
            pos: [0, 0.12, 0.12],
            scale: [0.04, 0.12, 0.04],
            edges: false
        }));
        return;
    }
    // sport — faixa na cintura
    hips.add(part(geo.box, accent, {
        pos: [0, 0.08, 0],
        scale: [0.46 * w, 0.06, 0.3],
        edges: false
    }));
}

export function createShadowDecal() {
    const mat = new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.32,
        depthWrite: false
    });
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(0.55, 12), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.03;
    mesh.renderOrder = 1;
    return mesh;
}
