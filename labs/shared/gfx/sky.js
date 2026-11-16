/**
 * gfx/sky — atmosfera física (espalhamento Rayleigh + Mie, modelo de Preetham),
 * sol, lua, estrelas e nuvens procedurais iluminadas.
 *
 * Fórmulas (Preetham et al. 1999, mesma base do Sky do three.js):
 *   massa de ar relativa  m(θ) = 1 / (cos θ + 0.15 · (93.885 − θ°)^−1.253)
 *   extinção              Fex  = exp(−(βR·8400·m + βM·1250·m))
 *   fase Rayleigh         3/(16π) · (1 + cos²γ)
 *   fase Mie (H-G)        1/(4π) · (1 − g²) / (1 − 2g·cosγ + g²)^1.5
 *   radiância             Lin  = (E☉ · (βRγ + βMγ)/(βR + βM) · (1 − Fex))^1.5
 *
 * O céu também é assado num LUT equiretangular HDR (512×256) usado por:
 *   - reflexo/neblina (oceano e pós-processamento amostram o LUT, 1 fetch);
 *   - PMREM → scene.environment (IBL coerente com a hora do dia).
 *
 * Posição do sol: astronomia básica para a latitude de Santos (−23,96°):
 *   sin(el) = sin φ · sin δ + cos φ · cos δ · cos H,  H = (hora − 12) · 15°
 */
import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { clamp, smoothstep, fbm2 } from './core.js';

const SANTOS_LAT = THREE.MathUtils.degToRad(-23.96);

const TOTAL_RAYLEIGH = new THREE.Vector3(5.804542996261093e-6, 1.3562911419845635e-5, 3.0265902468824876e-5);
const MIE_CONST = new THREE.Vector3(1.8399918514433978e14, 2.7798023919660528e14, 4.0790479543861094e14);

/** GLSL compartilhado: amostragem do LUT de céu (equiretangular). */
export const GLSL_SKY_LUT = /* glsl */ `
uniform sampler2D uSkyLut;
vec3 gfxSkyLut(vec3 d) {
    vec2 uv = vec2(atan(d.z, d.x) * 0.15915494 + 0.5, asin(clamp(d.y, -1.0, 1.0)) * 0.31830989 + 0.5);
    return texture2D(uSkyLut, uv).rgb;
}
`;

const GLSL_ATMOSPHERE = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uMoonDir;
uniform vec3 uBetaR;
uniform vec3 uBetaM;
uniform float uSunE;
uniform float uSunFade;
uniform float uMieG;
uniform float uNight;
uniform float uSkyGain;
uniform float uSkyCurve;
uniform vec3 uNightTint;
uniform vec3 uGlowColor;
uniform sampler2D uNoiseTex;
uniform float uCloudCover;
uniform vec2 uCloudOffset;
uniform vec3 uCloudLit;
uniform vec3 uCloudShade;

const float GFX_PI = 3.141592653589793;

vec3 gfxAtmosphere(vec3 dir) {
    float up = max(dir.y, 0.0);
    float zenithAngle = acos(up);
    float inv = 1.0 / (cos(zenithAngle) + 0.15 * pow(93.885 - zenithAngle * 180.0 / GFX_PI, -1.253));
    float sR = 8.4e3 * inv;
    float sM = 1.25e3 * inv;
    vec3 Fex = exp(-(uBetaR * sR + uBetaM * sM));
    float cosTheta = dot(dir, uSunDir);
    float rPhase = 0.05968310365946075 * (1.0 + pow(cosTheta * 0.5 + 0.5, 2.0));
    vec3 betaRTheta = uBetaR * rPhase;
    float g2 = uMieG * uMieG;
    float mPhase = 0.07957747154594767 * ((1.0 - g2) / pow(1.0 - 2.0 * uMieG * cosTheta + g2, 1.5));
    vec3 betaMTheta = uBetaM * mPhase;
    vec3 ratio = (betaRTheta + betaMTheta) / (uBetaR + uBetaM);
    vec3 Lin = pow(uSunE * ratio * (1.0 - Fex), vec3(1.5));
    Lin *= mix(vec3(1.0), pow(uSunE * ratio * Fex, vec3(0.5)), clamp(pow(1.0 - uSunDir.y, 5.0), 0.0, 1.0));
    vec3 L0 = vec3(0.1) * Fex;
    vec3 tex = (Lin + L0) * 0.04 + vec3(0.0, 0.0003, 0.00075);
    vec3 day = pow(pow(tex, vec3(1.0 / (1.2 + 1.2 * uSunFade))), vec3(uSkyCurve)) * uSkyGain;

    // Noite: gradiente frio + brilho da lua + poluição luminosa da cidade no horizonte
    float moon = max(dot(dir, uMoonDir), 0.0);
    vec3 night = uNightTint * (0.55 + 0.9 * pow(1.0 - up, 3.0));
    night += vec3(0.10, 0.13, 0.19) * (pow(moon, 6.0) * 0.35 + pow(moon, 90.0) * 0.9);
    night += uGlowColor * pow(1.0 - up, 6.0);
    return day + night * uNight;
}

