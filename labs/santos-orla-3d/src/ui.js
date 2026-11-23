/**
 * HUD, overlays e labels HTML dos landmarks.
 * Escreve no DOM só quando o texto/estado muda (nada de layout por quadro à toa).
 * Labels: projetadas à mão (sem Vector3 por quadro); no modo Mapa viram botões de teleporte.
 */

import { VIEW_MODES, BEACHES, LANDMARKS, DAY_STOPS, CANALS } from './config.js';
import { beachAt } from './utils.js';

const setText = (el, text) => {
    if (el && el.textContent !== text) el.textContent = text;
};

export class UI {
    constructor() {
        const $ = (id) => document.getElementById(id);
        this.els = {
            loading: $('loadingOverlay'),
            loadingText: $('loadingText'),
            loadingFill: $('loadingFill'),
            menu: $('menuOverlay'),
            hud: $('hud'),
            beachName: $('beachName'),
            beachMeta: $('beachMeta'),
            placeName: $('placeName'),
            placeBlurb: $('placeBlurb'),
            clock: $('clockValue'),
            hint: $('hintBar'),
            introBanner: $('introBanner'),
            introText: $('introText'),
            labels: $('worldLabels'),
            fps: $('fpsCounter'),
            error: $('errorOverlay'),
            errorText: $('errorText'),
            pause: $('pauseOverlay'),
            pauseProgress: $('pauseProgress'),
            dayLabel: $('dayLabel'),
            facts: $('factsStrip'),
            toast: $('toast'),
            coach: $('coach'),
            tourCount: $('tourCount'),
            menuTourCount: $('menuTourCount'),
            speed: $('speedPill'),
            startLabel: $('startLabel')
        };
        this.showLabels = true;
        this.labelNodes = [];
        this.labelState = [];
        this._place = '';
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
                <strong><i class="hotspot-check" aria-hidden="true"></i>${lm.name}</strong><span>${lm.blurb}</span>
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

    /** Marca os pontos descobertos no menu, no HUD e no pause. */
    setTour(visited) {
        const n = visited.size;
        const total = LANDMARKS.length;
        setText(this.els.tourCount, `${n}/${total}`);
        setText(this.els.menuTourCount, `${n}/${total}`);
        setText(this.els.pauseProgress, n >= total
            ? `Roteiro completo: os ${total} pontos da orla. Explore à vontade.`
            : `Roteiro: ${n} de ${total} pontos descobertos.`);
        document.querySelectorAll('#landmarkList [data-goto]').forEach((b) => {
            const done = visited.has(b.dataset.goto);
            b.classList.toggle('is-done', done);
            b.setAttribute('aria-label', `${b.querySelector('strong')?.textContent || ''}${done ? ' (descoberto)' : ''}`);
        });
        this._visited = visited;
        this.labelNodes.forEach((el) => el.classList.toggle('is-done', visited.has(el.dataset.id)));
    }

    setStartLabel(text) {
        setText(this.els.startLabel, text);
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
        document.querySelector('.game-shell')?.classList.toggle('is-playing', show);
    }

    showPause(show) {
        this.els.pause?.toggleAttribute('hidden', !show);
        if (show) document.getElementById('resumeButton')?.focus({ preventScroll: true });
    }

    showError(msg) {
        this.els.loading?.setAttribute('hidden', '');
        if (this.els.errorText) this.els.errorText.textContent = msg;
        this.els.error?.removeAttribute('hidden');
    }

    showCoach(show) {
        this.els.coach?.toggleAttribute('hidden', !show);
        if (show) document.getElementById('coachButton')?.focus({ preventScroll: true });
    }

    toast(text, ms = 3600) {
        const el = this.els.toast;
        if (!el) return;
        el.textContent = text;
        el.hidden = false;
        el.classList.remove('is-out');
        // reinicia a animação de entrada
        void el.offsetWidth;
        el.classList.add('is-in');
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => {
            el.classList.add('is-out');
            this._toastTimer = setTimeout(() => { el.hidden = true; }, 400);
        }, ms);
    }

    setMode(modeId) {
        const mode = VIEW_MODES[modeId];
        this.showLabels = !!mode?.showLabels;
        this.els.labels?.classList.toggle('is-map', modeId === 'map');
        this.els.labels?.setAttribute('aria-hidden', modeId === 'map' ? 'false' : 'true');
        this.labelNodes.forEach((el) => { el.tabIndex = modeId === 'map' ? 0 : -1; });
        document.querySelectorAll('#modeOptions .chip, #hudModeOptions .chip').forEach((c) => {
            c.setAttribute('aria-pressed', c.dataset.mode === modeId ? 'true' : 'false');
        });
    }

