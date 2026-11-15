/**
 * Skyline arquitetônico da orla de Santos + Serra do Mar ao fundo + navios fundeados na baía.
 * Usa 4 arquétipos esculpidos (varandas salientes, coroamento, caixa d'água, brises)
 * mesclados em InstancedMesh para alto detalhe com 60fps.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ORLA_LENGTH, ZONES, CANALS } from './config.js';
import { seeded } from './utils.js';
import { createFacadeTextures } from './pbr.js';

const PALETTE = [0xe4ded2, 0xf0ece4, 0xd4cdc0, 0xc2ccd0, 0xe8dfd0, 0xd6dbe0, 0xf4efe6, 0xdfd4c4];

function buildArchetypeModernist() {
    const parts = [];
    // Corpo principal (recuado para dar profundidade às sacadas)
    const core = new THREE.BoxGeometry(0.88, 0.92, 0.84);
    core.translate(0, 0.46, 0);
    parts.push(core);

    // Embasamento comercial térreo
    const podium = new THREE.BoxGeometry(1.04, 0.1, 1.04);
    podium.translate(0, 0.05, 0);
    parts.push(podium);

    // Lajes de sacada salientes a cada andar
    const slabs = 10;
    for (let i = 1; i <= slabs; i++) {
        const slab = new THREE.BoxGeometry(0.98, 0.018, 0.96);
        slab.translate(0, 0.1 + (i / slabs) * 0.82, 0.02);
        parts.push(slab);
    }

    // Cobertura + casa de máquinas + caixa d'água típica de Santos
    const crown = new THREE.BoxGeometry(0.96, 0.035, 0.94);
    crown.translate(0, 0.935, 0);
    parts.push(crown);

    const penthouse = new THREE.BoxGeometry(0.46, 0.075, 0.44);
    penthouse.translate(-0.1, 0.985, -0.08);
    parts.push(penthouse);

    const tank = new THREE.CylinderGeometry(0.11, 0.12, 0.08, 10);
    tank.translate(0.22, 0.985, -0.1);
    parts.push(tank);

    const merged = mergeGeometries(parts, false);
    parts.forEach((p) => p.dispose());
    return merged;
}

function buildArchetypeTwinFin() {
    const parts = [];
    const body = new THREE.BoxGeometry(0.84, 0.94, 0.82);
    body.translate(0, 0.47, 0);
    parts.push(body);

    // Aletas verticais modernas (pilares/brises externos)
    for (const fx of [-0.44, -0.15, 0.15, 0.44]) {
        const fin = new THREE.BoxGeometry(0.05, 0.95, 0.94);
        fin.translate(fx, 0.475, 0.02);
        parts.push(fin);
    }

    // Marquise frontal
    const canopy = new THREE.BoxGeometry(0.96, 0.025, 0.25);
    canopy.translate(0, 0.11, 0.48);
    parts.push(canopy);

    // Coroamento escalonado
    const top1 = new THREE.BoxGeometry(0.7, 0.06, 0.7);
    top1.translate(0, 0.97, 0);
    parts.push(top1);

    const top2 = new THREE.BoxGeometry(0.35, 0.06, 0.35);
    top2.translate(0, 1.03, -0.05);
    parts.push(top2);

    const merged = mergeGeometries(parts, false);
    parts.forEach((p) => p.dispose());
    return merged;
}

function buildArchetypeStepped() {
    const parts = [];
    const base = new THREE.BoxGeometry(1.0, 0.18, 0.98);
    base.translate(0, 0.09, 0);
    parts.push(base);

    const mid = new THREE.BoxGeometry(0.86, 0.56, 0.86);
    mid.translate(0, 0.46, 0);
    parts.push(mid);

    const upper = new THREE.BoxGeometry(0.72, 0.22, 0.72);
    upper.translate(0, 0.85, -0.03);
    parts.push(upper);

    // Brises horizontais frontais
    for (let i = 0; i < 6; i++) {
        const brise = new THREE.BoxGeometry(0.9, 0.016, 0.08);
        brise.translate(0, 0.22 + i * 0.09, 0.45);
        parts.push(brise);
    }

    const spire = new THREE.CylinderGeometry(0.02, 0.06, 0.12, 8);
    spire.translate(0, 1.02, -0.03);
    parts.push(spire);

    const merged = mergeGeometries(parts, false);
    parts.forEach((p) => p.dispose());
    return merged;
}

function buildArchetypeChamfered() {
    const parts = [];
    const tower = new THREE.CylinderGeometry(0.56, 0.58, 0.92, 8);
    tower.rotateY(Math.PI / 8);
    tower.scale(0.95, 1, 0.88);
    tower.translate(0, 0.46, 0);
    parts.push(tower);

    for (let i = 1; i <= 8; i++) {
        const ring = new THREE.CylinderGeometry(0.6, 0.6, 0.018, 8);
        ring.rotateY(Math.PI / 8);
        ring.scale(0.96, 1, 0.9);
        ring.translate(0, 0.08 + (i / 8) * 0.82, 0);
        parts.push(ring);
    }

    const dome = new THREE.CylinderGeometry(0.32, 0.45, 0.07, 8);
    dome.rotateY(Math.PI / 8);
    dome.translate(0, 0.955, 0);
    parts.push(dome);

    const merged = mergeGeometries(parts, false);
    parts.forEach((p) => p.dispose());
    return merged;
}

/** Serra do Mar & Morros de Santos ao fundo da cidade. */
function buildSerraDoMar() {
    const g = new THREE.Group();
    const width = ORLA_LENGTH + 400;
    const depth = 160;
    const geo = new THREE.PlaneGeometry(width, depth, 96, 20);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const cLow = new THREE.Color(0x2d4d32);
    const cHigh = new THREE.Color(0x1f3a29);
    const cRock = new THREE.Color(0x4b544d);
    const tmp = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        // Altura sobe conforme vai para o interior (z negativo)
        const inlandT = THREE.MathUtils.clamp((-z + depth * 0.5) / depth, 0, 1);
        const ridge1 = Math.sin(x * 0.012 + 0.5) * 0.5 + 0.5;
        const ridge2 = Math.cos(x * 0.028 - 1.1) * 0.5 + 0.5;
        const ridge3 = Math.sin(x * 0.065 + z * 0.04) * 0.5 + 0.5;
        const h = Math.pow(inlandT, 1.35) * (28 + ridge1 * 38 + ridge2 * 22 + ridge3 * 10);
        pos.setY(i, h - 1);

        const t = THREE.MathUtils.clamp(h / 75, 0, 1);
        tmp.copy(cLow).lerp(cHigh, t);
        if (ridge3 > 0.78 && h > 40) tmp.lerp(cRock, 0.35);
        colors[i * 3] = tmp.r;
        colors[i * 3 + 1] = tmp.g;
        colors[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.92,
        metalness: 0.0
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, 0, ZONES.inland - depth * 0.45);
    g.add(mesh);
    return g;
}

