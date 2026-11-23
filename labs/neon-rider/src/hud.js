/**
 * HUD, menus arcade e overlays. Sem lógica 3D aqui.
 * Painel da moto (estilo painel TFT de esportiva): conta-giros em barra com faixa vermelha,
 * luz de troca, velocímetro em km/h, marcha, inclinação, aderência usada e nitro.
 * O HUD só toca o DOM quando um valor exibido muda (sem recalcular estilo a cada quadro).
 */

import { DIFFICULTY } from './config.js?v=17';
import { formatKm, formatTime } from './utils.js?v=17';

const $ = (id) => document.getElementById(id);

export class Hud {
    constructor() {
        this.el = {
            hud: $('hud'),
            dash: $('dash'),
            speed: $('speedValue'),
            gear: $('gearValue'),
            rpmFill: $('rpmFill'),
            rpmRed: $('rpmRed'),
            rpmText: $('rpmValue'),
            lean: $('leanValue'),
            leanNeedle: $('leanNeedle'),
            grip: $('gripFill'),
            bikeName: $('bikeName'),
            km: $('kmValue'),
            tapes: $('tapeValue'),
            lives: $('livesValue'),
            score: $('scoreValue'),
            radio: $('radioValue'),
            radioTag: $('radioTag'),
            boostFill: $('boostFill'),
            fps: $('fpsCounter'),
            message: $('message'),
            count: $('countdown'),
            touch: $('touchControls'),
            soundButton: $('soundButton'),
            cameraButton: $('cameraButton'),
            pauseButton: $('pauseButton'),
            loading: $('loadingOverlay'),
            loadingFill: $('loadingFill'),
            loadingText: $('loadingText'),
            menu: $('menuOverlay'),
            pause: $('pauseOverlay'),
            gameOver: $('gameOverOverlay'),
            win: $('winOverlay'),
            winStats: $('winStats'),
            winText: $('winText'),
            goalFill: $('goalFill'),
            goalBike: $('goalBike'),
            goalText: $('goalText'),
            error: $('errorOverlay'),
            errorText: $('errorText'),
            difficultyOptions: $('difficultyOptions'),
            difficultyBlurb: $('difficultyBlurb'),
            qualitySelect: $('qualitySelect'),
            volumeSlider: $('volumeSlider'),
            volumeValue: $('volumeValue'),
            autoThrottle: $('autoThrottleToggle'),
            shake: $('shakeToggle'),
            bestScore: $('bestScore'),
            overStats: $('overStats'),
            overTitle: $('overTitle'),
            crt: document.querySelector('.crt-overlay'),
            glitch: $('glitchLayer')
        };
        this.msgTimer = 0;
        this.countTimer = 0;
        /** Último valor escrito em cada campo: o HUD só toca o DOM quando algo muda. */
        this._last = {};
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

    showWin(on) {
        this.el.win.hidden = !on;
    }

    showHud(on) {
        this.el.hud.hidden = !on;
    }

    setTouchVisible(on) {
        this.el.touch.hidden = !on;
        this.el.hud.classList.toggle('is-touch', on);
    }

    setMuted(on) {
        this.el.soundButton.setAttribute('aria-pressed', String(!on));
        this.el.soundButton.setAttribute('aria-label', on ? 'Ligar o som' : 'Desligar o som');
        this.el.soundButton.textContent = on ? '×♪' : '♪';
    }

    setFps(fps) {
        if (!this.el.fps) return;
        this._set('fps', this.el.fps, `${fps | 0} fps`);
    }

    /** Nome e faixa vermelha da moto da corrida (redline / corte de giro). */
    setBike(bike) {
        if (this.el.bikeName) this.el.bikeName.textContent = bike.name;
        // a barra vai até o corte; a faixa vermelha começa no redline
        const redStart = bike.redline / bike.limiter;
        this.el.rpmRed.style.left = `${(redStart * 100).toFixed(1)}%`;
        this._last = {};
    }

    flashGlitch() {
        this.el.glitch.classList.add('is-on');
        clearTimeout(this._g);
        this._g = setTimeout(() => this.el.glitch.classList.remove('is-on'), 420);
    }

    message(text, ms = 1600) {
        this.el.message.textContent = text;
        this.el.message.dataset.show = 'true';
        clearTimeout(this.msgTimer);
        this.msgTimer = setTimeout(() => {
            this.el.message.dataset.show = 'false';
        }, ms);
    }

    /** Contagem de largada: 3, 2, 1 e "VAI!" (n = 0). */
    countdown(n) {
        const el = this.el.count;
        el.textContent = n > 0 ? String(n) : 'VAI!';
        el.dataset.go = String(n === 0);
        el.hidden = false;
        // reinicia a animação de "pulso"
        el.classList.remove('is-pulse');
        void el.offsetWidth;
        el.classList.add('is-pulse');
        clearTimeout(this.countTimer);
        if (n === 0) this.countTimer = setTimeout(() => { el.hidden = true; }, 700);
    }

    /** Escreve só quando o valor muda (evita recalcular estilo/layout a cada quadro). */
    _set(key, el, value, prop = 'textContent') {
        if (this._last[key] === value) return;
        this._last[key] = value;
        if (prop === 'textContent') el.textContent = value;
        else if (prop === 'transform') el.style.transform = value;
        else el.style[prop] = value;
    }

    _flag(key, el, name, on) {
        if (this._last[key] === on) return;
        this._last[key] = on;
        el.classList.toggle(name, on);
    }

    update(s) {
        const el = this.el;
        this._set('speed', el.speed, String(Math.round(s.speed)).padStart(3, '0'));
        this._set('gear', el.gear, s.speed < 1 && s.rpm < 2000 ? 'N' : String(s.gear));
        // barra do conta-giros: 0 → corte; escala em 1 % (transform não força layout)
        const rpmF = Math.min(1, s.rpm / s.limiter);
        this._set('rpm', el.rpmFill, `scaleX(${(Math.round(rpmF * 100) / 100).toFixed(2)})`, 'transform');
        this._set('rpmText', el.rpmText, `${(s.rpm / 1000).toFixed(1).replace('.', ',')}k`);
        this._flag('shift', el.dash, 'is-shift', s.rpm > s.redline * 0.94);
        const lean = Math.round(s.lean);
        this._set('lean', el.lean, `${Math.abs(lean)}°`);
        this._set('leanNeedle', el.leanNeedle, `rotate(${lean}deg)`, 'transform');
        const grip = Math.round(s.grip * 20) / 20;
        this._set('grip', el.grip, `scaleX(${grip.toFixed(2)})`, 'transform');
        this._flag('gripHot', el.dash, 'is-grip-hot', s.grip > 0.88);
        this._set('boost', el.boostFill, `scaleX(${(Math.round(s.nitro * 50) / 50).toFixed(2)})`, 'transform');
        this._flag('nitroOn', el.dash, 'is-nitro', s.nitroOn);

        this._set('km', el.km, formatKm(s.distance));
        this._set('tapes', el.tapes, String(s.tapes).padStart(2, '0'));
        this._set('lives', el.lives, '■'.repeat(Math.max(0, Math.min(5, s.lives))) || '—');
        if (el.score) this._set('score', el.score, s.score.toLocaleString('pt-BR'));
        this._set('radio', el.radio, s.station.name);
        this._set('radioTag', el.radioTag, s.station.tagline);
        if (s.goal) {
            const f = Math.min(1, s.distance / s.goal);
            const pct = Math.round(f * 400) / 4;
            this._set('goalFill', el.goalFill, `scaleX(${(pct / 100).toFixed(4)})`, 'transform');
            this._set('goalBike', el.goalBike, `${pct}%`, 'left');
            this._set('goalText', el.goalText, `${(s.distance / 1000).toFixed(2).replace('.', ',')} / ${String(s.goal / 1000).replace('.', ',')} km`);
        }
    }

    setWinStats({ distance, tapes, time, score, lives, top, avg, nearMisses, record }) {
        this.el.winText.textContent = record ? 'Novo recorde nesta dificuldade!' : 'A avenida inteira, de ponta a ponta.';
        this.el.winStats.innerHTML = `
            <div><span>Tempo</span><b>${formatTime(time, true)}</b></div>
            <div><span>Média</span><b>${Math.round(avg)} km/h</b></div>
            <div><span>Máxima</span><b>${Math.round(top)} km/h</b></div>
            <div><span>Por um triz</span><b>${nearMisses}</b></div>
            <div><span>Fitas</span><b>${tapes}</b></div>
            <div><span>Créditos sobrando</span><b>${lives}</b></div>
            <div class="stats-wide"><span>Score</span><b>${score.toLocaleString('pt-BR')}</b></div>
        `;
    }

    /** Recorde da dificuldade no menu: tempo de chegada, ou a maior distância se nunca chegou. */
    setRecord(diff, rec) {
        let text = '—';
        if (rec?.time != null) text = `${formatTime(rec.time, true)} (${diff.label})`;
        else if (rec?.dist) text = `${formatKm(rec.dist)} de ${formatKm(diff.goal)} (${diff.label})`;
        this.el.bestScore.textContent = text;
    }

    setOverStats({ distance, tapes, time, score, top, nearMisses, record }) {
        this.el.overStats.innerHTML = `
            <div><span>Distância</span><b>${formatKm(distance)}</b></div>
            <div><span>Tempo</span><b>${formatTime(time, true)}</b></div>
            <div><span>Máxima</span><b>${Math.round(top)} km/h</b></div>
            <div><span>Por um triz</span><b>${nearMisses}</b></div>
            <div><span>Fitas</span><b>${tapes}</b></div>
            <div><span>Score</span><b>${score.toLocaleString('pt-BR')}</b></div>
            ${record ? '<div class="stats-wide stats-record"><b>Nova melhor distância!</b></div>' : ''}
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
            btn.setAttribute('role', 'radio');
            btn.setAttribute('aria-checked', String(d.id === current));
            btn.addEventListener('click', () => {
                root.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-checked', 'false'));
                btn.setAttribute('aria-checked', 'true');
                this.el.difficultyBlurb.textContent = d.blurb;
                onPick?.(d.id);
            });
            root.appendChild(btn);
        });
        this.el.difficultyBlurb.textContent = DIFFICULTY[current].blurb;
        this._onPick = onPick;
    }

    bindSettings({ quality, volume, autoThrottle, shake, onQuality, onVolume, onAutoThrottle, onShake }) {
        const el = this.el;
        el.qualitySelect.value = quality;
        el.volumeSlider.value = String(volume);
        el.volumeValue.textContent = String(volume);
        el.autoThrottle.checked = autoThrottle;
        el.shake.checked = shake;
        el.qualitySelect.addEventListener('change', () => onQuality(el.qualitySelect.value));
        el.volumeSlider.addEventListener('input', () => {
            const v = Number(el.volumeSlider.value);
            el.volumeValue.textContent = String(v);
            onVolume(v);
        });
        el.autoThrottle.addEventListener('change', () => onAutoThrottle(el.autoThrottle.checked));
        el.shake.addEventListener('change', () => onShake(el.shake.checked));
    }
}

