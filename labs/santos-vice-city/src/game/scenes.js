// game/scenes.js — todas as telas fora do gameplay.
//
// Cada cena é um objeto com { id, enter, update, draw, exit }. `update` devolve nada; a
// navegação acontece por `ctx.goto(cena, params)` / `ctx.pushScene` / `ctx.popScene`, o que
// mantém o fluxo explícito e permite empilhar a pausa por cima de qualquer coisa.
//
// O fluxo geral copia o do California Games: título -> menu -> patrocinador -> prova a prova,
// com uma tela de resultado entre elas, e a cerimônia de pódio no fim.

import { W, H } from '../core/pixel.js';
import { SVC } from '../core/palette.js';
import { clamp, easeOutBack } from '../core/util.js';
import { EVENTS, EVENT_ORDER, SPONSORS, MEDAL_LABEL, MEDAL_COLOR } from './config.js';
import { Championship } from './championship.js';
import { MenuList, screenHeader, screenFooter, scrim } from './menu.js';
import { panel, judgePanel } from './hud.js';
import { drawNeonGrid } from '../art/scenery.js';
import { createEvent } from '../events/index.js';

// ---------------------------------------------------------------------------
// Título
// ---------------------------------------------------------------------------

export const titleScene = {
    id: 'title',
    enter(ctx) {
        this.ctx = ctx;
        this.t = 0;
        this.ctx.audio.playSong('tema');
    },
    update(dtMs) {
        const ctx = this.ctx;
        this.t += dtMs / 1000;
        if (ctx.input.state.start.pressed || ctx.input.state.a.pressed) {
            ctx.audio.play('ui_confirm');
            ctx.goto(menuScene);
        }
    },
    draw() {
        const { px, font, sprites, scenery, store } = this.ctx;
        const c = px.ctx;

        c.drawImage(scenery.skyNight, 0, 0);
        c.drawImage(scenery.sky, 0, 40);
        drawNeonGrid(c, 150, 74, this.t);
        c.drawImage(scenery.skyline, Math.round(-(this.t * 6) % 640), 96);

        // gaivotas cruzando o pôr do sol — a tela de título ganha uma vida que não custa nada
        for (let i = 0; i < 3; i++) {
            const gx = ((this.t * (9 + i * 4) + i * 130) % (W + 40)) - 20;
            px.blitScreen(sprites.anim('gull', this.t + i, 4), gx, 30 + i * 13);
        }

        // logotipo: SANTOS em degradê quente, VICE GAMES em neon frio, ambos com contorno grosso
        const bob = Math.sin(this.t * 1.6) * 2;
        font.textBig(c, 'SANTOS', W / 2, 38 + bob, {
            scale: 4, ramp: ['h', '8', '7', '6', '5'], outlineColor: '0', align: 'center'
        });
        font.textBig(c, 'VICE GAMES', W / 2, 74 + bob, {
            scale: 3, ramp: ['P', 'd', 'c', 'b'], outlineColor: '0', align: 'center'
        });

        scrim(px, 102, 14, 0.55);
        font.text(c, 'SEIS PROVAS NA ORLA · UM CAMPEONATO', W / 2, 105, {
            color: '8', align: 'center', mono: true, shadow: '0'
        });

        // faixa escura atrás das chamadas de baixo — sem ela o texto some no skyline
        scrim(px, 160, 64, 0.6);
        px.rect(0, 160, W, 1, SVC['3']);

        // "insira ficha"
        if (Math.floor(this.t * 1.8) % 2 === 0) {
            font.text(c, 'APERTE START', W / 2, 170, {
                color: 'A', align: 'center', mono: true, scale: 2, outline: '0'
            });
        }

        const career = store.careerTotal();
        if (career > 0) {
            font.text(c, `CARREIRA ${String(career).padStart(5, '0')} PTS`, W / 2, 196,
                { color: 'p', align: 'center', mono: true });
        }
        font.text(c, 'HOMENAGEM A CALIFORNIA GAMES', W / 2, 208, { color: 'o', align: 'center', mono: true });
    }
};

// ---------------------------------------------------------------------------
// Menu principal
// ---------------------------------------------------------------------------

