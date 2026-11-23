/**
 * Reino noturno: penhasco do castelo, lago com reflexo planar, viaduto de pedra,
 * floresta, serra distante, aldeia, lua grande e Via Láctea.
 *
 * Planta (metros, +Z = sul, de onde a câmera chega):
 *   castelo em (0, 0) sobre um penhasco com platô em y = 14;
 *   lago (nível 0) ao sul, centro (6, 122), raio ~104 — banha o pé do penhasco;
 *   viaduto de A (124, 86), na margem leste, até B (27, 35), no flanco do penhasco;
 *   aldeia na margem leste; serra fechando o horizonte.
 */

import * as THREE from 'three';
import { fbm2, ridged2, smoothstep, lerp, clamp, seeded } from '../../shared/gfx/core.js';
import {
    createCourse, createTerrain, createGrass, createForest, createPath, scatter, scatterModel
} from '../../shared/gfx/terrain.js';
import { GLSL_SKY_LUT } from '../../shared/gfx/sky.js';
import { createCastle, createStoneBridge, createHamlet } from './castle.js?v=6';
import { moonTexture, waterNormalTexture } from './textures.js?v=6';

export const WATER_LEVEL = 0;
export const PLATEAU_Y = 14;
export const LAKE = { x: 6, z: 122, r: 104 };
/** Direção da lua (e da luz principal): baixa, atrás e à esquerda do castelo. */
export const MOON_DIR = new THREE.Vector3(-0.5, 0.262, -0.83).normalize();
const MOON_RADIUS = 0.058; // raio angular em radianos (~3,3°: lua "de cinema", 13× a real)

export const BRIDGE_A = { x: 124, z: 86 };
export const BRIDGE_B = { x: 27, z: 35, y: 9.6 };

// ═══════════════════════════════════════════════════════════════════════════
// Relevo
// ═══════════════════════════════════════════════════════════════════════════

const ramp = createCourse([[27, 35], [17.5, 35.5], [9, 33.2], [3.2, 30.6], [0.4, 28.4]], { width: 4.2, step: 1 });
const road = createCourse([[124, 86], [138, 85], [154, 77], [170, 64], [186, 56]], { width: 3.6 });

/**
 * Altura do terreno (m).
 *   terra  = 4,5 + 7·(fbm − 0,45) + serra·(26 + 34·ridged)          serra = smoothstep(150, 250, r)
 *   lago   = lerp(terra, −7, 1 − smoothstep(0,80·R, 1,04·R, d + ruído))
 *   rocha  = lerp(h, 14 + escarpas, smoothstep(0,1, 0,7, t)),  t = 1 − smoothstep(30, 58, d_castelo + ruído)
 *   rampa  = lerp(h, 9,6 → 14 ao longo do traçado, 1 − smoothstep(2,6, 6,5, d_rampa))
 */
export function heightFn(x, z) {
    const n = fbm2(x * 0.011 + 7, z * 0.011 + 3, 4);
    const r = Math.hypot(x, z - 90);
    const rim = smoothstep(150, 250, r);
    let h = 4.5 + (n - 0.45) * 7 + rim * (26 + ridged2(x * 0.012, z * 0.012, 3) * 34);

    const wob = (fbm2(x * 0.03 + 3.1, z * 0.03 + 9.7, 3) - 0.5) * 18;
    const dl = Math.hypot((x - LAKE.x) * 0.92, z - LAKE.z) + wob;
    const lk = 1 - smoothstep(LAKE.r * 0.8, LAKE.r * 1.04, dl);
    h = lerp(h, -7 + (fbm2(x * 0.05, z * 0.05, 2) - 0.5) * 1.6, lk);

    const d0 = Math.hypot(x, z);
    if (d0 < 80) {
        const wc = (fbm2(x * 0.07 + 11, z * 0.07 + 5, 3) - 0.5) * 12 * smoothstep(24, 42, d0);
        const t = 1 - smoothstep(30, 58, d0 + wc);
        const crag = ridged2(x * 0.055 + 2, z * 0.055 + 8, 3);
        const top = PLATEAU_Y + crag * 5.5 * 4 * t * (1 - t) - (1 - t) * 1.5;
        h = lerp(h, top, smoothstep(0.1, 0.7, t));
        const dr = ramp.dist(x, z, 7);
        if (dr < 7) {
            const s = ramp.sample(x, z);
            h = lerp(h, lerp(BRIDGE_B.y, PLATEAU_Y, smoothstep(0, 0.9, s.t)), 1 - smoothstep(2.6, 6.5, s.d));
        }
    }
    return road.carve(x, z, h, { depth: 0.15, width: 3, bank: 2 });
}

