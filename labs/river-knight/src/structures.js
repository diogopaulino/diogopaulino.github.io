/**
 * Estruturas das margens e do leito: torres de vigia (pedra, madeira e
 * catapulta) e barricadas de troncos. Modelos em structure-models.js; o pool
 * vive em entities.js.
 *
 * Nada aqui cria luz: cada fogo ATIVO pede luz a `fireLights` por quadro.
 */

import * as THREE from 'three';
import { createHero } from '../../shared/gfx/hero.js';
import { Entity } from './entity.js?v=50';
import {
    buildStoneTower,
    buildWoodTower,
    buildCatapult,
    buildBarricade,
    Debris,
    rubbleGeometry,
    timberGeometry,
    boomLogGeometry,
    CATAPULT_COCKED,
    CATAPULT_RELEASED,
    fxTime,
    hash
} from './structure-models.js?v=51';
import { blockStone, darkWood, barkWood, oakWood } from './materials.js?v=50';
import { fireLights } from './lights.js?v=50';
import { waterHeight, waterSlope } from './water.js?v=51';
import { centerX, terrainHeight } from './river.js?v=51';
import { randRange } from './utils.js?v=50';

const tmpSlope = { dx: 0, dz: 0 };
const tmpLook = new THREE.Vector3();

const STONE = 0;
const WOOD = 1;
const CATAPULT = 2;
let lastVariant = -1;
let towerCount = 0;

/* ================================================================== */
/* Torre de vigia                                                      */
/* ================================================================== */

/**
 * Três variantes sorteadas a cada `spawn` (nunca a mesma duas vezes seguidas):
 * torre de pedra com hurdício, torre de madeira sobre estacas e trabuco em platô
 * de troncos. Todas têm uma sentinela (createHero) que golpeia ao disparar.
 *
 * Regras (inalteradas): 4 pontos de vida; dispara a cada `fireRate`·[0,85; 1,2] s
 * enquanto o jogador está entre 150 m antes e 6 m depois; some 60 m atrás.
 *
 * Trabuco — ciclo do braço (ângulo θ em torno de X, ver structure-models.js):
 *   solto:   θ(t) = lerp(θ_armado, θ_solto, (t/0,32)²)        t ∈ [0; 0,32] s; o projétil sai em t = 0,24 s
 *   balanço: θ = θ_solto + 0,18·sen(9·τ)·e^(−3·τ)             τ = t − 0,32, até t = 1,2 s
 *   rearme:  θ volta a θ_armado em clamp(0,5·fireRate; 0,8; 2) s (velocidade constante)
 * O disparo só começa com o braço armado, então a cadência efetiva nunca passa a do rearme.
 *
 * Desmoronamento (`crumble` > 0 até o último destroço sumir): o modelo inteiro dá
 * lugar a blocos e vigas pré-fraturados com a física de `Debris` (gravidade,
 * quique no chão, respingo e afundamento/flutuação na água), ~3 s.
 */
export class Tower extends Entity {
    constructor(lit = true) {
        const group = new THREE.Group();
        super(group);
        this.kind = 'tower';
        this.radius = 3.4;
        this.maxHp = 4;
        this.crumble = 0;
        this.index = towerCount++;

        this.variants = [buildStoneTower(), buildWoodTower(), buildCatapult()];
        for (const v of this.variants) {
            v.visible = false;
            group.add(v);
        }
        this.variant = STONE;
        this.model = this.variants[STONE];

        this.stoneDebris = new Debris(rubbleGeometry(), blockStone(), 30, { float: 0, half: 0.5 });
        this.woodDebris = new Debris(timberGeometry(), darkWood(), 18, { float: 1, half: 0.2 });
        group.add(this.stoneDebris.mesh, this.woodDebris.mesh);

        this.hero = createHero({ preset: this.index % 2 ? 'orc' : 'guard', detail: lit ? 1 : 0 });
        this.heroState = { mode: 'idle', speed: 0, phase: undefined, duration: 0.7 };
        this.heroFall = 0;
        this.attackT = -1;
        group.add(this.hero.object);

        // trabuco
        this.swing = -1;
        this.released = false;
        this.armAngle = CATAPULT_COCKED;
        this.recock = 1.5;
    }

