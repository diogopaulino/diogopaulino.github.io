/**
 * Camada de interface: tudo que é DOM (HUD, menus, overlays) vive aqui,
 * separado da lógica 3D.
 */

import { formatTime } from './utils.js?v=60';
import { BOAT, DIFFICULTY } from './config.js?v=60';

const $ = (id) => document.getElementById(id);

export class Hud {
    constructor() {
        this.el = {
            hud: $('hud'),
            hullPips: $('hullPips'),
            hullPanel: document.querySelector('.hull-panel'),
            furyFill: $('furyFill'),
            distance: $('distanceValue'),
            progressFill: $('progressFill'),
            progressBoat: $('progressBoat'),
            score: $('scoreValue'),
            combo: $('comboBadge'),
            time: $('timeValue'),
            bossPanel: $('bossPanel'),
            bossFill: $('bossFill'),
            message: $('message'),
            hitFlash: $('hitFlash'),
            fps: $('fpsCounter'),
            touch: $('touchControls'),
            steerZone: $('steerZone'),
            soundButton: $('soundButton'),
            pauseButton: $('pauseButton'),
            reticle: $('reticle'),
            reticleLabel: $('reticleLabel'),
            throwFill: $('throwFill'),
            hintBar: $('hintBar'),
            navPanel: $('navPanel'),
            telegraph: Array.from(document.querySelectorAll('.telegraph [data-gear]')),
            speedValue: $('speedValue'),
            staminaFill: $('staminaFill'),
            rudderNeedle: $('rudderNeedle'),
            gearTouchLabel: $('gearTouchLabel'),
            speedTouch: $('speedTouch'),
            staminaTouch: $('staminaTouch'),

            loading: $('loadingOverlay'),
            loadingFill: $('loadingFill'),
            loadingText: $('loadingText'),
            menu: $('menuOverlay'),
            pause: $('pauseOverlay'),
            gameOver: $('gameOverOverlay'),
            victory: $('victoryOverlay'),
            error: $('errorOverlay'),
            errorText: $('errorText'),

            difficultyOptions: $('difficultyOptions'),
            difficultyBlurb: $('difficultyBlurb'),
            qualitySelect: $('qualitySelect'),
            volumeSlider: $('volumeSlider'),
            volumeValue: $('volumeValue'),
            bestScore: $('bestScore'),
            defeatStats: $('defeatStats'),
            victoryStats: $('victoryStats')
        };

        this.pipCount = 0;
        this.messageTimer = null;
        this.flashTimer = null;
        this.lastScore = -1;
    }

    /* ------------------------------ estado ------------------------------ */

    setState(state) {
        document.body.dataset.state = state;
    }

    showHud(visible) {
        this.el.hud.hidden = !visible;
    }

