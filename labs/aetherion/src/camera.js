/**
 * Câmera do observatório: órbita esférica amortecida em torno do corpo
 * focado, com interpolação cinematográfica ao trocar de alvo.
 */

import * as THREE from 'three';

export class ObservatoryCamera {
    constructor(camera, canvas) {
        this.camera = camera;
        this.canvas = canvas;
        this.spherical = new THREE.Spherical(72, 1.12, 0.55);
        this.desired = new THREE.Spherical(72, 1.12, 0.55);
        this.target = new THREE.Vector3();
        this.desiredTarget = new THREE.Vector3();
        this.minR = 8;
        this.maxR = 620;
        this.dragging = false;
        this.moved = false;
        this.pointers = new Map();
        this.pinch0 = 0;
        this.auto = true;
        this.warping = 0;
        this._offset = new THREE.Vector3();
        this.bind();
    }

    bind() {
        const el = this.canvas;
        el.addEventListener('pointerdown', (e) => this.onDown(e));
        el.addEventListener('pointermove', (e) => this.onMove(e));
        el.addEventListener('pointerup', (e) => this.onUp(e));
        el.addEventListener('pointercancel', (e) => this.onUp(e));
        el.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
        el.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    focus(position, distance, immediate = false) {
        this.desiredTarget.copy(position);
        this.desired.radius = THREE.MathUtils.clamp(distance, this.minR, this.maxR);
        this.warping = 1;
        this.auto = false;
        if (immediate) {
            this.target.copy(position);
            this.spherical.radius = this.desired.radius;
            this.warping = 0;
        }
    }

    systemView() {
        this.desiredTarget.set(0, 0, 0);
        this.desired.radius = 280;
        this.desired.phi = 1.05;
        this.warping = 1;
        this.auto = true;
    }

    onDown(e) {
        this.canvas.setPointerCapture(e.pointerId);
        this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        this.moved = false;
        if (this.pointers.size === 1) {
            this.dragging = true;
            this.auto = false;
            this.canvas.classList.add('is-dragging');
        }
        if (this.pointers.size === 2) {
            const pts = [...this.pointers.values()];
            this.pinch0 = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        }
    }

    onMove(e) {
        if (!this.pointers.has(e.pointerId)) return;
        const prev = this.pointers.get(e.pointerId);
        const dx = e.clientX - prev.x;
        const dy = e.clientY - prev.y;
        this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (this.pointers.size === 2) {
            const pts = [...this.pointers.values()];
            const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
            if (this.pinch0 > 0) {
                const ratio = dist / this.pinch0;
                this.desired.radius = THREE.MathUtils.clamp(
                    this.desired.radius / ratio,
                    this.minR,
                    this.maxR
                );
                this.pinch0 = dist;
            }
            this.moved = true;
            return;
        }

        if (!this.dragging) return;
        if (Math.abs(dx) + Math.abs(dy) > 3) this.moved = true;
        this.desired.theta -= dx * 0.005;
        this.desired.phi = THREE.MathUtils.clamp(this.desired.phi - dy * 0.005, 0.18, Math.PI - 0.18);
    }

    onUp(e) {
        this.pointers.delete(e.pointerId);
        if (this.pointers.size < 2) this.pinch0 = 0;
        if (this.pointers.size === 0) {
            this.dragging = false;
            this.canvas.classList.remove('is-dragging');
            this.canvas.releasePointerCapture?.(e.pointerId);
        }
    }

    onWheel(e) {
        e.preventDefault();
        const k = Math.exp(e.deltaY * 0.0016);
        this.desired.radius = THREE.MathUtils.clamp(this.desired.radius * k, this.minR, this.maxR);
        this.auto = false;
    }

    consumeClick() {
        const was = this.moved;
        this.moved = false;
        return !was;
    }

    update(dt) {
        if (this.auto && !this.dragging) {
            this.desired.theta += dt * 0.045;
        }
        const k = 1 - Math.pow(0.001, dt);
        this.spherical.theta += (this.desired.theta - this.spherical.theta) * k * 1.8;
        this.spherical.phi += (this.desired.phi - this.spherical.phi) * k * 1.8;
        this.spherical.radius += (this.desired.radius - this.spherical.radius) * k * 1.4;
        this.target.lerp(this.desiredTarget, k * 1.5);

        this.spherical.makeSafe();
        this._offset.setFromSpherical(this.spherical);
        this.camera.position.copy(this.target).add(this._offset);
        this.camera.lookAt(this.target);

        if (this.warping > 0) {
            this.warping = Math.max(0, this.warping - dt * 0.85);
            const punch = Math.sin(this.warping * Math.PI) * 9;
            this.camera.fov = 52 + punch;
            this.camera.updateProjectionMatrix();
        }

        return this.warping;
    }
}
