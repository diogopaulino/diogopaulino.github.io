/**
 * Passeio pelo reino: a princesa a pé, as estrelas caídas e a fada que a acompanha.
 *
 * OBJETIVO — depois dos fogos, seis estrelas caíram pelo reino e o castelo apagou.
 * Recolha as cinco do caminho (estrada → margem → viaduto → rampa) e leve a última ao
 * portão: a fada sobe até a torre de menagem, a estrela do topo acende e os fogos voltam.
 *
 * MOVIMENTO (unidades SI; dt já vem limitado a 0,05 s pelo palco)
 *   alvo      v* = dir·v_max·|stick|,  v_max = 3,4 m/s (trote) · 6,0 m/s (corrida)
 *   ladeira   v_max ← v_max·(1 − 0,45·min(1, rampa / 0,7))  (subir cansa; descer não acelera)
 *   água      até 0,45 m de lâmina: v_max ← 0,55·v_max; mais fundo é parede
 *   inércia   v ← v + clamp(v* − v, a·dt),  a = 9 m/s² (acelera) · 12 m/s² (freia) · 2,5 no ar
 *   gravidade vy ← vy − 9,81·dt; cola no chão se a queda do passo for < 0,45 m
 *   giro      ψ ← ψ + Δψ·(1 − e^(−12·dt))   (o corpo vira para onde anda)
 *
 * COLISÃO (separada por eixo: encostado na parede, desliza ao longo dela)
 *   obstáculo troncos (grade de 8 m), casas, muralha/torres do castelo, parapeitos, borda do mapa
 *   degrau    sobe até 0,45 m (soleira do viaduto); acima disso é parede
 *   encosta   subir com normal.y < 0,77 (> 40°) ou descer com normal.y < 0,60 (> 53°) é proibido:
 *             ninguém escala o penhasco nem cai dele
 *   escape    preso há 0,8 s com o direcional apertado → a regra de encosta afrouxa para
 *             passos planos ou descidas curtas (nunca para escalar);
 *             "Voltar à trilha" (botão/tecla T) leva à última estrela recolhida.
 */

import * as THREE from 'three';
import { createHero } from '../../shared/gfx/hero.js';

export const WALK = {
    jog: 3.4, sprint: 6.0, accel: 9, brake: 12, airAccel: 2.5, turn: 12,
    radius: 0.35, step: 0.45, upNy: 0.77, downNy: 0.6, gravity: 9.81, wade: -0.45
};

/** Torres da muralha (espelham castle.js: x, z, raio) + as duas torretas do portão. */
const WALL = [[-21, 19, 3.0], [-5.7, 26.3, 2.3], [5.7, 26.3, 2.3], [19.5, 20, 3.4], [26, 5, 2.6], [22, -13.5, 3.0], [5.5, -23.5, 2.7], [-15, -20.5, 3.2], [-26, -4, 2.8]];
const WALL_REACH = 2.4; // meia espessura + contraforte + raio do corpo

/**
 * Estrelas caídas: [x, z, nome, fração do viaduto?]. A última (portão) só acende depois das outras.
 * Da 3ª em diante o caminho passa pelo viaduto: a bússola aponta primeiro a cabeceira leste.
 */
export const SHARDS = [
    [141, 84.5, 'Estrada da aldeia'],
    [106, 104, 'Margem do lago'],
    [0, 0, 'Viaduto · 1º arco', 0.3],
    [0, 0, 'Viaduto · meio', 0.68],
    [13, 34.6, 'Rampa do penhasco'],
    [1.5, 31.6, 'Portão do castelo']
];
export const SPAWN = { x: 153, z: 78.5, heading: -1.15 };

const _n = new THREE.Vector3();

function segDist(px, pz, ax, az, bx, bz) {
    const dx = bx - ax;
    const dz = bz - az;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(px - ax - dx * t, pz - az - dz * t);
}

