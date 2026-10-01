/**
 * ambience — névoa baixa, vinheta narrativa, cartões de capítulo.
 */

import * as THREE from 'three';
import { chapterAt } from '../config.js';

export function create(ctx) {
    const { scene } = ctx;
    const group = new THREE.Group();
    group.name = 'ambience';

    // Névoa rasteira sobre a água (planos)
    const mistMat = new THREE.MeshBasicMaterial({
        color: '#d8d0c0',
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
        side: THREE.DoubleSide
    });
    for (let i = 0; i < 5; i++) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(120, 40), mistMat);
        m.rotation.x = -Math.PI / 2;
        m.position.set(-20 + i * 15, 1.5 + i * 0.3, -100 + i * 40);
        group.add(m);
    }

    scene.add(group);

    const chapterEl = document.getElementById('chapterLabel');
    const clockEl = document.getElementById('filmClock');
    let lastChapter = '';

    return {
        update(t) {
            const ch = chapterAt(t);
            if (chapterEl && ch.id !== lastChapter) {
                lastChapter = ch.id;
                chapterEl.textContent = ch.label;
                chapterEl.dataset.flash = '1';
                requestAnimationFrame(() => { chapterEl.dataset.flash = '0'; });
            }
            if (clockEl) {
                // Relógio diegético ~9h → 9h30
                const minutes = 9 * 60 + Math.floor((t / 180) * 30);
                const hh = Math.floor(minutes / 60);
                const mm = minutes % 60;
                clockEl.textContent = `${hh}:${String(mm).padStart(2, '0')}`;
            }
            // Pulsar névoa
            mistMat.opacity = 0.08 + Math.sin(t * 0.2) * 0.03;
        },
        dispose() {
            mistMat.dispose();
            scene.remove(group);
        }
    };
}
