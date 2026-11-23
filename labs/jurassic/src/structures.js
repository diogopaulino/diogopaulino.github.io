/**
 * Jurassic — construções do parque: portal de entrada, cercas eletrificadas,
 * centro de visitantes, farol e placas das trilhas.
 *
 * Identidade própria da "Reserva Âmbar": emblema de amonite (espiral
 * logarítmica r = a·e^(b·θ)), painéis verde-petróleo com letras creme em
 * Barlow, concreto aparente e aço escuro. Nada aqui vem de franquia alguma.
 *
 * Geometria de verdade: paredes com espessura e vãos recortados (Shape com
 * furos), pilares em loft superelíptico, treliças e cabos em tubos, telhado
 * com costuras. Materiais PBR de `shared/gfx/assets.js` com UV em metros.
 */

import * as THREE from 'three';
import { WORLD } from './config.js?v=23';
import { applyWorldUV, smoothstep, seeded } from '../../shared/gfx/core.js';
import { pbrMaterial } from '../../shared/gfx/assets.js';
import { rbox, loft, column, pipe, lathe, merge, mesh, xf, canvasTexture, ringXZ } from './geo.js?v=23';

const TEAL = '#12403f';
const CREAM = '#efe6cf';
const AMBER = '#f0a43a';

/**
 * Emblema: amonite em espiral logarítmica dentro de um anel.
 *   r(θ) = r0·e^(k·θ), θ ∈ [0, 5,5π]; costelas radiais a cada 0,26 rad.
 */
