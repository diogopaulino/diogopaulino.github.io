export default {
    id: 'surf', name: 'QUEBRA-MAR SURF', region: 'Ponta da Praia',
    blurb: ['Ondas boas hoje.', 'Pega o pico antes da espuma.'],
    touch: 'LR', keys: [['←→', 'carve'], ['A', 'aéreo'], ['B', 'tubo']],
    duration: 75, music: 'praia', medals: { bronze: 1500, prata: 3200, ouro: 5200, platina: 7500 },
    init(a, api) { this.state = { score: 0, time: 0 }; },
    update(dt, input, api) { this.state.time += dt; if (this.state.time >= api.duration) api.finish('time'); },
    draw(px, api) { px.ctx.fillStyle = '#0b3d5c'; px.ctx.fillRect(0, 0, 320, 224); },
    hud(px, api) {},
    score() { return this.state.score; },
    summary() { return [{ label: 'Manobras', value: 0 }]; }
};
