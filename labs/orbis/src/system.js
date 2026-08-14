/**
 * Monta e anima o sistema estelar: estrela, exoplanetas, anéis, luas,
 * cinturão de asteroides, nébula e campo de estrelas.
 */
import * as THREE from 'three';
import {
    PLANET_VERT, PLANET_FRAG,
    CLOUD_VERT, CLOUD_FRAG,
    ATMOS_VERT, ATMOS_FRAG,
    RING_VERT, RING_FRAG,
    STAR_VERT, STAR_FRAG, CORONA_FRAG,
    NEBULA_VERT, NEBULA_FRAG,
    STARFIELD_VERT, STARFIELD_FRAG,
    MOON_FRAG
} from './shaders.js';

function color(rgb) {
    return new THREE.Color(rgb[0], rgb[1], rgb[2]);
}

function planetUniforms(p) {
    return {
        uTime: { value: 0 },
        uSeed: { value: p.seed },
        uKind: { value: p.kind },
        uWater: { value: p.water },
        uIce: { value: p.ice },
        uTemp: { value: p.temp },
        uMountain: { value: p.mountain },
        uWarp: { value: p.warp },
        uCities: { value: p.cities },
        uEmissive: { value: p.emissive },
        uBump: { value: 1 },
        uOceanDeep: { value: color(p.oceanDeep) },
        uOceanShallow: { value: color(p.oceanShallow) },
        uLandA: { value: color(p.landA) },
        uLandB: { value: color(p.landB) },
        uDesert: { value: color(p.desert) },
        uSnow: { value: color(p.snow) },
        uLava: { value: color(p.lava) },
        uSunPos: { value: new THREE.Vector3(0, 0, 0) }
    };
}

export class StarSystem {
    constructor(scene, quality) {
        this.scene = scene;
        this.quality = quality;
        this.group = new THREE.Group();
        this.scene.add(this.group);
        this.bodies = [];
        this.time = 0;
        this.data = null;

        this.sunPos = new THREE.Vector3(0, 0, 0);
        this._planetWorld = new THREE.Vector3();

        this._buildBackground();
        this.starGroup = new THREE.Group();
        this.group.add(this.starGroup);
        this.planetsGroup = new THREE.Group();
        this.group.add(this.planetsGroup);
        this.orbitLines = new THREE.Group();
        this.group.add(this.orbitLines);
    }

