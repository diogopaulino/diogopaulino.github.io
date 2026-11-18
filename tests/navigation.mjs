// A* em células de um metro. Termina dentro do alcance da interação:
// postes, mesas e portões podem ter um colisor em seu próprio centro.
export function findRoute(player, target, traversable) {
    const queue = [{ x: Math.round(player.x), z: Math.round(player.z), cost: 0 }];
    const visited = new Set();
    const best = new Map();
    const neighbors = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
    while (queue.length && visited.size < 14000) {
        const cell = queue.pop();
        const key = [cell.x, cell.z].join(',');
        if (visited.has(key)) continue;
        visited.add(key);
        if (Math.hypot(target.x - cell.x, target.z - cell.z) < Math.max(1, target.r - 0.25)) {
            const points = [];
            for (let point = cell; point.previous; point = point.previous) points.push(point);
            return points.reverse();
        }
        for (const [dx, dz] of neighbors) {
            const x = cell.x + dx;
            const z = cell.z + dz;
            const next = [x, z].join(',');
            const cost = cell.cost + Math.hypot(dx, dz);
            if (visited.has(next) || cost >= (best.get(next) ?? Infinity)) continue;
            if (!traversable(x, z) || !traversable(cell.x + dx / 2, cell.z + dz / 2)) continue;
            best.set(next, cost);
            queue.push({ x, z, previous: cell, cost, priority: cost + 1.45 * Math.hypot(x - target.x, z - target.z) });
        }
        queue.sort((a, b) => b.priority - a.priority);
    }
    return [];
}
