/**
 * Poeira dos cascos, fumaça de pólvora, clarão do disparo e rastro da bala.
 *
 * Duas nuvens de pontos com pool fixo (zero alocação por partícula):
 *   - `puff` alfa normal, tingida pela luz do sol: poeira e fumaça;
 *   - `glow` aditiva em HDR (cores > 1 acendem o bloom): clarão e fagulhas.
 * Integração:  v ← v·e^(−arrasto·dt) + g·dt,  p ← p + v·dt
 * Tamanho em tela:  px = tamanho · escala / distância  (escala = ½·altura / tan(fov/2)).
 * Rastro da bala: fita de 2 triângulos voltada para a câmera, que encolhe em 90 ms.
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
    gl_PointSize = min(aSize * uScale / max(0.1, -mv.z), 420.0);
}`;
const FRAG_GLOW = /* glsl */ `
varying vec4 vColor;
void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = pow(max(0.0, 1.0 - d), 2.0) * vColor.a;
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
    float c = cos(vSpin), s = sin(vSpin);
    vec2 r = vec2(p.x * c - p.y * s, p.x * s + p.y * c);
    float d = length(p) * 2.0;
    float puff = n(r * 4.0 + vSpin * 7.0) * 0.6 + n(r * 9.0 + 3.0) * 0.4;
    float a = smoothstep(1.0, 0.15, d + (1.0 - puff) * 0.6) * vColor.a;
    if (a < 0.004) discard;
    gl_FragColor = vec4(vColor.rgb * (0.84 + 0.3 * (0.5 - p.y) + 0.1 * puff), a);
}`;

class Pool {
    constructor(scene, max, fragment, additive) {
        this.max = max; this.cursor = 0; this.alive = 0;
        this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 4);
        this.size = new Float32Array(max); this.spin = new Float32Array(max);
        // estado: vx, vy, vz, vida, vidaMax, tam0, tam1, gravidade, arrasto, giro
        this.state = new Float32Array(max * 10); this.base = new Float32Array(max * 4);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
        geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
        geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
        geo.setAttribute('aSpin', new THREE.BufferAttribute(this.spin, 1).setUsage(THREE.DynamicDrawUsage));
        geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
        this.uniforms = { uScale: { value: 600 } };
        this.points = new THREE.Points(geo, new THREE.ShaderMaterial({
            uniforms: this.uniforms, vertexShader: VERT, fragmentShader: fragment, transparent: true, depthWrite: false,
            blending: additive ? THREE.CustomBlending : THREE.NormalBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor
        }));
        this.points.frustumCulled = false; this.points.renderOrder = 30; this.points.visible = false;
        scene.add(this.points);
    }
    spawn(x, y, z, vx, vy, vz, life, s0, s1, r, g, b, a, gravity = 0, drag = 1) {
        const i = this.cursor; this.cursor = (this.cursor + 1) % this.max;
        this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
        const s = i * 10;
        this.state[s] = vx; this.state[s + 1] = vy; this.state[s + 2] = vz; this.state[s + 3] = life; this.state[s + 4] = life;
        this.state[s + 5] = s0; this.state[s + 6] = s1; this.state[s + 7] = gravity; this.state[s + 8] = drag; this.state[s + 9] = (Math.random() - 0.5) * 1.6;
        this.base[i * 4] = r; this.base[i * 4 + 1] = g; this.base[i * 4 + 2] = b; this.base[i * 4 + 3] = a;
        this.spin[i] = Math.random() * 6.28;
    }
    update(dt, tint) {
        let alive = 0;
        for (let i = 0; i < this.max; i++) {
            const s = i * 10;
            if (this.state[s + 3] <= 0) { this.size[i] = 0; continue; }
            this.state[s + 3] -= dt;
            const k = Math.max(0, this.state[s + 3] / this.state[s + 4]), age = 1 - k, damp = Math.exp(-this.state[s + 8] * dt);
            this.state[s] *= damp; this.state[s + 2] *= damp; this.state[s + 1] = this.state[s + 1] * damp + this.state[s + 7] * dt;
            this.pos[i * 3] += this.state[s] * dt; this.pos[i * 3 + 1] += this.state[s + 1] * dt; this.pos[i * 3 + 2] += this.state[s + 2] * dt;
            this.size[i] = this.state[s + 5] + (this.state[s + 6] - this.state[s + 5]) * Math.pow(age, 0.6);
            this.spin[i] += this.state[s + 9] * dt;
            const fade = Math.min(1, age * 9) * k * k;
            this.col[i * 4] = this.base[i * 4] * (tint ? tint.r : 1); this.col[i * 4 + 1] = this.base[i * 4 + 1] * (tint ? tint.g : 1);
            this.col[i * 4 + 2] = this.base[i * 4 + 2] * (tint ? tint.b : 1); this.col[i * 4 + 3] = this.base[i * 4 + 3] * fade;
            alive++;
        }
        this.points.visible = alive > 0;
        if (alive || this.alive) for (const a of Object.values(this.points.geometry.attributes)) a.needsUpdate = true;
        this.alive = alive;
    }
}

