import { findRoute } from './navigation.mjs';

// Dirige pelos dois ramais e pela volta principal. Para ao avistar uma espécie
// nova e segura o botão de observação até o diário confirmar o registro.
export function islandControls(game) {
    const stops = [[4,86],[6,73],[20,60],[31,42],[35,22],[39,12],[32,2],[25,-21],
        [40,-31],[58,-44],[69,-53],[57,-43],[40,-32],[24,-30],[20,-50],[10,-42],
        [-10,-56],[-28,-52],[-47,-42],[-60,-56],[-46,-38],[-50,-12],[-48,16],
        [-56,33],[-38,42],[-18,58],[-3,69]];
    let index = 0;
    let route = [];
    let anchor = { x: game.jeep.x, z: game.jeep.z };
    let still = 0;
    let reversing = 0;
    let reverseSteer;
    function clear(x, z) {
        return !game.world.flooded(x, z) && !game.world.collide(x, z, 2.45).hit;
    }
    let held = [];
    function input(keys) {
        for (const code of held) if (!keys.includes(code)) window.dispatchEvent(new KeyboardEvent('keyup', { code }));
        for (const code of keys) if (!held.includes(code)) window.dispatchEvent(new KeyboardEvent('keydown', { code }));
        held = keys;
    }
    return () => {
        for (let step = 0; step < 180 && game.state === 'play'; step++) {
            const j = game.jeep;
            const [x, z] = stops[index];
            const near = game._nearestDino();
            if (near && !game.logged.has(near.id)) {
                still = 0;
                input(['KeyE']);
            } else if (reversing > 0) {
                reversing--;
                input(['KeyS', reverseSteer]);
            }
            else {
                if (Math.hypot(x - j.x, z - j.z) < 4) {
                    index = index + 1 === stops.length ? 2 : index + 1;
                    route = [];
                    continue;
                }
                if (!route.length) route = findRoute(j, { x, z, r: 3 }, clear);
                while (route.length && Math.hypot(route[0].x - j.x, route[0].z - j.z) < 3.5) route.shift();
                const aim = route[0] || { x, z };
                const angle = Math.atan2(aim.x - j.x, aim.z - j.z) - j.yaw;
                const turn = Math.atan2(Math.sin(angle), Math.cos(angle));
                if (Math.hypot(j.x - anchor.x, j.z - anchor.z) > 1.2) {
                    anchor = { x: j.x, z: j.z };
                    still = 0;
                } else if (++still > 120) {
                    reverseSteer = turn > 0 ? 'KeyD' : 'KeyA';
                    reversing = 65;
                    route = [];
                    still = 0;
                }
                const keys = [];
                if (Math.abs(turn) > 0.07) keys.push(turn > 0 ? 'KeyA' : 'KeyD');
                if (j.speed < (Math.abs(turn) > 0.45 ? 3.5 : 10)) keys.push('KeyW');
                input(keys);
            }
            game._frame(1 / 60, game.elapsed + 1 / 60);
        }
        if (game.state !== 'play') input([]);
        return { state: game.state, seen: [...game.logged], stop: index, x: game.jeep.x, z: game.jeep.z };
    };
}
