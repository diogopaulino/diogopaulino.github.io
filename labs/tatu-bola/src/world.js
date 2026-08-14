/**
 * Ilha Faceta — terreno procedural, água, palmeiras, templo e sólidos.
 *
 * Altura do terreno (unidades de cartucho):
 *   r = hypot(x, z)
 *   shore = 1 - smoothstep(radius*0.72, radius, r)   // 1 no interior, 0 no oceano
 *   h = shore * (0.35 + 5.8·G_templo + 4.2·G_leste + 2.4·G_dunas
 *              + 0.55·sin(0.11x) + 0.42·cos(0.09z) + 0.22·sin(0.27x+0.18z))
 *   G = gauss(dx, dz, σ)
 *
 * Água em y = ISLAND.water. Sólidos (caixas AABB) sobem o jogador.
 */

import * as THREE from 'three';
import { ISLAND } from './config.js';
import { smoothstep, gauss, checkerTexture } from './utils.js';
import { retroMat, createPalm, createIdol, createCloud, createBoat } from './models.js';

const HILLS = [
    { x: 2, z: -20, s: 8.5, h: 6.4 },
    { x: 18, z: 4, s: 7.2, h: 4.4 },
    { x: -8, z: 16, s: 6.4, h: 2.6 },
    { x: -14, z: -6, s: 5.5, h: 2.2 }
];

export class World {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.group.name = 'world';
        scene.add(this.group);

        this.solids = [];
        this.movers = [];
        this.clouds = [];
        this.water = null;
        this.idolMesh = null;
        this.templeTop = 6;
        this.templeIdolY = 2;

