/**
 * HUD, bússola, menus e overlays — tudo que é DOM.
 */

import { LANDMARK_ORDER, LANDMARKS } from './config.js';
import { formatKm, formatClock, hourLabel } from './utils.js';

const $ = (id) => document.getElementById(id);

export function statsBlock(rows) {
    return rows.map(([k, v]) => `<div><span>${k}</span><strong class="mono">${v}</strong></div>`).join('');
}

const BIOME_LABEL = {
    prairie: 'pradaria',
    desert: 'deserto',
    mesa: 'mesa',
    canyon: 'cânion',
    pine: 'pinheiros',
    alpine: 'cume',
    riparian: 'rio'
};

export class Hud {
    constructor() {
        this.el = {
            hud: $('hud'),
            gait: $('gaitValue'),
            speed: $('speedValue'),
            region: $('regionName'),
            biome: $('biomeLabel'),
            distance: $('distanceValue'),
            hour: $('hourLabel'),
            clock: $('clockValue'),
            fps: $('fpsCounter'),
            compassRose: $('compassRose'),
            message: $('message'),
            prompt: $('prompt'),
            marks: $('markPips'),
            markCount: $('markCount'),
            cruiseHint: $('cruiseHint'),
            soundButton: $('soundButton'),
            pauseButton: $('pauseButton'),
            loading: $('loadingOverlay'),
            loadingFill: $('loadingFill'),
            loadingText: $('loadingText'),
            menu: $('menuOverlay'),
            pause: $('pauseOverlay'),
            error: $('errorOverlay'),
            errorText: $('errorText'),
            qualitySelect: $('qualitySelect'),
            volumeSlider: $('volumeSlider'),
            volumeValue: $('volumeValue'),
            bestScore: $('bestScore'),
            touch: $('touchControls')
        };
        this.messageTimer = 0;
        this.buildMarks();
    }

    buildMarks() {
        this.el.marks.innerHTML = LANDMARK_ORDER.map((id) => {
            const s = LANDMARKS[id];
            return `<i data-id="${id}" title="${s.label}"></i>`;
        }).join('');
    }

    setState(state) {
        document.body.dataset.state = state;
    }

    setLoading(progress, text) {
        if (text) this.el.loadingText.textContent = text;
        this.el.loadingFill.style.width = `${Math.round(progress * 100)}%`;
    }

    hideLoading() {
        this.el.loading.hidden = true;
    }

    showError(message) {
        if (message) this.el.errorText.textContent = message;
        this.el.error.hidden = false;
        this.el.loading.hidden = true;
    }

    showHud(v) {
        this.el.hud.hidden = !v;
    }

    showMenu(v) {
        this.el.menu.hidden = !v;
    }

    showPause(v) {
        this.el.pause.hidden = !v;
    }

    setMuted(muted) {
        this.el.soundButton.setAttribute('aria-pressed', muted ? 'false' : 'true');
        this.el.soundButton.textContent = muted ? '♭' : '♪';
    }

    setSettings({ quality, volume, best }) {
        this.el.qualitySelect.value = quality;
        this.el.volumeSlider.value = String(volume);
        this.el.volumeValue.textContent = String(volume);
        this.el.bestScore.textContent = best ? formatKm(best) : '—';
    }

    setPlay({ gait, speed, region, biome, distance, hour, yaw, cruise, marks }) {
        this.el.gait.textContent = gait;
        this.el.speed.textContent = `${Math.round(speed * 3.6)}`;
        this.el.region.textContent = region;
        this.el.biome.textContent = BIOME_LABEL[biome] || biome;
        this.el.distance.textContent = formatKm(distance);
        this.el.hour.textContent = hourLabel(hour);
        this.el.clock.textContent = formatClock(hour);
        this.el.compassRose.style.transform = `rotate(${-yaw * (180 / Math.PI)}deg)`;
        this.el.cruiseHint.textContent = cruise ? 'galope livre' : 'passo livre';
        const n = marks?.size || 0;
        this.el.markCount.textContent = `${n}/${LANDMARK_ORDER.length}`;
        this.el.marks.querySelectorAll('i').forEach((pip) => {
            pip.dataset.on = marks?.has(pip.dataset.id) ? 'true' : 'false';
        });
    }

    setFps(fps) {
        this.el.fps.textContent = `${fps} fps`;
    }

    say(text, seconds = 3.2) {
        this.el.message.textContent = text;
        this.el.message.dataset.show = 'true';
        this.messageTimer = seconds;
    }

    showTouch(v) {
        this.el.touch.hidden = !v;
    }

    tick(dt) {
        if (this.messageTimer > 0) {
            this.messageTimer -= dt;
            if (this.messageTimer <= 0) this.el.message.dataset.show = 'false';
        }
    }
}
