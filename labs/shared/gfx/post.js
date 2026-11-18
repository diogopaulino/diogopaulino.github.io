/**
 * gfx/post — pipeline HDR de pós-processamento, enxuto e previsível.
 *
 *   cena (RGBA16F + MSAA + depth) ──► AO (½ res, SAO) ──► desfoque bilateral
 *        └─► composição: AO + neblina atmosférica (altura + distância, cor do LUT de céu)
 *              └─► pirâmide de bloom (dual-kawase, sem threshold — conserva energia)
 *                    └─► final: DoF barato (mips) + raios de sol + ACES + grade + grão
 *
 * Neblina (integral analítica de densidade exponencial em altura):
 *   τ = ρ · e^(−k·(y_cam − y0)) · (1 − e^(−k·d·dir.y)) / (k·dir.y)  +  haze · d
 *   f = 1 − e^(−τ)
 * AO (Scalable Ambient Obscurance, McGuire 2012):
 *   A = max(0, 1 − (2σ/n) · Σ max(0, v·n − β) / (v·v + ε))
 *
 * Custo: low = 3 passes fullscreen; high = ~12 passes pequenas (a maioria em ½–1/32 res).
 */
import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { GLSL_SKY_LUT } from './sky.js';

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const GLSL_DEPTH = /* glsl */ `
uniform sampler2D tDepth;
uniform mat4 uProjInv;
vec3 gfxViewPos(vec2 uv) {
    float d = texture2D(tDepth, uv).x;
    vec4 v = uProjInv * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
    return v.xyz / v.w;
}
`;

function mat(fragmentShader, uniforms, defines = {}) {
    return new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader,
        uniforms,
        defines,
        depthTest: false,
        depthWrite: false,
        toneMapped: false
    });
}

const AO_FRAG = /* glsl */ `
${GLSL_DEPTH}
uniform mat4 uProj;
uniform vec2 uTexel;
uniform float uRadius;
varying vec2 vUv;
#define AO_SAMPLES 10
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
void main() {
    float d = texture2D(tDepth, vUv).x;
    if (d >= 0.99999) { gl_FragColor = vec4(1.0); return; }
    vec3 P = gfxViewPos(vUv);
    vec3 Pr = gfxViewPos(vUv + vec2(uTexel.x, 0.0));
    vec3 Pl = gfxViewPos(vUv - vec2(uTexel.x, 0.0));
    vec3 Pu = gfxViewPos(vUv + vec2(0.0, uTexel.y));
    vec3 Pd = gfxViewPos(vUv - vec2(0.0, uTexel.y));
    vec3 dx = abs(Pr.z - P.z) < abs(P.z - Pl.z) ? Pr - P : P - Pl;
    vec3 dy = abs(Pu.z - P.z) < abs(P.z - Pd.z) ? Pu - P : P - Pd;
    vec3 N = normalize(cross(dx, dy));
    float dist = -P.z;
    float radius = uRadius * (1.0 + dist * 0.02);
    vec2 rUv = radius * 0.5 * vec2(uProj[0][0], uProj[1][1]) / dist;
    rUv = min(rUv, vec2(0.12));
    float ang = ign(gl_FragCoord.xy) * 6.2831853;
    float occ = 0.0;
    float bias = 0.012 * dist + 0.02;
    for (int i = 0; i < AO_SAMPLES; i++) {
        float fi = float(i);
        float r = sqrt((fi + 0.5) / float(AO_SAMPLES));
        float a = ang + fi * 2.39996323;
        vec2 uv = vUv + vec2(cos(a), sin(a)) * r * rUv;
        vec3 S = gfxViewPos(uv);
        vec3 v = S - P;
        float vv = dot(v, v);
        float vn = dot(v, N);
        float fall = max(0.0, 1.0 - vv / (radius * radius));
        occ += max(0.0, vn - bias) / (vv + 0.01) * fall;
    }
    float ao = max(0.0, 1.0 - occ * (2.4 * radius / float(AO_SAMPLES)));
    ao = mix(ao, 1.0, smoothstep(140.0, 260.0, dist));
    gl_FragColor = vec4(ao, d, 0.0, 1.0);
}
`;

