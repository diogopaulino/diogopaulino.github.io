/* Claude Bros — palco 3D: renderer, céu, sol com sombra, pós-processamento,
 * tema (dia / entardecer) e a câmera lateral em perspectiva.
 *
 * Câmera 2.5D: fica a DIST metros do plano de jogo (z = 0), um pouco acima e
 * inclinada para baixo. Em vez de afastar a câmera em telas estreitas, o campo
 * de visão vertical é que muda, para a largura visível no plano de jogo ser
 *   W = max(clamp(6,5 + 6,5·aspecto, 11, 18), 9,2·aspecto) tiles  (teto 24)      H = W / aspecto
 * — o segundo termo garante pelo menos 9,2 tiles de altura em palcos muito largos.
 *   fov = 2·atan(H / (2·DIST))
 * (18 tiles em 16:9 — a versão 2D mostrava 24, com o personagem minúsculo; ≈11 no celular em pé).
 *
 *   look-ahead: o alvo horizontal vai  facing·1,7 + vx·0,22  à frente do
 *     personagem (amortecido, λ = 2,2), e a câmera persegue o alvo com λ = 6.
 *   vertical: a câmera só sobe quando o personagem passa de 30% acima do centro.
 *   tremor: deslocamento aleatório que decai junto com `shake`.
 */
import * as THREE from 'three';
import { createSky } from '../../shared/gfx/sky.js';
import { createSunRig } from '../../shared/gfx/rig.js';
import { createPipeline } from '../../shared/gfx/post.js';
import { configureAssets, applyHDRI } from '../../shared/gfx/assets.js';
import { configureTextures } from '../../shared/gfx/textures.js';
import { clamp, damp, detectSoftwareGL, pickTier } from '../../shared/gfx/core.js';
import { QUALITY, COLS } from './config.js';

const DIST = 21.5;
const RAD = Math.PI / 180;

/* Hora do dia por tema do site. Azimute a partir do norte (−z), sentido leste (+x).
   Dia: sol alto vindo da frente-esquerda (cena bem lida). Entardecer: sol baixo
   (13°) quase de lado, pela esquerda — luz dourada rasante, sombras compridas,
   um preenchimento frio vindo da câmera e grade de cor quente/lilás. */
const THEMES = {
    light: {
        elevation: 47 * RAD, azimuth: 221 * RAD, hdri: 'day', env: 0.8, clouds: 0.1, fill: 0.0,
        post: { exposure: 1.02, bloom: 0.075, fogDensity: 0.005, haze: 0.00055, rays: 0.0, saturation: 1.2, contrast: 1.08, vignette: 0.22 },
        gain: [1, 1, 1], lift: [0, 0, 0], page: '#8fc4ea'
    },
    dark: {
        elevation: 13 * RAD, azimuth: 252 * RAD, hdri: 'dusk', env: 0.75, clouds: 0.3, fill: 0.3,
        post: { exposure: 1.0, bloom: 0.1, fogDensity: 0.006, haze: 0.0007, rays: 0.0, saturation: 1.18, contrast: 1.1, vignette: 0.32 },
        gain: [1.06, 0.97, 0.88], lift: [0.015, 0.008, 0.035], page: '#3b3350'
    }
};