    spawn(x, z, { fireRate = 3.2 } = {}) {
        const y = terrainHeight(x, z);
        this.group.position.set(x, Math.max(-1.2, y) - 0.6, z);
        // frente (+Z local) voltada para o rio e um pouco rio acima, de onde vem o jogador
        const dx = centerX(z) - x;
        this.group.rotation.set(0, Math.atan2(dx, Math.abs(dx) * 0.7 + 2), 0);
        this.group.scale.setScalar(1);
        this.hp = this.maxHp;
        this.fireRate = fireRate;
        this.fireTimer = randRange(1, fireRate);
        this.crumble = 0;

        let v = Math.floor(Math.random() * 3);
        if (v === lastVariant) v = (v + 1 + Math.floor(Math.random() * 2)) % 3;
        lastVariant = v;
        this.setVariant(v);
        this.activate();
    }

    /** Troca o modelo visível (0 pedra · 1 madeira · 2 trabuco) e reposiciona a sentinela. */
    setVariant(v) {
        this.variant = v;
        for (let i = 0; i < this.variants.length; i++) this.variants[i].visible = i === v;
        this.model = this.variants[v];
        this.stoneDebris.hide();
        this.woodDebris.hide();
        const u = this.model.userData;
        this.hero.object.visible = true;
        this.hero.object.position.copy(u.guard);
        this.hero.object.rotation.set(0, v === CATAPULT ? 0.5 : 0, 0);
        this.heroState.mode = 'idle';
        this.heroState.phase = undefined;
        this.attackT = -1;
        this.heroFall = 0;
        this.swing = -1;
        this.released = false;
        this.armAngle = CATAPULT_COCKED;
        if (u.arm) {
            u.arm.rotation.x = this.armAngle;
            u.boulder.visible = true;
        }
        u.flame.visible = true;
    }

    /** Ponto local do modelo → mundo (o grupo só gira em Y). Escreve em tmpLook. */
    _world(local) {
        const yaw = this.group.rotation.y;
        const c = Math.cos(yaw);
        const s = Math.sin(yaw);
        const p = this.group.position;
        return tmpLook.set(p.x + c * local.x + s * local.z, p.y + local.y, p.z - s * local.x + c * local.z);
    }

    _shoot(ctx) {
        const m = this._world(this.model.userData.muzzle);
        if (this.variant === CATAPULT && ctx.fireBoulder) ctx.fireBoulder(m.x, m.y, m.z, 1);
        else ctx.fireArrow(m.x, m.y, m.z, 1);
    }

