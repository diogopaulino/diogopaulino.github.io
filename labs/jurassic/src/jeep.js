/**
 * Jurassic — o jipe da Reserva Âmbar (Unidade 4) e a sua física arcade.
 *
 * Modelo: utilitário aberto de safári, desenho próprio — laterais em chapa
 * perfilada com arcos de roda recortados, capô abaulado, grade de barras
 * horizontais, para-lamas, santantônio tubular com capota de lona, para-brisa
 * com vidro, faróis com lente, pneus com banda de rodagem em blocos, volante
 * que gira e um guarda sentado ao volante (`shared/gfx/hero.js`).
 * Pintura PBR verde-petróleo com verniz (clearcoat) e emblema de amonite.
 * Frente = +Z, esquerda = +X, rodas em x = ±track/2, z = ±wheelBase/2.
 *
 * FÍSICA
 *   v' = acelerador·accel·aderência  |  freio·brake  |  −atrito·v       (limites: ré e máxima·aderência)
 *   aderência = 1 na trilha, 0,55 fora dela; ×0,85 com chuva
 *   ψ' = −direção·turn·clamp(|v|/5; 0,22; 1)·sinal(v)
 * SUSPENSÃO (o chão sob cada roda vem do terreno)
 *   g_i = altura do terreno sob a roda i
 *   arfagem alvo = atan2(g_trás − g_frente, entre-eixos) − 0,010·a      (mergulha ao frear, levanta ao acelerar)
 *   rolagem alvo = atan2(g_esq − g_dir, bitola) + 0,006·direção·v       (inclina para fora da curva)
 *   carroceria: mola-amortecedor  y'' = k·(ȳ − y) − c·y',  k = 90, c = 11  (quica ao passar em lombadas)
 *   curso de cada roda = clamp(g_i − y; ±0,20 m): a roda acompanha o chão dentro do batente
 */

import * as THREE from 'three';
import { JEEP } from './config.js';
import { clamp, damp } from '../../shared/gfx/core.js';
import { pbrMaterial } from '../../shared/gfx/assets.js';
import { createHero } from '../../shared/gfx/hero.js';
import { wrapPi } from './utils.js';
import { rbox, loft, pipe, lathe, merge, mesh, xf, canvasTexture } from './geo.js';

const WB = JEEP.wheelBase / 2;
const TR = JEEP.track / 2;
const WR = JEEP.wheelRadius;

/** Lateral: perfil visto de lado (z para a frente, y para cima) com os dois arcos de roda recortados. */
function sidePanel() {
    const s = new THREE.Shape();
    s.moveTo(-1.9, 0.52);
    s.lineTo(-1.92, 1.02);
    s.quadraticCurveTo(-1.92, 1.14, -1.8, 1.14);
    s.lineTo(-0.62, 1.14);
    s.quadraticCurveTo(-0.5, 1.13, -0.46, 1.02);
    s.lineTo(0.3, 1.0);
    s.quadraticCurveTo(0.4, 1.02, 0.46, 1.17);
    s.lineTo(1.62, 1.1);
    s.quadraticCurveTo(1.86, 1.07, 1.88, 0.92);
    s.lineTo(1.88, 0.52);
    s.lineTo(WB + 0.56, 0.52);
    s.absarc(WB, 0.5, 0.56, 0, Math.PI, false);
    s.lineTo(-WB + 0.56, 0.52);
    s.absarc(-WB, 0.5, 0.56, 0, Math.PI, false);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {
        depth: 0.05, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.03, bevelSegments: 4, curveSegments: 14
    });
    g.rotateY(-Math.PI / 2);
    return g;
}

/** Curva a lateral: estreita na frente (planta) e fecha para dentro acima da cintura (tumblehome). */
function shapeBody(g, sign) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
        const y = p.getY(i);
        const z = p.getZ(i);
        const taper = 0.1 * Math.max(0, (z - 0.4) / 1.5) ** 2 + 0.05 * Math.max(0, (-z - 1.2) / 0.7) ** 2;
        const tumble = Math.max(0, y - 0.9) * 0.12;
        p.setX(i, p.getX(i) - sign * (taper + tumble));
    }
    g.computeVertexNormals();
    return g;
}

