/**
 * Partículas: corações, gotas, bolhas e farelo.
 */

import * as THREE from 'three';

function makeSprite(draw, size = 64) {
    const el = document.createElement('canvas');
    el.width = el.height = size;
    draw(el.getContext('2d'), size);
    const tex = new THREE.CanvasTexture(el);
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
}

const heartMat = makeSprite((ctx, s) => {
    ctx.translate(s / 2, s / 2);
    ctx.scale(s / 28, s / 28);
    ctx.beginPath();
    ctx.moveTo(0, 6);
    ctx.bezierCurveTo(-12, -2, -10, -12, 0, -6);
    ctx.bezierCurveTo(10, -12, 12, -2, 0, 6);
    ctx.fillStyle = '#ff6b8a';
    ctx.fill();
});

const dropMat = makeSprite((ctx, s) => {
    ctx.translate(s / 2, s * 0.3);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(10, 16, 0, 22);
    ctx.quadraticCurveTo(-10, 16, 0, 0);
    ctx.fillStyle = 'rgba(160, 210, 255, 0.95)';
    ctx.fill();
});

const bubbleMat = makeSprite((ctx, s) => {
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s * 0.38, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(220, 245, 255, 0.85)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(s * 0.38, s * 0.38, s * 0.1, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fill();
});

const crumbMat = makeSprite((ctx, s) => {
    ctx.fillStyle = '#d4a056';
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s * 0.28, 0, Math.PI * 2);
    ctx.fill();
});

class Burst {
    constructor(mat, count) {
        this.items = [];
        this.alive = false;
        for (let i = 0; i < count; i++) {
            const spr = new THREE.Sprite(mat.clone());
            spr.visible = false;
            spr.scale.setScalar(0.12);
            this.items.push({
                spr,
                vel: new THREE.Vector3(),
                life: 0,
                max: 1
            });
        }
    }

    addTo(scene) {
        for (const it of this.items) scene.add(it.spr);
    }

    spawn(origin, n = this.items.length) {
        this.alive = true;
        for (let i = 0; i < this.items.length; i++) {
            const it = this.items[i];
            if (i >= n) {
                it.spr.visible = false;
                it.life = 0;
                continue;
            }
            it.spr.position.copy(origin);
            it.spr.position.x += (Math.random() - 0.5) * 0.15;
            it.spr.position.z += (Math.random() - 0.5) * 0.15;
            it.vel.set((Math.random() - 0.5) * 0.6, 0.4 + Math.random() * 0.7, (Math.random() - 0.5) * 0.6);
            it.life = it.max = 0.7 + Math.random() * 0.5;
            it.spr.visible = true;
            it.spr.material.opacity = 1;
        }
    }

    update(dt) {
        if (!this.alive) return;
        let any = false;
        for (const it of this.items) {
            if (it.life <= 0) {
                it.spr.visible = false;
                continue;
            }
            any = true;
            it.life -= dt;
            it.vel.y -= 0.55 * dt;
            it.spr.position.addScaledVector(it.vel, dt);
            it.spr.material.opacity = Math.max(0, it.life / it.max);
            it.spr.scale.setScalar(0.08 + 0.1 * (it.life / it.max));
        }
        this.alive = any;
    }
}

export class Effects {
    constructor(scene) {
        this.hearts = new Burst(heartMat, 10);
        this.drops = new Burst(dropMat, 16);
        this.bubbles = new Burst(bubbleMat, 14);
        this.crumbs = new Burst(crumbMat, 8);
        this.hearts.addTo(scene);
        this.drops.addTo(scene);
        this.bubbles.addTo(scene);
        this.crumbs.addTo(scene);
    }

    love(pos) { this.hearts.spawn(pos, 8); }
    splash(pos) { this.drops.spawn(pos, 14); }
    foam(pos) {
        this.bubbles.spawn(pos, 12);
        for (const it of this.bubbles.items) {
            it.vel.set((Math.random() - 0.5) * 0.2, 0.25 + Math.random() * 0.25, (Math.random() - 0.5) * 0.2);
        }
    }
    eat(pos) { this.crumbs.spawn(pos, 6); }

    update(dt) {
        this.hearts.update(dt);
        this.drops.update(dt);
        this.bubbles.update(dt);
        this.crumbs.update(dt);
    }
}