/** Chão caminhável e obstáculos do reino. */
export class WalkWorld {
    constructor(K) {
        this.terrain = K.terrain;
        const d = K.deck;
        this.ax = d.ax;
        this.az = d.az;
        this.ay = d.ay;
        this.by = d.by;
        this.L = Math.hypot(d.bx - d.ax, d.bz - d.az);
        this.ux = (d.bx - d.ax) / this.L;
        this.uz = (d.bz - d.az) / this.L;
        this.half = d.width / 2 - 0.2 - WALK.radius; // até a face interna do parapeito
        // grade de troncos (8 m) para consulta O(1); chave numérica = sem string por consulta
        this.cell = 8;
        this.grid = new Map();
        for (const t of K.trees) {
            const key = Math.floor(t.x / 8) * 4096 + Math.floor(t.z / 8);
            let list = this.grid.get(key);
            if (!list) this.grid.set(key, (list = []));
            list.push(t.x, t.z, 0.3 * (t.s ?? t.scale ?? 1) + WALK.radius);
        }
        // casas: retângulo orientado (u ao longo da largura, d do comprimento — como em createHamlet)
        //   u = cos ry·Δx − sin ry·Δz,  d = sin ry·Δx + cos ry·Δz;  bloqueia se |u| < w/2 + r e |d| < l/2 + r
        const r = WALK.radius + 0.15;
        this.houses = [];
        for (const h of K.houses) {
            const c = Math.cos(h.ry);
            const sn = Math.sin(h.ry);
            this.houses.push([h.x, h.z, c, sn, h.w / 2 + r, h.l / 2 + r]);
            // torre sineira da igreja: quadrada de 3,2 m, 1,6 m à frente da empena
            if (h.church) {
                const d = h.l / 2 + 1.6;
                this.houses.push([h.x + sn * d, h.z + c * d, c, sn, 1.6 + r, 1.6 + r]);
            }
        }
        this.onDeck = false;
    }

    /** Coordenadas no viaduto: u ao longo de A→B (m), w para o lado (m). */
    deckUW(x, z, out) {
        const rx = x - this.ax;
        const rz = z - this.az;
        out.u = rx * this.ux + rz * this.uz;
        out.w = -rx * this.uz + rz * this.ux;
        return out;
    }

    /** Altura do piso (m): tabuleiro do viaduto ou relevo. Marca `onDeck`. */
    ground(x, z) {
        const q = this.deckUW(x, z, this._uw || (this._uw = { u: 0, w: 0 }));
        if (q.u >= 0 && q.u <= this.L && Math.abs(q.w) <= this.half + 0.05) {
            this.onDeck = true;
            return this.ay + ((this.by - this.ay) * q.u) / this.L + 0.13;
        }
        this.onDeck = false;
        return this.terrain.heightAt(x, z);
    }

    /** Altura de apoio da câmera (o tabuleiro conta como chão). */
    floorAt(x, z) {
        return this.ground(x, z);
    }

    blocked(x, z) {
        if (Math.hypot(x, z - 90) > 178) return true;
        const q = this.deckUW(x, z, this._uw || (this._uw = { u: 0, w: 0 }));
        if (q.u > -0.4 && q.u < this.L + 0.4) {
            const aw = Math.abs(q.w);
            if (aw <= this.half) return false; // no tabuleiro: só o parapeito importa
            if (aw < this.half + 0.9 + WALK.radius) return true; // parapeito
        }
        // castelo: dentro do polígono, perto de um lanço ou de uma torre
        if (Math.abs(x) < 34 && z > -32 && z < 34) {
            let inside = false;
            for (let i = 0, j = WALL.length - 1; i < WALL.length; j = i++) {
                const [xi, zi, ri] = WALL[i];
                const [xj, zj] = WALL[j];
                if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
                if (Math.hypot(x - xi, z - zi) < ri + 0.6 + WALK.radius) return true;
                if (segDist(x, z, xi, zi, xj, zj) < WALL_REACH) return true;
            }
            if (inside) return true;
        }
        for (const [hx, hz, c, sn, hw, hl] of this.houses) {
            const dx = x - hx;
            const dz = z - hz;
            if (dx * dx + dz * dz > 100) continue;
            if (Math.abs(c * dx - sn * dz) < hw && Math.abs(sn * dx + c * dz) < hl) return true;
        }
        const cx = Math.floor(x / 8);
        const cz = Math.floor(z / 8);
        for (let gz = cz - 1; gz <= cz + 1; gz++) {
            for (let gx = cx - 1; gx <= cx + 1; gx++) {
                const list = this.grid.get(gx * 4096 + gz);
                if (!list) continue;
                for (let i = 0; i < list.length; i += 3) {
                    const dx = x - list[i];
                    const dz = z - list[i + 1];
                    if (dx * dx + dz * dz < list[i + 2] * list[i + 2]) return true;
                }
            }
        }
        return false;
    }

