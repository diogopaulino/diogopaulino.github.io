/**
 * Câmera em terceira pessoa (órbita) com colisão — referência de sensação: A Short Hike /
 * Mario Odyssey. Constantes em config.js → CAMERA.
 *
 *   pivô    P = João + (0, lookY, 0), suavizado: λ_xz = 14; λ_y = 12 no apoio, 5 no ar
 *           (o pulo não sacode a tela; queda rápida soma |v_y|·0,6 para não perder o João)
 *   órbita  d̂ = (sin yaw·cos pitch, sin pitch, cos yaw·cos pitch) · C = P + d̂·dist
 *   recentra  sem mexer na câmera por `idleLook` s e andando: yaw → atrás do João
 *           (λ = recenter·min(1, v/v_andar)); não recentra se ele vem na direção da câmera
 *   caule   yaw → azimute do João ± climbSide (de lado, para a folha-alvo aparecer),
 *           pitch → climbPitch (+0,22 com folha mirada), distância × climbDist
 *   colisão raio P → C amostrado a cada ≤ 0,3 m contra: caixas (paredes), cilindro do caule
 *           (casca + 0,15 m),
 *           lâminas das folhas (faixa de ±0,5 m na superfície, pegada + 0,35 m), terreno
 *           (+0,3 m) — a distância encolhe na hora (λ = 40) e volta devagar (λ = 3)
 *   piso    C_y ≥ chão(C) + 0,45 · dentro do salão do castelo, presa às paredes
 */

import * as THREE from 'three';
import { CAMERA } from './config.js?v=12';
import { clamp, lerpAngle } from './utils.js?v=12';
import { leafSurface, angDiff } from './leaves.js?v=12';

const AX = { x: 0, z: 0 };
const NEAR_LEAVES = [];

export class CameraRig {
    constructor(camera) {
        this.camera = camera;
        this.yaw = 0;
        this.pitch = CAMERA.defaultPitch;
        this.dist = CAMERA.distance;   // distância preferida (roda/C)
        this.cur = CAMERA.distance;    // distância atual depois da colisão
        this.pivot = new THREE.Vector3();
        this.pos = new THREE.Vector3();
        this.look = new THREE.Vector3();
        this.idle = 99;
        this.side = 1;
    }

    /** Recoloca atrás do João sem suavizar (início de capítulo, resgate). */
    reset(player, yaw = player.facing + Math.PI) {
        this.yaw = yaw;
        this.pitch = player.climbing ? CAMERA.climbPitch : CAMERA.defaultPitch;
        this.pivot.set(player.x, player.y + CAMERA.lookY, player.z);
        this.cur = this.dist * (player.climbing ? CAMERA.climbDist : 1);
        this.idle = 99;
    }

    /** Lê o mouse/arrasto e a roda. Chamado só quando o João está sendo controlado. */
    input(input) {
        const lx = input.lookX;
        const ly = input.lookY;
        input.lookX = input.lookY = 0;
        if (lx !== 0 || ly !== 0) {
            this.yaw -= lx * CAMERA.sens;
            this.pitch = clamp(this.pitch + ly * CAMERA.sens * 0.9, CAMERA.pitchMin, CAMERA.pitchMax);
            this.idle = 0;
        }
        const z = input.zoomDelta;
        input.zoomDelta = 0;
        if (z) this.dist = clamp(this.dist + z * 0.5, CAMERA.minDistance, CAMERA.maxDistance);
    }

    /** Ciclo de distâncias da tecla C. */
    cycle() {
        const dists = [3.8, 5.6, 8.4];
        const i = dists.findIndex((d) => Math.abs(this.dist - d) < 0.3);
        this.dist = dists[(i + 1) % dists.length];
    }