export const menuScene = {
    id: 'menu',
    enter(ctx) {
        this.ctx = ctx;
        this.t = 0;
        this.menu = new MenuList([
            { label: 'CAMPEONATO', value: 'champ', hint: 'As seis provas em sequência, com pódio no fim.' },
            { label: 'PROVA ÚNICA', value: 'single', hint: 'Escolha uma prova e tente bater seu recorde.' },
            { label: 'TREINO', value: 'practice', hint: 'Jogue sem registrar recorde nem colocação.' },
            { label: 'RECORDES', value: 'records', hint: 'Suas melhores marcas e medalhas.' },
            { label: 'OPÇÕES', value: 'options', hint: 'Som, tremor de tela e apagar dados.' }
        ]);
    },
    update(dtMs) {
        const ctx = this.ctx;
        this.t += dtMs / 1000;
        const action = this.menu.update(ctx.input, ctx.audio, dtMs);
        if (action === 'back') { ctx.goto(titleScene); return; }
        if (action !== 'confirm') return;

        switch (this.menu.current.value) {
            case 'champ': ctx.goto(sponsorScene, { mode: 'champ' }); break;
            case 'single': ctx.goto(eventSelectScene, { mode: 'single' }); break;
            case 'practice': ctx.goto(eventSelectScene, { mode: 'practice' }); break;
            case 'records': ctx.goto(recordsScene); break;
            case 'options': ctx.goto(optionsScene); break;
            default: break;
        }
    },
    draw() {
        const { px, font, sprites, scenery } = this.ctx;
        const c = px.ctx;
        c.drawImage(scenery.sky, 0, 0);
        drawNeonGrid(c, 160, 64, this.t * 0.5);
        c.drawImage(scenery.skyline, -40, 108);

        scrim(px, 31, 179);
        screenHeader(px, font, 'SANTOS VICE GAMES', 'MENU PRINCIPAL');
        this.menu.draw(px, font, sprites, W / 2, 62, {
            lineH: 20, time: this.t, hintY: 176, width: 176
        });
        screenFooter(px, font, 'Z CONFIRMA · X VOLTA');
    }
};

// ---------------------------------------------------------------------------
// Escolha de patrocinador
// ---------------------------------------------------------------------------

export const sponsorScene = {
    id: 'sponsor',
    enter(ctx, params) {
        this.ctx = ctx;
        this.mode = params.mode || 'champ';
        this.index = SPONSORS.findIndex((s) => s.id === ctx.store.data.seen.sponsor);
        if (this.index < 0) this.index = 0;
        this.t = 0;
        this.repeatT = 0;
    },
    update(dtMs) {
        const ctx = this.ctx;
        this.t += dtMs / 1000;
        const { input, audio } = ctx;

        const move = (d) => {
            this.index = (this.index + d + SPONSORS.length) % SPONSORS.length;
            audio.play('ui_move');
        };
        if (input.state.left.pressed) move(-1);
        if (input.state.right.pressed) move(1);
        if (input.state.up.pressed) move(-3);
        if (input.state.down.pressed) move(3);

        if (input.state.a.pressed || input.state.start.pressed) {
            audio.play('ui_confirm');
            const sponsor = SPONSORS[this.index];
            ctx.store.rememberSponsor(sponsor.id);
            ctx.setSponsor(sponsor);
            const champ = new Championship('champ', sponsor, ctx.rng, EVENT_ORDER);
            ctx.champ = champ;
            ctx.goto(briefingScene, { eventId: champ.currentEventId, champ });
        }
        if (input.state.b.pressed) { audio.play('ui_back'); ctx.goto(menuScene); }
    },
    draw() {
        const { px, font, sprites, scenery } = this.ctx;
        const c = px.ctx;
        c.drawImage(scenery.sky, 0, -20);
        drawNeonGrid(c, 170, 54, this.t * 0.4);

        scrim(px, 31, 179);
        screenHeader(px, font, 'PATROCINADOR', 'ELE PAGA O UNIFORME E TORCE NA SUA PROVA');

        // Grade 3×2 de emblemas. As medidas são apertadas de propósito: a caixa de descrição
        // embaixo ocupa 46 px e a linha de baixo da grade encostava nela na versão anterior.
        const cols = 3, cellW = 100, cellH = 54;
        const x0 = (W - cols * cellW) / 2;
        const y0 = 36;
        SPONSORS.forEach((sp, i) => {
            const cx = Math.round(x0 + (i % cols) * cellW + cellW / 2);
            const cy = y0 + Math.floor(i / cols) * cellH;
            const active = i === this.index;
            if (active) {
                panel(px, cx - 42, cy - 2, 84, 50, {
                    fill: '2', border: '0', light: 'A', dark: '1', accent: sp.kit.shirt
                });
            }
            px.blitScreen(sprites.get(`logo_${sp.id}`), cx, cy + 18);
            font.text(c, EVENTS[sp.boon].name, cx, cy + 36, {
                color: active ? 'A' : 'o', align: 'center', mono: true
            });
        });

        const sp = SPONSORS[this.index];
        panel(px, 10, 148, W - 20, 56, { fill: '1', border: '0', light: 'n', accent: sp.kit.shirt });
        font.text(c, sp.name, W / 2, 154, { color: sp.kit.shirt, align: 'center', mono: true });
        font.wrap(sp.motto, W - 34, { mono: true }).slice(0, 2).forEach((line, i) => {
            font.text(c, line, W / 2, 168 + i * 11, { color: 'p', align: 'center', mono: true });
        });
        font.text(c, `+12% DE PONTOS EM ${EVENTS[sp.boon].name}`, W / 2, 192, {
            color: 'H', align: 'center', mono: true
        });

        screenFooter(px, font, 'SETAS ESCOLHEM · Z FECHA CONTRATO · X VOLTA');
    }
};

