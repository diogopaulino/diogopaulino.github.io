/**
 * Terreno da orla: pistas, calçadão de pedra portuguesa, ciclovia, gramado dos jardins
 * (com caminhos sinuosos), passeio da praia, mureta com acessos, areia inclinada com
 * faixa molhada e os canais 1–7 (calha de concreto, pontes, passarelas e comportas).
 *
 * Tudo é fundido por material (≈ 12 draw calls). UVs em metros: a textura mede o mundo.
 * Areia molhada: wet = smoothstep(linha d'água − 16 m, − 3 m, z + ruído(x)); escurece o
 * albedo (×0,55) e derruba a rugosidade (→ 0,16), então reflete o céu como areia de verdade.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { pbr, textureSet } from '../../shared/gfx/textures.js';
import { applyWorldUV, fbm2, seeded } from '../../shared/gfx/core.js';
import {
    ZONES, CANALS, LAND_Y, SAND_Y0, SAND_SLOPE, FOOTBRIDGE_Z, PLATFORMS, groundY
} from './config.js';

export const X_WEST = -440;
export const X_EAST = 352;
const ROAD_Y = LAND_Y - 0.14;

/** Retângulo horizontal com UV em metros. */
function rect(x0, x1, z0, z1, y, uvScale, segX = 1, segZ = 1) {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, segX, segZ);
    g.rotateX(-Math.PI / 2);
    g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
    const p = g.attributes.position;
    const uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / uvScale, p.getZ(i) / uvScale);
    return g;
}

function box(x0, x1, y0, y1, z0, z1, uvScale = 2) {
    const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    return applyWorldUV(g, uvScale);
}

/** Faixas de X livres de canal (para gramado e quadras do interior). */
function landSpans(margin = 0) {
    const spans = [];
    let x = X_WEST;
    for (const c of CANALS) {
        spans.push([x, c.x - c.width / 2 - margin]);
        x = c.x + c.width / 2 + margin;
    }
    spans.push([x, X_EAST]);
    return spans;
}

