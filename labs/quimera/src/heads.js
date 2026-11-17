/**
 * Quimera — eixo CABEÇA.
 *
 * Cada kit define (1) as opções de rosto do hero.js — pele, cabelo, barba, traços, idade —
 * e (2) a peça de cabeça modelada aqui (chapéu, elmo, capacete, máscara, óculos), que é
 * presa ao socket `head` do personagem.
 *
 * Referencial das peças: "hc" do hero.js — origem no fundo do queixo, y para cima, z para
 * a frente, em metros do adulto canônico:
 *   topo do crânio y = 0,228 · olhos y = 0,1165 (x = ±0,031) · boca y = 0,0485
 *   meia-largura do crânio 0,0775 (em y = 0,155) · testa z = +0,0975 · nuca z = −0,103
 * O socket `head` fica em hc (0; 0,228; −0,005): por isso o grupo final é deslocado de
 * (0; −0,228; +0,005) e preso com worldScale:false (acompanha a escala do corpo).
 *
 * O rosto é sempre definido por inteiro aqui (campos de FACE abaixo), para que o sexo do
 * CORPO mude só as proporções e nunca o rosto escolhido na CABEÇA.
 */
import * as THREE from 'three';
import { TAU, clamp, lerp, smooth, revolve, blob, tube, surface, extrude, shapeOf, xf, mesh, group, loop as ring } from './sculpt.js';

const FACE_M = { jaw: 1, chin: 1, brow: 1, nose: 1, noseW: 1, lips: 1, eye: 1.03, lash: 0.5, cheek: 1 };
const FACE_F = { jaw: 0.9, chin: 0.88, brow: 0.35, nose: 0.86, noseW: 0.9, lips: 1.3, eye: 1.12, lash: 1, cheek: 1.1 };

// perfil do crânio (recorte de HEAD_T do hero.js): [y, meia-largura, frente, nuca, expoente]
const SKULL = [
    [-0.06, 0.05, 0.03, 0.057, 2.0], [-0.014, 0.045, 0.036, 0.054, 2.0], [0.016, 0.042, 0.087, 0.056, 1.75],
    [0.048, 0.0575, 0.092, 0.066, 2.0], [0.08, 0.0685, 0.0935, 0.085, 2.2], [0.118, 0.0755, 0.093, 0.099, 2.35],
    [0.155, 0.0775, 0.0975, 0.103, 2.3], [0.178, 0.0745, 0.092, 0.099, 2.2], [0.198, 0.0665, 0.081, 0.09, 2.1],
    [0.212, 0.055, 0.066, 0.076, 2.0], [0.221, 0.04, 0.047, 0.056, 2.0], [0.228, 0.0, 0.0, 0.0, 2.0]
];
const _sk = [0, 0, 0, 0];
function skullAt(y) {
    let i = 0;
    while (i < SKULL.length - 2 && SKULL[i + 1][0] < y) i++;
    const a = SKULL[i];
    const b = SKULL[i + 1];
    const t = clamp((y - a[0]) / (b[0] - a[0]));
    for (let c = 0; c < 4; c++) _sk[c] = lerp(a[c + 1], b[c + 1], t);
    return _sk;
}
/** Ponto na casca do crânio (superelipse) no ângulo a (0 = frente, +π/2 = +X) com folga `off`. */
function skullPoint(p, a, y, off = 0) {
    const [w, zf, zb, n] = skullAt(y);
    const s = Math.sin(a);
    const c = Math.cos(a);
    const e = 2 / n;
    p.x = (w + off) * Math.sign(s) * Math.pow(Math.abs(s), e);
    p.z = ((c >= 0 ? zf : zb) + off) * Math.sign(c) * Math.pow(Math.abs(c), e);
    p.y = y;
    return p;
}

/** Gira `obj` em torno de um ponto (pivô) — para inclinar chapéus sem tirá-los do lugar. */
function pivot(obj, at, rot) {
    const g = new THREE.Group();
    // 1,2 cm abaixo do pivô: o chapéu assenta na testa em vez de boiar no cabelo
    g.position.set(at[0], at[1] - 0.012, at[2]);
    obj.position.set(-at[0], -at[1], -at[2]);
    g.rotation.set(rot[0], rot[1] || 0, rot[2] || 0);
    g.add(obj);
    return g;
}

// ---------------------------------------------------------------------------
// Peças
// ---------------------------------------------------------------------------

/**
 * Tricórnio. A aba nasce redonda (raio 19 cm) e dobra para cima em três gomos:
 *   dobra(a) = ½ − ½·cos 3a   → 0 nos três bicos (frente e ±120°), 1 no meio de cada gomo
 *   ângulo = 1,2 rad · dobra  ·  o bico avança 28 % além do raio da aba
 */
