/**
 * Sistema de efeitos: partículas, esteira do barco, ondas de choque,
 * explosões e fogos de artifício.
 *
 * Tudo vive em poucos buffers pré-alocados — nada de criar/destruir objetos
 * durante o jogo, o que manteria o coletor de lixo trabalhando e causaria
 * engasgos na animação.
 */

import * as THREE from 'three';
import { sparkTexture, smokeTexture, foamTexture } from './textures.js?v=14';
import { waterHeight } from './water.js?v=15';

/* ------------------------------------------------------------------ */
/* Partículas                                                          */
/* ------------------------------------------------------------------ */

class ParticleSystem {
    constructor({ texture, max = 600, blending = THREE.AdditiveBlending, depthWrite = false }) {
        this.max = max;
        this.cursor = 0;
        this._wasAlive = false;

        this.positions = new Float32Array(max * 3);
        this.colors = new Float32Array(max * 3);
        this.sizes = new Float32Array(max);
        this.alphas = new Float32Array(max);

        this.vel = new Float32Array(max * 3);
        this.life = new Float32Array(max);
        this.maxLife = new Float32Array(max);
        this.gravity = new Float32Array(max);
        this.drag = new Float32Array(max);
        this.grow = new Float32Array(max);
        this.baseSize = new Float32Array(max);

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
        geo.setAttribute('aColor', new THREE.BufferAttribute(this.colors, 3));
        geo.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));
        geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphas, 1));
        geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);

        const material = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite,
            blending,
            uniforms: {
                uMap: { value: texture },
                uScale: { value: 700 }
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
                    if (vAlpha <= 0.001) discard;
                    vec4 tex = texture2D(uMap, gl_PointCoord);
                    gl_FragColor = vec4(vColor * tex.rgb, tex.a * vAlpha);
                    #include <tonemapping_fragment>
                    #include <colorspace_fragment>
                }
            `
        });

        this.points = new THREE.Points(geo, material);
        this.points.frustumCulled = false;
        this.points.renderOrder = 12;
        this.geometry = geo;
    }

    spawn(x, y, z, vx, vy, vz, {
        life = 1,
        size = 1,
        color = new THREE.Color(1, 1, 1),
        gravity = 0,
        drag = 0.6,
        grow = 0
    } = {}) {
        const i = this.cursor;
        this.cursor = (this.cursor + 1) % this.max;

        this.positions[i * 3] = x;
        this.positions[i * 3 + 1] = y;
        this.positions[i * 3 + 2] = z;
        this.vel[i * 3] = vx;
        this.vel[i * 3 + 1] = vy;
        this.vel[i * 3 + 2] = vz;
        this.life[i] = life;
        this.maxLife[i] = life;
        this.gravity[i] = gravity;
        this.drag[i] = drag;
        this.grow[i] = grow;
        this.baseSize[i] = size;
        this.sizes[i] = size;
        this.alphas[i] = 1;
        this.colors[i * 3] = color.r;
        this.colors[i * 3 + 1] = color.g;
        this.colors[i * 3 + 2] = color.b;
    }

    update(dt) {
        const { positions, vel, life, maxLife, alphas, sizes, gravity, drag, grow, baseSize } = this;
        let alive = 0;
        for (let i = 0; i < this.max; i++) {
            if (life[i] <= 0) {
                if (alphas[i] !== 0) alphas[i] = 0;
                continue;
            }
            life[i] -= dt;
            if (life[i] <= 0) {
                alphas[i] = 0;
                continue;
            }
            alive++;
            const d = Math.exp(-drag[i] * dt);
            vel[i * 3] *= d;
            vel[i * 3 + 1] = vel[i * 3 + 1] * d - gravity[i] * dt;
            vel[i * 3 + 2] *= d;

            positions[i * 3] += vel[i * 3] * dt;
            positions[i * 3 + 1] += vel[i * 3 + 1] * dt;
            positions[i * 3 + 2] += vel[i * 3 + 2] * dt;

            const t = life[i] / maxLife[i];
            alphas[i] = t < 0.25 ? t / 0.25 : 1;
            sizes[i] = baseSize[i] * (1 + grow[i] * (1 - t));
        }

        if (alive > 0 || this._wasAlive) {
            this.geometry.attributes.position.needsUpdate = true;
            this.geometry.attributes.aAlpha.needsUpdate = true;
            this.geometry.attributes.aSize.needsUpdate = true;
            this.geometry.attributes.aColor.needsUpdate = true;
        }
        this._wasAlive = alive > 0;
    }

    reset() {
        this.life.fill(0);
        this.alphas.fill(0);
        this._wasAlive = false;
        this.geometry.attributes.aAlpha.needsUpdate = true;
    }
}

/* ------------------------------------------------------------------ */
/* Esteira (rastro de espuma atrás do barco)                           */
/* ------------------------------------------------------------------ */

class Wake {
    constructor(samples = 46) {
        this.samples = samples;
        this.trail = [];
        this.positions = new Float32Array(samples * 2 * 3);
        this.uvs = new Float32Array(samples * 2 * 2);
        this.alphas = new Float32Array(samples * 2);

        const indices = [];
        for (let i = 0; i < samples - 1; i++) {
            const a = i * 2;
            indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
        geo.setAttribute('uv', new THREE.BufferAttribute(this.uvs, 2));
        geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphas, 1));
        geo.setIndex(indices);
        geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
        this.geometry = geo;

        const material = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            uniforms: {
                uMap: { value: foamTexture() },
                uTime: { value: 0 }
            },
            vertexShader: /* glsl */ `
                attribute float aAlpha;
                varying float vAlpha;
                varying vec2 vUv;
                void main() {
                    vAlpha = aAlpha;
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: /* glsl */ `
                uniform sampler2D uMap;
                uniform float uTime;
                varying float vAlpha;
                varying vec2 vUv;
                void main() {
                    float edge = smoothstep(0.0, 0.42, vUv.x) * (1.0 - smoothstep(0.58, 1.0, vUv.x));
                    vec2 uv2 = vec2(vUv.x * 1.4, vUv.y * 2.2 - uTime * 0.04);
                    float f = texture2D(uMap, uv2).a;
                    float a = vAlpha * edge * (0.18 + f * 0.85);
                    if (a <= 0.005) discard;
                    gl_FragColor = vec4(vec3(0.95, 0.97, 1.0), a);
                    #include <tonemapping_fragment>
                    #include <colorspace_fragment>
                }
            `
        });

        this.mesh = new THREE.Mesh(geo, material);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = 3;
        this.mesh.material.depthTest = true;
        this.material = material;
    }

    push(x, z, width, strength) {
        const last = this.trail[this.trail.length - 1];
        if (last) {
            const dx = x - last.x;
            const dz = z - last.z;
            if (dx * dx + dz * dz < 1.6) return;
        }
        this.trail.push({ x, z, width, strength, age: 0 });
        if (this.trail.length > this.samples) this.trail.shift();
    }

    update(dt, time) {
        const trail = this.trail;
        for (let i = trail.length - 1; i >= 0; i--) {
            trail[i].age += dt;
            trail[i].width += dt * 1.95;
            if (trail[i].age > 3.3) trail.splice(i, 1);
        }

        const n = this.samples;
        for (let i = 0; i < n; i++) {
            const idx = i - (n - trail.length);
            const s = idx >= 0 ? trail[idx] : null;
            const a = i * 6;
            const u = i * 4;

            if (!s) {
                this.alphas[i * 2] = 0;
                this.alphas[i * 2 + 1] = 0;
                continue;
            }

            const prev = idx > 0 ? trail[idx - 1] : s;
            const next = idx < trail.length - 1 ? trail[idx + 1] : s;
            let dx = next.x - prev.x;
            let dz = next.z - prev.z;
            const len = Math.hypot(dx, dz) || 1;
            dx /= len;
            dz /= len;
            // Perpendicular no plano da água.
            const px = -dz;
            const pz = dx;

            const w = Math.min(s.width, 5.2);
            const y = waterHeight(s.x, s.z, time) + 0.04;
            this.positions[a] = s.x - px * w;
            this.positions[a + 1] = y;
            this.positions[a + 2] = s.z - pz * w;
            this.positions[a + 3] = s.x + px * w;
            this.positions[a + 4] = y;
            this.positions[a + 5] = s.z + pz * w;

            this.uvs[u] = 0;
            this.uvs[u + 1] = idx / this.samples;
            this.uvs[u + 2] = 1;
            this.uvs[u + 3] = idx / this.samples;

            const headFade = Math.min(1, s.age / 0.35);
            const fade = Math.max(0, 1 - s.age / 3.3) ** 1.45 * s.strength * 0.85 * headFade;
            this.alphas[i * 2] = fade;
            this.alphas[i * 2 + 1] = fade;
        }

        this.material.uniforms.uTime.value = time;
        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.uv.needsUpdate = true;
        this.geometry.attributes.aAlpha.needsUpdate = true;
    }

    reset() {
        this.trail.length = 0;
        this.alphas.fill(0);
        this.geometry.attributes.aAlpha.needsUpdate = true;
    }
}

