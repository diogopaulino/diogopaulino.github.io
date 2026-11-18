// Piloto de pouso. Ajusta a inclinação para frear na horizontal e a potência
// para manter altitude na travessia e limitar a velocidade durante a descida.
export function flyMission() {
    const pad = landingPads[1];
    const center = (pad.x1 + pad.x2) / 2;
    const cruise = Math.min(landingPads[0].y, pad.y) - 120;
    let held = [];
    let descending = false;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi));
    function press(next) {
        for (const code of held) if (!next.includes(code)) window.dispatchEvent(new KeyboardEvent('keyup', { code }));
        for (const code of next) if (!held.includes(code)) window.dispatchEvent(new KeyboardEvent('keydown', { code }));
        held = next;
    }
    for (let i = 0; i < 6000 && gameState === 'PLAYING'; i++) {
        const dx = center - lander.x;
        if (Math.abs(dx) < 6 && Math.abs(lander.vx) < 3) descending = true;
        const alt = descending ? pad.y : cruise;
        const speed = clamp(dx * 0.5, -28, 28);
        const angle = clamp((speed - lander.vx) * 0.065, -0.55, 0.55);
        const vy = clamp((alt - lander.y) * 0.5, -35, descending ? 14 : 22);
        const keys = [];
        if (angle - lander.angle > 0.012) keys.push('ArrowRight');
        if (angle - lander.angle < -0.012) keys.push('ArrowLeft');
        if (lander.vy >= vy) keys.push('ArrowUp');
        press(keys);
        handleInput();
        lander.update(PHYSICS.fixedStep);
        updateParticles(PHYSICS.fixedStep);
        checkCollision();
    }
    press([]);
    return { state: gameState, level, score };
}
