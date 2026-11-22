/**
 * Nico em terceira pessoa — movimento relativo à câmera orbital e o kit
 * de pulos da Cúpola 64 (simples, duplo, triplo, long jump, pound, dive).
 *
 * Animação procedural (sem clipes): cada junta recebe um ângulo-alvo por estado e
 * converge com amortecimento exponencial  θ ← θ + (alvo − θ)·(1 − e^(−18·dt)).
 * Ciclo de passada, fase φ (rad):
 *   coxa   = ∓A·sin φ                      A = 0,5 (andar) … 1,05 (correr)
 *   joelho = K·max(0, ±cos φ) + base       dobra na fase de balanço
 *   braço  = ±B·sin φ, cotovelo fecha até ~80° na corrida
 *   quadril sobe/desce |sin φ|, tronco inclina com a velocidade e rola nas curvas
 * Squash & stretch conserva volume: escala (s, 2 − s, s).
 */

import * as THREE from 'three';
import { PLAYER, CAMERA, ISLAND } from './config.js?v=13';
import { clamp, damp, wrapPi, lerpAngle } from './utils.js?v=13';
import { createNico } from './models.js?v=14';

/** Altura máxima (m) acima do último chão que os quiques na parede alcançam. */
const WALL_CLIMB = 9;

export class Player {
    constructor(scene) {
        const { root, parts } = createNico();
        this.root = root;
        this.parts = parts;
        scene.add(root);
        scene.add(parts.shadow);
        this._up = new THREE.Vector3(0, 1, 0);
        this._n = new THREE.Vector3();
        this.animT = 0;
        this.flip = 0;
        this.bank = 0;
        this.blink = 2;
        this.camK = 1;
        this.stepFlag = false;

        this.x = 0;
        this.y = 1;
        this.z = 12;
        this.vx = 0;
        this.vy = 0;
        this.vz = 0;
        this.facing = 0;
        this.yaw = 0;
        this.grounded = true;
        this.swimming = false;
        this.pounding = false;
        this.diving = false;
        this.inCannon = false;
        this.cannonT = 0;
        this.jumpCombo = 0;
        this.landTimer = 0;
        this.jumpHeld = false;
        this.invuln = 0;
        this.starPose = 0;
        this.hurtT = 0;
        this.walkPhase = 0;
        this.squash = 1;
        this.lives = 4;
        this.alive = true;
        /** Último chão firme (fora d'água), gravado a cada SAFE_EVERY s — é onde Nico volta ao cair. */
        this.safe = { x: 0, y: 1.6, z: 12 };
        this._safeT = 0;
        this.fell = false;
        this.groundY = 1;

        this.camYaw = Math.PI;
        this.camPhi = CAMERA.phi;
        this.camDist = CAMERA.distance;
        this._dYaw = Math.PI;
        this._dPhi = CAMERA.phi;
        this._dDist = CAMERA.distance;
        this._camPos = new THREE.Vector3();
        this._look = new THREE.Vector3();
        this._fwd = new THREE.Vector3();
        this._right = new THREE.Vector3();

        this.spawn();
    }

    spawn(world) {
        this.x = 0;
        this.z = 12;
        this.y = world ? world.groundAt(0, 12, 40) : 1.6;
        this.groundY = this.y;
        this.vx = this.vy = this.vz = 0;
        this.facing = 0;
        this.yaw = 0;
        this.grounded = true;
        this.swimming = false;
        this.pounding = false;
        this.diving = false;
        this.inCannon = false;
        this.jumpCombo = 0;
        this.invuln = 1.1;
        this.starPose = 0;
        this.hurtT = 0;
        this.alive = true;
        this.safe.x = this.x;
        this.safe.y = this.y;
        this.safe.z = this.z;
        this.fell = false;
        this.camYaw = this._dYaw = Math.PI;
        this.camPhi = this._dPhi = CAMERA.phi;
        this.root.visible = true;
        this.flip = 0;
        this.parts.tilt.rotation.set(0, 0, 0);
        this.sync();
    }

    get position() {
        return this.root.position;
    }