/** Máscara: calçada no platô, rocha no penhasco e nas encostas, margem úmida junto à água. */
function splatFn(x, z, h, slope, out) {
    const n = fbm2(x * 0.05 + 31, z * 0.05 + 17, 3);
    const d0 = Math.hypot(x, z);
    const yard = 1 - smoothstep(27.5, 31.5, d0 + (n - 0.5) * 3);
    const flank = (1 - smoothstep(48, 62, d0)) * (1 - yard);
    const rock = Math.max(smoothstep(0.16, 0.36, slope + (n - 0.5) * 0.16), flank * smoothstep(0.25, 0.55, n + slope * 2));
    const shore = (1 - smoothstep(0.5, 1.7, h + (n - 0.5) * 0.6)) * (1 - rock);
    out[0] = yard;
    out[1] = rock * (1 - yard);
    out[2] = shore * (1 - yard);
    out[3] = 1 - smoothstep(0.05, 0.5, h);
    return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// Água com reflexo planar
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Lago. Reflexo: a cena é desenhada de novo por uma câmera espelhada no plano
 * y = nível (posição, alvo e "up" refletidos), com o plano de corte próximo
 * oblíquo colado na água (Lengyel, "Oblique View Frustum Depth Projection"):
 *   q = P⁻¹·(sgn(c.x), sgn(c.y), 1, 1);  linha 3 de P ← c·(2 / c·q) − linha 4
 * Na água:
 *   N       = normalize(Σ normais roladas em 3 escalas · ondulação)
 *   fresnel = F0 + (1 − F0)·(1 − N·V)⁵,  F0 = 0,02
 *   reflexo = textura(uv_espelho + N.xz·(0,04; 0,13))     (distorção maior na vertical → coluna de luz)
 *   brilho  = cor_lua · (N·H)^900                           (cintilação da lua)
 *   cor     = mix(corpo, reflexo, fresnel) + brilho + espuma da margem
 * Sem alvo de reflexo (tier low) o reflexo vem do LUT do céu.
 */
function createLake({ terrain, sky, tier, renderer }) {
    const SIZE = 264;
    const cx = LAKE.x;
    const cz = LAKE.z;
    // profundidade (nível − relevo) numa textura, para margem rasa e espuma
    const S = tier === 'low' ? 128 : 256;
    const dep = new Uint8Array(S * S);
    for (let j = 0; j < S; j++) {
        for (let i = 0; i < S; i++) {
            const x = cx - SIZE / 2 + ((i + 0.5) / S) * SIZE;
            const z = cz - SIZE / 2 + ((j + 0.5) / S) * SIZE;
            dep[j * S + i] = clamp((WATER_LEVEL - terrain.heightAt(x, z)) / 4, 0, 1) * 255;
        }
    }
    const depthTex = new THREE.DataTexture(dep, S, S, THREE.RedFormat);
    depthTex.magFilter = depthTex.minFilter = THREE.LinearFilter;
    depthTex.needsUpdate = true;

    const useRefl = tier !== 'low';
    const scale = tier === 'high' ? 0.5 : 0.35;
    const target = useRefl ? new THREE.WebGLRenderTarget(4, 4, {
        type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: true,
        minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter
    }) : null;
    const texMatrix = new THREE.Matrix4();

    const uniforms = {
        tRefl: { value: target?.texture ?? null },
        tNormal: { value: waterNormalTexture(tier === 'low' ? 128 : 256) },
        tDepth: { value: depthTex },
        uSkyLut: { value: sky.lut },
        uTexMatrix: { value: texMatrix },
        uTime: { value: 0 },
        uRect: { value: new THREE.Vector4(cx - SIZE / 2, cz - SIZE / 2, 1 / SIZE, 1 / SIZE) },
        uMoonDir: { value: MOON_DIR },
        uMoonColor: { value: new THREE.Color(0.75, 0.86, 1.0).multiplyScalar(2.2) },
        uDeep: { value: new THREE.Color(0.004, 0.011, 0.02) },
        uShallow: { value: new THREE.Color(0.016, 0.034, 0.04) },
        uRipple: { value: 0.045 },
        uFlash: { value: new THREE.Color(0, 0, 0) },
        uFlashPos: { value: new THREE.Vector3() }
    };
    const material = new THREE.ShaderMaterial({
        name: 'lago',
        uniforms,
        defines: useRefl ? { USE_REFL: '' } : {},
        vertexShader: /* glsl */ `
            uniform mat4 uTexMatrix;
            varying vec3 vWorld;
            varying vec4 vRefl;
            void main() {
                vec4 w = modelMatrix * vec4(position, 1.0);
                vWorld = w.xyz;
                vRefl = uTexMatrix * w;
                gl_Position = projectionMatrix * viewMatrix * w;
            }
        `,
        fragmentShader: /* glsl */ `
            ${GLSL_SKY_LUT}
            uniform sampler2D tRefl, tNormal, tDepth;
            uniform float uTime, uRipple;
            uniform vec4 uRect;
            uniform vec3 uMoonDir, uMoonColor, uDeep, uShallow, uFlash, uFlashPos;
            varying vec3 vWorld;
            varying vec4 vRefl;
            void main() {
                vec2 p = vWorld.xz;
                vec3 toCam = cameraPosition - vWorld;
                float dist = length(toCam);
                vec3 V = toCam / dist;
                vec4 a = texture2D(tNormal, p * 0.021 + uTime * vec2(0.006, 0.004));
                vec4 b = texture2D(tNormal, vec2(p.y, -p.x) * 0.062 + uTime * vec2(-0.011, 0.009));
                vec4 c = texture2D(tNormal, p * 0.19 + uTime * vec2(0.021, -0.026));
                float fine = 1.0 / (1.0 + dist * 0.02);
                vec2 nxy = ((a.xy - 0.5) * 1.1 + (b.xy - 0.5) * 0.8 + (c.xy - 0.5) * 0.7 * fine) * 2.0 * uRipple;
                vec3 N = normalize(vec3(nxy.x, 1.0, nxy.y));
                float nv = max(dot(N, V), 0.0);
                float fres = 0.02 + 0.98 * pow(1.0 - nv, 5.0);

                vec3 R = reflect(-V, N);
                R.y = abs(R.y) + 0.02;
                vec3 refl = gfxSkyLut(normalize(R));
                #ifdef USE_REFL
                vec2 uv = vRefl.xy / vRefl.w + nxy * vec2(0.5, 1.6);
                vec3 mirror = texture2D(tRefl, clamp(uv, 0.001, 0.999)).rgb;
                // o reflexo não passa pela névoa do pós: ao longe ele cede para a cor do céu no horizonte
                refl = mix(mirror, refl, smoothstep(60.0, 420.0, dist) * 0.7);
                #endif

                float depth = texture2D(tDepth, (p - uRect.xy) * uRect.zw).r;
                vec3 body = mix(uShallow, uDeep, smoothstep(0.0, 0.6, depth));
                vec3 col = mix(body, refl, fres);

                // cintilação da lua: só os microfacetes alinhados brilham
                vec3 H = normalize(V + uMoonDir);
                float spec = pow(max(dot(N, H), 0.0), 900.0);
                col += uMoonColor * spec;

                // clarão dos fogos sobre a água (reforço barato; o reflexo planar faz o resto)
                vec3 fl = uFlashPos - vWorld;
                vec3 Hf = normalize(V + normalize(fl));
                col += uFlash * pow(max(dot(N, Hf), 0.0), 120.0) * 0.6;

                // espuma fina na margem
                float foam = (1.0 - smoothstep(0.0, 0.045, depth)) * smoothstep(0.35, 0.7, c.a + a.a * 0.5);
                col += vec3(0.05, 0.065, 0.08) * foam;
                gl_FragColor = vec4(col, 1.0);
            }
        `
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE, 1, 1).rotateX(-Math.PI / 2), material);
    mesh.position.set(cx, WATER_LEVEL, cz);
    mesh.name = 'lago';
    mesh.receiveShadow = false;

    // --- câmera espelhada ---
    const vcam = new THREE.PerspectiveCamera();
    const plane = new THREE.Plane();
    const clip = new THREE.Vector4();
    const q = new THREE.Vector4();
    const camPos = new THREE.Vector3();
    const look = new THREE.Vector3();
    const rot = new THREE.Matrix4();
    const size = new THREE.Vector2();
    const NORMAL = new THREE.Vector3(0, 1, 0);

    /**
     * Desenha o reflexo. `hide`: objetos que não entram (grama, névoa, vaga-lumes).
     * Chamar antes de stage.render(); a sombra do quadro anterior é reaproveitada.
     */
    function renderReflection(scene, camera, hide = []) {
        if (!target) return;
        camPos.setFromMatrixPosition(camera.matrixWorld);
        if (camPos.y <= WATER_LEVEL + 0.05) return;
        renderer.getDrawingBufferSize(size);
        const w = Math.max(2, Math.round(size.x * scale));
        const h = Math.max(2, Math.round(size.y * scale));
        if (target.width !== w || target.height !== h) target.setSize(w, h);

        rot.extractRotation(camera.matrixWorld);
        look.set(0, 0, -1).applyMatrix4(rot).add(camPos);
        vcam.position.set(camPos.x, 2 * WATER_LEVEL - camPos.y, camPos.z);
        vcam.up.set(0, 1, 0).applyMatrix4(rot).reflect(NORMAL);
        vcam.lookAt(look.x, 2 * WATER_LEVEL - look.y, look.z);
        vcam.near = camera.near;
        vcam.far = camera.far;
        vcam.updateMatrixWorld();
        vcam.projectionMatrix.copy(camera.projectionMatrix);
        vcam.projectionMatrixInverse.copy(camera.projectionMatrixInverse);

        texMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1)
            .multiply(vcam.projectionMatrix).multiply(vcam.matrixWorldInverse);

        // plano de corte oblíquo: nada abaixo da água entra no reflexo
        plane.setFromNormalAndCoplanarPoint(NORMAL, look.set(0, WATER_LEVEL + 0.02, 0)).applyMatrix4(vcam.matrixWorldInverse);
        clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
        const pm = vcam.projectionMatrix.elements;
        q.x = (Math.sign(clip.x) + pm[8]) / pm[0];
        q.y = (Math.sign(clip.y) + pm[9]) / pm[5];
        q.z = -1;
        q.w = (1 + pm[10]) / pm[14];
        clip.multiplyScalar(2 / clip.dot(q));
        pm[2] = clip.x;
        pm[6] = clip.y;
        pm[10] = clip.z + 1;
        pm[14] = clip.w;
        vcam.projectionMatrixInverse.copy(vcam.projectionMatrix).invert();

        mesh.visible = false;
        for (const o of hide) o.userData._vis = o.visible, o.visible = false;
        const autoShadow = renderer.shadowMap.autoUpdate;
        renderer.shadowMap.autoUpdate = false;
        const prev = renderer.getRenderTarget();
        renderer.setRenderTarget(target);
        renderer.clear();
        renderer.render(scene, vcam);
        renderer.setRenderTarget(prev);
        renderer.shadowMap.autoUpdate = autoShadow;
        mesh.visible = true;
        for (const o of hide) o.visible = o.userData._vis;
    }

    return {
        mesh, uniforms, renderReflection,
        update(t) { uniforms.uTime.value = t; },
        dispose() {
            target?.dispose();
            depthTex.dispose();
            material.dispose();
            mesh.geometry.dispose();
        }
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// Céu: lua grande + Via Láctea (sobre o domo do kit)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Casca desenhada depois do domo de céu do kit (que traz atmosfera, estrelas e
 * nuvens). Acrescenta, já atenuados pela mesma máscara de nuvens do kit:
 *   lua:        disco de raio angular ρ com textura, escurecimento de limbo
 *               L = 0,55 + 0,45·√(1 − r²) e halo e^(−2,4·(r − 1))
 *   Via Láctea: faixa gaussiana e^(−18·b²) em torno de um grande círculo (b = dir·n),
 *               modulada por ruído (nuvens de estrelas e faixas escuras de poeira)
 *   estrelas:   campo fino extra, mais denso dentro da faixa
 * Mistura pré-multiplicada (ONE, 1 − α): o disco da lua cobre a lua pequena do kit.
 */
function createSkyOverlay(sky) {
    const u = sky.uniforms;
    const bandN = new THREE.Vector3(0.62, 0.42, -0.66).normalize();
    const material = new THREE.ShaderMaterial({
        name: 'ceuEstelar',
        uniforms: {
            uMoonDir: { value: MOON_DIR },
            uMoonTex: { value: moonTexture(512) },
            uMoonRadius: { value: MOON_RADIUS },
            uMoonGain: { value: 0.5 },
            uNoiseTex: u.uNoiseTex,
            uCloudCover: u.uCloudCover,
            uCloudOffset: u.uCloudOffset,
            uTime: u.uTime,
            uBandN: { value: bandN },
            uMilky: { value: 1 }
        },
        vertexShader: /* glsl */ `
            varying vec3 vDir;
            void main() {
                vDir = position;
                vec4 p = projectionMatrix * viewMatrix * vec4(position * 100.0 + cameraPosition, 1.0);
                gl_Position = p.xyww;
            }
        `,
        fragmentShader: /* glsl */ `
            uniform vec3 uMoonDir, uBandN;
            uniform sampler2D uMoonTex, uNoiseTex;
            uniform float uMoonRadius, uMoonGain, uCloudCover, uTime, uMilky;
            uniform vec2 uCloudOffset;
            varying vec3 vDir;

            float hash3(vec3 p) {
                p = fract(p * 0.3183099 + 0.1);
                p *= 17.0;
                return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
            }
            // mesma densidade de nuvens do domo do kit (sky.js), para a lua e a Via Láctea ficarem atrás delas
            float cloudNoise(vec2 uv) {
                float n = texture2D(uNoiseTex, uv).r * 0.5;
                n += texture2D(uNoiseTex, uv * 2.13 + 0.37).r * 0.26;
                n += texture2D(uNoiseTex, uv * 4.71 + 0.11).r * 0.14;
                n += texture2D(uNoiseTex, uv * 9.37 + 0.63).r * 0.10;
                return n;
            }
            float cloudAlpha(vec3 dir) {
                if (dir.y < 0.012 || uCloudCover <= 0.001) return 0.0;
                vec2 uv = dir.xz / (dir.y + 0.11) * 0.11 + uCloudOffset;
                float big = texture2D(uNoiseTex, uv * 0.31 + 0.5).r;
                float cover = uCloudCover * (0.55 + 0.9 * big);
                float d = smoothstep(1.0 - cover, 1.0 - cover + 0.32, cloudNoise(uv));
                return d * smoothstep(0.012, 0.16, dir.y);
            }
            void main() {
                vec3 dir = normalize(vDir);
                float ca = cloudAlpha(dir);
                float up = smoothstep(-0.01, 0.2, dir.y);

                // ---- Via Láctea ----
                float b = dot(dir, uBandN);
                vec3 bx = normalize(cross(uBandN, vec3(0.0, 1.0, 0.0)));
                vec3 by = cross(uBandN, bx);
                float ang = atan(dot(dir, by), dot(dir, bx));
                vec2 q = vec2(ang * 0.35, b * 1.4);
                float n1 = texture2D(uNoiseTex, q * 1.3 + 0.21).r;
                float n2 = texture2D(uNoiseTex, q * 3.7 + 0.57).r;
                float n3 = texture2D(uNoiseTex, q * 9.1 + 0.13).g;
                float band = exp(-b * b * 18.0);
                float core = exp(-b * b * 90.0);
                float dustLane = smoothstep(0.42, 0.62, n2 * 0.6 + n1 * 0.4) * core;
                float glow = band * (0.25 + 0.9 * n1 * n1) + core * 0.5 * n3;
                glow *= 1.0 - 0.75 * dustLane;
                vec3 milky = mix(vec3(0.42, 0.52, 0.86), vec3(0.95, 0.8, 0.66), core * n1) * glow * 0.034;

                // estrelas finas, mais densas na faixa
                vec3 sp = dir * 430.0;
                float h = hash3(floor(sp));
                float thr = mix(0.985, 0.94, band);
                float st = smoothstep(thr, 1.0, h) * smoothstep(0.38, 0.0, length(fract(sp) - 0.5));
                float tw = 0.75 + 0.25 * sin(uTime * (1.5 + h * 6.0) + h * 50.0);
                vec3 stars = mix(vec3(0.72, 0.82, 1.0), vec3(1.0, 0.88, 0.72), fract(h * 17.0)) * st * tw * 0.55;

                vec3 add = (milky * uMilky + stars) * up * (1.0 - ca);

                // ---- lua ----
                float mm = dot(dir, uMoonDir);
                vec3 mx = normalize(cross(uMoonDir, vec3(0.0, 1.0, 0.0)));
                vec3 my = cross(mx, uMoonDir);
                vec2 mp = vec2(dot(dir, mx), dot(dir, my)) / uMoonRadius;
                float r = length(mp);
                float front = step(0.0, mm);
                float disc = (1.0 - smoothstep(0.985, 1.0, r)) * front;
                float limb = sqrt(max(1.0 - r * r, 0.0));
                vec3 tex = texture2D(uMoonTex, mp * 0.5 + 0.5).rgb;
                vec3 moon = tex * (0.55 + 0.45 * limb) * vec3(1.0, 0.97, 0.9) * uMoonGain;
                float halo = exp(-max(r - 1.0, 0.0) * 2.4) * front * (1.0 - disc);
                vec3 haloCol = vec3(0.34, 0.44, 0.62) * halo * 0.07;

                float veil = 1.0 - ca * 0.9;
                float alpha = disc * veil;
                vec3 rgb = moon * alpha + add * (1.0 - disc) + haloCol * (1.0 - ca * 0.5);
                gl_FragColor = vec4(rgb, alpha);
            }
        `,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        depthFunc: THREE.LessEqualDepth,
        blending: THREE.CustomBlending,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
        blendSrcAlpha: THREE.OneFactor,
        blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
        fog: false
    });
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 3), material);
    mesh.frustumCulled = false;
    mesh.renderOrder = -10; // primeiro entre os transparentes: fagulhas e névoa passam na frente
    mesh.name = 'ceuEstelar';
    return { mesh, material };
}

