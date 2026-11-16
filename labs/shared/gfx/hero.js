/**
 * gfx/hero — personagens humanoides "herói" para terceira pessoa (three.js r185).
 *
 * Tudo é gerado por código numa única SkinnedMesh de 45 ossos: corpo, cabeça esculpida (crânio, mandíbula,
 * órbitas, nariz, lábios, orelhas), globos oculares com íris/pupila e verniz, pálpebras que piscam, boca que
 * abre (com dentes), mãos com dedos, cabelo/barba em casca com fios, roupas com volume, armadura, capa com
 * cadeia de ossos. A técnica é a do human.js (loft de anéis superelípticos com cor por vértice e pesos de
 * skin), levada a 24–56 segmentos, com UV em metros e materiais PBR de assets.js.
 *
 * USO
 *   import { createHero, HERO_PRESETS } from '../../shared/gfx/hero.js';
 *   const hero = createHero({ preset: 'knight', detail: 2 });
 *   scene.add(hero.object);                                   // Group; pés em y=0, frente = +Z local
 *   await hero.equip({ handR: 'sword', handL: 'shield' });     // opcional (carrega glTF de assets.js)
 *   // no loop (sem alocação por quadro):
 *   state.mode = moving ? 'run' : 'idle'; state.speed = velocidadeEmMetrosPorSegundo;
 *   hero.update(dt, state);
 *
 * createHero(options) → {
 *   object        THREE.Group raiz (posicione/gire/escale este). Pés em y=0, olha para +Z.
 *   mesh          SkinnedMesh interna (castShadow/receiveShadow ligados; boundingSphere fixa e folgada)
 *   bones         { nome: THREE.Bone } — hips spine chest neck head jaw eyeL/R lidL/R browL/R mouthL/R
 *                 clav|arm|fore|hand|fingA|fingB|thumb + L/R · thigh|shin|foot|toe + L/R ·
 *                 cape1..4 skirt hair1 hair2 beard hat
 *   sockets       { handR, handL, back, head, hipL, hipR, waist(=hipL) } — Object3D presos aos ossos
 *   height        altura final (m) · scale: fator interno · eyeHeight · seatHeight (assento em sit/ride)
 *   triangles, drawCalls   custo medido desta instância
 *   mode, phase, done, time   estado atual (done = modo de disparo único chegou a 1)
 *   guardL        true = braço esquerdo em guarda (ligado sozinho ao equipar 'shield' em handL)
 *   update(dt, state)      anima (ver ESTADO)
 *   setLook(dirMundo|null) · lookAt(pontoMundo|null)   olhar: olhos 40 %, cabeça e pescoço o resto (±72°)
 *   setExpression({ smile, jaw, brow, blink })          somada à expressão do modo
 *   attach(socket, obj, { position, rotation, order, scale, worldScale=true, upright }) · detach(socket)
 *   equip({ socket: 'sword'|'shield'|'lantern'|'basket'|'axe'|'hammer' | { model, load, position, … } | null })
 *                 → Promise<{ socket: Object3D }>; ver HERO_ITEMS
 *   dispose()
 * }
 * poseHero(hero, mode, phase, amount)   baixo nível: posa na hora, sem mistura (como poseHuman)
 *
 * OPÇÕES (todas opcionais; `preset` aplica um de HERO_PRESETS e o resto sobrescreve)
 *   detail      0 multidão (1 draw call, sem textura) · 1 NPC (2) · 2 herói (3–4)
 *   height      m; padrão pela espécie/idade/sexo        sex 'm'|'f'        age 'adult'|'child'|'elder'
 *   species     human | elf | dwarf | hobbit | orc | goblin | ogre
 *   build       −1 magro … +1 forte      fat 0…1
 *   proportions { legs, torso, arms, head, shoulders, hips, waist, bulk, depth, belly, bust, hands, feet,
 *                 neck, neckLen, hunch, armOut }  (multiplicadores do adulto canônico; ver PROP0)
 *   face        { jaw, chin, cheek, brow, nose, noseW, lips, mouthW, eye, eyeGap, cran, fat, ear (ponta),
 *                 earOut, earSize, tusks, tilt, blush, lash }  (ver FACE0)
 *   skin, hair, eyeColor, lipColor   cores (hex)       brows 0…2
 *   hairStyle   short | buzz | bald | balding | long | bob | braids | bun | ponytail | curly | wild | mohawk
 *   beard       none | stubble | mustache | goatee | full | long | braided
 *   top         none | shirt | tunic | dress | robe | mail        sleeves long | short | none | puff | wide
 *   bottom      pants | shorts | breeches | skirt | loincloth | none
 *   shoes       boots | tall | shoes | barefoot | sabatons
 *   topColor, trimColor, bottomColor, shoeColor, belt (cor|null), buckle, vest (cor|null), apron (cor|null)
 *   cape        none | short | long   + capeColor · mantle (capelete) · fur (gola de arminho) · hood none|down|up
 *   armor       none | plate (completa) | half (peitoral+ombreiras+braçais) | leather   + armorColor
 *   tabard      cor|null (sobreveste)      gloves none | leather | gauntlet (+ gloveColor)
 *   hat         none | helm | greathelm | kettle | wizard | crown | tiara | straw | scarf | bandana | beret | cap
 *   eyepatch    bool        fabricTex   'weave' (padrão: trama neutra procedural) ou conjunto PBR de assets.js
 *   hardTex     conjunto PBR de couro/metal (padrão brown_leather; rusty_metal_02 com armadura de placas)
 *   face.freckles 0|1 sardas · pele tem textura procedural (manchas + poros; rugas finas em age:'elder')
 *
 * PRESETS (HERO_PRESETS): knight, princess, peasant, peasantWoman, redHood (menina de capa), villageBoy,
 *   wizard, king, guard, pirate, giant, orc, goblin, elf, hobbit, dwarf, elder (velho aldeão), witch.
 *
 * ESTADO — hero.update(dt, state); reutilize o mesmo objeto. Campos:
 *   mode        chave de HERO_MODES (padrão 'idle'). Troca de modo mistura em `blend` s (padrão 0,22).
 *   speed       gait: velocidade no mundo (m/s) — a fase avança pelo comprimento real do passo, sem patinar;
 *               cycle: multiplicador do ritmo.
 *   phase       fixa a fase à mão (rad nos cíclicos; 0..1 em jump/attack/hit/die; s nos demais).
 *   amount      0..1 amplitude do passo (padrão derivado de speed). Em carry/hold, 0 = parado.
 *   duration    s para os modos de disparo único          blend   s de mistura na troca
 *   upper, upperPhase, upperAmount   sobrepõe braços/tronco de outro modo à locomoção
 *               (ex.: { mode: 'walk', upper: 'hold' } · { mode: 'run', upper: 'attack', upperPhase: t })
 *   smile, jaw, brow, blink, gripL, gripR   ajustes diretos (0..1; brow −1 bravo … 1 surpreso)
 * MODOS
 *   time    idle · fall · block · sit · wave · talk · cheer
 *   gait    walk (1,4 m/s) · run (4,6) · sneak (0,8) · carry (caixa com as duas mãos) · hold (lanterna erguida)
 *   cycle   climb (escada/pé de feijão) · row (remo) · ride (montado) · swim (crawl; corpo na altura da origem)
 *   once    jump (0–0,3 agacha · 0,3–0,45 impulso · ar · 0,8–1 aterrissa — o jogo move a raiz em Y)
 *           attack (golpe de espada da mão direita) · hit · die (termina deitado; fica em phase=1)
 *   Em sit/ride/row a pelve desce até a altura do assento (hero.seatHeight); posicione a raiz no chão.
 *
 * SOCKETS — eixos locais (para modelos próprios via attach):
 *   handR / handL   origem no centro do punho fechado; +Y sai pelo lado do polegar (direção da lâmina),
 *                   +Z é o dorso da mão, X corre pelo antebraço. Objeto na mão fecha os dedos sozinho.
 *   back            entre as escápulas; +Y para cima, +Z para trás      head   topo do crânio
 *   hipL / hipR     lateral do cinto; eixos da pelve
 *   `attach` desfaz a escala do personagem por padrão (objeto em tamanho real); passe worldScale:false para
 *   herdar a escala (espada do gigante cresce com ele). `upright:true` mantém o prumo (lanterna).
 *
 * CUSTO (medido): detail 2 = 14–22 mil triângulos, 3–4 draw calls · detail 1 = 6–10 mil, 2 · detail 0 =
 *   1,6–3,2 mil, 1 (cavaleiro e anão de armadura são os mais caros). A sombra repete os draw calls.
 *   Geometria é cacheada por conjunto de opções: N heróis iguais compartilham buffers e materiais.
 */
import * as THREE from 'three';
import { pbrMaterial, loadModel } from './assets.js';

const PI = Math.PI;
const TAU = PI * 2;
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
/** smoothstep que aceita bordas invertidas (a > b). */
const ss = (a, b, x) => {
    const t = clamp((x - a) / (b - a));
    return t * t * (3 - 2 * t);
};
const gs = (d, s) => Math.exp(-(d * d) / (s * s));
const spow = (v, e) => (v < 0 ? -Math.pow(-v, e) : Math.pow(v, e));
const hash = (n) => {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
};
const vnoise = (x) => {
    const i = Math.floor(x);
    const f = x - i;
    return lerp(hash(i), hash(i + 1), f * f * (3 - 2 * f));
};
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------------------
// Esqueleto: [nome, índice do pai]. A ordem é parte do contrato interno (braço =
// clav+1, antebraço = clav+2 …), não reordene.
// ---------------------------------------------------------------------------
const BONES = [
    ['hips', -1], ['spine', 0], ['chest', 1], ['neck', 2], ['head', 3], ['jaw', 4],
    ['eyeL', 4], ['eyeR', 4], ['lidL', 4], ['lidR', 4], ['browL', 4], ['browR', 4], ['mouthL', 4], ['mouthR', 4],
    ['clavL', 2], ['armL', 14], ['foreL', 15], ['handL', 16], ['fingAL', 17], ['fingBL', 18], ['thumbL', 17],
    ['clavR', 2], ['armR', 21], ['foreR', 22], ['handR', 23], ['fingAR', 24], ['fingBR', 25], ['thumbR', 24],
    ['thighL', 0], ['shinL', 28], ['footL', 29], ['toeL', 30],
    ['thighR', 0], ['shinR', 32], ['footR', 33], ['toeR', 34],
    ['cape1', 2], ['cape2', 36], ['cape3', 37], ['cape4', 38],
    ['skirt', 0], ['hair1', 4], ['hair2', 41], ['beard', 5], ['hat', 4]
];
const NB = BONES.length;
const B = Object.fromEntries(BONES.map((b, i) => [b[0], i]));

/** Interpola uma tabela [y, ...colunas] (y crescente) por Catmull-Rom não uniforme. */
function sampleTab(T, y, out) {
    const n = T.length;
    if (y <= T[0][0]) {
        for (let c = 1; c < T[0].length; c++) out[c - 1] = T[0][c];
        return;
    }
    if (y >= T[n - 1][0]) {
        for (let c = 1; c < T[0].length; c++) out[c - 1] = T[n - 1][c];
        return;
    }
    let i = 0;
    while (T[i + 1][0] < y) i++;
    const a = T[i];
    const b = T[i + 1];
    const p = T[i > 0 ? i - 1 : i];
    const q = T[i + 2 < n ? i + 2 : i + 1];
    const h = b[0] - a[0];
    const t = (y - a[0]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    for (let c = 1; c < a.length; c++) {
        const m0 = ((b[c] - p[c]) / (b[0] - p[0])) * h;
        const m1 = ((q[c] - a[c]) / (q[0] - a[0])) * h;
        out[c - 1] = (2 * t3 - 3 * t2 + 1) * a[c] + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * b[c] + (t3 - t2) * m1;
    }
}

/** Linhas (y decrescente) entre y1 (topo) e y0, passando pelas chaves da tabela e subdividindo por `gap`. */
function rowsOf(T, y0, y1, gap, minGap = 0) {
    const ks = [y1];
    for (let i = T.length - 1; i >= 0; i--) {
        const y = T[i][0];
        if (y < y1 - 1e-4 && y > y0 + 1e-4 && ks[ks.length - 1] - y >= minGap && y - y0 >= minGap) ks.push(y);
    }
    ks.push(y0);
    const out = [ks[0]];
    for (let i = 1; i < ks.length; i++) {
        const d = ks[i - 1] - ks[i];
        const n = Math.max(1, Math.round(d / gap));
        for (let k = 1; k <= n; k++) out.push(ks[i - 1] - (d * k) / n);
    }
    return out;
}

// ---------------------------------------------------------------------------
// Construtor de malha: tudo é uma grade (nu × nv) preenchida por callback.
// Cada vértice leva posição, cor, UV (m), aPbr (rugosidade, metal, verniz) e
// até 4 pesos de skin. A orientação das faces é resolvida sozinha (para fora de
// um ponto interno) e as normais são soldadas por posição dentro da peça — por
// isso costura de UV e polos não aparecem.
// ---------------------------------------------------------------------------
const VX = { p: V3(), c: new THREE.Color(), u: 0, v: 0, r: 0.8, m: 0, k: 0, w: new Float32Array(8), n: V3(), nk: 0 };
const w1 = (V, a) => {
    V.w[0] = a;
    V.w[1] = 1;
};
const w2 = (V, a, b, k) => {
    V.w[0] = a;
    V.w[1] = 1 - k;
    V.w[2] = b;
    V.w[3] = k;
};
/** Acrescenta um osso com peso k, reescalando os anteriores por (1 − k). */
const wAdd = (V, b, k) => {
    if (k <= 0.001) return;
    let free = -1;
    for (let i = 0; i < 8; i += 2) {
        if (V.w[i + 1] > 0) V.w[i + 1] *= 1 - k;
        else if (free < 0) free = i;
    }
    if (free < 0) return;
    V.w[free] = b;
    V.w[free + 1] = k;
};

class Builder {
    constructor(slotMap) {
        this.pos = [];
        this.col = [];
        this.uv = [];
        this.pbr = [];
        this.si = [];
        this.sw = [];
        this.idx = {};
        this.pieces = [];
        this.nt = [];   // [índice, nx, ny, nz, peso]: normal-alvo para esconder emendas entre peças
        this.n = 0;
        this.slotMap = slotMap;
    }

    push(V) {
        this.pos.push(V.p.x, V.p.y, V.p.z);
        this.col.push(V.c.r, V.c.g, V.c.b);
        this.uv.push(V.u, V.v);
        this.pbr.push(V.r, V.m, V.k);
        if (V.nk > 0) this.nt.push(this.n, V.n.x, V.n.y, V.n.z, V.nk);
        const w = V.w;
        const sum = w[1] + w[3] + w[5] + w[7] || 1;
        this.si.push(w[0], w[2], w[4], w[6]);
        this.sw.push(w[1] / sum, w[3] / sum, w[5] / sum, w[7] / sum);
        return this.n++;
    }

    /**
     * Grade de (nu+1)×(nv+1) vértices. fn(V, s, t, i, j) preenche VX.
     * o: { slot, wrap (padrão true: coluna nu repete a 0), inside (Vector3 dentro do volume), flip, weld (rótulo) }
     */
    grid(nu, nv, fn, o = {}) {
        const slot = this.slotMap[o.slot || 'skin'];
        const wrap = o.wrap !== false;
        const base = this.n;
        const row = nu + 1;
        const V = VX;
        for (let j = 0; j <= nv; j++) {
            for (let i = 0; i <= nu; i++) {
                V.r = 0.8;
                V.m = 0;
                V.k = 0;
                V.u = i / nu;
                V.v = j / nv;
                V.w.fill(0);
                V.c.setRGB(1, 1, 1);
                V.nk = 0;
                fn(V, i / nu, j / nv, wrap ? i % nu : i, j);
                this.push(V);
            }
        }
        const ix = this.idx[slot] || (this.idx[slot] = []);
        const start = ix.length;
        for (let j = 0; j < nv; j++) {
            for (let i = 0; i < nu; i++) {
                const a = base + j * row + i;
                const b = a + 1;
                const c = a + row;
                ix.push(a, c, b, b, c, c + 1);
            }
        }
        let flip = o.flip;
        if (flip === undefined) {
            const P = this.pos;
            let cx = 0, cy = 0, cz = 0;
            if (o.inside) {
                cx = o.inside.x;
                cy = o.inside.y;
                cz = o.inside.z;
            } else {
                for (let i = base; i < this.n; i++) {
                    cx += P[i * 3];
                    cy += P[i * 3 + 1];
                    cz += P[i * 3 + 2];
                }
                const k = 1 / (this.n - base);
                cx *= k;
                cy *= k;
                cz *= k;
            }
            let acc = 0;
            for (let k = start; k < ix.length; k += 3) {
                const a = ix[k] * 3, b = ix[k + 1] * 3, c = ix[k + 2] * 3;
                const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
                const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
                const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
                acc += nx * ((P[a] + P[b] + P[c]) / 3 - cx) + ny * ((P[a + 1] + P[b + 1] + P[c + 1]) / 3 - cy) + nz * ((P[a + 2] + P[b + 2] + P[c + 2]) / 3 - cz);
            }
            flip = acc < 0;
        }
        if (o.invert) flip = !flip;
        if (flip) {
            for (let k = start; k < ix.length; k += 3) {
                const t = ix[k + 1];
                ix[k + 1] = ix[k + 2];
                ix[k + 2] = t;
            }
        }
        this.pieces.push([base, this.n, o.weld || null]);
    }

    build() {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
        geo.setAttribute('aPbr', new THREE.Float32BufferAttribute(this.pbr, 3));
        geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4));
        geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
        const slots = Object.keys(this.idx);
        const all = [];
        for (const s of slots) {
            geo.addGroup(all.length, this.idx[s].length, slots.indexOf(s));
            for (const i of this.idx[s]) all.push(i);
        }
        geo.setIndex(all);
        geo.computeVertexNormals();
        // solda de normais por posição (dentro da peça, ou entre peças com o mesmo rótulo)
        const N = geo.attributes.normal.array;
        const P = this.pos;
        const groups = new Map();
        this.pieces.forEach((pc, i) => {
            const key = pc[2] || `#${i}`;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(pc);
        });
        for (const list of groups.values()) {
            const map = new Map();
            for (const [a, b] of list) {
                for (let i = a; i < b; i++) {
                    const key = `${Math.round(P[i * 3] * 2e4)},${Math.round(P[i * 3 + 1] * 2e4)},${Math.round(P[i * 3 + 2] * 2e4)}`;
                    let e = map.get(key);
                    if (!e) map.set(key, (e = [0, 0, 0, []]));
                    e[0] += N[i * 3];
                    e[1] += N[i * 3 + 1];
                    e[2] += N[i * 3 + 2];
                    e[3].push(i);
                }
            }
            for (const e of map.values()) {
                if (e[3].length < 2) continue;
                const l = Math.hypot(e[0], e[1], e[2]) || 1;
                for (const i of e[3]) {
                    N[i * 3] = e[0] / l;
                    N[i * 3 + 1] = e[1] / l;
                    N[i * 3 + 2] = e[2] / l;
                }
            }
        }
        // emendas (ombro, quadril): as duas peças puxam a normal para o mesmo campo, e o corte some na luz
        for (let k = 0; k < this.nt.length; k += 5) {
            const i = this.nt[k] * 3;
            const w = this.nt[k + 4];
            const x = N[i] * (1 - w) + this.nt[k + 1] * w;
            const y = N[i + 1] * (1 - w) + this.nt[k + 2] * w;
            const z = N[i + 2] * (1 - w) + this.nt[k + 3] * w;
            const l = Math.hypot(x, y, z) || 1;
            N[i] = x / l;
            N[i + 1] = y / l;
            N[i + 2] = z / l;
        }
        return { geometry: geo, slots, tris: all.length / 3 };
    }
}

// ---------------------------------------------------------------------------
// Tabelas anatômicas (adulto canônico de 1,75 m; frente = +Z, esquerda = +X).
// ---------------------------------------------------------------------------
// tronco: [y, rx, rz, zc, n(superelipse)]
const TORSO_T = [
    [0.845, 0.07, 0.075, 0.0, 2.2],
    [0.87, 0.15, 0.105, -0.004, 2.3],
    [0.91, 0.176, 0.118, -0.006, 2.4],
    [0.96, 0.176, 0.122, -0.004, 2.4],
    [1.01, 0.16, 0.113, 0.0, 2.35],
    [1.06, 0.148, 0.103, 0.004, 2.3],
    [1.12, 0.148, 0.103, 0.006, 2.3],
    [1.2, 0.158, 0.111, 0.008, 2.4],
    [1.28, 0.172, 0.121, 0.01, 2.5],
    [1.35, 0.18, 0.121, 0.008, 2.5],
    [1.4, 0.18, 0.108, 0.002, 2.6],
    [1.43, 0.168, 0.092, -0.002, 2.6],
    [1.452, 0.13, 0.078, -0.004, 2.4],
    [1.468, 0.085, 0.066, -0.005, 2.2],
    [1.482, 0.05, 0.05, -0.006, 2.0]
];
// braço: [y, r, zoff, xoff]  (ombro 1,405 · cotovelo 1,14 · punho 0,885)
const ARM_T = [
    [0.885, 0.0245, 0, 0.017],
    [0.915, 0.0265, 0, 0.017],
    [0.98, 0.033, 0.002, 0.016],
    [1.07, 0.04, 0.002, 0.014],
    [1.125, 0.038, 0, 0.013],
    [1.16, 0.038, -0.002, 0.012],
    [1.22, 0.042, 0.002, 0.011],
    [1.3, 0.048, 0.002, 0.008],
    [1.36, 0.0515, 0, 0.004],
    [1.405, 0.052, 0, 0.0],
    [1.43, 0.044, 0, -0.006],
    [1.445, 0.03, 0, -0.012],
    [1.452, 0.012, 0, -0.016]
];
const SH_Y = 1.405;      // altura canônica da junta do ombro
const ARM_TOP = 1.452;
// perna: [y, r, zoff, xoff]  (quadril 0,915 · joelho 0,5 · tornozelo 0,085)
const LEG_T = [
    [0.07, 0.034, -0.006, 0.005],
    [0.1, 0.032, -0.006, 0.005],
    [0.18, 0.035, -0.005, 0.005],
    [0.3, 0.045, -0.008, 0.005],
    [0.39, 0.053, -0.01, 0.005],
    [0.45, 0.049, 0.002, 0.005],
    [0.5, 0.051, 0.01, 0.005],
    [0.555, 0.053, 0.006, 0.005],
    [0.64, 0.063, 0.006, 0.004],
    [0.76, 0.076, 0.006, 0.002],
    [0.86, 0.084, 0.002, 0.0],
    [0.915, 0.082, 0, -0.003],
    [0.95, 0.062, 0, -0.004],
    [0.972, 0.03, 0, -0.004]
];
const LEG_TOP = 0.972;
// pé (ao longo de z): [z, rx, ry, cy]
const FOOT_T = [
    [-0.068, 0.012, 0.016, 0.03],
    [-0.06, 0.028, 0.03, 0.034],
    [-0.04, 0.038, 0.046, 0.048],
    [0.0, 0.041, 0.054, 0.055],
    [0.04, 0.045, 0.042, 0.044],
    [0.09, 0.049, 0.031, 0.032],
    [0.14, 0.047, 0.024, 0.025],
    [0.175, 0.036, 0.018, 0.019],
    [0.19, 0.016, 0.01, 0.015]
];
// palma (para baixo a partir do punho): [dn, meia-espessura, meia-largura, deslocamento p/ frente]
const PALM_T = [
    [0.0, 0.0125, 0.026, 0.0],
    [0.012, 0.013, 0.029, 0.001],
    [0.03, 0.0135, 0.035, 0.002],
    [0.055, 0.0125, 0.0405, 0.002],
    [0.078, 0.0115, 0.041, 0.001],
    [0.09, 0.0095, 0.039, 0.0],
    [0.097, 0.004, 0.034, 0.0]
];
// cabeça em "hc" (origem no fundo do queixo; z=0 no eixo das orelhas): [y, W, ZF, ZB, nF]
const HEAD_T = [
    [-0.105, 0.06, 0.04, 0.064, 2.0],
    [-0.07, 0.051, 0.031, 0.058, 2.0],
    [-0.035, 0.047, 0.028, 0.055, 2.0],
    [-0.014, 0.045, 0.036, 0.054, 2.0],
    [-0.004, 0.042, 0.058, 0.054, 1.85],
    [0.004, 0.038, 0.079, 0.054, 1.7],
    [0.016, 0.042, 0.087, 0.056, 1.75],
    [0.032, 0.05, 0.0895, 0.06, 1.9],
    [0.048, 0.0575, 0.092, 0.066, 2.0],
    [0.062, 0.0635, 0.094, 0.074, 2.1],
    [0.08, 0.0685, 0.0935, 0.085, 2.2],
    [0.1, 0.073, 0.0925, 0.094, 2.3],
    [0.118, 0.0755, 0.093, 0.099, 2.35],
    [0.135, 0.077, 0.097, 0.102, 2.35],
    [0.155, 0.0775, 0.0975, 0.103, 2.3],
    [0.178, 0.0745, 0.092, 0.099, 2.2],
    [0.198, 0.0665, 0.081, 0.09, 2.1],
    [0.212, 0.055, 0.066, 0.076, 2.0],
    [0.221, 0.04, 0.047, 0.056, 2.0],
    [0.2265, 0.021, 0.025, 0.03, 2.0],
    [0.228, 0.0, 0.0, 0.0, 2.0]
];
const MOUTH_Y = 0.0485;
const HEAD_ROWS = [
    [0.228, 0.216, 0.192, 0.162, 0.137, 0.117, 0.098, 0.08, 0.064, MOUTH_Y, 0.03, 0.012, -0.004, -0.03, -0.105],
    [0.228, 0.222, 0.208, 0.188, 0.166, 0.149, 0.138, 0.129, 0.12, 0.111, 0.102, 0.093, 0.085, 0.078, 0.072, 0.066, 0.059,
        0.0535, MOUTH_Y, 0.0435, 0.037, 0.028, 0.018, 0.007, -0.003, -0.014, -0.045, -0.105],
    [0.228, 0.2265, 0.221, 0.212, 0.199, 0.184, 0.168, 0.154, 0.144, 0.137, 0.131, 0.1255, 0.12, 0.1145, 0.109, 0.103, 0.097,
        0.091, 0.086, 0.0815, 0.0778, 0.0745, 0.0712, 0.068, 0.0645, 0.0608, 0.0578, 0.0553, 0.053, 0.0508, MOUTH_Y, 0.0462,
        0.044, 0.0415, 0.0388, 0.0355, 0.0295, 0.0225, 0.015, 0.008, 0.002, -0.004, -0.013, -0.032, -0.065, -0.105]
];
// linha do cabelo: [|θ| rad, y hc]
const HAIRLINE_T = [[0, 0.183], [0.5, 0.187], [0.9, 0.176], [1.1, 0.15], [1.25, 0.12], [1.42, 0.128], [1.6, 0.133], [1.78, 0.122], [2.1, 0.06], [2.5, 0.042], [PI, 0.04]];

const DETAIL = [
    { segT: 10, segL: 7, segH: 14, hA: 0.62, gap: 0.3, minGap: 0.075, segF: 5, segE: 6 },
    { segT: 20, segL: 12, segH: 32, hA: 0.5, gap: 0.085, minGap: 0, segF: 6, segE: 10 },
    { segT: 28, segL: 18, segH: 56, hA: 0.45, gap: 0.045, minGap: 0, segF: 8, segE: 16 }
];

