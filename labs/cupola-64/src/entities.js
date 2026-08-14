/**
 * Moedas, estrelas, fungos e a bomba-rei — coleta, stomp e as sete missões.
 */

import * as THREE from 'three';
import { QUEST, STAR_META } from './config.js';
import { randRange } from './utils.js';
import { createCoin, createStar, createFungus, createKingBomb } from './models.js';

const YELLOW = [
    [0, 8], [2, 10], [-2, 10], [4, 14], [-4, 14], [0, 18],
    [6, 6], [-6, 6], [8, 2], [-8, 4], [10, 10], [-10, 12],
    [3, -8], [-3, -6], [8, -10], [12, 4], [-12, 0], [14, 16],
    [-14, 10], [16, 10], [1, -16], [5, -18], [0, 22], [-5, 20],
    [18, 6], [-16, 6], [7, 18], [-7, 8], [11, -4], [-11, 14],
    [20, 14], [-18, 14], [4, 2], [-4, 0], [2, -12], [-2, -14],
    [9, 8], [-9, -2], [13, 12], [-13, 8], [15, 2], [6, -4],
    [22, 8], [-20, 4], [3, 16], [-1, 6], [17, 18], [-8, 16]
];

const RED = [
    { x: 0, z: 20 },
    { x: 12, z: 8 },
    { x: -14, z: 6 },
    { x: 3, z: -26 },
    { x: 28, y: 16.9, z: 2 },
    { x: 2.6, y: 5.2, z: -16 },
    { x: -10, y: 8.4, z: 16 },
    { x: 16, z: 8 }
];

const STAR_POS = {
    summit: [3, 0, -26],
    roof: [0, 0, 25],
    red: [0, 0, 6],
    sky: [28, 16.4, 2],
    cave: [2.6, 5.4, -19],
    king: [8, 0, -18],
    coins: [-3, 0, 10]
};

export class Entities {
    constructor(scene, world) {
        this.scene = scene;
        this.world = world;
        this.coins = [];
        this.reds = [];
        this.stars = [];
        this.fungi = [];
        this.king = null;
        this.got = new Set();
        this.coinCount = 0;
        this.redCount = 0;
        this.kingHits = 0;
        this.kingDown = false;
        this._spin = 0;
        this._build();
    }

    _build() {
        for (const [x, z] of YELLOW) {
            const mesh = createCoin(false);
            const y = this.world.groundAt(x, z, 40) + 0.9;
            mesh.position.set(x, y, z);
            this.scene.add(mesh);
            this.coins.push({ mesh, x, y, z, taken: false });
        }

        for (const r of RED) {
            const mesh = createCoin(true);
            const x = r.x;
            const z = r.z;
            const y = r.y ?? this.world.groundAt(x, z, 40) + 1.05;
            mesh.position.set(x, y, z);
            this.scene.add(mesh);
            this.reds.push({ mesh, x, y, z, taken: false });
        }

        for (const meta of STAR_META) {
            const mesh = createStar();
            const p = STAR_POS[meta.id];
            let y = p[1];
            if (meta.id === 'summit') y = this.world.groundAt(p[0], p[2], 40) + 1.6;
            if (meta.id === 'roof') y = this.world.castle.position.y + 12.6;
            if (meta.id === 'red' || meta.id === 'coins' || meta.id === 'king') y = this.world.groundAt(p[0], p[2], 40) + 1.4;
            mesh.position.set(p[0], y, p[2]);
            mesh.visible = meta.id === 'summit' || meta.id === 'roof' || meta.id === 'sky' || meta.id === 'cave';
            this.scene.add(mesh);
            this.stars.push({ id: meta.id, meta, mesh, x: p[0], y, z: p[2], taken: false });
        }

        const fungusSpots = [
            [10, 4], [-14, 2], [12, -6], [-10, -6], [18, 14], [-16, 16], [8, -12], [-6, 20]
        ];
        for (const [x, z] of fungusSpots) {
            const mesh = createFungus();
            const y = this.world.groundAt(x, z, 40);
            mesh.position.set(x, y, z);
            this.scene.add(mesh);
            this.fungi.push({
                mesh, x, z, y,
                facing: randRange(0, Math.PI * 2),
                speed: randRange(1.6, 2.6),
                homeX: x, homeZ: z,
                alive: true,
                respawn: 0,
                bob: randRange(0, Math.PI * 2)
            });
        }

        const king = createKingBomb();
        king.position.set(8, this.world.groundAt(8, -18, 40), -18);
        this.scene.add(king);
        this.king = {
            mesh: king,
            x: 8, z: -18,
            y: king.position.y,
            hits: 0,
            hurtT: 0,
            alive: true,
            facing: 0,
            chase: 0
        };
    }