const AO_BLUR_FRAG = /* glsl */ `
uniform sampler2D tAO;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
    vec2 c = texture2D(tAO, vUv).xy;
    float sum = 0.0;
    float wsum = 0.0;
    for (int y = -2; y <= 1; y++) {
        for (int x = -2; x <= 1; x++) {
            vec2 s = texture2D(tAO, vUv + (vec2(float(x), float(y)) + 0.5) * uTexel).xy;
            float w = 1.0 / (1e-4 + abs(s.y - c.y) * 4000.0);
            w = min(w, 1.0);
            sum += s.x * w;
            wsum += w;
        }
    }
    gl_FragColor = vec4(sum / max(wsum, 1e-4), 0.0, 0.0, 1.0);
}
`;

const COMPOSE_FRAG = /* glsl */ `
${GLSL_SKY_LUT}
uniform sampler2D tScene;
uniform sampler2D tDepth;
uniform sampler2D tAO;
uniform mat4 uViewProjInv;
uniform vec3 uCamPos;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uAo;
uniform float uFogDensity;
uniform float uFogFalloff;
uniform float uFogBase;
uniform float uHaze;
uniform float uFogMax;
uniform float uFogSunGlow;
uniform vec3 uFogTint;
varying vec2 vUv;
void main() {
    vec3 col = texture2D(tScene, vUv).rgb;
    float d = texture2D(tDepth, vUv).x;
    if (d < 0.99999) {
        #ifdef USE_AO
        float ao = texture2D(tAO, vUv).r;
        float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
        col *= mix(1.0, mix(ao, 1.0, smoothstep(1.5, 5.0, lum)), uAo);
        #endif
        vec4 wp = uViewProjInv * vec4(vUv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
        vec3 rd = wp.xyz / wp.w - uCamPos;
        float dist = length(rd);
        rd /= max(dist, 1e-4);
        // Integra a densidade exponencial a partir da ponta mais baixa do raio.
        // (1-exp(-x))/x tende a 1 no horizonte e fica finito ao olhar para baixo.
        float deltaY = rd.y * dist;
        float x = abs(deltaY * uFogFalloff);
        float meanDensity = x < 0.001 ? 1.0 - 0.5 * x : (1.0 - exp(-x)) / x;
        float lowY = uCamPos.y + min(deltaY, 0.0);
        float density = uFogDensity * exp(clamp(-uFogFalloff * (lowY - uFogBase), -60.0, 60.0));
        float tau = density * dist * meanDensity;
        tau += uHaze * dist;
        float f = (1.0 - exp(-max(tau, 0.0))) * uFogMax;
        vec3 fogCol = gfxSkyLut(normalize(vec3(rd.x, abs(rd.y) * 0.35 + 0.035, rd.z))) * uFogTint;
        float mu = max(dot(rd, uSunDir), 0.0);
        fogCol += uSunColor * (pow(mu, 10.0) * 0.6 + pow(mu, 3.0) * 0.12) * uFogSunGlow;
        col = mix(col, fogCol, f);
    }
    gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
}
`;

