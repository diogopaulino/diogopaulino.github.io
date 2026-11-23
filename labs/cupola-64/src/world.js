/**
 * Ilha da Cúpola — céu físico com sol e nuvens, mar de Gerstner com arrebentação,
 * terreno splat, flora instanciada, castelo, montanha com gruta, deques flutuantes,
 * ilha no céu e canhão. Também responde às perguntas de colisão do jogo.
 *
 * Colisão (documentada):
 *   - chão      = max(superfície do terreno, topo de plataforma) — uma plataforma só
 *                 conta se o Nico estiver no máximo 0,9 m abaixo do topo (sobe degraus,
 *                 mas não atravessa um deque vindo de baixo);
 *   - sólidos   = círculos {x, z, r} e retângulos {x0, x1, z0, z1} com `top` opcional:
 *                 acima de top − 0,5 m o sólido deixa de barrar (dá para andar no telhado);
 *   - água      = profundidade (nível − terreno) > 0,45 m.
 */

import * as THREE from 'three';
import { createSky } from '../../shared/gfx/sky.js';
import { createOcean } from '../../shared/gfx/ocean.js';
import { createSunRig } from '../../shared/gfx/rig.js';
import { createTreeKit, createPalmKit, createShrubKit, instanceKit, updateWind } from '../../shared/gfx/flora.js';
import { seeded, fbm2 } from '../../shared/gfx/core.js';
import { ISLAND } from './config.js?v=14';
import { heightAt, surfaceAt, HEIGHT_GLSL, clamp } from './utils.js?v=13';
import { createTerrain, normalAt, splatAt } from './terrain.js?v=15';
import {
    createCastle,
    createCannon,
    createFlag,
    createFloatDeck,
    createLedge,
    createSkyIsland,
    createCaveEntrance
} from './models.js?v=15';

// cede a vez ao navegador entre etapas pesadas (a barra de carregamento anda de verdade)
const nextFrame = () => new Promise((r) => setTimeout(r, 0));

/** Castelo: centro em (0, 25); o portão olha para −Z (a trilha que vem da praia). */
const CASTLE = { x: 0, z: 25 };

/** Foco (o Nico) em espaço de câmera — atualizado a cada quadro em World.update. */
const occlusion = { uFocusView: { value: new THREE.Vector3(0, 0, -8) } };

/**
 * Folhagem que não tapa o jogo. A câmera orbital pode entrar numa copa ou deixar uma
 * moita entre a lente e o Nico; em vez de encher a tela de folhas, cada fragmento é
 * descartado por dither (ruído de gradiente intercalado) com opacidade
 *   a = min( smoothstep(1,2 m; 4 m; |P|),            perto da lente
 *            smoothstep(1,0 m; 2,4 m; dist(P, CF)) )  perto do segmento câmera→foco
 * onde P é o fragmento em espaço de câmera e CF o segmento até 0,9 m antes do Nico.
 * Só o passe de cor muda — a sombra projetada continua inteira.
 */