// ---------------------------------------------------------------------------
// Seleção de prova (modo avulso e treino)
// ---------------------------------------------------------------------------

export const eventSelectScene = {
    id: 'eventSelect',
    enter(ctx, params) {
        this.ctx = ctx;
        this.mode = params.mode || 'single';
        this.t = 0;
        this.menu = new MenuList(EVENT_ORDER.map((id) => {
            const ev = EVENTS[id];
            const best = ctx.store.getBest(id);
            return {
                label: ev.name,
                value: id,
                hint: `${ev.place} — ${ev.tagline}`,
                best
            };
        }));
    },
    update(dtMs) {
        const ctx = this.ctx;
        this.t += dtMs / 1000;
        const action = this.menu.update(ctx.input, ctx.audio, dtMs);
        if (action === 'back') { ctx.goto(menuScene); return; }
        if (action !== 'confirm') return;
        const id = this.menu.current.value;
        const champ = new Championship(this.mode, ctx.sponsor, ctx.rng, [id]);
        ctx.champ = champ;
        ctx.goto(briefingScene, { eventId: id, champ });
    },
    draw() {
        const { px, font, sprites, scenery, store } = this.ctx;
        const c = px.ctx;
        c.drawImage(scenery.sky, 0, -10);
        drawNeonGrid(c, 168, 56, this.t * 0.4);

        scrim(px, 31, 179);
        screenHeader(px, font, this.mode === 'practice' ? 'TREINO' : 'PROVA ÚNICA', 'ESCOLHA A PROVA');

        this.menu.items.forEach((it, i) => {
            const active = i === this.menu.index;
            const y = 46 + i * 20;
            const ev = EVENTS[it.value];
            if (active) panel(px, 10, y - 4, W - 20, 18, { fill: '2', border: '0', light: ev.tint, dark: '1' });
            font.text(c, ev.name, 22, y, { color: active ? 'A' : 'q', mono: true });
            font.text(c, ev.place, 118, y, { color: 'o', mono: true });
            const best = store.getBest(it.value);
            font.text(c, best.score ? String(best.score).padStart(4, '0') : '----', W - 42, y, {
                color: best.score ? 'r' : 'n', align: 'right', mono: true
            });
            if (best.medal) {
                font.text(c, MEDAL_LABEL[best.medal][0], W - 22, y, {
                    color: MEDAL_COLOR[best.medal], align: 'right', mono: true
                });
            }
        });

        const cur = this.menu.current;
        if (cur) {
            panel(px, 12, 172, W - 24, 30, { fill: '1', border: '0', light: 'n' });
            font.text(c, EVENTS[cur.value].tagline, W / 2, 180, { color: 'p', align: 'center', mono: true });
            font.text(c, EVENTS[cur.value].hint, W / 2, 191, { color: 'o', align: 'center', mono: true });
        }
        screenFooter(px, font, 'Z COMEÇA · X VOLTA');
    }
};

