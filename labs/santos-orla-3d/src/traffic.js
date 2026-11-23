/**
 * Trânsito da avenida da praia: carros (hatch, sedã, SUV) e ônibus.
 *
 * Carroceria: perfil lateral (Shape) extrudado na largura com chanfro arredondado
 * (ExtrudeGeometry + bevel) → cantos macios de carro, não caixa. A cabine envidraçada é
 * um segundo perfil mais estreito; rodas são cilindros. A pintura é a cor de vértice
 * branca multiplicada pela cor da instância (vidros/pneus são escuros e quase não mudam).
 *
 * Mão brasileira (direita): pista sul segue para leste, pista norte para oeste.
 * Faixa da guia = estacionamento; as outras duas rodam em anel (saem numa ponta, voltam na outra).
 *
 * Seguimento de veículo: Intelligent Driver Model (Treiber, 2000), por carro:
 *   a = a_max · [1 − (v/v₀)⁴ − (s_d/s)²]
 *   s_d = s₀ + max(0, v·T + v·Δv / (2·√(a_max·b)))
 *   s = vão até o para-choque do líder (ou até o pedestre na faixa), Δv = v − v_líder.
 *   v₀: faixa da esquerda ~48 km/h, do meio ~42 km/h (limite 50 km/h na orla), ±6 % por
 *   motorista; ônibus 38 km/h. s₀ = 2 m, T = 1,3 s, b = 2,5 m/s², frenagem máx. 8 m/s².
 *   Como ninguém ultrapassa, a ordem na faixa é fixa → nunca empilham nem se atravessam.
 * O visitante na pista vira obstáculo parado: os carros freiam e esperam (e buzinam se
 *   tiverem de frear forte). Carros parados e em movimento também bloqueiam o visitante.
 * Faróis/lanternas: quads emissivos instanciados, acesos conforme a noite.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { paint, seeded } from '../../shared/gfx/core.js';
import { ZONES, CANALS, LAND_Y } from './config.js';
import { X_WEST, X_EAST } from './terrain.js';
import { P } from './props.js';

const ROAD_Y = LAND_Y - 0.14;

function profile(points, width, bevel, color) {
    const shape = new THREE.Shape();
    points.forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, {
        depth: width - bevel * 2, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 4
    });
    g.translate(0, 0, -(width - bevel * 2) / 2);
    g.rotateY(-Math.PI / 2); // comprimento em Z, frente em +Z
    const n = g.index ? g.toNonIndexed() : g;
    n.deleteAttribute('uv');
    return paint(n, color);
}

function carGeometry(kind) {
    const L = kind === 'suv' ? 4.5 : kind === 'sedan' ? 4.5 : 4.0;
    const W = kind === 'suv' ? 1.86 : 1.76;
    const h = kind === 'suv' ? 0.95 : 0.78;      // linha de cintura
    const roof = kind === 'suv' ? 1.72 : 1.44;
    const g0 = kind === 'suv' ? 0.3 : 0.22;       // vão livre
    const f = L / 2;
    const parts = [];
    // carroceria inferior (pintura)
    parts.push(profile([
        [-f, g0 + 0.12], [-f + 0.06, h - 0.1], [-f + 0.35, h], [f - 0.5, h - 0.02], [f - 0.06, h - 0.24], [f, g0 + 0.16],
        [f - 0.12, g0], [-f + 0.12, g0]
    ], W, 0.1, 0xffffff));
    // cabine (vidro)
    const a0 = kind === 'sedan' ? -f + 1.05 : -f + 0.42;   // base do vidro traseiro
    const a1 = kind === 'sedan' ? -f + 1.5 : -f + 0.62;
    const b1 = f - 1.75;
    const b0 = f - 1.02;                                    // base do para-brisa
    parts.push(profile([[a0, h - 0.02], [a1, roof - 0.04], [b1, roof - 0.04], [b0, h - 0.02]], W - 0.24, 0.07, 0x10161c));
    // teto e colunas (pintura)
    parts.push(profile([[a1 - 0.04, roof - 0.07], [a1 + 0.03, roof], [b1 - 0.03, roof], [b1 + 0.05, roof - 0.07]], W - 0.3, 0.05, 0xffffff));
    for (const s of [-1, 1]) {
        parts.push(P.box(0.06, roof - h, 0.1, s * (W / 2 - 0.15), (roof + h) / 2 - 0.02, (a1 + b1) / 2 + 0.15, 0xffffff));
    }
    // rodas + calotas
    for (const z of [-f + 0.78, f - 0.82]) {
        for (const s of [-1, 1]) {
            parts.push(P.cyl(0.33, 0.33, 0.22, s * (W / 2 - 0.1), 0.33, z, 0x121214, 14, 0, Math.PI / 2));
            parts.push(P.cyl(0.2, 0.2, 0.235, s * (W / 2 - 0.1), 0.33, z, 0xa6abb0, 10, 0, Math.PI / 2));
        }
    }
    // para-choques, placas, retrovisores
    parts.push(P.box(W - 0.1, 0.16, 0.12, 0, g0 + 0.16, f - 0.02, 0x1a1c1f), P.box(W - 0.1, 0.16, 0.12, 0, g0 + 0.16, -f + 0.02, 0x1a1c1f));
    for (const s of [-1, 1]) parts.push(P.box(0.16, 0.1, 0.08, s * (W / 2 + 0.04), h + 0.08, b0 - 0.15, 0x1a1c1f));
    return { geometry: mergeGeometries(parts), L, W, h };
}

function busGeometry() {
    const L = 12;
    const W = 2.5;
    const f = L / 2;
    const parts = [];
    parts.push(profile([[-f, 0.5], [-f, 2.95], [-f + 0.2, 3.1], [f - 0.4, 3.1], [f, 2.7], [f, 0.5], [f - 0.2, 0.35], [-f + 0.2, 0.35]], W, 0.1, 0xffffff));
    for (const s of [-1, 1]) {
        parts.push(P.box(0.04, 0.95, L - 1.6, s * (W / 2 + 0.005), 2.05, -0.2, 0x10161c)); // faixa de janelas
        parts.push(P.box(0.04, 0.5, L - 0.6, s * (W / 2 + 0.006), 1.0, 0, 0x1f6fb8));       // faixa azul da frota
        for (const z of [-f + 2.4, f - 2.6]) {
            parts.push(P.cyl(0.48, 0.48, 0.3, s * (W / 2 - 0.12), 0.48, z, 0x121214, 14, 0, Math.PI / 2));
        }
    }
    parts.push(P.box(W - 0.2, 1.25, 0.05, 0, 2.05, f - 0.14, 0x10161c, 0, -0.16)); // para-brisa
    parts.push(P.box(W - 0.3, 0.34, 0.05, 0, 2.86, f - 0.02, 0x15150f));           // letreiro
    parts.push(P.box(W - 0.2, 0.9, 0.05, 0, 2.2, -f - 0.005, 0x10161c));
    return { geometry: mergeGeometries(parts), L, W };
}

const PAINT = [0xf2f2f0, 0xf2f2f0, 0xdadada, 0xb8bcc0, 0x8a8f96, 0x2a2d31, 0x15171a, 0x15171a, 0xa8231c, 0x1f3f7a, 0x6a7f8a, 0x7a3020, 0xc9c2b0];

export function createTraffic(quality) {
    const root = new THREE.Group();
    root.name = 'traffic';
    const rnd = seeded(0xca55);
    const mat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.34, metalness: 0.35, clearcoat: 0.7, clearcoatRoughness: 0.2, envMapIntensity: 1.1 });
    const kinds = [carGeometry('hatch'), carGeometry('sedan'), carGeometry('suv')];
    const bus = busGeometry();

    const laneW = (ZONES.roadN[1] - ZONES.roadN[0]) / 3;
    const lanes = [];
    // pista sul → leste (dir +1); pista norte → oeste (dir −1). Faixa da guia = estacionamento.
    for (let l = 0; l < 2; l++) {
        lanes.push({ z: ZONES.roadS[0] + laneW * (l + 0.5), dir: 1, v0: l ? 11.6 : 13.4, cars: [] });
        lanes.push({ z: ZONES.roadN[1] - laneW * (l + 0.5), dir: -1, v0: l ? 11.6 : 13.4, cars: [] });
    }
    const span = X_EAST - X_WEST - 6;
    const cars = [];
    const perLane = Math.ceil(quality.cars / lanes.length);
    lanes.forEach((lane, li) => {
        const gap = span / perLane;
        for (let i = 0; i < perLane; i++) {
            const isBus = i === 0 && li >= 2; // ônibus nas faixas do meio
            const kind = isBus ? 3 : Math.floor(rnd() * 3);
            const car = {
                lane, x: X_WEST + 3 + gap * i + rnd() * gap * 0.55, kind,
                color: isBus ? 0xf4f4f2 : rnd.pick(PAINT),
                v0: isBus ? 10.5 : lane.v0 * (0.94 + rnd() * 0.12),
                amax: isBus ? 0.9 : 1.5 + rnd() * 0.4,
                v: 0, len: 0, honkT: 0, leader: null,
                rect: { x0: 0, x1: 0, z0: 0, z1: 0 }
            };
            car.v = car.v0 * 0.9;
            cars.push(car);
            lane.cars.push(car);
        }
        // ordem no sentido da faixa; o líder de cada um é o próximo (em anel)
        lane.cars.sort((a, b) => (a.x - b.x) * lane.dir);
        lane.cars.forEach((c, i) => { c.leader = lane.cars[(i + 1) % lane.cars.length]; });
    });
    // estacionados junto às guias externas
    const parked = [];
    const inCanal = (x) => CANALS.some((c) => Math.abs(x - c.x) < c.width / 2 + 13);
    for (let i = 0; i < quality.parked; i++) {
        const north = i % 2 === 0;
        const x = X_WEST + 8 + rnd() * (span - 10);
        if (inCanal(x) || parked.some((p) => p.north === north && Math.abs(p.x - x) < 5.6)) continue;
        parked.push({ north, x, kind: Math.floor(rnd() * 3), color: rnd.pick(PAINT) });
    }

    const meshes = [...kinds, bus].map((k, ki) => {
        const n = cars.filter((c) => c.kind === ki).length + parked.filter((p) => p.kind === ki).length;
        const m = new THREE.InstancedMesh(k.geometry, mat, Math.max(1, n));
        m.count = n;
        m.castShadow = true;
        m.receiveShadow = true;
        m.frustumCulled = false;
        root.add(m);
        return m;
    });
    const counters = [0, 0, 0, 0];
    const mtx = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const pos = new THREE.Vector3();
    const one = new THREE.Vector3(1, 1, 1);
    const col = new THREE.Color();
    for (const p of parked) {
        const idx = counters[p.kind]++;
        const z = p.north ? ZONES.roadN[0] + 1.15 : ZONES.roadS[1] - 1.15;
        q.setFromAxisAngle(up, p.north ? -Math.PI / 2 : Math.PI / 2);
        mtx.compose(pos.set(p.x, ROAD_Y, z), q, one);
        meshes[p.kind].setMatrixAt(idx, mtx);
        meshes[p.kind].setColorAt(idx, col.set(p.color));
    }
    for (const c of cars) {
        c.index = counters[c.kind]++;
        c.len = c.kind === 3 ? bus.L : kinds[c.kind].L;
        c.wid = c.kind === 3 ? bus.W : kinds[c.kind].W;
        meshes[c.kind].setColorAt(c.index, col.set(c.color));
    }
    // pegadas sólidas (retângulos XZ) para a colisão do visitante; as dos carros andando
    // são atualizadas no lugar a cada quadro (sem alocação)
    const footprints = [];
    for (const p of parked) {
        const k = kinds[p.kind];
        const z = p.north ? ZONES.roadN[0] + 1.15 : ZONES.roadS[1] - 1.15;
        footprints.push({ x0: p.x - k.L / 2, x1: p.x + k.L / 2, z0: z - k.W / 2, z1: z + k.W / 2 });
    }
    for (const c of cars) footprints.push(c.rect);
    meshes.forEach((m) => { if (m.instanceColor) m.instanceColor.needsUpdate = true; });

    // faróis (brancos) e lanternas (vermelhas)
    const lampGeo = new THREE.PlaneGeometry(0.34, 0.14);
    const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2d0, transparent: true, opacity: 0, depthWrite: false });
    const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2414, transparent: true, opacity: 0, depthWrite: false });
    const heads = new THREE.InstancedMesh(lampGeo, headMat, cars.length * 2);
    const tails = new THREE.InstancedMesh(lampGeo, tailMat, cars.length * 2);
    heads.frustumCulled = tails.frustumCulled = false;
    heads.visible = tails.visible = false;
    root.add(heads, tails);
    const qf = new THREE.Quaternion();
    const qb = new THREE.Quaternion();
    let night = 0;

    // Parâmetros do IDM (m, s)
    const S0 = 2.0;
    const T_HEAD = 1.3;
    const B_COMF = 2.5;
    const B_MAX = 8;
    let onHonk = null;

    /** Vão (m) até o visitante se ele estiver na faixa à frente; Infinity se não. */
    function playerGap(c, player) {
        if (!player) return Infinity;
        const lane = c.lane;
        if (Math.abs(player.z - lane.z) > laneW / 2 + 0.55) return Infinity;
        const d = (player.x - c.x) * lane.dir;
        // à frente (inclui o visitante colado no para-choque) e dentro do alcance de frenagem
        if (d < c.len * 0.5 - 0.3 || d > 70) return Infinity;
        return d - c.len * 0.5 - 0.9;
    }

    function update(t, dt, ctx) {
        const player = ctx?.player;
        if (dt > 0) {
            for (let i = 0; i < cars.length; i++) {
                const c = cars[i];
                const L = c.leader;
                let gap = Infinity;
                let vl = 0;
                if (L !== c) {
                    let d = (L.x - c.x) * c.lane.dir;
                    if (d < 0) d += span;
                    gap = d - (c.len + L.len) * 0.5;
                    vl = L.v;
                }
                const pg = playerGap(c, player);
                let byPlayer = false;
                if (pg < gap) { gap = pg; vl = 0; byPlayer = true; }
                let acc;
                if (gap <= 0.05) {
                    acc = -B_MAX * 4; // encostado: para
                } else {
                    const ss = S0 + Math.max(0, c.v * T_HEAD + (c.v * (c.v - vl)) / (2 * Math.sqrt(c.amax * B_COMF)));
                    acc = c.amax * (1 - (c.v / c.v0) ** 4 - (ss / gap) ** 2);
                }
                acc = Math.max(-B_MAX, acc);
                c.v = Math.max(0, c.v + acc * dt);
                // nunca avança além do vão livre
                const step = Math.min(c.v * dt, Math.max(0, gap));
                if (step < c.v * dt) c.v = step / dt;
                c.x += c.lane.dir * step;
                if (c.x > X_EAST - 3) c.x -= span;
                if (c.x < X_WEST + 3) c.x += span;
                c.honkT = Math.max(0, c.honkT - dt);
                if (byPlayer && acc < -3.5 && c.v > 2 && c.honkT <= 0) {
                    c.honkT = 6;
                    onHonk?.(c.x, c.lane.z);
                }
            }
        }
        for (let i = 0; i < cars.length; i++) {
            const c = cars[i];
            const yaw = c.lane.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
            q.setFromAxisAngle(up, yaw);
            mtx.compose(pos.set(c.x, ROAD_Y, c.lane.z), q, one);
            meshes[c.kind].setMatrixAt(c.index, mtx);
            const r = c.rect;
            r.x0 = c.x - c.len * 0.5;
            r.x1 = c.x + c.len * 0.5;
            r.z0 = c.lane.z - c.wid * 0.5;
            r.z1 = c.lane.z + c.wid * 0.5;
            if (night > 0.05) {
                const k = c.kind === 3 ? bus : kinds[c.kind];
                const half = k.L / 2 + 0.02;
                const y = ROAD_Y + (c.kind === 3 ? 0.75 : 0.62);
                qf.setFromAxisAngle(up, yaw);
                qb.setFromAxisAngle(up, yaw + Math.PI);
                for (let s = 0; s < 2; s++) {
                    const side = (s ? 1 : -1) * (k.W / 2 - 0.3);
                    mtx.compose(pos.set(c.x + c.lane.dir * half, y, c.lane.z + side), qf, one);
                    heads.setMatrixAt(i * 2 + s, mtx);
                    mtx.compose(pos.set(c.x - c.lane.dir * half, y + 0.08, c.lane.z + side), qb, one);
                    tails.setMatrixAt(i * 2 + s, mtx);
                }
            }
        }
        for (let i = 0; i < meshes.length; i++) meshes[i].instanceMatrix.needsUpdate = true;
        if (night > 0.05) {
            heads.instanceMatrix.needsUpdate = true;
            tails.instanceMatrix.needsUpdate = true;
        }
    }
    update(0, 0);

    return {
        root,
        update,
        footprints,
        /** cb(x, z) quando um carro freia forte por causa do visitante */
        set onHonk(cb) { onHonk = cb; },
        setNight(k) {
            night = k;
            heads.visible = tails.visible = k > 0.05;
            headMat.opacity = Math.min(1, k * 1.4);
            tailMat.opacity = Math.min(1, k * 1.4);
            // em HDR: valores > 1 alimentam o bloom
            headMat.color.setRGB(6, 5.4, 4.2);
            tailMat.color.setRGB(5, 0.4, 0.2);
        }
    };
}