    update(dt, ctx) {
        const pos = this.group.position;

        if (this.crumble > 0) {
            this.crumble += dt;
            const a = this.stoneDebris.update(dt, ctx.time, this.group, ctx.effects);
            const b = this.woodDebris.update(dt, ctx.time, this.group, ctx.effects);
            const h = this.hero.object;
            if (h.visible) {
                // a sentinela despenca com os destroços (mesma gravidade, 17 m/s²)
                this.heroFall -= 17 * dt;
                h.position.y += this.heroFall * dt;
                h.rotation.x += dt * 1.6;
                this.heroState.mode = 'fall';
                this.heroState.phase = undefined;
                this.hero.update(dt, this.heroState);
                if (h.position.y < -3) h.visible = false;
            }
            if (this.crumble < 0.7 && Math.random() < 0.5) {
                ctx.effects.smokePuff(pos.x + randRange(-2, 2), pos.y + randRange(1, 8), pos.z + randRange(-2, 2), 1, 2);
            }
            if (!a && !b) this.deactivate();
            return;
        }

        const u = this.model.userData;
        const dz = pos.z - ctx.player.z;
        const near = dz > -200 && dz < 40;

        // fogo: luz emprestada do pool + fagulhas
        if (dz > -170 && dz < 30) {
            const f = this._world(u.firePoint);
            const flicker = 0.85 + Math.sin(ctx.time * 11 + pos.x) * 0.1 + Math.sin(ctx.time * 23 + pos.z) * 0.05;
            fireLights.request(f.x, f.y, f.z, 0xff8a3a, 75 * flicker, 17);
            if (dz > -90 && dz < 12 && Math.random() < 0.035) ctx.effects.fire(f.x, f.y, f.z, 1, 0.85);
        }

        // disparo
        const armed = this.variant !== CATAPULT || (this.swing < 0 && this.armAngle <= CATAPULT_COCKED + 0.01);
        this.fireTimer -= dt;
        if (this.fireTimer <= 0 && dz < 6 && dz > -150 && armed) {
            this.fireTimer = this.fireRate * randRange(0.85, 1.2);
            this.attackT = 0;
            if (this.variant === CATAPULT) {
                this.swing = 0;
                this.released = false;
                this.recock = Math.min(2, Math.max(0.8, this.fireRate * 0.5));
            } else {
                this._shoot(ctx);
            }
        }

        if (this.variant === CATAPULT) this._updateCatapult(dt, ctx);

        // sentinela
        if (near) {
            const st = this.heroState;
            if (this.attackT >= 0) {
                this.attackT += dt;
                st.mode = 'attack';
                st.phase = Math.min(1, this.attackT / 0.7);
                if (this.attackT > 0.7) this.attackT = -1;
            } else {
                st.mode = 'idle';
                st.phase = undefined;
            }
            this.hero.lookAt(tmpLook.set(ctx.player.x, ctx.player.y + 1.5, ctx.player.z));
            this.hero.update(dt, st);
        }

        if (dz > 60) this.deactivate();
    }

    _updateCatapult(dt, ctx) {
        const u = this.model.userData;
        if (this.swing >= 0) {
            this.swing += dt;
            const t = Math.min(1, this.swing / 0.32);
            if (this.swing <= 0.32) {
                this.armAngle = CATAPULT_COCKED + (CATAPULT_RELEASED - CATAPULT_COCKED) * t * t;
            } else {
                const tau = this.swing - 0.32;
                this.armAngle = CATAPULT_RELEASED + 0.18 * Math.sin(9 * tau) * Math.exp(-3 * tau);
            }
            if (!this.released && this.swing >= 0.24) {
                this.released = true;
                u.boulder.visible = false;
                u.flame.visible = false;
                this._shoot(ctx);
            }
            if (this.swing > 1.2) this.swing = -1;
        } else if (this.armAngle > CATAPULT_COCKED) {
            this.armAngle = Math.max(CATAPULT_COCKED, this.armAngle - ((CATAPULT_RELEASED - CATAPULT_COCKED) / this.recock) * dt);
            if (this.armAngle <= CATAPULT_COCKED + 0.01) {
                u.boulder.visible = true;
                u.flame.visible = true;
            }
        }
        u.arm.rotation.x = this.armAngle;
        // chama a prumo sobre a pedra: p = eixo + R_x(θ)·(0; −0,5; L − 0,1)
        const c = Math.cos(this.armAngle);
        const s = Math.sin(this.armAngle);
        const ly = -0.5;
        const lz = u.armLength - 0.1;
        u.flame.position.set(0, u.axleY + ly * c - lz * s + 0.15, ly * s + lz * c);
    }

    hit(damage, ctx) {
        this.hp -= damage;
        const pos = this.position;
        const top = this.model.userData.height;
        if (this.hp > 0) {
            ctx.effects.impact(pos.x, pos.y + top * 0.8, pos.z, 0xcfc9bd);
            ctx.audio.sfx(this.variant === STONE ? 'hitMetal' : 'hitWood');
            return false;
        }
        this.crumble = 0.001;
        ctx.effects.explosion(pos.x, pos.y + top * 0.7, pos.z, 1.5, 0.09);
        ctx.effects.smokePuff(pos.x, pos.y + top * 0.5, pos.z, 8, 2.2);
        ctx.audio.sfx('explosion');
        this._collapse();
        return true;
    }