// ---------------------------------------------------------------------------
// Opções, proporções e traços de rosto
// ---------------------------------------------------------------------------
const DEFAULTS = {
    preset: null,
    detail: 2,            // 0 multidão · 1 NPC · 2 herói
    height: null,         // m (null = altura típica da espécie/idade/sexo)
    sex: 'm',             // 'm' | 'f'
    age: 'adult',         // 'adult' | 'child' | 'elder'
    species: 'human',     // human | elf | dwarf | hobbit | orc | goblin | ogre
    build: 0,             // −1 magro … 0 médio … +1 forte
    fat: 0,               // 0 … 1 barriga/rosto cheio
    proportions: null,    // sobrescreve campos de proporção (ver PROP0)
    face: null,           // sobrescreve traços (ver FACE0)
    skin: 0xd8a37e,
    hair: 0x3a2618,
    hairStyle: 'short',   // short | buzz | bald | balding | long | bob | braids | bun | ponytail | curly | wild | mohawk
    beard: 'none',        // none | stubble | mustache | goatee | full | long | braided
    brows: 1,             // espessura das sobrancelhas (0 = sem)
    eyeColor: 0x5b7c8e,
    lipColor: null,
    top: 'tunic',         // none | shirt | tunic | dress | robe | mail
    sleeves: 'long',      // long | short | none | puff | wide
    topColor: 0x6f7f55,
    trimColor: null,      // gola/barra (null = topColor escurecido)
    bottom: 'pants',      // pants | shorts | breeches | skirt | loincloth | none
    bottomColor: 0x4b3b2c,
    shoes: 'boots',       // boots | tall | shoes | barefoot | sabatons
    shoeColor: 0x3b2a1d,
    belt: 0x4a2f1c,       // cor ou null
    buckle: 0xc8a24a,
    vest: null,           // cor ou null
    apron: null,          // cor ou null
    cape: 'none',         // none | short | long
    capeColor: 0x7a1f1f,
    mantle: false,        // capelete sobre os ombros
    fur: false,           // gola de pele no manto
    hood: 'none',         // none | down | up
    armor: 'none',        // none | plate | half | leather
    armorColor: 0xb9bec8,
    tabard: null,         // cor da sobreveste (ou null)
    hat: 'none',          // none | helm | greathelm | kettle | wizard | crown | tiara | straw | scarf | bandana | beret | cap
    hatColor: 0x8a6a3a,
    gloves: 'none',       // none | leather | gauntlet
    gloveColor: 0x4a3324,
    eyepatch: false,
    fabricTex: 'weave',   // 'weave' = trama neutra procedural; ou um conjunto PBR de assets.js
    hardTex: null,        // null = brown_leather (rusty_metal_02 se houver armadura de placas)
    seed: 1
};

/** Proporções relativas ao adulto canônico (multiplicativas, salvo belly/bust/hunch/armOut). */
const PROP0 = {
    legs: 1, torso: 1, arms: 1, head: 1, shoulders: 1, hips: 1, waist: 1, bulk: 1, depth: 1,
    belly: 0, bust: 0, hands: 1, feet: 1, neck: 1, neckLen: 1, hunch: 0, armOut: 0, height: 1.78, heightK: 1
};
/** Traços de rosto (1 = neutro). */
const FACE0 = {
    jaw: 1, chin: 1, cheek: 1, brow: 1, nose: 1, noseW: 1, lips: 1, mouthW: 0.92, eye: 1.03, eyeGap: 1, cran: 1,
    fat: 0, ear: 0, earOut: 0.42, earSize: 1, tusks: 0, tilt: 0.1, blush: 1, lash: 0.5, freckles: 0
};
const ADDITIVE = new Set(['belly', 'bust', 'hunch', 'armOut', 'fat', 'ear', 'tusks', 'tilt', 'lash', 'freckles']);
const ABSOLUTE = new Set(['height', 'earOut']);
const SPECIES = {
    human: { P: {}, F: {} },
    elf: {
        P: { legs: 1.04, torso: 0.98, head: 0.96, shoulders: 0.92, hips: 0.92, bulk: 0.86, neckLen: 1.12, height: 1.84 },
        F: { jaw: 0.93, cheek: 1.15, nose: 0.9, noseW: 0.85, ear: 1, tilt: 0.09, brow: 0.6, chin: 0.9 }
    },
    dwarf: {
        P: { legs: 0.62, torso: 0.9, arms: 0.8, head: 1.08, shoulders: 1.14, hips: 1.14, bulk: 1.3, depth: 1.22, belly: 0.03, hands: 1.15, feet: 1.12, neck: 1.2, neckLen: 0.7, armOut: 0.1, height: 1.3 },
        F: { nose: 1.3, noseW: 1.3, brow: 1.5, jaw: 1.12, cheek: 1.1 }
    },
    hobbit: {
        P: { legs: 0.7, torso: 0.78, arms: 0.74, shoulders: 0.8, hips: 0.9, bulk: 0.86, belly: 0.03, hands: 0.86, feet: 1.38, neck: 0.85, height: 1.1 },
        F: { fat: 0.5, nose: 0.9, noseW: 1.1, eye: 1.1, ear: 0.45, jaw: 0.95, brow: 0.7 }
    },
    orc: {
        P: { legs: 0.92, torso: 1.05, arms: 1.12, shoulders: 1.24, hips: 1.05, bulk: 1.26, depth: 1.15, hands: 1.2, feet: 1.1, neck: 1.35, neckLen: 0.8, hunch: 0.3, armOut: 0.12, height: 1.92 },
        F: { jaw: 1.28, chin: 1.3, brow: 2.2, nose: 0.8, noseW: 1.5, lips: 0.8, mouthW: 1.25, eye: 0.85, ear: 0.55, earOut: 0.9, tusks: 1, blush: 0.2, cheek: 1.3 }
    },
    goblin: {
        P: { legs: 0.7, torso: 0.8, arms: 0.96, head: 1.06, shoulders: 0.8, hips: 0.8, bulk: 0.76, hands: 1.05, hunch: 0.35, height: 1.15 },
        F: { jaw: 0.95, chin: 0.8, brow: 1.4, nose: 1.4, noseW: 0.9, lips: 0.6, mouthW: 1.3, eye: 1.2, ear: 1.1, earOut: 1.25, earSize: 1.25, tusks: 0.45, blush: 0.2, cheek: 1.3 }
    },
    ogre: {
        P: { legs: 0.88, torso: 1.15, arms: 1.2, head: 0.86, shoulders: 1.5, hips: 1.32, bulk: 1.5, depth: 1.45, belly: 0.085, hands: 1.5, feet: 1.35, neck: 1.6, neckLen: 0.8, hunch: 0.3, armOut: 0.2, height: 3.2 },
        F: { jaw: 1.35, chin: 1.2, brow: 1.9, nose: 1.25, noseW: 1.6, lips: 1.0, mouthW: 1.3, eye: 0.8, fat: 0.6, ear: 0.2, earOut: 0.8, tusks: 0.5, blush: 0.4, cran: 0.94 }
    }
};
const SEX_F = {
    P: { shoulders: 0.83, hips: 1.05, waist: 0.86, bulk: 0.9, hands: 0.9, feet: 0.88, neck: 0.86, bust: 0.03, heightK: 0.935 },
    F: { jaw: 0.9, chin: 0.88, brow: 0.35, nose: 0.86, noseW: 0.9, lips: 1.3, eye: 1.08, lash: 0.5, cheek: 1.1 }
};
const AGES = {
    adult: { P: {}, F: {} },
    child: {
        P: { legs: 0.68, torso: 0.72, arms: 0.68, shoulders: 0.66, hips: 0.72, bulk: 0.7, hands: 0.72, feet: 0.74, neck: 0.72, neckLen: 0.8, heightK: 0.7 },
        F: { eye: 1.2, nose: 0.68, noseW: 0.9, jaw: 0.88, chin: 0.8, fat: 0.55, brow: 0.2, cran: 1.05, lips: 1.1 }
    },
    elder: {
        P: { bulk: 0.93, hunch: 0.65, shoulders: 0.96, heightK: 0.955 },
        F: { nose: 1.12, cheek: 1.2, lips: 0.8, brow: 1.2, blush: 0.6 }
    }
};

function mixInto(dst, mod) {
    if (!mod) return;
    for (const k in mod) {
        if (ADDITIVE.has(k)) dst[k] += mod[k];
        else if (ABSOLUTE.has(k)) dst[k] = mod[k];
        else dst[k] *= mod[k];
    }
}

function resolveOptions(options) {
    const pre = options.preset ? HERO_PRESETS[options.preset] : null;
    if (options.preset && !pre) console.warn(`gfx/hero: preset desconhecido "${options.preset}"`);
    const o = { ...DEFAULTS, ...(pre || {}), ...options };
    const sp = SPECIES[o.species] || SPECIES.human;
    const ag = AGES[o.age] || AGES.adult;
    const P = { ...PROP0 };
    const F = { ...FACE0 };
    mixInto(P, sp.P);
    mixInto(F, sp.F);
    if (o.sex === 'f') {
        mixInto(P, SEX_F.P);
        mixInto(F, SEX_F.F);
    }
    mixInto(P, ag.P);
    mixInto(F, ag.F);
    if (o.age === 'child') P.bust = 0;
    // biotipo: build engrossa membros e ombros; fat dá barriga e rosto cheio
    P.bulk *= 1 + 0.13 * o.build;
    P.shoulders *= 1 + 0.05 * o.build;
    P.waist *= 1 - 0.04 * Math.max(0, o.build) + 0.25 * o.fat;
    P.belly += 0.07 * o.fat;
    P.depth *= 1 + 0.12 * o.fat;
    F.fat += 0.6 * o.fat;
    F.cheek *= 1 - 0.1 * o.build;
    Object.assign(P, pre?.proportions, options.proportions);
    Object.assign(F, pre?.face, options.face);
    o.P = P;
    o.F = F;
    o.height = options.height ?? pre?.height ?? P.height * P.heightK;
    o.hardTex = o.hardTex || (o.armor === 'plate' || o.armor === 'half' ? 'rusty_metal_02' : 'brown_leather');
    return o;
}