    setTouchVisible(visible) {
        this.el.touch.hidden = !visible;
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

    /* ------------------------------ HUD --------------------------------- */

    buildPips(max) {
        if (this.pipCount === max) return;
        this.pipCount = max;
        this.el.hullPips.innerHTML = '';
        for (let i = 0; i < max; i++) {
            const pip = document.createElement('span');
            pip.className = 'pip';
            this.el.hullPips.appendChild(pip);
        }
    }

    setHull(value, max) {
        this.buildPips(max);
        const pips = this.el.hullPips.children;
        for (let i = 0; i < pips.length; i++) {
            pips[i].dataset.empty = String(i >= value);
        }
    }

    setFury(ratio, active) {
        this.el.furyFill.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
        this.el.hullPanel.dataset.fury = String(Boolean(active));
    }

    setProgress(ratio, metersLeft) {
        const pct = Math.max(0, Math.min(1, ratio)) * 100;
        this.el.progressFill.style.width = `${pct}%`;
        this.el.progressBoat.style.left = `${pct}%`;
        this.el.distance.textContent = `${Math.max(0, Math.round(metersLeft))} m`;
    }

    setScore(score) {
        const rounded = Math.round(score);
        if (rounded === this.lastScore) return;
        this.lastScore = rounded;
        this.el.score.textContent = rounded.toLocaleString('pt-BR');
    }

    setCombo(multiplier) {
        const active = multiplier > 1.01;
        this.el.combo.textContent = `x${multiplier.toFixed(1)}`;
        this.el.combo.dataset.active = String(active);
    }

    setTime(seconds) {
        this.el.time.textContent = formatTime(seconds);
    }

    setFps(fps) {
        this.el.fps.textContent = `${Math.round(fps)} fps`;
    }

    showBoss(show) {
        this.el.bossPanel.hidden = !show;
    }

    setBossHealth(ratio) {
        this.el.bossFill.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
    }

    message(text, tone = 'default', duration = 2600) {
        const el = this.el.message;
        el.textContent = text;
        el.dataset.tone = tone;
        el.dataset.show = 'true';
        clearTimeout(this.messageTimer);
        if (duration > 0) {
            this.messageTimer = setTimeout(() => {
                el.dataset.show = 'false';
            }, duration);
        }
    }

    clearMessage() {
        clearTimeout(this.messageTimer);
        this.el.message.dataset.show = 'false';
    }

    flash(tone = 'danger') {
        const el = this.el.hitFlash;
        el.dataset.tone = tone;
        el.dataset.show = 'true';
        clearTimeout(this.flashTimer);
        this.flashTimer = setTimeout(() => {
            el.dataset.show = 'false';
        }, 90);
    }

    /** Mira: trava visual quando há torre/inimigo no cone. xPct/yPct em 0–100. */
    setAim(lock, xPct = 50, yPct = 46) {
        if (this.el.hud) {
            this.el.hud.style.setProperty('--aim-x', `${xPct}%`);
            this.el.hud.style.setProperty('--aim-y', `${yPct}%`);
        }
        if (!this.el.reticle) return;
        const locked = Boolean(lock);
        this.el.reticle.dataset.lock = String(locked);
        if (!this.el.reticleLabel) return;
        if (!locked) {
            this.el.reticleLabel.textContent = '';
            return;
        }
        const labels = { towers: 'Torre', enemyShips: 'Navio', barricades: 'Barricada', boss: 'Barcaça' };
        this.el.reticleLabel.textContent = labels[lock.kind] || 'Alvo';
    }

    /** Dica da largada; o texto muda com o canhão automático e com o toque. */
    setHint(visible, autoFire = false, touch = false) {
        if (!this.el.hintBar) return;
        if (visible) {
            const steer = touch ? 'Arraste à esquerda para o leme, ▲▼ para os remos' : 'Leme com ← →, remos com W/S';
            this.el.hintBar.textContent = autoFire
                ? `${steer}. O canhão atira sozinho!`
                : `${steer} e dispare com ${touch ? '🔥' : 'Espaço'} — a mira é automática.`;
        }
        this.el.hintBar.classList.toggle('is-on', Boolean(visible));
    }

    /**
     * Telégrafo e instrumentos. Velocidade em nós sobre o fundo (1 m/s = 1,944 nós).
     * Só escreve no DOM quando o valor exibido muda (o HUD roda a ~12 Hz).
     */
    setNav(p) {
        const el = this.el;
        const knots = Math.hypot(p.vx || 0, p.vz || 0) * 1.944;
        const speedText = knots.toFixed(1).replace('.', ',');
        if (speedText !== this._speedText) {
            this._speedText = speedText;
            if (el.speedValue) el.speedValue.textContent = speedText;
            if (el.speedTouch) el.speedTouch.textContent = `${speedText} nós`;
        }
        if (p.gear !== this._gear) {
            this._gear = p.gear;
            for (const li of el.telegraph) li.dataset.on = String(Number(li.dataset.gear) === p.gear);
            if (el.gearTouchLabel) el.gearTouchLabel.textContent = BOAT.gears[p.gear]?.short ?? '';
            if (el.navPanel) el.navPanel.dataset.gear = String(p.gear);
            if (el.touch) el.touch.dataset.gear = String(p.gear);
        }
        const st = `${Math.round((p.stamina ?? 1) * 100)}%`;
        if (st !== this._stamina) {
            this._stamina = st;
            if (el.staminaFill) el.staminaFill.style.width = st;
            if (el.staminaTouch) el.staminaTouch.style.width = st;
            const low = (p.stamina ?? 1) < BOAT.staminaMinRam;
            if (el.navPanel) el.navPanel.dataset.tired = String(low);
            if (el.touch) el.touch.dataset.tired = String(low);
        }
        if (el.rudderNeedle) {
            const k = Math.max(-1, Math.min(1, (p.rudder || 0) / BOAT.rudderMax));
            el.rudderNeedle.style.left = `${(50 + k * 46).toFixed(1)}%`;
        }
    }

    /** 0 = recarregando, 1 = canhão pronto. */
    setThrowReady(ratio) {
        if (!this.el.throwFill) return;
        this.el.throwFill.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
    }

    /* ---------------------------- overlays ------------------------------ */

    hideOverlays() {
        this.el.menu.hidden = true;
        this.el.pause.hidden = true;
        this.el.gameOver.hidden = true;
        this.el.victory.hidden = true;
    }

    showMenu() {
        this.hideOverlays();
        this.el.menu.hidden = false;
    }

    showPause() {
        this.el.pause.hidden = false;
    }

    hidePause() {
        this.el.pause.hidden = true;
    }

    showGameOver(stats) {
        this.hideOverlays();
        this.el.defeatStats.innerHTML = this._statsMarkup(stats);
        this.el.gameOver.hidden = false;
    }

    showVictory(stats) {
        this.hideOverlays();
        this.el.victoryStats.innerHTML = this._statsMarkup(stats);
        this.el.victory.hidden = false;
    }

    _statsMarkup(stats) {
        return stats
            .map(
                (s) => `<div class="stat${s.gold ? ' stat--gold' : ''}">
                    <span>${s.label}</span>
                    <strong>${s.value}</strong>
                </div>`
            )
            .join('');
    }

    /* ----------------------------- menu --------------------------------- */

    buildDifficulties(current, onSelect) {
        const wrap = this.el.difficultyOptions;
        wrap.innerHTML = '';
        Object.values(DIFFICULTY).forEach((diff) => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'chip';
            chip.textContent = diff.label;
            chip.setAttribute('role', 'radio');
            chip.setAttribute('aria-checked', String(diff.id === current));
            chip.addEventListener('click', () => {
                wrap.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-checked', 'false'));
                chip.setAttribute('aria-checked', 'true');
                this.el.difficultyBlurb.textContent = diff.blurb;
                onSelect(diff.id);
            });
            wrap.appendChild(chip);
        });
        this.el.difficultyBlurb.textContent = DIFFICULTY[current].blurb;
    }

    setBestScore(value) {
        this.el.bestScore.textContent = value ? Math.round(value).toLocaleString('pt-BR') : '—';
    }

    setSoundButton(enabled) {
        this.el.soundButton.setAttribute('aria-pressed', String(enabled));
        this.el.soundButton.textContent = enabled ? '♪' : '✕';
    }
}
