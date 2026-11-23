/**
 * O drakkar do jogador e o guerreiro a bordo.
 *
 * Guarda a física da navegação (velocidade, deriva lateral, limites do rio),
 * a animação do casco sobre as ondas, os remos, os canhões de bordo e os
 * poderes temporários (escudo e fúria).
 *
 * Navegação por proa + leme (não mais "strafe"): o barco só muda de rumo
 * virando a proa, com inércia, e a velocidade vem das marchas de remo.
 * Fórmulas e constantes documentadas em `config.js` (BOAT).
 *
 * Convenção de ângulos: `heading` (ψ) = 0 aponta rio abaixo (−Z);
 * frente no mundo = (sin ψ, −cos ψ), boreste (direita) = (cos ψ, sin ψ).
 * O grupo raiz usa ordem 'YXZ' (rumo → arfagem → adernamento) com rotation.y = −ψ.
 */

import * as THREE from 'three';
import { createHero } from '../../shared/gfx/hero.js';
import { buildLongship } from './ships.js?v=60';
import { fireLights } from './lights.js?v=60';
import { waterHeight, waterSlope } from './water.js?v=60';
import { centerX, centerSlope, halfWidth } from './river.js?v=60';
import { BOAT, CANNON } from './config.js?v=60';
import { clamp, damp } from './utils.js?v=60';

const tmpSlope = { dx: 0, dz: 0 };
const tmpMuzzle = new THREE.Vector3();
const tmpMuzzleWorld = new THREE.Vector3();
const ANIM = { rowRate: 3, speedRatio: 0, steer: 0, wind: 1 };
/** Passo fixo da integração (s): estável mesmo com quadros longos. */
const PHYS_STEP = 1 / 120;
const TAU = Math.PI * 2;

/** Diferença angular normalizada em (−π, π]. */
function angleDiff(a, b) {
    let d = (a - b) % TAU;
    if (d > Math.PI) d -= TAU;
    if (d < -Math.PI) d += TAU;
    return d;
}

/** Rumo do rio (ψ) na posição z: tan ψ = dx/d(−z) = −centerX'(z). */
export function riverHeading(z) {
    return Math.atan(-centerSlope(z));
}

export class Player {
    constructor(scene, quality = null) {
        this.root = new THREE.Group();
        this.root.rotation.order = 'YXZ';
        scene.add(this.root);
        const low = quality?.id === 'low';

        // O modelo é construído com a proa em +Z; o grupo interno gira 180°
        // para que o "para frente" do jogador seja -Z no mundo.
        const { group: ship, parts } = buildLongship({
            length: 15,
            beam: 3.6,
            sailBase: '#ded1b0',
            sailStripe: '#a02f2f',
            emblem: 'cross',
            cannons: true,
            cargo: !low,
            tier: quality?.id || 'high',
            crew: { presets: ['peasant', 'dwarf', 'peasant', 'elder'], rowers: low ? 2 : 6, detail: low ? 0 : 1 }
        });
        ship.rotation.y = Math.PI;
        this.root.add(ship);
        this.ship = ship;
        this.parts = parts;

        // Cavaleiro ao leme (popa): herói de alta fidelidade com espada e escudo.
        this.knight = createHero({ preset: 'knight', detail: low ? 1 : 2 });
        const helm = parts.helm || { x: 0, y: parts.deckY, z: -5.2 };
        this.knight.object.position.set(0, parts.poopY ?? helm.y, helm.z + 0.5);
        ship.add(this.knight.object);
        this.knight.equip?.({ handR: 'sword', handL: 'shield' });
        this.knightState = { mode: 'idle', speed: 0, upper: null, upperPhase: 0 };
        this.orderT = 1;

        // Bolha de escudo (casca translúcida com brilho de borda).
        this.shieldBubble = new THREE.Mesh(
            new THREE.SphereGeometry(8.2, 40, 24),
            new THREE.MeshBasicMaterial({
                color: 0x7ec8ff,
                transparent: true,
                opacity: 0.16,
                depthWrite: false,
                side: THREE.DoubleSide
            })
        );
        this.shieldBubble.scale.set(0.55, 0.6, 1);
        this.shieldBubble.visible = false;
        this.root.add(this.shieldBubble);

        this.reset();
    }

