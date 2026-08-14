/**
 * HUD arcade: barras, timer, anúncios K.O. / RING OUT e telas de overlay.
 */

import { FIGHTERS, STAGES, DIFFICULTY } from './config.js';

export class Hud {
    constructor() {
        this.els = {
            loading: document.getElementById('loadingOverlay'),
            loadingFill: document.getElementById('loadingFill'),
            loadingText: document.getElementById('loadingText'),
            title: document.getElementById('titleOverlay'),
            select: document.getElementById('selectOverlay'),
            vs: document.getElementById('vsOverlay'),
            fight: document.getElementById('fightHud'),
            pause: document.getElementById('pauseOverlay'),
            result: document.getElementById('resultOverlay'),
            error: document.getElementById('errorOverlay'),
            errorText: document.getElementById('errorText'),
            p1Hp: document.getElementById('p1Hp'),
            p2Hp: document.getElementById('p2Hp'),
            p1Name: document.getElementById('p1Name'),
            p2Name: document.getElementById('p2Name'),
            p1Rounds: document.getElementById('p1Rounds'),
            p2Rounds: document.getElementById('p2Rounds'),
            timer: document.getElementById('timer'),
            announce: document.getElementById('announce'),
            combo: document.getElementById('combo'),
            roster: document.getElementById('roster'),
            stages: document.getElementById('stageOptions'),
            difficulty: document.getElementById('difficultyOptions'),
            vsP1: document.getElementById('vsP1'),
            vsP2: document.getElementById('vsP2'),
            vsStage: document.getElementById('vsStage'),
            resultEyebrow: document.getElementById('resultEyebrow'),
            resultTitle: document.getElementById('resultTitle'),
            resultStats: document.getElementById('resultStats'),
            pickHint: document.getElementById('pickHint'),
            bestWins: document.getElementById('bestWins'),
            volume: document.getElementById('volumeSlider'),
            volumeValue: document.getElementById('volumeValue'),
            quality: document.getElementById('qualitySelect'),
            touch: document.getElementById('touchControls'),
            fps: document.getElementById('fpsCounter')
        };
        this.announceUntil = 0;
        this.buildRoster();
        this.buildStages();
        this.buildDifficulty();
    }

    buildRoster() {
        this.els.roster.innerHTML = FIGHTERS.map((f) => `
            <button class="fighter-card" type="button" data-id="${f.id}" aria-label="${f.full}">
                <span class="swatch" style="--c1:#${f.palette.primary.toString(16).padStart(6, '0')};--c2:#${f.palette.secondary.toString(16).padStart(6, '0')}"></span>
                <strong>${f.name}</strong>
                <small>${f.style}</small>
            </button>
        `).join('');
    }

    buildStages() {
        this.els.stages.innerHTML = STAGES.map((s, i) => `
            <button class="chip ${i === 0 ? 'is-on' : ''}" type="button" data-stage="${s.id}">
                <b>${s.name}</b><span>${s.tag}</span>
            </button>
        `).join('');
    }

    buildDifficulty() {
        this.els.difficulty.innerHTML = Object.entries(DIFFICULTY).map(([id, d], i) => `
            <button class="chip ${id === 'normal' ? 'is-on' : ''}" type="button" data-diff="${id}">
                ${d.label}
            </button>
        `).join('');
    }

    setLoading(t, text) {
        this.els.loading.hidden = false;
        this.els.loadingFill.style.width = `${Math.round(t * 100)}%`;
        if (text) this.els.loadingText.textContent = text;
    }

    hideLoading() {
        this.els.loading.hidden = true;
    }

    showError(text) {
        this.els.loading.hidden = true;
        this.els.error.hidden = false;
        this.els.errorText.textContent = text;
    }

    setScreen(name) {
        document.body.dataset.state = name;
        this.els.title.hidden = name !== 'title';
        this.els.select.hidden = name !== 'select';
        this.els.vs.hidden = name !== 'vs';
        this.els.fight.hidden = name !== 'fight' && name !== 'pause';
        this.els.pause.hidden = name !== 'pause';
        this.els.result.hidden = name !== 'result';
    }

