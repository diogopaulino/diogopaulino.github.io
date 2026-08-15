/**
 * Castelo Estelar — Shaders e Utilitários de Materiais em Babylon.js.
 */

export const SKY_GLSL = {
    vertex: `
        precision highp float;
        attribute vec3 position;
        varying vec3 vDir;
        uniform mat4 worldViewProjection;
        void main() {
            vDir = position;
            gl_Position = worldViewProjection * vec4(position, 1.0);
        }
    `,
    fragment: `
        precision highp float;
        varying vec3 vDir;
        uniform vec3 uZenith;
        uniform vec3 uHorizon;
        uniform vec3 uNadir;
        void main() {
            vec3 n = normalize(vDir);
            float h = n.y;
            vec3 col = mix(uNadir, uHorizon, smoothstep(-0.15, 0.08, h));
            col = mix(col, uZenith, smoothstep(0.05, 0.75, h));
            gl_FragColor = vec4(col, 1.0);
        }
    `
};