    reset(difficulty) {
        this.maxHull = difficulty?.hull ?? BOAT.maxHull;
        this.helmAssist = difficulty?.helmAssist ?? 0.45;
        this.hull = this.maxHull;
        this.x = centerX(0);
        this.z = 0;
        // Estado físico (ver config.js): u avanço e v deriva sobre a água (m/s),
        // heading ψ (rad), r taxa de guinada (rad/s), δ ângulo do leme (rad).
        this.gear = BOAT.startGear;
        this.u = 6.8;
        this.v = 0;
        this.heading = riverHeading(0);
        this.r = 0;
        this.rudder = 0;
        this.stamina = 1;
        this.vx = 0;
        this.vz = 0;
        this.accel = 0;
        this.heave = 0;
        this.heaveVel = 0;
        this.rollVel = 0;
        this.pitch = 0;
        this.pitchVel = 0;
        this.bankContact = 0;
        this.exhausted = false;
        /** Velocidade sobre o fundo no sentido do castelo (m/s) — HUD, placar e IA. */
        this.speed = BOAT.baseSpeed;
        this.lateral = 0;
        this.yaw = this.heading;
        this.roll = 0;
        this.throwTimer = 0;
        this.invuln = 0;
        this.shieldTime = 0;
        this.furyTime = 0;
        this.throwAnim = 0;
        this.alive = true;
        this.distance = 0;
        this.docking = false;
        this.dockZ = 0;
        this._acc = 0;

        this.root.position.set(this.x, 0, 0);
        this.root.rotation.set(0, -this.heading, 0);
        this.shieldBubble.visible = false;
        this.ship.visible = true;
        this.orderT = 1;
    }

    /** Sobe/desce uma marcha do telégrafo. Devolve a marcha efetiva (ou null se recusou). */
    shiftGear(delta) {
        if (!delta || this.docking) return null;
        const max = BOAT.gears.length - 1;
        let next = clamp(this.gear + delta, 0, max);
        if (next === max && this.stamina < BOAT.staminaMinRam) next = max - 1;
        if (next === this.gear) return delta > 0 && this.gear === max - 1 && this.stamina < BOAT.staminaMinRam ? null : this.gear;
        this.gear = next;
        if (next !== max) this.exhausted = false;
        return next;
    }

    /** Empurrão de colisão: (nx, nz) aponta para longe do obstáculo, `j` em m/s. */
    bump(nx, nz, j, surgeLoss = 0.45) {
        // projeta o impulso no referencial do casco
        const fx = Math.sin(this.heading);
        const fz = -Math.cos(this.heading);
        this.u = this.u * (1 - surgeLoss) + (nx * fx + nz * fz) * j;
        this.v += nx * Math.cos(this.heading) + nz * Math.sin(this.heading) > 0 ? j : -j;
        this.r += (Math.random() - 0.5) * 0.4;
    }

    get position() {
        return this.root.position;
    }

    get hasShield() {
        return this.shieldTime > 0;
    }

    get hasFury() {
        return this.furyTime > 0;
    }

    /* ------------------------------------------------------------------ */

