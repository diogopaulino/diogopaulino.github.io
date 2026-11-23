/**
 * camera — decupagem do filme (research.md §7): 13 planos em 7 capítulos.
 *
 * Cada plano tem trilho de posição (Catmull-Rom por 2–3 chaves), alvo, FOV e foco.
 * Planos `rel` vivem no referencial do Kasato Maru (x bombordo, z proa) e são
 * levados ao mundo pela pose do navio no instante t — a câmera nunca "erra" o navio
 * e não atravessa o casco, porque as chaves ficam fora do volume do modelo.
 * Cortes secos com fade de 0,45 s (post.params.fade). Arrastar = olhar em volta;
 * soltar devolve o olhar ao trilho.
 */
import * as THREE from 'three';
import { FILM_DURATION, kasatoPose } from './config.js';
import { clamp, lerp, smoothstep } from '../../shared/gfx/core.js';

const SHIP = (x, y, z) => ({ ship: [x, y, z] });

/** t0, t1, rel?, pos[], look[] (ponto fixo, [x,y,z] ou {ship:[…]} relativo ao navio), fov[], dof (alcance; 0 = tudo em foco) */
const SHOTS = [
    // — Mar aberto —
    { t0: 0, t1: 13, rel: true, pos: [[-125, 6, 205], [-104, 4.6, 160], [-86, 3.6, 124]], look: [SHIP(0, 10, 6), SHIP(0, 10, 0)], fov: [34, 31], dof: 0 },
    { t0: 13, t1: 28, rel: true, pos: [[-46, 62, -168], [-36, 45, -122], [-30, 35, -94]], look: [SHIP(4, 8, 70), SHIP(6, 6, 90)], fov: [40, 38], dof: 0, fog: 0.65 },
    // — Estuário —
    { t0: 28, t1: 42, rel: true, pos: [[-235, 17, 75], [-205, 12, 28], [-178, 9, -14]], look: [SHIP(0, 10, 6), SHIP(0, 10, 0)], fov: [31, 28], dof: 0 },
    { t0: 42, t1: 55, rel: true, pos: [[-1.2, 9.95, 55.4], [-1.2, 9.95, 55.4]], look: [SHIP(22, 7.5, 180), SHIP(46, 6.5, 180)], fov: [50, 46], dof: 0 },
    // — Porto do café —
    { t0: 55, t1: 69, pos: [[12.6, 4.05, -16], [12.2, 3.95, -44], [12.6, 4.1, -70]], look: [[9, 3.4, -100], [-24, 6, -190]], fov: [44, 40], dof: 60 },
    { t0: 69, t1: 82, pos: [[36, 27, -132], [32, 24, -100], [29, 22.5, -74]], look: [SHIP(0, 8, 0), SHIP(0, 8, 10)], fov: [38, 34], dof: 0 },
    { t0: 82, t1: 95, pos: [[-150, 3.0, 100], [-136, 3.2, 64], [-122, 3.5, 34]], look: [SHIP(0, 10, 14), SHIP(0, 10, 6)], fov: [36, 33], dof: 0 },
    // — Atracação · 9h30 —
    { t0: 95, t1: 110, pos: [[4.3, 4.1, 86], [4.7, 4.0, 79]], look: [SHIP(0, 7.5, 54), SHIP(-1, 8, 46)], fov: [38, 34], dof: 40 },
    { t0: 110, t1: 125, pos: [[-68, 54, -48], [-57, 41, -20], [-50, 34, 6]], look: [[-3, 5, -6], [1, 5, 8]], fov: [36, 33], dof: 0, fog: 0.7 },
    // — Olhar dos passageiros —
    { t0: 125, t1: 138, rel: true, pos: [[3.6, 6.2, -46], [3.6, 6.2, -42], [3.6, 6.25, -38.6]], look: [SHIP(46, 7.0, -16), SHIP(46, 7.6, 2)], fov: [48, 44], dof: 70, focus: 28 },
    { t0: 138, t1: 148, pos: [[17.6, 10.9, -34], [17.0, 10.6, -21]], look: [SHIP(7.2, 8.1, -21), SHIP(7.2, 8.1, -11)], fov: [17, 15], dof: 9 },
    // — Valongo —
    { t0: 148, t1: 162, pos: [[48.6, 3.7, 212], [49.4, 4.0, 231], [50.4, 4.5, 246]], look: [[56.5, 5.5, 282], [58, 7.5, 292]], fov: [42, 38], dof: 45 },
    // — Porto e cidade —
    { t0: 162, t1: 180, pos: [[150, 48, 70], [215, 106, 120], [300, 186, 176]], look: [[-60, 12, -10], [-230, 34, -60]], fov: [38, 44], dof: 0, fog: 0.4 }
];

const _pose = {};
const _v = new THREE.Vector3();

function toWorld(p, t, out) {
    kasatoPose(t, _pose);
    const c = Math.cos(_pose.heading);
    const s = Math.sin(_pose.heading);
    return out.set(_pose.x + p[0] * c + p[2] * s, p[1], _pose.z - p[0] * s + p[2] * c);
}