    /** Posição de mundo das estrelas do viaduto (u = fração do comprimento). */
    deckPoint(f) {
        const u = f * this.L;
        return { x: this.ax + this.ux * u, z: this.az + this.uz * u };
    }
}

/** A princesa: corpo do kit (gfx/hero) + física de caminhada acima. */
export class Walker {
    constructor(scene, world, { detail = 2 } = {}) {
        this.world = world;
        this.hero = createHero({ preset: 'princess', detail });
        this.root = this.hero.object;
        this.root.name = 'princesa';
        scene.add(this.root);
        this.pose = { mode: 'idle', speed: 0, blend: 0.22 };
        this.x = 0;
        this.y = 0;
        this.z = 0;
        this.vx = 0;
        this.vz = 0;
        this.vy = 0;
        this.heading = 0;
        this.yaw = 0;
        this.speed = 0;
        this.grounded = true;
        this.stuck = 0;
        this.stride = 0;
        this.surface = 'grass';
        this.info = { step: false, surface: 'grass' };
    }

    spawn(x, z, heading) {
        this.x = x;
        this.z = z;
        this.y = this.world.ground(x, z);
        this.vx = this.vz = this.vy = 0;
        this.heading = this.yaw = heading;
        this.speed = 0;
        this.stuck = 0;
        this.grounded = true;
        this.sync();
    }

    /** O passo de (x, z) até (nx, nz) é permitido? */
    canMove(nx, nz, relaxed) {
        const W = this.world;
        if (W.blocked(nx, nz)) return false;
        const g = W.ground(nx, nz);
        const deck = W.onDeck;
        const dh = g - this.y;
        if (dh > WALK.step) return false;
        if (deck) return true;
        // fundo demais: na água funda só vale o passo que sobe (sem "escorregar" 1 cm por quadro lago adentro)
        if (g < WALK.wade && g <= this.y) return false;
        if (relaxed) return dh < 0.05 && dh > -1; // destrava sem virar escalada: só plano ou descida curta
        const ny = W.terrain.normalAt(nx, nz, _n).y;
        if (dh > 0.002 && ny < WALK.upNy) return false;
        if (dh < -0.002 && ny < WALK.downNy) return false;
        return true;
    }

