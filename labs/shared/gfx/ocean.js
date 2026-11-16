/**
 * gfx/ocean — mar com ondas de Gerstner sobre MeshPhysicalMaterial (recebe sombra,
 * IBL do céu e especular GGX do sol sem código de luz próprio).
 *
 * Onda i (direção D, comprimento L, amplitude A, inclinação s):
 *   k = 2π/L        ω = √(g·k)            (dispersão de águas profundas)
 *   φ = k·(D·p) − ω·t
 *   p' = p + D·(s/(k·N))·cos φ           y = A·sin φ
 *   normal = (−Σ D.x·k·A·cos φ,  1 − Σ (s/N)·sin φ,  −Σ D.z·k·A·cos φ)
 * Espuma de crista: Σ (s/N)·sin φ acima de um limiar (compressão horizontal).
 * Arrebentação (praia): cristas viajam em contornos de profundidade,
 *   fase = prof·k_s + t·ω_s  → a mesma fase caminha para o raso.
 *
 * O lab fornece `depthGLSL`: `float gfxSeaDepth(vec2 xz)` (m; negativo = terra).
 * A malha é uma grade com células uniformes perto da câmera e crescimento geométrico
 * até o horizonte; ela segue a câmera em passos de uma célula (sem "nadar").
 */
import * as THREE from 'three';
import { textureSet } from './textures.js';
import { GLSL_NOISE } from './core.js';

const G = 9.81;
const f = (v) => {
    const s = Number(v).toFixed(6);
    return s.includes('.') ? s : `${s}.0`;
};

export const DEFAULT_WAVES = [
    { angle: 0.10, length: 64, amp: 0.42, steep: 0.55 },
    { angle: -0.34, length: 37, amp: 0.26, steep: 0.5 },
    { angle: 0.52, length: 21, amp: 0.15, steep: 0.5 },
    { angle: -0.72, length: 12.5, amp: 0.085, steep: 0.45 },
    { angle: 0.95, length: 7.1, amp: 0.05, steep: 0.4 },
    { angle: -0.18, length: 4.3, amp: 0.03, steep: 0.35 },
    { angle: 0.33, length: 2.6, amp: 0.018, steep: 0.3 }
];

