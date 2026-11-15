/**
 * Pós-processamento cinematográfico da orla — bloom + SMAA (high/medium).
 * Low / software GL: render direto.
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';

export function createPost(renderer, scene, camera, quality) {
    if (quality.id === 'low') {
        return {
            enabled: false,
            render() {
                renderer.render(scene, camera);
            },
            resize() {},
            setPixelRatio() {},
            dispose() {}
        };
    }

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));

    const bloom = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        quality.id === 'high' ? 0.22 : 0.14,
        0.55,
        0.88
    );
    composer.addPass(bloom);

    if (quality.id === 'high') {
        const smaa = new SMAAPass();
        composer.addPass(smaa);
    }

    composer.addPass(new OutputPass());

    return {
        enabled: true,
        bloom,
        render() {
            composer.render();
        },
        resize(w, h) {
            composer.setSize(w, h);
        },
        setPixelRatio(pr) {
            composer.setPixelRatio(pr);
        },
        dispose() {
            composer.dispose();
        }
    };
}
