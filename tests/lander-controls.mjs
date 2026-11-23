// Piloto de pouso para a física em SI (Módulo Lunar: m, m/s, kg; atitude por
// taxa; acelerador Z/X). Só usa o teclado: ajusta o acelerador com Z/X, inclina
// com ← → para controlar a velocidade horizontal e liga o motor (↑) em
// bang-bang para seguir a velocidade vertical desejada. Atravessa 40 m acima do
// relevo até a segunda plataforma e desce devagar até tocar.
export function flyMission() {
    const pad = landingPads[1];
    const center = (pad.x1 + pad.x2) / 2;
    const step = PHYSICS.fixedStep;
    let held = [];
    let descending = false;
    const clampV = (v, lo, hi) => Math.max(lo, Math.min(v, hi));
    function press(next) {
        for (const code of held) if (!next.includes(code)) window.dispatchEvent(new KeyboardEvent('keyup', { code }));
        for (const code of next) if (!held.includes(code)) window.dispatchEvent(new KeyboardEvent('keydown', { code }));
        held = next;
    }
    function tap(code) {
        window.dispatchEvent(new KeyboardEvent('keydown', { code }));
        window.dispatchEvent(new KeyboardEvent('keyup', { code }));
    }
    // Acelerador em ~50 % (TWR ≈ 1,8): sobe a 1,3 m/s² ligado, cai a 1,62 m/s² desligado.
    for (let i = 0; i < 12 && prefs.throttle > 0.55; i++) tap('KeyZ');
    for (let i = 0; i < 12 && prefs.throttle < 0.45; i++) tap('KeyX');

    // Topo do relevo (menor y na tela) entre a partida e a plataforma.
    let ridge = pad.y;
    for (let x = Math.min(lander.x, center); x <= Math.max(lander.x, center); x += 4) ridge = Math.min(ridge, getGroundY(x));
    const cruiseY = ridge - 40 * PX_PER_M;

    for (let i = 0; i < 120 * 150 && gameState === 'PLAYING'; i++) {
        const dxM = (center - lander.x) * M_PER_PX;
        if (Math.abs(dxM) < 2 && Math.abs(lander.vx) < 0.4) descending = true;

        // Horizontal: velocidade desejada proporcional à distância; inclina contra o erro.
        const vxDes = clampV(dxM * 0.1, -6, 6);
        const angleCmd = clampV((vxDes - lander.vx) * 0.12, -0.3, 0.3);

        // Vertical (y da tela para baixo, vy > 0 = descendo).
        let vyDes;
        if (descending) {
            vyDes = clampV(getCurrentAltitude() * 0.12, 0.5, 4);
        } else {
            const belowM = (lander.y - cruiseY) * M_PER_PX; // > 0: abaixo da altitude de cruzeiro
            vyDes = clampV(-belowM * 0.25, -3, 3);
        }

        const keys = [];
        if (angleCmd - lander.angle > 0.01) keys.push('ArrowRight');
        if (angleCmd - lander.angle < -0.01) keys.push('ArrowLeft');
        if (lander.vy > vyDes) keys.push('ArrowUp');
        press(keys);
        handleInput();
        lander.update(step);
        updateParticles(step);
        checkCollision();
    }
    press([]);
    return { state: gameState, level, score };
}