function drawEmblem(ctx, cx, cy, R, color = CREAM) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineCap = 'round';
    ctx.lineWidth = R * 0.075;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();
    const k = 0.17;
    const max = Math.PI * 5.5;
    const r0 = (R * 0.74) / Math.exp(k * max);
    const pt = (th, f = 1) => {
        const r = r0 * Math.exp(k * th) * f;
        return [cx + Math.cos(th) * r, cy + Math.sin(th) * r];
    };
    ctx.lineWidth = R * 0.06;
    ctx.beginPath();
    for (let th = 0; th <= max; th += 0.05) {
        const [x, y] = pt(th);
        if (th === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.lineWidth = R * 0.028;
    for (let th = Math.PI * 1.5; th <= max; th += 0.26) {
        const [x0, y0] = pt(th, 0.97);
        const [x1, y1] = pt(th - Math.PI * 2 + 0.12, 1.06);
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
    }
    ctx.restore();
}

function panelTexture(w, h, draw) {
    return canvasTexture(w, h, (ctx) => {
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#16504d');
        g.addColorStop(1, TEAL);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        draw(ctx, w, h);
        // sujeira de chuva: escorridos verticais discretos
        const rnd = seeded(w + h);
        ctx.globalAlpha = 0.06;
        ctx.fillStyle = '#000';
        for (let i = 0; i < 60; i++) ctx.fillRect(rnd() * w, 0, 1 + rnd() * 3, h * (0.3 + rnd() * 0.7));
        ctx.globalAlpha = 1;
    });
}

const font = (px, weight = 700) => `${weight} ${px}px Barlow, "Helvetica Neue", Arial, sans-serif`;

function spaced(ctx, text, x, y, spacing) {
    // letterSpacing do canvas ainda não é universal: espaça letra a letra
    let w = 0;
    for (const ch of text) w += ctx.measureText(ch).width + spacing;
    let cx = x - (w - spacing) / 2;
    ctx.textAlign = 'left';
    for (const ch of text) {
        ctx.fillText(ch, cx, y);
        cx += ctx.measureText(ch).width + spacing;
    }
}

/** Concreto aparente: cor neutra própria + relevo e rugosidade do reboco fotogramétrico. */
function concreteMaterial() {
    const m = pbrMaterial('plastered_wall_04', { color: 0x8f8d86, normalScale: 1.6 });
    m.map = null;
    return m;
}

/** As texturas fotogramétricas de madeira e reboco são escuras: ganho na cor (pode passar de 1). */
function bright(m, k) {
    m.color.multiplyScalar(k);
    return m;
}

function makeMaterials(tier) {
    const steel = new THREE.MeshStandardMaterial({ color: 0x2c3a3c, metalness: 0.7, roughness: 0.48 });
    const galv = new THREE.MeshStandardMaterial({ color: 0x8d979a, metalness: 0.9, roughness: 0.38 });
    return {
        concrete: concreteMaterial(),
        plaster: bright(pbrMaterial('plastered_wall_04', { color: 0xf1ead8 }), 1.35),
        wood: bright(pbrMaterial('oak_wood_planks'), 1.25),
        darkWood: bright(pbrMaterial('weathered_brown_planks'), 1.7),
        rust: pbrMaterial('rusty_metal_02', { metal: true, color: 0xd0c8c0 }),
        steel,
        galv,
        ceramic: new THREE.MeshStandardMaterial({ color: 0x4a2a1c, roughness: 0.18, metalness: 0.0 }),
        glass: new THREE.MeshPhysicalMaterial({
            color: 0x9fc4c0, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.26, ior: 1.5,
            specularIntensity: 1, envMapIntensity: 1.4, side: THREE.DoubleSide, depthWrite: false
        }),
        beacon: new THREE.MeshStandardMaterial({ color: 0x2a1404, emissive: 0xff9a2a, emissiveIntensity: 2, roughness: 0.4 }),
        lamp: new THREE.MeshStandardMaterial({ color: 0xfff1cf, emissive: 0xffe2a8, emissiveIntensity: 0.2, roughness: 0.3 }),
        tier
    };
}

// ───────────────────────────── cerca eletrificada ─────────────────────────────

/**
 * Poste de concreto (seção em "H" suavizada: superelipse expoente 5, afinando
 * para cima), com sapata e capa metálica. Altura H; base em y = 0.
 */
function postGeometry(H) {
    const g = column([
        [-0.5, 0.34, 0.34, 4], [0.0, 0.34, 0.34, 4], [0.14, 0.3, 0.3, 4], [0.22, 0.2, 0.24, 5],
        [H * 0.5, 0.17, 0.2, 5], [H - 0.5, 0.14, 0.17, 5], [H - 0.42, 0.19, 0.22, 5], [H - 0.28, 0.19, 0.22, 5],
        [H - 0.18, 0.12, 0.14, 5], [H, 0.1, 0.12, 4]
    ], 16, { capStart: false });
    return applyWorldUV(g, 1.6);
}

/** Isolador de porcelana: três saias empilhadas, eixo em X. */
function insulatorGeometry() {
    const g = lathe([[0.0, 0], [0.03, 0], [0.06, 0.035], [0.03, 0.065], [0.06, 0.09], [0.03, 0.12], [0.02, 0.17], [0.0, 0.17]], 7);
    g.rotateZ(-Math.PI / 2);
    return g;
}

/**
 * Cerca ao longo de pontos {x, z}.
 * Cabos: catenária aproximada por parábola  y(u) = lerp(y0, y1, u) − 4·f·u·(1 − u),  flecha f = 0,12 m.
 * `broken`: índices de vãos sem cabos (os postes vizinhos tombam e os cabos pendem).
 */
function buildFence(world, M, pts, { height = 6.4, closed = false, broken = [], wires = 6, signs = 3, seed = 1 } = {}) {
    const group = new THREE.Group();
    group.name = 'fence';
    const rnd = seeded(seed * 97 + 3);
    const n = pts.length;
    const spans = closed ? n : n - 1;
    const isBroken = (i) => broken.includes(((i % n) + n) % n);
    const dummy = new THREE.Object3D();

    const posts = new THREE.InstancedMesh(postGeometry(height), M.concrete, n);
    const ins = new THREE.InstancedMesh(insulatorGeometry(), M.ceramic, n * wires);
    const lampGeo = merge([
        lathe([[0.0, 0], [0.09, 0], [0.1, 0.03], [0.07, 0.05], [0.07, 0.07]], 12),
        xf(lathe([[0.065, 0], [0.07, 0.1], [0.05, 0.17], [0.0, 0.19]], 12), 0, 0.07, 0)
    ]);
    const lampCount = Math.ceil(n / 3);
    const lamps = new THREE.InstancedMesh(lampGeo, M.beacon, lampCount);
    let li = 0;
    const tops = [];
    const wireY = (k) => 0.9 + (k / (wires - 1)) * (height - 1.6);

    for (let i = 0; i < n; i++) {
        const p = pts[i];
        const a = pts[(i - 1 + n) % n];
        const b = pts[(i + 1) % n];
        const yaw = Math.atan2(b.x - a.x, b.z - a.z);
        const y = world.heightAt(p.x, p.z);
        const lean = isBroken(i) ? 0.13 : isBroken(i - 1) ? -0.11 : (rnd() - 0.5) * 0.03;
        dummy.position.set(p.x, y, p.z);
        dummy.rotation.set(lean, yaw, (rnd() - 0.5) * 0.03, 'YXZ');
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        posts.setMatrixAt(i, dummy.matrix);
        // topo do poste no mundo (para cabos, faíscas e luzes)
        const top = [];
        for (let k = 0; k < wires; k++) {
            const v = new THREE.Vector3(-0.2, wireY(k), 0).applyMatrix4(dummy.matrix);
            top.push(v);
            const d2 = new THREE.Object3D();
            d2.position.copy(new THREE.Vector3(-0.17, wireY(k), 0).applyMatrix4(dummy.matrix));
            d2.rotation.set(lean, yaw + Math.PI, 0, 'YXZ');
            d2.updateMatrix();
            ins.setMatrixAt(i * wires + k, d2.matrix);
        }
        tops.push(top);
        if (i % 3 === 0 && li < lampCount) {
            dummy.position.copy(new THREE.Vector3(0, height, 0).applyMatrix4(dummy.matrix));
            dummy.updateMatrix();
            lamps.setMatrixAt(li++, dummy.matrix);
        }
        if (!closed || i % 2 === 0) world.addCollider(p.x, p.z, 0.5);
    }
    lamps.count = li;
    for (const m of [posts, ins, lamps]) {
        m.castShadow = m === posts;
        m.receiveShadow = true;
        m.instanceMatrix.needsUpdate = true;
        m.computeBoundingSphere();
        group.add(m);
    }

    // cabos
    const cables = [];
    const ring = (c, r, nx, nz) => {
        const out = [];
        for (let j = 0; j < 5; j++) {
            const t = (j / 5) * Math.PI * 2;
            out.push([c.x + Math.cos(t) * r * nx, c.y + Math.sin(t) * r, c.z + Math.cos(t) * r * nz]);
        }
        return out;
    };
    const c = new THREE.Vector3();
    const sparkPoints = [];
    for (let i = 0; i < spans; i++) {
        const A = tops[i];
        const B = tops[(i + 1) % n];
        const pa = pts[i];
        const pb = pts[(i + 1) % n];
        const len = Math.hypot(pb.x - pa.x, pb.z - pa.z) || 1;
        const nx = -(pb.z - pa.z) / len;
        const nz = (pb.x - pa.x) / len;
        if (isBroken(i)) {
            // cabos partidos: pendem de cada poste até o chão, na direção do vão
            for (let k = 1; k < wires; k += 1) {
                for (const [P, Q, s] of [[A[k], B[k], 1], [B[k], A[k], -1]]) {
                    if ((k + (s > 0 ? 0 : 1)) % 2) continue;
                    const reach = 0.9 + rnd() * 1.6;
                    const dir = new THREE.Vector3().subVectors(Q, P).setY(0).normalize();
                    const end = P.clone().addScaledVector(dir, reach);
                    end.y = world.heightAt(end.x, end.z) + 0.05 + rnd() * 0.8;
                    const mid = P.clone().addScaledVector(dir, reach * 0.35);
                    mid.y = P.y - (P.y - end.y) * 0.75;
                    cables.push(pipe([P, mid, end], 0.022, 5, 8));
                    if (k >= wires - 2) sparkPoints.push(end.clone());
                }
            }
            sparkPoints.push(A[wires - 1].clone(), B[wires - 1].clone());
            continue;
        }
        // os colisores acompanham o vão inteiro (o jipe não atravessa a cerca)
        const steps = Math.max(1, Math.round(len / 1.6));
        for (let s = 1; s < steps; s++) world.addCollider(pa.x + ((pb.x - pa.x) * s) / steps, pa.z + ((pb.z - pa.z) * s) / steps, 0.5);
        for (let k = 0; k < wires; k++) {
            const rings = [];
            const sag = 0.1 + rnd() * 0.06;
            for (let s = 0; s <= 6; s++) {
                const u = s / 6;
                c.lerpVectors(A[k], B[k], u);
                c.y -= 4 * sag * u * (1 - u);
                rings.push(ring(c, 0.022, nx, nz));
            }
            cables.push(loft(rings, { capStart: false, capEnd: false }));
        }
    }
    const cableMesh = mesh(merge(cables), M.galv, { cast: false, name: 'fenceCables' });
    group.add(cableMesh);

    // placas de alta tensão presas aos cabos
    if (signs) {
        const tex = canvasTexture(256, 192, (ctx, w, h) => {
            ctx.fillStyle = '#e9a52c';
            ctx.fillRect(0, 0, w, h);
            ctx.strokeStyle = '#1a1408';
            ctx.lineWidth = 10;
            ctx.strokeRect(9, 9, w - 18, h - 18);
            ctx.fillStyle = '#1a1408';
            // raio (símbolo genérico de eletricidade)
            ctx.beginPath();
            ctx.moveTo(60, 30);
            ctx.lineTo(34, 100);
            ctx.lineTo(56, 100);
            ctx.lineTo(42, 162);
            ctx.lineTo(92, 82);
            ctx.lineTo(68, 82);
            ctx.lineTo(86, 30);
            ctx.closePath();
            ctx.fill();
            ctx.font = font(34, 700);
            ctx.textAlign = 'left';
            ctx.fillText('ALTA', 108, 76);
            ctx.fillText('TENSÃO', 108, 114);
            ctx.font = font(24, 600);
            ctx.fillText('10 000 V', 108, 150);
        });
        const plate = new THREE.InstancedMesh(
            rbox(0.84, 0.63, 0.02, 0.008, 1),
            new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0.3 }),
            Math.ceil(spans / signs) + 1
        );
        let pi = 0;
        for (let i = 1; i < spans; i += signs) {
            if (isBroken(i)) continue;
            const a = tops[i][1];
            const b = tops[(i + 1) % n][1];
            dummy.position.lerpVectors(a, b, 0.5);
            dummy.position.y -= 0.3;
            dummy.rotation.set(0, Math.atan2(b.x - a.x, b.z - a.z) + Math.PI / 2, 0);
            dummy.updateMatrix();
            plate.setMatrixAt(pi++, dummy.matrix);
        }
        plate.count = pi;
        plate.instanceMatrix.needsUpdate = true;
        plate.computeBoundingSphere();
        group.add(plate);
    }
    return { group, sparkPoints, tops };
}