/** Pneu: seção fechada varrida em torno do eixo X; a banda sobe 14 mm em blocos desencontrados. */
function tireGeometry() {
    // [raio, posição na largura]
    const sec = [
        [0.255, -0.115], [0.3, -0.15], [0.37, -0.158], [0.41, -0.145], [WR - 0.006, -0.11], [WR, -0.055],
        [WR, 0.0], [WR, 0.055], [WR - 0.006, 0.11], [0.41, 0.145], [0.37, 0.158], [0.3, 0.15], [0.255, 0.115]
    ];
    const N = 60;
    const rings = [];
    for (let j = 0; j <= N; j++) {
        const a = (j / N) * Math.PI * 2;
        const ring = [];
        sec.forEach(([r, w], k) => {
            let rr = r;
            if (k >= 4 && k <= 8) {
                const row = k < 6 ? 0 : k === 6 ? 1 : 2;
                if ((j + row * 2) % 5 < 3) rr += 0.014;
            }
            ring.push([w, Math.cos(a) * rr, Math.sin(a) * rr]);
        });
        rings.push(ring);
    }
    return loft(rings, { capStart: false, capEnd: false });
}

function rimGeometry() {
    const dish = lathe([[0.0, 0.05], [0.07, 0.05], [0.09, 0.02], [0.17, 0.0], [0.22, 0.05], [0.262, 0.12], [0.27, 0.13],
        [0.262, 0.14], [0.25, 0.13], [0.25, -0.12], [0.262, -0.13]], 28);
    const parts = [dish];
    for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        parts.push(xf(lathe([[0, 0], [0.016, 0], [0.016, 0.03], [0, 0.034]], 6), Math.cos(a) * 0.115, 0.03, Math.sin(a) * 0.115));
    }
    const g = merge(parts);
    g.rotateZ(-Math.PI / 2);
    return g;
}

