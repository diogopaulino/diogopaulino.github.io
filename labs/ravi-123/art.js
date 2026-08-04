/* ==========================================================================
   Mickey 1·2·3 — pixel art engine and assets
   ========================================================================== */

export const W = 640;
export const H = 400;

export const C = {
  ink: '#000000',
  white: '#ffffff',
  cream: '#ffffff',
  skin: '#ffccaa',
  sky: '#55ffff',
  grass: '#00aa00',
  red: '#aa0000',
  yellow: '#ffff55',
  blue: '#0000aa',
  pink: '#ff55ff',
  orange: '#aa5500',
  green: '#00aa00',
  gray: '#aaaaaa',
  night: '#0000aa',
  moon: '#ffff55'
};

const PALETTE = {
  '.': null,
  'k': C.ink,
  'w': C.white,
  'r': C.red,
  'g': C.grass,
  'b': C.blue,
  'y': C.yellow,
  'o': C.orange,
  'p': C.pink,
  'c': C.sky,
  's': C.skin,
  'd': '#cc8855',
  'a': C.gray,
  'D': '#555555' // dark gray
};

const SPRITE_CACHE = {};
const SCALE = 4;

function getSpriteCanvas(spriteStr, sc = SCALE) {
  const key = spriteStr + '_' + sc;
  if (SPRITE_CACHE[key]) return SPRITE_CACHE[key];
  
  const lines = spriteStr.trim().split('\n').map(l => l.trim());
  const w = lines[0].length;
  const h = lines.length;
  
  const canvas = document.createElement('canvas');
  canvas.width = w * sc;
  canvas.height = h * sc;
  const ctx = canvas.getContext('2d');
  
  for (let cy = 0; cy < h; cy++) {
    for (let cx = 0; cx < w; cx++) {
      const char = lines[cy][cx];
      if (char && PALETTE[char]) {
        ctx.fillStyle = PALETTE[char];
        ctx.fillRect(cx * sc, cy * sc, sc, sc);
      }
    }
  }
  SPRITE_CACHE[key] = canvas;
  return canvas;
}

function drawSprite(ctx, spriteStr, x, y, anchorX = 0.5, anchorY = 1.0, flip = false, sc = SCALE) {
  const canvas = getSpriteCanvas(spriteStr, sc);
  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(canvas, -canvas.width * anchorX, -canvas.height * anchorY);
  ctx.restore();
}

// ============================================================================
// SPRITES
// ============================================================================

const sprMickey = `
......kkkk......
....kkkkkkkk....
...kkkkkkkkkk...
..kkkkskkskkkk..
..kkksssssskkk..
...kssssssssk...
...kksksskskk...
....ssssssss....
....skksskk.....
...sskksskk.....
.....ssss.......
...kkkkkkkk.....
..kkkkkkkkkk....
..wwkkkkkkw.....
..wwkrrrkkww....
...rrrrrrrr.....
...rrrrrrrr.....
....yy..yy......
...yyyy.yyyy....
..yyyyy.yyyyy...
..yyyyy.yyyyy...
...yyy...yyy....
`;

const sprMinnie = `
......rrrr......
....rrrrrrrr....
...rrrrrrrrrr...
..kkkkskkskkkk..
..kkksssssskkk..
...kssssssssk...
...kksksskskk...
....ssssssss....
....skksskk.....
...sskksskk.....
.....ssss.......
...pppppppp.....
..pppppppppp....
..pppppppppp....
..wwppppppww....
...pppppppp.....
...pppppppp.....
....yy..yy......
...yyyy.yyyy....
..yyyyy.yyyyy...
...yyy...yyy....
................
`;

const sprDonald = `
......bbbb......
.....bbbbbb.....
....wwwwwwww....
...wwwwwwwwww...
...wkwwwwwkw....
....wwwwwwww....
....wooooww.....
....oooooo......
...bwwbbwwb.....
..bbbwwbbwwb....
..bbbbbbbbbb....
..wwbbbbbbww....
...wwwwwwww.....
...wwwwwwww.....
....yy..yy......
...yyyy.yyyy....
...yyy...yyy....
................
`;

const sprGoofy = `
......kkkk......
......kkkk......
.....kkkkkk.....
.....ssssss.....
....ssssssss....
....skksskk.....
....ssssssss....
....ssssssss....
.....ssssss.....
.....oooooo.....
....oooooooo....
...oooooooooo...
...bboooooobb...
...bboooooobb...
...bboooooobb...
....bbbbbbbb....
....bbbbbbbb....
...bbbbbbbbbb...
...bbbbbbbbbb...
...yyyy..yyyy...
..yyyyy..yyyyy..
`;