// ───────────────────────────────── portal ─────────────────────────────────────

function buildGate(world, M) {
    const G = WORLD.gate;
    const group = new THREE.Group();
    group.name = 'gate';
    const y0 = world.heightAt(G.x, G.z);
    group.position.set(G.x, y0, G.z);
    const SPAN = 5.4;
    const H = 8.8;

    // pilões de concreto, afinando e inclinando para dentro
    const pylons = [];
    for (const s of [-1, 1]) {
        const st = [];
        const add = (y, a, b, e) => st.push([y, a, b, e, s * (SPAN + 0.5 - (y / H) * 0.55), 0]);
        add(-0.8, 1.15, 1.4, 4);
        add(0.0, 1.15, 1.4, 4);
        add(0.45, 1.1, 1.35, 4);
        add(0.6, 0.92, 1.16, 5);
        add(H * 0.5, 0.78, 0.98, 5);
        add(H - 0.5, 0.62, 0.8, 5);
        add(H - 0.42, 0.72, 0.9, 5);
        add(H - 0.12, 0.72, 0.9, 5);
        add(H, 0.6, 0.78, 4);
        pylons.push(column(st, 28, { capStart: false }));
        world.addCollider(G.x + s * (SPAN + 0.45), G.z, 1.45);
    }
    group.add(mesh(applyWorldUV(merge(pylons), 2.2), M.concrete, { name: 'gatePylons' }));

    // treliça de aço entre os pilões
    const truss = [];
    const x0 = -SPAN + 0.1;
    const x1 = SPAN - 0.1;
    const yb = 6.75;
    const yt = 7.95;
    const zs = [-0.5, 0.5];
    for (const z of zs) {
        truss.push(pipe([[x0 - 0.6, yb, z], [x1 + 0.6, yb, z]], 0.075, 8));
        truss.push(pipe([[x0 - 0.6, yt, z], [x1 + 0.6, yt, z]], 0.075, 8));
    }
    const bays = 8;
    for (let i = 0; i <= bays; i++) {
        const x = x0 + ((x1 - x0) * i) / bays;
        for (const z of zs) {
            truss.push(pipe([[x, yb, z], [x, yt, z]], 0.04, 6));
            if (i < bays) {
                const xn = x0 + ((x1 - x0) * (i + 1)) / bays;
                truss.push(i % 2 ? pipe([[x, yt, z], [xn, yb, z]], 0.035, 6) : pipe([[x, yb, z], [xn, yt, z]], 0.035, 6));
            }
        }
        truss.push(pipe([[x, yt, -0.5], [x, yt, 0.5]], 0.035, 6));
        truss.push(pipe([[x, yb, -0.5], [x, yb, 0.5]], 0.035, 6));
    }
    // tirantes do painel
    for (const x of [-3.6, -1.2, 1.2, 3.6]) truss.push(pipe([[x, yb, 0.5], [x, 6.4, 0.62]], 0.03, 6));
    group.add(mesh(merge(truss), M.steel, { name: 'gateTruss' }));

    // painel de identidade (frente voltada para quem chega: +z)
    const tex = panelTexture(2048, 448, (ctx, w, h) => {
        drawEmblem(ctx, 232, h / 2, 150);
        ctx.fillStyle = CREAM;
        ctx.font = font(196, 700);
        ctx.textBaseline = 'alphabetic';
        spaced(ctx, 'RESERVA ÂMBAR', 1180, 248, 22);
        ctx.fillStyle = AMBER;
        ctx.fillRect(470, 290, 1420, 6);
        ctx.fillStyle = CREAM;
        ctx.font = font(62, 500);
        spaced(ctx, 'ILHA NORTE  ·  RECINTO 4  ·  SAFÁRI GUIADO', 1180, 378, 9);
    });
    const signMat = new THREE.MeshStandardMaterial({
        map: tex, roughness: 0.5, metalness: 0.2, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0
    });
    const board = mesh(rbox(8.6, 1.88, 0.12, 0.04, 2), [M.steel, M.steel, M.steel, M.steel, signMat, M.steel], { name: 'gateSign' });
    board.position.set(0, 5.5, 0.66);
    group.add(board);
    const frame = [];
    for (const [a, b] of [[[-4.36, 4.52], [4.36, 4.52]], [[-4.36, 6.48], [4.36, 6.48]], [[-4.36, 4.52], [-4.36, 6.48]], [[4.36, 4.52], [4.36, 6.48]]]) {
        frame.push(pipe([[a[0], a[1], 0.66], [b[0], b[1], 0.66]], 0.06, 8));
    }
    group.add(mesh(merge(frame), M.galv, { name: 'gateSignFrame' }));

    // folhas de correr: quadro tubular, barras e tela (alpha-test)
    const meshTex = canvasTexture(128, 128, (ctx, w, h) => {
        ctx.clearRect(0, 0, w, h);
        ctx.strokeStyle = '#c9d2d4';
        ctx.lineWidth = 7;
        for (let i = -1; i <= 4; i++) {
            ctx.beginPath();
            ctx.moveTo(i * 32, 0);
            ctx.lineTo(i * 32 + 128, 128);
            ctx.moveTo(i * 32 + 128, 0);
            ctx.lineTo(i * 32, 128);
            ctx.stroke();
        }
    }, { repeat: true });
    meshTex.repeat.set(16, 14);
    const screenMat = new THREE.MeshStandardMaterial({
        map: meshTex, alphaTest: 0.45, side: THREE.DoubleSide, metalness: 0.8, roughness: 0.45, color: 0x9aa3a6
    });
    const LW = SPAN - 0.35;
    const LH = 4.4;
    const leafGeo = () => {
        const parts = [
            pipe([[0, 0.25, 0], [LW, 0.25, 0], [LW, LH, 0], [0, LH, 0]], 0.065, 8, 48, true, 0.02),
            pipe([[0, LH * 0.5, 0], [LW, LH * 0.5, 0]], 0.045, 8),
            pipe([[0, 0.25, 0], [LW, LH, 0]], 0.04, 6),
            xf(rbox(0.5, 0.5, 0.16, 0.03, 2), LW * 0.5, LH * 0.5, 0.06)
        ];
        for (let i = 1; i < 6; i++) parts.push(pipe([[(LW * i) / 6, 0.25, 0], [(LW * i) / 6, LH, 0]], 0.028, 6));
        for (const x of [0.5, LW - 0.5]) parts.push(xf(lathe([[0, -0.05], [0.13, -0.05], [0.15, 0], [0.13, 0.05], [0, 0.05]], 14), x, 0.14, 0, Math.PI / 2));
        return merge(parts);
    };
    const leaves = [];
    for (const s of [-1, 1]) {
        const leaf = new THREE.Group();
        leaf.add(mesh(leafGeo(), M.steel));
        const screen = mesh(new THREE.PlaneGeometry(LW - 0.1, LH - 0.3), screenMat, { cast: false });
        screen.position.set(LW / 2, LH / 2 + 0.12, 0);
        leaf.add(screen);
        leaf.position.set(s > 0 ? 0 : -LW, 0, -1.25);
        leaf.userData.closed = leaf.position.x;
        leaf.userData.open = leaf.position.x + s * (LW + 0.3);
        group.add(leaf);
        leaves.push(leaf);
    }
    group.add(mesh(xf(rbox(SPAN * 4, 0.09, 0.16, 0.02, 1), 0, 0.05, -1.25), M.galv, { cast: false, name: 'gateRail' }));

    // refletores sobre o painel
    const heads = [];
    for (const x of [-2.6, 2.6]) {
        heads.push(pipe([[x, yt, 0.5], [x, yt + 0.25, 0.9], [x, yt - 0.1, 1.5]], 0.03, 6, 10));
        heads.push(xf(lathe([[0.0, 0], [0.07, 0], [0.16, 0.2], [0.17, 0.24], [0.0, 0.24]], 14), x, yt - 0.1, 1.5, Math.PI * 0.82));
    }
    group.add(mesh(merge(heads), M.steel, { cast: false }));
    const light = new THREE.SpotLight(0xffe2b0, 0, 16, 0.9, 0.7, 1.4);
    light.position.set(0, yt + 0.2, 2.2);
    light.target.position.set(0, 4.6, 0.4);
    group.add(light, light.target);

    // colisor das folhas fechadas (sai quando o portão abre)
    const blockers = [];
    for (let x = -SPAN + 1; x <= SPAN - 1; x += 1.4) blockers.push(world.addCollider(G.x + x, G.z - 1.25, 0.8));

    return { group, leaves, light, signMat, blockers };
}

