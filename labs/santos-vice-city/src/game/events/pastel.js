// events/pastel.js — Delivery de Pastel no Gonzaga (top-down, integridade do pastel).
// Teto: ~450 linhas.

const ORDERS = [
    '1 QUEIJO + CALDO DE CANA SEM GELO',
    '3 DE CARNE (O DE PALMITO É PRA MÃE)',
    'CAMARÃO PRO 1204, O PORTEIRO SUMIU',
    '2 FRANGO COM CATUPIRY, RÁPIDO!',
    'PASTEL DE PALMITO, SEM PIMENTA'
];

const CITY = [
    '################',
    '#..............#',
    '#.####..####...#',
    '#.####..####...#',
    '#..............#',
    '################',
    '#..............#',
    '#.####..####...#',
    '#.####..####...#',
    '#..............#',
    '################'
];

export default {
    id: 'pastel',
    name: 'DELIVERY DE PASTEL',
    region: 'Gonzaga',
    blurb: ['Entrega rápido, mas com cuidado.', 'Se bater demais o pastel some.'],
    touch: 'FULL',
    keys: [['↑↓←→', 'dirigir'], ['A', 'acelerar'], ['B', 'freio/derrapagem']],
    duration: 45,
    music: 'corrida',
    medals: { bronze: 2200, prata: 4800, ouro: 8000, platina: 12000 },

    init(app, api) {
        this.state = {
            score: 0, time: 0, timeLeft: 45,
            x: 160, y: 112, heading: 0, speed: 0,
            integrity: 1, deliveries: 0, streak: 0,
            markerX: 0, markerY: 0, order: '',
            obstacles: [], finished: false
        };
        this.rng = api.rng;
        this.api = api;
        this._newDelivery();
        this._spawnObstacles();
    },

    _newDelivery() {
        const s = this.state;
        s.markerX = this.rng.range(40, 280);
        s.markerY = this.rng.range(40, 180);
        s.order = this.rng.pick(ORDERS);
    },

    _spawnObstacles() {
        const s = this.state;
        s.obstacles = [];
        for (let i = 0; i < 5; i++) {
            s.obstacles.push({
                x: this.rng.range(40, 280), y: this.rng.range(40, 180), type: 'pothole'
            });
        }
    },

    update(dt, input, api) {
        const s = this.state;
        if (s.finished) return;
        s.time += dt;
        s.timeLeft -= dt;

        let turn = 0;
        if (input.state.left.down) turn -= 1;
        if (input.state.right.down) turn += 1;
        s.heading += turn * 180 * dt;

        const accel = input.state.a.down ? 90 : -60;
        s.speed = Math.max(0, Math.min(90, s.speed + accel * dt));
        if (input.state.b.down) s.speed = Math.max(0, s.speed - 150 * dt);

        const rad = s.heading * Math.PI / 180;
        s.x += Math.sin(rad) * s.speed * dt;
        s.y -= Math.cos(rad) * s.speed * dt;
        s.x = Math.max(10, Math.min(310, s.x));
        s.y = Math.max(10, Math.min(214, s.y));

        for (const o of s.obstacles) {
            const dx = s.x - o.x, dy = s.y - o.y;
            if (dx * dx + dy * dy < 100 && s.speed > 20) {
                s.integrity = Math.max(0, s.integrity - 0.15);
                s.speed *= 0.5;
                api.popup && api.popup(s.x, s.y, 'LOMBADA!', 'B');
                api.shake && api.shake(4, 150);
                o.x = this.rng.range(40, 280);
                o.y = this.rng.range(40, 180);
            }
        }

        s.integrity = Math.min(1, s.integrity + 0.01 * dt);

        const dx = s.x - s.markerX, dy = s.y - s.markerY;
        if (dx * dx + dy * dy < 100) {
            const timeBonus = Math.max(0, s.timeLeft * 10);
            const integrityBonus = s.integrity * 300;
            let points = 500 + timeBonus + integrityBonus;
            if (s.integrity > 0.6) { s.streak++; points *= Math.min(2, 1 + s.streak * 0.15); }
            else s.streak = 0;
            s.score += Math.floor(points);
            s.deliveries++;
            s.timeLeft += 18;
            api.popup && api.popup(s.x, s.y - 10, '+' + Math.floor(points), 'A');
            this._newDelivery();
        }

        if (s.timeLeft <= 0) {
            s.finished = true;
            api.popup && api.popup(160, 100, 'O CLIENTE PEDIU REEMBOLSO.', 'B');
            api.finish('time');
        }
    },

    draw(px, api) {
        const s = this.state;
        px.ctx.fillStyle = '#6b7386';
        px.ctx.fillRect(0, 0, 320, 224);

        const tileW = 320 / CITY[0].length, tileH = 224 / CITY.length;
        for (let ty = 0; ty < CITY.length; ty++) {
            for (let tx = 0; tx < CITY[ty].length; tx++) {
                if (CITY[ty][tx] === '#') {
                    px.ctx.fillStyle = '#454a5c';
                    px.ctx.fillRect(tx * tileW, ty * tileH, tileW, tileH);
                }
            }
        }

        px.ctx.fillStyle = '#ffe600';
        px.ctx.beginPath();
        px.ctx.arc(s.markerX, s.markerY, 6, 0, Math.PI * 2);
        px.ctx.fill();

        for (const o of s.obstacles) {
            const sp = api.sprites.has('pothole') ? api.sprites.get('pothole') : null;
            if (sp) px.blitScreen(sp, o.x, o.y);
        }

        px.ctx.save();
        px.ctx.translate(s.x, s.y);
        px.ctx.rotate(s.heading * Math.PI / 180);
        const sp = api.sprites.has('scooter') ? api.sprites.get('scooter') : null;
        if (sp) px.ctx.drawImage(sp.atlas, sp.x, sp.y, sp.w, sp.h, -sp.ox, -sp.oy, sp.w, sp.h);
        px.ctx.restore();
    },

    hud(px, api) {
        const s = this.state;
        api.font && api.font.text(px.ctx, s.order, 160, 214, { align: 'center', color: 'q', mono: false });

        px.ctx.fillStyle = 'rgba(0,0,0,0.4)';
        px.ctx.fillRect(220, 8, 90, 6);
        px.ctx.fillStyle = s.integrity > 0.5 ? '#7ed36a' : '#e03a2f';
        px.ctx.fillRect(220, 8, 90 * s.integrity, 6);
    },

    score() { return Math.floor(this.state.score); },

    summary() {
        const s = this.state;
        return [
            { label: 'Entregas', value: s.deliveries },
            { label: 'Integridade final', value: Math.round(s.integrity * 100) + '%' }
        ];
    }
};
