/**
 * Jurassic — fauna: seis espécies com esqueleto (`shared/gfx/creature.js`) e
 * comportamento próprio.
 *
 * Cada animal tem dois níveis de detalhe (perto/longe) trocados pela distância
 * à câmera, com histerese de 15 %. A marcha usa a velocidade real do corpo
 * (m/s) para o pé não patinar, e `groundFn` assenta cada pata no relevo.
 *
 * Comportamento por espécie:
 *   Braquiossauro  manada no lago: anda até uma frondosa e come na copa (olhar
 *                  para o alto + mandíbula), depois desce à margem e bebe. O
 *                  filhote segue um adulto.
 *   Tricerátops    pastam no prado, andam poucos metros entre uma moita e outra;
 *                  o filhote trota em volta da mãe. Jipe perto → cabeça erguida.
 *   Estegossauro   fila indiana ao longo da crista, 10 m entre um e outro; nas
 *                  pontas param, pastam e voltam.
 *   Velociraptor   bando: corre até um ponto da clareira, para em alerta, fareja.
 *                  Jipe a menos de 15 m → dispara para o lado oposto.
 *   Tiranossauro   patrulha o paddock, ruge, acompanha o jipe por dentro da
 *                  cerca. Se o jipe para perto do vão rompido (ou entra), ele
 *                  sai pelo vão e persegue: a menos de 5,4 m, fim de turno.
 *   Pteranodonte   planam em órbita em torno do farol, batendo asas em rajadas.
 *
 * Passo pesado: quando um pé de animal grande toca o chão (altura do osso do pé
 * cruza um limiar com histerese) dispara `onStep(pos, peso)` — poeira, baque e
 * tremor de câmera com força  peso / (1 + (d/12)²).
 */

import * as THREE from 'three';
import { WORLD, SPECIES } from './config.js';
import { clamp, damp, seeded } from '../../shared/gfx/core.js';
import { createCreature } from '../../shared/gfx/creature.js';
import { wrapPi } from './utils.js';

const TAU = Math.PI * 2;
const _v = new THREE.Vector3();
const nextTask = () => new Promise((r) => setTimeout(r, 0));

/** Estado reutilizado passado a creature.update (sem alocação por quadro). */
const makeAnim = (groundFn) => ({ mode: 'idle', speed: 0, lookAt: null, groundFn, turn: 0, jaw: undefined });

class Dino {
    /**
     * @param {object} o  { id, preset, x, z, yaw, scale, age, seed, weight (0 = sem passo pesado), radius }
     */
    constructor(o, world, quality) {
        this.id = o.id;
        this.world = world;
        this.preset = o.preset;
        this.weight = o.weight ?? 0;
        this.flyer = !!o.flyer;
        this.rnd = seeded(o.seed * 131 + 7);
        const base = { scale: o.scale ?? 1, age: o.age ?? 1, seed: o.seed, ...(o.opts || {}) };
        this.near = createCreature(o.preset, { ...base, detail: quality.dinoNear });
        this.far = createCreature(o.preset, { ...base, detail: quality.dinoFar });
        this.lods = [this.near, this.far];
        this.active = this.far;
        this.near.object.visible = false;
        this.nearDist = quality.nearDist * (o.lodScale ?? 1);
        this.position = new THREE.Vector3(o.x, 0, o.z);
        this.position.y = this.flyer ? o.y : world.heightAt(o.x, o.z);
        this.yaw = o.yaw ?? 0;
        this.pitch = 0;
        this.roll = 0;
        this.speed = 0;
        this.length = this.near.length;
        this.height = this.near.height;
        this.focus = new THREE.Vector3();
        this.look = new THREE.Vector3();
        this.lookOn = 0;
        this.anim = makeAnim(world.heightAt);
        this.timer = this.rnd() * 6;
        this.state = 'idle';
        this.target = { x: o.x, z: o.z };
        this.collider = this.flyer ? null : world.addCollider(o.x, o.z, o.radius ?? this.length * 0.14, false);
        // pés acompanhados para o passo pesado
        this.feet = [];
        if (this.weight > 0) {
            for (const lod of this.lods) {
                lod.feet = ['footL', 'footR', 'handL', 'handR'].map((n) => lod.bones[n]).filter(Boolean)
                    .map((bone) => ({ bone, min: Infinity, down: true }));
            }
        }
        for (const lod of this.lods) {
            lod.object.traverse((m) => {
                if (m.isMesh) {
                    m.castShadow = true;
                    m.receiveShadow = true;
                }
            });
        }
        this._apply();
    }

