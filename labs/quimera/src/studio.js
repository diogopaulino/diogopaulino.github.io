/**
 * Quimera — estúdio: ciclorama, plataforma giratória, luz de três pontos, poeira e faíscas.
 *
 * Palco: `createStage` (gfx/stage.js) no modo HDRI — o céu fotográfico entra só como luz
 * ambiente/reflexo; o fundo é um ciclorama modelado (piso que sobe em curva até a parede).
 * O sol do palco fica desligado: a luz é de estúdio, fixa no mundo:
 *   principal  spot quente, 45° à esquerda e acima, com sombra
 *   preenchimento  spot frio e fraco, à direita, na altura do peito
 *   contraluz  dois spots por trás (recorte de ombros e cabelo), na cor do tema
 *   fundo      spot rasante que abre um halo na parede atrás do personagem
 * Tema claro/escuro do site troca a cor do ciclorama, o HDRI (overcast/dusk) e as luzes.
 */
import * as THREE from 'three';
import { createStage } from '../../shared/gfx/stage.js?v=18';
import { applyHDRI, pbrSet, tiledTexture } from '../../shared/gfx/assets.js';
import { revolve, loop, mesh, xf } from './sculpt.js';

export const PLINTH_TOP = 0.2;

const THEMES = {
    dark: {
        hdri: 'dusk', env: 0.4, exposure: 1.0, cyc: 0x3a3144, floor: 0x1d1726, key: 0xffe8cc, keyI: 44, fill: 0xa9bcff, fillI: 11,
        rim: 0xffa25e, rimI: 120, kick: 0xb58cff, kickI: 70, wash: 0xa87ac0, washI: 140, bloom: 0.05, vignette: 0.4, dust: 0xffd9a6, sky: 0x8a78b8, ground: 0x4a3a5a, ambI: 0.55, halo: 0xa0509a, haloI: 0.3, gloss: 0x1c1626
    },
    light: {
        hdri: 'overcast', env: 0.7, exposure: 0.95, cyc: 0xe9e2d6, floor: 0xd9d0c2, key: 0xfff3e2, keyI: 38, fill: 0xdfe8ff, fillI: 14,
        rim: 0xffffff, rimI: 45, kick: 0xffe0c0, kickI: 24, wash: 0xfff6e8, washI: 30, bloom: 0.04, vignette: 0.2, dust: 0xffffff, sky: 0xffffff, ground: 0xd8cfc0, ambI: 0.5, halo: 0xffffff, haloI: 0.12, gloss: 0xd9d0c2
    }
};

