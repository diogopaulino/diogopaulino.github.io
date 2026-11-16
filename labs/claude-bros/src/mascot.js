/* Claude Bros — o mascote jogável.
 *
 * Criatura original de barro terracota: cabeça grande, máscara clara no rosto,
 * crista de "faísca" (cinco pétalas em leque, de frente para trás), rabinho,
 * mãos e pés escuros e um cachecol verde-água com duas pontas que seguem o vento.
 *
 * Malha: uma única SkinnedMesh esculpida por campo de distância (ver sculpt.js)
 * com 13 ossos — bacia, peito, cabeça, 2×(braço, antebraço), 2×(coxa, canela, pé).
 * Olhos, sobrancelhas, boca e crista são malhas presas ao osso da cabeça.
 *
 * Animação: procedural por canais. Cada estado (parado, correr, pular, cair,
 * derrapar, dano, vitória) escreve uma pose-alvo; a pose final é a soma
 * ponderada dos estados e cada canal persegue o alvo com amortecimento
 * exponencial  c += (alvo − c)·(1 − e^(−λ·dt)),  λ = 18 — as trocas de estado
 * saem contínuas, sem "pulo" de pose.
 *
 *   ciclo de corrida: fase φ avança 2π a cada STRIDE metros percorridos
 *     coxa   = −0,95·sin φ          (perna oposta: φ + π)
 *     joelho = 0,15 + 1,1·max(0, cos φ)   (dobra na recuperação, estica no apoio)
 *     braço  = +0,9·sin φ (oposto à perna do mesmo lado)
 *   squash & stretch: mola amortecida na escala Y (k = 260, c = 15), com volume
 *     preservado  sXZ = 1/√sY ; pouso dá um impulso negativo proporcional à queda.
 */
import * as THREE from 'three';
import { pbrSet } from '../../shared/gfx/assets.js';
import { applyWorldUV, clamp, damp } from '../../shared/gfx/core.js';
import { createSculpt } from './sculpt.js';
import { RUN_SPEED, MAX_FALL, U } from './config.js';

const TERRACOTTA = 0xcf6240;
const CREAM = 0xf0d2b0;
const DARK = 0x4f2418;
const TEAL = 0x2a9d93;

const SCALE = 1.15;   // o boneco é um pouco maior que a caixa de colisão (24×28 px)
const STRIDE = 1.25; // metros por ciclo completo (dois passos)
const B = { hips: 0, chest: 1, head: 2, armLU: 3, armLL: 4, armRU: 5, armRL: 6, legLU: 7, legLL: 8, legRU: 9, legRL: 10, footL: 11, footR: 12 };

/* Canais da pose (índices num Float32Array). */
const CH = [
    'rootY', 'pitch', 'roll', 'chestPitch', 'twist', 'headPitch', 'headYaw',
    'armLX', 'armLZ', 'elbL', 'armRX', 'armRZ', 'elbR',
    'legLX', 'kneeL', 'legRX', 'kneeR', 'footL', 'footR', 'legSpread',
    'eye', 'browTilt', 'browLift', 'mouth', 'wide', 'happy', 'stretch'
];
const C = Object.fromEntries(CH.map((name, i) => [name, i]));

