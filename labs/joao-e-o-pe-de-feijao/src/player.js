/**
 * João em terceira pessoa (three.js): movimento relativo à câmera com inércia,
 * pulo variável com coyote e buffer, trepar no caule e saltos assistidos entre
 * caule e folhas.
 *
 * O corpo é um `createHero({ preset: 'villageBoy' })` de gfx/hero.js; aqui só se
 * decide o MODO de animação a partir do estado físico:
 *   no chão parado → idle · andando → walk · correndo → run (fase pela velocidade real)
 *   subindo no ar → jump (fase presa no "voo") · caindo → fall · no caule → climb
 *   golpe de machado → upper 'attack'
 *
 * Física (unidades SI; constantes em config.js → PLAYER):
 *   chão   v⃗ ← v⃗ + (v⃗_alvo − v⃗)·(1 − e^(−k·dt)), k = accel (com direcional) ou decel (sem)
 *   ar     mesma regra com k·airControl; sem direcional só um arrasto leve (airDrag)
 *   pulo   v0 = √(2·g·h) · g_ef = g (subindo segurando) | g·cutGravity (soltou cedo)
 *          | g·fallGravity (descendo) · v_y ≥ −terminal
 *   coyote 0,12 s depois de sair do chão · buffer de pulo 0,12 s antes de pousar
 *   colisão: círculos e caixas orientadas, resolvidas por eixo (desliza nas paredes);
 *            degraus/bordas de folha até `stepUp` sobem sem pulo
 *
 * Salto assistido (caule ↔ folha): o arco é resolvido para cair EXATAMENTE no alvo:
 *   ápice  y_a = max(y0, yT) + 0,5 + 0,12·d   (d = distância horizontal)
 *   v_y0 = √(2g(y_a − y0)) · T = v_y0/g + √(2(y_a − yT)/g) · v_h = d/T
 * Durante o salto a gravidade é constante (g) e o direcional não interfere.
 */

import { PLAYER } from './config.js?v=12';
import { clamp, lerpAngle } from './utils.js?v=12';
import { leafSurface, angDiff } from './leaves.js?v=12';
import { createHero } from '../../shared/gfx/hero.js';

const AXIS = { x: 0, z: 0 };
const JUMP_V = Math.sqrt(2 * PLAYER.gravity * PLAYER.jumpHeight);
const INFO = { footstep: false, jumped: false, landed: 0, moving: false, fell: false, climbing: false };

export class Player {
    constructor(scene, detail = 2) {
        this.scene = scene;
        this.hero = createHero({ preset: 'villageBoy', detail, height: 1.32, hair: 0x9a6a30, topColor: 0xe2d8b8, vest: 0x7a3f2a, bottomColor: 0x4a5a3c });
        this.root = this.hero.object;
        scene.add(this.root);
        this.anim = { mode: 'idle', speed: 0, upper: undefined, upperPhase: 0, blend: 0.18, phase: undefined };

        this.x = 0;
        this.y = 0;
        this.z = 0;
        this.camYaw = 0;   // azimute da câmera do último passo (leitura pública: HUD, bots de teste)
        this.vx = 0;
        this.vz = 0;
        this.vy = 0;
        this.yaw = 0;
        this.facing = 0;
        this.grounded = true;
        this.climbing = false;
        this.climbV = 0;      // m/s vertical no caule (suavizado)
        this.climbAng = 0;    // azimute do João em volta do eixo do caule
        this.health = 3;
        this.maxHealth = 3;
        this.invuln = 0;
        this.footTimer = 0;
        this.alive = true;
        this.coyote = 0;
        this.jumpBuf = 0;
        this.airT = 0;        // s no ar (fase da pose de pulo)
        this.fallTop = 0;     // y mais alto desde o último apoio (mede a queda)
        this.support = null;  // folha em que está pisando (ou null = chão)
        this.leap = null;     // salto assistido em curso
        this.target = null;   // alvo de salto disponível agora (folha ou caule) — main mostra o anel
        this.action = '';     // rótulo da ação de pé de feijão disponível ('' = nenhuma)
        this.beans = 0;
        this.treasures = { gold: false, hen: false, harp: false };
        this.hasCow = false;
        this.hasAxe = false;
        this.sprinting = false;
        this.speed = 0;      // velocidade horizontal real (m/s) — alimenta a passada
        this.swing = 0;      // s restantes do golpe de machado
        this.visible = true;
        this._leapT = { x: 0, y: 0, z: 0, kind: 'leaf', leaf: null, ang: 0 };
    }

