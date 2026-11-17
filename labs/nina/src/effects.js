/**
 * Amoras que explodem em brilho, corações ao fazer amigo e pétalas da festa.
 *
 * Três piscinas fixas, sem alocação por quadro:
 *   faíscas   Points aditivos (posição/vida em buffers atualizados só enquanto há faísca viva)
 *   corações  InstancedMesh de coração extrudado; sobem 1,4 m/s girando e crescem
 *   pétalas   InstancedMesh de pétalas curvas; gravidade 3,2 m/s², arrasto e giro (festa)
 * Física das faíscas: v.y −= 6·dt; pétalas: v.y −= 3,2·dt, v *= exp(−1,2·dt).
 */

import * as THREE from 'three';
import { heartGeometry } from './builds.js?v=20';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

export class Effects {
    constructor(scene, quality = {}) {
        this.scene = scene;
        this._sparks(quality.sparks ?? 96);
        this._hearts(12);
        this._petals(quality.confetti ?? 72);
    }

    _sparks(n) {
        this.sparkN = n;
        this.sparkPos = new Float32Array(n * 3);
        this.sparkVel = new Float32Array(n * 3);
        this.sparkLife = new Float32Array(n);
        this.sparkCol = new Float32Array(n * 3);
        this.sparkA = new Float32Array(n);
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(this.sparkPos, 3).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute('color', new THREE.BufferAttribute(this.sparkCol, 3).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute('aLife', new THREE.BufferAttribute(this.sparkA, 1).setUsage(THREE.DynamicDrawUsage));
        g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
        this.sparkUniforms = { uScale: { value: 600 } };
        const mat = new THREE.ShaderMaterial({
            uniforms: this.sparkUniforms,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            vertexColors: true,
            vertexShader: /* glsl */ `
                attribute float aLife;
                uniform float uScale;
                varying vec3 vCol;
                varying float vA;
                void main() {
                    vCol = color;
                    vA = aLife;
                    vec4 mv = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = aLife > 0.0 ? clamp(uScale * (0.05 + 0.1 * aLife) / -mv.z, 1.0, 48.0) : 0.0;
                    gl_Position = projectionMatrix * mv;
                }`,
            fragmentShader: /* glsl */ `
                varying vec3 vCol;
                varying float vA;
                void main() {
                    vec2 c = gl_PointCoord - 0.5;
                    float d = length(c);
                    float star = max(0.0, 1.0 - abs(c.x) * 12.0) * max(0.0, 1.0 - abs(c.y) * 2.6) + max(0.0, 1.0 - abs(c.y) * 12.0) * max(0.0, 1.0 - abs(c.x) * 2.6);
                    float a = (smoothstep(0.3, 0.0, d) + star) * min(1.0, vA * 2.0);
                    if (a < 0.004) discard;
                    gl_FragColor = vec4(vCol * a * 2.4, 1.0);
                }`
        });
        this.sparks = new THREE.Points(g, mat);
        this.sparks.frustumCulled = false;
        this.sparks.renderOrder = 8;
        this.sparkIndex = 0;
        this.sparkAlive = 0;
        this.scene.add(this.sparks);
    }

    _hearts(n) {
        this.heartN = n;
        const mat = new THREE.MeshStandardMaterial({ color: 0xff4f7e, emissive: 0xff2a60, emissiveIntensity: 0.55, roughness: 0.28, metalness: 0 });
        this.heartMesh = new THREE.InstancedMesh(heartGeometry(), mat, n);
        this.heartMesh.frustumCulled = false;
        this.heartMesh.castShadow = false;
        this.hearts = [];
        for (let i = 0; i < n; i++) {
            this.hearts.push({ life: 0, x: 0, y: 0, z: 0, spin: 0, drift: 0 });
            this.heartMesh.setMatrixAt(i, ZERO);
        }
        this.heartIndex = 0;
        this.scene.add(this.heartMesh);
    }

    _petals(n) {
        this.petalN = n;
        // pétala: quad curvo em forma de gota
        const g = new THREE.PlaneGeometry(0.11, 0.16, 2, 3);
        const pa = g.attributes.position;
        for (let i = 0; i < pa.count; i++) {
            const y = pa.getY(i) / 0.08;
            const w = Math.sqrt(Math.max(0, 1 - y * y)) * (1 - 0.25 * y);
            pa.setX(i, pa.getX(i) * w);
            pa.setZ(i, 0.025 * (1 - y * y) + 0.02 * y);
        }
        g.computeVertexNormals();
        const mat = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0, side: THREE.DoubleSide, emissive: 0xffffff, emissiveIntensity: 0.08 });
        this.petalMesh = new THREE.InstancedMesh(g, mat, n);
        this.petalMesh.frustumCulled = false;
        this.petalMesh.castShadow = false;
        const colors = [0xff7fb4, 0xffe066, 0xffffff, 0xff9f43, 0xc9a0ff, 0xff5a6e];
        const c = new THREE.Color();
        this.petals = [];
        for (let i = 0; i < n; i++) {
            this.petals.push({ life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, rz: 0, w: 0 });
            this.petalMesh.setMatrixAt(i, ZERO);
            this.petalMesh.setColorAt(i, c.set(colors[i % colors.length]));
        }
        this.petalAlive = 0;
        this.scene.add(this.petalMesh);
    }

    burst(position, color = 0xff6eb4, count = 12) {
        const c = _col.set(color);
        for (let k = 0; k < count; k++) {
            const i = this.sparkIndex % this.sparkN;
            this.sparkIndex++;
            this.sparkPos[i * 3] = position.x;
            this.sparkPos[i * 3 + 1] = position.y + 0.25;
            this.sparkPos[i * 3 + 2] = position.z;
            this.sparkVel[i * 3] = (Math.random() - 0.5) * 2.6;
            this.sparkVel[i * 3 + 1] = 1.2 + Math.random() * 2.2;
            this.sparkVel[i * 3 + 2] = (Math.random() - 0.5) * 2.6;
            this.sparkCol[i * 3] = c.r;
            this.sparkCol[i * 3 + 1] = c.g;
            this.sparkCol[i * 3 + 2] = c.b;
            this.sparkLife[i] = 0.6 + Math.random() * 0.4;
        }
        this.sparkAlive = 1;
        this.sparks.geometry.attributes.color.needsUpdate = true;
    }

    heart(position, count = 3) {
        for (let k = 0; k < count; k++) {
            const h = this.hearts[this.heartIndex % this.heartN];
            this.heartIndex++;
            h.x = position.x + (Math.random() - 0.5) * 0.5;
            h.y = position.y + 0.55 + k * 0.18;
            h.z = position.z + (Math.random() - 0.5) * 0.5;
            h.life = 1.3 + k * 0.18;
            h.max = h.life;
            h.spin = Math.random() * 6;
            h.drift = (Math.random() - 0.5) * 0.5;
        }
    }

    party(origin) {
        for (const c of this.petals) {
            c.x = origin.x;
            c.y = origin.y + 0.6;
            c.z = origin.z;
            c.vx = (Math.random() - 0.5) * 5;
            c.vy = 3.4 + Math.random() * 4;
            c.vz = (Math.random() - 0.5) * 5;
            c.rx = Math.random() * 6;
            c.ry = Math.random() * 6;
            c.rz = Math.random() * 6;
            c.w = 2 + Math.random() * 5;
            c.life = 3.4 + Math.random() * 2.2;
        }
        this.petalAlive = 1;
    }

    /** `pxScale` = altura do canvas em px / (2·tan(fov/2)) — tamanho das faíscas em tela. */
    update(dt, pxScale = 600) {
        this.sparkUniforms.uScale.value = pxScale;
        if (this.sparkAlive) {
            let alive = 0;
            for (let i = 0; i < this.sparkN; i++) {
                let life = this.sparkLife[i];
                if (life <= 0) {
                    this.sparkA[i] = 0;
                    continue;
                }
                life -= dt;
                this.sparkLife[i] = life;
                this.sparkVel[i * 3 + 1] -= 6 * dt;
                this.sparkPos[i * 3] += this.sparkVel[i * 3] * dt;
                this.sparkPos[i * 3 + 1] += this.sparkVel[i * 3 + 1] * dt;
                this.sparkPos[i * 3 + 2] += this.sparkVel[i * 3 + 2] * dt;
                this.sparkA[i] = Math.max(0, life);
                if (life > 0) alive++;
            }
            this.sparkAlive = alive;
            this.sparks.geometry.attributes.position.needsUpdate = true;
            this.sparks.geometry.attributes.aLife.needsUpdate = true;
        }

        let dirty = false;
        for (let i = 0; i < this.heartN; i++) {
            const h = this.hearts[i];
            if (h.life <= 0) continue;
            h.life -= dt;
            dirty = true;
            if (h.life <= 0) {
                this.heartMesh.setMatrixAt(i, ZERO);
                continue;
            }
            const age = 1 - h.life / h.max;
            h.y += dt * 1.4;
            h.x += h.drift * dt;
            h.spin += dt * 2.5;
            // nasce pequeno, incha, some encolhendo no fim
            const s = 0.3 * Math.min(1, age * 5) * Math.min(1, h.life * 3) * (1 + 0.12 * Math.sin(h.spin * 3));
            _e.set(0, h.spin, Math.sin(h.spin) * 0.2);
            this.heartMesh.setMatrixAt(i, _m.compose(_p.set(h.x, h.y, h.z), _q.setFromEuler(_e), _s.setScalar(s)));
        }
        if (dirty) this.heartMesh.instanceMatrix.needsUpdate = true;

        if (this.petalAlive) {
            let alive = 0;
            const drag = Math.exp(-1.2 * dt);
            for (let i = 0; i < this.petalN; i++) {
                const c = this.petals[i];
                if (c.life <= 0) continue;
                c.life -= dt;
                if (c.life <= 0) {
                    this.petalMesh.setMatrixAt(i, ZERO);
                    continue;
                }
                alive++;
                c.vy -= 3.2 * dt;
                c.vx *= drag;
                c.vz *= drag;
                if (c.vy < -1.1) c.vy = -1.1;
                c.x += (c.vx + Math.sin(c.rx) * 0.5) * dt;
                c.y += c.vy * dt;
                c.z += (c.vz + Math.cos(c.rz) * 0.5) * dt;
                c.rx += dt * c.w;
                c.rz += dt * c.w * 0.7;
                _e.set(c.rx, c.ry, c.rz);
                this.petalMesh.setMatrixAt(i, _m.compose(_p.set(c.x, c.y, c.z), _q.setFromEuler(_e), _s.setScalar(Math.min(1, c.life * 2) * 1.5)));
            }
            this.petalAlive = alive;
            this.petalMesh.instanceMatrix.needsUpdate = true;
        }
    }

    clear() {
        this.sparkLife.fill(0);
        this.sparkA.fill(0);
        this.sparks.geometry.attributes.aLife.needsUpdate = true;
        this.sparkAlive = 0;
        for (let i = 0; i < this.heartN; i++) {
            this.hearts[i].life = 0;
            this.heartMesh.setMatrixAt(i, ZERO);
        }
        this.heartMesh.instanceMatrix.needsUpdate = true;
        for (let i = 0; i < this.petalN; i++) {
            this.petals[i].life = 0;
            this.petalMesh.setMatrixAt(i, ZERO);
        }
        this.petalMesh.instanceMatrix.needsUpdate = true;
        this.petalAlive = 0;
    }
}

const _col = new THREE.Color();
