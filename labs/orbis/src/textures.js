/**
 * Mapas equiretangulares dos planetas e luas reais.
 * Pintados no canvas (domínio público, sem foto de terceiros): crateras,
 * continentes, faixas de Júpiter e a Grande Mancha Vermelha.
 * y = 0 é o polo norte; longitude -180 fica na borda esquerda.
 */

function canvas(w = 1024, h = 512) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
}

function rng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function xy(w, h, lon, lat) {
    return [((lon + 180) / 360) * w, ((90 - lat) / 180) * h];
}

function fillPoly(ctx, w, h, pts) {
    ctx.beginPath();
    pts.forEach((p, i) => {
        const [x, y] = xy(w, h, p[0], p[1]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
}

function ellipse(ctx, w, h, lon, lat, rx, ry) {
    const [x, y] = xy(w, h, lon, lat);
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
}

function craters(ctx, w, h, seed, count, rim) {
    const rand = rng(seed);
    for (let i = 0; i < count; i++) {
        const x = rand() * w;
        const y = rand() * h * 0.92 + h * 0.04;
        const r = 1.5 + rand() ** 2.4 * (i < count * 0.06 ? 54 : 16);
        const g = ctx.createRadialGradient(x - r * 0.28, y - r * 0.32, r * 0.08, x, y, r);
        g.addColorStop(0, 'rgba(22,20,18,0.78)');
        g.addColorStop(0.58, 'rgba(80,76,72,0.05)');
        g.addColorStop(0.76, rim);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }
}

function paintMercury() {
    const c = canvas();
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, c.height);
    g.addColorStop(0, '#6a6662');
    g.addColorStop(0.5, '#9a928a');
    g.addColorStop(1, '#5c5854');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);
    craters(ctx, c.width, c.height, 101, 220, 'rgba(214,208,198,0.7)');
    ctx.fillStyle = 'rgba(186,178,168,0.45)';
    ellipse(ctx, c.width, c.height, -170, 30, 70, 48);
    return c;
}

function paintVenus() {
    const c = canvas();
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, c.height);
    g.addColorStop(0, '#c9a15a');
    g.addColorStop(0.45, '#f0d48a');
    g.addColorStop(1, '#b88848');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);
    const rand = rng(202);
    for (let i = 0; i < 28; i++) {
        ctx.strokeStyle = i % 2 ? 'rgba(255,236,190,0.28)' : 'rgba(140,90,40,0.22)';
        ctx.lineWidth = 10 + rand() * 26;
        ctx.beginPath();
        const y = rand() * c.height;
        ctx.moveTo(0, y);
        for (let x = 0; x <= c.width; x += 80) {
            ctx.quadraticCurveTo(x + 20, y + (rand() - 0.5) * 80, x + 80, y + Math.sin(i + x * 0.01) * 24);
        }
        ctx.stroke();
    }
    return c;
}