    hurt() {
        if (this.invuln > 0 || this.starPose > 0 || !this.alive) return false;
        this.lives -= 1;
        this.invuln = PLAYER.invuln;
        this.hurtT = 0.45;
        this.vy = 8;
        this.grounded = false;
        if (this.lives <= 0) {
            this.alive = false;
            this.lives = 0;
        }
        return true;
    }

    /**
     * @returns {{ jumped: boolean, landed: boolean, pounded: boolean, dived: boolean, cannon: boolean, swam: boolean }}
     */
    update(dt, input, world, camera) {
        const flags = { jumped: false, landed: false, pounded: false, dived: false, cannon: false, swam: false, splash: false, step: false };
        this.invuln = Math.max(0, this.invuln - dt);
        this.hurtT = Math.max(0, this.hurtT - dt);
        this.landTimer = Math.max(0, this.landTimer - dt);
        this.starPose = Math.max(0, this.starPose - dt);
        this._world = world;

        input.sample();
        this._camera(dt, input, world, camera);
        if (this.starPose > 0) {
            this._animate(dt, 0, true);
            this.sync();
            return flags;
        }

        if (this.inCannon) {
            this._cannonUpdate(dt, input, world, flags);
            this._animate(dt, 0, true);
            this.sync();
            return flags;
        }

        if (world.nearCannon(this.x, this.z) && this.grounded && input.consumeJump()) {
            this.inCannon = true;
            this.cannonT = 0;
            flags.cannon = true;
            this.sync();
            return flags;
        }

        const ax = input.axisX;
        const az = input.axisY;
        const mag = Math.hypot(ax, az);
        const crouch = input.crouchHeld;

        const sin = Math.sin(this.camYaw);
        const cos = Math.cos(this.camYaw);
        const fx = -sin;
        const fz = -cos;
        const rx = cos;
        const rz = -sin;

        let wishX = (fx * az + rx * ax);
        let wishZ = (fz * az + rz * ax);
        const wlen = Math.hypot(wishX, wishZ);
        if (wlen > 1) {
            wishX /= wlen;
            wishZ /= wlen;
        }

        const wasSwimming = this.swimming;
        this.swimming = world.isWater(this.x, this.z, this.y);
        if (this.swimming && !wasSwimming) flags.splash = true;
        if (this.swimming && this.y <= ISLAND.waterY + 1.05) {
            flags.swam = true;
            this._swim(dt, wishX, wishZ, mag, input, world, flags);
        } else {
            this._move(dt, wishX, wishZ, mag, crouch, input, world, flags);
        }

        this.yaw = lerpAngle(this.yaw, this.facing, 1 - Math.exp(-PLAYER.turn * dt));
        this._animate(dt, mag, crouch);
        if (this.stepFlag) {
            flags.step = true;
            this.stepFlag = false;
        }
        if (this.fell) {
            flags.fell = true;
            this.fell = false;
        }
        // chão firme: parado ou andando no chão, fora d'água, longe do fundo do desfiladeiro
        this._safeT -= dt;
        if (this.grounded && !this.swimming && !this.inCannon && this._safeT <= 0 && this.y > ISLAND.waterY + 0.25) {
            this._safeT = 0.5;
            this.safe.x = this.x;
            this.safe.y = this.y;
            this.safe.z = this.z;
        }
        this.sync();

        this.root.visible = this.invuln <= 0 || Math.sin(this.invuln * 28) > 0;
        return flags;
    }

