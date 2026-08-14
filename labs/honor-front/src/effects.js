/**
 * Faíscas, explosões, traçantes e o clarão da boca do cano.
 * Buffer pré-alocado para não acordar o GC no meio do desembarque.
 */

import * as THREE from 'three';
import { sparkTexture } from './textures.js';

export class Effects {
    constructor(scene, quality) {
        this.scene = scene;
        this.max = quality.particles;
        this.cursor = 0;
        this.pos = new Float32Array(this.max * 3);
        this.col = new Float32Array(this.max * 3);
        this.size = new Float32Array(this.max);
        this.alpha = new Float32Array(this.max);
        this.vel = new Float32Array(this.max * 3);
        this.life = new Float32Array(this.max);
        this.maxLife = new Float32Array(this.max);

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
        geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
        geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
        geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
        geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);

        this.geo = geo;
        this.points = new THREE.Points(geo, new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            fog: false,
            blending: THREE.AdditiveBlending,
            uniforms: {
                uMap: { value: sparkTexture() },
                uScale: { value: 540 }
            },
            vertexShader: /* glsl */ `
                attribute vec3 aColor;
                attribute float aSize;
                attribute float aAlpha;
                varying vec3 vColor;
                varying float vAlpha;
                uniform float uScale;
                void main() {
                    vColor = aColor;
                    vAlpha = aAlpha;
                    vec4 mv = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = aSize * uScale / max(0.001, -mv.z);
                    gl_Position = projectionMatrix * mv;
                }
            `,
            fragmentShader: /* glsl */ `
                uniform sampler2D uMap;
                varying vec3 vColor;
                varying float vAlpha;
                void main() {
                    if (vAlpha < 0.01) discard;
                    vec4 tex = texture2D(uMap, gl_PointCoord);
                    gl_FragColor = vec4(vColor * tex.rgb, tex.a * vAlpha);
                    #include <tonemapping_fragment>
                    #include <colorspace_fragment>
                }
            `
        }));
        scene.add(this.points);

        this.tracers = [];
        this.muzzle = new THREE.PointLight(0xffc070, 0, 8);
        scene.add(this.muzzle);
        this.muzzleLife = 0;

        this.artillery = new THREE.PointLight(0xffaa66, 0, 40);
        scene.add(this.artillery);
        this.artilleryT = 2;
    }

    spawn(x, y, z, { count = 12, color = [1, 0.55, 0.2], speed = 6, size = 0.7, life = 0.5, lift = 0.8 } = {}) {
        for (let i = 0; i < count; i++) {
            const id = this.cursor++ % this.max;
            const i3 = id * 3;
            this.pos[i3] = x;
            this.pos[i3 + 1] = y;
            this.pos[i3 + 2] = z;
            this.vel[i3] = (Math.random() - 0.5) * speed;
            this.vel[i3 + 1] = Math.random() * speed * lift;
            this.vel[i3 + 2] = (Math.random() - 0.5) * speed;
            this.col[i3] = color[0];
            this.col[i3 + 1] = color[1];
            this.col[i3 + 2] = color[2];
            this.size[id] = size * (0.5 + Math.random());
            this.life[id] = life * (0.6 + Math.random() * 0.6);
            this.maxLife[id] = this.life[id];
            this.alpha[id] = 1;
        }
        this.geo.attributes.position.needsUpdate = true;
        this.geo.attributes.aColor.needsUpdate = true;
        this.geo.attributes.aSize.needsUpdate = true;
        this.geo.attributes.aAlpha.needsUpdate = true;
    }

    explosion(x, y, z, scale = 1) {
        this.spawn(x, y, z, { count: 28 * scale, color: [1, 0.45, 0.12], speed: 10 * scale, size: 1.4, life: 0.7, lift: 1.1 });
        this.spawn(x, y + 0.4, z, { count: 16 * scale, color: [0.35, 0.32, 0.28], speed: 4, size: 2.2, life: 1.4, lift: 0.6 });
        this.artillery.position.set(x, y + 2, z);
        this.artillery.intensity = 18 * scale;
        this.artilleryT = 0.25;
    }

    sparks(x, y, z) {
        this.spawn(x, y, z, { count: 8, color: [1, 0.85, 0.4], speed: 5, size: 0.4, life: 0.28, lift: 0.4 });
    }

    blood(x, y, z) {
        this.spawn(x, y, z, { count: 10, color: [0.55, 0.05, 0.04], speed: 3.2, size: 0.45, life: 0.4, lift: 0.3 });
    }

    muzzleFlash(x, y, z) {
        this.muzzle.position.set(x, y, z);
        this.muzzle.intensity = 6;
        this.muzzleLife = 0.05;
        this.spawn(x, y, z, { count: 6, color: [1, 0.8, 0.35], speed: 2, size: 0.35, life: 0.08, lift: 0.2 });
    }

    tracer(from, to) {
        const geo = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
        const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
            color: 0xffd080,
            transparent: true,
            opacity: 0.85
        }));
        this.scene.add(line);
        this.tracers.push({ line, life: 0.08 });
    }

    flare(x, y, z) {
        this.spawn(x, y, z, { count: 40, color: [1, 0.25, 0.12], speed: 3, size: 1.6, life: 2.4, lift: 2.4 });
    }

    update(dt) {
        for (let i = 0; i < this.max; i++) {
            if (this.life[i] <= 0) {
                this.alpha[i] = 0;
                continue;
            }
            this.life[i] -= dt;
            const i3 = i * 3;
            this.vel[i3 + 1] -= 6 * dt;
            this.pos[i3] += this.vel[i3] * dt;
            this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
            this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
            this.alpha[i] = Math.max(0, this.life[i] / this.maxLife[i]);
        }
        this.geo.attributes.position.needsUpdate = true;
        this.geo.attributes.aAlpha.needsUpdate = true;

        this.muzzleLife -= dt;
        if (this.muzzleLife <= 0) this.muzzle.intensity = 0;

        this.artilleryT -= dt;
        if (this.artilleryT <= 0) this.artillery.intensity = 0;
        else this.artillery.intensity *= 0.86;

        for (let i = this.tracers.length - 1; i >= 0; i--) {
            const t = this.tracers[i];
            t.life -= dt;
            t.line.material.opacity = Math.max(0, t.life / 0.08);
            if (t.life <= 0) {
                this.scene.remove(t.line);
                t.line.geometry.dispose();
                t.line.material.dispose();
                this.tracers.splice(i, 1);
            }
        }
    }
}