    /**
     * @param {{x:number,y:number,sprint:boolean}} move  relativo à câmera
     * @param {number} camYaw  guinada da câmera (a câmera fica em +ψ, olha para −ψ)
     */
    update(dt, move, camYaw) {
        const W = this.world;
        const sin = Math.sin(camYaw);
        const cos = Math.cos(camYaw);
        // frente da câmera no chão = (−sin ψ, −cos ψ); direita = (cos ψ, −sin ψ)
        let dx = -sin * move.y + cos * move.x;
        let dz = -cos * move.y - sin * move.x;
        const mag = Math.min(1, Math.hypot(dx, dz));
        let vmax = (move.sprint ? WALK.sprint : WALK.jog) * mag;
        if (mag > 0.01) {
            const l = Math.hypot(dx, dz);
            dx /= l;
            dz /= l;
            const g0 = W.ground(this.x, this.z);
            const rise = (W.ground(this.x + dx * 0.6, this.z + dz * 0.6) - g0) / 0.6;
            if (rise > 0) vmax *= 1 - 0.45 * Math.min(1, rise / 0.7);
            if (g0 < -0.05 && !W.onDeck) vmax *= 0.55;
        }
        const tx = dx * vmax;
        const tz = dz * vmax;
        let ex = tx - this.vx;
        let ez = tz - this.vz;
        const el = Math.hypot(ex, ez);
        const a = (this.grounded ? (vmax > 0.05 ? WALK.accel : WALK.brake) : WALK.airAccel) * dt;
        if (el > a) {
            ex *= a / el;
            ez *= a / el;
        }
        this.vx += ex;
        this.vz += ez;

        // colisão por eixo
        const relaxed = this.stuck > 0.8;
        const px = this.x;
        const pz = this.z;
        const nx = this.x + this.vx * dt;
        const nz = this.z + this.vz * dt;
        if (this.canMove(nx, nz, relaxed)) {
            this.x = nx;
            this.z = nz;
        } else if (this.canMove(nx, this.z, relaxed)) {
            this.x = nx;
            this.vz *= 0.2;
        } else if (this.canMove(this.x, nz, relaxed)) {
            this.z = nz;
            this.vx *= 0.2;
        } else {
            this.vx = this.vz = 0;
        }
        const moved = Math.hypot(this.x - px, this.z - pz);
        this.stuck = mag > 0.3 && moved < 0.2 * dt * vmax ? this.stuck + dt : 0;
        this.speed = moved / Math.max(dt, 1e-4);

        // vertical: cola no chão ou cai
        const g = W.ground(this.x, this.z);
        this.surface = W.onDeck || Math.hypot(this.x, this.z) < 36 ? 'stone' : g < 0.02 ? 'water' : 'grass';
        if (this.y - g < WALK.step && this.vy <= 0) {
            this.y = g;
            this.vy = 0;
            this.grounded = true;
        } else {
            this.vy -= WALK.gravity * dt;
            this.y += this.vy * dt;
            if (this.y <= g) {
                this.y = g;
                this.vy = 0;
            }
            this.grounded = this.y <= g + 0.01;
        }

        if (this.speed > 0.3) this.heading = Math.atan2(this.vx, this.vz);
        let dy = this.heading - this.yaw;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        this.yaw += dy * (1 - Math.exp(-WALK.turn * dt));

        // passadas: comprimento ≈ 0,75 m andando e 1,3 m correndo
        this.stride += moved;
        const len = this.speed > 2.4 ? 1.3 : 0.75;
        this.info.step = false;
        if (this.stride > len) {
            this.stride = 0;
            this.info.step = this.grounded;
        }
        this.info.surface = this.surface;
        this.sync();
        this.animate(dt);
        return this.info;
    }

    /** Pose pelo módulo da velocidade real (m/s): parada · caminhada < 2,4 · corrida. */
    animate(dt, mode = null) {
        const p = this.pose;
        if (mode) {
            p.mode = mode;
            p.speed = 0;
        } else if (this.speed > 0.25) {
            p.mode = this.speed > 2.4 ? 'run' : 'walk';
            p.speed = this.speed;
        } else {
            p.mode = 'idle';
            p.speed = 0;
        }
        this.hero.update(dt, p);
    }

    sync() {
        this.root.position.set(this.x, this.y, this.z);
        this.root.rotation.y = this.yaw;
    }
}

// ---------------------------------------------------------------------------
// Estrelas caídas (marcador: núcleo + halo + coluna de luz visível de longe)
// ---------------------------------------------------------------------------

const HALO_VS = /* glsl */ `
    varying vec2 vUv;
    void main() {
        vUv = uv * 2.0 - 1.0;
        vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        mv.xy += position.xy * vec2(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz));
        gl_Position = projectionMatrix * mv;
    }`;
const HALO_FS = /* glsl */ `
    uniform vec3 uColor;
    varying vec2 vUv;
    void main() {
        float d = dot(vUv, vUv);
        gl_FragColor = vec4(uColor * exp(-d * 5.0) * (1.0 - smoothstep(0.6, 1.0, d)), 1.0);
    }`;

function haloMaterial(color) {
    return new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(color) } },
        vertexShader: HALO_VS, fragmentShader: HALO_FS,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
}