    addTo(scene) {
        scene.add(this.near.object, this.far.object);
    }

    _apply() {
        const o = this.active.object;
        o.position.copy(this.position);
        o.rotation.set(this.pitch, this.yaw, this.roll, 'YXZ');
        o.updateMatrixWorld(true);
        this.focus.set(this.position.x, this.position.y + (this.flyer ? 0 : this.height * 0.62), this.position.z);
        if (this.collider) {
            this.collider.x = this.position.x;
            this.collider.z = this.position.z;
        }
    }

    /** Troca de LOD com histerese; copia a fase da marcha para não dar tranco. */
    _lod(camDist) {
        const wantNear = camDist < (this.active === this.near ? this.nearDist * 1.15 : this.nearDist);
        const next = wantNear ? this.near : this.far;
        if (next === this.active) return;
        const a = this.active.state;
        const b = next.state;
        if (a && b) {
            b.mode = a.mode;
            b.phase = a.phase;
            b.time = a.time;
            b.amount = a.amount;
            b.blend = 1;
            b.lookYaw = a.lookYaw;
            b.lookPitch = a.lookPitch;
        }
        this.active.object.visible = false;
        next.object.visible = true;
        this.active = next;
    }

    /**
     * Anda em direção a (tx, tz) na andadura `mode`. Devolve a distância restante.
     *   guinada: Δψ limitado a `turnRate` rad/s; a velocidade cai quando o alvo está de lado
     *   v = v_marcha · k · clamp(1 − |Δψ|/1,6; 0,25; 1)
     */
    moveTo(dt, tx, tz, mode = 'walk', k = 1, turnRate = 0.9) {
        const dx = tx - this.position.x;
        const dz = tz - this.position.z;
        const dist = Math.hypot(dx, dz);
        const want = Math.atan2(dx, dz);
        const dy = wrapPi(want - this.yaw);
        const step = clamp(dy, -turnRate * dt, turnRate * dt);
        this.yaw = wrapPi(this.yaw + step);
        const gait = this.active.gaits[mode] || this.active.gaits.walk;
        const v = gait.speed * k * clamp(1 - Math.abs(dy) / 1.6, 0.25, 1);
        this.speed = damp(this.speed, v, 3, dt);
        this.position.x += Math.sin(this.yaw) * this.speed * dt;
        this.position.z += Math.cos(this.yaw) * this.speed * dt;
        this.position.y = this.world.heightAt(this.position.x, this.position.z);
        this.anim.mode = mode;
        this.anim.speed = this.speed;
        this.anim.turn = clamp(dy * 1.2, -1, 1);
        return dist;
    }

    /** Fica parado no modo dado (idle, eat, drink, alert, roar…), virando devagar para `faceYaw`. */
    stay(dt, mode = 'idle', faceYaw = null, turnRate = 0.5) {
        this.speed = damp(this.speed, 0, 5, dt);
        if (faceYaw !== null) {
            const dy = wrapPi(faceYaw - this.yaw);
            this.yaw = wrapPi(this.yaw + clamp(dy, -turnRate * dt, turnRate * dt));
        }
        this.position.y = this.world.heightAt(this.position.x, this.position.z);
        this.anim.mode = mode;
        this.anim.speed = 0;
        this.anim.turn = 0;
    }

    /** Olha para um ponto do mundo (ou para a frente, com `on` = false). */
    lookTo(point, on) {
        if (on && point) {
            this.look.copy(point);
            this.anim.lookAt = this.look;
        } else this.anim.lookAt = null;
    }

