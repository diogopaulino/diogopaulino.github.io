/* Claude Bros — partículas de jogo (poeira, brilhos, folhas, respingos).
 *
 * Um único draw call: quads instanciados virados para a câmera, simulados em CPU
 * num pool fixo (sem alocação por quadro). Cada partícula tem um `tipo`:
 *   0 poeira/fumaça macia   1 brilho ✦ (aditivo)   2 folha   3 gota/lasca
 * A mistura é pré-multiplicada (src = ONE, dst = 1 − α): o shader devolve
 * (cor·α, α·(1 − aditivo)), então brilhos aditivos e poeira opaca convivem na
 * mesma malha.
 *
 * Integração (Euler semi-implícito):  v += (g·gravidade − v·arrasto)·dt ;  p += v·dt
 * Folhas somam uma oscilação lateral  x += sin(idade·3 + semente)·0,6·dt.
 */
import * as THREE from 'three';

const STRIDE = 16; // x y z vx vy vz life max size grow r g b kind grav drag

export function createFx(scene, max = 360) {
    const data = new Float32Array(max * STRIDE);
    const seedArr = new Float32Array(max);
    let cursor = 0;

    const quad = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = quad.index;
    geo.setAttribute('position', quad.attributes.position);
    geo.setAttribute('uv', quad.attributes.uv);
    const aPos = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    const aData = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    const aColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aPos', aPos);
    geo.setAttribute('aData', aData);
    geo.setAttribute('aColor', aColor);
    geo.instanceCount = 0;
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);

    const uniforms = { uLight: { value: new THREE.Color(1, 1, 1) } };
    const mat = new THREE.ShaderMaterial({
        uniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
        blendSrcAlpha: THREE.OneFactor,
        blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
        vertexShader: /* glsl */ `
            attribute vec3 aPos;
            attribute vec4 aData; // tamanho, rotação, alfa, tipo
            attribute vec3 aColor;
            varying vec2 vUv;
            varying vec3 vColor;
            varying float vAlpha;
            varying float vKind;
            void main() {
                vec4 mv = viewMatrix * vec4(aPos, 1.0);
                float c = cos(aData.y), s = sin(aData.y);
                vec2 q = position.xy;
                // folha: achata conforme "vira" no ar
                if (aData.w > 1.5 && aData.w < 2.5) q.y *= 0.35 + 0.65 * abs(sin(aData.y * 1.7));
                mv.xy += vec2(q.x * c - q.y * s, q.x * s + q.y * c) * aData.x;
                gl_Position = projectionMatrix * mv;
                vUv = uv;
                vColor = aColor;
                vAlpha = aData.z;
                vKind = aData.w;
            }`,
        fragmentShader: /* glsl */ `
            uniform vec3 uLight;
            varying vec2 vUv;
            varying vec3 vColor;
            varying float vAlpha;
            varying float vKind;
            void main() {
                vec2 c = vUv - 0.5;
                float r = length(c) * 2.0;
                float a;
                float additive = 0.0;
                vec3 col = vColor * uLight;
                if (vKind < 0.5) {
                    a = smoothstep(1.0, 0.1, r);
                    a *= a;
                } else if (vKind < 1.5) {
                    float star = 1.0 - (sqrt(abs(c.x)) + sqrt(abs(c.y))) * 1.42;
                    a = smoothstep(0.0, 0.5, star) + smoothstep(0.5, 0.0, r) * 0.6;
                    additive = 1.0;
                    col = vColor;
                } else if (vKind < 2.5) {
                    float leaf = 1.0 - (abs(c.y) * 2.0 + pow(abs(c.x) * 2.0, 2.2));
                    a = smoothstep(0.0, 0.12, leaf);
                    col *= 0.75 + 0.5 * smoothstep(0.06, 0.0, abs(c.y)) ;
                } else {
                    a = smoothstep(1.0, 0.75, r);
                }
                a *= vAlpha;
                if (a < 0.004) discard;
                gl_FragColor = vec4(col * a, a * (1.0 - additive));
            }`
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 30;
    scene.add(mesh);

    function spawn(kind, x, y, z, vx, vy, vz, life, size, grow, r, g, b, gravity = 0, drag = 0) {
        const o = cursor * STRIDE;
        cursor = (cursor + 1) % max;
        data[o] = x; data[o + 1] = y; data[o + 2] = z;
        data[o + 3] = vx; data[o + 4] = vy; data[o + 5] = vz;
        data[o + 6] = life; data[o + 7] = life;
        data[o + 8] = size; data[o + 9] = grow;
        data[o + 10] = r; data[o + 11] = g; data[o + 12] = b;
        data[o + 13] = kind; data[o + 14] = gravity; data[o + 15] = drag;
        seedArr[o / STRIDE] = Math.random() * 6.283;
    }

    const rand = (a, b) => a + Math.random() * (b - a);

    const api = {
        mesh,
        uniforms,
        spawn,
        /** Poeira no pé: `n` tufos saindo para os lados (dir = ±1 privilegia um lado). */
        dust(x, y, n = 5, dir = 0, power = 1) {
            for (let i = 0; i < n; i++) {
                const side = dir !== 0 ? dir : (i % 2 ? 1 : -1);
                spawn(0, x + rand(-0.15, 0.15), y + rand(0.02, 0.1), rand(-0.2, 0.3),
                    side * rand(0.4, 1.6) * power, rand(0.2, 0.9) * power, rand(-0.2, 0.2),
                    rand(0.35, 0.7), rand(0.14, 0.26), 1.6, 0.86, 0.8, 0.68, -0.6, 2.4);
            }
        },
        /** Estouro de brilhos ✦ (coleta, caixa, vitória). Cores em HDR para o bloom pegar. */
        sparkle(x, y, n = 8, r = 2.6, g = 1.7, b = 0.5, speed = 2.6) {
            for (let i = 0; i < n; i++) {
                const a = (i / n) * 6.283 + rand(0, 0.6);
                const v = speed * rand(0.4, 1);
                spawn(1, x, y, rand(-0.1, 0.3), Math.cos(a) * v, Math.sin(a) * v + 0.6, rand(-0.3, 0.3),
                    rand(0.35, 0.65), rand(0.16, 0.34), -0.4, r, g, b, 2.2, 2.2);
            }
            spawn(1, x, y, 0.2, 0, 0, 0, 0.22, 1.1, 1.5, r * 0.7, g * 0.7, b * 0.7);
        },
        /** Lascas (rival pisado, dano): pedacinhos que caem com gravidade. */
        chips(x, y, n, r, g, b, speed = 3) {
            for (let i = 0; i < n; i++) {
                const a = rand(0.2, 2.94);
                const v = speed * rand(0.4, 1);
                spawn(3, x, y, rand(-0.1, 0.3), Math.cos(a) * v, Math.sin(a) * v, rand(-0.5, 0.5),
                    rand(0.4, 0.75), rand(0.05, 0.11), -0.3, r * rand(0.7, 1.1), g * rand(0.7, 1.1), b * rand(0.7, 1.1), 11, 0.6);
            }
        },
        /** Respingo ao cair na água. */
        splash(x, y) {
            for (let i = 0; i < 16; i++) {
                const a = rand(0.75, 2.4);
                const v = rand(2.2, 5.2);
                spawn(3, x + rand(-0.2, 0.2), y, rand(-0.3, 0.3), Math.cos(a) * v, Math.sin(a) * v, rand(-0.6, 0.6),
                    rand(0.5, 0.9), rand(0.06, 0.13), -0.2, 0.82, 0.93, 1.0, 10, 0.4);
            }
            for (let i = 0; i < 7; i++) {
                spawn(0, x + rand(-0.5, 0.5), y + 0.1, rand(-0.3, 0.3), rand(-0.8, 0.8), rand(0.6, 1.8), 0,
                    rand(0.6, 1.1), rand(0.3, 0.55), 1.8, 0.95, 0.98, 1.0, -0.3, 1.6);
            }
        },
        /** Folha à deriva (ambiente). */
        leaf(x, y, z) {
            const tone = Math.random();
            spawn(2, x, y, z, rand(-1.9, -0.9), rand(-0.75, -0.3), rand(-0.1, 0.1), rand(7, 11), rand(0.1, 0.17), 0,
                0.55 + tone * 0.5, 0.62 + tone * 0.12, 0.16 + tone * 0.1, 0, 0);
        },
        /** Poeirinha de pólen iluminada (ambiente). */
        mote(x, y, z) {
            spawn(1, x, y, z, rand(-0.35, -0.1), rand(-0.05, 0.12), 0, rand(4, 7), rand(0.035, 0.07), 0, 1.5, 1.35, 0.9, 0, 0);
        },
        clear() {
            for (let i = 0; i < max; i++) data[i * STRIDE + 6] = 0;
        },
        update(dt) {
            let n = 0;
            const P = aPos.array;
            const D = aData.array;
            const Cc = aColor.array;
            for (let i = 0; i < max; i++) {
                const o = i * STRIDE;
                if (data[o + 6] <= 0) continue;
                data[o + 6] -= dt;
                if (data[o + 6] <= 0) continue;
                const kind = data[o + 13];
                const drag = data[o + 15];
                data[o + 3] -= data[o + 3] * drag * dt;
                data[o + 4] += (-data[o + 14] - data[o + 4] * drag) * dt;
                data[o] += data[o + 3] * dt;
                data[o + 1] += data[o + 4] * dt;
                data[o + 2] += data[o + 5] * dt;
                const age = 1 - data[o + 6] / data[o + 7];
                const seed = seedArr[i];
                let alpha;
                let rot = seed;
                if (kind === 2) {
                    data[o] += Math.sin(age * data[o + 7] * 3 + seed) * 0.6 * dt;
                    rot = seed + age * data[o + 7] * 2.2;
                    alpha = Math.min(1, age * 8) * Math.min(1, (1 - age) * 5);
                } else if (kind === 1) {
                    rot = seed * 0.2 + age * 1.5;
                    alpha = Math.min(1, age * 12) * (1 - age) * (0.75 + 0.25 * Math.sin(age * 40 + seed));
                } else if (kind === 0) {
                    alpha = Math.min(1, age * 10) * (1 - age) * 0.55;
                } else {
                    alpha = Math.min(1, (1 - age) * 4);
                }
                P[n * 3] = data[o];
                P[n * 3 + 1] = data[o + 1];
                P[n * 3 + 2] = data[o + 2];
                D[n * 4] = data[o + 8] * (1 + data[o + 9] * age);
                D[n * 4 + 1] = rot;
                D[n * 4 + 2] = alpha;
                D[n * 4 + 3] = kind;
                Cc[n * 3] = data[o + 10];
                Cc[n * 3 + 1] = data[o + 11];
                Cc[n * 3 + 2] = data[o + 12];
                n++;
            }
            geo.instanceCount = n;
            aPos.needsUpdate = true;
            aData.needsUpdate = true;
            aColor.needsUpdate = true;
        }
    };
    return api;
}
