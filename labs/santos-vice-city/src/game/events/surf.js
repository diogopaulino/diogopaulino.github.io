// events/surf.js — Quebra-Mar Surf (carve na onda + aéreos + tubo).
// Teto: ~400 linhas.

function waveHeight(x, t) {
    return 100
        + Math.sin(x * 0.02 + t * 1.2) * 20
        + Math.sin(x * 0.05 - t * 0.8) * 10
        + Math.sin(x * 0.011 + t * 0.4) * 15;
}

export default {
    id: 'surf',
    name: 'QUEBRA-MAR SURF',
    region: 'Ponta da Praia',
    blurb: ['Ondas boas hoje.', 'Pega o pico antes da espuma pegar você.'],
    touch: 'LR',
    keys: [['←→', 'carve'], ['A', 'pulo/aéreo'], ['B', 'tubo/grab']],
    duration: 75,
    music: 'praia',
    medals: { bronze: 1500, prata: 3200, ouro: 5200, platina: 7500 },

    init(app, api) {
        this.state = {
            score: 0, time: 0, waveX: 0,
            airborne: false, airTime: 0, rotation: 0, grabbed: false,
            wipeouts: 0, comboMult: 1, lastLandT: -999,
            finished: false
        };
        this.rng = api.rng;
        this.api = api;
    },

    update(dt, input, api) {
        const s = this.state;
        if (s.finished) return;
        s.time += dt;
        s.waveX += 40 * dt;

        if (s.airborne) {
            s.airTime += dt;
            if (input.state.left.down) s.rotation -= 220 * dt;
            if (input.state.right.down) s.rotation += 220 * dt;
            if (input.state.b.pressed) s.grabbed = true;

            if (s.airTime > 0.5 + this.rng.range(0, 0.3)) {
                s.airborne = false;
                const normalizedRot = Math.abs(s.rotation) % 360;
                const closestMultiple = Math.round(normalizedRot / 180) * 180;
                const diff = Math.abs(normalizedRot - closestMultiple);

                if (diff <= 35) {
                    let trickScore = (closestMultiple || 180) * 2;
                    if (s.grabbed) trickScore *= 1.3;
                    const chainedRecently = (s.time - s.lastLandT) < 1.5;
                    if (chainedRecently) s.comboMult = Math.min(3, s.comboMult * 1.2);
                    else s.comboMult = 1;
                    s.score += Math.floor(trickScore * s.comboMult);
                    api.popup && api.popup(110, 100, 'AÉREO ' + Math.round(closestMultiple || 180) + '°', 'A');
                } else {
                    s.wipeouts++;
                    s.comboMult = 1;
                    api.popup && api.popup(110, 100, 'CAIU DA PRANCHA', 'B');
                    api.shake && api.shake(6, 200);
                    if (s.wipeouts >= 3) { s.finished = true; api.finish('wipeout'); return; }
                }
                s.lastLandT = s.time;
                s.rotation = 0;
                s.grabbed = false;
            }
        } else {
            if (input.state.a.pressed) {
                s.airborne = true;
                s.airTime = 0;
                s.rotation = 0;
                s.grabbed = false;
                api.popup && api.popup(110, 100, '!', 'y');
            }
            if (input.state.left.down) s.waveX -= 20 * dt;
            if (input.state.right.down) s.waveX += 20 * dt;
            s.score += 2 * dt;
        }

        if (s.time >= api.duration) { s.finished = true; api.finish('time'); }
    },

    draw(px, api) {
        const s = this.state;
        px.ctx.fillStyle = '#0b3d5c';
        px.ctx.fillRect(0, 0, 320, 224);

        px.ctx.strokeStyle = '#3fb8c4';
        px.ctx.beginPath();
        for (let x = 0; x <= 320; x += 4) {
            const y = waveHeight(x + s.waveX, s.time);
            if (x === 0) px.ctx.moveTo(x, y); else px.ctx.lineTo(x, y);
        }
        px.ctx.stroke();
        px.ctx.fillStyle = '#12607f';
        px.ctx.beginPath();
        px.ctx.moveTo(0, 224);
        for (let x = 0; x <= 320; x += 4) {
            px.ctx.lineTo(x, waveHeight(x + s.waveX, s.time));
        }
        px.ctx.lineTo(320, 224);
        px.ctx.fill();

        const surferY = s.airborne ? waveHeight(110 + s.waveX, s.time) - 30 - Math.sin(s.airTime * 6) * 10 : waveHeight(110 + s.waveX, s.time) - 6;
        const frame = api.sprites.frameCount ? Math.floor(s.time * 4) % 2 : 0;
        const sp = api.sprites.has('surfer#' + frame) ? api.sprites.get('surfer#' + frame) : null;
        if (sp) {
            px.ctx.save();
            px.ctx.translate(110, surferY);
            if (s.airborne) px.ctx.rotate(s.rotation * Math.PI / 180);
            px.ctx.drawImage(sp.atlas, sp.x, sp.y, sp.w, sp.h, -sp.ox, -sp.oy, sp.w, sp.h);
            px.ctx.restore();
        }
    },

    hud(px, api) {
        const s = this.state;
        if (s.comboMult > 1) {
            api.font && api.font.text(px.ctx, 'COMBO x' + s.comboMult.toFixed(1), 160, 30, { align: 'center', color: 'A', mono: true });
        }
    },

    score() { return Math.floor(this.state.score); },

    summary() {
        const s = this.state;
        return [
            { label: 'Quedas', value: s.wipeouts },
            { label: 'Maior combo', value: s.comboMult.toFixed(1) + 'x' }
        ];
    }
};
