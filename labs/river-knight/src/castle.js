/**
 * O castelo de Morvain, a princesa na torre e a barcaça negra que bloqueia
 * o portão — todo o desfecho da jornada.
 */

import * as THREE from 'three';
import {
    buildLongship,
    buildBanner,
    stoneMaterial,
    metalMaterial,
    plainMaterial,
    woodMaterial
} from './models.js';
import { centerX, halfWidth, terrainHeight } from './river.js';
import { waterHeight, waterSlope } from './water.js';
import { COLORS, CASTLE_Z, SCORE } from './config.js';
import { clamp, damp, randRange } from './utils.js';

const tmpSlope = { dx: 0, dz: 0 };

/* ================================================================== */
/* Castelo                                                             */
/* ================================================================== */

function buildTower(radius, height, { roof = true, tint = '#8a877f' } = {}) {
    const group = new THREE.Group();
    const stone = stoneMaterial(tint);

    const body = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.12, height, 14), stone);
    body.position.y = height / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const ledge = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.2, radius * 1.1, 0.9, 14), stone);
    ledge.position.y = height + 0.3;
    ledge.castShadow = true;
    group.add(ledge);

    const merlonCount = Math.max(8, Math.round(radius * 5));
    for (let i = 0; i < merlonCount; i++) {
        const a = (i / merlonCount) * Math.PI * 2;
        const merlon = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.42, 1.1, radius * 0.34), stone);
        merlon.position.set(Math.cos(a) * radius * 1.06, height + 1.2, Math.sin(a) * radius * 1.06);
        merlon.rotation.y = -a;
        merlon.castShadow = true;
        group.add(merlon);
    }

    if (roof) {
        const cone = new THREE.Mesh(
            new THREE.ConeGeometry(radius * 1.3, radius * 2.1, 14),
            plainMaterial(COLORS.roof, 0.75, 0.05)
        );
        cone.position.y = height + radius * 1.05 + 1.6;
        cone.castShadow = true;
        group.add(cone);

        const finial = new THREE.Mesh(
            new THREE.SphereGeometry(radius * 0.16, 8, 8),
            metalMaterial(0xd9b45c, 0.35)
        );
        finial.position.y = height + radius * 2.1 + 1.8;
        group.add(finial);

        const banner = buildBanner('#5a1220', '#f3c96b', radius * 0.9, radius * 1.6);
        banner.position.set(radius * 0.5, height + radius * 1.9, 0);
        group.add(banner);
    }

    return group;
}

function buildTorch(color = 0xff9a3c, intensity = 9) {
    const group = new THREE.Group();
    const bracket = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.7, 6), metalMaterial(0x4a4139, 0.6));
    group.add(bracket);
    const flame = new THREE.Mesh(
        new THREE.SphereGeometry(0.26, 8, 8),
        plainMaterial(0xffc477, 0.4, 0, 0xff7a20, 3.2)
    );
    flame.position.y = 0.45;
    flame.scale.y = 1.5;
    group.add(flame);
    const light = new THREE.PointLight(color, intensity, 26, 2);
    light.position.y = 0.6;
    group.add(light);
    group.userData.flame = flame;
    group.userData.light = light;
    return group;
}

/** A princesa acenando na janela da torre. */
function buildPrincess() {
    const group = new THREE.Group();

    const dress = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.1, 12), plainMaterial(COLORS.princess, 0.7, 0.03));
    dress.position.y = 0.55;
    group.add(dress);

    const bodice = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.24, 0.42, 10), plainMaterial(0xb85a8a, 0.7, 0.03));
    bodice.position.y = 1.18;
    group.add(bodice);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), plainMaterial(0xf0c9a4, 0.75, 0));
    head.position.y = 1.55;
    group.add(head);

    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.7),
        plainMaterial(0x6b3b1c, 0.8, 0));
    hair.position.y = 1.58;
    group.add(hair);

    const braid = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.8, 6), plainMaterial(0x6b3b1c, 0.8, 0));
    braid.position.set(0, 1.25, -0.18);
    group.add(braid);

    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.09, 10), metalMaterial(0xf0cf7a, 0.3));
    crown.position.y = 1.7;
    group.add(crown);

    const arm = new THREE.Group();
    arm.position.set(0.22, 1.36, 0);
    const armMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.5, 8), plainMaterial(0xf0c9a4, 0.75, 0));
    armMesh.position.y = -0.22;
    arm.add(armMesh);
    group.add(arm);

    const scarf = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.22), new THREE.MeshStandardMaterial({
        color: 0xffe9f2,
        side: THREE.DoubleSide,
        roughness: 0.9
    }));
    scarf.position.set(0.3, -0.42, 0);
    arm.add(scarf);

    group.traverse((c) => {
        c.castShadow = true;
    });

    group.userData.arm = arm;
    group.userData.scarf = scarf;
    return group;
}

