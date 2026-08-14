/**
 * Ilha da Cúpola — terreno vertex-colorido, castelo pêssego, montanha,
 * plataformas flutuantes, canhão, água com ondas e colisão cilíndrica.
 */

import * as THREE from 'three';
import { ISLAND } from './config.js';
import { heightAt, inCave, caveFloor, terrainColor } from './utils.js';
import {
    n64Mat,
    createCastle,
    createTree,
    createCloud,
    createCannon,
    createFlag,
    createPlatform,
    createBush
} from './models.js';

export class World {
    constructor(scene, quality) {
        this.scene = scene;
        this.quality = quality;
        this.group = new THREE.Group();
        this.group.name = 'island';
        scene.add(this.group);

        this.solids = [];
        this.platforms = [];
        this.clouds = [];
        this.water = null;
        this.cannon = null;
        this.flag = null;

        this._lights();
        this._sky();
        this._terrain();
        this._water();
        this._castle();
        this._mountainBits();
        this._platforms();
        this._trees();
        this._cannon();
        this._clouds();
    }

    _lights() {
        this.scene.background = new THREE.Color(0x7ec8ff);
        this.scene.fog = new THREE.Fog(0x8fd2ff, 48, 110);

        const hemi = new THREE.HemisphereLight(0xfff1c8, 0x3a7a48, 1.12);
        this.scene.add(hemi);

        const sun = new THREE.DirectionalLight(0xfff4dc, 1.42);
        sun.position.set(32, 48, 18);
        sun.castShadow = !!this.quality.shadows;
        if (sun.castShadow) {
            sun.shadow.mapSize.set(this.quality.shadowSize, this.quality.shadowSize);
            sun.shadow.camera.near = 4;
            sun.shadow.camera.far = 120;
            sun.shadow.camera.left = -52;
            sun.shadow.camera.right = 52;
            sun.shadow.camera.top = 52;
            sun.shadow.camera.bottom = -52;
            sun.shadow.bias = -0.0007;
        }
        this.sun = sun;
        this.scene.add(sun);

        const fill = new THREE.DirectionalLight(0x88b8ff, 0.32);
        fill.position.set(-24, 10, -18);
        this.scene.add(fill);
    }

