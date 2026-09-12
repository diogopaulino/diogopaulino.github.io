/**
 * Mundo Costa Dourada — pista ribbon, oceano golden-hour, falésias e palmeiras.
 * Instancing + fog para manter FPS estável.
 */

import * as THREE from 'three';
import { mulberry32 } from './utils.js';

export class World {
    /**
     * @param {THREE.Scene} scene
     * @param {import('./track.js').Track} track
     * @param {object} quality
     */
    constructor(scene, track, quality) {
        this.scene = scene;
        this.track = track;
        this.quality = quality;
        this.clock = 0;

        scene.background = new THREE.Color(0x1a1418);
        scene.fog = new THREE.Fog(0xc48a5c, quality.fogNear, quality.fogFar);

        this._lights();
        this._sky();
        this._ocean();
        this._terrain();
        this._road();
        this._props();
    }

    _lights() {
        const hemi = new THREE.HemisphereLight(0xffc89a, 0x2a1810, 0.85);
        this.scene.add(hemi);

        this.sun = new THREE.DirectionalLight(0xffb070, 2.1);
        this.sun.position.set(-120, 55, 40);
        this.sun.castShadow = this.quality.shadows;
        if (this.quality.shadows) {
            this.sun.shadow.mapSize.set(this.quality.shadowSize, this.quality.shadowSize);
            this.sun.shadow.camera.near = 10;
            this.sun.shadow.camera.far = 320;
            this.sun.shadow.camera.left = -120;
            this.sun.shadow.camera.right = 120;
            this.sun.shadow.camera.top = 120;
            this.sun.shadow.camera.bottom = -120;
            this.sun.shadow.bias = -0.0002;
        }
        this.scene.add(this.sun);
        this.scene.add(new THREE.AmbientLight(0xffd2a8, 0.28));
    }

    _sky() {
        const geo = new THREE.SphereGeometry(800, 24, 12);
        const mat = new THREE.ShaderMaterial({
            side: THREE.BackSide,
            depthWrite: false,
            uniforms: {
                top: { value: new THREE.Color(0x1b2a4a) },
                mid: { value: new THREE.Color(0xe07a3a) },
                bot: { value: new THREE.Color(0xffc48a) }
            },
            vertexShader: `
                varying vec3 vPos;
                void main(){
                    vPos = position;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
                }`,
            fragmentShader: `
                uniform vec3 top; uniform vec3 mid; uniform vec3 bot;
                varying vec3 vPos;
                void main(){
                    float h = normalize(vPos).y;
                    vec3 col = mix(bot, mid, smoothstep(-0.15, 0.25, h));
                    col = mix(col, top, smoothstep(0.2, 0.85, h));
                    gl_FragColor = vec4(col, 1.0);
                }`
        });
        this.scene.add(new THREE.Mesh(geo, mat));

        const sunMesh = new THREE.Mesh(
            new THREE.SphereGeometry(14, 16, 12),
            new THREE.MeshBasicMaterial({ color: 0xffcc88 })
        );
        sunMesh.position.copy(this.sun.position).setLength(420);
        this.scene.add(sunMesh);
    }

    _ocean() {
        const seg = this.quality.oceanSeg;
        const geo = new THREE.PlaneGeometry(900, 900, seg, seg);
        geo.rotateX(-Math.PI / 2);
        this.oceanMat = new THREE.MeshStandardMaterial({
            color: 0x1a4a68,
            metalness: 0.75,
            roughness: 0.28,
            flatShading: true
        });
        this.ocean = new THREE.Mesh(geo, this.oceanMat);
        this.ocean.position.y = -1.2;
        this.ocean.receiveShadow = true;
        this.scene.add(this.ocean);
        this._oceanPositions = geo.attributes.position;
    }

