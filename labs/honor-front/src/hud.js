/**
 * HUD, menus e overlays — tudo que é DOM.
 */

import { DIFFICULTY, OBJECTIVES } from './config.js';
import { formatTime, pad2 } from './utils.js';

const $ = (id) => document.getElementById(id);

export class Hud {
    constructor() {
        this.el = {
            hud: $('hud'),
            missionTag: $('missionTag'),
            objective: $('objective'),
            prompt: $('prompt'),
            message: $('message'),
            kills: $('killsValue'),
            time: $('timeValue'),
            fps: $('fpsCounter'),
            healthFill: $('healthFill'),
            healthValue: $('healthValue'),
            weaponName: $('weaponName'),
            mag: $('magValue'),
            reserve: $('reserveValue'),
            grenades: $('grenadeValue'),
            heading: $('headingValue'),
            compassRose: $('compassRose'),
            hitFlash: $('hitFlash'),
            hitMarker: $('hitMarker'),
            vignette: $('vignette'),
            fade: $('fade'),
            crosshair: $('crosshair'),
            radioCard: $('radioCard'),
            radioText: $('radioText'),
            objectiveCard: $('objectiveCard'),
            objRoman: $('objRoman'),
            objTitle: $('objTitle'),
            touch: $('touchControls'),
            moveStick: $('moveStick'),
            moveKnob: $('moveKnob'),
            lookZone: $('lookZone'),
            btnFire: $('btnFire'),
            btnSprint: $('btnSprint'),
            btnReload: $('btnReload'),
            btnGrenade: $('btnGrenade'),
            btnInteract: $('btnInteract'),
            soundButton: $('soundButton'),
            pauseButton: $('pauseButton'),
            loading: $('loadingOverlay'),
            loadingFill: $('loadingFill'),
            loadingText: $('loadingText'),
            menu: $('menuOverlay'),
            pause: $('pauseOverlay'),
            gameOver: $('gameOverOverlay'),
            victory: $('victoryOverlay'),
            error: $('errorOverlay'),
            errorText: $('errorText'),
            qualitySelect: $('qualitySelect'),
            volumeSlider: $('volumeSlider'),
            volumeValue: $('volumeValue'),
            difficultyOptions: $('difficultyOptions'),
            difficultyBlurb: $('difficultyBlurb'),
            bestScore: $('bestScore'),
            defeatStats: $('defeatStats'),
            defeatReason: $('defeatReason'),
            victoryStats: $('victoryStats'),
            startButton: $('startButton'),
            resumeButton: $('resumeButton'),
            pauseMenuButton: $('pauseMenuButton'),
            retryButton: $('retryButton'),
            defeatMenuButton: $('defeatMenuButton'),
            replayButton: $('replayButton'),
            victoryMenuButton: $('victoryMenuButton')
        };
        this.messageTimer = 0;
        this.cardTimer = 0;
        this.radioTimer = 0;
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
        this.el.crosshair.hidden = !v;
    }

    setTouchVisible(v) {
        this.el.touch.hidden = !v;
    }

    setObjective(obj) {
        this.el.missionTag.textContent = obj.tag;
        this.el.objective.textContent = obj.text;
    }

    showObjectiveCard(obj) {
        this.el.objRoman.textContent = obj.roman;
        this.el.objTitle.textContent = obj.title;
        this.el.objectiveCard.hidden = false;
        this.el.objectiveCard.classList.add('is-on');
        this.cardTimer = 3.4;
    }

    radio(text, seconds = 6.5) {
        this.el.radioText.textContent = text;
        this.el.radioCard.hidden = false;
        this.radioTimer = seconds;
    }

    setPrompt(text) {
        if (!text) {
            this.el.prompt.hidden = true;
            return;
        }
        this.el.prompt.hidden = false;
        this.el.prompt.innerHTML = `<kbd>E</kbd> ${text}`;
    }

    say(text, seconds = 3.4) {
        this.el.message.textContent = text;
        this.el.message.dataset.show = 'true';
        this.messageTimer = seconds;
    }

    setHealth(cur, max) {
        const t = Math.max(0, cur / max);
        this.el.healthFill.style.transform = `scaleX(${t})`;
        this.el.healthValue.textContent = String(Math.round(cur));
        this.el.vignette.style.opacity = String(0.45 + (1 - t) * 0.4);
    }

    setWeapon(name, mag, reserve, grenades) {
        this.el.weaponName.textContent = name;
        this.el.mag.textContent = pad2(mag);
        this.el.reserve.textContent = String(reserve);
        this.el.grenades.textContent = String(grenades);
    }

    setKills(n) {
        this.el.kills.textContent = pad2(n);
    }

    setTime(s) {
        this.el.time.textContent = formatTime(s);
    }

    setHeading(deg) {
        this.el.heading.textContent = `${String(Math.round(deg)).padStart(3, '0')}°`;
        this.el.compassRose.style.transform = `translateX(${-((deg % 360) / 360) * 40}px)`;
    }

    setFps(n) {
        this.el.fps.textContent = `${n} fps`;
    }

    setMuted(m) {
        this.el.soundButton.setAttribute('aria-pressed', m ? 'false' : 'true');
        this.el.soundButton.textContent = m ? '♪̸' : '♪';
    }

    setFade(v) {
        this.el.fade.style.opacity = String(v);
    }

    flashHit() {
        this.el.hitFlash.classList.remove('is-on');
        void this.el.hitFlash.offsetWidth;
        this.el.hitFlash.classList.add('is-on');
    }

    markHit() {
        this.el.hitMarker.classList.remove('is-on');
        void this.el.hitMarker.offsetWidth;
        this.el.hitMarker.classList.add('is-on');
    }

    tick(dt) {
        if (this.messageTimer > 0) {
            this.messageTimer -= dt;
            if (this.messageTimer <= 0) this.el.message.dataset.show = 'false';
        }
        if (this.cardTimer > 0) {
            this.cardTimer -= dt;
            if (this.cardTimer <= 0) {
                this.el.objectiveCard.classList.remove('is-on');
                this.el.objectiveCard.hidden = true;
            }
        }
        if (this.radioTimer > 0) {
            this.radioTimer -= dt;
            if (this.radioTimer <= 0) this.el.radioCard.hidden = true;
        }
    }

    showMenu(show) {
        this.el.menu.hidden = !show;
    }

    showPause(show) {
        this.el.pause.hidden = !show;
    }

    showDefeat(reason, statsHtml) {
        this.el.defeatReason.textContent = reason;
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

    fillDifficulty(current, onPick) {
        this.el.difficultyOptions.innerHTML = '';
        Object.values(DIFFICULTY).forEach((d) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'chip';
            btn.dataset.active = d.id === current ? 'true' : 'false';
            btn.textContent = d.label;
            btn.addEventListener('click', () => onPick(d.id));
            this.el.difficultyOptions.appendChild(btn);
        });
        this.el.difficultyBlurb.textContent = DIFFICULTY[current].blurb;
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

export { OBJECTIVES };
