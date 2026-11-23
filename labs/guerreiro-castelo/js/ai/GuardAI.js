/**
 * Percepção de guarda: cone de visão, linha de visão contra as caixas do nível,
 * audição e estados (SLEEP · IDLE · PATROL · SUSPICIOUS · CHASE · ATTACK · STAGGER ·
 * SEARCH · RETURN).
 *
 * Visão: o jogador é visto se está a menos de `viewDist` (×0,6 quando agachado), dentro
 * de ±`viewAngle` da frente do guarda e sem caixa sólida entre os olhos do guarda (1,5 m)
 * e a cabeça do jogador (1,5 m em pé · 0,85 m agachado) — agachar atrás de um caixote esconde.
 *
 * Alerta (0…1), mostrado no cone e na barra de "Silêncio":
 *   vendo:      alerta += dt · 0,65 · (0,9 + 1,6·(1 − dist/viewDist))  (de perto enche em ~0,6 s,
 *               de longe em ~1,7 s — dá tempo de agachar atrás de um caixote)
 *   ouvindo:    alerta += dt · 0,5
 *   sem sinal:  alerta −= dt · 0,35
 * Ao chegar a 1 o guarda persegue (CHASE, 3,4 m/s — Dico trota a 4,6 e corre a 6,6: dá
 * para fugir); perto o bastante, ataca (ATTACK). Perdeu o jogador de vista por 4 s →
 * vai até onde o viu por último (SEARCH), olha em volta e volta pela trilha que fez.
 *
 * Golpe do guarda (telegrafado, como em bons jogos de ação):
 *   0 → 0,42 s  antecipação: ergue a espada; acompanha Dico só até 0,3 s (depois se
 *               compromete — dá para sair do caminho ou defender)
 *   0,42 s      impacto: acerta se Dico está a < 2,1 m e dentro de ±60° da frente;
 *               1 de dano (0,35 defendendo) + empurrão de 4,5 m/s
 *   recarga total 1,6 s entre golpes
 * Levar um golpe de Dico: cambaleia 0,45 s (STAGGER) e é empurrado (velocidade de
 * knockback amortecida: v ← v·e^(−7·dt)), sem atravessar parede.
 *
 * Movimento: TODO deslocamento passa por CollisionWorld.resolveCapsule (mesma cápsula do
 * jogador, raio 0,32 m). Desvio de obstáculo por "bigodes": se o avanço real foi < 45 %
 * do esperado, tenta ±35°, ±70° e ±105° e guarda o lado que funcionou por 0,6 s (sem
 * zigue-zague). Preso > 1,5 s perseguindo → desiste (SEARCH); preso na ronda → pula o ponto.
 * Volta para casa pela trilha de migalhas gravada durante a perseguição (a cada 0,7 m):
 * o caminho de ida é livre por construção, então a volta também é.
 */

import { damp } from '../utils/math.js?v=50';

/** Fator do enchimento do alerta quando o guarda vê Dico (modo gentil). */
const SEEN_RATE = 0.65;
const CHASE_SPEED = 3.4;
const WALK_SPEED = 1.4;
const SWING_HIT = 0.42;
const SWING_TRACK = 0.3;
const SWING_LEN = 0.9;
const ATTACK_CD = 1.6;
const STAGGER_TIME = 0.45;
const RADIUS = 0.32;
const HEIGHT = 1.7;
const CRUMB_STEP = 0.7;
const CRUMBS = 96;
const WHISKERS = [0.6, -0.6, 1.2, -1.2, 1.8, -1.8];

