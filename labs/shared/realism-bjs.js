/**
 * Malhas orgânicas para labs em Babylon.js.
 * Membros em tubo com raio muscular, crânio esculpido, sapato e mão.
 * BABYLON é global (script do CDN antes do módulo).
 */
import { headRadiusMul, limbRadius, sampleKeys, torsoKeys } from './anatomy.js';

const B = () => window.BABYLON;

function normalsOf(mesh) {
    const positions = mesh.getVerticesData(B().VertexBuffer.PositionKind);
    const indices = mesh.getIndices();
    const normals = [];
    B().VertexData.ComputeNormals(positions, indices, normals);
    mesh.setVerticesData(B().VertexBuffer.NormalKind, normals);
}

/** Tubo centrado no origem, eixo Y, comprimento `length`. */
export function createMuscle(scene, name, {
    length = 0.4,
    r0 = 0.08,
    r1 = 0.06,
    bulge = 0.018,
    bulgeAt = 0.35,
    pinch = 0.35,
    tessellation = 14,
    rings = 9
} = {}) {
    const path = [];
    for (let i = 0; i <= rings; i++) {
        const t = i / rings;
        path.push(new (B().Vector3)(0, (0.5 - t) * length, 0));
    }
    const mesh = B().MeshBuilder.CreateTube(name, {
        path,
        radiusFunction: (i) => limbRadius(i / rings, r0, r1, bulge, bulgeAt, pinch),
        tessellation,
        cap: B().Mesh.CAP_ALL,
        updatable: false
    }, scene);
    mesh.isPickable = false;
    return mesh;
}

/** Esfera deslocada: nariz, órbitas, queixo. +Z = frente. */
export function createSkull(scene, name, { diameter = 0.3, style = 'human', segments = 18, front = 1 } = {}) {
    const mesh = B().MeshBuilder.CreateSphere(name, { diameter, segments }, scene);
    const positions = mesh.getVerticesData(B().VertexBuffer.PositionKind);
    const R = diameter * 0.5;
    for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i];
        const y = positions[i + 1];
        const z = positions[i + 2];
        const len = Math.hypot(x, y, z) || 1;
        const m = headRadiusMul(x / len, y / len, (z / len) * front, style);
        positions[i] = (x / len) * R * m;
        positions[i + 1] = (y / len) * R * m;
        positions[i + 2] = (z / len) * R * m;
    }
    mesh.setVerticesData(B().VertexBuffer.PositionKind, positions);
    normalsOf(mesh);
    mesh.isPickable = false;
    return mesh;
}

/** Sapato de perfil extrudado. Origem no tornozelo. */
export function createShoe(scene, name, { length = 0.22, width = 0.1, height = 0.09 } = {}) {
    const shape = [
        new (B().Vector3)(-length * 0.42, 0, 0),
        new (B().Vector3)(length * 0.35, 0, 0),
        new (B().Vector3)(length * 0.55, height * 0.35, 0),
        new (B().Vector3)(length * 0.28, height * 0.85, 0),
        new (B().Vector3)(-length * 0.15, height, 0),
        new (B().Vector3)(-length * 0.48, height * 0.55, 0)
    ];
    const path = [
        new (B().Vector3)(0, 0, -width * 0.5),
        new (B().Vector3)(0, 0, width * 0.5)
    ];
    const mesh = B().MeshBuilder.ExtrudeShape(name, {
        shape,
        path,
        cap: B().Mesh.CAP_ALL,
        closeShape: true
    }, scene);
    mesh.position.y = -height * 0.15;
    mesh.isPickable = false;
    return mesh;
}

export function createHand(scene, name, material, { scale = 1 } = {}) {
    const root = new (B().TransformNode)(name, scene);
    const palm = createMuscle(scene, `${name}_palm`, {
        length: 0.09 * scale,
        r0: 0.035 * scale,
        r1: 0.042 * scale,
        bulge: 0.008 * scale,
        bulgeAt: 0.6,
        pinch: 0
    });
    palm.material = material;
    palm.parent = root;
    for (let i = 0; i < 4; i++) {
        const f = createMuscle(scene, `${name}_f${i}`, {
            length: (0.055 - i * 0.004) * scale,
            r0: 0.011 * scale,
            r1: 0.008 * scale,
            bulge: 0.002 * scale,
            bulgeAt: 0.45,
            pinch: 0.1,
            tessellation: 8,
            rings: 5
        });
        f.material = material;
        f.parent = root;
        f.position.set((i - 1.5) * 0.016 * scale, -0.045 * scale, 0.012 * scale);
    }
    const thumb = createMuscle(scene, `${name}_th`, {
        length: 0.04 * scale,
        r0: 0.012 * scale,
        r1: 0.009 * scale,
        bulge: 0.002 * scale,
        pinch: 0,
        tessellation: 8,
        rings: 4
    });
    thumb.material = material;
    thumb.parent = root;
    thumb.position.set(0.038 * scale, -0.01 * scale, 0.01 * scale);
    thumb.rotation.z = -1.05;
    return root;
}

