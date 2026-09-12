/**
 * Ferrari 458 (three.js examples) — glTF + Draco + AO.
 * Mesmo asset de referência do Apex Coast Run / demos oficiais.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const MODEL_URL = new URL('../assets/models/ferrari.glb', import.meta.url).href;
const AO_URL = new URL('../assets/models/ferrari_ao.png', import.meta.url).href;
const DRACO_PATH = 'https://cdn.jsdelivr.net/npm/three@0.185.1/examples/jsm/libs/draco/gltf/';

let templatePromise = null;

function makeMaterials(paintHex, envMap = null) {
    const body = new THREE.MeshPhysicalMaterial({
        color: paintHex,
        metalness: 0.92,
        roughness: 0.18,
        clearcoat: 1,
        clearcoatRoughness: 0.06,
        envMapIntensity: 1.45,
        envMap: envMap || null
    });
    const details = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        metalness: 1,
        roughness: 0.2,
        envMapIntensity: 1.25,
        envMap: envMap || null
    });
    const glass = new THREE.MeshPhysicalMaterial({
        color: 0x88aacc,
        metalness: 0.9,
        roughness: 0.04,
        transmission: 0.55,
        transparent: true,
        opacity: 0.85,
        envMapIntensity: 1.5,
        envMap: envMap || null
    });
    return { body, details, glass };
}

/** Carrega o template uma vez (Draco). */
export function loadCarTemplate() {
    if (templatePromise) return templatePromise;

    templatePromise = (async () => {
        const draco = new DRACOLoader();
        draco.setDecoderPath(DRACO_PATH);
        const loader = new GLTFLoader();
        loader.setDRACOLoader(draco);

        const [gltf, ao] = await Promise.all([
            loader.loadAsync(MODEL_URL),
            new THREE.TextureLoader().loadAsync(AO_URL)
        ]);
        ao.colorSpace = THREE.NoColorSpace;

        const root = gltf.scene.children[0] || gltf.scene;
        root.updateMatrixWorld(true);

        const shadow = new THREE.Mesh(
            new THREE.PlaneGeometry(0.655 * 4, 1.3 * 4),
            new THREE.MeshBasicMaterial({
                map: ao,
                blending: THREE.MultiplyBlending,
                toneMapped: false,
                transparent: true,
                premultipliedAlpha: true,
                depthWrite: false
            })
        );
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.y = 0.01;
        shadow.renderOrder = 2;
        shadow.name = 'contactShadow';
        root.add(shadow);

        root.traverse((o) => {
            if (o.isMesh) {
                o.castShadow = true;
                o.receiveShadow = true;
            }
        });
        return root;
    })();

    return templatePromise;
}

/**
 * @param {number} paintHex
 * @param {THREE.Texture|null} envMap
 * @returns {Promise<THREE.Group>}
 */
export async function createCarMesh(paintHex = 0xc4281c, envMap = null) {
    const template = await loadCarTemplate();
    const car = template.clone(true);
    const mats = makeMaterials(paintHex, envMap);

    const body = car.getObjectByName('body');
    if (body) body.material = mats.body;

    for (const name of ['rim_fl', 'rim_fr', 'rim_rr', 'rim_rl', 'trim']) {
        const o = car.getObjectByName(name);
        if (o) o.material = mats.details;
    }
    const glass = car.getObjectByName('glass');
    if (glass) glass.material = mats.glass;

    const wheelNames = ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr'];
    const wheelRoots = [];
    const steerRoots = [];
    for (const name of wheelNames) {
        const w = car.getObjectByName(name);
        if (!w || !w.parent) continue;
        const pivot = new THREE.Group();
        pivot.name = `${name}_pivot`;
        w.parent.add(pivot);
        pivot.position.copy(w.position);
        pivot.quaternion.copy(w.quaternion);
        pivot.scale.copy(w.scale);
        w.position.set(0, 0, 0);
        w.quaternion.identity();
        w.scale.set(1, 1, 1);
        pivot.add(w);
        wheelRoots.push(pivot);
        if (name === 'wheel_fl' || name === 'wheel_fr') steerRoots.push(pivot);
    }

    const wrap = new THREE.Group();
    wrap.name = 'ferrariWrap';
    wrap.add(car);
    wrap.userData = {
        wheels: wheelRoots,
        steerWheels: steerRoots,
        bodyMat: mats.body,
        detailsMat: mats.details,
        glassMat: mats.glass
    };
    return wrap;
}

export function applyCarEnvMap(mesh, envMap) {
    const { bodyMat, detailsMat, glassMat } = mesh.userData;
    if (bodyMat) { bodyMat.envMap = envMap; bodyMat.needsUpdate = true; }
    if (detailsMat) { detailsMat.envMap = envMap; detailsMat.needsUpdate = true; }
    if (glassMat) { glassMat.envMap = envMap; glassMat.needsUpdate = true; }
}

/**
 * @param {THREE.Object3D} mesh
 * @param {import('./vehicle.js').Vehicle} vehicle
 */
export function syncCarMesh(mesh, vehicle) {
    mesh.position.set(vehicle.x, vehicle.y, vehicle.z);
    mesh.rotation.order = 'YXZ';
    mesh.rotation.y = vehicle.yaw;
    mesh.rotation.x = (vehicle.pitch || 0) * 0.85;
    mesh.rotation.z = (vehicle.roll || 0) * 0.85;

    const { wheels, steerWheels } = mesh.userData;
    if (!wheels) return;

    const spin = vehicle.wheelAngle ?? 0;
    const steer = vehicle.steerAngle ?? 0;
    for (const w of wheels) w.rotation.x = spin;
    for (const w of steerWheels || []) w.rotation.y = steer;
}
