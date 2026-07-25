(() => {
  'use strict';

  // --- THE 3 OFFICIAL ROCK LEGENDS (KURT, AXL, LENNON) ---
  const fighters = [
    {
      id: 'kurt',
      name: 'Kurt Cobain',
      short: 'KURT',
      era: 'Grunge Rebel',
      special: 'Guitarrada Smash',
      quote: 'Melhor que queimar o palco.',
      color: '#e8d574', accent: '#49684e', hair: '#d8bf79', outfit: '#394b38', skin: '#e2b48e',
      power: 5, speed: 4, defense: 3, style: 'grunge', portrait: 'portrait-kurt.png'
    },
    {
      id: 'axl',
      name: 'Axl Rose',
      short: 'AXL',
      era: 'Sunset Wildcard',
      special: 'Serpent Mic-Stand',
      quote: 'Você quis o melhor? Agora aguenta.',
      color: '#ff435f', accent: '#8e183a', hair: '#b72b27', outfit: '#17141b', skin: '#e6ae80',
      power: 4, speed: 5, defense: 3, style: 'glam', portrait: 'portrait-axl.png'
    },
    {
      id: 'lennon',
      name: 'John Lennon',
      short: 'LENNON',
      era: 'The Dreamer',
      special: 'Peace & Love Pulse',
      quote: 'Dê uma chance ao contra-ataque.',
      color: '#6acfa0', accent: '#27463a', hair: '#34251e', outfit: '#314d3f', skin: '#e1b08a',
      power: 4, speed: 3, defense: 5, style: 'moptop', portrait: 'portrait-lennon.png'
    }
  ];

  // --- DOM ELEMENTS & STATE ---
  const screens = [...document.querySelectorAll('.screen')];
  const roster = document.querySelector('#roster');
  const gameCanvas = document.querySelector('#game');
  const ctx = gameCanvas.getContext('2d');
  const faceImages = {};
  const spriteCanvases = {};
  const stageSprites = {};
  const keys = {};
  const touch = {};
  let pick1 = null;
  let pick2 = null;
  let currentStage = 'woodstock'; // 'woodstock', 'stadium', or 'club'
  let muted = false;
  let audio = null;
  let distortionNode = null;
  let match = null;
  let raf = 0;
  let lastFrameTime = 0;
  let accumulator = 0;
  const fixedStep = 1000 / 60;

  // 1P Control Mapping (WASD, Arrow keys, Q, E, R, Space, F, G, H)
  const p1KeyMap = {
    left: ['KeyA', 'ArrowLeft'],
    right: ['KeyD', 'ArrowRight'],
    jump: ['KeyW', 'ArrowUp'],
    block: ['KeyS', 'ArrowDown'],
    punch: ['KeyQ', 'KeyF', 'KeyJ'],
    kick: ['KeyE', 'KeyG', 'KeyK'],
    special: ['KeyR', 'KeyH', 'KeyL', 'Space']
  };

  function isPressed(action) {
    const codes = p1KeyMap[action];
    return codes.some(code => keys[code] || touch[code]);
  }

  function consumeAction(action) {
    const codes = p1KeyMap[action];
    for (const code of codes) {
      if (keys[code] === 1 || touch[code] === 1) {
        if (keys[code]) keys[code] = 2;
        if (touch[code]) touch[code] = 2;
        return true;
      }
    }
    return false;
  }

  // --- PERFECT ALPHA TRANSLUCENT PNG PREPROCESSOR & ANTI-ALIASING ---
  function createPerfectTransparentCanvas(img) {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth || img.width || 300;
    c.height = img.naturalHeight || img.height || 400;
    const cx = c.getContext('2d');
    cx.drawImage(img, 0, 0);

    try {
      const imgData = cx.getImageData(0, 0, c.width, c.height);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        if (a === 0) continue;
        // High-precision chroma green edge feathering and spill suppression
        if (g > 130 && g > r * 1.35 && g > b * 1.35) {
          if (g > 160 && g > r * 1.6 && g > b * 1.6) {
            data[i + 3] = 0;
          } else {
            const excess = g - Math.max(r, b);
            data[i + 3] = Math.max(0, Math.min(255, a - Math.floor(excess * 2)));
            data[i + 1] = Math.min(g, Math.max(r, b) + 15);
          }
        } else if (g > r + 35 && g > b + 35 && a < 250) {
          data[i + 1] = Math.floor((r + b) / 2 + 10);
        }
      }
      cx.putImageData(imgData, 0, 0);
    } catch (e) {}
    return c;
  }

  function loadSpritePose(id, poseName, srcUrl) {
    const key = `${id}_${poseName}`;
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      spriteCanvases[key] = createPerfectTransparentCanvas(img);
      ensureDynamicSprites(id);
    };
    img.onerror = () => {
      ensureDynamicSprites(id);
    };
    img.src = srcUrl;
  }

  // --- NANO BANANA 16-BIT HD SPRITE SHEET PARSER (ESTILO MEGA DRIVE / STREETS OF RAGE) ---
  // Quando as novas Master Sprite Sheets geradas por IA no Nano Banana forem adicionadas na pasta assets/
  // (ex: assets/kurt_sprite_sheet.png, axl_sprite_sheet.png, lennon_sprite_sheet.png), esta função recorta
  // automaticamente a grade 6x5 e extrae os ~29 quadros animados para combates ultradinâmicos de 60 FPS!
  function loadMegaDriveSpriteSheet(id, filename) {
    const sheetImg = new Image();
    sheetImg.decoding = 'async';
    sheetImg.onload = () => {
      console.log(`[Nano Banana Parser] Master Sprite Sheet 16-bit carregada para: ${id}`);
      // Grade padrão do estilo 16-Bit Mega Drive: 6 colunas por 5 linhas
      const cols = 6;
      const rows = 5;
      const cellW = Math.floor(sheetImg.width / cols);
      const cellH = Math.floor(sheetImg.height / rows);
      
      const animMap = {
        idle:    { row: 0, count: 3 },
        walk:    { row: 1, count: 4 },
        punch:   { row: 2, count: 3 },
        kick:    { row: 3, count: 3 },
        special: { row: 4, count: 4 },
        hit:     { row: 4, count: 2, offsetCol: 4 }
      };

      Object.entries(animMap).forEach(([action, meta]) => {
        for (let i = 0; i < meta.count; i++) {
          const col = (meta.offsetCol || 0) + i;
          if (col >= cols) continue;
          
          const sliceCan = document.createElement('canvas');
          sliceCan.width = cellW;
          sliceCan.height = cellH;
          const scx = sliceCan.getContext('2d');
          scx.drawImage(sheetImg, col * cellW, meta.row * cellH, cellW, cellH, 0, 0, cellW, cellH);
          
          const cleanCanvas = createPerfectTransparentCanvas(sliceCan);
          const frameKey = `${id}_${action}_f${i}`;
          spriteCanvases[frameKey] = cleanCanvas;
          
          // O quadro zero vira também o padrão de fallback principal!
          if (i === 0) {
            if (action === 'walk') {
              spriteCanvases[`${id}_walk1`] = cleanCanvas;
            } else {
              spriteCanvases[`${id}_${action}`] = cleanCanvas;
            }
          } else if (i === 1 && action === 'walk') {
            spriteCanvases[`${id}_walk2`] = cleanCanvas;
          }
        }
      });
      ensureDynamicSprites(id);
    };
    sheetImg.src = `assets/${filename}`;
  }

  // --- GERADOR PROCEDURAL DE SPRITES DINÂMICOS & REALISMO DE KOMBAT ---
  function ensureDynamicSprites(id) {
    const base = spriteCanvases[`${id}_idle`];
    if (!base) return;
    const w = base.width || 300;
    const h = base.height || 400;

    // 1. Sprite de PULO DEDICADO (Jump) - Aerodinâmico e realista
    if (!spriteCanvases[`${id}_jump`]) {
      const jCanvas = document.createElement('canvas');
      jCanvas.width = w; jCanvas.height = h;
      const cx = jCanvas.getContext('2d');
      cx.save();
      cx.strokeStyle = 'rgba(120, 220, 255, 0.45)'; cx.lineWidth = 3;
      cx.beginPath();
      cx.moveTo(w * 0.3, h * 0.85); cx.lineTo(w * 0.15, h * 0.98);
      cx.moveTo(w * 0.5, h * 0.88); cx.lineTo(w * 0.4, h * 0.99);
      cx.stroke();
      cx.translate(w * 0.5, h * 0.5);
      cx.rotate(-0.18);
      cx.scale(1.04, 0.92);
      cx.drawImage(base, -w * 0.5, -h * 0.5 - 12, w, h);
      cx.restore();
      spriteCanvases[`${id}_jump`] = jCanvas;
    }

    // 2. Sprites de GOLPES ESPECIAIS DIVERTIDOS E PRÓPRIOS (Custom Special Weapons & VFX)
    if (!spriteCanvases[`${id}_special_base`] && spriteCanvases[`${id}_special`]) {
      spriteCanvases[`${id}_special_base`] = spriteCanvases[`${id}_special`];
    }
    const origSp = spriteCanvases[`${id}_special_base`] || spriteCanvases[`${id}_special`] || base;
    const spCanvas = document.createElement('canvas');
    spCanvas.width = w + 90; spCanvas.height = h + 70;
    const scx = spCanvas.getContext('2d');
    scx.save();
    scx.translate(25, 35);
    scx.drawImage(origSp, 0, 0, w, h);

    if (id === 'kurt') {
      scx.save();
      scx.translate(w * 0.62, h * 0.44);
      scx.rotate(0.68);
      scx.fillStyle = '#f5e3b3'; scx.strokeStyle = '#232018'; scx.lineWidth = 4;
      scx.beginPath(); scx.ellipse(0, 0, 48, 29, 0, 0, Math.PI * 2); scx.fill(); scx.stroke();
      scx.fillStyle = '#8f2d29'; scx.beginPath(); scx.ellipse(-6, 2, 28, 18, 0, 0, Math.PI * 2); scx.fill();
      scx.fillStyle = '#222'; scx.fillRect(-5, -8, 12, 16);
      scx.fillStyle = '#543621'; scx.fillRect(35, -7, 78, 14);
      scx.fillStyle = '#f5e3b3'; scx.fillRect(113, -10, 26, 20);
      scx.strokeStyle = '#36e5ff'; scx.lineWidth = 2.5; scx.shadowColor = '#36e5ff'; scx.shadowBlur = 16;
      for (let i = 0; i < 5; i++) {
        scx.beginPath(); scx.moveTo(-32, -5 + i * 2.5); scx.lineTo(113, -5 + i * 2.5); scx.stroke();
      }
      scx.restore();
    } else if (id === 'axl') {
      scx.save();
      scx.translate(w * 0.55, h * 0.42);
      scx.strokeStyle = '#e2e8f0'; scx.lineWidth = 6; scx.lineCap = 'round';
      scx.shadowColor = '#fff'; scx.shadowBlur = 8;
      scx.beginPath(); scx.moveTo(-30, 45); scx.lineTo(88, -68); scx.stroke();
      scx.fillStyle = '#475569'; scx.beginPath(); scx.arc(92, -72, 12, 0, Math.PI * 2); scx.fill();
      scx.strokeStyle = '#ff3300'; scx.lineWidth = 8; scx.shadowColor = '#ff6600'; scx.shadowBlur = 25;
      scx.beginPath(); scx.moveTo(-30, 45); scx.bezierCurveTo(-65, -10, 125, -10, 88, -68); scx.stroke();
      scx.strokeStyle = '#ffcc00'; scx.lineWidth = 3.5; scx.stroke();
      scx.restore();
    } else if (id === 'lennon') {
      scx.save();
      scx.translate(w * 0.56, h * 0.52);
      scx.rotate(-0.35);
      scx.fillStyle = '#3a7d44'; scx.strokeStyle = '#ffffff'; scx.lineWidth = 4;
      scx.shadowColor = '#6df28e'; scx.shadowBlur = 20;
      scx.beginPath(); scx.roundRect(-44, -32, 88, 62, 22); scx.fill(); scx.stroke();
      scx.fillStyle = '#3e2723'; scx.fillRect(-42, -8, -80, 16);
      scx.font = 'bold 38px sans-serif';
      scx.fillStyle = '#ff61b0'; scx.fillText('☮', 38, -48);
      scx.fillStyle = '#ffd700'; scx.fillText('❤️', 48, 48);
      scx.fillStyle = '#36d7ff'; scx.fillText('♪', -75, -35);
      scx.restore();
    }
    scx.restore();
    spriteCanvases[`${id}_special`] = spCanvas;

    // 3. Variações cinemáticas de combate caso faltem poses específicas
    const poses = [
      { name: 'punch', dx: 18, dy: -4, rot: 0.08, scaleX: 1.08, scaleY: 0.98 },
      { name: 'kick', dx: 12, dy: -12, rot: -0.15, scaleX: 1.06, scaleY: 0.97 },
      { name: 'block', dx: -12, dy: 6, rot: -0.07, scaleX: 0.96, scaleY: 1.04 },
      { name: 'hit', dx: -22, dy: -8, rot: -0.25, scaleX: 0.94, scaleY: 1.06 },
      { name: 'walk1', dx: 8, dy: -4, rot: 0.04, scaleX: 1.02, scaleY: 0.99 },
      { name: 'walk2', dx: -8, dy: 2, rot: -0.03, scaleX: 0.98, scaleY: 1.01 }
    ];
    poses.forEach(p => {
      if (!spriteCanvases[`${id}_${p.name}`]) {
        const pCan = document.createElement('canvas');
        pCan.width = w; pCan.height = h;
        const pcx = pCan.getContext('2d');
        pcx.save();
        pcx.translate(w * 0.5 + p.dx, h * 0.5 + p.dy);
        pcx.rotate(p.rot);
        pcx.scale(p.scaleX, p.scaleY);
        pcx.drawImage(base, -w * 0.5, -h * 0.5);
        pcx.restore();
        spriteCanvases[`${id}_${p.name}`] = pCan;
      }
    });
  }

  // Preload UI & Active Realist Sprite Assets in True Transparent PNG (Streets of Rage Full Roster)
  fighters.forEach(f => {
    // 1. Tenta carregar e recortar automaticamente a nova Master Sprite Sheet 16-Bit (Nano Banana)
    loadMegaDriveSpriteSheet(f.id, `${f.id}_sprite_sheet.png`);

    const portraitImg = new Image();
    portraitImg.decoding = 'async';
    portraitImg.src = `assets/${f.portrait}`;
    faceImages[f.id] = portraitImg;

    loadSpritePose(f.id, 'idle', `assets/sprite-${f.id}.png`);
    loadSpritePose(f.id, 'walk1', `assets/sprite-${f.id}-walk1.png`);
    loadSpritePose(f.id, 'walk2', `assets/sprite-${f.id}-walk2.png`);
    loadSpritePose(f.id, 'jump', `assets/sprite-${f.id}-jump.png`);
    loadSpritePose(f.id, 'punch', `assets/sprite-${f.id}-punch.png`);
    loadSpritePose(f.id, 'kick', `assets/sprite-${f.id}-kick.png`);
    loadSpritePose(f.id, 'special', `assets/sprite-${f.id}-special.png`);
    loadSpritePose(f.id, 'block', `assets/sprite-${f.id}-block.png`);
    loadSpritePose(f.id, 'hit', `assets/sprite-${f.id}-hit.png`);
  });

  setTimeout(() => fighters.forEach(f => ensureDynamicSprites(f.id)), 900);

  // Stage Fog & Crowd Effects
  const stageFog = [];
  const crowdLights = [];
  for (let i = 0; i < 40; i++) {
    crowdLights.push({
      x: Math.random() * 960,
      y: 395 + Math.random() * 65,
      size: Math.random() * 2.8 + 1.2,
      color: Math.random() > 0.4 ? '#36dff1' : Math.random() > 0.5 ? '#ff4797' : '#ffc44d',
      phase: Math.random() * Math.PI * 2,
      speed: 0.02 + Math.random() * 0.04
    });
  }
  for (let i = 0; i < 20; i++) {
    stageFog.push({
      x: Math.random() * 1100 - 100,
      y: 380 + Math.random() * 50,
      vx: 0.15 + Math.random() * 0.25,
      radius: 42 + Math.random() * 45,
      alpha: 0.06 + Math.random() * 0.08
    });
  }

  // --- GERADOR DE SPRITES REALISTAS E TRANSPARENTES PARA CENÁRIOS (WOODSTOCK '69 & ARENAS) ---
  function initRealisticStageSprites() {
    // 1. Marshall 4x12 Amp Full-Stack Sprite (Transparente)
    const ampC = document.createElement('canvas');
    ampC.width = 140; ampC.height = 240;
    const ax = ampC.getContext('2d');
    const shadowG = ax.createRadialGradient(70, 232, 5, 70, 232, 60);
    shadowG.addColorStop(0, 'rgba(0,0,0,0.65)'); shadowG.addColorStop(1, 'transparent');
    ax.fillStyle = shadowG; ax.fillRect(0, 215, 140, 25);
    [70, 150].forEach((y, idx) => {
      ax.fillStyle = '#110c14'; ax.fillRect(15, y, 110, 75);
      ax.strokeStyle = '#2b2133'; ax.lineWidth = 2; ax.strokeRect(15, y, 110, 75);
      ax.fillStyle = '#1d1722'; ax.fillRect(21, y + 6, 98, 63);
      ax.fillStyle = '#0f0a13';
      [42, 88].forEach(sx => {
        [y + 24, y + 54].forEach(sy => {
          ax.beginPath(); ax.arc(sx, sy, 13, 0, Math.PI * 2); ax.fill();
          ax.strokeStyle = '#32253b'; ax.lineWidth = 1; ax.stroke();
          ax.fillStyle = '#40324a'; ax.beginPath(); ax.arc(sx, sy, 4, 0, Math.PI * 2); ax.fill();
          ax.fillStyle = '#0f0a13';
        });
      });
      ax.fillStyle = idx === 0 ? '#ffffff' : '#ffd56b';
      ax.font = 'italic bold 11px "Barlow Condensed", Inter, sans-serif';
      ax.fillText('Marshall', 48, y + 20);
    });
    ax.fillStyle = '#140f1a'; ax.fillRect(20, 25, 100, 42);
    ax.strokeStyle = '#382a45'; ax.lineWidth = 2; ax.strokeRect(20, 25, 100, 42);
    const goldPanel = ax.createLinearGradient(25, 0, 115, 0);
    goldPanel.addColorStop(0, '#e6a100'); goldPanel.addColorStop(0.5, '#ffee82'); goldPanel.addColorStop(1, '#c98600');
    ax.fillStyle = goldPanel; ax.fillRect(25, 45, 90, 16);
    ax.fillStyle = '#1a110a';
    for (let k = 0; k < 6; k++) { ax.beginPath(); ax.arc(38 + k * 12, 53, 3, 0, Math.PI * 2); ax.fill(); }
    ax.fillStyle = '#ff2e78'; ax.shadowColor = '#ff2e78'; ax.shadowBlur = 6;
    ax.beginPath(); ax.arc(108, 53, 3.5, 0, Math.PI * 2); ax.fill(); ax.shadowBlur = 0;
    stageSprites.marshallStack = ampC;

    // 2. Bateria Realista Woodstock com Bumbo "Peace ☮️" (Transparente)
    const drumC = document.createElement('canvas');
    drumC.width = 280; drumC.height = 200;
    const dx = drumC.getContext('2d');
    dx.fillStyle = 'rgba(75, 15, 25, 0.85)'; dx.fillRect(10, 165, 260, 28);
    dx.strokeStyle = 'rgba(215, 155, 65, 0.5)'; dx.lineWidth = 2; dx.strokeRect(10, 165, 260, 28);
    const kickG = dx.createRadialGradient(140, 125, 15, 140, 125, 52);
    kickG.addColorStop(0, '#f8f4f0'); kickG.addColorStop(0.85, '#dfd6cb'); kickG.addColorStop(1, '#8e7968');
    dx.fillStyle = kickG; dx.beginPath(); dx.arc(140, 130, 50, 0, Math.PI * 2); dx.fill();
    dx.strokeStyle = '#382a20'; dx.lineWidth = 6; dx.stroke();
    dx.strokeStyle = '#c42045'; dx.lineWidth = 5;
    dx.beginPath(); dx.arc(140, 130, 32, 0, Math.PI * 2); dx.stroke();
    dx.beginPath(); dx.moveTo(140, 98); dx.lineTo(140, 162);
    dx.moveTo(140, 130); dx.lineTo(116, 154);
    dx.moveTo(140, 130); dx.lineTo(164, 154); dx.stroke();
    [{x: 95, y: 110, r: 28, h: 22}, {x: 185, y: 110, r: 28, h: 24}, {x: 65, y: 140, r: 30, h: 20}].forEach(d => {
      dx.fillStyle = '#221820'; dx.fillRect(d.x - d.r, d.y, d.r * 2, d.h);
      dx.fillStyle = '#dedce4'; dx.beginPath(); dx.ellipse(d.x, d.y, d.r, d.r * 0.45, 0, 0, Math.PI * 2); dx.fill();
      dx.strokeStyle = '#cccccc'; dx.lineWidth = 3; dx.stroke();
    });
    [{x: 45, y: 75, r: 35}, {x: 105, y: 55, r: 32}, {x: 180, y: 50, r: 34}, {x: 235, y: 75, r: 38}].forEach(cym => {
      const cG = dx.createRadialGradient(cym.x, cym.y, 2, cym.x, cym.y, cym.r);
      cG.addColorStop(0, '#ffffff'); cG.addColorStop(0.3, '#ffde59'); cG.addColorStop(0.8, '#c99618'); cG.addColorStop(1, '#664906');
      dx.fillStyle = cG;
      dx.beginPath(); dx.ellipse(cym.x, cym.y, cym.r, cym.r * 0.28, -0.15, 0, Math.PI * 2); dx.fill();
      dx.strokeStyle = '#aaaaaa'; dx.lineWidth = 3;
      dx.beginPath(); dx.moveTo(cym.x, cym.y + 6); dx.lineTo(cym.x + 4, 175); dx.stroke();
    });
    stageSprites.woodstockDrumKit = drumC;

    // 3. Estrutura Rústica Woodstock '69 e Canhão de Luz (Rigging) Esquerda & Direita
    [true, false].forEach(isLeft => {
      const rigC = document.createElement('canvas');
      rigC.width = 220; rigC.height = 420;
      const rx = rigC.getContext('2d');
      rx.fillStyle = '#301d14'; rx.fillRect(isLeft ? 20 : 160, 0, 40, 420);
      rx.fillStyle = '#4a2c1e'; rx.fillRect(isLeft ? 0 : 180, 0, 22, 420);
      for (let y = 40; y < 400; y += 80) {
        rx.fillStyle = '#26160f'; rx.fillRect(isLeft ? 0 : 160, y, 60, 18);
        rx.fillStyle = '#b89b80';
        rx.beginPath(); rx.arc(isLeft ? 10 : 170, y + 9, 3, 0, Math.PI * 2); rx.fill();
        rx.beginPath(); rx.arc(isLeft ? 50 : 210, y + 9, 3, 0, Math.PI * 2); rx.fill();
      }
      const paX = isLeft ? 65 : 45;
      for (let box = 0; box < 3; box++) {
        const by = 180 + box * 75;
        rx.fillStyle = '#1c1720'; rx.fillRect(paX, by, 110, 70);
        rx.strokeStyle = '#382f3d'; rx.lineWidth = 2; rx.strokeRect(paX, by, 110, 70);
        rx.fillStyle = '#100b14'; rx.fillRect(paX + 8, by + 10, 94, 50);
        rx.fillStyle = '#2b2133';
        rx.fillRect(paX + 16, by + 18, 78, 12);
        rx.fillRect(paX + 16, by + 38, 78, 12);
      }
      const flagG = rx.createLinearGradient(isLeft ? 55 : 35, 30, isLeft ? 55 : 35, 170);
      if (isLeft) {
        flagG.addColorStop(0, '#c42045'); flagG.addColorStop(0.5, '#f59e0b'); flagG.addColorStop(1, '#6b21a8');
      } else {
        flagG.addColorStop(0, '#1e3a8a'); flagG.addColorStop(0.5, '#0d9488'); flagG.addColorStop(1, '#db2777');
      }
      rx.fillStyle = flagG;
      rx.fillRect(isLeft ? 60 : 40, 25, 120, 135);
      rx.strokeStyle = '#f8fafc'; rx.lineWidth = 2; rx.strokeRect(isLeft ? 60 : 40, 25, 120, 135);
      rx.fillStyle = '#ffffff'; rx.textAlign = 'center';
      rx.font = '900 13px "Barlow Condensed", sans-serif';
      rx.fillText(isLeft ? "WOODSTOCK '69" : "3 DAYS OF PEACE", isLeft ? 120 : 100, 55);
      rx.font = 'bold 26px sans-serif';
      rx.fillText(isLeft ? "☮️" : "🕊️🎸", isLeft ? 120 : 100, 105);
      rx.font = '800 11px Inter, sans-serif';
      rx.fillText(isLeft ? "PEACE & MUSIC" : "ROCK LEGENDS", isLeft ? 120 : 100, 142);
      
      rx.fillStyle = '#0f0a13';
      rx.beginPath(); rx.arc(isLeft ? 110 : 110, 15, 18, 0, Math.PI * 2); rx.fill();
      const glowG = rx.createRadialGradient(isLeft ? 110 : 110, 15, 2, isLeft ? 110 : 110, 15, 22);
      glowG.addColorStop(0, '#ffffff'); glowG.addColorStop(0.3, '#ffbe3b'); glowG.addColorStop(1, 'transparent');
      rx.fillStyle = glowG;
      rx.beginPath(); rx.arc(isLeft ? 110 : 110, 15, 22, 0, Math.PI * 2); rx.fill();
      stageSprites[isLeft ? 'woodstockRigLeft' : 'woodstockRigRight'] = rigC;
    });

    // 4. Amplificador Valvulado para Underground Club (Transparente)
    const clubC = document.createElement('canvas');
    clubC.width = 160; clubC.height = 160;
    const cx = clubC.getContext('2d');
    cx.fillStyle = '#3a2a1d'; cx.fillRect(15, 30, 130, 115);
    cx.strokeStyle = '#1f140c'; cx.lineWidth = 3; cx.strokeRect(15, 30, 130, 115);
    cx.fillStyle = '#140c08'; cx.fillRect(25, 45, 110, 85);
    cx.fillStyle = '#ff7b00'; cx.shadowColor = '#ff6200'; cx.shadowBlur = 10;
    [50, 75, 100].forEach(tx => { cx.fillRect(tx, 35, 8, 16); });
    cx.shadowBlur = 0;
    cx.fillStyle = '#b51a30'; cx.fillRect(95, 135, 32, 22);
    cx.fillStyle = '#ff1a1a'; cx.beginPath(); cx.arc(111, 140, 2.5, 0, Math.PI * 2); cx.fill();
    stageSprites.clubTubeAmp = clubC;
  }
  initRealisticStageSprites();

  const $ = (selector) => document.querySelector(selector);
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const rand = (min, max) => Math.random() * (max - min) + min;

  // --- CANVAS HIGH-DPI RESIZING ---
  function resizeCanvas() {
    if (!gameCanvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = gameCanvas.getBoundingClientRect();
    const targetW = rect.width || 960;
    const targetH = rect.height || 540;

    if (gameCanvas.width !== Math.round(targetW * dpr) || gameCanvas.height !== Math.round(targetH * dpr)) {
      gameCanvas.width = Math.round(targetW * dpr);
      gameCanvas.height = Math.round(targetH * dpr);
    }
  }
  window.addEventListener('resize', resizeCanvas);

  function showScreen(id) {
    screens.forEach(screen => screen.classList.toggle('is-active', screen.id === id));
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (id === 'arena-screen') {
      setTimeout(resizeCanvas, 50);
    }
  }

  // --- WEB AUDIO SYNTHESIZER ---
  function makeDistortionCurve(amount = 50) {
    const k = amount;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  function initAudio() {
    if (muted) return;
    if (!audio) {
      audio = new (window.AudioContext || window.webkitAudioContext)();
      distortionNode = audio.createWaveShaper();
      distortionNode.curve = makeDistortionCurve(75);
      distortionNode.oversample = '4x';
    }
    if (audio.state === 'suspended') audio.resume();
  }

  function playPowerChord(rootFreq, duration = 0.5, type = 'heavy') {
    if (muted) return;
    initAudio();
    const now = audio.currentTime;
    const freqs = [rootFreq, rootFreq * 1.498, rootFreq * 2.0];

    const masterGain = audio.createGain();
    const cabinetFilter = audio.createBiquadFilter();
    cabinetFilter.type = 'lowpass';
    cabinetFilter.frequency.value = type === 'special' ? 3600 : 2300;

    masterGain.gain.setValueAtTime(0.15, now);
    masterGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    freqs.forEach((freq, idx) => {
      const osc = audio.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq * (idx === 0 ? 1 : 1.002), now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.98, now + duration);
      osc.connect(distortionNode);
    });

    distortionNode.connect(cabinetFilter);
    cabinetFilter.connect(masterGain);
    masterGain.connect(audio.destination);

    setTimeout(() => {
      try { masterGain.disconnect(); } catch (e) {}
    }, duration * 1000 + 100);
  }

  function sound(type, pitch = 1) {
    if (muted) return;
    initAudio();
    const now = audio.currentTime;

    if (type === 'special') {
      playPowerChord(146.83 * pitch, 0.9, 'special');
      return;
    }

    if (type === 'hit') {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(135 * pitch, now);
      osc.frequency.exponentialRampToValueAtTime(25, now + 0.18);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain).connect(audio.destination);
      osc.start(now); osc.stop(now + 0.22);

      playPowerChord(98.0 * pitch, 0.28, 'heavy');
      return;
    }

    if (type === 'block') {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      const filter = audio.createBiquadFilter();
      osc.type = 'square';
      osc.frequency.setValueAtTime(350 * pitch, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.12);
      filter.type = 'bandpass';
      filter.frequency.value = 1500;
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.connect(filter).connect(gain).connect(audio.destination);
      osc.start(now); osc.stop(now + 0.15);
      return;
    }

    if (type === 'crowd') {
      const bufferSize = audio.sampleRate * 0.6;
      const buffer = audio.createBuffer(1, bufferSize, audio.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      const whiteNoise = audio.createBufferSource();
      whiteNoise.buffer = buffer;
      const filter = audio.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(850, now);
      filter.frequency.exponentialRampToValueAtTime(1700, now + 0.3);
      filter.Q.value = 3;
      const gain = audio.createGain();
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      whiteNoise.connect(filter).connect(gain).connect(audio.destination);
      whiteNoise.start(now);
      return;
    }

    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(270 * pitch, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.12);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(gain).connect(audio.destination);
    osc.start(now); osc.stop(now + 0.15);
  }

  function stat(label, value) {
    return `<div class="stats"><b>${label}</b><span class="stat-dots">${[1,2,3,4,5].map(i => `<i class="${i <= value ? 'on' : ''}"></i>`).join('')}</span></div>`;
  }

  roster.innerHTML = '';
  fighters.forEach(fighter => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'fighter-card';
    card.dataset.id = fighter.id;
    card.style.setProperty('--fighter', fighter.color);
    card.setAttribute('role', 'listitem');
    card.setAttribute('aria-label', `Selecionar ${fighter.name}, especial ${fighter.special}`);
    card.innerHTML = `<div class="portrait"></div><div class="fighter-info"><h3>${fighter.name}</h3><p>${fighter.special}</p>${stat('PWR',fighter.power)}${stat('SPD',fighter.speed)}</div>`;
    const portrait = card.querySelector('.portrait');
    portrait.style.setProperty('--portrait-image', `url("assets/${fighter.portrait}")`);
    card.addEventListener('click', () => selectFighter(fighter));
    roster.append(card);
  });

  function selectFighter(fighter) {
    initAudio();
    sound('ui', 1.3);
    pick1 = fighter;
    const others = fighters.filter(f => f.id !== fighter.id);
    pick2 = others[Math.floor(Math.random() * others.length)];
    updatePicks();
  }

  function updatePicks() {
    document.querySelectorAll('.fighter-card').forEach(card => {
      card.classList.toggle('is-p1', pick1?.id === card.dataset.id);
      card.classList.toggle('is-p2', pick2?.id === card.dataset.id);
    });
    $('#p1-pick strong').textContent = pick1 ? pick1.name : 'ESCOLHA';
    $('#p2-pick strong').textContent = pick2 ? pick2.name : 'ALEATÓRIO';
    $('#start-fight').disabled = !(pick1 && pick2);
  }

  // Stage Switcher Listener
  document.querySelectorAll('.stage-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentStage = btn.dataset.stage;
      document.querySelectorAll('.stage-btn').forEach(b => b.classList.toggle('is-active', b === btn));
    });
  });

  // --- PLAYER ENTITY CLASS ---
  class Player {
    constructor(data, x, facing, isCpu = false) {
      this.data = data; this.x = x; this.y = 425; this.vx = 0; this.vy = 0;
      this.facing = facing; this.cpu = isCpu;
      this.health = 100; this.meter = 20; this.width = 75; this.height = 160;
      this.grounded = true; this.attack = null; this.attackTimer = 0; this.cooldown = 0;
      this.hitFlash = 0; this.stun = 0; this.blocking = false; this.aiTimer = 0;
      this.afterimages = []; this.combo = 0; this.comboTimer = 0; this.animFrame = 0;
      this.landSquash = 0; this.bufferedAttack = null;
    }

    input(other) {
      if (this.stun > 0) return { left:false, right:false, jump:false, block:false, punch:false, kick:false, special:false };
      if (!this.cpu) {
        return {
          left: isPressed('left'),
          right: isPressed('right'),
          jump: consumeAction('jump'),
          block: isPressed('block'),
          punch: consumeAction('punch'),
          kick: consumeAction('kick'),
          special: consumeAction('special')
        };
      }

      this.aiTimer--;
      const distance = Math.abs(other.x - this.x);
      const input = { left:false, right:false, jump:false, block:false, punch:false, kick:false, special:false };

      if (other.attack && distance < 145 && Math.random() < 0.85) {
        input.block = true;
      }
      if (distance > 115) {
        input[other.x < this.x ? 'left' : 'right'] = true;
      } else if (distance < 65 && Math.random() < 0.25) {
        input[other.x < this.x ? 'right' : 'left'] = true;
      }

      if (distance < 145 && this.cooldown <= 0 && this.aiTimer <= 0) {
        if (this.meter >= 100 && Math.random() < 0.78) {
          input.special = true;
        } else {
          const randAttack = Math.random();
          if (randAttack < 0.50) input.punch = true;
          else if (randAttack < 0.88) input.kick = true;
          else input.block = true;
        }
        this.aiTimer = rand(12, 34);
      }
      if (distance > 210 && Math.random() < 0.04) input.jump = true;
      return input;
    }

    update(other) {
      this.animFrame++;
      if (this.cooldown > 0) this.cooldown--;
      if (this.hitFlash > 0) this.hitFlash--;
      if (this.stun > 0) this.stun--;
      if (this.landSquash > 0) this.landSquash--;
      if (this.comboTimer > 0) this.comboTimer--; else this.combo = 0;

      const input = this.input(other);

      if (this.attack && this.attackTimer <= Math.max(9, this.attack.activeAt)) {
        if (input.punch) this.bufferedAttack = 'punch';
        else if (input.kick) this.bufferedAttack = 'kick';
        else if (input.special && this.meter >= 100) this.bufferedAttack = 'special';
      }
      if (!this.attack && this.bufferedAttack && this.cooldown <= 0) {
        const queued = this.bufferedAttack; this.bufferedAttack = null; this.startAttack(queued);
      }

      this.blocking = input.block && this.grounded && !this.attack;
      const speed = (3.5 + this.data.speed * 0.25) * (this.cpu ? 0.92 : 1);

      if (!this.attack && !this.blocking && this.stun <= 0) {
        const targetSpeed = input.left ? -speed : input.right ? speed : 0;
        const control = this.grounded ? 0.40 : 0.18;
        this.vx += (targetSpeed - this.vx) * control;
        if (!input.left && !input.right) this.vx *= this.grounded ? 0.70 : 0.96;
        if (input.jump && this.grounded) {
          this.vy = -13.0; this.grounded = false; sound('ui', 0.65);
        }
        if (input.punch) this.startAttack('punch');
        else if (input.kick) this.startAttack('kick');
        else if (input.special && this.meter >= 100) this.startAttack('special');
      } else if (this.attack) {
        this.vx *= 0.80;
      }

      const wasGrounded = this.grounded;
      this.vy += 0.75;
      this.x += this.vx; this.y += this.vy;

      if (this.y >= 425) {
        this.y = 425;
        if (!wasGrounded && this.vy > 4) {
          this.landSquash = 8;
          match.shake = Math.max(match.shake, 4.0);
          if (typeof burst === 'function') burst(this.x, 425, '#c2cbda', 8, 'land');
          sound('ui', 0.48);
        }
        this.vy = 0; this.grounded = true;
      }
      this.x = clamp(this.x, 70, 890);
      this.facing = other.x >= this.x ? 1 : -1;

      if (this.attackTimer > 0) {
        this.attackTimer--;
        if (!this.attack.hit && this.attackTimer <= this.attack.activeAt) this.checkHit(other);
        if (this.attackTimer <= 0) this.attack = null;
      }
      this.afterimages = this.afterimages.filter(a => --a.life > 0);
    }

    startAttack(type) {
      if (this.cooldown > 0) return;
      const config = {
        punch: { duration: 18, activeAt: 10, range: 108 + (this.cpu ? 0 : 14), damage: 7 + this.data.power * 0.75, knock: 4.0 },
        kick: { duration: 25, activeAt: 14, range: 128 + (this.cpu ? 0 : 14), damage: 10 + this.data.power * 1.05, knock: 6.0 },
        special: { duration: 55, activeAt: 35, range: 280 + (this.cpu ? 0 : 20), damage: 22 + this.data.power * 1.3, knock: 13 }
      }[type];

      this.attack = { type, ...config, hit: false };
      this.attackTimer = config.duration;
      this.cooldown = (type === 'special' ? 55 : config.duration + 2) + (this.cpu ? 5 : 0);
      this.vx += this.facing * (type === 'special' ? 4.8 : type === 'kick' ? 3.0 : 2.0);

      if (type === 'special') {
        this.meter = 0;
        this.afterimages.push({ x: this.x - 20 * this.facing, y: this.y, life: 25 });
        announce(this.data.special.toUpperCase(), 780);
        sound('special', 1 + this.data.speed * 0.05);
        sound('crowd');
      } else {
        if (type === 'kick') this.afterimages.push({ x: this.x - 10 * this.facing, y: this.y, life: 12 });
        sound('ui', type === 'kick' ? 0.75 : 1.1);
      }
    }

    checkHit(other) {
      const reach = this.attack.range;
      const inFront = (other.x - this.x) * this.facing > -25;
      const distance = Math.abs(other.x - this.x);
      const vertical = Math.abs(other.y - this.y) < 110;

      if (inFront && distance < reach && vertical) {
        this.attack.hit = true;
        let damage = this.attack.damage;
        if (this.cpu) damage *= 0.65;
        else if (other.cpu) damage *= 1.15;
        if (other.blocking) damage *= 0.15;

        other.health = clamp(other.health - damage, 0, 100);
        other.hitFlash = 9;
        other.stun = other.blocking ? 6 : this.attack.type === 'special' ? 30 : 12;
        other.vx = this.attack.knock * this.facing * (other.blocking ? 0.35 : 1);
        if (this.attack.type === 'special') other.vy = -6.5;

        this.meter = clamp(this.meter + (this.attack.type === 'special' ? 0 : this.cpu ? 11 : 24), 0, 100);
        other.meter = clamp(other.meter + (other.cpu ? 6 : 14), 0, 100);
        this.combo++; this.comboTimer = 65;

        // Estilo Mega Drive / Streets of Rage: Hitstop mais estalado e tremedeira pesada!
        match.shake = this.attack.type === 'special' ? 24 : this.attack.type === 'kick' ? 14 : 9;
        match.flash = this.attack.type === 'special' ? 10 : 3;
        match.hitStop = other.blocking ? 4 : this.attack.type === 'special' ? 14 : this.attack.type === 'kick' ? 8 : 5;
        match.zoomPulse = this.attack.type === 'special' ? 0.09 : 0.035;

        const impactText = this.attack.type === 'special'
          ? (this.data.id === 'kurt' ? 'GUITARRADA SMASH!' : this.data.id === 'axl' ? 'SERPENT SCREAM!' : 'PEACE & LOVE PULSE!')
          : (other.blocking ? 'BLOCK!' : this.attack.type === 'kick' ? 'THUD!' : 'POW!');

        match.impacts.push({
          x: (this.x + other.x) / 2, y: other.y - 95,
          text: impactText,
          color: this.data.color, life: this.attack.type === 'special' ? 38 : 24
        });

        burst((this.x + other.x) / 2, other.y - 85, this.data.color, this.attack.type === 'special' ? 42 : 16, this.attack.type, this.data.id);
        sound(other.blocking ? 'block' : 'hit', this.attack.type === 'special' ? 0.6 : 0.95);
      }
    }
  }

  function startMatch() {
    if (!pick1 || !pick2) return;
    initAudio();
    showScreen('arena-screen');
    const s1 = fighters.find(x => x.id === pick1);
    const s2 = fighters.find(x => x.id === pick2);
    match = {
      p1: new Fighter(320, 425, 1, s1, false),
      p2: new Fighter(640, 425, -1, s2, true),
      timer: 75, frames: 0, state: 'intro', intro: 150, particles: [], impacts: [], shake: 0, flash: 0, hitStop: 0, zoomPulse: 0, ended: false, paused: false,
    };
    $('#p1-name').textContent = s1.short; $('#p2-name').textContent = s2.short;
    $('#timer').textContent = match.timer;
    $('#opponent-label').textContent = match.p2.cpu ? 'CPU' : 'P2';

    const stageNames = { woodstock: "WOODSTOCK '69 STAGE", stadium: "STADIUM ARENA '94", club: "UNDERGROUND TUBE CLUB" };
    $('#round-label').textContent = stageNames[currentStage] || "WORLD TOUR STAGE";

    $('#coach-text').textContent = window.matchMedia('(max-width: 720px)').matches
      ? 'Use as setas ← e → para chegar perto do rival.'
      : 'Use A/D ou Setas. Q é Soco, E é Chute, R é Golpe Especial!';

    announce('ROUND 1', 800);
    sound('crowd');
    cancelAnimationFrame(raf);
    lastFrameTime = 0; accumulator = 0;
    raf = requestAnimationFrame(loop);
  }

  function burst(x, y, color, count, type = 'normal', id = null) {
    const icons = id === 'kurt' ? ['🎸', '⚡', '✦', ''] : id === 'axl' ? ['🔥', '💥', '✨', ''] : id === 'lennon' ? ['☮', '❤️', '♪', '♫'] : [''];
    for (let i = 0; i < count; i++) {
      const isIcon = type === 'special' && Math.random() > 0.35;
      const chosenIcon = isIcon ? icons[Math.floor(Math.random() * icons.length)] : '';
      const isLand = type === 'land';
      if (match && match.particles) {
        match.particles.push({
          x: x + rand(-18, 18),
          y: y + rand(isLand ? -4 : -15, isLand ? 4 : 15),
          vx: rand(isLand ? -12 : -10, isLand ? 12 : 10),
          vy: isIcon ? rand(-14, -2) : isLand ? rand(-5, -0.5) : rand(-12, 5),
          life: isIcon ? rand(30, 58) : isLand ? rand(12, 22) : rand(18, 38),
          maxLife: isIcon ? 58 : isLand ? 22 : 38,
          color: type === 'special' ? (Math.random() > 0.5 ? '#fffae0' : color) : isLand ? '#d1dcde' : color,
          size: isLand ? rand(4, 11) : rand(2.5, 7.5),
          length: isLand ? 0 : rand(10, 32),
          icon: chosenIcon,
          isLand
        });
      }
    }
  }

  function update() {
    if (!match || match.paused || match.ended) return;
    if (match.hitStop > 0) { match.hitStop--; return; }

    match.frames++;
    if (match.state === 'intro') {
      match.intro--;
      if (match.intro === 72) announce('FIGHT!', 800);
      if (match.intro <= 35) match.state = 'fight';
    } else {
      match.p1.update(match.p2);
      match.p2.update(match.p1);
      if (match.frames % 60 === 0) match.timer--;
      if (match.p1.health <= 0 || match.p2.health <= 0 || match.timer <= 0) endMatch();
    }

    match.particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += 0.38; p.life--; });
    match.particles = match.particles.filter(p => p.life > 0);
    match.impacts.forEach(impact => impact.life--);
    match.impacts = match.impacts.filter(impact => impact.life > 0);

    stageFog.forEach(f => {
      f.x += f.vx;
      if (f.x > 1060) f.x = -100;
    });

    if (match.shake > 0) match.shake *= 0.78;
    if (match.zoomPulse > 0) match.zoomPulse *= 0.74;
    if (match.flash > 0) match.flash--;
    if (match.frames % 20 === 0) updateCoach();
    updateHud();
  }

  function updateCoach() {
    if (!match || match.state === 'intro') return;
    const player = match.p1;
    const distance = Math.abs(match.p2.x - player.x);
    const mobile = window.matchMedia('(max-width: 720px)').matches;
    let tip;
    if (player.meter >= 100) tip = mobile ? '★ ESPECIAL PRONTO! Toque no botão rosa com estrela.' : '★ ESPECIAL PRONTO! Aperte R ou Espaço agora.';
    else if (player.health < 35) tip = mobile ? 'Segure ↓ para defender e reduzir o dano.' : 'Segure S ou ↓ para defender e reduzir bastante o dano.';
    else if (distance > 150) tip = mobile ? 'Chegue perto usando as setas ← e →.' : 'Chegue perto: use A/D ou as Setas ← →.';
    else if (match.frames < 650) tip = mobile ? 'Ataque agora: toque em P ou K.' : 'Ataque agora: Q dá Soco e E dá Chute.';
    else if (player.meter > 72) tip = mobile ? 'A barra amarela está quase cheia. Prepare o ★.' : 'Sua barra amarela está quase cheia. Prepare o R.';
    else {
      const tips = mobile ? [
        'Alterne P e K para encaixar combos.',
        'Use ↑ para pular por cima dos ataques.',
        'Segure ↓ quando o rival começar a atacar.',
        'Golpes acertados carregam seu especial rapidamente.'
      ] : [
        'Alterne Q e E para encaixar combos.',
        'W ou ↑ pula por cima dos ataques.',
        'Segure S ou ↓ quando o rival começar a atacar.',
        'Golpes acertados carregam seu especial rapidamente.'
      ];
      tip = tips[Math.floor(match.frames / 240) % tips.length];
    }
    $('#coach-text').textContent = tip;
  }

  function updateHud() {
    $('#p1-health').style.transform = `scaleX(${match.p1.health / 100})`;
    $('#p2-health').style.transform = `scaleX(${match.p2.health / 100})`;
    $('#p1-meter').style.width = `${match.p1.meter}%`;
    $('#p2-meter').style.width = `${match.p2.meter}%`;
    $('#p1-ready').classList.toggle('is-ready', match.p1.meter >= 100);
    $('#p2-ready').classList.toggle('is-ready', match.p2.meter >= 100);
    $('#p1-ready').textContent = match.p1.meter >= 100 ? 'PRONTO!' : 'CARREGANDO';
    $('#p2-ready').textContent = match.p2.meter >= 100 ? 'PRONTO!' : 'CARREGANDO';
    $('#timer').textContent = String(Math.max(0, match.timer)).padStart(2, '0');
  }

  function loop(timestamp = 0) {
    if (!lastFrameTime) lastFrameTime = timestamp;
    const elapsed = Math.min(50, timestamp - lastFrameTime);
    lastFrameTime = timestamp;
    accumulator += elapsed;
    while (accumulator >= fixedStep) {
      update();
      accumulator -= fixedStep;
    }
    draw();
    if (match && !match.ended && !match.paused) raf = requestAnimationFrame(loop);
  }

  // --- RENDERING PIPELINE ---
  function draw() {
    if (!match) return;

    resizeCanvas();
    const canvasW = gameCanvas.width;
    const canvasH = gameCanvas.height;

    ctx.save();
    ctx.scale(canvasW / 960, canvasH / 540);

    const renderState = p => p.blocking ? 'block' : p.attack?.type || (p.stun > 0 ? 'hit' : !p.grounded ? 'jump' : Math.abs(p.vx) > 0.55 ? 'walk' : 'idle');
    const motionData = p => ({ vx: p.vx, vy: p.vy, animFrame: p.animFrame, landSquash: p.landSquash });

    const targetCamX = (match.p1.x + match.p2.x) / 2;
    match.camX += (targetCamX - match.camX) * 0.08;
    const dist = Math.abs(match.p1.x - match.p2.x);
    const targetZoom = clamp(960 / (dist + 380), 1.0, 1.14);
    match.camZoom += (targetZoom - match.camZoom) * 0.08;

    const shakeX = match.shake ? rand(-match.shake, match.shake) : 0;
    const shakeY = match.shake ? rand(-match.shake * 0.5, match.shake * 0.5) : 0;
    ctx.translate(shakeX, shakeY);

    if (match.zoomPulse || match.camZoom > 1.0) {
      const totalZoom = match.camZoom + match.zoomPulse;
      ctx.translate(480, 270);
      ctx.scale(totalZoom, totalZoom);
      ctx.translate(-match.camX, -270);
    } else {
      ctx.translate(480 - match.camX, 0);
    }

    // 1. Draw Selected Stage
    drawStage(ctx, match.frames);

    // 2. Glossy Stage Floor Reflections (100% Transparent Sprites)
    ctx.save();
    ctx.scale(1, -1);
    ctx.translate(0, -850);
    ctx.globalAlpha = 0.24;
    drawTransparentSprite(ctx, match.p1.data, match.p1.x, match.p1.y, match.p1.facing, renderState(match.p1), match.p1.attackTimer, 1, 0, motionData(match.p1));
    drawTransparentSprite(ctx, match.p2.data, match.p2.x, match.p2.y, match.p2.facing, renderState(match.p2), match.p2.attackTimer, 1, 0, motionData(match.p2));
    ctx.restore();

    // 3. Draw Fighter After-images & Main 100% Transparent Sprites
    match.p1.afterimages.forEach(a => drawTransparentSprite(ctx, match.p1.data, a.x, a.y, match.p1.facing, match.p1.attack?.type || 'idle', match.p1.attackTimer, 0.18 * a.life / 24, 0));
    match.p2.afterimages.forEach(a => drawTransparentSprite(ctx, match.p2.data, a.x, a.y, match.p2.facing, match.p2.attack?.type || 'idle', match.p2.attackTimer, 0.18 * a.life / 24, 0));

    drawTransparentSprite(ctx, match.p1.data, match.p1.x, match.p1.y, match.p1.facing, renderState(match.p1), match.p1.attackTimer, 1, match.p1.hitFlash, motionData(match.p1));
    drawTransparentSprite(ctx, match.p2.data, match.p2.x, match.p2.y, match.p2.facing, renderState(match.p2), match.p2.attackTimer, 1, match.p2.hitFlash, motionData(match.p2));

    // 4. Draw Particle Effects, Combos & Text Impacts
    drawEffects();

    ctx.restore();

    if (match.flash) {
      ctx.fillStyle = `rgba(255,255,255,${match.flash / 9})`;
      ctx.fillRect(0, 0, canvasW, canvasH);
    }
  }

  // --- STAGE RENDERER REALISTA COM SPRITES TRANSPARENTES (WOODSTOCK '69, STADIUM, UNDERGROUND CLUB) ---
  function drawStage(c, frame) {
    if (currentStage === 'woodstock') {
      // ☮️ CENÁRIO 1: WOODSTOCK '69 - OPEN-AIR FESTIVAL SUNSET
      const bg = c.createLinearGradient(0, -50, 0, 540);
      bg.addColorStop(0, '#100726');
      bg.addColorStop(0.35, '#381442');
      bg.addColorStop(0.7, '#8f2440');
      bg.addColorStop(1, '#f27838');
      c.fillStyle = bg;
      c.fillRect(-200, -50, 1360, 600);

      c.save();
      const sunG = c.createRadialGradient(480, 350, 20, 480, 350, 220);
      sunG.addColorStop(0, '#fff3bc');
      sunG.addColorStop(0.25, '#ffae3d');
      sunG.addColorStop(0.6, 'rgba(242, 100, 48, 0.45)');
      sunG.addColorStop(1, 'transparent');
      c.fillStyle = sunG;
      c.beginPath(); c.arc(480, 350, 220, 0, Math.PI * 2); c.fill();
      c.restore();

      c.fillStyle = '#220e2e';
      c.beginPath();
      c.moveTo(-100, 420);
      c.lineTo(-100, 360);
      c.bezierCurveTo(100, 330, 250, 380, 450, 365);
      c.bezierCurveTo(680, 345, 820, 380, 1060, 355);
      c.lineTo(1060, 420); c.closePath(); c.fill();

      c.fillStyle = '#14071c';
      c.beginPath();
      for (let i = -60; i < 1040; i += 18) {
        const headY = 382 + Math.sin(i * 0.18 + frame * 0.05) * 6 + Math.cos(i * 0.09) * 4;
        c.arc(i, headY, 12, Math.PI, 0);
        c.fillRect(i - 12, headY, 24, 40);
      }
      c.fill();

      crowdLights.forEach(light => {
        light.phase += light.speed;
        const alpha = 0.35 + Math.sin(light.phase) * 0.35;
        c.save();
        c.globalAlpha = alpha;
        c.fillStyle = '#ffcc54';
        c.shadowColor = '#ffb324';
        c.shadowBlur = 10;
        c.beginPath();
        c.arc(light.x, light.y - 8 + Math.sin(light.phase * 0.5) * 5, light.size * 1.3, 0, Math.PI * 2);
        c.fill();
        c.restore();
      });

      c.save();
      c.globalCompositeOperation = 'screen';
      for (let i = 0; i < 5; i++) {
        const baseX = 120 + i * 190;
        const sweep = Math.sin(frame * 0.02 + i * 1.3) * 75;
        const spotG = c.createLinearGradient(baseX, 20, baseX + sweep, 440);
        spotG.addColorStop(0, 'rgba(255, 215, 135, 0.28)');
        spotG.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = spotG;
        c.beginPath();
        c.moveTo(baseX - 16, 20); c.lineTo(baseX + sweep - 85, 440); c.lineTo(baseX + sweep + 85, 440); c.lineTo(baseX + 16, 20);
        c.closePath(); c.fill();
      }
      c.restore();

      if (stageSprites.woodstockDrumKit) {
        c.drawImage(stageSprites.woodstockDrumKit, 340, 235);
      }
      if (stageSprites.marshallStack) {
        c.drawImage(stageSprites.marshallStack, 170, 195);
        c.drawImage(stageSprites.marshallStack, 650, 195);
      }
      if (stageSprites.woodstockRigLeft) {
        c.drawImage(stageSprites.woodstockRigLeft, -30, 20);
      }
      if (stageSprites.woodstockRigRight) {
        c.drawImage(stageSprites.woodstockRigRight, 770, 20);
      }

      const floorG = c.createLinearGradient(0, 420, 0, 540);
      floorG.addColorStop(0, '#422416');
      floorG.addColorStop(0.2, '#2b160c');
      floorG.addColorStop(1, '#0e0603');
      c.fillStyle = floorG;
      c.fillRect(-200, 420, 1360, 120);

      c.strokeStyle = 'rgba(235, 150, 80, 0.22)';
      c.lineWidth = 1;
      for (let y = 432; y < 540; y += 16) {
        c.beginPath(); c.moveTo(-100, y); c.lineTo(1060, y); c.stroke();
      }
      for (let x = -100; x <= 1060; x += 90) {
        c.beginPath(); c.moveTo(480, 420); c.lineTo(x, 540); c.stroke();
      }
      c.strokeStyle = '#ffae3d';
      c.lineWidth = 3;
      c.shadowColor = '#ffae3d';
      c.shadowBlur = 14;
      c.beginPath(); c.moveTo(-100, 420); c.lineTo(1060, 420); c.stroke();
      c.shadowBlur = 0;

      c.save();
      stageFog.forEach(fog => {
        c.fillStyle = `rgba(255, 185, 125, ${fog.alpha * 1.2})`;
        c.beginPath(); c.arc(fog.x, fog.y, fog.radius, 0, Math.PI * 2); c.fill();
      });
      c.restore();
      return;
    }

    if (currentStage === 'club') {
      // 🎸 CENÁRIO 2: UNDERGROUND ROCK CLUB
      const bg = c.createLinearGradient(0, -50, 0, 540);
      bg.addColorStop(0, '#0d0408');
      bg.addColorStop(0.5, '#240813');
      bg.addColorStop(1, '#080205');
      c.fillStyle = bg;
      c.fillRect(-200, -50, 1360, 600);

      c.strokeStyle = 'rgba(75, 25, 35, 0.4)';
      c.lineWidth = 2;
      for (let y = 30; y < 420; y += 22) {
        c.beginPath(); c.moveTo(-100, y); c.lineTo(1060, y); c.stroke();
        const offset = Math.floor(y / 22) % 2 === 0 ? 0 : 25;
        for (let x = -100 + offset; x < 1060; x += 50) {
          c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 22); c.stroke();
        }
      }

      const curtainG1 = c.createLinearGradient(-100, 0, 120, 0);
      curtainG1.addColorStop(0, '#590a18'); curtainG1.addColorStop(1, 'transparent');
      c.fillStyle = curtainG1; c.fillRect(-100, 0, 220, 420);

      const curtainG2 = c.createLinearGradient(1060, 0, 840, 0);
      curtainG2.addColorStop(0, '#590a18'); curtainG2.addColorStop(1, 'transparent');
      c.fillStyle = curtainG2; c.fillRect(840, 0, 220, 420);

      c.save();
      c.font = 'italic 900 36px "Barlow Condensed"';
      c.textAlign = 'center';
      c.shadowColor = '#ff2e78';
      c.shadowBlur = 18 + Math.sin(frame * 0.1) * 8;
      c.fillStyle = '#ff2e78';
      c.fillText('⚡ UNDERGROUND ROCK CLUB ⚡', 480, 100);
      c.restore();

      c.save();
      c.globalCompositeOperation = 'screen';
      for (let i = 0; i < 4; i++) {
        const baseX = 140 + i * 230;
        const sweep = Math.sin(frame * 0.02 + i * 1.5) * 80;
        const spotG = c.createLinearGradient(baseX, 30, baseX + sweep, 425);
        spotG.addColorStop(0, 'rgba(255, 196, 77, 0.32)');
        spotG.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = spotG;
        c.beginPath();
        c.moveTo(baseX - 12, 30);
        c.lineTo(baseX + sweep - 80, 425);
        c.lineTo(baseX + sweep + 80, 425);
        c.lineTo(baseX + 12, 30);
        c.closePath();
        c.fill();
      }
      c.restore();

      if (stageSprites.woodstockDrumKit) {
        c.drawImage(stageSprites.woodstockDrumKit, 350, 238);
      }
      if (stageSprites.clubTubeAmp) {
        c.drawImage(stageSprites.clubTubeAmp, 140, 260);
        c.drawImage(stageSprites.clubTubeAmp, 680, 260);
      }
      if (stageSprites.marshallStack) {
        c.drawImage(stageSprites.marshallStack, -10, 190);
        c.drawImage(stageSprites.marshallStack, 820, 190);
      }

      const floorG = c.createLinearGradient(0, 420, 0, 540);
      floorG.addColorStop(0, '#36141a');
      floorG.addColorStop(0.2, '#1b090d');
      floorG.addColorStop(1, '#070204');
      c.fillStyle = floorG;
      c.fillRect(-200, 420, 1360, 120);

      c.strokeStyle = 'rgba(255, 196, 77, 0.18)';
      c.lineWidth = 1;
      for (let y = 435; y < 540; y += 18) {
        c.beginPath(); c.moveTo(-100, y); c.lineTo(1060, y); c.stroke();
      }
      return;
    }

    // 🏟️ CENÁRIO 3: STADIUM ARENA
    const bg = c.createLinearGradient(0, -50, 0, 540);
    bg.addColorStop(0, '#06040d');
    bg.addColorStop(0.45, '#1b0826');
    bg.addColorStop(0.8, '#0b0612');
    c.fillStyle = bg;
    c.fillRect(-200, -50, 1360, 600);

    c.save();
    c.globalAlpha = 0.18;
    for (let x = -50; x < 1010; x += 28) {
      const eqHeight = 80 + Math.sin(x * 0.05 + frame * 0.1) * 60 + Math.cos(x * 0.1) * 30;
      const ledG = c.createLinearGradient(0, 200 - eqHeight, 0, 200);
      ledG.addColorStop(0, '#ff2e78');
      ledG.addColorStop(1, '#23d7ef');
      c.fillStyle = ledG;
      c.fillRect(x, 220 - eqHeight, 22, eqHeight);
    }
    c.restore();

    c.strokeStyle = '#271b33';
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(-100, 30); c.lineTo(1060, 30);
    c.moveTo(-100, 55); c.lineTo(1060, 55);
    for (let x = -80; x < 1060; x += 40) {
      c.moveTo(x, 30); c.lineTo(x + 20, 55);
      c.moveTo(x + 20, 30); c.lineTo(x, 55);
    }
    c.stroke();

    c.save();
    c.globalCompositeOperation = 'screen';
    for (let i = 0; i < 6; i++) {
      const baseX = 60 + i * 160;
      const sweep = Math.sin(frame * 0.03 + i * 1.2) * 110;
      const spotG = c.createLinearGradient(baseX, 30, baseX + sweep, 425);
      const color = i % 3 === 0 ? 'rgba(35, 215, 239, 0.28)' : i % 3 === 1 ? 'rgba(255, 46, 120, 0.28)' : 'rgba(255, 196, 77, 0.24)';
      spotG.addColorStop(0, color);
      spotG.addColorStop(1, 'rgba(0,0,0,0)');

      c.fillStyle = spotG;
      c.beginPath();
      c.moveTo(baseX - 15, 30);
      c.lineTo(baseX + sweep - 90, 425);
      c.lineTo(baseX + sweep + 90, 425);
      c.lineTo(baseX + 15, 30);
      c.closePath();
      c.fill();
    }
    c.restore();

    if (stageSprites.woodstockDrumKit) {
      c.drawImage(stageSprites.woodstockDrumKit, 340, 232);
    }
    if (stageSprites.marshallStack) {
      [-20, 75, 170].forEach((ax, idx) => {
        c.drawImage(stageSprites.marshallStack, ax, 190 + (idx % 2) * 12);
      });
      [650, 745, 840].forEach((ax, idx) => {
        c.drawImage(stageSprites.marshallStack, ax, 190 + (idx % 2) * 12);
      });
    }

    c.fillStyle = '#050308';
    c.beginPath();
    for (let i = -50; i < 1010; i += 22) {
      const armY = 385 + Math.sin(i * 0.15 + frame * 0.08) * 8;
      c.arc(i, armY, 14, Math.PI, 0);
      c.fillRect(i - 14, armY, 28, 45);
    }
    c.fill();

    crowdLights.forEach(light => {
      light.phase += light.speed;
      const alpha = 0.4 + Math.sin(light.phase) * 0.4;
      c.save();
      c.globalAlpha = alpha;
      c.fillStyle = light.color;
      c.shadowColor = light.color;
      c.shadowBlur = 8;
      c.beginPath();
      c.arc(light.x, light.y + Math.sin(light.phase * 0.5) * 4, light.size, 0, Math.PI * 2);
      c.fill();
      c.restore();
    });

    const floorG = c.createLinearGradient(0, 420, 0, 540);
    floorG.addColorStop(0, '#2b1035');
    floorG.addColorStop(0.15, '#170921');
    floorG.addColorStop(1, '#07040a');
    c.fillStyle = floorG;
    c.fillRect(-200, 420, 1360, 120);

    c.strokeStyle = 'rgba(255, 46, 120, 0.15)';
    c.lineWidth = 1;
    for (let y = 435; y < 540; y += 18) {
      c.beginPath(); c.moveTo(-100, y); c.lineTo(1060, y); c.stroke();
    }
    for (let x = -100; x <= 1060; x += 80) {
      c.beginPath(); c.moveTo(480, 420); c.lineTo(x, 540); c.stroke();
    }

    c.strokeStyle = '#36dff1';
    c.lineWidth = 3;
    c.shadowColor = '#36dff1';
    c.shadowBlur = 12;
    c.beginPath();
    c.moveTo(-100, 420); c.lineTo(1060, 420);
    c.stroke();
    c.shadowBlur = 0;

    c.save();
    stageFog.forEach(fog => {
      c.fillStyle = `rgba(220, 180, 240, ${fog.alpha})`;
      c.beginPath();
      c.arc(fog.x, fog.y, fog.radius, 0, Math.PI * 2);
      c.fill();
    });
    c.restore();
  }

  // --- DYNAMIC STEP-BY-STEP REALISTIC FIGHTER RENDERER ---
  function drawTransparentSprite(c, f, x, ground, facing = 1, state = 'idle', timer = 0, alpha = 1, flash = 0, motionData = null) {
    c.save();
    c.globalAlpha = alpha;
    c.translate(x, ground);
    c.scale(facing, 1);

    const frame = motionData?.animFrame || 0;
    const vx = motionData?.vx || 0;
    const squash = motionData?.landSquash ? Math.sin((motionData.landSquash / 8) * Math.PI) * 0.08 : 0;

    // --- STREETS OF RAGE REALISTIC WALKING & STRIDE ENGINE ---
    let walkBob = 0;
    let walkTilt = 0;
    let walkStrideX = 0;
    let stepFrame = 0;
    if (state === 'walk') {
      const isForward = (vx * facing) > 0;
      stepFrame = Math.floor((x / 18) + frame * 0.25) % 4;
      if (stepFrame < 0) stepFrame += 4;

      // Authentic beat-'em-up vertical bob and weight transfer
      const stepPhase = Math.sin(frame * 0.48);
      walkBob = Math.abs(Math.cos(frame * 0.48)) * 9;
      walkStrideX = stepPhase * 5;
      walkTilt = isForward ? (0.05 + stepPhase * 0.02) : (-0.03 + stepPhase * 0.015);

      // Grounded footstep dust clouds on impact
      if (Math.abs(stepPhase) < 0.28 && alpha === 1) {
        c.save();
        c.fillStyle = 'rgba(190, 210, 230, 0.32)';
        c.beginPath();
        c.ellipse(-8 + walkStrideX, 4, 16 + Math.abs(vx) * 3, 5, 0, 0, Math.PI * 2);
        c.fill();
        c.restore();
      }
    }

    const idleBounce = state === 'idle' ? Math.sin(frame * 0.12) * 3.2 : 0;
    const crouchShift = state === 'block' ? 16 : 0;

    c.translate(walkStrideX, idleBounce - walkBob);
    c.rotate(walkTilt);
    c.scale(1 + squash, 1 - squash);

    if (flash) { c.shadowColor = '#ffffff'; c.shadowBlur = 38; }
    
    // Step-by-step Hit Stagger & Knockback
    if (state === 'hit') {
      const hitShake = Math.sin(frame * 2.2) * 9;
      c.translate(-16 + hitShake, -6);
      c.rotate(-0.15);
    }

    // --- STEP-BY-STEP FIGHTING CHOREOGRAPHY (WINDUP -> STRIKE -> RECOVERY) ---
    const attackDuration = state === 'punch' ? 18 : state === 'kick' ? 25 : state === 'special' ? 55 : 1;
    const phase = timer ? clamp(1 - timer / attackDuration, 0, 1) : 0;
    
    let lungeX = 0;
    let lungeY = 0;
    let attackRot = 0;
    let isWindup = false;
    let isStrike = false;

    if (state === 'punch' || state === 'kick' || state === 'special') {
      const maxLunge = state === 'punch' ? 65 : state === 'kick' ? 85 : 115;
      
      if (phase < 0.22) {
        // Step 1: WINDUP & ANTECIPACAO (Pull back before launching)
        isWindup = true;
        const p = phase / 0.22;
        lungeX = -16 * Math.pow(p, 2);
        lungeY = 6 * p;
        attackRot = -0.09 * p;
      } else if (phase < 0.65) {
        // Step 2: APICE & IMPACTO (Explosive burst forward)
        isStrike = true;
        const p = (phase - 0.22) / 0.43;
        const easeOut = 1 - Math.pow(1 - p, 3);
        lungeX = maxLunge * easeOut;
        lungeY = -12 * easeOut;
        attackRot = (state === 'kick' ? -0.15 : -0.08) * easeOut;
      } else {
        // Step 3: RECUPERACAO PASSO A PASSO (Return and re-balance)
        const p = (phase - 0.65) / 0.35;
        const easeIn = Math.cos(p * Math.PI * 0.5);
        lungeX = maxLunge * 0.85 * easeIn;
        lungeY = Math.sin(p * Math.PI) * -6;
        attackRot = (state === 'kick' ? -0.15 : -0.08) * easeIn;
      }
    }

    // Dynamic Realistic Ground Shadow (remains glued to stage floor even during high leaps!)
    const heightAboveGround = Math.max(0, 425 - ground);
    const shadowAlpha = clamp(0.68 - (heightAboveGround * 0.0035), 0.15, 0.68);
    const shadowScaleX = clamp(58 - (heightAboveGround * 0.15) + Math.abs(lungeX) * 0.35 + Math.abs(walkStrideX) * 1.4, 18, 90);
    const shadowScaleY = clamp(13 - (heightAboveGround * 0.04), 4, 13);

    c.save();
    c.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
    c.beginPath();
    c.ellipse(lungeX * 0.4, 4 + walkBob * 0.2 + heightAboveGround, shadowScaleX, shadowScaleY, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();

    // SELECT TRANSPARENT REALISTIC SPRITE POSE (Ou recortes sequenciais automáticos da Master Sprite Sheet Nano Banana!)
    let poseKey = `${f.id}_idle`;
    if (state === 'punch') {
      const pFrame = Math.min(2, Math.floor((18 - Math.max(0, attackTimer)) / 6));
      poseKey = spriteCanvases[`${f.id}_punch_f${pFrame}`] ? `${f.id}_punch_f${pFrame}` : `${f.id}_punch`;
    } else if (state === 'kick') {
      const kFrame = Math.min(2, Math.floor((25 - Math.max(0, attackTimer)) / 8));
      poseKey = spriteCanvases[`${f.id}_kick_f${kFrame}`] ? `${f.id}_kick_f${kFrame}` : `${f.id}_kick`;
    } else if (state === 'special') {
      const sFrame = Math.min(3, Math.floor((55 - Math.max(0, attackTimer)) / 14));
      poseKey = spriteCanvases[`${f.id}_special_f${sFrame}`] ? `${f.id}_special_f${sFrame}` : `${f.id}_special`;
    } else if (state === 'block') {
      poseKey = `${f.id}_block`;
    } else if (state === 'hit') {
      const hFrame = Math.min(1, Math.floor(Math.max(0, 16 - f.stun) / 8));
      poseKey = spriteCanvases[`${f.id}_hit_f${hFrame}`] ? `${f.id}_hit_f${hFrame}` : `${f.id}_hit`;
    } else if (state === 'jump' || heightAboveGround > 5) {
      poseKey = `${f.id}_jump`;
    } else if (state === 'walk') {
      const wFrame = Math.floor((match.frames / 8) % 4);
      if (spriteCanvases[`${f.id}_walk_f${wFrame}`]) {
        poseKey = `${f.id}_walk_f${wFrame}`;
      } else if (stepFrame === 0 || stepFrame === 1) {
        poseKey = `${f.id}_walk1`;
      } else {
        poseKey = `${f.id}_walk2`;
      }
    } else if (state === 'idle') {
      // Loop em ping-pong estilo Mega Drive (0 -> 1 -> 2 -> 1) se houver sprite sheet
      const idleIdx = [0, 1, 2, 1][Math.floor((match.frames / 16) % 4)];
      if (spriteCanvases[`${f.id}_idle_f${idleIdx}`]) {
        poseKey = `${f.id}_idle_f${idleIdx}`;
      }
    }

    const poseCanvas = spriteCanvases[poseKey] || spriteCanvases[`${f.id}_idle`];

    c.save();
    if (state === 'punch' || state === 'kick' || state === 'special') {
      c.translate(lungeX, lungeY);
      c.rotate(attackRot);
    } else if (state === 'block') {
      c.translate(-12, crouchShift * 0.5);
      c.rotate(-0.06); // Defensive shield posture
      if (alpha === 1) { c.shadowColor = '#23d7ef'; c.shadowBlur = 28; }
    } else if (state === 'jump' || heightAboveGround > 5) {
      if (alpha === 1 && Math.random() > 0.4) {
        c.save();
        c.globalCompositeOperation = 'screen';
        c.strokeStyle = 'rgba(200, 240, 255, 0.45)'; c.lineWidth = 2.5;
        c.beginPath();
        c.moveTo(-20, 15); c.lineTo(-35, 45 + Math.random() * 10);
        c.moveTo(25, 12); c.lineTo(40, 42 + Math.random() * 10);
        c.stroke();
        c.restore();
      }
    } else if (state === 'idle') {
      // Estilo Mega Drive / Streets of Rage 2: Ping-Pong Breathing Loop & Combat Bounce!
      const pingPong = Math.floor((match.frames / 10) % 4);
      const breathScaleY = pingPong === 0 ? 1.0 : (pingPong === 1 || pingPong === 3) ? 1.02 : 1.035;
      const breathShiftY = pingPong === 0 ? 0 : (pingPong === 1 || pingPong === 3) ? -1.8 : -3.6;
      const stanceTilt = (pingPong === 1 ? 0.015 : pingPong === 3 ? -0.015 : 0);
      c.translate(0, breathShiftY);
      c.scale(1.0, breathScaleY);
      c.rotate(stanceTilt);
    }

    if (poseCanvas) {
      const sprW = 180;
      const sprH = 235;
      c.drawImage(poseCanvas, -sprW / 2, -sprH + 14, sprW, sprH);

      // Windup Energy Charge Flare (Step 1 Visual Feedback)
      if (isWindup && alpha === 1) {
        c.save();
        c.globalCompositeOperation = 'screen';
        c.fillStyle = '#ffffff';
        c.shadowColor = f.color; c.shadowBlur = 25;
        c.beginPath();
        c.arc(35, -130, 14 + Math.random() * 8, 0, Math.PI * 2);
        c.fill();
        c.restore();
      }

      // Character Rim Light Highlight
      c.save();
      c.globalCompositeOperation = 'screen';
      c.fillStyle = f.color;
      c.globalAlpha = 0.24;
      c.fillRect(-sprW / 2, -sprH + 14, sprW, sprH);
      c.restore();
    }
    c.restore();

    // SIGNATURE SPECIAL POWER VISUAL EFFECTS (KURT, AXL, LENNON - Step 2 Active Impact)
    if (f.id === 'kurt' && state === 'special' && phase >= 0.22) {
      // Kurt: GUITARRADA SMASH! Explosive Fender Mustang Guitar Lightning Strike
      c.save(); c.globalCompositeOperation = 'screen';
      c.translate(lungeX * 0.6, lungeY);
      c.strokeStyle = '#23d7ef'; c.lineWidth = 12; c.shadowColor = '#23d7ef'; c.shadowBlur = 36;
      c.beginPath();
      for (let i = 0; i < 8; i++) {
        const ang = i * Math.PI / 4 + match.frames * 0.25;
        c.moveTo(0, -95);
        c.lineTo(Math.cos(ang) * 210, -95 + Math.sin(ang) * 165);
      }
      c.stroke();
      c.strokeStyle = '#ffc44d'; c.lineWidth = 6; c.stroke();
      c.restore();
    }
    else if (f.id === 'axl' && state === 'special' && phase >= 0.22) {
      // Axl: SERPENT MIC-STAND SCREAM! Roaring Flaming Fire Dragon Waves
      c.save(); c.globalCompositeOperation = 'screen';
      c.translate(lungeX * 0.5, lungeY);
      c.strokeStyle = '#ff2e78'; c.lineWidth = 15; c.shadowColor = '#ff2e78'; c.shadowBlur = 38;
      c.beginPath();
      for (let i = 0; i < 6; i++) {
        c.moveTo(15, -100);
        c.quadraticCurveTo(85 + i * 38, -145 + Math.sin(i * 1.5 + match.frames * 0.45) * 50, 195 + i * 42, -100);
      }
      c.stroke();
      c.strokeStyle = '#ffc44d'; c.lineWidth = 7; c.stroke();
      c.restore();
    }
    else if (f.id === 'lennon' && state === 'special' && phase >= 0.22) {
      // Lennon: PEACE & LOVE PULSE! Expanding Emerald Peace Sign Barrier
      c.save(); c.globalCompositeOperation = 'screen';
      c.translate(lungeX * 0.5, lungeY);
      c.strokeStyle = '#6acfa0'; c.lineWidth = 14; c.shadowColor = '#6acfa0'; c.shadowBlur = 40;
      c.beginPath();
      const r = 95 + Math.sin(phase * 14) * 40;
      c.arc(0, -110, r, 0, Math.PI * 2);
      c.moveTo(0, -110 - r); c.lineTo(0, -110 + r);
      c.moveTo(0, -110); c.lineTo(-r * 0.72, -110 + r * 0.72);
      c.moveTo(0, -110); c.lineTo(r * 0.72, -110 + r * 0.72);
      c.stroke();
      c.restore();
    }

    // Step-by-Step Strike Trails & Kinetic Impact Shockwaves (Step 2 Active)
    if ((state === 'punch' || state === 'special') && isStrike) {
      c.save(); c.globalCompositeOperation = 'screen';
      c.globalAlpha = 0.82; c.strokeStyle = f.color; c.lineWidth = 9;
      c.shadowColor = f.color; c.shadowBlur = 25;
      for (let i = 0; i < 4; i++) {
        c.beginPath(); c.moveTo(25 + lungeX * 0.5 - i * 14, -115 + i * 11); c.lineTo(95 + lungeX, -105 + i * 6); c.stroke();
      }
      c.restore();
    }

    if (state === 'kick' && isStrike) {
      c.save(); c.globalCompositeOperation = 'screen';
      c.globalAlpha = 0.85; c.strokeStyle = f.color; c.lineWidth = 10;
      c.shadowColor = f.color; c.shadowBlur = 25;
      for (let i = 0; i < 5; i++) {
        c.beginPath();
        c.moveTo(15 - i * 11, -55 + i * 13);
        c.quadraticCurveTo(65 + lungeX * 0.6, -85 + i * 5, 118 + lungeX, -115 + i * 9);
        c.stroke();
      }
      c.restore();
    }

    c.restore();
  }

  function announce(text, duration = 800) {
    const el = $('#announcer'); el.textContent = text; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    sound('announce');
    setTimeout(() => el.classList.remove('show'), duration);
  }

  function drawEffects() {
    const players = [match.p1, match.p2];
    players.forEach(p => {
      if (p.attack?.type === 'special' && p.attackTimer > 8) {
        const life = p.attackTimer / 55;
        ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.8 * life;
        const x = p.x + p.facing * 85; const y = p.y - 85;
        ctx.strokeStyle = p.data.color; ctx.lineWidth = 14; ctx.shadowColor = p.data.color; ctx.shadowBlur = 34;
        ctx.beginPath();
        for (let r = 20; r < 180; r += 32) { ctx.arc(x, y, r, 0, Math.PI * 2); }
        ctx.stroke(); ctx.restore();
      }

      if (p.combo > 1 && p.comboTimer > 0) {
        ctx.save();
        ctx.fillStyle = p.data.color;
        ctx.font = 'italic 900 38px "Barlow Condensed"';
        ctx.textAlign = 'center';
        ctx.shadowColor = p.data.color;
        ctx.shadowBlur = 12;
        ctx.fillText(`${p.combo} HIT COMBO!`, p.x, p.y - 185);
        ctx.restore();
      }
    });

    match.particles.forEach(p => {
      ctx.save();
      const maxL = p.maxLife || 38;
      ctx.globalAlpha = clamp(p.life / maxL, 0, 1);
      if (p.icon) {
        ctx.font = 'bold 30px sans-serif';
        ctx.fillStyle = p.color || '#fff';
        ctx.shadowColor = p.color || '#ffcc00'; ctx.shadowBlur = 14;
        ctx.fillText(p.icon, p.x, p.y);
      } else if (p.isLand) {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.strokeStyle = p.color; ctx.lineWidth = p.size; ctx.lineCap = 'round';
        ctx.shadowColor = p.color; ctx.shadowBlur = 10;
        const mag = Math.hypot(p.vx, p.vy) || 1;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - (p.vx / mag) * p.length, p.y - (p.vy / mag) * p.length); ctx.stroke();
      }
      ctx.restore();
    });

    match.impacts.forEach(impact => {
      const progress = impact.life / 38;
      ctx.save();
      ctx.translate(impact.x, impact.y);
      ctx.rotate(-0.09);
      ctx.scale(1 + (1 - progress) * 0.28, 1 + (1 - progress) * 0.28);
      ctx.font = 'italic 900 42px "Barlow Condensed"';
      ctx.textAlign = 'center';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 9;
      ctx.strokeStyle = '#0a040b';
      ctx.strokeText(impact.text, 0, 0);
      ctx.fillStyle = impact.color;
      ctx.shadowColor = impact.color;
      ctx.shadowBlur = 14;
      ctx.fillText(impact.text, 0, 0);
      ctx.restore();
    });
  }

  function endMatch() {
    if (match.ended) return;
    match.ended = true;
    const winner = match.p1.health === match.p2.health ? match.p1 : (match.p1.health > match.p2.health ? match.p1 : match.p2);
    announce('K.O.!', 1000);
    sound('special', 0.45);
    sound('crowd');
    setTimeout(() => {
      $('#result-kicker').textContent = match.timer <= 0 ? 'TIME OVER' : 'KNOCKOUT';
      $('#result-title').innerHTML = `${winner.data.short} <em>VENCEU!</em>`;
      $('#result-quote').textContent = `“${winner.data.quote}”`;
      const portrait = $('#winner-portrait'); portrait.innerHTML = '';
      portrait.style.setProperty('--portrait-image', `url("assets/${winner.data.portrait}")`);
      showScreen('result-screen');
    }, 1000);
  }

  // --- INPUT CONTROLS ---
  document.addEventListener('keydown', e => {
    const gameKeys = ['KeyA', 'KeyD', 'KeyW', 'KeyS', 'KeyQ', 'KeyE', 'KeyR', 'Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL'];
    if (gameKeys.includes(e.code)) {
      e.preventDefault();
      if (!keys[e.code]) keys[e.code] = 1;
    }
    if (e.code === 'Escape' && !$('#how-modal').hidden) closeHow();
    else if (e.code === 'Escape' && match && !match.ended) togglePause();
  });

  document.addEventListener('keyup', e => { keys[e.code] = 0; });

  document.querySelectorAll('[data-touch]').forEach(btn => {
    const map = { left: 'KeyA', right: 'KeyD', jump: 'KeyW', block: 'KeyS', punch: 'KeyQ', kick: 'KeyE', special: 'KeyR' };
    const key = map[btn.dataset.touch];
    const down = e => { e.preventDefault(); initAudio(); touch[key] = 1; btn.classList.add('is-down'); };
    const up = e => { e.preventDefault(); touch[key] = 0; btn.classList.remove('is-down'); };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('pointerleave', up);
  });

  function togglePause(force) {
    if (!match) return;
    match.paused = typeof force === 'boolean' ? force : !match.paused;
    $('#pause-modal').hidden = !match.paused;
    if (!match.paused && !match.ended) { lastFrameTime = 0; accumulator = 0; raf = requestAnimationFrame(loop); }
  }

  function openHow() {
    $('#how-modal').hidden = false;
    $('#close-how').focus();
  }

  function closeHow() {
    $('#how-modal').hidden = true;
    $('#how-to-play').focus();
  }

  $('#enter-game').addEventListener('click', () => { initAudio(); sound('ui', 1.5); showScreen('select-screen'); });
  $('#back-to-hero').addEventListener('click', () => showScreen('hero-screen'));
  $('#start-fight').addEventListener('click', startMatch);
  $('#rematch').addEventListener('click', startMatch);
  $('#change-fighter').addEventListener('click', () => { pick1 = null; pick2 = null; updatePicks(); showScreen('select-screen'); });
  $('#pause-btn').addEventListener('click', () => togglePause());
  $('#resume').addEventListener('click', () => togglePause(false));
  $('#quit-fight').addEventListener('click', () => { match.ended = true; $('#pause-modal').hidden = true; showScreen('select-screen'); });
  $('#sound-toggle').addEventListener('click', e => { muted = !muted; e.currentTarget.textContent = `SOM: ${muted ? 'OFF' : 'ON'}`; if (!muted) { initAudio(); sound('ui'); } });
  $('#how-to-play').addEventListener('click', openHow);
  $('#open-guide-arena').addEventListener('click', openHow);
  $('#close-how').addEventListener('click', closeHow);
  $('#how-modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeHow(); });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && match && !match.ended && !match.paused) togglePause(true);
  });
})();