// ─────────────────────────── centro de visitantes ─────────────────────────────

function mapTexture() {
    return panelTexture(1024, 640, (ctx, w, h) => {
        const s = 2.25;
        const X = (x) => w * 0.5 + x * s;
        const Z = (z) => h * 0.5 - (z - 10) * s;
        // ilha
        ctx.fillStyle = '#2b6a55';
        ctx.beginPath();
        for (let i = 0; i <= 96; i++) {
            const th = (i / 96) * Math.PI * 2;
            const R = WORLD.islandRadius + 9 * Math.sin(3 * th + 1) + 5 * Math.sin(7 * th + 2.3) - 8;
            const x = X(Math.cos(th) * R);
            const y = Z(Math.sin(th) * R);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.fill();
        ctx.fillStyle = '#7fc6c8';
        ctx.beginPath();
        ctx.ellipse(X(WORLD.lake.x), Z(WORLD.lake.z), 22 * s, 20 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = CREAM;
        ctx.lineWidth = 5;
        ctx.setLineDash([12, 8]);
        const path = (pts, close) => {
            ctx.beginPath();
            pts.forEach(([x, z], i) => (i ? ctx.lineTo(X(x), Z(z)) : ctx.moveTo(X(x), Z(z))));
            if (close) ctx.closePath();
            ctx.stroke();
        };
        path(WORLD.loop, true);
        path(WORLD.spurGate);
        path(WORLD.spurTower);
        path(WORLD.spurRidge);
        ctx.setLineDash([]);
        ctx.fillStyle = AMBER;
        const P = WORLD;
        for (const [x, z] of [[P.lake.x + 24, P.lake.z], [P.paddock.x, P.paddock.z], [P.meadow.x, P.meadow.z], [P.ridge.x, P.ridge.z], [P.raptors.x, P.raptors.z], [P.tower.x, P.tower.z]]) {
            ctx.beginPath();
            ctx.arc(X(x), Z(z), 11, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.fillStyle = CREAM;
        ctx.font = font(44, 700);
        ctx.textAlign = 'left';
        ctx.fillText('CIRCUITO DO DIA', 36, 62);
        ctx.font = font(26, 500);
        ctx.fillText('seis espécies · não desça do veículo', 36, 98);
        drawEmblem(ctx, w - 84, 78, 48);
    });
}

function buildCenter(world, M) {
    const C = WORLD.center;
    const group = new THREE.Group();
    group.name = 'visitorCenter';
    const y0 = world.heightAt(C.x, C.z) - 0.05;
    group.position.set(C.x, y0, C.z);
    group.rotation.y = Math.PI / 2; // frente (+z local) voltada para a trilha (+x)
    const W = 16;
    const D = 9;
    const F = 0.55; // cota do piso
    const HB = 3.3; // pé-direito nos fundos
    const HF = 4.9; // pé-direito na frente

    // embasamento, varanda e degraus
    const base = [
        xf(rbox(W + 2.4, 1.6, D + 5.2, 0.06, 2), 0, F - 0.8, 1.4),
        xf(rbox(5, 0.2, 0.7, 0.04, 1), 0, F - 0.16, D / 2 + 3.25 + 1.1),
        xf(rbox(5.6, 0.2, 0.7, 0.04, 1), 0, F - 0.34, D / 2 + 3.25 + 1.7),
        xf(rbox(6.2, 0.2, 0.7, 0.04, 1), 0, F - 0.52, D / 2 + 3.25 + 2.3)
    ];
    group.add(mesh(applyWorldUV(merge(base), 2.4), M.concrete, { name: 'centerBase' }));
    // deque de madeira sobre o embasamento
    group.add(mesh(applyWorldUV(xf(rbox(W + 2.2, 0.06, D + 5.0, 0.01, 1), 0, F + 0.02, 1.4), 2), M.wood, { cast: false, name: 'centerDeck' }));

    // paredes com espessura: fundos (com faixa de janelas altas recortadas) e laterais em trapézio
    const wall = (shape, depth) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 4 });
    const back = new THREE.Shape();
    back.moveTo(-W / 2, 0);
    back.lineTo(W / 2, 0);
    back.lineTo(W / 2, HB);
    back.lineTo(-W / 2, HB);
    back.closePath();
    const glassPanes = [];
    for (let i = 0; i < 5; i++) {
        const cx = -W / 2 + 1.9 + i * 3.05;
        const hole = new THREE.Path();
        hole.moveTo(cx - 1.1, 2.1);
        hole.lineTo(cx + 1.1, 2.1);
        hole.lineTo(cx + 1.1, 2.85);
        hole.lineTo(cx - 1.1, 2.85);
        hole.closePath();
        back.holes.push(hole);
        glassPanes.push(xf(new THREE.PlaneGeometry(2.2, 0.75), cx, F + 2.475, -D / 2 + 0.15));
    }
    const side = new THREE.Shape();
    side.moveTo(-D / 2, 0);
    side.lineTo(D / 2, 0);
    side.lineTo(D / 2, HF);
    side.lineTo(-D / 2, HB);
    side.closePath();
    const sideHole = new THREE.Path();
    sideHole.moveTo(-1.4, 1.0);
    sideHole.lineTo(1.8, 1.0);
    sideHole.lineTo(1.8, 2.9);
    sideHole.lineTo(-1.4, 2.9);
    sideHole.closePath();
    side.holes.push(sideHole);
    const walls = [xf(wall(back, 0.3), 0, F, -D / 2)];
    for (const s of [-1, 1]) {
        walls.push(xf(wall(side, 0.3), s > 0 ? W / 2 : -W / 2 + 0.3, F, 0, 0, -Math.PI / 2));
        glassPanes.push(xf(new THREE.PlaneGeometry(3.2, 1.9), s * (W / 2 - 0.15), F + 1.95, -0.2, 0, Math.PI / 2));
    }
    group.add(mesh(applyWorldUV(merge(walls), 2.4), M.plaster, { name: 'centerWalls' }));

    // fachada de vidro com montantes de aço; vão da porta no centro
    const mull = [];
    const fz = D / 2 - 0.1;
    const hAt = () => HF - 0.12;
    for (let i = 0; i <= 8; i++) {
        const x = -W / 2 + 0.1 + (i * (W - 0.2)) / 8;
        mull.push(xf(rbox(0.1, hAt(), 0.16, 0.02, 1), x, F + hAt() / 2, fz));
        if (i < 8 && i !== 3 && i !== 4) glassPanes.push(xf(new THREE.PlaneGeometry((W - 0.2) / 8 - 0.1, hAt() - 0.2), x + (W - 0.2) / 16, F + hAt() / 2, fz));
    }
    mull.push(xf(rbox(W, 0.14, 0.18, 0.02, 1), 0, F + HF - 0.2, fz));
    mull.push(xf(rbox(W, 0.1, 0.16, 0.02, 1), 0, F + 2.7, fz));
    for (const s of [-1, 1]) mull.push(xf(rbox(3.9, 0.12, 0.18, 0.02, 1), s * 6, F + 0.06, fz));
    group.add(mesh(merge(mull), M.steel, { name: 'centerMullions' }));
    // bandeira envidraçada sobre a porta + folhas abertas
    glassPanes.push(xf(new THREE.PlaneGeometry(3.9, HF - 2.95), 0, F + 2.75 + (HF - 2.95) / 2, fz));
    for (const s of [-1, 1]) glassPanes.push(xf(new THREE.PlaneGeometry(1.85, 2.6), s * 1.98 + s * 0.75, F + 1.35, fz + 0.72, 0, s * 1.2));
    group.add(mesh(merge(glassPanes), M.glass, { cast: false, receive: false, name: 'centerGlass' }));

    // brise de ripas de madeira num terço da fachada
    const slats = [];
    for (let i = 0; i < 26; i++) slats.push(xf(rbox(0.07, HF - 0.5, 0.16, 0.015, 1), -W / 2 + 0.3 + i * 0.2, F + (HF - 0.5) / 2, fz + 0.5));
    slats.push(xf(rbox(5.3, 0.1, 0.08, 0.02, 1), -W / 2 + 2.8, F + 0.4, fz + 0.42));
    slats.push(xf(rbox(5.3, 0.1, 0.08, 0.02, 1), -W / 2 + 2.8, F + HF - 0.9, fz + 0.42));
    group.add(mesh(applyWorldUV(merge(slats), 1.2), M.darkWood, { name: 'centerSlats' }));

    // cobertura de uma água com beiral largo, rufos e costuras
    const pitch = Math.atan2(HF - HB, D);
    const roofD = D + 6.4;
    const roof = [xf(rbox(W + 3, 0.26, roofD, 0.05, 2), 0, 0, 0)];
    for (let i = 0; i <= 30; i++) roof.push(xf(rbox(0.06, 0.07, roofD - 0.2, 0.01, 1), -W / 2 - 1.3 + (i * (W + 2.6)) / 30, 0.16, 0));
    const roofGeo = xf(merge(roof), 0, F + (HB + HF) / 2 + 0.36 + Math.tan(pitch) * 0.9, 1.75, -pitch);
    group.add(mesh(roofGeo, M.steel, { name: 'centerRoof' }));
    // forro de madeira sob o beiral
    group.add(mesh(
        applyWorldUV(xf(rbox(W + 2.6, 0.05, roofD - 0.4, 0.01, 1), 0, F + (HB + HF) / 2 + 0.2 + Math.tan(pitch) * 0.9, 1.75, -pitch), 1.6),
        M.wood, { cast: false, name: 'centerSoffit' }
    ));

    // pilares de madeira da varanda com sapata de aço e mão-francesa
    const cols = [];
    const shoes = [];
    const vz = D / 2 + 3.3;
    const colH = HF + Math.tan(pitch) * 3.4 + 0.25;
    for (let i = 0; i < 6; i++) {
        const x = -W / 2 - 0.6 + (i * (W + 1.2)) / 5;
        cols.push(xf(rbox(0.24, colH, 0.24, 0.03, 2), x, F + colH / 2, vz));
        cols.push(xf(rbox(0.14, 1.9, 0.14, 0.02, 1), x, F + colH - 0.75, vz - 0.62, 0.72));
        shoes.push(xf(rbox(0.34, 0.3, 0.34, 0.02, 1), x, F + 0.15, vz));
        world.addCollider(C.x + vz, C.z - x, 0.5);
    }
    group.add(mesh(applyWorldUV(merge(cols), 1.4), M.darkWood, { name: 'centerColumns' }));
    group.add(mesh(merge(shoes), M.steel, { cast: false }));

    // guarda-corpo da varanda (tubos), aberto na escada
    const rail = [];
    for (const [a, b] of [[-W / 2 - 1.1, -3.2], [3.2, W / 2 + 1.1]]) {
        for (const y of [F + 0.55, F + 1.0]) rail.push(pipe([[a, y, vz + 0.42], [b, y, vz + 0.42]], 0.03, 6));
        for (let x = a; x <= b + 1e-3; x += (b - a) / 5) rail.push(pipe([[x, F, vz + 0.42], [x, F + 1.0, vz + 0.42]], 0.028, 6));
    }
    group.add(mesh(merge(rail), M.galv, { cast: false, name: 'centerRail' }));

    // interior: piso, balcão, mapa do circuito
    const inside = [xf(rbox(5.2, 1.05, 0.9, 0.06, 2), 2.5, F + 0.55, -1.6), xf(rbox(5.5, 0.07, 1.1, 0.02, 1), 2.5, F + 1.1, -1.6)];
    group.add(mesh(applyWorldUV(merge(inside), 1.2), M.darkWood, { name: 'centerDesk' }));
    const map = mesh(new THREE.PlaneGeometry(6.4, 4), new THREE.MeshStandardMaterial({
        map: mapTexture(), roughness: 0.6, emissive: 0xffffff, emissiveIntensity: 0
    }), { cast: false, name: 'centerMap' });
    map.material.emissiveMap = map.material.map;
    map.position.set(-2.2, F + 1.75, -D / 2 + 0.32);
    map.scale.setScalar(0.42);
    group.add(map);

    // letreiro na testeira
    const tex = panelTexture(1536, 192, (ctx, w, h) => {
        drawEmblem(ctx, 96, h / 2, 62);
        ctx.fillStyle = CREAM;
        ctx.font = font(92, 600);
        ctx.textBaseline = 'middle';
        spaced(ctx, 'CENTRO DE VISITANTES', w / 2 + 70, h / 2 + 6, 12);
    });
    const signMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, metalness: 0.2, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0 });
    const sign = mesh(rbox(6.4, 0.8, 0.08, 0.03, 1), [M.steel, M.steel, M.steel, M.steel, signMat, M.steel], { cast: false });
    sign.position.set(0, F + 3.3, fz + 0.2);
    group.add(sign);

    // luz quente do salão
    const light = new THREE.PointLight(0xffc98a, 0, 22, 1.6);
    light.position.set(0, F + 3.2, 0.4);
    group.add(light);

    // colisores do prédio (círculos ao longo da planta, em coordenadas do mundo)
    for (let a = -W / 2; a <= W / 2; a += 2.6) {
        for (const b of [-D / 2 + 1, 0.5, D / 2]) world.addCollider(C.x + b, C.z - a, 2.1);
    }

    // caixotes na varanda: caixas chanfradas com a textura de tábuas (os modelos fotogramétricos de
    // assets.js somavam ~500 mil triângulos sem LOD, visíveis da ilha inteira)
    const crates = [];
    for (const [x, z, sz, ry] of [[7.4, vz - 0.9, 0.7, 0.3], [6.5, vz - 1.4, 0.6, -0.5], [7.1, vz - 1.1, 0.5, 0.9]]) {
        const y = sz === 0.5 ? F + 0.05 + 0.7 + 0.25 : F + 0.05 + sz / 2;
        crates.push(xf(rbox(sz, sz, sz, 0.02, 1), x, y, z, 0, ry));
    }
    group.add(mesh(applyWorldUV(merge(crates), 0.9), M.darkWood, { name: 'centerCrates' }));
    const ready = Promise.resolve();

    return { group, light, signMat, mapMat: map.material, ready };
}

