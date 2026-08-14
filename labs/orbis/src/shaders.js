/**
 * Shaders GLSL compartilhados do Orbis.
 *
 * Ruído 3D em value-noise interpolado + FBM / ridged, usados para
 * continentes, faixas de gigantes, granulação estelar e nébula.
 */
export const NOISE_GLSL = /* glsl */ `
vec3 hash3(vec3 p) {
    p = vec3(
        dot(p, vec3(127.1, 311.7, 74.7)),
        dot(p, vec3(269.5, 183.3, 246.1)),
        dot(p, vec3(113.5, 271.9, 124.6))
    );
    return fract(sin(p) * 43758.5453123);
}

float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(mix(hash(i), hash(i + vec3(1.0, 0.0, 0.0)), f.x),
            mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
        mix(mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x),
            mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
        f.z
    );
}

float fbm(vec3 p) {
    float a = 0.5;
    float s = 0.0;
    for (int i = 0; i < 5; i++) {
        s += a * noise(p);
        p = p * 2.07 + vec3(1.7, 9.2, 3.4);
        a *= 0.5;
    }
    return s;
}

float ridged(vec3 p) {
    float a = 0.5;
    float s = 0.0;
    float w = 1.0;
    for (int i = 0; i < 4; i++) {
        float n = 1.0 - abs(noise(p) * 2.0 - 1.0);
        n *= n * w;
        s += n * a;
        w = clamp(n * 2.0, 0.0, 1.0);
        p = p * 2.18 + vec3(4.1, 1.3, 7.9);
        a *= 0.5;
    }
    return s;
}
`;

export const PLANET_VERT = /* glsl */ `
varying vec3 vObj;
varying vec3 vWorld;
varying vec3 vN;

void main() {
    vObj = position;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const PLANET_FRAG = /* glsl */ `
uniform float uTime;
uniform float uSeed;
uniform float uKind;
uniform float uWater;
uniform float uIce;
uniform float uTemp;
uniform float uMountain;
uniform float uWarp;
uniform float uCities;
uniform float uEmissive;
uniform float uBump;
uniform vec3 uOceanDeep;
uniform vec3 uOceanShallow;
uniform vec3 uLandA;
uniform vec3 uLandB;
uniform vec3 uDesert;
uniform vec3 uSnow;
uniform vec3 uLava;
uniform vec3 uSunPos;

varying vec3 vObj;
varying vec3 vWorld;
varying vec3 vN;

${NOISE_GLSL}

vec3 terrainColor(vec3 p, float h, float lat) {
    float moisture = fbm(p * 3.1 + 17.0);
    float heat = clamp(uTemp * 1.35 - lat * 1.15 + h * 0.25, 0.0, 1.0);
    vec3 rock = mix(uLandB, uLandA, moisture);
    vec3 bio = mix(uDesert, rock, smoothstep(0.28, 0.62, moisture + (1.0 - heat) * 0.2));
    bio = mix(bio, uLandA * 1.15, smoothstep(0.55, 0.82, moisture) * (1.0 - heat * 0.35));
    float snowLine = mix(0.42, 0.92, heat);
    float snow = smoothstep(snowLine - 0.08, snowLine + 0.04, h + lat * uIce);
    snow = max(snow, smoothstep(0.55, 0.22, heat) * smoothstep(0.35, 0.7, lat + uIce * 0.5));
    return mix(bio, uSnow, clamp(snow, 0.0, 1.0));
}