export function createStage(canvas, { quality = 'auto', loadingManager } = {}) {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false });
    const software = detectSoftwareGL(renderer);
    const tier = software ? 'low' : pickTier(quality);
    const q = QUALITY[tier];
    renderer.info.autoReset = false; // o pós faz várias passadas; os contadores valem para o quadro inteiro
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    configureAssets(renderer, loadingManager, tier);
    configureTextures(renderer);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 16 / 9, 1, 900);
    const sky = createSky({ renderer, scene, cloudCover: 0.3, turbidity: 2.2, rayleigh: 2.0, ground: 0x4a5a48 });
    const rig = createSunRig(scene, sky, { mapSize: q.shadowMap, radius: 15, depth: 130 });
    rig.sun.shadow.bias = -0.0005;
    rig.sun.shadow.normalBias = 0.03;
    const fill = new THREE.DirectionalLight(0xa9c0ff, 0);
    fill.position.set(0.25, 0.45, 1);
    scene.add(fill);

    const post = createPipeline(renderer, { tier, sky, software });
    Object.assign(post.params, {
        ao: 0.85, aoRadius: 0.55, fogFalloff: 0.16, fogBase: -2.3, fogMax: 0.6, fogSunGlow: 0.5,
        dofFocus: DIST, dofRange: 75, dofMax: 0.6, grain: 0.01
    });

    const view = { w: 21, h: 11.8, cx: 6, cy: 3, lookX: 1.7, shake: 0, aspect: 16 / 9, bottom: -2.5 };
    const focus = new THREE.Vector3();
    let theme = null;
    let themeName = '';

    function resize(width, height) {
        const w = Math.max(160, Math.floor(width));
        const h = Math.max(120, Math.floor(height));
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatio));
        renderer.setSize(w, h, false);
        post.setSize();
        view.aspect = w / h;
        view.w = view.force || Math.min(24, Math.max(clamp(6.5 + 6.5 * view.aspect, 11, 18), 9.2 * view.aspect));
        view.h = view.w / view.aspect;
        // telas altas mostram mais água embaixo (onde ficam os botões de toque)
        view.bottom = -2.2 - Math.max(0, view.h - 13) * 0.6;
        camera.aspect = view.aspect;
        camera.fov = (2 * Math.atan(view.h / (2 * DIST))) / RAD;
        camera.updateProjectionMatrix();
    }

    async function setTheme(name) {
        const next = THEMES[name] ? name : 'light';
        if (next === themeName) return;
        themeName = next;
        theme = THEMES[next];
        sky.setSun(theme.elevation, theme.azimuth);
        sky.setClouds(theme.clouds);
        sky.flush();
        fill.intensity = theme.fill;
        Object.assign(post.params, theme.post);
        post.params.gain.setRGB(...theme.gain);
        post.params.lift.setRGB(...theme.lift);
        canvas.parentElement?.style.setProperty('--stage-sky', theme.page);
        await applyHDRI(scene, renderer, theme.hdri, { intensity: theme.env });
    }

    /** Segue o personagem. px/py em metros; `snap` reposiciona sem suavizar. */
    function follow(dt, px, py, facing, vx, snap = false) {
        const half = view.w / 2;
        const lookTarget = facing * 1.7 + vx * 0.22;
        view.lookX = snap ? facing * 1.7 : damp(view.lookX, lookTarget, 2.2, dt);
        const minX = half - 2.2;
        const maxX = COLS - half + 2.2;
        const tx = minX < maxX ? clamp(px + view.lookX, minX, maxX) : COLS / 2;
        const cyMin = view.bottom + view.h / 2;
        const ty = Math.max(cyMin, py + 1.4 - view.h * 0.3);
        view.cx = snap ? tx : damp(view.cx, tx, 6, dt);
        view.cy = snap ? ty : damp(view.cy, ty, 4, dt);
        if (view.lock) { view.cx = view.lock.x; view.cy = view.lock.y; }
        view.shake = Math.max(0, view.shake - dt * 1.6);
        const sx = (Math.random() - 0.5) * view.shake * 0.42;
        const sy = (Math.random() - 0.5) * view.shake * 0.42;
        camera.position.set(view.cx + sx, view.cy + 1.9 + sy, DIST);
        focus.set(view.cx + sx, view.cy + sy, 0);
        camera.lookAt(focus);
    }

    function render(t, dt) {
        sky.update(t, dt);
        focus.set(view.cx, 2.5, -2);
        rig.update(focus, Math.max(14, view.w * 0.66));
        renderer.info.reset();
        post.render(scene, camera, dt);
    }

    return { renderer, scene, camera, sky, rig, post, view, tier, quality: q, software, resize, setTheme, follow, render, get theme() { return themeName; } };
}