function emblemTexture() {
    return canvasTexture(256, 256, (ctx, w, h) => {
        ctx.clearRect(0, 0, w, h);
        ctx.strokeStyle = '#efe6cf';
        ctx.fillStyle = '#efe6cf';
        ctx.lineCap = 'round';
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.arc(128, 104, 84, 0, Math.PI * 2);
        ctx.stroke();
        // amonite: r = r0·e^(0,17·θ)
        const max = Math.PI * 5.5;
        const r0 = 62 / Math.exp(0.17 * max);
        ctx.lineWidth = 7;
        ctx.beginPath();
        for (let th = 0; th <= max; th += 0.06) {
            const r = r0 * Math.exp(0.17 * th);
            const x = 128 + Math.cos(th) * r;
            const y = 104 + Math.sin(th) * r;
            if (th === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.font = '700 44px Barlow, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('UNIDADE 04', 128, 240);
    });
}

export function buildJeep(quality) {
    const root = new THREE.Group();
    root.name = 'jeep';
    const body = new THREE.Group();
    body.name = 'jeepBody';
    root.add(body);

    const paint = new THREE.MeshPhysicalMaterial({
        color: 0x1b5552, roughness: 0.42, metalness: 0.45, clearcoat: 1, clearcoatRoughness: 0.14, envMapIntensity: 1.1
    });
    const trim = new THREE.MeshStandardMaterial({ color: 0x17191b, roughness: 0.72, metalness: 0.25 });
    const steel = new THREE.MeshStandardMaterial({ color: 0xb9c0c4, roughness: 0.3, metalness: 0.95 });
    const rubber = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.92, metalness: 0, side: THREE.DoubleSide });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xd9d3c2, roughness: 0.5, metalness: 0.55 });
    const canvas = new THREE.MeshStandardMaterial({ color: 0xd8ccae, roughness: 0.95, metalness: 0, side: THREE.DoubleSide });
    const leather = pbrMaterial('brown_leather', { color: 0xb08a66, repeat: 2 });
    leather.color.multiplyScalar(2.4); // o couro fotogramétrico é escuro: ganho para ler como caramelo
    const glass = new THREE.MeshPhysicalMaterial({
        color: 0xbfd6d2, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.2, envMapIntensity: 1.6,
        clearcoat: 1, side: THREE.DoubleSide, depthWrite: false
    });
    const lens = new THREE.MeshPhysicalMaterial({
        color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.35, envMapIntensity: 2, clearcoat: 1, depthWrite: false
    });
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff4d6, emissive: 0xffe9b8, emissiveIntensity: 0.4, roughness: 0.25, metalness: 0.6 });
    const tailMat = new THREE.MeshStandardMaterial({ color: 0x5a0d08, emissive: 0xff2a14, emissiveIntensity: 0.3, roughness: 0.3 });

    // ── carroceria pintada ──
    const painted = [];
    for (const s of [-1, 1]) {
        const g = shapeBody(sidePanel(), s);
        g.translate(s * 0.86 + (s > 0 ? 0.05 : 0), 0, 0);
        painted.push(g);
    }
    // capô abaulado (loft de seções em arco, mais baixo e estreito no nariz)
    const hood = [];
    for (let i = 0; i <= 8; i++) {
        const u = i / 8;
        const z = 0.44 + u * 1.42;
        const hw = 0.83 - 0.1 * u * u;
        const yb = 1.16 - 0.07 * u - 0.09 * u ** 4;
        const ring = [];
        for (let k = 0; k <= 12; k++) {
            const t = (k / 12) * 2 - 1;
            ring.push([t * hw, yb + 0.07 * (1 - t * t) - 0.03 * t ** 6, z]);
        }
        for (let k = 12; k >= 0; k--) {
            const t = (k / 12) * 2 - 1;
            ring.push([t * hw * 0.98, yb - 0.05, z]);
        }
        hood.push(ring);
    }
    painted.push(loft(hood));
    // ressalto central do capô e tomada de ar
    painted.push(xf(rbox(0.5, 0.05, 0.95, 0.022, 1), 0, 1.165, 1.06, 0.06));
    // frente: moldura da grade e dos faróis
    painted.push(xf(rbox(1.5, 0.5, 0.1, 0.04, 1), 0, 0.82, 1.84));
    // traseira e tampa
    painted.push(xf(rbox(1.68, 0.56, 0.08, 0.035, 1), 0, 0.84, -1.9));
    // painel/corta-fogo sob o para-brisa
    painted.push(xf(rbox(1.66, 0.3, 0.16, 0.05, 1), 0, 1.04, 0.44));
    body.add(mesh(merge(painted), paint, { name: 'jeepPaint' }));

    // ── partes escuras: assoalho, caixas de roda, grade, para-lamas, estribos, painel ──
    const dark = [
        xf(rbox(1.66, 0.08, 3.6, 0.03, 1), 0, 0.6, -0.02),
        xf(rbox(1.2, 0.34, 0.04, 0.01, 1), 0, 0.84, 1.875),
        xf(rbox(1.5, 0.14, 0.26, 0.05, 1), 0, 1.13, 0.3),
        xf(rbox(0.36, 0.2, 0.5, 0.05, 1), 0, 0.74, -0.2)
    ];
    for (const s of [-1, 1]) {
        dark.push(xf(rbox(0.16, 0.05, 1.3, 0.02, 1), s * 0.98, 0.46, 0));
        dark.push(xf(rbox(0.3, 0.5, 1.16, 0.06, 1), s * 0.7, 0.86, -WB));
        for (const z of [-WB, WB]) {
            // para-lama: arco de seção oval sobre a roda
            const g = new THREE.TorusGeometry(0.585, 0.055, 8, 22, Math.PI);
            g.scale(1, 1, 1.9);
            g.rotateY(Math.PI / 2);
            dark.push(xf(g, s * 0.93, 0.5, z));
        }
    }
    body.add(mesh(merge(dark), trim, { name: 'jeepTrim' }));

    // ── aço: grade horizontal, para-choques, quebra-mato, santantônio, guincho ──
    const metal = [];
    for (let i = 0; i < 4; i++) metal.push(pipe([[-0.56, 0.72 + i * 0.08, 1.9], [0.56, 0.72 + i * 0.08, 1.9]], 0.018, 8));
    metal.push(xf(rbox(1.86, 0.16, 0.14, 0.05, 1), 0, 0.5, 2.0));
    metal.push(xf(rbox(1.8, 0.14, 0.12, 0.05, 1), 0, 0.5, -2.0));
    metal.push(pipe([[-0.5, 0.5, 2.06], [-0.5, 1.0, 2.1], [-0.3, 1.14, 2.08], [0.3, 1.14, 2.08], [0.5, 1.0, 2.1], [0.5, 0.5, 2.06]], 0.032, 8, 40, false, 0.25));
    metal.push(pipe([[-0.5, 0.8, 2.09], [0.5, 0.8, 2.09]], 0.024, 8));
    metal.push(xf(lathe([[0, -0.14], [0.07, -0.14], [0.07, 0.14], [0, 0.14]], 14), 0, 0.62, 2.04, 0, 0, Math.PI / 2));
    // santantônio: dois arcos + longarinas + montantes do para-brisa
    for (const z of [-0.5, -1.62]) metal.push(pipe([[-0.82, 1.1, z], [-0.8, 1.78, z], [-0.66, 2.0, z], [0.66, 2.0, z], [0.8, 1.78, z], [0.82, 1.1, z]], 0.034, 8, 40, false, 0.3));
    for (const s of [-1, 1]) {
        metal.push(pipe([[s * 0.69, 2.0, -1.62], [s * 0.69, 2.0, -0.5], [s * 0.7, 1.97, 0.22]], 0.03, 8, 16, false, 0.2));
        metal.push(pipe([[s * 0.8, 1.6, -1.62], [s * 0.82, 1.12, -1.86]], 0.026, 8));
    }
    // moldura do para-brisa (inclinado para trás)
    metal.push(pipe([[-0.76, 1.16, 0.44], [-0.71, 1.96, 0.21], [0.71, 1.96, 0.21], [0.76, 1.16, 0.44]], 0.03, 8, 40, false, 0.06));
    metal.push(pipe([[0, 1.17, 0.44], [0, 1.96, 0.21]], 0.014, 6));
    // retrovisores, antena, limpadores
    for (const s of [-1, 1]) {
        metal.push(pipe([[s * 0.78, 1.3, 0.42], [s * 1.0, 1.36, 0.46]], 0.014, 6));
        metal.push(xf(rbox(0.05, 0.16, 0.22, 0.02, 1), s * 1.02, 1.38, 0.47));
        metal.push(pipe([[s * 0.3, 1.2, 0.47], [s * 0.05, 1.42, 0.41]], 0.008, 5));
    }
    metal.push(pipe([[-0.74, 1.14, -1.8], [-0.74, 2.9, -1.86]], 0.008, 5));
    body.add(mesh(merge(metal), steel, { name: 'jeepSteel' }));

    // ── vidro e capota ──
    const wind = new THREE.PlaneGeometry(1.42, 0.8);
    xf(wind, 0, 1.56, 0.325, -0.28);
    body.add(mesh(wind, glass, { cast: false, receive: false, name: 'jeepGlass' }));
    const top = [];
    for (let i = 0; i <= 6; i++) {
        const u = i / 6;
        const z = 0.2 - u * 1.86;
        const ring = [];
        for (let k = 0; k <= 12; k++) {
            const t = (k / 12) * 2 - 1;
            ring.push([t * 0.74, 2.035 + 0.05 * (1 - t * t) + 0.012 * Math.sin(u * Math.PI * 3) - Math.max(0, Math.abs(t) - 0.9) * 0.8, z]);
        }
        for (let k = 12; k >= 0; k--) {
            const t = (k / 12) * 2 - 1;
            ring.push([t * 0.73, 2.02 + 0.05 * (1 - t * t) - Math.max(0, Math.abs(t) - 0.9) * 0.8, z]);
        }
        top.push(ring);
    }
    body.add(mesh(loft(top), canvas, { name: 'jeepCanopy' }));

    // ── bancos de couro ──
    const seats = [];
    const seat = (x, z, w) => {
        seats.push(xf(rbox(w, 0.16, 0.5, 0.06, 1), x, 0.98, z));
        seats.push(xf(rbox(w, 0.6, 0.14, 0.06, 1), x, 1.3, z - 0.27, -0.16));
        seats.push(xf(rbox(w * 0.5, 0.2, 0.1, 0.045, 1), x, 1.7, z - 0.34, -0.1));
    };
    seat(0.4, -0.08, 0.5);
    seat(-0.4, -0.08, 0.5);
    seat(0, -1.02, 1.36);
    body.add(mesh(merge(seats), leather, { name: 'jeepSeats' }));

    // ── volante (gira com a direção) ──
    const wheelCol = new THREE.Group();
    wheelCol.position.set(0.4, 1.22, 0.24);
    wheelCol.rotation.x = -1.05;
    const steerWheel = new THREE.Group();
    const sw = [new THREE.TorusGeometry(0.18, 0.02, 10, 28), xf(lathe([[0, -0.03], [0.05, -0.03], [0.055, 0.02], [0, 0.03]], 14), 0, 0, 0, Math.PI / 2)];
    for (const a of [Math.PI / 2, Math.PI * 1.17, Math.PI * 1.83]) sw.push(pipe([[0, 0, 0], [Math.cos(a) * 0.18, Math.sin(a) * 0.18, 0]], 0.012, 6));
    steerWheel.add(mesh(merge(sw), trim, { cast: false }));
    wheelCol.add(steerWheel);
    wheelCol.add(mesh(pipe([[0, 0, 0], [0, 0, -0.34]], 0.024, 8), trim, { cast: false }));
    body.add(wheelCol);

    // ── faróis (carcaça, refletor emissivo, lente) e lanternas ──
    const lampGeo = [];
    const lensGeo = [];
    const housing = [];
    for (const s of [-1, 1]) {
        housing.push(xf(lathe([[0.0, -0.1], [0.07, -0.1], [0.125, -0.02], [0.135, 0.03], [0.12, 0.035]], 20), s * 0.58, 0.86, 1.86, Math.PI / 2));
        lampGeo.push(xf(lathe([[0.0, -0.02], [0.05, -0.01], [0.115, 0.03]], 20), s * 0.58, 0.86, 1.86, Math.PI / 2));
        lensGeo.push(xf(lathe([[0.0, 0.07], [0.06, 0.062], [0.1, 0.048], [0.12, 0.034]], 20), s * 0.58, 0.86, 1.86, Math.PI / 2));
        // farol de milha no quebra-mato
        housing.push(xf(lathe([[0.0, -0.07], [0.05, -0.07], [0.08, -0.01], [0.085, 0.02], [0.075, 0.024]], 16), s * 0.3, 1.22, 2.08, Math.PI / 2));
        lampGeo.push(xf(lathe([[0.0, -0.01], [0.07, 0.02]], 16), s * 0.3, 1.22, 2.08, Math.PI / 2));
    }
    body.add(mesh(merge(housing), steel, { name: 'jeepLampHousing' }));
    body.add(mesh(merge(lampGeo), lampMat, { cast: false, name: 'jeepLamps' }));
    body.add(mesh(merge(lensGeo), lens, { cast: false, receive: false }));
    const tails = [];
    for (const s of [-1, 1]) tails.push(xf(rbox(0.12, 0.2, 0.05, 0.02, 1), s * 0.72, 0.9, -1.945));
    body.add(mesh(merge(tails), tailMat, { cast: false }));

    // ── emblema nas portas e no capô ──
    const emblem = emblemTexture();
    const decalMat = new THREE.MeshStandardMaterial({ map: emblem, transparent: true, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false });
    for (const s of [-1, 1]) {
        const d = mesh(new THREE.PlaneGeometry(0.46, 0.46), decalMat, { cast: false });
        d.position.set(s * 0.952, 0.79, -0.08);
        d.rotation.y = s * Math.PI / 2;
        body.add(d);
    }

    // ── estepe na tampa traseira ──
    const tireGeo = tireGeometry();
    const rimGeo = rimGeometry();
    const spare = new THREE.Group();
    spare.add(mesh(tireGeo, rubber), mesh(rimGeo, rimMat));
    spare.rotation.y = -Math.PI / 2;
    spare.position.set(0, 1.0, -2.06);
    body.add(spare);

    // ── rodas: pivô (direção) → giro ──
    const wheels = [];
    for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        const pivot = new THREE.Group();
        pivot.position.set(sx * TR, WR, sz * WB);
        const spin = new THREE.Group();
        const tire = mesh(tireGeo, rubber);
        const rim = mesh(rimGeo, rimMat);
        if (sx < 0) rim.rotation.y = Math.PI;
        spin.add(tire, rim);
        pivot.add(spin);
        root.add(pivot);
        wheels.push({ pivot, spin, x: sx * TR, z: sz * WB, front: sz > 0, g: 0 });
    }
    // eixos visíveis sob a carroceria
    const axles = [];
    for (const z of [-WB, WB]) axles.push(pipe([[-TR, WR, z], [TR, WR, z]], 0.045, 8));
    axles.push(pipe([[0, WR, -WB], [0, WR + 0.06, WB]], 0.035, 8));
    root.add(mesh(merge(axles), trim, { cast: false }));

    // ── faróis de verdade ──
    const lights = [];
    for (const s of [-1, 1]) {
        // o farol com sombra alcança só 30 m: o mapa de sombra dele redesenha tudo o que está no cone
        const l = new THREE.SpotLight(0xfff0cf, 0, s > 0 && quality.headShadow ? 30 : 70, 0.5, 0.55, 1.3);
        l.position.set(s * 0.58, 0.9, 1.98);
        l.target.position.set(s * 0.9, 0.1, 16);
        if (s > 0 && quality.headShadow) {
            l.userData.shadow = true;
            l.shadow.mapSize.set(1024, 1024);
            l.shadow.camera.near = 0.6;
            l.shadow.bias = -0.0015;
        }
        body.add(l, l.target);
        lights.push(l);
    }

    // ── motorista ──
    const driver = createHero({
        detail: quality.heroDetail, build: 0.2, skin: 0xb98562, hair: 0x2a1c12, hairStyle: 'short', beard: 'stubble',
        top: 'shirt', sleeves: 'short', topColor: 0xb9a878, trimColor: 0x6b5a34, bottom: 'pants', bottomColor: 0x4d5338,
        shoes: 'boots', belt: 0x3a2618, hat: 'cap', hatColor: 0x1b5552
    });
    driver.object.position.set(0.4, 1.06 - driver.seatHeight, -0.1);
    body.add(driver.object);

    return { root, body, wheels, lights, lampMat, tailMat, steerWheel, driver };
}

