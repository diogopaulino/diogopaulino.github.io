/**
 * Castelo Estelar — Efeitos Mágicos e Cinemáticos em Babylon.js.
 * Fada de faíscas com rastro de partículas douradas, estrela cadente,
 * arco tridimensional sobre os pináculos e show pirotécnico sincronizado.
 */

import { catmullRom, clamp } from './utils.js';

export class Magic {
    constructor(scene, quality) {
        this.scene = scene;
        this.quality = quality;
        const B = window.BABYLON;

        this.root = new B.TransformNode('magic_root', scene);

        // Estrela Cadente
        this.shootingStar = B.MeshBuilder.CreateSphere('shooting_star', {
            diameter: 0.6,
            segments: 12
        }, scene);
        this.shootingStar.parent = this.root;
        const shootingMat = new B.StandardMaterial('mat_shooting_star', scene);
        shootingMat.emissiveColor = new B.Color3(1, 1, 0.95);
        shootingMat.disableLighting = true;
        shootingMat.alpha = 0;
        this.shootingStar.material = shootingMat;
        this.shootingMat = shootingMat;

        // Fada de Faíscas (Magic Sprite)
        this.fairy = B.MeshBuilder.CreateSphere('fairy_core', {
            diameter: 0.45,
            segments: 16
        }, scene);
        this.fairy.parent = this.root;
        const fairyMat = new B.StandardMaterial('mat_fairy', scene);
        fairyMat.emissiveColor = new B.Color3(1.0, 0.96, 0.75);
        fairyMat.disableLighting = true;
        fairyMat.alpha = 0;
        this.fairy.material = fairyMat;
        this.fairyMat = fairyMat;

        // Brilho da Fada (Glow Aura)
        this.fairyGlow = B.MeshBuilder.CreateSphere('fairy_glow', {
            diameter: 1.4,
            segments: 16
        }, scene);
        this.fairyGlow.parent = this.fairy;
        const fairyGlowMat = new B.StandardMaterial('mat_fairy_glow', scene);
        fairyGlowMat.emissiveColor = new B.Color3(1.0, 0.85, 0.45);
        fairyGlowMat.alpha = 0;
        fairyGlowMat.alphaMode = B.Engine.ALPHA_ADD;
        fairyGlowMat.disableLighting = true;
        fairyGlowMat.disableDepthWrite = true;
        this.fairyGlow.material = fairyGlowMat;
        this.fairyGlowMat = fairyGlowMat;

        // Luz da fada iluminando as torres de passagem
        this.fairyLight = new B.PointLight('fairy_light', new B.Vector3(0, 0, 0), scene);
        this.fairyLight.diffuse = new B.Color3(1.0, 0.85, 0.45);
        this.fairyLight.intensity = 0;
        this.fairyLight.range = 28;
        this.fairyLight.parent = this.fairy;

        // Caminho 3D da Fada (Trajetória de voo sobre as torres)
        this.fairyPathPoints = [
            new B.Vector3(-38, 16, 36),
            new B.Vector3(-22, 26, 20),
            new B.Vector3(-6, 35, 6),
            new B.Vector3(12, 41, 2),
            new B.Vector3(28, 33, 14),
            new B.Vector3(20, 22, 24)
        ];

        // Arco Dourado
        this.arcMesh = null;
        this.arcMat = new B.StandardMaterial('mat_golden_arc', scene);
        this.arcMat.emissiveColor = new B.Color3(1.0, 0.88, 0.42);
        this.arcMat.alpha = 0;
        this.arcMat.alphaMode = B.Engine.ALPHA_ADD;
        this.arcMat.disableLighting = true;
        this.arcMat.disableDepthWrite = true;
        this.arcU = 0;
        this._initArc();

        // Sistema de Partículas de Faíscas (Sparks & Fireworks)
        this.particles = [];
        this.maxParticles = quality.sparks || 1200;
        this._initParticleMesh();

        this.burstAt = [];
    }

    _initArc() {
        const B = window.BABYLON;
        const pts = this._sampleArcPoints(0.01);
        this.arcMesh = B.MeshBuilder.CreateTube('golden_arc_tube', {
            path: pts,
            radius: 0.12,
            tessellation: 12,
            updatable: true
        }, this.scene);
        this.arcMesh.material = this.arcMat;
        this.arcMesh.parent = this.root;
    }

