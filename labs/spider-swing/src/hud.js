/**
 * HUD, menus e overlays. Sem lógica 3D aqui.
 */

import { DIFFICULTY } from './config.js';
import { formatTime, formatScore } from './utils.js';

const $ = (id) => document.getElementById(id);

export class Hud {
    constructor() {
        this.el = {
            hud: $('hud'),
            speed: $('speedValue'),
            district: $('districtValue'),
            alt: $('altValue'),
            pulses: $('pulseValue'),
            combo: $('comboValue'),
            lives: $('livesValue'),
            comboFill: $('comboFill'),
            fps: $('fpsCounter'),
            message: $('message'),
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
            reticle: $('reticle')
        };
        this.msgTimer = 0;
        this.buildDifficulties('night');
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

    setReticle(on, locked) {
        this.el.reticle.hidden = !on;
        this.el.reticle.dataset.lock = String(Boolean(locked));
    }

    message(text, ms = 1600) {
        this.el.message.textContent = text;
        this.el.message.dataset.show = 'true';
        clearTimeout(this.msgTimer);
        this.msgTimer = setTimeout(() => {
            this.el.message.dataset.show = 'false';
        }, ms);
    }

    update({ speed, district, altitude, pulses, combo, lives, comboHeat }) {
        this.el.speed.textContent = String(Math.round(speed * 3.6)).padStart(3, '0');
        this.el.district.textContent = district;
        this.el.alt.textContent = `${Math.max(0, altitude | 0)} m`;
        this.el.pulses.textContent = String(pulses).padStart(2, '0');
        this.el.combo.textContent = `${Math.floor(combo)}×`;
        this.el.lives.textContent = '■'.repeat(lives) + '□'.repeat(Math.max(0, 5 - lives));
        this.el.comboFill.style.width = `${Math.round(clamp01(comboHeat) * 100)}%`;
    }

    setBest(score) {
        this.el.bestScore.textContent = score ? formatScore(score) : '—';
    }

    setOverStats({ pulses, combo, time, score, district }) {
        this.el.overStats.innerHTML = `
            <div><span>Pulsos</span><b>${pulses}</b></div>
            <div><span>Combo máx.</span><b>${combo}×</b></div>
            <div><span>Tempo</span><b>${formatTime(time)}</b></div>
            <div><span>Score</span><b>${formatScore(score)}</b></div>
            <div><span>Distrito</span><b>${district}</b></div>
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

function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
}
