/**
 * Inimigos, coletáveis, projéteis e o chefe Mega-Clippy.
 */

import * as THREE from 'three';
import { QUEST, COMBAT, ARENA, CLIPPY_QUOTES } from './config.js';
import { randRange, randInt, pick } from './utils.js';
import {
    createGhost,
    createInvader,
    createClippy,
    createDog,
    createFloppy,
    createMushroom,
    createTetrisBlock,
    createToastSlice,
    createErrorDialog,
    createSpeechSprite,
    createPopupSprite
} from './models.js';

const GHOST_COLORS = [0xff3b3b, 0xff8ad8, 0x5dc8ff, 0xffa64d];

function pull(arr, item) {
    const i = arr.indexOf(item);
    if (i >= 0) arr.splice(i, 1);
}

export class Entities {
    constructor(scene, effects) {
        this.scene = scene;
        this.effects = effects;
        this.group = new THREE.Group();
        scene.add(this.group);

        this.ghosts = [];
        this.invaders = [];
        this.clippies = [];
        this.dogs = [];
        this.floppies = [];
        this.mushrooms = [];
        this.tetris = [];
        this.toasts = [];
        this.dialogs = [];
        this.popups = [];
        this.boss = null;
        this.wave = 0;
    }

    reset() {
        this.clearList(this.ghosts);
        this.clearList(this.invaders);
        this.clearList(this.clippies);
        this.clearList(this.dogs);
        this.clearList(this.floppies);
        this.clearList(this.mushrooms);
        this.clearList(this.tetris);
        this.clearList(this.toasts);
        this.clearList(this.dialogs);
        this.clearList(this.popups);
        if (this.boss) {
            this.group.remove(this.boss.mesh);
            this.boss = null;
        }
        this.wave = 0;
        this.spawnDog();
        this.fillFloppies(5);
        this.ensureWave(0);
    }

    clearList(list) {
        for (const e of list) this.group.remove(e.mesh);
        list.length = 0;
    }

    rimPoint(minR = 10) {
        const a = Math.random() * Math.PI * 2;
        const r = randRange(minR, ARENA.half - 3);
        return { x: Math.cos(a) * r, z: Math.sin(a) * r };
    }

    spawnGhost() {
        const p = this.rimPoint(14);
        const mesh = createGhost(pick(GHOST_COLORS));
        mesh.position.set(p.x, 1.1, p.z);
        this.group.add(mesh);
        this.ghosts.push({
            mesh, hp: 1, radius: 0.85,
            speed: randRange(4.2, 6.4),
            wobble: Math.random() * 10
        });
    }

    spawnInvader() {
        const p = this.rimPoint(8);
        const mesh = createInvader(pick([0x5dff6a, 0xff5d7a, 0x5dc8ff]));
        mesh.position.set(p.x, 3.4 + Math.random() * 1.6, p.z);
        this.group.add(mesh);
        this.invaders.push({
            mesh, hp: 1, radius: 0.7,
            phase: Math.random() * 10,
            dir: Math.random() < 0.5 ? 1 : -1,
            shoot: randRange(1.2, 2.8)
        });
    }

    spawnClippy() {
        const p = this.rimPoint(16);
        const mesh = createClippy(1.15);
        mesh.position.set(p.x, 1.4, p.z);
        const bubble = createSpeechSprite(pick(CLIPPY_QUOTES));
        bubble.position.y = 2.6;
        mesh.add(bubble);
        this.group.add(mesh);
        this.clippies.push({
            mesh, hp: 3, radius: 1.1,
            speed: 3.6, dash: 0, quoteT: 4,
            bubble
        });
    }

    spawnDog() {
        const mesh = createDog();
        mesh.position.set(12, 0, -14);
        this.group.add(mesh);
        this.dogs.push({ mesh, laugh: 0, hide: 0 });
    }

    spawnFloppy() {
        const p = this.rimPoint(6);
        const mesh = createFloppy();
        mesh.position.set(p.x, 1.15, p.z);
        this.group.add(mesh);
        this.floppies.push({ mesh, radius: 0.8, spin: Math.random() * 6 });
    }

    fillFloppies(n) {
        while (this.floppies.length < n) this.spawnFloppy();
    }

    spawnMushroom() {
        const p = this.rimPoint(10);
        const mesh = createMushroom();
        mesh.position.set(p.x, 0, p.z);
        this.group.add(mesh);
        this.mushrooms.push({ mesh, radius: 0.7 });
    }

    spawnTetris() {
        const p = this.rimPoint(4);
        const mesh = createTetrisBlock(randInt(0, 3));
        mesh.position.set(p.x, 16 + Math.random() * 6, p.z);
        this.group.add(mesh);
        this.tetris.push({
            mesh, radius: 1.3, vy: 0, grounded: 0, hp: 1
        });
    }