function tricorn(B, K) {
    const rc = 0.091;
    const zc = 1.25;
    const fold = (a) => 0.5 - 0.5 * Math.cos(3 * a);
    const bend = (p, a, k, r) => {
        const d = r - rc;
        if (d <= 0) {
            p.z *= zc;
            return;
        }
        const f = fold(a);
        const ext = 1 + 0.28 * (1 - f);
        const ang = f * 1.2;
        const rr = rc + d * ext * Math.cos(ang);
        p.x = Math.sin(a) * rr;
        p.z = Math.cos(a) * rr * zc;
        p.y += d * ext * Math.sin(ang) - 0.1 * d * (1 - f);
    };
    const hat = revolve([
        [rc - 0.006, 0.16], [rc + 0.03, 0.157], [0.185, 0.155], [0.191, 0.159], [0.185, 0.163], [rc + 0.03, 0.165], [rc + 0.004, 0.168, 1],
        [rc, 0.19], [0.086, 0.222], [0.07, 0.243], [0.04, 0.252], [0, 0.254]
    ], { segs: 72, sub: 4, deform: bend });
    const _p = new THREE.Vector3();
    const trim = ring((a) => {
        _p.set(Math.sin(a) * 0.191, 0.159, Math.cos(a) * 0.191);
        bend(_p, a, 0, 0.191);
        return [_p.x, _p.y, _p.z];
    }, 0.0042, 72);
    const band = ring((a) => [Math.sin(a) * (rc + 0.003), 0.176, Math.cos(a) * (rc + 0.003) * zc], 0.0045, 40, { sx: 2.4 });
    // brinco de argola na orelha esquerda
    const hoop = xf(ring((a) => [0, Math.sin(a) * 0.014, Math.cos(a) * 0.014], 0.0022, 20), { p: [0.083, 0.072, 0.004] });
    const g = group(
        pivot(group(mesh(hat, B.leather(0x1b1a1f, { roughness: 0.72 })), mesh([trim, band], B.metal(K.accent, 0.3))), [0, 0.17, 0], [-0.07, 0, 0.03]),
        mesh(hoop, B.metal(K.accent, 0.22), { shadow: false })
    );
    return g;
}

/** Gorro de marinheiro: faixa azul, tampo branco mais largo e fofo, duas fitas na nuca. */
function sailorCap(B, K) {
    const zc = 1.24;
    const oval = (p) => {
        p.z *= zc;
    };
    const top = revolve([
        [0.0925, 0.196, 1], [0.102, 0.203], [0.119, 0.215], [0.124, 0.226], [0.112, 0.238], [0.07, 0.246], [0, 0.249]
    ], { segs: 48, deform: (p, a, k) => {
        oval(p);
        p.y += 0.004 * Math.sin(a * 5 + 1) * smooth(0.2, 0.6, k) * (1 - smooth(0.8, 1, k));
    } });
    const bandG = revolve([[0.0915, 0.164], [0.0935, 0.166], [0.094, 0.18], [0.0935, 0.196], [0.091, 0.198]], { segs: 48, deform: oval });
    const tails = [];
    for (const sd of [-1, 1]) {
        tails.push(surface(2, 8, (u, v, p) => {
            p.set(sd * 0.012 + (u - 0.5) * 0.016 + sd * 0.02 * v, 0.18 - 0.115 * v - 0.02 * v * v, -0.105 - 0.012 * Math.sin(v * 3 + sd) - 0.025 * v);
        }));
    }
    const pom = xf(blob(0.011, 0.008, 0.011, { segs: 14, rings: 8 }), { p: [0, 0.252, 0] });
    return pivot(group(
        mesh([top, pom], B.cloth(0xf4f1ea, { sheen: 0.3 })),
        mesh(bandG, B.cloth(K.primary, { sheen: 0.3 })),
        mesh(tails, B.feather(K.primary, { roughness: 0.8 }))
    ), [0, 0.17, 0], [-0.1, 0, 0.06]);
}

/**
 * Capacete de astronauta: bolha de vidro (transmissão) de 16,5 cm de raio centrada na
 * cabeça, casca branca cobrindo a nuca (200°), aro do pescoço e duas lanternas laterais.
 */
function astroHelmet(B, K) {
    const C = [0, 0.105, -0.004];
    const R = 0.165;
    const arcPts = (r, a0, a1, n = 9) => {
        const out = [];
        for (let i = 0; i <= n; i++) {
            const ph = lerp(a0, a1, i / n);
            out.push([Math.sin(ph) * r, Math.cos(ph) * r]);
        }
        return out;
    };
    const bubble = xf(revolve(arcPts(R, 0.001, 2.58, 14), { segs: 56, sub: 2 }), { p: C });
    // casca traseira com espessura (vai por fora e volta por dentro)
    const outer = arcPts(R + 0.006, 2.56, 0.5, 10);
    outer[outer.length - 1].push(1);
    const shellPts = [...outer, ...arcPts(R + 0.0005, 0.5, 2.56, 10)];
    const span = 3.5;
    const shell = xf(revolve(shellPts, { segs: 40, sub: 2, start: Math.PI - span / 2, arc: span }), { p: C });
    const edges = [];
    for (const sd of [-1, 1]) {
        const a = Math.PI + (sd * span) / 2;
        const pts = arcPts(R + 0.003, 0.5, 2.56, 12).map(([r, y]) => [Math.sin(a) * r + C[0], y + C[1], Math.cos(a) * r + C[2]]);
        edges.push(tube(pts, 0.006, { segs: 8 }));
    }
    const topEdge = ring((t) => {
        const a = Math.PI + (t / TAU - 0.5) * span;
        const r = Math.sin(0.5) * (R + 0.003);
        return [Math.sin(a) * r + C[0], Math.cos(0.5) * (R + 0.003) + C[1], Math.cos(a) * r + C[2]];
    }, 0.006, 30, { closed: false });
    const neck = xf(revolve([
        [0.084, -0.006], [0.1, -0.008], [0.108, 0.002], [0.106, 0.014], [0.098, 0.022], [0.09, 0.03], [0.084, 0.028]
    ], { segs: 48 }), { p: [0, -0.066, -0.004] });
    const lamps = [];
    const lens = [];
    for (const sd of [-1, 1]) {
        lamps.push(xf(revolve([[0, -0.012], [0.018, -0.012], [0.022, 0], [0.02, 0.016], [0.012, 0.022], [0, 0.022]], { segs: 20 }),
            { r: [Math.PI / 2, 0, 0], p: [sd * (R + 0.004), 0.15, 0.012] }));
        lens.push(xf(blob(0.013, 0.013, 0.006, { segs: 14, rings: 8 }), { p: [sd * (R + 0.004), 0.15, 0.036] }));
    }
    const glass = mesh(bubble, B.glass(0xbfe0ff, { thickness: 0.012, tint: 0.12, ior: 1.3, opacity: 0.2 }), { shadow: false });
    glass.renderOrder = 3;
    return group(
        mesh([shell, neck, ...lamps], B.paint(K.primary, 0.42, 0.5)),
        mesh([...edges, topEdge], B.metal(K.secondary, 0.35)),
        mesh(lens, B.glow(0xfff0c8, 3), { shadow: false }),
        glass
    );
}

