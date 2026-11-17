/* Claude Bros — objetos da fase: faíscas douradas, cristais, caixas de faísca,
 * estacas de ferro e o estandarte final.
 *
 *   faísca   — estrela de quatro pontas com lados côncavos, extrudada com bisel;
 *              ouro (metalness 1) refletindo o céu. Uma InstancedMesh para todas.
 *              Flutua  y += sin(fase)·0,12  e gira em Y; ao ser coletada sobe
 *              0,7 m girando rápido e encolhe em 0,28 s.
 *   cristal  — bipirâmide lapidada (facetas de verdade) em MeshPhysicalMaterial
 *              com transmissão/atenuação âmbar (tiers médio/alto).
 *   caixa    — caixote de tábuas com cantoneiras de ferro e um emblema de faísca
 *              em âmbar incandescente; depois da cabeçada o emblema apaga.
 *   estacas  — cinco espigões torneados (perfil curvo, não cones) numa base de pedra.
 *   estandarte — mastro com anéis dourados e uma faísca no topo; o pano ondula
 *              no vertex shader  z = sin(5·u − 4·t)·0,09·u  e sobe na vitória.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { pbrMaterial } from '../../shared/gfx/assets.js';
import { applyWorldUV, damp, seeded } from '../../shared/gfx/core.js';
import { createSculpt, lumps } from './sculpt.js';
import { chamferBox } from './terrain.js';
import { toX, toY, GROUND_ROW } from './config.js';

/** Estrela de 4 pontas (✦) com lados côncavos. */
function sparkShape(outer, inner) {
    const shape = new THREE.Shape();
    for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 2;
        const b = a + Math.PI / 4;
        const tip = [Math.cos(a) * outer, Math.sin(a) * outer];
        const ctl = [Math.cos(b) * inner, Math.sin(b) * inner];
        const a2 = a + Math.PI / 2;
        if (i === 0) shape.moveTo(tip[0], tip[1]);
        shape.quadraticCurveTo(ctl[0], ctl[1], Math.cos(a2) * outer, Math.sin(a2) * outer);
    }
    return shape;
}

function sparkGeometry(outer, inner, depth, bevel) {
    const geo = new THREE.ExtrudeGeometry(sparkShape(outer, inner), {
        depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 3, curveSegments: 10
    });
    geo.translate(0, 0, -depth / 2);
    return geo;
}

function gemGeometry() {
    const pts = [[0, 0.3], [0.1, 0.2], [0.17, 0.06], [0.1, -0.17], [0, -0.3]].map(([x, y]) => new THREE.Vector2(x, y));
    const geo = new THREE.LatheGeometry(pts, 6).toNonIndexed();
    geo.computeVertexNormals(); // não indexada → facetas planas, como pedra lapidada
    return geo;
}

function stakesGeometry() {
    const rnd = seeded(31);
    const profile = [[0.001, 0.5], [0.022, 0.42], [0.048, 0.28], [0.07, 0.13], [0.082, 0.02], [0.09, -0.06]].map(([x, y]) => new THREE.Vector2(x, y));
    const parts = [];
    const spots = [[-0.3, 0.05], [-0.14, -0.12], [0.02, 0.08], [0.18, -0.08], [0.33, 0.06]];
    for (const [x, z] of spots) {
        const g = new THREE.LatheGeometry(profile, 10);
        const pos = g.attributes.position;
        const bend = (rnd() - 0.5) * 1.5; // espigão curvo como um chifre, não um cone
        for (let i = 0; i < pos.count; i++) {
            const y = pos.getY(i);
            pos.setX(i, pos.getX(i) + y * y * bend);
        }
        const s = 0.85 + rnd() * 0.3;
        g.scale(s * 0.95, s, s * 0.95);
        g.rotateZ((rnd() - 0.5) * 0.28);
        g.rotateX((rnd() - 0.5) * 0.3);
        g.translate(x, 0.04, z);
        g.computeVertexNormals();
        parts.push(g);
        // colar forjado na base de cada espigão
        const collar = new THREE.TorusGeometry(0.085 * s, 0.022, 8, 14).rotateX(Math.PI / 2);
        collar.translate(x, 0.07, z);
        parts.push(collar);
    }
    const geo = mergeGeometries(parts);
    applyWorldUV(geo, 0.35);
    return geo;
}

