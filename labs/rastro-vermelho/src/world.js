/**
 * Mundo infinito em chunks para Rastro Vermelho em Babylon.js.
 * Altura h(x, z), biomas, e terreno procedural com vertex colors.
 */

import { CHUNK_SIZE, WATER_Y, REGION_PREFIX, REGION_SUFFIX } from './config.js';
import { fbm, ridged, hash2, smoothstep, lerp } from './utils.js';
import { buildCactus, buildRock, buildTelegraph } from './models.js';

export function aridAt(x, z) {
    return fbm(x * 0.00092, z * 0.00092, 7, 4);
}

export function heightAt(x, z) {
    const continent = Math.pow(fbm(x * 0.00105, z * 0.00105, 1, 5), 1.22);
    const ridge = Math.pow(ridged(x * 0.0022, z * 0.0022, 11, 4), 2.1);
    const mountains = continent * 72 + ridge * continent * 42;
    const hills = (fbm(x * 0.0065, z * 0.0065, 3, 5) - 0.32) * 18;
    const rolling = Math.pow(fbm(x * 0.0026, z * 0.0026, 15, 4), 1.12) * 26;
    const detail = (fbm(x * 0.034, z * 0.034, 9, 3) - 0.5) * 2.1;

    const warpX = x + (fbm(x * 0.002, z * 0.002, 21, 3) - 0.5) * 180;
    const warpZ = z + (fbm(x * 0.002, z * 0.002, 27, 3) - 0.5) * 180;
    const river = Math.abs(Math.sin(warpX * 0.0042) * Math.cos(warpZ * 0.0031));
    const carve = Math.pow(1 - smoothstep(0.02, 0.16, river), 2) * 15;

    const arid = aridAt(x, z);
    const canyonMask = smoothstep(0.55, 0.82, arid) * smoothstep(0.32, 0.7, ridge);
    const nCan = ridged(x * 0.0062, z * 0.0062, 33, 3);
    const canyon = -Math.pow(nCan, 3) * 20 * canyonMask;

    let h = mountains + hills + rolling + detail + canyon - carve;
    if (arid > 0.62 && h > 14 && h < 32) {
        h = lerp(h, 18 + (h - 18) * 0.18, smoothstep(0.62, 0.8, arid));
    }
    return h;
}

export function biomeAt(x, z, h = heightAt(x, z)) {
    const arid = aridAt(x, z);
    const moist = 1 - arid;
    if (h < WATER_Y + 1.6) return 'riparian';
    if (h > 48) return 'alpine';
    const canyonDeep = h < 12 && arid > 0.55 && ridged(x * 0.0062, z * 0.0062, 33, 3) > 0.55;
    if (canyonDeep) return 'canyon';
    if (h > 30 && moist > 0.42) return 'pine';
    if (arid > 0.6) return h > 18 ? 'mesa' : 'desert';
    return 'prairie';
}

export function regionName(cx, cz) {
    const a = Math.floor(hash2(cx, cz, 41) * REGION_PREFIX.length);
    const b = Math.floor(hash2(cx, cz, 73) * REGION_SUFFIX.length);
    return `${REGION_PREFIX[a]} ${REGION_SUFFIX[b]}`;
}

export class WorldManager {
    constructor(BABYLON, scene) {
        this.BABYLON = BABYLON;
        this.scene = scene;
        this.chunks = new Map();
        this.root = new BABYLON.TransformNode('world_terrain', scene);

        this.terrainMat = new BABYLON.StandardMaterial('mat_western_terrain', scene);
        this.terrainMat.specularColor = new BABYLON.Color3(0, 0, 0);
        this.terrainMat.roughness = 0.9;
    }

    getChunkKey(cx, cz) {
        return `${cx}_${cz}`;
    }