    /** Comportamento da espécie: sobrescrito em cada instância. */
    think() {}

    update(dt, t, ctx) {
        const camDist = this.position.distanceTo(ctx.camera.position);
        this._lod(camDist);
        this.anim.jaw = undefined;
        this.think(dt, t, ctx);
        this._apply();
        // muito longe e fora do quadro: só reposiciona (o esqueleto fica congelado)
        if (camDist > 190) return;
        this.active.update(dt, this.anim);
        if (this.weight > 0 && camDist < 110) this._steps(ctx);
    }

    /** Detecta o toque de cada pé no chão (histerese sobre a altura do osso). */
    _steps(ctx) {
        const feet = this.active.feet;
        const hip = this.active.hipHeight || this.height * 0.4;
        for (let i = 0; i < feet.length; i++) {
            const f = feet[i];
            f.bone.getWorldPosition(_v);
            const rel = _v.y - this.world.heightAt(_v.x, _v.z);
            if (rel < f.min) f.min = rel;
            if (f.down) {
                if (rel > f.min + hip * 0.11) f.down = false;
            } else if (rel < f.min + hip * 0.045) {
                f.down = true;
                if (this.speed > 0.15) ctx.onStep?.(this, _v, this.weight);
            }
        }
    }
}

// ─────────────────────────────── comportamentos ───────────────────────────────

/** Ponto da margem do lago na direção `ang`: primeiro raio em que o chão sai 0,25 m da água. */
function shorePoint(world, ang) {
    const L = WORLD.lake;
    for (let r = L.radius * 0.5; r < L.radius * 1.5; r += 0.5) {
        const x = L.x + Math.cos(ang) * r;
        const z = L.z + Math.sin(ang) * r;
        if (world.heightAt(x, z) > world.lakeLevel + 0.25) return { x, z, r };
    }
    return { x: L.x + Math.cos(ang) * L.radius, z: L.z + Math.sin(ang) * L.radius, r: L.radius };
}

function brachioBrain(d, world, stations, start) {
    let si = start;
    d.state = 'walk';
    d.think = (dt, t, ctx) => {
        const s = stations[si];
        const nearJeep = ctx.jeepDist(d) < 34;
        if (d.state === 'walk') {
            const left = d.moveTo(dt, s.x, s.z, 'walk', 1, 0.32);
            d.lookTo(ctx.jeepHead, nearJeep);
            if (left < 2.2) {
                d.state = 'act';
                d.timer = 16 + d.rnd() * 14;
            }
        } else {
            d.stay(dt, s.kind === 'drink' ? 'drink' : 'idle', s.face, 0.3);
            if (s.kind === 'browse') {
                // come na copa: olha para um ponto que passeia entre os galhos e mastiga
                _v.set(s.tx + Math.sin(t * 0.23 + si) * 2.2, s.ty + Math.sin(t * 0.31) * 1.6, s.tz + Math.cos(t * 0.19 + si) * 2.2);
                d.lookTo(_v, true);
                d.anim.jaw = 0.25 + 0.25 * Math.sin(t * 5.2) * (Math.sin(t * 0.7) > -0.3 ? 1 : 0);
            } else d.lookTo(null, false);
            d.timer -= dt;
            if (d.timer <= 0) {
                si = (si + 1 + Math.floor(d.rnd() * (stations.length - 1))) % stations.length;
                d.state = 'walk';
            }
        }
    };
}