float gfxCloudNoise(vec2 uv) {
    float n = texture2D(uNoiseTex, uv).r * 0.5;
    n += texture2D(uNoiseTex, uv * 2.13 + 0.37).r * 0.26;
    n += texture2D(uNoiseTex, uv * 4.71 + 0.11).r * 0.14;
    n += texture2D(uNoiseTex, uv * 9.37 + 0.63).r * 0.10;
    return n;
}

float gfxCloudDensity(vec2 uv) {
    float n = gfxCloudNoise(uv);
    float big = texture2D(uNoiseTex, uv * 0.31 + 0.5).r;
    float cover = uCloudCover * (0.55 + 0.9 * big);
    return smoothstep(1.0 - cover, 1.0 - cover + 0.32, n);
}

// rgb = cor pré-multiplicada, a = opacidade
vec4 gfxClouds(vec3 dir) {
    if (dir.y < 0.012 || uCloudCover <= 0.001) return vec4(0.0);
    vec2 uv = dir.xz / (dir.y + 0.11) * 0.11 + uCloudOffset;
    float d = gfxCloudDensity(uv);
    if (d <= 0.001) return vec4(0.0);
    // auto-sombreamento: densidade na direção da luz
    vec3 L = mix(uSunDir, uMoonDir, uNight);
    vec2 ls = normalize(L.xz + 1e-4) * 0.035 * (1.2 - L.y);
    float d2 = gfxCloudDensity(uv + ls);
    float d3 = gfxCloudDensity(uv + ls * 2.2);
    float shade = exp(-(d2 * 1.5 + d3 * 0.9));
    float mu = max(dot(dir, L), 0.0);
    vec3 col = mix(uCloudShade, uCloudLit, shade * (0.55 + 0.45 * (1.0 - d)));
    col += uCloudLit * pow(mu, 10.0) * (1.0 - d) * 0.9; // contorno prateado
    float a = d * smoothstep(0.012, 0.16, dir.y);
    return vec4(col * a, a);
}
`;

function atmosphereCPU(dir, u, out) {
    const up = Math.max(dir.y, 0);
    const zen = Math.acos(up);
    const inv = 1 / (Math.cos(zen) + 0.15 * Math.pow(93.885 - (zen * 180) / Math.PI, -1.253));
    const sR = 8.4e3 * inv;
    const sM = 1.25e3 * inv;
    const cosT = dir.dot(u.uSunDir.value);
    const rPhase = 0.05968310365946075 * (1 + Math.pow(cosT * 0.5 + 0.5, 2));
    const g = u.uMieG.value;
    const mPhase = 0.07957747154594767 * ((1 - g * g) / Math.pow(1 - 2 * g * cosT + g * g, 1.5));
    const sunE = u.uSunE.value;
    const fade = u.uSunFade.value;
    const bR = u.uBetaR.value;
    const bM = u.uBetaM.value;
    const mixK = clamp(Math.pow(1 - u.uSunDir.value.y, 5), 0, 1);
    const res = [0, 0, 0];
    const comps = ['x', 'y', 'z'];
    const add = [0, 0.0003, 0.00075];
    for (let i = 0; i < 3; i++) {
        const c = comps[i];
        const fex = Math.exp(-(bR[c] * sR + bM[c] * sM));
        const ratio = (bR[c] * rPhase + bM[c] * mPhase) / (bR[c] + bM[c]);
        let lin = Math.pow(Math.max(0, sunE * ratio * (1 - fex)), 1.5);
        lin *= 1 + (Math.sqrt(Math.max(0, sunE * ratio * fex)) - 1) * mixK;
        const tex = (lin + 0.1 * fex) * 0.04 + add[i];
        res[i] = Math.pow(Math.pow(tex, 1 / (1.2 + 1.2 * fade)), u.uSkyCurve.value) * u.uSkyGain.value;
    }
    const n = u.uNight.value;
    const nt = u.uNightTint.value;
    const k = 0.55 + 0.9 * Math.pow(1 - up, 3);
    out.setRGB(res[0] + nt.r * k * n, res[1] + nt.g * k * n, res[2] + nt.b * k * n);
    return out;
}

function makeNoiseTexture(size = 256) {
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const u = (x / size) * 8;
            const v = (y / size) * 8;
            const n = fbm2(u, v, 4, 8, 11);
            const m = fbm2(u * 2, v * 2, 3, 16, 53);
            const o = (y * size + x) * 4;
            data[o] = clamp(n * 1.35 - 0.12, 0, 1) * 255;
            data[o + 1] = m * 255;
            data[o + 2] = fbm2(u * 4, v * 4, 2, 32, 97) * 255;
            data[o + 3] = 255;
        }
    }
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.needsUpdate = true;
    return tex;
}

/**
 * @param {object} o
 * @param {THREE.WebGLRenderer} o.renderer
 * @param {THREE.Scene} o.scene           recebe o domo e o environment
 * @param {THREE.Vector3} [o.north]       vetor norte no mundo
 * @param {THREE.Vector3} [o.east]        vetor leste no mundo
 * @param {number} [o.declination]        declinação solar em graus (−23.4 verão austral … +23.4 inverno)
 * @param {number} [o.turbidity] [o.rayleigh] [o.mie] [o.mieG] [o.cloudCover]
 */
export function createSky({
    renderer,
    scene,
    north = new THREE.Vector3(0, 0, -1),
    east = new THREE.Vector3(1, 0, 0),
    declination = -12,
    turbidity = 2.6,
    rayleigh = 2.4,
    mie = 0.004,
    mieG = 0.8,
    cloudCover = 0.42,
    glow = 0x000000,
    ground = 0x3a4038,
    envIntensity = 1.0
} = {}) {
    const noiseTex = makeNoiseTexture();
    const lutRT = new THREE.WebGLRenderTarget(512, 256, {
        type: THREE.HalfFloatType,
        format: THREE.RGBAFormat,
        depthBuffer: false,
        magFilter: THREE.LinearFilter,
        minFilter: THREE.LinearFilter,
        wrapS: THREE.RepeatWrapping,
        wrapT: THREE.ClampToEdgeWrapping,
        colorSpace: THREE.LinearSRGBColorSpace
    });
    lutRT.texture.mapping = THREE.EquirectangularReflectionMapping;

    const uniforms = {
        uSunDir: { value: new THREE.Vector3(0.3, 0.8, -0.5).normalize() },
        uMoonDir: { value: new THREE.Vector3(-0.4, 0.6, 0.5).normalize() },
        uBetaR: { value: new THREE.Vector3() },
        uBetaM: { value: new THREE.Vector3() },
        uSunE: { value: 1000 },
        uSunFade: { value: 1 },
        uMieG: { value: mieG },
        uNight: { value: 0 },
        uSkyGain: { value: 0.16 },
        uSkyCurve: { value: 1.5 },
        uNightTint: { value: new THREE.Color(0.012, 0.02, 0.042) },
        uGlowColor: { value: new THREE.Color(glow) },
        uNoiseTex: { value: noiseTex },
        uCloudCover: { value: cloudCover },
        uCloudOffset: { value: new THREE.Vector2() },
        uCloudLit: { value: new THREE.Color(1, 1, 1) },
        uCloudShade: { value: new THREE.Color(0.4, 0.45, 0.55) },
        uSkyLut: { value: lutRT.texture },
        uTime: { value: 0 },
        uGroundColor: { value: new THREE.Color(ground) }
    };

    // ---------- domo ----------
    const domeMat = new THREE.ShaderMaterial({
        name: 'gfxSkyDome',
        side: THREE.BackSide,
        depthWrite: false,
        depthFunc: THREE.LessEqualDepth,
        fog: false,
        uniforms,
        vertexShader: /* glsl */ `
            varying vec3 vDir;
            void main() {
                vDir = position;
                vec4 p = projectionMatrix * viewMatrix * vec4(position * 100.0 + cameraPosition, 1.0);
                gl_Position = p.xyww; // sempre no plano distante
            }
        `,
        fragmentShader: /* glsl */ `
            ${GLSL_ATMOSPHERE}
            uniform float uTime;
            uniform vec3 uGroundColor;
            varying vec3 vDir;

            float hash3(vec3 p) {
                p = fract(p * 0.3183099 + 0.1);
                p *= 17.0;
                return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
            }

            void main() {
                vec3 dir = normalize(vDir);
                vec3 col = gfxAtmosphere(dir);

                // disco solar com escurecimento de limbo
                float mu = dot(dir, uSunDir);
                float disk = smoothstep(0.99990, 0.99996, mu);
                float sunVis = smoothstep(-0.03, 0.02, uSunDir.y);
                vec3 sunCol = uCloudLit * 60.0;
                col += sunCol * disk * sunVis;

                // lua (fase simples) + estrelas
                if (uNight > 0.01) {
                    float mm = dot(dir, uMoonDir);
                    float md = smoothstep(0.99975, 0.99985, mm);
                    vec3 mx = normalize(cross(uMoonDir, vec3(0.0, 1.0, 0.0)));
                    vec3 my = cross(mx, uMoonDir);
                    vec2 mp = vec2(dot(dir, mx), dot(dir, my)) / 0.0222;
                    float crater = texture2D(uNoiseTex, mp * 0.35 + 0.5).g;
                    float phase = smoothstep(-0.55, 0.35, mp.x + 0.2);
                    col += vec3(0.95, 0.93, 0.85) * md * (0.55 + 0.6 * crater) * phase * 2.4 * uNight;

                    vec3 sp = dir * 190.0;
                    vec3 cell = floor(sp);
                    float h = hash3(cell);
                    float star = smoothstep(0.988, 1.0, h) * smoothstep(0.42, 0.0, length(fract(sp) - 0.5));
                    float tw = 0.7 + 0.3 * sin(uTime * (2.0 + h * 5.0) + h * 40.0);
                    vec3 sc = mix(vec3(0.75, 0.85, 1.0), vec3(1.0, 0.9, 0.75), fract(h * 31.0));
                    col += sc * star * tw * 1.6 * uNight * smoothstep(0.0, 0.25, dir.y) * (1.0 - md);
                }

                vec4 cl = gfxClouds(dir);
                col = col * (1.0 - cl.a) + cl.rgb;

                // abaixo do horizonte: tom de chão/neblina (quase nunca visível)
                col = mix(col, uGroundColor * (0.35 + 0.65 * (1.0 - uNight)), smoothstep(0.0, -0.06, dir.y));
                gl_FragColor = vec4(col, 1.0);
            }
        `
    });
    const dome = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 3), domeMat);
    dome.frustumCulled = false;
    dome.renderOrder = 900;
    dome.name = 'gfxSky';
    scene?.add(dome);

    // ---------- LUT ----------
    const lutMat = new THREE.ShaderMaterial({
        name: 'gfxSkyLut',
        uniforms,
        depthTest: false,
        depthWrite: false,
        vertexShader: /* glsl */ `
            varying vec2 vUv;
            void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
        `,
        fragmentShader: /* glsl */ `
            ${GLSL_ATMOSPHERE}
            uniform vec3 uGroundColor;
            varying vec2 vUv;
            void main() {
                float phi = (vUv.x - 0.5) * 6.283185307;
                float el = (vUv.y - 0.5) * 3.141592653589793;
                vec3 dir = vec3(cos(el) * cos(phi), sin(el), cos(el) * sin(phi));
                vec3 skyDir = normalize(vec3(dir.x, max(dir.y, 0.0), dir.z));
                vec3 col = gfxAtmosphere(skyDir);
                vec4 cl = gfxClouds(skyDir);
                col = col * (1.0 - cl.a) + cl.rgb;
                // hemisfério inferior: rebote do chão, tingido pelo céu do horizonte
                vec3 gnd = uGroundColor * (dot(col, vec3(0.333)) * 1.1 + 0.02);
                col = mix(col, gnd, smoothstep(0.0, -0.12, dir.y));
                gl_FragColor = vec4(col, 1.0);
            }
        `
    });
    const lutQuad = new FullScreenQuad(lutMat);

    const pmrem = new THREE.PMREMGenerator(renderer);
    let envRT = null;

    const atm = { turbidity, rayleigh, mie };
    const state = {
        hour: 15,
        declination,
        dirty: true,
        envDirty: true,
        envCooldown: 0
    };

    const sunDir = uniforms.uSunDir.value;
    const moonDir = uniforms.uMoonDir.value;
    const lightDir = new THREE.Vector3();
    const lightColor = new THREE.Color();
    const zenithColor = new THREE.Color();
    const horizonColor = new THREE.Color();
    const tmpV = new THREE.Vector3();
    const tmpC = new THREE.Color();
    let lightIntensity = 3;
    let daylight = 1;

    function recompute() {
        const sunY = sunDir.y;
        // E☉ com corte suave no horizonte (Preetham)
        const zenCos = clamp(sunY, -1, 1);
        uniforms.uSunE.value = 1000 * Math.max(0, 1 - Math.exp(-((1.6110731556870734 - Math.acos(zenCos)) / 1.5)));
        const fade = 1 - clamp(1 - Math.exp(sunY), 0, 1);
        uniforms.uSunFade.value = fade;
        const rayleighCoeff = atm.rayleigh - (1 - fade);
        uniforms.uBetaR.value.copy(TOTAL_RAYLEIGH).multiplyScalar(rayleighCoeff);
        const c = 0.2 * atm.turbidity * 10e-18;
        uniforms.uBetaM.value.copy(MIE_CONST).multiplyScalar(0.434 * c * atm.mie);
        uniforms.uNight.value = smoothstep(0.06, -0.14, sunY);

        // lua oposta ao sol, sempre visível à noite
        moonDir.set(-sunDir.x, 0, -sunDir.z);
        if (moonDir.lengthSq() < 1e-4) moonDir.set(0.3, 0, 0.7);
        moonDir.normalize().multiplyScalar(0.78);
        moonDir.y = 0.62;
        moonDir.normalize();

        // cor do sol direto = extinção ao longo do caminho óptico
        const up = Math.max(sunY, 0.0);
        const zen = Math.acos(up);
        const inv = 1 / (Math.cos(zen) + 0.15 * Math.pow(93.885 - (zen * 180) / Math.PI, -1.253));
        const bR = uniforms.uBetaR.value;
        const bM = uniforms.uBetaM.value;
        const fx = Math.exp(-(bR.x * 8400 * inv + bM.x * 1250 * inv));
        const fy = Math.exp(-(bR.y * 8400 * inv + bM.y * 1250 * inv));
        const fz = Math.exp(-(bR.z * 8400 * inv + bM.z * 1250 * inv));
        const mx = Math.max(fx, fy, fz, 1e-4);
        const sunVis = smoothstep(-0.05, 0.1, sunY);
        const sunStrength = sunVis * (0.35 + 0.65 * Math.pow(mx, 0.35));
        const moonStrength = uniforms.uNight.value * 0.07;
        daylight = sunVis;

        if (sunStrength >= moonStrength) {
            lightDir.copy(sunDir);
            lightColor.setRGB(Math.pow(fx / mx, 0.3), Math.pow(fy / mx, 0.3), Math.pow(fz / mx, 0.3));
            lightIntensity = 3.6 * sunStrength;
        } else {
            lightDir.copy(moonDir);
            lightColor.setRGB(0.62, 0.74, 1.0);
            lightIntensity = 3.6 * moonStrength;
        }

        tmpV.set(0, 1, 0);
        atmosphereCPU(tmpV, uniforms, zenithColor);
        tmpV.set(-sunDir.x, 0.06, -sunDir.z).normalize();
        atmosphereCPU(tmpV, uniforms, horizonColor);

        // nuvens: lado iluminado = sol direto + céu; sombra = céu zenital
        tmpC.copy(lightColor).multiplyScalar(lightIntensity * 0.42);
        uniforms.uCloudLit.value.copy(tmpC).add(tmpC.copy(horizonColor).multiplyScalar(0.55));
        uniforms.uCloudShade.value.copy(zenithColor).multiplyScalar(0.55).add(tmpC.copy(horizonColor).multiplyScalar(0.22));

        state.dirty = true;
        state.envDirty = true;
    }

    function bake() {
        const prev = renderer.getRenderTarget();
        renderer.setRenderTarget(lutRT);
        lutQuad.render(renderer);
        renderer.setRenderTarget(prev);
        state.dirty = false;
    }

    function bakeEnvironment() {
        const next = pmrem.fromEquirectangular(lutRT.texture);
        if (scene) {
            scene.environment = next.texture;
            scene.environmentIntensity = envIntensity;
        }
        envRT?.dispose();
        envRT = next;
        state.envDirty = false;
    }

    const api = {
        uniforms,
        atm,
        refresh: () => recompute(),
        dome,
        lut: lutRT.texture,
        sunDir,
        moonDir,
        lightDir,
        lightColor,
        zenithColor,
        horizonColor,
        get lightIntensity() { return lightIntensity; },
        get daylight() { return daylight; },
        get night() { return uniforms.uNight.value; },
        get hour() { return state.hour; },
        get environment() { return envRT?.texture ?? null; },

        /** Define o sol por elevação/azimute (radianos; azimute a partir do norte, sentido leste). */
        setSun(elevation, azimuth) {
            const ce = Math.cos(elevation);
            sunDir.set(0, 0, 0)
                .addScaledVector(north, ce * Math.cos(azimuth))
                .addScaledVector(east, ce * Math.sin(azimuth));
            sunDir.y = Math.sin(elevation);
            sunDir.normalize();
            recompute();
        },

        /** Hora local solar (0–24) → posição astronômica do sol em Santos. */
        setHour(hour) {
            state.hour = ((hour % 24) + 24) % 24;
            const dec = THREE.MathUtils.degToRad(state.declination);
            const H = THREE.MathUtils.degToRad((state.hour - 12) * 15);
            const sinEl = Math.sin(SANTOS_LAT) * Math.sin(dec) + Math.cos(SANTOS_LAT) * Math.cos(dec) * Math.cos(H);
            const el = Math.asin(clamp(sinEl, -1, 1));
            let cosAz = (Math.sin(dec) - sinEl * Math.sin(SANTOS_LAT)) / (Math.cos(el) * Math.cos(SANTOS_LAT) || 1e-6);
            let az = Math.acos(clamp(cosAz, -1, 1));
            if (H > 0) az = Math.PI * 2 - az;
            api.setSun(el, az);
        },

        setClouds(cover) {
            uniforms.uCloudCover.value = cover;
            state.dirty = true;
            state.envDirty = true;
        },

        /** Chamar todo frame. Reassa LUT/ambiente apenas quando algo mudou. */
        update(t, dt = 0.016) {
            uniforms.uTime.value = t;
            uniforms.uCloudOffset.value.set(t * 0.0016, t * 0.0007);
            state.envCooldown -= dt;
            if (state.dirty) bake();
            if (state.envDirty && state.envCooldown <= 0) {
                if (state.dirty) bake();
                bakeEnvironment();
                state.envCooldown = 0.35;
            }
        },

        /** Força LUT + IBL imediatamente (use no boot, antes de compilar shaders). */
        flush() {
            bake();
            bakeEnvironment();
        },

        dispose() {
            lutRT.dispose();
            envRT?.dispose();
            pmrem.dispose();
            noiseTex.dispose();
            dome.geometry.dispose();
            domeMat.dispose();
            lutMat.dispose();
        }
    };

    api.setHour(state.hour);
    return api;
}
