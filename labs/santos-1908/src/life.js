/**
 * life — gente e bichos do cais (H01, H03, P03, P04):
 *   estivadores carregando sacas de 60 kg no ombro em fila (porta do armazém → pilha),
 *   carroças de duas rodas puxadas por mula, com carroceiro a pé,
 *   transeuntes e fiscais de paletó e chapéu, gaivotas.
 *
 * Marcha: fase φ = distância · 2π / 1,4 m (dois passos de 0,7 m por ciclo), então
 * os pés não "patinam" qualquer que seja a velocidade.
 * Mula: pares diagonais de patas em oposição (trote/passo): pata = sin(φ + {0, π}).
 * Gaivotas: 1 InstancedMesh; a batida de asa é feita no vertex shader
 *   Δy = |envergadura|^1.3 · sin(7·t + fase_i) · 0,3.
 */
import * as THREE from 'three';
import { createHuman, poseHuman, SKIN_TONES } from '../../shared/gfx/human.js';
import { seeded, paint, lerp } from '../../shared/gfx/core.js';
import { LAYOUT, kasatoPose } from './config.js';
import { Batch, box, bar, P } from './kit.js';

const Y = LAYOUT.quayY;
const STEP = (Math.PI * 2) / 1.4;

/** Loft simples: anéis { c, ra, rb } no plano definido por a/b. */
function loft(rings, segs, a, b) {
    const pos = [];
    const idx = [];
    for (const r of rings) {
        for (let i = 0; i < segs; i++) {
            const t = (i / segs) * Math.PI * 2;
            pos.push(
                r.c[0] + a.x * Math.cos(t) * r.ra + b.x * Math.sin(t) * r.rb,
                r.c[1] + a.y * Math.cos(t) * r.ra + b.y * Math.sin(t) * r.rb,
                r.c[2] + a.z * Math.cos(t) * r.ra + b.z * Math.sin(t) * r.rb
            );
        }
    }
    for (let r = 0; r < rings.length - 1; r++) {
        for (let i = 0; i < segs; i++) {
            const j = (i + 1) % segs;
            const p0 = r * segs + i;
            const p1 = r * segs + j;
            idx.push(p0, p0 + segs, p1, p1, p0 + segs, p1 + segs);
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
}
const AX = new THREE.Vector3(1, 0, 0);
const AY = new THREE.Vector3(0, 1, 0);
const AZ = new THREE.Vector3(0, 0, 1);

/** Mula (1,40 m na cernelha), frente = +Z. Corpo estático + 4 patas articuladas no ombro/anca. */
function buildMule(mats, color = 0x5a4636) {
    const group = new THREE.Group();
    const bt = new Batch(mats);
    const body = loft([
        { c: [0, 1.2, -0.9], ra: 0.04, rb: 0.05 }, { c: [0, 1.25, -0.8], ra: 0.23, rb: 0.26 }, { c: [0, 1.25, -0.5], ra: 0.3, rb: 0.33 },
        { c: [0, 1.2, 0], ra: 0.32, rb: 0.36 }, { c: [0, 1.22, 0.45], ra: 0.3, rb: 0.37 }, { c: [0, 1.3, 0.7], ra: 0.23, rb: 0.32 },
        { c: [0, 1.52, 0.9], ra: 0.15, rb: 0.22 }, { c: [0, 1.78, 1.04], ra: 0.115, rb: 0.17 }, { c: [0, 1.93, 1.14], ra: 0.11, rb: 0.145 },
        { c: [0, 1.9, 1.3], ra: 0.1, rb: 0.13 }, { c: [0, 1.74, 1.52], ra: 0.07, rb: 0.085 }, { c: [0, 1.69, 1.6], ra: 0.035, rb: 0.045 }
    ], 10, AX, AY);
    bt.add('paint', body, color);
    for (const s of [1, -1]) {
        bt.add('paint', new THREE.ConeGeometry(0.05, 0.3, 5).translate(s * 0.08, 2.16, 1.1), color);
        bt.add('paint', new THREE.SphereGeometry(0.022, 5, 4).translate(s * 0.095, 1.9, 1.34), 0x0e0e10);
    }
    bt.add('paint', box(0.04, 0.36, 0.5, 0, 1.62, 0.82).rotateX(0), 0x2a2018); // crina
    bt.add('paint', bar(P(0, 1.22, -0.88), P(0, 0.55, -1.02), 0.045, 5, 0.025), 0x2a2018); // cauda
    bt.add('paint', new THREE.TorusGeometry(0.31, 0.06, 6, 12).rotateX(0.35).translate(0, 1.34, 0.62), 0x1c1612); // coalheira
    bt.add('paint', box(0.66, 0.07, 0.1, 0, 1.3, 0.1), 0x1c1612);
    group.add(bt.build(null, { name: 'mule' }));
    const legGeo = loft([
        { c: [0, 0.06, 0], ra: 0.11, rb: 0.13 }, { c: [0, -0.3, 0], ra: 0.085, rb: 0.1 }, { c: [0, -0.52, 0.01], ra: 0.055, rb: 0.06 },
        { c: [0, -0.86, 0], ra: 0.045, rb: 0.05 }, { c: [0, -0.95, 0.01], ra: 0.06, rb: 0.065 }, { c: [0, -1.02, 0.02], ra: 0.062, rb: 0.07 }
    ], 7, AX, AZ);
    paint(legGeo, color);
    const legs = [];
    for (const [x, z, ph] of [[0.17, 0.58, 0], [-0.17, 0.58, Math.PI], [0.17, -0.6, Math.PI], [-0.17, -0.6, 0]]) {
        const m = new THREE.Mesh(legGeo, mats.paint);
        m.position.set(x, 1.03, z);
        m.castShadow = true;
        group.add(m);
        legs.push({ m, ph });
    }
    return { group, legs };
}

function buildCart(mats) {
    const group = new THREE.Group();
    const bt = new Batch(mats);
    bt.add('wood', box(1.5, 0.12, 2.7, 0, 0.98, -0.2), 0x8a6a44, 1.4);
    for (const s of [1, -1]) {
        bt.add('wood', box(0.06, 0.42, 2.7, s * 0.75, 1.1, -0.2), 0x7a5a38, 1.4);
        bt.add('wood', bar(P(s * 0.5, 1.0, 1.1), P(s * 0.46, 1.24, 3.9), 0.045, 5), 0x6a4e30);
    }
    bt.add('wood', box(1.5, 0.42, 0.06, 0, 1.1, -1.55), 0x7a5a38, 1.4);
    for (let k = 0; k < 14; k++) {
        const g = new THREE.SphereGeometry(0.5, 7, 5).scale(0.76, 0.3, 0.52);
        g.rotateY(Math.PI / 2);
        g.translate(((k % 2) - 0.5) * 0.6, 1.2 + Math.floor(k / 6) * 0.28, -1.2 + (Math.floor(k / 2) % 3) * 0.86);
        bt.add('burlap', g, 0xffffff);
    }
    group.add(bt.build(null, { name: 'cart' }));
    // rodas raiadas (um eixo, gira em X)
    const wb = new Batch(mats);
    for (const s of [0.92, -0.92]) {
        wb.add('paint', new THREE.TorusGeometry(0.72, 0.05, 5, 22).rotateY(Math.PI / 2).translate(s, 0, 0), 0x3a2c1e);
        wb.add('paint', new THREE.CylinderGeometry(0.12, 0.12, 0.26, 8).rotateZ(Math.PI / 2).translate(s, 0, 0), 0x2a2018);
        for (let i = 0; i < 12; i++) {
            wb.add('paint', new THREE.BoxGeometry(0.045, 0.7, 0.045).translate(0, 0.36, 0).rotateX((i / 12) * Math.PI * 2).translate(s, 0, 0), 0x7a5a38);
        }
    }
    wb.add('paint', new THREE.CylinderGeometry(0.05, 0.05, 1.9, 6).rotateZ(Math.PI / 2), 0x2a2018);
    const wheels = wb.build(null, { name: 'cartwheels' }).children[0];
    wheels.position.set(0, 0.76, -0.2);
    group.add(wheels);
    const mule = buildMule(mats, [0x5a4636, 0x3e3028, 0x6e5a48][Math.floor(Math.random() * 3)]);
    mule.group.position.set(0, 0, 2.5);
    group.add(mule.group);
    return { group, wheels, mule };
}

/** Polilinha fechada/aberta com amostragem por distância. */
function makePath(pts, closed = false) {
    const p = pts.map((q) => new THREE.Vector3(q[0], q[1] ?? Y, q[2]));
    if (closed) p.push(p[0].clone());
    const cum = [0];
    for (let i = 1; i < p.length; i++) cum.push(cum[i - 1] + p[i].distanceTo(p[i - 1]));
    const total = cum[cum.length - 1];
    return {
        total,
        at(s, out, dirOut) {
            let d = ((s % total) + total) % total;
            let i = 1;
            while (i < cum.length - 1 && cum[i] < d) i++;
            const u = (d - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
            out.lerpVectors(p[i - 1], p[i], u);
            if (dirOut) dirOut.subVectors(p[i], p[i - 1]);
            return i - 1;
        }
    };
}

export function createLife(ctx, world) {
    const { scene, mats, quality } = ctx;
    const rnd = seeded(1908 * 3);
    const tmp = new THREE.Vector3();
    const dir = new THREE.Vector3();

    // ---------- estivadores ----------
    const sackGeo = new THREE.SphereGeometry(0.5, 8, 6).scale(0.8, 0.3, 0.52);
    const loops = [
        // armazém 13 → pilha junto ao guindaste (visto no travelling do cais)
        makePath([[24.6, Y, -64.5], [20, Y, -66.5], [10.2, Y, -68.6], [9.6, Y, -70.4]]),
        // armazém 16 → costado do vapor que carrega café
        makePath([[24.6, Y, 157.5], [18, Y, 154], [9.8, Y, 151.4], [9.2, Y, 149.6]]),
        // armazém 14 → pilha diante do Kasato
        makePath([[24.6, Y, 9.5], [19, Y, 8], [10.5, Y, 6.2], [9.6, Y, 5]])
    ];
    const workers = [];
    for (let i = 0; i < quality.workers; i++) {
        const bare = rnd() < 0.45;
        const h = createHuman({
            height: 1.64 + rnd() * 0.14, build: 1.02 + rnd() * 0.2,
            skin: SKIN_TONES[2 + Math.floor(rnd() * 5)], hair: 0x120c08, hairStyle: rnd() < 0.3 ? 'bald' : 'short',
            top: bare ? 'none' : rnd() < 0.5 ? 'tank' : 'long', topColor: [0xd8d0bc, 0xb8b09a, 0xc8b89a, 0x9a9a8a][Math.floor(rnd() * 4)],
            bottom: 'rolled', bottomColor: [0x6a6252, 0x4a4a48, 0x7a6a50, 0x3e4450][Math.floor(rnd() * 4)],
            shoes: 'barefoot', hat: rnd() < 0.4 ? 'straw' : rnd() < 0.3 ? 'cap' : 'none', hatColor: 0xcdb98a
        });
        const sack = new THREE.Mesh(sackGeo, mats.burlap);
        if (!sackGeo.attributes.color) paint(sackGeo, 0xffffff);
        sack.position.set(-0.19, 0.32, -0.02);
        sack.rotation.set(0.1, 0.3, 0.12);
        sack.castShadow = true;
        h.bones.chest.add(sack);
        scene.add(h.object);
        const loop = loops[i % loops.length];
        // N03: com 60 kg no ombro o passo encurta (~0,95–1,1 m/s); de volta, vazio, ~1,3–1,45 m/s.
        const carry = 0.95 + rnd() * 0.15;
        const back = 1.3 + rnd() * 0.15;
        const cycle = loop.total / carry + loop.total / back;
        workers.push({ h, sack, loop, carry, back, cycle, off: (Math.floor(i / loops.length) / Math.ceil(quality.workers / loops.length)) * cycle + rnd() * 1.5 });
    }

    // ---------- transeuntes e fiscais ----------
    const SUITS = [0x2a2a30, 0x3a342c, 0x4a4438, 0x23262e, 0x5a5346];
    const gent = () => createHuman({
        height: 1.66 + rnd() * 0.12, build: 0.95 + rnd() * 0.25, skin: SKIN_TONES[Math.floor(rnd() * 5)], hair: 0x241710,
        top: 'jacket', bottom: 'pants', topColor: SUITS[Math.floor(rnd() * SUITS.length)], bottomColor: SUITS[Math.floor(rnd() * SUITS.length)],
        shoes: 'boot', shoeColor: 0x15120f, hat: rnd() < 0.5 ? 'fedora' : rnd() < 0.6 ? 'bowler' : 'straw', hatColor: [0x2a2a2e, 0x4a4238, 0xd8c9a0][Math.floor(rnd() * 3)]
    });
    const lady = () => {
        const c = [0x6a4a5a, 0x3e4a5e, 0xd8d0c0, 0x5a6a52, 0x7a5a44][Math.floor(rnd() * 5)];
        return createHuman({
            female: true, height: 1.56 + rnd() * 0.1, skin: SKIN_TONES[Math.floor(rnd() * 4)], hair: 0x241710, hairStyle: 'bun',
            top: 'long', bottom: 'kimono', topColor: c, accent: c, shoes: 'boot', shoeColor: 0x15120f,
            hat: rnd() < 0.6 ? 'straw' : 'none', hatColor: 0xe6dcc0
        });
    };
    const walkers = [];
    for (let i = 0; i < quality.walkers; i++) {
        const h = rnd() < 0.3 ? lady() : gent();
        const street = i % 2 === 0;
        const x = street ? 59.2 + rnd() * 3 : 17.4 + rnd() * 1.8;
        const z0 = street ? -260 + rnd() * 560 : -160 + rnd() * 380;
        scene.add(h.object);
        walkers.push({ h, x, z0, span: 50 + rnd() * 70, speed: 1.05 + rnd() * 0.35, off: rnd() * 100 });
    }
    const idlers = [];
    for (const [x, z, ry, mode] of [[5.2, -47.5, -2.2, 'talk'], [6.3, -46.2, 2.6, 'idle'], [4.4, -45.4, 1.9, 'idle'], [15.4, 3.5, -1.5, 'idle'], [57, 278, -1.6, 'idle'], [57.6, 281.5, -1.2, 'talk']]) {
        const h = gent();
        h.object.position.set(x, z > 250 ? Y + 0.95 : Y, z);
        h.object.rotation.y = ry;
        scene.add(h.object);
        idlers.push({ h, mode, ph: rnd() * 30 });
    }

    // ---------- carroças ----------
    const route = makePath([[17.2, Y, -180], [17.2, Y, 178], [20, Y, 185], [50.6, Y, 185], [53, Y, 178], [53, Y, -178], [50.6, Y, -185], [20, Y, -185]], true);
    const carts = [];
    for (let i = 0; i < quality.carts; i++) {
        const c = buildCart(mats);
        const d = createHuman({
            height: 1.68, top: 'long', bottom: 'pants', topColor: 0xb8b09a, bottomColor: 0x4a443a, shoes: 'boot', shoeColor: 0x2a2018,
            hat: 'straw', hatColor: 0xcdb98a, skin: SKIN_TONES[3 + (i % 3)], hair: 0x120c08
        });
        scene.add(c.group, d.object);
        carts.push({ ...c, driver: d, off: (i / quality.carts) * route.total + rnd() * 20, speed: 1.25, yaw: 0 });
    }

    // ---------- gaivotas ----------
    const gullGeo = (() => {
        const pos = [];
        const col = [];
        const wing = [];
        const body = new THREE.SphereGeometry(1, 8, 6).scale(0.075, 0.07, 0.24).toNonIndexed();
        const bp = body.attributes.position;
        for (let i = 0; i < bp.count; i++) {
            pos.push(bp.getX(i), bp.getY(i), bp.getZ(i));
            col.push(0.96, 0.96, 0.94);
            wing.push(0);
        }
        const span = [[0.05, 0.16, 0.0], [0.34, 0.15, 0.02], [0.62, 0.1, 0.07], [0.82, 0.03, 0.14]];
        for (const s of [1, -1]) {
            for (let i = 0; i < span.length - 1; i++) {
                const [x0, c0, sw0] = span[i];
                const [x1, c1, sw1] = span[i + 1];
                const q = [[x0, c0 * 0.5 - sw0], [x1, c1 * 0.5 - sw1], [x1, -c1 * 0.5 - sw1], [x0, -c0 * 0.5 - sw0]];
                for (const k of [0, 1, 2, 0, 2, 3]) {
                    pos.push(s * q[k][0], 0.02, q[k][1]);
                    const tip = q[k][0] > 0.7 ? 0.25 : 0.82;
                    col.push(tip, tip, tip * 1.02);
                    wing.push(q[k][0]);
                }
            }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        g.setAttribute('aWing', new THREE.Float32BufferAttribute(wing, 1));
        g.computeVertexNormals();
        return g;
    })();
    const N = quality.gulls;
    const phases = new Float32Array(N);
    const birds = [];
    for (let i = 0; i < N; i++) {
        phases[i] = rnd() * 6.28;
        birds.push({ r: 14 + rnd() * 46, h: 12 + rnd() * 24, sp: (0.16 + rnd() * 0.14) * (rnd() < 0.5 ? 1 : -1), ph: rnd() * 6.28, anchor: i % 3, s: 0.9 + rnd() * 0.5 });
    }
    gullGeo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));
    const gullU = { uGullTime: { value: 0 } };
    const gullMat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.8 });
    gullMat.onBeforeCompile = (sh) => {
        sh.uniforms.uGullTime = gullU.uGullTime;
        sh.vertexShader = sh.vertexShader
            .replace('#include <common>', '#include <common>\nattribute float aWing;\nattribute float aPhase;\nuniform float uGullTime;')
            .replace('#include <begin_vertex>', `#include <begin_vertex>
                float flap = sin(uGullTime * 7.0 + aPhase) * (0.55 + 0.45 * sin(uGullTime * 0.7 + aPhase * 3.0));
                transformed.y += pow(aWing, 1.3) * flap * 0.3 + aWing * 0.06;`);
    };
    const gulls = new THREE.InstancedMesh(gullGeo, gullMat, N);
    gulls.frustumCulled = false;
    gulls.castShadow = false;
    scene.add(gulls);
    const gm = new THREE.Matrix4();
    const gq = new THREE.Quaternion();
    const ge = new THREE.Euler();
    const gs = new THREE.Vector3();
    const pose = {};

    let frame = 0;
    void world;
    void lerp;
    return {
        update(t, dt, camera) {
            frame++;
            const cam = camera.position;
            // corta por distância: além de `d` a pessoa não é posada nem desenhada
            const near = (o, d) => (o.visible = cam.distanceToSquared(o.position) < d * d * 1.3);

            for (const w of workers) {
                const L = w.loop.total;
                const k = (t + w.off) % w.cycle;          // fase no ciclo ida+volta (s)
                const tOut = L / w.carry;
                const out = k < tOut;
                const d = out ? k * w.carry : L - (k - tOut) * w.back;
                const s = out ? d : L * 2 - d;            // distância andada no ciclo (fase da marcha)
                w.loop.at(Math.min(d, L - 0.01), tmp, dir);
                const o = w.h.object;
                o.position.copy(tmp);
                o.rotation.y = Math.atan2(dir.x, dir.z) + (out ? 0 : Math.PI);
                w.sack.visible = out;
                if (near(o, 190)) poseHuman(w.h, out ? 'carry' : 'walk', s * STEP * 0.92, 0.95);
            }

            for (const w of walkers) {
                const s = t * w.speed + w.off;
                const k = s % (w.span * 2);
                const fwd = k < w.span;
                const o = w.h.object;
                o.position.set(w.x, Y, w.z0 + (fwd ? k : w.span * 2 - k));
                o.rotation.y = fwd ? 0 : Math.PI;
                if (near(o, 150)) poseHuman(w.h, 'walk', s * STEP, 0.9);
            }
            for (const i of idlers) if (near(i.h.object, 150) && (frame & 1) === 0) poseHuman(i.h, i.mode, t + i.ph, 1);

            for (const c of carts) {
                const s = t * c.speed + c.off;
                route.at(s, tmp, dir);
                const target = Math.atan2(dir.x, dir.z);
                let dy = target - c.yaw;
                dy = Math.atan2(Math.sin(dy), Math.cos(dy));
                c.yaw += dy * Math.min(1, dt > 0 ? dt * 2.2 : 1);
                c.group.position.copy(tmp);
                c.group.rotation.y = c.yaw;
                c.wheels.rotation.x = s / 0.76;
                const ph = s * 3.4;
                for (const l of c.mule.legs) l.m.rotation.x = Math.sin(ph + l.ph) * 0.42;
                c.mule.group.position.y = Math.abs(Math.sin(ph)) * 0.025;
                // carroceiro a pé, ao lado da cabeça da mula
                const o = c.driver.object;
                o.position.set(tmp.x + Math.cos(c.yaw) * 0.95 + Math.sin(c.yaw) * 3.4, Y, tmp.z - Math.sin(c.yaw) * 0.95 + Math.cos(c.yaw) * 3.4);
                o.rotation.y = c.yaw;
                if (near(o, 150)) poseHuman(c.driver, 'walk', s * STEP, 0.85);
            }

            // gaivotas: círculos em torno da popa do Kasato, do cais e do Valongo
            kasatoPose(t, pose);
            gullU.uGullTime.value = t;
            for (let i = 0; i < N; i++) {
                const b = birds[i];
                const ax = b.anchor === 0 ? pose.x - 10 : b.anchor === 1 ? 6 : -40;
                const az = b.anchor === 0 ? pose.z - 60 : b.anchor === 1 ? 20 + (i % 5) * 40 : 160;
                const a = t * b.sp + b.ph;
                const x = ax + Math.cos(a) * b.r;
                const z = az + Math.sin(a) * b.r * 0.7;
                const y = b.h + Math.sin(a * 2.3 + b.ph) * 2.5;
                ge.set(0, -a + (b.sp > 0 ? 0 : Math.PI), Math.sign(b.sp) * -0.35);
                gq.setFromEuler(ge);
                gs.setScalar(b.s);
                gm.compose(tmp.set(x, y, z), gq, gs);
                gulls.setMatrixAt(i, gm);
            }
            gulls.instanceMatrix.needsUpdate = true;
        }
    };
}
