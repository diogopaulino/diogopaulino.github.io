/**
 * A Menina da Lanterna — efeitos de luz e fumaça (shaders próprios).
 *
 *   createGlows        halos de luz (cartazes aditivos instanciados, 1 draw call para todos)
 *   createFlameKit     chama em gota com tremor (malha emissiva que alimenta o bloom)
 *   createMotes        vaga-lumes/brasas de ambiente que "embrulham" em volta da câmera
 *   createShadowBody   Sombrio: criatura de fumaça com volume falso, olhos em brasa e dissolução
 *   createBeacon       coluna de luz suave que marca um destino
 *   revealMaterial     faz um material "aparecer" ao longo de um eixo (ponte do capítulo III)
 *
 * Todos os tempos vêm de um relógio compartilhado (FX_TIME) atualizado uma vez por quadro.
 */

import * as THREE from 'three';
import { GLSL_NOISE } from '../../shared/gfx/core.js';

/** Relógio compartilhado pelos shaders deste arquivo. */
export const FX_TIME = { value: 0 };

// ───────────────────────────────────────────────────────────────────────────
// Halos
// ───────────────────────────────────────────────────────────────────────────

/**
 * Halos aditivos. Cada halo é um quad voltado para a câmera:
 *   brilho(r) = I · (0,55·e^(−r²·9) + 0,45·e^(−r²·2,2)) · tremor
 *   tremor    = 1 + f·(ruído(t·7 + fase) − ½)           f = quanto a chama treme
 * @returns {{ mesh, add(o) → halo, update() }}  halo = { set(x,y,z), intensity, size } (escreva e chame halo.push())
 */