    /**
     * Distribui os pedaços pelo volume do modelo e dá o impulso inicial:
     *   v = radial·U(1,5; 4,5) + ŷ·U(0; 4)·(y/H)      atraso = 0,35·(1 − y/H)  (o topo cede primeiro)
     */
    _collapse() {
        this.model.visible = false;
        this.model.userData.flame.visible = false;
        const sd = this.stoneDebris;
        const wd = this.woodDebris;
        sd.begin(3);
        wd.begin(3);
        this.heroFall = 2;
        let n = 0;
        const r = () => hash(++n * 1.37 + this.index * 9.1 + this.position.z);
        const piece = (d, x, y, z, H, sx, sy, sz, ry = 0, rz = 0, out = 1) => {
            const l = Math.hypot(x, z) || 1;
            const sp = (1.5 + r() * 3) * out;
            d.add(x, y, z, (x / l) * sp + (r() - 0.5), r() * 4 * (y / H), (z / l) * sp + (r() - 0.5), sx, sy, sz, 0.35 * (1 - y / H), ry, rz);
        };
        if (this.variant === STONE) {
            for (let level = 0; level < 6; level++) {
                for (let i = 0; i < 5; i++) {
                    const a = ((i + (level % 2) * 0.5) / 5) * Math.PI * 2;
                    piece(sd, Math.sin(a) * 1.8, 0.8 + level * 1.75, Math.cos(a) * 1.8, 10, 2.3 + r() * 0.5, 2.1, 1.6 + r() * 0.4, a);
                }
            }
            for (let i = 0; i < 10; i++) {
                const a = -1.5 + (i / 9) * 3;
                piece(wd, Math.sin(a) * 3.6, 8 + r() * 2, Math.cos(a) * 3.6, 10, 1.1, 0.8 + r() * 0.5, 1.1, a, r() * 3);
            }
        } else if (this.variant === WOOD) {
            for (const c of [[1, 1], [1, -1], [-1, -1], [-1, 1]]) {
                piece(wd, c[0] * 1.8, 2.5, c[1] * 1.8, 12, 1.25, 2.6, 1.25, 0, (r() - 0.5) * 0.3, 0.5);
                piece(wd, c[0] * 1.7, 7.5, c[1] * 1.7, 12, 1.2, 2.2, 1.2, 0, (r() - 0.5) * 0.4, 0.8);
            }
            for (let i = 0; i < 6; i++) piece(wd, -1.6 + i * 0.64, 8.1, (r() - 0.5) * 2, 12, 1.4, 1.9, 0.7, 0, Math.PI / 2);
            for (let i = 0; i < 4; i++) piece(wd, (r() - 0.5) * 3, 11 + r(), (r() - 0.5) * 3, 12, 1.6, 1.4, 1.6, r() * 6, 1 + r());
        } else {
            for (let i = 0; i < 8; i++) piece(wd, (r() - 0.5) * 0.6, 3, -2.6 + i * 0.75, 8, 1.5, 3.1, 1.5, 0, Math.PI / 2, 0.6);
            for (const x of [-1.05, 1.05]) {
                piece(wd, x, 5, 0.8, 8, 1.4, 1.9, 1.4, 0, 0.4);
                piece(wd, x, 5, -0.8, 8, 1.4, 1.9, 1.4, 0, -0.4);
            }
            piece(wd, 0, 6.8, -1, 8, 1.3, 2.4, 1.3, Math.PI / 2, 1.2);
            piece(wd, 0, 6.8, 1.5, 8, 1.1, 2.2, 1.1, Math.PI / 2, 1.2);
            for (let i = 0; i < 6; i++) piece(sd, 1.8 + r(), 3.6, -1.5 + r() * 2, 8, 0.7, 0.9, 0.8, r() * 6);
        }
    }
}

