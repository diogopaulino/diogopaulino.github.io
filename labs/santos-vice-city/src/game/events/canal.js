// events/canal.js — Puçá no Canal 3 (arremesso + timing, ecoponto).
// Teto: ~360 linhas.

const ITEM_TYPES = [
    { type: 'chinelo', value: 10, weight: 4 },
    { type: 'bola', value: 40, weight: 3 },
    { type: 'peixe', value: 60, weight: 2 },
    { type: 'siri', value: 80, weight: 1 },
    { type: 'trash', value: 0, weight: 3 },
    { type: 'capivara', value: 300, weight: 1, uncatchable: true }
];

function weightedPick(rng) {
    const total = ITEM_TYPES.reduce((s, t) => s + t.weight, 0);
    let r = rng.next() * total;
    for (const t of ITEM_TYPES) {
        r -= t.weight;
        if (r <= 0) return t;
    }
    return ITEM_TYPES[0];
}

export default {
    id: 'canal',
    name: 'PUÇÁ NO CANAL 3',
    region: 'Canais',
    blurb: ['Pesca no canal com o puçá.', 'Chinelos valem pontos, lixo não.'],
    touch: 'LR',
    keys: [['←→', 'andar'], ['A', 'arremesso'], ['B', 'recolher']],
    duration: 80,
    music: 'agua',
    medals: { bronze: 900, prata: 2000, ouro: 3400, platina: 5000 },

    init(app, api) {
        this.state = {
            score: 0, time: 0, x: 160,
            netOut: false, netCharge: 0, netX: 160, netY: 60,
            items: [], spawnTimer: 0.5,
            trashCount: 0, chinelosStreak: 0, ecoMeter: 0, ecoActive: 0
        };
        this.rng = api.rng;
        this.api = api;
    },

    update(dt, input, api) {
        const s = this.state;
        s.time += dt;

        if (input.state.left.down) s.x = Math.max(30, s.x - 60 * dt);
        if (input.state.right.down) s.x = Math.min(290, s.x + 60 * dt);

        if (input.state.a.down && !s.netOut) {
            s.netCharge = Math.min(1, s.netCharge + dt * 1.5);
        }
        if (input.state.a.released && !s.netOut) {
            s.netOut = true;
            s.netX = s.x;
            s.netY = 60 + (1 - s.netCharge) * 60;
            s.netCharge = 0;
        }
        if (s.netOut && input.state.b.pressed) {
            s.netOut = false;
        }

        s.spawnTimer -= dt;
        if (s.spawnTimer <= 0) {
            const lane = this.rng.int(0, 2);
            const def = weightedPick(this.rng);
            s.items.push({
                x: -20, y: 50 + lane * 30, lane,
                speed: 30 + lane * 15, def, caught: false
            });
            s.spawnTimer = this.rng.range(0.6, 1.1);
        }

        s.items = s.items.filter(item => {
            item.x += item.speed * dt;
            if (item.x > 340) return false;

            if (s.netOut && !item.def.uncatchable &&
                Math.abs(item.x - s.netX) < 12 && Math.abs(item.y - s.netY) < 10) {
                item.caught = true;
                s.netOut = false;
                if (item.def.type === 'trash') {
                    s.trashCount++;
                    s.ecoMeter = Math.min(1, s.ecoMeter + 0.25);
                    api.popup && api.popup(item.x, item.y, 'LIXO', 'o');
                } else {
                    const mult = s.ecoActive > 0 ? 2 : 1;
                    s.score += item.def.value * mult;
                    if (item.def.type === 'chinelo') {
                        s.chinelosStreak++;
                        if (s.chinelosStreak === 3) {
                            api.popup && api.popup(item.x, item.y, 'COLEÇÃO DE CHINELOS +200', 'A');
                            s.score += 200;
                        }
                    } else {
                        s.chinelosStreak = 0;
                    }
                    api.popup && api.popup(item.x, item.y, '+' + item.def.value * mult, 'A');
                }
                return false;
            }
            return true;
        });

        if (s.ecoMeter >= 1 && s.ecoActive <= 0) {
            s.ecoActive = 8;
            s.ecoMeter = 0;
            api.popup && api.popup(160, 40, 'ECO ATIVO! x2', 'H');
        }
        if (s.ecoActive > 0) s.ecoActive -= dt;

        if (s.trashCount >= 6) {
            s.trashCount = 0;
            api.popup && api.popup(160, 60, 'O PUÇÁ FUROU.', 'B');
        }

        if (s.time >= api.duration) api.finish('time');
    },

    draw(px, api) {
        const s = this.state;
        px.ctx.fillStyle = '#12607f';
        px.ctx.fillRect(0, 0, 320, 224);
        px.ctx.fillStyle = '#0b3d5c';
        px.ctx.fillRect(0, 40, 320, 80);
        px.ctx.fillStyle = '#b98a52';
        px.ctx.fillRect(0, 120, 320, 104);

        for (const item of s.items) {
            const sp = api.sprites.has(item.def.type) ? api.sprites.get(item.def.type) : null;
            if (sp) px.blitScreen(sp, item.x, item.y);
        }

        if (s.netOut) {
            px.ctx.strokeStyle = '#f2f4fb';
            px.ctx.beginPath();
            px.ctx.moveTo(s.x, 170);
            px.ctx.lineTo(s.netX, s.netY);
            px.ctx.stroke();
            px.ctx.strokeStyle = '#cdd3e0';
            px.ctx.strokeRect(s.netX - 6, s.netY - 6, 12, 12);
        }

        const angler = api.sprites.has('angler') ? api.sprites.get('angler') : null;
        if (angler) px.blitScreen(angler, s.x, 170);

        if (s.netCharge > 0) {
            px.ctx.fillStyle = 'rgba(0,0,0,0.4)';
            px.ctx.fillRect(s.x - 15, 178, 30, 4);
            px.ctx.fillStyle = '#ffe600';
            px.ctx.fillRect(s.x - 15, 178, 30 * s.netCharge, 4);
        }
    },

    hud(px, api) {
        const s = this.state;
        px.ctx.fillStyle = 'rgba(0,0,0,0.4)';
        px.ctx.fillRect(220, 8, 90, 6);
        px.ctx.fillStyle = s.ecoActive > 0 ? '#7ed36a' : '#37a04f';
        px.ctx.fillRect(220, 8, 90 * s.ecoMeter, 6);
    },

    score() { return this.state.score; },

    summary() {
        const s = this.state;
        return [
            { label: 'Streak chinelos', value: s.chinelosStreak },
            { label: 'Eco ativado', value: s.ecoActive > 0 ? 'sim' : 'não' }
        ];
    }
};