    _move(dt, wishX, wishZ, mag, crouch, input, world, flags) {
        const running = mag > 0.72 && !crouch;
        const max = this.grounded
            ? (crouch ? PLAYER.walk * 0.45 : (running ? PLAYER.run : PLAYER.walk * (0.45 + mag * 0.55)))
            : PLAYER.run;
        const acc = this.grounded ? PLAYER.accel : PLAYER.airAccel;

        if (mag > 0.08 && !this.pounding) {
            this.vx += wishX * acc * dt;
            this.vz += wishZ * acc * dt;
            this.facing = Math.atan2(wishX, wishZ);
        }

        const spd = Math.hypot(this.vx, this.vz);
        if (this.grounded) {
            const fr = mag > 0.08 ? 2.2 : PLAYER.friction;
            const keep = Math.exp(-fr * dt);
            this.vx *= keep;
            this.vz *= keep;
            const n = Math.hypot(this.vx, this.vz);
            if (n > max) {
                this.vx *= max / n;
                this.vz *= max / n;
            }
        } else {
            const n = Math.hypot(this.vx, this.vz);
            if (n > PLAYER.run * 1.35) {
                this.vx *= PLAYER.run * 1.35 / n;
                this.vz *= PLAYER.run * 1.35 / n;
            }
        }

        if (this.pounding) {
            this.vx *= Math.exp(-10 * dt);
            this.vz *= Math.exp(-10 * dt);
        }

        const jump = input.consumeJump();
        if (jump && this.grounded) {
            const speed = Math.hypot(this.vx, this.vz);
            if (crouch && speed > 7.5) {
                this.vy = PLAYER.jumpLong;
                this.vx *= PLAYER.longBoost;
                this.vz *= PLAYER.longBoost;
                this.jumpCombo = 0;
            } else if (this.jumpCombo >= 2 && this.landTimer > 0 && speed > 6) {
                this.vy = PLAYER.jumpTri;
                this.jumpCombo = 0;
                this.flip = 1; // salto mortal no pulo triplo
            } else if (this.jumpCombo === 1 && this.landTimer > 0) {
                this.vy = PLAYER.jumpDbl;
                this.jumpCombo = 2;
            } else {
                this.vy = PLAYER.jump;
                this.jumpCombo = 1;
            }
            this.grounded = false;
            this.jumpHeld = true;
            flags.jumped = true;
            this.squash = 1.22;
        } else if (jump && !this.grounded && !this.pounding && !this.diving) {
            if (crouch) {
                this.pounding = true;
                this.vy = PLAYER.poundVy;
                flags.pounded = true;
            } else {
                this.diving = true;
                this.vy = PLAYER.diveY;
                this.vx += Math.sin(this.facing) * PLAYER.diveBoost;
                this.vz += Math.cos(this.facing) * PLAYER.diveBoost;
                flags.dived = true;
            }
        }

        if (!this.grounded && this.jumpHeld && this.vy > 0 && !input.jumpDown) {
            this.vy *= 0.48;
            this.jumpHeld = false;
        }
        if (this.grounded) this.jumpHeld = false;

        const g = this.vy < 0 ? PLAYER.fallGravity : PLAYER.gravity;
        this.vy -= (this.pounding ? g * 1.35 : g) * dt;

        let nx = this.x + this.vx * dt;
        let nz = this.z + this.vz * dt;
        const hit = world.collide(nx, nz, PLAYER.radius, this.y);
        if (hit.x !== nx || hit.z !== nz) {
            this.vx *= 0.35;
            this.vz *= 0.35;
            /* Quique na parede: subindo contra um sólido, Nico ganha outro impulso. Encadeado,
               ele escala — é assim que se chega ao telhado do castelo. Limite: no máximo
               WALL_CLIMB m acima do último chão (antes não havia teto: segurando contra uma
               árvore ou o canhão Nico subia até 150 m e despencava). */
            if (!this.grounded && this.vy > 2 && mag > 0.2 && this.y < this.groundY + WALL_CLIMB) {
                this.vy = PLAYER.jump * 0.82;
                this.facing += Math.PI;
                flags.jumped = true;
            }
        }
        nx = hit.x;
        nz = hit.z;

        // parede de rocha: no terreno (plataformas não contam), se a subida do passo tem
        // inclinação > 80° (razão 5,5:1) o movimento horizontal é barrado — ninguém escala
        // a gruta andando. A encosta mais íngreme da montanha fica em ~4,3:1 e continua livre.
        const terrainY = world.groundAt(nx, nz, -1e3);
        if (world.groundAt(nx, nz, this.y) === terrainY) {
            const rise = terrainY - this.y;
            const step = Math.hypot(nx - this.x, nz - this.z);
            if (step > 1e-5 && rise > 0.01 && rise > step * 5.5) {
                nx = this.x;
                nz = this.z;
                this.vx *= 0.2;
                this.vz *= 0.2;
            }
        }

        this.y += this.vy * dt;
        const ground = world.groundAt(nx, nz, this.y);
        if (this.vy <= 0 && this.y <= ground) {
            const wasAir = !this.grounded;
            this.y = ground;
            if (this.pounding) flags.pounded = true;
            this.vy = 0;
            this.grounded = true;
            this.groundY = ground;
            this.pounding = false;
            this.diving = false;
            if (wasAir) {
                flags.landed = true;
                this.landTimer = this.jumpCombo >= 2 ? PLAYER.tripleWindow : PLAYER.comboWindow;
                this.squash = 0.72;
            }
        } else if (this.y > ground + 0.04) {
            this.grounded = false;
        }

        this.x = nx;
        this.z = nz;
        if (this.y < ISLAND.fallY) this._fall();
    }