    _buildBackground() {
        const nebGeo = new THREE.SphereGeometry(90, 32, 20);
        this.nebulaUniforms = {
            uA: { value: new THREE.Color(0.03, 0.05, 0.14) },
            uB: { value: new THREE.Color(0.1, 0.03, 0.07) },
            uSeed: { value: 1 },
            uTime: { value: 0 }
        };
        const nebMat = new THREE.ShaderMaterial({
            uniforms: this.nebulaUniforms,
            vertexShader: NEBULA_VERT,
            fragmentShader: NEBULA_FRAG,
            side: THREE.BackSide,
            transparent: true,
            depthWrite: false,
            depthTest: false,
            blending: THREE.AdditiveBlending
        });
        this.nebula = new THREE.Mesh(nebGeo, nebMat);
        this.group.add(this.nebula);

        const count = this.quality.stars;
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const sizes = new Float32Array(count);
        const twinkle = new Float32Array(count);
        const palettes = [
            [1, 0.95, 0.9],
            [0.75, 0.85, 1],
            [1, 0.8, 0.55],
            [0.85, 0.9, 1],
            [1, 0.6, 0.45]
        ];
        for (let i = 0; i < count; i++) {
            const r = 38 + Math.random() * 48;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = r * Math.cos(phi);
            positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
            const c = palettes[i % palettes.length];
            const b = 0.45 + Math.random() * 0.55;
            colors[i * 3] = c[0] * b;
            colors[i * 3 + 1] = c[1] * b;
            colors[i * 3 + 2] = c[2] * b;
            sizes[i] = Math.random() < 0.08 ? 2.4 + Math.random() * 2.2 : 0.7 + Math.random() * 1.3;
            twinkle[i] = 0.4 + Math.random() * 3.5;
        }
        const starGeo = new THREE.BufferGeometry();
        starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        starGeo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
        starGeo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
        starGeo.setAttribute('aTwinkle', new THREE.BufferAttribute(twinkle, 1));
        this.starfieldUniforms = {
            uTime: { value: 0 },
            uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) }
        };
        const starMat = new THREE.ShaderMaterial({
            uniforms: this.starfieldUniforms,
            vertexShader: STARFIELD_VERT,
            fragmentShader: STARFIELD_FRAG,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        this.starfield = new THREE.Points(starGeo, starMat);
        this.group.add(this.starfield);
    }

    _clearGroup(group) {
        const disposeMat = (mat) => {
            if (!mat) return;
            if (Array.isArray(mat)) mat.forEach(disposeMat);
            else mat.dispose();
        };
        while (group.children.length) {
            const child = group.children[0];
            group.remove(child);
            child.traverse((obj) => {
                if (obj.geometry) obj.geometry.dispose();
                disposeMat(obj.material);
            });
        }
    }

    rebuild(data) {
        this.data = data;
        this._clearGroup(this.starGroup);
        this._clearGroup(this.planetsGroup);
        this._clearGroup(this.orbitLines);
        this.bodies = [];

        this.nebulaUniforms.uA.value.set(data.star.nebulaA[0], data.star.nebulaA[1], data.star.nebulaA[2]);
        this.nebulaUniforms.uB.value.set(data.star.nebulaB[0], data.star.nebulaB[1], data.star.nebulaB[2]);
        this.nebulaUniforms.uSeed.value = data.seed * 0.001;

        this._buildStar(data.star);
        this._buildBelt(data);
        data.planets.forEach((p, i) => this._buildPlanet(p, i));
    }

    _buildStar(star) {
        const seg = this.quality.starSeg;
        const geo = new THREE.SphereGeometry(star.radius, seg, Math.floor(seg * 0.7));
        this.starUniforms = {
            uTime: { value: 0 },
            uSeed: { value: star.seed },
            uLimb: { value: star.limb },
            uSpot: { value: star.spot },
            uColor: { value: color(star.color) }
        };
        const mat = new THREE.ShaderMaterial({
            uniforms: this.starUniforms,
            vertexShader: STAR_VERT,
            fragmentShader: STAR_FRAG
        });
        this.starMesh = new THREE.Mesh(geo, mat);
        this.starGroup.add(this.starMesh);

        const coronaUniforms = {
            uColor: { value: color(star.corona) },
            uDensity: { value: 0.55 }
        };
        const corona = new THREE.Mesh(
            new THREE.SphereGeometry(star.radius * 1.28, 32, 24),
            new THREE.ShaderMaterial({
                uniforms: coronaUniforms,
                vertexShader: PLANET_VERT,
                fragmentShader: CORONA_FRAG,
                side: THREE.BackSide,
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            })
        );
        this.starGroup.add(corona);

        const glow = new THREE.Mesh(
            new THREE.SphereGeometry(star.radius * 1.08, 24, 16),
            new THREE.ShaderMaterial({
                uniforms: { uColor: { value: color(star.color) }, uDensity: { value: 0.35 } },
                vertexShader: PLANET_VERT,
                fragmentShader: CORONA_FRAG,
                side: THREE.FrontSide,
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            })
        );
        this.starGroup.add(glow);

        this.pointLight = new THREE.PointLight(color(star.color), star.intensity, 48, 1.15);
        this.starGroup.add(this.pointLight);

        this.starSpin = star.spin;
    }

    _buildBelt(data) {
        const inner = data.belt.inner;
        const outer = data.belt.outer;
        if (!(outer > inner + 0.4)) return;

        const count = this.quality.asteroids;
        const pos = new Float32Array(count * 3);
        const col = new Float32Array(count * 3);
        const sizes = new Float32Array(count);
        const tw = new Float32Array(count);
        for (let i = 0; i < count; i++) {
            const a = Math.random() * Math.PI * 2;
            const r = inner + Math.random() * (outer - inner);
            const y = (Math.random() - 0.5) * 0.18;
            pos[i * 3] = Math.cos(a) * r;
            pos[i * 3 + 1] = y;
            pos[i * 3 + 2] = Math.sin(a) * r;
            const g = 0.45 + Math.random() * 0.35;
            col[i * 3] = g;
            col[i * 3 + 1] = g * 0.92;
            col[i * 3 + 2] = g * 0.8;
            sizes[i] = 0.35 + Math.random() * 0.7;
            tw[i] = 0.2;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
        geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
        geo.setAttribute('aTwinkle', new THREE.BufferAttribute(tw, 1));
        const mat = new THREE.ShaderMaterial({
            uniforms: this.starfieldUniforms,
            vertexShader: STARFIELD_VERT,
            fragmentShader: STARFIELD_FRAG,
            transparent: true,
            depthWrite: false
        });
        this.belt = new THREE.Points(geo, mat);
        this.planetsGroup.add(this.belt);
    }

    _buildPlanet(p, index) {
        const segs = this.quality.planetSeg;
        const root = new THREE.Group();
        root.rotation.x = p.inclination;
        this.planetsGroup.add(root);

        const holder = new THREE.Group();
        holder.position.x = p.orbit;
        root.add(holder);
        holder.rotation.z = p.tilt;

        const uniforms = planetUniforms(p);
        const planet = new THREE.Mesh(
            new THREE.SphereGeometry(p.radius, segs, Math.floor(segs * 0.7)),
            new THREE.ShaderMaterial({
                uniforms,
                vertexShader: PLANET_VERT,
                fragmentShader: PLANET_FRAG
            })
        );
        planet.userData.planetIndex = index;
        holder.add(planet);

        const cloudUniforms = {
            uTime: { value: 0 },
            uSeed: { value: p.cloudSeed },
            uCover: { value: p.clouds },
            uSunPos: { value: this.sunPos },
            uColor: { value: new THREE.Color(0.92, 0.94, 0.98) }
        };
        const clouds = new THREE.Mesh(
            new THREE.SphereGeometry(p.radius * 1.018, Math.floor(segs * 0.7), Math.floor(segs * 0.5)),
            new THREE.ShaderMaterial({
                uniforms: cloudUniforms,
                vertexShader: CLOUD_VERT,
                fragmentShader: CLOUD_FRAG,
                transparent: true,
                depthWrite: false
            })
        );
        clouds.userData.planetIndex = index;
        holder.add(clouds);

        const atmosUniforms = {
            uTime: { value: 0 },
            uDensity: { value: p.atmos },
            uAurora: { value: p.aurora },
            uColor: { value: color(p.atmosColor) },
            uColor2: { value: color(p.atmosColor2) },
            uSunPos: { value: this.sunPos }
        };
        const atmos = new THREE.Mesh(
            new THREE.SphereGeometry(p.radius * 1.12, 32, 24),
            new THREE.ShaderMaterial({
                uniforms: atmosUniforms,
                vertexShader: ATMOS_VERT,
                fragmentShader: ATMOS_FRAG,
                side: THREE.BackSide,
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            })
        );
        holder.add(atmos);

        const inner = p.radius * 1.45;
        const outer = p.radius * 2.35;
        const ringUniforms = {
            uInner: { value: inner },
            uOuter: { value: outer },
            uOpacity: { value: p.rings },
            uColor: { value: color(p.ringColor) },
            uSunPos: { value: this.sunPos },
            uPlanetPos: { value: new THREE.Vector3() },
            uPlanetRadius: { value: p.radius * 0.98 },
            uSeed: { value: p.seed }
        };
        const rings = new THREE.Mesh(
            new THREE.RingGeometry(inner, outer, 96, 4),
            new THREE.ShaderMaterial({
                uniforms: ringUniforms,
                vertexShader: RING_VERT,
                fragmentShader: RING_FRAG,
                side: THREE.DoubleSide,
                transparent: true,
                depthWrite: false
            })
        );
        rings.rotation.x = -Math.PI / 2;
        rings.visible = p.rings > 0.04;
        holder.add(rings);

        const moons = [];
        for (let m = 0; m < 2; m++) {
            const moonRoot = new THREE.Group();
            const moonHold = new THREE.Group();
            const dist = p.radius * (2.6 + m * 0.85);
            moonHold.position.x = dist;
            moonRoot.add(moonHold);
            const moonR = p.radius * (0.14 + m * 0.05);
            const moon = new THREE.Mesh(
                new THREE.SphereGeometry(moonR, 16, 12),
                new THREE.ShaderMaterial({
                    uniforms: {
                        uSeed: { value: p.seed + 20 + m },
                        uColor: { value: new THREE.Color(0.55, 0.52, 0.48) },
                        uSunPos: { value: this.sunPos }
                    },
                    vertexShader: PLANET_VERT,
                    fragmentShader: MOON_FRAG
                })
            );
            moonHold.add(moon);
            holder.add(moonRoot);
            moonRoot.visible = m < p.moons;
            moons.push({
                root: moonRoot,
                speed: 0.6 + m * 0.35,
                phase: Math.random() * Math.PI * 2
            });
        }

        const orbitGeo = new THREE.BufferGeometry();
        const pts = [];
        for (let i = 0; i <= 128; i++) {
            const a = (i / 128) * Math.PI * 2;
            pts.push(Math.cos(a) * p.orbit, 0, Math.sin(a) * p.orbit);
        }
        orbitGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
        const orbit = new THREE.Line(
            orbitGeo,
            new THREE.LineBasicMaterial({
                color: 0x8ec8ff,
                transparent: true,
                opacity: 0.14
            })
        );
        orbit.rotation.x = p.inclination;
        this.orbitLines.add(orbit);

        this.bodies.push({
            index,
            params: p,
            root,
            holder,
            planet,
            clouds,
            atmos,
            rings,
            moons,
            uniforms,
            cloudUniforms,
            atmosUniforms,
            ringUniforms,
            orbit,
            angle: p.phase,
            spin: 0
        });
    }

    applyParams(index, params) {
        const body = this.bodies[index];
        if (!body) return;
        body.params = params;
        const u = body.uniforms;
        u.uSeed.value = params.seed;
        u.uKind.value = params.kind;
        u.uWater.value = params.water;
        u.uIce.value = params.ice;
        u.uTemp.value = params.temp;
        u.uMountain.value = params.mountain;
        u.uWarp.value = params.warp;
        u.uCities.value = params.cities;
        u.uEmissive.value = params.emissive;
        u.uOceanDeep.value.set(params.oceanDeep[0], params.oceanDeep[1], params.oceanDeep[2]);
        u.uOceanShallow.value.set(params.oceanShallow[0], params.oceanShallow[1], params.oceanShallow[2]);
        u.uLandA.value.set(params.landA[0], params.landA[1], params.landA[2]);
        u.uLandB.value.set(params.landB[0], params.landB[1], params.landB[2]);
        u.uDesert.value.set(params.desert[0], params.desert[1], params.desert[2]);
        u.uSnow.value.set(params.snow[0], params.snow[1], params.snow[2]);
        u.uLava.value.set(params.lava[0], params.lava[1], params.lava[2]);

        body.cloudUniforms.uCover.value = params.clouds;
        body.atmosUniforms.uDensity.value = params.atmos;
        body.atmosUniforms.uAurora.value = params.aurora;
        body.atmosUniforms.uColor.value.set(params.atmosColor[0], params.atmosColor[1], params.atmosColor[2]);
        body.atmosUniforms.uColor2.value.set(params.atmosColor2[0], params.atmosColor2[1], params.atmosColor2[2]);
        body.ringUniforms.uOpacity.value = params.rings;
        body.ringUniforms.uColor.value.set(params.ringColor[0], params.ringColor[1], params.ringColor[2]);
        body.rings.visible = params.rings > 0.04;
        body.moons.forEach((m, i) => {
            m.root.visible = i < params.moons;
        });
    }

    getPlanetWorldPos(index, target) {
        const body = this.bodies[index];
        if (!body) return target.set(0, 0, 0);
        body.planet.getWorldPosition(target);
        return target;
    }

    getPlanetRadius(index) {
        return this.bodies[index]?.params.radius ?? 0.25;
    }

    pick(raycaster) {
        const meshes = [];
        this.bodies.forEach((b) => {
            meshes.push(b.planet, b.clouds);
        });
        const hits = raycaster.intersectObjects(meshes, false);
        if (!hits.length) return -1;
        return hits[0].object.userData.planetIndex ?? -1;
    }

    setSolo(index) {
        this.bodies.forEach((b, i) => {
            b.root.visible = index < 0 || i === index;
        });
        this.orbitLines.visible = index < 0;
        if (this.belt) this.belt.visible = index < 0;
    }

    setOrbitVisible(visible) {
        this.orbitLines.visible = visible;
        if (this.belt) this.belt.visible = visible;
    }

    highlight(index) {
        this.bodies.forEach((b, i) => {
            b.orbit.material.opacity = i === index ? 0.42 : 0.12;
            b.orbit.material.color.set(i === index ? 0xc9f0ff : 0x8ec8ff);
        });
    }

    update(dt, paused) {
        this.time += paused ? 0 : dt;
        const t = this.time;

        this.nebulaUniforms.uTime.value = t;
        this.starfieldUniforms.uTime.value = t;
        if (this.starUniforms) {
            this.starUniforms.uTime.value = t;
            this.starMesh.rotation.y += (paused ? 0 : this.starSpin) * dt;
        }
        if (this.belt && !paused) this.belt.rotation.y += dt * 0.012;

        this.bodies.forEach((b) => {
            if (!paused) {
                b.angle += b.params.orbitSpeed * dt;
                b.spin += b.params.spin * dt;
            }
            b.root.rotation.y = b.angle;
            b.planet.rotation.y = b.spin;
            b.clouds.rotation.y = b.spin * 1.18 + t * 0.02;
            b.uniforms.uTime.value = t;
            b.cloudUniforms.uTime.value = t;
            b.atmosUniforms.uTime.value = t;
            b.planet.getWorldPosition(this._planetWorld);
            b.ringUniforms.uPlanetPos.value.copy(this._planetWorld);
            b.moons.forEach((m) => {
                if (!paused) m.phase += m.speed * dt;
                m.root.rotation.y = m.phase;
                m.root.rotation.x = 0.2;
            });
        });
    }

    setPixelRatio(pr) {
        this.starfieldUniforms.uPixelRatio.value = pr;
    }
}
