(() => {
  'use strict';

  // Matches the "90" the HUD starts with in index.html -- keep both in sync.
  const ROUND_TIME = 90;
  const STAGE_NAMES = { woodstock: "WOODSTOCK '69 STAGE", stadium: "STADIUM ARENA '94", club: "UNDERGROUND TUBE CLUB" };

  // Characters render at this height in the 960x540 stage space; the atlas art
  // is authored taller so it stays sharp on high-DPI displays.
  const FIGHTER_HEIGHT = 248;

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
      power: 5, speed: 4, defense: 3, style: 'grunge', portrait: 'portrait-kurt.webp'
    },
    {
      id: 'axl',
      name: 'Axl Rose',
      short: 'AXL',
      era: 'Sunset Wildcard',
      special: 'Serpent Mic-Stand',
      quote: 'Você quis o melhor? Agora aguenta.',
      color: '#ff435f', accent: '#8e183a', hair: '#b72b27', outfit: '#17141b', skin: '#e6ae80',
      power: 4, speed: 5, defense: 3, style: 'glam', portrait: 'portrait-axl.webp'
    },
    {
      id: 'lennon',
      name: 'John Lennon',
      short: 'LENNON',
      era: 'The Dreamer',
      special: 'Peace & Love Pulse',
      quote: 'Dê uma chance ao contra-ataque.',
      color: '#6acfa0', accent: '#27463a', hair: '#34251e', outfit: '#314d3f', skin: '#e1b08a',
      power: 4, speed: 3, defense: 5, style: 'moptop', portrait: 'portrait-lennon.webp'
    }
  ];

  // --- DOM ELEMENTS & STATE ---
  const screens = [...document.querySelectorAll('.screen')];
  const roster = document.querySelector('#roster');
  const gameCanvas = document.querySelector('#game');
  const ctx = gameCanvas.getContext('2d');
  
  // Cache DOM de alta performance para zerar pesquisas DOM no loop 60Hz
  const dom = {
    p1Name: document.querySelector('#p1-name'),
    p2Name: document.querySelector('#p2-name'),
    timer: document.querySelector('#timer'),
    opponentLabel: document.querySelector('#opponent-label'),
    roundLabel: document.querySelector('#round-label'),
    coachText: document.querySelector('#coach-text'),
    p1Health: document.querySelector('#p1-health'),
    p2Health: document.querySelector('#p2-health'),
    p1Meter: document.querySelector('#p1-meter'),
    p2Meter: document.querySelector('#p2-meter'),
    p1Ready: document.querySelector('#p1-ready'),
    p2Ready: document.querySelector('#p2-ready'),
    p1Pips: document.querySelector('#p1-pips'),
    p2Pips: document.querySelector('#p2-pips'),
  };

  const stageSprites = {};
  const keys = {};
  const touch = {};
  let pick1 = null;
  let pick2 = null;
  let currentStage = 'woodstock'; // 'woodstock', 'stadium', or 'club' -- keep in sync with the .stage-btn.is-active default in index.html

  // Every dial the CPU's difficulty turns: how long it waits before reacting
  // to an incoming attack (in frames -- this delay is what actually reads as
  // "skill" rather than raw stat inflation), how often it blocks/attacks/
  // specials/retreats, and how hard its hits land vs. how hard it takes them.
  const DIFFICULTY = {
    easy: { reactionDelay: [22, 36], blockChance: 0.32, aggression: 0.30, specialChance: 0.45, retreatChance: 0.30, jumpChance: 0.03, cpuDamageMult: 0.55, playerDamageMult: 1.15 },
    normal: { reactionDelay: [14, 28], blockChance: 0.55, aggression: 0.55, specialChance: 0.65, retreatChance: 0.22, jumpChance: 0.04, cpuDamageMult: 0.75, playerDamageMult: 1.0 },
    hard: { reactionDelay: [5, 14], blockChance: 0.80, aggression: 0.85, specialChance: 0.85, retreatChance: 0.15, jumpChance: 0.06, cpuDamageMult: 1.0, playerDamageMult: 0.9 },
  };
  let difficulty = ['easy', 'normal', 'hard'].includes(localStorage.getItem('rk-difficulty')) ? localStorage.getItem('rk-difficulty') : 'normal';

  let muted = false;
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

  // --- SKELETAL SPRITE RIG ---
  // Fighters are drawn from `assets/atlas-*.webp`: eleven body parts per fighter
  // posed as a bone chain by rig.js. See tools/build-sprites.py for the pipeline
  // that produces them from the source art.
  let rigs = null;
  let rigClips = null;
  let rigError = null;

  // Real concert photos (blurred, colour-graded, darkened -- see
  // tools/build-stages.py) sit behind the procedural floor/props/crowd
  // layers. Each stage falls back to the old flat gradient if its photo
  // fails to load, so a missing asset never breaks the backdrop.
  const stagePhotos = {};
  ['stadium', 'club', 'woodstock'].forEach(name => {
    const img = new Image();
    img.src = `assets/stage-${name}.webp`;
    img.onload = () => { stagePhotos[name] = img; stageCache.dirty = true; };
  });

  const realAmpImg = new Image(); realAmpImg.src = 'assets/real-amp.webp';
  const realDrumsImg = new Image(); realDrumsImg.src = 'assets/real-drums.webp';
  const realTrussImg = new Image(); realTrussImg.src = 'assets/real-truss.webp';
  const weaponGuitarImg = new Image(); weaponGuitarImg.src = 'assets/weapon-guitar.webp';
  const weaponMicImg = new Image(); weaponMicImg.src = 'assets/weapon-mic.webp';
  const weaponDoveImg = new Image(); weaponDoveImg.src = 'assets/weapon-dove.webp';

  [realAmpImg, realDrumsImg, realTrussImg].forEach(img => {
    img.onload = () => {
      initRealisticStageSprites();
      if (typeof stageCache !== 'undefined') stageCache.dirty = true;
    };
  });

  const rigReady = RockKombatRig.load('assets/atlas.json', 'assets/')
    .then(loaded => {
      rigs = loaded.fighters;
      rigClips = loaded.clips;
    })
    .catch(err => {
      rigError = err;
      console.error('[Rock Kombat] sprite atlas failed to load:', err);
    });


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
    
    if (realAmpImg.complete && realAmpImg.naturalWidth > 0) {
      const shadowG = ax.createRadialGradient(70, 232, 5, 70, 232, 60);
      shadowG.addColorStop(0, 'rgba(0,0,0,0.65)'); shadowG.addColorStop(1, 'transparent');
      ax.fillStyle = shadowG; ax.fillRect(0, 215, 140, 25);
      ax.drawImage(realAmpImg, 5, 0, 130, 220);
    } else {
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
        ax.font = 'italic bold 11px "Barlow Condensed", Oswald, sans-serif';
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
    }
    stageSprites.marshallStack = ampC;

    // 2. Bateria Realista Woodstock (Transparente)
    const drumC = document.createElement('canvas');
    drumC.width = 280; drumC.height = 200;
    const dx = drumC.getContext('2d');
    
    if (realDrumsImg.complete && realDrumsImg.naturalWidth > 0) {
      dx.fillStyle = 'rgba(75, 15, 25, 0.85)'; dx.fillRect(10, 165, 260, 28);
      dx.strokeStyle = 'rgba(215, 155, 65, 0.5)'; dx.lineWidth = 2; dx.strokeRect(10, 165, 260, 28);
      dx.drawImage(realDrumsImg, 10, 10, 260, 170);
    } else {
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
    }
    stageSprites.woodstockDrumKit = drumC;

    // 3. Estrutura Rústica Woodstock '69 e Canhão de Luz (Rigging) Esquerda & Direita
    [true, false].forEach(isLeft => {
      const rigC = document.createElement('canvas');
      rigC.width = 220; rigC.height = 420;
      const rx = rigC.getContext('2d');
      
      if (realTrussImg.complete && realTrussImg.naturalWidth > 0) {
        rx.drawImage(realTrussImg, isLeft ? 10 : 150, 0, 60, 420);
      } else {
        rx.fillStyle = '#301d14'; rx.fillRect(isLeft ? 20 : 160, 0, 40, 420);
        rx.fillStyle = '#4a2c1e'; rx.fillRect(isLeft ? 0 : 180, 0, 22, 420);
        for (let y = 40; y < 400; y += 80) {
          rx.fillStyle = '#26160f'; rx.fillRect(isLeft ? 0 : 160, y, 60, 18);
          rx.fillStyle = '#b89b80';
          rx.beginPath(); rx.arc(isLeft ? 10 : 170, y + 9, 3, 0, Math.PI * 2); rx.fill();
          rx.beginPath(); rx.arc(isLeft ? 50 : 210, y + 9, 3, 0, Math.PI * 2); rx.fill();
        }
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
      rx.font = '900 28px "Barlow Condensed", sans-serif';
      rx.fillText(isLeft ? "PEACE" : "ROCK", isLeft ? 120 : 100, 105);
      rx.font = '700 12px Oswald, sans-serif';
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
    
    if (realAmpImg.complete && realAmpImg.naturalWidth > 0) {
      cx.drawImage(realAmpImg, 15, 20, 130, 130);
    } else {
      cx.fillStyle = '#3a2a1d'; cx.fillRect(15, 30, 130, 115);
      cx.strokeStyle = '#1f140c'; cx.lineWidth = 3; cx.strokeRect(15, 30, 130, 115);
      cx.fillStyle = '#140c08'; cx.fillRect(25, 45, 110, 85);
      cx.fillStyle = '#ff7b00'; cx.shadowColor = '#ff6200'; cx.shadowBlur = 10;
      [50, 75, 100].forEach(tx => { cx.fillRect(tx, 35, 8, 16); });
      cx.shadowBlur = 0;
      cx.fillStyle = '#b51a30'; cx.fillRect(95, 135, 32, 22);
      cx.fillStyle = '#ff1a1a'; cx.beginPath(); cx.arc(111, 140, 2.5, 0, Math.PI * 2); cx.fill();
    }
    stageSprites.clubTubeAmp = clubC;

    // 5. Packed Woodstock hillside crowd, painted once and reused every frame.
    // Redrawing ~200 silhouette shapes per tick was a real cost for a backdrop
    // that barely changes; baking it removes that entirely from the render loop.
    const crowdC = document.createElement('canvas');
    crowdC.width = 1300; crowdC.height = 170;
    const gx = crowdC.getContext('2d');
    // Warm, near-black silhouette tones (not the cool purple of the hills
    // behind them) so the crowd reads as backlit shapes against the sunset
    // glow instead of blending into the hillside.
    const palette = ['#160a08', '#1e0d09', '#130a12', '#20130a', '#160c16', '#0e0808'];
    const rows = [
      { y: 6, n: 48, r: 5, alpha: 0.7 },
      { y: 24, n: 44, r: 6, alpha: 0.78 },
      { y: 46, n: 40, r: 7.2, alpha: 0.86 },
      { y: 72, n: 35, r: 8.6, alpha: 0.93 },
      { y: 100, n: 31, r: 10.2, alpha: 0.98 },
      { y: 132, n: 27, r: 12, alpha: 1 }
    ];
    rows.forEach(row => {
      const spacing = crowdC.width / row.n;
      for (let i = 0; i < row.n; i++) {
        const x = i * spacing + spacing * 0.5 + Math.sin(i * 12.9 + row.y) * spacing * 0.28;
        gx.globalAlpha = row.alpha;
        gx.fillStyle = palette[(i + Math.floor(row.y)) % palette.length];
        gx.beginPath();
        gx.arc(x, row.y, row.r, Math.PI, 0);
        gx.rect(x - row.r, row.y, row.r * 2, row.r * 2.2);
        gx.fill();
        // Thin sunset rim-light along the top of each head -- the detail
        // that actually sells "backlit crowd at dusk" versus a flat blob.
        gx.strokeStyle = 'rgba(255, 196, 130, 0.45)';
        gx.lineWidth = 1;
        gx.beginPath(); gx.arc(x, row.y, row.r, Math.PI * 1.08, Math.PI * 1.92); gx.stroke();
        if ((i * 7 + row.y) % 11 === 0) {
          gx.fillRect(x + row.r * 0.35, row.y - row.r * 1.7, row.r * 0.3, row.r * 1.7);
        }
        if ((i * 13 + row.y) % 37 === 0) {
          gx.strokeStyle = 'rgba(255, 220, 150, 0.55)';
          gx.lineWidth = 1;
          gx.beginPath(); gx.moveTo(x, row.y - row.r); gx.lineTo(x, row.y - row.r * 3); gx.stroke();
          gx.fillStyle = 'rgba(255, 196, 120, 0.65)';
          gx.beginPath(); gx.arc(x, row.y - row.r * 3, 3, 0, Math.PI * 2); gx.fill();
        }
      }
    });
    gx.globalAlpha = 1;
    stageSprites.woodstockCrowd = crowdC;
  }
  initRealisticStageSprites();

  const $ = (selector) => document.querySelector(selector);
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const rand = (min, max) => Math.random() * (max - min) + min;
  const cleanInPlace = (arr, fn) => {
    let k = 0;
    const n = arr.length;
    for (let i = 0; i < n; i++) {
      if (fn(arr[i])) {
        if (i !== k) arr[k] = arr[i];
        k++;
      }
    }
    if (k < n) arr.length = k;
  };

  // --- CANVAS HIGH-DPI RESIZING ---
  // Driven by a ResizeObserver rather than measured every frame: reading
  // getBoundingClientRect inside the render loop forces a layout each tick.
  function resizeCanvas(width, height) {
    if (!gameCanvas) return;
    // A 0 (or missing) measurement means the box was caught mid-layout -- e.g.
    // canvas-wrap flipping from display:none to flex fires the observer before
    // the browser has sized it. Falling back to a 960x540 default in that case
    // would leave the canvas stuck at the wrong size until something else
    // happens to trigger another resize, so just skip and wait for the next
    // observer callback (which fires as soon as the real size is known) rather
    // than committing to a guess.
    const w = width || gameCanvas.clientWidth;
    const h = height || gameCanvas.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const targetW = Math.round(w * dpr);
    const targetH = Math.round(h * dpr);
    if (gameCanvas.width !== targetW || gameCanvas.height !== targetH) {
      gameCanvas.width = targetW;
      gameCanvas.height = targetH;
    }
  }

  // Observe the wrapper, not the canvas itself: canvas-wrap carries the
  // aspect-ratio/layout CSS, so its box is the source of truth. (Observing the
  // canvas works too since it fills the wrapper, but one extra layer of
  // indirection is one less thing to reason about if that CSS ever changes.)
  const canvasWrapEl = $('#canvas-wrap');
  if (typeof ResizeObserver === 'function' && canvasWrapEl) {
    new ResizeObserver(entries => {
      const box = entries[0].contentRect;
      resizeCanvas(box.width, box.height);
    }).observe(canvasWrapEl);
  } else {
    window.addEventListener('resize', () => resizeCanvas());
  }

  function showScreen(id) {
    screens.forEach(screen => screen.classList.toggle('is-active', screen.id === id));
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (id === 'arena-screen') {
      setTimeout(resizeCanvas, 50);
    }
  }

  // --- AUDIO -- delegates to the FM synth engine in audio.js ---
  function initAudio() { if (!muted) RockKombatAudio.init(); }
  function sound(type, pitch = 1) { if (!muted) RockKombatAudio.sfx(type, pitch); }

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
    card.innerHTML = `<div class="portrait"></div><div class="fighter-info"><h3>${fighter.name}</h3><p>${fighter.special}</p>${stat('PWR',fighter.power)}${stat('SPD',fighter.speed)}${stat('DEF',fighter.defense)}</div>`;
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

  // Stage Switcher Listener -- scoped to each button's own group since the
  // stage and difficulty pickers share the `.stage-btn` class/styling but
  // must stay independently exclusive.
  document.querySelectorAll('[data-stage]').forEach(btn => {
    btn.addEventListener('click', () => {
      currentStage = btn.dataset.stage;
      localStorage.setItem('rk-stage', currentStage);
      document.querySelectorAll('[data-stage]').forEach(b => b.classList.toggle('is-active', b === btn));
    });
  });

  document.querySelectorAll('[data-difficulty]').forEach(btn => {
    btn.addEventListener('click', () => {
      difficulty = btn.dataset.difficulty;
      localStorage.setItem('rk-difficulty', difficulty);
      document.querySelectorAll('[data-difficulty]').forEach(b => b.classList.toggle('is-active', b === btn));
    });
  });

  // Restore persisted stage/difficulty picks on load.
  {
    const savedStage = localStorage.getItem('rk-stage');
    if (savedStage && document.querySelector(`[data-stage="${savedStage}"]`)) {
      currentStage = savedStage;
      document.querySelectorAll('[data-stage]').forEach(b => b.classList.toggle('is-active', b.dataset.stage === savedStage));
    }
    document.querySelectorAll('[data-difficulty]').forEach(b => b.classList.toggle('is-active', b.dataset.difficulty === difficulty));
  }

  // --- PLAYER ENTITY CLASS (STREET FIGHTER COMBO & COMBAT ENGINE) ---
  class Player {
    constructor(data, x, facing, isCpu = false) {
      this.data = data; this.x = x; this.y = 425; this.vx = 0; this.vy = 0;
      this.facing = facing; this.attackFacing = facing; this.cpu = isCpu;
      this.health = 100; this.meter = 20; this.width = 70; this.height = 150;
      this.grounded = true; this.ducking = false; this.attack = null; this.attackTimer = 0; this.cooldown = 0;
      this.hitFlash = 0; this.stun = 0; this.blocking = false; this.blockTimer = 0;
      this.aiTimer = 0; this.aiReactingTo = null; this.aiReactionTimer = 0;
      this.afterimages = []; this.combo = 0; this.comboTimer = 0; this.animFrame = 0;
      this.landSquash = 0; this.bufferedAttack = null;
      this.knockdown = 0; this.wakeup = 0; this.invuln = 0;
      this.anim = rigClips ? new RockKombatRig.Animator(rigClips) : null;
      this.animState = 'idle';
    }

    /** Facing locked for the duration of an attack so mid-swing crossovers
     *  don't reverse the hitbox, flip the sprite, or invert knockback. */
    faceDir() {
      return this.attack ? this.attackFacing : this.facing;
    }

    /** Which clip the current physics state should be playing. */
    clipName() {
      if (this.knockdown > 0) return 'hit';
      if (this.attack) {
        if (this.attack.type === 'mini_special') return 'special';
        if (this.attack.type === 'uppercut') return 'punch';
        if (this.attack.type === 'sweep') return 'kick';
        return this.attack.type;
      }
      if (this.stun > 0 || (this.wakeup > 0 && Math.floor(this.animFrame / 4) % 2 === 0)) return 'hit';
      if (this.blocking || this.ducking) return 'block';
      if (!this.grounded) return 'jump';
      return Math.abs(this.vx) > 0.55 ? 'walk' : 'idle';
    }

    /** Advance the skeleton one 60 Hz step, restarting one-shot clips on entry. */
    updateAnimation() {
      if (!this.anim && rigClips) this.anim = new RockKombatRig.Animator(rigClips);
      if (!this.anim) return;
      const next = this.clipName();
      const restart = next !== this.animState && (next === 'punch' || next === 'kick'
        || next === 'special' || next === 'hit' || next === 'jump');
      this.anim.play(next, restart);
      this.animState = next;
      this.anim.update();
    }

    input(other) {
      if (this.knockdown > 0 || this.stun > 0) return { left:false, right:false, jump:false, block:false, punch:false, kick:false, special:false, down:false };
      if (!this.cpu) {
        const downPressed = isPressed('block');
        return {
          left: isPressed('left'),
          right: isPressed('right'),
          jump: consumeAction('jump'),
          block: downPressed,
          down: downPressed,
          punch: consumeAction('punch'),
          kick: consumeAction('kick'),
          special: consumeAction('special')
        };
      }

      // --- INTELIGÊNCIA ARTIFICIAL ARQUETÍPICA (ARGHETYPE AI) ---
      const tune = DIFFICULTY[difficulty];
      this.aiTimer--;
      const distance = Math.abs(other.x - this.x);
      const input = { left:false, right:false, jump:false, block:false, punch:false, kick:false, special:false, down:false };
      const fid = this.data.id;

      const blockChance = clamp(tune.blockChance + (this.data.defense - 3) * 0.05 + (fid === 'lennon' ? 0.15 : 0), 0.20, 0.98);
      const cadenceFactor = clamp(1 - (this.data.speed - 3) * 0.08, 0.50, 1.25);

      // AI Combo Execution: Se acabou de acertar um soco, tentar emendar combo imediatamente!
      if (this.attack && this.attack.hit) {
        if (this.attack.type === 'punch' && Math.random() < tune.aggression * (fid === 'axl' ? 1.5 : 1.3)) {
          input[Math.random() < (fid === 'kurt' ? 0.3 : 0.5) ? 'kick' : 'down'] = true; input.kick = true;
          return input;
        }
        if (this.meter >= 50 && Math.random() < tune.specialChance * (fid === 'axl' ? 1.4 : 1.1)) {
          input.special = true;
          return input;
        }
      }

      // Defesa e Perfect Parry contra projéteis e golpes inimigos (Lennon é mestre em parry)
      if ((other.attack || (match.projectiles && match.projectiles.some(p => p.owner === other && Math.abs(p.x - this.x) < 240))) && distance < 270) {
        if (this.aiReactingTo !== other.attack) {
          this.aiReactingTo = other.attack;
          const delayMod = fid === 'lennon' ? -4 : fid === 'axl' ? 2 : 0;
          this.aiReactionTimer = Math.round(rand(Math.max(2, tune.reactionDelay[0] + delayMod), Math.max(5, tune.reactionDelay[1] + delayMod)));
        }
        if (this.aiReactionTimer > 0) this.aiReactionTimer--;
        if (this.aiReactionTimer <= 0 && Math.random() < blockChance) {
          input.block = true;
          if (other.attack && (other.attack.type === 'punch' || other.attack.sweep) && Math.random() < (fid === 'lennon' ? 0.85 : 0.7)) input.down = true;
          return input;
        }
      } else {
        this.aiReactingTo = null;
      }

      // Anti-Air Shoryuken: Oponente pulando em nossa direção
      if (!other.grounded && distance < (fid === 'lennon' ? 160 : 145) && this.cooldown <= 0 && Math.random() < tune.aggression * 1.1) {
        if (Math.random() < (fid === 'kurt' || fid === 'axl' ? 0.85 : 0.75)) { input.down = true; input.punch = true; } // Gancho!
        else { input.kick = true; }
        return input;
      }

      // COMPORTAMENTO DIFERENCIADO POR ARQUÉTIPO (KURT vs AXL vs LENNON)
      if (fid === 'lennon') {
        // ZONER / DEFENSIVE MASTER: Procura espaçamento longo (170-230px), atira Karma Rings e usa pokes longos
        if (distance < 135 && Math.random() < 0.75 && other.knockdown <= 0) {
          input[other.x < this.x ? 'right' : 'left'] = true; // Recuo tático constante
        } else if (distance >= 160 && this.meter >= 50 && this.grounded && Math.random() < tune.specialChance * 1.5) {
          input.special = true; // Dispara magias defensivas
          return input;
        } else if (distance > 220) {
          input[other.x < this.x ? 'left' : 'right'] = true; // Aprox-se só o suficiente para zonear
        }
        // Long-range Poke (Revolution Kick tem alcance 122px!)
        if (distance >= 95 && distance <= 125 && this.cooldown <= 0 && Math.random() < tune.aggression * 1.2) {
          input.kick = true;
          return input;
        }
      } else if (fid === 'axl') {
        // RUSHDOWN / SPEED MACHINE: Nunca recua, corre pra cima (<85px) e aplica Dash Shoryuken
        if (distance > 80) {
          input[other.x < this.x ? 'left' : 'right'] = true;
        }
        // Surpreender de média distância com o avanço do Paradise Shoryuken (vx=+6.5) ou rasteira veloz
        if (distance >= 75 && distance <= 110 && this.cooldown <= 0 && Math.random() < tune.aggression * 0.9) {
          if (Math.random() < 0.55) { input.down = true; input.punch = true; } // Lunge Shoryu
          else { input.down = true; input.kick = true; } // Rose Sweep
          return input;
        }
      } else {
        // KURT: BALANCED BRAWLER (Ryu style): Busca distância média (~110px), jump-in attacks e Smash Slide
        if (distance > 160 && this.meter >= 50 && this.grounded && Math.random() < tune.specialChance * 1.2) {
          input.special = true; // Guitarrada sônica
          return input;
        }
        const retreating = this.health < 25 && distance < 105 && Math.random() < tune.retreatChance;
        if (retreating) {
          input[other.x < this.x ? 'right' : 'left'] = true;
        } else if (distance > 115) {
          input[other.x < this.x ? 'left' : 'right'] = true;
        }
        // Jump-In Attack tático para iniciar Gatling Combo
        if (distance >= 135 && distance <= 185 && Math.random() < tune.jumpChance * 3.5 && this.grounded && !retreating) {
          input.jump = true; input[other.x < this.x ? 'left' : 'right'] = true;
        }
      }

      // Whiff Punish: adversário errou no vazio -> punir!
      const punishWhiff = other.attack && !other.attack.hit && other.attackTimer < other.attack.activeAt - 2
        && distance < 155 && Math.random() < tune.aggression * 1.35;

      if (distance < 160 && this.cooldown <= 0 && (punishWhiff || this.aiTimer <= 0)) {
        if (this.meter >= 100 && Math.random() < tune.specialChance) {
          input.special = true;
        } else if (this.meter >= 50 && Math.random() < tune.specialChance * 0.7) {
          input.special = true;
        } else if (Math.random() < tune.aggression || punishWhiff) {
          if (distance < 80 && Math.random() < 0.35) {
            input.down = true; input.punch = true; // Uppercut
          } else if (Math.random() < 0.45) {
            input.down = true; input.kick = true; // Sweep
          } else {
            input[Math.random() < 0.5 ? 'kick' : 'punch'] = true;
          }
        }
        this.aiTimer = rand(8, 24) * cadenceFactor;
      }
      if (distance > 220 && Math.random() < tune.jumpChance && this.grounded && fid !== 'lennon') input.jump = true;
      return input;
    }

    update(other) {
      this.animFrame++;
      if (this.cooldown > 0) this.cooldown--;
      if (this.hitFlash > 0) this.hitFlash--;
      if (this.stun > 0) this.stun--;
      if (this.landSquash > 0) this.landSquash--;
      if (this.wakeup > 0) this.wakeup--;
      if (this.invuln > 0) this.invuln--;
      if (this.comboTimer > 0) this.comboTimer--; else this.combo = 0;

      // Hard Knockdown: Deitado ao chão irresponsivo até levantar com invulnerabilidade
      if (this.knockdown > 0) {
        this.knockdown--;
        this.vx = 0; this.vy = 0; this.grounded = true; this.height = 40;
        if (this.knockdown === 0) {
          this.wakeup = 25; // Invulnerabilidade de levantamento (Okizeme)
          this.height = 150;
        }
        this.updateAnimation();
        return;
      }

      const input = this.input(other);

      // Controle de Bloco e Temporizador de Perfect Parry
      if (input.block || (input.down && other.attack)) {
        if (!this.blocking) this.blockTimer = 0;
        this.blocking = true; this.blockTimer++;
      } else {
        this.blocking = false; this.blockTimer = 0;
      }
      this.ducking = (input.down || input.block) && this.grounded && !this.attack && !input.left && !input.right;
      this.height = this.ducking ? 80 : 150; // Agachamento reduz hitbox

      // --- SISTEMA DE CANCELAMENTO DE COMBOS (GATLING & SPECIAL CANCEL) ---
      let comboCanceled = false;
      if (this.attack && this.attack.hit && this.cooldown > 0) {
        // Target Combo: Soco -> Chute ou Rasteira
        if (this.attack.type === 'punch' && ((input.down && input.kick) || input.kick)) {
          this.attack = null; this.cooldown = 0; comboCanceled = true;
        }
        // Special Cancel: Qualquer Golpe Normal -> Especial ou Mini-Especial!
        else if (['punch', 'kick', 'sweep', 'uppercut'].includes(this.attack.type) && input.special && this.meter >= 50) {
          this.attack = null; this.cooldown = 0; comboCanceled = true;
        }
      }

      if (this.attack && this.attackTimer <= Math.max(6, this.attack.activeAt - 2)) {
        if (input.down && input.kick) this.bufferedAttack = 'sweep';
        else if (input.down && input.punch) this.bufferedAttack = 'uppercut';
        else if (input.punch) this.bufferedAttack = 'punch';
        else if (input.kick) this.bufferedAttack = 'kick';
        else if (input.special && this.meter >= 50) this.bufferedAttack = this.meter >= 100 ? 'special' : 'mini_special';
      }
      if (!this.attack && this.bufferedAttack && this.cooldown <= 0) {
        const queued = this.bufferedAttack; this.bufferedAttack = null; this.startAttack(queued);
      }

      const speed = (3.2 + this.data.speed * 0.25) * (this.cpu ? 0.93 : 1);

      // Movimentação Planted (Fricção e resposta imediata sem patinar no gelo)
      if (!this.attack && !this.blocking && !this.ducking && this.stun <= 0) {
        const targetSpeed = input.left ? -speed : input.right ? speed : 0;
        const control = this.grounded ? 0.85 : 0.12;
        this.vx += (targetSpeed - this.vx) * control;
        if (!input.left && !input.right) {
          this.vx *= this.grounded ? 0.25 : 0.95; // Parada limpa de Street Fighter!
        }
        if (input.jump && this.grounded) {
          this.vy = -12.2; this.grounded = false; sound('jump', 0.95);
        }
        // Disparo de Golpes (Comando Direcional & Especiais)
        if (input.down && input.kick && this.grounded) this.startAttack('sweep');
        else if (input.down && input.punch) this.startAttack('uppercut');
        else if (input.punch) this.startAttack('punch');
        else if (input.kick) this.startAttack('kick');
        else if (input.special && this.grounded) {
          if (this.meter >= 100) this.startAttack('special');
          else if (this.meter >= 50) this.startAttack('mini_special');
        }
      } else if (this.ducking && !this.attack && this.stun <= 0) {
        this.vx *= 0.2;
        if (input.kick) this.startAttack('sweep');
        else if (input.punch) this.startAttack('uppercut');
      } else if (this.attack) {
        this.vx *= 0.60; // Base firme ao golpear
      }

      const wasGrounded = this.grounded;
      this.vy += 0.60;
      this.x += this.vx; this.y += this.vy;

      if (this.y >= 425) {
        this.y = 425;
        if (!wasGrounded && this.vy > 4.5) {
          this.landSquash = 7;
          match.shake = Math.max(match.shake, 3.2);
          if (typeof burst === 'function') burst(this.x, 425, '#c2cbda', 8, 'land');
          sound('land', 0.95);
        }
        this.vy = 0; this.grounded = true;
      }
      this.x = clamp(this.x, 80, 880);
      if (!this.attack && this.knockdown <= 0) this.facing = other.x >= this.x ? 1 : -1;

      // Soft body separation
      const gap = other.x - this.x;
      const minGap = 64;
      if (Math.abs(gap) < minGap && Math.abs(other.y - this.y) < 95 && other.knockdown <= 0) {
        const push = (minGap - Math.abs(gap)) * 0.35 * Math.sign(gap || this.faceDir());
        this.x -= push;
      }

      this.updateAnimation();

      // Atualização do Ataque e Janelas Ativas do Hitbox (Active Frames)
      if (this.attackTimer > 0) {
        this.attackTimer--;
        
        // No frame de ativação do Especial / Mini-Especial, dispara o Projétil Real!
        if (this.attack && this.attackTimer === this.attack.activeAt) {
          const dir = this.faceDir();
          if (this.attack.type === 'mini_special' || this.attack.type === 'special') {
            const isSuper = this.attack.type === 'special';
            const projSpeed = this.attack.projSpeed || (isSuper ? 17 : 13);
            const projLife = this.attack.projLife || 110;
            const projShape = this.data.id === 'lennon' ? 'ring' : this.data.id === 'axl' ? 'pyro' : 'sonic';
            const projCount = this.attack.projCount || (isSuper ? 3 : 1);

            for (let i = 0; i < projCount; i++) {
              const yOffset = -90 + (i - (projCount - 1) / 2) * 28;
              match.projectiles.push({
                owner: this,
                id: this.data.id,
                type: this.attack.type,
                x: this.x + (60 + i * 20) * dir,
                y: this.y + (this.data.id === 'kurt' && isSuper ? 0 : yOffset),
                vx: (projSpeed + i * 1.5) * dir,
                vy: this.data.id === 'kurt' && isSuper ? 0 : (rand(-0.3, 0.3)),
                radius: isSuper ? 48 : 34,
                damage: isSuper ? (10.0 + this.data.power * 0.5) : (7.8 + this.data.power * 0.4),
                life: projLife,
                color: this.data.color,
                shape: projShape,
                hit: false
              });
            }
            sound('projectile_' + this.data.id, 1.0 + (this.data.speed * 0.05));
          }
        }

        // Janela contínua do Hitbox Ativo (Impede que o golpe atravesse no frame seguinte)
        if (this.attack && !this.attack.hit && this.attackTimer <= this.attack.activeAt && this.attackTimer >= Math.max(1, this.attack.activeAt - (this.attack.activeWindow || 6))) {
          this.checkHit(other);
        }
        if (this.attackTimer <= 0) this.attack = null;
      }
      cleanInPlace(this.afterimages, a => (--a.life) > 0);
    }

    startAttack(type) {
      if (this.cooldown > 0 || this.knockdown > 0 || this.stun > 0) return;
      const isAir = !this.grounded;
      const fid = this.data.id;
      let config = {};

      if (fid === 'kurt') {
        // Kurt: All-Rounder Brawler. Alto hit-stun (+4), antiaéreo vertical pesado, magias rasteiras sônicas brutais.
        config = {
          punch: { duration: isAir ? 15 : 13, activeAt: isAir ? 10 : 8, activeWindow: 5, range: isAir ? 96 : 83, damage: 4.8, knock: 4.5, hitStunBonus: 4, radius: 44, airAttack: isAir },
          kick: { duration: isAir ? 18 : 16, activeAt: isAir ? 12 : 10, activeWindow: 6, range: isAir ? 118 : 98, damage: 6.5, knock: 6.0, hitStunBonus: 5, radius: 48, airAttack: isAir },
          sweep: { duration: 22, activeAt: 14, activeWindow: 7, range: 114, damage: 7.8, knock: 4.5, sweep: true, slideBoost: 5.5, radius: 46 },
          uppercut: { duration: 26, activeAt: 15, activeWindow: 8, range: 88, damage: 12.5, knock: 7.0, launch: -14.5, invuln: 8, forwardBoost: 3.8, radius: 56 },
          mini_special: { duration: 25, activeAt: 14, activeWindow: 8, range: 140, damage: 9.0, knock: 7.5, radius: 56, projSpeed: 15, projLife: 115 },
          special: { duration: 32, activeAt: 16, activeWindow: 10, range: 175, damage: 16.0, knock: 12.5, radius: 74, projSpeed: 19, projLife: 125, projCount: 3 }
        }[type];
      } else if (fid === 'axl') {
        // Axl: Rushdown Veloz. O ataque mais rápido da arena (11 frames), gancho com dash avançado (vx=+6.5) e fogo rápido.
        config = {
          punch: { duration: isAir ? 13 : 11, activeAt: isAir ? 9 : 7, activeWindow: 4, range: isAir ? 90 : 78, damage: 3.8, knock: 3.2, hitStunBonus: 3, radius: 40, airAttack: isAir },
          kick: { duration: isAir ? 16 : 14, activeAt: isAir ? 11 : 9, activeWindow: 5, range: isAir ? 110 : 92, damage: 5.5, knock: 5.0, hitStunBonus: 3, radius: 45, airAttack: isAir },
          sweep: { duration: 18, activeAt: 11, activeWindow: 6, range: 104, damage: 6.4, knock: 4.0, sweep: true, slideBoost: 4.5, radius: 44 },
          uppercut: { duration: 24, activeAt: 14, activeWindow: 8, range: 92, damage: 11.2, knock: 8.5, launch: -13.0, invuln: 7, forwardBoost: 6.5, radius: 54 },
          mini_special: { duration: 23, activeAt: 13, activeWindow: 8, range: 135, damage: 8.2, knock: 8.0, radius: 54, projSpeed: 17, projLife: 105 },
          special: { duration: 29, activeAt: 15, activeWindow: 9, range: 168, damage: 15.0, knock: 12.0, radius: 70, projSpeed: 21, projLife: 115, projCount: 3 }
        }[type];
      } else {
        // Lennon: Zoner Defensivo. Maior alcance de golpe (122px), antiaéreo com 9 frames de invulnerabilidade e magias duradouras.
        config = {
          punch: { duration: isAir ? 16 : 15, activeAt: isAir ? 11 : 10, activeWindow: 6, range: isAir ? 98 : 94, damage: 4.3, knock: 6.5, hitStunBonus: 2, radius: 46, airAttack: isAir },
          kick: { duration: isAir ? 20 : 19, activeAt: isAir ? 14 : 13, activeWindow: 7, range: isAir ? 128 : 122, damage: 6.8, knock: 7.5, hitStunBonus: 3, radius: 50, airAttack: isAir },
          sweep: { duration: 23, activeAt: 15, activeWindow: 7, range: 120, damage: 7.2, knock: 5.2, sweep: true, slideBoost: 2.2, radius: 48 },
          uppercut: { duration: 27, activeAt: 16, activeWindow: 9, range: 96, damage: 11.5, knock: 7.0, launch: -15.0, invuln: 9, forwardBoost: 2.5, radius: 60 },
          mini_special: { duration: 26, activeAt: 15, activeWindow: 9, range: 138, damage: 8.5, knock: 7.0, radius: 56, projSpeed: 9.5, projLife: 160 },
          special: { duration: 34, activeAt: 17, activeWindow: 11, range: 172, damage: 15.5, knock: 11.5, radius: 72, projSpeed: 12, projLife: 175, projCount: 3 }
        }[type] || { duration: 15, activeAt: 8, activeWindow: 5, range: 75, damage: 3, knock: 3, radius: 40 };
      }

      this.attackFacing = this.facing;
      this.attack = { type, ...config, hit: false };
      this.attackTimer = config.duration;

      // Gancho Shoryuken ou Super conferem breves frames de invulnerabilidade ao iniciar!
      if (config.invuln) this.invuln = config.invuln;

      const baseCooldown = (type === 'special' ? 36 : type === 'mini_special' ? 24 : type === 'uppercut' ? 24 : type === 'sweep' ? 20 : config.duration + 1) + (this.cpu ? 4 : 0);
      const recoveryBonus = (type === 'special' || type === 'mini_special') ? 0 : Math.round((this.data.speed - 3) * 1.4);
      this.cooldown = Math.max(config.duration - 1, baseCooldown - recoveryBonus);
      if (this.grounded) {
        const boost = config.forwardBoost || config.slideBoost || (type === 'special' ? 3.0 : type === 'mini_special' ? 2.2 : type === 'uppercut' ? 3.5 : type === 'sweep' ? 4.2 : type === 'kick' ? 1.8 : 1.2);
        this.vx += this.attackFacing * boost;
      }

      if (type === 'special') {
        this.meter = 0;
        this.afterimages.push({ x: this.x - 22 * this.attackFacing, y: this.y, life: 28 });
        sound('special_' + this.data.id, 1 + this.data.speed * 0.05);
        sound('crowd');
        match.specialFreeze = 26;
        match.specialAttacker = this;
      } else if (type === 'mini_special') {
        this.meter = Math.max(0, this.meter - 50);
        this.afterimages.push({ x: this.x - 12 * this.attackFacing, y: this.y, life: 16 });
        sound('whiff_special', 1.0);
      } else if (type === 'uppercut') {
        this.afterimages.push({ x: this.x - 14 * this.attackFacing, y: this.y, life: 18 });
        sound('whiff_punch', 0.85);
      } else if (type === 'sweep') {
        this.afterimages.push({ x: this.x - 14 * this.attackFacing, y: this.y, life: 15 });
        sound('whiff_sweep', 0.95);
      } else {
        if (type === 'kick') {
          this.afterimages.push({ x: this.x - 10 * this.attackFacing, y: this.y, life: 12 });
          sound('whiff_kick', 1.0 + rand(-0.05, 0.05));
        } else {
          sound('whiff_punch', 1.0 + rand(-0.05, 0.05));
        }
      }
    }

    checkHit(other) {
      if (!this.attack || other.knockdown > 0 || other.wakeup > 0 || other.invuln > 0) return;
      const dir = this.faceDir();
      const reach = this.attack.range;
      const radius = this.attack.radius || 42;

      let strikeX = this.x + dir * (reach * 0.55);
      let strikeY = this.y - (this.attack.type === 'kick' || this.attack.type === 'sweep' ? 55 : this.attack.type === 'uppercut' ? 115 : 95);
      const rig = rigs && rigs[this.data.id];
      if (rig && this.attack.type !== 'sweep') {
        const limb = this.attack.type === 'kick' ? 'legFrontLower' : 'armFrontLower';
        const m = rig._world[limb] || rig._world['armBackLower'] || rig._world['legBackLower'];
        if (m) {
          const scale = FIGHTER_HEIGHT / rig.baseH;
          const localX = (m[2] + RockKombatRig.PAD.left) - rig.anchorX;
          const localY = (m[5] + RockKombatRig.PAD.top) - rig.anchorY;
          strikeX = this.x - dir * localX * scale;
          strikeY = this.y + localY * scale;
        }
      }

      // Esquiva por Agachamento (Ducking evasion): Socos altos passam direto sobre a cabeça se agachado!
      if (other.ducking && this.attack.type === 'punch' && !this.attack.airAttack) {
        return; // Clean whiff!
      }

      const dx = other.x - strikeX;
      const dy = (other.y - (other.ducking ? 45 : 85)) - strikeY;
      const inFront = (other.x - this.x) * dir > -14;
      const verticalWindow = other.ducking ? 70 : (this.attack.type === 'kick' || this.attack.type === 'sweep' ? 95 : 110);
      const closeEnough = Math.hypot(dx, dy) < radius || (inFront && Math.abs(other.x - this.x) < reach && Math.abs(other.y - this.y) < verticalWindow);

      if (inFront && closeEnough) {
        this.attack.hit = true;
        
        // --- PERFECT PARRY (ROCK BLOCK / JUST-DEFEND) ---
        if (other.blocking && other.blockTimer > 0 && other.blockTimer <= 10) {
          other.meter = clamp(other.meter + 25, 0, 100); // Ganho maciço de especial!
          other.hitFlash = 0;
          this.vx = -6.5 * dir; // Empurrão forte no atacante
          this.cooldown = 15; // Deixa vulnerável para contra-ataque (Parry Punish)
          match.shake = 6; match.hitStop = 6;
          sound('parry', 1.0);
          return;
        }

        let damage = this.attack.damage;
        const tune = DIFFICULTY[difficulty];
        if (this.cpu) damage *= tune.cpuDamageMult;
        else if (other.cpu) damage *= tune.playerDamageMult;
        damage *= clamp(1 - (other.data.defense - 3) * 0.055, 0.78, 1.22);
        
        if (other.blocking) {
          damage *= 0.15; // Block chip damage
        }

        other.health = clamp(other.health - damage, 0, 100);
        other.hitFlash = 0;
        other.stun = other.blocking ? 6 : (this.attack.type === 'special' ? 32 : this.attack.type === 'uppercut' ? 28 : 16) + (this.attack.hitStunBonus || 0);
        
        if (this.grounded && !other.blocking) this.vx = -1.5 * dir;
        other.vx = this.attack.knock * dir * (other.blocking ? 0.35 : 1);
        
        // LAUNCH, JUGGLE & HARD KNOCKDOWN (Quedas e Arremessos estilo Street Fighter)
        if (this.attack.sweep && !other.blocking) {
          other.knockdown = 42; // Queda ao chão! (Hard Knockdown)
          other.vy = -3.5;
        } else if (this.attack.launch && !other.blocking) {
          other.vy = this.attack.launch; other.grounded = false;
          other.knockdown = 36; // Cai no solo ao aterrisar do gancho
        } else if (this.attack.airAttack && !other.blocking && other.grounded) {
          // Vantagem de Hit-Stun na aterrissagem para estender combos do ar para o solo!
          other.stun = 26; other.vx = 1.2 * dir;
        } else if (this.attack.type === 'special' && !other.blocking) {
          other.vy = -8.5; other.grounded = false; other.knockdown = 45;
        }

        // CORNER BOUNCE & SHUDDER
        if ((other.x <= 85 || other.x >= 875) && !other.blocking) {
          other.vx = -other.vx * 0.45;
          match.shake += 7;
          sound('corner_thud', 0.9);
        }

        this.meter = clamp(this.meter + ((this.attack.type === 'special' || this.attack.type === 'mini_special') ? 0 : this.cpu ? 12 : 24), 0, 100);
        other.meter = clamp(other.meter + (other.cpu ? 6 : 14), 0, 100);
        
        if (!other.blocking) {
          this.combo++; this.comboTimer = 75;
          if (this.combo >= 2) sound('combo', clamp(1 + this.combo * 0.1, 1, 1.6));
        }

        // Impact feedback: light shake + short hitstop only (no flash / labels / particles)
        match.shake = this.attack.type === 'special' ? 8 : 3;
        match.hitStop = other.blocking ? 2 : this.attack.type === 'special' ? 6 : 3;
        match.zoomPulse = 0;

        // EFEITOS SONOROS
        if (other.blocking) sound('block', 0.95);
        else if (this.attack.type === 'sweep') sound('hit_sweep', 1.0);
        else if (this.attack.type === 'uppercut') sound('uppercut', 1.0);
        else if (this.attack.type === 'kick') sound('hit_kick', 1.0);
        else if (this.attack.type === 'special' || this.attack.type === 'mini_special') sound('hit_special', 1.0);
        else sound('hit_punch', 1.0);
      }
    }
  }

  function startMatch() {
    if (!pick1 || !pick2) return;
    // The skeletons have to be in memory before the first frame is composed.
    if (!rigs && !rigError) {
      $('#start-fight').disabled = true;
      rigReady.then(() => startMatch());
      return;
    }
    if (rigError || !rigs) {
      // Fighting with no rig loaded means an invisible match -- refuse to
      // start and tell the player instead, rather than silently running it.
      const btn = $('#start-fight');
      btn.disabled = true;
      btn.textContent = 'ERRO AO CARREGAR SPRITES';
      const coach = $('#coach-text');
      if (coach) coach.textContent = 'Não foi possível carregar os lutadores. Recarregue a página.';
      return;
    }
    initAudio();
    showScreen('arena-screen');
    const s1 = pick1;
    const s2 = pick2;
    match = {
      s1, s2,
      p1: new Player(s1, 250, 1, false),
      p2: new Player(s2, 710, -1, true),
      timer: ROUND_TIME, frames: 0, state: 'intro', intro: 150, projectiles: [], particles: [], impacts: [], hitSparks: [], specialFreeze: 0, specialAttacker: null, shake: 0, flash: 0, hitStop: 0, zoomPulse: 0, ended: false, paused: false,
      camX: 480, camZoom: 1,
      round: 1, wins: { p1: 0, p2: 0 }, roundOver: false,
    };
    dom.p1Name.textContent = s1.short; dom.p2Name.textContent = s2.short;
    dom.timer.textContent = match.timer;
    dom.opponentLabel.textContent = match.p2.cpu ? 'CPU' : 'P2';
    dom.roundLabel.textContent = `ROUND ${match.round}`;
    updateRoundPips();

    if (dom.coachText) {
      dom.coachText.textContent = window.matchMedia('(max-width: 720px)').matches
        ? 'Use as setas ← e → para chegar perto do rival.'
        : 'Use A/D ou Setas. Q é Soco, E é Chute, R é Golpe Especial!';
    }

    announce(STAGE_NAMES[currentStage] || 'WORLD TOUR STAGE', 900);
    sound('crowd');
    if (!muted) RockKombatAudio.music.play(currentStage);
    cancelAnimationFrame(raf);
    lastFrameTime = 0; accumulator = 0;
    raf = requestAnimationFrame(loop);
  }

  function updateRoundPips() {
    if (!match) return;
    const fill = (el, wins) => {
      if (!el) return;
      const pips = el.children;
      for (let i = 0; i < pips.length; i++) pips[i].classList.toggle('won', i < wins);
    };
    fill(dom.p1Pips, match.wins.p1);
    fill(dom.p2Pips, match.wins.p2);
  }

  /** Wipes health/position/effects for a fresh round while keeping the
   *  overall match score (wins) and picks intact. */
  function resetRoundState() {
    match.p1 = new Player(match.s1, 250, 1, false);
    match.p2 = new Player(match.s2, 710, -1, true);
    match.timer = ROUND_TIME;
    match.projectiles = []; match.particles = []; match.impacts = []; match.hitSparks = [];
    match.specialFreeze = 0; match.specialAttacker = null;
    match.shake = 0; match.flash = 0; match.hitStop = 0; match.zoomPulse = 0;
    match.camX = 480; match.camZoom = 1;
    match.state = 'intro'; match.intro = 90;
  }

  /** A round ended (KO or time-out) -- score it, then either start the next
   *  round or, once someone has 2 round wins, finish the match. */
  function endRound() {
    if (match.roundOver || match.ended) return;
    match.roundOver = true;
    // Freeze the render loop during the round-break pause rather than
    // letting it keep ticking no-op frames -- endRound's own setTimeout
    // restarts it, and without this a second rAF chain would stack on top
    // of the one that's still (harmlessly, but wastefully) running.
    cancelAnimationFrame(raf);
    RockKombatAudio.music.stop();

    const isDraw = match.p1.health === match.p2.health;
    const winner = isDraw ? null : (match.p1.health > match.p2.health ? match.p1 : match.p2);
    if (winner === match.p1) match.wins.p1++;
    else if (winner === match.p2) match.wins.p2++;
    updateRoundPips();

    sound('special', 0.5);
    sound('crowd');
    announce(isDraw ? 'EMPATE NO ROUND!' : `${winner.data.short} VENCE O ROUND!`, 1200);

    const matchOver = match.wins.p1 >= 2 || match.wins.p2 >= 2;
    setTimeout(() => {
      if (matchOver) { finishMatch(); return; }
      match.round++;
      resetRoundState();
      $('#round-label').textContent = `ROUND ${match.round}`;
      $('#timer').textContent = match.timer;
      announce(`ROUND ${match.round}... FIGHT!`, 800);
      if (!muted) RockKombatAudio.music.play(currentStage);
      match.roundOver = false;
      lastFrameTime = 0; accumulator = 0;
      raf = requestAnimationFrame(loop);
    }, 1500);
  }

  function burst() { /* hit FX removed — no particle flash spam */ }

  function updateProjectiles() {
    if (!match || !match.projectiles) return;

    // 1. Checar colisão entre projéteis opostos no ar (Projectile Clash!)
    for (let i = 0; i < match.projectiles.length; i++) {
      const p1 = match.projectiles[i];
      if (p1.hit) continue;
      for (let j = i + 1; j < match.projectiles.length; j++) {
        const p2 = match.projectiles[j];
        if (p2.hit || p1.owner === p2.owner) continue;
        const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        if (dist < (p1.radius + p2.radius) * 1.1) {
          p1.hit = true; p2.hit = true;
          const midX = (p1.x + p2.x) / 2;
          const midY = (p1.y + p2.y) / 2;
          burst(midX, midY, '#c9a227', 4, 'normal');
          match.shake = Math.max(match.shake, 4);
          sound('projectile_clash', 1.0);
        }
      }
    }

    // 2. Atualizar movimento e colisão contra lutadores
    cleanInPlace(match.projectiles, p => {
      if (p.hit) return false;
      p.x += p.vx;
      p.y += p.vy;

      // Gerar rastro de partículas
      if (match.frames % 2 === 0) {
        match.particles.push({
          x: p.x + rand(-8, 8), y: p.y + rand(-8, 8),
          vx: -p.vx * 0.25 + rand(-1, 1), vy: rand(-1.5, 1.5),
          life: 18, maxLife: 18, color: p.color, size: rand(3, 7), shape: p.shape === 'ring' ? 'ring' : 'star'
        });
      }

      const target = p.owner === match.p1 ? match.p2 : match.p1;
      if (target && target.knockdown <= 0 && target.wakeup <= 0 && target.invuln <= 0) {
        const dx = target.x - p.x;
        const dy = (target.y - (target.ducking ? 45 : 85)) - p.y;
        if (Math.hypot(dx, dy) < p.radius + 35) {
          p.hit = true;
          
          // Perfect Parry contra projéteis
          if (target.blocking && target.blockTimer > 0 && target.blockTimer <= 10) {
            target.meter = clamp(target.meter + 25, 0, 100);
            target.hitFlash = 0;
            match.shake = Math.max(match.shake, 4);
            sound('parry', 1.0);
            return false;
          }

          let dmg = p.damage;
          const tune = DIFFICULTY[difficulty];
          if (p.owner.cpu) dmg *= tune.cpuDamageMult;
          else if (target.cpu) dmg *= tune.playerDamageMult;

          if (target.blocking) {
            dmg *= 0.15; // Chip damage
            sound('block', 0.95);
            target.vx = Math.sign(p.vx) * 2.0;
          } else {
            target.health = clamp(target.health - dmg, 0, 100);
            target.hitFlash = 0;
            target.stun = 22;
            target.vx = Math.sign(p.vx) * 6.5;
            p.owner.combo++; p.owner.comboTimer = 70;
            if (p.owner.combo >= 2) sound('combo', clamp(1 + p.owner.combo * 0.1, 1, 1.6));
            
            match.shake = Math.max(match.shake, 5);
            match.hitStop = 4;
            sound('hit_projectile', 1.0);
          }
          return false;
        }
      }

      return (--p.life) > 0 && p.x >= -60 && p.x <= 1020;
    });
  }

  function update() {
    if (!match || match.paused || match.ended || match.roundOver) return;
    
    if (match.specialFreeze > 0) {
      match.specialFreeze--;
      if (match.specialAttacker) {
        match.specialAttacker.updateAnimation();
      }
      cleanInPlace(match.particles, p => { p.x += p.vx; p.y += p.vy; p.vy += 0.38; return (--p.life) > 0; });
      if (match.specialFreeze <= 0) {
        match.specialAttacker = null;
      }
      return;
    }
    
    if (match.hitStop > 0) { match.hitStop--; return; }
    
    if (match.hitSparks) {
      cleanInPlace(match.hitSparks, s => (--s.life) > 0);
    }

    match.frames++;
    if (match.state === 'intro') {
      match.intro--;
      // Keep both fighters breathing while the announcer runs.
      match.p1.updateAnimation();
      match.p2.updateAnimation();
      if (match.intro === 72) announce(`ROUND ${match.round}... FIGHT!`, 800);
      if (match.intro <= 35) match.state = 'fight';
    } else {
      match.p1.update(match.p2);
      match.p2.update(match.p1);
      updateProjectiles();
      if (match.frames % 60 === 0) match.timer--;
      if (match.p1.health <= 0 || match.p2.health <= 0 || match.timer <= 0) endRound();
    }

    cleanInPlace(match.particles, p => { p.x += p.vx; p.y += p.vy; p.vy += 0.38; return (--p.life) > 0; });
    cleanInPlace(match.impacts, impact => (--impact.life) > 0);

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
    if (player.meter >= 100) tip = mobile ? '★ ESPECIAL PRONTO! Toque no botão rosa para disparar sua magia!' : '★ SUPER ESPECIAL! Aperte R ou Espaço para disparar projéteis devastadores.';
    else if (player.health < 35) tip = mobile ? 'Defesa Perfeita: toque na defesa no frame exato (Rock Block) para 0 dano!' : 'ROCK BLOCK: Defenda (S/↓) no momento do impacto para 0 dano e +25% de barra!';
    else if (distance > 180 && player.meter >= 50) tip = mobile ? '★ MINI-ESPECIAL! Dispare magias e projéteis com 50% de barra!' : 'HADOKEN! Com 50% da barra, aperte R para atirar projéteis e controlar a distância.';
    else if (!match.p2.grounded && distance < 145) tip = mobile ? 'ANTIAÉREO! O rival saltou! Execute ↓ + P para um Gancho invulnerável!' : 'SHORYUKEN! Rival saltando: use ↓ + Q para um Gancho antiaéreo com invulnerabilidade!';
    else {
      const tips = mobile ? [
        'COMBO GATLING: Acertou P? Toque em K logo em seguida para cancelar e emendar combo!',
        'RASTEIRA: ↓ + K acerta embaixo e derruba ao chão (Hard Knockdown).',
        'SPECIAL CANCEL: Conectou um golpe? Toque em ★ para cancelar no Especial na hora!',
        'ROCK BLOCK (Parry): Defenda na hora H para refletir ataques!'
      ] : [
        'COMBO GATLING: Acertou Soco (Q)? Aperte Chute (E) ou ↓+E na hora para cancelar em combo!',
        'RASTEIRA: ↓ + E acerta embaixo, rasga a guarda e derruba no chão (Hard Knockdown).',
        'SPECIAL CANCEL: Acertou qualquer normal? Aperte R na hora para cancelar em Especial!',
        'ROCK BLOCK (Parry): Defenda no momento exacto do golpe para 0 dano e +25% de especial!'
      ];
      tip = tips[Math.floor(match.frames / 260) % tips.length];
    }
    if (dom.coachText) dom.coachText.textContent = tip;
  }

  function updateHud() {
    if (!match) return;
    dom.p1Health.style.transform = `scaleX(${match.p1.health / 100})`;
    dom.p2Health.style.transform = `scaleX(${match.p2.health / 100})`;
    dom.p1Meter.style.width = `${match.p1.meter}%`;
    dom.p2Meter.style.width = `${match.p2.meter}%`;
    
    // Dynamic styling of meter color
    const p1Meter = match.p1.meter;
    dom.p1Meter.style.background = p1Meter >= 100 ? '#ffc44d' : p1Meter >= 50 ? '#23d7ef' : '#8e183a';
    dom.p1Meter.style.boxShadow = p1Meter >= 50 ? `0 0 8px ${p1Meter >= 100 ? '#ffc44d' : '#23d7ef'}` : 'none';
    
    const p2Meter = match.p2.meter;
    dom.p2Meter.style.background = p2Meter >= 100 ? '#ffc44d' : p2Meter >= 50 ? '#23d7ef' : '#8e183a';
    dom.p2Meter.style.boxShadow = p2Meter >= 50 ? `0 0 8px ${p2Meter >= 100 ? '#ffc44d' : '#23d7ef'}` : 'none';

    const updateMeterLabel = (el, meter) => {
      if (!el) return;
      if (meter >= 100) {
        if (el.textContent !== 'SUPER!') {
          el.textContent = 'SUPER!';
          el.style.color = '#ffc44d';
          el.classList.add('is-ready');
        }
      } else if (meter >= 50) {
        if (el.textContent !== 'MINI!') {
          el.textContent = 'MINI!';
          el.style.color = '#23d7ef';
          el.classList.add('is-ready');
        }
      } else {
        if (el.textContent !== 'CARREGANDO') {
          el.textContent = 'CARREGANDO';
          el.style.color = '';
          el.classList.remove('is-ready');
        }
      }
    };
    updateMeterLabel(dom.p1Ready, p1Meter);
    updateMeterLabel(dom.p2Ready, p2Meter);
    
    dom.timer.textContent = String(Math.max(0, match.timer)).padStart(2, '0');
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

    const canvasW = gameCanvas.width;
    const canvasH = gameCanvas.height;

    // Camera shake + pan can expose slivers of whatever was drawn last frame
    // around the letterboxed edges; the stage layer is opaque everywhere
    // else, so this only has to cover the margin, but it's cheap either way.
    ctx.fillStyle = '#09050d';
    ctx.fillRect(0, 0, canvasW, canvasH);

    ctx.save();
    ctx.scale(canvasW / 960, canvasH / 540);

    let targetCamX = (match.p1.x + match.p2.x) / 2;
    const dist = Math.abs(match.p1.x - match.p2.x);
    let targetZoom = clamp(960 / (dist + 380), 1.0, 1.14);
    let lerpSpeed = 0.08;
    
    if (match.specialFreeze > 0 && match.specialAttacker) {
      targetCamX = match.specialAttacker.x;
      targetZoom = 1.35;
      lerpSpeed = 0.15;
    }
    
    match.camX += (targetCamX - match.camX) * lerpSpeed;
    match.camZoom += (targetZoom - match.camZoom) * lerpSpeed;

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

    // 1. Stage
    drawStage(ctx, match.frames);

    if (match.specialFreeze > 0 && match.specialAttacker) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.fillRect(-200, -50, STAGE_W, STAGE_H);
    }

    // Pose both skeletons once; every pass below reuses these buffers.
    composeFighter(match.p1);
    composeFighter(match.p2);

    // 2. Floor reflections, mirrored about the stage floor line
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.scale(1, -1);
    ctx.translate(0, -850);
    drawFighter(ctx, match.p1, match.p1.x, match.p1.y, 1, 0);
    drawFighter(ctx, match.p2, match.p2.x, match.p2.y, 1, 0);
    ctx.restore();

    // 3. Contact shadows, after-images, then the fighters themselves
    drawFighterShadow(ctx, match.p1);
    drawFighterShadow(ctx, match.p2);

    match.p1.afterimages.forEach(a => drawFighter(ctx, match.p1, a.x, a.y, 0.2 * a.life / 24, 0));
    match.p2.afterimages.forEach(a => drawFighter(ctx, match.p2, a.x, a.y, 0.2 * a.life / 24, 0));

    drawFighter(ctx, match.p1, match.p1.x, match.p1.y, 1, match.p1.hitFlash);
    drawFighter(ctx, match.p2, match.p2.x, match.p2.y, 1, match.p2.hitFlash);

    drawStrikeTrail(ctx, match.p1);
    drawStrikeTrail(ctx, match.p2);
    drawSpecialFx(ctx, match.p1);
    drawSpecialFx(ctx, match.p2);

    // 4. Draw Particle Effects, Combos & Text Impacts
    drawEffects();

    ctx.restore();
  }

  function drawCrtOverlay(c, w, h) {
    // Soft vignette only — no scanline flicker / white wash
    c.save();
    const g = c.createRadialGradient(w / 2, h / 2, h * 0.45, w / 2, h / 2, h * 0.85);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.18)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    c.restore();
  }

  // --- STAGE RENDERER ---
  // The backdrop splits in two: everything that never changes is painted once
  // into an offscreen canvas and blitted, while only the crowd, lights, fog and
  // EQ bars are redrawn per frame. That removes several hundred path operations
  // and a fistful of gradient allocations from every tick of the render loop.
  const STAGE_W = 1360;
  const STAGE_H = 600;
  const STAGE_X = -200;
  const STAGE_Y = -50;

  const stageCache = { canvas: null, ctx: null, stage: null, dirty: true };

  function stageLayer() {
    if (!stageCache.canvas) {
      stageCache.canvas = document.createElement('canvas');
      stageCache.canvas.width = STAGE_W;
      stageCache.canvas.height = STAGE_H;
      stageCache.ctx = stageCache.canvas.getContext('2d');
    }
    if (stageCache.stage !== currentStage || stageCache.dirty) {
      const c = stageCache.ctx;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, STAGE_W, STAGE_H);
      // Paint in stage coordinates so the drawing code below reads naturally.
      c.translate(-STAGE_X, -STAGE_Y);
      drawStageStatic(c);
      c.setTransform(1, 0, 0, 1, 0, 0);
      stageCache.stage = currentStage;
      stageCache.dirty = false;
    }
    return stageCache.canvas;
  }

  /** Draws the backing photo for `stage`, scaled to fill the stage canvas.
   *  Returns true if a photo was drawn, false if the caller should fall back
   *  to its procedural gradient. */
  function drawStagePhoto(c, stage) {
    const img = stagePhotos[stage];
    if (!img) return false;
    c.drawImage(img, STAGE_X, STAGE_Y, STAGE_W, STAGE_H);
    return true;
  }

  function drawStageStatic(c) {
    if (currentStage === 'woodstock') {
      if (!drawStagePhoto(c, 'woodstock')) {
        // Dusk sky over the festival field: deep violet night bleeding into a
        // warm, low sunset band on the horizon.
        const bg = c.createLinearGradient(0, -50, 0, 460);
        bg.addColorStop(0, '#120a2c');
        bg.addColorStop(0.3, '#3a1442');
        bg.addColorStop(0.56, '#8a2b46');
        bg.addColorStop(0.78, '#e15a3a');
        bg.addColorStop(1, '#ffb14d');
        c.fillStyle = bg;
        c.fillRect(STAGE_X, STAGE_Y, STAGE_W, 510);

        c.fillStyle = 'rgba(255,255,255,0.55)';
        [[40, 10], [130, 40], [260, 5], [610, 15], [760, 45], [900, 10], [980, 30]].forEach(([sx, sy]) => {
          c.beginPath(); c.arc(sx, sy, 1.4, 0, Math.PI * 2); c.fill();
        });

        // Low setting sun with soft rays, backlighting the stage rig.
        c.save();
        c.globalCompositeOperation = 'screen';
        c.strokeStyle = 'rgba(255, 214, 140, 0.1)';
        c.lineWidth = 10;
        for (let r = 0; r < 14; r++) {
          const ang = (r / 14) * Math.PI * 2;
          c.beginPath();
          c.moveTo(480, 340);
          c.lineTo(480 + Math.cos(ang) * 260, 340 + Math.sin(ang) * 260);
          c.stroke();
        }
        c.restore();
        const sunG = c.createRadialGradient(480, 340, 15, 480, 340, 210);
        sunG.addColorStop(0, '#fff6d8');
        sunG.addColorStop(0.3, '#ffcf6b');
        sunG.addColorStop(0.65, 'rgba(240, 100, 55, 0.4)');
        sunG.addColorStop(1, 'transparent');
        c.fillStyle = sunG;
        c.beginPath(); c.arc(480, 340, 210, 0, Math.PI * 2); c.fill();

        // Rolling hills, layered for depth.
        c.fillStyle = '#4a2a52';
        c.beginPath();
        c.moveTo(-100, 400); c.lineTo(-100, 340);
        c.bezierCurveTo(80, 300, 260, 350, 480, 330);
        c.bezierCurveTo(700, 310, 860, 345, 1060, 320);
        c.lineTo(1060, 400); c.closePath(); c.fill();

        c.fillStyle = '#2a1530';
        c.beginPath();
        c.moveTo(-100, 420); c.lineTo(-100, 368);
        c.bezierCurveTo(100, 338, 250, 385, 450, 370);
        c.bezierCurveTo(680, 350, 820, 385, 1060, 360);
        c.lineTo(1060, 420); c.closePath(); c.fill();

        // A broad sunset glow behind the hillside so the crowd silhouette in
        // front of it actually reads as backlit shapes rather than melting
        // into the hill color.
        c.save();
        c.globalCompositeOperation = 'screen';
        const crowdGlow = c.createRadialGradient(480, 380, 20, 480, 380, 420);
        crowdGlow.addColorStop(0, 'rgba(255, 190, 120, 0.4)');
        crowdGlow.addColorStop(0.55, 'rgba(220, 110, 70, 0.16)');
        crowdGlow.addColorStop(1, 'transparent');
        c.fillStyle = crowdGlow;
        c.fillRect(-200, 300, 1360, 170);
        c.restore();

        // Packed hillside crowd, painted once (see initRealisticStageSprites).
        if (stageSprites.woodstockCrowd) c.drawImage(stageSprites.woodstockCrowd, -100, 320);

        // Sagging string lights strung between the two rig towers.
        c.strokeStyle = 'rgba(255, 210, 140, 0.5)';
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(60, 60);
        c.quadraticCurveTo(480, 130, 900, 60);
        c.stroke();
        const bulbColors = ['#ffd97a', '#ff8f6b', '#8fe3c0'];
        for (let x = 60, i = 0; x <= 900; x += 42, i++) {
          const t = (x - 60) / 840;
          const y = 60 + Math.sin(t * Math.PI) * 70;
          c.fillStyle = bulbColors[i % 3];
          c.beginPath(); c.arc(x, y, 2.6, 0, Math.PI * 2); c.fill();
        }
      }

      // Props stay on top either way -- real photo or procedural fallback --
      // for stage identity.
      if (stageSprites.woodstockDrumKit) c.drawImage(stageSprites.woodstockDrumKit, 340, 235);
      if (stageSprites.marshallStack) {
        c.drawImage(stageSprites.marshallStack, 170, 195);
        c.drawImage(stageSprites.marshallStack, 650, 195);
      }
      if (stageSprites.woodstockRigLeft) c.drawImage(stageSprites.woodstockRigLeft, -30, 20);
      if (stageSprites.woodstockRigRight) c.drawImage(stageSprites.woodstockRigRight, 770, 20);


      // Rough-plank wooden stage floor.
      const floorG = c.createLinearGradient(0, 420, 0, 540);
      floorG.addColorStop(0, '#5a3a20');
      floorG.addColorStop(0.25, '#3c2513');
      floorG.addColorStop(1, '#160d06');
      c.fillStyle = floorG;
      c.fillRect(-200, 420, 1360, 120);

      c.strokeStyle = 'rgba(20, 10, 4, 0.5)';
      c.lineWidth = 2;
      for (let y = 432; y < 540; y += 15) {
        c.beginPath(); c.moveTo(-100, y); c.lineTo(1060, y); c.stroke();
      }
      c.strokeStyle = 'rgba(255, 200, 130, 0.14)';
      c.lineWidth = 1;
      for (let x = -100; x <= 1060; x += 46) {
        c.beginPath(); c.moveTo(x, 420); c.lineTo(x + 6, 540); c.stroke();
      }

      // Hay bales bracketing the front edge of the stage.
      [[-70, 470], [980, 470]].forEach(([hx, hy]) => {
        c.fillStyle = '#c99a3c';
        c.fillRect(hx, hy, 70, 44);
        c.strokeStyle = '#8a6420'; c.lineWidth = 2;
        for (let i = 12; i < 70; i += 16) { c.beginPath(); c.moveTo(hx + i, hy); c.lineTo(hx + i, hy + 44); c.stroke(); }
        c.beginPath(); c.moveTo(hx, hy + 14); c.lineTo(hx + 70, hy + 14); c.moveTo(hx, hy + 30); c.lineTo(hx + 70, hy + 30); c.stroke();
      });

      c.strokeStyle = '#ffae3d';
      c.lineWidth = 3;
      c.shadowColor = '#ffae3d';
      c.shadowBlur = 14;
      c.beginPath(); c.moveTo(-100, 420); c.lineTo(1060, 420); c.stroke();
      c.shadowBlur = 0;
      return;
    }

    if (currentStage === 'club') {
      if (!drawStagePhoto(c, 'club')) {
        const bg = c.createLinearGradient(0, -50, 0, 540);
        bg.addColorStop(0, '#0d0408');
        bg.addColorStop(0.5, '#240813');
        bg.addColorStop(1, '#080205');
        c.fillStyle = bg;
        c.fillRect(STAGE_X, STAGE_Y, STAGE_W, STAGE_H);
      }

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

      if (stageSprites.woodstockDrumKit) c.drawImage(stageSprites.woodstockDrumKit, 350, 238);
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

    // Stadium
    if (!drawStagePhoto(c, 'stadium')) {
      const bg = c.createLinearGradient(0, -50, 0, 540);
      bg.addColorStop(0, '#06040d');
      bg.addColorStop(0.45, '#1b0826');
      bg.addColorStop(0.8, '#0b0612');
      c.fillStyle = bg;
      c.fillRect(STAGE_X, STAGE_Y, STAGE_W, STAGE_H);
    }

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

    if (stageSprites.woodstockDrumKit) c.drawImage(stageSprites.woodstockDrumKit, 340, 232);
    if (stageSprites.marshallStack) {
      [-20, 75, 170].forEach((ax, idx) => c.drawImage(stageSprites.marshallStack, ax, 190 + (idx % 2) * 12));
      [650, 745, 840].forEach((ax, idx) => c.drawImage(stageSprites.marshallStack, ax, 190 + (idx % 2) * 12));
    }

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
  }

  // A single pink-to-cyan gradient bar, pre-rendered once. Stretching it to
  // each EQ bar's own height with drawImage reproduces the same top-to-
  // bottom gradient a fresh createLinearGradient would, without paying for
  // ~38 gradient allocations every frame.
  let eqBarSprite = null;
  function getEqBarSprite() {
    if (eqBarSprite) return eqBarSprite;
    eqBarSprite = document.createElement('canvas');
    eqBarSprite.width = 1;
    eqBarSprite.height = 200;
    const g = eqBarSprite.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 200);
    grad.addColorStop(0, '#ff2e78');
    grad.addColorStop(1, '#23d7ef');
    g.fillStyle = grad;
    g.fillRect(0, 0, 1, 200);
    return eqBarSprite;
  }

  /** Crowd, lights, fog and EQ bars -- the parts that actually animate. */
  function drawStage(c, frame) {
    c.drawImage(stageLayer(), STAGE_X, STAGE_Y);

    if (currentStage === 'stadium') {
      c.save();
      c.globalAlpha = 0.18;
      const sprite = getEqBarSprite();
      for (let x = -50; x < 1010; x += 28) {
        const eqHeight = 80 + Math.sin(x * 0.05 + frame * 0.1) * 60 + Math.cos(x * 0.1) * 30;
        c.drawImage(sprite, 0, 0, 1, 200, x, 220 - eqHeight, 22, eqHeight);
      }
      c.restore();
    }

    if (currentStage === 'club') {
      c.save();
      c.font = 'italic 900 36px "Barlow Condensed"';
      c.textAlign = 'center';
      c.shadowColor = '#ff2e78';
      c.shadowBlur = 18 + Math.sin(frame * 0.1) * 8;
      c.fillStyle = '#ff2e78';
      c.fillText('⚡ UNDERGROUND ROCK CLUB ⚡', 480, 100);
      c.restore();
    }

    // Silhouetted crowd, swaying with the beat. Woodstock's hillside crowd is
    // baked into the static layer (drawStageStatic) instead of being redrawn
    // here every frame -- ~200 arc/rect ops per tick for a backdrop that
    // barely changes was pure waste.
    if (currentStage === 'stadium') {
      c.fillStyle = '#050308';
      c.beginPath();
      for (let i = -60; i < 1040; i += 22) {
        const headY = 385 + Math.sin(i * 0.15 + frame * 0.08) * 8;
        c.arc(i, headY, 14, Math.PI, 0);
        c.rect(i - 14, headY, 28, 45);
      }
      c.fill();
    }

    if (currentStage !== 'club') {
      const woodstock = currentStage === 'woodstock';
      crowdLights.forEach(light => {
        light.phase += light.speed;
        const alpha = (woodstock ? 0.35 : 0.4) + Math.sin(light.phase) * (woodstock ? 0.35 : 0.4);
        const color = woodstock ? '#ffcc54' : light.color;
        const ly = light.y + Math.sin(light.phase * 0.5) * (woodstock ? 5 : 4) - (woodstock ? 8 : 0);
        const r = light.size * (woodstock ? 1.3 : 1);
        c.save();
        c.fillStyle = color;
        c.globalAlpha = alpha;
        c.beginPath(); c.arc(light.x, ly, r, 0, Math.PI * 2); c.fill();
        drawGlow(c, light.x, ly, r * (woodstock ? 3.2 : 2.6), color, alpha);
        c.restore();
      });
    }

    // Sweeping spotlights.
    const beams = currentStage === 'woodstock' ? 5 : currentStage === 'club' ? 4 : 6;
    c.save();
    c.globalCompositeOperation = 'screen';
    for (let i = 0; i < beams; i++) {
      const spacing = currentStage === 'woodstock' ? 190 : currentStage === 'club' ? 230 : 160;
      const baseX = (currentStage === 'stadium' ? 60 : currentStage === 'club' ? 140 : 120) + i * spacing;
      const sweep = Math.sin(frame * (currentStage === 'stadium' ? 0.03 : 0.02) + i * 1.3) *
        (currentStage === 'stadium' ? 110 : currentStage === 'club' ? 80 : 75);
      const top = currentStage === 'woodstock' ? 20 : 30;
      const spotG = c.createLinearGradient(baseX, top, baseX + sweep, currentStage === 'woodstock' ? 440 : 425);
      const color = currentStage === 'stadium'
        ? (i % 3 === 0 ? 'rgba(35, 215, 239, 0.28)' : i % 3 === 1 ? 'rgba(255, 46, 120, 0.28)' : 'rgba(255, 196, 77, 0.24)')
        : currentStage === 'club' ? 'rgba(255, 196, 77, 0.32)' : 'rgba(255, 215, 135, 0.28)';
      spotG.addColorStop(0, color);
      spotG.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = spotG;
      const spread = currentStage === 'stadium' ? 90 : currentStage === 'club' ? 80 : 85;
      const bottom = currentStage === 'woodstock' ? 440 : 425;
      c.beginPath();
      c.moveTo(baseX - 15, top);
      c.lineTo(baseX + sweep - spread, bottom);
      c.lineTo(baseX + sweep + spread, bottom);
      c.lineTo(baseX + 15, top);
      c.closePath();
      c.fill();
    }
    c.restore();

    // Drifting haze.
    if (currentStage !== 'club') {
      const warm = currentStage === 'woodstock';
      stageFog.forEach(fog => {
        c.fillStyle = warm
          ? `rgba(255, 185, 125, ${fog.alpha * 1.2})`
          : `rgba(220, 180, 240, ${fog.alpha})`;
        c.beginPath(); c.arc(fog.x, fog.y, fog.radius, 0, Math.PI * 2); c.fill();
      });
    }
  }

  // --- FIGHTER RENDERER ---
  // FIGHTER_HEIGHT is declared near the top (shared with hitbox math).

  /**
   * Compose a fighter's skeleton into its offscreen buffer for this frame.
   * Called once per character; the result is reused for the sprite itself, its
   * floor reflection and its after-images.
   */
  function composeFighter(player) {
    const rig = rigs && rigs[player.data.id];
    if (!rig || !player.anim) return null;

    // Attacks read their pose straight off the hit timer so the visual
    // extension always lines up with the frame the hitbox goes active on.
    let progress;
    if (player.attack) {
      progress = 1 - player.attackTimer / player.attack.duration;
    }
    const sample = player.anim.sample(progress);
    rig.compose(sample.pose, sample.front);

    // Weapons attach to the lead fist (armFront* in left-facing art).
    if (player.attack) {
      const ctx = rig.bufferCtx;
      const front = sample.front || [];
      const leadName = front.includes('armFrontLower') ? 'armFrontLower'
        : front.includes('armBackLower') ? 'armBackLower'
          : 'armFrontLower';
      const m = rig._world[leadName] || rig._world['armFrontLower'] || rig._world['armBackLower'];
      if (m) {
        ctx.save();
        ctx.setTransform(m[0], m[3], m[1], m[4], m[2] + RockKombatRig.PAD.left, m[5] + RockKombatRig.PAD.top);
        if (player.data.id === 'kurt' && weaponGuitarImg.complete) {
          ctx.translate(10, 40);
          ctx.rotate(-0.55);
          ctx.drawImage(weaponGuitarImg, -90, -40, 150, 85);
        } else if (player.data.id === 'axl' && weaponMicImg.complete) {
          ctx.translate(15, 30);
          ctx.rotate(0.15);
          ctx.drawImage(weaponMicImg, -24, -150, 48, 200);
        } else if (player.data.id === 'lennon' && weaponDoveImg.complete) {
          ctx.translate(20, 10);
          ctx.drawImage(weaponDoveImg, -36, -36, 72, 72);
        }
        ctx.restore();
      }
    }

    return rig;
  }

  /** Blit a composed fighter buffer onto the stage. */
  function drawFighter(c, player, x, ground, alpha = 1, flash = 0) {
    const rig = rigs && rigs[player.data.id];
    if (!rig) return;

    const scale = FIGHTER_HEIGHT / rig.baseH;
    const facing = player.faceDir ? player.faceDir() : player.facing;
    c.save();
    // Multiply into the caller's alpha (e.g. the 0.2 the floor reflection
    // sets) instead of stomping it -- otherwise the reflection renders as a
    // fully opaque inverted clone instead of a faint ghost.
    c.globalAlpha = c.globalAlpha * alpha;
    c.translate(x, ground);
    // Source art faces left; facing=+1 means opponent is to the right, so
    // flip when facing right so both fighters look at each other.
    c.scale(-facing * scale, scale);

    // Landing squash keeps impacts weighty without needing extra art.
    if (player.landSquash > 0) {
      const squash = Math.sin((player.landSquash / 8) * Math.PI) * 0.09;
      c.scale(1 + squash, 1 - squash);
    }

    // Hard Knockdown: Deitado ao chão na queda
    if (player.knockdown > 0) {
      c.translate(0, -35);
      c.rotate(Math.PI / 2);
    }
    // Wakeup Invulnerability (Piscada translúcida)
    if (player.wakeup > 0 && Math.floor(player.animFrame / 3) % 2 === 0) {
      c.globalAlpha *= 0.45;
    }

    c.drawImage(rig.buffer, -rig.anchorX, -rig.anchorY);

    c.restore();
  }

  /** Contact shadow, sized by how far off the ground the fighter is. */
  function drawFighterShadow(c, player) {
    const height = Math.max(0, 425 - player.y);
    const alpha = clamp(0.62 - height * 0.0035, 0.12, 0.62);
    const rx = clamp(52 - height * 0.14, 16, 60);
    const ry = clamp(11 - height * 0.035, 3.5, 11);
    c.save();
    c.fillStyle = `rgba(0, 0, 0, ${alpha})`;
    c.beginPath();
    c.ellipse(player.x, 428, rx, ry, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  /** Subtle special cue — no neon blast overlays. */
  function drawSpecialFx(c, player) {
    if (!player.attack || (player.attack.type !== 'special' && player.attack.type !== 'mini_special')) return;
    const phase = 1 - player.attackTimer / player.attack.duration;
    if (phase < 0.25 || phase > 0.85) return;
    const facing = player.faceDir();
    c.save();
    c.globalAlpha = 0.4;
    c.strokeStyle = player.data.color;
    c.lineWidth = 3;
    c.beginPath();
    c.arc(player.x + facing * 50, player.y - 90, 28 + phase * 20, 0, Math.PI * 2);
    c.stroke();
    c.restore();
  }

  function drawStrikeTrail() { /* no trail flash */ }

  function announce(text, duration = 800) {
    const el = $('#announcer'); el.textContent = text; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    sound('announce');
    setTimeout(() => el.classList.remove('show'), duration);
  }

  // Pre-rendered radial-gradient glow dots, one per colour actually used.
  // `shadowBlur` re-runs a blur pass on the whole canvas for every glowing
  // shape it touches; with 40 crowd lights and a few dozen particles alive
  // during a special, that adds up to a lot of full-canvas blurs a frame.
  // Blitting a cached sprite with `globalCompositeOperation: 'lighter'`
  // reads the same (a soft additive glow) for a fraction of the cost.
  const glowSpriteCache = {};
  function glowSprite(color) {
    let sprite = glowSpriteCache[color];
    if (sprite) return sprite;
    const size = 64;
    sprite = document.createElement('canvas');
    sprite.width = sprite.height = size;
    const g = sprite.getContext('2d');
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, color);
    grad.addColorStop(0.4, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    glowSpriteCache[color] = sprite;
    return sprite;
  }

  /** Blits a glow sprite centred at (x, y) with the given on-canvas radius. */
  function drawGlow(c, x, y, radius, color, alpha = 1) {
    const sprite = glowSprite(color);
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha *= alpha;
    const d = radius * 2;
    c.drawImage(sprite, x - radius, y - radius, d, d);
    c.restore();
  }

  function drawEffects() {
    // Clear leftover FX queues — no floating labels / sparks / particle flashes
    if (match.particles) match.particles.length = 0;
    if (match.impacts) match.impacts.length = 0;
    if (match.hitSparks) match.hitSparks.length = 0;

    if (!match.projectiles) return;
    match.projectiles.forEach(p => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(8, p.radius * 0.7), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  /** Called once a player has taken 2 round wins -- ends the whole match. */
  function finishMatch() {
    if (match.ended) return;
    match.ended = true;
    RockKombatAudio.music.stop();
    const winner = match.wins.p1 > match.wins.p2 ? match.p1 : match.p2;
    const score = `${Math.max(match.wins.p1, match.wins.p2)}-${Math.min(match.wins.p1, match.wins.p2)}`;
    announce('VITÓRIA!', 1000);
    sound('special', 0.45);
    sound('crowd');
    setTimeout(() => {
      $('#result-kicker').textContent = `VITÓRIA POR ${score}`;
      const portrait = $('#winner-portrait'); portrait.innerHTML = '';
      $('#result-title').innerHTML = `${winner.data.short} <em>VENCEU!</em>`;
      $('#result-quote').textContent = `“${winner.data.quote}”`;
      portrait.style.setProperty('--portrait-image', `url("assets/${winner.data.portrait}")`);
      RockKombatAudio.jingle('victory');
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
    if (match.paused) RockKombatAudio.music.stop();
    else if (!match.ended) {
      lastFrameTime = 0; accumulator = 0; raf = requestAnimationFrame(loop);
      if (!muted) RockKombatAudio.music.play(currentStage);
    }
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
  $('#quit-fight').addEventListener('click', () => { match.ended = true; RockKombatAudio.music.stop(); $('#pause-modal').hidden = true; showScreen('select-screen'); });
  $('#sound-toggle').addEventListener('click', e => {
    muted = !muted;
    localStorage.setItem('rk-muted', muted ? '1' : '0');
    e.currentTarget.textContent = `SOM: ${muted ? 'OFF' : 'ON'}`;
    RockKombatAudio.setMuted(muted);
    if (muted) RockKombatAudio.music.stop();
    else { initAudio(); sound('ui'); if (match && !match.ended && !match.paused) RockKombatAudio.music.play(currentStage); }
  });
  if (localStorage.getItem('rk-muted') === '1') {
    muted = true;
    RockKombatAudio.setMuted(true);
    $('#sound-toggle').textContent = 'SOM: OFF';
  }
  $('#how-to-play').addEventListener('click', openHow);
  $('#open-guide-arena').addEventListener('click', openHow);
  $('#close-how').addEventListener('click', closeHow);
  $('#how-modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeHow(); });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && match && !match.ended && !match.paused) togglePause(true);
  });
})();
