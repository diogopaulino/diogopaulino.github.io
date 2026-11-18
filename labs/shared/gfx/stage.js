/**
 * gfx/stage — palco padrão dos labs 3D ao ar livre: renderer + céu + sol + pós.
 *
 * Em vez de cada lab configurar WebGLRenderer, luz, sombra, névoa e pós do seu
 * jeito, todos chamam `createStage` e recebem a mesma base, calibrada por tier:
 *
 *   const stage = createStage({ canvas, preset: 'dia-claro' });
 *   if (!stage) return;                    // sem WebGL 2: a mensagem já está na tela
 *   stage.scene.add(...);
 *   stage.start((dt, t) => { ...atualiza o jogo... });   // ou chame stage.render(dt)
 *
 * ILUMINAÇÃO — dois modos (opção `hdri`):
 *   céu físico (padrão)   `sky.js` (Preetham + nuvens) gera fundo, IBL e a cor da
 *                         névoa; o sol de `rig.js` segue a hora. Use quando a hora
 *                         muda em jogo, quando o clima importa (nublado, tempestade)
 *                         ou quando o lab precisa pesar pouco (nenhum download).
 *   HDRI ('day'|'dusk'|   céu fotográfico do Poly Haven como fundo + IBL (1,3–1,7 MB).
 *    'night'|'overcast'|  Use em labs de hora fixa em que o céu aparece muito no
 *    'misty')             quadro e reflexos ricos contam (metal, água, vitrines). A
 *                         direção do sol é lida do pixel mais brilhante do HDRI, então
 *                         sombra, raios e névoa continuam coerentes com o fundo.
 *
 * PRESETS de atmosfera (`preset` / `stage.setPreset(nome)`), ver PRESETS abaixo:
 *   'dia-claro' · 'entardecer' · 'noite-lua' · 'nublado' · 'neblina-floresta' · 'tempestade'
 * Cada um define hora, nuvens, exposição, névoa de altura, bruma, bloom, raios,
 * grade de cor, força do sol/ambiente e vento. `setTimeOfDay(h)` troca só a hora:
 *   escuro = 1 − smoothstep(−0,1, 0,3, sol.y)                      (0 com sol acima de ~17°, 1 abaixo de −6°)
 *   exposição = lerp(exp_preset, max(exp_preset, 2,6), escuro)     (adaptação do olho)
 *   luz de preenchimento = lerp(fill_preset, 0,6, escuro)
 *
 * TAMANHO — um ResizeObserver no canvas dispara `resize()`. Enquanto o canvas tem
 * menos de 2 px em algum eixo (aba oculta, display:none, layout ainda não feito)
 * `render()` não desenha nada: é isso que evita
 * `GL_INVALID_FRAMEBUFFER_OPERATION: Attachment has zero size`.
 *
 * RESOLUÇÃO DINÂMICA — a cada 0,5 s mede o fps médio:
 *   fps < 42 → pixelRatio −0,1 (mín. 0,6)   ·   fps > 57 → +0,05 (máx. do tier)
 * Se já está no mínimo e o fps segue < 30 por 3 s, o tier cai um degrau
 * (high → medium → low): o pós é recriado mais leve, a sombra encolhe e os
 * ouvintes de `stage.onTier(fn)` são avisados (grama/floresta reduzem a carga).
 *
 * FALLBACK — sem WebGL 2: `createStage` devolve null e escreve um aviso sobre o
 * canvas. Sem alvo de cor float (GPU antiga): o pós roda em 8 bits com a luz da
 * cena em meia escala e a exposição dobrada, para não estourar os claros.
 */
import * as THREE from 'three';
import { createSky } from './sky.js';
import { createSunRig } from './rig.js';
import { createPipeline } from './post.js';
import { configureAssets, loadHDRI } from './assets.js';
import { configureTextures } from './textures.js';
import { updateWind } from './flora.js';
import { pickTier, detectSoftwareGL, lerp } from './core.js';

