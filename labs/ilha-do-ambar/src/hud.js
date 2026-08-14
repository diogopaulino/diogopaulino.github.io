/**
 * HUD, menus e overlays — tudo que é DOM.
 */

import { SPECIES, RADIO } from './config.js';
import { formatTime } from './utils.js';

const $ = (id) => document.getElementById(id);

export class Hud {
    constructor() {
        this.el = {
            hud: $('hud'),
            speed: $('speedValue'),
            time: $('timeValue'),
            fps: $('fpsCounter'),
            catalog: $('catalog'),
            radio: $('radioText'),
            dossier: $('dossier'),
            dossierName: $('dossierName'),
            dossierLatin: $('dossierLatin'),
            dossierNote: $('dossierNote'),
            prompt: $('prompt'),
            binoculars: $('binoculars'),
            shake: $('shake'),
            touch: $('touchControls'),
            soundButton: $('soundButton'),
            pauseButton: $('pauseButton'),
            loading: $('loadingOverlay'),
            loadingFill: $('loadingFill'),
            loadingText: $('loadingText'),
            menu: $('menuOverlay'),
            pause: $('pauseOverlay'),
            caught: $('caughtOverlay'),
            victory: $('victoryOverlay'),
            error: $('errorOverlay'),
            errorText: $('errorText'),
            qualitySelect: $('qualitySelect'),
            volumeSlider: $('volumeSlider'),
            volumeValue: $('volumeValue'),
            victoryStats: $('victoryStats'),
            caughtStats: $('caughtStats'),
            todLabel: $('todLabel'),
            rainLabel: $('rainLabel')
        };
        this.radioTimer = 0;
        this._fillCatalog();
    }

    _fillCatalog() {
        this.el.catalog.innerHTML = SPECIES.map((s) =>
            `<button type="button" class="species" data-id="${s.id}" data-logged="false" title="${s.common}">
                <i></i><span>${s.common}</span>
            </button>`
        ).join('');
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

    showCaught(stats) {
        this.el.caught.hidden = false;
        this.el.caughtStats.innerHTML = stats;
    }

    hideCaught() {
        this.el.caught.hidden = true;
    }

    showVictory(stats) {
        this.el.victory.hidden = false;
        this.el.victoryStats.innerHTML = stats;
    }

    hideVictory() {
        this.el.victory.hidden = true;
    }

    setMuted(muted) {
        this.el.soundButton.setAttribute('aria-pressed', muted ? 'false' : 'true');
        this.el.soundButton.textContent = muted ? '♪̸' : '♪';
    }

    setVolumeLabel(v) {
        this.el.volumeValue.textContent = String(v);
    }

    setSpeed(kmh, onRoad) {
        this.el.speed.textContent = `${Math.round(kmh)}`;
        this.el.speed.dataset.road = onRoad ? 'on' : 'off';
    }

    setTime(s) {
        this.el.time.textContent = formatTime(s);
    }

    setFps(n) {
        this.el.fps.textContent = `${n} fps`;
    }

    setLogged(id) {
        const btn = this.el.catalog.querySelector(`[data-id="${id}"]`);
        if (btn) btn.dataset.logged = 'true';
    }

    setRadio(text) {
        this.el.radio.textContent = text;
        this.el.radio.dataset.show = 'true';
        this.radioTimer = 6.5;
    }

    tickRadio(dt) {
        this.radioTimer -= dt;
        if (this.radioTimer <= 0) this.el.radio.dataset.show = 'false';
    }

    setDossier(spec, visible) {
        this.el.dossier.hidden = !visible;
        this.el.binoculars.hidden = !visible;
        if (!spec) return;
        this.el.dossierName.textContent = spec.common;
        this.el.dossierLatin.textContent = spec.name;
        this.el.dossierNote.textContent = spec.note;
    }

    setPrompt(text) {
        this.el.prompt.hidden = !text;
        if (text) this.el.prompt.textContent = text;
    }

    setShake(on) {
        this.el.shake.classList.toggle('on', on);
    }

    setTod(label) {
        if (this.el.todLabel) this.el.todLabel.textContent = label;
    }

    setRain(on) {
        if (this.el.rainLabel) this.el.rainLabel.textContent = on ? 'Chuva' : 'Limpo';
    }

    showTouch(v) {
        this.el.touch.hidden = !v;
    }

    randomRadio() {
        this.setRadio(RADIO[Math.floor(Math.random() * RADIO.length)]);
    }
}