export class Jeep {
    constructor(scene, quality) {
        const b = buildJeep(quality);
        Object.assign(this, b);
        this.mesh = b.root;
        scene.add(this.mesh);
        this.x = 0;
        this.z = 0;
        this.y = 0;
        this.vy = 0;
        this.yaw = 0;
        this.speed = 0;
        this.accelNow = 0;
        this.steer = 0;
        this.pitch = 0;
        this.roll = 0;
        this.lightsOn = true;
        this.onRoad = true;
        this.head = new THREE.Vector3();
        this.driverState = { mode: 'sit', upper: 'ride', speed: 1 };
        this._out = { x: 0, z: 0, y: 0, speed: 0 };
    }

    reset(spawn, world) {
        this.x = spawn.x;
        this.z = spawn.z;
        this.yaw = spawn.yaw;
        this.speed = 0;
        this.steer = 0;
        this.pitch = 0;
        this.roll = 0;
        this.vy = 0;
        this.y = world ? world.heightAt(this.x, this.z) : 0;
        this._place(world, 0, true);
    }

    setLights(on, night = 1) {
        this.lightsOn = on;
        this.lampMat.emissiveIntensity = on ? 2 + night * 4 : 0.15;
        this.tailMat.emissiveIntensity = on ? 1.5 + night * 3 : 0.2;
        for (const l of this.lights) {
            l.intensity = on ? 30 + night * 110 : 0;
            // a sombra do farol só é desenhada com ele aceso (o mapa custa uma passada da cena)
            if (l.userData.shadow) l.castShadow = on;
        }
    }

