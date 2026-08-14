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
            depth: $('depthValue'),
            zone: $('zoneValue'),
            progress: $('progressFill'),
            boost: $('boostFill'),
            speed: $('speedValue'),
            pearls: $('pearlValue'),
            combo: $('comboValue'),
            lives: $('livesValue'),
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
            overEyebrow: $('overEyebrow'),
            overTitle: $('overTitle'),
            error: $('errorOverlay'),
            errorText: $('errorText'),
            difficultyOptions: $('difficultyOptions'),
            difficultyBlurb: $('difficultyBlurb'),
            qualitySelect: $('qualitySelect'),
            volumeSlider: $('volumeSlider'),
            volumeValue: $('volumeValue'),
            bestScore: $('bestScore'),
            overStats: $('overStats'),
            lookZone: $('lookZone'),
            touchBoost: $('touchBoost'),
            touchRoll: $('touchRoll'),
            startButton: $('startButton'),
            resumeButton: $('resumeButton'),
            pauseMenuButton: $('pauseMenuButton'),
            retryButton: $('retryButton'),
            overMenuButton: $('overMenuButton')
        };
        this.msgTimer = 0;
        this.buildDifficulties('tide');
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

    showGameOver(on, won = false) {
        this.el.gameOver.hidden = !on;
        if (on) {
            this.el.overEyebrow.classList.toggle('eyebrow--danger', !won);
            this.el.overEyebrow.innerHTML = won ? '<i></i> NÁUTILO' : '<i></i> ABISMO';
            this.el.overTitle.innerHTML = won
                ? 'O templo<br>abriu.'
                : 'A corrente<br>te soltou.';
        }
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

    message(text, ms = 1600) {
        this.el.message.textContent = text;
        this.el.message.dataset.show = 'true';
        clearTimeout(this.msgTimer);
        this.msgTimer = setTimeout(() => {
            this.el.message.dataset.show = 'false';
        }, ms);
    }

    update({ depth, zone, progress, boost, speed, pearls, combo, lives }) {
        this.el.depth.textContent = `${String(Math.max(0, depth | 0)).padStart(3, '0')} m`;
        this.el.zone.textContent = zone;
        this.el.progress.style.width = `${Math.round(clamp01(progress) * 100)}%`;
        this.el.boost.style.width = `${Math.round(clamp01(boost) * 100)}%`;
        this.el.speed.textContent = `${String(Math.round(speed * 1.94)).padStart(2, '0')} nós`;
        this.el.pearls.textContent = String(pearls).padStart(2, '0');
        this.el.combo.textContent = `${Math.floor(combo)}×`;
        this.el.lives.textContent = '■'.repeat(lives) + '□'.repeat(Math.max(0, 5 - lives));
    }

    setBest(score) {
        this.el.bestScore.textContent = score ? formatScore(score) : '—';
    }

    setOverStats({ pearls, combo, rings, time, score }) {
        this.el.overStats.innerHTML = `
            <div><span>Pérolas</span><b>${pearls}</b></div>
            <div><span>Anéis</span><b>${rings}</b></div>
            <div><span>Combo máx.</span><b>${combo}×</b></div>
            <div><span>Tempo</span><b>${formatTime(time)}</b></div>
            <div><span>Canto</span><b>${formatScore(score)}</b></div>
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
