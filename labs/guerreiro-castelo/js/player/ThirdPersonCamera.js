/**
 * Câmera em terceira pessoa (three.js) — órbita, ombro, zoom, colisão e screen shake.
 *
 * Posição desejada a partir do alvo T (cabeça do jogador), guinada ψ e inclinação θ:
 *   trás = (sin ψ·cos θ, sin θ, cos ψ·cos θ)      direita = (cos ψ, 0, −sin ψ)
 *   C = T + trás·d + direita·ombro
 * Colisão: três raios T → C (centro e ±0,25 m de lado, um "tubo" grosso como a lente)
 * contra as caixas/terreno do nível (CollisionWorld.rayHit, no referencial local do nível);
 * vale o mais curto, d = max(1,1; batida − 0,3). Para não enxergar através das paredes a
 * aproximação é imediata e o afastamento é amortecido (clip ← clip + 1,8·dt, ~0,5 s).
 *
 * Suavização exponencial (independente do fps): x ← x + (alvo − x)·(1 − e^(−λ·dt)),
 * λ = 14/s na posição, 16/s no olhar.
 * Auto-recentralizar: com Dico andando e sem mexer na câmera por 1,2 s, a guinada vai
 * aos poucos para trás dele (λ = 0,9/s × fração da velocidade) — como em A Short Hike.
 * Tremor: amplitude cai linearmente; com prefers-reduced-motion vale 35 %.
 */

import * as THREE from 'three';
import { clamp, damp, angleDamp } from '../utils/math.js?v=50';

const REDUCED = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const _t = new THREE.Vector3();
const _d = new THREE.Vector3();
const _o = new THREE.Vector3();
const _c = new THREE.Vector3();
const _inv = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _look = new THREE.Vector3();

export class ThirdPersonCamera {
    constructor(camera) {
        this.camera = camera;
        this.yaw = 0;
        this.pitch = 0.32;
        this.distance = 5.4;
        this.targetDistance = 5.4;
        this.minDistance = 2.2;
        this.maxDistance = 9.2;
        this.pitchMin = -0.55;
        this.pitchMax = 1.15;
        this.shoulder = 0.55;
        this.lookHeight = 1.55;
        this.fov = 0.95; // radianos (~55°)
        this.targetFov = 0.95;
        this.shake = 0;
        this.shakeAmp = 0;
        this.currentPos = new THREE.Vector3(0, 2, 6);
        this.smoothLook = new THREE.Vector3(0, 1.5, 0);
        this.cutscene = false;
        /* colisão: mundo (CollisionWorld) + referencial local (Object3D) do nível */
        this.world = null;
        this.space = null;
        this.collide = true;
        this.clip = 99;
        /* enquadramento alternativo (leme do navio): { distance, height, pitch } */
        this.override = null;
        this.idleLook = 0;
        this._dt = 1 / 60;
    }

    /** Liga a colisão da câmera ao mundo do nível. `space` = objeto cujo referencial local é o da colisão. */
    setWorld(world, space = null, collide = true) {
        this.world = world;
        this.space = space;
        this.collide = collide;
        this.clip = 99;
    }

    addShake(amp = 0.12, time = 0.25) {
        this.shake = Math.max(this.shake, time);
        this.shakeAmp = Math.max(this.shakeAmp, REDUCED ? amp * 0.35 : amp);
    }

    /** Raio do alvo até a câmera (local): distância livre. */
    _ray(ox, oy, oz, dx, dy, dz, len) {
        return this.world.rayHit(ox, oy, oz, dx, dy, dz, len);
    }