// ---------------------------------------------------------------------------
// Briefing da prova
// ---------------------------------------------------------------------------

export const briefingScene = {
    id: 'briefing',
    enter(ctx, params) {
        this.ctx = ctx;
        this.eventId = params.eventId;
        this.champ = params.champ;
        this.def = EVENTS[this.eventId];
        this.t = 0;
        ctx.audio.playSong(this.def.song);
    },
    update(dtMs) {
        const ctx = this.ctx;
        this.t += dtMs / 1000;
        if (ctx.input.state.a.pressed || ctx.input.state.start.pressed) {
            ctx.audio.play('ui_confirm');
            ctx.goto(playScene, { eventId: this.eventId, champ: this.champ });
        }
        if (ctx.input.state.b.pressed) {
            ctx.audio.play('ui_back');
            ctx.goto(this.champ.mode === 'champ' ? menuScene : eventSelectScene, { mode: this.champ.mode });
        }
    },
    draw() {
        const { px, font, sprites, scenery, store, sponsor } = this.ctx;
        const c = px.ctx;
        c.drawImage(scenery.sky, 0, -16);
        c.drawImage(scenery.skyline, -80, 120);

        scrim(px, 31, 179);
        screenHeader(px, font, this.def.name, this.def.place);

        panel(px, 14, 40, W - 28, 66, { fill: '1', border: '0', light: this.def.tint, accent: this.def.tint });
        this.def.brief.forEach((linha, i) => {
            font.text(c, linha, W / 2, 48 + i * 12, { color: 'q', align: 'center', mono: true });
        });
        if (this.def.judgeNote) {
            font.text(c, this.def.judgeNote, W / 2, 88, { color: 'y', align: 'center', mono: true });
        }

        // controles
        panel(px, 14, 112, W - 28, 24, { fill: '2', border: '0', light: 'n' });
        font.text(c, 'CONTROLES', W / 2, 116, { color: 'o', align: 'center', mono: true });
        font.text(c, this.def.hint, W / 2, 126, { color: 'r', align: 'center', mono: true });

        // recorde pessoal + bônus do patrocinador
        const best = store.getBest(this.eventId);
        panel(px, 14, 142, (W - 34) / 2, 26, { fill: '1', border: '0', light: 'n' });
        font.text(c, 'SEU RECORDE', 20, 146, { color: 'o', mono: true });
        font.text(c, best.score ? String(best.score) : '—', 20, 157, { color: 'A', mono: true });

        panel(px, W / 2 + 3, 142, (W - 34) / 2, 26, { fill: '1', border: '0', light: 'n' });
        const boon = sponsor && sponsor.boon === this.eventId;
        font.text(c, 'PATROCÍNIO', W / 2 + 9, 146, { color: 'o', mono: true });
        font.text(c, sponsor ? (boon ? `${sponsor.name} +12%` : sponsor.name) : 'SEM PATROCÍNIO', W / 2 + 9, 157, {
            color: boon ? 'H' : 'p', mono: true
        });

        if (this.champ.mode === 'champ') {
            font.text(c, `PROVA ${this.champ.progressLabel}`, W / 2, 176, {
                color: 'x', align: 'center', mono: true
            });
        }

        if (Math.floor(this.t * 2) % 2 === 0) {
            font.text(c, 'Z PARA COMEÇAR', W / 2, 192, { color: 'A', align: 'center', mono: true, scale: 1 });
        }
        screenFooter(px, font, 'Z COMEÇA · X VOLTA · ENTER PAUSA DURANTE A PROVA');
    }
};

// ---------------------------------------------------------------------------
// Prova em andamento
// ---------------------------------------------------------------------------

