/**
 * Cenário ao longo do trilho: plataformas, vegetação, ilhas e o portal final.
 */

import * as THREE from 'three';
import { cloudTexture } from './textures.js';
import {
    createPlatformMesh,
    createTree,
    createMushroom,
    createCrystalRock,
    createColumn,
    createIsland,
    createPortal,
    createSkyDome
} from './models.js';
import { hash01 } from './utils.js';

export class World {
    constructor(scene, course, quality) {
        this.scene = scene;
        this.course = course;
        this.quality = quality;
        this.group = new THREE.Group();
        this.floaters = [];
        this.clouds = [];
        this.portal = null;
        this._dummy = new THREE.Object3D();
        this._frame = {};
        scene.add(this.group);
        this._build();
    }

    _build() {
        this.group.add(createSkyDome());
        this._buildPlatforms();
        this._buildScenery();
        this._buildIslands();
        this._buildClouds();
        this._buildPortal();
    }

    _orient(mesh, frame) {
        this._dummy.position.copy(frame.pos);
        this._dummy.up.set(0, 1, 0);
        this._dummy.lookAt(
            frame.pos.x + frame.tangent.x,
            frame.pos.y + frame.tangent.y,
            frame.pos.z + frame.tangent.z
        );
        mesh.quaternion.copy(this._dummy.quaternion);
    }

    _buildPlatforms() {
        const step = 2.35;
        for (let s = 0; s < this.course.length; s += step) {
            const floor = this.course.floorAt(s, 0);
            if (!floor) continue;
            const t = s / this.course.length;
            const type = t > 0.86 ? 'gold' : floor.type === 'float' ? 'float' : 'solid';
            const piece = createPlatformMesh(type);
            const frame = this.course.frame(s, this._frame);
            piece.position.copy(frame.pos);
            piece.position.y = floor.y - 0.38;
            piece.scale.set(floor.width, 0.76, step * 1.08);
            this._orient(piece, frame);
            this.group.add(piece);
            if (floor.type === 'float') {
                this.floaters.push({ mesh: piece, s, baseY: floor.y - 0.38 });
            }
        }
    }

    _buildScenery() {
        const step = this.quality.sceneryStep;
        const treeProto = createTree();
        const mushProto = createMushroom();
        const rockProto = createCrystalRock();
        const colProto = createColumn();

        for (let s = 4; s < this.course.length - 10; s += step) {
            const floor = this.course.floorAt(s, 0);
            if (!floor) continue;
            const frame = this.course.frame(s, this._frame);
            const side = hash01(s * 1.7) > 0.5 ? 1 : -1;
            const dist = floor.width * 0.5 + 1.4 + hash01(s * 2.9) * 2.6;
            const t = s / this.course.length;
            let proto;
            if (t < 0.12 || t > 0.88) proto = colProto;
            else if (t > 0.55 && t < 0.78) proto = rockProto;
            else proto = hash01(s * 4.1) > 0.45 ? treeProto : mushProto;

            const item = proto.clone();
            item.position.copy(frame.pos).addScaledVector(frame.binormal, side * dist);
            item.position.y = floor.y;
            item.rotation.y = hash01(s * 8.2) * Math.PI * 2;
            const sc = 0.75 + hash01(s * 3.3) * 0.7;
            item.scale.setScalar(sc);
            this.group.add(item);

            if (hash01(s * 5.5) > 0.55) {
                const other = (proto === treeProto ? mushProto : treeProto).clone();
                other.position.copy(frame.pos).addScaledVector(frame.binormal, -side * (dist + 0.8));
                other.position.y = floor.y;
                other.rotation.y = hash01(s * 9.1) * Math.PI * 2;
                other.scale.setScalar(0.7 + hash01(s) * 0.5);
                this.group.add(other);
            }
        }
    }

    _buildIslands() {
        const proto = createIsland();
        for (let i = 0; i < 18; i++) {
            const s = (i + 0.5) / 18 * this.course.length;
            const frame = this.course.frame(s, this._frame);
            const island = proto.clone();
            const side = i % 2 === 0 ? 1 : -1;
            island.position.copy(frame.pos)
                .addScaledVector(frame.binormal, side * (18 + hash01(i) * 22))
                .addScaledVector(frame.normal, -6 - hash01(i + 3) * 10);
            island.scale.setScalar(1.4 + hash01(i + 7) * 2.4);
            island.rotation.y = hash01(i + 11) * 6;
            this.group.add(island);
        }
    }

    _buildClouds() {
        const mat = new THREE.SpriteMaterial({
            map: cloudTexture(),
            transparent: true,
            depthWrite: false,
            opacity: 0.85
        });
        for (let i = 0; i < 16; i++) {
            const sprite = new THREE.Sprite(mat);
            const s = hash01(i * 13) * this.course.length;
            const frame = this.course.frame(s, this._frame);
            sprite.position.copy(frame.pos)
                .addScaledVector(frame.binormal, (hash01(i) - 0.5) * 70)
                .addScaledVector(frame.normal, 12 + hash01(i + 2) * 18);
            sprite.scale.set(14 + hash01(i + 4) * 18, 7 + hash01(i + 5) * 8, 1);
            this.group.add(sprite);
            this.clouds.push(sprite);
        }
    }

    _buildPortal() {
        this.portal = createPortal();
        const frame = this.course.frame(this.course.goalS, this._frame);
        this.portal.position.copy(frame.pos);
        this.portal.position.y += 1.6;
        this._orient(this.portal, frame);
        this.group.add(this.portal);
    }

    update(time) {
        for (const f of this.floaters) {
            const floor = this.course.floorAt(f.s, time);
            if (!floor) continue;
            f.mesh.position.y = floor.y - 0.38;
        }
        if (this.portal) {
            this.portal.rotation.z = time * 0.35;
            const pulse = 1 + Math.sin(time * 2.2) * 0.04;
            this.portal.scale.setScalar(pulse);
        }
        for (let i = 0; i < this.clouds.length; i++) {
            this.clouds[i].position.x += Math.sin(time * 0.07 + i) * 0.01;
        }
    }
}
