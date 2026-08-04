/* ==========================================================================
   Ravi 1·2·3 — Arte HD Vetorial Premium
   ========================================================================== */

export const W = 640;
export const H = 400;

export const C = {
  ink: '#0f172a',
  white: '#ffffff',
  cream: '#f8fafc',
  skin: '#fde047', // Ravi amarelado premium
  skinDk: '#eab308',
  hair: '#1e293b',
  sky: '#38bdf8',
  skyLt: '#bae6fd',
  grass: '#4ade80',
  grassDk: '#16a34a',
  dirt: '#d97706',
  wood: '#b45309',
  woodDk: '#78350f',
  red: '#ef4444',
  yellow: '#f59e0b',
  blue: '#3b82f6',
  pink: '#ec4899',
  orange: '#f97316',
  purple: '#8b5cf6',
  green: '#22c55e',
  gray: '#94a3b8',
  grayDk: '#475569',
  night: '#0f172a',
  moon: '#fef08a'
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

function fillStroke(ctx, fill, stroke = C.ink, lw = 3, shadow = null) {
  if (shadow) {
    ctx.shadowColor = shadow.color;
    ctx.shadowBlur = shadow.blur;
    ctx.shadowOffsetX = shadow.ox || 0;
    ctx.shadowOffsetY = shadow.oy || 0;
  } else {
    ctx.shadowColor = 'transparent';
  }

  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  
  ctx.shadowColor = 'transparent'; // turn off shadow for stroke
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

function makeGradient(ctx, x1, y1, x2, y2, colorStops) {
  const g = ctx.createLinearGradient(x1, y1, x2, y2);
  colorStops.forEach(([pos, col]) => g.addColorStop(pos, col));
  return g;
}

/** Céu em faixas suaves + nuvens opcionais */
export function drawSky(ctx, opts = {}) {
  const night = !!opts.night;
  
  if (night) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#020617');
    g.addColorStop(0.5, '#0f172a');
    g.addColorStop(1, '#1e293b');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Lua com brilho
    ctx.shadowColor = 'rgba(254, 240, 138, 0.6)';
    ctx.shadowBlur = 40;
    ctx.fillStyle = C.moon;
    ctx.beginPath();
    ctx.arc(540, 70, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    
    // Crateras
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ellipse(ctx, 520, 60, 8, 6); ctx.fill();
    ellipse(ctx, 550, 80, 12, 9); ctx.fill();
    ellipse(ctx, 560, 50, 6, 5); ctx.fill();

    // Estrelas
    for (let i = 0; i < 60; i++) {
      const sx = (i * 97 + 13) % W;
      const sy = (i * 53 + 7) % 200;
      const r = (i % 3 === 0) ? 2 : 1;
      const blink = Math.sin(Date.now() / 1000 * (i % 5 + 1)) * 0.5 + 0.5;
      ctx.globalAlpha = 0.5 + blink * 0.5;
      ctx.fillStyle = i % 3 ? '#fff' : '#fef08a';
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#7dd3fc');
    g.addColorStop(0.6, '#38bdf8');
    g.addColorStop(1, '#86efac');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    drawCloud(ctx, 80, 50, 1.2);
    drawCloud(ctx, 300, 40, 0.9);
    drawCloud(ctx, 520, 65, 1.4);
  }
}

export function drawCloud(ctx, x, y, s = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  
  // Sombra da nuvem
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.05)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;
  
  ctx.beginPath();
  ctx.arc(0, 0, 30, 0, Math.PI * 2);
  ctx.arc(30, -10, 25, 0, Math.PI * 2);
  ctx.arc(60, 5, 28, 0, Math.PI * 2);
  ctx.arc(30, 15, 32, 0, Math.PI * 2);
  ctx.fill();
  
  // Highligh interno
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, -2, 28, 0, Math.PI * 2);
  ctx.arc(30, -12, 23, 0, Math.PI * 2);
  ctx.arc(60, 3, 26, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.restore();
}

export function drawGrass(ctx, y = 280) {
  const g = ctx.createLinearGradient(0, y, 0, H);
  g.addColorStop(0, '#4ade80');
  g.addColorStop(1, '#16a34a');
  ctx.fillStyle = g;
  ctx.fillRect(0, y, W, H - y);
  
  // Lâminas de grama detalhadas
  ctx.fillStyle = '#15803d';
  for (let x = 0; x < W; x += 14) {
    const h = 10 + (x % 5) * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 4, y - h, x + 8, y);
    ctx.fill();
  }
  
  // Faixa de terra
  const dirtG = ctx.createLinearGradient(0, y + 70, 0, y + 84);
  dirtG.addColorStop(0, '#b45309');
  dirtG.addColorStop(1, '#92400e');
  ctx.fillStyle = dirtG;
  ctx.fillRect(0, y + 70, W, 14);
}

export function drawHills(ctx, y = 250) {
  const h1 = ctx.createLinearGradient(0, y, 0, H);
  h1.addColorStop(0, '#86efac');
  h1.addColorStop(1, '#22c55e');
  ctx.fillStyle = h1;
  ctx.beginPath();
  ctx.moveTo(0, y + 40);
  ctx.quadraticCurveTo(120, y - 40, 260, y + 20);
  ctx.quadraticCurveTo(400, y + 70, 640, y);
  ctx.lineTo(640, H);
  ctx.lineTo(0, H);
  ctx.fill();
  
  const h2 = ctx.createLinearGradient(0, y + 40, 0, H);
  h2.addColorStop(0, '#4ade80');
  h2.addColorStop(1, '#15803d');
  ctx.fillStyle = h2;
  ctx.beginPath();
  ctx.moveTo(0, y + 80);
  ctx.quadraticCurveTo(200, y + 10, 420, y + 70);
  ctx.quadraticCurveTo(540, y + 110, 640, y + 50);
  ctx.lineTo(640, H);
  ctx.lineTo(0, H);
  ctx.fill();
}

/** Ravi — herói principal (HD Vector) */
export function drawRavi(ctx, x, y, pose = 'idle', t = 0) {
  ctx.save();
  ctx.translate(x, y);

  const bounce = pose === 'walk' ? Math.sin(t * 12) * 4 : pose === 'cheer' ? Math.sin(t * 10) * 5 : 0;
  ctx.translate(0, bounce);

  // Sombra dinâmico
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ellipse(ctx, 0, 58 - bounce, 32, 8); 
  ctx.fill();

  // Cores com gradiente
  const blueG = makeGradient(ctx, -15, 0, 15, 0, [[0, '#60a5fa'], [1, '#2563eb']]);
  const redG = makeGradient(ctx, -15, 0, 15, 0, [[0, '#fb7185'], [1, '#e11d48']]);
  const skinG = makeGradient(ctx, -20, -40, 20, -10, [[0, '#fef08a'], [1, '#eab308']]);
  const yellowG = makeGradient(ctx, -20, -10, 20, 20, [[0, '#fde047'], [1, '#d97706']]);

  // pernas
  if (pose === 'walk') {
    const swing = Math.sin(t * 12) * 0.4;
    
    ctx.save();
    ctx.translate(-8, 30);
    ctx.rotate(-swing);
    roundRect(ctx, -7, 0, 14, 28, 6); fillStroke(ctx, blueG);
    roundRect(ctx, -10, 22, 18, 10, 4); fillStroke(ctx, redG);
    ctx.restore();
    
    ctx.save();
    ctx.translate(8, 30);
    ctx.rotate(swing);
    roundRect(ctx, -7, 0, 14, 28, 6); fillStroke(ctx, blueG);
    roundRect(ctx, -8, 22, 18, 10, 4); fillStroke(ctx, redG);
    ctx.restore();
  } else {
    roundRect(ctx, -16, 28, 14, 30, 6); fillStroke(ctx, blueG);
    roundRect(ctx, 2, 28, 14, 30, 6); fillStroke(ctx, blueG);
    roundRect(ctx, -18, 52, 18, 12, 5); fillStroke(ctx, redG);
    roundRect(ctx, 0, 52, 18, 12, 5); fillStroke(ctx, redG);
  }

  // corpo / camiseta
  roundRect(ctx, -24, -8, 48, 44, 16); 
  fillStroke(ctx, yellowG);
  
  // emblema estrela (mais brilhante)
  ctx.save();
  ctx.translate(0, 14);
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
    const r = i % 2 === 0 ? 10 : 4;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.shadowColor = 'rgba(239, 68, 68, 0.5)';
  ctx.shadowBlur = 8;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.restore();

  // braços
  if (pose === 'sleep') {
    roundRect(ctx, -34, 5, 16, 26, 8); fillStroke(ctx, skinG);
    roundRect(ctx, 18, 5, 16, 26, 8); fillStroke(ctx, skinG);
  } else if (pose === 'cheer' || pose === 'wave') {
    ctx.save();
    ctx.translate(-26, 0);
    ctx.rotate(-1.0 + Math.sin(t * 8) * 0.2);
    roundRect(ctx, -8, 0, 16, 34, 8); fillStroke(ctx, skinG);
    ctx.restore();
    ctx.save();
    ctx.translate(26, 0);
    ctx.rotate(1.0 - Math.sin(t * 8) * 0.2);
    roundRect(ctx, -8, 0, 16, 34, 8); fillStroke(ctx, skinG);
    ctx.restore();
  } else {
    roundRect(ctx, -36, 2, 16, 32, 8); fillStroke(ctx, skinG);
    roundRect(ctx, 20, 2, 16, 32, 8); fillStroke(ctx, skinG);
  }

  // cabeça
  ellipse(ctx, 0, -32, 32, 30); 
  fillStroke(ctx, skinG, C.ink, 3.5);

  // cabelo estiloso
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.arc(0, -42, 30, Math.PI * 1.05, Math.PI * 1.95);
  fillStroke(ctx, '#0f172a', C.ink, 3.5);
  ellipse(ctx, -20, -40, 12, 14); fillStroke(ctx, '#0f172a', C.ink, 2.5);
  ellipse(ctx, 18, -42, 13, 15); fillStroke(ctx, '#0f172a', C.ink, 2.5);

  // rosto
  if (pose === 'sleep') {
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(-14, -32); ctx.quadraticCurveTo(-9, -27, -4, -32);
    ctx.moveTo(4, -32); ctx.quadraticCurveTo(9, -27, 14, -32);
    ctx.stroke();
    
    // Zzz animados
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 16px Outfit, sans-serif';
    ctx.fillText('z', 34, -54 - Math.sin(t * 3) * 6);
    ctx.font = 'bold 22px Outfit, sans-serif';
    ctx.fillText('Z', 48, -70 - Math.sin(t * 3 + 1) * 6);
  } else {
    // Olhos premium estilo anime/cartoon
    ellipse(ctx, -12, -34, 6, 8); fillStroke(ctx, '#fff', C.ink, 2);
    ellipse(ctx, 12, -34, 6, 8); fillStroke(ctx, '#fff', C.ink, 2);
    ctx.fillStyle = C.ink;
    ellipse(ctx, -11, -33, 3.5, 4.5); ctx.fill();
    ellipse(ctx, 13, -33, 3.5, 4.5); ctx.fill();
    
    // Brilho dos olhos (catchlight)
    ctx.fillStyle = '#fff';
    ellipse(ctx, -12, -35, 1.5, 1.5); ctx.fill();
    ellipse(ctx, 12, -35, 1.5, 1.5); ctx.fill();

    // Blush
    ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
    ellipse(ctx, -20, -22, 8, 4); ctx.fill();
    ellipse(ctx, 20, -22, 8, 4); ctx.fill();

    // Sorriso
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (pose === 'cheer') {
      ctx.fillStyle = '#9f1239'; // boca aberta
      ctx.arc(0, -20, 10, 0, Math.PI);
      ctx.fill();
      ctx.stroke();
      // lingua
      ctx.fillStyle = '#fb7185';
      ctx.beginPath();
      ctx.arc(0, -14, 6, 0, Math.PI, true);
      ctx.fill();
    } else {
      ctx.arc(0, -20, 10, 0.2, Math.PI - 0.2);
      ctx.stroke();
    }
  }

  ctx.restore();
}

/** Heróis / guerreiros convidados */
export const HEROES = [
  { id: 'bolt', name: 'Sir Bolt', title: 'Cavaleiro', color: '#3b82f6', accent: '#e2e8f0' },
  { id: 'luna', name: 'Luna', title: 'Feiticeira', color: '#8b5cf6', accent: '#f3e8ff' },
  { id: 'freya', name: 'Freya', title: 'Arqueira', color: '#22c55e', accent: '#dcfce7' },
  { id: 'kenzo', name: 'Kenzo', title: 'Samurai', color: '#ef4444', accent: '#fee2e2' },
  { id: 'bjorn', name: 'Bjorn', title: 'Viking', color: '#f97316', accent: '#ffedd5' },
  { id: 'shade', name: 'Shade', title: 'Ninja', color: '#334155', accent: '#e2e8f0' },
  { id: 'max', name: 'Maximus', title: 'Gladiador', color: '#b45309', accent: '#fef3c7' },
  { id: 'ember', name: 'Ember & Spark', title: 'Dragões', color: '#e11d48', accent: '#ffe4e6' },
  { id: 'aria', name: 'Aria', title: 'Princesa Guerreira', color: '#ec4899', accent: '#fce7f3' }
];

export function drawHero(ctx, hero, x, y, scale = 1, t = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  
  const bounce = Math.sin(t * 8) * 2;
  ctx.translate(0, bounce);

  // Sombra
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ellipse(ctx, 0, 46 - bounce, 24, 7); 
  ctx.fill();

  const bodyG = makeGradient(ctx, -15, 0, 15, 0, [[0, hero.color], [1, shadeColor(hero.color, -20)]]);
  const skinG = makeGradient(ctx, -10, -30, 10, -10, [[0, '#fef08a'], [1, '#f59e0b']]);

  // corpo
  roundRect(ctx, -18, 0, 36, 38, 12); 
  fillStroke(ctx, bodyG, C.ink, 3);

  // cabeça
  ellipse(ctx, 0, -20, 20, 19); 
  fillStroke(ctx, skinG, C.ink, 3);

  // acessórios por tipo (HD details)
  switch (hero.id) {
    case 'bolt':
      ctx.beginPath();
      ctx.arc(0, -24, 20, Math.PI, 0);
      fillStroke(ctx, hero.accent, C.ink, 3);
      ctx.fillStyle = C.yellow;
      ctx.fillRect(-4, -46, 8, 16);
      ctx.strokeRect(-4, -46, 8, 16);
      break;
    case 'luna':
      ctx.beginPath();
      ctx.moveTo(-22, -24); ctx.lineTo(0, -60); ctx.lineTo(22, -24);
      fillStroke(ctx, bodyG, C.ink, 3);
      ellipse(ctx, 0, -24, 26, 6); 
      fillStroke(ctx, hero.accent, C.ink, 3);
      break;
    case 'freya':
      ctx.beginPath();
      ctx.arc(0, -26, 20, Math.PI, 0);
      fillStroke(ctx, '#166534', C.ink, 3);
      break;
    case 'kenzo':
      ctx.beginPath();
      ctx.moveTo(-5, -36); ctx.lineTo(0, -56); ctx.lineTo(10, -34);
      fillStroke(ctx, C.ink, C.white, 2);
      break;
    case 'bjorn':
      ellipse(ctx, 0, -28, 20, 11); 
      fillStroke(ctx, hero.accent, C.ink, 3);
      // Chifres
      ctx.beginPath(); ctx.moveTo(-20, -30); ctx.quadraticCurveTo(-34, -50, -16, -42);
      fillStroke(ctx, '#fff', C.ink, 3);
      ctx.beginPath(); ctx.moveTo(20, -30); ctx.quadraticCurveTo(34, -50, 16, -42);
      fillStroke(ctx, '#fff', C.ink, 3);
      break;
    case 'shade':
      roundRect(ctx, -16, -26, 32, 16, 5); fillStroke(ctx, '#0f172a', C.ink, 3);
      ctx.fillStyle = C.red;
      ctx.fillRect(-12, -22, 8, 4);
      ctx.fillRect(4, -22, 8, 4);
      break;
    case 'max':
      ctx.beginPath();
      ctx.moveTo(-3, -36); ctx.lineTo(0, -54); ctx.lineTo(12, -34);
      fillStroke(ctx, C.red, C.ink, 2);
      ellipse(ctx, 0, -26, 20, 9); 
      fillStroke(ctx, hero.accent, C.ink, 3);
      break;
    case 'ember':
      ctx.beginPath(); ctx.moveTo(-16, -30); ctx.lineTo(-24, -52); ctx.lineTo(-4, -38);
      fillStroke(ctx, bodyG, C.ink, 3);
      ctx.beginPath(); ctx.moveTo(16, -30); ctx.lineTo(24, -52); ctx.lineTo(4, -38);
      fillStroke(ctx, '#f97316', C.ink, 3);
      // spark (mini dragon)
      ctx.save();
      ctx.translate(32, 12);
      ctx.scale(0.6, 0.6);
      ellipse(ctx, 0, -12, 16, 14); fillStroke(ctx, '#fb923c', C.ink, 3);
      ellipse(ctx, 0, 10, 14, 16); fillStroke(ctx, '#f97316', C.ink, 3);
      ctx.fillStyle = '#fff'; ellipse(ctx, -4, -14, 3, 3); ctx.fill();
      ctx.restore();
      break;
    case 'aria':
      ctx.beginPath();
      ctx.moveTo(-16, -30);
      ctx.lineTo(-12, -46); ctx.lineTo(-4, -32);
      ctx.lineTo(0, -50); ctx.lineTo(4, -32);
      ctx.lineTo(12, -46); ctx.lineTo(16, -30);
      fillStroke(ctx, C.yellow, C.ink, 3);
      break;
  }

  if (hero.id !== 'shade') {
    ellipse(ctx, -7, -22, 4.5, 5.5); fillStroke(ctx, C.white, C.ink, 2);
    ellipse(ctx, 7, -22, 4.5, 5.5); fillStroke(ctx, C.white, C.ink, 2);
    ctx.fillStyle = C.ink;
    ellipse(ctx, -6.5, -21.5, 2.5, 2.5); ctx.fill();
    ellipse(ctx, 7.5, -21.5, 2.5, 2.5); ctx.fill();
    ctx.fillStyle = '#fff';
    ellipse(ctx, -7.5, -22.5, 1, 1); ctx.fill();
    ellipse(ctx, 6.5, -22.5, 1, 1); ctx.fill();
  }

  // sorriso
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, -13, 6, 0.2, Math.PI - 0.2);
  ctx.stroke();

  // braço acenando (mais orgânico)
  const wave = Math.sin(t * 9) * 0.5;
  ctx.save();
  ctx.translate(20, 10);
  ctx.rotate(0.6 + wave);
  roundRect(ctx, -5, 0, 12, 26, 6); 
  fillStroke(ctx, skinG, C.ink, 3);
  ctx.restore();

  ctx.restore();
}

