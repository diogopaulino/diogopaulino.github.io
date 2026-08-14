/**
 * HUD, menus e overlays — tudo que é DOM.
 */

import { SPECIES, SPECIES_ORDER } from './config.js';
import { formatTime } from './utils.js';

const $ = (id) => document.getElementById(id);

export function statsBlock(rows) {
    return rows.map(([k, v]) => `<div><span>${k}</span><strong class="mono">${v}</strong></div>`).join('');
}

export class Hud {
    constructor() {
        this.el = {
            hud: $('hud'),
            journalPips: $('journalPips'),
            journalCount: $('journalCount'),
            hourFill: $('hourFill'),
            hourLabel: $('hourLabel'),
            score: $('scoreValue'),
            shots: $('shotsValue'),
            time: $('timeValue'),
            fps: $('fpsCounter'),
            message: $('message'),
            prompt: $('prompt'),
            viewfinder: $('viewfinder'),
            vfSpecies: $('vfSpecies'),
            vfHint: $('vfHint'),
            vfZoom: $('vfZoom'),
            vfRating: $('vfRating'),
            polaroid: $('polaroid'),
            polaroidSpecies: $('polaroidSpecies'),
            polaroidScore: $('polaroidScore'),
            polaroidTag: $('polaroidTag'),
            shutter: $('shutterFlash'),
            vignette: $('vignette'),
            touch: $('touchControls'),
            soundButton: $('soundButton'),
            pauseButton: $('pauseButton'),
            loading: $('loadingOverlay'),
            loadingFill: $('loadingFill'),
            loadingText: $('loadingText'),
            menu: $('menuOverlay'),
            pause: $('pauseOverlay'),
            victory: $('victoryOverlay'),
            error: $('errorOverlay'),
            errorText: $('errorText'),
            qualitySelect: $('qualitySelect'),
            volumeSlider: $('volumeSlider'),
            volumeValue: $('volumeValue'),
            bestScore: $('bestScore'),
            victoryStats: $('victoryStats')
        };
        this.messageTimer = 0;
        this.polaroidTimer = 0;
        this.buildJournal();
    }

    buildJournal() {
        this.el.journalPips.innerHTML = SPECIES_ORDER.map((id) => {
            const s = SPECIES[id];
            return `<i data-id="${id}" title="${s.label}" style="--pip:${s.color}"></i>`;
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

    showVictory(v) {
        this.el.victory.hidden = !v;
    }

    setMuted(muted) {
        this.el.soundButton.setAttribute('aria-pressed', muted ? 'false' : 'true');
        this.el.soundButton.textContent = muted ? '♭' : '♪';
    }

    setSettings({ quality, volume, best }) {
        this.el.qualitySelect.value = quality;
        this.el.volumeSlider.value = String(volume);
        this.el.volumeValue.textContent = String(volume);
        this.el.bestScore.textContent = best ? String(best) : '—';
    }

    setPhotoMode(on) {
        this.el.viewfinder.hidden = !on;
        document.body.dataset.photo = on ? 'true' : 'false';
    }

    setViewfinder({ species, hint, zoom, rating }) {
        this.el.vfSpecies.textContent = species || '—';
        this.el.vfHint.textContent = hint || 'enquadre e clique';
        this.el.vfZoom.textContent = zoom;
        this.el.vfRating.textContent = rating || 'foco';
    }

    setPlay({ score, shots, time, hour, journal, best }) {
        this.el.score.textContent = String(score);
        this.el.shots.textContent = `${shots} foto${shots === 1 ? '' : 's'}`;
        this.el.time.textContent = formatTime(time);
        this.el.hourFill.style.width = `${Math.round(hour * 100)}%`;
        this.el.hourLabel.textContent = hour < 0.35 ? 'tarde alta' : hour < 0.75 ? 'entardecer' : 'sol posto';
        this.el.journalCount.textContent = `${journal}/8`;
        this.el.journalPips.querySelectorAll('i').forEach((pip) => {
            pip.dataset.on = best[pip.dataset.id] ? 'true' : 'false';
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

    flashShutter() {
        this.el.shutter.classList.remove('is-on');
        void this.el.shutter.offsetWidth;
        this.el.shutter.classList.add('is-on');
    }

    showPolaroid({ label, score, tag }) {
        this.el.polaroidSpecies.textContent = label;
        this.el.polaroidScore.textContent = score > 0 ? `+${score}` : '—';
        this.el.polaroidTag.textContent = tag;
        this.el.polaroid.hidden = false;
        this.el.polaroid.classList.add('is-in');
        this.polaroidTimer = 3.4;
    }

    setVictory(statsHtml) {
        this.el.victoryStats.innerHTML = statsHtml;
    }

    showTouch(v) {
        this.el.touch.hidden = !v;
    }

    tick(dt) {
        if (this.messageTimer > 0) {
            this.messageTimer -= dt;
            if (this.messageTimer <= 0) this.el.message.dataset.show = 'false';
        }
        if (this.polaroidTimer > 0) {
            this.polaroidTimer -= dt;
            if (this.polaroidTimer <= 0) {
                this.el.polaroid.hidden = true;
                this.el.polaroid.classList.remove('is-in');
            }
        }
    }
}
