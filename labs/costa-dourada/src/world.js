/**
 * Mundo hyperrealista — Sky + Water, asfalto/rocha/areia/grama PBR,
 * falésias, palmeiras (casca PBR + frondes alpha) e impostores distantes.
 */

import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { Water } from 'three/addons/objects/Water.js';
import { mulberry32 } from './utils.js';

const TEX = {
    asphaltDiff: new URL('../assets/textures/asphalt_diff.jpg', import.meta.url).href,
    asphaltNor: new URL('../assets/textures/asphalt_nor.jpg', import.meta.url).href,
    asphaltRough: new URL('../assets/textures/asphalt_rough.jpg', import.meta.url).href,
    rockDiff: new URL('../assets/textures/rock_diff.jpg', import.meta.url).href,
    rockNor: new URL('../assets/textures/rock_nor.jpg', import.meta.url).href,
    sandDiff: new URL('../assets/textures/sand_diff.jpg', import.meta.url).href,
    sandNor: new URL('../assets/textures/sand_nor.jpg', import.meta.url).href,
    grassDiff: new URL('../assets/textures/grass_diff.jpg', import.meta.url).href,
    grassNor: new URL('../assets/textures/grass_nor.jpg', import.meta.url).href,
    barkDiff: new URL('../assets/textures/bark_diff.jpg', import.meta.url).href,
    barkNor: new URL('../assets/textures/bark_nor.jpg', import.meta.url).href,
    waterNor: new URL('../assets/textures/waternormals.jpg', import.meta.url).href,
    palmBillboard: new URL('../assets/veg/palm_billboard.png', import.meta.url).href,
    treeAtlas: new URL('../assets/veg/tree_atlas.png', import.meta.url).href
};

