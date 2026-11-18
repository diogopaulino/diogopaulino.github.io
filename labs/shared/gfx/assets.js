/**
 * gfx/assets — carregador dos assets CC0 versionados em /labs/shared/assets.
 *
 *   hdri/<nome>_1k.hdr                 céus HDR (Poly Haven) → environment PMREM
 *   tex/<nome>/{diff,nor,arm}.jpg      conjuntos PBR 1k tileáveis (Poly Haven)
 *                                      arm = AO (R) · rugosidade (G) · metal (B)
 *   models/<nome>/<nome>.gltf          props fotogramétricos (Poly Haven, 1k)
 *   models/fox/Fox.glb                 raposa com esqueleto e 3 clipes (Khronos)
 *
 * Tudo é cacheado por nome: pedir o mesmo asset duas vezes devolve a mesma
 * Promise, e as texturas são compartilhadas entre materiais. Créditos e licenças
 * em /labs/shared/assets/README.md.
 *
 * Falha de rede nunca derruba o lab: cada loader aceita um fallback e os erros
 * viram `console.warn`, deixando a cena de pé com o material/objeto substituto.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

export const ASSET_BASE = new URL('../assets/', import.meta.url).href;
const VERSION = '1';

export const HDRIS = {
    day: 'kloofendal_48d_partly_cloudy_puresky',
    dusk: 'qwantani_dusk_2_puresky',
    night: 'qwantani_night_puresky',
    overcast: 'kloofendal_overcast_puresky',
    misty: 'kloofendal_misty_morning_puresky'
};

export const TEXTURE_SETS = [
    'aerial_grass_rock', 'leafy_grass', 'forest_leaves_02', 'brown_mud_leaves_01', 'coast_sand_rocks_02',
    'sand_01', 'snow_02', 'aerial_rocks_02', 'dirt_floor', 'cobblestone_floor_08', 'mossy_cobblestone',
    'cliff_side', 'mossy_rock', 'castle_wall_slates', 'medieval_blocks_02', 'castle_brick_02_white',
    'plastered_wall_04', 'rough_plaster_03', 'weathered_brown_planks', 'dark_wooden_planks', 'oak_wood_planks',
    'bark_brown_02', 'pine_bark', 'clay_roof_tiles_02', 'roof_slates_02', 'thatch_roof_angled',
    'rusty_metal_02', 'brown_leather', 'fabric_pattern_07', 'denim_fabric', 'slate_floor_02'
];

export const MODELS = [
    'rock_07', 'rock_09', 'rock_face_01', 'rock_moss_set_01', 'moon_rock_01', 'fern_02', 'shrub_03',
    'weed_plant_02', 'flower_empodium', 'grass_bermuda_01', 'tree_stump_01', 'wooden_lantern_01', 'Lantern_01',
    'vintage_oil_lamp', 'wine_barrel_01', 'wooden_crate_01', 'wooden_bucket_01', 'wicker_basket_01',
    'treasure_chest', 'brass_goblets', 'kite_shield', 'antique_estoc', 'ornate_war_hammer', 'wooden_axe',
    'horse_statue_01', 'marble_bust_01', 'food_apple_01', 'dutch_ship_medium',
    'large_castle_door', 'large_iron_gate', 'GothicBed_01', 'Chandelier_01', 'WoodenTable_01',
    'WoodenChair_01', 'wooden_bookshelf_worn', 'stone_fire_pit', 'street_lamp_01'
];

let maxAniso = 8;
let compactTextures = false;
let manager = THREE.DefaultLoadingManager;
const texCache = new Map();
const textureReady = new WeakMap();
const setCache = new Map();
const modelCache = new Map();
const environments = new WeakMap(); // PMREM pertence ao contexto WebGL que o gerou.
const environmentRequests = new WeakMap();
const pendingClones = new WeakMap(); // textura base ainda carregando → clones com repeat próprio

/** Chame uma vez após criar o renderer (anisotropia) — e opcionalmente passe um LoadingManager. */
export function configureAssets(renderer, loadingManager = null, tier) {
    compactTextures = tier === 'low' || navigator.connection?.saveData === true;
    if (renderer) maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    if (loadingManager) manager = loadingManager;
}

