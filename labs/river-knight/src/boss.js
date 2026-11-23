/**
 * A Barcaça Negra de Morvain — o chefe que fecha o rio antes do castelo.
 */

import * as THREE from 'three';
import { buildLongship } from './ships.js?v=60';
import { Crew } from './ships.js?v=60';
import { bronze, darkWood, glow } from './materials.js?v=60';
import { bannerGeometry, bannerMaterial } from './structure-models.js?v=60';
import { fireLights } from './lights.js?v=60';
import { centerX, halfWidth } from './river.js?v=60';
import { waterHeight, waterSlope } from './water.js?v=60';
import { SCORE } from './config.js?v=60';
import { clamp, damp, randRange } from './utils.js?v=60';

const tmpSlope = { dx: 0, dz: 0 };
const BOSS_ROW = { rowRate: 2.1, speedRatio: 0.4 };
const tmpV = new THREE.Vector3();

/* ================================================================== */
/* Barcaça Negra (chefe)                                               */
/* ================================================================== */

/**
 * Rostro de bronze, centrado como o cone de altura 5. A ponta fica em +Y.
 * Flange de fixação, dois anéis e um bico rombo — não um cone liso.
 * Seis caneluras no haste.
 */
function bossRamGeometry() {
    const pts = [
        [1.35, -2.5],
        [1.72, -2.22],
        [0.92, -1.82],
        [0.58, -1.15],
        [0.78, -0.72],
        [0.48, 0.05],
        [0.74, 0.55],
        [0.44, 1.25],
        [0.66, 1.78],
        [0.82, 2.12],
        [0.36, 2.36],
        [0.18, 2.5]
    ];
    const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 20);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        const rad = Math.hypot(x, z);
        if (rad < 0.22 || y < -2.05 || y > 2.05) continue;
        const flute = Math.cos(Math.atan2(z, x) * 6);
        const depth = flute > 0 ? 0.09 * flute * flute : -0.045 * flute * flute;
        const k = 1 + depth / rad;
        pos.setXYZ(i, x * k, y, z * k);
    }
    g.computeVertexNormals();
    return g;
}

/** Tambor da balista, centrado como o cilindro de altura 3.4. Barril com aros. */
function ballistaDrumGeometry() {
    const H = 3.4;
    const pts = [];
    const steps = 24;
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const y = (t - 0.5) * H;
        const belly = Math.sin(t * Math.PI);
        let r = 1.32 + belly * 0.48;
        if (t < 0.07 || t > 0.93) r += 0.16;
        if (Math.abs(Math.sin(t * Math.PI * 5)) > 0.86) r += 0.16;
        pts.push(new THREE.Vector2(r, y));
    }
    const g = new THREE.LatheGeometry(pts, 18);
    g.computeVertexNormals();
    return g;
}

/** Arco da balista: prod curvo no lugar da viga reta. Corda no plano y=0. */
function ballistaBowGeometry() {
    const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(-2.15, 0, 0),
        new THREE.Vector3(0, 0.55, 0.42),
        new THREE.Vector3(2.15, 0, 0)
    );
    return new THREE.TubeGeometry(curve, 18, 0.15, 8, false);
}

const BOSS_RAM = bossRamGeometry();
const BALLISTA_DRUM = ballistaDrumGeometry();
const BALLISTA_BOW = ballistaBowGeometry();

export class BossBarge {
    constructor(scene, quality = null) {
        const group = new THREE.Group();
        this.group = group;
        this.scene = scene;

        const { group: hull, parts } = buildLongship({
            length: 30,
            beam: 8.5,
            hullColor: 0x4a3c36,
            sailBase: '#1a1420',
            sailStripe: '#7a1220',
            emblem: 'rune',
            shields: true,
            oars: true,
            dragon: true,
            lantern: false,
            palette: 'dark',
            oarsPerSide: 5,
            tier: quality?.id || 'high',
            crew: { presets: ['orc', 'pirate'], rowers: quality?.id === 'low' ? 2 : 6, detail: 0 }
        });
        hull.scale.set(1, 1.25, 1);
        group.add(hull);
        this.hullGroup = hull;
        this.parts = parts;

        // Rostro na proa (+Z), bico para a frente do rio.
        const ram = new THREE.Mesh(BOSS_RAM, bronze(0x9a7a45, 0.4));
        ram.name = 'bossRam';
        ram.rotation.x = -Math.PI / 2;
        ram.position.set(0, 0.05, 16.6);
        ram.castShadow = true;
        group.add(ram);

        // Torres de balista.
        this.ballistae = [];
        for (const side of [-1, 1]) {
            const tower = new THREE.Group();
            const base = new THREE.Mesh(BALLISTA_DRUM, darkWood(0x6a5a50));
            base.name = 'ballistaDrum';
            base.position.y = 1.7;
            base.castShadow = true;
            tower.add(base);

            const bow = new THREE.Mesh(BALLISTA_BOW, darkWood(0x8a7460));
            bow.name = 'ballistaBow';
            bow.position.y = 3.55;
            tower.add(bow);

            const brazier = new THREE.Mesh(
                new THREE.SphereGeometry(0.55, 10, 8),
                glow(0xff5a10, 5)
            );
            brazier.position.y = 4.1;
            tower.add(brazier);
            tower.userData.brazier = brazier;

            tower.position.set(side * 3.4, 1.4, side * 3);
            group.add(tower);
            this.ballistae.push(tower);
        }

        // Estandarte do vilão.
        const banner = new THREE.Mesh(bannerGeometry(2.4, 4.6, { hang: true, base: 0x12070c, trim: 0xc0303c }), bannerMaterial());
        banner.position.set(0, 9.5, 6);
        group.add(banner);

        group.visible = false;
        scene.add(group);

        this.maxHp = 20;
        this.hp = this.maxHp;
        this.active = false;
        this.dying = 0;
        this.radius = 9;
        this.fireTimer = 0;
        this.lane = 0;
        this.laneTimer = 0;
        this.z = 0;
        this.enraged = false;
    }