    spawnToast(shot) {
        const mesh = createToastSlice();
        mesh.position.set(shot.x, shot.y, shot.z);
        this.group.add(mesh);
        this.toasts.push({
            mesh,
            vx: shot.vx, vy: shot.vy, vz: shot.vz,
            life: COMBAT.toastLife,
            radius: COMBAT.toastRadius
        });
    }

    spawnDialog(x, y, z, vx, vz) {
        const mesh = createErrorDialog();
        mesh.position.set(x, y, z);
        this.group.add(mesh);
        this.dialogs.push({ mesh, vx, vz, life: 3.2, radius: 0.85 });
    }

    popup(text, x, y, z, color) {
        const mesh = createPopupSprite(text, color);
        mesh.position.set(x, y + 1.6, z);
        this.group.add(mesh);
        this.popups.push({ mesh, life: 1.1 });
    }

    ensureWave(index) {
        const wantGhosts = 2 + index;
        const wantInv = index >= 1 ? 3 + index : 0;
        const wantClip = index >= 2 ? Math.min(2, index - 1) : 0;
        while (this.ghosts.length < wantGhosts) this.spawnGhost();
        while (this.invaders.length < wantInv) this.spawnInvader();
        while (this.clippies.length < wantClip) this.spawnClippy();
        if (index >= 1 && Math.random() < 0.5) this.spawnTetris();
        if (index >= 2 && this.mushrooms.length < 1) this.spawnMushroom();
        this.wave = index;
    }

    spawnBoss() {
        if (this.boss) return;
        const mesh = createClippy(3.2);
        mesh.position.set(0, 2.6, -18);
        const bubble = createSpeechSprite('Parece que você precisa de AJUDA.', '#ffb4c8');
        bubble.scale.set(6.5, 2, 1);
        bubble.position.y = 4.4;
        mesh.add(bubble);
        this.group.add(mesh);
        this.boss = {
            mesh, hp: 18, max: 18, radius: 2.4,
            speed: 4.2, t: 0, shoot: 0, bubble
        };
        this.popup('MEGA-CLIPPY', 0, 5, -18, '#ff6b9d');
    }

    update(dt, t, player, audio, onEvent) {
        this.updateGhosts(dt, t, player, onEvent);
        this.updateInvaders(dt, t, player, onEvent);
        this.updateClippies(dt, t, player, audio, onEvent);
        this.updateDogs(dt, t, player);
        this.updateFloppies(dt, player, audio, onEvent);
        this.updateMushrooms(dt, t, player, onEvent);
        this.updateTetris(dt, player, onEvent);
        this.updateToasts(dt);
        this.updateDialogs(dt, player, onEvent);
        this.updateBoss(dt, player, audio, onEvent);
        this.updatePopups(dt);
        this.fillFloppies(4);
        this.collideToasts(onEvent, audio);
    }

    chase(ent, player, dt, speed, hoverY) {
        const dx = player.position.x - ent.mesh.position.x;
        const dz = player.position.z - ent.mesh.position.z;
        const dist = Math.hypot(dx, dz) || 1;
        ent.mesh.position.x += (dx / dist) * speed * dt;
        ent.mesh.position.z += (dz / dist) * speed * dt;
        if (hoverY != null) ent.mesh.position.y = hoverY;
        ent.mesh.lookAt(player.position.x, ent.mesh.position.y, player.position.z);
        return dist;
    }

    updateGhosts(dt, t, player, onEvent) {
        for (const g of this.ghosts) {
            g.wobble += dt;
            const dist = this.chase(g, player, dt, g.speed, 1.05 + Math.sin(t * 3 + g.wobble) * 0.25);
            if (dist < g.radius + 1.05) onEvent('hit', g.mesh.position);
        }
    }

    updateInvaders(dt, t, player, onEvent) {
        for (const inv of this.invaders) {
            inv.mesh.position.x += inv.dir * 3.2 * dt;
            if (Math.abs(inv.mesh.position.x) > ARENA.half - 2) inv.dir *= -1;
            inv.mesh.position.y = 3.2 + Math.sin(t * 2.4 + inv.phase) * 0.5;
            inv.mesh.rotation.y = Math.sin(t + inv.phase) * 0.2;
            inv.shoot -= dt;
            if (inv.shoot <= 0) {
                inv.shoot = randRange(1.6, 3.2);
                const dx = player.position.x - inv.mesh.position.x;
                const dz = player.position.z - inv.mesh.position.z;
                const d = Math.hypot(dx, dz) || 1;
                this.spawnDialog(
                    inv.mesh.position.x,
                    inv.mesh.position.y,
                    inv.mesh.position.z,
                    (dx / d) * 8,
                    (dz / d) * 8
                );
            }
            const dist = Math.hypot(
                player.position.x - inv.mesh.position.x,
                player.position.z - inv.mesh.position.z
            );
            const dy = Math.abs(player.position.y + 0.8 - inv.mesh.position.y);
            if (dist < 1.2 && dy < 1.4) onEvent('hit', inv.mesh.position);
        }
    }

