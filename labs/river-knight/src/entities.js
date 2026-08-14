/**
 * Entidades do rio: barcos inimigos, torres, barricadas, rochas, redemoinhos,
 * itens, flechas e balas de canhão.
 *
 * Todas vivem em pools de tamanho fixo criados no início da partida. Durante o
 * jogo nada é instanciado: objetos apenas alternam entre ativo e inativo.
 */

import * as THREE from 'three';
import {
    buildLongship,
    buildWatchtower,
    buildBarricade,
    buildRockGeometry,
    buildPickup,
    buildArrowMesh,
    buildCannonballMesh,
    plainMaterial
} from './models.js?v=14';
import { waterHeight, waterSlope } from './water.js?v=15';
import { centerX, halfWidth, terrainHeight } from './river.js';
import { CANNON, SCORE } from './config.js?v=14';
import { clamp, damp, randRange } from './utils.js';

const tmpSlope = { dx: 0, dz: 0 };

/* ================================================================== */
/* Base                                                                */
/* ================================================================== */

class Entity {
    constructor(group) {
        this.group = group;
        this.group.visible = false;
        this.active = false;
        this.radius = 2;
        this.hp = 1;
        this.maxHp = 1;
        this.kind = 'entity';
    }

    get position() {
        return this.group.position;
    }

    activate() {
        this.active = true;
        this.group.visible = true;
    }

    deactivate() {
        this.active = false;
        this.group.visible = false;
    }
}

/* ================================================================== */
/* Barco inimigo                                                       */
/* ================================================================== */

class EnemyShip extends Entity {
    constructor() {
        const { group, parts } = buildLongship({
            length: 11,
            beam: 2.9,
            hullColor: 0x33241c,
            sailBase: '#241d28',
            sailStripe: '#8b1d1d',
            emblem: 'rune',
            shields: false,
            oars: true,
            dragon: true,
            lantern: false
        });
        super(group);
        this.parts = parts;
        this.kind = 'enemyShip';
        this.radius = 4.2;
        this.maxHp = 3;
        this.fireTimer = 0;
        this.sinking = 0;
        this.lane = 0;
    }

    spawn(x, z, { fireRate = 2.6, speed = 7 } = {}) {
        this.group.position.set(x, 0, z);
        this.group.rotation.set(0, 0, 0);
        this.group.scale.setScalar(1);
        this.hp = this.maxHp;
        this.fireTimer = randRange(0.8, fireRate);
        this.fireRate = fireRate;
        this.speed = speed;
        this.sinking = 0;
        this.lane = randRange(-0.5, 0.5);
        this.laneTimer = randRange(1.5, 3.5);
        this.activate();
    }

    update(dt, ctx) {
        const pos = this.group.position;

        if (this.sinking > 0) {
            this.sinking += dt;
            pos.y -= dt * 1.4;
            this.group.rotation.z += dt * 0.7;
            this.group.rotation.x += dt * 0.25;
            if (ctx.effects && Math.random() < 0.5) {
                ctx.effects.smokePuff(pos.x, pos.y + 1.5, pos.z, 1, 1.2);
                ctx.effects.fire(pos.x, pos.y + 1.2, pos.z, 1, 0.8);
            }
            if (this.sinking > 3.4) this.deactivate();
            return;
        }

        // Navega contra a corrente, em direção ao jogador.
        pos.z += this.speed * dt;

        // Ajusta a faixa lateral para cruzar o caminho do jogador.
        this.laneTimer -= dt;
        if (this.laneTimer <= 0) {
            this.laneTimer = randRange(1.6, 3.4);
            const playerLane = (ctx.player.x - centerX(ctx.player.z)) / Math.max(1, halfWidth(ctx.player.z));
            this.lane = clamp(playerLane + randRange(-0.45, 0.45), -0.72, 0.72);
        }
        const targetX = centerX(pos.z) + this.lane * halfWidth(pos.z);
        pos.x = damp(pos.x, targetX, 1.1, dt);

        // Flutuação sobre as ondas.
        pos.y = waterHeight(pos.x, pos.z, ctx.time) + 0.72;
        waterSlope(pos.x, pos.z, ctx.time, tmpSlope);
        this.group.rotation.z = -tmpSlope.dx * 1.6;
        this.group.rotation.x = tmpSlope.dz * 1.3;
        this.group.rotation.y = Math.PI + Math.sin(ctx.time * 0.6) * 0.05;

        // Remos.
        for (const oar of this.parts.oars) {
            oar.rotation.x = Math.sin(ctx.time * 2.6 + oar.userData.phase) * 0.42;
            oar.rotation.z = oar.userData.baseRoll - oar.userData.side * Math.sin(ctx.time * 2.6 + oar.userData.phase + 1.4) * 0.2;
        }

        // Ataque.
        const dz = pos.z - ctx.player.z;
        this.fireTimer -= dt;
        if (this.fireTimer <= 0 && dz < 10 && dz > -190) {
            this.fireTimer = this.fireRate * randRange(0.8, 1.25);
            ctx.fireArrow(pos.x, pos.y + 2.2, pos.z - 4, 1);
        }

        if (dz > 40) this.deactivate();
    }