function shadeColor(color, percent) {
  let R = parseInt(color.substring(1,3),16);
  let G = parseInt(color.substring(3,5),16);
  let B = parseInt(color.substring(5,7),16);
  R = parseInt(R * (100 + percent) / 100);
  G = parseInt(G * (100 + percent) / 100);
  B = parseInt(B * (100 + percent) / 100);
  R = (R<255)?R:255; G = (G<255)?G:255; B = (B<255)?B:255;
  let RR = ((R.toString(16).length==1)?"0"+R.toString(16):R.toString(16));
  let GG = ((G.toString(16).length==1)?"0"+G.toString(16):G.toString(16));
  let BB = ((B.toString(16).length==1)?"0"+B.toString(16):B.toString(16));
  return "#"+RR+GG+BB;
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
  const metal = makeGradient(ctx, -6, 0, 6, 0, [[0, '#e2e8f0'], [1, '#94a3b8']]);
  roundRect(ctx, -5, -32, 10, 40, 3); fillStroke(ctx, metal, C.ink, 2.5);
  roundRect(ctx, -16, 6, 32, 10, 4); fillStroke(ctx, C.yellow, C.ink, 2.5);
  ellipse(ctx, 0, 20, 8, 8); fillStroke(ctx, C.red, C.ink, 2.5);
  ctx.restore();
}
function drawToyShield(ctx, x, y, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(0, -28); ctx.quadraticCurveTo(28, -18, 24, 10); ctx.quadraticCurveTo(0, 32, -24, 10); ctx.quadraticCurveTo(-28, -18, 0, -28);
  const g = makeGradient(ctx, -20, -20, 20, 20, [[0, '#60a5fa'], [1, '#1e3a8a']]);
  fillStroke(ctx, g, C.ink, 3);
  ctx.beginPath();
  ctx.moveTo(0, -14); ctx.lineTo(5, -2); ctx.lineTo(16, -2); ctx.lineTo(7, 5); ctx.lineTo(11, 16); ctx.lineTo(0, 9); ctx.lineTo(-11, 16); ctx.lineTo(-7, 5); ctx.lineTo(-16, -2); ctx.lineTo(-5, -2);
  fillStroke(ctx, C.yellow, C.ink, 2);
  ctx.restore();
}
function drawToyPotion(ctx, x, y, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  roundRect(ctx, -10, -10, 20, 32, 8); fillStroke(ctx, '#e0e7ff', C.ink, 3);
  roundRect(ctx, -8, -20, 16, 12, 4); fillStroke(ctx, '#d1d5db', C.ink, 2);
  const potion = makeGradient(ctx, -8, 6, 8, 22, [[0, '#d946ef'], [1, '#7c3aed']]);
  ctx.fillStyle = potion; ctx.fillRect(-8, 6, 16, 14);
  // reflexo
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  roundRect(ctx, -6, -6, 4, 12, 2); ctx.fill();
  ctx.restore();
}
function drawToyBow(ctx, x, y, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.strokeStyle = '#92400e'; ctx.lineWidth = 6; ctx.lineCap='round';
  ctx.beginPath(); ctx.arc(0, 0, 26, -1.2, 1.2); ctx.stroke();
  ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(9, -24); ctx.lineTo(9, 24); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(24, 0); ctx.stroke();
  // flecha ponta
  ctx.fillStyle=C.gray; ctx.beginPath(); ctx.moveTo(24,-3); ctx.lineTo(30,0); ctx.lineTo(24,3); ctx.fill();
  ctx.restore();
}
function drawToyHelm(ctx, x, y, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ellipse(ctx, 0, 0, 24, 18); fillStroke(ctx, '#94a3b8', C.ink, 3);
  roundRect(ctx, -22, -4, 44, 12, 4); fillStroke(ctx, '#475569', C.ink, 3);
  ctx.fillStyle = C.red; ctx.fillRect(-4, -28, 8, 16); ctx.strokeRect(-4, -28, 8, 16);
  ctx.restore();
}
function drawToyDragon(ctx, x, y, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ellipse(ctx, 0, 10, 22, 16); fillStroke(ctx, C.red, C.ink, 3);
  ellipse(ctx, 18, -6, 14, 13); fillStroke(ctx, '#fb7185', C.ink, 3);
  ctx.beginPath(); ctx.moveTo(24, -16); ctx.lineTo(32, -30); ctx.lineTo(16, -18); fillStroke(ctx, C.orange, C.ink, 2);
  ctx.fillStyle = C.yellow; ellipse(ctx, 22, -8, 2.5, 2.5); ctx.fill();
  ctx.restore();
}
function drawToyTrumpet(ctx, x, y, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const g = makeGradient(ctx, -26, -6, 32, 20, [[0, '#fef08a'], [1, '#d97706']]);
  roundRect(ctx, -28, -5, 46, 10, 4); fillStroke(ctx, g, C.ink, 3);
  ctx.beginPath(); ctx.moveTo(18, -5); ctx.lineTo(34, -20); ctx.lineTo(34, 20); ctx.lineTo(18, 5);
  fillStroke(ctx, g, C.ink, 3);
  ctx.restore();
}
function drawToyOrb(ctx, x, y, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.shadowColor = 'rgba(56, 189, 248, 0.8)'; ctx.shadowBlur = 16;
  ellipse(ctx, 0, 0, 22, 22); fillStroke(ctx, '#0ea5e9', C.ink, 3);
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ellipse(ctx, -6, -6, 8, 6); ctx.fill();
  ctx.restore();
}
function drawToyDoll(ctx, x, y, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s * 0.75, s * 0.75);
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