// ---------------------------------------------------------------------------
// Geometria
// ---------------------------------------------------------------------------
function buildGeometry(o) {
    const P = o.P;
    const F = o.F;
    const D = DETAIL[o.detail];
    const hi = o.detail >= 2;
    const lo = o.detail === 0;
    const slotMap = hi ? { skin: 'skin', hair: 'hair', fabric: 'fabric', hard: 'hard' }
        : lo ? { skin: 'all', hair: 'all', fabric: 'all', hard: 'all' }
            : { skin: 'skin', hair: 'skin', fabric: 'fabric', hard: 'fabric' };
    const bd = new Builder(slotMap);
    const C = (h) => new THREE.Color(h);
    const rnd = (n) => hash(n + o.seed * 17.3);

    // ---- paleta ----
    const skin = C(o.skin);
    skin.setRGB(skin.r * 0.9, skin.g * 0.83, skin.b * 0.78);   // albedo de pele: mais denso e quente que o hex cru
    const blush = C().setRGB(Math.min(1, skin.r * 1.03), skin.g * 0.66, skin.b * 0.62);
    const palm = skin.clone().lerp(C(0xf0b8a8), 0.35);
    const lip = o.lipColor != null ? C(o.lipColor) : skin.clone().lerp(C(0x9c2f30), o.sex === 'f' ? 0.8 : 0.58);
    const hairC = C(o.hair);
    const topC = C(o.topColor);
    const trimC = o.trimColor != null ? C(o.trimColor) : topC.clone().multiplyScalar(0.6);
    const botC = C(o.bottomColor);
    const shoeC = C(o.shoeColor);
    const steel = C(o.armorColor);
    const mailC = C(0x6f747c);
    const gold = C(0xd9a93a);
    const plate = o.armor === 'plate';
    const halfPlate = o.armor === 'half';

    // ---- mapeamento canônico → construído ----
    const fa = Math.sqrt(P.feet);
    const hipY = 0.915 * P.legs;
    const legYK = (hipY - 0.085 * fa) / 0.83;
    const bulkT = Math.pow(P.bulk, 0.6);
    // ombros muito largos ganham trapézio mais alto (senão o topo do tronco vira um platô)
    const trapS = Math.max(0, P.shoulders * bulkT - 1) * 0.9;
    const Y = (y) => (y <= 0.085 ? y * fa : y <= 0.915 ? 0.085 * fa + (y - 0.085) * legYK : hipY + (y - 0.915) * P.torso + Math.max(0, y - 1.4) * P.torso * trapS);
    const dK = P.depth * Math.pow(P.bulk, 0.8);
    const shK = P.shoulders * Math.pow(P.bulk, 0.35);
    const shX = 0.188 * shK;
    const shY = Y(SH_Y);
    const Ya = (y) => shY - (SH_Y - y) * P.arms;
    const hipX = 0.09 * P.hips * Math.pow(P.bulk, 0.3);
    const armK = Math.pow(P.bulk, 1.05) * (o.sex === 'f' ? 0.94 : 1);
    const legK = Math.pow(P.bulk, 0.95);
    const muscle = Math.max(0, o.build) * 0.14;
    const kH = P.head;
    const neckY = Y(1.445);
    const chinY = neckY + 0.08 * kH * P.neckLen;
    const zH = 0.012;
    const HT = (p) => p.set(p.x * kH, chinY + p.y * kH, zH + p.z * kH);
    const topY = chinY + 0.228 * kH;

    // ---- juntas (posição de repouso dos ossos, espaço construído) ----
    const J = new Float32Array(NB * 3);
    const setJ = (name, x, y, z) => {
        const i = B[name] * 3;
        J[i] = x;
        J[i + 1] = y;
        J[i + 2] = z;
    };
    const ex = 0.031 * F.eyeGap;
    const ey = 0.1165;
    const Re = 0.0158 * F.eye;
    setJ('hips', 0, Y(0.96), 0);
    setJ('spine', 0, Y(1.08), 0);
    setJ('chest', 0, Y(1.26), 0);
    setJ('neck', 0, neckY, -0.008);
    setJ('head', 0, chinY + 0.045 * kH, zH - 0.012 * kH);
    setJ('jaw', 0, chinY + 0.082 * kH, zH - 0.004 * kH);
    for (const s of [1, -1]) {
        const L = s > 0 ? 'L' : 'R';
        setJ('clav' + L, s * 0.035 * shK, shY, 0);
        setJ('arm' + L, s * shX, shY, 0);
        setJ('fore' + L, s * (shX + 0.012), Ya(1.14), 0);
        setJ('hand' + L, s * (shX + 0.017), Ya(0.885), 0);
        setJ('fingA' + L, s * (shX + 0.017), Ya(0.885) - 0.088 * P.hands, 0);
        setJ('fingB' + L, s * (shX + 0.017), Ya(0.885) - 0.12 * P.hands, 0);
        setJ('thumb' + L, s * (shX + 0.017 - 0.008 * P.hands), Ya(0.885) - 0.03 * P.hands, 0.03 * P.hands);
        setJ('thigh' + L, s * hipX, Y(0.915), 0);
        setJ('shin' + L, s * (hipX + 0.005), Y(0.5), 0.004);
        setJ('foot' + L, s * (hipX + 0.005), Y(0.085), -0.008);
        setJ('toe' + L, s * (hipX + 0.005), 0.022 * fa, 0.105 * P.feet);
        setJ('mouth' + L, s * 0.022 * F.mouthW * kH, chinY + MOUTH_Y * kH, zH + 0.08 * kH);
    }
    const capeZ = -(0.105 * dK + 0.02);
    setJ('cape1', 0, Y(1.435), capeZ);
    setJ('cape2', 0, Y(1.16), capeZ - 0.02);
    setJ('cape3', 0, Y(0.88), capeZ - 0.04);
    setJ('cape4', 0, Y(0.6), capeZ - 0.05);
    setJ('skirt', 0, Y(0.96), 0);
    setJ('hair1', 0, chinY + 0.05 * kH, zH - 0.075 * kH);
    setJ('hair2', 0, chinY - 0.1 * kH, zH - 0.085 * kH);
    setJ('beard', 0, chinY + 0.005 * kH, zH + 0.07 * kH);
    setJ('hat', 0, topY + 0.1 * kH, zH - 0.02 * kH);

    // ---- sombreamento ----
    const skinV = (V, red = 0, dark = 0) => {
        V.c.copy(skin).lerp(blush, clamp(red)).multiplyScalar(1 - dark);
        V.r = 0.6;
    };
    /** Fábrica de cor de tecido/couro/metal. shade(V, th, yc, inf) opcional escurece vales. */
    const mat = (color, rough = 0.92, metal = 0) => (V) => {
        V.c.copy(color);
        V.r = rough;
        V.m = metal;
    };

    // ---- tronco ----
    const _t = [0, 0, 0, 0];
    const pec = o.sex === 'f' ? 0 : 0.006 + 0.012 * Math.max(0, o.build) + (o.species === 'ogre' ? 0.03 : o.species === 'orc' ? 0.018 : 0);
    const torsoWK = (yc) => lerp(P.hips, P.shoulders, ss(1.0, 1.32, yc)) * bulkT * (1 - (1 - P.waist) * gs(yc - 1.08, 0.1));
    function torsoPoint(th, yc, infl, out, rs = 1) {
        sampleTab(TORSO_T, yc, _t);
        const wk = torsoWK(yc);
        const rx = _t[0] * wk * rs;
        const rz = _t[1] * dK * rs;
        const n = _t[3];
        const s = Math.sin(th);
        const c = Math.cos(th);
        const x = rx * spow(s, 2 / n);
        const z = rz * spow(c, 2 / n);
        let nx = x / (rx * rx + 1e-9);
        let nz = z / (rz * rz + 1e-9);
        const nl = Math.hypot(nx, nz) || 1;
        nx /= nl;
        nz /= nl;
        let d = infl * rs;
        const ax = Math.abs(x);
        if (c > 0) {
            d += P.belly * gs(yc - 1.07, 0.13) * Math.pow(c, 1.3) * rs;
            d += P.bust * gs(ax - 0.074 * wk, 0.05) * gs(yc - 1.285, 0.05) * rs;
            d += pec * (gs(ax - 0.085 * wk, 0.065) * gs(yc - 1.3, 0.055) - 0.5 * gs(ax, 0.02 * wk) * gs(yc - 1.29, 0.07)) * rs;
        } else {
            d += 0.016 * dK * gs(ax - 0.075 * P.hips, 0.065) * gs(yc - 0.925, 0.06) * -c * rs;
        }
        out.set(x + nx * d, Y(yc), _t[2] * dK + z + nz * d);
        return c;
    }
    function torsoW(V, yc, x) {
        if (yc < 1.0) w1(V, B.hips);
        else if (yc < 1.1) w2(V, B.hips, B.spine, ss(1.0, 1.1, yc));
        else if (yc < 1.24) w2(V, B.spine, B.chest, ss(1.1, 1.24, yc));
        else if (yc < 1.45) w1(V, B.chest);
        else w2(V, B.chest, B.neck, ss(1.45, 1.5, yc) * 0.6);
        if (yc > 1.33) wAdd(V, x > 0 ? B.clavL : B.clavR, 0.5 * ss(1.33, 1.4, yc) * ss(0.07, 0.15, Math.abs(x) / shK));
    }
    /** Normal-alvo comum a tronco e membro perto do ombro/quadril (esfera em torno da junta). */
    function seamNormal(V, yc, limb, arm) {
        const sd = V.p.x >= 0 ? 1 : -1;
        const ax = Math.abs(V.p.x);
        let k = 0;
        if (limb ? arm && yc > 1.33 : yc > 1.3) {
            k = limb ? ss(1.33, 1.4, yc) : ss(1.3, 1.4, yc) * ss(0.55, 0.9, ax / shX);
            V.n.set(V.p.x - sd * (shX - 0.07), (V.p.y - (shY - 0.08)) * 0.9, V.p.z);
        } else if (limb ? !arm && yc > 0.8 : yc < 1.0) {
            k = limb ? ss(0.8, 0.92, yc) : ss(1.0, 0.9, yc) * ss(0.015, 0.06, ax);
            V.n.set(V.p.x - sd * hipX * 0.45, (V.p.y - Y(0.9)) * 0.35, V.p.z);
        }
        if (k > 0) {
            V.n.normalize();
            V.nk = k * 0.88;
        }
    }
    /**
     * Casca do tronco entre y0 e y1 (canônico). q: { slot, col(V,th,yc,inf), infl: n | (yc,th)=>n,
     * arc:[θ0,θ1] (abre a casca), capBot, capTop, hem (lábio na barra), uSpan }
     */
    function torsoShell(y0, y1, q) {
        const rows = rowsOf(TORSO_T, y0, y1, D.gap, D.minGap).map((y) => [y, 1, 0]);
        if (q.capTop) rows.unshift([y1, 0, 0]);
        if (q.hem) {
            rows[rows.length - 1][2] = q.hem;
            rows.push([y0 + 0.006, 1, -0.004]);
        }
        if (q.capBot) rows.push([y0, 0, 0]);
        const a0 = q.arc ? q.arc[0] : -PI;
        const a1 = q.arc ? q.arc[1] : PI;
        const nu = Math.max(4, Math.round((q.seg || D.segT) * (a1 - a0) / TAU));
        const U = (q.uSpan || 1.0) * (a1 - a0) / TAU;
        bd.grid(nu, rows.length - 1, (V, s, t, i, j) => {
            const [yc, rs, ex2] = rows[j];
            const th = a0 + (a1 - a0) * s;
            const inf = (typeof q.infl === 'function' ? q.infl(yc, th) : q.infl || 0) + ex2;
            torsoPoint(th, yc, inf, V.p, rs);
            torsoW(V, yc, V.p.x);
            if (!q.arc) seamNormal(V, yc, false);
            V.u = s * U;
            V.v = V.p.y;
            q.col(V, th, yc, inf);
        }, { slot: q.slot, wrap: !q.arc, inside: q.arc ? V3(0, Y((y0 + y1) / 2), 0) : null, weld: q.weld });
    }

    // ---- membros ----
    function armPoint(side, th, yc, infl, out, rs = 1) {
        sampleTab(ARM_T, yc, _t);
        const r = _t[0] * armK * (1 + muscle * gs(yc - 1.31, 0.075) + muscle * 0.5 * gs(yc - 1.06, 0.06));
        const flat = ss(1.0, 0.89, yc);
        const ra = (r * lerp(0.97, 0.84, flat) + infl) * rs;
        const rb = (r * lerp(1.03, 1.12, flat) + infl) * rs;
        out.set(side * (shX + _t[2]) + Math.sin(th) * ra, Ya(yc), _t[1] + Math.cos(th) * rb);
    }
    function armW(V, side, yc) {
        const arm = (side > 0 ? B.clavL : B.clavR) + 1;
        if (yc > 1.2) w1(V, arm);
        else if (yc > 1.08) w2(V, arm, arm + 1, ss(1.2, 1.08, yc));
        else if (yc > 0.935) w1(V, arm + 1);
        else w2(V, arm + 1, arm + 2, ss(0.935, 0.875, yc) * 0.7);
    }
    function legPoint(side, th, yc, infl, out, rs = 1) {
        sampleTab(LEG_T, yc, _t);
        const r = _t[0] * legK * (1 + muscle * 0.6 * gs(yc - 0.74, 0.12) + muscle * 0.5 * gs(yc - 0.38, 0.07));
        const c = Math.cos(th);
        const ra = (r + infl) * rs;
        const rb = (r * 1.05 + infl + (c > 0 ? 0.006 * gs(yc - 0.5, 0.035) : 0)) * rs;
        out.set(side * (hipX + _t[2]) + Math.sin(th) * ra, Y(yc), _t[1] + c * rb);
    }
    function legW(V, side, yc) {
        const th = side > 0 ? B.thighL : B.thighR;
        if (yc > 0.58) w1(V, th);
        else if (yc > 0.42) w2(V, th, th + 1, ss(0.58, 0.42, yc));
        else if (yc > 0.15) w1(V, th + 1);
        else w2(V, th + 1, th + 2, ss(0.15, 0.06, yc) * 0.8);
    }
    /**
     * Casca de braço/perna. q: { slot, col, infl, capTop, capBot, cuff (alarga a barra), cuffTop, seg, uSpan }
     */
    function limbShell(kind, side, yTop, yBot, q) {
        const arm = kind === 'arm';
        const rows = rowsOf(arm ? ARM_T : LEG_T, yBot, yTop, D.gap, D.minGap).map((y) => [y, 1, 0]);
        if (q.cuffTop) {
            rows[0][2] = q.cuffTop;
            rows.unshift([yTop - 0.008, 1, -0.003]);
        }
        if (q.capTop) rows.unshift([yTop, 0, 0]);
        if (q.cuff) {
            rows[rows.length - 1][2] = q.cuff;
            rows.push([yBot + 0.008, 1, -0.003]);
        }
        if (q.capBot) rows.push([yBot, 0, 0]);
        const U = q.uSpan || (arm ? 0.3125 : 0.4375);
        const pt = arm ? armPoint : legPoint;
        const wt = arm ? armW : legW;
        bd.grid(q.seg || D.segL, rows.length - 1, (V, s, t, i, j) => {
            const [yc, rs, ex2] = rows[j];
            const th = s * TAU - PI;
            const inf = (typeof q.infl === 'function' ? q.infl(yc, th) : q.infl || 0) + ex2;
            pt(side, th, yc, inf, V.p, rs);
            wt(V, side, yc);
            seamNormal(V, yc, true, arm);
            V.u = s * U;
            V.v = V.p.y;
            q.col(V, th, yc, inf);
        }, { slot: q.slot });
    }

    /** Elipsoide (lat-long) com base opcional; frac < 1 corta o polo de baixo (cúpula). */
    function blob(cx, cy, cz, rx, ry, rz, q) {
        const nu = q.nu || (hi ? 10 : 6);
        const nv = q.nv || (hi ? 6 : 4);
        const frac = q.frac || 1;
        const M = q.basis;
        bd.grid(nu, nv, (V, s, t, i, j) => {
            const a = s * TAU;
            const b = t * PI * frac;
            const sb = Math.sin(b);
            let x = Math.sin(a) * sb * rx;
            let y = Math.cos(b) * ry;
            let z = Math.cos(a) * sb * rz;
            if (q.shape) {
                VX.p.set(x, y, z);
                q.shape(VX.p, a, b);
                x = VX.p.x;
                y = VX.p.y;
                z = VX.p.z;
            }
            if (M) V.p.set(cx + M[0].x * x + M[1].x * y + M[2].x * z, cy + M[0].y * x + M[1].y * y + M[2].y * z, cz + M[0].z * x + M[1].z * y + M[2].z * z);
            else V.p.set(cx + x, cy + y, cz + z);
            V.u = s * (q.uSpan || 0.2);
            V.v = t * (q.vSpan || 0.2);
            q.col(V, a, b);
            q.w(V, a, b);
        }, { slot: q.slot, inside: q.inside || V3(cx, cy, cz), invert: q.invert });
    }

    // =====================================================================
    // CABEÇA — superfície esculpida: anéis horizontais (tabela HEAD_T) + relevo
    // analítico (órbitas, sobrancelha, nariz, lábios, queixo, maçãs). As colunas
    // são mais densas na frente (θ = π·(a·u + (1−a)·u³)), e a linha da boca é uma
    // linha da grade: a malha é cortada ali para a mandíbula abrir de verdade.
    // =====================================================================
    const _h = [0, 0, 0, 0];
    const _h2 = [0];
    const trapK = Math.max(1, (0.092 * torsoWK(1.465)) / (0.06 * P.neck * kH));
    const hd = { W: 0, ZF: 0, ZB: 0, n: 2 };
    const nW = F.noseW;
    const mW = F.mouthW;
    function headDims(y) {
        sampleTab(HEAD_T, y, _h);
        const cr = 1 + (F.cran - 1) * ss(0.09, 0.15, y);
        const jw = 1 + (F.jaw - 1) * ss(0.09, 0.035, y) * ss(-0.02, 0.01, y) + F.fat * 0.1 * gs(y - 0.05, 0.04);
        const nk = y < 0.005 ? lerp(1, P.neck, ss(0.005, -0.03, y)) : 1;
        // trapézio: a base do pescoço abre até encontrar o anel do topo do tronco
        const fl = y < -0.035 ? lerp(1, trapK, ss(-0.035, -0.105, y)) : 1;
        hd.W = _h[0] * cr * jw * nk * fl;
        hd.ZF = _h[1] * nk * (1 + 0.25 * (fl - 1));
        hd.ZB = _h[2] * cr * nk * (1 + 0.6 * (fl - 1));
        hd.n = _h[3];
    }
    function headBase(th, y, out) {
        headDims(y);
        const s = Math.sin(th);
        const c = Math.cos(th);
        out.set(hd.W * spow(s, 0.889), y, c >= 0 ? hd.ZF * Math.pow(c, 2 / hd.n) : -hd.ZB * Math.pow(-c, 0.95));
        return c;
    }
    function faceDz(x, y) {
        const ax = Math.abs(x);
        let dz = -0.0125 * gs(ax - ex, 0.022) * gs(y - ey, 0.0135);                                   // órbita
        dz += 0.0042 * F.brow * gs(y - 0.1345, 0.008) * ss(0.002, 0.02, ax) * ss(0.068, 0.046, ax);    // arco superciliar
        // nariz: o dorso sobe do násio (y=.122) à ponta (y=.080) e cai até a base (y=.068)
        const t = clamp((0.122 - y) / 0.042);
        const h = (0.0028 + 0.021 * Math.pow(t, 1.25)) * ss(0.067, 0.0795, y) * ss(0.13, 0.118, y);
        dz += F.nose * h * Math.exp(-Math.pow(ax / (lerp(0.0062, 0.0105, t) * nW), 2.4));
        dz += F.nose * 0.0078 * gs(ax - 0.0125 * nW, 0.0056 * nW) * gs(y - 0.0765, 0.0062);            // asas
        dz -= 0.0018 * gs(ax - 0.0072 * nW, 0.0034) * gs(y - 0.0708, 0.003);                           // narinas
        // lábios
        dz += F.lips * 0.0046 * gs(y - 0.0537, 0.0042) * (1 - ss(0.014 * mW, 0.0245 * mW, ax)) * (1 - 0.22 * gs(ax, 0.004));
        dz += F.lips * 0.0056 * gs(y - 0.0432, 0.0046) * (1 - ss(0.011 * mW, 0.0215 * mW, ax));
        dz -= 0.0042 * gs(y - MOUTH_Y, 0.0017) * (1 - ss(0.018 * mW, 0.026 * mW, ax));                   // rima
        dz -= 0.0012 * gs(ax, 0.0035) * gs(y - 0.063, 0.005);                                          // filtro
        dz -= 0.0028 * gs(y - 0.031, 0.006) * gs(ax, 0.02);                                            // sulco mentolabial
        dz += 0.004 * F.chin * gs(y - 0.014, 0.011) * gs(ax, 0.017);                                   // queixo
        dz -= 0.002 * gs(ax - 0.0245 * mW, 0.005) * gs(y - MOUTH_Y, 0.005);                            // comissura
        return dz;
    }
    const cheekAmt = (ax, y) => 0.0035 * F.cheek * gs(ax - 0.05, 0.017) * gs(y - 0.098, 0.017)
        + F.fat * 0.011 * gs(ax - 0.042, 0.024) * gs(y - 0.066, 0.026);
    /** z da face (hc) em (x, y) — para assentar sobrancelha, bigode, tapa-olho… */
    function faceZ(x, y) {
        headDims(y);
        const s = Math.pow(clamp(Math.abs(x) / hd.W), 1 / 0.889);
        const c = Math.sqrt(Math.max(0, 1 - s * s));
        return hd.ZF * Math.pow(c, 2 / hd.n) + (faceDz(x, y) + cheekAmt(Math.abs(x), y) * 0.7) * ss(0, 0.4, c);
    }
    const hairlineY = (a) => {
        sampleTab(HAIRLINE_T, a, _h2);
        return _h2[0];
    };
    const browY = (ax) => 0.1352 + (o.sex === 'f' ? 0.002 : 0) + 0.0034 * Math.sin(clamp((ax - 0.01) / 0.04) * PI * 0.9) - 0.0045 * ss(0.04, 0.057, ax);
    const scalpHair = !['bald'].includes(o.hairStyle) && o.hat !== 'greathelm';
    const stub = o.beard === 'stubble' ? 0.55 : o.beard !== 'none' ? 0.4 : (o.sex === 'm' && o.age !== 'child' ? 0.12 : 0);
    const hairSkin = hairC.clone().multiplyScalar(0.55).lerp(skin, 0.4);
    const scalpC = hairC.clone().lerp(skin, 0.22);
    const browC = hairC.clone().multiplyScalar(0.85).lerp(skin, 0.28);

    function faceColor(V, x, y, c, fm, th) {
        const ax = Math.abs(x);
        const red = F.blush * (0.5 * gs(ax - 0.043, 0.02) * gs(y - 0.083, 0.02) + 0.3 * gs(ax, 0.012) * gs(y - 0.081, 0.01) + 0.16 * gs(y - 0.09, 0.03)) * fm;
        let dark = 0.2 * gs(ax - ex, 0.015) * gs(y - ey - 0.003, 0.011) * fm;
        dark += 0.16 * gs(y - 0.1275, 0.006) * gs(ax - ex, 0.02) * fm;                                  // sob a sobrancelha
        dark += 0.13 * gs(y - 0.0335, 0.005) * gs(ax, 0.016) * fm;                                     // sob o lábio
        dark += 0.09 * gs(ax - (0.017 + (0.082 - y) * 0.45), 0.0045) * ss(0.05, 0.06, y) * ss(0.084, 0.074, y) * fm;   // sulco nasolabial
        dark += 0.1 * gs(ax, 0.004) * gs(y - 0.063, 0.005) * fm;                                       // filtro
        dark += 0.26 * gs(ax - 0.0078 * nW, 0.003) * gs(y - 0.0708, 0.0024) * fm;                      // narinas
        dark += 0.22 * gs(ax - 0.0245 * mW, 0.003) * gs(y - MOUTH_Y, 0.003) * fm;                      // comissuras
        
        skinV(V, red, dark);
        V.r = 0.64 - 0.15 * gs(ax, 0.02) * ss(0.066, 0.09, y) * fm;                                    // zona T mais brilhante
        const k = ax / (0.0245 * mW);
        const yU = lerp(0.0585, 0.0495, k * k) - 0.0024 * gs(ax, 0.0032) + 0.001 * gs(ax - 0.0075, 0.004);   // arco do cupido
        const yL = lerp(0.0385, 0.0475, k * k);
        const lm = k < 1 ? ss(yU + 0.0012, yU - 0.002, y) * ss(yL - 0.0012, yL + 0.002, y) * fm : 0;
        if (lm > 0) {
            V.c.lerp(lip, clamp(lm * 1.1));
            V.r = lerp(V.r, 0.5, lm);
        }
        V.c.multiplyScalar(1 - 0.5 * gs(y - MOUTH_Y, 0.0013) * (1 - ss(0.02 * mW, 0.026 * mW, ax)) * fm);
        if (stub > 0) V.c.lerp(hairSkin, stub * ss(0.07, 0.05, y) * ss(-0.03, -0.006, y) * ss(-0.35, 0.1, c) * (1 - lm));
        if (o.brows > 0 && fm > 0) {
            V.c.lerp(browC, 0.9 * gs(y - browY(ax), 0.0032 * (0.6 + 0.4 * o.brows)) * ss(0.006, 0.013, ax) * ss(0.059, 0.049, ax) * fm);
        }
        if (scalpHair) {
            const hl = hairlineY(Math.abs(th)) + (o.hairStyle === 'balding' ? 0.05 * ss(1.1, 0.7, Math.abs(th)) + 0.2 * ss(0.19, 0.2, y) : 0);
            V.c.lerp(scalpC, 0.8 * ss(hl - 0.002, hl + 0.012, y));
        }
    }

    const rowsH = HEAD_ROWS[o.detail];
    const jm = rowsH.indexOf(MOUTH_Y);
    const thetaOf = (s) => {
        const u = 2 * s - 1;
        return PI * (D.hA * u + (1 - D.hA) * u * u * u);
    };
    const headV = (rows, below) => (V, s, t, i, j) => {
        const y = rows[j];
        const th = thetaOf(s);
        const c = headBase(th, y, V.p);
        const fm = ss(0.0, 0.4, c);
        const x = V.p.x;
        const ax = Math.abs(x);
        if (fm > 0) {
            const ch = cheekAmt(ax, y) * fm;
            V.p.z += faceDz(x, y) * fm + ch * 0.7;
            V.p.x += Math.sign(x) * ch * 0.6;
            if (o.sex === 'm' && y < 0) V.p.z += 0.004 * gs(y + 0.04, 0.012) * gs(x, 0.012) * fm; // pomo de adão
        }
        if (y < 0.015) {
            // esternocleidomastoideo: faixa que desce de trás da orelha até a fúrcula; e a fúrcula afunda
            const ny = clamp((y + 0.105) / 0.12);
            const scm = 1 + 0.085 * gs(Math.abs(th) - lerp(0.3, 1.7, ny), 0.2) * ss(0.015, -0.012, y);
            V.p.x *= scm;
            V.p.z *= scm;
            V.p.z -= 0.004 * gs(th, 0.16) * ss(-0.06, -0.1, y);
        }
        faceColor(V, x, y, c, fm, th);
        // pesos: mandíbula (abre a partir da rima), pescoço, cantos da boca e sobrancelhas
        const isBelow = y < MOUTH_Y - 1e-6 || (below !== false && y === MOUTH_Y);
        const cf = ss(0.013 * mW, 0.024 * mW, ax);
        let jw = isBelow ? lerp(1, 0.36 + 0.64 * ss(MOUTH_Y, MOUTH_Y - 0.02, y), cf) : 0.36 * cf * ss(MOUTH_Y + 0.014, MOUTH_Y, y);
        jw *= ss(-0.03, 0.02, V.p.z) * ss(-0.018, 0.0, y);
        const kn = ss(0.0, -0.05, y);
        const kc = ss(-0.05, -0.105, y);
        V.w[0] = B.head;
        V.w[1] = (1 - kn) * (1 - jw);
        V.w[2] = B.jaw;
        V.w[3] = (1 - kn) * jw;
        V.w[4] = B.neck;
        V.w[5] = kn * (1 - kc);
        V.w[6] = B.chest;
        V.w[7] = kn * kc;
        if (fm > 0 && y > 0) {
            wAdd(V, x > 0 ? B.mouthL : B.mouthR, 0.6 * gs(ax - 0.022 * mW, 0.011) * gs(y - MOUTH_Y, 0.011) * fm);
            wAdd(V, x > 0 ? B.browL : B.browR, 0.5 * gs(y - 0.138, 0.01) * ss(0.004, 0.02, ax) * ss(0.07, 0.05, ax) * fm);
        }
        HT(V.p);
        V.u = (th / TAU + 0.5) * 0.5625;
        V.v = V.p.y;
    };
    if (lo) {
        bd.grid(D.segH, rowsH.length - 1, headV(rowsH), { slot: 'skin' });
    } else {
        bd.grid(D.segH, jm, headV(rowsH.slice(0, jm + 1), false), { slot: 'skin', weld: 'head', inside: HT(V3(0, 0.12, 0)) });
        bd.grid(D.segH, rowsH.length - 1 - jm, headV(rowsH.slice(jm), true), { slot: 'skin', weld: 'head', inside: HT(V3(0, 0, 0)) });
    }

    // ---- olhos: globo (esclera/íris/pupila pintadas por anel polar) + pálpebras em casca ----
    const ez = faceZ(ex, ey) + 0.0088 - Re;
    const irisC = C(o.eyeColor);
    const EYE_R = lo ? [0, 8, 10, 23, 26, 60, 100] : [0, 5, 8, 9.5, 15, 21, 23.5, 25.5, 38, 60, 88, 112];
    const EYE_C = lo ? [0, 0, 2, 3, 5, 5, 6] : [0, 0, 0, 1, 2, 3, 4, 5, 5, 6, 6, 6];   // 0 pupila · 1–3 íris · 4 limbo · 5 esclera · 6 canto
    const lashC = hairC.clone().multiplyScalar(0.25);
    for (const side of [1, -1]) {
        const L = side > 0 ? 'L' : 'R';
        const cx = side * ex;
        const center = HT(V3(cx, ey, ez));
        setJ('eye' + L, center.x, center.y, center.z);
        setJ('lid' + L, center.x, center.y, center.z);
        const bz = HT(V3(side * 0.03, 0.138, faceZ(0.03, 0.138)));
        setJ('brow' + L, bz.x, bz.y, bz.z);
        const eb = B['eye' + L];
        bd.grid(D.segE, EYE_R.length - 1, (V, s, t, i, j) => {
            const d = EYE_R[j];
            const pol = (d * PI) / 180;
            const az = s * TAU;
            V.p.set(cx + Re * Math.sin(pol) * Math.cos(az), ey + Re * Math.sin(pol) * Math.sin(az), ez + Re * Math.cos(pol));
            HT(V.p);
            const ec = EYE_C[j];
            if (ec === 0) V.c.setRGB(0.012, 0.01, 0.01);
            else if (ec < 4) V.c.copy(irisC).multiplyScalar(ec === 1 ? 1.4 : ec === 2 ? 1 : 0.65);
            else if (ec === 4) V.c.copy(irisC).multiplyScalar(0.22);
            else V.c.setRGB(0.88, 0.85, 0.81).multiplyScalar(ec === 6 ? 0.72 : 1);
            // sombra de oclusão da pálpebra de cima (o globo gira pouco, então pintar no globo funciona)
            if (ec > 0) V.c.multiplyScalar(1 - 0.55 * ss(0.06, 0.4, Math.sin(pol) * Math.sin(az)));
            if (hi && j === 3 && i === 6) V.c.setRGB(1.9, 1.9, 1.9);   // brilho pequeno na córnea
            V.r = 0.07;
            V.k = 1;
            V.u = s * 0.0004;
            V.v = t * 0.0004;
            w1(V, eb);
        }, { slot: 'skin', inside: center });
        if ((o.eyepatch && side < 0) || lo) continue;
        const ct = Math.cos(F.tilt * side);
        const st = Math.sin(F.tilt * side);
        for (const upper of [true, false]) {
            const R = Re + (upper ? 0.0018 : 0.0004);
            const am = 1.19;
            const nv = hi ? 4 : 2;
            const lashRow = upper && hi ? 1 : 0;
            bd.grid(hi ? 12 : 6, nv + lashRow, (V, s, t, i, j) => {
                const al = (s * 2 - 1) * am;
                // amendoado: q = +1 no canto interno, −1 no externo; o ponto mais alto fica no terço interno
                const q = (-side * al) / am;
                const aq = Math.abs(q);
                const margin = upper ? lerp(0.19, -0.035, Math.pow(aq, 1.6)) + 0.05 * q * (1 - q * q)
                    : lerp(-0.31, -0.035, Math.pow(aq, 1.4)) + 0.04 * q * (1 - q * q);
                const lash = j > nv;
                t = Math.min(1, j / nv);
                const ph = lerp(upper ? 1.42 : -1.3, margin, t) + (lash ? 0.03 : 0);
                const rr = R + (upper && j >= nv ? 0.0008 : 0) + (lash ? (0.0014 + 0.0022 * F.lash) * (1 - 0.6 * aq * aq) : 0);
                const dx = rr * Math.sin(al);
                const dy = rr * Math.cos(al) * Math.sin(ph);
                V.p.set(cx + dx * ct - dy * st, ey + dx * st + dy * ct, ez + rr * Math.cos(al) * Math.cos(ph));
                HT(V.p);
                skinV(V, upper ? 0.2 * t : 0.05 * t, upper ? 0.08 + 0.14 * t : 0.1 - 0.06 * t);
                if (j >= nv) V.c.lerp(lashC, upper ? (lash ? 0.97 : 0.7 + 0.25 * F.lash) : 0.14);
                if (lash) V.r = 1;
                w1(V, upper ? B['lid' + L] : B.head);
            }, { slot: 'skin', wrap: false, inside: center });
        }
        if (hi) {
            // carúncula no canto interno
            const cc = HT(V3(cx - side * Re * Math.sin(1.1), ey - 0.0012, ez + Re * Math.cos(1.1) + 0.0004));
            blob(cc.x, cc.y, cc.z, 0.0026 * kH, 0.0021 * kH, 0.0018 * kH, {
                slot: 'skin', nu: 6, nv: 3, uSpan: 0.0004, vSpan: 0.0004,
                col: (V) => {
                    V.c.setRGB(0.62, 0.3, 0.27);
                    V.r = 0.3;
                },
                w: (V) => w1(V, B.head)
            });
        }
    }

    // ---- orelhas (disco com hélice e concha; `ear` estica a ponta) ----
    for (const side of lo ? [] : [1, -1]) {
        const ye = 0.107;
        headDims(ye);
        const back = V3(side * Math.sin(F.earOut), 0, -Math.cos(F.earOut));
        const N = V3(side * Math.cos(F.earOut), 0, Math.sin(F.earOut));
        const up = V3(0, 1, 0).addScaledVector(back, 0.18).normalize();
        const sz = F.earSize;
        const c0 = V3(side * (hd.W - 0.004), ye, -0.006).addScaledVector(back, 0.0135 * sz);
        bd.grid(hi ? 14 : 8, hi ? 6 : 4, (V, s, t) => {
            const a = s * TAU;      // 0 = cima · π/2 = trás
            const psi = t * PI;     // 0 = centro da face lateral … π = centro da face medial
            const rho = Math.sin(psi);
            let da = a - 0.5;
            if (da > PI) da -= TAU;
            const pt = F.ear * gs(da, 0.45);
            const u = Math.cos(a) * 0.031 * sz * (1 + pt * 1.15) * rho;
            const b = Math.sin(a) * 0.0165 * sz * (1 + pt * 0.9) * rho;
            const th = psi < PI / 2 ? 0.0042 * Math.sin(PI * Math.pow(rho, 2.2)) - 0.0035 * (1 - rho) : 0.0045 * Math.cos(psi);
            V.p.copy(c0).addScaledVector(up, u).addScaledVector(back, b).addScaledVector(N, th);
            HT(V.p);
            skinV(V, 0.3, psi < PI / 2 ? 0.32 * (1 - rho) : 0);
            w1(V, B.head);
        }, { slot: 'skin' });
    }

    // ---- interior da boca, dentes e presas ----
    if (!lo) {
        const toothC = C(0xe6dfcf);
        bd.grid(8, 3, (V, s, t) => {
            const a = s * TAU;
            const b = (t * PI) / 2;
            V.p.set(0.027 * mW * Math.cos(a) * Math.cos(b), MOUTH_Y - 0.003 + 0.02 * Math.sin(a) * Math.cos(b), 0.066 - 0.034 * Math.sin(b));
            HT(V.p);
            V.c.setRGB(0.07, 0.018, 0.02).multiplyScalar(1 - 0.7 * t);
            V.r = 1.6;
            V.u = s * 0.0004;
            V.v = t * 0.0004;
            w2(V, B.head, B.jaw, ss(0.3, -0.3, Math.sin(a)));
        }, { slot: 'skin', invert: true });
        for (const upper of [true, false]) {
            bd.grid(hi ? 8 : 4, 1, (V, s, t) => {
                const ph = (s * 2 - 1) * 1.25;
                const k = upper ? 1 : 0.92;
                const y = upper ? lerp(MOUTH_Y + 0.008, MOUTH_Y - 0.003, t) : lerp(MOUTH_Y - 0.004, MOUTH_Y - 0.012, t);
                V.p.set(0.0185 * mW * k * Math.sin(ph), y, 0.0625 + 0.0185 * k * Math.cos(ph));
                HT(V.p);
                V.c.copy(toothC).multiplyScalar(1 - 0.25 * Math.abs(s * 2 - 1));
                V.r = 0.25;
                V.u = s * 0.0004;
                V.v = t * 0.0004;
                w1(V, upper ? B.head : B.jaw);
            }, { slot: 'skin', wrap: false, inside: HT(V3(0, MOUTH_Y, 0.05)) });
        }
        if (F.tusks > 0) {
            for (const side of [1, -1]) {
                const bx = side * 0.0155 * mW;
                bd.grid(6, 4, (V, s, t) => {
                    const a = s * TAU;
                    const r = 0.0042 * (0.6 + 0.4 * F.tusks) * (1 - t * t) + 0.0002;
                    const len = 0.02 * F.tusks;
                    V.p.set(bx + side * 0.004 * t + Math.sin(a) * r, MOUTH_Y - 0.004 + len * t, faceZ(bx, MOUTH_Y) + 0.001 + 0.003 * Math.sin(t * PI) + Math.cos(a) * r);
                    HT(V.p);
                    V.c.copy(toothC).multiplyScalar(0.8 + 0.2 * t);
                    V.r = 0.3;
                    w1(V, B.jaw);
                }, { slot: 'skin' });
            }
        }
    }

    // ---- sobrancelhas em relevo (herói) ----
    if (hi && o.brows > 0) {
        for (const side of [1, -1]) {
            bd.grid(6, 6, (V, s, t) => {
                const ax = lerp(0.008, 0.056, t);
                const y = browY(ax);
                const w = 0.0037 * (0.6 + 0.4 * o.brows) * Math.pow(Math.sin(PI * clamp(t * 0.8 + 0.14)), 0.6) * (t <= 0 || t >= 1 ? 0 : 1);
                const a = s * TAU;
                V.p.set(side * ax, y + Math.sin(a) * w, faceZ(ax, y + Math.sin(a) * w) + Math.max(0, Math.cos(a)) * 0.0007 * (w > 0 ? 1 : 0) - 0.0002);
                HT(V.p);
                V.c.copy(browC);
                V.r = 0.95;
                V.u = s * 0.012;
                V.v = t * 0.05;
                w1(V, side > 0 ? B.browL : B.browR);
            }, { slot: 'hair' });
        }
    }

    // =====================================================================
    // MÃOS — palma + 4 dedos (2 ossos compartilhados) + polegar
    // eixos locais: a = lado da palma (+) / dorso (−) · dn = para baixo · f = para a frente (polegar)
    // =====================================================================
    const gloveC = C(o.gloveColor);
    const gauntlet = o.gloves === 'gauntlet' || plate;
    const gloved = o.gloves !== 'none' || plate;
    for (const side of [1, -1]) {
        const hk = P.hands;
        const wx = side * (shX + 0.017);
        const wy = Ya(0.885);
        const hand = side > 0 ? B.handL : B.handR;
        const gi = gloved ? 0.0016 : 0;
        const put = (out, a, dn, f) => out.set(wx - side * a * hk, wy - dn * hk, f * hk);
        const hcol = (V, a, red) => {
            if (gloved) {
                V.c.copy(gauntlet ? steel : gloveC);
                V.r = gauntlet ? 0.42 : 0.8;
                V.m = gauntlet ? 1 : 0;
            } else {
                skinV(V, red, 0);
                if (a > 0) V.c.lerp(palm, 0.6);
            }
        };
        const slot = gloved ? 'hard' : 'skin';
        const PT = lo ? [[0, 0.0125, 0.026, 0], [0.03, 0.0135, 0.035, 0.002], [0.06, 0.0125, 0.0405, 0.002], [0.095, 0.0115, 0.041, 0],
            [0.135, 0.0095, 0.038, 0], [0.168, 0.008, 0.03, 0], [0.18, 0.003, 0.018, 0]] : PALM_T;
        const prow = PT.map((r) => r[0]);
        if (hi) prow.splice(3, 0, 0.043), prow.splice(5, 0, 0.067);
        const pEnd = prow[prow.length - 1];
        bd.grid(lo ? 6 : hi ? 12 : 8, prow.length, (V, s, t, i, j) => {
            const dn = j < prow.length ? prow[j] : pEnd;
            const rs = j < prow.length ? 1 : 0;
            sampleTab(PT, dn, _t);
            const al = s * TAU;
            const ca = Math.cos(al);
            const sa = Math.sin(al);
            let a = (_t[0] + gi) * spow(ca, 0.72) * rs;
            const f = _t[2] + (_t[1] + gi) * spow(sa, 0.72) * rs;
            if (ca > 0 && rs) a += 0.005 * gs(dn - 0.03, 0.024) * ss(-0.2, 0.8, sa) + 0.002 * gs(dn - 0.03, 0.03) * ss(0.2, -0.8, sa);
            put(V.p, a, dn, f);
            hcol(V, a, 0.3 * gs(dn - 0.088, 0.012) * (ca < 0 ? 1 : 0));
            if (dn < 0.012) w2(V, hand, hand - 1, 0.3);
            else if (lo && dn > 0.085) w2(V, hand, hand + 1, ss(0.085, 0.11, dn)), dn > 0.12 && w2(V, hand + 1, hand + 2, ss(0.12, 0.15, dn));
            else w1(V, hand);
            V.u = s * 0.14;
            V.v = dn;
        }, { slot });
        if (!lo) {
            // dedos: [f, comprimento, raio, recuo do nó]
            const FD = [[0.0305, 0.07, 0.0086, 0.003], [0.0103, 0.079, 0.009, 0], [-0.0102, 0.073, 0.0085, 0.002], [-0.0298, 0.057, 0.0076, 0.007]];
            const frow = hi ? [0, 0.1, 0.25, 0.38, 0.46, 0.54, 0.68, 0.82, 0.92, 0.975, 1] : [0, 0.25, 0.42, 0.56, 0.82, 0.96, 1];
            for (const [ff, len, fr, back] of FD) {
                bd.grid(D.segF, frow.length - 1, (V, s, t, i, j) => {
                    const tt = frow[j];
                    const r = (fr + gi) * (tt >= 1 ? 0 : tt > 0.9 ? 0.88 * Math.sqrt(1 - ((tt - 0.9) / 0.1) ** 2) : lerp(1.05, 0.88, tt) * (1 + 0.07 * gs(tt - 0.46, 0.06)));
                    const al = s * TAU;
                    const a = Math.cos(al) * r * 0.9;
                    put(V.p, a, 0.084 - back + tt * len, ff * (1 + 0.12 * tt) + Math.sin(al) * r);
                    hcol(V, a, (a < 0 ? 0.3 : 0) * (gs(tt - 0.46, 0.08) + gs(tt, 0.1)) + 0.15 * ss(0.8, 1, tt));
                    if (tt < 0.12) w2(V, hand, hand + 1, 0.5 + tt * 4);
                    else if (tt < 0.36) w1(V, hand + 1);
                    else if (tt < 0.56) w2(V, hand + 1, hand + 2, ss(0.36, 0.56, tt));
                    else w1(V, hand + 2);
                    V.u = s * 0.05;
                    V.v = tt * len;
                }, { slot });
            }
        }
        // polegar
        {
            const dir = V3(0.26, 0.84, 0.48).normalize();
            const e1 = V3(1, 0, 0).cross(dir).normalize();
            const e2 = dir.clone().cross(e1);
            const trow = lo ? [0, 0.5, 0.95, 1] : [0, 0.14, 0.3, 0.5, 0.7, 0.88, 0.97, 1];
            const len = 0.07;
            bd.grid(D.segF, trow.length - 1, (V, s, t, i, j) => {
                const tt = trow[j];
                const r = (0.0118 + gi) * (tt >= 1 ? 0 : tt > 0.88 ? 0.84 * Math.sqrt(1 - ((tt - 0.88) / 0.12) ** 2) : lerp(1.35, 0.84, Math.min(1, tt * 2.2)));
                const al = s * TAU;
                const ca = Math.cos(al) * r;
                const sa = Math.sin(al) * r;
                const a = 0.004 + dir.x * tt * len + e1.x * ca + e2.x * sa;
                put(V.p, a, 0.03 + dir.y * tt * len + e1.y * ca + e2.y * sa, 0.027 + dir.z * tt * len + e1.z * ca + e2.z * sa);
                hcol(V, a - 0.01, 0.15 * ss(0.8, 1, tt));
                if (tt < 0.2) w2(V, hand, hand + 3, 0.3 + tt * 3.5);
                else w1(V, hand + 3);
                V.u = s * 0.06;
                V.v = tt * len;
            }, { slot });
        }
    }

    // =====================================================================
    // PÉS / CALÇADOS
    // =====================================================================
    const bare = o.shoes === 'barefoot';
    const sab = o.shoes === 'sabatons' || plate;
    const soleC = shoeC.clone().multiplyScalar(0.45);
    for (const side of [1, -1]) {
        const fk = P.feet;
        const ay = Y(0.085) / 0.085;
        const cx = side * (hipX + 0.005);
        const foot = side > 0 ? B.footL : B.footR;
        const infl = bare ? 0 : 0.0055;
        const zEnd = bare && hi ? 0.168 : 0.19;
        const zr = lo ? [-0.068, -0.04, 0.0, 0.05, 0.11, 0.165, 0.19] : hi
            ? [-0.068, -0.063, -0.05, -0.03, -0.01, 0.012, 0.035, 0.06, 0.085, 0.11, 0.135, 0.155, 0.172, 0.184, 0.19]
            : [-0.068, -0.06, -0.035, -0.005, 0.03, 0.065, 0.1, 0.135, 0.165, 0.183, 0.19];
        const n = zr.length;
        bd.grid(D.segL, n + 1, (V, s, t, i, j) => {
            const z = Math.min(zEnd, zr[clamp(j - 1, 0, n - 1)]);
            const rs = j === 0 || j === n + 1 ? 0 : 1;
            sampleTab(FOOT_T, z, _t);
            const th = s * TAU;
            const x = Math.sin(th) * (_t[0] + infl) * rs;
            let y = _t[2] + Math.cos(th) * (_t[1] + infl) * rs;
            const sole = y < 0.012;
            if (y < 0.003) y = bare ? 0.0015 : 0;
            if (!bare && !sab && sole) y = Math.max(y, 0.007 * gs(z - 0.02, 0.025));   // arco entre salto e planta
            V.p.set(cx + x * fk * (sole && !bare ? 1.05 : 1), y * ay, z * fk);
            if (bare) skinV(V, 0.25 * ss(0.12, 0.19, z), sole ? 0.15 : 0);
            else if (sab) {
                V.c.copy(steel).multiplyScalar(1 - 0.25 * (vnoise(z * 90) > 0.5 ? 0.3 : 0));
                V.r = 0.42;
                V.m = 1;
            } else {
                V.c.copy(sole ? soleC : shoeC);
                V.r = 0.75;
            }
            if (z > 0.085) w2(V, foot, foot + 1, ss(0.085, 0.125, z));
            else w1(V, foot);
            V.u = s * 0.3;
            V.v = z;
        }, { slot: bare ? 'skin' : 'hard' });
        if (bare && hi) {
            // dedos do pé
            const TZ = [[-0.03, 0.016, 0.03], [-0.011, 0.0125, 0.026], [0.006, 0.0115, 0.022], [0.021, 0.0105, 0.017], [0.034, 0.0095, 0.011]];
            for (const [tx, tr, tl] of TZ) {
                blob(cx - side * tx * fk, 0.0135 * ay, (0.158 + tl * 0.8) * fk, tr * fk, 0.012 * ay, 0.02 * fk, {
                    slot: 'skin', nu: 6, nv: 4,
                    col: (V) => skinV(V, 0.3, 0),
                    w: (V) => w1(V, foot + 1)
                });
            }
        }
    }

    // =====================================================================
    // ROUPA BASE — o corpo é vestido por cascas infladas dos mesmos amostradores,
    // então a roupa dobra com as mesmas juntas. Pele só existe onde aparece.
    // =====================================================================
    const top = o.top;
    const clothed = top !== 'none';
    const longTop = top === 'tunic' || top === 'dress' || top === 'robe' || top === 'mail';
    const mail = top === 'mail';
    const topMat = mail ? mat(mailC, 0.5, 0.85) : mat(topC, 0.95);
    const topInfl = top === 'robe' ? 0.014 : mail ? 0.012 : top === 'dress' ? 0.006 : 0.009;
    const wrinkle = (yc, th, y0, amp) => amp * gs(yc - y0, 0.07) * Math.sin(th * 7 + yc * 40);
    const shadeMat = (base, baseInfl, k = 26) => (V, th, yc, inf) => {
        base(V);
        V.c.multiplyScalar(clamp(1 + (inf - baseInfl) * k, 0.6, 1.15));
    };
    const gownSeg = hi ? (top === 'dress' || top === 'robe' ? 48 : 36) : lo ? 12 : 22;
    const skinLimb = (jy, front) => (V, th, yc) => skinV(V, 0.3 * gs(yc - jy, 0.035) * (Math.cos(th) * front > 0 ? 1 : 0.3), 0);

    // pelve / tronco
    const botIsSkin = o.bottom === 'none' && !clothed;
    const pelvisMat = o.bottom === 'loincloth' ? mat(botC, 0.85) : botIsSkin ? (V) => skinV(V) : mat(o.bottom === 'none' ? topC : botC, 0.95);
    torsoShell(0.845, 1.03, { slot: botIsSkin ? 'skin' : o.bottom === 'loincloth' ? 'hard' : 'fabric', col: pelvisMat, infl: botIsSkin || longTop ? 0.003 : 0.013, capBot: true });
    if (!clothed) {
        torsoShell(1.0, 1.48, {
            slot: 'skin', capTop: true,
            col: (V, th, yc) => {
                const fr = ss(-0.2, 0.4, Math.cos(th));
                const nip = gs(Math.abs(th) - 0.6, 0.045) * gs(yc - 1.262, 0.011);
                const dark = 0.12 * gs(yc - 1.238, 0.022) * fr * ss(0.95, 0.5, Math.abs(th))      // sob o peitoral
                    + 0.1 * gs(th, 0.07) * ss(1.0, 1.08, yc) * ss(1.34, 1.2, yc)                     // linha alba
                    + 0.45 * gs(th, 0.03) * gs(yc - 1.045, 0.01)                                    // umbigo
                    + 0.08 * gs(yc - 1.425, 0.012) * fr                                             // clavícula
                    + 0.3 * nip;
                skinV(V, 0.5 * nip + 0.1 * gs(yc - 1.3, 0.1) * fr, dark);
            }
        });
    } else {
        const hemY = longTop ? 1.0 : 0.925;
        torsoShell(hemY, 1.48, {
            slot: 'fabric', weld: longTop ? 'gown' : null, seg: longTop ? gownSeg : 0,
            col: shadeMat(topMat, topInfl),
            infl: (yc, th) => topInfl + wrinkle(yc, th, 1.09, o.belt != null ? 0.0035 : 0.0015) * ss(1.0, 1.04, yc) + (longTop ? 0 : 0.002 * ss(1.0, 0.93, yc)),
            hem: longTop ? 0 : 0.006
        });
        // gola
        if (!lo) torsoShell(1.448, 1.482, { slot: 'fabric', col: mat(trimC, 0.9), infl: topInfl + 0.005 });
    }

    // braços
    for (const side of [1, -1]) {
        const sl = !clothed ? 'none' : plate ? 'long' : o.sleeves;
        const hem = sl === 'long' || sl === 'wide' || sl === 'puff' ? 0.905 : sl === 'short' ? 1.27 : 9;
        if (hem < 2) {
            const base = sl === 'wide' ? 0.012 : 0.008;
            const infl = sl === 'wide' ? (yc) => 0.012 + 0.07 * Math.pow(ss(1.32, 0.9, yc), 1.6)
                : sl === 'puff' ? (yc) => 0.007 + 0.027 * gs(yc - 1.35, 0.07)
                    : (yc, th) => base + wrinkle(yc, th, 1.14, 0.0055) + wrinkle(yc, th + 1, 0.97, 0.004) + wrinkle(yc, th + 2, 1.3, 0.003);
            limbShell('arm', side, ARM_TOP, hem, { slot: 'fabric', col: shadeMat(plate ? mat(mailC, 0.5, 0.85) : topMat, base), infl, capTop: true, cuff: sl === 'wide' ? 0.002 : 0.005 });
            if (sl === 'wide' || hem > 0.95) limbShell('arm', side, Math.min(ARM_TOP, hem + (sl === 'wide' ? 0.3 : 0.03)), 0.885, { slot: 'skin', col: skinLimb(1.14, -1) });
        } else {
            limbShell('arm', side, ARM_TOP, 0.885, { slot: 'skin', col: skinLimb(1.14, -1), capTop: true });
        }
    }

    // pernas
    const bootTop = o.shoes === 'boots' ? 0.36 : o.shoes === 'tall' ? 0.5 : sab ? 0.2 : 0;
    for (const side of [1, -1]) {
        const bt = o.bottom;
        let hem = bt === 'pants' ? 0.105 : bt === 'shorts' ? 0.57 : bt === 'breeches' ? 0.42 : 9;
        if (bootTop && hem < bootTop) hem = bootTop - 0.04;
        if (hem < 2) {
            limbShell('leg', side, LEG_TOP, hem, {
                slot: 'fabric', col: shadeMat(mat(botC, 0.95), 0.009), capTop: true, cuff: bootTop && hem < bootTop ? 0 : 0.005,
                infl: (yc, th) => 0.009 + wrinkle(yc, th, 0.5, 0.0055) + wrinkle(yc, th + 2, 0.2, 0.0045) + wrinkle(yc, th + 1, 0.76, 0.003) + 0.004 * gs(yc - 0.8, 0.12)
            });
        }
        const skinTop = hem < 2 ? hem + 0.03 : LEG_TOP;
        const skinBot = bootTop ? bootTop - 0.04 : 0.07;
        if (skinTop > skinBot + 0.02) limbShell('leg', side, skinTop, skinBot, { slot: 'skin', col: skinLimb(0.5, 1), capTop: hem > 2 });
        if (bootTop) {
            limbShell('leg', side, bootTop, 0.07, {
                slot: 'hard', cuffTop: 0.007,
                col: sab ? mat(steel, 0.42, 1) : shadeMat(mat(shoeC, 0.75), 0.011),
                infl: (yc, th) => 0.011 + 0.004 * ss(bootTop - 0.1, bootTop, yc) + wrinkle(yc, th, 0.13, 0.003)
            });
        }
    }

    const longSkirt = top === 'dress' || top === 'robe';
    // =====================================================================
    // SAIAS, BARRAS, PAINÉIS — anel do quadril que abre até a barra, com pregas
    // senoidais. Pesos: pelve + coxas (cada lado segue a sua perna) + canela na
    // parte baixa; o resto do peso vai ao osso `skirt` (pêndulo).
    // =====================================================================
    const _s = [0, 0, 0, 0];
    /**
     * q: { y1, y0 (barra), hemRx, hemRz, fold, nFold, infl, arc:[θ0,θ1], slot, col(V,th,yc,fold01), hem (lábio), zOff, uSpan }
     */
    function skirtShell(q) {
        const rows = rowsOf(TORSO_T, Math.max(q.y0, 0.93), Math.max(q.y1, 0.93), D.gap, D.minGap);
        if (q.y1 < 0.93) rows.length = 0;
        if (q.y0 < 0.93) {
            const top = Math.min(q.y1, 0.93);
            const n = Math.max(2, Math.round((top - q.y0) / (D.gap * 1.6)));
            for (let k = rows.length ? 1 : 0; k <= n; k++) rows.push(lerp(top, q.y0, k / n));
        }
        const lip = q.hem !== false;
        const a0 = q.arc ? q.arc[0] : -PI;
        const a1 = q.arc ? q.arc[1] : PI;
        const nu = Math.max(4, Math.round((q.seg || (hi ? 36 : lo ? 12 : 22)) * (a1 - a0) / TAU));
        const U = (q.uSpan || 1.2) * (a1 - a0) / TAU;
        sampleTab(TORSO_T, 0.93, _s);
        const rx0 = _s[0] * torsoWK(0.93) + (q.infl || 0);
        const rz0 = _s[1] * dK + (q.infl || 0);
        const span = Math.max(0.01, 0.93 - q.y0);
        bd.grid(nu, rows.length - 1 + (lip ? 1 : 0), (V, s, t, i, j) => {
            const isLip = j >= rows.length;
            const yc = rows[Math.min(j, rows.length - 1)] + (isLip ? 0.012 : 0);
            const th = a0 + (a1 - a0) * s;
            let fd = 0;
            if (yc >= 0.93) {
                torsoPoint(th, yc, (q.infl || 0) - (isLip ? 0.006 : 0), V.p);
                torsoW(V, yc, V.p.x);
            } else {
                const f = (0.93 - yc) / span;
                const fe = Math.pow(f, 0.85);
                const sn = Math.sin(th);
                const cs = Math.cos(th);
                fd = Math.sin(th * (q.nFold || 9) + 1.3 + 2 * f) * 0.5 + 0.5;
                const k = 1 + (q.fold || 0) * fe * (fd - 0.5) * 2 - (isLip ? 0.03 : 0);
                const rx = lerp(rx0, q.hemRx, fe) * k;
                const rz = lerp(rz0, q.hemRz, fe) * k;
                V.p.set(rx * spow(sn, 0.87), Y(yc), -0.006 * dK + (q.zOff || 0) * fe + rz * spow(cs, 0.87));
                // pesos
                const kT = 0.96 * ss(0.93, 0.74, yc);
                const kS = ss(0.52, 0.22, yc) * 0.9;
                const sL = ss(-0.05, 0.05, V.p.x);
                V.w[0] = B.skirt;
                V.w[1] = 1 - kT;
                V.w[2] = B.thighL;
                V.w[3] = kT * sL * (1 - kS);
                V.w[4] = B.thighR;
                V.w[5] = kT * (1 - sL) * (1 - kS);
                V.w[6] = V.p.x > 1e-5 ? B.shinL : B.shinR;   // tolerância: a costura (x≈±0) precisa cair no mesmo osso
                V.w[7] = kT * kS;
            }
            V.u = s * U;
            V.v = V.p.y;
            q.col(V, th, yc, fd);
            if (yc < 0.93) V.c.multiplyScalar(0.62 + 0.42 * fd);
        }, { slot: q.slot, wrap: !q.arc, inside: V3(0, Y((q.y0 + q.y1) / 2), 0), weld: q.weld });
    }
    const hipW = 0.176 * torsoWK(0.93);
    if (longTop) {
        const S = top === 'dress' ? { y0: 0.075, rx: 0.33, rz: 0.31, fold: 0.125, n: 10 }
            : top === 'robe' ? { y0: 0.05, rx: 0.25, rz: 0.22, fold: 0.095, n: 8 }
                : { y0: mail ? 0.7 : 0.66, rx: hipW + 0.045, rz: 0.118 * dK + 0.05, fold: mail ? 0.02 : 0.075, n: 9 };
        skirtShell({ y1: 1.0, y0: S.y0, hemRx: Math.max(S.rx, hipW + 0.03), hemRz: Math.max(S.rz, 0.12 * dK + 0.03), fold: S.fold, nFold: S.n, infl: topInfl, slot: 'fabric', col: topMat, weld: 'gown', seg: gownSeg });
        if (!mail) skirtShell({ y1: S.y0 + 0.045, y0: S.y0 - 0.004, hemRx: Math.max(S.rx, hipW + 0.03) + 0.004, hemRz: Math.max(S.rz, 0.12 * dK + 0.03) + 0.004, fold: S.fold, nFold: S.n, infl: topInfl, slot: 'fabric', col: mat(trimC, 0.9), hem: false, seg: gownSeg });
    }
    if (o.bottom === 'skirt') {
        skirtShell({ y1: 1.03, y0: 0.36, hemRx: 0.27, hemRz: 0.25, fold: 0.07, nFold: 10, infl: 0.012, slot: 'fabric', col: mat(botC, 0.95) });
    }
    if (o.bottom === 'loincloth') {
        for (const a of [0, PI]) {
            skirtShell({ y1: 1.0, y0: 0.6, hemRx: hipW + 0.02, hemRz: 0.13 * dK + 0.02, fold: 0.04, nFold: 7, infl: 0.022, arc: [a - 0.6, a + 0.6], slot: 'hard', col: mat(botC, 0.85) });
        }
    }
    const overInfl = (plate || halfPlate ? 0.024 : topInfl) + 0.008;
    if (o.tabard != null) {
        const tc = C(o.tabard);
        for (const a of [0, PI]) {
            skirtShell({ y1: 1.445, y0: 0.62, hemRx: hipW + 0.04, hemRz: 0.13 * dK + 0.045, fold: 0.03, nFold: 6, infl: overInfl + 0.004, arc: [a - 0.62, a + 0.62], slot: 'fabric', col: (V, th, yc) => {
                V.c.copy(tc);
                V.r = 0.95;
                if (Math.abs(Math.abs(th - a) - 0.62) < 0.07 || yc < 0.66) V.c.copy(trimC);
            } });
        }
    }
    if (o.apron != null) {
        const ac = C(o.apron);
        const baseR = longTop ? (top === 'dress' ? 0.33 : 0.25) : hipW + 0.03;
        skirtShell({ y1: 1.04, y0: 0.42, hemRx: Math.max(baseR * 0.82, hipW + 0.03) + 0.012, hemRz: (top === 'dress' ? 0.26 : 0.16) + 0.012, fold: top === 'dress' ? 0.06 : 0.03, nFold: 10, infl: topInfl + 0.008, arc: [-0.95, 0.95], slot: 'fabric', col: mat(ac, 0.95) });
        torsoShell(1.03, 1.3, { slot: 'fabric', col: mat(ac, 0.95), infl: topInfl + 0.008, arc: [-0.42, 0.42] });
    }

    // ---- cinto, colete ----
    if (o.belt != null) {
        const bc = C(o.belt);
        torsoShell(0.99, 1.035, { slot: 'hard', col: mat(bc, 0.7), infl: overInfl + (o.vest != null ? 0.01 : 0) + 0.002 });
        const _b = V3();
        torsoPoint(0, 1.012, overInfl + 0.01, _b);
        if (!lo) blob(0, _b.y, _b.z, 0.022, 0.02, 0.006, { slot: 'hard', nu: 8, nv: 4, col: mat(C(o.buckle), 0.35, 1), w: (V) => w1(V, B.hips) });
    }
    if (o.vest != null) {
        const vc = C(o.vest);
        torsoShell(0.955, 1.452, {
            slot: 'fabric', arc: [0.16, TAU - 0.16], hem: 0.004,
            col: (V, th, yc) => {
                V.c.copy(vc);
                V.r = 0.9;
                if (th < 0.24 || th > TAU - 0.24) V.c.multiplyScalar(0.7);
            },
            infl: (yc) => topInfl + 0.009 + 0.004 * ss(1.1, 0.96, yc)
        });
    }

    // =====================================================================
    // ARMADURA DE PLACAS
    // =====================================================================
    const metalV = (rough = 0.3, tint = 1) => (V, th = 0, yc = 0) => {
        V.c.copy(steel).multiplyScalar(tint * (0.93 + 0.1 * vnoise(yc * 60 + th * 3)));
        V.r = rough;
        V.m = 1;
    };
    const armorMat = o.armor === 'leather' ? mat(C(0x5a3d26), 0.75) : metalV();
    if (o.armor !== 'none') {
        // peitoral com quilha central + gorjal
        torsoShell(1.0, 1.452, {
            slot: 'hard', col: armorMat, hem: 0.006,
            infl: (yc, th) => 0.02 + 0.007 * gs(yc - 1.27, 0.12) + 0.012 * gs(th, 0.35) * gs(yc - 1.2, 0.16) + 0.006 * gs(yc - 1.0, 0.025) - 0.004 * gs(yc - 1.08, 0.04)
        });
        torsoShell(1.44, 1.488, { slot: 'hard', col: armorMat, infl: 0.03 });
        if (hi) {
            // rebites na cintura e no alto do peito
            const _rv = V3();
            const rivet = (th, yc) => {
                torsoPoint(th, yc, 0.031, _rv);
                blob(_rv.x, _rv.y, _rv.z, 0.0065, 0.0065, 0.0065, { slot: 'hard', nu: 5, nv: 3, col: mat(o.armor === 'leather' ? C(0x8a8478) : gold, 0.3, 1), w: (V) => torsoW(V, yc, _rv.x) });
            };
            for (let k = 0; k < 10; k++) rivet((k + 0.5) / 10 * TAU - PI, 1.022);
            for (let k = -2; k <= 2; k++) if (k) rivet(k * 0.3, 1.4);
        }
        if (o.armor !== 'leather') {
            // escarcela (lâminas sob a cintura)
            for (let k = 0; k < 3; k++) {
                skirtShell({ y1: 1.0 - k * 0.055, y0: 0.925 - k * 0.055, hemRx: hipW + 0.035 + k * 0.012, hemRz: 0.125 * dK + 0.035 + k * 0.012, fold: 0, infl: 0.024 + k * 0.006, slot: 'hard', col: metalV(0.42, 0.95) });
            }
        }
        for (const side of [1, -1]) {
            const cl = side > 0 ? B.clavL : B.clavR;
            // ombreira: cúpula + lâmina
            const by = V3(side * 0.62, 0.78, 0).normalize();
            const basis = [V3(by.y, -by.x, 0), by, V3(0, 0, 1)];
            const pk = Math.pow(armK, 0.6);
            const rim = (p, a, b) => {
                // aba levemente virada para fora na borda da cúpula
                const e = ss(0.75, 1, b / (PI * 0.52));
                p.x *= 1 + 0.1 * e;
                p.z *= 1 + 0.1 * e;
            };
            blob(side * (shX + 0.002), shY + 0.004, 0, 0.1 * pk, 0.082 * pk, 0.112 * pk, {
                slot: 'hard', frac: 0.52, basis, nu: hi ? 16 : 8, nv: hi ? 7 : 3, col: armorMat, shape: rim,
                w: (V) => w2(V, cl, cl + 1, 0.5), inside: V3(side * shX, shY - 0.06, 0)
            });
            if (o.armor === 'plate') {
                blob(side * (shX + 0.014), shY - 0.045, 0, 0.082 * pk, 0.075 * pk, 0.09 * pk, {
                    slot: 'hard', frac: 0.55, basis, nu: hi ? 14 : 8, nv: hi ? 5 : 3, col: metalV(0.42, 0.9), shape: rim,
                    w: (V) => w1(V, cl + 1), inside: V3(side * shX, shY - 0.12, 0)
                });
                limbShell('arm', side, 1.33, 1.185, { slot: 'hard', col: armorMat, infl: 0.013, cuff: 0.004, cuffTop: 0.004 });
                limbShell('arm', side, 1.1, 0.9, { slot: 'hard', col: armorMat, infl: (yc) => 0.012 + 0.012 * ss(0.96, 0.9, yc), cuffTop: 0.004 });
                const _e = V3();
                armPoint(side, PI, 1.14, 0.012, _e);
                blob(_e.x, _e.y, _e.z + 0.012, 0.045 * pk, 0.05 * pk, 0.03 * pk, { slot: 'hard', col: metalV(0.38), w: (V) => w2(V, cl + 1, cl + 2, 0.5), nu: 8, nv: 4 });
                limbShell('leg', side, 0.87, 0.56, { slot: 'hard', col: armorMat, infl: 0.016, cuff: 0.004, cuffTop: 0.004 });
                limbShell('leg', side, 0.45, 0.19, { slot: 'hard', col: armorMat, infl: 0.014, cuffTop: 0.005 });
                if (!lo) {
                    // lâminas articuladas em ombro, cotovelo e joelho
                    const lame = (kind, y1, y0, inf) => limbShell(kind, side, y1, y0, { slot: 'hard', seg: hi ? 12 : 6, col: metalV(0.32, 0.86), infl: inf, cuff: 0.006 });
                    lame('arm', 1.378, 1.348, 0.026);
                    lame('arm', 1.352, 1.324, 0.021);
                    lame('arm', 1.202, 1.174, 0.02);
                    lame('arm', 1.114, 1.088, 0.02);
                    lame('leg', 0.578, 0.548, 0.023);
                    lame('leg', 0.464, 0.436, 0.022);
                }
                const th = side > 0 ? B.thighL : B.thighR;
                legPoint(side, 0, 0.5, 0.016, _e);
                blob(_e.x, _e.y, _e.z - 0.015, 0.052 * legK, 0.06 * legK, 0.035 * legK, { slot: 'hard', col: metalV(0.38), w: (V) => w2(V, th, th + 1, 0.5), nu: 8, nv: 4 });
            } else {
                limbShell('arm', side, 1.08, 0.9, { slot: 'hard', col: armorMat, infl: (yc) => 0.01 + 0.008 * ss(0.96, 0.9, yc), cuffTop: 0.004 });
            }
        }
    }
    if (o.gloves !== 'none' && !plate) {
        for (const side of [1, -1]) {
            limbShell('arm', side, 0.955, 0.885, { slot: 'hard', col: gauntlet ? metalV() : mat(gloveC, 0.8), infl: (yc) => 0.004 + 0.016 * ss(0.89, 0.955, yc), cuffTop: 0.003 });
        }
    }

    // =====================================================================
    // CABELO, BARBA, CHAPÉUS — cascas sobre a superfície do crânio (shellPos)
    // =====================================================================
    const HC0 = V3(0, 0.115, -0.005);
    function shellPos(th, y, thick, out, flare = 0.5, backK = 1) {
        headBase(th, Math.max(y, 0.05), out);
        const nx = out.x - HC0.x;
        const ny = out.y - HC0.y;
        const nz = out.z - HC0.z;
        const nl = Math.hypot(nx, ny, nz) || 1;
        out.x += (nx / nl) * thick;
        out.y += (ny / nl) * thick;
        out.z += (nz / nl) * thick;
        if (y < 0.05) {
            // abaixo do crânio a mecha pende: abertura e recuo quadráticos (sem quina na passagem)
            const d = 0.05 - y;
            out.y = y;
            out.x *= 1 + d * d * flare * 4;
            out.z -= 1.5 * d * d * ss(1.1, 2.2, Math.abs(th)) * backK;
        }
    }
    /**
     * Casca sobre a cabeça. q: { edge(th)→y da borda, top(th)→y inicial (padrão: polo), thick(th,tt,y), col(V,th,tt,y,tuck),
     * w(V,th,tt,y), shape(p,th,tt,y), slot, rows, nu, tuck, flare, backK, vLen }
     */
    function capShell(q) {
        const nu = q.nu || (hi ? 48 : lo ? 10 : 22);
        const rows = q.rows || (hi ? [0, 0.1, 0.22, 0.36, 0.5, 0.64, 0.77, 0.88, 0.96, 1] : lo ? [0, 0.35, 0.7, 1] : [0, 0.2, 0.42, 0.64, 0.84, 1]);
        const n = rows.length;
        const tuck = q.tuck !== false;
        bd.grid(nu, n - 1 + (tuck ? 1 : 0), (V, s, t, i, j) => {
            const th = s * TAU - PI;
            const tt = rows[Math.min(j, n - 1)];
            const isTuck = j >= n;
            const y = lerp(q.top ? q.top(th) : 0.228, q.edge(th), tt) + (isTuck ? 0.005 : 0);
            shellPos(th, y, isTuck ? 0.0004 : q.thick(th, tt, y), V.p, q.flare, q.backK);
            if (q.shape) q.shape(V.p, th, tt, y);
            HT(V.p);
            V.u = th * 0.09;
            V.v = tt * (q.vLen || 0.16);
            q.col(V, th, tt, y, isTuck);
            if (q.w) q.w(V, th, tt, y);
            else w1(V, B.head);
        }, { slot: q.slot, inside: HT(V3(0, 0.1, 0)) });
    }
    /** Tubo ao longo de um caminho path(t, out) em hc; q: { r(t), n, nu, col(V,t,a), w(V,t), slot, squash } */
    const _pa = V3();
    const _pb = V3();
    const _pt = V3();
    const _pn = V3();
    const _pc = V3();
    function tubeHC(path, q) {
        const n = q.n || (hi ? 12 : 6);
        const nu = q.nu || (hi ? 8 : 5);
        bd.grid(nu, n, (V, s, t, i, j) => {
            const tt = j / n;
            path(tt, _pa);
            path(Math.min(1, tt + 0.02), _pb);
            path(Math.max(0, tt - 0.02), _pc);
            _pt.subVectors(_pb, _pc).normalize();
            _pn.set(1, 0, 0).addScaledVector(_pt, -_pt.x).normalize();
            _pb.crossVectors(_pt, _pn);
            const a = s * TAU;
            const r = q.r(tt);
            V.p.copy(_pa).addScaledVector(_pn, Math.cos(a) * r).addScaledVector(_pb, Math.sin(a) * r * (q.squash || 1));
            HT(V.p);
            V.u = s * 0.05;
            V.v = tt * (q.vLen || 0.2);
            q.col(V, tt, a);
            q.w(V, tt);
        }, { slot: q.slot || 'hair' });
    }
    /** Torneado em hc: profile [[r, y], …]; q: { c:[x,y,z], rx, rz, tilt, wave(a,r), bend(p,k), col(V,a,j), w(V,j), slot, nu } */
    function lathe(profile, q) {
        const nu = q.nu || (hi ? 24 : lo ? 8 : 14);
        const n = profile.length;
        const ct = Math.cos(q.tilt || 0);
        const st = Math.sin(q.tilt || 0);
        bd.grid(nu, n - 1, (V, s, t, i, j) => {
            const r = profile[j][0];
            const a = s * TAU;
            const x = Math.sin(a) * r * (q.rx || 1);
            const z = Math.cos(a) * r * (q.rz || 1);
            const y = profile[j][1] + (q.wave ? q.wave(a, r, j) : 0);
            V.p.set(q.c[0] + x, q.c[1] + y * ct - z * st, q.c[2] + y * st + z * ct);
            if (q.bend) q.bend(V.p, j / (n - 1));
            HT(V.p);
            V.u = s * 0.5;
            V.v = j * 0.03;
            q.col(V, a, j);
            if (q.w) q.w(V, j);
            else w1(V, B.head);
        }, { slot: q.slot, inside: HT(V3(q.c[0], q.c[1] + (q.insideY ?? 0.03), q.c[2])) });
    }

    const HS = o.hairStyle;
    const hat = o.hat;
    const helmet = hat === 'helm' || hat === 'kettle' || hat === 'greathelm';
    const covered = helmet || hat === 'scarf' || hat === 'bandana' || hat === 'wizard' || hat === 'straw' || hat === 'beret' || hat === 'cap' || o.hood === 'up';
    const hl = (th) => hairlineY(Math.abs(th));
    const jit = (th, k = 2.6) => vnoise(th * k + o.seed * 3.1) - 0.5;
    const clump = (th, tt) => 0.5 + 0.5 * Math.sin(th * 7 + tt * 2.2 + 2.5 * vnoise(th * 1.7 + 5 + o.seed));
    const hairCol = (V, th, tt, y, tuckRow) => {
        const cl = clump(th, tt);
        V.c.copy(hairC).multiplyScalar((0.76 + 0.36 * cl) * (tuckRow ? 0.45 : 1) * (0.85 + 0.15 * tt));
        V.r = 0.86;
    };
    const hairW = (V, th, tt, y) => {
        if (y > 0.05) w1(V, B.head);
        else if (y > -0.07) w2(V, B.head, B.hair1, ss(0.05, -0.06, y));
        else w2(V, B.hair1, B.hair2, ss(-0.07, -0.2, y));
    };
    if (HS !== 'bald' && hat !== 'greathelm') {
        const a_ = Math.abs;
        const tight = HS === 'bun' || HS === 'ponytail' || HS === 'braids';
        let T = HS === 'buzz' ? 0.0035 : tight ? 0.009 : HS === 'curly' ? 0.026 : HS === 'wild' ? 0.03 : HS === 'bob' || HS === 'long' ? 0.019 : 0.015;
        if (covered) T = Math.min(T, helmet ? 0.004 : 0.012);
        let edge;
        if (HS === 'long') edge = (th) => lerp(lerp(hl(th) + 0.004 - 0.034 * ss(0.08, 0.66, a_(th)), 0.0, ss(0.68, 1.0, a_(th))), -0.2, ss(1.2, 2.0, a_(th))) + 0.008 * jit(th) + 0.006 * jit(th, 5.5) * ss(1.0, 0.4, a_(th));
        else if (HS === 'bob') edge = (th) => lerp(hl(th) + 0.004 - 0.03 * ss(0.08, 0.66, a_(th)), 0.006, ss(0.68, 1.0, a_(th))) + 0.006 * jit(th);
        else if (HS === 'wild') edge = (th) => lerp(hl(th) - 0.012, -0.04, ss(1.25, 1.9, a_(th))) + 0.03 * jit(th, 4.5);
        else if (HS === 'buzz' || tight) edge = (th) => hl(th) + 0.002;
        else if (HS === 'curly') edge = (th) => hl(th) - 0.01 + 0.014 * jit(th, 4);
        else if (HS === 'mohawk') edge = (th) => (a_(th) < PI / 2 ? 0.178 : 0.07);
        else edge = (th) => hl(th) - 0.004 - 0.012 * ss(1.1, 0.5, a_(th)) * (0.5 + jit(th, 3)) + 0.006 * jit(th) + 0.008 * jit(th, 5.5) * ss(1.0, 0.4, a_(th));
        let top = null;
        let thick;
        if (HS === 'balding') {
            top = (th) => Math.min(0.168, Math.max(hl(th) + 0.001, 0.168 - 0.2 * ss(1.15, 0.8, a_(th))));
            edge = (th) => lerp(top(th), hl(th) + 0.004 * jit(th), ss(0.85, 1.0, a_(th)));
            thick = (th, tt) => 0.012 * Math.sin(PI * clamp(tt * 0.9 + 0.05)) * ss(0.8, 1.1, a_(th)) * (0.8 + 0.4 * clump(th, tt));
        } else if (HS === 'mohawk') {
            thick = (th, tt) => -0.001 + 0.06 * gs(Math.min(a_(th), PI - a_(th)), 0.2) * Math.pow(Math.sin(PI * clamp(tt * 0.95 + 0.04)), 0.5) * (0.75 + 0.5 * vnoise(tt * 14 + th));
        } else if (HS === 'curly') {
            thick = (th, tt) => T * (0.5 + 0.5 * Math.sin(PI * Math.min(1, tt * 1.1))) * (0.6 + 0.9 * vnoise(th * 5 + 3) * vnoise(tt * 9 + th * 2 + 7) + 0.35 * clump(th * 1.7, tt * 3));
        } else {
            thick = (th, tt, y) => T * (0.4 + 0.6 * Math.sin(PI * Math.pow(Math.min(1, tt * 1.08), 0.8))) * (0.92 + 0.1 * clump(th, tt)) * (1 - 0.2 * ss(0.05, 0.0, y));
        }
        capShell({
            slot: 'hair', edge, top, thick, col: hairCol, w: HS === 'long' || HS === 'wild' ? hairW : null, tuck: HS !== 'balding',
            rows: HS === 'long' && hi ? [0, 0.07, 0.15, 0.24, 0.33, 0.42, 0.52, 0.62, 0.72, 0.81, 0.9, 0.96, 1] : null,
            vLen: HS === 'long' ? 0.4 : 0.16,
            shape: HS === 'bob' ? (p, th, tt, y) => {
                if (y < 0.04) {
                    p.x *= 1 - 3 * (0.04 - y);
                }
            } : null
        });
        if (!lo && HS !== 'buzz' && HS !== 'mohawk' && HS !== 'balding' && !helmet) {
            // mechas soltas (fitas em ponta) na franja e nas pontas: quebram a borda reta da casca
            const lock = (th, y0, len, w, sweep, lift) => bd.grid(2, 4, (V, s, t, i, j) => {
                const tt = j / 4;
                const y = y0 - len * tt;
                const a = th + sweep * tt * tt + ((s - 0.5) * w * Math.pow(Math.sin(PI * Math.min(1, tt * 0.9 + 0.1)), 0.7)) / 0.085;
                shellPos(a, y, lift + T * 0.3 * Math.sin(PI * tt), V.p, 0.5, 1);
                HT(V.p);
                V.c.copy(hairC).multiplyScalar(0.78 + 0.34 * rnd(th * 31 + i * 3));
                V.r = 0.86;
                V.u = th * 0.09 + s * w;
                V.v = tt * len;
                hairW(V, a, tt, y);
            }, { slot: 'hair', wrap: false, inside: HT(V3(0, 0.1, 0)) });
            const n = hi ? 16 : 8;
            for (let k = 0; k < n; k++) {
                const r1 = rnd(k * 7.7 + 1);
                const r2 = rnd(k * 3.3 + 2);
                if (HS === 'long' || HS === 'bob' || HS === 'wild') {
                    const th = (k % 2 ? 1 : -1) * lerp(0.82, 3.05, (k + r1) / n);
                    lock(th, edge(th) + 0.05, 0.08 + 0.05 * r2, 0.03, (r1 - 0.5) * 0.14, 0.001);
                } else if (!covered) {
                    if (k % 2) continue;
                    const th = lerp(-0.8, 0.75, (k + r1 * 1.4) / n);
                    lock(th, edge(th) + 0.016, 0.02 + 0.014 * r2, 0.034, 0.22 + 0.15 * r1, 0.001);
                }
            }
        }
        if (HS === 'bun' && !helmet) {
            blob(0, chinY + 0.172 * kH, zH - 0.108 * kH, 0.043 * kH, 0.04 * kH, 0.04 * kH, {
                slot: 'hair', nu: hi ? 14 : 8, nv: hi ? 8 : 4,
                col: (V, a, b) => {
                    V.c.copy(hairC).multiplyScalar(0.75 + 0.4 * (0.5 + 0.5 * Math.sin(a * 2 + b * 9)));
                    V.r = 0.5;
                },
                shape: (p, a, b) => p.multiplyScalar(1 + 0.07 * Math.sin(a * 2 + b * 9)),
                w: (V) => w1(V, B.head)
            });
        }
        if (HS === 'ponytail') {
            tubeHC((t, out) => out.set(0, 0.165 - 0.3 * t * t - 0.03 * t, -0.1 - 0.065 * Math.sin(PI * Math.min(1, t * 1.4) * 0.6)), {
                r: (t) => (t < 0.06 ? 0.014 + 0.2 * t : 0.03 * (1 - 0.65 * t * t)) * (t > 0.99 ? 0.1 : 1), n: hi ? 12 : 6, nu: hi ? 10 : 6, vLen: 0.35,
                col: (V, t, a) => {
                    V.c.copy(t > 0.05 && t < 0.1 ? trimC : hairC).multiplyScalar(0.75 + 0.4 * (0.5 + 0.5 * Math.sin(a * 3 + t * 5)));
                    V.r = 0.5;
                },
                w: (V, t) => (t < 0.2 ? w1(V, B.head) : t < 0.6 ? w2(V, B.head, B.hair1, ss(0.2, 0.6, t)) : w2(V, B.hair1, B.hair2, ss(0.6, 1, t)))
            });
        }
        if (HS === 'braids') {
            const zEnd = (0.128 * dK + P.bust * 0.8 + 0.022 - zH) / kH;
            const xEnd = (0.07 * torsoWK(1.3)) / kH + 0.02;
            for (const side of [1, -1]) {
                tubeHC((t, out) => out.set(side * lerp(0.07, xEnd, ss(0, 0.5, t)) + side * 0.003 * Math.sin(t * 22), lerp(0.07, -0.27, t), lerp(-0.03, zEnd, ss(0.03, 0.42, t)) + 0.003 * Math.cos(t * 22)), {
                    r: (t) => (t > 0.985 ? 0.002 : t > 0.9 ? 0.012 + 0.03 * (t - 0.9) : 0.0165 * (1 - 0.25 * t) * (1 + 0.2 * Math.abs(Math.sin(t * 22)))),
                    n: hi ? 30 : 10, nu: hi ? 8 : 5, vLen: 0.35,
                    col: (V, t, a) => {
                        V.c.copy(t > 0.86 && t < 0.9 ? trimC : hairC).multiplyScalar(0.7 + 0.45 * Math.abs(Math.sin(t * 22 + a)));
                        V.r = 0.5;
                    },
                    w: (V, t) => (t < 0.22 ? w1(V, B.head) : t < 0.5 ? w2(V, B.head, B.chest, ss(0.22, 0.5, t)) : w1(V, B.chest))
                });
            }
        }
    }

    // ---- barba e bigode ----
    const bd_ = o.beard;
    const beardC = hairC;
    if (bd_ === 'goatee' || bd_ === 'full' || bd_ === 'long' || bd_ === 'braided') {
        const thM = bd_ === 'goatee' ? 0.5 : 1.28;
        const len = bd_ === 'long' ? 0.24 : bd_ === 'braided' ? 0.16 : bd_ === 'full' ? 0.03 : 0.022;
        const Tb = bd_ === 'goatee' ? 0.008 : bd_ === 'full' ? 0.014 : 0.024;
        const rows = hi ? [0, 0.08, 0.18, 0.3, 0.42, 0.55, 0.68, 0.8, 0.9, 0.97, 1] : [0, 0.2, 0.45, 0.7, 0.9, 1];
        const _bp = V3();
        bd.grid(hi ? 20 : 10, rows.length - 1, (V, s, t, i, j) => {
            const th = (s * 2 - 1) * thM;
            const k = Math.abs(th) / thM;
            const tt = rows[j];
            // borda de cima: logo abaixo do lábio no centro, sobe até a costeleta nos lados
            const yTop = lerp(0.0365, 0.102, Math.pow(k, 1.5)) * (bd_ === 'goatee' ? 0.9 : 1);
            const yBot = lerp(-0.012 - len, 0.035, Math.pow(k, 1.3)) + (0.008 + 0.12 * len) * (vnoise(th * 8 + o.seed) - 0.5) * (1 - k);
            const y = lerp(yTop, yBot, tt);
            const yy = Math.max(y, -0.008);
            const c = headBase(th, yy, V.p);
            const fm = ss(0, 0.4, c);
            V.p.z += faceDz(V.p.x, yy) * fm * (1 - ss(0.04, 0.03, yy) * 0.5);
            const cl = 0.5 + 0.5 * Math.sin(th * 15 + tt * 3 + 2 * vnoise(th * 4));
            const tk = Tb * Math.sin(PI * clamp(tt * 0.92 + 0.02)) ** 0.7 * (0.75 + 0.4 * cl) * (1 - 0.6 * k * k);
            _bp.set(V.p.x, (yy - 0.03) * 0.6, V.p.z).normalize();
            V.p.addScaledVector(_bp, tk + 0.0008);
            if (y < -0.008) {
                // barba que pende: afunila e avança um pouco
                const d = -0.008 - y;
                V.p.y = y;
                V.p.x *= Math.max(0.12, 1 - d / (len * 1.15));
                V.p.z = lerp(V.p.z, 0.075 + 0.02, ss(0, 0.06, d)) - (c < 0.5 ? d * 0.4 : 0);
                V.p.z -= 0.012 * Math.cos(th * 1.2) * (1 - Math.max(0.12, 1 - d / (len * 1.15)));
            }
            HT(V.p);
            V.c.copy(beardC).multiplyScalar((0.72 + 0.45 * cl) * (tt < 0.05 || tt > 0.98 ? 0.6 : 1));
            V.r = 0.86;
            V.u = th * 0.08;
            V.v = tt * (0.08 + len);
            const jw = lerp(1, 0.3, ss(0.05, 0.1, yy)) * ss(-0.03, 0.02, V.p.z);
            if (y > -0.012) w2(V, B.head, B.jaw, jw);
            else w2(V, B.jaw, B.beard, ss(-0.012, -0.1, y));
        }, { slot: 'hair', wrap: false, inside: HT(V3(0, 0.04, 0)) });
        if (bd_ === 'braided') {
            for (const side of [1, -1]) {
                tubeHC((t, out) => out.set(side * (0.022 + 0.012 * t), -0.06 - 0.2 * t, 0.085 + 0.015 * Math.sin(PI * t)), {
                    r: (t) => (t > 0.98 ? 0.002 : 0.012 * (1 - 0.3 * t) * (1 + 0.25 * Math.abs(Math.sin(t * 30)))), n: hi ? 14 : 6, vLen: 0.25,
                    col: (V, t, a) => {
                        V.c.copy(t > 0.85 && t < 0.9 ? C(o.buckle) : beardC).multiplyScalar(0.72 + 0.4 * Math.abs(Math.sin(t * 30 + a)));
                        V.r = t > 0.85 && t < 0.9 ? 0.35 : 0.55;
                        V.m = t > 0.85 && t < 0.9 ? 1 : 0;
                    },
                    w: (V, t) => w2(V, B.jaw, B.beard, ss(0, 0.3, t))
                });
            }
        }
    }
    if (bd_ === 'mustache' || bd_ === 'goatee' || bd_ === 'full' || bd_ === 'long' || bd_ === 'braided') {
        const big = bd_ === 'mustache' || bd_ === 'long' || bd_ === 'braided';
        for (const side of [1, -1]) {
            tubeHC((t, out) => {
                const x = lerp(0.0015, (big ? 0.038 : 0.029) * mW, t);
                const y = 0.0625 - 0.004 * t - (big ? 0.016 : 0.01) * t * t;
                out.set(side * x, y, faceZ(x, Math.max(y, 0.052)) + 0.0035 * (1 - 0.5 * t));
            }, {
                r: (t) => (t > 0.97 ? 0.0006 : (big ? 0.0065 : 0.005) * (1 - 0.6 * t * t)), n: hi ? 7 : 4, nu: hi ? 7 : 5, squash: 0.75, vLen: 0.04,
                col: (V, t, a) => {
                    V.c.copy(beardC).multiplyScalar(0.75 + 0.35 * (0.5 + 0.5 * Math.sin(a * 3 + t * 8)));
                    V.r = 0.55;
                },
                w: (V, t) => {
                    w1(V, B.head);
                    wAdd(V, side > 0 ? B.mouthL : B.mouthR, 0.5 * t);
                }
            });
        }
    }

    // ---- chapéus, elmos, lenços, capuz ----
    const hatC = C(o.hatColor);
    const HATC = [0, 0.176, -0.008];
    const hatW = (kTop) => (V, j) => w1(V, B.head);
    void hatW;
    if (hat === 'straw') {
        lathe([[0.084, -0.004], [0.2, -0.016], [0.207, -0.011], [0.2, -0.006], [0.093, 0.004], [0.09, 0.016], [0.086, 0.062], [0.074, 0.078], [0.04, 0.085], [0, 0.086]], {
            c: HATC, rz: 1.18, tilt: -0.06, slot: 'fabric', nu: hi ? 28 : 14,
            wave: (a, r) => (r > 0.15 ? 0.012 * Math.sin(a * 3 + 1) + 0.006 * Math.sin(a * 7) - 0.012 : 0),
            col: (V, a, j) => {
                V.c.copy(hatC).multiplyScalar(0.85 + 0.2 * vnoise(a * 30 + j * 3));
                V.r = 0.9;
                if (j === 5) V.c.copy(trimC);
            }
        });
    } else if (hat === 'wizard') {
        lathe([[0.086, -0.002], [0.19, -0.02], [0.196, -0.014], [0.188, -0.008], [0.094, 0.006], [0.09, 0.022], [0.078, 0.07], [0.062, 0.13], [0.045, 0.19], [0.028, 0.245], [0.012, 0.29], [0, 0.31]], {
            c: HATC, rz: 1.16, tilt: -0.1, slot: 'fabric', nu: hi ? 24 : 12,
            wave: (a, r) => (r > 0.15 ? 0.014 * Math.sin(a * 2 + 0.5) + 0.006 * Math.sin(a * 5) : 0),
            bend: (p, k) => {
                // a ponta dobra para trás, com rugas
                const b = ss(0.5, 1, k);
                p.z -= 0.075 * b * b;
                p.y -= 0.03 * b * b;
                p.x += 0.006 * Math.sin(k * 30) * ss(0.4, 0.6, k);
            },
            col: (V, a, j) => {
                V.c.copy(j === 5 ? trimC : hatC);
                V.r = 0.95;
                if (j === 5) {
                    V.c.copy(gold);
                    V.r = 0.4;
                    V.m = 1;
                }
            },
            w: (V, j) => (j < 7 ? w1(V, B.head) : w2(V, B.head, B.hat, ss(6, 11, j)))
        });
    } else if (hat === 'kettle') {
        lathe([[0.085, 0.0], [0.15, -0.03], [0.156, -0.026], [0.15, -0.021], [0.096, 0.008], [0.094, 0.03], [0.086, 0.062], [0.06, 0.082], [0.03, 0.09], [0, 0.092]], {
            c: [0, 0.166, -0.006], rz: 1.2, tilt: -0.05, slot: 'hard', nu: hi ? 26 : 12,
            col: (V, a, j) => {
                V.c.copy(steel).multiplyScalar(j === 4 ? 0.7 : 0.95);
                V.r = 0.4;
                V.m = 1;
            }
        });
    } else if (hat === 'crown' || hat === 'tiara') {
        const tiara = hat === 'tiara';
        const nu = hi ? 28 : 14;
        bd.grid(nu, 3, (V, s, t, i, j) => {
            const a = tiara ? (s * 2 - 1) * 1.15 : s * TAU;
            const spike = i % 2 === 0 ? 1 : 0.35;
            const hgt = tiara ? 0.03 * Math.cos(a * 0.9) ** 2 : 0.05;
            const y = [0, 0.012, 0.02, 0.02 + hgt * spike][j];
            const r = 0.086 + (j === 1 ? 0.004 : 0) - (j === 3 ? 0.004 : 0);
            V.p.set(Math.sin(a) * r, (tiara ? 0.172 : 0.186) + y - 0.03 * (tiara ? 1 - Math.cos(a) : 0) * 0.5, -0.008 + Math.cos(a) * r * 1.18);
            HT(V.p);
            V.c.copy(gold).multiplyScalar(0.9 + 0.1 * spike);
            if (j === 1 && i % 4 === 1) V.c.setRGB(0.6, 0.05, 0.08);
            V.r = 0.28;
            V.m = j === 1 && i % 4 === 1 ? 0.2 : 1;
            V.u = s * 0.5;
            V.v = y;
            w1(V, B.head);
        }, { slot: 'hard', wrap: !tiara, inside: HT(V3(0, 0.19, 0)) });
    } else if (hat === 'beret' || hat === 'cap') {
        lathe([[0.084, -0.004], [0.09, 0.002], [0.118, 0.014], [0.126, 0.03], [0.11, 0.046], [0.06, 0.054], [0, 0.056]], {
            c: [0.008, 0.172, -0.012], rz: 1.12, tilt: hat === 'beret' ? 0.0 : -0.12, slot: 'fabric', nu: hi ? 22 : 12,
            bend: (p) => {
                if (hat === 'beret') p.y -= 0.22 * Math.max(0, p.x - 0.02) + 0.05 * Math.max(0, -p.x - 0.05);
            },
            col: (V, a, j) => {
                V.c.copy(hatC).multiplyScalar(j < 2 ? 0.7 : 1);
                V.r = 0.95;
            }
        });
    } else if (hat === 'helm' || hat === 'greathelm' || hat === 'scarf' || hat === 'bandana') {
        const a_ = Math.abs;
        const metal = hat === 'helm' || hat === 'greathelm';
        const off = hat === 'greathelm' ? 0.022 : hat === 'helm' ? 0.012 : hat === 'scarf' ? 0.021 : 0.012;
        let edge;
        if (hat === 'helm') edge = (th) => lerp(0.142, 0.03, ss(0.62, 0.95, a_(th))) - 0.03 * ss(1.6, 2.4, a_(th));
        else if (hat === 'greathelm') edge = () => -0.02;
        else if (hat === 'scarf') edge = (th) => lerp(0.168, 0.1, ss(0.5, 1.1, a_(th))) - 0.115 * ss(1.2, 2.0, a_(th));
        else edge = (th) => lerp(0.158, 0.146, ss(0.4, 1.2, a_(th))) - 0.06 * ss(1.7, 2.5, a_(th));
        capShell({
            slot: metal ? 'hard' : 'fabric', edge, nu: hi ? 36 : 16,
            thick: (th, tt, y) => off + (hat === 'greathelm' ? 0.012 * ss(0.16, 0.1, y) + 0.01 * ss(0.5, 1.0, Math.cos(th)) * ss(0.2, 0.1, y) : 0)
                + (hat === 'helm' ? 0.005 * gs(th, 0.12) + 0.005 * gs(a_(th) - PI, 0.12) : 0)
                + (hat === 'scarf' ? 0.006 * ss(0.5, 1, tt) * (0.5 + 0.5 * Math.sin(th * 9)) : 0),
            col: (V, th, tt, y, tuckRow) => {
                if (metal) {
                    V.c.copy(steel).multiplyScalar(tuckRow ? 0.5 : 0.95);
                    V.r = 0.38;
                    V.m = 1;
                    if (hat === 'greathelm') {
                        const c = Math.cos(th);
                        if (c > 0.35 && a_(y - 0.117) < 0.006 && a_(th) > 0.05) V.c.setRGB(0.01, 0.01, 0.01), (V.m = 0), (V.r = 1);
                        else if (c > 0.2 && (a_(th) < 0.06 || a_(y - 0.117) < 0.014)) V.c.copy(gold), (V.r = 0.3);
                    } else if (tt > 0.94) V.c.multiplyScalar(0.75);
                } else {
                    V.c.copy(hatC).multiplyScalar(tuckRow ? 0.6 : 0.9 + 0.15 * Math.sin(th * 9 + tt * 4));
                    V.r = 0.95;
                }
            },
            rows: hat === 'greathelm' && hi ? [0, 0.04, 0.1, 0.18, 0.3, 0.38, 0.425, 0.447, 0.47, 0.5, 0.56, 0.7, 0.85, 1] : null
        });
        if (hat === 'helm' && plate && !lo) {
            // viseira erguida sobre a testa, com fendas, presa por pivôs nas têmporas
            bd.grid(hi ? 16 : 8, 3, (V, s, t, i, j) => {
                const th = (s * 2 - 1) * 1.02;
                const y = 0.146 + 0.021 * j;
                shellPos(th, y, 0.017 + 0.014 * (3 - j) / 3 + 0.005 * gs(th, 0.22), V.p);
                HT(V.p);
                V.c.copy(steel).multiplyScalar(j === 0 ? 0.7 : 0.97);
                if (j === 1 && Math.abs(th) > 0.14 && Math.abs(th) < 0.72 && i % 2 === 0) V.c.setRGB(0.02, 0.02, 0.02);
                V.r = 0.28;
                V.m = 1;
                V.u = s * 0.2;
                V.v = j * 0.02;
                w1(V, B.head);
            }, { slot: 'hard', wrap: false, inside: HT(V3(0, 0.15, 0)) });
            const _pv = V3();
            for (const sd of [1, -1]) {
                shellPos(sd * 1.02, 0.166, 0.018, _pv);
                HT(_pv);
                blob(_pv.x, _pv.y, _pv.z, 0.009 * kH, 0.009 * kH, 0.009 * kH, { slot: 'hard', nu: 6, nv: 3, col: mat(gold, 0.3, 1), w: (V) => w1(V, B.head) });
            }
        }
        if (hat === 'scarf' || hat === 'bandana') {
            // nó e pontas atrás
            blob(0, chinY + (hat === 'scarf' ? 0.06 : 0.1) * kH, zH - 0.118 * kH, 0.022 * kH, 0.018 * kH, 0.018 * kH, { slot: 'fabric', col: mat(hatC, 0.95), w: (V) => w1(V, B.head), nu: 8, nv: 4 });
            for (const side of [1, -1]) {
                tubeHC((t, out) => out.set(side * (0.01 + 0.03 * t), (hat === 'scarf' ? 0.055 : 0.095) - 0.1 * t, -0.12 - 0.02 * Math.sin(PI * t)), {
                    slot: 'fabric', r: (t) => 0.014 * (1 - 0.5 * t) * (t > 0.97 ? 0.1 : 1), squash: 0.3, n: hi ? 6 : 3, nu: 6,
                    col: (V) => {
                        V.c.copy(hatC).multiplyScalar(0.9);
                        V.r = 0.95;
                    },
                    w: (V, t) => w2(V, B.head, B.hair1, t * 0.8)
                });
            }
        }
    }
    if (o.eyepatch) {
        const c = HT(V3(-ex, ey, ez + Re * 0.95));
        blob(c.x, c.y, c.z, 0.021 * kH, 0.018 * kH, 0.006 * kH, { slot: 'hard', col: mat(C(0x14110f), 0.7), w: (V) => w1(V, B.head), nu: 10, nv: 4 });
        lathe([[0.08, -0.003], [0.0815, 0], [0.08, 0.003]], { c: [0, 0.125, -0.004], rz: 1.24, tilt: 0.22, slot: 'hard', nu: hi ? 28 : 14, col: mat(C(0x14110f), 0.7), insideY: 0 });
    }

    // =====================================================================
    // CAPA, CAPELETE, CAPUZ
    // =====================================================================
    const capeC = C(o.capeColor);
    const capeLin = capeC.clone().multiplyScalar(0.6);
    if (o.cape !== 'none') {
        const yEnd = o.cape === 'short' ? 0.92 : 0.26;
        const nv = hi ? 14 : lo ? 4 : 8;
        const nu = hi ? 16 : lo ? 6 : 10;
        const CY = [1.435, 1.16, 0.88, 0.6];
        const baseZ = 0.108 * dK + 0.03 + (o.armor !== 'none' ? 0.02 : 0);
        bd.grid(nu, nv, (V, s, t, i, j) => {
            const a = (s * 2 - 1) * lerp(1.22, 1.0, t);
            const tt = Math.pow(t, 0.9);
            const yTop = 1.47 - 0.024 * (a / 1.22) ** 2;
            const yc = lerp(yTop, yEnd, tt);
            const rx = lerp(shX + 0.012, shX + 0.14, tt);
            const rz = lerp(baseZ, baseZ + 0.05 + 0.02 * dK, Math.pow(tt, 0.7)) + 0.025 * dK * gs(yc - 0.93, 0.12);
            const fold = Math.cos(a * 7.5 + 0.6) * tt;
            V.p.set(Math.sin(a) * rx, Y(yc), -Math.cos(a) * rz * (1 + 0.14 * fold) - 0.004);
            V.c.copy(capeC).multiplyScalar(0.68 + 0.36 * (fold * 0.5 + 0.5));
            if (t > 0.965) V.c.copy(trimC);
            V.r = 0.95;
            V.u = s * 0.9;
            V.v = V.p.y;
            if (yc > 1.38) w2(V, B.chest, B.cape1, ss(1.46, 1.38, yc));
            else {
                let k = 0;
                while (k < 2 && yc < CY[k + 1]) k++;
                w2(V, B.cape1 + k, B.cape1 + k + 1, ss(CY[k] - 0.04, CY[k + 1], yc));
            }
            if (yc > 1.3) wAdd(V, V.p.x > 0 ? B.clavL : B.clavR, 0.35 * ss(1.3, 1.44, yc) * ss(0.08, 0.16, Math.abs(V.p.x)));
        }, { slot: 'fabric', wrap: false, inside: V3(0, Y(1.0), 0) });
        void capeLin;
    }
    if (o.cape !== 'none' || o.mantle || o.hood !== 'none') {
        // cordão/gola e broche
        torsoShell(1.438, 1.482, { slot: 'fabric', col: mat(o.fur ? C(0xe9e4d8) : capeC, 0.95), infl: overInfl + 0.012 });
        const _b = V3();
        torsoPoint(0, 1.452, overInfl + 0.02, _b);
        if (!lo) blob(0, _b.y, _b.z, 0.014, 0.014, 0.006, { slot: 'hard', nu: 8, nv: 4, col: mat(gold, 0.3, 1), w: (V) => w1(V, B.chest) });
    }
    if (o.mantle) {
        const fur = o.fur;
        const mc = fur ? C(0xe9e4d8) : capeC;
        const rows = hi ? [0, 0.1, 0.22, 0.36, 0.5, 0.64, 0.78, 0.9, 1, 1.0001] : [0, 0.25, 0.5, 0.75, 1, 1.0001];
        const y1 = 1.475;
        const y0 = fur ? 1.3 : 1.2;
        bd.grid(hi ? 32 : lo ? 10 : 18, rows.length - 1, (V, s, t, i, j) => {
            const th = s * TAU - PI;
            const tt = Math.min(1, rows[j]);
            const isLip = rows[j] > 1;
            const yc = lerp(y1, y0, tt) + (isLip ? 0.012 : 0);
            const sn = Math.sin(th);
            const cs = Math.cos(th);
            const lump = fur ? 0.012 * (vnoise(th * 9 + 3) * vnoise(tt * 7 + th * 3 + 1) * 2 + 0.3) : 0.012 * tt * Math.sin(th * 11 + 1);
            const rx = lerp(0.075, shX + 0.078 * armK, Math.pow(tt, 0.55)) + lump - (isLip ? 0.012 : 0);
            const rz = lerp(0.068, 0.132 * dK + 0.045 + P.bust * 0.5, Math.pow(tt, 0.6)) + lump - (isLip ? 0.012 : 0);
            V.p.set(rx * spow(sn, 0.9), Y(yc), -0.006 + rz * spow(cs, 0.9) + (cs > 0 ? 0.01 * tt : 0));
            V.c.copy(mc).multiplyScalar(fur ? 0.8 + 0.3 * vnoise(th * 14 + tt * 20) : 0.85 + 0.15 * Math.sin(th * 11 + 1));
            if (fur && hash(i * 7.3 + j * 3.1) > 0.86 && tt > 0.2) V.c.setRGB(0.05, 0.04, 0.04);
            if (!fur && tt > 0.93) V.c.copy(trimC);
            V.r = fur ? 0.7 : 0.95;
            V.u = s * 1.2;
            V.v = tt * 0.3;
            w1(V, B.chest);
            const ax = Math.abs(V.p.x);
            wAdd(V, V.p.x > 0 ? B.clavL : B.clavR, 0.5 * ss(0.08, 0.17, ax / shK));
            wAdd(V, (V.p.x > 0 ? B.clavL : B.clavR) + 1, 0.42 * tt * ss(0.13, 0.2, ax / shK));
        }, { slot: fur && hi ? 'hair' : 'fabric', inside: V3(0, Y(1.3), 0) });
    }
    if (o.hood === 'down') {
        blob(0, Y(1.462), -(0.075 * dK + 0.045), 0.115, 0.05, 0.065, {
            slot: 'fabric', nu: hi ? 14 : 8, nv: hi ? 6 : 4,
            shape: (p, a, b) => {
                p.y += 0.02 * Math.cos(a) * Math.sin(b) - 0.015 * Math.abs(Math.sin(a)) * Math.sin(b);
                p.multiplyScalar(1 + 0.08 * Math.sin(a * 3 + b * 4));
            },
            col: (V, a, b) => {
                V.c.copy(capeC).multiplyScalar(0.75 + 0.25 * Math.sin(b));
                V.r = 0.95;
            },
            w: (V) => w2(V, B.chest, B.neck, 0.3)
        });
    } else if (o.hood === 'up') {
        const a_ = Math.abs;
        capShell({
            slot: 'fabric', nu: hi ? 36 : 16, tuck: true,
            rows: hi ? [0, 0.08, 0.17, 0.27, 0.38, 0.5, 0.62, 0.74, 0.86, 0.95, 1] : null,
            edge: (th) => lerp(0.19, -0.02, ss(0.45, 0.98, a_(th))) - 0.085 * ss(0.95, 1.5, a_(th)),
            thick: (th, tt, y) => 0.026 + 0.012 * ss(0.6, 0.2, a_(th)) * ss(0.12, 0.2, y) + 0.01 * tt * (0.5 + 0.5 * Math.sin(th * 7)) + 0.012 * gs(a_(th) - PI, 0.5) * ss(0.1, 0.2, y),
            flare: 1.6, backK: 0.15,
            shape: (p, th, tt, y) => {
                if (y < 0.0) p.z += 0.02 * ss(0, -0.08, y) * Math.cos(th);
            },
            col: (V, th, tt, y, tuckRow) => {
                V.c.copy(capeC).multiplyScalar(tuckRow ? 0.5 : 0.85 + 0.15 * Math.sin(th * 7 + tt * 3));
                V.r = 0.95;
            },
            w: (V, th, tt, y) => {
                if (y > 0.02) w1(V, B.head);
                else w2(V, B.head, B.chest, ss(0.02, -0.09, y));
            }
        });
    }

    const built = bd.build();
    const hk = P.hands;
    return {
        geometry: built.geometry,
        slots: built.slots,
        tris: built.tris,
        J,
        M: {
            top: topY, hipsY: Y(0.96), hipJ: Y(0.915), thigh: Y(0.915) - Y(0.5), shin: Y(0.5) - Y(0.085), ankle: Y(0.085),
            toe: 0.115 * P.feet, heel: 0.06 * P.feet, armOut: 0.07 + P.armOut + (o.sex === 'f' ? 0.03 : 0) + (longSkirt ? 0.06 : 0),
            hunch: P.hunch, depth: 0.11 * dK, scale: o.height / topY, stride: longSkirt ? 0.62 : 1,
            grip: [shX + 0.017 - 0.027 * hk, Ya(0.885) - 0.076 * hk, 0.004 * hk],
            back: [0, Y(1.3), -(0.125 * dK + 0.035)], hip: [0.168 * P.hips * bulkT + 0.03, Y(1.0), 0.02], headTop: [0, topY, zH - 0.005]
        }
    };
}