export function createStudio({ canvas, theme = 'dark', tier = 'auto', loadingManager = null }) {
    const stage = createStage({
        canvas, tier, hdri: THEMES[theme].hdri, shadows: false, fov: 30, near: 0.1, far: 60, loadingManager,
        post: { fogDensity: 0, haze: 0, rays: 0, grain: 0.01, ao: 0.75, aoRadius: 0.55, saturation: 1.05, contrast: 1.04 }
    });
    if (!stage) return null;
    const { scene, renderer } = stage;
    const low = stage.tier === 'low';
    stage.sun.visible = false;
    stage.fill.visible = false;

    // ---- ciclorama: piso (r 7 m) → curva de 2,5 m → parede → teto fechado ----
    const plaster = pbrSet('plastered_wall_04');
    const cycMat = new THREE.MeshStandardMaterial({ color: THEMES[theme].cyc, roughness: 0.95, metalness: 0, side: THREE.BackSide, normalMap: tiledTexture(plaster.normalMap, 0.6) });
    cycMat.normalScale.set(0.35, 0.35);
    const cyc = mesh(revolve([
        [0, 0], [7, 0], [8.2, 0.18], [9.1, 0.9], [9.5, 2.5], [9.5, 7], [8.5, 9.5], [5, 11], [0, 11.2]
    ], { segs: 72, sub: 6 }), cycMat);
    cyc.castShadow = false;
    scene.add(cyc);

    // ---- plataforma: base de pedra fixa + tampo de madeira que gira ----
    const slate = pbrSet('slate_floor_02');
    const stone = new THREE.MeshStandardMaterial({ color: 0xbdb6b0, roughness: 0.85, map: tiledTexture(slate.map, 1.2), normalMap: tiledTexture(slate.normalMap, 1.2), roughnessMap: tiledTexture(slate.roughnessMap, 1.2) });
    const base = mesh(revolve([
        [0, 0], [1.2, 0], [1.22, 0.012], [1.21, 0.05], [1.14, 0.062], [1.1, 0.07, 1], [1.1, 0.1], [1.08, 0.112], [0, 0.112]
    ], { segs: 96, sub: 4 }), stone);
    const K = 0.76;   // raio final do tampo ≈ 78 cm: o personagem domina o quadro
    base.scale.set(K, 1, K);
    scene.add(base);
    const oak = pbrSet('oak_wood_planks');
    const wood = new THREE.MeshPhysicalMaterial({
        color: 0xa88560, roughness: 0.6, clearcoat: 0.35, clearcoatRoughness: 0.25, map: tiledTexture(oak.map, 0.9), normalMap: tiledTexture(oak.normalMap, 0.9),
        roughnessMap: tiledTexture(oak.roughnessMap, 0.9)
    });
    const turntable = new THREE.Group();
    scene.add(turntable);
    const topG = revolve([
        [0, 0.112], [1.0, 0.112], [1.02, 0.12], [1.03, 0.15], [1.02, 0.185], [1.0, 0.198], [0.96, PLINTH_TOP], [0, PLINTH_TOP]
    ], { segs: 96, sub: 4 });
    // UV planar em metros para as tábuas correrem retas no tampo
    const tp = topG.attributes.position;
    const tuv = topG.attributes.uv;
    for (let i = 0; i < tp.count; i++) tuv.setXY(i, tp.getX(i), tp.getZ(i) + tp.getY(i));
    const deck = new THREE.Group();
    deck.scale.set(K, 1, K);
    turntable.add(deck);
    deck.add(mesh(topG, wood));
    const brass = new THREE.MeshStandardMaterial({ color: 0xd4a850, metalness: 1, roughness: 0.3 });
    deck.add(mesh(xf(loop((a) => [Math.sin(a) * 0.82, 0, Math.cos(a) * 0.82], 0.007, 96, { sx: 0.5, sz: 2 }), { p: [0, PLINTH_TOP, 0] }), brass));
    deck.add(mesh(xf(loop((a) => [Math.sin(a) * 1.032, 0, Math.cos(a) * 1.032], 0.006, 96), { p: [0, 0.15, 0] }), brass));
    const led = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffb45a, emissiveIntensity: 2.2 });
    const ledRing = mesh(xf(loop((a) => [Math.sin(a) * 1.105, 0, Math.cos(a) * 1.105], 0.005, 96), { p: [0, 0.086, 0] }), led, { shadow: false });
    ledRing.scale.set(K, 1, K);
    scene.add(ledRing);

    // sombra de contato: disco com degradê radial sob os pés
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const g2 = cv.getContext('2d');
    const grd = g2.createRadialGradient(64, 64, 4, 64, 64, 62);
    grd.addColorStop(0, 'rgba(0,0,0,0.62)');
    grd.addColorStop(0.45, 'rgba(0,0,0,0.3)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g2.fillStyle = grd;
    g2.fillRect(0, 0, 128, 128);
    const contact = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.85), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
    contact.rotation.x = -Math.PI / 2;
    contact.position.y = PLINTH_TOP + 0.003;
    turntable.add(contact);

    // degradê radial (canvas) usado no halo de fundo e no esmaecimento do piso polido
    const radial = (stops) => {
        const c = document.createElement('canvas');
        c.width = c.height = 256;
        const g = c.getContext('2d');
        const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
        for (const [k, v] of stops) gr.addColorStop(k, `rgba(255,255,255,${v})`);
        g.fillStyle = gr;
        g.fillRect(0, 0, 256, 256);
        return new THREE.CanvasTexture(c);
    };
    // halo: disco aditivo sempre atrás do personagem em relação à câmera (ver update) —
    // separa a silhueta do ciclorama sem depender do ângulo de órbita
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({
        map: radial([[0, 1], [0.35, 0.5], [0.7, 0.12], [1, 0]]), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false
    }));
    scene.add(halo);
    // piso polido em volta da plataforma: reflete o HDRI e os spots e some em degradê até o piso fosco
    const glossMat = new THREE.MeshPhysicalMaterial({
        color: 0x2a2036, roughness: 0.3, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.2, envMapIntensity: 0.3,
        alphaMap: radial([[0, 1], [0.45, 0.85], [0.8, 0.3], [1, 0]]), transparent: true, depthWrite: false
    });
    const gloss = new THREE.Mesh(new THREE.CircleGeometry(4.2, 64), glossMat);
    gloss.rotation.x = -Math.PI / 2;
    gloss.position.y = 0.004;
    gloss.receiveShadow = true;
    scene.add(gloss);

    // ---- luzes ----
    const spot = (x, y, z, tx, ty, tz, angle, pen) => {
        const l = new THREE.SpotLight(0xffffff, 1, 30, angle, pen, 2);
        l.position.set(x, y, z);
        l.target.position.set(tx, ty, tz);
        scene.add(l, l.target);
        return l;
    };
    const key = spot(-2.9, 4.3, 3.7, 0, 1.15, 0, 0.36, 0.75);
    key.castShadow = true;
    key.shadow.mapSize.setScalar(low ? 1024 : 2048);
    key.shadow.camera.near = 2;
    key.shadow.camera.far = 12;
    key.shadow.bias = -0.0003;
    key.shadow.normalBias = 0.012;
    key.shadow.radius = 3;
    const fill = spot(3.6, 1.9, 3.2, 0, 1.2, 0, 0.5, 1);
    const rim = spot(1.9, 3.6, -3.7, 0, 1.3, 0, 0.42, 0.8);
    const kick = spot(-2.6, 2.3, -3.0, 0, 1.2, 0, 0.45, 0.9);
    const wash = spot(0, 0.5, -3.2, 0, 3.4, -9.5, 0.75, 1);
    // luz de ambiente do estúdio: levanta o piso e a parede do ciclorama fora dos spots
    const amb = new THREE.HemisphereLight(0xffffff, 0x000000, 1);
    scene.add(amb);

    // ---- poeira na luz principal: só brilha dentro do cone do spot ----
    const N = low ? 90 : 260;
    const dGeo = new THREE.BufferGeometry();
    const dp = new Float32Array(N * 3);
    const ds = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) {
        dp[i * 3] = (Math.random() - 0.5) * 4.4;
        dp[i * 3 + 1] = 0.3 + Math.random() * 3.2;
        dp[i * 3 + 2] = (Math.random() - 0.5) * 4.4;
        ds[i * 2] = Math.random() * 6.283;
        ds[i * 2 + 1] = 0.5 + Math.random();
    }
    dGeo.setAttribute('position', new THREE.BufferAttribute(dp, 3));
    dGeo.setAttribute('aSeed', new THREE.BufferAttribute(ds, 2));
    dGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1.5, 0), 8);
    const dustU = {
        uTime: { value: 0 }, uKey: { value: key.position.clone() }, uDir: { value: new THREE.Vector3().subVectors(key.target.position, key.position).normalize() },
        uCos: { value: Math.cos(0.2) }, uColor: { value: new THREE.Color(THEMES[theme].dust) }, uScale: { value: 1 }
    };
    const dust = new THREE.Points(dGeo, new THREE.ShaderMaterial({
        uniforms: dustU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
            attribute vec2 aSeed; uniform float uTime; uniform vec3 uKey; uniform vec3 uDir; uniform float uCos; uniform float uScale; varying float vA;
            void main() {
                // deriva lenta: seno em cada eixo com fase própria (≈ 6 cm/s)
                vec3 p = position + vec3(sin(uTime * 0.11 + aSeed.x), sin(uTime * 0.07 + aSeed.x * 1.7) * 0.6, cos(uTime * 0.09 + aSeed.x * 2.3)) * 0.35;
                float c = dot(normalize(p - uKey), uDir);
                vA = smoothstep(uCos - 0.01, uCos + 0.035, c) * (0.45 + 0.55 * sin(uTime * aSeed.y + aSeed.x * 9.0));
                vec4 mv = modelViewMatrix * vec4(p, 1.0);
                gl_Position = projectionMatrix * mv;
                gl_PointSize = uScale * aSeed.y * 9.0 / -mv.z;
            }`,
        fragmentShader: /* glsl */ `
            uniform vec3 uColor; varying float vA;
            void main() { float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(uColor * 1.6, smoothstep(0.5, 0.05, d) * vA * 0.5); }`
    }));
    scene.add(dust);

    // ---- faíscas da troca de peça (poço fixo de 140, atualizado em CPU só enquanto vivas) ----
    const SN = 140;
    const sp = new Float32Array(SN * 3);
    const sl = new Float32Array(SN);
    const sv = new Float32Array(SN * 3);
    const sGeo = new THREE.BufferGeometry();
    sGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    sGeo.setAttribute('aLife', new THREE.BufferAttribute(sl, 1));
    sGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1.2, 0), 6);
    const sparkU = { uColor: { value: new THREE.Color(1.0, 0.72, 0.36) }, uScale: { value: 1 } };
    const sparks = new THREE.Points(sGeo, new THREE.ShaderMaterial({
        uniforms: sparkU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
            attribute float aLife; uniform float uScale; varying float vL;
            void main() { vL = aLife; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uScale * (6.0 + 22.0 * aLife) / -mv.z; }`,
        fragmentShader: /* glsl */ `
            uniform vec3 uColor; varying float vL;
            void main() { if (vL <= 0.0) discard; float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(uColor * 4.0, smoothstep(0.5, 0.0, d) * vL); }`
    }));
    sparks.frustumCulled = false;
    scene.add(sparks);
    let sparkNext = 0;
    let sparkLive = 0;
    /** Solta `count` faíscas num anel de raio r à altura y (m, mundo). */
    function burst(x, y, z, r = 0.3, count = 10) {
        for (let i = 0; i < count; i++) {
            const k = sparkNext;
            sparkNext = (sparkNext + 1) % SN;
            const a = Math.random() * 6.283;
            sp[k * 3] = x + Math.cos(a) * r;
            sp[k * 3 + 1] = y + (Math.random() - 0.5) * 0.05;
            sp[k * 3 + 2] = z + Math.sin(a) * r;
            sv[k * 3] = Math.cos(a) * (0.2 + Math.random() * 0.5);
            sv[k * 3 + 1] = 0.3 + Math.random() * 0.8;
            sv[k * 3 + 2] = Math.sin(a) * (0.2 + Math.random() * 0.5);
            sl[k] = 1;
        }
        sparkLive = 1.2;
    }

    let current = null;
    function setTheme(name) {
        const T = THEMES[name] || THEMES.dark;
        if (current === name) return;
        current = name;
        cycMat.color.set(T.cyc);
        renderer.setClearColor(T.cyc, 1);
        key.color.set(T.key);
        key.intensity = T.keyI;
        fill.color.set(T.fill);
        fill.intensity = T.fillI;
        rim.color.set(T.rim);
        rim.intensity = T.rimI;
        kick.color.set(T.kick);
        kick.intensity = T.kickI;
        wash.color.set(T.wash);
        wash.intensity = T.washI;
        amb.color.set(T.sky);
        amb.groundColor.set(T.ground);
        amb.intensity = T.ambI;
        halo.material.color.set(T.halo).multiplyScalar(T.haloI);
        glossMat.color.set(T.gloss);
        dustU.uColor.value.set(T.dust);
        dust.material.blending = name === 'light' ? THREE.NormalBlending : THREE.AdditiveBlending;
        led.emissiveIntensity = name === 'light' ? 1.2 : 2.2;
        applyHDRI(scene, renderer, T.hdri, { intensity: T.env }).then(() => {
            scene.background = null;
            applyPost();
        });
        applyPost();
    }
    function applyPost() {
        const T = THEMES[current];
        const p = stage.pipeline.params;
        p.exposure = T.exposure;
        p.bloom = T.bloom;
        p.vignette = T.vignette;
        p.fogDensity = 0;
        p.haze = 0;
        p.rays = 0;
    }
    stage.onTier(applyPost);
    stage.ready.then(() => {
        scene.background = null;
        const selected = current;
        current = null;
        setTheme(selected);
    });
    setTheme(theme);

    return {
        stage, scene, turntable, key, burst, setTheme,
        /** Foco do desfoque de fundo: nítido até ~1,3 m além do personagem; o ciclorama derrete. */
        setFocus(dist) {
            const p = stage.pipeline.params;
            p.dofFocus = dist;
            p.dofRange = 3.6;
            p.dofMax = 0.4;
        },
        update(dt, t) {
            const cam = stage.camera.position;
            const hl = Math.hypot(cam.x, cam.z) || 1;
            halo.position.set((-cam.x / hl) * 4.5, 1.5, (-cam.z / hl) * 4.5);
            halo.lookAt(cam.x, 1.5, cam.z);
            dustU.uTime.value = t;
            const h = renderer.domElement.height;
            dustU.uScale.value = h / 720;
            sparkU.uScale.value = h / 720;
            if (sparkLive > 0) {
                sparkLive -= dt;
                for (let k = 0; k < SN; k++) {
                    if (sl[k] <= 0) continue;
                    sl[k] = Math.max(0, sl[k] - dt * 1.3);
                    sv[k * 3 + 1] -= dt * 0.9;
                    sp[k * 3] += sv[k * 3] * dt;
                    sp[k * 3 + 1] += sv[k * 3 + 1] * dt;
                    sp[k * 3 + 2] += sv[k * 3 + 2] * dt;
                }
                sGeo.attributes.position.needsUpdate = true;
                sGeo.attributes.aLife.needsUpdate = true;
            }
        }
    };
}