// ─────────────────────────────────── farol ────────────────────────────────────

function buildTower(world, M) {
    const T = WORLD.tower;
    const group = new THREE.Group();
    group.name = 'lighthouse';
    const y0 = world.heightAt(T.x, T.z) - 0.4;
    group.position.set(T.x, y0, T.z);
    const H = 19.4;
    const rAt = (y) => 2.75 - (y / H) * 1.05 + Math.max(0, 1 - y / 2.2) ** 2 * 0.75;

    // fuste rebocado com faixa pintada
    const prof = [];
    for (let i = 0; i <= 24; i++) {
        const y = (i / 24) * H;
        prof.push([rAt(y), y]);
    }
    const shaft = lathe([[rAt(0) + 0.5, -1.2], [rAt(0) + 0.5, 0], [rAt(0) + 0.42, 0.25], ...prof], 40);
    group.add(mesh(applyWorldUV(shaft, 2.6), M.plaster, { name: 'towerShaft' }));
    const band = lathe([[rAt(8.2) + 0.015, 8.2], [rAt(9.7) + 0.015, 9.7], [rAt(11.2) + 0.015, 11.2]], 40);
    group.add(mesh(band, new THREE.MeshStandardMaterial({ color: 0x1f5b58, roughness: 0.6 }), { cast: false, name: 'towerBand' }));

    // cornija, piso da galeria, base da lanterna e cúpula
    const stone = [
        lathe([[rAt(H), H - 0.5], [rAt(H) + 0.25, H - 0.2], [2.7, H], [2.75, H + 0.12], [2.7, H + 0.22], [1.55, H + 0.22],
            [1.55, H + 1.1], [1.62, H + 1.16], [1.62, H + 1.26], [1.4, H + 1.26]], 40),
        lathe([[1.4, H + 3.7], [1.78, H + 3.72], [1.84, H + 3.82], [1.7, H + 3.95], [1.25, H + 4.45], [0.6, H + 4.95], [0.2, H + 5.2],
            [0.12, H + 5.5], [0.2, H + 5.6], [0.1, H + 5.75], [0.0, H + 5.78]], 32)
    ];
    group.add(mesh(merge(stone), M.concrete, { name: 'towerCap' }));

    // guarda-corpo da galeria e montantes da lanterna
    const metal = [];
    const circle = (r, y, n = 24) => Array.from({ length: n }, (_, i) => [Math.cos((i / n) * Math.PI * 2) * r, y, Math.sin((i / n) * Math.PI * 2) * r]);
    metal.push(pipe(circle(2.6, H + 1.25), 0.035, 6, 96, true));
    metal.push(pipe(circle(2.6, H + 0.75), 0.025, 6, 96, true));
    for (let i = 0; i < 20; i++) {
        const a = (i / 20) * Math.PI * 2;
        metal.push(pipe([[Math.cos(a) * 2.6, H + 0.22, Math.sin(a) * 2.6], [Math.cos(a) * 2.6, H + 1.25, Math.sin(a) * 2.6]], 0.028, 6));
    }
    for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        metal.push(pipe([[Math.cos(a) * 1.42, H + 1.26, Math.sin(a) * 1.42], [Math.cos(a) * 1.42, H + 3.72, Math.sin(a) * 1.42]], 0.04, 6));
    }
    metal.push(pipe(circle(1.42, H + 2.5), 0.03, 6, 80, true));
    group.add(mesh(merge(metal), M.steel, { name: 'towerMetal' }));
    const glass = mesh(lathe([[1.38, H + 1.3], [1.38, H + 3.7]], 30), M.glass, { cast: false, receive: false, name: 'towerGlass' });
    group.add(glass);

    // porta e janelas (molduras em relevo com vão escuro)
    const dark = new THREE.MeshStandardMaterial({ color: 0x10181a, roughness: 0.35, metalness: 0.2 });
    const frames = [];
    const voids = [];
    const opening = (y, w, h, ang) => {
        const r = rAt(y + h / 2) + 0.02;
        const g = new THREE.Group();
        const a = xf(rbox(w + 0.3, h + 0.3, 0.3, 0.04, 2), 0, 0, 0);
        const b = xf(rbox(w, h, 0.12, 0.02, 1), 0, 0, 0.1);
        for (const [geo, list] of [[a, frames], [b, voids]]) {
            xf(geo, Math.sin(ang) * r, y + h / 2, Math.cos(ang) * r, 0, ang);
            list.push(geo);
        }
        return g;
    };
    const doorAng = Math.atan2(-1, 0.65); // voltada para o ramal (oeste-noroeste)
    opening(0.25, 1.2, 2.3, doorAng);
    opening(6.0, 0.6, 1.1, doorAng + 0.5);
    opening(10.4, 0.6, 1.1, doorAng + 2.2);
    opening(14.6, 0.6, 1.1, doorAng - 1.1);
    group.add(mesh(applyWorldUV(merge(frames), 2), M.concrete, { name: 'towerFrames' }));
    group.add(mesh(merge(voids), dark, { cast: false }));

    // lâmpada e feixes giratórios
    const lampY = H + 2.5;
    const lamp = mesh(lathe([[0, -0.5], [0.28, -0.5], [0.34, -0.3], [0.42, 0], [0.34, 0.3], [0.28, 0.5], [0, 0.5]], 20), M.lamp, { cast: false });
    lamp.position.y = lampY;
    group.add(lamp);
    const beamMat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        uniforms: { uColor: { value: new THREE.Color(0xffe6b0) }, uPower: { value: 0 } },
        vertexShader: /* glsl */ `
            varying float vT; varying vec3 vN; varying vec3 vV;
            void main() {
                vT = uv.y;
                vec4 mv = modelViewMatrix * vec4(position, 1.0);
                vN = normalize(normalMatrix * normal);
                vV = normalize(-mv.xyz);
                gl_Position = projectionMatrix * mv;
            }`,
        fragmentShader: /* glsl */ `
            uniform vec3 uColor; uniform float uPower;
            varying float vT; varying vec3 vN; varying vec3 vV;
            void main() {
                // feixe volumétrico falso: mais forte de frente para a superfície do cone e perto da lâmpada
                float rim = pow(abs(dot(normalize(vN), normalize(vV))), 2.0);
                float a = rim * pow(1.0 - vT, 2.2) * uPower;
                gl_FragColor = vec4(uColor * a, a);
            }`
    });
    const beams = new THREE.Group();
    beams.position.y = lampY;
    for (const s of [0, Math.PI]) {
        const cone = new THREE.CylinderGeometry(4.2, 0.3, 46, 24, 1, true);
        cone.translate(0, 23, 0);
        cone.rotateZ(-Math.PI / 2);
        cone.rotateY(s);
        const m = new THREE.Mesh(cone, beamMat);
        m.renderOrder = 15;
        beams.add(m);
    }
    group.add(beams);
    const spot = new THREE.SpotLight(0xffe2b0, 0, 120, 0.2, 0.6, 1.2);
    spot.position.set(0, lampY, 0);
    beams.add(spot, spot.target);
    spot.target.position.set(40, -8, 0);

    world.addCollider(T.x, T.z, 3.6);
    return { group, beams, beamMat, spot };
}