// ═══════════════════════════════════════════════════════════════════════════
// Serra distante
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Anel de montanhas além do terreno, para fechar o horizonte em qualquer órbita.
 *   pico(θ) = 20 + 44·fbm(θ) · (1 − 0,55·janela da lua)     (a serra baixa onde a lua nasce)
 */
function createMountains() {
    const N = 160;
    const radii = [190, 250, 310, 380, 470, 600];
    const prof = [-8, 0.22, 0.62, 1, 0.55, -0.05];
    const pos = [];
    const col = [];
    const idx = [];
    const moonAz = Math.atan2(MOON_DIR.x, MOON_DIR.z);
    for (let i = 0; i <= N; i++) {
        const a = (i / N) * Math.PI * 2;
        const dAz = Math.atan2(Math.sin(a - moonAz), Math.cos(a - moonAz));
        const dip = 1 - 0.55 * Math.exp(-dAz * dAz * 5);
        const peak = (20 + 44 * fbm2(Math.cos(a) * 2.2 + 5, Math.sin(a) * 2.2 + 9, 4)) * dip;
        for (let k = 0; k < radii.length; k++) {
            const jag = k === 3 ? (fbm2(Math.cos(a) * 9 + 1, Math.sin(a) * 9 + 4, 3) - 0.5) * 16 * dip : 0;
            const rr = radii[k] + (fbm2(Math.cos(a) * 4 + k, Math.sin(a) * 4, 2) - 0.5) * 30;
            const y = k === 0 ? prof[0] : prof[k] * peak + jag;
            pos.push(Math.sin(a) * rr, y, 90 + Math.cos(a) * rr);
            const shade = 0.5 + 0.5 * fbm2(a * 7 + k * 3, k * 1.7, 2);
            col.push(0.07 * shade + 0.02, 0.09 * shade + 0.025, 0.1 * shade + 0.03);
        }
        if (i < N) {
            for (let k = 0; k < radii.length - 1; k++) {
                const p = i * radii.length + k;
                const n = p + radii.length;
                idx.push(p, p + 1, n, n, p + 1, n + 1);
            }
        }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, side: THREE.DoubleSide }));
    mesh.name = 'serra';
    return mesh;
}