const url = (path) => `${ASSET_BASE}${path}?v=${VERSION}`;

function loadTexture(path, srgb) {
    const key = path;
    if (!texCache.has(key)) {
        let finish;
        const ready = new Promise((resolve) => { finish = resolve; });
        const tex = new THREE.TextureLoader(manager).load(url(path), (loaded) => {
            for (const c of pendingClones.get(loaded) || []) c.needsUpdate = true;
            pendingClones.delete(loaded);
            finish();
        }, undefined, () => {
            console.warn(`gfx/assets: textura indisponível (${path})`);
            finish();
        });
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.anisotropy = maxAniso;
        tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        textureReady.set(tex, ready);
        texCache.set(key, tex);
    }
    return texCache.get(key);
}

/**
 * Conjunto PBR (texturas compartilhadas; carregam de forma assíncrona e o material
 * se atualiza sozinho).
 * @returns {{ map, normalMap, aoMap, roughnessMap, metalnessMap }}
 */
export function pbrSet(name) {
    const folder = compactTextures ? `tex/${name}/512` : `tex/${name}`;
    if (!setCache.has(folder)) {
        const diffuse = compactTextures ? 'diff.webp' : 'diff.jpg';
        const map = loadTexture(`${folder}/${diffuse}`, true);
        const normalMap = loadTexture(`${folder}/nor.jpg`, false);
        const arm = loadTexture(`${folder}/arm.jpg`, false);
        setCache.set(folder, { map, normalMap, aoMap: arm, roughnessMap: arm, metalnessMap: arm });
    }
    return setCache.get(folder);
}

/** Mapas PBR com a mesma repetição compartilham o clone e a imagem já carregada. */
export function tiledTexture(texture, repeatX, repeatY = repeatX) {
    if (!texture || (repeatX === 1 && repeatY === 1)) return texture;
    const key = `${texture.uuid}:${repeatX}:${repeatY}`;
    if (!texCache.has(key)) {
        const clone = texture.clone();
        clone.repeat.set(repeatX, repeatY);
        if (!texture.image) {
            clone.version = 0;
            if (!pendingClones.has(texture)) pendingClones.set(texture, []);
            pendingClones.get(texture).push(clone);
        }
        texCache.set(key, clone);
    }
    return texCache.get(key);
}

/**
 * MeshStandardMaterial (ou Physical) a partir de um conjunto PBR.
 * `repeat`: tiles por unidade de UV — clona as texturas (mesma imagem na GPU) só
 * quando difere de 1, para não mexer no repeat de quem compartilha o conjunto.
 * `metal`: usa o canal B do arm como metalness (só para conjuntos metálicos).
 */
export function pbrMaterial(name, {
    repeat = 1,
    color = 0xffffff,
    normalScale = 1,
    roughness = 1,
    metal = false,
    ao = 1,
    envMapIntensity = 1,
    physical = false,
    ...rest
} = {}) {
    const base = pbrSet(name);
    const rx = Array.isArray(repeat) ? repeat[0] : repeat;
    const ry = Array.isArray(repeat) ? repeat[1] : repeat;
    const arm = tiledTexture(base.roughnessMap, rx, ry);
    const Ctor = physical ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
    const m = new Ctor({
        color,
        map: tiledTexture(base.map, rx, ry),
        normalMap: tiledTexture(base.normalMap, rx, ry),
        roughnessMap: arm,
        aoMap: arm,
        aoMapIntensity: ao,
        metalnessMap: metal ? arm : null,
        metalness: metal ? 1 : 0,
        roughness,
        envMapIntensity,
        ...rest
    });
    m.normalScale.set(normalScale, normalScale);
    m.name = `pbr:${name}`;
    return m;
}

