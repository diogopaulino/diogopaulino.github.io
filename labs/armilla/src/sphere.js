/**
 * Esfera armilar: gaiola estática, anéis musicais, núcleo e fagulhas.
 * Um passo dispara quando a estrela cruza o pente (ângulo 0 do frame).
 */

import * as THREE from 'three';
import { RING_DEFS, STEPS, STEP_ANGLE, TWO_PI } from './config.js';
import { NEBULA_VERT, NEBULA_FRAG, makeSparkTexture } from './shaders.js';

function hexColor(hex) {
    return new THREE.Color(hex);
}

function passed(prev, curr, target) {
    const p = ((prev % TWO_PI) + TWO_PI) % TWO_PI;
    const c = ((curr % TWO_PI) + TWO_PI) % TWO_PI;
    const t = ((target % TWO_PI) + TWO_PI) % TWO_PI;
    if (p <= c) return p <= t && t < c;
    return p <= t || t < c;
}

function sparkMap() {
    const tex = new THREE.CanvasTexture(makeSparkTexture());
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

export class ArmillaSphere {
    constructor(scene, quality) {
        this.scene = scene;
        this.quality = quality;
        this.root = new THREE.Group();
        scene.add(this.root);

        this.rings = [];
        this.pattern = RING_DEFS.map(() => new Array(STEPS).fill(0));
        this.muted = [false, false, false, false];
        this.energy = 0;
        this.intro = 1;
        this.time = 0;
        this.hover = null;
        this.selected = 2;

        this._flashes = [];
        this._waves = [];
        this._beams = [];
        this._tmp = new THREE.Vector3();
        this._tmp2 = new THREE.Vector3();
        this._dir = new THREE.Vector3();
        this._up = new THREE.Vector3(0, 1, 0);

        this._buildSky();
        this._buildCage();
        this._buildCore();
        this._buildRings();
        this._buildParticles();
    }

    _buildSky() {
        const geo = new THREE.SphereGeometry(80, 32, 24);
        this.nebulaMat = new THREE.ShaderMaterial({
            vertexShader: NEBULA_VERT,
            fragmentShader: NEBULA_FRAG,
            uniforms: {
                uTime: { value: 0 },
                uA: { value: new THREE.Color('#070510') },
                uB: { value: new THREE.Color('#1a1038') },
                uC: { value: new THREE.Color('#3a1848') }
            },
            side: THREE.BackSide,
            depthWrite: false
        });
        this.root.add(new THREE.Mesh(geo, this.nebulaMat));

        const starCount = this.quality.stars;
        const starGeo = new THREE.BufferGeometry();
        const pos = new Float32Array(starCount * 3);
        const col = new Float32Array(starCount * 3);
        const c = new THREE.Color();
        for (let i = 0; i < starCount; i++) {
            const r = 28 + Math.random() * 48;
            const u = Math.random();
            const v = Math.random();
            const theta = TWO_PI * u;
            const phi = Math.acos(2 * v - 1);
            pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            pos[i * 3 + 1] = r * Math.cos(phi);
            pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
            c.setHSL(0.55 + Math.random() * 0.2, 0.35, 0.7 + Math.random() * 0.3);
            col[i * 3] = c.r;
            col[i * 3 + 1] = c.g;
            col[i * 3 + 2] = c.b;
        }
        starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        starGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        this.root.add(new THREE.Points(
            starGeo,
            new THREE.PointsMaterial({
                size: 0.11,
                vertexColors: true,
                transparent: true,
                opacity: 0.85,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                map: sparkMap(),
                sizeAttenuation: true
            })
        ));
    }

    _buildCage() {
        this.cage = new THREE.Group();
        this.root.add(this.cage);
        const mat = new THREE.MeshStandardMaterial({
            color: 0x8a93ab,
            metalness: 0.85,
            roughness: 0.28,
            emissive: 0x1a2030,
            emissiveIntensity: 0.35
        });
        const glow = new THREE.MeshBasicMaterial({
            color: 0x9bb0ff,
            transparent: true,
            opacity: 0.12,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        const makeRing = (r, tube, rot) => {
            const t = new THREE.TorusGeometry(r, tube, 10, 96);
            const m = new THREE.Mesh(t, mat);
            m.rotation.set(rot[0], rot[1], rot[2]);
            this.cage.add(m);
            const g = new THREE.Mesh(new THREE.TorusGeometry(r, tube * 2.4, 8, 64), glow);
            g.rotation.copy(m.rotation);
            this.cage.add(g);
        };

        makeRing(5.15, 0.016, [Math.PI / 2, 0, 0]);
        makeRing(5.15, 0.014, [0, 0, 0]);
        makeRing(5.15, 0.014, [0, Math.PI / 2, 0]);

        const disc = new THREE.Mesh(
            new THREE.CircleGeometry(5.15, 64),
            new THREE.MeshBasicMaterial({
                color: 0x7ea2ff,
                transparent: true,
                opacity: 0.035,
                side: THREE.DoubleSide,
                depthWrite: false
            })
        );
        disc.rotation.x = -Math.PI / 2;
        this.cage.add(disc);
    }

    _buildCore() {
        this.core = new THREE.Group();
        this.root.add(this.core);

        const inner = new THREE.Mesh(
            new THREE.IcosahedronGeometry(0.42, 2),
            new THREE.MeshStandardMaterial({
                color: 0xffe6b8,
                emissive: 0xffc878,
                emissiveIntensity: 1.4,
                metalness: 0.2,
                roughness: 0.18
            })
        );
        this.coreInner = inner;
        this.core.add(inner);

        const shell = new THREE.Mesh(
            new THREE.IcosahedronGeometry(0.58, 1),
            new THREE.MeshBasicMaterial({
                color: 0xffd9a0,
                wireframe: true,
                transparent: true,
                opacity: 0.55
            })
        );
        this.coreShell = shell;
        this.core.add(shell);

        const halo = new THREE.Mesh(
            new THREE.SphereGeometry(0.78, 24, 16),
            new THREE.MeshBasicMaterial({
                color: 0xffb14a,
                transparent: true,
                opacity: 0.16,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            })
        );
        this.coreHalo = halo;
        this.core.add(halo);

        this.coreLight = new THREE.PointLight(0xffc878, 4.5, 18, 1.6);
        this.core.add(this.coreLight);
    }

    _buildRings() {
        this.beadGeo = new THREE.OctahedronGeometry(0.11, 0);
        this.hitGeo = new THREE.SphereGeometry(0.16, 10, 8);

        RING_DEFS.forEach((def, index) => {
            const color = hexColor(def.color);
            const frame = new THREE.Group();
            frame.rotation.set(def.tilt[0], def.tilt[1], def.tilt[2]);
            this.root.add(frame);

            const spinner = new THREE.Group();
            frame.add(spinner);

            const tube = new THREE.Mesh(
                new THREE.TorusGeometry(def.radius, def.tube, 12, 96),
                new THREE.MeshStandardMaterial({
                    color: color.clone().multiplyScalar(0.35),
                    emissive: color,
                    emissiveIntensity: 0.55,
                    metalness: 0.7,
                    roughness: 0.22
                })
            );
            spinner.add(tube);

            const glow = new THREE.Mesh(
                new THREE.TorusGeometry(def.radius, def.tube * 3.2, 8, 64),
                new THREE.MeshBasicMaterial({
                    color,
                    transparent: true,
                    opacity: 0.18,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false
                })
            );
            spinner.add(glow);

            const hitTube = new THREE.Mesh(
                new THREE.TorusGeometry(def.radius, 0.16, 8, 64),
                new THREE.MeshBasicMaterial({ visible: false })
            );
            hitTube.userData = { kind: 'ring', ring: index };
            spinner.add(hitTube);

            const gate = this._makeGate(def.radius, color);
            frame.add(gate);

            const beads = [];
            for (let step = 0; step < STEPS; step++) {
                const angle = step * STEP_ANGLE;
                const bead = new THREE.Mesh(
                    this.beadGeo,
                    new THREE.MeshStandardMaterial({
                        color: color.clone().multiplyScalar(0.4),
                        emissive: color,
                        emissiveIntensity: 0.9,
                        metalness: 0.35,
                        roughness: 0.25,
                        transparent: true,
                        opacity: 1
                    })
                );
                bead.position.set(Math.cos(angle) * def.radius, Math.sin(angle) * def.radius, 0);
                bead.userData = { kind: 'bead', ring: index, step };
                spinner.add(bead);

                const hit = new THREE.Mesh(
                    this.hitGeo,
                    new THREE.MeshBasicMaterial({ visible: false })
                );
                hit.position.copy(bead.position);
                hit.userData = { kind: 'bead', ring: index, step };
                spinner.add(hit);

                beads.push({ mesh: bead, hit, angle, pulse: 0 });
            }

            const light = new THREE.PointLight(color, 0, 7.5, 2);
            frame.add(light);

            this.rings.push({
                def,
                index,
                color,
                frame,
                spinner,
                tube,
                glow,
                gate,
                hitTube,
                beads,
                light,
                rot: 0,
                prevRot: 0,
                gateGlow: 0
            });
        });
    }

    _makeGate(radius, color) {
        const g = new THREE.Group();
        const mat = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.85,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.55, 0.06), mat);
        bar.position.set(radius, 0, 0);
        g.add(bar);
        const slit = new THREE.Mesh(
            new THREE.PlaneGeometry(0.12, 1.15),
            new THREE.MeshBasicMaterial({
                color,
                transparent: true,
                opacity: 0.22,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                side: THREE.DoubleSide
            })
        );
        slit.position.set(radius, 0, 0);
        g.add(slit);
        const nub = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), mat);
        nub.position.set(radius, 0.32, 0);
        g.add(nub);
        const nub2 = nub.clone();
        nub2.position.y = -0.32;
        g.add(nub2);
        g.userData.slit = slit;
        return g;
    }

    _buildParticles() {
        const count = this.quality.dust;
        this.pCount = count;
        this.pLife = new Float32Array(count);
        this.pVel = new Float32Array(count * 3);
        const pos = new Float32Array(count * 3);
        const col = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            pos[i * 3 + 1] = 80;
            this.pLife[i] = 0;
        }
        this.pGeo = new THREE.BufferGeometry();
        this.pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        this.pGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        this.pMat = new THREE.PointsMaterial({
            size: 0.16,
            map: sparkMap(),
            vertexColors: true,
            transparent: true,
            opacity: 0.9,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        this.particles = new THREE.Points(this.pGeo, this.pMat);
        this.root.add(this.particles);

        this._waveGeo = new THREE.TorusGeometry(1, 0.012, 6, 48);
        this._beamGeo = new THREE.CylinderGeometry(0.012, 0.004, 1, 6, 1, true);
        this._flashGeo = new THREE.SphereGeometry(0.22, 12, 10);
    }

    setPattern(pattern) {
        this.pattern = pattern.map((row) => row.slice());
        this._syncBeads();
    }

    setMuted(index, muted) {
        this.muted[index] = muted;
        const ring = this.rings[index];
        if (ring) ring.glow.material.opacity = muted ? 0.05 : 0.18;
    }

    setSelected(index) {
        this.selected = index;
    }

    toggleStep(ring, step) {
        const row = this.pattern[ring];
        if (!row) return row;
        row[step] = row[step] ? 0 : 1;
        this._syncBead(ring, step);
        return row[step];
    }

    _syncBeads() {
        for (let r = 0; r < this.rings.length; r++) {
            for (let s = 0; s < STEPS; s++) this._syncBead(r, s);
        }
    }

    _syncBead(ringIndex, step) {
        const ring = this.rings[ringIndex];
        const on = this.pattern[ringIndex][step];
        const bead = ring.beads[step].mesh;
        bead.visible = true;
        bead.scale.setScalar(on ? 1 : 0.38);
        bead.material.transparent = true;
        bead.material.depthWrite = !on;
        bead.material.emissiveIntensity = on ? 1.15 : 0.12;
        bead.material.opacity = on ? 1 : 0.22;
        bead.userData.on = !!on;
    }

    pick(raycaster) {
        const hits = [];
        this.rings.forEach((ring) => {
            ring.beads.forEach((b) => hits.push(b.hit));
            hits.push(ring.hitTube);
        });
        const found = raycaster.intersectObjects(hits.filter(Boolean), false);
        if (!found.length) return null;
        const obj = found[0].object;
        if (obj.userData.kind === 'bead') {
            return { kind: 'bead', ring: obj.userData.ring, step: obj.userData.step };
        }
        if (obj.userData.kind === 'ring') {
            const ring = this.rings[obj.userData.ring];
            const local = ring.spinner.worldToLocal(found[0].point.clone());
            let angle = Math.atan2(local.y, local.x);
            if (angle < 0) angle += TWO_PI;
            const step = Math.round(angle / STEP_ANGLE) % STEPS;
            return { kind: 'ring', ring: obj.userData.ring, step };
        }
        return null;
    }

    setHover(hit) {
        this.hover = hit;
    }

    /**
     * Avança a órbita. Retorna disparos { ring, step } quando uma estrela
     * ativa cruza o pente do anel.
     */
    update(dt, playing, bpm) {
        this.time += dt;
        this.energy += (0 - this.energy) * Math.min(1, dt * 2.4);
        if (this.intro > 0) {
            this.intro = Math.max(0, this.intro - dt * 0.55);
        }

        const unfold = 1 - this.intro ** 2;
        this.nebulaMat.uniforms.uTime.value = this.time;

        this.coreShell.rotation.y += dt * 0.18;
        this.coreShell.rotation.x += dt * 0.07;
        const coreScale = 1 + this.energy * 0.18;
        this.core.scale.setScalar(coreScale);
        this.coreHalo.material.opacity = 0.12 + this.energy * 0.28;
        this.coreLight.intensity = 3.2 + this.energy * 8;

        this.cage.rotation.y += dt * 0.015;

        const triggers = [];
        const period = 240 / Math.max(40, bpm);

        this.rings.forEach((ring, ri) => {
            const def = RING_DEFS[ri];
            const tiltX = def.tilt[0] * unfold;
            const tiltY = def.tilt[1] * unfold;
            const tiltZ = def.tilt[2] * unfold;
            ring.frame.rotation.set(tiltX, tiltY, tiltZ);

            ring.prevRot = ring.rot;
            if (playing && this.intro <= 0.08) {
                ring.rot += (TWO_PI / (period / def.speed)) * dt;
            }
            ring.spinner.rotation.z = ring.rot;

            const selected = this.selected === ri;
            ring.glow.material.opacity = (this.muted[ri] ? 0.04 : 0.16) + (selected ? 0.1 : 0) + ring.gateGlow * 0.25;
            ring.gateGlow += (0 - ring.gateGlow) * Math.min(1, dt * 6);
            const slit = ring.gate.userData.slit;
            if (slit) slit.material.opacity = 0.16 + ring.gateGlow * 0.55;

            ring.light.intensity += (0 - ring.light.intensity) * Math.min(1, dt * 5);

            if (playing && this.intro <= 0.08) {
                for (let s = 0; s < STEPS; s++) {
                    if (!this.pattern[ri][s]) continue;
                    const target = -ring.beads[s].angle;
                    if (passed(ring.prevRot, ring.rot, target)) {
                        triggers.push({ ring: ri, step: s });
                    }
                }
            }

            ring.beads.forEach((b, s) => {
                b.pulse += (0 - b.pulse) * Math.min(1, dt * 7);
                const on = this.pattern[ri][s];
                const hover = this.hover && this.hover.ring === ri && this.hover.step === s;
                const base = on ? 1 : 0.38;
                const extra = b.pulse * 0.7 + (hover ? 0.28 : 0);
                b.mesh.scale.setScalar(base + extra);
                b.mesh.rotation.x += dt * (1.2 + b.pulse * 4);
                b.mesh.rotation.y += dt * 0.8;
                if (on) {
                    b.mesh.material.emissiveIntensity = 0.85 + b.pulse * 2.4 + (hover ? 0.4 : 0);
                    b.mesh.material.opacity = 1;
                } else {
                    b.mesh.material.emissiveIntensity = hover ? 0.55 : 0.1;
                    b.mesh.material.opacity = hover ? 0.7 : 0.18;
                }
            });
        });

        this._updateFx(dt);
        return triggers;
    }

    flash(ringIndex, step) {
        const ring = this.rings[ringIndex];
        if (!ring) return;
        const bead = ring.beads[step];
        bead.pulse = 1;
        ring.gateGlow = 1;
        ring.light.intensity = 3.8;
        this.energy = Math.min(1.4, this.energy + 0.22);

        bead.mesh.getWorldPosition(this._tmp);
        this._spawnFlash(this._tmp, ring.color);
        this._spawnWave(ring, this._tmp);
        this._spawnBeam(this._tmp, ring.color);
        this._burst(this._tmp, ring.color);
    }

    _spawnFlash(pos, color) {
        let mesh = this._flashes.find((m) => !m.userData.alive);
        if (!mesh) {
            mesh = new THREE.Mesh(
                this._flashGeo,
                new THREE.MeshBasicMaterial({
                    color,
                    transparent: true,
                    opacity: 0.9,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false
                })
            );
            this.root.add(mesh);
            this._flashes.push(mesh);
        }
        mesh.position.copy(pos);
        mesh.material.color.copy(color);
        mesh.material.opacity = 0.95;
        mesh.scale.setScalar(0.6);
        mesh.visible = true;
        mesh.userData.alive = true;
        mesh.userData.life = 1;
    }

    _spawnWave(ring, pos) {
        let mesh = this._waves.find((m) => !m.userData.alive);
        if (!mesh) {
            mesh = new THREE.Mesh(
                this._waveGeo,
                new THREE.MeshBasicMaterial({
                    color: 0xffffff,
                    transparent: true,
                    opacity: 0.7,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false
                })
            );
            this.root.add(mesh);
            this._waves.push(mesh);
        }
        mesh.position.copy(pos);
        mesh.quaternion.copy(ring.frame.quaternion);
        mesh.material.color.copy(ring.color);
        mesh.material.opacity = 0.65;
        mesh.scale.setScalar(ring.def.radius * 0.15);
        mesh.visible = true;
        mesh.userData.alive = true;
        mesh.userData.life = 1;
        mesh.userData.base = ring.def.radius;
    }

    _spawnBeam(from, color) {
        let mesh = this._beams.find((m) => !m.userData.alive);
        if (!mesh) {
            mesh = new THREE.Mesh(
                this._beamGeo,
                new THREE.MeshBasicMaterial({
                    color,
                    transparent: true,
                    opacity: 0.8,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false
                })
            );
            this.root.add(mesh);
            this._beams.push(mesh);
        }
        const mid = this._tmp2.copy(from).multiplyScalar(0.5);
        const len = from.length();
        mesh.position.copy(mid);
        mesh.scale.set(1, len, 1);
        mesh.quaternion.setFromUnitVectors(this._up, this._dir.copy(from).normalize());
        mesh.material.color.copy(color);
        mesh.material.opacity = 0.75;
        mesh.visible = true;
        mesh.userData.alive = true;
        mesh.userData.life = 1;
    }

    _burst(pos, color) {
        const n = this.quality.burst;
        const arr = this.pGeo.attributes.position.array;
        const cols = this.pGeo.attributes.color.array;
        let spawned = 0;
        for (let i = 0; i < this.pCount && spawned < n; i++) {
            if (this.pLife[i] > 0.05) continue;
            this.pLife[i] = 0.7 + Math.random() * 0.5;
            arr[i * 3] = pos.x;
            arr[i * 3 + 1] = pos.y;
            arr[i * 3 + 2] = pos.z;
            this.pVel[i * 3] = (Math.random() - 0.5) * 3.8;
            this.pVel[i * 3 + 1] = (Math.random() - 0.5) * 3.8;
            this.pVel[i * 3 + 2] = (Math.random() - 0.5) * 3.8;
            cols[i * 3] = color.r;
            cols[i * 3 + 1] = color.g;
            cols[i * 3 + 2] = color.b;
            spawned++;
        }
        this.pGeo.attributes.position.needsUpdate = true;
        this.pGeo.attributes.color.needsUpdate = true;
    }

    _updateFx(dt) {
        this._flashes.forEach((m) => {
            if (!m.userData.alive) return;
            m.userData.life -= dt * 3.2;
            m.scale.setScalar(0.6 + (1 - m.userData.life) * 1.8);
            m.material.opacity = Math.max(0, m.userData.life);
            if (m.userData.life <= 0) {
                m.userData.alive = false;
                m.visible = false;
            }
        });
        this._waves.forEach((m) => {
            if (!m.userData.alive) return;
            m.userData.life -= dt * 1.8;
            const s = m.userData.base * (0.2 + (1 - m.userData.life) * 0.55);
            m.scale.setScalar(s);
            m.material.opacity = Math.max(0, m.userData.life * 0.7);
            if (m.userData.life <= 0) {
                m.userData.alive = false;
                m.visible = false;
            }
        });
        this._beams.forEach((m) => {
            if (!m.userData.alive) return;
            m.userData.life -= dt * 2.6;
            m.material.opacity = Math.max(0, m.userData.life * 0.8);
            if (m.userData.life <= 0) {
                m.userData.alive = false;
                m.visible = false;
            }
        });

        const pos = this.pGeo.attributes.position.array;
        for (let i = 0; i < this.pCount; i++) {
            if (this.pLife[i] <= 0) continue;
            this.pLife[i] -= dt * 0.9;
            pos[i * 3] += this.pVel[i * 3] * dt;
            pos[i * 3 + 1] += this.pVel[i * 3 + 1] * dt;
            pos[i * 3 + 2] += this.pVel[i * 3 + 2] * dt;
            if (this.pLife[i] <= 0) {
                pos[i * 3] = 0;
                pos[i * 3 + 1] = 80;
                pos[i * 3 + 2] = 0;
            }
        }
        this.pGeo.attributes.position.needsUpdate = true;
    }
}