const sprPluto = `
................
................
......yyyy......
.....yyyyyy.....
....ykkyykky....
....yyyyykyy....
...kkyyyyyyy....
...kkyyyyyyy....
...kk..rrr......
.......yyyy.....
......yyyyyy....
......yyyyyy....
.....yyyyyyyy...
.....yyyyyyyy...
.....yyy..yyy...
....yyyy..yyyy..
`;

const sprDaisy = `
......pppp......
.....pppppp.....
....wwwwwwww....
...wwwwwwwwww...
...wkwwwwwkw....
....wwwwwwww....
....wooooww.....
....oooooo......
...pwwppwwp.....
..pppwwppwwp....
..pppppppppp....
..wwppppppww....
...wwwwwwww.....
...wwwwwwww.....
....yy..yy......
...yyyy.yyyy....
...yyy...yyy....
................
`;

const sprGenericHero = `
......aaaa......
.....aaaaaa.....
....aasaasaa....
....ssssssss....
.....ssssss.....
...bbbbbbbbbb...
...bbbbbbbbbb...
...wwbbbbbbww...
...bbbbbbbbbb...
....bbbbbbbb....
....bbbbbbbb....
.....bb..bb.....
....bbb..bbb....
....aaa..aaa....
`;

const sprSheep = `
......wwww......
....wwwwwwww....
...wwwwwwwwww...
..wwwkkwwkkwww..
..wwwwwwwwwwww..
..wwwwwwwwwwww..
...wwwwwwwwww...
....wwwwwwww....
.....kk..kk.....
.....kk..kk.....
.....kk..kk.....
`;

const sprCar = `
................
.......rrrrr....
......rrrrrrr...
....ccrrrrrrrcc.
...ccccrrrrrcccc
..rrrrrrrrrrrrrr
..rrrrrrrrrrrrrr
..kkrrrrrrrrrrkk
..kkrrrrrrrrrrkk
..kk..........kk
`;

const sprPresent = `
......pp........
.....pppp.......
....pppppp......
...pppppppp.....
..bbbbbbbbbb....
..bppppppppbp...
..bpbbbbbbpbp...
..bppppppppbp...
..bpbbbbbbpbp...
..bppppppppbp...
..bbbbbbbbbbb...
`;

const sprMarketItem = `
...oo...
..oooo..
.ooyyoo.
.oooooo.
..oooo..
`;

// ============================================================================
// EXPORTS & APIS
// ============================================================================

export const HEROES = [
  { id: 'minnie', name: 'Minnie', title: 'Amiga', color: '#ff55ff', spr: sprMinnie },
  { id: 'donald', name: 'Donald', title: 'Pato', color: '#0000aa', spr: sprDonald },
  { id: 'goofy', name: 'Pateta', title: 'Amigo', color: '#00aa00', spr: sprGoofy },
  { id: 'daisy', name: 'Margarida', title: 'Amiga', color: '#ff55ff', spr: sprDaisy },
  { id: 'pluto', name: 'Pluto', title: 'Cão', color: '#ffff55', spr: sprPluto },
  { id: 'pete', name: 'Bafo de Onça', title: 'Inimigo', color: '#aaaaaa', spr: sprGenericHero },
  { id: 'scrooge', name: 'Tio Patinhas', title: 'Pato', color: '#0000aa', spr: sprGenericHero },
  { id: 'ludwig', name: 'Prof. Pardal', title: 'Gênio', color: '#55ffff', spr: sprGenericHero },
  { id: 'chip', name: 'Tico e Teco', title: 'Esquilos', color: '#aa5500', spr: sprGenericHero }
];

export const TOYS = [
  { id: 'sword', name: 'Espada', draw: (ctx, x, y) => drawSprite(ctx, sprPresent, x, y) },
  { id: 'shield', name: 'Escudo', draw: (ctx, x, y) => drawSprite(ctx, sprPresent, x, y) },
  { id: 'potion', name: 'Poção', draw: (ctx, x, y) => drawSprite(ctx, sprPresent, x, y) },
  { id: 'bow', name: 'Arco', draw: (ctx, x, y) => drawSprite(ctx, sprPresent, x, y) },
  { id: 'helm', name: 'Capacete', draw: (ctx, x, y) => drawSprite(ctx, sprPresent, x, y) },
  { id: 'dragon', name: 'Dragão', draw: (ctx, x, y) => drawSprite(ctx, sprPresent, x, y) },
  { id: 'trumpet', name: 'Trombeta', draw: (ctx, x, y) => drawSprite(ctx, sprPresent, x, y) },
  { id: 'orb', name: 'Bola Mágica', draw: (ctx, x, y) => drawSprite(ctx, sprPresent, x, y) },
  { id: 'doll', name: 'Boneco Mickey', draw: (ctx, x, y) => drawSprite(ctx, sprMickey, x, y) }
];

