/**
 * Céu procedural com sol, nuvens e estrelas — cada capítulo troca a paleta.
 */

import * as THREE from 'three';
import { cloudTexture } from './textures.js?v=3';

export function createSky() {
    const geo = new THREE.SphereGeometry(420, 32, 20);
    const uniforms = {
        top: { value: new THREE.Color(0x87b8e0) },
        mid: { value: new THREE.Color(0xc8dce8) },
        bot: { value: new THREE.Color(0xe8d8b0) },
        sunDir: { value: new THREE.Vector3(0.4, 0.8, 0.3).normalize() },
        sunColor: { value: new THREE.Color(0xffe8b0) },
        sunSize: { value: 0.035 }
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
            uniform vec3 sunDir;
            uniform vec3 sunColor;
            uniform float sunSize;
            void main() {
                vec3 n = normalize(vPos);
                float h = n.y * 0.5 + 0.5;
                vec3 col = mix(bot, mid, smoothstep(0.0, 0.42, h));
                col = mix(col, top, smoothstep(0.38, 1.0, h));
                float sun = pow(max(dot(n, sunDir), 0.0), 8.0);
                float disc = smoothstep(1.0 - sunSize * 3.5, 1.0 - sunSize, max(dot(n, sunDir), 0.0));
                col += sunColor * sun * 0.35;
                col += sunColor * disc * 1.4;
                float haze = pow(1.0 - abs(n.y), 4.0);
                col = mix(col, mix(bot, sunColor, 0.35), haze * 0.35);
                gl_FragColor = vec4(col, 1.0);
            }
        `
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;

    const clouds = new THREE.Group();
    const cTex = cloudTexture();
    const cMat = new THREE.MeshBasicMaterial({
        map: cTex,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
        side: THREE.DoubleSide
    });
    for (let i = 0; i < 10; i++) {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(48 + (i % 3) * 18, 22 + (i % 2) * 10), cMat);
        const a = (i / 10) * Math.PI * 2;
        p.position.set(Math.cos(a) * 90, 28 + (i % 4) * 8, Math.sin(a) * 90);
        p.lookAt(0, 20, 0);
        p.userData.speed = 0.015 + (i % 5) * 0.004;
        p.userData.radius = 90 + (i % 3) * 12;
        p.userData.base = a;
        clouds.add(p);
    }
    mesh.add(clouds);

    const starGeo = new THREE.BufferGeometry();
    const starN = 420;
    const starPos = new Float32Array(starN * 3);
    for (let i = 0; i < starN; i++) {
        const a = Math.random() * Math.PI * 2;
        const h = 0.15 + Math.random() * 0.85;
        const r = 380;
        starPos[i * 3] = Math.cos(a) * r * Math.sqrt(1 - h * h);
        starPos[i * 3 + 1] = h * r;
        starPos[i * 3 + 2] = Math.sin(a) * r * Math.sqrt(1 - h * h);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const stars = new THREE.Points(
        starGeo,
        new THREE.PointsMaterial({ color: 0xdce8ff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.85, depthWrite: false })
    );
    stars.visible = false;
    mesh.add(stars);

    return { mesh, uniforms, clouds, stars, cloudMat: cMat };
}

export function applyChapterSky(sky, chapter) {
    const fog = new THREE.Color(chapter.fog.color);
    const sun = new THREE.Color(chapter.sun.color);
    sky.uniforms.top.value.copy(new THREE.Color(chapter.clear)).multiplyScalar(1.08);
    sky.uniforms.mid.value.copy(fog).lerp(sun, 0.28);
    sky.uniforms.bot.value.copy(fog).lerp(new THREE.Color(chapter.hemi.ground), 0.4);
    const d = chapter.sun.dir;
    sky.uniforms.sunDir.value.set(d[0], d[1], d[2]).normalize();
    sky.uniforms.sunColor.value.copy(sun);
    sky.uniforms.sunSize.value = chapter.id === 'amonhen' ? 0.055 : chapter.id === 'forest' || chapter.id === 'moria' ? 0.012 : 0.032;
    const night = chapter.id === 'forest' || chapter.id === 'moria';
    sky.stars.visible = night;
    sky.clouds.visible = !night;
    sky.cloudMat.opacity = chapter.id === 'rivendell' ? 0.55 : chapter.id === 'amonhen' ? 0.4 : 0.7;
    sky.cloudMat.color.set(chapter.id === 'amonhen' ? 0xffc090 : 0xffffff);
}

export function tickSky(sky, t) {
    if (!sky.clouds.visible) return;
    const origin = sky.mesh.position;
    sky.clouds.children.forEach((p) => {
        const a = p.userData.base + t * p.userData.speed;
        const r = p.userData.radius;
        p.position.x = Math.cos(a) * r;
        p.position.z = Math.sin(a) * r;
        p.lookAt(origin);
    });
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
        dir.shadow.camera.near = 8;
        dir.shadow.camera.far = 160;
        dir.shadow.bias = -0.0006;
        dir.shadow.normalBias = 0.04;
    }
    group.add(dir);
    group.add(dir.target);

    const fill = new THREE.DirectionalLight(chapter.hemi.sky, chapter.sun.intensity * 0.18);
    fill.position.set(-d[0] * 40, Math.max(12, d[1] * 20), -d[2] * 40);
    group.add(fill);

    return { group, dir, hemi, amb, fill };
}