    reset() {
        this.got.clear();
        this.coinCount = 0;
        this.redCount = 0;
        this.kingHits = 0;
        this.kingDown = false;
        for (const c of this.coins) {
            c.taken = false;
            c.mesh.visible = true;
        }
        for (const c of this.reds) {
            c.taken = false;
            c.mesh.visible = true;
        }
        for (const s of this.stars) {
            s.taken = false;
            s.mesh.visible = s.id === 'summit' || s.id === 'roof' || s.id === 'sky' || s.id === 'cave';
        }
        for (const f of this.fungi) {
            f.alive = true;
            f.mesh.visible = true;
            f.respawn = 0;
        }
        this.king.alive = true;
        this.king.hits = 0;
        this.king.mesh.visible = true;
        this.king.x = 8;
        this.king.z = -18;
    }

    update(dt, player) {
        this._spin += dt;
        const t = this._spin;

        for (const c of this.coins) {
            if (c.taken) continue;
            c.mesh.rotation.y += dt * 3.2;
            c.mesh.position.y = c.y + Math.sin(t * 3 + c.x) * 0.12;
        }
        for (const c of this.reds) {
            if (c.taken) continue;
            c.mesh.rotation.y += dt * 4;
            c.mesh.position.y = c.y + Math.sin(t * 4 + c.z) * 0.16;
            c.mesh.scale.setScalar(1.08);
        }
        for (const s of this.stars) {
            if (s.taken) continue;
            s.mesh.rotation.y += dt * 2.2;
            s.mesh.position.y = s.y + Math.sin(t * 2.4) * 0.18;
            if (s.id === 'red') s.mesh.visible = !s.taken && this.redCount >= QUEST.redCoins;
            if (s.id === 'coins') s.mesh.visible = !s.taken && this.coinCount >= QUEST.coinStar;
            if (s.id === 'king') s.mesh.visible = !s.taken && this.kingDown;
        }

        this._fungi(dt, player);
        this._king(dt, player);

        return this._collect(player);
    }

    _fungi(dt, player) {
        for (const f of this.fungi) {
            if (!f.alive) {
                f.respawn -= dt;
                if (f.respawn <= 0) {
                    f.alive = true;
                    f.mesh.visible = true;
                    f.x = f.homeX;
                    f.z = f.homeZ;
                }
                continue;
            }
            f.bob += dt * 6;
            f.facing += Math.sin(f.bob * 0.2) * dt * 0.8;
            const hx = f.homeX - f.x;
            const hz = f.homeZ - f.z;
            if (Math.hypot(hx, hz) > 6) f.facing = Math.atan2(hx, hz);
            f.x += Math.sin(f.facing) * f.speed * dt;
            f.z += Math.cos(f.facing) * f.speed * dt;
            const hit = this.world.collide(f.x, f.z, 0.4);
            f.x = hit.x;
            f.z = hit.z;
            f.y = this.world.groundAt(f.x, f.z, 40);
            f.mesh.position.set(f.x, f.y + Math.abs(Math.sin(f.bob)) * 0.08, f.z);
            f.mesh.rotation.y = f.facing;
            f.mesh.scale.y = 1 + Math.sin(f.bob) * 0.06;
        }
    }