// ───────────────────────────── placas das trilhas ─────────────────────────────

function buildSigns(world, M) {
    const group = new THREE.Group();
    group.name = 'trailSigns';
    // [t ao longo do laço, lado, título, linha de baixo]
    const defs = [
        [0.205, -1, 'T. REX', 'paddock leste · não pare'],
        [0.265, 1, 'BRAQUIOSSAUROS', 'lago central'],
        [0.335, -1, 'FAROL', 'ramal à esquerda · pteranodontes'],
        [0.42, -1, 'RAPTORS', 'clareira sul · siga devagar'],
        [0.575, 1, 'ESTEGOSSAUROS', 'crista · ramal à esquerda'],
        [0.74, 1, 'TRICERÁTOPS', 'prado noroeste']
    ];
    const postGeo = merge([
        column([[-0.4, 0.07, 0.07, 4], [1.25, 0.06, 0.06, 4]], 10, { capStart: false }),
        xf(column([[-0.4, 0.07, 0.07, 4], [1.25, 0.06, 0.06, 4]], 10, { capStart: false }), 1.1, 0, 0),
        xf(rbox(1.5, 0.08, 0.1, 0.02, 1), 0.55, 0.52, 0)
    ]);
    const p = new THREE.Vector3();
    const tg = new THREE.Vector3();
    defs.forEach(([t, sideSign, title, sub]) => {
        world.loop.pointAt(t, p);
        world.loop.tangentAt(t, tg);
        const nx = -tg.z * sideSign;
        const nz = tg.x * sideSign;
        const x = p.x + nx * 3.6;
        const z = p.z + nz * 3.6;
        const g = new THREE.Group();
        g.position.set(x, world.heightAt(x, z), z);
        g.rotation.y = Math.atan2(-nx, -nz) + (sideSign > 0 ? -0.5 : 0.5);
        const tex = panelTexture(512, 288, (ctx, w, h) => {
            drawEmblem(ctx, 64, 66, 38);
            ctx.fillStyle = CREAM;
            ctx.textBaseline = 'alphabetic';
            ctx.font = font(title.length > 11 ? 50 : 66, 700);
            ctx.textAlign = 'left';
            ctx.fillText(title, 122, 88);
            ctx.fillStyle = AMBER;
            ctx.fillRect(28, 128, w - 56, 5);
            ctx.fillStyle = CREAM;
            ctx.font = font(34, 500);
            ctx.fillText(sub, 28, 190);
            ctx.font = font(24, 500);
            ctx.globalAlpha = 0.75;
            ctx.fillText('RESERVA ÂMBAR · RECINTO 4', 28, 248);
            ctx.globalAlpha = 1;
        });
        const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0.15 });
        const board = mesh(rbox(1.5, 0.84, 0.05, 0.02, 1), [M.steel, M.steel, M.steel, M.steel, mat, M.steel]);
        board.position.set(0.55, 1.12, 0.06);
        const post = mesh(postGeo, M.darkWood);
        g.add(post, board);
        group.add(g);
        world.addCollider(x, z, 0.5);
    });
    return group;
}