export const playScene = {
    id: 'play',
    enter(ctx, params) {
        this.ctx = ctx;
        this.eventId = params.eventId;
        this.champ = params.champ;
        this.event = createEvent(this.eventId, ctx);
        this.event.practice = this.champ.mode === 'practice';
        ctx.audio.playSong(EVENTS[this.eventId].song);
        ctx.setTouchLayout('FULL');
    },
    update(dtMs) {
        const ctx = this.ctx;
        if (ctx.input.state.start.pressed) {
            ctx.audio.play('pause');
            ctx.pushScene(pauseScene, { eventId: this.eventId });
            return;
        }
        const result = this.event.update(dtMs);
        if (result) {
            const entry = this.champ.mode === 'practice'
                ? { score: result.score, medal: null, place: 0, detail: result.detail, table: [], raw: result.score, boon: 0 }
                : this.champ.submit(this.eventId, result.score, result.detail);
            ctx.goto(resultScene, {
                eventId: this.eventId,
                champ: this.champ,
                entry,
                judges: result.judges
            });
        }
    },
    draw() { this.event.draw(); },
    exit() {
        this.event.exit();
        this.ctx.setTouchLayout(null);
    }
};

// ---------------------------------------------------------------------------
// Pausa (empilhada sobre a prova)
// ---------------------------------------------------------------------------

export const pauseScene = {
    id: 'pause',
    enter(ctx, params) {
        this.ctx = ctx;
        this.eventId = params.eventId;
        this.t = 0;
        this.menu = new MenuList([
            { label: 'CONTINUAR', value: 'resume' },
            { label: 'RECOMEÇAR PROVA', value: 'restart' },
            { label: 'SAIR PARA O MENU', value: 'quit' }
        ]);
    },
    update(dtMs) {
        const ctx = this.ctx;
        this.t += dtMs / 1000;
        if (ctx.input.state.start.pressed) { ctx.audio.play('pause'); ctx.popScene(); return; }
        const action = this.menu.update(ctx.input, ctx.audio, dtMs);
        if (action === 'back') { ctx.popScene(); return; }
        if (action !== 'confirm') return;
        const value = this.menu.current.value;
        if (value === 'resume') ctx.popScene();
        else if (value === 'restart') ctx.restartEvent();
        else ctx.goto(menuScene);
    },
    draw() {
        const { px, font, sprites } = this.ctx;
        const c = px.ctx;
        c.globalAlpha = 0.72;
        px.rect(0, 0, W, H, SVC['0']);
        c.globalAlpha = 1;

        panel(px, 52, 58, W - 104, 112, { fill: '1', border: '0', light: 'A', dark: '1', accent: 'x' });
        font.textBig(c, 'PAUSA', W / 2, 66, {
            scale: 2, ramp: ['h', '8', '7', '6'], outlineColor: '0', align: 'center'
        });
        this.menu.draw(px, font, sprites, W / 2, 100, { lineH: 16, time: this.t, width: 148 });
        // A dica de controles vive DENTRO do painel: fora dele ela caía por cima da mesma
        // linha que a prova já desenha no rodapé, e o texto aparecia duplicado.
        px.rect(60, 152, W - 120, 1, SVC['m']);
        font.text(c, EVENTS[this.eventId].hint, W / 2, 158, {
            color: 'o', align: 'center', mono: true
        });
    }
};

// ---------------------------------------------------------------------------
// Resultado da prova
// ---------------------------------------------------------------------------