// ---------------------------------------------------------------------------
// Materiais (compartilhados entre heróis). Todos leem `aPbr` por vértice:
//   x multiplica a rugosidade · y é o metal · z liga o verniz (olhos, lábios)
// Nos materiais texturizados o albedo da textura é quase dessaturado e
// normalizado, para a cor de vértice mandar no matiz ("tinta" sobre a trama).
// ---------------------------------------------------------------------------
const TEX_GAIN = { fabric_pattern_07: 1.7, denim_fabric: 2.2, brown_leather: 2.3, rusty_metal_02: 2.4 };
const matCache = new Map();

function patch(material, tex, gain = 1.8, sat = 0.3, con = 0.6) {
    material.onBeforeCompile = (sh) => {
        sh.uniforms.uTexGain = { value: gain };
        sh.uniforms.uTexSat = { value: sat };
        sh.uniforms.uTexCon = { value: con };
        sh.vertexShader = 'attribute vec3 aPbr;\nvarying vec3 vPbr;\n'
            + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvPbr = aPbr;');
        let f = 'varying vec3 vPbr;\nuniform float uTexGain;\nuniform float uTexSat;\nuniform float uTexCon;\n' + sh.fragmentShader;
        f = f.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor * vPbr.x, 0.04, 1.0);');
        f = f.replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor *= vPbr.y;');
        f = f.replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n#ifdef USE_CLEARCOAT\nmaterial.clearcoat *= vPbr.z;\n#endif\n#ifdef USE_SHEEN\nmaterial.sheenColor *= clamp( diffuseColor.rgb * 2.4, 0.0, 1.0 );\n#endif');
        if (tex) {
            f = f.replace('#include <map_fragment>', `#ifdef USE_MAP
    vec4 sampledDiffuseColor = texture2D( map, vMapUv );
    float texLuma = dot( sampledDiffuseColor.rgb, vec3( 0.299, 0.587, 0.114 ) );
    sampledDiffuseColor.rgb = mix( vec3( 1.0 ), mix( vec3( texLuma ), sampledDiffuseColor.rgb, uTexSat ) * uTexGain, uTexCon );
    diffuseColor *= sampledDiffuseColor;
#endif`);
        }
        sh.fragmentShader = f;
    };
    material.customProgramCacheKey = () => `gfxHero${tex ? 'T' : ''}`;
    return material;
}