/**
 * Monta o castelo sobre o rio: duas alas nas margens, muralha com portão
 * levadiço sobre a água e a torre da princesa.
 */
export function createCastle(scene) {
    const group = new THREE.Group();
    const z = CASTLE_Z;
    const cx = centerX(z);
    const hw = halfWidth(z);
    const stone = stoneMaterial('#8a877f');

    group.position.set(cx, 0, z);
    scene.add(group);

    // ---- Muralha atravessando o rio ----
    // A muralha é feita de dois blocos laterais e um arco: o vão central é o
    // portão de água por onde o drakkar passa.
    const wallWidth = hw * 2 + 44;
    const gateWidth = hw * 1.5;
    const gapLeft = new THREE.Mesh(new THREE.BoxGeometry((wallWidth - gateWidth) / 2, 22, 7.2), stone);
    gapLeft.position.set(-(gateWidth + (wallWidth - gateWidth) / 2) / 2, 11, 0);
    gapLeft.castShadow = true;
    group.add(gapLeft);
    const gapRight = gapLeft.clone();
    gapRight.position.x *= -1;
    group.add(gapRight);

    const arch = new THREE.Mesh(new THREE.BoxGeometry(gateWidth + 3, 6, 7.4), stone);
    arch.position.set(0, 19, 0);
    arch.castShadow = true;
    group.add(arch);

    // Aduelas: dão a curva do arco sobre o vão do portão.
    const voussoirs = 13;
    for (let i = 0; i < voussoirs; i++) {
        const a = Math.PI * (i / (voussoirs - 1));
        const block = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.6, 7.6), stone);
        block.position.set(Math.cos(a) * gateWidth * 0.5, 15.4 + Math.sin(a) * 3.6, 0);
        block.rotation.z = a - Math.PI / 2;
        block.castShadow = true;
        group.add(block);
    }

    // Ameias no topo da muralha.
    const merlons = Math.round(wallWidth / 3.2);
    for (let i = 0; i < merlons; i++) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.8, 6.6), stone);
        m.position.set(-wallWidth / 2 + 1.6 + i * 3.2, 23, 0);
        m.castShadow = true;
        group.add(m);
    }

    // ---- Portão / grade levadiça ----
    const gate = new THREE.Group();
    const gateMat = woodMaterial(true, 0x4a3016);
    for (let i = 0; i < 9; i++) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.42, 16, 0.42), gateMat);
        bar.position.set(-gateWidth / 2 + 1 + i * (gateWidth - 2) / 8, 8, 0);
        bar.castShadow = true;
        gate.add(bar);
    }
    for (let i = 0; i < 4; i++) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(gateWidth - 1, 0.5, 0.5), metalMaterial(0x50483d, 0.55));
        rail.position.set(0, 1.6 + i * 4.6, 0);
        gate.add(rail);
    }
    for (let i = 0; i < 9; i++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.7, 6), metalMaterial(0x8b8579, 0.4));
        spike.position.set(-gateWidth / 2 + 1 + i * (gateWidth - 2) / 8, 0, 0);
        spike.rotation.x = Math.PI;
        gate.add(spike);
    }
    group.add(gate);

    // ---- Torres ----
    const towers = [];
    const towerSpots = [
        { x: -gateWidth / 2 - 7, r: 4.4, h: 26, roof: true },
        { x: gateWidth / 2 + 7, r: 4.4, h: 26, roof: true },
        { x: -wallWidth / 2 + 5, r: 3.4, h: 19, roof: true },
        { x: wallWidth / 2 - 5, r: 3.4, h: 19, roof: true }
    ];
    for (const spot of towerSpots) {
        const tower = buildTower(spot.r, spot.h, { roof: spot.roof });
        tower.position.set(spot.x, 0, 0);
        group.add(tower);
        towers.push(tower);
    }

    // A margem interna do castelo: tudo fica ao lado do canal, para que o
    // drakkar consiga atravessar o portão e chegar às docas.
    const sideOffset = gateWidth / 2 + 13;

    // ---- Torre da princesa (mais alta, atrás da muralha) ----
    const keepX = sideOffset;
    const keepZ = -34;
    const keepRadius = 6.2;
    const keep = buildTower(keepRadius, 40, { tint: '#948f85' });
    keep.position.set(keepX, 0, keepZ);
    group.add(keep);

    // Sacada voltada para o rio, onde a princesa aparece.
    const balconyZ = keepZ + keepRadius + 1.1;
    const balcony = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.7, 3.4), stone);
    balcony.position.set(keepX, 32.9, balconyZ);
    balcony.castShadow = true;
    group.add(balcony);

    for (let i = -2; i <= 2; i++) {
        const baluster = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.5, 0.5), stone);
        baluster.position.set(keepX + i * 1.5, 34, balconyZ + 1.4);
        group.add(baluster);
    }

    const window_ = new THREE.Mesh(
        new THREE.BoxGeometry(2.6, 3.8, 0.4),
        plainMaterial(0xffdca8, 0.5, 0, 0xffb45c, 1.8)
    );
    window_.position.set(keepX, 35.6, keepZ + keepRadius - 0.2);
    group.add(window_);

    const windowLight = new THREE.PointLight(0xffb45c, 30, 52, 2);
    windowLight.position.set(keepX, 35.6, keepZ + keepRadius + 0.8);
    group.add(windowLight);

    // Luz quente só para a princesa: sem ela a torre vira silhueta no crepúsculo.
    const princessLight = new THREE.PointLight(0xffd9a8, 22, 32, 2);
    princessLight.position.set(keepX, 36.5, balconyZ + 3.5);
    group.add(princessLight);

    const princess = buildPrincess();
    princess.position.set(keepX, 33.3, balconyZ + 0.2);
    princess.scale.setScalar(1.8);
    group.add(princess);

    // ---- Corpo do castelo (blocos atrás da muralha) ----
    const hallGeo = new THREE.BoxGeometry(26, 16, 18);
    const hall = new THREE.Mesh(hallGeo, stone);
    hall.position.set(-sideOffset - 6, 8, -26);
    hall.castShadow = true;
    hall.receiveShadow = true;
    group.add(hall);

    const roof = new THREE.Mesh(
        new THREE.ConeGeometry(17, 9, 4),
        plainMaterial(COLORS.roof, 0.78, 0.04)
    );
    roof.position.set(-sideOffset - 6, 20.4, -26);
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    group.add(roof);

    // ---- Tochas ----
    const torches = [];
    const torchSpots = [
        [-gateWidth / 2 - 1.4, 12, 3.6],
        [gateWidth / 2 + 1.4, 12, 3.6],
        [-gateWidth / 2 - 7, 27, 0],
        [gateWidth / 2 + 7, 27, 0]
    ];
    for (const [tx, ty, tz] of torchSpots) {
        const torch = buildTorch();
        torch.position.set(tx, ty, tz);
        group.add(torch);
        torches.push(torch);
    }

    // ---- Docas de pedra junto às margens ----
    for (const side of [-1, 1]) {
        const dockX = side * (hw + 6);
        const dock = new THREE.Mesh(new THREE.BoxGeometry(12, 3, 26), stone);
        const groundY = terrainHeight(cx + dockX, z + 16);
        dock.position.set(dockX, Math.max(0.5, groundY * 0.4), 16);
        dock.castShadow = true;
        dock.receiveShadow = true;
        group.add(dock);
    }

    let gateOpen = 0;
    let gateTarget = 0;

    return {
        group,
        princess,
        z,
        centerX: cx,
        gateWidth,
        princessWorld: new THREE.Vector3(cx + keepX, 35.6, z + balconyZ + 0.2),
        openGate() {
            gateTarget = 1;
        },
        get gateProgress() {
            return gateOpen;
        },
        update(dt, time) {
            gateOpen = damp(gateOpen, gateTarget, 1.1, dt);
            gate.position.y = gateOpen * 15.5;

            for (const torch of torches) {
                const flame = torch.userData.flame;
                const light = torch.userData.light;
                const flicker = 0.82 + Math.sin(time * 11 + torch.position.x) * 0.12 + Math.random() * 0.06;
                flame.scale.set(flicker, flicker * 1.5, flicker);
                light.intensity = 9 * flicker;
            }

            windowLight.intensity = 22 + Math.sin(time * 3.1) * 3;

            const arm = princess.userData.arm;
            arm.rotation.z = -0.6 + Math.sin(time * 4.2) * 0.75;
            princess.rotation.y = Math.sin(time * 0.8) * 0.2;
        },
        emitTorchSparks(effects) {
            for (const torch of torches) {
                if (Math.random() < 0.25) {
                    const p = new THREE.Vector3();
                    torch.getWorldPosition(p);
                    effects.fire(p.x, p.y + 0.4, p.z, 1, 0.7);
                }
            }
        }
    };
}

