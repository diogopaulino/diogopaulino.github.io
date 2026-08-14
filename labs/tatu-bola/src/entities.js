/**
 * Cristais, cajus, caixas, caranguejos, morcegos, plantas e o ídolo.
 * Coleta: dist² < (r_a + r_b)². Roll mata inimigo se rolling && dist < 1.15.
 */

import * as THREE from 'three';
import {
    CRYSTAL_SPOTS, CAJU_SPOTS, CRATE_SPOTS, ENEMIES, IDOL, QUEST
} from './config.js';
import {
    createCrystal, createCaju, createCrate, createCrab,
    createBat, createPlant, createPopupSprite
} from './models.js';

export class Entities {
    constructor(scene, world, effects) {
        this.scene = scene;
        this.world = world;
        this.effects = effects;
        this.group = new THREE.Group();
        scene.add(this.group);
        this.crystals = [];
        this.cajus = [];
        this.crates = [];
        this.crabs = [];
        this.bats = [];
        this.plants = [];
        this.popups = [];
        this.got = 0;
    }

    reset() {
        this.clearList(this.crystals);
        this.clearList(this.cajus);
        this.clearList(this.crates);
        this.clearList(this.crabs);
        this.clearList(this.bats);
        this.clearList(this.plants);
        this.clearList(this.popups);
        this.got = 0;
        this._spawnAll();
    }

    clearList(list) {
        for (const e of list) this.group.remove(e.mesh);
        list.length = 0;
    }

    _y(x, z, extra = 0) {
        return Math.max(this.world.heightAt(x, z), 0.15) + extra;
    }

    _spawnAll() {
        const colors = [0x7af0ff, 0xff3d8a, 0xffe07a, 0x7dff9a, 0xc89bff, 0xff9a4a, 0xffffff];
        CRYSTAL_SPOTS.forEach((s, i) => {
            const mesh = createCrystal(colors[i % colors.length]);
            let y = this._y(s.x, s.z, 1.15);
            if (i === 3) y = this.world.templeTop + 0.55;
            if (i === 5) y = this.world.platCrystalY;
            mesh.position.set(s.x, y, s.z);
            this.group.add(mesh);
            this.crystals.push({ mesh, x: s.x, z: s.z, y, taken: false, phase: i });
        });

        for (const [x, z] of CAJU_SPOTS) {
            const mesh = createCaju();
            const y = this._y(x, z, 0.55);
            mesh.position.set(x, y, z);
            this.group.add(mesh);
            this.cajus.push({ mesh, taken: false, phase: Math.random() * 6 });
        }

        for (const [x, z] of CRATE_SPOTS) {
            const mesh = createCrate();
            const y = this._y(x, z, 0.48);
            mesh.position.set(x, y, z);
            this.group.add(mesh);
            this.crates.push({ mesh, hp: 1, y });
        }

        for (const c of ENEMIES.crabs) {
            const mesh = createCrab();
            const y = this._y(c.x, c.z, 0);
            mesh.position.set(c.x, y, c.z);
            this.group.add(mesh);
            this.crabs.push({
                mesh, x: c.x, z: c.z, ox: c.x, oz: c.z,
                span: c.span, yaw: c.yaw, t: Math.random() * 10, hp: 1
            });
        }

        for (const b of ENEMIES.bats) {
            const mesh = createBat();
            mesh.position.set(b.x, b.y, b.z);
            this.group.add(mesh);
            this.bats.push({
                mesh, ox: b.x, oz: b.z, oy: b.y, r: b.r, t: Math.random() * 8, hp: 1
            });
        }

        for (const p of ENEMIES.plants) {
            const mesh = createPlant();
            const y = this._y(p.x, p.z, 0);
            mesh.position.set(p.x, y, p.z);
            this.group.add(mesh);
            this.plants.push({ mesh, x: p.x, z: p.z, t: 0, snap: 0 });
        }
    }

    popup(text, x, y, z, color) {
        const s = createPopupSprite(text, color);
        s.position.set(x, y + 1.2, z);
        this.group.add(s);
        this.popups.push({ mesh: s, life: 1.1 });
    }