    update(playerPos) {
        const cx = Math.floor(playerPos.x / CHUNK_SIZE);
        const cz = Math.floor(playerPos.z / CHUNK_SIZE);

        const currentKeys = new Set();
        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                const kx = cx + dx;
                const kz = cz + dz;
                const key = this.getChunkKey(kx, kz);
                currentKeys.add(key);
                if (!this.chunks.has(key)) {
                    this.createChunk(kx, kz);
                }
            }
        }

        // Remover chunks distantes
        for (const [key, chunk] of this.chunks) {
            if (!currentKeys.has(key)) {
                chunk.mesh.dispose();
                chunk.props.forEach((p) => p.dispose());
                this.chunks.delete(key);
            }
        }
    }

    createChunk(cx, cz) {
        const BABYLON = this.BABYLON;
        const segs = 20;
        const width = CHUNK_SIZE;
        const height = CHUNK_SIZE;
        const startX = cx * width;
        const startZ = cz * height;

        const positions = [];
        const indices = [];
        const colors = [];

        for (let row = 0; row <= segs; row++) {
            for (let col = 0; col <= segs; col++) {
                const x = startX + (col / segs - 0.5) * width;
                const z = startZ + (row / segs - 0.5) * height;
                const y = heightAt(x, z);

                positions.push(x, y, z);

                // Cor do terreno baseada no bioma e elevação
                const b = biomeAt(x, z, y);
                let r = 0.72, g = 0.42, bl = 0.24;
                if (b === 'canyon' || b === 'mesa') {
                    r = 0.78; g = 0.32; bl = 0.18;
                } else if (b === 'desert') {
                    r = 0.82; g = 0.62; bl = 0.38;
                } else if (b === 'prairie') {
                    r = 0.68; g = 0.55; bl = 0.28;
                } else if (b === 'alpine') {
                    r = 0.65; g = 0.62; bl = 0.58;
                }
                colors.push(r, g, bl, 1.0);
            }
        }

        for (let row = 0; row < segs; row++) {
            for (let col = 0; col < segs; col++) {
                const i0 = row * (segs + 1) + col;
                const i1 = i0 + 1;
                const i2 = (row + 1) * (segs + 1) + col;
                const i3 = i2 + 1;

                indices.push(i0, i2, i1);
                indices.push(i1, i2, i3);
            }
        }

        const mesh = new BABYLON.Mesh(`chunk_${cx}_${cz}`, this.scene);
        const normals = [];
        BABYLON.VertexData.ComputeNormals(positions, indices, normals);

        const vertexData = new BABYLON.VertexData();
        vertexData.positions = positions;
        vertexData.indices = indices;
        vertexData.normals = normals;
        vertexData.colors = colors;
        vertexData.applyToMesh(mesh, false);

        mesh.material = this.terrainMat;
        mesh.parent = this.root;
        mesh.receiveShadows = true;

        // Adicionar props (cactos, rochas)
        const props = [];
        const rand = (seed) => (hash2(cx + seed, cz - seed, 17));

        if (rand(1) > 0.35) {
            const cactus = buildCactus(BABYLON, this.scene);
            const px = startX + (rand(2) - 0.5) * width * 0.7;
            const pz = startZ + (rand(3) - 0.5) * height * 0.7;
            cactus.position.set(px, heightAt(px, pz), pz);
            props.push(cactus);
        }

        if (rand(4) > 0.45) {
            const rock = buildRock(BABYLON, this.scene);
            const rx = startX + (rand(5) - 0.5) * width * 0.7;
            const rz = startZ + (rand(6) - 0.5) * height * 0.7;
            rock.position.set(rx, heightAt(rx, rz) + 0.5, rz);
            props.push(rock);
        }

        if (rand(7) > 0.75) {
            const tele = buildTelegraph(BABYLON, this.scene);
            const tx = startX + (rand(8) - 0.5) * width * 0.7;
            const tz = startZ + (rand(9) - 0.5) * height * 0.7;
            tele.position.set(tx, heightAt(tx, tz), tz);
            props.push(tele);
        }

        this.chunks.set(this.getChunkKey(cx, cz), { mesh, props });
    }
}