    update(dt, ctx) {
        const { input, time, effects } = ctx;

        // --- física da navegação em passo fixo ---
        const steer = this.docking ? this._dockSteer() : input.steer;
        this._acc = Math.min(this._acc + dt, 0.25);
        let steps = 0;
        while (this._acc >= PHYS_STEP && steps < 30) {
            this._step(PHYS_STEP, steer, ctx);
            this._acc -= PHYS_STEP;
            steps++;
        }
        this.distance = -this.z;
        if (this.bankContact) {
            if (Math.random() < 0.35) effects.splash(this.x + this.bankContact * 2, 0.2, this.z, 3, 0.6);
            ctx.onScrape?.();
        }

        // --- assentamento sobre as ondas: arfagem, cabeceio e adernamento ---
        const wy = waterHeight(this.x, this.z, time);
        waterSlope(this.x, this.z, time, tmpSlope);
        const fx = Math.sin(this.heading);
        const fz = -Math.cos(this.heading);
        const slopeFwd = tmpSlope.dx * fx + tmpSlope.dz * fz;
        const slopeRight = tmpSlope.dx * Math.cos(this.heading) + tmpSlope.dz * Math.sin(this.heading);

        // Molas amortecidas (ω, ζ): o casco não "cola" na onda, ele responde a ela.
        const w = BOAT.rollOmega;
        const z2 = 2 * BOAT.rollZeta * w;
        const heelTarget = clamp(BOAT.heelGain * this.u * this.r, -0.12, 0.12);
        const rollTarget = clamp(heelTarget + Math.atan(slopeRight) * 0.7 + (this.bankContact ? Math.sin(time * 31) * 0.01 : 0), -0.22, 0.22);
        this.rollVel += (w * w * (rollTarget - this.roll) - z2 * this.rollVel) * dt;
        this.roll += this.rollVel * dt;
        const pitchTarget = clamp(Math.atan(slopeFwd) * 0.75 + this.accel * 0.012, -0.12, 0.12);
        this.pitchVel += (w * w * 1.4 * (pitchTarget - this.pitch) - z2 * 1.2 * this.pitchVel) * dt;
        this.pitch += this.pitchVel * dt;
        const hw2 = w * 1.4;
        this.heaveVel += (hw2 * hw2 * (wy - this.heave) - 2 * 0.35 * hw2 * this.heaveVel) * dt;
        this.heave += this.heaveVel * dt;
        if (!Number.isFinite(this.heave)) this.heave = wy;

        this.root.position.set(this.x, this.heave + 0.95, this.z);
        this.root.rotation.set(this.pitch, -this.heading, this.roll);
        this.yaw = this.heading;

        const speedRatio = clamp(this.u / 12, 0, 1);

        // --- remos, remadores, vela, recuo dos canhões (ships.js) ---
        // cadência da remada cresce com a velocidade: 2,2 rad/s parado → 5,4 rad/s no impulso
        ANIM.rowRate = 2.2 + speedRatio * 3.2;
        ANIM.speedRatio = speedRatio;
        ANIM.steer = steer;
        this.parts.animate(dt, time, ANIM);
        if (this.parts.rudder) this.parts.rudder.rotation.y = this.rudder;
        this._animateKnight(dt);
        if (this.parts.lanternFlame) {
            this.parts.lanternFlame.getWorldPosition(tmpMuzzle);
            fireLights.request(tmpMuzzle.x, tmpMuzzle.y, tmpMuzzle.z, 0xffa54a, 26 + Math.sin(time * 9) * 4, 9);
        }

        // --- espuma da proa e esteira (fora do casco, nunca sobre o convés) ---
        // A esteira nasce na popa real (segue o rumo) e cresce com a velocidade sobre a água.
        const rx = Math.cos(this.heading);
        const rz = Math.sin(this.heading);
        const sternX = this.x - fx * 8.6;
        const sternZ = this.z - fz * 8.6;
        const wakeW = 1.2 + speedRatio * 1.5;
        const wakeA = 0.35 + speedRatio * 0.75;
        effects.wake.push(sternX - rx * 1.15, sternZ - rz * 1.15, wakeW, wakeA);
        effects.wake.push(sternX + rx * 1.15, sternZ + rz * 1.15, wakeW, wakeA);

        if (Math.random() < speedRatio * 0.55) {
            effects.splash(this.x + fx * 7.4, wy + 0.05, this.z + fz * 7.4, 2, 0.16 + speedRatio * 0.3);
        }
        if (Math.random() < 0.06 + speedRatio * 0.16) {
            const side = Math.random() < 0.5 ? -1 : 1;
            effects.splash(this.x + rx * side * 2.2, wy + 0.02, this.z + rz * side * 2.2, 1, 0.12 + speedRatio * 0.16);
        }

        // --- temporizadores ---
        this.throwTimer = Math.max(0, this.throwTimer - dt);
        this.invuln = Math.max(0, this.invuln - dt);
        this.shieldTime = Math.max(0, this.shieldTime - dt);
        this.furyTime = Math.max(0, this.furyTime - dt);

        // Piscar durante a invulnerabilidade: alterna a visibilidade a ~11 Hz
        // (mais barato e robusto com SkinnedMesh do que clonar materiais para alfa).
        this.ship.visible = !(this.invuln > 0 && !this.hasShield && Math.sin(time * 70) < -0.25);

        this.shieldBubble.visible = this.hasShield;
        if (this.hasShield) {
            const pulse = 0.14 + Math.sin(time * 5) * 0.05 + (this.shieldTime < 1.6 ? Math.sin(time * 22) * 0.08 : 0);
            this.shieldBubble.material.opacity = Math.max(0.04, pulse);
            this.shieldBubble.scale.setScalar(1 + Math.sin(time * 3) * 0.03);
        }

        if (this.hasFury) {
            const glow = 0.6 + Math.sin(time * 12) * 0.4;
            this.parts.setEmissive(glow * 0.16, glow * 0.05, 0);
            this._furyOn = true;
            if (Math.random() < 0.4) {
                effects.fire(this.x, wy + 1.6, this.z + 1.2, 1, 0.7);
            }
        } else if (this._furyOn) {
            this.parts.setEmissive(0, 0, 0);
            this._furyOn = false;
        }
    }

