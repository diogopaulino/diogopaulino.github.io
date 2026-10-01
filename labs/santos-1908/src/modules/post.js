/**
 * post — bloom + output (fallback WebGL2; sem WebGPU nesta versão).
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export function create(ctx) {
    const { renderer, scene, camera, quality } = ctx;
    if (!quality.bloom) {
        return {
            render() {
                renderer.render(scene, camera);
            },
            resize() {},
            dispose() {}
        };
    }

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.28,
        0.55,
        0.82
    );
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    return {
        render() {
            composer.render();
        },
        resize(w, h) {
            composer.setSize(w, h);
            bloom.resolution.set(w, h);
        },
        dispose() {
            composer.dispose();
        }
    };
}
