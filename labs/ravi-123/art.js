/* ==========================================================================
   Ravi 1·2·3 — arte cartoon VGA (estilo Mickey's 123 / Disney Soft 1990)
   Resolução lógica: 640 × 400
   ========================================================================== */

export const W = 640;
export const H = 400;

export const C = {
  ink: '#1a1420',
  white: '#fffef8',
  cream: '#fff6e0',
  skin: '#f6c89a',
  skinDk: '#e0a070',
  hair: '#3d2314',
  sky: '#7ec8f0',
  skyLt: '#b8e4ff',
  grass: '#5cb85c',
  grassDk: '#3d8f3d',
  dirt: '#c4a574',
  wood: '#a86f3c',
  woodDk: '#7a4a24',
  red: '#e83a3a',
  yellow: '#ffd23f',
  blue: '#3a7bd5',
  pink: '#ff6b9d',
  orange: '#ff8c42',
  purple: '#8b5cf6',
  green: '#2f9e44',
  gray: '#94a3b8',
  grayDk: '#475569',
  night: '#1a2744',
  moon: '#fff8c8'
};

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function fillStroke(ctx, fill, stroke = C.ink, lw = 3) {
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }
}

function ellipse(ctx, x, y, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
}

/** Céu em faixas suaves + nuvens opcionais */
export function drawSky(ctx, opts = {}) {
  const night = !!opts.night;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  if (night) {
    g.addColorStop(0, '#0f1a33');
    g.addColorStop(1, '#2a3a5c');
  } else {
    g.addColorStop(0, C.skyLt);
    g.addColorStop(0.55, C.sky);
    g.addColorStop(1, '#a8d8a8');
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  if (night) {
    ctx.fillStyle = C.moon;
    ctx.beginPath();
    ctx.arc(540, 70, 36, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f1a33';
    ctx.beginPath();
    ctx.arc(552, 62, 30, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 40; i++) {
      const sx = (i * 97 + 13) % W;
      const sy = (i * 53 + 7) % 160;
      ctx.fillStyle = i % 3 ? '#fff' : '#ffe9a8';
      ctx.fillRect(sx, sy, 2, 2);
    }
  } else {
    drawCloud(ctx, 80, 50, 1);
    drawCloud(ctx, 280, 36, 0.85);
    drawCloud(ctx, 480, 60, 1.1);
  }
}

export function drawCloud(ctx, x, y, s = 1) {
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ellipse(ctx, x, y, 28 * s, 16 * s); ctx.fill();
  ellipse(ctx, x + 22 * s, y - 6 * s, 22 * s, 14 * s); ctx.fill();
  ellipse(ctx, x + 42 * s, y + 2 * s, 24 * s, 15 * s); ctx.fill();
  ellipse(ctx, x + 18 * s, y + 8 * s, 30 * s, 12 * s); ctx.fill();
}

export function drawGrass(ctx, y = 280) {
  ctx.fillStyle = C.grass;
  ctx.fillRect(0, y, W, H - y);
  ctx.fillStyle = C.grassDk;
  for (let x = 0; x < W; x += 18) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 5, y - 10 - (x % 7));
    ctx.lineTo(x + 10, y);
    ctx.fill();
  }
  // faixa de terra
  ctx.fillStyle = C.dirt;
  ctx.fillRect(0, y + 70, W, 14);
}

export function drawHills(ctx, y = 250) {
  ctx.fillStyle = '#6ecf6e';
  ctx.beginPath();
  ctx.moveTo(0, y + 40);
  ctx.quadraticCurveTo(120, y - 30, 260, y + 20);
  ctx.quadraticCurveTo(400, y + 60, 640, y);
  ctx.lineTo(640, H);
  ctx.lineTo(0, H);
  ctx.fill();
  ctx.fillStyle = C.grass;
  ctx.beginPath();
  ctx.moveTo(0, y + 80);
  ctx.quadraticCurveTo(200, y + 20, 420, y + 70);
  ctx.quadraticCurveTo(540, y + 100, 640, y + 50);
  ctx.lineTo(640, H);
  ctx.lineTo(0, H);
  ctx.fill();
}

