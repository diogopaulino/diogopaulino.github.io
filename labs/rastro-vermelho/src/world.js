/** Streamed scenery shares geometry/materials. Terrain, collision and hooves sample
 * the same height function; vegetation is deterministic when revisiting a chunk. */
import { hash, terrainHeight, roadDistance, roadX, LANDMARKS, clamp, lerp } from './simulation.js';
import {
    createMuscle, createSkull, createTorso, createHand, createShoe,
    addRealisticFace, createPBRWood, createPBRStone, createPBRMetal
} from '../../shared/realism-bjs.js';
const B = window.BABYLON;
export const CHUNK_SIZE = 96;
export const PROFILES = {
    low: { id: 'low', scale: 0.8, radius: 2, segments: 24, grass: 140, shadowSize: 512, bloom: false },
    medium: { id: 'medium', scale: 1, radius: 2, segments: 36, grass: 380, shadowSize: 1024, bloom: false },
    high: { id: 'high', scale: 1.25, radius: 3, segments: 40, grass: 650, shadowSize: 2048, bloom: true }
};
export function material(scene, name, color, roughness = 0.9, metallic = 0) {
    const m = new B.PBRMaterial(name, scene);
    m.albedoColor = B.Color3.FromHexString(color);
    m.roughness = roughness;
    m.metallic = metallic;
    m.environmentIntensity = 0.92;
    return m;
}
function box(scene, parent, name, size, pos, mat) {
    const m = B.MeshBuilder.CreateBox(name, { width: size[0], height: size[1], depth: size[2] }, scene);
    m.parent = parent; m.position.set(...pos); m.material = mat; m.isPickable = false; m.receiveShadows = true;
    return m;
}
function sphere(scene, parent, name, size, pos, mat) {
    const m = B.MeshBuilder.CreateSphere(name, { diameter: 1, segments: 10 }, scene);
    m.parent = parent; m.scaling.set(...size); m.position.set(...pos); m.material = mat; m.isPickable = false;
    return m;
}
export function createPerson(scene, palette, mounted = false) {
    const root = new B.TransformNode(mounted ? 'cavaleiro' : 'fora-da-lei', scene);
    const torso = createTorso(scene, 'casaco', { height: 0.7, girth: 0.26, style: 'human' });
    torso.parent = root;
    torso.position.set(0, 0.86, 0);
    torso.scaling.set(1.05, 1, 0.85);
    torso.material = palette.coat;
    torso.isPickable = false;
    torso.receiveShadows = true;
    const head = createSkull(scene, 'rosto', { diameter: 0.32, style: 'human', segments: 16 });
    head.parent = root; head.position.set(0, 1.72, 0.02); head.scaling.set(0.95, 1.08, 0.95);
    head.material = palette.skin; head.isPickable = false;
    addRealisticFace(scene, head, palette.skin, {
        scale: 1.02,
        iris: mounted ? 0x55704a : 0x405846,
        browMat: palette.hat,
        lipMat: palette.scarf
    });
    const neck = B.MeshBuilder.CreateCylinder('pescoço', { height: .22, diameterTop: .18, diameterBottom: .21, tessellation: 14 }, scene);
    neck.parent = root; neck.position.set(0, 1.48, 0); neck.material = palette.skin; neck.isPickable = false;
    // Chapéu de cowboy com aba curvada nas laterais, fita de couro e copa com vinco duplo (cattleman crease)
    const brim = B.MeshBuilder.CreateCylinder('aba-do-chapéu', { height: .032, diameter: .68, tessellation: 28 }, scene);
    const brimPos = brim.getVerticesData(B.VertexBuffer.PositionKind);
    for (let i = 0; i < brimPos.length; i += 3) {
        const bx = brimPos[i], bz = brimPos[i + 2];
        brimPos[i + 1] += (bx * bx) * 0.42 - (bz * bz) * 0.08;
    }
    brim.setVerticesData(B.VertexBuffer.PositionKind, brimPos);
    brim.createNormals(false);
    brim.parent = root; brim.position.y = 1.97; brim.material = palette.hat;
    const hat = B.MeshBuilder.CreateCylinder('chapéu', { height: .22, diameterTop: .31, diameterBottom: .38, tessellation: 24, subdivisions: 2 }, scene);
    const hatPos = hat.getVerticesData(B.VertexBuffer.PositionKind);
    for (let i = 0; i < hatPos.length; i += 3) {
        const hx = hatPos[i], hy = hatPos[i + 1], hz = hatPos[i + 2];
        if (hy > 0.04) {
            const crease = Math.exp(-((Math.abs(hx) - 0.065) ** 2) / 0.0022) * 0.045;
            hatPos[i + 1] -= crease;
            hatPos[i] *= 1 - Math.max(0, hz) * 0.32;
        }
    }
    hat.setVerticesData(B.VertexBuffer.PositionKind, hatPos);
    hat.createNormals(false);
    hat.parent = root; hat.position.y = 2.08; hat.material = palette.hat;
    const hatBand = B.MeshBuilder.CreateTorus('fita-chapéu', { diameter: 0.37, thickness: 0.025, tessellation: 24 }, scene);
    hatBand.parent = root; hatBand.rotation.x = Math.PI / 2; hatBand.position.y = 1.99; hatBand.material = palette.scarf;
    // Lenço carmim
    const scarf = B.MeshBuilder.CreateTorus('lenço', { diameter: 0.34, thickness: 0.045, tessellation: 20 }, scene);
    scarf.parent = root; scarf.rotation.x = Math.PI / 2; scarf.position.set(0, 1.55, 0.02); scarf.material = palette.scarf;
    // Cinturão
    const belt = B.MeshBuilder.CreateTorus('cinturão', { diameter: 0.48, thickness: 0.04, tessellation: 22 }, scene);
    belt.parent = root; belt.rotation.x = Math.PI / 2; belt.position.y = 0.88; belt.material = palette.hat;
    for (const side of [-1, 1]) {
        const thighH = mounted ? 0.42 : 0.55;
        const leg = createMuscle(scene, 'calça', {
            length: thighH, r0: 0.12, r1: 0.07, bulge: 0.03, pinch: 0.3, tessellation: 10, rings: 6
        });
        leg.parent = root;
        leg.position.set(side * (mounted ? .2 : .14), mounted ? .48 : .5, mounted ? -.08 : 0);
        leg.material = palette.pants;
        leg.isPickable = false;
        if (mounted) leg.rotation.set(0.35, 0, side * 0.12);
        else leg.rotation.set(0, 0, side * -0.04);
        // Bota de cowboy com cano, bico esculpido e espora metálica
        const bootShaft = createMuscle(scene, 'cano-bota', {
            length: 0.24, r0: 0.082, r1: 0.068, bulge: 0.015, pinch: 0.1, tessellation: 10, rings: 5
        });
        bootShaft.parent = root;
        bootShaft.position.set(side * (mounted ? .22 : .14), mounted ? 0.24 : 0.22, mounted ? -0.02 : 0);
        bootShaft.material = palette.hat;
        bootShaft.isPickable = false;
        const bootFoot = createShoe(scene, 'bota', { length: 0.25, width: 0.1, height: 0.09 });
        bootFoot.parent = root;
        bootFoot.position.set(side * (mounted ? .22 : .14), mounted ? 0.11 : 0.08, mounted ? 0.04 : 0.05);
        bootFoot.rotation.y = -Math.PI / 2;
        bootFoot.material = palette.hat;
        const spur = B.MeshBuilder.CreateTorus('espora', { diameter: 0.055, thickness: 0.01, tessellation: 12 }, scene);
        spur.parent = root;
        spur.position.set(side * (mounted ? .22 : .14), mounted ? 0.12 : 0.09, mounted ? -0.08 : -0.07);
        spur.rotation.y = Math.PI / 2;
        spur.material = palette.metal;
        spur.isPickable = false;
        const arm = createMuscle(scene, 'manga', {
            length: 0.46, r0: 0.09, r1: 0.06, bulge: 0.02, pinch: 0.25, tessellation: 10, rings: 6
        });
        arm.parent = root;
        arm.position.set(side * .36, 1.28, mounted ? .12 : 0);
        arm.material = palette.coat;
        arm.isPickable = false;
        arm.rotation.set(mounted ? -0.85 : 0.15, 0, side * (mounted ? 0.12 : 0.18));
        const handMat = side < 0 ? palette.skin.clone('pele-mao') : palette.skin;
        if (side < 0) handMat.backFaceCulling = false;
        const hand = createHand(scene, 'mão', handMat, { scale: 0.9 });
        hand.parent = root;
        hand.position.set(side * .34, mounted ? 1.02 : .9, mounted ? .38 : .02);
        if (side < 0) hand.scaling.x = -1;
    }
    // Revólver de 6 tiros — empunhadura, tambor canelado, cão, guarda-mato e cano
    const gun = new B.TransformNode('revólver', scene);
    gun.parent = root;
    gun.position.set(.36, mounted ? 1.03 : .85, .26);
    const grip = B.MeshBuilder.CreateLathe('empunhadura', {
        shape: [
            new B.Vector3(0.02, 0, 0),
            new B.Vector3(0.038, 0.02, 0),
            new B.Vector3(0.032, 0.1, 0),
            new B.Vector3(0.02, 0.14, 0)
        ],
        tessellation: 8
    }, scene);
    grip.parent = gun;
    grip.position.set(0, -0.08, 0);
    grip.material = palette.hat;
    grip.isPickable = false;
    const revCyl = B.MeshBuilder.CreateCylinder('tambor-revolver', {
        height: 0.085, diameter: 0.066, tessellation: 12
    }, scene);
    const cylPos = revCyl.getVerticesData(B.VertexBuffer.PositionKind);
    for (let i = 0; i < cylPos.length; i += 3) {
        const ang = Math.atan2(cylPos[i + 2], cylPos[i]);
        const flute = 1 - Math.max(0, Math.cos(ang * 6)) * 0.12;
        cylPos[i] *= flute;
        cylPos[i + 2] *= flute;
    }
    revCyl.setVerticesData(B.VertexBuffer.PositionKind, cylPos);
    revCyl.createNormals(false);
    revCyl.parent = gun;
    revCyl.rotation.x = Math.PI / 2;
    revCyl.position.set(0, 0.018, 0.035);
    revCyl.material = palette.metal;
    revCyl.isPickable = false;
    const hammer = B.MeshBuilder.CreateBox('cão-revolver', { width: 0.012, height: 0.034, depth: 0.024 }, scene);
    hammer.parent = gun;
    hammer.position.set(0, 0.046, -0.018);
    hammer.rotation.x = -0.45;
    hammer.material = palette.metal;
    hammer.isPickable = false;
    const triggerGuard = B.MeshBuilder.CreateTorus('guarda-mato', { diameter: 0.052, thickness: 0.008, tessellation: 12 }, scene);
    triggerGuard.parent = gun;
    triggerGuard.rotation.y = Math.PI / 2;
    triggerGuard.position.set(0, -0.02, 0.026);
    triggerGuard.material = palette.metal;
    triggerGuard.isPickable = false;
    const barrel = B.MeshBuilder.CreateCylinder('cano', {
        height: 0.26, diameterTop: 0.028, diameterBottom: 0.04, tessellation: 10
    }, scene);
    barrel.parent = gun;
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, 0.16);
    barrel.material = palette.metal;
    barrel.isPickable = false;
    root.getChildMeshes().forEach(m => { m.isPickable = false; m.receiveShadows = true; });
    return { root, torso, gun };
}
export class World {
    constructor(scene, shadow, profile) {
        this.scene = scene; this.shadow = shadow; this.profile = profile; this.chunks = new Map(); this.queue = []; this.center = ''; this.staticColliders = []; this.fires = [];
        this.mats = {
            wood: createPBRWood(scene, 'madeira-envelhecida', { hex: '#65513d', roughness: 0.72, planks: true, uScale: 2, vScale: 2 }),
            darkWood: createPBRWood(scene, 'madeira-escura', { hex: '#33281f', roughness: 0.78, planks: false, uScale: 2, vScale: 2 }),
            stone: createPBRStone(scene, 'pedra-pbr', { hex: '#7a756c', roughness: 0.86, uScale: 3, vScale: 2 }),
            canvas: material(scene, 'lona', '#b4a488', .82),
            metal: createPBRMetal(scene, 'ferro', { color: [0.22, 0.24, 0.25], roughness: 0.28, metallic: 0.85 }),
            leaves: material(scene, 'folhas', '#455338'),
            bark: createPBRWood(scene, 'casca', { hex: '#483c2d', roughness: 0.88, planks: false, uScale: 1, vScale: 3 }),
            grass: material(scene, 'capim-seco', '#9d9159'), coat: material(scene, 'casaco', '#514d3d', .78),
            pants: material(scene, 'calça', '#333c41', .8), skin: material(scene, 'pele', '#b38a67', .62),
            hat: material(scene, 'couro', '#30261e', .75), scarf: material(scene, 'lenço-carmim', '#8e3027', .7),
            fire: material(scene, 'brasas', '#d76a22'), window: material(scene, 'janela-âmbar', '#bb883e')
        };
        this.mats.fire.emissiveColor.set(1, .24, .025); this.mats.window.emissiveColor.set(.26, .12, .025);
        this.mats.metal.clearCoat.isEnabled = true; this.mats.metal.clearCoat.intensity = 0.45;
        this.mats.skin.clearCoat.isEnabled = true; this.mats.skin.clearCoat.intensity = 0.12;
        const terrain = material(scene, 'terra-pbr', '#ded3b9');
        terrain.albedoTexture = new B.Texture('assets/ground-albedo.webp', scene);
        terrain.bumpTexture = new B.Texture('assets/ground-normal.webp', scene); terrain.bumpTexture.level = .32;
        terrain.metallicTexture = new B.Texture('assets/ground-roughness.webp', scene);
        terrain.useRoughnessFromMetallicTextureAlpha = false; terrain.useRoughnessFromMetallicTextureGreen = true; terrain.useMetallnessFromMetallicTextureBlue = false;
        terrain.roughness = 1; this.terrainMaterial = terrain;
        this.rockMaterial = createPBRStone(scene, 'arenito-pbr', { hex: '#a38a68', roughness: 0.88, uScale: 2, vScale: 2 });
        this.rockMaterial.albedoTexture = new B.Texture('assets/rock-albedo.webp', scene);
        this.rockMaterial.bumpTexture = new B.Texture('assets/rock-normal.webp', scene); this.rockMaterial.bumpTexture.level = .5;
        this.createTemplates(); this.createLandmarks();
        Object.values(this.mats).forEach(m => m.freeze());
    }
    createTemplates() {
        const scene = this.scene;
        this.rock = B.MeshBuilder.CreateIcoSphere('rocha-modelo', { radius: 1, subdivisions: 3, flat: false }, scene);
        this.rock.material = this.rockMaterial; this.rock.isVisible = false;
        const positions = this.rock.getVerticesData(B.VertexBuffer.PositionKind);
        for (let i = 0; i < positions.length; i += 3) {
            const d = .86 + hash(positions[i] * 15, positions[i + 2] * 19 + positions[i + 1]) * .28;
            positions[i] *= d; positions[i + 1] *= d; positions[i + 2] *= d;
        }
        this.rock.setVerticesData(B.VertexBuffer.PositionKind, positions); this.rock.createNormals(false);
        const parts = [];
        const trunk = B.MeshBuilder.CreateCylinder('tronco', { height: 5, diameterTop: .17, diameterBottom: .55, tessellation: 12, subdivisions: 4 }, scene);
        const trunkVerts = trunk.getVerticesData(B.VertexBuffer.PositionKind);
        for (let v = 0; v < trunkVerts.length; v += 3) {
            const ang = Math.atan2(trunkVerts[v + 2], trunkVerts[v]);
            const rib = 1 + Math.abs(Math.sin(ang * 5)) * 0.07 + Math.sin(trunkVerts[v + 1] * 2.4) * 0.025;
            trunkVerts[v] *= rib;
            trunkVerts[v + 2] *= rib;
        }
        trunk.setVerticesData(B.VertexBuffer.PositionKind, trunkVerts);
        trunk.createNormals(false);
        trunk.position.y = 2.5; trunk.material = this.mats.bark; parts.push(trunk);
        for (let i = 0; i < 5; i++) {
            const height = 2.6 - i * .22;
            const crown = B.MeshBuilder.CreateCylinder('ramagem', {
                height, diameterTop: 0.05, diameterBottom: 3.1 - i * .48, tessellation: 14, subdivisions: 3
            }, scene);
            const verts = crown.getVerticesData(B.VertexBuffer.PositionKind);
            for (let v = 0; v < verts.length; v += 3) {
                const ang = Math.atan2(verts[v + 2], verts[v]);
                const ny = (verts[v + 1] + height / 2) / height;
                const lobe = 1 + Math.abs(Math.sin(ang * 5 + i * 1.3)) * 0.28 * (1 - ny);
                verts[v] *= lobe;
                verts[v + 2] *= lobe;
            }
            crown.setVerticesData(B.VertexBuffer.PositionKind, verts);
            crown.createNormals(false);
            crown.position.y = 2.1 + i * .8; crown.rotation.y = i * .8; crown.material = this.mats.leaves; parts.push(crown);
        }
        this.tree = B.Mesh.MergeMeshes(parts, true, true, undefined, false, true); this.tree.name = 'pinheiro-modelo'; this.tree.isVisible = false;
        const grass = new B.Mesh('touceira-modelo', scene), data = new B.VertexData();
        const verts = [], indices = [], normals = [];
        for (let i = 0; i < 5; i++) {
            const a = i * 2.4, x = Math.cos(a) * .14, z = Math.sin(a) * .14, h = .28 + hash(i, 4) * .46;
            const n = verts.length / 3;
            verts.push(x - .045, 0, z, x + .045, 0, z, x + .13, h, z + .05);
            indices.push(n, n + 1, n + 2); normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
        }
        data.positions = verts; data.indices = indices; data.normals = normals; data.applyToMesh(grass);
        this.mats.grass.backFaceCulling = false; grass.material = this.mats.grass; grass.isVisible = false; this.grass = grass;
    }
    createTerrain(cx, cz, segments = this.profile.segments, size = CHUNK_SIZE) {
        const ground = B.MeshBuilder.CreateGround(`terra-${cx}-${cz}`, { width: size, height: size, subdivisions: segments }, this.scene);
        const px = cx * size, pz = cz * size;
        ground.position.set(px, 0, pz);
        const pos = ground.getVerticesData(B.VertexBuffer.PositionKind), uv = ground.getVerticesData(B.VertexBuffer.UVKind), normals = [], colors = [];
        for (let i = 0; i < pos.length; i += 3) {
            const x = pos[i] + px, z = pos[i + 2] + pz, y = terrainHeight(x, z);
            pos[i + 1] = y;
            // World-space UV and finite-difference normals keep neighbouring tiles seamless.
            const dx = terrainHeight(x - .3, z) - terrainHeight(x + .3, z), dz = terrainHeight(x, z - .3) - terrainHeight(x, z + .3);
            const length = Math.hypot(dx, .6, dz); normals.push(dx / length, .6 / length, dz / length);
            uv[i / 3 * 2] = x / 9; uv[i / 3 * 2 + 1] = z / 9;
            const trail = clamp((roadDistance(x, z) - 2.5) / 5, 0, 1), arid = z > 630 && z < 865;
            const variation = .9 + hash(Math.floor(x / 4), Math.floor(z / 4)) * .1;
            colors.push(lerp(.79, arid ? .76 : .53, trail) * variation, lerp(.65, arid ? .58 : .58, trail) * variation, lerp(.46, arid ? .39 : .34, trail) * variation, 1);
        }
        ground.setVerticesData(B.VertexBuffer.PositionKind, pos); ground.setVerticesData(B.VertexBuffer.NormalKind, normals);
        ground.setVerticesData(B.VertexBuffer.UVKind, uv); ground.setVerticesData(B.VertexBuffer.ColorKind, colors);
        ground.material = this.terrainMaterial; ground.receiveShadows = true; ground.isPickable = false; ground.freezeWorldMatrix(); return ground;
    }
    createChunk(cx, cz) {
        const root = new B.TransformNode(`cenário-${cx}-${cz}`, this.scene), colliders = [], shadows = [];
        this.createTerrain(cx, cz).parent = root;
        const rng = i => hash(cx * 37 + i * 2.7, cz * 19 + i * 1.3);
        for (let i = 0; i < 22; i++) {
            const x = cx * CHUNK_SIZE + (rng(i) - .5) * 92, z = cz * CHUNK_SIZE + (rng(i + 50) - .5) * 92;
            if (roadDistance(x, z) < 8 || LANDMARKS.some(p => Math.hypot(p.x - x, p.z - z) < 31)) continue;
            const isTree = !(z > 620 && z < 865) && (i % 3 === 0 || x < -90), scale = isTree ? .8 + rng(i + 80) * 1.1 : .7 + rng(i + 30) * 2.2;
            const mesh = (isTree ? this.tree : this.rock).createInstance(`paisagem-${cx}-${cz}-${i}`);
            mesh.parent = root; mesh.position.set(x, terrainHeight(x, z) - (isTree ? .1 : scale * .25), z);
            mesh.scaling.set(scale * (isTree ? 1 : 1.4), scale, scale); mesh.rotation.y = rng(i + 100) * Math.PI * 2;
            mesh.isPickable = false; mesh.receiveShadows = true; mesh.freezeWorldMatrix();
            colliders.push({ x, z, radius: isTree ? scale * .25 : scale * 1.1 });
            if (isTree && this.profile.id !== 'low') { this.shadow.addShadowCaster(mesh); shadows.push(mesh); }
        }
        const matrices = [];
        for (let i = 0; i < this.profile.grass; i++) {
            const x = cx * CHUNK_SIZE + (rng(i + 130) - .5) * 96, z = cz * CHUNK_SIZE + (rng(i + 1600) - .5) * 96;
            if (roadDistance(x, z) < 3.7 || LANDMARKS.some(p => Math.hypot(p.x - x, p.z - z) < 13)) continue;
            const s = .8 + rng(i + 4000) * 1.6;
            B.Matrix.Compose(new B.Vector3(s, s, s), B.Quaternion.RotationAxis(B.Axis.Y, rng(i) * 6.28), new B.Vector3(x, terrainHeight(x, z), z)).copyToArray(matrices, matrices.length);
        }
        const grass = this.grass.clone(`capim-${cx}-${cz}`, root); grass.isVisible = true; grass.isPickable = false;
        if (matrices.length) grass.thinInstanceSetBuffer('matrix', new Float32Array(matrices), 16, true);
        else grass.setEnabled(false);
        return { root, colliders, shadows };
    }
    update(x, z, immediate = false) {
        // Ground tiles are centred at multiples of 96, so round (not floor) selects the tile.
        const cx = Math.round(x / CHUNK_SIZE), cz = Math.round(z / CHUNK_SIZE), key = `${cx}:${cz}`;
        if (key !== this.center) {
            this.center = key; const needed = new Set(), candidates = [], r = this.profile.radius;
            for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
                const k = `${cx + dx}:${cz + dz}`; needed.add(k);
                if (!this.chunks.has(k)) candidates.push({ cx: cx + dx, cz: cz + dz, key: k, distance: dx * dx + dz * dz });
            }
            this.queue = candidates.sort((a, b) => a.distance - b.distance);
            for (const [k, c] of this.chunks) if (!needed.has(k)) { c.shadows.forEach(m => this.shadow.removeShadowCaster(m)); c.root.dispose(); this.chunks.delete(k); }
        }
        // One tile per frame prevents the old 5/7-tile synchronous burst on crossing a border.
        let count = immediate ? this.queue.length : 1;
        while (count-- > 0 && this.queue.length) { const job = this.queue.shift(); this.chunks.set(job.key, this.createChunk(job.cx, job.cz)); }
        this.colliders = [...this.staticColliders];
        for (const c of this.chunks.values()) for (const o of c.colliders) if (Math.abs(o.x - x) < 50 && Math.abs(o.z - z) < 50) this.colliders.push(o);
    }
    setProfile(profile) {
        this.profile = profile;
        for (const c of this.chunks.values()) { c.shadows.forEach(m => this.shadow.removeShadowCaster(m)); c.root.dispose(); }
        this.chunks.clear(); this.center = ''; this.queue = [];
    }
    createLandmarks() {
        this.places = LANDMARKS.map(p => {
            const root = new B.TransformNode(p.name, this.scene); root.position.set(p.x, terrainHeight(p.x, p.z), p.z);
            if (p.kind === 'camp') { this.tent(root, -5, 1); this.campfire(root, 0, 0); this.crate(root, 4, 2); }
            else {
                this.building(root, -8, 3, p.kind === 'town' ? 7 : 6, 5, p.kind === 'mine' ? 'MINA' : p.kind === 'ranch' ? 'RANCHO' : p.kind === 'town' ? 'CORREIO' : 'POSTO');
                this.campfire(root, 2, -3); this.crate(root, 5, 2); this.crate(root, 5.8, 3.5);
                if (p.kind === 'town' || p.kind === 'ranch') this.building(root, 9, 6, 5, 4, p.kind === 'town' ? 'ARMAZÉM' : 'ESTÁBULO');
                for (let i = 0; i < 5; i++) {
                    const x = -14 + i * 2.3;
                    box(this.scene, root, 'mourão', [.13, 1.2, .15], [x, .6, 10], this.mats.wood);
                    if (i < 4) for (const h of [.4, .9]) box(this.scene, root, 'cerca', [2.3, .09, .1], [x + 1.15, h, 10], this.mats.wood);
                }
            }
            root.getChildMeshes().forEach(m => { m.computeWorldMatrix(true); m.freezeWorldMatrix(); if (!m.metadata?.fire) this.shadow.addShadowCaster(m); });
            return root;
        });
    }
    crate(parent, x, z) {
        box(this.scene, parent, 'caixote', [.9, .8, .85], [x, .4, z], this.mats.wood);
        for (const offset of [-.32, .32]) box(this.scene, parent, 'cinta', [.09, .84, .89], [x + offset, .42, z], this.mats.darkWood);
    }
    tent(parent, x, z) {
        const shape = [
            new B.Vector3(-1.7, 0, 0),
            new B.Vector3(0, 2.15, 0),
            new B.Vector3(1.7, 0, 0),
            new B.Vector3(1.45, -0.08, 0),
            new B.Vector3(-1.45, -0.08, 0)
        ];
        const tent = B.MeshBuilder.ExtrudeShape('barraca', {
            shape,
            path: [new B.Vector3(0, 0, -2.05), new B.Vector3(0, 0, 2.05)],
            cap: B.Mesh.CAP_ALL,
            closeShape: true,
            sideOrientation: B.Mesh.DOUBLESIDE
        }, this.scene);
        tent.parent = parent;
        tent.position.set(x, 0.02, z);
        tent.material = this.mats.canvas;
        tent.isPickable = false;
        box(this.scene, parent, 'esteio', [.1, 2.4, .1], [x, 1.2, z - 2.1], this.mats.wood);
        this.staticColliders.push({ x: parent.position.x + x, z: parent.position.z + z, radius: 2 });
    }
    campfire(parent, x, z) {
        for (let i = 0; i < 10; i++) {
            const ang = (i / 10) * Math.PI * 2;
            const stone = this.rock.createInstance('pedra-da-fogueira');
            stone.parent = parent;
            stone.position.set(x + Math.sin(ang) * .82, .12, z + Math.cos(ang) * .82);
            stone.scaling.set(.24, .18 + (i % 3) * .03, .22);
            stone.rotation.y = ang * 1.7;
        }
        const emberBed = B.MeshBuilder.CreateCylinder('leito-brasas', { height: 0.06, diameter: 0.92, tessellation: 14 }, this.scene);
        emberBed.parent = parent;
        emberBed.position.set(x, 0.05, z);
        emberBed.material = this.mats.fire;
        emberBed.isPickable = false;
        for (const [idx, a] of [[-0.65, 0], [0.55, 1], [1.65, 2]].entries()) {
            const log = B.MeshBuilder.CreateCylinder(`tora-lenha-${idx}`, {
                height: 1.32, diameterTop: 0.14, diameterBottom: 0.17, tessellation: 10
            }, this.scene);
            log.parent = parent;
            log.position.set(x, 0.14 + a * 0.035, z);
            log.rotation.set(0, idx * 1.05 - 0.6, Math.PI / 2 - 0.12);
            log.material = this.mats.bark;
            log.isPickable = false;
            log.receiveShadows = true;
            const tip = B.MeshBuilder.CreateCylinder(`brasa-ponta-${idx}`, {
                height: 0.24, diameter: 0.145, tessellation: 10
            }, this.scene);
            tip.parent = log;
            tip.position.y = 0.22;
            tip.material = this.mats.fire;
            tip.isPickable = false;
        }
        const flame = sphere(this.scene, parent, 'fogo', [.6, .9, .6], [x, .4, z], this.mats.fire); flame.metadata = { fire: true };
        const light = new B.PointLight('luz-da-fogueira', new B.Vector3(parent.position.x + x, parent.position.y + 1, parent.position.z + z), this.scene);
        light.diffuse.set(1, .44, .13); light.range = 9; light.intensity = 4;
        this.fires.push({ mesh: flame, light, x: parent.position.x + x, z: parent.position.z + z });
    }
    building(parent, x, z, width, depth, label) {
        const s = this.scene, m = this.mats;
        box(s, parent, 'fundação', [width + .3, .3, depth + .2], [x, .15, z], m.stone);
        for (let row = 0; row < 11; row++) {
            const y = .45 + row * .25;
            box(s, parent, 'tábua-fundo', [width, .23, .15], [x, y, z + depth / 2], m.wood);
            for (const side of [-1, 1]) box(s, parent, 'tábua-lateral', [.15, .23, depth], [x + side * width / 2, y, z], m.wood);
        }
        box(s, parent, 'fachada', [width, 2.8, .16], [x, 1.55, z - depth / 2], m.wood);
        box(s, parent, 'porta', [1.1, 2.1, .2], [x, 1.2, z - depth / 2 - .05], m.darkWood);
        for (const side of [-1, 1]) {
            box(s, parent, 'vidraça', [1.05, .95, .2], [x + side * width * .3, 1.7, z - depth / 2 - .09], m.window);
            box(s, parent, 'caixilho', [.07, 1.05, .22], [x + side * width * .3, 1.7, z - depth / 2 - .11], m.darkWood);
            const roof = box(s, parent, 'telhado', [width / 2 + .6, .16, depth + .8], [x + side * width / 4, 3.1, z], m.darkWood); roof.rotation.z = side * -.22;
        }
        box(s, parent, 'varanda', [width + .8, .15, 1.7], [x, .25, z - depth / 2 - .8], m.wood);
        for (const side of [-1, 1]) box(s, parent, 'pilar', [.14, 2.9, .14], [x + side * (width / 2), 1.6, z - depth / 2 - 1.3], m.darkWood);
        box(s, parent, 'cobertura-varanda', [width + .8, .15, 1.8], [x, 3, z - depth / 2 - .8], m.darkWood);
        const texture = new B.DynamicTexture(`letreiro-${label}`, { width: 512, height: 128 }, s, false);
        texture.drawText(label, null, 84, 'bold 60px Georgia', '#e3d3a7', '#30291e', true);
        const signMat = new B.PBRMaterial(`placa-${label}`, s);
        signMat.albedoTexture = texture;
        signMat.roughness = 0.85;
        signMat.metallic = 0.04;
        const sign = B.MeshBuilder.CreatePlane('letreiro', { width: width * .65, height: .8, sideOrientation: B.Mesh.DOUBLESIDE }, s);
        sign.parent = parent; sign.position.set(x, 3.4, z - depth / 2 - .12); sign.material = signMat;
        this.staticColliders.push({ x: parent.position.x + x, z: parent.position.z + z, radius: Math.max(width, depth) * .55 });
    }
    animate(time, x, z) {
        for (const f of this.fires) {
            const near = Math.hypot(x - f.x, z - f.z) < 65;
            f.light.setEnabled(near); f.mesh.unfreezeWorldMatrix(); f.mesh.scaling.y = .85 + Math.sin(time * 12 + f.x) * .15;
            if (near) f.light.intensity = 3.5 + Math.sin(time * 9) * .6;
        }
        for (let i = 0; i < this.places.length; i++) this.places[i].setEnabled(Math.hypot(x - LANDMARKS[i].x, z - LANDMARKS[i].z) < (this.profile.radius + .35) * CHUNK_SIZE);
    }
}
export async function loadHorse(scene, shadow, palette) {
    const result = await B.SceneLoader.ImportMeshAsync('', '', 'assets/horse.gltf', scene, undefined, '.gltf');
    const mount = new B.TransformNode('montaria', scene), model = result.meshes[0];
    model.parent = mount; model.rotationQuaternion = null; model.rotation.y = 0; model.scaling.setAll(.85);
    result.animationGroups.forEach(g => {
        g.stop();
        for (const targeted of g.targetedAnimations || []) {
            targeted.animation.enableBlending = true;
            targeted.animation.blendingSpeed = 0.08;
        }
    });
    const animations = new Map(result.animationGroups.map(g => [g.name.toLowerCase(), g]));
    const rider = createPerson(scene, palette, true); rider.root.parent = mount; rider.root.position.set(0, 3.02, -.18); rider.root.scaling.setAll(.88);
    // Manta sob a sela
    const blanket = box(scene, mount, 'manta-sela', [.84, .08, 1.06], [0, 2.94, -.18], palette.scarf);
    blanket.isPickable = false;
    // Assento da sela + pito frontal (saddle horn) + encosto traseiro (cantle) + estribos laterais
    const saddle = box(scene, mount, 'sela', [.72, .14, .88], [0, 3.02, -.16], palette.hat);
    const pommel = B.MeshBuilder.CreateCylinder('arcão-frontal', { height: 0.16, diameterTop: 0.22, diameterBottom: 0.34, tessellation: 12 }, scene);
    pommel.parent = mount;
    pommel.position.set(0, 3.12, 0.18);
    pommel.material = palette.hat;
    pommel.isPickable = false;
    const saddleHorn = B.MeshBuilder.CreateCylinder('pito-sela', { height: 0.14, diameterTop: 0.07, diameterBottom: 0.05, tessellation: 10 }, scene);
    saddleHorn.parent = mount;
    saddleHorn.position.set(0, 3.23, 0.22);
    saddleHorn.rotation.x = 0.32;
    saddleHorn.material = palette.hat;
    saddleHorn.isPickable = false;
    const cantle = B.MeshBuilder.CreateCylinder('encosto-sela', { height: 0.16, diameterTop: 0.48, diameterBottom: 0.56, tessellation: 14, arc: 0.55 }, scene);
    cantle.parent = mount;
    cantle.position.set(0, 3.14, -0.44);
    cantle.rotation.y = Math.PI * 0.72;
    cantle.rotation.x = -0.22;
    cantle.material = palette.hat;
    cantle.isPickable = false;
    for (const side of [-1, 1]) {
        const fender = box(scene, mount, 'aba-sela', [0.05, 0.48, 0.24], [side * 0.37, 2.74, -0.1], palette.hat);
        fender.rotation.z = side * -0.1;
        const strap = box(scene, mount, 'loro-estribo', [0.03, 0.38, 0.05], [side * 0.39, 2.48, -0.08], palette.hat);
        strap.isPickable = false;
        const stirrup = B.MeshBuilder.CreateTorus('estribo', { diameter: 0.14, thickness: 0.022, tessellation: 12 }, scene);
        stirrup.parent = mount;
        stirrup.position.set(side * 0.4, 2.26, -0.08);
        stirrup.rotation.y = Math.PI / 2;
        stirrup.material = palette.metal;
        stirrup.isPickable = false;
        const bag = B.MeshBuilder.CreateLathe('alforje', {
            shape: [
                new B.Vector3(0.06, 0, 0),
                new B.Vector3(0.16, 0.05, 0),
                new B.Vector3(0.18, 0.2, 0),
                new B.Vector3(0.1, 0.36, 0),
                new B.Vector3(0.03, 0.4, 0)
            ],
            tessellation: 10
        }, scene);
        bag.parent = mount;
        bag.position.set(side * 0.46, 2.64, -0.65);
        bag.material = palette.wood;
        bag.isPickable = false;
    }
    const reins = B.MeshBuilder.CreateLines('rédeas', { points: [new B.Vector3(-.27, 3.13, .24), new B.Vector3(-.24, 2.97, .8), new B.Vector3(0, 3.12, 1.25), new B.Vector3(.24, 2.97, .8), new B.Vector3(.27, 3.13, .24)] }, scene);
    reins.parent = mount; reins.color = B.Color3.FromHexString('#37251b'); reins.isPickable = false;
    mount.getChildMeshes().forEach(m => { m.isPickable = false; m.receiveShadows = true; shadow.addShadowCaster(m); });
    let active = null;
    return { root: mount, rider, saddle, animations, update(speed, phase, steer) {
        const name = speed < .15 ? 'idle' : speed < 6 ? 'walk' : 'gallop', next = animations.get(name);
        if (next !== active) {
            active?.stop();
            next?.start(true);
            active = next;
        }
        if (active) active.speedRatio = speed < .15 ? 1 : clamp(speed / (name === 'walk' ? 3 : 10), .5, 1.65);
        rider.root.position.y = 3.02 + (speed > 1 ? Math.sin(phase * 2.3) * .035 : 0);
        rider.torso.rotation.x = speed > 11 ? .16 : .03; rider.root.rotation.z = steer * -.04;
    } };
}
