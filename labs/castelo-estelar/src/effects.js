/**
 * Fada de faíscas, arco dourado, estrela cadente e fogos.
 *
 * Fogo: p(t) = p0 + v0 t + ½ g t², com g = (0, −18, 0).
 * Arco: Catmull-Rom amostrada; o tubo cresce com o parâmetro u ∈ [0, 1].
 */

import * as THREE from 'three';
import { makeSparkMaterial } from './shaders.js';

function makePoints(max) {
    const pos = new Float32Array(max * 3);
    const col = new Float32Array(max * 3);
    const size = new Float32Array(max);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setDrawRange(0, 0);
    const pts = new THREE.Points(geo, makeSparkMaterial());
    pts.frustumCulled = false;
    return { pts, pos, col, size, max, n: 0 };
}

export class Magic {
    constructor(scene, quality) {
        this.scene = scene;
        this.quality = quality;
        this.group = new THREE.Group();
        scene.add(this.group);

        this.sparks = makePoints(quality.sparks);
        this.group.add(this.sparks.pts);

        this.particles = [];
        this.fairy = new THREE.Mesh(
            new THREE.SphereGeometry(0.18, 12, 10),
            new THREE.MeshBasicMaterial({ color: 0xfff4c0, transparent: true, opacity: 0 })
        );
        this.fairyGlow = new THREE.Mesh(
            new THREE.SphereGeometry(0.55, 12, 10),
            new THREE.MeshBasicMaterial({
                color: 0xffe08a,
                transparent: true,
                opacity: 0,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            })
        );
        this.group.add(this.fairy, this.fairyGlow);

        this.arc = this._makeArc();
        this.group.add(this.arc.mesh);

        this.shooting = new THREE.Mesh(
            new THREE.SphereGeometry(0.22, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 })
        );
        this.group.add(this.shooting);

