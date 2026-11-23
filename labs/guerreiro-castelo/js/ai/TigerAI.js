/**
 * IA do Tigre na sala do castelo.
 *
 * REST      dorme enrolado até alguém entrar na sala (TigerRoomLevel passa para THREATEN)
 * WATCH / THREATEN   de pé, encara Dico e ruge de tempos em tempos
 * TRACK_TECO  segue Teco pelo chão enquanto o macaco anda nas vigas; se Teco está 1,4 m
 *           acima, salta (JUMP: y = casa + 1,1·sin(π·t/0,45)) sem alcançar
 * SWIPE     Dico chegou a menos de 2,3 m: patada (1 de dano + empurrão de 5 m/s) e o tigre
 *           volta a vigiar. É o motivo para mandar Teco em vez de ir buscar a chave.
 * RETURN    volta ao ponto de origem
 */

import * as THREE from 'three';
import { damp } from '../utils/math.js?v=50';

export class TigerAI {
    constructor(tiger) {
        this.tiger = tiger;
        this.state = 'REST';
        this.home = new THREE.Vector3();
        this.timer = 0;
        this.facing = 0;
        this.roarT = 0;
        this.swipeCd = 0;
        this.lookTarget = null;
        this.bounds = { minX: -6, maxX: 6, minZ: -6, maxZ: 6 };
    }

    reset() {
        this.state = 'REST';
        this.timer = 0;
        this.home.copy(this.tiger.position);
        this.facing = this.tiger.facing;
    }

    setBounds(minX, maxX, minZ, maxZ) {
        this.bounds = { minX, maxX, minZ, maxZ };
    }

    update(dt, game) {
        const t = this.tiger;
        this.timer += dt;
        this.swipeCd = Math.max(0, this.swipeCd - dt);
        const teco = game.teco;
        const tecoBusy = teco.ai.state === 'CLIMB' || teco.ai.state === 'MOVE_TO' || teco.ai.state === 'INTERACT';
        // posições do jogador/Teco no referencial da sala (o tigre é filho do grupo da sala)
        const off = t.root.parent.position;
        const px = game.player.position.x - off.x;
        const pz = game.player.position.z - off.z;
        const py = game.player.position.y - off.y;

        if (this.state === 'REST') {
            t.animator.play('Sleep');
            this.lookTarget = null;
            return;
        }

        const dxp = px - t.position.x;
        const dzp = pz - t.position.z;
        const distP = Math.hypot(dxp, dzp);

        if (this.state !== 'SWIPE' && this.state !== 'JUMP' && distP < 2.3 && Math.abs(py) < 1.5 && this.swipeCd <= 0 && game.player.alive) {
            this.state = 'SWIPE';
            this.timer = 0;
            this.swipeCd = 2.2;
            this.hit = false;
            this.facing = Math.atan2(dxp, dzp);
            t.animator.play('Attack');
            game.audio?.play('growl');
        }

        if (this.state === 'SWIPE') {
            this.lookTarget = game.player.root;
            if (!this.hit && this.timer > 0.3) {
                this.hit = true;
                /* patada: 1 de dano + tranco de 5 m/s para longe do tigre (referencial da sala) */
                if (distP < 2.9 && game.player.hurt(1, game.player.position.x - dxp, game.player.position.z - dzp, 5)) {
                    game.audio?.play('hit');
                    game.cameraRig?.addShake(0.2, 0.3);
                    game.hitstop?.(0.08);
                    game.hud?.flashHurt?.();
                }
            }
            if (this.timer > 0.9) {
                this.state = 'THREATEN';
                this.timer = 0;
            }
            return;
        }

        if (this.state === 'WATCH' || this.state === 'THREATEN') {
            this.facing = Math.atan2(dxp, dzp);
            this.lookTarget = game.player.root;
            this.roarT -= dt;
            if (this.roarT <= 0 && this.state === 'THREATEN') {
                this.roarT = 5 + Math.random() * 3;
                this.growlT = 1.3;
                game.audio?.play('growl');
            }
            this.growlT = Math.max(0, (this.growlT || 0) - dt);
            t.animator.play(this.growlT > 0 ? 'Growl' : 'Idle');
            if (tecoBusy) {
                this.state = 'TRACK_TECO';
                this.timer = 0;
            }
            return;
        }

        const tx = teco.position.x - off.x;
        const tz = teco.position.z - off.z;
        const ty = teco.position.y - off.y;

        if (this.state === 'TRACK_TECO') {
            this.lookTarget = teco.root;
            const dx = tx - t.position.x;
            const dz = tz - t.position.z;
            this.facing = Math.atan2(dx, dz);
            if (Math.hypot(dx, dz) > 0.6) {
                const nx = t.position.x + Math.sin(this.facing) * 2.2 * dt;
                const nz = t.position.z + Math.cos(this.facing) * 2.2 * dt;
                t.position.x = Math.min(this.bounds.maxX, Math.max(this.bounds.minX, nx));
                t.position.z = Math.min(this.bounds.maxZ, Math.max(this.bounds.minZ, nz));
                t.animator.play('Walk');
            } else {
                t.animator.play('Growl');
            }
            if (ty > t.position.y + 1.4 && this.timer > 1.6 && Math.hypot(dx, dz) < 2.5) {
                this.state = 'JUMP';
                this.timer = 0;
                t.animator.play('Jump');
                game.audio?.play('growl');
            }
            if (!tecoBusy && this.timer > 0.8) this.state = 'RETURN';
            return;
        }

        if (this.state === 'JUMP') {
            t.position.y = this.home.y + Math.sin(Math.min(1, this.timer / 0.45) * Math.PI) * 1.1;
            if (this.timer > 0.5) {
                t.position.y = this.home.y;
                this.state = 'TRACK_TECO';
                this.timer = 0;
            }
            return;
        }

        if (this.state === 'RETURN') {
            this.lookTarget = null;
            const hx = this.home.x - t.position.x;
            const hz = this.home.z - t.position.z;
            if (Math.hypot(hx, hz) > 0.3) this.facing = Math.atan2(hx, hz);
            t.position.x = damp(t.position.x, this.home.x, 1.6, dt);
            t.position.z = damp(t.position.z, this.home.z, 1.6, dt);
            t.animator.play('Walk');
            if (Math.hypot(hx, hz) < 0.3) {
                this.state = 'THREATEN';
                this.roarT = 2;
            }
        }
    }
}