    hit(damage, ctx) {
        this.hp -= damage;
        if (this.hp > 0) {
            ctx.effects.impact(this.position.x, this.position.y + 1.4, this.position.z, 0xffd08a);
            ctx.audio.sfx('hitWood');
            return false;
        }
        this.sinking = 0.001;
        ctx.effects.explosion(this.position.x, this.position.y + 1.2, this.position.z, 1.3);
        ctx.audio.sfx('explosion', 0.9);
        return true;
    }
}

/* ================================================================== */
/* Torre de vigia                                                      */
/* ================================================================== */

class Tower extends Entity {
    constructor(lit = true) {
        super(buildWatchtower({ lit }));
        this.kind = 'tower';
        this.radius = 3.4;
        this.maxHp = 4;
        this.crumble = 0;
    }

    spawn(x, z, { fireRate = 3.2 } = {}) {
        const y = terrainHeight(x, z);
        this.group.position.set(x, Math.max(-1.2, y) - 0.6, z);
        this.group.rotation.set(0, randRange(0, Math.PI * 2), 0);
        this.group.scale.setScalar(1);
        this.hp = this.maxHp;
        this.fireRate = fireRate;
        this.fireTimer = randRange(1, fireRate);
        this.crumble = 0;
        this.activate();
    }

    update(dt, ctx) {
        const pos = this.group.position;

        if (this.crumble > 0) {
            this.crumble += dt;
            this.group.scale.y = Math.max(0.02, 1 - this.crumble * 0.9);
            this.group.position.y -= dt * 1.2;
            if (this.crumble > 1.3) this.deactivate();
            return;
        }

        const fire = this.group.userData.fire;
        if (fire) {
            const s = 0.85 + Math.sin(ctx.time * 9 + pos.x) * 0.15;
            fire.scale.set(s, s * 1.25, s);
        }

        const dz = pos.z - ctx.player.z;
        if (dz > -90 && dz < 12 && Math.random() < 0.035) {
            ctx.effects.fire(pos.x, pos.y + 11, pos.z, 1, 0.85);
        }

        this.fireTimer -= dt;
        if (this.fireTimer <= 0 && dz < 6 && dz > -150) {
            this.fireTimer = this.fireRate * randRange(0.85, 1.2);
            ctx.fireArrow(pos.x, pos.y + 10, pos.z, 1);
        }

        if (dz > 60) this.deactivate();
    }

    hit(damage, ctx) {
        this.hp -= damage;
        const pos = this.position;
        if (this.hp > 0) {
            ctx.effects.impact(pos.x, pos.y + 9, pos.z, 0xcfc9bd);
            ctx.audio.sfx('hitMetal');
            return false;
        }
        this.crumble = 0.001;
        ctx.effects.explosion(pos.x, pos.y + 8, pos.z, 1.5, 0.09);
        ctx.effects.smokePuff(pos.x, pos.y + 6, pos.z, 8, 2.2);
        ctx.audio.sfx('explosion');
        const light = this.group.userData.light;
        if (light) light.intensity = 0;
        return true;
    }
}

/* ================================================================== */
/* Barricada de troncos                                                */
/* ================================================================== */

