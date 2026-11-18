const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function chessMatch() {
    const mode = document.querySelector('#modeSelect');
    mode.value = 'local';
    mode.dispatchEvent(new Event('change'));
    document.querySelector('#startButton').click();
    await delay(650);
    const board = document.querySelector('#scene');
    const announcement = document.querySelector('#boardAnnouncement');
    let square = 'e2';
    const key = code => board.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true }));
    for (const target of ['f2', 'f3', 'e7', 'e5', 'g2', 'g4', 'd8', 'h4']) {
        board.focus();
        for (let i = 0; square !== target && i < 16; i++) {
            const dx = target.charCodeAt(0) - square.charCodeAt(0);
            const dy = Number(target[1]) - Number(square[1]);
            key(dx > 0 ? 'ArrowRight' : dx < 0 ? 'ArrowLeft' : dy > 0 ? 'ArrowUp' : 'ArrowDown');
            square = announcement.textContent.slice(0, 2);
        }
        if (square !== target) throw Error('Casa inacessível pelo teclado: ' + target);
        key('Enter');
        await delay(800);
    }
}

export function minefield() {
    const select = document.querySelector('#difficulty-select');
    select.value = 'beginner';
    select.dispatchEvent(new Event('change'));
    const reset = document.querySelector('#reset-btn');
    const mines = [1, 10, 14, 18, 32, 40, 61, 70, 73, 78];
    const results = [];
    for (const win of [false, true]) {
        reset.click();
        const cells = [...document.querySelectorAll('.cell')];
        // A primeira jogada distribui as minas. Fornece um tabuleiro conhecido
        // apenas durante o sorteio, depois joga pelos botões normais.
        const coords = mines.flatMap(i => [(Math.floor(i / 9) + 0.5) / 9, (i % 9 + 0.5) / 9]);
        const random = Math.random;
        try {
            Math.random = () => coords.length ? coords.shift() : random();
            cells[0].click();
        } finally { Math.random = random; }
        if (win) cells.forEach((cell, i) => { if (!mines.includes(i)) cell.click(); });
        else cells[1].click();
        results.push(reset.textContent.trim());
    }
    return results;
}