/** Ravi — herói convidador (cabeça grande estilo anos 90) */
export function drawRavi(ctx, x, y, pose = 'idle', t = 0) {
  ctx.save();
  ctx.translate(x, y);

  const bounce = pose === 'walk' ? Math.sin(t * 10) * 3 : pose === 'cheer' ? Math.sin(t * 8) * 4 : 0;
  ctx.translate(0, bounce);

  // sombra
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ellipse(ctx, 0, 58, 28, 8); ctx.fill();

  // pernas
  ctx.fillStyle = C.blue;
  if (pose === 'walk') {
    const swing = Math.sin(t * 10) * 0.35;
    ctx.save();
    ctx.translate(-8, 30);
    ctx.rotate(-swing);
    roundRect(ctx, -6, 0, 12, 26, 4); fillStroke(ctx, C.blue);
    roundRect(ctx, -8, 22, 14, 8, 3); fillStroke(ctx, C.red);
    ctx.restore();
    ctx.save();
    ctx.translate(8, 30);
    ctx.rotate(swing);
    roundRect(ctx, -6, 0, 12, 26, 4); fillStroke(ctx, C.blue);
    roundRect(ctx, -6, 22, 14, 8, 3); fillStroke(ctx, C.red);
    ctx.restore();
  } else {
    roundRect(ctx, -14, 28, 12, 28, 4); fillStroke(ctx, C.blue);
    roundRect(ctx, 2, 28, 12, 28, 4); fillStroke(ctx, C.blue);
    roundRect(ctx, -16, 52, 16, 10, 4); fillStroke(ctx, C.red);
    roundRect(ctx, 0, 52, 16, 10, 4); fillStroke(ctx, C.red);
  }

  // corpo / camiseta
  roundRect(ctx, -22, -5, 44, 40, 12); fillStroke(ctx, C.yellow);
  // emblema estrela
  ctx.fillStyle = C.red;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
    const r = i % 2 === 0 ? 8 : 4;
    const px = Math.cos(a) * r;
    const py = 12 + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2;
  ctx.stroke();

  // braços
  if (pose === 'sleep') {
    roundRect(ctx, -30, 5, 14, 22, 6); fillStroke(ctx, C.skin);
    roundRect(ctx, 16, 5, 14, 22, 6); fillStroke(ctx, C.skin);
  } else if (pose === 'cheer' || pose === 'wave') {
    ctx.save();
    ctx.translate(-24, 0);
    ctx.rotate(-0.9 + Math.sin(t * 6) * 0.2);
    roundRect(ctx, -6, 0, 12, 30, 6); fillStroke(ctx, C.skin);
    ctx.restore();
    ctx.save();
    ctx.translate(24, 0);
    ctx.rotate(0.9 - Math.sin(t * 6) * 0.2);
    roundRect(ctx, -6, 0, 12, 30, 6); fillStroke(ctx, C.skin);
    ctx.restore();
  } else {
    roundRect(ctx, -32, 2, 12, 28, 6); fillStroke(ctx, C.skin);
    roundRect(ctx, 20, 2, 12, 28, 6); fillStroke(ctx, C.skin);
  }

  // cabeça
  ellipse(ctx, 0, -28, 28, 26); fillStroke(ctx, C.skin, C.ink, 3);

  // cabelo
  ctx.beginPath();
  ctx.arc(0, -38, 26, Math.PI * 1.05, Math.PI * 1.95);
  fillStroke(ctx, C.hair, C.ink, 3);
  ellipse(ctx, -18, -36, 10, 12); fillStroke(ctx, C.hair, C.ink, 2);
  ellipse(ctx, 16, -38, 11, 13); fillStroke(ctx, C.hair, C.ink, 2);

  // olhos / sono
  if (pose === 'sleep') {
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-12, -28); ctx.quadraticCurveTo(-8, -24, -4, -28);
    ctx.moveTo(4, -28); ctx.quadraticCurveTo(8, -24, 12, -28);
    ctx.stroke();
    // Zzz
    ctx.fillStyle = C.blue;
    ctx.font = 'bold 14px Fredoka, sans-serif';
    ctx.fillText('z', 30, -50 - Math.sin(t * 3) * 4);
    ctx.fillText('Z', 40, -62 - Math.sin(t * 3 + 1) * 4);
  } else {
    ellipse(ctx, -10, -30, 5, 6); fillStroke(ctx, C.white, C.ink, 2);
    ellipse(ctx, 10, -30, 5, 6); fillStroke(ctx, C.white, C.ink, 2);
    ctx.fillStyle = C.ink;
    ctx.beginPath();
    ctx.arc(-9, -29, 2.5, 0, Math.PI * 2);
    ctx.arc(11, -29, 2.5, 0, Math.PI * 2);
    ctx.fill();
    // blush
    ctx.fillStyle = 'rgba(255,107,157,0.35)';
    ellipse(ctx, -18, -20, 6, 3); ctx.fill();
    ellipse(ctx, 18, -20, 6, 3); ctx.fill();
    // sorriso
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, -18, 8, 0.15, Math.PI - 0.15);
    ctx.stroke();
  }

  ctx.restore();
}