/** Continentes simplificados, reconhecíveis no globo. */
const LAND = [
    // América do Norte
    [[-168, 66], [-166, 60], [-153, 58], [-141, 60], [-136, 57], [-130, 54], [-127, 50], [-124, 48], [-124, 40], [-122, 36], [-117, 32], [-114, 27], [-109, 23], [-105, 21], [-97, 16], [-91, 14], [-87, 13], [-83, 8], [-81, 8], [-83, 13], [-90, 16], [-96, 19], [-97, 26], [-97, 29], [-94, 29], [-89, 29], [-84, 30], [-81, 25], [-80, 25], [-81, 31], [-76, 35], [-75, 39], [-70, 42], [-67, 45], [-64, 47], [-60, 50], [-56, 53], [-62, 58], [-64, 60], [-78, 62], [-88, 64], [-95, 66], [-112, 68], [-140, 70], [-156, 71], [-166, 68]],
    // Groenlândia
    [[-68, 76], [-62, 78], [-52, 76], [-44, 70], [-42, 68], [-44, 60], [-50, 61], [-56, 66], [-62, 66], [-68, 70], [-72, 76]],
    // América do Sul
    [[-80, 9], [-77, 8], [-75, 6], [-70, 8], [-67, 10], [-62, 8], [-60, 6], [-50, 1], [-48, -1], [-44, -2], [-35, -5], [-35, -8], [-39, -16], [-39, -22], [-41, -22], [-48, -28], [-52, -33], [-58, -38], [-62, -40], [-65, -44], [-68, -50], [-71, -52], [-74, -48], [-73, -40], [-71, -32], [-71, -18], [-76, -14], [-79, -6], [-80, 1]],
    // Europa
    [[-9, 37], [-9, 42], [-8, 43], [-9, 52], [-5, 54], [-2, 53], [2, 51], [5, 53], [8, 55], [10, 58], [12, 56], [18, 55], [22, 55], [24, 60], [28, 64], [30, 60], [30, 46], [28, 41], [22, 40], [19, 40], [16, 40], [12, 42], [10, 44], [3, 43], [-1, 43], [-5, 36]],
    // África
    [[-17, 21], [-16, 14], [-17, 12], [-13, 8], [-10, 5], [-5, 5], [5, 4], [9, 4], [10, 1], [13, -6], [12, -18], [14, -22], [18, -33], [20, -35], [26, -34], [32, -29], [33, -26], [35, -20], [39, -15], [42, -10], [43, 2], [51, 11], [43, 11], [43, 12], [39, 15], [32, 31], [25, 32], [20, 32], [10, 37], [10, 33], [3, 36], [-2, 35], [-6, 35], [-9, 32], [-10, 30], [-17, 21]],
    // Madagascar
    [[43, -12], [44, -16], [47, -25], [44, -25], [43, -16]],
    // Ásia
    [[28, 41], [32, 36], [36, 36], [44, 37], [48, 40], [54, 37], [56, 37], [60, 25], [66, 25], [70, 22], [73, 19], [77, 8], [80, 6], [80, 10], [78, 15], [88, 22], [92, 22], [95, 16], [98, 8], [104, 1], [109, -1], [104, 2], [109, 13], [109, 20], [120, 23], [122, 30], [122, 37], [128, 35], [132, 35], [135, 48], [142, 47], [142, 53], [156, 51], [162, 60], [170, 66], [180, 68], [180, 72], [160, 71], [140, 72], [120, 75], [90, 76], [70, 74], [60, 70], [44, 68], [40, 66], [30, 60], [28, 46]],
    // Índia
    [[68, 24], [72, 21], [77, 8], [80, 8], [88, 22], [80, 26], [72, 25]],
    // Arábia
    [[35, 30], [36, 28], [43, 16], [52, 16], [57, 25], [56, 27], [48, 30], [44, 30], [36, 32]],
    // Japão
    [[130, 31], [131, 34], [141, 41], [145, 43], [142, 45], [140, 36], [136, 35], [132, 34]],
    // Reino Unido
    [[-6, 50], [-5, 58], [-2, 58], [1, 53], [1, 51], [-2, 50]],
    // Austrália
    [[113, -22], [122, -16], [136, -12], [142, -11], [145, -15], [153, -27], [150, -37], [147, -39], [140, -38], [136, -35], [124, -33], [115, -34], [114, -28]],
    // Nova Zelândia
    [[166, -41], [175, -37], [178, -39], [174, -42], [168, -46], [166, -46]],
    // Indonésia (manchas)
    [[95, 5], [105, 6], [117, -3], [120, -8], [114, -8], [106, -6], [102, -1]],
    [[120, 2], [125, 1], [128, -3], [122, -4]]
];

const DESERT = [
    [[-12, 28], [-8, 20], [10, 18], [30, 18], [36, 30], [12, 32], [0, 32]],
    [[36, 30], [44, 22], [55, 18], [56, 26], [48, 30]],
    [[122, -20], [140, -20], [145, -28], [128, -30], [120, -26]]
];

