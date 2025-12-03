const canvas = document.getElementById('tetris');
const context = canvas.getContext('2d');
const nextCanvas = document.getElementById('next');
const nextContext = nextCanvas.getContext('2d');

// Scale everything up
context.scale(20, 20);
nextContext.scale(20, 20);

// Game Boy Palette
const colors = [
    null,
    '#0f380f', // Darkest (Block fill)
    '#306230', // Dark (Block border)
    '#8bac0f', // Light (Empty space/bg)
    '#9bbc0f', // Lightest (Highlight)
];

// Tetromino definitions
const pieces = 'ILJOTSZ';
const piecesMap = {
    'I': [
        [0, 1, 0, 0],
        [0, 1, 0, 0],
        [0, 1, 0, 0],
        [0, 1, 0, 0],
    ],
    'L': [
        [0, 1, 0],
        [0, 1, 0],
        [0, 1, 1],
    ],
    'J': [
        [0, 1, 0],
        [0, 1, 0],
        [1, 1, 0],
    ],
    'O': [
        [1, 1],
        [1, 1],
    ],
    'Z': [
        [1, 1, 0],
        [0, 1, 1],
        [0, 0, 0],
    ],
    'S': [
        [0, 1, 1],
        [1, 1, 0],
        [0, 0, 0],
    ],
    'T': [
        [0, 1, 0],
        [1, 1, 1],
        [0, 0, 0],
    ],
};

function createPiece(type) {
    return piecesMap[type];
}

function arenaSweep() {
    let rowCount = 1;
    outer: for (let y = arena.length - 1; y > 0; --y) {
        for (let x = 0; x < arena[y].length; ++x) {
            if (arena[y][x] === 0) {
                continue outer;
            }
        }

        const row = arena.splice(y, 1)[0].fill(0);
        arena.unshift(row);
        ++y;

        player.score += rowCount * 10;
        rowCount *= 2;
    }
}

function collide(arena, player) {
    const m = player.matrix;
    const o = player.pos;
    for (let y = 0; y < m.length; ++y) {
        for (let x = 0; x < m[y].length; ++x) {
            if (m[y][x] !== 0 &&
                (arena[y + o.y] &&
                    arena[y + o.y][x + o.x]) !== 0) {
                return true;
            }
        }
    }
    return false;
}

function createMatrix(w, h) {
    const matrix = [];
    while (h--) {
        matrix.push(new Array(w).fill(0));
    }
    return matrix;
}

function drawMatrix(matrix, offset, ctx = context) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                // Draw block
                ctx.fillStyle = colors[1]; // Darkest
                ctx.fillRect(x + offset.x, y + offset.y, 1, 1);

                // Draw inner detail for "retro" look
                ctx.fillStyle = colors[2];
                ctx.fillRect(x + offset.x + 0.1, y + offset.y + 0.1, 0.8, 0.8);

                ctx.fillStyle = colors[1];
                ctx.fillRect(x + offset.x + 0.3, y + offset.y + 0.3, 0.4, 0.4);
            }
        });
    });
}

function draw() {
    // Clear screen with "screen bg" color
    context.fillStyle = colors[3];
    context.fillRect(0, 0, canvas.width, canvas.height);

    drawMatrix(arena, { x: 0, y: 0 });
    drawMatrix(player.matrix, player.pos);
}

function drawNext() {
    nextContext.fillStyle = colors[3];
    nextContext.fillRect(0, 0, nextCanvas.width, nextCanvas.height);

    // Center the next piece
    const matrix = player.next;
    const offset = {
        x: (4 - matrix[0].length) / 2,
        y: (4 - matrix.length) / 2
    };
    drawMatrix(matrix, offset, nextContext);
}

function merge(arena, player) {
    player.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                arena[y + player.pos.y][x + player.pos.x] = value;
            }
        });
    });
}

function rotate(matrix, dir) {
    for (let y = 0; y < matrix.length; ++y) {
        for (let x = 0; x < y; ++x) {
            [
                matrix[x][y],
                matrix[y][x],
            ] = [
                    matrix[y][x],
                    matrix[x][y],
                ];
        }
    }

    if (dir > 0) {
        matrix.forEach(row => row.reverse());
    } else {
        matrix.reverse();
    }
}

function playerDrop() {
    player.pos.y++;
    if (collide(arena, player)) {
        player.pos.y--;
        merge(arena, player);
        playerReset();
        arenaSweep();
        updateScore();
    }
    dropCounter = 0;
}

function playerMove(offset) {
    player.pos.x += offset;
    if (collide(arena, player)) {
        player.pos.x -= offset;
    }
}

function playerReset() {
    if (player.next === null) {
        player.next = createPiece(pieces[pieces.length * Math.random() | 0]);
    }
    player.matrix = player.next;
    player.next = createPiece(pieces[pieces.length * Math.random() | 0]);

    player.pos.y = 0;
    player.pos.x = (arena[0].length / 2 | 0) -
        (player.matrix[0].length / 2 | 0);

    if (collide(arena, player)) {
        arena.forEach(row => row.fill(0));
        player.score = 0;
        updateScore();
    }
    drawNext();
}

function playerRotate(dir) {
    const pos = player.pos.x;
    let offset = 1;
    rotate(player.matrix, dir);
    while (collide(arena, player)) {
        player.pos.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (offset > player.matrix[0].length) {
            rotate(player.matrix, -dir);
            player.pos.x = pos;
            return;
        }
    }
}

let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;

function update(time = 0) {
    const deltaTime = time - lastTime;
    lastTime = time;

    dropCounter += deltaTime;
    if (dropCounter > dropInterval) {
        playerDrop();
    }

    draw();
    requestAnimationFrame(update);
}

function updateScore() {
    document.getElementById('score').innerText = player.score;
    // Simple level logic
    const level = Math.floor(player.score / 100) + 1;
    document.getElementById('level').innerText = level;
    dropInterval = Math.max(100, 1000 - (level - 1) * 100);
}

const arena = createMatrix(10, 20);

const player = {
    pos: { x: 0, y: 0 },
    matrix: null,
    next: null,
    score: 0,
};

document.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft') {
        playerMove(-1);
    } else if (event.key === 'ArrowRight') {
        playerMove(1);
    } else if (event.key === 'ArrowDown') {
        playerDrop();
    } else if (event.key === 'q' || event.key === 'Q') {
        playerRotate(-1);
    } else if (event.key === 'w' || event.key === 'W' || event.key === 'ArrowUp') {
        playerRotate(1);
    } else if (event.key === ' ') {
        playerDrop();
    }
});

// Touch controls
document.querySelector('.d-pad .left').addEventListener('click', () => playerMove(-1));
document.querySelector('.d-pad .right').addEventListener('click', () => playerMove(1));
document.querySelector('.d-pad .down').addEventListener('click', () => playerDrop());
document.querySelector('.d-pad .up').addEventListener('click', () => playerRotate(1));
document.querySelector('.btn-a').addEventListener('click', () => playerRotate(1));
document.querySelector('.btn-b').addEventListener('click', () => playerRotate(-1));

playerReset();
updateScore();
update();
