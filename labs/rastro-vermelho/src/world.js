/** Streamed scenery shares geometry/materials. Terrain, collision and hooves sample
 * the same height function; vegetation is deterministic when revisiting a chunk. */
import { hash, terrainHeight, roadDistance, roadX, LANDMARKS, clamp, lerp } from './simulation.js';
const B = window.BABYLON;
export const CHUNK_SIZE = 96;
export const PROFILES = {
    low: { id: 'low', scale: 0.8, radius: 2, segments: 24, grass: 140, shadowSize: 512, bloom: false },
    medium: { id: 'medium', scale: 1, radius: 2, segments: 36, grass: 380, shadowSize: 1024, bloom: false },
    high: { id: 'high', scale: 1.25, radius: 3, segments: 40, grass: 650, shadowSize: 2048, bloom: true }
};
export function material(scene, name, color, roughness = 0.9) {
    const m = new B.PBRMaterial(name, scene);
    m.albedoColor = B.Color3.FromHexString(color); m.roughness = roughness; m.metallic = 0;
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
function capsule(scene, parent, name, height, radius, pos, mat, rot = null, scale = null) {
    const m = B.MeshBuilder.CreateCapsule(name, {
        height, radius, tessellation: 14, subdivisions: 4
    }, scene);
    m.parent = parent; m.position.set(...pos); m.material = mat; m.isPickable = false; m.receiveShadows = true;
    if (rot) m.rotation.set(...rot);
    if (scale) m.scaling.set(...scale);
    return m;
}
export function createPerson(scene, palette, mounted = false) {
    const root = new B.TransformNode(mounted ? 'cavaleiro' : 'fora-da-lei', scene);
    // Torso em cápsula (casaco western) + cabeça esférica
    const torso = capsule(scene, root, 'casaco', 0.72, 0.28, [0, 1.2, 0], palette.coat, null, [1.05, 1, 0.85]);
    const head = B.MeshBuilder.CreateSphere('rosto', { diameter: 0.32, segments: 16 }, scene);
    head.parent = root; head.position.set(0, 1.78, 0.02); head.scaling.set(0.95, 1.1, 0.95);
    head.material = palette.skin; head.isPickable = false;
    const brim = B.MeshBuilder.CreateCylinder('aba-do-chapéu', { height: .045, diameter: .67, tessellation: 28 }, scene);
    brim.parent = root; brim.position.y = 1.97; brim.material = palette.hat;
    const hat = B.MeshBuilder.CreateCylinder('chapéu', { height: .22, diameterTop: .3, diameterBottom: .38, tessellation: 22 }, scene);
    hat.parent = root; hat.position.y = 2.08; hat.material = palette.hat;
    // Lenço carmim
    const scarf = B.MeshBuilder.CreateTorus('lenço', { diameter: 0.34, thickness: 0.045, tessellation: 20 }, scene);
    scarf.parent = root; scarf.rotation.x = Math.PI / 2; scarf.position.set(0, 1.55, 0.02); scarf.material = palette.scarf;
    // Cinturão
    const belt = B.MeshBuilder.CreateTorus('cinturão', { diameter: 0.48, thickness: 0.04, tessellation: 22 }, scene);
    belt.parent = root; belt.rotation.x = Math.PI / 2; belt.position.y = 0.88; belt.material = palette.hat;
    for (const side of [-1, 1]) {
        const thighH = mounted ? 0.55 : 0.7;
        const leg = capsule(scene, root, 'calça', thighH, 0.1,
            [side * (mounted ? .2 : .14), mounted ? .48 : .5, mounted ? -.08 : 0],
            palette.pants, mounted ? [0.35, 0, side * 0.12] : [0, 0, side * -0.04]);
        const boot = capsule(scene, root, 'bota', 0.28, 0.09,
            [side * (mounted ? .22 : .14), 0.12, 0.06],
            palette.hat, [Math.PI / 2, 0, 0], [1, 0.85, 1.25]);
        const arm = capsule(scene, root, 'manga', 0.55, 0.09,
            [side * .36, 1.2, mounted ? .12 : 0],
            palette.coat, mounted ? [-0.85, 0, side * 0.12] : [0.15, 0, side * 0.18]);
        const hand = B.MeshBuilder.CreateSphere('mão', { diameter: 0.14, segments: 12 }, scene);
        hand.parent = root;
        hand.position.set(side * .34, mounted ? 1.0 : .88, mounted ? .38 : .02);
        hand.material = palette.skin; hand.isPickable = false;
    }
    // Revólver — cilindro + cano
    const gun = new B.TransformNode('revólver', scene);
    gun.parent = root;
    gun.position.set(.36, mounted ? 1.03 : .85, .26);
    const grip = capsule(scene, gun, 'empunhadura', 0.14, 0.035, [0, -0.02, 0], palette.hat);
    const barrel = capsule(scene, gun, 'cano', 0.28, 0.025, [0, 0.02, 0.12], palette.metal, [Math.PI / 2, 0, 0]);
    root.getChildMeshes().forEach(m => { m.isPickable = false; m.receiveShadows = true; });
    return { root, torso, gun };
}
export class World {
    constructor(scene, shadow, profile) {
        this.scene = scene; this.shadow = shadow; this.profile = profile; this.chunks = new Map(); this.queue = []; this.center = ''; this.staticColliders = []; this.fires = [];
        this.mats = {
            wood: material(scene, 'madeira-envelhecida', '#65513d'), darkWood: material(scene, 'madeira-escura', '#33281f'),
            canvas: material(scene, 'lona', '#b4a488'), metal: material(scene, 'ferro', '#343a3a', .42),
            leaves: material(scene, 'folhas', '#455338'), bark: material(scene, 'casca', '#483c2d'),
            grass: material(scene, 'capim-seco', '#9d9159'), coat: material(scene, 'casaco', '#514d3d'),
            pants: material(scene, 'calça', '#333c41'), skin: material(scene, 'pele', '#b38a67'),
            hat: material(scene, 'couro', '#30261e'), scarf: material(scene, 'lenço-carmim', '#8e3027'),
            fire: material(scene, 'brasas', '#d76a22'), window: material(scene, 'janela-âmbar', '#bb883e')
        };
        this.mats.fire.emissiveColor.set(1, .24, .025); this.mats.window.emissiveColor.set(.26, .12, .025);
        const terrain = material(scene, 'terra-pbr', '#ded3b9');
        terrain.albedoTexture = new B.Texture('assets/ground-albedo.webp', scene);
        terrain.bumpTexture = new B.Texture('assets/ground-normal.webp', scene); terrain.bumpTexture.level = .32;
        terrain.metallicTexture = new B.Texture('assets/ground-roughness.webp', scene);
        terrain.useRoughnessFromMetallicTextureAlpha = false; terrain.useRoughnessFromMetallicTextureGreen = true; terrain.useMetallnessFromMetallicTextureBlue = false;
        terrain.roughness = 1; this.terrainMaterial = terrain;
        this.rockMaterial = material(scene, 'arenito-pbr', '#a38a68');
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
        const trunk = B.MeshBuilder.CreateCylinder('tronco', { height: 5, diameterTop: .17, diameterBottom: .55, tessellation: 12 }, scene);
        trunk.position.y = 2.5; trunk.material = this.mats.bark; parts.push(trunk);
        for (let i = 0; i < 5; i++) {
            const crown = B.MeshBuilder.CreateCylinder('ramagem', { height: 2.6 - i * .22, diameterTop: 0, diameterBottom: 3.1 - i * .48, tessellation: 12 }, scene);
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
        const tent = B.MeshBuilder.CreateCylinder('barraca', { diameter: 4, height: 4.2, tessellation: 3 }, this.scene);
        tent.parent = parent; tent.rotation.z = Math.PI / 2; tent.rotation.y = Math.PI / 2; tent.position.set(x, 1, z); tent.material = this.mats.canvas;
        box(this.scene, parent, 'esteio', [.1, 2.4, .1], [x, 1.2, z - 2.1], this.mats.wood);
        this.staticColliders.push({ x: parent.position.x + x, z: parent.position.z + z, radius: 2 });
    }
    campfire(parent, x, z) {
        for (let i = 0; i < 9; i++) {
            const stone = this.rock.createInstance('pedra-da-fogueira'); stone.parent = parent;
            stone.position.set(x + Math.sin(i * .7) * .8, .12, z + Math.cos(i * .7) * .8); stone.scaling.set(.23, .18, .23);
        }
        for (const a of [-.6, .6]) { const log = box(this.scene, parent, 'lenha', [1.3, .15, .17], [x, .17, z], this.mats.darkWood); log.rotation.y = a; }
        const flame = sphere(this.scene, parent, 'fogo', [.6, .9, .6], [x, .4, z], this.mats.fire); flame.metadata = { fire: true };
        const light = new B.PointLight('luz-da-fogueira', new B.Vector3(parent.position.x + x, parent.position.y + 1, parent.position.z + z), this.scene);
        light.diffuse.set(1, .44, .13); light.range = 9; light.intensity = 4;
        this.fires.push({ mesh: flame, light, x: parent.position.x + x, z: parent.position.z + z });
    }
    building(parent, x, z, width, depth, label) {
        const s = this.scene, m = this.mats;
        box(s, parent, 'fundação', [width + .3, .3, depth + .2], [x, .15, z], m.darkWood);
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
        const signMat = new B.StandardMaterial(`placa-${label}`, s); signMat.diffuseTexture = texture; signMat.specularColor.set(0, 0, 0);
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
    result.animationGroups.forEach(g => g.stop());
    const animations = new Map(result.animationGroups.map(g => [g.name.toLowerCase(), g]));
    const rider = createPerson(scene, palette, true); rider.root.parent = mount; rider.root.position.set(0, 3.02, -.18); rider.root.scaling.setAll(.88);
    const saddle = box(scene, mount, 'sela', [.72, .16, .92], [0, 3.02, -.16], palette.hat);
    sphere(scene, mount, 'alforje', [.35, .5, .6], [.46, 2.84, -.65], palette.wood);
    sphere(scene, mount, 'alforje', [.35, .5, .6], [-.46, 2.84, -.65], palette.wood);
    const reins = B.MeshBuilder.CreateLines('rédeas', { points: [new B.Vector3(-.27, 3.13, .24), new B.Vector3(-.24, 2.97, .8), new B.Vector3(0, 3.12, 1.25), new B.Vector3(.24, 2.97, .8), new B.Vector3(.27, 3.13, .24)] }, scene);
    reins.parent = mount; reins.color = B.Color3.FromHexString('#37251b'); reins.isPickable = false;
    mount.getChildMeshes().forEach(m => { m.isPickable = false; m.receiveShadows = true; shadow.addShadowCaster(m); });
    let active = null;
    return { root: mount, rider, saddle, animations, update(speed, phase, steer) {
        const name = speed < .15 ? 'idle' : speed < 6 ? 'walk' : 'gallop', next = animations.get(name);
        if (next !== active) { active?.stop(); next?.start(true); active = next; }
        if (active) active.speedRatio = speed < .15 ? 1 : clamp(speed / (name === 'walk' ? 3 : 10), .5, 1.65);
        rider.root.position.y = 3.02 + (speed > 1 ? Math.sin(phase * 2.3) * .035 : 0);
        rider.torso.rotation.x = speed > 11 ? .16 : .03; rider.root.rotation.z = steer * -.04;
    } };
}
