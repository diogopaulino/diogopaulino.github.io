/**
 * Oceano reativo ao clima. Tenta o Water oficial do Three.js;
 * se o mirror/RT falhar, usa um shader próprio sem render target.
 */

import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { waterNormalTexture } from './Textures.js';

const WAVE_VERT = /* glsl */ `
uniform float uTime;
uniform float uIntensity;
varying vec2 vUv;
varying float vWave;
void main() {
  vUv = uv;
  vec3 p = position;
  float k = uIntensity;
  float w =
    sin(p.x * 0.08 + uTime * 1.4) * 0.35 * k +
    sin(p.y * 0.05 + uTime * 1.1) * 0.45 * k +
    sin((p.x + p.y) * 0.03 + uTime * 0.7) * 0.25 * k;
  p.z += w;
  vWave = w;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

const WAVE_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uDeep;
uniform float uFoam;
varying vec2 vUv;
varying float vWave;
void main() {
  float f = smoothstep(0.15, 0.45, vWave) * uFoam;
  vec3 col = mix(uDeep, uColor, 0.45 + vWave * 0.3);
  col = mix(col, vec3(0.85, 0.92, 0.95), f * 0.45);
  gl_FragColor = vec4(col, 1.0);
}
`;

export class Ocean {
    constructor(scene, normals, quality) {
        this.intensity = 0.25;
        this._foam = 0;
        this.time = 0;
        this.water = (quality.id === 'ultra' ? this._tryOfficialWater(scene, normals, quality) : null)
            || this._shaderWater(scene, quality);
        this.water.position.y = 0;
        scene.add(this.water);
        this._sun = new THREE.Vector3(0.4, 0.6, 0.2);
    }

    _tryOfficialWater(scene, normals, quality) {
        try {
            if (quality.id === 'low') return null;
            const geo = new THREE.PlaneGeometry(2000, 2000);
            const waterNormals = normals || waterNormalTexture();
            waterNormals.wrapS = waterNormals.wrapT = THREE.RepeatWrapping;
            const water = new Water(geo, {
                textureWidth: Math.min(256, quality.water),
                textureHeight: Math.min(256, quality.water),
                waterNormals,
                sunDirection: new THREE.Vector3(0.4, 0.6, 0.2).normalize(),
                sunColor: 0xf2e6c4,
                waterColor: 0x0a3a4a,
                distortionScale: 2.8,
                fog: Boolean(scene.fog)
            });
            water.rotation.x = -Math.PI / 2;
            water.userData.kind = 'three-water';
            return water;
        } catch (err) {
            console.warn('[Ocean] Water addon indisponível, shader próprio.', err);
            return null;
        }
    }

    _shaderWater(scene, quality) {
        const geo = new THREE.PlaneGeometry(2000, 2000, 1, 1);
        const mat = new THREE.MeshStandardMaterial({
            color: 0x1a6a82,
            roughness: 0.28,
            metalness: 0.12,
            envMapIntensity: 0
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.userData.kind = 'simple-water';
        mesh.receiveShadow = true;
        mesh.material.uniforms = {
            time: { value: 0 },
            distortionScale: { value: 2 },
            waterColor: { value: mat.color },
            sunDirection: { value: new THREE.Vector3() },
            sunColor: { value: new THREE.Color() },
            uTime: { value: 0 },
            uIntensity: { value: 0.25 },
            uFoam: { value: 0 },
            uColor: { value: mat.color },
            uDeep: { value: new THREE.Color(0x062030) }
        };
        return mesh;
    }

    setSun(dir, color) {
        this._sun.copy(dir);
        const u = this.water.material.uniforms;
        if (u?.sunDirection) u.sunDirection.value.copy(dir).normalize();
        if (color && u?.sunColor) u.sunColor.value.set(color);
    }

    setStorm(amount) {
        this.intensity = 0.25 + amount * 2.4;
        this._foam = amount;
        const u = this.water.material.uniforms;
        if (!u) return;
        if (u.distortionScale) u.distortionScale.value = 2.2 + amount * 6;
        if (u.waterColor) u.waterColor.value.set(amount > 0.4 ? 0x071820 : 0x0a3a4a);
        if (u.uIntensity) u.uIntensity.value = this.intensity;
        if (u.uFoam) u.uFoam.value = amount;
        if (u.uColor) u.uColor.value.set(amount > 0.4 ? 0x1a3040 : 0x1a6a7a);
    }

    sample(x, z, time) {
        const k = this.intensity;
        const y =
            Math.sin(x * 0.08 + time * 1.4) * 0.35 * k +
            Math.sin(z * 0.05 + time * 1.1) * 0.45 * k +
            Math.sin((x + z) * 0.03 + time * 0.7) * 0.25 * k;
        const pitch = Math.cos(z * 0.05 + time * 1.1) * 0.06 * k;
        const roll = Math.cos(x * 0.08 + time * 1.4) * 0.07 * k;
        const yaw = Math.sin(time * 0.3) * 0.01 * k;
        return { y, pitch, roll, yaw };
    }

    update(dt, time) {
        this.time = time;
        const u = this.water.material.uniforms;
        if (!u) return;
        if (u.time) u.time.value = time * (0.4 + this.intensity * 0.5);
        if (u.uTime) u.uTime.value = time;
    }
}
