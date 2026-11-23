/**
 * Câmera de terceira pessoa do portador — órbita com pivô suavizado,
 * recentralização automática e colisão com o cenário (crítica nas minas).
 *
 * Pivô (o ponto que a câmera segue, na cabeça do halfling):
 *   p.xz ← damp(p.xz, portador.xz, 12/s)
 *   p.y  ← damp(p.y,  portador.y + 1,12, 10/s no chão | 3/s no ar)  → o pulo não sacode a tela
 *   saltos de > 4 m (respawn, teleporte) encaixam na hora.
 *
 * Órbita: câmera = p + d·(sin(yaw)·cos(pitch), sin(pitch), cos(yaw)·cos(pitch)).
 *   Mouse travado (não invertido): yaw −= Δx·0,0022 · pitch += Δy·0,0022, pitch ∈ [−0,35; 0,95].
 *
 * Recentralização (estilo plataforma 3D): depois de 1,1 s sem mexer a câmera e
 * com o portador andando, yaw → atrás dele à taxa 1,6/s × (v / v_trote). Não
 * recentraliza quando ele corre na direção da câmera (|Δ| > 125°) para não
 * girar a tela "por cima" do jogador. O pitch volta ao padrão a 0,8/s.
 *
 * Colisão: do pivô até a posição desejada, 18 amostras; a primeira dentro de
 * chão, colisor, teto ou parede (`world.solidAt`, que inclui `camBounds` dos
 * ambientes fechados) define d_livre = d·(i − 1)/18 − 0,12. A distância
 * encolhe NA HORA (a câmera nunca atravessa parede) e volta a 3 m/s.
 * Por fim a câmera fica ≥ 0,3 m acima do chão e abaixo do teto.
 */

import * as THREE from 'three';
import { CAMERA } from './config.js?v=32';
import { clamp, damp } from '../../shared/gfx/core.js';

const TAU = Math.PI * 2;
const SAMPLES = 18;
const POS = new THREE.Vector3();

const wrap = (a) => {
    a %= TAU;
    if (a > Math.PI) a -= TAU;
    if (a < -Math.PI) a += TAU;
    return a;
};

export class CameraRig {
    constructor(camera) {
        this.camera = camera;
        this.pivot = new THREE.Vector3();
        this.free = CAMERA.distance;
        this.manualAt = -1e9;
    }

    /** Encaixa pivô e distância (início de capítulo, respawn). */
    snap(player) {
        this.pivot.set(player.x, player.y + CAMERA.pivotY, player.z);
        this.free = player.camDist;
    }

    /** Mouse/toque → yaw/pitch/zoom do portador. `now` em s. */
    look(player, input, now) {
        const l = input.consumeLook();
        if (l.x || l.y) this.manualAt = now;
        player.camYaw -= l.x * CAMERA.mouseSens;
        player.camPitch = clamp(player.camPitch + l.y * CAMERA.mouseSens, CAMERA.pitchMin, CAMERA.pitchMax);
        const z = input.consumeZoom();
        if (z) player.camDist = clamp(player.camDist + z * 0.55, CAMERA.minDistance, CAMERA.maxDistance);
    }

    /** Recentraliza atrás do portador enquanto ele anda (sem mexida manual recente). */
    recenter(player, dt, now) {
        if (now - this.manualAt < CAMERA.recenterDelay) return;
        if (player.speed < 0.6 || player.attackT > 0) return;
        const behind = player.yaw + Math.PI;
        const d = wrap(behind - player.camYaw);
        if (Math.abs(d) > 2.2) return;
        const rate = CAMERA.recenterRate * clamp(player.speed / 2.9, 0.4, 1.5);
        player.camYaw += d * (1 - Math.exp(-rate * dt));
        player.camPitch = damp(player.camPitch, CAMERA.defaultPitch, 0.8, dt);
    }

    /** Maior distância livre do pivô até a posição desejada. */
    freeDistance(player, world, want) {
        for (let i = 1; i <= SAMPLES; i++) {
            const d = (want * i) / SAMPLES;
            player.cameraPosition(POS, d, this.pivot);
            if (world.solidAt(POS.x, POS.y, POS.z, CAMERA.skin)) return Math.max(0.7, (want * (i - 1)) / SAMPLES - 0.12);
        }
        return want;
    }

    update(dt, player, world) {
        dt = dt || 1 / 60;
        const p = this.pivot;
        const tx = player.x;
        const ty = player.y + CAMERA.pivotY;
        const tz = player.z;
        if (Math.abs(tx - p.x) + Math.abs(ty - p.y) + Math.abs(tz - p.z) > 4) p.set(tx, ty, tz);
        else {
            p.x = damp(p.x, tx, CAMERA.followXZ, dt);
            p.z = damp(p.z, tz, CAMERA.followXZ, dt);
            p.y = damp(p.y, ty, player.grounded ? 10 : 3, dt);
        }
        const free = this.freeDistance(player, world, player.camDist);
        // encolhe na hora (nunca atravessa parede); volta devagar
        this.free = free < this.free ? free : Math.min(free, this.free + CAMERA.regrow * dt);
        player.cameraPosition(POS, this.free, p);
        const floor = world.heightAt(POS.x, POS.z) + CAMERA.skin;
        if (POS.y < floor) POS.y = floor;
        const cb = world.camBounds;
        if (cb && POS.y > cb.maxY) POS.y = cb.maxY;
        this.camera.position.copy(POS);
        this.camera.lookAt(p);
    }
}