export const VEHICLES = [
  { id: 'walk', name: 'A pé', wheels: 0 },
  { id: 'uni', name: 'Monociclo', wheels: 1 },
  { id: 'moto', name: 'Moto', wheels: 2 },
  { id: 'tri', name: 'Triciclo', wheels: 3 },
  { id: 'car', name: 'Carrinho', wheels: 4 },
  { id: 'car5', name: 'Carro + estepe', wheels: 5 },
  { id: 'six', name: 'Carro 6 rodas', wheels: 6 },
  { id: 'six7', name: '6 rodas + estepe', wheels: 7 },
  { id: 'skates', name: 'Patins', wheels: 8 },
  { id: 'truck', name: 'Caminhão', wheels: 9 }
];

export const MARKET = [
  { id: 'burger', name: 'Hambúrguer', color: '#d97706' },
  { id: 'fries', name: 'Batata frita', color: '#fbbf24' },
  { id: 'apple', name: 'Maçã', color: '#ef4444' },
  { id: 'milk', name: 'Leite', color: '#f8fafc' },
  { id: 'balloon', name: 'Balão', color: '#ec4899' }
];

export function drawSky(ctx, opts = {}) {
  const night = !!opts.night;
  ctx.fillStyle = night ? C.night : C.sky;
  ctx.fillRect(0, 0, W, H);
  
  if (night) {
    ctx.fillStyle = C.moon;
    ctx.fillRect(520, 40, 40, 40);
  } else {
    ctx.fillStyle = C.white;
    ctx.fillRect(80, 50, 60, 20);
    ctx.fillRect(280, 36, 80, 24);
    ctx.fillRect(480, 60, 50, 16);
  }
}

export function drawGrass(ctx, y = 280) {
  ctx.fillStyle = C.grass;
  ctx.fillRect(0, y, W, H - y);
}

export function drawRavi(ctx, x, y, pose = 'idle', t = 0) {
  // y passed is around 220-300.
  // Add some bobbing for walking
  let oy = 0;
  if (pose === 'walk') oy = Math.sin(t * 10) * 8;
  if (pose === 'cheer') oy = Math.sin(t * 8) * 12;
  
  const flip = pose === 'walk' ? false : false;
  drawSprite(ctx, sprMickey, x, y + oy + 40, 0.5, 1.0, flip);
}

export function drawHero(ctx, hero, x, y, scale = 1, t = 0) {
  const oy = Math.sin(t * 7) * 4;
  drawSprite(ctx, hero.spr || sprGenericHero, x, y + oy + 30, 0.5, 1.0, false);
}

export function drawSheep(ctx, x, y, t = 0) {
  const oy = Math.abs(Math.sin(t * 8)) * -20;
  drawSprite(ctx, sprSheep, x, y + oy, 0.5, 1.0, false);
}

export function drawVehicle(ctx, id, x, y, t = 0) {
  if (id === 'walk') return;
  const oy = Math.sin(t * 12) * 4;
  drawSprite(ctx, sprCar, x, y + oy + 40, 0.5, 1.0, false, SCALE * 1.5);
}

export function drawHouseInterior(ctx, night = false) {
  ctx.fillStyle = night ? '#000055' : '#aaaaaa';
  ctx.fillRect(0, 0, W, H);
  
  ctx.fillStyle = night ? '#000000' : '#555555';
  ctx.fillRect(0, 300, W, 100);
  
  // window
  ctx.fillStyle = night ? C.night : C.sky;
  ctx.fillRect(480, 40, 120, 100);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 4;
  ctx.strokeRect(480, 40, 120, 100);
  ctx.strokeRect(540, 40, 4, 100);
  ctx.strokeRect(480, 90, 120, 4);
}

export function drawArmchair(ctx, x, y) {
  ctx.fillStyle = C.red;
  ctx.fillRect(x - 60, y - 40, 120, 80);
  ctx.fillStyle = '#550000';
  ctx.fillRect(x - 70, y - 30, 20, 90);
  ctx.fillRect(x + 50, y - 30, 20, 90);
}

export function drawFence(ctx, y = 260) {
  ctx.fillStyle = C.orange;
  for (let x = 40; x < W - 40; x += 50) {
    ctx.fillRect(x, y, 16, 80);
  }
  ctx.fillStyle = '#550000';
  ctx.fillRect(40, y + 20, W - 80, 12);
  ctx.fillRect(40, y + 50, W - 80, 12);
}