export class Effects {
    constructor(scene, camera, low = false) {
        this.camera = camera;
        this.puff = new Pool(scene, low ? 160 : 420, FRAG_PUFF, false);
        this.glow = new Pool(scene, low ? 60 : 160, FRAG_GLOW, true);
        this.light = new THREE.Color(1, 1, 1);
        // clarão do disparo: uma luz pontual sempre presente (intensidade 0 em repouso)
        this.flash = new THREE.PointLight(0xffb060, 0, 14, 2);
        scene.add(this.flash);
        this.tracers = [];
        const geo = new THREE.PlaneGeometry(1, 1);
        geo.translate(0.5, 0, 0);
        for (let i = 0; i < 6; i++) {
            const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
            m.visible = false; m.frustumCulled = false; m.renderOrder = 31;
            scene.add(m);
            this.tracers.push({ mesh: m, life: 0 });
        }
        this._a = new THREE.Vector3(); this._b = new THREE.Vector3(); this._c = new THREE.Vector3();
    }
    /** Poeira levantada por um casco/impacto no ponto (x, y, z); dir = para onde o cavalo vai. */
    dust(x, y, z, amount = 1, vx = 0, vz = 0) {
        const n = Math.ceil(amount);
        for (let i = 0; i < n; i++) {
            const a = Math.random() * 6.28, sp = 0.3 + Math.random() * 0.9;
            this.puff.spawn(x + Math.cos(a) * 0.2, y + 0.05, z + Math.sin(a) * 0.2, Math.cos(a) * sp - vx * 0.12, 0.35 + Math.random() * 0.7, Math.sin(a) * sp - vz * 0.12,
                1.1 + Math.random() * 1.4, 0.35, 1.5 + Math.random() * 1.5, 0.74, 0.6, 0.44, 0.16 + Math.random() * 0.12, -0.12, 1.4);
        }
    }
    /** Disparo: clarão HDR, fagulhas e fumaça de pólvora negra na boca do cano. */
    muzzle(p, dir) {
        this.glow.spawn(p.x, p.y, p.z, dir.x * 2, dir.y * 2, dir.z * 2, 0.1, 1.3, 0.4, 12, 6.5, 2.2, 1, 0, 0);
        for (let i = 0; i < 7; i++) this.glow.spawn(p.x, p.y, p.z, dir.x * (9 + Math.random() * 14) + (Math.random() - 0.5) * 5, dir.y * 12 + (Math.random() - 0.5) * 5, dir.z * (9 + Math.random() * 14) + (Math.random() - 0.5) * 5, 0.12 + Math.random() * 0.14, 0.09, 0.02, 7, 3.5, 1, 1, -6, 3);
        for (let i = 0; i < 9; i++) {
            const k = 0.6 + Math.random() * 3.2;
            this.puff.spawn(p.x + dir.x * 0.15, p.y + dir.y * 0.15, p.z + dir.z * 0.15, dir.x * k + (Math.random() - 0.5) * 0.7, dir.y * k + 0.25 + Math.random() * 0.4, dir.z * k + (Math.random() - 0.5) * 0.7,
                1.3 + Math.random() * 1.5, 0.18, 1.0 + Math.random() * 1.1, 0.86, 0.86, 0.88, 0.2, 0.1, 2.2);
        }
        this.flash.position.copy(p); this.flash.intensity = 60;
    }
    tracer(a, b, r = 1, g = 0.82, bl = 0.5) {
        const t = this.tracers.find((x) => x.life <= 0) || this.tracers[0];
        t.life = 0.09; t.a = a.clone(); t.b = b.clone();
        t.mesh.material.color.setRGB(r * 3.5, g * 3.5, bl * 3.5);
        t.mesh.visible = true;
    }
    /** Impacto no chão/alvo. */
    impact(p, blood = false) {
        for (let i = 0; i < 6; i++) this.puff.spawn(p.x, p.y, p.z, (Math.random() - 0.5) * 2.4, 0.8 + Math.random() * 1.6, (Math.random() - 0.5) * 2.4, 0.6 + Math.random() * 0.6, 0.12, 0.7,
            blood ? 0.4 : 0.76, blood ? 0.08 : 0.62, blood ? 0.06 : 0.46, 0.3, -3.5, 1.8);
    }
    update(dt) {
        const h = this.camera.userData.bufferHeight || innerHeight;
        const scale = 0.5 * h / Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5));
        this.puff.uniforms.uScale.value = scale; this.glow.uniforms.uScale.value = scale;
        this.puff.update(dt, this.light); this.glow.update(dt, null);
        this.flash.intensity = Math.max(0, this.flash.intensity - dt * 900);
        for (const t of this.tracers) {
            if (t.life <= 0) { t.mesh.visible = false; continue; }
            t.life -= dt;
            const k = clamp01(t.life / 0.09);
            // fita: eixo X ao longo do tiro, eixo Y perpendicular à câmera
            this._a.subVectors(t.b, t.a);
            const len = this._a.length();
            this._a.normalize();
            this._b.subVectors(this.camera.position, t.a).cross(this._a).normalize();
            this._c.crossVectors(this._a, this._b);
            t.mesh.matrixAutoUpdate = false;
            const start = this._c.copy(t.a).addScaledVector(this._a, len * (1 - k) * 0.7);
            const m = t.mesh.matrix;
            const ax = this._a, ay = this._b, w = 0.035, l = len * (0.3 + 0.7 * k) * 0.3;
            m.set(ax.x * l, ay.x * w, 0, start.x, ax.y * l, ay.y * w, 0, start.y, ax.z * l, ay.z * w, 1, start.z, 0, 0, 0, 1);
            t.mesh.matrixWorldNeedsUpdate = true;
            t.mesh.material.opacity = k;
        }
    }
}
const clamp01 = (v) => Math.max(0, Math.min(1, v));
