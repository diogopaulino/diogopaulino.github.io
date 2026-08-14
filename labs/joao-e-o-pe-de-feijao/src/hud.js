/**
 * HUD, menus e overlays — tudo que é DOM.
 */

import { CHAPTERS, TREASURES } from './config.js';
import { formatTime } from './utils.js';

const $ = (id) => document.getElementById(id);

export class Hud {
    constructor() {
        this.el = {
            hud: $('hud'),
            hearts: $('hearts'),
            chapterTag: $('chapterTag'),
            objective: $('objective'),
            prompt: $('prompt'),
            message: $('message'),
            stealth: $('stealthMeter'),
            stealthLabel: $('stealthLabel'),
            stealthFill: $('stealthFill'),
            relicBadge: $('relicBadge'),
            relics: $('relicsValue'),
            time: $('timeValue'),
            fps: $('fpsCounter'),
            hitFlash: $('hitFlash'),
            vignette: $('vignette'),
            chapterCard: $('chapterCard'),
            chapterRoman: $('chapterRoman'),
            chapterTitle: $('chapterTitle'),
            chapterSub: $('chapterSub'),
            touch: $('touchControls'),
            soundButton: $('soundButton'),
            pauseButton: $('pauseButton'),

            loading: $('loadingOverlay'),
            loadingFill: $('loadingFill'),
            loadingText: $('loadingText'),
            menu: $('menuOverlay'),
            pause: $('pauseOverlay'),
            dialogue: $('dialogueOverlay'),
            dialogueSpeaker: $('dialogueSpeaker'),
            dialogueText: $('dialogueText'),
            gameOver: $('gameOverOverlay'),
            victory: $('victoryOverlay'),
            error: $('errorOverlay'),
            errorText: $('errorText'),
            qualitySelect: $('qualitySelect'),
            volumeSlider: $('volumeSlider'),
            volumeValue: $('volumeValue'),
            chapterList: $('chapterList'),
            bestScore: $('bestScore'),
            defeatStats: $('defeatStats'),
            victoryStats: $('victoryStats')
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

    setHearts(cur, max) {
        let html = '';
        for (let i = 0; i < max; i++) {
            html += `<i class="heart${i < cur ? ' is-on' : ''}"></i>`;
        }
        this.el.hearts.innerHTML = html;
    }

    setChapter(ch) {
        this.el.chapterTag.textContent = `${ch.roman} · ${ch.title}`;
        this.el.objective.textContent = ch.objective;
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

    say(text, seconds = 4) {
        this.el.message.textContent = text;
        this.el.message.dataset.show = 'true';
        this.messageTimer = seconds;
    }

    setMeter(label, value, danger = false) {
        const on = value > 0.02;
        this.el.stealth.hidden = !on;
        if (label) this.el.stealthLabel.textContent = label;
        this.el.stealthFill.style.transform = `scaleX(${Math.min(1, value)})`;
        this.el.stealth.dataset.danger = danger ? 'true' : 'false';
        this.el.vignette.style.opacity = String(danger ? Math.min(0.6, value * 0.7) : Math.min(0.28, value * 0.35));
    }

    setRelics(kind, count, total) {
        if (kind === 'beans') {
            this.el.relicBadge.textContent = 'Feijões';
            this.el.relics.textContent = `${count}/${total}`;
        } else if (kind === 'treasure') {
            this.el.relicBadge.textContent = 'Tesouros';
            const marks = TREASURES.map((t, i) => (i < count ? t.icon : '·')).join(' ');
            this.el.relics.textContent = marks || `${count}/${total}`;
        } else {
            this.el.relicBadge.textContent = 'História';
            this.el.relics.textContent = `${count}/${total}`;
        }
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

    flashHit() {
        this.el.hitFlash.classList.remove('is-on');
        void this.el.hitFlash.offsetWidth;
        this.el.hitFlash.classList.add('is-on');
    }

    showChapterCard(ch) {
        this.el.chapterRoman.textContent = ch.roman;
        this.el.chapterTitle.textContent = ch.title;
        this.el.chapterSub.textContent = ch.subtitle;
        this.el.chapterCard.hidden = false;
        this.el.chapterCard.classList.add('is-on');
        this.cardTimer = 3.6;
    }

    tick(dt) {
        if (this.messageTimer > 0) {
            this.messageTimer -= dt;
            if (this.messageTimer <= 0) this.el.message.dataset.show = 'false';
        }
        if (this.cardTimer > 0) {
            this.cardTimer -= dt;
            if (this.cardTimer <= 0) {
                this.el.chapterCard.classList.remove('is-on');
                this.el.chapterCard.hidden = true;
            }
        }
    }

    showMenu(show) {
        this.el.menu.hidden = !show;
    }

    showPause(show) {
        this.el.pause.hidden = !show;
    }

    showDialogue(speaker, text) {
        this.el.dialogue.hidden = false;
        this.el.dialogueSpeaker.textContent = speaker;
        this.el.dialogueText.textContent = text;
    }

    hideDialogue() {
        this.el.dialogue.hidden = true;
    }

    showDefeat(statsHtml) {
        this.el.defeatStats.innerHTML = statsHtml;
        this.el.gameOver.hidden = false;
    }

    hideDefeat() {
        this.el.gameOver.hidden = true;
    }

    showVictory(statsHtml) {
        this.el.victoryStats.innerHTML = statsHtml;
        this.el.victory.hidden = false;
    }

    hideVictory() {
        this.el.victory.hidden = true;
    }

    fillChapters(unlocked, currentId, onPick) {
        this.el.chapterList.innerHTML = '';
        CHAPTERS.forEach((ch, i) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'chapter-chip';
            btn.disabled = i > unlocked;
            btn.dataset.active = ch.id === currentId ? 'true' : 'false';
            btn.innerHTML = `<b>${ch.roman}</b><span>${ch.title}</span>`;
            btn.addEventListener('click', () => onPick(i));
            this.el.chapterList.appendChild(btn);
        });
    }

    setBest(n) {
        this.el.bestScore.textContent = n ? String(n) : '—';
    }

    setVolumeLabel(v) {
        this.el.volumeValue.textContent = String(Math.round(v));
    }
}

export function statsBlock(rows) {
    return rows.map(([k, v]) => `<div><span>${k}</span><strong>${v}</strong></div>`).join('');
}