/** Crista do guerreiro: penacho vermelho em arco sobre o elmo do kit, num trilho de latão. */
function warriorCrest(B, K) {
    const path = [[0, 0.215, 0.088], [0, 0.243, 0.05], [0, 0.254, 0], [0, 0.243, -0.055], [0, 0.205, -0.1], [0, 0.15, -0.125], [0, 0.1, -0.128]];
    const plume = tube(path, (t) => 0.011 * (0.55 + 0.9 * Math.sin(Math.PI * Math.pow(t, 0.8))) + 0.004, { segs: 14, sx: 3.4, sz: 1, steps: 40 });
    // penugem: serrilha a borda de fora
    const pos = plume.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        const z = pos.getZ(i);
        const out = Math.hypot(y - 0.1, z) - 0.15;
        if (out > 0) {
            const k = 1 + 0.12 * Math.sin(Math.atan2(z, y - 0.1) * 46) * clamp(out / 0.03);
            pos.setY(i, 0.1 + (y - 0.1) * k);
            pos.setZ(i, z * k);
        }
    }
    plume.computeVertexNormals();
    const rail = tube(path.slice(0, 6).map(([x, y, z]) => [x, y - 0.012, z * 0.96]), 0.0065, { segs: 8, sz: 1.5 });
    return group(mesh(plume, B.feather(0xa01c1c, { roughness: 0.75 })), mesh(rail, B.metal(K.accent, 0.3)));
}

/** Lua crescente de latão presa à faixa do chapéu do mago (o chapéu é o do kit). */
function wizardMoon(B, K) {
    const sh = new THREE.Shape();
    sh.absarc(0, 0, 0.02, 0.55, TAU - 0.55, false);
    sh.absarc(0.0105, 0, 0.0145, TAU - 0.95, 0.95, true);
    const moon = xf(extrude(sh, { depth: 0.005, bevel: 0.0015 }), { r: [-0.25, 0, 0.3], p: [0.012, 0.212, 0.094] });
    const star = xf(extrude(starShape(5, 0.008, 0.0035), { depth: 0.004, bevel: 0.001 }), { r: [-0.2, 0.5, 0], p: [0.05, 0.225, 0.07] });
    return mesh([moon, star], B.metal(K.accent, 0.25), { shadow: false });
}

export function starShape(n, R, r) {
    const pts = [];
    for (let i = 0; i < n * 2; i++) {
        const a = (i / (n * 2)) * TAU + Math.PI / 2;
        const rr = i % 2 ? r : R;
        pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
    }
    return shapeOf(pts, { curved: false });
}

/**
 * Capuz e máscara do ninja: duas cascas justas ao crânio (folga de 7 mm).
 *   capuz    do topo até a borda b(a): 0,138 na frente (acima dos olhos), −0,05 dos lados e atrás
 *   máscara  de 0,098 (abaixo dos olhos) até −0,05, só no arco frontal; o nariz ganha 2 cm de calombo
 * Entre as duas fica a fenda dos olhos. Faixa vermelha na testa com nó e duas pontas.
 */