void main() {
    vec3 p = normalize(vObj);
    vec3 seed = vec3(uSeed * 0.137, uSeed * 0.071, uSeed * 0.219);
    vec3 q = p * 2.4 + seed;

    float warp = fbm(q * 1.15);
    vec3 pw = q + (warp - 0.5) * uWarp * 1.8;

    float h = fbm(pw * 1.8);
    h = mix(h, ridged(pw * 2.4), uMountain * 0.55);

    float lat = abs(p.y);
    vec3 N = normalize(vN);
    float dhx = dFdx(h);
    float dhy = dFdy(h);
    N = normalize(N - vec3(dhx, dhy, 0.0) * (uMountain * 1.8 + 0.15) * uBump);

    vec3 V = normalize(cameraPosition - vWorld);
    vec3 L = normalize(uSunPos - vWorld);
    float ndotl = dot(N, L);
    float wrap = ndotl * 0.5 + 0.5;
    float light = pow(max(ndotl, 0.0), 0.85);
    float night = smoothstep(0.18, -0.08, ndotl);
    float fres = pow(1.0 - max(dot(N, V), 0.0), 3.2);

    vec3 col;
    float spec = 0.0;
    float emit = 0.0;

    if (uKind > 0.5) {
        float bands = p.y * (7.0 + uMountain * 8.0) + fbm(vec3(p.x, p.y * 2.2, p.z) * 2.6 + seed) * 1.6;
        float b = 0.5 + 0.5 * sin(bands * 3.14159);
        float storm = fbm(p * 5.0 + seed * 2.0);
        col = mix(uOceanDeep, uLandA, b);
        col = mix(col, uLandB, storm * 0.35);
        col = mix(col, uDesert, smoothstep(0.62, 0.85, fbm(p * 3.0 + 9.0)) * 0.45);
        vec2 spot = vec2(p.x - 0.42, p.y * 1.7 - 0.18);
        float spotD = 1.0 - smoothstep(0.08, 0.22, length(spot));
        col = mix(col, uLava * 0.55 + uLandB, spotD * 0.55);
        spec = pow(max(dot(normalize(L + V), N), 0.0), 24.0) * 0.18;
        emit = uEmissive * 0.12 * storm;
    } else {
        float waterLine = mix(0.22, 0.72, uWater);
        float ocean = 1.0 - smoothstep(waterLine - 0.016, waterLine + 0.018, h);
        float depth = smoothstep(waterLine, waterLine - 0.22, h);
        vec3 oceanCol = mix(uOceanShallow, uOceanDeep, depth);
        oceanCol += vec3(0.05, 0.12, 0.16) * pow(max(ndotl, 0.0), 3.0);

        vec3 land = terrainColor(pw, h, lat);
        col = mix(land, oceanCol, ocean);

        spec = pow(max(dot(normalize(L + V), N), 0.0), mix(12.0, 52.0, ocean)) * mix(0.04, 0.65, ocean);

        float cracks = ridged(pw * 6.5);
        cracks = smoothstep(0.72, 0.92, cracks);
        emit = cracks * uEmissive;
        col = mix(col, uLava, cracks * uEmissive * (1.0 - ocean) * 0.65);

        float city = smoothstep(0.64, 0.8, noise(p * 48.0 + seed));
        city *= smoothstep(0.08, 0.02, ocean);
        city *= smoothstep(0.72, 0.42, lat);
        city *= uCities;
        col += vec3(1.0, 0.82, 0.52) * city * night * 1.6;
        col += vec3(0.45, 0.7, 1.0) * city * night * 0.35 * noise(p * 90.0);
    }

    float cloudShadow = 0.0;
    float cloudN = fbm(p * 3.2 + vec3(uTime * 0.017, 0.0, uSeed * 0.01));
    cloudShadow = smoothstep(0.48, 0.72, cloudN) * 0.22;

    vec3 ambient = col * 0.045;
    vec3 diffuse = col * (light * (1.0 - cloudShadow) + wrap * 0.12);
    vec3 rim = vec3(0.35, 0.5, 0.8) * fres * 0.22 * (1.0 - night * 0.4);

    vec3 outc = ambient + diffuse + spec * vec3(0.85, 0.9, 1.0) + rim + uLava * emit * 1.8;
    outc += col * night * 0.03;

    gl_FragColor = vec4(outc, 1.0);
}
`;

export const CLOUD_VERT = PLANET_VERT;

export const CLOUD_FRAG = /* glsl */ `
uniform float uTime;
uniform float uSeed;
uniform float uCover;
uniform vec3 uSunPos;
uniform vec3 uColor;

varying vec3 vObj;
varying vec3 vWorld;
varying vec3 vN;

${NOISE_GLSL}