/** Filhote: mantém-se a `gap` m atrás/ao lado do adulto; quando o adulto para, pasta ou brinca. */
function followBrain(d, parent, gap, side) {
    d.think = (dt, t, ctx) => {
        const ox = parent.position.x - Math.sin(parent.yaw) * gap + Math.cos(parent.yaw) * side;
        const oz = parent.position.z - Math.cos(parent.yaw) * gap - Math.sin(parent.yaw) * side;
        const dist = Math.hypot(ox - d.position.x, oz - d.position.z);
        d.timer -= dt;
        if (d.state === 'play') {
            if (d.moveTo(dt, d.target.x, d.target.z, 'trot', 0.8, 1.8) < 1.5 || d.timer <= 0) d.state = 'idle';
        } else if (dist > 3.2 || (d.state === 'go' && dist > 1.2)) {
            d.state = 'go';
            d.moveTo(dt, ox, oz, dist > 9 ? 'trot' : 'walk', 1, 1.4);
        } else {
            d.state = 'idle';
            d.stay(dt, Math.sin(t * 0.21 + side) > 0 ? 'eat' : 'idle', parent.yaw + side * 0.2, 0.8);
            if (d.timer <= 0) {
                d.timer = 7 + d.rnd() * 9;
                if (d.rnd() < 0.45) {
                    const a = d.rnd() * TAU;
                    d.target.x = parent.position.x + Math.cos(a) * (gap + 3);
                    d.target.z = parent.position.z + Math.sin(a) * (gap + 3);
                    d.state = 'play';
                    d.timer = 5;
                }
            }
        }
        d.lookTo(ctx.jeepHead, ctx.jeepDist(d) < 20);
    };
}

function grazeBrain(d, home, radius) {
    d.state = 'graze';
    d.think = (dt, t, ctx) => {
        const jd = ctx.jeepDist(d);
        d.timer -= dt;
        if (jd < 15) {
            // cabeça erguida, corpo virando de frente para o jipe (babado e chifres apontados)
            d.stay(dt, 'alert', Math.atan2(ctx.jeep.x - d.position.x, ctx.jeep.z - d.position.z), 0.7);
            d.lookTo(ctx.jeepHead, true);
            return;
        }
        d.lookTo(ctx.jeepHead, jd < 26 && d.state !== 'graze');
        if (d.state === 'walk') {
            if (d.moveTo(dt, d.target.x, d.target.z, 'walk', 1, 0.6) < 1.8 || d.timer < -20) {
                d.state = 'graze';
                d.timer = 9 + d.rnd() * 12;
            }
        } else {
            d.stay(dt, 'eat');
            if (d.timer <= 0) {
                const a = d.rnd() * TAU;
                const r = Math.sqrt(d.rnd()) * radius;
                d.target.x = home.x + Math.cos(a) * r;
                d.target.z = home.z + Math.sin(a) * r;
                d.state = 'walk';
                d.timer = 0;
            }
        }
    };
}

/** Fila indiana ao longo de um traçado (createCourse). `herd` guarda { s, dir, wait } compartilhado. */
function fileBrain(d, course, herd, index, gap) {
    const p = new THREE.Vector3();
    d.think = (dt, t, ctx) => {
        const len = course.length;
        // posto na fila: o guia é quem vai na frente no sentido da marcha
        const rank = herd.dir > 0 ? index : herd.count - 1 - index;
        const own = clamp(herd.s - rank * gap * herd.dir, 3, len - 3);
        course.pointAt(own / len, p);
        const dist = Math.hypot(p.x - d.position.x, p.z - d.position.z);
        d.lookTo(ctx.jeepHead, ctx.jeepDist(d) < 26);
        if (herd.wait > 0) {
            if (dist > 2.5) d.moveTo(dt, p.x, p.z, 'walk', 1, 0.6);
            else d.stay(dt, 'eat');
            return;
        }
        if (dist > 1.2) d.moveTo(dt, p.x, p.z, 'walk', dist > 6 ? 1.15 : 0.9, 0.7);
        else d.stay(dt, 'idle');
    };
}