/** Textura de fios (normal + albedo cinza) gerada uma vez: riscas verticais com ruído 1D. */
let strandTex = null;
function strandTextures() {
    if (strandTex) return strandTex;
    const S = 256;
    const hgt = new Float32Array(S * S);
    for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
            const u = x + 5 * Math.sin((y / S) * TAU) + 2.5 * Math.sin((y / S) * TAU * 3 + x * 0.05);
            const per = (f) => {
                const a = (u / S) * f;
                const i = Math.floor(a);
                const t = a - i;
                return lerp(hash((((i % f) + f) % f) + f * 7.1), hash(((((i + 1) % f) + f) % f) + f * 7.1), t * t * (3 - 2 * t));
            };
            hgt[y * S + x] = 0.5 * per(24) + 0.3 * per(64) + 0.2 * per(128);
        }
    }
    const mk = (fill) => {
        const cv = document.createElement('canvas');
        cv.width = cv.height = S;
        const ctx = cv.getContext('2d');
        const img = ctx.createImageData(S, S);
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) fill(img.data, (y * S + x) * 4, x, y);
        ctx.putImageData(img, 0, 0);
        const t = new THREE.CanvasTexture(cv);
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(14, 2.5);
        t.anisotropy = 4;
        return t;
    };
    const H = (x, y) => hgt[((y + S) % S) * S + ((x + S) % S)];
    const normal = mk((d, i, x, y) => {
        const dx = (H(x + 1, y) - H(x - 1, y)) * 3.2;
        const dy = (H(x, y + 1) - H(x, y - 1)) * 3.2;
        const l = Math.hypot(dx, dy, 1);
        d[i] = (-dx / l * 0.5 + 0.5) * 255;
        d[i + 1] = (-dy / l * 0.5 + 0.5) * 255;
        d[i + 2] = (1 / l * 0.5 + 0.5) * 255;
        d[i + 3] = 255;
    });
    const albedo = mk((d, i, x, y) => {
        const v = (0.62 + 0.38 * H(x, y)) * 255;
        d[i] = d[i + 1] = d[i + 2] = v;
        d[i + 3] = 255;
    });
    albedo.colorSpace = THREE.SRGBColorSpace;
    strandTex = { normal, albedo };
    return strandTex;
}

