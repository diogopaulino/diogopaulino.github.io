/**
 * HUD, overlays e labels HTML dos landmarks.
 */

import { VIEW_MODES, BEACHES, LANDMARKS, DAY_STOPS, CANALS } from './config.js';
import { beachAt, formatClock } from './utils.js';

export class UI {
    constructor() {
        this.els = {
            loading: document.getElementById('loadingOverlay'),
            loadingText: document.getElementById('loadingText'),
            loadingFill: document.getElementById('loadingFill'),
            menu: document.getElementById('menuOverlay'),
            hud: document.getElementById('hud'),
            beachName: document.getElementById('beachName'),
            beachMeta: document.getElementById('beachMeta'),
            placeName: document.getElementById('placeName'),
            placeBlurb: document.getElementById('placeBlurb'),
            clock: document.getElementById('clockValue'),
            modeLabel: document.getElementById('modeLabel'),
            hint: document.getElementById('hintBar'),
            introBanner: document.getElementById('introBanner'),
            labels: document.getElementById('worldLabels'),
            fps: document.getElementById('fpsCounter'),
            error: document.getElementById('errorOverlay'),
            errorText: document.getElementById('errorText'),
            pause: document.getElementById('pauseOverlay'),
            dayLabel: document.getElementById('dayLabel'),
            facts: document.getElementById('factsStrip')
        };
        this.showLabels = true;
        this.labelNodes = [];
        this._buildModeChips();
        this._buildLandmarkList();
        this._buildFacts();
    }