    /** Assenta a carroceria e as rodas no relevo (ver SUSPENSÃO no cabeçalho). */
    _place(world, dt, snap = false) {
        const s = Math.sin(this.yaw);
        const c = Math.cos(this.yaw);
        let gF = 0;
        let gR = 0;
        let gL = 0;
        let gRt = 0;
        for (const w of this.wheels) {
            w.g = world ? world.heightAt(this.x + w.x * c + w.z * s, this.z - w.x * s + w.z * c) : 0;
            if (w.front) gF += w.g * 0.5;
            else gR += w.g * 0.5;
            if (w.x > 0) gL += w.g * 0.5;
            else gRt += w.g * 0.5;
        }
        const target = (gF + gR) * 0.5;
        const pitchT = Math.atan2(gR - gF, WB * 2) - clamp(this.accelNow, -20, 20) * 0.01;
        const rollT = Math.atan2(gL - gRt, TR * 2) + this.steer * this.speed * 0.006;
        if (snap) {
            this.y = target;
            this.vy = 0;
            this.pitch = pitchT;
            this.roll = rollT;
        } else {
            this.vy += (90 * (target - this.y) - 11 * this.vy) * dt;
            this.y += this.vy * dt;
            this.y = clamp(this.y, target - 0.12, target + 0.3);
            this.pitch = damp(this.pitch, pitchT, 9, dt);
            this.roll = damp(this.roll, rollT, 8, dt);
        }
        this.mesh.position.set(this.x, this.y, this.z);
        this.mesh.rotation.set(0, this.yaw, 0);
        this.body.rotation.set(this.pitch, 0, this.roll, 'YXZ');
        this.body.position.y = 0.03;
        for (const w of this.wheels) {
            // curso da roda: ela acompanha o chão dentro do batente da suspensão
            w.pivot.position.y = WR + clamp(w.g - this.y, -0.2, 0.2);
        }
        this.head.set(this.x, this.y + 1.75, this.z);
    }

