// game/scenes.js — cenas: title, hub, briefing, play, result, pódio, opções, pause.
// Teto: ~420 linhas. FASE 1 STUB: implementar play e result completos, outros básicos.

import { W, H } from '../core/pixel.js';
import { bakeHubBackground, MARKERS } from '../art/mapart.js';
import { ORDER } from './shell.js';

export const titleScene = {
    id: 'title',
    bg: null,
    enter(app) {
        if (!this.bg) this.bg = bakeHubBackground(app.rng);
        this.t = 0;
        if (app.audio) app.audio.playSong('tema');
    },
    exit() {},
    update(dt, input, app) {
        this.t += dt;
        if (input.state.a.pressed || input.state.start.pressed) {
            app.goto(hubScene);
        }
    },
    draw(px, app) {
        if (this.bg) px.ctx.drawImage(this.bg, 0, 0);
        app.font.textBig(px.ctx, 'SANTOS', W / 2, 60, { align: 'center', scale: 2, outlineColor: '#ff2fa0' });
        app.font.textBig(px.ctx, 'VICE CITY', W / 2, 100, { align: 'center', scale: 2, outlineColor: '#00f0ff' });
        const blinkOn = Math.sin(this.t * 4) > 0;
        if (blinkOn) {
            app.font.text(px.ctx, 'PRESS START', W / 2, 180, { align: 'center', color: 'A', scale: 1 });
        }
    }
};

export const hubScene = {
    id: 'hub',
    bg: null,
    selectedIdx: 0,
    enter(app) {
        if (!this.bg) this.bg = bakeHubBackground(app.rng);
        this.selectedIdx = 0;
        this.t = 0;
        if (app.audio) app.audio.playSong('tema');
    },
    exit() {},
    update(dt, input, app) {
        this.t += dt * 6;
        const prev = this.selectedIdx;
        if (input.state.left.pressed) this.selectedIdx = (this.selectedIdx - 1 + 5) % 5;
        if (input.state.right.pressed) this.selectedIdx = (this.selectedIdx + 1) % 5;
        if (input.state.up.pressed) this.selectedIdx = (this.selectedIdx - 2 + 5) % 5;
        if (input.state.down.pressed) this.selectedIdx = (this.selectedIdx + 2) % 5;
        if (this.selectedIdx !== prev && app.audio) app.audio.play('ui_move');
        if (input.state.a.pressed) {
            if (app.audio) app.audio.play('ui_confirm');
            app.goto(briefingScene, { eventIdx: this.selectedIdx, mode: 'treino' });
        }
        if (input.state.start.pressed) {
            app.shell.startCampeonato();
            if (app.audio) app.audio.play('ui_confirm');
            app.goto(briefingScene, { eventIdx: 0, mode: 'campeonato' });
        }
    },
    draw(px, app) {
        if (this.bg) px.ctx.drawImage(this.bg, 0, 0);
        app.font.text(px.ctx, 'SANTOS VICE CITY', 6, 4, { color: 'A', mono: true, scale: 1, shadow: '0' });

        const selectedId = ORDER[this.selectedIdx];
        for (const marker of MARKERS) {
            const isSel = marker.id === selectedId;
            const sp = app.sprites.has('marker_' + marker.id) ? app.sprites.get('marker_' + marker.id) : null;
            if (sp) px.blitScreen(sp, marker.x, marker.y);
            if (isSel) {
                const bounce = Math.sin(this.t || 0) * 2;
                app.font.text(px.ctx, '▼', marker.x, marker.y - 18 + bounce, { align: 'center', color: 'A', mono: true });
            }
            const best = app.store.getBest(marker.id);
            if (best.medal) {
                const medalSp = app.sprites.has('medal_' + best.medal) ? app.sprites.get('medal_' + best.medal) : null;
                if (medalSp) px.blitScreen(medalSp, marker.x + 10, marker.y - 6);
            }
        }

        const selMarker = MARKERS.find(m => m.id === selectedId);
        if (selMarker) {
            app.font.text(px.ctx, selMarker.label, W / 2, 198, { align: 'center', color: 'q', mono: false });
        }
        app.font.text(px.ctx, 'A: treino   START: campeonato', W / 2, 212, { align: 'center', color: 'p', mono: false });
    }
};

export const briefingScene = {
    id: 'briefing',
    enter(app, params) {
        this.eventIdx = params?.eventIdx || 0;
        this.mode = params?.mode || 'treino';
        this.event = app.shell.getEvent(this.eventIdx);
    },
    exit() {},
    update(dt, input, app) {
        if (input.state.a.pressed) {
            if (app.audio) app.audio.play('ui_confirm');
            app.goto(playScene, { event: this.event, mode: this.mode, eventIdx: this.eventIdx });
        }
    },
    draw(px, app) {
        px.ctx.fillStyle = '#0d0a1a';
        px.ctx.fillRect(0, 0, W, H);
        app.font.text(px.ctx, this.event.name, W / 2, 20, { align: 'center', color: 'A', scale: 1 });
        app.font.text(px.ctx, this.event.region, W / 2, 35, { align: 'center', color: 'q', mono: false, scale: 1 });
        app.font.text(px.ctx, this.event.blurb[0], W / 2, 60, { align: 'center', color: 'r', mono: false, scale: 1 });
        app.font.text(px.ctx, 'Pressione A para começar', W / 2, 200, { align: 'center', color: 'A', mono: false, scale: 1 });
    }
};

