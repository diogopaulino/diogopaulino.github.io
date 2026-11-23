/**
 * rail — trem da São Paulo Railway no Valongo (P08, V01–V02).
 *
 * Locomotiva-tênder inglesa 2-6-0 (tipologia SPR ~1900): caldeira, caixa de fumaça,
 * domo de latão, cabine, 3 eixos motores com bielas de acoplamento.
 * Cinemática: ângulo das rodas θ = s / r (s = distância rodada, r = raio);
 * a biela liga os pinos de manivela, então translada em círculo de raio r_m sem girar:
 *   p = centro + r_m · (cos θ, sin θ);  o lado oposto vai defasado de 90° (quartejamento).
 * O trem fica parado na plataforma e parte rumo ao porto em t = 150 s.
 */
import * as THREE from 'three';
import { createParticles } from '../../shared/gfx/particles.js';
import { smoothstep } from '../../shared/gfx/core.js';
import { LAYOUT } from './config.js';
import { Batch, box, rbox, cyl, bar, lathe, P, instances } from './kit.js';

const Y = LAYOUT.quayY;
const X = LAYOUT.streetX;

function wheelGeo(r, spokes = 10) {
    const parts = [];
    const rim = new THREE.TorusGeometry(r - 0.05, 0.06, 5, 20);
    parts.push(rim);
    const hub = new THREE.CylinderGeometry(0.16, 0.16, 0.2, 10).rotateX(Math.PI / 2);
    parts.push(hub);
    for (let i = 0; i < spokes; i++) {
        const a = (i / spokes) * Math.PI * 2;
        const g = new THREE.BoxGeometry(0.05, r - 0.1, 0.05).translate(0, (r - 0.1) / 2, 0).rotateZ(a);
        parts.push(g);
    }
    return parts;
}

/** Um eixo: 2 rodas (em x = ±0.8) fundidas, girando em torno de X. */
function axle(mats, r, color = 0x1c1e22, spokes = 10) {
    const bt = new Batch(mats);
    for (const s of [0.8, -0.8]) {
        for (const g of wheelGeo(r, spokes)) bt.add('paint', g.rotateY(Math.PI / 2).translate(s, 0, 0), color);
    }
    bt.add('paint', new THREE.CylinderGeometry(0.07, 0.07, 1.6, 6).rotateZ(Math.PI / 2), 0x2a2c30);
    const g = bt.build(null, { name: 'axle' });
    return g.children[0];
}

