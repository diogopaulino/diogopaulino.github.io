/**
 * Cenário distante: morros de Santos, Serra do Mar, Guarujá (com a Fortaleza da Barra),
 * Ilha Porchat/São Vicente, Ilha Urubuqueçaba e o tráfego marítimo da baía
 * (cargueiros fundeados na barra, navio entrando no canal do porto, veleiros, lanchas).
 *
 * Relevo: soma de gaussianas (um morro = altura·e^(−d²/r²)) + fBm para quebrar a simetria —
 * morros arredondados de Mata Atlântica, não picos (mesma correção do dossiê do lab 1908).
 * Navios: casco lofteado por balizas (boca/pontal variam ao longo do comprimento), casario
 * à ré e carga em cores de vértice → 1 draw call por classe, instanciado.
 * Flutuação: y e inclinação seguem a altura analítica das ondas (ocean.heightAt).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { pbr } from '../../shared/gfx/textures.js';
import { fbm2, seeded, paint, smoothstep } from '../../shared/gfx/core.js';
import { LAND_Y } from './config.js';

const gauss = (x, z, cx, cz, h, r, rz = r) => h * Math.exp(-(((x - cx) / r) ** 2 + ((z - cz) / rz) ** 2));

function heightfield({ x0, x1, z0, z1, nx, nz, fn, uvScale = 80, skipBelow = null }) {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, nx, nz);
    g.rotateX(-Math.PI / 2);
    g.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
    const p = g.attributes.position;
    const uv = g.attributes.uv;
    const col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
        const x = p.getX(i);
        const z = p.getZ(i);
        const y = fn(x, z);
        p.setY(i, y);
        uv.setXY(i, x / uvScale, z / uvScale);
        // base mais escura/rochosa, cumes mais claros
        const k = 0.72 + smoothstep(0, 140, y) * 0.4 + (fbm2(x * 0.01, z * 0.01, 2, 0, 5) - 0.5) * 0.25;
        const shore = smoothstep(4, 0.5, y);
        col[i * 3] = k * (1 + shore * 0.5);
        col[i * 3 + 1] = k * (1 + shore * 0.25);
        col[i * 3 + 2] = k * (1 + shore * 0.3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (skipBelow !== null) {
        // remove triângulos totalmente submersos/planos (economiza fill-rate)
        const idx = g.index.array;
        const keep = [];
        for (let i = 0; i < idx.length; i += 3) {
            if (p.getY(idx[i]) > skipBelow || p.getY(idx[i + 1]) > skipBelow || p.getY(idx[i + 2]) > skipBelow) {
                keep.push(idx[i], idx[i + 1], idx[i + 2]);
            }
        }
        g.setIndex(keep);
    }
    g.computeVertexNormals();
    return g;
}

/** Casco genérico de cargueiro: balizas elípticas-retangulares ao longo de Z (proa em +Z). */
function shipHull(L, beam, depth, draft) {
    const st = 14;
    const seg = 10;
    const pos = [];
    const idx = [];
    for (let i = 0; i <= st; i++) {
        const t = i / st;
        const z = (t - 0.5) * L;
        // boca: popa cheia, corpo paralelo, proa afilada
        const fore = smoothstep(1.0, 0.72, t);
        const aft = smoothstep(0.0, 0.12, t);
        const half = (beam / 2) * Math.min(1, 0.55 + 0.45 * aft) * (0.06 + 0.94 * Math.pow(fore, 0.75));
        const sheer = depth + (t > 0.85 ? (t - 0.85) * 22 : 0) + (t < 0.1 ? (0.1 - t) * 10 : 0);
        for (let s = 0; s <= seg; s++) {
            const a = (s / seg) * Math.PI; // de bombordo (convés) passando pela quilha até boreste
            const cx = Math.cos(a);
            const sx = Math.sin(a);
            const xx = Math.sign(cx) * Math.pow(Math.abs(cx), 0.45) * half;
            const yy = -draft + (1 - Math.pow(sx, 0.4)) * (sheer + draft);
            pos.push(xx, yy, z);
        }
    }
    const row = seg + 1;
    for (let i = 0; i < st; i++) {
        for (let s = 0; s < seg; s++) {
            const a = i * row + s;
            idx.push(a, a + row, a + 1, a + 1, a + row, a + row + 1);
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const p = g.attributes.position;
    const col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
        const y = p.getY(i);
        const red = y < 1.2;
        col[i * 3] = red ? 0.42 : 0.07;
        col[i * 3 + 1] = red ? 0.1 : 0.09;
        col[i * 3 + 2] = red ? 0.08 : 0.13;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g.toNonIndexed();
}

const cbox = (w, h, d, x, y, z, color) => {
    const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
    g.translate(x, y + h / 2, z);
    g.deleteAttribute('uv');
    return paint(g, color);
};

function cargoShip(kind, seed) {
    const rnd = seeded(seed);
    const L = kind === 'container' ? 230 : 190;
    const beam = kind === 'container' ? 32 : 30;
    const depth = kind === 'container' ? 9 : 7.5;
    const parts = [shipHull(L, beam, depth, 6)];
    parts.push(cbox(beam * 0.92, 0.4, L * 0.86, 0, depth - 0.2, -L * 0.02, 0x5a2f24)); // convés
    // casario à ré
    const hz = -L * 0.36;
    parts.push(cbox(beam * 0.8, 9, 16, 0, depth, hz, 0xeeeae2));
    parts.push(cbox(beam * 0.66, 6, 13, 0, depth + 9, hz, 0xf4f1ea));
    parts.push(cbox(beam * 0.98, 2.6, 8, 0, depth + 15, hz + 1.5, 0xf4f1ea)); // passadiço
    parts.push(cbox(beam * 0.8, 1.1, 0.3, 0, depth + 16, hz + 5.6, 0x1c2a36)); // janelas do passadiço
    parts.push(cbox(4.6, 8, 6, 0, depth + 15, hz - 8, kind === 'container' ? 0x1d4f8a : 0xb8862b)); // chaminé
    parts.push(cbox(0.5, 12, 0.5, 0, depth + 17.6, hz + 1, 0xd8d8d8)); // mastro radar
    if (kind === 'container') {
        const cols = [0xb23a2e, 0x2c5e9e, 0x3f8a52, 0xd89a2a, 0x8a8f96, 0x1f6a78, 0xc7c2b8, 0x7a3a8a];
        for (let bay = 0; bay < 11; bay++) {
            const z = -L * 0.24 + bay * 14.5;
            const taper = z > L * 0.3 ? 0.7 : 1;
            const rows = Math.floor(8 * taper);
            for (let r = 0; r < rows; r++) {
                const tiers = 2 + Math.floor(rnd() * 4);
                for (let t = 0; t < tiers; t++) {
                    parts.push(cbox(2.5, 2.7, 12.4, (r - (rows - 1) / 2) * 2.8, depth + 0.3 + t * 2.75, z, rnd.pick(cols)));
                }
            }
        }
    } else {
        for (let h = 0; h < 5; h++) {
            const z = -L * 0.22 + h * 24;
            parts.push(cbox(beam * 0.62, 1.6, 17, 0, depth + 0.2, z, 0x9a4a32)); // tampas de porão
            if (h < 4) {
                parts.push(cbox(1.6, 15, 1.6, 0, depth + 0.2, z + 12, 0xe8c63a)); // guindaste
                parts.push(cbox(1.1, 1.1, 15, 0, depth + 13.5, z + 5, 0xe8c63a));
            }
        }
    }
    parts.push(cbox(0.6, 9, 0.6, 0, depth + 3, L * 0.44, 0xd8d8d8)); // mastro de proa
    return { geometry: mergeGeometries(parts), L, beam, depth };
}

function sailboat() {
    const parts = [];
    const hull = shipHull(9, 2.8, 1.0, 0.6);
    const col = hull.attributes.color;
    for (let i = 0; i < col.count; i++) col.setXYZ(i, 0.92, 0.92, 0.9);
    parts.push(hull);
    parts.push(cbox(1.5, 0.6, 3, 0, 1.0, -0.6, 0xe8e6e0));
    parts.push(cbox(0.1, 11, 0.1, 0, 1.0, 0.6, 0xc8c8c8));
    const sail = (pts, color) => {
        const g = new THREE.BufferGeometry();
        const v = [];
        for (const tri of [[0, 1, 2], [0, 2, 1]]) for (const i of tri) v.push(...pts[i]);
        g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
        g.computeVertexNormals();
        return paint(g, color);
    };
    parts.push(sail([[0.15, 1.6, 0.5], [0.5, 1.7, -3.6], [0.1, 11.6, 0.55]], 0xfafaf4)); // grande
    parts.push(sail([[0.0, 1.3, 4.3], [-0.5, 1.5, 0.8], [0.05, 10.2, 0.7]], 0xf2f0e6));  // genoa
    return mergeGeometries(parts);
}

export function createScenery(quality) {
    const root = new THREE.Group();
    root.name = 'scenery';
    const canopy = pbr('canopy', { vertexColors: true, envMapIntensity: 0.5, normalScale: 1.4 });

    // ---------- morros de Santos (atrás da cidade) ----------
    const cityHills = (x, z) => {
        let y = gauss(x, z, -190, -820, 168, 190, 150) + gauss(x, z, -390, -700, 138, 170)
            + gauss(x, z, -30, -980, 152, 230, 170) + gauss(x, z, -560, -900, 185, 250, 200)
            + gauss(x, z, 190, -1150, 118, 240) + gauss(x, z, -760, -620, 120, 180);
        y *= 0.8 + fbm2(x * 0.006, z * 0.006, 4, 0, 3) * 0.45;
        return y + LAND_Y - 0.5;
    };
    const hills = new THREE.Mesh(heightfield({
        x0: -1300, x1: 800, z0: -1500, z1: -470, nx: 84, nz: 46, fn: cityHills, uvScale: 70, skipBelow: LAND_Y + 1.5
    }), canopy);
    root.add(hills);

    // ---------- Serra do Mar ----------
    const serra = (x, z) => {
        const ridge = Math.exp(-(((z + 3250) / 520) ** 2));
        const n = fbm2(x * 0.0011, z * 0.0011, 5, 0, 11);
        return ridge * (520 + n * 430) - 30;
    };
    root.add(new THREE.Mesh(heightfield({
        x0: -5200, x1: 5200, z0: -4300, z1: -2300, nx: 110, nz: 18, fn: serra, uvScale: 260, skipBelow: 0
    }), canopy));

    // ---------- Guarujá, do outro lado do canal do porto ----------
    const guaruja = (x, z) => {
        let y = gauss(x, z, 640, 150, 92, 120, 150) + gauss(x, z, 760, -260, 150, 240)
            + gauss(x, z, 1000, 260, 190, 300) + gauss(x, z, 1350, -150, 230, 380)
            + gauss(x, z, 900, -760, 170, 300) + gauss(x, z, 780, 590, 58, 90);
        y *= 0.75 + fbm2(x * 0.007, z * 0.007, 4, 0, 23) * 0.5;
        const plain = smoothstep(470, 500, x) * smoothstep(420, 330, z) * 3.2;
        return Math.max(y, plain) - 1.2;
    };
    root.add(new THREE.Mesh(heightfield({
        x0: 440, x1: 1800, z0: -1100, z1: 760, nx: 70, nz: 76, fn: guaruja, uvScale: 70, skipBelow: -0.4
    }), canopy));

    // ---------- Ilha Porchat e São Vicente (oeste) ----------
    const west = (x, z) => {
        let y = gauss(x, z, -640, 96, 66, 92, 80) + gauss(x, z, -980, -300, 150, 260)
            + gauss(x, z, -1380, 130, 210, 360) + gauss(x, z, -820, 60, 30, 90);
        y *= 0.78 + fbm2(x * 0.008, z * 0.008, 4, 0, 41) * 0.5;
        const plain = smoothstep(120, 40, z + (x + 440) * 0.12) * 3.0;
        return Math.max(y, plain) - 1.0;
    };
    root.add(new THREE.Mesh(heightfield({
        x0: -1900, x1: -440, z0: -700, z1: 560, nx: 72, nz: 62, fn: west, uvScale: 70, skipBelow: -0.3
    }), canopy));

    // ---------- Ilha Urubuqueçaba ----------
    const urubu = (x, z) => {
        const y = gauss(x, z, -364, 124, 15, 12, 15) * (0.8 + fbm2(x * 0.09, z * 0.09, 3, 0, 9) * 0.5);
        return y - 0.9;
    };
    const island = new THREE.Mesh(heightfield({
        x0: -392, x1: -338, z0: 96, z1: 154, nx: 30, nz: 30, fn: urubu, uvScale: 16, skipBelow: -0.6
    }), canopy);
    island.castShadow = true;
    root.add(island);

    // ---------- Fortaleza de Santo Amaro da Barra Grande (Guarujá) ----------
    {
        const white = pbr('plaster', { color: 0xf2efe6 });
        const tile = pbr('roofTile');
        const g = new THREE.Group();
        const wall = new THREE.Mesh(new THREE.CylinderGeometry(30, 34, 9, 7, 1, false, 0.4), white);
        wall.position.y = 3.5;
        wall.scale.z = 0.62;
        const house = new THREE.Mesh(new THREE.BoxGeometry(26, 5, 9), white);
        house.position.set(-2, 10.5, -2);
        const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 7.2, 3.4, 4, 1), tile);
        roof.rotation.y = Math.PI / 4;
        roof.scale.set(2.6, 1, 0.92);
        roof.position.set(-2, 14.6, -2);
        g.add(wall, house, roof);
        g.position.set(532, 0, 128);
        g.rotation.y = -0.5;
        root.add(g);
    }

    // ---------- navios fundeados na barra ----------
    const shipMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.25 });
    const rnd = seeded(5150);
    const fleet = [];
    const classes = [cargoShip('container', 3), cargoShip('bulk', 8)];
    const perClass = Math.ceil(quality.ships / 2);
    const lightPos = [];
    classes.forEach((cls, ci) => {
        const mesh = new THREE.InstancedMesh(cls.geometry, shipMat, perClass + (ci === 0 ? 1 : 0));
        mesh.frustumCulled = false;
        for (let i = 0; i < perClass; i++) {
            const s = {
                mesh, index: i, cls,
                x: (rnd() - 0.5) * 3600 + (ci ? 180 : -120),
                z: 900 + rnd() * 2300,
                yaw: Math.PI * (0.35 + rnd() * 0.5) * rnd.sign(),
                speed: 0, phase: rnd() * 6
            };
            fleet.push(s);
            lightPos.push(s);
        }
        if (ci === 0) {
            // um porta-contêiner em movimento, entrando no canal do porto
            fleet.push({ mesh, index: perClass, cls, x: 428, z: 900, yaw: Math.PI, speed: 4.2, phase: 1, transit: true });
        }
        root.add(mesh);
    });

    // luzes de fundeio (só à noite)
    const lamp = new THREE.InstancedMesh(
        new THREE.SphereGeometry(1.4, 6, 5),
        new THREE.MeshBasicMaterial({ color: 0xffe2a8 }),
        fleet.length * 3
    );
    lamp.frustumCulled = false;
    lamp.visible = false;
    root.add(lamp);

    // ---------- veleiros ----------
    const sailMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide });
    const sailCount = quality.id === 'low' ? 4 : 9;
    const sails = new THREE.InstancedMesh(sailboat(), sailMat, sailCount);
    sails.frustumCulled = false;
    sails.castShadow = true;
    const boats = [];
    for (let i = 0; i < sailCount; i++) {
        boats.push({
            x: -300 + rnd() * 700, z: 230 + rnd() * 380,
            yaw: rnd() * Math.PI * 2, speed: 1.2 + rnd() * 1.6, turn: (rnd() - 0.5) * 0.02, phase: rnd() * 6
        });
    }
    root.add(sails);

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const v = new THREE.Vector3();
    const one = new THREE.Vector3(1, 1, 1);

    function update(t, dt, ocean, night) {
        for (const s of fleet) {
            if (s.transit) {
                s.z -= s.speed * dt;
                if (s.z < -520) s.z = 1500;
            }
            const roll = Math.sin(t * 0.35 + s.phase) * 0.012;
            const pitch = Math.sin(t * 0.27 + s.phase * 1.7) * 0.006;
            e.set(pitch, s.yaw, roll);
            q.setFromEuler(e);
            v.set(s.x, Math.sin(t * 0.4 + s.phase) * 0.25, s.z);
            m.compose(v, q, one);
            s.mesh.setMatrixAt(s.index, m);
            s.mesh.instanceMatrix.needsUpdate = true;
        }
        lamp.visible = night > 0.35;
        if (lamp.visible) {
            let li = 0;
            for (const s of fleet) {
                const fx = Math.sin(s.yaw);
                const fz = Math.cos(s.yaw);
                const L = s.cls.L;
                for (const [along, h] of [[-0.36, s.cls.depth + 22], [0.44, s.cls.depth + 13], [-0.36, s.cls.depth + 12]]) {
                    v.set(s.x + fx * along * L, h, s.z + fz * along * L);
                    m.compose(v, q.identity(), one);
                    lamp.setMatrixAt(li++, m);
                }
            }
            lamp.instanceMatrix.needsUpdate = true;
        }
        boats.forEach((b, i) => {
            b.yaw += b.turn * dt * 6;
            b.x += Math.sin(b.yaw) * b.speed * dt;
            b.z += Math.cos(b.yaw) * b.speed * dt;
            if (b.z < 205 || b.z > 640 || b.x < -360 || b.x > 420) b.yaw += Math.PI * 0.6 * dt;
            const y = ocean ? ocean.heightAt(b.x, b.z, t) * 0.6 : 0;
            e.set(Math.sin(t * 0.9 + b.phase) * 0.05, b.yaw, 0.16 + Math.sin(t * 0.7 + b.phase) * 0.05);
            q.setFromEuler(e);
            v.set(b.x, y, b.z);
            m.compose(v, q, one);
            sails.setMatrixAt(i, m);
        });
        sails.instanceMatrix.needsUpdate = true;
        const tr = fleet.find((s) => s.transit);
        return tr;
    }

    return { root, update, fleet };
}
