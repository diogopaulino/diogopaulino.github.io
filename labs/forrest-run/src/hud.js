/**
 * HUD, menus e overlays. Sem lógica 3D aqui.
 */

import { DIFFICULTY } from './config.js';
import { formatMiles, formatTime, formatDays } from './utils.js';

const $ = (id) => document.getElementById(id);

export class Hud {
    constructor() {
        this.el = {
            hud: $('hud'),
            speed: $('speedValue'),
            miles: $('milesValue'),
            feathers: $('featherValue'),
            lives: $('livesValue'),
            place: $('placeValue'),
            placeTag: $('placeTag'),
            days: $('daysValue'),
            fps: $('fpsCounter'),
            message: $('message'),
            quote: $('quote'),
            touch: $('touchControls'),
            soundButton: $('soundButton'),
            pauseButton: $('pauseButton'),
            loading: $('loadingOverlay'),
            loadingFill: $('loadingFill'),
            loadingText: $('loadingText'),
            menu: $('menuOverlay'),
            pause: $('pauseOverlay'),
            gameOver: $('gameOverOverlay'),
            error: $('errorOverlay'),
            errorText: $('errorText'),
            difficultyOptions: $('difficultyOptions'),
            difficultyBlurb: $('difficultyBlurb'),
            qualitySelect: $('qualitySelect'),
            volumeSlider: $('volumeSlider'),
            volumeValue: $('volumeValue'),
            bestScore: $('bestScore'),
            overStats: $('overStats'),
            overTitle: $('overTitle')
        };
        this.msgTimer = 0;
        this.buildDifficulties('cross');
    }

    setState(state) {
        document.body.dataset.state = state;
    }

    setLoading(p, text) {
        if (text) this.el.loadingText.textContent = text;
        this.el.loadingFill.style.width = `${Math.round(p * 100)}%`;
    }

    hideLoading() {
        this.el.loading.hidden = true;
    }

    showError(msg) {
        if (msg) this.el.errorText.textContent = msg;
        this.el.error.hidden = false;
        this.el.loading.hidden = true;
    }

    showMenu(on) {
        this.el.menu.hidden = !on;
        this.el.hud.hidden = on;
    }

    showPause(on) {
        this.el.pause.hidden = !on;
    }

    showGameOver(on) {
        this.el.gameOver.hidden = !on;
    }

    showHud(on) {
        this.el.hud.hidden = !on;
    }

    setTouchVisible(on) {
        this.el.touch.hidden = !on;
    }

    setMuted(on) {
        this.el.soundButton.setAttribute('aria-pressed', String(!on));
        this.el.soundButton.textContent = on ? '×♪' : '♪';
    }

    setFps(fps) {
        if (!this.el.fps) return;
        this.el.fps.textContent = `${fps | 0} fps`;
    }

    message(text, ms = 1800) {
        this.el.message.textContent = text;
        this.el.message.dataset.show = 'true';
        clearTimeout(this.msgTimer);
        this.msgTimer = setTimeout(() => {
            this.el.message.dataset.show = 'false';
        }, ms);
    }

    quote(text) {
        this.el.quote.textContent = text;
        this.el.quote.dataset.show = 'true';
        clearTimeout(this._q);
        this._q = setTimeout(() => {
            this.el.quote.dataset.show = 'false';
        }, 4200);
    }

    update({ speed, distance, feathers, lives, biome, time }) {
        const mph = speed * 2.23694;
        this.el.speed.textContent = String(Math.round(mph)).padStart(2, '0');
        this.el.miles.textContent = formatMiles(distance);
        this.el.feathers.textContent = String(feathers).padStart(2, '0');
        this.el.lives.textContent = '●'.repeat(lives) + '○'.repeat(Math.max(0, 5 - lives));
        this.el.place.textContent = biome.name;
        this.el.placeTag.textContent = biome.tagline;
        this.el.days.textContent = formatDays(distance);
        this._time = time;
    }

    setBest(score) {
        this.el.bestScore.textContent = score ? formatMiles(score) : '—';
    }

    setOverStats({ distance, feathers, time, score }) {
        this.el.overStats.innerHTML = `
            <div><span>Travessia</span><b>${formatMiles(distance)}</b></div>
            <div><span>Penas</span><b>${feathers}</b></div>
            <div><span>Tempo</span><b>${formatTime(time)}</b></div>
            <div><span>Score</span><b>${score.toLocaleString('pt-BR')}</b></div>
        `;
    }

    buildDifficulties(current, onPick) {
        const root = this.el.difficultyOptions;
        root.innerHTML = '';
        Object.values(DIFFICULTY).forEach((d) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'chip';
            btn.textContent = d.label;
            btn.dataset.id = d.id;
            btn.setAttribute('aria-pressed', String(d.id === current));
            btn.addEventListener('click', () => {
                root.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', 'false'));
                btn.setAttribute('aria-pressed', 'true');
                this.el.difficultyBlurb.textContent = d.blurb;
                onPick?.(d.id);
            });
            root.appendChild(btn);
        });
        this.el.difficultyBlurb.textContent = DIFFICULTY[current].blurb;
    }

    bindSettings({ quality, volume, onQuality, onVolume }) {
        this.el.qualitySelect.value = quality;
        this.el.volumeSlider.value = String(volume);
        this.el.volumeValue.textContent = String(volume);
        this.el.qualitySelect.addEventListener('change', () => onQuality(this.el.qualitySelect.value));
        this.el.volumeSlider.addEventListener('input', () => {
            const v = Number(this.el.volumeSlider.value);
            this.el.volumeValue.textContent = String(v);
            onVolume(v);
        });
    }
}