/** Orçamento por tier (ver COMMON: high ≤ 1,5 M tri · 250 draws · sombra 2048; low ≤ 300 k tri · sombra 1024). */
export const STAGE_TIERS = {
    low: { pixelRatio: 1.25, shadowMap: 1024, shadowRadius: 38, far: 900 },
    medium: { pixelRatio: 1.5, shadowMap: 2048, shadowRadius: 60, far: 1400 },
    high: { pixelRatio: 2, shadowMap: 2048, shadowRadius: 80, far: 2000 }
};

/**
 * Presets de clima/atmosfera.
 *   hour       hora solar (0–24)             clouds   cobertura de nuvens 0–1
 *   exposure   exposição antes do ACES       sun/env  multiplicadores de sol e IBL
 *   fog        densidade da névoa de altura  falloff  queda exponencial com a altura (1/m)
 *   haze       bruma uniforme por distância  rays     força dos raios de sol
 *   wind       força do vento (flora/grama)  fill     luz hemisférica de preenchimento
 *   gain/lift  grade de cor (multiplica claros / soma nos escuros)
 *   fogTint    multiplica a cor da névoa (que vem do céu no horizonte); < 1 no entardecer,
 *              quando o horizonte brilha muito mais que o vale em sombra
 */
export const PRESETS = {
    'dia-claro': {
        hour: 10.5, clouds: 0.34, exposure: 1.0, sun: 1, env: 1.2, fog: 0.0016, falloff: 0.03, haze: 0.00012,
        fogGlow: 0.3, bloom: 0.085, rays: 0.45, saturation: 1.08, contrast: 1.06, vignette: 0.26,
        fogTint: [1, 1, 1], gain: [1, 1, 1], lift: [0, 0, 0], wind: 0.8, fill: 0.2
    },
    entardecer: {
        hour: 17.75, clouds: 0.48, exposure: 1.15, sun: 1, env: 1.25, fog: 0.002, falloff: 0.035, haze: 0.00014,
        fogGlow: 0.22, bloom: 0.11, rays: 0.5, saturation: 1.1, contrast: 1.07, vignette: 0.3,
        fogTint: [0.62, 0.56, 0.56], gain: [1.04, 1, 0.95], lift: [0.012, 0.006, 0.018], wind: 0.6, fill: 0.26
    },
    'noite-lua': {
        hour: 22, clouds: 0.28, exposure: 2.6, sun: 1.6, env: 1.5, fog: 0.003, falloff: 0.04, haze: 0.00014,
        fogGlow: 0.4, bloom: 0.13, rays: 0.25, saturation: 0.92, contrast: 1.08, vignette: 0.38,
        fogTint: [0.8, 0.86, 1], gain: [0.93, 0.98, 1.08], lift: [0.004, 0.008, 0.02], wind: 0.5, fill: 0.6
    },
    nublado: {
        hour: 12.5, clouds: 0.96, exposure: 1.08, sun: 0.3, env: 1.15, fog: 0.004, falloff: 0.03, haze: 0.0003,
        fogGlow: 0.1, bloom: 0.07, rays: 0, saturation: 0.93, contrast: 1.03, vignette: 0.28,
        fogTint: [0.92, 0.94, 0.96], gain: [0.98, 1, 1.02], lift: [0.01, 0.012, 0.014], wind: 1.0, fill: 0.22
    },
    'neblina-floresta': {
        hour: 7.6, clouds: 0.55, exposure: 1.12, sun: 0.85, env: 1.1, fog: 0.05, falloff: 0.11, haze: 0.0011,
        fogGlow: 1.3, bloom: 0.14, rays: 1.0, saturation: 0.96, contrast: 1.02, vignette: 0.32,
        fogTint: [1, 1, 1], gain: [1.02, 1.01, 0.97], lift: [0.014, 0.018, 0.016], wind: 0.35, fill: 0.16
    },
    tempestade: {
        hour: 16, clouds: 1.0, exposure: 1.15, sun: 0.14, env: 1.25, fog: 0.009, falloff: 0.025, haze: 0.0011,
        fogGlow: 0.05, bloom: 0.06, rays: 0, saturation: 0.78, contrast: 1.12, vignette: 0.42,
        fogTint: [0.7, 0.75, 0.8], gain: [0.92, 0.97, 1.06], lift: [0.006, 0.01, 0.016], wind: 2.4, fill: 0.2
    }
};