class Barricade extends Entity {
    constructor() {
        super(buildBarricade());
        this.kind = 'barricade';
        this.radius = 4.4;
        this.maxHp = 2;
    }

    spawn(x, z) {
        this.group.position.set(x, 0, z);
        this.group.rotation.set(0, randRange(-0.25, 0.25), 0);
        this.hp = this.maxHp;
        this.activate();
    }

    update(dt, ctx) {
        const pos = this.group.position;
        pos.y = waterHeight(pos.x, pos.z, ctx.time) + 0.35;
        waterSlope(pos.x, pos.z, ctx.time, tmpSlope);
        this.group.rotation.z = -tmpSlope.dx * 2.2;
        if (pos.z - ctx.player.z > 40) this.deactivate();
    }

    hit(damage, ctx) {
        this.hp -= damage;
        const pos = this.position;
        if (this.hp > 0) {
            ctx.effects.impact(pos.x, pos.y + 0.5, pos.z, 0xd9b98a);
            ctx.audio.sfx('hitWood');
            return false;
        }
        ctx.effects.explosion(pos.x, pos.y + 0.4, pos.z, 0.9, 0.08);
        ctx.audio.sfx('explosion', 0.7);
        this.deactivate();
        return true;
    }
}

/* ================================================================== */
/* Rocha                                                               */
/* ================================================================== */

class RockObstacle extends Entity {
    constructor(index) {
        const geo = buildRockGeometry(index * 1.7 + 0.4);
        const mesh = new THREE.Mesh(geo, plainMaterial(0x4f4b45, 0.95, 0.02));
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const group = new THREE.Group();
        group.add(mesh);
        super(group);
        this.kind = 'rock';
        this.radius = 2.6;
        this.mesh = mesh;
        this.indestructible = true;
    }

    spawn(x, z, scale = 1) {
        this.group.position.set(x, -0.6, z);
        this.group.rotation.set(randRange(-0.2, 0.2), randRange(0, Math.PI * 2), randRange(-0.2, 0.2));
        this.mesh.scale.setScalar(scale * randRange(1.4, 2.4));
        this.radius = 1.9 * this.mesh.scale.x * 0.75;
        this.activate();
    }

    update(dt, ctx) {
        const pos = this.group.position;
        if (Math.random() < 0.12) {
            ctx.effects.splash(
                pos.x + randRange(-1.4, 1.4),
                waterHeight(pos.x, pos.z, ctx.time),
                pos.z + randRange(-1.4, 1.4),
                1,
                0.5
            );
        }
        if (pos.z - ctx.player.z > 40) this.deactivate();
    }

    hit() {
        return false;
    }
}

/* ================================================================== */
/* Redemoinho                                                          */
/* ================================================================== */