    /** Resolve pos/look para este quadro (não mexe na câmera three.js). */
    solve(dt, player, world) {
        this.idle += dt;
        const climbing = player.climbing;
        // --- recentralização automática
        if (climbing) {
            const ang = player.climbAng;
            if (this.idle > 0.6) {
                const d = angDiff(this.yaw, ang);
                if (Math.abs(d) > 0.08) this.side = d > 0 ? 1 : -1;
                this.yaw = lerpAngle(this.yaw, ang + this.side * CAMERA.climbSide, 2.4, dt);
                // folha mirada: inclina mais para baixo (no retrato a folha sairia do quadro)
                const pt = player.target ? CAMERA.climbPitch + 0.22 : CAMERA.climbPitch;
                this.pitch += (pt - this.pitch) * (1 - Math.exp(-2 * dt));
            }
        } else if (this.idle > CAMERA.idleLook && player.grounded && player.speed > 0.4) {
            const behind = player.facing + Math.PI;
            if (Math.abs(angDiff(this.yaw, behind)) < 2.2) {
                const k = CAMERA.recenter * Math.min(1, player.speed / 2.1);
                this.yaw = lerpAngle(this.yaw, behind, k, dt);
            }
            if (this.idle > 2.5) this.pitch += (CAMERA.defaultPitch - this.pitch) * (1 - Math.exp(-0.8 * dt));
        }

        // --- pivô suavizado
        const tx = player.x;
        const ty = player.y + CAMERA.lookY;
        const tz = player.z;
        const kxz = 1 - Math.exp(-14 * dt);
        const settled = player.grounded || climbing;
        const ly = settled ? 12 : 5 + Math.abs(player.vy) * 0.6;
        const ky = 1 - Math.exp(-ly * dt);
        this.pivot.x += (tx - this.pivot.x) * kxz;
        this.pivot.z += (tz - this.pivot.z) * kxz;
        this.pivot.y += (ty - this.pivot.y) * ky;
        // nunca deixa o João sair muito do quadro (respawn, salto longo)
        if (Math.abs(ty - this.pivot.y) > 3) this.pivot.y = ty - Math.sign(ty - this.pivot.y) * 3;

        // --- direção e distância desejada
        const want = this.dist * (climbing || player.leap ? CAMERA.climbDist : 1);
        const cp = Math.cos(this.pitch);
        const dx = Math.sin(this.yaw) * cp;
        const dy = Math.sin(this.pitch);
        const dz = Math.cos(this.yaw) * cp;
        const free = this._cast(world, this.pivot, dx, dy, dz, want);
        const k = free < this.cur ? 40 : 3;
        this.cur += (free - this.cur) * (1 - Math.exp(-k * dt));
        this.cur = Math.min(this.cur, free); // nunca além do ponto livre: sem atravessar nada

        const P = this.pivot;
        this.pos.set(P.x + dx * this.cur, P.y + dy * this.cur, P.z + dz * this.cur);
        this.look.copy(P);

        // --- piso e salão
        if (world.cam && world.inside?.(player.x, player.z)) {
            this.pos.x = clamp(this.pos.x, world.cam.minX, world.cam.maxX);
            this.pos.z = clamp(this.pos.z, world.cam.minZ, world.cam.maxZ);
            this.pos.y = Math.min(this.pos.y, world.cam.maxY);
        }
        const gy = world.heightAt(this.pos.x, this.pos.z) + 0.45;
        if (gy > -20 && this.pos.y < gy) this.pos.y = gy;
        return this;
    }

    /** Aplica à câmera com tremor opcional (amplitude em m). */
    apply(shake = 0) {
        const c = this.camera;
        c.position.copy(this.pos);
        if (shake > 0) {
            c.position.x += (Math.random() - 0.5) * shake * 0.35;
            c.position.y += (Math.random() - 0.5) * shake * 0.22;
        }
        c.lookAt(this.look);
    }

    /**
     * Distância livre ao longo do raio P + d̂·t, t ∈ [0, maxD]. Devolve o primeiro ponto
     * bloqueado menos uma folga (mín. CAMERA.near).
     */
    _cast(world, P, dx, dy, dz, maxD) {
        const n = Math.max(8, Math.ceil(maxD / 0.3));
        // pré-filtra as folhas pela faixa de altura do raio (normalmente 2–6 folhas)
        NEAR_LEAVES.length = 0;
        const y0 = Math.min(P.y, P.y + dy * maxD) - 1;
        const y1 = Math.max(P.y, P.y + dy * maxD) + 1;
        for (const l of world.platforms) if (l.y > y0 && l.y < y1) NEAR_LEAVES.push(l);
        const sc = world.stalkCam;
        for (let i = 1; i <= n; i++) {
            const t = (i / n) * maxD;
            const x = P.x + dx * t;
            const y = P.y + dy * t;
            const z = P.z + dz * t;
            if (this._blocked(world, x, y, z, sc)) return Math.max(CAMERA.near, t - maxD / n - 0.2);
        }
        return maxD;
    }

    _blocked(world, x, y, z, sc) {
        // terreno/nuvem entre o João e a câmera
        if (world.heightAt(x, z) + 0.3 > y) return true;
        // caule: cilindro de raio casca + 0,15 m em volta do eixo serpenteante (o João agarra
        // a ~0,25 m da casca, então o pivô fica sempre fora dele)
        if (sc && y > sc.yMin && y < sc.yMax) {
            sc.axis(y, AX);
            const r = sc.radiusAt(y) + 0.15;
            const ddx = x - AX.x;
            const ddz = z - AX.z;
            if (ddx * ddx + ddz * ddz < r * r) return true;
        }
        // lâminas das folhas
        for (const l of NEAR_LEAVES) {
            if (Math.abs(x - l.x) > l.r + 0.4 || Math.abs(z - l.z) > l.r + 0.4) continue;
            const s = leafSurface(l, x, z, 0.35);
            if (s === s && Math.abs(y - s) < 0.5) return true;
        }
        // paredes (caixas orientadas; `camTop` libera acima de uma altura)
        for (const c of world.colliders) {
            if (!c.box) continue;
            if (c.camTop != null && y > c.camTop) continue;
            const ox = x - c.x;
            const oz = z - c.z;
            const lx = ox * c.cos - oz * c.sin;
            const lz = ox * c.sin + oz * c.cos;
            if (Math.abs(lx) < c.hx + 0.25 && Math.abs(lz) < c.hz + 0.25) return true;
        }
        return false;
    }
}
