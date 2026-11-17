/**
 * Fada de faíscas, fogos de artifício, vaga-lumes e névoa sobre o lago.
 *
 * Partículas (fagulhas): integradas em CPU, desenhadas como quads instanciados
 * esticados ao longo da velocidade (rastro):
 *   v ← v + (g·ĝ − k·v)·dt        g = 9,8·peso (m/s²), k = arrasto (1/s)
 *   p ← p + v·dt
 *   brilho = (1 − idade/vida)^1,5 · cintilação
 * Fogos: a casca sobe em balística até o ápice e estoura em N estrelas com
 * velocidade radial s (esfera), s·[0,5; 1] (crisântemo, com rastro), ou lenta e
 * pesada (salgueiro). Cada estouro acende uma luz pontual que decai como
 *   I(t) = I0 · e^(−t/τ),  τ = 0,55 s
 * A fada segue uma hélice própria em torno da torre de menagem (não é um arco
 * simples de lado a lado) e termina acendendo a estrela do topo.
 */

import * as THREE from 'three';
import { createParticles } from '../../shared/gfx/particles.js';

const G = 9.8;

function createSparks(max) {
    const base = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index;
    geo.setAttribute('position', base.attributes.position);
    const pos = new Float32Array(max * 3);
    const vel = new Float32Array(max * 3);
    const col = new Float32Array(max * 4); // rgb + tamanho
    const aPos = new THREE.InstancedBufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
    const aVel = new THREE.InstancedBufferAttribute(vel, 3).setUsage(THREE.DynamicDrawUsage);
    const aCol = new THREE.InstancedBufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aPos', aPos);
    geo.setAttribute('aVel', aVel);
    geo.setAttribute('aCol', aCol);
    geo.instanceCount = 0;
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    const mat = new THREE.ShaderMaterial({
        name: 'fagulhas',
        uniforms: { uStretch: { value: 0.05 } },
        vertexShader: /* glsl */ `
            attribute vec3 aPos, aVel;
            attribute vec4 aCol;
            uniform float uStretch;
            varying vec3 vColor;
            varying vec2 vQ;
            void main() {
                vec4 mv = viewMatrix * vec4(aPos, 1.0);
                vec3 vv = (viewMatrix * vec4(aVel, 0.0)).xyz * uStretch;
                float len = length(vv.xy);
                vec2 dir = len > 1e-4 ? vv.xy / len : vec2(0.0, 1.0);
                vec2 nrm = vec2(dir.y, -dir.x); // mantém o quad de frente (CCW)
                float s = aCol.a;
                // quad: largura s; comprimento s + rastro (para trás da velocidade)
                mv.xy += nrm * position.x * s + dir * (position.y * s - (0.5 - position.y) * len);
                gl_Position = projectionMatrix * mv;
                vColor = aCol.rgb;
                vQ = position.xy * 2.0;
            }
        `,
        fragmentShader: /* glsl */ `
            varying vec3 vColor;
            varying vec2 vQ;
            void main() {
                float d = dot(vQ, vQ);
                float a = exp(-d * 3.5) * (1.0 - smoothstep(0.7, 1.0, d));
                gl_FragColor = vec4(vColor * a, 1.0);
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 10;
    mesh.name = 'fagulhas';
    // estado por partícula: idade, vida, arrasto, peso, tamanho, cintilação, r, g, b, tipo
    const st = new Float32Array(max * 10);
    return { mesh, geo, pos, vel, col, aPos, aVel, aCol, st, n: 0, max };
}

export class Magic {
    /**
     * @param {THREE.Scene} scene
     * @param {{ tier: string, star: THREE.Vector3, donjon: object, onBurst?: Function }} o
     */
    constructor(scene, { tier, star, donjon }) {
        this.scene = scene;
        this.low = tier === 'low';
        this.sp = createSparks(this.low ? 2600 : tier === 'high' ? 9000 : 5500);
        this.density = this.low ? 0.4 : tier === 'high' ? 1 : 0.7;
        this.group = new THREE.Group();
        this.group.name = 'magia';
        this.group.add(this.sp.mesh);
        scene.add(this.group);
        this.star = star;
        this.c = new THREE.Color();
        this.v = new THREE.Vector3();
        this.rnd = Math.random;

        // luzes dos estouros (número fixo: não recompila materiais)
        this.lights = [];
        for (let i = 0; i < (this.low ? 1 : 2); i++) {
            const l = new THREE.PointLight(0xffffff, 0, 420, 1.5);
            l.position.set(0, 90, 0);
            scene.add(l);
            this.lights.push({ light: l, power: 0 });
        }
        this.nextLight = 0;
        /** Clarão mais recente (cor·intensidade e posição) — o lago usa para o brilho na água. */
        this.flash = new THREE.Color(0, 0, 0);
        this.flashPos = new THREE.Vector3(0, 90, 0);

        // halos dos estouros: iluminam bruma e nuvens em volta
        const haloGeo = new THREE.PlaneGeometry(1, 1);
        this.halos = [];
        for (let i = 0; i < 4; i++) {
            const m = new THREE.Mesh(haloGeo, new THREE.ShaderMaterial({
                uniforms: { uColor: { value: new THREE.Color(0, 0, 0) } },
                vertexShader: /* glsl */ `
                    varying vec2 vUv;
                    void main() {
                        vUv = uv * 2.0 - 1.0;
                        vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
                        mv.xy += position.xy * vec2(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz));
                        gl_Position = projectionMatrix * mv;
                    }`,
                fragmentShader: /* glsl */ `
                    uniform vec3 uColor;
                    varying vec2 vUv;
                    void main() {
                        float d = dot(vUv, vUv);
                        gl_FragColor = vec4(uColor * exp(-d * 4.0) * (1.0 - smoothstep(0.6, 1.0, d)), 1.0);
                    }`,
                transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
            }));
            m.frustumCulled = false;
            m.renderOrder = 8;
            m.visible = false;
            this.group.add(m);
            this.halos.push({ mesh: m, power: 0 });
        }
        this.nextHalo = 0;

        // ---- fada: hélice em volta da menagem ----
        const pts = [new THREE.Vector3(6, 0.6, 86), new THREE.Vector3(2, 9, 72), new THREE.Vector3(-8, 22, 52), new THREE.Vector3(-6, 30, 32)];
        const turns = 1.6;
        for (let i = 0; i <= 12; i++) {
            const u = i / 12;
            const a = -1.2 + u * turns * Math.PI * 2;
            const r = 15 - u * 10.5;
            pts.push(new THREE.Vector3(donjon.x + Math.sin(a) * r, 34 + u * (star.y - 31), donjon.z + Math.cos(a) * r));
        }
        pts.push(star.clone());
        this.fairyPath = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
        this.fairyPos = new THREE.Vector3();
        this.fairyOn = false;
        this.fairy = this.halos.pop(); // um dos halos vira o brilho da fada
        this.fairy.mesh.scale.setScalar(4.5);

        // rastro em fita (últimas posições, voltado para a câmera)
        const TR = 80;
        this.trailN = TR;
        this.trailPts = new Float32Array(TR * 3);
        this.trailLen = 0;
        const tg = new THREE.BufferGeometry();
        tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TR * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage));
        tg.setAttribute('aFade', new THREE.BufferAttribute(new Float32Array(TR * 2 * 2), 2).setUsage(THREE.DynamicDrawUsage));
        const ti = [];
        for (let i = 0; i < TR - 1; i++) ti.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 2, i * 2 + 1, i * 2 + 3);
        tg.setIndex(ti);
        tg.setDrawRange(0, 0);
        this.trail = new THREE.Mesh(tg, new THREE.ShaderMaterial({
            vertexShader: /* glsl */ `
                attribute vec2 aFade;
                varying vec2 vFade;
                void main() { vFade = aFade; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }`,
            fragmentShader: /* glsl */ `
                varying vec2 vFade;
                void main() {
                    float edge = 1.0 - abs(vFade.y);
                    gl_FragColor = vec4(vec3(1.0, 0.8, 0.42) * vFade.x * vFade.x * edge * edge * 1.6, 1.0);
                }`,
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
        }));
        this.trail.frustumCulled = false;
        this.trail.renderOrder = 9;
        this.group.add(this.trail);

        // ---- vaga-lumes (sem estado: posição = base + órbita lenta) ----
        const nf = this.low ? 60 : 170;
        const fp = new Float32Array(nf * 3);
        const fs = new Float32Array(nf);
        this.fireflyCount = nf;
        this.fireflyPos = fp;
        const fg = new THREE.BufferGeometry();
        fg.setAttribute('position', new THREE.BufferAttribute(fp, 3));
        fg.setAttribute('aSeed', new THREE.BufferAttribute(fs, 1));
        for (let i = 0; i < nf; i++) fs[i] = Math.random();
        fg.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
        this.fireflyTime = { value: 0 };
        this.fireflies = new THREE.Points(fg, new THREE.ShaderMaterial({
            uniforms: { uTime: this.fireflyTime, uScale: { value: 600 } },
            vertexShader: /* glsl */ `
                attribute float aSeed;
                uniform float uTime, uScale;
                varying float vB;
                void main() {
                    float s = aSeed * 40.0;
                    vec3 p = position + vec3(sin(uTime * 0.31 + s) * 1.6, sin(uTime * 0.47 + s * 1.7) * 0.7, cos(uTime * 0.27 + s * 2.3) * 1.6);
                    vec4 mv = viewMatrix * vec4(p, 1.0);
                    vB = pow(0.5 + 0.5 * sin(uTime * (0.9 + aSeed) + s), 6.0);
                    gl_PointSize = clamp(0.22 * uScale / max(1.0, -mv.z), 1.5, 22.0);
                    gl_Position = projectionMatrix * mv;
                }`,
            fragmentShader: /* glsl */ `
                varying float vB;
                void main() {
                    vec2 q = gl_PointCoord * 2.0 - 1.0;
                    float d = dot(q, q);
                    if (d > 1.0) discard;
                    gl_FragColor = vec4(vec3(0.75, 1.0, 0.35) * exp(-d * 5.0) * vB * 1.6, 1.0);
                }`,
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
        }));
        this.fireflies.frustumCulled = false;
        this.group.add(this.fireflies);

        // ---- névoa baixa sobre a água ----
        this.mist = [];
        if (!this.low) {
            for (const [x, z, n] of [[-10, 150, 46], [30, 95, 36], [-45, 100, 30]]) {
                const m = createParticles({
                    count: n, life: 46, origin: new THREE.Vector3(x, 1.2, z), spread: new THREE.Vector3(58, 0.5, 46),
                    velocity: new THREE.Vector3(0.35, 0.02, 0.1), velocitySpread: new THREE.Vector3(0.25, 0.02, 0.2),
                    turbulence: 3, size: [22, 40], color: 0x5f7090, opacity: 0.03
                });
                m.mesh.renderOrder = 3;
                this.group.add(m.mesh);
                this.mist.push(m);
            }
        }
        this.cues = [];
        this.cueIndex = 0;
        this.shells = [];
        this.onBurst = null;
        this.fairyDust = 0;
    }

    /** Espalha os vaga-lumes na margem e no pé do penhasco. */
    placeFireflies(terrain) {
        const p = this.fireflyPos;
        let i = 0;
        let guard = 0;
        while (i < this.fireflyCount && guard++ < 20000) {
            const a = Math.random() * Math.PI * 2;
            const r = 40 + Math.random() * 110;
            const x = 6 + Math.sin(a) * r;
            const z = 110 + Math.cos(a) * r * 1.05;
            const h = terrain.heightAt(x, z);
            if (h < 0.4 || h > 9) continue;
            p[i * 3] = x;
            p[i * 3 + 1] = h + 0.6 + Math.random() * 2.2;
            p[i * 3 + 2] = z;
            i++;
        }
        this.fireflies.geometry.attributes.position.needsUpdate = true;
    }

    /** Objetos que não entram no reflexo do lago. */
    get reflectionHidden() {
        return [this.fireflies, ...this.mist.map((m) => m.mesh)];
    }

    spawn(x, y, z, vx, vy, vz, life, drag, weight, size, r, g, b, twinkle = 0, kind = 0) {
        const s = this.sp;
        if (s.n >= s.max) return;
        const i = s.n++;
        s.pos[i * 3] = x;
        s.pos[i * 3 + 1] = y;
        s.pos[i * 3 + 2] = z;
        s.vel[i * 3] = vx;
        s.vel[i * 3 + 1] = vy;
        s.vel[i * 3 + 2] = vz;
        const o = i * 10;
        s.st[o] = 0;
        s.st[o + 1] = life;
        s.st[o + 2] = drag;
        s.st[o + 3] = weight;
        s.st[o + 4] = size;
        s.st[o + 5] = twinkle;
        s.st[o + 6] = r;
        s.st[o + 7] = g;
        s.st[o + 8] = b;
        s.st[o + 9] = kind;
    }

    /**
     * Estouro. type: 'peony' (esfera), 'chrys' (crisântemo com rastro),
     * 'willow' (salgueiro dourado), 'ring' (anel + miolo), 'star' (ignição da estrela).
     */
    burst(x, y, z, color, type = 'peony', scale = 1) {
        const c = this.c.set(color);
        const N = Math.round({ peony: 300, chrys: 260, willow: 230, ring: 220, star: 320 }[type] * this.density);
        for (let i = 0; i < N; i++) {
            const u = this.rnd() * 2 - 1;
            const a = this.rnd() * Math.PI * 2;
            const q = Math.sqrt(1 - u * u);
            let dx = q * Math.cos(a);
            let dy = u;
            let dz = q * Math.sin(a);
            let sp = 46 * scale;
            let life = 2.0;
            let drag = 1.5;
            let w = 0.5;
            let size = 2.3;
            let tw = 0.25;
            let kind = 0;
            let cr = c.r;
            let cg = c.g;
            let cb = c.b;
            if (type === 'peony') {
                sp *= 0.92 + this.rnd() * 0.16;
                life = 1.7 + this.rnd() * 0.6;
            } else if (type === 'chrys') {
                sp *= 0.5 + this.rnd() * 0.6;
                life = 2.4 + this.rnd() * 0.8;
                drag = 1.2;
                kind = 1;
                size = 1.9;
            } else if (type === 'willow') {
                sp *= 0.5 + this.rnd() * 0.35;
                life = 4.2 + this.rnd() * 1.4;
                drag = 0.85;
                w = 0.42;
                kind = 1;
                size = 1.8;
                tw = 0.5;
            } else if (type === 'ring') {
                if (i % 3) {
                    // anel inclinado
                    const ca = Math.cos(a);
                    const sa = Math.sin(a);
                    dx = ca;
                    dy = sa * 0.42;
                    dz = sa * 0.9;
                    sp *= 1.05;
                } else {
                    sp *= 0.38 + this.rnd() * 0.1;
                    cr = 1;
                    cg = 0.92;
                    cb = 0.75;
                }
                life = 1.9 + this.rnd() * 0.4;
            } else {
                sp *= 0.25 + this.rnd() * 0.5;
                life = 1.6 + this.rnd() * 1.6;
                drag = 1.8;
                w = 0.2;
                tw = 0.7;
                size = 1.3;
            }
            this.spawn(x, y, z, dx * sp, dy * sp, dz * sp, life, drag, w, size * scale, cr * 2.6, cg * 2.6, cb * 2.6, tw, kind);
        }
        const power = type === 'star' ? 1.3 : 1;
        const L = this.lights[this.nextLight++ % this.lights.length];
        L.light.color.copy(c).lerp(this.c.set(0xffffff), 0.25);
        L.light.position.set(x, y, z);
        L.power = 2400 * power * scale;
        const H = this.halos[this.nextHalo++ % this.halos.length];
        H.mesh.position.set(x, y, z);
        H.mesh.scale.setScalar(95 * scale);
        H.mesh.material.uniforms.uColor.value.set(color).multiplyScalar(0.1 * power);
        H.power = 0.22 * power;
        H.mesh.visible = true;
        this.flash.set(color).multiplyScalar(3 * power);
        this.flashPos.set(x, y, z);
        this.onBurst?.(type, Math.hypot(x, y - 40, z));
    }

    /** Lança uma casca de (x, z) no chão para estourar em (x, y, z) após `rise` s. */
    launch(x, y, z, color, type, scale = 1, rise = 1.5) {
        // balística: v0 = (y − y0)/T + ½·g·w·T  (chega ao ápice com velocidade quase nula)
        const y0 = 6;
        const w = 0.6;
        this.shells.push({ x: x * 0.92, y: y0, z: z * 0.92 - 6, vy: (y - y0) / rise + 0.5 * G * w * rise, vx: (x * 0.08) / rise, vz: (z * 0.08 + 6) / rise, t: 0, rise, tx: x, ty: y, tz: z, color, type, scale, w });
    }

    /** Programa da abertura: [tempo, x, y, z, cor, tipo, escala]. */
    setCues(cues) {
        this.cues = cues;
        this.cueIndex = 0;
    }

    reset() {
        this.sp.n = 0;
        this.shells.length = 0;
        this.cueIndex = 0;
        this.trailLen = 0;
        this.trail.geometry.setDrawRange(0, 0);
        this.fairyOn = false;
        this.fairy.mesh.visible = false;
        for (const l of this.lights) l.power = 0;
        for (const h of this.halos) {
            h.power = 0;
            h.mesh.visible = false;
        }
        this.flash.setScalar(0);
    }

    /**
     * Avança a abertura até o tempo t (s). fairy: [t0, t1] = intervalo do voo da fada.
     * Devolve a posição da fada (ou null).
     */
    intro(t, dt, fairy) {
        while (this.cueIndex < this.cues.length && this.cues[this.cueIndex][0] <= t) {
            const [, x, y, z, color, type, scale] = this.cues[this.cueIndex++];
            this.launch(x, y, z, color, type, scale);
        }
        const [f0, f1] = fairy;
        if (t >= f0 && t < f1) {
            const u = (t - f0) / (f1 - f0);
            // acelera no fim: u' = u·(0,7 + 0,3·u)
            this.fairyPath.getPointAt(Math.min(0.9999, u * (0.7 + 0.3 * u)), this.fairyPos);
            if (!this.fairyOn) this.trailLen = 0;
            this.fairyOn = true;
            // poeira cintilante que cai devagar
            this.fairyDust += dt * 95 * this.density;
            while (this.fairyDust >= 1) {
                this.fairyDust -= 1;
                const p = this.fairyPos;
                this.spawn(p.x + (this.rnd() - 0.5) * 0.5, p.y + (this.rnd() - 0.5) * 0.5, p.z + (this.rnd() - 0.5) * 0.5,
                    (this.rnd() - 0.5) * 1.6, (this.rnd() - 0.3) * 1.2, (this.rnd() - 0.5) * 1.6,
                    1.6 + this.rnd() * 2.4, 1.4, 0.07, 0.3 + this.rnd() * 0.3, 2.4, 1.7, 0.75, 0.9, 0);
            }
            return this.fairyPos;
        }
        if (this.fairyOn && t >= f1) {
            this.fairyOn = false;
            this.burst(this.star.x, this.star.y, this.star.z, 0xffe2a0, 'star', 0.55);
        }
        if (t < f0) this.fairyOn = false;
        return null;
    }

    /** Integra partículas, cascas, luzes, rastro. */
    update(dt, t, camera) {
        const s = this.sp;
        const { pos, vel, col, st } = s;
        // cascas subindo
        for (let i = this.shells.length - 1; i >= 0; i--) {
            const sh = this.shells[i];
            sh.t += dt;
            sh.vy -= G * sh.w * dt;
            sh.x += sh.vx * dt;
            sh.y += sh.vy * dt;
            sh.z += sh.vz * dt;
            this.spawn(sh.x, sh.y, sh.z, (this.rnd() - 0.5) * 1.5, -3, (this.rnd() - 0.5) * 1.5, 0.5 + this.rnd() * 0.4, 2, 0.3, 0.9, 2.0, 1.3, 0.6, 0.6, 0);
            if (sh.t >= sh.rise) {
                this.burst(sh.x, sh.y, sh.z, sh.color, sh.type, sh.scale);
                this.shells.splice(i, 1);
            }
        }
        // fagulhas (compactação por troca com a última)
        let i = 0;
        while (i < s.n) {
            const o = i * 10;
            const age = (st[o] += dt);
            if (age >= st[o + 1]) {
                const last = --s.n;
                if (last !== i) {
                    pos.copyWithin(i * 3, last * 3, last * 3 + 3);
                    vel.copyWithin(i * 3, last * 3, last * 3 + 3);
                    st.copyWithin(o, last * 10, last * 10 + 10);
                }
                continue;
            }
            const k = Math.max(0, 1 - st[o + 2] * dt);
            const vx = (vel[i * 3] *= k);
            const vy = (vel[i * 3 + 1] = vel[i * 3 + 1] * k - G * st[o + 3] * dt);
            const vz = (vel[i * 3 + 2] *= k);
            pos[i * 3] += vx * dt;
            pos[i * 3 + 1] += vy * dt;
            pos[i * 3 + 2] += vz * dt;
            const life = 1 - age / st[o + 1];
            let f = Math.pow(life, 1.5);
            const tw = st[o + 5];
            if (tw > 0) f *= 1 - tw + tw * (0.5 + 0.5 * Math.sin(age * 31 + i * 1.7));
            col[i * 4] = st[o + 6] * f;
            col[i * 4 + 1] = st[o + 7] * f;
            col[i * 4 + 2] = st[o + 8] * f;
            col[i * 4 + 3] = st[o + 4] * (0.5 + 0.5 * life);
            // estrelas com rastro soltam fagulhas pequenas
            if (st[o + 9] === 1 && s.n < s.max - 8 && this.rnd() < dt * 22) {
                this.spawn(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2], vx * 0.1, vy * 0.1, vz * 0.1, 0.5 + this.rnd() * 0.7, 2, 0.25, st[o + 4] * 0.55,
                    st[o + 6] * 0.6, st[o + 7] * 0.5, st[o + 8] * 0.4, 0.6, 0);
            }
            i++;
        }
        s.geo.instanceCount = s.n;
        s.aPos.needsUpdate = s.aVel.needsUpdate = s.aCol.needsUpdate = true;

        // luzes e halos decaem
        const decay = Math.exp(-dt / 0.55);
        for (const l of this.lights) {
            l.power *= decay;
            l.light.intensity = l.power > 20 ? l.power : 0;
        }
        for (const h of this.halos) {
            h.power *= Math.exp(-dt / 0.8);
            h.mesh.material.uniforms.uColor.value.multiplyScalar(Math.exp(-dt / 0.8));
            if (h.power < 0.004) h.mesh.visible = false;
        }
        this.flash.multiplyScalar(decay);

        // fada + rastro
        this.fairy.mesh.visible = this.fairyOn;
        if (this.fairyOn) {
            this.fairy.mesh.position.copy(this.fairyPos);
            const pulse = 0.5 + 0.12 * Math.sin(t * 17);
            this.fairy.mesh.material.uniforms.uColor.value.setRGB(1.0 * pulse, 0.82 * pulse, 0.45 * pulse);
            const n = this.trailN;
            this.trailPts.copyWithin(3, 0, (n - 1) * 3);
            this.trailPts[0] = this.fairyPos.x;
            this.trailPts[1] = this.fairyPos.y;
            this.trailPts[2] = this.fairyPos.z;
            this.trailLen = Math.min(n, this.trailLen + 1);
        } else if (this.trailLen > 0) {
            this.trailLen = Math.max(0, this.trailLen - 2);
        }
        this._ribbon(camera);
        this.fireflyTime.value = t;
        this.fireflies.material.uniforms.uScale.value = 700;
        for (const m of this.mist) m.update(t);
    }

    /** Fita voltada para a câmera: lado = normalize((p_i − p_{i+1}) × (cam − p_i)) · largura. */
    _ribbon(camera) {
        const g = this.trail.geometry;
        const n = this.trailLen;
        if (n < 2) {
            g.setDrawRange(0, 0);
            return;
        }
        const P = g.attributes.position.array;
        const F = g.attributes.aFade.array;
        const tp = this.trailPts;
        const cam = camera.position;
        const side = this.v;
        for (let i = 0; i < n; i++) {
            const j = Math.min(i, n - 2);
            const dx = tp[j * 3] - tp[j * 3 + 3];
            const dy = tp[j * 3 + 1] - tp[j * 3 + 4];
            const dz = tp[j * 3 + 2] - tp[j * 3 + 5];
            const cx = cam.x - tp[i * 3];
            const cy = cam.y - tp[i * 3 + 1];
            const cz = cam.z - tp[i * 3 + 2];
            side.set(dy * cz - dz * cy, dz * cx - dx * cz, dx * cy - dy * cx);
            const len = side.length() || 1;
            const fade = 1 - i / (n - 1);
            const w = (0.1 + 0.3 * fade) / len;
            for (let k = 0; k < 2; k++) {
                const sg = k ? 1 : -1;
                const o = (i * 2 + k) * 3;
                P[o] = tp[i * 3] + side.x * w * sg;
                P[o + 1] = tp[i * 3 + 1] + side.y * w * sg;
                P[o + 2] = tp[i * 3 + 2] + side.z * w * sg;
                F[(i * 2 + k) * 2] = fade;
                F[(i * 2 + k) * 2 + 1] = sg;
            }
        }
        g.attributes.position.needsUpdate = true;
        g.attributes.aFade.needsUpdate = true;
        g.setDrawRange(0, (n - 1) * 6);
    }
}