function raptorBrain(d, pack, index) {
    const off = [[0, 0], [2.4, -2.2], [-2.6, -2.8], [0.8, -5.2], [-1.6, -6.4]][index % 5];
    d.think = (dt, t, ctx) => {
        // posição na formação, girada pelo rumo do bando
        const c = Math.cos(pack.yaw);
        const s = Math.sin(pack.yaw);
        const tx = pack.x + off[0] * c + off[1] * s;
        const tz = pack.z - off[0] * s + off[1] * c;
        const dist = Math.hypot(tx - d.position.x, tz - d.position.z);
        const jd = ctx.jeepDist(d);
        if (dist > 2.2 || (d.state === 'run' && dist > 0.9)) {
            d.state = 'run';
            d.moveTo(dt, tx, tz, dist > 7 || pack.flee ? 'run' : 'trot', pack.flee ? 1.1 : 0.9, 3.2);
            d.lookTo(null, false);
        } else {
            d.state = 'stop';
            const facing = jd < 46 ? Math.atan2(ctx.jeep.x - d.position.x, ctx.jeep.z - d.position.z) : pack.yaw + Math.sin(t * 0.3 + index * 2) * 0.9;
            const mode = jd < 46 || Math.sin(t * 0.37 + index * 1.7) > 0.1 ? 'alert' : Math.sin(t * 0.23 + index) > 0.4 ? 'eat' : 'idle';
            d.stay(dt, mode, facing, 2.2);
            d.lookTo(ctx.jeepHead, jd < 46);
        }
    };
}

/** Elipse do paddock: < 1 dentro. */
const inPaddock = (x, z) => Math.hypot((x - WORLD.paddock.x) / WORLD.paddock.rx, (z - WORLD.paddock.z) / WORLD.paddock.rz);

function rexBrain(d, world) {
    const P = WORLD.paddock;
    d.state = 'patrol';
    d.caught = false;
    d.roarCool = 8;
    const pick = () => {
        const a = d.rnd() * TAU;
        const r = 0.2 + d.rnd() * 0.5;
        d.target.x = P.x + Math.cos(a) * P.rx * r;
        d.target.z = P.z + Math.sin(a) * P.rz * r;
    };
    pick();
    d.think = (dt, t, ctx) => {
        const gap = world.paddockGap;
        const jx = ctx.jeep.x;
        const jz = ctx.jeep.z;
        const jd = ctx.jeepDist(d);
        const jeepIn = inPaddock(jx, jz) < 0.96;
        const rexIn = inPaddock(d.position.x, d.position.z) < 1;
        const gapDist = Math.hypot(jx - gap.x, jz - gap.z);
        d.roarCool -= dt;
        d.timer -= dt;
        d.lookTo(ctx.jeepHead, jd < 60 && d.state !== 'roar');

        // a perseguição começa quando há caminho livre: jipe dentro do paddock ou parado junto ao vão
        const lure = ctx.playing && (jeepIn || (gapDist < 11 && jd < 45));
        // depois de desistir, o rex só volta a caçar após 6 s (dá tempo de fugir sem ficar preso num laço)
        d.calm = Math.max(0, (d.calm || 0) - dt);
        if (d.state !== 'chase' && lure && d.calm <= 0) {
            d.state = 'chase';
            ctx.onRoar?.(d, 1.3);
            d.timer = 1.1;
            d.chaseT = 0;
            d.roarCool = 9;
        }

        if (d.state === 'chase') {
            if (d.timer > 0) {
                d.stay(dt, 'roar', Math.atan2(jx - d.position.x, jz - d.position.z), 1.6);
                return;
            }
            // dentro e o jipe fora: primeiro o vão, depois o jipe
            const viaGap = rexIn && !jeepIn && Math.hypot(d.position.x - gap.x, d.position.z - gap.z) > 3.5;
            const tx = viaGap ? gap.x : jx;
            const tz = viaGap ? gap.z : jz;
            d.moveTo(dt, tx, tz, 'run', 1, 1.5);
            d.chaseT = (d.chaseT || 0) + dt;
            if (jd < 4.8 && ctx.playing) d.caught = true;
            // perseguição curta (≤ 10 s): assusta, mas quem acelera para longe escapa
            if (jd > 62 || !ctx.playing || d.chaseT > 10) {
                d.state = 'return';
                d.timer = 0;
                d.calm = 6;
            }
            return;
        }
        if (d.state === 'return') {
            const out = !rexIn;
            const left = d.moveTo(dt, out ? gap.x + (P.x - gap.x) * 0.2 : P.x, out ? gap.z + (P.z - gap.z) * 0.2 : P.z, 'walk', 1.1, 0.9);
            if (!out && left < P.rx * 0.6) {
                d.state = 'patrol';
                pick();
            }
            return;
        }
        if (d.state === 'roar') {
            d.stay(dt, 'roar', Math.atan2(jx - d.position.x, jz - d.position.z), 1.2);
            if (d.timer <= 0) d.state = 'patrol';
            return;
        }
        if (jd < 40 && d.roarCool <= 0) {
            // reage ao jipe: vira e ruge
            d.state = 'roar';
            d.timer = 2.6;
            d.roarCool = 16 + d.rnd() * 10;
            ctx.onRoar?.(d, 1);
            return;
        }
        if (jd < 46) {
            // acompanha o jipe por dentro da cerca: alvo = ponto da elipse (78 %) na direção do jipe
            const a = Math.atan2((jz - P.z) / P.rz, (jx - P.x) / P.rx);
            d.target.x = P.x + Math.cos(a) * P.rx * 0.78;
            d.target.z = P.z + Math.sin(a) * P.rz * 0.78;
            if (d.moveTo(dt, d.target.x, d.target.z, 'walk', 1.15, 0.9) < 2.5) {
                d.stay(dt, 'alert', Math.atan2(jx - d.position.x, jz - d.position.z), 1.0);
            }
            return;
        }
        // patrulha
        if (d.state === 'pause') {
            d.stay(dt, d.timer > 2 ? 'alert' : 'idle');
            if (d.timer <= 0) {
                d.state = 'patrol';
                pick();
            }
        } else if (d.moveTo(dt, d.target.x, d.target.z, 'walk', 1, 0.7) < 2.5) {
            d.state = 'pause';
            d.timer = 3 + d.rnd() * 5;
            if (d.roarCool <= 0 && d.rnd() < 0.5) {
                d.state = 'roar';
                d.timer = 2.6;
                d.roarCool = 22 + d.rnd() * 12;
                ctx.onRoar?.(d, 0.7);
            }
        }
    };
}