/**
 * Carrega um céu HDR e devolve { texture (equirret., para scene.background),
 * env (PMREM, para scene.environment) }. `which`: chave de HDRIS ou nome do arquivo.
 */
export function loadHDRI(which, renderer) {
    const name = HDRIS[which] || which;
    if (!environments.has(renderer)) environments.set(renderer, new Map());
    const hdriCache = environments.get(renderer);
    if (!hdriCache.has(name)) {
        hdriCache.set(name, new Promise((resolve) => {
            new HDRLoader(manager).load(url(`hdri/${name}_1k.hdr`), (texture) => {
                texture.mapping = THREE.EquirectangularReflectionMapping;
                const pmrem = new THREE.PMREMGenerator(renderer);
                const env = pmrem.fromEquirectangular(texture).texture;
                pmrem.dispose();
                resolve({ texture, env, name });
            }, undefined, () => {
                console.warn(`gfx/assets: HDRI indisponível (${name})`);
                resolve(null);
            });
        }));
    }
    return hdriCache.get(name);
}

/**
 * Aplica um HDRI como iluminação ambiente (e, se `background`, como fundo).
 * Devolve a Promise do HDRI (null se falhou — a cena fica com a luz que já tinha).
 */
export async function applyHDRI(scene, renderer, which, {
    background = false,
    intensity = 1,
    backgroundIntensity = 1,
    blur = 0,
    rotationY = 0
} = {}) {
    const request = Symbol();
    environmentRequests.set(scene, request);
    const hdri = await loadHDRI(which, renderer);
    if (!hdri || environmentRequests.get(scene) !== request) return null;
    scene.environment = hdri.env;
    scene.environmentIntensity = intensity;
    scene.environmentRotation.set(0, rotationY, 0);
    if (background) {
        scene.background = hdri.texture;
        scene.backgroundIntensity = backgroundIntensity;
        scene.backgroundBlurriness = blur;
        scene.backgroundRotation.set(0, rotationY, 0);
    }
    return hdri;
}

function prepareModel(root) {
    root.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true;
        o.receiveShadow = true;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
            for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap']) {
                if (m[k]) m[k].anisotropy = maxAniso;
            }
        }
    });
    return root;
}

function loadGLTF(name) {
    if (!modelCache.has(name)) {
        const path = name === 'fox' ? 'models/fox/Fox.glb' : `models/${name}/${name}.gltf`;
        modelCache.set(name, new Promise((resolve) => {
            new GLTFLoader(manager).load(url(path), (gltf) => {
                prepareModel(gltf.scene);
                resolve(gltf);
            }, undefined, (err) => {
                console.warn(`gfx/assets: modelo indisponível (${name})`, err?.message || '');
                resolve(null);
            });
        }));
    }
    return modelCache.get(name);
}

const _box = new THREE.Box3();
const _size = new THREE.Vector3();
const _center = new THREE.Vector3();

/**
 * Instancia um modelo (clone que compartilha geometria e material).
 *
 * @param {string} name
 * @param {object} [o]
 * @param {number} [o.height]   normaliza a altura (m); alternativas: `width`, `length`, `fit` (maior lado)
 * @param {boolean} [o.ground]  apoia a base em y=0 e centraliza em XZ (padrão true)
 * @param {THREE.Object3D} [o.fallback] devolvido se o modelo não carregar
 * @returns {Promise<THREE.Group|null>} grupo com userData.size (Vector3 final)
 */