    _swim(dt, wishX, wishZ, mag, input, world, flags) {
        this.pounding = false;
        this.diving = false;
        // boia com o peito na lâmina d'água (pés 0,62 m abaixo do nível)
        this.y = damp(this.y, ISLAND.waterY - 0.62, 6, dt);
        this.grounded = false;
        this.groundY = ISLAND.waterY - 0.62;
        this.vy *= Math.exp(-4 * dt);
        if (mag > 0.08) {
            this.vx += wishX * 18 * dt;
            this.vz += wishZ * 18 * dt;
            this.facing = Math.atan2(wishX, wishZ);
        }
        this.vx *= Math.exp(-3.5 * dt);
        this.vz *= Math.exp(-3.5 * dt);
        const n = Math.hypot(this.vx, this.vz);
        if (n > PLAYER.swim) {
            this.vx *= PLAYER.swim / n;
            this.vz *= PLAYER.swim / n;
        }
        const hit = world.collide(this.x + this.vx * dt, this.z + this.vz * dt, PLAYER.radius, this.y);
        this.x = hit.x;
        this.z = hit.z;
        if (input.consumeJump()) {
            this.vy = PLAYER.jump * 0.72;
            this.grounded = false;
            this.swimming = false;
            flags.jumped = true;
        }
    }

    _cannonUpdate(dt, input, world, flags) {
        this.cannonT += dt;
        const c = world.cannonPos;
        this.x = c.x;
        this.z = c.z;
        this.y = c.y + 0.8;
        this.vx = this.vz = this.vy = 0;
        if (world.cannon) world.cannon.rotation.y += input.axisX * dt * 1.4;
        if (input.consumeJump() && this.cannonT > 0.2) {
            /* Tiro balístico que POUSA na ilha do céu. O tiro antigo (22 m/s na direção do
               alvo) subia no máximo ~4 m e caía a 13 m de distância: a ilha (y ≈ 15,9) era
               inalcançável pelo canhão. Agora:
                 ápice H = (topo do alvo + 2,5) − y0       vy0 = √(2·g_sobe·H)
                 T = vy0/g_sobe + √(2·2,5/g_desce)          v_xz = distância_xz / T          */
            const t = world.cannonTarget;
            const H = Math.max(1, t.y + 0.3 + 2.5 - this.y);
            const vy0 = Math.sqrt(2 * PLAYER.gravity * H);
            const T = vy0 / PLAYER.gravity + Math.sqrt((2 * 2.5) / PLAYER.fallGravity);
            const dx = t.x - this.x;
            const dz = t.z - this.z;
            this.vx = dx / T;
            this.vy = vy0;
            this.vz = dz / T;
            this.facing = Math.atan2(dx, dz);
            this.inCannon = false;
            this.grounded = false;
            flags.cannon = true;
            flags.jumped = true;
        }
    }

    /**
     * Caiu da ilha (y < ISLAND.fallY): modo família — não perde vida; volta ao último
     * chão firme gravado, piscando (invulnerável) por 1,5 s, com a câmera onde estava.
     */
    _fall() {
        this.x = this.safe.x;
        this.z = this.safe.z;
        this.y = this.safe.y + 0.05;
        this.vx = this.vy = this.vz = 0;
        this.grounded = true;
        this.groundY = this.y;
        this.pounding = this.diving = false;
        this.invuln = Math.max(this.invuln, 1.5);
        this.fell = true;
    }