function ninjaHood(B, K) {
    const OFF = 0.0075;
    const _p = new THREE.Vector3();
    const side = (a) => smooth(0.62, 1.05, Math.abs(Math.atan2(Math.sin(a), Math.cos(a))));
    const hoodEdge = (a) => lerp(0.139, -0.05, side(a));
    const hood = surface(64, 30, (u, v, p) => {
        const a = u * TAU;
        const y = lerp(0.2265, hoodEdge(a), Math.pow(v, 0.85));
        skullPoint(p, a, y, OFF + 0.003 * smooth(0.02, -0.05, y));
        if (v === 0) p.set(0, 0.2285 + OFF, 0);
        // gola: abre um pouco no pescoço para assentar sobre a roupa
        const neck = smooth(0.0, -0.05, y);
        p.x *= 1 + 0.25 * neck;
        p.z = p.z * (1 + 0.2 * neck) - 0.012 * neck;
    });
    const mask = surface(36, 16, (u, v, p) => {
        const a = (u - 0.5) * 2.5;
        const sd = side(a);
        const top = lerp(0.1, 0.139, sd);
        const y = lerp(top, -0.05, v);
        skullPoint(p, a, y, OFF + 0.001);
        // nariz e queixo: o pano estica sobre eles
        const nose = Math.exp(-((a * a) / 0.07)) * Math.exp(-(((y - 0.078) / 0.03) ** 2));
        const chin = Math.exp(-((a * a) / 0.5)) * smooth(0.06, 0.0, y) * (1 - smooth(-0.02, -0.05, y));
        const k = 1 + (0.02 * nose + 0.05 * chin) / Math.max(0.03, Math.hypot(p.x, p.z));
        p.x *= k;
        p.z *= k;
        const neck = smooth(0.0, -0.05, y);
        p.x *= 1 + 0.25 * neck;
        p.z = p.z * (1 + 0.2 * neck) - 0.012 * neck;
    });
    const band = ring((a) => {
        skullPoint(_p, a, 0.166 - 0.006 * Math.cos(a), OFF + 0.004);
        return [_p.x, _p.y, _p.z];
    }, 0.0045, 48, { sx: 3.2 });
    const knot = xf(blob(0.014, 0.012, 0.01, { segs: 12, rings: 8 }), { p: [0.012, 0.166, -0.116] });
    const tails = [];
    for (const k of [0, 1]) {
        tails.push(surface(2, 10, (u, v, p) => {
            p.set(0.012 + (k ? 0.035 : -0.01) * v + 0.008 * Math.sin(v * 5 + k * 2), 0.166 - (k ? 0.13 : 0.17) * v + (u - 0.5) * 0.022,
                -0.118 - 0.05 * v - 0.014 * Math.sin(v * 4 + k));
        }));
    }
    return group(
        mesh([hood, mask], B.cloth(K.primary, { roughness: 0.96, sheen: 0.25 })),
        mesh([band, knot, ...tails], B.cloth(K.accent, { sheen: 0.4 }))
    );
}

/** Toque blanche: cinta reta de 5 cm e copa fofa com 14 pregas, levemente tombada. */
function chefToque(B) {
    const zc = 1.23;
    const hat = revolve([
        [0.09, 0.162], [0.0935, 0.164], [0.094, 0.19], [0.0935, 0.214, 1], [0.102, 0.224], [0.128, 0.25], [0.134, 0.285], [0.118, 0.318], [0.08, 0.338], [0.035, 0.345], [0, 0.346]
    ], { segs: 84, sub: 5, deform: (p, a, k) => {
        const puff = smooth(0.42, 0.56, k);
        const top = 1 - smooth(0.86, 1, k);
        const pl = 1 + 0.045 * Math.sin(a * 14) * puff * top;
        p.x *= pl;
        p.z *= pl * zc;
        const lean = smooth(0.5, 1, k);
        p.x += 0.022 * lean * lean;
        p.y -= 0.01 * lean * Math.max(0, Math.sin(a));
    } });
    return pivot(mesh(hat, B.cloth(0xf7f4ee, { roughness: 0.9, sheen: 0.35 })), [0, 0.17, 0], [-0.06, 0, -0.04]);
}

/**
 * Cabeça de robô: carcaça em superelipse (expoente 3,4) que fecha a cabeça inteira, visor
 * escuro com dois olhos de LED, grade da boca, antena e discos laterais.
 */
function robotHead(B, K) {
    const n = 3.4;
    const sq = (p, a, k, r) => {
        const s = Math.sin(a);
        const c = Math.cos(a);
        const e = 2 / n;
        p.x = r * 1.0 * Math.sign(s) * Math.pow(Math.abs(s), e);
        p.z = r * 1.1 * Math.sign(c) * Math.pow(Math.abs(c), e) - 0.004;
    };
    const shell = revolve([
        [0.05, -0.05], [0.07, -0.046], [0.078, -0.03, 1], [0.098, -0.026], [0.112, -0.012], [0.116, 0.02], [0.117, 0.12], [0.115, 0.2], [0.106, 0.238], [0.085, 0.254], [0.04, 0.26], [0, 0.26]
    ], { segs: 64, sub: 5, deform: sq });
    // visor: placa curva encaixada na frente
    const visor = surface(28, 10, (u, v, p) => {
        const a = (u - 0.5) * 1.36;
        const y = lerp(0.158, 0.082, v);
        sq(p, a, 0, 0.1205);
        p.y = y;
        const edge = Math.min(u, 1 - u, v, 1 - v);
        const k = 1 - 0.035 * smooth(0.12, 0, edge);
        p.x *= k;
        p.z *= k;
    });
    const eyes = [];
    for (const sd of [-1, 1]) eyes.push(xf(blob(0.017, 0.013, 0.005, { segs: 18, rings: 10 }), { p: [sd * 0.034, 0.121, 0.1245] }));
    const mouth = [];
    for (let i = -2; i <= 2; i++) mouth.push(xf(blob(0.0045, 0.009 - Math.abs(i) * 0.0015, 0.003, { segs: 10, rings: 6 }), { p: [i * 0.013, 0.036, 0.1235 - i * i * 0.0014] }));
    const ears = [];
    for (const sd of [-1, 1]) {
        ears.push(xf(revolve([[0, 0], [0.03, 0], [0.034, 0.006], [0.03, 0.014], [0.016, 0.018], [0.012, 0.03], [0, 0.031]], { segs: 24 }),
            { r: [0, 0, -sd * Math.PI / 2], p: [sd * 0.114, 0.1, -0.004] }));
    }
    const mast = tube([[0, 0.256, -0.004], [0, 0.31, -0.004], [0.004, 0.335, -0.008]], (t) => 0.005 - 0.002 * t, { segs: 8 });
    const base = xf(revolve([[0, 0], [0.02, 0], [0.022, 0.006], [0.012, 0.014], [0, 0.015]], { segs: 20 }), { p: [0, 0.256, -0.004] });
    const tip = xf(blob(0.011, 0.011, 0.011, { segs: 14, rings: 10 }), { p: [0.005, 0.343, -0.009] });
    const seam = ring((a) => {
        const q = new THREE.Vector3();
        sq(q, a, 0, 0.1178);
        return [q.x, 0.185, q.z];
    }, 0.0028, 48);
    return group(
        mesh(shell, B.metal(K.cloth, 0.38)),
        mesh([...ears, base, mast, seam], B.metal(K.secondary, 0.45)),
        mesh(visor, B.paint(0x0a0d12, 0.12, 1)),
        mesh([...eyes, ...mouth], B.glow(K.accent, 3.4), { shadow: false }),
        mesh(tip, B.glow(K.trim, 3), { shadow: false })
    );
}

