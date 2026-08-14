/**
 * HUD, menus e overlays. Sem lógica 3D aqui.
 */

import { DIFFICULTY } from './config.js';
import { formatDepth, formatTime } from './utils.js';

const $ = (id) => document.getElementById(id);

export class Hud {
    constructor() {
        this.el = {
            hud: $('hud'),
            depth: $('depthValue'),
            lumens: $('lumenValue'),
            combo: $('comboValue'),
            glowFill: $('glowFill'),
            pulseFill: $('pulseFill'),
            fps: $('fpsCounter'),
            message: $('message'),
            beat: $('beatDot'),
            layer: $('layerName'),
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
            overStats: $('overStats')
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

    message(text, ms = 1600) {
        this.el.message.textContent = text;
        this.el.message.dataset.show = 'true';
        clearTimeout(this.msgTimer);
        this.msgTimer = setTimeout(() => {
            this.el.message.dataset.show = 'false';
        }, ms);
    }

    update({ depth, lumens, combo, glow, pulseReady, layer, onBeat }) {
        this.el.depth.textContent = formatDepth(depth);
        this.el.lumens.textContent = String(lumens).padStart(2, '0');
        this.el.combo.textContent = combo > 1 ? `×${combo}` : '×1';
        this.el.glowFill.style.width = `${Math.round(glow * 100)}%`;
        this.el.pulseFill.style.opacity = pulseReady ? '1' : '0.28';
        this.el.layer.textContent = layer;
        this.el.beat.dataset.on = onBeat ? 'true' : 'false';
        this.el.combo.classList.toggle('is-hot', combo >= 4);
    }

    setBest(score) {
        this.el.bestScore.textContent = score ? score.toLocaleString('pt-BR') : '—';
    }

    setOverStats({ depth, lumens, combo, time, score }) {
        this.el.overStats.innerHTML = `
            <div><span>Profundidade</span><b>${formatDepth(depth)}</b></div>
            <div><span>Lúmens</span><b>${lumens}</b></div>
            <div><span>Combo máx.</span><b>×${combo}</b></div>
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