    setDay(stop) {
        setText(this.els.dayLabel, stop.label);
        const h = Math.floor(stop.hour);
        const m = Math.round((stop.hour - h) * 60);
        setText(this.els.clock, `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }

    /** Velocidade em km/h + andar ("Caminhando 5 km/h"). */
    setSpeed(gait, speed) {
        const kmh = Math.round(speed * 3.6);
        setText(this.els.speed, speed < 0.15 ? gait : `${gait} · ${kmh} km/h`);
    }

    updatePlace(x, nearestLandmark, nearestDist) {
        const beach = beachAt(x, BEACHES);
        let canal = null;
        let cd = Infinity;
        for (const c of CANALS) {
            const d = Math.abs(c.x - x);
            if (d < cd) { cd = d; canal = c; }
        }
        let key;
        let name;
        let blurb;
        if (nearestLandmark && nearestDist < 28) {
            key = nearestLandmark.id;
            name = nearestLandmark.name;
            blurb = nearestLandmark.blurb;
        } else if (canal && cd < 18) {
            key = `c${canal.id}`;
            name = canal.name;
            blurb = canal.avenue;
        } else {
            key = 'orla';
            name = 'Av. Bartolomeu de Gusmão';
            blurb = 'Orla contínua · José Menino → Ponta da Praia';
        }
        key += beach.id;
        if (key === this._place) return;
        this._place = key;
        setText(this.els.beachName, beach.name);
        setText(this.els.beachMeta, beach.vibe);
        setText(this.els.placeName, name);
        setText(this.els.placeBlurb, blurb);
    }

    setIntro(progress, landed) {
        const banner = this.els.introBanner;
        if (!banner) return;
        if (!landed) {
            if (banner.hidden) banner.hidden = false;
            setText(this.els.introText, progress < 0.4
                ? 'Visão aérea da orla de Santos'
                : progress < 0.75
                    ? 'Descendo até a praia…'
                    : 'Chegando ao nível do pedestre');
        } else if (!banner.hidden) {
            banner.hidden = true;
        }
    }

    /** Mostra a dica e a esmaece após alguns segundos (não fica cobrindo a cena). */
    setHint(text, ms = 7000) {
        const el = this.els.hint;
        if (!el) return;
        el.textContent = text;
        el.hidden = !text;
        el.classList.remove('is-faded');
        clearTimeout(this._hintTimer);
        if (text) this._hintTimer = setTimeout(() => el.classList.add('is-faded'), ms);
    }

    setFps(n) {
        if (this.els.fps && !this.els.fps.hidden) setText(this.els.fps, `${n} fps`);
    }

    syncLabels(camera, landmarks, show, maxDist = Infinity) {
        const host = this.els.labels;
        if (!host) return;
        if (!show) {
            if (!this._labelsHidden) {
                host.hidden = true;
                this._labelsHidden = true;
            }
            return;
        }
        if (this._labelsHidden) {
            host.hidden = false;
            this._labelsHidden = false;
        }
        if (!this.labelNodes.length) {
            host.innerHTML = landmarks.map((lm) =>
                `<button type="button" class="world-label" data-id="${lm.id}" tabindex="-1" aria-label="Ir para ${lm.name}"><b><span class="wl-full">${lm.name}</span><span class="wl-short">${lm.short || lm.name}</span></b></button>`
            ).join('');
            this.labelNodes = [...host.querySelectorAll('.world-label')];
            this.labelState = this.labelNodes.map(() => ({ x: -1, y: -1, o: -1 }));
            if (this._visited) this.setTour(this._visited);
            this.setMode(host.classList.contains('is-map') ? 'map' : 'tourist');
        }
        const w = window.innerWidth;
        const h = window.innerHeight;
        const cp = camera.position;
        // a faixa do topo é do HUD (local, seta do objetivo): rótulos não passam por baixo dele
        const topCut = this.els.labels.classList.contains('is-map') ? 40 : Math.min(h * 0.3, 230);
        for (let i = 0; i < landmarks.length; i++) {
            const lm = landmarks[i];
            const el = this.labelNodes[i];
            const st = this.labelState[i];
            let o = 0;
            let x = st.x;
            let y = st.y;
            if (Math.hypot(lm.x - cp.x, lm.z - cp.z) <= maxDist) {
                _v.set(lm.lx ?? lm.x, lm.y ?? 6, lm.lz ?? lm.z).project(camera);
                if (_v.z < 1) {
                    x = Math.round((_v.x * 0.5 + 0.5) * w);
                    y = Math.round((-_v.y * 0.5 + 0.5) * h);
                    o = x > 0 && x < w && y > topCut && y < h - 40 ? 1 : 0;
                }
            }
            if (o && (x !== st.x || y !== st.y)) {
                el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
                st.x = x;
                st.y = y;
            }
            if (o !== st.o) {
                el.style.opacity = String(o);
                el.style.visibility = o ? 'visible' : 'hidden';
                st.o = o;
            }
        }
    }
}

// Projeção mínima (evita importar three na UI só por um Vector3)
const _v = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }, project(cam) {
    const e = cam.matrixWorldInverse.elements;
    const p = cam.projectionMatrix.elements;
    const x = this.x;
    const y = this.y;
    const z = this.z;
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

export { DAY_STOPS };
