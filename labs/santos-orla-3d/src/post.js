/**
 * Pós-processamento cinematográfico: UnrealBloom sutil + ACES OutputPass.
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export function createPost(renderer, scene, camera, quality) {
    if (quality.id === 'low') {
        return {
            render: () => renderer.render(scene, camera),
            resize: () => {},
            setPixelRatio: () => {},
            setNight: () => {},
            dispose: () => {}
        };
    }

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));

    const bloom = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.22,
        0.52,
        0.85
    );
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    return {
        render: () => composer.render(),
        resize: (w, h) => composer.setSize(w, h),
        setPixelRatio: (pr) => composer.setPixelRatio(pr),
        setNight: (night) => {
            bloom.strength = night ? 0.42 : 0.22;
            bloom.threshold = night ? 0.72 : 0.85;
        },
        dispose: () => composer.dispose()
    };
}
