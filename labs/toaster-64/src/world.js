/**
 * Pátio mashup: xadrez estilo N64, castelo pêssego, desktop Win95,
 * labirinto Pac-Man, céu com invasores e lixeira sugadora.
 */

import * as THREE from 'three';
import { ARENA } from './config.js';
import {
    retroMat,
    createCastle,
    createArcadeCabinet,
    createJoystickTree,
    createCloud,
    createRecycleBin,
    createInvader
} from './models.js';

export class World {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.group.name = 'world';
        scene.add(this.group);

        this.clouds = [];
        this.skyInvaders = [];
        this.bin = null;
        this.binSuction = new THREE.Vector3(0, 1.2, 0);

        this._lights();
        this._ground();
        this._bounds();
        this._castle();
        this._desktopHill();
        this._pacMaze();
        this._arcadeRow();
        this._trees();
        this._skyBits();
        this._taskbarWall();
    }

    _lights() {
        this.scene.background = new THREE.Color(0x7ec8ff);
        this.scene.fog = new THREE.Fog(0x7ec8ff, 42, 95);

        const hemi = new THREE.HemisphereLight(0xffd9a0, 0x3a6a48, 1.05);
        this.scene.add(hemi);

        const sun = new THREE.DirectionalLight(0xfff1d0, 1.35);
        sun.position.set(28, 42, 18);
        sun.castShadow = true;
        sun.shadow.mapSize.set(1024, 1024);
        sun.shadow.camera.near = 4;
        sun.shadow.camera.far = 110;
        sun.shadow.camera.left = -48;
        sun.shadow.camera.right = 48;
        sun.shadow.camera.top = 48;
        sun.shadow.camera.bottom = -48;
        sun.shadow.bias = -0.0008;
        this.sun = sun;
        this.scene.add(sun);

        const fill = new THREE.DirectionalLight(0x88a0ff, 0.35);
        fill.position.set(-20, 12, -16);
        this.scene.add(fill);
    }

    _ground() {
        const size = ARENA.wall * 2 + 8;
        const segs = 24;
        const geo = new THREE.PlaneGeometry(size, size, segs, segs);
        geo.rotateX(-Math.PI / 2);
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        const tile = 32;
        for (let y = 0; y < 16; y++) {
            for (let x = 0; x < 16; x++) {
                const mario = ((x + y) & 1) === 0;
                ctx.fillStyle = mario ? '#d94a4a' : '#f4efe2';
                if (x < 5 && y > 9) ctx.fillStyle = mario ? '#008080' : '#20b2aa';
                if (x > 10 && y < 6) ctx.fillStyle = mario ? '#1a1a28' : '#2e1060';
                ctx.fillRect(x * tile, y * tile, tile, tile);
            }
        }
        ctx.fillStyle = '#ffd24a';
        ctx.fillRect(240, 240, 32, 32);
        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(2, 2);
        const mat = new THREE.MeshLambertMaterial({ map: tex });
        mat.flatShading = true;
        const ground = new THREE.Mesh(geo, mat);
        ground.receiveShadow = true;
        this.group.add(ground);

        const ring = new THREE.Mesh(
            new THREE.RingGeometry(ARENA.half - 0.4, ARENA.half + 0.15, 48),
            retroMat(0xffe14a)
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.03;
        this.group.add(ring);
    }

    _bounds() {
        const h = 2.2;
        const t = 0.7;
        const L = ARENA.wall * 2;
        const mat = retroMat(0x5a3a28);
        const sides = [
            [0, h / 2, ARENA.wall, L, h, t],
            [0, h / 2, -ARENA.wall, L, h, t],
            [ARENA.wall, h / 2, 0, t, h, L],
            [-ARENA.wall, h / 2, 0, t, h, L]
        ];
        for (const [x, y, z, sx, sy, sz] of sides) {
            const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
            b.position.set(x, y, z);
            b.receiveShadow = true;
            this.group.add(b);
        }
    }

    _castle() {
        const castle = createCastle();
        castle.position.set(0, 0, -42);
        castle.scale.setScalar(1.15);
        this.group.add(castle);

        const plaque = new THREE.Mesh(new THREE.BoxGeometry(6, 1.2, 0.3), retroMat(0xffe14a));
        plaque.position.set(0, 2.2, -33.2);
        this.group.add(plaque);
    }

    _desktopHill() {
        const hill = new THREE.Mesh(new THREE.BoxGeometry(16, 1.2, 12), retroMat(0x008080));
        hill.position.set(-22, 0.6, 18);
        hill.receiveShadow = true;
        this.group.add(hill);

        const myComp = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.4, 0.8), retroMat(0xc0c0c0));
        myComp.position.set(-26, 2.4, 16);
        const screen = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 0.2), retroMat(0x103818));
        screen.position.set(-26, 2.7, 16.5);
        this.group.add(myComp, screen);

        this.bin = createRecycleBin();
        this.bin.position.set(-18, 1.2, 20);
        this.binSuction.copy(this.bin.position);
        this.binSuction.y = 1.4;
        this.group.add(this.bin);
    }

    _pacMaze() {
        const wallMat = retroMat(0x2030c8);
        const segs = [
            [18, 0.7, -8, 10, 1.4, 0.6],
            [22, 0.7, -2, 0.6, 1.4, 8],
            [14, 0.7, 2, 8, 1.4, 0.6],
            [12, 0.7, -4, 0.6, 1.4, 6],
            [20, 0.7, 8, 12, 1.4, 0.6]
        ];
        for (const [x, y, z, sx, sy, sz] of segs) {
            const w = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), wallMat);
            w.position.set(x, y, z);
            w.castShadow = true;
            w.receiveShadow = true;
            w.userData.solid = true;
            w.userData.aabb = { x, z, hx: sx / 2, hz: sz / 2 };
            this.group.add(w);
        }
        this.solids = this.group.children.filter((c) => c.userData.solid);
    }

    _arcadeRow() {
        for (let i = 0; i < 4; i++) {
            const cab = createArcadeCabinet();
            cab.position.set(-8 + i * 2.2, 0, 30);
            cab.rotation.y = Math.PI;
            this.group.add(cab);
        }
    }

    _trees() {
        const spots = [
            [-12, -18], [10, -20], [26, 14], [-28, -8], [8, 22], [-6, 14]
        ];
        for (const [x, z] of spots) {
            const t = createJoystickTree();
            t.position.set(x, 0, z);
            t.scale.setScalar(0.85 + Math.random() * 0.4);
            this.group.add(t);
        }
    }

    _skyBits() {
        for (let i = 0; i < 8; i++) {
            const c = createCloud();
            c.position.set(
                (Math.random() - 0.5) * 90,
                14 + Math.random() * 8,
                (Math.random() - 0.5) * 90
            );
            c.userData.drift = 0.4 + Math.random() * 0.8;
            this.clouds.push(c);
            this.group.add(c);
        }
        const colors = [0x5dff6a, 0xff5d7a, 0x5dc8ff, 0xffe14a];
        for (let i = 0; i < 6; i++) {
            const inv = createInvader(colors[i % colors.length]);
            inv.position.set(-18 + i * 7, 11 + (i % 2) * 1.4, -28);
            inv.userData.baseY = inv.position.y;
            inv.userData.phase = i * 0.7;
            this.skyInvaders.push(inv);
            this.group.add(inv);
        }
    }

    _taskbarWall() {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(22, 1.6, 0.5), retroMat(0xc0c0c0));
        bar.position.set(18, 0.8, 32.5);
        const start = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.2, 0.55), retroMat(0x008080));
        start.position.set(9.2, 0.8, 32.55);
        this.group.add(bar, start);
    }

    collideSolids(x, z, radius) {
        let nx = x;
        let nz = z;
        for (const s of this.solids || []) {
            const a = s.userData.aabb;
            const dx = nx - a.x;
            const dz = nz - a.z;
            const px = a.hx + radius;
            const pz = a.hz + radius;
            if (Math.abs(dx) < px && Math.abs(dz) < pz) {
                const ox = px - Math.abs(dx);
                const oz = pz - Math.abs(dz);
                if (ox < oz) nx += Math.sign(dx || 1) * ox;
                else nz += Math.sign(dz || 1) * oz;
            }
        }
        return { x: nx, z: nz };
    }

    update(t, dt) {
        for (const c of this.clouds) {
            c.position.x += c.userData.drift * dt;
            if (c.position.x > 50) c.position.x = -50;
            c.rotation.y += dt * 0.05;
        }
        for (const inv of this.skyInvaders) {
            inv.position.y = inv.userData.baseY + Math.sin(t * 2 + inv.userData.phase) * 0.45;
            inv.position.x += Math.sin(t * 0.4 + inv.userData.phase) * dt * 0.6;
        }
        if (this.bin) {
            const lid = this.bin.getObjectByName('lid');
            if (lid) lid.rotation.x = Math.sin(t * 2.2) * 0.25 - 0.15;
        }
    }

    setShadows(on) {
        if (this.sun) this.sun.castShadow = on;
    }
}