    update(dt, time, player, emit) {
        const px = player.position.x;
        const py = player.position.y;
        const pz = player.position.z;
        const rolling = player.rolling;

        for (const c of this.crystals) {
            if (c.taken) continue;
            c.mesh.rotation.y += dt * 1.8;
            c.mesh.position.y = c.y + Math.sin(time * 2.4 + c.phase) * 0.18;
            if (dist2(px, py, pz, c.mesh.position) < 1.35) {
                c.taken = true;
                c.mesh.visible = false;
                this.got += 1;
                this.effects.burst(c.mesh.position, 0x7af0ff, 16, 7);
                emit('crystal', c.mesh.position);
            }
        }

        for (const c of this.cajus) {
            if (c.taken) continue;
            c.mesh.rotation.y += dt * 2.4;
            c.mesh.position.y += Math.sin(time * 3 + c.phase) * 0.002;
            if (dist2(px, py, pz, c.mesh.position) < 0.85) {
                c.taken = true;
                c.mesh.visible = false;
                this.effects.burst(c.mesh.position, 0xff7a32, 8, 4);
                emit('caju', c.mesh.position);
            }
        }

        for (let i = this.crates.length - 1; i >= 0; i--) {
            const cr = this.crates[i];
            cr.mesh.position.y = cr.y + Math.sin(time * 1.2 + i) * 0.02;
            if (dist2(px, py, pz, cr.mesh.position) < (rolling ? 1.35 : 0.95) && (rolling || py > cr.mesh.position.y + 0.3)) {
                this.effects.explode(cr.mesh.position, 0xc48a3a);
                this.group.remove(cr.mesh);
                this.crates.splice(i, 1);
                emit('crate', cr.mesh.position);
                this._spillCaju(cr.mesh.position);
            }
        }

        for (let i = this.crabs.length - 1; i >= 0; i--) {
            const e = this.crabs[i];
            e.t += dt;
            const walk = Math.sin(e.t * 1.3) * e.span;
            e.x = e.ox + Math.cos(e.yaw) * walk;
            e.z = e.oz + Math.sin(e.yaw) * walk;
            e.mesh.position.x = e.x;
            e.mesh.position.z = e.z;
            e.mesh.position.y = Math.max(this.world.heightAt(e.x, e.z), 0.05);
            e.mesh.rotation.y = e.yaw + (Math.cos(e.t * 1.3) > 0 ? 0 : Math.PI);
            const d = dist2(px, py, pz, e.mesh.position);
            if (d < 1.2 && rolling) {
                this.effects.explode(e.mesh.position, 0xe24a3a);
                this.group.remove(e.mesh);
                this.crabs.splice(i, 1);
                emit('enemy', e.mesh.position);
            } else if (d < 0.95) {
                emit('hit', e.mesh.position);
            }
        }

        for (let i = this.bats.length - 1; i >= 0; i--) {
            const e = this.bats[i];
            e.t += dt;
            e.mesh.position.x = e.ox + Math.cos(e.t * 0.9) * e.r;
            e.mesh.position.z = e.oz + Math.sin(e.t * 0.9) * e.r;
            e.mesh.position.y = e.oy + Math.sin(e.t * 2.2) * 0.45;
            const wL = e.mesh.getObjectByName('wingL');
            const wR = e.mesh.getObjectByName('wingR');
            const flap = Math.sin(e.t * 12) * 0.5;
            if (wL) wL.rotation.z = 1.2 + flap;
            if (wR) wR.rotation.z = -1.2 - flap;
            const d = dist2(px, py, pz, e.mesh.position);
            if (d < 1.15 && rolling) {
                this.effects.explode(e.mesh.position, 0x5a3878);
                this.group.remove(e.mesh);
                this.bats.splice(i, 1);
                emit('enemy', e.mesh.position);
            } else if (d < 0.9) {
                emit('hit', e.mesh.position);
            }
        }

        for (const p of this.plants) {
            p.t += dt;
            const jaw = p.mesh.getObjectByName('jaw');
            const near = Math.hypot(px - p.x, pz - p.z) < 2.4;
            p.snap = near ? Math.min(1, p.snap + dt * 4) : Math.max(0, p.snap - dt * 2);
            if (jaw) jaw.rotation.x = p.snap * 0.55;
            if (near && Math.hypot(px - p.x, py - (p.mesh.position.y + 0.8), pz - p.z) < 0.95) {
                emit('hit', p.mesh.position);
            }
        }

        const idol = this.world.idolMesh;
        if (idol) {
            const gem = idol.getObjectByName('gem');
            const awake = this.got >= QUEST.crystals;
            idol.rotation.y += dt * (awake ? 0.8 : 0.15);
            if (gem) gem.scale.setScalar(awake ? 1.2 + Math.sin(time * 6) * 0.15 : 0.8);
            if (awake && dist2(px, py, pz, idol.position) < 2.4) {
                emit('idol', idol.position);
            }
        }

        for (let i = this.popups.length - 1; i >= 0; i--) {
            const p = this.popups[i];
            p.life -= dt;
            p.mesh.position.y += dt * 1.4;
            p.mesh.material.opacity = Math.max(0, p.life);
            if (p.life <= 0) {
                this.group.remove(p.mesh);
                this.popups.splice(i, 1);
            }
        }
    }

    _spillCaju(pos) {
        const mesh = createCaju();
        mesh.position.copy(pos);
        mesh.position.y += 0.4;
        this.group.add(mesh);
        this.cajus.push({ mesh, taken: false, phase: Math.random() * 6 });
    }
}

function dist2(px, py, pz, pos) {
    const dx = px - pos.x;
    const dy = py + 0.45 - pos.y;
    const dz = pz - pos.z;
    return dx * dx + dy * dy * 0.6 + dz * dz;
}