    updateClippies(dt, t, player, audio, onEvent) {
        for (const c of this.clippies) {
            c.dash -= dt;
            const spd = c.dash > 0 ? c.speed * 2.4 : c.speed;
            const dist = this.chase(c, player, dt, spd, 1.35 + Math.sin(t * 2) * 0.15);
            if (c.dash <= -2.5) c.dash = 0.55;
            if (dist < c.radius + 1.05) onEvent('hit', c.mesh.position);
            c.quoteT -= dt;
            if (c.quoteT <= 0 && c.bubble?.material?.map) {
                c.quoteT = randRange(5, 9);
                audio?.clippy();
            }
            if (c.bubble) c.bubble.material.opacity = 0.65 + Math.sin(t * 3) * 0.2;
        }
    }

    updateDogs(dt, t, player) {
        for (const d of this.dogs) {
            const tail = d.mesh.getObjectByName('tail');
            if (tail) tail.rotation.y = 0.4 + Math.sin(t * 8) * 0.5;
            const dist = Math.hypot(
                player.position.x - d.mesh.position.x,
                player.position.z - d.mesh.position.z
            );
            d.mesh.lookAt(player.position.x, 0, player.position.z);
            if (dist < 3.2) d.laugh = 1;
            d.laugh = Math.max(0, d.laugh - dt);
            d.mesh.position.y = d.laugh > 0 ? Math.abs(Math.sin(t * 12)) * 0.35 : 0;
        }
    }

    updateFloppies(dt, player, audio, onEvent) {
        for (let i = this.floppies.length - 1; i >= 0; i--) {
            const f = this.floppies[i];
            f.spin += dt * 2.2;
            f.mesh.rotation.y = f.spin;
            f.mesh.position.y = 1.05 + Math.sin(f.spin * 2) * 0.2;
            const dist = Math.hypot(
                player.position.x - f.mesh.position.x,
                player.position.z - f.mesh.position.z
            );
            if (dist < f.radius + 1.1) {
                const pos = f.mesh.position.clone();
                this.group.remove(f.mesh);
                this.floppies.splice(i, 1);
                onEvent('floppy', pos);
            }
        }
    }

    updateMushrooms(dt, t, player, onEvent) {
        for (let i = this.mushrooms.length - 1; i >= 0; i--) {
            const m = this.mushrooms[i];
            m.mesh.position.y = Math.sin(t * 3) * 0.08;
            m.mesh.rotation.y += dt;
            const dist = Math.hypot(
                player.position.x - m.mesh.position.x,
                player.position.z - m.mesh.position.z
            );
            if (dist < m.radius + 1.1) {
                const pos = m.mesh.position.clone();
                this.group.remove(m.mesh);
                this.mushrooms.splice(i, 1);
                onEvent('life', pos);
            }
        }
    }

    updateTetris(dt, player, onEvent) {
        for (let i = this.tetris.length - 1; i >= 0; i--) {
            const b = this.tetris[i];
            if (b.grounded > 0) {
                b.grounded -= dt;
                if (b.grounded <= 0) {
                    this.group.remove(b.mesh);
                    this.tetris.splice(i, 1);
                }
                continue;
            }
            b.vy += 18 * dt;
            b.mesh.position.y -= b.vy * dt;
            b.mesh.rotation.y += dt * 0.4;
            if (b.mesh.position.y <= 0.5) {
                b.mesh.position.y = 0.5;
                b.grounded = 4.5;
                this.effects?.dust(b.mesh.position);
            }
            const dist = Math.hypot(
                player.position.x - b.mesh.position.x,
                player.position.z - b.mesh.position.z
            );
            const dy = player.position.y + 0.7 - b.mesh.position.y;
            if (dist < 1.6 && Math.abs(dy) < 1.3) onEvent('hit', b.mesh.position);
        }
    }

    updateToasts(dt) {
        for (let i = this.toasts.length - 1; i >= 0; i--) {
            const t = this.toasts[i];
            t.mesh.position.x += t.vx * dt;
            t.mesh.position.y += t.vy * dt;
            t.mesh.position.z += t.vz * dt;
            t.mesh.rotation.x += dt * 10;
            t.mesh.rotation.y += dt * 6;
            t.life -= dt;
            if (t.life <= 0 || Math.hypot(t.mesh.position.x, t.mesh.position.z) > ARENA.wall) {
                this.group.remove(t.mesh);
                this.toasts.splice(i, 1);
            }
        }
    }