function wheel(ctx, x, y, r = 10, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  
  // Pneu
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2);
  fillStroke(ctx, '#1e293b', C.ink, 2);
  
  // Calota
  ctx.beginPath(); ctx.arc(0, 0, r * 0.5, 0, Math.PI*2);
  fillStroke(ctx, '#cbd5e1', C.ink, 2);
  
  // Detalhe girando
  ctx.fillStyle = '#64748b';
  ctx.beginPath(); ctx.arc(r*0.25, 0, r*0.15, 0, Math.PI*2); ctx.fill();
  
  ctx.restore();
}

export function drawVehicle(ctx, id, x, y, t = 0) {
  ctx.save();
  ctx.translate(x, y + Math.sin(t * 10) * 2);

  const bob = Math.sin(t * 15) * 1.5;
  const wRot = t * 12; // Rotação da roda

  const bodyG = makeGradient(ctx, -40, -30, 40, 10, [[0, '#38bdf8'], [1, '#2563eb']]);
  const bodyRed = makeGradient(ctx, -30, -20, 30, 10, [[0, '#fb7185'], [1, '#e11d48']]);
  const bodyGreen = makeGradient(ctx, -50, -30, 50, 20, [[0, '#4ade80'], [1, '#16a34a']]);
  const bodyOrange = makeGradient(ctx, -45, -20, 45, 10, [[0, '#fb923c'], [1, '#ea580c']]);

  switch (id) {
    case 'walk':
      break;
    case 'uni':
      wheel(ctx, 0, 22, 18, wRot);
      ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(0, 22); ctx.lineTo(0, -12); ctx.stroke();
      roundRect(ctx, -12, -18, 24, 10, 4); fillStroke(ctx, C.red, C.ink, 3);
      break;
    case 'moto':
      wheel(ctx, -24, 20, 14, wRot); wheel(ctx, 24, 20, 14, wRot);
      roundRect(ctx, -20, -4 + bob, 40, 16, 8); fillStroke(ctx, bodyRed, C.ink, 3);
      roundRect(ctx, 10, -18 + bob, 10, 18, 4); fillStroke(ctx, '#94a3b8', C.ink, 3);
      break;
    case 'tri':
      wheel(ctx, -20, 20, 12, wRot); wheel(ctx, 12, 20, 12, wRot); wheel(ctx, 32, 20, 12, wRot);
      roundRect(ctx, -18, -6, 44, 18, 8); fillStroke(ctx, C.yellow, C.ink, 3);
      break;
    case 'car':
    case 'car5':
      wheel(ctx, -24, 20, 12, wRot); wheel(ctx, 24, 20, 12, wRot);
      if (id === 'car5') {
        ctx.save(); ctx.translate(0, -12); ctx.scale(0.8, 0.8); wheel(ctx, 0, 0, 12, 0); ctx.restore();
      }
      roundRect(ctx, -38, -6 + bob, 76, 24, 10); fillStroke(ctx, bodyG, C.ink, 3);
      roundRect(ctx, -20, -24 + bob, 40, 20, 8); fillStroke(ctx, '#bae6fd', C.ink, 3);
      // Farol
      ctx.fillStyle = '#fef08a'; ellipse(ctx, 36, 4 + bob, 4, 6); ctx.fill();
      break;
    case 'six':
    case 'six7':
      [-34, -12, 10, 32].forEach((wx, i) => { if (i < 3 || true) wheel(ctx, wx, 20, 10, wRot); });
      wheel(ctx, -46, 20, 10, wRot); wheel(ctx, 44, 20, 10, wRot);
      if (id === 'six7') {
        ctx.save(); ctx.translate(0, -14); ctx.scale(0.8, 0.8); wheel(ctx, 0, 0, 10, 0); ctx.restore();
      }
      roundRect(ctx, -54, -8 + bob, 108, 26, 12); fillStroke(ctx, bodyOrange, C.ink, 3);
      roundRect(ctx, -24, -26 + bob, 48, 22, 8); fillStroke(ctx, '#fed7aa', C.ink, 3);
      break;
    case 'skates':
      for (let i = 0; i < 4; i++) {
        wheel(ctx, -32 + i * 14, 24, 7, wRot);
        wheel(ctx, 12 + i * 9, 24, 7, wRot);
      }
      roundRect(ctx, -40, 8, 46, 12, 6); fillStroke(ctx, C.pink, C.ink, 3);
      roundRect(ctx, 10, 8, 40, 12, 6); fillStroke(ctx, C.pink, C.ink, 3);
      break;
    case 'truck':
      [-38, -16, 6, 28, 44].forEach((wx) => wheel(ctx, wx, 22, 11, wRot));
      wheel(ctx, -50, 22, 11, wRot); wheel(ctx, 56, 22, 11, wRot); wheel(ctx, 17, 22, 11, wRot); wheel(ctx, -5, 22, 11, wRot);
      roundRect(ctx, -56, -10 + bob, 80, 30, 8); fillStroke(ctx, bodyGreen, C.ink, 3);
      roundRect(ctx, 22, -22 + bob, 42, 40, 8); fillStroke(ctx, C.yellow, C.ink, 3);
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
  
  // Drop shadow suave para itens
  ctx.shadowColor = 'rgba(0,0,0,0.15)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 4;
  
  switch (id) {
    case 'burger':
      ellipse(ctx, 0, -10, 20, 10); fillStroke(ctx, '#f59e0b', C.ink, 2.5); // pão cima
      roundRect(ctx, -18, -6, 36, 10, 3); fillStroke(ctx, '#166534', C.ink, 2.5); // alface
      roundRect(ctx, -18, 0, 36, 10, 3); fillStroke(ctx, '#7c2d12', C.ink, 2.5); // carne
      ellipse(ctx, 0, 12, 20, 10); fillStroke(ctx, '#d97706', C.ink, 2.5); // pão baixo
      break;
    case 'fries':
      roundRect(ctx, -14, 0, 28, 24, 4); fillStroke(ctx, C.red, C.ink, 3);
      for (let i = 0; i < 5; i++) {
        roundRect(ctx, -12 + i * 5.5, -20, 5, 24, 2); fillStroke(ctx, C.yellow, C.ink, 2);
      }
      break;
    case 'apple':
      const ag = makeGradient(ctx, -10, -10, 10, 10, [[0, '#f87171'], [1, '#dc2626']]);
      ellipse(ctx, 0, 4, 16, 16); fillStroke(ctx, ag, C.ink, 3);
      ctx.strokeStyle = C.woodDk; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, -10); ctx.quadraticCurveTo(4, -18, 6, -22); ctx.stroke();
      ctx.fillStyle = C.green; ctx.beginPath();
      ctx.ellipse(12, -16, 9, 5, 0.5, 0, Math.PI * 2); fillStroke(ctx, C.green, C.ink, 2);
      break;
    case 'milk':
      roundRect(ctx, -12, -18, 24, 40, 5); fillStroke(ctx, C.white, C.ink, 3);
      roundRect(ctx, -10, -22, 20, 10, 3); fillStroke(ctx, C.blue, C.ink, 2);
      ctx.fillStyle = C.blue; ctx.font = 'bold 11px Outfit';
      ctx.fillText('MILK', -12, 6);
      break;
    case 'balloon':
      const bg = makeGradient(ctx, -10, -10, 10, 10, [[0, '#f472b6'], [1, '#db2777']]);
      ellipse(ctx, 0, -12, 16, 20); fillStroke(ctx, bg, C.ink, 3);
      // Reflexo
      ctx.shadowColor='transparent'; ctx.fillStyle='rgba(255,255,255,0.6)';
      ellipse(ctx, -6, -18, 4, 6); ctx.fill();
      ctx.strokeStyle = C.ink; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(0, 8); ctx.quadraticCurveTo(8, 26, 0, 40); ctx.stroke();
      break;
  }
  ctx.restore();
}

