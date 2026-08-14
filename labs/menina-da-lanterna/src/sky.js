/**
 * Céu noturno procedural, estrelas e rig de luz por capítulo.
 */

import * as THREE from 'three';

export function createSky() {
    const geo = new THREE.SphereGeometry(420, 24, 16);
    const uniforms = {
        top: { value: new THREE.Color(0x0c1428) },
        mid: { value: new THREE.Color(0x1c2848) },
        bot: { value: new THREE.Color(0x2a2218) }
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

    const starGeo = new THREE.BufferGeometry();
    const n = 420;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const h = 0.15 + Math.random() * 0.85;
        const r = 280;
        pos[i * 3] = Math.cos(a) * r * Math.sqrt(1 - h * h);
        pos[i * 3 + 1] = h * r;
        pos[i * 3 + 2] = Math.sin(a) * r * Math.sqrt(1 - h * h);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(
        starGeo,
        new THREE.PointsMaterial({
            color: 0xfff4d8,
            size: 1.4,
            sizeAttenuation: true,
            transparent: true,
            opacity: 0.85,
            depthWrite: false
        })
    );
    mesh.add(stars);

    return { mesh, uniforms, stars };
}

export function applyChapterSky(sky, chapter) {
    const s = chapter.sky;
    sky.uniforms.top.value.set(s.top);
    sky.uniforms.mid.value.set(s.mid);
    sky.uniforms.bot.value.set(s.bot);
    sky.stars.material.opacity = chapter.dark ? 0.9 : 0.12;
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
        const s = 42;
        dir.shadow.camera.left = -s;
        dir.shadow.camera.right = s;
        dir.shadow.camera.top = s;
        dir.shadow.camera.bottom = -s;
        dir.shadow.camera.near = 10;
        dir.shadow.camera.far = 180;
        dir.shadow.bias = -0.0008;
    }
    group.add(dir);
    group.add(dir.target);

    return { group, dir, hemi, amb };
}