// ═══════════════════════════════════════════════════════════════════════════
// Luzes falsas (tochas, lampiões, janelas da aldeia)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Pontos aditivos com núcleo e halo; tamanho em metros (atenuado pela distância,
 * com piso em pixels para o lampião distante não sumir):
 *   px = max(piso, tamanho · escala / −z_view)
 *   tremor = 0,88 + 0,12·sin(t·(5 + 7s) + 40s)
 */
function createLamps(list) {
    const n = list.length;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const aux = new Float32Array(n * 2);
    const c = new THREE.Color();
    list.forEach((l, i) => {
        pos.set([l.x, l.y, l.z], i * 3);
        c.set(l.color);
        col.set([c.r, c.g, c.b], i * 3);
        aux[i * 2] = l.size;
        aux[i * 2 + 1] = Math.random();
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aLamp', new THREE.BufferAttribute(aux, 2));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    const uniforms = { uScale: { value: 600 }, uTime: { value: 0 }, uGain: { value: 1 } };
    const mat = new THREE.ShaderMaterial({
        name: 'lampioes',
        uniforms,
        vertexShader: /* glsl */ `
            attribute vec3 aColor;
            attribute vec2 aLamp;
            uniform float uScale, uTime;
            varying vec3 vColor;
            void main() {
                vec4 mv = modelViewMatrix * vec4(position, 1.0);
                float flick = 0.88 + 0.12 * sin(uTime * (5.0 + aLamp.y * 7.0) + aLamp.y * 40.0);
                vColor = aColor * flick;
                gl_PointSize = clamp(aLamp.x * 2.6 * uScale / max(0.5, -mv.z), 3.0, 160.0);
                gl_Position = projectionMatrix * mv;
            }
        `,
        fragmentShader: /* glsl */ `
            uniform float uGain;
            varying vec3 vColor;
            void main() {
                vec2 p = gl_PointCoord * 2.0 - 1.0;
                float d = dot(p, p);
                if (d > 1.0) discard;
                float core = exp(-d * 40.0);
                float halo = exp(-d * 5.0) * 0.16 * (1.0 - d);
                gl_FragColor = vec4(vColor * (core * 2.2 + halo) * uGain, 1.0);
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    const points = new THREE.Points(geo, mat);
    points.name = 'lampioes';
    points.renderOrder = 5;
    return { points, uniforms };
}

// ═══════════════════════════════════════════════════════════════════════════
// Reino
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Monta o mundo. `stage` é o palco do kit (createStage).
 * @returns {Promise<object>} ver objeto no fim
 */
export async function createKingdom(stage, onBuilt) {
    const tier = stage.tier;
    const low = tier === 'low';
    const scene = stage.scene;

    // ---------- céu: lua baixa atrás do castelo ----------
    const sky = stage.sky;
    const aimMoon = () => {
        sky.moonDir.copy(MOON_DIR);
        sky.lightDir.copy(MOON_DIR);
        sky.setClouds(0.3);
    };
    aimMoon();
    const overlay = createSkyOverlay(sky);
    scene.add(overlay.mesh);

    // ---------- terreno ----------
    const terrain = createTerrain({
        size: 400, center: [0, 90], heightFn, splatFn, tier,
        layers: [
            { set: 'leafy_grass', scale: 3.4, tint: 0xa9c284 },
            { set: 'cobblestone_floor_08', scale: 3.2 },
            { set: 'cliff_side', scale: 9, tint: 0x8e9299 },
            { set: 'mossy_rock', scale: 5 }
        ]
    });
    scene.add(terrain.object);
    stage.follow(terrain);
    createPath({ terrain, course: ramp, width: 4, ruts: false });
    createPath({ terrain, course: road, ruts: true });

    const mountains = createMountains();
    scene.add(mountains);

    // ---------- lago ----------
    const lake = createLake({ terrain, sky, tier, renderer: stage.renderer });
    scene.add(lake.mesh);

    // ---------- castelo ----------
    const castle = createCastle({ tier });
    castle.group.position.y = PLATEAU_Y;
    scene.add(castle.group);

    // ---------- viaduto ----------
    const ay = terrain.heightAt(BRIDGE_A.x, BRIDGE_A.z) + 0.25;
    const bridge = createStoneBridge({ ax: BRIDGE_A.x, az: BRIDGE_A.z, ay, bx: BRIDGE_B.x, bz: BRIDGE_B.z, by: BRIDGE_B.y + 0.15, floor: -9 });
    scene.add(bridge.group);

    // ---------- aldeia ----------
    const rnd = seeded(12);
    const houses = [];
    const spots = [[150, 92], [160, 84], [171, 78], [146, 70], [158, 66], [168, 58], [181, 66], [176, 90], [188, 80], [152, 104], [165, 100], [140, 98], [183, 48], [193, 62]];
    for (const [x, z] of spots) {
        if (terrain.heightAt(x, z) < 1.2 || road.dist(x, z, 6) < 4.5) continue;
        houses.push({ x, z, y: terrain.heightAt(x, z), ry: rnd() * Math.PI * 2, w: 5 + rnd() * 1.8, l: 6.5 + rnd() * 3, h: rnd() < 0.5 ? 3.4 : 5.2 });
    }
    houses.push({ x: 163, z: 73, y: terrain.heightAt(163, 73), ry: -1.9, w: 6.5, l: 12, h: 6.2, church: true });
    const hamlet = createHamlet(houses);
    scene.add(hamlet.group);

    // ---------- luzes falsas ----------
    const lampList = [
        ...castle.lamps.map((l) => ({ ...l, y: l.y + PLATEAU_Y })),
        ...bridge.lamps,
        ...hamlet.lamps
    ];
    const lamps = createLamps(lampList);
    scene.add(lamps.points);

    // ---------- vegetação ----------
    const offCastle = (x, z) => smoothstep(56, 66, Math.hypot(x, z));
    const offVillage = (x, z) => 1 - (1 - smoothstep(26, 34, Math.hypot(x - 166, z - 76))) * 0.92;
    const clump = (x, z) => 0.25 + 0.75 * smoothstep(0.36, 0.6, fbm2(x * 0.016 + 3, z * 0.016 + 8, 3));
    const trees = scatter({
        terrain, count: low ? 340 : 820, minDist: low ? 7.5 : 5.6, seed: 4, slopeMax: 0.34, heightMin: 1.3,
        keepOff: [road, ramp], margin: 4,
        maskFn: (x, z) => offCastle(x, z) * offVillage(x, z) * clump(x, z)
    });
    const forest = createForest({
        terrain, renderer: stage.renderer, tier, seed: 5, placements: trees,
        lodDistance: low ? 30 : tier === 'high' ? 62 : 44,
        species: [{ kind: 'pinheiro', weight: 5, scale: [0.85, 1.35] }, { kind: 'carvalho', weight: 2.2 }, { kind: 'betula', weight: 0.8 }]
    });
    scene.add(forest.object);

    const grass = createGrass({
        terrain, tier, dryness: 0.35,
        colors: { base: 0x1f3a1e, tip: 0x6f9a52, dry: 0x7d8a52 },
        flowers: low ? false : { density: 0.5 }
    });
    scene.add(grass.object);

    const add = (g) => g && scene.add(g);
    const props = Promise.all([
        scatterModel({
            terrain, preset: 'rochas', count: low ? 16 : 46, seed: 6, slopeMax: 0.8, heightMin: -0.6, dry: false, keepOff: [road, ramp],
            maskFn: (x, z, h) => (h < 2.2 ? 1 : 0.12) * (Math.hypot(x, z) > 50 ? 1 : 0), scale: [0.6, 1.7]
        }),
        scatterModel({ terrain, preset: 'pedregulhos', count: low ? 10 : 30, seed: 7, heightMin: 0.2, keepOff: [road, ramp], maskFn: (x, z) => (Math.hypot(x, z) > 60 ? 1 : 0) }),
        low ? null : scatterModel({ terrain, preset: 'arbustos', count: 90, seed: 8, heightMin: 1.2, keepOff: [road, ramp], maskFn: (x, z) => offCastle(x, z) * clump(x, z) })
    ]).then((groups) => groups.forEach(add));

    // ---------- luz: holofotes quentes na fachada + lanterna do portão ----------
    // Posições baixas, à frente; sem sombra (o luar já projeta a do castelo).
    const floods = [];
    const floodDefs = low ? [[0, 5, 62, 1500]] : [[-34, 4, 58, 800], [30, 5, 56, 800], [2, 20, 44, 380]];
    for (const [x, y, z, power] of floodDefs) {
        const s = new THREE.SpotLight(0xffc592, 0, 190, 0.62, 0.9, 1.6);
        s.position.set(x, y, z);
        s.target.position.set(x * 0.2, PLATEAU_Y + 24, -2);
        s.userData.power = power;
        scene.add(s, s.target);
        floods.push(s);
    }
    const gateLight = new THREE.PointLight(0xff9a48, 0, 34, 1.7);
    gateLight.position.set(0, PLATEAU_Y + 4.4, 30.5);
    scene.add(gateLight);

    // quem chama mantém terrain/forest.update rodando enquanto os impostores assam
    onBuilt?.({ terrain, forest });
    await Promise.all([terrain.ready, forest.ready, castle.ready, props]);

    const star = castle.anchors.star.clone().setY(castle.anchors.star.y + PLATEAU_Y);
    return {
        terrain, lake, castle, forest, grass, bridge, hamlet, lamps, overlay, mountains, ramp, road,
        /** Para a colisão do passeio: troncos ({x,z,s}), casas ({x,z,w,l,ry}) e o tabuleiro do viaduto. */
        trees, houses,
        deck: { ax: BRIDGE_A.x, az: BRIDGE_A.z, ay, bx: BRIDGE_B.x, bz: BRIDGE_B.z, by: BRIDGE_B.y + 0.15, width: 4.4 },
        /** Posição de mundo da estrela no topo da menagem. */
        star,
        donjon: { ...castle.anchors.donjon, top: castle.anchors.donjon.top + PLATEAU_Y, gallery: castle.anchors.donjon.gallery + PLATEAU_Y },
        moonTower: { ...castle.anchors.moonTower, top: castle.anchors.moonTower.top + PLATEAU_Y },
        aimMoon,
        /**
         * "O castelo acende": k ∈ [0, 1] liga janelas (uma a uma), holofotes e portão.
         *   holofote = potência · k²        (entra macio)
         */
        setGlow(k) {
            castle.setGlow(k);
            const kk = k * k;
            for (const s of floods) s.intensity = s.userData.power * kk;
            gateLight.intensity = 110 * k;
            lamps.uniforms.uGain.value = 0.35 + 0.65 * k;
        },
        update(dt, t, camera) {
            terrain.update(camera);
            forest.update(camera);
            grass.update(camera, dt);
            lake.update(t);
            castle.update(t);
            lamps.uniforms.uTime.value = t;
            lamps.uniforms.uScale.value = stage.renderer.domElement.height / (2 * Math.tan((camera.fov * Math.PI) / 360));
        },
        /** Objetos fora do reflexo do lago. */
        reflectionHidden: [grass.object]
    };
}
