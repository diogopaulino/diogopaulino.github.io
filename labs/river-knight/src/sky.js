/**
 * Céu procedural.
 *
 * Um domo com shader próprio desenha gradiente, sol, halo e nuvens em fBm.
 * A mesma função `rkSky(dir)` é reaproveitada pelo shader da água para gerar
 * o reflexo — assim reflexo e céu nunca divergem, e não é preciso pagar por
 * um render target de reflexão.
 */

import * as THREE from 'three';
import { SKY_STOPS } from './config.js?v=14';

export const SKY_GLSL = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGround;
uniform vec3 uSunColor;
uniform vec3 uSunDir;
uniform float uSunPower;

vec3 rkSky(vec3 dir) {
    float h = dir.y;
    float t = clamp(h * 1.25 + 0.05, 0.0, 1.0);
    vec3 col = mix(uHorizon, uZenith, pow(t, 0.62));

    // Bruma sobre o horizonte e "solo" refletido abaixo dele.
    col = mix(uGround, col, smoothstep(-0.10, 0.035, h));

    float sd = max(dot(normalize(dir), uSunDir), 0.0);
    col += uSunColor * pow(sd, 4.0) * 0.09;    // clarão amplo
    col += uSunColor * pow(sd, 64.0) * 0.30;   // halo
    col += uSunColor * pow(sd, 900.0) * 0.9;   // borda do disco
    col += uSunColor * smoothstep(0.9994, 0.99985, sd) * uSunPower; // disco

    return col;
}
`;

const NOISE_GLSL = /* glsl */ `
float rkHash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float rkValueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = rkHash(i);
    float b = rkHash(i + vec2(1.0, 0.0));
    float c = rkHash(i + vec2(0.0, 1.0));
    float d = rkHash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float rkFbm(vec2 p) {
    float v = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 5; i++) {
        v += amp * rkValueNoise(p);
        p = p * 2.03 + 17.3;
        amp *= 0.5;
    }
    return v;
}
`;

/** Uniforms compartilhados entre céu, água e névoa. */
export function createSkyUniforms() {
    const stop = SKY_STOPS[0];
    return {
        uZenith: { value: new THREE.Color().fromArray(stop.zenith) },
        uHorizon: { value: new THREE.Color().fromArray(stop.horizon) },
        uGround: { value: new THREE.Color().fromArray(stop.ground) },
        uSunColor: { value: new THREE.Color().fromArray(stop.sun) },
        uSunDir: { value: new THREE.Vector3().fromArray(stop.sunDir).normalize() },
        uSunPower: { value: 22 }
    };
}

const tmpColorA = new THREE.Color();
const tmpColorB = new THREE.Color();
const tmpVecA = new THREE.Vector3();
const tmpVecB = new THREE.Vector3();

/**
 * Interpola a paleta do céu conforme o progresso da corrida (0 → 1).
 * Retorna um objeto reutilizável com cores e direção do sol.
 */
const paletteOut = {
    zenith: new THREE.Color(),
    horizon: new THREE.Color(),
    ground: new THREE.Color(),
    sun: new THREE.Color(),
    fog: new THREE.Color(),
    light: new THREE.Color(),
    ambient: new THREE.Color(),
    sunDir: new THREE.Vector3(),
    lightIntensity: 2
};

export function sampleSkyPalette(progress) {
    const p = Math.max(0, Math.min(1, progress));
    let a = SKY_STOPS[0];
    let b = SKY_STOPS[SKY_STOPS.length - 1];

    for (let i = 0; i < SKY_STOPS.length - 1; i++) {
        if (p >= SKY_STOPS[i].at && p <= SKY_STOPS[i + 1].at) {
            a = SKY_STOPS[i];
            b = SKY_STOPS[i + 1];
            break;
        }
    }

    const span = Math.max(1e-5, b.at - a.at);
    const t = Math.max(0, Math.min(1, (p - a.at) / span));

    const lerpColor = (key, out) => {
        tmpColorA.fromArray(a[key]);
        tmpColorB.fromArray(b[key]);
        out.copy(tmpColorA).lerp(tmpColorB, t);
    };

    lerpColor('zenith', paletteOut.zenith);
    lerpColor('horizon', paletteOut.horizon);
    lerpColor('ground', paletteOut.ground);
    lerpColor('sun', paletteOut.sun);
    lerpColor('fog', paletteOut.fog);
    lerpColor('light', paletteOut.light);
    lerpColor('ambient', paletteOut.ambient);

    tmpVecA.fromArray(a.sunDir);
    tmpVecB.fromArray(b.sunDir);
    paletteOut.sunDir.copy(tmpVecA).lerp(tmpVecB, t).normalize();
    paletteOut.lightIntensity = a.lightIntensity + (b.lightIntensity - a.lightIntensity) * t;

    return paletteOut;
}

/** Copia a paleta interpolada para os uniforms compartilhados. */
export function applySkyPalette(uniforms, palette) {
    uniforms.uZenith.value.copy(palette.zenith);
    uniforms.uHorizon.value.copy(palette.horizon);
    uniforms.uGround.value.copy(palette.ground);
    uniforms.uSunColor.value.copy(palette.sun);
    uniforms.uSunDir.value.copy(palette.sunDir);
}

/** Domo do céu (esfera invertida gigante que acompanha a câmera). */
export function createSky(uniforms) {
    const material = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
            ...uniforms,
            uTime: { value: 0 },
            uCloud: { value: 0.55 }
        },
        vertexShader: /* glsl */ `
            varying vec3 vDir;
            void main() {
                vDir = position;
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_Position = projectionMatrix * mvPosition;
                gl_Position.z = gl_Position.w; // sempre no fundo
            }
        `,
        fragmentShader: /* glsl */ `
            varying vec3 vDir;
            uniform float uTime;
            uniform float uCloud;
            ${SKY_GLSL}
            ${NOISE_GLSL}

            void main() {
                vec3 dir = normalize(vDir);
                vec3 col = rkSky(dir);

                // Nuvens: projeção das direções em um plano alto.
                float up = max(dir.y, 0.015);
                vec2 cp = dir.xz / up;
                vec2 drift = vec2(uTime * 0.0065, uTime * 0.0022);
                float clouds = rkFbm(cp * 0.48 + drift);
                float wisps = rkFbm(cp * 1.15 + drift * 1.4 + 8.2);
                clouds = smoothstep(0.38, 0.88, clouds) * uCloud;
                clouds += smoothstep(0.55, 0.95, wisps) * uCloud * 0.35;
                clouds *= smoothstep(0.0, 0.18, dir.y);
                clouds = clamp(clouds, 0.0, 1.0);

                float sunFacing = max(dot(dir, uSunDir), 0.0);
                vec3 cloudLit = mix(uHorizon * 0.85, uSunColor, pow(sunFacing, 2.0) * 0.7);
                vec3 cloudShadow = mix(uZenith * 0.7, uHorizon * 0.45, 0.5);
                vec3 cloudCol = mix(cloudShadow, cloudLit, clamp(clouds * 1.6, 0.0, 1.0));

                col = mix(col, cloudCol, clouds * 0.85);

                // Estrelas tênues no zênite quando escurece.
                float night = clamp(1.0 - length(uHorizon) * 0.9, 0.0, 1.0);
                float stars = step(0.9975, rkHash(floor(dir.xz * 420.0 / max(dir.y, 0.25))));
                col += vec3(0.9, 0.95, 1.0) * stars * night * smoothstep(0.15, 0.6, dir.y);

                gl_FragColor = vec4(col, 1.0);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }
        `
    });

    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), material);
    mesh.scale.setScalar(4000);
    mesh.frustumCulled = false;
    mesh.renderOrder = -1000;
    mesh.name = 'sky';
    return mesh;
}

export { NOISE_GLSL };