void main() {
    if (uCover < 0.01) discard;
    vec3 p = normalize(vObj);
    float n = fbm(p * 3.4 + vec3(uTime * 0.02, uSeed * 0.05, -uTime * 0.01));
    float n2 = fbm(p * 7.0 + 12.0);
    float c = smoothstep(1.0 - uCover * 0.85 - 0.12, 1.0 - uCover * 0.25, n * 0.7 + n2 * 0.3);
    c *= mix(0.65, 1.0, n2);
    if (c < 0.04) discard;

    vec3 N = normalize(vN);
    vec3 L = normalize(uSunPos - vWorld);
    float light = pow(max(dot(N, L), 0.0), 0.7) * 0.85 + 0.15;
    float night = smoothstep(0.15, -0.2, dot(N, L));
    vec3 col = mix(uColor * 0.35, uColor, light);
    col = mix(col, uColor * vec3(0.35, 0.4, 0.7), night * 0.65);

    gl_FragColor = vec4(col, c * 0.82);
}
`;

export const ATMOS_VERT = PLANET_VERT;

export const ATMOS_FRAG = /* glsl */ `
uniform float uTime;
uniform float uDensity;
uniform float uAurora;
uniform vec3 uColor;
uniform vec3 uColor2;
uniform vec3 uSunPos;

varying vec3 vObj;
varying vec3 vWorld;
varying vec3 vN;

${NOISE_GLSL}

void main() {
    vec3 N = normalize(vN);
    vec3 V = normalize(cameraPosition - vWorld);
    vec3 p = normalize(vObj);
    float ndotv = abs(dot(N, V));
    float fres = pow(1.0 - ndotv, 2.4);
    float limb = pow(1.0 - ndotv, 4.2);

    vec3 L = normalize(uSunPos - vWorld);
    float sun = pow(max(dot(V, -L), 0.0), 8.0);
    float day = clamp(dot(p, normalize(uSunPos)), 0.0, 1.0);

    vec3 col = mix(uColor, uColor2, fres);
    col += uColor2 * sun * 0.85;
    col *= 0.35 + day * 0.75;

    float polar = smoothstep(0.42, 0.78, abs(p.y));
    float aur = polar * uAurora * (0.45 + 0.55 * fbm(p * 6.0 + vec3(0.0, uTime * 0.12, uTime * 0.07)));
    vec3 aurCol = mix(vec3(0.15, 1.0, 0.55), vec3(0.75, 0.25, 1.0), fbm(p * 3.0 + 8.0));
    col += aurCol * aur * 1.4;

    float alpha = (fres * 0.75 + limb * 0.55) * uDensity;
    alpha += aur * 0.35 * uDensity;
    if (alpha < 0.01) discard;

    gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.92));
}
`;

export const RING_VERT = /* glsl */ `
varying vec3 vPos;
varying vec3 vWorld;

