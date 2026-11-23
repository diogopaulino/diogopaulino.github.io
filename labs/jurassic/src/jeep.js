/**
 * Jurassic — o jipe da Reserva Âmbar (Unidade 4) e a sua física veicular.
 *
 * Modelo: utilitário aberto de safári, desenho próprio — laterais em chapa
 * perfilada com arcos de roda recortados, capô abaulado, grade de barras
 * horizontais, para-lamas, santantônio tubular com capota de lona, para-brisa
 * com vidro, faróis com lente, pneus com banda de rodagem em blocos, volante
 * que gira e um guarda sentado ao volante (`shared/gfx/hero.js`).
 * Pintura PBR verde-petróleo com verniz (clearcoat) e emblema de amonite.
 * Frente = +Z, esquerda = +X, rodas em x = ±track/2, z = ±wheelBase/2.
 *
 * FÍSICA (SI; constantes em config.js → JEEP; passo interno ≤ 1/120 s, dt do quadro ≤ 1/20 s)
 *   rumo ψ: frente f = (sin ψ, cos ψ), esquerda e = (cos ψ, −sin ψ); V = velocidade no mundo
 *   v = V·f (longitudinal, + para a frente)   u = V·e (deslizamento lateral)
 *   LONGITUDINAL   m·v' = F_motor − F_freio − F_rol − F_ar − F_mato − m·g·sin θ
 *     F_motor = acelerador · min(F_max, P / |v|, μ·m·g) · regulador     (torque baixo, depois potência)
 *     reduzida automática: subindo rampa (tan θ > 0,15 no sentido do movimento) abaixo de 6 m/s,
 *       F_max = μ·m·g (limite do pneu) — a trilha da crista tem ~33° e um 4×4 em reduzida a vence
 *     regulador  = clamp((v_reg − v) / 1,5; 0; 1)                       (80 km/h na trilha)
 *     F_rol = C_rr·m·g · sinal(v)       F_ar = ½·ρ·CdA·v²       F_mato = k_mato·v² (só fora da trilha)
 *     F_freio = freio · m · min(a_freio, μ·g)   (ABS: nunca trava; não inverte o sentido)
 *     freio-motor sem acelerador: 350 + 18·|v| N · sem pedal e a < 1 m/s: freio 60 % (assistente de rampa)
 *     sin θ = (g_frente − g_trás) / entre-eixos  (rampa: sobe devagar, desce embalado)
 *     μ = 0,75 na trilha · 0,58 no capim · ×0,8 molhado
 *   GUINADA (bicicleta cinemática + limite de aderência)
 *     δ = direção · δ_max / (1 + |v|/9)                 (direção mais leve em velocidade, como nos SUVs)
 *     r_alvo = −v·tan δ / L                              (direita = guinada negativa)
 *     |r_alvo| ≤ k · a_lat_max / |v|,  k = 1 trilha · 1,08 capim · 1,5 freio de mão
 *                                                        (sem aderência o carro "sai de frente")
 *     r' = (r_alvo − r) / τ_guinada                      (τ = 0,12 s de inércia)
 *   PNEU LATERAL (círculo de atrito)
 *     a_lat_max = √((μ·g)² − a_long²)                    (frear ou acelerar forte reduz a curva)
 *     Δu = −u·(1 − e^(−k·h)) limitado a a_lat_max·h      (passou do limite → derrapa e escorrega)
 *     freio de mão (Espaço): traseira bloqueia → μ_lat × 0,5 e r_alvo × 1,35 (dá para "jogar" a traseira)
 *   COLISÃO  n = empurrão do obstáculo normalizado;  V −= (1 + e)·min(0, V·n)·n,  e = 0,15
 *            a componente tangencial perde 10 %; `impact` guarda a velocidade normal (tremor/som)
 * SUSPENSÃO (o chão sob cada roda vem do terreno)
 *   g_i = altura do terreno sob a roda i
 *   arfagem alvo = atan2(g_trás − g_frente, entre-eixos) − 0,008·a_long   (mergulha ao frear, agacha ao acelerar)
 *   rolagem alvo = atan2(g_esq − g_dir, bitola) + 0,009·a_lat            (inclina para fora da curva; a_lat = v·r)
 *   arfagem e rolagem: oscilador amortecido θ'' = ω²(θ_alvo − θ) − 2ζω·θ',  ω = 9 rad/s, ζ = 0,45
 *   carroceria: mola-amortecedor  y'' = k·(ȳ − y) − c·y',  k = 90, c = 11  (quica ao passar em lombadas)
 *   fora da trilha: costela de vaca  ±0,012 rad · min(1, v/8) de vibração nos alvos
 *   curso de cada roda = clamp(g_i − y; ±0,20 m): a roda acompanha o chão dentro do batente
 * CÂMBIO (só som e HUD): marcha k enquanto v < 0,92·gears[k];  rpm = 850 + 3150·v / gears[k]
 */