/* ================================================================== */
/* Barricada de troncos                                                */
/* ================================================================== */

/**
 * Barreira flutuante. 2 pontos de vida; ao quebrar (`sinking` > 0, sem colisão
 * nem mira) os troncos se soltam, boiam à deriva e afundam:
 *   nível de flutuação(t) = superfície − max(0, t − 1,3)·0,9 m     (Debris.sink)
 * e a entidade sai do pool quando os destroços somem (3 s).
 */
export class Barricade extends Entity {
    constructor() {
        const group = new THREE.Group();
        super(group);
        this.kind = 'barricade';
        this.radius = 4.4;
        this.maxHp = 2;
        this.sinking = 0;
        this.model = buildBarricade();
        group.add(this.model);
        this.debris = new Debris(boomLogGeometry(), [barkWood(), oakWood(0xd9c9a8)], 7, { float: 1, half: 0.3 });
        group.add(this.debris.mesh);
    }

    spawn(x, z) {
        this.group.position.set(x, 0, z);
        this.group.rotation.set(0, randRange(-0.25, 0.25), 0);
        this.hp = this.maxHp;
        this.sinking = 0;
        this.model.visible = true;
        this.debris.hide();
        this.activate();
    }

    update(dt, ctx) {
        const pos = this.group.position;
        if (this.sinking > 0) {
            this.sinking += dt;
            this.debris.sink = Math.max(0, this.sinking - 1.3) * 0.9;
            if (!this.debris.update(dt, ctx.time, this.group, ctx.effects)) this.deactivate();
            return;
        }
        pos.y = waterHeight(pos.x, pos.z, ctx.time) + 0.1;
        waterSlope(pos.x, pos.z, ctx.time, tmpSlope);
        this.group.rotation.z = -tmpSlope.dx * 2.2;
        this.group.rotation.x = tmpSlope.dz * 1.4;
        if (pos.z - ctx.player.z > 40) this.deactivate();
    }

    hit(damage, ctx) {
        if (this.sinking > 0) return false;
        this.hp -= damage;
        const pos = this.position;
        if (this.hp > 0) {
            ctx.effects.impact(pos.x, pos.y + 0.5, pos.z, 0xd9b98a);
            ctx.audio.sfx('hitWood');
            return false;
        }
        ctx.effects.explosion(pos.x, pos.y + 0.4, pos.z, 0.9, 0.08);
        ctx.effects.splash(pos.x, pos.y + 0.1, pos.z, 16, 1.3);
        ctx.audio.sfx('explosion', 0.7);
        this._break();
        return true;
    }

    /** Solta os troncos: 3 grandes + 4 travessas, empurrados rio abaixo (−Z) e para os lados. */
    _break() {
        this.sinking = 0.001;
        this.model.visible = false;
        this.group.rotation.x = 0;
        this.group.rotation.z = 0;
        const d = this.debris;
        d.begin(3);
        let n = 0;
        const r = () => hash(++n * 2.11 + this.position.z);
        [-0.66, 0, 0.66].forEach((z, i) => {
            d.add((r() - 0.5) * 0.5, 0, z, (r() - 0.5) * 3, 2 + r() * 2.5, (i - 1) * 2 - 1.5 - r() * 2, 1, 1, 1, 0, (r() - 0.5) * 0.3);
        });
        for (const x of [-3.1, -1, 1.1, 3.2]) {
            d.add(x, 0.4, 0, x * 0.8 + (r() - 0.5) * 2, 3 + r() * 3, -1 - r() * 3, 0.27, 0.5, 0.5, 0, Math.PI / 2 + (r() - 0.5));
        }
    }
}

/** Avança o relógio dos shaders de fogo/tecido das estruturas (chamado por castle.update). */
export function tickStructures(time) {
    fxTime.value = time;
}