    _king(dt, player) {
        const k = this.king;
        if (!k.alive) return;
        k.hurtT = Math.max(0, k.hurtT - dt);
        const dx = player.x - k.x;
        const dz = player.z - k.z;
        const dist = Math.hypot(dx, dz);
        k.chase = dist < 14 ? 1 : 0;
        const speed = k.chase ? 3.6 : 1.8;
        if (dist > 1.6) {
            k.facing = Math.atan2(dx, dz);
            k.x += Math.sin(k.facing) * speed * dt;
            k.z += Math.cos(k.facing) * speed * dt;
        }
        const hit = this.world.collide(k.x, k.z, 1.3);
        k.x = hit.x;
        k.z = hit.z;
        k.y = this.world.groundAt(k.x, k.z, 40);
        k.mesh.position.set(k.x, k.y, k.z);
        k.mesh.rotation.y = k.facing;
        const spark = k.mesh.getObjectByName('spark');
        if (spark) spark.scale.setScalar(0.8 + Math.sin(this._spin * 12) * 0.25);
        k.mesh.visible = k.hurtT <= 0 || Math.sin(k.hurtT * 30) > 0;
    }

    _collect(player) {
        const events = [];
        const px = player.x;
        const py = player.y + 0.6;
        const pz = player.z;

        for (const c of this.coins) {
            if (c.taken) continue;
            if (Math.hypot(px - c.x, py - c.mesh.position.y, pz - c.z) < 1.05) {
                c.taken = true;
                c.mesh.visible = false;
                this.coinCount += 1;
                events.push({ type: 'coin', pos: c.mesh.position });
            }
        }
        for (const c of this.reds) {
            if (c.taken) continue;
            if (Math.hypot(px - c.x, py - c.mesh.position.y, pz - c.z) < 1.15) {
                c.taken = true;
                c.mesh.visible = false;
                this.redCount += 1;
                events.push({ type: 'red', pos: c.mesh.position, left: QUEST.redCoins - this.redCount });
            }
        }
        for (const s of this.stars) {
            if (s.taken || !s.mesh.visible) continue;
            if (Math.hypot(px - s.x, py - s.mesh.position.y, pz - s.z) < 1.35) {
                s.taken = true;
                s.mesh.visible = false;
                this.got.add(s.id);
                events.push({ type: 'star', id: s.id, meta: s.meta, pos: s.mesh.position });
            }
        }

        for (const f of this.fungi) {
            if (!f.alive) continue;
            const d = Math.hypot(px - f.x, pz - f.z);
            if (d < 0.85) {
                if (!player.grounded && player.vy < 0 && player.y > f.y + 0.35) {
                    f.alive = false;
                    f.mesh.visible = false;
                    f.respawn = 7;
                    player.vy = 10;
                    events.push({ type: 'stomp', pos: f.mesh.position.clone() });
                } else {
                    events.push({ type: 'hurt', pos: f.mesh.position.clone() });
                }
            }
        }

        const k = this.king;
        if (k.alive) {
            const d = Math.hypot(px - k.x, pz - k.z);
            if (d < 1.7) {
                if (!player.grounded && player.vy < 0 && player.y > k.y + 1.1 && k.hurtT <= 0) {
                    k.hits += 1;
                    k.hurtT = 0.8;
                    player.vy = 12;
                    this.kingHits = k.hits;
                    events.push({ type: 'king', hits: k.hits, pos: k.mesh.position.clone() });
                    if (k.hits >= QUEST.kingHits) {
                        k.alive = false;
                        k.mesh.visible = false;
                        this.kingDown = true;
                        events.push({ type: 'kingDown', pos: k.mesh.position.clone() });
                    }
                } else if (k.hurtT <= 0) {
                    events.push({ type: 'hurt', pos: k.mesh.position.clone() });
                }
            }
        }

        return events;
    }

    get starCount() {
        return this.got.size;
    }
}
