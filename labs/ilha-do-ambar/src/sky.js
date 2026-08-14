/**
 * Céu procedural, sol e rig de luz que segue a hora do dia.
 *
 * tod ∈ [0, 1]  →  0 madrugada, 0.28 manhã dourada, 0.5 meio-dia, 0.78 entardecer.
 */

import * as THREE from 'three';
import { makeSkyMaterial } from './shaders.js';
import { lerp } from './utils.js';

export function createSky() {
    const mat = makeSkyMaterial();
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(420, 32, 20), mat);
    mesh.frustumCulled = false;
    return { mesh, uniforms: mat.uniforms };
}

function col(hex) {
    return new THREE.Color(hex);
}

/**
 * Paleta cinematográfica: manhã de parque, névoa quente, sol baixo.
 */
export function sampleDay(tod) {
    const t = ((tod % 1) + 1) % 1;
    const keys = [
        { t: 0.00, top: 0x1a2438, mid: 0x3a3048, bot: 0x2a2018, sun: 0xff8844, fog: 0x1c1820, hemiS: 0x334466, hemiG: 0x1a140e, amb: 0x1a1820, exp: 0.72, sunI: 0.35, hemiI: 0.28 },
        { t: 0.22, top: 0x6aa0d0, mid: 0xe8c090, bot: 0xf0c888, sun: 0xffc878, fog: 0xd4c4a0, hemiS: 0xa8c8e8, hemiG: 0x5a4830, amb: 0x8a7058, exp: 1.05, sunI: 1.55, hemiI: 0.55 },
        { t: 0.38, top: 0x5eb0e8, mid: 0xc8dce8, bot: 0xd8e0c8, sun: 0xfff0c8, fog: 0xc8d4c0, hemiS: 0xb0d4f0, hemiG: 0x4a5a32, amb: 0x889878, exp: 1.12, sunI: 2.15, hemiI: 0.62 },
        { t: 0.55, top: 0x4aa0dc, mid: 0xb8d4e8, bot: 0xd0d8c0, sun: 0xfff6d8, fog: 0xc0d0b8, hemiS: 0xa8d0f0, hemiG: 0x4a6234, amb: 0x90a080, exp: 1.18, sunI: 2.4, hemiI: 0.7 },
        { t: 0.74, top: 0x3a6aa0, mid: 0xe8a060, bot: 0xf0b070, sun: 0xff9a48, fog: 0xc88858, hemiS: 0xd8a878, hemiG: 0x4a3020, amb: 0x8a6040, exp: 1.08, sunI: 1.85, hemiI: 0.48 },
        { t: 0.90, top: 0x1a2848, mid: 0x6a4060, bot: 0x4a2830, sun: 0xff6a3a, fog: 0x2a2030, hemiS: 0x4a5080, hemiG: 0x201810, amb: 0x2a2430, exp: 0.78, sunI: 0.55, hemiI: 0.32 },
        { t: 1.00, top: 0x1a2438, mid: 0x3a3048, bot: 0x2a2018, sun: 0xff8844, fog: 0x1c1820, hemiS: 0x334466, hemiG: 0x1a140e, amb: 0x1a1820, exp: 0.72, sunI: 0.35, hemiI: 0.28 }
    ];
    let a = keys[0];
    let b = keys[1];
    for (let i = 0; i < keys.length - 1; i++) {
        if (t >= keys[i].t && t <= keys[i + 1].t) {
            a = keys[i];
            b = keys[i + 1];
            break;
        }
    }
    const u = (t - a.t) / Math.max(1e-5, b.t - a.t);
    const mixc = (ha, hb) => col(ha).lerp(col(hb), u);
    const sunAngle = (t - 0.22) * Math.PI * 1.15;
    const sunDir = new THREE.Vector3(
        Math.cos(sunAngle) * 0.85,
        Math.sin(sunAngle) * 0.72 + 0.12,
        0.38
    ).normalize();
    return {
        top: mixc(a.top, b.top),
        mid: mixc(a.mid, b.mid),
        bot: mixc(a.bot, b.bot),
        sun: mixc(a.sun, b.sun),
        fog: mixc(a.fog, b.fog),
        hemiS: mixc(a.hemiS, b.hemiS),
        hemiG: mixc(a.hemiG, b.hemiG),
        amb: mixc(a.amb, b.amb),
        exp: lerp(a.exp, b.exp, u),
        sunI: lerp(a.sunI, b.sunI, u),
        hemiI: lerp(a.hemiI, b.hemiI, u),
        sunDir
    };
}

export function applySky(sky, pal) {
    sky.uniforms.topColor.value.copy(pal.top);
    sky.uniforms.midColor.value.copy(pal.mid);
    sky.uniforms.botColor.value.copy(pal.bot);
    sky.uniforms.sunDir.value.copy(pal.sunDir);
    sky.uniforms.sunColor.value.copy(pal.sun);
}

export function createLights(scene, quality) {
    const group = new THREE.Group();
    scene.add(group);

    const amb = new THREE.AmbientLight(0x889070, 0.42);
    group.add(amb);

    const hemi = new THREE.HemisphereLight(0xb0d4f0, 0x4a5a32, 0.62);
    group.add(hemi);

    const dir = new THREE.DirectionalLight(0xffe2b0, 2.1);
    dir.position.set(40, 55, 28);
    dir.castShadow = quality.shadows;
    if (quality.shadows) {
        dir.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
        const s = 72;
        dir.shadow.camera.left = -s;
        dir.shadow.camera.right = s;
        dir.shadow.camera.top = s;
        dir.shadow.camera.bottom = -s;
        dir.shadow.camera.near = 8;
        dir.shadow.camera.far = 220;
        dir.shadow.bias = -0.0007;
        dir.shadow.normalBias = 0.04;
    }
    group.add(dir);
    group.add(dir.target);

    const fill = new THREE.DirectionalLight(0x88aacc, 0.22);
    fill.position.set(-30, 18, -40);
    group.add(fill);

    return { group, dir, hemi, amb, fill };
}

export function applyLights(lights, pal, rain) {
    lights.amb.color.copy(pal.amb);
    lights.amb.intensity = 0.38 * (rain ? 0.75 : 1);
    lights.hemi.color.copy(pal.hemiS);
    lights.hemi.groundColor.copy(pal.hemiG);
    lights.hemi.intensity = pal.hemiI * (rain ? 0.7 : 1);
    lights.dir.color.copy(pal.sun);
    lights.dir.intensity = pal.sunI * (rain ? 0.45 : 1);
    lights.dir.position.copy(pal.sunDir).multiplyScalar(90);
    lights.dir.target.position.set(0, 0, 0);
}