const TIER_DOWN = { high: 'medium', medium: 'low' };
const HDRI_HOUR = { day: 11, dusk: 17.9, night: 22, overcast: 12.5, misty: 7.5 };

function showFallback(canvas, text) {
    const host = canvas?.parentElement;
    if (!host) return;
    const box = document.createElement('p');
    box.setAttribute('role', 'alert');
    box.textContent = text;
    box.style.cssText = 'position:absolute;inset:0;margin:auto;height:fit-content;max-width:min(32rem,90%);'
        + 'padding:1.25rem 1.5rem;border-radius:14px;background:rgba(14,18,24,.92);color:#e9eef5;'
        + 'font:500 1rem/1.5 system-ui,sans-serif;text-align:center;z-index:5';
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    host.appendChild(box);
}

const hdriDirections = new WeakMap();

/**
 * Direção do sol (ou da lua) num HDRI equirretangular: pixel mais brilhante do
 * hemisfério de cima. Com flipY do HDRLoader, a linha 0 dos dados é o topo (v = 1):
 *   u = (i + ½)/w, v = 1 − (j + ½)/h;  φ = (u − ½)·2π, el = (v − ½)·π
 *   d = (cos el · cos φ, sin el, cos el · sin φ)        (mesma convenção do three)
 */
function hdriLightDir(texture, out) {
    const cached = hdriDirections.get(texture);
    if (cached) return out.copy(cached);
    const img = texture.image;
    const { data, width, height } = img;
    const stride = Math.round(data.length / (width * height));
    let best = -1;
    let bi = 0;
    let bj = 0;
    // A luminância usa os canais lineares, inclusive quando armazenados em meio-float.
    const linear = texture.type === THREE.HalfFloatType ? THREE.DataUtils.fromHalfFloat : value => value;
    for (let j = 0; j < height * 0.52; j++) {
        for (let i = 0; i < width; i++) {
            const o = (j * width + i) * stride;
            const v = 0.2126 * linear(data[o]) + 0.7152 * linear(data[o + 1]) + 0.0722 * linear(data[o + 2]);
            if (v > best) {
                best = v;
                bi = i;
                bj = j;
            }
        }
    }
    const phi = ((bi + 0.5) / width - 0.5) * Math.PI * 2;
    const el = (0.5 - (bj + 0.5) / height) * Math.PI;
    out.set(Math.cos(el) * Math.cos(phi), Math.sin(el), Math.cos(el) * Math.sin(phi)).normalize();
    hdriDirections.set(texture, out.clone());
    return out;
}

/**
 * @param {object} o
 * @param {HTMLCanvasElement} o.canvas
 * @param {'auto'|'low'|'medium'|'high'} [o.tier]
 * @param {string} [o.preset]        nome em PRESETS (padrão 'dia-claro')
 * @param {number} [o.time]          hora solar inicial; sobrepõe a hora do preset
 * @param {string|null} [o.hdri]     'day'|'dusk'|'night'|'overcast'|'misty' → modo HDRI; null → céu físico
 * @param {boolean} [o.shadows]      sombras do sol (padrão true)
 * @param {object|false} [o.post]    parâmetros extras do pipeline (ver post.js) ou false = pós mínimo (sem AO/DOF/raios)
 * @param {number} [o.fov] [o.near] [o.far] [o.shadowRadius]
 * @param {boolean} [o.adaptive]     resolução dinâmica + queda de tier (padrão true)
 * @param {object} [o.sky]           opções repassadas a createSky (declination, turbidity, ground…)
 * @param {THREE.LoadingManager} [o.loadingManager] repassado a configureAssets
 * @returns {object|null} ver objeto `stage` no fim da função
 */