export class GuardAI {
    constructor(guard, opts = {}) {
        this.guard = guard;
        this.state = opts.sleep ? 'SLEEP' : 'IDLE';
        this.home = { x: 0, y: 0, z: 0 };
        this.facing = 0;
        this.viewDist = opts.viewDist ?? 9;
        this.viewAngle = opts.viewAngle ?? 0.7;
        this.hearRadius = opts.hearRadius ?? 4.2;
        this.patrol = opts.patrol || [];
        this.patrolI = 0;
        this.timer = 0;
        this.suspicion = 0;
        this.alert = 0;
        this.lostT = 0;
        this.attackCd = 0;
        /* tempo desde o início do golpe atual (−1 = sem golpe) */
        this.swingT = -1;
        this.swingHit = false;
        this.sleep = Boolean(opts.sleep);
        this.snoreT = 0;
        this.waitT = 0;
        this.stuckT = 0;
        /* progresso até o objetivo atual: sem chegar 0,3 m mais perto em 2,5 s = empacado
           (pega o vai-e-vem encostado num batente, que não para de "andar") */
        this.bestD = Infinity;
        this.noProg = 0;
        this.detour = 0;
        this.detourT = 0;
        this.kvx = 0;
        this.kvz = 0;
        this.lastX = 0;
        this.lastZ = 0;
        /* trilha de migalhas (x, z) — Float32Array fixo, sem alocar durante o jogo */
        this.crumbs = new Float32Array(CRUMBS * 2);
        this.crumbN = 0;
    }

    canSee(game) {
        const g = this.guard;
        const p = game.player.position;
        const dx = p.x - g.position.x;
        const dz = p.z - g.position.z;
        const dy = p.y - g.position.y;
        const dist = Math.hypot(dx, dz);
        const reach = this.viewDist * (game.player.crouching ? 0.6 : 1);
        if (dist > reach || Math.abs(dy) > 2.2) return false;

        const ang = Math.atan2(dx, dz);
        const d = Math.abs(Math.atan2(Math.sin(ang - this.facing), Math.cos(ang - this.facing)));
        if (d > this.viewAngle && dist > 1.1) return false;

        // linha de visão: olhos do guarda → cabeça do jogador
        const ey = g.position.y + 1.5;
        const ty = p.y + (game.player.crouching ? 0.85 : 1.5);
        const len = Math.hypot(dx, ty - ey, dz) || 1;
        const hit = game.collision.rayHit(g.position.x, ey, g.position.z, dx / len, (ty - ey) / len, dz / len, len);
        return hit >= len - 0.35;
    }

    hear(game) {
        const g = this.guard;
        const p = game.player.position;
        if (Math.abs(p.y - g.position.y) > 2.2) return false;
        const dist = Math.hypot(p.x - g.position.x, p.z - g.position.z);
        const noise = game.player.noise || 0;
        let hear = noise * this.hearRadius;
        if (game.player.crouching) hear *= 0.55;
        if (dist < hear) return true;

        for (const n of game.collision.noiseSources) {
            if (Math.hypot(n.x - g.position.x, n.z - g.position.z) < n.amount * 5) return true;
        }
        return false;
    }

    /** Golpe recebido: empurrão para longe de (fromX, fromZ) e cambaleio. */
    stagger(fromX, fromZ, push) {
        const g = this.guard;
        const dx = g.position.x - fromX;
        const dz = g.position.z - fromZ;
        const len = Math.hypot(dx, dz) || 1;
        this.kvx = (dx / len) * push;
        this.kvz = (dz / len) * push;
        this.state = 'STAGGER';
        this.timer = 0;
        this.swingT = -1;
        this.alert = 1;
        this.attackCd = Math.max(this.attackCd, 0.6);
    }

    /**
     * Anda na direção `dir` (rad, 0 = +Z) a `spd` m/s respeitando paredes, com desvio por
     * bigodes. Soma o knockback pendente. Devolve o avanço real (m).
     */
    _move(game, dir, spd, dt) {
        const g = this.guard;
        const col = game.collision;
        const want = spd * dt;
        const ox = g.position.x;
        const oz = g.position.z;
        this.detourT = Math.max(0, this.detourT - dt);
        let used = this.detourT > 0 ? this.detour : 0;
        let res = this._try(col, dir + used, spd, dt);
        let moved = Math.hypot(res.x - ox, res.z - oz);
        if (want > 0.001 && moved < want * 0.45) {
            for (const w of WHISKERS) {
                const r = this._try(col, dir + w, spd, dt);
                const m = Math.hypot(r.x - ox, r.z - oz);
                if (m >= want * 0.6) {
                    used = w;
                    this.detour = w;
                    this.detourT = 0.6;
                    res = r;
                    moved = m;
                    break;
                }
            }
        }
        /* reaplica o vencedor (resolveCapsule devolve um objeto compartilhado) */
        res = this._try(col, dir + used, spd, dt);
        g.position.x = res.x;
        g.position.z = res.z;
        if (res.grounded) g.position.y = res.y;
        if (want > 0.001 && moved < want * 0.25) this.stuckT += dt;
        else this.stuckT = Math.max(0, this.stuckT - dt * 2);
        if (moved > 0.002 && spd > 0) this.facing = Math.atan2(res.x - ox, res.z - oz);
        return moved;
    }