export async function loadModel(name, { height, width, length, fit, scale, ground = true, fallback = null } = {}) {
    const gltf = await loadGLTF(name);
    if (!gltf) return fallback;
    const inner = gltf.animations?.length ? cloneSkinned(gltf.scene) : gltf.scene.clone(true);
    _box.setFromObject(inner);
    _box.getSize(_size);
    _box.getCenter(_center);
    let k = scale ?? 1;
    if (height) k = height / (_size.y || 1);
    else if (width) k = width / (_size.x || 1);
    else if (length) k = length / (_size.z || 1);
    else if (fit) k = fit / (Math.max(_size.x, _size.y, _size.z) || 1);
    inner.scale.multiplyScalar(k);
    if (ground) inner.position.set(-_center.x * k, -_box.min.y * k, -_center.z * k);
    const group = new THREE.Group();
    group.name = `model:${name}`;
    group.add(inner);
    group.userData.size = _size.clone().multiplyScalar(k);
    group.userData.animations = gltf.animations || [];
    return group;
}

/**
 * Espalha um modelo estático em muitas posições com InstancedMesh (1 draw call
 * por sub-malha). `placements`: [{ x, y, z, ry?, s?, sy? }]. `height` normaliza
 * a altura do modelo antes da escala `s` de cada instância.
 * @returns {Promise<THREE.Group|null>}
 */
export async function instanceModel(name, placements, { height, fit, castShadow = true, receiveShadow = true } = {}) {
    const gltf = await loadGLTF(name);
    if (!gltf || !placements.length) return null;
    gltf.scene.updateMatrixWorld(true);
    _box.setFromObject(gltf.scene);
    _box.getSize(_size);
    _box.getCenter(_center);
    const k = height ? height / (_size.y || 1) : fit ? fit / (Math.max(_size.x, _size.y, _size.z) || 1) : 1;
    const base = new THREE.Matrix4().makeScale(k, k, k)
        .multiply(new THREE.Matrix4().makeTranslation(-_center.x, -_box.min.y, -_center.z));
    const group = new THREE.Group();
    group.name = `instances:${name}`;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        const inst = new THREE.InstancedMesh(o.geometry, o.material, placements.length);
        const local = base.clone().multiply(o.matrixWorld);
        placements.forEach((pl, i) => {
            const sc = pl.s ?? 1;
            p.set(pl.x, pl.y ?? 0, pl.z);
            q.setFromAxisAngle(up, pl.ry ?? 0);
            s.set(sc, pl.sy ?? sc, sc);
            m.compose(p, q, s).multiply(local);
            inst.setMatrixAt(i, m);
        });
        inst.instanceMatrix.needsUpdate = true;
        inst.castShadow = castShadow;
        inst.receiveShadow = receiveShadow;
        inst.computeBoundingSphere();
        group.add(inst);
    });
    return group;
}

/**
 * Raposa com esqueleto (Khronos Fox). Clipes: Survey (parada), Walk, Run.
 * @returns {Promise<{ object, mixer, actions, play(name, fade) }|null>}
 */
export async function loadFox({ length = 1.1 } = {}) {
    const object = await loadModel('fox', { length });
    if (!object) return null;
    const mixer = new THREE.AnimationMixer(object);
    const actions = {};
    for (const clip of object.userData.animations) actions[clip.name] = mixer.clipAction(clip);
    let current = null;
    const play = (name, fade = 0.25) => {
        const next = actions[name];
        if (!next || next === current) return;
        next.reset().fadeIn(fade).play();
        if (current) current.fadeOut(fade);
        current = next;
    };
    play('Survey', 0);
    return { object, mixer, actions, play };
}

/** Pré-carrega em paralelo (para a tela de loading). Resolve quando tudo chegou ou falhou. */
export async function preload({ models = [], textures = [] } = {}) {
    const maps = textures.flatMap((name) => {
        const { map, normalMap, roughnessMap } = pbrSet(name);
        return [map, normalMap, roughnessMap].map((texture) => textureReady.get(texture));
    });
    const [loadedModels] = await Promise.all([Promise.all(models.map(loadGLTF)), Promise.all(maps)]);
    return loadedModels;
}
