/* Claude Bros — os rivais: "musgosos", pedregulhos vivos cobertos de musgo.
 *
 * Corpo esculpido por campo de distância (sculpt.js): um seixo irregular com
 * testa saliente (o ar rabugento), capa de musgo escorrendo pelos lados, dois
 * pés de pedra separados (que dão os passos) e um brotinho de duas folhas no
 * topo. A geometria é compartilhada entre todos; cada rival tem só transformações.
 *
 * Animação:
 *   andar   — fase φ = x / PASSO; pés alternam  y = max(0, sin φ)·0,09 e
 *             z = cos φ·0,1 ; o corpo balança (roll = sin φ·0,08) e quica.
 *   pisado  — mola rápida até sY = 0,22 (sXZ = 1,35), olhos fechados; quando
 *             `squash` da lógica cai abaixo de 0,3 o rival encolhe e some.
 */
import * as THREE from 'three';
import { pbrMaterial } from '../../shared/gfx/assets.js';
import { applyWorldUV, damp } from '../../shared/gfx/core.js';
import { createSculpt, lumps } from './sculpt.js';
import { toX, toY, U } from './config.js';

const STONE = 0xb9b0a2;
const STONE_DARK = 0x8d8578;
const MOSS = 0x8fc93a;
const STEP = 0.42; // metros por ciclo de passos

function sculptBody(cell) {
    const s = createSculpt();
    s.ellipsoid([0, 0.34, 0], [0.37, 0.3, 0.33], { color: STONE });
    s.ellipsoid([0.2, 0.4, -0.12], [0.2, 0.2, 0.2], { color: STONE, k: 0.08 });
    s.ellipsoid([-0.22, 0.3, 0.08], [0.2, 0.2, 0.22], { color: STONE_DARK, k: 0.08 });
    // testa saliente
    s.capsule([-0.2, 0.5, 0.25], [0.2, 0.5, 0.25], 0.06, 0.06, { color: STONE_DARK, k: 0.05 });
    // capa de musgo + escorridos
    s.ellipsoid([0, 0.55, -0.04], [0.35, 0.17, 0.31], { color: MOSS, k: 0.035 });
    s.capsule([0.3, 0.52, 0.1], [0.36, 0.33, 0.12], 0.06, 0.025, { color: MOSS, k: 0.03 });
    s.capsule([-0.31, 0.5, -0.05], [-0.38, 0.28, -0.06], 0.06, 0.02, { color: MOSS, k: 0.03 });
    s.capsule([0.05, 0.55, -0.3], [0.06, 0.3, -0.35], 0.07, 0.025, { color: MOSS, k: 0.03 });
    s.capsule([-0.18, 0.6, 0.2], [-0.24, 0.52, 0.3], 0.05, 0.02, { color: MOSS, k: 0.03 });
    s.displace((x, y, z) => lumps(x, y, z, 1.4) * 0.012 * (y > 0.5 ? 0.5 : 1));
    const geo = s.build({ cell });
    applyWorldUV(geo, 0.7);
    return geo;
}

function sculptFoot(cell) {
    const s = createSculpt();
    s.ellipsoid([0, 0.06, 0.02], [0.1, 0.075, 0.14], { color: STONE_DARK });
    s.ellipsoid([0, 0.04, 0.1], [0.085, 0.05, 0.07], { color: STONE, k: 0.04 });
    s.displace((x, y, z) => lumps(x, y, z, 2) * 0.006);
    const geo = s.build({ cell: cell * 0.8 });
    applyWorldUV(geo, 0.5);
    return geo;
}

function sculptSprout(cell) {
    const s = createSculpt();
    s.capsule([0, 0, 0], [0.01, 0.11, 0], 0.014, 0.01, { color: 0x6f9a2a });
    s.ellipsoid([0.07, 0.15, 0], [0.075, 0.018, 0.04], { color: 0x9fd24a, k: 0.02 });
    s.ellipsoid([-0.06, 0.17, 0.01], [0.065, 0.018, 0.036], { color: 0xb4e060, k: 0.02 });
    return s.build({ cell: cell * 0.55 });
}