function paintEarth() {
    const c = canvas();
    const ctx = c.getContext('2d');
    const w = c.width;
    const h = c.height;
    const ocean = ctx.createLinearGradient(0, 0, 0, h);
    ocean.addColorStop(0, '#d7e4ee');
    ocean.addColorStop(0.08, '#1d5f9a');
    ocean.addColorStop(0.5, '#0c3f86');
    ocean.addColorStop(0.92, '#1a6294');
    ocean.addColorStop(1, '#e7eef4');
    ctx.fillStyle = ocean;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#3c8f45';
    for (const poly of LAND) fillPoly(ctx, w, h, poly);
    ctx.fillStyle = '#c6a15a';
    for (const poly of DESERT) fillPoly(ctx, w, h, poly);
    ctx.fillStyle = '#2f6d38';
    fillPoly(ctx, w, h, [[-78, 2], [-70, -2], [-60, -4], [-52, -2], [-58, 2], [-68, 4], [-76, 4]]);

    ctx.fillStyle = '#f4f7fb';
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let lon = -180; lon <= 180; lon += 12) {
        const lat = -70 + Math.sin(lon * 0.07) * 4 + Math.cos(lon * 0.13) * 2;
        const [x, y] = xy(w, h, lon, lat);
        ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.fill();
    ellipse(ctx, w, h, -42, 72, 36, 22);
    return c;
}

function paintMars() {
    const c = canvas();
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, c.height);
    g.addColorStop(0, '#e4d2c4');
    g.addColorStop(0.18, '#c4623a');
    g.addColorStop(0.5, '#a84828');
    g.addColorStop(0.82, '#c25a34');
    g.addColorStop(1, '#efe4da');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#6e3424';
    ellipse(ctx, c.width, c.height, 70, 10, 70, 48);
    ellipse(ctx, c.width, c.height, -30, 20, 50, 28);
    ctx.fillStyle = '#d07a52';
    ellipse(ctx, c.width, c.height, 70, -42, 46, 30);
    ctx.strokeStyle = '#4a2418';
    ctx.lineWidth = 7;
    ctx.beginPath();
    const a = xy(c.width, c.height, -110, -8);
    const b = xy(c.width, c.height, -40, -14);
    ctx.moveTo(a[0], a[1]);
    ctx.quadraticCurveTo((a[0] + b[0]) / 2, a[1] + 10, b[0], b[1]);
    ctx.stroke();
    ctx.fillStyle = '#e8d0c0';
    ellipse(ctx, c.width, c.height, -135, 18, 22, 18);
    craters(ctx, c.width, c.height, 404, 70, 'rgba(232,180,150,0.45)');
    return c;
}

function bands(ctx, w, h, rows, contrast = 1) {
    const segs = 48;
    for (let y = 0; y < h; y++) {
        const lat = 90 - (y / h) * 180;
        for (let s = 0; s < segs; s++) {
            const lon = -180 + (s / segs) * 360;
            const wobble = Math.sin(lon * 0.035 + lat * 0.15) * 4 + Math.sin(lon * 0.09) * 1.6;
            const sample = lat + wobble;
            let color = rows[0][2];
            for (const row of rows) {
                if (sample <= row[0] && sample >= row[1]) color = row[2];
            }
            ctx.fillStyle = color;
            ctx.globalAlpha = contrast;
            ctx.fillRect((s / segs) * w, y, w / segs + 1, 1);
        }
    }
    ctx.globalAlpha = 1;
}

function paintJupiter() {
    const c = canvas();
    const ctx = c.getContext('2d');
    bands(ctx, c.width, c.height, [
        [90, 58, '#9aabbc'],
        [58, 42, '#e4d2b4'],
        [42, 28, '#b56b48'],
        [28, 16, '#f0e0c4'],
        [16, 7, '#c4784e'],
        [7, -7, '#f3e6cc'],
        [-7, -22, '#a24e38'],
        [-22, -34, '#edd8b6'],
        [-34, -48, '#b87450'],
        [-48, -62, '#dcc8aa'],
        [-62, -90, '#8ea0b0']
    ]);
    ctx.fillStyle = '#c44732';
    ellipse(ctx, c.width, c.height, -48, -22, 58, 28);
    ctx.fillStyle = 'rgba(255,220,190,0.35)';
    ellipse(ctx, c.width, c.height, -40, -18, 22, 10);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ellipse(ctx, c.width, c.height, 40, -34, 18, 8);
    ellipse(ctx, c.width, c.height, 110, 36, 16, 7);
    return c;
}