    _sampleArcPoints(u) {
        const B = window.BABYLON;
        const n = 32;
        const pts = [];
        const um = Math.max(0.02, u);
        for (let i = 0; i <= n; i++) {
            const t = (i / n) * um;
            const x = -24 + t * 50;
            const y = 22 + Math.sin(t * Math.PI) * 20;
            const z = 8 + Math.sin(t * Math.PI) * -5;
            pts.push(new B.Vector3(x, y, z));
        }
        return pts;
    }

    _updateArc(u) {
        const B = window.BABYLON;
        const pts = this._sampleArcPoints(u);
        if (this.arcMesh) {
            this.arcMesh.dispose();
        }
        this.arcMesh = B.MeshBuilder.CreateTube('golden_arc_tube', {
            path: pts,
            radius: 0.12,
            tessellation: 12,
            updatable: true
        }, this.scene);
        this.arcMesh.material = this.arcMat;
        this.arcMesh.parent = this.root;
    }

    _initParticleMesh() {
        const B = window.BABYLON;
        this.particleMesh = new B.Mesh('spark_particles', this.scene);
        this.particleMesh.parent = this.root;

        const max = this.maxParticles;
        this.positions = new Float32Array(max * 3);
        this.colors = new Float32Array(max * 4);
        this.indices = new Int32Array(max);
        for (let i = 0; i < max; i++) this.indices[i] = i;

        const vData = new B.VertexData();
        vData.positions = this.positions;
        vData.colors = this.colors;
        vData.indices = this.indices;
        vData.applyToMesh(this.particleMesh, true);

        const sparkMat = new B.StandardMaterial('mat_sparks', this.scene);
        sparkMat.emissiveColor = new B.Color3(1, 1, 1);
        sparkMat.disableLighting = true;
        sparkMat.alphaMode = B.Engine.ALPHA_ADD;
        sparkMat.pointsCloud = true;
        sparkMat.pointSize = 4.5;
        sparkMat.disableDepthWrite = true;
        this.particleMesh.material = sparkMat;
    }

    _sampleFairyPath(u) {
        const B = window.BABYLON;
        const pts = this.fairyPathPoints;
        const tClamped = clamp(u, 0, 0.999);
        const segment = tClamped * (pts.length - 1);
        const idx = Math.floor(segment);
        const frac = segment - idx;

        const p0 = pts[Math.max(0, idx - 1)];
        const p1 = pts[idx];
        const p2 = pts[Math.min(pts.length - 1, idx + 1)];
        const p3 = pts[Math.min(pts.length - 1, idx + 2)];

        return new B.Vector3(
            catmullRom(p0.x, p1.x, p2.x, p3.x, frac),
            catmullRom(p0.y, p1.y, p2.y, p3.y, frac),
            catmullRom(p0.z, p1.z, p2.z, p3.z, frac)
        );
    }

    _emit(pos, hexColor, count = 3, size = 4.0) {
        const B = window.BABYLON;
        const color = B.Color3.FromHexString(hexColor);
        for (let i = 0; i < count; i++) {
            if (this.particles.length >= this.maxParticles) break;
            this.particles.push({
                x: pos.x,
                y: pos.y,
                z: pos.z,
                vx: (Math.random() - 0.5) * 1.8,
                vy: (Math.random() - 0.5) * 1.8,
                vz: (Math.random() - 0.5) * 1.8,
                r: color.r,
                g: color.g,
                b: color.b,
                life: 0.65 + Math.random() * 0.55,
                age: 0,
                size: size * (0.6 + Math.random() * 0.6)
            });
        }
    }

    spawnBurst(origin, hexColor, count = 90) {
        const B = window.BABYLON;
        const color = B.Color3.FromHexString(hexColor);
        for (let i = 0; i < count; i++) {
            if (this.particles.length >= this.maxParticles) break;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const speed = 7.5 + Math.random() * 12.0;

            this.particles.push({
                x: origin.x,
                y: origin.y,
                z: origin.z,
                vx: Math.sin(phi) * Math.cos(theta) * speed,
                vy: Math.sin(phi) * Math.sin(theta) * speed + 5.0,
                vz: Math.cos(phi) * speed,
                r: color.r,
                g: color.g,
                b: color.b,
                life: 1.5 + Math.random() * 0.7,
                age: 0,
                size: 5 + Math.random() * 8
            });
        }
    }