/** Capacete colonial: copa em cúpula com quatro gomos e botão, aba caída mais longa atrás e na frente. */
function pithHelmet(B, K) {
    const rc = 0.094;
    const hat = revolve([
        [rc - 0.006, 0.158], [rc + 0.02, 0.15], [0.135, 0.136], [0.142, 0.136], [0.137, 0.143], [rc + 0.02, 0.158], [rc + 0.004, 0.166, 1],
        [rc + 0.002, 0.186], [0.088, 0.218], [0.072, 0.246], [0.045, 0.262], [0.012, 0.268], [0, 0.268]
    ], { segs: 64, sub: 5, deform: (p, a, k, r) => {
        const d = Math.max(0, r - rc);
        const fb = 0.5 + 0.5 * Math.cos(2 * a);         // 1 na frente e atrás
        const ext = 1 + (0.28 * fb + 0.12 * Math.max(0, -Math.cos(a))) * (d / 0.05);
        const crown = 1 - 0.012 * Math.pow(Math.abs(Math.sin(2 * a)), 8) * smooth(0.45, 0.6, k);
        p.x = Math.sin(a) * (rc + d * ext) * (d > 0 ? 1 : r / rc) * crown;
        p.z = Math.cos(a) * (rc + d * ext) * (d > 0 ? 1 : r / rc) * 1.2 * crown;
        p.y -= d * 0.22 * fb;
    } });
    const band = ring((a) => [Math.sin(a) * (rc + 0.005), 0.178, Math.cos(a) * (rc + 0.005) * 1.2], 0.0055, 44, { sx: 2.8 });
    const button = xf(blob(0.011, 0.007, 0.011, { segs: 14, rings: 8 }), { p: [0, 0.269, 0] });
    return pivot(group(
        mesh([hat, button], B.cloth(0xd9c79a, { roughness: 0.88, sheen: 0.2 })),
        mesh(band, B.leather(K.accent, { albedo: true }))
    ), [0, 0.17, 0], [-0.05, 0, 0]);
}

/**
 * Chapéu de cowboy: copa com vinco central de 3 cm e dois amassados na frente; aba de
 * 20 cm que sobe 7 cm dos lados (y += 0,07·k²·sen²a) e cai 1,5 cm na frente e atrás.
 */
function cowboyHat(B, K) {
    const rc = 0.094;
    const hat = revolve([
        [rc - 0.006, 0.16], [rc + 0.03, 0.156], [0.192, 0.154], [0.199, 0.158], [0.192, 0.162], [rc + 0.03, 0.164], [rc + 0.005, 0.168, 1],
        [rc + 0.001, 0.2], [0.089, 0.24], [0.08, 0.266], [0.055, 0.278], [0, 0.28]
    ], { segs: 72, sub: 5, deform: (p, a, k, r) => {
        const d = Math.max(0, r - rc);
        const kk = d / 0.108;
        const s = Math.sin(a);
        p.z *= 1.2;
        if (d > 0) {
            p.y += 0.075 * kk * kk * s * s - 0.02 * kk * (1 - s * s);
            p.x *= 1 - 0.1 * kk * kk * s * s;
        } else if (k > 0.5) {
            // copa: vinco ao longo de z e dois amassados frontais
            const up = smooth(0.2, 0.275, p.y);
            p.y -= 0.03 * up * Math.exp(-((p.x / 0.024) ** 2)) * smooth(-0.1, 0.02, p.z + 0.06);
            const dent = Math.exp(-(((Math.abs(p.x) - 0.05) / 0.028) ** 2)) * smooth(0.0, 0.07, p.z) * up;
            p.x *= 1 - 0.22 * dent;
            p.y -= 0.012 * dent;
        }
    } });
    const band = ring((a) => [Math.sin(a) * (rc + 0.004), 0.181, Math.cos(a) * (rc + 0.004) * 1.2], 0.0055, 44, { sx: 2.6 });
    const concho = xf(extrude(starShape(6, 0.011, 0.007), { depth: 0.004, bevel: 0.0012 }), { p: [0, 0.181, (rc + 0.008) * 1.2] });
    return pivot(group(
        mesh(hat, B.cloth(0x6e4a2c, { roughness: 0.86, sheen: 0.35 })),
        mesh(band, B.leather(0x2a1a12)),
        mesh(concho, B.metal(0xd8d2c4, 0.25), { shadow: false })
    ), [0, 0.17, 0], [-0.09, 0, 0]);
}

