// art/backdrops.js — céus, mar e cenários procedurais, baked uma vez em canvases offscreen.
// Teto: ~300 linhas.

import { ditherGradient, SVC } from '../core/palette.js';
import { W, H } from '../core/pixel.js';

function newCanvas(w, h) {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    return cv;
}

/** Céu de pôr do sol vice-city: gradiente ditherizado + disco solar com cortes. */
export function bakeSunsetSky(w = W, skyH = 150) {
    const cv = newCanvas(w, skyH);
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    ditherGradient(g, 0, 0, w, skyH, ['0', '1', '2', '3', '4', '5', '6', '7', '8'].reverse());

    // sol com cortes horizontais (estilo synthwave)
    const cx = w * 0.68, cy = skyH * 0.62, r = skyH * 0.42;
    g.save();
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = SVC['8'];
    g.fillRect(cx - r, cy - r, r * 2, r * 2);
    const bands = 6;
    for (let i = 0; i < bands; i++) {
        const t = i / (bands - 1);
        const by = cy - r + t * r * 1.6;
        const bh = 2 + t * 3;
        g.fillStyle = SVC['9'];
        g.fillRect(cx - r, by, r * 2, bh);
    }
    g.restore();

    // régua neon do horizonte
    g.fillStyle = SVC['x'];
    g.fillRect(0, skyH - 2, w, 1);
    g.fillStyle = SVC['z'];
    g.globalAlpha = 0.4;
    g.fillRect(0, skyH - 4, w, 2);
    g.globalAlpha = 1;

    return cv;
}

/** Mar com 3 tons de faixas horizontais (estático — o brilho anima por cima no draw). */
export function bakeSea(w, h) {
    const cv = newCanvas(w, h);
    const g = cv.getContext('2d');
    ditherGradient(g, 0, 0, w, h, ['9', 'a', 'b', 'c']);
    return cv;
}

/** Skyline distante — retângulos ditherizados, silhueta baixa poly. */
export function bakeSkyline(w, h, seedRng) {
    const cv = newCanvas(w, h);
    const g = cv.getContext('2d');
    g.fillStyle = SVC['m'];
    let x = 0;
    while (x < w) {
        const bw = seedRng.int(8, 22);
        const bh = seedRng.int(h * 0.3, h * 0.9);
        g.fillRect(x, h - bh, bw, bh);
        g.fillStyle = SVC['n'];
        for (let wy = h - bh + 3; wy < h - 2; wy += 5) {
            for (let wx = x + 2; wx < x + bw - 2; wx += 4) {
                if (seedRng.chance(0.5)) g.fillRect(wx, wy, 1, 1);
            }
        }
        g.fillStyle = SVC['m'];
        x += bw + seedRng.int(2, 6);
    }
    return cv;
}

/** Encosta do morro — triângulo verde escalonado com textura de vegetação. */
export function bakeMorro(w, h, rng) {
    const cv = newCanvas(w, h);
    const g = cv.getContext('2d');
    g.fillStyle = SVC['i'];
    g.beginPath();
    g.moveTo(0, h);
    g.lineTo(0, h * 0.25);
    g.lineTo(w, h * 0.65);
    g.lineTo(w, h);
    g.closePath();
    g.fill();
    g.fillStyle = SVC['j'];
    for (let i = 0; i < 60; i++) {
        const x = rng.range(0, w), t = x / w;
        const topY = h * 0.25 + t * (h * 0.4);
        const y = rng.range(topY, h);
        g.fillRect(x, y, 2, 2);
    }
    return cv;
}

/** Faixa de areia com textura pontilhada. */
export function bakeSand(w, h, rng) {
    const cv = newCanvas(w, h);
    const g = cv.getContext('2d');
    ditherGradient(g, 0, 0, w, h, ['f', 'g', 'h']);
    g.fillStyle = SVC['e'];
    for (let i = 0; i < w * h * 0.02; i++) {
        g.fillRect(rng.int(0, w - 1), rng.int(0, h - 1), 1, 1);
    }
    return cv;
}

/** Faixa de asfalto com tracejado central animável por offset externo. */
export function bakeRoad(w, h) {
    const cv = newCanvas(w, h);
    const g = cv.getContext('2d');
    g.fillStyle = SVC['n'];
    g.fillRect(0, 0, w, h);
    return cv;
}