    /**
     * Câmera orbital com colisão. A posição desejada é esférica em torno do Nico;
     * depois marchamos do alvo até a câmera em 18 passos e, se algum ponto cair abaixo
     * de (piso + folga), a distância é encurtada até ali. O encurtamento é rápido
     * (λ = 22) e o retorno é lento (λ = 2,5) para a câmera não "pipocar".
     */
    _camera(dt, input, world, camera) {
        const look = input.consumeLook();
        this._dYaw -= look.dx * 0.005 + input.camX * CAMERA.rotate * dt;
        this._dPhi = clamp(this._dPhi + look.dy * 0.0035, CAMERA.phiMin, CAMERA.phiMax);
        this._dDist = clamp(this._dDist + look.zoom * 0.012, CAMERA.minDistance, CAMERA.maxDistance);

        this.camYaw = damp(this.camYaw, this._dYaw, CAMERA.lag, dt);
        this.camPhi = damp(this.camPhi, this._dPhi, CAMERA.lag, dt);
        this.camDist = damp(this.camDist, this._dDist, 6, dt);

        const lx = this.x;
        const ly = this.y + 1.15 + (this.swimming ? 0.25 : 0);
        const lz = this.z;
        const dist = this.camDist;
        const ox = Math.sin(this.camYaw) * Math.sin(this.camPhi) * dist;
        const oy = Math.cos(this.camPhi) * dist + CAMERA.height - 1.15;
        const oz = Math.cos(this.camYaw) * Math.sin(this.camPhi) * dist;

        const clr = CAMERA.clearance;
        let free = 1;
        const N = 18;
        for (let i = 2; i <= N; i++) {
            const t = i / N;
            if (ly + oy * t < world.cameraFloor(lx + ox * t, lz + oz * t) + clr) {
                free = (i - 1) / N;
                break;
            }
        }
        free = Math.max(free, 0.16);
        this.camK = damp(this.camK, free, free < this.camK ? 22 : 2.5, dt);
        const k = Math.min(this.camK, free + 0.06);

        let cx = lx + ox * k;
        let cy = ly + oy * k;
        let cz = lz + oz * k;
        const floor = world.cameraFloor(cx, cz) + clr;
        if (cy < floor) cy = floor;
        this._camPos.set(cx, cy, cz);
        this._look.set(lx, ly, lz);
        camera.position.copy(this._camPos);
        camera.lookAt(this._look);
    }

    /** Aproxima a rotação `axis` de `obj` do alvo (amortecimento exponencial). */
    _j(obj, axis, target, dt, rate = 18) {
        obj.rotation[axis] = damp(obj.rotation[axis], target, rate, dt);
    }