import * as THREE from 'three';
import { JEEP } from './config.js?v=23';
import { clamp, damp } from '../../shared/gfx/core.js';
import { pbrMaterial } from '../../shared/gfx/assets.js';
import { createHero } from '../../shared/gfx/hero.js';
import { wrapPi } from './utils.js?v=23';
import { rbox, loft, pipe, lathe, merge, mesh, xf, canvasTexture } from './geo.js?v=23';

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

const G = 9.81;
const SUB = 1 / 120;

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
        /** Velocidade no mundo (m/s) e as suas projeções no chassi. */
        this.vx = 0;
        this.vz = 0;
        this.speed = 0;
        this.slip = 0;
        this.yawRate = 0;
        this.steer = 0;
        this.delta = 0;
        this.throttle = 0;
        this.brake = 0;
        this.handbrake = false;
        this.aLong = 0;
        this.aLat = 0;
        this.pitch = 0;
        this.roll = 0;
        this.pitchV = 0;
        this.rollV = 0;
        this.odo = 0;
        this.impact = 0;
        this.gear = 1;
        this.rpm = 850;
        this.reverseHold = 0;
        this.lightsOn = true;
        this.onRoad = true;
        this.grip = 1;
        this.collider = null;
        this.head = new THREE.Vector3();
        this.driverState = { mode: 'sit', upper: 'ride', speed: 1 };
        this._out = { x: 0, z: 0, y: 0, speed: 0 };
    }

    reset(spawn, world) {
        this.x = spawn.x;
        this.z = spawn.z;
        this.yaw = spawn.yaw;
        this.vx = this.vz = 0;
        this.speed = this.slip = this.yawRate = 0;
        this.steer = this.delta = 0;
        this.throttle = this.brake = 0;
        this.aLong = this.aLat = 0;
        this.pitch = this.roll = this.pitchV = this.rollV = 0;
        this.vy = 0;
        this.impact = 0;
        this.gear = 1;
        this.rpm = 850;
        this.reverseHold = 0;
        this.y = world ? world.heightAt(this.x, this.z) : 0;
        // o jipe também é obstáculo para os dinossauros (dinâmico; ele mesmo se ignora em collide)
        if (world && !this.collider) this.collider = world.addCollider(this.x, this.z, 1.7, false);
        if (this.collider) {
            this.collider.x = this.x;
            this.collider.z = this.z;
        }
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

    /**
     * Empurrão externo (mordida do rex, batida): soma `dv` m/s na direção (dx, dz)
     * e um tranco de guinada. Usado pelo knockback de main.js.
     */
    push(dx, dz, dv, spin = 0) {
        const l = Math.hypot(dx, dz) || 1;
        this.vx += (dx / l) * dv;
        this.vz += (dz / l) * dv;
        this.yawRate += spin;
        this.vy += 1.6;
        this.pitchV -= 0.8;
        this.rollV += spin * 0.6;
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
        this.slope = (gF - gR) / (WB * 2);
        const target = (gF + gR) * 0.5;
        // costela de vaca fora da trilha: vibração pequena, só com o jipe andando
        const rough = this.onRoad ? 0 : 0.012 * Math.min(1, Math.abs(this.speed) / 8);
        const bumpP = rough * (Math.sin(this.odo * 2.3) + 0.6 * Math.sin(this.odo * 5.1 + 1.7));
        const bumpR = rough * (Math.sin(this.odo * 1.9 + 0.4) + 0.5 * Math.sin(this.odo * 4.3));
        const pitchT = Math.atan2(gR - gF, WB * 2) - clamp(this.aLong, -9, 9) * 0.008 + bumpP;
        const rollT = Math.atan2(gL - gRt, TR * 2) + clamp(this.aLat, -9, 9) * 0.009 + bumpR;
        if (snap) {
            this.y = target;
            this.vy = 0;
            this.pitch = pitchT;
            this.roll = rollT;
            this.pitchV = this.rollV = 0;
        } else {
            this.vy += (90 * (target - this.y) - 11 * this.vy) * dt;
            this.y += this.vy * dt;
            if (this.y < target - 0.12) {
                this.y = target - 0.12;
                if (this.vy < 0) this.vy = 0;
            } else if (this.y > target + 0.3) this.y = target + 0.3;
            // oscilador amortecido (ω = 9, ζ = 0,45)
            this.pitchV += (81 * (pitchT - this.pitch) - 8.1 * this.pitchV) * dt;
            this.rollV += (81 * (rollT - this.roll) - 8.1 * this.rollV) * dt;
            this.pitch = clamp(this.pitch + this.pitchV * dt, -0.5, 0.5);
            this.roll = clamp(this.roll + this.rollV * dt, -0.5, 0.5);
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

    /** Um passo de integração de `h` segundos (ver FÍSICA no cabeçalho). */
    _step(h, world, wet) {
        const J = JEEP;
        const m = J.mass;
        const sn = Math.sin(this.yaw);
        const cs = Math.cos(this.yaw);
        let v = this.vx * sn + this.vz * cs;
        let u = this.vx * cs - this.vz * sn;
        const av = Math.abs(v);
        const mu = (this.onRoad ? J.muRoad : J.muOff) * (1 - (1 - J.wetGrip) * wet);
        this.grip = mu;
        const muG = mu * G;

        // ── longitudinal ──
        let drive = 0;
        if (this.throttle !== 0) {
            const dir = Math.sign(this.throttle);
            const vDir = v * dir; // velocidade no sentido pedido
            const cap = dir > 0 ? J.governor : J.reverseMax;
            const gov = clamp((cap - vDir) / 1.5, 0, 1);
            // reduzida automática (4×4): subindo rampa devagar, a tração vai até o limite do pneu
            const climbing = (this.slope || 0) * dir > J.lowRangeSlope && Math.abs(vDir) < J.lowRangeSpeed;
            const fMax = climbing ? mu * m * G : J.maxForce;
            drive = dir * Math.abs(this.throttle) * Math.min(fMax, J.power / Math.max(1, Math.abs(vDir)), mu * m * G) * gov;
        }
        const crr = this.onRoad ? J.crrRoad : J.crrOff;
        let resist = crr * m * G + 0.5 * J.airDensity * J.cdA * v * v + (this.onRoad ? 0 : J.rough * v * v);
        if (this.throttle === 0) resist += J.engineBrake + 18 * av;
        const grade = -m * G * clamp(this.slope || 0, -0.6, 0.6);
        let a = (drive + grade) / m;
        // resistências e freio só se opõem ao movimento (e nunca o invertem)
        const stop = (resist + this.brake * m * Math.min(J.brakeDecel, muG) + (this.handbrake ? 0.5 * m * muG : 0)) / m;
        if (av > 0.02) {
            const dv = -Math.sign(v) * stop * h;
            const nv = v + a * h + dv;
            v = Math.sign(nv) !== Math.sign(v) && Math.abs(a) < stop ? 0 : nv;
        } else {
            // parado: só sai se a força vencer o atrito estático do conjunto
            v = Math.abs(a) > stop ? v + (a - Math.sign(a) * stop) * h : 0;
        }
        const aLong = (v - (this.vx * sn + this.vz * cs)) / h;

        // velocidade no mundo com o rumo antigo (o pneu só muda v; u segue pela inércia)
        let wx = sn * v + cs * u;
        let wz = cs * v - sn * u;

        // ── guinada ──
        const frontMax = Math.sqrt(Math.max(0.2, muG * muG - aLong * aLong));
        const latMu = muG * (this.handbrake ? 0.5 : 1);
        const latMax = Math.sqrt(Math.max(0.2, latMu * latMu - aLong * aLong));
        let rT = -v * Math.tan(this.delta) / J.wheelBase;
        if (this.handbrake && Math.abs(v) > 3) rT *= 1.35;
        // no asfalto/terra firme o pneu dianteiro satura primeiro (sai de frente);
        // no capim a traseira escapa um pouco; com o freio de mão ela gira de vez
        const over = this.handbrake ? 1.5 : this.onRoad ? 1.0 : 1.08;
        const rMax = (over * frontMax) / Math.max(1, Math.abs(v));
        rT = clamp(rT, -rMax, rMax);
        this.yawRate += (rT - this.yawRate) * (1 - Math.exp(-h / J.yawLag));
        this.yaw = wrapPi(this.yaw + this.yawRate * h);

        // ── pneu lateral no rumo novo: tira o deslizamento até o limite do círculo de atrito ──
        const s2 = Math.sin(this.yaw);
        const c2 = Math.cos(this.yaw);
        v = wx * s2 + wz * c2;
        u = wx * c2 - wz * s2;
        const want = -u * (1 - Math.exp(-J.latStiff * h));
        u += clamp(want, -latMax * h, latMax * h);
        this.vx = s2 * v + c2 * u;
        this.vz = c2 * v - s2 * u;
        this.speed = v;
        this.slip = u;
        this.aLong = damp(this.aLong, aLong, 12, h);
        this.aLat = damp(this.aLat, v * this.yawRate, 12, h);

        // ── posição, obstáculos e água ──
        const px = this.x;
        const pz = this.z;
        const nx = px + this.vx * h;
        const nz = pz + this.vz * h;
        const hit = world.collide(nx, nz, JEEP.radius, this.collider);
        if (hit.hit) {
            let ox = hit.x - nx;
            let oz = hit.z - nz;
            const ol = Math.hypot(ox, oz) || 1;
            ox /= ol;
            oz /= ol;
            const vn = this.vx * ox + this.vz * oz;
            if (vn < 0) {
                this.impact = Math.max(this.impact, -vn);
                this.vx -= 1.15 * vn * ox;
                this.vz -= 1.15 * vn * oz;
                this.vx *= 0.9;
                this.vz *= 0.9;
            }
        }
        if (world.flooded(hit.x, hit.z)) {
            // água funda (lago ou mar): o jipe não entra
            this.impact = Math.max(this.impact, Math.hypot(this.vx, this.vz) * 0.5);
            this.vx *= -0.2;
            this.vz *= -0.2;
        } else {
            this.x = hit.x;
            this.z = hit.z;
        }
        this.odo += Math.abs(v) * h;
    }

    update(dt, input, world, wet = 0) {
        dt = Math.min(dt, 1 / 20);
        const J = JEEP;
        const move = input.move;
        this.handbrake = !!move.handbrake;
        // pedais: frente = acelerador; trás = freio e, já parado, ré (após 0,25 s segurando)
        const z = Math.abs(move.z) < 0.08 ? 0 : move.z;
        this.throttle = 0;
        this.brake = 0;
        if (z > 0) {
            if (this.speed < -0.6) this.brake = z;
            else this.throttle = z;
            this.reverseHold = 0;
        } else if (z < 0) {
            if (this.speed > 0.6) {
                this.brake = -z;
                this.reverseHold = 0;
            } else {
                this.reverseHold += dt;
                if (this.reverseHold > 0.25 || this.speed < -0.2) this.throttle = z;
                else this.brake = -z;
            }
        } else {
            this.reverseHold = 0;
            // assistente de rampa: quase parado e sem pedal, o freio segura o jipe
            if (Math.abs(this.speed) < 1) this.brake = 0.6;
        }

        // caixa de direção com velocidade finita; ângulo máximo cai com a velocidade
        const steerIn = clamp(move.x, -1, 1);
        const rate = J.steerRate * (Math.abs(steerIn) < 0.05 ? 1.4 : 1) * dt;
        this.steer += clamp(steerIn - this.steer, -rate, rate);
        this.delta = this.steer * J.steerMax / (1 + Math.abs(this.speed) / 9);
        this.onRoad = world.onRoad(this.x, this.z);

        const n = Math.max(1, Math.ceil(dt / SUB));
        const h = dt / n;
        for (let i = 0; i < n; i++) this._step(h, world, wet);
        if (this.collider) {
            this.collider.x = this.x;
            this.collider.z = this.z;
        }
        this._place(world, dt);

        // câmbio automático (som e HUD)
        const av = Math.abs(this.speed);
        if (this.speed < -0.3) this.gear = -1;
        else {
            const G4 = J.gears;
            let g = 0;
            while (g < G4.length - 1 && av > G4[g] * (g + 1 === this.gear ? 0.95 : 0.88)) g++;
            this.gear = g + 1;
        }
        const top = this.gear < 0 ? J.reverseMax * 1.2 : J.gears[this.gear - 1];
        const rpmT = 850 + 3150 * clamp(av / top, 0, 1.05) + (Math.abs(this.throttle) > 0 && av < 1 ? 900 * Math.abs(this.throttle) : 0);
        this.rpm = damp(this.rpm, rpmT, 10, dt);

        // rodas: giro = distância / raio; as dianteiras esterçam
        const spin = (this.speed * dt) / WR;
        for (const w of this.wheels) {
            w.spin.rotation.x += spin;
            if (w.front) w.pivot.rotation.y = -this.delta;
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
