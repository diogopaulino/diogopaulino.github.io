/**
 * HUD, menus e overlays — tudo que é DOM.
 */

import { CHAPTERS } from './config.js?v=32';
import { formatTime } from './utils.js?v=32';

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
            stealthFill: $('stealthFill'),
            ringBadge: $('ringBadge'),
            pages: $('pagesValue'),
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
            chapterBlurb: $('chapterBlurb'),
            bestScore: $('bestScore'),
            defeatStats: $('defeatStats'),
            victoryStats: $('victoryStats'),
            travel: $('travelCard'),
            travelRoman: $('travelRoman'),
            travelTitle: $('travelTitle'),
            travelText: $('travelText'),
            startLabel: document.querySelector('#startButton span'),
            menuNotice: $('menuNotice')
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

    /** Toque: o aviso mostra um dedo em vez da tecla E (e o próprio aviso é o botão). */
    setTouch(v) {
        this.touch = Boolean(v);
    }

    setPrompt(text) {
        if (this.promptText === text) return;
        this.promptText = text;
        if (!text) {
            this.el.prompt.hidden = true;
            return;
        }
        this.el.prompt.hidden = false;
        this.el.prompt.innerHTML = `<kbd>${this.touch ? 'Toque' : 'E'}</kbd> ${text}`;
    }

    say(text, seconds = 4) {
        this.el.message.textContent = text;
        this.el.message.dataset.show = 'true';
        this.messageTimer = seconds;
    }

    setStealth(alert) {
        // chamado a cada quadro: só toca no DOM quando o valor (em centésimos) muda
        const q = Math.round(Math.min(1, alert) * 100);
        if (q === this.lastAlert) return;
        this.lastAlert = q;
        const on = alert > 0.02;
        this.el.stealth.hidden = !on;
        this.el.stealthFill.style.transform = `scaleX(${Math.min(1, alert)})`;
        this.el.stealth.dataset.danger = alert > 0.55 ? 'true' : 'false';
        this.el.vignette.style.opacity = String(Math.min(0.55, alert * 0.6));
    }

    setRing(has) {
        this.el.ringBadge.dataset.on = has ? 'true' : 'false';
    }

    setPages(n, total) {
        this.el.pages.textContent = `${n}/${total}`;
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

    /** Cartão de viagem sobre o fade (nome do capítulo que está carregando). null esconde. */
    setTravel(ch) {
        const el = this.el.travel;
        if (!el) return;
        el.hidden = !ch;
        if (ch) {
            this.el.travelRoman.textContent = ch.roman;
            this.el.travelTitle.textContent = ch.title;
            this.el.travelText.textContent = ch.loading || 'A estrada continua…';
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
        this.setMenuNotice('');
        CHAPTERS.forEach((ch, i) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'chapter-chip';
            btn.disabled = i > unlocked;
            btn.dataset.active = ch.id === currentId ? 'true' : 'false';
            btn.innerHTML = `<b>${ch.roman}</b><span>${ch.title}</span>`;
            btn.setAttribute('aria-pressed', ch.id === currentId ? 'true' : 'false');
            if (i > unlocked) btn.title = 'Conclua o capítulo anterior para abrir';
            btn.addEventListener('click', () => onPick(i));
            this.el.chapterList.appendChild(btn);
            if (ch.id === currentId && this.el.chapterBlurb) this.el.chapterBlurb.textContent = ch.blurb;
        });
    }

    /** Rótulo do botão principal do menu ("Jogar" ou "Continuar · III"). */
    setStartLabel(text) {
        if (this.el.startLabel) this.el.startLabel.textContent = text;
    }

    /** Aviso no menu (ex.: capítulo que não abriu). Some na próxima escolha. */
    setMenuNotice(text) {
        const el = this.el.menuNotice;
        if (!el) return;
        el.textContent = text || '';
        el.hidden = !text;
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