    _terrain() {
        const ground = new THREE.Mesh(
            new THREE.CircleGeometry(420, 48),
            new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 1, metalness: 0 })
        );
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.6;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Falésias internas (lado esquerdo da pista)
        const cliffMat = new THREE.MeshStandardMaterial({ color: 0x8a5a3a, roughness: 0.95, flatShading: true });
        const cliffGeo = new THREE.ConeGeometry(6, 14, 5);
        const count = Math.floor(this.quality.rockCount * 0.7);
        const cliffs = new THREE.InstancedMesh(cliffGeo, cliffMat, count);
        const dummy = new THREE.Object3D();
        const rnd = mulberry32(42);
        for (let i = 0; i < count; i++) {
            const idx = Math.floor(rnd() * this.track.count);
            const s = this.track.sample(idx);
            const lat = -14 - rnd() * 28;
            dummy.position.set(s.x + s.nx * lat, s.y + 4 + rnd() * 6, s.z + s.nz * lat);
            dummy.rotation.set(rnd() * 0.2, rnd() * Math.PI, rnd() * 0.2);
            const sc = 0.7 + rnd() * 1.6;
            dummy.scale.set(sc, sc * (0.8 + rnd()), sc);
            dummy.updateMatrix();
            cliffs.setMatrixAt(i, dummy.matrix);
        }
        cliffs.castShadow = this.quality.shadows;
        cliffs.receiveShadow = true;
        this.scene.add(cliffs);
    }

    _road() {
        const track = this.track;
        const seg = Math.min(this.quality.roadSeg, track.count);
        const positions = [];
        const colors = [];
        const indices = [];
        const colAsphalt = new THREE.Color(0x2a2a2e);
        const colEdge = new THREE.Color(0xc4a878);

        for (let i = 0; i <= seg; i++) {
            const u = (i / seg) * track.count;
            const idx = Math.floor(u) % track.count;
            const half = track.halfWidthAt(idx);
            const s = track.sample(idx);
            const y = s.y + 0.03;
            // 4 verts across
            for (let k = 0; k < 4; k++) {
                const t = k / 3;
                const lat = -half + t * half * 2;
                positions.push(s.x + s.nx * lat, track.heightAt(idx, lat) + 0.04, s.z + s.nz * lat);
                const c = (k === 0 || k === 3) ? colEdge : colAsphalt;
                colors.push(c.r, c.g, c.b);
            }
        }
        for (let i = 0; i < seg; i++) {
            const a = i * 4;
            const b = (i + 1) * 4;
            for (let k = 0; k < 3; k++) {
                indices.push(a + k, b + k, b + k + 1);
                indices.push(a + k, b + k + 1, a + k + 1);
            }
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geo.setIndex(indices);
        geo.computeVertexNormals();
        const road = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
            vertexColors: true, roughness: 0.85, metalness: 0.05
        }));
        road.receiveShadow = true;
        this.scene.add(road);

        // Linha central tracejada simples
        const lineMat = new THREE.MeshBasicMaterial({ color: 0xe8dcc0 });
        const lineGeo = new THREE.BoxGeometry(0.12, 0.02, 2.2);
        const dashes = new THREE.InstancedMesh(lineGeo, lineMat, Math.floor(track.count / 3));
        const dummy = new THREE.Object3D();
        let di = 0;
        for (let i = 0; i < track.count; i += 3) {
            const s = track.sample(i);
            dummy.position.set(s.x, s.y + 0.06, s.z);
            dummy.rotation.y = s.yaw;
            dummy.updateMatrix();
            dashes.setMatrixAt(di++, dummy.matrix);
        }
        dashes.count = di;
        this.scene.add(dashes);
    }

    _props() {
        const rnd = mulberry32(99);
        const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 4.2, 6);
        const leafGeo = new THREE.ConeGeometry(1.6, 2.4, 6);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.9, flatShading: true });
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f6b3a, roughness: 0.85, flatShading: true });
        const n = this.quality.treeCount;
        const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, n);
        const leaves = new THREE.InstancedMesh(leafGeo, leafMat, n);
        const dummy = new THREE.Object3D();
        for (let i = 0; i < n; i++) {
            const idx = Math.floor(rnd() * this.track.count);
            const s = this.track.sample(idx);
            const side = rnd() > 0.35 ? -1 : 1;
            const lat = side * (10 + rnd() * 22);
            if (side > 0 && lat < 12) continue; // evita oceano perto
            const x = s.x + s.nx * lat;
            const z = s.z + s.nz * lat;
            const y = s.y;
            dummy.position.set(x, y + 2.1, z);
            dummy.rotation.y = rnd() * Math.PI;
            const sc = 0.75 + rnd() * 0.7;
            dummy.scale.set(sc, sc, sc);
            dummy.updateMatrix();
            trunks.setMatrixAt(i, dummy.matrix);
            dummy.position.y = y + 4.4 * sc;
            dummy.scale.set(sc, sc, sc);
            dummy.updateMatrix();
            leaves.setMatrixAt(i, dummy.matrix);
        }
        trunks.castShadow = leaves.castShadow = this.quality.shadows;
        this.scene.add(trunks, leaves);

        // Guard rails lado oceano
        const postGeo = new THREE.BoxGeometry(0.12, 0.7, 0.12);
        const railMat = new THREE.MeshStandardMaterial({ color: 0xb0b4b8, metalness: 0.7, roughness: 0.35 });
        const posts = new THREE.InstancedMesh(postGeo, railMat, Math.floor(this.track.count / 2));
        let pi = 0;
        for (let i = 0; i < this.track.count; i += 2) {
            const s = this.track.sample(i);
            const half = this.track.halfWidthAt(i);
            dummy.position.set(s.x + s.nx * (half + 0.6), s.y + 0.35, s.z + s.nz * (half + 0.6));
            dummy.rotation.set(0, s.yaw, 0);
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();
            posts.setMatrixAt(pi++, dummy.matrix);
        }
        posts.count = pi;
        this.scene.add(posts);
    }

    update(dt) {
        this.clock += dt;
        // Onda leve no oceano
        const pos = this._oceanPositions;
        if (!pos) return;
        const t = this.clock;
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const z = pos.getZ(i);
            const y = Math.sin(x * 0.03 + t * 1.2) * 0.35 + Math.cos(z * 0.025 - t * 0.9) * 0.28;
            pos.setY(i, y);
        }
        pos.needsUpdate = true;
    }
}