export function createCritters(scene, { cell = 0.02 } = {}) {
    const bodyGeo = sculptBody(cell);
    const footGeo = sculptFoot(cell);
    const sproutGeo = sculptSprout(cell);
    const ball = new THREE.SphereGeometry(1, 20, 14);
    const rockMat = pbrMaterial('mossy_rock', { vertexColors: true, normalScale: 1.1, envMapIntensity: 0.7 });
    rockMat.color.setScalar(2.1); // a textura é escura; clareia para o rival ler bem contra o capim
    const leafMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 });
    const whiteMat = new THREE.MeshPhysicalMaterial({ color: 0xfff6dc, roughness: 0.12, clearcoat: 1 });
    const irisMat = new THREE.MeshStandardMaterial({ color: 0xffa51f, roughness: 0.25, emissive: 0xff7a00, emissiveIntensity: 0.25 });
    const pupilMat = new THREE.MeshStandardMaterial({ color: 0x1a1108, roughness: 0.2 });
    const list = [];

    function make() {
        const group = new THREE.Group();
        const turn = new THREE.Group();
        const bodyPivot = new THREE.Group();
        group.add(turn);
        turn.add(bodyPivot);
        const body = new THREE.Mesh(bodyGeo, rockMat);
        body.castShadow = true;
        body.receiveShadow = true;
        bodyPivot.add(body);
        const sprout = new THREE.Mesh(sproutGeo, leafMat);
        sprout.position.set(0.03, 0.7, -0.03);
        sprout.castShadow = true;
        bodyPivot.add(sprout);
        const eyes = [];
        for (const side of [1, -1]) {
            const eye = new THREE.Group();
            eye.position.set(0.13 * side, 0.37, 0.283);
            eye.rotation.y = 0.32 * side;
            const white = new THREE.Mesh(ball, whiteMat);
            white.scale.set(0.092, 0.1, 0.045);
            const iris = new THREE.Mesh(ball, irisMat);
            iris.scale.set(0.058, 0.064, 0.016);
            iris.position.z = 0.034;
            const pupil = new THREE.Mesh(ball, pupilMat);
            pupil.scale.set(0.028, 0.036, 0.01);
            pupil.position.z = 0.047;
            eye.add(white, iris, pupil);
            bodyPivot.add(eye);
            eyes.push(eye);
        }
        const feet = [];
        for (const side of [1, -1]) {
            const foot = new THREE.Mesh(footGeo, rockMat);
            foot.castShadow = true;
            foot.position.set(0.17 * side, 0, 0.02);
            turn.add(foot);
            feet.push(foot);
        }
        scene.add(group);
        return { group, turn, bodyPivot, sprout, eyes, feet, yaw: -0.9, sY: 1, sV: 0, gone: 0, wob: 0, wobV: 0 };
    }

    /** Garante um boneco por rival da lógica e zera a animação. */
    function sync(enemies) {
        while (list.length < enemies.length) list.push(make());
        list.forEach((c, i) => {
            c.group.visible = i < enemies.length;
            c.sY = 1;
            c.sV = 0;
            c.gone = 0;
            c.group.scale.setScalar(1);
        });
    }

    function update(dt, enemies, time) {
        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            const c = list[i];
            if (!c) continue;
            const x = toX(e.x + e.w / 2);
            const y = toY(e.y + e.h);
            c.group.position.set(x, y, 0);
            const dir = Math.sign(e.vx) || 1;
            c.yaw = damp(c.yaw, dir * 0.95, 9, dt);
            c.turn.rotation.y = c.yaw;

            let target = 1;
            if (!e.alive) target = 0.22;
            c.sV += ((target - c.sY) * 420 - c.sV * 22) * dt;
            c.sY += c.sV * dt;
            const sXZ = e.alive ? 1 / Math.sqrt(Math.max(0.3, c.sY)) : 1 + (1 - c.sY) * 0.45;

            const phi = (e.x * U) / STEP * Math.PI * 2;
            const walking = e.alive && e.grounded ? 1 : 0;
            c.bodyPivot.position.y = 0.05 + Math.abs(Math.sin(phi)) * 0.035 * walking;
            c.bodyPivot.rotation.z = Math.sin(phi) * 0.08 * walking;
            c.bodyPivot.rotation.x = 0.06 * walking;
            c.bodyPivot.scale.set(sXZ, c.sY, sXZ);
            c.feet[0].position.set(0.17, Math.max(0, Math.sin(phi)) * 0.09 * walking, 0.02 + Math.cos(phi) * 0.1 * walking);
            c.feet[1].position.set(-0.17, Math.max(0, -Math.sin(phi)) * 0.09 * walking, 0.02 - Math.cos(phi) * 0.1 * walking);
            c.feet[0].rotation.x = -Math.max(0, Math.sin(phi)) * 0.5 * walking;
            c.feet[1].rotation.x = -Math.max(0, -Math.sin(phi)) * 0.5 * walking;

            // brotinho: mola excitada pelos passos
            const wobT = Math.sin(phi * 2) * 0.25 * walking;
            c.wobV += ((wobT - c.wob) * 120 - c.wobV * 6) * dt;
            c.wob += c.wobV * dt;
            c.sprout.rotation.z = c.wob;

            // piscar por ~120ms a cada ~3s; pisado fica de olho fechado
            const blinking = !e.alive || e.blink % 3 < 0.12;
            for (const eye of c.eyes) eye.scale.y = blinking ? 0.08 : 1;

            // some depois de achatado
            if (!e.alive) {
                c.gone = e.squash < 0.3 ? damp(c.gone, 1, 14, dt) : 0;
                c.group.scale.setScalar(Math.max(0.0001, 1 - c.gone));
                c.group.visible = e.squash > 0.001 && y > -6;
            } else {
                c.group.visible = y > -6;
            }
        }
    }

    return { sync, update, list };
}
