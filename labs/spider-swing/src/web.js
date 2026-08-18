/**
 * Fio visível: cilindro tenso + linha com catenária leve até o âncora.
 */

import * as THREE from 'three';
import { PALETTE } from './config.js';

const UP = new THREE.Vector3(0, 1, 0);
const DIR = new THREE.Vector3();
const MID = new THREE.Vector3();

export class SilkWeb {
    constructor(scene) {
        this.active = false;
        this.anchor = new THREE.Vector3();

        const glow = new THREE.MeshBasicMaterial({
            color: PALETTE.web,
            toneMapped: false,
            transparent: true,
            opacity: 0.95
        });
        this.strand = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.018, 1, 6), glow);
        this.strand.visible = false;
        scene.add(this.strand);

        const pts = new Float32Array(12 * 3);
        this.lineGeo = new THREE.BufferGeometry();
        this.lineGeo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
        this.line = new THREE.Line(
            this.lineGeo,
            new THREE.LineBasicMaterial({
                color: 0x9ad0ff,
                transparent: true,
                opacity: 0.55,
                toneMapped: false
            })
        );
        this.line.visible = false;
        this.line.frustumCulled = false;
        scene.add(this.line);

        this.impact = new THREE.Mesh(
            new THREE.SphereGeometry(0.22, 10, 8),
            new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })
        );
        this.impact.visible = false;
        scene.add(this.impact);
    }

    attach(point) {
        this.active = true;
        this.anchor.copy(point);
        this.strand.visible = true;
        this.line.visible = true;
        this.impact.visible = true;
        this.impact.position.copy(point);
    }

    release() {
        this.active = false;
        this.strand.visible = false;
        this.line.visible = false;
        this.impact.visible = false;
    }

    update(from) {
        if (!this.active) return;
        DIR.copy(this.anchor).sub(from);
        const len = DIR.length() || 0.01;
        MID.copy(from).add(this.anchor).multiplyScalar(0.5);
        this.strand.position.copy(MID);
        this.strand.scale.set(1, len, 1);
        this.strand.quaternion.setFromUnitVectors(UP, DIR.normalize());

        const pos = this.lineGeo.attributes.position;
        const sag = Math.min(4.5, len * 0.035);
        for (let i = 0; i < 12; i++) {
            const t = i / 11;
            const x = from.x + (this.anchor.x - from.x) * t;
            const y = from.y + (this.anchor.y - from.y) * t - sag * Math.sin(t * Math.PI);
            const z = from.z + (this.anchor.z - from.z) * t;
            pos.setXYZ(i, x, y, z);
        }
        pos.needsUpdate = true;
        this.lineGeo.computeBoundingSphere();
    }
}