    /**
     * Um passo de integração (Euler semi-implícito, h = 1/120 s).
     * Ordem: telégrafo/fôlego → avanço → leme/guinada → deriva → correnteza → margens.
     */
    _step(h, steer, ctx) {
        const maxGear = BOAT.gears.length - 1;
        const psiR = riverHeading(this.z);

        // --- avanço (surge) ---
        let du;
        if (this.docking) {
            // Atracação: o timoneiro reduz até parar diante da doca.
            const want = clamp((this.z - this.dockZ) * 0.3, 0, 5.5);
            du = (want - this.u) * 0.9;
        } else {
            const g = BOAT.gears[this.gear];
            if (this.gear === maxGear) {
                this.stamina -= BOAT.staminaDrain * h;
                if (this.stamina <= 0) {
                    this.stamina = 0;
                    this.gear = maxGear - 1;
                    this.exhausted = true;
                }
            } else {
                this.stamina = Math.min(1, this.stamina + BOAT.staminaRegen[this.gear] * h);
            }
            const u = this.u;
            du = g.thrust * (ctx.speedScale ?? 1)
                - (g.brake || 0) * u
                - BOAT.dragLinear * u
                - BOAT.dragQuadratic * u * Math.abs(u);
            // Redemoinho rouba seguimento (arrasto extra proporcional à velocidade).
            if (ctx.pull) du -= ctx.pull.drag * 0.5 * u;
        }
        this.accel = du;
        this.u += du * h;

        // --- leme: cana com velocidade limitada; volta ao centro mais rápido ---
        const cmd = clamp(steer, -1, 1) * BOAT.rudderMax;
        const opening = Math.abs(cmd) > Math.abs(this.rudder) && cmd * this.rudder >= 0;
        const rate = (opening ? BOAT.rudderRate : BOAT.rudderReturn) * h;
        this.rudder += clamp(cmd - this.rudder, -rate, rate);

        // --- guinada (Nomoto 1ª ordem) + correnteza alinhando a proa ---
        const off = angleDiff(psiR, this.heading);
        const uEff = Math.max(Math.abs(this.u), BOAT.uSteerMin);
        let rTarget = BOAT.yawGain * uEff * this.rudder;
        const idle = Math.abs(steer) < 0.05;
        rTarget += off * (0.1 + this.helmAssist * 0.55) * (idle ? 1 : 0.3);
        const edge = Math.abs(off) - BOAT.maxDrift * 0.7;
        if (edge > 0) rTarget += Math.sign(off) * edge * 2.5;
        rTarget = clamp(rTarget, -BOAT.maxYawRate, BOAT.maxYawRate);
        this.r += (rTarget - this.r) * Math.min(1, h / BOAT.yawTime);
        this.heading += this.r * h;
        const drift = angleDiff(this.heading, psiR);
        if (Math.abs(drift) > BOAT.maxDrift) {
            this.heading = psiR + Math.sign(drift) * BOAT.maxDrift;
            this.r *= 0.5;
        }

        // --- deriva lateral: a quilha amortece, a curva escorrega para fora ---
        const vTarget = -BOAT.slip * this.u * this.r;
        this.v += (vTarget - this.v) * Math.min(1, BOAT.swayDamping * h);

        // --- velocidade sobre o fundo = casco sobre a água + correnteza (+ redemoinho) ---
        const fx = Math.sin(this.heading);
        const fz = -Math.cos(this.heading);
        const rx = Math.cos(this.heading);
        const rz = Math.sin(this.heading);
        const cx = centerX(this.z);
        const hw = halfWidth(this.z);
        const offN = clamp((this.x - cx) / hw, -1, 1);
        let cur = BOAT.current * (1 - (1 - BOAT.currentAtBank) * offN * offN);
        if (this.docking) cur *= clamp((this.z - this.dockZ) / 24, 0, 1);
        let vx = this.u * fx + this.v * rx + cur * Math.sin(psiR);
        const vz = this.u * fz + this.v * rz - cur * Math.cos(psiR);
        if (ctx.pull) vx += ctx.pull.x;

        // --- margens: o casco ocupa mais largura quando atravessado no rio ---
        const nz = this.z + vz * h;
        let nx = this.x + vx * h;
        const alpha = angleDiff(this.heading, psiR);
        const extent = BOAT.halfLength * Math.abs(Math.sin(alpha)) + BOAT.halfBeam * Math.cos(alpha) + BOAT.bankMargin;
        const ncx = centerX(nz);
        const limit = Math.max(2, halfWidth(nz) - extent);
        const offset = nx - ncx;
        this.bankContact = 0;
        if (Math.abs(offset) > limit) {
            const side = Math.sign(offset);
            nx = ncx + side * limit;
            if (vx * side > 0) vx *= -0.15;
            this.u *= 1 - 0.9 * h;
            this.v *= 0.5;
            // A margem empurra a proa de volta para o rio.
            if (alpha * side > 0) this.r -= side * 0.6 * h;
            this.bankContact = side;
        }

        if (!Number.isFinite(nx) || !Number.isFinite(nz) || !Number.isFinite(this.heading)) {
            // Rede de segurança: nunca deixar o barco "sumir" por um NaN.
            nx = centerX(this.z);
            this.heading = psiR;
            this.u = 6;
            this.v = this.r = 0;
            vx = 0;
        }
        this.x = nx;
        this.z = Number.isFinite(nz) ? nz : this.z;
        this.vx = vx;
        this.vz = vz;
        this.speed = -vz;
        this.lateral = vx;
    }

