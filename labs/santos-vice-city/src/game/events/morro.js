// events/morro.js — Subida do Monte Serrat (ritmo alternado, botijão de gás).
// Teto: ~380 linhas.

export default {
    id: 'morro',
    name: 'SUBIDA DO MORRO',
    region: 'Monte Serrat',
    blurb: ['415 degraus com um botijão de gás.', 'Alterne no ritmo pra não escorregar.'],
    touch: 'UD',
    keys: [['←→', 'alternar passos'], ['A', 'desviar']],
    duration: 100,
    music: 'subida',
    medals: { bronze: 1800, prata: 3600, ouro: 5600, platina: 7600 },

    init(app, api) {
        this.state = {
            score: 0, time: 0, distance: 0, targetBpm: 100,
            ritmo: 0.5, folego: 1, sway: 0,
            lastInput: null, lastInputT: -999,
            perfectSteps: 0, botijaoDropped: false, finished: false
        };
        this.rng = api.rng;
        this.api = api;
    },

    update(dt, input, api) {
        const s = this.state;
        if (s.finished) return;
        s.time += dt;
        s.targetBpm = 100 + Math.min(40, Math.floor(s.time / 30) * 20);

        const beatInterval = 60 / s.targetBpm;
        let stepped = false, dir = null;
        if (input.state.left.pressed) { dir = 'left'; stepped = true; }
        if (input.state.right.pressed) { dir = 'right'; stepped = true; }

        if (stepped) {
            const alternating = dir !== s.lastInput;
            const timeSinceLast = s.time - s.lastInputT;
            const onBeat = Math.abs(timeSinceLast - beatInterval) < beatInterval * 0.35;

            if (alternating && onBeat) {
                s.ritmo = Math.min(1, s.ritmo + 0.08);
                s.perfectSteps++;
                s.distance += 6;
                s.sway = Math.max(0, s.sway - 0.1);
                api.popup && api.popup(160, 100, '+', 'H');
            } else if (alternating) {
                s.ritmo = Math.max(0, s.ritmo - 0.03);
                s.distance += 3;
                s.sway = Math.min(1, s.sway + 0.08);
            } else {
                s.sway = Math.min(1, s.sway + 0.15);
                s.distance += 1;
            }
            s.lastInput = dir;
            s.lastInputT = s.time;
        }

        s.folego = Math.max(0, s.folego - (0.02 - s.ritmo * 0.015) * dt);
        if (s.folego <= 0) {
            s.distance = Math.max(0, s.distance - 20);
            s.folego = 0.3;
            api.popup && api.popup(160, 100, 'ESCORREGOU', 'B');
        }

        if (s.sway >= 1 && !s.botijaoDropped) {
            s.botijaoDropped = true;
            api.popup && api.popup(160, 90, 'BOTIJÃO EM FUGA', 'B');
            api.shake && api.shake(6, 200);
            s.distance = Math.max(0, s.distance - 30);
            s.sway = 0.3;
        }

        s.score = Math.floor(s.distance * 4 + s.folego * 100 + s.perfectSteps * 25 + (s.botijaoDropped ? 0 : 1000));

        if (s.distance >= 600) {
            s.finished = true;
            api.popup && api.popup(160, 80, 'MONTE SERRAT: 415 DEGRAUS.', 'A');
            api.finish('summit');
        }
        if (s.time >= api.duration) {
            s.finished = true;
            api.finish('time');
        }
    },

    draw(px, api) {
        const s = this.state;
        px.ctx.fillStyle = '#1b1233';
        px.ctx.fillRect(0, 0, 320, 224);
        px.ctx.fillStyle = '#123d2a';
        px.ctx.beginPath();
        px.ctx.moveTo(0, 224);
        px.ctx.lineTo(0, 40);
        px.ctx.lineTo(320, 160);
        px.ctx.lineTo(320, 224);
        px.ctx.fill();

        const climber = api.sprites.anim ? api.sprites.anim('climber', s.time, 3) : api.sprites.get('climber#0');
        if (climber) px.blitScreen(climber, 100, 140);

        px.ctx.fillStyle = 'rgba(0,0,0,0.4)';
        px.ctx.fillRect(10, 190, 100, 8);
        px.ctx.fillStyle = '#00f0ff';
        px.ctx.fillRect(10, 190, 100 * s.folego, 8);

        px.ctx.fillStyle = 'rgba(0,0,0,0.4)';
        px.ctx.fillRect(10, 202, 100, 6);
        px.ctx.fillStyle = s.sway > 0.7 ? '#e03a2f' : '#ffb35c';
        px.ctx.fillRect(10, 202, 100 * s.sway, 6);
    },

    hud() {},

    score() { return this.state.score; },

    summary() {
        const s = this.state;
        return [
            { label: 'Distância', value: Math.floor(s.distance) + 'm' },
            { label: 'Passos perfeitos', value: s.perfectSteps },
            { label: 'Botijão', value: s.botijaoDropped ? 'caiu' : 'intacto' }
        ];
    }
};