    update(dt, input, world, wet = 0) {
        const throttle = input.move.z;
        this.steer = damp(this.steer, input.move.x, 8, dt);
        const road = world.onRoad(this.x, this.z);
        this.onRoad = road;
        const grip = (road ? 1 : 0.55) * (1 - 0.15 * wet);
        const max = JEEP.maxSpeed * grip;
        const v0 = this.speed;

        if (throttle > 0.08) this.speed += throttle * JEEP.accel * grip * dt;
        else if (throttle < -0.08) this.speed += throttle * JEEP.brake * dt;
        else this.speed = damp(this.speed, 0, JEEP.friction, dt);
        this.speed = clamp(this.speed, -JEEP.reverseMax, Math.max(max, v0 - 12 * dt));

        const turnScale = clamp(Math.abs(this.speed) / 5, 0.22, 1);
        this.yaw = wrapPi(this.yaw - this.steer * JEEP.turn * turnScale * Math.sign(this.speed || 1) * dt * (Math.abs(this.speed) > 0.05 ? 1 : 0));

        const px = this.x;
        const pz = this.z;
        let nx = px + Math.sin(this.yaw) * this.speed * dt;
        let nz = pz + Math.cos(this.yaw) * this.speed * dt;
        const hit = world.collide(nx, nz, JEEP.radius);
        nx = hit.x;
        nz = hit.z;
        if (hit.hit) this.speed *= Math.pow(0.02, dt);
        // água funda (lago ou mar): o jipe não entra
        if (world.flooded(nx, nz)) {
            nx = px;
            nz = pz;
            this.speed *= -0.2;
        }
        this.x = nx;
        this.z = nz;
        this.accelNow = damp(this.accelNow, (this.speed - v0) / Math.max(dt, 1e-3), 10, dt);
        this._place(world, dt);

        // rodas: giro = distância / raio; as dianteiras esterçam
        const spin = (this.speed * dt) / WR;
        for (const w of this.wheels) {
            w.spin.rotation.x += spin;
            if (w.front) w.pivot.rotation.y = -this.steer * 0.5;
        }
        this.steerWheel.rotation.z = this.steer * 1.9;
        this.driver.update(dt, this.driverState);

        const o = this._out;
        o.x = this.x;
        o.z = this.z;
        o.y = this.y;
        o.speed = this.speed;
        return o;
    }

    /** Anima só o motorista (menu, pausa). */
    idle(dt) {
        this.driver.update(dt, this.driverState);
    }
}