        this._lights();
        this._terrain();
        this._water();
        this._temple();
        this._docks();
        this._platforms();
        this._palms();
        this._sky();
        this._idol();
    }

    /**
     * Amostra a altura do chão natural (sem plataformas).
     * Oceano devolve valores negativos.
     */
    heightAt(x, z) {
        const r = Math.hypot(x, z);
        const shore = 1 - smoothstep(ISLAND.radius * 0.72, ISLAND.radius, r);
        if (shore <= 0.001) return -3.5;
        let h = 0.38
            + 0.55 * Math.sin(x * 0.11)
            + 0.42 * Math.cos(z * 0.09)
            + 0.22 * Math.sin(x * 0.27 + z * 0.18);
        for (const hill of HILLS) {
            h += hill.h * gauss(x - hill.x, z - hill.z, hill.s);
        }
        return h * shore;
    }

    /** Piso efetivo: max(terreno, topo dos sólidos sob o ponto). */
    floorAt(x, z, y, radius = 0.5) {
        let floor = this.heightAt(x, z);
        let ride = null;
        for (const s of this.solids) {
            if (Math.abs(x - s.x) > s.hw + radius) continue;
            if (Math.abs(z - s.z) > s.hd + radius) continue;
            const top = s.y + s.hh;
            if (y + 0.35 >= top && top > floor) {
                floor = top;
                ride = s;
            }
        }
        return { floor, ride };
    }

    /** Empurra para fora de paredes (sólidos que o jogador atravessa de lado). */
    resolveWalls(pos, radius, feetY) {
        for (const s of this.solids) {
            if (s.noWall) continue;
            const dx = pos.x - s.x;
            const dz = pos.z - s.z;
            const px = s.hw + radius;
            const pz = s.hd + radius;
            if (Math.abs(dx) >= px || Math.abs(dz) >= pz) continue;
            const top = s.y + s.hh;
            const bot = s.y - s.hh;
            if (feetY > top - 0.12 || feetY + 1.1 < bot) continue;
            if (px - Math.abs(dx) < pz - Math.abs(dz)) {
                pos.x = s.x + Math.sign(dx || 1) * px;
            } else {
                pos.z = s.z + Math.sign(dz || 1) * pz;
            }
        }
        const r = Math.hypot(pos.x, pos.z);
        const maxR = ISLAND.radius + 6;
        if (r > maxR) {
            pos.x *= maxR / r;
            pos.z *= maxR / r;
        }
    }

    addSolid(x, y, z, w, h, d, { noWall = false, mover = null } = {}) {
        const s = { x, y, z, hw: w / 2, hh: h / 2, hd: d / 2, noWall, mover, ox: x, oz: z, oy: y };
        this.solids.push(s);
        return s;
    }

    setShadows(on) {
        if (this.sun) this.sun.castShadow = on;
    }

    update(time, dt) {
        if (this.water) {
            this.water.position.y = ISLAND.water + Math.sin(time * 1.1) * 0.06;
            this.water.material.opacity = 0.62 + Math.sin(time * 0.7) * 0.05;
        }
        for (const m of this.movers) {
            const t = time * m.speed + m.phase;
            if (m.axis === 'x') m.solid.x = m.solid.ox + Math.sin(t) * m.amp;
            else if (m.axis === 'z') m.solid.z = m.solid.oz + Math.sin(t) * m.amp;
            else m.solid.y = m.solid.oy + Math.sin(t) * m.amp;
            m.mesh.position.set(m.solid.x, m.solid.y, m.solid.z);
            m.dx = m.solid.x - (m._lx ?? m.solid.x);
            m.dz = m.solid.z - (m._lz ?? m.solid.z);
            m._lx = m.solid.x;
            m._lz = m.solid.z;
        }
        for (const c of this.clouds) {
            c.position.x += dt * c.userData.vx;
            if (c.position.x > 50) c.position.x = -50;
        }
        if (this.boat) {
            this.boat.rotation.z = Math.sin(time * 1.4) * 0.06;
            this.boat.position.y = 0.12 + Math.sin(time * 1.6) * 0.05;
        }
    }

    _lights() {
        const fog = 0xff9a72;
        this.scene.background = new THREE.Color(fog);
        this.scene.fog = new THREE.Fog(fog, ISLAND.fogNear, ISLAND.fogFar);

        const hemi = new THREE.HemisphereLight(0xffd4a8, 0x2a6a58, 1.05);
        this.scene.add(hemi);

        const sun = new THREE.DirectionalLight(0xfff0d0, 1.28);
        sun.position.set(22, 34, 16);
        sun.castShadow = true;
        sun.shadow.mapSize.set(1024, 1024);
        sun.shadow.camera.near = 4;
        sun.shadow.camera.far = 90;
        sun.shadow.camera.left = -42;
        sun.shadow.camera.right = 42;
        sun.shadow.camera.top = 42;
        sun.shadow.camera.bottom = -42;
        sun.shadow.bias = -0.0009;
        this.sun = sun;
        this.scene.add(sun);

        const fill = new THREE.DirectionalLight(0xffc8a0, 0.38);
        fill.position.set(-18, 10, -14);
        this.scene.add(fill);

        const mag = new THREE.PointLight(0xff6aa0, 0.35, 22);
        mag.position.set(2, 6, -18);
        this.scene.add(mag);
    }

    _terrain() {
        const size = ISLAND.radius * 2.4;
        const segs = 56;
        const geo = new THREE.PlaneGeometry(size, size, segs, segs);
        geo.rotateX(-Math.PI / 2);
        const pos = geo.attributes.position;
        const colors = [];
        const sand = new THREE.Color(0xe8c878);
        const grass = new THREE.Color(0x3aaa4a);
        const rock = new THREE.Color(0x8a7a68);
        const wet = new THREE.Color(0xd4b060);
        const tmp = new THREE.Color();
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const z = pos.getZ(i);
            const h = this.heightAt(x, z);
            pos.setY(i, Math.max(h, -0.4));
            const r = Math.hypot(x, z);
            if (h < 0.55) tmp.copy(wet).lerp(sand, Math.max(0, h));
            else if (h < 2.4) tmp.copy(sand).lerp(grass, smoothstep(0.55, 2.2, h));
            else tmp.copy(grass).lerp(rock, smoothstep(2.4, 5.5, h));
            if (r > ISLAND.radius * 0.92) tmp.copy(wet);
            colors.push(tmp.r, tmp.g, tmp.b);
        }
        geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geo.computeVertexNormals();
        const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
        const land = new THREE.Mesh(geo, mat);
        land.receiveShadow = true;
        this.group.add(land);

        const ring = new THREE.Mesh(
            new THREE.RingGeometry(ISLAND.radius - 0.6, ISLAND.radius + 0.2, 48),
            retroMat(0xffe07a, { transparent: true, opacity: 0.35 })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.12;
        this.group.add(ring);
    }

    _water() {
        const canvas = checkerTexture('#1e7ab8', '#2a98d0', 16, 128);
        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(18, 18);
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        tex.colorSpace = THREE.SRGBColorSpace;
        const mat = new THREE.MeshLambertMaterial({
            map: tex,
            transparent: true,
            opacity: 0.64,
            depthWrite: false
        });
        const water = new THREE.Mesh(new THREE.PlaneGeometry(160, 160, 1, 1), mat);
        water.rotation.x = -Math.PI / 2;
        water.position.y = ISLAND.water;
        this.water = water;
        this.group.add(water);
    }

    _box(x, y, z, w, h, d, color, opts) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), retroMat(color));
        m.position.set(x, y, z);
        m.castShadow = true;
        m.receiveShadow = true;
        this.group.add(m);
        const solid = this.addSolid(x, y, z, w, h, d, opts);
        return { mesh: m, solid };
    }

    _temple() {
        const x = 2;
        const z = -20;
        const g = this.heightAt(x, z);
        this._box(x, g + 0.55, z, 8.4, 1.1, 8.4, 0xc8b090);
        this._box(x, g + 1.45, z, 6.4, 0.7, 6.4, 0xd4c4a0);
        this._box(x, g + 2.55, z, 4.2, 1.5, 4.2, 0xbba480);
        this._box(x, g + 3.7, z, 2.6, 0.8, 2.6, 0xe8d8b0);
        this._box(x, g + 4.5, z, 1.4, 0.85, 1.4, 0xffe07a);
        this.templeTop = g + 4.5 + 0.425;
        this.templeIdolY = g + 1.1;

        for (const px of [-2.4, 6.4]) {
            this._box(px, g + 1.9, z + 4.4, 0.7, 3.8, 0.7, 0xd8c8a0);
        }
        this._box(x, g + 0.85, z + 6.2, 3.2, 0.32, 2.2, 0xc4a878, { noWall: true });
        this._box(x, g + 1.35, z + 5.2, 2.4, 0.28, 1.6, 0xc4a878, { noWall: true });
    }

    _docks() {
        const x = -16;
        const z = 9;
        const g = Math.max(0.12, this.heightAt(x, z));
        this._box(x, g + 0.16, z, 6.5, 0.28, 2.2, 0x8a5a28, { noWall: true });
        this._box(x - 3.4, g + 0.4, z, 0.25, 0.9, 2.0, 0x6a3a18);
        const boat = createBoat();
        boat.position.set(-22, 0.12, 9);
        boat.rotation.y = Math.PI / 2;
        this.group.add(boat);
        this.boat = boat;
    }

    _platforms() {
        const lift = (x, z, extra) => Math.max(this.heightAt(x, z) + extra, extra + 0.4);
        this.platCrystalY = lift(14, -12, 1.6) + 0.7;
        this._box(14, lift(14, -12, 1.6), -12, 2.4, 0.35, 2.4, 0xc4a060, { noWall: true });
        this._box(17.5, lift(17.5, -14, 2.4), -14, 2.1, 0.32, 2.1, 0xc4a060, { noWall: true });
        this.floatA = lift(10, -8, 1.5);
        this.floatB = lift(-8, -8, 1.8);

        const a = this._box(10, this.floatA, -8, 2.2, 0.3, 2.2, 0x7af0ff, { noWall: true });
        this.movers.push({
            solid: a.solid, mesh: a.mesh, axis: 'x', amp: 3.2, speed: 0.7, phase: 0, dx: 0, dz: 0
        });
        a.solid.mover = this.movers[this.movers.length - 1];

        const b = this._box(-8, this.floatB, -8, 2.0, 0.3, 2.0, 0xff3d8a, { noWall: true });
        this.movers.push({
            solid: b.solid, mesh: b.mesh, axis: 'z', amp: 2.6, speed: 0.85, phase: 1.2, dx: 0, dz: 0
        });
        b.solid.mover = this.movers[this.movers.length - 1];

        const ruinG = this.heightAt(-10, -8);
        this._box(-10, ruinG + 0.85, -8, 2.6, 1.7, 2.6, 0x9a8a78);
        this._box(-10, ruinG + 1.95, -8, 1.8, 0.5, 1.8, 0xb8a890);
    }

    _palms() {
        const spots = [
            [6, 10], [-4, 12], [10, 6], [-18, 4],
            [20, 8], [8, 18], [-6, 20], [22, -2],
            [-20, -4], [4, 2]
        ];
        for (const [x, z] of spots) {
            const palm = createPalm();
            const y = Math.max(0, this.heightAt(x, z));
            palm.position.set(x, y, z);
            palm.rotation.y = Math.random() * Math.PI;
            palm.scale.setScalar(0.85 + Math.random() * 0.35);
            this.group.add(palm);
        }
    }

    _sky() {
        for (let i = 0; i < 8; i++) {
            const c = createCloud();
            c.position.set(-40 + i * 12, 10 + (i % 3) * 1.6, -28 + (i % 4) * 8);
            c.userData.vx = 0.35 + (i % 3) * 0.12;
            c.scale.setScalar(1.4 + (i % 3) * 0.3);
            this.group.add(c);
            this.clouds.push(c);
        }
    }

    _idol() {
        const idol = createIdol();
        idol.position.set(2, this.templeIdolY, -18);
        this.group.add(idol);
        this.idolMesh = idol;
    }
}