/** Ruído de valor periódico (fx × fy células) para texturas ladrilháveis. */
function pnoise(x, y, fx, fy, seed) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const tx = x - ix;
    const ty = y - iy;
    const h = (a, b) => hash((((a % fx) + fx) % fx) + 57.3 * (((b % fy) + fy) % fy) + seed);
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    return lerp(lerp(h(ix, iy), h(ix + 1, iy), sx), lerp(h(ix, iy + 1), h(ix + 1, iy + 1), sx), sy);
}
/** Par { albedo, normal } de canvas a partir de um campo de altura e de uma cor por pixel. */
function canvasPair(S, height, color, strength, repeat) {
    const hgt = new Float32Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) hgt[y * S + x] = height(x, y);
    const H = (x, y) => hgt[((y + S) % S) * S + ((x + S) % S)];
    const mk = (fill, srgb) => {
        const cv = document.createElement('canvas');
        cv.width = cv.height = S;
        const ctx = cv.getContext('2d');
        const img = ctx.createImageData(S, S);
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) fill(img.data, (y * S + x) * 4, x, y);
        ctx.putImageData(img, 0, 0);
        const t = new THREE.CanvasTexture(cv);
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(repeat, repeat);
        t.anisotropy = 4;
        if (srgb) t.colorSpace = THREE.SRGBColorSpace;
        return t;
    };
    const normal = mk((d, i, x, y) => {
        const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
        const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
        const l = Math.hypot(dx, dy, 1);
        d[i] = (-dx / l * 0.5 + 0.5) * 255;
        d[i + 1] = (-dy / l * 0.5 + 0.5) * 255;
        d[i + 2] = (1 / l * 0.5 + 0.5) * 255;
        d[i + 3] = 255;
    }, false);
    const rgb = [0, 0, 0];
    const albedo = mk((d, i, x, y) => {
        color(x, y, H(x, y), rgb);
        d[i] = clamp(rgb[0]) * 255;
        d[i + 1] = clamp(rgb[1]) * 255;
        d[i + 2] = clamp(rgb[2]) * 255;
        d[i + 3] = 255;
    }, true);
    return { albedo, normal };
}

/**
 * Pele: albedo com manchas sutis (e sardas opcionais) + normal de poros; `old` soma rugas finas.
 * A borda do ladrilho é lisa e branca: olhos e dentes usam UV ≈ 0 e ficam sem poros.
 */
const skinTexCache = {};
function skinTextures(old, freckles) {
    const key = (old ? 'o' : '') + (freckles ? 'f' : '');
    if (skinTexCache[key]) return skinTexCache[key];
    const S = 256;
    const edge = (x, y) => clamp(Math.hypot(Math.min(x, S - x), Math.min(y, S - y)) / 6 - 0.3);   // só o canto é liso
    const dots = [];
    if (freckles) for (let k = 0; k < 420; k++) dots.push([hash(k * 3.1) * S, hash(k * 7.7 + 1) * S, 0.8 + 1.6 * hash(k * 1.3 + 2)]);
    const fr = new Float32Array(S * S);
    for (const [fx, fy, r] of dots) {
        for (let y = Math.floor(fy - r - 1); y <= fy + r + 1; y++) for (let x = Math.floor(fx - r - 1); x <= fx + r + 1; x++) {
            if (x < 0 || y < 0 || x >= S || y >= S) continue;
            fr[y * S + x] = Math.max(fr[y * S + x], clamp(1.2 - Math.hypot(x - fx, y - fy) / r));
        }
    }
    skinTexCache[key] = canvasPair(S, (x, y) => {
        const u = x / S;
        const v = y / S;
        let h = 0.55 * pnoise(u * 72, v * 72, 72, 72, 3) + 0.45 * pnoise(u * 128, v * 128, 128, 128, 9);
        // rugas: riscos alongados na horizontal (testa, canto do olho, pescoço)
        if (old) h = 0.6 * h + 0.4 * Math.pow(Math.abs(pnoise(u * 4, v * 26, 4, 26, 21) * 2 - 1), 0.7);
        return lerp(0.5, h, edge(x, y));
    }, (x, y, h, out) => {
        const u = x / S;
        const v = y / S;
        const m = pnoise(u * 7, v * 7, 7, 7, 31) - 0.5;      // manchas largas (mais rosado / mais amarelado)
        const g = pnoise(u * 40, v * 40, 40, 40, 41) - 0.5;  // grão
        const e = edge(x, y);
        const f = fr[y * S + x] * 0.55 * e;
        out[0] = lerp(1, 0.96 + 0.06 * m + 0.05 * g, e) * (1 - 0.3 * f);
        out[1] = lerp(1, 0.95 - 0.05 * m + 0.05 * g, e) * (1 - 0.5 * f);
        out[2] = lerp(1, 0.94 - 0.07 * m + 0.05 * g, e) * (1 - 0.62 * f);
    }, old ? 1.8 : 1.3, 16);
    return skinTexCache[key];
}

/** Trama neutra (tela de linho/lã): urdidura e trama alternando por cima e por baixo. */
let weaveTex = null;
function weaveTextures() {
    if (weaveTex) return weaveTex;
    const S = 128;
    const N = 32;
    weaveTex = canvasPair(S, (x, y) => {
        const u = (x / S) * N;
        const v = (y / S) * N;
        const iu = Math.floor(u);
        const iv = Math.floor(v);
        const over = (iu + iv) & 1;
        const warp = Math.sin(PI * (u - iu)) * (0.55 + 0.45 * (over ? 1 : Math.abs(Math.cos(PI * (v - iv))))) * (0.85 + 0.3 * hash(iu * 1.7));
        const weft = Math.sin(PI * (v - iv)) * (0.55 + 0.45 * (over ? Math.abs(Math.cos(PI * (u - iu))) : 1)) * (0.85 + 0.3 * hash(iv * 2.3 + 5));
        return over ? Math.max(warp, weft * 0.7) : Math.max(weft, warp * 0.7);
    }, (x, y, h, out) => {
        const t = 0.74 + 0.26 * h + 0.06 * (hash(Math.floor((x / S) * N) * 3.3) - 0.5) + 0.06 * (hash(Math.floor((y / S) * N) * 5.1 + 9) - 0.5);
        out[0] = out[1] = out[2] = t;
    }, 2.4, 22);
    return weaveTex;
}

function heroMaterial(slot, o) {
    const armored = o.detail === 1 && (o.armor === 'plate' || o.armor === 'half');
    const old = o.age === 'elder';
    const fr = o.F.freckles > 0;
    const key = slot === 'fabric' ? `fabric:${armored ? o.hardTex : o.fabricTex}` : slot === 'hard' ? `hard:${o.hardTex}`
        : slot === 'skin' ? `skin:${old ? 'o' : ''}${fr ? 'f' : ''}` : slot;
    if (matCache.has(key)) return matCache.get(key);
    let m;
    if (slot === 'skin') {
        const st = skinTextures(old, fr);
        m = patch(new THREE.MeshPhysicalMaterial({
            vertexColors: true, roughness: 1, metalness: 1, clearcoat: 1, clearcoatRoughness: 0.06,
            map: st.albedo, normalMap: st.normal, normalScale: new THREE.Vector2(old ? 0.5 : 0.42, old ? 0.5 : 0.42),
            sheen: 0.22, sheenRoughness: 0.5, sheenColor: new THREE.Color(1.0, 0.5, 0.38), envMapIntensity: 0.9
        }), false);
    } else if (slot === 'hair') {
        const st = strandTextures();
        m = patch(new THREE.MeshPhysicalMaterial({
            vertexColors: true, roughness: 1, metalness: 1, map: st.albedo, normalMap: st.normal,
            normalScale: new THREE.Vector2(0.75, 0.75), anisotropy: 0.25, anisotropyRotation: PI / 2, side: THREE.DoubleSide,
            envMapIntensity: 0.3, specularIntensity: 0.3
        }), false);
    } else if (slot === 'fabric' && !armored && o.fabricTex === 'weave') {
        const st = weaveTextures();
        m = patch(new THREE.MeshStandardMaterial({
            vertexColors: true, roughness: 1, metalness: 1, map: st.albedo, normalMap: st.normal,
            normalScale: new THREE.Vector2(0.9, 0.9), side: THREE.DoubleSide, envMapIntensity: 0.8
        }), false);
    } else if (slot === 'fabric' || slot === 'hard') {
        const name = slot === 'fabric' && !armored ? o.fabricTex : o.hardTex;
        const steelTex = name === 'rusty_metal_02';
        m = pbrMaterial(name, { repeat: slot === 'fabric' ? 3.2 : 3.5, vertexColors: true, side: THREE.DoubleSide, normalScale: slot === 'fabric' ? 1.1 : steelTex ? 0.55 : 0.9, envMapIntensity: steelTex ? 1.5 : 1 });
        m.metalness = 1;
        // aço: a textura entra quase só como valor (riscos, manchas) sobre a cor de aço polido do vértice
        patch(m, true, TEX_GAIN[name] || 1.8, steelTex ? 0.06 : 0.3, name === 'fabric_pattern_07' ? 0.42 : steelTex ? 0.5 : 0.6);
    } else {
        m = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 1, side: THREE.DoubleSide }), false);
    }
    m.name = `gfxHero:${key}`;
    matCache.set(key, m);
    return m;
}