// ─────────────────────────────────── montagem ─────────────────────────────────

/**
 * Constrói tudo e devolve { update(dt, t, night), openGate(), closeGate(), sparkPoints }.
 * `night` ∈ [0, 1] acende letreiros, lâmpadas e o farol.
 */
export function buildStructures(world, stage) {
    const tier = stage.tier;
    const M = makeMaterials(tier);
    const scene = stage.scene;
    const P = WORLD;

    // paddock do rex: elipse com um vão rompido voltado para a trilha
    const pts = [];
    const N = 34;
    for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2;
        pts.push({ x: P.paddock.x + Math.cos(a) * P.paddock.rx, z: P.paddock.z + Math.sin(a) * P.paddock.rz });
    }
    const gapIndex = Math.round((P.paddock.gap / (Math.PI * 2)) * N) % N;
    const paddock = buildFence(world, M, pts, { closed: true, broken: [gapIndex], seed: 2 });
    scene.add(paddock.group);
    const gapA = pts[gapIndex];
    const gapB = pts[(gapIndex + 1) % N];
    world.paddockGap = { x: (gapA.x + gapB.x) / 2, z: (gapA.z + gapB.z) / 2 };

    // cerca do perímetro, dos dois lados do portal
    const G = P.gate;
    const left = buildFence(world, M, [[-7, 0], [-13, 0.6], [-19, 1.8], [-25, 3.6], [-31, 6.2], [-37, 9.8], [-42, 14.5]]
        .map(([x, z]) => ({ x: G.x + x, z: G.z + z })), { height: 5.2, wires: 5, seed: 5 });
    const right = buildFence(world, M, [[7, 0], [13, 0.6], [19, 1.8], [25, 3.6], [31, 6.2], [37, 9.8], [42, 14.5]]
        .map(([x, z]) => ({ x: G.x + x, z: G.z + z })), { height: 5.2, wires: 5, seed: 6 });
    scene.add(left.group, right.group);

    const gate = buildGate(world, M);
    const center = buildCenter(world, M);
    const tower = buildTower(world, M);
    scene.add(gate.group, center.group, tower.group, buildSigns(world, M));

    // faíscas no vão rompido: luz azulada que pisca
    const sparkLight = new THREE.PointLight(0x9fd0ff, 0, 14, 1.8);
    sparkLight.position.copy(paddock.sparkPoints[0] || new THREE.Vector3(P.paddock.x, 8, P.paddock.z));
    scene.add(sparkLight);

    let open = 0;
    let openTarget = 0;
    let flick = 0;
    const lowTier = tier === 'low';
    if (lowTier) {
        gate.light.visible = false;
        tower.spot.visible = false;
    }

    return {
        sparkPoints: paddock.sparkPoints,
        sparkLight,
        ready: center.ready,
        gateOpen: () => open,
        openGate() { openTarget = 1; },
        closeGate(now = false) {
            openTarget = 0;
            if (now) open = 0;
        },
        /** Chame quando uma faísca estala (pisca a luz). */
        spark(k = 1) { flick = Math.max(flick, k); },
        update(dt, t, night) {
            // portão: folhas correm para os lados com easing; libera o colisor acima de 70 %
            open += (openTarget - open) * (1 - Math.exp(-1.6 * dt));
            if (Math.abs(openTarget - open) < 0.002) open = openTarget;
            const e = smoothstep(0, 1, open);
            for (const leaf of gate.leaves) leaf.position.x = leaf.userData.closed + (leaf.userData.open - leaf.userData.closed) * e;
            const free = open > 0.7;
            for (const b of gate.blockers) b.on = !free;

            // sinalizadores no topo dos postes: pulso lento
            M.beacon.emissiveIntensity = (0.35 + night * 2.4) * (0.55 + 0.45 * Math.sin(t * 2.4));
            gate.signMat.emissiveIntensity = night * 0.5;
            center.signMat.emissiveIntensity = night * 0.6;
            center.mapMat.emissiveIntensity = night * 0.35;
            gate.light.intensity = night * 60;
            center.light.intensity = 6 + night * 70;
            M.lamp.emissiveIntensity = 0.3 + night * 6;
            tower.beams.rotation.y = t * 0.55;
            tower.beamMat.uniforms.uPower.value = 0.05 + night * 0.5;
            tower.spot.intensity = night * 900;
            flick = Math.max(0, flick - dt * 9);
            sparkLight.intensity = flick * 40;
        }
    };
}