// Dual-Kawase: downsample de 5 taps / upsample de 8 taps
const DOWN_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
    vec3 c = texture2D(tSrc, vUv).rgb * 4.0;
    c += texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
    c += texture2D(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb;
    c += texture2D(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb;
    c += texture2D(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb;
    c *= 0.125;
    #ifdef FIRST
    // contém fireflies (specular HDR) antes de espalhar
    c = min(c, vec3(24.0));
    #endif
    gl_FragColor = vec4(c, 1.0);
}
`;

const UP_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform sampler2D tBase;
uniform vec2 uTexel;
uniform float uSpread;
varying vec2 vUv;
void main() {
    vec2 h = uTexel * uSpread;
    vec3 c = texture2D(tSrc, vUv + vec2(-h.x * 2.0, 0.0)).rgb;
    c += texture2D(tSrc, vUv + vec2(-h.x, h.y)).rgb * 2.0;
    c += texture2D(tSrc, vUv + vec2(0.0, h.y * 2.0)).rgb;
    c += texture2D(tSrc, vUv + vec2(h.x, h.y)).rgb * 2.0;
    c += texture2D(tSrc, vUv + vec2(h.x * 2.0, 0.0)).rgb;
    c += texture2D(tSrc, vUv + vec2(h.x, -h.y)).rgb * 2.0;
    c += texture2D(tSrc, vUv + vec2(0.0, -h.y * 2.0)).rgb;
    c += texture2D(tSrc, vUv + vec2(-h.x, -h.y)).rgb * 2.0;
    c /= 12.0;
    gl_FragColor = vec4(mix(texture2D(tBase, vUv).rgb, c, 0.62), 1.0);
}
`;

const RAYS_FRAG = /* glsl */ `
uniform sampler2D tDepth;
uniform vec2 uSunUv;
uniform float uAspect;
uniform float uStrength;
varying vec2 vUv;
#define RAY_SAMPLES 28
void main() {
    vec2 delta = (uSunUv - vUv) / float(RAY_SAMPLES) * 0.9;
    vec2 uv = vUv;
    float acc = 0.0;
    float w = 1.0;
    float n = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    uv += delta * n;
    for (int i = 0; i < RAY_SAMPLES; i++) {
        float sky = step(0.99999, texture2D(tDepth, uv).x);
        vec2 q = (uv - uSunUv) * vec2(uAspect, 1.0);
        float glow = exp(-dot(q, q) * 9.0);
        acc += sky * glow * w;
        w *= 0.965;
        uv += delta;
    }
    gl_FragColor = vec4(vec3(acc / float(RAY_SAMPLES) * uStrength), 1.0);
}
`;

const FINAL_FRAG = /* glsl */ `
uniform sampler2D tLit;
uniform sampler2D tBloom;
uniform sampler2D tBlurA;
uniform sampler2D tBlurB;
uniform sampler2D tRays;
uniform sampler2D tDepth;
uniform mat4 uProjInv;
uniform float uExposure;
uniform float uBloom;
uniform float uDofFocus;
uniform float uDofRange;
uniform float uDofMax;
uniform vec3 uRayColor;
uniform float uSaturation;
uniform float uContrast;
uniform vec3 uLift;
uniform vec3 uGain;
uniform float uSepia;
uniform float uVignette;
uniform float uGrain;
uniform float uTime;
uniform float uFade;
varying vec2 vUv;

// ACES (ajuste de Stephen Hill)
vec3 RRTAndODTFit(vec3 v) {
    vec3 a = v * (v + 0.0245786) - 0.000090537;
    vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
    return a / b;
}
vec3 aces(vec3 color) {
    const mat3 inMat = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
    const mat3 outMat = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
    color = inMat * color;
    color = RRTAndODTFit(color);
    color = outMat * color;
    return clamp(color, 0.0, 1.0);
}
float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}
void main() {
    vec3 col = texture2D(tLit, vUv).rgb;
    #ifdef USE_DOF
    if (uDofRange > 0.0) {
        float d = texture2D(tDepth, vUv).x;
        vec4 v = uProjInv * vec4(vUv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
        float z = -v.z / v.w;
        float coc = clamp((abs(z - uDofFocus) - uDofRange * 0.35) / uDofRange, 0.0, 1.0) * uDofMax;
        coc *= z < uDofFocus ? 0.6 : 1.0;
        col = mix(col, texture2D(tBlurA, vUv).rgb, smoothstep(0.0, 0.55, coc));
        col = mix(col, texture2D(tBlurB, vUv).rgb, smoothstep(0.55, 1.0, coc));
    }
    #endif
    #ifdef USE_BLOOM
    col = mix(col, texture2D(tBloom, vUv).rgb, uBloom);
    #endif
    #ifdef USE_RAYS
    col += texture2D(tRays, vUv).rgb * uRayColor;
    #endif

    col *= uExposure;
    col = aces(col / 0.6);

    // grade: lift/gain, contraste em torno do cinza médio, saturação, sépia
    col = col * uGain + uLift * (1.0 - col);
    col = (col - 0.5) * uContrast + 0.5;
    float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(vec3(l), col, uSaturation);
    vec3 sep = vec3(l) * vec3(1.07, 0.96, 0.78);
    col = mix(col, sep, uSepia);

    vec2 q = vUv - 0.5;
    col *= 1.0 - uVignette * smoothstep(0.25, 1.05, dot(q, q) * 2.2);

    col = pow(max(col, 0.0), vec3(1.0 / 2.2));
    float g = hash(gl_FragCoord.xy + fract(uTime) * 311.7) - 0.5;
    col += g * (uGrain + 1.0 / 255.0);
    col *= uFade;
    gl_FragColor = vec4(col, 1.0);
}
`;

const TIERS = {
    low: { msaa: 2, ao: false, bloomLevels: 3, rays: false, dof: false },
    medium: { msaa: 4, ao: true, bloomLevels: 4, rays: true, dof: true },
    high: { msaa: 4, ao: true, bloomLevels: 5, rays: true, dof: true }
};

export function createPipeline(renderer, { tier = 'medium', sky, software = false } = {}) {
    const cfg = { ...TIERS[tier] };
    if (software) cfg.msaa = 0;
    const gl = renderer.getContext();
    const hdr = renderer.capabilities.isWebGL2 !== false
        && (renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float'));
    const type = hdr ? THREE.HalfFloatType : THREE.UnsignedByteType;
    cfg.msaa = Math.min(cfg.msaa, gl.getParameter(gl.MAX_SAMPLES) || 0);

    renderer.toneMapping = THREE.NoToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const rtOpts = { type, format: THREE.RGBAFormat, depthBuffer: false, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter };
    const depthTex = new THREE.DepthTexture(4, 4);
    depthTex.minFilter = depthTex.magFilter = THREE.NearestFilter;
    const sceneRT = new THREE.WebGLRenderTarget(4, 4, { ...rtOpts, depthBuffer: true, depthTexture: depthTex, samples: cfg.msaa });
    const litRT = new THREE.WebGLRenderTarget(4, 4, rtOpts);
    const aoRT = cfg.ao ? new THREE.WebGLRenderTarget(4, 4, rtOpts) : null;
    const aoBlurRT = cfg.ao ? new THREE.WebGLRenderTarget(4, 4, { ...rtOpts, type: THREE.UnsignedByteType }) : null;
    const raysRT = cfg.rays ? new THREE.WebGLRenderTarget(4, 4, { ...rtOpts, type: THREE.UnsignedByteType }) : null;
    const down = [];
    const up = [];
    for (let i = 0; i < cfg.bloomLevels; i++) {
        down.push(new THREE.WebGLRenderTarget(4, 4, rtOpts));
        if (i < cfg.bloomLevels - 1) up.push(new THREE.WebGLRenderTarget(4, 4, rtOpts));
    }

    const params = {
        exposure: 1.0,
        bloom: 0.09,
        ao: 0.85,
        aoRadius: 1.1,
        fogDensity: 0.012,
        fogFalloff: 0.045,
        fogBase: 0,
        haze: 0.00035,
        fogMax: 1.0,
        fogSunGlow: 1.0,
        fogTint: new THREE.Color(1, 1, 1),
        rays: 0.55,
        dofFocus: 20,
        dofRange: 0,
        dofMax: 1,
        saturation: 1.06,
        contrast: 1.05,
        lift: new THREE.Color(0, 0, 0),
        gain: new THREE.Color(1, 1, 1),
        sepia: 0,
        vignette: 0.32,
        grain: 0.018,
        fade: 1
    };

    const projInv = new THREE.Matrix4();
    const viewProjInv = new THREE.Matrix4();
    const proj = new THREE.Matrix4();
    const camPos = new THREE.Vector3();
    const texelFull = new THREE.Vector2();
    const texelHalf = new THREE.Vector2();

    const aoMat = cfg.ao ? mat(AO_FRAG, {
        tDepth: { value: depthTex }, uProjInv: { value: projInv }, uProj: { value: proj },
        uTexel: { value: texelHalf }, uRadius: { value: 1 }
    }) : null;
    const aoBlurMat = cfg.ao ? mat(AO_BLUR_FRAG, { tAO: { value: aoRT.texture }, uTexel: { value: texelHalf } }) : null;

    const composeMat = mat(COMPOSE_FRAG, {
        tScene: { value: sceneRT.texture }, tDepth: { value: depthTex }, tAO: { value: aoBlurRT?.texture ?? null },
        uSkyLut: { value: sky?.lut ?? null },
        uViewProjInv: { value: viewProjInv }, uCamPos: { value: camPos },
        uSunDir: { value: sky?.lightDir ?? new THREE.Vector3(0, 1, 0) },
        uSunColor: { value: new THREE.Color() },
        uAo: { value: 1 }, uFogDensity: { value: 0 }, uFogFalloff: { value: 0.05 }, uFogBase: { value: 0 },
        uHaze: { value: 0 }, uFogMax: { value: 1 }, uFogSunGlow: { value: 1 }, uFogTint: { value: params.fogTint }
    }, cfg.ao ? { USE_AO: '' } : {});

    const downMats = down.map((_, i) => mat(DOWN_FRAG, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } }, i === 0 ? { FIRST: '' } : {}));
    const upMats = up.map(() => mat(UP_FRAG, { tSrc: { value: null }, tBase: { value: null }, uTexel: { value: new THREE.Vector2() }, uSpread: { value: 1 } }));

    const sunUv = new THREE.Vector2(0.5, 0.5);
    const raysMat = cfg.rays ? mat(RAYS_FRAG, {
        tDepth: { value: depthTex }, uSunUv: { value: sunUv }, uAspect: { value: 1 }, uStrength: { value: 0 }
    }) : null;

    const finalDefines = { USE_BLOOM: '' };
    if (cfg.rays) finalDefines.USE_RAYS = '';
    if (cfg.dof) finalDefines.USE_DOF = '';
    const finalMat = mat(FINAL_FRAG, {
        tLit: { value: litRT.texture }, tBloom: { value: null }, tBlurA: { value: null }, tBlurB: { value: null },
        tRays: { value: raysRT?.texture ?? null }, tDepth: { value: depthTex }, uProjInv: { value: projInv },
        uExposure: { value: 1 }, uBloom: { value: 0.1 }, uDofFocus: { value: 20 }, uDofRange: { value: 0 }, uDofMax: { value: 1 },
        uRayColor: { value: new THREE.Color() }, uSaturation: { value: 1 }, uContrast: { value: 1 },
        uLift: { value: params.lift }, uGain: { value: params.gain }, uSepia: { value: 0 },
        uVignette: { value: 0.3 }, uGrain: { value: 0.02 }, uTime: { value: 0 }, uFade: { value: 1 }
    }, finalDefines);

    const quad = new FullScreenQuad(composeMat);
    const pass = (material, target) => {
        quad.material = material;
        renderer.setRenderTarget(target);
        quad.render(renderer);
    };

    const size = new THREE.Vector2();
    const sunProj = new THREE.Vector3();
    let time = 0;

    function setSize() {
        renderer.getDrawingBufferSize(size);
        const w = Math.max(2, size.x | 0);
        const h = Math.max(2, size.y | 0);
        sceneRT.setSize(w, h);
        litRT.setSize(w, h);
        const hw = Math.max(1, w >> 1);
        const hh = Math.max(1, h >> 1);
        aoRT?.setSize(hw, hh);
        aoBlurRT?.setSize(hw, hh);
        raysRT?.setSize(Math.max(1, w >> 2), Math.max(1, h >> 2));
        texelFull.set(1 / w, 1 / h);
        texelHalf.set(1 / hw, 1 / hh);
        let cw = w;
        let ch = h;
        for (let i = 0; i < down.length; i++) {
            // uTexel = meio texel do alvo (kernel dual-kawase)
            cw = Math.max(1, cw >> 1);
            ch = Math.max(1, ch >> 1);
            down[i].setSize(cw, ch);
            downMats[i].uniforms.uTexel.value.set(0.5 / cw, 0.5 / ch);
            if (i < up.length) {
                up[i].setSize(cw, ch);
                upMats[i].uniforms.uTexel.value.set(0.5 / cw, 0.5 / ch);
            }
        }
    }

    function render(scene, camera, dt = 0.016) {
        time += dt;
        const prevAuto = renderer.autoClear;
        renderer.autoClear = true;
        renderer.setRenderTarget(sceneRT);
        renderer.render(scene, camera);

        proj.copy(camera.projectionMatrix);
        projInv.copy(camera.projectionMatrixInverse);
        viewProjInv.multiplyMatrices(camera.matrixWorld, camera.projectionMatrixInverse);
        camPos.setFromMatrixPosition(camera.matrixWorld);

        if (cfg.ao && params.ao > 0) {
            aoMat.uniforms.uRadius.value = params.aoRadius;
            pass(aoMat, aoRT);
            pass(aoBlurMat, aoBlurRT);
        }

        const cu = composeMat.uniforms;
        cu.uAo.value = params.ao;
        cu.uFogDensity.value = params.fogDensity;
        cu.uFogFalloff.value = params.fogFalloff;
        cu.uFogBase.value = params.fogBase;
        cu.uHaze.value = params.haze;
        cu.uFogMax.value = params.fogMax;
        cu.uFogSunGlow.value = params.fogSunGlow;
        if (sky) cu.uSunColor.value.copy(sky.lightColor).multiplyScalar(sky.lightIntensity * 0.5);
        pass(composeMat, litRT);

        // Bloom e profundidade de campo usam a mesma pirâmide de desfoque.
        const needsBlur = params.bloom !== 0 || (cfg.dof && params.dofRange > 0 && params.dofMax > 0);
        if (needsBlur) {
            let src = litRT.texture;
            for (let i = 0; i < down.length; i++) {
                downMats[i].uniforms.tSrc.value = src;
                pass(downMats[i], down[i]);
                src = down[i].texture;
            }
            for (let i = up.length - 1; i >= 0; i--) {
                upMats[i].uniforms.tSrc.value = i === up.length - 1 ? down[down.length - 1].texture : up[i + 1].texture;
                upMats[i].uniforms.tBase.value = down[i].texture;
                pass(upMats[i], up[i]);
            }
        }

        const fu = finalMat.uniforms;
        if (cfg.rays) {
            let strength = 0;
            if (sky) {
                sunProj.copy(sky.lightDir).multiplyScalar(1000).add(camPos).project(camera);
                const front = sunProj.z < 1;
                const off = Math.max(Math.abs(sunProj.x), Math.abs(sunProj.y));
                strength = front ? params.rays * Math.max(0, 1 - Math.max(0, off - 0.9) / 0.6) : 0;
                sunUv.set(sunProj.x * 0.5 + 0.5, sunProj.y * 0.5 + 0.5);
                fu.uRayColor.value.copy(sky.lightColor).multiplyScalar(sky.lightIntensity * 0.22);
            }
            if (strength > 0.001) {
                raysMat.uniforms.uAspect.value = size.x / size.y;
                raysMat.uniforms.uStrength.value = strength;
                pass(raysMat, raysRT);
            } else {
                fu.uRayColor.value.setScalar(0);
            }
        }

        fu.tBloom.value = needsBlur ? up[0].texture : litRT.texture;
        fu.tBlurA.value = needsBlur ? down[0].texture : litRT.texture;
        fu.tBlurB.value = needsBlur ? up[1].texture : litRT.texture;
        fu.uExposure.value = params.exposure;
        fu.uBloom.value = params.bloom;
        fu.uDofFocus.value = params.dofFocus;
        fu.uDofRange.value = params.dofRange;
        fu.uDofMax.value = params.dofMax;
        fu.uSaturation.value = params.saturation;
        fu.uContrast.value = params.contrast;
        fu.uSepia.value = params.sepia;
        fu.uVignette.value = params.vignette;
        fu.uGrain.value = params.grain;
        fu.uTime.value = time;
        fu.uFade.value = params.fade;
        pass(finalMat, null);
        renderer.autoClear = prevAuto;
    }

    function dispose() {
        [sceneRT, litRT, aoRT, aoBlurRT, raysRT, ...down, ...up].forEach((rt) => rt?.dispose());
        [aoMat, aoBlurMat, composeMat, raysMat, finalMat, ...downMats, ...upMats].forEach((m) => m?.dispose());
        depthTex.dispose();
        quad.dispose();
    }

    setSize();
    return { params, cfg, render, setSize, dispose, hdr };
}
