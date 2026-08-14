/**
 * Nébula de fundo e textura de fagulha.
 * Ruído barato em 3 oitavas — o bloom cuida do resto.
 */

export const NEBULA_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const NEBULA_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uC;
varying vec3 vDir;

float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.11, 0.17, 0.13));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
            mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
        mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
            mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
        f.z
    );
}

float fbm(vec3 p) {
    float s = 0.0;
    float a = 0.55;
    for (int i = 0; i < 4; i++) {
        s += a * noise(p);
        p = p * 2.11 + vec3(1.7, 9.2, 2.8);
        a *= 0.5;
    }
    return s;
}

void main() {
    vec3 p = normalize(vDir);
    float n = fbm(p * 2.4 + vec3(uTime * 0.017, 0.0, uTime * 0.011));
    float n2 = fbm(p * 5.2 - vec3(uTime * 0.013, uTime * 0.009, 0.2));
    vec3 col = mix(uA, uB, smoothstep(0.22, 0.78, n));
    col = mix(col, uC, smoothstep(0.5, 0.88, n2) * 0.55);
    float band = pow(1.0 - abs(p.y), 1.35);
    col += uC * band * 0.12;
    float vig = 0.42 + 0.58 * pow(max(0.0, p.y * 0.35 + 0.72), 1.4);
    col *= vig;
    gl_FragColor = vec4(col, 1.0);
}
`;

export function makeSparkTexture() {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.18, 'rgba(255,240,220,0.9)');
    grd.addColorStop(0.45, 'rgba(255,200,140,0.28)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    return c;
}
