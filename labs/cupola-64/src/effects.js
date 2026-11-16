/**
 * Faíscas de moeda, poeira do pound, respingos e o tremor da câmera orbital.
 *
 * Duas nuvens de pontos com pool fixo (zero alocação por partícula):
 *   - `glow`  aditiva, em HDR (cores > 1 acendem o bloom): faíscas e estrelas;
 *   - `puff`  alfa normal, tingida pela luz do sol: poeira e água.
 * Integração por partícula:  v ← v·e^(−arrasto·dt) + g·dt,  p ← p + v·dt
 * Tamanho em tela:  px = tamanho · escala / distância  (escala = ½·altura / tan(fov/2)).
 */

import * as THREE from 'three';

const VERT = /* glsl */ `
attribute vec4 aColor;
attribute float aSize;
attribute float aSpin;
uniform float uScale;
varying vec4 vColor;
varying float vSpin;
void main() {
    vColor = aColor;
    vSpin = aSpin;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = min(aSize * uScale / max(0.1, -mv.z), 220.0);
}`;

const FRAG_GLOW = /* glsl */ `
varying vec4 vColor;
varying float vSpin;
void main() {
    vec2 p = gl_PointCoord - 0.5;
    float c = cos(vSpin), s = sin(vSpin);
    p = vec2(p.x * c - p.y * s, p.x * s + p.y * c);
    float d = length(p) * 2.0;
    // núcleo + cruz de quatro pontas (brilho de estrela)
    float core = smoothstep(0.55, 0.0, d);
    float rays = max(0.0, 1.0 - abs(p.x) * 26.0) * max(0.0, 1.0 - abs(p.y) * 2.2)
               + max(0.0, 1.0 - abs(p.y) * 26.0) * max(0.0, 1.0 - abs(p.x) * 2.2);
    float a = (core * core + rays * 0.8) * vColor.a;
    if (a < 0.004) discard;
    gl_FragColor = vec4(vColor.rgb * a, a);
}`;

const FRAG_PUFF = /* glsl */ `
varying vec4 vColor;
varying float vSpin;
float h(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
void main() {
    vec2 p = gl_PointCoord - 0.5;
    float d = length(p) * 2.0;
    float puff = n(gl_PointCoord * 4.0 + vSpin * 7.0);
    float a = smoothstep(1.0, 0.2, d + (1.0 - puff) * 0.5) * vColor.a;
    if (a < 0.004) discard;
    // leve volume: mais claro em cima
    gl_FragColor = vec4(vColor.rgb * (0.86 + 0.28 * (0.5 - p.y)), a);
}`;

