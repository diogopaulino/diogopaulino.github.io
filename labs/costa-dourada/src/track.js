/**
 * Pista costeira fechada — spline Catmull-Rom amostrada.
 * Oceano à direita (lateral +), falésias/palmeiras à esquerda.
 */

import { clamp } from './utils.js';

const CONTROL = [
    [0, 2, 0],
    [90, 2.2, -45],
    [190, 3, -15],
    [280, 4.5, 70],
    [320, 6, 175],
    [260, 7.2, 280],
    [145, 5.8, 340],
    [20, 4.2, 315],
    [-90, 3.6, 230],
    [-155, 4.8, 125],
    [-175, 6.2, 15],
    [-125, 5.1, -90],
    [-35, 3.1, -130],
    [45, 2.4, -95]
];

function catmull(p0, p1, p2, p3, t) {
    const t2 = t * t;
    const t3 = t2 * t;
    return 0.5 * (
        2 * p1
        + (-p0 + p2) * t
        + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
        + (-p0 + 3 * p1 - 3 * p2 + p3) * t3
    );
}

export class Track {
    constructor(segments = 320) {
        this.halfWidth = 6.2;
        this.build(CONTROL, segments);
    }

    build(controls, segments) {
        const pts = controls.map((c) => ({ x: c[0], y: c[1], z: c[2] }));
        const n = pts.length;
        const samples = [];
        for (let i = 0; i < segments; i++) {
            const f = (i / segments) * n;
            const i1 = Math.floor(f) % n;
            const i0 = (i1 - 1 + n) % n;
            const i2 = (i1 + 1) % n;
            const i3 = (i1 + 2) % n;
            const t = f - Math.floor(f);
            samples.push({
                x: catmull(pts[i0].x, pts[i1].x, pts[i2].x, pts[i3].x, t),
                y: catmull(pts[i0].y, pts[i1].y, pts[i2].y, pts[i3].y, t),
                z: catmull(pts[i0].z, pts[i1].z, pts[i2].z, pts[i3].z, t)
            });
        }

        this.count = samples.length;
        this.x = new Float32Array(this.count);
        this.y = new Float32Array(this.count);
        this.z = new Float32Array(this.count);
        this.tx = new Float32Array(this.count);
        this.tz = new Float32Array(this.count);
        this.nx = new Float32Array(this.count);
        this.nz = new Float32Array(this.count);
        this.yaw = new Float32Array(this.count);
        this.dist = new Float32Array(this.count);
        this.slope = new Float32Array(this.count);
        this.widthScale = new Float32Array(this.count);

        let length = 0;
        for (let i = 0; i < this.count; i++) {
            this.x[i] = samples[i].x;
            this.y[i] = samples[i].y;
            this.z[i] = samples[i].z;
            this.dist[i] = length;
            const next = samples[(i + 1) % this.count];
            const dx = next.x - samples[i].x;
            const dy = next.y - samples[i].y;
            const dz = next.z - samples[i].z;
            const segLen = Math.hypot(dx, dz) || 0.001;
            length += segLen;
            this.tx[i] = dx / segLen;
            this.tz[i] = dz / segLen;
            this.nx[i] = -this.tz[i];
            this.nz[i] = this.tx[i];
            this.yaw[i] = Math.atan2(this.tx[i], this.tz[i]);
            this.slope[i] = dy / segLen;

            const prev = samples[(i - 1 + this.count) % this.count];
            const ax = samples[i].x - prev.x;
            const az = samples[i].z - prev.z;
            const bx = next.x - samples[i].x;
            const bz = next.z - samples[i].z;
            const cross = ax * bz - az * bx;
            const curve = Math.min(1, Math.abs(cross) / (segLen * segLen + 0.01) * 0.15);
            this.widthScale[i] = 1 - curve * 0.18;
        }
        this.length = length;
    }

    sample(index) {
        const i = ((index % this.count) + this.count) % this.count;
        return {
            x: this.x[i], y: this.y[i], z: this.z[i],
            tx: this.tx[i], tz: this.tz[i],
            nx: this.nx[i], nz: this.nz[i],
            yaw: this.yaw[i], dist: this.dist[i]
        };
    }

    halfWidthAt(index) {
        const i = ((index % this.count) + this.count) % this.count;
        return this.halfWidth * this.widthScale[i];
    }

    heightAt(index, lateral = 0) {
        const i = ((index % this.count) + this.count) % this.count;
        return this.y[i] - lateral * 0.012 - Math.max(0, lateral - this.halfWidth) * 0.08;
    }

    slopeAt(index) {
        const i = ((index % this.count) + this.count) % this.count;
        return this.slope[i];
    }

    locate(px, pz, hint = 0) {
        let best = hint;
        let bestD = Infinity;
        for (let k = -28; k <= 28; k++) {
            const i = ((hint + k) % this.count + this.count) % this.count;
            const dx = px - this.x[i];
            const dz = pz - this.z[i];
            const d = dx * dx + dz * dz;
            if (d < bestD) {
                bestD = d;
                best = i;
            }
        }
        const dx = px - this.x[best];
        const dz = pz - this.z[best];
        return {
            index: best,
            distance: this.dist[best],
            lateral: dx * this.nx[best] + dz * this.nz[best],
            offset: Math.sqrt(bestD)
        };
    }

    poseAtDistance(distance, lateral = 0) {
        const d = ((distance % this.length) + this.length) % this.length;
        let i = 0;
        while (i < this.count - 1 && this.dist[i + 1] <= d) i++;
        const pose = this.sample(i);
        return {
            x: pose.x + pose.nx * lateral,
            y: this.heightAt(i, lateral),
            z: pose.z + pose.nz * lateral,
            yaw: pose.yaw,
            index: i
        };
    }

    targetSpeed(index, skill = 1) {
        const i = ((index % this.count) + this.count) % this.count;
        const curve = 1 - this.widthScale[i];
        return clamp((58 - curve * 38) * (0.82 + 0.22 * skill), 18, 62);
    }
}