function sculptBody(cell) {
    const s = createSculpt();
    // tronco
    s.ellipsoid([0, 0.30, 0], [0.165, 0.15, 0.14], { bone: B.hips, color: TERRACOTTA });
    s.ellipsoid([0, 0.42, 0], [0.15, 0.13, 0.125], { bone: B.chest, color: TERRACOTTA, k: 0.06 });
    // rabo com ponta clara
    s.capsule([0, 0.27, -0.11], [0, 0.34, -0.23], 0.05, 0.03, { bone: B.hips, color: TERRACOTTA, k: 0.05 });
    s.capsule([0, 0.34, -0.23], [0, 0.40, -0.27], 0.03, 0.014, { bone: B.hips, color: CREAM, k: 0.02 });
    // cachecol
    s.torus([0, 0.522, 0.005], 0.112, 0.042, { bone: B.chest, color: TEAL, k: 0.012, sy: 0.85 });
    // cabeça + bochechas
    s.ellipsoid([0, 0.70, 0.01], [0.245, 0.215, 0.215], { bone: B.head, color: TERRACOTTA, k: 0.03 });
    s.ellipsoid([0.125, 0.645, 0.1], [0.1, 0.085, 0.095], { bone: B.head, color: TERRACOTTA, k: 0.06 });
    s.ellipsoid([-0.125, 0.645, 0.1], [0.1, 0.085, 0.095], { bone: B.head, color: TERRACOTTA, k: 0.06 });
    for (const side of [1, -1]) {
        const up = side > 0 ? B.armLU : B.armRU;
        const low = side > 0 ? B.armLL : B.armRL;
        s.capsule([0.15 * side, 0.46, 0], [0.235 * side, 0.36, 0], 0.054, 0.046, { bone: up, color: TERRACOTTA, k: 0.035 });
        s.capsule([0.235 * side, 0.36, 0], [0.272 * side, 0.27, 0.015], 0.046, 0.047, { bone: low, color: TERRACOTTA, k: 0.03 });
        s.ellipsoid([0.282 * side, 0.238, 0.02], [0.06, 0.066, 0.062], { bone: low, color: DARK, k: 0.03 });
        const lu = side > 0 ? B.legLU : B.legRU;
        const ll = side > 0 ? B.legLL : B.legRL;
        const ft = side > 0 ? B.footL : B.footR;
        s.capsule([0.085 * side, 0.22, 0], [0.092 * side, 0.125, 0.008], 0.07, 0.058, { bone: lu, color: TERRACOTTA, k: 0.04 });
        s.capsule([0.092 * side, 0.125, 0.008], [0.095 * side, 0.05, 0], 0.056, 0.052, { bone: ll, color: TERRACOTTA, k: 0.03 });
        s.ellipsoid([0.097 * side, 0.042, 0.04], [0.066, 0.044, 0.105], { bone: ft, color: DARK, k: 0.03 });
    }
    // pintura: máscara do rosto, barriga e rubor
    s.paint([0, 0.672, 0.2], [0.205, 0.17, 0.13], CREAM, 0.18);
    s.paint([0, 0.33, 0.13], [0.115, 0.125, 0.08], CREAM, 0.3);
    s.paint([0.15, 0.628, 0.165], [0.05, 0.04, 0.05], 0xf08f78, 0.7);
    s.paint([-0.15, 0.628, 0.165], [0.05, 0.04, 0.05], 0xf08f78, 0.7);
    const geo = s.build({ cell, bones: 13, skinSoft: 0.028, colorSoft: 0.006 });
    applyWorldUV(geo, 0.3);
    return geo;
}

function sculptCrest(cell) {
    // Cinco pétalas em leque no plano YZ, pivô na origem (topo da cabeça).
    const s = createSculpt();
    const petals = [[-1.25, 0.15], [-0.66, 0.2], [-0.06, 0.25], [0.55, 0.2], [1.12, 0.14]];
    s.ellipsoid([0, -0.02, 0], [0.06, 0.035, 0.1], { color: 0xcf6240 });
    for (const [a, len] of petals) {
        const dir = [0, Math.cos(a), Math.sin(a)];
        const base = [0, dir[1] * 0.01, dir[2] * 0.045];
        const mid = [0, dir[1] * len * 0.55, dir[2] * len * 0.55 + dir[2] * 0.03];
        const tip = [0, dir[1] * len, dir[2] * len + dir[2] * 0.03];
        s.capsule(base, mid, 0.026, 0.034, { color: 0xe2703a, k: 0.012 });
        s.capsule(mid, tip, 0.034, 0.008, { color: 0xffb24a, k: 0.012 });
    }
    return s.build({ cell: cell * 0.8 });
}