/**
 * Elmo viking (spangenhelm): cúpula de aço, cinta e duas tiras cruzadas de bronze, protetor
 * nasal e dois chifres — tubos cônicos que saem a ±8,5 cm, abrem para fora e sobem.
 */
function vikingHelm(B, K) {
    const _p = new THREE.Vector3();
    const dome = surface(56, 20, (u, v, p) => {
        const a = u * TAU;
        const y = lerp(0.238, 0.142 - 0.014 * smooth(0.5, 1.4, Math.abs(Math.atan2(Math.sin(a), Math.cos(a)))), v);
        skullPoint(p, a, Math.min(y, 0.2265), 0.0135 + 0.006 * smooth(0.2, 0.15, y));
        p.y = y;
        if (v === 0) p.set(0, 0.2435, -0.004);
    });
    const brow = ring((a) => {
        const y = 0.146 - 0.014 * smooth(0.5, 1.4, Math.abs(Math.atan2(Math.sin(a), Math.cos(a))));
        skullPoint(_p, a, y, 0.0215);
        return [_p.x, y, _p.z];
    }, 0.006, 56, { sx: 2.2 });
    const strips = [];
    for (const rot of [0, Math.PI / 2]) {
        const pts = [];
        for (let i = 0; i <= 16; i++) {
            const t = (i / 16) * 2 - 1;
            const y = 0.243 - 0.092 * Math.pow(Math.abs(t), 1.9);
            skullPoint(_p, rot + (t < 0 ? Math.PI : 0), Math.min(y, 0.226), 0.016);
            const kx = Math.abs(t) < 0.02 ? 0 : 1;
            pts.push([_p.x * kx, y + 0.002, _p.z * kx - (kx ? 0 : 0.004)]);
        }
        strips.push(tube(pts, 0.0048, { segs: 8, sx: 0.9, sz: 2.2, steps: 40 }));
    }
    const nasal = tube([[0, 0.15, 0.116], [0, 0.118, 0.117], [0, 0.088, 0.121], [0, 0.066, 0.127]], (t) => 0.0075 - 0.003 * t, { segs: 10, sx: 1.4, sz: 0.45 });
    const horns = [];
    const cuffs = [];
    for (const sd of [-1, 1]) {
        horns.push(tube([[sd * 0.086, 0.186, -0.004], [sd * 0.13, 0.196, -0.004], [sd * 0.168, 0.23, -0.004], [sd * 0.178, 0.285, 0.004], [sd * 0.158, 0.335, 0.014]],
            (t) => 0.021 * Math.pow(1 - t, 0.75) + 0.0015, { segs: 16, steps: 30, cap: 0.4 }));
        cuffs.push(tube([[sd * 0.084, 0.186, -0.004], [sd * 0.105, 0.19, -0.004]], 0.0245, { segs: 18, cap: 0.15 }));
    }
    return group(
        mesh(dome, B.metal(0x9aa0aa, 0.42)),
        mesh([brow, ...strips, nasal, ...cuffs], B.metal(0xa8793a, 0.36)),
        mesh(horns, B.paint(0xe6dcc6, 0.5, 0.35))
    );
}

/** Coroa de flores da fada: cipó em anel inclinado, sete flores de cinco pétalas e folhas. */
function fairyWreath(B, K) {
    const _p = new THREE.Vector3();
    const at = (a, off = 0.022) => {
        const y = 0.176 + 0.018 * Math.cos(a) + 0.003 * Math.sin(a * 5);
        skullPoint(_p, a, y, off);
        return [_p.x, y, _p.z];
    };
    const vine = [ring((a) => at(a), 0.004, 60), ring((a) => {
        const q = at(a + 0.3);
        return [q[0] * 1.02, q[1] + 0.006 * Math.sin(a * 7), q[2] * 1.02];
    }, 0.003, 60)];
    const petals = [];
    const hearts = [];
    const leaves = [];
    const petal = () => blob(0.0085, 0.0022, 0.013, { segs: 10, rings: 6, deform: (p) => {
        p.y += 0.006 * (p.z / 0.013) ** 2;
    } });
    const N = 7;
    for (let i = 0; i < N; i++) {
        const a = (i / N) * TAU + 0.2;
        const c = at(a, 0.03);
        const s = i % 2 ? 0.8 : 1.1;
        const rot = new THREE.Matrix4().makeRotationY(a).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2 - 0.25));
        for (let k = 0; k < 5; k++) {
            const g = petal();
            g.translate(0, 0, 0.012);
            g.rotateY((k / 5) * TAU);
            g.scale(s, s, s);
            g.applyMatrix4(rot);
            g.translate(c[0], c[1], c[2]);
            petals.push(g);
        }
        const h = blob(0.005 * s, 0.004 * s, 0.005 * s, { segs: 10, rings: 6 });
        h.applyMatrix4(rot);
        h.translate(c[0], c[1], c[2]);
        const n = new THREE.Vector3(0, 1, 0).applyMatrix4(rot).multiplyScalar(0.004);
        h.translate(n.x, n.y, n.z);
        hearts.push(h);
        const la = a + TAU / N / 2;
        const lc = at(la, 0.026);
        const lf = blob(0.007, 0.0015, 0.017, { segs: 8, rings: 6 });
        lf.rotateX(-0.5);
        lf.rotateY(la + 0.8);
        lf.translate(lc[0], lc[1] + 0.004, lc[2]);
        leaves.push(lf);
    }
    const gem = xf(blob(0.006, 0.008, 0.004, { segs: 10, rings: 8 }), { p: [0, 0.158, 0.103] });
    return group(
        mesh(petals, B.feather(K.primary, { roughness: 0.5 }), { shadow: false }),
        mesh([...vine, ...leaves], B.feather(0x5f9a58, { roughness: 0.6 })),
        mesh([...hearts], B.glow(K.accent, 1.6, 0x6a5a10), { shadow: false }),
        mesh(gem, B.glow(0xbff5e0, 2.4), { shadow: false })
    );
}

