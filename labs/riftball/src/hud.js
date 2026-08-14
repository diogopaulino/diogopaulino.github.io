/**
 * HUD: overlays, placar, anúncios de gol e sala.
 */

import { SCORE_LIMIT } from './config.js';
import { formatTime } from './utils.js';

export class Hud {
    constructor() {
        this.els = {
            loading: document.getElementById('loadingOverlay'),
            loadingFill: document.getElementById('loadingFill'),
            loadingText: document.getElementById('loadingText'),
            menu: document.getElementById('menuOverlay'),
            lobby: document.getElementById('lobbyOverlay'),
            hud: document.getElementById('hud'),
            pause: document.getElementById('pauseOverlay'),
            result: document.getElementById('resultOverlay'),
            error: document.getElementById('errorOverlay'),
            errorText: document.getElementById('errorText'),
            p1Score: document.getElementById('p1Score'),
            p2Score: document.getElementById('p2Score'),
            p1Name: document.getElementById('p1Name'),
            p2Name: document.getElementById('p2Name'),
            clock: document.getElementById('matchClock'),
            scoreTo: document.getElementById('scoreTo'),
            boostFill: document.getElementById('boostFill'),
            announce: document.getElementById('announce'),
            netBadge: document.getElementById('netBadge'),
            roomCode: document.getElementById('roomCode'),
            lobbyStatus: document.getElementById('lobbyStatus'),
            joinForm: document.getElementById('joinForm'),
            joinCode: document.getElementById('joinCode'),
            resultTitle: document.getElementById('resultTitle'),
            resultStats: document.getElementById('resultStats'),
            resultEyebrow: document.getElementById('resultEyebrow'),
            volume: document.getElementById('volumeSlider'),
            volumeValue: document.getElementById('volumeValue'),
            quality: document.getElementById('qualitySelect'),
            touch: document.getElementById('touchControls'),
            fps: document.getElementById('fpsCounter'),
            sound: document.getElementById('soundButton')
        };
        this.announceUntil = 0;
    }

    setLoading(p, text) {
        if (this.els.loadingFill) this.els.loadingFill.style.width = `${Math.round(p * 100)}%`;
        if (text && this.els.loadingText) this.els.loadingText.textContent = text;
    }

    hideLoading() {
        if (this.els.loading) this.els.loading.hidden = true;
    }

    showMenu() {
        this.hideAll();
        if (this.els.menu) this.els.menu.hidden = false;
    }

    showLobby(code) {
        this.hideAll();
        if (this.els.lobby) this.els.lobby.hidden = false;
        if (this.els.roomCode) this.els.roomCode.textContent = code;
        if (this.els.lobbyStatus) {
            this.els.lobbyStatus.textContent = 'Esperando o segundo hover atravessar o rift…';
        }
    }

    setLobbyStatus(text) {
        if (this.els.lobbyStatus) this.els.lobbyStatus.textContent = text;
    }

    showHud() {
        this.hideAll();
        if (this.els.hud) this.els.hud.hidden = false;
    }

    showPause(on) {
        if (this.els.pause) this.els.pause.hidden = !on;
    }

    showResult(winnerName, score, overtime) {
        this.hideAll();
        if (this.els.hud) this.els.hud.hidden = false;
        if (this.els.result) this.els.result.hidden = false;
        if (this.els.resultEyebrow) {
            this.els.resultEyebrow.innerHTML = overtime
                ? '<i></i> gol de ouro'
                : '<i></i> fim de jogo';
        }
        if (this.els.resultTitle) this.els.resultTitle.textContent = `${winnerName} vence`;
        if (this.els.resultStats) {
            this.els.resultStats.textContent = `Placar ${score[0]} — ${score[1]}. Primeiro a ${SCORE_LIMIT}, ou o relógio.`;
        }
    }

    showError(text) {
        if (this.els.error) this.els.error.hidden = false;
        if (this.els.errorText) this.els.errorText.textContent = text;
    }

    hideAll() {
        for (const key of ['menu', 'lobby', 'pause', 'result', 'error']) {
            if (this.els[key]) this.els[key].hidden = true;
        }
    }

    setNames(a, b) {
        if (this.els.p1Name) this.els.p1Name.textContent = a;
        if (this.els.p2Name) this.els.p2Name.textContent = b;
    }

    setScore(score, clock, overtime) {
        if (this.els.p1Score) this.els.p1Score.textContent = String(score[0]);
        if (this.els.p2Score) this.els.p2Score.textContent = String(score[1]);
        if (this.els.clock) this.els.clock.textContent = overtime ? 'OURO' : formatTime(clock);
        if (this.els.scoreTo) {
            this.els.scoreTo.textContent = overtime ? 'próximo gol ganha' : `primeiro a ${SCORE_LIMIT}`;
        }
    }

    setBoost(v) {
        if (this.els.boostFill) this.els.boostFill.style.width = `${Math.round(v * 100)}%`;
    }

    setNet(text) {
        if (!this.els.netBadge) return;
        if (!text) {
            this.els.netBadge.hidden = true;
            return;
        }
        this.els.netBadge.hidden = false;
        this.els.netBadge.textContent = text;
    }

    announce(text, dur = 1.4) {
        if (!this.els.announce) return;
        this.els.announce.textContent = text;
        this.els.announce.dataset.show = 'true';
        this.announceUntil = performance.now() / 1000 + dur;
    }

    tick(now) {
        if (this.els.announce && now > this.announceUntil) {
            this.els.announce.dataset.show = 'false';
        }
    }

    setMuted(on) {
        if (this.els.sound) this.els.sound.setAttribute('aria-pressed', on ? 'false' : 'true');
    }

    setFps(n, show) {
        if (!this.els.fps) return;
        this.els.fps.hidden = !show;
        this.els.fps.textContent = `${n} fps`;
    }

    setTouch(on) {
        if (this.els.touch) this.els.touch.hidden = !on;
    }
}
