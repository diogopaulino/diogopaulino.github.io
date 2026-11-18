import { findRoute } from './navigation.mjs';
import { angleDelta, roadX } from '/labs/rastro-vermelho/src/simulation.js';

// Segue a trilha, para nos destinos e enfrenta as duas emboscadas.
export function trailControls(game) {
    let held = [];
    let route = [];
    let previousStage;
    const clear = (x, z) => !(game.world.colliders || []).some(o => Math.hypot(x - o.x, z - o.z) < o.radius + 0.85);
    function press(next) {
        for (const code of held) if (!next.includes(code)) window.dispatchEvent(new KeyboardEvent('keyup', { code }));
        for (const code of next) if (!held.includes(code)) window.dispatchEvent(new KeyboardEvent('keydown', { code }));
        held = next;
    }
    return () => {
        for (let i = 0; i < 180 && game.state === 'play'; i++) {
            const p = game.player;
            const goal = game.target();
            const far = Math.hypot(goal.x - p.x, goal.z - p.z) > 27;
            const z = far ? Math.min(p.z + 14, goal.z) : goal.z;
            const next = { x: far ? roadX(z) : goal.x, z, r: far ? 2 : 8 };
            if (previousStage !== game.stage) { previousStage = game.stage; route = []; }
            if (!route.length) route = findRoute(p, next, clear);
            while (route.length && Math.hypot(route[0].x - p.x, route[0].z - p.z) < 1.6) route.shift();
            const aim = route[0] || next;
            const enemy = game.liveEnemies().find(e => game.hasLineOfSight(p.x, p.z, e.x, e.z));
            const target = enemy || aim;
            const turn = angleDelta(p.yaw, Math.atan2(target.x - p.x, target.z - p.z));
            const keys = [];
            if (Math.abs(turn) > 0.035) keys.push(turn > 0 ? 'KeyD' : 'KeyA');
            if (enemy) {
                if (game.aimTarget() && p.cooldown === 0 && !p.reload && i % 2 === 0) keys.push('KeyF');
            } else if (game.interaction()?.mission && i % 2 === 0) keys.push('KeyE');
            else if (Math.hypot(goal.x - p.x, goal.z - p.z) > 10 && Math.abs(turn) < 0.35) keys.push('KeyW');
            press(keys);
            if (game.state === 'play') game.update(1 / 60);
        }
        if (game.state !== 'play') press([]);
        return { state: game.state, stage: game.stage, kills: game.player.kills, x: game.player.x, z: game.player.z };
    };
}
