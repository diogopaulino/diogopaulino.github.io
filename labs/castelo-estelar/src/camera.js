/**
 * Câmera da abertura: um plano-sequência, sem cortes.
 *
 * Posição, alvo, lente e foco são interpolados por Hermite cúbico com tangentes
 * de Catmull-Rom para tempos não uniformes (contínuo em velocidade nos quadros-chave):
 *   m_i = (p_{i+1} − p_{i−1}) / (t_{i+1} − t_{i−1})
 *   p(u) = h00·p_i + h10·Δt·m_i + h01·p_{i+1} + h11·Δt·m_{i+1},  u = (t − t_i)/Δt
 * As pontas têm tangente nula: a câmera parte e pousa em repouso (ease in/out).
 *
 * Roteiro (s): 0–8 rasante sobre o lago · 8–14 subida e revelação · 14–23 a fada
 * sobe em hélice · 23 a estrela acende · 24–34 fogos, recuo baixo com reflexo ·
 * 34–38 pouso na órbita livre.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const INTRO_DURATION = 38;
/** Intervalo do voo da fada e instante em que o castelo começa a acender. */
export const FAIRY = [13.2, 23];

//            t     posição              alvo             fov  foco(0 = alvo)
const KEYS = [
    [0.0, [-18, 1.5, 212], [-8, 16, 60], 30],
    [4.5, [-4, 1.9, 164], [-4, 22, 30], 31],
    [8.5, [10, 4.5, 126], [0, 30, 4], 32],
    [12.0, [22, 17, 102], [0, 38, 0], 33],
    [15.5, [30, 31, 88], [2, 42, -2], 34],
    [19.5, [14, 40, 76], [5, 47, -4], 35],
    [23.0, [-14, 38, 70], [6, 50, -5], 36],
    [27.5, [-38, 12, 124], [2, 50, -10], 44],
    [31.5, [-24, 6, 178], [2, 40, -8], 44],
    [35.0, [6, 9, 156], [2, 34, 0], 41],
    [38.0, [30, 13, 124], [2, 30, 0], 38]
].map(([t, pos, look, fov]) => ({ t, v: [...pos, ...look, fov] }));

const out = new Float64Array(7);

function sample(time) {
    const t = Math.min(INTRO_DURATION, Math.max(0, time));
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1].t <= t) i++;
    const a = KEYS[i];
    const b = KEYS[i + 1];
    const dt = b.t - a.t;
    const u = (t - a.t) / dt;
    const u2 = u * u;
    const u3 = u2 * u;
    const h00 = 2 * u3 - 3 * u2 + 1;
    const h10 = u3 - 2 * u2 + u;
    const h01 = -2 * u3 + 3 * u2;
    const h11 = u3 - u2;
    const p = KEYS[i - 1];
    const n = KEYS[i + 2];
    for (let k = 0; k < 7; k++) {
        const m0 = p ? (b.v[k] - p.v[k]) / (b.t - p.t) : 0;
        const m1 = n ? (n.v[k] - a.v[k]) / (n.t - a.t) : 0;
        out[k] = h00 * a.v[k] + h10 * dt * m0 + h01 * b.v[k] + h11 * dt * m1;
    }
    return out;
}

export class CineCamera {
    constructor(camera, canvas, groundAt) {
        this.camera = camera;
        this.groundAt = groundAt;
        this.mode = 'intro';
        this.t = 0;
        this.focus = 100;
        this.look = new THREE.Vector3();
        this.controls = new OrbitControls(camera, canvas);
        const c = this.controls;
        c.enableDamping = true;
        c.dampingFactor = 0.06;
        c.minDistance = 42;
        c.maxDistance = 190;
        c.maxPolarAngle = Math.PI * 0.6;
        c.minPolarAngle = 0.5;
        c.enablePan = false;
        c.autoRotate = true;
        c.autoRotateSpeed = 0.35;
        c.enabled = false;
        // qualquer gesto do usuário desliga o giro automático
        c.addEventListener('start', () => { c.autoRotate = false; });
    }

    playIntro() {
        this.mode = 'intro';
        this.t = 0;
        this.controls.enabled = false;
        this.apply(0);
    }

    skip() {
        this.t = INTRO_DURATION;
        this.enterOrbit();
    }

    enterOrbit() {
        this.mode = 'orbit';
        this.apply(INTRO_DURATION);
        this.controls.target.copy(this.look);
        this.controls.autoRotate = true;
        this.controls.enabled = true;
        this.controls.update();
    }

    apply(time) {
        const k = sample(time);
        this.camera.position.set(k[0], k[1], k[2]);
        this.look.set(k[3], k[4], k[5]);
        this.camera.up.set(0, 1, 0);
        this.camera.lookAt(this.look);
        if (Math.abs(this.camera.fov - k[6]) > 0.01) {
            this.camera.fov = k[6];
            this.camera.updateProjectionMatrix();
        }
        this.focus = this.camera.position.distanceTo(this.look);
    }

    /** Em retrato o castelo não cabe na lente da abertura: abre o campo. */
    fitAspect() {
        const a = this.camera.aspect;
        this.fovBoost = a < 1 ? 1.75 : a < 1.5 ? 1.25 : 1;
    }

    tick(dt) {
        if (this.mode === 'intro') {
            this.t += dt;
            this.apply(this.t);
            if (this.t >= INTRO_DURATION) this.enterOrbit();
        } else {
            this.controls.update();
            // nunca atravessa o chão nem a água
            const p = this.camera.position;
            const floor = Math.max(0, this.groundAt(p.x, p.z)) + 1.6;
            if (p.y < floor) p.y = floor;
            this.focus = p.distanceTo(this.controls.target);
        }
        if (this.fovBoost && this.fovBoost !== 1) {
            const base = this.mode === 'intro' ? sample(this.t)[6] : 38;
            const f = Math.min(78, base * this.fovBoost);
            if (Math.abs(this.camera.fov - f) > 0.01) {
                this.camera.fov = f;
                this.camera.updateProjectionMatrix();
            }
        }
    }
}