class Pool {
    constructor(scene, max, fragment, additive) {
        this.max = max;
        this.cursor = 0;
        this.alive = 0;
        this.pos = new Float32Array(max * 3);
        this.col = new Float32Array(max * 4);
        this.size = new Float32Array(max);
        this.spin = new Float32Array(max);
        // estado de CPU: vx, vy, vz, vida, vidaMax, tamanho0, tamanho1, gravidade, arrasto, giro
        this.state = new Float32Array(max * 10);
        this.base = new Float32Array(max * 4);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
        geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
        geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
        geo.setAttribute('aSpin', new THREE.BufferAttribute(this.spin, 1).setUsage(THREE.DynamicDrawUsage));
        geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
        this.uniforms = { uScale: { value: 600 } };
        this.points = new THREE.Points(geo, new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: VERT,
            fragmentShader: fragment,
            transparent: true,
            depthWrite: false,
            blending: additive ? THREE.CustomBlending : THREE.NormalBlending,
            blendEquation: THREE.AddEquation,
            blendSrc: THREE.OneFactor,
            blendDst: THREE.OneFactor
        }));
        this.points.frustumCulled = false;
        this.points.renderOrder = 30;
        this.points.visible = false;
        scene.add(this.points);
    }

    spawn(x, y, z, vx, vy, vz, life, s0, s1, r, g, b, a, gravity, drag) {
        const i = this.cursor;
        this.cursor = (this.cursor + 1) % this.max;
        this.pos[i * 3] = x;
        this.pos[i * 3 + 1] = y;
        this.pos[i * 3 + 2] = z;
        const s = i * 10;
        this.state[s] = vx;
        this.state[s + 1] = vy;
        this.state[s + 2] = vz;
        this.state[s + 3] = life;
        this.state[s + 4] = life;
        this.state[s + 5] = s0;
        this.state[s + 6] = s1;
        this.state[s + 7] = gravity;
        this.state[s + 8] = drag;
        this.state[s + 9] = (Math.random() - 0.5) * 6;
        this.base[i * 4] = r;
        this.base[i * 4 + 1] = g;
        this.base[i * 4 + 2] = b;
        this.base[i * 4 + 3] = a;
        this.spin[i] = Math.random() * 6.28;
    }

    update(dt) {
        let alive = 0;
        const st = this.state;
        for (let i = 0; i < this.max; i++) {
            const s = i * 10;
            if (st[s + 3] <= 0) {
                this.col[i * 4 + 3] = 0;
                continue;
            }
            st[s + 3] -= dt;
            const k = Math.max(0, st[s + 3] / st[s + 4]); // 1 → 0
            const keep = Math.exp(-st[s + 8] * dt);
            st[s] *= keep;
            st[s + 2] *= keep;
            st[s + 1] = st[s + 1] * keep - st[s + 7] * dt;
            this.pos[i * 3] += st[s] * dt;
            this.pos[i * 3 + 1] += st[s + 1] * dt;
            this.pos[i * 3 + 2] += st[s + 2] * dt;
            this.size[i] = st[s + 5] + (st[s + 6] - st[s + 5]) * (1 - k);
            this.spin[i] += st[s + 9] * dt;
            this.col[i * 4] = this.base[i * 4];
            this.col[i * 4 + 1] = this.base[i * 4 + 1];
            this.col[i * 4 + 2] = this.base[i * 4 + 2];
            // entra rápido, sai devagar
            this.col[i * 4 + 3] = this.base[i * 4 + 3] * Math.min(1, (1 - k) * 12) * k * (2 - k);
            alive++;
        }
        this.alive = alive;
        this.points.visible = alive > 0;
        if (alive > 0 || this._wasAlive) {
            const a = this.points.geometry.attributes;
            a.position.needsUpdate = true;
            a.aColor.needsUpdate = true;
            a.aSize.needsUpdate = true;
            a.aSpin.needsUpdate = true;
        }
        this._wasAlive = alive > 0;
    }
}

const rnd = (a, b) => a + Math.random() * (b - a);