/* ================================================================== */
/* Barcaça Negra (chefe)                                               */
/* ================================================================== */

export class BossBarge {
    constructor(scene) {
        const group = new THREE.Group();
        this.group = group;
        this.scene = scene;

        const { group: hull, parts } = buildLongship({
            length: 30,
            beam: 8.5,
            hullColor: 0x241a16,
            sailBase: '#1a1420',
            sailStripe: '#7a1220',
            emblem: 'rune',
            shields: true,
            oars: true,
            dragon: true,
            lantern: false
        });
        hull.scale.set(1, 1.25, 1);
        group.add(hull);
        this.hullGroup = hull;
        this.parts = parts;

        // Aríete de ferro na proa.
        const ram = new THREE.Mesh(new THREE.ConeGeometry(1.2, 5, 8), metalMaterial(0x4a4740, 0.5));
        ram.rotation.x = -Math.PI / 2;
        ram.position.set(0, -0.4, -17.5);
        ram.castShadow = true;
        group.add(ram);

        // Torres de balista.
        this.ballistae = [];
        for (const side of [-1, 1]) {
            const tower = new THREE.Group();
            const base = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.8, 3.4, 8), woodMaterial(true, 0x2b2018));
            base.position.y = 1.7;
            base.castShadow = true;
            tower.add(base);