export class Shards {
    constructor(scene, world) {
        this.world = world;
        this.group = new THREE.Group();
        this.group.name = 'estrelas-caidas';
        scene.add(this.group);
        const core = new THREE.OctahedronGeometry(0.24, 0);
        core.scale(1, 1.7, 1);
        const beam = new THREE.CylinderGeometry(0.28, 0.75, 44, 14, 1, true);
        beam.translate(0, 22, 0);
        const quad = new THREE.PlaneGeometry(1, 1);
        this.items = SHARDS.map(([x, z, name, f], i) => {
            if (f != null) ({ x, z } = world.deckPoint(f));
            const y = world.ground(x, z);
            const g = new THREE.Group();
            g.position.set(x, y, z);
            const coreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.3, 1.0) });
            const c = new THREE.Mesh(core, coreMat);
            c.position.y = 1.15;
            const halo = new THREE.Mesh(quad, haloMaterial(0x000000));
            halo.position.y = 1.15;
            halo.scale.setScalar(2.6);
            halo.frustumCulled = false;
            halo.renderOrder = 9;
            const beamMat = new THREE.ShaderMaterial({
                uniforms: { uColor: { value: new THREE.Color(1.0, 0.78, 0.4) }, uOpacity: { value: 0.5 } },
                vertexShader: /* glsl */ `
                    varying float vY;
                    varying float vEdge;
                    void main() {
                        vY = uv.y;
                        vec3 n = normalize(normalMatrix * normal);
                        vEdge = abs(n.z);
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    }`,
                fragmentShader: /* glsl */ `
                    uniform vec3 uColor;
                    uniform float uOpacity;
                    varying float vY;
                    varying float vEdge;
                    void main() {
                        float a = pow(1.0 - vY, 1.8) * pow(vEdge, 1.6) * uOpacity;
                        gl_FragColor = vec4(uColor * a, 1.0);
                    }`,
                transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
            });
            const b = new THREE.Mesh(beam, beamMat);
            b.renderOrder = 8;
            g.add(c, halo, b);
            this.group.add(g);
            return { x, y, z, name, i, final: i === SHARDS.length - 1, viaDeck: i >= 2, got: false, g, core: c, coreMat, halo, beam: b, beamMat };
        });
        this.total = this.items.length;
        this.count = 0;
        this.reset();
    }

    reset() {
        this.count = 0;
        for (const s of this.items) {
            s.got = false;
            s.g.visible = true;
        }
        this.refresh();
    }

    /** O portão só acende quando as outras estrelas já foram recolhidas. */
    get unlocked() {
        return this.count >= this.total - 1;
    }

    refresh() {
        for (const s of this.items) {
            const lit = !s.final || this.unlocked;
            s.coreMat.color.setRGB(lit ? 3.2 : 0.5, lit ? 2.3 : 0.62, lit ? 1.0 : 1.1);
            s.halo.material.uniforms.uColor.value.setRGB(lit ? 0.55 : 0.1, lit ? 0.4 : 0.14, lit ? 0.18 : 0.26);
            s.beam.visible = lit;
        }
    }

    /** Próximo alvo da bússola: a estrela pendente mais próxima (o portão por último). */
    next(px, pz) {
        let best = null;
        let bd = Infinity;
        for (const s of this.items) {
            if (s.got || (s.final && !this.unlocked)) continue;
            const d = Math.hypot(s.x - px, s.z - pz);
            if (d < bd) {
                bd = d;
                best = s;
            }
        }
        return best;
    }

    /**
     * Para onde andar rumo à estrela `s` (bússola e fada): quem ainda não subiu no viaduto
     * é levado à cabeceira leste (u = −2 m, depois u = +3 m); no tabuleiro ou já do outro lado
     * (u > L − 3), segue direto.
     */
    steer(s, px, pz, out) {
        out.x = s.x;
        out.z = s.z;
        const W = this.world;
        if (!s.viaDeck) return out;
        W.ground(px, pz);
        const q = W.deckUW(px, pz, this._q || (this._q = { u: 0, w: 0 }));
        if (W.onDeck || q.u > W.L - 3) return out;
        const entry = W.deckPoint(-2 / W.L);
        const near = Math.hypot(px - entry.x, pz - entry.z) < 2.5;
        const p = near ? W.deckPoint(3 / W.L) : entry;
        out.x = p.x;
        out.z = p.z;
        return out;
    }

    /** Anima e devolve a estrela tocada neste quadro (ou null). */
    update(dt, t, px, py, pz) {
        let hit = null;
        for (const s of this.items) {
            if (s.got) continue;
            const ph = t * 1.6 + s.i * 1.3;
            s.core.position.y = 1.15 + Math.sin(ph) * 0.12;
            s.core.rotation.y = t * 1.4 + s.i;
            s.halo.position.y = s.core.position.y;
            const d = Math.hypot(s.x - px, s.z - pz);
            // a coluna some de perto (não ofusca) e cresce de longe (dá para achar)
            s.beamMat.uniforms.uOpacity.value = 0.12 + 0.5 * Math.min(1, Math.max(0, (d - 4) / 30));
            s.halo.scale.setScalar(2.4 + Math.sin(ph * 2.3) * 0.25);
            if (d < 1.5 && Math.abs(py - s.y) < 2.5 && (!s.final || this.unlocked)) hit = s;
        }
        if (hit) {
            hit.got = true;
            hit.g.visible = false;
            this.count++;
            this.refresh();
        }
        return hit;
    }

    /** Última estrela recolhida (ponto de retorno "Voltar à trilha"). */
    checkpoint() {
        let last = null;
        for (const s of this.items) if (s.got && !s.final) last = s;
        return last;
    }
}