function paintSaturn() {
    const c = canvas();
    const ctx = c.getContext('2d');
    bands(ctx, c.width, c.height, [
        [90, 62, '#d9d3c4'],
        [62, 40, '#f0e2c0'],
        [40, 18, '#e4c98a'],
        [18, -8, '#f6edd4'],
        [-8, -24, '#e2c48a'],
        [-24, -48, '#f3e6c8'],
        [-48, -90, '#d4cbb8']
    ]);
    return c;
}

function paintUranus() {
    const c = canvas();
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, c.height);
    g.addColorStop(0, '#d5f4f2');
    g.addColorStop(0.5, '#7ecfcb');
    g.addColorStop(1, '#c8eeea');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(0, c.height * 0.42, c.width, 18);
    ctx.fillRect(0, c.height * 0.58, c.width, 10);
    return c;
}

function paintNeptune() {
    const c = canvas();
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, c.height);
    g.addColorStop(0, '#3d78c8');
    g.addColorStop(0.5, '#163e92');
    g.addColorStop(1, '#2a62b0');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = 'rgba(10,24,70,0.55)';
    ellipse(ctx, c.width, c.height, -40, -28, 48, 22);
    ctx.fillStyle = 'rgba(230,240,255,0.55)';
    ellipse(ctx, c.width, c.height, -18, -20, 16, 6);
    ellipse(ctx, c.width, c.height, 80, 12, 28, 5);
    return c;
}

function paintMoon(seed, base, rim) {
    const c = canvas(512, 256);
    const ctx = c.getContext('2d');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, c.width, c.height);
    craters(ctx, c.width, c.height, seed, 90, rim);
    return c;
}

function paintIo() {
    const c = canvas(512, 256);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#e2c15a';
    ctx.fillRect(0, 0, c.width, c.height);
    const spots = [[20, 10, '#d2d6c8'], [-40, -8, '#3a3a38'], [80, 18, '#c45a28'], [-120, 20, '#f2e2a0'], [140, -16, '#6a4030']];
    for (const [lon, lat, color] of spots) {
        ctx.fillStyle = color;
        ellipse(ctx, c.width, c.height, lon, lat, 28, 18);
    }
    return c;
}

function paintEuropa() {
    const c = canvas(512, 256);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#e7e2d4';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = 'rgba(150,90,60,0.55)';
    ctx.lineWidth = 2;
    const rand = rng(77);
    for (let i = 0; i < 18; i++) {
        ctx.beginPath();
        ctx.moveTo(rand() * c.width, rand() * c.height);
        ctx.lineTo(rand() * c.width, rand() * c.height);
        ctx.stroke();
    }
    return c;
}

function paintTitan() {
    const c = canvas(512, 256);
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, c.height);
    g.addColorStop(0, '#e6b06a');
    g.addColorStop(1, '#c48448');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);
    return c;
}

const PAINTERS = {
    mercury: paintMercury,
    venus: paintVenus,
    earth: paintEarth,
    mars: paintMars,
    jupiter: paintJupiter,
    saturn: paintSaturn,
    uranus: paintUranus,
    neptune: paintNeptune,
    moon: () => paintMoon(11, '#b7b1a8', 'rgba(236,232,226,0.75)'),
    phobos: () => paintMoon(19, '#6e645c', 'rgba(160,140,120,0.6)'),
    deimos: () => paintMoon(23, '#7a7068', 'rgba(170,150,130,0.55)'),
    io: paintIo,
    europa: paintEuropa,
    titan: paintTitan,
    enceladus: () => paintMoon(31, '#f4f7fb', 'rgba(180,200,220,0.45)'),
    titania: () => paintMoon(37, '#a8b0b4', 'rgba(220,224,228,0.6)'),
    oberon: () => paintMoon(41, '#8e9498', 'rgba(200,204,208,0.55)'),
    triton: () => paintMoon(47, '#d7c8d4', 'rgba(236,226,232,0.7)'),
    proteus: () => paintMoon(53, '#8a8680', 'rgba(200,196,190,0.5)')
};

export function createPlanetTexture(id) {
    const paint = PAINTERS[id] || PAINTERS.moon;
    return paint();
}