            const bow = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.35, 0.35), woodMaterial(true, 0x3b2a1c));
            bow.position.y = 3.6;
            tower.add(bow);

            const brazier = new THREE.Mesh(
                new THREE.SphereGeometry(0.55, 10, 8),
                plainMaterial(0xff9a4a, 0.4, 0, 0xff5a10, 3)
            );
            brazier.position.y = 4.1;
            tower.add(brazier);
            tower.userData.brazier = brazier;

            const light = new THREE.PointLight(0xff6a2a, 14, 30, 2);
            light.position.y = 4.2;
            tower.add(light);
            tower.userData.light = light;

            tower.position.set(side * 3.4, 1.4, side * 3);
            group.add(tower);
            this.ballistae.push(tower);
        }

        // Estandarte do vilão.
        const banner = buildBanner('#12070c', '#c0303c', 2.4, 4.6);
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

        for (const oar of this.parts.oars) {
            oar.rotation.x = Math.sin(ctx.time * 2.1 + oar.userData.phase) * 0.5;
            oar.rotation.z = oar.userData.baseRoll - oar.userData.side * Math.sin(ctx.time * 2.1 + oar.userData.phase + 1.2) * 0.18;
        }

        for (const tower of this.ballistae) {
            const b = tower.userData.brazier;
            const s = 0.85 + Math.sin(ctx.time * 8 + tower.position.x) * 0.18;
            b.scale.set(s, s * 1.3, s);
            tower.userData.light.intensity = 12 * s;
            if (Math.random() < 0.3) {
                const p = new THREE.Vector3();
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
