// Avança até o adversário e alterna golpes usando os controles da arena.
export function fightRounds() {
    const { match, step } = window.__lab;
    let held = [];
    function press(keys) {
        for (const code of held) if (!keys.includes(code)) window.dispatchEvent(new KeyboardEvent('keyup', { code }));
        for (const code of keys) if (!held.includes(code)) window.dispatchEvent(new KeyboardEvent('keydown', { code }));
        held = keys;
    }
    let hits = false;
    for (let frame = 0; frame < 42000 && match.phase !== 'complete'; frame++) {
        const next = [];
        if (match.phase === 'fight') {
            const gap = match.p2.x - match.p1.x;
            if (Math.abs(gap) > 48) next.push(gap > 0 ? 'KeyD' : 'KeyA');
            if (frame % 8 < 4) next.push(['KeyK', 'KeyJ', 'KeyL', 'KeyU'][Math.floor(frame / 8) % 4]);
        }
        press(next);
        step();
        if (match.p2.health < 100) hits = true;
    }
    press([]);
    return { hits, phase: match.phase, wins: Math.max(match.p1.wins, match.p2.wins) };
}