/** Navios cargueiros fundeados na baía de Santos (silhueta clássica do horizonte). */
function buildAnchoredShips() {
    const g = new THREE.Group();
    const hullMat = new THREE.MeshStandardMaterial({ color: 0x1e2833, roughness: 0.65, metalness: 0.25 });
    const redMat = new THREE.MeshStandardMaterial({ color: 0x7c2924, roughness: 0.7 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xeceae4, roughness: 0.55 });
    const containerMats = [
        new THREE.MeshStandardMaterial({ color: 0x9c3228, roughness: 0.6 }),
        new THREE.MeshStandardMaterial({ color: 0x22567c, roughness: 0.6 }),
        new THREE.MeshStandardMaterial({ color: 0x2e6e48, roughness: 0.6 })
    ];

    const positions = [
        { x: -190, z: 135, rot: 0.25, scale: 1.0 },
        { x: 65, z: 150, rot: -0.18, scale: 1.15 },
        { x: 250, z: 128, rot: 0.38, scale: 0.9 }
    ];

    for (const sp of positions) {
        const ship = new THREE.Group();
        const hull = new THREE.Mesh(new THREE.BoxGeometry(26, 2.6, 5.2), hullMat);
        hull.position.y = 1.1;
        const boot = new THREE.Mesh(new THREE.BoxGeometry(25.6, 0.8, 5.1), redMat);
        boot.position.y = 0.2;
        const bow = new THREE.Mesh(new THREE.ConeGeometry(2.6, 5.5, 4), hullMat);
        bow.rotation.z = -Math.PI / 2;
        bow.rotation.x = Math.PI / 4;
        bow.scale.set(0.65, 1, 1);
        bow.position.set(15.2, 1.3, 0);

        const bridge = new THREE.Mesh(new THREE.BoxGeometry(4.2, 4.4, 4.6), whiteMat);
        bridge.position.set(-9.5, 4.2, 0);
        const funnel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 2.4, 10), redMat);
        funnel.position.set(-10.8, 7.2, 0);

        ship.add(hull, boot, bow, bridge, funnel);

        // Pilhas de contêineres coloridos no convés
        for (let c = 0; c < 4; c++) {
            const stack = new THREE.Mesh(
                new THREE.BoxGeometry(3.8, 1.6 + (c % 2) * 0.8, 4.0),
                containerMats[c % containerMats.length]
            );
            stack.position.set(-4 + c * 4.4, 3.1 + (c % 2) * 0.3, 0);
            ship.add(stack);
        }

        ship.position.set(sp.x, 0, sp.z);
        ship.rotation.y = sp.rot;
        ship.scale.setScalar(sp.scale);
        ship.userData.baseY = 0;
        ship.userData.phase = sp.x * 0.05;
        g.add(ship);
    }
    return g;
}