function buildSkeleton() {
    const rest = [
        [0, 0.24, 0, -1], [0, 0.38, 0, B.hips], [0, 0.52, 0, B.chest],
        [0.15, 0.46, 0, B.chest], [0.235, 0.36, 0, B.armLU], [-0.15, 0.46, 0, B.chest], [-0.235, 0.36, 0, B.armRU],
        [0.085, 0.22, 0, B.hips], [0.092, 0.125, 0.008, B.legLU], [-0.085, 0.22, 0, B.hips], [-0.092, 0.125, 0.008, B.legRU],
        [0.095, 0.05, 0, B.legLL], [-0.095, 0.05, 0, B.legRL]
    ];
    const bones = rest.map(() => new THREE.Bone());
    rest.forEach(([x, y, z, parent], i) => {
        if (parent < 0) bones[i].position.set(x, y, z);
        else {
            const p = rest[parent];
            bones[i].position.set(x - p[0], y - p[1], z - p[2]);
            bones[parent].add(bones[i]);
        }
    });
    return bones;
}

export function createMascot({ cell = 0.016 } = {}) {
    const group = new THREE.Group();   // posição no mundo (pés)
    const turn = new THREE.Group();    // guinada (para onde olha)
    const squash = new THREE.Group();  // squash & stretch a partir dos pés
    group.add(turn);
    turn.add(squash);
    turn.scale.setScalar(SCALE);

    const skinMat = new THREE.MeshPhysicalMaterial({
        vertexColors: true,
        roughness: 0.58,
        sheen: 0.22,
        sheenColor: new THREE.Color(0xe89a70),
        sheenRoughness: 0.5,
        normalMap: pbrSet('rough_plaster_03').normalMap,
        envMapIntensity: 0.75
    });
    skinMat.normalScale.set(0.28, 0.28);

    const bones = buildSkeleton();
    const body = new THREE.SkinnedMesh(sculptBody(cell), skinMat);
    body.add(bones[0]);
    body.bind(new THREE.Skeleton(bones));
    body.castShadow = true;
    body.receiveShadow = true;
    body.frustumCulled = false;
    squash.add(body);

    /* ---- rosto (preso ao osso da cabeça; coordenadas relativas a ele) ---- */
    const head = bones[B.head];
    const HY = 0.52;
    const eyeWhiteMat = new THREE.MeshPhysicalMaterial({ color: 0xfffaf0, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.08 });
    const darkMat = new THREE.MeshPhysicalMaterial({ color: 0x24120c, roughness: 0.18, clearcoat: 1 });
    const mouthMat = new THREE.MeshStandardMaterial({ color: 0x5a1c1c, roughness: 0.5 });
    const browMat = new THREE.MeshStandardMaterial({ color: 0x4f2418, roughness: 0.6 });
    const BROW_Y = 0.796;
    const ball = new THREE.SphereGeometry(1, 24, 16);
    const eyes = [];
    for (const side of [1, -1]) {
        const eye = new THREE.Group();
        eye.position.set(0.082 * side, 0.705 - HY, 0.196);
        eye.rotation.y = 0.26 * side;
        const white = new THREE.Mesh(ball, eyeWhiteMat);
        white.scale.set(0.064, 0.08, 0.03);
        const pupil = new THREE.Mesh(ball, darkMat);
        pupil.scale.set(0.036, 0.047, 0.012);
        pupil.position.set(0, -0.006, 0.024);
        const glint = new THREE.Mesh(ball, eyeWhiteMat);
        glint.scale.set(0.012, 0.012, 0.005);
        glint.position.set(0.012, 0.014, 0.034);
        eye.add(white, pupil, glint);
        head.add(eye);
        // olho feliz/fechado: arco escuro
        const arc = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.009, 8, 18, Math.PI), darkMat);
        arc.position.set(0.082 * side, 0.69 - HY, 0.222);
        arc.rotation.y = 0.26 * side;
        arc.visible = false;
        head.add(arc);
        const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.0095, 0.05, 6, 12), browMat);
        brow.position.set(0.086 * side, BROW_Y - HY, 0.203);
        brow.rotation.set(-0.3, 0.26 * side, Math.PI / 2);
        head.add(brow);
        eyes.push({ eye, pupil, glint, arc, brow, side });
    }
    const mouthOpen = new THREE.Mesh(ball, mouthMat);
    mouthOpen.position.set(0, 0.612 - HY, 0.222);
    head.add(mouthOpen);
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.0075, 8, 18, Math.PI), darkMat);
    smile.position.set(0, 0.628 - HY, 0.224);
    smile.rotation.set(-0.12, 0, Math.PI);
    head.add(smile);

    const crest = new THREE.Mesh(sculptCrest(cell), new THREE.MeshPhysicalMaterial({
        vertexColors: true, roughness: 0.45, emissive: 0xff5a14, emissiveIntensity: 0.1
    }));
    crest.position.set(0, 0.905 - HY, -0.01);
    crest.castShadow = true;
    head.add(crest);

    /* ---- pontas do cachecol: duas fitas simuladas no espaço do mundo ---- */
    const RIB = 7;           // nós por fita
    const SEG = 0.075;       // comprimento do segmento (m)
    const ribbonGeo = new THREE.BufferGeometry();
    const ribPos = new Float32Array(2 * RIB * 2 * 3);
    const ribIdx = [];
    for (let r = 0; r < 2; r++) {
        for (let i = 0; i < RIB - 1; i++) {
            const a = (r * RIB + i) * 2;
            ribIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
    }
    ribbonGeo.setAttribute('position', new THREE.BufferAttribute(ribPos, 3));
    ribbonGeo.setIndex(ribIdx);
    const ribbon = new THREE.Mesh(ribbonGeo, new THREE.MeshStandardMaterial({ color: TEAL, roughness: 0.75, side: THREE.DoubleSide }));
    ribbon.frustumCulled = false;
    ribbon.castShadow = true;
    const nodes = new Float32Array(2 * RIB * 3);
    const anchor = new THREE.Vector3();
    let ribbonReady = false;

    /* ---- estado da animação ---- */
    const pose = new Float32Array(CH.length);
    const target = new Float32Array(CH.length);
    const tmp = new Float32Array(CH.length);
    pose[C.eye] = 1;
    let phase = 0;
    let yaw = 0.92;
    let sY = 1;
    let sVel = 0;
    let crestA = 0;
    let crestV = 0;
    let blink = 2;
    let time = 0;
    let spin = 0;
    let lookX = 0;
    const w = { run: 0, air: 0, skid: 0, hurt: 0, win: 0 };

    const add = (weight, values) => {
        if (weight <= 0.0001) return;
        for (const key in values) target[C[key]] += values[key] * weight;
    };

    /** Impulso de squash (negativo achata, positivo estica). */
    function impulse(v) {
        sVel += v;
    }

    /**
     * @param {number} dt
     * @param {object} s  { x, y (m, pés), vx, vy (px/s da lógica), grounded, facing, skid, mode, visible }
     *                    mode: 'play' | 'hurt' | 'win' | 'menu'
     */
    function update(dt, s) {
        time += dt;
        const speed = clamp(Math.abs(s.vx) / RUN_SPEED, 0, 1);
        const airborne = !s.grounded && s.mode !== 'menu';
        w.hurt = damp(w.hurt, s.mode === 'hurt' ? 1 : 0, 16, dt);
        w.win = damp(w.win, s.mode === 'win' && s.grounded ? 1 : 0, 10, dt);
        w.skid = damp(w.skid, s.skid && s.mode === 'play' ? 1 : 0, 18, dt);
        w.air = damp(w.air, airborne ? 1 : 0, 22, dt);
        w.run = damp(w.run, s.grounded && s.mode === 'play' ? speed : 0, 14, dt);

        phase += Math.abs(s.vx) * U * dt * (Math.PI * 2 / STRIDE);
        const sn = Math.sin(phase);
        const cs = Math.cos(phase);

        target.fill(0);
        const wHurt = w.hurt;
        const wWin = w.win * (1 - wHurt);
        const rest = (1 - wHurt) * (1 - wWin);
        const wAir = w.air * rest;
        const wSkid = w.skid * (1 - w.air) * rest;
        const wRun = w.run * (1 - w.air) * (1 - w.skid) * rest;
        const wIdle = Math.max(0, rest - wAir - wSkid - wRun);

        // parado: respira, balança os braços e olha em volta
        add(wIdle, {
            rootY: Math.sin(time * 2.3) * 0.006, chestPitch: Math.sin(time * 2.3 + 0.6) * 0.03,
            headYaw: Math.sin(time * 0.55) * 0.28, headPitch: Math.sin(time * 0.8) * 0.05,
            armLZ: 0.05 + Math.sin(time * 2.3) * 0.04, armRZ: 0.05 + Math.sin(time * 2.3) * 0.04,
            armLX: Math.sin(time * 1.1) * 0.08, armRX: -Math.sin(time * 1.1) * 0.08,
            eye: 1, mouth: 0.05, wide: 1
        });
        // corrida
        add(wRun, {
            rootY: -0.012 + Math.abs(sn) * 0.03, pitch: 0.24, twist: sn * 0.3, headPitch: -0.14, roll: 0,
            legLX: -0.95 * sn, kneeL: 0.15 + 1.1 * Math.max(0, cs), footL: 0.3 * Math.max(0, -cs) - 0.25 * Math.max(0, sn),
            legRX: 0.95 * sn, kneeR: 0.15 + 1.1 * Math.max(0, -cs), footR: 0.3 * Math.max(0, cs) - 0.25 * Math.max(0, -sn),
            armLX: 0.95 * sn, armRX: -0.95 * sn, elbL: -1.15, elbR: -1.15, armLZ: -0.12, armRZ: -0.12,
            eye: 1, browTilt: 0.18, mouth: 0.35, wide: 0.8
        });
        // no ar: sobe encolhido e de braços para cima; cai de pernas soltas e braços abanando
        const rising = clamp(-s.vy / 300, 0, 1);
        const falling = clamp(s.vy / 300, 0, 1);
        const flail = Math.sin(time * 19) * 0.22 * falling;
        add(wAir, {
            pitch: 0.05 + 0.1 * falling - 0.08 * rising, headPitch: -0.2 * rising + 0.12 * falling,
            legLX: -1.0 * rising - 0.25 * falling, kneeL: 1.35 * rising + 0.35 * falling, footL: 0.4,
            legRX: -0.25 * rising + 0.4 * falling, kneeR: 0.8 * rising + 0.55 * falling, footR: 0.5,
            armLZ: 1.9 * rising + 1.45 * falling + flail, armRZ: 1.6 * rising + 1.45 * falling - flail,
            armLX: -0.5 * rising, armRX: 0.25 * rising, elbL: -0.35, elbR: -0.5,
            eye: 1.12, browLift: 0.5 + 0.5 * falling, mouth: 0.75, wide: 0.55,
            stretch: 0.1 * clamp(Math.abs(s.vy) / MAX_FALL, 0, 1)
        });
        // derrapagem: corpo para trás, pés para a frente, braços no equilíbrio
        add(wSkid, {
            pitch: -0.42, headPitch: 0.3, rootY: -0.03,
            legLX: -0.95, kneeL: 0.25, footL: 0.55, legRX: -0.55, kneeR: 0.5, footR: 0.3,
            armLX: -1.1, armRX: -0.7, armLZ: 0.7, armRZ: 0.9, elbL: -0.3, elbR: -0.5,
            eye: 0.75, browTilt: 0.45, mouth: 0.3, wide: 1.4
        });
        // dano: membros abertos, olhos fechados
        add(wHurt, {
            armLZ: 1.7, armRZ: 1.7, legLX: -0.5, legRX: 0.5, kneeL: 0.5, kneeR: 0.5, legSpread: 0.45,
            headPitch: -0.35, eye: 0.08, browTilt: -0.5, browLift: 0.6, mouth: 1, wide: 0.9
        });
        // vitória: pulinhos de braços abertos, olhos de sorriso
        const hop = Math.abs(Math.sin(time * 5.2));
        add(wWin, {
            rootY: hop * 0.16, headPitch: -0.2, roll: Math.sin(time * 5.2) * 0.08,
            armLZ: 2.25 + Math.sin(time * 10.4) * 0.25, armRZ: 2.25 - Math.sin(time * 10.4) * 0.25, elbL: -0.2, elbR: -0.2,
            legLX: -0.35 * hop, kneeL: 0.8 * hop, legRX: -0.2 * hop, kneeR: 0.6 * hop, legSpread: 0.12,
            eye: 1, happy: 1, mouth: 1, wide: 1.25, browLift: 0.7, stretch: 0.05 * hop
        });

        const k = 1 - Math.exp(-18 * dt);
        for (let i = 0; i < pose.length; i++) pose[i] += (target[i] - pose[i]) * k;

        // piscar: fecha por ~110ms a cada 2–5s
        blink -= dt;
        if (blink < -0.11) blink = 2 + Math.random() * 3;
        const lid = blink < 0 ? 0.06 : 1;

        // guinada: 53° para o lado do movimento (¾ de perfil, o rosto continua à vista); na vitória encara a câmera
        const yawTarget = s.mode === 'win' ? 0.15 : s.mode === 'menu' ? 0.55 : s.facing * 0.92;
        yaw = damp(yaw, yawTarget, 13, dt);
        spin = s.mode === 'hurt' ? spin + dt * 9 : damp(spin, 0, 20, dt);

        // squash & stretch (mola)
        const sTarget = 1 + pose[C.stretch];
        sVel += ((sTarget - sY) * 260 - sVel * 15) * dt;
        sY = clamp(sY + sVel * dt, 0.55, 1.4);
        const sXZ = 1 / Math.sqrt(sY);

        group.position.set(s.x, s.y, 0);
        turn.rotation.y = yaw;
        squash.scale.set(sXZ, sY, sXZ);
        squash.rotation.z = s.mode === 'hurt' ? -Math.sin(spin) * 0.5 : 0;
        squash.position.y = 0;

        bones[B.hips].position.y = 0.24 + pose[C.rootY];
        bones[B.hips].rotation.set(pose[C.pitch], 0, pose[C.roll]);
        bones[B.chest].rotation.set(pose[C.chestPitch], pose[C.twist], 0);
        bones[B.head].rotation.set(pose[C.headPitch], pose[C.headYaw] - pose[C.twist] * 0.6, 0);
        bones[B.armLU].rotation.set(pose[C.armLX], 0, pose[C.armLZ]);
        bones[B.armRU].rotation.set(pose[C.armRX], 0, -pose[C.armRZ]);
        bones[B.armLL].rotation.set(pose[C.elbL], 0, 0);
        bones[B.armRL].rotation.set(pose[C.elbR], 0, 0);
        bones[B.legLU].rotation.set(pose[C.legLX] - pose[C.pitch] * 0.6, 0, pose[C.legSpread]);
        bones[B.legRU].rotation.set(pose[C.legRX] - pose[C.pitch] * 0.6, 0, -pose[C.legSpread]);
        bones[B.legLL].rotation.set(pose[C.kneeL], 0, 0);
        bones[B.legRL].rotation.set(pose[C.kneeR], 0, 0);
        bones[B.footL].rotation.set(pose[C.footL] - pose[C.kneeL] * 0.45, 0, 0);
        bones[B.footR].rotation.set(pose[C.footR] - pose[C.kneeR] * 0.45, 0, 0);

        // rosto
        lookX = damp(lookX, Math.sin(pose[C.headYaw]) * 0.5, 8, dt);
        const happy = pose[C.happy] > 0.5;
        const open = clamp(pose[C.eye], 0, 1.2) * lid;
        for (const e of eyes) {
            e.eye.visible = !happy;
            e.arc.visible = happy;
            e.eye.scale.set(1, Math.max(0.06, open), 1);
            e.pupil.position.x = lookX * 0.03;
            e.pupil.position.y = -0.006;
            e.brow.position.y = BROW_Y - HY + pose[C.browLift] * 0.02 - pose[C.browTilt] * 0.01;
            e.brow.rotation.z = Math.PI / 2 - e.side * pose[C.browTilt] * 0.9;
        }
        const m = clamp(pose[C.mouth], 0, 1);
        const big = m > 0.2;
        mouthOpen.visible = big;
        smile.visible = !big;
        mouthOpen.scale.set(0.02 + 0.026 * pose[C.wide], 0.008 + 0.036 * m, 0.012);
        smile.scale.set(clamp(pose[C.wide], 0.5, 1.4), 1, 1);

        // crista: mola que reage à aceleração vertical e à corrida
        const crestTarget = clamp(s.vy / MAX_FALL, -1, 1) * 0.45 - speed * 0.22 + Math.sin(time * 3.1) * 0.03;
        crestV += ((crestTarget - crestA) * 180 - crestV * 9) * dt;
        crestA += crestV * dt;
        crest.rotation.x = crestA;
        crest.scale.set(1, 1 + clamp(-crestA, -0.3, 0.3) * 0.2, 1);

        group.visible = s.visible !== false;
        ribbon.visible = group.visible;
        updateRibbon(dt, s);
    }

    /* Cada nó persegue o anterior a um segmento de distância, puxado por gravidade,
       pelo vento e pelo contrário da velocidade do personagem; o que sobra do
       atraso vira a ondulação. */
    function updateRibbon(dt, s) {
        group.updateMatrixWorld(true);
        const vxm = s.vx * U;
        const vym = -s.vy * U;
        for (let r = 0; r < 2; r++) {
            anchor.set(r === 0 ? 0.035 : -0.035, 0.135, -0.125).applyMatrix4(bones[B.chest].matrixWorld);
            const o = r * RIB * 3;
            if (!ribbonReady) {
                for (let i = 0; i < RIB; i++) {
                    nodes[o + i * 3] = anchor.x - i * SEG * 0.3;
                    nodes[o + i * 3 + 1] = anchor.y - i * SEG;
                    nodes[o + i * 3 + 2] = anchor.z;
                }
            }
            nodes[o] = anchor.x;
            nodes[o + 1] = anchor.y;
            nodes[o + 2] = anchor.z;
            for (let i = 1; i < RIB; i++) {
                const n = o + i * 3;
                const wave = Math.sin(time * 7 - i * 0.9 + r * 1.7) * 0.5;
                let dx = -vxm * 0.55 - 0.9 + wave * 0.15;    // vento sopra para −x
                let dy = -vym * 0.5 - 1.6 + wave * 0.9 * clamp(Math.abs(vxm) / 5 + 0.25, 0, 1);
                let dz = -0.35 + (r === 0 ? 0.25 : -0.25) * 0.4;
                const dl = Math.hypot(dx, dy, dz) || 1;
                const tx = nodes[n - 3] + (dx / dl) * SEG;
                const ty = nodes[n - 2] + (dy / dl) * SEG;
                const tz = nodes[n - 1] + (dz / dl) * SEG;
                const f = 1 - Math.exp(-(26 - i * 2) * dt);
                nodes[n] += (tx - nodes[n]) * f;
                nodes[n + 1] += (ty - nodes[n + 1]) * f;
                nodes[n + 2] += (tz - nodes[n + 2]) * f;
                // mantém o comprimento do segmento
                let ex = nodes[n] - nodes[n - 3];
                let ey = nodes[n + 1] - nodes[n - 2];
                let ez = nodes[n + 2] - nodes[n - 1];
                const el = Math.hypot(ex, ey, ez) || 1;
                nodes[n] = nodes[n - 3] + (ex / el) * SEG;
                nodes[n + 1] = nodes[n - 2] + (ey / el) * SEG;
                nodes[n + 2] = nodes[n - 1] + (ez / el) * SEG;
            }
            for (let i = 0; i < RIB; i++) {
                const n = o + i * 3;
                const p = i === 0 ? n : n - 3;
                const q = i === 0 ? n + 3 : n;
                const ex = nodes[q] - nodes[p];
                const ey = nodes[q + 1] - nodes[p + 1];
                const el = Math.hypot(ex, ey) || 1;
                // largura perpendicular ao segmento, no plano da tela (dir × z)
                const half = 0.034 * (1 - i / RIB * 0.45);
                const wx = (ey / el) * half;
                const wy = (-ex / el) * half;
                const v = (r * RIB + i) * 6;
                ribPos[v] = nodes[n] + wx; ribPos[v + 1] = nodes[n + 1] + wy; ribPos[v + 2] = nodes[n + 2];
                ribPos[v + 3] = nodes[n] - wx; ribPos[v + 4] = nodes[n + 1] - wy; ribPos[v + 5] = nodes[n + 2];
            }
        }
        ribbonReady = true;
        ribbonGeo.attributes.position.needsUpdate = true;
        ribbonGeo.computeVertexNormals();
    }

    /** Reposiciona as fitas (renascimento/teleporte) para não esticarem pela fase. */
    function snap() {
        ribbonReady = false;
        sY = 1;
        sVel = 0;
    }

    return { group, ribbon, update, impulse, snap, bones };
}