/** Heróis / guerreiros convidados */
export const HEROES = [
  { id: 'bolt', name: 'Sir Bolt', title: 'Cavaleiro', color: '#3a7bd5', accent: '#c0c8d8' },
  { id: 'luna', name: 'Luna', title: 'Feiticeira', color: '#8b5cf6', accent: '#e9d5ff' },
  { id: 'freya', name: 'Freya', title: 'Arqueira', color: '#2f9e44', accent: '#bbf7d0' },
  { id: 'kenzo', name: 'Kenzo', title: 'Samurai', color: '#e83a3a', accent: '#fecaca' },
  { id: 'bjorn', name: 'Bjorn', title: 'Viking', color: '#ff8c42', accent: '#fed7aa' },
  { id: 'shade', name: 'Shade', title: 'Ninja', color: '#475569', accent: '#cbd5e1' },
  { id: 'max', name: 'Maximus', title: 'Gladiador', color: '#b45309', accent: '#fde68a' },
  { id: 'ember', name: 'Ember & Spark', title: 'Dragões', color: '#e11d48', accent: '#fda4af' },
  { id: 'aria', name: 'Aria', title: 'Princesa Guerreira', color: '#db2777', accent: '#fbcfe8' }
];

export function drawHero(ctx, hero, x, y, scale = 1, t = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ellipse(ctx, 0, 42, 22, 6); ctx.fill();

  // corpo
  roundRect(ctx, -16, 0, 32, 34, 10); fillStroke(ctx, hero.color);

  // cabeça
  ellipse(ctx, 0, -18, 18, 17); fillStroke(ctx, C.skin, C.ink, 2.5);

  // acessórios por tipo
  switch (hero.id) {
    case 'bolt':
      // elmo
      ctx.beginPath();
      ctx.arc(0, -22, 18, Math.PI, 0);
      fillStroke(ctx, hero.accent);
      ctx.fillStyle = C.yellow;
      ctx.fillRect(-3, -42, 6, 14);
      break;
    case 'luna':
      // chapéu de bruxa
      ctx.beginPath();
      ctx.moveTo(-20, -22); ctx.lineTo(0, -55); ctx.lineTo(20, -22);
      fillStroke(ctx, hero.color);
      ellipse(ctx, 0, -22, 22, 5); fillStroke(ctx, hero.accent);
      break;
    case 'freya':
      // capuz / cabelo verde
      ctx.beginPath();
      ctx.arc(0, -24, 18, Math.PI, 0);
      fillStroke(ctx, '#166534');
      break;
    case 'kenzo':
      // topete
      ctx.beginPath();
      ctx.moveTo(-4, -32); ctx.lineTo(0, -50); ctx.lineTo(8, -30);
      fillStroke(ctx, C.ink);
      break;
    case 'bjorn':
      // capacete com chifres
      ellipse(ctx, 0, -26, 18, 10); fillStroke(ctx, hero.accent);
      ctx.beginPath();
      ctx.moveTo(-18, -28); ctx.quadraticCurveTo(-30, -45, -14, -38);
      fillStroke(ctx, C.cream);
      ctx.beginPath();
      ctx.moveTo(18, -28); ctx.quadraticCurveTo(30, -45, 14, -38);
      fillStroke(ctx, C.cream);
      break;
    case 'shade':
      // máscara
      roundRect(ctx, -14, -24, 28, 14, 4); fillStroke(ctx, C.ink);
      ctx.fillStyle = C.red;
      ctx.fillRect(-10, -20, 6, 3);
      ctx.fillRect(4, -20, 6, 3);
      break;
    case 'max':
      // crista
      ctx.beginPath();
      ctx.moveTo(-2, -32); ctx.lineTo(0, -48); ctx.lineTo(10, -30);
      fillStroke(ctx, C.red);
      ellipse(ctx, 0, -24, 18, 8); fillStroke(ctx, hero.accent);
      break;
    case 'ember':
      // orelhas de dragão + segundo dragãozinho
      ctx.beginPath();
      ctx.moveTo(-14, -28); ctx.lineTo(-22, -48); ctx.lineTo(-4, -34);
      fillStroke(ctx, hero.color);
      ctx.beginPath();
      ctx.moveTo(14, -28); ctx.lineTo(22, -48); ctx.lineTo(4, -34);
      fillStroke(ctx, '#f97316');
      // spark ao lado
      ctx.save();
      ctx.translate(28, 10);
      ctx.scale(0.55, 0.55);
      ellipse(ctx, 0, -10, 14, 13); fillStroke(ctx, '#fb923c');
      ellipse(ctx, 0, 8, 12, 14); fillStroke(ctx, '#f97316');
      ctx.restore();
      break;
    case 'aria':
      // coroa
      ctx.beginPath();
      ctx.moveTo(-14, -28);
      ctx.lineTo(-10, -42); ctx.lineTo(-4, -30);
      ctx.lineTo(0, -46); ctx.lineTo(4, -30);
      ctx.lineTo(10, -42); ctx.lineTo(14, -28);
      fillStroke(ctx, C.yellow);
      break;
    default:
      break;
  }

  // olhos (exceto shade que já tem máscara)
  if (hero.id !== 'shade') {
    ellipse(ctx, -6, -20, 3.5, 4); fillStroke(ctx, C.white, C.ink, 1.5);
    ellipse(ctx, 6, -20, 3.5, 4); fillStroke(ctx, C.white, C.ink, 1.5);
    ctx.fillStyle = C.ink;
    ctx.beginPath();
    ctx.arc(-5.5, -19.5, 1.8, 0, Math.PI * 2);
    ctx.arc(6.5, -19.5, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // sorriso
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, -12, 5, 0.2, Math.PI - 0.2);
  ctx.stroke();

  // braço acenando
  const wave = Math.sin(t * 7) * 0.4;
  ctx.save();
  ctx.translate(18, 8);
  ctx.rotate(0.5 + wave);
  roundRect(ctx, -4, 0, 10, 22, 4); fillStroke(ctx, C.skin, C.ink, 2);
  ctx.restore();

  ctx.restore();
}

export const TOYS = [
  { id: 'sword', name: 'Espada', draw: drawToySword },
  { id: 'shield', name: 'Escudo', draw: drawToyShield },
  { id: 'potion', name: 'Poção', draw: drawToyPotion },
  { id: 'bow', name: 'Arco', draw: drawToyBow },
  { id: 'helm', name: 'Capacete', draw: drawToyHelm },
  { id: 'dragon', name: 'Dragão', draw: drawToyDragon },
  { id: 'trumpet', name: 'Trombeta', draw: drawToyTrumpet },
  { id: 'orb', name: 'Bola Mágica', draw: drawToyOrb },
  { id: 'doll', name: 'Boneco Ravi', draw: drawToyDoll }
];

function drawToySword(ctx, x, y, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = C.gray; roundRect(ctx, -4, -28, 8, 36, 2); fillStroke(ctx, '#c0c8d8');
  ctx.fillStyle = C.yellow; roundRect(ctx, -12, 6, 24, 8, 2); fillStroke(ctx, C.yellow);
  ctx.fillStyle = C.red; ellipse(ctx, 0, 18, 6, 6); fillStroke(ctx, C.red);
  ctx.restore();
}
function drawToyShield(ctx, x, y, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(0, -24); ctx.quadraticCurveTo(24, -16, 20, 8); ctx.quadraticCurveTo(0, 28, -20, 8); ctx.quadraticCurveTo(-24, -16, 0, -24);
  fillStroke(ctx, C.blue);
  ctx.beginPath();
  ctx.moveTo(0, -12); ctx.lineTo(4, -2); ctx.lineTo(14, -2); ctx.lineTo(6, 4); ctx.lineTo(10, 14); ctx.lineTo(0, 8); ctx.lineTo(-10, 14); ctx.lineTo(-6, 4); ctx.lineTo(-14, -2); ctx.lineTo(-4, -2);
  fillStroke(ctx, C.yellow);
  ctx.restore();
}
function drawToyPotion(ctx, x, y, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  roundRect(ctx, -8, -8, 16, 28, 6); fillStroke(ctx, '#a78bfa');
  roundRect(ctx, -6, -18, 12, 12, 3); fillStroke(ctx, C.cream);
  ctx.fillStyle = '#7c3aed'; ctx.fillRect(-6, 4, 12, 12);
  ctx.restore();
}
function drawToyBow(ctx, x, y, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.strokeStyle = C.wood; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(0, 0, 22, -1.2, 1.2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(8, -18); ctx.lineTo(8, 18); ctx.stroke();
  ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(20, 0); ctx.stroke();
  ctx.restore();
}
function drawToyHelm(ctx, x, y, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ellipse(ctx, 0, 0, 20, 16); fillStroke(ctx, C.gray);
  roundRect(ctx, -18, -4, 36, 10, 2); fillStroke(ctx, '#64748b');
  ctx.fillStyle = C.red; ctx.fillRect(-3, -24, 6, 14);
  ctx.restore();
}
function drawToyDragon(ctx, x, y, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ellipse(ctx, 0, 8, 18, 14); fillStroke(ctx, C.red);
  ellipse(ctx, 16, -4, 12, 11); fillStroke(ctx, '#fb7185');
  ctx.beginPath(); ctx.moveTo(22, -12); ctx.lineTo(28, -24); ctx.lineTo(14, -14); fillStroke(ctx, C.orange);
  ctx.fillStyle = C.yellow; ctx.beginPath(); ctx.arc(20, -6, 2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function drawToyTrumpet(ctx, x, y, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = C.yellow;
  roundRect(ctx, -24, -4, 40, 8, 3); fillStroke(ctx, C.yellow);
  ctx.beginPath(); ctx.moveTo(14, -4); ctx.lineTo(28, -16); ctx.lineTo(28, 16); ctx.lineTo(14, 4);
  fillStroke(ctx, C.yellow);
  ctx.restore();
}
function drawToyOrb(ctx, x, y, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ellipse(ctx, 0, 0, 18, 18); fillStroke(ctx, '#38bdf8');
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ellipse(ctx, -5, -5, 6, 5); ctx.fill();
  ctx.restore();
}
function drawToyDoll(ctx, x, y, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s * 0.7, s * 0.7);
  drawRavi(ctx, 0, 10, 'idle', 0);
  ctx.restore();
}

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

function wheel(ctx, x, y, r = 10) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  fillStroke(ctx, C.ink);
  ctx.beginPath();
  ctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
  fillStroke(ctx, C.gray);
}

export function drawVehicle(ctx, id, x, y, t = 0) {
  ctx.save();
  ctx.translate(x, y + Math.sin(t * 8) * 2);

  const bob = Math.sin(t * 12) * 1.5;

  switch (id) {
    case 'walk':
      break;
    case 'uni':
      wheel(ctx, 0, 20, 16);
      ctx.strokeStyle = C.ink; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, 20); ctx.lineTo(0, -10); ctx.stroke();
      roundRect(ctx, -10, -16, 20, 8, 3); fillStroke(ctx, C.red);
      break;
    case 'moto':
      wheel(ctx, -22, 18, 12); wheel(ctx, 22, 18, 12);
      roundRect(ctx, -18, -2 + bob, 36, 14, 6); fillStroke(ctx, C.red);
      roundRect(ctx, 8, -14 + bob, 8, 14, 2); fillStroke(ctx, C.grayDk);
      break;
    case 'tri':
      wheel(ctx, -18, 18, 10); wheel(ctx, 10, 18, 10); wheel(ctx, 28, 18, 10);
      roundRect(ctx, -16, -4, 40, 16, 6); fillStroke(ctx, C.yellow);
      break;
    case 'car':
    case 'car5':
      wheel(ctx, -22, 18, 10); wheel(ctx, 22, 18, 10);
      if (id === 'car5') wheel(ctx, 0, -8, 8);
      roundRect(ctx, -34, -4 + bob, 68, 20, 8); fillStroke(ctx, C.blue);
      roundRect(ctx, -18, -20 + bob, 36, 18, 6); fillStroke(ctx, '#93c5fd');
      break;
    case 'six':
    case 'six7':
      [-30, -10, 10, 30].forEach((wx, i) => { if (i < 3 || true) wheel(ctx, wx, 18, 9); });
      wheel(ctx, -40, 18, 9); wheel(ctx, 40, 18, 9);
      if (id === 'six7') wheel(ctx, 0, -10, 8);
      roundRect(ctx, -48, -6 + bob, 96, 22, 8); fillStroke(ctx, C.orange);
      roundRect(ctx, -20, -22 + bob, 40, 18, 6); fillStroke(ctx, '#fdba74');
      break;
    case 'skates':
      for (let i = 0; i < 4; i++) {
        wheel(ctx, -30 + i * 12, 22, 6);
        wheel(ctx, 10 + i * 8, 22, 6);
      }
      roundRect(ctx, -36, 8, 40, 10, 4); fillStroke(ctx, C.pink);
      roundRect(ctx, 8, 8, 36, 10, 4); fillStroke(ctx, C.pink);
      break;
    case 'truck':
      [-35, -15, 5, 25, 40].forEach((wx) => wheel(ctx, wx, 20, 10));
      // mais 4 = 9
      wheel(ctx, -45, 20, 10); wheel(ctx, 50, 20, 10); wheel(ctx, 15, 20, 10); wheel(ctx, -5, 20, 10);
      roundRect(ctx, -50, -8 + bob, 70, 26, 6); fillStroke(ctx, C.green);
      roundRect(ctx, 18, -18 + bob, 36, 36, 6); fillStroke(ctx, C.yellow);
      break;
    default:
      break;
  }
  ctx.restore();
}

export const MARKET = [
  { id: 'burger', name: 'Hambúrguer', color: '#d97706' },
  { id: 'fries', name: 'Batata frita', color: '#fbbf24' },
  { id: 'apple', name: 'Maçã', color: '#ef4444' },
  { id: 'milk', name: 'Leite', color: '#f8fafc' },
  { id: 'balloon', name: 'Balão', color: '#ec4899' }
];

export function drawMarketItem(ctx, id, x, y, s = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  switch (id) {
    case 'burger':
      ellipse(ctx, 0, -8, 18, 8); fillStroke(ctx, '#f59e0b');
      roundRect(ctx, -16, -6, 32, 8, 2); fillStroke(ctx, '#166534');
      roundRect(ctx, -16, 0, 32, 8, 2); fillStroke(ctx, '#7c2d12');
      ellipse(ctx, 0, 10, 18, 8); fillStroke(ctx, '#d97706');
      break;
    case 'fries':
      roundRect(ctx, -12, 0, 24, 22, 3); fillStroke(ctx, C.red);
      for (let i = 0; i < 5; i++) {
        roundRect(ctx, -10 + i * 5, -18, 4, 22, 1); fillStroke(ctx, C.yellow);
      }
      break;
    case 'apple':
      ellipse(ctx, 0, 2, 14, 14); fillStroke(ctx, C.red);
      ctx.strokeStyle = C.wood; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(4, -20); ctx.stroke();
      ctx.fillStyle = C.green; ctx.beginPath();
      ctx.ellipse(10, -14, 8, 4, 0.5, 0, Math.PI * 2); ctx.fill();
      break;
    case 'milk':
      roundRect(ctx, -10, -16, 20, 36, 4); fillStroke(ctx, C.white);
      roundRect(ctx, -8, -20, 16, 8, 2); fillStroke(ctx, C.blue);
      ctx.fillStyle = C.blue; ctx.font = 'bold 10px sans-serif';
      ctx.fillText('LEITE', -12, 4);
      break;
    case 'balloon':
      ellipse(ctx, 0, -10, 14, 18); fillStroke(ctx, C.pink);
      ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, 8); ctx.quadraticCurveTo(6, 24, 0, 36); ctx.stroke();
      break;
    default:
      break;
  }
  ctx.restore();
}