        this.fairyPath = new THREE.CatmullRomCurve3([
            new THREE.Vector3(-38, 18, 36),
            new THREE.Vector3(-18, 28, 18),
            new THREE.Vector3(-2, 36, 6),
            new THREE.Vector3(14, 40, 4),
            new THREE.Vector3(28, 32, 14),
            new THREE.Vector3(22, 24, 22)
        ]);
        this.tmp = new THREE.Vector3();
        this.burstAt = [];
    }

    _makeArc() {
        const pts = this._arcPts(0.001);
        const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, 0.06, 6, false);
        const mat = new THREE.MeshBasicMaterial({
            color: 0xffe566,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        return { mesh: new THREE.Mesh(geo, mat), u: 0 };
    }

    _arcPts(u) {
        const n = 24;
        const pts = [];
        const um = Math.max(0.02, u);
        for (let i = 0; i <= n; i++) {
            const t = (i / n) * um;
            const x = -22 + t * 48;
            const y = 22 + Math.sin(t * Math.PI) * 18;
            const z = 8 + Math.sin(t * Math.PI) * -4;
            pts.push(new THREE.Vector3(x, y, z));
        }
        return pts;
    }

    spawnBurst(origin, color, count = 80) {
        const c = new THREE.Color(color);
        for (let i = 0; i < count; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const sp = 6 + Math.random() * 10;
            this.particles.push({
                x: origin.x, y: origin.y, z: origin.z,
                vx: Math.sin(phi) * Math.cos(theta) * sp,
                vy: Math.sin(phi) * Math.sin(theta) * sp + 4,
                vz: Math.cos(phi) * sp,
                life: 1.4 + Math.random() * 0.6,
                age: 0,
                r: c.r, g: c.g, b: c.b,
                size: 4 + Math.random() * 7
            });
        }
    }

    setIntro(t, audio) {
        // Estrela cadente 2.8s–4.6s
        if (t > 2.8 && t < 4.8) {
            const u = (t - 2.8) / 2;
            this.shooting.position.set(-60 + u * 90, 52 - u * 8, -20);
            this.shooting.material.opacity = u < 0.15 ? u / 0.15 : Math.max(0, 1 - (u - 0.7) / 0.3);
            this._emit(this.shooting.position, 0xfff6d0, 2, 3.5);
        } else {
            this.shooting.material.opacity = 0;
        }

        // Fada 9.5s–16.5s
        const fairyOn = t > 9.5 && t < 16.8;
        if (fairyOn) {
            const u = (t - 9.5) / 7.3;
            this.fairyPath.getPointAt(Math.min(0.999, u), this.tmp);
            this.fairy.position.copy(this.tmp);
            this.fairyGlow.position.copy(this.tmp);
            this.fairy.material.opacity = 1;
            this.fairyGlow.material.opacity = 0.55;
            this._emit(this.tmp, 0xffe9a0, 3, 5);
            const nextU = Math.min(1, u * 1.15);
            if (nextU - this.arc.u > 0.02 || nextU === 1) {
                this.arc.u = nextU;
                this._updateArc(this.arc.u);
            }
            this.arc.mesh.material.opacity = Math.min(0.85, u * 2);
        } else if (t >= 16.8) {
            this.fairy.material.opacity = 0;
            this.fairyGlow.material.opacity = 0;
            this.arc.mesh.material.opacity = Math.max(0, 0.85 - (t - 16.8) * 0.25);
        }

        // Fogos 15.2s em diante
        const cues = [
            [15.2, 8, 28, 10, 0xffd166],
            [16.0, -10, 32, 6, 0xff6b8a],
            [16.6, 14, 36, 4, 0x7ad7ff],
            [17.4, 0, 40, 2, 0xfff1a8],
            [18.2, -6, 30, 12, 0xff9f43],
            [19.0, 10, 34, 8, 0xe0aaff]
        ];
        for (const [when, x, y, z, color] of cues) {
            if (t >= when && !this.burstAt.includes(when)) {
                this.burstAt.push(when);
                this.spawnBurst(new THREE.Vector3(x, y, z), color, this.quality.burst);
                audio?.firework?.();
            }
        }
    }

    replay() {
        this.burstAt.length = 0;
        this.particles.length = 0;
        this.arc.u = 0;
        this.arc.mesh.material.opacity = 0;
        this.fairy.material.opacity = 0;
        this.fairyGlow.material.opacity = 0;
    }

    _updateArc(u) {
        const pts = this._arcPts(u);
        const curve = new THREE.CatmullRomCurve3(pts);
        const geo = new THREE.TubeGeometry(curve, 80, 0.055, 6, false);
        this.arc.mesh.geometry.dispose();
        this.arc.mesh.geometry = geo;
    }

    _emit(p, hex, n, size) {
        const c = new THREE.Color(hex);
        for (let i = 0; i < n; i++) {
            this.particles.push({
                x: p.x, y: p.y, z: p.z,
                vx: (Math.random() - 0.5) * 1.4,
                vy: (Math.random() - 0.5) * 1.4,
                vz: (Math.random() - 0.5) * 1.4,
                life: 0.7 + Math.random() * 0.5,
                age: 0,
                r: c.r, g: c.g, b: c.b,
                size: size * (0.6 + Math.random() * 0.6)
            });
        }
    }

    tick(dt) {
        const g = -18;
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.age += dt;
            p.vy += g * dt * 0.35;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.z += p.vz * dt;
            if (p.age >= p.life) this.particles.splice(i, 1);
        }
        const s = this.sparks;
        const n = Math.min(this.particles.length, s.max);
        for (let i = 0; i < n; i++) {
            const p = this.particles[i];
            const fade = 1 - p.age / p.life;
            s.pos[i * 3] = p.x;
            s.pos[i * 3 + 1] = p.y;
            s.pos[i * 3 + 2] = p.z;
            s.col[i * 3] = p.r * fade;
            s.col[i * 3 + 1] = p.g * fade;
            s.col[i * 3 + 2] = p.b * fade;
            s.size[i] = p.size * fade;
        }
        s.pts.geometry.setDrawRange(0, n);
        s.pts.geometry.attributes.position.needsUpdate = true;
        s.pts.geometry.attributes.aColor.needsUpdate = true;
        s.pts.geometry.attributes.aSize.needsUpdate = true;
    }
}