    _animate(dt, mag, crouch) {
        const P = this.parts;
        this.animT += dt;
        const t = this.animT;
        this.squash = damp(this.squash, 1, 10, dt);
        const sp = Math.hypot(this.vx, this.vz);
        const run = clamp((sp - 2) / (PLAYER.run - 2), 0, 1);
        const moving = this.grounded && sp > 0.6 && mag > 0.08;

        // fase da passada: frequência cresce com a velocidade (passos mais longos ao correr)
        const prev = this.walkPhase;
        if (moving) this.walkPhase += dt * (5.2 + sp * 0.82);
        const ph = this.walkPhase;
        // um pé toca o chão a cada meia volta → poeira ao correr
        if (moving && run > 0.55 && Math.floor(ph / Math.PI) !== Math.floor(prev / Math.PI)) this.stepFlag = true;
        const s = Math.sin(ph);
        const c = Math.cos(ph);

        // ---- alvos (pose neutra)
        let hipY = 0.47;
        let lean = 0;        // inclinação do corpo (root.x)
        let spine = 0;       // tronco (hips.x)
        let twist = 0;       // giro do tronco (hips.y)
        let headX = 0;
        let headY = 0;
        let thL = 0, thR = 0, knL = 0, knR = 0, ftL = 0, ftR = 0;
        let shLx = 0, shRx = 0, shLz = -0.14, shRz = 0.14, elL = -0.18, elR = -0.18;
        let tiltX = 0;
        let rate = 18;

        if (this.starPose > 0) {
            // "peguei!": braço direito no alto, esquerdo na cintura, pernas abertas
            shRz = 2.75; shRx = -0.2; elR = -0.1;
            shLz = -0.75; elL = -1.5;
            thL = -0.12; thR = 0.12;
            headX = -0.25;
        } else if (this.inCannon) {
            hipY = 0.3; thL = thR = -1.5; knL = knR = 2.1; spine = 0.4; shLx = shRx = -0.6; elL = elR = -1.2;
        } else if (this.swimming) {
            // nado de peito: corpo deitado, braços varrem, pernas batem
            const k = Math.sin(t * 5.2);
            tiltX = 1.12;
            headX = -0.85;
            shLx = shRx = -2.5 + k * 0.5;
            shLz = -0.5 - k * 0.55; shRz = 0.5 + k * 0.55;
            elL = elR = -0.35 - Math.max(0, -k) * 0.7;
            thL = k * 0.5; thR = -k * 0.5; knL = 0.35 + Math.max(0, k) * 0.5; knR = 0.35 + Math.max(0, -k) * 0.5;
            rate = 10;
        } else if (this.diving) {
            tiltX = 1.25;
            shLx = shRx = -2.9; shLz = -0.2; shRz = 0.2; elL = elR = -0.05;
            thL = 0.12; thR = -0.08; knL = knR = 0.15; headX = -0.7;
        } else if (this.pounding) {
            // sentada no ar: joelhos ao peito, braços abertos
            thL = thR = -1.55; knL = knR = 1.1; spine = -0.15;
            shLz = -1.9; shRz = 1.9; elL = elR = -0.3; headX = 0.2;
        } else if (!this.grounded) {
            if (this.vy > 1.5) {
                // subida: punho direito no alto, joelho esquerdo puxado
                shRz = 2.6; shRx = -0.25; elR = -0.25;
                shLz = -0.7; shLx = 0.5; elL = -0.9;
                thL = -1.15; knL = 1.55; thR = 0.28; knR = 0.25; ftR = 0.5;
                spine = -0.08;
            } else {
                // queda: braços abertos balançando, pernas soltas
                const w = Math.sin(t * 14) * 0.12;
                shLz = -2.0 + w; shRz = 2.0 + w; elL = elR = -0.35;
                thL = -0.45 + w; thR = 0.15 - w; knL = 0.75; knR = 0.5;
                headX = 0.12;
            }
        } else if (crouch) {
            // agachado (anda de cócoras se houver stick)
            hipY = 0.3;
            spine = 0.42;
            thL = -1.35 - s * 0.25 * mag; thR = -1.35 + s * 0.25 * mag;
            knL = knR = 2.05;
            ftL = ftR = -0.7;
            shLx = shRx = -0.55; elL = elR = -1.25;
            headX = -0.3;
        } else if (moving) {
            const A = 0.5 + run * 0.55;
            const K = 0.75 + run * 0.95;
            const B = 0.45 + run * 0.6;
            thL = -s * A - run * 0.12;
            thR = s * A - run * 0.12;
            knL = K * Math.max(0, c) + 0.12 + run * 0.2;
            knR = K * Math.max(0, -c) + 0.12 + run * 0.2;
            ftL = -thL * 0.35;
            ftR = -thR * 0.35;
            shLx = s * B; shRx = -s * B;
            elL = -(0.3 + run * 1.05) - Math.max(0, -s) * 0.3;
            elR = -(0.3 + run * 1.05) - Math.max(0, s) * 0.3;
            shLz = -0.14 - run * 0.1; shRz = 0.14 + run * 0.1;
            hipY = 0.47 - Math.abs(s) * (0.018 + run * 0.03) + run * 0.01;
            twist = s * (0.1 + run * 0.14);
            lean = 0.05 + run * 0.2;
            headX = -run * 0.12;
            headY = -twist * 0.7;
        } else {
            // parado: respira, olha em volta, balança o peso
            const b = Math.sin(t * 1.9);
            hipY = 0.47 + b * 0.006;
            spine = b * 0.012;
            shLz = -0.16 - b * 0.02; shRz = 0.16 + b * 0.02;
            elL = elR = -0.22;
            headY = Math.sin(t * 0.47) * 0.32 * Math.max(0, Math.sin(t * 0.21));
            headX = Math.sin(t * 0.33) * 0.05;
            thL = 0.03; thR = -0.03;
            rate = 9;
        }

        // ---- aplica
        const j = (o, a, v) => this._j(o, a, v, dt, rate);
        j(P.legL.hip, 'x', thL); j(P.legR.hip, 'x', thR);
        j(P.legL.knee, 'x', knL); j(P.legR.knee, 'x', knR);
        j(P.legL.foot, 'x', ftL); j(P.legR.foot, 'x', ftR);
        j(P.armL.shoulder, 'x', shLx); j(P.armR.shoulder, 'x', shRx);
        j(P.armL.shoulder, 'z', shLz); j(P.armR.shoulder, 'z', shRz);
        j(P.armL.elbow, 'x', elL); j(P.armR.elbow, 'x', elR);
        j(P.hips, 'x', spine); j(P.hips, 'y', twist);
        j(P.head, 'x', headX); j(P.head, 'y', headY);
        P.hips.position.y = damp(P.hips.position.y, hipY, 16, dt);

        // salto mortal do pulo triplo: uma volta completa enquanto sobe e cai
        if (this.flip > 0) {
            this.flip = this.grounded ? 0 : Math.max(0, this.flip - dt / 0.82);
            tiltX = (1 - this.flip) * Math.PI * 2;
            P.tilt.rotation.x = this.flip > 0 ? tiltX : 0;
        } else {
            P.tilt.rotation.x = damp(P.tilt.rotation.x, tiltX, 12, dt);
        }
        P.tilt.scale.set(this.squash, 2 - this.squash, this.squash);

        // piscar: fecha por ~0,11 s a cada 2–5 s
        this.blink -= dt;
        if (this.blink < -0.11) this.blink = 2 + Math.random() * 3;
        P.eyes.scale.y = damp(P.eyes.scale.y, this.blink < 0 ? 0.08 : 1, 40, dt);

        // inclinação: para a frente com a velocidade, rolagem para dentro da curva
        const turn = wrapPi(this.facing - this.yaw);
        this.bank = damp(this.bank, this.grounded ? clamp(turn * sp * 0.045, -0.4, 0.4) : 0, 8, dt);
        if (this.starPose > 0) {
            this.root.rotation.y += dt * 4.5;
            this.root.rotation.x = damp(this.root.rotation.x, 0, 12, dt);
            this.root.rotation.z = damp(this.root.rotation.z, 0, 12, dt);
        } else {
            this.root.rotation.y = this.yaw;
            this.root.rotation.x = damp(this.root.rotation.x, lean + (this.hurtT > 0 ? -0.5 : 0), 10, dt);
            this.root.rotation.z = -this.bank;
        }

        // sombra de contato: gruda no chão sob o Nico, encolhe e clareia com a altura
        const world = this._world;
        if (world) {
            const g = world.groundAt(this.x, this.z, this.y + 0.05);
            const h = Math.max(0, this.y - g);
            const sh = P.shadow;
            sh.visible = this.root.visible && !this.swimming && h < 9;
            sh.position.set(this.x, g + 0.035, this.z);
            sh.scale.setScalar(clamp(0.8 - h * 0.05, 0.35, 0.8));
            sh.material.opacity = clamp(0.85 - h * 0.09, 0.15, 0.85);
            // deita a sombra na encosta (só no terreno; plataformas são planas)
            if (Math.abs(g - world.groundAt(this.x, this.z, -100)) < 0.02) {
                world.normalAt(this.x, this.z, this._n);
                sh.quaternion.setFromUnitVectors(this._up, this._n);
            } else {
                sh.quaternion.identity();
            }
        }
    }

    sync() {
        this.root.position.set(this.x, this.y, this.z);
    }

    celebrate() {
        this.starPose = 2.4;
        this.vx = this.vz = 0;
        this.vy = 2.2;
    }
}