/**
 * Kabuto: tigela laqueada de 16 gomos, aba curta (mabizashi), guarda-nuca de quatro
 * lâminas em leque (shikoro, 250°), abas viradas (fukigaeshi) e crista dourada em lua.
 */
function kabuto(B, K) {
    const _p = new THREE.Vector3();
    const bowl = surface(96, 22, (u, v, p) => {
        const a = u * TAU;
        const y = lerp(0.24, 0.148, v);
        const rib = 0.0022 * Math.pow(Math.abs(Math.cos(a * 8)), 6) * smooth(0.05, 0.3, v);
        skullPoint(p, a, Math.min(y, 0.2265), 0.0145 + rib + 0.005 * smooth(0.2, 0.15, y));
        p.y = y;
        if (v === 0) p.set(0, 0.2455, -0.004);
    });
    const knob = xf(revolve([[0, 0], [0.014, 0], [0.016, 0.004], [0.009, 0.01], [0.006, 0.016], [0, 0.017]], { segs: 20 }), { p: [0, 0.243, -0.004] });
    const visor = surface(24, 6, (u, v, p) => {
        const a = (u - 0.5) * 1.7;
        skullPoint(p, a, 0.15, 0.019 + v * 0.036 * Math.cos(a * 0.9));
        p.y = 0.152 - 0.02 * v - 0.004 * Math.sin(v * Math.PI);
    });
    const lames = [];
    const laces = [];
    for (let i = 0; i < 4; i++) {
        const y0 = 0.15 - i * 0.03;
        const r0 = 0.022 + i * 0.017;
        lames.push(surface(48, 5, (u, v, p) => {
            const a = Math.PI + (u - 0.5) * 4.3;
            const t = v;
            skullPoint(p, a, 0.13, r0 + t * 0.02 + 0.004 * Math.sin(t * Math.PI));
            p.y = y0 - t * 0.036;
        }));
        laces.push(ring((a) => {
            const aa = Math.PI + ((a / TAU) - 0.5) * 4.2;
            skullPoint(_p, aa, 0.13, r0 + 0.0035);
            return [_p.x, y0 - 0.004, _p.z];
        }, 0.0022, 40, { closed: false }));
    }
    const wings = [];
    for (const sd of [-1, 1]) {
        wings.push(surface(8, 6, (u, v, p) => {
            const a = sd * (2.2 - u * 0.75);
            skullPoint(p, a, 0.13, 0.024 + v * 0.03 + u * 0.016);
            p.y = 0.156 - v * 0.05 + u * 0.012;
            p.x += sd * u * 0.03;
            p.z += u * 0.012;
        }));
    }
    // crista: duas pontas de lua crescente
    const sh = new THREE.Shape();
    sh.moveTo(0, 0);
    sh.bezierCurveTo(0.03, 0.002, 0.075, 0.03, 0.094, 0.115);
    sh.bezierCurveTo(0.072, 0.062, 0.04, 0.036, 0.012, 0.03);
    sh.lineTo(-0.012, 0.03);
    sh.bezierCurveTo(-0.04, 0.036, -0.072, 0.062, -0.094, 0.115);
    sh.bezierCurveTo(-0.075, 0.03, -0.03, 0.002, 0, 0);
    const crest = xf(extrude(sh, { depth: 0.004, bevel: 0.0014, curveSegs: 24 }), { r: [-0.16, 0, 0], p: [0, 0.158, 0.118] });
    const disc = xf(revolve([[0, 0], [0.016, 0], [0.018, 0.003], [0.01, 0.007], [0, 0.008]], { segs: 24 }), { r: [Math.PI / 2 - 0.16, 0, 0], p: [0, 0.176, 0.118] });
    return group(
        mesh([bowl, visor], B.paint(0x15151b, 0.26, 0.9, { side: THREE.DoubleSide })),
        mesh([...lames, ...wings], B.paint(K.primary, 0.3, 0.8, { side: THREE.DoubleSide })),
        mesh([crest, disc, knob, ...laces], B.metal(K.accent, 0.24))
    );
}