export function drawHouseInterior(ctx, night = false) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, night ? '#1e1b4b' : '#ffedd5');
  g.addColorStop(1, night ? '#0f172a' : '#fed7aa');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // chão de madeira premium
  const floorG = ctx.createLinearGradient(0, 300, 0, H);
  floorG.addColorStop(0, night ? '#451a03' : '#d97706');
  floorG.addColorStop(1, night ? '#270f02' : '#92400e');
  ctx.fillStyle = floorG;
  ctx.fillRect(0, 300, W, 100);
  ctx.strokeStyle = night ? '#270f02' : '#7c2d12';
  ctx.lineWidth = 2;
  for (let x = 0; x < W; x += 50) {
    ctx.beginPath(); ctx.moveTo(x, 300); ctx.lineTo(x-20, H); ctx.stroke();
  }

  // janela com glass
  roundRect(ctx, 470, 30, 140, 120, 12); 
  fillStroke(ctx, night ? '#020617' : '#bae6fd', C.woodDk, 8);
  ctx.strokeStyle = C.woodDk; ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(540, 30); ctx.lineTo(540, 150);
  ctx.moveTo(470, 90); ctx.lineTo(610, 90);
  ctx.stroke();

  // Tapete felpudo
  ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 6;
  ellipse(ctx, 280, 350, 160, 36); fillStroke(ctx, C.red, C.ink, 4);
  ctx.shadowColor = 'transparent';
  ellipse(ctx, 280, 350, 110, 20); fillStroke(ctx, C.yellow, C.ink, 3);
}