    /** Mede o progresso até o alvo (distância `d`); soma em stuckT quando não melhora. */
    _progress(d, dt) {
        if (d < this.bestD - 0.3) {
            this.bestD = d;
            this.noProg = 0;
        } else {
            this.noProg += dt;
            if (this.noProg > 2.5) this.stuckT = Math.max(this.stuckT, 3);
        }
    }

    _newGoal() {
        this.bestD = Infinity;
        this.noProg = 0;
        this.stuckT = 0;
    }

    _try(col, dir, spd, dt) {
        const g = this.guard;
        return col.resolveCapsule(
            g.position.x, g.position.y, g.position.z, RADIUS, HEIGHT,
            Math.sin(dir) * spd + this.kvx, Math.cos(dir) * spd + this.kvz, dt, 0.42
        );
    }

    /** Só o knockback (parado/atacando/cambaleando), também contra paredes. */
    _slide(game, dt) {
        if (Math.abs(this.kvx) + Math.abs(this.kvz) < 0.02) {
            this.kvx = 0;
            this.kvz = 0;
            return;
        }
        const g = this.guard;
        const res = game.collision.resolveCapsule(g.position.x, g.position.y, g.position.z, RADIUS, HEIGHT, this.kvx, this.kvz, dt, 0.42);
        g.position.x = res.x;
        g.position.z = res.z;
        if (res.grounded) g.position.y = res.y;
    }

    _dropCrumb() {
        const g = this.guard;
        const n = this.crumbN;
        if (n > 0) {
            const lx = this.crumbs[(n - 1) * 2];
            const lz = this.crumbs[(n - 1) * 2 + 1];
            if (Math.hypot(g.position.x - lx, g.position.z - lz) < CRUMB_STEP) return;
        }
        if (n >= CRUMBS) {
            /* cheio: descarta a metade mais antiga (perde só o começo da trilha) */
            this.crumbs.copyWithin(0, CRUMBS, CRUMBS * 2);
            this.crumbN = CRUMBS / 2;
        }
        this.crumbs[this.crumbN * 2] = g.position.x;
        this.crumbs[this.crumbN * 2 + 1] = g.position.z;
        this.crumbN++;
    }

    _startChase(game) {
        if (this.state !== 'CHASE' && this.state !== 'ATTACK' && this.state !== 'STAGGER' && this.crumbN === 0) {
            /* começo da trilha: onde ele estava quando viu Dico */
            this._dropCrumb();
        }
        this.state = 'CHASE';
        this.lostT = 0;
        this._newGoal();
        game.audio?.play('fail');
        game.hud?.showToast('O guarda viu você! Lute ou fuja e agache atrás de um caixote.', 4);
    }

