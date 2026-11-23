/**
 * Mundo de colisão geométrico sem dependência externa.
 * Caixas AABB, pisos, paredes e resolução de cápsula com step-up e rampas.
 *
 * Além das caixas, um nível pode registrar:
 *   setGround(fn)   fn(x, z) → altura do chão (m) ou null = não dá para pisar ali
 *                   (terreno da ilha, convés do navio com escadas e castelos de proa/popa)
 *   setLimit(fn)    fn(p{x,z}) ajusta p para dentro da área válida (contorno do casco)
 * Tudo vive no referencial LOCAL do nível (o navio balança, a colisão não).
 */

import { clamp } from '../utils/math.js?v=50';

/** Subida máxima por metro andado sobre o chão por função: tan(52°) ≈ 1,28. */
const MAX_RISE = 1.28;
const _p = { x: 0, z: 0 };
/* Resultado reaproveitado (sem alocação por quadro): quem chama copia os campos na hora. */
const _res = { x: 0, y: 0, z: 0, grounded: false, hit: false };

export class CollisionWorld {
    constructor() {
        this.boxes = [];
        this.triggers = [];
        this.noiseSources = [];
        this.ground = null;
        this.limit = null;
    }

    clear() {
        this.boxes.length = 0;
        this.triggers.length = 0;
        this.noiseSources.length = 0;
        this.ground = null;
        this.limit = null;
    }

    setGround(fn) {
        this.ground = fn;
    }

    setLimit(fn) {
        this.limit = fn;
    }

    addBox(minx, miny, minz, maxx, maxy, maxz, opts = {}) {
        const box = {
            min: { x: minx, y: miny, z: minz },
            max: { x: maxx, y: maxy, z: maxz },
            solid: opts.solid !== false,
            /* sight:false = não bloqueia câmera nem visão dos guardas (grades, corrimãos) */
            sight: opts.sight !== false,
            id: opts.id || null
        };
        this.boxes.push(box);
        return box;
    }

    addFloor(x, z, w, d, y = 0) {
        return this.addBox(x - w / 2, y - 0.4, z - d / 2, x + w / 2, y, z + d / 2, { id: 'floor' });
    }

    addWall(x, z, w, d, h, y = 0, opts) {
        return this.addBox(x - w / 2, y, z - d / 2, x + w / 2, y + h, z + d / 2, opts);
    }

    /** Obstáculo redondo aproximado por caixa (barril, coluna, mastro). */
    addPillar(x, z, r, h, y = 0, opts) {
        return this.addBox(x - r, y, z - r, x + r, y + h, z + r, opts);
    }

    removeBox(box) {
        const i = this.boxes.indexOf(box);
        if (i >= 0) this.boxes.splice(i, 1);
    }

    addTrigger(id, minx, miny, minz, maxx, maxy, maxz) {
        this.triggers.push({
            id,
            min: { x: minx, y: miny, z: minz },
            max: { x: maxx, y: maxy, z: maxz },
            inside: false
        });
    }

    emitNoise(x, z, amount, ttl = 0.4) {
        this.noiseSources.push({ x, z, amount, ttl });
    }

    update(dt) {
        for (let i = this.noiseSources.length - 1; i >= 0; i--) {
            this.noiseSources[i].ttl -= dt;
            if (this.noiseSources[i].ttl <= 0) this.noiseSources.splice(i, 1);
        }
    }

    groundHeight(x, z, fromY, radius = 0.28) {
        let best = -Infinity;
        for (const b of this.boxes) {
            if (!b.solid) continue;
            if (x + radius < b.min.x || x - radius > b.max.x) continue;
            if (z + radius < b.min.z || z - radius > b.max.z) continue;
            if (b.max.y > fromY + 0.55) continue;
            if (b.max.y > best) best = b.max.y;
        }
        return best === -Infinity ? null : best;
    }