export function drawHouseInterior(ctx, night = false) {
  // parede
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, night ? '#2a2040' : '#f5d0a9');
  g.addColorStop(1, night ? '#1a1430' : '#e8b87a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // chão
  ctx.fillStyle = night ? '#3d2e1f' : '#c4a06a';
  ctx.fillRect(0, 300, W, 100);
  ctx.fillStyle = night ? '#2a1f14' : '#a87840';
  for (let x = 0; x < W; x += 40) ctx.fillRect(x, 300, 2, 100);

  // janela
  roundRect(ctx, 480, 40, 120, 100, 8); fillStroke(ctx, night ? C.night : C.skyLt, C.woodDk, 6);
  ctx.strokeStyle = C.woodDk; ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(540, 40); ctx.lineTo(540, 140);
  ctx.moveTo(480, 90); ctx.lineTo(600, 90);
  ctx.stroke();

  // tapete
  ellipse(ctx, 280, 340, 140, 30); fillStroke(ctx, C.red, C.ink, 3);
  ellipse(ctx, 280, 340, 90, 16); fillStroke(ctx, C.yellow, C.ink, 2);
}

export function drawArmchair(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y);
  roundRect(ctx, -50, 10, 100, 50, 12); fillStroke(ctx, C.red);
  roundRect(ctx, -55, -30, 20, 70, 8); fillStroke(ctx, '#c02828');
  roundRect(ctx, 35, -30, 20, 70, 8); fillStroke(ctx, '#c02828');
  roundRect(ctx, -40, -40, 80, 40, 10); fillStroke(ctx, '#e84848');
  ctx.restore();
}