export function createRail(ctx, world) {
    const { scene, mats } = ctx;
    const train = new THREE.Group();
    const bt = new Batch(mats);
    const black = 0x16181b;
    const green = 0x1f3a2c;
    const red = 0x8a2a22;
    const rw = 0.78; // raio da roda motriz
    const ay = rw + 0.02;

    // ---------- locomotiva (frente = −Z, rumo ao porto) ----------
    const boilerY = 2.25;
    const boiler = new THREE.CylinderGeometry(0.88, 0.88, 5.2, 18).rotateX(Math.PI / 2).translate(0, boilerY, -1.6);
    bt.add('paint', boiler, green);
    for (const z of [-3.6, -2.4, -1.2, 0]) bt.add('brass', new THREE.TorusGeometry(0.89, 0.025, 4, 20).translate(0, boilerY, z), 0xc8a050);
    bt.add('paint', new THREE.CylinderGeometry(0.95, 0.95, 1.1, 18).rotateX(Math.PI / 2).translate(0, boilerY, -4.7), black);
    bt.add('paint', new THREE.CylinderGeometry(0.8, 0.8, 0.08, 18).rotateX(Math.PI / 2).translate(0, boilerY, -5.28), 0x24262a);
    bt.add('paint', lathe([[0.26, 0], [0.2, 0.25], [0.2, 1.2], [0.3, 1.36], [0.31, 1.5], [0.24, 1.5]], 12, 0, boilerY + 0.85, -4.7), black);
    bt.add('brass', lathe([[0.34, 0], [0.34, 0.45], [0.26, 0.72], [0, 0.82]], 12, 0, boilerY + 0.82, -2.2), 0xc8a050);
    bt.add('paint', lathe([[0.26, 0], [0.26, 0.3], [0.16, 0.46], [0, 0.5]], 10, 0, boilerY + 0.84, -0.6), green);
    // cabine
    bt.add('paint', rbox(2.5, 2.1, 1.7, 0, 1.55, 1.5, 0.05), green);
    bt.add('paint', new THREE.CylinderGeometry(2.6, 2.6, 2.3, 10, 1, true, -0.52, 1.04).rotateX(Math.PI / 2).rotateZ(Math.PI).translate(0, 1.3, 1.6), 0x2a2c30);
    for (const s of [1, -1]) {
        bt.add('glass', box(0.03, 0.6, 0.7, s * 1.27, 2.8, 1.4), 0x121a22);
        bt.add('glass', box(0.5, 0.5, 0.03, s * 0.75, 2.9, 0.64), 0x121a22);
        // passadiço e cilindros
        bt.add('paint', box(0.45, 0.08, 6.2, s * 1.2, 1.5, -2.0), black);
        bt.add('paint', new THREE.CylinderGeometry(0.3, 0.3, 1.0, 10).rotateX(Math.PI / 2).translate(s * 1.08, ay + 0.05, -4.3), black);
        bt.add('brass', new THREE.CylinderGeometry(0.31, 0.31, 0.06, 10).rotateX(Math.PI / 2).translate(s * 1.08, ay + 0.05, -4.83), 0xc8a050);
        // para-choques
        bt.add('paint', lathe([[0.07, 0], [0.07, 0.4], [0.2, 0.42], [0.2, 0.5], [0, 0.5]], 10).rotateX(-Math.PI / 2).translate(s * 0.86, 1.05, -5.65), 0x2a2c30);
    }
    bt.add('paint', box(2.6, 0.4, 0.16, 0, 0.86, -5.6), red);
    bt.add('paint', box(1.7, 0.5, 7.4, 0, 0.75, -1.4), black); // longarinas
    bt.add('glow', new THREE.SphereGeometry(0.16, 8, 6).translate(0, boilerY + 0.4, -5.36), 0xffffff);
    // tênder com carvão
    bt.add('paint', rbox(2.5, 1.5, 4.2, 0, 1.0, 5.3, 0.05), green);
    const coal = new THREE.SphereGeometry(1, 8, 5).scale(1.05, 0.34, 1.8).translate(0, 2.5, 5.3);
    bt.add('paint', coal, 0x0e0e10);
    bt.add('paint', box(1.6, 0.4, 4.4, 0, 0.75, 5.3), black);
    train.add(bt.build(null, { name: 'loco' }));

    const wheels = [];
    for (const z of [-2.6, -0.95, 0.7]) {
        const m = axle(mats, rw, red, 12);
        m.position.set(0, ay, z);
        train.add(m);
        wheels.push({ m, r: rw });
    }
    for (const z of [-4.5, 4.2, 6.3]) {
        const m = axle(mats, 0.5, black, 8);
        m.position.set(0, 0.52, z);
        train.add(m);
        wheels.push({ m, r: 0.5 });
    }
    // bielas de acoplamento (uma por lado)
    const rods = [1, -1].map((s) => {
        const b = new Batch(mats);
        b.add('paint', box(0.06, 0.12, 3.5, s * 0.98, -0.06, -0.95), 0xb8bcc0);
        for (const z of [-2.6, -0.95, 0.7]) b.add('paint', new THREE.CylinderGeometry(0.09, 0.09, 0.1, 8).rotateZ(Math.PI / 2).translate(s * 0.98, 0, z), 0x8a8e92);
        const m = b.build(null, { name: 'rod' }).children[0];
        train.add(m);
        return { m, s };
    });

    // ---------- vagões fechados de café + prancha com sacas ----------
    const wagons = new Batch(mats);
    const wl = 6.4;
    for (let i = 0; i < 6; i++) {
        const z = 9.6 + i * (wl + 1.0) + wl / 2;
        wagons.add('paint', box(1.5, 0.3, wl + 0.6, 0, 0.72, z), black);
        if (i < 5) {
            wagons.add('wood', rbox(2.5, 2.2, wl, 0, 1.02, z, 0.04), [0x7a4a34, 0x6a4a3a, 0x80543a][i % 3], 1.5);
            wagons.add('zinc', new THREE.CylinderGeometry(2.3, 2.3, wl + 0.2, 10, 1, true, -0.58, 1.16).rotateX(Math.PI / 2).rotateZ(Math.PI).translate(0, 1.1, z), 0x8a8e90);
            for (const s of [1, -1]) {
                wagons.add('wood', box(0.06, 1.9, 1.6, s * 1.27, 1.12, z), 0x5a3626, 1.5);
                wagons.add('iron', box(0.05, 0.06, 3.2, s * 1.3, 3.05, z), 0x1c1e22);
            }
        } else {
            wagons.add('wood', box(2.5, 0.16, wl, 0, 1.0, z), 0x7a5a3c, 1.5);
            for (let k = 0; k < 30; k++) {
                const g = new THREE.SphereGeometry(0.5, 7, 5).scale(0.76, 0.3, 0.52);
                g.translate(((k % 3) - 1) * 0.78, 1.3 + Math.floor(k / 15) * 0.28, z - 2.3 + (Math.floor(k / 3) % 5) * 1.12);
                wagons.add('burlap', g, 0xffffff);
            }
        }
        for (const s of [1, -1]) {
            wagons.add('paint', lathe([[0.06, 0], [0.06, 0.3], [0.17, 0.32], [0.17, 0.4], [0, 0.4]], 8).rotateX(-Math.PI / 2).translate(s * 0.86, 0.95, z - wl / 2 - 0.3), 0x2a2c30);
        }
        for (const dz of [-1.9, 1.9]) {
            const m = axle(mats, 0.48, black, 8);
            m.position.set(0, 0.5, z + dz);
            train.add(m);
            wheels.push({ m, r: 0.48 });
        }
    }
    train.add(wagons.build(null, { name: 'wagons' }));
    train.position.set(X, Y, 0);
    scene.add(train);

    // dormentes aparentes no pátio do Valongo (fora do calçamento do cais)
    const sl = [];
    for (let z = 345; z < 500; z += 0.75) sl.push({ x: X, y: Y, z }, { x: X - 4.2, y: Y, z });
    scene.add(instances(box(2.4, 0.06, 0.24), mats.wood, sl, { cast: false, colors: [0x4a3a2c] }));

    const smoke = createParticles({
        count: 60, life: 5.5, spread: new THREE.Vector3(0.12, 0.05, 0.12),
        velocity: new THREE.Vector3(0.4, 4.2, 0.2), velocitySpread: new THREE.Vector3(0.5, 0.8, 0.5),
        turbulence: 1.4, size: [0.7, 8], color: 0xd8d4cc, opacity: 0.5
    });
    scene.add(smoke.mesh);
    const stack = new THREE.Vector3();

    /** posição da locomotiva ao longo da via: parada em z = 262 até t = 150, depois acelera. */
    /* Partida do trem (N04): locomotiva a vapor com vagões arranca devagar —
       aceleração sobe em rampa de 0 a A = 0,22 m/s² em J = 2 s (sem tranco), e o
       trem segue até v = 3,5 m/s (12,6 km/h, manobra de pátio).
       s(u) integrado em forma fechada: rampa u³·A/(6J); depois ½A·u² com ajuste. */
    const A = 0.22;
    const J = 2;
    const V = 3.5;
    const sJ = (A * J * J) / 6;            // distância no fim da rampa
    const vJ = (A * J) / 2;                // velocidade no fim da rampa
    const tV = J + (V - vJ) / A;           // instante em que chega a V
    const sV = sJ + vJ * (tV - J) + 0.5 * A * (tV - J) * (tV - J);
    const zAt = (t) => {
        const u = Math.max(0, t - 150);
        let s;
        if (u < J) s = (A * u * u * u) / (6 * J);
        else if (u < tV) s = sJ + vJ * (u - J) + 0.5 * A * (u - J) * (u - J);
        else s = sV + V * (u - tV);
        return 262 - s;
    };

    void world;
    void cyl;
    void bar;
    void P;
    return {
        update(t) {
            const z = zAt(t);
            train.position.z = z;
            const s = 262 - z;
            for (const w of wheels) w.m.rotation.x = -s / w.r;
            const th = -s / rw;
            const rm = 0.3;
            for (const r of rods) {
                const a = th + (r.s > 0 ? 0 : Math.PI / 2);
                r.m.position.set(0, ay + Math.sin(a) * rm, -Math.cos(a) * rm);
            }
            stack.set(X, Y + 4.7, z - 4.7);
            smoke.uniforms.uOrigin.value.copy(stack);
            const go = smoothstep(149, 153, t);
            smoke.uniforms.uVel.value.set(0.4, 3.2 + go * 2.5, 0.2 + go * 2.2);
            smoke.uniforms.uOpacity.value = 0.34 + go * 0.25;
            smoke.update(t);
        }
    };
}
