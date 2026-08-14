/**
 * Arena flutuante no rift: céu em shader, piso de energia, portais-gol,
 * boost pads e fragmentos de cristal.
 */

import * as THREE from 'three';
import { ARENA, PADS, PAD_RADIUS, TEAMS } from './config.js';

function skyMaterial() {
    return new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
            uTime: { value: 0 }
        },
        vertexShader: /* glsl */ `
            varying vec3 vPos;
            void main() {
                vPos = position;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: /* glsl */ `
            varying vec3 vPos;
            uniform float uTime;
            float hash(vec2 p) {
                return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
            }
            float noise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                float a = hash(i);
                float b = hash(i + vec2(1.0, 0.0));
                float c = hash(i + vec2(0.0, 1.0));
                float d = hash(i + vec2(1.0, 1.0));
                vec2 u = f * f * (3.0 - 2.0 * f);
                return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
            }
            void main() {
                vec3 n = normalize(vPos);
                float h = n.y;
                vec3 zenith = vec3(0.02, 0.03, 0.08);
                vec3 horizon = vec3(0.08, 0.18, 0.38);
                vec3 ground = vec3(0.04, 0.02, 0.08);
                vec3 col = mix(horizon, zenith, smoothstep(0.0, 0.55, h));
                col = mix(ground, col, smoothstep(-0.25, 0.04, h));

                float aurora = noise(vec2(n.x * 3.0 + uTime * 0.04, n.z * 2.2));
                aurora *= smoothstep(0.05, 0.45, h) * smoothstep(0.85, 0.35, h);
                col += vec3(0.15, 0.85, 0.9) * aurora * 0.28;
                col += vec3(0.9, 0.2, 0.75) * (1.0 - aurora) * aurora * 0.22;

                float glow = exp(-pow((h - 0.02) * 6.0, 2.0));
                col += vec3(0.25, 0.45, 0.9) * glow * 0.35;

                float stars = step(0.993, hash(floor(n.xz * 90.0 + n.y * 40.0))) * smoothstep(0.12, 0.5, h);
                col += vec3(0.85, 0.92, 1.0) * stars;

                vec3 moonDir = normalize(vec3(-0.42, 0.55, 0.35));
                float moon = exp(-pow(length(n - moonDir) * 26.0, 2.0));
                col += vec3(0.85, 0.9, 1.0) * moon * 1.5;
                col += vec3(0.4, 0.55, 0.95) * exp(-pow(length(n - moonDir) * 7.0, 2.0)) * 0.28;

                gl_FragColor = vec4(col, 1.0);
            }
        `
    });
}

function floorMaterial() {
    return new THREE.ShaderMaterial({
        transparent: true,
        side: THREE.DoubleSide,
        uniforms: {
            uTime: { value: 0 },
            uHalfX: { value: ARENA.halfX },
            uHalfZ: { value: ARENA.halfZ }
        },
        vertexShader: /* glsl */ `
            varying vec3 vWorld;
            void main() {
                vec4 w = modelMatrix * vec4(position, 1.0);
                vWorld = w.xyz;
                gl_Position = projectionMatrix * viewMatrix * w;
            }
        `,
        fragmentShader: /* glsl */ `
            varying vec3 vWorld;
            uniform float uTime;
            uniform float uHalfX;
            uniform float uHalfZ;
            void main() {
                vec2 p = vWorld.xz;
                float gx = 1.0 - smoothstep(0.04, 0.08, abs(mod(p.x + 1.5, 3.0) - 1.5));
                float gz = 1.0 - smoothstep(0.04, 0.08, abs(mod(p.y + 1.5, 3.0) - 1.5));
                float grid = max(gx, gz);
                float circle = 1.0 - smoothstep(0.06, 0.14, abs(length(p) - 5.5));
                float mid = 1.0 - smoothstep(0.04, 0.1, abs(p.x));
                float edgeX = 1.0 - smoothstep(uHalfX - 0.35, uHalfX, abs(p.x));
                float edgeZ = 1.0 - smoothstep(uHalfZ - 0.35, uHalfZ, abs(p.y));
                float rim = 1.0 - min(edgeX, edgeZ);

                vec3 cyan = vec3(0.24, 0.94, 1.0);
                vec3 mag = vec3(1.0, 0.29, 0.85);
                float side = smoothstep(-8.0, 8.0, p.x);
                vec3 neon = mix(cyan, mag, side);
                vec3 base = vec3(0.04, 0.07, 0.14);
                vec3 col = mix(base, neon, grid * 0.55 + circle * 0.8 + mid * 0.2);
                col += neon * rim * 0.85;
                float pulse = 0.55 + 0.45 * sin(uTime * 2.0 + p.x * 0.15);
                float alpha = 0.42 + grid * 0.28 + rim * 0.35 + circle * 0.2;
                gl_FragColor = vec4(col * pulse, alpha);
            }
        `
    });
}

function makeGoal(team) {
    const def = TEAMS[team];
    const g = new THREE.Group();
    const x = team === 0 ? -ARENA.halfX : ARENA.halfX;
    g.position.x = x;
    const frameMat = new THREE.MeshStandardMaterial({
        color: 0x10141c,
        metalness: 0.7,
        roughness: 0.28,
        emissive: def.color,
        emissiveIntensity: 0.35
    });
    const bar = (w, h, d, px, py, pz) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), frameMat);
        m.position.set(px, py, pz);
        m.castShadow = true;
        g.add(m);
    };
    const w = ARENA.goalHalfZ * 2;
    bar(0.35, ARENA.goalHeight + 0.35, 0.35, 0, ARENA.goalHeight * 0.5, w * 0.5);
    bar(0.35, ARENA.goalHeight + 0.35, 0.35, 0, ARENA.goalHeight * 0.5, -w * 0.5);
    bar(0.35, 0.35, w + 0.35, 0, ARENA.goalHeight, 0);
    bar(0.35, 0.22, w + 0.35, 0, 0.12, 0);

    const veil = new THREE.Mesh(
        new THREE.PlaneGeometry(w * 0.96, ARENA.goalHeight * 0.92),
        new THREE.MeshBasicMaterial({
            color: def.color,
            transparent: true,
            opacity: 0.22,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        })
    );
    veil.position.set(team === 0 ? -0.2 : 0.2, ARENA.goalHeight * 0.48, 0);
    veil.rotation.y = Math.PI / 2;
    g.add(veil);

    const ring = new THREE.Mesh(
        new THREE.TorusGeometry(2.2, 0.08, 10, 48),
        new THREE.MeshBasicMaterial({
            color: def.color,
            transparent: true,
            opacity: 0.85,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        })
    );
    ring.rotation.y = Math.PI / 2;
    ring.position.y = 2.1;
    ring.position.x = team === 0 ? -0.8 : 0.8;
    g.add(ring);

    const light = new THREE.PointLight(def.color, 18, 28, 2);
    light.position.set(team === 0 ? 2.5 : -2.5, 3.2, 0);
    g.add(light);
    g.userData.veil = veil;
    g.userData.ring = ring;
    return g;
}

export class World {
    constructor(scene, quality) {
        this.scene = scene;
        this.quality = quality;
        this.time = 0;
        this.group = new THREE.Group();
        scene.add(this.group);

        this.skyMat = skyMaterial();
        const sky = new THREE.Mesh(new THREE.SphereGeometry(220, 32, 24), this.skyMat);
        this.group.add(sky);

        const hemi = new THREE.HemisphereLight(0x6aa0ff, 0x1a1028, 0.55);
        this.group.add(hemi);
        const sun = new THREE.DirectionalLight(0xc8d8ff, 1.15);
        sun.position.set(-30, 48, 18);
        sun.castShadow = quality.shadows;
        if (quality.shadows) {
            sun.shadow.mapSize.set(1024, 1024);
            sun.shadow.camera.near = 4;
            sun.shadow.camera.far = 120;
            sun.shadow.camera.left = -40;
            sun.shadow.camera.right = 40;
            sun.shadow.camera.top = 30;
            sun.shadow.camera.bottom = -30;
        }
        this.group.add(sun);

        this.floorMat = floorMaterial();
        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(ARENA.halfX * 2 + 1.2, ARENA.halfZ * 2 + 1.2, 1, 1),
            this.floorMat
        );
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.group.add(floor);

        const deck = new THREE.Mesh(
            new THREE.BoxGeometry(ARENA.halfX * 2 + 4, 0.7, ARENA.halfZ * 2 + 4),
            new THREE.MeshStandardMaterial({
                color: 0x0b1020,
                metalness: 0.4,
                roughness: 0.55,
                emissive: 0x0a1830,
                emissiveIntensity: 0.2
            })
        );
        deck.position.y = -0.42;
        deck.receiveShadow = true;
        this.group.add(deck);

        const railMat = new THREE.MeshStandardMaterial({
            color: 0x101828,
            metalness: 0.65,
            roughness: 0.3,
            emissive: 0x1a3a66,
            emissiveIntensity: 0.4
        });
        const mkRail = (w, d, x, z) => {
            const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.85, d), railMat);
            m.position.set(x, 0.35, z);
            m.castShadow = true;
            this.group.add(m);
        };
        mkRail(ARENA.halfX * 2 + 2.2, 0.42, 0, ARENA.halfZ + 0.4);
        mkRail(ARENA.halfX * 2 + 2.2, 0.42, 0, -ARENA.halfZ - 0.4);
        mkRail(0.42, ARENA.halfZ * 2 - ARENA.goalHalfZ * 2 + 0.4, ARENA.halfX + 0.4, ARENA.halfZ * 0.55);
        mkRail(0.42, ARENA.halfZ * 2 - ARENA.goalHalfZ * 2 + 0.4, ARENA.halfX + 0.4, -ARENA.halfZ * 0.55);
        mkRail(0.42, ARENA.halfZ * 2 - ARENA.goalHalfZ * 2 + 0.4, -ARENA.halfX - 0.4, ARENA.halfZ * 0.55);
        mkRail(0.42, ARENA.halfZ * 2 - ARENA.goalHalfZ * 2 + 0.4, -ARENA.halfX - 0.4, -ARENA.halfZ * 0.55);

        this.goals = [makeGoal(0), makeGoal(1)];
        this.goals.forEach((g) => this.group.add(g));

        this.pads = PADS.map((p) => {
            const mesh = new THREE.Mesh(
                new THREE.CylinderGeometry(PAD_RADIUS * 0.92, PAD_RADIUS, 0.12, 24),
                new THREE.MeshStandardMaterial({
                    color: 0x241806,
                    emissive: 0xffe08a,
                    emissiveIntensity: 0.8,
                    metalness: 0.2,
                    roughness: 0.4
                })
            );
            mesh.position.set(p.x, 0.04, p.z);
            this.group.add(mesh);
            const ring = new THREE.Mesh(
                new THREE.TorusGeometry(PAD_RADIUS * 0.72, 0.05, 8, 32),
                new THREE.MeshBasicMaterial({
                    color: 0xffe08a,
                    transparent: true,
                    opacity: 0.7,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false
                })
            );
            ring.rotation.x = Math.PI / 2;
            ring.position.set(p.x, 0.18, p.z);
            this.group.add(ring);
            return { mesh, ring };
        });

        this.shards = [];
        const shardGeo = new THREE.OctahedronGeometry(1, 0);
        const shardMat = new THREE.MeshStandardMaterial({
            color: 0x8ecbff,
            metalness: 0.3,
            roughness: 0.25,
            emissive: 0x3cf0ff,
            emissiveIntensity: 0.15,
            transparent: true,
            opacity: 0.85
        });
        for (let i = 0; i < quality.shards; i++) {
            const m = new THREE.Mesh(shardGeo, shardMat.clone());
            const ang = (i / quality.shards) * Math.PI * 2;
            const r = 34 + (i % 5) * 4;
            m.position.set(Math.cos(ang) * r, 4 + (i % 7) * 1.6, Math.sin(ang) * r * 0.7);
            m.scale.setScalar(0.6 + (i % 4) * 0.45);
            m.rotation.set(i, i * 0.4, i * 0.2);
            this.group.add(m);
            this.shards.push(m);
        }

        scene.fog = new THREE.FogExp2(0x070b18, 0.012);
    }

    update(dt, t) {
        this.time = t;
        this.skyMat.uniforms.uTime.value = t;
        this.floorMat.uniforms.uTime.value = t;
        for (const s of this.shards) {
            s.rotation.y += dt * 0.12;
            s.rotation.x += dt * 0.05;
            s.position.y += Math.sin(t * 0.6 + s.position.x) * 0.01;
        }
        for (const pad of this.pads) {
            pad.ring.rotation.z += dt * 0.8;
            pad.mesh.material.emissiveIntensity = 0.55 + Math.sin(t * 3) * 0.25;
        }
        for (const g of this.goals) {
            g.userData.ring.rotation.z += dt * 0.7;
            g.userData.veil.material.opacity = 0.16 + Math.sin(t * 2.4) * 0.06;
        }
    }
}