export function drawFence(ctx, y = 260) {
  ctx.fillStyle = C.wood;
  for (let x = 40; x < W - 40; x += 50) {
    roundRect(ctx, x, y, 14, 70, 3); fillStroke(ctx, C.wood, C.woodDk, 2);
  }
  roundRect(ctx, 40, y + 18, W - 100, 10, 2); fillStroke(ctx, C.woodDk);
  roundRect(ctx, 40, y + 42, W - 100, 10, 2); fillStroke(ctx, C.woodDk);
}

export function drawSheep(ctx, x, y, t = 0) {
  ctx.save();
  ctx.translate(x, y);
  const hop = Math.abs(Math.sin(t * 8)) * -20;
  ctx.translate(0, hop);
  // corpo
  ellipse(ctx, 0, 0, 22, 16); fillStroke(ctx, C.white);
  ellipse(ctx, -8, -8, 10, 9); fillStroke(ctx, C.white);
  ellipse(ctx, 8, -6, 9, 8); fillStroke(ctx, C.white);
  ellipse(ctx, 0, 6, 10, 8); fillStroke(ctx, C.white);
  // cabeça
  ellipse(ctx, 22, -4, 10, 9); fillStroke(ctx, '#f5d0a9');
  ctx.fillStyle = C.ink;
  ctx.beginPath(); ctx.arc(25, -6, 1.8, 0, Math.PI * 2); ctx.fill();
  // pernas
  ctx.fillStyle = C.ink;
  ctx.fillRect(-12, 12, 5, 12);
  ctx.fillRect(4, 12, 5, 12);
  ctx.restore();
}

