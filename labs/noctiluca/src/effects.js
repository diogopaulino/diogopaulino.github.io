/**
 * Rastro da medusa, estouro de lúmens e onda de choque do pulso.
 * Buffer pré-alocado para não acordar o GC no meio do mergulho.
 */

import * as THREE from 'three';
import { sparkTexture } from './textures.js';

export class Effects {
    constructor(scene, quality) {
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
                uMap: { value: sparkTexture(THREE) },
                uScale: { value: 480 }
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
        this.palette = [0.36, 0.96, 1.0];
    }

    setPalette(pal) {
        const c = new THREE.Color(pal.glowA);
        this.palette = [c.r, c.g, c.b];
        this.glowB = new THREE.Color(pal.glowB);
    }

    spawn(x, y, z, { count = 12, color, speed = 5, size = 0.7, life = 0.55 } = {}) {
        const col = color || this.palette;
        for (let i = 0; i < count; i++) {
            const id = this.cursor++ % this.max;
            const i3 = id * 3;
            this.pos[i3] = x;
            this.pos[i3 + 1] = y;
            this.pos[i3 + 2] = z;
            this.vel[i3] = (Math.random() - 0.5) * speed;
            this.vel[i3 + 1] = (Math.random() - 0.35) * speed;
            this.vel[i3 + 2] = (Math.random() - 0.5) * speed;
            this.col[i3] = col[0];
            this.col[i3 + 1] = col[1];
            this.col[i3 + 2] = col[2];
            this.size[id] = size * (0.55 + Math.random() * 0.9);
            this.life[id] = life;
            this.maxLife[id] = life;
            this.alpha[id] = 1;
        }
    }

    burst(x, y, z, relic) {
        const color = relic ? [1, 0.82, 0.42] : this.palette;
        this.spawn(x, y, z, { count: relic ? 28 : 16, color, speed: relic ? 8 : 5.5, size: relic ? 1.1 : 0.75, life: 0.7 });
    }

    ringBurst(x, y, z) {
        const b = this.glowB || { r: 1, g: 0.55, b: 0.85 };
        this.spawn(x, y, z, {
            count: 32,
            color: [b.r, b.g, b.b],
            speed: 9,
            size: 1.05,
            life: 0.8
        });
    }

    trail(x, y, z) {
        this.spawn(x, y, z, { count: 2, speed: 0.8, size: 0.42, life: 0.38 });
    }

    shock(x, y, z) {
        this.spawn(x, y, z, { count: 22, speed: 11, size: 0.9, life: 0.4 });
    }

    update(dt) {
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
            this.vel[i3 + 1] += 0.6 * dt;
            this.alpha[i] = Math.max(0, this.life[i] / this.maxLife[i]);
        }
        this.geo.attributes.position.needsUpdate = true;
        this.geo.attributes.aColor.needsUpdate = true;
        this.geo.attributes.aSize.needsUpdate = true;
        this.geo.attributes.aAlpha.needsUpdate = true;
    }
}
