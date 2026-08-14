/**
 * Oceano com Water do Three.js. Reage ao clima (calmaria vs tempestade).
 */

import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { waterNormalTexture } from './Textures.js';

export class Ocean {
    constructor(scene, normals, quality) {
        let water;
        try {
            const geo = new THREE.PlaneGeometry(2000, 2000);
            const waterNormals = normals || waterNormalTexture();
            waterNormals.wrapS = waterNormals.wrapT = THREE.RepeatWrapping;
            water = new Water(geo, {
                textureWidth: quality.water,
                textureHeight: quality.water,
                waterNormals,
                sunDirection: new THREE.Vector3(0.4, 0.6, 0.2).normalize(),
                sunColor: 0xf2e6c4,
                waterColor: 0x0a3a4a,
                distortionScale: 2.8,
                fog: true
            });
            water.rotation.x = -Math.PI / 2;
        } catch (err) {
            console.warn('[Ocean] Water addon indisponível, usando plano.', err);
            water = new THREE.Mesh(
                new THREE.PlaneGeometry(2000, 2000),
                new THREE.MeshStandardMaterial({ color: 0x0a3a4a, roughness: 0.3, metalness: 0.2 })
            );
            water.rotation.x = -Math.PI / 2;
            water.material.uniforms = { time: { value: 0 }, distortionScale: { value: 2 }, waterColor: { value: new THREE.Color(0x0a3a4a) }, sunDirection: { value: new THREE.Vector3() }, sunColor: { value: new THREE.Color() } };
        }
        this.water = water;
        this.water.position.y = 0;
        scene.add(this.water);
        this.intensity = 0.25;
        this._foam = 0;
    }

    setSun(dir, color) {
        const u = this.water.material.uniforms;
        u.sunDirection.value.copy(dir).normalize();
        if (color) u.sunColor.value.set(color);
    }

    setStorm(amount) {
        this.intensity = 0.25 + amount * 2.4;
        this._foam = amount;
        const u = this.water.material.uniforms;
        u.distortionScale.value = 2.2 + amount * 6;
        u.waterColor.value.set(amount > 0.4 ? 0x071820 : 0x0a3a4a);
    }

    /**
     * Amostra de onda para o navio: verticalOffset, pitch, roll.
     */
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
        this.water.material.uniforms.time.value = time * (0.4 + this.intensity * 0.5);
    }
}