/** Tronco lathe. `girth` é o raio do quadril. Origem no quadril, +Y sobe. */
export function createTorso(scene, name, { height = 0.55, girth = 0.18, style = 'human' } = {}) {
    const shape = [];
    const steps = 14;
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const r = sampleKeys(torsoKeys(style), t) * girth;
        shape.push(new (B().Vector3)(Math.max(0.02, r), t * height, 0));
    }
    const mesh = B().MeshBuilder.CreateLathe(name, {
        shape,
        tessellation: 16,
        cap: B().Mesh.CAP_ALL
    }, scene);
    mesh.isPickable = false;
    return mesh;
}

const irisCache = new Map();

function irisTexture(scene, hex) {
    if (irisCache.has(hex)) return irisCache.get(hex);
    const tex = new (B().DynamicTexture)(`iris_${hex}`, { width: 128, height: 128 }, scene, false);
    const ctx = tex.getContext();
    const css = `#${hex.toString(16).padStart(6, '0')}`;
    ctx.fillStyle = '#f3efe6';
    ctx.fillRect(0, 0, 128, 128);
    const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 40);
    g.addColorStop(0, css);
    g.addColorStop(0.72, '#1c140e');
    g.addColorStop(1, '#f3efe6');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(64, 64, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#070605';
    ctx.beginPath();
    ctx.arc(64, 64, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    ctx.arc(78, 50, 6, 0, Math.PI * 2);
    ctx.fill();
    tex.update();
    irisCache.set(hex, tex);
    return tex;
}

/**
 * Olhos com íris em disco (não esfera dentro de esfera), pálpebra e orelha.
 * A cabeça já deve existir; os filhos entram no mesmo pai.
 */
export function addRealisticFace(scene, head, skinMat, {
    scale = 1,
    iris = 0x3a6a30,
    browMat = null,
    lipMat = null
} = {}) {
    const s = scale;
    const eyeMat = new (B().StandardMaterial)(`eyeWhite_${head.name || 'h'}`, scene);
    eyeMat.diffuseColor = new (B().Color3)(0.95, 0.93, 0.9);
    eyeMat.specularColor = new (B().Color3)(0.4, 0.4, 0.4);
    const irisMat = new (B().StandardMaterial)(`iris_${head.name || 'h'}`, scene);
    irisMat.diffuseTexture = irisTexture(scene, iris);
    irisMat.emissiveTexture = irisMat.diffuseTexture;
    irisMat.emissiveColor = new (B().Color3)(0.25, 0.25, 0.25);
    irisMat.disableLighting = false;
    irisMat.backFaceCulling = false;

    for (const sx of [-1, 1]) {
        const eye = B().MeshBuilder.CreateSphere(`eye_${sx}`, { diameter: 0.05 * s, segments: 12 }, scene);
        eye.material = eyeMat;
        eye.parent = head;
        eye.position.set(sx * 0.055 * s, 0.02 * s, 0.125 * s);
        eye.isPickable = false;
        const disc = B().MeshBuilder.CreateDisc(`irisDisc_${sx}`, { radius: 0.016 * s, tessellation: 16 }, scene);
        disc.material = irisMat;
        disc.parent = eye;
        disc.position.z = 0.024 * s;
        disc.isPickable = false;

        if (browMat) {
            const brow = createMuscle(scene, `brow_${sx}`, {
                length: 0.055 * s, r0: 0.008 * s, r1: 0.006 * s, bulge: 0, pinch: 0, tessellation: 6, rings: 3
            });
            brow.material = browMat;
            brow.parent = head;
            brow.rotation.z = Math.PI / 2 + sx * -0.2;
            brow.position.set(sx * 0.055 * s, 0.055 * s, 0.12 * s);
        }

        const ear = B().MeshBuilder.CreateSphere(`ear_${sx}`, {
            diameterX: 0.028 * s, diameterY: 0.055 * s, diameterZ: 0.02 * s, segments: 8
        }, scene);
        const ep = ear.getVerticesData(B().VertexBuffer.PositionKind);
        for (let i = 0; i < ep.length; i += 3) {
            const y = ep[i + 1];
            if (y > 0) ep[i] *= 0.65;
        }
        ear.setVerticesData(B().VertexBuffer.PositionKind, ep);
        normalsOf(ear);
        ear.material = skinMat;
        ear.parent = head;
        ear.position.set(sx * 0.145 * s, 0, 0);
        ear.isPickable = false;
    }

    if (lipMat) {
        const lip = createMuscle(scene, `lip_${head.name || 'h'}`, {
            length: 0.07 * s, r0: 0.01 * s, r1: 0.012 * s, bulge: 0.004 * s, bulgeAt: 0.5, pinch: 0, tessellation: 8, rings: 4
        });
        lip.material = lipMat;
        lip.parent = head;
        lip.rotation.z = Math.PI / 2;
        lip.position.set(0, -0.045 * s, 0.135 * s);
    }
}