function dashTexture(dash = 0.55, color = '#f4f1e6') {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 8;
    const g = c.getContext('2d');
    g.clearRect(0, 0, 64, 8);
    g.fillStyle = color;
    g.fillRect(0, 0, 64 * dash, 8);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

function paintMat(map, color = 0xffffff) {
    return new THREE.MeshStandardMaterial({
        map, color, transparent: true, alphaTest: 0.5, roughness: 0.7,
        polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3
    });
}

/** Fita ao longo de X seguindo z = f(x). */
function ribbon(x0, x1, zFn, width, y, uvScale, step = 2.5) {
    const n = Math.max(2, Math.ceil((x1 - x0) / step));
    const pos = [];
    const uv = [];
    const idx = [];
    for (let i = 0; i <= n; i++) {
        const x = x0 + ((x1 - x0) * i) / n;
        const z = zFn(x);
        const dz = (zFn(x + 0.5) - zFn(x - 0.5));
        const il = 1 / Math.hypot(1, dz);
        const nx = -dz * il;
        const nz = il;
        for (const s of [-0.5, 0.5]) {
            const px = x + nx * width * s;
            const pz = z + nz * width * s;
            pos.push(px, y, pz);
            uv.push(px / uvScale, pz / uvScale);
        }
        if (i < n) {
            const a = i * 2;
            idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
}

export const gardenPathA = (x) => 17.5 + Math.sin(x / 23) * 5.2;
export const gardenPathB = (x) => 32 + Math.sin(x / 31 + 1.3) * 3.6;

function inCanal(x, margin = 0) {
    return CANALS.some((c) => Math.abs(x - c.x) < c.width / 2 + margin);
}

function sandMaterial() {
    const m = pbr('sand', { vertexColors: true, normalScale: 1.1 });
    m.onBeforeCompile = (sh) => {
        sh.uniforms.uWaterline = { value: ZONES.waterline };
        sh.vertexShader = sh.vertexShader
            .replace('#include <common>', '#include <common>\nvarying vec3 vOrlaWp;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvOrlaWp = (modelMatrix * vec4(position, 1.0)).xyz;');
        sh.fragmentShader = sh.fragmentShader
            .replace('#include <common>', '#include <common>\nvarying vec3 vOrlaWp;\nuniform float uWaterline;\nfloat orlaWet;')
            .replace('#include <color_fragment>', `#include <color_fragment>
                {
                    float n = sin(vOrlaWp.x * 0.071) * 1.6 + sin(vOrlaWp.x * 0.193 + 1.0) * 0.9 + sin(vOrlaWp.x * 0.53) * 0.35;
                    orlaWet = smoothstep(uWaterline - 15.0, uWaterline - 3.5, vOrlaWp.z + n * 1.6);
                    diffuseColor.rgb *= mix(1.0, 0.56, orlaWet);
                }`)
            .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
                roughnessFactor = mix(roughnessFactor, 0.14, orlaWet * orlaWet);`)
            .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
                normal = normalize(mix(normal, normalize(vNormal), orlaWet * 0.8));`);
    };
    m.customProgramCacheKey = () => 'orlaSand';
    return m;
}

export function createTerrain() {
    const root = new THREE.Group();
    root.name = 'terrain';
    const G = {
        asphalt: [], concrete: [], mosaic: [], bike: [], lawn: [], sand: [], curb: [],
        wall: [], path: [], dash: [], zebra: [], yellow: [], canal: [], inland: [], rail: []
    };

    // ---------- faixas contínuas ----------
    G.concrete.push(rect(X_WEST, X_EAST, ZONES.cityWalk[0], ZONES.cityWalk[1], LAND_Y, 3));
    G.asphalt.push(rect(X_WEST, X_EAST, ZONES.roadN[0], ZONES.roadN[1], ROAD_Y, 5));
    G.asphalt.push(rect(X_WEST, X_EAST, ZONES.roadS[0], ZONES.roadS[1], ROAD_Y, 5));
    G.mosaic.push(rect(X_WEST, X_EAST, ZONES.walk[0], ZONES.walk[1], LAND_Y, 3.6));
    G.concrete.push(rect(X_WEST, X_EAST, ZONES.walk[1], ZONES.bike[0], LAND_Y, 3));
    G.bike.push(rect(X_WEST, X_EAST, ZONES.bike[0], ZONES.bike[1], LAND_Y - 0.02, 3));
    G.concrete.push(rect(X_WEST, X_EAST, ZONES.bike[1], ZONES.garden[0], LAND_Y, 3));
    G.concrete.push(rect(X_WEST, X_EAST, ZONES.promenade[0], ZONES.wall, LAND_Y, 3));
    // canteiro central gramado
    G.lawn.push(rect(X_WEST, X_EAST, ZONES.median[0] + 0.25, ZONES.median[1] - 0.25, LAND_Y + 0.04, 4, 60, 1));

    // guias (meio-fio)
    for (const z of [ZONES.roadN[0], ZONES.roadN[1], ZONES.roadS[0], ZONES.roadS[1]]) {
        const inner = z === ZONES.roadN[1] || z === ZONES.roadS[0];
        const z0 = inner ? (z === ZONES.roadN[1] ? z : z - 0.25) : (z === ZONES.roadN[0] ? z - 0.25 : z);
        G.curb.push(box(X_WEST, X_EAST, ROAD_Y - 0.1, LAND_Y + (inner ? 0.05 : 0), z0, z0 + 0.25, 1.2));
    }

    // sinalização: faixas tracejadas, linha da ciclovia, faixas de pedestre
    const laneW = (ZONES.roadN[1] - ZONES.roadN[0]) / 3;
    for (const base of [ZONES.roadN[0], ZONES.roadS[0]]) {
        for (let l = 1; l < 3; l++) {
            const z = base + laneW * l;
            const g = rect(X_WEST, X_EAST, z - 0.07, z + 0.07, ROAD_Y + 0.012, 1);
            const uv = g.attributes.uv;
            const p = g.attributes.position;
            for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 7, 0.5);
            G.dash.push(g);
        }
    }
    {
        const z = (ZONES.bike[0] + ZONES.bike[1]) / 2;
        const g = rect(X_WEST, X_EAST, z - 0.05, z + 0.05, LAND_Y - 0.008, 1);
        const uv = g.attributes.uv;
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 4, 0.5);
        G.yellow.push(g);
    }
    const crossings = [];
    for (const c of CANALS) crossings.push(c.x - c.width / 2 - 9, c.x + c.width / 2 + 9);
    for (let x = -330; x < 340; x += 47) if (!inCanal(x, 24)) crossings.push(x);
    for (const x of crossings) {
        for (const [z0, z1] of [ZONES.roadN, ZONES.roadS]) {
            const g = rect(x - 2, x + 2, z0 + 0.3, z1 - 0.3, ROAD_Y + 0.014, 1);
            const uv = g.attributes.uv;
            const p = g.attributes.position;
            for (let i = 0; i < p.count; i++) uv.setXY(i, p.getZ(i) / 1.0, 0.5);
            G.zebra.push(g);
        }
    }

    // ---------- jardins ----------
    const spans = landSpans(0.55);
    const lawnSeg = [];
    for (const [x0, x1] of spans) {
        const g = rect(x0, x1, ZONES.garden[0], ZONES.garden[1], LAND_Y + 0.02, 4, Math.ceil((x1 - x0) / 6), 6);
        lawnSeg.push(g);
    }
    for (const g of lawnSeg) G.lawn.push(g);

    // caminhos sinuosos + travessas (calçadão → passeio da praia)
    for (const [x0, x1] of spans) {
        G.path.push(ribbon(x0 + 0.4, x1 - 0.4, gardenPathA, 2.4, LAND_Y + 0.045, 3));
        G.path.push(ribbon(x0 + 0.4, x1 - 0.4, gardenPathB, 2.0, LAND_Y + 0.045, 3));
    }
    const crossPaths = [];
    for (let x = -338; x < 345; x += 31) {
        if (inCanal(x, 9)) continue;
        crossPaths.push(x);
        G.path.push(rect(x - 1.3, x + 1.3, ZONES.garden[0], ZONES.garden[1], LAND_Y + 0.05, 3));
    }

    // ---------- mureta com acessos à areia ----------
    const openings = [];
    for (let x = -332; x < 345; x += 34) {
        if (inCanal(x, 8) || PLATFORMS.some((p) => x > p.x0 - 3 && x < p.x1 + 3)) continue;
        openings.push(x);
    }
    const wallTop = LAND_Y + 0.62;
    let wx = X_WEST;
    const wallCuts = [...openings.map((x) => [x - 1.8, x + 1.8]), ...CANALS.map((c) => [c.x - c.width / 2 - 0.4, c.x + c.width / 2 + 0.4]),
        ...PLATFORMS.map((p) => [p.x0, p.x1])]
        .sort((a, b) => a[0] - b[0]);
    for (const [a, b] of [...wallCuts, [X_EAST, X_EAST]]) {
        if (a - wx > 0.3) {
            G.wall.push(box(wx, a, SAND_Y0 - 0.9, wallTop, ZONES.wall - 0.22, ZONES.wall + 0.22, 1.6));
            G.curb.push(box(wx, a, wallTop, wallTop + 0.07, ZONES.wall - 0.3, ZONES.wall + 0.3, 1.2));
        }
        wx = b;
    }
    // rampas de acesso
    for (const x of openings) {
        const g = new THREE.PlaneGeometry(3.6, 2.0, 1, 1);
        g.rotateX(-Math.PI / 2);
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const z = p.getZ(i);
            p.setY(i, z < 0 ? LAND_Y : SAND_Y0 + 0.03);
        }
        g.translate(x, 0, ZONES.wall + 0.75);
        g.computeVertexNormals();
        G.concrete.push(applyWorldUV(g, 3));
    }

    // ---------- areia ----------
    {
        const z0 = ZONES.wall + 0.2;
        const z1 = 190;
        const segX = 150;
        const segZ = 40;
        const g = new THREE.PlaneGeometry(X_EAST - X_WEST, z1 - z0, segX, segZ);
        g.rotateX(-Math.PI / 2);
        g.translate((X_WEST + X_EAST) / 2, 0, (z0 + z1) / 2);
        const p = g.attributes.position;
        const uv = g.attributes.uv;
        const col = new Float32Array(p.count * 3);
        for (let i = 0; i < p.count; i++) {
            const x = p.getX(i);
            const z = p.getZ(i);
            const dune = (fbm2(x * 0.05, z * 0.05, 3, 0, 7) - 0.5) * 0.16 * Math.min(1, (z - z0) / 6) * Math.max(0, Math.min(1, (ZONES.waterline - 14 - z) / 12));
            p.setY(i, SAND_Y0 - (Math.max(z, ZONES.sandTop) - ZONES.sandTop) * SAND_SLOPE + dune);
            uv.setXY(i, x / 3.2, z / 3.2);
            const tone = 0.9 + fbm2(x * 0.03, z * 0.03, 3, 0, 21) * 0.2;
            const trampled = 1 - 0.08 * Math.max(0, 1 - Math.abs(z - 62) / 14);
            col[i * 3] = tone * trampled;
            col[i * 3 + 1] = tone * trampled * 0.985;
            col[i * 3 + 2] = tone * trampled * 0.95;
        }
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        g.computeVertexNormals();
        G.sand.push(g);
    }

    // ---------- canais ----------
    const canalWater = [];
    for (const c of CANALS) {
        const hw = c.width / 2;
        const t = 0.45; // espessura da parede
        const zN = ZONES.inland;
        const zS = 109;
        const floorY = 0.35;
        const topAt = (z) => (z <= ZONES.wall ? LAND_Y : groundY(c.x, z) + 0.5);
        // paredes em trechos (acompanham a areia na praia)
        const cuts = [zN, ZONES.wall, 60, 75, 90, zS];
        for (let i = 0; i < cuts.length - 1; i++) {
            const za = cuts[i];
            const zb = cuts[i + 1];
            const ya = topAt(za + 0.01);
            const yb = topAt(zb);
            for (const s of [-1, 1]) {
                const g = new THREE.BoxGeometry(t, 1, zb - za);
                const p = g.attributes.position;
                for (let k = 0; k < p.count; k++) {
                    const top = p.getY(k) > 0;
                    const zz = p.getZ(k) > 0 ? zb : za;
                    p.setY(k, top ? (zz === zb ? yb : ya) : floorY - 0.4);
                    p.setZ(k, zz);
                    p.setX(k, c.x + s * (hw + t / 2) + p.getX(k));
                }
                g.computeVertexNormals();
                G.canal.push(applyWorldUV(g, 2.4));
            }
        }
        G.canal.push(rect(c.x - hw, c.x + hw, zN, zS, floorY, 2.4));
        // lâmina d'água: plana até a mureta, depois desce acompanhando a areia até o mar
        canalWater.push(rect(c.x - hw, c.x + hw, zN, ZONES.wall, floorY + 0.55, 4));
        {
            const g = new THREE.PlaneGeometry(c.width, zS - ZONES.wall, 1, 12);
            g.rotateX(-Math.PI / 2);
            g.translate(c.x, 0, (zS + ZONES.wall) / 2);
            const p = g.attributes.position;
            const uv = g.attributes.uv;
            for (let k = 0; k < p.count; k++) {
                const z = p.getZ(k);
                p.setY(k, Math.min(floorY + 0.55, SAND_Y0 - (Math.max(z, ZONES.sandTop) - ZONES.sandTop) * SAND_SLOPE + 0.16));
                uv.setXY(k, p.getX(k) / 4, z / 4);
            }
            g.computeVertexNormals();
            canalWater.push(g);
        }

        // lajes das pontes (avenida+calçadão e passeio da praia) e passarela do jardim
        const slab = (z0, z1, thick = 0.55) => G.concrete.push(box(c.x - hw - 0.5, c.x + hw + 0.5, LAND_Y - thick, LAND_Y - 0.012, z0, z1, 3));
        slab(ZONES.cityWalk[0], ZONES.garden[0]);
        slab(ZONES.promenade[0], ZONES.wall + 0.25);
        // passarela em arco
        {
            const [b0, b1] = FOOTBRIDGE_Z;
            const g = new THREE.BoxGeometry(c.width + 2.4, 0.3, b1 - b0, 10, 1, 1);
            const p = g.attributes.position;
            for (let k = 0; k < p.count; k++) {
                const u = p.getX(k) / (c.width / 2 + 1.2);
                p.setY(k, p.getY(k) + (1 - u * u) * 0.42);
            }
            g.translate(c.x, LAND_Y - 0.12, (b0 + b1) / 2);
            g.computeVertexNormals();
            G.concrete.push(applyWorldUV(g, 3));
        }

        // guarda-corpos: mureta baixa + corrimão metálico ao longo do canal aberto
        const parapet = (z0, z1) => {
            for (const s of [-1, 1]) {
                const px = c.x + s * (hw + t / 2);
                G.wall.push(box(px - 0.2, px + 0.2, LAND_Y, LAND_Y + 0.5, z0, z1, 1.6));
                const rail = new THREE.CylinderGeometry(0.035, 0.035, z1 - z0, 6);
                rail.rotateX(Math.PI / 2);
                rail.translate(px, LAND_Y + 0.98, (z0 + z1) / 2);
                G.rail.push(rail);
                for (let z = z0 + 0.4; z < z1; z += 2.2) {
                    const post = new THREE.CylinderGeometry(0.03, 0.03, 0.5, 5);
                    post.translate(px, LAND_Y + 0.74, z);
                    G.rail.push(post);
                }
            }
        };
        parapet(ZONES.garden[0], FOOTBRIDGE_Z[0]);
        parapet(FOOTBRIDGE_Z[1], ZONES.promenade[0]);
        parapet(ZONES.inland, ZONES.cityWalk[0]);
        // guarda-corpo das pontes (transversal)
        for (const z of [ZONES.cityWalk[0] + 0.25, ZONES.garden[0] - 0.25, ZONES.promenade[0] + 0.25]) {
            G.wall.push(box(c.x - hw - 0.4, c.x + hw + 0.4, LAND_Y, LAND_Y + 0.5, z - 0.2, z + 0.2, 1.6));
            const rail = new THREE.CylinderGeometry(0.035, 0.035, c.width + 0.8, 6);
            rail.rotateZ(Math.PI / 2);
            rail.translate(c.x, LAND_Y + 0.98, z);
            G.rail.push(rail);
        }
        // comporta na saída para a praia: pórtico de concreto + duas folhas metálicas
        const gz = ZONES.wall + 0.6;
        G.concrete.push(box(c.x - hw - 0.7, c.x - hw, floorY, LAND_Y + 2.1, gz - 0.5, gz + 0.5, 3));
        G.concrete.push(box(c.x + hw, c.x + hw + 0.7, floorY, LAND_Y + 2.1, gz - 0.5, gz + 0.5, 3));
        G.concrete.push(box(c.x - hw - 0.7, c.x + hw + 0.7, LAND_Y + 2.1, LAND_Y + 2.6, gz - 0.6, gz + 0.6, 3));
        G.rail.push(box(c.x - hw, c.x - 0.1, floorY + 1.5, LAND_Y + 1.9, gz - 0.08, gz + 0.08, 1));
        G.rail.push(box(c.x + 0.1, c.x + hw, floorY + 1.5, LAND_Y + 1.9, gz - 0.08, gz + 0.08, 1));
    }

    // ---------- interior (quadras atrás da orla) ----------
    for (const [x0, x1] of landSpans(10)) {
        G.inland.push(rect(x0, x1, -620, ZONES.cityWalk[0], LAND_Y, 6));
    }
    // avenidas dos canais (pistas dos dois lados do canal, para o norte)
    for (const c of CANALS) {
        for (const s of [-1, 1]) {
            const xa = c.x + s * (c.width / 2 + 0.9);
            const xb = c.x + s * (c.width / 2 + 10);
            G.asphalt.push(rect(Math.min(xa, xb), Math.max(xa, xb), -620, ZONES.cityWalk[0], ROAD_Y, 5));
        }
    }

    // ---------- borda leste: muro de cais da Ponta da Praia + enrocamento ----------
    G.wall.push(box(X_EAST - 0.3, X_EAST + 0.5, -4, LAND_Y + 0.62, -620, ZONES.wall + 0.3, 1.6));
    G.wall.push(box(X_EAST - 0.3, X_EAST + 0.5, -4, 1.6, ZONES.wall + 0.3, 150, 1.6));

    // ---------- materiais e malhas ----------
    const add = (list, material, { receive = true, cast = false, order = 0 } = {}) => {
        if (!list.length) return null;
        const norm = list.map((g) => {
            const n = g.index ? g : g;
            for (const k of Object.keys(n.attributes)) {
                if (!['position', 'normal', 'uv', 'color'].includes(k)) n.deleteAttribute(k);
            }
            if (!n.attributes.normal) n.computeVertexNormals();
            return n.index ? n.toNonIndexed() : n;
        });
        const mesh = new THREE.Mesh(mergeGeometries(norm), material);
        mesh.receiveShadow = receive;
        mesh.castShadow = cast;
        mesh.renderOrder = order;
        root.add(mesh);
        list.forEach((g) => g.dispose());
        return mesh;
    };

    add(G.asphalt, pbr('asphalt', { color: 0xdedede, envMapIntensity: 0.7 }));
    add(G.concrete, pbr('concrete', { color: 0xd9d6cf }), { cast: true });
    add(G.mosaic, pbr('mosaic', { envMapIntensity: 0.8 }));
    add(G.bike, pbr('concrete', { color: 0xc04a3c, roughness: 0.9 }));
    {
        const lawnMat = pbr('grass', { color: 0xc8d8b8, envMapIntensity: 0.6 });
        add(G.lawn, lawnMat);
    }
    add(G.sand, sandMaterial());
    add(G.curb, pbr('concrete', { color: 0xf0eee8 }), { cast: true });
    add(G.wall, pbr('plaster', { color: 0xf3f0e8 }), { cast: true });
    add(G.path, (() => {
        const m = pbr('concrete', { color: 0xe6dfd0 });
        m.polygonOffset = true;
        m.polygonOffsetFactor = -2;
        m.polygonOffsetUnits = -2;
        return m;
    })());
    add(G.canal, pbr('concrete', { color: 0xa9aaa2 }), { cast: true });
    add(G.inland, pbr('concrete', { color: 0x8f8f8c, envMapIntensity: 0.5 }));
    add(G.rail, new THREE.MeshStandardMaterial({ color: 0x2f3338, roughness: 0.45, metalness: 0.8 }), { cast: true });
    add(G.dash, paintMat(dashTexture(0.5)));
    add(G.yellow, paintMat(dashTexture(0.55, '#f2d24a')));
    add(G.zebra, paintMat(dashTexture(0.5)));

    // água dos canais: verde-escura, lisa, com ondulação lenta
    const canalNormal = textureSet('waterNormal').normalMap.clone();
    canalNormal.needsUpdate = true;
    const canalMat = new THREE.MeshPhysicalMaterial({
        color: 0x2e4a3c, roughness: 0.08, metalness: 0, ior: 1.33,
        normalMap: canalNormal, envMapIntensity: 1.1
    });
    canalMat.normalScale.set(0.25, 0.25);
    add(canalWater, canalMat);

    return {
        root,
        openings,
        crossPaths,
        crossings,
        update(t) {
            canalNormal.offset.set(t * 0.012, t * 0.035);
        }
    };
}

/** Enrocamento: pedras irregulares instanciadas (borda da Ponta da Praia e base da ilha). */
export function createRocks(list) {
    const rnd = seeded(91);
    const g = new THREE.IcosahedronGeometry(1, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
        const k = 0.78 + rnd() * 0.44;
        p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.8, p.getZ(i) * k);
    }
    g.computeVertexNormals();
    applyWorldUV(g, 1.2);
    const mesh = new THREE.InstancedMesh(g, pbr('rock', { color: 0xcfcac2 }), list.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    list.forEach((r, i) => {
        e.set(rnd() * 3, rnd() * 6, rnd() * 3);
        q.setFromEuler(e);
        m.compose(new THREE.Vector3(r.x, r.y, r.z), q, new THREE.Vector3(r.s, r.s * (0.7 + rnd() * 0.5), r.s));
        mesh.setMatrixAt(i, m);
    });
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}