export function drawArmchair(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y);
  const cushion = makeGradient(ctx, -40, -20, 40, 20, [[0, '#f87171'], [1, '#b91c1c']]);
  const arms = makeGradient(ctx, 0, -40, 0, 20, [[0, '#ef4444'], [1, '#991b1b']]);
  
  ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 10;
  roundRect(ctx, -55, 12, 110, 56, 16); fillStroke(ctx, cushion, C.ink, 4);
  ctx.shadowColor = 'transparent';
  
  roundRect(ctx, -62, -34, 26, 78, 12); fillStroke(ctx, arms, C.ink, 4);
  roundRect(ctx, 36, -34, 26, 78, 12); fillStroke(ctx, arms, C.ink, 4);
  roundRect(ctx, -44, -46, 88, 46, 12); fillStroke(ctx, cushion, C.ink, 4);
  ctx.restore();
}

export function drawFence(ctx, y = 260) {
  ctx.fillStyle = C.wood;
  ctx.shadowColor = 'rgba(0,0,0,0.2)'; ctx.shadowBlur = 8;
  for (let x = 40; x < W - 40; x += 55) {
    roundRect(ctx, x, y, 16, 76, 4); fillStroke(ctx, C.wood, C.woodDk, 3);
  }
  roundRect(ctx, 30, y + 20, W - 60, 12, 3); fillStroke(ctx, C.woodDk, C.ink, 3);
  roundRect(ctx, 30, y + 48, W - 60, 12, 3); fillStroke(ctx, C.woodDk, C.ink, 3);
  ctx.shadowColor = 'transparent';
}

