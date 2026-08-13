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
import { EVENTS, EVENT_ORDER, SPONSORS, MEDAL_LABEL, MEDAL_COLOR, KID_PICK } from './config.js';
import { Championship } from './championship.js';
import { MenuList, screenHeader, screenFooter, scrim } from './menu.js';
import { panel, judgePanel } from './hud.js';
import { drawNeonGrid } from '../art/scenery.js';
import { createEvent } from '../events/index.js';
import { tapped, consumeTap, hitGrid, drawBeachLife, drawSparkles, Confetti } from './kids.js';

// ---------------------------------------------------------------------------
// Título
// ---------------------------------------------------------------------------

export const titleScene = {
    id: 'title',
    enter(ctx) {
        this.ctx = ctx;
        this.t = 0;
        this.ctx.audio.playSong('tema');
        if (!ctx.sponsor) ctx.setSponsor(SPONSORS[0]);
    },
    update(dtMs) {
        const ctx = this.ctx;
        this.t += dtMs / 1000;
        if (tapped(ctx.input)) {
            consumeTap(ctx.input);
            ctx.audio.play('ui_confirm');
            ctx.goto(eventSelectScene, { mode: 'single' });
        }
    },
    draw() {
        const { px, font, sprites, scenery } = this.ctx;
        const c = px.ctx;

        drawBeachLife(px, sprites, scenery, this.t, {
            skyY: 0, morro: true, seaY: 118, skylineY: 88, walkers: false
        });
        drawNeonGrid(c, 148, 76, this.t);

        const bob = Math.sin(this.t * 2.2) * 3;
        font.textBig(c, 'SANTOS', W / 2, 16 + bob, {
            scale: 4, ramp: ['h', '8', '7', '6'], outlineColor: '0', align: 'center'
        });
        font.textBig(c, 'GAMES', W / 2, 50 + bob, {
            scale: 4, ramp: ['P', 'd', 'c', 'b', 'a'], outlineColor: '0', align: 'center'
        });

        drawSparkles(px, sprites, W / 2, 44, this.t, 6);

        if (Math.floor(this.t * 2.4) % 2 === 0) {
            font.text(c, 'TOQUE PARA BRINCAR', W / 2, 96, {
                color: 'A', align: 'center', mono: true, scale: 2, outline: '0'
            });
        }

        const bounce = Math.abs(Math.sin(this.t * 4)) * 16;
        px.blitScreen(sprites.get('ballIdle'), W / 2 - 36, 178);
        px.blitScreen(sprites.get(`cheer#${Math.floor(this.t * 3) % 4}`), W / 2 + 44, 178);
        px.blitScreen(sprites.get('ballBig'), W / 2 - 36, 148 - bounce);
        if (sprites.has('crab#0')) {
            px.blitScreen(sprites.anim('crab', this.t, 6), ((this.t * 28) % (W + 20)) - 8, 208);
        }
        font.text(c, 'PRAIA DE SANTOS', W / 2, 214, {
            color: '0', align: 'center', mono: true, outline: 'h'
        });
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
            case 'champ':
                ctx.setSponsor(ctx.sponsor || SPONSORS[0]);
                ctx.champ = new Championship('champ', ctx.sponsor, ctx.rng, EVENT_ORDER);
                ctx.goto(briefingScene, { eventId: ctx.champ.currentEventId, champ: ctx.champ });
                break;
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
        screenHeader(px, font, 'SANTOS GAMES', 'MENU PRINCIPAL');
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

const PICK_POSE = {
    surf: 'surfCarve', skate: 'skateAir', altinha: 'ballKick',
    bmx: 'bikeAir', frescobol: 'racketSwing', canoa: 'rowPull'
};
const PICK_PROP = {
    surf: 'board', skate: 'deck', altinha: 'ballBig',
    bmx: 'bike', frescobol: 'racket', canoa: 'canoe'
};

function startPickedEvent(ctx, mode, eventIds) {
    if (!ctx.sponsor) ctx.setSponsor(SPONSORS.find((s) => s.boon === eventIds[0]) || SPONSORS[0]);
    else if (eventIds.length === 1) {
        const sp = SPONSORS.find((s) => s.boon === eventIds[0]);
        if (sp) ctx.setSponsor(sp);
    }
    const champ = new Championship(mode, ctx.sponsor, ctx.rng, eventIds);
    ctx.champ = champ;
    ctx.goto(briefingScene, { eventId: champ.currentEventId, champ });
}

export const eventSelectScene = {
    id: 'eventSelect',
    enter(ctx, params) {
        this.ctx = ctx;
        this.mode = params.mode || 'single';
        this.t = 0;
        this.index = 0;
        this.cols = 3;
        this.cellW = 100;
        this.cellH = 72;
        this.x0 = (W - this.cols * this.cellW) / 2;
        this.y0 = 36;
        if (!ctx.sponsor) ctx.setSponsor(SPONSORS[0]);
    },
    update(dtMs) {
        const ctx = this.ctx;
        this.t += dtMs / 1000;
        const { input, audio } = ctx;
        const n = EVENT_ORDER.length + 1; // + JOGAR TUDO

        const hover = hitGrid(input.pointer.x, input.pointer.y, this.x0, this.y0, this.cols, 2, this.cellW, this.cellH);
        if (hover >= 0 && hover < 6 && hover !== this.index) {
            this.index = hover;
            audio.play('ui_move');
        }
        if (input.pointer.y > 178 && input.pointer.y < 204 && this.index !== 6) {
            this.index = 6;
            audio.play('ui_move');
        }

        if (input.state.left.pressed) { this.index = (this.index + n - 1) % n; audio.play('ui_move'); }
        if (input.state.right.pressed) { this.index = (this.index + 1) % n; audio.play('ui_move'); }
        if (input.state.up.pressed && this.index >= 3) { this.index -= 3; audio.play('ui_move'); }
        if (input.state.down.pressed && this.index < 3) { this.index += 3; audio.play('ui_move'); }
        if (input.state.b.pressed) { audio.play('ui_back'); ctx.goto(titleScene); return; }

        if (tapped(input)) {
            consumeTap(input);
            audio.play('ui_confirm');
            if (this.index === 6) startPickedEvent(ctx, 'champ', EVENT_ORDER);
            else startPickedEvent(ctx, this.mode, [EVENT_ORDER[this.index]]);
        }
    },
    draw() {
        const { px, font, sprites, scenery } = this.ctx;
        const c = px.ctx;
        c.drawImage(scenery.sky, 0, -8);
        drawNeonGrid(c, 170, 54, this.t * 0.5);
        for (let i = 0; i < 3; i++) {
            px.blitScreen(sprites.anim('gull', this.t + i, 5),
                ((this.t * (10 + i * 4) + i * 80) % (W + 40)) - 20, 18 + i * 8);
        }

        scrim(px, 28, 196, 0.55);
        screenHeader(px, font, 'ESCOLHA', 'TOQUE NO DESENHO');

        EVENT_ORDER.forEach((id, i) => {
            const ev = EVENTS[id];
            const kid = KID_PICK[id];
            const cx = Math.round(this.x0 + (i % this.cols) * this.cellW + this.cellW / 2);
            const cy = this.y0 + Math.floor(i / this.cols) * this.cellH;
            const active = i === this.index;
            const bounce = active ? Math.round(Math.sin(this.t * 8) * 3) : 0;
            panel(px, cx - 46, cy - 2, 92, 66, {
                fill: active ? '2' : '1',
                border: '0',
                light: active ? 'A' : 'n',
                dark: '0',
                accent: ev.tint
            });
            const pose = PICK_POSE[id];
            px.blitScreen(sprites.get(pose), cx, cy + 44 + bounce);
            const prop = PICK_PROP[id];
            if (sprites.has(prop) && id !== 'canoa') {
                px.blitScreen(sprites.get(prop), cx + 16, cy + 48 + bounce);
            }
            font.text(c, kid.label, cx, cy + 4, {
                color: active ? 'A' : 'r', align: 'center', mono: true, outline: '0'
            });
        });

        const allOn = this.index === 6;
        panel(px, 24, 180, W - 48, 22, {
            fill: allOn ? '2' : '1', border: '0', light: allOn ? 'A' : 'n', accent: 'x'
        });
        font.text(c, allOn ? '★  JOGAR TUDO  ★' : 'JOGAR TUDO', W / 2, 186, {
            color: allOn ? 'A' : 'q', align: 'center', mono: true
        });
    }
};

export const briefingScene = {
    id: 'briefing',
    enter(ctx, params) {
        this.ctx = ctx;
        this.eventId = params.eventId;
        this.champ = params.champ;
        this.def = EVENTS[this.eventId];
        this.t = 0;
        ctx.audio.playSong(this.def.song);
        const sp = SPONSORS.find((s) => s.boon === this.eventId);
        if (sp && this.champ.mode !== 'champ') ctx.setSponsor(sp);
    },
    update(dtMs) {
        const ctx = this.ctx;
        this.t += dtMs / 1000;
        if (this.t > 0.35 && tapped(ctx.input)) {
            consumeTap(ctx.input);
            ctx.audio.play('ui_confirm');
            ctx.goto(playScene, { eventId: this.eventId, champ: this.champ });
        }
        if (this.t > 1.6) {
            ctx.goto(playScene, { eventId: this.eventId, champ: this.champ });
        }
        if (ctx.input.state.b.pressed) {
            ctx.audio.play('ui_back');
            ctx.goto(eventSelectScene, { mode: this.champ.mode === 'champ' ? 'single' : this.champ.mode });
        }
    },
    draw() {
        const { px, font, sprites, scenery } = this.ctx;
        const c = px.ctx;
        c.drawImage(scenery.sky, 0, -10);
        c.drawImage(scenery.skyline, -60, 100);
        drawSparkles(px, sprites, W / 2, 70, this.t, 7);

        scrim(px, 40, 150, 0.5);
        font.textBig(c, KID_PICK[this.eventId]?.label || this.def.name, W / 2, 48, {
            scale: 3, ramp: ['h', '8', '7'], outlineColor: '0', align: 'center'
        });
        font.text(c, this.def.hint, W / 2, 88, {
            color: 'A', align: 'center', mono: true, scale: 2, outline: '0'
        });

        const pose = PICK_POSE[this.eventId];
        const bob = Math.round(Math.sin(this.t * 8) * 4);
        px.blitScreen(sprites.get(pose), W / 2, 168 + bob, { scale: 1.4 });

        if (Math.floor(this.t * 3) % 2 === 0) {
            font.text(c, 'TOQUE!', W / 2, 196, { color: 'A', align: 'center', mono: true, scale: 2, outline: '0' });
        }
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
        ctx.setTouchLayout('PLAY');
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
            { label: 'DE NOVO', value: 'restart' },
            { label: 'OUTRO JOGO', value: 'quit' }
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
        else ctx.goto(eventSelectScene, { mode: 'single' });
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
        this.confetti = new Confetti();
        this.confetti.burst(W / 2, 90, 36);

        if (this.champ.mode !== 'practice') {
            this.isRecord = ctx.store.submitScore(
                this.eventId, this.entry.score, this.entry.medal, this.entry.detail
            );
        }
        ctx.audio.playSong(this.entry.medal === 'gold' ? 'fanfarra_ouro'
            : this.entry.medal ? 'fanfarra_menor' : 'fanfarra_menor');
        if (this.isRecord) ctx.audio.play('record');
        ctx.audio.play('coin');
    },
    update(dtMs) {
        const ctx = this.ctx;
        this.t += dtMs / 1000;
        this.confetti.update(dtMs / 1000);
        if (this.t > 0.8 && Math.random() < 0.08) this.confetti.burst(40 + Math.random() * 240, 50, 6);
        if (this.t < 0.55) return;
        if (tapped(ctx.input)) {
            consumeTap(ctx.input);
            ctx.audio.play('ui_confirm');
            if (this.champ.mode === 'champ') {
                this.champ.advance();
                if (this.champ.isFinished) ctx.goto(podiumScene, { champ: this.champ });
                else ctx.goto(briefingScene, { eventId: this.champ.currentEventId, champ: this.champ });
            } else {
                // criança ama repetir: toque joga a mesma prova de novo
                startPickedEvent(ctx, this.champ.mode, [this.eventId]);
            }
        }
        if (ctx.input.state.b.pressed) {
            ctx.audio.play('ui_back');
            ctx.goto(eventSelectScene, { mode: this.champ.mode === 'champ' ? 'single' : this.champ.mode });
        }
    },
    draw() {
        const { px, font, sprites, scenery } = this.ctx;
        const c = px.ctx;
        c.drawImage(scenery.sky, 0, -20);
        drawNeonGrid(c, 168, 56, this.t * 0.4);
        this.confetti.draw(px);

        const wow = this.entry.medal === 'gold' ? 'UAU!'
            : this.entry.medal ? 'BOA!' : 'LEGAL!';
        font.textBig(c, wow, W / 2, 28, {
            scale: 4, ramp: ['h', '8', 'A', 'x'], outlineColor: '0', align: 'center'
        });

        const shown = Math.round(this.entry.score * clamp(this.t / 0.7, 0, 1));
        font.text(c, String(shown), W / 2, 72, {
            color: 'A', align: 'center', mono: true, scale: 2, outline: '0'
        });

        if (this.entry.medal) {
            px.blitScreen(sprites.get(`medal_${this.entry.medal}`), W / 2, 118, { scale: 1.6 });
            font.text(c, MEDAL_LABEL[this.entry.medal], W / 2, 128, {
                color: MEDAL_COLOR[this.entry.medal], align: 'center', mono: true, scale: 2, outline: '0'
            });
        } else {
            px.blitScreen(sprites.get('star'), W / 2 - 16, 110);
            px.blitScreen(sprites.get('star'), W / 2 + 16, 110);
        }

        const pose = this.entry.medal ? 'ballHead' : 'ballIdle';
        const bob = Math.round(Math.abs(Math.sin(this.t * 6)) * 8);
        px.blitScreen(sprites.get(pose), W / 2, 188 - bob);
        if (sprites.has('heart')) {
            px.blitScreen(sprites.get('heart'), W / 2 - 28, 150 - bob);
            px.blitScreen(sprites.get('heart'), W / 2 + 28, 154 - bob);
        }

        if (Math.floor(this.t * 2.2) % 2 === 0) {
            font.text(c, this.champ.mode === 'champ' ? 'TOQUE: PROXIMO' : 'TOQUE: DE NOVO', W / 2, 210, {
                color: 'A', align: 'center', mono: true, scale: 2, outline: '0'
            });
        }
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
        if (this.t < 0.8) return;
        if (tapped(ctx.input)) {
            consumeTap(ctx.input);
            ctx.audio.play('ui_confirm');
            ctx.goto(eventSelectScene, { mode: 'single' });
        }
    },
    draw() {
        const { px, font, sprites, scenery } = this.ctx;
        const c = px.ctx;
        c.drawImage(scenery.skyNight, 0, 0);
        c.drawImage(scenery.sky, 0, 70);
        drawNeonGrid(c, 150, 74, this.t * 0.2);

        scrim(px, 31, 179, 0.45);
        screenHeader(px, font, 'PÓDIO', 'CAMPEONATO SANTOS GAMES');

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
            { label: `SCANLINES: ${opts.scanlines ? 'LIGADAS' : 'DESLIGADAS'}`, value: 'scanlines', hint: 'Opcional. Desligado = visual limpo de emulador.' },
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