    spawn(z, difficulty) {
        this.z = z;
        this.hp = this.maxHp;
        this.active = true;
        this.dying = 0;
        this.enraged = false;
        this.fireTimer = 2.2;
        this.lane = 0;
        this.laneTimer = 0;
        this.difficulty = difficulty;
        this.group.visible = true;
        this.group.position.set(centerX(z), 0, z);
        this.group.rotation.set(0, 0, 0);
        this.group.scale.setScalar(1);
    }

    get healthRatio() {
        return clamp(this.hp / this.maxHp, 0, 1);
    }

    update(dt, ctx) {
        if (!this.active) return;
        const pos = this.group.position;

        if (this.dying > 0) {
            this.dying += dt;
            pos.y -= dt * 1.1;
            this.group.rotation.z += dt * 0.35;
            this.group.rotation.x += dt * 0.12;
            if (Math.random() < 0.9) {
                ctx.effects.fire(
                    pos.x + randRange(-7, 7),
                    pos.y + randRange(0, 5),
                    pos.z + randRange(-12, 12),
                    2,
                    1.4
                );
                ctx.effects.smokePuff(pos.x + randRange(-6, 6), pos.y + 3, pos.z + randRange(-10, 10), 2, 2.4);
            }
            if (this.dying > 4.5) {
                this.active = false;
                this.group.visible = false;
            }
            return;
        }

        // Recua devagar em direção ao castelo conforme perde vida.
        const retreat = (1 - this.healthRatio) * 26;
        const targetZ = this.z - retreat;

        // Persegue lateralmente o jogador para bloquear a passagem.
        this.laneTimer -= dt;
        if (this.laneTimer <= 0) {
            this.laneTimer = randRange(1.1, 2.2);
            const playerLane = (ctx.player.x - centerX(ctx.player.z)) / Math.max(1, halfWidth(ctx.player.z));
            this.lane = clamp(playerLane * 0.85 + randRange(-0.2, 0.2), -0.55, 0.55);
        }
        const targetX = centerX(pos.z) + this.lane * halfWidth(pos.z) * 0.8;

        pos.x = damp(pos.x, targetX, this.enraged ? 1.5 : 0.9, dt);
        pos.z = damp(pos.z, targetZ, 0.7, dt);
        pos.y = waterHeight(pos.x, pos.z, ctx.time) + 1.1;

        waterSlope(pos.x, pos.z, ctx.time, tmpSlope);
        this.group.rotation.z = -tmpSlope.dx * 1.2;
        this.group.rotation.x = tmpSlope.dz * 0.9;

        this.parts.animate(dt, ctx.time, BOSS_ROW);

        for (const tower of this.ballistae) {
            const b = tower.userData.brazier;
            const s = 0.85 + Math.sin(ctx.time * 8 + tower.position.x) * 0.18;
            b.scale.set(s, s * 1.3, s);
            b.getWorldPosition(tmpV);
            fireLights.request(tmpV.x, tmpV.y + 0.4, tmpV.z, 0xff6a2a, 140 * s, 26);
            if (Math.random() < 0.3) {
                const p = tmpV;
                b.getWorldPosition(p);
                ctx.effects.fire(p.x, p.y, p.z, 1, 0.9);
            }
        }

        // Salvas de flechas.
        this.fireTimer -= dt;
        if (this.fireTimer <= 0) {
            const rate = this.enraged ? 1.35 : 2.1;
            this.fireTimer = rate / (this.difficulty?.enemyFireScale || 1);
            const shots = this.enraged ? 5 : 3;
            for (let i = 0; i < shots; i++) {
                const spread = (i - (shots - 1) / 2) * 3.2;
                ctx.fireArrow(pos.x + spread, pos.y + 4.5, pos.z - 12, 1.15);
            }
            ctx.audio.sfx('arrow');
        }
    }

    hit(damage, ctx) {
        if (!this.active || this.dying > 0) return false;
        this.hp -= damage;
        const pos = this.group.position;
        ctx.effects.impact(pos.x + randRange(-4, 4), pos.y + randRange(1, 4), pos.z + randRange(-8, 8), 0xffb066);
        ctx.audio.sfx('hitWood');

        if (!this.enraged && this.healthRatio < 0.45) {
            this.enraged = true;
            ctx.onEnrage?.();
        }

        if (this.hp <= 0) {
            this.dying = 0.001;
            ctx.effects.explosion(pos.x, pos.y + 2, pos.z, 3.4, 0.06);
            ctx.effects.explosion(pos.x + 5, pos.y + 3, pos.z - 6, 2.4, 0.09);
            ctx.effects.explosion(pos.x - 5, pos.y + 1, pos.z + 6, 2.4, 0.05);
            ctx.audio.sfx('explosion', 1.4);
            ctx.onKill?.(SCORE.bossKill, pos);
            return true;
        }
        return false;
    }

    reset() {
        this.active = false;
        this.dying = 0;
        this.group.visible = false;
    }
}