export function drawSignpost(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y);
  // poste
  roundRect(ctx, -8, -20, 16, 160, 4); fillStroke(ctx, C.wood);
  // placas
  const labels = [
    { y: 0, text: '1  FÁBRICA', col: C.red },
    { y: 40, text: '2  MERCADO', col: C.blue },
    { y: 80, text: '3  CORREIOS', col: C.green }
  ];
  labels.forEach((L) => {
    roundRect(ctx, 8, L.y, 130, 32, 6); fillStroke(ctx, L.col);
    ctx.fillStyle = C.white;
    ctx.font = 'bold 14px Fredoka, sans-serif';
    ctx.fillText(L.text, 18, L.y + 21);
  });
  ctx.restore();
}

export function drawFactoryBg(ctx) {
  ctx.fillStyle = '#6b7280';
  ctx.fillRect(0, 0, W, H);
  // paredes com tijolos
  ctx.fillStyle = '#9ca3af';
  ctx.fillRect(0, 0, W, 260);
  ctx.strokeStyle = '#6b7280';
  ctx.lineWidth = 2;
  for (let row = 0; row < 12; row++) {
    for (let col = 0; col < 20; col++) {
      const ox = (row % 2) * 16;
      ctx.strokeRect(col * 32 + ox, row * 22, 32, 22);
    }
  }
  // janelas industriais
  for (let i = 0; i < 3; i++) {
    roundRect(ctx, 80 + i * 180, 40, 100, 70, 4); fillStroke(ctx, '#7dd3fc', C.ink, 4);
  }
  // chão
  ctx.fillStyle = '#4b5563';
  ctx.fillRect(0, 280, W, 120);
  ctx.fillStyle = '#374151';
  for (let x = 0; x < W; x += 40) ctx.fillRect(x, 280, 2, 120);

  // máquina
  roundRect(ctx, 40, 120, 120, 160, 10); fillStroke(ctx, C.red);
  roundRect(ctx, 55, 140, 90, 60, 6); fillStroke(ctx, '#1e293b');
  // engrenagens
  drawGear(ctx, 100, 100, 28, 0);
  drawGear(ctx, 145, 85, 18, 0.4);

  // esteira
  roundRect(ctx, 160, 250, 420, 28, 6); fillStroke(ctx, '#1f2937');
  ctx.fillStyle = '#fbbf24';
  for (let x = 170; x < 560; x += 28) ctx.fillRect(x, 256, 14, 16);
}