    _buildModeChips() {
        const row = document.getElementById('modeOptions');
        if (!row) return;
        row.innerHTML = '';
        for (const mode of Object.values(VIEW_MODES)) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'chip';
            btn.dataset.mode = mode.id;
            btn.textContent = mode.label;
            btn.title = mode.hint;
            row.appendChild(btn);
        }
    }

    _buildLandmarkList() {
        const list = document.getElementById('landmarkList');
        if (!list) return;
        list.innerHTML = LANDMARKS.map(
            (lm) => `<button type="button" class="hotspot-btn" data-goto="${lm.id}">
                <strong>${lm.name}</strong><span>${lm.blurb}</span>
            </button>`
        ).join('');
    }

    _buildFacts() {
        if (!this.els.facts) return;
        this.els.facts.innerHTML = `
            <span>~7 km de praia</span>
            <span>5.335 m de jardins</span>
            <span>218.800 m² de área verde</span>
            <span>Ciclovia 7,9 km</span>
            <span>Canais 1–7</span>
        `;
    }

    setLoading(p, text) {
        if (this.els.loadingFill) this.els.loadingFill.style.width = `${Math.round(p * 100)}%`;
        if (this.els.loadingText && text) this.els.loadingText.textContent = text;
    }

    hideLoading() {
        this.els.loading?.setAttribute('hidden', '');
    }

    showMenu(show) {
        this.els.menu?.toggleAttribute('hidden', !show);
    }

    showHud(show) {
        this.els.hud?.toggleAttribute('hidden', !show);
    }

    showPause(show) {
        this.els.pause?.toggleAttribute('hidden', !show);
    }

    showError(msg) {
        if (this.els.errorText) this.els.errorText.textContent = msg;
        this.els.error?.removeAttribute('hidden');
    }

    setMode(modeId) {
        const mode = VIEW_MODES[modeId];
        if (this.els.modeLabel) this.els.modeLabel.textContent = mode?.label || modeId;
        this.showLabels = !!mode?.showLabels;
        document.querySelectorAll('#modeOptions .chip').forEach((c) => {
            c.setAttribute('aria-pressed', c.dataset.mode === modeId ? 'true' : 'false');
        });
        document.querySelectorAll('#hudModeOptions .chip').forEach((c) => {
            c.setAttribute('aria-pressed', c.dataset.mode === modeId ? 'true' : 'false');
        });
    }

    setDay(stop) {
        if (this.els.dayLabel) this.els.dayLabel.textContent = stop.label;
        if (this.els.clock) this.els.clock.textContent = formatClock();
    }

    updatePlace(x, nearestLandmark) {
        const beach = beachAt(x, BEACHES);
        if (this.els.beachName) this.els.beachName.textContent = beach.name;
        if (this.els.beachMeta) this.els.beachMeta.textContent = beach.vibe;

        const canal = CANALS.reduce((best, c) => {
            const d = Math.abs(c.x - x);
            return d < best.d ? { c, d } : best;
        }, { c: null, d: Infinity });

        if (nearestLandmark && nearestLandmark.dist < 28) {
            if (this.els.placeName) this.els.placeName.textContent = nearestLandmark.name;
            if (this.els.placeBlurb) this.els.placeBlurb.textContent = nearestLandmark.blurb;
        } else if (canal.c && canal.d < 18) {
            if (this.els.placeName) this.els.placeName.textContent = canal.c.name;
            if (this.els.placeBlurb) this.els.placeBlurb.textContent = canal.c.avenue;
        } else {
            if (this.els.placeName) this.els.placeName.textContent = 'Av. Bartolomeu de Gusmão';
            if (this.els.placeBlurb) this.els.placeBlurb.textContent = 'Orla contínua · José Menino → Ponta da Praia';
        }
    }

    setIntro(progress, landed) {
        if (!this.els.introBanner) return;
        if (!landed) {
            this.els.introBanner.hidden = false;
            this.els.introBanner.textContent = progress < 0.4
                ? 'Visão aérea da orla de Santos'
                : progress < 0.75
                    ? 'Descendo até a praia…'
                    : 'Chegando ao nível do pedestre';
        } else {
            this.els.introBanner.hidden = true;
        }
    }

    setHint(text) {
        if (this.els.hint) {
            this.els.hint.textContent = text;
            this.els.hint.hidden = !text;
        }
    }

    setFps(n) {
        if (this.els.fps) this.els.fps.textContent = `${n} fps`;
    }

    syncLabels(camera, landmarks, show) {
        const host = this.els.labels;
        if (!host) return;
        if (!show) {
            host.innerHTML = '';
            return;
        }
        if (!this.labelNodes.length) {
            host.innerHTML = landmarks.map((lm) =>
                `<div class="world-label" data-id="${lm.id}"><b>${lm.name}</b></div>`
            ).join('');
            this.labelNodes = [...host.querySelectorAll('.world-label')];
        }
        const w = window.innerWidth;
        const h = window.innerHeight;
        const v = new THREE_VEC();
        for (const lm of landmarks) {
            const el = host.querySelector(`[data-id="${lm.id}"]`);
            if (!el) continue;
            v.set(lm.x, 3.5, lm.z);
            v.project(camera);
            if (v.z > 1) {
                el.style.opacity = '0';
                continue;
            }
            const x = (v.x * 0.5 + 0.5) * w;
            const y = (-v.y * 0.5 + 0.5) * h;
            el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
            el.style.opacity = v.z < 1 && x > 0 && x < w && y > 40 && y < h - 40 ? '1' : '0';
        }
    }
}

// Avoid importing three in UI just for Vector3 — tiny helper
const _v = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }, project(cam) {
    const e = cam.matrixWorldInverse.elements;
    const p = cam.projectionMatrix.elements;
    let x = this.x, y = this.y, z = this.z;
    const x1 = e[0] * x + e[4] * y + e[8] * z + e[12];
    const y1 = e[1] * x + e[5] * y + e[9] * z + e[13];
    const z1 = e[2] * x + e[6] * y + e[10] * z + e[14];
    const w1 = e[3] * x + e[7] * y + e[11] * z + e[15];
    const x2 = p[0] * x1 + p[4] * y1 + p[8] * z1 + p[12] * w1;
    const y2 = p[1] * x1 + p[5] * y1 + p[9] * z1 + p[13] * w1;
    const z2 = p[2] * x1 + p[6] * y1 + p[10] * z1 + p[14] * w1;
    const w2 = p[3] * x1 + p[7] * y1 + p[11] * z1 + p[15] * w1;
    this.x = x2 / w2;
    this.y = y2 / w2;
    this.z = z2 / w2;
    return this;
} };
function THREE_VEC() { return _v; }

export { DAY_STOPS };
