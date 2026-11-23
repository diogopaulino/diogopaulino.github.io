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

    /* Regras ----------------------------------------------------------------
       · Abrir um quadrado sem mina mostra quantas das 8 casas vizinhas têm mina.
         Zero abre os vizinhos sozinho (flood fill).
       · O primeiro toque é sempre seguro e abre uma área: as minas só são
         sorteadas depois dele, fora do quadrado tocado e dos 8 vizinhos.
       · Vitória: abrir todos os quadrados sem mina (bandeiras não são exigidas).
         Derrota: abrir uma mina. O relógio conta segundos até 999.
       · Fácil (8x8 · 6 minas) é o nível padrão, pensado para crianças.
       · Sem chute (padrão): o campo só é aceito se um resolvedor lógico
         consegue limpá-lo inteiro a partir do primeiro toque, sem adivinhar.
         Regras do resolvedor, repetidas até não haver progresso:
           1. número − bandeiras = 0           → vizinhos fechados são seguros
           2. número − bandeiras = fechados    → vizinhos fechados são minas
           3. subconjunto: se os fechados de A estão contidos nos de B, a
              diferença tem (resto de B − resto de A) minas → aplica 1 ou 2
           4. contagem global: minas restantes = 0 ou = casas fechadas.
         Sorteia campos até achar um resolvível (teto de ~350 ms); se não
         achar, usa o último sorteio (o primeiro toque continua seguro).
       · Acorde (chord): tocar num número já aberto com as bandeiras certas em
         volta abre os outros vizinhos de uma vez.
       · Bandeiras podem passar do número de minas (o contador fica negativo),
         como no Windows — um erro de marcação não trava o jogador. */
    const DIFFICULTIES = {
        easy: { rows: 8, cols: 8, mines: 6 },
        beginner: { rows: 9, cols: 9, mines: 10 },
        intermediate: { rows: 16, cols: 16, mines: 40 },
        expert: { rows: 16, cols: 30, mines: 99 }
    };

    let ROWS = 9;
    let COLS = 9;
    let MINES = 10;

    let board = [];
    let gameOver = false;
    let revealedCount = 0;
    let flags = 0;
    let timer = 0;
    let timerInterval = null;
    let timerStart = 0;     // performance.now() do início (descontando pausas)
    let timerElapsed = 0;   // ms acumulados antes da última pausa
    const NOGUESS_KEY = 'minesweeper95:noguess';
    const noGuessToggle = document.getElementById('noguess-toggle');
    let noGuess = true;
    try {
        noGuess = localStorage.getItem(NOGUESS_KEY) !== '0';
    } catch (err) {
        noGuess = true;
    }
    let firstClick = true;
    /* Modo bandeira: no toque, segurar 500ms para marcar é lento e falha se o
       dedo escorrega. O botão de alternância transforma o toque simples em
       bandeira — é como todo Campo Minado de celular funciona. */
    let flagMode = false;

    /* setPointerCapture lança InvalidStateError se o ponteiro já foi solto (toque
       muito curto, evento sintético). A captura é um bônus: sem ela o gesto segue. */
    function capturePointer(element, pointerId) {
        try {
            element.setPointerCapture(pointerId);
        } catch (err) {
            /* segue sem captura */
        }
    }

    const BEST_KEY = 'minesweeper95:best';
    const LEVEL_KEY = 'minesweeper95:difficulty';
    const resultEl = document.getElementById('result');
    const resultTitle = document.getElementById('resultTitle');
    const resultText = document.getElementById('resultText');
    const resultIcon = document.getElementById('resultIcon');
    const resultAgain = document.getElementById('resultAgain');
    const resultLook = document.getElementById('resultLook');

    try {
        const savedLevel = localStorage.getItem(LEVEL_KEY);
        difficultySelect.value = savedLevel in DIFFICULTIES ? savedLevel : 'easy';
    } catch (err) {
        difficultySelect.value = 'easy';
    }

    /* Caixa de resultado no estilo diálogo do Windows 95, sobre o campo. */
    function showResult(won, seconds = timer) {
        resultTitle.textContent = won ? 'Você venceu!' : 'Boom!';
        resultIcon.textContent = won ? '🎉' : '💥';
        resultText.textContent = won
            ? `Campo limpo em ${seconds.toLocaleString('pt-BR')} s.${lastWasRecord ? ' Novo recorde! 🏆' : ' Parabéns!'}`
            : noGuess
                ? 'Você abriu uma mina. Este campo dava para resolver só com lógica — tente de novo!'
                : 'Você abriu uma mina. Tente de novo — o primeiro toque é sempre seguro.';
        resultEl.dataset.tone = won ? 'win' : 'lose';
        resultEl.hidden = false;
        resultAgain.focus({ preventScroll: true });
    }

    function hideResult() {
        resultEl.hidden = true;
    }

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
        bestTimeElement.textContent = Number.isFinite(best) ? `${best.toLocaleString('pt-BR')}s` : '—';
    }

    let lastWasRecord = false;
    function recordBest(seconds) {
        const key = difficultySelect.value;
        const all = readBest();
        lastWasRecord = !Number.isFinite(all[key]) || seconds < all[key];
        if (lastWasRecord) {
            all[key] = seconds;
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
        // Largura útil: viewport menos padding do body e moldura da janela Win95.
        const available = Math.min(document.documentElement.clientWidth - 48, 760);
        const fit = Math.floor(available / COLS);
        // No toque a célula cabe na tela até o mínimo de 30px (Fácil e Iniciante
        // cabem inteiros num iPhone SE); abaixo disso o campo rola dentro da
        // janela em vez de virar alvo minúsculo. Com mouse, até 36px.
        const cell = window.matchMedia('(pointer: coarse)').matches
            ? Math.max(30, Math.min(46, fit)) : Math.max(18, Math.min(36, fit));
        document.documentElement.style.setProperty('--cell-size', cell + 'px');
        boardElement.style.gridTemplateColumns = `repeat(${COLS}, var(--cell-size))`;
        boardElement.style.gridTemplateRows = `repeat(${ROWS}, var(--cell-size))`;
    }

    function initGame() {
        endPress();
        hideResult();
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
        revealedCount = 0;
        flags = 0;
        timer = 0;
        timerElapsed = 0;
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

        const cells = document.createDocumentFragment();
        // Render board
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const cell = document.createElement('button');
                cell.type = 'button';
                cell.tabIndex = r === 0 && c === 0 ? 0 : -1;
                cell.classList.add('cell');
                cell.dataset.r = r;
                cell.dataset.c = c;

                labelCell(cell, 'fechada');
                board[r][c].element = cell;
                cells.appendChild(cell);
            }
        }
        boardElement.appendChild(cells);
    }

    function labelCell(cell, state) {
        cell.setAttribute('aria-label', `Linha ${Number(cell.dataset.r) + 1}, coluna ${Number(cell.dataset.c) + 1}, ${state}`);
    }

    boardElement.addEventListener('focusin', event => {
        const cell = event.target.closest('.cell');
        if (!cell || cell.tabIndex === 0) return;
        boardElement.querySelector('[tabindex="0"]').tabIndex = -1;
        cell.tabIndex = 0;
    });
    boardElement.addEventListener('keydown', event => {
        const cell = event.target.closest('.cell');
        const step = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[event.key];
        if (!cell || !step) return;
        event.preventDefault();
        board[+cell.dataset.r + step[0]]?.[+cell.dataset.c + step[1]]?.element.focus();
    });
    boardElement.addEventListener('click', event => {
        const cell = event.target.closest('.cell');
        if (!cell || event.detail !== 0 || gameOver) return;
        const r = +cell.dataset.r, c = +cell.dataset.c;
        if (flagMode) handleRightClick(r, c);
        else if (board[r][c].isRevealed) chord(r, c);
        else handleClick(r, c);
    });

    // Uma interação pertence à célula onde começou. O clique direito chega
    // como contextmenu; o pointerup não deve marcar a mesma bandeira de novo.
    let press = null;
    function endPress() {
        if (!press) return;
        clearTimeout(press.timer);
        press.lit?.forEach(el => el.classList.remove('pressed'));
        press = null;
        if (!gameOver) resetBtn.innerText = '🙂';
    }

    /* Segurar um número aberto "afunda" os vizinhos fechados — a prévia do
       acorde que o Windows mostrava com os dois botões do mouse. */
    function lightNeighbours(r, c) {
        const lit = [];
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                const n = board[r + dr]?.[c + dc];
                if (!n || n.isRevealed || n.isFlagged) continue;
                n.element.classList.add('pressed');
                lit.push(n.element);
            }
        }
        return lit;
    }

    boardElement.addEventListener('pointerdown', (event) => {
        const cell = event.target.closest('.cell');
        // Safari/iOS: toque pode chegar com button === -1; clique direito usa contextmenu.
        if (!cell || gameOver || (event.pointerType === 'mouse' && event.button !== 0) || press) return;
        event.preventDefault();
        audio?.unlock?.();
        const r = +cell.dataset.r, c = +cell.dataset.c;
        capturePointer(cell, event.pointerId);
        press = { id: event.pointerId, r, c, x: event.clientX, y: event.clientY, held: false };
        resetBtn.innerText = '😮';
        if (board[r][c].isRevealed) {
            press.chord = true;
            press.lit = lightNeighbours(r, c);
            return;
        }
        // Segurar 450 ms marca bandeira (vibra no celular).
        press.timer = setTimeout(() => {
            if (!press) return;
            press.held = true;
            handleRightClick(r, c);
            resetBtn.innerText = '🙂';
        }, 450);
    });
    boardElement.addEventListener('pointermove', (event) => {
        if (press?.id === event.pointerId && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 6) endPress();
    });
    boardElement.addEventListener('pointerup', (event) => {
        if (press?.id !== event.pointerId) return;
        const { r, c, held, chord: isChord } = press;
        endPress();
        if (held || gameOver) return;
        if (isChord) chord(r, c);
        else (flagMode ? handleRightClick : handleClick)(r, c);
    });
    boardElement.addEventListener('pointercancel', (event) => {
        if (press?.id === event.pointerId) endPress();
    });
    boardElement.addEventListener('lostpointercapture', (event) => {
        if (press?.id === event.pointerId) endPress();
    });
    boardElement.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        const cell = event.target.closest('.cell');
        if (cell && !gameOver && event.pointerType !== 'touch' && !press) {
            handleRightClick(+cell.dataset.r, +cell.dataset.c);
        }
    });
    // Duplo clique num número já é tratado pelo clique simples (acorde).

    /* --- Gerador sem chute ----------------------------------------------
       Tudo em arrays planos (índice = r·COLS + c) para o resolvedor rodar
       dezenas de vezes por segundo sem alocar objetos. */
    let neighbourCache = null;

    function neighbourList() {
        if (neighbourCache && neighbourCache.rows === ROWS && neighbourCache.cols === COLS) return neighbourCache.list;
        const list = [];
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const n = [];
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        if (!dr && !dc) continue;
                        const nr = r + dr, nc = c + dc;
                        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) n.push(nr * COLS + nc);
                    }
                }
                list.push(n);
            }
        }
        neighbourCache = { rows: ROWS, cols: COLS, list };
        return list;
    }

    /* Sorteio clássico por rejeição: linha e coluna aleatórias, descartando
       a zona segura 3x3 do primeiro toque e casas já minadas. */
    function randomMines(excludeR, excludeC) {
        const total = ROWS * COLS;
        const mines = new Uint8Array(total);
        let free = 0;
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (Math.abs(r - excludeR) > 1 || Math.abs(c - excludeC) > 1) free++;
            }
        }
        const count = Math.min(MINES, free);
        let placed = 0;
        while (placed < count) {
            const r = Math.floor(Math.random() * ROWS);
            const c = Math.floor(Math.random() * COLS);
            // Zona segura 3x3 em volta do primeiro toque.
            if (Math.abs(r - excludeR) <= 1 && Math.abs(c - excludeC) <= 1) continue;
            const i = r * COLS + c;
            if (mines[i]) continue;
            mines[i] = 1;
            placed++;
        }
        return mines;
    }

    /* Resolvedor lógico (regras 1–4 do topo). Devolve true se abre tudo. */
    function solvable(mines, startIdx) {
        const total = ROWS * COLS;
        const nb = neighbourList();
        const counts = new Uint8Array(total);
        for (let i = 0; i < total; i++) {
            if (mines[i]) continue;
            let n = 0;
            for (const j of nb[i]) n += mines[j];
            counts[i] = n;
        }
        const state = new Uint8Array(total); // 0 fechada · 1 aberta · 2 mina deduzida
        let opened = 0;
        let flagged = 0;
        const stack = [];

        const open = (i) => {
            stack.push(i);
            while (stack.length) {
                const k = stack.pop();
                if (state[k] !== 0) continue;
                if (mines[k]) return false; // dedução errada: nunca deve ocorrer
                state[k] = 1;
                opened++;
                if (counts[k] === 0) for (const j of nb[k]) if (state[j] === 0) stack.push(j);
            }
            return true;
        };

        open(startIdx);
        const goal = total - MINES;
        const unknownOf = (i) => nb[i].filter(j => state[j] === 0);
        const flagsOf = (i) => nb[i].reduce((t, j) => t + (state[j] === 2 ? 1 : 0), 0);

        let progress = true;
        while (progress && opened < goal) {
            progress = false;

            // Regras 1 e 2.
            for (let i = 0; i < total; i++) {
                if (state[i] !== 1 || counts[i] === 0) continue;
                const unknown = unknownOf(i);
                if (!unknown.length) continue;
                const rest = counts[i] - flagsOf(i);
                if (rest === 0) {
                    for (const j of unknown) if (!open(j)) return false;
                    progress = true;
                } else if (rest === unknown.length) {
                    for (const j of unknown) { state[j] = 2; flagged++; }
                    progress = true;
                }
            }
            if (progress) continue;

            // Regra 3: pares de números a até 2 casas de distância.
            for (let a = 0; a < total && !progress; a++) {
                if (state[a] !== 1 || counts[a] === 0) continue;
                const ua = unknownOf(a);
                if (!ua.length) continue;
                const restA = counts[a] - flagsOf(a);
                const ar = (a / COLS) | 0, ac = a % COLS;
                for (let br = Math.max(0, ar - 2); br <= Math.min(ROWS - 1, ar + 2) && !progress; br++) {
                    for (let bc = Math.max(0, ac - 2); bc <= Math.min(COLS - 1, ac + 2); bc++) {
                        const b = br * COLS + bc;
                        if (b === a || state[b] !== 1 || counts[b] === 0) continue;
                        const ub = unknownOf(b);
                        if (ub.length <= ua.length) continue;
                        if (!ua.every(x => ub.includes(x))) continue;
                        const diff = ub.filter(x => !ua.includes(x));
                        const restDiff = counts[b] - flagsOf(b) - restA;
                        if (restDiff === 0) {
                            for (const j of diff) if (!open(j)) return false;
                            progress = true;
                            break;
                        }
                        if (restDiff === diff.length) {
                            for (const j of diff) { state[j] = 2; flagged++; }
                            progress = true;
                            break;
                        }
                    }
                }
            }
            if (progress) continue;

            // Regra 4: contagem global de minas.
            const left = MINES - flagged;
            let closed = 0;
            for (let i = 0; i < total; i++) if (state[i] === 0) closed++;
            if (left === 0 && closed) {
                for (let i = 0; i < total; i++) if (state[i] === 0 && !open(i)) return false;
                progress = true;
            } else if (left === closed && closed) {
                for (let i = 0; i < total; i++) if (state[i] === 0) { state[i] = 2; flagged++; }
                progress = true;
            }
        }
        return opened >= goal;
    }

    function placeMines(excludeR, excludeC) {
        const startIdx = excludeR * COLS + excludeC;
        let mines = randomMines(excludeR, excludeC);
        if (noGuess) {
            const deadline = performance.now() + 350;
            let tries = 1;
            while (!solvable(mines, startIdx) && performance.now() < deadline) {
                mines = randomMines(excludeR, excludeC);
                tries++;
            }
            lastGenTries = tries;
        }
        for (let i = 0; i < mines.length; i++) {
            if (mines[i]) board[(i / COLS) | 0][i % COLS].isMine = true;
        }
    }
    let lastGenTries = 0;

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
            resetBtn.innerText = '😵';
            stopTimer();
            sfx('boom');
            buzz([40, 60, 120]);
            announce(`Você acertou uma mina. Fim de jogo em ${timer} segundos.`);
            showResult(false);
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
            cellData.isFlagged = true;
            cellElement.innerText = '🚩';
            flags++;
            sfx('flag');
            buzz(18);
        }
        cellElement.classList.toggle('flagged', cellData.isFlagged);
        labelCell(cellElement, cellData.isFlagged ? 'bandeira' : 'fechada');
        mineCountElement.innerText = formatNumber(MINES - flags);
        announce(`${MINES - flags} minas restantes.`);
    }

    /* Abre a célula e, se for zero, espalha em largura (BFS) — sem recursão,
       então nem o Especialista estoura a pilha. Cada célula ganha um atraso
       de animação proporcional à distância do toque: a "onda" de abertura. */
    function revealCell(r, c) {
        const queue = [[r, c, 0]];
        let head = 0;
        while (head < queue.length) {
            const [cr, cc, dist] = queue[head++];
            if (cr < 0 || cr >= ROWS || cc < 0 || cc >= COLS) continue;
            const cellData = board[cr][cc];
            if (cellData.isRevealed || cellData.isFlagged) continue;

            cellData.isRevealed = true;
            revealedCount++;

            const cellElement = getCellElement(cr, cc);
            cellElement.style.setProperty('--d', `${Math.min(dist, 14) * 18}ms`);
            cellElement.classList.add('revealed');
            labelCell(cellElement, cellData.neighborMines ? `minas vizinhas: ${cellData.neighborMines}` : 'vazia');

            if (cellData.neighborMines > 0) {
                cellElement.innerText = cellData.neighborMines;
                cellElement.dataset.num = cellData.neighborMines;
            } else {
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        if (dr || dc) queue.push([cr + dr, cc + dc, dist + 1]);
                    }
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
                        labelCell(cellElement, 'mina');
                        cellElement.classList.add('revealed');
                    }
                } else if (board[r][c].isFlagged) {
                    // Wrong flag
                    const cellElement = getCellElement(r, c);
                    cellElement.innerText = '❌';
                    labelCell(cellElement, 'bandeira incorreta');
                }
            }
        }
    }

    function checkWin() {
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
                        labelCell(cellElement, 'bandeira');
                    }
                }
            }
            mineCountElement.innerText = '000';
            sfx('win');
            buzz([25, 40, 25, 40, 60]);
            const seconds = preciseSeconds();
            recordBest(seconds);
            announce(`Campo limpo em ${seconds.toLocaleString('pt-BR')} segundos.`);
            showResult(true, seconds);
        }
    }

    /* Relógio por performance.now(): setInterval atrasa em aba lenta e
       acumulava erro; aqui o tempo é sempre "agora − início". O display
       mostra segundos inteiros (como o original); o recorde guarda décimos. */
    function tickTimer() {
        const ms = timerElapsed + (timerInterval ? performance.now() - timerStart : 0);
        timer = Math.min(999, Math.floor(ms / 1000));
        timerElement.innerText = formatNumber(timer);
        return ms;
    }

    function startTimer() {
        if (timerInterval) return;
        timerStart = performance.now();
        timerInterval = setInterval(tickTimer, 250);
        tickTimer();
    }

    function stopTimer() {
        if (timerInterval) timerElapsed += performance.now() - timerStart;
        clearInterval(timerInterval);
        timerInterval = null;
        tickTimer();
    }

    function preciseSeconds() {
        return Math.round(tickTimer() / 100) / 10;
    }

    function formatNumber(num) {
        const sign = num < 0 ? '-' : '';
        return sign + Math.abs(num).toString().padStart(sign ? 2 : 3, '0');
    }

    function getCellElement(r, c) {
        return board[r][c].element;
    }

    resetBtn.addEventListener('click', initGame);
    difficultySelect.addEventListener('change', () => {
        try {
            localStorage.setItem(LEVEL_KEY, difficultySelect.value);
        } catch (err) {
            /* Sem storage o nível vale só nesta visita. */
        }
        renderBest();
        initGame();
    });
    resultAgain.addEventListener('click', initGame);
    resultLook.addEventListener('click', () => {
        hideResult();
        resetBtn.focus({ preventScroll: true });
    });
    window.addEventListener('resize', updateCellSize);
    window.addEventListener('orientationchange', () => setTimeout(updateCellSize, 120));

    let timerPausedByTab = false;
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            endPress();
            timerPausedByTab = timerInterval !== null;
            stopTimer();
        } else if (timerPausedByTab && !gameOver && !firstClick) {
            startTimer();
            timerPausedByTab = false;
        }
    });
    window.addEventListener('blur', () => endPress());

    flagToggle?.addEventListener('click', () => setFlagMode(!flagMode));

    if (noGuessToggle) {
        noGuessToggle.checked = noGuess;
        noGuessToggle.addEventListener('change', () => {
            noGuess = noGuessToggle.checked;
            try {
                localStorage.setItem(NOGUESS_KEY, noGuess ? '1' : '0');
            } catch (err) {
                /* Sem storage a escolha vale só nesta visita. */
            }
            // Vale a partir do próximo campo; se ainda não houve toque, já vale neste.
            announce(noGuess ? 'Sem chute ativado: os campos se resolvem só com lógica.' : 'Sem chute desativado.');
        });
    }

    /* F alterna o modo pelo teclado — o equivalente do botão direito para quem
       joga no notebook sem mouse. */
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !resultEl.hidden) {
            hideResult();
            return;
        }
        if (e.key === 'f' || e.key === 'F') {
            if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.target.closest('input, select, textarea')) return;
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