export function createGlows(max = 96) {
    const base = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index;
    geo.setAttribute('position', base.attributes.position);
    geo.setAttribute('uv', base.attributes.uv);
    const aPos = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    const aParam = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4); // tamanho, intensidade, fase, tremor
    const aColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    aPos.setUsage(THREE.DynamicDrawUsage);
    aParam.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aPos', aPos);
    geo.setAttribute('aParam', aParam);
    geo.setAttribute('aColor', aColor);
    geo.instanceCount = 0;
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);

    const mat = new THREE.ShaderMaterial({
        name: 'lanternaGlow',
        uniforms: { uTime: FX_TIME },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
            attribute vec3 aPos;
            attribute vec4 aParam;
            attribute vec3 aColor;
            uniform float uTime;
            varying vec2 vUv;
            varying vec3 vCol;
            float h1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
            float n1(float x) { float i = floor(x); float f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h1(i), h1(i + 1.0), f); }
            void main() {
                float flick = 1.0 + aParam.w * (n1(uTime * 7.0 + aParam.z * 31.0) - 0.5);
                vec4 mv = viewMatrix * vec4(aPos, 1.0);
                // puxa o halo um pouco para a câmera: não corta no vidro/poste onde nasce
                mv.xyz *= 1.0 - min(0.25, 0.35 / max(0.5, -mv.z));
                mv.xy += position.xy * aParam.x * (0.92 + 0.08 * flick);
                gl_Position = projectionMatrix * mv;
                vUv = uv;
                vCol = aColor * aParam.y * flick;
            }
        `,
        fragmentShader: /* glsl */ `
            varying vec2 vUv;
            varying vec3 vCol;
            void main() {
                vec2 c = vUv - 0.5;
                float r2 = dot(c, c) * 4.0;
                float a = 0.6 * exp(-r2 * 14.0) + 0.4 * exp(-r2 * 4.0);
                a *= 1.0 - smoothstep(0.35, 1.0, r2);
                if (a < 0.002) discard;
                gl_FragColor = vec4(vCol * a, 1.0);
            }
        `
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 30;
    mesh.name = 'lanternaGlows';
    let count = 0;
    let dirty = false;
    const col = new THREE.Color();

    return {
        mesh,
        /** Cria um halo. `flicker` 0..1 = tremor de chama. */
        add({ x = 0, y = 0, z = 0, size = 1, color = 0xffb060, intensity = 0, flicker = 0.35 } = {}) {
            if (count >= max) return null;
            const i = count++;
            geo.instanceCount = count;
            col.set(color);
            aColor.setXYZ(i, col.r, col.g, col.b);
            aColor.needsUpdate = true;
            const halo = {
                x, y, z, size, intensity, flicker,
                set(nx, ny, nz) {
                    halo.x = nx;
                    halo.y = ny;
                    halo.z = nz;
                    return halo;
                },
                color(c) {
                    col.set(c);
                    aColor.setXYZ(i, col.r, col.g, col.b);
                    aColor.needsUpdate = true;
                    return halo;
                },
                /** Envia posição/tamanho/intensidade para a GPU. */
                push() {
                    aPos.setXYZ(i, halo.x, halo.y, halo.z);
                    aParam.setXYZW(i, halo.size, halo.intensity, i * 0.37, halo.flicker);
                    dirty = true;
                }
            };
            halo.push();
            return halo;
        },
        update() {
            if (!dirty) return;
            aPos.needsUpdate = true;
            aParam.needsUpdate = true;
            dirty = false;
        }
    };
}

// ───────────────────────────────────────────────────────────────────────────
// Chama
// ───────────────────────────────────────────────────────────────────────────

/**
 * Chama em gota. Perfil torneado r(v) = 0,5·sin(π·v^0,62)·(1 − 0,35·v), v ∈ [0,1] (altura 1).
 * No shader a ponta balança:  x += sin(t·9 + fase)·0,10·v²  e a cor vai de branco-quente
 * (base) a laranja (ponta), em HDR (até ~7) para o bloom pegar.
 * @returns {{ make(height) → Mesh }}  todas as chamas compartilham geometria e material
 */
export function createFlameKit() {
    const pts = [];
    for (let i = 0; i <= 10; i++) {
        const v = i / 10;
        pts.push(new THREE.Vector2(Math.max(0.0001, 0.5 * Math.sin(Math.PI * Math.pow(v, 0.62)) * (1 - 0.35 * v)), v));
    }
    const geo = new THREE.LatheGeometry(pts, 10);
    const mat = new THREE.ShaderMaterial({
        name: 'lanternaFlame',
        uniforms: { uTime: FX_TIME },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
            uniform float uTime;
            varying float vV;
            varying float vRim;
            void main() {
                vec3 p = position;
                vec3 wp0 = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
                float ph = wp0.x * 3.1 + wp0.z * 5.7;
                float v = p.y;
                p.x += sin(uTime * 9.0 + ph) * 0.10 * v * v + sin(uTime * 23.0 + ph * 2.0) * 0.03 * v;
                p.z += cos(uTime * 7.3 + ph) * 0.08 * v * v;
                p.y *= 1.0 + 0.12 * sin(uTime * 13.0 + ph * 1.7);
                vec4 mv = modelViewMatrix * vec4(p, 1.0);
                vec3 n = normalize(normalMatrix * normal);
                vRim = abs(dot(n, normalize(-mv.xyz)));
                vV = v;
                gl_Position = projectionMatrix * mv;
            }
        `,
        fragmentShader: /* glsl */ `
            varying float vV;
            varying float vRim;
            void main() {
                vec3 core = vec3(7.0, 5.2, 2.6);
                vec3 tip = vec3(4.2, 1.5, 0.25);
                vec3 col = mix(core, tip, smoothstep(0.15, 0.95, vV));
                float a = pow(vRim, 1.4) * smoothstep(1.0, 0.7, vV);
                gl_FragColor = vec4(col * a, 1.0);
            }
        `
    });
    return {
        make(height = 0.08) {
            const m = new THREE.Mesh(geo, mat);
            m.scale.set(height * 0.62, height, height * 0.62);
            m.renderOrder = 31;
            m.name = 'chama';
            return m;
        }
    };
}

// ───────────────────────────────────────────────────────────────────────────
// Vaga-lumes / brasas de ambiente
// ───────────────────────────────────────────────────────────────────────────