class Whirlpool extends Entity {
    constructor() {
        const group = new THREE.Group();
        const mat = new THREE.MeshBasicMaterial({
            color: 0x9fd6e0,
            transparent: true,
            opacity: 0.32,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        for (let i = 0; i < 3; i++) {
            const ring = new THREE.Mesh(new THREE.TorusGeometry(3.2 - i * 0.9, 0.22, 6, 26), mat);
            ring.rotation.x = Math.PI / 2;
            ring.position.y = -i * 0.35;
            group.add(ring);
        }
        const funnel = new THREE.Mesh(
            new THREE.ConeGeometry(3.4, 3.2, 22, 1, true),
            new THREE.MeshBasicMaterial({
                color: 0x0d2430,
                transparent: true,
                opacity: 0.55,
                side: THREE.DoubleSide,
                depthWrite: false
            })
        );
        funnel.position.y = -1.7;
        funnel.rotation.x = Math.PI;
        group.add(funnel);
        super(group);
        this.kind = 'whirlpool';
        this.radius = 5.4;
        this.indestructible = true;
    }

    spawn(x, z) {
        this.group.position.set(x, 0.1, z);
        this.activate();
    }

    update(dt, ctx) {
        const pos = this.group.position;
        this.group.rotation.y += dt * 1.8;
        pos.y = waterHeight(pos.x, pos.z, ctx.time) + 0.12;
        if (Math.random() < 0.4) {
            const a = Math.random() * Math.PI * 2;
            ctx.effects.splash(pos.x + Math.cos(a) * 3, pos.y, pos.z + Math.sin(a) * 3, 1, 0.4);
        }
        if (pos.z - ctx.player.z > 40) this.deactivate();
    }

    hit() {
        return false;
    }
}

/* ================================================================== */
/* Itens                                                               */
/* ================================================================== */

const PICKUP_KINDS = ['coin', 'heart', 'shield', 'fury'];

class PickupItem extends Entity {
    constructor() {
        const group = new THREE.Group();
        const meshes = {};
        for (const kind of PICKUP_KINDS) {
            const mesh = buildPickup(kind);
            mesh.visible = false;
            group.add(mesh);
            meshes[kind] = mesh;
        }
        const halo = new THREE.Mesh(
            new THREE.RingGeometry(0.7, 1.05, 22),
            new THREE.MeshBasicMaterial({
                color: 0xffe1a3,
                transparent: true,
                opacity: 0.35,
                side: THREE.DoubleSide,
                depthWrite: false
            })
        );
        halo.rotation.x = -Math.PI / 2;
        halo.position.y = -0.7;
        group.add(halo);
        super(group);
        this.kind = 'pickup';
        this.radius = 2.4;
        this.meshes = meshes;
        this.halo = halo;
        this.type = 'coin';
    }

    spawn(x, z, type) {
        this.type = type;
        for (const key of PICKUP_KINDS) this.meshes[key].visible = key === type;
        this.halo.material.color.set(
            type === 'heart' ? 0xff8fa3 : type === 'shield' ? 0x8fd0ff : type === 'fury' ? 0xffa15c : 0xffe1a3
        );
        this.group.position.set(x, 1.2, z);
        this.activate();
    }

    update(dt, ctx) {
        const pos = this.group.position;
        pos.y = waterHeight(pos.x, pos.z, ctx.time) + 1.35 + Math.sin(ctx.time * 2.2 + pos.x) * 0.22;
        this.group.rotation.y += dt * 1.6;
        this.halo.scale.setScalar(1 + Math.sin(ctx.time * 3 + pos.z) * 0.12);
        if (pos.z - ctx.player.z > 30) this.deactivate();
    }
}

/* ================================================================== */
/* Projéteis                                                           */
/* ================================================================== */

class Arrow extends Entity {
    constructor() {
        super(buildArrowMesh());
        this.kind = 'arrow';
        this.radius = 1.1;
        this.velocity = new THREE.Vector3();
        this.life = 0;
    }

    spawn(x, y, z, target, speed = 34) {
        this.group.position.set(x, y, z);
        const dir = target.clone().sub(this.group.position).normalize();
        this.velocity.copy(dir).multiplyScalar(speed);
        this.velocity.y += 2.4;
        this.life = 5;
        this.activate();
    }

    update(dt, ctx) {
        this.velocity.y -= 9.5 * dt;
        this.group.position.addScaledVector(this.velocity, dt);
        this.group.lookAt(
            this.group.position.x + this.velocity.x,
            this.group.position.y + this.velocity.y,
            this.group.position.z + this.velocity.z
        );

        const flame = this.group.userData.flame;
        if (flame) {
            const s = 0.9 + Math.sin(ctx.time * 24) * 0.2;
            flame.scale.set(s, s, s * 1.8);
        }
        if (Math.random() < 0.05) {
            ctx.effects.fire(this.group.position.x, this.group.position.y, this.group.position.z, 1, 0.45);
        }

        this.life -= dt;
        const pos = this.group.position;
        if (pos.y < waterHeight(pos.x, pos.z, ctx.time)) {
            ctx.effects.splash(pos.x, 0.1, pos.z, 8, 0.7);
            ctx.audio.sfx('splash', 0.4);
            this.deactivate();
            return;
        }
        if (this.life <= 0 || pos.z - ctx.player.z > 30) this.deactivate();
    }
}

class Cannonball extends Entity {
    constructor() {
        super(buildCannonballMesh(1));
        this.kind = 'shot';
        this.radius = CANNON.ballRadius;
        this.velocity = new THREE.Vector3();
        this.life = 0;
    }

    spawn(x, y, z, dirX, dirZ, speed = CANNON.speed, loft = CANNON.loft) {
        this.group.position.set(x, y, z);
        this.velocity.set(dirX * speed, loft, dirZ * speed);
        this.life = CANNON.life;
        this.activate();
    }

    update(dt, ctx) {
        this.velocity.y -= CANNON.gravity * dt;
        this.group.position.addScaledVector(this.velocity, dt);
        this.life -= dt;

        const pos = this.group.position;
        if (pos.y < waterHeight(pos.x, pos.z, ctx.time) - 0.15) {
            ctx.effects.splash(pos.x, 0.15, pos.z, 18, 1.25);
            ctx.effects.smokePuff(pos.x, 0.4, pos.z, 4, 0.7);
            ctx.audio.sfx('splash', 0.7);
            this.deactivate();
            return;
        }
        if (this.life <= 0) this.deactivate();
    }
}

/* ================================================================== */
/* Gerenciador                                                         */
/* ================================================================== */

const POOL_SIZES = {
    enemyShips: 6,
    towers: 5,
    barricades: 5,
    rocks: 12,
    whirlpools: 3,
    pickups: 16,
    arrows: 46,
    shots: 24
};

export class Entities {
    constructor(scene, quality) {
        this.scene = scene;
        this.quality = quality;
        this.pools = {};

        const make = (key, factory, count) => {
            const list = [];
            for (let i = 0; i < count; i++) {
                const item = factory(i);
                scene.add(item.group);
                list.push(item);
            }
            this.pools[key] = list;
        };

        make('enemyShips', () => new EnemyShip(), POOL_SIZES.enemyShips);
        make('towers', () => new Tower(quality.pointLights), POOL_SIZES.towers);
        make('barricades', () => new Barricade(), POOL_SIZES.barricades);
        make('rocks', (i) => new RockObstacle(i), POOL_SIZES.rocks);
        make('whirlpools', () => new Whirlpool(), POOL_SIZES.whirlpools);
        make('pickups', () => new PickupItem(), POOL_SIZES.pickups);
        make('arrows', () => new Arrow(), POOL_SIZES.arrows);
        make('shots', () => new Cannonball(), POOL_SIZES.shots);

        this.targets = ['enemyShips', 'towers', 'barricades', 'rocks', 'whirlpools'];
    }

    _free(key) {
        return this.pools[key].find((e) => !e.active) || null;
    }

    spawnEnemyShip(x, z, opts) {
        const e = this._free('enemyShips');
        e?.spawn(x, z, opts);
        return e;
    }

    spawnTower(x, z, opts) {
        const e = this._free('towers');
        e?.spawn(x, z, opts);
        return e;
    }

    spawnBarricade(x, z) {
        const e = this._free('barricades');
        e?.spawn(x, z);
        return e;
    }

    spawnRock(x, z, scale) {
        const e = this._free('rocks');
        e?.spawn(x, z, scale);
        return e;
    }

    spawnWhirlpool(x, z) {
        const e = this._free('whirlpools');
        e?.spawn(x, z);
        return e;
    }

    spawnPickup(x, z, type) {
        const e = this._free('pickups');
        e?.spawn(x, z, type);
        return e;
    }

    spawnArrow(x, y, z, target, speed) {
        const e = this._free('arrows');
        e?.spawn(x, y, z, target, speed);
        return e;
    }

    fireShot(x, y, z, dirX, dirZ, speed, loft) {
        const e = this._free('shots');
        e?.spawn(x, y, z, dirX, dirZ, speed, loft);
        return e;
    }

    /** @deprecated use fireShot */
    throwAxe(x, y, z, dirX, dirZ, speed, loft) {
        return this.fireShot(x, y, z, dirX, dirZ, speed, loft);
    }

    /**
     * Alvo automático para canhão: prioriza torre, depois barco, no hemisfério à frente.
     * Cone largo — o jogador só precisa apontar o navio grosso modo.
     */
    findCannonTarget(originX, originY, originZ, forwardX, forwardZ, range = CANNON.assistRange) {
        let best = null;
        let bestScore = Infinity;
        const keys = ['towers', 'enemyShips', 'barricades'];
        const range2 = range * range;
        const fLen = Math.hypot(forwardX, forwardZ) || 1;
        const fx = forwardX / fLen;
        const fz = forwardZ / fLen;

        for (const key of keys) {
            for (const target of this.pools[key]) {
                if (!target.active || target.indestructible || target.sinking > 0 || target.crumble > 0) continue;
                const dx = target.position.x - originX;
                const dz = target.position.z - originZ;
                const dist2 = dx * dx + dz * dz;
                if (dist2 < 9 || dist2 > range2) continue;
                const dist = Math.sqrt(dist2);
                const ndx = dx / dist;
                const ndz = dz / dist;
                const dot = ndx * fx + ndz * fz;
                if (dot < CANNON.assistCone) continue;

                const kindBias = key === 'towers' ? 0.55 : key === 'enemyShips' ? 0.7 : 1;
                const score = (dist / range) * kindBias + (1 - dot) * 0.85;
                if (score < bestScore) {
                    bestScore = score;
                    const aimY = key === 'towers' ? target.position.y + 7 : target.position.y + 1.8;
                    // Antecipação simples para barcos em movimento.
                    let leadX = target.position.x;
                    let leadZ = target.position.z;
                    if (key === 'enemyShips' && target.speed) {
                        const tFlight = dist / CANNON.speed;
                        leadZ -= target.speed * tFlight;
                    }
                    best = {
                        kind: key,
                        x: leadX,
                        y: aimY,
                        z: leadZ,
                        dist,
                        entity: target
                    };
                }
            }
        }
        return best;
    }

    findThrowTarget(originX, originY, originZ, forwardX, forwardZ, range) {
        return this.findCannonTarget(originX, originY, originZ, forwardX, forwardZ, range);
    }

    /** Atualiza todas as entidades ativas. */
    update(dt, ctx) {
        for (const key of Object.keys(this.pools)) {
            for (const entity of this.pools[key]) {
                if (entity.active) entity.update(dt, ctx);
            }
        }
    }

    /** Colisão das balas de canhão com alvos destrutíveis. */
    resolveAxeHits(ctx) {
        for (const shot of this.pools.shots) {
            if (!shot.active) continue;
            const ap = shot.group.position;

            for (const key of this.targets) {
                for (const target of this.pools[key]) {
                    if (!target.active || target.indestructible || target.sinking > 0 || target.crumble > 0) continue;
                    const dx = target.position.x - ap.x;
                    const dz = target.position.z - ap.z;
                    const r = target.radius + shot.radius;
                    if (dx * dx + dz * dz > r * r) continue;

                    if (key === 'towers') {
                        const baseY = target.position.y;
                        if (ap.y < baseY - 1.5 || ap.y > baseY + 14) continue;
                    } else {
                        const dy = target.position.y - ap.y;
                        if (Math.abs(dy) > 5.5) continue;
                    }

                    const killed = target.hit(CANNON.damage, ctx);
                    ctx.effects.explosion(ap.x, ap.y, ap.z, 0.55, 0.35);
                    ctx.audio.sfx('explosion', 0.35);
                    shot.deactivate();
                    if (killed) {
                        const points =
                            key === 'enemyShips' ? SCORE.enemyShip : key === 'towers' ? SCORE.tower : SCORE.barricade;
                        ctx.onKill(points, target.position);
                    }
                    break;
                }
            }
        }

        for (const shot of this.pools.shots) {
            if (!shot.active) continue;
            for (const arrow of this.pools.arrows) {
                if (!arrow.active) continue;
                const d = shot.group.position.distanceToSquared(arrow.group.position);
                if (d < 8) {
                    ctx.effects.impact(arrow.group.position.x, arrow.group.position.y, arrow.group.position.z, 0xffc987);
                    ctx.audio.sfx('hitMetal');
                    arrow.deactivate();
                }
            }
        }
    }

    reset() {
        for (const key of Object.keys(this.pools)) {
            for (const entity of this.pools[key]) entity.deactivate();
        }
    }

    countActive(key) {
        return this.pools[key].reduce((n, e) => n + (e.active ? 1 : 0), 0);
    }
}

export { EnemyShip, Tower, Barricade, RockObstacle, Whirlpool, PickupItem, Arrow, Cannonball };