export function createCamera(ctx) {
    const { camera, canvas, post } = ctx;
    const curves = SHOTS.map((sh) => new THREE.CatmullRomCurve3(sh.pos.map((p) => new THREE.Vector3(...p)), false, 'centripetal'));
    const state = {
        filmT: 0, playing: false, yaw: 0, pitch: 0, drag: false, lastX: 0, lastY: 0, release: 0,
        rate: 1, ended: false
    };
    const pos = new THREE.Vector3();
    const look = new THREE.Vector3();
    const la = new THREE.Vector3();
    const lb = new THREE.Vector3();
    const dir = new THREE.Vector3();
    const sph = new THREE.Spherical();

    const onDown = (e) => {
        state.drag = true;
        state.lastX = e.clientX;
        state.lastY = e.clientY;
        state.release = 0;
    };
    const onMove = (e) => {
        if (!state.drag) return;
        state.yaw -= (e.clientX - state.lastX) * 0.004;
        state.pitch = clamp(state.pitch - (e.clientY - state.lastY) * 0.003, -0.6, 0.6);
        state.yaw = clamp(state.yaw, -1.6, 1.6);
        state.lastX = e.clientX;
        state.lastY = e.clientY;
    };
    const onUp = () => {
        if (state.drag) state.release = 0.001;
        state.drag = false;
    };
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('blur', onUp); // arrasto preso quando a janela perde o foco

    const resolve = (ref, t, out) => (ref.ship ? toWorld(ref.ship, t, out) : out.set(ref[0], ref[1], ref[2]));

    function apply(t) {
        if (state.debug) {
            // modo de inspeção (window.__lab.free): câmera fixa fora do trilho
            camera.position.fromArray(state.debug.pos);
            look.fromArray(state.debug.look);
            camera.lookAt(look);
            camera.fov = state.debug.fov || 45;
            camera.updateProjectionMatrix();
            if (post) { post.params.dofRange = 0; post.params.fade = 1; }
            return look;
        }
        const time = clamp(t, 0, FILM_DURATION - 0.001);
        let i = 0;
        while (i < SHOTS.length - 1 && time >= SHOTS[i].t1) i++;
        const sh = SHOTS[i];
        const raw = clamp((time - sh.t0) / (sh.t1 - sh.t0), 0, 1);
        const u = lerp(raw, smoothstep(0, 1, raw), 0.4);
        curves[i].getPoint(u, pos);
        if (sh.rel) toWorld([pos.x, pos.y, pos.z], time, pos);
        resolve(sh.look[0], time, la);
        resolve(sh.look[1], time, lb);
        look.lerpVectors(la, lb, u);

        camera.position.copy(pos);
        if (state.yaw || state.pitch) {
            dir.subVectors(look, pos);
            const dist = dir.length();
            sph.setFromVector3(dir);
            sph.theta += state.yaw;
            sph.phi = clamp(sph.phi + state.pitch, 0.25, Math.PI - 0.25);
            look.copy(pos).add(_v.setFromSpherical(sph).setLength(dist));
        }
        camera.lookAt(look);
        const fov = lerp(sh.fov[0], sh.fov[1], u);
        // em retrato, abre o campo para o assunto caber
        const portrait = camera.aspect < 1 ? lerp(1, 2.1, clamp(1 - camera.aspect, 0, 1)) : 1;
        const f = Math.min(82, fov * portrait);
        if (Math.abs(camera.fov - f) > 0.02) {
            camera.fov = f;
            camera.updateProjectionMatrix();
        }
        if (post) {
            post.params.dofRange = sh.dof;
            // planos aéreos atravessam muita bruma: aliviamos para o porto continuar legível
            post.params.fogDensity = ctx.fogBase * (sh.fog ?? 1);
            post.params.fogSunGlow = ctx.glowBase * (sh.fog ?? 1);
            post.params.dofFocus = sh.focus ?? pos.distanceTo(look);
            const fade = Math.min(1, (time - sh.t0) / 0.45, (sh.t1 - time) / 0.4);
            post.params.fade = smoothstep(0, 1, clamp(fade, 0, 1));
        }
        return look;
    }

    return {
        get filmT() { return state.filmT; },
        get playing() { return state.playing; },
        set playing(v) { state.playing = v; if (v) state.ended = false; },
        get ended() { return state.ended; },
        /** Velocidade de reprodução (0,5× / 1× / 2×) — o filme inteiro, não só o navio. */
        get rate() { return state.rate; },
        set rate(v) { state.rate = v; },
        look,
        restart() {
            state.filmT = 0;
            state.ended = false;
            state.yaw = state.pitch = 0;
            apply(0);
        },
        free(pos, lookAt, fov) { state.debug = pos ? { pos, look: lookAt, fov } : null; },
        seek(t) {
            state.filmT = clamp(t, 0, FILM_DURATION - 0.01);
            state.ended = false;
            state.yaw = state.pitch = 0;
            apply(state.filmT);
        },
        update(dt) {
            if (state.playing) {
                state.filmT += dt * state.rate;
                // fim do filme: para no último quadro (main.js mostra o cartão final)
                if (state.filmT >= FILM_DURATION - 0.01) {
                    state.filmT = FILM_DURATION - 0.01;
                    state.playing = false;
                    state.ended = true;
                }
            }
            if (state.release > 0 && !state.drag) {
                state.release += dt;
                const k = 1 - Math.exp(-dt * 2.2 * smoothstep(0.3, 1.2, state.release));
                state.yaw *= 1 - k;
                state.pitch *= 1 - k;
                if (Math.abs(state.yaw) + Math.abs(state.pitch) < 0.002) {
                    state.yaw = state.pitch = 0;
                    state.release = 0;
                }
            }
            apply(state.filmT);
        },
        dispose() {
            canvas.removeEventListener('pointerdown', onDown);
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
            window.removeEventListener('blur', onUp);
        }
    };
}
