document.addEventListener('DOMContentLoaded', () => {
    const boardElement = document.getElementById('board');
    const mineCountElement = document.getElementById('mine-count');
    const timerElement = document.getElementById('timer');
    const resetBtn = document.getElementById('reset-btn');
    const difficultySelect = document.getElementById('difficulty-select');
    const flagToggle = document.getElementById('flag-toggle');
    const bestTimeElement = document.getElementById('best-time');
    const statusLive = document.getElementById('gameStatus');
    const audio = window.LabAudio;

    const DIFFICULTIES = {
        beginner: { rows: 9, cols: 9, mines: 10 },
        intermediate: { rows: 16, cols: 16, mines: 40 },
        expert: { rows: 16, cols: 30, mines: 99 }
    };

    let ROWS = 9;
    let COLS = 9;
    let MINES = 10;

    let board = [];
    let gameOver = false;
    let flags = 0;
    let timer = 0;
    let timerInterval = null;
    let firstClick = true;
    /* Modo bandeira: no toque, segurar 500ms para marcar é lento e falha se o
       dedo escorrega. O botão de alternância transforma o toque simples em
       bandeira — é como todo Campo Minado de celular funciona. */
    let flagMode = false;

    const BEST_KEY = 'minesweeper95:best';

    function sfx(name) {
        if (!audio) return;
        switch (name) {
            case 'reveal':
                audio.tone({ freq: 520, duration: 0.03, gain: 0.05, type: 'triangle' });
                break;
            case 'flag':
                audio.tone({ freq: 780, duration: 0.05, gain: 0.08 });
                break;
            case 'unflag':
                audio.tone({ freq: 480, duration: 0.05, gain: 0.06 });
                break;
            case 'boom':
                audio.noise({ duration: 0.5, gain: 0.22, filter: 320 });
                audio.tone({ freq: 90, duration: 0.6, gain: 0.16, slideTo: 40, type: 'sawtooth' });
                break;
            case 'win':
                audio.sequence([523, 659, 784, 1047], { step: 0.09, duration: 0.16, gain: 0.13, type: 'triangle' });
                break;
        }
    }

    /* Vibração curta confirma bandeira/explosão no celular, onde não há o
       "clique" tátil do mouse. Ignorado em silêncio onde não existe. */
    function buzz(pattern) {
        try {
            navigator.vibrate?.(pattern);
        } catch (err) {
            /* Alguns navegadores expõem vibrate mas recusam a chamada. */
        }
    }

    function announce(message) {
        if (statusLive) statusLive.textContent = message;
    }

    function readBest() {
        try {
            return JSON.parse(localStorage.getItem(BEST_KEY)) || {};
        } catch (err) {
            return {};
        }
    }

    function saveBest(all) {
        try {
            localStorage.setItem(BEST_KEY, JSON.stringify(all));
        } catch (err) {
            /* Sem persistência: o recorde vale só para esta sessão. */
        }
    }

    function renderBest() {
        if (!bestTimeElement) return;
        const best = readBest()[difficultySelect.value];
        bestTimeElement.textContent = best ? `${best}s` : '—';
    }

    function recordBest() {
        const key = difficultySelect.value;
        const all = readBest();
        if (!all[key] || timer < all[key]) {
            all[key] = timer;
            saveBest(all);
        }
        renderBest();
    }

    function setFlagMode(next) {
        flagMode = next;
        if (!flagToggle) return;
        flagToggle.setAttribute('aria-pressed', String(flagMode));
        flagToggle.classList.toggle('is-on', flagMode);
        flagToggle.textContent = flagMode ? '🚩' : '⛏️';
        flagToggle.title = flagMode ? 'Modo bandeira (ativo)' : 'Modo escavar';
        flagToggle.setAttribute('aria-label',
            flagMode ? 'Modo bandeira ativo — tocar marca a célula' : 'Modo escavar — tocar revela a célula');
    }

    function updateCellSize() {
        const available = Math.min(window.innerWidth - 48, 720);
        /* Com o dedo, uma célula de 14px é impossível de acertar. No toque o
           piso sobe para 26px e o tabuleiro rola dentro da janela (o Especialista
           de 30 colunas não cabe em 375px de jeito nenhum) — melhor rolar do que
           errar a célula. */
        const coarse = window.matchMedia('(pointer: coarse)').matches;
        const floor = coarse ? 26 : 14;
        const cell = Math.max(floor, Math.min(28, Math.floor(available / COLS)));
        document.documentElement.style.setProperty('--cell-size', cell + 'px');
        boardElement.style.gridTemplateColumns = `repeat(${COLS}, var(--cell-size))`;
        boardElement.style.gridTemplateRows = `repeat(${ROWS}, var(--cell-size))`;
    }

    function initGame() {
        // Set difficulty
        const difficulty = difficultySelect.value;
        const config = DIFFICULTIES[difficulty];
        ROWS = config.rows;
        COLS = config.cols;
        MINES = config.mines;

        // Update Grid CSS (fluid cell size for small viewports)
        updateCellSize();

        // Reset state
        board = [];
        gameOver = false;
        flags = 0;
        timer = 0;
        firstClick = true;
        clearInterval(timerInterval);
        timerInterval = null;

        // Update UI
        mineCountElement.innerText = formatNumber(MINES);
        timerElement.innerText = '000';
        resetBtn.innerText = '🙂';
        boardElement.innerHTML = '';

        // Create board data structure
        for (let r = 0; r < ROWS; r++) {
            let row = [];
            for (let c = 0; c < COLS; c++) {
                row.push({
                    r, c,
                    isMine: false,
                    isRevealed: false,
                    isFlagged: false,
                    neighborMines: 0
                });
            }
            board.push(row);
        }

        // Render board
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const cell = document.createElement('div');
                cell.classList.add('cell');
                cell.dataset.r = r;
                cell.dataset.c = c;

                /* Um único caminho de entrada em pointer events cobre mouse,
                   caneta e dedo. Antes eram dois (mouse* + touch*), que em
                   navegadores que emitem os dois disparavam a jogada duas vezes. */
                let holdTimer = null;
                let moved = false;
                let longPressed = false;

                const cancelHold = () => {
                    if (holdTimer) {
                        clearTimeout(holdTimer);
                        holdTimer = null;
                    }
                };

                cell.addEventListener('pointerdown', (e) => {
                    if (gameOver) return;
                    moved = false;
                    longPressed = false;
                    resetBtn.innerText = '😮';

                    if (e.pointerType === 'mouse' && e.button === 2) return;

                    // Segurar continua marcando bandeira, para quem não usa o
                    // botão de modo.
                    holdTimer = setTimeout(() => {
                        holdTimer = null;
                        if (moved) return;
                        longPressed = true;
                        handleRightClick(r, c);
                        resetBtn.innerText = '🙂';
                    }, 450);
                });

                cell.addEventListener('pointermove', (e) => {
                    // Um deslize pequeno é tremor de dedo, não intenção de rolar.
                    if (Math.abs(e.movementX) + Math.abs(e.movementY) > 4) {
                        moved = true;
                        cancelHold();
                    }
                });

                cell.addEventListener('pointerup', (e) => {
                    cancelHold();
                    if (gameOver) return;
                    resetBtn.innerText = '🙂';
                    if (moved || longPressed) return;

                    if (e.pointerType === 'mouse' && e.button === 2) {
                        handleRightClick(r, c);
                        return;
                    }
                    if (e.button > 0) return;

                    if (flagMode) handleRightClick(r, c);
                    else handleClick(r, c);
                });

                cell.addEventListener('pointercancel', () => {
                    cancelHold();
                    resetBtn.innerText = '🙂';
                });

                cell.addEventListener('contextmenu', e => {
                    e.preventDefault();
                    if (!gameOver) handleRightClick(r, c);
                });

                /* Duplo clique/toque numa célula já revelada = "chord": revela os
                   vizinhos quando as bandeiras ao redor batem com o número.
                   É o atalho que torna o jogo rápido em vez de tedioso. */
                cell.addEventListener('dblclick', (e) => {
                    e.preventDefault();
                    chord(r, c);
                });

                boardElement.appendChild(cell);
            }
        }
    }

    function placeMines(excludeR, excludeC) {
        let minesPlaced = 0;
        while (minesPlaced < MINES) {
            const r = Math.floor(Math.random() * ROWS);
            const c = Math.floor(Math.random() * COLS);

            if (!board[r][c].isMine && (r !== excludeR || c !== excludeC)) {
                board[r][c].isMine = true;
                minesPlaced++;
            }
        }
    }

    function calculateNumbers() {
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (board[r][c].isMine) continue;
                let count = 0;
                // Check all 8 neighbors
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        const nr = r + dr;
                        const nc = c + dc;
                        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && board[nr][nc].isMine) {
                            count++;
                        }
                    }
                }
                board[r][c].neighborMines = count;
            }
        }
    }

    function handleClick(r, c) {
        if (gameOver || board[r][c].isFlagged || board[r][c].isRevealed) return;

        if (firstClick) {
            firstClick = false;
            startTimer();
            placeMines(r, c);
            calculateNumbers();
        }

        const cellData = board[r][c];

        if (cellData.isMine) {
            gameOver = true;
            revealAllMines();
            const cellElement = getCellElement(r, c);
            cellElement.classList.add('revealed', 'mine');
            cellElement.style.backgroundColor = 'red';
            resetBtn.innerText = '😵';
            stopTimer();
            sfx('boom');
            buzz([40, 60, 120]);
            announce(`Você acertou uma mina. Fim de jogo em ${timer} segundos.`);
        } else {
            revealCell(r, c);
            sfx('reveal');
            checkWin();
        }
    }

    /* Chord: numa célula revelada com número N, se já houver N bandeiras
       vizinhas, revela todos os vizinhos não marcados. Se alguma bandeira
       estiver errada, o jogador explode — é o risco que dá graça ao atalho. */
    function chord(r, c) {
        if (gameOver || firstClick) return;
        const cellData = board[r][c];
        if (!cellData.isRevealed || cellData.neighborMines === 0) return;

        let flagged = 0;
        const targets = [];
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const nr = r + dr;
                const nc = c + dc;
                if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
                const neighbour = board[nr][nc];
                if (neighbour.isFlagged) flagged++;
                else if (!neighbour.isRevealed) targets.push(neighbour);
            }
        }

        if (flagged !== cellData.neighborMines || !targets.length) return;

        for (const target of targets) {
            handleClick(target.r, target.c);
            if (gameOver) return;
        }
    }

    function handleRightClick(r, c) {
        if (gameOver || board[r][c].isRevealed) return;

        const cellData = board[r][c];
        const cellElement = getCellElement(r, c);

        if (cellData.isFlagged) {
            cellData.isFlagged = false;
            cellElement.innerText = '';
            flags--;
            sfx('unflag');
        } else {
            if (flags < MINES) {
                cellData.isFlagged = true;
                cellElement.innerText = '🚩';
                flags++;
                sfx('flag');
                buzz(18);
            }
        }
        mineCountElement.innerText = formatNumber(MINES - flags);
        announce(`${MINES - flags} minas restantes.`);
    }

    function revealCell(r, c) {
        if (r < 0 || r >= ROWS || c < 0 || c >= COLS || board[r][c].isRevealed || board[r][c].isFlagged) return;

        const cellData = board[r][c];
        cellData.isRevealed = true;

        const cellElement = getCellElement(r, c);
        cellElement.classList.add('revealed');

        if (cellData.neighborMines > 0) {
            cellElement.innerText = cellData.neighborMines;
            cellElement.dataset.num = cellData.neighborMines;
        } else {
            // Flood fill
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    revealCell(r + dr, c + dc);
                }
            }
        }
    }

    function revealAllMines() {
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (board[r][c].isMine) {
                    const cellElement = getCellElement(r, c);
                    if (!board[r][c].isFlagged) {
                        cellElement.innerText = '💣';
                        cellElement.classList.add('revealed');
                    }
                } else if (board[r][c].isFlagged) {
                    // Wrong flag
                    const cellElement = getCellElement(r, c);
                    cellElement.innerText = '❌';
                }
            }
        }
    }

    function checkWin() {
        let revealedCount = 0;
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (board[r][c].isRevealed) revealedCount++;
            }
        }

        if (revealedCount === (ROWS * COLS) - MINES) {
            gameOver = true;
            resetBtn.innerText = '😎';
            stopTimer();
            // Flag all remaining mines
            for (let r = 0; r < ROWS; r++) {
                for (let c = 0; c < COLS; c++) {
                    if (board[r][c].isMine && !board[r][c].isFlagged) {
                        board[r][c].isFlagged = true;
                        const cellElement = getCellElement(r, c);
                        cellElement.innerText = '🚩';
                    }
                }
            }
            mineCountElement.innerText = '000';
            sfx('win');
            buzz([25, 40, 25, 40, 60]);
            recordBest();
            announce(`Campo limpo em ${timer} segundos.`);
        }
    }

    function startTimer() {
        timerInterval = setInterval(() => {
            timer++;
            if (timer > 999) timer = 999;
            timerElement.innerText = formatNumber(timer);
        }, 1000);
    }

    function stopTimer() {
        clearInterval(timerInterval);
    }

    function formatNumber(num) {
        return num.toString().padStart(3, '0');
    }

    function getCellElement(r, c) {
        return document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
    }

    resetBtn.addEventListener('click', initGame);
    difficultySelect.addEventListener('change', () => {
        renderBest();
        initGame();
    });
    window.addEventListener('resize', updateCellSize);
    window.addEventListener('orientationchange', () => setTimeout(updateCellSize, 120));

    flagToggle?.addEventListener('click', () => setFlagMode(!flagMode));

    /* F alterna o modo pelo teclado — o equivalente do botão direito para quem
       joga no notebook sem mouse. */
    document.addEventListener('keydown', (e) => {
        if (e.key === 'f' || e.key === 'F') {
            if (e.target.closest('input, select, textarea')) return;
            setFlagMode(!flagMode);
        }
    });

    if (audio) {
        audio.configure({ storageKey: 'minesweeper95:muted', volume: 0.4 });
        const host = document.querySelector('[data-lab-header] .header-actions');
        if (host) audio.mountToggle(host);
    }

    setFlagMode(false);
    renderBest();
    initGame();
});
