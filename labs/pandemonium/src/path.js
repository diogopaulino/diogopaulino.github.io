/**
 * Trilho 2.5D: uma spline Catmull–Rom com plataformas, buracos e ilhas móveis.
 *
 * O jogador vive no parâmetro `s` (metros ao longo da curva). A altura Y é
 * livre (pulo/gravidade). `floorAt(s, time)` diz se existe chão naquele ponto.
 */

import * as THREE from 'three';
import { clamp, hash01 } from './utils.js';

function beats() {
    const list = [];
    const push = (n, dist, turn, climb, type = 'solid', width = 3.35) => {
        for (let i = 0; i < n; i++) list.push({ dist, turn, climb, type, width });
    };

    // Praça do templo — aquecimento largo e plano.
    push(9, 5.6, 0, 0, 'solid', 4.4);
    push(4, 6.0, 0.07, 0.12, 'solid', 3.8);

    // Bosque em curva, primeiro buraco curto.
    push(7, 6.4, 0.13, 0.18, 'solid', 3.25);
    push(1, 5.2, 0.04, 0, 'gap', 3);
    push(5, 6.1, 0.1, 0.08, 'solid', 3.2);
    push(1, 5.8, 0.05, -0.15, 'gap', 3);
    push(6, 6.2, -0.16, 0.28, 'solid', 3.15);

    // Subida de cogumelos.
    push(8, 5.7, 0.17, 0.48, 'solid', 3.05);
    push(1, 6.4, 0.08, 0.15, 'gap', 2.8);
    push(4, 5.9, 0.1, 0.32, 'solid', 3.0);

    // Ilhas flutuantes (precisam de timing).
    push(2, 5.8, 0.06, 0.05, 'float', 2.75);
    push(1, 6.2, 0.07, 0, 'gap', 2.6);
    push(2, 5.8, 0.09, 0.12, 'float', 2.65);
    push(1, 6.6, 0.04, 0, 'gap', 2.6);
    push(3, 6.0, -0.12, 0.1, 'solid', 3.2);

    // Cânion — buracos de salto duplo.
    push(6, 6.3, -0.18, -0.38, 'solid', 2.95);
    push(1, 7.4, -0.06, -0.08, 'gap', 2.8);
    push(3, 6.0, -0.08, 0.16, 'solid', 3.0);
    push(1, 8.6, 0.02, 0, 'gap', 2.7);
    push(5, 6.0, 0.14, 0.42, 'solid', 3.1);

    // Espiral ascendente.
    push(14, 5.15, 0.3, 0.4, 'solid', 3.05);

    // Queda da cascata.
    push(4, 6.8, 0.05, -0.72, 'solid', 3.35);
    push(1, 5.8, 0.02, -0.2, 'gap', 3);
    push(3, 6.3, 0.08, -0.42, 'solid', 3.15);
    push(1, 7.6, 0.04, 0, 'gap', 2.9);
    push(2, 5.6, 0.06, 0.1, 'float', 2.7);
    push(1, 6.0, 0.03, 0, 'gap', 2.7);
    push(4, 6.1, 0.09, 0.18, 'solid', 3.25);

    // Reta de ouro até o portal.
    push(7, 6.0, 0.035, 0.08, 'solid', 3.7);
    push(1, 5.6, 0.02, 0, 'gap', 3.2);
    push(6, 6.4, 0.05, 0.22, 'solid', 4.15);

    return list;
}

export class Course {
    constructor(widthBonus = 0) {
        this.widthBonus = widthBonus;
        this._build();
    }