export const resultScene = {
    id: 'result',
    enter(ctx, params) {
        this.ctx = ctx;
        this.eventId = params.eventId;
        this.champ = params.champ;
        this.entry = params.entry;
        this.judges = params.judges;
        this.def = EVENTS[this.eventId];
        this.t = 0;
        this.isRecord = false;

        if (this.champ.mode !== 'practice') {
            this.isRecord = ctx.store.submitScore(
                this.eventId, this.entry.score, this.entry.medal, this.entry.detail
            );
        }
        ctx.audio.playSong(this.entry.medal === 'gold' ? 'fanfarra_ouro'
            : this.entry.medal ? 'fanfarra_menor' : 'falha');
        if (this.isRecord) ctx.audio.play('record');
    },
    update(dtMs) {
        const ctx = this.ctx;
        this.t += dtMs / 1000;
        if (this.t < 0.6) return;
        if (ctx.input.state.a.pressed || ctx.input.state.start.pressed) {
            ctx.audio.play('ui_confirm');
            if (this.champ.mode === 'champ') {
                this.champ.advance();
                if (this.champ.isFinished) ctx.goto(podiumScene, { champ: this.champ });
                else ctx.goto(briefingScene, { eventId: this.champ.currentEventId, champ: this.champ });
            } else {
                ctx.goto(eventSelectScene, { mode: this.champ.mode });
            }
        }
        if (ctx.input.state.b.pressed && this.champ.mode !== 'champ') {
            ctx.audio.play('ui_back');
            ctx.goto(menuScene);
        }
    },
    draw() {
        const { px, font, sprites, scenery } = this.ctx;
        const c = px.ctx;
        c.drawImage(scenery.sky, 0, -30);
        drawNeonGrid(c, 176, 48, this.t * 0.3);

        scrim(px, 31, 179);
        screenHeader(px, font, 'RESULTADO', `${this.def.name} · ${this.def.place}`);

        // pontuação com contagem animada
        const shown = Math.round(this.entry.score * clamp(this.t / 0.9, 0, 1));
        font.textBig(c, String(shown).padStart(4, '0'), W / 2, 42, {
            scale: 4, color: 'A', outlineColor: '0', align: 'center'
        });

        if (this.entry.boon > 0) {
            font.text(c, `+${this.entry.boon} DO PATROCINADOR`, W / 2, 80, {
                color: 'H', align: 'center', mono: true
            });
        }
        if (this.entry.detail) {
            font.text(c, this.entry.detail, W / 2, 92, {
                color: 'q', align: 'center', mono: true, outline: '0'
            });
        }

        // medalha
        if (this.entry.medal) {
            const pop = easeOutBack(clamp((this.t - 0.9) / 0.5, 0, 1));
            if (pop > 0) {
                px.blitScreen(sprites.get(`medal_${this.entry.medal}`), 44, 132);
                font.text(c, MEDAL_LABEL[this.entry.medal], 44, 136, {
                    color: MEDAL_COLOR[this.entry.medal], align: 'center', mono: true, outline: '0'
                });
            }
        } else {
            // contorno obrigatório: cinza sobre o pôr do sol do fundo era ilegível
            font.text(c, 'SEM MEDALHA', 44, 128, {
                color: 'p', align: 'center', mono: true, outline: '0'
            });
        }

        if (this.isRecord && Math.floor(this.t * 3) % 2 === 0) {
            font.text(c, 'RECORDE PESSOAL!', W / 2, 106, { color: 'x', align: 'center', mono: true });
        }

        // notas dos jurados nas provas julgadas
        if (this.judges) {
            judgePanel(px, font, this.judges, this.t * 1.4);
        } else if (this.entry.table && this.entry.table.length) {
            // tabela da prova nas provas não julgadas
            const x = 96;
            panel(px, x, 112, W - x - 12, 84, { fill: '1', border: '0', light: 'n' });
            this.entry.table.slice(0, 5).forEach((row, i) => {
                const isPlayer = row.id === 'player';
                const y = 118 + i * 15;
                font.text(c, `${i + 1}º`, x + 6, y, { color: isPlayer ? 'A' : 'o', mono: true });
                font.text(c, row.name, x + 26, y, { color: isPlayer ? 'A' : 'q', mono: true });
                font.text(c, String(row.score), W - 20, y, {
                    color: isPlayer ? 'A' : 'p', align: 'right', mono: true
                });
            });
        }

        screenFooter(px, font, this.champ.mode === 'champ' ? 'Z SEGUE PARA A PRÓXIMA PROVA' : 'Z VOLTA · X MENU');
    }
};

// ---------------------------------------------------------------------------
// Pódio
// ---------------------------------------------------------------------------

const PODIUM_H = [46, 34, 26];