function stakeBaseGeometry() {
    const s = createSculpt();
    s.ellipsoid([0, 0.0, 0], [0.5, 0.1, 0.34], { color: 0xa9a297 });
    s.ellipsoid([-0.25, 0.02, 0.1], [0.2, 0.1, 0.18], { color: 0x8d867b, k: 0.05 });
    s.ellipsoid([0.27, 0.02, -0.08], [0.2, 0.09, 0.2], { color: 0x9a9388, k: 0.05 });
    s.displace((x, y, z) => lumps(x, y, z, 1.6) * 0.012);
    const geo = s.build({ cell: 0.03 });
    applyWorldUV(geo, 0.6);
    return geo;
}

function bannerTexture() {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 160;
    const g = c.getContext('2d');
    g.fillStyle = '#c9603f';
    g.fillRect(0, 0, 256, 160);
    g.fillStyle = '#e07a55';
    g.fillRect(0, 14, 256, 132);
    g.fillStyle = '#f6e2c6';
    g.fillRect(0, 14, 256, 5);
    g.fillRect(0, 141, 256, 5);
    // faísca de quatro pontas no centro
    g.translate(118, 80);
    g.beginPath();
    for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 - Math.PI / 2;
        const b = a + Math.PI / 4;
        if (i === 0) g.moveTo(Math.cos(a) * 46, Math.sin(a) * 46);
        g.quadraticCurveTo(Math.cos(b) * 11, Math.sin(b) * 11, Math.cos(a + Math.PI / 2) * 46, Math.sin(a + Math.PI / 2) * 46);
    }
    g.fill();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
}