export function drawSheep(ctx, x, y, t = 0) {
  ctx.save();
  ctx.translate(x, y);
  const hop = Math.abs(Math.sin(t * 10)) * -24;
  ctx.translate(0, hop);
  
  ctx.shadowColor = 'rgba(0,0,0,0.1)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 8;
  ellipse(ctx, 0, 0, 26, 20); fillStroke(ctx, C.white, C.ink, 3);
  ctx.shadowColor = 'transparent';
  
  ellipse(ctx, -10, -10, 12, 11); fillStroke(ctx, C.white, C.ink, 3);
  ellipse(ctx, 10, -8, 11, 10); fillStroke(ctx, C.white, C.ink, 3);
  ellipse(ctx, 0, 8, 12, 10); fillStroke(ctx, C.white, C.ink, 3);
  
  ellipse(ctx, 26, -5, 12, 10); fillStroke(ctx, '#fed7aa', C.ink, 3);
  ctx.fillStyle = C.ink;
  ctx.beginPath(); ctx.arc(30, -7, 2.5, 0, Math.PI * 2); ctx.fill();
  
  ctx.fillStyle = C.ink;
  roundRect(ctx, -14, 14, 6, 14, 2); ctx.fill();
  roundRect(ctx, 6, 14, 6, 14, 2); ctx.fill();
  ctx.restore();
}