    get treasureCount() {
        return Number(this.treasures.gold) + Number(this.treasures.hen) + Number(this.treasures.harp);
    }

    setVisible(v) {
        this.visible = Boolean(v);
        this.root.visible = this.visible;
    }

    spawn(x, z, yaw, heightAt, y) {
        this.x = x;
        this.z = z;
        this.y = y ?? heightAt(x, z);
        this.yaw = yaw;
        this.facing = yaw;
        this.vx = this.vz = this.vy = 0;
        this.health = this.maxHealth;
        this.invuln = 0;
        this.alive = true;
        this.climbing = false;
        this.climbV = 0;
        this.leap = null;
        this.target = null;
        this.action = '';
        this.support = null;
        this.grounded = y == null;
        this.fallTop = this.y;
        this.speed = 0;
        this.swing = 0;
        this.setVisible(true);
        this.sync();
    }

    /** Põe o João agarrado ao caule na altura y, no azimute ang (respawn, início da fuga). */
    grabStalk(climb, y, ang) {
        this.climbing = true;
        this.grounded = false;
        this.leap = null;
        this.support = null;
        this.vx = this.vz = this.vy = 0;
        this.climbV = 0;
        this.y = clamp(y, climb.yMin, climb.yMax);
        climb.axis(this.y, AXIS);
        const r = climb.hold(this.y);
        this.climbAng = ang;
        this.x = AXIS.x + Math.sin(ang) * r;
        this.z = AXIS.z + Math.cos(ang) * r;
        this.facing = this.yaw = ang + Math.PI;
        this.fallTop = this.y;
        this.sync();
    }

