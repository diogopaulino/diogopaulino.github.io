/**
 * Chuva em volume ao redor da câmera, faíscas de impacto e pulsos.
 */

import * as THREE from 'three';
import { sparkTexture } from './textures.js';

export class Effects {
    constructor(scene, quality) {
        this.max = Math.max(80, Math.floor(quality.rain * 0.25));
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

        this.points = new THREE.Points(geo, new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            fog: false,
            blending: THREE.AdditiveBlending,
            uniforms: { uMap: { value: sparkTexture(THREE) }, uScale: { value: 480 } },
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
        this.geo = geo;

        this.rainCount = quality.rain;
        this.rainPos = new Float32Array(this.rainCount * 3);
        this.rainGeo = new THREE.BufferGeometry();
        this.rainGeo.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3));
        this.rain = new THREE.Points(this.rainGeo, new THREE.PointsMaterial({
            color: 0xa8c4e8,
            size: 0.08,
            transparent: true,
            opacity: 0.45,
            depthWrite: false,
            fog: true
        }));
        this.rain.frustumCulled = false;
        scene.add(this.rain);
        for (let i = 0; i < this.rainCount; i++) {
            this.rainPos[i * 3] = (Math.random() - 0.5) * 70;
            this.rainPos[i * 3 + 1] = Math.random() * 50;
            this.rainPos[i * 3 + 2] = (Math.random() - 0.5) * 70;
        }
    }

    spawn(x, y, z, { count = 14, color = [1, 0.35, 0.22], speed = 7, size = 0.65, life = 0.45 } = {}) {
        for (let i = 0; i < count; i++) {
            const id = this.cursor++ % this.max;
            const i3 = id * 3;
            this.pos[i3] = x;
            this.pos[i3 + 1] = y;
            this.pos[i3 + 2] = z;
            this.vel[i3] = (Math.random() - 0.5) * speed;
            this.vel[i3 + 1] = Math.random() * speed * 0.85;
            this.vel[i3 + 2] = (Math.random() - 0.5) * speed;
            this.col[i3] = color[0];
            this.col[i3 + 1] = color[1];
            this.col[i3 + 2] = color[2];
            this.size[id] = size * (0.55 + Math.random() * 0.8);
            this.life[id] = life;
            this.maxLife[id] = life;
            this.alpha[id] = 1;
        }
    }

    update(dt, cam) {
        for (let i = 0; i < this.max; i++) {
            if (this.life[i] <= 0) {
                this.alpha[i] = 0;
                continue;
            }
            this.life[i] -= dt;
            const i3 = i * 3;
            this.pos[i3] += this.vel[i3] * dt;
            this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
            this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
            this.vel[i3 + 1] -= 18 * dt;
            this.alpha[i] = Math.max(0, this.life[i] / this.maxLife[i]);
        }
        this.geo.attributes.position.needsUpdate = true;
        this.geo.attributes.aAlpha.needsUpdate = true;

        for (let i = 0; i < this.rainCount; i++) {
            const i3 = i * 3;
            this.rainPos[i3 + 1] -= (28 + (i % 7) * 3) * dt;
            this.rainPos[i3] -= 4.5 * dt;
            if (this.rainPos[i3 + 1] < -8) {
                this.rainPos[i3] = cam.x + (Math.random() - 0.5) * 64;
                this.rainPos[i3 + 1] = cam.y + 8 + Math.random() * 36;
                this.rainPos[i3 + 2] = cam.z + (Math.random() - 0.5) * 64;
            }
        }
        this.rain.position.set(0, 0, 0);
        this.rainGeo.attributes.position.needsUpdate = true;
    }
}
