import { findRoute } from './navigation.mjs';
import { HOME, BEFRIEND_R, BERRY_R, HOME_R, WORLD_RADIUS } from '/labs/nina/src/config.js';

export function valleyControls(game) {
    const { player, valley } = game;
    let held = [];
    let route = [];
    let previous;
    function press(next) {
        for (const code of held) if (!next.includes(code)) window.dispatchEvent(new KeyboardEvent('keyup', { code }));
        for (const code of next) if (!held.includes(code)) window.dispatchEvent(new KeyboardEvent('keydown', { code }));
        held = next;
    }
    const distance = p => Math.hypot(p.x - player.pos.x, p.z - player.pos.z);
    function nearest(points) {
        return points.reduce((best, p) => !best || distance(p) < distance(best) ? p : best, null);
    }
    function clear(x, z) {
        if (Math.hypot(x, z) >= WORLD_RADIUS - 1.6) return false;
        const probe = { x, z };
        valley.collide(probe, 0.6);
        return Math.hypot(x - probe.x, z - probe.z) < 0.001;
    }
    return () => {
        for (let step = 0; step < 25 && !game.won; step++) {
            const lost = valley.friends.filter(f => f.state === 'lost').map(f => f.mesh.position);
            const berry = lost.length && player.berries === 0;
            const target = berry ? nearest(valley.berries.filter(b => !b.taken)) : nearest(lost) || HOME;
            const r = berry ? BERRY_R : target === HOME ? HOME_R : BEFRIEND_R;
            if (previous !== target) { route = []; previous = target; }
            const keys = [];
            if (distance(target) < r - 0.08) {
                if (!berry) keys.push('Space');
                route = [];
            } else {
                if (!route.length) route = findRoute(player.pos, { ...target, r }, clear);
                while (route.length && distance(route[0]) < 0.65) route.shift();
                const aim = route[0] || target;
                const dx = aim.x - player.pos.x;
                const dz = aim.z - player.pos.z;
                const forward = dx * player.forward.x + dz * player.forward.z;
                const side = dx * player.right.x + dz * player.right.z;
                const threshold = 0.4 * Math.max(Math.abs(forward), Math.abs(side));
                if (Math.abs(forward) > threshold) keys.push(forward > 0 ? 'KeyW' : 'KeyS');
                if (Math.abs(side) > threshold) keys.push(side > 0 ? 'KeyD' : 'KeyA');
                keys.push('ShiftLeft');
            }
            press(keys);
            for (let frame = 0; frame < 6; frame++) game.step(1 / 60, true);
        }
        if (game.won) press([]);
        return { won: game.won, home: game.homeCount(), following: game.followers().length };
    };
}