    _sky() {
        const canvas = document.createElement('canvas');
        canvas.width = 8;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        const g = ctx.createLinearGradient(0, 0, 0, 32);
        g.addColorStop(0, '#4aa4ff');
        g.addColorStop(0.45, '#7ec8ff');
        g.addColorStop(0.72, '#c8e8ff');
        g.addColorStop(1, '#f7e7c8');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 8, 32);
        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.magFilter = THREE.LinearFilter;
        const sky = new THREE.Mesh(
            new THREE.SphereGeometry(90, 16, 12),
            new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false })
        );
        this.scene.add(sky);
        this.sky = sky;
    }

    _terrain() {
        const segs = this.quality.grass > 0.7 ? 72 : 48;
        const size = 108;
        const geo = new THREE.PlaneGeometry(size, size, segs, segs);
        geo.rotateX(-Math.PI / 2);
        const pos = geo.attributes.position;
        const colors = [];
        const color = new THREE.Color();
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const z = pos.getZ(i);
            const y = heightAt(x, z);
            pos.setY(i, y);
            color.setHex(terrainColor(x, z, y));
            colors.push(color.r, color.g, color.b);
        }
        geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geo.computeVertexNormals();
        const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
        mat.onBeforeCompile = n64Mat(0xffffff).onBeforeCompile;
        mat.customProgramCacheKey = () => 'cupola64-terrain';
        const ground = new THREE.Mesh(geo, mat);
        ground.receiveShadow = true;
        this.group.add(ground);

        const ring = new THREE.Mesh(
            new THREE.RingGeometry(ISLAND.radius - 0.6, ISLAND.radius + 0.35, 48),
            n64Mat(0xffe14a)
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.08;
        this.group.add(ring);
    }

    _water() {
        const geo = new THREE.PlaneGeometry(160, 160, 24, 24);
        geo.rotateX(-Math.PI / 2);
        const mat = new THREE.MeshLambertMaterial({
            color: 0x3a9fe8,
            transparent: true,
            opacity: 0.72,
            flatShading: true
        });
        this.water = new THREE.Mesh(geo, mat);
        this.water.position.y = ISLAND.waterY;
        this.water.receiveShadow = true;
        this.scene.add(this.water);
        this._waterGeo = geo;
    }

    _castle() {
        const castle = createCastle();
        castle.position.set(0, heightAt(0, 25), 25);
        this.group.add(castle);
        this.castle = castle;
        this._solid(0, 24.2, 4.5);
        this._solid(-4.6, 22.8, 1.7);
        this._solid(4.6, 22.8, 1.7);
        this._platform(0, castle.position.y + 7.2, 25, 8.6, 7.2);
        this._platform(0, castle.position.y + 1.56, 35.4, 3.2, 6.5);
    }

    _mountainBits() {
        const steps = [
            [3, -14, 3.6, 4.2, 0.55, 2.4],
            [4.5, -17.2, 6.2, 3.4, 0.5, 2.2],
            [2.2, -20.4, 9.4, 3.2, 0.5, 2.2]
        ];
        for (const [x, z, y, w, h, d] of steps) {
            const p = createPlatform(w, h, d, 0xc4b49a);
            p.position.set(x, y, z);
            this.group.add(p);
            this._platform(x, y + h / 2, z, w, d);
        }

        const mouth = createPlatform(5.6, 3.2, 1.2, 0x5a4030);
        mouth.position.set(2.6, 6.4, -11.4);
        this.group.add(mouth);

        const caveFloorMesh = createPlatform(6.4, 0.4, 10.5, 0x6a5040);
        caveFloorMesh.position.set(2.6, 4.35, -16.6);
        this.group.add(caveFloorMesh);
        this._platform(2.6, 4.55, -16.6, 6.4, 10.5);

        this.flag = createFlag();
        this.flag.position.set(3, heightAt(3, -26) + 0.02, -26);
        this.group.add(this.flag);
    }

    _platforms() {
        const wood = [
            [12, 4.2, 2, 3.2, 0.35, 3.2],
            [16.5, 6.8, -1.5, 2.8, 0.35, 2.8],
            [20.5, 9.4, -4.2, 2.6, 0.35, 2.6],
            [24.5, 12.2, -5.5, 3.4, 0.4, 3.4],
            [28, 15.6, 2, 6.4, 0.55, 6.4],
            [-12, 3.6, 8, 2.8, 0.3, 2.8],
            [-14.5, 5.8, 12.5, 2.6, 0.3, 2.6],
            [-10, 8.2, 16, 2.4, 0.3, 2.4]
        ];
        for (const [x, y, z, w, h, d] of wood) {
            const p = createPlatform(w, h, d, 0xc4783a);
            p.position.set(x, y, z);
            const edge = createPlatform(w + 0.12, 0.12, d + 0.12, 0xffe14a);
            edge.position.set(x, y + h / 2 + 0.04, z);
            this.group.add(p, edge);
            this._platform(x, y + h / 2, z, w, d);
        }

        const skyHouse = createPlatform(2.2, 2.4, 2.2, 0xf3c4b4);
        skyHouse.position.set(28, 17.4, 2);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(1.7, 1.4, 4), n64Mat(0xc45c6a));
        roof.position.set(28, 19.3, 2);
        roof.rotation.y = Math.PI / 4;
        this.group.add(skyHouse, roof);
    }

    _trees() {
        const spots = [
            [-8, 10, 1.1], [10, 14, 0.9], [-14, -2, 1.25], [18, 18, 0.85],
            [-22, 8, 1], [8, -6, 0.95], [-6, 18, 0.8], [14, 6, 0.7],
            [-16, 16, 1.15], [6, 8, 0.65], [-10, -8, 1], [22, 12, 0.75]
        ];
        const n = Math.round(spots.length * this.quality.trees);
        for (let i = 0; i < n; i++) {
            const [x, z, s] = spots[i];
            const t = createTree(s);
            t.position.set(x, heightAt(x, z), z);
            this.group.add(t);
            this._solid(x, z, 0.45 * s);
        }
        const bushes = [[-4, 6], [5, 12], [-18, 2], [11, -2], [-7, -4]];
        for (const [x, z] of bushes) {
            const b = createBush();
            b.position.set(x, heightAt(x, z), z);
            this.group.add(b);
        }
    }

    _cannon() {
        this.cannon = createCannon();
        const x = 16;
        const z = 8;
        this.cannon.position.set(x, heightAt(x, z), z);
        this.cannon.rotation.y = -0.7;
        this.group.add(this.cannon);
        this.cannonPos = new THREE.Vector3(x, heightAt(x, z) + 0.6, z);
        this.cannonTarget = new THREE.Vector3(28, 16.4, 2);
        this._solid(x, z, 0.7);
    }

    _clouds() {
        const n = this.quality.clouds;
        for (let i = 0; i < n; i++) {
            const c = createCloud();
            const a = (i / n) * Math.PI * 2;
            c.position.set(Math.cos(a) * 38, 16 + (i % 4) * 2.4, Math.sin(a) * 38);
            c.scale.setScalar(1.4 + (i % 3) * 0.35);
            this.scene.add(c);
            this.clouds.push({ mesh: c, a, r: 36 + (i % 5) * 3, speed: 0.04 + (i % 4) * 0.01 });
        }
    }

    _solid(x, z, r) {
        this.solids.push({ x, z, r });
    }

    _platform(x, top, z, w, d) {
        this.platforms.push({ x, top, z, hx: w / 2, hz: d / 2 });
    }

    groundAt(x, z, y) {
        let h = heightAt(x, z);
        if (inCave(x, z, y)) h = caveFloor(x, z);
        for (const p of this.platforms) {
            if (Math.abs(x - p.x) <= p.hx + 0.12 && Math.abs(z - p.z) <= p.hz + 0.12) {
                if (y >= p.top - 0.9) h = Math.max(h, p.top);
            }
        }
        return h;
    }

    collide(x, z, radius) {
        let nx = x;
        let nz = z;
        for (const s of this.solids) {
            const dx = nx - s.x;
            const dz = nz - s.z;
            const d = Math.hypot(dx, dz);
            const min = s.r + radius;
            if (d < min && d > 1e-4) {
                const k = min / d;
                nx = s.x + dx * k;
                nz = s.z + dz * k;
            }
        }
        const r = Math.hypot(nx, nz);
        const rim = ISLAND.radius - 1.2;
        if (r > rim) {
            const k = rim / r;
            nx *= k;
            nz *= k;
        }
        return { x: nx, z: nz };
    }

    isWater(x, z, y) {
        const g = heightAt(x, z);
        return g < 0.08 && y <= ISLAND.waterY + 1.15;
    }

    nearCannon(x, z) {
        if (!this.cannonPos) return false;
        return Math.hypot(x - this.cannonPos.x, z - this.cannonPos.z) < 1.35;
    }

    update(dt, t) {
        for (const c of this.clouds) {
            c.a += c.speed * dt;
            c.mesh.position.x = Math.cos(c.a) * c.r;
            c.mesh.position.z = Math.sin(c.a) * c.r;
            c.mesh.position.y = 16 + Math.sin(t * 0.3 + c.a) * 0.6;
        }
        if (this._waterGeo) {
            const pos = this._waterGeo.attributes.position;
            for (let i = 0; i < pos.count; i++) {
                const x = pos.getX(i);
                const z = pos.getZ(i);
                pos.setY(i, Math.sin(x * 0.12 + t * 1.4) * 0.18 + Math.cos(z * 0.1 + t * 1.1) * 0.14);
            }
            pos.needsUpdate = true;
            this._waterGeo.computeVertexNormals();
        }
        const cloth = this.flag?.getObjectByName('cloth');
        if (cloth) cloth.rotation.y = Math.sin(t * 2.4) * 0.18;
        const cupola = this.castle?.getObjectByName('cupolaStar');
        if (cupola) {
            cupola.rotation.y += dt * 1.6;
            cupola.position.y = 12.5 + Math.sin(t * 2) * 0.12;
        }
    }

    cameraClearance(x, z) {
        return this.groundAt(x, z, 40) + 1.6;
    }
}