function buildGrid(n, uniform, cell, growth) {
    const coord = (i) => {
        const a = Math.abs(i);
        const d = a <= uniform ? a : uniform + (Math.pow(growth, a - uniform) - 1) / (growth - 1);
        return Math.sign(i) * d * cell;
    };
    const side = n * 2 + 1;
    const pos = new Float32Array(side * side * 3);
    let o = 0;
    for (let j = -n; j <= n; j++) {
        for (let i = -n; i <= n; i++) {
            pos[o++] = coord(i);
            pos[o++] = 0;
            pos[o++] = coord(j);
        }
    }
    const idx = new Uint32Array((side - 1) * (side - 1) * 6);
    o = 0;
    for (let j = 0; j < side - 1; j++) {
        for (let i = 0; i < side - 1; i++) {
            const a = j * side + i;
            const b = a + 1;
            const c = a + side;
            const d = c + 1;
            idx[o++] = a; idx[o++] = c; idx[o++] = b;
            idx[o++] = b; idx[o++] = c; idx[o++] = d;
        }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    const nor = new Float32Array(side * side * 3);
    for (let i = 1; i < nor.length; i += 3) nor[i] = 1;
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    return geo;
}

const GRID = {
    low: { n: 52, uniform: 22, cell: 2.2, growth: 1.19 },
    medium: { n: 78, uniform: 34, cell: 1.6, growth: 1.14 },
    high: { n: 104, uniform: 44, cell: 1.25, growth: 1.105 }
};

/**
 * @param {object} o
 * @param {'low'|'medium'|'high'} o.tier
 * @param {string} [o.depthGLSL]   GLSL com `float gfxSeaDepth(vec2 xz)`
 * @param {Array}  [o.waves]
 * @param {number} [o.windAngle]   rotação global das ondas (rad, 0 = +Z)
 * @param {boolean} [o.surf]       arrebentação em praia (surfK/surfSpeed/surfDepth ajustam espaçamento, velocidade e largura)
 */
export function createOcean({
    tier = 'medium',
    waves = DEFAULT_WAVES,
    windAngle = 0,
    depthGLSL = 'float gfxSeaDepth(vec2 xz) { return 30.0; }',
    deep = 0x0b3a44,
    shallow = 0x3f7f72,
    scatter = 0x2f8f7c,
    deepDepth = 9,
    surf = false,
    surfAmp = 0.42,
    surfK = 1.55,
    surfSpeed = 0.42,
    surfDepth = 2.6,
    swash = 0.12,
    waveScale = 1,
    wakes = 0
} = {}) {
    const N = waves.length;
    const ws = waves.map((w) => {
        const a = w.angle + windAngle;
        const k = (Math.PI * 2) / w.length;
        return {
            dx: Math.sin(a),
            dz: -Math.cos(a), // ondas viajam do mar (z+) para a costa (z−)
            k,
            w: Math.sqrt(G * k),
            A: w.amp * waveScale,
            q: w.steep / (k * N),
            s: w.steep / N,
            L: w.length
        };
    });

    let vertWaves = '';
    let fragWaves = '';
    for (const w of ws) {
        vertWaves += `
        {
            float ph = ${f(w.k)} * dot(vec2(${f(w.dx)}, ${f(w.dz)}), p) - ${f(w.w)} * uTime;
            float a = att * (1.0 - smoothstep(${f(w.L * 22)}, ${f(w.L * 60)}, dist));
            float c = cos(ph);
            d.x += ${f(w.dx * w.q)} * c * a;
            d.z += ${f(w.dz * w.q)} * c * a;
            d.y += ${f(w.A)} * sin(ph) * a;
        }`;
        fragWaves += `
        {
            float ph = ${f(w.k)} * dot(vec2(${f(w.dx)}, ${f(w.dz)}), p) - ${f(w.w)} * uTime;
            float a = att * (1.0 - smoothstep(${f(w.L * 70)}, ${f(w.L * 190)}, dist));
            float c = cos(ph);
            float s = sin(ph);
            n.x -= ${f(w.dx * w.k * w.A)} * c * a;
            n.z -= ${f(w.dz * w.k * w.A)} * c * a;
            n.y -= ${f(w.s)} * s * a;
            fold += ${f(w.s)} * s * a;
        }`;
    }

    const set = textureSet('waterNormal');
    const uniforms = {
        uTime: { value: 0 },
        uOceanNormal: { value: set.normalMap },
        uOceanDeep: { value: new THREE.Color(deep) },
        uOceanShallow: { value: new THREE.Color(shallow) },
        uOceanScatter: { value: new THREE.Color(scatter) },
        uDeepDepth: { value: deepDepth },
        uSurfAmp: { value: surf ? surfAmp : 0 },
        uSwash: { value: swash },
        uSurf: { value: new THREE.Vector3(surfK, surfSpeed, surfDepth) },
        uDaylight: { value: 1 },
        uFoamTint: { value: new THREE.Color(1, 1, 1) },
        uWake: { value: Array.from({ length: Math.max(1, wakes) }, () => new THREE.Vector4(0, 0, 0, 0)) },
        uWakeDim: { value: Array.from({ length: Math.max(1, wakes) }, () => new THREE.Vector4(8, 120, 1, 0)) }
    };

    const COMMON = /* glsl */ `
        uniform float uTime;
        uniform float uSurfAmp;
        uniform float uSwash;
        ${depthGLSL}
        float gfxShoal(float depth) { return clamp(depth * 0.3, 0.12, 1.0); }
        // crista de arrebentação: viaja em contornos de profundidade rumo ao raso
        uniform vec3 uSurf; // x = k (rad por metro de profundidade), y = ω (rad/s), z = profundidade máx. da arrebentação
        float gfxSurfPhase(vec2 p, float depth) {
            return depth * uSurf.x + uTime * uSurf.y + sin(p.x * 0.021 + sin(p.x * 0.0063) * 2.3) * 1.4;
        }
        float gfxSurfZone(float depth) { return smoothstep(0.04, 0.3, depth) * (1.0 - smoothstep(uSurf.z * 0.5, uSurf.z, depth)); }
    `;

    const mat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.1,
        metalness: 0,
        ior: 1.333,
        envMapIntensity: 1.15,
        transparent: true,
        depthWrite: true
    });
    mat.name = 'gfxOcean';
    mat.defines = { ...(mat.defines || {}), GFX_WAKES: Math.max(0, wakes) };

    mat.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', /* glsl */ `#include <common>
                ${COMMON}
                varying vec2 vOceanBase;
                varying float vOceanY;
                varying float vOceanDist;
                vec3 gfxOceanDisplace(vec2 p, float dist) {
                    float depth = gfxSeaDepth(p);
                    float att = gfxShoal(depth);
                    vec3 d = vec3(0.0);
                    ${vertWaves}
                    // maré de espraiamento: lâmina que sobe e desce a areia
                    float sw = sin(uTime * 0.52 + p.x * 0.045 + sin(p.x * 0.011) * 2.2);
                    d.y += uSwash * sw * (1.0 - smoothstep(0.0, 1.6, depth));
                    // rolo de arrebentação
                    float ph = gfxSurfPhase(p, depth);
                    float crest = pow(max(sin(ph), 0.0), 3.0);
                    d.y += uSurfAmp * crest * gfxSurfZone(depth);
                    return d;
                }
            `)
            .replace('#include <begin_vertex>', /* glsl */ `
                vec3 transformed = vec3(position);
                vec4 gfxW = modelMatrix * vec4(position, 1.0);
                vOceanBase = gfxW.xz;
                vOceanDist = distance(gfxW.xyz, cameraPosition);
                vec3 gfxD = gfxOceanDisplace(gfxW.xz, vOceanDist);
                transformed += gfxD;
                vOceanY = gfxD.y;
            `);

        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', /* glsl */ `#include <common>
                ${COMMON}
                ${GLSL_NOISE}
                uniform sampler2D uOceanNormal;
                uniform vec3 uOceanDeep;
                uniform vec3 uOceanShallow;
                uniform vec3 uOceanScatter;
                uniform vec3 uFoamTint;
                uniform float uDeepDepth;
                uniform float uDaylight;
                #if GFX_WAKES > 0
                uniform vec4 uWake[GFX_WAKES];
                uniform vec4 uWakeDim[GFX_WAKES];
                #endif
                varying vec2 vOceanBase;
                varying float vOceanY;
                varying float vOceanDist;
                vec3 gfxOceanN;
                float gfxOceanFoam;
                float gfxOceanCrest;
            `)
            .replace('#include <color_fragment>', /* glsl */ `#include <color_fragment>
                {
                    vec2 p = vOceanBase;
                    float dist = vOceanDist;
                    float depth = gfxSeaDepth(p);
                    if (depth < -0.75) discard;
                    float att = gfxShoal(depth);
                    vec3 n = vec3(0.0, 1.0, 0.0);
                    float fold = 0.0;
                    ${fragWaves}

                    // microdetalhe: 3 camadas de normal map rolando em direções distintas
                    vec3 d1 = texture2D(uOceanNormal, p * 0.19 + uTime * vec2(0.031, -0.043)).xyz * 2.0 - 1.0;
                    vec3 d2 = texture2D(uOceanNormal, p * 0.071 + uTime * vec2(-0.017, -0.026)).xyz * 2.0 - 1.0;
                    vec3 d3 = texture2D(uOceanNormal, p * 0.017 + uTime * vec2(0.006, -0.009)).xyz * 2.0 - 1.0;
                    float detailFade = 1.0 / (1.0 + dist * 0.012);
                    vec2 dn = d1.xy * 0.16 * detailFade + d2.xy * 0.14 * (0.4 + 0.6 * detailFade) + d3.xy * 0.10;
                    n.xz += dn;

                    // arrebentação: face do rolo + espuma
                    float zone = gfxSurfZone(depth);
                    float ph = gfxSurfPhase(p, depth);
                    float crest = pow(max(sin(ph), 0.0), 3.0) * zone * step(0.001, uSurfAmp);
                    float breakNoise = gfxFbm(p * 0.35 + vec2(0.0, uTime * 0.25));
                    float foamNoise = gfxFbm(p * 1.7 + dn * 3.0 + vec2(uTime * 0.07, -uTime * 0.11));

                    float foam = smoothstep(0.34, 0.62, fold + foamNoise * 0.22 - 0.1) * 0.75;
                    foam += smoothstep(0.35, 0.9, crest) * (0.45 + 0.75 * breakNoise);
                    // rastro de espuma atrás da crista, se dissolvendo
                    float trail = fract(ph / 6.2831853 - 0.26);
                    foam += zone * step(0.001, uSurfAmp) * smoothstep(0.32, 0.0, trail) * smoothstep(0.5, 0.82, foamNoise + (1.0 - trail) * 0.16) * 0.7;
                    // franja do espraiamento na areia
                    float thick = vOceanY + depth;
                    foam += (1.0 - smoothstep(0.0, 0.22, thick)) * smoothstep(0.25, 0.6, foamNoise + 0.25) * step(0.001, uSwash);
                    foam += (1.0 - smoothstep(0.0, 0.05, thick)) * step(0.001, uSwash);

                    #if GFX_WAKES > 0
                    for (int i = 0; i < GFX_WAKES; i++) {
                        vec4 wk = uWake[i];
                        vec4 wd = uWakeDim[i];
                        if (wk.w <= 0.001) continue;
                        vec2 rel = p - wk.xy;
                        vec2 fw = vec2(sin(wk.z), cos(wk.z));
                        float along = dot(rel, fw);          // + = à frente da popa
                        float lat = abs(dot(rel, vec2(fw.y, -fw.x)));
                        float behind = -along;                // distância atrás da proa
                        float hullLen = wd.y;
                        float inWake = smoothstep(-2.0, 6.0, behind) * (1.0 - smoothstep(hullLen * 2.2, hullLen * 4.5, behind));
                        float widen = wd.x * (0.9 + max(behind - hullLen, 0.0) * 0.012);
                        float core = (1.0 - smoothstep(widen * 0.75, widen * 1.25, lat)) * smoothstep(hullLen * 0.72, hullLen * 1.05, behind);
                        float arm = abs(lat - wd.x - max(behind, 0.0) * 0.33);
                        float kelvin = (1.0 - smoothstep(0.0, 2.2 + behind * 0.035, arm));
                        float ring = (1.0 - smoothstep(0.0, 1.6, abs(lat - wd.x))) * step(0.0, behind) * step(behind, hullLen);
                        float wf = (core * (0.55 + 0.6 * foamNoise) + kelvin * 0.55 * smoothstep(0.3, 0.7, foamNoise + 0.2) + ring * 0.6 * foamNoise) * inWake;
                        foam += wf * wk.w;
                        n.xz += (d1.xy * 0.5) * core * inWake * wk.w;
                    }
                    #endif

                    foam = clamp(foam, 0.0, 1.0);
                    gfxOceanN = normalize(n);
                    gfxOceanFoam = foam;
                    gfxOceanCrest = max(vOceanY, 0.0);

                    float deepK = smoothstep(0.0, uDeepDepth, depth);
                    vec3 water = mix(uOceanShallow, uOceanDeep, deepK);
                    // areia em suspensão no raso
                    water = mix(vec3(0.42, 0.40, 0.30), water, smoothstep(0.0, 1.3, depth));
                    diffuseColor.rgb = mix(water, uFoamTint * 0.92, foam);
                    // lâmina fina deixa ver a areia
                    diffuseColor.a = clamp(max(smoothstep(0.0, 0.42, thick), foam), 0.0, 1.0);
                }
            `)
            .replace('#include <roughnessmap_fragment>', /* glsl */ `#include <roughnessmap_fragment>
                roughnessFactor = mix(roughnessFactor + clamp(vOceanDist * 0.00045, 0.0, 0.22), 0.72, gfxOceanFoam);
            `)
            .replace('#include <normal_fragment_maps>', /* glsl */ `
                normal = normalize((viewMatrix * vec4(gfxOceanN, 0.0)).xyz);
            `)
            .replace('#include <emissivemap_fragment>', /* glsl */ `#include <emissivemap_fragment>
                totalEmissiveRadiance += uOceanScatter * gfxOceanCrest * 0.22 * uDaylight * (1.0 - gfxOceanFoam);
            `);
    };
    mat.customProgramCacheKey = () => `gfxOcean:${N}:${wakes}:${surf}`;

    const g = GRID[tier] || GRID.medium;
    const mesh = new THREE.Mesh(buildGrid(g.n, g.uniform, g.cell, g.growth), mat);
    mesh.name = 'gfxOcean';
    mesh.frustumCulled = false;
    mesh.receiveShadow = true;
    mesh.renderOrder = 5;

    const snap = g.cell;

    return {
        mesh,
        material: mat,
        uniforms,

        /** Altura da superfície (sem deslocamento horizontal) — para boias e barcos. */
        heightAt(x, z, t, atten = 1) {
            let y = 0;
            for (const w of ws) y += w.A * Math.sin(w.k * (w.dx * x + w.dz * z) - w.w * t);
            return y * atten;
        },

        /** Normal aproximada da superfície (para inclinar embarcações). */
        slopeAt(x, z, t, out, atten = 1) {
            let nx = 0;
            let nz = 0;
            for (const w of ws) {
                if (w.L < 8) continue;
                const c = Math.cos(w.k * (w.dx * x + w.dz * z) - w.w * t);
                nx -= w.dx * w.k * w.A * c;
                nz -= w.dz * w.k * w.A * c;
            }
            return out.set(nx * atten, 1, nz * atten).normalize();
        },

        /** idx < wakes. dir = rumo (rad, 0 = +Z). */
        setWake(idx, x, z, dir, strength, halfBeam = 8, length = 120) {
            if (idx >= wakes) return;
            uniforms.uWake.value[idx].set(x, z, dir, strength);
            uniforms.uWakeDim.value[idx].set(halfBeam, length, 0, 0);
        },

        update(t, camera, daylight = 1) {
            uniforms.uTime.value = t;
            uniforms.uDaylight.value = daylight;
            mesh.position.x = Math.round(camera.position.x / snap) * snap;
            mesh.position.z = Math.round(camera.position.z / snap) * snap;
        },

        dispose() {
            mesh.geometry.dispose();
            mat.dispose();
        }
    };
}