export function createStage({
    canvas,
    tier: tierChoice = 'auto',
    preset: presetName = 'dia-claro',
    time = null,
    hdri = null,
    shadows = true,
    post = {},
    fov = 50,
    near = 0.25,
    far = null,
    shadowRadius = null,
    adaptive = true,
    sky: skyOptions = {},
    loadingManager = null,
    forceLDR = false
} = {}) {
    let renderer;
    try {
        renderer = new THREE.WebGLRenderer({
            canvas, antialias: false, alpha: false, stencil: false, powerPreference: 'high-performance'
        });
    } catch {
        showFallback(canvas, 'Este laboratório precisa de WebGL 2. Ative a aceleração de hardware ou use um navegador atual.');
        return null;
    }
    const software = detectSoftwareGL(renderer);
    let tier = software ? 'low' : pickTier(tierChoice);
    let cfg = STAGE_TIERS[tier];
    if (forceLDR) {
        const has = renderer.extensions.has.bind(renderer.extensions);
        renderer.extensions.has = (n) => (/color_buffer_(half_)?float/.test(n) ? false : has(n));
    }

    renderer.shadowMap.enabled = shadows;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.info.autoReset = false;
    configureAssets(renderer, loadingManager, tier);
    configureTextures(renderer);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(fov, 1, near, far ?? cfg.far);

    // céu: no modo HDRI ele não entra na cena (scene: null) — só fornece o LUT da névoa e a luz
    const sky = createSky({
        renderer, scene: hdri ? null : scene, generateEnvironment: !hdri, cloudCover: 0.4, ground: 0x66707a, declination: -18, ...skyOptions
    });
    const rig = createSunRig(scene, sky, {
        shadows, mapSize: cfg.shadowMap, radius: shadowRadius ?? cfg.shadowRadius, depth: 420
    });
    const fill = new THREE.HemisphereLight(0xbfd4ff, 0x54483a, 0.12);
    scene.add(fill);

    const minimal = post === false;
    const makePipeline = () => {
        const p = createPipeline(renderer, { tier: minimal ? 'low' : tier, sky, software });
        if (minimal) p.params.bloom = 0;
        return p;
    };
    let pipeline = makePipeline();
    const ldr = !pipeline.hdr;
    const ldrK = ldr ? 0.5 : 1;

    const state = {
        preset: PRESETS[presetName] ? presetName : 'dia-claro',
        hour: 12,
        sun: 1,
        env: 1,
        wind: 0.8,
        fillBase: 0.12,
        exposureBase: 1,
        t: 0,
        sizeOk: false,
        width: 0,
        height: 0,
        hdriName: hdri,
        hdriToken: 0
    };
    const userPost = post && typeof post === 'object' ? post : {};

    function applyHour() {
        // adaptação do olho: contínua com a altura do sol (0 acima de ~17°, 1 abaixo de −6°),
        // para o entardecer não afundar no preto antes de a noite "ligar"
        const y = sky.sunDir.y;
        const k = Math.min(1, Math.max(0, (y + 0.1) / 0.4));
        const dim = 1 - k * k * (3 - 2 * k);
        pipeline.params.exposure = lerp(state.exposureBase, Math.max(state.exposureBase, 2.6), dim) / ldrK;
        fill.intensity = lerp(state.fillBase, Math.max(state.fillBase, 0.6), dim) * ldrK;
        // os HDRIs do Poly Haven são bem mais claros que o céu físico: 0,45 equilibra ambiente e sol
        scene.environmentIntensity = state.env * ldrK * (state.hdriName ? 0.45 : 1);
    }

    function applyPreset(name, { keepHour = false } = {}) {
        const p = PRESETS[name];
        if (!p) return;
        state.preset = name;
        state.sun = p.sun;
        state.env = p.env;
        state.wind = p.wind;
        state.fillBase = p.fill;
        state.exposureBase = p.exposure;
        Object.assign(pipeline.params, {
            fogDensity: p.fog, fogFalloff: p.falloff, haze: p.haze, fogSunGlow: p.fogGlow, bloom: minimal ? 0 : p.bloom,
            rays: p.rays, saturation: p.saturation, contrast: p.contrast, vignette: p.vignette, grain: 0.012,
            ao: 0.6, aoRadius: 1.2
        });
        pipeline.params.gain.setRGB(p.gain[0], p.gain[1], p.gain[2]);
        pipeline.params.fogTint.setRGB(p.fogTint[0], p.fogTint[1], p.fogTint[2]);
        pipeline.params.lift.setRGB(p.lift[0], p.lift[1], p.lift[2]);
        for (const [k, v] of Object.entries(userPost)) {
            if (pipeline.params[k]?.isColor) pipeline.params[k].set(v);
            else pipeline.params[k] = v;
        }
        sky.setClouds(p.clouds);
        if (!keepHour) setTimeOfDay(p.hour);
        else applyHour();
    }

    const hdriDir = new THREE.Vector3();
    async function useHDRI(which) {
        const token = ++state.hdriToken;
        const loaded = await loadHDRI(which, renderer);
        if (!loaded || token !== state.hdriToken || disposed) return;
        state.hdriName = which;
        scene.environment = loaded.env;
        scene.background = loaded.texture;
        scene.backgroundIntensity = ldrK;
        hdriLightDir(loaded.texture, hdriDir);
        if (which === 'night') {
            // o pixel mais brilhante é a lua: põe o sol do outro lado, abaixo do horizonte
            sky.sunDir.set(-hdriDir.x, -0.45, -hdriDir.z).normalize();
        } else {
            sky.sunDir.copy(hdriDir);
            if (sky.sunDir.y < 0.03) sky.sunDir.setY(0.03).normalize();
        }
        sky.refresh();
        applyHour();
    }

    /** Hora solar 0–24. No modo HDRI troca para o céu fotográfico mais próximo da hora. */
    function setTimeOfDay(h) {
        state.hour = ((h % 24) + 24) % 24;
        sky.setHour(state.hour);
        if (state.hdriName) {
            const hh = state.hour;
            const which = hh >= 6 && hh < 8.5 ? 'misty' : hh >= 8.5 && hh < 16.6 ? state.hdriName === 'overcast' ? 'overcast' : 'day'
                : hh >= 16.6 && hh < 19.2 ? 'dusk' : 'night';
            useHDRI(which);
        }
        applyHour();
    }

    // ---------- tamanho ----------
    let pixelRatio = Math.min(window.devicePixelRatio || 1, cfg.pixelRatio);
    function resize() {
        const w = canvas.clientWidth || (canvas.isConnected ? 0 : window.innerWidth);
        const h = canvas.clientHeight || (canvas.isConnected ? 0 : window.innerHeight);
        if (w < 2 || h < 2) {
            state.sizeOk = false;
            return false;
        }
        state.sizeOk = true;
        state.width = w;
        state.height = h;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setDrawingBufferSize(w, h, pixelRatio);
        pipeline.setSize();
        return true;
    }
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => resize()) : null;
    observer?.observe(canvas);
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);

    // ---------- desempenho ----------
    const tierListeners = new Set();
    const perf = { acc: 0, frames: 0, fps: 60, warm: 2.5, slow: 0 };
    function setTier(next) {
        if (next === tier || !STAGE_TIERS[next]) return;
        tier = next;
        configureAssets(renderer, loadingManager, tier);
        cfg = STAGE_TIERS[tier];
        const old = pipeline;
        pipeline = makePipeline();
        for (const [k, v] of Object.entries(old.params)) {
            if (v?.isColor) pipeline.params[k].copy(v);
            else pipeline.params[k] = v;
        }
        old.dispose();
        if (shadows && rig.sun.shadow.mapSize.x !== cfg.shadowMap) {
            rig.sun.shadow.mapSize.set(cfg.shadowMap, cfg.shadowMap);
            rig.sun.shadow.map?.dispose();
            rig.sun.shadow.map = null;
        }
        stage.shadowRadius = Math.min(stage.shadowRadius, cfg.shadowRadius);
        pixelRatio = Math.min(window.devicePixelRatio || 1, cfg.pixelRatio);
        resize();
        for (const fn of tierListeners) fn(tier);
    }
    function measure(dt) {
        if (dt <= 0) return;
        if (perf.warm > 0) {
            perf.warm -= dt;
            return;
        }
        perf.acc += dt;
        perf.frames++;
        if (perf.acc < 0.5) return;
        perf.fps = perf.frames / perf.acc;
        perf.acc = 0;
        perf.frames = 0;
        if (!adaptive) return;
        const maxPR = Math.min(window.devicePixelRatio || 1, cfg.pixelRatio);
        const minPR = Math.min(0.6, maxPR);
        let next = pixelRatio;
        if (perf.fps < 42) next = Math.max(minPR, pixelRatio - 0.1);
        else if (perf.fps > 57) next = Math.min(maxPR, pixelRatio + 0.05);
        if (Math.abs(next - pixelRatio) > 0.04) {
            pixelRatio = next;
            resize();
        }
        perf.slow = perf.fps < 30 && pixelRatio <= minPR + 0.01 ? perf.slow + 1 : 0;
        if (perf.slow >= 6 && TIER_DOWN[tier]) {
            perf.slow = 0;
            perf.warm = 1.5;
            setTier(TIER_DOWN[tier]);
        }
    }

    // ---------- quadro ----------
    const fwd = new THREE.Vector3();
    const autoFocus = new THREE.Vector3();
    let ground = null;
    let disposed = false;
    let contextLost = false;

    /**
     * Desenha um quadro. Devolve false (sem tocar na GPU) se o canvas está sem
     * tamanho, a aba está oculta ou o contexto foi perdido.
     */
    function render(dt = 1 / 60, elapsed = dt) {
        if (disposed || contextLost || document.hidden) return false;
        if (!state.sizeOk && !resize()) return false;
        state.t += dt;
        sky.update(state.t, dt);
        let focus = stage.focus;
        if (!focus) {
            camera.getWorldDirection(fwd);
            fwd.y = 0;
            if (fwd.lengthSq() > 1e-6) fwd.normalize();
            focus = autoFocus.copy(camera.position).addScaledVector(fwd, stage.shadowRadius * 0.55);
        }
        let radius = stage.shadowRadius;
        if (ground) {
            // câmera alta enxerga longe: o raio da sombra cresce com a altura sobre o chão (até 400 m)
            const camH = camera.position.y - ground.heightAt(camera.position.x, camera.position.z);
            radius = Math.min(400, Math.max(radius, camH * 1.25));
        }
        rig.update(focus, radius);
        rig.sun.intensity *= state.sun * ldrK;
        updateWind(state.t, state.wind * (0.85 + Math.sin(state.t * 0.13) * 0.3));
        renderer.info.reset();
        pipeline.render(scene, camera, dt);
        measure(elapsed);
        return true;
    }

    // laço opcional: THREE.Timer + pausa com a aba oculta
    const timer = new THREE.Timer();
    let raf = 0;
    let onFrame = null;
    function loop(now) {
        raf = requestAnimationFrame(loop);
        timer.update(now);
        if (document.hidden) return;
        // A física limita o passo. O orçamento da GPU precisa do tempo real do quadro.
        const elapsed = timer.getDelta();
        const dt = Math.min(0.05, elapsed);
        onFrame?.(dt, state.t);
        render(dt, elapsed);
    }
    const onVisibility = () => {
        // ao voltar, descarta o intervalo em que a aba ficou oculta
        if (!document.hidden) timer.reset();
    };
    document.addEventListener('visibilitychange', onVisibility);
    const onLost = (e) => {
        e.preventDefault();
        contextLost = true;
    };
    const onRestored = () => {
        contextLost = false;
        sky.refresh();
        resize();
    };
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);

    const stage = {
        renderer,
        scene,
        camera,
        sky,
        rig,
        /** DirectionalLight do sol/lua (cor, intensidade e direção vêm do céu a cada quadro). */
        sun: rig.sun,
        fill,
        get pipeline() { return pipeline; },
        get tier() { return tier; },
        get fps() { return perf.fps; },
        get pixelRatio() { return pixelRatio; },
        get hour() { return state.hour; },
        get preset() { return state.preset; },
        get time() { return state.t; },
        /** true quando o pós roda em 8 bits (sem alvo float). */
        ldr,
        software,
        /** Centro da sombra (Vector3). null = segue a câmera, ~0,55·raio à frente. */
        focus: null,
        /** Meio-lado coberto pela sombra do sol, em metros. */
        shadowRadius: shadowRadius ?? cfg.shadowRadius,
        resize,
        render,
        setTimeOfDay,
        setPreset: applyPreset,
        setTier,
        /**
         * Liga o palco a um terreno (retorno de createTerrain): a névoa de altura passa a
         * nascer no ponto mais baixo do relevo e o raio da sombra cresce quando a câmera sobe.
         */
        follow(terrain) {
            ground = terrain;
            pipeline.params.fogBase = terrain.bounds?.minY ?? 0;
            return stage;
        },
        /** fn(tier) é chamado quando o tier cai por desempenho. Devolve a função que cancela. */
        onTier(fn) {
            tierListeners.add(fn);
            return () => tierListeners.delete(fn);
        },
        /** Inicia o laço: update(dt, t) roda antes de cada render. */
        start(update) {
            onFrame = update || null;
            if (!raf) {
                timer.reset();
                raf = requestAnimationFrame(loop);
            }
        },
        stop() {
            cancelAnimationFrame(raf);
            raf = 0;
        },
        /** Compila os shaders e assa céu/IBL antes do primeiro quadro (use atrás da tela de loading). */
        async warmup() {
            sky.flush();
            if (!resize()) return;
            try {
                await renderer.compileAsync(scene, camera);
            } catch { /* compila sob demanda */ }
        },
        /** { calls, triangles, fps, pixelRatio, tier } do último quadro (inclui sombra e passes de pós). */
        stats() {
            return {
                calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
                fps: Math.round(perf.fps), pixelRatio: +pixelRatio.toFixed(2), tier
            };
        },
        dispose() {
            disposed = true;
            stage.stop();
            observer?.disconnect();
            window.removeEventListener('resize', resize);
            window.removeEventListener('orientationchange', resize);
            document.removeEventListener('visibilitychange', onVisibility);
            canvas.removeEventListener('webglcontextlost', onLost);
            canvas.removeEventListener('webglcontextrestored', onRestored);
            pipeline.dispose();
            sky.dispose();
            rig.sun.shadow.map?.dispose();
            renderer.dispose();
        }
    };

    applyPreset(state.preset, { keepHour: true });
    if (hdri) {
        sky.setHour(time ?? HDRI_HOUR[hdri] ?? 12);
        state.hour = sky.hour;
        stage.ready = useHDRI(hdri);
    } else {
        setTimeOfDay(time ?? PRESETS[state.preset].hour);
        stage.ready = Promise.resolve();
    }
    sky.flush();
    resize();
    return stage;
}