export class Effects {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.glow = new Pool(scene, 320, FRAG_GLOW, true);
        this.puff = new Pool(scene, 260, FRAG_PUFF, false);
        this.shake = 0;
        this._offset = new THREE.Vector3();
        // cor da poeira/respingo acompanha a luz (o main passa a cor do sol)
        this.light = new THREE.Color(1, 0.96, 0.9);
    }

    /** Faíscas douradas de coleta. `tint` opcional (moeda vermelha). */
    sparkle(pos, n = 10, tint = null) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2;
            const e = rnd(1.2, 4.2);
            const hot = rnd(2.2, 4.5);
            const r = tint ? tint[0] : 1.0;
            const g = tint ? tint[1] : 0.72;
            const b = tint ? tint[2] : 0.22;
            this.glow.spawn(pos.x, pos.y + 0.1, pos.z, Math.cos(a) * e, rnd(1.5, 5.5), Math.sin(a) * e,
                rnd(0.35, 0.75), rnd(0.5, 0.9), 0.1, r * hot, g * hot, b * hot, 1, 9, 1.6);
        }
        // clarão central
        this.glow.spawn(pos.x, pos.y + 0.1, pos.z, 0, 0.4, 0, 0.28, 1.4, 3.2, tint ? 3 * tint[0] : 3, tint ? 3 * tint[1] : 2.2, tint ? 3 * tint[2] : 0.8, 0.9, 0, 0);
    }

    /** Anel de poeira no chão (pouso, pound). */
    dust(pos, strength = 1) {
        const n = Math.round(12 * strength);
        const L = this.light;
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
            const e = rnd(1.4, 3.4) * strength;
            const k = rnd(0.55, 0.75);
            this.puff.spawn(pos.x + Math.cos(a) * 0.2, pos.y + 0.12, pos.z + Math.sin(a) * 0.2, Math.cos(a) * e, rnd(0.3, 1.3), Math.sin(a) * e,
                rnd(0.45, 0.9), rnd(0.35, 0.6), rnd(1.1, 1.9) * strength, L.r * k, L.g * k * 0.93, L.b * k * 0.8, 0.5, -0.4, 3.2);
        }
        this.shake = Math.max(this.shake, 0.16 * strength);
    }

    /** Baforada pequena atrás do pé ao correr. */
    step(pos, dirX, dirZ) {
        const L = this.light;
        for (let i = 0; i < 2; i++) {
            this.puff.spawn(pos.x - dirX * 0.2 + rnd(-0.1, 0.1), pos.y + 0.08, pos.z - dirZ * 0.2 + rnd(-0.1, 0.1),
                -dirX * rnd(0.3, 1.0) + rnd(-0.3, 0.3), rnd(0.3, 0.9), -dirZ * rnd(0.3, 1.0) + rnd(-0.3, 0.3),
                rnd(0.35, 0.6), 0.22, rnd(0.6, 0.95), L.r * 0.66, L.g * 0.6, L.b * 0.5, 0.36, -0.3, 2.6);
        }
    }

    /** Explosão de estrela / bomba-rei. */
    burst(pos, n = 20) {
        this.sparkle(pos, n);
        for (let i = 0; i < 6; i++) {
            const a = Math.random() * Math.PI * 2;
            this.glow.spawn(pos.x, pos.y + 0.3, pos.z, Math.cos(a) * 1.4, rnd(0.6, 2.2), Math.sin(a) * 1.4,
                rnd(0.8, 1.4), 0.5, 2.6, 2.6, 2.0, 1.0, 0.55, 0.5, 1.2);
        }
        this.shake = Math.max(this.shake, 0.42);
    }

    /** Coroa de respingos + névoa ao entrar na água. */
    splash(pos, y = pos.y) {
        const L = this.light;
        for (let i = 0; i < 18; i++) {
            const a = (i / 18) * Math.PI * 2 + Math.random() * 0.3;
            const e = rnd(1.0, 2.6);
            this.puff.spawn(pos.x + Math.cos(a) * 0.25, y + 0.05, pos.z + Math.sin(a) * 0.25, Math.cos(a) * e, rnd(2.4, 5.2), Math.sin(a) * e,
                rnd(0.5, 0.85), 0.16, 0.3, L.r * 0.95, L.g * 1.0, L.b * 1.05, 0.85, 12, 0.6);
        }
        for (let i = 0; i < 6; i++) {
            const a = Math.random() * Math.PI * 2;
            this.puff.spawn(pos.x, y + 0.1, pos.z, Math.cos(a) * 0.8, rnd(0.4, 1.0), Math.sin(a) * 0.8,
                rnd(0.6, 1.0), 0.6, 1.8, L.r * 0.9, L.g * 0.96, L.b * 1.0, 0.35, 0, 2.2);
        }
    }

    /** Cintilação ambiente em volta de uma estrela à espera. */
    twinkle(pos) {
        const a = Math.random() * Math.PI * 2;
        const r = rnd(0.4, 0.95);
        this.glow.spawn(pos.x + Math.cos(a) * r, pos.y + rnd(-0.5, 0.6), pos.z + Math.sin(a) * r, 0, rnd(0.15, 0.5), 0,
            rnd(0.5, 0.9), 0.1, 0.42, 2.4, 1.9, 0.8, 0.9, 0, 0.5);
    }

    update(dt) {
        // escala px/m para o tamanho dos pontos (acompanha fov e resolução)
        const h = this.camera.userData.bufferHeight || 800;
        const scale = (h * 0.5) / Math.tan(THREE.MathUtils.degToRad(this.camera.fov) * 0.5);
        this.glow.uniforms.uScale.value = scale;
        this.puff.uniforms.uScale.value = scale;
        this.glow.update(dt);
        this.puff.update(dt);
        this.shake = Math.max(0, this.shake - dt * 1.7);
    }

    applyShake() {
        if (this.shake <= 0) return;
        this._offset.set(
            (Math.random() - 0.5) * this.shake,
            (Math.random() - 0.5) * this.shake * 0.6,
            (Math.random() - 0.5) * this.shake
        );
        this.camera.position.add(this._offset);
    }
}