export const podiumScene = {
    id: 'podium',
    enter(ctx, params) {
        this.ctx = ctx;
        this.champ = params.champ;
        this.t = 0;
        this.standings = this.champ.standings();
        this.place = this.champ.playerPlace();
        this.isRecord = ctx.store.submitChampionship({
            total: this.champ.total(),
            place: this.place,
            sponsor: this.champ.sponsor ? this.champ.sponsor.id : null,
            golds: this.champ.goldCount()
        });
        ctx.audio.playSong('podio');
    },
    update(dtMs) {
        const ctx = this.ctx;
        this.t += dtMs / 1000;
        if (this.t < 1) return;
        if (ctx.input.state.a.pressed || ctx.input.state.start.pressed) {
            ctx.audio.play('ui_confirm');
            ctx.goto(menuScene);
        }
    },
    draw() {
        const { px, font, sprites, scenery } = this.ctx;
        const c = px.ctx;
        c.drawImage(scenery.skyNight, 0, 0);
        c.drawImage(scenery.sky, 0, 70);
        drawNeonGrid(c, 150, 74, this.t * 0.2);

        scrim(px, 31, 179, 0.45);
        screenHeader(px, font, 'PÓDIO', 'CAMPEONATO SANTOS VICE GAMES');

        // três degraus
        const order = [1, 0, 2];   // prata, ouro, bronze — da esquerda para a direita
        const baseY = 176;
        order.forEach((rank, slot) => {
            const row = this.standings[rank];
            if (!row) return;
            const x = 66 + slot * 94;
            const h = PODIUM_H[rank];
            const rise = clamp((this.t - 0.4 - slot * 0.25) / 0.5, 0, 1);
            const drawH = Math.round(h * easeOutBack(rise));
            if (drawH <= 0) return;

            px.rect(x - 34, baseY - drawH, 68, drawH, SVC['n']);
            px.rect(x - 34, baseY - drawH, 68, 2, SVC['q']);
            font.text(c, String(rank + 1), x, baseY - drawH + 8, {
                color: MEDAL_COLOR[['gold', 'silver', 'bronze'][rank]], align: 'center', mono: true, scale: 2
            });

            if (rise >= 1) {
                const isPlayer = row.id === 'player';
                px.blitScreen(sprites.get(isPlayer ? 'ballIdle' : `cheer#${rank % 4}`), x, baseY - drawH);
                font.text(c, row.name, x, baseY + 6, {
                    color: isPlayer ? 'A' : 'q', align: 'center', mono: true
                });
                font.text(c, `${row.points} PTS`, x, baseY + 17, {
                    color: 'p', align: 'center', mono: true
                });
            }
        });

        // resumo do jogador
        const summary = this.place === 1 ? 'CAMPEÃO DA ORLA!'
            : this.place <= 3 ? 'PÓDIO GARANTIDO' : 'FICA PRA PRÓXIMA';
        if (this.t > 1.6) {
            font.textBig(c, summary, W / 2, 40, {
                scale: 2, color: this.place === 1 ? 'A' : 'r', outlineColor: '0', align: 'center'
            });
            font.text(c, `${this.place}º LUGAR · ${this.champ.total()} PONTOS · ${this.champ.goldCount()} OURO(S)`,
                W / 2, 62, { color: 'p', align: 'center', mono: true });
            if (this.champ.sponsor) {
                font.text(c, `PATROCÍNIO ${this.champ.sponsor.name}`, W / 2, 74, {
                    color: this.champ.sponsor.kit.shirt, align: 'center', mono: true
                });
            }
            if (this.isRecord && Math.floor(this.t * 3) % 2 === 0) {
                font.text(c, 'MELHOR CAMPANHA!', W / 2, 86, { color: 'x', align: 'center', mono: true });
            }
        }

        screenFooter(px, font, 'Z VOLTA AO MENU');
    }
};

// ---------------------------------------------------------------------------
// Recordes
// ---------------------------------------------------------------------------

export const recordsScene = {
    id: 'records',
    enter(ctx) { this.ctx = ctx; this.t = 0; },
    update(dtMs) {
        const ctx = this.ctx;
        this.t += dtMs / 1000;
        if (ctx.input.state.b.pressed || ctx.input.state.a.pressed || ctx.input.state.start.pressed) {
            ctx.audio.play('ui_back');
            ctx.goto(menuScene);
        }
    },
    draw() {
        const { px, font, sprites, scenery, store } = this.ctx;
        const c = px.ctx;
        c.drawImage(scenery.sky, 0, -20);
        drawNeonGrid(c, 176, 48, this.t * 0.25);

        const medals = store.medalCount();
        scrim(px, 31, 179);
        screenHeader(px, font, 'RECORDES',
            `${medals.gold} OURO · ${medals.silver} PRATA · ${medals.bronze} BRONZE`);

        EVENT_ORDER.forEach((id, i) => {
            const ev = EVENTS[id];
            const best = store.getBest(id);
            const y = 42 + i * 22;
            panel(px, 10, y - 4, W - 20, 20, { fill: '1', border: '0', light: 'n', accent: best.score ? ev.tint : null });
            font.text(c, ev.name, 18, y, { color: best.score ? 'q' : 'n', mono: true });
            font.text(c, best.detail || ev.place, 18, y + 9, { color: 'o', mono: true });
            font.text(c, best.score ? String(best.score).padStart(4, '0') : '----', W - 46, y + 3, {
                color: best.score ? 'A' : 'n', align: 'right', mono: true
            });
            if (best.medal) {
                font.text(c, MEDAL_LABEL[best.medal], W - 16, y + 3, {
                    color: MEDAL_COLOR[best.medal], align: 'right', mono: true
                });
            }
        });

        const champ = store.data.champ;
        panel(px, 10, 178, W - 20, 24, { fill: '2', border: '0', light: 'x', dark: '1' });
        font.text(c, 'MELHOR CAMPANHA', 18, 182, { color: 'o', mono: true });
        font.text(c, champ.best ? `${champ.place}º LUGAR · ${champ.best} PTS · ${champ.golds} OURO(S)` : 'AINDA NÃO DISPUTADA',
            18, 192, { color: champ.best ? 'r' : 'n', mono: true });

        screenFooter(px, font, 'X VOLTA');
    }
};

