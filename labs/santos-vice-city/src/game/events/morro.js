export default {
    id: 'morro', name: 'SUBIDA DO MORRO', region: 'Monte Serrat',
    blurb: ['415 degraus.', 'Suba ritmado com o botijão.'],
    touch: 'UD', keys: [['←→', 'alternar'], ['▲', 'desviar']],
    duration: 100, music: 'subida', medals: { bronze: 1800, prata: 3600, ouro: 5600, platina: 7600 },
    init(a, api) { this.state = { score: 0, time: 0 }; },
    update(dt, input, api) { this.state.time += dt; if (this.state.time >= api.duration) api.finish('time'); },
    draw(px, api) { px.ctx.fillStyle = '#123d2a'; px.ctx.fillRect(0, 0, 320, 224); },
    hud(px, api) {},
    score() { return this.state.score; },
    summary() { return [{ label: 'Metros', value: 0 }]; }
};
