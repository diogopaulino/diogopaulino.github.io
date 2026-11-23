/**
 * Vida na orla: gente de verdade (esqueleto + marcha procedural do kit gfx/human) —
 * pedestres no calçadão, no passeio da praia e nos caminhos do jardim, corredores,
 * ciclistas na ciclovia, pessoas sentadas nos bancos e nas cadeiras de praia, banhistas
 * com água pela cintura, surfistas esperando a série no José Menino, pescadores no deck
 * e gaivotas/urubus planando.
 *
 * Regras:
 *   - quem anda segue um "trilho" z = f(x) e inverte nas pontas do seu trecho; a fase da
 *     marcha avança com a distância (cadência 1,45 passo/m) → o pé não desliza;
 *   - velocidades: caminhada 1,0–1,45 m/s, trote 2,6–3,9 m/s, bike 4,6–7,2 m/s (16–26 km/h);
 *   - desvio: quem vem de frente se mantém à direita (mão brasileira: +z indo para leste)
 *     e ninguém atravessa o visitante — abre ~1,2 m de lado e reduz o passo
 *       v = v_cruzeiro · clamp((distância − 0,6) / 2,5, 0,25, 1);
 *   - ciclistas freiam para o visitante na ciclovia e seguem quem vai à frente
 *       v_alvo = min(v_cruzeiro, v_líder se vão < 5 m, (vão − 1,5)·1,2 s⁻¹), a ≤ 1 m/s², freio 3,5 m/s²;
 *   - nível de detalhe: além de 140 m a pose não é recalculada; além de 320 m some;
 *   - aves: um único InstancedMesh; a batida de asa é feita no vertex shader
 *       y += |aWing| · sin(t·f + fase) · amplitude   (urubus planam: amplitude ≈ 0).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createHuman, poseHuman, SKIN_TONES, HAIR_TONES } from '../../shared/gfx/human.js';
import { seeded, paint } from '../../shared/gfx/core.js';
import { ZONES, CANALS, LAND_Y, PLATFORMS, WALK, groundY, seaDepth } from './config.js';
import { gardenPathA, gardenPathB, X_WEST, X_EAST } from './terrain.js';
import { P, propMaterial } from './props.js';

const SHIRTS = [0x2c6ea0, 0xd84a3a, 0xf2c230, 0x3d8a52, 0xf4f1ea, 0x1a1a1e, 0x8a4ab0, 0xf07a22, 0x1f8a8a, 0xd86a9a, 0x9aa0a8, 0x224488];
const BOTTOMS = [0x2a303a, 0x3d4856, 0xd9d2c0, 0x1e242c, 0x4a6a8a, 0x6a5a48, 0x15171a];
const SWIM = [0xd8283a, 0x1f6fb8, 0x15171a, 0xf2c230, 0x22aa88, 0xe86aa8, 0xf4f1ea, 0xf07a22];

function outfit(rnd, kind) {
    const female = rnd() < 0.5;
    const base = {
        female,
        skin: rnd.pick(SKIN_TONES),
        hair: rnd.pick(HAIR_TONES),
        hairStyle: female ? rnd.pick(['long', 'long', 'bun', 'short']) : rnd.pick(['short', 'short', 'short', 'bald']),
        height: (female ? 1.62 : 1.75) * (0.95 + rnd() * 0.1),
        build: 0.88 + rnd() * 0.34
    };
    if (kind === 'beach') {
        const c = rnd.pick(SWIM);
        return {
            ...base, top: female ? 'bikini' : 'none', topColor: c, bottom: rnd() < 0.3 && !female ? 'shorts' : 'swim',
            bottomColor: female ? c : rnd.pick(SWIM), shoes: 'barefoot', hat: rnd() < 0.25 ? rnd.pick(['straw', 'cap']) : 'none',
            hatColor: rnd.pick([0xe8dcb8, 0xf4f1ea, 0x224488])
        };
    }
    if (kind === 'jog') {
        return {
            ...base, top: rnd() < 0.5 ? 'tank' : 'tee', topColor: rnd.pick(SHIRTS), bottom: 'shorts', bottomColor: rnd.pick([0x15171a, 0x224488, 0x3d4856]),
            shoes: 'sneaker', shoeColor: rnd.pick([0xf2f0ea, 0xd8f23a, 0xf07a22]), hat: rnd() < 0.3 ? 'cap' : 'none', hatColor: 0xf4f1ea
        };
    }
    if (kind === 'bike') {
        return {
            ...base, top: 'tee', topColor: rnd.pick(SHIRTS), bottom: rnd.pick(['shorts', 'bermuda']), bottomColor: rnd.pick(BOTTOMS),
            shoes: 'sneaker', hat: rnd() < 0.6 ? 'cap' : 'none', hatColor: rnd.pick([0x15171a, 0xd8283a, 0xf4f1ea])
        };
    }
    const child = kind === 'street' && rnd() < 0.1;
    return {
        ...base,
        child, height: child ? 1.05 + rnd() * 0.3 : base.height,
        top: rnd.pick(['tee', 'tee', 'tee', 'tank', 'long']), topColor: rnd.pick(SHIRTS),
        bottom: female && rnd() < 0.3 ? 'skirt' : rnd.pick(['shorts', 'bermuda', 'bermuda', 'pants']), bottomColor: rnd.pick(BOTTOMS),
        shoes: rnd.pick(['sneaker', 'sneaker', 'sandal']), shoeColor: rnd.pick([0xf2f0ea, 0x2a2a2e, 0x8a5a34]),
        hat: rnd() < 0.18 ? rnd.pick(['cap', 'straw']) : 'none', hatColor: rnd.pick([0xe8dcb8, 0x224488, 0xf4f1ea])
    };
}

export function bikeGeometry() {
    const D = 0x1d1f23;
    const parts = [];
    for (const z of [-0.53, 0.53]) {
        const tire = new THREE.TorusGeometry(0.33, 0.028, 6, 20);
        tire.rotateY(Math.PI / 2);
        tire.translate(0, 0.36, z);
        parts.push(P.geo(tire, D));
        const rim = new THREE.TorusGeometry(0.3, 0.012, 4, 16);
        rim.rotateY(Math.PI / 2);
        rim.translate(0, 0.36, z);
        parts.push(P.geo(rim, 0xb8bcc0));
        for (let s = 0; s < 6; s++) parts.push(P.box(0.006, 0.6, 0.006, 0, 0.36, z, 0xb8bcc0, 0, (s / 6) * Math.PI));
    }
    const F = 0xffffff; // quadro tingido por instância
    parts.push(P.tube([[0, 0.36, -0.53], [0, 0.78, -0.2]], 0.018, F), P.tube([[0, 0.78, -0.2], [0, 0.84, 0.36]], 0.02, F));
    parts.push(P.tube([[0, 0.36, -0.53], [0, 0.34, -0.06], [0, 0.84, 0.36]], 0.02, F), P.tube([[0, 0.34, -0.06], [0, 0.78, -0.2], [0, 0.96, -0.24]], 0.018, F));
    parts.push(P.tube([[0, 0.36, 0.53], [0, 0.86, 0.37], [0, 1.02, 0.33]], 0.018, 0xb8bcc0));
    parts.push(P.box(0.5, 0.025, 0.025, 0, 1.02, 0.33, D), P.box(0.13, 0.04, 0.26, 0, 0.98, -0.25, D));
    parts.push(P.cyl(0.09, 0.09, 0.02, 0, 0.34, -0.06, 0xb8bcc0, 10, 0, Math.PI / 2));
    return mergeGeometries(parts);
}

function birdGeometry() {
    const body = new THREE.SphereGeometry(1, 8, 6);
    body.scale(0.09, 0.08, 0.3);
    const parts = [];
    const add = (g, wingFn) => {
        const n = g.index ? g.toNonIndexed() : g;
        n.deleteAttribute('uv');
        const p = n.attributes.position;
        const w = new Float32Array(p.count);
        for (let i = 0; i < p.count; i++) w[i] = wingFn(p.getX(i));
        n.setAttribute('aWing', new THREE.BufferAttribute(w, 1));
        n.computeVertexNormals();
        parts.push(n);
    };
    add(body, () => 0);
    for (const s of [-1, 1]) {
        const g = new THREE.BufferGeometry();
        // asa em 2 segmentos (braço + mão), afilando
        const v = [
            [0, 0, 0.1], [0, 0, -0.1], [s * 0.38, 0, 0.11], [0, 0, -0.1], [s * 0.38, 0, -0.07], [s * 0.38, 0, 0.11],
            [s * 0.38, 0, 0.11], [s * 0.38, 0, -0.07], [s * 0.78, 0, 0.0]
        ];
        const order = s > 0 ? v : v.map((_, i, a) => a[i - (i % 3) + (2 - (i % 3))]);
        g.setAttribute('position', new THREE.Float32BufferAttribute(order.flat(), 3));
        add(g, (x) => Math.abs(x));
    }
    const tail = new THREE.BufferGeometry();
    tail.setAttribute('position', new THREE.Float32BufferAttribute([0.05, 0, -0.26, -0.05, 0, -0.26, 0, 0, -0.44], 3));
    add(tail, () => 0);
    return mergeGeometries(parts);
}

export function createLife(quality, terrain, props) {
    const root = new THREE.Group();
    root.name = 'life';
    const rnd = seeded(0x71fe);
    const actors = [];
    const walkers = [];

    const spawn = (opts, mode) => {
        const h = createHuman(opts);
        h.mode = mode;
        h.t0 = rnd() * 20;
        h.phase = rnd() * 6;
        root.add(h.object);
        actors.push(h);
        return h;
    };

    const canalSpan = (x) => {
        let a = X_WEST + 4;
        let b = X_EAST - 3;
        for (const c of CANALS) {
            if (c.x < x) a = Math.max(a, c.x + c.width / 2 + 2.5);
            else b = Math.min(b, c.x - c.width / 2 - 2.5);
        }
        return [a, b];
    };

    // ---------- pedestres ----------
    const lanes = [
        { z: () => -1.6, w: 0.8, n: 0.2, span: null, kind: 'street' },                 // calçadão (lado da avenida)
        { z: () => 1.3, w: 1.0, n: 0.2, span: null, kind: 'street' },                  // calçadão (lado do jardim)
        { z: () => 43.0, w: 1.4, n: 0.2, span: null, kind: 'street' },                 // passeio da praia
        { z: gardenPathA, w: 0.5, n: 0.12, span: 'canal', kind: 'street' },
        { z: gardenPathB, w: 0.4, n: 0.08, span: 'canal', kind: 'street' },
        { z: (x) => 110.5 + Math.sin(x * 0.05) * 1.6, w: 1.6, n: 0.2, span: null, kind: 'beach' } // beira d'água
    ];
    const nWalk = Math.round(quality.people * 0.52);
    for (let i = 0; i < nWalk; i++) {
        let r = rnd();
        let lane = lanes[lanes.length - 1];
        for (const l of lanes) {
            if (r < l.n) { lane = l; break; }
            r -= l.n;
        }
        const jog = lane.kind === 'street' && !lane.span && rnd() < 0.2;
        const x = -330 + rnd() * 665;
        const [a, b] = lane.span === 'canal' ? canalSpan(x) : [-342, lane.kind === 'beach' ? 330 : 346];
        if (b - a < 12) continue;
        const h = spawn(outfit(rnd, jog ? 'jog' : lane.kind), jog ? 'run' : 'walk');
        Object.assign(h, {
            x: Math.min(b - 1, Math.max(a + 1, x)), lane, off: (rnd() - 0.5) * 2 * lane.w, dir: rnd.sign(),
            speed: (jog ? 3.1 : 1.15) * (0.85 + rnd() * 0.4), a, b, stride: h.height / 1.75
        });
        h.cur = h.speed;
        h.dodge = 0;
        walkers.push(h);
    }
    const laneGroups = lanes.map((l) => walkers.filter((w) => w.lane === l));

    // ---------- sentados (bancos e cadeiras de praia) ----------
    const benches = props?.benches || [];
    const chairs = props?.chairs || [];
    const nBench = Math.min(benches.length, Math.round(quality.people * 0.12));
    for (let i = 0; i < nBench; i++) {
        const b = benches[Math.floor(rnd() * benches.length)];
        const h = spawn(outfit(rnd, 'street'), 'sit');
        h.object.position.set(b.x + (rnd() - 0.5) * 1.0, b.y - 0.07, b.z - 0.06);
        h.object.rotation.y = b.ry || 0;
    }
    const nChair = Math.min(chairs.length, Math.round(quality.people * 0.14));
    for (let i = 0; i < nChair; i++) {
        const c = chairs[Math.floor(rnd() * chairs.length)];
        const h = spawn(outfit(rnd, 'beach'), 'sit');
        h.object.position.set(c.x, c.y - 0.24, c.z - 0.05);
        h.object.rotation.y = c.ry || 0;
    }

    // ---------- banhistas (parados na areia e na água) ----------
    const nBath = Math.round(quality.people * 0.14);
    for (let i = 0; i < nBath; i++) {
        const x = -320 + rnd() * 640;
        if (CANALS.some((c) => Math.abs(x - c.x) < 8) || PLATFORMS.some((p) => x > p.x0 - 2 && x < p.x1 + 2)) continue;
        const inWater = rnd() < 0.55;
        const z = inWater ? ZONES.waterline + 16 + rnd() * 20 : 62 + rnd() * 40;
        const h = spawn(outfit(rnd, 'beach'), rnd() < 0.25 ? 'wave' : rnd() < 0.5 ? 'talk' : 'idle');
        h.object.position.set(x, groundY(x, z), z);
        h.object.rotation.y = rnd() * Math.PI * 2;
        h.water = inWater;
    }

    // ---------- surfistas (José Menino) ----------
    const boardGeo = (() => {
        const g = new THREE.SphereGeometry(1, 12, 6);
        g.scale(0.27, 0.035, 1.0);
        return paint(g.toNonIndexed(), 0xffffff);
    })();
    const surfers = [];
    const nSurf = quality.id === 'low' ? 2 : 5;
    const boards = new THREE.InstancedMesh(boardGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35 }), nSurf);
    boards.frustumCulled = false;
    const bc = new THREE.Color();
    for (let i = 0; i < nSurf; i++) {
        const h = spawn({ ...outfit(rnd, 'beach'), female: false, top: 'long', topColor: 0x15171a, bottom: 'pants', bottomColor: 0x15171a }, 'sit');
        h.x = -310 + rnd() * 90;
        h.z = 172 + rnd() * 22;
        h.yaw = Math.PI + (rnd() - 0.5) * 0.8;
        boards.setColorAt(i, bc.set(rnd.pick([0xf4f1ea, 0xf2e23a, 0x6ad0e0, 0xf07a5a])));
        surfers.push(h);
    }
    if (boards.instanceColor) boards.instanceColor.needsUpdate = true;
    root.add(boards);

    // ---------- pescadores no deck ----------
    const deck = PLATFORMS[1];
    const rodParts = [];
    const fishers = [];
    for (let i = 0; i < (quality.id === 'low' ? 2 : 4); i++) {
        const side = i % 2 ? 1 : -1;
        const z = 112 + i * 6.4;
        const x = side > 0 ? deck.x1 - 0.75 : deck.x0 + 0.75;
        const h = spawn({ ...outfit(rnd, 'street'), hat: 'straw', hatColor: 0xe8dcb8 }, 'lean');
        h.object.position.set(x, LAND_Y, z);
        h.object.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
        fishers.push(h);
        rodParts.push(P.tube([[x + side * 0.3, LAND_Y + 1.05, z], [x + side * 1.6, LAND_Y + 2.2, z], [x + side * 3.2, LAND_Y + 2.7, z]], 0.012, 0x3a2a1c, 4));
        rodParts.push(P.box(0.004, 2.9, 0.004, x + side * 3.2, LAND_Y + 1.25, z, 0xdedede));
    }
    if (rodParts.length) root.add(new THREE.Mesh(mergeGeometries(rodParts), propMaterial()));

    // ---------- ciclistas ----------
    const bikeGeo = bikeGeometry();
    const bikes = new THREE.InstancedMesh(bikeGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.5 }), quality.cyclists);
    bikes.castShadow = true;
    bikes.frustumCulled = false;
    const cyclists = [];
    for (let i = 0; i < quality.cyclists; i++) {
        const dir = i % 2 ? 1 : -1;
        const h = spawn(outfit(rnd, 'bike'), 'cycle');
        Object.assign(h, {
            x: -335 + rnd() * 670, dir, z: (ZONES.bike[0] + ZONES.bike[1]) / 2 + dir * 0.7, speed: 4.6 + rnd() * 2.6, index: i
        });
        h.cur = h.speed;
        bikes.setColorAt(i, bc.set(rnd.pick([0xd8283a, 0x1f6fb8, 0xf2c230, 0x15171a, 0x22aa88, 0xf4f1ea])));
        cyclists.push(h);
    }
    if (bikes.instanceColor) bikes.instanceColor.needsUpdate = true;
    root.add(bikes);

    // ---------- aves ----------
    const birdMat = new THREE.MeshStandardMaterial({ vertexColors: false, color: 0xffffff, roughness: 0.8, side: THREE.DoubleSide });
    const uBird = { value: 0 };
    birdMat.onBeforeCompile = (sh) => {
        sh.uniforms.uBirdTime = uBird;
        sh.vertexShader = sh.vertexShader
            .replace('#include <common>', '#include <common>\nattribute float aWing;\nattribute vec2 aFlap;\nuniform float uBirdTime;')
            .replace('#include <begin_vertex>', `#include <begin_vertex>
                float bw = sin(uBirdTime * aFlap.x + aFlap.y);
                transformed.y += aWing * (bw * aFlap.x * 0.055 + 0.12 + aWing * 0.1);`);
    };
    birdMat.customProgramCacheKey = () => 'orlaBird';
    const birdGeo = birdGeometry();
    const nBirds = quality.birds;
    const flap = new Float32Array(nBirds * 2);
    const birdList = [];
    const birdMesh = new THREE.InstancedMesh(birdGeo, birdMat, nBirds);
    birdMesh.frustumCulled = false;
    for (let i = 0; i < nBirds; i++) {
        const vulture = i % 4 === 3;
        flap[i * 2] = vulture ? 0.6 : 7 + rnd() * 4;
        flap[i * 2 + 1] = rnd() * 6.28;
        birdMesh.setColorAt(i, bc.set(vulture ? 0x1a1a1c : 0xf2f2ee));
        birdList.push({
            cx: -320 + rnd() * 640, cz: vulture ? -40 + rnd() * 80 : 70 + rnd() * 120,
            r: vulture ? 40 + rnd() * 50 : 14 + rnd() * 30, h: vulture ? 70 + rnd() * 60 : LAND_Y + 6 + rnd() * 16,
            w: (vulture ? 0.12 : 0.3 + rnd() * 0.25) * rnd.sign(), ph: rnd() * 6.28, scale: vulture ? 2.3 : 1.25
        });
    }
    birdGeo.setAttribute('aFlap', new THREE.InstancedBufferAttribute(flap, 2));
    if (birdMesh.instanceColor) birdMesh.instanceColor.needsUpdate = true;
    root.add(birdMesh);

    for (const h of actors) {
        if (h.mode === 'sit' || h.mode === 'lean') poseHuman(h, h.mode, h.t0);
    }

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const v = new THREE.Vector3();
    const s = new THREE.Vector3();
    const one = new THREE.Vector3(1, 1, 1);
    const cam = new THREE.Vector3();
    let frame = 0;

    function update(t, dt, ctx) {
        frame++;
        if (ctx?.camera) cam.copy(ctx.camera.position);
        const ocean = ctx?.ocean;

        const player = ctx?.player;
        const px = player ? player.x : 1e9;
        const pz = player ? player.z : 1e9;
        for (let li = 0; li < laneGroups.length; li++) {
            const group = laneGroups[li];
            for (let i = 0; i < group.length; i++) {
                const h = group[i];
                const zl = h.lane.z(h.x) + h.off;
                // visitante à frente no caminho: abre espaço e reduz o passo
                let slow = 1;
                let dodge = 0;
                const ahead = (px - h.x) * h.dir;
                const lat = pz - zl; // relativo ao trilho (sem o desvio) → sem oscilar
                if (ahead > -0.6 && ahead < 3.6 && Math.abs(lat) < 1.15) {
                    dodge = lat > 0 ? -1.2 : 1.2;
                    slow = Math.min(1, Math.max(0.25, (ahead - 0.6) / 2.5));
                }
                // pedestre vindo de frente: cada um à sua direita
                for (let j = 0; j < group.length && !dodge; j++) {
                    const o = group[j];
                    if (o === h || o.dir === h.dir) continue;
                    const d = (o.x - h.x) * h.dir;
                    if (d > 0 && d < 4 && Math.abs(o.off - h.off) < 0.7) dodge = 0.55 * h.dir;
                }
                h.dodge += (dodge - h.dodge) * (1 - Math.exp(-3 * dt));
                h.cur += (h.speed * slow - h.cur) * (1 - Math.exp(-4 * dt));
                h.x += h.dir * h.cur * dt;
                if (h.x > h.b) { h.x = h.b; h.dir = -1; }
                if (h.x < h.a) { h.x = h.a; h.dir = 1; }
                const z = h.lane.z(h.x) + h.off + h.dodge;
                const dz = h.lane.z(h.x + h.dir * 0.5) - h.lane.z(h.x);
                h.object.position.set(h.x, groundY(h.x, z), z);
                h.object.rotation.y = Math.atan2(h.dir * 0.5, dz);
                h.phase += h.cur * dt * Math.PI * WALK.stepsPerMeter / h.stride;
            }
        }
        for (let i = 0; i < cyclists.length; i++) {
            const h = cyclists[i];
            let target = h.speed;
            // visitante na ciclovia à frente
            const ahead = (px - h.x) * h.dir;
            if (ahead > 0 && ahead < 14 && Math.abs(pz - h.z) < 1.0) target = Math.min(target, Math.max(0, (ahead - 1.5) * 1.2));
            // ciclista mais lento à frente, mesmo sentido
            for (let j = 0; j < cyclists.length; j++) {
                const o = cyclists[j];
                if (o === h || o.dir !== h.dir) continue;
                const d = (o.x - h.x) * h.dir;
                if (d > 0 && d < 5) target = Math.min(target, o.cur * (d < 2.5 ? 0.8 : 1));
            }
            const a = target > h.cur ? 1.0 : 3.5;
            h.cur += Math.max(-a * dt, Math.min(a * dt, target - h.cur));
            h.x += h.dir * h.cur * dt;
            if (h.x > 346) h.x = -340;
            if (h.x < -340) h.x = 346;
            const yaw = h.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
            h.object.position.set(h.x, LAND_Y + 0.42, h.z);
            h.object.rotation.y = yaw;
            if (h.cur > 0.3) h.phase += h.cur * dt * 2.1;
            q.setFromAxisAngle(v.set(0, 1, 0), yaw);
            m.compose(v.set(h.x, LAND_Y - 0.02, h.z), q, one);
            bikes.setMatrixAt(h.index, m);
        }
        bikes.instanceMatrix.needsUpdate = true;

        for (let i = 0; i < surfers.length; i++) {
            const h = surfers[i];
            const y = ocean ? ocean.heightAt(h.x, h.z, t) : 0;
            h.object.position.set(h.x, y - 0.5, h.z);
            h.object.rotation.set(Math.sin(t * 0.9 + i) * 0.05, h.yaw, Math.sin(t * 0.7 + i * 2) * 0.06);
            e.set(Math.sin(t * 0.9 + i) * 0.06, h.yaw, 0);
            q.setFromEuler(e);
            m.compose(v.set(h.x, y + 0.02, h.z), q, one);
            boards.setMatrixAt(i, m);
        }
        boards.instanceMatrix.needsUpdate = true;

        // poses: perto = todo frame; médio = frames alternados; longe = congelado/oculto
        for (let i = 0; i < actors.length; i++) {
            const h = actors[i];
            const p = h.object.position;
            const d2 = (p.x - cam.x) ** 2 + (p.z - cam.z) ** 2 + (p.y - cam.y) ** 2 * 0.25;
            const vis = d2 < 320 * 320;
            if (h.object.visible !== vis) h.object.visible = vis;
            if (!vis || d2 > 140 * 140) continue;
            if (d2 > 55 * 55 && (frame + i) % 2) continue;
            if (h.mode === 'walk' || h.mode === 'run') poseHuman(h, h.mode, h.phase, 1);
            else if (h.mode === 'cycle') poseHuman(h, 'cycle', h.phase);
            else if (h.water) {
                poseHuman(h, h.mode, t + h.t0);
                const depth = seaDepth(p.z);
                p.y = groundY(p.x, p.z) + Math.max(0, depth - 1.05) + (ocean ? ocean.heightAt(p.x, p.z, t) * 0.25 : 0);
            } else poseHuman(h, h.mode, t + h.t0);
        }

        uBird.value = t;
        for (let i = 0; i < birdList.length; i++) {
            const b = birdList[i];
            const a = t * b.w + b.ph;
            const x = b.cx + Math.cos(a) * b.r;
            const z = b.cz + Math.sin(a) * b.r * 0.7;
            const y = b.h + Math.sin(a * 2.3 + b.ph) * 2.2;
            e.set(0, -a + (b.w > 0 ? 0 : Math.PI), (b.w > 0 ? -1 : 1) * 0.28);
            q.setFromEuler(e);
            m.compose(v.set(x, y, z), q, s.setScalar(b.scale));
            birdMesh.setMatrixAt(i, m);
        }
        birdMesh.instanceMatrix.needsUpdate = true;
    }

    return { root, update, setNight() {}, count: actors.length };
}