    /** Piloto automático da atracação: aponta a proa para o centro do vão do portão. */
    _dockSteer() {
        const ahead = 30;
        const tx = centerX(this.z - ahead);
        const want = Math.atan2(tx - this.x, ahead);
        return clamp(angleDiff(want, this.heading) * 3 - this.r * 0.8, -1, 1);
    }

    /** Cavaleiro: parado ao leme, golpe de espada ao ordenar fogo, comemora ao atracar. */
    _animateKnight(dt) {
        const st = this.knightState;
        st.mode = this.docking ? 'cheer' : 'idle';
        this.orderT = Math.min(1, this.orderT + dt / 0.55);
        st.upper = this.orderT < 1 ? 'attack' : null;
        st.upperPhase = this.orderT;
        this.knight.update(dt, st);
    }

    /** Menu: tripulação remando devagar, sem física de navegação. */
    updateMenu(dt, time) {
        ANIM.rowRate = 1.9;
        ANIM.speedRatio = 0.3;
        ANIM.steer = 0;
        this.parts.animate(dt, time, ANIM);
        this._animateKnight(dt);
    }

    /* ------------------------------------------------------------------ */

    canThrow() {
        return this.alive && this.throwTimer <= 0;
    }

    /** Frente do navio no plano XZ (mundo). */
    forwardXZ() {
        const f = this._fwd || (this._fwd = { x: 0, z: 0 });
        f.x = Math.sin(this.heading);
        f.z = -Math.cos(this.heading);
        return f;
    }