/**
 * Pontos de luz que flutuam numa caixa de lado L centrada na câmera. A posição é função
 * pura do tempo e "embrulha" na caixa, então o enxame parece infinito sem custo de CPU:
 *   p = mod(semente·L + deriva(t) − centro + L/2, L) − L/2 + centro
 *   deriva(t) = (sin, cos, sin)(t·ω + fase)·amplitude + vento·t
 *   brilho = pisca(t)² · (1 − borda da caixa)
 * @param {object} o  { count, box:[x,y,z], color, size (m), speed, rise (m/s), blink 0..1 }
 */
export function createMotes({ count = 120, box = [36, 5, 36], color = 0xd8ff7a, size = 0.07, speed = 1, rise = 0, blink = 1, intensity = 3 } = {}) {
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
        uTime: FX_TIME,
        uCenter: { value: new THREE.Vector3() },
        uBox: { value: new THREE.Vector3(box[0], box[1], box[2]) },
        uColor: { value: new THREE.Color(color) },
        uSize: { value: size },
        uSpeed: { value: speed },
        uRise: { value: rise },
        uBlink: { value: blink },
        uAmount: { value: 1 },
        uIntensity: { value: intensity }
    };
    const mat = new THREE.ShaderMaterial({
        name: 'lanternaMotes',
        uniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
            attribute vec4 aSeed;
            uniform float uTime, uSize, uSpeed, uRise, uBlink, uAmount;
            uniform vec3 uCenter, uBox;
            varying vec2 vUv;
            varying float vA;
            void main() {
                float t = uTime * uSpeed;
                vec3 p = aSeed.xyz * uBox;
                p.x += sin(t * (0.21 + aSeed.w * 0.3) + aSeed.y * 40.0) * 1.6;
                p.z += cos(t * (0.17 + aSeed.x * 0.3) + aSeed.z * 40.0) * 1.6;
                p.y += sin(t * (0.4 + aSeed.z * 0.5) + aSeed.w * 40.0) * 0.5 + uRise * uTime;
                p = mod(p - uCenter + uBox * 0.5, uBox) - uBox * 0.5;
                vec3 e = abs(p) / (uBox * 0.5);
                float edge = 1.0 - smoothstep(0.7, 1.0, max(e.x, max(e.y, e.z)));
                float bl = 0.5 + 0.5 * sin(t * (1.1 + aSeed.w * 1.7) + aSeed.x * 60.0);
                bl = mix(1.0, bl * bl * bl, uBlink);
                // só uma fração (uAmount) do enxame aparece: vaga-lumes voltam com os lampiões
                vA = edge * bl * step(aSeed.w, uAmount);
                vec4 mv = viewMatrix * vec4(p + uCenter, 1.0);
                mv.xy += position.xy * uSize * (0.6 + aSeed.y * 0.8);
                gl_Position = projectionMatrix * mv;
                vUv = uv;
            }
        `,
        fragmentShader: /* glsl */ `
            uniform vec3 uColor;
            uniform float uIntensity;
            varying vec2 vUv;
            varying float vA;
            void main() {
                vec2 c = vUv - 0.5;
                float r2 = dot(c, c) * 4.0;
                float a = (exp(-r2 * 12.0) + 0.25 * exp(-r2 * 3.0)) * vA;
                if (a < 0.004) discard;
                gl_FragColor = vec4(uColor * uIntensity * a, 1.0);
            }
        `
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 29;
    mesh.name = 'lanternaMotes';
    return { mesh, uniforms };
}

// ───────────────────────────────────────────────────────────────────────────
// Sombrio — criatura de fumaça
// ───────────────────────────────────────────────────────────────────────────

const SMOKE_VERT = /* glsl */ `
    uniform float uTime, uSeed, uInflate;
    uniform vec3 uDrift;
    varying vec3 vObj;
    varying vec3 vNrm;
    varying vec3 vView;
    ${GLSL_NOISE}
    void main() {
        vec3 p = position;
        // 0 no capuz, 1 na barra esfiapada
        float low = smoothstep(0.55, -0.9, p.y);
        float t = uTime * 0.9 + uSeed;
        float n1 = gfxNoise(p.xy * 2.3 + vec2(t * 0.7, -t * 1.3)) - 0.5;
        float n2 = gfxNoise(p.zy * 3.1 + vec2(-t * 0.9, -t * 1.7) + 7.0) - 0.5;
        float n3 = gfxNoise(p.xz * 5.0 + vec2(t * 1.9, t * 1.1) + 3.0) - 0.5;
        p += normal * (n1 * 0.22 + n2 * 0.2) * (0.35 + low * 1.3) + normal * uInflate;
        // a barra fica para trás (arrasto) e ondula
        p += uDrift * low * low * (1.0 + n3);
        p.x += sin(t * 2.3 + p.y * 3.0) * 0.07 * low;
        p.y += n3 * 0.18 * low;
        vObj = position;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vNrm = normalize(normalMatrix * normal);
        vView = -mv.xyz;
        gl_Position = projectionMatrix * mv;
    }
`;

/**
 * Sombreamento do Sombrio (volume falso em duas cascas):
 *   densidade  ρ = (n·v)^k · erosão,  erosão = smoothstep(c, c + 0,35, fbm(obj·2 + t↑))
 *                (k = 2,4 na casca de fora, 0,9 no miolo; c cresce na barra → fiapos)
 *   dissolução d ∈ [0,1]:  some onde ruído < d·1,15;  a faixa [d, d + 0,09] vira brasa
 *   cor        = preto-violeta + contorno frio (1 − n·v)³·luar + brasa
 * Miolo: escreve profundidade e usa cobertura por amostra (alphaToCoverage) com
 * pontilhado de ruído — recebe névoa e AO como um sólido. Casca: mistura normal.
 */
const SMOKE_FRAG = /* glsl */ `
    uniform float uTime, uSeed, uDissolve, uPower, uAlpha, uFear;
    uniform vec3 uRim;
    varying vec3 vObj;
    varying vec3 vNrm;
    varying vec3 vView;
    ${GLSL_NOISE}
    void main() {
        vec3 n = normalize(vNrm);
        vec3 v = normalize(vView);
        float ndv = abs(dot(n, v));
        float t = uTime * 0.8 + uSeed;
        float low = smoothstep(0.5, -0.95, vObj.y);
        float f1 = gfxFbm(vObj.xy * 2.1 + vec2(0.0, -t * 0.9) + uSeed);
        float f2 = gfxFbm(vObj.zy * 2.6 + vec2(4.0, -t * 1.2) - uSeed);
        float f = 0.5 * (f1 + f2);
        float cut = mix(0.16, 0.52, low);
        float erosion = smoothstep(cut, cut + 0.35, f);
        float rho = pow(ndv, uPower) * erosion * uAlpha;
        // dissolução na luz
        float dn = gfxNoise(vObj.xy * 5.0 + vObj.z * 3.0 + uSeed) * 0.6 + f * 0.4;
        float gone = step(dn, uDissolve * 1.15);
        float ember = smoothstep(0.09, 0.0, dn - uDissolve * 1.15) * step(0.001, uDissolve) * (1.0 - gone);
        rho *= 1.0 - gone;
        vec3 col = vec3(0.004, 0.003, 0.007) + uRim * pow(1.0 - ndv, 3.0) * 0.05;
        col += vec3(5.0, 1.5, 0.25) * ember;
        col += vec3(1.6, 0.25, 0.05) * uFear * pow(1.0 - ndv, 2.0) * 0.06;
        #ifdef SMOKE_CORE
            float dither = gfxHash(gl_FragCoord.xy + fract(uTime) * 17.0);
            float a = clamp(rho * 1.5 + ember, 0.0, 1.0);
            if (a < 0.08 + dither * 0.22) discard;
            gl_FragColor = vec4(col, a);
        #else
            float a = clamp(rho + ember * 0.7, 0.0, 1.0);
            if (a < 0.004) discard;
            gl_FragColor = vec4(col, a);
        #endif
    }
`;

let smokeGeo = null;
/** Silhueta de vulto encapuzado: esfera esticada com ombros e barra aberta em sino. */
function smokeGeometry() {
    if (smokeGeo) return smokeGeo;
    const g = new THREE.SphereGeometry(1, 40, 32);
    const pos = g.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        const y = v.y; // −1..1
        // perfil: capuz (y > 0,45), ombros (~0,1), barra que abre (y < −0,3)
        const hood = Math.exp(-((y - 0.62) ** 2) / 0.07) * 0.5;
        const shoulders = Math.exp(-((y - 0.05) ** 2) / 0.1) * 0.74;
        const skirt = y < -0.1 ? 0.5 + (-0.1 - y) * 0.42 : 0;
        const r = Math.max(hood, shoulders, skirt, 0.12 * (1 - Math.abs(y)));
        const len = Math.hypot(v.x, v.z) || 1;
        const k = r / Math.max(0.0001, Math.sqrt(Math.max(0, 1 - y * y)));
        v.x *= k * (len > 0 ? 1 : 0);
        v.z *= k * 0.86;
        // capuz projeta para a frente (+z), costas arqueadas
        v.z += Math.exp(-((y - 0.6) ** 2) / 0.05) * 0.16 - 0.06 * y;
        v.y = y * 1.05;
        pos.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    smokeGeo = g;
    return g;
}

/**
 * Corpo de um Sombrio. Origem no chão; altura ≈ 2·`size` m; olha para +Z.
 * @returns {{ object, uniforms, eyes, setDissolve(d), setDrift(vx, vz), setFear(k) }}
 */
export function createShadowBody({ size = 1, seed = 1, rim = 0x6a78c8, eyeColor = [2.6, 0.55, 0.06] } = {}) {
    const geo = smokeGeometry();
    const shared = {
        uTime: FX_TIME,
        uSeed: { value: seed * 3.71 },
        uDissolve: { value: 0 },
        uDrift: { value: new THREE.Vector3() },
        uRim: { value: new THREE.Color(rim) },
        uFear: { value: 0 }
    };
    const coreMat = new THREE.ShaderMaterial({
        name: 'sombrioMiolo',
        defines: { SMOKE_CORE: '' },
        uniforms: { ...shared, uInflate: { value: -0.1 }, uPower: { value: 0.9 }, uAlpha: { value: 1.25 } },
        vertexShader: SMOKE_VERT,
        fragmentShader: SMOKE_FRAG,
        alphaToCoverage: true
    });
    const shellMat = new THREE.ShaderMaterial({
        name: 'sombrioCasca',
        uniforms: { ...shared, uInflate: { value: 0.1 }, uPower: { value: 2.4 }, uAlpha: { value: 1.1 } },
        vertexShader: SMOKE_VERT,
        fragmentShader: SMOKE_FRAG,
        transparent: true,
        depthWrite: false
    });
    const root = new THREE.Group();
    root.name = 'sombrio';
    const body = new THREE.Group();
    body.position.y = size * 1.05;
    body.scale.setScalar(size);
    const core = new THREE.Mesh(geo, coreMat);
    const shell = new THREE.Mesh(geo, shellMat);
    shell.renderOrder = 12;
    core.frustumCulled = shell.frustumCulled = false;
    body.add(core, shell);

    // olhos: duas brasas (HDR → bloom), amendoadas e inclinadas
    const eyeGeo = new THREE.SphereGeometry(1, 12, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(eyeColor[0], eyeColor[1], eyeColor[2]), toneMapped: false });
    const eyes = [];
    for (const s of [-1, 1]) {
        const e = new THREE.Mesh(eyeGeo, eyeMat);
        e.position.set(0.13 * s, 0.6, 0.47);
        e.scale.set(0.062, 0.03, 0.03);
        e.rotation.z = -0.38 * s;
        body.add(e);
        eyes.push(e);
    }
    root.add(body);
    return {
        object: root,
        body,
        uniforms: shared,
        eyes,
        eyeMat,
        setDissolve(d) {
            shared.uDissolve.value = d;
            const k = Math.max(0, 1 - d * 1.6);
            eyes[0].visible = eyes[1].visible = k > 0.02;
            eyes[0].scale.set(0.062 * k, 0.03 * k, 0.03);
            eyes[1].scale.copy(eyes[0].scale);
        },
        /** Arrasto da barra, em unidades do corpo (use −velocidade·0,12). */
        setDrift(x, y, z) {
            shared.uDrift.value.set(x, y, z);
        },
        setFear(k) {
            shared.uFear.value = k;
        }
    };
}

// ───────────────────────────────────────────────────────────────────────────
// Coluna de luz (destino)
// ───────────────────────────────────────────────────────────────────────────

/**
 * Facho vertical macio:  alfa = (n·v)² · (1 − h)^1,6 · (0,7 + 0,3·ruído subindo)
 * @param {number} color  @param {number} height  @param {number} radius
 */
export function createBeacon(color = 0x88aaff, height = 7, radius = 0.6) {
    const geo = new THREE.CylinderGeometry(radius * 0.45, radius, height, 20, 6, true);
    geo.translate(0, height / 2, 0);
    const uniforms = { uTime: FX_TIME, uColor: { value: new THREE.Color(color) }, uH: { value: height }, uOn: { value: 1 } };
    const mat = new THREE.ShaderMaterial({
        name: 'lanternaBeacon',
        uniforms,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
            varying float vH;
            varying float vRim;
            varying vec2 vP;
            uniform float uH;
            void main() {
                vec4 mv = modelViewMatrix * vec4(position, 1.0);
                vec3 n = normalize(normalMatrix * normal);
                vRim = abs(dot(n, normalize(-mv.xyz)));
                vH = position.y / uH;
                vP = vec2(atan(position.x, position.z), position.y);
                gl_Position = projectionMatrix * mv;
            }
        `,
        fragmentShader: /* glsl */ `
            uniform vec3 uColor;
            uniform float uTime, uOn;
            varying float vH;
            varying float vRim;
            varying vec2 vP;
            ${GLSL_NOISE}
            void main() {
                float n = gfxNoise(vec2(vP.x * 2.0, vP.y * 1.3 - uTime * 0.9));
                float a = vRim * vRim * pow(1.0 - vH, 1.6) * smoothstep(0.0, 0.06, vH) * (0.55 + 0.45 * n) * uOn;
                gl_FragColor = vec4(uColor * a * 0.4, 1.0);
            }
        `
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 28;
    mesh.name = 'facho';
    return { mesh, uniforms };
}

// ───────────────────────────────────────────────────────────────────────────
// Revelação ao longo de um eixo
// ───────────────────────────────────────────────────────────────────────────

/**
 * Injeta num MeshStandardMaterial um corte que avança pelo mundo:
 *   s = (p − origem)·direção / comprimento ∈ [0,1]
 *   desenha só onde s < revela − 0,06·ruído;  a frente [revela − 0,05, revela] brilha dourado
 * `uniforms.uReveal` vai de 0 (nada) a 1,2 (tudo). Usado na ponte do Rio dos Nomes.
 */
export function revealMaterial(material, uniforms) {
    material.onBeforeCompile = (shader) => {
        shader.uniforms.uReveal = uniforms.uReveal;
        shader.uniforms.uRevOrigin = uniforms.uRevOrigin;
        shader.uniforms.uRevDir = uniforms.uRevDir;
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nvarying vec3 vRevPos;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRevPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', `#include <common>
                varying vec3 vRevPos;
                uniform float uReveal;
                uniform vec3 uRevOrigin;
                uniform vec4 uRevDir;
                float revHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }`)
            .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
                float revS = dot(vRevPos - uRevOrigin, uRevDir.xyz) / uRevDir.w;
                float revN = revHash(floor(vRevPos * 9.0));
                float revEdge = uReveal - 0.06 * revN - revS;
                if (revEdge < 0.0) discard;`)
            .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
                totalEmissiveRadiance += vec3(4.0, 2.4, 0.7) * smoothstep(0.07, 0.0, revEdge) * step(uReveal, 1.19);`);
    };
    material.customProgramCacheKey = () => 'lanternaReveal';
    return material;
}