export function drawGear(ctx, x, y, r, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = C.yellow;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const rr = i % 2 === 0 ? r : r * 0.7;
    const px = Math.cos(a) * rr;
    const py = Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  fillStroke(ctx, C.yellow);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2);
  fillStroke(ctx, '#92400e');
  ctx.restore();
}

export function drawMarketBg(ctx) {
  ctx.fillStyle = '#fef3c7';
  ctx.fillRect(0, 0, W, H);
  // toldo
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 ? C.red : C.white;
    ctx.fillRect(i * 40, 0, 40, 50);
  }
  ctx.fillStyle = C.ink;
  ctx.fillRect(0, 50, W, 6);

  // prateleiras
  for (let row = 0; row < 3; row++) {
    const y = 90 + row * 70;
    roundRect(ctx, 40, y, 560, 14, 2); fillStroke(ctx, C.wood);
    ctx.fillStyle = C.woodDk;
    ctx.fillRect(40, y + 14, 560, 6);
  }

  // balcão
  roundRect(ctx, 80, 300, 480, 70, 8); fillStroke(ctx, C.wood);
  roundRect(ctx, 100, 280, 120, 30, 6); fillStroke(ctx, C.cream);
  ctx.fillStyle = C.ink;
  ctx.font = 'bold 16px Fredoka, sans-serif';
  ctx.fillText('CAIXA', 125, 300);
}

