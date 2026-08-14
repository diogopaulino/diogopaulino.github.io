/**
 * HUD, menus e overlays — tudo que é DOM.
 */

import { MEMORIES } from './config.js';
import { formatTime } from './utils.js';

const $ = (id) => document.getElementById(id);

export class Hud {
    constructor() {
        this.el = {
            hud: $('hud'),
            objective: $('objective'),
            prompt: $('prompt'),
            message: $('message'),
            memories: $('memoriesValue'),
            time: $('timeValue'),
            fps: $('fpsCounter'),
            memoryCard: $('memoryCard'),
            memoryTitle: $('memoryTitle'),
            memoryLine: $('memoryLine'),
            touch: $('touchControls'),
            soundButton: $('soundButton'),
            pauseButton: $('pauseButton'),
            loading: $('loadingOverlay'),
            loadingFill: $('loadingFill'),
            loadingText: $('loadingText'),
            menu: $('menuOverlay'),
            pause: $('pauseOverlay'),
            rest: $('restOverlay'),
            restStats: $('restStats'),
            error: $('errorOverlay'),
            errorText: $('errorText'),
            qualitySelect: $('qualitySelect'),
            volumeSlider: $('volumeSlider'),
            volumeValue: $('volumeValue'),
            fade: $('fade')
        };
        this.messageTimer = 0;
        this.cardTimer = 0;
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

    setTouchVisible(v) {
        this.el.touch.hidden = !v;
    }

    setObjective(text) {
        this.el.objective.textContent = text;
    }

    setPrompt(text) {
        if (!text) {
            this.el.prompt.hidden = true;
            return;
        }
        this.el.prompt.hidden = false;
        this.el.prompt.innerHTML = `<kbd>E</kbd> ${text}`;
    }

    say(text, seconds = 5) {
        this.el.message.textContent = text;
        this.el.message.dataset.show = 'true';
        this.messageTimer = seconds;
    }

    setMemories(n) {
        this.el.memories.textContent = `${n}/${MEMORIES.length}`;
    }

    setTime(s) {
        this.el.time.textContent = formatTime(s);
    }

    setFps(n) {
        this.el.fps.textContent = `${n} fps`;
    }

    setMuted(m) {
        this.el.soundButton.setAttribute('aria-pressed', m ? 'false' : 'true');
        this.el.soundButton.textContent = m ? '♪̸' : '♪';
    }

    showMemory(mem) {
        this.el.memoryTitle.textContent = mem.title;
        this.el.memoryLine.textContent = mem.line;
        this.el.memoryCard.hidden = false;
        this.el.memoryCard.classList.add('is-on');
        this.cardTimer = 5.2;
    }

    setFade(v) {
        this.el.fade.style.opacity = String(v);
    }

    tick(dt) {
        if (this.messageTimer > 0) {
            this.messageTimer -= dt;
            if (this.messageTimer <= 0) this.el.message.dataset.show = 'false';
        }
        if (this.cardTimer > 0) {
            this.cardTimer -= dt;
            if (this.cardTimer <= 0) {
                this.el.memoryCard.classList.remove('is-on');
                this.el.memoryCard.hidden = true;
            }
        }
    }

    showMenu(show) {
        this.el.menu.hidden = !show;
    }

    showPause(show) {
        this.el.pause.hidden = !show;
    }

    showRest(statsHtml) {
        this.el.restStats.innerHTML = statsHtml;
        this.el.rest.hidden = false;
    }

    hideRest() {
        this.el.rest.hidden = true;
    }

    setVolumeLabel(v) {
        this.el.volumeValue.textContent = String(Math.round(v));
    }
}

export function statsBlock(rows) {
    return rows.map(([k, v]) => `<div><span>${k}</span><strong>${v}</strong></div>`).join('');
}