/** Óculos redondos do cientista: aros, ponte, hastes até as orelhas e lentes de vidro. */
function glasses(B, K) {
    const rims = [];
    const lenses = [];
    const arms = [];
    const z = 0.1035;
    for (const sd of [-1, 1]) {
        const cx = sd * 0.0325;
        rims.push(ring((a) => [cx + Math.cos(a) * 0.0235, 0.1165 + Math.sin(a) * 0.0215, z - 0.012 * (1 - Math.cos((cx + Math.cos(a) * 0.0235) * 9))], 0.0019, 28));
        lenses.push(xf(blob(0.0228, 0.0208, 0.0016, { segs: 22, rings: 8 }), { p: [cx, 0.1165, z - 0.001] }));
        arms.push(tube([[sd * 0.056, 0.121, z - 0.003], [sd * 0.074, 0.123, 0.06], [sd * 0.083, 0.123, 0.012], [sd * 0.083, 0.118, -0.012], [sd * 0.08, 0.1, -0.024]], 0.0015, { segs: 6, steps: 20 }));
    }
    const bridge = tube([[-0.0095, 0.121, z], [0, 0.126, z + 0.003], [0.0095, 0.121, z]], 0.0018, { segs: 6 });
    const lens = mesh(lenses, B.glass(0xd8ecff, { thickness: 0.003, tint: 0.08, ior: 1.5, opacity: 0.14 }), { shadow: false });
    lens.renderOrder = 3;
    return group(mesh([...rims, ...arms, bridge], B.metal(0x2a2c30, 0.35, { clean: true }), { shadow: false }), lens);
}

// ---------------------------------------------------------------------------
// Catálogo: opções do hero.js + peça
// ---------------------------------------------------------------------------
export const HEADS = {
    pirate: {
        hero: { hair: 0x17120e, hairStyle: 'long', beard: 'full', brows: 1.4, hat: 'bandana', hatColor: 0x8e1c26, eyepatch: true, face: { ...FACE_M, jaw: 1.08, brow: 1.3 } },
        gear: tricorn
    },
    sailor: {
        hero: { hair: 0x5a3a22, hairStyle: 'short', beard: 'none', face: { ...FACE_M, jaw: 0.98, cheek: 1.05 } },
        gear: sailorCap
    },
    astronaut: {
        hero: { hair: 0x2c2018, hairStyle: 'buzz', beard: 'none', face: { ...FACE_M } },
        gear: astroHelmet
    },
    warrior: {
        hero: { hair: 0x241710, hairStyle: 'short', beard: 'stubble', brows: 1.3, hat: 'helm', face: { ...FACE_M, jaw: 1.1, chin: 1.08, brow: 1.4 } },
        gear: warriorCrest
    },
    wizard: {
        hero: { age: 'elder', hair: 0xe6e3dc, hairStyle: 'long', beard: 'long', brows: 1.7, hat: 'wizard', hatColor: 0x34286a, face: { ...FACE_M, nose: 1.15, cheek: 1.15, lips: 0.85, brow: 1.2 } },
        gear: wizardMoon
    },
    ninja: {
        hero: { hair: 0x0e0d0f, hairStyle: 'buzz', beard: 'none', brows: 1.3, face: { ...FACE_M, brow: 1.2 } },
        gear: ninjaHood
    },
    chef: {
        hero: { hair: 0x3a2618, hairStyle: 'short', beard: 'mustache', face: { ...FACE_M, fat: 0.45, cheek: 1.12, nose: 1.08 } },
        gear: chefToque
    },
    robot: {
        hero: { hair: 0x30343a, hairStyle: 'bald', beard: 'none', brows: 0, lipColor: 0x7c8794, face: { ...FACE_M } },
        gear: robotHead
    },
    explorer: {
        hero: { hair: 0x6a4a2a, hairStyle: 'short', beard: 'stubble', face: { ...FACE_M, freckles: 1 } },
        gear: pithHelmet
    },
    cowboy: {
        hero: { hair: 0x4a2f1a, hairStyle: 'short', beard: 'mustache', brows: 1.3, face: { ...FACE_M, jaw: 1.06, brow: 1.2 } },
        gear: cowboyHat
    },
    viking: {
        hero: { hair: 0xc89a4a, hairStyle: 'braids', beard: 'braided', brows: 1.6, face: { ...FACE_M, jaw: 1.1, brow: 1.5, nose: 1.1 } },
        gear: vikingHelm
    },
    fairy: {
        hero: { hair: 0xe3a5c4, hairStyle: 'long', beard: 'none', brows: 0.7, lipColor: 0xd06a86, face: { ...FACE_F, ear: 1, earOut: 0.6 } },
        gear: fairyWreath
    },
    samurai: {
        hero: { hair: 0x100e10, hairStyle: 'buzz', beard: 'goatee', brows: 1.5, face: { ...FACE_M, brow: 1.3, cheek: 1.1 } },
        gear: kabuto
    },
    scientist: {
        hero: { age: 'elder', hair: 0xdcd9d2, hairStyle: 'wild', beard: 'mustache', brows: 1.5, face: { ...FACE_M, nose: 1.1, cheek: 1.1, lips: 0.9, brow: 1.1 } },
        gear: glasses
    }
};

/** Opções de rosto do hero.js para a cabeça do kit. */
export function headOptions(kit) {
    return { skin: kit.skin, eyeColor: kit.iris, ...HEADS[kit.id].hero };
}

/** Peça de cabeça pronta para `hero.attach('head', obj, { worldScale: false })`. */
export function buildHeadGear(kit, bank) {
    const root = new THREE.Group();
    root.name = `gear:head:${kit.id}`;
    const hc = new THREE.Group();
    hc.position.set(0, -0.228, 0.005);
    hc.add(HEADS[kit.id].gear(bank, kit.colors));
    root.add(hc);
    root.traverse((o) => {
        o.userData.slot = 'head';
    });
    return root;
}