// ---------------------------------------------------------------------------
// Opções
// ---------------------------------------------------------------------------

export const optionsScene = {
    id: 'options',
    enter(ctx) {
        this.ctx = ctx;
        this.t = 0;
        this.confirmReset = false;
        this.rebuild();
    },
    rebuild() {
        const opts = this.ctx.store.getOpts();
        this.menu = new MenuList([
            { label: `SOM: ${opts.mute ? 'DESLIGADO' : 'LIGADO'}`, value: 'mute', hint: 'Também alterna com a tecla M.' },
            { label: `SCANLINES: ${opts.scanlines ? 'LIGADAS' : 'DESLIGADAS'}`, value: 'scanlines', hint: 'Simula as linhas da TV de tubo.' },
            { label: `TREMOR DE TELA: ${opts.shake ? 'LIGADO' : 'DESLIGADO'}`, value: 'shake', hint: 'Desligue se preferir imagem estável.' },
            {
                label: this.confirmReset ? 'CONFIRMAR? Z APAGA' : 'APAGAR RECORDES',
                value: 'reset',
                hint: 'Zera medalhas, recordes e campanhas.'
            },
            { label: 'VOLTAR', value: 'back' }
        ], { wrap: true });
    },
    update(dtMs) {
        const ctx = this.ctx;
        this.t += dtMs / 1000;
        const keep = this.menu.index;
        const action = this.menu.update(ctx.input, ctx.audio, dtMs);
        if (action === 'back') { ctx.goto(menuScene); return; }
        if (action === 'move' && this.confirmReset) { this.confirmReset = false; this.rebuild(); this.menu.index = keep; }
        if (action !== 'confirm') return;

        const store = ctx.store;
        const opts = store.getOpts();
        switch (this.menu.current.value) {
            case 'mute':
                store.setOpt('mute', !opts.mute);
                ctx.audio.setMute(!opts.mute);
                break;
            case 'scanlines':
                store.setOpt('scanlines', !opts.scanlines);
                ctx.applyOptions();
                break;
            case 'shake':
                store.setOpt('shake', !opts.shake);
                ctx.applyOptions();
                break;
            case 'reset':
                if (this.confirmReset) {
                    store.reset();
                    ctx.applyOptions();
                    this.confirmReset = false;
                    ctx.audio.play('ui_back');
                } else {
                    this.confirmReset = true;
                }
                break;
            case 'back':
                ctx.goto(menuScene);
                return;
            default: break;
        }
        const idx = this.menu.index;
        this.rebuild();
        this.menu.index = idx;
    },
    draw() {
        const { px, font, sprites, scenery } = this.ctx;
        const c = px.ctx;
        c.drawImage(scenery.sky, 0, -10);
        drawNeonGrid(c, 172, 52, this.t * 0.3);
        scrim(px, 31, 179);
        screenHeader(px, font, 'OPÇÕES', 'AJUSTES DO GABINETE');
        this.menu.draw(px, font, sprites, W / 2, 66, { lineH: 20, time: this.t, hintY: 178 });
        screenFooter(px, font, 'Z CONFIRMA · X VOLTA');
    }
};
