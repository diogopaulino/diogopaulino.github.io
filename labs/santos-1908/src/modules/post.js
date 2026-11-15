/**
 * post — bloom + SSAO (high) + output. Fallback limpo em low.
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export async function create(ctx) {
    const { renderer, scene, camera, quality } = ctx;
    if (!quality.bloom) {
        return {
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

    if (quality.id === 'high') {
        try {
            const { SSAOPass } = await import('three/addons/postprocessing/SSAOPass.js');
            const ssao = new SSAOPass(scene, camera, window.innerWidth, window.innerHeight);
            ssao.kernelRadius = 12;
            ssao.minDistance = 0.002;
            ssao.maxDistance = 0.12;
            ssao.output = SSAOPass.OUTPUT.Default;
            composer.addPass(ssao);
        } catch {
            /* SSAO opcional */
        }
    }

    const bloom = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        quality.id === 'high' ? 0.32 : 0.22,
        0.55,
        0.8
    );
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    return {
        render() {
            composer.render();
        },
        resize(w, h) {
            composer.setSize(w, h);
        },
        setPixelRatio(pixelRatio) {
            composer.setPixelRatio(pixelRatio);
        },
        dispose() {
            composer.dispose();
        }
    };
}