export function drawPostBg(ctx) {
  drawSky(ctx);
  drawHills(ctx, 220);
  // prédio dos correios
  roundRect(ctx, 180, 100, 280, 200, 8); fillStroke(ctx, C.cream);
  roundRect(ctx, 180, 80, 280, 40, 6); fillStroke(ctx, C.blue);
  ctx.fillStyle = C.white;
  ctx.font = 'bold 22px Fredoka, sans-serif';
  ctx.fillText('CORREIOS', 250, 108);
  // porta
  roundRect(ctx, 290, 200, 60, 100, 4); fillStroke(ctx, C.woodDk);
  // janelas
  roundRect(ctx, 210, 140, 50, 40, 4); fillStroke(ctx, C.skyLt);
  roundRect(ctx, 380, 140, 50, 40, 4); fillStroke(ctx, C.skyLt);
  // caixa de correio
  roundRect(ctx, 500, 230, 50, 40, 6); fillStroke(ctx, C.blue);
  roundRect(ctx, 520, 270, 10, 50, 2); fillStroke(ctx, C.grayDk);
  ctx.fillStyle = C.yellow;
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('✉', 512, 258);
}

export function drawPartyBg(ctx) {
  drawHouseInterior(ctx, false);
  // banner
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(60, 40); ctx.quadraticCurveTo(320, 70, 580, 40);
  ctx.stroke();
  const cols = [C.red, C.yellow, C.blue, C.green, C.pink, C.orange];
  for (let i = 0; i < 12; i++) {
    const x = 80 + i * 42;
    const y = 40 + Math.sin(i) * 8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 16, y);
    ctx.lineTo(x + 8, y + 28);
    fillStroke(ctx, cols[i % cols.length]);
  }
  // mesa
  roundRect(ctx, 160, 280, 320, 24, 4); fillStroke(ctx, C.wood);
  roundRect(ctx, 180, 304, 16, 50, 2); fillStroke(ctx, C.woodDk);
  roundRect(ctx, 444, 304, 16, 50, 2); fillStroke(ctx, C.woodDk);
  // bolo
  roundRect(ctx, 280, 230, 80, 50, 6); fillStroke(ctx, C.pink);
  roundRect(ctx, 290, 210, 60, 24, 6); fillStroke(ctx, C.cream);
  ctx.fillStyle = C.yellow;
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(300 + i * 18, 195, 4, 18);
    ctx.beginPath();
    ctx.arc(302 + i * 18, 193, 4, 0, Math.PI * 2);
    ctx.fillStyle = C.orange;
    ctx.fill();
  }
}

export function drawStreet(ctx) {
  drawSky(ctx);
  drawHills(ctx, 200);
  // rua
  ctx.fillStyle = '#6b7280';
  ctx.fillRect(0, 300, W, 100);
  ctx.fillStyle = C.yellow;
  for (let x = 20; x < W; x += 60) ctx.fillRect(x, 345, 30, 6);
  // casas ao fundo
  drawLittleHouse(ctx, 40, 200, C.pink);
  drawLittleHouse(ctx, 480, 190, C.blue);
}

function drawLittleHouse(ctx, x, y, col) {
  roundRect(ctx, x, y, 90, 100, 4); fillStroke(ctx, col);
  ctx.beginPath();
  ctx.moveTo(x - 10, y); ctx.lineTo(x + 45, y - 40); ctx.lineTo(x + 100, y);
  fillStroke(ctx, C.red);
  roundRect(ctx, x + 35, y + 40, 24, 60, 2); fillStroke(ctx, C.wood);
  roundRect(ctx, x + 10, y + 20, 22, 22, 2); fillStroke(ctx, C.skyLt);
}

export function drawNumberBadge(ctx, n, x, y, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  roundRect(ctx, -22, -28, 44, 56, 10); fillStroke(ctx, C.cream, C.ink, 4);
  ctx.fillStyle = C.red;
  ctx.font = 'bold 40px Fredoka, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(n), 0, 4);
  ctx.restore();
}

export function drawConfetti(ctx, particles, t) {
  particles.forEach((p) => {
    const py = (p.y + t * p.speed) % (H + 40);
    ctx.save();
    ctx.translate(p.x, py);
    ctx.rotate(t * p.spin);
    ctx.fillStyle = p.color;
    ctx.fillRect(-3, -6, 6, 12);
    ctx.restore();
  });
}

export function makeConfetti(n = 60) {
  const cols = [C.red, C.yellow, C.blue, C.pink, C.green, C.orange, C.purple];
  return Array.from({ length: n }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    speed: 40 + Math.random() * 80,
    spin: 2 + Math.random() * 6,
    color: cols[(Math.random() * cols.length) | 0]
  }));
}