function fadeNearCamera(root) {
    root.traverse((o) => {
        const m = o.material;
        if (!m || m.userData.nearFade) return;
        m.userData.nearFade = true;
        const inner = m.onBeforeCompile;
        const key = m.customProgramCacheKey ? m.customProgramCacheKey() : '';
        m.onBeforeCompile = (shader, renderer) => {
            if (inner) inner.call(m, shader, renderer);
            shader.uniforms.uFocusView = occlusion.uFocusView;
            shader.fragmentShader = shader.fragmentShader
                .replace('#include <common>', `#include <common>
                uniform vec3 uFocusView;`)
                .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
                vec3 gfxP = -vViewPosition;
                float gfxLen = max(length(uFocusView) - 0.9, 0.01);
                vec3 gfxDir = normalize(uFocusView);
                float gfxT = clamp(dot(gfxP, gfxDir), 0.0, gfxLen);
                float gfxSeg = smoothstep(1.0, 2.4, length(gfxP - gfxDir * gfxT));
                gfxSeg = max(gfxSeg, smoothstep(gfxLen - 0.6, gfxLen, dot(gfxP, gfxDir)));
                float gfxNear = min(smoothstep(1.2, 4.0, length(gfxP)), gfxSeg);
                float gfxIgn = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
                if (gfxIgn > gfxNear) discard;`);
        };
        m.customProgramCacheKey = () => `${key}|nearFade`;
        m.needsUpdate = true;
    });
    return root;
}

export class World {
    constructor(scene, renderer, quality) {
        this.scene = scene;
        this.renderer = renderer;
        this.quality = quality;
        this.group = new THREE.Group();
        this.group.name = 'island';
        scene.add(this.group);

        this.solids = [];
        this.platforms = [];
        this._hit = { x: 0, z: 0 };
        this.cannon = null;
        this.flag = null;
        this._n = new THREE.Vector3();
    }

    async build(onProgress) {
        const step = async (p, text, fn) => {
            onProgress?.(p, text);
            await nextFrame();
            fn();
        };
        await step(0.12, 'Abrindo o céu…', () => this._sky());
        await step(0.24, 'Enchendo o mar…', () => this._ocean());
        await step(0.36, 'Erguendo o castelo…', () => this._castle());
        await step(0.5, 'Esculpindo a montanha…', () => { this._mountainBits(); this._platforms(); this._cannon(); });
        await step(0.62, 'Modelando o terreno…', () => this._terrain());
        await step(0.76, 'Plantando a ilha…', () => this._flora());
        this.sky.flush();
    }

    _sky() {
        this.sky = createSky({
            renderer: this.renderer,
            scene: this.scene,
            cloudCover: 0.36,
            turbidity: 2.2,
            rayleigh: 2.2,
            // hemisfério de baixo do IBL = luz rebatida por grama e areia (abre as faces verticais na sombra)
            ground: 0x8f9a66,
            envIntensity: 1.5
        });
        // sol de meio da manhã, atrás do ombro de quem olha o castelo: elevação 46°, azimute 40° (N→L)
        this.sky.setSun(THREE.MathUtils.degToRad(46), THREE.MathUtils.degToRad(40));
        this.rig = createSunRig(this.scene, this.sky, {
            shadows: !!this.quality.shadows, mapSize: this.quality.shadowSize, radius: this.quality.shadowRadius, depth: 260
        });
        this.sun = this.rig.sun;
        // preenchimento suave: o céu já ilumina por IBL; isto só abre as sombras mais fechadas
        this.fill = new THREE.HemisphereLight(0xcfe4ff, 0x8a8f5a, 0.55);
        this.scene.add(this.fill);
    }

    _ocean() {
        this.ocean = createOcean({
            tier: this.quality.id,
            depthGLSL: `${HEIGHT_GLSL}
                float gfxSeaDepth(vec2 xz) { return ${ISLAND.waterY.toFixed(3)} - cupolaHeight(xz); }`,
            // ondulação de enseada: comprimentos curtos, na escala de uma ilha de 100 m
            waves: [
                { angle: 0.1, length: 27, amp: 0.1, steep: 0.42 },
                { angle: -0.45, length: 15.5, amp: 0.065, steep: 0.4 },
                { angle: 0.62, length: 8.6, amp: 0.038, steep: 0.4 },
                { angle: -0.8, length: 4.7, amp: 0.02, steep: 0.35 },
                { angle: 1.05, length: 2.7, amp: 0.011, steep: 0.3 }
            ],
            surf: true,
            surfAmp: 0.1,
            // cristas a cada 2π / (k · declive) ≈ 4 m no declive de 0,25 da praia submersa
            surfK: 6.2,
            surfSpeed: 1.15,
            surfDepth: 1.7,
            // sem franja de espraiamento: nas lagoas rasas ela cobria a água inteira de branco
            swash: 0,
            deep: 0x0a4a6a,
            shallow: 0x2bb8ae,
            scatter: 0x4fd6c0,
            deepDepth: 3.4
        });
        this.ocean.mesh.position.y = ISLAND.waterY;
        this.scene.add(this.ocean.mesh);
    }

    _terrain() {
        const blocked = (x, z) => {
            if (Math.abs(x) < 6.9 && z > 16.4 && z < 30.2) return true; // castelo + escadaria
            if (Math.abs(x) < 2.3 && z >= 30.2 && z < 39.4) return true; // mirante
            if (Math.hypot(x - 16, z - 8) < 1.7) return true; // canhão
            for (const s of this.solids) {
                if (s.r && Math.hypot(x - s.x, z - s.z) < s.r + 0.25) return true;
            }
            return false;
        };
        this.terrain = createTerrain(this.quality, blocked);
        this.group.add(this.terrain.root);
        for (const s of this.terrain.solids) this.solids.push(s);
        this.blocked = blocked;
    }

    _castle() {
        const castle = createCastle();
        const base = heightAt(CASTLE.x, CASTLE.z);
        castle.position.set(CASTLE.x, base, CASTLE.z);
        castle.rotation.y = Math.PI;
        this.group.add(castle);
        this.castle = castle;
        this.castleBase = base;
        const { x: cx, z: cz } = CASTLE;

        // corpo e corpo do portão (retângulos), torres (círculos sem topo), tambor da rotunda
        this.solids.push({ x0: cx - 4.7, x1: cx + 4.7, z0: cz - 3.9, z1: cz + 3.9, top: base + 7.2 });
        this.solids.push({ x0: cx - 1.95, x1: cx + 1.95, z0: cz - 4.7, z1: cz - 3.9, top: base + 6.78 });
        for (const sx of [-1, 1]) {
            for (const sz of [-1, 1]) this._solid(cx + sx * 4.7, cz + sz * 3.9, 1.5);
        }
        this.solids.push({ x: cx, z: cz, r: 2.55, top: base + 8.4 });
        for (const z of [6.4, 9.8, 13.2]) {
            this.solids.push({ x0: cx - 1.45, x1: cx + 1.45, z0: cz + z - 0.4, z1: cz + z + 0.4, top: base + 1.24 });
        }

        this._platform(cx, base + 7.2, cz, 9.4, 7.8); // terraço
        this._platform(cx, base + 6.78, cz - 4.3, 3.9, 0.8); // topo do corpo do portão
        this.platforms.push({ x: cx, z: cz, r: 2.5, top: base + 8.4 }); // piso da rotunda
        this._platform(cx, base + 1.56, cz + 8.78, 3.2, 9.75); // mirante
        for (const [r, top] of [[3.5, 0.1], [2.75, 0.22], [2.05, 0.34]]) {
            this.platforms.push({ x: cx, z: cz - 4.7, r, top: base + top }); // escadaria em leque
        }
    }

    _mountainBits() {
        const steps = [
            [3, -14, 3.6, 4.2, 0.55, 2.4],
            [4.5, -17.2, 6.2, 3.4, 0.5, 2.2],
            [2.2, -20.4, 9.4, 3.2, 0.5, 2.2]
        ];
        steps.forEach(([x, z, y, w, h, d], i) => {
            const p = createLedge(w, h, d, i + 1);
            p.position.set(x, y, z);
            p.rotation.y = (i - 1) * 0.12;
            this.group.add(p);
            this._platform(x, y + h / 2, z, w, d);
        });

        const mouth = createCaveEntrance();
        mouth.position.set(2.6, surfaceAt(2.6, -15.3) - 0.15, -15.3);
        this.group.add(mouth);

        this.flag = createFlag();
        this.flag.position.set(4.7, heightAt(4.7, -27.3) - 0.05, -27.3);
        this.flag.rotation.y = -0.6;
        this.group.add(this.flag);
    }

    _platforms() {
        const decks = [
            [12, 4.2, 2, 3.2, 0.35, 3.2],
            [16.5, 6.8, -1.5, 2.8, 0.35, 2.8],
            [20.5, 9.4, -4.2, 2.6, 0.35, 2.6],
            [24.5, 12.2, -5.5, 3.4, 0.4, 3.4],
            // escada oeste até a moeda vermelha alta: decks 0,8 m maiores que os originais
            // (2,8/2,6/2,4) — o vão de borda a borda cai de ~3 m para ~2,2 m (modo família)
            [-12, 3.6, 8, 3.6, 0.3, 3.6],
            [-14.5, 5.8, 12.5, 3.4, 0.3, 3.4],
            [-10, 8.2, 16, 3.2, 0.3, 3.2]
        ];
        this.floaters = [];
        decks.forEach(([x, y, z, w, h, d], i) => {
            const p = createFloatDeck(w, h, d, i + 1);
            p.position.set(x, y, z);
            this.group.add(p);
            this._platform(x, y + h / 2, z, w, d);
        });

        // ilha no céu (alvo do canhão): tampo redondo de 3,5 m de raio
        const sky = createSkyIsland(6.4, 0.55);
        sky.position.set(28, 15.6, 2);
        this.group.add(sky);
        this.platforms.push({ x: 28, z: 2, r: 3.5, top: 15.6 + 0.275 });
    }

    _flora() {
        const q = this.quality;
        const rnd = seeded(640);
        // as 12 árvores originais (mesmos lugares e raios de colisão)
        const spots = [
            [-8, 10, 1.1], [10, 14, 0.9], [-14, -2, 1.25], [18, 18, 0.85],
            [-22, 8, 1], [8, -6, 0.95], [-6, 18, 0.8], [14, 6, 0.7],
            [-16, 16, 1.15], [6, 8, 0.65], [-10, -8, 1], [22, 12, 0.75]
        ];
        const kinds = [
            createTreeKit({ kind: 'round', seed: 3 }),
            createTreeKit({ kind: 'amendoeira', seed: 5 }),
            createTreeKit({ kind: 'ipe', seed: 8, flowerColor: '#ff8fb0' })
        ];
        const lists = [[], [], []];
        spots.forEach(([x, z, s], i) => {
            const k = i % 3;
            const want = 4.4 + s * 2.2;
            lists[k].push({ x, y: surfaceAt(x, z) - 0.08, z, scale: want / kinds[k].height, rot: rnd() * 6.28 });
            this._solid(x, z, 0.45 * s);
        });
        lists.forEach((list, k) => this.group.add(fadeNearCamera(instanceKit(kinds[k], list))));

        // coqueiros na areia seca (anel de praia), longe do mirante
        const palmKit = createPalmKit({ kind: 'coco', seed: 4 });
        const palms = [];
        const nPalms = Math.round(16 * q.trees);
        for (let i = 0; i < nPalms; i++) {
            const a = (i / nPalms) * Math.PI * 2 + rnd() * 0.25;
            const r = 40.5 + rnd() * 4.5;
            const x = Math.cos(a) * r;
            const z = Math.sin(a) * r;
            if (Math.abs(x) < 6 && z > 28) continue;
            if (Math.hypot(x - 3, z + 26) < 17) continue;
            palms.push({ x, y: surfaceAt(x, z) - 0.1, z, scale: (5.2 + rnd() * 1.8) / palmKit.height, rot: rnd() * 6.28, tiltX: (rnd() - 0.5) * 0.12 });
            this._solid(x, z, 0.3);
        }
        if (palms.length) this.group.add(fadeNearCamera(instanceKit(palmKit, palms)));

        // arbustos: os 5 originais + canteiros floridos junto ao castelo + moitas no gramado
        const shrubA = createShrubKit({ flowers: 26, flowerColor: '#ff7fa8', hue: 112, seed: 3, size: 1 });
        const shrubB = createShrubKit({ flowers: 0, hue: 98, seed: 7, size: 1.2 });
        const shrubC = createShrubKit({ flowers: 22, flowerColor: '#ffd84a', hue: 120, seed: 11, size: 0.9 });
        const a = [];
        const b = [];
        const c = [];
        const put = (list, x, z, s) => list.push({ x, y: surfaceAt(x, z) - 0.05, z, scale: s, rot: rnd() * 6.28 });
        for (const [x, z] of [[-4, 6], [5, 12], [-18, 2], [11, -2], [-7, -4]]) put(b, x, z, 1.1);
        for (const sx of [-1, 1]) {
            for (const z of [19.6, 18.2, 16.9]) put(sx > 0 ? a : c, sx * (4.6 + (19.6 - z) * 0.5), z, 0.85);
            for (const z of [22.5, 25, 27.5]) put(sx > 0 ? c : a, sx * 6.9, z, 0.8);
        }
        // jardim da ilha no céu (em volta do coreto)
        for (let i = 0; i < 9; i++) {
            const ang = (i / 9) * Math.PI * 2 + 0.3;
            const r = 2.5 + (i % 3) * 0.35;
            [a, c, b][i % 3].push({ x: 28 + Math.cos(ang) * r, y: 15.84, z: 2 + Math.sin(ang) * r, scale: 0.55 + (i % 2) * 0.2, rot: i * 1.7 });
        }
        const w = [0, 0, 0, 0];
        const extra = Math.round(70 * q.trees);
        for (let i = 0, tries = 0; i < extra && tries < extra * 8; tries++) {
            const ang = rnd() * Math.PI * 2;
            const r = 6 + Math.sqrt(rnd()) * 34;
            const x = Math.cos(ang) * r;
            const z = Math.sin(ang) * r;
            if (this.blocked(x, z)) continue;
            const y = surfaceAt(x, z);
            normalAt(x, z, this._n);
            splatAt(x, z, y, this._n.y, w);
            if (w[0] < 0.8 || fbm2(x * 0.12, z * 0.12, 2) < 0.48) continue;
            put([a, b, c][i % 3], x, z, 0.6 + rnd() * 0.7);
            i++;
        }
        for (const [kit, list] of [[shrubA, a], [shrubB, b], [shrubC, c]]) {
            if (list.length) this.group.add(fadeNearCamera(instanceKit(kit, list, { castShadow: true, receiveShadow: true })));
        }
    }

    _cannon() {
        this.cannon = createCannon();
        const x = 16;
        const z = 8;
        this.cannon.position.set(x, heightAt(x, z), z);
        this.cannon.rotation.y = -0.7;
        this.group.add(this.cannon);
        this.cannonPos = new THREE.Vector3(x, heightAt(x, z) + 0.6, z);
        this.cannonTarget = new THREE.Vector3(28, 16.4, 2);
        // sólido com topo: quem está dentro do canhão (ou passa por cima) não é empurrado —
        // sem o topo, o tiro nascia colidindo e perdia 65 % da velocidade a cada quadro
        this.solids.push({ x, z, r: 0.8, top: heightAt(x, z) + 1.2 });
    }

    _solid(x, z, r) {
        this.solids.push({ x, z, r });
    }

    _platform(x, top, z, w, d) {
        this.platforms.push({ x, top, z, hx: w / 2, hz: d / 2 });
    }

    groundAt(x, z, y) {
        let h = surfaceAt(x, z);
        for (const p of this.platforms) {
            const inside = p.r !== undefined
                ? Math.hypot(x - p.x, z - p.z) <= p.r + 0.12
                : Math.abs(x - p.x) <= p.hx + 0.12 && Math.abs(z - p.z) <= p.hz + 0.12;
            if (inside && y >= p.top - 0.9) h = Math.max(h, p.top);
        }
        return h;
    }

    /** y opcional: altura dos pés de quem pergunta (sólidos com `top` liberam quem está acima). */
    collide(x, z, radius, y) {
        let nx = x;
        let nz = z;
        for (const s of this.solids) {
            if (y !== undefined && s.top !== undefined && y >= s.top - 0.5) continue;
            if (s.r !== undefined) {
                const dx = nx - s.x;
                const dz = nz - s.z;
                const d = Math.hypot(dx, dz);
                const min = s.r + radius;
                if (d < min && d > 1e-4) {
                    const k = min / d;
                    nx = s.x + dx * k;
                    nz = s.z + dz * k;
                }
                continue;
            }
            const px = clamp(nx, s.x0, s.x1);
            const pz = clamp(nz, s.z0, s.z1);
            const dx = nx - px;
            const dz = nz - pz;
            const d2 = dx * dx + dz * dz;
            if (d2 >= radius * radius) continue;
            if (d2 > 1e-8) {
                const d = Math.sqrt(d2);
                nx = px + (dx / d) * radius;
                nz = pz + (dz / d) * radius;
            } else {
                // dentro do retângulo: sai pela aresta mais próxima
                const l = nx - s.x0;
                const r = s.x1 - nx;
                const b = nz - s.z0;
                const t = s.z1 - nz;
                const m = Math.min(l, r, b, t);
                if (m === l) nx = s.x0 - radius;
                else if (m === r) nx = s.x1 + radius;
                else if (m === b) nz = s.z0 - radius;
                else nz = s.z1 + radius;
            }
        }
        const r = Math.hypot(nx, nz);
        const rim = ISLAND.radius - 1.2;
        if (r > rim) {
            const k = rim / r;
            nx *= k;
            nz *= k;
        }
        // objeto reaproveitado (sem alocação por chamada): quem chama lê x/z na hora
        this._hit.x = nx;
        this._hit.z = nz;
        return this._hit;
    }

    /** Água funda o bastante para nadar (profundidade > 0,45 m) e Nico perto da lâmina. */
    isWater(x, z, y) {
        return ISLAND.waterY - surfaceAt(x, z) > 0.45 && y <= ISLAND.waterY + 0.6;
    }

    nearCannon(x, z) {
        if (!this.cannonPos) return false;
        return Math.hypot(x - this.cannonPos.x, z - this.cannonPos.z) < 1.55;
    }

    /** Normal do terreno (para deitar a sombra de contato na encosta). */
    normalAt(x, z, out) {
        return normalAt(x, z, out);
    }

    /** Altura mínima da câmera em (x, z): terreno, lâmina d'água e o volume do castelo. */
    cameraFloor(x, z) {
        let h = Math.max(surfaceAt(x, z), ISLAND.waterY + 0.2);
        const dx = Math.abs(x - CASTLE.x);
        const dz = Math.abs(z - CASTLE.z);
        if (dx < 5.2 && dz < 4.4) h = Math.max(h, this.castleBase + 8.0);
        if (Math.abs(dx - 4.7) < 2.0 && Math.abs(dz - 3.9) < 2.0) h = Math.max(h, this.castleBase + 12.5);
        return h;
    }

    cameraClearance(x, z) {
        return this.cameraFloor(x, z) + 0.6;
    }

    /**
     * @param {number} dt
     * @param {number} t tempo do mundo (s)
     * @param {THREE.Camera} camera
     * @param {THREE.Vector3} focus centro da sombra do sol (o Nico)
     */
    update(dt, t, camera, focus) {
        this.sky.update(t, dt);
        this.rig.update(focus, this.quality.shadowRadius);
        updateWind(t, 0.85 + Math.sin(t * 0.17) * 0.3);
        camera.updateMatrixWorld();
        occlusion.uFocusView.value.set(focus.x, focus.y + 0.8, focus.z).applyMatrix4(camera.matrixWorldInverse);
        this.ocean.update(t, camera, this.sky.daylight);
        // a estrela da cúpola é procurada uma vez só (getObjectByName percorre o castelo inteiro)
        if (this._cupolaStar === undefined) this._cupolaStar = this.castle?.getObjectByName('cupolaStar') || null;
        const cupola = this._cupolaStar;
        if (cupola) {
            cupola.rotation.y += dt * 1.6;
            cupola.position.y = 15.0 + Math.sin(t * 2) * 0.1;
        }
    }
}
