document.addEventListener('DOMContentLoaded', () => {
    const boardElement = document.getElementById('board');
    const mineCountElement = document.getElementById('mine-count');
    const timerElement = document.getElementById('timer');
    const resetBtn = document.getElementById('reset-btn');

    const ROWS = 9;
    const COLS = 9;
    const MINES = 10;

    let board = [];
    let gameOver = false;
    let flags = 0;
    let timer = 0;
    let timerInterval = null;
    let firstClick = true;

    function initGame() {
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

                cell.addEventListener('mousedown', (e) => {
                    if (gameOver) return;
                    if (e.button === 0) { // Left click
                        resetBtn.innerText = '😮';
                    }
                });

                cell.addEventListener('mouseup', (e) => {
                    if (gameOver) return;
                    resetBtn.innerText = '🙂';
                    if (e.button === 0) {
                        handleClick(r, c);
                    } else if (e.button === 2) {
                        handleRightClick(r, c);
                    }
                });

                // Prevent context menu on right click
                cell.addEventListener('contextmenu', e => e.preventDefault());

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
        } else {
            revealCell(r, c);
            checkWin();
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
        } else {
            if (flags < MINES) {
                cellData.isFlagged = true;
                cellElement.innerText = '🚩';
                flags++;
            }
        }
        mineCountElement.innerText = formatNumber(MINES - flags);
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

    initGame();
});