export function drawSignpost(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 12;
  roundRect(ctx, -10, -24, 20, 170, 6); fillStroke(ctx, C.wood, C.ink, 4);
  
  const labels = [
    { y: 0, text: '1  FÁBRICA', col: C.red },
    { y: 46, text: '2  MERCADO', col: C.blue },
    { y: 92, text: '3  CORREIOS', col: C.green }
  ];
  labels.forEach((L) => {
    roundRect(ctx, 10, L.y, 140, 36, 8); fillStroke(ctx, L.col, C.ink, 4);
    ctx.fillStyle = C.white;
    ctx.font = '800 15px Outfit, sans-serif';
    ctx.fillText(L.text, 22, L.y + 24);
  });
  ctx.restore();
}

export function drawFactoryBg(ctx) {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#475569');
  bg.addColorStop(1, '#1e293b');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  
  // Tijolos detalhados
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 2;
  for (let row = 0; row < 12; row++) {
    for (let col = 0; col < 20; col++) {
      const ox = (row % 2) * 16;
      ctx.strokeRect(col * 32 + ox, row * 22, 32, 22);
    }
  }
  
  // Janelas brilhantes
  ctx.shadowColor = 'rgba(125, 211, 252, 0.4)'; ctx.shadowBlur = 20;
  for (let i = 0; i < 3; i++) {
    roundRect(ctx, 80 + i * 180, 40, 110, 80, 8); 
    fillStroke(ctx, '#7dd3fc', C.ink, 5);
  }
  ctx.shadowColor = 'transparent';

  // Chão de metal
  const floorG = ctx.createLinearGradient(0, 280, 0, H);
  floorG.addColorStop(0, '#334155');
  floorG.addColorStop(1, '#0f172a');
  ctx.fillStyle = floorG;
  ctx.fillRect(0, 280, W, 120);
  ctx.fillStyle = '#1e293b';
  for (let x = 0; x < W; x += 40) ctx.fillRect(x, 280, 4, 120);

  // Máquina principal
  const machG = makeGradient(ctx, 30, 120, 170, 280, [[0, '#ef4444'], [1, '#991b1b']]);
  roundRect(ctx, 30, 110, 140, 180, 16); fillStroke(ctx, machG, C.ink, 5);
  roundRect(ctx, 45, 130, 110, 70, 8); fillStroke(ctx, '#0f172a', C.ink, 4);
}