    /** Alvo atual sob a mira automática (cone largo à frente). Na luta, o chefe tem prioridade. */
    getAimLock(entities, bossLock = null) {
        if (bossLock && bossLock.dist < CANNON.assistRange) return bossLock;
        const fwd = this.forwardXZ();
        return entities.findCannonTarget(
            this.x,
            this.position.y + 1.4,
            this.z,
            fwd.x,
            fwd.z
        );
    }

    /**
     * Dispara canhão com mira automática (estilo jogos de navio).
     * Um botão: trava o melhor alvo no cone e escolhe o canhão certo.
     * Em fúria: salva de bordo no mesmo lado.
     */
    fireCannons(entities, ctx) {
        if (!this.canThrow()) return false;
        this.throwTimer = this.hasFury ? BOAT.furyCooldown : BOAT.throwCooldown;
        this.throwAnim = 1;
        this.orderT = 0;

        const fwd = this.forwardXZ();
        const target = this.getAimLock(entities, ctx?.bossLock);
        this._lastLock = target;

        let aimX = fwd.x;
        let aimZ = fwd.z;
        let aimY = this.position.y + 2.2;
        if (target) {
            aimX = target.x - this.x;
            aimZ = target.z - this.z;
            aimY = target.y;
        } else {
            // Sem trava: tiro curto à frente (ainda útil contra o que surgir).
            aimX = fwd.x * 0.35 + (ctx?.input?.steer ?? 0) * 0.55;
            aimZ = fwd.z;
            aimY = this.position.y + 3.5;
        }
        const aimLen = Math.hypot(aimX, aimZ) || 1;
        aimX /= aimLen;
        aimZ /= aimLen;

        // Lado no espaço local do modelo (já rotacionado 180° → inverte X mundo).
        const rightX = Math.cos(this.yaw);
        const rightZ = Math.sin(this.yaw);
        const sideDot = aimX * rightX + aimZ * rightZ;
        const preferSide = Math.abs(sideDot) < 0.25 ? 0 : sideDot > 0 ? -1 : 1;

        const guns = this.parts.cannons || [];
        const selected = [];
        if (preferSide === 0) {
            const bow = guns.find((g) => g.userData.aim === 'bow');
            if (bow) selected.push(bow);
        } else {
            for (const gun of guns) {
                if (gun.userData.aim === 'bow') continue;
                if (gun.userData.side === preferSide) selected.push(gun);
            }
            // Ordena pela proximidade Z ao alvo — canhão do meio primeiro.
            if (target && selected.length > 1) {
                selected.sort((a, b) => {
                    a.getWorldPosition(tmpMuzzle);
                    const da = Math.hypot(target.x - tmpMuzzle.x, target.z - tmpMuzzle.z);
                    b.getWorldPosition(tmpMuzzleWorld);
                    const db = Math.hypot(target.x - tmpMuzzleWorld.x, target.z - tmpMuzzleWorld.z);
                    return da - db;
                });
            }
        }
        if (!selected.length) {
            const bow = guns.find((g) => g.userData.aim === 'bow');
            if (bow) selected.push(bow);
            else if (guns[0]) selected.push(guns[0]);
        }
        const toFire = this.hasFury ? selected : selected.slice(0, 1);
        const speed = CANNON.speed * (this.hasFury ? 1.08 : 1);
        let fired = 0;

        for (let i = 0; i < toFire.length; i++) {
            const gun = toFire[i];
            tmpMuzzle.copy(gun.userData.muzzleLocal);
            gun.localToWorld(tmpMuzzle);
            tmpMuzzleWorld.copy(tmpMuzzle);

            let dirX = aimX;
            let dirZ = aimZ;
            if (target) {
                dirX = target.x - tmpMuzzleWorld.x;
                dirZ = target.z - tmpMuzzleWorld.z;
            }
            const dLen = Math.hypot(dirX, dirZ) || 1;
            dirX /= dLen;
            dirZ /= dLen;

            const dist = target ? Math.hypot(target.x - tmpMuzzleWorld.x, target.z - tmpMuzzleWorld.z) : 55;
            const dy = (target ? target.y : aimY) - tmpMuzzleWorld.y;
            const tFlight = dist / speed;
            let loft = dy / Math.max(0.2, tFlight) + 0.5 * CANNON.gravity * tFlight;
            loft = clamp(loft, 4.5, 28);

            // Pequeno atraso entre bocas na salva.
            const stagger = i * 0.04;
            const ox = tmpMuzzleWorld.x + dirX * stagger * speed * 0.15;
            const oz = tmpMuzzleWorld.z + dirZ * stagger * speed * 0.15;

            if (entities.fireShot(ox, tmpMuzzleWorld.y, oz, dirX, dirZ, speed, loft)) {
                fired += 1;
                this.parts.fireGun(gun);
                fireLights.request(tmpMuzzleWorld.x, tmpMuzzleWorld.y, tmpMuzzleWorld.z, 0xffb060, 160, 16);
                ctx.effects.muzzle?.(tmpMuzzleWorld.x, tmpMuzzleWorld.y, tmpMuzzleWorld.z, dirX, dirZ);
                ctx.effects.explosion(tmpMuzzleWorld.x, tmpMuzzleWorld.y, tmpMuzzleWorld.z, 0.22, 0.12);
                ctx.effects.smokePuff(tmpMuzzleWorld.x, tmpMuzzleWorld.y + 0.2, tmpMuzzleWorld.z, 5, 0.85);
                ctx.effects.fire(tmpMuzzleWorld.x, tmpMuzzleWorld.y, tmpMuzzleWorld.z, 2, 0.9);
            }
        }

        return fired > 0;
    }