/**
 * Pteranodonte em órbita elíptica:
 *   p(φ) = c + (a·cos φ, h + 2,5·sin(0,37·φ + f), b·sin φ),  φ' = v / raio médio
 *   rolagem para dentro da curva ≈ atan(v² / (g·r)) limitada a 0,5 rad
 * Bate asas em rajadas (2,5 s a cada 7–11 s) e quando ganha altura; no resto, plana.
 */
function pteraBrain(d, center, o) {
    let phi = o.phase;
    let flap = 0;
    let next = 3 + d.rnd() * 6;
    d.think = (dt) => {
        const v = o.speed;
        const r = (o.a + o.b) / 2;
        phi += (v / r) * dt * o.dir;
        const y = center.y + o.h + Math.sin(phi * 0.37 + o.f) * 2.5;
        const x = center.x + o.ox + Math.cos(phi) * o.a;
        const z = center.z + o.oz + Math.sin(phi) * o.b;
        const climb = (y - d.position.y) / Math.max(dt, 1e-3);
        d.yaw = Math.atan2(x - d.position.x, z - d.position.z);
        d.position.set(x, y, z);
        d.pitch = damp(d.pitch, clamp(-climb * 0.12, -0.3, 0.3), 3, dt);
        d.roll = damp(d.roll, -o.dir * clamp(Math.atan((v * v) / (9.81 * r)), 0, 0.5), 2, dt);
        next -= dt;
        if (next <= 0) {
            flap = 2.5;
            next = 7 + d.rnd() * 4;
        }
        flap -= dt;
        d.anim.mode = flap > 0 || climb > 0.9 ? 'fly' : 'glide';
        d.speed = v;
    };
}

// ─────────────────────────────────── elenco ───────────────────────────────────

/**
 * Cria toda a fauna. Devolve { list, trex, update(dt, t, ctx), nearest(x, z) }.
 * `progress(p)` é chamado entre uma criatura e outra (a criação é pesada).
 */
