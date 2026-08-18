/**
 * Pet paramétrico: cão ou gato, raça, pelagem e animação por poses.
 * Origem no chão, pet olha para +Z.
 */

import * as THREE from 'three';
import { breedById, coatById } from './config.js';
import { furMaps } from './textures.js';
import { damp, clamp } from './utils.js';

const geoCache = new Map();

function geo(key, factory) {
    if (!geoCache.has(key)) geoCache.set(key, factory());
    return geoCache.get(key);
}

function mesh(geometry, material, { pos, scale, rot, cast = true, receive = true } = {}) {
    const m = new THREE.Mesh(geometry, material);
    if (pos) m.position.set(...pos);
    if (scale) m.scale.set(...scale);
    if (rot) m.rotation.set(...rot);
    m.castShadow = cast;
    m.receiveShadow = receive;
    return m;
}

function physical(color, maps, extra = {}) {
    return new THREE.MeshPhysicalMaterial({
        color,
        map: maps?.map || null,
        normalMap: maps?.normalMap || null,
        roughnessMap: maps?.roughnessMap || null,
        roughness: extra.roughness ?? 0.76,
        metalness: 0.02,
        sheen: extra.sheen ?? 1,
        sheenColor: extra.sheenColor || new THREE.Color(color).lerp(new THREE.Color(0xfff4e8), 0.45),
        sheenRoughness: extra.sheenRoughness ?? 0.48,
        clearcoat: extra.clearcoat ?? 0.06,
        clearcoatRoughness: extra.clearcoatRoughness ?? 0.55,
        envMapIntensity: extra.env ?? 0.55
    });
}

