// events/ciclovia.js — Ciclovia dos Jardins da Orla (auto-runner 2 faixas).
// Teto: ~370 linhas. FASE 1 STUB: mecânica básica, expandir na Fase 3.

export default {
    id: 'ciclovia',
    name: 'CICLOVIA DA ORLA',
    region: 'Jardins da Orla',
    blurb: ['Pedale rápido, desvie de pedestres.', 'A campainha é sua arma.'],
    touch: 'UD',
    keys: [['▲▼', 'trocar faixa'], ['A', 'pular'], ['B', 'campainha']],
    duration: 90,
    music: 'corrida',
    medals: { bronze: 2500, prata: 5000, ouro: 8000, platina: 11000 },

    init(app, api) {
        this.state = {
            score: 0,
            distance: 0,
            speed: 1,
            lane: 0, // 0 = ciclovia, 1 = calçada
            x: 70,
            y: 150,
            vx: 0, vy: 0,
            jumping: false,
            jumpVel: 0,
            bellCooldown: 0,
            bellSpamCounter: 0,
            lives: 3,
            time: 0,
            obstacles: [],
            spawnTimer: 0
        };
        this.rng = api.rng;
    },

    update(dt, input, api) {
        const s = this.state;
        s.time += dt;
        s.distance += s.speed * 30 * dt;
        s.score = Math.floor(s.distance);

        // Inputs
        if (input.state.up.pressed && s.lane === 1) s.lane = 0;
        if (input.state.down.pressed && s.lane === 0) s.lane = 1;
        if (input.state.a.pressed && !s.jumping) {
            s.jumping = true;
            s.jumpVel = 150;
        }
        if (input.state.b.pressed) {
            if (s.bellCooldown <= 0) {
                s.bellCooldown = 1.2;
                s.bellSpamCounter = 0;
                api.popup(s.x, 80, 'TRIM', 'A');
            } else {
                s.bellSpamCounter++;
            }
        }

        // Gravity
        if (s.jumping) {
            s.y -= s.jumpVel * dt;
            s.jumpVel -= 400 * dt;
            if (s.y >= 150) {
                s.y = 150;
                s.jumping = false;
            }
        }

        s.bellCooldown = Math.max(0, s.bellCooldown - dt);
        s.speed = Math.min(2.2, 1 + s.time * 0.2);

        // Obstáculos
        s.spawnTimer -= dt;
        if (s.spawnTimer <= 0) {
            s.obstacles.push({
                x: 320,
                lane: this.rng.chance(0.5) ? 0 : 1,
                type: this.rng.pick(['ped', 'bike', 'puddle']),
                life: 0
            });
            s.spawnTimer = this.rng.range(0.8, 1.5);
        }

        s.obstacles = s.obstacles.filter(o => {
            o.x -= s.speed * 60 * dt;
            o.life += dt;
            if (o.x < -20) return false;

            // Colisão
            if (!s.jumping && o.lane === s.lane && o.x > s.x - 20 && o.x < s.x + 20) {
                s.lives--;
                api.shake(10, 200);
                api.popup(s.x, 120, 'HIT', 'B');
                if (s.lives <= 0) api.finish('wipeout');
            }
            return true;
        });

        if (s.time >= api.duration) api.finish('time');
    },

    draw(px, api) {
        const s = this.state;
        px.ctx.fillStyle = '#1e6b3c';
        px.ctx.fillRect(0, 100, 320, 124);

        // Faixas
        px.ctx.fillStyle = '#d0d0d0';
        px.ctx.fillRect(0, 130, 320, 1);
        px.ctx.fillRect(0, 165, 320, 1);

        // Bike
        if (api.sprites.has('bike')) {
            px.blitScreen(api.sprites.get('bike'), s.x, s.y);
        }

        // Obstáculos
        for (const o of s.obstacles) {
            let sp = null;
            if (o.type === 'ped') sp = api.sprites.get('ped_phone');
            else if (o.type === 'bike') sp = api.sprites.get('cone');
            else if (o.type === 'puddle') sp = api.sprites.get('puddle');
            if (sp) px.blitScreen(sp, o.x, 130 + o.lane * 35);
        }
    },

    hud(px, api) {
        // Deixa pro HUD compartilhado
    },

    score() { return this.state.score; },

    summary() {
        const s = this.state;
        return [
            { label: 'Distância', value: Math.floor(s.distance / 10) },
            { label: 'Velocidade', value: Math.floor(s.speed * 10) / 10 },
            { label: 'Desvios', value: 0 }
        ];
    }
};