/* ------------------------------------------------------------------ */
/* Anéis de impacto na água                                            */
/* ------------------------------------------------------------------ */

class RingPool {
    constructor(count = 10) {
        const geo = new THREE.RingGeometry(0.55, 1, 28);
        geo.rotateX(-Math.PI / 2);
        this.items = [];
        this.group = new THREE.Group();
        for (let i = 0; i < count; i++) {
            const mat = new THREE.MeshBasicMaterial({
                color: 0xdfeaf2,
                transparent: true,
                opacity: 0,
                depthWrite: false,
                side: THREE.DoubleSide
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.visible = false;
            mesh.renderOrder = 7;
            this.group.add(mesh);
            this.items.push({ mesh, mat, life: 0, maxLife: 1, scale: 1 });
        }
        this.cursor = 0;
    }

    spawn(x, y, z, scale = 1, life = 0.9, color = 0xdfeaf2) {
        const item = this.items[this.cursor];
        this.cursor = (this.cursor + 1) % this.items.length;
        item.mesh.position.set(x, y, z);
        item.mesh.scale.setScalar(scale * 0.4);
        item.mesh.visible = true;
        item.mat.color.set(color);
        item.life = life;
        item.maxLife = life;
        item.scale = scale;
    }

    update(dt) {
        for (const item of this.items) {
            if (item.life <= 0) continue;
            item.life -= dt;
            const t = Math.max(0, item.life / item.maxLife);
            item.mesh.scale.setScalar(item.scale * (0.4 + (1 - t) * 2.6));
            item.mat.opacity = t * 0.75;
            if (item.life <= 0) item.mesh.visible = false;
        }
    }

    reset() {
        for (const item of this.items) {
            item.life = 0;
            item.mesh.visible = false;
        }
    }
}

/* ------------------------------------------------------------------ */
/* Fachada                                                             */
/* ------------------------------------------------------------------ */

const tmpColor = new THREE.Color();

export class Effects {
    constructor(scene, quality) {
        this.scene = scene;
        const scale = quality.id === 'low' ? 0.5 : 1;

        this.spray = new ParticleSystem({
            texture: smokeTexture(),
            max: Math.round(420 * scale),
            blending: THREE.NormalBlending
        });
        this.embers = new ParticleSystem({
            texture: sparkTexture(),
            max: Math.round(620 * scale),
            blending: THREE.AdditiveBlending
        });
        this.smoke = new ParticleSystem({
            texture: smokeTexture(),
            max: Math.round(320 * scale),
            blending: THREE.NormalBlending
        });

        this.wake = new Wake(quality.id === 'low' ? 30 : 46);
        this.rings = new RingPool(quality.id === 'low' ? 6 : 12);

        scene.add(this.spray.points, this.embers.points, this.smoke.points, this.wake.mesh, this.rings.group);

        // Luzes temporárias para explosões (pool pequeno: luzes são caras).
        this.flashes = [];
        const flashCount = quality.id === 'low' ? 1 : 3;
        for (let i = 0; i < flashCount; i++) {
            const light = new THREE.PointLight(0xff8a3c, 0, 60, 2);
            light.visible = false;
            scene.add(light);
            this.flashes.push({ light, life: 0, power: 0 });
        }
        this.flashCursor = 0;
    }

    /** Respingo branco de água. */
    splash(x, y, z, amount = 12, power = 1) {
        for (let i = 0; i < amount; i++) {
            const a = Math.random() * Math.PI * 2;
            const s = (0.6 + Math.random() * 1.6) * power;
            this.spray.spawn(
                x + Math.cos(a) * 0.4,
                y + 0.1,
                z + Math.sin(a) * 0.4,
                Math.cos(a) * s * 2.2,
                2.4 + Math.random() * 3.4 * power,
                Math.sin(a) * s * 2.2,
                {
                    life: 0.45 + Math.random() * 0.5,
                    size: 0.2 + Math.random() * 0.38,
                    color: tmpColor.setRGB(0.9, 0.95, 0.98),
                    gravity: 11,
                    drag: 0.9,
                    grow: 1.5
                }
            );
        }
    }

    /** Fagulhas de fogo (chama contínua, tochas, destroços em chamas). */
    fire(x, y, z, amount = 2, power = 1) {
        for (let i = 0; i < amount; i++) {
            this.embers.spawn(
                x + (Math.random() - 0.5) * 0.5 * power,
                y + Math.random() * 0.4,
                z + (Math.random() - 0.5) * 0.5 * power,
                (Math.random() - 0.5) * 1.4,
                1.6 + Math.random() * 2.6 * power,
                (Math.random() - 0.5) * 1.4,
                {
                    life: 0.45 + Math.random() * 0.7,
                    size: (0.16 + Math.random() * 0.26) * power,
                    color: tmpColor.setHSL(0.07 + Math.random() * 0.05, 1, 0.6),
                    gravity: -1.6,
                    drag: 1.1,
                    grow: 0.8
                }
            );
        }
    }

    smokePuff(x, y, z, amount = 3, power = 1) {
        for (let i = 0; i < amount; i++) {
            this.smoke.spawn(
                x + (Math.random() - 0.5) * power,
                y + Math.random() * 0.6,
                z + (Math.random() - 0.5) * power,
                (Math.random() - 0.5) * 1.6,
                1.2 + Math.random() * 1.8,
                (Math.random() - 0.5) * 1.6,
                {
                    life: 1.5 + Math.random() * 1.5,
                    size: (0.8 + Math.random() * 0.9) * power,
                    color: tmpColor.setRGB(0.22, 0.2, 0.19),
                    gravity: -0.9,
                    drag: 1.4,
                    grow: 2.6
                }
            );
        }
    }

    /** Explosão completa: clarão, fogo, fumaça, estilhaços e onda na água. */
    explosion(x, y, z, power = 1, colorHue = 0.07) {
        const embers = Math.round(34 * power);
        for (let i = 0; i < embers; i++) {
            const a = Math.random() * Math.PI * 2;
            const p = Math.random() * Math.PI - Math.PI / 2;
            const s = (4 + Math.random() * 12) * power;
            this.embers.spawn(
                x, y, z,
                Math.cos(a) * Math.cos(p) * s,
                Math.abs(Math.sin(p)) * s * 0.9 + 2,
                Math.sin(a) * Math.cos(p) * s,
                {
                    life: 0.55 + Math.random() * 0.8,
                    size: (0.22 + Math.random() * 0.4) * power,
                    color: tmpColor.setHSL(colorHue + Math.random() * 0.06, 1, 0.55 + Math.random() * 0.3),
                    gravity: 6,
                    drag: 0.75,
                    grow: 0.6
                }
            );
        }
        this.smokePuff(x, y + 0.5, z, Math.round(8 * power), power * 1.4);
        this.splash(x, 0.1, z, Math.round(16 * power), power);
        this.rings.spawn(x, 0.12, z, 2.2 * power, 1.1, 0xffd9a8);

        const flash = this.flashes[this.flashCursor];
        if (flash) {
            this.flashCursor = (this.flashCursor + 1) % this.flashes.length;
            flash.light.position.set(x, y + 1.2, z);
            flash.light.color.setHSL(colorHue, 1, 0.55);
            flash.life = 0.42;
            flash.power = 70 * power;
            flash.light.visible = true;
        }
    }

    /** Impacto seco (flecha na madeira, machado no casco). */
    impact(x, y, z, color = 0xffc987) {
        for (let i = 0; i < 12; i++) {
            const a = Math.random() * Math.PI * 2;
            this.embers.spawn(
                x, y, z,
                Math.cos(a) * (2 + Math.random() * 5),
                1 + Math.random() * 4,
                Math.sin(a) * (2 + Math.random() * 5),
                {
                    life: 0.28 + Math.random() * 0.35,
                    size: 0.13 + Math.random() * 0.17,
                    color: tmpColor.set(color),
                    gravity: 9,
                    drag: 1.2
                }
            );
        }
    }

    /** Fogos de artifício da vitória. */
    firework(x, y, z, hue = Math.random()) {
        const count = 60;
        for (let i = 0; i < count; i++) {
            const a = Math.random() * Math.PI * 2;
            const p = Math.acos(2 * Math.random() - 1);
            const s = 8 + Math.random() * 10;
            this.embers.spawn(
                x, y, z,
                Math.sin(p) * Math.cos(a) * s,
                Math.cos(p) * s,
                Math.sin(p) * Math.sin(a) * s,
                {
                    life: 1.1 + Math.random() * 1.0,
                    size: 0.28 + Math.random() * 0.3,
                    color: tmpColor.setHSL((hue + Math.random() * 0.12) % 1, 0.95, 0.62),
                    gravity: 5.5,
                    drag: 0.55,
                    grow: -0.3
                }
            );
        }
    }

    update(dt, time) {
        this.spray.update(dt);
        this.embers.update(dt);
        this.smoke.update(dt);
        this.wake.update(dt, time);
        this.rings.update(dt);

        for (const flash of this.flashes) {
            if (flash.life <= 0) continue;
            flash.life -= dt;
            const t = Math.max(0, flash.life / 0.42);
            flash.light.intensity = flash.power * t * t;
            if (flash.life <= 0) flash.light.visible = false;
        }
    }

    reset() {
        this.spray.reset();
        this.embers.reset();
        this.smoke.reset();
        this.wake.reset();
        this.rings.reset();
        for (const flash of this.flashes) {
            flash.life = 0;
            flash.light.visible = false;
        }
    }
}