    /** Pousa o João parado em (x, y, z) — respawn em chão ou folha. */
    placeAt(x, y, z, leaf = null) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.vx = this.vz = this.vy = 0;
        this.climbing = false;
        this.leap = null;
        this.grounded = true;
        this.support = leaf;
        this.fallTop = y;
        this.sync();
    }

    hurt(amount = 1) {
        if (this.invuln > 0 || !this.alive) return false;
        this.health -= amount;
        this.invuln = PLAYER.invuln;
        if (this.health <= 0) {
            this.health = 0;
            this.alive = false;
        }
        return true;
    }

    /** Golpe de machado (0,55 s): sobrepõe os braços à locomoção. */
    attack() {
        this.swing = 0.55;
    }

    /**
     * Um passo de simulação. `camYaw` = azimute da câmera (o direcional é relativo a ela).
     * Devolve INFO (objeto reaproveitado — não guarde a referência).
     */
    update(dt, input, world, camYaw) {
        this.camYaw = camYaw;
        this.invuln = Math.max(0, this.invuln - dt);
        this.swing = Math.max(0, this.swing - dt);
        INFO.footstep = INFO.jumped = INFO.fell = false;
        INFO.landed = 0;

        const move = input.move;
        let mx = move.x;
        let mz = move.z;
        const len = Math.hypot(mx, mz);
        if (len > 1) {
            mx /= len;
            mz /= len;
        }
        const mag = Math.min(1, len);
        // analógico no fim do curso (toque) também corre
        const sprint = Boolean(move.sprint || (input.touchMove && Math.hypot(input.touchMove.x, input.touchMove.y) > 0.9));
        this.sprinting = sprint && mag > 0.2 && this.grounded;

        if (input.consumeJump()) this.jumpBuf = PLAYER.jumpBuffer;
        else this.jumpBuf = Math.max(0, this.jumpBuf - dt);

        const climb = this._stalk(world);
        const px = this.x;
        const pz = this.z;
        this.target = null;
        this.action = '';

        if (this.leap) {
            this._updateLeap(dt, world, climb);
        } else if (this.climbing && climb) {
            this._updateClimb(dt, input, world, climb, mx, mz, sprint);
        } else {
            this.climbing = false;
            this._updateWalk(dt, input, world, climb, mx, mz, mag, sprint, camYaw);
            if (this.y < world.voidY) INFO.fell = true;
        }

        this.speed = dt > 0 ? Math.hypot(this.x - px, this.z - pz) / dt : 0;
        this.yaw = lerpAngle(this.yaw, this.facing, this.climbing ? 18 : PLAYER.turnSpeed, dt);
        this._animate(dt, mz);

        this.root.visible = this.visible && !(this.invuln > 0 && Math.sin(this.invuln * 28) <= 0);
        this.sync();

        if (this.climbing) INFO.footstep = this.footTimer > 1.1;
        else INFO.footstep = this.grounded && this.footTimer > 1.25;
        if (INFO.footstep) this.footTimer = 0;
        INFO.moving = len > 0.08;
        INFO.climbing = this.climbing;
        return INFO;
    }

    /* ------------------------------------------------------------------ */
    /* chão e ar                                                           */
    /* ------------------------------------------------------------------ */
    _updateWalk(dt, input, world, climb, mx, mz, mag, sprint, camYaw) {
        const vmax = sprint ? PLAYER.sprint : PLAYER.walk;
        const sin = Math.sin(camYaw);
        const cos = Math.cos(camYaw);
        // frente da câmera no plano: (−sin, −cos) · direita: (cos, −sin)
        const wx = -sin * mz + cos * mx;
        const wz = -cos * mz - sin * mx;
        const tvx = wx * vmax;
        const tvz = wz * vmax;
        let k;
        if (this.grounded) k = mag > 0.05 ? PLAYER.accel : PLAYER.decel;
        else k = mag > 0.05 ? PLAYER.accel * PLAYER.airControl : PLAYER.airDrag;
        const a = 1 - Math.exp(-k * dt);
        if (this.grounded || mag > 0.05) {
            this.vx += (tvx - this.vx) * a;
            this.vz += (tvz - this.vz) * a;
        } else {
            this.vx *= 1 - a;
            this.vz *= 1 - a;
        }
        const hs = Math.hypot(this.vx, this.vz);
        if (hs < 0.02 && mag < 0.05) this.vx = this.vz = 0;
        if (mag > 0.08 && this.grounded) this.facing = Math.atan2(wx, wz);
        else if (hs > 0.6) this.facing = Math.atan2(this.vx, this.vz);
        if (this.grounded && hs > 0.3) this.footTimer += dt * hs;
        else if (this.grounded) this.footTimer = 0;

        // horizontal com colisão por eixo (desliza na parede e zera a componente bloqueada)
        const b = world.bounds;
        const nx = clamp(this.x + this.vx * dt, b.minX, b.maxX);
        const nz = clamp(this.z + this.vz * dt, b.minZ, b.maxZ);
        if (!this._blocked(nx, this.z, world)) this.x = nx;
        else this.vx = 0;
        if (!this._blocked(this.x, nz, world)) this.z = nz;
        else this.vz = 0;

        // agarrar o caule: no chão (E ou pulo colado ao caule) ou no ar encostando nele
        if (climb) {
            climb.axis(this.y, AXIS);
            const dAx = Math.hypot(this.x - AXIS.x, this.z - AXIS.z);
            const hold = climb.hold(this.y);
            const onGround = this.grounded && this.y < climb.yMin + 2;
            if (onGround && climb.groundGrab && dAx < hold + 1.1) {
                this.action = 'grab';
                if (this.jumpBuf > 0 || input.consumeInteract()) {
                    this.jumpBuf = 0;
                    this.grabStalk(climb, this.y + 0.5, Math.atan2(this.x - AXIS.x, this.z - AXIS.z));
                    INFO.jumped = true;
                    return;
                }
            } else if (!this.grounded && this.y > climb.yMin + (climb.groundGrab ? 1 : 3) && dAx < hold + 0.45 && this.vy < 3) {
                this.grabStalk(climb, this.y, Math.atan2(this.x - AXIS.x, this.z - AXIS.z));
                INFO.landed = 1;
                return;
            } else if (this.grounded && this.support && dAx < hold + 9) {
                // numa folha: E volta para o caule (salto assistido)
                this._aimStalk(climb);
                this.action = 'stalk';
                if (input.consumeInteract()) {
                    this._startLeap(this._leapT.x, this._leapT.y, this._leapT.z, 'stalk');
                    INFO.jumped = true;
                    return;
                }
            }
        }

        // pulo (coyote + buffer)
        if (this.grounded) this.coyote = PLAYER.coyote;
        else this.coyote = Math.max(0, this.coyote - dt);
        if (this.jumpBuf > 0 && this.coyote > 0) {
            this.vy = JUMP_V;
            this.grounded = false;
            this.coyote = 0;
            this.jumpBuf = 0;
            this.airT = 0;
            INFO.jumped = true;
        }

        // vertical: gravidade assimétrica + terminal
        let g = PLAYER.gravity;
        if (this.vy > 0) g *= input.jumpHeld ? 1 : PLAYER.cutGravity;
        else g *= PLAYER.fallGravity;
        this.vy = Math.max(-PLAYER.terminal, this.vy - g * dt);
        const prevY = this.y;
        this.y += this.vy * dt;

        // prevY evita atravessar folha fina em queda rápida (até 1,2 m por quadro a 24 m/s, dt 0,05)
        const ground = this._groundY(world, PLAYER.stepUp, prevY);
        const wasGrounded = this.grounded;
        if (this.vy <= 0 && this.y <= ground) {
            if (!wasGrounded) INFO.landed = Math.max(0.01, this.fallTop - ground);
            this.y = ground;
            this.vy = 0;
            this.grounded = true;
        } else if (wasGrounded && this.vy <= 0 && this.y - ground < 0.35) {
            // descendo ladeira/folha curva: cola no apoio em vez de "voar" a cada desnível
            this.y = ground;
            this.vy = 0;
        } else {
            this.grounded = false;
        }
        if (this.grounded) {
            this.fallTop = this.y;
            this.airT = 0;
        } else {
            this.fallTop = Math.max(this.fallTop, this.y);
            this.airT += dt;
            this.support = null;
        }
    }

    /* ------------------------------------------------------------------ */
    /* caule                                                               */
    /* ------------------------------------------------------------------ */
    _updateClimb(dt, input, world, climb, mx, mz, sprint) {
        // O João gira em volta do eixo (A/D) e sobe/desce (W/S). O eixo serpenteia com a
        // altura, então o centro é reavaliado a cada quadro. Velocidade vertical suavizada
        // (λ = 10): o corpo tem peso, não teleporta.
        this.grounded = false;
        this.coyote = 0;
        this.support = null;
        this.vx = this.vz = this.vy = 0;
        climb.axis(this.y, AXIS);
        this.climbAng = Math.atan2(this.x - AXIS.x, this.z - AXIS.z);
        const ang = this.climbAng + mx * PLAYER.climbTurn * dt;
        let want = 0;
        if (mz > 0) want = mz * (sprint ? PLAYER.climbSprint : PLAYER.climbSpeed);
        else if (mz < 0) want = mz * (sprint ? PLAYER.slideSpeed : PLAYER.climbDown);
        this.climbV += (want - this.climbV) * (1 - Math.exp(-10 * dt));
        this.y = clamp(this.y + this.climbV * dt, climb.yMin, climb.yMax);
        if (this.y >= climb.yMax - 0.01 && this.climbV > 0) this.climbV = 0;
        climb.axis(this.y, AXIS);
        const r = climb.hold(this.y);
        this.x = AXIS.x + Math.sin(ang) * r;
        this.z = AXIS.z + Math.cos(ang) * r;
        this.climbAng = ang;
        this.facing = ang + Math.PI;
        this.footTimer += Math.abs(this.climbV) * dt;
        this.fallTop = this.y;

        // chegou ao chão descendo: solta sozinho
        const ground = world.heightAt(this.x, this.z);
        if (mz < -0.2 && (this.y <= climb.yMin + 0.02 || this.y - ground < 0.25)) {
            this.climbing = false;
            this.grounded = true;
            this.y = Math.max(ground, this.y);
            this.climbV = 0;
            return;
        }

        // folha ao alcance atrás do João? Espaço ou E salta para ela (arco garantido)
        const leaf = this._aimLeaf(world.platforms, ang);
        if (leaf) {
            this.action = 'leaf';
            if (this.jumpBuf > 0 || input.consumeInteract()) {
                this.jumpBuf = 0;
                this._startLeap(this._leapT.x, this._leapT.y, this._leapT.z, 'leaf', leaf);
                INFO.jumped = true;
            }
        } else if (this.jumpBuf > 0) {
            // sem folha mirada: impulso curto caule acima (ou abaixo, se segurando S)
            this.jumpBuf = 0;
            this.climbV = mz < -0.2 ? -PLAYER.slideSpeed : PLAYER.climbSprint * 1.6;
        }
    }

    /** Folha atrás do João (lado de fora do caule) dentro do alcance do salto. */
    _aimLeaf(leaves, ang) {
        let best = null;
        let bestS = Infinity;
        for (const l of leaves) {
            const dy = l.y - this.y;
            if (dy > PLAYER.leapRise || dy < -PLAYER.leapReach) continue;
            const da = Math.abs(angDiff(l.ang, ang));
            if (da > PLAYER.leapCone) continue;
            const s = da + Math.abs(dy) * 0.08;
            if (s < bestS) {
                bestS = s;
                best = l;
            }
        }
        if (!best) return null;
        const t = this._leapT;
        t.x = best.x;
        t.z = best.z;
        t.y = best.y;
        t.kind = 'leaf';
        t.leaf = best;
        this.target = t;
        return best;
    }

    /** Ponto de agarre no caule do lado da folha em que o João está. */
    _aimStalk(climb) {
        climb.axis(this.y, AXIS);
        const ang = Math.atan2(this.x - AXIS.x, this.z - AXIS.z);
        const ty = clamp(this.y + 0.6, climb.yMin, climb.yMax);
        climb.axis(ty, AXIS);
        const r = climb.hold(ty);
        const t = this._leapT;
        t.x = AXIS.x + Math.sin(ang) * r;
        t.z = AXIS.z + Math.cos(ang) * r;
        t.y = ty;
        t.kind = 'stalk';
        t.leaf = null;
        t.ang = ang;
        this.target = t;
    }

    _startLeap(tx, ty, tz, kind, leaf = null) {
        const g = PLAYER.gravity;
        const dx = tx - this.x;
        const dz = tz - this.z;
        const d = Math.hypot(dx, dz);
        const apex = Math.max(this.y, ty) + 0.5 + 0.12 * d;
        const vy0 = Math.sqrt(2 * g * (apex - this.y));
        const T = vy0 / g + Math.sqrt(2 * (apex - ty) / g);
        this.leap = { t: 0, T, vx: dx / T, vz: dz / T, tx, ty, tz, kind, leaf, ang: this._leapT.ang };
        this.vy = vy0;
        this.vx = dx / T;
        this.vz = dz / T;
        this.climbing = false;
        this.grounded = false;
        this.support = null;
        this.airT = 0;
        this.fallTop = Math.max(this.y, ty);
        if (d > 0.1) this.facing = Math.atan2(dx, dz);
    }

    _updateLeap(dt, world, climb) {
        const L = this.leap;
        const step = Math.min(dt, L.T - L.t);
        L.t += step;
        this.x += L.vx * step;
        this.z += L.vz * step;
        this.y += this.vy * step - 0.5 * PLAYER.gravity * step * step;
        this.vy -= PLAYER.gravity * step;
        this.airT += dt;
        this.fallTop = Math.max(this.fallTop, this.y);
        if (L.t < L.T - 1e-4) return;
        // pouso exato no alvo (o arco foi resolvido para isso)
        this.leap = null;
        this.x = L.tx;
        this.z = L.tz;
        if (L.kind === 'stalk' && climb) {
            climb.axis(L.ty, AXIS);
            this.grabStalk(climb, L.ty, Math.atan2(L.tx - AXIS.x, L.tz - AXIS.z));
        } else {
            const y = L.leaf ? leafSurface(L.leaf, L.tx, L.tz) : NaN;
            this.placeAt(L.tx, Number.isFinite(y) ? y : L.ty, L.tz, L.leaf);
            // pousa e se vira para o caule: a câmera (do lado de fora) continua vendo o caminho de volta
            if (L.leaf) this.facing = L.leaf.ang + Math.PI;
        }
        INFO.landed = 1.5;
    }

    /* ------------------------------------------------------------------ */
    /* animação                                                            */
    /* ------------------------------------------------------------------ */
    /** Escolhe o modo do herói a partir do estado físico e avança a animação. */
    _animate(dt, climbInput = 0) {
        const a = this.anim;
        a.phase = undefined;
        if (this.climbing) {
            a.mode = 'climb';
            a.speed = Math.abs(this.climbV) * 0.7 + Math.abs(climbInput) * 0.2;
        } else if (!this.grounded && (this.vy > 0.5 || this.leap) && this.airT < 1.2) {
            // pose de pulo presa no trecho "no ar" (0,42…0,78) da animação de disparo único
            a.mode = 'jump';
            a.speed = 0;
            a.phase = clamp(0.42 + this.airT * 0.55, 0.42, 0.78);
        } else if (!this.grounded && this.fallTop - this.y > 1.2) {
            a.mode = 'fall';
            a.speed = 0;
        } else if (!this.grounded) {
            a.mode = 'jump';
            a.speed = 0;
            a.phase = 0.78;
        } else if (this.speed > 0.25) {
            // criança: acima de 3 m/s já é corrida
            a.mode = this.speed > 3 ? 'run' : 'walk';
            a.speed = this.speed;
        } else {
            a.mode = 'idle';
            a.speed = 0;
        }
        if (this.swing > 0) {
            a.upper = 'attack';
            a.upperPhase = 1 - this.swing / 0.55;
        } else {
            a.upper = undefined;
        }
        this.hero.update(dt, a);
    }

    /** Animação parada (diálogo, cutscene, pausa): mantém o corpo vivo sem mover. */
    idle(dt, mode = 'idle') {
        this.swing = Math.max(0, this.swing - dt);
        const a = this.anim;
        a.mode = this.climbing ? 'climb' : mode;
        a.speed = 0;
        a.phase = undefined;
        a.upper = undefined;
        this.hero.update(dt, a);
        this.root.visible = this.visible;
    }

    /* ------------------------------------------------------------------ */
    /* consultas                                                           */
    /* ------------------------------------------------------------------ */
    /**
     * Apoio sob os pés: terreno ou folha. `reach` = quanto acima dos pés uma folha ainda
     * conta (degrau). Guarda a folha em `this.support`.
     */
    _groundY(world, reach = 0, prevY = this.y) {
        let y = world.heightAt(this.x, this.z);
        let sup = null;
        const top = Math.max(this.y, prevY);
        for (const p of world.platforms) {
            if (Math.abs(this.x - p.x) > p.r || Math.abs(this.z - p.z) > p.r) continue;
            const s = leafSurface(p, this.x, this.z);
            if (s > y && top >= s - reach) {
                y = s;
                sup = p;
            }
        }
        this.support = sup;
        return y;
    }

    /** Altura do apoio logo abaixo de (x, y, z) — usada pela sombra/marcador de pouso. */
    surfaceBelow(world, x, y, z) {
        let best = world.heightAt(x, z);
        for (const p of world.platforms) {
            if (Math.abs(x - p.x) > p.r || Math.abs(z - p.z) > p.r) continue;
            const s = leafSurface(p, x, z);
            if (s > best && s <= y + 0.08) best = s;
        }
        return best;
    }

    _stalk(world) {
        const c = world.climbs[0];
        return c && !c.locked ? c : null;
    }

    /**
     * Colisores: círculo { x, z, r } ou caixa orientada { box, x, z, hx, hz, cos, sin }.
     * `top` (opcional): só bloqueia quem está abaixo dessa altura (passar por cima de um degrau, por exemplo).
     */
    _blocked(x, z, world) {
        const r = PLAYER.radius;
        for (const c of world.colliders) {
            if (c.top != null && this.y > c.top) continue;
            const dx = x - c.x;
            const dz = z - c.z;
            if (c.box) {
                const lx = dx * c.cos - dz * c.sin;
                const lz = dx * c.sin + dz * c.cos;
                if (Math.abs(lx) < c.hx + r && Math.abs(lz) < c.hz + r) return true;
            } else if (dx * dx + dz * dz < (r + c.r) * (r + c.r)) return true;
        }
        return false;
    }

    sync() {
        this.root.position.set(this.x, this.y, this.z);
        this.root.rotation.y = this.yaw;
    }
}
