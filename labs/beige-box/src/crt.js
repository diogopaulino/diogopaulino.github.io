/**
 * Sistema operacional do CRT — canvas 640×480 pintado a cada quadro.
 * Estados: off → boot (BIOS) → dos → win (Nexus 95) → saver.
 */

const W = 640;
const H = 480;

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
        this.solitaire = null;
        this.toast = '';
        this.toastT = 0;
        this.scan = 0;
        this._initStars();
    }

    _initStars() {
        this.stars = Array.from({ length: 90 }, () => ({
            x: Math.random() * 2 - 1,
            y: Math.random() * 2 - 1,
            z: Math.random()
        }));
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
        this.dirty = true;
    }

    powerOff() {
        this.power = false;
        this.mode = 'off';
        this.windows = [];
        this.dirty = true;
    }

    togglePower() {
        if (this.power) this.powerOff();
        else this.powerOn();
        return this.power;
    }

    insertFloppy(label) {
        this.floppy = label;
        if (this.mode === 'dos') {
            this.lines.push(`A: drive ready — ${label}`);
            this._trim();
        }
        this.toast = `Disco: ${label}`;
        this.toastT = 2.4;
        this.dirty = true;
    }

    ejectFloppy() {
        this.floppy = null;
        this.dirty = true;
    }

    type(ch) {
        if (!this.power) return;
        this.idle = 0;
        if (this.mode === 'dos') {
            if (ch === 'Enter') {
                this.lines.push(`C:\\>${this.input}`);
                this._run(this.input.trim());
                this.input = '';
            } else if (ch === 'Backspace') {
                this.input = this.input.slice(0, -1);
            } else if (ch.length === 1) {
                this.input += ch;
            }
            this.dirty = true;
        } else if (this.mode === 'win' && this.windows.some((w) => w.kind === 'notepad')) {
            const note = this.windows.find((w) => w.kind === 'notepad');
            if (ch === 'Backspace') note.body = note.body.slice(0, -1);
            else if (ch.length === 1) note.body += ch;
            this.dirty = true;
        }
    }

    click(u, v) {
        if (!this.power) return 'none';
        this.idle = 0;
        const x = u * W;
        const y = (1 - v) * H;
        if (this.mode === 'saver') {
            this.mode = 'win';
            this.dirty = true;
            return 'wake';
        }
        if (this.mode !== 'win') return 'none';

        for (let i = this.windows.length - 1; i >= 0; i--) {
            const win = this.windows[i];
            if (x < win.x || y < win.y || x > win.x + win.w || y > win.y + win.h) continue;
            if (y < win.y + 22 && x > win.x + win.w - 22) {
                this.windows.splice(i, 1);
                this.dirty = true;
                return 'close';
            }
            if (win.kind === 'solitaire' && y > win.y + 28) {
                this._flipSolitaire(win);
                return 'card';
            }
            this.windows.push(this.windows.splice(i, 1)[0]);
            this.dirty = true;
            return 'window';
        }

        const icons = this._icons();
        for (const ic of icons) {
            if (x >= ic.x && x <= ic.x + 64 && y >= ic.y && y <= ic.y + 78) {
                this._open(ic.id);
                return 'icon';
            }
        }
        if (y > H - 28 && x < 72) {
            this._open('start');
            return 'start';
        }
        this.dirty = true;
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
        if (this.windows.some((w) => w.kind === id)) {
            this.dirty = true;
            return;
        }
        if (id === 'computer') {
            this.windows.push({
                kind: id, title: 'Meu Computador', x: 120, y: 70, w: 360, h: 220,
                body: 'C:\\  PACKET-BELL 486DX2\nD:\\  CD-ROM\nA:\\  ' + (this.floppy || '(vazio)')
            });
        } else if (id === 'floppy') {
            this.windows.push({
                kind: id, title: 'Disco de 3½ (A:)', x: 150, y: 90, w: 320, h: 200,
                body: this.floppy
                    ? `${this.floppy}\n\nAUTOEXEC.BAT\nSECRET.COM\nREADME.TXT\nDOOM.BAT`
                    : 'Não há disco na unidade A:\n\nInsira um disquete na torre.'
            });
        } else if (id === 'recycle') {
            this.windows.push({
                kind: id, title: 'Lixeira', x: 180, y: 120, w: 280, h: 180,
                body: 'WIN386.SWP\nThumbs.db\ncarta-nunca-enviada.doc'
            });
        } else if (id === 'solitaire') {
            this.windows.push({
                kind: id, title: 'Paciência', x: 110, y: 60, w: 400, h: 300,
                cards: this._deal()
            });
        } else if (id === 'notepad') {
            this.windows.push({
                kind: id, title: 'Bloco de notas — LEMBRETE.TXT', x: 140, y: 80, w: 340, h: 240,
                body: 'ligar o CRT\ninserir o disquete SECRET\ndigitar WIN no DOS\n\n(a lâmpada muda a cena)'
            });
        } else if (id === 'start') {
            this.toast = 'Iniciar · Programas · Desligar';
            this.toastT = 1.8;
        }
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
            this.lines.push('CLS  DIR  VER  DATE  WIN  A:  TYPE  SECRET');
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
            this.windows = [];
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
        } else if (c.startsWith('type ')) {
            this.lines.push('echo off');
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
        this.scan += dt;
        this.idle += dt;
        if (this.toastT > 0) this.toastT -= dt;
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

        if (this.mode === 'win' && this.idle > 18) {
            this.mode = 'saver';
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
        this.clock = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }

    draw() {
        const ctx = this.ctx;
        ctx.fillStyle = '#020804';
        ctx.fillRect(0, 0, W, H);

        if (!this.power) {
            ctx.fillStyle = '#050806';
            ctx.fillRect(0, 0, W, H);
            this._vignette(ctx, 0.55);
            return this.canvas;
        }

        if (this.mode === 'boot') this._drawBoot(ctx);
        else if (this.mode === 'dos') this._drawDos(ctx);
        else if (this.mode === 'win') this._drawWin(ctx);
        else if (this.mode === 'saver') this._drawSaver(ctx);

        this._scanlines(ctx);
        this._vignette(ctx, 0.28);
        return this.canvas;
    }

    _drawBoot(ctx) {
        ctx.fillStyle = GREEN;
        ctx.font = '16px monospace';
        ctx.fillText('AMBERTRON AWARD BIOS v4.94', 24, 36);
        ctx.fillText('Copyright (C) 1992-94 Packet Bell Inc.', 24, 58);
        ctx.fillText(`Memory Test : ${this.mem | 0}K OK`, 24, 100);
        ctx.fillText('Detecting IDE Primary Master ...  WDC AC2540H', 24, 130);
        ctx.fillText('Detecting IDE Primary Slave  ...  None', 24, 152);
        ctx.fillText(this.floppy ? `Floppy  3.5\"  1.44MB  [${this.floppy}]` : 'Floppy  3.5"  1.44MB  [none]', 24, 184);
        if (this.bootT > 1.6) ctx.fillText('Press DEL to enter SETUP', 24, 430);
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
        const caret = (this.cursor % 1.1) < 0.55 ? '_' : ' ';
        ctx.fillText(`C:\\>${this.input}${caret}`, 16, y);
    }

    _drawWin(ctx) {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#00807c');
        g.addColorStop(1, '#004c4a');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        for (const ic of this._icons()) {
            this._icon(ctx, ic);
        }

        for (const win of this.windows) this._window(ctx, win);

        ctx.fillStyle = '#c0c0c0';
        ctx.fillRect(0, H - 28, W, 28);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, H - 28, W, 1);
        ctx.fillStyle = '#000080';
        ctx.fillRect(4, H - 24, 64, 20);
        ctx.fillStyle = WHITE;
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText('Iniciar', 16, H - 10);
        ctx.fillStyle = '#000';
        ctx.font = '12px monospace';
        ctx.fillText(this.clock, W - 70, H - 10);

        if (this.toastT > 0) {
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.fillRect(W / 2 - 140, 40, 280, 28);
            ctx.fillStyle = AMBER;
            ctx.font = '13px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(this.toast, W / 2, 59);
            ctx.textAlign = 'left';
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

    _window(ctx, win) {
        ctx.fillStyle = '#c0c0c0';
        ctx.fillRect(win.x, win.y, win.w, win.h);
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(win.x, win.y, win.w, win.h);
        ctx.fillStyle = '#000080';
        ctx.fillRect(win.x + 2, win.y + 2, win.w - 4, 20);
        ctx.fillStyle = WHITE;
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText(win.title, win.x + 8, win.y + 16);
        ctx.fillStyle = '#c0c0c0';
        ctx.fillRect(win.x + win.w - 20, win.y + 4, 16, 16);
        ctx.fillStyle = '#000';
        ctx.fillText('×', win.x + win.w - 17, win.y + 16);

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
        } else {
            ctx.fillStyle = '#fff';
            ctx.fillRect(win.x + 6, win.y + 28, win.w - 12, win.h - 36);
            ctx.fillStyle = '#111';
            ctx.font = '13px monospace';
            const body = win.body || '';
            body.split('\n').forEach((line, i) => {
                ctx.fillText(line, win.x + 14, win.y + 48 + i * 18);
            });
        }
    }

    _drawSaver(ctx) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = '#7dff9a';
        for (const s of this.stars) {
            const sx = (s.x / s.z) * 280 + W / 2;
            const sy = (s.y / s.z) * 210 + H / 2;
            const p = 1 - s.z;
            ctx.globalAlpha = 0.3 + p;
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

    _scanlines(ctx) {
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        const off = (this.scan * 18) % 4;
        for (let y = off; y < H; y += 4) ctx.fillRect(0, y, W, 2);
        ctx.fillStyle = `rgba(255,255,220,${0.03 + Math.sin(this.scan * 7) * 0.015})`;
        ctx.fillRect(0, 0, W, H);
    }

    _vignette(ctx, amt) {
        const g = ctx.createRadialGradient(W / 2, H / 2, 80, W / 2, H / 2, 380);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, `rgba(0,0,0,${amt})`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
    }

    averageColor() {
        if (!this.power) return { r: 0.02, g: 0.03, b: 0.02 };
        if (this.mode === 'boot' || this.mode === 'dos' || this.mode === 'saver') {
            return { r: 0.12, g: 0.55, b: 0.22 };
        }
        return { r: 0.08, g: 0.42, b: 0.4 };
    }
}
