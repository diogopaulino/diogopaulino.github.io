/**
 * Shaders da coluna d'água: cúpula, areia com cáusticas, kelp, raios e medusa.
 * Ruído barato (hash senoidal) — o bastante para cáusticas vivas sem textura.
 */

export const NOISE = /* glsl */ `
float hash13(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
}
float noise3(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(mix(hash13(i), hash13(i + vec3(1,0,0)), f.x),
            mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), f.x), f.y),
        mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), f.x),
            mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), f.x), f.y),
        f.z);
}
float fbm(vec3 p) {
    float a = 0.5;
    float s = 0.0;
    for (int i = 0; i < 4; i++) {
        s += a * noise3(p);
        p = p * 2.07 + vec3(0.13, 0.27, 0.09);
        a *= 0.5;
    }
    return s;
}
float caustic(vec2 uv, float t) {
    vec3 p = vec3(uv * 3.2, t * 0.22);
    float a = fbm(p);
    float b = fbm(p + vec3(1.7, 4.2, t * 0.15));
    float c = abs(a - b);
    return smoothstep(0.02, 0.22, c) * (0.35 + 0.65 * a);
}
`;

export function waterDomeMaterial(THREE, uniforms) {
    return new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms,
        vertexShader: /* glsl */ `
            varying vec3 vDir;
            void main() {
                vec4 world = modelMatrix * vec4(position, 1.0);
                vDir = normalize(world.xyz - cameraPosition);
                gl_Position = projectionMatrix * viewMatrix * world;
            }
        `,
        fragmentShader: /* glsl */ `
            varying vec3 vDir;
            uniform vec3 uZenith;
            uniform vec3 uHorizon;
            uniform vec3 uSand;
            uniform float uTime;
            ${NOISE}
            void main() {
                vec3 d = normalize(vDir);
                float up = d.y * 0.5 + 0.5;
                vec3 col = mix(uZenith, uHorizon, pow(up, 1.35));
                col = mix(col, uSand * 0.35, smoothstep(0.42, 0.0, up));
                float rays = pow(max(d.y, 0.0), 4.0) * (0.35 + 0.65 * caustic(d.xz * 2.4, uTime));
                col += uHorizon * rays * 0.85;
                float mottled = fbm(d * 4.0 + vec3(0.0, uTime * 0.05, 0.0));
                col += uHorizon * mottled * 0.07;
                gl_FragColor = vec4(col, 1.0);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }
        `
    });
}

export function sandMaterial(THREE, uniforms) {
    return new THREE.ShaderMaterial({
        uniforms,
        vertexShader: /* glsl */ `
            varying vec3 vWorld;
            varying vec3 vNormalW;
            void main() {
                vec4 world = modelMatrix * vec4(position, 1.0);
                vWorld = world.xyz;
                vNormalW = normalize(mat3(modelMatrix) * normal);
                gl_Position = projectionMatrix * viewMatrix * world;
            }
        `,
        fragmentShader: /* glsl */ `
            varying vec3 vWorld;
            varying vec3 vNormalW;
            uniform vec3 uSand;
            uniform vec3 uGlowA;
            uniform vec3 uFog;
            uniform float uTime;
            uniform float uFogDensity;
            ${NOISE}
            void main() {
                float n = fbm(vWorld * 0.11);
                vec3 col = uSand * (0.55 + 0.45 * n);
                float cau = caustic(vWorld.xz * 0.08, uTime);
                col += uGlowA * cau * 0.55;
                float ridge = smoothstep(0.4, 0.8, n);
                col = mix(col, col * 0.55, ridge * 0.4);
                float ndl = 0.45 + 0.55 * max(dot(vNormalW, vec3(0.15, 1.0, 0.25)), 0.0);
                col *= ndl;
                float dist = length(vWorld - cameraPosition);
                float fog = 1.0 - exp(-uFogDensity * dist);
                col = mix(col, uFog, clamp(fog, 0.0, 1.0));
                gl_FragColor = vec4(col, 1.0);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }
        `
    });
}

export function stoneMaterial(THREE, uniforms) {
    return new THREE.ShaderMaterial({
        uniforms,
        vertexShader: /* glsl */ `
            varying vec3 vWorld;
            varying vec3 vNormalW;
            void main() {
                vec4 world = modelMatrix * vec4(position, 1.0);
                vWorld = world.xyz;
                vNormalW = normalize(mat3(modelMatrix) * normal);
                gl_Position = projectionMatrix * viewMatrix * world;
            }
        `,
        fragmentShader: /* glsl */ `
            varying vec3 vWorld;
            varying vec3 vNormalW;
            uniform vec3 uStone;
            uniform vec3 uGlowA;
            uniform vec3 uFog;
            uniform float uTime;
            uniform float uFogDensity;
            ${NOISE}
            void main() {
                float n = fbm(vWorld * 0.22);
                vec3 col = uStone * (0.7 + 0.4 * n);
                float cau = caustic(vWorld.xz * 0.12 + vWorld.y * 0.04, uTime);
                col += uGlowA * cau * 0.42;
                vec3 V = normalize(cameraPosition - vWorld);
                float fres = pow(1.0 - max(dot(normalize(vNormalW), V), 0.0), 3.0);
                col += uGlowA * fres * 0.18;
                float ndl = 0.35 + 0.65 * max(dot(normalize(vNormalW), vec3(0.2, 1.0, 0.3)), 0.0);
                col *= ndl;
                float dist = length(vWorld - cameraPosition);
                float fog = 1.0 - exp(-uFogDensity * dist);
                col = mix(col, uFog, clamp(fog, 0.0, 1.0));
                gl_FragColor = vec4(col, 1.0);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }
        `
    });
}