    /** Calcula a posição desejada (out) e o alvo de olhar (look), já com a colisão aplicada. */
    _desired(player, out, look) {
        player.worldPosition(_o);
        const ov = this.override;
        const h = ov ? ov.height : player.crouching ? 1.15 : this.lookHeight;
        look.set(_o.x, _o.y + h, _o.z);
        const pitch = ov ? Math.max(this.pitch, ov.pitch) : this.pitch;
        const dist = ov ? ov.distance : this.distance;
        const cosP = Math.cos(pitch);
        _d.set(Math.sin(this.yaw) * cosP, Math.sin(pitch), Math.cos(this.yaw) * cosP);
        const sh = ov ? 0 : this.shoulder;
        out.copy(look).addScaledVector(_d, dist);
        out.x += Math.cos(this.yaw) * sh;
        out.z -= Math.sin(this.yaw) * sh;
        if (!this.collide || !this.world) return;
        // raio alvo → câmera no referencial local do nível
        _t.copy(look);
        _c.copy(out);
        if (this.space) {
            _inv.copy(this.space.matrixWorld).invert();
            _t.applyMatrix4(_inv);
            _c.applyMatrix4(_inv);
        }
        _c.sub(_t);
        const len = _c.length();
        if (len < 0.01) return;
        _c.multiplyScalar(1 / len);
        const reach = len + 0.3;
        let hit = this._ray(_t.x, _t.y, _t.z, _c.x, _c.y, _c.z, reach);
        /* raios laterais: perpendicular horizontal à direção (−dz, dx) · 0,25 m */
        const hl = Math.hypot(_c.x, _c.z) || 1;
        const sx = (-_c.z / hl) * 0.25;
        const sz = (_c.x / hl) * 0.25;
        hit = Math.min(hit, this._ray(_t.x + sx, _t.y, _t.z + sz, _c.x, _c.y, _c.z, reach));
        hit = Math.min(hit, this._ray(_t.x - sx, _t.y, _t.z - sz, _c.x, _c.y, _c.z, reach));
        const k = hit < reach ? Math.max(1.1, hit - 0.3) / len : 1;
        // aproxima na hora, afasta aos poucos
        this.clip = k < this.clip ? k : Math.min(1, k, this.clip + 1.8 * this._dt);
        if (this.clip < 1) out.sub(look).multiplyScalar(this.clip).add(look);
    }

    snapToPlayer(player) {
        this.cutscene = false;
        this.clip = 99;
        player.root.updateWorldMatrix(true, false);
        this._desired(player, this.currentPos, this.smoothLook);
        this.camera.position.copy(this.currentPos);
        this.camera.lookAt(this.smoothLook);
    }

    update(dt, player, lookDelta, zoomDelta, sprinting) {
        if (this.cutscene) return;
        this._dt = dt;

        const looking = Math.abs(lookDelta.x) + Math.abs(lookDelta.y) > 0.01;
        this.yaw -= lookDelta.x * 0.0036;
        this.pitch = clamp(this.pitch - lookDelta.y * 0.003, this.pitchMin, this.pitchMax);
        this.idleLook = looking ? 0 : this.idleLook + dt;
        /* recentraliza atrás de Dico quando ele anda e ninguém mexe na câmera */
        if (!this.override && this.idleLook > 1.2 && player.speed > 1 && player.controller?.mode === 'walk') {
            const behind = player.facing + Math.PI;
            const off = Math.abs(Math.atan2(Math.sin(behind - this.yaw), Math.cos(behind - this.yaw)));
            /* andando em direção à câmera (off > 100°) não gira: evita o "chicote" de 180° */
            if (off < 1.75) {
                const k = Math.min(1, player.speed / 4.6);
                this.yaw = angleDamp(this.yaw, behind, 0.9 * k, dt);
            }
        }
        this.targetDistance = clamp(this.targetDistance + zoomDelta * 0.45, this.minDistance, this.maxDistance);
        this.distance = damp(this.distance, this.targetDistance, 8, dt);

        this.targetFov = sprinting ? 1.08 : 0.95;
        const fov = damp(this.fov, this.targetFov, 4, dt);
        if (Math.abs(fov - this.fov) > 1e-4) {
            this.fov = fov;
            this.camera.fov = THREE.MathUtils.radToDeg(fov);
            this.camera.updateProjectionMatrix();
        }

        this._desired(player, _pos, _look);

        this.currentPos.x = damp(this.currentPos.x, _pos.x, 14, dt);
        this.currentPos.y = damp(this.currentPos.y, _pos.y, 12, dt);
        this.currentPos.z = damp(this.currentPos.z, _pos.z, 14, dt);
        if (this.collide && this.clip < 1) this.currentPos.copy(_pos); // encostado na parede: sem atraso

        this.smoothLook.x = damp(this.smoothLook.x, _look.x, 16, dt);
        this.smoothLook.y = damp(this.smoothLook.y, _look.y, 16, dt);
        this.smoothLook.z = damp(this.smoothLook.z, _look.z, 16, dt);

        this.camera.position.copy(this.currentPos);
        if (this.shake > 0) {
            this.shake -= dt;
            const a = this.shakeAmp * Math.min(1, Math.max(0, this.shake / 0.25));
            this.camera.position.x += (Math.random() - 0.5) * a;
            this.camera.position.y += (Math.random() - 0.5) * a * 0.6;
            if (this.shake <= 0) this.shakeAmp = 0;
        }
        this.camera.lookAt(this.smoothLook);
    }

    setCutscenePose(pos, look) {
        this.camera.position.copy(pos);
        this.camera.lookAt(look);
        this.currentPos.copy(pos);
        this.smoothLook.copy(look);
    }
}
