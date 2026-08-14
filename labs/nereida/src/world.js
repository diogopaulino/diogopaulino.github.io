/**
 * Recife circular: areia com cáusticas, anel de pedras, kelp, corais,
 * anêmonas, superfície vista de baixo e as sete luzes-maré.
 */

import * as THREE from 'three';
import { TIDES, SURFACE, FOG0, FOG1, lerp } from './config.js';
import { sandTexture, kelpTexture } from './textures.js';
import { patchFloor, patchKelp, WATER_VERT, WATER_FRAG } from './shaders.js';
import { createCoral, createRock, createAnemone, createTideLight } from './models.js';

function texFromCanvas(c, repeat = 8) {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
}

export class Sanctuary {
    constructor(scene, quality) {
        this.scene = scene;
        this.quality = quality;
        this.awaken = 0;
        this.time = 0;
        this.corals = [];
        this.anemones = [];
        this.tides = [];
        this.kelp = [];
        this.rays = [];
        this.uniforms = {
            uTime: { value: 0 },
            uAwaken: { value: 0 }
        };

        this._floor();
        this._water();
        this._rocks();
        this._kelpForest();
        this._coralGardens();
        this._anemones();
        this._arch();
        this._godRays();
        this._tides();
        this._centerRing();
    }

    _floor() {
        const geo = new THREE.CircleGeometry(58, 72);
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const y = pos.getY(i);
            const r = Math.hypot(x, y);
            const dune = Math.sin(x * 0.18) * Math.cos(y * 0.14) * 0.55
                + Math.sin(x * 0.07 + y * 0.09) * 0.9;
            pos.setZ(i, dune - r * r * 0.0008);
        }
        geo.computeVertexNormals();
        const mat = new THREE.MeshStandardMaterial({
            map: texFromCanvas(sandTexture(), 10),
            color: 0x6aa090,
            roughness: 0.95,
            metalness: 0.02,
            emissive: 0x102830,
            emissiveIntensity: 0.2
        });
        mat.onBeforeCompile = (shader) => patchFloor(shader, this.uniforms);
        mat.customProgramCacheKey = () => 'nereida-floor';
        const floor = new THREE.Mesh(geo, mat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);
    }

    _water() {
        const geo = new THREE.PlaneGeometry(90, 90, 36, 36);
        const mat = new THREE.ShaderMaterial({
            uniforms: {
                uTime: this.uniforms.uTime,
                uAwaken: this.uniforms.uAwaken,
                uMoonDir: { value: new THREE.Vector3(0.15, 1, -0.12).normalize() }
            },
            vertexShader: WATER_VERT,
            fragmentShader: WATER_FRAG,
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        const water = new THREE.Mesh(geo, mat);
        water.rotation.x = -Math.PI / 2;
        water.position.y = SURFACE;
        this.scene.add(water);
        this.water = water;

        const moon = new THREE.Mesh(
            new THREE.SphereGeometry(3.4, 24, 16),
            new THREE.MeshBasicMaterial({ color: 0xf4f0d8 })
        );
        moon.position.set(10, SURFACE + 14, -8);
        this.scene.add(moon);
        const halo = new THREE.Mesh(
            new THREE.SphereGeometry(6.2, 16, 12),
            new THREE.MeshBasicMaterial({
                color: 0xc8e8ff,
                transparent: true,
                opacity: 0.18,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            })
        );
        halo.position.copy(moon.position);
        this.scene.add(halo);
    }

    _scatter(count, radius, fn) {
        for (let i = 0; i < count; i++) {
            const a = Math.random() * Math.PI * 2;
            const r = Math.sqrt(Math.random()) * radius;
            fn(Math.cos(a) * r, Math.sin(a) * r, i);
        }
    }

    _rocks() {
        for (let i = 0; i < 36; i++) {
            const a = (i / 36) * Math.PI * 2 + (Math.random() - 0.5) * 0.12;
            const r = 40 + Math.random() * 8;
            const rock = createRock(1.8 + Math.random() * 3.4);
            rock.position.set(Math.cos(a) * r, 0.2, Math.sin(a) * r);
            rock.rotation.y = Math.random() * Math.PI;
            this.scene.add(rock);
        }
        this._scatter(18, 28, (x, z) => {
            if (Math.hypot(x, z) < 6) return;
            const rock = createRock(0.8 + Math.random() * 1.6);
            rock.position.set(x, 0.1, z);
            this.scene.add(rock);
        });
    }

    _kelpForest() {
        const canvas = kelpTexture();
        const map = new THREE.CanvasTexture(canvas);
        map.colorSpace = THREE.SRGBColorSpace;
        const mat = new THREE.MeshStandardMaterial({
            map,
            transparent: true,
            alphaTest: 0.12,
            side: THREE.DoubleSide,
            color: 0x5ee0b0,
            emissive: 0x1a8a6a,
            emissiveIntensity: 0.35,
            roughness: 0.8,
            depthWrite: false
        });
        mat.onBeforeCompile = (shader) => patchKelp(shader, this.uniforms);
        mat.customProgramCacheKey = () => 'nereida-kelp';
        const blade = new THREE.PlaneGeometry(1.1, 1, 1, 8);
        blade.translate(0, 0.5, 0);

        const center = new THREE.Vector3(-18.6, 0, 5.2);
        for (let i = 0; i < this.quality.kelp; i++) {
            const a = Math.random() * Math.PI * 2;
            const r = Math.random() * 9;
            const h = 4.5 + Math.random() * 8;
            const m = new THREE.Mesh(blade, mat);
            m.position.set(center.x + Math.cos(a) * r, 0, center.z + Math.sin(a) * r);
            m.scale.set(0.7 + Math.random() * 0.6, h, 1);
            m.rotation.y = Math.random() * Math.PI;
            m.castShadow = false;
            this.scene.add(m);
            this.kelp.push(m);
        }
    }

    _coralGardens() {
        const palettes = [0xff7ab0, 0xffc46b, 0x7ae0c4, 0x8aa8ff, 0xff8a6a, 0xc89bff];
        const kinds = ['tube', 'fan', 'brain'];
        const patches = [
            new THREE.Vector3(17.2, 0, -7.4),
            new THREE.Vector3(0.4, 0, -18.5),
            new THREE.Vector3(8, 0, 6)
        ];
        const n = this.quality.coral;
        for (let i = 0; i < n; i++) {
            const patch = patches[i % patches.length];
            const a = Math.random() * Math.PI * 2;
            const r = 1.2 + Math.random() * 6.5;
            const coral = createCoral(kinds[i % 3], palettes[i % palettes.length]);
            coral.position.set(patch.x + Math.cos(a) * r, 0.35, patch.z + Math.sin(a) * r);
            coral.scale.setScalar(0.7 + Math.random() * 0.7);
            coral.rotation.y = Math.random() * Math.PI;
            this.scene.add(coral);
            this.corals.push(coral);
        }
    }

    _anemones() {
        const colors = [0xff6b9d, 0xffd166, 0x7af0c8, 0xa78bfa];
        for (let i = 0; i < 14; i++) {
            const a = Math.random() * Math.PI * 2;
            const r = 2 + Math.random() * 5;
            const ane = createAnemone(colors[i % colors.length]);
            ane.position.set(Math.cos(a) * r, 0.25, Math.sin(a) * r - 18.5);
            ane.scale.setScalar(0.7 + Math.random() * 0.5);
            this.scene.add(ane);
            this.anemones.push(ane);
        }
    }

    _arch() {
        const mat = new THREE.MeshStandardMaterial({
            color: 0x2a4554,
            roughness: 0.9,
            emissive: 0x102028,
            emissiveIntensity: 0.2
        });
        const left = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 8.5, 10), mat);
        left.position.set(20.2, 4.2, 8.4);
        const right = left.clone();
        right.position.set(23.4, 4.2, 11.2);
        const top = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.85, 8, 18, Math.PI), mat);
        top.position.set(21.8, 8.1, 9.8);
        top.rotation.set(0, -0.7, 0);
        top.rotation.z = Math.PI;
        left.castShadow = right.castShadow = top.castShadow = true;
        this.scene.add(left, right, top);
    }

    _centerRing() {
        const mat = new THREE.MeshStandardMaterial({
            color: 0x3a6a78,
            emissive: 0x1a8090,
            emissiveIntensity: 0.35,
            roughness: 0.5
        });
        const ring = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.22, 8, 40), mat);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.35;
        this.scene.add(ring);
        this.centerRing = ring;
        for (let i = 0; i < 7; i++) {
            const a = (i / 7) * Math.PI * 2;
            const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.6, 8), mat);
            pylon.position.set(Math.cos(a) * 4.2, 0.8, Math.sin(a) * 4.2);
            this.scene.add(pylon);
        }
    }

    _godRays() {
        const mat = new THREE.MeshBasicMaterial({
            color: 0xb8e8ff,
            transparent: true,
            opacity: 0.045,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide
        });
        for (let i = 0; i < this.quality.rays; i++) {
            const h = 16 + Math.random() * 8;
            const cone = new THREE.Mesh(new THREE.ConeGeometry(1.8 + Math.random(), h, 8, 1, true), mat);
            cone.position.set(
                (Math.random() - 0.5) * 36,
                SURFACE - h * 0.45,
                (Math.random() - 0.5) * 36
            );
            cone.rotation.x = Math.PI;
            this.scene.add(cone);
            this.rays.push({ mesh: cone, phase: Math.random() * Math.PI * 2 });
        }
    }

    _tides() {
        const colors = [0x9ef7ff, 0xffc6e8, 0xc8f5a8, 0xffe08a, 0xb8c8ff, 0x7af0d0, 0xffd0a0];
        TIDES.forEach((spec, i) => {
            const orb = createTideLight(colors[i]);
            orb.position.set(...spec.pos);
            orb.userData.name = spec.name;
            orb.userData.hint = spec.hint;
            orb.userData.home = orb.position.clone();
            this.scene.add(orb);
            this.tides.push(orb);
        });
    }

    reset() {
        this.awaken = 0;
        this.uniforms.uAwaken.value = 0;
        for (const orb of this.tides) {
            orb.visible = true;
            orb.userData.taken = false;
            orb.userData.light.intensity = 2.4;
        }
        this._applyGlow();
    }

    setAwaken(a) {
        this.awaken = a;
        this.uniforms.uAwaken.value = a;
        this._applyGlow();
        if (this.scene.fog) {
            this.scene.fog.density = lerp(FOG0, FOG1, a);
        }
    }

    _applyGlow() {
        const em = lerp(0.18, 1.12, this.awaken);
        for (const c of this.corals) c.userData.mat.emissiveIntensity = em;
        for (const a of this.anemones) a.userData.mat.emissiveIntensity = 0.25 + em * 0.7;
        if (this.centerRing) {
            this.centerRing.material.emissiveIntensity = 0.3 + this.awaken * 1.1;
        }
    }

    update(dt) {
        this.time += dt;
        this.uniforms.uTime.value = this.time;
        for (const orb of this.tides) {
            if (orb.userData.taken) continue;
            const t = this.time;
            orb.position.y = orb.userData.home.y + Math.sin(t * 1.4 + orb.userData.home.x) * 0.35;
            orb.userData.core.rotation.y += dt * 0.6;
            const s = 1 + Math.sin(t * 2.2 + orb.userData.home.z) * 0.08;
            orb.userData.halo.scale.setScalar(1.8 * s);
        }
        for (const ray of this.rays) {
            ray.mesh.material.opacity = 0.03 + Math.sin(this.time * 0.4 + ray.phase) * 0.02
                + this.awaken * 0.025;
            ray.mesh.rotation.y += dt * 0.05;
        }
        for (const ane of this.anemones) {
            ane.rotation.y += dt * 0.15;
        }
    }
}