export function drawSignpost(ctx, x, y) {
  ctx.fillStyle = C.orange;
  ctx.fillRect(x - 8, y - 20, 16, 160);
  
  const labels = [
    { y: y, text: '1 FÁBRICA', col: C.red },
    { y: y + 40, text: '2 MERCADO', col: C.blue },
    { y: y + 80, text: '3 CORREIOS', col: C.green }
  ];
  
  labels.forEach(L => {
    ctx.fillStyle = L.col;
    ctx.fillRect(x + 8, L.y, 140, 32);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 4;
    ctx.strokeRect(x + 8, L.y, 140, 32);
    ctx.fillStyle = C.white;
    ctx.font = '20px "VT323", monospace';
    ctx.fillText(L.text, x + 16, L.y + 22);
  });
}

export function drawFactoryBg(ctx) {
  ctx.fillStyle = '#555555';
  ctx.fillRect(0, 0, W, H);
  
  ctx.fillStyle = '#aaaaaa';
  ctx.fillRect(0, 280, W, 120);
  
  // machine
  ctx.fillStyle = C.red;
  ctx.fillRect(40, 120, 120, 160);
  
  // belt
  ctx.fillStyle = '#000000';
  ctx.fillRect(160, 250, 420, 28);
  ctx.fillStyle = C.yellow;
  for (let x = 170; x < 560; x += 32) ctx.fillRect(x, 256, 16, 16);
}

export function drawGear(ctx, x, y, r, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = C.yellow;
  ctx.fillRect(-r/2, -r/2, r, r);
  ctx.fillStyle = '#550000';
  ctx.fillRect(-r/4, -r/4, r/2, r/2);
  ctx.restore();
}

export function drawMarketBg(ctx) {
  ctx.fillStyle = '#ffffaa';
  ctx.fillRect(0, 0, W, H);
  
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 ? C.red : C.white;
    ctx.fillRect(i * 40, 0, 40, 50);
  }
  
  for (let row = 0; row < 3; row++) {
    const y = 90 + row * 70;
    ctx.fillStyle = C.orange;
    ctx.fillRect(40, y, 560, 16);
  }
  
  ctx.fillStyle = C.orange;
  ctx.fillRect(80, 300, 480, 70);
  ctx.fillStyle = C.white;
  ctx.fillRect(100, 280, 120, 30);
  ctx.fillStyle = C.ink;
  ctx.font = '24px "VT323", monospace';
  ctx.fillText('CAIXA', 130, 304);
}

export function drawPostBg(ctx) {
  drawSky(ctx);
  drawGrass(ctx, 220);
  
  ctx.fillStyle = C.white;
  ctx.fillRect(180, 100, 280, 200);
  ctx.fillStyle = C.blue;
  ctx.fillRect(180, 80, 280, 40);
  ctx.fillStyle = C.white;
  ctx.font = '24px "VT323", monospace';
  ctx.fillText('CORREIOS', 260, 110);
  
  ctx.fillStyle = C.orange;
  ctx.fillRect(290, 200, 60, 100);
}

export function drawPartyBg(ctx) {
  drawHouseInterior(ctx, false);
  
  // table
  ctx.fillStyle = C.orange;
  ctx.fillRect(160, 280, 320, 24);
  ctx.fillStyle = '#550000';
  ctx.fillRect(180, 304, 16, 50);
  ctx.fillRect(444, 304, 16, 50);
  
  // cake
  ctx.fillStyle = C.pink;
  ctx.fillRect(280, 230, 80, 50);
  ctx.fillStyle = C.white;
  ctx.fillRect(290, 210, 60, 20);
}

export function drawStreet(ctx) {
  drawSky(ctx);
  drawGrass(ctx, 200);
  
  ctx.fillStyle = '#555555';
  ctx.fillRect(0, 300, W, 100);
  ctx.fillStyle = C.yellow;
  for (let x = 20; x < W; x += 60) ctx.fillRect(x, 345, 30, 8);
}

export function drawMarketItem(ctx, id, x, y, s = 1) {
  drawSprite(ctx, sprMarketItem, x, y + 20, 0.5, 1.0, false, SCALE * s);
}

export function drawNumberBadge(ctx, n, x, y, scale = 1) {
  ctx.fillStyle = C.white;
  ctx.fillRect(x - 22, y - 28, 44, 56);
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 4;
  ctx.strokeRect(x - 22, y - 28, 44, 56);
  ctx.fillStyle = C.red;
  ctx.font = '40px "VT323", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(n), x, y + 4);
}

export function makeConfetti(n = 60) {
  const cols = [C.red, C.yellow, C.blue, C.pink, C.green, C.orange];
  return Array.from({ length: n }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    speed: 40 + Math.random() * 80,
    color: cols[(Math.random() * cols.length) | 0]
  }));
}

export function drawConfetti(ctx, particles, t) {
  particles.forEach((p) => {
    const py = (p.y + t * p.speed) % (H + 40);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - 4, py - 4, 8, 8);
  });
}
