export default {
    id: 'canal', name: 'PUÇÁ NO CANAL 3', region: 'Canais',
    blurb: ['Pesca no canal.', 'Catch chinelos, evita lixo.'],
    touch: 'LR', keys: [['←→', 'andar'], ['A', 'arremesso'], ['B', 'recolher']],
    duration: 80, music: 'agua', medals: { bronze: 900, prata: 2000, ouro: 3400, platina: 5000 },
    init(a, api) { this.state = { score: 0, time: 0 }; },
    update(dt, input, api) { this.state.time += dt; if (this.state.time >= api.duration) api.finish('time'); },
    draw(px, api) { px.ctx.fillStyle = '#1a8ba3'; px.ctx.fillRect(0, 0, 320, 224); },
    hud(px, api) {},
    score() { return this.state.score; },
    summary() { return [{ label: 'Peixes', value: 0 }]; }
};