export function createItems(scene, game, quality) {
    const group = new THREE.Group();
    group.name = 'items';
    scene.add(group);
    const time = { value: 0 };

    const gold = new THREE.MeshStandardMaterial({ color: 0xffc23d, metalness: 1, roughness: 0.14, envMapIntensity: 2.1, emissive: 0xa86200, emissiveIntensity: 0.45 });
    const iron = pbrMaterial('rusty_metal_02', { metal: true, color: 0x8f8a86, envMapIntensity: 1 });
    const steel = pbrMaterial('rusty_metal_02', { metal: true, color: 0xf2ece6, envMapIntensity: 1.6, roughness: 0.75 });
    const wood = pbrMaterial('weathered_brown_planks', { color: 0xe8c9a6, normalScale: 1.3, envMapIntensity: 0.6 });

    /* ---- faíscas ---- */
    const coinGeo = sparkGeometry(0.27, 0.07, 0.03, 0.055); // bisel largo: a face vira um cristal abaulado que pega o céu
    let coinMesh = null;
    let coinPop = new Float32Array(0);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();

    /* ---- cristais (um por caixa) ---- */
    const gemMat = quality.transmission
        ? new THREE.MeshPhysicalMaterial({ color: 0xffc98a, roughness: 0.04, transmission: 1, thickness: 0.35, ior: 1.6, attenuationColor: new THREE.Color(0xff8a1f), attenuationDistance: 0.25, envMapIntensity: 1.6, emissive: 0xff7a14, emissiveIntensity: 0.6, flatShading: true })
        : new THREE.MeshPhysicalMaterial({ color: 0xff9a2e, roughness: 0.06, metalness: 0.15, envMapIntensity: 1.8, emissive: 0xff6a00, emissiveIntensity: 0.55, clearcoat: 1, flatShading: true });
    const gemGeo = gemGeometry();
    const gems = [];

    /* ---- caixas de faísca ---- */
    const crateWood = chamferBox(0.9, 0.9, 0.9, 0.05);
    applyWorldUV(crateWood, 0.9);
    const bars = [];
    for (const sx of [-1, 1]) {
        for (const sy of [-1, 1]) {
            bars.push(chamferBox(0.12, 0.98, 0.12, 0.025).translate(sx * 0.43, 0, sy * 0.43));
            bars.push(chamferBox(0.98, 0.12, 0.12, 0.025).translate(0, sx * 0.43, sy * 0.43));
            bars.push(chamferBox(0.12, 0.12, 0.98, 0.025).translate(sx * 0.43, sy * 0.43, 0));
        }
    }
    const crateFrame = mergeGeometries(bars);
    applyWorldUV(crateFrame, 0.5);
    const emblemParts = [];
    for (let i = 0; i < 4; i++) {
        const g = sparkGeometry(0.24, 0.07, 0.04, 0.015);
        g.translate(0, 0, 0.46);
        g.rotateY(i * Math.PI / 2);
        emblemParts.push(g);
    }
    const emblemGeo = mergeGeometries(emblemParts);
    const emblemLit = new THREE.MeshStandardMaterial({ color: 0xffb347, emissive: 0xff8a1a, emissiveIntensity: 2.4, roughness: 0.3, metalness: 0.2 });
    const emblemOff = new THREE.MeshStandardMaterial({ color: 0x3a2f28, roughness: 0.7, metalness: 0.3 });
    const woodSpent = wood.clone();
    woodSpent.color.set(0x8f7d6c);
    const crates = [];

    /* ---- estacas ---- */
    const stakesGeo = stakesGeometry();
    const baseGeo = stakeBaseGeometry();
    const baseMat = pbrMaterial('mossy_cobblestone', { vertexColors: true, envMapIntensity: 0.6 });
    const stakeGroup = new THREE.Group();
    group.add(stakeGroup);

    /* ---- estandarte ---- */
    const goal = new THREE.Group();
    group.add(goal);
    const poleProfile = [[0.0, 0], [0.11, 0], [0.12, 0.05], [0.075, 0.1], [0.055, 0.16], [0.05, 1.0], [0.045, 3.1], [0.07, 3.14], [0.07, 3.2], [0.03, 3.26], [0.0, 3.28]]
        .map(([x, y]) => new THREE.Vector2(x, y));
    const pole = new THREE.Mesh(new THREE.LatheGeometry(poleProfile, 16), pbrMaterial('oak_wood_planks', { color: 0x9a6a48, repeat: [1, 3], envMapIntensity: 0.6 }));
    pole.castShadow = true;
    const ringProfile = [[0.052, -0.04], [0.068, -0.03], [0.072, 0], [0.068, 0.03], [0.052, 0.04]].map(([x, y]) => new THREE.Vector2(x, y));
    const ringGeo = new THREE.LatheGeometry(ringProfile, 16);
    for (const y of [0.45, 1.6, 2.75]) {
        const ring = new THREE.Mesh(ringGeo, gold);
        ring.position.y = y;
        goal.add(ring);
    }
    const finial = new THREE.Mesh(sparkGeometry(0.34, 0.1, 0.08, 0.035), gold);
    finial.position.y = 3.62;
    finial.castShadow = true;
    const clothGeo = new THREE.PlaneGeometry(1.5, 0.9, 24, 10);
    {
        // rabo de andorinha: a borda livre entra em V
        const pos = clothGeo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const u = pos.getX(i) / 1.5 + 0.5;
            const v = Math.abs(pos.getY(i) / 0.45);
            const k = Math.min(1, Math.max(0, (u - 0.7) / 0.3));
            pos.setX(i, pos.getX(i) - (1 - v) * 0.36 * k * k);
        }
        clothGeo.translate(0.75, 0, 0);
    }
    const clothMat = new THREE.MeshStandardMaterial({ map: bannerTexture(), roughness: 0.85, side: THREE.DoubleSide, envMapIntensity: 0.5 });
    clothMat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = time;
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nuniform float uTime;')
            .replace('#include <begin_vertex>', `#include <begin_vertex>
                float gfxU = position.x / 1.5;
                transformed.z += sin(position.x * 5.0 - uTime * 4.0 + position.y * 1.5) * 0.09 * gfxU;
                transformed.y += sin(position.x * 3.0 - uTime * 3.1) * 0.035 * gfxU - gfxU * gfxU * 0.08;`)
            .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
                objectNormal = normalize(vec3(-cos(position.x * 5.0 - uTime * 4.0 + position.y * 1.5) * 0.45 * position.x / 1.5, 0.0, 1.0));`);
    };
    const cloth = new THREE.Mesh(clothGeo, clothMat);
    cloth.rotation.y = Math.PI; // o pano voa para −x (a favor do vento)
    cloth.castShadow = true;
    goal.add(pole, finial, cloth);
    let raise = 0;
    let raiseTarget = 0;

    /** Recria o que depende do estado da fase (chamar a cada `reset`). */
    function sync() {
        // faíscas: as do mapa (os cristais das caixas entram depois, em `gems`)
        const count = game.coins.length;
        if (!coinMesh || coinMesh.count !== count) {
            if (coinMesh) { group.remove(coinMesh); coinMesh.dispose(); }
            coinMesh = new THREE.InstancedMesh(coinGeo, gold, count);
            coinMesh.castShadow = true;
            coinMesh.frustumCulled = false;
            group.add(coinMesh);
            coinPop = new Float32Array(count);
        }
        coinPop.fill(0);
        for (const g of gems) g.mesh.visible = false;

        while (crates.length < game.crates.length) {
            const c = new THREE.Group();
            const body = new THREE.Mesh(crateWood, wood);
            const frame = new THREE.Mesh(crateFrame, iron);
            const emblem = new THREE.Mesh(emblemGeo, emblemLit);
            body.castShadow = frame.castShadow = true;
            body.receiveShadow = true;
            c.add(body, frame, emblem);
            group.add(c);
            const gem = new THREE.Mesh(gemGeo, gemMat);
            gem.castShadow = true;
            gem.visible = false;
            group.add(gem);
            gems.push({ mesh: gem, pop: 0 });
            crates.push({ group: c, body, emblem, sq: 0 });
        }
        game.crates.forEach((t, i) => {
            const c = crates[i];
            c.group.position.set(toX(t.x) + 0.5, toY(t.y) - 0.5, 0);
            c.body.material = wood;
            c.emblem.material = emblemLit;
        });

        if (stakeGroup.children.length !== game.spikes.length * 2) {
            stakeGroup.clear();
            for (const sp of game.spikes) {
                const x = sp.col + 0.5;
                const y = GROUND_ROW - sp.row - 1;
                const st = new THREE.Mesh(stakesGeo, steel);
                st.scale.set(1.1, 1.18, 1.1);
                st.position.set(x, y, 0);
                st.castShadow = true;
                const base = new THREE.Mesh(baseGeo, baseMat);
                base.position.set(x, y + 0.02, 0);
                base.receiveShadow = true;
                base.castShadow = true;
                stakeGroup.add(st, base);
            }
        }

        if (game.goal) goal.position.set(toX(game.goal.x), toY(game.goal.y), -0.15);
        raise = 0;
        raiseTarget = 0;
    }

    function update(dt, t) {
        time.value = t;
        const coins = game.coins;
        let gemIndex = 0;
        for (let i = 0; i < coins.length; i++) {
            const c = coins[i];
            const x = toX(c.x);
            const y = toY(c.y);
            if (c.gem) {
                const g = gems[gemIndex++];
                if (!g) continue;
                if (c.taken) g.pop = Math.min(1, g.pop + dt / 0.28);
                else g.pop = 0;
                const k = 1 - g.pop;
                g.mesh.visible = k > 0.001;
                g.mesh.position.set(x, y + Math.sin(c.phase) * 0.06 + g.pop * 0.7, 0);
                g.mesh.rotation.set(0.2, c.phase * 0.8 + g.pop * 9, 0);
                g.mesh.scale.setScalar(Math.max(0.001, k) * 1.15);
                continue;
            }
            if (i >= coinPop.length) continue;
            if (c.taken) coinPop[i] = Math.min(1, coinPop[i] + dt / 0.28);
            const k = 1 - coinPop[i];
            p.set(x, y + Math.sin(c.phase) * 0.12 + coinPop[i] * 0.7, 0);
            e.set(0, c.phase * 0.9 + coinPop[i] * 10, 0);
            q.setFromEuler(e);
            s.setScalar(Math.max(0.0001, k * (1 + coinPop[i] * 0.6)));
            m4.compose(p, q, s);
            coinMesh.setMatrixAt(i, m4);
        }
        // cristais ainda não soltos ficam escondidos
        for (let i = gemIndex; i < gems.length; i++) gems[i].mesh.visible = false;
        if (coinMesh) coinMesh.instanceMatrix.needsUpdate = true;

        game.crates.forEach((tile, i) => {
            const c = crates[i];
            if (!c) return;
            // cabeçada: a caixa salta 0,19 m e estica/achata no caminho
            const b = tile.bump;
            c.group.position.y = toY(tile.y) - 0.5 + Math.sin(b * Math.PI) * 0.19 + (tile.bumped ? 0 : Math.sin(t * 1.7 + i) * 0.025);
            c.group.scale.set(1 - Math.sin(b * Math.PI) * 0.08, 1 + Math.sin(b * Math.PI) * 0.12, 1 - Math.sin(b * Math.PI) * 0.08);
            if (tile.bumped && c.emblem.material !== emblemOff) {
                c.emblem.material = emblemOff;
                c.body.material = woodSpent;
            }
        });
        emblemLit.emissiveIntensity = 2.1 + Math.sin(t * 3.2) * 0.5;

        raise = damp(raise, raiseTarget, 2.6, dt);
        cloth.position.y = 1.45 + raise * 1.2;
        finial.rotation.y = t * (0.8 + raise * 5);
    }

    return {
        group, sync, update,
        /** Vitória: o pano sobe até o topo do mastro. */
        celebrate() { raiseTarget = 1; }
    };
}