    updateDialogs(dt, player, onEvent) {
        for (let i = this.dialogs.length - 1; i >= 0; i--) {
            const d = this.dialogs[i];
            d.mesh.position.x += d.vx * dt;
            d.mesh.position.z += d.vz * dt;
            d.mesh.rotation.z += dt * 1.2;
            d.life -= dt;
            const dist = Math.hypot(
                player.position.x - d.mesh.position.x,
                player.position.z - d.mesh.position.z
            );
            const dy = Math.abs(player.position.y + 0.8 - d.mesh.position.y);
            if (dist < d.radius + 1.0 && dy < 1.4) {
                onEvent('hit', d.mesh.position);
                this.group.remove(d.mesh);
                this.dialogs.splice(i, 1);
                continue;
            }
            if (d.life <= 0) {
                this.group.remove(d.mesh);
                this.dialogs.splice(i, 1);
            }
        }
    }

    updateBoss(dt, player, audio, onEvent) {
        if (!this.boss) return;
        const b = this.boss;
        b.t += dt;
        const dist = this.chase(b, player, dt, b.speed, 2.5 + Math.sin(b.t * 2) * 0.3);
        b.shoot -= dt;
        if (b.shoot <= 0) {
            b.shoot = 1.15;
            const dx = player.position.x - b.mesh.position.x;
            const dz = player.position.z - b.mesh.position.z;
            const d = Math.hypot(dx, dz) || 1;
            for (const ang of [-0.35, 0, 0.35]) {
                const ca = Math.cos(ang);
                const sa = Math.sin(ang);
                const vx = (dx / d) * ca - (dz / d) * sa;
                const vz = (dx / d) * sa + (dz / d) * ca;
                this.spawnDialog(
                    b.mesh.position.x,
                    b.mesh.position.y + 0.4,
                    b.mesh.position.z,
                    vx * 11,
                    vz * 11
                );
            }
            audio?.error();
        }
        if (dist < b.radius + 1.1) onEvent('hit', b.mesh.position);
        if (b.hp <= 0) {
            this.popup('HELP? NÃO MAIS.', b.mesh.position.x, 4, b.mesh.position.z, '#9dff6b');
            this.effects?.explode(b.mesh.position, 0xffe14a);
            this.group.remove(b.mesh);
            this.boss = null;
            onEvent('bossDown', b.mesh.position);
        }
    }

    updatePopups(dt) {
        for (let i = this.popups.length - 1; i >= 0; i--) {
            const p = this.popups[i];
            p.mesh.position.y += dt * 1.6;
            p.life -= dt;
            p.mesh.material.opacity = Math.max(0, p.life / 1.1);
            if (p.life <= 0) {
                p.mesh.material.map?.dispose();
                p.mesh.material.dispose();
                this.group.remove(p.mesh);
                this.popups.splice(i, 1);
            }
        }
    }

    collideToasts(onEvent, audio) {
        const targets = [
            ...this.ghosts,
            ...this.invaders,
            ...this.clippies,
            ...this.tetris.filter((b) => b.hp)
        ];
        if (this.boss) targets.push(this.boss);

        for (let i = this.toasts.length - 1; i >= 0; i--) {
            const t = this.toasts[i];
            for (let j = 0; j < targets.length; j++) {
                const e = targets[j];
                if (!e.mesh.parent) continue;
                const dx = t.mesh.position.x - e.mesh.position.x;
                const dy = t.mesh.position.y - e.mesh.position.y;
                const dz = t.mesh.position.z - e.mesh.position.z;
                const r = (e.radius || 0.9) + t.radius;
                if (dx * dx + dy * dy + dz * dz < r * r) {
                    e.hp -= 1;
                    this.effects?.crumbs(t.mesh.position);
                    this.group.remove(t.mesh);
                    this.toasts.splice(i, 1);
                    if (e.hp <= 0 && e !== this.boss) {
                        this.effects?.explode(e.mesh.position, 0xffc14a);
                        this.group.remove(e.mesh);
                        pull(this.ghosts, e);
                        pull(this.invaders, e);
                        pull(this.clippies, e);
                        pull(this.tetris, e);
                        onEvent('kill', e.mesh.position);
                        audio?.crunch();
                    } else {
                        onEvent('hurtEnemy', e.mesh.position);
                        audio?.hit();
                    }
                    break;
                }
            }
        }
    }
}