function loadMap(url, { colorSpace = THREE.SRGBColorSpace, wrap = true, repeat = 1 } = {}) {
    return new Promise((resolve, reject) => {
        new THREE.TextureLoader().load(
            url,
            (tex) => {
                tex.colorSpace = colorSpace;
                if (wrap) {
                    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
                    tex.repeat.set(repeat, repeat);
                    tex.anisotropy = 8;
                }
                resolve(tex);
            },
            undefined,
            reject
        );
    });
}

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
        this.envMap = null;
        this.palms = [];
        this.ready = this._build();
    }

    async _build() {
        this.scene.fog = new THREE.FogExp2(0xb87a52, 0.00135);

        const maps = await this._loadTextures();
        this.maps = maps;

        this._lights();
        this._sky();
        this._ocean(maps.waterNor);
        this._beach(maps);
        this._road(maps);
        this._cliffs(maps);
        this._palms(maps);
        this._guardRails();
        this._finishGantry();
    }

    async _loadTextures() {
        const [
            asphaltDiff, asphaltNor, asphaltRough,
            rockDiff, rockNor,
            sandDiff, sandNor,
            grassDiff, grassNor,
            barkDiff, barkNor,
            waterNor, palmBillboard, treeAtlas
        ] = await Promise.all([
            loadMap(TEX.asphaltDiff, { repeat: 10 }),
            loadMap(TEX.asphaltNor, { colorSpace: THREE.NoColorSpace, repeat: 10 }),
            loadMap(TEX.asphaltRough, { colorSpace: THREE.NoColorSpace, repeat: 10 }),
            loadMap(TEX.rockDiff, { repeat: 5 }),
            loadMap(TEX.rockNor, { colorSpace: THREE.NoColorSpace, repeat: 5 }),
            loadMap(TEX.sandDiff, { repeat: 14 }),
            loadMap(TEX.sandNor, { colorSpace: THREE.NoColorSpace, repeat: 14 }),
            loadMap(TEX.grassDiff, { repeat: 8 }),
            loadMap(TEX.grassNor, { colorSpace: THREE.NoColorSpace, repeat: 8 }),
            loadMap(TEX.barkDiff, { repeat: 2 }),
            loadMap(TEX.barkNor, { colorSpace: THREE.NoColorSpace, repeat: 2 }),
            loadMap(TEX.waterNor, { colorSpace: THREE.NoColorSpace, wrap: true, repeat: 4 }),
            loadMap(TEX.palmBillboard, { wrap: false }),
            loadMap(TEX.treeAtlas, { wrap: false })
        ]);
        return {
            asphaltDiff, asphaltNor, asphaltRough,
            rockDiff, rockNor, sandDiff, sandNor,
            grassDiff, grassNor, barkDiff, barkNor,
            waterNor, palmBillboard, treeAtlas
        };
    }

    _lights() {
        this.scene.add(new THREE.HemisphereLight(0xffc9a0, 0x2a1810, 0.6));
        this.sun = new THREE.DirectionalLight(0xffb070, 3.4);
        this.sun.castShadow = this.quality.shadows;
        if (this.quality.shadows) {
            const s = this.quality.shadowSize || 1024;
            this.sun.shadow.mapSize.set(s, s);
            this.sun.shadow.camera.near = 5;
            this.sun.shadow.camera.far = 280;
            this.sun.shadow.camera.left = -95;
            this.sun.shadow.camera.right = 95;
            this.sun.shadow.camera.top = 95;
            this.sun.shadow.camera.bottom = -95;
            this.sun.shadow.bias = -0.00012;
            this.sun.shadow.normalBias = 0.03;
        }
        this.scene.add(this.sun);
        this.scene.add(this.sun.target);
        this.scene.add(new THREE.AmbientLight(0xffd2a8, 0.2));
        const fill = new THREE.DirectionalLight(0xff8855, 0.5);
        fill.position.set(40, 12, -60);
        this.scene.add(fill);
    }

    _sky() {
        this.sky = new Sky();
        this.sky.scale.setScalar(4500);
        this.scene.add(this.sky);

        const u = this.sky.material.uniforms;
        u.turbidity.value = 7.5;
        u.rayleigh.value = 2.35;
        u.mieCoefficient.value = 0.016;
        u.mieDirectionalG.value = 0.9;

        const sunPos = new THREE.Vector3();
        sunPos.setFromSphericalCoords(
            1,
            THREE.MathUtils.degToRad(84.5),
            THREE.MathUtils.degToRad(178)
        );
        u.sunPosition.value.copy(sunPos);
        this._sunDir = sunPos.clone().normalize();
        this.sun.position.copy(this._sunDir).multiplyScalar(120);
        // Sky mesh é o fundo — não sobrescrever com cor sólida
        this.scene.background = null;
    }

    _ocean(waterNormals) {
        // Low: plano simples — Water shader é caro em software GL
        if (this.quality.id === 'low') {
            const mat = new THREE.MeshStandardMaterial({
                color: 0x0a4a5c,
                roughness: 0.35,
                metalness: 0.2,
                envMapIntensity: 0.8
            });
            this.water = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), mat);
            this.water.rotation.x = -Math.PI / 2;
            this.water.position.y = -0.9;
            this.scene.add(this.water);
            this._simpleWater = true;
            return;
        }
        this.water = new Water(new THREE.PlaneGeometry(1600, 1600), {
            textureWidth: this.quality.shadows ? 512 : 256,
            textureHeight: this.quality.shadows ? 512 : 256,
            waterNormals,
            sunDirection: this._sunDir.clone(),
            sunColor: 0xffc090,
            waterColor: 0x083848,
            distortionScale: 3.1,
            fog: Boolean(this.scene.fog)
        });
        this.water.rotation.x = -Math.PI / 2;
        this.water.position.y = -0.9;
        this.scene.add(this.water);
    }

    _beach(maps) {
        const sand = new THREE.MeshStandardMaterial({
            map: maps.sandDiff,
            normalMap: maps.sandNor,
            normalScale: new THREE.Vector2(1.35, 1.35),
            roughness: 0.96,
            metalness: 0.02
        });
        const ground = new THREE.Mesh(new THREE.CircleGeometry(560, 80), sand);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.58;
        ground.receiveShadow = true;
        this.scene.add(ground);

        const grass = new THREE.Mesh(
            new THREE.RingGeometry(38, 210, 96),
            new THREE.MeshStandardMaterial({
                map: maps.grassDiff,
                normalMap: maps.grassNor,
                normalScale: new THREE.Vector2(1.1, 1.1),
                roughness: 0.9,
                metalness: 0.02
            })
        );
        grass.rotation.x = -Math.PI / 2;
        grass.position.y = -0.52;
        grass.receiveShadow = true;
        this.scene.add(grass);
    }

    _road(maps) {
        const track = this.track;
        const seg = Math.min(this.quality.roadSeg || track.count, track.count);
        const halfBase = track.halfWidth;
        const positions = [];
        const normals = [];
        const uvs = [];
        const indices = [];

        let distAcc = 0;
        for (let i = 0; i <= seg; i++) {
            const idx = Math.floor((i / seg) * track.count) % track.count;
            const half = track.halfWidthAt(idx);
            const s = track.sample(idx);
            if (i > 0) {
                const prev = track.sample(Math.floor(((i - 1) / seg) * track.count) % track.count);
                distAcc += Math.hypot(s.x - prev.x, s.z - prev.z);
            }
            for (let k = 0; k < 5; k++) {
                const t = k / 4;
                const lat = -half + t * half * 2;
                const crown = 1 - Math.abs(t - 0.5) * 2;
                const y = track.heightAt(idx, lat) + 0.05 + crown * 0.04;
                positions.push(s.x + s.nx * lat, y, s.z + s.nz * lat);
                normals.push(0, 1, 0);
                uvs.push(t * (half / halfBase) * 2.2, distAcc * 0.14);
            }
        }
        for (let i = 0; i < seg; i++) {
            const a = i * 5;
            const b = (i + 1) * 5;
            for (let k = 0; k < 4; k++) {
                indices.push(a + k, b + k, b + k + 1, a + k, b + k + 1, a + k + 1);
            }
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geo.setIndex(indices);
        geo.computeVertexNormals();

        const road = new THREE.Mesh(
            geo,
            new THREE.MeshStandardMaterial({
                map: maps.asphaltDiff,
                normalMap: maps.asphaltNor,
                roughnessMap: maps.asphaltRough,
                roughness: 0.9,
                metalness: 0.05,
                envMapIntensity: 0.4
            })
        );
        road.receiveShadow = true;
        this.scene.add(road);
        this._roadMarkings();
    }

    _roadMarkings() {
        const track = this.track;
        const yellow = new THREE.MeshStandardMaterial({
            color: 0xe8c84a, roughness: 0.6, metalness: 0.05,
            emissive: 0x3a2a00, emissiveIntensity: 0.12
        });
        const white = new THREE.MeshStandardMaterial({
            color: 0xf2f0ea, roughness: 0.68, metalness: 0.04
        });
        const dashGeo = new THREE.BoxGeometry(0.14, 0.02, 2.5);
        const edgeGeo = new THREE.BoxGeometry(0.16, 0.025, 3.2);
        const center = new THREE.InstancedMesh(dashGeo, yellow, Math.floor(track.count / 2));
        const left = new THREE.InstancedMesh(edgeGeo, white, track.count);
        const right = new THREE.InstancedMesh(edgeGeo, white, track.count);
        const dummy = new THREE.Object3D();

        let ci = 0;
        for (let i = 0; i < track.count; i += 2) {
            const s = track.sample(i);
            dummy.position.set(s.x, s.y + 0.08, s.z);
            dummy.rotation.set(0, s.yaw, 0);
            dummy.updateMatrix();
            center.setMatrixAt(ci++, dummy.matrix);
        }
        center.count = ci;

        for (let i = 0; i < track.count; i++) {
            const s = track.sample(i);
            const half = track.halfWidthAt(i) - 0.22;
            dummy.position.set(s.x + s.nx * -half, s.y + 0.08, s.z + s.nz * -half);
            dummy.rotation.set(0, s.yaw, 0);
            dummy.updateMatrix();
            left.setMatrixAt(i, dummy.matrix);
            dummy.position.set(s.x + s.nx * half, s.y + 0.08, s.z + s.nz * half);
            dummy.updateMatrix();
            right.setMatrixAt(i, dummy.matrix);
        }
        this.scene.add(center, left, right);
    }

    _cliffs(maps) {
        const rockMat = new THREE.MeshStandardMaterial({
            map: maps.rockDiff,
            normalMap: maps.rockNor,
            normalScale: new THREE.Vector2(1.4, 1.4),
            roughness: 0.94,
            metalness: 0.05
        });
        const grassMat = new THREE.MeshStandardMaterial({
            map: maps.grassDiff,
            normalMap: maps.grassNor,
            roughness: 0.9,
            metalness: 0.02
        });

        const rnd = mulberry32(42);
        // Só em trechos da pista (não um anel contínuo colado no grid)
        const positions = [];
        const uvs = [];
        const indices = [];
        const hLevels = [0, 0.3, 0.55, 0.78, 1];
        let col = 0;
        const step = 3;
        for (let idx = 0; idx < this.track.count; idx += step) {
            // Pular largada / reta principal (~primeiro quinto)
            const frac = idx / this.track.count;
            if (frac < 0.12 || frac > 0.92) continue;
            if (rnd() < 0.35) continue;

            const s = this.track.sample(idx);
            const baseLat = -22 - (idx % 11) * 0.7 - rnd() * 4;
            for (let h = 0; h < hLevels.length; h++) {
                const elev = hLevels[h];
                const jagged = Math.sin(idx * 0.31 + elev * 3.2) * 1.1 + rnd() * 0.7;
                const lat = baseLat - elev * (5.5 + jagged);
                const y = s.y - 0.2 + elev * (8 + (idx % 5) * 0.5) + jagged * 0.25;
                positions.push(s.x + s.nx * lat, y, s.z + s.nz * lat);
                uvs.push(col * 0.35, elev * 1.8);
            }
            if (col > 0) {
                const a = (col - 1) * hLevels.length;
                const b = col * hLevels.length;
                // Só conectar se os pontos forem próximos (mesmo trecho)
                const px = positions[a * 3];
                const pz = positions[a * 3 + 2];
                const qx = positions[b * 3];
                const qz = positions[b * 3 + 2];
                if (Math.hypot(px - qx, pz - qz) < step * 8) {
                    for (let h = 0; h < hLevels.length - 1; h++) {
                        indices.push(a + h, b + h, b + h + 1, a + h, b + h + 1, a + h + 1);
                    }
                }
            }
            col++;
        }
        if (positions.length > 10 && indices.length > 0) {
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
            geo.setIndex(indices);
            geo.computeVertexNormals();
            const cliff = new THREE.Mesh(geo, rockMat);
            cliff.name = 'cliffs';
            cliff.castShadow = this.quality.shadows;
            cliff.receiveShadow = true;
            this.scene.add(cliff);
        }

        // Rochas soltas — longe da pista
        const boulderGeo = new THREE.IcosahedronGeometry(1.35, 2);
        {
            const pos = boulderGeo.attributes.position;
            for (let i = 0; i < pos.count; i++) {
                const x = pos.getX(i);
                const y = pos.getY(i);
                const z = pos.getZ(i);
                const n = 0.82 + 0.28 * Math.sin(x * 3.1 + y * 2.4) * Math.cos(z * 2.7);
                pos.setXYZ(i, x * n, y * n * 0.75, z * n);
            }
            boulderGeo.computeVertexNormals();
        }
        const count = this.quality.rockCount || 36;
        const boulders = new THREE.InstancedMesh(boulderGeo, rockMat, count);
        boulders.name = 'boulders';
        const dummy = new THREE.Object3D();
        let placed = 0;
        let guard = 0;
        while (placed < count && guard < count * 10) {
            guard++;
            const idx = Math.floor(rnd() * this.track.count);
            const s = this.track.sample(idx);
            const side = rnd() > 0.65 ? -1 : 1;
            const lat = side * (18 + rnd() * 28);
            if (Math.abs(lat) < this.track.halfWidthAt(idx) + 10) continue;
            dummy.position.set(s.x + s.nx * lat, s.y - 0.15 + rnd() * 1.1, s.z + s.nz * lat);
            dummy.rotation.set(rnd() * Math.PI, rnd() * Math.PI, rnd() * Math.PI);
            const sc = 0.55 + rnd() * 1.7;
            dummy.scale.set(sc, sc * (0.55 + rnd() * 0.7), sc);
            dummy.updateMatrix();
            boulders.setMatrixAt(placed++, dummy.matrix);
        }
        boulders.count = placed;
        boulders.castShadow = this.quality.shadows;
        boulders.receiveShadow = true;
        this.scene.add(boulders);
    }

    _palms(maps) {
        const rnd = mulberry32(99);
        const n = Math.min(this.quality.treeCount || 56, this.quality.id === 'low' ? 18 : this.quality.treeCount);

        const barkMat = new THREE.MeshStandardMaterial({
            map: maps.barkDiff,
            normalMap: maps.barkNor,
            normalScale: new THREE.Vector2(1.4, 1.4),
            roughness: 0.92,
            metalness: 0.04
        });
        const frondMat = new THREE.MeshStandardMaterial({
            map: maps.palmBillboard,
            transparent: true,
            alphaTest: 0.42,
            side: THREE.DoubleSide,
            depthWrite: true,
            roughness: 0.85,
            metalness: 0.02
        });

        const path = [];
        for (let i = 0; i <= 14; i++) {
            const t = i / 14;
            const r = 0.34 - t * 0.16 + Math.sin(t * Math.PI * 6) * 0.018;
            path.push(new THREE.Vector2(r, t * 7.2));
        }
        const trunkGeo = new THREE.LatheGeometry(path, 12);
        const frondGeo = new THREE.PlaneGeometry(5.8, 7.4);
        const group = new THREE.Group();
        group.name = 'palms';

        for (let i = 0; i < n; i++) {
            const idx = Math.floor(rnd() * this.track.count);
            const s = this.track.sample(idx);
            const side = rnd() > 0.38 ? -1 : 1;
            let lat = side * (14 + rnd() * 28);
            if (side > 0 && Math.abs(lat) < 16) lat = 16 + rnd() * 14;
            // Evitar largada
            if (idx < this.track.count * 0.08 || idx > this.track.count * 0.95) continue;

            const palm = new THREE.Group();
            const trunk = new THREE.Mesh(trunkGeo, barkMat);
            trunk.castShadow = this.quality.shadows;
            trunk.receiveShadow = true;
            trunk.rotation.z = (rnd() - 0.5) * 0.12;
            trunk.rotation.x = (rnd() - 0.5) * 0.1;
            palm.add(trunk);

            const f1 = new THREE.Mesh(frondGeo, frondMat);
            f1.position.y = 6.6;
            f1.castShadow = this.quality.shadows;
            const f2 = f1.clone();
            f2.rotation.y = Math.PI / 2;
            palm.add(f1, f2);

            palm.position.set(s.x + s.nx * lat, s.y - 0.2, s.z + s.nz * lat);
            palm.rotation.y = rnd() * Math.PI * 2;
            palm.scale.setScalar(0.9 + rnd() * 0.55);
            palm.userData.fronds = [f1, f2];
            group.add(palm);
            this.palms.push(palm);
        }
        this.scene.add(group);
    }


    _guardRails() {
        const postMat = new THREE.MeshStandardMaterial({
            color: 0xb8bcc0, metalness: 0.88, roughness: 0.26
        });
        const railMat = new THREE.MeshStandardMaterial({
            color: 0xd0d4d8, metalness: 0.92, roughness: 0.2
        });
        const n = Math.floor(this.track.count / 2);
        const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.09, 0.85, 0.09), postMat, n);
        const rails = new THREE.InstancedMesh(new THREE.BoxGeometry(0.05, 0.09, 2.6), railMat, n);
        const dummy = new THREE.Object3D();
        let pi = 0;
        for (let i = 0; i < this.track.count; i += 2) {
            const s = this.track.sample(i);
            const half = this.track.halfWidthAt(i) + 0.65;
            dummy.position.set(s.x + s.nx * half, s.y + 0.4, s.z + s.nz * half);
            dummy.rotation.set(0, s.yaw, 0);
            dummy.updateMatrix();
            posts.setMatrixAt(pi, dummy.matrix);
            dummy.position.y = s.y + 0.55;
            dummy.updateMatrix();
            rails.setMatrixAt(pi, dummy.matrix);
            pi++;
        }
        posts.count = rails.count = pi;
        posts.castShadow = rails.castShadow = this.quality.shadows;
        this.scene.add(posts, rails);
    }

    _finishGantry() {
        const mat = new THREE.MeshStandardMaterial({ color: 0xe8e4dc, metalness: 0.45, roughness: 0.42 });
        const stripe = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.7 });
        const pose = this.track.poseAtDistance(0, 0);
        const s0 = this.track.sample(0);
        const g = new THREE.Group();
        const half = this.track.halfWidth + 1.2;
        for (const side of [-1, 1]) {
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 5.2, 12), mat);
            pole.position.set(s0.nx * half * side, 2.6, s0.nz * half * side);
            pole.castShadow = true;
            g.add(pole);
        }
        const beam = new THREE.Mesh(new THREE.BoxGeometry(half * 2 + 0.5, 0.35, 0.35), mat);
        beam.position.y = 5.1;
        g.add(beam);
        const banner = new THREE.Mesh(new THREE.BoxGeometry(half * 2, 0.9, 0.08), stripe);
        banner.position.y = 4.55;
        g.add(banner);
        g.position.set(pose.x, pose.y, pose.z);
        g.rotation.y = pose.yaw;
        this.scene.add(g);
    }

    /** EnvMap do céu (PMREM) para reflexos no Ferrari e no asfalto. */
    bakeEnvMap(renderer) {
        const pmrem = new THREE.PMREMGenerator(renderer);
        pmrem.compileEquirectangularShader();
        const rt = pmrem.fromScene(this.sky, 0.04);
        this.envMap = rt.texture;
        this.scene.environment = this.envMap;
        pmrem.dispose();
        return this.envMap;
    }

    /** Sombra segue o carro mantendo a direção golden-hour. */
    followSun(x, y, z) {
        if (!this.sun || !this._sunDir) return;
        this.sun.target.position.set(x, y, z);
        this.sun.position.set(
            x + this._sunDir.x * 110,
            y + this._sunDir.y * 110,
            z + this._sunDir.z * 110
        );
        this.sun.target.updateMatrixWorld();
    }

    update(dt) {
        this.clock += dt;
        if (this.water && !this._simpleWater && this.water.material?.uniforms) {
            this.water.material.uniforms.time.value += dt;
            this.water.material.uniforms.sunDirection?.value.copy(this._sunDir);
        }
        if (this.palms.length) {
            const wind = Math.sin(this.clock * 1.3) * 0.04;
            for (const palm of this.palms) {
                for (const f of palm.userData.fronds || []) f.rotation.z = wind;
            }
        }
    }
}