function eyeMaps() {
    const el = document.createElement('canvas');
    el.width = el.height = 128;
    const ctx = el.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
    g.addColorStop(0, '#1a100c');
    g.addColorStop(0.22, '#1a100c');
    g.addColorStop(0.24, '#4a7a38');
    g.addColorStop(0.55, '#2a4a22');
    g.addColorStop(0.72, '#f4efe8');
    g.addColorStop(1, '#e8e0d4');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(el);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

export class Pet {
    constructor(profile, quality) {
        this.profile = profile;
        this.quality = quality;
        this.root = new THREE.Group();
        this.root.name = 'pet';
        this.parts = { legs: [], ears: [], tail: [], mats: [] };
        this.action = 'idle';
        this.actionT = 0;
        this.wet = 0;
        this.look = new THREE.Vector2();
        this.wag = 1;
        this.sit = 0;
        this.sleep = 0;
        this.headDip = 0;
        this.shake = 0;
        this.bounce = 0;
        this.walk = 0;
        this.phase = 0;
        this.build();
    }

    rebuild(profile) {
        this.profile = profile;
        while (this.root.children.length) this.root.remove(this.root.children[0]);
        this.parts = { legs: [], ears: [], tail: [], mats: [], eyes: [] };
        this.build();
    }

    build() {
        const breed = breedById(this.profile.species, this.profile.breed);
        const coat = coatById(this.profile.coat || breed.coat);
        this.breed = breed;
        this.coat = coat;
        const segs = this.quality?.segs ?? 18;
        const fur = furMaps(coat.primary, coat.secondary, coat.belly, breed.pattern, this.quality?.aniso ?? 4);
        const sheenCol = new THREE.Color(coat.primary).lerp(new THREE.Color(0xfff0e0), 0.4);
        const furMat = physical(0xffffff, fur, {
            sheenColor: sheenCol,
            sheen: 0.7 + breed.fur * 0.4,
            sheenRoughness: 0.35 + (1 - breed.fur) * 0.3,
            roughness: 0.7 + (1 - breed.fur) * 0.15
        });
        const bellyMat = physical(coat.belly, fur, { sheenColor: new THREE.Color(coat.belly) });
        const noseMat = new THREE.MeshPhysicalMaterial({
            color: coat.nose, roughness: 0.28, metalness: 0.08, clearcoat: 0.55, clearcoatRoughness: 0.25
        });
        const padMat = new THREE.MeshPhysicalMaterial({ color: 0x2a1814, roughness: 0.7 });
        const innerEar = new THREE.MeshPhysicalMaterial({
            color: 0xe8a8a0, roughness: 0.55, sheen: 0.4, sheenColor: 0xffd0c8
        });
        this.parts.mats.push(furMat, bellyMat);
        this.furMat = furMat;

        const sph = geo(`sph${segs}`, () => new THREE.SphereGeometry(1, segs, segs - 2));
        const sphLo = geo('sphLo', () => new THREE.SphereGeometry(1, 12, 10));
        const cap = geo(`cap${segs}`, () => new THREE.CapsuleGeometry(1, 1, 6, segs));
        const cyl = geo('cyl', () => new THREE.CylinderGeometry(1, 1, 1, 12));

        const hipY = breed.legLen + 0.02;
        this.restHip = hipY;

        const body = new THREE.Group();
        body.position.y = hipY;
        this.root.add(body);
        this.parts.body = body;

        const torso = mesh(sph, furMat, {
            scale: [breed.bodyW, breed.bodyH, breed.bodyLen * 0.5],
            pos: [0, breed.bodyH * 0.15, 0]
        });
        body.add(torso);
        this.parts.torso = torso;

        body.add(mesh(sph, furMat, {
            scale: [breed.bodyW * 0.92, breed.bodyH * 0.9, breed.bodyW * 0.85],
            pos: [0, breed.bodyH * 0.12, breed.bodyLen * 0.28]
        }));
        body.add(mesh(sph, furMat, {
            scale: [breed.bodyW * 0.88, breed.bodyH * 0.85, breed.bodyW * 0.8],
            pos: [0, breed.bodyH * 0.08, -breed.bodyLen * 0.28]
        }));
        body.add(mesh(sphLo, bellyMat, {
            scale: [breed.bodyW * 0.62, breed.bodyH * 0.42, breed.bodyLen * 0.38],
            pos: [0, -breed.bodyH * 0.18, 0.04],
            cast: false
        }));

        if (breed.fur > 0.7) {
            body.add(mesh(sphLo, furMat, {
                scale: [breed.bodyW * 1.05, breed.bodyH * 0.7, breed.bodyLen * 0.22],
                pos: [0, breed.bodyH * 0.08, -breed.bodyLen * 0.38]
            }));
        }

        if (breed.pattern === 'poodle') {
            body.add(mesh(sph, furMat, {
                scale: [breed.bodyW * 0.7, breed.bodyH * 0.7, breed.bodyW * 0.7],
                pos: [0, breed.bodyH * 0.22, breed.bodyLen * 0.22]
            }));
        }

        const cat = this.profile.species === 'cat';
        const neck = new THREE.Group();
        neck.position.set(0, breed.bodyH * 0.35, breed.bodyLen * 0.38);
        body.add(neck);
        this.parts.neck = neck;

        const head = new THREE.Group();
        head.position.set(0, breed.head * 0.15, breed.head * 0.15);
        neck.add(head);
        this.parts.head = head;

        const hs = breed.head;
        head.add(mesh(sph, furMat, { scale: [hs * 0.95, hs * (cat ? 0.88 : 0.92), hs] }));
        if (breed.snout > 0.1) {
            head.add(mesh(sph, bellyMat, {
                scale: [hs * 0.42 * (0.6 + breed.snout), hs * 0.32, hs * breed.snout * 1.15],
                pos: [0, -hs * 0.18, hs * (0.55 + breed.snout * 0.4)]
            }));
        }
        head.add(mesh(sphLo, noseMat, {
            scale: [0.045 + breed.snout * 0.04, 0.035, 0.04],
            pos: [0, -hs * 0.16, hs * (0.72 + breed.snout * 0.55)]
        }));

        const eyeMat = new THREE.MeshPhysicalMaterial({
            map: eyeMaps(),
            color: new THREE.Color(coat.eyes),
            roughness: 0.12,
            metalness: 0.05,
            clearcoat: 0.9,
            clearcoatRoughness: 0.08,
            envMapIntensity: 1.1
        });
        const spark = new THREE.MeshPhysicalMaterial({
            color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.45, roughness: 0.1
        });
        const eyeZ = hs * (0.62 + breed.snout * 0.1);
        const eyeY = cat ? hs * 0.08 : hs * 0.06;
        const eyeSpread = hs * (cat ? 0.32 : 0.3);
        const eyeS = cat ? 0.072 : 0.078;
        this.parts.eyes = [];
        for (const sx of [-1, 1]) {
            const eye = mesh(sph, eyeMat, {
                scale: [eyeS, eyeS * 1.05, eyeS * 0.7],
                pos: [sx * eyeSpread, eyeY, eyeZ],
                cast: false
            });
            head.add(eye);
            this.parts.eyes.push(eye);
            head.add(mesh(sphLo, spark, {
                scale: [0.018, 0.02, 0.012],
                pos: [sx * eyeSpread + 0.018, eyeY + 0.02, eyeZ + 0.04],
                cast: false
            }));
        }

        head.add(mesh(sphLo, innerEar, {
            scale: [0.06, 0.04, 0.04], pos: [hs * 0.42, -hs * 0.12, hs * 0.5], cast: false
        }));
        head.add(mesh(sphLo, innerEar, {
            scale: [0.06, 0.04, 0.04], pos: [-hs * 0.42, -hs * 0.12, hs * 0.5], cast: false
        }));

        this._ears(head, breed, furMat, innerEar, sph, segs);

        if (cat) {
            const whisker = new THREE.MeshPhysicalMaterial({
                color: 0xf4efe8, roughness: 0.4, transparent: true, opacity: 0.75
            });
            const wgeo = geo('whisk', () => new THREE.CylinderGeometry(0.006, 0.004, 0.28, 4));
            for (const sx of [-1, 1]) {
                for (const k of [-0.08, 0, 0.08]) {
                    head.add(mesh(wgeo, whisker, {
                        pos: [sx * hs * 0.28, -hs * 0.12 + k * 0.4, hs * 0.55],
                        rot: [0, 0, sx * (1.15 + k)],
                        cast: false
                    }));
                }
            }
        }

        neck.add(mesh(cyl, new THREE.MeshPhysicalMaterial({
            color: 0xc45a48, roughness: 0.4, metalness: 0.15, clearcoat: 0.3
        }), {
            scale: [hs * 0.72, 0.04, hs * 0.72],
            pos: [0, -hs * 0.42, -hs * 0.05],
            rot: [0.15, 0, 0]
        }));
        neck.add(mesh(sphLo, new THREE.MeshPhysicalMaterial({
            color: 0xe8c878, roughness: 0.25, metalness: 0.7
        }), { scale: [0.04, 0.05, 0.012], pos: [0, -hs * 0.52, hs * 0.28] }));

        this._legs(breed, furMat, padMat, cap, sphLo);
        this._tail(breed, furMat, sph, sphLo);

        const shadow = new THREE.Mesh(
            geo('shad', () => new THREE.CircleGeometry(0.55, 24)),
            new THREE.MeshBasicMaterial({ color: 0x1a100c, transparent: true, opacity: 0.22, depthWrite: false })
        );
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.y = 0.01;
        this.root.add(shadow);
        this.parts.shadow = shadow;
    }

    _ears(head, breed, furMat, innerEar, sph, segs) {
        const type = breed.ear;
        const s = breed.earSize * breed.head;
        const cone = geo(`cone${segs}`, () => new THREE.ConeGeometry(1, 1.4, 10));
        for (const sx of [-1, 1]) {
            const ear = new THREE.Group();
            ear.position.set(sx * breed.head * 0.52, breed.head * 0.55, -breed.head * 0.08);
            head.add(ear);
            this.parts.ears.push(ear);

            if (type === 'floppy') {
                ear.rotation.set(0.15, sx * 0.15, sx * 0.9);
                ear.add(mesh(sph, furMat, { scale: [s * 0.22, s * 0.55, s * 0.16], pos: [0, -s * 0.2, 0] }));
                ear.add(mesh(sph, innerEar, {
                    scale: [s * 0.14, s * 0.4, s * 0.08], pos: [sx * -0.02, -s * 0.18, s * 0.08], cast: false
                }));
            } else if (type === 'fold') {
                ear.rotation.set(0.4, sx * 0.2, sx * 0.6);
                ear.add(mesh(sph, furMat, { scale: [s * 0.2, s * 0.28, s * 0.12] }));
            } else if (type === 'small') {
                ear.rotation.set(0, 0, sx * 0.35);
                ear.add(mesh(sph, furMat, { scale: [s * 0.18, s * 0.28, s * 0.12], pos: [0, s * 0.1, 0] }));
                ear.add(mesh(sph, innerEar, {
                    scale: [s * 0.1, s * 0.18, s * 0.06], pos: [0, s * 0.1, s * 0.06], cast: false
                }));
            } else if (type === 'tuft') {
                ear.rotation.set(-0.15, sx * 0.1, sx * 0.25);
                ear.add(mesh(cone, furMat, { scale: [s * 0.22, s * 0.55, s * 0.18], pos: [0, s * 0.28, 0] }));
                ear.add(mesh(cone, innerEar, {
                    scale: [s * 0.12, s * 0.38, s * 0.08], pos: [0, s * 0.22, s * 0.06], cast: false
                }));
                ear.add(mesh(sph, furMat, { scale: [0.03, s * 0.18, 0.03], pos: [0, s * 0.72, 0] }));
            } else if (type === 'semi') {
                ear.rotation.set(-0.2, sx * 0.15, sx * 0.4);
                ear.add(mesh(sph, furMat, { scale: [s * 0.18, s * 0.42, s * 0.12], pos: [0, s * 0.12, 0] }));
                ear.add(mesh(sph, innerEar, {
                    scale: [s * 0.1, s * 0.28, s * 0.06], pos: [0, s * 0.1, s * 0.06], cast: false
                }));
            } else {
                ear.rotation.set(-0.25, sx * 0.12, sx * 0.22);
                ear.add(mesh(cone, furMat, { scale: [s * 0.22, s * 0.55, s * 0.16], pos: [0, s * 0.28, 0] }));
                ear.add(mesh(cone, innerEar, {
                    scale: [s * 0.12, s * 0.4, s * 0.07], pos: [0, s * 0.22, s * 0.05], cast: false
                }));
            }
        }
    }

    _legs(breed, furMat, padMat, cap, sphLo) {
        const len = breed.legLen;
        const r = breed.legR;
        const zf = breed.bodyLen * 0.28;
        const zb = -breed.bodyLen * 0.26;
        const x = breed.bodyW * 0.55;
        const places = [[-x, zf], [x, zf], [-x, zb], [x, zb]];
        for (let i = 0; i < 4; i++) {
            const [px, pz] = places[i];
            const leg = new THREE.Group();
            leg.position.set(px, this.restHip, pz);
            this.root.add(leg);
            leg.add(mesh(cap, furMat, { scale: [r, len * 0.55, r], pos: [0, -len * 0.35, 0] }));
            leg.add(mesh(sphLo, padMat, {
                scale: [r * 1.35, r * 0.55, r * 1.5], pos: [0, -len * 0.92, r * 0.3]
            }));
            this.parts.legs.push(leg);
        }
    }

    _tail(breed, furMat, sph, sphLo) {
        const holder = new THREE.Group();
        holder.position.set(0, this.restHip + breed.bodyH * 0.25, -breed.bodyLen * 0.48);
        this.root.add(holder);
        this.parts.tailRoot = holder;
        const n = breed.tail === 'short' ? 2 : 5;
        let parent = holder;
        const thick = breed.tail === 'whip' ? 0.045 : breed.tail === 'otter' ? 0.07 : 0.09;
        for (let i = 0; i < n; i++) {
            const seg = new THREE.Group();
            parent.add(seg);
            const s = thick * (1 - i * 0.12);
            const len = breed.tail === 'short' ? 0.08 : 0.14;
            const puff = breed.tail === 'bushy' || breed.tail === 'plume' || breed.tail === 'pompon';
            const sc = puff ? [s * 1.6, s * 1.6, len] : [s, s, len];
            seg.add(mesh(puff ? sph : sphLo, furMat, { scale: sc, pos: [0, 0, -len * 0.5] }));
            if (breed.tail === 'pompon' && i === n - 1) {
                seg.add(mesh(sph, furMat, { scale: [0.12, 0.12, 0.12], pos: [0, 0, -len] }));
            }
            seg.rotation.x = breed.tail === 'curl' ? -0.55 : breed.tail === 'short' ? 0.4 : -0.25;
            this.parts.tail.push(seg);
            parent = seg;
        }
    }

    setAction(name) {
        this.action = name;
        this.actionT = 0;
        if (name !== 'sleep') this.sleep = Math.min(this.sleep, 0.3);
    }

    setWet(v) {
        this.wet = clamp(v, 0, 1);
        for (const mat of this.parts.mats) {
            mat.clearcoat = 0.06 + this.wet * 0.7;
            mat.clearcoatRoughness = 0.55 - this.wet * 0.4;
            mat.roughness = 0.76 - this.wet * 0.28;
        }
    }

    headWorld(out) {
        this.parts.head.getWorldPosition(out);
        return out;
    }

    update(dt, needs) {
        this.actionT += dt;
        this.phase += dt;
        const tired = needs.energy < 28;
        const sad = needs.joy < 28;
        const dirty = needs.hygiene < 30;

        const wantSit = this.action === 'sit' || this.action === 'eat' || this.action === 'bath'
            || (tired && this.action === 'idle');
        const wantSleep = this.action === 'sleep';
        this.sit = damp(this.sit, wantSit ? 1 : 0, 4.2, dt);
        this.sleep = damp(this.sleep, wantSleep ? 1 : 0, 2.4, dt);
        this.headDip = damp(this.headDip, this.action === 'eat' ? 1 : 0, 6, dt);
        const playing = this.action === 'play';
        this.walk = damp(this.walk, (this.action === 'walk' || playing) ? 1 : 0, 5, dt);
        this.bounce = damp(this.bounce, playing ? 1 : 0, 5, dt);
        this.shake = damp(this.shake, this.action === 'shake' ? 1 : 0, 8, dt);
        this.wag = damp(this.wag, sad ? 0.15 : this.action === 'pet' ? 1.8 : 1, 3, dt);

        const breath = 1 + Math.sin(this.phase * (wantSleep ? 1.4 : 2.4)) * 0.03;
        this.parts.torso.scale.y = this.breed.bodyH * breath;

        const hipDrop = this.sit * this.restHip * 0.42 + this.sleep * this.restHip * 0.55;
        this.parts.body.position.y = this.restHip - hipDrop;
        this.parts.body.rotation.x = this.sit * 0.22 + this.sleep * 0.55;
        this.root.rotation.z = this.sleep * 0.7;
        this.root.position.y = this.bounce * Math.abs(Math.sin(this.phase * 8)) * 0.12;

        if (this.action === 'play') {
            this.root.position.x = Math.sin(this.phase * 1.6) * 0.55;
            this.root.position.z = Math.cos(this.phase * 1.6) * 0.35;
            this.root.rotation.y = Math.sin(this.phase * 1.6) * 0.4 + Math.PI * 0.15;
        } else if (this.action !== 'walk') {
            this.root.position.x = damp(this.root.position.x, 0, 3, dt);
            this.root.position.z = damp(this.root.position.z, 0, 3, dt);
            if (this.action === 'idle' && !wantSleep) {
                this.root.rotation.y = damp(this.root.rotation.y, Math.sin(this.phase * 0.25) * 0.15, 2, dt);
            }
        }

        this.parts.neck.rotation.x = this.headDip * 0.7 - this.sit * 0.1 + Math.sin(this.phase * 1.1) * 0.04;
        this.parts.head.rotation.y = this.look.x + Math.sin(this.phase * 0.6) * 0.08;
        this.parts.head.rotation.x = this.look.y - this.headDip * 0.25;
        this.parts.head.rotation.z = this.shake * Math.sin(this.phase * 28) * 0.35;

        const blink = (this.phase % 4.6) < 0.12 || this.sleep > 0.5 || this.action === 'pet';
        for (const eye of this.parts.eyes || []) {
            eye.scale.y = blink ? 0.012 : eye.scale.x * 1.05;
        }

        const gait = this.phase * 10;
        this.parts.legs.forEach((leg, i) => {
            const front = i < 2;
            const stride = Math.sin(gait + (i % 2 === 0 ? 0 : Math.PI)) * this.walk * 0.55;
            leg.rotation.x = stride + (front ? this.sit * 0.15 : this.sit * 1.15);
            leg.position.y = this.restHip - hipDrop * (front ? 0.15 : 0.85);
            if (!front) leg.position.z = -this.breed.bodyLen * 0.26 + this.sit * 0.12;
        });

        const wagSpeed = 7 + this.wag * 4;
        const wagAmp = 0.22 * this.wag * (1 - this.sleep);
        this.parts.tail.forEach((seg, i) => {
            const curl = this.breed.tail === 'curl' ? -0.5 : this.breed.tail === 'short' ? 0.35 : -0.22;
            seg.rotation.x = curl + this.sit * 0.2;
            seg.rotation.y = Math.sin(this.phase * wagSpeed - i * 0.7) * wagAmp * ((i + 1) / this.parts.tail.length);
        });

        if (this.parts.shadow) {
            this.parts.shadow.scale.setScalar(1 + this.sit * 0.15);
            this.parts.shadow.material.opacity = 0.18 + this.sleep * 0.08;
        }

        this.furMat.color.setHex(0xffffff).multiplyScalar(dirty ? 0.72 : 1);
        this.look.x = damp(this.look.x, 0, 1.6, dt);
        this.look.y = damp(this.look.y, 0, 1.6, dt);
    }
}