// ---------------------------------------------------------------------------
// Poses procedurais. Um buffer de pose tem 3 ângulos de Euler (XYZ) por osso e
// 10 canais: deslocamento da pelve (HX, HY, HZ), mandíbula, sorriso, sobrancelha,
// piscar, mão esq./dir. fechada e peso do olhar/postura.
//
// Convenções (repouso = braços caídos, palmas para a coxa):
//   coxa.x < 0 leva a perna à frente · canela.x > 0 dobra o joelho · pé.x > 0 baixa a ponta
//   braço.x < 0 leva o braço à frente · braço.z abre para fora · antebraço.x < 0 dobra o cotovelo
//   coluna.x > 0 inclina para a frente · y > 0 gira para a esquerda (+X)
// A altura da pelve é resolvida por `ground()`: cinemática direta das duas pernas
// e o pé mais baixo encosta no chão (sem pé flutuando em nenhuma proporção):
//   alcance = (coxa·cos a1 + canela·cos a2)·cos az + tornozelo·cos a3 + max(ponta·sen a3, −calcanhar·sen a3, 0)
// ---------------------------------------------------------------------------
const CH = NB * 3;
const HX = CH, HY = CH + 1, HZ = CH + 2, JAW = CH + 3, SMILE = CH + 4, BROW = CH + 5, BLINK = CH + 6, GRIPL = CH + 7, GRIPR = CH + 8, LOOK = CH + 9;
const PSIZE = CH + 10;
let _P = null;
let _M = null;
const R = (b, x, y, z) => {
    const i = b * 3;
    _P[i] = x;
    _P[i + 1] = y;
    _P[i + 2] = z;
};
const RA = (b, x, y, z) => {
    const i = b * 3;
    _P[i] += x;
    _P[i + 1] += y;
    _P[i + 2] += z;
};
/** Braço do lado s (+1 esq., −1 dir.): sx frente(−)/trás(+), sz abertura, el flexão do cotovelo, tw torção, sy giro do úmero, ez desvio do antebraço. */
function arm(s, sx, sz, el, tw = 0, sy = 0, ez = 0) {
    const a = s > 0 ? B.armL : B.armR;
    R(a, sx, sy * s, (sz + _M.armOut) * s);
    R(a + 1, -el, tw * s, ez * s);
}
function leg(s, tx, kx, fx = 0, tz = 0, ty = 0) {
    const t = s > 0 ? B.thighL : B.thighR;
    R(t, tx, ty * s, tz * s);
    R(t + 1, kx, 0, 0);
    R(t + 2, fx, 0, 0);
}
/** Deixa as solas paralelas ao chão (mais `roll` opcional por pé). */
function flatFeet(rollL = 0, rollR = 0) {
    const hp = _P[0];
    _P[B.footL * 3] = -(hp + _P[B.thighL * 3] + _P[B.shinL * 3]) + rollL;
    _P[B.footR * 3] = -(hp + _P[B.thighR * 3] + _P[B.shinR * 3]) + rollR;
    _P[B.toeL * 3] = -Math.max(0, rollL) * 0.9;
    _P[B.toeR * 3] = -Math.max(0, rollR) * 0.9;
}
function reach(t) {
    const hp = _P[0];
    const a1 = _P[t * 3] + hp;
    const a2 = a1 + _P[(t + 1) * 3];
    const a3 = a2 + _P[(t + 2) * 3];
    const s3 = Math.sin(a3);
    return (_M.thigh * Math.cos(a1) + _M.shin * Math.cos(a2)) * Math.cos(_P[t * 3 + 2])
        + _M.ankle * Math.cos(a3) + Math.max(_M.toe * s3, -_M.heel * s3, 0);
}
function ground(extra = 0, k = 1) {
    _P[HY] = (Math.max(reach(B.thighL), reach(B.thighR)) - _M.hipJ) * k + extra;
}
function torso(hx, sx, cx, nx, hdx) {
    _P[0] = hx;
    _P[B.spine * 3] = sx;
    _P[B.chest * 3] = cx;
    _P[B.neck * 3] = nx;
    _P[B.head * 3] = hdx;
}
function twist(hy, sy, cy, ny) {
    _P[1] = hy;
    _P[B.spine * 3 + 1] = sy;
    _P[B.chest * 3 + 1] = cy;
    _P[B.neck * 3 + 1] = ny * 0.5;
    _P[B.head * 3 + 1] = ny * 0.5;
}

/** Em pé, respirando e trocando o peso de perna. */
function stand(t, k = 1) {
    const br = Math.sin(t * 1.5);
    const sw = Math.sin(t * 0.41) * k;
    leg(1, -0.035, 0.07 + 0.09 * Math.max(0, -sw), 0, 0.045 + 0.012 * sw);
    leg(-1, 0.025, 0.06 + 0.09 * Math.max(0, sw), 0, 0.045 - 0.012 * sw);
    torso(0, 0.02 - 0.006 * br, 0.015 - 0.012 * br, -0.02, -0.015 + 0.006 * br);
    _P[2] = -0.028 * sw;
    _P[B.spine * 3 + 2] = 0.02 * sw;
    _P[B.chest * 3 + 2] = 0.012 * sw;
    _P[B.head * 3 + 1] = 0.1 * Math.sin(t * 0.23) * k;
    arm(1, 0.03 + 0.012 * br, 0.03, 0.2 + 0.02 * br, 0.1);
    arm(-1, 0.03 + 0.012 * br, 0.03, 0.22 + 0.02 * br, 0.1);
    _P[HX] = 0.02 * sw;
    flatFeet();
    ground();
}

/**
 * Marcha (2 passos = 2π). Perna esquerda balança em torno de φ=0:
 *   coxa = −A·sen φ − viés · joelho = base + K·max(0, cos φ)^1.4
 * `run` 0..1 mistura andar→correr (A 0,5→0,85 rad; K 1,05→1,9; tronco inclina; fase de voo);
 * `crouch` 0..1 agacha (furtivo).
 */
function gait(ph, amt, run, crouch) {
    const s = Math.sin(ph);
    const c = Math.cos(ph);
    const A = lerp(0.5, 0.86, run) * amt;
    const K = lerp(1.05, 1.9, run) * amt;
    const kb = lerp(0.06, 0.28, run) * Math.min(1, amt * 3) + crouch * 0.75;
    const lean = lerp(0.045, 0.25, run) * amt + crouch * 0.42;
    const tb = -kb * 0.5 - crouch * 0.2 - run * 0.1 * amt;
    leg(1, -A * s + tb, kb + K * Math.pow(Math.max(0, c), 1.4), 0, 0.02);
    leg(-1, A * s + tb, kb + K * Math.pow(Math.max(0, -c), 1.4), 0, 0.02);
    torso(lean, 0.03 + crouch * 0.1, 0.02 + crouch * 0.1, -lean * 0.45 - crouch * 0.25, -lean * 0.4 - crouch * 0.2);
    const tw = lerp(0.07, 0.12, run) * amt;
    twist(-tw * s, tw * 0.9 * s, tw * 1.1 * s, -tw * 0.9 * s);
    _P[2] = 0.035 * c * amt;
    _P[B.spine * 3 + 2] = -0.03 * c * amt;
    // pés: ponta para baixo enquanto a perna está atrás, calcanhar primeiro quando chega à frente
    const roll = (sv, cv) => (0.5 + 0.25 * run) * Math.max(0, -sv) * amt - 0.3 * Math.max(0, sv) * ss(-0.6, 0.3, cv) * amt;
    flatFeet(roll(s, c), roll(-s, -c));
    const AA = lerp(0.55, 1.0, run) * amt;
    const el = lerp(0.3, 1.45, run) * Math.min(1, amt * 2 + 0.2) + crouch * 0.9;
    arm(1, AA * s - run * 0.1 - crouch * 0.4, 0.02 + crouch * 0.2, el + 0.3 * Math.max(0, -s) * amt, 0.15);
    arm(-1, -AA * s - run * 0.1 - crouch * 0.4, 0.02 + crouch * 0.2, el + 0.3 * Math.max(0, s) * amt, 0.15);
    _P[HX] = -0.018 * c * amt;
    ground(run * amt * 0.075 * _M.hipJ * Math.pow(Math.abs(s), 1.6));
}

const GUARD_MODES = { idle: 1, walk: 1, run: 1, sneak: 1, talk: 1, hit: 1, jump: 1, fall: 1, attack: 1, cheer: 0 };
const UPPER_FROM = B.spine;   // ossos [spine … thumbR] formam o "tronco para cima"
const UPPER_TO = B.thumbR;

function computePose(M, mode, ph, amt, P) {
    _P = P;
    _M = M;
    P.fill(0);
    P[LOOK] = 1;
    P[GRIPL] = P[GRIPR] = 0.22;
    const t = ph;
    const s = Math.sin(ph);
    const c = Math.cos(ph);
    switch (mode) {
        case 'walk':
            gait(ph, amt, 0, 0);
            break;
        case 'run':
            gait(ph, amt, 1, 0);
            P[GRIPL] = P[GRIPR] = 0.6;
            break;
        case 'sneak':
            gait(ph, amt, 0, 1);
            arm(1, -0.75 - 0.25 * s, 0.25, 1.5, 0.3);
            arm(-1, -0.75 + 0.25 * s, 0.25, 1.5, 0.3);
            break;
        case 'carry':
            // caixa/cesto à frente do corpo com as duas mãos; pernas andam conforme `amt`
            if (amt > 0.02) gait(ph, amt, 0, 0);
            else stand(t);
            arm(1, -0.5, -0.02, 1.3, 0.5, -0.25);
            arm(-1, -0.5, -0.02, 1.3, 0.5, -0.25);
            RA(B.spine, -0.08, 0, 0);
            P[GRIPL] = P[GRIPR] = 0.55;
            break;
        case 'hold':
            // lanterna/tocha erguida na mão direita
            if (amt > 0.02) gait(ph, amt, 0, 0);
            else stand(t);
            arm(-1, -1.3 + 0.03 * Math.sin(t * 2), 0.18, 0.5, 0.2);
            P[GRIPR] = 1;
            break;
        case 'jump': {
            // 0–0,3 agacha · 0,3–0,45 impulso · até 0,8 no ar · 0,8–1 aterrissa
            const wc = ss(0, 0.18, ph) * ss(0.4, 0.28, ph);
            const wa = ss(0.28, 0.42, ph) * ss(0.9, 0.78, ph);
            const wl = ss(0.76, 0.88, ph) * ss(1.0, 0.94, ph);
            const up = ss(0.28, 0.4, ph) * ss(0.7, 0.5, ph);
            const kn = 0.08 + 1.5 * wc + 0.75 * wa * ss(0.4, 0.6, ph) + 1.15 * wl;
            const th = -0.04 - 0.85 * wc - 0.5 * wa * ss(0.4, 0.6, ph) - 0.65 * wl;
            leg(1, th, kn, 0, 0.05);
            leg(-1, th + 0.12 * wa, kn - 0.2 * wa, 0, 0.05);
            torso(0.5 * wc + 0.38 * wl - 0.08 * up, 0.08 * wc, 0.05 * wc, -0.3 * wc - 0.2 * wl, -0.2 * wc - 0.15 * wl);
            const ax = 0.75 * wc - 2.5 * up - 0.7 * wa * (1 - up) - 0.5 * wl;
            arm(1, ax, 0.1 + 0.5 * wa * (1 - up) + 0.3 * wl, 0.3 + 0.5 * wc + 0.4 * wl);
            arm(-1, ax, 0.1 + 0.5 * wa * (1 - up) + 0.3 * wl, 0.3 + 0.5 * wc + 0.4 * wl);
            flatFeet(0.7 * wa, 0.7 * wa);
            ground(0, 1 - wa);
            P[JAW] = 0.25 * wa;
            break;
        }
        case 'fall': {
            leg(1, -0.45 + 0.2 * Math.sin(t * 7), 0.75 + 0.25 * Math.sin(t * 7 + 1), 0.5, 0.12);
            leg(-1, -0.1 + 0.2 * Math.sin(t * 7 + 2), 0.55 + 0.25 * Math.sin(t * 7 + 3), 0.5, 0.12);
            torso(-0.08, -0.06, -0.05, 0.1, 0.1);
            arm(1, -0.5 + 0.25 * Math.sin(t * 9), 1.75 + 0.2 * Math.sin(t * 8), 0.45, 0, 0, 0.3);
            arm(-1, -0.5 + 0.25 * Math.sin(t * 9 + 2), 1.75 + 0.2 * Math.sin(t * 8 + 1), 0.45, 0, 0, 0.3);
            P[JAW] = 0.5;
            P[BROW] = 0.8;
            P[GRIPL] = P[GRIPR] = 0;
            break;
        }
        case 'climb': {
            // escada/pé de feijão: braço e perna opostos sobem juntos
            const kL = 0.5 + 0.5 * s;
            const kR = 1 - kL;
            arm(1, lerp(-1.75, -2.75, kL), 0.08, lerp(1.5, 0.45, kL), 0.2);
            arm(-1, lerp(-1.75, -2.75, kR), 0.08, lerp(1.5, 0.45, kR), 0.2);
            leg(1, lerp(-0.2, -1.3, kR), lerp(0.3, 1.6, kR), lerp(0.1, -0.1, kR), 0.08);
            leg(-1, lerp(-0.2, -1.3, kL), lerp(0.3, 1.6, kL), lerp(0.1, -0.1, kL), 0.08);
            torso(0.1, 0.03, 0.02, -0.2, -0.22);
            twist(0.06 * s, 0, -0.08 * s, 0);
            P[HY] = 0.025 * Math.cos(ph * 2) * M.hipJ;
            P[GRIPL] = P[GRIPR] = 0.95;
            break;
        }
        case 'attack': {
            // golpe de espada (mão direita): guarda → arma sobre o ombro → corte diagonal → guarda
            const win = ss(0, 0.24, ph);
            const u = ss(0.3, 0.5, ph);
            const out = ss(0.68, 1, ph);
            const wR = 1 - win + u * out;
            const wW = win * (1 - u);
            const wS = u * (1 - out);
            arm(-1, -0.45 * wR - 0.35 * wW - 1.0 * wS, 0.2 * wR + 1.6 * wW - 0.55 * wS, 1.3 * wR + 1.7 * wW + 0.3 * wS, 0, 0.2 * wR + 1.45 * wW + 0.5 * wS);
            arm(1, -0.3 * wR - 0.45 * wW + 0.3 * wS, 0.2 + 0.2 * wW + 0.3 * wS, 1.1 + 0.2 * wW - 0.3 * wS, 0.2, -0.3);
            leg(1, -0.3 + 0.05 * wS, 0.35 + 0.1 * wS, 0, 0.1, 0.1);
            leg(-1, 0.3 - 0.75 * wS, 0.3 + 0.35 * wS, 0, 0.1, -0.15);
            torso(0.08 + 0.3 * wS - 0.08 * wW, 0.04 + 0.1 * wS, 0.04, -0.05 - 0.15 * wS, -0.1 * wS);
            twist(0.25 * wR - 0.2 * wW + 0.2 * wS, -0.3 * wW + 0.25 * wS, -0.35 * wW + 0.35 * wS, -0.25 * wR + 0.5 * wW - 0.6 * wS);
            flatFeet(0.5 * (1 - wS), 0);
            ground();
            P[GRIPR] = 1;
            P[BROW] = -0.7;
            P[JAW] = 0.35 * wS;
            break;
        }
        case 'block': {
            const br = Math.sin(t * 2);
            arm(1, -1.05, -0.3, 1.55, 0.3, -0.5);
            arm(-1, 0.25, 0.3, 1.0, 0.2);
            leg(1, -0.42, 0.5, 0, 0.1, 0.1);
            leg(-1, 0.22, 0.45, 0, 0.12, -0.2);
            torso(0.14 + 0.01 * br, 0.05, 0.05, -0.1, -0.08);
            twist(-0.3, -0.05, -0.05, 0.35);
            flatFeet(0, 0.35);
            ground();
            P[GRIPL] = P[GRIPR] = 1;
            P[BROW] = -0.6;
            break;
        }
        case 'hit': {
            const w = ss(0, 0.14, ph) * (1 - ss(0.3, 1, ph));
            stand(0, 0);
            RA(B.thighL, 0.1 * w, 0, 0);
            RA(B.shinL, 0.3 * w, 0, 0);
            RA(B.thighR, -0.25 * w, 0, 0);
            RA(B.shinR, 0.35 * w, 0, 0);
            torso(-0.1 * w, -0.2 * w, -0.2 * w, -0.1 * w, -0.25 * w);
            twist(0, 0.15 * w, 0.2 * w, 0.2 * w);
            arm(1, -0.5 * w, 0.03 + 0.6 * w, 0.2 + 0.7 * w);
            arm(-1, -0.3 * w, 0.03 + 0.7 * w, 0.2 + 0.5 * w);
            flatFeet();
            ground();
            P[HZ] = -0.06 * w;
            P[JAW] = 0.5 * w;
            P[BROW] = 0.9 * w;
            P[BLINK] = w;
            break;
        }
        case 'die': {
            // joelhos cedem e o corpo cai de costas
            const k1 = ss(0, 0.4, ph) * (1 - ss(0.45, 0.9, ph));
            const k2 = ss(0.2, 0.95, ph);
            stand(0, 0);
            leg(1, -0.55 * k1 - 0.12 * k2, 1.25 * k1 + 0.15 * k2, 0.35 * k2, 0.05 + 0.12 * k2);
            leg(-1, -0.4 * k1 - 0.45 * k2, 1.1 * k1 + 0.75 * k2, 0.35 * k2, 0.05 + 0.18 * k2, -0.2 * k2);
            torso(-1.52 * k2 + 0.2 * k1, -0.15 * k1, -0.1 * k1 + 0.03 * k2, 0.05 * k2, 0.1 * k2);
            P[B.head * 3 + 1] = 0.45 * k2;
            arm(1, -0.2 * k1 + 0.12 * k2, 0.05 + 0.85 * k2, 0.3 + 0.2 * k2);
            arm(-1, -0.2 * k1 + 0.12 * k2, 0.05 + 0.55 * k2, 0.3 + 0.5 * k2);
            ground(0, 1 - k2);
            P[HY] += k2 * (M.depth * 1.05 - M.hipsY);
            P[HZ] = -0.1 * k2;
            P[BLINK] = ss(0.3, 0.7, ph);
            P[JAW] = 0.3 * ss(0.1, 0.5, ph);
            P[LOOK] = 1 - ss(0.1, 0.5, ph);
            P[GRIPL] = P[GRIPR] = 0.15;
            break;
        }
        case 'row': {
            // remo sentado: k=1 pegada (inclinado à frente, braços estendidos) → k=0 puxada
            const k = 0.5 + 0.5 * c;
            leg(1, lerp(-1.3, -1.62, k), lerp(0.75, 1.65, k), 0.1, 0.12);
            leg(-1, lerp(-1.3, -1.62, k), lerp(0.75, 1.65, k), 0.1, 0.12);
            torso(lerp(-0.28, 0.42, k), 0.08 * k, 0.06 * k, -0.15 * k, -0.2 * k + 0.1);
            arm(1, lerp(-0.55, -1.5, k), 0.12, lerp(1.75, 0.12, k), 0.4);
            arm(-1, lerp(-0.55, -1.5, k), 0.12, lerp(1.75, 0.12, k), 0.4);
            P[HY] = M.shin * 0.55 + M.ankle - M.hipJ;
            P[GRIPL] = P[GRIPR] = 1;
            break;
        }
        case 'sit': {
            const br = Math.sin(t * 1.5);
            leg(1, -1.5, 1.52, 0, 0.07);
            leg(-1, -1.5, 1.52, 0, 0.07);
            torso(-0.05, 0.06 - 0.006 * br, 0.04 - 0.012 * br, -0.03, -0.02);
            P[B.head * 3 + 1] = 0.15 * Math.sin(t * 0.23);
            arm(1, -0.28, 0.0, 1.02, 0.5, -0.12);
            arm(-1, -0.28, 0.0, 1.02, 0.5, -0.12);
            flatFeet();
            P[HY] = M.shin + M.ankle - M.hipJ;
            P[GRIPL] = P[GRIPR] = 0.1;
            break;
        }
        case 'ride': {
            // montado: coxas abertas sobre a sela, mãos nas rédeas, quique no trote
            const b = Math.sin(ph * 2);
            leg(1, -0.95, 1.0, 0.25, 0.5, 0.25);
            leg(-1, -0.95, 1.0, 0.25, 0.5, 0.25);
            torso(0.06 + 0.03 * b, 0.03 - 0.03 * b, 0.02, -0.03, -0.03 + 0.03 * b);
            arm(1, -0.55 + 0.04 * b, 0.02, 1.2, 0.5, -0.2);
            arm(-1, -0.55 + 0.04 * b, 0.02, 1.2, 0.5, -0.2);
            P[HY] = M.shin + M.ankle - M.hipJ + 0.03 * M.hipJ * Math.max(0, b) * amt;
            P[GRIPL] = P[GRIPR] = 0.9;
            break;
        }
        case 'swim': {
            // crawl: corpo deitado na altura da origem, braços alternados, pernada curta
            leg(1, -1.35 + 0.28 * Math.sin(ph * 3), 0.2 + 0.2 * Math.max(0, Math.sin(ph * 3 + 1)), 0.9, 0.04);
            leg(-1, -1.35 - 0.28 * Math.sin(ph * 3), 0.2 + 0.2 * Math.max(0, -Math.sin(ph * 3 + 1)), 0.9, 0.04);
            torso(1.42, -0.04, -0.06, -0.45, -0.5);
            twist(0, 0.12 * s, 0.2 * s, -0.3 * s);
            _P[B.chest * 3 + 2] = 0;
            arm(1, -1.7 - 1.35 * c, 0.15 + 0.25 * Math.max(0, s), 0.2 + 0.9 * Math.max(0, s), 0.2);
            arm(-1, -1.7 + 1.35 * c, 0.15 + 0.25 * Math.max(0, -s), 0.2 + 0.9 * Math.max(0, -s), 0.2);
            P[HY] = -M.hipsY;
            P[LOOK] = 0.3;
            P[GRIPL] = P[GRIPR] = 0.1;
            break;
        }
        case 'wave':
            stand(t);
            arm(-1, -0.25, 1.3, 1.35 + 0.4 * Math.sin(t * 8), 0, 1.5);
            P[GRIPR] = 0;
            P[SMILE] = 0.8;
            break;
        case 'talk':
            stand(t);
            arm(-1, -0.55 + 0.12 * Math.sin(t * 2.1), 0.12, 1.25 + 0.3 * Math.sin(t * 3.3), 0.5, -0.2);
            arm(1, -0.2 + 0.08 * Math.sin(t * 1.7 + 1), 0.08, 0.7 + 0.15 * Math.sin(t * 2.6), 0.4);
            P[JAW] = 0.3 * Math.max(0, Math.sin(t * 11) * Math.sin(t * 3.1) + 0.35 * Math.sin(t * 17));
            P[B.head * 3] += 0.04 * Math.sin(t * 2.7);
            P[GRIPR] = 0.1;
            break;
        case 'cheer': {
            const b = Math.sin(t * 7);
            stand(t, 0);
            RA(B.shinL, 0.25 * Math.max(0, -b), 0, 0);
            RA(B.shinR, 0.25 * Math.max(0, -b), 0, 0);
            RA(B.thighL, -0.12 * Math.max(0, -b), 0, 0);
            RA(B.thighR, -0.12 * Math.max(0, -b), 0, 0);
            arm(1, -0.2, 2.35 + 0.15 * b, 0.3, 0, 0, 0.35 - 0.2 * b);
            arm(-1, -0.2, 2.35 + 0.15 * b, 0.3, 0, 0, 0.35 - 0.2 * b);
            RA(B.spine, -0.08, 0, 0);
            RA(B.head, -0.15, 0, 0);
            flatFeet(0.4 * Math.max(0, b), 0.4 * Math.max(0, b));
            ground(0.05 * M.hipJ * Math.max(0, b));
            P[SMILE] = 1;
            P[JAW] = 0.45;
            P[BROW] = 0.6;
            P[GRIPL] = P[GRIPR] = 0.9;
            break;
        }
        default:
            stand(t);
    }
}

/** Modos: tipo de fase e parâmetros padrão. gait = fase pela velocidade; cycle = ciclos/s; time = segundos; once = 0..1. */
export const HERO_MODES = {
    idle: { type: 'time' },
    walk: { type: 'gait', speed: 1.4, run: 0 },
    run: { type: 'gait', speed: 4.6, run: 1 },
    sneak: { type: 'gait', speed: 0.8, run: 0 },
    carry: { type: 'gait', speed: 1.2, run: 0 },
    hold: { type: 'gait', speed: 1.2, run: 0 },
    jump: { type: 'once', dur: 0.9 },
    fall: { type: 'time' },
    climb: { type: 'cycle', rate: 0.9 },
    attack: { type: 'once', dur: 0.6 },
    block: { type: 'time' },
    hit: { type: 'once', dur: 0.5 },
    die: { type: 'once', dur: 1.3 },
    row: { type: 'cycle', rate: 0.55 },
    sit: { type: 'time' },
    ride: { type: 'cycle', rate: 1.5 },
    swim: { type: 'cycle', rate: 0.7 },
    wave: { type: 'time' },
    talk: { type: 'time' },
    cheer: { type: 'time' }
};

// ---------------------------------------------------------------------------
// Herói
// ---------------------------------------------------------------------------
const geoCache = new Map();
const _v = V3();
const _v2 = V3();
const _v3 = V3();
const _m4 = new THREE.Matrix4();
const EMPTY = {};
const CAPE_W = [0.45, 0.32, 0.26, 0.2];
const CAPE_K = [70, 46, 34, 26];
const CAPE_D = [9, 7, 6, 5];

/**
 * Cria um personagem. Ver o cabeçalho do arquivo para opções, modos e sockets.
 * @param {object} [options]  campos de DEFAULTS (ou `preset` de HERO_PRESETS + sobrescritas)
 */