export function createCity(quality) {
    const root = new THREE.Group();
    root.name = 'city';
    const rand = seeded(0x5a47105);
    const total = quality.buildingCount;

    const { map: facadeTex, emissive: emissiveTex } = createFacadeTextures();
    const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: facadeTex,
        bumpMap: facadeTex,
        bumpScale: 0.06,
        emissive: new THREE.Color(0xffdfa8),
        emissiveMap: emissiveTex,
        emissiveIntensity: 0.02,
        roughness: 0.62,
        metalness: 0.14
    });

    const archetypes = [
        buildArchetypeModernist(),
        buildArchetypeTwinFin(),
        buildArchetypeStepped(),
        buildArchetypeChamfered()
    ];

    const perType = Math.max(1, Math.ceil(total / archetypes.length));
    const meshes = archetypes.map((geo) => {
        const inst = new THREE.InstancedMesh(geo, mat, perType);
        inst.castShadow = true;
        inst.receiveShadow = true;
        inst.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(perType * 3), 3);
        return { inst, count: 0 };
    });

    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const color = new THREE.Color();

    for (let i = 0; i < total; i++) {
        let x = (rand() - 0.5) * (ORLA_LENGTH - 24);
        for (const c of CANALS) {
            if (Math.abs(x - c.x) < c.width + 6) x += (x < c.x ? -1 : 1) * (c.width + 7);
        }

        const front = i < total * 0.58;
        const row = front ? 0 : rand() < 0.6 ? 1 : 2;
        const z = front
            ? ZONES.buildings - rand() * 5
            : ZONES.buildings - row * 16 - rand() * 8;
        const w = front ? 6 + rand() * 7 : 5 + rand() * 7;
        const d = front ? 5.5 + rand() * 4.5 : 5 + rand() * 5;
        const floors = front ? 9 + Math.floor(rand() * 15) : 5 + Math.floor(rand() * 12);
        const h = floors * 2.9;

        const bucket = meshes[i % meshes.length];
        if (bucket.count >= perType) continue;

        p.set(x, 0, z);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), front ? 0 : (rand() - 0.5) * 0.12);
        s.set(w, h, d);
        m.compose(p, q, s);
        bucket.inst.setMatrixAt(bucket.count, m);
        color.set(PALETTE[(rand() * PALETTE.length) | 0]);
        bucket.inst.setColorAt(bucket.count, color);
        bucket.count++;
    }

    for (const b of meshes) {
        b.inst.count = b.count;
        b.inst.instanceMatrix.needsUpdate = true;
        if (b.inst.instanceColor) b.inst.instanceColor.needsUpdate = true;
        root.add(b.inst);
    }

    // Solo urbano
    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(ORLA_LENGTH + 140, 140),
        new THREE.MeshStandardMaterial({ color: 0x3b3e44, roughness: 0.94 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0.01, ZONES.buildings - 45);
    ground.receiveShadow = true;
    root.add(ground);

    // Serra do Mar ao fundo e navios fundeados na baía
    root.add(buildSerraDoMar());
    const ships = buildAnchoredShips();
    root.add(ships);

    return {
        root,
        windowMat: mat,
        update(t) {
            for (const ship of ships.children) {
                ship.position.y = Math.sin(t * 0.7 + ship.userData.phase) * 0.22;
                ship.rotation.z = Math.sin(t * 0.5 + ship.userData.phase) * 0.015;
            }
        },
        setNight(night) {
            mat.emissiveIntensity = night ? 1.15 : 0.02;
        }
    };
}
