/**
 * Carrega os modelos fotogramétricos (Poly Haven, CC0 — ver assets/CREDITS.md) e os
 * transforma em "kits": listas de variantes prontas para instanciar.
 *
 * Cada variante = { parts: [{ geometry, material }], size: Vector3 } com a geometria
 * já no espaço do mundo do arquivo, recentrada em XZ e apoiada em y = 0, de modo que
 * uma InstancedMesh só precisa de posição/rotação/escala no terreno.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
export const loadGLTF = (url) => loader.loadAsync(url);

const FILES = {
    boulder: 'boulder.glb', cliff: 'cliff.glb', stones: 'stones.glb', quiver: 'quiver-tree.glb',
    trunk: 'dead-trunk.glb', barrels: 'barrels.glb', crate: 'crate.glb', lamp: 'oil-lamp.glb', firepit: 'fire-pit.glb'
};

function prepMaterial(m, aniso) {
    for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap']) if (m[key]) m[key].anisotropy = aniso;
    if (m.transparent && m.map && !m.emissiveMap && m.opacity === 1) {
        // folhagem/galhos recortados: alpha-to-coverage no MSAA em vez de mistura ordenada
        m.transparent = false; m.alphaTest = 0.45; m.alphaToCoverage = true; m.depthWrite = true;
    }
    m.envMapIntensity = 0.7;
    return m;
}

/** Arquivos em que todas as malhas formam um objeto só (corpo + vidro + chama do lampião). */
const WHOLE = new Set(['lamp']);

function toVariants(gltf, aniso, whole = false) {
    gltf.scene.updateMatrixWorld(true);
    const groups = new Map();
    gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        if (whole) { if (!groups.has(gltf.scene)) groups.set(gltf.scene, []); groups.get(gltf.scene).push(o); return; }
        // primitivas de um mesmo nó chegam como filhos de um Group: é uma variante só
        const key = o.parent && o.parent !== gltf.scene && o.parent.children.every((c) => c.isMesh) ? o.parent : o;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(o);
    });
    const variants = [];
    for (const meshes of groups.values()) {
        const parts = meshes.map((m) => {
            const g = m.geometry.clone();
            // posições quantizadas (KHR_mesh_quantization) → float antes de assar a matriz
            for (const name of ['position', 'normal']) {
                const a = g.attributes[name];
                const f = new Float32Array(a.count * 3);
                for (let i = 0; i < a.count; i++) { f[i * 3] = a.getX(i); f[i * 3 + 1] = a.getY(i); f[i * 3 + 2] = a.getZ(i); }
                g.setAttribute(name, new THREE.BufferAttribute(f, 3));
            }
            if (g.attributes.uv && g.attributes.uv.normalized) {
                const a = g.attributes.uv, f = new Float32Array(a.count * 2);
                for (let i = 0; i < a.count; i++) { f[i * 2] = a.getX(i); f[i * 2 + 1] = a.getY(i); }
                g.setAttribute('uv', new THREE.BufferAttribute(f, 2));
            }
            g.applyMatrix4(m.matrixWorld);
            return { geometry: g, material: prepMaterial(m.material, aniso), tris: (g.index ? g.index.count : g.attributes.position.count) / 3 };
        });
        const box = new THREE.Box3();
        for (const p of parts) { p.geometry.computeBoundingBox(); box.union(p.geometry.boundingBox); }
        const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
        for (const p of parts) { p.geometry.translate(-cx, -box.min.y, -cz); p.geometry.computeBoundingSphere(); p.geometry.computeBoundingBox(); }
        variants.push({ parts, size: box.getSize(new THREE.Vector3()), tris: parts.reduce((s, p) => s + p.tris, 0) });
    }
    return variants.sort((a, b) => b.tris - a.tris);
}

/** Carrega todos os kits em paralelo. onProgress(fração) a cada arquivo. */
export async function loadKits(aniso = 4, onProgress = () => {}) {
    const names = Object.keys(FILES);
    let done = 0;
    const entries = await Promise.all(names.map(async (name) => {
        const gltf = await loadGLTF(`assets/${FILES[name]}`);
        onProgress(++done / names.length);
        return [name, toVariants(gltf, aniso, WHOLE.has(name))];
    }));
    return Object.fromEntries(entries);
}

/** Mesh simples de uma variante (para adereços únicos dos povoados). */
export function variantMesh(variant, { scale = 1, castShadow = true } = {}) {
    const group = new THREE.Group();
    for (const p of variant.parts) {
        const mesh = new THREE.Mesh(p.geometry, p.material);
        mesh.castShadow = castShadow && !p.material.transparent;
        mesh.receiveShadow = true;
        group.add(mesh);
    }
    group.scale.setScalar(scale);
    return group;
}
