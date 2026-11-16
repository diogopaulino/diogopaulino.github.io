/**
 * gfx/rig — luz direcional do sol/lua acoplada ao céu, com sombra que segue um foco.
 *
 * A câmera de sombra é ortográfica e é reposicionada em passos de 1 texel no espaço
 * da luz (snap), o que elimina o "formigamento" das bordas quando o foco se move:
 *   texel = (2·raio) / tamanhoDoMapa;   coord = floor(coord / texel) · texel
 */
import * as THREE from 'three';

export function createSunRig(scene, sky, { shadows = true, mapSize = 2048, radius = 70, depth = 400 } = {}) {
    const sun = new THREE.DirectionalLight(0xffffff, 3);
    sun.castShadow = shadows;
    if (shadows) {
        sun.shadow.mapSize.set(mapSize, mapSize);
        sun.shadow.bias = -0.0004;
        sun.shadow.normalBias = 0.04;
        sun.shadow.camera.near = 1;
        sun.shadow.camera.far = depth;
        sun.shadow.radius = 2.5;
    }
    scene.add(sun, sun.target);

    const right = new THREE.Vector3();
    const up = new THREE.Vector3();
    const focusS = new THREE.Vector3();
    const tmp = new THREE.Vector3();
    let curRadius = -1;

    function setRadius(r) {
        if (!shadows || Math.abs(r - curRadius) < 0.5) return;
        curRadius = r;
        const c = sun.shadow.camera;
        c.left = -r;
        c.right = r;
        c.top = r;
        c.bottom = -r;
        c.updateProjectionMatrix();
    }
    setRadius(radius);

    return {
        sun,
        /** focus: ponto do mundo no centro da sombra; r: meio-lado coberto (m). */
        update(focus, r = radius) {
            sun.color.copy(sky.lightColor);
            sun.intensity = sky.lightIntensity;
            const dir = sky.lightDir;
            setRadius(r);
            // base ortonormal da luz
            right.crossVectors(Math.abs(dir.y) > 0.99 ? tmp.set(1, 0, 0) : tmp.set(0, 1, 0), dir).normalize();
            up.crossVectors(dir, right).normalize();
            focusS.copy(focus);
            if (shadows) {
                const texel = (2 * curRadius) / sun.shadow.mapSize.x;
                const fx = Math.floor(focus.dot(right) / texel) * texel;
                const fy = Math.floor(focus.dot(up) / texel) * texel;
                const fz = focus.dot(dir);
                focusS.set(0, 0, 0).addScaledVector(right, fx).addScaledVector(up, fy).addScaledVector(dir, fz);
            }
            sun.target.position.copy(focusS);
            sun.position.copy(focusS).addScaledVector(dir, depth * 0.5);
            sun.target.updateMatrixWorld();
            sun.updateMatrixWorld();
        }
    };
}
