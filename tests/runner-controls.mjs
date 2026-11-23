// Os pilotos usam o teclado e avançam os mesmos quadros da partida.
function keyboard() {
    let held = new Set();
    return keys => {
        const send = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
        for (const code of held) if (!keys.includes(code)) send('keyup', code);
        for (const code of keys) if (!held.has(code)) send('keydown', code);
        held = new Set(keys);
    };
}

export function jungleLevel(game) {
    const press = keyboard();
    let jump = false;
    for (let frame = 0; frame < 9000 && game.state === 'playing'; frame++) {
        const p = game.player;
        const obstacle = game.obstacles.some(o => {
            const left = o.type === 'pit' ? o.x : o.x - o.hitWidth / 2;
            return left > p.x - 16 && left < p.x + 94;
        });
        if (p.onVine || p.onTree) jump = !jump;
        else if (p.onGround) jump = obstacle;
        else jump = p.vy < 0 && jump;
        press(jump ? ['KeyD', 'Space'] : ['KeyD']);
        game.gameLoop({ deltaTime: 1 });
    }
    press([]);
    return { state: game.state, level: game.currentLevel.id };
}

export async function riverControls(game) {
    const { centerX } = await import('/labs/river-knight/src/river.js?v=60');
    const press = keyboard();
    return () => {
        for (let i = 0; i < 300; i++) {
            if (['victory', 'gameover', 'menu'].includes(game.state)) break;
            const { x, z } = game.player;
            let aim = centerX(z - 20);
            if (game.boss.active) aim = game.boss.group.position.x;
            else {
                const obstacles = ['rocks', 'barricades', 'enemyShips'].flatMap(k => game.entities.pools[k]);
                const nearest = obstacles.filter(e => e.active && z > e.position.z && z - e.position.z < 48)
                    .sort((a, b) => b.position.z - a.position.z)[0];
                if (nearest && Math.abs(nearest.position.x - aim) < 10) {
                    aim = nearest.position.x + (x > nearest.position.x ? 13 : -13);
                }
            }
            // O drakkar vira pela proa (leme), não de lado: o piloto mira um ponto
            // ~26 m à frente e corrige o rumo, com amortecimento pela taxa de guinada.
            const want = Math.atan2(aim - x, 26);
            const err = want - game.player.heading - game.player.r * 0.6;
            const keys = ['KeyW'];
            if (Math.abs(err) > 0.04) keys.push(err > 0 ? 'KeyD' : 'KeyA');
            if (i % 4 < 2) keys.push('Space');
            press(keys);
            game.frame(1 / 60);
        }
        if (game.state !== 'playing') press([]);
        return game.state;
    };
}
