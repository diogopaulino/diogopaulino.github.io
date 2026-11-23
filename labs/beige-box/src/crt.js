/**
 * Sistema operacional do CRT — canvas 640×480 usado como textura do monitor.
 * Estados: off → boot (BIOS) → dos → win (Nexus 95) → saver.
 *
 * Desempenho: o canvas só é repintado quando algo muda (`dirty`) e no máximo a
 * 30 fps enquanto há animação (boot, protetor de tela, cursor piscando). O
 * main.js só sobe a textura para a GPU quando draw() devolve true — antes eram
 * 640×480×4 bytes enviados a cada quadro, mesmo com a tela parada.
 *
 * Nexus 95 tem um gerenciador de janelas de verdade: arrastar pela barra de
 * título, minimizar para a barra de tarefas, fechar, foco/ordem por clique e
 * menu Iniciar. As janelas nunca saem da tela (ver _clampWindow).
 */

const W = 640;
const H = 480;
const TITLE_H = 22;
const TASKBAR_H = 28;
const FRAME_MIN = 1 / 30; // intervalo mínimo entre repinturas animadas (s)

const GREEN = '#7CFF9A';
const AMBER = '#FFBF66';
const WHITE = '#E8E4D8';

export class CrtOs {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.canvas.width = W;
        this.canvas.height = H;
        this.ctx = this.canvas.getContext('2d');
        this.power = false;
        this.mode = 'off';
        this.bootT = 0;
        this.lines = [];
        this.input = '';
        this.cursor = 0;
        this.windows = [];
        this.stars = [];
        this.idle = 0;
        this.mem = 0;
        this.floppy = null;
        this.dirty = true;
        this.clock = '';
        this.toast = '';
        this.toastT = 0;
        this.startOpen = false;
        this.mouse = null; // {x, y} em px do CRT, ou null quando o ponteiro saiu da tela
        this.drag = null;
        this._sinceDraw = 1;
        this._caretOn = true;
        this._nextId = 1;
        this._overlay = this._buildOverlay();
        this._initStars();
    }

    _initStars() {
        this.stars = Array.from({ length: 90 }, () => ({
            x: Math.random() * 2 - 1,
            y: Math.random() * 2 - 1,
            z: Math.random()
        }));
    }

    /** Scanlines + vinheta pré-renderizadas uma vez (antes eram ~120 fillRect por quadro). */
    _buildOverlay() {
        const c = document.createElement('canvas');
        c.width = W;
        c.height = H;
        const ctx = c.getContext('2d');
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 2);
        const g = ctx.createRadialGradient(W / 2, H / 2, 80, W / 2, H / 2, 380);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, 'rgba(0,0,0,0.28)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        return c;
    }

    powerOn() {
        if (this.power) return;
        this.power = true;
        this.mode = 'boot';
        this.bootT = 0;
        this.mem = 0;
        this.lines = [];
        this.input = '';
        this.idle = 0;
        this.startOpen = false;
        this.dirty = true;
    }

    powerOff() {
        this.power = false;
        this.mode = 'off';
        this.windows = [];
        this.startOpen = false;
        this.drag = null;
        this.dirty = true;
    }

    togglePower() {
        if (this.power) this.powerOff();
        else this.powerOn();
        return this.power;
    }

    /** Pula a BIOS (atalhos rápidos e o botão de teclado no celular). */
    skipBoot() {
        if (this.mode !== 'boot') return;
        this.bootT = 4;
        this.update(0.01);
    }

    insertFloppy(label) {
        this.floppy = label;
        if (this.mode === 'dos') {
            this.lines.push(`A: drive ready — ${label}`);
            this._trim();
        }
        this._toast(`Disco: ${label}`, 2.4);
    }

    ejectFloppy() {
        this.floppy = null;
        this.dirty = true;
    }

    _toast(text, secs = 1.8) {
        this.toast = text;
        this.toastT = secs;
        this.dirty = true;
    }

    type(ch) {
        if (!this.power) return;
        this.idle = 0;
        if (this.mode === 'boot') {
            this.skipBoot();
            return;
        }
        if (this.mode === 'saver') {
            this.mode = 'win';
            this.dirty = true;
            return;
        }
        if (this.mode === 'dos') {
            if (ch === 'Enter') {
                this.lines.push(`C:\\>${this.input}`);
                this._run(this.input.trim());
                this.input = '';
            } else if (ch === 'Backspace') {
                this.input = this.input.slice(0, -1);
            } else if (ch.length === 1 && this.input.length < 60) {
                this.input += ch;
            }
            this._caretOn = true;
            this.cursor = 0;
            this.dirty = true;
        } else if (this.mode === 'win') {
            const top = this._top();
            if (top && top.kind === 'notepad' && !top.min) {
                if (ch === 'Backspace') top.body = top.body.slice(0, -1);
                else if (ch === 'Enter') top.body += '\n';
                else if (ch.length === 1 && top.body.length < 400) top.body += ch;
                this.dirty = true;
            }
        }
    }

    /* ------------------------------------------------------------ ponteiro -- */

    _px(u, v) {
        return { x: u * W, y: (1 - v) * H };
    }

    /** Ponteiro sobre a tela (hover). Desenha o cursor do Nexus 95. */
    hover(u, v) {
        if (u === null) {
            if (this.mouse) {
                this.mouse = null;
                this.dirty = this.mode === 'win';
            }
            return;
        }
        const p = this._px(u, v);
        // Mexer o mouse acorda o protetor de tela e adia o próximo.
        this.idle = 0;
        if (this.mode === 'saver') {
            this.mode = 'win';
            this.dirty = true;
        }
        if (!this.mouse || Math.abs(this.mouse.x - p.x) > 0.5 || Math.abs(this.mouse.y - p.y) > 0.5) {
            this.mouse = p;
            if (this.mode === 'win') this.dirty = true;
        }
    }

    /**
     * Começo de um gesto na tela. Devolve true quando agarrou a barra de título
     * de uma janela — o main.js então desliga a órbita da câmera até o pointerup.
     */
    pointerDown(u, v) {
        if (!this.power || this.mode !== 'win') return false;
        const { x, y } = this._px(u, v);
        const hit = this._hitWindow(x, y);
        if (!hit) return false;
        const { win, index } = hit;
        this._raise(index);
        if (y < win.y + TITLE_H && x < win.x + win.w - 44) {
            this.drag = { win, ox: x - win.x, oy: y - win.y };
            return true;
        }
        return false;
    }

    pointerMove(u, v) {
        if (!this.drag) return;
        const { x, y } = this._px(u, v);
        const win = this.drag.win;
        win.x = x - this.drag.ox;
        win.y = y - this.drag.oy;
        this._clampWindow(win);
        this.mouse = { x, y };
        this.dirty = true;
    }

    pointerUp() {
        if (!this.drag) return;
        this.drag = null;
        this.dirty = true;
    }

    /** Garante que a barra de título fica alcançável (nunca perde a janela). */
    _clampWindow(win) {
        const grab = 48;
        win.x = Math.max(-(win.w - grab), Math.min(W - grab, win.x));
        win.y = Math.max(0, Math.min(H - TASKBAR_H - TITLE_H, win.y));
    }

    _top() {
        for (let i = this.windows.length - 1; i >= 0; i--) {
            if (!this.windows[i].min) return this.windows[i];
        }
        return null;
    }

    _raise(index) {
        const [win] = this.windows.splice(index, 1);
        win.min = false;
        this.windows.push(win);
        this.dirty = true;
    }

    _hitWindow(x, y) {
        for (let i = this.windows.length - 1; i >= 0; i--) {
            const win = this.windows[i];
            if (win.min) continue;
            if (x >= win.x && y >= win.y && x <= win.x + win.w && y <= win.y + win.h) return { win, index: i };
        }
        return null;
    }

    _taskButtons() {
        const out = [];
        let x = 74;
        for (const win of this.windows) {
            const w = 110;
            if (x + w > W - 78) break;
            out.push({ win, x, y: H - 24, w, h: 20 });
            x += w + 4;
        }
        return out;
    }

    _startItems() {
        const items = [
            { id: 'computer', label: 'Meu Computador' },
            { id: 'notepad', label: 'Bloco de Notas' },
            { id: 'solitaire', label: 'Paciência' },
            { id: 'floppy', label: 'Disco A:' },
            { id: 'dos', label: 'Prompt do MS-DOS' },
            { id: 'off', label: 'Desligar…' }
        ];
        const h = 24;
        const menuH = items.length * h + 8;
        const top = H - TASKBAR_H - menuH;
        return items.map((it, i) => ({ ...it, x: 2, y: top + 4 + i * h, w: 180, h, top, menuH }));
    }

    click(u, v) {
        if (!this.power) return 'none';
        this.idle = 0;
        const { x, y } = this._px(u, v);
        if (this.mode === 'boot') {
            this.skipBoot();
            return 'skip';
        }
        if (this.mode === 'saver') {
            this.mode = 'win';
            this.dirty = true;
            return 'wake';
        }
        if (this.mode !== 'win') return 'none';
        this.dirty = true;

        // Menu Iniciar aberto tem prioridade.
        if (this.startOpen) {
            const items = this._startItems();
            const it = items.find((i) => x >= i.x && x <= i.x + i.w && y >= i.y && y < i.y + i.h);
            this.startOpen = false;
            if (it) {
                if (it.id === 'off') {
                    this.mode = 'dos';
                    this.windows = [];
                    this.lines.push('Agora é seguro desligar o computador.');
                    this.lines.push('(ou digite WIN para voltar)');
                    this._trim();
                    return 'shutdown';
                }
                if (it.id === 'dos') {
                    this.mode = 'dos';
                    return 'dos';
                }
                this._open(it.id);
                return 'start-item';
            }
            if (y > H - TASKBAR_H && x < 70) return 'start';
        }

        // Barra de tarefas
        if (y > H - TASKBAR_H) {
            if (x < 70) {
                this.startOpen = !this.startOpen;
                return 'start';
            }
            const btn = this._taskButtons().find((b) => x >= b.x && x <= b.x + b.w);
            if (btn) {
                const idx = this.windows.indexOf(btn.win);
                if (!btn.win.min && this._top() === btn.win) btn.win.min = true;
                else this._raise(idx);
                return 'task';
            }
            return 'taskbar';
        }

        const hit = this._hitWindow(x, y);
        if (hit) {
            const { win, index } = hit;
            if (y < win.y + TITLE_H) {
                // [_] minimizar · [×] fechar — alvos de 20×18 no canto da barra.
                if (x > win.x + win.w - 22) {
                    this.windows.splice(index, 1);
                    return 'close';
                }
                if (x > win.x + win.w - 44) {
                    win.min = true;
                    return 'min';
                }
            }
            if (win.kind === 'solitaire' && y > win.y + 28) {
                this._flipSolitaire(win);
                return 'card';
            }
            this._raise(index);
            return 'window';
        }

        for (const ic of this._icons()) {
            if (x >= ic.x && x <= ic.x + 64 && y >= ic.y && y <= ic.y + 78) {
                this._open(ic.id);
                return 'icon';
            }
        }
        return 'desktop';
    }

    _icons() {
        return [
            { id: 'computer', x: 18, y: 18, label: 'Meu PC' },
            { id: 'floppy', x: 18, y: 110, label: 'Disco A:' },
            { id: 'recycle', x: 18, y: 202, label: 'Lixeira' },
            { id: 'solitaire', x: 18, y: 294, label: 'Paciência' },
            { id: 'notepad', x: 98, y: 18, label: 'Bloco' }
        ];
    }

    _open(id) {
        const existing = this.windows.findIndex((w) => w.kind === id);
        if (existing >= 0) {
            this._raise(existing);
            return;
        }
        const n = this.windows.length;
        const at = (x, y) => ({ x: x + n * 14, y: y + n * 12 });
        let win = null;
        if (id === 'computer') {
            win = {
                kind: id, title: 'Meu Computador', ...at(120, 60), w: 360, h: 220,
                body: 'C:\\  PACKET-BELL 486DX2\nD:\\  CD-ROM\nA:\\  ' + (this.floppy || '(vazio)')
            };
        } else if (id === 'floppy') {
            win = {
                kind: id, title: 'Disco de 3½ (A:)', ...at(150, 80), w: 320, h: 200,
                body: this.floppy
                    ? `${this.floppy}\n\nAUTOEXEC.BAT\nSECRET.COM\nREADME.TXT\nDOOM.BAT`
                    : 'Não há disco na unidade A:\n\nInsira um disquete na torre.'
            };
        } else if (id === 'recycle') {
            win = {
                kind: id, title: 'Lixeira', ...at(180, 110), w: 280, h: 180,
                body: 'WIN386.SWP\nThumbs.db\ncarta-nunca-enviada.doc'
            };
        } else if (id === 'solitaire') {
            win = { kind: id, title: 'Paciência', ...at(110, 50), w: 400, h: 300, cards: this._deal() };
        } else if (id === 'notepad') {
            win = {
                kind: id, title: 'Bloco de notas — LEMBRETE.TXT', ...at(140, 70), w: 340, h: 240,
                body: 'ligar o CRT\ninserir o disquete SECRET\ndigitar WIN no DOS\n\n(a lâmpada muda a cena)\n'
            };
        }
        if (!win) return;
        win.id = this._nextId++;
        win.min = false;
        this._clampWindow(win);
        this.windows.push(win);
        this.dirty = true;
    }

    _deal() {
        const suits = ['♥', '♦', '♣', '♠'];
        const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
        const deck = [];
        for (const s of suits) for (const r of ranks) deck.push({ s, r, up: false });
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        return deck.slice(0, 7).map((c, i) => ({ ...c, up: i === 6 }));
    }

    _flipSolitaire(win) {
        const hidden = win.cards.filter((c) => !c.up);
        if (hidden.length) hidden[0].up = true;
        else win.cards = this._deal();
        this.dirty = true;
    }

    _run(cmd) {
        const c = cmd.toLowerCase();
        if (!c) return;
        if (c === 'help') {
            this.lines.push('CLS  DIR  VER  DATE  WIN  A:  TYPE  SECRET  DOOM');
        } else if (c === 'cls') {
            this.lines = [];
        } else if (c === 'dir') {
            this.lines.push('AUTOEXEC.BAT   412  08-14-94');
            this.lines.push('COMMAND.COM   54645  05-31-94');
            this.lines.push('WIN.COM        9014  07-11-94');
            if (this.floppy) this.lines.push(`A:\\${this.floppy.replace(/\s+/g, '_')}.COM`);
        } else if (c === 'ver') {
            this.lines.push('PACKET BELL MS-DOS 6.22');
        } else if (c === 'date') {
            this.lines.push(new Date().toLocaleString('pt-BR'));
        } else if (c === 'win') {
            this.mode = 'win';
            this.startOpen = false;
        } else if (c === 'a:' || c === 'a') {
            this.lines.push(this.floppy ? `A:\\>  ${this.floppy}` : 'Not ready reading drive A');
        } else if (c === 'secret' || c === 'secret.com') {
            if (this.floppy && /secret/i.test(this.floppy)) {
                this.lines.push('*** ACESSO CONCEDIDO ***');
                this.lines.push('O poster da banda esconde a senha.');
                this.mode = 'win';
                this._open('notepad');
            } else {
                this.lines.push('Bad command or file name');
            }
        } else if (c.startsWith('type')) {
            this.lines.push('@echo off');
            this.lines.push('lh mouse.com');
            this.lines.push('win');
        } else if (c === 'doom' || c === 'doom.bat') {
            this.lines.push(this.floppy ? 'loading WAD…  (use o joystick)' : 'insert GAME DISK');
        } else {
            this.lines.push('Bad command or file name');
        }
        this._trim();
    }

    _trim() {
        while (this.lines.length > 16) this.lines.shift();
    }

    update(dt) {
        this.cursor += dt;
        this.idle += dt;
        this._sinceDraw += dt;
        if (this.toastT > 0) {
            this.toastT -= dt;
            if (this.toastT <= 0) this.dirty = true;
        }
        if (!this.power) return;

        if (this.mode === 'boot') {
            this.bootT += dt;
            this.mem = Math.min(640, this.mem + dt * 420);
            if (this.bootT > 3.6) {
                this.mode = 'dos';
                this.lines = [
                    'PACKET BELL BIOS v4.94',
                    '486DX2-66  ·  16MB RAM  ·  540MB HDD',
                    this.floppy ? `Floppy A: ${this.floppy}` : 'Floppy A: none',
                    '',
                    'Starting MS-DOS...',
                    ''
                ];
            }
            this.dirty = true;
        }

        if (this.mode === 'dos') {
            const on = (this.cursor % 1.1) < 0.55;
            if (on !== this._caretOn) {
                this._caretOn = on;
                this.dirty = true;
            }
        }

        if (this.mode === 'win') {
            // Cursor do Bloco de Notas pisca: só repinta quando o estado vira.
            const top = this._top();
            const blink = Boolean(top && top.kind === 'notepad') && this.cursor % 1.1 < 0.7;
            if (blink !== this._caretOn) {
                this._caretOn = blink;
                this.dirty = true;
            }
        }

        if (this.mode === 'win' && this.idle > 25 && !this.drag) {
            this.mode = 'saver';
            this.startOpen = false;
            this.dirty = true;
        }
        if (this.mode === 'saver') {
            for (const s of this.stars) {
                s.z -= dt * 0.35;
                if (s.z <= 0) {
                    s.x = Math.random() * 2 - 1;
                    s.y = Math.random() * 2 - 1;
                    s.z = 1;
                }
            }
            this.dirty = true;
        }

        const now = new Date();
        const clock = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        if (clock !== this.clock) {
            this.clock = clock;
            if (this.mode === 'win') this.dirty = true;
        }
    }

    /**
     * Repinta se necessário. Devolve true quando o canvas mudou (o chamador
     * então marca a textura para upload).
     */
    draw() {
        if (!this.dirty) return false;
        // Animações contínuas (boot/saver) limitadas a 30 fps; interação é imediata.
        const animating = this.mode === 'boot' || this.mode === 'saver';
        if (animating && this._sinceDraw < FRAME_MIN) return false;
        this.dirty = false;
        this._sinceDraw = 0;

        const ctx = this.ctx;
        ctx.fillStyle = '#020804';
        ctx.fillRect(0, 0, W, H);

        if (!this.power) {
            ctx.fillStyle = '#050806';
            ctx.fillRect(0, 0, W, H);
            ctx.drawImage(this._overlay, 0, 0);
            return true;
        }

        if (this.mode === 'boot') this._drawBoot(ctx);
        else if (this.mode === 'dos') this._drawDos(ctx);
        else if (this.mode === 'win') this._drawWin(ctx);
        else if (this.mode === 'saver') this._drawSaver(ctx);

        ctx.drawImage(this._overlay, 0, 0);
        return true;
    }

    _drawBoot(ctx) {
        ctx.fillStyle = GREEN;
        ctx.font = '16px monospace';
        ctx.fillText('AMBERTRON AWARD BIOS v4.94', 24, 36);
        ctx.fillText('Copyright (C) 1992-94 Packet Bell Inc.', 24, 58);
        ctx.fillText(`Memory Test : ${this.mem | 0}K OK`, 24, 100);
        ctx.fillText('Detecting IDE Primary Master ...  WDC AC2540H', 24, 130);
        ctx.fillText('Detecting IDE Primary Slave  ...  None', 24, 152);
        ctx.fillText(this.floppy ? `Floppy  3.5"  1.44MB  [${this.floppy}]` : 'Floppy  3.5"  1.44MB  [none]', 24, 184);
        if (this.bootT > 1.6) ctx.fillText('Press DEL to enter SETUP · qualquer tecla pula', 24, 430);
        const bar = Math.min(1, this.bootT / 3.4);
        ctx.strokeStyle = GREEN;
        ctx.strokeRect(24, 220, 400, 16);
        ctx.fillRect(24, 220, 400 * bar, 16);
    }

    _drawDos(ctx) {
        ctx.fillStyle = GREEN;
        ctx.font = '15px monospace';
        let y = 28;
        for (const line of this.lines) {
            ctx.fillText(line, 16, y);
            y += 20;
        }
        const caret = this._caretOn ? '_' : ' ';
        ctx.fillText(`C:\\>${this.input}${caret}`, 16, y);
    }

    _drawWin(ctx) {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#00807c');
        g.addColorStop(1, '#004c4a');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        for (const ic of this._icons()) this._icon(ctx, ic);

        const top = this._top();
        for (const win of this.windows) {
            if (!win.min) this._window(ctx, win, win === top);
        }

        this._taskbar(ctx, top);
        if (this.startOpen) this._startMenu(ctx);

        if (this.toastT > 0) {
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.fillRect(W / 2 - 140, 40, 280, 28);
            ctx.fillStyle = AMBER;
            ctx.font = '13px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(this.toast, W / 2, 59);
            ctx.textAlign = 'left';
        }

        if (this.mouse) this._cursor(ctx, this.mouse.x, this.mouse.y);
    }

    _bevel(ctx, x, y, w, h, pressed) {
        ctx.fillStyle = '#c0c0c0';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = pressed ? '#808080' : '#ffffff';
        ctx.fillRect(x, y, w, 1);
        ctx.fillRect(x, y, 1, h);
        ctx.fillStyle = pressed ? '#ffffff' : '#404040';
        ctx.fillRect(x, y + h - 1, w, 1);
        ctx.fillRect(x + w - 1, y, 1, h);
    }

    _taskbar(ctx, top) {
        ctx.fillStyle = '#c0c0c0';
        ctx.fillRect(0, H - TASKBAR_H, W, TASKBAR_H);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, H - TASKBAR_H, W, 1);
        this._bevel(ctx, 4, H - 24, 64, 20, this.startOpen);
        ctx.fillStyle = '#000';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText('Iniciar', 16, H - 10);

        ctx.font = '11px sans-serif';
        for (const b of this._taskButtons()) {
            const active = b.win === top && !b.win.min;
            this._bevel(ctx, b.x, b.y, b.w, b.h, active);
            ctx.fillStyle = b.win.min ? '#555' : '#000';
            ctx.save();
            ctx.beginPath();
            ctx.rect(b.x + 4, b.y, b.w - 8, b.h);
            ctx.clip();
            ctx.fillText(b.win.title, b.x + 6, b.y + 14);
            ctx.restore();
        }

        this._bevel(ctx, W - 72, H - 24, 68, 20, true);
        ctx.fillStyle = '#000';
        ctx.font = '12px monospace';
        ctx.fillText(this.clock, W - 62, H - 10);
    }

    _startMenu(ctx) {
        const items = this._startItems();
        const { top, menuH } = items[0];
        this._bevel(ctx, 0, top, 184, menuH, false);
        ctx.fillStyle = '#000080';
        ctx.fillRect(3, top + 3, 18, menuH - 6);
        ctx.font = '12px sans-serif';
        for (const it of items) {
            const hot = this.mouse && this.mouse.x >= it.x && this.mouse.x <= it.x + it.w && this.mouse.y >= it.y && this.mouse.y < it.y + it.h;
            if (hot) {
                ctx.fillStyle = '#000080';
                ctx.fillRect(24, it.y, 156, it.h);
            }
            ctx.fillStyle = hot ? '#fff' : '#000';
            ctx.fillText(it.label, 32, it.y + 16);
        }
    }

    _icon(ctx, ic) {
        ctx.fillStyle = '#e8e0c8';
        ctx.fillRect(ic.x + 12, ic.y + 4, 36, 32);
        ctx.fillStyle = '#3a5aaa';
        ctx.fillRect(ic.x + 16, ic.y + 8, 28, 20);
        if (ic.id === 'floppy') {
            ctx.fillStyle = '#222';
            ctx.fillRect(ic.x + 20, ic.y + 22, 20, 8);
        }
        if (ic.id === 'recycle') {
            ctx.strokeStyle = '#2a8a4a';
            ctx.strokeRect(ic.x + 18, ic.y + 10, 24, 20);
        }
        ctx.fillStyle = WHITE;
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(ic.label, ic.x + 30, ic.y + 52);
        ctx.textAlign = 'left';
    }

    _window(ctx, win, focused) {
        this._bevel(ctx, win.x, win.y, win.w, win.h, false);
        const tg = ctx.createLinearGradient(win.x, 0, win.x + win.w, 0);
        tg.addColorStop(0, focused ? '#000080' : '#808080');
        tg.addColorStop(1, focused ? '#1084d0' : '#b0b0b0');
        ctx.fillStyle = tg;
        ctx.fillRect(win.x + 3, win.y + 3, win.w - 6, TITLE_H - 4);
        ctx.fillStyle = WHITE;
        ctx.font = 'bold 12px sans-serif';
        ctx.save();
        ctx.beginPath();
        ctx.rect(win.x + 4, win.y, win.w - 54, TITLE_H);
        ctx.clip();
        ctx.fillText(win.title, win.x + 8, win.y + 16);
        ctx.restore();

        // Botões [_] e [×]
        this._bevel(ctx, win.x + win.w - 42, win.y + 4, 18, 15, false);
        this._bevel(ctx, win.x + win.w - 21, win.y + 4, 18, 15, false);
        ctx.fillStyle = '#000';
        ctx.fillRect(win.x + win.w - 37, win.y + 14, 8, 2);
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText('×', win.x + win.w - 16, win.y + 16);

        if (win.kind === 'solitaire') {
            ctx.fillStyle = '#107030';
            ctx.fillRect(win.x + 4, win.y + 24, win.w - 8, win.h - 28);
            win.cards.forEach((c, i) => {
                const cx = win.x + 24 + i * 50;
                const cy = win.y + 50;
                ctx.fillStyle = c.up ? '#f4f0e4' : '#3a5aaa';
                ctx.fillRect(cx, cy, 42, 58);
                if (c.up) {
                    ctx.fillStyle = (c.s === '♥' || c.s === '♦') ? '#c02020' : '#111';
                    ctx.font = '12px sans-serif';
                    ctx.fillText(c.r + c.s, cx + 4, cy + 16);
                }
            });
            ctx.fillStyle = '#e8f0e0';
            ctx.font = '11px sans-serif';
            ctx.fillText('clique na mesa para virar uma carta', win.x + 24, win.y + win.h - 16);
        } else {
            ctx.fillStyle = '#fff';
            ctx.fillRect(win.x + 6, win.y + 28, win.w - 12, win.h - 36);
            ctx.fillStyle = '#111';
            ctx.font = '13px monospace';
            const lines = (win.body || '').split('\n');
            const maxLines = Math.floor((win.h - 44) / 18);
            const start = Math.max(0, lines.length - maxLines);
            for (let i = start; i < lines.length; i++) {
                ctx.fillText(lines[i], win.x + 14, win.y + 48 + (i - start) * 18);
            }
            if (win.kind === 'notepad' && focused && this._caretOn) {
                const last = lines[lines.length - 1] || '';
                const cx = win.x + 14 + ctx.measureText(last).width;
                ctx.fillRect(cx + 1, win.y + 36 + (lines.length - 1 - start) * 18, 1, 15);
            }
        }
    }

    /** Seta clássica de 11×17 px. */
    _cursor(ctx, x, y) {
        ctx.save();
        ctx.translate(Math.round(x), Math.round(y));
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, 16);
        ctx.lineTo(4, 12);
        ctx.lineTo(7, 18);
        ctx.lineTo(9, 17);
        ctx.lineTo(6, 11);
        ctx.lineTo(11, 11);
        ctx.closePath();
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
    }

    _drawSaver(ctx) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = '#7dff9a';
        for (const s of this.stars) {
            const sx = (s.x / s.z) * 280 + W / 2;
            const sy = (s.y / s.z) * 210 + H / 2;
            const p = 1 - s.z;
            ctx.globalAlpha = Math.min(1, 0.3 + p);
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx + s.x * 8 * p, sy + s.y * 8 * p);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = AMBER;
        ctx.font = '14px monospace';
        ctx.fillText('STARFIELD.SCR  — clique para voltar', 24, H - 24);
    }

    /** Cor média aproximada da tela, para a luz que o CRT joga na mesa (sem alocar). */
    averageColor() {
        if (!this.power) return COLOR_OFF;
        if (this.mode === 'win') return COLOR_WIN;
        return COLOR_TEXT;
    }
}

const COLOR_OFF = Object.freeze({ r: 0.02, g: 0.03, b: 0.02 });
const COLOR_TEXT = Object.freeze({ r: 0.12, g: 0.55, b: 0.22 });
const COLOR_WIN = Object.freeze({ r: 0.08, g: 0.42, b: 0.4 });
