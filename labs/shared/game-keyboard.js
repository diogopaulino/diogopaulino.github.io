// Cada tecla física mantém a ação ativa até a última tecla equivalente ser solta.
export function bindGameKeyboard({ moves, actions, held, enabled, onAction, onPress, onRelease, onReset }) {
    const down = new Set();
    function keydown(event) {
        if (!enabled() || event.ctrlKey || event.metaKey || event.altKey) return;
        const target = event.target;
        if (target instanceof Element) {
            if (target.closest('input, select, textarea, [contenteditable="true"]')) return;
            if (['Enter', 'Space'].includes(event.code) && target.closest('button, a, summary')) return;
        }
        const move = moves[event.code];
        const action = actions[event.code];
        if (!move && !action) return;
        event.preventDefault();
        if (event.repeat || down.has(event.code)) return;
        down.add(event.code);
        if (action) onAction(action);
        if (move && !held.has(move)) {
            held.add(move);
            onPress(move);
        }
    }

    function keyup(event) {
        if (!down.delete(event.code)) return;
        const move = moves[event.code];
        if (!move) return;
        for (const code of down) if (moves[code] === move) return;
        held.delete(move);
        onRelease?.(move);
    }

    function reset() {
        down.clear();
        held.clear();
        onReset();
    }

    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);
    window.addEventListener('blur', reset);
    // Trocar de aba (Cmd+Tab, gesto no celular) nem sempre dispara blur: solta as teclas também.
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) reset();
    });
}
