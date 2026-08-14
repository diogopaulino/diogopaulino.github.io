/**
 * Cristais, corações, inimigos, checkpoints e o portal — todos ancorados em `s`.
 */

import * as THREE from 'three';
import { SCORE } from './config.js';
import { hash01, pick } from './utils.js';
import { createGem, createImp, createHeartPickup, createCheckpoint } from './models.js';

export class Entities {
    constructor(scene, course, difficulty) {
        this.scene = scene;
        this.course = course;
        this.difficulty = difficulty;
        this.group = new THREE.Group();
        scene.add(this.group);
        this._frame = {};
        this.items = [];
        this.enemies = [];
        this.spawn();
    }

    spawn() {
        this.clear();
        const len = this.course.length;
        const scale = this.difficulty.spawnScale;

        for (let s = 8; s < len - 12; s += 4.2 / scale) {
            if (!this.course.floorAt(s, 0)) continue;
            if (hash01(s * 2.2) < 0.38) continue;
            this._placeItem('gem', s, 1.15);
        }

        const hearts = [len * 0.33, len * 0.62];
        hearts.forEach((s) => {
            if (this.course.floorAt(s, 0)) this._placeItem('heart', s, 1.3);
        });

        this.course.checkpoints.slice(1).forEach((s) => {
            this._placeItem('check', s, 1.5);
        });

        const kinds = ['imp', 'imp', 'spike', 'wisp'];
        const gap = 20 / scale;
        for (let s = 42; s < len - 20; s += gap) {
            if (!this.course.floorAt(s, 0)) continue;
            if (hash01(s * 7.7) < 0.22) continue;
            const kind = pick(kinds);
            this._placeEnemy(kind, s);
        }
    }

    _placeItem(kind, s, lift) {
        const mesh = kind === 'heart' ? createHeartPickup()
            : kind === 'check' ? createCheckpoint()
                : createGem();
        this.group.add(mesh);
        this.items.push({ kind, s, lift, mesh, taken: false, armed: kind !== 'check' });
    }

    _placeEnemy(kind, s) {
        const mesh = createImp(kind);
        this.group.add(mesh);
        const patrol = 3.2 + hash01(s) * 2.4;
        this.enemies.push({
            kind,
            home: s,
            s,
            dir: hash01(s * 3) > 0.5 ? 1 : -1,
            patrol,
            mesh,
            alive: true,
            hp: kind === 'spike' ? 1 : 1,
            stompable: kind !== 'spike',
            fly: kind === 'wisp',
            phase: hash01(s * 9) * 6
        });
    }

    clear() {
        while (this.group.children.length) this.group.remove(this.group.children[0]);
        this.items = [];
        this.enemies = [];
    }

    dispose() {
        this.clear();
        this.scene.remove(this.group);
    }

    update(dt, time, player, events) {
        const course = this.course;

        for (const it of this.items) {
            if (it.taken) continue;
            const floor = course.floorAt(it.s, time);
            const frame = course.frame(it.s, this._frame);
            it.mesh.position.copy(frame.pos);
            it.mesh.position.y = (floor ? floor.y : frame.pos.y) + it.lift + Math.sin(time * 3 + it.s) * 0.12;
            it.mesh.rotation.y = time * (it.kind === 'check' ? 1.2 : 2.4);

            if (Math.abs(player.s - it.s) < 1.15 && Math.abs(player.y - (it.mesh.position.y - 0.4)) < 1.6) {
                if (it.kind === 'check') {
                    if (!it.armed) {
                        it.armed = true;
                        it.mesh.scale.setScalar(1.15);
                        events.push({ type: 'checkpoint', s: it.s, score: SCORE.checkpoint });
                    }
                } else {
                    it.taken = true;
                    it.mesh.visible = false;
                    events.push({
                        type: it.kind,
                        s: it.s,
                        score: it.kind === 'heart' ? SCORE.heart : SCORE.gem
                    });
                }
            }
        }

        const speed = 2.15 * this.difficulty.enemySpeed;
        for (const en of this.enemies) {
            if (!en.alive) continue;
            if (en.fly) {
                en.s = en.home + Math.sin(time * 1.1 + en.phase) * en.patrol;
            } else {
                en.s += en.dir * speed * dt;
                if (en.s > en.home + en.patrol || en.s < en.home - en.patrol || !course.floorAt(en.s, time)) {
                    en.dir *= -1;
                    en.s = Math.max(en.home - en.patrol, Math.min(en.home + en.patrol, en.s));
                }
            }

            const floor = course.floorAt(en.s, time);
            const frame = course.frame(en.s, this._frame);
            en.mesh.position.copy(frame.pos);
            const baseY = floor ? floor.y : frame.pos.y;
            en.mesh.position.y = en.fly
                ? baseY + 1.7 + Math.sin(time * 2.4 + en.phase) * 0.35
                : baseY + 0.05 + Math.abs(Math.sin(time * 6 + en.phase)) * 0.12;
            en.mesh.lookAt(
                frame.pos.x - frame.tangent.x * en.dir,
                en.mesh.position.y,
                frame.pos.z - frame.tangent.z * en.dir
            );

            const ds = Math.abs(player.s - en.s);
            const dy = player.y - en.mesh.position.y;
            if (ds > 1.05) continue;

            if (player.attacking && dy > -0.4 && dy < 1.8) {
                this._kill(en, events, 'spin');
                continue;
            }

            const stomping = player.vy < -1.2 && dy > 0.35 && dy < 1.7;
            if (stomping && en.stompable) {
                this._kill(en, events, 'stomp');
                events.push({ type: 'bounce' });
                continue;
            }

            if (player.invuln <= 0 && dy > -0.15 && dy < 1.15) {
                events.push({ type: 'hurt' });
            }
        }
    }

    _kill(en, events, how) {
        en.alive = false;
        en.mesh.visible = false;
        events.push({ type: how, score: how === 'stomp' ? SCORE.stomp : SCORE.spin });
    }
}
