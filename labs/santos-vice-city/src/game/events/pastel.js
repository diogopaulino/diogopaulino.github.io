export default {
    id: 'pastel', name: 'DELIVERY DE PASTEL', region: 'Gonzaga',
    blurb: ['Entrega no tempo.', 'Cuidado com o pastel!'],
    touch: 'FULL', keys: [['↑↓←→', 'dirigir'], ['A', 'acelerar'], ['B', 'freio']],
    duration: 45, music: 'corrida', medals: { bronze: 2200, prata: 4800, ouro: 8000, platina: 12000 },
    init(a, api) { this.state = { score: 0, time: 0 }; },
    update(dt, input, api) { this.state.time += dt; if (this.state.time >= api.duration) api.finish('time'); },
    draw(px, api) { px.ctx.fillStyle = '#6b7386'; px.ctx.fillRect(0, 0, 320, 224); },
    hud(px, api) {},
    score() { return this.state.score; },
    summary() { return [{ label: 'Entregas', value: 0 }]; }
};