export async function spawnDinosaurs(scene, world, quality, progress = () => {}) {
    const list = [];
    const P = WORLD;
    let seed = 3;
    const total = 13 + quality.flock;
    const make = async (o) => {
        const d = new Dino({ seed: seed++, ...o }, world, quality);
        d.addTo(scene);
        list.push(d);
        progress(list.length / total);
        await nextTask();
        return d;
    };

    // braquiossauros: estações de copa (frondosas marcadas em world.browse) e de água
    const L = P.lake;
    const stations = [];
    for (const tree of world.browse) {
        const a = Math.atan2(L.z - tree.z, L.x - tree.x);
        const x = tree.x + Math.cos(a) * 7.5;
        const z = tree.z + Math.sin(a) * 7.5;
        stations.push({ kind: 'browse', x, z, face: Math.atan2(tree.x - x, tree.z - z), tx: tree.x, ty: tree.y + 11.5 * tree.s * 0.78, tz: tree.z });
    }
    for (const ang of [0.5, 2.3, 3.9, 5.4]) {
        const s = shorePoint(world, ang);
        const x = L.x + Math.cos(ang) * (s.r + 4.6);
        const z = L.z + Math.sin(ang) * (s.r + 4.6);
        stations.push({ kind: 'drink', x, z, face: Math.atan2(L.x - x, L.z - z) });
    }
    const order = [stations[0], stations[4], stations[1], stations[5], stations[2], stations[6], stations[3], stations[7]];
    const b1 = await make({ id: 'brachio', preset: 'brachiosaurus', x: order[0].x, z: order[0].z, yaw: order[0].face, scale: 1.04, weight: 1, radius: 2.6, lodScale: 1.25 });
    const b2 = await make({ id: 'brachio', preset: 'brachiosaurus', x: order[3].x, z: order[3].z, yaw: order[3].face, scale: 0.94, weight: 0.9, radius: 2.4, lodScale: 1.25 });
    const b3 = await make({ id: 'brachio', preset: 'brachiosaurus', x: order[0].x - 6, z: order[0].z + 7, yaw: 1, scale: 0.5, age: 0.4, weight: 0.3, radius: 1.3 });
    brachioBrain(b1, world, order, 0);
    b1.state = 'act';
    b1.timer = 22;
    brachioBrain(b2, world, order, 3);
    b2.state = 'act';
    b2.timer = 12;
    followBrain(b3, b1, 9, 5);

    // tiranossauro
    const trex = await make({ id: 'trex', preset: 'trex', x: P.paddock.x - 6, z: P.paddock.z + 3, yaw: -1.6, scale: 1.05, weight: 1, radius: 1.9, lodScale: 1.3 });
    rexBrain(trex, world);

    // tricerátops: dois adultos e um filhote
    const M = P.meadow;
    const t1 = await make({ id: 'triceratops', preset: 'triceratops', x: M.x + 10, z: M.z - 4, yaw: 0.6, weight: 0.55, radius: 2.1 });
    const t2 = await make({ id: 'triceratops', preset: 'triceratops', x: M.x - 2, z: M.z + 8, yaw: 2.2, scale: 0.93, weight: 0.5, radius: 2.0 });
    const t3 = await make({ id: 'triceratops', preset: 'triceratops', x: M.x + 13, z: M.z + 1, yaw: 0.8, scale: 0.46, age: 0.25, radius: 1.0 });
    grazeBrain(t1, { x: M.x + 6, z: M.z - 2 }, 14);
    grazeBrain(t2, { x: M.x - 4, z: M.z + 6 }, 13);
    followBrain(t3, t1, 4.5, 2.6);

    // estegossauros em fila na crista
    const herd = { s: 30, dir: 1, wait: 0, gap: 10, count: 3 };
    const stegos = [];
    for (let i = 0; i < 3; i++) {
        const s = clamp(herd.s - i * 10, 3, world.stegoWalk.length - 3);
        world.stegoWalk.pointAt(s / world.stegoWalk.length, _v);
        const d = await make({ id: 'stego', preset: 'stegosaurus', x: _v.x, z: _v.z, yaw: 2.4, scale: i === 2 ? 0.8 : 1 - i * 0.05, weight: 0.5, radius: 1.9 });
        fileBrain(d, world.stegoWalk, herd, i, 10);
        stegos.push(d);
    }

    // raptors em bando
    const R = P.raptors;
    const pack = { x: R.x, z: R.z, yaw: 0, timer: 4, flee: false };
    const raptors = [];
    for (let i = 0; i < 4; i++) {
        const d = await make({ id: 'raptor', preset: 'velociraptor', x: R.x + (i % 2) * 3 - 1.5, z: R.z - i * 2.4, yaw: 0, scale: 1.25 + (i % 2) * 0.08, radius: 0.6 });
        raptorBrain(d, pack, i);
        raptors.push(d);
    }

    // pteranodontes no farol
    const T = P.tower;
    const towerTop = { x: T.x, y: world.heightAt(T.x, T.z) + 25, z: T.z };
    for (let i = 0; i < quality.flock; i++) {
        const o = {
            a: 15 + i * 5.5, b: 13 + i * 4.5, h: 3 + i * 2.6, ox: (i % 2 ? 6 : -4), oz: (i % 3) * 4 - 4,
            speed: 9.5 + (i % 3) * 1.2, dir: i % 2 ? -1 : 1, phase: i * 1.7, f: i * 2.1
        };
        const d = await make({
            id: 'ptera', preset: 'pteranodon', flyer: true, x: towerTop.x + o.a, y: towerTop.y + o.h, z: towerTop.z, scale: 1 + (i % 2) * 0.12
        });
        pteraBrain(d, towerTop, o);
    }

    const rnd = seeded(91);
    const spec = Object.fromEntries(SPECIES.map((s) => [s.id, s]));
    for (const d of list) d.spec = spec[d.id];

    return {
        list,
        trex,
        /** Estado do bando e da fila (uma vez por quadro, antes dos indivíduos). */
        update(dt, t, ctx) {
            // estegossauros: o ponto-guia percorre a crista; nas pontas, pausa para pastar e inverte
            const walk = world.stegoWalk;
            if (herd.wait > 0) {
                herd.wait -= dt;
                if (herd.wait <= 0) {
                    // inverte o sentido: o último vira o guia, sem ninguém trocar de lugar
                    herd.s -= herd.dir * (stegos.length - 1) * herd.gap;
                    herd.dir *= -1;
                }
            } else {
                herd.s += herd.dir * stegos[0].near.gaits.walk.speed * 0.9 * dt;
                if ((herd.dir > 0 && herd.s >= walk.length - 4) || (herd.dir < 0 && herd.s <= 4)) herd.wait = 14 + rnd() * 8;
            }
            // raptors: novo ponto da clareira a cada parada; fogem do jipe
            const jd = Math.hypot(ctx.jeep.x - pack.x, ctx.jeep.z - pack.z);
            pack.timer -= dt;
            const wasFlee = pack.flee;
            pack.flee = jd < 15 && ctx.playing;
            if ((pack.flee && !wasFlee) || pack.timer <= 0) {
                let a = rnd() * TAU;
                if (pack.flee) a = Math.atan2(R.z - ctx.jeep.z, R.x - ctx.jeep.x) + (rnd() - 0.5) * 1.2;
                const r = pack.flee ? R.radius * 0.8 : Math.sqrt(rnd()) * R.radius * 0.85;
                const nx = R.x + Math.cos(a) * r;
                const nz = R.z + Math.sin(a) * r;
                pack.yaw = Math.atan2(nx - pack.x, nz - pack.z);
                pack.x = nx;
                pack.z = nz;
                pack.timer = pack.flee ? 5 : 7 + rnd() * 8;
            }
            for (let i = 0; i < list.length; i++) list[i].update(dt, t, ctx);
        }
    };
}