export function drawGear(ctx, x, y, r, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 10;
  ctx.fillStyle = C.yellow;
  ctx.beginPath();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const rr = i % 2 === 0 ? r : r * 0.65;
    const px = Math.cos(a) * rr;
    const py = Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  fillStroke(ctx, C.yellow, C.ink, 3);
  ctx.shadowColor = 'transparent';
  ctx.beginPath(); ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2);
  fillStroke(ctx, '#92400e', C.ink, 3);
  ctx.restore();
}

export function drawMarketBg(ctx) {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#fef3c7');
  bg.addColorStop(1, '#fde68a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  
  // Toldo
  ctx.shadowColor = 'rgba(0,0,0,0.2)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 6;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 ? C.red : C.white;
    ctx.beginPath();
    ctx.moveTo(i * 40, 0); ctx.lineTo(i * 40 + 40, 0);
    ctx.lineTo(i * 40 + 40, 55); ctx.quadraticCurveTo(i * 40 + 20, 65, i * 40, 55);
    ctx.fill();
  }
  ctx.shadowColor = 'transparent';

  // Prateleiras iluminadas
  for (let row = 0; row < 3; row++) {
    const y = 100 + row * 75;
    roundRect(ctx, 40, y, 560, 16, 4); fillStroke(ctx, C.wood, C.ink, 3);
    ctx.fillStyle = C.woodDk; ctx.fillRect(40, y + 16, 560, 6);
  }

  // Balcão
  roundRect(ctx, 70, 300, 500, 75, 12); fillStroke(ctx, C.wood, C.ink, 4);
  roundRect(ctx, 100, 275, 130, 40, 8); fillStroke(ctx, C.cream, C.ink, 4);
  ctx.fillStyle = C.ink; ctx.font = '900 18px Outfit';
  ctx.fillText('CAIXA', 135, 302);
}

export function drawPostBg(ctx) {
  drawSky(ctx);
  drawHills(ctx, 220);
  
  ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 20;
  roundRect(ctx, 170, 90, 300, 220, 16); fillStroke(ctx, C.cream, C.ink, 5);
  ctx.shadowColor = 'transparent';
  
  roundRect(ctx, 170, 70, 300, 48, 8); fillStroke(ctx, C.blue, C.ink, 5);
  ctx.fillStyle = C.white;
  ctx.font = '900 26px Outfit';
  ctx.fillText('CORREIOS', 255, 104);
  
  roundRect(ctx, 290, 190, 60, 120, 6); fillStroke(ctx, C.woodDk, C.ink, 4);
  roundRect(ctx, 200, 150, 70, 60, 8); fillStroke(ctx, '#bae6fd', C.ink, 4);
  roundRect(ctx, 370, 150, 70, 60, 8); fillStroke(ctx, '#bae6fd', C.ink, 4);
}

export function drawPartyBg(ctx) {
  drawHouseInterior(ctx, true);
  
  // Luzes da festa (pisca pisca)
  const t = Date.now() / 1000;
  for (let i = 0; i < 12; i++) {
    const x = 50 + i * 48;
    const y = 30 + Math.sin(i * 0.8) * 15;
    const on = Math.sin(t * 4 + i) > 0;
    ctx.shadowColor = on ? C.yellow : 'transparent';
    ctx.shadowBlur = on ? 16 : 0;
    ctx.fillStyle = on ? C.yellow : '#92400e';
    ellipse(ctx, x, y, 6, 8);
    ctx.fill();
    ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5; ctx.stroke();
    // fio
    ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x-24, y-8); ctx.quadraticCurveTo(x, y-12, x+24, y-8); ctx.stroke();
  }
  ctx.shadowBlur = 0;
}

export function drawStreet(ctx) {
  drawSky(ctx);
  drawHills(ctx, 200);
  
  const sg = ctx.createLinearGradient(0, 280, 0, H);
  sg.addColorStop(0, '#94a3b8');
  sg.addColorStop(1, '#475569');
  ctx.fillStyle = sg;
  ctx.fillRect(0, 280, W, H - 280);
  
  ctx.fillStyle = '#64748b';
  ctx.fillRect(0, 280, W, 10);
  ctx.fillStyle = '#cbd5e1';
  for (let x = 10; x < W; x += 80) ctx.fillRect(x, 340, 40, 8);
}

export function drawNumberBadge(ctx, n, x, y, s = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 6;
  ellipse(ctx, 0, 0, 26, 26); fillStroke(ctx, C.yellow, C.ink, 4);
  ctx.shadowBlur = 0;
  ctx.fillStyle = C.ink;
  ctx.font = '900 32px Outfit';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(n), 0, 2);
  ctx.restore();
}

/* Confetes HD */
export function makeConfetti(count) {
  const arr = [];
  const cols = [C.red, C.blue, C.yellow, C.green, C.pink, C.orange, C.purple];
  for (let i = 0; i < count; i++) {
    arr.push({
      x: Math.random() * W,
      y: Math.random() * H - H,
      vx: (Math.random() - 0.5) * 2,
      vy: Math.random() * 2 + 1,
      r: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.2,
      c: cols[(Math.random() * cols.length) | 0]
    });
  }
  return arr;
}

export function drawConfetti(ctx, arr) {
  arr.forEach(c => {
    c.x += c.vx;
    c.y += c.vy;
    c.r += c.vr;
    if (c.y > H + 20) { c.y = -20; c.x = Math.random() * W; }
    
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.r);
    ctx.fillStyle = c.c;
    ctx.fillRect(-6, -4, 12, 8);
    ctx.restore();
  });
}