    highlightRoster(id, slot) {
        this.els.roster.querySelectorAll('.fighter-card').forEach((el) => {
            el.classList.toggle('is-p1', el.dataset.id === id && slot === 'p1');
            el.classList.toggle('is-cpu', el.dataset.id === id && slot === 'cpu');
            el.classList.toggle('is-on', el.dataset.id === id);
        });
    }

    setPickHint(text) {
        this.els.pickHint.textContent = text;
    }

    setWins(n) {
        this.els.bestWins.textContent = n ? `${n} vitórias` : '—';
    }

    bindSelect({ onFighter, onStage, onDiff, onQuality, onVolume }) {
        this.els.roster.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-id]');
            if (btn) onFighter(btn.dataset.id);
        });
        this.els.stages.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-stage]');
            if (!btn) return;
            this.els.stages.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-on', c === btn));
            onStage(btn.dataset.stage);
        });
        this.els.difficulty.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-diff]');
            if (!btn) return;
            this.els.difficulty.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-on', c === btn));
            onDiff(btn.dataset.diff);
        });
        this.els.quality.addEventListener('change', () => onQuality(this.els.quality.value));
        this.els.volume.addEventListener('input', () => {
            const v = Number(this.els.volume.value) / 100;
            this.els.volumeValue.textContent = this.els.volume.value;
            onVolume(v);
        });
    }

    showVs(p1, p2, stage) {
        this.els.vsP1.textContent = p1.name;
        this.els.vsP2.textContent = p2.name;
        this.els.vsStage.textContent = stage.name;
    }

    setupFight(p1, p2) {
        this.els.p1Name.textContent = p1.def.name;
        this.els.p2Name.textContent = p2.def.name;
        this.paintRounds(p1, p2);
        this.paintHp(p1, p2);
        this.els.timer.textContent = '60';
        this.els.combo.textContent = '';
        this.els.announce.textContent = '';
    }

    paintHp(p1, p2) {
        this.els.p1Hp.style.width = `${(p1.hp / p1.maxHp) * 100}%`;
        this.els.p2Hp.style.width = `${(p2.hp / p2.maxHp) * 100}%`;
        this.els.p1Hp.classList.toggle('is-low', p1.hp / p1.maxHp < 0.28);
        this.els.p2Hp.classList.toggle('is-low', p2.hp / p2.maxHp < 0.28);
    }

    paintRounds(p1, p2) {
        this.els.p1Rounds.innerHTML = pips(p1.rounds);
        this.els.p2Rounds.innerHTML = pips(p2.rounds);
    }

    setTimer(s) {
        const n = Math.max(0, Math.ceil(s));
        this.els.timer.textContent = String(n).padStart(2, '0');
        this.els.timer.classList.toggle('is-low', n <= 10);
    }

    announce(text, hold = 1.15) {
        this.els.announce.textContent = text;
        this.els.announce.dataset.show = 'true';
        this.announceUntil = performance.now() + hold * 1000;
    }

    tickAnnounce() {
        if (this.announceUntil && performance.now() > this.announceUntil) {
            this.els.announce.dataset.show = 'false';
            this.announceUntil = 0;
        }
    }

    setCombo(n) {
        this.els.combo.textContent = n >= 2 ? `${n} HIT` : '';
    }

    showResult({ win, reason, p1, cpu }) {
        this.els.resultEyebrow.textContent = reason;
        this.els.resultTitle.innerHTML = win ? 'VOCÊ<br>VENCEU' : 'VOCÊ<br>PERDEU';
        this.els.resultStats.innerHTML = `
            <div><span>P1</span><b>${p1.rounds}</b></div>
            <div><span>CPU</span><b>${cpu.rounds}</b></div>
        `;
        this.els.result.classList.toggle('is-win', win);
    }

    setFps(n) {
        this.els.fps.textContent = `${n} fps`;
    }

    showTouch(on) {
        this.els.touch.hidden = !on;
    }
}

function pips(n) {
    return [0, 1].map((i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('');
}