export function createHero(options = {}) {
    const o = resolveOptions(options);
    const key = JSON.stringify(o);
    let g = geoCache.get(key);
    if (!g) {
        g = buildGeometry(o);
        geoCache.set(key, g);
    }
    const M = g.M;
    const J = g.J;
    const kH = o.P.head;

    const bones = BONES.map(([name]) => {
        const b = new THREE.Bone();
        b.name = name;
        return b;
    });
    BONES.forEach(([, p], i) => {
        if (p < 0) bones[i].position.set(J[0], J[1], J[2]);
        else {
            bones[i].position.set(J[i * 3] - J[p * 3], J[i * 3 + 1] - J[p * 3 + 1], J[i * 3 + 2] - J[p * 3 + 2]);
            bones[p].add(bones[i]);
        }
    });
    const rest = bones.map((b) => b.position.clone());
    // úmero: torção (y) aplicada antes da abertura (z) e do balanço (x)
    bones[B.armL].rotation.order = 'XZY';
    bones[B.armR].rotation.order = 'XZY';
    const mesh = new THREE.SkinnedMesh(g.geometry, g.slots.map((s) => heroMaterial(s, o)));
    mesh.name = 'gfxHeroMesh';
    mesh.add(bones[0]);
    mesh.bind(new THREE.Skeleton(bones));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    // limites folgados e fixos: a pose muda todo quadro e o culling não pode sumir com o personagem
    mesh.boundingSphere = new THREE.Sphere(V3(0, M.top * 0.5, 0), M.top * 1.35);
    mesh.boundingBox = new THREE.Box3(V3(-M.top, -M.top * 0.4, -M.top * 1.2), V3(M.top, M.top * 1.4, M.top * 1.2));
    const inner = new THREE.Group();
    inner.scale.setScalar(M.scale);
    inner.add(mesh);
    const root = new THREE.Group();
    root.name = `gfxHero:${o.preset || o.species}`;
    root.add(inner);

    // ---- sockets ----
    const named = Object.fromEntries(bones.map((b) => [b.name, b]));
    const sock = (name, bone, x, y, z) => {
        const s = new THREE.Object3D();
        s.name = `socket:${name}`;
        const i = B[bone] * 3;
        s.position.set(x - J[i], y - J[i + 1], z - J[i + 2]);
        named[bone].add(s);
        return s;
    };
    const sockets = {};
    for (const sd of [1, -1]) {
        // +Y sai pelo lado do polegar (direção da lâmina) · +Z = dorso da mão · X ao longo do antebraço
        const s = sock(sd > 0 ? 'handL' : 'handR', sd > 0 ? 'handL' : 'handR', sd * M.grip[0], M.grip[1], M.grip[2]);
        s.quaternion.setFromRotationMatrix(_m4.makeBasis(_v.set(0, sd, 0), _v2.set(0, 0, 1), _v3.set(sd, 0, 0)));
        sockets[sd > 0 ? 'handL' : 'handR'] = s;
        sockets[sd > 0 ? 'hipL' : 'hipR'] = sock(sd > 0 ? 'hipL' : 'hipR', 'hips', sd * M.hip[0], M.hip[1], M.hip[2]);
    }
    sockets.back = sock('back', 'chest', M.back[0], M.back[1], M.back[2]);
    sockets.back.rotation.y = PI;
    sockets.head = sock('head', 'head', M.headTop[0], M.headTop[1], M.headTop[2]);
    sockets.waist = sockets.hipL;

    // ---- estado de animação ----
    const cur = new Float32Array(PSIZE);
    const from = new Float32Array(PSIZE);
    const tgt = new Float32Array(PSIZE);
    const tmp = new Float32Array(PSIZE);
    let blend = 1;
    let blendDur = 0.22;
    let gaitPh = 0;
    let cycPh = 0;
    let once = 0;
    let lookYaw = 0;
    let lookPitch = 0;
    let lookKind = 0;       // 0 nada · 1 direção · 2 ponto
    const lookVec = V3();
    let blinkT = 1 + Math.random() * 3;
    let blinkA = 0;
    const capeA = [0, 0, 0, 0];
    const capeV = [0, 0, 0, 0];
    let swayA = 0;
    let swayV = 0;
    let hairA = 0;
    let hairV = 0;
    let hasPrev = false;
    const prev = V3();
    let relSpeed = 0;
    const upright = [];
    const bodyK = ((M.thigh + M.shin) * M.scale) / 0.83;
    const exprv = { smile: 0, jaw: 0, brow: 0, blink: 0 };

    function apply(P, dt, st) {
        for (let i = 0; i < NB; i++) bones[i].rotation.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
        bones[0].position.set(rest[0].x + P[HX], rest[0].y + P[HY], rest[0].z + P[HZ]);
        const live = P[LOOK];
        const sp = named.spine.rotation;
        const ch = named.chest.rotation;
        const nk = named.neck.rotation;
        const hd = named.head.rotation;
        // postura (idoso/orc/ogro): coluna curva, cabeça compensa
        const hu = M.hunch * live;
        sp.x += hu * 0.28;
        ch.x += hu * 0.3;
        nk.x -= hu * 0.3;
        hd.x -= hu * 0.2;

        // ---- olhar ----
        let ty = 0;
        let tp = 0;
        if (lookKind) {
            root.updateWorldMatrix(true, false);
            _m4.copy(root.matrixWorld).invert();
            if (lookKind === 2) _v.copy(lookVec).applyMatrix4(_m4).sub(_v2.set(0, M.top * 0.93 * M.scale, 0));
            else _v.copy(lookVec).transformDirection(_m4);
            const yaw = Math.atan2(_v.x, _v.z);
            if (Math.abs(yaw) < 2.1) {
                ty = clamp(yaw, -1.25, 1.25);
                tp = clamp(Math.atan2(_v.y, Math.hypot(_v.x, _v.z)), -0.6, 0.7);
            }
        }
        const lk = dt > 0 ? 1 - Math.exp(-9 * dt) : 1;
        lookYaw += (ty * live - lookYaw) * lk;
        lookPitch += (tp * live - lookPitch) * lk;
        const t = hero.time;
        const eyY = clamp(lookYaw * 0.4, -0.42, 0.42) + (vnoise(t * 0.9) - 0.5) * 0.07 * live;
        const eyP = clamp(lookPitch * 0.4, -0.3, 0.3) + (vnoise(t * 0.7 + 9) - 0.5) * 0.04 * live;
        const ry = lookYaw - clamp(lookYaw * 0.4, -0.42, 0.42);
        const rp = lookPitch - clamp(lookPitch * 0.4, -0.3, 0.3);
        nk.y += ry * 0.35;
        hd.y += ry * 0.65;
        nk.x -= rp * 0.35;
        hd.x -= rp * 0.65;
        named.eyeL.rotation.set(-eyP, eyY, 0);
        named.eyeR.rotation.set(-eyP, eyY, 0);

        // ---- piscar ----
        if (dt > 0) {
            blinkT -= dt;
            if (blinkT <= 0) blinkT = 2 + Math.random() * 4;
            blinkA = blinkT < 0.16 ? 1 - Math.abs(blinkT - 0.08) / 0.08 : 0;
        }
        const lid = Math.max(blinkA * live, P[BLINK], st.blink || 0, exprv.blink) * 0.66 - eyP * 0.45;
        named.lidL.rotation.set(lid, 0, 0);
        named.lidR.rotation.set(lid, 0, 0);

        // ---- expressão ----
        const jaw = clamp(P[JAW] + (st.jaw || 0) + exprv.jaw, 0, 1);
        const smile = clamp(P[SMILE] + (st.smile || 0) + exprv.smile, -1, 1);
        const brow = clamp(P[BROW] + (st.brow || 0) + exprv.brow, -1, 1);
        named.jaw.rotation.set(jaw * 0.38, 0, 0);
        for (let sd = 1; sd >= -1; sd -= 2) {
            const mb = sd > 0 ? named.mouthL : named.mouthR;
            const mr = rest[sd > 0 ? B.mouthL : B.mouthR];
            mb.position.set(mr.x + sd * 0.0045 * smile * kH, mr.y + 0.005 * smile * kH - jaw * 0.004 * kH, mr.z - 0.003 * Math.abs(smile) * kH);
            mb.rotation.set(0, 0, 0);
            const bb = sd > 0 ? named.browL : named.browR;
            const br = rest[sd > 0 ? B.browL : B.browR];
            bb.position.set(br.x, br.y + 0.0045 * brow * kH, br.z);
            bb.rotation.set(0, 0, sd * 0.32 * Math.max(0, -brow));
        }

        // ---- mãos: os 4 dedos dobram em dois ossos, o polegar cruza a palma ----
        for (let sd = 1; sd >= -1; sd -= 2) {
            const hb = sd > 0 ? B.handL : B.handR;
            const held = sockets[sd > 0 ? 'handL' : 'handR'].children.length > 0;
            const gp = held ? Math.max(0.92, P[sd > 0 ? GRIPL : GRIPR]) : clamp(st[sd > 0 ? 'gripL' : 'gripR'] ?? P[sd > 0 ? GRIPL : GRIPR]);
            bones[hb + 1].rotation.set(0, 0, -sd * (0.1 + 1.3 * gp));
            bones[hb + 2].rotation.set(0, 0, -sd * (0.12 + 1.5 * gp));
            bones[hb + 3].rotation.set(0.25 * gp, -sd * (0.05 + 0.7 * gp), -sd * 0.45 * gp);
        }

        // ---- secundários: capa, saia, cabelo, barba, chapéu ----
        if (dt > 0) {
            root.getWorldPosition(_v);
            let vf = 0;
            let vy = 0;
            let vl = 0;
            const e = root.matrixWorld.elements;
            const ws = Math.hypot(e[4], e[5], e[6]) * M.scale * (M.top / 1.75) || 1;
            if (hasPrev) {
                _v2.subVectors(_v, prev).divideScalar(dt * ws);
                if (_v2.lengthSq() < 900) {
                    _v3.set(e[8], e[9], e[10]).normalize();
                    vf = _v2.dot(_v3);
                    vy = _v2.y;
                    _v3.set(e[0], e[1], e[2]).normalize();
                    vl = _v2.dot(_v3);
                }
            }
            prev.copy(_v);
            hasPrev = true;
            if (Math.abs(vf) < 0.05) vf = relSpeed;
            const h = Math.min(dt, 0.033);
            const base = clamp(0.03 + 0.1 * vf - 0.14 * Math.min(0, vy), 0, 1.3);
            const fl = 0.012 + 0.03 * Math.min(1, Math.abs(vf) / 4);
            for (let i = 0; i < 4; i++) {
                const target = base * CAPE_W[i] + Math.sin(t * (3.6 + i * 1.3) - i * 0.9) * fl * (1 + i * 0.5);
                capeV[i] += (CAPE_K[i] * (target - capeA[i]) - CAPE_D[i] * capeV[i]) * h;
                capeA[i] += capeV[i] * h;
            }
            swayV += (40 * (clamp(-0.07 * vl, -0.3, 0.3) - swayA) - 6 * swayV) * h;
            swayA += swayV * h;
            hairV += (50 * (clamp(0.07 * vf - 0.1 * Math.min(0, vy), 0, 0.6) - hairA) - 7 * hairV) * h;
            hairA += hairV * h;
        }
        const back = Math.max(0, -(P[0] + sp.x + ch.x)) * live;
        named.cape1.rotation.set(back + Math.max(-0.02, capeA[0]), 0, swayA * 0.3);
        named.cape2.rotation.set(Math.max(-0.05, capeA[1]), 0, swayA * 0.3);
        named.cape3.rotation.set(Math.max(-0.08, capeA[2]), 0, swayA * 0.25);
        named.cape4.rotation.set(capeA[3], 0, swayA * 0.2);
        named.skirt.rotation.set(clamp(hairA * 0.25, 0, 0.15), 0, swayA * 0.35);
        const hp = (nk.x + hd.x) * live;
        named.hair1.rotation.set(-0.8 * hp + hairA, 0, swayA * 0.5 - hd.z * 0.5);
        named.hair2.rotation.set(hairA * 0.8 + capeA[1] * 0.3, 0, swayA * 0.4);
        named.beard.rotation.set(clamp(-0.7 * (hp + sp.x + ch.x) - 0.6 * jaw * 0.38, -0.9, 0.5) - hairA * 0.4, 0, swayA * 0.3);
        named.hat.rotation.set(-hairA * 0.5 - capeA[2] * 0.4, 0, swayA * 0.6);

        if (upright.length) {
            // objetos pendurados (lanterna): mantêm o prumo do mundo
            root.updateWorldMatrix(true, true);
            for (const ob of upright) {
                ob.parent.getWorldQuaternion(_q1).invert();
                root.getWorldQuaternion(_q2);
                ob.quaternion.copy(_q1).multiply(_q2);
            }
        }
    }

    function update(dt, st = EMPTY) {
        dt = clamp(dt || 0, 0, 0.1);
        const mode = HERO_MODES[st.mode] ? st.mode : 'idle';
        const def = HERO_MODES[mode];
        hero.time += dt;
        if (mode !== hero.mode) {
            from.set(cur);
            blend = 0;
            blendDur = st.blend ?? 0.22;
            hero.mode = mode;
            once = 0;
        }
        let ph;
        let amt = st.amount ?? 1;
        relSpeed = 0;
        if (def.type === 'gait') {
            const still = mode === 'carry' || mode === 'hold';
            const defSp = def.speed * bodyK;
            const sp = st.speed ?? (still ? 0 : defSp);
            if (st.amount === undefined) amt = clamp(Math.pow(Math.abs(sp) / defSp, 0.6), 0, 1.25);
            amt = Math.min(amt, M.stride * (1 + 0.3 * def.run));   // saia longa encurta o passo
            const A = lerp(0.5, 0.86, def.run) * amt;
            const stride = 4 * (M.thigh + M.shin) * M.scale * Math.sin(A) * (1 + 0.4 * def.run);
            if (amt > 0.02) gaitPh += (TAU * sp * dt) / Math.max(0.05, stride);
            ph = st.phase ?? gaitPh;
            relSpeed = (sp / bodyK) * (amt > 0.02 ? 1 : 0);
        } else if (def.type === 'cycle') {
            cycPh += TAU * def.rate * (st.speed ?? 1) * dt;
            ph = st.phase ?? cycPh;
        } else if (def.type === 'once') {
            once = Math.min(1, once + dt / (st.duration ?? def.dur));
            ph = st.phase ?? once;
        } else ph = st.phase ?? hero.time;
        hero.phase = ph;
        hero.done = def.type === 'once' && ph >= 1;
        computePose(M, mode, ph, amt, tgt);
        if (hero.guardL && GUARD_MODES[mode]) {
            _P = tgt;
            _M = M;
            arm(1, -0.08, 0.12, 1.3, 0.1, -0.75);
            tgt[GRIPL] = 1;
        }
        const up = st.upper;
        if (up && HERO_MODES[up] && up !== mode) {
            // camada de tronco para cima: braços/mãos do modo `upper` sobre a locomoção
            computePose(M, up, st.upperPhase ?? hero.time, st.upperAmount ?? 0, tmp);
            for (let i = B.clavL * 3; i < (B.thumbR + 1) * 3; i++) tgt[i] = tmp[i];
            for (let i = B.spine * 3; i < B.jaw * 3; i++) tgt[i] = lerp(tgt[i], tmp[i], 0.5);
            for (let i = JAW; i < LOOK; i++) tgt[i] = tmp[i];
        }
        if (blend < 1) {
            blend = Math.min(1, blend + dt / Math.max(0.001, blendDur));
            const k = blend * blend * (3 - 2 * blend);
            for (let i = 0; i < PSIZE; i++) cur[i] = from[i] + (tgt[i] - from[i]) * k;
        } else cur.set(tgt);
        apply(cur, dt, st);
    }

    const hero = {
        object: root,
        mesh,
        bones: named,
        sockets,
        height: o.height,
        scale: M.scale,
        /** altura do assento em `sit`/`ride` (m, mundo): onde fica a base da pelve. */
        seatHeight: (M.shin + M.ankle - 0.07) * M.scale,
        eyeHeight: M.top * 0.93 * M.scale,
        opts: o,
        triangles: g.tris,
        drawCalls: g.slots.length,
        /** true = braço esquerdo em guarda (escudo de pé) nos modos de locomoção/parado; `equip` liga ao pôr um escudo. */
        guardL: false,
        mode: 'idle',
        phase: 0,
        time: Math.random() * 10,
        done: false,
        update,
        /** Olhar numa direção do mundo (Vector3) — null solta. Olhos, cabeça e pescoço dividem o giro. */
        setLook(dir) {
            lookKind = dir ? 1 : 0;
            if (dir) lookVec.copy(dir);
        },
        /** Olhar para um ponto do mundo (Vector3) — null solta. */
        lookAt(point) {
            lookKind = point ? 2 : 0;
            if (point) lookVec.copy(point);
        },
        /** Expressão somada à do modo: { smile −1..1, jaw 0..1, brow −1 (bravo) … 1 (surpreso), blink 0..1 }. */
        setExpression(e = {}) {
            exprv.smile = e.smile || 0;
            exprv.jaw = e.jaw || 0;
            exprv.brow = e.brow || 0;
            exprv.blink = e.blink || 0;
        },
        /**
         * Prende um objeto a um socket. q: { position:[x,y,z], rotation:[x,y,z], scale, worldScale (true = desfaz a
         * escala do personagem, o objeto fica no tamanho real), upright (true = mantém o prumo: lanterna pendurada) }
         */
        attach(name, obj, q = {}) {
            const s = sockets[name];
            if (!s || !obj) return obj;
            let holder = obj;
            if (q.upright) {
                holder = new THREE.Group();
                holder.add(obj);
                upright.push(holder);
            }
            if (q.position) obj.position.fromArray(q.position);
            if (q.order) obj.rotation.order = q.order;
            if (q.rotation) obj.rotation.set(q.rotation[0], q.rotation[1], q.rotation[2]);
            if (q.scale) obj.scale.multiplyScalar(q.scale);
            if (q.worldScale !== false) holder.scale.multiplyScalar(1 / M.scale);
            s.add(holder);
            return obj;
        },
        detach(name) {
            const s = sockets[name];
            if (!s) return;
            if (name === 'handL') hero.guardL = false;
            for (const c of [...s.children]) {
                const i = upright.indexOf(c);
                if (i >= 0) upright.splice(i, 1);
                s.remove(c);
            }
        },
        equip: (items) => equipHero(hero, items),
        /** Libera o esqueleto (geometria e materiais são compartilhados/cacheados — não descartar). */
        dispose() {
            mesh.skeleton.dispose();
            root.removeFromParent();
        },
        _apply: apply,
        _cur: cur,
        _M: M
    };
    computePose(M, 'idle', hero.time, 1, cur);
    apply(cur, 0, EMPTY);
    return hero;
}
const _q1 = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();

/**
 * Baixo nível: posa imediatamente (sem mistura nem avanço de tempo), como o poseHuman.
 * @param {object} hero   retorno de createHero
 * @param {string} mode   chave de HERO_MODES
 * @param {number} phase  rad (ciclos), segundos (time) ou 0..1 (once)
 * @param {number} amount 0..1 — amplitude do passo em walk/run/sneak/carry/hold
 */
export function poseHero(hero, mode = 'idle', phase = 0, amount = 1) {
    computePose(hero._M, HERO_MODES[mode] ? mode : 'idle', phase, amount, hero._cur);
    hero.mode = mode;
    hero.phase = phase;
    hero._apply(hero._cur, 0, EMPTY);
}

/**
 * Itens conhecidos por `hero.equip` (modelos de assets.js já orientados para cada socket).
 * Cada entrada: { model, load (opções de loadModel), hand / back / hip: { position, rotation, upright } }.
 */
export const HERO_ITEMS = {
    sword: {
        model: 'antique_estoc', load: { scale: 0.7, ground: false },
        hand: { position: [0, 0.06, 0], rotation: [0, PI / 2, 0.42], order: 'ZYX' },
        back: { position: [0.06, 0.2, 0.03], rotation: [0, 0, 2.55] },
        hip: { position: [0.02, 0.02, -0.02], rotation: [PI + 0.4, 0, -0.12] }
    },
    shield: {
        model: 'kite_shield', load: { height: 0.92 },
        hand: { position: [0.11, -0.5, 0.05], rotation: [0, 0, 0] },
        back: { position: [0, -0.3, 0.04], rotation: [0, 0, 0] },
        hip: { position: [0.05, -0.5, 0], rotation: [0, PI / 2, 0] }
    },
    lantern: { model: 'wooden_lantern_01', load: { height: 0.34 }, hand: { position: [0, -0.35, 0], upright: true }, hip: { position: [0.06, -0.36, 0.05] } },
    basket: { model: 'wicker_basket_01', load: { width: 0.34 }, hand: { position: [0, -0.24, 0.02], upright: true } },
    axe: { model: 'wooden_axe', load: { height: 0.75, ground: false }, hand: { position: [0, 0.05, 0], rotation: [0, PI / 2, 0] }, back: { position: [0.05, 0.1, 0.03], rotation: [0, 0, 2.6] } },
    hammer: { model: 'ornate_war_hammer', load: { height: 0.8, ground: false }, hand: { position: [0, 0.08, 0], rotation: [0, PI / 2, 0] }, back: { position: [0.05, 0.1, 0.03], rotation: [0, 0, 2.6] } }
};

/**
 * Carrega e prende itens: `await hero.equip({ handR: 'sword', handL: 'shield', back: 'axe', hipL: 'lantern' })`.
 * Valor: chave de HERO_ITEMS, ou { item | model, load, position, rotation, scale, upright }, ou null para esvaziar o socket.
 * @returns {Promise<object>} mapa socket → Object3D carregado
 */
async function equipHero(hero, items = {}) {
    const out = {};
    await Promise.all(Object.keys(items).map(async (sk) => {
        if (!hero.sockets[sk]) return;
        hero.detach(sk);
        const v = items[sk];
        if (!v) return;
        const spec = typeof v === 'string' ? { item: v } : v;
        const def = HERO_ITEMS[spec.item] || {};
        const model = spec.model || def.model;
        if (!model) return;
        const obj = await loadModel(model, { ...(def.load || {}), ...(spec.load || {}) });
        if (!obj) return;
        const where = sk.startsWith('hand') ? def.hand : sk === 'back' ? def.back : sk === 'head' ? null : def.hip;
        const q = { ...(where || {}), ...spec };
        if (sk === 'handR') {
            // specs de mão estão no referencial da mão esquerda (x = rumo ao cotovelo): espelha para a direita
            if (q.position) q.position = [-q.position[0], q.position[1], q.position[2]];
            if (q.rotation) q.rotation = [q.rotation[0], q.rotation[1], -q.rotation[2]];
        }
        if (sk === 'handL') hero.guardL = spec.item === 'shield';
        hero.attach(sk, obj, q);
        out[sk] = obj;
    }));
    return out;
}

/**
 * Presets prontos: `createHero({ preset: 'knight' })`. Qualquer opção passada junto sobrescreve o preset.
 */
export const HERO_PRESETS = {
    knight: {
        build: 0.6, hair: 0x4a3220, hairStyle: 'short', beard: 'stubble', top: 'mail', bottom: 'pants', bottomColor: 0x2a2a30,
        armor: 'plate', armorColor: 0xc3c8d2, hat: 'helm', cape: 'long', capeColor: 0x8a1c1c, trimColor: 0xc9a23a, belt: 0x3a2618
    },
    princess: {
        sex: 'f', skin: 0xf0c4a8, hair: 0xd9b25f, hairStyle: 'long', eyeColor: 0x4f8f6a, top: 'dress', sleeves: 'puff',
        topColor: 0xd98aa8, trimColor: 0xf2dca0, bottom: 'none', shoes: 'shoes', shoeColor: 0xb89a6a, belt: 0xe0c070, hat: 'tiara'
    },
    peasant: {
        build: 0.2, hair: 0x4a3018, hairStyle: 'short', beard: 'stubble', top: 'tunic', topColor: 0x7a8450, bottom: 'pants',
        bottomColor: 0x5a4632, shoes: 'boots', hat: 'straw', hatColor: 0xcfae62, trimColor: 0x4a3a22
    },
    peasantWoman: {
        sex: 'f', skin: 0xe2b08c, hair: 0x6a3a1c, hairStyle: 'braids', top: 'dress', sleeves: 'long', topColor: 0x54688a,
        trimColor: 0x2e3a52, bottom: 'none', apron: 0xe6dcc4, hat: 'scarf', hatColor: 0xb8503a, shoes: 'shoes', belt: null
    },
    redHood: {
        sex: 'f', age: 'child', skin: 0xecbd9c, hair: 0x7a4a22, hairStyle: 'braids', eyeColor: 0x6a4a2a, top: 'dress', sleeves: 'short',
        topColor: 0xe8e2d2, trimColor: 0x8a2018, bottom: 'none', apron: 0xfaf6ea, shoes: 'shoes', shoeColor: 0x2a1c14, belt: null,
        cape: 'short', mantle: true, hood: 'up', capeColor: 0xb0181a
    },
    villageBoy: {
        age: 'child', hair: 0x8a5a2a, hairStyle: 'short', top: 'shirt', sleeves: 'short', topColor: 0xd8cfae, bottom: 'breeches',
        bottomColor: 0x4e5a3a, shoes: 'shoes', vest: 0x6a4a2a, hat: 'cap', hatColor: 0x5a4a3a, belt: null
    },
    wizard: {
        age: 'elder', skin: 0xdcae90, hair: 0xe4e2dc, hairStyle: 'long', beard: 'long', brows: 1.6, top: 'robe', sleeves: 'wide',
        topColor: 0x3a3f8a, trimColor: 0xc9a23a, bottom: 'none', shoes: 'shoes', belt: 0x6a4a2a, hat: 'wizard', hatColor: 0x34387c,
        proportions: { hunch: 0.35 }
    },
    king: {
        build: 0.3, fat: 0.45, hair: 0x6a5a4a, hairStyle: 'bob', beard: 'full', top: 'robe', sleeves: 'long', topColor: 0x6a1f5a,
        trimColor: 0xd9a93a, bottom: 'none', shoes: 'shoes', belt: 0xd9a93a, cape: 'long', capeColor: 0x9a1a22, mantle: true, fur: true,
        hat: 'crown'
    },
    guard: {
        build: 0.4, hair: 0x2a1c12, hairStyle: 'buzz', beard: 'mustache', top: 'mail', bottom: 'pants', bottomColor: 0x3a3228,
        tabard: 0x1f4a8a, trimColor: 0xd8c27a, hat: 'kettle', gloves: 'leather', shoes: 'boots', belt: 0x3a2618
    },
    pirate: {
        build: 0.3, skin: 0xc8946a, hair: 0x18120e, hairStyle: 'long', beard: 'full', top: 'shirt', sleeves: 'long', topColor: 0xe2dac4,
        vest: 0x5a2a22, bottom: 'breeches', bottomColor: 0x2c3448, shoes: 'tall', shoeColor: 0x221812, belt: 0x8a1c1c,
        hat: 'bandana', hatColor: 0x9a1c1c, eyepatch: true
    },
    giant: {
        species: 'ogre', skin: 0xb09468, hair: 0x2a2018, hairStyle: 'bald', beard: 'stubble', top: 'none', bottom: 'loincloth',
        bottomColor: 0x5a4028, shoes: 'barefoot', belt: 0x3a2a1a, eyeColor: 0x7a5a2a
    },
    orc: {
        species: 'orc', build: 0.5, skin: 0x6f8a58, hair: 0x14120f, hairStyle: 'mohawk', eyeColor: 0xc8a020, lipColor: 0x4a5a3a,
        top: 'shirt', sleeves: 'none', topColor: 0x4a3a2a, bottom: 'pants', bottomColor: 0x3a3026, armor: 'leather', shoes: 'boots',
        gloves: 'leather', belt: 0x2a1c12
    },
    goblin: {
        species: 'goblin', skin: 0x86a05a, hair: 0x14120f, hairStyle: 'bald', eyeColor: 0xd8b020, lipColor: 0x5a6a3a, top: 'shirt',
        sleeves: 'none', topColor: 0x5a4a32, bottom: 'breeches', bottomColor: 0x3a3026, shoes: 'barefoot', vest: 0x3a2a1c, belt: 0x2a1c12
    },
    elf: {
        species: 'elf', skin: 0xf0d2b8, hair: 0xe6d49a, hairStyle: 'long', eyeColor: 0x5aa0b0, top: 'tunic', topColor: 0x3f6a48,
        trimColor: 0xc9b26a, bottom: 'pants', bottomColor: 0x4a4436, shoes: 'tall', shoeColor: 0x4a3626, cape: 'long', capeColor: 0x2f4a3a,
        hood: 'down', belt: 0x5a3e24
    },
    hobbit: {
        species: 'hobbit', fat: 0.3, hair: 0x7a4a22, hairStyle: 'curly', top: 'shirt', sleeves: 'long', topColor: 0xe6dcc0,
        vest: 0x4a6a3a, bottom: 'breeches', bottomColor: 0x6a4a2c, shoes: 'barefoot', belt: null
    },
    dwarf: {
        species: 'dwarf', build: 0.6, skin: 0xd8a080, hair: 0xa8481c, hairStyle: 'wild', beard: 'braided', brows: 1.8, top: 'tunic',
        topColor: 0x5a3a2a, bottom: 'pants', bottomColor: 0x3a3028, armor: 'half', armorColor: 0xa8a49a, hat: 'helm', shoes: 'boots',
        gloves: 'leather', belt: 0x3a2618
    },
    elder: {
        age: 'elder', build: -0.3, hair: 0xd8d6d0, hairStyle: 'balding', beard: 'full', top: 'tunic', topColor: 0x7a6a56,
        bottom: 'pants', bottomColor: 0x4a4238, shoes: 'shoes', belt: 0x4a3222
    },
    witch: {
        sex: 'f', age: 'elder', skin: 0xcfc0a0, hair: 0x8a8a86, hairStyle: 'long', top: 'robe', sleeves: 'wide', topColor: 0x2a2630,
        trimColor: 0x5a2a6a, bottom: 'none', shoes: 'shoes', hat: 'wizard', hatColor: 0x1e1a24, belt: 0x4a2a5a, face: { nose: 1.5, chin: 1.4 }
    }
};