    setIntro(t, audio) {
        const B = window.BABYLON;

        // 1. Estrela Cadente (2.8s – 5.0s)
        if (t > 2.8 && t < 5.0) {
            const u = (t - 2.8) / 2.2;
            this.shootingStar.position.set(-62 + u * 94, 54 - u * 10, -22);
            const alpha = u < 0.15 ? u / 0.15 : Math.max(0, 1 - (u - 0.7) / 0.3);
            this.shootingMat.alpha = alpha;
            this._emit(this.shootingStar.position, '#fff8d8', 3, 3.8);
        } else {
            this.shootingMat.alpha = 0;
        }

        // 2. Fada de Faíscas e Arco Dourado (9.5s – 17.0s)
        const fairyOn = t > 9.5 && t < 17.0;
        if (fairyOn) {
            const u = (t - 9.5) / 7.5;
            const pos = this._sampleFairyPath(Math.min(0.999, u));

            this.fairy.position.copyFrom(pos);
            this.fairyMat.alpha = 1.0;
            this.fairyGlowMat.alpha = 0.65;
            this.fairyLight.intensity = 18;

            this._emit(pos, '#ffeaa7', 4, 5.0);

            const nextU = Math.min(1.0, u * 1.14);
            if (nextU - this.arcU > 0.02 || nextU === 1.0) {
                this.arcU = nextU;
                this._updateArc(this.arcU);
            }
            this.arcMat.alpha = Math.min(0.95, u * 2.2);
        } else if (t >= 17.0) {
            this.fairyMat.alpha = 0;
            this.fairyGlowMat.alpha = 0;
            this.fairyLight.intensity = 0;
            this.arcMat.alpha = Math.max(0, 0.95 - (t - 17.0) * 0.28);
        }

        // 3. Show de Fogos de Artifício (15.2s em diante)
        const fireworkCues = [
            [15.2, 8, 30, 10, '#ffd166'],  // Ouro Imperial
            [16.0, -10, 34, 6, '#ff477e'], // Rosa Rubi
            [16.6, 14, 38, 4, '#4cc9f0'],  // Safira Celestial
            [17.4, 0, 42, 2, '#ffeaa7'],   // Diamante Dourado
            [18.2, -7, 32, 12, '#ff9f43'], // Âmbar Real
            [19.0, 10, 36, 8, '#b5179e']   // Ametista
        ];

        for (const [when, x, y, z, color] of fireworkCues) {
            if (t >= when && !this.burstAt.includes(when)) {
                this.burstAt.push(when);
                this.spawnBurst(new B.Vector3(x, y, z), color, this.quality.burst || 90);
                audio?.firework?.();
            }
        }
    }

    replay() {
        this.burstAt.length = 0;
        this.particles.length = 0;
        this.arcU = 0;
        this.arcMat.alpha = 0;
        this.fairyMat.alpha = 0;
        this.fairyGlowMat.alpha = 0;
        this.fairyLight.intensity = 0;
        this.shootingMat.alpha = 0;
    }

    tick(dt) {
        const g = -14.0;
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.age += dt;
            p.vy += g * dt * 0.38;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.z += p.vz * dt;

            if (p.age >= p.life) {
                this.particles.splice(i, 1);
            }
        }

        const n = Math.min(this.particles.length, this.maxParticles);
        for (let i = 0; i < n; i++) {
            const p = this.particles[i];
            const fade = 1 - p.age / p.life;
            this.positions[i * 3] = p.x;
            this.positions[i * 3 + 1] = p.y;
            this.positions[i * 3 + 2] = p.z;

            this.colors[i * 4] = p.r * fade;
            this.colors[i * 4 + 1] = p.g * fade;
            this.colors[i * 4 + 2] = p.b * fade;
            this.colors[i * 4 + 3] = fade;
        }

        // Zera posições restantes
        for (let i = n; i < this.maxParticles; i++) {
            this.positions[i * 3 + 1] = -1000;
            this.colors[i * 4 + 3] = 0;
        }

        this.particleMesh.updateVerticesData(window.BABYLON.VertexBuffer.PositionKind, this.positions);
        this.particleMesh.updateVerticesData(window.BABYLON.VertexBuffer.ColorKind, this.colors);
    }
}

