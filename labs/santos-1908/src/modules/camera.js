/**
 * camera — trilho cinematográfico (arco research.md §7).
 * Arraste para olhar; soltar volta ao trilho (estilo Sakura / Tupi).
 */

import * as THREE from 'three';
import { FILM_DURATION, LAYOUT } from '../config.js';
import { clamp, smoothstep, lerp } from '../utils.js';
import { kasatoPose } from './kasato.js';

const KEYS = [
    // Mar aberto — acompanha o navio
    { t: 0, pos: [-25, 18, 320], look: [-8, 8, 280], fov: 38 },
    { t: 20, pos: [-30, 14, 240], look: [-10, 10, 200], fov: 40 },
    // Estuário — serra entra no quadro
    { t: 35, pos: [-55, 22, 140], look: [20, 8, 40], fov: 42 },
    { t: 50, pos: [-40, 28, 60], look: [40, 12, -20], fov: 44 },
    // Porto vivo
    { t: 70, pos: [5, 16, 30], look: [35, 8, -40], fov: 46 },
    { t: 90, pos: [10, 12, -10], look: [30, 6, -45], fov: 42 },
    // Atracação
    { t: 110, pos: [8, 10, -55], look: [20, 8, -40], fov: 40 },
    // Deck / passageiros
    { t: 130, pos: [-4, 15, -12], look: [16, 8, -42], fov: 42 },
    // Valongo
    { t: 150, pos: [35, 14, 40], look: [55, 8, 55], fov: 44 },
    // Ascensão
    { t: 165, pos: [-20, 55, 20], look: [50, 10, -20], fov: 50 },
    { t: 180, pos: [-40, 85, 80], look: [60, 15, -40], fov: 52 }
];

function catmull(p0, p1, p2, p3, t) {
    const t2 = t * t;
    const t3 = t2 * t;
    return 0.5 * (
        (2 * p1)
        + (-p0 + p2) * t
        + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
        + (-p0 + 3 * p1 - 3 * p2 + p3) * t3
    );
}

function sampleVector(field, i, u) {
    const p0 = KEYS[Math.max(0, i - 1)][field];
    const p1 = KEYS[i][field];
    const p2 = KEYS[i + 1][field];
    const p3 = KEYS[Math.min(KEYS.length - 1, i + 2)][field];
    return p1.map((_, axis) => catmull(p0[axis], p1[axis], p2[axis], p3[axis], u));
}

function sampleTrack(t) {
    const time = ((t % FILM_DURATION) + FILM_DURATION) % FILM_DURATION;
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1].t < time) i++;

    const a = KEYS[i];
    const b = KEYS[i + 1];
    const u = clamp((time - a.t) / Math.max(0.001, b.t - a.t), 0, 1);

    return {
        pos: sampleVector('pos', i, u),
        look: sampleVector('look', i, u),
        fov: lerp(a.fov, b.fov, smoothstep(0, 1, u)),
        time
    };
}

export function create(ctx) {
    const { camera, canvas } = ctx;
    const state = {
        mode: 'rail', // rail | free
        filmT: 0,
        playing: false,
        userYaw: 0,
        userPitch: 0,
        drag: false,
        lastX: 0,
        lastY: 0,
        returnT: 0,
        _pos: new THREE.Vector3(),
        _look: new THREE.Vector3(),
        _desiredLook: new THREE.Vector3()
    };

    const onDown = (e) => {
        state.drag = true;
        state.mode = 'free';
        state.returnT = 0;
        state.lastX = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
        state.lastY = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
    };
    const onMove = (e) => {
        if (!state.drag) return;
        const x = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
        const y = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
        const dx = x - state.lastX;
        const dy = y - state.lastY;
        state.lastX = x;
        state.lastY = y;
        state.userYaw -= dx * 0.004;
        state.userPitch -= dy * 0.003;
        state.userPitch = clamp(state.userPitch, -0.6, 0.6);
    };
    const onUp = () => {
        state.drag = false;
        state.returnT = 0.01;
    };

    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    function applyRail(t) {
        const k = sampleTrack(t);
        // Ajuste fino: look segue o Kasato no início
        const kp = kasatoPose(t);
        if (t < 100) {
            const blend = smoothstep(0, 40, t) * (1 - smoothstep(85, 100, t));
            k.look[0] = lerp(k.look[0], kp.x, blend * 0.65);
            k.look[1] = lerp(k.look[1], 8, blend * 0.5);
            k.look[2] = lerp(k.look[2], kp.z, blend * 0.65);
        }
        state._pos.set(...k.pos);
        state._look.set(...k.look);
        camera.position.copy(state._pos);
        camera.lookAt(state._look);
        if (Math.abs(camera.fov - k.fov) > 0.05) {
            camera.fov = k.fov;
            camera.updateProjectionMatrix();
        }
        state.userYaw = 0;
        state.userPitch = 0;
    }

    function applyFree(t) {
        const k = sampleTrack(t);
        camera.position.set(...k.pos);
        const base = new THREE.Vector3(...k.look);
        const dir = base.clone().sub(camera.position).normalize();
        const spherical = new THREE.Spherical().setFromVector3(dir);
        spherical.theta += state.userYaw;
        spherical.phi = clamp(spherical.phi + state.userPitch, 0.2, Math.PI - 0.2);
        const look = camera.position.clone().add(new THREE.Vector3().setFromSpherical(spherical).multiplyScalar(40));
        camera.lookAt(look);
        camera.fov = k.fov;
        camera.updateProjectionMatrix();
    }

    return {
        get filmT() { return state.filmT; },
        set playing(v) { state.playing = v; },
        get playing() { return state.playing; },
        restart() {
            state.filmT = 0;
            state.mode = 'rail';
            state.userYaw = 0;
            state.userPitch = 0;
            applyRail(0);
        },
        skipTo(t) {
            state.filmT = clamp(t, 0, FILM_DURATION);
            applyRail(state.filmT);
        },
        update(dt) {
            if (state.playing) {
                state.filmT += dt;
                if (state.filmT >= FILM_DURATION) state.filmT = 0;
            }
            if (state.returnT > 0 && !state.drag) {
                state.returnT += dt;
                const u = smoothstep(0.4, 2.2, state.returnT);
                state.userYaw *= 1 - u;
                state.userPitch *= 1 - u;
                if (u >= 1) {
                    state.mode = 'rail';
                    state.returnT = 0;
                }
            }
            if (state.mode === 'free' || state.drag || state.returnT > 0) applyFree(state.filmT);
            else applyRail(state.filmT);
        },
        dispose() {
            canvas.removeEventListener('pointerdown', onDown);
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
        }
    };
}

void LAYOUT;
