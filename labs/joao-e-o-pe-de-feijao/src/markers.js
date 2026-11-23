/**
 * Leitura de pulo: sombra de contato sob o João e anel de pouso no alvo do salto.
 *
 * Sombra (disco com degradê radial, sem escrever profundidade) projetada no apoio logo
 * abaixo dele (terreno ou folha — player.surfaceBelow). Com a altura h acima do apoio:
 *   raio = 0,42·(1 − 0,35·min(1, h/6))   opacidade = 0,5 − 0,25·min(1, h/8)
 * No ar ela fica mais nítida que a sombra do sol (que some à noite e na sombra das folhas),
 * então o jogador sempre sabe onde vai cair. Some a mais de 30 m de queda.
 *
 * Anel dourado: marca o alvo do salto assistido (folha atrás do João no caule, ou o
 * ponto de agarre do caule visto de uma folha). Pulsa 1,6 Hz e encara o céu.
 */

import * as THREE from 'three';

function radialTexture(stops) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    for (const [o, col] of stops) grd.addColorStop(o, col);
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

export function createMarkers(scene) {
    const shadowMat = new THREE.MeshBasicMaterial({
        map: radialTexture([[0, 'rgba(0,0,0,1)'], [0.55, 'rgba(0,0,0,0.55)'], [1, 'rgba(0,0,0,0)']]),
        transparent: true, depthWrite: false, opacity: 0.45, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4
    });
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2), shadowMat);
    shadow.renderOrder = 2;
    shadow.frustumCulled = false;

    const ringMat = new THREE.MeshBasicMaterial({
        map: radialTexture([[0, 'rgba(255,214,120,0)'], [0.62, 'rgba(255,214,120,0)'], [0.74, 'rgba(255,224,140,1)'], [0.86, 'rgba(255,190,70,0.5)'], [1, 'rgba(255,170,40,0)']]),
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6
    });
    const ring = new THREE.Mesh(new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2), ringMat);
    ring.renderOrder = 3;
    ring.frustumCulled = false;
    ring.visible = false;
    shadow.visible = false;
    scene.add(shadow, ring);

    let t = 0;
    return {
        shadow, ring,
        hide() {
            shadow.visible = false;
            ring.visible = false;
        },
        /** player/world: estado atual; `show` = falso fora do jogo (menu, cutscene). */
        update(dt, player, world, show) {
            t += dt;
            if (!show || !player.visible) {
                this.hide();
                return;
            }
            // sombra de contato
            if (player.climbing) {
                shadow.visible = false;
            } else {
                const gy = player.surfaceBelow(world, player.x, player.y, player.z);
                const h = player.y - gy;
                if (h > 30 || !(gy > -50)) {
                    shadow.visible = false;
                } else {
                    shadow.visible = true;
                    const r = 0.42 * (1 - 0.35 * Math.min(1, h / 6));
                    shadow.scale.set(r, 1, r);
                    shadow.position.set(player.x, gy + 0.05, player.z);
                    shadowMat.opacity = 0.5 - 0.25 * Math.min(1, h / 8);
                }
            }
            // anel de pouso
            const tg = player.leap ? player.leap : player.target;
            if (tg) {
                const x = player.leap ? tg.tx : tg.x;
                const y = player.leap ? tg.ty : tg.y;
                const z = player.leap ? tg.tz : tg.z;
                const stalk = tg.kind === 'stalk';
                ring.visible = true;
                const pulse = 1 + 0.08 * Math.sin(t * 10);
                const r = (stalk ? 0.55 : 0.85) * pulse;
                ring.scale.set(r, 1, r);
                ring.position.set(x, y + (stalk ? -0.2 : 0.08), z);
                ringMat.opacity = player.leap ? 1 : 0.75 + 0.25 * Math.sin(t * 10);
            } else {
                ring.visible = false;
            }
        }
    };
}