void main() {
    vPos = position;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const RING_FRAG = /* glsl */ `
uniform float uInner;
uniform float uOuter;
uniform float uOpacity;
uniform vec3 uColor;
uniform vec3 uSunPos;
uniform vec3 uPlanetPos;
uniform float uPlanetRadius;
uniform float uSeed;

varying vec3 vPos;
varying vec3 vWorld;

${NOISE_GLSL}

void main() {
    float r = length(vPos.xy);
    float u = (r - uInner) / max(uOuter - uInner, 0.0001);
    if (u < 0.0 || u > 1.0) discard;

    float edge = smoothstep(0.0, 0.03, u) * smoothstep(1.0, 0.97, u);
    float bands = 0.55 + 0.45 * sin(u * 48.0 + uSeed);
    bands *= 0.6 + 0.4 * sin(u * 17.0 - uSeed * 2.0);
    float cassini = 1.0 - smoothstep(0.46, 0.49, u) * smoothstep(0.56, 0.53, u);
    float n = 0.65 + 0.35 * noise(vec3(vPos.xy * 6.0, uSeed));
    float alpha = edge * bands * cassini * n * uOpacity;
    if (alpha < 0.02) discard;

    vec3 L = normalize(uSunPos - vWorld);
    vec3 oc = vWorld - uPlanetPos;
    float b = dot(oc, L);
    float c = dot(oc, oc) - uPlanetRadius * uPlanetRadius;
    float h = b * b - c;
    float umbra = 0.0;
    if (h > 0.0) {
        float t = -b - sqrt(h);
        umbra = step(0.0, t);
    }
    vec3 col = uColor * mix(1.0, 0.16, umbra);
    col *= 0.5 + 0.5 * max(dot(normalize(vWorld - uPlanetPos), L), 0.0);

    gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.85));
}
`;

export const STAR_VERT = PLANET_VERT;

export const STAR_FRAG = /* glsl */ `
uniform float uTime;
uniform float uSeed;
uniform float uLimb;
uniform float uSpot;
uniform vec3 uColor;

varying vec3 vObj;
varying vec3 vWorld;
varying vec3 vN;

${NOISE_GLSL}

void main() {
    vec3 p = normalize(vObj);
    vec3 N = normalize(vN);
    vec3 V = normalize(cameraPosition - vWorld);
    float ndotv = max(dot(N, V), 0.0);
    float limb = mix(1.0, pow(ndotv, 0.65), uLimb);

    float gran = fbm(p * 8.0 + vec3(uTime * 0.03, uSeed, -uTime * 0.02));
    float gran2 = fbm(p * 18.0 - uTime * 0.04);
    vec3 col = uColor * (0.72 + gran * 0.4 + gran2 * 0.12);

    float spots = ridged(p * 4.5 + uSeed);
    spots = smoothstep(0.78, 0.92, spots) * uSpot;
    col *= 1.0 - spots * 0.55;

    col *= limb;
    col += uColor * pow(ndotv, 4.0) * 0.25;
    col *= 1.65;

    gl_FragColor = vec4(col, 1.0);
}
`;

export const CORONA_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uDensity;

varying vec3 vObj;
varying vec3 vWorld;
varying vec3 vN;

void main() {
    vec3 N = normalize(vN);
    vec3 V = normalize(cameraPosition - vWorld);
    float fres = pow(1.0 - abs(dot(N, V)), 3.4);
    float alpha = fres * uDensity;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(uColor, alpha);
}
`;

export const NEBULA_VERT = /* glsl */ `
varying vec3 vDir;

void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vDir = position;
    gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const NEBULA_FRAG = /* glsl */ `
uniform vec3 uA;
uniform vec3 uB;
uniform float uSeed;
uniform float uTime;

varying vec3 vDir;

${NOISE_GLSL}

void main() {
    vec3 d = normalize(vDir);
    float n = fbm(d * 2.2 + uSeed);
    float n2 = fbm(d * 5.0 + vec3(uTime * 0.004, uSeed, 0.0));
    vec3 col = mix(uA, uB, n);
    col += mix(uB, uA, n2) * 0.35;
    float veil = smoothstep(0.25, 0.85, n) * 0.22 + n2 * 0.08;
    float poles = 0.65 + 0.35 * abs(d.y);
    gl_FragColor = vec4(col * poles, veil);
}
`;

export const STARFIELD_VERT = /* glsl */ `
attribute float aSize;
attribute float aTwinkle;
attribute vec3 aColor;
uniform float uTime;
uniform float uPixelRatio;
varying vec3 vColor;
varying float vTw;

void main() {
    vColor = aColor;
    vTw = aTwinkle;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uPixelRatio * (180.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
}
`;

export const STARFIELD_FRAG = /* glsl */ `
uniform float uTime;
varying vec3 vColor;
varying float vTw;

void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;
    float core = smoothstep(0.5, 0.0, d);
    float spark = pow(core, 3.2);
    float tw = 0.55 + 0.45 * sin(uTime * vTw);
    vec3 col = vColor * (core * 0.85 + spark * 1.4) * tw;
    gl_FragColor = vec4(col, core * tw);
}
`;

export const MOON_FRAG = /* glsl */ `
uniform float uSeed;
uniform vec3 uColor;
uniform vec3 uSunPos;

varying vec3 vObj;
varying vec3 vWorld;
varying vec3 vN;

${NOISE_GLSL}

void main() {
    vec3 p = normalize(vObj);
    float n = fbm(p * 6.0 + uSeed);
    float craters = 1.0 - smoothstep(0.45, 0.62, ridged(p * 8.0 + uSeed));
    vec3 col = mix(uColor * 0.45, uColor, n);
    col *= mix(1.0, 0.55, craters);

    vec3 N = normalize(vN);
    vec3 L = normalize(uSunPos - vWorld);
    float light = pow(max(dot(N, L), 0.0), 0.9);
    col = col * (0.04 + light * 0.96);

    gl_FragColor = vec4(col, 1.0);
}
`;