    _build() {
        const raw = beats();
        let x = 0;
        let y = 6.5;
        let z = 0;
        let heading = 0;
        let s = 0;

        this.waypoints = [{ x, y, z, s, type: 'solid', width: 4.4, dist: 0, heading: 0 }];
        this.segments = [];

        raw.forEach((beat, i) => {
            const s0 = s;
            const y0 = y;
            heading += beat.turn;
            x += Math.sin(heading) * beat.dist;
            z += Math.cos(heading) * beat.dist;
            y += beat.climb;
            s += beat.dist;
            const width = Math.max(2.15, beat.width + this.widthBonus);
            this.waypoints.push({ x, y, z, s, type: beat.type, width, dist: beat.dist, heading });
            this.segments.push({
                index: i,
                s0,
                s1: s,
                y0,
                y1: y,
                type: beat.type,
                width,
                phase: hash01((i + 1) * 3.17) * Math.PI * 2
            });
        });

        const pts = this.waypoints.map((w) => new THREE.Vector3(w.x, w.y, w.z));
        this.curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.12);
        this.length = s;
        this.goalS = Math.max(0, this.length - 7);

        const n = 4;
        this.checkpoints = [0];
        for (let i = 1; i < n; i++) {
            const cs = (this.length * i) / n;
            const seg = this.segmentAt(cs);
            if (seg && seg.type !== 'gap') this.checkpoints.push(cs);
        }

        this._pos = new THREE.Vector3();
        this._tan = new THREE.Vector3();
        this._bin = new THREE.Vector3();
        this._nor = new THREE.Vector3();
        this._up = new THREE.Vector3(0, 1, 0);
        this._floorFrame = {
            pos: new THREE.Vector3(),
            tangent: new THREE.Vector3(),
            binormal: new THREE.Vector3(),
            normal: new THREE.Vector3()
        };
    }

    tOf(s) {
        const seg = this.segmentAt(clamp(s, 0, this.length - 0.0001));
        const span = Math.max(0.001, seg.s1 - seg.s0);
        const u = clamp((s - seg.s0) / span, 0, 1);
        const n = Math.max(1, this.waypoints.length - 1);
        return clamp((seg.index + u) / n, 0, 1);
    }

    /** Referencial no ponto `s` — o `t` da spline acompanha os waypoints, não o arco. */
    frame(s, target = {}) {
        const t = this.tOf(s);
        this.curve.getPoint(t, this._pos);
        this.curve.getTangent(t, this._tan).normalize();
        this._bin.crossVectors(this._tan, this._up);
        if (this._bin.lengthSq() < 1e-4) this._bin.set(1, 0, 0);
        else this._bin.normalize();
        this._nor.crossVectors(this._bin, this._tan).normalize();

        target.pos = target.pos || new THREE.Vector3();
        target.tangent = target.tangent || new THREE.Vector3();
        target.binormal = target.binormal || new THREE.Vector3();
        target.normal = target.normal || new THREE.Vector3();
        target.pos.copy(this._pos);
        target.tangent.copy(this._tan);
        target.binormal.copy(this._bin);
        target.normal.copy(this._nor);
        target.t = t;
        return target;
    }

    segmentAt(s) {
        const segs = this.segments;
        let lo = 0;
        let hi = segs.length - 1;
        while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            const seg = segs[mid];
            if (s < seg.s0) hi = mid - 1;
            else if (s >= seg.s1 && mid < segs.length - 1) lo = mid + 1;
            else return seg;
        }
        return segs[segs.length - 1];
    }

    /**
     * Chão no ponto s. `time` anima ilhas flutuantes.
     * Retorna `{ y, width, type }` ou `null` se for buraco.
     */
    floorAt(s, time = 0) {
        if (s < -0.4 || s > this.length + 0.8) return null;
        const seg = this.segmentAt(clamp(s, 0, this.length - 0.01));
        if (!seg || seg.type === 'gap') return null;
        const frame = this.frame(s, this._floorFrame);
        let y = frame.pos.y;
        if (seg.type === 'float') y += Math.sin(time * 1.35 + seg.phase) * 1.05;
        return { y, width: seg.width, type: seg.type };
    }

    nearestCheckpoint(s) {
        let best = 0;
        for (const c of this.checkpoints) {
            if (c <= s + 1.2) best = c;
        }
        return best;
    }
}
