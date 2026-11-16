/**
 * gfx/particles — partículas "sem estado" na GPU (fumaça, vapor, spray, chafariz).
 *
 * Cada partícula é um quad instanciado cuja posição é função pura do tempo:
 *   idade a = fract(t / vida + semente)
 *   p(a)  = origem + v0·τ + ½·acel·τ² + turbulência(τ),   τ = a · vida
 * Sem buffers atualizados em CPU: custo de CPU ≈ zero, 1 draw call por emissor.
 * A cor é dada pelo lab a cada frame (luz do sol + céu), então a fumaça escurece à noite.
 */
import * as THREE from 'three';

export function createParticles({
    count = 80,
    life = 6,
    origin = new THREE.Vector3(),
    spread = new THREE.Vector3(0.3, 0.1, 0.3),
    velocity = new THREE.Vector3(0, 2, 0),
    velocitySpread = new THREE.Vector3(0.4, 0.4, 0.4),
    accel = new THREE.Vector3(0, 0, 0),
    turbulence = 0.6,
    size = [0.6, 4],
    color = 0xffffff,
    opacity = 0.5,
    additive = false,
    stretch = 0
} = {}) {
    const base = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index;
    geo.setAttribute('position', base.attributes.position);
    geo.setAttribute('uv', base.attributes.uv);
    const seeds = new Float32Array(count * 4);
    for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4));
    geo.instanceCount = count;
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);

    const uniforms = {
        uTime: { value: 0 },
        uLife: { value: life },
        uOrigin: { value: origin.clone() },
        uSpread: { value: spread.clone() },
        uVel: { value: velocity.clone() },
        uVelSpread: { value: velocitySpread.clone() },
        uAccel: { value: accel.clone() },
        uTurb: { value: turbulence },
        uSize: { value: new THREE.Vector2(size[0], size[1]) },
        uColor: { value: new THREE.Color(color) },
        uOpacity: { value: opacity },
        uStretch: { value: stretch },
        uRate: { value: 1 }
    };

    const mat = new THREE.ShaderMaterial({
        uniforms,
        transparent: true,
        depthWrite: false,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        vertexShader: /* glsl */ `
            attribute vec4 aSeed;
            uniform float uTime, uLife, uTurb, uStretch;
            uniform vec3 uOrigin, uSpread, uVel, uVelSpread, uAccel;
            uniform vec2 uSize;
            varying vec2 vUv;
            varying float vAge;
            varying float vSeed;
            void main() {
                float age = fract(uTime / uLife + aSeed.x);
                float tau = age * uLife;
                vec3 r = vec3(aSeed.y, aSeed.z, aSeed.w) - 0.5;
                vec3 v0 = uVel + r.zxy * 2.0 * uVelSpread;
                vec3 p = uOrigin + r * 2.0 * uSpread + v0 * tau + 0.5 * uAccel * tau * tau;
                p.x += sin(tau * 0.9 + aSeed.y * 40.0) * uTurb * age;
                p.z += cos(tau * 0.7 + aSeed.z * 40.0) * uTurb * age;
                p.y += sin(tau * 1.3 + aSeed.w * 40.0) * uTurb * age * 0.4;
                float s = mix(uSize.x, uSize.y, pow(age, 0.7)) * (0.7 + aSeed.w * 0.6);
                vec4 mv = viewMatrix * vec4(p, 1.0);
                float a = aSeed.y * 6.2831 + age * (aSeed.z - 0.5) * 2.0;
                vec2 q = position.xy;
                q = vec2(q.x * cos(a) - q.y * sin(a), q.x * sin(a) + q.y * cos(a));
                q.y *= 1.0 + uStretch;
                mv.xy += q * s;
                gl_Position = projectionMatrix * mv;
                vUv = uv;
                vAge = age;
                vSeed = aSeed.x;
            }
        `,
        fragmentShader: /* glsl */ `
            uniform vec3 uColor;
            uniform float uOpacity;
            varying vec2 vUv;
            varying float vAge;
            varying float vSeed;
            float h(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
            float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
                return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
            void main() {
                vec2 c = vUv - 0.5;
                float d = length(c) * 2.0;
                float puff = n(vUv * 4.0 + vSeed * 31.0) * 0.6 + n(vUv * 9.0 + vSeed * 17.0) * 0.4;
                float a = smoothstep(1.0, 0.25, d + (1.0 - puff) * 0.55);
                a *= smoothstep(0.0, 0.08, vAge) * pow(1.0 - vAge, 1.4) * uOpacity;
                if (a < 0.003) discard;
                // leve volume: topo mais claro
                vec3 col = uColor * (0.82 + 0.3 * (vUv.y - 0.3) + 0.12 * puff);
                gl_FragColor = vec4(col, a);
            }
        `
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 20;
    return {
        mesh,
        uniforms,
        update(t) { uniforms.uTime.value = t; },
        dispose() { geo.dispose(); mat.dispose(); }
    };
}
