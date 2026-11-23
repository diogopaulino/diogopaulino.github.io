/**
 * gfx/guide — bússola do objetivo: seta no HUD que aponta para o próximo alvo.
 * Compartilhada por Menina da Lanterna, João e o Pé de Feijão e Jornada do Anel.
 *
 * A seta é relativa à câmera (para cima = para onde a câmera olha):
 *   f = frente da câmera no plano XZ (normalizada) · r = (−f.z, f.x) = direita da tela
 *   d = alvo − portador
 *   θ = atan2(d·r, d·f)       (0 = em frente, +90° = à direita; CSS rotate é horário)
 * Some quando o alvo está a menos de `near` m (o aviso "E …" assume a partir daí).
 * Escreve no DOM só quando o ângulo muda mais de ~1,5° ou a distância muda 1 m.
 */

import * as THREE from 'three';

const DIR = new THREE.Vector3();

export class Guide {
    constructor(el) {
        this.el = el;
        this.arrow = el?.querySelector('[data-guide-arrow]');
        this.dist = el?.querySelector('[data-guide-dist]');
        this.name = el?.querySelector('[data-guide-name]');
        this.lastA = 999;
        this.lastD = -1;
        this.lastName = '';
        this.shown = false;
    }

    hide() {
        if (!this.el || !this.shown) return;
        this.shown = false;
        this.el.hidden = true;
    }

    /** target: { x, z, name?, near? } ou null. */
    update(camera, px, pz, target) {
        if (!this.el) return;
        if (!target) {
            this.hide();
            return;
        }
        const dx = target.x - px;
        const dz = target.z - pz;
        const d = Math.hypot(dx, dz);
        if (d < (target.near ?? 2.6)) {
            this.hide();
            return;
        }
        camera.getWorldDirection(DIR);
        let fx = DIR.x;
        let fz = DIR.z;
        const fl = Math.hypot(fx, fz) || 1;
        fx /= fl;
        fz /= fl;
        const a = Math.atan2(dx * -fz + dz * fx, dx * fx + dz * fz);
        if (!this.shown) {
            this.shown = true;
            this.el.hidden = false;
        }
        if (Math.abs(a - this.lastA) > 0.026) {
            this.lastA = a;
            this.arrow.style.transform = `rotate(${a.toFixed(3)}rad)`;
        }
        const m = Math.round(d);
        if (m !== this.lastD) {
            this.lastD = m;
            this.dist.textContent = `${m} m`;
        }
        const name = target.name || '';
        if (name !== this.lastName && this.name) {
            this.lastName = name;
            this.name.textContent = name;
        }
    }
}