export function kelpMaterial(THREE, uniforms) {
    return new THREE.ShaderMaterial({
        uniforms,
        side: THREE.DoubleSide,
        vertexShader: /* glsl */ `
            varying vec3 vWorld;
            varying float vAlong;
            uniform float uTime;
            uniform float uSeed;
            void main() {
                vAlong = uv.y;
                vec3 p = position;
                float w = (1.0 - uv.y);
                p.x += sin(uTime * 1.4 + position.y * 0.45 + uSeed) * 0.55 * w;
                p.z += cos(uTime * 1.1 + position.y * 0.38 + uSeed * 1.7) * 0.4 * w;
                vec4 world = modelMatrix * vec4(p, 1.0);
                vWorld = world.xyz;
                gl_Position = projectionMatrix * viewMatrix * world;
            }
        `,
        fragmentShader: /* glsl */ `
            varying vec3 vWorld;
            varying float vAlong;
            uniform vec3 uGlowA;
            uniform vec3 uGlowB;
            uniform vec3 uFog;
            uniform float uFogDensity;
            void main() {
                vec3 col = mix(uGlowB * 0.25, uGlowA * 0.55, vAlong);
                col += uGlowA * pow(vAlong, 3.0) * 0.4;
                float dist = length(vWorld - cameraPosition);
                float fog = 1.0 - exp(-uFogDensity * dist);
                col = mix(col, uFog, clamp(fog, 0.0, 1.0));
                gl_FragColor = vec4(col, 1.0);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }
        `
    });
}

export function jellyMaterial(THREE, uniforms) {
    return new THREE.ShaderMaterial({
        uniforms,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        vertexShader: /* glsl */ `
            varying vec3 vNormalW;
            varying vec3 vWorld;
            varying vec3 vObj;
            uniform float uPulse;
            void main() {
                vec3 p = position * mix(1.0, 1.12, uPulse);
                p.y *= mix(1.0, 0.86, uPulse);
                vObj = p;
                vec4 world = modelMatrix * vec4(p, 1.0);
                vWorld = world.xyz;
                vNormalW = normalize(mat3(modelMatrix) * normal);
                gl_Position = projectionMatrix * viewMatrix * world;
            }
        `,
        fragmentShader: /* glsl */ `
            varying vec3 vNormalW;
            varying vec3 vWorld;
            varying vec3 vObj;
            uniform vec3 uJelly;
            uniform vec3 uGlowA;
            uniform float uPulse;
            uniform float uHit;
            void main() {
                vec3 N = normalize(vNormalW);
                vec3 V = normalize(cameraPosition - vWorld);
                float fres = pow(1.0 - max(dot(N, V), 0.0), 2.2);
                float veins = sin(vObj.x * 18.0) * sin(vObj.z * 16.0) * 0.5 + 0.5;
                vec3 col = mix(uJelly, uGlowA, 0.35 + 0.45 * uPulse);
                col = mix(col, vec3(1.0, 0.45, 0.55), uHit);
                col += uGlowA * fres * (0.85 + uPulse);
                col += uJelly * veins * 0.18;
                float alpha = 0.22 + fres * 0.65 + uPulse * 0.12;
                gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.92));
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }
        `
    });
}

export function rayMaterial(THREE, uniforms) {
    return new THREE.ShaderMaterial({
        uniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        vertexShader: /* glsl */ `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: /* glsl */ `
            varying vec2 vUv;
            uniform vec3 uHorizon;
            uniform float uTime;
            uniform float uGain;
            void main() {
                float shaft = smoothstep(0.0, 0.15, vUv.x) * smoothstep(1.0, 0.85, vUv.x);
                shaft *= pow(1.0 - vUv.y, 1.4);
                float flicker = 0.75 + 0.25 * sin(uTime * 0.7 + vUv.y * 4.0);
                vec3 col = uHorizon * shaft * flicker * uGain;
                gl_FragColor = vec4(col, shaft * 0.22 * flicker * uGain);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }
        `
    });
}

export function planktonMaterial(THREE, uniforms) {
    return new THREE.ShaderMaterial({
        uniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
            attribute float aSize;
            attribute float aSeed;
            uniform float uTime;
            uniform float uScale;
            varying float vAlpha;
            varying float vSeed;
            void main() {
                vSeed = aSeed;
                vec3 p = position;
                p.x += sin(uTime * 0.35 + aSeed * 12.0) * 0.8;
                p.y += cos(uTime * 0.22 + aSeed * 9.0) * 0.5;
                vec4 mv = modelViewMatrix * vec4(p, 1.0);
                gl_PointSize = aSize * uScale / max(0.001, -mv.z);
                vAlpha = smoothstep(90.0, 12.0, -mv.z);
                gl_Position = projectionMatrix * mv;
            }
        `,
        fragmentShader: /* glsl */ `
            varying float vAlpha;
            varying float vSeed;
            uniform vec3 uGlowA;
            uniform vec3 uGlowB;
            void main() {
                vec2 p = gl_PointCoord * 2.0 - 1.0;
                float d = dot(p, p);
                if (d > 1.0) discard;
                float glow = exp(-d * 3.4);
                vec3 col = mix(uGlowA, uGlowB, fract(vSeed * 7.13));
                gl_FragColor = vec4(col, glow * vAlpha * 0.55);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }
        `
    });
}
