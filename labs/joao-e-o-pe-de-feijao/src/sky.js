/**
 * Céu procedural (gradiente em esfera) e rig de iluminação por capítulo.
 */

import * as THREE from 'three';

export function createSky() {
    const geo = new THREE.SphereGeometry(480, 24, 16);
    const uniforms = {
        top: { value: new THREE.Color(0x7ec8f0) },
        mid: { value: new THREE.Color(0xc8e4f0) },
        bot: { value: new THREE.Color(0xe8dcc0) }
    };
    const mat = new THREE.ShaderMaterial({
        uniforms,
        side: THREE.BackSide,
        depthWrite: false,
        vertexShader: /* glsl */ `
            varying vec3 vPos;
            void main() {
                vPos = position;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: /* glsl */ `
            varying vec3 vPos;
            uniform vec3 top;
            uniform vec3 mid;
            uniform vec3 bot;
            void main() {
                float h = normalize(vPos).y * 0.5 + 0.5;
                vec3 col = mix(bot, mid, smoothstep(0.0, 0.42, h));
                col = mix(col, top, smoothstep(0.38, 1.0, h));
                gl_FragColor = vec4(col, 1.0);
            }
        `
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    return { mesh, uniforms };
}

export function applyChapterSky(sky, chapter) {
    const fog = new THREE.Color(chapter.fog.color);
    const sun = new THREE.Color(chapter.sun.color);
    sky.uniforms.top.value.copy(new THREE.Color(chapter.clear)).multiplyScalar(1.05);
    sky.uniforms.mid.value.copy(fog).lerp(sun, 0.28);
    sky.uniforms.bot.value.copy(fog).lerp(new THREE.Color(chapter.hemi.ground), 0.32);
}

export function createLights(scene, chapter, quality) {
    const group = new THREE.Group();
    scene.add(group);

    const amb = new THREE.AmbientLight(chapter.ambient, chapter.ambientIntensity ?? 0.5);
    group.add(amb);

    const hemi = new THREE.HemisphereLight(chapter.hemi.sky, chapter.hemi.ground, chapter.hemi.intensity);
    group.add(hemi);

    const dir = new THREE.DirectionalLight(chapter.sun.color, chapter.sun.intensity);
    const d = chapter.sun.dir;
    dir.position.set(d[0] * 80, d[1] * 80, d[2] * 80);
    dir.castShadow = quality.shadows;
    if (quality.shadows) {
        dir.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
        const s = 52;
        dir.shadow.camera.left = -s;
        dir.shadow.camera.right = s;
        dir.shadow.camera.top = s;
        dir.shadow.camera.bottom = -s;
        dir.shadow.camera.near = 8;
        dir.shadow.camera.far = 200;
        dir.shadow.bias = -0.0008;
    }
    group.add(dir);
    group.add(dir.target);

    return { group, dir, hemi, amb };
}