/**
 * A fada companheira: um ponto de luz que segue o ombro da princesa com mola amortecida
 *   p ← p + (alvo − p)·(1 − e^(−3·dt)),  alvo = ombro + (0,45; 0,5 + 0,15·sin 2t; 0) girado
 * e, quando há um objetivo, se adianta 0,8 m na direção dele (indica o caminho).
 */
export class Companion {
    constructor(scene, { light = true } = {}) {
        this.pos = new THREE.Vector3();
        this.halo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), haloMaterial(0x000000));
        this.halo.frustumCulled = false;
        this.halo.renderOrder = 9;
        this.halo.scale.setScalar(0.55);
        this.halo.visible = false;
        scene.add(this.halo);
        this.light = light ? new THREE.PointLight(0xffc27a, 0, 14, 2) : null;
        if (this.light) scene.add(this.light);
        this.on = false;
    }

    setOn(on) {
        this.on = on;
        this.halo.visible = on;
        if (this.light) this.light.intensity = 0;
    }

    place(x, y, z) {
        this.pos.set(x, y + 1.9, z);
    }

    update(dt, t, walker, target) {
        if (!this.on) return;
        const s = Math.sin(walker.yaw);
        const c = Math.cos(walker.yaw);
        let ax = walker.x + c * 0.5 - s * 0.2;
        let az = walker.z - s * 0.5 - c * 0.2;
        if (target) {
            const dx = target.x - walker.x;
            const dz = target.z - walker.z;
            const d = Math.hypot(dx, dz) || 1;
            ax += (dx / d) * 0.8;
            az += (dz / d) * 0.8;
        }
        const ay = walker.y + 1.85 + Math.sin(t * 2.1) * 0.15;
        const k = 1 - Math.exp(-3 * dt);
        this.pos.x += (ax - this.pos.x) * k;
        this.pos.y += (ay - this.pos.y) * k;
        this.pos.z += (az - this.pos.z) * k;
        this.halo.position.copy(this.pos);
        const pulse = 0.85 + 0.15 * Math.sin(t * 9.0);
        this.halo.material.uniforms.uColor.value.setRGB(0.7 * pulse, 0.56 * pulse, 0.3 * pulse);
        if (this.light) {
            this.light.position.copy(this.pos);
            this.light.intensity = 7 * pulse;
        }
    }
}