    update(dt, game) {
        const g = this.guard;
        this.timer += dt;
        this.attackCd = Math.max(0, this.attackCd - dt);
        const decay = Math.exp(-7 * dt);
        this.kvx *= decay;
        this.kvz *= decay;

        if (this.state === 'SLEEP') {
            this.snoreT += dt;
            if (this.snoreT > 2.4) {
                this.snoreT = 0;
                const p = game.player.position;
                if (Math.hypot(p.x - g.position.x, p.z - g.position.z) < 7) {
                    game.audio?.play('snore');
                    game.hud?.flashStealth?.('Ronc… ronc…');
                }
            }
            if (this.hear(game) && game.player.noise > 0.9) {
                this.suspicion += dt * 0.8;
            } else {
                this.suspicion = Math.max(0, this.suspicion - dt * 0.15);
            }
            if (this.suspicion > 1.2) {
                this.lastX = game.player.position.x;
                this.lastZ = game.player.position.z;
                this.state = 'SUSPICIOUS';
                this.timer = 0;
                this.alert = 0.6;
            }
            g.speed = 0;
            return;
        }

        const pl = game.player;
        const p = pl.position;
        const dx = p.x - g.position.x;
        const dz = p.z - g.position.z;
        const dist = Math.hypot(dx, dz);
        const seen = pl.alive && this.canSee(game);
        const heard = pl.alive && this.hear(game) && pl.noise > 0.7;
        if (seen || heard) {
            this.lastX = p.x;
            this.lastZ = p.z;
        }

        if (seen) this.alert += dt * SEEN_RATE * (0.9 + 1.6 * (1 - Math.min(1, dist / this.viewDist)));
        else if (heard) this.alert += dt * 0.5;
        else if (this.state !== 'CHASE' && this.state !== 'ATTACK' && this.state !== 'STAGGER') this.alert -= dt * 0.35;
        this.alert = Math.max(0, Math.min(1, this.alert));

        if (this.alert >= 1 && this.state !== 'CHASE' && this.state !== 'ATTACK' && this.state !== 'STAGGER') {
            this.lastX = p.x;
            this.lastZ = p.z;
            this._startChase(game);
        }

        if (this.state === 'STAGGER') {
            g.speed = 0;
            this._slide(game, dt);
            if (this.timer > STAGGER_TIME) {
                this.state = 'CHASE';
                this.timer = 0;
                this.lostT = 0;
                this._newGoal();
            }
            return;
        }

        if (this.state === 'CHASE' || this.state === 'ATTACK') {
            this.lostT = seen || dist < 2.5 ? 0 : this.lostT + dt;
            if (this.lostT > 4 || !pl.alive || this.stuckT > 1.5) {
                this.state = 'SEARCH';
                this.timer = 0;
                this._newGoal();
                this.swingT = -1;
                g.speed = 0;
                return;
            }
        }

        if (this.state === 'CHASE') {
            /* persegue o jogador; sem vê-lo, vai até onde ouviu/viu por último */
            const tx = seen || dist < 2.5 ? p.x : this.lastX;
            const tz = seen || dist < 2.5 ? p.z : this.lastZ;
            const dir = Math.atan2(tx - g.position.x, tz - g.position.z);
            this._move(game, dir, CHASE_SPEED, dt);
            /* alvo móvel à vista: vale só o "não saiu do lugar"; sem vê-lo, o progresso */
            if (seen) {
                this.bestD = Infinity;
                this.noProg = 0;
            } else {
                this._progress(Math.hypot(tx - g.position.x, tz - g.position.z), dt);
            }
            this._dropCrumb();
            g.speed = CHASE_SPEED;
            if (dist < 1.7 && Math.abs(p.y - g.position.y) < 1.4) {
                this.state = 'ATTACK';
                this.facing = Math.atan2(dx, dz);
            }
            return;
        }

        if (this.state === 'ATTACK') {
            g.speed = 0;
            this._slide(game, dt);
            if (this.swingT >= 0) {
                this.swingT += dt;
                if (this.swingT < SWING_TRACK) this.facing = Math.atan2(dx, dz);
                if (!this.swingHit && this.swingT >= SWING_HIT) {
                    this.swingHit = true;
                    const ang = Math.atan2(dx, dz);
                    const off = Math.abs(Math.atan2(Math.sin(ang - this.facing), Math.cos(ang - this.facing)));
                    if (dist < 2.1 && off < 1.05 && Math.abs(p.y - g.position.y) < 1.4) {
                        if (pl.hurt(1, g.position.x, g.position.z, 4.5)) {
                            game.audio?.play(pl.blockT > 0 ? 'block' : 'hit');
                            game.cameraRig?.addShake(0.1, 0.2);
                            game.hitstop?.(0.06);
                            game.hud?.flashHurt?.();
                        }
                    } else {
                        game.audio?.play('whoosh');
                    }
                }
                if (this.swingT >= SWING_LEN) this.swingT = -1;
                return;
            }
            this.facing = Math.atan2(dx, dz);
            if (dist > 2.3) {
                this.state = 'CHASE';
                this._newGoal();
                return;
            }
            if (this.attackCd <= 0 && dist < 1.95) {
                this.attackCd = ATTACK_CD;
                this.swingT = 0;
                this.swingHit = false;
            }
            return;
        }

        if (this.state === 'SUSPICIOUS') {
            /* virou para o barulho: encara a última posição ouvida */
            const ang = Math.atan2(this.lastX - g.position.x, this.lastZ - g.position.z);
            this.facing = ang + Math.sin(this.timer * 1.4) * 0.5;
            g.speed = 0;
            this._slide(game, dt);
            if (this.timer > 3) {
                this.state = this.sleep ? 'SLEEP' : 'RETURN';
                this.suspicion = 0;
            }
            return;
        }

        if (this.state === 'SEARCH') {
            const lx = this.lastX - g.position.x;
            const lz = this.lastZ - g.position.z;
            if (this.timer < 4 && Math.hypot(lx, lz) > 0.6 && this.stuckT < 1) {
                this._move(game, Math.atan2(lx, lz), WALK_SPEED, dt);
                this._progress(Math.hypot(lx, lz), dt);
                this._dropCrumb();
                g.speed = WALK_SPEED;
            } else {
                /* chegou (ou não dá para chegar): olha em volta e desiste */
                g.speed = 0;
                this._slide(game, dt);
                this.facing += dt * 0.9;
                if (this.timer > 6.5) {
                    this.state = this.sleep ? 'SLEEP' : 'RETURN';
                    this.timer = 0;
                    this._newGoal();
                    this.suspicion = 0;
                }
            }
            return;
        }

        if (this.state === 'RETURN' && this.crumbN > 0) {
            /* volta pela trilha de migalhas, da mais nova para a mais velha */
            const i = (this.crumbN - 1) * 2;
            const cx = this.crumbs[i] - g.position.x;
            const cz = this.crumbs[i + 1] - g.position.z;
            if (Math.hypot(cx, cz) < 0.35 || this.stuckT > 1.2) {
                this.crumbN--;
                this._newGoal();
            } else {
                this._move(game, Math.atan2(cx, cz), WALK_SPEED, dt);
                this._progress(Math.hypot(cx, cz), dt);
                g.speed = WALK_SPEED;
            }
            return;
        }

        if (this.state === 'RETURN' || this.state === 'IDLE' || this.state === 'PATROL') {
            if (this.patrol.length) {
                this.state = 'PATROL';
                const goal = this.patrol[this.patrolI];
                const gx = goal.x - g.position.x;
                const gz = goal.z - g.position.z;
                const gd = Math.hypot(gx, gz);
                if (this.waitT > 0) {
                    // pausa no ponto de ronda, olhando em volta
                    this.waitT -= dt;
                    this.facing += Math.sin(this.timer * 1.3) * dt * 0.9;
                    g.speed = 0;
                    this._slide(game, dt);
                } else if (gd < 0.3 || this.stuckT > 2) {
                    this.patrolI = (this.patrolI + 1) % this.patrol.length;
                    this.waitT = this.stuckT > 2 ? 0.4 : goal.wait ?? 1.2;
                    this._newGoal();
                } else {
                    // quando algo chamou a atenção, anda mais devagar olhando para o jogador
                    const wary = this.alert > 0.35;
                    const spd = wary ? 0.6 : WALK_SPEED;
                    this._move(game, Math.atan2(gx, gz), spd, dt);
                    if (!wary) this._progress(gd, dt);
                    if (wary) this.facing = Math.atan2(dx, dz);
                    if (goal.y !== undefined) g.position.y = damp(g.position.y, goal.y, 8, dt);
                    g.speed = spd;
                }
            } else {
                const hx = this.home.x - g.position.x;
                const hz = this.home.z - g.position.z;
                if (Math.hypot(hx, hz) > 0.4 && this.stuckT < 3) {
                    this._move(game, Math.atan2(hx, hz), WALK_SPEED, dt);
                    this._progress(Math.hypot(hx, hz), dt);
                    g.speed = WALK_SPEED;
                } else {
                    if (this.stuckT >= 3) {
                        /* casa inalcançável: fica de guarda onde está */
                        this.home.x = g.position.x;
                        this.home.z = g.position.z;
                    }
                    this.state = 'IDLE';
                    this.stuckT = 0;
                    g.speed = 0;
                    this._slide(game, dt);
                }
            }
        }
    }
}