    /** @deprecated use fireCannons */
    throwAxe(entities, ctx) {
        return this.fireCannons(entities, ctx);
    }

    damage(amount, ctx) {
        if (!this.alive || this.invuln > 0) return false;
        if (this.hasShield) {
            this.shieldTime = 0;
            this.invuln = BOAT.invulnAfterHit;
            ctx.effects.explosion(this.x, this.position.y + 1, this.z, 0.9, 0.55);
            ctx.audio.sfx('hitMetal');
            return false;
        }

        this.hull -= amount;
        this.invuln = BOAT.invulnAfterHit;
        ctx.effects.explosion(this.x, this.position.y + 1, this.z, 0.8);
        ctx.audio.sfx('damage');

        if (this.hull <= 0) {
            this.hull = 0;
            this.alive = false;
            return true;
        }
        return false;
    }

    heal(amount = 1) {
        this.hull = Math.min(this.maxHull, this.hull + amount);
    }

    grantShield(seconds = 8) {
        this.shieldTime = seconds;
    }

    grantFury(seconds = 9) {
        this.furyTime = seconds;
        // A fúria reanima os remadores: fôlego cheio para o Ataque.
        this.stamina = 1;
        this.exhausted = false;
    }

    /** Sequência final: o barco encosta na doca do castelo. */
    startDocking(targetZ) {
        this.docking = true;
        this.dockZ = targetZ;
    }
}
