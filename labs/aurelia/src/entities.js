/**
 * Lúmens, anéis de ruína, correntes e enguias. Reciclam com os chunks.
 */

import * as THREE from 'three';
import { PLAY, SWIM } from './config.js';
import { mulberry32, randRange, randInt, clamp } from './utils.js';

export class Entities {
    constructor(scene, geo, pal, quality) {
        this.scene = scene;
        this.geo = geo;
        this.quality = quality;
        this.orbs = [];
        this.rings = [];
        this.eels = [];
        this.currents = [];
        this._orbPool = [];
        this._ringPool = [];
        this._eelPool = [];
        this._curPool = [];
        this.seeded = new Set();

        this.orbMat = new THREE.MeshBasicMaterial({
            color: pal.glowA,
            transparent: true,
            opacity: 0.95,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        this.ringMat = new THREE.MeshBasicMaterial({
            color: pal.glowB,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        this.eelMat = new THREE.MeshBasicMaterial({
            color: 0x1a3048,
            transparent: true,
            opacity: 0.92
        });
        this.eelGlow = new THREE.MeshBasicMaterial({
            color: 0xff5a7a,
            transparent: true,
            opacity: 0.55,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        this.curMat = new THREE.MeshBasicMaterial({
            color: pal.horizon,
            transparent: true,
            opacity: 0.22,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide
        });

        for (let i = 0; i < 48; i++) this._orbPool.push(this._makeOrb());
        for (let i = 0; i < 12; i++) this._ringPool.push(this._makeRing());
        for (let i = 0; i < 10; i++) this._eelPool.push(this._makeEel());
        for (let i = 0; i < 8; i++) this._curPool.push(this._makeCurrent());
    }

    _makeOrb() {
        const g = new THREE.Group();
        const core = new THREE.Mesh(this.geo.sphere, this.orbMat);
        core.scale.setScalar(0.38);
        const halo = new THREE.Mesh(this.geo.sphere, this.orbMat);
        halo.scale.setScalar(0.7);
        halo.material = this.orbMat.clone();
        halo.material.opacity = 0.25;
        g.add(core, halo);
        g.visible = false;
        this.scene.add(g);
        return { group: g, alive: false, kind: 'lumen' };
    }

    _makeRing() {
        const mesh = new THREE.Mesh(this.geo.torus, this.ringMat);
        mesh.scale.set(2.6, 2.6, 2.6);
        mesh.rotation.y = Math.PI / 2;
        mesh.visible = false;
        this.scene.add(mesh);
        return { mesh, alive: false, taken: false };
    }

    _makeEel() {
        const g = new THREE.Group();
        const segs = [];
        for (let i = 0; i < 7; i++) {
            const m = new THREE.Mesh(this.geo.sphere, i === 0 ? this.eelGlow : this.eelMat);
            m.scale.set(0.28 - i * 0.025, 0.22, 0.55);
            m.position.z = i * 0.55;
            g.add(m);
            segs.push(m);
        }
        g.visible = false;
        this.scene.add(g);
        return { group: g, alive: false, stunned: 0, phase: Math.random() * 6, segs };
    }

    _makeCurrent() {
        const mesh = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 14, 10, 1, true), this.curMat);
        mesh.rotation.x = Math.PI / 2;
        mesh.visible = false;
        this.scene.add(mesh);
        return { mesh, alive: false };
    }

    setPalette(pal) {
        this.orbMat.color.setHex(pal.glowA);
        this.ringMat.color.setHex(pal.glowB);
        this.curMat.color.setHex(pal.horizon);
    }

    clear() {
        for (const o of this.orbs) { o.alive = false; o.group.visible = false; }
        for (const r of this.rings) { r.alive = false; r.mesh.visible = false; }
        for (const e of this.eels) { e.alive = false; e.group.visible = false; }
        for (const c of this.currents) { c.alive = false; c.mesh.visible = false; }
        this.orbs.length = 0;
        this.rings.length = 0;
        this.eels.length = 0;
        this.currents.length = 0;
        this.seeded.clear();
    }

    seedChunk(index, z0, difficulty) {
        if (this.seeded.has(index)) return;
        this.seeded.add(index);
        const rng = mulberry32(index * 7919 + 101);
        const z1 = z0 - PLAY.chunkLength;

        const orbN = Math.round(randInt(rng, 4, 8) * difficulty.orbs);
        for (let i = 0; i < orbN; i++) {
            const o = this._orbPool.find((p) => !p.alive);
            if (!o) break;
            o.alive = true;
            o.kind = rng() > 0.86 ? 'relic' : 'lumen';
            o.group.visible = true;
            o.group.position.set(
                randRange(rng, -12, 12),
                randRange(rng, 4, 18),
                randRange(rng, z1 + 8, z0 - 8)
            );
            o.group.scale.setScalar(o.kind === 'relic' ? 1.45 : 1);
            this.orbs.push(o);
        }

        if (rng() > 0.28) {
            const r = this._ringPool.find((p) => !p.alive);
            if (r) {
                r.alive = true;
                r.taken = false;
                r.mesh.visible = true;
                r.mesh.position.set(
                    randRange(rng, -8, 8),
                    randRange(rng, 6, 16),
                    randRange(rng, z1 + 16, z0 - 16)
                );
                r.mesh.rotation.set(rng() * 0.4 - 0.2, Math.PI / 2, rng() * 0.3);
                this.rings.push(r);
            }
        }

        const eelN = Math.round(randInt(rng, 0, 2) * difficulty.hazards);
        for (let i = 0; i < eelN; i++) {
            const e = this._eelPool.find((p) => !p.alive);
            if (!e) break;
            e.alive = true;
            e.stunned = 0;
            e.group.visible = true;
            e.group.position.set(
                randRange(rng, -12, 12),
                randRange(rng, 5, 16),
                randRange(rng, z1 + 10, z0 - 10)
            );
            this.eels.push(e);
        }

        if (rng() > 0.55) {
            const c = this._curPool.find((p) => !p.alive);
            if (c) {
                c.alive = true;
                c.mesh.visible = true;
                c.mesh.position.set(
                    randRange(rng, -6, 6),
                    randRange(rng, 6, 14),
                    randRange(rng, z1 + 12, z0 - 12)
                );
                this.currents.push(c);
            }
        }
    }

    prune(playerZ) {
        const drop = (arr, key) => {
            for (let i = arr.length - 1; i >= 0; i--) {
                const it = arr[i];
                const z = it.group?.position.z ?? it.mesh.position.z;
                if (z > playerZ + 24) {
                    it.alive = false;
                    (it.group || it.mesh).visible = false;
                    arr.splice(i, 1);
                }
            }
        };
        drop(this.orbs);
        drop(this.rings);
        drop(this.eels);
        drop(this.currents);
        for (const id of this.seeded) {
            if (id < Math.floor(-playerZ / PLAY.chunkLength) - PLAY.chunkCount) this.seeded.delete(id);
        }
    }

    update(dt, player, effects, events) {
        const p = player.position;
        const magnet = SWIM.magnet + (player.shock > 0 ? 3.2 : 0);
        const shockR = player.shock > 0 ? SWIM.shockwave : 0;

        for (let i = this.orbs.length - 1; i >= 0; i--) {
            const o = this.orbs[i];
            const g = o.group;
            g.rotation.y += dt * 1.6;
            g.position.y += Math.sin(performance.now() * 0.003 + g.position.x) * 0.4 * dt;
            const dx = p.x - g.position.x;
            const dy = p.y - g.position.y;
            const dz = p.z - g.position.z;
            const d2 = dx * dx + dy * dy + dz * dz;
            if (d2 < magnet * magnet) {
                const d = Math.sqrt(d2) || 0.001;
                const pull = (player.shock > 0 ? 28 : 14) * dt;
                g.position.x += dx / d * pull;
                g.position.y += dy / d * pull;
                g.position.z += dz / d * pull;
            }
            if (d2 < 1.6 * 1.6) {
                const relic = o.kind === 'relic';
                events.collect(relic);
                effects.burst(g.position.x, g.position.y, g.position.z, relic);
                o.alive = false;
                g.visible = false;
                this.orbs.splice(i, 1);
            }
        }

        for (const r of this.rings) {
            r.mesh.rotation.z += dt * 0.7;
            if (r.taken) continue;
            const dx = p.x - r.mesh.position.x;
            const dy = p.y - r.mesh.position.y;
            const dz = p.z - r.mesh.position.z;
            if (Math.abs(dz) < 1.1 && dx * dx + dy * dy < 2.8 * 2.8) {
                r.taken = true;
                r.mesh.scale.setScalar(3.4);
                events.ring();
                effects.ringBurst(r.mesh.position.x, r.mesh.position.y, r.mesh.position.z);
            }
        }

        for (const e of this.eels) {
            e.phase += dt;
            if (shockR) {
                const dx = p.x - e.group.position.x;
                const dy = p.y - e.group.position.y;
                const dz = p.z - e.group.position.z;
                if (dx * dx + dy * dy + dz * dz < shockR * shockR) e.stunned = 0.9;
            }
            e.stunned = Math.max(0, e.stunned - dt);
            if (e.stunned === 0) {
                const chase = 1.6 + Math.sin(e.phase) * 0.4;
                e.group.position.x += clamp(p.x - e.group.position.x, -1, 1) * chase * dt;
                e.group.position.y += clamp(p.y - e.group.position.y, -1, 1) * chase * 0.7 * dt;
                e.group.position.z += -player.speed * 0.35 * dt;
                e.group.lookAt(p);
            }
            const dx = p.x - e.group.position.x;
            const dy = p.y - e.group.position.y;
            const dz = p.z - e.group.position.z;
            if (dx * dx + dy * dy + dz * dz < 1.7 * 1.7 && e.stunned === 0) {
                events.eel();
            }
        }

        let inCurrent = false;
        for (const c of this.currents) {
            c.mesh.rotation.z += dt * 1.8;
            const dx = p.x - c.mesh.position.x;
            const dy = p.y - c.mesh.position.y;
            const dz = p.z - c.mesh.position.z;
            if (dx * dx + dy * dy < 2.4 * 2.4 && Math.abs(dz) < 7) inCurrent = true;
        }
        events.current(inCurrent);

        this.prune(p.z);
    }
}