export const playScene = {
    id: 'play',
    countdownLeft: 0,
    enter(app, params) {
        this.event = params?.event;
        this.mode = params?.mode || 'treino';
        this.eventIdx = params?.eventIdx || 0;
        if (!this.event) return;
        this.eventApi = {
            rng: app.rng,
            sprites: app.sprites,
            font: app.font,
            hud: app.hud,
            duration: this.event.duration,
            cam: null,
            finish: (reason) => this._finish(app, reason),
            shake: (p, ms) => app.px.shake(p, ms),
            popup: (x, y, text, color) => app.hud.popup(x, y, text, color)
        };
        this.event.init(app, this.eventApi);
        this.countdownLeft = 3;
        this._musicStarted = false;
        if (app.audio) app.audio.playStinger('contagem');
        app.hud.time = 0;
        app.hud.lives = 3;
    },
    exit() {
        if (this._app && this._app.audio) this._app.audio.stopSong();
    },
    update(dt, input, app) {
        if (!this.event) return;
        this._app = app;
        this.countdownLeft = Math.max(0, this.countdownLeft - dt);
        if (this.countdownLeft <= 0) {
            if (!this._musicStarted) {
                this._musicStarted = true;
                if (app.audio) app.audio.playSong(this.event.music);
            }
            this.event.update(dt, input, this.eventApi);
        }
        app.hud.update(dt * 1000);
        app.hud.score = this.event.score();
        app.hud.time = this.countdownLeft <= 0 ? Math.min(1, (this.event.state?.time || 0) / this.event.duration) : 0;
    },
    draw(px, app) {
        px.ctx.fillStyle = '#0d0a1a';
        px.ctx.fillRect(0, 0, W, H);
        if (this.event) this.event.draw(px, this.eventApi);
        if (this.countdownLeft > 0) {
            const num = Math.ceil(this.countdownLeft);
            app.font.textBig(px.ctx, String(num), W / 2, H / 2, { align: 'center', scale: 3, outlineColor: '#ff2fa0' });
        }
        app.hud.draw(px);
        if (this.event) this.event.hud(px, this.eventApi);
    },
    _finish(app, reason) {
        if (!this.event) return;
        if (app.audio) app.audio.stopSong();
        const score = this.event.score();
        const medal = app.shell.getEvent(this.eventIdx).medals;
        const medalName = score >= medal.platina ? 'platina' : score >= medal.ouro ? 'ouro' : score >= medal.prata ? 'prata' : score >= medal.bronze ? 'bronze' : 'none';
        const isRecord = app.shell.recordResult(this.event.id, score, medalName);
        if (app.audio) app.audio.playStinger(medalName === 'none' ? 'falha' : 'fanfarra_ouro');
        app.goto(resultScene, { eventId: this.event.id, score, medal: medalName, mode: this.mode, isRecord });
    }
};

export const resultScene = {
    id: 'result',
    enter(app, params) {
        this.eventId = params?.eventId;
        this.score = params?.score || 0;
        this.medal = params?.medal || 'none';
        this.mode = params?.mode || 'treino';
        this.isRecord = params?.isRecord || false;
    },
    exit() {},
    update(dt, input, app) {
        if (input.state.a.pressed) {
            if (app.audio) app.audio.play('ui_confirm');
            if (this.mode === 'campeonato') {
                const next = app.shell.nextEvent();
                if (next) {
                    app.goto(briefingScene, { eventIdx: app.shell.eventIdx, mode: 'campeonato' });
                } else {
                    app.goto(podiumScene);
                }
            } else {
                app.goto(hubScene);
            }
        }
    },
    draw(px, app) {
        px.ctx.fillStyle = '#0d0a1a';
        px.ctx.fillRect(0, 0, W, H);
        app.font.text(px.ctx, 'RESULTADO', W / 2, 30, { align: 'center', color: 'A', mono: true, scale: 1 });
        app.font.text(px.ctx, 'SCORE: ' + String(this.score).padStart(6, '0'), W / 2, 70, { align: 'center', color: 'q', mono: true, scale: 1 });
        app.font.text(px.ctx, 'MEDALHA: ' + this.medal.toUpperCase(), W / 2, 90, { align: 'center', color: 'A', mono: true, scale: 1 });
        if (this.isRecord) {
            app.font.text(px.ctx, 'NOVO RECORDE!', W / 2, 115, { align: 'center', color: 'x', mono: true, scale: 1 });
        }
        app.font.text(px.ctx, 'Pressione A para continuar', W / 2, 180, { align: 'center', color: 'r', mono: false, scale: 1 });
    }
};

export const podiumScene = {
    id: 'podium',
    enter(app) {
        this.result = app.shell.finishCampeonato();
        if (app.audio) app.audio.playStinger('fanfarra_ouro');
    },
    exit() {},
    update(dt, input, app) {
        if (input.state.a.pressed) {
            if (app.audio) app.audio.play('ui_confirm');
            app.goto(hubScene);
        }
    },
    draw(px, app) {
        px.ctx.fillStyle = '#1b1233';
        px.ctx.fillRect(0, 0, W, H);
        app.font.text(px.ctx, 'PÓDIO', W / 2, 20, { align: 'center', color: 'A', mono: true, scale: 1 });
        const podium = app.shell.getPodium();
        const heights = [140, 110, 170];
        for (let i = 0; i < podium.length; i++) {
            const y = 180 - heights[i];
            app.font.text(px.ctx, podium[i].name.slice(0, 8), 50 + i * 90, y, { align: 'center', color: 'q', mono: true });
            app.font.text(px.ctx, String(podium[i].points).padStart(5, '0'), 50 + i * 90, y + 20, { align: 'center', color: 'A', mono: true });
        }
    }
};