    /**
     * Resolve cápsula contra AABBs. Step offset ~0.4, rampas até ~50°.
     * Com chão por função (setGround): o passo é recusado quando a subida passa de
     * MAX_RISE·(distância andada) — encosta íngreme vira parede e o jogador desliza
     * pelo eixo que ainda é válido.
     * Devolve um objeto reaproveitado — leia/copie os campos antes da próxima chamada.
     * @returns {{x:number,y:number,z:number,grounded:boolean,hit:boolean}}
     */
    resolveCapsule(px, py, pz, radius, height, vx, vz, dt, step = 0.42) {
        let x = px + vx * dt;
        let z = pz + vz * dt;
        let y = py;
        let hit = false;

        for (let pass = 0; pass < 3; pass++) {
            for (const b of this.boxes) {
                if (!b.solid) continue;
                const top = b.max.y;
                const bottom = b.min.y;
                if (y + height < bottom || y > top + 0.02) continue;
                const nx = clamp(x, b.min.x, b.max.x);
                const nz = clamp(z, b.min.z, b.max.z);
                const dx = x - nx;
                const dz = z - nz;
                const d2 = dx * dx + dz * dz;
                if (d2 >= radius * radius) continue;

                const stepH = top - y;
                /* degrau (ou piso vizinho na mesma altura, com 2 cm de folga): sobe/passa.
                   Antes um piso adjacente exatamente na altura dos pés empurrava quem
                   andava sem gravidade (os guardas) — eles empacavam nas portas. */
                if (stepH > -0.021 && stepH <= step && y + 0.05 >= bottom) {
                    if (stepH > 0) y = top;
                    continue;
                }

                const dist = Math.sqrt(d2) || 0.0001;
                const push = radius - dist + 0.001;
                x += (dx / dist) * push;
                z += (dz / dist) * push;
                hit = true;
            }
        }

        if (this.limit) {
            _p.x = x;
            _p.z = z;
            this.limit(_p);
            x = _p.x;
            z = _p.z;
        }

        let fnGround = null;
        if (this.ground) {
            fnGround = this._groundOk(x, z, px, py, pz);
            if (fnGround === null) {
                const gx = this._groundOk(x, pz, px, py, pz);
                const gz = gx === null ? this._groundOk(px, z, px, py, pz) : null;
                if (gx !== null) {
                    z = pz;
                    fnGround = gx;
                } else if (gz !== null) {
                    x = px;
                    fnGround = gz;
                } else {
                    x = px;
                    z = pz;
                    fnGround = this.ground(px, pz);
                }
                hit = true;
            }
        }

        const fromY = Math.max(y, py) + height;
        let ground = this.groundHeight(x, z, fromY, radius * 0.85);
        if (fnGround !== null && (ground === null || fnGround > ground)) ground = fnGround;
        let grounded = false;
        if (ground !== null) {
            if (y <= ground + 0.08) {
                y = ground;
                grounded = true;
            }
        }

        _res.x = x;
        _res.y = y;
        _res.z = z;
        _res.grounded = grounded;
        _res.hit = hit;
        return _res;
    }

    /** Altura do chão por função em (gx, gz), ou null se a subida desde (px, pz) for íngreme demais. */
    _groundOk(gx, gz, px, py, pz) {
        const g = this.ground(gx, gz);
        if (g === null) return null;
        const run = Math.hypot(gx - px, gz - pz);
        return g - py > 0.06 + run * MAX_RISE ? null : g;
    }

    /**
     * Raio contra as caixas (método das fatias) e, se houver, contra o chão por função
     * (amostrado a cada ~0,6 m). Usado pela câmera e pela linha de visão dos guardas.
     * @returns {number} distância até o primeiro bloqueio, ou `maxDist` se o caminho está livre
     */
    rayHit(ox, oy, oz, dx, dy, dz, maxDist) {
        let best = maxDist;
        for (const b of this.boxes) {
            if (!b.solid || !b.sight) continue;
            let t0 = 0;
            let t1 = best;
            // eixo x
            if (Math.abs(dx) < 1e-8) {
                if (ox < b.min.x || ox > b.max.x) continue;
            } else {
                let a = (b.min.x - ox) / dx;
                let c = (b.max.x - ox) / dx;
                if (a > c) { const s = a; a = c; c = s; }
                if (a > t0) t0 = a;
                if (c < t1) t1 = c;
                if (t0 > t1) continue;
            }
            if (Math.abs(dy) < 1e-8) {
                if (oy < b.min.y || oy > b.max.y) continue;
            } else {
                let a = (b.min.y - oy) / dy;
                let c = (b.max.y - oy) / dy;
                if (a > c) { const s = a; a = c; c = s; }
                if (a > t0) t0 = a;
                if (c < t1) t1 = c;
                if (t0 > t1) continue;
            }
            if (Math.abs(dz) < 1e-8) {
                if (oz < b.min.z || oz > b.max.z) continue;
            } else {
                let a = (b.min.z - oz) / dz;
                let c = (b.max.z - oz) / dz;
                if (a > c) { const s = a; a = c; c = s; }
                if (a > t0) t0 = a;
                if (c < t1) t1 = c;
                if (t0 > t1) continue;
            }
            if (t0 < best) best = t0;
        }
        if (this.ground) {
            for (let t = 0.6; t < best; t += 0.6) {
                const g = this.ground(ox + dx * t, oz + dz * t);
                if (g !== null && oy + dy * t < g + 0.25) {
                    best = Math.max(0, t - 0.6);
                    break;
                }
            }
        }
        return best;
    }

    overlappingTriggers(x, y, z) {
        const hits = [];
        for (const t of this.triggers) {
            const inside = x >= t.min.x && x <= t.max.x && y >= t.min.y && y <= t.max.y && z >= t.min.z && z <= t.max.z;
            t.inside = inside;
            if (inside) hits.push(t.id);
        }
        return hits;
    }
}
